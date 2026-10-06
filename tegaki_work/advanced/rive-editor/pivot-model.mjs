/**
 * ROLE: WP-038 の原PNG pixel座標による回転中心の純粋な検証と寸法移行。
 * AUTHORITY: source生成前の入力正規化だけ。保存正本、runtime評価、raw入力は所有しない。
 * INVARIANTS: undefinedだけ中央既定、number/finite/閉区間、3桁丸め、PNG置換の比率保持。
 * RELATED: model.mjs、server.mjs、pivot-editor.js、build/verify-rive-pivot-model.mjs。
 */
function assertDimensions(width, height) {
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
        throw new Error('Pivot image dimensions must be positive integers.');
    }
}

export function defaultPivot(width, height) {
    assertDimensions(width, height);
    return { x: width / 2, y: height / 2 };
}

export function assertPivot(value, width, height) {
    assertDimensions(width, height);
    if (value === undefined) return defaultPivot(width, height);
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('Pivot must be an object with finite number x/y coordinates.');
    }
    const pivot = {};
    for (const [axis, maximum] of [['x', width], ['y', height]]) {
        const coordinate = value[axis];
        if (typeof coordinate !== 'number' || !Number.isFinite(coordinate) || coordinate < 0 || coordinate > maximum) {
            throw new Error(`Pivot ${axis} must be a finite number between 0 and ${maximum}.`);
        }
        pivot[axis] = Number(coordinate.toFixed(3));
        if (pivot[axis] < 0 || pivot[axis] > maximum) {
            throw new Error(`Pivot ${axis} rounded coordinate is outside the image.`);
        }
    }
    return pivot;
}

export function scalePivot(pivot, oldWidth, oldHeight, newWidth, newHeight) {
    const current = assertPivot(pivot, oldWidth, oldHeight);
    assertDimensions(newWidth, newHeight);
    return assertPivot({ x: current.x / oldWidth * newWidth, y: current.y / oldHeight * newHeight }, newWidth, newHeight);
}
