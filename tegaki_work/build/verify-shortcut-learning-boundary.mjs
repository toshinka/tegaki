import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

globalThis.window = {};

const [{ TEGAKI_KEYMAP }, { SettingsPopup }, { QuickAccessPopup }, settingsSource, qtpSource] = await Promise.all([
    import('../config.js'),
    import('../ui/settings-popup.js'),
    import('../ui/quick-access-popup.js'),
    readFile(new URL('../ui/settings-popup.js', import.meta.url), 'utf8'),
    readFile(new URL('../ui/quick-access-popup.js', import.meta.url), 'utf8')
]);

const penEvent = {
    code: 'KeyP',
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    altKey: false,
    repeat: false
};
assert.equal(TEGAKI_KEYMAP.getAction(penEvent), 'TOOL_PEN',
    'existing TOOL_PEN execution remains KeyP');

const penDescriptor = TEGAKI_KEYMAP.getShortcutDescriptor('TOOL_PEN');
assert.deepEqual(penDescriptor, {
    action: 'TOOL_PEN',
    keys: ['P'],
    description: 'ペンツール'
}, 'TOOL_PEN display descriptor derives from the execution authority');
assert.equal(TEGAKI_KEYMAP.getShortcutDescriptor('NOT_AN_ACTION'), null,
    'unknown actions do not create display-only commands');
assert.equal(
    TEGAKI_KEYMAP.getShortcutDescriptor('LAYER_MOVE_UP').keys[0],
    '変形中+↑',
    'context label uses one canonical separator'
);

const shortcutContext = {
    _escapeHtml: SettingsPopup.prototype._escapeHtml
};
const settingsHelpHtml = SettingsPopup.prototype._buildShortcutHelpHtml.call(shortcutContext);
const descriptors = TEGAKI_KEYMAP.getShortcutList();

assert.equal(
    (settingsHelpHtml.match(/data-shortcut-action=/g) || []).length,
    descriptors.length,
    'Settings projects every global action descriptor exactly once'
);
for (const descriptor of descriptors) {
    assert.match(settingsHelpHtml, new RegExp(`data-shortcut-action="${descriptor.action}"`),
        `${descriptor.action} appears in Settings help`);
}
assert.match(settingsHelpHtml, /data-shortcut-action="TOOL_PEN"[\s\S]*?<span class="help-key">P<\/span>/,
    'Settings teaches the canonical Pen shortcut P');
assert.doesNotMatch(settingsSource, /<span class="help-key">B<\/span>/,
    'the stale hand-written Pen B row is removed');
assert.match(settingsSource, /TEGAKI_KEYMAP\.getShortcutList\(\)/,
    'Settings reads the canonical shortcut list');

const qtpControls = [
    { control: 'eyedropper', id: 'qa-eyedropper-btn', action: 'TOOL_EYEDROPPER' },
    { control: 'pen', id: 'qa-pen-tool', action: 'TOOL_PEN' },
    { control: 'eraser', id: 'qa-eraser-tool', action: 'TOOL_ERASER' },
    { control: 'airbrush', id: 'qa-airbrush-tool', action: 'TOOL_AIRBRUSH_BLUR_TOGGLE' },
    { control: 'fill', id: 'qa-fill-tool', action: 'TOOL_FILL' },
    { control: 'lassoFill', id: 'qa-lasso-fill-tool', action: 'TOOL_LASSO_FILL' },
    { control: 'selection', id: 'qa-selection-tool', action: 'TOOL_RECT_SELECTION' }
];
const qtpShortcutContext = {
    _escapeHtml: QuickAccessPopup.prototype._escapeHtml
};

assert.match(qtpSource, /TEGAKI_KEYMAP\.getShortcutDescriptor\(actionName\)/,
    'one QTP helper reads the canonical descriptor');
for (const { control, id, action } of qtpControls) {
    const descriptor = TEGAKI_KEYMAP.getShortcutDescriptor(action);
    const attributes = QuickAccessPopup.prototype._buildShortcutHintAttributes.call(qtpShortcutContext, action);
    const openingTag = qtpSource.match(new RegExp(`<button[^>]*id="${id}"[^>]*>`))?.[0] || '';

    assert.match(qtpSource, new RegExp(`${control}:\\s*'${action}'`),
        `${id} maps to ${action}`);
    assert.match(openingTag, /ui-help-tooltip/,
        `${id} reuses the shared tooltip surface`);
    assert.match(openingTag, new RegExp(`\\$\\{shortcutHints\\.${control}\\}`),
        `${id} projects its canonical hint attributes`);
    assert.doesNotMatch(openingTag, /\stitle=/,
        `${id} does not keep a duplicate native title`);
    assert.match(attributes, new RegExp(`aria-keyshortcuts="${descriptor.keys[0]}"`),
        `${id} exposes ${descriptor.keys[0]} to assistive technology`);
    assert.match(attributes, new RegExp(`data-tooltip="${descriptor.description} · ${descriptor.keys[0]}"`),
        `${id} tooltip uses the canonical description and key`);
}
assert.equal((qtpSource.match(/\$\{shortcutHints\.[A-Za-z]+\}/g) || []).length, qtpControls.length,
    'Phase 8y remains limited to the seven QTP tool controls');

console.log('verify-shortcut-learning-boundary: execution authority, canonical Settings projection and seven QTP tool hints OK');
