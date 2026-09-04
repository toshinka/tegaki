import assert from 'node:assert/strict';

import {
    createRadialControlMeshDeformer,
    normalizeControlMeshDeformer
} from '../system/animation/control-mesh-deformer.js';
import { createControlMeshRenderData } from '../system/animation/control-mesh-rasterizer.js';
import {
    CONTROL_MESH_MAX_POINTS,
    createFreeControlMesh,
    createRadialControlMeshPreset,
    createRectControlMeshPreset
} from '../system/animation/control-mesh-topology.js';

const EPSILON = 1e-10;
const closeTo = (actual, expected, message) => {
    assert.ok(Math.abs(actual - expected) <= EPSILON, `${message}: ${actual} !== ${expected}`);
};
const signedAreaDouble = (a, b, c) => (
    (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
);

const fixtures = [
    { segments: 8, rings: 1 },
    { segments: 8, rings: 2 },
    { segments: 16, rings: 4 },
    { segments: 32, rings: 4 },
    { segments: 64, rings: 3 }
];

for (const fixture of fixtures) {
    const topology = createRadialControlMeshPreset(fixture);
    assert.ok(topology, `${fixture.segments}x${fixture.rings} RADIAL is valid`);
    assert.deepEqual(
        topology,
        createRadialControlMeshPreset(fixture),
        'same input is deterministic'
    );
    assert.equal(topology.columns, null, 'RADIAL does not pretend to be rect columns');
    assert.equal(topology.rows, null, 'RADIAL does not pretend to be rect rows');
    assert.equal(topology.points.length, 1 + fixture.segments * fixture.rings, 'point count');
    assert.equal(
        topology.triangles.length,
        fixture.segments * (2 * fixture.rings - 1),
        'triangle count'
    );
    assert.deepEqual(topology.points[0], { x: 0.5, y: 0.5 }, 'center point');

    const seenPoints = new Set();
    topology.points.forEach((point, index) => {
        assert.ok(Number.isFinite(point.x) && Number.isFinite(point.y), `finite point ${index}`);
        const key = `${point.x.toPrecision(15)}:${point.y.toPrecision(15)}`;
        assert.ok(!seenPoints.has(key), `unique point ${index}`);
        seenPoints.add(key);
    });
    for (let ring = 1; ring <= fixture.rings; ring++) {
        const expectedRadius = 0.5 * ring / fixture.rings;
        for (let segment = 0; segment < fixture.segments; segment++) {
            const index = 1 + (ring - 1) * fixture.segments + segment;
            const point = topology.points[index];
            closeTo(
                Math.hypot(point.x - 0.5, point.y - 0.5),
                expectedRadius,
                `ring radius ${ring}:${segment}`
            );
        }
    }
    closeTo(topology.points[1].x, 0.5, 'first point starts at top x');
    closeTo(topology.points[1].y, 0.5 - 0.5 / fixture.rings, 'first point starts at top y');

    const referenced = new Set();
    const triangleKeys = new Set();
    topology.triangles.forEach((triangle, index) => {
        assert.equal(triangle.length, 3, `triangle length ${index}`);
        assert.equal(new Set(triangle).size, 3, `triangle unique indices ${index}`);
        triangle.forEach(pointIndex => {
            assert.ok(Number.isInteger(pointIndex), `triangle integer ${index}`);
            assert.ok(pointIndex >= 0 && pointIndex < topology.points.length, `triangle range ${index}`);
            referenced.add(pointIndex);
        });
        const canonical = [...triangle].sort((left, right) => left - right).join(':');
        assert.ok(!triangleKeys.has(canonical), `triangle not duplicated ${index}`);
        triangleKeys.add(canonical);
        assert.ok(
            signedAreaDouble(...triangle.map(pointIndex => topology.points[pointIndex])) > EPSILON,
            `triangle winding and area ${index}`
        );
    });
    assert.equal(referenced.size, topology.points.length, 'every point is referenced');

    const deformer = normalizeControlMeshDeformer({
        type: 'control-mesh',
        version: 1,
        columns: null,
        rows: null,
        bindBounds: { x: -20, y: 12, width: 240, height: 80 },
        bindPoints: topology.points,
        triangles: topology.triangles,
        points: topology.points,
        keyframes: []
    });
    assert.ok(deformer, 'existing Control Mesh schema accepts RADIAL points / triangles');
    assert.deepEqual(deformer.triangles, topology.triangles, 'explicit triangle order is preserved');
    const renderData = createControlMeshRenderData(
        deformer,
        { x: -20, y: 12, width: 240, height: 80 }
    );
    assert.ok(renderData, 'existing Pixi adapter accepts RADIAL topology');
    assert.equal(renderData.positions.length, topology.points.length * 2, 'render position count');
    assert.equal(renderData.indices.length, topology.triangles.length * 3, 'render index count');
    const factoryDeformer = createRadialControlMeshDeformer({
        ...fixture,
        bindBounds: { x: -20, y: 12, width: 240, height: 80 }
    });
    assert.ok(factoryDeformer, 'RADIAL factory creates existing Control Mesh shape');
    assert.deepEqual(factoryDeformer.bindPoints, topology.points, 'factory preserves generated points');
    assert.deepEqual(factoryDeformer.triangles, topology.triangles, 'factory preserves generated triangles');
}

assert.equal(createRadialControlMeshPreset({ segments: 7, rings: 1 }), null, 'segments minimum');
assert.equal(createRadialControlMeshPreset({ segments: 65, rings: 1 }), null, 'segments maximum');
assert.equal(createRadialControlMeshPreset({ segments: 8, rings: 0 }), null, 'rings minimum');
assert.equal(createRadialControlMeshPreset({ segments: 8, rings: 17 }), null, 'rings maximum');
assert.equal(createRadialControlMeshPreset({ segments: 8.5, rings: 2 }), null, 'segments integer');
assert.equal(createRadialControlMeshPreset({ segments: 8, rings: 2.5 }), null, 'rings integer');
assert.equal(createRadialControlMeshPreset({ segments: 64, rings: 4 }), null, 'point limit');
assert.equal(1 + 64 * 3 <= CONTROL_MESH_MAX_POINTS, true, 'largest fixture is within point limit');

assert.deepEqual(createRectControlMeshPreset({ columns: 2, rows: 2 }), {
    columns: 2,
    rows: 2,
    points: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 0, y: 1 },
        { x: 1, y: 1 }
    ],
    triangles: [[0, 1, 3], [0, 3, 2]]
}, 'RECT output remains unchanged');
assert.deepEqual(createFreeControlMesh([
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 0, y: 1 }
]), {
    columns: null,
    rows: null,
    points: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }],
    triangles: [[0, 1, 2]]
}, 'free Delaunay output remains unchanged');

console.log('verify-radial-control-mesh-topology: deterministic rings, winding, limits, schema, Pixi adapter, RECT/free compatibility OK');
