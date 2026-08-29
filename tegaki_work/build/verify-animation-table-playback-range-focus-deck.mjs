import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [source, keyboardSource] = await Promise.all([
    readFile(new URL('../ui/animation-table-popup.js', import.meta.url), 'utf8'),
    readFile(new URL('../ui/keyboard-handler.js', import.meta.url), 'utf8')
]);
const templateStart = source.indexOf('this.panel.innerHTML = `');
const templateEnd = source.indexOf('document.body.appendChild(this.panel);', templateStart);
assert.ok(templateStart >= 0 && templateEnd > templateStart, 'Animation Table template exists');
const template = source.slice(templateStart, templateEnd);

for (const id of ['anim-end-mode-btn', 'anim-set-in-btn', 'anim-set-out-btn']) {
    assert.equal(template.split(`id="${id}"`).length - 1, 1, `${id} remains unique`);
}
assert.doesNotMatch(template, /anim-playback-range-focus-deck|anim-playback-end-option|aria-haspopup="dialog"/,
    'Playback End no longer opens a second choice surface');
assert.match(template, /id="anim-end-mode-btn"[^>]*>[\s\S]*?anim-playback-range-summary" aria-live="polite">LAST CLIP<\/span>/,
    'the direct cycle button exposes the current full label');
assert.match(template, /id="anim-set-in-btn"[^>]*hidden[\s\S]*?id="anim-set-out-btn"[^>]*hidden/,
    'I and O start hidden while LAST CLIP is active');
assert.match(template, /id="anim-set-in-btn"[^>]*aria-keyshortcuts="I"[^>]*title="I:/,
    'IN declares the I shortcut and keeps a discoverable title');
assert.match(template, /id="anim-set-out-btn"[^>]*aria-keyshortcuts="O"[^>]*title="O:/,
    'OUT declares the O shortcut and keeps a discoverable title');

assert.match(source, /endModeBtn\.addEventListener\('click', \(\) => \{[\s\S]*?this\._cyclePlaybackEndMode\(\);/,
    'the end label cycles through the existing playback setter directly');
assert.match(source, /_cyclePlaybackEndMode\(\) \{[\s\S]*?const modes = \['timeline', 'last-clip', 'out-marker'\];[\s\S]*?playback\.endMode = modes\[\(currentIndex \+ 1\) % modes\.length\][\s\S]*?'caf-playback-end-mode'/,
    'cycle order and History authority remain explicit');
assert.match(source, /summary\.textContent = labelMap\[endMode\] \|\| labelMap\.timeline/,
    'the closed summary follows model.playback.endMode');
assert.match(source, /summary\.hidden = endMode === 'out-marker'/,
    'OUT suppresses the visible summary without removing the cycle control');
assert.match(source, /endModeBtn\.dataset\.endMode = endMode/,
    'the rendered control exposes its current functional mode');
assert.match(source, /const showMarkers = endMode === 'out-marker';[\s\S]*?inBtn\.hidden = !showMarkers;[\s\S]*?outBtn\.hidden = !showMarkers;/,
    'I and O appear only for OUT MARKER');
assert.match(source, /setInBtn\.addEventListener\('click', \(\) => this\._togglePlaybackMarker\('inFrame'\)\)/);
assert.match(source, /setOutBtn\.addEventListener\('click', \(\) => this\._togglePlaybackMarker\('outFrame'\)\)/);
assert.match(source, /_togglePlaybackMarker\(markerKey\)[\s\S]*?playback\[markerKey\] = playback\[markerKey\] === currentFrame \? null : currentFrame/,
    'direct marker buttons retain existing set/clear and History authority');
assert.match(source, /handlePlaybackMarkerShortcutKeyDown\(event\)[\s\S]*?this\.model\?\.playback\?\.endMode !== 'out-marker'[\s\S]*?event\.ctrlKey \|\| event\.metaKey \|\| event\.shiftKey \|\| event\.altKey[\s\S]*?event\.code === 'KeyI'[\s\S]*?event\.code === 'KeyO'[\s\S]*?if \(!event\.repeat\)[\s\S]*?this\._togglePlaybackMarker\(markerKey\)/,
    'Animation Table exposes a single OUT-only I/O shortcut handler');
assert.match(keyboardSource, /shortcutContext === 'animation'[\s\S]*?animationTable\?\.handlePlaybackMarkerShortcutKeyDown\?\.\(e\)[\s\S]*?e\.preventDefault\(\)[\s\S]*?e\.stopImmediatePropagation\(\)/,
    'keyboard routing consumes I/O only inside the Animation Table context');
assert.doesNotMatch(keyboardSource, /shortcutContext === 'canvas'[\s\S]*?handlePlaybackMarkerShortcutKeyDown/,
    'Canvas shortcut routing is not replaced by the Table-only handler');
assert.match(keyboardSource, /case 'TOOL_EYEDROPPER':[\s\S]*?api\?\.tool\.set\('eyedropper'\)/,
    'the existing global I eyedropper action remains in the keymap path');
assert.doesNotMatch(source, /_playbackRangeFocusDeckOpen|_handlePlaybackRangeFocusDeckKeyDown|_setPlaybackEndMode/,
    'obsolete popup state and keyboard routing are removed');

console.log('verify-animation-table-playback-range-focus-deck: direct cycle, OUT-only I/O and context-routed shortcut authority OK');
