/**
 * CURRENTなAUTO GRID / AUTO SHAPE Meshへ連続Weight補正を確定するpure plan。
 *
 * topology、頂点座標、Bone hierarchy、generator sourceは変更せず、既存の
 * skinBindings[].vertexWeightsだけを正本として置換する。
 */

import { AUTO_SHAPE_FILL_GENERATOR } from './auto-shape-raster-bone-setup.js';
import { ALPHA_FIT_GRID_GENERATOR } from './raster-bone-auto-setup.js';
import { validateRasterBoneSkinning } from './raster-bone-skinning.js';

export const FIXED_TOPOLOGY_SKIN_WEIGHT_BRUSH_MODE = 'fixed-topology-brush-v1';

const WEIGHT_EPSILON = 1e-9;

function clampUnit(value) {
    return Math.max(0, Math.min(1, value));
}

function normalizePositiveInfluences(influences) {
    const positive = (Array.isArray(influences) ? influences : [])
        .filter(influence => Number.isFinite(influence?.weight) && influence.weight > 0)
        .map(influence => ({ boneId: influence.boneId, weight: influence.weight }));
    const total = positive.reduce((sum, influence) => sum + influence.weight, 0);
    if (!(total > 0)) return [];
    return positive.map(influence => ({
        boneId: influence.boneId,
        weight: influence.weight / total
    }));
}

function influenceMap(influences) {
    return new Map(normalizePositiveInfluences(influences)
        .map(influence => [influence.boneId, influence.weight]));
}

function sameInfluences(left, right) {
    const leftByBoneId = influenceMap(left);
    const rightByBoneId = influenceMap(right);
    if (leftByBoneId.size !== rightByBoneId.size) return false;
    return [...leftByBoneId.entries()].every(([boneId, weight]) => (
        rightByBoneId.has(boneId)
        && Math.abs(weight - rightByBoneId.get(boneId)) <= WEIGHT_EPSILON
    ));
}

function strongestCompanion(influences, selectedBoneId) {
    return normalizePositiveInfluences(influences)
        .filter(influence => influence.boneId !== selectedBoneId)
        .sort((left, right) => (
            right.weight - left.weight
            || left.boneId.localeCompare(right.boneId)
        ))[0] || null;
}

function createTransferredInfluences(currentInfluences, selectedBoneId, delta) {
    const normalized = normalizePositiveInfluences(currentInfluences);
    const currentSelectedWeight = normalized
        .find(influence => influence.boneId === selectedBoneId)?.weight || 0;
    const targetWeight = clampUnit(currentSelectedWeight + delta);

    if (Math.abs(targetWeight - currentSelectedWeight) <= WEIGHT_EPSILON) {
        return { changed: false, influences: currentInfluences };
    }

    const companion = strongestCompanion(normalized, selectedBoneId);
    if (targetWeight >= 1 - WEIGHT_EPSILON) {
        return {
            changed: !sameInfluences(currentInfluences, [{ boneId: selectedBoneId, weight: 1 }]),
            influences: [{ boneId: selectedBoneId, weight: 1 }]
        };
    }
    if (targetWeight <= WEIGHT_EPSILON) {
        const influences = companion
            ? [{ boneId: companion.boneId, weight: 1 }]
            : [];
        return {
            changed: !sameInfluences(currentInfluences, influences),
            influences
        };
    }
    if (!companion) {
        return {
            changed: false,
            skippedReason: 'companion-required',
            influences: currentInfluences
        };
    }
    const influences = [
        { boneId: selectedBoneId, weight: targetWeight },
        { boneId: companion.boneId, weight: 1 - targetWeight }
    ];
    return {
        changed: !sameInfluences(currentInfluences, influences),
        influences
    };
}

/**
 * 一Raster / 一Mesh / 選択Boneとstable vertex IDごとのsigned deltaを受ける。
 * assetは変更しない。changed=falseならHistoryを作らないno-opである。
 */
export function createSkinWeightBrushPlan(
    asset,
    targetInternalLayerId,
    boneId,
    vertexDeltas
) {
    if (!asset || !targetInternalLayerId || !boneId) {
        return { ok: false, changed: false, reason: 'brush-target-required' };
    }
    const validation = validateRasterBoneSkinning(
        asset.meshDefinitions,
        asset.skinBindings,
        asset.internalLayers,
        asset.rigDefinition
    );
    if (!validation.ok) {
        return { ok: false, changed: false, reason: 'invalid-raster-skin', errors: validation.errors };
    }

    const meshCandidates = (validation.meshDefinitions || [])
        .filter(mesh => mesh?.targetInternalLayerId === targetInternalLayerId);
    if (meshCandidates.length !== 1) {
        return {
            ok: false,
            changed: false,
            reason: meshCandidates.length === 0 ? 'mesh-not-found' : 'ambiguous-mesh-target'
        };
    }
    const mesh = meshCandidates[0];
    if (mesh.generator?.type !== ALPHA_FIT_GRID_GENERATOR
        && mesh.generator?.type !== AUTO_SHAPE_FILL_GENERATOR) {
        return { ok: false, changed: false, reason: 'fixed-topology-generator-required' };
    }

    const binding = (validation.skinBindings || [])
        .find(candidate => candidate?.meshId === mesh.meshId) || null;
    if (!binding) return { ok: false, changed: false, reason: 'skin-binding-not-found' };

    const boneIds = new Set((asset.rigDefinition?.bones || [])
        .map(bone => bone?.boneId)
        .filter(candidateBoneId => typeof candidateBoneId === 'string' && candidateBoneId.length > 0));
    if (!boneIds.has(boneId)) return { ok: false, changed: false, reason: 'bone-not-found' };

    if (!Array.isArray(vertexDeltas) || vertexDeltas.length === 0) {
        return { ok: false, changed: false, reason: 'vertex-deltas-required' };
    }
    const deltaByVertexId = new Map();
    const duplicateVertexIds = [];
    for (const update of vertexDeltas) {
        if (!update
            || typeof update.vertexId !== 'string'
            || update.vertexId.length === 0
            || !Number.isFinite(update.delta)) {
            return { ok: false, changed: false, reason: 'invalid-vertex-delta' };
        }
        if (deltaByVertexId.has(update.vertexId)) duplicateVertexIds.push(update.vertexId);
        deltaByVertexId.set(update.vertexId, update.delta);
    }
    if (duplicateVertexIds.length > 0) {
        return {
            ok: false,
            changed: false,
            reason: 'duplicate-vertex-delta',
            duplicateVertexIds: [...new Set(duplicateVertexIds)]
        };
    }

    const meshVertexIds = new Set((mesh.vertices || []).map(vertex => vertex.vertexId));
    const missingVertexIds = [...deltaByVertexId.keys()]
        .filter(vertexId => !meshVertexIds.has(vertexId));
    if (missingVertexIds.length > 0) {
        return { ok: false, changed: false, reason: 'vertex-not-found', missingVertexIds };
    }

    const currentWeightByVertexId = new Map((binding.vertexWeights || [])
        .map(vertexWeight => [vertexWeight?.vertexId, vertexWeight]));
    const changedVertexIds = [];
    const skippedVertices = [];
    const nextVertexWeights = (mesh.vertices || []).map(vertex => {
        const current = currentWeightByVertexId.get(vertex.vertexId) || {
            vertexId: vertex.vertexId,
            influences: []
        };
        if (!deltaByVertexId.has(vertex.vertexId)) {
            return {
                ...current,
                influences: (current.influences || []).map(influence => ({ ...influence }))
            };
        }
        const transfer = createTransferredInfluences(
            current.influences || [],
            boneId,
            deltaByVertexId.get(vertex.vertexId)
        );
        if (transfer.skippedReason) {
            skippedVertices.push({ vertexId: vertex.vertexId, reason: transfer.skippedReason });
        }
        if (transfer.changed) changedVertexIds.push(vertex.vertexId);
        return {
            ...current,
            vertexId: vertex.vertexId,
            influences: (transfer.influences || []).map(influence => ({ ...influence }))
        };
    });

    const changed = changedVertexIds.length > 0;
    const nextSkinBindings = (validation.skinBindings || []).map(candidate => (
        candidate?.meshId === mesh.meshId
            ? { ...candidate, vertexWeights: nextVertexWeights }
            : candidate
    ));
    const nextMeshDefinitions = (validation.meshDefinitions || []).map(candidate => (
        candidate?.meshId === mesh.meshId && changed
            ? {
                ...candidate,
                generator: {
                    ...candidate.generator,
                    weightCorrectionMode: FIXED_TOPOLOGY_SKIN_WEIGHT_BRUSH_MODE
                }
            }
            : candidate
    ));
    const nextValidation = validateRasterBoneSkinning(
        nextMeshDefinitions,
        nextSkinBindings,
        asset.internalLayers,
        asset.rigDefinition
    );
    if (!nextValidation.ok) {
        return {
            ok: false,
            changed: false,
            reason: 'invalid-brush-result',
            errors: nextValidation.errors
        };
    }

    return {
        ok: true,
        changed,
        reason: null,
        meshId: mesh.meshId,
        targetInternalLayerId,
        boneId,
        requestedVertexIds: [...deltaByVertexId.keys()],
        changedVertexIds,
        skippedVertices,
        meshDefinitions: nextValidation.meshDefinitions,
        skinBindings: nextValidation.skinBindings
    };
}
