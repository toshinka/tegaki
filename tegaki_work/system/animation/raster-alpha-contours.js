/**
 * Raster alphaを4-connected islandとpixel-cell境界loopへ変換するpure analyzer。
 * 出力はWARP / Skin Meshどちらの保存shapeも所有せず、Project座標の輪郭候補だけを返す。
 */

import { normalizeRasterBounds } from '../raster-bounds.js';

export const RASTER_ALPHA_CONTOUR_MAX_PIXELS = 4 * 1024 * 1024;
export const RASTER_ALPHA_CONTOUR_MAX_BOUNDARY_EDGES = 65536;

const DIRECTIONS = Object.freeze({ east: 0, south: 1, west: 2, north: 3 });
const TURN_PRIORITY = Object.freeze([1, 0, 3, 2]);

function pointKey(x, y) {
    return `${x},${y}`;
}

function readLimit(value, fallback) {
    const number = Number(value);
    return Number.isInteger(number) && number > 0 ? number : fallback;
}

function signedArea(points) {
    let areaDouble = 0;
    for (let index = 0; index < points.length; index++) {
        const current = points[index];
        const next = points[(index + 1) % points.length];
        areaDouble += current.x * next.y - next.x * current.y;
    }
    return areaDouble / 2;
}

function simplifyOrthogonalLoop(points) {
    if (!Array.isArray(points) || points.length < 3) return [];
    const simplified = points.filter((point, index) => {
        const previous = points[(index - 1 + points.length) % points.length];
        const next = points[(index + 1) % points.length];
        return !((previous.x === point.x && point.x === next.x)
            || (previous.y === point.y && point.y === next.y));
    });
    return simplified.length >= 3 ? simplified : points.map(point => ({ ...point }));
}

function rotateLoopToCanonicalStart(points) {
    let startIndex = 0;
    for (let index = 1; index < points.length; index++) {
        const point = points[index];
        const start = points[startIndex];
        if (point.y < start.y || (point.y === start.y && point.x < start.x)) {
            startIndex = index;
        }
    }
    return points.map((_, index) => ({ ...points[(startIndex + index) % points.length] }));
}

function boundsFromPoints(points) {
    const xs = points.map(point => point.x);
    const ys = points.map(point => point.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const maxX = Math.max(...xs);
    const maxY = Math.max(...ys);
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function addEdge(edges, startX, startY, endX, endY, direction) {
    edges.push({ startX, startY, endX, endY, direction });
}

function chooseNextEdge(edge, candidateIndices, edges) {
    return [...candidateIndices].sort((leftIndex, rightIndex) => {
        const left = edges[leftIndex];
        const right = edges[rightIndex];
        const leftTurn = (left.direction - edge.direction + 4) % 4;
        const rightTurn = (right.direction - edge.direction + 4) % 4;
        const leftPriority = TURN_PRIORITY.indexOf(leftTurn);
        const rightPriority = TURN_PRIORITY.indexOf(rightTurn);
        return leftPriority - rightPriority || left.direction - right.direction;
    })[0];
}

function traceComponentContours(edges) {
    const outgoing = new Map();
    edges.forEach((edge, index) => {
        const key = pointKey(edge.startX, edge.startY);
        const list = outgoing.get(key) || [];
        list.push(index);
        outgoing.set(key, list);
    });
    outgoing.forEach(list => list.sort((left, right) => edges[left].direction - edges[right].direction));

    const ordered = edges.map((_, index) => index).sort((leftIndex, rightIndex) => {
        const left = edges[leftIndex];
        const right = edges[rightIndex];
        return left.startY - right.startY
            || left.startX - right.startX
            || left.direction - right.direction;
    });
    const used = new Uint8Array(edges.length);
    const loops = [];

    for (const startIndex of ordered) {
        if (used[startIndex]) continue;
        const startEdge = edges[startIndex];
        const startKey = pointKey(startEdge.startX, startEdge.startY);
        const points = [{ x: startEdge.startX, y: startEdge.startY }];
        let edgeIndex = startIndex;
        let closed = false;

        for (let step = 0; step <= edges.length; step++) {
            const edge = edges[edgeIndex];
            if (used[edgeIndex]) break;
            used[edgeIndex] = 1;
            points.push({ x: edge.endX, y: edge.endY });
            const endKey = pointKey(edge.endX, edge.endY);
            if (endKey === startKey) {
                closed = true;
                break;
            }
            const candidates = (outgoing.get(endKey) || []).filter(index => !used[index]);
            if (candidates.length === 0) break;
            edgeIndex = chooseNextEdge(edge, candidates, edges);
        }
        if (!closed) return { ok: false, reason: 'open-boundary', contours: [] };
        points.pop();
        const canonical = rotateLoopToCanonicalStart(simplifyOrthogonalLoop(points));
        const area = signedArea(canonical);
        if (canonical.length < 3 || Math.abs(area) <= 1e-9) {
            return { ok: false, reason: 'degenerate-boundary', contours: [] };
        }
        loops.push({ pixelPoints: canonical, signedPixelArea: area });
    }
    return { ok: true, reason: null, contours: loops };
}

/**
 * Alpha > thresholdのpixelを解析し、4-connected componentごとのouter / hole loopを返す。
 * pointsはProject座標、pixelPointsはRaster surface左上を(0,0)とするpixel-cell座標。
 */
export function analyzeRasterAlphaContours(snapshot, options = {}) {
    const width = Math.max(1, Math.round(Number(snapshot?.width) || 1));
    const height = Math.max(1, Math.round(Number(snapshot?.height) || 1));
    const pixels = snapshot?.pixels;
    if (!pixels || typeof pixels.length !== 'number' || pixels.length < width * height * 4) {
        return { ok: false, reason: 'invalid-raster', components: [] };
    }
    const pixelCount = width * height;
    const maxPixels = readLimit(options.maxPixels, RASTER_ALPHA_CONTOUR_MAX_PIXELS);
    if (pixelCount > maxPixels) {
        return { ok: false, reason: 'surface-too-large', components: [] };
    }
    const threshold = Math.max(0, Math.min(255, Math.round(Number(options.alphaThreshold) || 0)));
    const opaque = new Uint8Array(pixelCount);
    let opaquePixelCount = 0;
    for (let index = 0; index < pixelCount; index++) {
        if (pixels[index * 4 + 3] <= threshold) continue;
        opaque[index] = 1;
        opaquePixelCount += 1;
    }
    if (opaquePixelCount === 0) {
        return { ok: false, reason: 'empty-raster', components: [] };
    }

    const labels = new Int32Array(pixelCount);
    labels.fill(-1);
    const queue = new Int32Array(pixelCount);
    const componentPixels = [];
    for (let start = 0; start < pixelCount; start++) {
        if (!opaque[start] || labels[start] !== -1) continue;
        const componentIndex = componentPixels.length;
        let head = 0;
        let tail = 0;
        let count = 0;
        let minX = width;
        let minY = height;
        let maxX = -1;
        let maxY = -1;
        queue[tail++] = start;
        labels[start] = componentIndex;
        while (head < tail) {
            const index = queue[head++];
            const x = index % width;
            const y = Math.floor(index / width);
            count += 1;
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
            const neighbors = [
                x > 0 ? index - 1 : -1,
                x + 1 < width ? index + 1 : -1,
                y > 0 ? index - width : -1,
                y + 1 < height ? index + width : -1
            ];
            neighbors.forEach(neighbor => {
                if (neighbor < 0 || !opaque[neighbor] || labels[neighbor] !== -1) return;
                labels[neighbor] = componentIndex;
                queue[tail++] = neighbor;
            });
        }
        componentPixels.push({
            pixelCount: count,
            pixelBounds: {
                x: minX,
                y: minY,
                width: maxX - minX + 1,
                height: maxY - minY + 1
            }
        });
    }

    const componentEdges = componentPixels.map(() => []);
    let boundaryEdgeCount = 0;
    const maxBoundaryEdges = readLimit(
        options.maxBoundaryEdges,
        RASTER_ALPHA_CONTOUR_MAX_BOUNDARY_EDGES
    );
    for (let index = 0; index < pixelCount; index++) {
        if (!opaque[index]) continue;
        const componentIndex = labels[index];
        const edges = componentEdges[componentIndex];
        const x = index % width;
        const y = Math.floor(index / width);
        if (y === 0 || !opaque[index - width]) {
            addEdge(edges, x, y, x + 1, y, DIRECTIONS.east);
            boundaryEdgeCount += 1;
        }
        if (x + 1 === width || !opaque[index + 1]) {
            addEdge(edges, x + 1, y, x + 1, y + 1, DIRECTIONS.south);
            boundaryEdgeCount += 1;
        }
        if (y + 1 === height || !opaque[index + width]) {
            addEdge(edges, x + 1, y + 1, x, y + 1, DIRECTIONS.west);
            boundaryEdgeCount += 1;
        }
        if (x === 0 || !opaque[index - 1]) {
            addEdge(edges, x, y + 1, x, y, DIRECTIONS.north);
            boundaryEdgeCount += 1;
        }
        if (boundaryEdgeCount > maxBoundaryEdges) {
            return { ok: false, reason: 'boundary-too-complex', components: [] };
        }
    }

    const rasterBounds = normalizeRasterBounds(snapshot.rasterBounds, {
        x: 0,
        y: 0,
        width,
        height
    });
    const scaleX = rasterBounds.width / width;
    const scaleY = rasterBounds.height / height;
    const components = [];
    let contourCount = 0;
    let holeCount = 0;
    for (let componentIndex = 0; componentIndex < componentPixels.length; componentIndex++) {
        const traced = traceComponentContours(componentEdges[componentIndex]);
        if (!traced.ok) return { ok: false, reason: traced.reason, components: [] };
        const contours = traced.contours.map(contour => {
            const points = contour.pixelPoints.map(point => ({
                x: rasterBounds.x + point.x * scaleX,
                y: rasterBounds.y + point.y * scaleY
            }));
            const area = signedArea(points);
            return {
                kind: contour.signedPixelArea > 0 ? 'outer' : 'hole',
                points,
                pixelPoints: contour.pixelPoints.map(point => ({ ...point })),
                bounds: boundsFromPoints(points),
                pixelBounds: boundsFromPoints(contour.pixelPoints),
                signedArea: area,
                signedPixelArea: contour.signedPixelArea
            };
        }).sort((left, right) => (
            (left.kind === 'outer' ? 0 : 1) - (right.kind === 'outer' ? 0 : 1)
            || right.signedPixelArea - left.signedPixelArea
            || left.pixelBounds.y - right.pixelBounds.y
            || left.pixelBounds.x - right.pixelBounds.x
        ));
        const outerContours = contours.filter(contour => contour.kind === 'outer');
        const holeContours = contours.filter(contour => contour.kind === 'hole');
        if (outerContours.length === 0) {
            return { ok: false, reason: 'missing-outer-boundary', components: [] };
        }
        contourCount += contours.length;
        holeCount += holeContours.length;
        components.push({
            componentIndex,
            pixelCount: componentPixels[componentIndex].pixelCount,
            pixelBounds: { ...componentPixels[componentIndex].pixelBounds },
            contours,
            outerContours,
            holeContours
        });
    }

    return {
        ok: true,
        reason: null,
        width,
        height,
        alphaThreshold: threshold,
        rasterBounds: { ...rasterBounds },
        opaquePixelCount,
        boundaryEdgeCount,
        componentCount: components.length,
        contourCount,
        holeCount,
        components
    };
}
