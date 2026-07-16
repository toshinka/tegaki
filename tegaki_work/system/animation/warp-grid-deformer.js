/**
 * ClipInstance.deformer の固定4x4 Warp Grid契約を正規化・samplingする純粋関数群。
 * 座標はbindBoundsに対する正規化座標で、描画surfaceやDOMへ依存しない。
 */

import { createRectGridTopology } from './warp-grid-topology.js';

export const WARP_GRID_TYPE = 'warp-grid';
export const WARP_GRID_VERSION = 1;
export const WARP_GRID_COLUMNS = 4;
export const WARP_GRID_ROWS = 4;
export const WARP_GRID_POINT_COUNT = WARP_GRID_COLUMNS * WARP_GRID_ROWS;

function finiteOr(value, fallback) {
    return Number.isFinite(value) ? value : fallback;
}

function normalizeInterpolation(value) {
    return value === 'hold' ? 'hold' : 'linear';
}

function clonePoint(point, fallback) {
    return {
        x: finiteOr(point?.x, fallback.x),
        y: finiteOr(point?.y, fallback.y)
    };
}

function normalizePointArray(points, fallbackPoints) {
    return fallbackPoints.map((fallback, index) => clonePoint(points?.[index], fallback));
}

function normalizeBindBounds(bounds) {
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

export function createDefaultWarpGridPoints() {
    return createRectGridTopology({
        columns: WARP_GRID_COLUMNS,
        rows: WARP_GRID_ROWS
    }).points.map(point => ({ x: point.x, y: point.y }));
}

/**
 * Schema:
 * { type:'warp-grid', version:1, columns:4, rows:4, bindBounds?, bindPoints,
 *   points, keyframes:[{ frame, interpolation:'hold'|'linear', points }] }
 * keyframeは全16点poseを持つ。範囲外Frameと同一Frame末尾優先はsamplerで扱う。
 */
export function normalizeWarpGridDeformer(value) {
    if (!value || typeof value !== 'object' || value.type !== WARP_GRID_TYPE) return null;
    if (value.version !== undefined && value.version !== WARP_GRID_VERSION) return null;
    if ((value.columns ?? WARP_GRID_COLUMNS) !== WARP_GRID_COLUMNS
        || (value.rows ?? WARP_GRID_ROWS) !== WARP_GRID_ROWS) {
        return null;
    }

    const defaults = createDefaultWarpGridPoints();
    const bindPoints = normalizePointArray(value.bindPoints, defaults);
    const points = normalizePointArray(value.points, bindPoints);
    const keyframes = (Array.isArray(value.keyframes) ? value.keyframes : [])
        .filter(key => key && Number.isInteger(key.frame))
        .map(key => ({
            frame: key.frame,
            interpolation: normalizeInterpolation(key.interpolation),
            points: normalizePointArray(key.points, points)
        }));

    return {
        type: WARP_GRID_TYPE,
        version: WARP_GRID_VERSION,
        columns: WARP_GRID_COLUMNS,
        rows: WARP_GRID_ROWS,
        bindBounds: normalizeBindBounds(value.bindBounds),
        bindPoints,
        points,
        keyframes
    };
}

export function createWarpGridDeformer(options = {}) {
    return normalizeWarpGridDeformer({
        type: WARP_GRID_TYPE,
        version: WARP_GRID_VERSION,
        columns: WARP_GRID_COLUMNS,
        rows: WARP_GRID_ROWS,
        ...options
    });
}

/**
 * Clip範囲内の明示keyだけをFrame昇順で返す。
 * 同一Frameは保存配列の末尾を優先し、返却値は入力から独立したplain dataとする。
 */
export function listWarpGridKeyframes(value, duration = 1) {
    const deformer = normalizeWarpGridDeformer(value);
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

export function getWarpGridKeyAtFrame(value, localFrame, duration = 1) {
    const frame = Number.isInteger(localFrame) ? localFrame : Math.round(Number(localFrame));
    if (!Number.isFinite(frame)) return null;
    return listWarpGridKeyframes(value, duration).find(key => key.frame === frame) || null;
}

export function findAdjacentWarpGridKeyFrame(value, localFrame, direction, duration = 1) {
    const frame = Number.isFinite(localFrame) ? localFrame : 0;
    const keys = listWarpGridKeyframes(value, duration);
    if (direction < 0) {
        return keys.reduce((candidate, key) => (
            key.frame < frame ? key.frame : candidate
        ), null);
    }
    return keys.find(key => key.frame > frame)?.frame ?? null;
}

export function areWarpGridPointArraysEqual(left, right, epsilon = 1e-6) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
    const tolerance = Number.isFinite(epsilon) && epsilon >= 0 ? epsilon : 1e-6;
    return left.every((point, index) => (
        Number.isFinite(point?.x)
        && Number.isFinite(point?.y)
        && Number.isFinite(right[index]?.x)
        && Number.isFinite(right[index]?.y)
        && Math.abs(point.x - right[index].x) <= tolerance
        && Math.abs(point.y - right[index].y) <= tolerance
    ));
}

function pointToProject(point, bounds) {
    return {
        x: bounds.x + point.x * bounds.width,
        y: bounds.y + point.y * bounds.height
    };
}

function pointFromProject(point, bounds) {
    return {
        x: (point.x - bounds.x) / bounds.width,
        y: (point.y - bounds.y) / bounds.height
    };
}

/**
 * Bind変更時、各poseが旧Bindから持つ変形量をProject座標pxで維持する。
 * Bind自体の変更は意図どおり反映し、keyの変形量を範囲比率で伸縮させない。
 * 入力を変更せず、無効なbounds / point数ではnullを返す。
 */
export function rebaseWarpGridBind(value, options = {}) {
    const deformer = normalizeWarpGridDeformer(value);
    if (!deformer?.bindBounds) return null;

    const nextBounds = normalizeBindBounds(options.bindBounds ?? deformer.bindBounds);
    if (!nextBounds) return null;
    const nextBindPoints = normalizePointArray(options.bindPoints, deformer.bindPoints);
    if (!Array.isArray(options.bindPoints) || options.bindPoints.length !== WARP_GRID_POINT_COUNT) {
        if (options.bindPoints !== undefined) return null;
    }

    const oldBindProject = deformer.bindPoints.map(point => pointToProject(point, deformer.bindBounds));
    const nextBindProject = nextBindPoints.map(point => pointToProject(point, nextBounds));
    const rebasePose = points => points.map((point, index) => {
        const project = pointToProject(point, deformer.bindBounds);
        return pointFromProject({
            x: nextBindProject[index].x + project.x - oldBindProject[index].x,
            y: nextBindProject[index].y + project.y - oldBindProject[index].y
        }, nextBounds);
    });

    return normalizeWarpGridDeformer({
        ...deformer,
        bindBounds: nextBounds,
        bindPoints: nextBindPoints,
        points: rebasePose(deformer.points),
        keyframes: deformer.keyframes.map(key => ({
            ...key,
            points: rebasePose(key.points)
        }))
    });
}

/**
 * localFrameはClip-local 0-based Frame。
 * 範囲外keyは無視し、同一Frameは配列末尾を優先する。
 * static pointsを暗黙の始点・終点とし、補間区間は左keyが所有する。
 */
export function sampleWarpGridDeformer(value, localFrame, duration = 1) {
    const deformer = normalizeWarpGridDeformer(value);
    if (!deformer) return null;

    const normalizedDuration = Math.max(1, Number.isInteger(duration) ? duration : 1);
    const frame = Number.isFinite(localFrame) ? localFrame : 0;
    const byFrame = new Map();
    deformer.keyframes.forEach(key => {
        if (key.frame < 0 || key.frame >= normalizedDuration) return;
        byFrame.set(key.frame, key);
    });
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
        points: sampledPoints
    };
}
