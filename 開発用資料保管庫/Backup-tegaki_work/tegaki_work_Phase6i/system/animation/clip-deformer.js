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
