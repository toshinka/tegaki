import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [mainCss, componentCss, renderer, timelineUi, phase] = await Promise.all([
    readFile(new URL('../styles/main.css', import.meta.url), 'utf8'),
    readFile(new URL('../styles/components/layer-panel-surface.css', import.meta.url), 'utf8'),
    readFile(new URL('../ui/layer-panel-renderer.js', import.meta.url), 'utf8'),
    readFile(new URL('../ui/timeline-ui.js', import.meta.url), 'utf8'),
    readFile(new URL('../../task-codex/phase9m.md', import.meta.url), 'utf8')
]);

for (const token of [
    '--ui-layer-context-surface: var(--ui-surface-float)',
    '--ui-layer-context-backdrop: var(--ui-backdrop-float)',
    '--ui-layer-surface-focus: rgba(255, 140, 66, 0.54)',
    '--ui-layer-context-shadow: none',
    '--ui-layer-panel-caf-column: 132px',
    '--ui-layer-panel-gap: 2px',
    '--ui-layer-card-row-height: 22px',
    '--ui-layer-card-thumb-size: 20px',
    '--ui-layer-card-thumb-visual-inset: 1px',
    '--ui-layer-surface-thumb: transparent',
    '--ui-layer-surface-thumb-protect: color-mix(in srgb, var(--futaba-background) 88%, transparent)'
]) {
    assert.ok(mainCss.includes(token), `${token} is the current semantic authority`);
}

assert.match(mainCss, /\.frame-indicator\s*\{[\s\S]*?background:\s*var\(--ui-layer-context-surface\)[\s\S]*?backdrop-filter:\s*var\(--ui-layer-context-backdrop\)/u,
    'the Frame and reference strip uses the shared frosted surface');
assert.match(mainCss, /\.frame-indicator\s*\{[\s\S]*?border-radius:\s*8px 8px 0 0[\s\S]*?margin:\s*0 2px/u,
    'the Frame strip is the top half of the aligned 128px context stack');
assert.match(mainCss, /\.frame-lane-reference-btn\.is-active\s*\{[\s\S]*?background:\s*var\(--futaba-light-maroon\)[\s\S]*?color:\s*var\(--futaba-background\)/u,
    'vertical Lane onion is an inverse Futaba surface when active');

assert.match(componentCss, /\.caf-simple-group-title--flat\s*\{[\s\S]*?background:\s*var\(--ui-layer-context-surface\)[\s\S]*?backdrop-filter:\s*var\(--ui-layer-context-backdrop\)/u,
    'CAF identity consumes the same frosted surface');
assert.match(componentCss, /\.caf-simple-group-title--flat\s*\{[\s\S]*?border-radius:\s*0 0 4px 4px/u,
    'CAF identity closes the bottom half of the shared Frame context stack');
assert.match(componentCss, /\.caf-simple-header--flat \.clip-layer-mirror-row\s*\{[\s\S]*?background:\s*var\(--ui-layer-context-surface\)[\s\S]*?backdrop-filter:\s*var\(--ui-layer-context-backdrop\)/u,
    'CAF internal rows consume the same frosted surface');
assert.match(componentCss, /\.caf-simple-header--flat \.clip-layer-mirror-row\.is-selected\s*\{[\s\S]*?background:\s*var\(--ui-layer-surface-focus\)/u,
    'the translucent orange focus surface runs around the full selected row');
assert.match(componentCss, /\.clip-layer-mirror-row\.is-selected \.clip-layer-mirror-thumb\s*\{[\s\S]*?background-color:\s*var\(--ui-layer-surface-thumb-protect\)\s*!important[\s\S]*?background-clip:\s*content-box\s*!important/u,
    'the selected thumbnail content stays untinted inside the orange perimeter');
assert.match(mainCss, /\.clip-layer-mirror-row\s*\{[\s\S]*?gap:\s*0 3px/u,
    'the compact row keeps its actions close without collapsing the thumbnail hit target');
assert.match(mainCss, /\.layer-panel-card-details\s*\{[\s\S]*?gap:\s*0/u,
    'opacity and layer name read as one compact information unit');
assert.match(mainCss, /\.clip-layer-mirror-thumb\s*\{[\s\S]*?padding:\s*var\(--ui-layer-card-thumb-visual-inset\)/u,
    'the thumbnail keeps its D&D hit box while shrinking only the visible content');
assert.match(componentCss, /\.layer-panel-card-row \.ui-icon-button\s*\{[\s\S]*?border-color:\s*transparent[\s\S]*?background:\s*transparent/u,
    'row clip and visibility actions rest without a repeated outline');
assert.match(componentCss, /\.legacy-layer-card-row\.background-layer\s*\{[\s\S]*?background:\s*var\(--ui-layer-context-surface\)[\s\S]*?backdrop-filter:\s*var\(--ui-layer-context-backdrop\)/u,
    'the background row now consumes the same compact frosted surface');
assert.match(mainCss, /\.caf-simple-header--flat \.clip-layer-mirror-row \.folder-child-line\s*\{[\s\S]*?top:\s*3px[\s\S]*?height:\s*calc\(100% - 6px\)/u,
    'the hierarchy guide leaves deliberate top and bottom breathing room');

assert.match(renderer, /variant:\s*this\._getLayerPanelCardVariantConfig\('clip-layer-mirror'\)[\s\S]*?disabled:\s*\(\)\s*=>\s*!this\._hasAnimationContext\(\)/u,
    'Table-context internal Layer cards reconnect to the existing pointer D&D adapter');
assert.match(timelineUi, /framePrevBtn\?\.addEventListener\('wheel', handleFrameWheel[\s\S]*?frameNextBtn\?\.addEventListener\('wheel', handleFrameWheel/u,
    'wheel over either Frame arrow follows the same previous/next navigation path');

for (const control of [
    'frame-prev-btn',
    'frame-next-btn',
    'frame-play-toggle-btn',
    'frame-timeline-onion-btn',
    'frame-lane-reference-btn'
]) {
    assert.ok(timelineUi.includes(`id="${control}"`), `${control} remains owned by TimelineUI`);
}
assert.match(phase, /Frame・Timeline onion・Lane onion/u,
    'the phase boundary keeps the two-axis reference strip explicit');

console.log('verify-layer-panel-frosted-focus-followup: shared frosted projection, inset thumbnail focus and TimelineUI control authority OK');
