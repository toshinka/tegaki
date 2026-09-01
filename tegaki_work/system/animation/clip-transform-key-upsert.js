/**
 * ClipInstance.transformKeyframesへfull composite keyを追加・置換するpure planner。
 *
 * 現行CLIP MOTIONと将来Layer Transform bridgeが同じkey shape、同一Frame末尾優先、
 * interpolation / easing継承を共有するための一正本。Model / History / previewは変更しない。
 */

const REQUIRED_FINITE_PARAMETERS = Object.freeze([
    'x',
    'y',
    'scaleX',
    'scaleY',
    'rotation',
    'opacity',
    'blendStrength'
]);

function cloneKeyframe(keyframe) {
    return {
        ...keyframe,
        ...(keyframe?.easing ? { easing: { ...keyframe.easing } } : {})
    };
}

function areKeyframeListsEquivalent(left, right) {
    return JSON.stringify(left) === JSON.stringify(right);
}

export function planClipTransformKeyUpsert({
    keyframes = [],
    frame,
    duration,
    transform
} = {}) {
    if (!Number.isInteger(duration) || duration <= 1) {
        return { ok: false, changed: false, reason: 'animated-duration-required' };
    }
    if (!Number.isInteger(frame) || frame < 0 || frame >= duration) {
        return { ok: false, changed: false, reason: 'frame-outside-clip' };
    }
    if (!transform || REQUIRED_FINITE_PARAMETERS.some(name => !Number.isFinite(transform[name]))) {
        return { ok: false, changed: false, reason: 'complete-transform-required' };
    }

    const source = Array.isArray(keyframes) ? keyframes.map(cloneKeyframe) : [];
    const previousIndex = source.findLastIndex(key => key?.frame === frame);
    const previous = previousIndex >= 0 ? source[previousIndex] : {};
    const key = {
        frame,
        interpolation: previous.interpolation === 'hold' ? 'hold' : 'linear',
        ...(previous.easing ? { easing: { ...previous.easing } } : {}),
        x: transform.x,
        y: transform.y,
        scaleX: transform.scaleX,
        scaleY: transform.scaleY,
        opacity: transform.opacity,
        blendMode: transform.blendMode,
        blendStrength: transform.blendStrength,
        rotation: transform.rotation
    };
    const next = source.filter(item => item?.frame !== frame);
    next.push(key);
    next.sort((left, right) => left.frame - right.frame);

    return {
        ok: true,
        changed: !areKeyframeListsEquivalent(source, next),
        keyframes: next,
        key,
        replaced: previousIndex >= 0
    };
}
