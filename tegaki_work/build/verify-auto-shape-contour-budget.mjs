import assert from 'node:assert/strict';

import { prepareAutoShapeContourBudget } from '../system/animation/auto-shape-contour-budget.js';
import { createGuardedAutoShapeFillTopology } from '../system/animation/auto-shape-fill-topology.js';
import { analyzeRasterAlphaContours } from '../system/animation/raster-alpha-contours.js';
import {
    RASTER_MESH_SCHEMA_VERSION,
    validateRasterBoneSkinning
} from '../system/animation/raster-bone-skinning.js';

function makeSnapshot(rows) {
    const height = rows.length;
    const width = rows[0].length;
    const pixels = new Uint8ClampedArray(width * height * 4);
    rows.forEach((row, y) => [...row].forEach((value, x) => {
        if (value === '#') pixels[(y * width + x) * 4 + 3] = 255;
    }));
    return { width, height, pixels, rasterBounds: { x: 0, y: 0, width, height } };
}

function analyze(rows) {
    const result = analyzeRasterAlphaContours(makeSnapshot(rows));
    assert.equal(result.ok, true, result.reason);
    return result;
}

function triangleArea(vertices, triangle) {
    const [a, b, c] = triangle.map(index => vertices[index]);
    return Math.abs((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)) / 2;
}

const jaggedAnalysis = analyze([
    '............',
    '....####....',
    '...######...',
    '..########..',
    '...######...',
    '....####....',
    '............'
]);
assert.equal(jaggedAnalysis.components[0].outerContours[0].points.length, 20);
const jaggedBudget = prepareAutoShapeContourBudget(jaggedAnalysis, {
    maxVertices: 32,
    reservedInteriorVertices: 16,
    maxBoundaryVertices: 8,
    maxAreaError: 0.5,
    guardDistance: 0.5
});
assert.equal(jaggedBudget.ok, true, jaggedBudget.reason);
assert.equal(jaggedBudget.originalBoundaryVertexCount, 20);
assert.equal(jaggedBudget.reducedBoundaryVertexCount, 8);
assert.equal(jaggedBudget.guardVertexCount, 8);
assert.equal(jaggedBudget.availableInteriorVertices, 16);
assert.equal(jaggedBudget.areaError, 0);
assert.equal(jaggedBudget.guardDistance, 0.5);
assert.equal(jaggedBudget.analysis.components[0].outerContours.length, 1);
assert.equal(jaggedBudget.analysis.components[0].holeContours.length, 0);
assert.deepEqual(
    prepareAutoShapeContourBudget(jaggedAnalysis, {
        maxVertices: 32,
        reservedInteriorVertices: 16,
        maxBoundaryVertices: 8,
        maxAreaError: 0.5,
        guardDistance: 0.5
    }),
    jaggedBudget,
    'contour reduction and guard backoff are deterministic'
);

const strictBudget = prepareAutoShapeContourBudget(jaggedAnalysis, {
    maxVertices: 32,
    reservedInteriorVertices: 16,
    maxBoundaryVertices: 8,
    maxAreaError: 0,
    guardDistance: 0.5
});
assert.equal(strictBudget.ok, false);
assert.equal(strictBudget.reason, 'contour-budget-exceeded', 'area-preserving removal refuses unsafe target');

const donutAnalysis = analyze([
    '.......',
    '.#####.',
    '.#...#.',
    '.#...#.',
    '.#...#.',
    '.#####.',
    '.......'
]);
const donutBudget = prepareAutoShapeContourBudget(donutAnalysis, {
    maxVertices: 64,
    reservedInteriorVertices: 16,
    guardDistance: 2,
    minimumGuardDistance: 0.125
});
assert.equal(donutBudget.ok, true, donutBudget.reason);
assert.equal(donutBudget.guardDistance, 1, 'guard distance backs off until outer and hole remain valid');
assert.equal(donutBudget.analysis.components[0].outerContours.length, 1);
assert.equal(donutBudget.analysis.components[0].holeContours.length, 1);
const outerSourceArea = Math.abs(donutBudget.analysis.components[0].outerContours[0].signedArea);
const holeSourceArea = Math.abs(donutBudget.analysis.components[0].holeContours[0].signedArea);
const outerGuard = donutBudget.guardContours.find(contour => contour.kind === 'outer');
const holeGuard = donutBudget.guardContours.find(contour => contour.kind === 'hole');
assert.ok(Math.abs(outerGuard.signedArea) > outerSourceArea, 'outer guard expands into transparent side');
assert.ok(Math.abs(holeGuard.signedArea) < holeSourceArea, 'hole guard contracts into transparent side');

const guarded = createGuardedAutoShapeFillTopology(donutAnalysis, {
    maxVertices: 64,
    reservedInteriorVertices: 16,
    guardDistance: 0.5,
    interiorSpacing: 0.75,
    maxInteriorPoints: 16,
    minimumBarycentricWeight: 0.005
});
assert.equal(guarded.ok, true, guarded.reason);
assert.equal(guarded.mode, 'guarded-interior');
assert.ok(guarded.vertices.length <= 64);
assert.equal(guarded.metrics.expectedArea, 16);
assert.equal(guarded.metrics.totalTriangleArea, 16, 'opaque FILL coverage remains exact');
assert.equal(guarded.metrics.areaError, 0);
assert.equal(guarded.metrics.guardVertexCount, 8);
assert.equal(guarded.metrics.guardTriangleCount, 16);
assert.ok(guarded.metrics.guardArea > 0);
const guardedOuter = guarded.budget.guardContours.find(contour => contour.kind === 'outer');
const guardedHole = guarded.budget.guardContours.find(contour => contour.kind === 'hole');
const expectedGuardArea = (Math.abs(guardedOuter.signedArea) - outerSourceArea)
    + (holeSourceArea - Math.abs(guardedHole.signedArea));
assert.equal(guarded.metrics.guardArea, expectedGuardArea, 'guard triangles exactly cover transparent-side rings');
assert.equal(guarded.triangleRegions.length, guarded.triangles.length);
guarded.triangles.forEach(triangle => {
    assert.equal(triangle.length, 3);
    assert.equal(new Set(triangle).size, 3);
    triangle.forEach(index => assert.ok(index >= 0 && index < guarded.vertices.length));
    assert.ok(triangleArea(guarded.vertices, triangle) > 1e-9);
});

const meshVertices = guarded.vertices.map((vertex, index) => ({
    vertexId: `v-${index}`,
    x: vertex.x,
    y: vertex.y
}));
const validation = validateRasterBoneSkinning([{
    version: RASTER_MESH_SCHEMA_VERSION,
    meshId: 'guarded-fill-proof',
    targetInternalLayerId: 'shape',
    vertices: meshVertices,
    triangles: guarded.triangles.map(triangle => triangle.map(index => meshVertices[index].vertexId))
}], null, [{ id: 'shape', type: 'raster' }], null);
assert.equal(validation.ok, true, 'guarded proof remains compatible with existing Mesh schema');

const paddingRequired = prepareAutoShapeContourBudget(analyze(['###']), {
    guardDistance: 0.5,
    minimumGuardDistance: 0.125
});
assert.equal(paddingRequired.ok, false);
assert.equal(paddingRequired.reason, 'guard-padding-required');

const closeIslands = prepareAutoShapeContourBudget(analyze([
    '.........',
    '.##.##...',
    '.##.##...',
    '.........'
]), {
    maxVertices: 64,
    reservedInteriorVertices: 16,
    guardDistance: 1,
    minimumGuardDistance: 0.5
});
assert.equal(closeIslands.ok, false);
assert.equal(closeIslands.reason, 'guard-overlap', 'guard never crosses into a neighboring island');

assert.equal(prepareAutoShapeContourBudget(null).reason, 'invalid-contour-analysis');
assert.equal(prepareAutoShapeContourBudget(donutAnalysis, {
    maxVertices: 10,
    reservedInteriorVertices: 6
}).reason, 'vertex-budget-invalid');

console.log('verify-auto-shape-contour-budget: topology-safe reduction, area gate, outer/hole guard, backoff, overlap/padding rejection, guarded FILL and Mesh compatibility OK');
