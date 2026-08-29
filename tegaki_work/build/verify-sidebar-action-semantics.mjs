import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [
    domBuilder,
    uiPanels,
    albumPopup,
    exportPopup,
    resizePopup,
    quickAccessPopup,
    animationTablePopup,
    settingsPopup,
    keyboardHandler,
    fixture,
    phase
] = await Promise.all([
    readFile(new URL('../ui/dom-builder.js', import.meta.url), 'utf8'),
    readFile(new URL('../ui/ui-panels.js', import.meta.url), 'utf8'),
    readFile(new URL('../ui/album-popup.js', import.meta.url), 'utf8'),
    readFile(new URL('../ui/export-popup.js', import.meta.url), 'utf8'),
    readFile(new URL('../ui/resize-popup.js', import.meta.url), 'utf8'),
    readFile(new URL('../ui/quick-access-popup.js', import.meta.url), 'utf8'),
    readFile(new URL('../ui/animation-table-popup.js', import.meta.url), 'utf8'),
    readFile(new URL('../ui/settings-popup.js', import.meta.url), 'utf8'),
    readFile(new URL('../ui/keyboard-handler.js', import.meta.url), 'utf8'),
    readFile(new URL('./phase9i-sidebar-action-semantics-fixture.html', import.meta.url), 'utf8'),
    readFile(new URL('../../開発用資料保管庫/Archive/phase9i.md', import.meta.url), 'utf8')
]);

const popupLaunchers = [
    ['library-tool', 'album', 'album-popup'],
    ['export-tool', 'export', 'export-popup'],
    ['resize-tool', 'resize', 'resize-settings'],
    ['quick-access-tool', 'quickAccess', 'quick-access-popup'],
    ['gif-animation-tool', 'animationTable', 'animation-table-popup'],
    ['settings-tool', 'settings', 'settings-popup']
];
for (const [id, popupName, controls] of popupLaunchers) {
    const descriptor = new RegExp(`id: '${id}'[^\\n]*role: 'popup-launcher'[^\\n]*popupName: '${popupName}'[^\\n]*controls: '${controls}'`, 'u');
    assert.match(domBuilder, descriptor, `${id} keeps popup-launcher semantics and its controlled panel`);
}
assert.match(domBuilder, /id: 'image-import-tool'[^\n]*role: 'command'/u,
    'Import remains a one-shot command');
assert.match(domBuilder, /id: 'layer-transform-tool'[^\n]*role: 'temporary-mode'/u,
    'V remains a temporary mode');
assert.match(domBuilder, /const btn = createElement\('button'[\s\S]*?'data-sidebar-role': tool\.role/u,
    'all entries use a native keyboard-operable button with explicit role metadata');
assert.match(domBuilder, /isPopupLauncher[\s\S]*?'aria-controls': tool\.controls[\s\S]*?'aria-expanded': 'false'[\s\S]*?'aria-haspopup': 'dialog'/u);
assert.match(domBuilder, /isTemporaryMode[\s\S]*?'aria-pressed': 'false'/u);

assert.match(uiPanels, /const SIDEBAR_POPUP_BUTTONS = Object\.freeze\([\s\S]*?animationTable: 'gif-animation-tool'[\s\S]*?settings: 'settings-tool'/u);
assert.match(uiPanels, /popup:shown[\s\S]*?setSidebarPopupExpanded\(name, true\)/u);
assert.match(uiPanels, /popup:hidden[\s\S]*?setSidebarPopupExpanded\(name, false\)/u);
assert.match(uiPanels, /setSidebarPopupExpanded\(popupName, expanded\)[\s\S]*?aria-expanded[\s\S]*?classList\.remove\('active'\)/u,
    'internal close clears both semantic and legacy Animation Table active projections');
assert.match(uiPanels, /setSidebarModePressed\(buttonId, pressed\)[\s\S]*?aria-pressed/u);
assert.match(uiPanels, /querySelector\('\.sidebar'\)\?\.addEventListener\('keydown'[\s\S]*?e\.key !== 'Enter'[\s\S]*?toolButton\.click\(\)/u,
    'Sidebar Enter / Space explicitly delegates to the same click action');
assert.match(uiPanels, /handleToolClick\(toolButton\)[\s\S]*?if \(e\.detail > 0\) toolButton\.blur\(\)/u,
    'pointer and pen activation release Sidebar focus so plain Space returns to the Canvas');
assert.match(keyboardHandler, /shouldYieldSidebarButtonActivation\(e\)[\s\S]*?\.sidebar \.tool-button/u,
    'Sidebar native button owns unmodified Enter / Space activation');
assert.match(keyboardHandler, /if \(shouldYieldSidebarButtonActivation\(e\)\) return;/u);
assert.match(animationTablePopup, /if \(e\.key === 'Escape' && this\.isVisible\)[\s\S]*?this\.hide\(\)[\s\S]*?stopImmediatePropagation\(\)/u,
    'unhandled Animation Table Escape closes through the same visibility authority');

const popupSources = [
    ['album', albumPopup],
    ['export', exportPopup],
    ['resize', resizePopup],
    ['quickAccess', quickAccessPopup],
    ['animationTable', animationTablePopup],
    ['settings', settingsPopup]
];
for (const [name, source] of popupSources) {
    assert.match(source, new RegExp(`popup:shown[^\\n]*name: '${name}'`, 'u'), `${name} emits shown from its visibility authority`);
    assert.match(source, new RegExp(`popup:hidden[^\\n]*name: '${name}'`, 'u'), `${name} emits hidden from its visibility authority`);
}

for (const role of ['command', 'popup-launcher', 'temporary-mode']) {
    assert.match(fixture, new RegExp(`data-role="${role}"`, 'u'), `fixture fixes ${role}`);
}
assert.match(fixture, /aria-expanded="true"/u);
assert.match(fixture, /aria-pressed="true"/u);
assert.match(phase, /Gate 0 GO（B Role-aware semantic normalization）/u);
assert.match(phase, /C 全popup \/ commandのpersistent active化:[^\n]*HOLD/u);

console.log('verify-sidebar-action-semantics: 6 popup launchers, 1 command, 1 temporary mode and all visibility projections OK');
