import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const popup = readFileSync(new URL('../ui/animation-table-popup.js', import.meta.url), 'utf8');
const overlay = readFileSync(new URL('../ui/rig-skin-weight-overlay.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../styles/main.css', import.meta.url), 'utf8');

assert.match(popup, /id="anim-rig-weight-brush-toggle"/);
assert.match(popup, /data-rig-weight-brush-direction="1"/);
assert.match(popup, /data-rig-weight-brush-direction="-1"/);
assert.match(popup, /id="anim-rig-weight-brush-radius"/);
assert.match(popup, /id="anim-rig-weight-brush-strength"/);
assert.match(popup, /createSkinWeightBrushPlan\(/);
assert.match(popup, /createSkinWeightBrushSample\(/);
assert.match(popup, /mergeSkinWeightBrushSamples\(/);
assert.match(popup, /baselineAsset: asset\.serialize\(\)/,
    'gesture fixes the pre-stroke asset authority');
assert.match(popup, /screenVertices,/,
    'gesture fixes diagnostic Frame vertices at pointerdown');
assert.match(popup, /caf-raster-skin-weight-brush/);
assert.match(popup, /gesture\.cancelledByFailure = true/,
    'a failed sample cancels the whole stroke instead of committing the last valid preview');
assert.match(popup, /options\.cancelled === true \|\| gesture\.cancelledByFailure/);
assert.match(popup, /cancelled: event\.type === 'pointercancel' \|\| event\.type === 'lostpointercapture'/);
assert.match(popup, /event\.key !== 'Escape'/);
assert.match(popup, /_shouldYieldMotionCanvasPointerToCamera/);
assert.match(popup, /_motionEditorMode !== 'rig'/,
    'brush mutation remains RIG Setup-only');
assert.match(popup, /status\.state !== 'current'/,
    'brush target requires CURRENT topology');
assert.match(popup, /LIMITED_SKIN_CORRECTION_MODE, FIXED_TOPOLOGY_SKIN_WEIGHT_BRUSH_MODE/,
    'regeneration warns for discrete and brush lineage');
assert.match(overlay, /setBrushCursor\(cursor = null\)/);
assert.match(overlay, /rig-skin-weight-overlay__brush-cursor/);
assert.match(css, /\.rig-skin-weight-overlay__brush-cursor[\s\S]*?pointer-events:\s*none/);
assert.match(css, /\.anim-rig-weight-brush-controls\[hidden\]/);

console.log('verify-skin-weight-brush-ui: RIG-only CURRENT brush, fixed gesture authority, cancel and one History boundary OK');
