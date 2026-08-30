import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../ui/animation-table-popup.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../styles/main.css', import.meta.url), 'utf8');
const phase = readFileSync(new URL('../../開発用資料保管庫/Archive/phase9n.md', import.meta.url), 'utf8');

const rigSetupStart = source.indexOf('id="anim-rig-context"');
const motionStart = source.indexOf('id="anim-part-motion-context"', rigSetupStart);
const warpStart = source.indexOf('id="anim-warp-context"', motionStart);
assert.ok(rigSetupStart >= 0 && motionStart > rigSetupStart && warpStart > motionStart);

const rigSetupDom = source.slice(rigSetupStart, motionStart);
const motionDom = source.slice(motionStart, warpStart);

assert.match(rigSetupDom, /data-rig-mesh-bone-add[^>]*>1\. BONE追加</,
    'static RIG editorはBone作成を引き続き所有する');
assert.match(rigSetupDom, /data-rig-mesh-generate[^>]*>2\. AUTO GRID</,
    'static RIG editorはMesh生成を引き続き所有する');
assert.match(rigSetupDom, /id="anim-rig-weight-toggle"[^>]*>WEIGHT</,
    'static RIG editorはWeight診断を引き続き所有する');
assert.match(rigSetupDom, /id="anim-rig-weight-brush-toggle"[^>]*>BRUSH</,
    'static RIG editorはWeight brushを引き続き所有する');
assert.match(rigSetupDom, /id="anim-rig-mesh-edit-toggle"[^>]*>MESH EDIT</,
    'static RIG editorはMesh editを引き続き所有する');
assert.match(rigSetupDom, /data-rig-parent-bone/,
    'static RIG editorはBone親接続を引き続き所有する');

assert.match(motionDom, /data-rig-open-setup[^>]*>RIGを設定 &gt;</,
    'Motionはstatic setupの代わりにRIG handoffを持つ');
assert.match(motionDom, /data-rig-open-weight[^>]*>WEIGHT表示</,
    'Motionのread-only Weight表示は維持する');
assert.match(motionDom, /id="anim-rig-key-btn"/);
assert.match(motionDom, /id="anim-rig-ik-toggle-btn"/);
assert.match(motionDom, /data-rig-param="x"/);
assert.doesNotMatch(motionDom, /data-rig-mesh-bone-add|data-rig-mesh-generate|data-rig-parent-bone/,
    'Motionへstatic RIG mutation controlを残さない');

const handoffStart = source.indexOf(
    "motionControls.querySelector('[data-rig-open-setup]')?.addEventListener('click'"
);
const handoffEnd = source.indexOf(
    "motionControls.querySelector('[data-rig-open-weight]')",
    handoffStart
);
assert.ok(handoffStart >= 0 && handoffEnd > handoffStart);
const handoff = source.slice(handoffStart, handoffEnd);
assert.match(handoff, /_setMotionTimelineKeyKind\('rig', \{ remember: true \}\)/,
    'RIG handoffは既存RIG tabへ切り替える');
assert.doesNotMatch(handoff, /_generateSelectedRasterBoneSetup|_recordInternalLayerHistory|registerInternal/,
    'RIG handoffはmodel / Historyをmutationしない');

assert.match(source, /RIG設定でMeshを作成するとMotionできます/);
assert.doesNotMatch(source, /data-rig-connect-art|anim-rig-connect-art-btn/,
    '旧Motion direct setup selectorを残さない');
assert.match(css, /\.anim-rig-open-setup-btn:not\(:disabled\)/);
assert.doesNotMatch(css, /\.anim-rig-connect-art-btn/);
assert.match(phase, /Stage D1 — Motion static Setup action cleanup Gate/);
assert.match(phase, /Animation TableのRIG editor全撤去は`NO-GO`/,
    '専用RIG editorを先に消さないGateを文書正本へ固定する');
assert.match(phase, /`RIGを設定 >`を置き、既存RIG tabへ切り替えるだけの無履歴handoff/);

console.log('verify-animation-table-rig-static-cleanup: static editor retained, Motion direct setup removed, navigation-only handoff OK');
