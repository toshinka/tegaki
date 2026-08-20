import { validateRasterSurfaceSize } from '../raster-bounds.js';
import {
    WARP_GRID_COLUMNS,
    WARP_GRID_ROWS
} from './warp-grid-deformer.js';
import { resolveWarpPlacementGeometry } from './warp-placement.js';
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

export function createTriangleMeshData(deformer, sourceBounds, triangles, textureBounds = sourceBounds) {
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
            (point.x - textureBounds.x) / textureBounds.width,
            (point.y - textureBounds.y) / textureBounds.height
        ])),
        indices: new Uint32Array(triangles.flat())
    };
}

export function createWarpGridMeshData(deformer, sourceBounds, textureBounds = sourceBounds) {
    if (deformer?.bindPoints?.length !== WARP_GRID_TOPOLOGY.pointCount) return null;
    return createTriangleMeshData(deformer, sourceBounds, WARP_GRID_TRIANGLES, textureBounds);
}

function readPremultipliedPixel(pixels, width, height, x, y) {
    // BindがRaster外へ出た部分は透明として扱う。端pixelへclampすると、
    // GRID枠の移動だけでRaster端色が外側へ引き伸ばされてしまう。
    if (x < 0 || x >= width || y < 0 || y >= height) return [0, 0, 0, 0];
    const offset = (y * width + x) * 4;
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

function compositeSourceOverPixel(output, offset, source) {
    const sourceAlpha = source[3];
    if (sourceAlpha <= 0) return;
    if (sourceAlpha >= 255) {
        output.set(source, offset);
        return;
    }
    const destinationAlpha = output[offset + 3];
    if (destinationAlpha <= 0) {
        output.set(source, offset);
        return;
    }
    const inverseSourceAlpha = 255 - sourceAlpha;
    const outputAlpha = sourceAlpha + destinationAlpha * inverseSourceAlpha / 255;
    for (let channel = 0; channel < 3; channel++) {
        const premultiplied = source[channel] * sourceAlpha
            + output[offset + channel] * destinationAlpha * inverseSourceAlpha / 255;
        output[offset + channel] = Math.round(premultiplied / outputAlpha);
    }
    output[offset + 3] = Math.round(outputAlpha);
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

function unionBounds(first, second) {
    const minX = Math.min(first.x, second.x);
    const minY = Math.min(first.y, second.y);
    const maxX = Math.max(first.x + first.width, second.x + second.width);
    const maxY = Math.max(first.y + first.height, second.y + second.height);
    return {
        x: minX,
        y: minY,
        width: Math.max(1, maxX - minX),
        height: Math.max(1, maxY - minY)
    };
}

function ownsDirectedBoundaryEdge(first, second) {
    const deltaY = second.y - first.y;
    const deltaX = second.x - first.x;
    return deltaY > TRIANGLE_EPSILON
        || (Math.abs(deltaY) <= TRIANGLE_EPSILON && deltaX > TRIANGLE_EPSILON);
}

function forEachTrianglePixel(points, bounds, callback) {
    const orientation = (points[1].x - points[0].x) * (points[2].y - points[0].y)
        - (points[1].y - points[0].y) * (points[2].x - points[0].x);
    if (Math.abs(orientation) < TRIANGLE_EPSILON) return;
    const boundaryEdges = orientation > 0
        ? [
            [points[1], points[2]],
            [points[2], points[0]],
            [points[0], points[1]]
        ]
        : [
            [points[2], points[1]],
            [points[0], points[2]],
            [points[1], points[0]]
        ];
    const startX = Math.max(bounds.x, Math.floor(Math.min(...points.map(point => point.x))));
    const startY = Math.max(bounds.y, Math.floor(Math.min(...points.map(point => point.y))));
    const endX = Math.min(
        bounds.x + bounds.width - 1,
        Math.ceil(Math.max(...points.map(point => point.x))) - 1
    );
    const endY = Math.min(
        bounds.y + bounds.height - 1,
        Math.ceil(Math.max(...points.map(point => point.y))) - 1
    );
    for (let projectY = startY; projectY <= endY; projectY++) {
        for (let projectX = startX; projectX <= endX; projectX++) {
            const weights = getBarycentric(
                { x: projectX + 0.5, y: projectY + 0.5 },
                points[0],
                points[1],
                points[2]
            );
            if (!weights || weights.some(weight => weight < -TRIANGLE_EPSILON)) continue;
            // 共有edge上のpixel centerは、向きが反対になる片側triangleだけが所有する。
            // triangle内部の本当の重なりは抑止せず、self-overlap時もPixi Meshと同じ
            // fragment順のsource-over合成へ残す。
            if (weights.some((weight, index) => (
                Math.abs(weight) <= TRIANGLE_EPSILON
                && !ownsDirectedBoundaryEdge(boundaryEdges[index][0], boundaryEdges[index][1])
            ))) continue;
            callback(projectX, projectY, weights);
        }
    }
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
 * sampled placementはsource Bind / destination Poseへ同じ重心affineとして適用する。
 */
export function warpRgbaWithTriangles(options = {}) {
    const triangles = options.triangles;
    assertRasterInput(options, triangles);
    const sourceBounds = { ...options.sourceBounds };
    const bindBounds = options.deformer.bindBounds || sourceBounds;
    const geometry = resolveWarpPlacementGeometry(
        options.deformer.bindPoints,
        options.deformer.points,
        bindBounds,
        options.deformer.placement
    );
    if (!geometry) throw new Error('Warp Grid placement geometry is invalid');
    const sourcePoints = geometry.bindPoints.map(point => toProjectPoint(point, bindBounds));
    const destinationPoints = geometry.points.map(point => toProjectPoint(point, bindBounds));
    const minX = Math.floor(Math.min(...destinationPoints.map(point => point.x)));
    const minY = Math.floor(Math.min(...destinationPoints.map(point => point.y)));
    const maxX = Math.ceil(Math.max(...destinationPoints.map(point => point.x)));
    const maxY = Math.ceil(Math.max(...destinationPoints.map(point => point.y)));
    const destinationBounds = {
        x: minX,
        y: minY,
        width: Math.max(1, maxX - minX),
        height: Math.max(1, maxY - minY)
    };
    // WARPはRaster全体の置換ではなく、Bind mesh領域だけを差し替える。
    // 元Rasterを出力面へ残すことで、GRID枠の再配置だけでは絵が動かない。
    const validation = validateRasterSurfaceSize(unionBounds(sourceBounds, destinationBounds), {
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
    for (let sourceY = 0; sourceY < options.height; sourceY++) {
        const outputY = sourceBounds.y + sourceY - outputBounds.y;
        if (outputY < 0 || outputY >= outputBounds.height) continue;
        const sourceOffset = sourceY * options.width * 4;
        const outputOffset = (outputY * outputBounds.width + sourceBounds.x - outputBounds.x) * 4;
        output.set(options.pixels.subarray(sourceOffset, sourceOffset + options.width * 4), outputOffset);
    }

    // 先に元のBind領域だけを抜き、その場所へ変形meshを描く。
    // これを行わず上描きすると、移動・回転時に元画像が二重化する。
    for (const indices of triangles) {
        const source = indices.map(index => sourcePoints[index]);
        forEachTrianglePixel(source, outputBounds, (projectX, projectY) => {
            const outputOffset = (
                (projectY - outputBounds.y) * outputBounds.width
                + projectX - outputBounds.x
            ) * 4;
            output.fill(0, outputOffset, outputOffset + 4);
        });
    }
    // Pixi previewのMeshは、Bind外に残した元Rasterへsource-overで描かれる。
    // CPU/Bakeも同じ合成にし、透明・半透明sourceがdestination側の元Rasterを
    // 矩形で上書き消去しないようにする。共有edgeはforEachTrianglePixel()の
    // 半開coverageで片側だけへ帰属させ、半透明の継ぎ目が濃くなるのを防ぐ。
    for (const indices of triangles) {
        const destination = indices.map(index => destinationPoints[index]);
        const source = indices.map(index => sourcePoints[index]);
        forEachTrianglePixel(destination, outputBounds, (projectX, projectY, weights) => {
            const outputPixelIndex = (
                (projectY - outputBounds.y) * outputBounds.width
                + projectX - outputBounds.x
            );
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
            const outputOffset = outputPixelIndex * 4;
            compositeSourceOverPixel(output, outputOffset, color);
        });
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
