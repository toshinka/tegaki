/**
 * Raster LINE centerlineから三列Ribbon topology候補を作るpure comparison helper。
 * outputは保存Mesh、SkinWeight、Bone、WARP Poseのいずれも所有しない。
 */

import { RASTER_MESH_MAX_VERTICES } from './raster-bone-skinning.js';
import { analyzeRasterLineCenterline } from './raster-line-centerline.js';

export const RASTER_LINE_RIBBON_DEFAULT_STATION_SPACING = 2;
export const RASTER_LINE_RIBBON_DEFAULT_MIN_TRIANGLE_ANGLE = 3;
export const RASTER_LINE_RIBBON_DEFAULT_MAX_ADJACENT_WIDTH_RATIO = 3;
export const RASTER_LINE_RIBBON_DEFAULT_MIN_COVERAGE_RATIO = 0.5;
export const RASTER_LINE_RIBBON_DEFAULT_MAX_COVERAGE_RATIO = 1.5;
export const RASTER_LINE_RIBBON_DEFAULT_MIN_DEFORMED_WIDTH_RATIO = 0.65;
export const RASTER_LINE_RIBBON_DEFAULT_MAX_DEFORMED_WIDTH_RATIO = 1.25;

const GEOMETRY_EPSILON = 1e-9;
const RAY_STEP = 0.25;

function finitePositive(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : fallback;
}

function distance(left, right) {
    return Math.hypot(right.x - left.x, right.y - left.y);
}

function normalizeVector(x, y) {
    const length = Math.hypot(x, y);
    if (length <= GEOMETRY_EPSILON) return null;
    return { x: x / length, y: y / length };
}

function signedAreaDouble(a, b, c) {
    return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function triangleArea(vertices, triangle) {
    return Math.abs(signedAreaDouble(
        vertices[triangle[0]],
        vertices[triangle[1]],
        vertices[triangle[2]]
    )) / 2;
}

function triangleMinimumAngleDegrees(vertices, triangle) {
    const [a, b, c] = triangle.map(index => vertices[index]);
    const sideLengths = [distance(b, c), distance(c, a), distance(a, b)];
    if (sideLengths.some(length => length <= GEOMETRY_EPSILON)) return 0;
    const angles = sideLengths.map((opposite, index) => {
        const adjacentA = sideLengths[(index + 1) % 3];
        const adjacentB = sideLengths[(index + 2) % 3];
        const cosine = Math.max(-1, Math.min(1,
            (adjacentA ** 2 + adjacentB ** 2 - opposite ** 2) / (2 * adjacentA * adjacentB)
        ));
        return Math.acos(cosine) * 180 / Math.PI;
    });
    return Math.min(...angles);
}

function createOpaqueMask(snapshot, alphaThreshold) {
    const { width, height } = snapshot;
    const mask = new Uint8Array(width * height);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            if (snapshot.pixels[(y * width + x) * 4 + 3] > alphaThreshold) {
                mask[y * width + x] = 1;
            }
        }
    }
    return mask;
}

function isOpaqueAt(mask, width, height, point) {
    const x = Math.floor(point.x);
    const y = Math.floor(point.y);
    return x >= 0 && y >= 0 && x < width && y < height && mask[y * width + x] === 1;
}

function findLastOpaqueOnRay(mask, width, height, origin, direction, maxDistance) {
    if (!direction || !isOpaqueAt(mask, width, height, origin)) return null;
    let lastPoint = { ...origin };
    let lastDistance = 0;
    for (let rayDistance = RAY_STEP; rayDistance <= maxDistance + RAY_STEP; rayDistance += RAY_STEP) {
        const point = {
            x: origin.x + direction.x * rayDistance,
            y: origin.y + direction.y * rayDistance
        };
        if (!isOpaqueAt(mask, width, height, point)) {
            return { point: lastPoint, distance: lastDistance };
        }
        lastPoint = point;
        lastDistance = rayDistance;
    }
    return null;
}

function resampleOpenPolyline(points, spacing, maxStations) {
    const cumulative = [0];
    for (let index = 1; index < points.length; index++) {
        cumulative.push(cumulative[index - 1] + distance(points[index - 1], points[index]));
    }
    const totalLength = cumulative.at(-1);
    if (totalLength <= GEOMETRY_EPSILON) return null;
    const stationCount = Math.max(2, Math.min(maxStations, Math.ceil(totalLength / spacing) + 1));
    const stations = [];
    let sourceIndex = 1;
    for (let stationIndex = 0; stationIndex < stationCount; stationIndex++) {
        const targetDistance = totalLength * stationIndex / (stationCount - 1);
        while (sourceIndex < cumulative.length - 1 && cumulative[sourceIndex] < targetDistance) {
            sourceIndex += 1;
        }
        const previousIndex = Math.max(0, sourceIndex - 1);
        const segmentLength = cumulative[sourceIndex] - cumulative[previousIndex];
        const ratio = segmentLength <= GEOMETRY_EPSILON
            ? 0
            : (targetDistance - cumulative[previousIndex]) / segmentLength;
        stations.push({
            x: points[previousIndex].x + (points[sourceIndex].x - points[previousIndex].x) * ratio,
            y: points[previousIndex].y + (points[sourceIndex].y - points[previousIndex].y) * ratio
        });
    }
    return { stations, totalLength, effectiveSpacing: totalLength / (stationCount - 1) };
}

function tangentAt(points, index) {
    const previous = points[Math.max(0, index - 1)];
    const next = points[Math.min(points.length - 1, index + 1)];
    return normalizeVector(next.x - previous.x, next.y - previous.y);
}

function extendCaps(mask, width, height, stations, maxRayDistance) {
    const firstTangent = tangentAt(stations, 0);
    const lastTangent = tangentAt(stations, stations.length - 1);
    if (!firstTangent || !lastTangent) return false;
    const firstCap = findLastOpaqueOnRay(mask, width, height, stations[0], {
        x: -firstTangent.x,
        y: -firstTangent.y
    }, maxRayDistance);
    const lastCap = findLastOpaqueOnRay(
        mask,
        width,
        height,
        stations.at(-1),
        lastTangent,
        maxRayDistance
    );
    if (!firstCap || !lastCap) return false;
    stations[0] = firstCap.point;
    stations[stations.length - 1] = lastCap.point;
    return true;
}

function orientation(a, b, c) {
    const value = signedAreaDouble(a, b, c);
    if (Math.abs(value) <= GEOMETRY_EPSILON) return 0;
    return value > 0 ? 1 : -1;
}

function pointOnSegment(a, b, point) {
    return Math.min(a.x, b.x) - GEOMETRY_EPSILON <= point.x
        && point.x <= Math.max(a.x, b.x) + GEOMETRY_EPSILON
        && Math.min(a.y, b.y) - GEOMETRY_EPSILON <= point.y
        && point.y <= Math.max(a.y, b.y) + GEOMETRY_EPSILON;
}

function segmentsIntersect(a, b, c, d) {
    const abC = orientation(a, b, c);
    const abD = orientation(a, b, d);
    const cdA = orientation(c, d, a);
    const cdB = orientation(c, d, b);
    if (abC !== abD && cdA !== cdB) return true;
    if (abC === 0 && pointOnSegment(a, b, c)) return true;
    if (abD === 0 && pointOnSegment(a, b, d)) return true;
    if (cdA === 0 && pointOnSegment(c, d, a)) return true;
    if (cdB === 0 && pointOnSegment(c, d, b)) return true;
    return false;
}

function outlineSelfIntersects(outline) {
    for (let leftIndex = 0; leftIndex < outline.length; leftIndex++) {
        const leftNext = (leftIndex + 1) % outline.length;
        for (let rightIndex = leftIndex + 1; rightIndex < outline.length; rightIndex++) {
            const rightNext = (rightIndex + 1) % outline.length;
            if (leftIndex === rightIndex || leftNext === rightIndex || rightNext === leftIndex) continue;
            if (segmentsIntersect(
                outline[leftIndex],
                outline[leftNext],
                outline[rightIndex],
                outline[rightNext]
            )) return true;
        }
    }
    return false;
}

function mapPixelPointToProject(point, rasterBounds, width, height) {
    return {
        x: rasterBounds.x + point.x * rasterBounds.width / width,
        y: rasterBounds.y + point.y * rasterBounds.height / height
    };
}

function normalizedTriangle(vertices, triangle) {
    const areaDouble = signedAreaDouble(
        vertices[triangle[0]],
        vertices[triangle[1]],
        vertices[triangle[2]]
    );
    if (Math.abs(areaDouble) <= GEOMETRY_EPSILON) return null;
    return areaDouble > 0 ? triangle : [triangle[0], triangle[2], triangle[1]];
}

/**
 * 検証済みcenterline候補から、center + left/right railの三列topologyを作る。
 * centerlineはpixel-center座標、output verticesはProject座標。
 */
export function createRasterLineRibbonTopologyFromCenterline(snapshot, centerline, options = {}) {
    if (!centerline?.ok
        || !Array.isArray(centerline.pixelPoints)
        || centerline.pixelPoints.length < 2
        || centerline.pixelPoints.some(point => (
            !point || !Number.isFinite(point.x) || !Number.isFinite(point.y)
        ))) {
        return { ok: false, reason: 'invalid-centerline' };
    }
    const { width, height, alphaThreshold, rasterBounds } = centerline;
    if (!snapshot
        || !Number.isInteger(width)
        || !Number.isInteger(height)
        || width <= 0
        || height <= 0
        || !Number.isFinite(alphaThreshold)
        || snapshot.width !== width
        || snapshot.height !== height
        || !snapshot.pixels
        || snapshot.pixels.length < width * height * 4) {
        return { ok: false, reason: 'invalid-raster' };
    }
    if (!rasterBounds
        || !Number.isFinite(rasterBounds.x)
        || !Number.isFinite(rasterBounds.y)
        || !Number.isFinite(rasterBounds.width)
        || !Number.isFinite(rasterBounds.height)
        || rasterBounds.width <= 0
        || rasterBounds.height <= 0) {
        return { ok: false, reason: 'invalid-raster-bounds' };
    }
    if (!Number.isFinite(centerline.metrics?.opaquePixelCount)
        || centerline.metrics.opaquePixelCount <= 0) {
        return { ok: false, reason: 'invalid-centerline-metrics' };
    }
    const maxVertices = Number.isInteger(options.maxVertices)
        ? Math.min(RASTER_MESH_MAX_VERTICES, options.maxVertices)
        : RASTER_MESH_MAX_VERTICES;
    if (maxVertices < 6) return { ok: false, reason: 'vertex-budget-too-small' };
    const maxStations = Math.floor(maxVertices / 3);
    const stationSpacing = finitePositive(
        options.stationSpacing,
        RASTER_LINE_RIBBON_DEFAULT_STATION_SPACING
    );
    const resampled = resampleOpenPolyline(centerline.pixelPoints, stationSpacing, maxStations);
    if (!resampled || resampled.stations.length < 2) {
        return { ok: false, reason: 'ribbon-too-short' };
    }

    const mask = createOpaqueMask(snapshot, alphaThreshold);
    const maxRayDistance = finitePositive(options.maxRayDistance, Math.hypot(width, height) + 2);
    const pixelCenters = resampled.stations.map(point => ({ ...point }));
    if (!extendCaps(mask, width, height, pixelCenters, maxRayDistance)) {
        return { ok: false, reason: 'cap-boundary-not-found' };
    }

    const pixelStations = [];
    for (let stationIndex = 0; stationIndex < pixelCenters.length; stationIndex++) {
        const center = pixelCenters[stationIndex];
        const tangent = tangentAt(pixelCenters, stationIndex);
        if (!tangent) return { ok: false, reason: 'invalid-station-tangent' };
        const normal = { x: -tangent.y, y: tangent.x };
        const left = findLastOpaqueOnRay(mask, width, height, center, normal, maxRayDistance);
        const right = findLastOpaqueOnRay(mask, width, height, center, {
            x: -normal.x,
            y: -normal.y
        }, maxRayDistance);
        if (!left || !right) return { ok: false, reason: 'rail-boundary-not-found' };
        const totalWidth = left.distance + right.distance;
        if (left.distance <= GEOMETRY_EPSILON
            || right.distance <= GEOMETRY_EPSILON
            || totalWidth <= GEOMETRY_EPSILON) {
            return { ok: false, reason: 'rail-width-too-small' };
        }
        pixelStations.push({
            stationIndex,
            center,
            left: left.point,
            right: right.point,
            tangent,
            normal,
            leftWidth: left.distance,
            rightWidth: right.distance,
            totalWidth
        });
    }

    const maxAdjacentWidthRatio = finitePositive(
        options.maxAdjacentWidthRatio,
        RASTER_LINE_RIBBON_DEFAULT_MAX_ADJACENT_WIDTH_RATIO
    );
    for (let index = 1; index < pixelStations.length; index++) {
        const previousWidth = pixelStations[index - 1].totalWidth;
        const currentWidth = pixelStations[index].totalWidth;
        if (Math.max(previousWidth, currentWidth) / Math.min(previousWidth, currentWidth)
            > maxAdjacentWidthRatio) {
            return { ok: false, reason: 'abrupt-width-change' };
        }
    }

    const pixelOutline = [
        ...pixelStations.map(station => station.left),
        ...pixelStations.map(station => station.right).reverse()
    ];
    if (outlineSelfIntersects(pixelOutline)) {
        return { ok: false, reason: 'self-intersecting-ribbon' };
    }

    const pixelVertices = [];
    const vertices = [];
    for (const station of pixelStations) {
        [
            ['left', station.left],
            ['center', station.center],
            ['right', station.right]
        ].forEach(([kind, point]) => {
            pixelVertices.push({ x: point.x, y: point.y, kind, stationIndex: station.stationIndex });
            vertices.push({
                ...mapPixelPointToProject(point, rasterBounds, width, height),
                kind,
                stationIndex: station.stationIndex
            });
        });
    }

    const triangles = [];
    for (let stationIndex = 0; stationIndex < pixelStations.length - 1; stationIndex++) {
        const current = stationIndex * 3;
        const next = current + 3;
        const candidates = [
            [current, current + 1, next + 1],
            [current, next + 1, next],
            [current + 1, current + 2, next + 2],
            [current + 1, next + 2, next + 1]
        ];
        for (const candidate of candidates) {
            const triangle = normalizedTriangle(vertices, candidate);
            if (!triangle) return { ok: false, reason: 'degenerate-ribbon-triangle' };
            triangles.push(triangle);
        }
    }

    let totalTriangleArea = 0;
    let minTriangleArea = Number.POSITIVE_INFINITY;
    let minTriangleAngle = Number.POSITIVE_INFINITY;
    for (const triangle of triangles) {
        const area = triangleArea(vertices, triangle);
        const angle = triangleMinimumAngleDegrees(vertices, triangle);
        totalTriangleArea += area;
        minTriangleArea = Math.min(minTriangleArea, area);
        minTriangleAngle = Math.min(minTriangleAngle, angle);
    }
    const minimumTriangleAngle = finitePositive(
        options.minimumTriangleAngle,
        RASTER_LINE_RIBBON_DEFAULT_MIN_TRIANGLE_ANGLE
    );
    if (minTriangleAngle < minimumTriangleAngle) {
        return {
            ok: false,
            reason: 'minimum-triangle-angle',
            metrics: { minTriangleAngle, minimumTriangleAngle }
        };
    }

    const scaleArea = Math.abs(rasterBounds.width / width * rasterBounds.height / height);
    const expectedOpaqueArea = centerline.metrics.opaquePixelCount * scaleArea;
    const coverageRatio = totalTriangleArea / expectedOpaqueArea;
    const minCoverageRatio = finitePositive(
        options.minCoverageRatio,
        RASTER_LINE_RIBBON_DEFAULT_MIN_COVERAGE_RATIO
    );
    const maxCoverageRatio = finitePositive(
        options.maxCoverageRatio,
        RASTER_LINE_RIBBON_DEFAULT_MAX_COVERAGE_RATIO
    );
    if (coverageRatio < minCoverageRatio || coverageRatio > maxCoverageRatio) {
        return {
            ok: false,
            reason: 'coverage-ratio-out-of-range',
            metrics: { coverageRatio, minCoverageRatio, maxCoverageRatio }
        };
    }

    return {
        ok: true,
        reason: null,
        mode: 'line-ribbon-three-rail',
        vertices,
        pixelVertices,
        triangles,
        stations: pixelStations.map(station => ({
            stationIndex: station.stationIndex,
            center: mapPixelPointToProject(station.center, rasterBounds, width, height),
            left: mapPixelPointToProject(station.left, rasterBounds, width, height),
            right: mapPixelPointToProject(station.right, rasterBounds, width, height),
            pixelCenter: { ...station.center },
            pixelLeft: { ...station.left },
            pixelRight: { ...station.right },
            leftWidth: station.leftWidth,
            rightWidth: station.rightWidth,
            totalWidth: station.totalWidth
        })),
        metrics: {
            vertexCount: vertices.length,
            stationCount: pixelStations.length,
            triangleCount: triangles.length,
            centerlinePixelLength: resampled.totalLength,
            effectiveStationSpacing: resampled.effectiveSpacing,
            expectedOpaqueArea,
            totalTriangleArea,
            coverageRatio,
            minTriangleArea: Number.isFinite(minTriangleArea) ? minTriangleArea : 0,
            minTriangleAngle: Number.isFinite(minTriangleAngle) ? minTriangleAngle : 0,
            minWidth: Math.min(...pixelStations.map(station => station.totalWidth)),
            maxWidth: Math.max(...pixelStations.map(station => station.totalWidth))
        }
    };
}

/** Raster snapshotからLINE centerline解析と三列Ribbon候補生成を一度に行う。 */
export function createRasterLineRibbonTopology(snapshot, options = {}) {
    const centerline = analyzeRasterLineCenterline(snapshot, options);
    if (!centerline.ok) return { ...centerline, source: 'centerline' };
    const ribbon = createRasterLineRibbonTopologyFromCenterline(snapshot, centerline, options);
    return ribbon.ok ? { ...ribbon, centerline } : ribbon;
}

/** 既存LBS評価後の三列Ribbonについて、線幅・triangle・outlineをpure検査する。 */
export function analyzeRasterLineRibbonDeformation(topology, deformedVertices, options = {}) {
    if (!topology?.ok
        || !Array.isArray(topology.vertices)
        || topology.vertices.length < 6
        || topology.vertices.length % 3 !== 0
        || !Array.isArray(topology.triangles)
        || !Array.isArray(deformedVertices)
        || deformedVertices.length !== topology.vertices.length
        || deformedVertices.some(vertex => (
            !vertex || !Number.isFinite(vertex.x) || !Number.isFinite(vertex.y)
        ))) {
        return { ok: false, reason: 'invalid-ribbon-deformation-input' };
    }
    const stationCount = topology.vertices.length / 3;
    const widthRatios = [];
    for (let stationIndex = 0; stationIndex < stationCount; stationIndex++) {
        const leftIndex = stationIndex * 3;
        const rightIndex = leftIndex + 2;
        const bindWidth = distance(topology.vertices[leftIndex], topology.vertices[rightIndex]);
        const deformedWidth = distance(deformedVertices[leftIndex], deformedVertices[rightIndex]);
        if (bindWidth <= GEOMETRY_EPSILON || deformedWidth <= GEOMETRY_EPSILON) {
            return { ok: false, reason: 'deformed-width-collapsed' };
        }
        widthRatios.push(deformedWidth / bindWidth);
    }

    let invertedTriangleCount = 0;
    let degenerateTriangleCount = 0;
    for (const triangle of topology.triangles) {
        if (!Array.isArray(triangle)
            || triangle.length !== 3
            || triangle.some(index => !Number.isInteger(index) || index < 0 || index >= topology.vertices.length)) {
            return { ok: false, reason: 'invalid-ribbon-triangle' };
        }
        const bindAreaDouble = signedAreaDouble(
            topology.vertices[triangle[0]],
            topology.vertices[triangle[1]],
            topology.vertices[triangle[2]]
        );
        const deformedAreaDouble = signedAreaDouble(
            deformedVertices[triangle[0]],
            deformedVertices[triangle[1]],
            deformedVertices[triangle[2]]
        );
        if (Math.abs(deformedAreaDouble) <= GEOMETRY_EPSILON) {
            degenerateTriangleCount += 1;
        } else if (bindAreaDouble * deformedAreaDouble < 0) {
            invertedTriangleCount += 1;
        }
    }
    if (degenerateTriangleCount > 0) {
        return { ok: false, reason: 'deformed-triangle-degenerate', metrics: { degenerateTriangleCount } };
    }
    if (invertedTriangleCount > 0) {
        return { ok: false, reason: 'deformed-triangle-inverted', metrics: { invertedTriangleCount } };
    }

    const outline = [
        ...Array.from({ length: stationCount }, (_, index) => deformedVertices[index * 3]),
        ...Array.from({ length: stationCount }, (_, index) => (
            deformedVertices[(stationCount - 1 - index) * 3 + 2]
        ))
    ];
    if (outlineSelfIntersects(outline)) {
        return { ok: false, reason: 'deformed-outline-self-intersection' };
    }

    const minWidthRatio = Math.min(...widthRatios);
    const maxWidthRatio = Math.max(...widthRatios);
    const minimumAcceptedWidthRatio = finitePositive(
        options.minimumDeformedWidthRatio,
        RASTER_LINE_RIBBON_DEFAULT_MIN_DEFORMED_WIDTH_RATIO
    );
    const maximumAcceptedWidthRatio = finitePositive(
        options.maximumDeformedWidthRatio,
        RASTER_LINE_RIBBON_DEFAULT_MAX_DEFORMED_WIDTH_RATIO
    );
    const metrics = {
        stationCount,
        minWidthRatio,
        maxWidthRatio,
        maximumWidthError: Math.max(
            Math.abs(1 - minWidthRatio),
            Math.abs(maxWidthRatio - 1)
        ),
        invertedTriangleCount,
        degenerateTriangleCount,
        selfIntersects: false
    };
    if (minWidthRatio < minimumAcceptedWidthRatio || maxWidthRatio > maximumAcceptedWidthRatio) {
        return {
            ok: false,
            reason: 'deformed-width-ratio-out-of-range',
            metrics: {
                ...metrics,
                minimumAcceptedWidthRatio,
                maximumAcceptedWidthRatio
            }
        };
    }
    return { ok: true, reason: null, metrics };
}
