/**
 * Folder WARP anchorからdirect-child Boneへtranslationだけを派生するpure helper。
 * static relationはpart-rig.jsのClipAsset.rigDefinitionが所有し、
 * Folder WARPのpose / topology / placementはClipInstance側からsampleする。
 * DOM、History、UI、別のWARP正本は所有しない。
 */

import { sampleClipFolderDeformers } from './clip-deformer.js';
import { createRectGridTopology } from './warp-grid-topology.js';
import { mapWarpBindPointToPose } from './warp-triangle-point-map.js';
import {
    applyTransformMatrix,
    invertTransformMatrix,
    multiplyTransformMatrices
} from '../transform-math.js';

export const WARP_ANCHOR_CONSTRAINT_VERSION = 1;

function clonePlainValue(value) {
    if (value === undefined || value === null || typeof value !== 'object') return value;
    try {
        return structuredClone(value);
    } catch {
        try {
            return JSON.parse(JSON.stringify(value));
        } catch {
            return value;
        }
    }
}

function hasOwn(value, key) {
    return value != null && Object.prototype.hasOwnProperty.call(value, key);
}

function normalizePoint(value) {
    const x = Number(value?.x);
    const y = Number(value?.y);
    return { x, y };
}

function isFinitePoint(value) {
    return Number.isFinite(value?.x) && Number.isFinite(value?.y);
}

export function normalizeWarpAnchorConstraint(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return clonePlainValue(value);
    }
    return {
        ...clonePlainValue(value),
        version: hasOwn(value, 'version')
            ? value.version
            : WARP_ANCHOR_CONSTRAINT_VERSION,
        sourceFolderLayerId: hasOwn(value, 'sourceFolderLayerId')
            ? value.sourceFolderLayerId
            : null,
        targetBoneId: hasOwn(value, 'targetBoneId')
            ? value.targetBoneId
            : null,
        bindPoint: normalizePoint(value.bindPoint),
        // 省略時だけ既定値を補い、明示された不正値はvalidatorへ渡す。
        enabled: hasOwn(value, 'enabled') ? value.enabled : true
    };
}

export function normalizeWarpAnchorConstraints(value) {
    if (value == null) return null;
    if (!Array.isArray(value)) return clonePlainValue(value);
    const constraints = value.map(normalizeWarpAnchorConstraint);
    return constraints.length > 0 ? constraints : null;
}

export function serializeWarpAnchorConstraints(value) {
    return normalizeWarpAnchorConstraints(value);
}

function remapId(id, idMap) {
    if (id == null) return id;
    if (idMap instanceof Map) return idMap.has(id) ? idMap.get(id) : id;
    if (idMap && typeof idMap === 'object' && hasOwn(idMap, id)) return idMap[id];
    return id;
}

export function remapWarpAnchorConstraints(value, idMap) {
    const constraints = normalizeWarpAnchorConstraints(value);
    if (!constraints) return constraints;
    return constraints.map(constraint => {
        if (!constraint || typeof constraint !== 'object' || Array.isArray(constraint)) {
            return clonePlainValue(constraint);
        }
        return {
            ...clonePlainValue(constraint),
            sourceFolderLayerId: remapId(constraint.sourceFolderLayerId, idMap),
            targetBoneId: remapId(constraint.targetBoneId, idMap),
            bindPoint: { ...constraint.bindPoint }
        };
    });
}

/**
 * RigDefinitionへのstatic constraint追加。呼出側が既存Rig全体をvalidationする。
 */
export function registerWarpAnchorConstraint(rigDefinition, constraint) {
    const normalized = normalizeWarpAnchorConstraint(constraint);
    if (!normalized || typeof normalized !== 'object' || Array.isArray(normalized)) {
        return { ok: false, reason: 'invalid-warp-anchor-constraint', value: rigDefinition };
    }
    const current = normalizeWarpAnchorConstraints(rigDefinition?.warpAnchorConstraints) || [];
    const duplicate = current.some(candidate => (
        candidate?.sourceFolderLayerId === normalized.sourceFolderLayerId
        && candidate?.targetBoneId === normalized.targetBoneId
    ));
    if (duplicate) {
        return {
            ok: false,
            reason: 'warp-anchor-constraint-duplicate',
            value: rigDefinition,
            constraint: normalized
        };
    }
    return {
        ok: true,
        changed: true,
        value: {
            ...(rigDefinition && typeof rigDefinition === 'object' ? clonePlainValue(rigDefinition) : {}),
            warpAnchorConstraints: [...current, normalized]
        },
        constraint: normalized
    };
}

export function removeWarpAnchorConstraint(rigDefinition, sourceFolderLayerId, targetBoneId) {
    const current = normalizeWarpAnchorConstraints(rigDefinition?.warpAnchorConstraints) || [];
    const next = current.filter(constraint => !(
        constraint?.sourceFolderLayerId === sourceFolderLayerId
        && constraint?.targetBoneId === targetBoneId
    ));
    const base = rigDefinition && typeof rigDefinition === 'object'
        ? clonePlainValue(rigDefinition)
        : {};
    delete base.warpAnchorConstraints;
    return {
        ok: true,
        changed: next.length !== current.length,
        value: {
            ...base,
            ...(next.length > 0 ? { warpAnchorConstraints: next } : {})
        }
    };
}

/** RigDefinitionのPart / Bone / bindingを参照したstatic relationの検証。 */
export function validateWarpAnchorConstraints(value, options = {}) {
    const constraints = normalizeWarpAnchorConstraints(value);
    const errors = [];
    if (value !== null && value !== undefined && !Array.isArray(value)) {
        errors.push({
            code: 'warp-anchor-constraints-invalid',
            path: 'rigDefinition.warpAnchorConstraints'
        });
        return { ok: false, errors, value: constraints };
    }
    if (!constraints) return { ok: true, errors, value: null };

    const partsById = options.partsById instanceof Map
        ? options.partsById
        : new Map((options.parts || []).map(part => [part?.partId, part]));
    const bonesById = options.bonesById instanceof Map
        ? options.bonesById
        : new Map((options.bones || []).map(bone => [bone?.boneId, bone]));
    const layersById = Array.isArray(options.internalLayers)
        ? new Map(options.internalLayers.map(layer => [layer?.id, layer]))
        : null;
    const bindings = Array.isArray(options.rigidBindings) ? options.rigidBindings : [];
    const targetIds = new Set();

    if (constraints.length > 1) {
        errors.push({
            code: 'warp-anchor-multiple-unsupported',
            path: 'rigDefinition.warpAnchorConstraints',
            count: constraints.length
        });
    }

    const isDescendantLayer = (layerId, ancestorId) => {
        if (!layersById || !layerId || !ancestorId || layerId === ancestorId) return false;
        const visited = new Set();
        let current = layersById.get(layerId) || null;
        while (current?.parentLayerId && !visited.has(current.id)) {
            if (current.parentLayerId === ancestorId) return true;
            visited.add(current.id);
            current = layersById.get(current.parentLayerId) || null;
        }
        return false;
    };

    constraints.forEach((constraint, index) => {
        const path = `rigDefinition.warpAnchorConstraints[${index}]`;
        if (!constraint || typeof constraint !== 'object' || Array.isArray(constraint)) {
            errors.push({ code: 'warp-anchor-constraint-invalid', path });
            return;
        }
        if (constraint.version !== WARP_ANCHOR_CONSTRAINT_VERSION) {
            errors.push({
                code: 'warp-anchor-constraint-version',
                path: `${path}.version`,
                version: constraint.version
            });
        }
        if (typeof constraint.sourceFolderLayerId !== 'string'
            || constraint.sourceFolderLayerId.length === 0) {
            errors.push({ code: 'warp-anchor-source-id-invalid', path: `${path}.sourceFolderLayerId` });
        }
        if (typeof constraint.targetBoneId !== 'string' || constraint.targetBoneId.length === 0) {
            errors.push({ code: 'warp-anchor-target-id-invalid', path: `${path}.targetBoneId` });
        }
        if (!isFinitePoint(constraint.bindPoint)) {
            errors.push({ code: 'warp-anchor-bind-point-invalid', path: `${path}.bindPoint` });
        }
        if (typeof constraint.enabled !== 'boolean') {
            errors.push({ code: 'warp-anchor-enabled-invalid', path: `${path}.enabled` });
        }

        const sourceLayer = layersById?.get(constraint.sourceFolderLayerId) || null;
        if (layersById && !sourceLayer) {
            errors.push({
                code: 'warp-anchor-source-layer-missing',
                path: `${path}.sourceFolderLayerId`,
                sourceFolderLayerId: constraint.sourceFolderLayerId
            });
        } else if (sourceLayer && sourceLayer.type !== 'folder') {
            errors.push({
                code: 'warp-anchor-source-layer-not-folder',
                path: `${path}.sourceFolderLayerId`
            });
        }
        if (sourceLayer && partsById.size > 0) {
            const nestedPartIds = [...partsById.keys()].filter(partId => (
                partId !== constraint.sourceFolderLayerId
                && isDescendantLayer(partId, constraint.sourceFolderLayerId)
            ));
            if (nestedPartIds.length > 0) {
                errors.push({
                    code: 'warp-anchor-source-subtree-part-unsupported',
                    path: `${path}.sourceFolderLayerId`,
                    nestedPartIds
                });
            }
        }
        if (!partsById.has(constraint.sourceFolderLayerId)) {
            errors.push({
                code: 'warp-anchor-source-part-missing',
                path: `${path}.sourceFolderLayerId`
            });
        }

        const binding = bindings.find(candidate => (
            candidate?.partId === constraint.sourceFolderLayerId
        )) || null;
        if (!binding || !bonesById.has(binding.boneId)) {
            errors.push({
                code: 'warp-anchor-source-binding-missing',
                path,
                sourceFolderLayerId: constraint.sourceFolderLayerId
            });
        }

        const targetBone = bonesById.get(constraint.targetBoneId) || null;
        if (!targetBone) {
            errors.push({
                code: 'warp-anchor-target-bone-missing',
                path: `${path}.targetBoneId`
            });
        } else if (binding && targetBone.parentBoneId !== binding.boneId) {
            errors.push({
                code: 'warp-anchor-target-not-direct-child',
                path: `${path}.targetBoneId`,
                sourceBoneId: binding.boneId,
                parentBoneId: targetBone.parentBoneId || null
            });
        }

        if (targetIds.has(constraint.targetBoneId)) {
            errors.push({
                code: 'warp-anchor-target-duplicate',
                path: `${path}.targetBoneId`,
                targetBoneId: constraint.targetBoneId
            });
        }
        targetIds.add(constraint.targetBoneId);
    });

    constraints.forEach((constraint, index) => {
        const binding = bindings.find(candidate => (
            candidate?.partId === constraint?.sourceFolderLayerId
        )) || null;
        if (binding && targetIds.has(binding.boneId)) {
            errors.push({
                code: 'warp-anchor-source-target-cycle',
                path: `rigDefinition.warpAnchorConstraints[${index}]`,
                sourceBoneId: binding.boneId
            });
        }
    });

    return { ok: errors.length === 0, errors, value: constraints };
}

/** Folder Partとrigid Boneを既存RenderIslandと同じ順で合成する。 */
export function resolveRigidBindingWorldMatrix(partPose, bonePose, bindBonePose) {
    if (!partPose?.worldMatrix) return { ok: false, reason: 'part-pose-missing' };
    if (!bonePose && !bindBonePose) {
        return { ok: true, worldMatrix: { ...partPose.worldMatrix }, boneDeltaMatrix: null };
    }
    if (!bonePose || !bindBonePose?.worldMatrix) {
        return { ok: false, reason: 'binding-pose-missing' };
    }
    const inverseBindMatrix = invertTransformMatrix(bindBonePose.worldMatrix);
    if (!inverseBindMatrix) return { ok: false, reason: 'non-invertible-bone-bind' };
    const boneDeltaMatrix = multiplyTransformMatrices(
        bonePose.worldMatrix,
        inverseBindMatrix
    );
    return {
        ok: true,
        boneDeltaMatrix,
        worldMatrix: multiplyTransformMatrices(partPose.worldMatrix, boneDeltaMatrix)
    };
}

function resolveSampledTriangles(sampled) {
    if (Array.isArray(sampled?.triangles)) return sampled.triangles;
    if (sampled?.type !== 'warp-grid') return null;
    const columns = Number.isInteger(sampled.columns) ? sampled.columns : 4;
    const rows = Number.isInteger(sampled.rows) ? sampled.rows : 4;
    return createRectGridTopology({ columns, rows })?.triangles || null;
}

function resolveLocalFrame(clip, timelineFrame) {
    const startFrame = Number.isInteger(clip?.startFrame) ? clip.startFrame : 0;
    return (Number.isFinite(timelineFrame) ? timelineFrame : startFrame) - startFrame;
}

/**
 * source Folder WARPのanchor deltaをtarget Boneごとのworld translationへ解決する。
 * 失敗はbase FKを壊さないdiagnosticとして返し、NaNやclampを混ぜない。
 */
export function resolveWarpAnchorTranslationOffsets(options = {}) {
    const constraints = normalizeWarpAnchorConstraints(options.constraints) || [];
    const offsets = new Map();
    const diagnostics = [];
    if (constraints.length === 0 || !options.clip) return { offsets, diagnostics };

    const sampledByFolderId = sampleClipFolderDeformers(
        options.clip.folderDeformers,
        resolveLocalFrame(options.clip, options.timelineFrame),
        Math.max(1, Number.isInteger(options.clip.duration) ? options.clip.duration : 1)
    );
    const bindings = Array.isArray(options.rigidBindings) ? options.rigidBindings : [];
    const layersById = Array.isArray(options.asset?.internalLayers)
        ? new Map(options.asset.internalLayers.map(layer => [layer?.id, layer]))
        : null;
    const isDescendantLayer = (layerId, ancestorId) => {
        if (!layersById || !layerId || !ancestorId || layerId === ancestorId) return false;
        const visited = new Set();
        let current = layersById.get(layerId) || null;
        while (current?.parentLayerId && !visited.has(current.id)) {
            if (current.parentLayerId === ancestorId) return true;
            visited.add(current.id);
            current = layersById.get(current.parentLayerId) || null;
        }
        return false;
    };
    constraints.forEach(constraint => {
        if (constraint?.enabled === false) {
            diagnostics.push({
                code: 'warp-anchor-disabled',
                sourceFolderLayerId: constraint?.sourceFolderLayerId,
                targetBoneId: constraint?.targetBoneId
            });
            return;
        }
        const sampled = sampledByFolderId.get(constraint?.sourceFolderLayerId) || null;
        if (!sampled) {
            diagnostics.push({
                code: 'warp-anchor-dormant',
                sourceFolderLayerId: constraint?.sourceFolderLayerId,
                targetBoneId: constraint?.targetBoneId
            });
            return;
        }
        const nestedWarpTarget = [...sampledByFolderId.keys()].find(folderLayerId => (
            isDescendantLayer(folderLayerId, constraint.sourceFolderLayerId)
        ));
        if (nestedWarpTarget) {
            diagnostics.push({
                code: 'warp-anchor-subtree-warp-unsupported',
                sourceFolderLayerId: constraint.sourceFolderLayerId,
                targetBoneId: constraint.targetBoneId,
                nestedWarpTarget
            });
            return;
        }
        const partPose = options.partPoseById?.get(constraint.sourceFolderLayerId) || null;
        const binding = bindings.find(candidate => (
            candidate?.partId === constraint.sourceFolderLayerId
        )) || null;
        const bonePose = binding
            ? options.bonePoseById?.get(binding.boneId) || null
            : null;
        const bindBonePose = binding
            ? options.bindBonePoseById?.get(binding.boneId) || null
            : null;
        const sourceWorld = resolveRigidBindingWorldMatrix(partPose, bonePose, bindBonePose);
        if (!sourceWorld.ok) {
            diagnostics.push({
                code: `warp-anchor-${sourceWorld.reason}`,
                sourceFolderLayerId: constraint.sourceFolderLayerId,
                targetBoneId: constraint.targetBoneId
            });
            return;
        }
        const triangles = resolveSampledTriangles(sampled);
        const common = {
            point: constraint.bindPoint,
            bindBounds: sampled.bindBounds,
            bindPoints: sampled.bindPoints,
            triangles,
            placement: sampled.placement
        };
        const baseline = mapWarpBindPointToPose({
            ...common,
            points: sampled.bindPoints
        });
        const pose = mapWarpBindPointToPose({
            ...common,
            points: sampled.points
        });
        if (!baseline.ok || !pose.ok) {
            diagnostics.push({
                code: 'warp-anchor-stale',
                reason: pose.ok ? baseline.reason : pose.reason,
                sourceFolderLayerId: constraint.sourceFolderLayerId,
                targetBoneId: constraint.targetBoneId
            });
            return;
        }
        const baselineWorld = applyTransformMatrix(
            sourceWorld.worldMatrix,
            baseline.point.x,
            baseline.point.y
        );
        const poseWorld = applyTransformMatrix(
            sourceWorld.worldMatrix,
            pose.point.x,
            pose.point.y
        );
        const x = poseWorld.x - baselineWorld.x;
        const y = poseWorld.y - baselineWorld.y;
        if (!Number.isFinite(x) || !Number.isFinite(y)) {
            diagnostics.push({
                code: 'warp-anchor-non-finite-delta',
                sourceFolderLayerId: constraint.sourceFolderLayerId,
                targetBoneId: constraint.targetBoneId
            });
            return;
        }
        offsets.set(constraint.targetBoneId, {
            x,
            y,
            sourceFolderLayerId: constraint.sourceFolderLayerId
        });
        diagnostics.push({
            code: 'warp-anchor-applied',
            sourceFolderLayerId: constraint.sourceFolderLayerId,
            targetBoneId: constraint.targetBoneId,
            x,
            y
        });
    });
    return { offsets, diagnostics };
}
