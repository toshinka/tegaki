export function createCenteredTransformMatrix(transform, centerX, centerY) {
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
