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
