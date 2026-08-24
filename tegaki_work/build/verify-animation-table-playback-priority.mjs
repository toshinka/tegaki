import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [source, playbackCss, fixture] = await Promise.all([
    readFile(new URL('../ui/animation-table-popup.js', import.meta.url), 'utf8'),
    readFile(new URL('../styles/components/animation-table-playback.css', import.meta.url), 'utf8'),
    readFile(new URL('./phase9a-animation-table-playback-priority-fixture.html', import.meta.url), 'utf8')
]);

assert.match(source, /class="anim-playback-primary-slot"[\s\S]*?id="anim-play-toggle-btn"/,
    'play/stop remains projected through the primary playback slot');
assert.match(playbackCss, /\.anim-playback-primary-slot\s*\{[\s\S]*?order:\s*30;[\s\S]*?flex:\s*0 0 auto;[\s\S]*?min-width:\s*28px;[\s\S]*?min-height:\s*24px;[\s\S]*?margin-inline:\s*auto;/,
    'primary playback stays on the first row with symmetric breathing space instead of a dedicated full-width row');
assert.match(playbackCss, /\.anim-timeline-settings\s*\{[\s\S]*?order:\s*10;/);
assert.match(playbackCss, /\.anim-scope-controls\s*\{[\s\S]*?order:\s*20;/);
assert.match(playbackCss, /\.anim-playback-controls\s*\{[\s\S]*?order:\s*40;/);
assert.match(playbackCss, /\.anim-preview-toggle\s*\{[\s\S]*?order:\s*50;/);
assert.match(playbackCss, /\.anim-onion-toggle\s*\{[\s\S]*?order:\s*60;/);
assert.match(playbackCss, /\.anim-play-btn\s*\{[\s\S]*?width:\s*28px;[\s\S]*?height:\s*24px;[\s\S]*?font-size:\s*11px;[\s\S]*?font-weight:\s*900;/,
    'play/stop keeps row-height visual weight instead of claiming a separate line');
assert.match(playbackCss, /\.anim-play-btn\s*\{[\s\S]*?background:\s*var\(--futaba-maroon\);[\s\S]*?color:\s*var\(--futaba-background\);/,
    'resting play uses the high-contrast Futaba inverse treatment');
assert.match(playbackCss, /\.anim-play-btn\.playing\s*\{[\s\S]*?background:\s*var\(--active-border\);[\s\S]*?color:\s*var\(--futaba-maroon\);/,
    'playing state keeps readable Futaba ink on the orange action surface');
assert.doesNotMatch(playbackCss, /\.anim-playback-primary-slot\s*\{[\s\S]*?flex:\s*1 0 100%;/,
    'primary playback no longer reserves a dedicated full-width row');
assert.doesNotMatch(playbackCss, /\.animation-table-panel\.is-narrow \.anim-playback-primary-slot\s*\{[\s\S]*?translateX/,
    'narrow mode no longer needs the old dedicated-row center correction');
assert.match(source, /playBtn\.setAttribute\('aria-label', 'Stop'\)[\s\S]*?aria-pressed', 'true'/);
assert.match(source, /playBtn\.setAttribute\('aria-label', 'Play'\)[\s\S]*?aria-pressed', 'false'/);

const rangeRule = playbackCss.match(/\.anim-playback-range-controls\s*\{[\s\S]*?\n\}/)?.[0] || '';
assert.doesNotMatch(rangeRule, /deformer-bind/,
    'ordinary Playback Range surface does not borrow Setup blue semantics');
assert.match(rangeRule, /border:\s*1px solid transparent/);
assert.match(rangeRule, /background:\s*color-mix\(in srgb, var\(--futaba-cream\) 34%, var\(--futaba-background\)\)/);

const markerRule = playbackCss.match(/\.anim-playback-range-controls > \.anim-playback-marker-btn\s*\{[\s\S]*?\n\}/)?.[0] || '';
assert.match(markerRule, /gap:\s*5px;/, 'configured marker letter and frame value have explicit breathing room');
assert.match(markerRule, /background:\s*color-mix\(in srgb, var\(--futaba-cream\) 38%, var\(--futaba-background\)\)/,
    'unset I/O remain visible as pale Futaba panels');
assert.match(playbackCss, /@media \(pointer: coarse\)[\s\S]*?\.animation-table-panel \.anim-play-btn\s*\{[\s\S]*?width:\s*44px;[\s\S]*?height:\s*38px;[\s\S]*?\.anim-playback-primary-slot\s*\{[\s\S]*?min-width:\s*44px;[\s\S]*?min-height:\s*38px;[\s\S]*?\.anim-playback-btn\s*\{[\s\S]*?min-width:\s*38px;[\s\S]*?height:\s*38px;/,
    'coarse pointer playback controls restore deliberate hit areas');
assert.doesNotMatch(markerRule, /deformer-bind/);

assert.match(fixture, /class="play-slot"[\s\S]*?aria-label="Play"/);
assert.match(fixture, /class="marker">I<\/button>/, 'fixture fixes the unset letter-only state');
assert.match(fixture, /class="marker set-out">O<span class="value">F13<\/span>/,
    'fixture fixes the configured letter/frame spacing state');
assert.doesNotMatch(fixture, /#315c96|#527fbd|setup|deformer/i,
    'fixture keeps ordinary playback controls outside Setup blue semantics');

console.log('verify-animation-table-playback-priority: compact first-row primary play, neutral range, letter-only unset I/O and spaced set values OK');
