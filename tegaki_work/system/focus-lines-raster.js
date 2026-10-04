/**
 * ============================================================================
 * ファイル名: system/focus-lines-raster.js
 * 責務: 集中線ポリゴン列 / 閉輪郭をキャンバス寸法のRGBA画素へ描き出す（確定Raster Layer用）
 * 依存: DOM Canvas2D（コマ割りと同じ。本番strokeには使わない）
 * 被依存: ui/focus-lines-popup.js
 * 公開API: rasterizeFocusLines
 * 実装状態: ✅実装
 * ============================================================================
 */

const HEX = /^#[0-9a-f]{6}$/i;

function addContour(ctx, points) {
    if (!Array.isArray(points) || points.length < 3) return false;
    const valid = points.every(point => Number.isFinite(point?.x) && Number.isFinite(point?.y));
    if (!valid) return false;
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i].x, points[i].y);
    ctx.closePath();
    return true;
}

function rasterizeBody(ctx, body, options) {
    if (!body || !addContour(ctx, body.outer)) return false;
    if (Array.isArray(body.inner)) addContour(ctx, body.inner);
    const fillColor = HEX.test(body.fillColor || '') ? body.fillColor : null;
    if (fillColor) {
        ctx.fillStyle = fillColor;
        // The ring's center must remain transparent.  evenodd also makes a
        // self-overlap deterministic without painting a fake white patch.
        ctx.fill(body.inner ? 'evenodd' : 'nonzero');
    }
    ctx.strokeStyle = HEX.test(options.color || '') ? options.color : '#800000';
    ctx.lineWidth = Math.max(0.5, Math.min(60, Number(body.lineWidth) || 3));
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();
    return true;
}

export function rasterizeFocusLines(polygons, options = {}) {
    const width = Math.max(1, Math.round(options.width || 1));
    const height = Math.max(1, Math.round(options.height || 1));
    if (typeof document === 'undefined') return { ok: false, reason: 'Canvas2Dを利用できません' };
    const body = polygons && !Array.isArray(polygons) && Array.isArray(polygons.outer)
        ? polygons
        : polygons?.body && Array.isArray(polygons.body.outer) ? polygons.body : null;
    if (!body && !polygons?.length) return { ok: false, reason: '線がありません' };

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return { ok: false, reason: 'Canvas2Dを利用できません' };

    ctx.clearRect(0, 0, width, height);
    if (body) {
        ctx.beginPath();
        if (!rasterizeBody(ctx, body, options)) return { ok: false, reason: '輪郭がありません' };
    } else {
        ctx.fillStyle = HEX.test(options.color || '') ? options.color : '#800000';
        for (const poly of polygons) {
            ctx.beginPath();
            poly.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
            ctx.closePath();
            ctx.fill();
        }
    }
    const image = ctx.getImageData(0, 0, width, height);
    return { ok: true, width, height, pixels: image.data, rasterBounds: { x: 0, y: 0, width, height } };
}
