import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [source, icons, playbackCss] = await Promise.all([
    readFile(new URL('../ui/animation-table-popup.js', import.meta.url), 'utf8'),
    readFile(new URL('../ui/ui-icons.js', import.meta.url), 'utf8'),
    readFile(new URL('../styles/components/animation-table-playback.css', import.meta.url), 'utf8')
]);

for (const icon of ['monitor', 'repeat', 'repeatOff']) {
    assert.match(icons, new RegExp(`${icon}: '<svg xmlns="http://www\\.w3\\.org/2000/svg"`),
        `${icon} is centralized in UI_ICONS with a normalized SVG namespace`);
}
assert.match(icons, /monitor:[\s\S]*?stroke="currentColor"/);
assert.match(icons, /repeat:[\s\S]*?stroke="currentColor"/);
assert.match(icons, /repeatOff:[\s\S]*?stroke="currentColor"/);

const templateStart = source.indexOf('this.panel.innerHTML = `');
const templateEnd = source.indexOf('document.body.appendChild(this.panel);', templateStart);
assert.ok(templateStart >= 0 && templateEnd > templateStart, 'Animation Table template exists');
const template = source.slice(templateStart, templateEnd);

assert.match(template, /anim-scope-current-icon[\s\S]*?UI_ICONS\.monitor/,
    'SCOPE current-state button keeps its value and gains the Monitor category hint');
assert.match(template, /id="anim-loop-toggle-btn"[\s\S]*?aria-pressed="true"[\s\S]*?UI_ICONS\.repeat/,
    'LOOP starts with the Repeat icon and explicit toggle semantics');
assert.match(template, /anim-playback-marker-btn--in[\s\S]*?anim-playback-marker-chip-label">I</,
    'IN keeps an explicit compact range-marker label inside its existing action button');
assert.match(template, /anim-playback-marker-btn--out[\s\S]*?anim-playback-marker-chip-label">O</,
    'OUT keeps an explicit compact range-marker label inside its existing action button');

assert.match(source, /loopBtn\.innerHTML = isLoop \? UI_ICONS\.repeat : UI_ICONS\.repeatOff;/,
    'LOOP icon follows the existing playback.loop authority');
assert.match(source, /loopBtn\.setAttribute\('aria-pressed', isLoop \? 'true' : 'false'\)/,
    'LOOP pressed state follows playback.loop');
assert.match(source, /inBtn\.classList\.toggle\('has-marker', hasInMarker\)/);
assert.match(source, /outBtn\.classList\.toggle\('has-marker', hasOutMarker\)/);
assert.match(source, /inBtn\.setAttribute\('aria-pressed', isCurrentIn \? 'true' : 'false'\)/);
assert.match(source, /outBtn\.setAttribute\('aria-pressed', isCurrentOut \? 'true' : 'false'\)/);

assert.match(playbackCss, /\.anim-playback-marker-btn--in\.has-marker\s*\{[\s\S]*?background:\s*var\(--futaba-maroon\);[\s\S]*?color:\s*var\(--futaba-background\);/,
    'configured IN marker uses the Futaba range-marker surface and inverse palette text');
assert.match(playbackCss, /\.anim-playback-marker-btn--out\.has-marker\s*\{[\s\S]*?background:\s*var\(--active-border\);[\s\S]*?color:\s*var\(--futaba-maroon\);/,
    'configured OUT marker keeps readable Futaba ink on the active range-marker surface');
assert.match(source, /\.animation-table-panel\.is-narrow \.anim-scope-current-label\s*\{[\s\S]*?clip-path:\s*inset\(50%\);/,
    'narrow layout hides only the SCOPE category word while preserving accessible current state');
assert.match(source, /Math\.min\(preferredWidth, renderedWidth\)/,
    'viewport-constrained rendered width wins over a wider stored panel preference');

console.log('verify-animation-table-playback-glance: centralized icons, current SCOPE, LOOP state, I/O marker chips and ARIA OK');
