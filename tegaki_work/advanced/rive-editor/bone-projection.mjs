/**
 * ROLE: Native End bone の借用行列を数値へコピーし、canvas/CSS空間へ投影する。
 * AUTHORITY: 表示投影だけを担当する。PNG頂点、source、Project、Historyは所有しない。
 * INVARIANTS: -90..90°、native行列はコピーして借用objectをdeleteしない、CSS縮小を逆投影する。
 * RELATED: runtime.js、bone-editor.js、WP-032、rive_advanced.mjs.d.ts。
 */

export const BONE_NAME = 'End';
export const MIN_BONE_ANGLE = -90;
export const MAX_BONE_ANGLE = 90;

function finite(value) {
    return Number.isFinite(Number(value));
}

function rounded(value, digits = 6) {
    return Number(Number(value).toFixed(digits));
}

export function clampBoneAngle(value, min = MIN_BONE_ANGLE, max = MAX_BONE_ANGLE) {
    const number = Number(value);
    if (!Number.isFinite(number)) return null;
    return rounded(Math.max(min, Math.min(max, number)), 3);
}

export function normalizeAngle(value) {
    if (!Number.isFinite(Number(value))) return null;
    let angle = Number(value);
    while (angle > 180) angle -= 360;
    while (angle <= -180) angle += 360;
    return rounded(angle, 6);
}

/** Copy a native Mat2D without taking ownership of or deleting the native object. */
export function copyMatrix(matrix) {
    if (!matrix || !['xx', 'xy', 'yx', 'yy', 'tx', 'ty'].every(key => finite(matrix[key]))) return null;
    return {
        xx: rounded(matrix.xx),
        xy: rounded(matrix.xy),
        yx: rounded(matrix.yx),
        yy: rounded(matrix.yy),
        tx: rounded(matrix.tx),
        ty: rounded(matrix.ty),
    };
}

export function identityMatrix() {
    return { xx: 1, xy: 0, yx: 0, yy: 1, tx: 0, ty: 0 };
}

export function transformPoint(matrix, point) {
    if (!matrix || !point || !finite(point.x) || !finite(point.y)) return null;
    return {
        x: rounded(matrix.xx * Number(point.x) + matrix.yx * Number(point.y) + matrix.tx),
        y: rounded(matrix.xy * Number(point.x) + matrix.yy * Number(point.y) + matrix.ty),
    };
}

export function invertMatrix(matrix) {
    if (!matrix) return null;
    const determinant = matrix.xx * matrix.yy - matrix.yx * matrix.xy;
    if (!Number.isFinite(determinant) || Math.abs(determinant) < 1e-9) return null;
    return {
        xx: rounded(matrix.yy / determinant),
        xy: rounded(-matrix.xy / determinant),
        yx: rounded(-matrix.yx / determinant),
        yy: rounded(matrix.xx / determinant),
        tx: rounded((matrix.yx * matrix.ty - matrix.yy * matrix.tx) / determinant),
        ty: rounded((matrix.xy * matrix.tx - matrix.xx * matrix.ty) / determinant),
    };
}

export function matrixAngle(matrix) {
    if (!matrix || !finite(matrix.xx) || !finite(matrix.xy)) return null;
    return normalizeAngle(Math.atan2(matrix.xy, matrix.xx) * 180 / Math.PI);
}

function rectSize(rect, fallbackWidth, fallbackHeight) {
    const width = Number(rect?.width || fallbackWidth);
    const height = Number(rect?.height || fallbackHeight);
    return {
        width: width > 0 ? width : fallbackWidth,
        height: height > 0 ? height : fallbackHeight,
        left: Number(rect?.left || 0),
        top: Number(rect?.top || 0),
    };
}

export function canvasPointToScreen(point, canvasWidth, canvasHeight, rect) {
    const size = rectSize(rect, canvasWidth, canvasHeight);
    return {
        x: rounded(size.left + Number(point.x) * size.width / canvasWidth),
        y: rounded(size.top + Number(point.y) * size.height / canvasHeight),
    };
}

export function screenPointToCanvas(point, canvasWidth, canvasHeight, rect) {
    const size = rectSize(rect, canvasWidth, canvasHeight);
    return {
        x: rounded((Number(point.x) - size.left) * canvasWidth / size.width),
        y: rounded((Number(point.y) - size.top) * canvasHeight / size.height),
    };
}

function screenPointToLocal(point, rect) {
    const size = rectSize(rect, rect?.width || 1, rect?.height || 1);
    return { x: rounded(Number(point.x) - size.left), y: rounded(Number(point.y) - size.top) };
}

export function createBoneProjection({
    alignment,
    boneMatrix,
    parentMatrix = null,
    length,
    canvasWidth,
    canvasHeight,
    cssRect,
    angle = null,
}) {
    const safeAlignment = copyMatrix(alignment);
    const safeBone = copyMatrix(boneMatrix);
    const safeParent = parentMatrix ? copyMatrix(parentMatrix) : null;
    const safeLength = Number(length);
    const safeWidth = Number(canvasWidth);
    const safeHeight = Number(canvasHeight);
    if (!safeAlignment || !safeBone || !Number.isFinite(safeLength) || safeLength <= 0
        || !Number.isFinite(safeWidth) || safeWidth <= 0 || !Number.isFinite(safeHeight) || safeHeight <= 0) return null;
    const pivotArtboard = transformPoint(safeBone, { x: 0, y: 0 });
    const tipArtboard = transformPoint(safeBone, { x: safeLength, y: 0 });
    const pivotCanvas = transformPoint(safeAlignment, pivotArtboard);
    const tipCanvas = transformPoint(safeAlignment, tipArtboard);
    if (!pivotArtboard || !tipArtboard || !pivotCanvas || !tipCanvas) return null;
    const pivotScreen = canvasPointToScreen(pivotCanvas, safeWidth, safeHeight, cssRect);
    const tipScreen = canvasPointToScreen(tipCanvas, safeWidth, safeHeight, cssRect);
    const parentAngle = safeParent ? matrixAngle(safeParent) : 0;
    const worldAngle = matrixAngle(safeBone);
    const localAngle = worldAngle === null ? null : normalizeAngle(worldAngle - (parentAngle || 0));
    const size = rectSize(cssRect, safeWidth, safeHeight);
    return {
        selectedBone: BONE_NAME,
        alignment: safeAlignment,
        boneMatrix: safeBone,
        parentMatrix: safeParent,
        length: rounded(safeLength),
        canvasWidth: safeWidth,
        canvasHeight: safeHeight,
        cssRect: size,
        pivotArtboard,
        tipArtboard,
        pivotCanvas,
        tipCanvas,
        pivotScreen,
        tipScreen,
        pivotLocal: screenPointToLocal(pivotScreen, size),
        tipLocal: screenPointToLocal(tipScreen, size),
        worldAngle,
        angle: clampBoneAngle(angle ?? localAngle),
    };
}

export function angleForScreenPoint(projection, point) {
    if (!projection || !point || !finite(point.x) || !finite(point.y)) return null;
    const inverseAlignment = invertMatrix(projection.alignment);
    if (!inverseAlignment) return null;
    const canvasPoint = screenPointToCanvas(point, projection.canvasWidth, projection.canvasHeight, projection.cssRect);
    const artboardPoint = transformPoint(inverseAlignment, canvasPoint);
    if (!artboardPoint || !projection.pivotArtboard) return null;
    const worldAngle = Math.atan2(
        artboardPoint.y - projection.pivotArtboard.y,
        artboardPoint.x - projection.pivotArtboard.x,
    ) * 180 / Math.PI;
    const parentAngle = projection.parentMatrix ? matrixAngle(projection.parentMatrix) : 0;
    return clampBoneAngle(normalizeAngle(worldAngle - (parentAngle || 0)));
}

export function projectionSnapshot(projection, previewAngle = null) {
    if (!projection) return null;
    return {
        selectedBone: projection.selectedBone,
        angle: clampBoneAngle(previewAngle ?? projection.angle),
        length: projection.length,
        pivot: { ...projection.pivotScreen },
        tip: { ...projection.tipScreen },
        worldAngle: projection.worldAngle,
        canvas: { width: projection.canvasWidth, height: projection.canvasHeight },
    };
}

