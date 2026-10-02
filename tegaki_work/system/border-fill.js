/**
 * ============================================================================
 * ファイル名: system/border-fill.js
 * 責務: フチ（縁取り）の純粋な画素計算。レイヤーの絵の輪郭に沿って、指定の太さ・色の縁を付ける（外側 / 内側）
 * 依存: なし（DOM / Pixi非依存）
 * 被依存: system/border-tool.js, build/verify-border-fill.mjs
 * 公開API: BORDER_LIMITS, computeBorderPixels, contentBounds
 * 保存: なし(結果は通常のRaster画素。確定時にHistory 1件)
 *
 * 方式: 不透明な画素（alpha>=128）からのユークリッド距離を距離変換で求め、太さ半径の縁を距離で塗る。
 *   縁の端は距離から1画素ぶんのなめらかな縁（アンチエイリアス）にする。外側は元の絵の下に、内側は絵の中を縁色に置き換える。
 * ============================================================================
 */

export const BORDER_LIMITS = Object.freeze({ radius: { min: 1, max: 100, default: 4 } });

const INF = 1e20;

/** Felzenszwalbの1次元二乗距離変換。f(長さn)をdへ。 */
function distanceTransform1D(f, n, d, v, z) {
    let k = 0;
    v[0] = 0;
    z[0] = -INF;
    z[1] = INF;
    for (let q = 1; q < n; q += 1) {
        let s;
        for (;;) {
            const p = v[k];
            s = ((f[q] + q * q) - (f[p] + p * p)) / (2 * q - 2 * p);
            if (s <= z[k] && k > 0) { k -= 1; continue; }
            break;
        }
        if (s <= z[k]) {
            // k === 0 の先頭置換
            v[0] = q;
            z[0] = -INF;
            z[1] = INF;
        } else {
            k += 1;
            v[k] = q;
            z[k] = s;
            z[k + 1] = INF;
        }
    }
    k = 0;
    for (let q = 0; q < n; q += 1) {
        while (z[k + 1] < q) k += 1;
        const dq = q - v[k];
        d[q] = dq * dq + f[v[k]];
    }
}

/** seed[i]=1 の画素からの二乗ユークリッド距離を返す(width*height)。seedが無ければ全てINF。 */
export function squaredDistanceFromSeeds(seed, width, height) {
    const grid = new Float64Array(width * height);
    for (let i = 0; i < grid.length; i += 1) grid[i] = seed[i] ? 0 : INF;
    const size = Math.max(width, height);
    const f = new Float64Array(size);
    const d = new Float64Array(size);
    const v = new Int32Array(size);
    const z = new Float64Array(size + 1);
    for (let x = 0; x < width; x += 1) {
        for (let y = 0; y < height; y += 1) f[y] = grid[y * width + x];
        distanceTransform1D(f, height, d, v, z);
        for (let y = 0; y < height; y += 1) grid[y * width + x] = d[y];
    }
    for (let y = 0; y < height; y += 1) {
        const row = y * width;
        for (let x = 0; x < width; x += 1) f[x] = grid[row + x];
        distanceTransform1D(f, width, d, v, z);
        for (let x = 0; x < width; x += 1) grid[row + x] = d[x];
    }
    return grid;
}

/** alpha>0の画素の外接矩形（無ければnull）。originは画素配列左上のProject座標。 */
export function contentBounds({ pixels, width, height, originX = 0, originY = 0 }) {
    let x0 = width; let y0 = height; let x1 = -1; let y1 = -1;
    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
            if (pixels[(y * width + x) * 4 + 3] === 0) continue;
            if (x < x0) x0 = x;
            if (x > x1) x1 = x;
            if (y < y0) y0 = y;
            if (y > y1) y1 = y;
        }
    }
    if (x1 < 0) return null;
    return { x: originX + x0, y: originY + y0, width: x1 - x0 + 1, height: y1 - y0 + 1 };
}

/**
 * 指定範囲(Project座標)の画素にフチを付けた結果を返す。入力は書き換えない。
 * @param {{pixels:Uint8ClampedArray,width:number,height:number,originX?:number,originY?:number}} target
 * @param {{x:number,y:number,width:number,height:number}} region 処理範囲（外側のフチは範囲内にだけ描かれる。広めに取ること）
 * @param {{radius:number, rgb:number[], position:'outside'|'inside'}} options
 * @returns {{region:{x,y,width,height}, pixels:Uint8ClampedArray}|null} regionぶんのRGBA(straight alpha)
 */
export function computeBorderPixels(target, region, options) {
    const ox = Number(target.originX) || 0;
    const oy = Number(target.originY) || 0;
    const rx0 = Math.max(ox, Math.floor(region.x));
    const ry0 = Math.max(oy, Math.floor(region.y));
    const rx1 = Math.min(ox + target.width, Math.ceil(region.x + region.width));
    const ry1 = Math.min(oy + target.height, Math.ceil(region.y + region.height));
    const w = rx1 - rx0;
    const h = ry1 - ry0;
    if (!(w > 0 && h > 0)) return null;
    const radius = Math.max(BORDER_LIMITS.radius.min, Math.min(BORDER_LIMITS.radius.max, Number(options.radius) || BORDER_LIMITS.radius.default));
    const [cr, cg, cb] = options.rgb;
    const inside = options.position === 'inside';

    const out = new Uint8ClampedArray(w * h * 4);
    const seed = new Uint8Array(w * h);
    for (let y = 0; y < h; y += 1) {
        for (let x = 0; x < w; x += 1) {
            const si = ((ry0 + y - oy) * target.width + (rx0 + x - ox)) * 4;
            const di = (y * w + x) * 4;
            out[di] = target.pixels[si];
            out[di + 1] = target.pixels[si + 1];
            out[di + 2] = target.pixels[si + 2];
            out[di + 3] = target.pixels[si + 3];
            const opaque = target.pixels[si + 3] >= 128;
            // 外側: 絵(不透明)からの距離 / 内側: 透明からの距離
            seed[y * w + x] = inside ? (opaque ? 0 : 1) : (opaque ? 1 : 0);
        }
    }
    const dist2 = squaredDistanceFromSeeds(seed, w, h);
    for (let i = 0; i < w * h; i += 1) {
        const d = Math.sqrt(dist2[i]);
        // 縁の端は距離から1画素ぶんなめらかに（画素中心の距離dが radius で1、radius+1 で0。整数の太さなら太さぶんの画素が完全に縁色）
        const cover = Math.max(0, Math.min(1, radius + 1 - d));
        if (cover <= 0) continue;
        const p = i * 4;
        const srcA = out[p + 3] / 255;
        if (inside) {
            if (srcA <= 0) continue;
            // 絵の中だけ縁色に寄せる（alphaは変えない）
            out[p] = Math.round(out[p] * (1 - cover) + cr * cover);
            out[p + 1] = Math.round(out[p + 1] * (1 - cover) + cg * cover);
            out[p + 2] = Math.round(out[p + 2] * (1 - cover) + cb * cover);
        } else {
            if (srcA >= 1) continue;
            const borderA = cover * (1 - srcA); // 縁は絵の下
            const outA = srcA + borderA;
            if (outA <= 0) continue;
            out[p] = Math.round((out[p] * srcA + cr * borderA) / outA);
            out[p + 1] = Math.round((out[p + 1] * srcA + cg * borderA) / outA);
            out[p + 2] = Math.round((out[p + 2] * srcA + cb * borderA) / outA);
            out[p + 3] = Math.round(outA * 255);
        }
    }
    return { region: { x: rx0, y: ry0, width: w, height: h }, pixels: out };
}
