import assert from 'node:assert/strict';
import { computeBorderPixels, contentBounds, squaredDistanceFromSeeds } from '../system/border-fill.js';

const W = 40; const H = 40;
const make = () => ({ pixels: new Uint8ClampedArray(W * H * 4), width: W, height: H, originX: 0, originY: 0 });
const fillRect = (t, x0, y0, x1, y1, rgba) => { for (let y = y0; y < y1; y += 1) for (let x = x0; x < x1; x += 1) t.pixels.set(rgba, (y * W + x) * 4); };
const at = (res, x, y) => { const i = ((y - res.region.y) * res.region.width + (x - res.region.x)) * 4; return Array.from(res.pixels.slice(i, i + 4)); };

// 距離変換: 単一seedからのユークリッド距離
{
    const seed = new Uint8Array(9 * 9); seed[4 * 9 + 4] = 1;
    const d = squaredDistanceFromSeeds(seed, 9, 9);
    assert.equal(d[4 * 9 + 4], 0); assert.equal(d[4 * 9 + 7], 9); assert.equal(d[7 * 9 + 7], 18);
}

// 外側: 10x10の赤い四角に太さ4の青いフチ
const t = make(); fillRect(t, 15, 15, 25, 25, [255, 0, 0, 255]);
assert.deepEqual(contentBounds(t), { x: 15, y: 15, width: 10, height: 10 });
const out = computeBorderPixels(t, { x: 0, y: 0, width: W, height: H }, { radius: 4, rgb: [0, 0, 255], position: 'outside' });
assert.deepEqual(at(out, 20, 20), [255, 0, 0, 255], 'original stays untouched');
assert.deepEqual(at(out, 14, 20), [0, 0, 255, 255], 'border right next to the shape');
assert.deepEqual(at(out, 11, 20), [0, 0, 255, 255], 'border within radius (3-4px away)');
assert.equal(at(out, 10, 20)[3], 0, 'one pixel beyond the radius is transparent');
assert.equal(at(out, 5, 20)[3], 0, 'beyond radius is transparent');
assert.equal(at(out, 25, 25)[3] > 0, true, 'corner is covered (round: distance sqrt(2))');
// 丸い角: 角の斜め先(距離 > radius)は塗らない
assert.equal(at(out, 11, 11)[3], 0, 'round corner leaves the far diagonal empty');
// 入力は書き換えない
assert.equal(t.pixels[(20 * W + 14) * 4 + 3], 0);

// 内側: 絵の外周から太さ3だけ縁色に、alphaは変えない
const inner = computeBorderPixels(t, { x: 0, y: 0, width: W, height: H }, { radius: 3, rgb: [0, 255, 0], position: 'inside' });
assert.deepEqual(at(inner, 15, 20), [0, 255, 0, 255], 'edge pixel becomes border color');
assert.deepEqual(at(inner, 20, 20), [255, 0, 0, 255], 'center is unchanged');
assert.equal(at(inner, 10, 20)[3], 0, 'outside stays transparent');

// 半透明の縁(アンチエイリアス)の上でも破綻しない: 半透明画素の下に縁が回る
const aa = make(); fillRect(aa, 15, 15, 25, 25, [255, 0, 0, 255]); fillRect(aa, 14, 15, 15, 25, [255, 0, 0, 100]);
const aaOut = computeBorderPixels(aa, { x: 0, y: 0, width: W, height: H }, { radius: 3, rgb: [0, 0, 255], position: 'outside' });
const px = at(aaOut, 14, 20);
assert.ok(px[3] > 100 && px[3] <= 255, 'alpha grows by the border beneath');
assert.ok(px[2] > px[0] * 0.4, 'blue border shows through the translucent edge');

// 範囲指定: 範囲の外には描かない
const small = computeBorderPixels(t, { x: 12, y: 12, width: 16, height: 16 }, { radius: 4, rgb: [0, 0, 255], position: 'outside' });
assert.equal(small.region.width, 16);
// 空の絵
assert.equal(contentBounds(make()), null);
console.log('verify-border-fill: ok');
