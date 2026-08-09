/**
 * Raster alphaからLINE / Ribbon比較用の単一centerline候補を作るpure analyzer。
 * outputは保存Mesh、Bone、SkinWeight、WARP pointのいずれも所有しない。
 */

import { analyzeRasterAlphaContours } from './raster-alpha-contours.js';

export const RASTER_LINE_DEFAULT_MAX_THINNING_ITERATIONS = 1024;
export const RASTER_LINE_DEFAULT_MAX_CENTERLINE_POINTS = 8192;

const ORTHOGONAL_DIRECTIONS = Object.freeze([
    { dx: 0, dy: -1 },
    { dx: 1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: -1, dy: 0 }
]);
const DIAGONAL_DIRECTIONS = Object.freeze([
    { dx: 1, dy: -1 },
    { dx: 1, dy: 1 },
    { dx: -1, dy: 1 },
    { dx: -1, dy: -1 }
]);

function readPositiveInteger(value, fallback) {
    const number = Number(value);
    return Number.isInteger(number) && number > 0 ? number : fallback;
}

function paddedIndex(x, y, stride) {
    return y * stride + x;
}

function readNeighbors(mask, x, y, stride) {
    return [
        mask[paddedIndex(x, y - 1, stride)],
        mask[paddedIndex(x + 1, y - 1, stride)],
        mask[paddedIndex(x + 1, y, stride)],
        mask[paddedIndex(x + 1, y + 1, stride)],
        mask[paddedIndex(x, y + 1, stride)],
        mask[paddedIndex(x - 1, y + 1, stride)],
        mask[paddedIndex(x - 1, y, stride)],
        mask[paddedIndex(x - 1, y - 1, stride)]
    ];
}

function countZeroToOneTransitions(neighbors) {
    let transitions = 0;
    for (let index = 0; index < neighbors.length; index++) {
        if (neighbors[index] === 0 && neighbors[(index + 1) % neighbors.length] === 1) {
            transitions += 1;
        }
    }
    return transitions;
}

function collectThinningRemovals(mask, width, height, stride, phase) {
    const removals = [];
    for (let y = 1; y <= height; y++) {
        for (let x = 1; x <= width; x++) {
            const index = paddedIndex(x, y, stride);
            if (!mask[index]) continue;
            const neighbors = readNeighbors(mask, x, y, stride);
            const neighborCount = neighbors.reduce((sum, value) => sum + value, 0);
            if (neighborCount < 2 || neighborCount > 6) continue;
            if (countZeroToOneTransitions(neighbors) !== 1) continue;
            const [north, , east, , south, , west] = neighbors;
            const firstGate = phase === 0
                ? north * east * south
                : north * east * west;
            const secondGate = phase === 0
                ? east * south * west
                : north * south * west;
            if (firstGate !== 0 || secondGate !== 0) continue;
            removals.push(index);
        }
    }
    return removals;
}

function thinOpaqueMask(mask, width, height, stride, maxIterations) {
    let iterationCount = 0;
    while (iterationCount < maxIterations) {
        let changed = false;
        for (let phase = 0; phase < 2; phase++) {
            const removals = collectThinningRemovals(mask, width, height, stride, phase);
            if (removals.length === 0) continue;
            removals.forEach(index => { mask[index] = 0; });
            changed = true;
        }
        iterationCount += 1;
        if (!changed) return { ok: true, iterationCount };
    }
    return { ok: false, reason: 'thinning-iteration-limit', iterationCount };
}

function pointOrder(left, right) {
    return left.y - right.y || left.x - right.x;
}

function createSkeletonGraph(mask, width, height, stride) {
    const nodes = [];
    const nodeByIndex = new Map();
    for (let y = 1; y <= height; y++) {
        for (let x = 1; x <= width; x++) {
            const index = paddedIndex(x, y, stride);
            if (!mask[index]) continue;
            const node = {
                index: nodes.length,
                paddedX: x,
                paddedY: y,
                x: x - 0.5,
                y: y - 0.5,
                neighbors: []
            };
            nodes.push(node);
            nodeByIndex.set(index, node);
        }
    }

    for (const node of nodes) {
        const connect = ({ dx, dy }, diagonal) => {
            const neighborIndex = paddedIndex(node.paddedX + dx, node.paddedY + dy, stride);
            const neighbor = nodeByIndex.get(neighborIndex);
            if (!neighbor) return;
            if (diagonal) {
                const horizontal = mask[paddedIndex(node.paddedX + dx, node.paddedY, stride)];
                const vertical = mask[paddedIndex(node.paddedX, node.paddedY + dy, stride)];
                if (horizontal || vertical) return;
            }
            node.neighbors.push(neighbor.index);
        };
        ORTHOGONAL_DIRECTIONS.forEach(direction => connect(direction, false));
        DIAGONAL_DIRECTIONS.forEach(direction => connect(direction, true));
        node.neighbors.sort((leftIndex, rightIndex) => pointOrder(nodes[leftIndex], nodes[rightIndex]));
    }
    return nodes;
}

function orderOpenSkeletonPath(nodes) {
    if (nodes.length < 2) return { ok: false, reason: 'centerline-too-short' };
    if (nodes.some(node => node.neighbors.length > 2)) {
        return { ok: false, reason: 'branching-centerline' };
    }
    if (nodes.some(node => node.neighbors.length === 0)) {
        return { ok: false, reason: 'disconnected-centerline' };
    }
    const endpoints = nodes.filter(node => node.neighbors.length === 1).sort(pointOrder);
    if (endpoints.length === 0) return { ok: false, reason: 'closed-centerline' };
    if (endpoints.length !== 2) return { ok: false, reason: 'branching-centerline' };

    const path = [];
    const visited = new Set();
    let previousIndex = -1;
    let currentIndex = endpoints[0].index;
    while (currentIndex >= 0 && !visited.has(currentIndex)) {
        const node = nodes[currentIndex];
        visited.add(currentIndex);
        path.push(node);
        const next = node.neighbors.find(index => index !== previousIndex && !visited.has(index));
        previousIndex = currentIndex;
        currentIndex = Number.isInteger(next) ? next : -1;
    }
    if (path.length !== nodes.length || path[path.length - 1].index !== endpoints[1].index) {
        return { ok: false, reason: 'disconnected-centerline' };
    }
    return { ok: true, reason: null, path };
}

function polylineLength(points) {
    let length = 0;
    for (let index = 1; index < points.length; index++) {
        length += Math.hypot(
            points[index].x - points[index - 1].x,
            points[index].y - points[index - 1].y
        );
    }
    return length;
}

/**
 * 一つのholeなしalpha islandから、LINE / Ribbon比較用open centerline候補を返す。
 */
export function analyzeRasterLineCenterline(snapshot, options = {}) {
    const analysis = analyzeRasterAlphaContours(snapshot, options);
    if (!analysis.ok) return { ok: false, reason: analysis.reason, pixelPoints: [], points: [] };
    if (analysis.componentCount !== 1) {
        return { ok: false, reason: 'single-component-required', pixelPoints: [], points: [] };
    }
    if (analysis.holeCount !== 0) {
        return { ok: false, reason: 'holes-unsupported', pixelPoints: [], points: [] };
    }

    const { width, height, alphaThreshold, rasterBounds } = analysis;
    const stride = width + 2;
    const mask = new Uint8Array(stride * (height + 2));
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const alpha = snapshot.pixels[(y * width + x) * 4 + 3];
            if (alpha > alphaThreshold) mask[paddedIndex(x + 1, y + 1, stride)] = 1;
        }
    }
    const maxIterations = readPositiveInteger(
        options.maxThinningIterations,
        RASTER_LINE_DEFAULT_MAX_THINNING_ITERATIONS
    );
    const thinned = thinOpaqueMask(mask, width, height, stride, maxIterations);
    if (!thinned.ok) return { ...thinned, pixelPoints: [], points: [] };

    const nodes = createSkeletonGraph(mask, width, height, stride);
    const maxCenterlinePoints = readPositiveInteger(
        options.maxCenterlinePoints,
        RASTER_LINE_DEFAULT_MAX_CENTERLINE_POINTS
    );
    if (nodes.length > maxCenterlinePoints) {
        return { ok: false, reason: 'centerline-point-limit', pixelPoints: [], points: [] };
    }
    const ordered = orderOpenSkeletonPath(nodes);
    if (!ordered.ok) return { ...ordered, pixelPoints: [], points: [] };

    const pixelPoints = ordered.path.map(node => ({ x: node.x, y: node.y }));
    const scaleX = rasterBounds.width / width;
    const scaleY = rasterBounds.height / height;
    const points = pixelPoints.map(point => ({
        x: rasterBounds.x + point.x * scaleX,
        y: rasterBounds.y + point.y * scaleY
    }));
    return {
        ok: true,
        reason: null,
        width,
        height,
        alphaThreshold,
        rasterBounds: { ...rasterBounds },
        pixelPoints,
        points,
        endpointPixelPoints: [
            { ...pixelPoints[0] },
            { ...pixelPoints[pixelPoints.length - 1] }
        ],
        metrics: {
            opaquePixelCount: analysis.opaquePixelCount,
            skeletonPointCount: pixelPoints.length,
            thinningIterations: thinned.iterationCount,
            pixelLength: polylineLength(pixelPoints),
            projectLength: polylineLength(points)
        }
    };
}
