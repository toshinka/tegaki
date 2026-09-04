import assert from 'node:assert/strict';
import {
    getClipLayerTransformKeyAtFrame,
    planClipLayerTransformKeyUpsert,
    remapClipLayerTransformTracks,
    sampleClipLayerTransform,
    validateClipLayerTransformTracks
} from '../system/animation/clip-layer-transform.js';

const layers = [
    { id: 'layer-a', type: 'raster' },
    { id: 'layer-b', type: 'raster' },
    { id: 'background', type: 'raster', isBackground: true }
];
const source = [];
const first = planClipLayerTransformKeyUpsert({
    tracks: source,
    internalLayerId: 'layer-a',
    frame: 1,
    duration: 4,
    pivotX: 100,
    pivotY: 80,
    transform: { x: 20, y: 4, scaleX: 1.2, scaleY: -0.8, rotation: 0.25 }
});
assert.equal(first.ok, true);
assert.equal(first.changed, true);
assert.deepEqual(source, [], 'planner must not mutate input tracks');
assert.equal(getClipLayerTransformKeyAtFrame(first.tracks, 'layer-a', 1)?.x, 20);
assert.equal(getClipLayerTransformKeyAtFrame(first.tracks, 'layer-b', 1), null);

const clip = {
    startFrame: 10,
    duration: 4,
    layerTransformTracks: first.tracks
};
const sampled = sampleClipLayerTransform(clip, 'layer-a', 11);
assert.equal(sampled.x, 20);
assert.equal(sampled.scaleY, -0.8);
assert.equal(sampled.pivotX, 100);
assert.equal(sampleClipLayerTransform(clip, 'layer-b', 11), null);

const replaced = planClipLayerTransformKeyUpsert({
    tracks: first.tracks,
    internalLayerId: 'layer-a',
    frame: 1,
    duration: 4,
    pivotX: 100,
    pivotY: 80,
    transform: { x: 25, y: 4, scaleX: 1.2, scaleY: -0.8, rotation: 0.25 }
});
assert.equal(replaced.replaced, true);
assert.equal(replaced.tracks.length, 1);
assert.equal(getClipLayerTransformKeyAtFrame(replaced.tracks, 'layer-a', 1)?.x, 25);

assert.equal(planClipLayerTransformKeyUpsert({
    tracks: first.tracks,
    internalLayerId: 'layer-a',
    frame: 2,
    duration: 4,
    pivotX: 101,
    pivotY: 80,
    transform: { x: 1 }
}).reason, 'layer-transform-pivot-mismatch');

assert.equal(validateClipLayerTransformTracks(first.tracks, layers, 4).ok, true);
assert.equal(validateClipLayerTransformTracks(first.tracks, [{ id: 'layer-b', type: 'raster' }], 4).ok, false);
assert.equal(validateClipLayerTransformTracks([
    { internalLayerId: 'background', pivotX: 0, pivotY: 0, keyframes: [] }
], layers, 4).ok, false);

const remapped = remapClipLayerTransformTracks(first.tracks, new Map([['layer-a', 'layer-copy']]));
assert.equal(remapped[0].internalLayerId, 'layer-copy');
assert.equal(first.tracks[0].internalLayerId, 'layer-a');

console.log('Clip internal Layer transform track verifier passed.');
