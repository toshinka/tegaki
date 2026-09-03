import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRigWorkspaceFocusShellPlan } from '../system/animation/rig-workspace-focus-shell.js';

const buildDir = path.dirname(fileURLToPath(import.meta.url));
const workDir = path.resolve(buildDir, '..');
const popupSource = fs.readFileSync(path.join(workDir, 'ui/animation-table-popup.js'), 'utf8');
const cssSource = fs.readFileSync(path.join(workDir, 'styles/main.css'), 'utf8');

const expandedRig = createRigWorkspaceFocusShellPlan({ editorMode: 'rig' });
assert.equal(expandedRig.compactSupported, true);
assert.equal(expandedRig.compactApplied, false);
assert.equal(expandedRig.detailExpanded, true);
assert.equal(expandedRig.buttonLabel, 'CANVAS');

const compactRig = createRigWorkspaceFocusShellPlan({
    editorMode: 'rig',
    compactRequested: true
});
assert.equal(compactRig.compactApplied, true);
assert.equal(compactRig.detailExpanded, false);
assert.equal(compactRig.buttonLabel, 'DETAIL');

const compactMotion = createRigWorkspaceFocusShellPlan({
    editorMode: 'motion',
    compactRequested: true
});
assert.equal(compactMotion.compactApplied, true);

const warp = createRigWorkspaceFocusShellPlan({
    editorMode: 'warp',
    compactRequested: true
});
assert.equal(warp.compactSupported, false);
assert.equal(warp.compactApplied, false);
assert.equal(warp.compactRequested, true, 'WARP往復後にruntime要求を復帰できる');

assert.match(popupSource, /this\._motionDetailCollapsed\s*=\s*false/, 'Focus shell stateはruntimeだけで初期化する');
assert.match(popupSource, /createRigWorkspaceFocusShellPlan/, '表示はpure projectionへ委譲する');
assert.match(popupSource, /data-motion-shell-toggle/, '既存CLIP MOTION headerに可逆toggleを置く');
assert.match(popupSource, /_clampMotionPanelPlacement\(\)/, 'compact / viewport変更後もfloating popupを画面内へ保つ');

const toggleBlock = popupSource.match(/_toggleMotionDetailCollapsed\(\)\s*\{[\s\S]*?\n\s*\}/)?.[0] || '';
assert.ok(toggleBlock, 'Focus shell toggle実装が存在する');
assert.doesNotMatch(toggleBlock, /localStorage|_saveUiPreferences|history|rigDefinition|rigMotion/i,
    'toggleは保存・History・Rig正本を変更しない');

const activeToggleStyle = cssSource.match(/\.anim-motion-shell-toggle\.active\s*\{[\s\S]*?\}/)?.[0] || '';
assert.ok(activeToggleStyle, 'Focus shell active styleが存在する');
assert.match(activeToggleStyle, /color:\s*var\(--futaba-maroon\)/,
    '淡いactive背景で共通flip-buttonのinverse文字色を継承しない');

console.log('verify-rig-workspace-focus-shell: runtime projection / WARP hold / contrast / no save-history authority OK');
