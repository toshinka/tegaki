/** WP-025: pixel/recipe atomicity and stale asynchronous commit behavior. */
import assert from 'node:assert/strict';
import { LetteringLayerAdapter, letteringRasterFingerprint } from '../system/lettering-layer-adapter.js';
import { defaultLetteringParams, sanitizeLetteringData } from '../system/lettering-model.js';
import { hideLetteringPreviewSource, ghostMangaPreviewSource, restoreLetteringPreviewSource, revealLetteringSourcesForCapture } from '../system/lettering-preview-display.js';

const clone = value => structuredClone(value);
const basePixels = new Uint8ClampedArray([128, 40, 10, 255, 255, 0, 0, 0]);
let layers = [], active = null, renders = 0;
const history = { stack: [], isApplying: false, record(command) { this.stack.push(command); } };
const layerSystem = {
    canvasWidth: 400, canvasHeight: 400,
    getLayers: () => layers, getActiveLayer: () => active,
    createLayerRasterSnapshot: layer => clone(layer.snapshot),
    getLayerIndex: layer => layers.indexOf(layer), requestThumbnailUpdate() {},
    restoreLayerRasterSnapshot(snapshot) {
        const target = layers.find(layer => layer.layerData.id === snapshot.layerId);
        if (!target) return false;
        target.snapshot = clone(snapshot); return true;
    },
    createRasterLayerFromSnapshot(snapshot, options) {
        const layer = { layerData: { id: `layer-${layers.length}` }, snapshot: clone(snapshot) };
        layer.snapshot.layerId = layer.layerData.id;
        layers.push(layer); active = layer;
        layer.layerData.lettering = { ...clone(options.lettering), fingerprint: letteringRasterFingerprint(layer.snapshot) };
        history.record({ do() { layers.push(layer); active = layer; }, undo() { layers = layers.filter(l => l !== layer); active = layers.at(-1); } });
        return { layer };
    }
};
const rendered = () => ({ ok: true, width: 2, height: 1, pixels: basePixels,
    rasterBounds: { x: 90, y: 80, width: 2, height: 1 } });
const adapter = new LetteringLayerAdapter({ layerSystem, history, render: async () => { renders++; return rendered(); } });
const params = defaultLetteringParams(); params.text = 'ドン！';
assert.equal((await adapter.apply(params)).ok, true);
assert.equal(history.stack.length, 1, 'add is exactly one History');
assert.ok(sanitizeLetteringData(active.layerData.lettering));
assert.equal(adapter.loadActive().intact, true);
const original = clone(active.layerData.lettering);
const id = active.layerData.id;
history.stack[0].undo(); assert.equal(layers.length, 0);
history.stack[0].do(); assert.deepEqual(active.layerData.lettering, original);
assert.equal(adapter.loadActive().intact, true);

params.text = 'ゴゴゴ';
assert.equal((await adapter.update(id, params)).ok, true);
assert.equal(history.stack.length, 2, 'update is exactly one History');
const revised = clone(active.layerData.lettering);
history.stack[1].undo(); assert.deepEqual(active.layerData.lettering, original);
history.stack[1].do(); assert.deepEqual(active.layerData.lettering, revised);
assert.equal(adapter.loadActive().intact, true);

// Transparent RGB cannot manufacture a modification; visible changes must reject.
active.snapshot.pixels[4] = 7;
assert.equal(adapter.loadActive().intact, true);
active.snapshot.pixels[0] = 230;
const drawn = clone(active.snapshot);
assert.equal((await adapter.update(id, params)).ok, false);
assert.deepEqual(active.snapshot, drawn); assert.equal(history.stack.length, 2);
assert.equal(adapter.loadActive().intact, false);
assert.equal(renders, 2, 'stale pixels reject before expensive shaping');

history.stack[1].do();
active.position = { x: 10, y: 0 };
assert.equal(adapter.loadActive().intact, false);
assert.equal((await adapter.update(id, params)).ok, false, 'unbaked transforms also protect the original');
active.position.x = 0;
active.snapshot.rasterBounds.x++;
assert.equal((await adapter.update(id, params)).ok, false, 'moved raster bounds protect external transforms');
history.stack[1].do();
const beforeFailure = clone(active.snapshot);
adapter.render = async () => ({ ok: false, reason: 'missing-font' });
assert.equal((await adapter.update(id, params)).reason, 'missing-font');
assert.deepEqual(active.snapshot, beforeFailure); assert.equal(history.stack.length, 2);

adapter.render = async () => ({ ...rendered(), pixels: new Uint8ClampedArray([20, 30, 40, 255, 0, 0, 0, 0]) });
const beforeFault = clone(active.snapshot), recipeBeforeFault = clone(active.layerData.lettering);
const restoreSnapshot = layerSystem.restoreLayerRasterSnapshot;
let failOnce = true;
layerSystem.restoreLayerRasterSnapshot = snapshot => {
    const result = restoreSnapshot(snapshot);
    if (failOnce) { failOnce = false; return false; }
    return result;
};
assert.equal((await adapter.update(id, params)).ok, false, 'partial raster restore failure is compensated');
assert.deepEqual(active.snapshot, beforeFault); assert.deepEqual(active.layerData.lettering, recipeBeforeFault);
layerSystem.restoreLayerRasterSnapshot = restoreSnapshot;
const record = history.record;
history.record = () => { throw new Error('record-fault'); };
assert.equal((await adapter.update(id, params)).reason, 'record-fault');
assert.deepEqual(active.snapshot, beforeFault); assert.deepEqual(active.layerData.lettering, recipeBeforeFault);
assert.equal(history.stack.length, 2);
history.record = record;

let resolveRender;
adapter.render = () => new Promise(resolve => { resolveRender = resolve; });
const pending = adapter.update(id, params);
assert.equal((await adapter.apply(params)).ok, false, 'concurrent commits reject');
active.snapshot.pixels[3] = 100;
const changedWhileLoading = clone(active.snapshot);
resolveRender(rendered());
assert.equal((await pending).ok, false, 'changes while awaiting font/render are rechecked');
assert.deepEqual(active.snapshot, changedWhileLoading); assert.equal(history.stack.length, 2);

history.isApplying = true;
assert.equal((await adapter.apply(params)).ok, false, 'no mutation while History is applying');
history.isApplying = false;
active.layerData.isAnimationWorkingLayer = true;
assert.equal((await adapter.apply(params)).ok, false, 'CAF remains outside the feature');
assert.equal(history.stack.length, 2);
assert.equal(letteringRasterFingerprint({ width: 1, height: 1, pixels: [] }), null);
const previewLayer = { layerData: { visible: true, layerSprite: { renderable: true } } };
assert.equal(hideLetteringPreviewSource(previewLayer), true);
assert.equal(previewLayer.layerData.layerSprite.renderable, false);
assert.equal(previewLayer.layerData.visible, true, 'user visibility is untouched');
const resume = revealLetteringSourcesForCapture();
assert.equal(previewLayer.layerData.layerSprite.renderable, true, 'canonical capture restores committed pixels');
resume(); assert.equal(previewLayer.layerData.layerSprite.renderable, false);
restoreLetteringPreviewSource(previewLayer);
assert.equal(previewLayer.layerData.layerSprite.renderable, true, 'hide/cancel restores original display');
const toneDisplay = { renderable: true };
previewLayer.layerData.layerSprite.alpha = 0.6;
ghostMangaPreviewSource(previewLayer);
assert.equal(previewLayer.layerData.layerSprite.alpha, 0.12, 'ghost multiplies the original Sprite alpha');
const outerCapture = revealLetteringSourcesForCapture();
const innerCapture = revealLetteringSourcesForCapture();
innerCapture();
assert.equal(previewLayer.layerData.layerSprite.alpha, 0.6, 'nested capture stays canonical until its outer capture ends');
outerCapture();
assert.equal(previewLayer.layerData.layerSprite.alpha, 0.12, 'capture resumes ghost display');
restoreLetteringPreviewSource(previewLayer);
assert.equal(previewLayer.layerData.layerSprite.alpha, 0.6, 'end restores original alpha');
hideLetteringPreviewSource(previewLayer, () => {}, toneDisplay);
const resumeTone = revealLetteringSourcesForCapture();
assert.equal(toneDisplay.renderable, false, 'canonical capture excludes transient tone Sprite');
assert.equal(previewLayer.layerData.layerSprite.renderable, true);
resumeTone();
assert.equal(toneDisplay.renderable, true);
assert.equal(previewLayer.layerData.layerSprite.renderable, false);
restoreLetteringPreviewSource(previewLayer);
console.log('verify-editable-lettering-layer: one History, pixel/recipe undo-redo, stale/bounds/async/failure/CAF guards OK');
