/**
 * ============================================================================
 * ファイル名: system/animation/clip-layer-transform.js
 * 責務: ClipInstance内の個別internal Layer Motion trackをpureに正規化・検証・sampleする
 * 依存: clip-transform-sampler.js
 * 被依存: animation-data-model.js、folder-part-render-plan.js、AnimationTablePopup
 * Authority境界:
 * - CAF全体MotionはClipInstance.transformKeyframes、本moduleは個別Layerだけを所有する。
 * - RIG定義 / rigMotion、DrawingSnapshot、working Layer、History、DOMを変更しない。
 * - pivotはtrack単位のProject座標。Frame keyはx/y/scale/rotationだけを持つ。
 * ============================================================================
 */

import { sampleTransformTrack } from './clip-transform-sampler.js';

export const CLIP_LAYER_TRANSFORM_FIELDS = Object.freeze([
    'x',
    'y',
    'scaleX',
    'scaleY',
    'rotation'
]);

const EPSILON = 1e-8;
const DEFAULT_TRANSFORM = Object.freeze({
    x: 0,
    y: 0,
    scaleX: 1,
    scaleY: 1,
    rotation: 0
});

function clonePlain(value) {
    if (value == null || typeof value !== 'object') return value;
    return structuredClone(value);
}

function finite(value, fallback) {
    return Number.isFinite(value) ? value : fallback;
}

function normalizeTransform(value = {}) {
    return {
        x: finite(value.x, 0),
        y: finite(value.y, 0),
        scaleX: finite(value.scaleX, 1),
        scaleY: finite(value.scaleY, 1),
        rotation: finite(value.rotation, 0)
    };
}

function normalizeKey(key) {
    if (!key || typeof key !== 'object' || Array.isArray(key)) return clonePlain(key);
    return {
        ...clonePlain(key),
        frame: key.frame,
        interpolation: key.interpolation === 'hold' ? 'hold' : 'linear',
        ...normalizeTransform(key),
        ...(key.easing ? { easing: clonePlain(key.easing) } : {})
    };
}

function normalizeTrack(track) {
    if (!track || typeof track !== 'object' || Array.isArray(track)) return clonePlain(track);
    return {
        ...clonePlain(track),
        internalLayerId: track.internalLayerId ?? null,
        pivotX: finite(track.pivotX, 0),
        pivotY: finite(track.pivotY, 0),
        keyframes: Array.isArray(track.keyframes)
            ? track.keyframes.map(normalizeKey)
            : clonePlain(track.keyframes)
    };
}

export function normalizeClipLayerTransformTracks(value) {
    return Array.isArray(value) ? value.map(normalizeTrack) : [];
}

export function serializeClipLayerTransformTracks(value) {
    return normalizeClipLayerTransformTracks(value);
}

export function getClipLayerTransformTrack(tracks, internalLayerId) {
    return normalizeClipLayerTransformTracks(tracks)
        .find(track => track?.internalLayerId === internalLayerId) || null;
}

export function getClipLayerTransformKeyAtFrame(tracks, internalLayerId, localFrame) {
    if (!Number.isInteger(localFrame)) return null;
    return getClipLayerTransformTrack(tracks, internalLayerId)?.keyframes
        ?.findLast?.(key => key?.frame === localFrame) || null;
}

export function validateClipLayerTransformTracks(value, internalLayers = [], duration = 1) {
    const tracks = normalizeClipLayerTransformTracks(value);
    const layerIds = new Set((Array.isArray(internalLayers) ? internalLayers : [])
        .filter(layer => layer?.type !== 'folder' && layer?.isBackground !== true)
        .map(layer => layer?.id)
        .filter(Boolean));
    const normalizedDuration = Math.max(1, Number.isInteger(duration) ? duration : 1);
    const errors = [];
    const seen = new Set();
    tracks.forEach((track, trackIndex) => {
        const path = `layerTransformTracks[${trackIndex}]`;
        if (!track || typeof track !== 'object' || Array.isArray(track)) {
            errors.push({ code: 'invalid-layer-transform-track', path });
            return;
        }
        if (typeof track.internalLayerId !== 'string' || track.internalLayerId.length === 0) {
            errors.push({ code: 'invalid-layer-transform-target', path: `${path}.internalLayerId` });
        } else if (seen.has(track.internalLayerId)) {
            errors.push({ code: 'duplicate-layer-transform-track', path: `${path}.internalLayerId` });
        } else if (!layerIds.has(track.internalLayerId)) {
            errors.push({ code: 'dangling-layer-transform-target', path: `${path}.internalLayerId` });
        }
        seen.add(track.internalLayerId);
        if (!Number.isFinite(track.pivotX) || !Number.isFinite(track.pivotY)) {
            errors.push({ code: 'invalid-layer-transform-pivot', path });
        }
        if (!Array.isArray(track.keyframes)) {
            errors.push({ code: 'invalid-layer-transform-keyframes', path: `${path}.keyframes` });
            return;
        }
        track.keyframes.forEach((key, keyIndex) => {
            const keyPath = `${path}.keyframes[${keyIndex}]`;
            if (!key || typeof key !== 'object' || Array.isArray(key)) {
                errors.push({ code: 'invalid-layer-transform-key', path: keyPath });
                return;
            }
            if (!Number.isInteger(key.frame) || key.frame < 0 || key.frame >= normalizedDuration) {
                errors.push({ code: 'layer-transform-key-out-of-range', path: `${keyPath}.frame` });
            }
            if (key.interpolation != null && !['linear', 'hold'].includes(key.interpolation)) {
                errors.push({ code: 'invalid-layer-transform-interpolation', path: `${keyPath}.interpolation` });
            }
            CLIP_LAYER_TRANSFORM_FIELDS.forEach(field => {
                if (!Number.isFinite(key[field])) {
                    errors.push({ code: 'non-finite-layer-transform-key', path: `${keyPath}.${field}` });
                }
            });
        });
    });
    return { ok: errors.length === 0, errors, value: tracks };
}

function sameTransform(left, right) {
    return CLIP_LAYER_TRANSFORM_FIELDS.every(field => (
        Math.abs(finite(left?.[field], DEFAULT_TRANSFORM[field])
            - finite(right?.[field], DEFAULT_TRANSFORM[field])) <= EPSILON
    ));
}

export function planClipLayerTransformKeyUpsert({
    tracks,
    internalLayerId,
    frame,
    duration,
    pivotX,
    pivotY,
    transform
} = {}) {
    if (typeof internalLayerId !== 'string' || internalLayerId.length === 0) {
        return { ok: false, changed: false, reason: 'layer-transform-target-required' };
    }
    if (!Number.isInteger(frame) || !Number.isInteger(duration) || duration <= 1
        || frame < 0 || frame >= duration) {
        return { ok: false, changed: false, reason: 'layer-transform-frame-out-of-range' };
    }
    if (!Number.isFinite(pivotX) || !Number.isFinite(pivotY) || !transform) {
        return { ok: false, changed: false, reason: 'layer-transform-baseline-required' };
    }
    const nextTracks = normalizeClipLayerTransformTracks(tracks);
    const trackIndex = nextTracks.findIndex(track => track?.internalLayerId === internalLayerId);
    const previousTrack = trackIndex >= 0 ? nextTracks[trackIndex] : null;
    if (previousTrack
        && (Math.abs(previousTrack.pivotX - pivotX) > EPSILON
            || Math.abs(previousTrack.pivotY - pivotY) > EPSILON)) {
        return { ok: false, changed: false, reason: 'layer-transform-pivot-mismatch' };
    }
    const previousKey = previousTrack?.keyframes?.findLast?.(key => key?.frame === frame) || null;
    const key = {
        frame,
        interpolation: previousKey?.interpolation === 'hold' ? 'hold' : 'linear',
        ...(previousKey?.easing ? { easing: clonePlain(previousKey.easing) } : {}),
        ...normalizeTransform(transform)
    };
    const keyframes = (previousTrack?.keyframes || []).filter(candidate => candidate?.frame !== frame);
    keyframes.push(key);
    keyframes.sort((left, right) => left.frame - right.frame);
    const nextTrack = {
        ...(previousTrack || {}),
        internalLayerId,
        pivotX,
        pivotY,
        keyframes
    };
    if (trackIndex >= 0) nextTracks[trackIndex] = nextTrack;
    else nextTracks.push(nextTrack);
    return {
        ok: true,
        changed: !previousKey || !sameTransform(previousKey, key),
        reason: null,
        tracks: nextTracks,
        track: clonePlain(nextTrack),
        key: clonePlain(key),
        replaced: !!previousKey
    };
}

export function sampleClipLayerTransform(clip, internalLayerId, timelineFrame) {
    const track = getClipLayerTransformTrack(clip?.layerTransformTracks, internalLayerId);
    if (!track) return null;
    const duration = Math.max(1, Number.isInteger(clip?.duration) ? clip.duration : 1);
    const startFrame = Number.isInteger(clip?.startFrame) ? clip.startFrame : 0;
    const localFrame = timelineFrame - startFrame;
    const sampled = sampleTransformTrack(
        DEFAULT_TRANSFORM,
        track.keyframes,
        localFrame,
        duration,
        { allowOvershoot: true }
    );
    return {
        ...normalizeTransform(sampled),
        pivotX: track.pivotX,
        pivotY: track.pivotY
    };
}

export function remapClipLayerTransformTracks(value, idMap = new Map()) {
    return normalizeClipLayerTransformTracks(value).map(track => ({
        ...track,
        internalLayerId: idMap.get(track.internalLayerId) || track.internalLayerId
    }));
}

export function removeClipLayerTransformTargets(value, internalLayerIds = []) {
    const removed = new Set(internalLayerIds || []);
    return normalizeClipLayerTransformTracks(value)
        .filter(track => !removed.has(track?.internalLayerId));
}

export function sampleClipLayerTransformTracksForBake(clip, timelineFrame) {
    return normalizeClipLayerTransformTracks(clip?.layerTransformTracks).map(track => {
        const sampled = sampleClipLayerTransform(clip, track.internalLayerId, timelineFrame);
        return {
            internalLayerId: track.internalLayerId,
            pivotX: track.pivotX,
            pivotY: track.pivotY,
            keyframes: sampled ? [{ frame: 0, interpolation: 'hold', ...normalizeTransform(sampled) }] : []
        };
    }).filter(track => track.keyframes.length > 0);
}
