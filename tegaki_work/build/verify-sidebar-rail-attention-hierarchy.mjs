import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [
    index,
    mainCss,
    sidebarCss,
    uiPanels,
    domBuilder,
    fixture
] = await Promise.all([
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../styles/main.css', import.meta.url), 'utf8'),
    readFile(new URL('../styles/components/sidebar-rail.css', import.meta.url), 'utf8'),
    readFile(new URL('../ui/ui-panels.js', import.meta.url), 'utf8'),
    readFile(new URL('../ui/dom-builder.js', import.meta.url), 'utf8'),
    readFile(new URL('./phase9h-sidebar-rail-attention-hierarchy-fixture.html', import.meta.url), 'utf8')
]);

const mainIndex = index.indexOf('styles/main.css');
const sidebarIndex = index.indexOf('styles/components/sidebar-rail.css');
assert.ok(mainIndex >= 0 && sidebarIndex > mainIndex,
    'semantic tokens load before the Sidebar component stylesheet');

const baseToolRule = mainCss.match(/\.tool-button\s*\{[\s\S]*?\n\}/u)?.[0] || '';
assert.ok(baseToolRule, 'shared Sidebar geometry rule exists');
assert.match(baseToolRule, /width:\s*var\(--ui-rail-control-size\)/u);
assert.match(baseToolRule, /height:\s*var\(--ui-rail-control-size\)/u);
assert.doesNotMatch(baseToolRule, /(?:border|background|border-radius|transition):/u,
    'static Sidebar appearance is not duplicated in main.css');
assert.match(mainCss, /--ui-rail-control-size:\s*30px;/u,
    'normal pointer hit dimension stays 30px');
assert.match(mainCss, /@media \(pointer:\s*coarse\)[\s\S]*?--ui-rail-control-size:\s*38px;/u,
    'coarse pointer hit dimension stays 38px');

assert.match(sidebarCss, /\.sidebar \.tool-button\s*\{[\s\S]*?border:\s*1px solid var\(--ui-border-subtle\)/u,
    'resting controls keep a transparent layout border');
assert.match(sidebarCss, /background:\s*var\(--ui-surface-control\)/u);
assert.match(sidebarCss, /\.sidebar \.tool-button:hover[^\{]*\{[\s\S]*?border-color:\s*var\(--ui-border-hover\)[\s\S]*?background:\s*var\(--ui-surface-control-hover\)/u,
    'hover restores both surface and boundary');
assert.match(sidebarCss, /\.sidebar \.tool-button\.active,[\s\S]*?\.sidebar \.tool-button\[aria-pressed="true"\][\s\S]*?border:\s*2px solid var\(--ui-border-active\)[\s\S]*?box-shadow:\s*var\(--ui-shadow-control-active\)/u,
    'active class and pressed state share the accepted ring');
assert.match(sidebarCss, /\.sidebar \.tool-button:focus-visible\s*\{[\s\S]*?outline:\s*2px solid var\(--active-border\)/u,
    'keyboard focus remains explicit');
assert.match(sidebarCss, /\.sidebar \.tool-button:disabled,[\s\S]*?\[aria-disabled="true"\][\s\S]*?opacity:\s*var\(--ui-opacity-disabled\)/u,
    'disabled state remains explicit');
assert.doesNotMatch(sidebarCss, /!important/u,
    'component scope wins without important overrides');
assert.doesNotMatch(sidebarCss, /(?:^|\n)\s*(?:width|height|min-width|min-height|max-width|max-height|position|left|top|z-index|touch-action):/u,
    'component stylesheet does not own rail geometry or pointer behavior');

assert.doesNotMatch(uiPanels, /setupPanelStyles|data-tegaki-panels/u,
    'legacy runtime-injected Sidebar skin is removed');
assert.match(uiPanels, /setSidebarPopupExpanded\(popupName, expanded\)[\s\S]*?classList\.toggle\('is-active',[\s\S]*?setAttribute\('aria-expanded'/u,
    'popup launcher visibility projects to active appearance and expanded semantics');
assert.match(uiPanels, /setSidebarModePressed\(buttonId, pressed\)[\s\S]*?classList\.toggle\('is-active',[\s\S]*?setAttribute\('aria-pressed'/u,
    'temporary V mode keeps pressed semantics');
assert.match(uiPanels, /updateToolUI\(tool\)[\s\S]*?classList\.remove\('active', 'erase-mode'\)[\s\S]*?classList\.add\('active'\)/u,
    'existing Animation Table active projection remains unchanged');

const expectedToolOrder = [
    'library-tool',
    'image-import-tool',
    'export-tool',
    'resize-tool',
    'quick-access-tool',
    'layer-transform-tool',
    'gif-animation-tool',
    'settings-tool'
];
let previousIndex = -1;
for (const id of expectedToolOrder) {
    const toolIndex = domBuilder.indexOf(`id: '${id}'`);
    assert.ok(toolIndex > previousIndex, `${id} keeps the established Sidebar order`);
    previousIndex = toolIndex;
}
assert.match(domBuilder, /id: 'quick-access-tool'[^\n]*role: 'popup-launcher'/u);
assert.match(domBuilder, /id: 'layer-transform-tool'[^\n]*role: 'temporary-mode'/u);
assert.match(domBuilder, /const btn = createElement\('button'/u,
    'all Sidebar entries use the accepted native button geometry and focus path');

for (const variant of ['current', 'quiet-resting', 'color-bar']) {
    assert.match(fixture, new RegExp(`data-variant="${variant}"`, 'u'),
        `fixture keeps ${variant} comparison`);
}
assert.match(fixture, /B · Quiet Resting[\s\S]*?FIRST CANDIDATE/u,
    'Gate 0 keeps B as the first candidate');
assert.match(fixture, /C · Color Bar Only[\s\S]*?HOLD/u,
    'color-bar-only treatment remains held outside production');

console.log('verify-sidebar-rail-attention-hierarchy: static CSS authority, role-aware states, order and 30/38px hit contracts OK');
