/**
 * CURRENTなAUTO GRID / AUTO SHAPE Raster Meshの既存vertex位置だけを確定するpure plan。
 *
 * vertexId、triangle、Skin weight、generator sourceは維持する。Raster Skin Meshでは
 * vertex x / yがBind位置とsource sampling位置を兼ねるため、snapshotのrasterBounds内に
 * 限定し、winding反転、degenerate、triangle同士の不正交差を拒否する。
 */

import { AUTO_SHAPE_FILL_GENERATOR } from './auto-shape-raster-bone-setup.js';
import { ALPHA_FIT_GRID_GENERATOR } from './raster-bone-auto-setup.js';
import { validateRasterBoneSkinning } from './raster-bone-skinning.js';

export const FIXED_VERTEX_POSITION_EDIT_MODE = 'fixed-vertex-position-v1';

const GEOMETRY_EPSILON = 1e-9;

function signedAreaDouble(a, b, c) {
    return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function orientation(a, b, c) {
    const area = signedAreaDouble(a, b, c);
    if (area > GEOMETRY_EPSILON) return 1;
    if (area < -GEOMETRY_EPSILON) return -1;
    return 0;
}

function pointOnSegment(point, start, end) {
    if (orientation(start, end, point) !== 0) return false;
    return point.x >= Math.min(start.x, end.x) - GEOMETRY_EPSILON
        && point.x <= Math.max(start.x, end.x) + GEOMETRY_EPSILON
        && point.y >= Math.min(start.y, end.y) - GEOMETRY_EPSILON
        && point.y <= Math.max(start.y, end.y) + GEOMETRY_EPSILON;
}

function samePoint(left, right) {
    return Math.abs(left.x - right.x) <= GEOMETRY_EPSILON
        && Math.abs(left.y - right.y) <= GEOMETRY_EPSILON;
}

function sameUndirectedEdge(leftStart, leftEnd, rightStart, rightEnd) {
    return (samePoint(leftStart, rightStart) && samePoint(leftEnd, rightEnd))
        || (samePoint(leftStart, rightEnd) && samePoint(leftEnd, rightStart));
}

function segmentsIntersectBeyondSharedBoundary(leftStart, leftEnd, rightStart, rightEnd) {
    if (sameUndirectedEdge(leftStart, leftEnd, rightStart, rightEnd)) return false;

    const leftStartSide = orientation(rightStart, rightEnd, leftStart);
    const leftEndSide = orientation(rightStart, rightEnd, leftEnd);
    const rightStartSide = orientation(leftStart, leftEnd, rightStart);
    const rightEndSide = orientation(leftStart, leftEnd, rightEnd);

    if (leftStartSide * leftEndSide < 0 && rightStartSide * rightEndSide < 0) return true;

    const contacts = [
        [leftStart, rightStart, rightEnd],
        [leftEnd, rightStart, rightEnd],
        [rightStart, leftStart, leftEnd],
        [rightEnd, leftStart, leftEnd]
    ].filter(([point, start, end]) => pointOnSegment(point, start, end));
    return contacts.some(([point]) => ![
        [leftStart, rightStart],
        [leftStart, rightEnd],
        [leftEnd, rightStart],
        [leftEnd, rightEnd]
    ].some(([left, right]) => samePoint(left, point) && samePoint(right, point)));
}

function pointStrictlyInsideTriangle(point, a, b, c) {
    const sideA = orientation(a, b, point);
    const sideB = orientation(b, c, point);
    const sideC = orientation(c, a, point);
    if (sideA === 0 || sideB === 0 || sideC === 0) return false;
    return sideA === sideB && sideB === sideC;
}

function trianglesOverlapBeyondSharedBoundary(left, right) {
    const leftEdges = [[left[0], left[1]], [left[1], left[2]], [left[2], left[0]]];
    const rightEdges = [[right[0], right[1]], [right[1], right[2]], [right[2], right[0]]];
    if (leftEdges.some(([leftStart, leftEnd]) => rightEdges.some(([rightStart, rightEnd]) => (
        segmentsIntersectBeyondSharedBoundary(leftStart, leftEnd, rightStart, rightEnd)
    )))) return true;

    return left.some(point => (
        !right.some(candidate => samePoint(point, candidate))
        && pointStrictlyInsideTriangle(point, right[0], right[1], right[2])
    )) || right.some(point => (
        !left.some(candidate => samePoint(point, candidate))
        && pointStrictlyInsideTriangle(point, left[0], left[1], left[2])
    ));
}

function findTopologyOverlap(mesh) {
    const vertexById = new Map((mesh.vertices || []).map(vertex => [vertex.vertexId, vertex]));
    const triangles = (mesh.triangles || []).map((triangle, triangleIndex) => ({
        triangleIndex,
        points: triangle.map(vertexId => vertexById.get(vertexId))
    }));
    for (let leftIndex = 0; leftIndex < triangles.length; leftIndex += 1) {
        for (let rightIndex = leftIndex + 1; rightIndex < triangles.length; rightIndex += 1) {
            const left = triangles[leftIndex];
            const right = triangles[rightIndex];
            if (trianglesOverlapBeyondSharedBoundary(left.points, right.points)) {
                return [left.triangleIndex, right.triangleIndex];
            }
        }
    }
    return null;
}

function normalizeSourceBounds(value) {
    if (!value
        || !Number.isFinite(value.x)
        || !Number.isFinite(value.y)
        || !Number.isFinite(value.width)
        || !Number.isFinite(value.height)
        || value.width <= 0
        || value.height <= 0) return null;
    return { x: value.x, y: value.y, width: value.width, height: value.height };
}

function pointWithinBounds(point, bounds) {
    return point.x >= bounds.x - GEOMETRY_EPSILON
        && point.x <= bounds.x + bounds.width + GEOMETRY_EPSILON
        && point.y >= bounds.y - GEOMETRY_EPSILON
        && point.y <= bounds.y + bounds.height + GEOMETRY_EPSILON;
}

/**
 * 一Raster / 一Mesh / stable vertex IDごとのabsolute Bind/source位置を受ける。
 * assetは変更しない。changed=falseならHistoryを作らないno-opである。
 */
export function createRasterMeshVertexPositionEditPlan(
    asset,
    targetInternalLayerId,
    vertexPositions,
    sourceBoundsValue
) {
    if (!asset || !targetInternalLayerId) {
        return { ok: false, changed: false, reason: 'mesh-edit-target-required' };
    }
    const validation = validateRasterBoneSkinning(
        asset.meshDefinitions,
        asset.skinBindings,
        asset.internalLayers,
        asset.rigDefinition
    );
    if (!validation.ok) {
        return { ok: false, changed: false, reason: 'invalid-raster-skin', errors: validation.errors };
    }

    const meshCandidates = (validation.meshDefinitions || [])
        .filter(mesh => mesh?.targetInternalLayerId === targetInternalLayerId);
    if (meshCandidates.length !== 1) {
        return {
            ok: false,
            changed: false,
            reason: meshCandidates.length === 0 ? 'mesh-not-found' : 'ambiguous-mesh-target'
        };
    }
    const mesh = meshCandidates[0];
    if (mesh.generator?.type !== ALPHA_FIT_GRID_GENERATOR
        && mesh.generator?.type !== AUTO_SHAPE_FILL_GENERATOR) {
        return { ok: false, changed: false, reason: 'fixed-topology-generator-required' };
    }

    const sourceBounds = normalizeSourceBounds(sourceBoundsValue);
    if (!sourceBounds) return { ok: false, changed: false, reason: 'source-bounds-required' };
    if (!Array.isArray(vertexPositions) || vertexPositions.length === 0) {
        return { ok: false, changed: false, reason: 'vertex-positions-required' };
    }

    const positionByVertexId = new Map();
    const duplicateVertexIds = [];
    for (const position of vertexPositions) {
        if (!position
            || typeof position.vertexId !== 'string'
            || position.vertexId.length === 0
            || !Number.isFinite(position.x)
            || !Number.isFinite(position.y)) {
            return { ok: false, changed: false, reason: 'invalid-vertex-position' };
        }
        if (positionByVertexId.has(position.vertexId)) duplicateVertexIds.push(position.vertexId);
        positionByVertexId.set(position.vertexId, {
            vertexId: position.vertexId,
            x: position.x,
            y: position.y
        });
    }
    if (duplicateVertexIds.length > 0) {
        return {
            ok: false,
            changed: false,
            reason: 'duplicate-vertex-position',
            duplicateVertexIds: [...new Set(duplicateVertexIds)]
        };
    }

    const vertexById = new Map((mesh.vertices || []).map(vertex => [vertex.vertexId, vertex]));
    const missingVertexIds = [...positionByVertexId.keys()]
        .filter(vertexId => !vertexById.has(vertexId));
    if (missingVertexIds.length > 0) {
        return { ok: false, changed: false, reason: 'vertex-not-found', missingVertexIds };
    }
    const outsideVertexIds = [...positionByVertexId.entries()]
        .filter(([, position]) => !pointWithinBounds(position, sourceBounds))
        .map(([vertexId]) => vertexId);
    if (outsideVertexIds.length > 0) {
        return { ok: false, changed: false, reason: 'vertex-outside-source', outsideVertexIds };
    }

    const baselineOverlap = findTopologyOverlap(mesh);
    if (baselineOverlap) {
        return {
            ok: false,
            changed: false,
            reason: 'invalid-existing-topology',
            triangleIndices: baselineOverlap
        };
    }

    const changedVertexIds = [];
    const nextVertices = (mesh.vertices || []).map(vertex => {
        const position = positionByVertexId.get(vertex.vertexId);
        if (!position) return { ...vertex };
        if (Math.abs(position.x - vertex.x) > GEOMETRY_EPSILON
            || Math.abs(position.y - vertex.y) > GEOMETRY_EPSILON) {
            changedVertexIds.push(vertex.vertexId);
        }
        return { ...vertex, x: position.x, y: position.y };
    });
    const changed = changedVertexIds.length > 0;
    if (!changed) {
        return {
            ok: true,
            changed: false,
            reason: null,
            meshId: mesh.meshId,
            targetInternalLayerId,
            requestedVertexIds: [...positionByVertexId.keys()],
            changedVertexIds,
            meshDefinitions: validation.meshDefinitions,
            skinBindings: validation.skinBindings
        };
    }

    const nextVertexById = new Map(nextVertices.map(vertex => [vertex.vertexId, vertex]));
    for (let triangleIndex = 0; triangleIndex < mesh.triangles.length; triangleIndex += 1) {
        const triangle = mesh.triangles[triangleIndex];
        const beforePoints = triangle.map(vertexId => vertexById.get(vertexId));
        const afterPoints = triangle.map(vertexId => nextVertexById.get(vertexId));
        const beforeOrientation = orientation(beforePoints[0], beforePoints[1], beforePoints[2]);
        const afterOrientation = orientation(afterPoints[0], afterPoints[1], afterPoints[2]);
        if (afterOrientation === 0 || afterOrientation !== beforeOrientation) {
            return {
                ok: false,
                changed: false,
                reason: 'triangle-winding-change',
                triangleIndex
            };
        }
    }

    const nextMesh = {
        ...mesh,
        vertices: nextVertices,
        generator: {
            ...mesh.generator,
            topologyEditMode: FIXED_VERTEX_POSITION_EDIT_MODE
        }
    };
    const overlap = findTopologyOverlap(nextMesh);
    if (overlap) {
        return {
            ok: false,
            changed: false,
            reason: 'topology-overlap',
            triangleIndices: overlap
        };
    }

    const nextMeshDefinitions = (validation.meshDefinitions || []).map(candidate => (
        candidate?.meshId === mesh.meshId ? nextMesh : candidate
    ));
    const nextValidation = validateRasterBoneSkinning(
        nextMeshDefinitions,
        validation.skinBindings,
        asset.internalLayers,
        asset.rigDefinition
    );
    if (!nextValidation.ok) {
        return {
            ok: false,
            changed: false,
            reason: 'invalid-mesh-edit-result',
            errors: nextValidation.errors
        };
    }

    return {
        ok: true,
        changed: true,
        reason: null,
        meshId: mesh.meshId,
        targetInternalLayerId,
        requestedVertexIds: [...positionByVertexId.keys()],
        changedVertexIds,
        meshDefinitions: nextValidation.meshDefinitions,
        skinBindings: nextValidation.skinBindings
    };
}
