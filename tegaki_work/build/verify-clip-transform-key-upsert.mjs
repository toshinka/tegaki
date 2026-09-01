import assert from 'node:assert/strict';
import { planClipTransformKeyUpsert } from '../system/animation/clip-transform-key-upsert.js';

const transform = {
    x: 12,
    y: -8,
    scaleX: -1.25,
    scaleY: 0.75,
    rotation: Math.PI / 3,
    opacity: 0.8,
    blendMode: 'multiply',
    blendStrength: 0.6
};
const input = [
    { frame: 4, x: 4, interpolation: 'linear' },
    { frame: 2, x: 2, interpolation: 'hold', easing: { type: 'cubic-bezier', x1: 0.2, y1: 0, x2: 0.8, y2: 1 } },
    { frame: 2, x: 3, interpolation: 'hold', easing: { type: 'cubic-bezier', x1: 0.3, y1: -0.2, x2: 0.7, y2: 1.2 } }
];
const before = JSON.stringify(input);

const replaced = planClipTransformKeyUpsert({ keyframes: input, frame: 2, duration: 6, transform });
assert.equal(replaced.ok, true);
assert.equal(replaced.replaced, true);
assert.equal(replaced.keyframes.length, 2);
assert.deepEqual(replaced.keyframes.map(key => key.frame), [2, 4]);
assert.equal(replaced.key.interpolation, 'hold');
assert.deepEqual(replaced.key.easing, input[2].easing, 'same-frame last key owns easing metadata');
assert.equal(replaced.key.scaleX, -1.25);
assert.equal(replaced.key.blendMode, 'multiply');
assert.equal(JSON.stringify(input), before, 'planner must not mutate existing keyframes');
assert.notEqual(replaced.key.easing, input[2].easing, 'planner must clone easing metadata');

const inserted = planClipTransformKeyUpsert({ keyframes: input, frame: 1, duration: 6, transform });
assert.equal(inserted.ok, true);
assert.equal(inserted.replaced, false);
assert.equal(inserted.key.interpolation, 'linear');
assert.deepEqual(inserted.keyframes.map(key => key.frame), [1, 2, 2, 4]);

const noChange = planClipTransformKeyUpsert({
    keyframes: [replaced.key],
    frame: 2,
    duration: 6,
    transform
});
assert.equal(noChange.ok, true);
assert.equal(noChange.changed, false);

assert.deepEqual(planClipTransformKeyUpsert({ frame: 0, duration: 1, transform }), {
    ok: false,
    changed: false,
    reason: 'animated-duration-required'
});
assert.equal(planClipTransformKeyUpsert({ frame: 6, duration: 6, transform }).reason, 'frame-outside-clip');
assert.equal(planClipTransformKeyUpsert({ frame: 2, duration: 6, transform: { x: 1 } }).reason, 'complete-transform-required');

console.log('Clip transform key upsert verifier passed.');
