import assert from 'node:assert/strict';
import {
    createSkinWeightBrushSample,
    mergeSkinWeightBrushSamples
} from '../system/animation/skin-weight-brush-gesture.js';

const vertices = [
    { vertexId: 'center', screenX: 100, screenY: 100 },
    { vertexId: 'half', screenX: 110, screenY: 100 },
    { vertexId: 'edge', screenX: 120, screenY: 100 },
    { vertexId: 'outside', screenX: 121, screenY: 100 }
];
const before = structuredClone(vertices);
const add = createSkinWeightBrushSample(vertices, {
    center: { x: 100, y: 100 },
    radius: 20,
    strength: 0.2,
    direction: 1
});
assert.deepEqual(add, [
    { vertexId: 'center', delta: 0.2 },
    { vertexId: 'half', delta: 0.1 }
]);
assert.deepEqual(vertices, before, 'sample calculation is pure');

const subtract = createSkinWeightBrushSample(vertices, {
    center: { x: 100, y: 100 },
    radius: 20,
    strength: 0.2,
    direction: -1
});
assert.deepEqual(subtract, [
    { vertexId: 'center', delta: -0.2 },
    { vertexId: 'half', delta: -0.1 }
]);

const merged = mergeSkinWeightBrushSamples(new Map([['center', 0.1]]), add);
assert.ok(Math.abs(merged.get('center') - 0.3) <= 1e-12);
assert.ok(Math.abs(merged.get('half') - 0.1) <= 1e-12);
const cancelled = mergeSkinWeightBrushSamples(merged, subtract);
assert.ok(Math.abs(cancelled.get('center') - 0.1) <= 1e-12);
assert.ok(Math.abs(cancelled.get('half')) <= 1e-12,
    'signed samples accumulate without creating a saved delta authority');
assert.deepEqual(createSkinWeightBrushSample(vertices, { radius: 0, strength: 1 }), []);

console.log('verify-skin-weight-brush-gesture: fixed diagnostic radial falloff and cumulative signed samples OK');
