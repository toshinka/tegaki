import { normalizeCubicBezierEasing } from './cubic-bezier-easing.js';

const MOTION_EASING_CLIPBOARD_KIND = 'tegaki-motion-easing';

function normalizeMotionEasing(source) {
    if (source?.interpolation === 'hold') return { interpolation: 'hold' };
    const easing = normalizeCubicBezierEasing(source?.easing);
    return easing
        ? { interpolation: 'linear', easing }
        : { interpolation: 'linear' };
}

function easingFieldsEqual(key, resolved) {
    if (key?.interpolation !== resolved.interpolation) return false;
    const current = normalizeCubicBezierEasing(key?.easing);
    const next = normalizeCubicBezierEasing(resolved.easing);
    if (!current || !next) return current === next;
    return ['x1', 'y1', 'x2', 'y2'].every(name => Math.abs(current[name] - next[name]) < 1e-9);
}

export function createMotionEasingClipboardPayload(key) {
    if (!key || typeof key !== 'object') return null;
    return {
        kind: MOTION_EASING_CLIPBOARD_KIND,
        version: 1,
        ...normalizeMotionEasing(key)
    };
}

export function applyMotionEasingClipboardPayload({
    keyframes,
    frames,
    payload,
    duration
} = {}) {
    const source = Array.isArray(keyframes) ? keyframes : [];
    const targetFrames = Array.from(new Set((Array.isArray(frames) ? frames : [])
        .map(Number)
        .filter(Number.isInteger)));
    const clipDuration = Math.max(1, Math.floor(Number(duration) || 1));

    if (payload?.kind !== MOTION_EASING_CLIPBOARD_KIND || payload?.version !== 1) {
        return { ok: false, reason: 'invalid-clipboard', keyframes: source };
    }
    if (targetFrames.length === 0) return { ok: false, reason: 'no-target-keys', keyframes: source };
    if (targetFrames.some(frame => frame < 0 || frame >= clipDuration - 1)) {
        return { ok: false, reason: 'terminal-key', keyframes: source };
    }
    if (targetFrames.some(frame => !source.some(key => key?.frame === frame))) {
        return { ok: false, reason: 'key-not-found', keyframes: source };
    }

    const resolved = normalizeMotionEasing(payload);
    const targetSet = new Set(targetFrames);
    let changed = false;
    const next = source.map(key => {
        if (!targetSet.has(key?.frame)) return key;
        const { interpolation: _interpolation, easing: _easing, ...rest } = key;
        if (!easingFieldsEqual(key, resolved)) changed = true;
        return { ...rest, ...resolved };
    });
    return { ok: true, changed, keyframes: next, frames: targetFrames };
}
