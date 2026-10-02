import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
    RULER_TYPES,
    applyRulerDrag,
    buildRulerGuideSegments,
    RULER_OPTION_DEFAULTS,
    resolveRulerGrab,
    sanitizeRulerOptions,
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

// ミニパネルのオプション: 既定は従来値、範囲外はclamp、間隔/本数/角度刻みが幾何へ反映される
{
    assert.deepEqual(sanitizeRulerOptions(null), { spacing: 48, spokes: 48, angleSnap: 15, perspective: 0, showGuides: true });
    assert.deepEqual(RULER_OPTION_DEFAULTS, { spacing: 48, spokes: 48, angleSnap: 15, perspective: 0, showGuides: true });
    const o = sanitizeRulerOptions({ spacing: 1, spokes: 9999.6, angleSnap: 'x', showGuides: false });
    assert.deepEqual(o, { spacing: 12, spokes: 180, angleSnap: 15, perspective: 0, showGuides: false });
    const base = { type: 'parallel', center: { x: 500, y: 400 }, angle: 0 };
    const wide = buildRulerGuideSegments({ ...base, spacing: 96 }, canvas, 1);
    const normal = buildRulerGuideSegments(base, canvas, 1);
    assert.ok(normal.lines.length > wide.lines.length * 1.8, 'wider spacing -> fewer guide lines');
    assert.equal(buildRulerGuideSegments({ type: 'radial', center: { x: 0, y: 0 }, angle: 0, spokes: 12 }, canvas, 1).lines.length, 12);
    const rot = resolveRulerGrab({ ...base }, { x: 600, y: 400 }, 1);
    near(applyRulerDrag({ ...base, angleSnap: 45 }, rot, { x: 600, y: 470 }, { snapAngle: true }).angle, Math.PI / 4, 1e-9, '45deg step');
    near(applyRulerDrag({ ...base }, rot, { x: 600, y: 470 }, { snapAngle: true }).angle, (30 * Math.PI) / 180, 1e-9, 'default 15deg step');
}


// ---- 遠近（軽いパース）: 平行線ガイドが消失点へ絞られ、吸着もそのガイドに沿う
{
    const { rulerVanishingPoint } = await import('../system/ruler-geometry.js');
    const canvas = { width: 800, height: 600 };
    const flat = { enabled: true, type: 'parallel', center: { x: 400, y: 300 }, angle: 0, spacing: 48, perspective: 0 };
    assert.equal(rulerVanishingPoint(flat, canvas), null, 'perspective 0 = parallel');
    const persp = { ...flat, perspective: 50 };
    const vp = rulerVanishingPoint(persp, canvas);
    near(vp.y, 300, 1e-9, 'vanishing point lies on the ruler axis'); assert.ok(vp.x > 400, 'positive perspective vanishes ahead');
    near(rulerVanishingPoint({ ...flat, perspective: -50 }, canvas).x, 400 - (Math.hypot(800, 600) * 100) / 50, 1e-6, 'negative perspective vanishes behind');
    // 全ガイドが消失点を通る
    const { lines } = buildRulerGuideSegments(persp, canvas, 1);
    for (const [x1, y1, x2, y2] of lines) {
        const cross = (x2 - x1) * (vp.y - y1) - (y2 - y1) * (vp.x - x1);
        near(cross / Math.hypot(x2 - x1, y2 - y1), 0, 1e-6, 'guide passes through the vanishing point');
    }
    // 吸着: 描き始めの点から消失点へ向かう直線に乗る
    const anchor = { x: 300, y: 380 };
    const snapped = snapPointToRuler(persp, anchor, { x: 360, y: 500 }, canvas);
    const cross = (vp.x - anchor.x) * (snapped.y - anchor.y) - (vp.y - anchor.y) * (snapped.x - anchor.x);
    near(cross, 0, 1e-6, 'snapped point is on the line toward the vanishing point');
    // 0なら従来どおり向きに平行
    const plain = snapPointToRuler(flat, anchor, { x: 360, y: 500 }, canvas);
    near(plain.y, 380, 1e-9, 'plain parallel snap unchanged');
    assert.equal(sanitizeRulerOptions({ perspective: 500 }).perspective, 95);
}

console.log('ruler verifier: snap / grab / drag / angle snap / sanitize / guide segments / futaba colors ok');
