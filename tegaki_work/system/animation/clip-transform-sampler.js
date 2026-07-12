/**
 * ClipInstance.transform / transformKeyframes の純粋な Frame sampling 契約。
 * keyframe.frame は Clip-local の 0-based Frame。rotation は radian。
 */

const ANIMATED_PARAMETERS = ['x', 'y', 'scaleX', 'scaleY', 'rotation'];
const TAU = Math.PI * 2;

function finiteOr(value, fallback) {
    return Number.isFinite(value) ? value : fallback;
}

function normalizeBaseTransform(transform = {}) {
    return {
        x: finiteOr(transform.x, 0),
        y: finiteOr(transform.y, 0),
        scaleX: finiteOr(transform.scaleX, 1),
        scaleY: finiteOr(transform.scaleY, 1),
        rotation: finiteOr(transform.rotation, 0),
        anchorX: finiteOr(transform.anchorX, 0.5),
        anchorY: finiteOr(transform.anchorY, 0.5)
    };
}

function shortestAngleDelta(from, to) {
    let delta = (to - from) % TAU;
    if (delta > Math.PI) delta -= TAU;
    if (delta < -Math.PI) delta += TAU;
    return delta;
}

/**
 * Schema: { frame, interpolation?: 'hold'|'linear', x?, y?, scaleX?, scaleY?, rotation? }.
 * 範囲外keyは無視し、同一Frameは配列末尾を優先する。欠損parameterは直前状態を継承する。
 */
export function sampleClipTransform(clip, timelineFrame) {
    const base = normalizeBaseTransform(clip?.transform);
    const duration = Math.max(1, Number.isInteger(clip?.duration) ? clip.duration : 1);
    const localFrame = timelineFrame - (Number.isInteger(clip?.startFrame) ? clip.startFrame : 0);
    const byFrame = new Map();

    (Array.isArray(clip?.transformKeyframes) ? clip.transformKeyframes : []).forEach(key => {
        if (!key || !Number.isInteger(key.frame) || key.frame < 0 || key.frame >= duration) return;
        byFrame.set(key.frame, key);
    });
    const keys = [...byFrame.values()].sort((a, b) => a.frame - b.frame);
    if (keys.length === 0 || localFrame < keys[0].frame) return base;

    let state = { ...base };
    let leftState = { ...base };
    for (let index = 0; index < keys.length; index++) {
        const left = keys[index];
        ANIMATED_PARAMETERS.forEach(parameter => {
            if (Number.isFinite(left[parameter])) state[parameter] = left[parameter];
        });
        leftState = { ...state };
        const right = keys[index + 1];
        if (!right || localFrame < right.frame) {
            if (!right || left.interpolation === 'hold') return leftState;
            const rightState = { ...leftState };
            ANIMATED_PARAMETERS.forEach(parameter => {
                if (Number.isFinite(right[parameter])) rightState[parameter] = right[parameter];
            });
            const ratio = (localFrame - left.frame) / (right.frame - left.frame);
            const sampled = { ...leftState };
            ANIMATED_PARAMETERS.forEach(parameter => {
                const delta = parameter === 'rotation'
                    ? shortestAngleDelta(leftState[parameter], rightState[parameter])
                    : rightState[parameter] - leftState[parameter];
                sampled[parameter] = leftState[parameter] + delta * ratio;
            });
            return sampled;
        }
    }
    return leftState;
}
