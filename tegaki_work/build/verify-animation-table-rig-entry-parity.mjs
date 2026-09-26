import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const popup = readFileSync(new URL('../ui/animation-table-popup.js', import.meta.url), 'utf8');
const renderer = readFileSync(new URL('../ui/layer-panel-renderer.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../styles/main.css', import.meta.url), 'utf8');
const componentCss = readFileSync(new URL('../styles/components/layer-panel-surface.css', import.meta.url), 'utf8');
const phase = readFileSync(new URL('../../開発用資料保管庫/Archive/phase9n.md', import.meta.url), 'utf8');

assert.match(popup, /anim-rig-lane-status[^>]*aria-label="RIG未設定">未設定</,
    '未設定Laneはborderless statusだけを表示する');
assert.doesNotMatch(popup, /anim-rig-folder-setup(?=["'`${\s])/,
    '未設定Laneへstatic Setup buttonを残さない');
assert.match(css, /\.anim-rig-lane-status\s*\{[\s\S]*?color: var\(--futaba-medium\);[\s\S]*?opacity: 0\.72;/u);
assert.doesNotMatch(css, /\.anim-rig-folder-setup(?=[:.,{\s])/);

const trackHandlerStart = popup.indexOf("const rigFolderItem = e.target.closest('.anim-rig-folder-track-item')");
const trackHandlerEnd = popup.indexOf("const includeBtn = e.target.closest('.anim-lane-include-btn')", trackHandlerStart);
assert.ok(trackHandlerStart >= 0 && trackHandlerEnd > trackHandlerStart);
const trackHandler = popup.slice(trackHandlerStart, trackHandlerEnd);
assert.match(trackHandler, /context\.targetKind === 'raster' && !context\.part/);
assert.match(trackHandler, /_selectRigRasterProjectionTarget/);
assert.match(trackHandler, /_selectRigFolderProjectionTarget/);
assert.match(trackHandler, /focusRig: false/);
assert.match(trackHandler, /openInspector: false/);
assert.doesNotMatch(trackHandler, /_ensureFolderRigPivot|_recordInternalLayerHistory|focusRig: true|openInspector: true/,
    'Lane行は選択だけを行いstatic Setup / Historyへ入らない');

const cellHandlerStart = popup.indexOf("if (slot.classList.contains('anim-rig-folder-cell-slot'))");
const cellHandlerEnd = popup.indexOf("if (slot.classList.contains('anim-bone-cell-slot'))", cellHandlerStart);
assert.ok(cellHandlerStart >= 0 && cellHandlerEnd > cellHandlerStart);
const cellHandler = popup.slice(cellHandlerStart, cellHandlerEnd);
assert.match(cellHandler, /_selectRigRasterProjectionTarget/);
assert.match(cellHandler, /_selectRigFolderProjectionTarget/);
assert.match(cellHandler, /focusRig: false/);
assert.match(cellHandler, /openInspector: false/);
assert.doesNotMatch(cellHandler, /_ensureFolderRigPivot|_recordInternalLayerHistory|focusRig: true|openInspector: true/,
    'Timeline cellはFrame / target選択だけを行う');

assert.match(popup, /data-motion-target-strip/,
    'CLIP MOTION target stripはeditor内target lensとして維持する');
assert.match(popup, /button\.dataset\.motionTarget/);
assert.match(popup, /data-rig-open-setup[^>]*>RIGを設定 &gt;</,
    'Motion未接続targetには明示RIG handoffを維持する');

assert.doesNotMatch(renderer, /context-rig-(?:open-bend|register|hierarchy-open|root-pivot)-button/u,
    'Layer no longer renders normal RIG setup or legacy editor entry controls');
assert.match(renderer, /getRigLensLegacyFallbackTarget\?\.[\s\S]*?openInternalRigidHierarchyFromExternal[\s\S]*?openInternalRasterRigSetupFromExternal/u,
    'Layer fallback rechecks eligibility and routes to the existing legacy editor');
assert.doesNotMatch(renderer, /_createContextDockViewSwitch|_createCafRigInspectorElement/u,
    'the retired Layer RIG inspector has no render path');
assert.doesNotMatch(css + componentCss, /layer-panel-context-view-switch|layer-panel-context-view-button/u,
    'the obsolete LAYERS / RIG view switch has no styling');
assert.match(renderer, /textContent = '旧RIGで開く'/u,
    'legacy editing is presented with an explicit secondary-action label');

assert.match(phase, /Stage D2 — Lane \/ CLIP MOTION target entry parity Gate/);
assert.match(phase, /CLIP MOTIONのtarget stripは[\s\S]*focus lens/);
assert.match(phase, /`focusRig \/ openInspector`はfalse、Historyは0件/);

console.log('verify-animation-table-rig-entry-parity: Lane selection-only, CLIP MOTION target lens retained, conditional legacy fallback OK');
