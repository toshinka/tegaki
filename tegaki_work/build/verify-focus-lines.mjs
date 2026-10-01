import assert from 'node:assert/strict';
import {
    FOCUS_LINES_DEFAULT_COLOR,
    FOCUS_LINES_STYLES,
    buildFocusLines,
    defaultFocusLinesParams,
    focusLinesHandles,
    innerRadiusAt,
    normalizeFocusLinesParams,
    sanitizeFocusLinesData
} from '../system/focus-lines.js';

const canvas = { width: 800, height: 600 };
const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} !~ ${b}`);

// 既定はふたば配色(futaba-maroon)で、白・灰・黒ではない
{
    const d = defaultFocusLinesParams(canvas);
    assert.equal(d.color, '#800000');
    assert.equal(FOCUS_LINES_DEFAULT_COLOR, '#800000');
    assert.deepEqual(d.center, { x: 400, y: 300 });
    assert.equal(normalizeFocusLinesParams({ color: 'red' }, canvas).color, '#800000');
    assert.equal(normalizeFocusLinesParams({ color: '#112233' }, canvas).color, '#112233');
}

// 決定性: 同じseedなら同じ、違うseedなら違う
{
    const p = { ...defaultFocusLinesParams(canvas), seed: 42 };
    const a = buildFocusLines(p, canvas);
    const b = buildFocusLines(p, canvas);
    assert.deepEqual(a, b);
    assert.notDeepEqual(a, buildFocusLines({ ...p, seed: 43 }, canvas));
    assert.equal(a.length, p.count);
    assert.ok(a.every(poly => poly.length === 4));
}

// 集中線('in'): 内側は尖り(taper=1)、外側は太く、キャンバスの最遠隅を越える。内側は抜けの楕円の外
{
    const p = { ...defaultFocusLinesParams(canvas), count: 90, taper: 1, direction: 'in', innerRx: 80, innerRy: 50, lengthJitter: 0, widthMin: 4, widthMax: 4, seed: 7 };
    const polys = buildFocusLines(p, canvas);
    const far = Math.hypot(400, 300);
    for (const poly of polys) {
        const [inL, outL, outR, inR] = poly;
        near(Math.hypot(inL.x - inR.x, inL.y - inR.y), 0, 1e-6); // 内側は点
        near(Math.hypot(outL.x - outR.x, outL.y - outR.y), 4, 1e-6);
        const r = Math.hypot(inL.x - 400, inL.y - 300);
        const theta = Math.atan2(inL.y - 300, inL.x - 400);
        near(r, innerRadiusAt(80, 50, theta), 1e-6);
        assert.ok(Math.hypot(outL.x - 400, outL.y - 300) >= far, 'reaches beyond farthest corner');
    }
}

// ウニフラ('out'): 内側が太く外へ尖り、長さは有限(outer)
{
    const p = { ...defaultFocusLinesParams(canvas), ...FOCUS_LINES_STYLES.find(s => s.id === 'flash').patch, lengthJitter: 0, widthMin: 20, widthMax: 20, seed: 3 };
    const polys = buildFocusLines(p, canvas);
    for (const [inL, outL, outR, inR] of polys) {
        near(Math.hypot(inL.x - inR.x, inL.y - inR.y), 20, 1e-6);
        near(Math.hypot(outL.x - outR.x, outL.y - outR.y), 0, 1e-6);
        near(Math.hypot(outL.x - 400, outL.y - 300), p.outer, 1e-6);
    }
}

// 角度は全周へ配られる(各象限に線がある)。ばらつき0なら等間隔
{
    const p = { ...defaultFocusLinesParams(canvas), count: 8, angleJitter: 0, lengthJitter: 0, seed: 5 };
    const polys = buildFocusLines(p, canvas);
    const angles = polys.map(poly => Math.atan2((poly[1].y + poly[2].y) / 2 - 300, (poly[1].x + poly[2].x) / 2 - 400));
    for (let i = 1; i < angles.length; i += 1) {
        const diff = ((angles[i] - angles[i - 1]) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
        near(diff, Math.PI / 4, 1e-6);
    }
}

// 正規化: 範囲外のclamp・widthMin>widthMaxの入替・中心の暴走を捨てる・countは整数
{
    const n = normalizeFocusLinesParams({ count: 99999, widthMin: 50, widthMax: 2, taper: 5, outer: -3, center: { x: 1e9, y: 0 }, seed: -1.9, direction: 'x' }, canvas);
    assert.equal(n.count, 600);
    assert.deepEqual([n.widthMin, n.widthMax], [2, 50]);
    assert.equal(n.taper, 1);
    assert.equal(n.outer, 0);
    assert.deepEqual(n.center, { x: 400, y: 300 });
    assert.equal(n.direction, 'in');
    assert.ok(Number.isInteger(n.seed) && n.seed >= 0);
}

// 保存境界: JSON往復で同じ線。壊れたdataはnull
{
    const raw = { v: 1, params: { ...defaultFocusLinesParams(canvas), seed: 99, count: 33 } };
    const clean = sanitizeFocusLinesData(raw, canvas);
    const again = sanitizeFocusLinesData(JSON.parse(JSON.stringify(clean)), canvas);
    assert.deepEqual(buildFocusLines(again.params, canvas), buildFocusLines(clean.params, canvas));
    assert.equal(sanitizeFocusLinesData(null, canvas), null);
    assert.equal(sanitizeFocusLinesData({ params: 3 }, canvas), null);
}

// 編集ハンドル
{
    const p = { ...defaultFocusLinesParams(canvas), innerRx: 70, innerRy: 40 };
    const h = focusLinesHandles(p);
    assert.deepEqual(h.rx, { x: 470, y: 300 });
    assert.deepEqual(h.ry, { x: 400, y: 340 });
}

// プリセットは全て有効な値(clampで変化しない)
for (const style of FOCUS_LINES_STYLES) {
    const n = normalizeFocusLinesParams({ ...defaultFocusLinesParams(canvas), ...style.patch }, canvas);
    for (const [k, v] of Object.entries(style.patch)) assert.equal(n[k], v, `${style.id}.${k}`);
}

console.log('focus-lines verifier: deterministic / in-out shapes / ellipse hole / normalize / persistence / presets ok');
