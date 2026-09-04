import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../ui/animation-table-popup.js', import.meta.url), 'utf8');
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
    'id="anim-loop-toggle-btn"',
    'id="anim-preview-toggle-btn"',
    'id="anim-onion-toggle-btn"',
    'id="anim-play-toggle-btn"'
], 'playback row');

assertOrdered(clipRow, [
    'id="anim-zoom-out-btn"',
    'id="anim-assets-toggle-btn"',
    'id="anim-duration-dec"',
    'id="anim-motion-open-btn"',
    'id="anim-copy-btn"',
    'id="anim-paste-btn"',
    'id="anim-group-btn"',
    'id="anim-delete-active-btn"',
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
assert.match(source, /\.animation-table-panel\.is-narrow \.anim-table-header-row\s*\{[\s\S]*?flex-wrap:\s*wrap;/);
assert.match(source, /timelineHeader\?\.addEventListener\('wheel',[\s\S]*?_handleTimelineHeaderWheel/);
assert.match(source, /const ANIMATION_TABLE_UI_DENSITY_VERSION = 2;/);
assert.match(source, /const ANIMATION_TABLE_DEFAULT_HEIGHT = 266;/);
assert.match(source, /Math\.abs\(size\.height - 260\)/);
assert.match(source, /Math\.abs\(size\.height - 240\)/);

console.log('verify-animation-table-header-layout: explicit rows, semantic order, narrow wrap, wheel and height migration OK');
