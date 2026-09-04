/**
 * ============================================================================
 * ファイル名: system/animation/clip-layer-deformer.js
 * 責務: ClipInstance内の個別internal Raster WARP collectionをpureに正規化・検証・sampleする
 * 依存: clip-deformer.js
 * 被依存: animation-data-model.js、render plan、AnimationTablePopup（後続Gate）
 * Authority境界:
 * - CAF全体WARPはClipInstance.deformer、Folder subtreeはfolderDeformers、本moduleは個別Rasterだけを所有する。
 * - DrawingSnapshot、working Layer、Pixi Mesh、History、DOMを変更しない。
 * - deformer topology / key schemaは既存clip-deformer dispatcherを再利用する。
 * ============================================================================
 */

import {
    normalizeClipDeformer,
    sampleClipDeformer
} from './clip-deformer.js';

export const CLIP_LAYER_DEFORMERS_VERSION = 1;

function getTargets(value) {
    return Array.isArray(value?.targets) ? value.targets : [];
}

function remapId(id, idMap) {
    if (!id) return id;
    if (idMap instanceof Map) return idMap.has(id) ? idMap.get(id) : id;
    if (idMap && typeof idMap === 'object' && Object.prototype.hasOwnProperty.call(idMap, id)) {
        return idMap[id];
    }
    return id;
}

function compareTargets(left, right) {
    const leftId = String(left?.internalLayerId || '');
    const rightId = String(right?.internalLayerId || '');
    return leftId < rightId ? -1 : leftId > rightId ? 1 : 0;
}

function clonePoints(points) {
    return Array.isArray(points)
        ? points.map(point => ({ x: point.x, y: point.y }))
        : [];
}

function clonePlacement(placement) {
    return placement && typeof placement === 'object' ? { ...placement } : null;
}

function freezeSampledDeformer(sampled) {
    if (!sampled) return null;
    const points = clonePoints(sampled.points);
    const placement = clonePlacement(sampled.placement);
    return normalizeClipDeformer({
        ...sampled,
        points,
        keyframes: [{
            frame: 0,
            interpolation: 'hold',
            points: clonePoints(points),
            ...(placement ? { placement } : {})
        }]
    });
}

function retimeTerminalKeyframes(keyframes, oldDuration, newDuration) {
    const source = Array.isArray(keyframes) ? keyframes : [];
    const oldTerminalFrame = oldDuration - 1;
    const newTerminalFrame = newDuration - 1;
    const terminal = source.findLast(key => key?.frame === oldTerminalFrame) || null;
    const next = source
        .filter(key => Number.isInteger(key?.frame)
            && key.frame >= 0
            && key.frame < newDuration
            && key.frame !== oldTerminalFrame
            && (!terminal || key.frame !== newTerminalFrame))
        .map(key => structuredClone(key));
    if (terminal) next.push({ ...structuredClone(terminal), frame: newTerminalFrame });
    next.sort((left, right) => left.frame - right.frame);
    return next;
}

export function normalizeClipLayerDeformers(value) {
    const targets = getTargets(value)
        .map(target => {
            const internalLayerId = typeof target?.internalLayerId === 'string'
                ? target.internalLayerId
                : '';
            const deformer = normalizeClipDeformer(target?.deformer);
            return internalLayerId && deformer ? { internalLayerId, deformer } : null;
        })
        .filter(Boolean)
        .sort(compareTargets);
    return targets.length > 0
        ? { version: CLIP_LAYER_DEFORMERS_VERSION, targets }
        : null;
}

export function serializeClipLayerDeformers(value) {
    return normalizeClipLayerDeformers(value);
}

export function validateClipLayerDeformers(value, internalLayers = [], duration = 1) {
    const errors = [];
    if (value !== null && value !== undefined) {
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
            errors.push({ code: 'layer-deformers-invalid' });
        } else {
            if (value.version !== CLIP_LAYER_DEFORMERS_VERSION) {
                errors.push({ code: 'layer-deformers-version', version: value.version });
            }
            if (!Array.isArray(value.targets)) {
                errors.push({ code: 'layer-deformer-targets-invalid' });
            }
        }
    }

    const drawableLayerIds = new Set((Array.isArray(internalLayers) ? internalLayers : [])
        .filter(layer => layer?.type === 'raster' && layer?.isBackground !== true)
        .map(layer => layer?.id)
        .filter(Boolean));
    const normalizedDuration = Math.max(1, Number.isInteger(duration) ? duration : 1);
    const seen = new Set();

    getTargets(value).forEach((target, targetIndex) => {
        const path = `layerDeformers.targets[${targetIndex}]`;
        if (!target || typeof target !== 'object' || Array.isArray(target)) {
            errors.push({ code: 'layer-deformer-target-invalid', path });
            return;
        }
        const internalLayerId = target.internalLayerId;
        if (typeof internalLayerId !== 'string' || internalLayerId.length === 0) {
            errors.push({ code: 'layer-deformer-id-invalid', path: `${path}.internalLayerId` });
        } else if (seen.has(internalLayerId)) {
            errors.push({ code: 'layer-deformer-duplicate', path: `${path}.internalLayerId`, internalLayerId });
        } else if (!drawableLayerIds.has(internalLayerId)) {
            errors.push({ code: 'layer-deformer-target-missing', path: `${path}.internalLayerId`, internalLayerId });
        }
        if (typeof internalLayerId === 'string') seen.add(internalLayerId);

        if (!normalizeClipDeformer(target.deformer)) {
            errors.push({ code: 'layer-deformer-invalid', path: `${path}.deformer`, internalLayerId });
            return;
        }
        if (target.deformer?.keyframes !== undefined && !Array.isArray(target.deformer.keyframes)) {
            errors.push({ code: 'layer-deformer-keyframes-invalid', path: `${path}.deformer.keyframes`, internalLayerId });
            return;
        }
        (target.deformer?.keyframes || []).forEach((key, keyIndex) => {
            const keyPath = `${path}.deformer.keyframes[${keyIndex}]`;
            if (!key || typeof key !== 'object' || Array.isArray(key)) {
                errors.push({ code: 'layer-deformer-key-invalid', path: keyPath, internalLayerId });
                return;
            }
            if (!Number.isInteger(key.frame) || key.frame < 0 || key.frame >= normalizedDuration) {
                errors.push({ code: 'layer-deformer-key-out-of-range', path: `${keyPath}.frame`, internalLayerId });
            }
        });
    });

    return {
        ok: errors.length === 0,
        value: normalizeClipLayerDeformers(value),
        errors
    };
}

export function getClipLayerDeformer(value, internalLayerId) {
    if (!internalLayerId) return null;
    return normalizeClipLayerDeformers(value)?.targets
        .find(target => target.internalLayerId === internalLayerId)?.deformer || null;
}

export function setClipLayerDeformerTarget(value, internalLayerId, deformer) {
    const current = normalizeClipLayerDeformers(value);
    if (typeof internalLayerId !== 'string' || internalLayerId.length === 0) return current;
    const targets = (current?.targets || [])
        .filter(target => target.internalLayerId !== internalLayerId)
        .map(target => ({
            internalLayerId: target.internalLayerId,
            deformer: normalizeClipDeformer(target.deformer)
        }))
        .filter(target => target.deformer);
    if (deformer !== null && deformer !== undefined) {
        const normalized = normalizeClipDeformer(deformer);
        if (!normalized) return current;
        targets.push({ internalLayerId, deformer: normalized });
    }
    targets.sort(compareTargets);
    return targets.length > 0
        ? { version: CLIP_LAYER_DEFORMERS_VERSION, targets }
        : null;
}

export function removeClipLayerDeformerTarget(value, internalLayerId) {
    return setClipLayerDeformerTarget(value, internalLayerId, null);
}

export function removeClipLayerDeformerTargets(value, internalLayerIds = []) {
    const removed = new Set(internalLayerIds || []);
    const targets = (normalizeClipLayerDeformers(value)?.targets || [])
        .filter(target => !removed.has(target.internalLayerId));
    return normalizeClipLayerDeformers({
        version: CLIP_LAYER_DEFORMERS_VERSION,
        targets
    });
}

export function sampleClipLayerDeformers(value, localFrame, duration = 1) {
    const result = new Map();
    (normalizeClipLayerDeformers(value)?.targets || []).forEach(target => {
        const sampled = sampleClipDeformer(target.deformer, localFrame, duration);
        if (sampled) result.set(target.internalLayerId, sampled);
    });
    return result;
}

export function remapClipLayerDeformers(value, internalLayerIdMap) {
    const normalized = normalizeClipLayerDeformers(value);
    if (!normalized) return null;
    return normalizeClipLayerDeformers({
        version: CLIP_LAYER_DEFORMERS_VERSION,
        targets: normalized.targets.map(target => ({
            internalLayerId: remapId(target.internalLayerId, internalLayerIdMap),
            deformer: target.deformer
        }))
    });
}

export function retimeClipLayerDeformers(value, oldDuration, newDuration) {
    const normalized = normalizeClipLayerDeformers(value);
    if (!normalized) return null;
    const sourceDuration = Math.max(1, Number.isInteger(oldDuration) ? oldDuration : 1);
    const targetDuration = Math.max(1, Number.isInteger(newDuration) ? newDuration : 1);
    return normalizeClipLayerDeformers({
        version: CLIP_LAYER_DEFORMERS_VERSION,
        targets: normalized.targets.map(target => ({
            internalLayerId: target.internalLayerId,
            deformer: normalizeClipDeformer({
                ...target.deformer,
                keyframes: retimeTerminalKeyframes(
                    target.deformer.keyframes,
                    sourceDuration,
                    targetDuration
                )
            })
        }))
    });
}

export function sampleClipLayerDeformersForBake(value, localFrame, duration = 1) {
    const targets = [...sampleClipLayerDeformers(value, localFrame, duration).entries()]
        .map(([internalLayerId, sampled]) => ({
            internalLayerId,
            deformer: freezeSampledDeformer(sampled)
        }))
        .filter(target => target.deformer);
    return normalizeClipLayerDeformers({
        version: CLIP_LAYER_DEFORMERS_VERSION,
        targets
    });
}
