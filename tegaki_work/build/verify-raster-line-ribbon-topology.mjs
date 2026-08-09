import assert from 'node:assert/strict';

import {
    createRasterLineRibbonTopology,
    createRasterLineRibbonTopologyFromCenterline
} from '../system/animation/raster-line-ribbon-topology.js';
import {
    AUTO_SHAPE_FILL_MODE_INTERIOR,
    createAutoShapeFillTopology
} from '../system/animation/auto-shape-fill-topology.js';
import { analyzeRasterAlphaContours } from '../system/animation/raster-alpha-contours.js';
import {
    RASTER_MESH_SCHEMA_VERSION,
    validateRasterBoneSkinning
} from '../system/animation/raster-bone-skinning.js';

function makeSnapshot(rows, options = {}) {
    const height = rows.length;
    const width = rows[0].length;
    const pixels = new Uint8ClampedArray(width * height * 4);
    rows.forEach((row, y) => {
        assert.equal(row.length, width, 'fixture width');
        [...row].forEach((value, x) => {
            pixels[(y * width + x) * 4 + 3] = value === '#' ? 255 : 0;
        });
    });
    return {
        width,
        height,
        pixels,
        rasterBounds: options.rasterBounds || { x: 0, y: 0, width, height }
    };
}

function opaquePixelCount(snapshot) {
    let count = 0;
    for (let index = 3; index < snapshot.pixels.length; index += 4) {
        if (snapshot.pixels[index] > 0) count += 1;
    }
    return count;
}

function syntheticCenterline(snapshot, pixelPoints) {
    return {
        ok: true,
        reason: null,
        width: snapshot.width,
        height: snapshot.height,
        alphaThreshold: 0,
        rasterBounds: { ...snapshot.rasterBounds },
        pixelPoints: pixelPoints.map(point => ({ ...point })),
        metrics: { opaquePixelCount: opaquePixelCount(snapshot) }
    };
}

const horizontalSnapshot = makeSnapshot([
    '.....................',
    '..#################..',
    '..#################..',
    '..#################..',
    '..#################..',
    '..#################..',
    '.....................'
], { rasterBounds: { x: 10, y: 20, width: 42, height: 14 } });
const horizontalPixelsBefore = Array.from(horizontalSnapshot.pixels);
const horizontal = createRasterLineRibbonTopology(horizontalSnapshot);
assert.equal(horizontal.ok, true, 'thick open bar produces a three-rail Ribbon candidate');
assert.equal(horizontal.mode, 'line-ribbon-three-rail');
assert.equal(horizontal.vertices.length % 3, 0);
assert.equal(horizontal.metrics.stationCount, horizontal.vertices.length / 3);
assert.equal(horizontal.triangles.length, (horizontal.metrics.stationCount - 1) * 4);
assert.ok(horizontal.vertices.length <= 256);
assert.ok(horizontal.metrics.coverageRatio >= 0.5 && horizontal.metrics.coverageRatio <= 1.5);
assert.ok(horizontal.metrics.minTriangleAngle >= 3);
assert.deepEqual(
    horizontal.vertices.map(vertex => vertex.kind).slice(0, 3),
    ['left', 'center', 'right'],
    'each station preserves explicit left / center / right support roles'
);
assert.equal(horizontal.stations[0].center.x, 10 + horizontal.stations[0].pixelCenter.x * 2);
assert.equal(horizontal.stations[0].center.y, 20 + horizontal.stations[0].pixelCenter.y * 2);
assert.deepEqual(Array.from(horizontalSnapshot.pixels), horizontalPixelsBefore, 'source pixels are not mutated');
assert.deepEqual(createRasterLineRibbonTopology(horizontalSnapshot), horizontal, 'same Raster is deterministic');
horizontal.triangles.forEach(triangle => {
    const [a, b, c] = triangle.map(index => horizontal.vertices[index]);
    assert.ok((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x) > 0);
});

const horizontalFill = createAutoShapeFillTopology(
    analyzeRasterAlphaContours(horizontalSnapshot),
    { mode: AUTO_SHAPE_FILL_MODE_INTERIOR, maxInteriorPoints: 16 }
);
assert.equal(horizontalFill.ok, true, 'Phase 7h FILL remains a comparison baseline');
assert.equal(
    horizontal.metrics.expectedOpaqueArea,
    horizontalFill.metrics.expectedArea,
    'LINE and FILL compare against the same Project-space alpha area'
);
assert.ok(
    Math.abs(horizontalFill.metrics.totalTriangleArea - horizontalFill.metrics.expectedArea) < 1e-9,
    'FILL baseline retains exact alpha coverage within floating-point tolerance'
);

const bent = createRasterLineRibbonTopology(makeSnapshot([
    '...........',
    '..###......',
    '..###......',
    '..###......',
    '..###......',
    '..#######..',
    '..#######..',
    '..#######..',
    '...........'
]));
assert.equal(bent.ok, true, `bent stroke remains a valid Ribbon: ${bent.reason}`);
assert.ok(new Set(bent.stations.map(station => station.pixelCenter.x)).size > 1);
assert.ok(new Set(bent.stations.map(station => station.pixelCenter.y)).size > 1);

const cappedBudget = createRasterLineRibbonTopology(horizontalSnapshot, { maxVertices: 6 });
assert.equal(cappedBudget.ok, true, 'explicit minimum station budget remains usable');
assert.equal(cappedBudget.vertices.length, 6);
assert.equal(cappedBudget.triangles.length, 4);
assert.equal(
    createRasterLineRibbonTopology(horizontalSnapshot, { maxVertices: 5 }).reason,
    'vertex-budget-too-small'
);

const longSnapshot = makeSnapshot([
    '.'.repeat(300),
    `.${'#'.repeat(298)}.`,
    `.${'#'.repeat(298)}.`,
    `.${'#'.repeat(298)}.`,
    '.'.repeat(300)
]);
const longRibbon = createRasterLineRibbonTopology(longSnapshot);
assert.equal(longRibbon.ok, true, `long stroke remains within the Mesh budget: ${longRibbon.reason}`);
assert.equal(longRibbon.vertices.length, 255);
assert.equal(longRibbon.metrics.stationCount, 85);
assert.ok(longRibbon.metrics.effectiveStationSpacing > 2, 'spacing expands instead of exceeding 256 vertices');

const strictAngle = createRasterLineRibbonTopology(horizontalSnapshot, { minimumTriangleAngle: 80 });
assert.equal(strictAngle.reason, 'minimum-triangle-angle');
const strictCoverage = createRasterLineRibbonTopology(horizontalSnapshot, { minCoverageRatio: 1.2 });
assert.equal(strictCoverage.reason, 'coverage-ratio-out-of-range');

const steppedSnapshot = makeSnapshot([
    '...........########..',
    '...........########..',
    '...........########..',
    '..#################..',
    '..#################..',
    '..#################..',
    '...........########..',
    '...........########..',
    '...........########..',
    '.....................'
]);
const stepped = createRasterLineRibbonTopologyFromCenterline(
    steppedSnapshot,
    syntheticCenterline(steppedSnapshot, [
        { x: 2.5, y: 4.5 },
        { x: 10.5, y: 4.5 },
        { x: 18.5, y: 4.5 }
    ]),
    { maxAdjacentWidthRatio: 1.2 }
);
assert.equal(stepped.reason, 'abrupt-width-change', 'large adjacent width change is rejected');

const crossingSnapshot = makeSnapshot(Array.from({ length: 15 }, () => '###############'));
const crossing = createRasterLineRibbonTopologyFromCenterline(
    crossingSnapshot,
    syntheticCenterline(crossingSnapshot, [
        { x: 2.5, y: 5.5 },
        { x: 5.5, y: 5.5 },
        { x: 10.5, y: 10.5 },
        { x: 5.5, y: 10.5 },
        { x: 10.5, y: 5.5 },
        { x: 12.5, y: 5.5 }
    ]),
    { maxAdjacentWidthRatio: 100, minimumTriangleAngle: 0.1, minCoverageRatio: 0.01, maxCoverageRatio: 100 }
);
assert.equal(crossing.reason, 'self-intersecting-ribbon', 'crossing outline is rejected before triangles');

const separated = createRasterLineRibbonTopology(makeSnapshot([
    '###.###',
    '###.###',
    '###.###'
]));
assert.equal(separated.ok, false);
assert.equal(separated.reason, 'single-component-required');
assert.equal(separated.source, 'centerline');

const meshVertices = horizontal.vertices.map((vertex, index) => ({
    vertexId: `v-${index}`,
    x: vertex.x,
    y: vertex.y
}));
const validation = validateRasterBoneSkinning([{
    version: RASTER_MESH_SCHEMA_VERSION,
    meshId: 'line-ribbon-proof',
    targetInternalLayerId: 'stroke',
    vertices: meshVertices,
    triangles: horizontal.triangles.map(triangle => triangle.map(index => meshVertices[index].vertexId))
}], null, [{ id: 'stroke', type: 'raster' }], null);
assert.equal(validation.ok, true, 'existing static Mesh schema accepts Ribbon proof without new fields');

assert.equal(createRasterLineRibbonTopologyFromCenterline(horizontalSnapshot, null).reason, 'invalid-centerline');
assert.equal(
    createRasterLineRibbonTopologyFromCenterline(null, syntheticCenterline(horizontalSnapshot, [
        { x: 2.5, y: 3.5 },
        { x: 18.5, y: 3.5 }
    ])).reason,
    'invalid-raster'
);

console.log('verify-raster-line-ribbon-topology: three rails, cap extension, width/intersection/angle/coverage gates, budget, Mesh compatibility and non-mutation OK');
