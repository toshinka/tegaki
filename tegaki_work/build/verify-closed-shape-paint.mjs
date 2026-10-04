/** WP-030 SHAPE pure contract verifier. Browser raster/Owner acceptance is separate. */
import assert from 'node:assert/strict';
import {
    CLOSED_SHAPE_PAINTS,
    normalizePaintMode,
    normalizeHexColor,
    resolveClosedShapePaint,
    normalizeClosedPoints,
    closedShapeBounds,
    strokePolygonsForPoints,
    pointInPolygonEvenOdd,
    blendClosedShapePixels
} from '../system/closed-shape-paint.js';

assert.deepEqual(CLOSED_SHAPE_PAINTS, ['legacy', 'line', 'same', 'custom']);
assert.equal(normalizePaintMode(undefined), 'legacy');
assert.equal(normalizePaintMode('bad', 'line'), 'line');
assert.equal(normalizeHexColor('#000000'), '#000000');
assert.equal(normalizeHexColor('#ABCDEF'), '#abcdef');
assert.equal(normalizeHexColor('black'), null);

const main = [128, 0, 0];
const background = [0, 0, 0];
assert.deepEqual(resolveClosedShapePaint({ paint: 'line' }, { main, background }).fillRgb, null);
assert.deepEqual(resolveClosedShapePaint({ paint: 'same' }, { main, background }).fillRgb, main);
assert.deepEqual(resolveClosedShapePaint({ paint: 'custom', fillColor: '#000000' }, { main, background }).fillRgb, [0, 0, 0]);
assert.equal(resolveClosedShapePaint({ paint: 'custom', fillColor: null }, { main, background }).followsBackground, true);
assert.deepEqual(resolveClosedShapePaint({ paint: 'legacy' }, { main, background }, { legacyMode: 'same' }).fillRgb, main);

const triangle = [{ x: 2, y: 2 }, { x: 14, y: 2 }, { x: 8, y: 12 }];
assert.equal(normalizeClosedPoints(triangle, { min: 3 }).ok, true);
assert.equal(normalizeClosedPoints([{ x: 0, y: 0 }, { x: Infinity, y: 1 }]).reason, 'non-finite');
assert.equal(normalizeClosedPoints(Array.from({ length: 257 }, (_, i) => ({ x: i, y: i }))).reason, 'max-points');
const longLasso = Array.from({ length: 513 }, (_, i) => ({ x: i, y: (i % 17) + Math.floor(i / 17) }));
const longLassoPoints = normalizeClosedPoints(longLasso, { min: 3, max: Infinity, dedupe: false });
assert.equal(longLassoPoints.ok, true);
assert.equal(longLassoPoints.points.length, longLasso.length);
assert.equal(strokePolygonsForPoints(longLasso).length, 0);
assert.ok(strokePolygonsForPoints(longLasso, { maxPoints: Infinity, dedupe: false }).length >= longLasso.length);
assert.equal(pointInPolygonEvenOdd({ x: 8, y: 5 }, triangle), true);
assert.equal(pointInPolygonEvenOdd({ x: 1, y: 1 }, triangle), false);
const stroke = strokePolygonsForPoints(triangle, { width: 4, join: 'round' });
assert.ok(stroke.length >= triangle.length);
assert.ok(stroke.flat().every(point => Number.isFinite(point.x) && Number.isFinite(point.y)));
assert.deepEqual(closedShapeBounds([triangle], stroke), { x0: 0, y0: 0, x1: 16, y1: 14 });

const target = {
    width: 1,
    height: 1,
    rasterBounds: { x: 0, y: 0, width: 1, height: 1 },
    pixels: new Uint8ClampedArray([0, 0, 0, 0])
};
const source = new Uint8ClampedArray([200, 100, 50, 255]);
const changed = blendClosedShapePixels(target, source, { x: 0, y: 0, width: 1, height: 1 }, 0.5);
assert.equal(changed, 4);
assert.deepEqual([...target.pixels], [200, 100, 50, 128]);

const selectedTarget = {
    width: 2,
    height: 1,
    rasterBounds: { x: 0, y: 0, width: 2, height: 1 },
    pixels: new Uint8ClampedArray(8)
};
blendClosedShapePixels(
    selectedTarget,
    new Uint8ClampedArray([255, 0, 0, 255, 255, 0, 0, 255]),
    { x: 0, y: 0, width: 2, height: 1 },
    1,
    { bounds: { x: 0, y: 0, width: 2, height: 1 }, mask: new Uint8Array([1, 0]) }
);
assert.deepEqual([...selectedTarget.pixels], [255, 0, 0, 255, 0, 0, 0, 0]);

console.log('verify-closed-shape-paint: PASS');

