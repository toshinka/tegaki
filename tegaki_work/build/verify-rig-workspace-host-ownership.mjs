import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const popup = readFileSync(new URL('../ui/animation-table-popup.js', import.meta.url), 'utf8');
const renderer = readFileSync(new URL('../ui/layer-panel-renderer.js', import.meta.url), 'utf8');
const phase = readFileSync(new URL('../../task-codex/phase9n.md', import.meta.url), 'utf8');

assert.equal((popup.match(/this\.motionPanel\.id = 'animation-motion-window'/g) || []).length, 1,
    'RIG / Motion / WARPは一つのfloating editor DOMを共有する');
assert.match(popup, /mountPopupAtOverlayRoot\(this\.motionPanel\)/,
    'authoring hostはAnimation Table DOMではなくoverlay rootへmountする');
assert.match(popup, /attachPopupDrag\(this\.motionPanel\)/,
    'single floating hostの既存drag契約を維持する');
assert.match(popup, /aria-labelledby', 'anim-workspace-title'/,
    'mode別titleをmodeless dialogのaccessible nameにする');

const identityStart = popup.indexOf('_getMotionWorkspaceHostIdentity()');
const identityEnd = popup.indexOf('_clampMotionPanelPlacement()', identityStart);
assert.ok(identityStart >= 0 && identityEnd > identityStart);
const identityBlock = popup.slice(identityStart, identityEnd);
assert.match(identityBlock, /title: 'RIG WORKSPACE'/);
assert.match(identityBlock, /title: 'CLIP MOTION'/);
assert.match(identityBlock, /title: 'WARP WORKSPACE'/);
assert.match(identityBlock, /dataset\.workspaceMode = identity\.mode/);
assert.match(identityBlock, /data-workspace-title/);
assert.match(identityBlock, /data-motion-target-strip/);
assert.match(identityBlock, /data-workspace-help-note/);
assert.doesNotMatch(identityBlock, /localStorage|History|rigDefinition|meshDefinitions|skinBindings|rigMotion/,
    'host identityはmodeから導出する表示だけで、第二正本を作らない');

assert.match(renderer, /RIG WORKSPACEで親BONEとPIVOT位置を編集/);
assert.match(renderer, /RIG WORKSPACEでBone \/ Mesh \/ Weightを確認/);
assert.doesNotMatch(renderer, /Animation TableのRIG設定/,
    '右dockのhandoff文言は実際のauthoring hostを指す');
assert.doesNotMatch(renderer, /data-rig-mesh-generate|data-rig-weight-correction|data-rig-parent-bone/,
    '132px右dockへstatic editor controlsを複製しない');

assert.match(phase, /static authoring hostはTable外の既存single floating windowを`RIG WORKSPACE`/);
assert.match(phase, /右dockは132pxの対象・方式・進捗・次操作のoverview \/ handoff/);
assert.match(phase, /window \/ editor \/ selection \/ Historyを複製しない/);

console.log('verify-rig-workspace-host-ownership: right overview, one floating mode host, dynamic identity and no duplicate authority OK');
