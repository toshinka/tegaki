/**
 * ============================================================================
 * ファイル名: system/panel-layout-raster.js
 * 責務: 解決済みコマ割りをキャンバス寸法のRGBA画素へ描き出す（枠線Raster用）
 * 依存: DOM Canvas2D（既存のCPU compositor/exportと同じ用途。本番strokeには使わない）
 * 被依存: ui/panel-layout-popup.js
 * 公開API: rasterizePanelFrames(mode: 'lines'=枠線 / 'fill'=コマ内の塗り)
 * 実装状態: ✅実装（WP-010 Rough Product Pass）
 * ============================================================================
 */

function parseColor(color) {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(color || '').trim());
    return m ? `#${m[1]}` : '#800000';
}

/**
 * @param {{panels: Array<{quad: Array<{x:number,y:number}>}>}} resolved resolvePanelLayoutの結果
 * @returns {{ok: true, width, height, pixels: Uint8ClampedArray, rasterBounds}|{ok:false, reason}}
 */
export function rasterizePanelFrames(resolved, options = {}) {
    const width = Math.max(1, Math.round(options.width || 1));
    const height = Math.max(1, Math.round(options.height || 1));
    const mode = options.mode === 'fill' ? 'fill' : 'lines';
    const lineWidth = Number(options.lineWidth) || 0;
    if (mode === 'lines' && lineWidth <= 0 && !resolved.panels.some(p => !p.deleted && (p.lineWidth ?? 0) > 0)) {
        return { ok: false, reason: '線の太さが0です' };
    }
    if (typeof document === 'undefined') return { ok: false, reason: 'Canvas2Dを利用できません' };

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return { ok: false, reason: 'Canvas2Dを利用できません' };

    ctx.clearRect(0, 0, width, height);
    ctx.strokeStyle = parseColor(options.color);
    ctx.fillStyle = parseColor(options.color);
    ctx.lineJoin = 'miter';
    ctx.miterLimit = 4;
    for (const panel of resolved.panels) {
        if (panel.deleted) continue;
        ctx.beginPath();
        panel.quad.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
        ctx.closePath();
        if (mode === 'fill') {
            ctx.fill();
        } else {
            const width = panel.lineWidth ?? lineWidth;
            if (width <= 0) continue;
            ctx.lineWidth = width;
            ctx.stroke();
        }
    }

    const image = ctx.getImageData(0, 0, width, height);
    return {
        ok: true,
        width,
        height,
        pixels: image.data,
        rasterBounds: { x: 0, y: 0, width, height }
    };
}
