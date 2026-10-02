import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { RASTER_SAFE_PIXELS_DEFAULT, getRasterSafePixels, validateRasterSurfaceSize } from '../system/raster-bounds.js';

// 既定のキャンバスは従来どおり16Mpx上限。大きいキャンバスはキャンバス1枚分まで許す。
assert.equal(getRasterSafePixels({ width: 1920, height: 1080 }), RASTER_SAFE_PIXELS_DEFAULT);
assert.equal(getRasterSafePixels(null), RASTER_SAFE_PIXELS_DEFAULT);
assert.equal(getRasterSafePixels({ width: 4960, height: 7016 }), 4960 * 7016);

const manga = { width: 4960, height: 7016 };
assert.equal(validateRasterSurfaceSize(manga, { maxAxis: 8192, maxPixels: RASTER_SAFE_PIXELS_DEFAULT }).reason, 'pixel-limit',
    'without the canvas-aware budget a full-canvas manga layer would be rejected');
assert.equal(validateRasterSurfaceSize(manga, { maxAxis: 8192, maxPixels: getRasterSafePixels(manga) }).ok, true);
assert.equal(validateRasterSurfaceSize({ width: 9000, height: 100 }, { maxAxis: 8192, maxPixels: getRasterSafePixels(manga) }).reason, 'axis-limit');

// プリセットが3種追加され、上限が数値入力/プリセットで8192まで
const popup = readFileSync(new URL('../ui/resize-popup.js', import.meta.url), 'utf8');
for (const [w, h] of [[1200, 1200], [1700, 2400], [4960, 7016]]) {
    assert.match(popup, new RegExp(`data-width="${w}" data-height="${h}"`), `preset ${w}x${h}`);
}
assert.match(popup, /ABSOLUTE_MAX_SIZE = canvasConfig\.absoluteMaxSize \|\| 8192/);
const config = readFileSync(new URL('../config.js', import.meta.url), 'utf8');
assert.match(config, /absoluteMaxSize: 8192/);
assert.ok(4960 <= 8192 && 7016 <= 8192, 'manga size fits the 8192 axis limit');
console.log('canvas size presets verifier: safe-pixel budget / presets / absolute max ok');
