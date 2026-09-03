import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const popup = readFileSync(new URL('../ui/animation-table-popup.js', import.meta.url), 'utf8');
const overlay = readFileSync(new URL('../ui/rig-skin-weight-overlay.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../styles/main.css', import.meta.url), 'utf8');

assert.match(popup, /id="anim-rig-mesh-edit-toggle"/);
assert.match(popup, /_motionEditorMode !== 'rig' \|\| this\.isPlaying/,
    'topology mutation remains RIG Setup-only and stops during playback');
assert.match(popup, /\[ALPHA_FIT_GRID_GENERATOR, AUTO_SHAPE_FILL_GENERATOR\]/,
    'only fixed AUTO GRID and AUTO SHAPE topology is editable');
assert.match(popup, /status\.state !== 'current'/,
    'topology edit requires CURRENT source lineage');
assert.match(popup, /rasterSkinPlan\.status !== 'ready'/,
    'clipping, Folder WARP and rigid conflicts remain explicit unsupported boundaries');
assert.match(popup, /baselineAsset: asset\.serialize\(\)/,
    'gesture fixes the pre-drag asset authority');
assert.match(popup, /applyClipAssetRasterMeshVertexPositionEdit\(/);
assert.match(popup, /caf-raster-mesh-vertex-position/);
assert.match(popup, /gesture\.cancelledByFailure/,
    'invalid final geometry rolls the whole gesture back');
assert.match(popup, /_restoreRigMeshVertexEditBaseline/);
assert.match(popup, /cancelVertexDrag\('escape'\)/,
    'Escape reaches the overlay-owned pointer capture');
assert.match(popup, /_isRigMeshVertexEditModeActive\(\)[\s\S]*?rigPivotOverlay\.deactivate\(\)/,
    'Bone PIVOT input is suppressed while topology vertices own the canvas gesture');
assert.match(overlay, /vertexInteraction !== 'drag'/);
assert.match(overlay, /setPointerCapture\?\.\(event\.pointerId\)/);
assert.match(overlay, /pointercancel/);
assert.match(overlay, /lostpointercapture/);
assert.match(css, /\.anim-rig-mesh-edit-toggle:not\(:disabled\)/);
assert.match(css, /\.rig-skin-weight-overlay__vertex-hit[\s\S]*?stroke-width:\s*12/,
    'pen / touch can hit an explicit non-scaling target around each visible vertex');
assert.match(css, /\.rig-skin-weight-overlay\.is-topology-editing[\s\S]*?cursor:\s*move/);

console.log('verify-raster-mesh-vertex-position-edit-gesture-ui: explicit RIG mode, fixed target, pointer capture, rollback and History boundary OK');
