import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [index, mainCss, componentCss, renderer, fixture, phase] = await Promise.all([
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../styles/main.css', import.meta.url), 'utf8'),
    readFile(new URL('../styles/components/layer-panel-surface.css', import.meta.url), 'utf8'),
    readFile(new URL('../ui/layer-panel-renderer.js', import.meta.url), 'utf8'),
    readFile(new URL('./phase9j-layer-panel-theme-surface-fixture.html', import.meta.url), 'utf8'),
    readFile(new URL('../../開発用資料保管庫/Archive/phase9j.md', import.meta.url), 'utf8')
]);

const mainIndex = index.indexOf('styles/main.css');
const layerSurfaceIndex = index.indexOf('styles/components/layer-panel-surface.css');
assert.ok(mainIndex >= 0 && layerSurfaceIndex > mainIndex,
    'Layer Panel component appearance loads after shared theme tokens');
assert.equal(index.match(/styles\/components\/layer-panel-surface\.css/g)?.length, 1,
    'Layer Panel component stylesheet is loaded once');

for (const token of [
    '--ui-layer-surface-rail',
    '--ui-layer-surface-caf',
    '--ui-layer-surface-card',
    '--ui-layer-surface-folder-open',
    '--ui-layer-surface-folder-closed',
    '--ui-layer-border-rest',
    '--ui-layer-border-card',
    '--ui-layer-border-selected',
    '--ui-layer-border-active',
    '--ui-layer-text'
]) {
    assert.match(mainCss, new RegExp(`${token}:`), `${token} is in the root theme authority`);
    assert.match(componentCss, new RegExp(`var\\(${token}\\)`), `${token} is consumed by the component appearance`);
}

for (const selector of [
    '.right-panel .layer-controls-row',
    '.right-panel .caf-simple-group',
    '.right-panel .clip-layer-mirror-row',
    '.right-panel .legacy-layer-card-row',
    '.right-panel .legacy-layer-card-row.is-folder.is-collapsed'
]) {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    assert.match(componentCss, new RegExp(`${escaped}\\s*\\{`), `${selector} has one scoped static owner`);
}

const styleState = renderer.match(/_createLegacyLayerCardRowStyleState\([\s\S]*?\n\s*\}\n\s*_createLayerPanelCardRowModel/u)?.[0] || '';
assert.ok(styleState, 'legacy row runtime style projection exists');
assert.match(styleState, /--card-row-width[\s\S]*?--card-row-margin-left/u,
    'runtime projection retains only row geometry');
assert.doesNotMatch(styleState, /#[0-9a-f]{3,8}|rgba?\(|--card-row-(?:bg|border)|--legacy-card-(?:bg|border)/iu,
    'runtime projection no longer owns fixed surface or border appearance');
assert.match(renderer, /isCollapsed:\s*isFolder && layer\?\.layerData\?\.folderExpanded !== true/u,
    'existing folder state is projected as a class for CSS theme authority');

for (const theme of ['current-warm', 'stronger-shell', 'controlled-inverse']) {
    assert.match(fixture, new RegExp(`data-theme="${theme}"`), `${theme} comparison exists`);
}
assert.match(fixture, /同じDOM・同じ状態をCSS tokenだけで比較/u);
assert.match(fixture, /--candidate-umber:\s*#60463f/u,
    'stronger shell comparison uses a muted umber candidate rather than production maroon');
assert.match(phase, /Gate 0=`GO — B: computed-equivalent theme bridge`/u);
assert.match(phase, /A Current warm: \*\*GO — Phase 9j production\*\*/u,
    'Phase 9j production keeps the current warm appearance');
assert.match(phase, /左Sidebar、右rail、外周背景を一体で比較/u,
    'darker chrome is deferred to an integrated outer-shell gate');
assert.match(phase, /production dark mode \/ theme picker \/ Project・localStorage保存flag/u);

console.log('verify-layer-panel-theme-surface: theme tokens, CSS-only static authority, runtime geometry and three-way gate OK');
