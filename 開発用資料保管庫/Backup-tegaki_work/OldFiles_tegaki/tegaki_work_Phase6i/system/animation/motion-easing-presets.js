import { normalizeCubicBezierEasing } from './cubic-bezier-easing.js';

const PRESETS = Object.freeze({
    'ease-in': Object.freeze({ type: 'cubic-bezier', x1: 0.42, y1: 0, x2: 1, y2: 1 }),
    'ease-out': Object.freeze({ type: 'cubic-bezier', x1: 0, y1: 0, x2: 0.58, y2: 1 }),
    'ease-in-out': Object.freeze({ type: 'cubic-bezier', x1: 0.42, y1: 0, x2: 0.58, y2: 1 })
});

function curvesEqual(left, right) {
    return ['x1', 'y1', 'x2', 'y2'].every(name => Math.abs(left[name] - right[name]) < 1e-9);
}

export function resolveMotionEasingPreset(value, currentEasing = null) {
    if (value === 'hold') return { interpolation: 'hold' };
    if (value === 'linear') return { interpolation: 'linear' };
    if (PRESETS[value]) return { interpolation: 'linear', easing: { ...PRESETS[value] } };
    const easing = normalizeCubicBezierEasing(currentEasing);
    return easing
        ? { interpolation: 'linear', easing }
        : { interpolation: 'linear' };
}

export function identifyMotionEasingPreset(key) {
    if (key?.interpolation === 'hold') return 'hold';
    const easing = normalizeCubicBezierEasing(key?.easing);
    if (!easing) return 'linear';
    const preset = Object.entries(PRESETS).find(([, curve]) => curvesEqual(easing, curve));
    return preset?.[0] || 'custom';
}
