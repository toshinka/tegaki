import assert from 'node:assert/strict';
import {
    WARP_POINT_SELECTION_SHAPES,
    findWarpPointIndicesInCircle,
    findWarpPointIndicesInPolyline,
    findWarpPointIndicesInRect,
    findWarpPointIndicesInShape,
    mergeWarpPointSelection,
    normalizeWarpPointSelectionCircle,
    normalizeWarpPointSelectionPolyline,
    normalizeWarpPointSelectionRect,
    translateWarpPointSelection
} from '../system/animation/warp-point-selection.js';

assert.deepEqual(WARP_POINT_SELECTION_SHAPES, ['rectangle', 'circle', 'polyline']);

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

const circle = normalizeWarpPointSelectionCircle({ x: 10, y: 10 }, { x: 20, y: 10 });
assert.deepEqual(circle, { type: 'circle', cx: 10, cy: 10, radius: 10 });
assert.deepEqual(findWarpPointIndicesInCircle(points, circle), [0]);
assert.deepEqual(findWarpPointIndicesInShape(points, circle), [0]);
assert.deepEqual(findWarpPointIndicesInCircle([
    { x: 20, y: 10 },
    { x: 20.001, y: 10 }
], circle), [0]);
assert.equal(normalizeWarpPointSelectionCircle({ x: 0, y: NaN }, { x: 1, y: 1 }), null);

const polyline = normalizeWarpPointSelectionPolyline([
    { x: 0, y: 0 },
    { x: 0.5, y: 0.5 },
    { x: 24, y: 0 },
    { x: 24, y: 30 },
    { x: 0, y: 30 },
    { x: NaN, y: 4 }
]);
assert.deepEqual(polyline, {
    type: 'polyline',
    points: [{ x: 0, y: 0 }, { x: 24, y: 0 }, { x: 24, y: 30 }, { x: 0, y: 30 }]
});
assert.deepEqual(findWarpPointIndicesInPolyline(points, polyline), [0, 4]);
assert.deepEqual(findWarpPointIndicesInShape(points, polyline), [0, 4]);
assert.deepEqual(findWarpPointIndicesInPolyline([
    { x: 12, y: 0 },
    { x: 12, y: 15 },
    { x: 25, y: 15 }
], {
    type: 'polyline',
    points: [...polyline.points].reverse()
}), [0, 1]);
assert.deepEqual(findWarpPointIndicesInPolyline(points, {
    type: 'polyline',
    points: [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }]
}), []);
assert.equal(normalizeWarpPointSelectionPolyline(null), null);
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

console.log('verify-warp-point-selection: RECT/CIRCLE/POLYLINE hit, replace/toggle, finite filtering, translation OK');
