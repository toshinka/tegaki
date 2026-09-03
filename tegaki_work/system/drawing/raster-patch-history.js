/**
 * ============================================================================
 * ファイル名: system/drawing/raster-patch-history.js
 * 責務: Pen / Eraser ストロークの dirty rect 計算、部分パッチ抽出・復元、
 *       unpremultiply 処理、メモリ推定を担当する pure helper モジュール。
 * 依存: なし (DOM, Pixi 非依存)
 * ============================================================================
 */

export const RASTER_PATCH_BASE_METADATA_BYTES = 128;

/**
 * ストローク点列とブラシ設定から Project 空間の dirty rect (AABB + padding) を計算する。
 * @param {Array<{x: number, y: number, pressure?: number}>} points
 * @param {Object} settings
 * @returns {{ x: number, y: number, width: number, height: number } | null}
 */
export function calculateStrokeDirtyRect(points, settings = {}) {
    if (!Array.isArray(points) || points.length === 0) return null;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (let i = 0; i < points.length; i++) {
        const pt = points[i];
        if (!pt || !Number.isFinite(pt.x) || !Number.isFinite(pt.y)) continue;
        if (pt.x < minX) minX = pt.x;
        if (pt.x > maxX) maxX = pt.x;
        if (pt.y < minY) minY = pt.y;
        if (pt.y > maxY) maxY = pt.y;
    }

    if (!Number.isFinite(minX) || !Number.isFinite(minY)) return null;

    // 半径 R = size / 2 (round cap / round join) に加え、
    // AA (1-2px) および補間マージンを確実に含めるための安全パディング
    const rawSize = Math.max(1, Number(settings.size) || 1);
    const padding = Math.max(6, Math.ceil(rawSize) + 4);

    const x = Math.floor(minX - padding);
    const y = Math.floor(minY - padding);
    const width = Math.ceil(maxX - minX + padding * 2);
    const height = Math.ceil(maxY - minY + padding * 2);

    return { x, y, width, height };
}

/**
 * Project 空間の矩形を Raster Texture local 空間へ変換し、テクスチャ範囲内に clamp する。
 * @param {{ x: number, y: number, width: number, height: number }} projectRect
 * @param {{ x: number, y: number, width: number, height: number }} rasterBounds
 * @returns {{ x: number, y: number, width: number, height: number } | null}
 */
export function projectRectToRasterLocal(projectRect, rasterBounds) {
    if (!projectRect || !rasterBounds) return null;

    const rbX = Number(rasterBounds.x) || 0;
    const rbY = Number(rasterBounds.y) || 0;
    const rbWidth = Math.max(1, Math.round(Number(rasterBounds.width) || 1));
    const rbHeight = Math.max(1, Math.round(Number(rasterBounds.height) || 1));

    const left = Math.max(0, Math.floor(projectRect.x - rbX));
    const top = Math.max(0, Math.floor(projectRect.y - rbY));
    const right = Math.min(rbWidth, Math.ceil(projectRect.x - rbX + projectRect.width));
    const bottom = Math.min(rbHeight, Math.ceil(projectRect.y - rbY + projectRect.height));

    const width = right - left;
    const height = bottom - top;

    if (width <= 0 || height <= 0) return null;

    return { x: left, y: top, width, height };
}

/**
 * フルピクセルバッファから指定矩形部分を行単位で切り出し（row copy）、パッチバッファを作成する。
 * @param {Uint8ClampedArray} sourcePixels
 * @param {number} sourceWidth
 * @param {number} sourceHeight
 * @param {{ x: number, y: number, width: number, height: number }} localRect
 * @returns {Uint8ClampedArray | null}
 */
export function cropPixelPatch(sourcePixels, sourceWidth, sourceHeight, localRect) {
    if (!sourcePixels || !localRect) return null;
    const { x, y, width, height } = localRect;
    if (width <= 0 || height <= 0 || x < 0 || y < 0) return null;
    if (x + width > sourceWidth || y + height > sourceHeight) return null;

    const patch = new Uint8ClampedArray(width * height * 4);
    const rowBytes = width * 4;

    for (let row = 0; row < height; row++) {
        const srcOffset = ((y + row) * sourceWidth + x) * 4;
        const dstOffset = row * rowBytes;
        patch.set(sourcePixels.subarray(srcOffset, srcOffset + rowBytes), dstOffset);
    }

    return patch;
}

/**
 * ターゲットのフルピクセルバッファに対し、パッチピクセルを行単位で上書き適用する。
 * @param {Uint8ClampedArray} targetPixels
 * @param {number} targetWidth
 * @param {number} targetHeight
 * @param {Uint8ClampedArray} patchPixels
 * @param {{ x: number, y: number, width: number, height: number }} localRect
 * @returns {boolean}
 */
export function applyPixelPatch(targetPixels, targetWidth, targetHeight, patchPixels, localRect) {
    if (!targetPixels || !patchPixels || !localRect) return false;
    const { x, y, width, height } = localRect;
    if (width <= 0 || height <= 0 || x < 0 || y < 0) return false;
    if (x + width > targetWidth || y + height > targetHeight) return false;
    if (patchPixels.byteLength < width * height * 4) return false;

    const rowBytes = width * 4;

    for (let row = 0; row < height; row++) {
        const srcOffset = row * rowBytes;
        const dstOffset = ((y + row) * targetWidth + x) * 4;
        targetPixels.set(patchPixels.subarray(srcOffset, srcOffset + rowBytes), dstOffset);
    }

    return true;
}

/**
 * premultiplied RGBA ピクセル配列を straight (unpremultiplied) RGBA へ変換する。
 * layer-system.js の _unpremultiplyPixelBuffer と完全一致の変換式。
 * @param {Uint8ClampedArray} pixels
 * @returns {Uint8ClampedArray}
 */
export function unpremultiplyPixels(pixels) {
    if (!pixels) return pixels;

    for (let i = 0; i < pixels.length; i += 4) {
        const alpha = pixels[i + 3];
        if (alpha > 0 && alpha < 255) {
            pixels[i] = Math.min(255, Math.round(pixels[i] * 255 / alpha));
            pixels[i + 1] = Math.min(255, Math.round(pixels[i + 1] * 255 / alpha));
            pixels[i + 2] = Math.min(255, Math.round(pixels[i + 2] * 255 / alpha));
        }
    }

    return pixels;
}

/**
 * dirty rect パッチの推定バイト数を算出する。
 * @param {{ pixels?: { byteLength?: number } }} beforePatch
 * @param {{ pixels?: { byteLength?: number } }} afterPatch
 * @returns {number}
 */
export function estimatePatchHistoryBytes(beforePatch, afterPatch) {
    const bBytes = Number(beforePatch?.pixels?.byteLength) || 0;
    const aBytes = Number(afterPatch?.pixels?.byteLength) || 0;
    return bBytes + aBytes + RASTER_PATCH_BASE_METADATA_BYTES;
}
