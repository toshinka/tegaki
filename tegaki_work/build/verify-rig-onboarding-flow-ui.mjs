import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const popup = readFileSync(new URL('../ui/animation-table-popup.js', import.meta.url), 'utf8');
const model = readFileSync(new URL('../system/animation/animation-data-model.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../styles/main.css', import.meta.url), 'utf8');

assert.match(popup, /RIG設定/);
assert.match(popup, /clipDuration === 1 && this\._motionEditorMode === 'rig'/);
assert.match(popup, /internalMotionKeyCount/);
assert.match(popup, /rigMotion\?\.boneTracks/);
assert.match(popup, /1\. BONE追加/);
assert.match(popup, /2\. AUTO GRID/);
assert.doesNotMatch(popup, /2\. 絵へ接続/);
assert.match(popup, /meshGenerate\.classList\.toggle\('is-primary', rasterMeshStatus\.state === 'missing'\)/);
assert.match(popup, /meshGenerateShape\.classList\.remove\('is-primary'\)/);
assert.match(popup, /強調された「2\. AUTO GRID」を実行/);
assert.match(popup, /data-rig-raster-part-add[^>]*>全体PIVOT</);
assert.match(popup, /data-rig-raster-to-mesh hidden>曲げBONEへ切替</);
assert.match(popup, /folder\.targetKind === 'raster' && !folder\.part && !folder\.bone\) return;/,
    '未設定Root Raster targetを初期BONEのようにCanvas表示しない');

const laneHandlerStart = popup.indexOf("const rigFolderSetup = e.target.closest('.anim-rig-folder-setup')");
const laneHandlerEnd = popup.indexOf("const boneKeyToggle = e.target.closest('.anim-bone-key-toggle')", laneHandlerStart);
assert.ok(laneHandlerStart >= 0 && laneHandlerEnd > laneHandlerStart);
const laneHandler = popup.slice(laneHandlerStart, laneHandlerEnd);
const rasterEntryEnd = laneHandler.indexOf('const beforeState');
const rasterEntry = laneHandler.slice(0, rasterEntryEnd);
assert.match(rasterEntry, /context\.targetKind === 'raster'/);
assert.match(rasterEntry, /_selectRigRasterProjectionTarget/);
assert.doesNotMatch(rasterEntry, /_ensureFolderRigPivot/, 'RasterのLane入口は保存正本を作らない');

assert.match(popup, /_createSelectedRasterRigidPivot\(\)/);
assert.match(popup, /_switchSelectedRasterPartToMesh\(\)/);
assert.match(popup, /window\.confirm\('絵全体PIVOTとそのMotion keyを削除/);
assert.match(popup, /removeClipAssetRigidRasterTarget/);
assert.match(model, /removeClipAssetRigidRasterTarget\(assetId, layerId\)/);
assert.match(model, /removeRigMotionTargets\(clip\.rigMotion, removal\)/);

assert.match(css, /\.anim-rig-folder-setup\.is-raster-entry/);
assert.match(css, /\.anim-rig-connect-art-btn:not\(:disabled\)/);
assert.match(css, /\.anim-rig-mesh-generate-btn\.is-primary:not\(:disabled\)/);
assert.match(css, /border-width: 2px/);
assert.match(css, /var\(--deformer-bind-line\)/);
assert.match(css, /var\(--deformer-bind-point\)/);

console.log('verify-rig-onboarding-flow-ui: non-mutating entry, AUTO GRID primary path, phantom target suppression and Setup color OK');
