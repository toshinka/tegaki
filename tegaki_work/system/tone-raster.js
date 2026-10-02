/**
 * ============================================================================
 * ファイル名: system/tone-raster.js
 * 責務: トーンparamsをキャンバス寸法のRGBA画素へ描き出す（確定Raster Layer用）
 * 依存: system/tone-geometry.js, DOM Canvas2D（確定時のみ。本番strokeには使わない）
 * 被依存: ui/tone-panel.js, build/verify-tone-raster(e2e)
 * 公開API: rasterizeTone, TONE_RASTER_LEVELS
 * 実装状態: ✅実装（WP-014）
 *
 * 描き方
 *   濃度0.5以下 … セルの中心に網点/ひし形を置く（面積 = 濃度 × pitch²）
 *   濃度0.5超   … セルを塗りつぶし、中心に「抜け」を開ける（面積 = (1-濃度) × pitch²）
 *   線          … 回転した格子に沿う帯。太さ = 濃度 × pitch
 *   濃度は TONE_RASTER_LEVELS 段にまとめて1回のfillでまとめ描きする。
 * ============================================================================
 */

import { TONE_MAX_CELLS, countToneCells, forEachToneCell, normalizeToneParams } from './tone-geometry.js';

export const TONE_RASTER_LEVELS = 64;

function polygonPath(ctx, cx, cy, hx, hy, cos, sin) {
    // 格子座標系で(±hx, ±hy)の矩形(ひし形は呼び出し側で頂点を指定)
    const pts = [[-hx, -hy], [hx, -hy], [hx, hy], [-hx, hy]];
    pts.forEach(([u, v], i) => {
        const x = cx + u * cos - v * sin;
        const y = cy + u * sin + v * cos;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.closePath();
}

function diamondPath(ctx, cx, cy, h, cos, sin) {
    const pts = [[h, 0], [0, h], [-h, 0], [0, -h]];
    pts.forEach(([u, v], i) => {
        const x = cx + u * cos - v * sin;
        const y = cy + u * sin + v * cos;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.closePath();
}

/**
 * @param {object} rawParams トーンparams
 * @param {{width:number,height:number,fill?:{x,y,w,h},ref?:{x,y,w,h}}} options
 *   fill: 描く範囲(既定=全面) / ref: グラデーションの基準矩形(既定=fill)
 */
export function rasterizeTone(rawParams, options = {}) {
    const width = Math.max(1, Math.round(options.width || 1));
    const height = Math.max(1, Math.round(options.height || 1));
    if (typeof document === 'undefined') return { ok: false, reason: 'Canvas2Dを利用できません' };
    const p = normalizeToneParams(rawParams);
    const fill = options.fill || { x: 0, y: 0, w: width, h: height };
    const ref = options.ref || fill;
    if (countToneCells(p, fill) > TONE_MAX_CELLS) {
        return { ok: false, reason: '網点が細かすぎます（間隔を広げてください）' };
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return { ok: false, reason: 'Canvas2Dを利用できません' };
    ctx.clearRect(0, 0, width, height);

    const rad = (p.angle * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const pitch = p.pitch;
    const levels = TONE_RASTER_LEVELS;
    const low = Array.from({ length: levels + 1 }, () => []);   // 濃度 <= 0.5 / 線
    const high = Array.from({ length: levels + 1 }, () => []);  // 濃度 > 0.5 (面+抜け)

    const cells = forEachToneCell(p, ref, fill, (x, y, d) => {
        const q = Math.max(1, Math.round(d * levels));
        if (p.shape !== 'line' && d > 0.5) high[q].push(x, y); else low[q].push(x, y);
    });
    if (cells === 0) return { ok: false, reason: '濃度が0です' };

    ctx.fillStyle = p.color;

    // 1) 面(濃度>0.5): セルを塗る
    ctx.beginPath();
    for (let q = 1; q <= levels; q += 1) {
        const a = high[q];
        for (let k = 0; k < a.length; k += 2) polygonPath(ctx, a[k], a[k + 1], pitch * 0.5 + 0.35, pitch * 0.5 + 0.35, cos, sin);
    }
    ctx.fill();

    // 2) 低濃度: 網点 / ひし形 / 線
    for (let q = 1; q <= levels; q += 1) {
        const a = low[q];
        if (!a.length) continue;
        const d = q / levels;
        ctx.beginPath();
        for (let k = 0; k < a.length; k += 2) {
            const x = a[k]; const y = a[k + 1];
            if (p.shape === 'dot') {
                const r = pitch * Math.sqrt(d / Math.PI);
                ctx.moveTo(x + r, y);
                ctx.arc(x, y, r, 0, Math.PI * 2);
            } else if (p.shape === 'diamond') {
                diamondPath(ctx, x, y, pitch * Math.sqrt(d / 2) * 1.0, cos, sin);
            } else {
                polygonPath(ctx, x, y, pitch * 0.5 + 0.35, Math.max(0.15, d * pitch * 0.5), cos, sin);
            }
        }
        ctx.fill();
    }

    // 3) 濃度>0.5: 中心を抜く
    ctx.globalCompositeOperation = 'destination-out';
    for (let q = 1; q <= levels; q += 1) {
        const a = high[q];
        if (!a.length) continue;
        const hole = 1 - q / levels;
        if (hole <= 0.0005) continue;
        ctx.beginPath();
        for (let k = 0; k < a.length; k += 2) {
            const x = a[k]; const y = a[k + 1];
            if (p.shape === 'diamond') {
                diamondPath(ctx, x, y, pitch * Math.sqrt(hole / 2), cos, sin);
            } else {
                const r = pitch * Math.sqrt(hole / Math.PI);
                ctx.moveTo(x + r, y);
                ctx.arc(x, y, r, 0, Math.PI * 2);
            }
        }
        ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';

    const image = ctx.getImageData(0, 0, width, height);
    if (p.crisp) {
        const d = image.data;
        for (let i = 3; i < d.length; i += 4) d[i] = d[i] >= 128 ? 255 : 0;
    }
    return { ok: true, width, height, cells, pixels: image.data, rasterBounds: { x: 0, y: 0, width, height } };
}
