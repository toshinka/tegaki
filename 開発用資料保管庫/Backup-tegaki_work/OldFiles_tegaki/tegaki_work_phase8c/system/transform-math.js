export function createCenteredTransformMatrix(transform, centerX, centerY) {
    if (Number.isFinite(transform?.anchorX)) centerX = transform.anchorX * centerX * 2;
    if (Number.isFinite(transform?.anchorY)) centerY = transform.anchorY * centerY * 2;
    const x = Number(transform?.x) || 0;
    const y = Number(transform?.y) || 0;
    const rotation = Number(transform?.rotation) || 0;
    const scaleX = Number(transform?.scaleX) || 1;
    const scaleY = Number(transform?.scaleY) || 1;
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);

    return {
        a: scaleX * cos,
        b: scaleX * sin,
        c: -scaleY * sin,
        d: scaleY * cos,
        tx: -centerX * scaleX * cos + centerY * scaleY * sin + centerX + x,
        ty: -centerX * scaleX * sin - centerY * scaleY * cos + centerY + y
    };
}

export function applyTransformMatrix(matrix, x, y) {
    return {
        x: matrix.a * x + matrix.c * y + matrix.tx,
        y: matrix.b * x + matrix.d * y + matrix.ty
    };
}

/** Project座標のaxis-aligned boundsをaffine適用後のtight integer boundsへ変換する。 */
export function calculateAffineTransformedBounds(bounds, matrix) {
    const x = Number(bounds?.x) || 0;
    const y = Number(bounds?.y) || 0;
    const width = Math.max(0, Number(bounds?.width) || 0);
    const height = Math.max(0, Number(bounds?.height) || 0);
    const safeMatrix = matrix && [
        matrix.a,
        matrix.b,
        matrix.c,
        matrix.d,
        matrix.tx,
        matrix.ty
    ].every(Number.isFinite)
        ? matrix
        : { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 };
    const corners = [
        applyTransformMatrix(safeMatrix, x, y),
        applyTransformMatrix(safeMatrix, x + width, y),
        applyTransformMatrix(safeMatrix, x + width, y + height),
        applyTransformMatrix(safeMatrix, x, y + height)
    ];
    const left = Math.floor(Math.min(...corners.map(point => point.x)));
    const top = Math.floor(Math.min(...corners.map(point => point.y)));
    const right = Math.ceil(Math.max(...corners.map(point => point.x)));
    const bottom = Math.ceil(Math.max(...corners.map(point => point.y)));
    return {
        x: left,
        y: top,
        width: Math.max(1, right - left),
        height: Math.max(1, bottom - top)
    };
}

export function createAffineTransformMatrix(transform = {}) {
    const x = Number(transform.x) || 0;
    const y = Number(transform.y) || 0;
    const rotation = Number(transform.rotation) || 0;
    const scaleX = Number.isFinite(transform.scaleX) ? transform.scaleX : 1;
    const scaleY = Number.isFinite(transform.scaleY) ? transform.scaleY : 1;
    const pivotX = Number(transform.pivotX) || 0;
    const pivotY = Number(transform.pivotY) || 0;
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    const a = scaleX * cos;
    const b = scaleX * sin;
    const c = -scaleY * sin;
    const d = scaleY * cos;
    return {
        a,
        b,
        c,
        d,
        tx: x + pivotX - a * pivotX - c * pivotY,
        ty: y + pivotY - b * pivotX - d * pivotY
    };
}

/** parentとlocalのaffineを合成し、local pointをworldへ写すmatrixを返す。 */
export function multiplyTransformMatrices(parent, local) {
    return {
        a: parent.a * local.a + parent.c * local.b,
        b: parent.b * local.a + parent.d * local.b,
        c: parent.a * local.c + parent.c * local.d,
        d: parent.b * local.c + parent.d * local.d,
        tx: parent.a * local.tx + parent.c * local.ty + parent.tx,
        ty: parent.b * local.tx + parent.d * local.ty + parent.ty
    };
}

/** affine matrix全体を反転する。非可逆matrixはnullを返し、呼出側でfallbackする。 */
export function invertTransformMatrix(matrix) {
    const determinant = matrix.a * matrix.d - matrix.b * matrix.c;
    if (!Number.isFinite(determinant) || Math.abs(determinant) < 1e-8) return null;
    const inverseDeterminant = 1 / determinant;
    const a = matrix.d * inverseDeterminant;
    const b = -matrix.b * inverseDeterminant;
    const c = -matrix.c * inverseDeterminant;
    const d = matrix.a * inverseDeterminant;
    return {
        a,
        b,
        c,
        d,
        tx: -(a * matrix.tx + c * matrix.ty),
        ty: -(b * matrix.tx + d * matrix.ty)
    };
}

export function invertTransformMatrixPoint(matrix, x, y) {
    const determinant = matrix.a * matrix.d - matrix.b * matrix.c;
    if (Math.abs(determinant) < 1e-8) return null;
    const dx = x - matrix.tx;
    const dy = y - matrix.ty;
    return {
        x: (matrix.d * dx - matrix.c * dy) / determinant,
        y: (-matrix.b * dx + matrix.a * dy) / determinant
    };
}

/** anchor変更前後で同じ表示matrixを維持するようtranslationを補正する。 */
export function rebaseTransformAnchor(transform, anchorX, anchorY, width, height) {
    const previousAnchorX = Number.isFinite(transform?.anchorX) ? transform.anchorX : 0.5;
    const previousAnchorY = Number.isFinite(transform?.anchorY) ? transform.anchorY : 0.5;
    const oldPivotX = previousAnchorX * width;
    const oldPivotY = previousAnchorY * height;
    const newPivotX = anchorX * width;
    const newPivotY = anchorY * height;
    const rotation = Number(transform?.rotation) || 0;
    const scaleX = Number.isFinite(transform?.scaleX) ? transform.scaleX : 1;
    const scaleY = Number.isFinite(transform?.scaleY) ? transform.scaleY : 1;
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    const dx = oldPivotX - newPivotX;
    const dy = oldPivotY - newPivotY;
    const matrixDx = scaleX * cos * dx - scaleY * sin * dy;
    const matrixDy = scaleX * sin * dx + scaleY * cos * dy;
    return {
        ...transform,
        x: (Number(transform?.x) || 0) + dx - matrixDx,
        y: (Number(transform?.y) || 0) + dy - matrixDy,
        anchorX,
        anchorY
    };
}

/** Shift+dragの主方向をV変形とClip Motionで共用する。 */
export function resolveDirectionalTransformDragMode(start, current, threshold = 1) {
    const dx = (Number(current?.x) || 0) - (Number(start?.x) || 0);
    const dy = (Number(current?.y) || 0) - (Number(start?.y) || 0);
    if (Math.max(Math.abs(dx), Math.abs(dy)) < threshold) return null;
    return Math.abs(dy) >= Math.abs(dx) ? 'scale' : 'rotate';
}

/** 横drag=回転、縦drag=等倍拡縮。入力transformは変更しない。 */
export function applyDirectionalTransformDrag(transform, dx, dy, mode, options = {}) {
    const next = { ...transform };
    if (mode === 'rotate') {
        next.rotation = (Number(next.rotation) || 0) + dx * (options.rotationSpeed ?? 0.02);
        return next;
    }
    if (mode !== 'scale') return next;

    const minScale = options.minScale ?? 0.1;
    const maxScale = options.maxScale ?? 30;
    const factor = Math.max(0.01, 1 - dy * (options.scaleSpeed ?? 0.01));
    const scale = value => {
        const current = Number.isFinite(value) ? value : 1;
        const sign = current < 0 ? -1 : 1;
        return sign * Math.max(minScale, Math.min(maxScale, Math.abs(current) * factor));
    };
    next.scaleX = scale(next.scaleX);
    next.scaleY = scale(next.scaleY);
    return next;
}
