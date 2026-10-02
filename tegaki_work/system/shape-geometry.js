/**
 * ============================================================================
 * ファイル名: system/shape-geometry.js
 * 責務: 線の図形(四角/楕円)ツールの純粋な幾何計算（4頂点の編集、Shift制約、回転、楕円の透視サンプリング、画素への線描画の元になる点列）
 * 依存: なし（DOM / Pixi非依存）
 * 被依存: system/shape-tool.js, build/verify-shape-geometry.mjs
 * 公開API: createQuadFromDrag, moveVertex, moveEdge, translateQuad, rotateQuad, quadCenter,
 *          outlinePoints, snapDirection8, pointInQuad, distanceToSegment
 * 保存: なし(編集中の一時状態)
 *
 * 図形は常に4頂点 [TL,TR,BR,BL] の四角形で持つ。平行四辺形・台形（パース）もそのまま表せる。
 * 楕円は同じ4頂点が作る四角形に内接する楕円（単位正方形の内接円をホモグラフィで写したもの）。
 * ============================================================================
 */

const EPS = 1e-9;

const clone = quad => quad.map(p => ({ x: p.x, y: p.y }));

export function quadCenter(quad) {
    return {
        x: (quad[0].x + quad[1].x + quad[2].x + quad[3].x) / 4,
        y: (quad[0].y + quad[1].y + quad[2].y + quad[3].y) / 4
    };
}

/** ドラッグ(始点→現在点)から軸に沿った四角を作る。square=trueなら短い辺に合わせた正方形。 */
export function createQuadFromDrag(a, b, { square = false } = {}) {
    let dx = b.x - a.x;
    let dy = b.y - a.y;
    if (square) {
        const side = Math.max(Math.abs(dx), Math.abs(dy));
        dx = Math.sign(dx || 1) * side;
        dy = Math.sign(dy || 1) * side;
    }
    const x0 = a.x;
    const y0 = a.y;
    const x1 = a.x + dx;
    const y1 = a.y + dy;
    return [
        { x: Math.min(x0, x1), y: Math.min(y0, y1) },
        { x: Math.max(x0, x1), y: Math.min(y0, y1) },
        { x: Math.max(x0, x1), y: Math.max(y0, y1) },
        { x: Math.min(x0, x1), y: Math.max(y0, y1) }
    ];
}

/** 移動量を縦/横/斜め45°の8方向に丸める（Shift制約）。最も近い方向への射影。 */
export function snapDirection8(dx, dy) {
    const len = Math.hypot(dx, dy);
    if (len < EPS) return { dx: 0, dy: 0, kind: 'none' };
    const step = Math.PI / 4;
    const angle = Math.round(Math.atan2(dy, dx) / step) * step;
    const ux = Math.cos(angle);
    const uy = Math.sin(angle);
    const proj = dx * ux + dy * uy;
    const kind = Math.abs(ux) > 0.99 ? 'horizontal' : (Math.abs(uy) > 0.99 ? 'vertical' : 'diagonal');
    return { dx: ux * proj, dy: uy * proj, kind };
}

/**
 * 頂点iを start+delta へ動かす。
 *  - 通常: その頂点だけ（自由四角形）
 *  - shift: 移動を8方向に丸め、
 *      横: 横方向の辺で隣り合う頂点が反対向きに動く（辺の中心を保って開閉）
 *      縦: 縦方向の辺で隣り合う頂点が反対向きに動く
 *      斜め: 4点が図形の中心に対して相似に拡大縮小（頂点が丸めた方向に追従）
 * @param {{x,y}[]} base ドラッグ開始時の4頂点（毎回ここから計算し、誤差を積まない）
 */
export function moveVertex(base, index, delta, { shift = false } = {}) {
    const quad = clone(base);
    if (!shift) {
        quad[index].x += delta.x;
        quad[index].y += delta.y;
        return quad;
    }
    const snapped = snapDirection8(delta.x, delta.y);
    if (snapped.kind === 'none') return quad;
    if (snapped.kind === 'diagonal') {
        const c = quadCenter(base);
        const v = base[index];
        const rx = v.x - c.x;
        const ry = v.y - c.y;
        const r2 = rx * rx + ry * ry;
        if (r2 < EPS) return quad;
        // 頂点が丸めた方向に動いたあと、中心からの距離比で全体を拡大縮小する
        const nx = rx + snapped.dx;
        const ny = ry + snapped.dy;
        const scale = (nx * rx + ny * ry) / r2;
        return base.map(p => ({ x: c.x + (p.x - c.x) * scale, y: c.y + (p.y - c.y) * scale }));
    }
    // 隣り合う2頂点（辺 index→index+1 と index-1→index）のうち、動かす向きに平行に近い辺の相手を選ぶ
    const next = (index + 1) % 4;
    const prev = (index + 3) % 4;
    const alignment = other => {
        const ex = base[other].x - base[index].x;
        const ey = base[other].y - base[index].y;
        const len = Math.hypot(ex, ey) || 1;
        return Math.abs((ex * snapped.dx + ey * snapped.dy) / len / (Math.hypot(snapped.dx, snapped.dy) || 1));
    };
    const partner = alignment(next) >= alignment(prev) ? next : prev;
    quad[index].x += snapped.dx;
    quad[index].y += snapped.dy;
    quad[partner].x -= snapped.dx;
    quad[partner].y -= snapped.dy;
    return quad;
}

/**
 * 辺eの移動。通常は辺の法線方向だけ（きれいに広げ縮め）。shiftなら自由に動かし、反対の辺は逆向きに動く
 * （辺を横にずらせば平行四辺形、縦なら対称な拡大縮小になる）。
 */
export function moveEdge(base, edge, delta, { shift = false } = {}) {
    const quad = clone(base);
    const a = edge;
    const b = (edge + 1) % 4;
    let dx = delta.x;
    let dy = delta.y;
    if (!shift) {
        const ex = base[b].x - base[a].x;
        const ey = base[b].y - base[a].y;
        const len = Math.hypot(ex, ey);
        if (len < EPS) return quad;
        const nx = -ey / len;
        const ny = ex / len;
        const along = dx * nx + dy * ny;
        dx = nx * along;
        dy = ny * along;
    }
    quad[a].x += dx; quad[a].y += dy;
    quad[b].x += dx; quad[b].y += dy;
    if (shift) {
        const oa = (edge + 2) % 4;
        const ob = (edge + 3) % 4;
        quad[oa].x -= dx; quad[oa].y -= dy;
        quad[ob].x -= dx; quad[ob].y -= dy;
    }
    return quad;
}

export function translateQuad(base, delta) {
    return base.map(p => ({ x: p.x + delta.x, y: p.y + delta.y }));
}

export function rotateQuad(base, angle, center = quadCenter(base)) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return base.map(p => {
        const x = p.x - center.x;
        const y = p.y - center.y;
        return { x: center.x + x * cos - y * sin, y: center.y + x * sin + y * cos };
    });
}

/** 単位正方形(0,0)(1,0)(1,1)(0,1) → 4頂点 のホモグラフィ。戻り値は (u,v)→{x,y}。 */
function unitSquareToQuad(q) {
    const [p0, p1, p2, p3] = q;
    const dx3 = p0.x - p1.x + p2.x - p3.x;
    const dy3 = p0.y - p1.y + p2.y - p3.y;
    let g = 0;
    let h = 0;
    let a;
    let b;
    let c;
    let d;
    let e;
    let f;
    if (Math.abs(dx3) < EPS && Math.abs(dy3) < EPS) {
        a = p1.x - p0.x; b = p2.x - p1.x; c = p0.x;
        d = p1.y - p0.y; e = p2.y - p1.y; f = p0.y;
    } else {
        const dx1 = p1.x - p2.x;
        const dx2 = p3.x - p2.x;
        const dy1 = p1.y - p2.y;
        const dy2 = p3.y - p2.y;
        const det = dx1 * dy2 - dx2 * dy1;
        if (Math.abs(det) < EPS) {
            a = p1.x - p0.x; b = p3.x - p0.x; c = p0.x;
            d = p1.y - p0.y; e = p3.y - p0.y; f = p0.y;
        } else {
            g = (dx3 * dy2 - dx2 * dy3) / det;
            h = (dx1 * dy3 - dx3 * dy1) / det;
            a = p1.x - p0.x + g * p1.x;
            b = p3.x - p0.x + h * p3.x;
            c = p0.x;
            d = p1.y - p0.y + g * p1.y;
            e = p3.y - p0.y + h * p3.y;
            f = p0.y;
        }
    }
    return (u, v) => {
        const w = g * u + h * v + 1;
        return { x: (a * u + b * v + c) / w, y: (d * u + e * v + f) / w };
    };
}

/**
 * 図形の輪郭を閉じた折れ線にする。四角は4頂点そのまま、楕円は内接楕円を細かく刻む。
 * @param {'rect'|'ellipse'} kind
 */
export function outlinePoints(kind, quad, { segments = 0 } = {}) {
    if (kind !== 'ellipse') return clone(quad);
    const map = unitSquareToQuad(quad);
    let perimeter = 0;
    for (let i = 0; i < 4; i += 1) {
        const p = quad[i];
        const q = quad[(i + 1) % 4];
        perimeter += Math.hypot(q.x - p.x, q.y - p.y);
    }
    const count = segments > 0 ? segments : Math.max(48, Math.min(720, Math.ceil(perimeter / 3)));
    const points = [];
    for (let i = 0; i < count; i += 1) {
        const t = (i / count) * Math.PI * 2;
        points.push(map(0.5 + 0.5 * Math.cos(t), 0.5 + 0.5 * Math.sin(t)));
    }
    return points;
}

export function distanceToSegment(p, a, b) {
    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const len2 = abx * abx + aby * aby;
    const t = len2 < EPS ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * abx + (p.y - a.y) * aby) / len2));
    return Math.hypot(p.x - (a.x + abx * t), p.y - (a.y + aby * t));
}

export function pointInQuad(p, quad) {
    let inside = false;
    for (let i = 0, j = 3; i < 4; j = i, i += 1) {
        const a = quad[i];
        const b = quad[j];
        if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
    }
    return inside;
}

// ---------------------------------------------------------------- 線の形（太さ・角・遠近）

/** 4辺形を面積が同じ軸平行の正方形にする（中心は保つ）。「正方形/正円」ボタン用。 */
export function squareFromQuad(quad) {
    const c = quadCenter(quad);
    let area = 0;
    for (let i = 0; i < 4; i += 1) {
        const p = quad[i];
        const q = quad[(i + 1) % 4];
        area += p.x * q.y - q.x * p.y;
    }
    const side = Math.sqrt(Math.abs(area) / 2) || 1;
    return [
        { x: c.x - side / 2, y: c.y - side / 2 },
        { x: c.x + side / 2, y: c.y - side / 2 },
        { x: c.x + side / 2, y: c.y + side / 2 },
        { x: c.x - side / 2, y: c.y + side / 2 }
    ];
}

/** 遠近の向かう先。頂点i=その点へ向かう（基準は対角）、辺e=その辺へ向かう（基準は反対の辺）。 */
export function taperAnchors(quad, target) {
    const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
    if (target?.type === 'vertex') {
        return { far: quad[target.index], near: quad[(target.index + 2) % 4] };
    }
    const e = target?.type === 'edge' ? target.index : 0;
    return {
        far: mid(quad[e], quad[(e + 1) % 4]),
        near: mid(quad[(e + 2) % 4], quad[(e + 3) % 4])
    };
}

/** 点の太さ倍率。strength>0で向かう先へ細く、<0で太くなる（near→farを0→1に射影）。 */
export function taperFactor(point, anchors, strength) {
    if (!strength) return 1;
    const dx = anchors.far.x - anchors.near.x;
    const dy = anchors.far.y - anchors.near.y;
    const len2 = dx * dx + dy * dy;
    if (len2 < EPS) return 1;
    const t = Math.max(0, Math.min(1, ((point.x - anchors.near.x) * dx + (point.y - anchors.near.y) * dy) / len2));
    return Math.max(0.04, 1 - strength * t);
}

const signedArea = poly => {
    let a = 0;
    for (let i = 0; i < poly.length; i += 1) {
        const p = poly[i];
        const q = poly[(i + 1) % poly.length];
        a += p.x * q.y - q.x * p.y;
    }
    return a / 2;
};
const orient = poly => (signedArea(poly) < 0 ? poly.slice().reverse() : poly);

/**
 * 図形の線を「同じ向きの多角形の集まり」にする（nonzeroで塗れば継ぎ目なく1枚の線になる）。
 * 線幅が一定でないとき（遠近）にもそのまま使える。canvas塗りとSVGプレビューが同じ形を共有する。
 * @param {{width:number, join:'miter'|'round', strength:number, target:{type,index}|null}} opts
 */
export function strokePolygons(kind, quad, opts) {
    const points = outlinePoints(kind, quad);
    const n = points.length;
    const width = Math.max(0.5, opts.width);
    const anchors = taperAnchors(quad, opts.target);
    const strength = Math.max(-0.95, Math.min(0.95, opts.strength || 0));
    const half = points.map(p => (width * taperFactor(p, anchors, strength)) / 2);
    const polys = [];
    const normals = [];
    for (let i = 0; i < n; i += 1) {
        const a = points[i];
        const b = points[(i + 1) % n];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len;
        const ny = dx / len;
        normals.push({ x: nx, y: ny });
        const ha = half[i];
        const hb = half[(i + 1) % n];
        polys.push(orient([
            { x: a.x + nx * ha, y: a.y + ny * ha },
            { x: b.x + nx * hb, y: b.y + ny * hb },
            { x: b.x - nx * hb, y: b.y - ny * hb },
            { x: a.x - nx * ha, y: a.y - ny * ha }
        ]));
    }
    // 角の処理（頂点ごと、辺i-1と辺iの間）
    const round = opts.join === 'round' && kind !== 'ellipse';
    for (let i = 0; i < n; i += 1) {
        const v = points[i];
        const h = half[i];
        if (round) {
            const circle = [];
            for (let k = 0; k < 20; k += 1) {
                const t = (k / 20) * Math.PI * 2;
                circle.push({ x: v.x + Math.cos(t) * h, y: v.y + Math.sin(t) * h });
            }
            polys.push(orient(circle));
            continue;
        }
        const n1 = normals[(i + n - 1) % n];
        const n2 = normals[i];
        for (const sign of [1, -1]) {
            const p1 = { x: v.x + n1.x * h * sign, y: v.y + n1.y * h * sign };
            const p2 = { x: v.x + n2.x * h * sign, y: v.y + n2.y * h * sign };
            const dot = n1.x * n2.x + n1.y * n2.y;
            const k = 1 / (1 + dot);
            const tipLen = Math.hypot((n1.x + n2.x) * k, (n1.y + n2.y) * k);
            if (1 + dot > 1e-6 && tipLen <= 10) {
                const tip = { x: v.x + (n1.x + n2.x) * k * h * sign, y: v.y + (n1.y + n2.y) * k * h * sign };
                polys.push(orient([v, p1, tip, p2]));
            } else {
                polys.push(orient([v, p1, p2])); // 尖りすぎる角は面取り
            }
        }
    }
    return polys;
}

/** 多角形群の外接矩形 */
export function polygonsBounds(polys) {
    let x0 = Infinity; let y0 = Infinity; let x1 = -Infinity; let y1 = -Infinity;
    for (const poly of polys) {
        for (const p of poly) {
            if (p.x < x0) x0 = p.x;
            if (p.y < y0) y0 = p.y;
            if (p.x > x1) x1 = p.x;
            if (p.y > y1) y1 = p.y;
        }
    }
    return { x0, y0, x1, y1 };
}
