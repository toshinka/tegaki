/**
 * Auto Shape輪郭をtopology検証付きでvertex budgetへ縮約し、透明側guard候補を作るpure helper。
 * 保存ID、SkinWeight、WARP / Bone Pose、DOM、rendererは所有しない。
 */

import { RASTER_MESH_MAX_VERTICES } from './raster-bone-skinning.js';

export const AUTO_SHAPE_DEFAULT_GUARD_DISTANCE = 1;
export const AUTO_SHAPE_MIN_GUARD_DISTANCE = 0.125;
export const AUTO_SHAPE_DEFAULT_RESERVED_INTERIOR_VERTICES = 48;

const EPSILON = 1e-9;

function cross(a, b, c) {
    return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
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

function boundsFromPoints(points) {
    const xs = points.map(point => point.x);
    const ys = points.map(point => point.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const maxX = Math.max(...xs);
    const maxY = Math.max(...ys);
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function rotateEntriesToCanonicalStart(entries) {
    let startIndex = 0;
    for (let index = 1; index < entries.length; index++) {
        const point = entries[index].point;
        const start = entries[startIndex].point;
        if (point.y < start.y || (point.y === start.y && point.x < start.x)) {
            startIndex = index;
        }
    }
    return entries.map((_, index) => entries[(startIndex + index) % entries.length]);
}

function orientation(a, b, c) {
    const value = cross(a, b, c);
    if (Math.abs(value) <= EPSILON) return 0;
    return value > 0 ? 1 : -1;
}

function onSegment(a, b, point) {
    return Math.abs(cross(a, b, point)) <= EPSILON
        && point.x >= Math.min(a.x, b.x) - EPSILON
        && point.x <= Math.max(a.x, b.x) + EPSILON
        && point.y >= Math.min(a.y, b.y) - EPSILON
        && point.y <= Math.max(a.y, b.y) + EPSILON;
}

function segmentsIntersect(a, b, c, d) {
    const abC = orientation(a, b, c);
    const abD = orientation(a, b, d);
    const cdA = orientation(c, d, a);
    const cdB = orientation(c, d, b);
    if (abC !== abD && cdA !== cdB) return true;
    return (abC === 0 && onSegment(a, b, c))
        || (abD === 0 && onSegment(a, b, d))
        || (cdA === 0 && onSegment(c, d, a))
        || (cdB === 0 && onSegment(c, d, b));
}

function polygonIsSimple(points) {
    if (!Array.isArray(points) || points.length < 3) return false;
    for (let left = 0; left < points.length; left++) {
        const leftNext = (left + 1) % points.length;
        for (let right = left + 1; right < points.length; right++) {
            const rightNext = (right + 1) % points.length;
            if (left === right || leftNext === right || rightNext === left) continue;
            if (left === 0 && rightNext === 0) continue;
            if (segmentsIntersect(points[left], points[leftNext], points[right], points[rightNext])) {
                return false;
            }
        }
    }
    return true;
}

function polygonsIntersect(left, right) {
    for (let leftIndex = 0; leftIndex < left.length; leftIndex++) {
        const leftNext = (leftIndex + 1) % left.length;
        for (let rightIndex = 0; rightIndex < right.length; rightIndex++) {
            const rightNext = (rightIndex + 1) % right.length;
            if (segmentsIntersect(
                left[leftIndex],
                left[leftNext],
                right[rightIndex],
                right[rightNext]
            )) return true;
        }
    }
    return false;
}

function pointInPolygon(point, polygon) {
    let inside = false;
    for (let current = 0, previous = polygon.length - 1; current < polygon.length; previous = current++) {
        const a = polygon[current];
        const b = polygon[previous];
        if (onSegment(a, b, point)) return true;
        const intersects = ((a.y > point.y) !== (b.y > point.y))
            && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x;
        if (intersects) inside = !inside;
    }
    return inside;
}

function validateComponentContours(contours) {
    const outer = contours.filter(contour => contour.kind === 'outer');
    const holes = contours.filter(contour => contour.kind === 'hole');
    if (outer.length !== 1) return false;
    if (contours.some(contour => !polygonIsSimple(contour.entries.map(entry => entry.point)))) return false;
    for (let left = 0; left < contours.length; left++) {
        for (let right = left + 1; right < contours.length; right++) {
            if (polygonsIntersect(
                contours[left].entries.map(entry => entry.point),
                contours[right].entries.map(entry => entry.point)
            )) return false;
        }
    }
    const outerPoints = outer[0].entries.map(entry => entry.point);
    if (holes.some(hole => !pointInPolygon(hole.entries[0].point, outerPoints))) return false;
    for (let left = 0; left < holes.length; left++) {
        for (let right = left + 1; right < holes.length; right++) {
            const leftPoints = holes[left].entries.map(entry => entry.point);
            const rightPoints = holes[right].entries.map(entry => entry.point);
            if (pointInPolygon(leftPoints[0], rightPoints) || pointInPolygon(rightPoints[0], leftPoints)) {
                return false;
            }
        }
    }
    return true;
}

function cloneWorkingComponents(analysis) {
    return analysis.components.map(component => ({
        componentIndex: component.componentIndex,
        source: component,
        contours: component.contours.map((contour, contourIndex) => ({
            componentIndex: component.componentIndex,
            contourIndex,
            kind: contour.kind,
            sourceSign: Math.sign(contour.signedArea),
            entries: contour.points.map((point, pointIndex) => ({
                point: { ...point },
                pixelPoint: contour.pixelPoints?.[pointIndex]
                    ? { ...contour.pixelPoints[pointIndex] }
                    : null
            }))
        }))
    }));
}

function totalArea(components) {
    return components.reduce((componentSum, component) => (
        componentSum + component.contours.reduce((sum, contour) => (
            sum + signedArea(contour.entries.map(entry => entry.point))
        ), 0)
    ), 0);
}

function boundaryVertexCount(components) {
    return components.reduce((componentSum, component) => (
        componentSum + component.contours.reduce((sum, contour) => sum + contour.entries.length, 0)
    ), 0);
}

function reduceContours(components, targetCount, maxAreaError) {
    const originalArea = totalArea(components);
    let currentCount = boundaryVertexCount(components);
    while (currentCount > targetCount) {
        const candidates = [];
        components.forEach((component, componentOrder) => {
            component.contours.forEach((contour, contourOrder) => {
                if (contour.entries.length <= 3) return;
                contour.entries.forEach((entry, pointIndex) => {
                    const previous = contour.entries[(pointIndex - 1 + contour.entries.length) % contour.entries.length].point;
                    const next = contour.entries[(pointIndex + 1) % contour.entries.length].point;
                    candidates.push({
                        score: Math.abs(cross(previous, entry.point, next)),
                        componentOrder,
                        contourOrder,
                        pointIndex
                    });
                });
            });
        });
        candidates.sort((left, right) => (
            left.score - right.score
            || left.componentOrder - right.componentOrder
            || left.contourOrder - right.contourOrder
            || left.pointIndex - right.pointIndex
        ));
        let removed = false;
        for (const candidate of candidates) {
            const component = components[candidate.componentOrder];
            const contour = component.contours[candidate.contourOrder];
            const previousEntries = contour.entries;
            const nextEntries = rotateEntriesToCanonicalStart(
                previousEntries.filter((_, index) => index !== candidate.pointIndex)
            );
            const nextArea = signedArea(nextEntries.map(entry => entry.point));
            if (nextEntries.length < 3
                || Math.sign(nextArea) !== contour.sourceSign
                || Math.abs(nextArea) <= EPSILON) continue;
            contour.entries = nextEntries;
            const areaError = Math.abs(totalArea(components) - originalArea);
            if (areaError <= maxAreaError && validateComponentContours(component.contours)) {
                currentCount -= 1;
                removed = true;
                break;
            }
            contour.entries = previousEntries;
        }
        if (!removed) break;
    }
    return {
        ok: currentCount <= targetCount,
        boundaryVertexCount: currentCount,
        originalArea,
        reducedArea: totalArea(components),
        areaError: Math.abs(totalArea(components) - originalArea)
    };
}

function rebuildAnalysis(analysis, components) {
    const rebuiltComponents = components.map(component => {
        const contours = component.contours.map(contour => {
            const entries = rotateEntriesToCanonicalStart(contour.entries);
            const points = entries.map(entry => ({ ...entry.point }));
            const pixelPoints = entries.every(entry => entry.pixelPoint)
                ? entries.map(entry => ({ ...entry.pixelPoint }))
                : [];
            return {
                kind: contour.kind,
                points,
                pixelPoints,
                bounds: boundsFromPoints(points),
                pixelBounds: pixelPoints.length > 0 ? boundsFromPoints(pixelPoints) : null,
                signedArea: signedArea(points),
                signedPixelArea: pixelPoints.length > 0 ? signedArea(pixelPoints) : null
            };
        });
        return {
            ...component.source,
            contours,
            outerContours: contours.filter(contour => contour.kind === 'outer'),
            holeContours: contours.filter(contour => contour.kind === 'hole')
        };
    });
    return {
        ...analysis,
        components: rebuiltComponents,
        componentCount: rebuiltComponents.length,
        contourCount: rebuiltComponents.reduce((sum, component) => sum + component.contours.length, 0),
        holeCount: rebuiltComponents.reduce((sum, component) => sum + component.holeContours.length, 0)
    };
}

function normalizeVector(dx, dy) {
    const length = Math.hypot(dx, dy);
    return length > EPSILON ? { x: dx / length, y: dy / length } : null;
}

function lineIntersection(pointA, directionA, pointB, directionB) {
    const denominator = directionA.x * directionB.y - directionA.y * directionB.x;
    if (Math.abs(denominator) <= EPSILON) return null;
    const dx = pointB.x - pointA.x;
    const dy = pointB.y - pointA.y;
    const amount = (dx * directionB.y - dy * directionB.x) / denominator;
    return {
        x: pointA.x + directionA.x * amount,
        y: pointA.y + directionA.y * amount
    };
}

function offsetContour(points, distance, miterLimit) {
    const result = [];
    for (let index = 0; index < points.length; index++) {
        const previous = points[(index - 1 + points.length) % points.length];
        const current = points[index];
        const next = points[(index + 1) % points.length];
        const incoming = normalizeVector(current.x - previous.x, current.y - previous.y);
        const outgoing = normalizeVector(next.x - current.x, next.y - current.y);
        if (!incoming || !outgoing) return null;
        // contourはscreen座標でopaqueを右に保つため、代数座標ではopaqueが左側になる。
        // guardは透明側へ出すので各edgeの右法線を使う。
        const incomingNormal = { x: incoming.y, y: -incoming.x };
        const outgoingNormal = { x: outgoing.y, y: -outgoing.x };
        const incomingPoint = {
            x: current.x + incomingNormal.x * distance,
            y: current.y + incomingNormal.y * distance
        };
        const outgoingPoint = {
            x: current.x + outgoingNormal.x * distance,
            y: current.y + outgoingNormal.y * distance
        };
        let offset = lineIntersection(incomingPoint, incoming, outgoingPoint, outgoing);
        if (!offset || Math.hypot(offset.x - current.x, offset.y - current.y) > distance * miterLimit) {
            const average = normalizeVector(
                incomingNormal.x + outgoingNormal.x,
                incomingNormal.y + outgoingNormal.y
            ) || incomingNormal;
            offset = {
                x: current.x + average.x * distance,
                y: current.y + average.y * distance
            };
        }
        result.push(offset);
    }
    return result;
}

function pointsWithinBounds(points, bounds) {
    return points.every(point => (
        point.x >= bounds.x - EPSILON
        && point.y >= bounds.y - EPSILON
        && point.x <= bounds.x + bounds.width + EPSILON
        && point.y <= bounds.y + bounds.height + EPSILON
    ));
}

function buildGuardContours(reducedAnalysis, distance, miterLimit) {
    const guards = [];
    for (const component of reducedAnalysis.components) {
        for (let contourIndex = 0; contourIndex < component.contours.length; contourIndex++) {
            const contour = component.contours[contourIndex];
            const points = offsetContour(contour.points, distance, miterLimit);
            if (!points || !polygonIsSimple(points) || Math.sign(signedArea(points)) !== Math.sign(contour.signedArea)) {
                return { ok: false, reason: 'guard-invalid', guards: [] };
            }
            const sourceArea = Math.abs(contour.signedArea);
            const guardArea = Math.abs(signedArea(points));
            const directionValid = contour.kind === 'outer'
                ? guardArea > sourceArea + EPSILON
                : guardArea < sourceArea - EPSILON;
            const sideValid = contour.kind === 'outer'
                ? contour.points.every(point => pointInPolygon(point, points))
                : points.every(point => pointInPolygon(point, contour.points));
            if (!directionValid || !sideValid || polygonsIntersect(points, contour.points)) {
                return { ok: false, reason: 'guard-invalid', guards: [] };
            }
            if (!pointsWithinBounds(points, reducedAnalysis.rasterBounds)) {
                return { ok: false, reason: 'guard-padding-required', guards: [] };
            }
            guards.push({
                componentIndex: component.componentIndex,
                contourIndex,
                kind: contour.kind,
                sourcePoints: contour.points.map(point => ({ ...point })),
                points: points.map(point => ({ ...point })),
                signedArea: signedArea(points)
            });
        }
    }
    for (let left = 0; left < guards.length; left++) {
        for (let right = left + 1; right < guards.length; right++) {
            const differentComponents = guards[left].componentIndex !== guards[right].componentIndex;
            if (polygonsIntersect(guards[left].points, guards[right].points)
                || (differentComponents && (
                    pointInPolygon(guards[left].points[0], guards[right].points)
                    || pointInPolygon(guards[right].points[0], guards[left].points)
                ))) {
                return { ok: false, reason: 'guard-overlap', guards: [] };
            }
        }
    }
    for (const guard of guards) {
        for (const component of reducedAnalysis.components) {
            for (let contourIndex = 0; contourIndex < component.contours.length; contourIndex++) {
                if (component.componentIndex === guard.componentIndex && contourIndex === guard.contourIndex) {
                    continue;
                }
                const source = component.contours[contourIndex].points;
                if (polygonsIntersect(guard.points, source)
                    || (component.componentIndex !== guard.componentIndex && (
                        pointInPolygon(source[0], guard.points)
                        || pointInPolygon(guard.points[0], source)
                    ))) {
                    return { ok: false, reason: 'guard-overlap', guards: [] };
                }
            }
        }
    }
    return { ok: true, reason: null, guards };
}

/** topologyを維持した輪郭縮約と、透明側guard候補のbudgetを返す。 */
export function prepareAutoShapeContourBudget(analysis, options = {}) {
    if (!analysis?.ok || !Array.isArray(analysis.components) || analysis.components.length === 0) {
        return { ok: false, reason: 'invalid-contour-analysis' };
    }
    const maxVertices = Number.isInteger(options.maxVertices)
        ? Math.max(3, Math.min(RASTER_MESH_MAX_VERTICES, options.maxVertices))
        : RASTER_MESH_MAX_VERTICES;
    const reservedInteriorVertices = Number.isInteger(options.reservedInteriorVertices)
        ? Math.max(0, options.reservedInteriorVertices)
        : AUTO_SHAPE_DEFAULT_RESERVED_INTERIOR_VERTICES;
    const contourCount = analysis.components.reduce((sum, component) => sum + component.contours.length, 0);
    const minimumBoundaryVertices = contourCount * 3;
    const derivedBoundaryBudget = Math.floor((maxVertices - reservedInteriorVertices) / 2);
    const requestedBoundaryBudget = Number.isInteger(options.maxBoundaryVertices)
        ? options.maxBoundaryVertices
        : derivedBoundaryBudget;
    const maxBoundaryVertices = Math.max(minimumBoundaryVertices, Math.min(
        requestedBoundaryBudget,
        Math.floor(maxVertices / 2)
    ));
    if (maxBoundaryVertices * 2 + reservedInteriorVertices > maxVertices) {
        return { ok: false, reason: 'vertex-budget-invalid' };
    }
    const components = cloneWorkingComponents(analysis);
    if (components.some(component => !validateComponentContours(component.contours))) {
        return { ok: false, reason: 'invalid-contour-topology' };
    }
    const originalArea = totalArea(components);
    const areaRatio = Number.isFinite(Number(options.maxAreaErrorRatio))
        ? Math.max(0, Number(options.maxAreaErrorRatio))
        : 0.02;
    const maxAreaError = Number.isFinite(Number(options.maxAreaError))
        ? Math.max(0, Number(options.maxAreaError))
        : Math.abs(originalArea) * areaRatio;
    const reduction = reduceContours(components, maxBoundaryVertices, maxAreaError);
    if (!reduction.ok) {
        return {
            ok: false,
            reason: 'contour-budget-exceeded',
            originalBoundaryVertexCount: boundaryVertexCount(cloneWorkingComponents(analysis)),
            reducedBoundaryVertexCount: reduction.boundaryVertexCount,
            maxBoundaryVertices,
            areaError: reduction.areaError,
            maxAreaError
        };
    }
    const reducedAnalysis = rebuildAnalysis(analysis, components);
    const requestedGuardDistance = Number.isFinite(Number(options.guardDistance))
        ? Math.max(AUTO_SHAPE_MIN_GUARD_DISTANCE, Number(options.guardDistance))
        : AUTO_SHAPE_DEFAULT_GUARD_DISTANCE;
    const minimumGuardDistance = Number.isFinite(Number(options.minimumGuardDistance))
        ? Math.max(EPSILON, Number(options.minimumGuardDistance))
        : AUTO_SHAPE_MIN_GUARD_DISTANCE;
    const miterLimit = Number.isFinite(Number(options.miterLimit))
        ? Math.max(1, Number(options.miterLimit))
        : 4;
    let guardDistance = requestedGuardDistance;
    let guardResult = null;
    while (guardDistance + EPSILON >= minimumGuardDistance) {
        guardResult = buildGuardContours(reducedAnalysis, guardDistance, miterLimit);
        if (guardResult.ok) break;
        if (guardResult.reason === 'guard-padding-required' && guardDistance <= minimumGuardDistance + EPSILON) {
            break;
        }
        guardDistance /= 2;
    }
    if (!guardResult?.ok) {
        return {
            ok: false,
            reason: guardResult?.reason || 'guard-unavailable',
            reducedAnalysis,
            requestedGuardDistance,
            attemptedGuardDistance: guardDistance
        };
    }
    const reducedBoundaryVertexCount = boundaryVertexCount(components);
    const guardVertexCount = guardResult.guards.reduce((sum, guard) => sum + guard.points.length, 0);
    const availableInteriorVertices = maxVertices - reducedBoundaryVertexCount - guardVertexCount;
    return {
        ok: true,
        reason: null,
        analysis: reducedAnalysis,
        guardContours: guardResult.guards,
        maxVertices,
        maxBoundaryVertices,
        reservedInteriorVertices,
        availableInteriorVertices,
        originalBoundaryVertexCount: boundaryVertexCount(cloneWorkingComponents(analysis)),
        reducedBoundaryVertexCount,
        guardVertexCount,
        requestedGuardDistance,
        guardDistance,
        originalArea: reduction.originalArea,
        reducedArea: reduction.reducedArea,
        areaError: reduction.areaError,
        maxAreaError
    };
}
