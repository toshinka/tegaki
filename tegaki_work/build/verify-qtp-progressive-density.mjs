import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const qtpSource = await readFile(new URL('../ui/quick-access-popup.js', import.meta.url), 'utf8');

assert.equal((qtpSource.match(/id="qa-preset-section"/g) || []).length, 1, 'preset section must keep one DOM authority');
assert.match(qtpSource, /presetSection:\s*document\.getElementById\('qa-preset-section'\)/, 'runtime projection caches the existing section');
assert.match(qtpSource, /const isPresetEnabled = Boolean\(presetKey\)/, 'existing tool relevance remains the availability authority');
assert.match(qtpSource, /this\.elements\.presetSection\.hidden = false/, 'third shelf remains mounted for every tool');
assert.match(qtpSource, /removeAttribute\('aria-hidden'\)/, 'third shelf remains exposed to accessibility for every tool');

assert.match(qtpSource, /const QA_PRESET_TOOLS = \['pen', 'eraser', 'airbrush'\]/, 'Pen, Eraser and Airbrush keep the six-slot contract');
assert.match(qtpSource, /Array\.from\(\{ length: QA_PRESET_SLOT_COUNT \}/, 'all six direct preset buttons remain in one DOM');
assert.match(qtpSource, /slot\.disabled = !isPresetEnabled/, 'unsupported controls remain safely disabled');
assert.match(qtpSource, /slot\.classList\.toggle\('is-empty', !preset\)/, 'empty and unsupported slots retain an explicit cell state');
assert.match(qtpSource, /sizeValEl\.textContent = preset \? `\$\{this\._roundSize\(size\)\}` : '—'/, 'empty and unsupported slots display a stable placeholder');
assert.match(qtpSource, /class="qa-preset-status" id="qa-preset-status" role="status" aria-live="polite"/, 'status remains accessible without a visible label row');
assert.match(qtpSource, /_selectPresetSlot\(index\)/, 'direct preset selection authority remains unchanged');
assert.doesNotMatch(qtpSource, /qa-text-raster/, 'Text editing moved to manga; QTP stays drawing-focused');
assert.match(qtpSource, /position:\s*'quick-access-position'/, 'free position persistence remains unchanged');
assert.doesNotMatch(qtpSource, /densityMode|compactMode|qtpMode|quick-access-density/, 'no FULL / COMPACT state or storage key is introduced');

console.log('verify-qtp-progressive-density: fixed third shelf, six-slot authority, Text/Position independence and no density mode state OK');
