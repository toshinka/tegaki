import assert from 'node:assert/strict';

import { createRectControlMeshDeformer } from '../system/animation/control-mesh-deformer.js';
import { createRectGridTopology } from '../system/animation/warp-grid-topology.js';
import {
    applyWarpPlacementToPoints,
    resolveWarpPlacementGeometry
} from '../system/animation/warp-placement.js';
import { warpRgbaWithTriangles } from '../system/animation/warp-grid-rasterizer.js';
import {
    mapWarpBindPointToPose,
    TRIANGLE_EPSILON
} from '../system/animation/warp-triangle-point-map.js';

const bounds = { x: 10, y: 20, width: 100, height: 80 };
const bindPoints = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: 1 }
];
const triangles = [[0, 1, 2], [0, 2, 3]];

const project = point => ({
    x: bounds.x + point.x * bounds.width,
    y: bounds.y + point.y * bounds.height
});
const normalized = point => ({
    x: (point.x - bounds.x) / bounds.width,
    y: (point.y - bounds.y) / bounds.height
});
const closeTo = (actual, expected, message) => {
    assert.ok(Math.abs(actual - expected) <= 1e-9, `${message}: ${actual} !== ${expected}`);
};
const assertPointClose = (actual, expected, message) => {
    closeTo(actual.x, expected.x, `${message}.x`);
    closeTo(actual.y, expected.y, `${message}.y`);
};

const identity = mapWarpBindPointToPose({
    point: { x: 35, y: 40 },
    bindBounds: bounds,
    bindPoints,
    points: bindPoints,
    triangles
});
assert.equal(identity.ok, true);
assert.equal(identity.triangleIndex, 0);
assert.deepEqual(identity.indices, [0, 1, 2]);
assertPointClose(identity.point, { x: 35, y: 40 }, 'identity');

// 一点を動かしたPoseへ、Bind側weightsをそのまま適用する。
const movedPoints = bindPoints.map(point => ({ ...point }));
movedPoints[2] = { x: 1.2, y: 1.1 };
const moved = mapWarpBindPointToPose({
    point: { x: 35, y: 40 },
    bindBounds: bounds,
    bindPoints,
    points: movedPoints,
    triangles
});
assert.equal(moved.ok, true);
assertPointClose(moved.point, { x: 40, y: 42 }, 'single pose point');

// 二つ目のtriangleでも、複数Pose点の重みが決定的に適用される。
const multiplePoints = bindPoints.map(point => ({ ...point }));
multiplePoints[0] = { x: -0.1, y: 0.1 };
multiplePoints[2] = { x: 1.1, y: 0.9 };
multiplePoints[3] = { x: -0.2, y: 1.2 };
const multiple = mapWarpBindPointToPose({
    point: { x: 25, y: 80 },
    bindBounds: bounds,
    bindPoints,
    points: multiplePoints,
    triangles
});
assert.equal(multiple.ok, true);
assert.equal(multiple.triangleIndex, 1);
assertPointClose(multiple.point, { x: 12, y: 90.4 }, 'multiple pose points');

// vertex / shared edgeは保存順で先頭triangleを採用し、反復しても変わらない。
const vertex = mapWarpBindPointToPose({
    point: project(bindPoints[0]), bindBounds: bounds, bindPoints, points: bindPoints, triangles
});
const sharedEdge = mapWarpBindPointToPose({
    point: { x: 60, y: 60 }, bindBounds: bounds, bindPoints, points: bindPoints, triangles
});
const sharedEdgeAgain = mapWarpBindPointToPose({
    point: { x: 60, y: 60 }, bindBounds: bounds, bindPoints, points: bindPoints, triangles
});
assert.equal(vertex.triangleIndex, 0);
assert.equal(sharedEdge.triangleIndex, 0);
assert.deepEqual(sharedEdge, sharedEdgeAgain);

assert.deepEqual(mapWarpBindPointToPose({
    point: { x: 200, y: 200 }, bindBounds: bounds, bindPoints, points: bindPoints, triangles
}), { ok: false, reason: 'outside' });
assert.deepEqual(mapWarpBindPointToPose({
    point: { x: 35, y: 40 }, bindBounds: bounds, bindPoints, points: bindPoints,
    triangles: [[0, 1, 9]]
}), { ok: false, reason: 'invalid-topology' });
assert.deepEqual(mapWarpBindPointToPose({
    point: { x: 35, y: 40 }, bindBounds: bounds,
    bindPoints: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }],
    points: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }],
    triangles: [[0, 1, 2]]
}), { ok: false, reason: 'degenerate' });
assert.deepEqual(mapWarpBindPointToPose({
    point: { x: Number.NaN, y: 40 }, bindBounds: bounds, bindPoints, points: bindPoints, triangles
}), { ok: false, reason: 'non-finite' });

// placementはBind入力、Bind geometry、Pose geometryへ同じaffineを消費する。
const placement = { x: 12, y: -7, scale: 1.25, rotation: Math.PI / 6 };
const placedPoint = applyWarpPlacementToPoints(
    [normalized({ x: 35, y: 40 })], bindPoints, bounds, placement
)[0];
const placed = mapWarpBindPointToPose({
    point: { x: 35, y: 40 }, bindBounds: bounds, bindPoints, points: bindPoints, triangles, placement
});
assert.equal(placed.ok, true);
assertPointClose(placed.point, project(placedPoint), 'placement');
const placedGeometry = resolveWarpPlacementGeometry(bindPoints, bindPoints, bounds, placement);
assert.ok(placedGeometry);
assert.notDeepEqual(placedGeometry.bindPoints, bindPoints);

// fixed GRID topologyをそのまま渡し、別topologyやnearest fallbackを使わない。
const grid = createRectGridTopology({ columns: 4, rows: 4 });
const fixed = mapWarpBindPointToPose({
    point: { x: 42, y: 61 },
    bindBounds: bounds,
    bindPoints: grid.points,
    points: grid.points,
    triangles: grid.triangles
});
assert.equal(fixed.ok, true);
assert.equal(fixed.triangleIndex, 6);

// Control Meshも保存済みtrianglesをそのまま使用する。
const control = createRectControlMeshDeformer({ columns: 3, rows: 3, bindBounds: bounds });
const controlMapped = mapWarpBindPointToPose({
    point: { x: 42, y: 61 },
    bindBounds: control.bindBounds,
    bindPoints: control.bindPoints,
    points: control.points,
    triangles: control.triangles
});
assert.equal(controlMapped.ok, true);

// Raster fixtureと同じtriangle / placement入力で、共有barycentric helperを通るidentityを固定する。
const rasterWidth = 4;
const rasterHeight = 4;
const pixels = new Uint8ClampedArray(rasterWidth * rasterHeight * 4);
for (let offset = 0; offset < pixels.length; offset += 4) {
    pixels[offset] = 42;
    pixels[offset + 1] = 84;
    pixels[offset + 2] = 126;
    pixels[offset + 3] = 255;
}
const raster = warpRgbaWithTriangles({
    pixels,
    width: rasterWidth,
    height: rasterHeight,
    sourceBounds: { x: 0, y: 0, width: rasterWidth, height: rasterHeight },
    deformer: {
        bindBounds: { x: 0, y: 0, width: rasterWidth, height: rasterHeight },
        bindPoints,
        points: bindPoints
    },
    triangles,
    maxAxis: 64,
    maxPixels: 64 * 64
});
assert.deepEqual(raster.bounds, { x: 0, y: 0, width: rasterWidth, height: rasterHeight });
assert.deepEqual(raster.pixels, pixels);
assert.equal(TRIANGLE_EPSILON, 1e-8);

console.log('verify-warp-point-map: identity/pose/tie-break/failure/placement/fixed/control/raster OK');
