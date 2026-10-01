/**
 * ============================================================================
 * ファイル名: system/balloon-raster.js
 * 責務: 吹き出し(本体+しっぽ+文字)をRGBA画素へ描き出す(確定Raster Layer用)。プレビュー描画も同じ関数を使う。
 * 依存: DOM Canvas2D（コマ割り/集中線と同じ。本番strokeには使わない）、system/balloon-geometry.js
 * 被依存: ui/balloon-popup.js
 * 公開API: paintBalloon, rasterizeBalloon, letteringPlacement
 * 実装状態: ✅実装
 * ============================================================================
 */

import { balloonBounds, balloonTextArea, buildBalloonParts, normalizeBalloonParams } from './balloon-geometry.js';

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
export function letteringPlacement(rawParams, canvas, lettering) {
    const area = balloonTextArea(rawParams, canvas);
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
 * @param {{width:number,height:number,pixels:Uint8ClampedArray}|null} lettering rasterizeLetteringの結果(省略で文字なし)
 * @returns {{ok:true,width,height,pixels,rasterBounds}|{ok:false,reason}}
 */
export function rasterizeBalloon(rawParams, canvas, lettering = null) {
    if (typeof document === 'undefined') return { ok: false, reason: 'Canvas2Dを利用できません' };
    const p = normalizeBalloonParams(rawParams, canvas);
    const bounds = balloonBounds(p, canvas);
    const el = document.createElement('canvas');
    el.width = bounds.width;
    el.height = bounds.height;
    const ctx = el.getContext('2d', { willReadFrequently: true });
    if (!ctx) return { ok: false, reason: 'Canvas2Dを利用できません' };
    ctx.clearRect(0, 0, bounds.width, bounds.height);
    ctx.translate(-bounds.x, -bounds.y);
    paintBalloon(ctx, p, canvas);
    if (lettering?.pixels?.length) {
        const at = letteringPlacement(p, canvas, lettering);
        drawLettering(ctx, lettering, at.x, at.y);
    }
    const image = ctx.getImageData(0, 0, bounds.width, bounds.height);
    return { ok: true, width: bounds.width, height: bounds.height, pixels: image.data, rasterBounds: { ...bounds } };
}
