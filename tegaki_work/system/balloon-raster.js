/**
 * ============================================================================
 * ファイル名: system/balloon-raster.js
 * 責務: 吹き出し(本体+しっぽ+文字)をRGBA画素へ描き出す(確定Raster Layer用)。プレビュー描画も同じ関数を使う。
 * 依存: DOM Canvas2D（本番strokeには使わない）、balloon-geometry.js、balloon-text-layout.js
 * 被依存: ui/balloon-popup.js
 * 公開API: paintBalloon, rasterizeBalloon, letteringPlacement
 * 実装状態: ✅実装
 * ============================================================================
 */

import { balloonBounds, buildBalloonParts, normalizeBalloonParams } from './balloon-geometry.js';
import { balloonTextFrame } from './balloon-text-layout.js';

function tracePolygon(ctx, poly) {
    ctx.beginPath();
    poly.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.closePath();
}

/**
 * 本体としっぽを描く。まず全部を2×線幅で縁取り、続けて塗りで内側を覆うので、
 * 本体としっぽの継ぎ目に線が残らず、外周だけが線幅どおりに見える。
 * ctxの座標変換(translate/scale)は呼び出し側で設定済みとする。
 */
export function paintBalloon(ctx, rawParams, canvas) {
    const p = normalizeBalloonParams(rawParams, canvas);
    const { body, tails } = buildBalloonParts(p, canvas);
    const polys = [body, ...tails];
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.miterLimit = 2;
    if (p.lineWidth > 0) {
        ctx.strokeStyle = p.lineColor;
        ctx.lineWidth = p.lineWidth * 2;
        for (const poly of polys) {
            tracePolygon(ctx, poly);
            ctx.stroke();
        }
    }
    ctx.fillStyle = p.fillColor;
    for (const poly of polys) {
        tracePolygon(ctx, poly);
        ctx.fill();
    }
    ctx.restore();
    return p;
}

/** 文字画像(幅w×高さh)を、文字領域の中心へ置く時の左上座標。 */
export function letteringPlacement(rawParams, canvas, lettering, bodyIndex = 0) {
    const area = balloonTextFrame(rawParams, canvas, bodyIndex);
    return { x: Math.round(area.cx - lettering.width / 2), y: Math.round(area.cy - lettering.height / 2) };
}

function drawLettering(ctx, lettering, x, y) {
    const tmp = document.createElement('canvas');
    tmp.width = lettering.width;
    tmp.height = lettering.height;
    tmp.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(lettering.pixels), lettering.width, lettering.height), 0, 0);
    ctx.drawImage(tmp, x, y);
}

/**
 * @param {object} rawParams 吹き出しparams
 * @param {{width:number,height:number}} canvas プロジェクトのキャンバス寸法
 * @param {{width:number,height:number,pixels:Uint8ClampedArray}|Array|null} lettering 単体または本体順の文字画像。空欄はnull。
 * @returns {{ok:true,width,height,pixels,rasterBounds}|{ok:false,reason}}
 */
export function rasterizeBalloon(rawParams, canvas, lettering = null) {
    if (typeof document === 'undefined') return { ok: false, reason: 'Canvas2Dを利用できません' };
    const p = normalizeBalloonParams(rawParams, canvas);
    const bounds = balloonBounds(p, canvas);
    const texts = (Array.isArray(lettering) ? lettering : [lettering]).map((image, index) => image?.pixels?.length ? { image, ...letteringPlacement(p, canvas, image, index) } : null).filter(Boolean);
    // Explicit frames may intentionally leave the body. Preserve those pixels instead of clipping to the outline's bounds.
    const right = Math.max(bounds.x + bounds.width, ...texts.map(t => t.x + t.image.width));
    const bottom = Math.max(bounds.y + bounds.height, ...texts.map(t => t.y + t.image.height));
    bounds.x = Math.min(bounds.x, ...texts.map(t => t.x));
    bounds.y = Math.min(bounds.y, ...texts.map(t => t.y));
    bounds.width = right - bounds.x;
    bounds.height = bottom - bounds.y;
    if (bounds.width > 8192 || bounds.height > 8192 || bounds.width * bounds.height > 16 * 1024 * 1024) return { ok: false, reason: '吹き出しと文字の範囲が大きすぎます' };
    const el = document.createElement('canvas');
    el.width = bounds.width;
    el.height = bounds.height;
    const ctx = el.getContext('2d', { willReadFrequently: true });
    if (!ctx) return { ok: false, reason: 'Canvas2Dを利用できません' };
    ctx.clearRect(0, 0, bounds.width, bounds.height);
    ctx.translate(-bounds.x, -bounds.y);
    paintBalloon(ctx, p, canvas);
    for (const text of texts) drawLettering(ctx, text.image, text.x, text.y);
    const image = ctx.getImageData(0, 0, bounds.width, bounds.height);
    return { ok: true, width: bounds.width, height: bounds.height, pixels: image.data, rasterBounds: { ...bounds } };
}
