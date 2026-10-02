import assert from 'node:assert/strict';
import {
    LAYER_BLEND_MODES, LAYER_BLEND_MODE_GROUPS, getLayerBlendModePsdName, getLayerBlendModeShortLabel,
    isAdvancedLayerBlendMode, layerBlendModeFromPsdName, normalizeLayerBlendMode
} from '../system/layer-blend-modes.js';

const values = LAYER_BLEND_MODES.map(m => m.value);
assert.equal(new Set(values).size, values.length, 'values are unique');
assert.equal(values[0], 'normal');
assert.ok(values.length >= 16, 'normal + 15 modes');
const groupIds = new Set(LAYER_BLEND_MODE_GROUPS.map(g => g.id));
for (const m of LAYER_BLEND_MODES) assert.ok(groupIds.has(m.group), `${m.value} has a known group`);

// 保存値の正規化: 旧4種はそのまま、未知は normal
for (const v of ['normal', 'multiply', 'add', 'overlay']) assert.equal(normalizeLayerBlendMode(v), v);
for (const v of ['hue', 'divide', 'nonsense', '', null, undefined, 3]) assert.equal(normalizeLayerBlendMode(v), 'normal');

// 標準3種+normalはバックバッファ不要、他は必要
for (const v of ['normal', 'add', 'multiply', 'screen']) assert.equal(isAdvancedLayerBlendMode(v), false, v);
for (const v of ['overlay', 'color', 'luminosity', 'soft-light']) assert.equal(isAdvancedLayerBlendMode(v), true, v);
assert.equal(isAdvancedLayerBlendMode('unknown'), false);

// PSD往復
for (const m of LAYER_BLEND_MODES) {
    assert.equal(layerBlendModeFromPsdName(getLayerBlendModePsdName(m.value)), m.value, `psd round trip ${m.value}`);
}
assert.equal(getLayerBlendModePsdName('normal', true), 'pass through');
assert.equal(layerBlendModeFromPsdName('pass through'), 'normal');
assert.equal(layerBlendModeFromPsdName('dissolve'), 'normal');

assert.equal(getLayerBlendModeShortLabel('normal'), '');
assert.equal(getLayerBlendModeShortLabel('overlay'), 'OL');
console.log('layer blend modes verifier: unique values / groups / normalize / advanced flag / PSD round trip ok');
