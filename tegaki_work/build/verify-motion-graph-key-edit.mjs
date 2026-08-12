import assert from 'node:assert/strict';

import {
    normalizeMotionGraphEditChannel,
    patchMotionGraphTransformChannel
} from '../system/animation/motion-graph-key-edit.js';

const base = Object.freeze({
    x: 12,
    y: -8,
    scaleX: 1.2,
    scaleY: -0.8,
    rotation: Math.PI,
    opacity: 0.75,
    blendMode: 'multiply',
    blendStrength: 0.4
});

assert.equal(normalizeMotionGraphEditChannel('position', 'y'), 'y');
assert.equal(normalizeMotionGraphEditChannel('scale', 'missing'), 'scaleX');
assert.equal(normalizeMotionGraphEditChannel('rotation'), 'rotation');

const position = patchMotionGraphTransformChannel({
    transform: base,
    group: 'position',
    channel: 'x',
    displayValue: 42
});
assert.equal(position.ok, true);
assert.equal(position.transform.x, 42);
assert.equal(position.transform.y, base.y);
assert.equal(position.transform.blendMode, base.blendMode);

const scale = patchMotionGraphTransformChannel({
    transform: base,
    group: 'scale',
    channel: 'scaleY',
    displayValue: -1.5
});
assert.equal(scale.transform.scaleY, -1.5, 'negative scale must remain available for flip');
assert.equal(scale.transform.scaleX, base.scaleX);

const rotation = patchMotionGraphTransformChannel({
    transform: base,
    group: 'rotation',
    channel: 'rotation',
    displayValue: 720
});
assert.ok(Math.abs(rotation.transform.rotation - Math.PI * 4) < 1e-12);

const opacity = patchMotionGraphTransformChannel({
    transform: base,
    group: 'opacity',
    channel: 'opacity',
    displayValue: 140
});
assert.equal(opacity.displayValue, 100);
assert.equal(opacity.transform.opacity, 1);

const blend = patchMotionGraphTransformChannel({
    transform: base,
    group: 'blend',
    channel: 'blendStrength',
    displayValue: -20
});
assert.equal(blend.displayValue, 0);
assert.equal(blend.transform.blendStrength, 0);
assert.equal(blend.transform.blendMode, 'multiply');

const unchanged = patchMotionGraphTransformChannel({
    transform: base,
    group: 'position',
    channel: 'x',
    displayValue: 12
});
assert.equal(unchanged.changed, false);

assert.deepEqual(
    patchMotionGraphTransformChannel({ transform: base, group: 'position', channel: 'rotation', displayValue: 1 }),
    { ok: false, reason: 'channel-invalid' }
);
assert.deepEqual(
    patchMotionGraphTransformChannel({ transform: base, group: 'position', channel: 'x', displayValue: Number.NaN }),
    { ok: false, reason: 'value-invalid' }
);

console.log('verify-motion-graph-key-edit: ok');
