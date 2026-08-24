import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [source, playbackCss, fixture] = await Promise.all([
    readFile(new URL('../ui/animation-table-popup.js', import.meta.url), 'utf8'),
    readFile(new URL('../styles/components/animation-table-playback.css', import.meta.url), 'utf8'),
    readFile(new URL('./phase9f-animation-table-attention-hierarchy-fixture.html', import.meta.url), 'utf8')
]);

for (const variant of ['current', 'quiet-resting', 'dark-header']) {
    assert.match(fixture, new RegExp(`data-variant="${variant}"`), `${variant} comparison exists`);
}
assert.match(fixture, /B · Quiet Resting[\s\S]*?FIRST CANDIDATE/);
assert.match(fixture, /C · Dark Header[\s\S]*?HOLD/);
assert.match(fixture, /@media \(pointer:coarse\)[\s\S]*?\.play\s*\{\s*width:44px;height:38px/,
    'fixture preserves coarse primary hit area');

assert.match(playbackCss, /\.anim-play-btn\s*\{[\s\S]*?width:\s*28px;[\s\S]*?height:\s*24px;/,
    'normal primary play uses the owner-approved smaller visual size');
assert.match(playbackCss, /@media \(pointer: coarse\)[\s\S]*?\.anim-play-btn\s*\{[\s\S]*?width:\s*44px;[\s\S]*?height:\s*38px;/,
    'coarse primary play hit area remains unchanged');
assert.match(playbackCss, /Phase 9f attention hierarchy[\s\S]*?\.anim-scope-current-btn\s*\{[\s\S]*?border-color:\s*transparent;/,
    'resting scope border is quiet');
assert.match(playbackCss, /\.anim-scope-controls\.is-open \.anim-scope-current-btn,[\s\S]*?border-color:\s*var\(--ui-border-active\);/,
    'open and focus scope states restore a semantic border');
assert.match(playbackCss, /\.anim-preview-toggle,[\s\S]*?\.anim-onion-toggle\s*\{[\s\S]*?border-color:\s*transparent;/,
    'resting preview and onion borders are quiet');
assert.match(playbackCss, /\.anim-preview-toggle\.active,[\s\S]*?\.anim-onion-toggle\.is-active\s*\{[\s\S]*?border-color:\s*var\(--active-border\);/,
    'active preview and onion states remain explicit');
assert.match(playbackCss, /\.anim-zoom-controls\s*\{[\s\S]*?border-color:\s*transparent;/,
    'resting zoom wrapper border is quiet');
assert.match(playbackCss, /\.anim-assets-toggle-btn,[\s\S]*?\.anim-group-btn\s*\{[\s\S]*?border-color:\s*transparent;/,
    'resting non-destructive secondary action borders are quiet');
assert.doesNotMatch(playbackCss, /\.anim-selected-clip-action-btn--delete[\s\S]*?border-color:\s*transparent;/,
    'contextual destructive action is not flattened by the phase 9f slice');

assert.match(source, /timelineHeader\?\.addEventListener\('wheel',[\s\S]*?_handleTimelineHeaderWheel/);
assert.match(source, /header\.addEventListener\('pointerdown',[\s\S]*?\.anim-playback-controls/);
assert.match(source, /id="anim-scope-current-btn"[\s\S]*?id="anim-play-toggle-btn"/);

console.log('verify-animation-table-attention-hierarchy: quiet resting hierarchy, compact visual play, coarse hit and gesture authority OK');
