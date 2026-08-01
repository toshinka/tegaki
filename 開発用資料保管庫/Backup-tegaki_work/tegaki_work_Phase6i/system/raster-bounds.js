/**
 * ============================================================================
 * ファイル名: system/raster-bounds.js
 * 責務: Raster snapshotのproject座標上の保持範囲を正規化・複製する
 * 依存: なし
 * 被依存: data-models.js, layer-system.js, animation-data-model.js
 * 公開API: normalizeRasterBounds, cloneRasterBounds, normalizeRasterSnapshot
 * 実装状態: Phase 5p Slice 1
 * ============================================================================
 */

function finiteNumberOr(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
}

function positiveIntegerOr(value, fallback) {
    const number = Math.round(finiteNumberOr(value, fallback));
    return Math.max(1, number);
}

export function normalizeRasterBounds(bounds = null, fallback = {}) {
    const fallbackWidth = positiveIntegerOr(fallback.width, 1);
    const fallbackHeight = positiveIntegerOr(fallback.height, 1);
    const source = bounds && typeof bounds === 'object' ? bounds : {};

    return {
        x: Math.round(finiteNumberOr(source.x, finiteNumberOr(fallback.x, 0))),
        y: Math.round(finiteNumberOr(source.y, finiteNumberOr(fallback.y, 0))),
        width: positiveIntegerOr(source.width, fallbackWidth),
        height: positiveIntegerOr(source.height, fallbackHeight)
    };
}

export function cloneRasterBounds(bounds = null, fallback = {}) {
    return normalizeRasterBounds(bounds, fallback);
}

export function createDefaultRasterBounds(width, height) {
    return normalizeRasterBounds(null, { x: 0, y: 0, width, height });
}

export function translateRasterBounds(bounds = null, dx = 0, dy = 0, fallback = {}) {
    const normalized = normalizeRasterBounds(bounds, fallback);
    return {
        ...normalized,
        x: normalized.x + Math.round(finiteNumberOr(dx, 0)),
        y: normalized.y + Math.round(finiteNumberOr(dy, 0))
    };
}

export function resolveCanvasResizeOffset(oldSize, newSize, alignment = 'center') {
    const difference = Math.round(finiteNumberOr(newSize, 1))
        - Math.round(finiteNumberOr(oldSize, 1));
    if (alignment === 'right' || alignment === 'bottom') return difference;
    if (alignment === 'center') return Math.trunc(difference / 2);
    return 0;
}

export function rebaseNormalizedAnchorForCanvasResize(oldSize, newSize, anchor, offset) {
    const sourceSize = Math.max(1, Math.round(finiteNumberOr(oldSize, 1)));
    const targetSize = Math.max(1, Math.round(finiteNumberOr(newSize, 1)));
    const normalizedAnchor = finiteNumberOr(anchor, 0.5);
    return ((sourceSize * normalizedAnchor) + Math.round(finiteNumberOr(offset, 0))) / targetSize;
}

export function normalizeRasterSnapshot(snapshot = null, fallback = {}) {
    if (!snapshot || typeof snapshot !== 'object') return null;

    const width = positiveIntegerOr(
        snapshot.width,
        snapshot.rasterBounds?.width ?? fallback.width ?? 1
    );
    const height = positiveIntegerOr(
        snapshot.height,
        snapshot.rasterBounds?.height ?? fallback.height ?? 1
    );
    const rasterBounds = normalizeRasterBounds(snapshot.rasterBounds, {
        x: fallback.x ?? 0,
        y: fallback.y ?? 0,
        width,
        height
    });

    return {
        ...snapshot,
        width,
        height,
        rasterBounds: {
            ...rasterBounds,
            width,
            height
        }
    };
}

export function rasterBoundsEqual(a, b) {
    if (!a || !b) return false;
    return a.x === b.x
        && a.y === b.y
        && a.width === b.width
        && a.height === b.height;
}

export function rasterBoundsExtendsProjectFrame(bounds = null, projectFrame = {}) {
    const normalized = normalizeRasterBounds(bounds, {
        x: 0,
        y: 0,
        width: projectFrame.width ?? 1,
        height: projectFrame.height ?? 1
    });
    const frame = normalizeRasterBounds(projectFrame, {
        x: 0,
        y: 0,
        width: normalized.width,
        height: normalized.height
    });

    return normalized.x < frame.x
        || normalized.y < frame.y
        || normalized.x + normalized.width > frame.x + frame.width
        || normalized.y + normalized.height > frame.y + frame.height;
}

export function unionRasterBounds(boundsList = []) {
    const normalized = (Array.isArray(boundsList) ? boundsList : [])
        .filter(bounds => bounds && typeof bounds === 'object')
        .map(bounds => normalizeRasterBounds(bounds, bounds));
    if (normalized.length === 0) return null;

    const minX = Math.min(...normalized.map(bounds => bounds.x));
    const minY = Math.min(...normalized.map(bounds => bounds.y));
    const maxX = Math.max(...normalized.map(bounds => bounds.x + bounds.width));
    const maxY = Math.max(...normalized.map(bounds => bounds.y + bounds.height));
    return {
        x: minX,
        y: minY,
        width: Math.max(1, maxX - minX),
        height: Math.max(1, maxY - minY)
    };
}

export function validateRasterSurfaceSize(bounds, options = {}) {
    if (!bounds || typeof bounds !== 'object') {
        return { ok: false, reason: 'missing-bounds', bounds: null };
    }
    const normalized = normalizeRasterBounds(bounds, bounds);
    const maxAxis = Math.max(1, Math.round(Number(options.maxAxis) || 8192));
    const maxPixels = Math.max(1, Math.round(Number(options.maxPixels) || (16 * 1024 * 1024)));
    const pixelCount = normalized.width * normalized.height;
    if (!Number.isSafeInteger(pixelCount)) {
        return { ok: false, reason: 'unsafe-pixel-count', bounds: normalized, pixelCount };
    }
    if (normalized.width > maxAxis || normalized.height > maxAxis) {
        return { ok: false, reason: 'axis-limit', bounds: normalized, pixelCount, maxAxis, maxPixels };
    }
    if (pixelCount > maxPixels) {
        return { ok: false, reason: 'pixel-limit', bounds: normalized, pixelCount, maxAxis, maxPixels };
    }
    return { ok: true, reason: null, bounds: normalized, pixelCount, maxAxis, maxPixels };
}
