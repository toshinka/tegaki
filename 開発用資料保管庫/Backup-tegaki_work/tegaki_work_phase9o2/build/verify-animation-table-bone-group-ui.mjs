import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const popupSource = readFileSync(new URL('../ui/animation-table-popup.js', import.meta.url), 'utf8');
const cssSource = readFileSync(new URL('../styles/main.css', import.meta.url), 'utf8');

assert.match(popupSource, /createAnimationTableBoneGroupProjection/);
assert.match(popupSource, /this\._rigBoneGroupCollapsed\s*=\s*new Set\(\)/, 'collapseはruntime stateだけを持つ');
assert.match(popupSource, /group\.groupKind !== 'target' \|\| bones\.length >= 2/, 'singleton targetは従来Bone行を維持する');
assert.match(popupSource, /item\.group\.targetLayerId/, '一意targetをInspector用fallbackより優先する');
assert.match(popupSource, /anim-rig-bone-group-row/);
assert.match(popupSource, /anim-rig-bone-group-timeline-row/);
assert.match(popupSource, /selectedKeyCountByBoneId/, 'collapse headerへ選択keyを投影する');
assert.match(popupSource, /\$\{activeIndicator\}\$\{selectedKeyIndicator\}/, 'active Boneと選択keyを同時に通知する');

const toggleBlock = popupSource.match(/const rigBoneGroupToggle[\s\S]*?const boneKeyToggle/)?.[0] || '';
assert.match(toggleBlock, /_rigBoneGroupCollapsed\.(has|add|delete)/);
assert.doesNotMatch(toggleBlock, /_clearMotionTimelineKeySelection|setClipRigMotion|history/i, 'collapseは選択・Rig・Historyを変更しない');

assert.match(cssSource, /\.anim-rig-bone-group-toggle[\s\S]*?color:\s*var\(--futaba-maroon\)/);
assert.match(cssSource, /\.anim-rig-bone-group-timeline-row[\s\S]*?pointer-events:\s*none/);
const groupCss = cssSource.match(/\.animation-table-panel \.anim-rig-bone-group-row[\s\S]*?\.anim-motion-curve-fields/)?.[0] || '';
assert.doesNotMatch(groupCss, /#(?:000|fff)|\b(?:black|gray)\b|color:\s*white\b/i);

console.log('verify-animation-table-bone-group-ui: dense-only header / mirrored rows / runtime collapse / selection boundary OK');
