/**
 * alpha contour解析結果からFILL用triangle候補を生成するpure comparison helper。
 * outputは保存Meshではなく、vertex ID / SkinWeight / WARP Poseを所有しない。
 */

import earcut from 'earcut';
import { RASTER_MESH_MAX_VERTICES } from './raster-bone-skinning.js';
import { prepareAutoShapeContourBudget } from './auto-shape-contour-budget.js';

export const AUTO_SHAPE_FILL_MODE_CONTOUR = 'contour-only';
export const AUTO_SHAPE_FILL_MODE_INTERIOR = 'interior-support';
export const AUTO_SHAPE_FILL_DEFAULT_MAX_INTERIOR_POINTS = 64;

const AREA_EPSILON = 1e-9;

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

function distanceSquared(left, right) {
    return (left.x - right.x) ** 2 + (left.y - right.y) ** 2;
}

function barycentricCoordinates(point, a, b, c) {
    const denominator = signedAreaDouble(a, b, c);
    if (Math.abs(denominator) <= AREA_EPSILON) return null;
    const wa = signedAreaDouble(point, b, c) / denominator;
    const wb = signedAreaDouble(a, point, c) / denominator;
    const wc = 1 - wa - wb;
    return { wa, wb, wc };
}

function expectedContourArea(analysis) {
    return analysis.components.reduce((componentSum, component) => (
        componentSum + component.contours.reduce((sum, contour) => sum + contour.signedArea, 0)
    ), 0);
}

function createBoundaryTopology(analysis, maxVertices) {
    const boundaryVertexCount = analysis.components.reduce((sum, component) => (
        sum + component.contours.reduce((contourSum, contour) => contourSum + contour.points.length, 0)
    ), 0);
    if (boundaryVertexCount > maxVertices) {
        return { ok: false, reason: 'boundary-vertex-limit' };
    }

    const vertices = [];
    const triangles = [];
    const triangleComponents = [];
    for (const component of analysis.components) {
        if (component.outerContours.length !== 1) {
            return { ok: false, reason: 'unsupported-outer-contour-count' };
        }
        const contours = [component.outerContours[0], ...component.holeContours];
        const flat = [];
        const holes = [];
        let localVertexCount = 0;
        contours.forEach((contour, contourIndex) => {
            if (contourIndex > 0) holes.push(localVertexCount);
            contour.points.forEach((point, contourPointIndex) => {
                flat.push(point.x, point.y);
                vertices.push({
                    x: point.x,
                    y: point.y,
                    kind: contour.kind,
                    componentIndex: component.componentIndex,
                    contourIndex,
                    contourPointIndex
                });
                localVertexCount += 1;
            });
        });
        const indices = earcut(flat, holes, 2);
        if (!Array.isArray(indices) || indices.length === 0 || indices.length % 3 !== 0) {
            return { ok: false, reason: 'triangulation-failed' };
        }
        const baseIndex = vertices.length - localVertexCount;
        for (let index = 0; index < indices.length; index += 3) {
            const triangle = [
                baseIndex + indices[index],
                baseIndex + indices[index + 1],
                baseIndex + indices[index + 2]
            ];
            if (triangleArea(vertices, triangle) <= AREA_EPSILON) {
                return { ok: false, reason: 'degenerate-triangle' };
            }
            triangles.push(triangle);
            triangleComponents.push(component.componentIndex);
        }
    }
    return {
        ok: true,
        reason: null,
        vertices,
        triangles,
        triangleComponents,
        boundaryVertexCount
    };
}

function createInteriorCandidates(component, spacing) {
    const bounds = component.outerContours[0].bounds;
    const points = [];
    for (let y = bounds.y + spacing * 0.5; y < bounds.y + bounds.height; y += spacing) {
        for (let x = bounds.x + spacing * 0.5; x < bounds.x + bounds.width; x += spacing) {
            points.push({ x, y, componentIndex: component.componentIndex });
        }
    }
    return points;
}

function insertInteriorSupport(topology, analysis, options, maxVertices) {
    const available = Math.max(0, maxVertices - topology.vertices.length);
    const requested = Number.isInteger(options.maxInteriorPoints)
        ? Math.max(0, options.maxInteriorPoints)
        : AUTO_SHAPE_FILL_DEFAULT_MAX_INTERIOR_POINTS;
    const maxInteriorPoints = Math.min(available, requested);
    if (maxInteriorPoints === 0) return 0;
    const area = expectedContourArea(analysis);
    const explicitSpacing = Number(options.interiorSpacing);
    const spacing = Number.isFinite(explicitSpacing) && explicitSpacing > 0
        ? explicitSpacing
        : Math.max(1, Math.sqrt(area / Math.max(1, maxInteriorPoints)));
    const minimumWeight = Math.max(1e-6, Math.min(0.25, Number(options.minimumBarycentricWeight) || 0.02));
    const minimumDistance = Math.max(1e-6, Number(options.minimumVertexDistance) || spacing * 0.2);
    const minimumDistanceSquared = minimumDistance ** 2;
    const candidates = analysis.components.flatMap(component => createInteriorCandidates(component, spacing));
    let inserted = 0;

    for (const candidate of candidates) {
        if (inserted >= maxInteriorPoints) break;
        if (topology.vertices.some(vertex => distanceSquared(vertex, candidate) <= minimumDistanceSquared)) {
            continue;
        }
        let triangleIndex = -1;
        for (let index = 0; index < topology.triangles.length; index++) {
            if (topology.triangleComponents[index] !== candidate.componentIndex) continue;
            const triangle = topology.triangles[index];
            const weights = barycentricCoordinates(
                candidate,
                topology.vertices[triangle[0]],
                topology.vertices[triangle[1]],
                topology.vertices[triangle[2]]
            );
            if (weights
                && weights.wa > minimumWeight
                && weights.wb > minimumWeight
                && weights.wc > minimumWeight) {
                triangleIndex = index;
                break;
            }
        }
        if (triangleIndex < 0) continue;
        const sourceTriangle = topology.triangles[triangleIndex];
        const vertexIndex = topology.vertices.length;
        const nextTriangles = [
            [sourceTriangle[0], sourceTriangle[1], vertexIndex],
            [sourceTriangle[1], sourceTriangle[2], vertexIndex],
            [sourceTriangle[2], sourceTriangle[0], vertexIndex]
        ];
        topology.vertices.push({
            x: candidate.x,
            y: candidate.y,
            kind: 'interior',
            componentIndex: candidate.componentIndex
        });
        if (nextTriangles.some(triangle => triangleArea(topology.vertices, triangle) <= AREA_EPSILON)) {
            topology.vertices.pop();
            continue;
        }
        topology.triangles[triangleIndex] = nextTriangles[0];
        topology.triangles.push(nextTriangles[1], nextTriangles[2]);
        topology.triangleComponents.push(candidate.componentIndex, candidate.componentIndex);
        inserted += 1;
    }
    return inserted;
}

function calculateMetrics(topology, expectedArea) {
    let totalTriangleArea = 0;
    let minTriangleArea = Number.POSITIVE_INFINITY;
    let maxTriangleArea = 0;
    let maxTriangleQuality = 0;
    topology.triangles.forEach(triangle => {
        const points = triangle.map(index => topology.vertices[index]);
        const area = triangleArea(topology.vertices, triangle);
        const edgeSquaredSum = distanceSquared(points[0], points[1])
            + distanceSquared(points[1], points[2])
            + distanceSquared(points[2], points[0]);
        const quality = edgeSquaredSum / Math.max(AREA_EPSILON, 4 * Math.sqrt(3) * area);
        totalTriangleArea += area;
        minTriangleArea = Math.min(minTriangleArea, area);
        maxTriangleArea = Math.max(maxTriangleArea, area);
        maxTriangleQuality = Math.max(maxTriangleQuality, quality);
    });
    return {
        vertexCount: topology.vertices.length,
        boundaryVertexCount: topology.boundaryVertexCount,
        interiorVertexCount: topology.vertices.length - topology.boundaryVertexCount,
        triangleCount: topology.triangles.length,
        expectedArea,
        totalTriangleArea,
        areaError: Math.abs(totalTriangleArea - expectedArea),
        minTriangleArea: Number.isFinite(minTriangleArea) ? minTriangleArea : 0,
        maxTriangleArea,
        maxTriangleQuality
    };
}

/** contour解析結果から保存前のFILL topology候補を作る。 */
export function createAutoShapeFillTopology(analysis, options = {}) {
    if (!analysis?.ok || !Array.isArray(analysis.components) || analysis.components.length === 0) {
        return { ok: false, reason: 'invalid-contour-analysis' };
    }
    const mode = options.mode || AUTO_SHAPE_FILL_MODE_CONTOUR;
    if (![AUTO_SHAPE_FILL_MODE_CONTOUR, AUTO_SHAPE_FILL_MODE_INTERIOR].includes(mode)) {
        return { ok: false, reason: 'unsupported-fill-mode' };
    }
    const maxVertices = Number.isInteger(options.maxVertices)
        ? Math.max(3, Math.min(RASTER_MESH_MAX_VERTICES, options.maxVertices))
        : RASTER_MESH_MAX_VERTICES;
    const topology = createBoundaryTopology(analysis, maxVertices);
    if (!topology.ok) return topology;
    const interiorVertexCount = mode === AUTO_SHAPE_FILL_MODE_INTERIOR
        ? insertInteriorSupport(topology, analysis, options, maxVertices)
        : 0;
    const expectedArea = expectedContourArea(analysis);
    const metrics = calculateMetrics(topology, expectedArea);
    if (metrics.areaError > Math.max(AREA_EPSILON, expectedArea * 1e-9)) {
        return { ok: false, reason: 'coverage-mismatch', metrics };
    }
    return {
        ok: true,
        reason: null,
        mode,
        vertices: topology.vertices.map(vertex => ({ ...vertex })),
        triangles: topology.triangles.map(triangle => [...triangle]),
        componentCount: analysis.components.length,
        interiorVertexCount,
        metrics
    };
}

function guardedBoundaryKey(componentIndex, contourIndex, contourPointIndex) {
    return `${componentIndex}:${contourIndex}:${contourPointIndex}`;
}

/** contour budget、透明guard ring、interior supportを一つの保存前topology候補へ合成する。 */
export function createGuardedAutoShapeFillTopology(analysis, options = {}) {
    const budget = prepareAutoShapeContourBudget(analysis, options);
    if (!budget.ok) return budget;
    const fillVertexLimit = budget.maxVertices - budget.guardVertexCount;
    const fill = createAutoShapeFillTopology(budget.analysis, {
        ...options,
        mode: AUTO_SHAPE_FILL_MODE_INTERIOR,
        maxVertices: fillVertexLimit,
        maxInteriorPoints: Math.min(
            budget.availableInteriorVertices,
            Number.isInteger(options.maxInteriorPoints)
                ? Math.max(0, options.maxInteriorPoints)
                : budget.reservedInteriorVertices
        )
    });
    if (!fill.ok) return fill;

    const vertices = fill.vertices.map(vertex => ({ ...vertex }));
    const triangles = fill.triangles.map(triangle => [...triangle]);
    const triangleRegions = triangles.map(() => 'fill');
    const boundaryIndexByKey = new Map();
    vertices.forEach((vertex, index) => {
        if (vertex.kind === 'interior') return;
        boundaryIndexByKey.set(guardedBoundaryKey(
            vertex.componentIndex,
            vertex.contourIndex,
            vertex.contourPointIndex
        ), index);
    });

    let guardArea = 0;
    for (const guard of budget.guardContours) {
        const guardIndices = guard.points.map(point => {
            const index = vertices.length;
            vertices.push({
                x: point.x,
                y: point.y,
                kind: 'guard',
                sourceKind: guard.kind,
                componentIndex: guard.componentIndex,
                contourIndex: guard.contourIndex
            });
            return index;
        });
        for (let pointIndex = 0; pointIndex < guard.points.length; pointIndex++) {
            const nextPointIndex = (pointIndex + 1) % guard.points.length;
            const boundaryCurrent = boundaryIndexByKey.get(guardedBoundaryKey(
                guard.componentIndex,
                guard.contourIndex,
                pointIndex
            ));
            const boundaryNext = boundaryIndexByKey.get(guardedBoundaryKey(
                guard.componentIndex,
                guard.contourIndex,
                nextPointIndex
            ));
            if (!Number.isInteger(boundaryCurrent) || !Number.isInteger(boundaryNext)) {
                return { ok: false, reason: 'guard-boundary-map-failed' };
            }
            const ringTriangles = [
                [guardIndices[pointIndex], boundaryCurrent, boundaryNext],
                [guardIndices[pointIndex], boundaryNext, guardIndices[nextPointIndex]]
            ];
            for (const triangle of ringTriangles) {
                const area = triangleArea(vertices, triangle);
                if (area <= AREA_EPSILON) return { ok: false, reason: 'degenerate-guard-triangle' };
                guardArea += area;
                triangles.push(triangle);
                triangleRegions.push('guard');
            }
        }
    }
    if (vertices.length > budget.maxVertices) {
        return { ok: false, reason: 'vertex-budget-exceeded' };
    }
    return {
        ok: true,
        reason: null,
        mode: 'guarded-interior',
        vertices,
        triangles,
        triangleRegions,
        componentCount: fill.componentCount,
        budget,
        metrics: {
            ...fill.metrics,
            vertexCount: vertices.length,
            interiorVertexCount: fill.metrics.interiorVertexCount,
            guardVertexCount: budget.guardVertexCount,
            guardTriangleCount: triangleRegions.filter(region => region === 'guard').length,
            fillTriangleCount: fill.triangles.length,
            triangleCount: triangles.length,
            guardArea
        }
    };
}
