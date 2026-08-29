import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [source, playbackCss] = await Promise.all([
    readFile(new URL('../ui/animation-table-popup.js', import.meta.url), 'utf8'),
    readFile(new URL('../styles/components/animation-table-playback.css', import.meta.url), 'utf8')
]);
const templateStart = source.indexOf('this.panel.innerHTML = `');
const templateEnd = source.indexOf('document.body.appendChild(this.panel);', templateStart);
assert.ok(templateStart >= 0 && templateEnd > templateStart, 'Animation Table template exists');
const template = source.slice(templateStart, templateEnd);

const controlsStart = template.indexOf('<div class="anim-playback-range-controls">');
const controlsEnd = template.indexOf('</div>\n                            </div>', controlsStart);
assert.ok(controlsStart >= 0 && controlsEnd > controlsStart, 'one Playback End control group exists');
const controls = template.slice(controlsStart, controlsEnd);

assert.match(controls, /anim-playback-range-summary" aria-live="polite">LAST CLIP<\/span>/,
    'default end source is written as a full label');
assert.match(controls, /id="anim-set-in-btn"[^>]*hidden[\s\S]*?anim-playback-marker-chip-label">I<[^>]*>[\s\S]*?anim-playback-marker-chip-value" hidden><\/span>/,
    'IN is prepared as a direct action but initially hidden');
assert.match(controls, /id="anim-set-out-btn"[^>]*hidden[\s\S]*?anim-playback-marker-chip-label">O<[^>]*>[\s\S]*?anim-playback-marker-chip-value" hidden><\/span>/,
    'OUT is prepared as a direct action but initially hidden');
assert.match(controls, /id="anim-set-in-btn"[^>]*aria-keyshortcuts="I"[^>]*title="I:/,
    'IN exposes its keyboard shortcut in the native button contract');
assert.match(controls, /id="anim-set-out-btn"[^>]*aria-keyshortcuts="O"[^>]*title="O:/,
    'OUT exposes its keyboard shortcut in the native button contract');
assert.ok(controls.indexOf('id="anim-end-mode-btn"') < controls.indexOf('id="anim-set-in-btn"'));
assert.ok(controls.indexOf('id="anim-set-in-btn"') < controls.indexOf('id="anim-set-out-btn"'));
assert.doesNotMatch(controls, /focus-deck|data-playback-end-mode|SET \/ CLEAR/,
    'end mode and markers stay in one inline progressive group');

assert.match(source, /const labelMap = \{[\s\S]*?timeline: 'TIMELINE'[\s\S]*?'last-clip': 'LAST CLIP'[\s\S]*?'out-marker': 'OUT MARKER'/,
    'runtime projection keeps full end-source labels');
assert.match(source, /summary\.hidden = endMode === 'out-marker'/,
    'OUT hides only the visible summary while retaining the cycle button');
assert.match(source, /value\.textContent = hasInMarker \? `F\$\{inFrame \+ 1\}` : ''[\s\S]*?value\.hidden = !hasInMarker/);
assert.match(source, /value\.textContent = hasOutMarker \? `F\$\{outFrame \+ 1\}` : ''[\s\S]*?value\.hidden = !hasOutMarker/);
assert.match(source, /rangeControls\?\.classList\.toggle\('shows-markers', showMarkers\)/);
assert.match(source, /handlePlaybackMarkerShortcutKeyDown\(event\)[\s\S]*?this\.model\?\.playback\?\.endMode !== 'out-marker'[\s\S]*?event\.ctrlKey \|\| event\.metaKey \|\| event\.shiftKey \|\| event\.altKey[\s\S]*?event\.code === 'KeyI'[\s\S]*?event\.code === 'KeyO'[\s\S]*?if \(!event\.repeat\)[\s\S]*?this\._togglePlaybackMarker\(markerKey\)/,
    'I/O shortcut accepts only OUT mode, modifier-free keys, and toggles once per keydown');
assert.doesNotMatch(template, /data-range-preset|rangePreset|name="playback-range"/i,
    'inline projection adds no second saved Range authority');

assert.match(playbackCss, /\.anim-playback-range-controls \{[\s\S]*?border: 1px solid[\s\S]*?background:/,
    'end source and conditional markers are visually grouped');
assert.match(playbackCss, /\.anim-playback-range-controls \{[\s\S]*?width: 80px;[\s\S]*?min-width: 80px;[\s\S]*?flex: 0 0 80px;/,
    'desktop range group keeps a stable 80px footprint');
assert.match(playbackCss, /\.anim-playback-range-controls\.shows-markers \{[\s\S]*?display: grid;[\s\S]*?grid-template-columns: 24px repeat\(2, minmax\(0, 1fr\)\)/,
    'OUT mode reserves a small cycle hit and splits the remaining width between I/O');
assert.match(playbackCss, /\.anim-playback-range-controls\.shows-markers \.anim-playback-range-current-btn \{[\s\S]*?width: 24px;[\s\S]*?min-width: 24px;/,
    'desktop OUT cycle hit remains 24px after its summary is hidden');
assert.match(playbackCss, /\.anim-playback-range-controls > \.anim-playback-marker-btn \{[\s\S]*?border-left:/,
    'I / O remain adjacent direct hit targets');
assert.match(playbackCss, /\.anim-playback-range-controls > \.anim-playback-marker-btn\[hidden\] \{[\s\S]*?display: none;/,
    'hidden marker actions do not consume header space');
assert.match(playbackCss, /@media \(pointer: coarse\) \{[\s\S]*?\.animation-table-panel \.anim-playback-range-controls \{[\s\S]*?width: 116px;[\s\S]*?min-width: 116px;[\s\S]*?flex-basis: 116px;/,
    'coarse range group keeps a stable 116px footprint');

console.log('verify-animation-table-playback-range-inline: stable range footprint, OUT-only I/O and existing marker authority OK');
