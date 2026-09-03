/**
 * Motion Graph複数key値dragのpure plan。
 * explicit Motion keyのactive一channelだけをdisplay deltaで更新し、
 * Frame・他channel・補間metadata・入力配列を維持する。
 */

import { sampleClipTransform } from './clip-transform-sampler.js';
import {
    patchMotionGraphTransformChannel,
    readMotionGraphTransformChannel
} from './motion-graph-key-edit.js';

function cloneKey(key) {
    return key && typeof key === 'object'
        ? {
            ...key,
            ...(key.easing && typeof key.easing === 'object' ? { easing: { ...key.easing } } : {})
        }
        : key;
}

export function planMotionGraphKeyValueDelta({
    baseTransform,
    keyframes,
    frames,
    duration,
    group,
    channel,
    displayDelta
} = {}) {
    if (baseTransform != null && typeof baseTransform !== 'object') {
        return { ok: false, reason: 'base-transform-required' };
    }
    if (!Array.isArray(keyframes) || !Array.isArray(frames) || frames.length === 0) {
        return { ok: false, reason: 'keys-required' };
    }
    const clipDuration = Number(duration);
    const delta = Number(displayDelta);
    if (!Number.isInteger(clipDuration) || clipDuration < 1 || !Number.isFinite(delta)) {
        return { ok: false, reason: 'value-invalid' };
    }

    const uniqueFrames = [...new Set(frames)];
    if (uniqueFrames.length !== frames.length
        || uniqueFrames.some(frame => !Number.isInteger(frame) || frame < 0 || frame >= clipDuration)) {
        return { ok: false, reason: 'frame-invalid' };
    }
    const keyIndexByFrame = new Map();
    for (let index = 0; index < keyframes.length; index += 1) {
        const key = keyframes[index];
        if (key && Number.isInteger(key.frame)) keyIndexByFrame.set(key.frame, index);
    }
    if (uniqueFrames.some(frame => !keyIndexByFrame.has(frame))) {
        return { ok: false, reason: 'key-not-found' };
    }
    if (Math.abs(delta) <= 1e-12) {
        return {
            ok: true,
            changed: false,
            changedFrames: [],
            keyframes: keyframes.map(cloneKey)
        };
    }

    const sampleClip = {
        startFrame: 0,
        duration: clipDuration,
        transform: baseTransform || {},
        transformKeyframes: keyframes
    };
    const patches = new Map();
    for (const frame of uniqueFrames) {
        const sampled = sampleClipTransform(sampleClip, frame);
        const current = readMotionGraphTransformChannel({ transform: sampled, group, channel });
        if (!current.ok) return current;
        const patch = patchMotionGraphTransformChannel({
            transform: sampled,
            group,
            channel,
            displayValue: current.displayValue + delta
        });
        if (!patch.ok) return patch;
        if (patch.changed) patches.set(frame, patch.storedValue);
    }

    const changedFrames = [...patches.keys()].sort((left, right) => left - right);
    return {
        ok: true,
        changed: changedFrames.length > 0,
        changedFrames,
        keyframes: keyframes.map((key, index) => {
            const frame = key?.frame;
            if (!patches.has(frame) || keyIndexByFrame.get(frame) !== index) return cloneKey(key);
            return { ...cloneKey(key), [channel]: patches.get(frame) };
        })
    };
}
