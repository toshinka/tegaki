/**
 * guarded Auto Shape FILL topologyを既存Raster Mesh / Skin保存shapeへ写すpure factory。
 * Model mutation、History、UI、Frame Poseは所有しない。
 */

import { createGuardedAutoShapeFillTopology } from './auto-shape-fill-topology.js';
import { analyzeRasterAlphaContours } from './raster-alpha-contours.js';
import {
    createRasterBoneBindSegments,
    createRasterBoneDistanceInfluences,
    createRasterMeshSourceSignature,
    rasterMeshSourceSignaturesEqual
} from './raster-bone-auto-setup.js';
import { RASTER_MESH_SCHEMA_VERSION } from './raster-bone-skinning.js';

export const AUTO_SHAPE_FILL_GENERATOR = 'auto-shape-fill-v1';

function cloneBounds(bounds) {
    return bounds ? {
        x: Number(bounds.x),
        y: Number(bounds.y),
        width: Number(bounds.width),
        height: Number(bounds.height)
    } : null;
}

function unionBounds(boundsList) {
    if (!Array.isArray(boundsList) || boundsList.length === 0) return null;
    const minX = Math.min(...boundsList.map(bounds => bounds.x));
    const minY = Math.min(...boundsList.map(bounds => bounds.y));
    const maxX = Math.max(...boundsList.map(bounds => bounds.x + bounds.width));
    const maxY = Math.max(...boundsList.map(bounds => bounds.y + bounds.height));
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/** Auto Shape FILLを既存MeshDefinition / SkinBindingへ変換する。 */
export function createAutoShapeRasterBoneSetup(asset, targetInternalLayerId, snapshot, options = {}) {
    const layer = asset?.internalLayers?.find(candidate => candidate?.id === targetInternalLayerId) || null;
    if (!layer) return { ok: false, reason: 'layer-not-found' };
    if (layer.type !== 'raster') return { ok: false, reason: 'raster-required' };
    const analysis = analyzeRasterAlphaContours(snapshot, options);
    if (!analysis.ok) return analysis;
    const topology = createGuardedAutoShapeFillTopology(analysis, options);
    if (!topology.ok) return topology;
    const segmentResult = createRasterBoneBindSegments(asset, options.boneIds);
    if (!segmentResult.ok) return { ok: false, reason: 'invalid-rig', errors: segmentResult.errors };
    if (segmentResult.segments.length === 0) return { ok: false, reason: 'mesh-bone-required' };

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
    const contentBounds = unionBounds(analysis.components.flatMap(component => (
        component.outerContours.map(contour => contour.bounds)
    )));
    const meshDefinition = {
        version: RASTER_MESH_SCHEMA_VERSION,
        meshId,
        targetInternalLayerId,
        vertices,
        triangles,
        generator: {
            type: AUTO_SHAPE_FILL_GENERATOR,
            mode: 'fill',
            source: createRasterMeshSourceSignature(snapshot),
            contentBounds: cloneBounds(contentBounds),
            alphaThreshold: analysis.alphaThreshold,
            requestedGuardDistance: topology.budget.requestedGuardDistance,
            guardDistance: topology.budget.guardDistance,
            originalBoundaryVertexCount: topology.budget.originalBoundaryVertexCount,
            reducedBoundaryVertexCount: topology.budget.reducedBoundaryVertexCount,
            guardVertexCount: topology.budget.guardVertexCount,
            interiorVertexCount: topology.metrics.interiorVertexCount,
            areaError: topology.budget.areaError
        }
    };
    const skinBinding = {
        version: RASTER_MESH_SCHEMA_VERSION,
        meshId,
        vertexWeights: vertices.map(vertex => ({
            vertexId: vertex.vertexId,
            influences: createRasterBoneDistanceInfluences(vertex, segmentResult.segments)
        }))
    };
    return {
        ok: true,
        reason: null,
        meshDefinition,
        skinBinding,
        topology,
        analysis,
        contentBounds,
        boneCount: segmentResult.segments.length
    };
}

export function getAutoShapeRasterMeshStatus(meshDefinition, snapshot) {
    if (!meshDefinition) return { state: 'missing', stale: false };
    if (meshDefinition.generator?.type !== AUTO_SHAPE_FILL_GENERATOR) {
        return { state: 'manual', stale: false };
    }
    const current = createRasterMeshSourceSignature(snapshot);
    const generated = meshDefinition.generator.source || null;
    const stale = !rasterMeshSourceSignaturesEqual(current, generated);
    return { state: stale ? 'stale' : 'current', stale, current, generated };
}

/** CAF / Raster複製後のsourceだけを新Snapshotへrebaseする。topology / weightは維持する。 */
export function rebaseAutoShapeRasterMeshSource(meshDefinition, snapshot) {
    if (!meshDefinition || meshDefinition.generator?.type !== AUTO_SHAPE_FILL_GENERATOR) {
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
