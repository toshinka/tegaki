/**
 * Warp GRID変形brushの純粋計算。
 * DOM / Clip / Historyを参照せず、gesture開始poseから決定的な次poseを返す。
 */

const EPSILON = 1e-9;

function clamp01(value, fallback = 0) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.max(0, Math.min(1, number));
}

function cloneFinitePoints(points) {
    if (!Array.isArray(points)
        || points.some(point => !Number.isFinite(point?.x) || !Number.isFinite(point?.y))) {
        return null;
    }
    return points.map(point => ({ x: point.x, y: point.y }));
}

function normalizeWeights(weights, length) {
    if (!Array.isArray(weights) || weights.length !== length) return null;
    return weights.map(weight => clamp01(weight));
}

/**
 * screen-space point列へ円形brushのweightを作る。
 * hardness=0は中心から滑らかに減衰、1はradius内を一様にする。
 */
export function calculateWarpGridBrushWeights(points, options = {}) {
    const source = cloneFinitePoints(points);
    const centerX = Number(options.center?.x);
    const centerY = Number(options.center?.y);
    const radius = Number(options.radius);
    if (!source || !Number.isFinite(centerX) || !Number.isFinite(centerY)
        || !Number.isFinite(radius) || radius <= 0) {
        return null;
    }

    const hardness = clamp01(options.hardness, 0.5);
    const innerRadius = radius * hardness;
    return source.map(point => {
        const distance = Math.hypot(point.x - centerX, point.y - centerY);
        if (distance >= radius) return 0;
        if (hardness >= 1 || distance <= innerRadius) return 1;
        const ratio = (distance - innerRadius) / Math.max(EPSILON, radius - innerRadius);
        const smoothRatio = ratio * ratio * (3 - 2 * ratio);
        return 1 - smoothRatio;
    });
}

/** gesture開始poseへProject座標deltaをweight付きで適用する。 */
export function translateWarpGridBrushPoints(points, weights, delta = {}) {
    const source = cloneFinitePoints(points);
    const normalizedWeights = source ? normalizeWeights(weights, source.length) : null;
    const deltaX = Number(delta.x);
    const deltaY = Number(delta.y);
    if (!source || !normalizedWeights || !Number.isFinite(deltaX) || !Number.isFinite(deltaY)) {
        return null;
    }
    return source.map((point, index) => ({
        x: point.x + deltaX * normalizedWeights[index],
        y: point.y + deltaY * normalizedWeights[index]
    }));
}

/** 影響点の加重重心。weight合計0なら明示fallback、なければnull。 */
export function calculateWarpGridWeightedCentroid(points, weights, fallback = null) {
    const source = cloneFinitePoints(points);
    const normalizedWeights = source ? normalizeWeights(weights, source.length) : null;
    if (!source || !normalizedWeights) return null;
    let sum = 0;
    let x = 0;
    let y = 0;
    source.forEach((point, index) => {
        const weight = normalizedWeights[index];
        sum += weight;
        x += point.x * weight;
        y += point.y * weight;
    });
    if (sum > EPSILON) return { x: x / sum, y: y / sum };
    return Number.isFinite(fallback?.x) && Number.isFinite(fallback?.y)
        ? { x: fallback.x, y: fallback.y }
        : null;
}

/**
 * pivotから外向き（amount>0）または内向き（amount<0）へProject距離を与える。
 * pivot上の点は方向を持たないため移動しない。
 */
export function inflateWarpGridBrushPoints(points, weights, options = {}) {
    const source = cloneFinitePoints(points);
    const normalizedWeights = source ? normalizeWeights(weights, source.length) : null;
    const pivotX = Number(options.pivot?.x);
    const pivotY = Number(options.pivot?.y);
    const amount = Number(options.amount);
    if (!source || !normalizedWeights || !Number.isFinite(pivotX)
        || !Number.isFinite(pivotY) || !Number.isFinite(amount)) {
        return null;
    }
    return source.map((point, index) => {
        const dx = point.x - pivotX;
        const dy = point.y - pivotY;
        const distance = Math.hypot(dx, dy);
        if (distance <= EPSILON || normalizedWeights[index] <= 0) return { ...point };
        const displacement = amount * normalizedWeights[index] / distance;
        return {
            x: point.x + dx * displacement,
            y: point.y + dy * displacement
        };
    });
}

/** topology.neighborsを使い、各点を開始poseの隣接平均へ近付ける。 */
export function smoothWarpGridBrushPoints(points, weights, neighbors, strength = 1) {
    const source = cloneFinitePoints(points);
    const normalizedWeights = source ? normalizeWeights(weights, source.length) : null;
    const normalizedStrength = clamp01(strength, 1);
    if (!source || !normalizedWeights || !Array.isArray(neighbors)
        || neighbors.length !== source.length) {
        return null;
    }
    return source.map((point, index) => {
        const adjacent = Array.isArray(neighbors[index])
            ? [...new Set(neighbors[index])].filter(neighbor => (
                Number.isInteger(neighbor) && neighbor >= 0 && neighbor < source.length && neighbor !== index
            ))
            : [];
        const ratio = normalizedWeights[index] * normalizedStrength;
        if (adjacent.length === 0 || ratio <= 0) return { ...point };
        const average = adjacent.reduce((result, neighbor) => ({
            x: result.x + source[neighbor].x,
            y: result.y + source[neighbor].y
        }), { x: 0, y: 0 });
        average.x /= adjacent.length;
        average.y /= adjacent.length;
        return {
            x: point.x + (average.x - point.x) * ratio,
            y: point.y + (average.y - point.y) * ratio
        };
    });
}
