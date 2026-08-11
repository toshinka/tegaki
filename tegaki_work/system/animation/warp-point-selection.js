/**
 * WARP SELECTのruntime算術だけを保持するpure helper。
 * selectionはAnimationTablePopupの一時UI状態であり、deformer / keyframe / Historyへ保存しない。
 * screen shapeの判定とpose pointのProject delta移動を分離し、固定4×4とControl Meshで共有する。
 */
const POINT_EPSILON = 1e-9;
const SCREEN_GEOMETRY_EPSILON = 1e-6;
export const WARP_POINT_SELECTION_SHAPES = Object.freeze([
    'rectangle',
    'circle',
    'polyline'
]);

function isFinitePoint(point) {
    return Number.isFinite(point?.x) && Number.isFinite(point?.y);
}

/** Screen座標の矩形を正規化するruntime helper。保存shapeには依存しない。 */
export function normalizeWarpPointSelectionRect(start, end) {
    if (!isFinitePoint(start) || !isFinitePoint(end)) return null;
    const left = Math.min(start.x, end.x);
    const top = Math.min(start.y, end.y);
    const right = Math.max(start.x, end.x);
    const bottom = Math.max(start.y, end.y);
    return {
        x: left,
        y: top,
        width: right - left,
        height: bottom - top,
        left,
        top,
        right,
        bottom
    };
}

/** Screen座標の始点を中心、終点までを半径とするcircle marquee。 */
export function normalizeWarpPointSelectionCircle(start, end) {
    if (!isFinitePoint(start) || !isFinitePoint(end)) return null;
    return {
        type: 'circle',
        cx: start.x,
        cy: start.y,
        radius: Math.hypot(end.x - start.x, end.y - start.y)
    };
}

/** pointer pathをscreen-spaceの閉じたlasso候補へ正規化する。 */
export function normalizeWarpPointSelectionPolyline(points, minDistance = 2) {
    if (!Array.isArray(points)) return null;
    const threshold = Number.isFinite(minDistance) && minDistance >= 0 ? minDistance : 2;
    const normalized = [];
    points.forEach(point => {
        if (!isFinitePoint(point)) return;
        const previous = normalized[normalized.length - 1];
        if (!previous || Math.hypot(point.x - previous.x, point.y - previous.y) >= threshold) {
            normalized.push({ x: point.x, y: point.y });
        }
    });
    return {
        type: 'polyline',
        points: normalized
    };
}

/** 矩形内にあるfinite pointのindexだけを返す。 */
export function findWarpPointIndicesInRect(points, rect) {
    if (!Array.isArray(points) || !rect
        || !Number.isFinite(rect.left) || !Number.isFinite(rect.top)
        || !Number.isFinite(rect.right) || !Number.isFinite(rect.bottom)) {
        return [];
    }
    const left = Math.min(rect.left, rect.right);
    const top = Math.min(rect.top, rect.bottom);
    const right = Math.max(rect.left, rect.right);
    const bottom = Math.max(rect.top, rect.bottom);
    return points.reduce((indices, point, index) => {
        if (isFinitePoint(point)
            && point.x >= left - POINT_EPSILON
            && point.x <= right + POINT_EPSILON
            && point.y >= top - POINT_EPSILON
            && point.y <= bottom + POINT_EPSILON) {
            indices.push(index);
        }
        return indices;
    }, []);
}

/** circle内と境界上にあるfinite pointのindexだけを返す。 */
export function findWarpPointIndicesInCircle(points, circle) {
    if (!Array.isArray(points) || circle?.type !== 'circle'
        || !Number.isFinite(circle.cx) || !Number.isFinite(circle.cy)
        || !Number.isFinite(circle.radius) || circle.radius < 0) {
        return [];
    }
    const radiusSquared = circle.radius * circle.radius;
    return points.reduce((indices, point, index) => {
        if (!isFinitePoint(point)) return indices;
        const dx = point.x - circle.cx;
        const dy = point.y - circle.cy;
        if (dx * dx + dy * dy <= radiusSquared + POINT_EPSILON) indices.push(index);
        return indices;
    }, []);
}

function isPointOnSegment(point, from, to) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const lengthSquared = dx * dx + dy * dy;
    if (lengthSquared <= POINT_EPSILON) {
        return Math.hypot(point.x - from.x, point.y - from.y) <= SCREEN_GEOMETRY_EPSILON;
    }
    const cross = (point.x - from.x) * dy - (point.y - from.y) * dx;
    if (cross * cross > SCREEN_GEOMETRY_EPSILON * SCREEN_GEOMETRY_EPSILON * lengthSquared) return false;
    const dot = (point.x - from.x) * dx + (point.y - from.y) * dy;
    const endpointTolerance = SCREEN_GEOMETRY_EPSILON * Math.sqrt(lengthSquared);
    if (dot < -endpointTolerance) return false;
    return dot <= lengthSquared + endpointTolerance;
}

function getPolygonSignedArea(points) {
    let twiceArea = 0;
    for (let index = 0; index < points.length; index++) {
        const current = points[index];
        const next = points[(index + 1) % points.length];
        twiceArea += current.x * next.y - next.x * current.y;
    }
    return twiceArea / 2;
}

function isPointInClosedPolyline(point, polygon) {
    let inside = false;
    for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
        const from = polygon[previous];
        const to = polygon[index];
        if (isPointOnSegment(point, from, to)) return true;
        if ((to.y > point.y) !== (from.y > point.y)
            && point.x < (from.x - to.x) * (point.y - to.y) / (from.y - to.y) + to.x) {
            inside = !inside;
        }
    }
    return inside;
}

/** 閉じたpolyline内と辺上にあるfinite pointのindexだけを返す。 */
export function findWarpPointIndicesInPolyline(points, polyline) {
    const polygon = Array.isArray(polyline?.points)
        ? polyline.points.filter(isFinitePoint)
        : [];
    if (!Array.isArray(points) || polyline?.type !== 'polyline'
        || polygon.length < 3 || Math.abs(getPolygonSignedArea(polygon)) <= SCREEN_GEOMETRY_EPSILON) {
        return [];
    }
    return points.reduce((indices, point, index) => {
        if (isFinitePoint(point) && isPointInClosedPolyline(point, polygon)) indices.push(index);
        return indices;
    }, []);
}

/** runtime marquee shapeを明示dispatchし、保存shapeへ暗黙変換しない。 */
export function findWarpPointIndicesInShape(points, shape) {
    if (shape?.type === 'circle') return findWarpPointIndicesInCircle(points, shape);
    if (shape?.type === 'polyline') return findWarpPointIndicesInPolyline(points, shape);
    return findWarpPointIndicesInRect(points, shape);
}

/** replace / toggleのindex集合を正規化して返す。 */
export function mergeWarpPointSelection(currentIndices, hitIndices, mode = 'replace', pointCount = Infinity) {
    const max = Number.isInteger(pointCount) && pointCount >= 0 ? pointCount : Infinity;
    const current = new Set((Array.isArray(currentIndices) || currentIndices instanceof Set
        ? [...currentIndices]
        : [])
        .filter(index => Number.isInteger(index) && index >= 0 && index < max));
    const hits = [...new Set((Array.isArray(hitIndices) ? hitIndices : [])
        .filter(index => Number.isInteger(index) && index >= 0 && index < max))];
    if (mode === 'toggle') {
        hits.forEach(index => {
            if (current.has(index)) current.delete(index);
            else current.add(index);
        });
    } else {
        current.clear();
        hits.forEach(index => current.add(index));
    }
    return [...current].sort((left, right) => left - right);
}

/** 選択pointだけへ同じ座標deltaを適用した新しいpoint列を返す。 */
export function translateWarpPointSelection(points, selectedIndices, delta) {
    if (!Array.isArray(points) || !isFinitePoint(delta)) return null;
    const selected = new Set((Array.isArray(selectedIndices) || selectedIndices instanceof Set
        ? [...selectedIndices]
        : [])
        .filter(index => Number.isInteger(index) && index >= 0 && index < points.length));
    return points.map((point, index) => {
        if (!isFinitePoint(point) || !selected.has(index)) return { ...point };
        return {
            ...point,
            x: point.x + delta.x,
            y: point.y + delta.y
        };
    });
}
