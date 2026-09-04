/**
 * Warp Lens placement の純粋データ契約。
 * placement はFrame keyに属し、Bind/Poseの正本やClip Motionとは分離したまま扱う。
 */

export const IDENTITY_WARP_PLACEMENT = Object.freeze({
    x: 0,
    y: 0,
    scale: 1,
    rotation: 0
});

function finiteOr(value, fallback) {
    return Number.isFinite(value) ? value : fallback;
}

/** 欠損・無効値をidentityへ戻したplain dataを返す。 */
export function normalizeWarpPlacement(value) {
    const source = value && typeof value === 'object' ? value : {};
    const scale = Number(source.scale);
    return {
        x: finiteOr(Number(source.x), IDENTITY_WARP_PLACEMENT.x),
        y: finiteOr(Number(source.y), IDENTITY_WARP_PLACEMENT.y),
        scale: Number.isFinite(scale) && scale > 0
            ? scale
            : IDENTITY_WARP_PLACEMENT.scale,
        rotation: finiteOr(Number(source.rotation), IDENTITY_WARP_PLACEMENT.rotation)
    };
}

/** 旧Projectのplacement欠損を保存上も欠損のまま維持する。 */
export function normalizeOptionalWarpPlacement(value) {
    return value && typeof value === 'object'
        ? normalizeWarpPlacement(value)
        : null;
}

export function cloneOptionalWarpPlacement(value) {
    const placement = normalizeOptionalWarpPlacement(value);
    return placement ? { ...placement } : null;
}

/** rotationは点座標ではなく角度scalarとして補間する。 */
export function interpolateWarpPlacement(left, right, ratio) {
    const from = normalizeWarpPlacement(left);
    const to = normalizeWarpPlacement(right);
    const amount = Math.max(0, Math.min(1, finiteOr(Number(ratio), 0)));
    return {
        x: from.x + (to.x - from.x) * amount,
        y: from.y + (to.y - from.y) * amount,
        scale: from.scale + (to.scale - from.scale) * amount,
        rotation: from.rotation + (to.rotation - from.rotation) * amount
    };
}

function normalizeBounds(bounds) {
    const width = Number(bounds?.width);
    const height = Number(bounds?.height);
    if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
        return null;
    }
    return {
        x: finiteOr(Number(bounds.x), 0),
        y: finiteOr(Number(bounds.y), 0),
        width,
        height
    };
}

function cloneFinitePoints(points) {
    if (!Array.isArray(points)
        || points.length === 0
        || points.some(point => !Number.isFinite(point?.x) || !Number.isFinite(point?.y))) {
        return null;
    }
    return points.map(point => ({ x: point.x, y: point.y }));
}

function pointToProject(point, bounds) {
    return {
        x: bounds.x + point.x * bounds.width,
        y: bounds.y + point.y * bounds.height
    };
}

function pointFromProject(point, bounds) {
    return {
        x: (point.x - bounds.x) / bounds.width,
        y: (point.y - bounds.y) / bounds.height
    };
}

/**
 * Bind点のProject座標重心をpivotとして、同じplacementを任意の点配列へ適用する。
 * source Bindとdestination Poseの双方がこの関数を共有することでmaskと描画を同期する。
 */
export function applyWarpPlacementToPoints(points, bindPoints, bindBounds, value) {
    const sourcePoints = cloneFinitePoints(points);
    const pivotPoints = cloneFinitePoints(bindPoints);
    const bounds = normalizeBounds(bindBounds);
    if (!sourcePoints || !pivotPoints || !bounds) return null;

    const placement = normalizeWarpPlacement(value);
    // 旧Project / identity GRIDは座標の再計算すら行わず、edge coverageをbyte単位で維持する。
    if (placement.x === 0
        && placement.y === 0
        && placement.scale === 1
        && placement.rotation === 0) {
        return sourcePoints;
    }
    const pivot = pivotPoints
        .map(point => pointToProject(point, bounds))
        .reduce((result, point) => ({
            x: result.x + point.x / pivotPoints.length,
            y: result.y + point.y / pivotPoints.length
        }), { x: 0, y: 0 });
    const cosine = Math.cos(placement.rotation);
    const sine = Math.sin(placement.rotation);

    return sourcePoints.map(point => {
        const project = pointToProject(point, bounds);
        const offsetX = (project.x - pivot.x) * placement.scale;
        const offsetY = (project.y - pivot.y) * placement.scale;
        return pointFromProject({
            x: pivot.x + placement.x + offsetX * cosine - offsetY * sine,
            y: pivot.y + placement.y + offsetX * sine + offsetY * cosine
        }, bounds);
    });
}

/** Canvas上の配置後pointを、既存pose keyが保持する配置前の正規化座標へ戻す。 */
export function invertWarpPlacementPoint(point, bindPoints, bindBounds, value) {
    const target = cloneFinitePoints([point]);
    const pivotPoints = cloneFinitePoints(bindPoints);
    const bounds = normalizeBounds(bindBounds);
    if (!target || !pivotPoints || !bounds) return null;

    const placement = normalizeWarpPlacement(value);
    if (placement.x === 0
        && placement.y === 0
        && placement.scale === 1
        && placement.rotation === 0) {
        return target[0];
    }
    const pivot = pivotPoints
        .map(item => pointToProject(item, bounds))
        .reduce((result, item) => ({
            x: result.x + item.x / pivotPoints.length,
            y: result.y + item.y / pivotPoints.length
        }), { x: 0, y: 0 });
    const project = pointToProject(target[0], bounds);
    const translatedX = project.x - pivot.x - placement.x;
    const translatedY = project.y - pivot.y - placement.y;
    const cosine = Math.cos(placement.rotation);
    const sine = Math.sin(placement.rotation);
    return pointFromProject({
        x: pivot.x + (translatedX * cosine + translatedY * sine) / placement.scale,
        y: pivot.y + (-translatedX * sine + translatedY * cosine) / placement.scale
    }, bounds);
}

/**
 * source Bindとdestination Poseを、同じBind重心・同じplacementで解決する。
 * rendererはこのpairだけを受け取り、erase maskとdestination描画で別変換を作らない。
 */
export function resolveWarpPlacementGeometry(bindPoints, points, bindBounds, value) {
    if (!Array.isArray(bindPoints)
        || !Array.isArray(points)
        || bindPoints.length !== points.length) {
        return null;
    }
    const resolvedBindPoints = applyWarpPlacementToPoints(
        bindPoints,
        bindPoints,
        bindBounds,
        value
    );
    const resolvedPoints = applyWarpPlacementToPoints(
        points,
        bindPoints,
        bindBounds,
        value
    );
    return resolvedBindPoints && resolvedPoints
        ? { bindPoints: resolvedBindPoints, points: resolvedPoints }
        : null;
}

/** renderer adapterへ渡す、placement消費済みの一時sampleを作る。保存正本には使わない。 */
export function resolveWarpPlacementSample(sample, fallbackBounds = null) {
    if (!sample || typeof sample !== 'object') return null;
    const bindBounds = sample.bindBounds || fallbackBounds;
    const geometry = resolveWarpPlacementGeometry(
        sample.bindPoints,
        sample.points,
        bindBounds,
        sample.placement
    );
    if (!geometry) return null;
    return {
        ...sample,
        bindPoints: geometry.bindPoints,
        points: geometry.points,
        placement: { ...IDENTITY_WARP_PLACEMENT }
    };
}
