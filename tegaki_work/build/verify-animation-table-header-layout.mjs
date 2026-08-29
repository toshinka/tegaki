import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [source, utilityCss, playbackCss] = await Promise.all([
    readFile(new URL('../ui/animation-table-popup.js', import.meta.url), 'utf8'),
    readFile(new URL('../styles/components/animation-table-utility-lod.css', import.meta.url), 'utf8'),
    readFile(new URL('../styles/components/animation-table-playback.css', import.meta.url), 'utf8')
]);
const panelMethodStart = source.indexOf('_ensurePanelElement()');
const templateStart = source.indexOf('this.panel.innerHTML = `', panelMethodStart);
const templateEnd = source.indexOf('document.body.appendChild(this.panel);', templateStart);
assert.ok(panelMethodStart >= 0 && templateStart >= 0 && templateEnd > templateStart);

const template = source.slice(templateStart, templateEnd);
const playbackRowStart = template.indexOf('anim-table-header-row--playback');
const clipRowStart = template.indexOf('anim-table-header-row--clip');
assert.ok(playbackRowStart >= 0 && clipRowStart > playbackRowStart, 'explicit playback and clip rows exist');

const playbackRow = template.slice(playbackRowStart, clipRowStart);
const clipRow = template.slice(clipRowStart);
const assertOrdered = (text, tokens, label) => {
    let cursor = -1;
    for (const token of tokens) {
        const next = text.indexOf(token);
        assert.ok(next > cursor, `${label}: ${token} keeps its left-to-right order`);
        cursor = next;
    }
};

assertOrdered(playbackRow, [
    'id="anim-fps-input"',
    'id="anim-total-frames-input"',
    'id="anim-scope-all-btn"',
    'id="anim-play-toggle-btn"',
    'id="anim-loop-toggle-btn"',
    'id="anim-end-mode-btn"',
    'id="anim-preview-toggle-btn"',
    'id="anim-onion-toggle-btn"'
], 'playback row');

assert.match(playbackRow, /id="anim-set-in-btn"[^>]*aria-keyshortcuts="I"[^>]*title="I:/,
    'IN marker keeps an explicit keyboard hint in the playback row');
assert.match(playbackRow, /id="anim-set-out-btn"[^>]*aria-keyshortcuts="O"[^>]*title="O:/,
    'OUT marker keeps an explicit keyboard hint in the playback row');

assertOrdered(clipRow, [
    'id="anim-zoom-out-btn"',
    'id="anim-assets-toggle-btn"',
    'id="anim-motion-open-btn"',
    'id="anim-copy-btn"',
    'id="anim-paste-btn"',
    'id="anim-group-btn"',
    'id="anim-delete-active-btn"',
    'id="anim-selected-clip-actions"',
    'id="anim-duration-dec"',
    'id="anim-table-close-btn"'
], 'clip row');

for (const id of [
    'anim-play-toggle-btn',
    'anim-fps-input',
    'anim-total-frames-input',
    'anim-motion-open-btn',
    'anim-table-close-btn'
]) {
    assert.equal(template.split(`id="${id}"`).length - 1, 1, `${id} remains unique`);
}

assert.match(source, /\.anim-table-header\s*\{[\s\S]*?flex-direction:\s*column;/);
assert.match(source, /\.anim-table-header-row\s*\{[\s\S]*?width:\s*100%;/);
assert.match(utilityCss, /\.anim-table-header-row--playback > \.anim-table-header-left \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\) auto minmax\(0, 1fr\)/,
    'wide header uses equal side columns around play');
assert.match(utilityCss, /\.animation-table-panel\.is-narrow \.anim-table-header-row--playback > \.anim-table-header-left \{[\s\S]*?display: grid;[\s\S]*?grid-template-columns: minmax\(0, 1fr\) auto minmax\(0, 1fr\)/,
    'compact header keeps the same one-row equal-side grid');
assert.match(utilityCss, /\.animation-table-panel\.popup-panel--translucent\.is-narrow \.anim-table-header-row--playback \{[\s\S]*?flex-wrap: nowrap;/,
    'compact header overrides the legacy whole-row wrap');
assert.match(utilityCss, /\.animation-table-panel\.is-narrow \.anim-table-playback-cluster--trailing \{[\s\S]*?width: 100%;[\s\S]*?flex-wrap: wrap;[\s\S]*?justify-content: flex-end;/,
    'only the trailing detail group may wrap locally at the minimum width');
assert.doesNotMatch(utilityCss, /\.animation-table-panel\.is-narrow \.anim-table-playback-cluster\s*\{[\s\S]*?flex:\s*1 1 100%/,
    'compact mode never stacks all three header clusters at full width');
assert.match(utilityCss, /\.animation-table-panel\.is-narrow \.anim-setting-field\s*\{[\s\S]*?font-size:\s*0;/,
    'compact mode removes only the redundant visible FPS and FRAMES words');
assert.match(utilityCss, /\.animation-table-panel\.is-narrow \.anim-setting-field input\s*\{[\s\S]*?font-size:\s*9px;/,
    'compact numeric inputs keep their readable value size and original controls');
assert.match(playbackCss, /\.animation-table-panel \.anim-playback-range-controls\s*\{[\s\S]*?width:\s*80px;[\s\S]*?min-width:\s*80px;[\s\S]*?flex:\s*0 0 80px;/,
    'playback range keeps a fixed desktop footprint for every end mode');
assert.match(playbackCss, /\.animation-table-panel \.anim-playback-range-controls\.shows-markers\s*\{[\s\S]*?grid-template-columns:\s*24px repeat\(2, minmax\(0, 1fr\)\)/,
    'OUT mode keeps a compact cycle hit and equal I/O columns');
assert.match(playbackCss, /\.animation-table-panel \.anim-playback-range-controls\.shows-markers \.anim-playback-range-current-btn\s*\{[\s\S]*?width:\s*24px;[\s\S]*?min-width:\s*24px;/,
    'OUT cycle hit remains clickable after its summary is hidden');
assert.match(playbackCss, /@media \(pointer: coarse\) \{[\s\S]*?\.animation-table-panel \.anim-playback-range-controls\s*\{[\s\S]*?width:\s*116px;[\s\S]*?min-width:\s*116px;[\s\S]*?flex-basis:\s*116px;/,
    'coarse playback range keeps the fixed 116px footprint');
assert.match(playbackCss, /\.animation-table-panel \.anim-setting-field input\s*\{[\s\S]*?border:\s*0;/,
    'FPS and FRAMES inputs have no resting frame');
assert.match(playbackCss, /\.animation-table-panel \.anim-setting-field input:focus-visible\s*\{[\s\S]*?box-shadow:[\s\S]*?background:\s*var\(--futaba-background\);/,
    'numeric input focus remains visible through palette surface and ring');
assert.match(playbackCss, /\.animation-table-panel \.anim-preview-toggle\s*\{[\s\S]*?border:\s*1px solid transparent;/,
    'PREVIEW has no resting border color');
assert.match(playbackCss, /\.animation-table-panel \.anim-preview-toggle\.active\s*\{[\s\S]*?background:\s*color-mix\(in srgb, var\(--active-border\)/,
    'PREVIEW active state keeps the existing orange surface');
assert.match(playbackCss, /\.animation-table-panel \.anim-preview-toggle:focus-visible\s*\{[\s\S]*?outline:\s*2px solid var\(--active-border\);/,
    'PREVIEW keyboard focus remains explicit without a border');
assert.match(
    source,
    /\[timelineHeader, timelineUtility\]\.forEach\(wheelSurface[\s\S]*?_handleTimelineHeaderWheel/,
    'Header and bottom utility must share the same timeline zoom wheel authority'
);
assert.match(source, /const ANIMATION_TABLE_UI_DENSITY_VERSION = 2;/);
assert.match(source, /const ANIMATION_TABLE_DEFAULT_HEIGHT = 266;/);
assert.match(source, /const ANIMATION_TABLE_HEADER_COMPACT_WIDTH = 620;/);
assert.match(source, /width > 0 && width <= ANIMATION_TABLE_HEADER_COMPACT_WIDTH/,
    'rendered/saved width comparison uses the measured compact threshold');
assert.match(source, /Math\.abs\(size\.height - 260\)/);
assert.match(source, /Math\.abs\(size\.height - 240\)/);

const scopeCurrentStyle = source.match(/\.anim-scope-current-btn\s*\{[\s\S]*?\}/)?.[0] || '';
assert.ok(scopeCurrentStyle, 'current SCOPE control style exists');
assert.match(scopeCurrentStyle, /min-height:\s*22px;/,
    'current SCOPE control keeps a clear pointer target');
assert.match(scopeCurrentStyle, /border:\s*1px solid var\(--ui-border-active\);/,
    'current SCOPE state uses the semantic active boundary');
const scopeFocusStyle = source.match(/\.anim-scope-current-btn:focus-visible,[\s\S]*?\{[\s\S]*?\}/)?.[0] || '';
assert.ok(scopeFocusStyle, 'SCOPE focus-visible style exists');
assert.match(scopeFocusStyle, /outline:\s*2px solid var\(--futaba-maroon\);/,
    'SCOPE keyboard focus uses the Futaba palette instead of the browser default');
assert.match(source, /\.anim-scope-focus-deck\s*\{[\s\S]*?background:\s*var\(--futaba-background\);/,
    'SCOPE choice surface remains opaque and palette-bound');

console.log('verify-animation-table-header-layout: explicit rows, semantic order, one-row compact header, wheel and height migration OK');
