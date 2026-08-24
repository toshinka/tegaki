import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [source, componentCss, fixture] = await Promise.all([
    readFile(new URL('../ui/quick-access-popup.js', import.meta.url), 'utf8'),
    readFile(new URL('../styles/components/quick-access-popup.css', import.meta.url), 'utf8'),
    readFile(new URL('./phase9g-qtp-attention-hierarchy-fixture.html', import.meta.url), 'utf8')
]);

for (const variant of ['current', 'selected-ring', 'flat-all']) {
    assert.match(fixture, new RegExp(`data-variant="${variant}"`), `${variant} comparison exists`);
}
assert.match(fixture, /B · Selected Ring[\s\S]*?FIRST CANDIDATE/);
assert.match(fixture, /C · Flat All[\s\S]*?HOLD/);
assert.match(fixture, /cream chipは薄い内側contrast/);
assert.match(fixture, /@media\(pointer:coarse\)[\s\S]*?\.preset\{min-height:42px\}/,
    'fixture preserves a separate coarse target comparison');

assert.match(componentCss, /Phase 9g adds static resting \/ selected \/ focus[\s\S]*?palette color cells, tool cells and preset cells only/,
    'phase 9g component boundary is explicit');
assert.match(componentCss, /#quick-access-popup\.qa-popup \.qa-color-button\s*\{[\s\S]*?border-color:\s*transparent;[\s\S]*?inset 0 0 0 1px/,
    'resting color cells keep only a subtle internal contrast edge');
assert.match(componentCss, /#quick-access-popup\.qa-popup \.qa-color-button\.active\s*\{[\s\S]*?var\(--ui-border-active\)[\s\S]*?0 0 0 2px/,
    'selected color remains explicit');
assert.match(componentCss, /#quick-access-popup\.qa-popup \.qa-tool-button,[\s\S]*?\.qa-preset-slot\s*\{[\s\S]*?border-color:\s*transparent;/,
    'resting tool and preset borders are quiet');
assert.match(componentCss, /\.qa-color-button:focus-visible,[\s\S]*?\.qa-preset-slot:focus-visible\s*\{[\s\S]*?outline:\s*2px solid var\(--active-border\);/,
    'keyboard focus is explicit for all three cell families');
assert.match(source, /class="qa-color-button color-button"[\s\S]*?data-color-index/);
assert.match(source, /\.qa-color-button\.active[\s\S]*?box-shadow:/);
assert.match(source, /\.qa-tool-button\.active[\s\S]*?var\(--ui-border-active\)/);
assert.match(source, /\.qa-preset-slot\.active[\s\S]*?box-shadow:/);
assert.match(source, /slot\.classList\.toggle\('active', isPresetEnabled && activeIndex === index\)/);
assert.match(source, /QA_STORAGE_KEYS[\s\S]*?presets:[\s\S]*?colorSlots:[\s\S]*?mainSubColors:/);
assert.match(source, /target\.closest\('\.qa-preset-slot'\)[\s\S]*?target\.closest\('\.qa-palette-grid'\)/,
    'header drag still excludes preset and palette interaction');

console.log('verify-qtp-attention-hierarchy: selected-ring production slice and QTP state authority OK');
