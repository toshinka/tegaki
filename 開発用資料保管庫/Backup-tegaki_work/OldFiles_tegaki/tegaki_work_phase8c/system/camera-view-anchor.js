/**
 * Camera view transform の pure 算術。
 * 反転前に viewport 中心下にあった Project 座標を、反転後も同じ画面座標へ固定する。
 */

const SCALE_EPSILON = 1e-9;

function normalizePoint(point, fallback = 0) {
    return {
        x: Number.isFinite(point?.x) ? point.x : fallback,
        y: Number.isFinite(point?.y) ? point.y : fallback
    };
}

function normalizeScale(scale) {
    const normalized = normalizePoint(scale, 1);
    return {
        x: Math.abs(normalized.x) > SCALE_EPSILON ? normalized.x : 1,
        y: Math.abs(normalized.y) > SCALE_EPSILON ? normalized.y : 1
    };
}

export function mapCameraStagePointToLocal(stagePoint, transform = {}) {
    const stage = normalizePoint(stagePoint);
    const position = normalizePoint(transform.position);
    const pivot = normalizePoint(transform.pivot);
    const scale = normalizeScale(transform.scale);
    const rotation = Number.isFinite(transform.rotation) ? transform.rotation : 0;
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    const deltaX = stage.x - position.x;
    const deltaY = stage.y - position.y;
    const unrotatedX = (deltaX * cos) + (deltaY * sin);
    const unrotatedY = (-deltaX * sin) + (deltaY * cos);

    return {
        x: pivot.x + (unrotatedX / scale.x),
        y: pivot.y + (unrotatedY / scale.y)
    };
}

export function resolveCameraPositionForAnchoredPoint(stagePoint, localPoint, transform = {}) {
    const stage = normalizePoint(stagePoint);
    const local = normalizePoint(localPoint);
    const pivot = normalizePoint(transform.pivot);
    const scale = normalizeScale(transform.scale);
    const rotation = Number.isFinite(transform.rotation) ? transform.rotation : 0;
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    const scaledX = (local.x - pivot.x) * scale.x;
    const scaledY = (local.y - pivot.y) * scale.y;

    return {
        x: stage.x - ((scaledX * cos) - (scaledY * sin)),
        y: stage.y - ((scaledX * sin) + (scaledY * cos))
    };
}
