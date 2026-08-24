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
const controlsEnd = template.indexOf('</div>\n                        </div>', controlsStart);
assert.ok(controlsStart >= 0 && controlsEnd > controlsStart, 'one Playback Range control group exists');
const controls = template.slice(controlsStart, controlsEnd);

assert.match(controls, /anim-playback-range-summary">LAST CLIP<\/span>/,
    'default end source is written as a full label');
assert.match(controls, /id="anim-set-in-btn"[\s\S]*?anim-playback-marker-chip-label">I<[\s\S]*?anim-playback-marker-chip-value" hidden><\/span>/,
    'unset IN keeps a letter-only direct action inside the Range group');
assert.match(controls, /id="anim-set-out-btn"[\s\S]*?anim-playback-marker-chip-label">O<[\s\S]*?anim-playback-marker-chip-value" hidden><\/span>/,
    'unset OUT keeps a letter-only direct action inside the Range group');
assert.ok(controls.indexOf('id="anim-end-mode-btn"') < controls.indexOf('id="anim-set-in-btn"'));
assert.ok(controls.indexOf('id="anim-set-in-btn"') < controls.indexOf('id="anim-set-out-btn"'));
assert.ok(controls.indexOf('id="anim-set-out-btn"') < controls.indexOf('id="anim-playback-range-focus-deck"'));

const deckStart = controls.indexOf('id="anim-playback-range-focus-deck"');
const deck = controls.slice(deckStart);
assert.equal((deck.match(/class="anim-playback-end-option"/g) || []).length, 3,
    'Focus Deck compares exactly the three existing end sources');
assert.doesNotMatch(deck, /id="anim-set-in-btn"|id="anim-set-out-btn"|SET \/ CLEAR/,
    'marker mutation is inline instead of duplicated in the deck');

assert.match(source, /const labelMap = \{[\s\S]*?timeline: 'TIMELINE'[\s\S]*?'last-clip': 'LAST CLIP'[\s\S]*?'out-marker': 'OUT MARKER'/,
    'runtime projection keeps full end-source labels');
assert.match(source, /value\.textContent = hasInMarker \? `F\$\{inFrame \+ 1\}` : ''[\s\S]*?value\.hidden = !hasInMarker/);
assert.match(source, /value\.textContent = hasOutMarker \? `F\$\{outFrame \+ 1\}` : ''[\s\S]*?value\.hidden = !hasOutMarker/);
assert.match(source, /setInBtn\.addEventListener\('click', \(\) => this\._togglePlaybackMarker\('inFrame'\)\)/);
assert.match(source, /setOutBtn\.addEventListener\('click', \(\) => this\._togglePlaybackMarker\('outFrame'\)\)/);
assert.match(source, /_togglePlaybackMarker\(markerKey\)[\s\S]*?playback\[markerKey\] = playback\[markerKey\] === currentFrame \? null : currentFrame/,
    'inline marker buttons keep the existing set-on-current / clear-on-same-frame authority');
assert.doesNotMatch(template, /data-range-preset|rangePreset|name="playback-range"/i,
    'inline projection adds no second saved Range authority');

assert.match(playbackCss, /\.anim-playback-range-controls \{[\s\S]*?border: 1px solid[\s\S]*?background:/,
    'end source and markers are visually grouped');
assert.match(playbackCss, /\.anim-playback-range-controls > \.anim-playback-marker-btn \{[\s\S]*?border-left:/,
    'I / O remain distinct direct hit targets inside the group');

console.log('verify-animation-table-playback-range-inline: full end label, inline I/O projection, existing marker authority and grouped surface OK');
