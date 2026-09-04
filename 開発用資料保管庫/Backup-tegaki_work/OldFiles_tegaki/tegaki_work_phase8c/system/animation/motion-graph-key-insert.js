/**
 * Motion Graph途中点追加のpure plan。
 * 既存複合Motion keyを正本とし、挿入前の全parameter sampleを維持する。
 */

import { splitCubicBezierEasing } from './cubic-bezier-easing.js';
import {
    MOTION_ANIMATED_PARAMETERS,
    sampleTransformTrack
} from './clip-transform-sampler.js';

function cloneKey(key) {
    return {
        ...key,
        ...(key?.easing && typeof key.easing === 'object'
            ? { easing: { ...key.easing } }
            : {})
    };
}

function createMaterializedKey(frame, transform, metadata = {}) {
    const key = {
        frame,
        interpolation: metadata.interpolation === 'hold' ? 'hold' : 'linear'
    };
    if (metadata.easing) key.easing = { ...metadata.easing };
    MOTION_ANIMATED_PARAMETERS.forEach(parameter => {
        key[parameter] = transform[parameter];
    });
    key.blendMode = transform.blendMode;
    return key;
}

function resolveValidKeyframes(keyframes, duration) {
    if (!Array.isArray(keyframes)) return { ok: false, reason: 'keyframes-required' };
    const seen = new Set();
    const keys = [];
    for (const key of keyframes) {
        if (!key || !Number.isInteger(key.frame) || key.frame < 0 || key.frame >= duration) {
            return { ok: false, reason: 'keyframe-invalid' };
        }
        if (seen.has(key.frame)) return { ok: false, reason: 'keyframe-duplicate' };
        seen.add(key.frame);
        keys.push(cloneKey(key));
    }
    keys.sort((left, right) => left.frame - right.frame);
    return { ok: true, keys };
}

function interpolateTransform(left, right, ratio) {
    const transform = { blendMode: left.blendMode };
    MOTION_ANIMATED_PARAMETERS.forEach(parameter => {
        const value = left[parameter] + (right[parameter] - left[parameter]) * ratio;
        transform[parameter] = parameter === 'opacity' || parameter === 'blendStrength'
            ? Math.max(0, Math.min(1, value))
            : value;
    });
    return transform;
}

export function planMotionGraphKeyInsertion({
    baseTransform,
    keyframes,
    frame,
    duration,
    channel = null,
    storedValue = null
} = {}) {
    if (!Number.isInteger(duration) || duration < 3) {
        return { ok: false, reason: 'duration-too-short' };
    }
    if (!Number.isInteger(frame) || frame <= 0 || frame >= duration - 1) {
        return { ok: false, reason: 'frame-out-of-range' };
    }
    const resolved = resolveValidKeyframes(keyframes, duration);
    if (!resolved.ok) return resolved;
    if (resolved.keys.some(key => key.frame === frame)) {
        return { ok: false, reason: 'frame-occupied' };
    }
    if (channel !== null && !MOTION_ANIMATED_PARAMETERS.includes(channel)) {
        return { ok: false, reason: 'channel-invalid' };
    }
    if (channel !== null && !Number.isFinite(storedValue)) {
        return { ok: false, reason: 'value-invalid' };
    }

    const explicitLeft = [...resolved.keys].reverse().find(key => key.frame < frame) || null;
    const explicitRight = resolved.keys.find(key => key.frame > frame) || null;
    const leftFrame = explicitLeft?.frame ?? 0;
    const rightFrame = explicitRight?.frame ?? (duration - 1);
    if (leftFrame >= frame || rightFrame <= frame || leftFrame >= rightFrame) {
        return { ok: false, reason: 'segment-not-found' };
    }

    const sampleOptions = { allowOvershoot: true };
    const leftTransform = sampleTransformTrack(baseTransform, resolved.keys, leftFrame, duration, sampleOptions);
    const rightTransform = sampleTransformTrack(baseTransform, resolved.keys, rightFrame, duration, sampleOptions);
    const segmentRatio = (frame - leftFrame) / (rightFrame - leftFrame);
    const interpolation = explicitLeft?.interpolation === 'hold' ? 'hold' : 'linear';
    let insertedTransform = null;
    let leftEasing = explicitLeft?.easing ? { ...explicitLeft.easing } : null;
    let rightEasing = null;

    if (interpolation === 'hold') {
        insertedTransform = interpolateTransform(leftTransform, leftTransform, 0);
    } else if (explicitLeft?.easing?.type === 'cubic-bezier') {
        const split = splitCubicBezierEasing(segmentRatio, explicitLeft.easing);
        if (!split.ok) return split;
        if ((split.easedRatio < 0 || split.easedRatio > 1)
            && ['opacity', 'blendStrength'].some(parameter => (
                parameter !== channel
                && Math.abs(rightTransform[parameter] - leftTransform[parameter]) > 1e-12
            ))) {
            return { ok: false, reason: 'split-bounded-channel-clamp' };
        }
        insertedTransform = interpolateTransform(leftTransform, rightTransform, split.easedRatio);
        leftEasing = split.left;
        rightEasing = split.right;
    } else {
        insertedTransform = interpolateTransform(leftTransform, rightTransform, segmentRatio);
    }

    const output = resolved.keys.map(key => {
        if (!explicitLeft || key.frame !== explicitLeft.frame) return key;
        const next = { ...key, interpolation };
        if (leftEasing) next.easing = { ...leftEasing };
        else delete next.easing;
        return next;
    });
    const materializedBoundaryFrames = [];
    if (!explicitLeft) {
        output.push(createMaterializedKey(leftFrame, leftTransform, { interpolation, easing: leftEasing }));
        materializedBoundaryFrames.push(leftFrame);
    }
    if (!explicitRight) {
        output.push(createMaterializedKey(rightFrame, rightTransform, { interpolation: 'linear' }));
        materializedBoundaryFrames.push(rightFrame);
    }
    const insertedKey = createMaterializedKey(frame, insertedTransform, {
        interpolation,
        easing: rightEasing
    });
    if (channel !== null) insertedKey[channel] = storedValue;
    output.push(insertedKey);
    output.sort((left, right) => left.frame - right.frame);

    return {
        ok: true,
        frame,
        leftFrame,
        rightFrame,
        interpolation,
        channel,
        materializedBoundaryFrames,
        insertedKey: cloneKey(insertedKey),
        keyframes: output
    };
}
