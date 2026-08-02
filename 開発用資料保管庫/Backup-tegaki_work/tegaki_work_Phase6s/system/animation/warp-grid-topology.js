/**
 * 矩形Warp Gridのrow-major topologyを生成する純粋関数群。
 * 保存schema、DOM、Pixi、Rasterへ依存せず、固定4x4と将来の可変密度Gridで共有する。
 */

export const RECT_GRID_MIN_AXIS = 2;
export const RECT_GRID_MAX_AXIS = 32;

function normalizeAxis(value) {
    return Number.isInteger(value)
        && value >= RECT_GRID_MIN_AXIS
        && value <= RECT_GRID_MAX_AXIS
        ? value
        : null;
}

export function getRectGridPointIndex(column, row, columns, rows) {
    const normalizedColumns = normalizeAxis(columns);
    const normalizedRows = normalizeAxis(rows);
    if (!normalizedColumns || !normalizedRows
        || !Number.isInteger(column) || column < 0 || column >= normalizedColumns
        || !Number.isInteger(row) || row < 0 || row >= normalizedRows) {
        return null;
    }
    return row * normalizedColumns + column;
}

export function createRectGridTopology(options = {}) {
    const columns = normalizeAxis(options.columns);
    const rows = normalizeAxis(options.rows);
    if (!columns || !rows) return null;

    const points = [];
    const edges = [];
    const triangles = [];
    for (let row = 0; row < rows; row++) {
        for (let column = 0; column < columns; column++) {
            points.push({
                index: row * columns + column,
                column,
                row,
                x: column / (columns - 1),
                y: row / (rows - 1)
            });
            if (column + 1 < columns) {
                edges.push([row * columns + column, row * columns + column + 1]);
            }
            if (row + 1 < rows) {
                edges.push([row * columns + column, (row + 1) * columns + column]);
            }
            if (column + 1 < columns && row + 1 < rows) {
                const topLeft = row * columns + column;
                const topRight = topLeft + 1;
                const bottomLeft = topLeft + columns;
                const bottomRight = bottomLeft + 1;
                triangles.push([topLeft, topRight, bottomRight]);
                triangles.push([topLeft, bottomRight, bottomLeft]);
            }
        }
    }

    // Brush smoothingや範囲選択もrenderer / DOM順に依存せず、
    // 同じGrid topologyから近傍を参照できるようにする。
    const neighbors = Array.from({ length: points.length }, () => []);
    for (const [start, end] of edges) {
        neighbors[start].push(end);
        neighbors[end].push(start);
    }
    for (const adjacentPoints of neighbors) {
        adjacentPoints.sort((left, right) => left - right);
    }

    return {
        columns,
        rows,
        pointCount: columns * rows,
        cellCount: (columns - 1) * (rows - 1),
        points,
        edges,
        neighbors,
        triangles
    };
}
