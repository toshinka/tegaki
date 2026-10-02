import assert from 'node:assert/strict';
import {
    createQuadFromDrag, moveVertex, moveEdge, translateQuad, rotateQuad, quadCenter,
    outlinePoints, snapDirection8, pointInQuad, distanceToSegment
} from '../system/shape-geometry.js';

const near = (a, b, msg, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${msg}: ${a} vs ${b}`);
const rect = createQuadFromDrag({ x: 10, y: 20 }, { x: 110, y: 70 });

// 作成: 左上始点・右下ドラッグでも、逆向きでも [TL,TR,BR,BL]
assert.deepEqual(rect, [{ x: 10, y: 20 }, { x: 110, y: 20 }, { x: 110, y: 70 }, { x: 10, y: 70 }]);
assert.deepEqual(createQuadFromDrag({ x: 110, y: 70 }, { x: 10, y: 20 }), rect);
const sq = createQuadFromDrag({ x: 0, y: 0 }, { x: 80, y: 30 }, { square: true });
near(sq[2].x - sq[0].x, 80, 'square side'); near(sq[2].y - sq[0].y, 80, 'square side y');

// 8方向丸め
assert.equal(snapDirection8(10, 2).kind, 'horizontal');
assert.equal(snapDirection8(1, 9).kind, 'vertical');
assert.equal(snapDirection8(7, 8).kind, 'diagonal');
near(snapDirection8(10, 2).dy, 0, 'horizontal has no dy');
near(snapDirection8(7, 8).dx, snapDirection8(7, 8).dy, 'diagonal dx==dy');

// 頂点: 通常はその頂点だけ
const free = moveVertex(rect, 0, { x: 5, y: 7 });
assert.deepEqual(free[0], { x: 15, y: 27 });
assert.deepEqual(free.slice(1), rect.slice(1));

// Shift横: TLが右へ→TRが左へ（上辺の中心を保って狭まる）。下の2点は動かない
const h = moveVertex(rect, 0, { x: 20, y: 3 }, { shift: true });
near(h[0].x, 30, 'TL moves right'); near(h[0].y, 20, 'y constrained');
near(h[1].x, 90, 'TR moves left'); near(h[1].y, 20, 'TR keeps y');
assert.deepEqual(h.slice(2), rect.slice(2));

// Shift縦: TLが下へ→BLが上へ（左辺の中心を保って狭まる）
const v = moveVertex(rect, 0, { x: 2, y: 10 }, { shift: true });
near(v[0].y, 30, 'TL moves down'); near(v[0].x, 10, 'x constrained');
near(v[3].y, 60, 'BL moves up'); near(v[3].x, 10, 'BL keeps x');
assert.deepEqual([v[1], v[2]], [rect[1], rect[2]]);

// Shift斜め: 4点が中心に対して相似に拡大。中心は不変・形は相似
const d = moveVertex(rect, 2, { x: 10, y: 11 }, { shift: true });
const c0 = quadCenter(rect); const c1 = quadCenter(d);
near(c1.x, c0.x, 'center x kept'); near(c1.y, c0.y, 'center y kept');
const w0 = rect[1].x - rect[0].x; const w1 = d[1].x - d[0].x;
const hh0 = rect[3].y - rect[0].y; const hh1 = d[3].y - d[0].y;
near(w1 / w0, hh1 / hh0, 'uniform scale');
assert.ok(w1 > w0, 'expanded');

// 辺: 通常は法線方向のみ（上辺を斜めにドラッグしても縦成分だけ効く）
const e = moveEdge(rect, 0, { x: 30, y: -10 });
near(e[0].x, 10, 'edge keeps x'); near(e[0].y, 10, 'edge moves by normal');
near(e[1].y, 10, 'edge both endpoints');
assert.deepEqual(e.slice(2), rect.slice(2));
// 辺 + Shift: 上辺を右へ→下辺は左へ（平行四辺形）
const p = moveEdge(rect, 0, { x: 15, y: 0 }, { shift: true });
near(p[0].x, 25, 'top shifts right'); near(p[2].x, 95, 'bottom shifts left');
near(p[1].x - p[0].x, rect[1].x - rect[0].x, 'top width kept');
near(p[1].y - p[0].y, 0, 'top stays horizontal');

// 移動・回転
assert.deepEqual(translateQuad(rect, { x: 1, y: 2 })[0], { x: 11, y: 22 });
const r = rotateQuad(rect, Math.PI / 2);
near(quadCenter(r).x, c0.x, 'rotation keeps center');
near(Math.hypot(r[1].x - r[0].x, r[1].y - r[0].y), 100, 'rotation keeps edge length');

// 輪郭: 四角は4点、楕円は内接楕円（軸に沿った四角ならほぼ真の楕円）
assert.equal(outlinePoints('rect', rect).length, 4);
const el = outlinePoints('ellipse', rect);
assert.ok(el.length >= 48);
for (const pt of el) {
    const nx = (pt.x - 60) / 50; const ny = (pt.y - 45) / 25;
    near(nx * nx + ny * ny, 1, 'point on ellipse', 1e-6);
}
// 台形(パース)でも楕円は四角形の各辺に接する（辺の中点に最も近い輪郭点が辺上にある）
const trap = [{ x: 30, y: 0 }, { x: 70, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }];
const te = outlinePoints('ellipse', trap, { segments: 720 });
for (let i = 0; i < 4; i += 1) {
    const a = trap[i]; const b = trap[(i + 1) % 4];
    const minDist = Math.min(...te.map(q => distanceToSegment(q, a, b)));
    assert.ok(minDist < 0.3, `ellipse touches trapezoid edge ${i}: ${minDist}`);
}
assert.ok(te.every(q => pointInQuad(q, trap) || trap.some((a, i) => distanceToSegment(q, a, trap[(i + 1) % 4]) < 0.5)), 'ellipse stays inside trapezoid');

assert.ok(pointInQuad({ x: 50, y: 40 }, rect));
assert.ok(!pointInQuad({ x: 5, y: 40 }, rect));
console.log('verify-shape-geometry: ok');

// ---- 線の形（太さ・角・遠近）
import { squareFromQuad, taperAnchors, taperFactor, strokePolygons, polygonsBounds } from '../system/shape-geometry.js';
{
    const sq2 = squareFromQuad(trap);
    near(sq2[1].x - sq2[0].x, sq2[2].y - sq2[1].y, 'squareFromQuad is a square');
    near(quadCenter(sq2).x, quadCenter(trap).x, 'square keeps center');

    const anchors = taperAnchors(rect, { type: 'edge', index: 0 });
    near(anchors.far.y, 20, 'edge target far = top edge'); near(anchors.near.y, 70, 'edge target near = bottom edge');
    assert.equal(taperFactor({ x: 50, y: 70 }, anchors, 0.5), 1, 'near side keeps full width');
    near(taperFactor({ x: 50, y: 20 }, anchors, 0.5), 0.5, 'far side is thinner by strength');
    near(taperFactor({ x: 50, y: 20 }, anchors, -0.5), 1.5, 'negative strength thickens far side');
    const va = taperAnchors(rect, { type: 'vertex', index: 2 });
    assert.deepEqual(va.far, rect[2]); assert.deepEqual(va.near, rect[0]);

    const o = { width: 10, join: 'miter', strength: 0, target: null };
    const polys = strokePolygons('rect', rect, o);
    assert.ok(polys.every(p => p.length >= 3));
    // 同じ向き（nonzeroで穴が空かない）
    const sign = p => { let a = 0; for (let i = 0; i < p.length; i += 1) { const q = p[(i + 1) % p.length]; a += p[i].x * q.y - q.x * p[i].y; } return Math.sign(a); };
    assert.ok(polys.every(p => sign(p) === sign(polys[0])), 'all polygons share one orientation');
    // miterの外接矩形は角が尖る: 太さの半分だけ外に出る
    const b = polygonsBounds(polys);
    near(b.x0, 10 - 5, 'miter extends half width', 1e-6); near(b.y1, 70 + 5, 'miter extends half width y', 1e-6);
    // 丸い角は円形の角になり、外接矩形は同じ
    const br = polygonsBounds(strokePolygons('rect', rect, { ...o, join: 'round' }));
    near(br.x0, 5, 'round join bounds', 0.2);
    // 遠近: 向かう先の辺が細くなる
    const tp = strokePolygons('rect', rect, { width: 10, join: 'miter', strength: 0.6, target: { type: 'edge', index: 0 } });
    const tb = polygonsBounds(tp);
    near(tb.y1, 70 + 5, 'near edge keeps full width', 1e-6);
    assert.ok(tb.y0 > 20 - 5 + 1, 'far edge is thinner');
    // 楕円も多角形群で作れる
    assert.ok(strokePolygons('ellipse', rect, o).length >= 48);
}
console.log('verify-shape-geometry (stroke): ok');
