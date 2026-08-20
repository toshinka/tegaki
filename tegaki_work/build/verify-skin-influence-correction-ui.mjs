import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const popup = readFileSync(new URL('../ui/animation-table-popup.js', import.meta.url), 'utf8');
const overlay = readFileSync(new URL('../ui/rig-skin-weight-overlay.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../styles/main.css', import.meta.url), 'utf8');

assert.match(popup, /id="anim-rig-weight-correction-toggle"/);
assert.match(popup, /data-rig-weight-correction="bone-only"/);
assert.match(popup, /data-rig-weight-correction="parent-blend"/);
assert.match(popup, /data-rig-weight-correction="none"/);
assert.match(popup, /applyClipAssetRasterSkinInfluenceCorrection/);
assert.match(popup, /weightCorrectionMode === LIMITED_SKIN_CORRECTION_MODE/);
assert.match(popup, /LIMITED_SKIN_CORRECTION_MODE, FIXED_TOPOLOGY_SKIN_WEIGHT_BRUSH_MODE/);
assert.match(popup, /window\.confirm\('weight補正は再生成で破棄されます/);
assert.match(overlay, /onVertexToggle/);
assert.match(overlay, /rig-skin-weight-overlay__vertex/);
assert.match(css, /\.rig-skin-weight-overlay__vertex\.is-selected/);

console.log('verify-skin-influence-correction-ui: PASS');
