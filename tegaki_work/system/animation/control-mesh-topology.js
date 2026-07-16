import {
    createRectGridTopology,
    RECT_GRID_MAX_AXIS,
    RECT_GRID_MIN_AXIS
} from './warp-grid-topology.js';

/**
 * 任意control point Meshの純粋topology helper。
 * Warp Grid v1の保存schemaへは接続せず、将来のcontrol-mesh正本から共有する。
 */
export const CONTROL_MESH_MIN_POINTS = 3;
export const CONTROL_MESH_MAX_POINTS = 256;
export const CONTROL_MESH_GRID_MIN_AXIS = RECT_GRID_MIN_AXIS;
export const CONTROL_MESH_GRID_MAX_AXIS = RECT_GRID_MAX_AXIS;

const POINT_EPSILON = 1e-9;
const AREA_EPSILON = 1e-12;

function cloneFinitePoints(points) {
    if (!Array.isArray(points)
        || points.length < CONTROL_MESH_MIN_POINTS
        || points.length > CONTROL_MESH_MAX_POINTS
        || points.some(point => !Number.isFinite(point?.x) || !Number.isFinite(point?.y))) {
        return null;
    }
    const cloned = points.map(point => ({ x: point.x, y: point.y }));
    for (let left = 0; left < cloned.length; left++) {
        for (let right = left + 1; right < cloned.length; right++) {
            if (Math.abs(cloned[left].x - cloned[right].x) <= POINT_EPSILON
                && Math.abs(cloned[left].y - cloned[right].y) <= POINT_EPSILON) {
                return null;
            }
        }
    }
    return cloned;
}

function signedAreaDouble(a, b, c) {
    return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function createCircumcircle(a, b, c) {
    const denominator = 2 * (
        a.x * (b.y - c.y)
        + b.x * (c.y - a.y)
        + c.x * (a.y - b.y)
    );
    if (Math.abs(denominator) <= AREA_EPSILON) return null;
    const a2 = a.x * a.x + a.y * a.y;
    const b2 = b.x * b.x + b.y * b.y;
    const c2 = c.x * c.x + c.y * c.y;
    const x = (
        a2 * (b.y - c.y)
        + b2 * (c.y - a.y)
        + c2 * (a.y - b.y)
    ) / denominator;
    const y = (
        a2 * (c.x - b.x)
        + b2 * (a.x - c.x)
        + c2 * (b.x - a.x)
    ) / denominator;
    const dx = x - a.x;
    const dy = y - a.y;
    return { x, y, radiusSquared: dx * dx + dy * dy };
}

function isInsideCircumcircle(point, circle) {
    if (!circle) return false;
    const dx = point.x - circle.x;
    const dy = point.y - circle.y;
    const distanceSquared = dx * dx + dy * dy;
    const tolerance = Math.max(1, circle.radiusSquared) * POINT_EPSILON;
    return distanceSquared <= circle.radiusSquared + tolerance;
}

function canonicalTriangle(triangle, points) {
    let [a, b, c] = triangle;
    if (signedAreaDouble(points[a], points[b], points[c]) < 0) {
        [b, c] = [c, b];
    }
    const values = [a, b, c];
    const smallestSlot = values.indexOf(Math.min(...values));
    return [
        values[smallestSlot],
        values[(smallestSlot + 1) % 3],
        values[(smallestSlot + 2) % 3]
    ];
}

function compareTriangles(left, right) {
    return left[0] - right[0] || left[1] - right[1] || left[2] - right[2];
}

/**
 * Control Mesh作成UIの「列 × 行」を正規化する。
 * 正方形presetを特別扱いせず、自由入力と同じ制限を通す。
 */
export function normalizeControlMeshGridDimensions(columns, rows) {
    const normalizedColumns = Number(columns);
    const normalizedRows = Number(rows);
    if (!Number.isInteger(normalizedColumns)
        || !Number.isInteger(normalizedRows)
        || normalizedColumns < CONTROL_MESH_GRID_MIN_AXIS
        || normalizedRows < CONTROL_MESH_GRID_MIN_AXIS
        || normalizedColumns > CONTROL_MESH_GRID_MAX_AXIS
        || normalizedRows > CONTROL_MESH_GRID_MAX_AXIS
        || normalizedColumns * normalizedRows > CONTROL_MESH_MAX_POINTS) {
        return null;
    }
    return {
        columns: normalizedColumns,
        rows: normalizedRows,
        pointCount: normalizedColumns * normalizedRows
    };
}

/**
 * 矩形presetをMesh topologyとして生成する。
 * 4×8 / 8×8等は旧Warp Gridの暗黙upgradeではなく、新規Mesh作成時だけ使う。
 */
export function createRectControlMeshPreset(options = {}) {
    const dimensions = normalizeControlMeshGridDimensions(options.columns, options.rows);
    if (!dimensions) return null;
    const topology = createRectGridTopology(dimensions);
    if (!topology) return null;
    return {
        columns: dimensions.columns,
        rows: dimensions.rows,
        points: topology.points.map(point => ({ x: point.x, y: point.y })),
        triangles: topology.triangles.map(triangle => [...triangle])
    };
}

/** 任意点から新規Control Mesh topologyを作る。入力配列は変更しない。 */
export function createFreeControlMesh(points) {
    const cloned = cloneFinitePoints(points);
    if (!cloned) return null;
    const triangles = triangulateControlMeshPoints(cloned);
    if (!triangles || triangles.length === 0) return null;
    return {
        columns: null,
        rows: null,
        points: cloned,
        triangles
    };
}

/** triangle配列からoverlay用の重複しないedgeを作る。 */
export function createControlMeshEdges(triangles) {
    if (!Array.isArray(triangles)) return [];
    const edges = new Map();
    triangles.forEach(triangle => {
        if (!Array.isArray(triangle) || triangle.length !== 3) return;
        for (const [start, end] of [
            [triangle[0], triangle[1]],
            [triangle[1], triangle[2]],
            [triangle[2], triangle[0]]
        ]) {
            if (!Number.isInteger(start) || !Number.isInteger(end) || start === end) continue;
            const edge = start < end ? [start, end] : [end, start];
            edges.set(`${edge[0]}:${edge[1]}`, edge);
        }
    });
    return [...edges.values()].sort((left, right) => left[0] - right[0] || left[1] - right[1]);
}

/**
 * 任意点を決定的なDelaunay triangleへ接続する。
 * 重複・非finite・上限超過はnull、全点が一直線なら空配列を返す。
 */
export function triangulateControlMeshPoints(points) {
    const source = cloneFinitePoints(points);
    if (!source) return null;

    const sortedIndices = source.map((_, index) => index).sort((left, right) => (
        source[left].x - source[right].x
        || source[left].y - source[right].y
        || left - right
    ));
    const minX = Math.min(...source.map(point => point.x));
    const maxX = Math.max(...source.map(point => point.x));
    const minY = Math.min(...source.map(point => point.y));
    const maxY = Math.max(...source.map(point => point.y));
    const span = Math.max(maxX - minX, maxY - minY);
    if (span <= POINT_EPSILON) return [];
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const superStart = source.length;
    const workingPoints = [
        ...source,
        { x: centerX - span * 32, y: centerY - span * 16 },
        { x: centerX, y: centerY + span * 32 },
        { x: centerX + span * 32, y: centerY - span * 16 }
    ];
    let triangles = [[superStart, superStart + 1, superStart + 2]];

    for (const pointIndex of sortedIndices) {
        const point = workingPoints[pointIndex];
        const badTriangles = [];
        const edgeCounts = new Map();
        for (let index = 0; index < triangles.length; index++) {
            const triangle = triangles[index];
            const circle = createCircumcircle(
                workingPoints[triangle[0]],
                workingPoints[triangle[1]],
                workingPoints[triangle[2]]
            );
            if (!isInsideCircumcircle(point, circle)) continue;
            badTriangles.push(index);
            for (const [start, end] of [
                [triangle[0], triangle[1]],
                [triangle[1], triangle[2]],
                [triangle[2], triangle[0]]
            ]) {
                const edge = start < end ? [start, end] : [end, start];
                const key = `${edge[0]}:${edge[1]}`;
                const existing = edgeCounts.get(key);
                edgeCounts.set(key, existing
                    ? { edge, count: existing.count + 1 }
                    : { edge, count: 1 });
            }
        }
        const removed = new Set(badTriangles);
        triangles = triangles.filter((_, index) => !removed.has(index));
        const boundaryEdges = [...edgeCounts.values()]
            .filter(item => item.count === 1)
            .map(item => item.edge)
            .sort((left, right) => left[0] - right[0] || left[1] - right[1]);
        for (const [start, end] of boundaryEdges) {
            if (Math.abs(signedAreaDouble(workingPoints[start], workingPoints[end], point)) <= AREA_EPSILON) {
                continue;
            }
            triangles.push([start, end, pointIndex]);
        }
    }

    const unique = new Map();
    for (const triangle of triangles) {
        if (triangle.some(index => index >= superStart)) continue;
        if (Math.abs(signedAreaDouble(
            source[triangle[0]],
            source[triangle[1]],
            source[triangle[2]]
        )) <= AREA_EPSILON) continue;
        const canonical = canonicalTriangle(triangle, source);
        unique.set(canonical.join(':'), canonical);
    }
    return [...unique.values()].sort(compareTriangles);
}

/** 点を追加し、既存Meshを変更せず再triangulateする。 */
export function addControlMeshPoint(mesh, point) {
    if (!mesh || !Array.isArray(mesh.points)
        || !Number.isFinite(point?.x) || !Number.isFinite(point?.y)
        || mesh.points.length >= CONTROL_MESH_MAX_POINTS) {
        return null;
    }
    const points = [...mesh.points.map(item => ({ x: item.x, y: item.y })), { x: point.x, y: point.y }];
    const triangles = triangulateControlMeshPoints(points);
    return triangles ? {
        columns: null,
        rows: null,
        points,
        triangles
    } : null;
}
