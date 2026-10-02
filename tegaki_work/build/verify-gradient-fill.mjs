import assert from 'node:assert/strict';
import { applyGradientToPixels, computeGradientT } from '../system/gradient-fill.js';

assert.equal(computeGradientT('linear', { x: 0, y: 0 }, { x: 10, y: 0 }, 5, 99), 0.5, 'linear is constant across the perpendicular');
assert.equal(computeGradientT('linear', { x: 0, y: 0 }, { x: 10, y: 0 }, -5, 0), 0);
assert.equal(computeGradientT('linear', { x: 0, y: 0 }, { x: 10, y: 0 }, 50, 0), 1);
assert.equal(computeGradientT('radial', { x: 0, y: 0 }, { x: 10, y: 0 }, 0, 5), 0.5);
assert.equal(computeGradientT('linear', { x: 3, y: 3 }, { x: 3, y: 3 }, 9, 9), 0, 'zero-length gradient is safe');

const W = 11; const H = 3;
const blank = () => ({ pixels: new Uint8ClampedArray(W * H * 4), width: W, height: H, originX: 0, originY: 0 });
const red = [128, 0, 0, 255]; const clear = [128, 0, 0, 0];

// 赤→透明の線形: 左端はほぼ不透明、右端は透明、色は赤のまま
let t = blank();
const changed = applyGradientToPixels(t, { kind: 'linear', start: { x: 0, y: 0 }, end: { x: 11, y: 0 }, colorA: red, colorB: clear });
assert.ok(changed > 0);
const px = (x, y = 1) => Array.from(t.pixels.slice((y * W + x) * 4, (y * W + x) * 4 + 4));
assert.ok(px(0)[3] > 230, `left opaque (${px(0)[3]})`);
assert.ok(px(10)[3] < 25, `right nearly transparent (${px(10)[3]})`);
assert.ok(px(0)[3] > px(5)[3] && px(5)[3] > px(10)[3], 'alpha decreases monotonically');
for (const x of [0, 3, 6]) assert.deepEqual(px(x).slice(0, 3), [128, 0, 0], 'no colour fringing while fading to transparent');

// 不透明色A→B: 中央でほぼ中間色
t = blank();
applyGradientToPixels(t, { kind: 'linear', start: { x: 0, y: 0 }, end: { x: 11, y: 0 }, colorA: [0, 0, 0, 255], colorB: [200, 100, 50, 255] });
const mid = px(5);
assert.ok(Math.abs(mid[0] - 100) <= 12 && Math.abs(mid[1] - 50) <= 8 && mid[3] === 255, `mid colour ${mid}`);

// 既存画素の上に重なる(source-over)
t = blank();
for (let i = 0; i < W * H; i++) { t.pixels[i * 4] = 0; t.pixels[i * 4 + 1] = 0; t.pixels[i * 4 + 2] = 255; t.pixels[i * 4 + 3] = 255; }
applyGradientToPixels(t, { kind: 'linear', start: { x: 0, y: 0 }, end: { x: 11, y: 0 }, colorA: red, colorB: clear });
assert.ok(px(10)[2] > 230 && px(10)[3] === 255, 'transparent end leaves the backdrop');
assert.ok(px(0)[0] > 100, 'opaque end covers the backdrop');

// 範囲とマスク: boundsの外・マスク0は触らない
t = blank();
const bounds = { x: 2, y: 0, width: 4, height: 3 };
const mask = new Uint8Array(12).fill(1); mask[0] = 0; // (2,0) を除外
applyGradientToPixels(t, { kind: 'linear', start: { x: 0, y: 0 }, end: { x: 11, y: 0 }, colorA: red, colorB: red }, { bounds, mask });
assert.equal(px(1, 1)[3], 0, 'outside bounds untouched');
assert.equal(px(6, 1)[3], 0, 'outside bounds untouched (right)');
assert.equal(px(2, 0)[3], 0, 'masked-out pixel untouched');
assert.equal(px(3, 0)[3], 255);
// 原点オフセット
const off = { pixels: new Uint8ClampedArray(2 * 2 * 4), width: 2, height: 2, originX: 100, originY: 50 };
applyGradientToPixels(off, { kind: 'linear', start: { x: 100, y: 50 }, end: { x: 102, y: 50 }, colorA: red, colorB: red });
assert.equal(off.pixels[3], 255, 'origin offset maps project coordinates');
console.log('gradient fill verifier: t / alpha fade without fringing / source-over / bounds+mask / origin offset ok');
