export const CLIPPING_MODES = Object.freeze({
    NONE: 'none',
    NORMAL: 'normal',
    INVERSE: 'inverse'
});

const VALID_CLIPPING_MODES = new Set(Object.values(CLIPPING_MODES));

export function normalizeClippingMode(mode, legacyClipping = false) {
    if (VALID_CLIPPING_MODES.has(mode)) return mode;
    return legacyClipping === true ? CLIPPING_MODES.NORMAL : CLIPPING_MODES.NONE;
}

export function getClippingMode(target) {
    if (!target) return CLIPPING_MODES.NONE;
    if (target.clippingMode === CLIPPING_MODES.NORMAL
        || target.clippingMode === CLIPPING_MODES.INVERSE) {
        return target.clippingMode;
    }
    return target.clipping === true ? CLIPPING_MODES.NORMAL : CLIPPING_MODES.NONE;
}

export function applyClippingMode(target, mode) {
    if (!target) return CLIPPING_MODES.NONE;
    const normalized = normalizeClippingMode(mode);
    target.clippingMode = normalized;
    target.clipping = normalized !== CLIPPING_MODES.NONE;
    return normalized;
}

export function cycleClippingMode(mode, legacyClipping = false) {
    switch (normalizeClippingMode(mode, legacyClipping)) {
        case CLIPPING_MODES.NORMAL:
            return CLIPPING_MODES.INVERSE;
        case CLIPPING_MODES.INVERSE:
            return CLIPPING_MODES.NONE;
        default:
            return CLIPPING_MODES.NORMAL;
    }
}

export function isClippingEnabled(target) {
    return getClippingMode(target) !== CLIPPING_MODES.NONE;
}

export function isInverseClipping(target) {
    return getClippingMode(target) === CLIPPING_MODES.INVERSE;
}

export function applyClippingAlpha(targetAlpha, maskAlpha, mode) {
    const target = Math.max(0, Math.min(255, Number(targetAlpha) || 0));
    const mask = Math.max(0, Math.min(255, Number(maskAlpha) || 0));
    const normalized = normalizeClippingMode(mode);
    if (normalized === CLIPPING_MODES.NONE) return Math.round(target);
    const maskRatio = normalized === CLIPPING_MODES.INVERSE
        ? (255 - mask) / 255
        : mask / 255;
    return Math.round(target * maskRatio);
}
