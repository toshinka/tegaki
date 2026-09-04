import {
    listControlMeshKeyframes,
    normalizeControlMeshDeformer,
    sampleControlMeshDeformer
} from './control-mesh-deformer.js';
import {
    listWarpGridKeyframes,
    normalizeWarpGridDeformer,
    sampleWarpGridDeformer
} from './warp-grid-deformer.js';

export const CLIP_FOLDER_DEFORMERS_VERSION = 1;

function getFolderDeformerTargets(value) {
    if (Array.isArray(value)) return value;
    return Array.isArray(value?.targets) ? value.targets : [];
}

function compareFolderDeformerTargets(left, right) {
    const leftId = String(left?.folderLayerId || '');
    const rightId = String(right?.folderLayerId || '');
    return leftId < rightId ? -1 : leftId > rightId ? 1 : 0;
}

function remapId(id, idMap) {
    if (!id) return id;
    if (idMap instanceof Map) return idMap.has(id) ? idMap.get(id) : id;
    if (idMap && typeof idMap === 'object' && Object.prototype.hasOwnProperty.call(idMap, id)) {
        return idMap[id];
    }
    return id;
}

/** ClipInstance.deformerのtype dispatcher。各schemaの正本は個別moduleに置く。 */
export function normalizeClipDeformer(value) {
    if (value?.type === 'control-mesh') return normalizeControlMeshDeformer(value);
    return normalizeWarpGridDeformer(value);
}

export function sampleClipDeformer(value, localFrame, duration = 1) {
    if (value?.type === 'control-mesh') {
        return sampleControlMeshDeformer(value, localFrame, duration);
    }
    return sampleWarpGridDeformer(value, localFrame, duration);
}

export function listClipDeformerKeyframes(value, duration = 1) {
    return value?.type === 'control-mesh'
        ? listControlMeshKeyframes(value, duration)
        : listWarpGridKeyframes(value, duration);
}

export function getClipDeformerKeyAtFrame(value, localFrame, duration = 1) {
    const frame = Number.isInteger(localFrame) ? localFrame : Math.round(Number(localFrame));
    if (!Number.isFinite(frame)) return null;
    return listClipDeformerKeyframes(value, duration).find(key => key.frame === frame) || null;
}

export function findAdjacentClipDeformerKeyFrame(value, localFrame, direction, duration = 1) {
    const frame = Number.isFinite(localFrame) ? localFrame : 0;
    const keys = listClipDeformerKeyframes(value, duration);
    if (direction < 0) return keys.findLast(key => key.frame < frame)?.frame ?? null;
    return keys.find(key => key.frame > frame)?.frame ?? null;
}

/**
 * ClipInstance.folderDeformersの保存shapeを正規化する。
 * Folder IDの存在・型はAssetを知らない純粋関数では判定しない。
 */
export function normalizeClipFolderDeformers(value) {
    const rawTargets = getFolderDeformerTargets(value);
    if (rawTargets.length === 0) return null;
    const targets = rawTargets
        .map(target => {
            const folderLayerId = typeof target?.folderLayerId === 'string'
                ? target.folderLayerId
                : '';
            const deformer = normalizeClipDeformer(target?.deformer);
            return folderLayerId && deformer ? { folderLayerId, deformer } : null;
        })
        .filter(Boolean)
        .sort(compareFolderDeformerTargets);
    return targets.length > 0
        ? { version: CLIP_FOLDER_DEFORMERS_VERSION, targets }
        : null;
}

export function serializeClipFolderDeformers(value) {
    return normalizeClipFolderDeformers(value);
}

/** Folder ID、重複、deformer schemaをAsset境界込みで検証する。 */
export function validateClipFolderDeformers(value, internalLayers = null) {
    const rawTargets = getFolderDeformerTargets(value);
    const errors = [];
    if (value !== null && value !== undefined) {
        if (typeof value !== 'object' || Array.isArray(value)) {
            errors.push({ code: 'folder-deformers-invalid' });
        } else {
            if (value.version !== CLIP_FOLDER_DEFORMERS_VERSION) {
                errors.push({ code: 'folder-deformers-version', version: value.version });
            }
            if (!Array.isArray(value.targets)) {
                errors.push({ code: 'folder-deformer-targets-invalid' });
            }
        }
    }
    const layersById = Array.isArray(internalLayers)
        ? new Map(internalLayers.map(layer => [layer?.id, layer]))
        : null;
    const seen = new Set();
    rawTargets.forEach((target, index) => {
        const folderLayerId = target?.folderLayerId;
        if (typeof folderLayerId !== 'string' || folderLayerId.length === 0) {
            errors.push({ code: 'folder-deformer-id-invalid', index });
            return;
        }
        if (seen.has(folderLayerId)) {
            errors.push({ code: 'folder-deformer-duplicate', folderLayerId });
        }
        seen.add(folderLayerId);
        const deformer = normalizeClipDeformer(target?.deformer);
        if (!deformer) errors.push({ code: 'folder-deformer-invalid', folderLayerId });
        if (layersById) {
            const layer = layersById.get(folderLayerId);
            if (!layer) {
                errors.push({ code: 'folder-deformer-layer-missing', folderLayerId });
            } else if (layer.type !== 'folder') {
                errors.push({ code: 'folder-deformer-layer-not-folder', folderLayerId });
            }
        }
    });
    return {
        ok: errors.length === 0,
        value: normalizeClipFolderDeformers(value),
        errors
    };
}

export function getClipFolderDeformer(value, folderLayerId) {
    if (!folderLayerId) return null;
    return normalizeClipFolderDeformers(value)?.targets
        .find(target => target.folderLayerId === folderLayerId)?.deformer || null;
}

/** Pure collection update used by TimelineModel; null deformer removes the target. */
export function setClipFolderDeformerTarget(value, folderLayerId, deformer) {
    const current = normalizeClipFolderDeformers(value);
    if (typeof folderLayerId !== 'string' || folderLayerId.length === 0) return current;
    const targets = (current?.targets || [])
        .filter(target => target.folderLayerId !== folderLayerId)
        .map(target => ({ folderLayerId: target.folderLayerId, deformer: normalizeClipDeformer(target.deformer) }))
        .filter(target => target.deformer);
    if (deformer !== null && deformer !== undefined) {
        const normalized = normalizeClipDeformer(deformer);
        if (!normalized) return current;
        targets.push({ folderLayerId, deformer: normalized });
    }
    targets.sort(compareFolderDeformerTargets);
    return targets.length > 0
        ? { version: CLIP_FOLDER_DEFORMERS_VERSION, targets }
        : null;
}

export function removeClipFolderDeformerTarget(value, folderLayerId) {
    return setClipFolderDeformerTarget(value, folderLayerId, null);
}

/** Clip-local Frameの各Folder WARP sampleをruntime Mapへ解決する。 */
export function sampleClipFolderDeformers(value, localFrame, duration = 1) {
    const result = new Map();
    (normalizeClipFolderDeformers(value)?.targets || []).forEach(target => {
        const sampled = sampleClipDeformer(target.deformer, localFrame, duration);
        if (sampled) result.set(target.folderLayerId, sampled);
    });
    return result;
}

export function remapClipFolderDeformers(value, internalLayerIdMap) {
    const normalized = normalizeClipFolderDeformers(value);
    if (!normalized) return null;
    const targets = normalized.targets.map(target => ({
        folderLayerId: remapId(target.folderLayerId, internalLayerIdMap),
        deformer: normalizeClipDeformer(target.deformer)
    }));
    return normalizeClipFolderDeformers({
        version: CLIP_FOLDER_DEFORMERS_VERSION,
        targets
    });
}
