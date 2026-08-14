/**
 * 既存Raster Mesh / SkinWeightから、選択Boneのread-only表示projectionを作る。
 * Project、History、Skin評価結果を変更せず、Frame頂点を渡した場合も座標だけを借りる。
 */

import { validateRasterBoneSkinning } from './raster-bone-skinning.js';

const WEIGHT_EPSILON = 1e-6;

function classifyWeight(weight) {
    if (!(weight > WEIGHT_EPSILON)) return 'none';
    if (weight >= 1 - WEIGHT_EPSILON) return 'rigid';
    return 'blend';
}

function createFailure(reason, details = {}) {
    return {
        ok: false,
        status: 'unavailable',
        reason,
        ...details
    };
}

export function createRasterSkinWeightDiagnosticProjection(
    asset,
    targetInternalLayerId,
    boneId,
    options = {}
) {
    if (!asset || !targetInternalLayerId || !boneId) {
        return createFailure('diagnostic-target-required');
    }

    const validation = validateRasterBoneSkinning(
        asset.meshDefinitions,
        asset.skinBindings,
        asset.internalLayers,
        asset.rigDefinition
    );
    if (!validation.ok) {
        return createFailure('invalid-raster-skin', { errors: validation.errors });
    }

    const meshCandidates = (validation.meshDefinitions || [])
        .filter(mesh => mesh?.targetInternalLayerId === targetInternalLayerId);
    if (meshCandidates.length === 0) return createFailure('mesh-not-found');
    if (meshCandidates.length !== 1) return createFailure('ambiguous-mesh-target');

    const mesh = meshCandidates[0];
    const binding = (validation.skinBindings || [])
        .find(candidate => candidate?.meshId === mesh.meshId) || null;
    if (!binding) return createFailure('skin-binding-not-found');

    const bones = Array.isArray(asset.rigDefinition?.bones) ? asset.rigDefinition.bones : [];
    const selectedBone = bones.find(bone => bone?.boneId === boneId) || null;
    if (!selectedBone) return createFailure('bone-not-found');

    const frameMesh = options.meshResult?.meshId === mesh.meshId
        ? options.meshResult
        : null;
    const frameVertexById = new Map((frameMesh?.vertices || [])
        .map(vertex => [vertex?.vertexId, vertex]));
    const influencesByVertexId = new Map((binding.vertexWeights || [])
        .map(vertexWeight => [vertexWeight.vertexId, vertexWeight.influences || []]));

    const vertices = mesh.vertices.map(vertex => {
        const influences = influencesByVertexId.get(vertex.vertexId) || [];
        const weightSum = influences.reduce((sum, influence) => {
            const weight = Number(influence?.weight);
            return Number.isFinite(weight) && weight > 0 ? sum + weight : sum;
        }, 0);
        const selectedWeight = influences.reduce((sum, influence) => {
            if (influence?.boneId !== boneId) return sum;
            const weight = Number(influence.weight);
            return Number.isFinite(weight) && weight > 0 ? sum + weight : sum;
        }, 0);
        const weight = weightSum > 0 ? selectedWeight / weightSum : 0;
        const frameVertex = frameVertexById.get(vertex.vertexId);
        return {
            vertexId: vertex.vertexId,
            bindX: vertex.x,
            bindY: vertex.y,
            x: Number.isFinite(frameVertex?.x) ? frameVertex.x : vertex.x,
            y: Number.isFinite(frameVertex?.y) ? frameVertex.y : vertex.y,
            weight,
            weightClass: classifyWeight(weight)
        };
    });
    const vertexById = new Map(vertices.map(vertex => [vertex.vertexId, vertex]));
    const triangles = mesh.triangles.map((vertexIds, index) => {
        const triangleVertices = vertexIds.map(vertexId => vertexById.get(vertexId));
        const weights = triangleVertices.map(vertex => vertex.weight);
        const minWeight = Math.min(...weights);
        const maxWeight = Math.max(...weights);
        const averageWeight = weights.reduce((sum, weight) => sum + weight, 0) / weights.length;
        return {
            index,
            vertexIds: [...vertexIds],
            minWeight,
            maxWeight,
            averageWeight,
            weightClass: maxWeight <= WEIGHT_EPSILON
                ? 'none'
                : (minWeight >= 1 - WEIGHT_EPSILON ? 'rigid' : 'blend')
        };
    });

    const childBoneIds = bones
        .filter(bone => bone?.parentBoneId === boneId)
        .map(bone => bone.boneId);
    const counts = vertices.reduce((result, vertex) => {
        result[vertex.weightClass] += 1;
        return result;
    }, { none: 0, blend: 0, rigid: 0 });
    const weightedVertexCount = counts.blend + counts.rigid;

    return {
        ok: true,
        status: weightedVertexCount > 0 ? 'ready' : 'unweighted',
        meshId: mesh.meshId,
        targetInternalLayerId,
        boneId,
        parentBoneId: selectedBone.parentBoneId || null,
        childBoneIds,
        vertices,
        triangles,
        stats: {
            vertexCount: vertices.length,
            triangleCount: triangles.length,
            weightedVertexCount,
            noneVertexCount: counts.none,
            blendVertexCount: counts.blend,
            rigidVertexCount: counts.rigid,
            maxWeight: vertices.reduce((max, vertex) => Math.max(max, vertex.weight), 0)
        }
    };
}

