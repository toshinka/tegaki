/**
 * ============================================================================
 * ファイル名: system/animated-image-decoder.js
 * 責務: GIF/APNGなどのアニメーション画像BlobをフレームImageData列へ展開する
 * 依存: upng-js, browser ImageDecoder
 * 被依存: system/image-importer.js
 * 公開API: decodeAnimatedImageBlob
 * 実装状態: Phase 5 postscript
 * ============================================================================
 */

import UPNG from 'upng-js';

const MIN_ANIMATION_FRAME_COUNT = 2;

export async function decodeAnimatedImageBlob(blob) {
    if (!blob?.type) return null;

    const mime = String(blob.type).toLowerCase();
    if (mime === 'image/png' || mime === 'image/apng') {
        return decodeApngBlob(blob);
    }
    if (mime === 'image/gif') {
        return decodeGifBlob(blob);
    }
    return null;
}

async function decodeApngBlob(blob) {
    const buffer = await blob.arrayBuffer();
    const decoded = UPNG.decode(buffer);
    const frameMeta = Array.isArray(decoded?.frames) ? decoded.frames : [];
    if (frameMeta.length < MIN_ANIMATION_FRAME_COUNT) return null;

    const rgbaBuffers = UPNG.toRGBA8(decoded);
    const width = Math.max(1, Math.round(decoded.width || 1));
    const height = Math.max(1, Math.round(decoded.height || 1));
    const frames = rgbaBuffers.map((frameBuffer, index) => {
        const rgba = new Uint8ClampedArray(frameBuffer);
        return {
            imageData: new ImageData(rgba, width, height),
            delayMs: normalizeDelayMs(frameMeta[index]?.delay),
            index
        };
    });

    return {
        kind: 'apng',
        width,
        height,
        frames
    };
}

async function decodeGifBlob(blob) {
    if (typeof ImageDecoder !== 'function') return null;

    const buffer = await blob.arrayBuffer();
    const decoder = new ImageDecoder({
        data: buffer,
        type: 'image/gif'
    });

    await decoder.tracks?.ready;
    const track = decoder.tracks?.selectedTrack || null;
    const rawFrameCount = Number(track?.frameCount || 0);
    const frameCount = Number.isFinite(rawFrameCount)
        ? Math.max(0, Math.round(rawFrameCount))
        : 0;
    if (frameCount < MIN_ANIMATION_FRAME_COUNT) {
        decoder.close?.();
        return null;
    }

    const frames = [];
    let width = 0;
    let height = 0;
    for (let index = 0; index < frameCount; index++) {
        const { image } = await decoder.decode({ frameIndex: index });
        const imageData = imageToImageData(image);
        width = imageData.width;
        height = imageData.height;
        frames.push({
            imageData,
            delayMs: normalizeDelayMs((image.duration || 0) / 1000),
            index
        });
        image.close?.();
    }
    decoder.close?.();

    return {
        kind: 'gif',
        width,
        height,
        frames
    };
}

function imageToImageData(image) {
    const width = Math.max(1, Math.round(image.displayWidth || image.codedWidth || image.width || 1));
    const height = Math.max(1, Math.round(image.displayHeight || image.codedHeight || image.height || 1));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('アニメーション画像変換用Canvasを作成できません');
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(image, 0, 0, width, height);
    return ctx.getImageData(0, 0, width, height);
}

function normalizeDelayMs(value) {
    const delay = Number(value);
    if (!Number.isFinite(delay) || delay <= 0) return 100;
    return Math.max(10, Math.round(delay));
}
