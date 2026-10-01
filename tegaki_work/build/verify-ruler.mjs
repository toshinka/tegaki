import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
    RULER_TYPES,
    applyRulerDrag,
    buildRulerGuideSegments,
    resolveRulerGrab,
    sanitizeRulerState,
    snapPointToRuler,
    snapRulerAngle
} from '../system/ruler-geometry.js';

const near = (a, b, eps = 1e-9, msg = '') => assert.ok(Math.abs(a - b) <= eps, `${msg} ${a} !~ ${b}`);
const canvas = { width: 1000, height: 800 };

// 吸着: 平行線は始点を通る定規方向の直線へ直交射影
{
    const parallel = { enabled: true, type: 'parallel', center: { x: 0, y: 0 }, angle: Math.PI / 4 };
    const snapped = snapPointToRuler(parallel, { x: 10, y: 10 }, { x: 30, y: 14 });
    near(snapped.x - 10, snapped.y - 10, 1e-9, 'parallel keeps the ruler direction');
    near(Math.hypot(snapped.x - 10, snapped.y - 10), 24 / Math.SQRT2, 1e-9, 'orthogonal projection');
    const off = snapPointToRuler({ ...parallel, enabled: false }, { x: 0, y: 0 }, { x: 5, y: 9 });
    assert.deepEqual(off, { x: 5, y: 9 }, 'disabled ruler does not snap');
}

// 吸着: 放射線は中心→始点の直線、中心から描き始めた場合は自由
{
    const radial = { enabled: true, type: 'radial', center: { x: 100, y: 100 }, angle: 0 };
    const rad = snapPointToRuler(radial, { x: 160, y: 100 }, { x: 200, y: 130 });
    near(rad.y, 100, 1e-9, 'radial spoke');
    near(rad.x, 200, 1e-9, 'radial keeps distance along spoke');
    assert.deepEqual(snapPointToRuler(radial, { x: 100, y: 100 }, { x: 140, y: 130 }), { x: 140, y: 130 });
}

// つかみ判定: 中心付近(画面px)は移動、離れると回転、放射線は常に移動。表示倍率で判定距離が変わる
{
    const state = { type: 'parallel', center: { x: 500, y: 400 }, angle: 0 };
    assert.equal(resolveRulerGrab(state, { x: 510, y: 400 }, 1).kind, 'move');
    assert.equal(resolveRulerGrab(state, { x: 520, y: 400 }, 1).kind, 'rotate');
    assert.equal(resolveRulerGrab(state, { x: 510, y: 400 }, 2).kind, 'rotate', '2x zoom: 10 doc px = 20 screen px');
    assert.equal(resolveRulerGrab({ ...state, type: 'radial' }, { x: 900, y: 100 }, 1).kind, 'move');
}

// ドラッグ: 移動はつかんだ位置の差を保つ、回転はつかんだ角度の差を保つ、Ctrlで15°刻み
{
    const state = { type: 'parallel', center: { x: 500, y: 400 }, angle: 0 };
    const move = resolveRulerGrab(state, { x: 505, y: 403 }, 1);
    const moved = applyRulerDrag(state, move, { x: 605, y: 503 });
    assert.deepEqual(moved.center, { x: 600, y: 500 });
    const rot = resolveRulerGrab(state, { x: 600, y: 400 }, 1);
    near(applyRulerDrag(state, rot, { x: 500, y: 500 }).angle, Math.PI / 2, 1e-9, 'rotate 90');
    const snapped = applyRulerDrag(state, rot, { x: 600, y: 410 }, { snapAngle: true });
    near(snapped.angle, 0, 1e-9, 'ctrl snaps ~5.7deg to 0');
    near(snapRulerAngle((44 * Math.PI) / 180), Math.PI / 4, 1e-9, '44deg -> 45deg');
    near(snapRulerAngle(-0.01), 0, 1e-9, 'negative near-zero -> 0');
}

// 保存値のsanitize: 壊れた値は既定へ、enabledは読まない、極端な中心は捨てる
{
    assert.deepEqual(sanitizeRulerState(null, canvas), { type: 'parallel', angle: 0, center: null });
    const bad = sanitizeRulerState({ type: 'spiral', angle: 'x', center: { x: NaN, y: 1 }, enabled: true }, canvas);
    assert.deepEqual(bad, { type: 'parallel', angle: 0, center: null });
    assert.equal('enabled' in bad, false);
    const ok = sanitizeRulerState({ type: 'radial', angle: -Math.PI / 2, center: { x: 10, y: 20 } }, canvas);
    assert.equal(ok.type, 'radial');
    near(ok.angle, 1.5 * Math.PI, 1e-9, 'angle normalized to [0, 2pi)');
    assert.deepEqual(ok.center, { x: 10, y: 20 });
    assert.equal(sanitizeRulerState({ center: { x: 1e7, y: 0 } }, canvas).center, null);
    assert.deepEqual(RULER_TYPES, ['parallel', 'radial']);
}

// ガイド線分: 平行線は中心線+等間隔(画面px一定)、放射線は48本
{
    const p = buildRulerGuideSegments({ type: 'parallel', center: { x: 500, y: 400 }, angle: 0 }, canvas, 1);
    assert.ok(p.main && p.main[1] === 400 && p.main[3] === 400, 'main line through center');
    const p2 = buildRulerGuideSegments({ type: 'parallel', center: { x: 500, y: 400 }, angle: 0 }, canvas, 2);
    assert.ok(p2.lines.length > p.lines.length * 1.8, 'spacing stays constant in screen px');
    const r = buildRulerGuideSegments({ type: 'radial', center: { x: 500, y: 400 }, angle: 0 }, canvas, 1);
    assert.equal(r.lines.length, 48);
    assert.equal(r.main, null);
}

// 規約: ガイドはふたば配色のみ(白・灰・黒・青を使わない)、Canvas2Dを使わない
{
    const src = readFileSync(new URL('../system/drawing/ruler-system.js', import.meta.url), 'utf8');
    const colors = [...src.matchAll(/0x([0-9a-fA-F]{6})\b/g)].map((m) => m[1].toLowerCase());
    const allowed = new Set(['800000', '9c3835', 'b8706b', 'd4a8a0', 'f0e0d6', 'ffffee', 'ff8c42']);
    for (const c of colors) assert.ok(allowed.has(c), `ruler guide color #${c} is not a futaba token`);
    assert.ok(colors.length > 0);
    assert.ok(!/getContext\(\s*['"]2d/.test(src), 'no Canvas2D in ruler system');
}

console.log('ruler verifier: snap / grab / drag / angle snap / sanitize / guide segments / futaba colors ok');
