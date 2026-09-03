import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const qtpSource = await readFile(new URL('../ui/quick-access-popup.js', import.meta.url), 'utf8');

assert.equal((qtpSource.match(/id="qa-preset-section"/g) || []).length, 1, 'preset section must keep one DOM authority');
assert.match(qtpSource, /presetSection:\s*document\.getElementById\('qa-preset-section'\)/, 'runtime projection caches the existing section');
assert.match(qtpSource, /const isPresetEnabled = Boolean\(presetKey\)/, 'existing tool relevance remains the visibility authority');
assert.match(qtpSource, /this\.elements\.presetSection\.hidden = !isPresetEnabled/, 'unsupported tools hide only the preset section');
assert.match(qtpSource, /setAttribute\('aria-hidden', String\(!isPresetEnabled\)\)/, 'visual and accessibility exposure remain synchronized');

assert.match(qtpSource, /const QA_PRESET_TOOLS = \['pen', 'eraser', 'airbrush'\]/, 'Pen, Eraser and Airbrush keep the six-slot contract');
assert.match(qtpSource, /Array\.from\(\{ length: QA_PRESET_SLOT_COUNT \}/, 'all six direct preset buttons remain in one DOM');
assert.match(qtpSource, /slot\.disabled = !isPresetEnabled/, 'hidden unsupported controls remain safely disabled');
assert.match(qtpSource, /_selectPresetSlot\(index\)/, 'direct preset selection authority remains unchanged');
assert.match(qtpSource, /id="qa-text-raster-toggle"/, 'Text utility remains independent');
assert.match(qtpSource, /id="qa-position-toggle"/, 'Position deck remains independent');
assert.match(qtpSource, /position:\s*'quick-access-position'/, 'free position persistence remains unchanged');
assert.doesNotMatch(qtpSource, /densityMode|compactMode|qtpMode|quick-access-density/, 'no FULL / COMPACT state or storage key is introduced');

console.log('verify-qtp-progressive-density: relevance-only preset exposure, six-slot authority, Text/Position independence and no density mode state OK');
