/**
 * ============================================================================
 * ファイル名: system/animation/raster-pixel-codec.js
 * 責務: Project JSON内のRGBA画素列を後方互換付きで軽量化する
 * 依存: なし
 * 被依存: animation-data-model.js, project-manager.js
 * 公開API: encodeRasterPixelsBase64, decodeRasterPixels, serializeRasterPixels
 *
 * 注意:
 * - Runtime / Historyの正本はUint8ClampedArrayのまま維持する。
 * - base64はProject JSON境界だけで使い、描画・Motion・WARP正本にしない。
 * - pixelEncoding未指定の旧Array / TypedArray Projectもそのまま読み込む。
 * ============================================================================
 */

export const RASTER_PIXEL_ENCODING_BASE64 = 'base64';

function toByteView(pixels) {
    if (!pixels || typeof pixels.length !== 'number') return null;
    if (pixels instanceof Uint8Array) {
        return new Uint8Array(pixels.buffer, pixels.byteOffset, pixels.byteLength);
    }
    return Uint8Array.from(pixels);
}

export function encodeRasterPixelsBase64(pixels) {
    const bytes = toByteView(pixels);
    if (!bytes) return pixels ?? null;
    if (bytes.length === 0) return '';

    let binary = '';
    const chunkSize = 0x8000;
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
    }
    return globalThis.btoa(binary);
}

export function decodeRasterPixels(pixels, pixelEncoding = null) {
    if (pixelEncoding !== RASTER_PIXEL_ENCODING_BASE64) return pixels ?? null;
    if (typeof pixels !== 'string') return null;
    if (pixels.length === 0) return new Uint8ClampedArray(0);

    const binary = globalThis.atob(pixels);
    const decoded = new Uint8ClampedArray(binary.length);
    for (let index = 0; index < binary.length; index++) {
        decoded[index] = binary.charCodeAt(index);
    }
    return decoded;
}

export function serializeRasterPixels(pixels, pixelEncoding = null) {
    if (pixelEncoding === RASTER_PIXEL_ENCODING_BASE64) {
        return {
            pixels: encodeRasterPixelsBase64(pixels),
            pixelEncoding: RASTER_PIXEL_ENCODING_BASE64
        };
    }
    return {
        pixels: pixels && typeof pixels.length === 'number' ? Array.from(pixels) : pixels,
        pixelEncoding: null
    };
}
