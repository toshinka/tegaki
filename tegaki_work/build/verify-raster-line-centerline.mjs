import assert from 'node:assert/strict';

import { analyzeRasterLineCenterline } from '../system/animation/raster-line-centerline.js';

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

const horizontalSnapshot = makeSnapshot([
    '...........',
    '.#########.',
    '.#########.',
    '.#########.',
    '...........'
], { rasterBounds: { x: 10, y: 20, width: 22, height: 10 } });
const horizontalPixelsBefore = Array.from(horizontalSnapshot.pixels);
const horizontal = analyzeRasterLineCenterline(horizontalSnapshot);
assert.equal(horizontal.ok, true, 'thick horizontal stroke produces an open centerline');
assert.equal(horizontal.endpointPixelPoints.length, 2);
assert.ok(horizontal.pixelPoints.length >= 3);
assert.ok(horizontal.pixelPoints.every(point => point.y === horizontal.pixelPoints[0].y));
assert.ok(horizontal.pixelPoints[0].x < horizontal.pixelPoints.at(-1).x, 'path begins at canonical top/left endpoint');
assert.deepEqual(horizontal.points[0], {
    x: 10 + horizontal.pixelPoints[0].x * 2,
    y: 20 + horizontal.pixelPoints[0].y * 2
}, 'pixel centers map once into Project bounds');
assert.deepEqual(Array.from(horizontalSnapshot.pixels), horizontalPixelsBefore, 'source pixels are not mutated');
assert.deepEqual(analyzeRasterLineCenterline(horizontalSnapshot), horizontal, 'same source is deterministic');

const vertical = analyzeRasterLineCenterline(makeSnapshot([
    '.....',
    '.###.',
    '.###.',
    '.###.',
    '.###.',
    '.###.',
    '.###.',
    '.###.',
    '.....'
]));
assert.equal(vertical.ok, true, 'vertical stroke produces an open centerline');
assert.ok(vertical.pixelPoints.every(point => point.x === vertical.pixelPoints[0].x));
assert.ok(vertical.pixelPoints[0].y < vertical.pixelPoints.at(-1).y);

const bent = analyzeRasterLineCenterline(makeSnapshot([
    '.........',
    '..###....',
    '..###....',
    '..###....',
    '..######.',
    '..######.',
    '..######.',
    '.........'
]));
assert.equal(bent.ok, true, 'single bent stroke remains one ordered open path');
assert.ok(new Set(bent.pixelPoints.map(point => point.x)).size > 1, 'bent path spans multiple columns');
assert.ok(new Set(bent.pixelPoints.map(point => point.y)).size > 1, 'bent path spans multiple rows');
assert.ok(bent.pixelPoints.every((point, index, points) => {
    if (index === 0) return true;
    const dx = Math.abs(point.x - points[index - 1].x);
    const dy = Math.abs(point.y - points[index - 1].y);
    return dx <= 1 && dy <= 1 && dx + dy > 0;
}), 'bent path remains locally connected without fixture-specific diagonal assumptions');

const branch = analyzeRasterLineCenterline(makeSnapshot([
    '....###....',
    '....###....',
    '....###....',
    '###########',
    '###########',
    '###########',
    '....###....',
    '....###....',
    '....###....'
]));
assert.equal(branch.ok, false);
assert.equal(branch.reason, 'branching-centerline', 'branch graph is rejected rather than cut silently');

const donut = analyzeRasterLineCenterline(makeSnapshot([
    '#####',
    '#...#',
    '#...#',
    '#...#',
    '#####'
]));
assert.equal(donut.reason, 'holes-unsupported');

const separated = analyzeRasterLineCenterline(makeSnapshot([
    '###.###',
    '###.###',
    '###.###'
]));
assert.equal(separated.reason, 'single-component-required');

const square = analyzeRasterLineCenterline(makeSnapshot([
    '#####',
    '#####',
    '#####',
    '#####',
    '#####'
]));
assert.equal(square.ok, false);
assert.ok(['centerline-too-short', 'closed-centerline'].includes(square.reason));

assert.equal(analyzeRasterLineCenterline(makeSnapshot(['...'])).reason, 'empty-raster');
assert.equal(analyzeRasterLineCenterline({ width: 2, height: 2, pixels: null }).reason, 'invalid-raster');
assert.equal(
    analyzeRasterLineCenterline(horizontalSnapshot, { maxCenterlinePoints: 2 }).reason,
    'centerline-point-limit'
);
assert.equal(
    analyzeRasterLineCenterline(makeSnapshot([
        '.........',
        '.#######.',
        '.#######.',
        '.#######.',
        '.#######.',
        '.#######.',
        '.#######.',
        '.#######.',
        '.........'
    ]), { maxThinningIterations: 1 }).reason,
    'thinning-iteration-limit'
);

console.log('verify-raster-line-centerline: deterministic open path, Project mapping, rejection gates and non-mutation OK');
