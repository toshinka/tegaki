import {
    sampleClipDeformer,
    normalizeClipDeformer,
    sampleClipFolderDeformers,
    normalizeClipFolderDeformers
} from './clip-deformer.js';
import { sampleClipTransform } from './clip-transform-sampler.js';
import { sampleRigMotionForBake } from './part-rig.js';

function clonePoints(points) {
    return Array.isArray(points) ? points.map(point => ({ x: point.x, y: point.y })) : [];
}

function clonePlacement(placement) {
    return placement && typeof placement === 'object' ? { ...placement } : undefined;
}

function freezeSampledDeformer(sampledDeformer) {
    if (!sampledDeformer) return null;
    const points = clonePoints(sampledDeformer.points);
    const placement = clonePlacement(sampledDeformer.placement);
    return normalizeClipDeformer({
        ...sampledDeformer,
        points,
        keyframes: [{
            frame: 0,
            interpolation: 'hold',
            points: clonePoints(points),
            ...(placement ? { placement } : {})
        }]
    });
}

/**
 * 既存のClipInstance正本をtimelineFrameで評価し、1 Frame Clipへ格納できる
 * 静的なtransform / deformerへ畳み込む。Bake専用の運動schemaは作らない。
 *
 * placementはdeformer top-levelの保存項目ではないため、既存keyframe schemaの
 * Frame 0 keyを1個だけ持たせる。これによりLENS移動も通常のsamplerで再現できる。
 */
export function sampleClipBakeState(clip, timelineFrame) {
    if (!clip || typeof clip !== 'object') return null;

    const startFrame = Number.isInteger(clip.startFrame) ? clip.startFrame : 0;
    const duration = Math.max(1, Number.isInteger(clip.duration) ? clip.duration : 1);
    const localFrame = Number.isFinite(timelineFrame) ? timelineFrame - startFrame : 0;
    const transform = sampleClipTransform(clip, Number.isFinite(timelineFrame) ? timelineFrame : startFrame);
    const sampledDeformer = sampleClipDeformer(clip.deformer, localFrame, duration);
    const rigMotion = sampleRigMotionForBake(clip, Number.isFinite(timelineFrame) ? timelineFrame : startFrame);

    const deformer = freezeSampledDeformer(sampledDeformer);
    const sampledFolderDeformers = sampleClipFolderDeformers(
        clip.folderDeformers,
        localFrame,
        duration
    );
    const folderTargets = [...sampledFolderDeformers.entries()]
        .map(([folderLayerId, sampled]) => ({
            folderLayerId,
            deformer: freezeSampledDeformer(sampled)
        }))
        .filter(target => target.deformer);
    const folderDeformers = normalizeClipFolderDeformers({
        version: 1,
        targets: folderTargets
    });

    return {
        transform: { ...transform },
        transformKeyframes: [],
        deformer,
        ...(folderDeformers ? { folderDeformers } : {}),
        ...(rigMotion ? { rigMotion } : {})
    };
}
