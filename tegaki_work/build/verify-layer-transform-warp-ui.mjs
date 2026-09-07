import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const buildDir = path.dirname(fileURLToPath(import.meta.url));
const workDir = path.resolve(buildDir, '..');
const read = relative => fs.readFileSync(path.join(workDir, relative), 'utf8');

const domBuilder = read('ui/dom-builder.js');
const layerTransform = read('system/layer-transform.js');
const layerSystem = read('system/layer-system.js');
const controller = read('ui/layer-transform-warp-controller.js');
const overlay = read('ui/warp-grid-overlay.js');
const animationPopup = read('ui/animation-table-popup.js');
const layerTransformStyles = read('styles/components/layer-transform-basic.css');
const styles = read('styles/main.css');

const modeStart = domBuilder.indexOf("className: 'layer-transform-mode-strip'");
const modeEnd = domBuilder.indexOf("const keyStrip =", modeStart);
assert.ok(modeStart >= 0 && modeEnd > modeStart);
const modeMarkup = domBuilder.slice(modeStart, modeEnd);
assert.equal((modeMarkup.match(/data-transform-mode/g) || []).length, 2);
assert.match(modeMarkup, /textContent: 'BASIC'/);
assert.match(modeMarkup, /textContent: 'DISTORT'[\s\S]*?disabled: ''/);
assert.match(modeMarkup, /textContent: 'WARP'/);

assert.match(layerTransform, /setTransformMode\(mode = 'basic'\)/);
assert.match(layerTransform, /onTransformModeChange/);
assert.match(layerTransform, /onWarpReset/);
assert.match(layerTransform, /warpController\?\.deactivate/);
assert.match(layerTransform, /data-transform-mode/);

assert.match(layerSystem, /createRectControlMeshDeformer/);
assert.match(layerSystem, /warpRgbaWithGrid/);
assert.match(layerSystem, /beginLayerWarpEditSession\(\)/);
assert.match(layerSystem, /previewLayerWarpEditSession\(points\)/);
assert.match(layerSystem, /finishLayerWarpEditSession\(options = \{\}\)/);
assert.match(layerSystem, /this\._transformEditAdapter\.beginWarp/);
assert.match(layerSystem, /this\._transformEditAdapter\.previewWarp/);
assert.match(layerSystem, /this\._transformEditAdapter\.finishWarp/);
assert.match(layerSystem, /name: 'layer-warp'/);
assert.match(layerSystem, /animationWorkingLayer/);
assert.match(layerSystem, /this\._layerWarpEditSession\?\.changed === true/);

assert.match(controller, /POINT_COUNT = 16/);
assert.match(controller, /setPointerCapture/);
assert.match(controller, /releasePointerCapture/);
assert.match(controller, /onPointPointerCancel/);
assert.match(controller, /onPointLostPointerCapture/);
assert.match(controller, /previewLayerWarpEditSession/);
assert.match(controller, /_onPointerUp/);
assert.match(controller, /shouldDisplay:[\s\S]*?getLayerWarpEditSession/);

// CAF ANIMATEのbridge previewはAnimationTablePopup.render()を予約する。
// Simple Layer Transform WARPの共有overlayを高度WARP GRIDのcleanup対象にしない。
assert.match(animationPopup, /const isLayerTransformWarpEditing = !!this\.layerSystem\?\.getLayerWarpEditSession\?\.\(\)/);
assert.match(animationPopup, /!isLayerTransformWarpEditing[\s\S]*?warpGridOverlay\.isActive\(\)/);

assert.match(overlay, /interactive/);
assert.match(overlay, /warp-grid-overlay-point-hit/);
assert.match(overlay, /onPointPointerDown/);
assert.match(overlay, /onPointPointerMove/);
assert.match(overlay, /onPointPointerUp/);
assert.match(overlay, /onPointPointerCancel/);
assert.match(overlay, /onPointLostPointerCapture/);
assert.match(layerTransformStyles, /grid-template-columns: repeat\(2/);
assert.match(styles, /warp-grid-overlay\.is-interactive/);

console.log('Layer Transform Simple 4x4 WARP UI/controller verifier passed.');
