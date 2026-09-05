import assert from 'node:assert/strict';
import { createCenteredTransformMatrix } from '../system/transform-math.js';
import { planClipTransformFromLayerGesture } from '../system/animation/clip-transform-layer-gesture.js';

const layerStart = {
    x: 18,
    y: -12,
    scaleX: 1.5,
    scaleY: -0.75,
    rotation: 0.25,
    anchorX: 0.4,
    anchorY: 0.6
};
const clipSample = {
    x: 100,
    y: 40,
    scaleX: -2,
    scaleY: 0.5,
    rotation: -0.4,
    opacity: 0.72,
    blendMode: 'multiply',
    blendStrength: 0.63,
    anchorX: 0.4,
    anchorY: 0.6
};
const beforeLayer = JSON.stringify(layerStart);
const beforeClip = JSON.stringify(clipSample);
const assertNearlyEqual = (actual, expected, message) => {
    assert.equal(Math.abs(actual - expected) <= 1e-12, true, message);
};

const compound = planClipTransformFromLayerGesture({
    layerStart,
    layerCurrent: {
        ...layerStart,
        x: 48,
        y: -32,
        scaleX: -0.75,
        scaleY: -1.5,
        rotation: 0.75
    },
    clipSample
});
assert.equal(compound.ok, true);
assert.equal(compound.changed, true);
assert.deepEqual(compound.delta, {
    x: 30,
    y: -20,
    scaleX: -0.5,
    scaleY: 2,
    rotation: 0.5
});
assert.equal(compound.transform.x, 130);
assert.equal(compound.transform.y, 20);
assert.equal(compound.transform.scaleX, 1);
assert.equal(compound.transform.scaleY, 1);
assertNearlyEqual(compound.transform.rotation, 0.1, 'rotation delta must compose without semantic drift');
assert.equal(compound.transform.opacity, clipSample.opacity);
assert.equal(compound.transform.blendMode, clipSample.blendMode);
assert.equal(compound.transform.blendStrength, clipSample.blendStrength);
assert.equal(JSON.stringify(layerStart), beforeLayer);
assert.equal(JSON.stringify(clipSample), beforeClip);

const noChange = planClipTransformFromLayerGesture({
    layerStart,
    layerCurrent: { ...layerStart },
    clipSample
});
assert.equal(noChange.ok, true);
assert.equal(noChange.changed, false);
assert.deepEqual(noChange.transform, clipSample);

const moved = planClipTransformFromLayerGesture({
    layerStart,
    layerCurrent: { ...layerStart, x: layerStart.x - 45, y: layerStart.y + 12 },
    clipSample
});
assert.equal(moved.transform.x, 55);
assert.equal(moved.transform.y, 52);
assert.equal(moved.transform.scaleX, clipSample.scaleX);

const oneAxis = planClipTransformFromLayerGesture({
    layerStart,
    layerCurrent: { ...layerStart, scaleX: layerStart.scaleX * 0.25 },
    clipSample
});
assert.equal(oneAxis.transform.scaleX, -0.5);
assert.equal(oneAxis.transform.scaleY, clipSample.scaleY);

const rotated = planClipTransformFromLayerGesture({
    layerStart,
    layerCurrent: { ...layerStart, rotation: layerStart.rotation - Math.PI / 2 },
    clipSample
});
assertNearlyEqual(
    rotated.transform.rotation,
    clipSample.rotation - Math.PI / 2,
    'rotation gesture must remain additive'
);

const flipped = planClipTransformFromLayerGesture({
    layerStart,
    layerCurrent: { ...layerStart, scaleY: -layerStart.scaleY },
    clipSample
});
assert.equal(flipped.transform.scaleY, -clipSample.scaleY);

const matrix = createCenteredTransformMatrix(compound.transform, 400, 300);
assert.equal(Object.values(matrix).every(Number.isFinite), true, 'planned Clip transform must form a finite affine matrix');

assert.equal(planClipTransformFromLayerGesture({
    layerStart,
    layerCurrent: { ...layerStart, anchorX: 0.5 },
    clipSample
}).reason, 'anchor-edit-not-frame-local');
assert.equal(planClipTransformFromLayerGesture({
    layerStart,
    layerCurrent: { ...layerStart },
    clipSample: { ...clipSample, anchorY: 0.5 }
}).reason, 'anchor-context-mismatch');
assert.equal(planClipTransformFromLayerGesture({
    layerStart: { ...layerStart, scaleX: 0 },
    layerCurrent: { ...layerStart },
    clipSample
}).reason, 'layer-start-scale-not-invertible');
assert.equal(planClipTransformFromLayerGesture({}).reason, 'transform-state-required');

console.log('Clip transform Layer gesture mapping verifier passed.');
