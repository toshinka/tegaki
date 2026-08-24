import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

globalThis.window = {};

const [{ TEGAKI_KEYMAP }, { QuickAccessPopup }, phase, fixture, qtpSource] = await Promise.all([
    import('../config.js'),
    import('../ui/quick-access-popup.js'),
    readFile(new URL('../../開発用資料保管庫/Archive/phase8z.md', import.meta.url), 'utf8'),
    readFile(new URL('./phase8z-touch-shortcut-help-fixture.html', import.meta.url), 'utf8'),
    readFile(new URL('../ui/quick-access-popup.js', import.meta.url), 'utf8')
]);

assert.match(phase, /Gate 1=`GO — C: 明示read-only shortcut deck`/,
    'Phase 8z fixes the explicit read-only deck decision');
assert.match(phase, /tool button長押しで説明する \| REJECT/,
    'long press is explicitly rejected for the first slice');
assert.match(phase, /通常tool buttonのpointerdownは変更しない/,
    'the existing one-tap tool action remains an acceptance boundary');

for (const variant of ['settings-only', 'long-press', 'explicit-deck']) {
    assert.match(fixture, new RegExp(`data-variant="${variant}"`),
        `fixture includes ${variant}`);
}
for (const key of ['P', 'E', 'B', 'G', 'L', 'M', 'I']) {
    assert.match(fixture, new RegExp(`<kbd>${key}</kbd>`),
        `recommended deck shows ${key}`);
}

assert.match(qtpSource, /element\.addEventListener\('pointerdown',[\s\S]*?handler\(e\)/,
    'Stage A audit is grounded in the current immediate pointerdown tool action');
assert.doesNotMatch(qtpSource, /long.?press|pressTimer|holdTimer/i,
    'production QTP has no inferred long-press mechanism before Stage B');

const shortcutDeckHtml = QuickAccessPopup.prototype._buildShortcutHelpDeckHtml.call({
    _escapeHtml: QuickAccessPopup.prototype._escapeHtml
});
const shortcutActions = [
    ['eyedropper', 'TOOL_EYEDROPPER'],
    ['pen', 'TOOL_PEN'],
    ['eraser', 'TOOL_ERASER'],
    ['airbrush', 'TOOL_AIRBRUSH_BLUR_TOGGLE'],
    ['fill', 'TOOL_FILL'],
    ['lassoFill', 'TOOL_LASSO_FILL'],
    ['selection', 'TOOL_RECT_SELECTION']
];
assert.equal((shortcutDeckHtml.match(/data-shortcut-control=/g) || []).length, 7,
    'production deck renders exactly seven read-only rows');
for (const [control, action] of shortcutActions) {
    const descriptor = TEGAKI_KEYMAP.getShortcutDescriptor(action);
    assert.match(qtpSource, new RegExp(`data-shortcut-control`),
        `${control} is represented by the production deck template`);
    assert.match(shortcutDeckHtml, new RegExp(`data-shortcut-control="${control}"`),
        `${control} appears in the production deck`);
    assert.match(shortcutDeckHtml, new RegExp(`<span class="qa-shortcut-help-label">${descriptor.description}</span>`),
        `${control} uses the canonical description`);
    assert.match(shortcutDeckHtml, new RegExp(`<span class="qa-shortcut-help-key">${descriptor.keys[0]}</span>`),
        `${control} uses the canonical key`);
}
assert.match(qtpSource, /id="qa-shortcut-help-toggle"[\s\S]*aria-expanded="false"/,
    'explicit help toggle starts closed');
assert.match(qtpSource, /id="qa-shortcut-help-deck"[^>]*role="dialog"[^>]*hidden/,
    'shortcut deck is a read-only hidden dialog surface');
assert.match(qtpSource, /this\._setupShortcutHelpControls\(\)/,
    'shortcut deck lifecycle is initialized with QTP');
assert.match(qtpSource, /this\._setShortcutHelpOpen\(false\)/,
    'shortcut deck closes on lifecycle / outside paths');
assert.match(qtpSource, /document\.addEventListener\('keydown', this\.shortcutHelpKeydownHandler\)/,
    'shortcut deck supports keyboard Escape close');
assert.match(qtpSource, /@media \(pointer: coarse\)[\s\S]*?\.qa-shortcut-help-toggle,[\s\S]*?width: 24px;[\s\S]*?height: 24px;/,
    'touch shortcut entry keeps the established coarse QTP hit size');
assert.match(qtpSource, /width: min\(198px, calc\(100vw - 24px\)\)/,
    'shortcut deck remains readable beyond the compact QTP panel width');
assert.match(qtpSource, /_positionShortcutHelpDeck\(\)[\s\S]*?window\.innerWidth[\s\S]*?window\.innerHeight/,
    'shortcut deck is clamped to the current viewport');
assert.match(qtpSource, /target\.closest\('\.qa-shortcut-help-deck'\)/,
    'read-only deck pointer movement does not begin QTP panel drag');
assert.match(qtpSource, /this\._setShortcutHelpOpen\(false\);\s*this\.isDraggingPanel = true/,
    'starting a QTP drag closes the transient shortcut deck');
assert.match(qtpSource, /window\.removeEventListener\('resize', this\.shortcutHelpResizeHandler\)/,
    'shortcut deck resize lifecycle is removed on destroy');
assert.doesNotMatch(shortcutDeckHtml, /<button/,
    'shortcut deck rows are non-executing read-only content');
assert.doesNotMatch(qtpSource, /shortcutHelp.*localStorage|localStorage.*shortcutHelp/i,
    'shortcut deck has no persistence key');

console.log('verify-touch-shortcut-help-gate: three-option fixture and GO-C boundary OK');
