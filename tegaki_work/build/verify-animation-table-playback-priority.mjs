import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [source, playbackCss, utilityCss, fixture] = await Promise.all([
    readFile(new URL('../ui/animation-table-popup.js', import.meta.url), 'utf8'),
    readFile(new URL('../styles/components/animation-table-playback.css', import.meta.url), 'utf8'),
    readFile(new URL('../styles/components/animation-table-utility-lod.css', import.meta.url), 'utf8'),
    readFile(new URL('./phase9a-animation-table-playback-priority-fixture.html', import.meta.url), 'utf8')
]);

assert.match(source, /anim-table-playback-cluster--leading[\s\S]*?class="anim-playback-primary-slot"[\s\S]*?anim-table-playback-cluster--trailing/,
    'primary playback sits between two explicit header clusters');
assert.match(source, /class="anim-playback-primary-slot"[\s\S]*?id="anim-play-toggle-btn"/,
    'play/stop remains projected through the primary playback slot');
assert.match(utilityCss, /\.anim-table-header-row--playback > \.anim-table-header-left \{[\s\S]*?display: grid;[\s\S]*?grid-template-columns: minmax\(0, 1fr\) auto minmax\(0, 1fr\)/,
    'equal side columns keep the action centered without overlaying Playback End');
assert.match(utilityCss, /\.anim-playback-primary-slot \{[\s\S]*?position: static;[\s\S]*?transform: none;/,
    'the primary action participates in the header row instead of floating above I/O');

assert.match(playbackCss, /\.anim-play-btn \{[\s\S]*?width: 28px;[\s\S]*?height: 24px;[\s\S]*?background: transparent;[\s\S]*?box-shadow: none;/,
    'the hit target stays compact and frameless');
assert.match(playbackCss, /\.anim-play-btn::before \{[\s\S]*?width: 26px;[\s\S]*?height: 24px;[\s\S]*?background: var\(--futaba-maroon\);/,
    'resting play uses a smaller high-contrast Futaba inverse surface');
assert.match(playbackCss, /\.anim-play-btn::after \{[\s\S]*?border-left: 8px solid currentColor;/,
    'play glyph is a centered CSS shape rather than a font-baseline glyph');
assert.match(playbackCss, /\.anim-play-btn\.playing::before \{[\s\S]*?background: var\(--active-border\);/,
    'playing state uses the orange action surface');
assert.match(playbackCss, /\.anim-play-btn\.playing::after \{[\s\S]*?width: 8px;[\s\S]*?height: 8px;[\s\S]*?background: currentColor;/,
    'stop is an exactly centered square with comparable apparent weight');
assert.match(source, /playBtn\.textContent = '';[\s\S]*?playBtn\.setAttribute\('aria-label', 'Stop'\)[\s\S]*?aria-pressed', 'true'/);
assert.match(source, /playBtn\.setAttribute\('aria-label', 'Play'\)[\s\S]*?aria-pressed', 'false'/);

const rangeRule = playbackCss.match(/\.anim-playback-range-controls\s*\{[\s\S]*?\n\}/)?.[0] || '';
assert.match(rangeRule, /border:\s*1px solid transparent/);
assert.match(rangeRule, /background:\s*color-mix\(in srgb, var\(--futaba-cream\) 34%, var\(--futaba-background\)\)/);
assert.doesNotMatch(rangeRule, /deformer-bind/,
    'ordinary Playback End surface does not borrow Setup blue semantics');

assert.match(playbackCss, /@media \(pointer: coarse\)[\s\S]*?\.anim-play-btn\s*\{[\s\S]*?width: 44px;[\s\S]*?height: 38px;[\s\S]*?\.anim-play-btn::before\s*\{[\s\S]*?width: 30px;[\s\S]*?height: 28px;/,
    'coarse pointer keeps the 44x38 hit area while shrinking the visible panel');
assert.match(playbackCss, /@media \(pointer: coarse\)[\s\S]*?\.anim-playback-btn\s*\{[\s\S]*?min-width: 38px;[\s\S]*?height: 38px;/,
    'other coarse playback controls retain deliberate hit areas');

assert.match(fixture, /class="play-slot"[\s\S]*?aria-label="Play"/);
assert.doesNotMatch(fixture, /#315c96|#527fbd|setup|deformer/i,
    'fixture keeps ordinary playback controls outside Setup blue semantics');

console.log('verify-animation-table-playback-priority: centered non-overlay play/stop, compact visual surface and coarse hit contract OK');
