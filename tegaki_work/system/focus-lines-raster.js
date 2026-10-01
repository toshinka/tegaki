/**
 * ============================================================================
 * ファイル名: system/focus-lines-raster.js
 * 責務: 集中線ポリゴン列をキャンバス寸法のRGBA画素へ描き出す（確定Raster Layer用）
 * 依存: DOM Canvas2D（コマ割りと同じ。本番strokeには使わない）
 * 被依存: ui/focus-lines-popup.js
 * 公開API: rasterizeFocusLines
 * 実装状態: ✅実装
 * ============================================================================
 */

export function rasterizeFocusLines(polygons, options = {}) {
    const width = Math.max(1, Math.round(options.width || 1));
    const height = Math.max(1, Math.round(options.height || 1));
    if (typeof document === 'undefined') return { ok: false, reason: 'Canvas2Dを利用できません' };
    if (!polygons?.length) return { ok: false, reason: '線がありません' };

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return { ok: false, reason: 'Canvas2Dを利用できません' };

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = /^#[0-9a-f]{6}$/i.test(options.color || '') ? options.color : '#800000';
    for (const poly of polygons) {
        ctx.beginPath();
        poly.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
        ctx.closePath();
        ctx.fill();
    }
    const image = ctx.getImageData(0, 0, width, height);
    return { ok: true, width, height, pixels: image.data, rasterBounds: { x: 0, y: 0, width, height } };
}
