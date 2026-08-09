import assert from 'node:assert/strict';
import {
    findWarpPointIndicesInRect,
    mergeWarpPointSelection,
    normalizeWarpPointSelectionRect,
    translateWarpPointSelection
} from '../system/animation/warp-point-selection.js';

const rect = normalizeWarpPointSelectionRect({ x: 20, y: 40 }, { x: 5, y: 10 });
assert.deepEqual(rect, {
    x: 5,
    y: 10,
    width: 15,
    height: 30,
    left: 5,
    top: 10,
    right: 20,
    bottom: 40
});
assert.equal(normalizeWarpPointSelectionRect({ x: NaN, y: 0 }, { x: 1, y: 1 }), null);

const points = [
    { x: 5, y: 10 },
    { x: 20, y: 40 },
    { x: 21, y: 40 },
    { x: NaN, y: 5 },
    { x: 12, y: 22 }
];
assert.deepEqual(findWarpPointIndicesInRect(points, rect), [0, 1, 4]);
assert.deepEqual(mergeWarpPointSelection([], [4, 1, 4], 'replace', points.length), [1, 4]);
assert.deepEqual(mergeWarpPointSelection([1, 4], [4, 2], 'toggle', points.length), [1, 2]);
assert.deepEqual(mergeWarpPointSelection([1], [99, -1], 'toggle', points.length), [1]);

const moved = translateWarpPointSelection(
    points,
    [0, 4, 99],
    { x: 0.25, y: -0.5 }
);
assert.deepEqual(moved, [
    { x: 5.25, y: 9.5 },
    { x: 20, y: 40 },
    { x: 21, y: 40 },
    { x: NaN, y: 5 },
    { x: 12.25, y: 21.5 }
]);
assert.equal(translateWarpPointSelection(points, [0], { x: Infinity, y: 0 }), null);

console.log('verify-warp-point-selection: rect, replace/toggle, finite filtering, translation OK');
