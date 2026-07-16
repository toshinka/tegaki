import {
    CONTROL_MESH_MAX_POINTS,
    CONTROL_MESH_MIN_POINTS,
    createFreeControlMesh,
    createRectControlMeshPreset,
    normalizeControlMeshGridDimensions
} from './control-mesh-topology.js';

/**
 * 自由点Control Meshの保存・sampling契約。
 * 固定16点Warp Grid v1とは別schemaで、相互の暗黙変換を行わない。
 */
export const CONTROL_MESH_TYPE = 'control-mesh';
export const CONTROL_MESH_VERSION = 1;

function finiteOr(value, fallback) {
    return Number.isFinite(value) ? value : fallback;
}

function normalizeInterpolation(value) {
    return value === 'hold' ? 'hold' : 'linear';
}

function normalizeBounds(bounds) {
    if (!bounds || typeof bounds !== 'object') return null;
    const width = Number(bounds.width);
    const height = Number(bounds.height);
    if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
        return null;
    }
    return {
        x: finiteOr(bounds.x, 0),
        y: finiteOr(bounds.y, 0),
        width,
        height
    };
}

function clonePoints(points, expectedLength = null) {
    if (!Array.isArray(points)
        || points.length < CONTROL_MESH_MIN_POINTS
        || points.length > CONTROL_MESH_MAX_POINTS
        || (expectedLength !== null && points.length !== expectedLength)
        || points.some(point => !Number.isFinite(point?.x) || !Number.isFinite(point?.y))) {
        return null;
    }
    return points.map(point => ({ x: point.x, y: point.y }));
}

function cloneTriangles(triangles, points) {
    const pointCount = points.length;
    if (!Array.isArray(triangles) || triangles.length === 0) return null;
    const result = [];
    const seen = new Set();
    const referenced = new Set();
    for (const triangle of triangles) {
        if (!Array.isArray(triangle) || triangle.length !== 3) return null;
        const indices = triangle.map(Number);
        if (indices.some(index => !Number.isInteger(index) || index < 0 || index >= pointCount)
            || new Set(indices).size !== 3) {
            return null;
        }
        const key = [...indices].sort((left, right) => left - right).join(':');
        if (seen.has(key)) return null;
        const [first, second, third] = indices.map(index => points[index]);
        const areaDouble = (second.x - first.x) * (third.y - first.y)
            - (second.y - first.y) * (third.x - first.x);
        if (Math.abs(areaDouble) <= 1e-12) return null;
        seen.add(key);
        indices.forEach(index => referenced.add(index));
        result.push(indices);
    }
    return referenced.size === pointCount ? result : null;
}

function normalizeGridMetadata(columns, rows, pointCount) {
    if (columns === null || columns === undefined || rows === null || rows === undefined) {
        return { columns: null, rows: null };
    }
    const dimensions = normalizeControlMeshGridDimensions(columns, rows);
    return dimensions?.pointCount === pointCount
        ? { columns: dimensions.columns, rows: dimensions.rows }
        : null;
}

/**
 * Schema:
 * { type:'control-mesh', version:1, columns?:number|null, rows?:number|null,
 *   bindBounds, bindPoints, triangles, points,
 *   keyframes:[{ frame, interpolation:'hold'|'linear', points }] }
 */
export function normalizeControlMeshDeformer(value) {
    if (!value || typeof value !== 'object' || value.type !== CONTROL_MESH_TYPE) return null;
    if (value.version !== undefined && value.version !== CONTROL_MESH_VERSION) return null;

    const bindPoints = clonePoints(value.bindPoints);
    if (!bindPoints) return null;
    const triangles = cloneTriangles(value.triangles, bindPoints);
    if (!triangles) return null;
    const grid = normalizeGridMetadata(value.columns, value.rows, bindPoints.length);
    if (!grid) return null;
    const points = clonePoints(value.points ?? bindPoints, bindPoints.length);
    if (!points) return null;
    const keyframes = (Array.isArray(value.keyframes) ? value.keyframes : [])
        .filter(key => key && Number.isInteger(key.frame))
        .map(key => {
            const keyPoints = clonePoints(key.points, bindPoints.length);
            return keyPoints ? {
                frame: key.frame,
                interpolation: normalizeInterpolation(key.interpolation),
                points: keyPoints
            } : null;
        })
        .filter(Boolean);

    return {
        type: CONTROL_MESH_TYPE,
        version: CONTROL_MESH_VERSION,
        columns: grid.columns,
        rows: grid.rows,
        bindBounds: normalizeBounds(value.bindBounds),
        bindPoints,
        triangles,
        points,
        keyframes
    };
}

/** 「列 × 行」自由入力から矩形Control Meshを作る。 */
export function createRectControlMeshDeformer(options = {}) {
    const topology = createRectControlMeshPreset(options);
    if (!topology) return null;
    return normalizeControlMeshDeformer({
        type: CONTROL_MESH_TYPE,
        version: CONTROL_MESH_VERSION,
        columns: topology.columns,
        rows: topology.rows,
        bindBounds: options.bindBounds ?? null,
        bindPoints: topology.points,
        triangles: topology.triangles,
        points: topology.points,
        keyframes: []
    });
}

/** 自由配置点からControl Meshを作り、決定的にtriangulateする。 */
export function createFreeControlMeshDeformer(options = {}) {
    const topology = createFreeControlMesh(options.points);
    if (!topology) return null;
    return normalizeControlMeshDeformer({
        type: CONTROL_MESH_TYPE,
        version: CONTROL_MESH_VERSION,
        columns: null,
        rows: null,
        bindBounds: options.bindBounds ?? null,
        bindPoints: topology.points,
        triangles: topology.triangles,
        points: topology.points,
        keyframes: []
    });
}

/** Clip範囲内keyをFrame昇順で返し、同一Frameは保存配列末尾を優先する。 */
export function listControlMeshKeyframes(value, duration = 1) {
    const deformer = normalizeControlMeshDeformer(value);
    if (!deformer) return [];
    const normalizedDuration = Math.max(1, Number.isInteger(duration) ? duration : 1);
    const byFrame = new Map();
    deformer.keyframes.forEach(key => {
        if (key.frame < 0 || key.frame >= normalizedDuration) return;
        byFrame.set(key.frame, key);
    });
    return [...byFrame.values()]
        .sort((left, right) => left.frame - right.frame)
        .map(key => ({
            frame: key.frame,
            interpolation: key.interpolation,
            points: key.points.map(point => ({ ...point }))
        }));
}

/** localFrameはClip-local 0-based Frame。左keyが補間区間を所有する。 */
export function sampleControlMeshDeformer(value, localFrame, duration = 1) {
    const deformer = normalizeControlMeshDeformer(value);
    if (!deformer) return null;
    const normalizedDuration = Math.max(1, Number.isInteger(duration) ? duration : 1);
    const frame = Number.isFinite(localFrame) ? localFrame : 0;
    const byFrame = new Map(listControlMeshKeyframes(deformer, normalizedDuration).map(key => [key.frame, key]));
    if (!byFrame.has(0)) {
        byFrame.set(0, { frame: 0, interpolation: 'linear', points: deformer.points });
    }
    if (normalizedDuration > 1 && !byFrame.has(normalizedDuration - 1)) {
        byFrame.set(normalizedDuration - 1, {
            frame: normalizedDuration - 1,
            interpolation: 'linear',
            points: deformer.points
        });
    }

    const keys = [...byFrame.values()].sort((left, right) => left.frame - right.frame);
    let sampledPoints = deformer.points.map(point => ({ ...point }));
    for (let index = 0; index < keys.length; index++) {
        const left = keys[index];
        const right = keys[index + 1];
        if (frame < left.frame) break;
        sampledPoints = left.points.map(point => ({ ...point }));
        if (!right || frame < right.frame) {
            if (!right || left.interpolation === 'hold') break;
            const ratio = Math.max(0, Math.min(1, (frame - left.frame) / (right.frame - left.frame)));
            sampledPoints = left.points.map((point, pointIndex) => ({
                x: point.x + (right.points[pointIndex].x - point.x) * ratio,
                y: point.y + (right.points[pointIndex].y - point.y) * ratio
            }));
            break;
        }
    }

    return {
        type: deformer.type,
        version: deformer.version,
        columns: deformer.columns,
        rows: deformer.rows,
        bindBounds: deformer.bindBounds ? { ...deformer.bindBounds } : null,
        bindPoints: deformer.bindPoints.map(point => ({ ...point })),
        triangles: deformer.triangles.map(triangle => [...triangle]),
        points: sampledPoints
    };
}
