/**
 * Layer Transformのread-only Canvas overlay用pure geometry。
 * Transform / History / saveの正本を持たず、既存transform-mathのmatrixから
 * source bounds四隅とscreen上のrotation affordanceだけを導出する。
 */

import {
    applyTransformMatrix,
    createCenteredTransformMatrix
} from './transform-math.js';

function finitePoint(point) {
    return point
        && Number.isFinite(point.x)
        && Number.isFinite(point.y);
}

export function normalizeTransformOverlayBounds(bounds) {
    if (!bounds || typeof bounds !== 'object') return null;
    const x = Number(bounds.x);
    const y = Number(bounds.y);
    const width = Number(bounds.width);
    const height = Number(bounds.height);
    if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) {
        return null;
    }
    return { x, y, width, height };
}

/** Project座標のsource boundsを現行V transformで変形した四隅へ写す。 */
export function createTransformBoundsWorldCorners(bounds, transform, frameSize = {}) {
    const normalized = normalizeTransformOverlayBounds(bounds);
    if (!normalized) return [];
    const frameWidth = Math.max(1, Number(frameSize.width) || 1);
    const frameHeight = Math.max(1, Number(frameSize.height) || 1);
    const matrix = createCenteredTransformMatrix(
        transform || {},
        frameWidth / 2,
        frameHeight / 2
    );
    return [
        { x: normalized.x, y: normalized.y },
        { x: normalized.x + normalized.width, y: normalized.y },
        { x: normalized.x + normalized.width, y: normalized.y + normalized.height },
        { x: normalized.x, y: normalized.y + normalized.height }
    ].map(point => applyTransformMatrix(matrix, point.x, point.y));
}

/** screen四隅からbox中心、上辺中点、外向きrotation handleを導出する。 */
export function createTransformOverlayScreenGeometry(screenCorners, rotationOffset = 28) {
    if (!Array.isArray(screenCorners)
        || screenCorners.length !== 4
        || screenCorners.some(point => !finitePoint(point))) {
        return null;
    }
    const corners = screenCorners.map(point => ({ x: point.x, y: point.y }));
    const center = {
        x: corners.reduce((sum, point) => sum + point.x, 0) / 4,
        y: corners.reduce((sum, point) => sum + point.y, 0) / 4
    };
    const topMid = {
        x: (corners[0].x + corners[1].x) / 2,
        y: (corners[0].y + corners[1].y) / 2
    };
    const dx = topMid.x - center.x;
    const dy = topMid.y - center.y;
    const distance = Math.hypot(dx, dy) || 1;
    const offset = Math.max(0, Number(rotationOffset) || 0);
    return {
        corners,
        center,
        topMid,
        rotationHandle: {
            x: topMid.x + (dx / distance) * offset,
            y: topMid.y + (dy / distance) * offset
        }
    };
}
