import assert from 'node:assert/strict';

import {
    createRectControlMeshDeformer,
    createFreeControlMeshDeformer,
    normalizeControlMeshDeformer,
    rebaseControlMeshBind
} from '../system/animation/control-mesh-deformer.js';
import {
    WARP_BIND_FRAME_MODE_CORNER,
    WARP_BIND_FRAME_MODE_EDGE,
    transformWarpBindFramePoints
} from '../system/animation/warp-bind-frame-transform.js';
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
const projectPoint = (point, bounds) => ({
    x: bounds.x + point.x * bounds.width,
    y: bounds.y + point.y * bounds.height
});
const assertPointsClose = (actual, expected, message) => {
    assert.equal(actual.length, expected.length, `${message}: point count`);
    actual.forEach((point, index) => {
        closeTo(point.x, expected[index].x, `${message}: x[${index}]`);
        closeTo(point.y, expected[index].y, `${message}: y[${index}]`);
    });
};
const topologyWeight = (mode, handleIndex, u, v) => {
    if (mode === WARP_BIND_FRAME_MODE_CORNER) {
        return [
            (1 - u) * (1 - v),
            u * (1 - v),
            u * v,
            (1 - u) * v
        ][handleIndex];
    }
    return [1 - v, u, v, 1 - u][handleIndex];
};
const assertWeightedProjectDelta = (before, after, bounds, columns, rows, mode, handleIndex, delta, message) => {
    before.forEach((point, index) => {
        const u = (index % columns) / (columns - 1);
        const v = Math.floor(index / columns) / (rows - 1);
        const weight = topologyWeight(mode, handleIndex, u, v);
        const beforeProject = projectPoint(point, bounds);
        const afterProject = projectPoint(after[index], bounds);
        closeTo(afterProject.x, beforeProject.x + delta.x * weight, `${message}: project x[${index}]`);
        closeTo(afterProject.y, beforeProject.y + delta.y * weight, `${message}: project y[${index}]`);
    });
};
const offsetPosePoints = (points, bounds, multiplier = 1) => points.map((point, index) => ({
    x: point.x + (((index % 3) - 1) * 5 * multiplier) / bounds.width,
    y: point.y + (((index % 5) - 2) * 4 * multiplier) / bounds.height
}));
const assertPoseOffsetsPreserved = (before, after, bounds, message) => {
    const beforeBind = before.bindPoints.map(point => projectPoint(point, bounds));
    const afterBind = after.bindPoints.map(point => projectPoint(point, bounds));
    const assertOffsets = (beforePoints, afterPoints, label) => {
        beforePoints.forEach((point, index) => {
            const beforeProject = projectPoint(point, bounds);
            const afterProject = projectPoint(afterPoints[index], bounds);
            closeTo(
                afterProject.x - afterBind[index].x,
                beforeProject.x - beforeBind[index].x,
                `${message}: ${label} x[${index}]`
            );
            closeTo(
                afterProject.y - afterBind[index].y,
                beforeProject.y - beforeBind[index].y,
                `${message}: ${label} y[${index}]`
            );
        });
    };
    assertOffsets(before.points, after.points, 'static pose');
    before.keyframes.forEach((key, index) => {
        assertOffsets(key.points, after.keyframes[index].points, `key ${key.frame}`);
        assert.deepEqual(after.keyframes[index].placement, key.placement, `${message}: placement`);
    });
};

const boundsFixtures = [
    { x: 0, y: 0, width: 100, height: 100 },
    { x: 0, y: 0, width: 240, height: 80 },
    { x: 0, y: 0, width: 80, height: 240 },
    { x: -35, y: 22, width: 192, height: 96 }
];
const angleFixtures = [0, Math.PI / 4, Math.PI / 2];
const delta = { x: 24, y: -12 };

for (const bounds of boundsFixtures) {
    const fixtures = [
        createWarpGridDeformer({ bindBounds: bounds }),
        createRectControlMeshDeformer({ columns: 2, rows: 2, bindBounds: bounds }),
        createRectControlMeshDeformer({ columns: 8, rows: 8, bindBounds: bounds })
    ];
    for (const fixture of fixtures) {
        assert.ok(fixture, 'rect GRID fixture is valid');
        const { columns, rows } = fixture;
        for (const angle of angleFixtures) {
            const source = applyWarpPlacementToPoints(
                fixture.bindPoints,
                fixture.bindPoints,
                bounds,
                { rotation: angle }
            );
            assert.ok(source, 'rotated Bind fixture is valid');
            for (const mode of [WARP_BIND_FRAME_MODE_CORNER, WARP_BIND_FRAME_MODE_EDGE]) {
                for (let handleIndex = 0; handleIndex < 4; handleIndex++) {
                    const original = structuredClone(source);
                    const transformed = transformWarpBindFramePoints({
                        bindPoints: source,
                        bindBounds: bounds,
                        columns,
                        rows,
                        mode,
                        handleIndex,
                        delta
                    });
                    assert.ok(transformed, `${mode} transform succeeds`);
                    assert.deepEqual(source, original, `${mode} does not mutate input`);
                    assertWeightedProjectDelta(
                        source,
                        transformed,
                        bounds,
                        columns,
                        rows,
                        mode,
                        handleIndex,
                        delta,
                        `${columns}x${rows} ${angle} ${mode} ${handleIndex}`
                    );

                    const restored = transformWarpBindFramePoints({
                        bindPoints: transformed,
                        bindBounds: bounds,
                        columns,
                        rows,
                        mode,
                        handleIndex,
                        delta: { x: -delta.x, y: -delta.y }
                    });
                    assertPointsClose(restored, source, `${mode} inverse`);

                    const first = transformWarpBindFramePoints({
                        bindPoints: source,
                        bindBounds: bounds,
                        columns,
                        rows,
                        mode,
                        handleIndex,
                        delta: { x: 7, y: -3 }
                    });
                    const second = transformWarpBindFramePoints({
                        bindPoints: first,
                        bindBounds: bounds,
                        columns,
                        rows,
                        mode,
                        handleIndex,
                        delta: { x: 5, y: 9 }
                    });
                    const combined = transformWarpBindFramePoints({
                        bindPoints: source,
                        bindBounds: bounds,
                        columns,
                        rows,
                        mode,
                        handleIndex,
                        delta: { x: 12, y: 6 }
                    });
                    assertPointsClose(second, combined, `${mode} successive gesture`);
                }
            }
        }
    }

    const grid = createWarpGridDeformer({ bindBounds: bounds });
    const mesh = createRectControlMeshDeformer({ columns: 8, rows: 8, bindBounds: bounds });
    const rotatedGridBind = applyWarpPlacementToPoints(
        grid.bindPoints,
        grid.bindPoints,
        bounds,
        { rotation: Math.PI / 4 }
    );
    const rotatedMeshBind = applyWarpPlacementToPoints(
        mesh.bindPoints,
        mesh.bindPoints,
        bounds,
        { rotation: Math.PI / 4 }
    );
    const rebasedFixtures = [
        {
            value: normalizeWarpGridDeformer({
                ...grid,
                bindPoints: rotatedGridBind,
                points: offsetPosePoints(rotatedGridBind, bounds),
                keyframes: [{
                    frame: 2,
                    interpolation: 'linear',
                    points: offsetPosePoints(rotatedGridBind, bounds, -0.5),
                    placement: { x: 12, y: -7, scale: 1.1, rotation: 0.2 }
                }]
            }),
            rebase: rebaseWarpGridBind
        },
        {
            value: normalizeControlMeshDeformer({
                ...mesh,
                bindPoints: rotatedMeshBind,
                points: offsetPosePoints(rotatedMeshBind, bounds),
                keyframes: [{
                    frame: 2,
                    interpolation: 'linear',
                    points: offsetPosePoints(rotatedMeshBind, bounds, -0.5),
                    placement: { x: 12, y: -7, scale: 1.1, rotation: 0.2 }
                }]
            }),
            rebase: rebaseControlMeshBind
        }
    ];
    for (const { value, rebase } of rebasedFixtures) {
        const nextBindPoints = transformWarpBindFramePoints({
            bindPoints: value.bindPoints,
            bindBounds: bounds,
            columns: value.columns,
            rows: value.rows,
            mode: WARP_BIND_FRAME_MODE_EDGE,
            handleIndex: 1,
            delta
        });
        const rebased = rebase(value, { bindPoints: nextBindPoints });
        assert.ok(rebased, 'GRID / Control Mesh rebase succeeds');
        assertPoseOffsetsPreserved(value, rebased, bounds, `${value.type} rebase`);
    }
}

const valid = createWarpGridDeformer({ bindBounds: boundsFixtures[0] });
const invalidCases = [
    {},
    { bindPoints: valid.bindPoints, bindBounds: valid.bindBounds, columns: 4, rows: 3 },
    { bindPoints: valid.bindPoints, bindBounds: valid.bindBounds, columns: 1, rows: 16 },
    { bindPoints: valid.bindPoints, bindBounds: { width: 0, height: 100 }, columns: 4, rows: 4 },
    { bindPoints: valid.bindPoints, bindBounds: valid.bindBounds, columns: 4, rows: 4, mode: 'frame', handleIndex: 0, delta },
    { bindPoints: valid.bindPoints, bindBounds: valid.bindBounds, columns: 4, rows: 4, mode: WARP_BIND_FRAME_MODE_EDGE, handleIndex: 4, delta },
    { bindPoints: valid.bindPoints, bindBounds: valid.bindBounds, columns: 4, rows: 4, mode: WARP_BIND_FRAME_MODE_EDGE, handleIndex: 0, delta: { x: NaN, y: 0 } },
    { bindPoints: valid.bindPoints.map((point, index) => index === 3 ? { x: NaN, y: point.y } : point), bindBounds: valid.bindBounds, columns: 4, rows: 4, mode: WARP_BIND_FRAME_MODE_EDGE, handleIndex: 0, delta }
];
invalidCases.forEach((options, index) => {
    assert.equal(transformWarpBindFramePoints(options), null, `invalid case ${index}`);
});

const freeMesh = createFreeControlMeshDeformer({
    bindBounds: boundsFixtures[0],
    points: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0.5, y: 1 }]
});
assert.ok(freeMesh, 'free Control Mesh fixture is valid');
assert.equal(transformWarpBindFramePoints({
    bindPoints: freeMesh.bindPoints,
    bindBounds: freeMesh.bindBounds,
    columns: freeMesh.columns,
    rows: freeMesh.rows,
    mode: WARP_BIND_FRAME_MODE_CORNER,
    handleIndex: 0,
    delta
}), null, 'free Control Mesh is explicitly rejected');

console.log('verify-warp-bind-frame-transform: Project-space CORNER/EDGE weights, inverse, repeated gesture, rebase, and rejection gates OK');
