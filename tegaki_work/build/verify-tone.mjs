import assert from 'node:assert/strict';
import {
    TONE_DEFAULT_COLOR,
    TONE_SHAPES,
    countToneCells,
    defaultToneParams,
    forEachToneCell,
    normalizeToneParams,
    sanitizeToneData,
    toneDensityAt
} from '../system/tone-geometry.js';

const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} !~ ${b}`);
const ref = { x: 0, y: 0, w: 400, h: 400 };

// 既定はふたば配色(maroon)で、黒ではない。網点・45度・30%
{
    const d = defaultToneParams();
    assert.equal(d.color, '#800000');
    assert.equal(TONE_DEFAULT_COLOR, '#800000');
    assert.deepEqual([d.shape, d.angle, d.density, d.gradient], ['dot', 45, 0.3, false]);
    assert.equal(normalizeToneParams({ color: 'black' }).color, '#800000');
    assert.deepEqual(TONE_SHAPES.map(s => s.id), ['dot', 'diamond', 'line']);
}

// 正規化: clamp / 開始>終了の入替 / 不正値は既定
{
    const n = normalizeToneParams({ shape: 'x', pitch: 1, angle: 999, density: 5, density2: -1, gradStart: 0.9, gradEnd: 0.2, ease: 'y', gradient: 'yes' });
    assert.equal(n.shape, 'dot');
    assert.equal(n.pitch, 3);
    assert.equal(n.angle, 359.5);
    assert.equal(n.density, 1);
    assert.equal(n.density2, 0);
    assert.deepEqual([n.gradStart, n.gradEnd], [0.2, 0.9]);
    assert.equal(n.ease, 'linear');
    assert.equal(n.gradient, false, 'trueのみ有効');
}

// 濃度: 均一はどこでも同じ。グラデは方向に沿って d1→d2、範囲外は端の値
{
    const flat = { ...defaultToneParams(), density: 0.4 };
    near(toneDensityAt(flat, ref, 10, 10), 0.4);
    near(toneDensityAt(flat, ref, 390, 300), 0.4);
    const g = { ...defaultToneParams(), gradient: true, density: 0.8, density2: 0.0, gradAngle: 90 };
    near(toneDensityAt(g, ref, 200, 0), 0.8, 1e-9);
    near(toneDensityAt(g, ref, 200, 200), 0.4, 1e-9);
    near(toneDensityAt(g, ref, 200, 400), 0.0, 1e-9);
    near(toneDensityAt(g, ref, 0, 200), toneDensityAt(g, ref, 400, 200), 1e-9);
    // 範囲(開始/終了)の外は端の値のまま
    const ranged = { ...g, gradStart: 0.25, gradEnd: 0.75 };
    near(toneDensityAt(ranged, ref, 200, 40), 0.8, 1e-9);
    near(toneDensityAt(ranged, ref, 200, 360), 0.0, 1e-9);
    near(toneDensityAt(ranged, ref, 200, 200), 0.4, 1e-9);
    // 角度0=右へ増える
    const h = { ...g, gradAngle: 0, density: 0, density2: 1 };
    near(toneDensityAt(h, ref, 0, 100), 0, 1e-9);
    near(toneDensityAt(h, ref, 400, 100), 1, 1e-9);
    // smoothは中点で同値、端の近くで緩やか
    const smooth = { ...g, ease: 'smooth' };
    near(toneDensityAt(smooth, ref, 200, 200), 0.4, 1e-9);
    assert.ok(toneDensityAt(smooth, ref, 200, 40) > toneDensityAt(g, ref, 200, 40), 'smooth: ease-out near start of 0.8→0');
}

// 格子: 面積あたりのセル数 ≈ 1/pitch² (回転しても)。セル中心は格子上(原点基準)で、別fillでも同じ点が出る
for (const angle of [0, 15, 45, 90, 123]) {
    const p = { ...defaultToneParams(), pitch: 10, angle, density: 0.5 };
    const fill = { x: 0, y: 0, w: 400, h: 400 };
    let n = 0;
    forEachToneCell(p, ref, fill, (x, y) => { if (x >= 0 && x < 400 && y >= 0 && y < 400) n += 1; });
    assert.ok(Math.abs(n - 1600) <= 40, `angle ${angle}: ${n} cells in 400x400 at pitch 10`);
}
{
    const p = { ...defaultToneParams(), pitch: 12, angle: 30 };
    const a = new Set();
    forEachToneCell(p, ref, { x: 0, y: 0, w: 200, h: 200 }, (x, y) => a.add(`${x.toFixed(4)},${y.toFixed(4)}`));
    const b = new Set();
    forEachToneCell(p, ref, { x: 100, y: 100, w: 200, h: 200 }, (x, y) => b.add(`${x.toFixed(4)},${y.toFixed(4)}`));
    let shared = 0;
    for (const key of a) {
        const [x, y] = key.split(',').map(Number);
        if (x >= 100 && x <= 200 && y >= 100 && y <= 200) { assert.ok(b.has(key), `lattice point ${key} must exist in both`); shared += 1; }
    }
    assert.ok(shared > 20, 'overlapping region shares lattice points');
}

// 濃度0は列挙しない。グラデで濃度0の側のセルは減る
{
    const g = { ...defaultToneParams(), pitch: 10, angle: 0, gradient: true, density: 1, density2: 0, gradAngle: 90 };
    let top = 0; let bottom = 0;
    forEachToneCell(g, ref, { x: 0, y: 0, w: 400, h: 400 }, (x, y, d) => { if (y < 100) top += d; if (y >= 300) bottom += d; });
    assert.ok(top > 0 && bottom < top * 0.2, `gradient density falls toward the 0 side (${top} vs ${bottom})`);
    const zero = { ...defaultToneParams(), density: 0 };
    assert.equal(forEachToneCell(zero, ref, { x: 0, y: 0, w: 100, h: 100 }, () => {}), 0);
}

// セル数の見積り(上限判定): 小さいpitchほど増える
{
    const fill = { x: 0, y: 0, w: 2500, h: 2500 };
    assert.ok(countToneCells({ pitch: 3 }, fill) > 600000);
    assert.ok(countToneCells({ pitch: 10 }, fill) < 200000);
}

// 保存境界
{
    const clean = sanitizeToneData({ v: 1, params: { ...defaultToneParams(), shape: 'line', pitch: 7, gradient: true, density2: 0.9 } });
    const again = sanitizeToneData(JSON.parse(JSON.stringify(clean)));
    assert.deepEqual(again, clean);
    assert.equal(sanitizeToneData(null), null);
    assert.equal(sanitizeToneData({ params: 3 }), null);
}

console.log('tone verifier: futaba defaults / normalize / density gradient / lattice (anchored, rotated) / cell budget / persistence ok');
