/**
 * Layer Transform BASIC/WARP KEY bundle helpers.
 *
 * A bundle is a derived UI operation over the existing
 * `layerTransformTracks` and `layerDeformers` collections.  It is deliberately
 * not a persisted model field.  These helpers clone and normalize their input
 * and return a rejected plan without mutating the caller's values.
 */

import {
    getClipLayerTransformKeyAtFrame,
    normalizeClipLayerTransformTracks
} from './clip-layer-transform.js';
import {
    getClipLayerDeformer,
    normalizeClipLayerDeformers,
    setClipLayerDeformerTarget
} from './clip-layer-deformer.js';

const COMPONENTS = Object.freeze(['basic', 'warp']);

function clone(value) {
    return value == null ? value : structuredClone(value);
}

function invalid(reason, extra = {}) {
    return { ok: false, changed: false, reason, ...extra };
}

function validTarget(internalLayerId) {
    return typeof internalLayerId === 'string' && internalLayerId.length > 0;
}

function validFrame(frame, duration) {
    return Number.isInteger(frame)
        && Number.isInteger(duration)
        && duration > 0
        && frame >= 0
        && frame < duration;
}

function getWarpKeyAtFrame(layerDeformers, internalLayerId, localFrame) {
    const deformer = getClipLayerDeformer(layerDeformers, internalLayerId);
    return deformer?.keyframes?.findLast?.(key => key?.frame === localFrame)
        || (Array.isArray(deformer?.keyframes)
            ? [...deformer.keyframes].reverse().find(key => key?.frame === localFrame) || null
            : null);
}

/**
 * Derive the committed component presence at one exact local frame.
 */
export function inspectLayerTransformKeyBundle({
    layerTransformTracks,
    layerDeformers,
    internalLayerId,
    localFrame
} = {}) {
    if (!validTarget(internalLayerId) || !Number.isInteger(localFrame)) {
        return { hasBasic: false, hasWarp: false, components: [], valid: false };
    }
    const hasBasic = getClipLayerTransformKeyAtFrame(
        layerTransformTracks,
        internalLayerId,
        localFrame
    ) !== null;
    const hasWarp = getWarpKeyAtFrame(layerDeformers, internalLayerId, localFrame) !== null;
    const components = [];
    if (hasBasic) components.push('basic');
    if (hasWarp) components.push('warp');
    return { hasBasic, hasWarp, components, valid: true };
}

function validateCommon({ internalLayerId, localFrame, duration } = {}) {
    if (!validTarget(internalLayerId)) return invalid('layer-transform-target-required');
    if (!validFrame(localFrame, duration)) return invalid('layer-transform-frame-out-of-range');
    return null;
}

/**
 * Remove one exact component key. Empty component containers are removed using
 * the normal collection shapes so existing validation/serialization rules
 * remain authoritative.
 */
export function removeLayerTransformComponentKey({
    layerTransformTracks,
    layerDeformers,
    internalLayerId,
    localFrame,
    duration,
    component
} = {}) {
    const common = validateCommon({ internalLayerId, localFrame, duration });
    if (common) return common;
    if (!COMPONENTS.includes(component)) return invalid('layer-transform-component-unsupported');

    const before = inspectLayerTransformKeyBundle({
        layerTransformTracks,
        layerDeformers,
        internalLayerId,
        localFrame
    });
    const hasComponent = component === 'basic' ? before.hasBasic : before.hasWarp;
    if (!hasComponent) return invalid('layer-transform-component-key-missing', { bundle: before });

    let tracks = normalizeClipLayerTransformTracks(layerTransformTracks);
    let nextLayerDeformers = normalizeClipLayerDeformers(layerDeformers);
    if (component === 'basic') {
        tracks = tracks
            .map(track => track?.internalLayerId === internalLayerId
                ? { ...track, keyframes: (track.keyframes || [])
                    .filter(key => key?.frame !== localFrame) }
                : track)
            .filter(track => track?.internalLayerId !== internalLayerId
                || (track.keyframes || []).length > 0);
    } else {
        const deformer = getClipLayerDeformer(nextLayerDeformers, internalLayerId);
        const keyframes = (deformer?.keyframes || []).filter(key => key?.frame !== localFrame);
        const nextDeformer = deformer
            ? (keyframes.length > 0 ? { ...clone(deformer), keyframes } : null)
            : null;
        nextLayerDeformers = setClipLayerDeformerTarget(
            nextLayerDeformers,
            internalLayerId,
            nextDeformer
        );
    }
    const bundle = inspectLayerTransformKeyBundle({
        layerTransformTracks: tracks,
        layerDeformers: nextLayerDeformers,
        internalLayerId,
        localFrame
    });
    return {
        ok: true,
        changed: true,
        reason: null,
        component,
        removed: component,
        bundle,
        tracks,
        layerDeformers: nextLayerDeformers
    };
}

function moveBasicKey(tracks, internalLayerId, sourceLocalFrame, destinationLocalFrame) {
    const next = normalizeClipLayerTransformTracks(tracks);
    const index = next.findIndex(track => track?.internalLayerId === internalLayerId);
    if (index < 0) return next;
    const track = next[index];
    const source = (track.keyframes || []).findLast?.(key => key?.frame === sourceLocalFrame)
        || [...(track.keyframes || [])].reverse().find(key => key?.frame === sourceLocalFrame);
    if (!source) return next;
    const keyframes = (track.keyframes || [])
        .filter(key => key?.frame !== sourceLocalFrame)
        .map(key => clone(key));
    keyframes.push({ ...clone(source), frame: destinationLocalFrame });
    keyframes.sort((left, right) => left.frame - right.frame);
    next[index] = { ...track, keyframes };
    return next;
}

function moveWarpKey(layerDeformers, internalLayerId, sourceLocalFrame, destinationLocalFrame) {
    const current = normalizeClipLayerDeformers(layerDeformers);
    const deformer = getClipLayerDeformer(current, internalLayerId);
    const source = getWarpKeyAtFrame(current, internalLayerId, sourceLocalFrame);
    if (!deformer || !source) return current;
    const keyframes = (deformer.keyframes || [])
        .filter(key => key?.frame !== sourceLocalFrame)
        .map(key => clone(key));
    keyframes.push({ ...clone(source), frame: destinationLocalFrame });
    keyframes.sort((left, right) => left.frame - right.frame);
    return setClipLayerDeformerTarget(current, internalLayerId, {
        ...clone(deformer),
        keyframes
    });
}

/**
 * Move the exact BASIC and/or WARP keys at one source frame as one atomic plan.
 * Destination occupancy by either component rejects the complete operation.
 */
export function moveLayerTransformKeyBundle({
    layerTransformTracks,
    layerDeformers,
    internalLayerId,
    sourceLocalFrame,
    destinationLocalFrame,
    duration
} = {}) {
    const common = validateCommon({
        internalLayerId,
        localFrame: sourceLocalFrame,
        duration
    });
    if (common) return common;
    if (!Number.isInteger(destinationLocalFrame)
        || destinationLocalFrame < 0
        || destinationLocalFrame >= duration) {
        return invalid('layer-transform-destination-frame-out-of-range');
    }
    const source = inspectLayerTransformKeyBundle({
        layerTransformTracks,
        layerDeformers,
        internalLayerId,
        localFrame: sourceLocalFrame
    });
    if (!source.hasBasic && !source.hasWarp) {
        return invalid('layer-transform-source-key-missing', { bundle: source });
    }
    if (sourceLocalFrame === destinationLocalFrame) {
        return invalid('layer-transform-same-frame', { bundle: source });
    }
    const destination = inspectLayerTransformKeyBundle({
        layerTransformTracks,
        layerDeformers,
        internalLayerId,
        localFrame: destinationLocalFrame
    });
    if (destination.hasBasic || destination.hasWarp) {
        return invalid('layer-transform-destination-occupied', {
            bundle: source,
            destinationBundle: destination
        });
    }

    const tracks = source.hasBasic
        ? moveBasicKey(layerTransformTracks, internalLayerId, sourceLocalFrame, destinationLocalFrame)
        : normalizeClipLayerTransformTracks(layerTransformTracks);
    const nextLayerDeformers = source.hasWarp
        ? moveWarpKey(layerDeformers, internalLayerId, sourceLocalFrame, destinationLocalFrame)
        : normalizeClipLayerDeformers(layerDeformers);
    return {
        ok: true,
        changed: true,
        reason: null,
        sourceLocalFrame,
        destinationLocalFrame,
        hasBasic: source.hasBasic,
        hasWarp: source.hasWarp,
        bundle: source,
        tracks,
        layerDeformers: nextLayerDeformers
    };
}

export { COMPONENTS as LAYER_TRANSFORM_KEY_COMPONENTS };
