import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../ui/animation-table-popup.js', import.meta.url), 'utf8');
const templateStart = source.indexOf('this.panel.innerHTML = `');
const templateEnd = source.indexOf('document.body.appendChild(this.panel);', templateStart);
assert.ok(templateStart >= 0 && templateEnd > templateStart, 'Animation Table template exists');
const template = source.slice(templateStart, templateEnd);

for (const id of [
    'anim-scope-current-btn',
    'anim-scope-focus-deck',
    'anim-scope-all-btn',
    'anim-scope-lane-btn',
    'anim-scope-set-btn'
]) {
    assert.equal(template.split(`id="${id}"`).length - 1, 1, `${id} remains unique`);
}

assert.match(template, /id="anim-scope-current-btn"[\s\S]*?aria-haspopup="menu"[\s\S]*?aria-expanded="false"/);
assert.match(template, /id="anim-scope-focus-deck"[\s\S]*?role="menu"[\s\S]*?hidden/);
assert.equal((template.match(/role="menuitemradio"/g) || []).length, 3,
    'all three SCOPE choices use radio-menu semantics');
assert.match(template, /data-playback-scope="all"/);
assert.match(template, /data-playback-scope="activeLane"/);
assert.match(template, /data-playback-scope="includedLanes"/);

assert.match(source, /this\._scopeFocusDeckOpen = false;/,
    'Focus Deck open state is runtime-only');
assert.match(source, /_setScopeFocusDeckOpen\(open,[\s\S]*?this\._scopeFocusDeckOpen = nextOpen;/,
    'one runtime setter owns Focus Deck visibility');
assert.match(source, /currentBtn\.setAttribute\('aria-expanded', open \? 'true' : 'false'\)/);
assert.match(source, /deck\.hidden = !open;/);
assert.match(source, /button\.setAttribute\('aria-checked', active \? 'true' : 'false'\)/);

const bindingStart = source.indexOf("const scopeControls = this.panel.querySelector('.anim-scope-controls')");
const bindingEnd = source.indexOf("const loopBtn = this.panel.querySelector('#anim-loop-toggle-btn')", bindingStart);
assert.ok(bindingStart >= 0 && bindingEnd > bindingStart, 'SCOPE event adapter exists');
const binding = source.slice(bindingStart, bindingEnd);
assert.match(binding, /this\.playbackScope = scope;/,
    'choice reuses the existing playbackScope authority');
assert.match(binding, /this\.render\(\);/,
    'choice refreshes existing playback projection');
assert.doesNotMatch(binding, /History|localStorage|serialize|save/i,
    'SCOPE progressive exposure does not create a second persisted authority');
assert.match(binding, /document\.addEventListener\('pointerdown',[\s\S]*?this\._setScopeFocusDeckOpen\(false\)/,
    'outside pointer closes the deck');
assert.match(binding, /focusout[\s\S]*?document\.activeElement[\s\S]*?this\._setScopeFocusDeckOpen\(false\)/,
    'focus leaving the SCOPE control closes the deck');

const keyStart = source.indexOf('_handleScopeFocusDeckKeyDown(event)');
const keyEnd = source.indexOf('_updateHeaderNarrowState()', keyStart);
assert.ok(keyStart >= 0 && keyEnd > keyStart, 'Focus Deck keyboard contract exists');
const keys = source.slice(keyStart, keyEnd);
for (const key of ['Escape', 'Tab', 'Enter', ' ', 'ArrowDown', 'ArrowUp', 'Home', 'End']) {
    assert.match(keys, new RegExp(`'${key}'`), `${key} behavior remains explicit`);
}
assert.match(keys, /options\.includes\(document\.activeElement\)[\s\S]*?document\.activeElement\.click\(\)/,
    'Enter and Space activate the focused SCOPE choice before Timeline shortcuts');
assert.match(source, /if \(this\._handleScopeFocusDeckKeyDown\(e\)\) return;/,
    'Focus Deck keyboard handling precedes Timeline shortcuts');

console.log('verify-animation-table-scope-focus-deck: runtime state, ARIA, existing scope authority, outside close and keyboard contract OK');
