/**
 * Auto Shape Skinへ離散的な頂点weight補正を確定するpure plan。
 *
 * 選択状態や補正差分を第二正本として保存せず、既存vertexWeightsを直接置換する。
 * generator側には再生成時の無言破棄を防ぐlineage markerだけを残す。
 */

import { AUTO_SHAPE_FILL_GENERATOR } from './auto-shape-raster-bone-setup.js';
import { CHAIN_LOCAL_JOINT_SKIN_WEIGHT_MODE } from './chain-local-joint-skin.js';
import { validateRasterBoneSkinning } from './raster-bone-skinning.js';

export const LIMITED_SKIN_CORRECTION_MODE = 'limited-discrete-v1';

export const SKIN_INFLUENCE_CORRECTION_ACTIONS = Object.freeze({
    BONE_ONLY: 'bone-only',
    PARENT_BLEND: 'parent-blend',
    NONE: 'none'
});

function sameInfluences(left, right) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
    return left.every((influence, index) => (
        influence?.boneId === right[index]?.boneId
        && Math.abs(Number(influence?.weight) - Number(right[index]?.weight)) <= 1e-9
    ));
}

function createInfluences(action, bone, boneById) {
    if (action === SKIN_INFLUENCE_CORRECTION_ACTIONS.NONE) return { ok: true, influences: [] };
    if (action === SKIN_INFLUENCE_CORRECTION_ACTIONS.BONE_ONLY) {
        return { ok: true, influences: [{ boneId: bone.boneId, weight: 1 }] };
    }
    if (action === SKIN_INFLUENCE_CORRECTION_ACTIONS.PARENT_BLEND) {
        const parentBoneId = bone.parentBoneId || null;
        if (!parentBoneId || !boneById.has(parentBoneId)) {
            return { ok: false, reason: 'parent-bone-required' };
        }
        return {
            ok: true,
            influences: [
                { boneId: bone.boneId, weight: 0.5 },
                { boneId: parentBoneId, weight: 0.5 }
            ]
        };
    }
    return { ok: false, reason: 'correction-action-invalid' };
}

/**
 * 一Raster / 一Mesh / 選択Bone / stable vertex IDだけを対象に補正planを返す。
 * assetは変更しない。changed=falseならHistoryを作らないためのno-opである。
 */
export function createSkinInfluenceCorrectionPlan(
    asset,
    targetInternalLayerId,
    boneId,
    selectedVertexIds,
    action
) {
    if (!asset || !targetInternalLayerId || !boneId) {
        return { ok: false, changed: false, reason: 'correction-target-required' };
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
    if (mesh.generator?.type !== AUTO_SHAPE_FILL_GENERATOR
        || mesh.generator?.weightMode !== CHAIN_LOCAL_JOINT_SKIN_WEIGHT_MODE) {
        return { ok: false, changed: false, reason: 'chain-local-auto-shape-required' };
    }
    const binding = (validation.skinBindings || [])
        .find(candidate => candidate?.meshId === mesh.meshId) || null;
    if (!binding) return { ok: false, changed: false, reason: 'skin-binding-not-found' };

    const boneById = new Map((asset.rigDefinition?.bones || [])
        .filter(bone => typeof bone?.boneId === 'string' && bone.boneId.length > 0)
        .map(bone => [bone.boneId, bone]));
    const bone = boneById.get(boneId) || null;
    if (!bone) return { ok: false, changed: false, reason: 'bone-not-found' };
    const influenceResult = createInfluences(action, bone, boneById);
    if (!influenceResult.ok) return { ...influenceResult, changed: false };

    const requestedIds = [...new Set(Array.isArray(selectedVertexIds)
        ? selectedVertexIds.filter(vertexId => typeof vertexId === 'string' && vertexId.length > 0)
        : [])];
    if (requestedIds.length === 0) {
        return { ok: false, changed: false, reason: 'vertex-selection-required' };
    }
    const meshVertexIds = new Set((mesh.vertices || []).map(vertex => vertex?.vertexId).filter(Boolean));
    const missingVertexIds = requestedIds.filter(vertexId => !meshVertexIds.has(vertexId));
    if (missingVertexIds.length > 0) {
        return { ok: false, changed: false, reason: 'vertex-not-found', missingVertexIds };
    }

    const requestedIdSet = new Set(requestedIds);
    const weightsByVertexId = new Map((binding.vertexWeights || [])
        .map(vertexWeight => [vertexWeight?.vertexId, vertexWeight]));
    const changedVertexIds = [];
    const nextVertexWeights = (mesh.vertices || []).map(vertex => {
        const current = weightsByVertexId.get(vertex.vertexId) || {
            vertexId: vertex.vertexId,
            influences: []
        };
        if (!requestedIdSet.has(vertex.vertexId)) {
            return {
                ...current,
                influences: (current.influences || []).map(influence => ({ ...influence }))
            };
        }
        const influences = influenceResult.influences.map(influence => ({ ...influence }));
        if (!sameInfluences(current.influences || [], influences)) changedVertexIds.push(vertex.vertexId);
        return { ...current, vertexId: vertex.vertexId, influences };
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
                    weightCorrectionMode: LIMITED_SKIN_CORRECTION_MODE
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
            reason: 'invalid-correction-result',
            errors: nextValidation.errors
        };
    }
    return {
        ok: true,
        changed,
        reason: null,
        action,
        meshId: mesh.meshId,
        targetInternalLayerId,
        boneId,
        requestedVertexIds: requestedIds,
        changedVertexIds,
        meshDefinitions: nextValidation.meshDefinitions,
        skinBindings: nextValidation.skinBindings
    };
}
