/**
 * Layer Transform Canvas overlay用pure geometry。
 * Transform / History / saveの正本を持たず、既存transform-mathのmatrixから
 * source bounds四隅、screen上のaffordance、scale比、rotation差分だけを導出する。
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

/** runtime content bounds中央をCanvas正規化Anchorへ変換する。Canvas外boundsもclampしない。 */
export function resolveTransformContentCenterAnchor(bounds, frameSize = {}) {
    const normalized = normalizeTransformOverlayBounds(bounds);
    const width = Number(frameSize.width);
    const height = Number(frameSize.height);
    if (!normalized
        || !Number.isFinite(width)
        || !Number.isFinite(height)
        || width <= 0
        || height <= 0) return null;
    return {
        x: (normalized.x + normalized.width / 2) / width,
        y: (normalized.y + normalized.height / 2) / height
    };
}

/**
 * screen上のAnchor距離比を既存transformへ掛けるcorner Uniform Scale helper。
 * 反転符号と既存の縦横比を保ち、入力transformは変更しない。
 */
export function createUniformScaleTransformFromScreenDistance(
    transform,
    startDistance,
    currentDistance,
    options = {}
) {
    const next = { ...(transform || {}) };
    const epsilon = Math.max(0.001, Number(options.epsilon) || 1);
    const scaleEpsilon = Math.max(0.000001, Number(options.scaleEpsilon) || 0.000001);
    const start = Number(startDistance);
    const current = Number(currentDistance);
    if (!Number.isFinite(start) || !Number.isFinite(current) || start < epsilon || current < 0) {
        return next;
    }

    const startScaleX = Number.isFinite(next.scaleX) && Math.abs(next.scaleX) >= scaleEpsilon
        ? next.scaleX
        : 1;
    const startScaleY = Number.isFinite(next.scaleY) && Math.abs(next.scaleY) >= scaleEpsilon
        ? next.scaleY
        : 1;
    const minScale = Math.max(scaleEpsilon, Number(options.minScale) || 0.1);
    const maxScale = Math.max(minScale, Number(options.maxScale) || 30);
    const minMagnitude = Math.min(Math.abs(startScaleX), Math.abs(startScaleY));
    const maxMagnitude = Math.max(Math.abs(startScaleX), Math.abs(startScaleY));
    const minRatio = minScale / minMagnitude;
    const maxRatio = maxScale / maxMagnitude;
    if (!Number.isFinite(minRatio) || !Number.isFinite(maxRatio) || minRatio > maxRatio) {
        return next;
    }

    const direction = Number(options.direction) < 0 ? -1 : 1;
    const ratio = direction * Math.max(minRatio, Math.min(maxRatio, current / start));
    next.scaleX = startScaleX * ratio;
    next.scaleY = startScaleY * ratio;
    return next;
}

/**
 * screen上の斜交し得るbox二軸へpointを分解する。
 * cameraや対象rotationをworldへ戻さず、gesture開始時のscreen基底を固定して扱う。
 */
export function resolveScreenBasisCoordinates(anchor, point, xAxis, yAxis) {
    if (![anchor, point, xAxis, yAxis].every(finitePoint)) return null;
    const determinant = xAxis.x * yAxis.y - xAxis.y * yAxis.x;
    if (!Number.isFinite(determinant) || Math.abs(determinant) < 0.000001) return null;
    const dx = point.x - anchor.x;
    const dy = point.y - anchor.y;
    return {
        x: (dx * yAxis.y - dy * yAxis.x) / determinant,
        y: (xAxis.x * dy - xAxis.y * dx) / determinant
    };
}

/**
 * side midpointのscreen軸projection比をscaleXまたはscaleYだけへ適用する。
 * 他軸を保ち、Anchorを越えた時は対象軸の符号を反転する。
 * ゼロ近傍だけminScaleへ寄せ、非可逆matrixを作らない。
 */
export function createAxisScaleTransformFromScreenProjection(
    transform,
    axis,
    startProjection,
    currentProjection,
    options = {}
) {
    const next = { ...(transform || {}) };
    if (axis !== 'x' && axis !== 'y') return next;
    const start = Number(startProjection);
    const current = Number(currentProjection);
    const projectionEpsilon = Math.max(
        0.000001,
        Number(options.projectionEpsilon) || 0.000001
    );
    if (!Number.isFinite(start)
        || !Number.isFinite(current)
        || Math.abs(start) < projectionEpsilon) {
        return next;
    }

    const property = axis === 'x' ? 'scaleX' : 'scaleY';
    const scaleEpsilon = Math.max(0.000001, Number(options.scaleEpsilon) || 0.000001);
    const startScale = Number.isFinite(next[property]) && Math.abs(next[property]) >= scaleEpsilon
        ? next[property]
        : 1;
    const minScale = Math.max(scaleEpsilon, Number(options.minScale) || 0.1);
    const maxScale = Math.max(minScale, Number(options.maxScale) || 30);
    const minRatio = minScale / Math.abs(startScale);
    const maxRatio = maxScale / Math.abs(startScale);
    const rawRatio = current / start;
    const direction = rawRatio < 0 ? -1 : 1;
    const ratio = direction * Math.max(
        minRatio,
        Math.min(maxRatio, Math.abs(rawRatio))
    );
    next[property] = startScale * ratio;
    return next;
}

/** pointer角の前回値→現在値を、境界跨ぎに強い最短差分へ正規化する。 */
export function normalizeScreenAngleDelta(previousAngle, currentAngle) {
    const previous = Number(previousAngle);
    const current = Number(currentAngle);
    if (!Number.isFinite(previous) || !Number.isFinite(current)) return 0;
    let delta = current - previous;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    return delta;
}

/**
 * screen上で累積したpointer角差を既存transformのrotationへ適用する。
 * camera反転時はdirection=-1を渡し、画面上のhandleがpointerへ追従する向きを保つ。
 */
export function createRotationTransformFromScreenAngleDelta(
    transform,
    screenAngleDelta,
    options = {}
) {
    const next = { ...(transform || {}) };
    const delta = Number(screenAngleDelta);
    if (!Number.isFinite(delta)) return next;
    const direction = Number(options.direction) < 0 ? -1 : 1;
    next.rotation = (Number(next.rotation) || 0) + delta * direction;

    if (options.rotationLoop === true) {
        const minRotation = Number(options.minRotation);
        const maxRotation = Number(options.maxRotation);
        const span = maxRotation - minRotation;
        if (Number.isFinite(minRotation)
            && Number.isFinite(maxRotation)
            && Number.isFinite(span)
            && span > 0) {
            while (next.rotation > maxRotation) next.rotation -= span;
            while (next.rotation < minRotation) next.rotation += span;
        }
    }
    return next;
}

/** screen四隅からbox中心、4辺中点、外向きrotation handleを導出する。 */
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
    const sideMidpoints = corners.map((point, index) => {
        const next = corners[(index + 1) % corners.length];
        return {
            x: (point.x + next.x) / 2,
            y: (point.y + next.y) / 2
        };
    });
    const topMid = sideMidpoints[0];
    const dx = topMid.x - center.x;
    const dy = topMid.y - center.y;
    const distance = Math.hypot(dx, dy) || 1;
    const offset = Math.max(0, Number(rotationOffset) || 0);
    return {
        corners,
        center,
        topMid,
        sideMidpoints,
        rotationHandle: {
            x: topMid.x + (dx / distance) * offset,
            y: topMid.y + (dy / distance) * offset
        }
    };
}
