/**
 * Auto Shape LINE / Ribbon topologyを既存Raster Mesh / Skin保存shapeへ写すpure factory。
 * Model mutation、History、UI、Frame Poseは所有しない。
 */

import {
    createRasterBoneBindSegments,
    createRasterMeshSourceSignature,
    rasterMeshSourceSignaturesEqual
} from './raster-bone-auto-setup.js';
import { RASTER_MESH_SCHEMA_VERSION } from './raster-bone-skinning.js';
import { createRasterLineRibbonTopology } from './raster-line-ribbon-topology.js';

export const AUTO_SHAPE_LINE_RIBBON_GENERATOR = 'auto-shape-line-ribbon-v1';
export const AUTO_SHAPE_LINE_RIBBON_MIN_BONES = 2;
export const AUTO_SHAPE_LINE_RIBBON_MAX_BONES = 3;

const GEOMETRY_EPSILON = 1e-9;

function cloneBounds(bounds) {
    return bounds ? {
        x: Number(bounds.x),
        y: Number(bounds.y),
        width: Number(bounds.width),
        height: Number(bounds.height)
    } : null;
}

function distanceSquared(left, right) {
    return (right.x - left.x) ** 2 + (right.y - left.y) ** 2;
}

function pointDistance(left, right) {
    return Math.sqrt(distanceSquared(left, right));
}

function createPolylineMetrics(points) {
    const cumulative = [0];
    for (let index = 1; index < points.length; index++) {
        cumulative.push(cumulative[index - 1] + pointDistance(points[index - 1], points[index]));
    }
    return { points, cumulative, length: cumulative.at(-1) };
}

function projectPointToPolyline(point, polyline) {
    let best = null;
    for (let index = 1; index < polyline.points.length; index++) {
        const start = polyline.points[index - 1];
        const end = polyline.points[index];
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const lengthSquared = dx * dx + dy * dy;
        const ratio = lengthSquared <= GEOMETRY_EPSILON
            ? 0
            : Math.max(0, Math.min(1, (
                (point.x - start.x) * dx + (point.y - start.y) * dy
            ) / lengthSquared));
        const projected = { x: start.x + dx * ratio, y: start.y + dy * ratio };
        const candidate = {
            distanceSquared: distanceSquared(point, projected),
            pathDistance: polyline.cumulative[index - 1] + Math.sqrt(lengthSquared) * ratio,
            point: projected,
            segmentIndex: index - 1
        };
        if (!best
            || candidate.distanceSquared < best.distanceSquared - GEOMETRY_EPSILON
            || (Math.abs(candidate.distanceSquared - best.distanceSquared) <= GEOMETRY_EPSILON
                && candidate.pathDistance < best.pathDistance)) {
            best = candidate;
        }
    }
    return best;
}

function resolveSelectedBoneChain(asset, boneIds) {
    const bones = Array.isArray(asset?.rigDefinition?.bones)
        ? asset.rigDefinition.bones.filter(bone => typeof bone?.boneId === 'string' && bone.boneId.length > 0)
        : [];
    const explicit = Array.isArray(boneIds) && boneIds.length > 0;
    const requestedIds = explicit ? [...new Set(boneIds)] : bones.map(bone => bone.boneId);
    const byId = new Map(bones.map(bone => [bone.boneId, bone]));
    if (requestedIds.some(boneId => !byId.has(boneId))) {
        return { ok: false, reason: 'line-ribbon-bone-not-found' };
    }
    if (requestedIds.length < AUTO_SHAPE_LINE_RIBBON_MIN_BONES
        || requestedIds.length > AUTO_SHAPE_LINE_RIBBON_MAX_BONES) {
        return { ok: false, reason: 'line-ribbon-bone-count' };
    }
    const selectedIds = new Set(requestedIds);
    const roots = requestedIds.filter(boneId => !selectedIds.has(byId.get(boneId)?.parentBoneId));
    if (roots.length !== 1) return { ok: false, reason: 'line-ribbon-bone-chain-required' };
    const chain = [];
    let currentId = roots[0];
    while (currentId) {
        chain.push(byId.get(currentId));
        const children = requestedIds.filter(boneId => byId.get(boneId)?.parentBoneId === currentId);
        if (children.length > 1) return { ok: false, reason: 'line-ribbon-bone-chain-required' };
        currentId = children[0] || null;
    }
    if (chain.length !== requestedIds.length) {
        return { ok: false, reason: 'line-ribbon-bone-chain-required' };
    }
    return { ok: true, reason: null, chain };
}

function createLongitudinalAnchors(topology, chain, segments, options) {
    const centerPoints = topology.stations.map(station => station.center);
    const polyline = createPolylineMetrics(centerPoints);
    if (!(polyline.length > GEOMETRY_EPSILON)) {
        return { ok: false, reason: 'line-ribbon-centerline-too-short' };
    }
    const segmentByBoneId = new Map(segments.map(segment => [segment.boneId, segment]));
    const maximumStationWidth = Math.max(...topology.stations.map(station => (
        pointDistance(station.left, station.right)
    )));
    const explicitDistance = Number(options.maxBoneCenterlineDistance);
    const maxBoneCenterlineDistance = Number.isFinite(explicitDistance) && explicitDistance > 0
        ? explicitDistance
        : maximumStationWidth * 2;
    const anchors = [];
    for (const bone of chain) {
        const segment = segmentByBoneId.get(bone.boneId);
        if (!segment) return { ok: false, reason: 'line-ribbon-bind-segment-missing' };
        const midpoint = {
            x: (segment.start.x + segment.end.x) / 2,
            y: (segment.start.y + segment.end.y) / 2
        };
        const projection = projectPointToPolyline(midpoint, polyline);
        if (!projection || Math.sqrt(projection.distanceSquared) > maxBoneCenterlineDistance) {
            return { ok: false, reason: 'line-ribbon-bone-too-far' };
        }
        anchors.push({
            boneId: bone.boneId,
            pathDistance: projection.pathDistance,
            distanceToCenterline: Math.sqrt(projection.distanceSquared),
            midpoint,
            projectedPoint: projection.point
        });
    }
    const deltas = anchors.slice(1).map((anchor, index) => (
        anchor.pathDistance - anchors[index].pathDistance
    ));
    if (deltas.some(delta => Math.abs(delta) <= GEOMETRY_EPSILON)) {
        return { ok: false, reason: 'line-ribbon-bone-order-ambiguous' };
    }
    const direction = Math.sign(deltas[0]);
    if (deltas.some(delta => Math.sign(delta) !== direction)) {
        return { ok: false, reason: 'line-ribbon-bone-order-ambiguous' };
    }
    return {
        ok: true,
        reason: null,
        polyline,
        anchors: [...anchors].sort((left, right) => (
            left.pathDistance - right.pathDistance || left.boneId.localeCompare(right.boneId)
        )),
        maxBoneCenterlineDistance
    };
}

function influencesAtPathDistance(pathDistance, anchors) {
    if (pathDistance <= anchors[0].pathDistance) {
        return [{ boneId: anchors[0].boneId, weight: 1 }];
    }
    if (pathDistance >= anchors.at(-1).pathDistance) {
        return [{ boneId: anchors.at(-1).boneId, weight: 1 }];
    }
    for (let index = 1; index < anchors.length; index++) {
        const right = anchors[index];
        if (pathDistance > right.pathDistance) continue;
        const left = anchors[index - 1];
        const ratio = (pathDistance - left.pathDistance) / (right.pathDistance - left.pathDistance);
        if (ratio <= GEOMETRY_EPSILON) return [{ boneId: left.boneId, weight: 1 }];
        if (ratio >= 1 - GEOMETRY_EPSILON) return [{ boneId: right.boneId, weight: 1 }];
        return [
            { boneId: left.boneId, weight: 1 - ratio },
            { boneId: right.boneId, weight: ratio }
        ];
    }
    return [{ boneId: anchors.at(-1).boneId, weight: 1 }];
}

function boundsFromVertices(vertices) {
    const minX = Math.min(...vertices.map(vertex => vertex.x));
    const minY = Math.min(...vertices.map(vertex => vertex.y));
    const maxX = Math.max(...vertices.map(vertex => vertex.x));
    const maxY = Math.max(...vertices.map(vertex => vertex.y));
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/** LINE Ribbonを既存MeshDefinition / SkinBinding候補へ変換する。 */
export function createLineRibbonRasterBoneSetup(asset, targetInternalLayerId, snapshot, options = {}) {
    const layer = asset?.internalLayers?.find(candidate => candidate?.id === targetInternalLayerId) || null;
    if (!layer) return { ok: false, reason: 'layer-not-found' };
    if (layer.type !== 'raster') return { ok: false, reason: 'raster-required' };
    const topology = createRasterLineRibbonTopology(snapshot, options);
    if (!topology.ok) return topology;
    const chainResult = resolveSelectedBoneChain(asset, options.boneIds);
    if (!chainResult.ok) return chainResult;
    const chainIds = chainResult.chain.map(bone => bone.boneId);
    const segmentResult = createRasterBoneBindSegments(asset, chainIds);
    if (!segmentResult.ok) return { ok: false, reason: 'invalid-rig', errors: segmentResult.errors };
    const anchorResult = createLongitudinalAnchors(
        topology,
        chainResult.chain,
        segmentResult.segments,
        options
    );
    if (!anchorResult.ok) return anchorResult;

    let fallbackId = 0;
    const idFactory = typeof options.idFactory === 'function'
        ? options.idFactory
        : (kind => `${targetInternalLayerId}-${kind}-${fallbackId++}`);
    const meshId = options.meshId || idFactory('mesh');
    const vertices = topology.vertices.map((vertex, index) => ({
        vertexId: idFactory(`vertex-${index}`),
        x: vertex.x,
        y: vertex.y
    }));
    const triangles = topology.triangles.map(triangle => triangle.map(index => vertices[index].vertexId));
    const stationInfluences = topology.stations.map((station, stationIndex) => ({
        stationIndex,
        influences: influencesAtPathDistance(
            anchorResult.polyline.cumulative[stationIndex],
            anchorResult.anchors
        )
    }));
    const meshDefinition = {
        version: RASTER_MESH_SCHEMA_VERSION,
        meshId,
        targetInternalLayerId,
        vertices,
        triangles,
        generator: {
            type: AUTO_SHAPE_LINE_RIBBON_GENERATOR,
            mode: 'line',
            source: createRasterMeshSourceSignature(snapshot),
            contentBounds: cloneBounds(boundsFromVertices(vertices)),
            stationCount: topology.metrics.stationCount,
            effectiveStationSpacing: topology.metrics.effectiveStationSpacing,
            coverageRatio: topology.metrics.coverageRatio,
            weightMode: 'longitudinal-linear',
            boneCount: chainIds.length
        }
    };
    const skinBinding = {
        version: RASTER_MESH_SCHEMA_VERSION,
        meshId,
        vertexWeights: vertices.map((vertex, vertexIndex) => ({
            vertexId: vertex.vertexId,
            influences: stationInfluences[Math.floor(vertexIndex / 3)].influences
                .map(influence => ({ ...influence }))
        }))
    };
    return {
        ok: true,
        reason: null,
        meshDefinition,
        skinBinding,
        topology,
        stationInfluences,
        anchors: anchorResult.anchors.map(anchor => ({ ...anchor })),
        contentBounds: cloneBounds(meshDefinition.generator.contentBounds),
        boneCount: chainIds.length
    };
}

export function getLineRibbonRasterMeshStatus(meshDefinition, snapshot) {
    if (!meshDefinition) return { state: 'missing', stale: false };
    if (meshDefinition.generator?.type !== AUTO_SHAPE_LINE_RIBBON_GENERATOR) {
        return { state: 'manual', stale: false };
    }
    const current = createRasterMeshSourceSignature(snapshot);
    const generated = meshDefinition.generator.source || null;
    const stale = !rasterMeshSourceSignaturesEqual(current, generated);
    return { state: stale ? 'stale' : 'current', stale, current, generated };
}

/** CAF / Raster複製後のsourceだけをrebaseし、Ribbon topology / weightは維持する。 */
export function rebaseLineRibbonRasterMeshSource(meshDefinition, snapshot) {
    if (!meshDefinition || meshDefinition.generator?.type !== AUTO_SHAPE_LINE_RIBBON_GENERATOR) {
        return meshDefinition;
    }
    return {
        ...meshDefinition,
        generator: {
            ...meshDefinition.generator,
            source: createRasterMeshSourceSignature(snapshot)
        }
    };
}
