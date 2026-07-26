import { sampleClipDeformer, normalizeClipDeformer } from './clip-deformer.js';
import { sampleClipTransform } from './clip-transform-sampler.js';

function clonePoints(points) {
    return Array.isArray(points) ? points.map(point => ({ x: point.x, y: point.y })) : [];
}

function clonePlacement(placement) {
    return placement && typeof placement === 'object' ? { ...placement } : undefined;
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

    let deformer = null;
    if (sampledDeformer) {
        const points = clonePoints(sampledDeformer.points);
        const placement = clonePlacement(sampledDeformer.placement);
        deformer = normalizeClipDeformer({
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

    return {
        transform: { ...transform },
        transformKeyframes: [],
        deformer
    };
}
