/**
 * CAF内部Rasterのalpha実内容へstatic rect / strip Meshを初期生成し、
 * 既存Mesh Bone segmentとの距離から最大2 influenceの初期weightを作るpure helper。
 * 生成後のMesh / SkinはClipAsset正本となり、本moduleはRaster変更時に自動上書きしない。
 */

import { calculateOpaqueRasterBounds, normalizeRasterBounds } from '../raster-bounds.js';
import { applyTransformMatrix } from '../transform-math.js';
import { evaluateRigidBones } from './part-rig.js';
import { createRectControlMeshPreset, normalizeControlMeshGridDimensions } from './control-mesh-topology.js';
import { RASTER_MESH_SCHEMA_VERSION } from './raster-bone-skinning.js';

export const ALPHA_FIT_GRID_GENERATOR = 'alpha-fit-grid-v1';
export const ALPHA_FIT_GRID_MAX_INFLUENCES = 2;

function cloneBounds(bounds) {
    return bounds ? {
        x: Number(bounds.x),
        y: Number(bounds.y),
        width: Number(bounds.width),
        height: Number(bounds.height)
    } : null;
}

function sourceSignature(snapshot) {
    if (!snapshot) return null;
    return {
        snapshotId: snapshot.id || null,
        updatedAt: Number(snapshot.updatedAt) || 0,
        width: Math.max(1, Math.round(Number(snapshot.width) || 1)),
        height: Math.max(1, Math.round(Number(snapshot.height) || 1)),
        rasterBounds: normalizeRasterBounds(snapshot.rasterBounds, {
            width: snapshot.width || 1,
            height: snapshot.height || 1
        })
    };
}

function signaturesEqual(left, right) {
    return !!left && !!right
        && left.snapshotId === right.snapshotId
        && left.updatedAt === right.updatedAt
        && left.width === right.width
        && left.height === right.height
        && ['x', 'y', 'width', 'height'].every(field => (
            Number(left.rasterBounds?.[field]) === Number(right.rasterBounds?.[field])
        ));
}

export function chooseAlphaFitGridDimensions(bounds, options = {}) {
    const explicit = normalizeControlMeshGridDimensions(options.columns, options.rows);
    if (explicit) return explicit;
    const width = Math.max(1, Number(bounds?.width) || 1);
    const height = Math.max(1, Number(bounds?.height) || 1);
    if (width >= height * 1.5) return normalizeControlMeshGridDimensions(8, 4);
    if (height >= width * 1.5) return normalizeControlMeshGridDimensions(4, 8);
    return normalizeControlMeshGridDimensions(6, 6);
}

function expandBoundsWithinRaster(bounds, snapshot, padding = 1) {
    const raster = normalizeRasterBounds(snapshot?.rasterBounds, {
        width: snapshot?.width || 1,
        height: snapshot?.height || 1
    });
    const amount = Math.max(0, Math.round(Number(padding) || 0));
    const minX = Math.max(raster.x, Math.floor(bounds.x) - amount);
    const minY = Math.max(raster.y, Math.floor(bounds.y) - amount);
    const maxX = Math.min(raster.x + raster.width, Math.ceil(bounds.x + bounds.width) + amount);
    const maxY = Math.min(raster.y + raster.height, Math.ceil(bounds.y + bounds.height) + amount);
    return {
        x: minX,
        y: minY,
        width: Math.max(1, maxX - minX),
        height: Math.max(1, maxY - minY)
    };
}

function distanceSquaredToSegment(point, start, end) {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lengthSquared = dx * dx + dy * dy;
    if (!(lengthSquared > 1e-12)) {
        return (point.x - start.x) ** 2 + (point.y - start.y) ** 2;
    }
    const t = Math.max(0, Math.min(1, (
        (point.x - start.x) * dx + (point.y - start.y) * dy
    ) / lengthSquared));
    const x = start.x + dx * t;
    const y = start.y + dy * t;
    return (point.x - x) ** 2 + (point.y - y) ** 2;
}

function createBindSegments(asset, boneIds) {
    const evaluation = evaluateRigidBones(asset, null, 0);
    if (!evaluation.ok) return { ok: false, errors: evaluation.errors, segments: [] };
    const allowed = new Set(Array.isArray(boneIds) ? boneIds : []);
    const bones = Array.isArray(asset?.rigDefinition?.bones) ? asset.rigDefinition.bones : [];
    const segments = bones.flatMap(bone => {
        if (!bone?.boneId || (allowed.size > 0 && !allowed.has(bone.boneId))) return [];
        const pose = evaluation.poseByBoneId.get(bone.boneId);
        if (!pose?.worldMatrix) return [];
        return [{
            boneId: bone.boneId,
            start: applyTransformMatrix(pose.worldMatrix, 0, 0),
            end: applyTransformMatrix(pose.worldMatrix, Math.max(0, Number(bone.length) || 0), 0)
        }];
    });
    return { ok: true, errors: [], segments };
}

function createDistanceInfluences(point, segments) {
    if (!Array.isArray(segments) || segments.length === 0) return [];
    const nearest = segments
        .map(segment => ({
            boneId: segment.boneId,
            distanceSquared: distanceSquaredToSegment(point, segment.start, segment.end)
        }))
        .sort((left, right) => left.distanceSquared - right.distanceSquared || left.boneId.localeCompare(right.boneId))
        .slice(0, ALPHA_FIT_GRID_MAX_INFLUENCES);
    if (nearest[0].distanceSquared <= 1e-12) {
        return [{ boneId: nearest[0].boneId, weight: 1 }];
    }
    const scores = nearest.map(item => 1 / Math.max(1e-12, item.distanceSquared));
    const total = scores.reduce((sum, score) => sum + score, 0);
    return nearest.map((item, index) => ({
        boneId: item.boneId,
        weight: scores[index] / total
    }));
}

export function createAlphaFitRasterBoneSetup(asset, targetInternalLayerId, snapshot, options = {}) {
    const layer = asset?.internalLayers?.find(candidate => candidate?.id === targetInternalLayerId) || null;
    if (!layer) return { ok: false, reason: 'layer-not-found' };
    if (layer.type !== 'raster') return { ok: false, reason: 'raster-required' };
    const opaqueBounds = calculateOpaqueRasterBounds(snapshot, options.alphaThreshold ?? 0);
    if (!opaqueBounds) return { ok: false, reason: 'empty-raster' };
    const bindBounds = expandBoundsWithinRaster(opaqueBounds, snapshot, options.padding ?? 1);
    const dimensions = chooseAlphaFitGridDimensions(bindBounds, options);
    const preset = dimensions ? createRectControlMeshPreset(dimensions) : null;
    if (!preset) return { ok: false, reason: 'invalid-grid-dimensions' };
    let fallbackId = 0;
    const idFactory = typeof options.idFactory === 'function'
        ? options.idFactory
        : (kind => `${targetInternalLayerId}-${kind}-${fallbackId++}`);
    const meshId = options.meshId || idFactory('mesh');
    const vertices = preset.points.map((point, index) => ({
        vertexId: idFactory(`vertex-${index}`),
        x: bindBounds.x + point.x * bindBounds.width,
        y: bindBounds.y + point.y * bindBounds.height
    }));
    const triangles = preset.triangles.map(triangle => triangle.map(index => vertices[index].vertexId));
    const segmentResult = createBindSegments(asset, options.boneIds);
    if (!segmentResult.ok) return { ok: false, reason: 'invalid-rig', errors: segmentResult.errors };
    const meshDefinition = {
        version: RASTER_MESH_SCHEMA_VERSION,
        meshId,
        targetInternalLayerId,
        vertices,
        triangles,
        generator: {
            type: ALPHA_FIT_GRID_GENERATOR,
            columns: dimensions.columns,
            rows: dimensions.rows,
            contentBounds: cloneBounds(opaqueBounds),
            bindBounds: cloneBounds(bindBounds),
            source: sourceSignature(snapshot)
        }
    };
    const skinBinding = {
        version: RASTER_MESH_SCHEMA_VERSION,
        meshId,
        vertexWeights: vertices.map(vertex => ({
            vertexId: vertex.vertexId,
            influences: createDistanceInfluences(vertex, segmentResult.segments)
        }))
    };
    return {
        ok: true,
        meshDefinition,
        skinBinding,
        dimensions,
        contentBounds: opaqueBounds,
        bindBounds,
        boneCount: segmentResult.segments.length
    };
}

export function getAlphaFitRasterMeshStatus(meshDefinition, snapshot) {
    if (!meshDefinition) return { state: 'missing', stale: false };
    if (meshDefinition.generator?.type !== ALPHA_FIT_GRID_GENERATOR) {
        return { state: 'manual', stale: false };
    }
    const current = sourceSignature(snapshot);
    const generated = meshDefinition.generator.source || null;
    const stale = !signaturesEqual(current, generated);
    return { state: stale ? 'stale' : 'current', stale, current, generated };
}

export function rebaseAlphaFitRasterMeshSource(meshDefinition, snapshot) {
    if (!meshDefinition || meshDefinition.generator?.type !== ALPHA_FIT_GRID_GENERATOR) {
        return meshDefinition;
    }
    return {
        ...meshDefinition,
        generator: {
            ...meshDefinition.generator,
            source: sourceSignature(snapshot)
        }
    };
}
