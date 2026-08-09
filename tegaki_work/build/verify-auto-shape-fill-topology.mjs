import assert from 'node:assert/strict';

import {
    AUTO_SHAPE_FILL_MODE_CONTOUR,
    AUTO_SHAPE_FILL_MODE_INTERIOR,
    createAutoShapeFillTopology
} from '../system/animation/auto-shape-fill-topology.js';
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

function pointInPolygon(point, polygon) {
    let inside = false;
    for (let current = 0, previous = polygon.length - 1; current < polygon.length; previous = current++) {
        const a = polygon[current];
        const b = polygon[previous];
        const intersects = ((a.y > point.y) !== (b.y > point.y))
            && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x;
        if (intersects) inside = !inside;
    }
    return inside;
}

const armAnalysis = analyze([
    '........',
    '.######.',
    '.######.',
    '.######.',
    '.######.',
    '........'
]);
const armContour = createAutoShapeFillTopology(armAnalysis, {
    mode: AUTO_SHAPE_FILL_MODE_CONTOUR
});
assert.equal(armContour.ok, true);
assert.equal(armContour.metrics.vertexCount, 4, 'rectangle contour uses four boundary turns');
assert.equal(armContour.metrics.triangleCount, 2);
assert.equal(armContour.metrics.totalTriangleArea, 24);
assert.equal(armContour.metrics.areaError, 0);
assert.deepEqual(
    createAutoShapeFillTopology(armAnalysis, { mode: AUTO_SHAPE_FILL_MODE_CONTOUR }),
    armContour,
    'contour topology is deterministic'
);

const armInterior = createAutoShapeFillTopology(armAnalysis, {
    mode: AUTO_SHAPE_FILL_MODE_INTERIOR,
    interiorSpacing: 1.5,
    maxInteriorPoints: 12,
    minimumBarycentricWeight: 0.01
});
assert.equal(armInterior.ok, true);
assert.ok(armInterior.metrics.interiorVertexCount > 0, 'thick arm receives interior support');
assert.ok(armInterior.metrics.vertexCount <= 256);
assert.ok(
    armInterior.metrics.maxTriangleArea < armContour.metrics.maxTriangleArea,
    'interior support reduces the largest unsupported triangle area'
);
assert.equal(armInterior.metrics.totalTriangleArea, armContour.metrics.totalTriangleArea);
assert.equal(armInterior.metrics.areaError, 0);

const donutAnalysis = analyze([
    '#####',
    '#...#',
    '#...#',
    '#...#',
    '#####'
]);
const donut = createAutoShapeFillTopology(donutAnalysis, {
    mode: AUTO_SHAPE_FILL_MODE_INTERIOR,
    interiorSpacing: 0.75,
    maxInteriorPoints: 32,
    minimumBarycentricWeight: 0.005
});
assert.equal(donut.ok, true);
assert.equal(donut.metrics.expectedArea, 16);
assert.equal(donut.metrics.totalTriangleArea, 16, 'hole area is not triangulated');
const hole = donutAnalysis.components[0].holeContours[0].points;
donut.triangles.forEach(triangle => {
    const points = triangle.map(index => donut.vertices[index]);
    const centroid = {
        x: (points[0].x + points[1].x + points[2].x) / 3,
        y: (points[0].y + points[1].y + points[2].y) / 3
    };
    assert.equal(pointInPolygon(centroid, hole), false, 'triangle centroid stays outside hole');
});
assert.equal(
    donutAnalysis.components[0].outerContours[0].bounds.width
        * donutAnalysis.components[0].outerContours[0].bounds.height
        - donut.metrics.expectedArea,
    9,
    'rect Grid baseline would cover nine transparent hole pixels'
);

const islandsAnalysis = analyze([
    '##..###',
    '##..###'
]);
const islands = createAutoShapeFillTopology(islandsAnalysis, {
    mode: AUTO_SHAPE_FILL_MODE_INTERIOR,
    interiorSpacing: 1,
    maxInteriorPoints: 16
});
assert.equal(islands.ok, true);
assert.equal(islands.componentCount, 2);
assert.equal(islands.metrics.expectedArea, 10);
assert.equal(islands.metrics.totalTriangleArea, 10);

const meshVertices = armInterior.vertices.map((vertex, index) => ({
    vertexId: `v-${index}`,
    x: vertex.x,
    y: vertex.y
}));
const validation = validateRasterBoneSkinning([{
    version: RASTER_MESH_SCHEMA_VERSION,
    meshId: 'auto-shape-proof',
    targetInternalLayerId: 'arm',
    vertices: meshVertices,
    triangles: armInterior.triangles.map(triangle => triangle.map(index => meshVertices[index].vertexId))
}], null, [{ id: 'arm', type: 'raster' }], null);
assert.equal(validation.ok, true, 'existing static Mesh schema accepts proof topology without new fields');

assert.equal(createAutoShapeFillTopology(null).reason, 'invalid-contour-analysis');
assert.equal(createAutoShapeFillTopology(armAnalysis, { mode: 'line' }).reason, 'unsupported-fill-mode');
assert.equal(
    createAutoShapeFillTopology(donutAnalysis, { maxVertices: 7 }).reason,
    'boundary-vertex-limit'
);
const capped = createAutoShapeFillTopology(armAnalysis, {
    mode: AUTO_SHAPE_FILL_MODE_INTERIOR,
    interiorSpacing: 0.25,
    maxInteriorPoints: 1000,
    maxVertices: 10,
    minimumBarycentricWeight: 0.001
});
assert.equal(capped.ok, true);
assert.ok(capped.vertices.length <= 10, 'interior insertion respects explicit vertex cap');

console.log('verify-auto-shape-fill-topology: contour/interior FILL, arm quality, hole/island coverage, rect baseline rejection and Mesh schema compatibility OK');
