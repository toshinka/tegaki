/**
 * ClipInstance.transform / transformKeyframes の純粋な Frame sampling 契約。
 * keyframe.frame は Clip-local の 0-based Frame。rotation は radian。
 */

import { sampleEasingRatio } from './cubic-bezier-easing.js';

const ANIMATED_PARAMETERS = ['x', 'y', 'scaleX', 'scaleY', 'rotation', 'opacity', 'blendStrength'];
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
export function sampleClipTransform(clip, timelineFrame) {
    const base = normalizeBaseTransform(clip?.transform);
    const duration = Math.max(1, Number.isInteger(clip?.duration) ? clip.duration : 1);
    const localFrame = timelineFrame - (Number.isInteger(clip?.startFrame) ? clip.startFrame : 0);
    const byFrame = new Map();

    (Array.isArray(clip?.transformKeyframes) ? clip.transformKeyframes : []).forEach(key => {
        if (!key || !Number.isInteger(key.frame) || key.frame < 0 || key.frame >= duration) return;
        byFrame.set(key.frame, key);
    });
    // Clipの静的transformを暗黙の始点/終点とする。
    // 中間keyだけ置いた場合は終点へ向けて静的状態へ戻る。
    if (!byFrame.has(0)) byFrame.set(0, { frame: 0, ...base, interpolation: 'linear' });
    if (duration > 1 && !byFrame.has(duration - 1)) {
        byFrame.set(duration - 1, { frame: duration - 1, ...base, interpolation: 'linear' });
    }
    const keys = [...byFrame.values()].sort((a, b) => a.frame - b.frame);
    if (keys.length === 0 || localFrame < keys[0].frame) return base;

    let state = { ...base };
    let leftState = { ...base };
    for (let index = 0; index < keys.length; index++) {
        const left = keys[index];
        ANIMATED_PARAMETERS.forEach(parameter => {
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
            ANIMATED_PARAMETERS.forEach(parameter => {
                if (Number.isFinite(right[parameter])) {
                    rightState[parameter] = normalizeAnimatedValue(
                        parameter,
                        right[parameter],
                        rightState[parameter]
                    );
                }
            });
            const linearRatio = (localFrame - left.frame) / (right.frame - left.frame);
            const ratio = sampleEasingRatio(linearRatio, left.easing);
            const sampled = { ...leftState };
            ANIMATED_PARAMETERS.forEach(parameter => {
                const delta = rightState[parameter] - leftState[parameter];
                sampled[parameter] = leftState[parameter] + delta * ratio;
            });
            return sampled;
        }
    }
    return leftState;
}
