import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [source, css, index] = await Promise.all([
    readFile(new URL('../ui/animation-table-popup.js', import.meta.url), 'utf8'),
    readFile(new URL('../styles/components/animation-table-utility-lod.css', import.meta.url), 'utf8'),
    readFile(new URL('../index.html', import.meta.url), 'utf8')
]);

assert.match(index, /styles\/components\/animation-table-utility-lod\.css/u,
    'Phase 9m utility/LOD component CSS is loaded');
assert.match(source, /anim-table-header-row--clip anim-table-utility-row/u,
    'the existing Clip utility row keeps its IDs and receives a placement role');
assert.match(source, /_mountAnimationTableUtilityRow\(\)/u);
assert.match(source, /playbackRow\.appendChild\(closeButton\);[\s\S]*?viewport\.after\(utilityRow\);/u,
    'close remains in the playback header while the existing utility row moves below the viewport');
assert.match(source, /utilityRow\.setAttribute\('role', 'toolbar'\)/u);
assert.match(source, /aria-label', 'Timeline and selected Clip utility'/u);
assert.match(source, /\[timelineHeader, timelineUtility\]\.forEach\(wheelSurface[\s\S]*?_handleTimelineHeaderWheel\(event\)/u,
    'header and Bottom utility reuse the existing zoom wheel handler');

assert.match(source, /timeline-handle-quiet', this\.timelineCellWidth < 18 && this\.timelineCellWidth > 10/u,
    '47-percent class is derived from the existing cell width');
assert.match(source, /timeline-handle-hidden', this\.timelineCellWidth <= 10/u,
    '33-percent visual hiding is derived from the existing cell width');
assert.match(source, /const TIMELINE_ZOOM_STEPS = \[10, 12, 14, 18, 22, 24, 26, 30, 36, 44\];/u,
    'production zoom minimum remains unchanged');
assert.match(source, /timelineCellWidth >= 18[\s\S]*?motionMarkers/u,
    'existing Motion/WARP key marker LOD remains unchanged');

assert.match(css, /\.animation-table-panel \.anim-table-utility-row\s*\{[\s\S]*?flex:\s*0 0 auto;[\s\S]*?min-height:\s*34px/u,
    'Bottom utility is a compact fixed row');
assert.match(css, /\.animation-table-panel\.popup-panel--translucent\s*\{[\s\S]*?min-width:\s*min\(460px, 100vw\)/u,
    'the 460px desktop baseline yields to the 420px narrow viewport');
assert.match(css, /\.animation-table-panel \.anim-table-header-row--playback > \.anim-table-header-left\s*\{[\s\S]*?display:\s*grid;[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\) auto minmax\(0, 1fr\)/u,
    'equal side columns keep primary play centered without overlaying adjacent controls');
assert.match(css, /\.animation-table-panel \.anim-playback-primary-slot\s*\{[\s\S]*?position:\s*static;[\s\S]*?transform:\s*none/u,
    'primary play remains part of the header row flow');
assert.match(css, /\.animation-table-panel \.anim-table-header\s*\{[\s\S]*?border-bottom:\s*0/u,
    'playback header removes the full-width separator that exceeded its inner spacing');
assert.match(css, /\.animation-table-panel\.is-narrow \.anim-table-header-row--playback #anim-table-close-btn\s*\{[\s\S]*?right:\s*2px/u,
    'compact close remains at the visible panel edge without widening the row');
assert.match(css, /\.animation-table-panel\.is-narrow \.anim-table-header-row\.anim-table-utility-row\s*\{[\s\S]*?flex-wrap:\s*nowrap;[\s\S]*?gap:\s*3px;[\s\S]*?padding-inline:\s*4px/u,
    'the 420px Bottom utility retains one compact row');
assert.match(css, /\.animation-table-panel \.anim-table-utility-row\s*\{[\s\S]*?border-top:\s*0/u,
    'Bottom utility follows the same frameless separator policy');
assert.match(css, /\.animation-table-panel \.anim-timeline-row \.anim-cel-block:not\(\.selected\)[\s\S]*?var\(--futaba-medium\)/u,
    'resting Clips use the Futaba medium family');
assert.match(css, /\.animation-table-panel \.anim-timeline-row \.anim-cel-block\.primary-selected\s*\{[\s\S]*?border:\s*0;[\s\S]*?var\(--active-border\)[\s\S]*?box-shadow:\s*none;[\s\S]*?transform:\s*none;/u,
    'selected Clip is one solid active surface without stacked outline/scale emphasis');
assert.match(css, /timeline-handle-quiet \.anim-cel-resize-grip\s*\{[\s\S]*?opacity:\s*0\.34/u);
assert.match(css, /timeline-handle-hidden \.anim-cel-resize-grip\s*\{[\s\S]*?opacity:\s*0/u);
assert.doesNotMatch(css, /pointer-events:\s*none/u,
    'visual LOD does not disable the existing logical handle hit area');
assert.doesNotMatch(css, /(?:#000(?:000)?(?![0-9a-f])|#fff(?:fff)?(?![0-9a-f])|\bblack\b|\bwhite\b|\bgray\b)/iu,
    'new component CSS stays within Futaba/semantic palette tokens');

for (const authority of [
    "const selectionBlock = (e.ctrlKey || e.metaKey)",
    "const handle = e.target.closest('.anim-cel-handle')",
    "const block = e.target.closest('.anim-cel-block')",
    'resolveTimelineViewportWheelAction({',
    "this.copySelectedCel()",
    "this.deleteSelectedClips()",
    "#anim-scope-set-btn"
]) {
    assert.ok(source.includes(authority), `${authority} authority remains in production`);
}

console.log('verify-animation-table-utility-lod-production: Bottom utility reuse, close/playback ownership, Clip visual LOD and production authority OK');
