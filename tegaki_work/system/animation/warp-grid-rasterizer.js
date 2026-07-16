import { validateRasterSurfaceSize } from '../raster-bounds.js';
import {
    WARP_GRID_COLUMNS,
    WARP_GRID_ROWS
} from './warp-grid-deformer.js';
import { createRectGridTopology } from './warp-grid-topology.js';

const TRIANGLE_EPSILON = 1e-8;

function toProjectPoint(point, bounds) {
    return {
        x: bounds.x + point.x * bounds.width,
        y: bounds.y + point.y * bounds.height
    };
}

const WARP_GRID_TOPOLOGY = createRectGridTopology({
    columns: WARP_GRID_COLUMNS,
    rows: WARP_GRID_ROWS
});
const WARP_GRID_TRIANGLES = WARP_GRID_TOPOLOGY.triangles;

export function createTriangleMeshData(deformer, sourceBounds, triangles) {
    if (!deformer || !sourceBounds
        || !Array.isArray(deformer.bindPoints)
        || !Array.isArray(deformer.points)
        || deformer.bindPoints.length !== deformer.points.length
        || !Array.isArray(triangles)
        || triangles.length === 0) {
        return null;
    }
    const bindBounds = deformer.bindBounds || sourceBounds;
    const sourcePoints = deformer.bindPoints.map(point => toProjectPoint(point, bindBounds));
    const destinationPoints = deformer.points.map(point => toProjectPoint(point, bindBounds));
    return {
        positions: new Float32Array(destinationPoints.flatMap(point => [point.x, point.y])),
        uvs: new Float32Array(sourcePoints.flatMap(point => [
            (point.x - sourceBounds.x) / sourceBounds.width,
            (point.y - sourceBounds.y) / sourceBounds.height
        ])),
        indices: new Uint32Array(triangles.flat())
    };
}

export function createWarpGridMeshData(deformer, sourceBounds) {
    if (deformer?.bindPoints?.length !== WARP_GRID_TOPOLOGY.pointCount) return null;
    return createTriangleMeshData(deformer, sourceBounds, WARP_GRID_TRIANGLES);
}

function readPremultipliedPixel(pixels, width, height, x, y) {
    const clampedX = Math.max(0, Math.min(width - 1, x));
    const clampedY = Math.max(0, Math.min(height - 1, y));
    const offset = (clampedY * width + clampedX) * 4;
    const alpha = pixels[offset + 3] / 255;
    return [
        pixels[offset] * alpha,
        pixels[offset + 1] * alpha,
        pixels[offset + 2] * alpha,
        pixels[offset + 3]
    ];
}

function sampleBilinearPremultiplied(pixels, width, height, sourceX, sourceY) {
    const pixelX = sourceX - 0.5;
    const pixelY = sourceY - 0.5;
    const x0 = Math.floor(pixelX);
    const y0 = Math.floor(pixelY);
    const x1 = x0 + 1;
    const y1 = y0 + 1;
    const ratioX = pixelX - x0;
    const ratioY = pixelY - y0;
    const samples = [
        readPremultipliedPixel(pixels, width, height, x0, y0),
        readPremultipliedPixel(pixels, width, height, x1, y0),
        readPremultipliedPixel(pixels, width, height, x0, y1),
        readPremultipliedPixel(pixels, width, height, x1, y1)
    ];
    const topWeight = 1 - ratioY;
    const bottomWeight = ratioY;
    const weights = [
        (1 - ratioX) * topWeight,
        ratioX * topWeight,
        (1 - ratioX) * bottomWeight,
        ratioX * bottomWeight
    ];
    const premultiplied = [0, 0, 0, 0];
    for (let sampleIndex = 0; sampleIndex < samples.length; sampleIndex++) {
        for (let channel = 0; channel < 4; channel++) {
            premultiplied[channel] += samples[sampleIndex][channel] * weights[sampleIndex];
        }
    }
    if (premultiplied[3] <= 0) return [0, 0, 0, 0];
    const alpha = premultiplied[3] / 255;
    return [
        Math.round(premultiplied[0] / alpha),
        Math.round(premultiplied[1] / alpha),
        Math.round(premultiplied[2] / alpha),
        Math.round(premultiplied[3])
    ];
}

function getBarycentric(point, first, second, third) {
    const denominator = (second.y - third.y) * (first.x - third.x)
        + (third.x - second.x) * (first.y - third.y);
    if (Math.abs(denominator) < TRIANGLE_EPSILON) return null;
    const firstWeight = ((second.y - third.y) * (point.x - third.x)
        + (third.x - second.x) * (point.y - third.y)) / denominator;
    const secondWeight = ((third.y - first.y) * (point.x - third.x)
        + (first.x - third.x) * (point.y - third.y)) / denominator;
    return [firstWeight, secondWeight, 1 - firstWeight - secondWeight];
}

function assertRasterInput(options, triangles) {
    const width = Number(options.width);
    const height = Number(options.height);
    const pixels = options.pixels;
    if (!Number.isInteger(width) || width <= 0 || !Number.isInteger(height) || height <= 0) {
        throw new Error('Warp Grid source raster dimensions are invalid');
    }
    if (!pixels || pixels.length !== width * height * 4) {
        throw new Error('Warp Grid source pixel length is invalid');
    }
    if (!options.sourceBounds || options.sourceBounds.width !== width || options.sourceBounds.height !== height) {
        throw new Error('Warp Grid source bounds must match the source raster dimensions');
    }
    const pointCount = options.deformer?.bindPoints?.length;
    if (!Number.isInteger(pointCount)
        || pointCount < 3
        || options.deformer?.points?.length !== pointCount) {
        throw new Error('Triangle Mesh pose must contain matching bind and destination points');
    }
    if (!Array.isArray(triangles) || triangles.length === 0
        || triangles.some(triangle => !Array.isArray(triangle)
            || triangle.length !== 3
            || triangle.some(index => !Number.isInteger(index) || index < 0 || index >= pointCount))) {
        throw new Error('Triangle Mesh indices are invalid');
    }
}

/**
 * 任意triangle MeshのCPU reference renderer。
 * source / output boundsはProject座標、pointはbindBounds基準の正規化座標。
 */
export function warpRgbaWithTriangles(options = {}) {
    const triangles = options.triangles;
    assertRasterInput(options, triangles);
    const sourceBounds = { ...options.sourceBounds };
    const bindBounds = options.deformer.bindBounds || sourceBounds;
    const sourcePoints = options.deformer.bindPoints.map(point => toProjectPoint(point, bindBounds));
    const destinationPoints = options.deformer.points.map(point => toProjectPoint(point, bindBounds));
    const minX = Math.floor(Math.min(...destinationPoints.map(point => point.x)));
    const minY = Math.floor(Math.min(...destinationPoints.map(point => point.y)));
    const maxX = Math.ceil(Math.max(...destinationPoints.map(point => point.x)));
    const maxY = Math.ceil(Math.max(...destinationPoints.map(point => point.y)));
    const validation = validateRasterSurfaceSize({
        x: minX,
        y: minY,
        width: Math.max(1, maxX - minX),
        height: Math.max(1, maxY - minY)
    }, {
        maxAxis: options.maxAxis,
        maxPixels: options.maxPixels
    });
    if (!validation.ok) {
        throw new Error(
            `Warp Grid output exceeds the safe raster limit `
            + `(${validation.bounds?.width || 0}x${validation.bounds?.height || 0}, ${validation.reason})`
        );
    }

    const outputBounds = validation.bounds;
    const output = new Uint8ClampedArray(outputBounds.width * outputBounds.height * 4);
    for (const indices of triangles) {
        const destination = indices.map(index => destinationPoints[index]);
        const source = indices.map(index => sourcePoints[index]);
        const startX = Math.max(outputBounds.x, Math.floor(Math.min(...destination.map(point => point.x))));
        const startY = Math.max(outputBounds.y, Math.floor(Math.min(...destination.map(point => point.y))));
        const endX = Math.min(
            outputBounds.x + outputBounds.width - 1,
            Math.ceil(Math.max(...destination.map(point => point.x))) - 1
        );
        const endY = Math.min(
            outputBounds.y + outputBounds.height - 1,
            Math.ceil(Math.max(...destination.map(point => point.y))) - 1
        );
        for (let projectY = startY; projectY <= endY; projectY++) {
            for (let projectX = startX; projectX <= endX; projectX++) {
                const weights = getBarycentric(
                    { x: projectX + 0.5, y: projectY + 0.5 },
                    destination[0],
                    destination[1],
                    destination[2]
                );
                if (!weights || weights.some(weight => weight < -TRIANGLE_EPSILON)) continue;
                const sourceProjectX = source.reduce(
                    (sum, point, index) => sum + point.x * weights[index],
                    0
                );
                const sourceProjectY = source.reduce(
                    (sum, point, index) => sum + point.y * weights[index],
                    0
                );
                const color = sampleBilinearPremultiplied(
                    options.pixels,
                    options.width,
                    options.height,
                    sourceProjectX - sourceBounds.x,
                    sourceProjectY - sourceBounds.y
                );
                const outputOffset = (
                    (projectY - outputBounds.y) * outputBounds.width
                    + projectX - outputBounds.x
                ) * 4;
                output.set(color, outputOffset);
            }
        }
    }
    return {
        pixels: output,
        width: outputBounds.width,
        height: outputBounds.height,
        bounds: outputBounds
    };
}

/** 固定4x4 Warp Grid互換wrapper。 */
export function warpRgbaWithGrid(options = {}) {
    if (options.deformer?.bindPoints?.length !== WARP_GRID_TOPOLOGY.pointCount
        || options.deformer?.points?.length !== WARP_GRID_TOPOLOGY.pointCount) {
        throw new Error(
            `Warp Grid pose must contain ${WARP_GRID_TOPOLOGY.pointCount} bind and destination points`
        );
    }
    return warpRgbaWithTriangles({
        ...options,
        triangles: WARP_GRID_TRIANGLES
    });
}
