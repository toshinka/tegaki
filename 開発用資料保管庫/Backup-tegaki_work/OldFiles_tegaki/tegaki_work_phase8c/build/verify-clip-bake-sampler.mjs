import assert from 'node:assert/strict';
import { sampleClipBakeState } from '../system/animation/clip-bake-sampler.js';
import { sampleClipTransform } from '../system/animation/clip-transform-sampler.js';
import { sampleClipDeformer } from '../system/animation/clip-deformer.js';
import { createWarpGridDeformer } from '../system/animation/warp-grid-deformer.js';
import { createRectControlMeshDeformer } from '../system/animation/control-mesh-deformer.js';

function assertPointsClose(actual, expected, epsilon = 1e-9) {
    assert.equal(actual.length, expected.length);
    actual.forEach((point, index) => {
        assert.ok(Math.abs(point.x - expected[index].x) <= epsilon, `point ${index} x`);
        assert.ok(Math.abs(point.y - expected[index].y) <= epsilon, `point ${index} y`);
    });
}

function assertPlacementClose(actual, expected, epsilon = 1e-9) {
    ['x', 'y', 'scale', 'rotation'].forEach(parameter => {
        assert.ok(Math.abs(actual[parameter] - expected[parameter]) <= epsilon, `placement ${parameter}`);
    });
}

const motionClip = {
    startFrame: 10,
    duration: 5,
    transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 },
    transformKeyframes: [
        { frame: 0, x: 4, y: -2, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 },
        { frame: 4, x: 20, y: 6, scaleX: 2, scaleY: 0.5, rotation: 1, opacity: 0.5 }
    ]
};
const sampledMotion = sampleClipBakeState(motionClip, 12);
assert.deepEqual(sampledMotion.transform, sampleClipTransform(motionClip, 12));
assert.deepEqual(sampledMotion.transformKeyframes, []);
assert.equal(sampledMotion.deformer, null);
assert.deepEqual(sampleClipTransform({
    startFrame: 0,
    duration: 1,
    transform: sampledMotion.transform,
    transformKeyframes: sampledMotion.transformKeyframes
}, 0), sampledMotion.transform);

const warp = createWarpGridDeformer({
    bindBounds: { x: 20, y: 30, width: 160, height: 120 }
});
const displacedWarpPoints = warp.points.map((point, index) => ({
    x: point.x + (index % 4) * 0.03,
    y: point.y - Math.floor(index / 4) * 0.02
}));
warp.keyframes = [
    {
        frame: 0,
        interpolation: 'linear',
        points: warp.points,
        placement: { x: 5, y: -4, scale: 1, rotation: 0 }
    },
    {
        frame: 4,
        interpolation: 'linear',
        points: displacedWarpPoints,
        placement: { x: 25, y: 8, scale: 1.5, rotation: 0.4 }
    }
];
const warpClip = { startFrame: 3, duration: 5, transform: {}, deformer: warp };
const originalWarpSample = sampleClipDeformer(warp, 2, 5);
const frozenWarp = sampleClipBakeState(warpClip, 5);
const frozenWarpSample = sampleClipDeformer(frozenWarp.deformer, 0, 1);
assertPointsClose(frozenWarpSample.points, originalWarpSample.points);
assertPlacementClose(frozenWarpSample.placement, originalWarpSample.placement);
assert.equal(frozenWarp.deformer.keyframes.length, 1);
assert.equal(frozenWarp.deformer.keyframes[0].frame, 0);

const mesh = createRectControlMeshDeformer({
    columns: 3,
    rows: 3,
    bindBounds: { x: -10, y: 12, width: 90, height: 70 }
});
const displacedMeshPoints = mesh.points.map((point, index) => ({
    x: point.x + (index % 3 === 1 ? 0.12 : 0),
    y: point.y + (Math.floor(index / 3) === 1 ? -0.08 : 0)
}));
mesh.keyframes = [
    { frame: 0, interpolation: 'linear', points: mesh.points },
    {
        frame: 2,
        interpolation: 'hold',
        points: displacedMeshPoints,
        placement: { x: -7, y: 9, scale: 0.8, rotation: -0.25 }
    }
];
const meshClip = { startFrame: 20, duration: 3, transform: {}, deformer: mesh };
const originalMeshSample = sampleClipDeformer(mesh, 2, 3);
const frozenMesh = sampleClipBakeState(meshClip, 22);
const frozenMeshSample = sampleClipDeformer(frozenMesh.deformer, 0, 1);
assertPointsClose(frozenMeshSample.points, originalMeshSample.points);
assertPlacementClose(frozenMeshSample.placement, originalMeshSample.placement);
assert.deepEqual(frozenMeshSample.triangles, originalMeshSample.triangles);

console.log('verify-clip-bake-sampler: Motion, Warp GRID placement, Control Mesh static sampling OK');
