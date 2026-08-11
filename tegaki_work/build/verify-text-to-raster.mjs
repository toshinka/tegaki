import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
    TEXT_RASTER_FONT_FAMILIES,
    createTextRasterLayout,
    normalizeTextRasterRequest,
    rasterizeTextToImageData,
    resolveTextRasterPlacement
} from '../system/text-rasterizer.js';

assert.deepEqual(TEXT_RASTER_FONT_FAMILIES, ['sans-serif', 'serif', 'monospace']);

const normalized = normalizeTextRasterRequest({
    text: '一行目\r\nLine 2',
    fontFamily: 'serif',
    fontSize: 48.4,
    bold: true,
    color: 0x123456
});
assert.equal(normalized.ok, true);
assert.deepEqual(normalized.value.lines, ['一行目', 'Line 2']);
assert.equal(normalized.value.font, '700 48px serif');
assert.equal(normalized.value.color, '#123456');

assert.equal(normalizeTextRasterRequest({ text: '   ', fontSize: 48 }).ok, false);
assert.equal(normalizeTextRasterRequest({ text: 'x', fontSize: Number.NaN }).ok, false);
assert.equal(normalizeTextRasterRequest({ text: 'x', fontSize: 999 }).value.fontSize, 256);
assert.equal(normalizeTextRasterRequest({ text: 'x', fontSize: 1, fontFamily: 'invalid' }).value.fontFamily, 'sans-serif');
assert.equal(normalizeTextRasterRequest({ text: 'x\n'.repeat(32) + 'x', fontSize: 32 }).ok, false);
assert.equal(normalizeTextRasterRequest({ text: 'x'.repeat(2001), fontSize: 32 }).ok, false);

const layout = createTextRasterLayout(normalized.value, (line) => ({
    width: line.length * 10,
    actualBoundingBoxLeft: 2,
    actualBoundingBoxRight: Math.max(0, line.length * 10 - 2),
    actualBoundingBoxAscent: 30,
    actualBoundingBoxDescent: 8
}));
assert.equal(layout.ok, true);
assert.equal(layout.width, 70);
assert.equal(layout.x, 6);
assert.deepEqual(layout.baselines, [34, 94]);
assert.equal(layout.height, 106);

assert.deepEqual(resolveTextRasterPlacement({
    rasterWidth: 100,
    rasterHeight: 40,
    projectWidth: 500,
    projectHeight: 400,
    center: { x: 250, y: 200 }
}), { x: 200, y: 180, width: 100, height: 40 });
assert.deepEqual(resolveTextRasterPlacement({
    rasterWidth: 100,
    rasterHeight: 40,
    projectWidth: 500,
    projectHeight: 400,
    center: { x: -50, y: 900 }
}), { x: 0, y: 360, width: 100, height: 40 });

const drawCalls = [];
const fakeContext = {
    font: '',
    fillStyle: '',
    textAlign: '',
    textBaseline: '',
    measureText(line) {
        return {
            width: line.length * 8,
            actualBoundingBoxLeft: 0,
            actualBoundingBoxRight: line.length * 8,
            actualBoundingBoxAscent: 16,
            actualBoundingBoxDescent: 4
        };
    },
    clearRect() {},
    fillText(...args) { drawCalls.push(args); },
    getImageData(x, y, width, height) {
        return { data: new Uint8ClampedArray(width * height * 4) };
    }
};
const fakeDocument = {
    createElement(name) {
        assert.equal(name, 'canvas');
        return {
            width: 0,
            height: 0,
            getContext() { return fakeContext; }
        };
    }
};
const raster = rasterizeTextToImageData({
    text: 'A\nB',
    fontFamily: 'monospace',
    fontSize: 20,
    color: '#abcdef'
}, { documentRef: fakeDocument, maxDimension: 512 });
assert.equal(raster.ok, true);
assert.equal(raster.pixels.length, raster.width * raster.height * 4);
assert.deepEqual(drawCalls.map(call => call[0]), ['A', 'B']);
assert.equal(fakeContext.fillStyle, '#abcdef');
assert.equal(rasterizeTextToImageData({ text: 'A'.repeat(30), fontSize: 20 }, {
    documentRef: fakeDocument,
    maxDimension: 32
}).ok, false);
assert.equal(rasterizeTextToImageData({ text: 'SAFE', fontSize: 20 }, {
    documentRef: fakeDocument,
    maxDimension: 512,
    isSizeAllowed: () => false
}).ok, false);

const [layerSource, qtpSource, coreSource, cameraSource] = await Promise.all([
    readFile(new URL('../system/layer-system.js', import.meta.url), 'utf8'),
    readFile(new URL('../ui/quick-access-popup.js', import.meta.url), 'utf8'),
    readFile(new URL('../core-engine.js', import.meta.url), 'utf8'),
    readFile(new URL('../system/camera-system.js', import.meta.url), 'utf8')
]);
assert.match(layerSource, /createRasterLayerFromSnapshot\(snapshot, options = \{\}\)/);
assert.match(layerSource, /historyManager\.record\(\{[\s\S]*name: options\.historyName \|\| 'raster-layer-create'/);
assert.match(qtpSource, /id="qa-text-raster-toggle"/);
assert.match(qtpSource, /event\.key === 'Enter'[\s\S]*event\.ctrlKey \|\| event\.metaKey/);
assert.match(qtpSource, /textRasterService\.createTextLayer/);
assert.match(coreSource, /new TextRasterService\(\{/);
assert.match(cameraSource, /getViewportCenterCanvasPoint\(\)/);

console.log('verify-text-to-raster: normalization, layout, placement, Canvas adapter, one-History/QTP wiring OK');
