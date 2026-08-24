import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../ui/animation-table-popup.js', import.meta.url), 'utf8');
const panelMethodStart = source.indexOf('_ensurePanelElement()');
const templateStart = source.indexOf('this.panel.innerHTML = `', panelMethodStart);
const templateEnd = source.indexOf('document.body.appendChild(this.panel);', templateStart);
assert.ok(panelMethodStart >= 0 && templateStart >= 0 && templateEnd > templateStart);

const template = source.slice(templateStart, templateEnd);
const clipRowStart = template.indexOf('anim-table-header-row--clip');
const clipRow = template.slice(clipRowStart);
assert.ok(clipRowStart >= 0, 'selected Clip projection stays inside the existing Clip header row');

for (const id of [
    'anim-selected-clip-actions',
    'anim-selected-clip-target',
    'anim-selected-clip-duration',
    'anim-selected-clip-duration-value',
    'anim-selected-clip-copy-btn',
    'anim-selected-clip-group-btn',
    'anim-selected-clip-delete-btn'
]) {
    assert.equal(template.split(`id="${id}"`).length - 1, 1, `${id} is mounted once`);
}

const pasteIndex = clipRow.indexOf('id="anim-paste-btn"');
const selectedActionsIndex = clipRow.indexOf('id="anim-selected-clip-actions"');
const closeIndex = clipRow.indexOf('id="anim-table-close-btn"');
assert.ok(pasteIndex >= 0 && selectedActionsIndex > pasteIndex && closeIndex > selectedActionsIndex,
    'Paste remains a separate current Frame/Lane action before the selected Clip strip');

assert.match(source, /selectedClipActions\.hidden\s*=\s*!hasSelectedClip;/,
    'selection is the display authority and clears stale projection');
assert.match(source, /durationProjection\.hidden\s*=\s*!isSingleUngroupedClip;/,
    'Duration projection is limited to one ungrouped selected Clip');
assert.match(source, /legacyClipActions\?\.classList\.toggle\('has-selected-clip-context', hasSelectedClip\);/,
    'legacy actions remain mounted while duplicate selected-Clip exposure is suppressed');
assert.match(source, /\.has-selected-clip-context #anim-copy-btn,[\s\S]*?#anim-group-btn,[\s\S]*?#anim-delete-active-btn\s*\{[\s\S]*?display:\s*none;/,
    'only projected Copy, Group, and Clip Delete are hidden from the legacy row');
assert.doesNotMatch(
    source.match(/\.anim-copy-paste-controls\.has-selected-clip-context[\s\S]*?\}/)?.[0] || '',
    /anim-paste-btn/,
    'Paste is never absorbed by the selected Clip projection'
);
assert.match(source, /\.anim-selected-clip-action-btn\[hidden\]\s*\{[\s\S]*?display:\s*none;/,
    'single-selection Group stays visually hidden despite the shared button display rule');

assert.match(source, /#anim-selected-clip-copy-btn'\)[\s\S]*?copySelectedCel\(\)/,
    'projected Copy reuses the existing clipboard authority');
assert.match(source, /#anim-selected-clip-group-btn'\)[\s\S]*?toggleSelectedClipGroup\(\)/,
    'projected Group reuses the existing group authority');
assert.match(source, /#anim-selected-clip-delete-btn'\)[\s\S]*?deleteSelectedClips\(\)/,
    'projected Delete is explicitly Clip-only');
assert.match(source, /#anim-delete-active-btn'[\s\S]*?deleteActiveSelection\(\)/,
    'legacy dual-authority Delete remains available for Lane-only selection');
assert.match(source, /Math\.abs\(dx\) > 4 \|\| Math\.abs\(dy\) > 4/,
    'Clip move keeps the existing 4px threshold');

console.log('verify-animation-table-selected-clip-actions: contextual projection, Paste/Lane authority and Clip gesture boundary OK');
