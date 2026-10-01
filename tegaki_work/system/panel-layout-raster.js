/**
 * ============================================================================
 * ファイル名: system/panel-layout-raster.js
 * 責務: 解決済みコマ割りをキャンバス寸法のRGBA画素へ描き出す（枠線Raster用）
 * 依存: DOM Canvas2D（既存のCPU compositor/exportと同じ用途。本番strokeには使わない）, system/panel-layout.js(panelBounds)
 * 被依存: ui/panel-layout-popup.js
 * 公開API: rasterizePanelFrames(mode: 'lines'=枠線 / 'fill'=コマ内の塗り)
 * 実装状態: ✅実装（WP-010 Rough Product Pass）
 * ============================================================================
 */

import { panelBounds } from './panel-layout.js';

function parseColor(color) {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(color || '').trim());
    return m ? `#${m[1]}` : '#800000';
}

/**
 * @param {{panels: Array<{id, quad: Array<{x:number,y:number}>, lineWidth, deleted}>}} resolved resolvePanelLayoutの結果
 * @param {{width, height, mode?: 'lines'|'fill', lineWidth?, color?, only?: string}} options
 *   only: 指定したコマだけを描き、そのコマの外接矩形(+線幅分)だけのRasterを返す(コマ別Layer用)。
 *   省略時はキャンバス全体のRaster。
 * @returns {{ok: true, width, height, pixels: Uint8ClampedArray, rasterBounds}|{ok:false, reason}}
 */
export function rasterizePanelFrames(resolved, options = {}) {
    const canvasWidth = Math.max(1, Math.round(options.width || 1));
    const canvasHeight = Math.max(1, Math.round(options.height || 1));
    const mode = options.mode === 'fill' ? 'fill' : 'lines';
    const lineWidth = Number(options.lineWidth) || 0;
    const panels = resolved.panels.filter(p => !p.deleted && (!options.only || p.id === options.only));
    if (options.only && panels.length === 0) return { ok: false, reason: '対象のコマがありません' };
    if (mode === 'lines' && lineWidth <= 0 && !panels.some(p => (p.lineWidth ?? 0) > 0)) {
        return { ok: false, reason: '線の太さが0です' };
    }
    if (typeof document === 'undefined') return { ok: false, reason: 'Canvas2Dを利用できません' };

    let bounds = { x: 0, y: 0, width: canvasWidth, height: canvasHeight };
    if (options.only) {
        const widest = Math.max(lineWidth, panels[0].lineWidth ?? 0);
        bounds = panelBounds(panels[0].quad, { width: canvasWidth, height: canvasHeight }, widest * 2 + 2);
    }

    const canvas = document.createElement('canvas');
    canvas.width = bounds.width;
    canvas.height = bounds.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return { ok: false, reason: 'Canvas2Dを利用できません' };

    ctx.clearRect(0, 0, bounds.width, bounds.height);
    ctx.translate(-bounds.x, -bounds.y);
    ctx.strokeStyle = parseColor(options.color);
    ctx.fillStyle = parseColor(options.color);
    ctx.lineJoin = 'miter';
    ctx.miterLimit = 4;
    for (const panel of panels) {
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

    const image = ctx.getImageData(0, 0, bounds.width, bounds.height);
    return { ok: true, width: bounds.width, height: bounds.height, pixels: image.data, rasterBounds: { ...bounds } };
}

/** 透明なRaster(コマ内描画Layer用)。onlyのコマと同じ外接矩形。 */
export function emptyPanelRaster(resolved, options = {}) {
    const panel = resolved.panels.find(p => p.id === options.only);
    const bounds = panel
        ? panelBounds(panel.quad, { width: options.width, height: options.height }, (options.lineWidth || 0) * 2 + 2)
        : { x: 0, y: 0, width: Math.max(1, options.width), height: Math.max(1, options.height) };
    return {
        ok: true,
        width: bounds.width,
        height: bounds.height,
        pixels: new Uint8ClampedArray(bounds.width * bounds.height * 4),
        rasterBounds: { ...bounds }
    };
}
