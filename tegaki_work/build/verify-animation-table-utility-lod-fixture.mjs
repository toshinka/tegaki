import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [fixture, phase, table, wheelHelper, selectedActions, githubUrls] = await Promise.all([
    readFile(new URL('./phase9m-animation-table-utility-lod-fixture.html', import.meta.url), 'utf8'),
    readFile(new URL('../../開発用資料保管庫/Archive/phase9m.md', import.meta.url), 'utf8'),
    readFile(new URL('../ui/animation-table-popup.js', import.meta.url), 'utf8'),
    readFile(new URL('../system/animation/timeline-wheel-routing.js', import.meta.url), 'utf8'),
    readFile(new URL('./verify-animation-table-selected-clip-actions.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../GitHubURL.txt', import.meta.url), 'utf8')
]);

assert.equal(fixture.match(/class="comparison-shell"/g)?.length, 1,
    'Phase 9m compares A-D in one state shell');
for (const candidate of ['current', 'bottom', 'clip-lod', 'low-zoom']) {
    assert.match(fixture, new RegExp(`data-value="${candidate}"`), `${candidate} candidate control exists`);
    assert.match(fixture, new RegExp(`data-candidate="${candidate}"|\\[data-candidate="${candidate}"\\]`),
        `${candidate} candidate is represented in the shared DOM`);
}
for (const state of [
    'data-control="viewport"',
    'data-control="zoom"',
    'data-control="selection"',
    'data-control="clips"',
    'data-value="wide"',
    'data-value="square"',
    'data-value="narrow"',
    'data-value="120"',
    'data-value="50"',
    'data-value="33"',
    'data-value="25"',
    'data-value="selected"',
    'data-value="unselected"',
    'data-value="single"',
    'data-value="multi"'
]) {
    assert.ok(fixture.includes(state), `${state} comparison state exists`);
}

assert.match(fixture, /\.comparison-shell\[data-candidate="bottom"\] \.utility-row,[\s\S]*?order:\s*3/u,
    'B-D place the existing utility role below Timeline content');
assert.match(fixture, /\.status-strip\s*\{[\s\S]*?order:\s*4/u,
    'comparison status stays after header, Timeline content and utility');
assert.match(fixture, /\.play-button\s*\{[\s\S]*?width:\s*30px;[\s\S]*?height:\s*26px/u,
    'fixture play emphasis stays near the current normal hit contract');
assert.match(fixture, /data-candidate="clip-lod"\]\[data-selection="selected"\][\s\S]*?background:\s*var\(--surface-selected\)/u,
    'C uses one solid selected Clip surface');
assert.match(fixture, /data-candidate="low-zoom"\]\[data-zoom="25"\][\s\S]*?repeating-linear-gradient/u,
    'D exposes fixture-only 25% major-grid LOD');
assert.match(fixture, /data-candidate="clip-lod"\]\[data-zoom="33"\] \.clip-handle-visual[\s\S]*?opacity:\s*0/u,
    'low zoom hides only the visual handle');
assert.ok((fixture.match(/class="clip-hit-zone /g) || []).length >= 6,
    'all sample Clips retain explicit logical edge hit zones');
assert.match(fixture, /class="clip-hit-zone clip-hit-zone--left"[^>]*data-authority="retime"/u,
    'left edge hit retains retime authority');
assert.match(fixture, /class="clip-hit-zone clip-hit-zone--right"[^>]*data-authority="retime"/u,
    'right edge hit retains retime authority');
assert.match(fixture, /Frame seek · body move · edge retime hit = fixed/u,
    'fixture labels the invariant logical hit contract');
assert.doesNotMatch(fixture, /localStorage|sessionStorage|TimelineModel|HistoryManager|EventBus/u,
    'static fixture does not create runtime state or persistence authority');
assert.doesNotMatch(fixture, /(?:#000(?:000)?(?![0-9a-f])|#fff(?:fff)?(?![0-9a-f])|\bblack\b|\bwhite\b|\bgray\b)/iu,
    'fixture keeps the Futaba palette instead of pure or neutral literals');

assert.match(table, /const TIMELINE_ZOOM_STEPS = \[10, 12, 14, 18, 22, 24, 26, 30, 36, 44\];/u,
    'production zoom clamp remains at the existing about-33-percent minimum');
assert.match(table, /timelineCellWidth >= 18[\s\S]*?motionMarkers/u,
    'production keeps the existing Motion marker LOD');
assert.match(table, /anim-table-header-row--playback/u);
assert.match(table, /anim-table-header-row--clip/u);
assert.match(table, /_handleTimelineHeaderWheel\(event\)/u,
    'header wheel keeps production zoom routing');
assert.match(table, /resolveTimelineViewportWheelAction\(\{/u,
    'viewport wheel keeps the shared routing helper');
assert.match(wheelHelper, /overTrackList/u);
assert.match(wheelHelper, /type:\s*'frame-step'/u);
assert.ok(table.indexOf('const selectionBlock = (e.ctrlKey || e.metaKey)') < table.indexOf("const handle = e.target.closest('.anim-cel-handle')"),
    'multi-selection remains ahead of edge retime hit testing');
assert.ok(table.indexOf("const handle = e.target.closest('.anim-cel-handle')") < table.indexOf("const block = e.target.closest('.anim-cel-block')", table.indexOf("const handle = e.target.closest('.anim-cel-handle')")),
    'edge retime remains ahead of Clip body move');
assert.match(table, /#anim-scope-set-btn/u,
    'SCOPE SET remains available during the comparison gate');
assert.match(selectedActions, /projected Copy reuses the existing clipboard authority/u);
assert.match(selectedActions, /projected Delete is explicitly Clip-only/u);
assert.doesNotMatch(table, /phase9m-animation-table-utility-lod|data-candidate="low-zoom"|fixture-only 25%/u,
    'comparison candidate state has not entered production Animation Table');

assert.match(phase, /同じLane \/ Clip \/ key \/ selected stateをA〜Dへ投影する一DOM static fixture/u);
assert.match(phase, /production constantはGate前に変更しない/u);
assert.match(phase, /Frame hit \/ wheel \/ move \/ retimeの論理幅をvisual LODと混同しない/u);
assert.match(githubUrls, /phase9m-animation-table-utility-lod-fixture\.html/u,
    'GitHubURL navigation exposes the Phase 9m comparison fixture');
assert.match(githubUrls, /verify-animation-table-utility-lod-fixture\.mjs/u,
    'GitHubURL navigation exposes the Phase 9m fixed verifier');

console.log('verify-animation-table-utility-lod-fixture: one DOM A-D comparison, LOD/hit split, wheel/action authority and production isolation OK');
