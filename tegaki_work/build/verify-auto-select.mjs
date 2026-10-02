import assert from 'node:assert/strict';
import { floodSelectRegion, maskContains, traceMaskOutline } from '../system/auto-select.js';

const W = 10; const H = 10;
const make = (fn) => { const p = new Uint8ClampedArray(W * H * 4); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const c = fn(x, y); const i = (y * W + x) * 4; p[i] = c[0]; p[i + 1] = c[1]; p[i + 2] = c[2]; p[i + 3] = c[3]; } return p; };
const WHITE = [255, 255, 255, 255]; const BLACK = [0, 0, 0, 255]; const CLEAR = [0, 0, 0, 0];

// 白地に黒い枠(3..6)。内側(4,4)を選ぶと内側だけ。
const framed = make((x, y) => (x >= 3 && x <= 6 && y >= 3 && y <= 6 && (x === 3 || x === 6 || y === 3 || y === 6)) ? BLACK : WHITE);
let r = floodSelectRegion({ pixels: framed, width: W, height: H, seedX: 4, seedY: 4, tolerance: 10 });
assert.ok(r.ok);
assert.deepEqual(r.bounds, { x: 4, y: 4, width: 2, height: 2 });
assert.equal(r.count, 4);
// 外側は枠を回り込む(連続): 100 - 枠12 - 内側4 = 84
r = floodSelectRegion({ pixels: framed, width: W, height: H, seedX: 0, seedY: 0, tolerance: 10 });
assert.equal(r.count, 84);
// 非連続: 白全体(内側も含む)
r = floodSelectRegion({ pixels: framed, width: W, height: H, seedX: 0, seedY: 0, tolerance: 10, contiguous: false });
assert.equal(r.count, 88);
// 枠の穴が開いていれば内側も外側とつながる
const gap = make((x, y) => (x >= 3 && x <= 6 && y >= 3 && y <= 6 && (x === 3 || x === 6 || y === 3 || y === 6) && !(x === 3 && y === 4)) ? BLACK : WHITE);
r = floodSelectRegion({ pixels: gap, width: W, height: H, seedX: 4, seedY: 4, tolerance: 10 });
assert.equal(r.count, 89);
// 許容値: 薄いグレー(250)は tolerance 5 で白に含まれ、 3 では含まれない
const soft = make((x) => x < 5 ? [255, 255, 255, 255] : [250, 250, 250, 255]);
assert.equal(floodSelectRegion({ pixels: soft, width: W, height: H, seedX: 0, seedY: 0, tolerance: 5 }).count, 100);
assert.equal(floodSelectRegion({ pixels: soft, width: W, height: H, seedX: 0, seedY: 0, tolerance: 3 }).count, 50);
// 透明同士は色を無視
const clear = make((x) => x < 5 ? [10, 20, 30, 0] : [200, 100, 0, 0]);
assert.equal(floodSelectRegion({ pixels: clear, width: W, height: H, seedX: 0, seedY: 0, tolerance: 0 }).count, 100);
// 原点オフセット(Project座標)とmaskContains
r = floodSelectRegion({ pixels: framed, width: W, height: H, seedX: 104, seedY: 204, originX: 100, originY: 200, tolerance: 10 });
assert.deepEqual(r.bounds, { x: 104, y: 204, width: 2, height: 2 });
const sel = { bounds: r.bounds, mask: r.mask };
assert.equal(maskContains(sel, 104, 204), true);
assert.equal(maskContains(sel, 103, 204), false);
assert.equal(maskContains({ bounds: r.bounds }, 0, 0), true, 'no mask = whole rect');
// 失敗系
assert.equal(floodSelectRegion({ pixels: framed, width: W, height: H, seedX: 50, seedY: 0 }).reason, 'seed-outside');
assert.equal(floodSelectRegion({ pixels: null, width: W, height: H, seedX: 0, seedY: 0 }).reason, 'no-pixels');
// 輪郭: 長方形は4頂点、穴あきは2輪郭(外+穴)、L字は6頂点
{
    const rect = new Uint8Array(12).fill(1); // 4x3
    const o = traceMaskOutline(rect, 4, 3);
    assert.ok(o.ok); assert.equal(o.loops.length, 1); assert.equal(o.loops[0].length, 4);
    const holed = new Uint8Array(25).fill(1); holed[12] = 0; // 5x5の中央が穴
    const h = traceMaskOutline(holed, 5, 5);
    assert.equal(h.loops.length, 2, 'outer loop + hole loop');
    const ell = new Uint8Array(9); [0, 3, 6, 7, 8].forEach(i => { ell[i] = 1; }); // 3x3のL字
    const l = traceMaskOutline(ell, 3, 3);
    assert.equal(l.loops.length, 1); assert.equal(l.loops[0].length, 6);
    // 実際のflood結果(枠の内側)でも1輪郭
    const fr = floodSelectRegion({ pixels: framed, width: W, height: H, seedX: 4, seedY: 4, tolerance: 10 });
    assert.equal(traceMaskOutline(fr.mask, fr.bounds.width, fr.bounds.height).loops.length, 1);
    // 複雑すぎるマスクは諦めて呼び出し側にbbox表示へ戻させる
    const checker = new Uint8Array(100 * 100); for (let i = 0; i < checker.length; i++) checker[i] = ((i % 100) + Math.floor(i / 100)) % 2;
    assert.equal(traceMaskOutline(checker, 100, 100, { maxVertices: 1000 }).ok, false);
}
console.log('auto-select verifier: outline trace / flood contiguous/non-contiguous / tolerance / transparent / origin offset / mask lookup ok');
