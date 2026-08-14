import assert from 'node:assert/strict';

import { planMotionGraphKeyValueDelta } from '../system/animation/motion-graph-key-batch-edit.js';
import { sampleClipTransform } from '../system/animation/clip-transform-sampler.js';

const baseTransform = Object.freeze({
    x: 0,
    y: 0,
    scaleX: 1,
    scaleY: 1,
    rotation: 0,
    anchorX: 0.5,
    anchorY: 0.5,
    opacity: 1,
    blendMode: 'normal',
    blendStrength: 0
});
const keyframes = [
    { frame: 0, x: 10, y: 5, interpolation: 'linear', easing: { type: 'cubic-bezier', x1: 0.2, y1: 0.4, x2: 0.8, y2: 0.6 } },
    { frame: 4, x: 20, scaleX: -1, interpolation: 'hold' },
    { frame: 8, x: 40, opacity: 0.25, blendMode: 'multiply', blendStrength: 0.9, interpolation: 'linear' }
];
const original = structuredClone(keyframes);

const position = planMotionGraphKeyValueDelta({
    baseTransform,
    keyframes,
    frames: [0, 8],
    duration: 9,
    group: 'position',
    channel: 'x',
    displayDelta: 7
});
assert.equal(position.ok, true);
assert.equal(position.changed, true);
assert.deepEqual(position.changedFrames, [0, 8]);
assert.equal(position.keyframes[0].x, 17);
assert.equal(position.keyframes[1].x, 20, 'unselected key remains unchanged');
assert.equal(position.keyframes[2].x, 47);
assert.equal(position.keyframes[0].y, 5);
assert.deepEqual(position.keyframes[0].easing, keyframes[0].easing);
assert.equal(position.keyframes[2].blendMode, 'multiply');
assert.deepEqual(keyframes, original, 'input keyframes remain immutable');

const partialScale = planMotionGraphKeyValueDelta({
    baseTransform,
    keyframes,
    frames: [0, 4],
    duration: 9,
    group: 'scale',
    channel: 'scaleX',
    displayDelta: -0.5
});
assert.equal(partialScale.keyframes[0].scaleX, 0.5, 'partial key materializes only the active channel');
assert.equal(partialScale.keyframes[1].scaleX, -1.5, 'negative scale remains available');
assert.equal(Object.hasOwn(partialScale.keyframes[0], 'scaleY'), false);

const rotation = planMotionGraphKeyValueDelta({
    baseTransform,
    keyframes,
    frames: [4],
    duration: 9,
    group: 'rotation',
    channel: 'rotation',
    displayDelta: 180
});
assert.ok(Math.abs(rotation.keyframes[1].rotation - Math.PI) < 1e-12);

const opacity = planMotionGraphKeyValueDelta({
    baseTransform,
    keyframes,
    frames: [0, 8],
    duration: 9,
    group: 'opacity',
    channel: 'opacity',
    displayDelta: 50
});
assert.equal(Object.hasOwn(opacity.keyframes[0], 'opacity'), false, 'already-clamped key remains structurally unchanged');
assert.equal(opacity.keyframes[2].opacity, 0.75);
assert.deepEqual(opacity.changedFrames, [8]);

const allClamped = planMotionGraphKeyValueDelta({
    baseTransform,
    keyframes,
    frames: [0],
    duration: 9,
    group: 'opacity',
    channel: 'opacity',
    displayDelta: 20
});
assert.equal(allClamped.changed, false);
assert.deepEqual(allClamped.changedFrames, []);

const noOp = planMotionGraphKeyValueDelta({
    baseTransform,
    keyframes,
    frames: [0, 4],
    duration: 9,
    group: 'position',
    channel: 'y',
    displayDelta: 0
});
assert.equal(noOp.changed, false);
assert.deepEqual(noOp.keyframes, keyframes);

const duplicateFrames = [
    { frame: 0, x: 1, interpolation: 'linear' },
    { frame: 0, x: 5, interpolation: 'hold' },
    { frame: 8, x: 9, interpolation: 'linear' }
];
const duplicatePlan = planMotionGraphKeyValueDelta({
    baseTransform,
    keyframes: duplicateFrames,
    frames: [0],
    duration: 9,
    group: 'position',
    channel: 'x',
    displayDelta: 2
});
assert.equal(duplicatePlan.keyframes[0].x, 1, 'sampler-shadowed duplicate remains untouched');
assert.equal(duplicatePlan.keyframes[1].x, 7, 'last same-Frame key remains sampler authority');

const legacyBase = planMotionGraphKeyValueDelta({
    keyframes: [{ frame: 0, x: 3 }],
    frames: [0],
    duration: 2,
    group: 'position',
    channel: 'x',
    displayDelta: 2
});
assert.equal(legacyBase.keyframes[0].x, 5, 'missing legacy base transform uses sampler defaults');

const sampledBefore = sampleClipTransform({ startFrame: 0, duration: 9, transform: baseTransform, transformKeyframes: keyframes }, 4);
const sampledAfter = sampleClipTransform({ startFrame: 0, duration: 9, transform: baseTransform, transformKeyframes: position.keyframes }, 4);
assert.equal(sampledAfter.y, sampledBefore.y, 'other sampled channels remain unchanged');
assert.equal(sampledAfter.scaleX, sampledBefore.scaleX);

for (const invalid of [
    { frames: [0, 0], reason: 'frame-invalid' },
    { frames: [3], reason: 'key-not-found' },
    { frames: [9], reason: 'frame-invalid' }
]) {
    const result = planMotionGraphKeyValueDelta({
        baseTransform,
        keyframes,
        frames: invalid.frames,
        duration: 9,
        group: 'position',
        channel: 'x',
        displayDelta: 1
    });
    assert.equal(result.ok, false);
    assert.equal(result.reason, invalid.reason);
    assert.deepEqual(keyframes, original, 'failed atomic plan must not mutate input');
}

console.log('verify-motion-graph-key-batch-edit: atomic active-channel delta plan OK');
