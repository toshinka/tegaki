/**
 * Rect GRIDのBind枠をProject drag deltaで変形するpure helper。
 * 点はbindBoundsに対するnormalized座標、weightはrow-major topologyだけから決める。
 * 保存、History、rebase、DOMには依存しない。
 */

export const WARP_BIND_FRAME_MODE_CORNER = 'corner';
export const WARP_BIND_FRAME_MODE_EDGE = 'edge';

function normalizeInput(options) {
    const bindPoints = options?.bindPoints;
    const bindBounds = options?.bindBounds;
    const columns = Number(options?.columns);
    const rows = Number(options?.rows);
    const handleIndex = Number(options?.handleIndex);
    const deltaX = Number(options?.delta?.x);
    const deltaY = Number(options?.delta?.y);
    const width = Number(bindBounds?.width);
    const height = Number(bindBounds?.height);
    if (!Array.isArray(bindPoints)
        || !Number.isInteger(columns)
        || !Number.isInteger(rows)
        || columns < 2
        || rows < 2
        || bindPoints.length !== columns * rows
        || bindPoints.some(point => !Number.isFinite(point?.x) || !Number.isFinite(point?.y))
        || !Number.isFinite(width)
        || width <= 0
        || !Number.isFinite(height)
        || height <= 0
        || !Number.isInteger(handleIndex)
        || handleIndex < 0
        || handleIndex > 3
        || !Number.isFinite(deltaX)
        || !Number.isFinite(deltaY)
        || ![WARP_BIND_FRAME_MODE_CORNER, WARP_BIND_FRAME_MODE_EDGE].includes(options?.mode)) {
        return null;
    }
    return {
        bindPoints,
        columns,
        rows,
        handleIndex,
        mode: options.mode,
        normalizedDelta: {
            x: deltaX / width,
            y: deltaY / height
        }
    };
}

function cornerWeight(handleIndex, u, v) {
    switch (handleIndex) {
        case 0: return (1 - u) * (1 - v); // top-left
        case 1: return u * (1 - v); // top-right
        case 2: return u * v; // bottom-right
        case 3: return (1 - u) * v; // bottom-left
        default: return 0;
    }
}

function edgeWeight(handleIndex, u, v) {
    switch (handleIndex) {
        case 0: return 1 - v; // top
        case 1: return u; // right
        case 2: return v; // bottom
        case 3: return 1 - u; // left
        default: return 0;
    }
}

/**
 * handleIndexはclockwiseでcorner=TL/TR/BR/BL、edge=TOP/RIGHT/BOTTOM/LEFT。
 * Project deltaを各点のtopology weightで配り、normalized点列を新しく返す。
 */
export function transformWarpBindFramePoints(options = {}) {
    const input = normalizeInput(options);
    if (!input) return null;

    return input.bindPoints.map((point, index) => {
        const column = index % input.columns;
        const row = Math.floor(index / input.columns);
        const u = column / (input.columns - 1);
        const v = row / (input.rows - 1);
        const weight = input.mode === WARP_BIND_FRAME_MODE_CORNER
            ? cornerWeight(input.handleIndex, u, v)
            : edgeWeight(input.handleIndex, u, v);
        return {
            x: point.x + input.normalizedDelta.x * weight,
            y: point.y + input.normalizedDelta.y * weight
        };
    });
}
