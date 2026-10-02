/**
 * ============================================================================
 * ファイル名: system/auto-select.js
 * 責務: 自動選択(魔法の杖)の純粋な領域抽出。種の画素から、色/不透明度が許容値内の連続(または全体)領域を求める
 * 依存: なし（DOM / Pixi非依存）
 * 被依存: system/pixel-selection-system.js, build/verify-auto-select.mjs
 * 公開API: floodSelectRegion, AUTO_SELECT_LIMITS, maskContains
 * 保存: なし(選択は一時状態。Project・Historyには入らない)
 * 実装状態: ✅実装
 *
 * 色の近さ: RGBA各成分の差の最大値(0-255)。両方がほぼ透明(alpha<=許容値)なら色は無視して同一視する。
 * ============================================================================
 */

export const AUTO_SELECT_LIMITS = Object.freeze({
    tolerance: { min: 0, max: 128, default: 24 },
    maxPixels: 64 * 1024 * 1024
});

function colorDistance(p, i, sr, sg, sb, sa) {
    const a = p[i + 3];
    const da = Math.abs(a - sa);
    // 両方ほぼ透明なら色は意味を持たない
    if (a < 8 && sa < 8) return 0;
    const dr = Math.abs(p[i] - sr);
    const dg = Math.abs(p[i + 1] - sg);
    const db = Math.abs(p[i + 2] - sb);
    return Math.max(dr, dg, db, da);
}

/**
 * @param {{pixels:Uint8ClampedArray|Uint8Array, width:number, height:number, seedX:number, seedY:number,
 *   tolerance?:number, contiguous?:boolean, originX?:number, originY?:number}} options
 *   originX/Y: pixels左上がProject座標でどこか(結果のboundsをその座標で返す)
 * @returns {{ok:true, bounds:{x:number,y:number,width:number,height:number}, mask:Uint8Array, count:number}|{ok:false, reason:string}}
 */
export function floodSelectRegion(options = {}) {
    const { pixels, width, height } = options;
    const seedX = Math.floor(options.seedX);
    const seedY = Math.floor(options.seedY);
    const originX = Number(options.originX) || 0;
    const originY = Number(options.originY) || 0;
    const contiguous = options.contiguous !== false;
    const tolerance = Math.max(AUTO_SELECT_LIMITS.tolerance.min,
        Math.min(AUTO_SELECT_LIMITS.tolerance.max, Number(options.tolerance ?? AUTO_SELECT_LIMITS.tolerance.default)));
    if (!pixels || !(width > 0) || !(height > 0) || pixels.length < width * height * 4) {
        return { ok: false, reason: 'no-pixels' };
    }
    if (width * height > AUTO_SELECT_LIMITS.maxPixels) return { ok: false, reason: 'too-large' };
    const sx = seedX - originX;
    const sy = seedY - originY;
    if (sx < 0 || sy < 0 || sx >= width || sy >= height) return { ok: false, reason: 'seed-outside' };

    const si = (sy * width + sx) * 4;
    const sr = pixels[si]; const sg = pixels[si + 1]; const sb = pixels[si + 2]; const sa = pixels[si + 3];
    const inside = new Uint8Array(width * height);
    let minX = width; let minY = height; let maxX = -1; let maxY = -1; let count = 0;
    const mark = (x, y) => {
        inside[y * width + x] = 1;
        count += 1;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
    };
    const matches = (x, y) => colorDistance(pixels, (y * width + x) * 4, sr, sg, sb, sa) <= tolerance;

    if (!contiguous) {
        for (let y = 0; y < height; y += 1) {
            for (let x = 0; x < width; x += 1) if (matches(x, y)) mark(x, y);
        }
    } else {
        // スキャンライン塗りつぶし(4近傍)
        const stack = [sx, sy];
        while (stack.length) {
            const y = stack.pop();
            let x = stack.pop();
            if (inside[y * width + x] || !matches(x, y)) continue;
            let left = x;
            while (left > 0 && !inside[y * width + left - 1] && matches(left - 1, y)) left -= 1;
            let right = x;
            while (right < width - 1 && !inside[y * width + right + 1] && matches(right + 1, y)) right += 1;
            for (let i = left; i <= right; i += 1) mark(i, y);
            for (const ny of [y - 1, y + 1]) {
                if (ny < 0 || ny >= height) continue;
                let spanOpen = false;
                for (let i = left; i <= right; i += 1) {
                    const ok = !inside[ny * width + i] && matches(i, ny);
                    if (ok && !spanOpen) { stack.push(i, ny); spanOpen = true; }
                    else if (!ok) spanOpen = false;
                }
            }
        }
    }
    if (count === 0) return { ok: false, reason: 'empty' };

    const bw = maxX - minX + 1;
    const bh = maxY - minY + 1;
    const mask = new Uint8Array(bw * bh);
    for (let y = 0; y < bh; y += 1) {
        const srcRow = (minY + y) * width + minX;
        mask.set(inside.subarray(srcRow, srcRow + bw), y * bw);
    }
    return { ok: true, bounds: { x: originX + minX, y: originY + minY, width: bw, height: bh }, mask, count };
}

/** mask({bounds, mask})がProject座標(x,y)を含むか。 */
export function maskContains(selection, x, y) {
    const b = selection?.bounds;
    if (!b || !selection.mask) return true; // マスク無し=矩形全体
    const ix = Math.floor(x) - b.x;
    const iy = Math.floor(y) - b.y;
    if (ix < 0 || iy < 0 || ix >= b.width || iy >= b.height) return false;
    return selection.mask[iy * b.width + ix] === 1;
}

/**
 * マスクの境界を、画素の辺をたどった閉じた輪郭(複数)にする。形に沿った選択線(蟻の行列)の表示用。
 * 座標はマスク左上を原点とした画素の辺の座標(整数)。同一直線上の頂点は省く。
 * @returns {{ok:true, loops:number[][][], vertexCount:number}|{ok:false, reason:string}}
 */
export function traceMaskOutline(mask, width, height, options = {}) {
    const maxVertices = options.maxVertices ?? 200000;
    const inside = (x, y) => x >= 0 && y >= 0 && x < width && y < height && mask[y * width + x] === 1;
    const key = (x, y) => y * (width + 1) + x;
    // 画素の外周を時計回りの有向辺にする(内側が右手側)。
    const next = new Map(); // start vertex key -> [{x,y,ex,ey}]
    let edgeCount = 0;
    const add = (sx, sy, ex, ey) => {
        const k = key(sx, sy);
        const list = next.get(k);
        const edge = { ex, ey, used: false };
        if (list) list.push(edge); else next.set(k, [edge]);
        edgeCount += 1;
    };
    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
            if (mask[y * width + x] !== 1) continue;
            if (!inside(x, y - 1)) add(x, y, x + 1, y);
            if (!inside(x + 1, y)) add(x + 1, y, x + 1, y + 1);
            if (!inside(x, y + 1)) add(x + 1, y + 1, x, y + 1);
            if (!inside(x - 1, y)) add(x, y + 1, x, y);
            if (edgeCount > maxVertices * 4) return { ok: false, reason: 'too-complex' };
        }
    }
    const loops = [];
    let vertexCount = 0;
    for (const [startKey, list] of next) {
        for (const first of list) {
            if (first.used) continue;
            const sx = startKey % (width + 1);
            const sy = Math.floor(startKey / (width + 1));
            const pts = [[sx, sy]];
            let edge = first;
            let cx = sx; let cy = sy;
            // eslint-disable-next-line no-constant-condition
            while (true) {
                edge.used = true;
                cx = edge.ex; cy = edge.ey;
                if (cx === sx && cy === sy) break;
                pts.push([cx, cy]);
                const candidates = next.get(key(cx, cy)) || [];
                edge = candidates.find(e => !e.used);
                if (!edge) break;
            }
            // 同一直線上の頂点を省く
            const out = [];
            for (let i = 0; i < pts.length; i += 1) {
                const a = pts[(i + pts.length - 1) % pts.length];
                const b = pts[i];
                const c = pts[(i + 1) % pts.length];
                if ((b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]) !== 0) out.push(b);
            }
            if (out.length >= 3) { loops.push(out); vertexCount += out.length; }
            if (vertexCount > maxVertices) return { ok: false, reason: 'too-complex' };
        }
    }
    return { ok: true, loops, vertexCount };
}
