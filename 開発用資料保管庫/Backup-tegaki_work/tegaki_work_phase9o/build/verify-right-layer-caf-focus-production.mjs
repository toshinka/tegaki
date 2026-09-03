import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [renderer, mainCss, componentCss, table, phase, followupPhase] = await Promise.all([
    readFile(new URL('../ui/layer-panel-renderer.js', import.meta.url), 'utf8'),
    readFile(new URL('../styles/main.css', import.meta.url), 'utf8'),
    readFile(new URL('../styles/components/layer-panel-surface.css', import.meta.url), 'utf8'),
    readFile(new URL('../ui/animation-table-popup.js', import.meta.url), 'utf8'),
    readFile(new URL('../../開発用資料保管庫/Archive/phase9l.md', import.meta.url), 'utf8'),
    readFile(new URL('../../開発用資料保管庫/Archive/phase9m.md', import.meta.url), 'utf8')
]);

const focusedProjectionStart = renderer.indexOf('_resolveFocusedCafProjectionGroup(');
const focusedProjectionEnd = renderer.indexOf('\n    _createCafHeaderTextHtml(className', focusedProjectionStart);
const focusedProjection = focusedProjectionStart >= 0 && focusedProjectionEnd > focusedProjectionStart
    ? renderer.slice(focusedProjectionStart, focusedProjectionEnd)
    : '';
assert.ok(focusedProjection, 'focused CAF projection helper and renderer exist');
assert.match(focusedProjection, /selectedCelId[\s\S]*?selectedAssetId[\s\S]*?groups\[0\]/u,
    'focused CAF resolves from existing selection identities with a display-only fallback');
assert.match(focusedProjection, /caf-simple-header caf-simple-header--flat/u,
    'production CAF projection uses the flat component state');
assert.match(focusedProjection, /\[focusedGroup\]\.forEach/u,
    'only the focused CAF group is projected in the right Layer Panel');
assert.match(focusedProjection, /caf-simple-context-icon[\s\S]*?UI_ICONS\.animation/u,
    'CAF context uses an animation identity instead of a Folder toggle');
assert.doesNotMatch(focusedProjection, /group\.clips\.forEach/u,
    'peer CAF assets are not stacked as right-panel Folder children');
assert.match(focusedProjection, /_createClipAssetLayerMirrorElement/u,
    'focused CAF still projects its internal Layer and Folder list');

const pointerEntriesStart = renderer.indexOf('_getLayerPanelCardPointerDragEntries() {');
const pointerEntriesEnd = renderer.indexOf('\n    _getClipLayerMirrorCardDragOptions() {', pointerEntriesStart);
const pointerEntries = pointerEntriesStart >= 0 && pointerEntriesEnd > pointerEntriesStart
    ? renderer.slice(pointerEntriesStart, pointerEntriesEnd)
    : '';
assert.ok(pointerEntries, 'Layer Panel pointer D&D registration exists');
assert.match(pointerEntries, /legacy-layer-card/u,
    'normal Layer and Folder pointer D&D remains registered');
assert.match(pointerEntries, /clip-layer-mirror/u,
    'Owner follow-up restores CAF internal Layer D&D through the existing adapter');
assert.match(table, /moveInternalLayerToPosition/u,
    'Animation Table keeps CAF internal Layer hierarchy mutation authority');
assert.match(followupPhase, /pointer D&D入口[\s\S]*?既存`_getClipLayerMirrorCardDragOptions/u,
    'the current phase records the scoped post-close restoration without changing model authority');
assert.match(renderer, /_isClipAssetInternalLayerDescendantOf[\s\S]*?_selectClipLayerMirrorRowDirect/u,
    'collapsing the selected target ancestry keeps one visible focus through the existing selection adapter');

for (const selector of [
    '.caf-simple-group--flat',
    '.caf-simple-group-title--flat',
    '.caf-simple-header--flat .clip-layer-mirror-row'
]) {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    assert.match(`${mainCss}\n${componentCss}`, new RegExp(`${escaped}\\s*\\{`),
        `${selector} has a scoped production rule`);
}
assert.match(componentCss, /\.caf-simple-group--flat\.is-selected[\s\S]*?border:\s*0[\s\S]*?background:\s*transparent/u,
    'CAF identity no longer presents as a selected Folder card');
assert.match(componentCss, /\.caf-simple-header--flat \.clip-layer-mirror-row[\s\S]*?--card-row-selected-bg:\s*var\(--ui-layer-surface-focus\)/u,
    'the selected internal target receives the single semantic focus surface');
assert.match(componentCss, /\.caf-simple-header--flat \.clip-layer-mirror-row\.is-selected[\s\S]*?background:\s*var\(--ui-layer-surface-focus\)/u,
    'the flat selected row wins over the shared mirror-card background specificity');
assert.match(componentCss, /\.clip-layer-mirror-row\.is-selected \.clip-layer-mirror-thumb[\s\S]*?background-color:\s*var\(--ui-layer-surface-thumb-protect\)\s*!important[\s\S]*?background-clip:\s*content-box\s*!important/u,
    'the selected thumbnail protects its visible content inside the orange focus perimeter');
assert.doesNotMatch(componentCss, /(?:#000(?:000)?(?![0-9a-f])|#fff(?:fff)?(?![0-9a-f])|\bblack\b|\bwhite\b|\bgray\b)/iu,
    'the production slice adds no black, white or neutral gray literal');

assert.match(phase, /Gate 0=`GO — D: Flat CAF context \+ unified layer list`/u);
assert.match(phase, /LayerSystem|TimelineModel/u,
    'Phase authority keeps the normal Layer and CAF model boundary explicit');

console.log('verify-right-layer-caf-focus-production: focused flat projection, single active surface, restored adapter D&D and model boundary OK');
