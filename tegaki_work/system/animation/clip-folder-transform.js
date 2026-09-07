/**
 * ============================================================================
 * ファイル名: system/animation/clip-folder-transform.js
 * 責務: ClipInstance内のFolder Motion trackをpureに正規化・検証・sampleする
 * 依存: clip-transform-sampler.js
 * 被依存: animation-data-model.js、後続のFolder render plan / edit bridge
 * Authority境界:
 * - trackはFolder IDだけを保存し、子孫IDは評価時にAsset階層から解決する。
 * - 個別Layer Motion、Rig Motion、Folder WARP、History、DOMを変更しない。
 * - ancestor/descendant Folderへの二重trackは初回契約では拒否する。
 * ============================================================================
 */

import { sampleTransformTrack } from './clip-transform-sampler.js';

export const CLIP_FOLDER_TRANSFORM_FIELDS = Object.freeze([
    'x', 'y', 'scaleX', 'scaleY', 'rotation'
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
        folderLayerId: track.folderLayerId ?? null,
        pivotX: finite(track.pivotX, 0),
        pivotY: finite(track.pivotY, 0),
        keyframes: Array.isArray(track.keyframes)
            ? track.keyframes.map(normalizeKey)
            : clonePlain(track.keyframes)
    };
}

export function normalizeClipFolderTransformTracks(value) {
    return Array.isArray(value) ? value.map(normalizeTrack) : [];
}

export function serializeClipFolderTransformTracks(value) {
    return normalizeClipFolderTransformTracks(value);
}

export function getClipFolderTransformTrack(tracks, folderLayerId) {
    return normalizeClipFolderTransformTracks(tracks)
        .find(track => track?.folderLayerId === folderLayerId) || null;
}

export function getClipFolderTransformKeyAtFrame(tracks, folderLayerId, localFrame) {
    if (!Number.isInteger(localFrame)) return null;
    return getClipFolderTransformTrack(tracks, folderLayerId)?.keyframes
        ?.findLast?.(key => key?.frame === localFrame) || null;
}

function isAncestorFolder(ancestorId, descendantId, layersById) {
    const visited = new Set();
    let current = layersById.get(descendantId) || null;
    while (current?.parentLayerId && !visited.has(current.id)) {
        visited.add(current.id);
        if (current.parentLayerId === ancestorId) return true;
        current = layersById.get(current.parentLayerId) || null;
    }
    return false;
}

export function validateClipFolderTransformTracks(value, internalLayers = [], duration = 1) {
    const rawTracks = Array.isArray(value) ? value : [];
    const tracks = normalizeClipFolderTransformTracks(value);
    const layersById = new Map((Array.isArray(internalLayers) ? internalLayers : [])
        .filter(layer => layer?.id)
        .map(layer => [layer.id, layer]));
    const normalizedDuration = Math.max(1, Number.isInteger(duration) ? duration : 1);
    const errors = [];
    const seen = new Set();
    tracks.forEach((track, trackIndex) => {
        const rawTrack = rawTracks[trackIndex];
        const path = `folderTransformTracks[${trackIndex}]`;
        if (!rawTrack || typeof rawTrack !== 'object' || Array.isArray(rawTrack)) {
            errors.push({ code: 'invalid-folder-transform-track', path });
            return;
        }
        const target = layersById.get(track.folderLayerId);
        if (typeof track.folderLayerId !== 'string' || track.folderLayerId.length === 0) {
            errors.push({ code: 'invalid-folder-transform-target', path: `${path}.folderLayerId` });
        } else if (seen.has(track.folderLayerId)) {
            errors.push({ code: 'duplicate-folder-transform-track', path: `${path}.folderLayerId` });
        } else if (!target) {
            errors.push({ code: 'dangling-folder-transform-target', path: `${path}.folderLayerId` });
        } else if (target.type !== 'folder') {
            errors.push({ code: 'folder-transform-target-not-folder', path: `${path}.folderLayerId` });
        }
        seen.add(track.folderLayerId);
        if (!Number.isFinite(rawTrack.pivotX) || !Number.isFinite(rawTrack.pivotY)) {
            errors.push({ code: 'invalid-folder-transform-pivot', path });
        }
        if (!Array.isArray(rawTrack.keyframes)) {
            errors.push({ code: 'invalid-folder-transform-keyframes', path: `${path}.keyframes` });
            return;
        }
        rawTrack.keyframes.forEach((key, keyIndex) => {
            const keyPath = `${path}.keyframes[${keyIndex}]`;
            if (!key || typeof key !== 'object' || Array.isArray(key)) {
                errors.push({ code: 'invalid-folder-transform-key', path: keyPath });
                return;
            }
            if (!Number.isInteger(key.frame) || key.frame < 0 || key.frame >= normalizedDuration) {
                errors.push({ code: 'folder-transform-key-out-of-range', path: `${keyPath}.frame` });
            }
            if (key.interpolation != null && !['linear', 'hold'].includes(key.interpolation)) {
                errors.push({ code: 'invalid-folder-transform-interpolation', path: `${keyPath}.interpolation` });
            }
            CLIP_FOLDER_TRANSFORM_FIELDS.forEach(field => {
                if (!Number.isFinite(key[field])) {
                    errors.push({ code: 'non-finite-folder-transform-key', path: `${keyPath}.${field}` });
                }
            });
        });
    });
    const folderIds = [...seen].filter(id => layersById.get(id)?.type === 'folder');
    for (let left = 0; left < folderIds.length; left++) {
        for (let right = left + 1; right < folderIds.length; right++) {
            if (isAncestorFolder(folderIds[left], folderIds[right], layersById)
                || isAncestorFolder(folderIds[right], folderIds[left], layersById)) {
                errors.push({
                    code: 'nested-folder-transform-unsupported',
                    folderLayerIds: [folderIds[left], folderIds[right]]
                });
            }
        }
    }
    return { ok: errors.length === 0, errors, value: tracks };
}

function sameTransform(left, right) {
    return CLIP_FOLDER_TRANSFORM_FIELDS.every(field => (
        Math.abs(finite(left?.[field], DEFAULT_TRANSFORM[field])
            - finite(right?.[field], DEFAULT_TRANSFORM[field])) <= EPSILON
    ));
}

export function planClipFolderTransformKeyUpsert({
    tracks, folderLayerId, frame, duration, pivotX, pivotY, transform
} = {}) {
    if (typeof folderLayerId !== 'string' || folderLayerId.length === 0) {
        return { ok: false, changed: false, reason: 'folder-transform-target-required' };
    }
    if (!Number.isInteger(frame) || !Number.isInteger(duration) || duration <= 1
        || frame < 0 || frame >= duration) {
        return { ok: false, changed: false, reason: 'folder-transform-frame-out-of-range' };
    }
    if (!Number.isFinite(pivotX) || !Number.isFinite(pivotY) || !transform) {
        return { ok: false, changed: false, reason: 'folder-transform-baseline-required' };
    }
    const nextTracks = normalizeClipFolderTransformTracks(tracks);
    const trackIndex = nextTracks.findIndex(track => track?.folderLayerId === folderLayerId);
    const previousTrack = trackIndex >= 0 ? nextTracks[trackIndex] : null;
    if (previousTrack
        && (Math.abs(previousTrack.pivotX - pivotX) > EPSILON
            || Math.abs(previousTrack.pivotY - pivotY) > EPSILON)) {
        return { ok: false, changed: false, reason: 'folder-transform-pivot-mismatch' };
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
    const nextTrack = { ...(previousTrack || {}), folderLayerId, pivotX, pivotY, keyframes };
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

export function sampleClipFolderTransform(clip, folderLayerId, timelineFrame) {
    const track = getClipFolderTransformTrack(clip?.folderTransformTracks, folderLayerId);
    if (!track) return null;
    const duration = Math.max(1, Number.isInteger(clip?.duration) ? clip.duration : 1);
    const startFrame = Number.isInteger(clip?.startFrame) ? clip.startFrame : 0;
    const sampled = sampleTransformTrack(
        DEFAULT_TRANSFORM,
        track.keyframes,
        timelineFrame - startFrame,
        duration,
        { allowOvershoot: true }
    );
    return { ...normalizeTransform(sampled), pivotX: track.pivotX, pivotY: track.pivotY };
}

export function remapClipFolderTransformTracks(value, idMap = new Map()) {
    return normalizeClipFolderTransformTracks(value).map(track => ({
        ...track,
        folderLayerId: idMap.get(track.folderLayerId) || track.folderLayerId
    }));
}

export function removeClipFolderTransformTargets(value, folderLayerIds = []) {
    const removed = new Set(folderLayerIds || []);
    return normalizeClipFolderTransformTracks(value)
        .filter(track => !removed.has(track?.folderLayerId));
}

export function sampleClipFolderTransformTracksForBake(clip, timelineFrame) {
    return normalizeClipFolderTransformTracks(clip?.folderTransformTracks).map(track => {
        const sampled = sampleClipFolderTransform(clip, track.folderLayerId, timelineFrame);
        return {
            folderLayerId: track.folderLayerId,
            pivotX: track.pivotX,
            pivotY: track.pivotY,
            keyframes: sampled ? [{ frame: 0, interpolation: 'hold', ...normalizeTransform(sampled) }] : []
        };
    }).filter(track => track.keyframes.length > 0);
}

export function retimeClipFolderTransformTracks(value, oldDuration, newDuration) {
    const oldLast = Math.max(0, (Number.isInteger(oldDuration) ? oldDuration : 1) - 1);
    const targetDuration = Math.max(1, Number.isInteger(newDuration) ? newDuration : 1);
    const newLast = targetDuration - 1;
    return normalizeClipFolderTransformTracks(value).map(track => {
        const terminal = (track.keyframes || []).findLast(key => key?.frame === oldLast) || null;
        const keyframes = (track.keyframes || [])
            .filter(key => Number.isInteger(key?.frame)
                && key.frame < targetDuration
                && key.frame !== oldLast
                && (!terminal || key.frame !== newLast));
        if (terminal) keyframes.push({ ...terminal, frame: newLast });
        return { ...track, keyframes: keyframes.sort((left, right) => left.frame - right.frame) };
    });
}
