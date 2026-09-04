/**
 * WARP triangleの低水準代数と、Bind Project点からPose Project点への
 * pure point-mapを共有する。DOM、Timeline、History、保存正本へ依存しない。
 *
 * Rasterizerのpixel coverage（半開境界・edge ownership）はここへ持ち込まず、
 * point-mapでは保存triangle配列の先頭一致をdeterministicなtie-breakとする。
 */

import {
    applyWarpPlacementToPoints,
    resolveWarpPlacementGeometry
} from './warp-placement.js';

export const TRIANGLE_EPSILON = 1e-8;

function isFinitePoint(point) {
    return Number.isFinite(point?.x) && Number.isFinite(point?.y);
}

function normalizeBounds(value) {
    if (!value || typeof value !== 'object') return null;
    const x = value.x === undefined ? 0 : Number(value.x);
    const y = value.y === undefined ? 0 : Number(value.y);
    const width = Number(value.width);
    const height = Number(value.height);
    if (!Number.isFinite(x) || !Number.isFinite(y)
        || !Number.isFinite(width) || width <= 0
        || !Number.isFinite(height) || height <= 0) {
        return null;
    }
    return { x, y, width, height };
}

function toProjectPoint(point, bounds) {
    return {
        x: bounds.x + point.x * bounds.width,
        y: bounds.y + point.y * bounds.height
    };
}

function toNormalizedPoint(point, bounds) {
    return {
        x: (point.x - bounds.x) / bounds.width,
        y: (point.y - bounds.y) / bounds.height
    };
}

/**
 * 三角形内の重心座標を返す。退化またはnon-finite入力はnull。
 * Rasterizerもこの式とepsilonだけを共有し、pixelの帰属規則は共有しない。
 */
export function getBarycentricWeights(point, first, second, third) {
    if (!isFinitePoint(point) || !isFinitePoint(first)
        || !isFinitePoint(second) || !isFinitePoint(third)) {
        return null;
    }
    const denominator = (second.y - third.y) * (first.x - third.x)
        + (third.x - second.x) * (first.y - third.y);
    if (!Number.isFinite(denominator) || Math.abs(denominator) < TRIANGLE_EPSILON) {
        return null;
    }
    const firstWeight = ((second.y - third.y) * (point.x - third.x)
        + (third.x - second.x) * (point.y - third.y)) / denominator;
    const secondWeight = ((third.y - first.y) * (point.x - third.x)
        + (first.x - third.x) * (point.y - third.y)) / denominator;
    const weights = [firstWeight, secondWeight, 1 - firstWeight - secondWeight];
    return weights.every(Number.isFinite) ? weights : null;
}

function failure(reason) {
    return { ok: false, reason };
}

function validatePointArrays(bindPoints, points) {
    if (!Array.isArray(bindPoints) || !Array.isArray(points)
        || bindPoints.length !== points.length || bindPoints.length < 3) {
        return false;
    }
    return bindPoints.every(isFinitePoint) && points.every(isFinitePoint);
}

function validateTriangles(triangles, pointCount) {
    if (!Array.isArray(triangles) || triangles.length === 0) return false;
    return triangles.every(triangle => Array.isArray(triangle)
        && triangle.length === 3
        && triangle.every(index => Number.isInteger(index)
            && index >= 0
            && index < pointCount)
        && new Set(triangle).size === 3);
}

function weightedPoint(points, indices, weights) {
    const point = indices.reduce((result, index, weightIndex) => ({
        x: result.x + points[index].x * weights[weightIndex],
        y: result.y + points[index].y * weights[weightIndex]
    }), { x: 0, y: 0 });
    return isFinitePoint(point) ? point : null;
}

/**
 * placement適用前のBind Project点を、同じtriangle index / barycentric weightで
 * sampled Poseへ写す。pointはBind Project座標、result.pointもProject座標。
 */
export function mapWarpBindPointToPose(options = {}) {
    const bindBounds = normalizeBounds(options.bindBounds);
    if (!bindBounds || !isFinitePoint(options.point)) return failure('non-finite');

    const bindPoints = options.bindPoints;
    const points = options.points;
    if (!validatePointArrays(bindPoints, points)) return failure('non-finite');
    if (!validateTriangles(options.triangles, bindPoints.length)) {
        return failure('invalid-topology');
    }

    const geometry = resolveWarpPlacementGeometry(
        bindPoints,
        points,
        bindBounds,
        options.placement
    );
    if (!geometry) return failure('non-finite');

    // 入力pointにも同じBind重心placementを適用し、sampled Bind geometryと
    // 同じ座標系でtriangleを検索する。Pose側へは同じweightsを適用する。
    const normalizedPoint = toNormalizedPoint(options.point, bindBounds);
    const placedInput = applyWarpPlacementToPoints(
        [normalizedPoint],
        bindPoints,
        bindBounds,
        options.placement
    );
    if (!placedInput?.[0] || !isFinitePoint(placedInput[0])) {
        return failure('non-finite');
    }
    const bindProjectPoints = geometry.bindPoints.map(point => (
        toProjectPoint(point, bindBounds)
    ));
    const poseProjectPoints = geometry.points.map(point => (
        toProjectPoint(point, bindBounds)
    ));
    const projectPoint = toProjectPoint(placedInput[0], bindBounds);
    let sawDegenerate = false;

    for (let triangleIndex = 0; triangleIndex < options.triangles.length; triangleIndex++) {
        const indices = options.triangles[triangleIndex];
        const [first, second, third] = indices.map(index => bindProjectPoints[index]);
        const weights = getBarycentricWeights(projectPoint, first, second, third);
        if (!weights) {
            sawDegenerate = true;
            continue;
        }
        if (weights.some(weight => weight < -TRIANGLE_EPSILON)) continue;
        const mappedPoint = weightedPoint(poseProjectPoints, indices, weights);
        if (!mappedPoint) return failure('non-finite');
        return {
            ok: true,
            triangleIndex,
            indices: [...indices],
            weights,
            point: mappedPoint
        };
    }

    return failure(sawDegenerate ? 'degenerate' : 'outside');
}

// 呼出側が「resolve」を使う場合も同じpure実装を参照するための明示alias。
export const resolveWarpTrianglePointMap = mapWarpBindPointToPose;

