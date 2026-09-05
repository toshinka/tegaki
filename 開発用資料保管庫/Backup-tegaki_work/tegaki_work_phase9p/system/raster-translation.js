/**
 * Raster RGBA bufferの純粋な整数平行移動を扱う。
 * Layer、History、Pixi objectを所有せず、入力bufferを変更しない。
 */

const DEFAULT_EPSILON = 1e-6;

export function resolveIntegerTranslation(transform, epsilon = DEFAULT_EPSILON) {
    const x = Number(transform?.x);
    const y = Number(transform?.y);
    const rotation = Number(transform?.rotation);
    const scaleX = Number(transform?.scaleX);
    const scaleY = Number(transform?.scaleY);

    if (
        !Number.isFinite(x)
        || !Number.isFinite(y)
        || !Number.isFinite(rotation)
        || !Number.isFinite(scaleX)
        || !Number.isFinite(scaleY)
        || Math.abs(rotation) > epsilon
        || Math.abs(scaleX - 1) > epsilon
        || Math.abs(scaleY - 1) > epsilon
    ) {
        return null;
    }

    return {
        dx: Math.round(x),
        dy: Math.round(y)
    };
}

export function translateRgbaPixels(pixels, width, height, dx, dy) {
    const sourceWidth = Math.max(0, Math.trunc(width));
    const sourceHeight = Math.max(0, Math.trunc(height));
    const shiftX = Math.trunc(dx);
    const shiftY = Math.trunc(dy);
    const expectedLength = sourceWidth * sourceHeight * 4;

    if (!pixels || pixels.length !== expectedLength) {
        throw new RangeError('RGBA buffer length does not match width and height');
    }

    const result = new Uint8ClampedArray(expectedLength);
    const sourceX = Math.max(0, -shiftX);
    const targetX = Math.max(0, shiftX);
    const copyWidth = Math.min(sourceWidth - sourceX, sourceWidth - targetX);
    const sourceY = Math.max(0, -shiftY);
    const targetY = Math.max(0, shiftY);
    const copyHeight = Math.min(sourceHeight - sourceY, sourceHeight - targetY);

    if (copyWidth <= 0 || copyHeight <= 0) return result;

    for (let row = 0; row < copyHeight; row++) {
        const sourceStart = ((sourceY + row) * sourceWidth + sourceX) * 4;
        const targetStart = ((targetY + row) * sourceWidth + targetX) * 4;
        result.set(
            pixels.subarray(sourceStart, sourceStart + copyWidth * 4),
            targetStart
        );
    }

    return result;
}
