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
    let width = Math.max(1, Math.round(options.width || 1));
    let height = Math.max(1, Math.round(options.height || 1));
    if (typeof document === 'undefined') return { ok: false, reason: 'Canvas2Dを利用できません' };
    const flash = polygons?.kind === 'tapered' && Array.isArray(polygons.polygons) ? polygons : null;
    const body = !flash && polygons && !Array.isArray(polygons) && Array.isArray(polygons.outer)
        ? polygons
        : polygons?.body && Array.isArray(polygons.body.outer) ? polygons.body : null;
    if (!flash && !body && !polygons?.length) return { ok: false, reason: '線がありません' };

    let x = 0, y = 0;
    // A local uni must not allocate a whole 7k page. Outside-fill is explicitly
    // a page effect and keeps full Canvas bounds; all legacy rasters stay exact.
    if (flash && flash.fill !== 'outside') {
        const points = [...flash.polygons.flat(), ...flash.boundary, ...flash.opening];
        if (!points.length || points.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y))) return {ok:false,reason:'線の範囲が不正です'};
        const pad = Math.ceil(flash.ellipse === 'outline' ? flash.ellipseWidth / 2 : 0) + 2;
        x = Math.max(0,Math.floor(Math.min(...points.map(p=>p.x))-pad));
        y = Math.max(0,Math.floor(Math.min(...points.map(p=>p.y))-pad));
        const right=Math.min(width,Math.ceil(Math.max(...points.map(p=>p.x))+pad));
        const bottom=Math.min(height,Math.ceil(Math.max(...points.map(p=>p.y))+pad));
        width=right-x; height=bottom-y;
        if (width < 1 || height < 1) return {ok:false,reason:'Canvas内に線がありません'};
    }
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return { ok: false, reason: 'Canvas2Dを利用できません' };

    ctx.clearRect(0, 0, width, height);
    ctx.translate(-x,-y);
    if (flash) {
        const color = HEX.test(options.color || '') ? options.color : '#800000';
        if (flash.fill !== 'none') {
            ctx.beginPath();
            if (flash.fill === 'outside') ctx.rect(0,0,width,height);
            addContour(ctx, flash.boundary);
            ctx.fillStyle = color; ctx.fill(flash.fill === 'outside' ? 'evenodd' : 'nonzero');
        }
        ctx.fillStyle = color;
        // Use the exact same ordered contours as the SVG, in the same paint order.
        ctx.beginPath();
        for (const poly of flash.polygons) addContour(ctx,poly);
        ctx.fill();
        if (flash.ellipse !== 'none') {
            ctx.beginPath(); addContour(ctx,flash.opening);
            if (flash.ellipse === 'fill') { ctx.fillStyle = flash.paperColor; ctx.fill(); }
            else { ctx.strokeStyle = color; ctx.lineWidth = flash.ellipseWidth; ctx.lineJoin='round'; ctx.stroke(); }
        }
    } else if (body) {
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
    return { ok: true, width, height, pixels: image.data, rasterBounds: { x, y, width, height } };
}
