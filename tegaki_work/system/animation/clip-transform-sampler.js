/**
 * ClipInstance.transform / transformKeyframes の純粋な Frame sampling 契約。
 * keyframe.frame は Clip-local の 0-based Frame。rotation は radian。
 */

import {
    sampleEasingRatio,
    sampleRawEasingRatio
} from './cubic-bezier-easing.js';

export const MOTION_ANIMATED_PARAMETERS = Object.freeze([
    'x',
    'y',
    'scaleX',
    'scaleY',
    'rotation',
    'opacity',
    'blendStrength'
]);
const CLIP_BLEND_MODES = new Set(['normal', 'add', 'subtract', 'multiply', 'overlay']);

function finiteOr(value, fallback) {
    return Number.isFinite(value) ? value : fallback;
}

function clampOpacity(value, fallback = 1) {
    return Math.max(0, Math.min(1, finiteOr(value, fallback)));
}

function normalizeAnimatedValue(parameter, value, fallback) {
    return parameter === 'opacity' || parameter === 'blendStrength'
        ? clampOpacity(value, fallback)
        : finiteOr(value, fallback);
}

function normalizeBlendMode(value, fallback = 'normal') {
    return CLIP_BLEND_MODES.has(value) ? value : fallback;
}

function normalizeBaseTransform(transform = {}) {
    return {
        x: finiteOr(transform.x, 0),
        y: finiteOr(transform.y, 0),
        scaleX: finiteOr(transform.scaleX, 1),
        scaleY: finiteOr(transform.scaleY, 1),
        rotation: finiteOr(transform.rotation, 0),
        opacity: clampOpacity(transform.opacity, 1),
        blendMode: normalizeBlendMode(transform.blendMode),
        blendStrength: clampOpacity(transform.blendStrength, 1),
        anchorX: finiteOr(transform.anchorX, 0.5),
        anchorY: finiteOr(transform.anchorY, 0.5)
    };
}

/**
 * Schema: { frame, interpolation?: 'hold'|'linear', easing?: { type: 'cubic-bezier', x1, y1, x2, y2 }, x?, y?, scaleX?, scaleY?, rotation?, opacity?, blendMode?, blendStrength? }.
 * 範囲外keyは無視し、同一Frameは配列末尾を優先する。欠損parameterは直前状態を継承する。
 * blendModeは連続補間せず、次のkeyまで左keyの値を維持する。blendStrengthは0..1で補間する。
 * easingは左keyが次区間を所有し、hold区間では参照しない。欠損・不正値はlinearとする。
 */
export function sampleTransformTrack(baseTransform, keyframes, localFrame, duration = 1, options = {}) {
    const base = normalizeBaseTransform(baseTransform);
    const normalizedDuration = Math.max(1, Number.isInteger(duration) ? duration : 1);
    const byFrame = new Map();

    (Array.isArray(keyframes) ? keyframes : []).forEach(key => {
        if (!key || !Number.isInteger(key.frame) || key.frame < 0 || key.frame >= normalizedDuration) return;
        byFrame.set(key.frame, key);
    });
    // Clipの静的transformを暗黙の始点/終点とする。
    // 中間keyだけ置いた場合は終点へ向けて静的状態へ戻る。
    if (!byFrame.has(0)) byFrame.set(0, { frame: 0, ...base, interpolation: 'linear' });
    if (normalizedDuration > 1 && !byFrame.has(normalizedDuration - 1)) {
        byFrame.set(normalizedDuration - 1, {
            frame: normalizedDuration - 1,
            ...base,
            interpolation: 'linear'
        });
    }
    const keys = [...byFrame.values()].sort((a, b) => a.frame - b.frame);
    if (keys.length === 0 || localFrame < keys[0].frame) return base;

    let state = { ...base };
    let leftState = { ...base };
    for (let index = 0; index < keys.length; index++) {
        const left = keys[index];
        MOTION_ANIMATED_PARAMETERS.forEach(parameter => {
            if (Number.isFinite(left[parameter])) {
                state[parameter] = normalizeAnimatedValue(parameter, left[parameter], state[parameter]);
            }
        });
        state.blendMode = normalizeBlendMode(left.blendMode, state.blendMode);
        leftState = { ...state };
        const right = keys[index + 1];
        if (!right || localFrame < right.frame) {
            if (!right || left.interpolation === 'hold') return leftState;
            const rightState = { ...leftState };
            MOTION_ANIMATED_PARAMETERS.forEach(parameter => {
                if (Number.isFinite(right[parameter])) {
                    rightState[parameter] = normalizeAnimatedValue(
                        parameter,
                        right[parameter],
                        rightState[parameter]
                    );
                }
            });
            const linearRatio = (localFrame - left.frame) / (right.frame - left.frame);
            const ratio = options.allowOvershoot === true
                ? sampleRawEasingRatio(linearRatio, left.easing)
                : sampleEasingRatio(linearRatio, left.easing);
            const sampled = { ...leftState };
            MOTION_ANIMATED_PARAMETERS.forEach(parameter => {
                const delta = rightState[parameter] - leftState[parameter];
                sampled[parameter] = normalizeAnimatedValue(
                    parameter,
                    leftState[parameter] + delta * ratio,
                    leftState[parameter]
                );
            });
            return sampled;
        }
    }
    return leftState;
}

export function sampleClipTransform(clip, timelineFrame) {
    const duration = Math.max(1, Number.isInteger(clip?.duration) ? clip.duration : 1);
    const localFrame = timelineFrame - (Number.isInteger(clip?.startFrame) ? clip.startFrame : 0);
    return sampleTransformTrack(
        clip?.transform,
        clip?.transformKeyframes,
        localFrame,
        duration,
        { allowOvershoot: true }
    );
}
