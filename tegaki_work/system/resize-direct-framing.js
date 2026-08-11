const finiteNumber = (value, fallback = 0) => (
    Number.isFinite(Number(value)) ? Number(value) : fallback
);

const positiveNumber = (value, fallback = 1) => Math.max(
    0.0001,
    finiteNumber(value, fallback)
);

export function resolveResizeContentTransform(sourceBounds, targetSize, options = {}) {
    const sourceWidth = positiveNumber(sourceBounds?.width);
    const sourceHeight = positiveNumber(sourceBounds?.height);
    const targetWidth = positiveNumber(targetSize?.width);
    const targetHeight = positiveNumber(targetSize?.height);
    const frameWidth = positiveNumber(options.frameSize?.width, targetWidth);
    const frameHeight = positiveNumber(options.frameSize?.height, targetHeight);
    const widthScale = targetWidth / sourceWidth;
    const heightScale = targetHeight / sourceHeight;
    const fitMode = options.fitMode || 'fit';
    let scale = Math.min(widthScale, heightScale);
    if (fitMode === 'width') scale = widthScale;
    else if (fitMode === 'height') scale = heightScale;
    else if (fitMode === 'cover') scale = Math.max(widthScale, heightScale);
    scale = Math.max(0.01, Math.min(100, scale));

    const width = sourceWidth * scale;
    const height = sourceHeight * scale;
    const horizontal = options.horizontalAlign || 'center';
    const vertical = options.verticalAlign || 'center';
    const alignedX = horizontal === 'left'
        ? 0
        : horizontal === 'right'
            ? frameWidth - width
            : (frameWidth - width) / 2;
    const alignedY = vertical === 'top'
        ? 0
        : vertical === 'bottom'
            ? frameHeight - height
            : (frameHeight - height) / 2;

    return {
        x: alignedX + finiteNumber(options.offsetX),
        y: alignedY + finiteNumber(options.offsetY),
        width,
        height,
        scale
    };
}

export function resolveResizePreviewDragOffset(startOffset, previewDelta, previewScale) {
    const scale = positiveNumber(previewScale);
    return {
        x: finiteNumber(startOffset?.x) + (finiteNumber(previewDelta?.x) / scale),
        y: finiteNumber(startOffset?.y) + (finiteNumber(previewDelta?.y) / scale)
    };
}

export function resolveResizeWheelScalePercent(currentPercent, deltaY, options = {}) {
    const min = finiteNumber(options.min, 5);
    const max = Math.max(min, finiteNumber(options.max, 800));
    const step = positiveNumber(options.step, 5);
    const current = finiteNumber(currentPercent, 100);
    const direction = Math.sign(finiteNumber(deltaY));
    if (direction === 0) return Math.max(min, Math.min(max, current));
    return Math.max(min, Math.min(max, current - (direction * step)));
}
