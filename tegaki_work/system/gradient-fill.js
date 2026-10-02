/**
 * ============================================================================
 * ファイル名: system/gradient-fill.js
 * 責務: グラデーションツールの純粋な画素計算（線形/放射、色A→色B、透明への減衰、選択マスク対応）
 * 依存: なし（DOM / Pixi非依存）
 * 被依存: system/pixel-selection-system.js, build/verify-gradient-fill.mjs
 * 公開API: GRADIENT_KINDS, computeGradientT, applyGradientToPixels
 * 保存: なし(結果は通常のRaster画素。確定時にHistory 1件)
 * 実装状態: ✅実装
 * ============================================================================
 */

export const GRADIENT_KINDS = Object.freeze([
    { id: 'linear', label: '線形' },
    { id: 'radial', label: '放射' }
]);

/** 点(x,y)のグラデーション位置t(0..1)。start→endが0→1。線形は垂直方向に一定、放射はstart中心・半径|end-start|。 */
export function computeGradientT(kind, start, end, x, y) {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const len2 = dx * dx + dy * dy;
    if (len2 < 1e-6) return 0;
    if (kind === 'radial') {
        const d = Math.hypot(x - start.x, y - start.y);
        return Math.min(1, d / Math.sqrt(len2));
    }
    const t = ((x - start.x) * dx + (y - start.y) * dy) / len2;
    return Math.min(1, Math.max(0, t));
}

/**
 * 画素へグラデーションを重ねる(straight-alphaのsource-over)。
 * @param {{pixels:Uint8ClampedArray, width:number, height:number, originX?:number, originY?:number}} target
 *   originX/Y: pixels左上のProject座標
 * @param {{kind:'linear'|'radial', start:{x,y}, end:{x,y}, colorA:number[], colorB:number[]}} params
 *   color: [r,g,b,a(0-255)]。透明へ消すなら colorB の a を 0 にする(色はAと同じにすると色ずれしない)
 * @param {{bounds?:{x,y,width,height}, mask?:Uint8Array}} [region] 範囲(Project座標)とマスク(bounds基準)
 * @returns {number} 変更した画素数
 */
export function applyGradientToPixels(target, params, region = {}) {
    const { pixels, width, height } = target;
    const ox = Number(target.originX) || 0;
    const oy = Number(target.originY) || 0;
    const a = params.colorA;
    const b = params.colorB;
    const bounds = region.bounds || { x: ox, y: oy, width, height };
    const x0 = Math.max(ox, Math.floor(bounds.x));
    const y0 = Math.max(oy, Math.floor(bounds.y));
    const x1 = Math.min(ox + width, Math.ceil(bounds.x + bounds.width));
    const y1 = Math.min(oy + height, Math.ceil(bounds.y + bounds.height));
    let changed = 0;
    for (let y = y0; y < y1; y += 1) {
        for (let x = x0; x < x1; x += 1) {
            if (region.mask) {
                const mx = x - Math.floor(bounds.x);
                const my = y - Math.floor(bounds.y);
                if (region.mask[my * bounds.width + mx] !== 1) continue;
            }
            const t = computeGradientT(params.kind, params.start, params.end, x + 0.5, y + 0.5);
            // 色は不透明度で重み付けして補間(透明端の色にじみを避ける)
            const aa = a[3] / 255; const ba = b[3] / 255;
            const srcA = aa + (ba - aa) * t;
            if (srcA <= 0.0005) continue;
            const wa = aa * (1 - t); const wb = ba * t;
            const wsum = wa + wb || 1;
            const sr = (a[0] * wa + b[0] * wb) / wsum;
            const sg = (a[1] * wa + b[1] * wb) / wsum;
            const sb = (a[2] * wa + b[2] * wb) / wsum;
            const i = ((y - oy) * width + (x - ox)) * 4;
            const dstA = pixels[i + 3] / 255;
            const outA = srcA + dstA * (1 - srcA);
            if (outA <= 0) continue;
            pixels[i] = Math.round((sr * srcA + pixels[i] * dstA * (1 - srcA)) / outA);
            pixels[i + 1] = Math.round((sg * srcA + pixels[i + 1] * dstA * (1 - srcA)) / outA);
            pixels[i + 2] = Math.round((sb * srcA + pixels[i + 2] * dstA * (1 - srcA)) / outA);
            pixels[i + 3] = Math.round(outA * 255);
            changed += 1;
        }
    }
    return changed;
}
