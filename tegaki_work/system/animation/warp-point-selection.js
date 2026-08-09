/**
 * WARP SELECTのruntime算術だけを保持するpure helper。
 * selectionはAnimationTablePopupの一時UI状態であり、deformer / keyframe / Historyへ保存しない。
 * screen矩形の判定とpose pointのProject delta移動を分離し、固定4×4とControl Meshで共有する。
 */
const POINT_EPSILON = 1e-9;

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
