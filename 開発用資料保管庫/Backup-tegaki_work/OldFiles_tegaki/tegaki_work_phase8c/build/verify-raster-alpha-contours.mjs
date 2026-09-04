import assert from 'node:assert/strict';

import { analyzeRasterAlphaContours } from '../system/animation/raster-alpha-contours.js';

function makeSnapshot(rows, options = {}) {
    const height = rows.length;
    const width = rows[0].length;
    const pixels = new Uint8ClampedArray(width * height * 4);
    rows.forEach((row, y) => {
        assert.equal(row.length, width, 'fixture width');
        [...row].forEach((value, x) => {
            const alpha = value === '#'
                ? 255
                : (value >= '0' && value <= '9' ? Number(value) * 25 : 0);
            pixels[(y * width + x) * 4 + 3] = alpha;
        });
    });
    return {
        id: options.id || 'snapshot',
        width,
        height,
        pixels,
        rasterBounds: options.rasterBounds || { x: 0, y: 0, width, height }
    };
}

const rectangleSnapshot = makeSnapshot(['##', '##'], {
    rasterBounds: { x: 10, y: 20, width: 4, height: 6 }
});
const rectanglePixelsBefore = Array.from(rectangleSnapshot.pixels);
const rectangle = analyzeRasterAlphaContours(rectangleSnapshot);
assert.equal(rectangle.ok, true, 'opaque rectangle is accepted');
assert.equal(rectangle.componentCount, 1);
assert.equal(rectangle.contourCount, 1);
assert.equal(rectangle.holeCount, 0);
assert.equal(rectangle.opaquePixelCount, 4);
assert.deepEqual(rectangle.components[0].contours[0].pixelPoints, [
    { x: 0, y: 0 },
    { x: 2, y: 0 },
    { x: 2, y: 2 },
    { x: 0, y: 2 }
], 'collinear pixel edges are reduced to deterministic corners');
assert.deepEqual(rectangle.components[0].contours[0].points, [
    { x: 10, y: 20 },
    { x: 14, y: 20 },
    { x: 14, y: 26 },
    { x: 10, y: 26 }
], 'pixel-cell corners map to Project bounds');
assert.equal(rectangle.components[0].contours[0].signedArea, 24, 'outer loop has positive screen-space area');
assert.deepEqual(Array.from(rectangleSnapshot.pixels), rectanglePixelsBefore, 'analysis does not mutate Raster');
assert.deepEqual(analyzeRasterAlphaContours(rectangleSnapshot), rectangle, 'same input is deterministic');

const donut = analyzeRasterAlphaContours(makeSnapshot([
    '###',
    '#.#',
    '###'
]));
assert.equal(donut.ok, true);
assert.equal(donut.componentCount, 1, 'donut is one 4-connected island');
assert.equal(donut.contourCount, 2);
assert.equal(donut.holeCount, 1);
assert.equal(donut.components[0].outerContours.length, 1);
assert.equal(donut.components[0].holeContours.length, 1);
assert.equal(donut.components[0].outerContours[0].signedPixelArea, 9);
assert.equal(donut.components[0].holeContours[0].signedPixelArea, -1, 'hole has opposite winding');

const separated = analyzeRasterAlphaContours(makeSnapshot(['#.#']));
assert.equal(separated.ok, true);
assert.equal(separated.componentCount, 2, 'separated pixels are separate islands');
assert.deepEqual(separated.components.map(component => component.pixelBounds), [
    { x: 0, y: 0, width: 1, height: 1 },
    { x: 2, y: 0, width: 1, height: 1 }
]);

const diagonal = analyzeRasterAlphaContours(makeSnapshot(['#.', '.#']));
assert.equal(diagonal.ok, true);
assert.equal(diagonal.componentCount, 2, 'diagonal-only contact does not merge islands');
assert.equal(diagonal.contourCount, 2);

const concave = analyzeRasterAlphaContours(makeSnapshot(['##', '#.']));
assert.equal(concave.ok, true);
assert.equal(concave.components[0].outerContours[0].points.length, 6, 'concave L keeps only turn points');
assert.equal(concave.components[0].outerContours[0].signedPixelArea, 3);

const threshold = analyzeRasterAlphaContours(makeSnapshot(['18']), { alphaThreshold: 100 });
assert.equal(threshold.ok, true);
assert.equal(threshold.opaquePixelCount, 1, 'alpha threshold is strict and deterministic');
assert.deepEqual(threshold.components[0].pixelBounds, { x: 1, y: 0, width: 1, height: 1 });

assert.equal(analyzeRasterAlphaContours(makeSnapshot(['..'])).reason, 'empty-raster');
assert.equal(analyzeRasterAlphaContours({ width: 2, height: 2, pixels: null }).reason, 'invalid-raster');
assert.equal(
    analyzeRasterAlphaContours(makeSnapshot(['##', '##']), { maxPixels: 3 }).reason,
    'surface-too-large'
);
assert.equal(
    analyzeRasterAlphaContours(makeSnapshot(['##', '##']), { maxBoundaryEdges: 7 }).reason,
    'boundary-too-complex'
);

console.log('verify-raster-alpha-contours: deterministic islands, holes, winding, Project mapping, threshold and complexity guards OK');
