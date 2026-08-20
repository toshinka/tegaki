import assert from 'node:assert/strict';
import fs from 'node:fs';

const popup = fs.readFileSync(new URL('../ui/animation-table-popup.js', import.meta.url), 'utf8');

assert.match(popup, /FIXED_VERTEX_POSITION_EDIT_MODE/);
assert.match(popup, /generator\?\.topologyEditMode === FIXED_VERTEX_POSITION_EDIT_MODE/);
assert.match(popup, /Mesh位置編集とweight補正は再生成で破棄されます/);
assert.match(popup, /Mesh位置編集は再生成で破棄されます/);
assert.match(popup, /weight補正は再生成で破棄されます/);
assert.match(popup, /' · EDITED'/);

console.log('Raster Mesh vertex position lineage UI verifier passed.');
