import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [qtpSource, cssSource, tabs, core] = await Promise.all([
    readFile(new URL('../ui/quick-access-popup.js', import.meta.url), 'utf8'),
    readFile(new URL('../styles/main.css', import.meta.url), 'utf8'),
    readFile(new URL('../ui/manga-tabs.js', import.meta.url), 'utf8'),
    readFile(new URL('../core-engine.js', import.meta.url), 'utf8')
]);

assert.doesNotMatch(qtpSource, /qa-text-raster|textRasterService|_commitTextRaster/, 'QTP has no second text editor');
assert.doesNotMatch(cssSource, /\.qa-text-raster/);

const toolGridIndex = qtpSource.indexOf('class="qa-tool-grid"');
const presetGridIndex = qtpSource.indexOf('id="qa-preset-grid"');
const opacityIndex = qtpSource.indexOf('id="pen-opacity-increase"');
assert.ok(toolGridIndex >= 0 && toolGridIndex < presetGridIndex, 'drawing tools must remain before pen presets');
assert.ok(presetGridIndex < opacityIndex, 'pen presets must remain before opacity');
assert.equal((tabs.match(/id: 'lettering'/g) || []).length, 1);
assert.match(tabs, /label: '文字', popupId: 'lettering-popup'/);
assert.match(core, /register\('lettering', LetteringPopup/);
assert.match(core, /layerAdapter: new LetteringLayerAdapter/);
console.log('verify-qtp-text-entry-layout: drawing controls retained, single manga text entry registered OK');
