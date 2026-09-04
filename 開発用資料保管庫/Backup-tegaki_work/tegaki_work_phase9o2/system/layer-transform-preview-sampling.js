/**
 * Layer Transform中のRaster preview samplingだけを管理するdisplay-only helper。
 * Project / Layer schema、History、確定Bakeを所有せず、session終了前に必ず元へ戻す。
 */

function getTextureStyle(layer) {
    return layer?.layerData?.renderTexture?.source?.style || null;
}

function setStyleFilters(style, values) {
    if (!style || style.destroyed === true || !values) return false;
    const changed = style.magFilter !== values.magFilter
        || style.minFilter !== values.minFilter
        || style.mipmapFilter !== values.mipmapFilter;
    if (!changed) return false;
    style.magFilter = values.magFilter;
    style.minFilter = values.minFilter;
    style.mipmapFilter = values.mipmapFilter;
    style.update?.();
    return true;
}

/** 拡大previewだけは元pixelを混ぜず、細線のdab間をぼかして欠損に見せない。 */
export function shouldUseExactPixelTransformPreview(transform, epsilon = 0.000001) {
    const scaleX = Number.isFinite(transform?.scaleX) ? Math.abs(transform.scaleX) : 1;
    const scaleY = Number.isFinite(transform?.scaleY) ? Math.abs(transform.scaleY) : 1;
    return Math.max(scaleX, scaleY) > 1 + Math.max(0, Number(epsilon) || 0);
}

export function captureLayerTransformPreviewSampling(layers = []) {
    const records = [];
    const seenStyles = new Set();
    for (const layer of Array.isArray(layers) ? layers : []) {
        const style = getTextureStyle(layer);
        if (!style || seenStyles.has(style)) continue;
        seenStyles.add(style);
        records.push({
            style,
            original: {
                magFilter: style.magFilter,
                minFilter: style.minFilter,
                mipmapFilter: style.mipmapFilter
            },
            exactPixels: false
        });
    }
    return records;
}

export function updateLayerTransformPreviewSampling(records = [], transform = {}) {
    const exactPixels = shouldUseExactPixelTransformPreview(transform);
    for (const record of Array.isArray(records) ? records : []) {
        if (!record?.style || record.exactPixels === exactPixels) continue;
        setStyleFilters(record.style, exactPixels
            ? { magFilter: 'nearest', minFilter: 'nearest', mipmapFilter: 'nearest' }
            : record.original);
        record.exactPixels = exactPixels;
    }
    return exactPixels;
}

export function restoreLayerTransformPreviewSampling(records = []) {
    for (const record of Array.isArray(records) ? records : []) {
        if (!record?.style) continue;
        setStyleFilters(record.style, record.original);
        record.exactPixels = false;
    }
}
