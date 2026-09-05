import assert from 'node:assert/strict';

import { createRectControlMeshDeformer } from '../system/animation/control-mesh-deformer.js';
import { createControlMeshRenderData } from '../system/animation/control-mesh-rasterizer.js';
import { createWarpGridDeformer } from '../system/animation/warp-grid-deformer.js';
import { createWarpGridMeshData } from '../system/animation/warp-grid-rasterizer.js';
import { resolveWarpPlacementSample } from '../system/animation/warp-placement.js';

const sourceBounds = { x: -3, y: 4, width: 12, height: 10 };
const textureBounds = { x: -8, y: 0, width: 28, height: 22 };
const toProject = (point, bounds) => ({
    x: bounds.x + point.x * bounds.width,
    y: bounds.y + point.y * bounds.height
});
const array = value => [...value];
const closeTo = (actual, expected, message) => {
    assert.ok(Math.abs(actual - expected) <= 1e-6, `${message}: ${actual} !== ${expected}`);
};

const base = createWarpGridDeformer({ bindBounds: sourceBounds });
const identityMesh = createWarpGridMeshData(base, sourceBounds, textureBounds);
const resolvedIdentity = resolveWarpPlacementSample(base, sourceBounds);
const resolvedIdentityMesh = createWarpGridMeshData(resolvedIdentity, sourceBounds, textureBounds);
assert.deepEqual(array(resolvedIdentityMesh.positions), array(identityMesh.positions));
assert.deepEqual(array(resolvedIdentityMesh.uvs), array(identityMesh.uvs));
assert.deepEqual(array(resolvedIdentityMesh.indices), array(identityMesh.indices));

const posePoints = base.points.map(point => ({ ...point }));
posePoints[5].x += 0.18;
posePoints[6].y += 0.12;
posePoints[9].y -= 0.09;
posePoints[10].x -= 0.14;
const placement = { x: 5, y: -2, scale: 0.8, rotation: Math.PI / 7 };
const resolved = resolveWarpPlacementSample({
    ...base,
    points: posePoints,
    placement
}, sourceBounds);
const mesh = createWarpGridMeshData(resolved, sourceBounds, textureBounds);

resolved.points.map(point => toProject(point, sourceBounds)).forEach((point, index) => {
    closeTo(mesh.positions[index * 2], point.x, `destination x ${index}`);
    closeTo(mesh.positions[index * 2 + 1], point.y, `destination y ${index}`);
});
resolved.bindPoints.map(point => toProject(point, sourceBounds)).forEach((point, index) => {
    closeTo(
        textureBounds.x + mesh.uvs[index * 2] * textureBounds.width,
        point.x,
        `source UV x ${index}`
    );
    closeTo(
        textureBounds.y + mesh.uvs[index * 2 + 1] * textureBounds.height,
        point.y,
        `source UV y ${index}`
    );
});

const movedIdentity = resolveWarpPlacementSample({
    ...base,
    placement
}, sourceBounds);
assert.deepEqual(movedIdentity.bindPoints, movedIdentity.points);

const control = createRectControlMeshDeformer({
    columns: 4,
    rows: 4,
    bindBounds: sourceBounds
});
const resolvedControl = resolveWarpPlacementSample({
    ...control,
    points: posePoints,
    placement
}, sourceBounds);
const controlMesh = createControlMeshRenderData(resolvedControl, sourceBounds, textureBounds);
assert.deepEqual(array(controlMesh.positions), array(mesh.positions));
assert.deepEqual(array(controlMesh.uvs), array(mesh.uvs));
assert.deepEqual(array(controlMesh.indices), array(mesh.indices));

console.log('verify-warp-placement-preview: identity/source-uv/erase-bind/destination/control-mesh OK');
