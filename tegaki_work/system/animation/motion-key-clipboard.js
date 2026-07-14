/**
 * Motion key 1件のruntime clipboard payload生成と、貼付先Frameへの純粋な置換を提供する。
 * source Clip / Frameはpayloadへ含めず、Project保存正本も持たない。
 */

const MOTION_KEY_CLIPBOARD_KIND = 'tegaki-motion-key';

function normalizeEasing(source) {
    const easing = source?.easing;
    if (easing?.type !== 'cubic-bezier') return null;
    const values = ['x1', 'y1', 'x2', 'y2'].map(name => Number(easing[name]));
    if (!values.every(Number.isFinite)) return null;
    const [x1, y1, x2, y2] = values.map(value => Math.max(0, Math.min(1, value)));
    return { type: 'cubic-bezier', x1, y1, x2, y2 };
}

function normalizeMotionKeyValues(source) {
    const values = source?.values || source;
    const normalized = {
        x: Number(values?.x),
        y: Number(values?.y),
        scaleX: Number(values?.scaleX),
        scaleY: Number(values?.scaleY),
        rotation: Number(values?.rotation)
    };
    return Object.values(normalized).every(Number.isFinite) ? normalized : null;
}

function normalizeOpacity(source) {
    const value = Number(source?.values?.opacity ?? source?.opacity);
    return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : null;
}

function normalizeBlendMode(source) {
    const value = source?.values?.blendMode ?? source?.blendMode;
    return new Set(['normal', 'add', 'subtract', 'multiply', 'overlay']).has(value) ? value : null;
}

function normalizeBlendStrength(source) {
    const value = Number(source?.values?.blendStrength ?? source?.blendStrength);
    return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : null;
}

export function createMotionKeyClipboardPayload(key) {
    const values = normalizeMotionKeyValues(key);
    if (!values) return null;
    const opacity = normalizeOpacity(key);
    const blendMode = normalizeBlendMode(key);
    const blendStrength = normalizeBlendStrength(key);
    const easing = normalizeEasing(key);
    return {
        kind: MOTION_KEY_CLIPBOARD_KIND,
        version: 5,
        values: {
            ...values,
            ...(opacity === null ? {} : { opacity }),
            ...(blendMode === null ? {} : { blendMode }),
            ...(blendStrength === null ? {} : { blendStrength })
        },
        interpolation: key?.interpolation === 'hold' ? 'hold' : 'linear',
        ...(easing ? { easing } : {})
    };
}

export function applyMotionKeyClipboardPayload(keyframes, frame, payload) {
    const localFrame = Number(frame);
    const values = normalizeMotionKeyValues(payload);
    if (!Number.isInteger(localFrame) || localFrame < 0) return null;
    if (
        payload?.kind !== MOTION_KEY_CLIPBOARD_KIND
        || ![1, 2, 3, 4, 5].includes(payload?.version)
        || !values
    ) return null;

    const existing = (Array.isArray(keyframes) ? keyframes : [])
        .findLast(key => key?.frame === localFrame);
    const payloadOpacity = payload.version >= 2 ? normalizeOpacity(payload) : null;
    const payloadBlendMode = payload.version >= 3 ? normalizeBlendMode(payload) : null;
    const payloadBlendStrength = payload.version >= 4 ? normalizeBlendStrength(payload) : null;
    const payloadEasing = payload.version >= 5 ? normalizeEasing(payload) : null;
    const preservedEasing = normalizeEasing(existing);
    const preservedOpacity = Number.isFinite(existing?.opacity)
        ? Math.max(0, Math.min(1, existing.opacity))
        : null;
    const preservedBlendMode = normalizeBlendMode(existing);
    const preservedBlendStrength = normalizeBlendStrength(existing);

    const next = (Array.isArray(keyframes) ? keyframes : [])
        .filter(key => key?.frame !== localFrame)
        .map(key => ({ ...key }));
    next.push({
        frame: localFrame,
        interpolation: payload.interpolation === 'hold' ? 'hold' : 'linear',
        ...(payloadEasing
            ? { easing: payloadEasing }
            : (payload.version < 5 && preservedEasing ? { easing: preservedEasing } : {})),
        ...values,
        ...(payloadOpacity !== null
            ? { opacity: payloadOpacity }
            : (preservedOpacity !== null ? { opacity: preservedOpacity } : {})),
        ...(payloadBlendMode !== null
            ? { blendMode: payloadBlendMode }
            : (preservedBlendMode !== null ? { blendMode: preservedBlendMode } : {})),
        ...(payloadBlendStrength !== null
            ? { blendStrength: payloadBlendStrength }
            : (preservedBlendStrength !== null ? { blendStrength: preservedBlendStrength } : {}))
    });
    next.sort((a, b) => Number(a?.frame ?? 0) - Number(b?.frame ?? 0));
    return next;
}
