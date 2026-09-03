import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../ui/animation-table-popup.js', import.meta.url), 'utf8');
const panelMethodStart = source.indexOf('_ensurePanelElement()');
const templateStart = source.indexOf('this.panel.innerHTML = `', panelMethodStart);
const templateEnd = source.indexOf('document.body.appendChild(this.panel);', templateStart);
assert.ok(panelMethodStart >= 0 && templateStart >= 0 && templateEnd > templateStart);

const template = source.slice(templateStart, templateEnd);
const selectedActionsStart = template.indexOf('id="anim-selected-clip-actions"');
const selectedActionsEnd = template.indexOf('</div>', selectedActionsStart);
const selectedActions = template.slice(selectedActionsStart, selectedActionsEnd);
assert.ok(selectedActionsStart >= 0 && selectedActionsEnd > selectedActionsStart,
    'Selected Clip Action strip remains the Duration projection surface');

for (const id of [
    'anim-selected-clip-duration',
    'anim-selected-clip-duration-value',
    'anim-duration-dec',
    'anim-duration-inc'
]) {
    assert.equal(template.split(`id="${id}"`).length - 1, 1, `${id} stays unique`);
    assert.ok(selectedActions.includes(`id="${id}"`), `${id} is nested in the Selected Clip Action strip`);
}

assert.doesNotMatch(template, /class="anim-duration-controls"/,
    'standalone DURATION group is removed from the normal header');
assert.match(source, /const isSingleUngroupedClip = !!clip[\s\S]*?selectedIds\.size === 1[\s\S]*?!this\.model\.getClipGroupForClip\?\.\(clip\.id\);/,
    'single-selection and Group authority control Duration exposure');
assert.match(source, /durationProjection\.hidden\s*=\s*!isSingleUngroupedClip;/,
    'multiple, grouped, and stale selections hide the Duration projection');
assert.match(source, /durationValue\.textContent\s*=\s*clip \? `\$\{clip\.duration\}F` : '—';/,
    'current Clip Duration is projected as a Frame value');
assert.match(source, /#anim-duration-dec'\)[\s\S]*?_adjustSelectedCelDuration\(-1\)/,
    'decrease keeps the existing handler');
assert.match(source, /#anim-duration-inc'\)[\s\S]*?_adjustSelectedCelDuration\(1\)/,
    'increase keeps the existing handler');
assert.match(source, /_adjustSelectedCelDuration\(delta\)[\s\S]*?_applyRetimingWithPush\(retimingData, newDuration - previousDuration\)[\s\S]*?'caf-clip-duration'/,
    'button retime keeps push and Timeline History authority');
assert.match(source, /class="anim-tool-btn anim-icon-btn anim-assets-toggle-btn" id="anim-assets-toggle-btn"/,
    'LIB remains independently mounted');
assert.match(source, /#anim-assets-toggle-btn'[\s\S]*?isAssetLibraryVisible/,
    'LIB keeps its runtime visibility authority');

console.log('verify-animation-table-duration-context: selected Clip projection, retime/History and LIB boundary OK');
