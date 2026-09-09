/**
 * Layer WARPの現在形状から、BASIC authoring overlayだけが使うboundsを導出する。
 *
 * WARP bindBounds / pointsやRaster snapshotを変更せず、正規化された全点を
 * bindBounds上のProject座標へ展開して表示用のenvelopeを返すpure helper。
 */

const EPSILON = 1e-8;

function normalizeBounds(bounds) {
    if (!bounds || typeof bounds !== 'object') return null;
    const x = Number(bounds.x);
    const y = Number(bounds.y);
    const width = Number(bounds.width);
    const height = Number(bounds.height);
    if (![x, y, width, height].every(Number.isFinite)
        || width <= 0
        || height <= 0) {
        return null;
    }
    return { x, y, width, height };
}

function normalizePoint(point) {
    if (!point || typeof point !== 'object') return null;
    const x = Number(point.x);
    const y = Number(point.y);
    return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
}

/**
 * @returns {{x:number,y:number,width:number,height:number}|null}
 */
export function createWarpAuthoringEnvelopeBounds({
    bindBounds,
    points,
    fallbackBounds = null
} = {}) {
    const fallback = normalizeBounds(fallbackBounds);
    const bounds = normalizeBounds(bindBounds);
    if (!bounds || !Array.isArray(points) || points.length === 0) return fallback;

    const projected = points
        .map(normalizePoint)
        .filter(Boolean)
        .map(point => ({
            x: bounds.x + point.x * bounds.width,
            y: bounds.y + point.y * bounds.height
        }));
    if (projected.length !== points.length) return fallback;

    const xs = projected.map(point => point.x);
    const ys = projected.map(point => point.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const maxX = Math.max(...xs);
    const maxY = Math.max(...ys);
    if (![minX, minY, maxX, maxY].every(Number.isFinite)
        || maxX - minX <= EPSILON
        || maxY - minY <= EPSILON) {
        return fallback;
    }
    return {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY
    };
}
