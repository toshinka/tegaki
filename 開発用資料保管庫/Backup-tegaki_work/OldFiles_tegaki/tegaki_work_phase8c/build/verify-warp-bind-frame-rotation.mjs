import assert from 'node:assert/strict';

import {
    createRectControlMeshDeformer,
    normalizeControlMeshDeformer,
    rebaseControlMeshBind
} from '../system/animation/control-mesh-deformer.js';
import {
    createWarpGridDeformer,
    normalizeWarpGridDeformer,
    rebaseWarpGridBind
} from '../system/animation/warp-grid-deformer.js';
import { applyWarpPlacementToPoints } from '../system/animation/warp-placement.js';

const EPSILON = 1e-8;
const closeTo = (actual, expected, message) => {
    assert.ok(Math.abs(actual - expected) <= EPSILON, `${message}: ${actual} !== ${expected}`);
};
const pointToProject = (point, bounds) => ({
    x: bounds.x + point.x * bounds.width,
    y: bounds.y + point.y * bounds.height
});
const projectPoints = (points, bounds) => points.map(point => pointToProject(point, bounds));
const distance = (left, right) => Math.hypot(left.x - right.x, left.y - right.y);
const dot = (left, right, pivot) => (
    (left.x - pivot.x) * (right.x - pivot.x)
    + (left.y - pivot.y) * (right.y - pivot.y)
);
const assertPointsClose = (actual, expected, message) => {
    assert.equal(actual.length, expected.length, `${message}: point count`);
    actual.forEach((point, index) => {
        closeTo(point.x, expected[index].x, `${message} x[${index}]`);
        closeTo(point.y, expected[index].y, `${message} y[${index}]`);
    });
};
const assertProjectGeometryPreserved = (before, after, message) => {
    assert.equal(after.length, before.length, `${message}: point count`);
    const beforePivot = before.reduce((result, point) => ({
        x: result.x + point.x / before.length,
        y: result.y + point.y / before.length
    }), { x: 0, y: 0 });
    const afterPivot = after.reduce((result, point) => ({
        x: result.x + point.x / after.length,
        y: result.y + point.y / after.length
    }), { x: 0, y: 0 });
    closeTo(afterPivot.x, beforePivot.x, `${message}: pivot x`);
    closeTo(afterPivot.y, beforePivot.y, `${message}: pivot y`);
    for (let leftIndex = 0; leftIndex < before.length; leftIndex++) {
        closeTo(
            distance(after[leftIndex], afterPivot),
            distance(before[leftIndex], beforePivot),
            `${message}: pivot distance[${leftIndex}]`
        );
        for (let rightIndex = leftIndex + 1; rightIndex < before.length; rightIndex++) {
            closeTo(
                distance(after[leftIndex], after[rightIndex]),
                distance(before[leftIndex], before[rightIndex]),
                `${message}: pair distance[${leftIndex},${rightIndex}]`
            );
            closeTo(
                dot(after[leftIndex], after[rightIndex], afterPivot),
                dot(before[leftIndex], before[rightIndex], beforePivot),
                `${message}: pivot dot[${leftIndex},${rightIndex}]`
            );
        }
    }
};
const offsetPosePoints = (points, bounds, multiplier = 1) => points.map((point, index) => ({
    x: point.x + (((index % 3) - 1) * 4 * multiplier) / bounds.width,
    y: point.y + (((index % 5) - 2) * 3 * multiplier) / bounds.height
}));
const assertPoseOffsetsPreserved = (before, after, bounds, message) => {
    const beforeBind = projectPoints(before.bindPoints, bounds);
    const afterBind = projectPoints(after.bindPoints, bounds);
    const assertOffsets = (beforePoints, afterPoints, label) => {
        const beforeProject = projectPoints(beforePoints, bounds);
        const afterProject = projectPoints(afterPoints, bounds);
        beforeProject.forEach((point, index) => {
            closeTo(
                afterProject[index].x - afterBind[index].x,
                point.x - beforeBind[index].x,
                `${message}: ${label} offset x[${index}]`
            );
            closeTo(
                afterProject[index].y - afterBind[index].y,
                point.y - beforeBind[index].y,
                `${message}: ${label} offset y[${index}]`
            );
        });
    };
    assertOffsets(before.points, after.points, 'static pose');
    before.keyframes.forEach((key, index) => {
        assertOffsets(key.points, after.keyframes[index].points, `key ${key.frame}`);
        assert.deepEqual(after.keyframes[index].placement, key.placement, `${message}: placement preserved`);
    });
};

const boundsFixtures = [
    { x: 0, y: 0, width: 100, height: 100 },
    { x: 0, y: 0, width: 200, height: 80 },
    { x: 0, y: 0, width: 80, height: 200 },
    { x: -35, y: 22, width: 240, height: 96 }
];
const angles = [0, Math.PI / 6, Math.PI / 4, Math.PI / 2, -3 * Math.PI / 4];

for (const bounds of boundsFixtures) {
    const grid = createWarpGridDeformer({ bindBounds: bounds });
    const mesh = createRectControlMeshDeformer({
        columns: 8,
        rows: 8,
        bindBounds: bounds
    });
    assert.ok(grid && mesh, 'GRID and Control Mesh fixtures are valid');

    for (const source of [grid.bindPoints, mesh.bindPoints]) {
        const before = projectPoints(source, bounds);
        for (const angle of angles) {
            const rotated = applyWarpPlacementToPoints(
                source,
                source,
                bounds,
                { x: 0, y: 0, scale: 1, rotation: angle }
            );
            assert.ok(rotated, 'Project-space rotation returns points');
            const after = projectPoints(rotated, bounds);
            assertProjectGeometryPreserved(before, after, `rotation ${angle}`);

            const restored = applyWarpPlacementToPoints(
                rotated,
                source,
                bounds,
                { x: 0, y: 0, scale: 1, rotation: -angle }
            );
            assert.ok(restored, 'inverse Project-space rotation returns points');
            assertPointsClose(restored, source, 'inverse normalized point');
        }

        const firstGesture = applyWarpPlacementToPoints(
            source,
            source,
            bounds,
            { rotation: Math.PI / 6 }
        );
        const secondGesture = applyWarpPlacementToPoints(
            firstGesture,
            firstGesture,
            bounds,
            { rotation: Math.PI / 12 }
        );
        const combinedGesture = applyWarpPlacementToPoints(
            source,
            source,
            bounds,
            { rotation: Math.PI / 4 }
        );
        assertPointsClose(secondGesture, combinedGesture, 'successive gestures equal combined rotation');
    }

    const gridWithPose = normalizeWarpGridDeformer({
        ...grid,
        points: offsetPosePoints(grid.bindPoints, bounds),
        keyframes: [{
            frame: 2,
            interpolation: 'linear',
            points: offsetPosePoints(grid.bindPoints, bounds, -0.5),
            placement: { x: 12, y: -7, scale: 1.1, rotation: 0.2 }
        }]
    });
    const meshWithPose = normalizeControlMeshDeformer({
        ...mesh,
        points: offsetPosePoints(mesh.bindPoints, bounds),
        keyframes: [{
            frame: 2,
            interpolation: 'linear',
            points: offsetPosePoints(mesh.bindPoints, bounds, -0.5),
            placement: { x: 12, y: -7, scale: 1.1, rotation: 0.2 }
        }]
    });
    const rotatedGridBind = applyWarpPlacementToPoints(
        gridWithPose.bindPoints,
        gridWithPose.bindPoints,
        bounds,
        { rotation: Math.PI / 4 }
    );
    const rotatedMeshBind = applyWarpPlacementToPoints(
        meshWithPose.bindPoints,
        meshWithPose.bindPoints,
        bounds,
        { rotation: Math.PI / 4 }
    );
    const rebasedGrid = rebaseWarpGridBind(gridWithPose, { bindPoints: rotatedGridBind });
    const rebasedMesh = rebaseControlMeshBind(meshWithPose, { bindPoints: rotatedMeshBind });
    assert.ok(rebasedGrid && rebasedMesh, 'GRID and Control Mesh rebase succeed');
    assertPoseOffsetsPreserved(gridWithPose, rebasedGrid, bounds, 'GRID rebase');
    assertPoseOffsetsPreserved(meshWithPose, rebasedMesh, bounds, 'Control Mesh rebase');
}

// 200x80の旧normalized-space回転は、45度でProject上の辺長を変えてしまう。
const nonSquare = boundsFixtures[1];
const base = createWarpGridDeformer({ bindBounds: nonSquare });
const normalizedAngle = Math.PI / 4;
const normalizedCenter = base.bindPoints.reduce((result, point) => ({
    x: result.x + point.x / base.bindPoints.length,
    y: result.y + point.y / base.bindPoints.length
}), { x: 0, y: 0 });
const oldNormalizedRotation = base.bindPoints.map(point => ({
    x: normalizedCenter.x
        + (point.x - normalizedCenter.x) * Math.cos(normalizedAngle)
        - (point.y - normalizedCenter.y) * Math.sin(normalizedAngle),
    y: normalizedCenter.y
        + (point.x - normalizedCenter.x) * Math.sin(normalizedAngle)
        + (point.y - normalizedCenter.y) * Math.cos(normalizedAngle)
}));
const oldProject = projectPoints(oldNormalizedRotation, nonSquare);
const oldEdge = distance(oldProject[0], oldProject[1]);
const newProject = projectPoints(
    applyWarpPlacementToPoints(base.bindPoints, base.bindPoints, nonSquare, {
        x: 0,
        y: 0,
        scale: 1,
        rotation: normalizedAngle
    }),
    nonSquare
);
assert.ok(Math.abs(oldEdge - distance(projectPoints(base.bindPoints, nonSquare)[0], projectPoints(base.bindPoints, nonSquare)[1])) > 1);
closeTo(distance(newProject[0], newProject[1]), distance(projectPoints(base.bindPoints, nonSquare)[0], projectPoints(base.bindPoints, nonSquare)[1]), 'non-square corrected edge');

console.log('verify-warp-bind-frame-rotation: Project-space GRID/8x8 Control Mesh geometry, repeated gesture, inverse, and Pose rebase OK');
