import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../ui/animation-table-popup.js', import.meta.url), 'utf8');
const templateStart = source.indexOf('this.panel.innerHTML = `');
const templateEnd = source.indexOf('document.body.appendChild(this.panel);', templateStart);
assert.ok(templateStart >= 0 && templateEnd > templateStart, 'Animation Table template exists');
const template = source.slice(templateStart, templateEnd);

for (const id of [
    'anim-end-mode-btn',
    'anim-playback-range-focus-deck',
    'anim-set-in-btn',
    'anim-set-out-btn'
]) {
    assert.equal(template.split(`id="${id}"`).length - 1, 1, `${id} remains unique`);
}

assert.match(template, /id="anim-end-mode-btn"[\s\S]*?aria-haspopup="dialog"[\s\S]*?aria-expanded="false"/,
    'closed end-source label is the explicit Focus Deck trigger');
assert.match(template, /anim-playback-range-summary">LAST CLIP<\/span>/,
    'closed state exposes the full initial end-source label');
assert.match(template, /id="anim-playback-range-focus-deck"[\s\S]*?role="dialog"[\s\S]*?hidden/);
assert.equal((template.match(/class="anim-playback-end-option"/g) || []).length, 3,
    'all existing end modes are simultaneously comparable');
for (const mode of ['timeline', 'last-clip', 'out-marker']) {
    assert.match(template, new RegExp(`data-playback-end-mode="${mode}"`));
}
assert.match(template, /class="anim-playback-range-controls"[\s\S]*?id="anim-end-mode-btn"[\s\S]*?id="anim-set-in-btn"[\s\S]*?id="anim-set-out-btn"[\s\S]*?id="anim-playback-range-focus-deck"/,
    'end source and direct IN / OUT actions share one outlined control group');
assert.doesNotMatch(template, /anim-playback-range-marker-row|SET \/ CLEAR/,
    'Focus Deck is reserved for comparing end sources');

assert.match(source, /this\._playbackRangeFocusDeckOpen = false;/,
    'Focus Deck state is runtime-only');
assert.match(source, /_setPlaybackRangeFocusDeckOpen\(open,[\s\S]*?this\._playbackRangeFocusDeckOpen = nextOpen;/,
    'one runtime setter owns Focus Deck visibility');
assert.match(source, /_setPlaybackEndMode\(endMode\)[\s\S]*?playback\.endMode = endMode;[\s\S]*?'caf-playback-end-mode'/,
    'end choices reuse existing playback and History authority');
assert.match(source, /this\._togglePlaybackMarker\('inFrame'\)/);
assert.match(source, /this\._togglePlaybackMarker\('outFrame'\)/);
assert.doesNotMatch(template, /input[^>]+name="playback-range"|data-range-preset|rangePreset/i,
    'progressive exposure does not create a second saved Range authority');

assert.match(source, /timeline: 'TIMELINE'[\s\S]*?'last-clip': 'LAST CLIP'[\s\S]*?'out-marker': 'OUT MARKER'/,
    'closed end source uses full labels instead of T / C / O codes');
assert.match(source, /summary\.textContent = labelMap\[endMode\] \|\| labelMap\.timeline/,
    'closed summary follows current model state');
assert.match(source, /value\.textContent = hasInMarker \? `F\$\{inFrame \+ 1\}` : ''[\s\S]*?value\.hidden = !hasInMarker/,
    'inline IN chip exposes its current frame only after configuration');
assert.match(source, /value\.textContent = hasOutMarker \? `F\$\{outFrame \+ 1\}` : ''[\s\S]*?value\.hidden = !hasOutMarker/,
    'inline OUT chip exposes its current frame only after configuration');
assert.match(source, /endMode === 'out-marker'[\s\S]*?needs-out-marker/,
    'OUT-marker end mode explicitly diagnoses a missing OUT marker');
assert.match(source, /option\.setAttribute\('aria-checked', active \? 'true' : 'false'\)/,
    'radio state follows playback.endMode');

const keyStart = source.indexOf('_handlePlaybackRangeFocusDeckKeyDown(event)');
const keyEnd = source.indexOf('_updateHeaderNarrowState()', keyStart);
assert.ok(keyStart >= 0 && keyEnd > keyStart, 'Playback Range keyboard contract exists');
const keys = source.slice(keyStart, keyEnd);
for (const key of ['Escape', 'ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Home', 'End']) {
    assert.match(keys, new RegExp(`'${key}'`), `${key} behavior remains explicit`);
}
assert.match(source, /focusout[\s\S]*?_playbackRangeFocusDeckOpen[\s\S]*?_setPlaybackRangeFocusDeckOpen\(false\)/,
    'focus leaving the RANGE controls closes the deck');
assert.match(source, /document\.addEventListener\('pointerdown',[\s\S]*?_playbackRangeFocusDeckOpen[\s\S]*?_setPlaybackRangeFocusDeckOpen\(false\)/,
    'outside pointer closes the deck');
assert.match(source, /if \(this\._handlePlaybackRangeFocusDeckKeyDown\(e\)\) return;/,
    'Focus Deck keyboard handling precedes Timeline shortcuts');

console.log('verify-animation-table-playback-range-focus-deck: model summary, direct end choices, existing marker/History authority and keyboard close contract OK');
