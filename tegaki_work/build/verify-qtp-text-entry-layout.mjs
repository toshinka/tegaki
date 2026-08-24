import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [qtpSource, cssSource] = await Promise.all([
    readFile(new URL('../ui/quick-access-popup.js', import.meta.url), 'utf8'),
    readFile(new URL('../styles/main.css', import.meta.url), 'utf8')
]);

const idCount = (id) => (qtpSource.match(new RegExp(`id="${id}"`, 'g')) || []).length;
[
    'qa-text-raster-toggle',
    'qa-text-raster-panel',
    'qa-text-raster-content',
    'qa-text-raster-family',
    'qa-text-raster-size',
    'qa-text-raster-bold',
    'qa-text-raster-color',
    'qa-text-raster-cancel',
    'qa-text-raster-confirm'
].forEach((id) => assert.equal(idCount(id), 1, `${id} must keep one DOM authority`));

const toolGridIndex = qtpSource.indexOf('class="qa-tool-grid"');
const presetGridIndex = qtpSource.indexOf('id="qa-preset-grid"');
const opacityIndex = qtpSource.indexOf('id="pen-opacity-increase"');
const textUtilityIndex = qtpSource.indexOf('class="qa-section qa-text-raster-utility"');
assert.ok(toolGridIndex >= 0 && toolGridIndex < presetGridIndex, 'drawing tools must remain before pen presets');
assert.ok(presetGridIndex < opacityIndex, 'pen presets must remain before opacity');
assert.ok(opacityIndex < textUtilityIndex, 'Text utility must follow drawing tool, preset, size and opacity controls');

assert.match(qtpSource, /qa-text-raster-toggle[\s\S]*aria-expanded="false"[\s\S]*aria-controls="qa-text-raster-panel"/);
assert.match(qtpSource, /<span>TEXT<\/span>/);
assert.match(qtpSource, /qa-text-raster-options[\s\S]*qa-text-raster-family-field[\s\S]*qa-text-raster-secondary-row[\s\S]*qa-text-raster-size-field[\s\S]*qa-text-raster-bold[\s\S]*qa-text-raster-color/);
assert.match(qtpSource, /_setTextRasterPanelOpen\(open\)[\s\S]*aria-expanded/);
assert.match(qtpSource, /textRasterService\.createTextLayer/);

assert.match(cssSource, /\.qa-text-raster-utility\s*\{[\s\S]*width:\s*var\(--ui-qa-inner-width\)/);
assert.match(cssSource, /\.qa-text-raster-toggle\s*\{[\s\S]*width:\s*auto;[\s\S]*min-width:\s*62px/);
assert.match(cssSource, /\.qa-text-raster-toggle\.active\s*\{[\s\S]*border-color:\s*var\(--ui-border-active\)/);
assert.match(cssSource, /\.qa-text-raster-options\s*\{[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\)/);
assert.match(cssSource, /\.qa-text-raster-secondary-row\s*\{[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\) auto 18px/);

console.log('verify-qtp-text-entry-layout: compact utility order, single DOM authority, ARIA and two-row fields OK');
