import { normalizeCubicBezierEasing } from './cubic-bezier-easing.js';

const PRESETS = Object.freeze({
    'ease-in': Object.freeze({ type: 'cubic-bezier', x1: 0.42, y1: 0, x2: 1, y2: 1 }),
    'ease-out': Object.freeze({ type: 'cubic-bezier', x1: 0, y1: 0, x2: 0.58, y2: 1 }),
    'ease-in-out': Object.freeze({ type: 'cubic-bezier', x1: 0.42, y1: 0, x2: 0.58, y2: 1 }),
    'strong-in': Object.freeze({ type: 'cubic-bezier', x1: 0.64, y1: 0, x2: 0.78, y2: 0 }),
    'strong-out': Object.freeze({ type: 'cubic-bezier', x1: 0.22, y1: 1, x2: 0.36, y2: 1 }),
    'strong-in-out': Object.freeze({ type: 'cubic-bezier', x1: 0.83, y1: 0, x2: 0.17, y2: 1 }),
    'sine-in': Object.freeze({ type: 'cubic-bezier', x1: 0.12, y1: 0, x2: 0.39, y2: 0 }),
    'sine-out': Object.freeze({ type: 'cubic-bezier', x1: 0.61, y1: 1, x2: 0.88, y2: 1 }),
    'sine-in-out': Object.freeze({ type: 'cubic-bezier', x1: 0.37, y1: 0, x2: 0.63, y2: 1 }),
    'circular-in': Object.freeze({ type: 'cubic-bezier', x1: 0.55, y1: 0, x2: 1, y2: 0.45 }),
    'circular-out': Object.freeze({ type: 'cubic-bezier', x1: 0, y1: 0.55, x2: 0.45, y2: 1 }),
    'circular-in-out': Object.freeze({ type: 'cubic-bezier', x1: 0.85, y1: 0, x2: 0.15, y2: 1 }),
    'back-in': Object.freeze({ type: 'cubic-bezier', x1: 0.36, y1: 0, x2: 0.66, y2: -0.56 }),
    'back-out': Object.freeze({ type: 'cubic-bezier', x1: 0.34, y1: 1.56, x2: 0.64, y2: 1 }),
    'back-in-out': Object.freeze({ type: 'cubic-bezier', x1: 0.68, y1: -0.6, x2: 0.32, y2: 1.6 })
});

function freezePresetGroup(label, entries) {
    return Object.freeze({
        label,
        entries: Object.freeze(entries.map(entry => Object.freeze({ ...entry })))
    });
}

export const MOTION_EASING_PRESET_GROUPS = Object.freeze([
    freezePresetGroup('SOFT EASE', [
        { value: 'ease-in', label: 'EASE IN' },
        { value: 'ease-out', label: 'EASE OUT' },
        { value: 'ease-in-out', label: 'EASE IN-OUT' }
    ]),
    freezePresetGroup('STRONG EASE', [
        { value: 'strong-in', label: 'STRONG IN' },
        { value: 'strong-out', label: 'STRONG OUT' },
        { value: 'strong-in-out', label: 'STRONG IN-OUT' }
    ]),
    freezePresetGroup('SINE', [
        { value: 'sine-in', label: 'SINE IN' },
        { value: 'sine-out', label: 'SINE OUT' },
        { value: 'sine-in-out', label: 'SINE IN-OUT' }
    ]),
    freezePresetGroup('CIRCULAR', [
        { value: 'circular-in', label: 'CIRCULAR IN' },
        { value: 'circular-out', label: 'CIRCULAR OUT' },
        { value: 'circular-in-out', label: 'CIRCULAR IN-OUT' }
    ]),
    freezePresetGroup('BACK', [
        { value: 'back-in', label: 'BACK IN' },
        { value: 'back-out', label: 'BACK OUT' },
        { value: 'back-in-out', label: 'BACK IN-OUT' }
    ])
]);

function curvesEqual(left, right) {
    return ['x1', 'y1', 'x2', 'y2'].every(name => Math.abs(left[name] - right[name]) < 1e-9);
}

function presetFieldsEqual(key, resolved) {
    if (key?.interpolation !== resolved.interpolation) return false;
    const currentEasing = normalizeCubicBezierEasing(key?.easing);
    const nextEasing = normalizeCubicBezierEasing(resolved.easing);
    if (!currentEasing || !nextEasing) return currentEasing === nextEasing;
    return curvesEqual(currentEasing, nextEasing);
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

export function applyMotionEasingPresetToKeyframes({
    keyframes,
    frames,
    preset,
    duration
} = {}) {
    const source = Array.isArray(keyframes) ? keyframes : [];
    const targetFrames = Array.from(new Set((Array.isArray(frames) ? frames : [])
        .map(Number)
        .filter(Number.isInteger)));
    const clipDuration = Math.max(1, Math.floor(Number(duration) || 1));
    const isKnownPreset = preset === 'linear' || preset === 'hold' || Object.hasOwn(PRESETS, preset);

    if (!isKnownPreset) return { ok: false, reason: 'invalid-preset', keyframes: source };
    if (targetFrames.length === 0) return { ok: false, reason: 'no-target-keys', keyframes: source };
    if (targetFrames.some(frame => frame < 0 || frame >= clipDuration - 1)) {
        return { ok: false, reason: 'terminal-key', keyframes: source };
    }
    if (targetFrames.some(frame => !source.some(key => key?.frame === frame))) {
        return { ok: false, reason: 'key-not-found', keyframes: source };
    }

    const targetSet = new Set(targetFrames);
    const resolved = resolveMotionEasingPreset(preset);
    let changed = false;
    const next = source.map(key => {
        if (!targetSet.has(key?.frame)) return key;
        const { interpolation: _interpolation, easing: _easing, ...rest } = key;
        const updated = { ...rest, ...resolved };
        if (!presetFieldsEqual(key, resolved)) changed = true;
        return updated;
    });
    return { ok: true, changed, keyframes: next, frames: targetFrames };
}
