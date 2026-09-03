/**
 * CAF内部Rasterのstatic Triangle Mesh / SkinWeight保存shapeと、
 * 既存Bone PoseからFrameごとの頂点を得るpure evaluator。
 *
 * Raster画素はClipAsset internal Layer / DrawingSnapshot、Bone Bindは
 * ClipAsset.rigDefinition、Bone PoseはClipInstance.rigMotionが正本である。
 * 本moduleはControl Mesh / WARP Pose、DOM、Pixi、Historyを所有しない。
 */

import {
    applyTransformMatrix,
    invertTransformMatrix,
    multiplyTransformMatrices
} from '../transform-math.js';
import { evaluateRigidBones } from './part-rig.js';

export const RASTER_MESH_SCHEMA_VERSION = 1;
export const RASTER_MESH_MAX_VERTICES = 256;
export const RASTER_MESH_MAX_INFLUENCES = 4;

const TRIANGLE_AREA_EPSILON = 1e-10;

function clonePlainValue(value) {
    if (value === undefined) return undefined;
    if (value === null || typeof value !== 'object') return value;
    try {
        return structuredClone(value);
    } catch {
        try {
            return JSON.parse(JSON.stringify(value));
        } catch {
            return value;
        }
    }
}

function hasOwn(value, key) {
    return value != null && Object.prototype.hasOwnProperty.call(value, key);
}

function normalizeMeshVertex(vertex) {
    if (!vertex || typeof vertex !== 'object' || Array.isArray(vertex)) return clonePlainValue(vertex);
    return {
        ...clonePlainValue(vertex),
        vertexId: hasOwn(vertex, 'vertexId') ? vertex.vertexId : null,
        x: hasOwn(vertex, 'x') ? vertex.x : 0,
        y: hasOwn(vertex, 'y') ? vertex.y : 0
    };
}

function normalizeMeshDefinition(definition) {
    if (!definition || typeof definition !== 'object' || Array.isArray(definition)) {
        return clonePlainValue(definition);
    }
    return {
        ...clonePlainValue(definition),
        version: hasOwn(definition, 'version')
            ? definition.version
            : RASTER_MESH_SCHEMA_VERSION,
        meshId: hasOwn(definition, 'meshId') ? definition.meshId : null,
        targetInternalLayerId: hasOwn(definition, 'targetInternalLayerId')
            ? definition.targetInternalLayerId
            : null,
        vertices: Array.isArray(definition.vertices)
            ? definition.vertices.map(normalizeMeshVertex)
            : clonePlainValue(definition.vertices),
        triangles: Array.isArray(definition.triangles)
            ? definition.triangles.map(triangle => Array.isArray(triangle)
                ? [...triangle]
                : clonePlainValue(triangle))
            : clonePlainValue(definition.triangles),
        ...(hasOwn(definition, 'generator')
            ? { generator: clonePlainValue(definition.generator) }
            : {})
    };
}

function normalizeInfluence(influence) {
    if (!influence || typeof influence !== 'object' || Array.isArray(influence)) {
        return clonePlainValue(influence);
    }
    return {
        ...clonePlainValue(influence),
        boneId: hasOwn(influence, 'boneId') ? influence.boneId : null,
        weight: hasOwn(influence, 'weight') ? influence.weight : 0
    };
}

function normalizeVertexWeight(vertexWeight) {
    if (!vertexWeight || typeof vertexWeight !== 'object' || Array.isArray(vertexWeight)) {
        return clonePlainValue(vertexWeight);
    }
    return {
        ...clonePlainValue(vertexWeight),
        vertexId: hasOwn(vertexWeight, 'vertexId') ? vertexWeight.vertexId : null,
        influences: Array.isArray(vertexWeight.influences)
            ? vertexWeight.influences.map(normalizeInfluence)
            : clonePlainValue(vertexWeight.influences)
    };
}

function normalizeSkinBinding(binding) {
    if (!binding || typeof binding !== 'object' || Array.isArray(binding)) {
        return clonePlainValue(binding);
    }
    return {
        ...clonePlainValue(binding),
        version: hasOwn(binding, 'version')
            ? binding.version
            : RASTER_MESH_SCHEMA_VERSION,
        meshId: hasOwn(binding, 'meshId') ? binding.meshId : null,
        vertexWeights: Array.isArray(binding.vertexWeights)
            ? binding.vertexWeights.map(normalizeVertexWeight)
            : clonePlainValue(binding.vertexWeights)
    };
}

export function normalizeRasterMeshDefinitions(value) {
    if (value == null) return null;
    return Array.isArray(value)
        ? value.map(normalizeMeshDefinition)
        : clonePlainValue(value);
}

export function normalizeRasterSkinBindings(value) {
    if (value == null) return null;
    return Array.isArray(value)
        ? value.map(normalizeSkinBinding)
        : clonePlainValue(value);
}

export function serializeRasterMeshDefinitions(value) {
    return normalizeRasterMeshDefinitions(value);
}

export function serializeRasterSkinBindings(value) {
    return normalizeRasterSkinBindings(value);
}

function addError(errors, code, path, message) {
    errors.push({ code, path, message });
}

function signedTriangleAreaDouble(a, b, c) {
    return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

/** static Mesh / SkinWeightをRasterとBone参照まで含めて検証する。 */
export function validateRasterBoneSkinning(
    meshDefinitionsValue,
    skinBindingsValue,
    internalLayers = [],
    rigDefinition = null
) {
    const meshDefinitions = normalizeRasterMeshDefinitions(meshDefinitionsValue);
    const skinBindings = normalizeRasterSkinBindings(skinBindingsValue);
    const errors = [];

    if (meshDefinitions == null && skinBindings == null) {
        return { ok: true, errors, meshDefinitions: null, skinBindings: null };
    }
    if (!Array.isArray(meshDefinitions)) {
        addError(errors, 'invalid-mesh-definitions', 'meshDefinitions', 'meshDefinitions must be an array');
        return { ok: false, errors, meshDefinitions, skinBindings };
    }
    if (skinBindings != null && !Array.isArray(skinBindings)) {
        addError(errors, 'invalid-skin-bindings', 'skinBindings', 'skinBindings must be an array');
    }

    const layerById = new Map((Array.isArray(internalLayers) ? internalLayers : [])
        .filter(layer => typeof layer?.id === 'string' && layer.id.length > 0)
        .map(layer => [layer.id, layer]));
    const boneIds = new Set((Array.isArray(rigDefinition?.bones) ? rigDefinition.bones : [])
        .map(bone => bone?.boneId)
        .filter(id => typeof id === 'string' && id.length > 0));
    const meshById = new Map();
    const meshByTargetId = new Map();
    const verticesByMeshId = new Map();

    meshDefinitions.forEach((mesh, meshIndex) => {
        const path = `meshDefinitions[${meshIndex}]`;
        if (!mesh || typeof mesh !== 'object' || Array.isArray(mesh)) {
            addError(errors, 'invalid-mesh-definition', path, 'Mesh definition must be an object');
            return;
        }
        if (mesh.version !== RASTER_MESH_SCHEMA_VERSION) {
            addError(errors, 'unsupported-mesh-version', `${path}.version`, 'unsupported Mesh version');
        }
        if (typeof mesh.meshId !== 'string' || mesh.meshId.length === 0) {
            addError(errors, 'invalid-mesh-id', `${path}.meshId`, 'meshId must be a non-empty string');
        } else {
            if (meshById.has(mesh.meshId)) {
                addError(errors, 'duplicate-mesh-id', `${path}.meshId`, `duplicate Mesh ${mesh.meshId}`);
            }
            meshById.set(mesh.meshId, mesh);
        }
        if (typeof mesh.targetInternalLayerId !== 'string' || mesh.targetInternalLayerId.length === 0) {
            addError(errors, 'invalid-mesh-target-id', `${path}.targetInternalLayerId`, 'targetInternalLayerId must be a non-empty string');
        } else {
            const layer = layerById.get(mesh.targetInternalLayerId);
            if (!layer) {
                addError(errors, 'dangling-mesh-target-id', `${path}.targetInternalLayerId`, `missing internal Layer ${mesh.targetInternalLayerId}`);
            } else if (layer.type !== 'raster') {
                addError(errors, 'mesh-target-raster-required', `${path}.targetInternalLayerId`, 'Mesh target must be a Raster internal Layer');
            }
            if (meshByTargetId.has(mesh.targetInternalLayerId)) {
                addError(errors, 'duplicate-mesh-target', `${path}.targetInternalLayerId`, `Raster ${mesh.targetInternalLayerId} already has a Mesh`);
            }
            meshByTargetId.set(mesh.targetInternalLayerId, mesh);
        }
        if (!Array.isArray(mesh.vertices)
            || mesh.vertices.length < 3
            || mesh.vertices.length > RASTER_MESH_MAX_VERTICES) {
            addError(errors, 'invalid-mesh-vertices', `${path}.vertices`, `Mesh needs 3-${RASTER_MESH_MAX_VERTICES} vertices`);
        }
        const vertexById = new Map();
        if (Array.isArray(mesh.vertices)) {
            mesh.vertices.forEach((vertex, vertexIndex) => {
                const vertexPath = `${path}.vertices[${vertexIndex}]`;
                if (!vertex || typeof vertex !== 'object' || Array.isArray(vertex)) {
                    addError(errors, 'invalid-mesh-vertex', vertexPath, 'Mesh vertex must be an object');
                    return;
                }
                if (typeof vertex.vertexId !== 'string' || vertex.vertexId.length === 0) {
                    addError(errors, 'invalid-vertex-id', `${vertexPath}.vertexId`, 'vertexId must be a non-empty string');
                } else {
                    if (vertexById.has(vertex.vertexId)) {
                        addError(errors, 'duplicate-vertex-id', `${vertexPath}.vertexId`, `duplicate vertex ${vertex.vertexId}`);
                    }
                    vertexById.set(vertex.vertexId, vertex);
                }
                if (!Number.isFinite(vertex.x) || !Number.isFinite(vertex.y)) {
                    addError(errors, 'non-finite-mesh-vertex', vertexPath, 'Mesh vertex coordinates must be finite');
                }
            });
        }
        verticesByMeshId.set(mesh.meshId, vertexById);

        if (!Array.isArray(mesh.triangles) || mesh.triangles.length === 0) {
            addError(errors, 'invalid-mesh-triangles', `${path}.triangles`, 'Mesh needs at least one triangle');
        } else {
            const triangleKeys = new Set();
            mesh.triangles.forEach((triangle, triangleIndex) => {
                const trianglePath = `${path}.triangles[${triangleIndex}]`;
                if (!Array.isArray(triangle) || triangle.length !== 3) {
                    addError(errors, 'invalid-mesh-triangle', trianglePath, 'Triangle must have three vertex ids');
                    return;
                }
                if (new Set(triangle).size !== 3
                    || triangle.some(id => typeof id !== 'string' || id.length === 0)) {
                    addError(errors, 'invalid-triangle-vertex-ids', trianglePath, 'Triangle vertex ids must be three unique strings');
                    return;
                }
                const canonical = [...triangle].sort().join(':');
                if (triangleKeys.has(canonical)) {
                    addError(errors, 'duplicate-mesh-triangle', trianglePath, 'duplicate triangle');
                }
                triangleKeys.add(canonical);
                const points = triangle.map(id => vertexById.get(id));
                if (points.some(point => !point)) {
                    addError(errors, 'dangling-triangle-vertex-id', trianglePath, 'Triangle references a missing vertex');
                    return;
                }
                if (points.every(point => Number.isFinite(point.x) && Number.isFinite(point.y))
                    && Math.abs(signedTriangleAreaDouble(points[0], points[1], points[2])) <= TRIANGLE_AREA_EPSILON) {
                    addError(errors, 'degenerate-mesh-triangle', trianglePath, 'Triangle area must be non-zero');
                }
            });
        }
    });

    const boundMeshIds = new Set();
    if (Array.isArray(skinBindings)) {
        skinBindings.forEach((binding, bindingIndex) => {
            const path = `skinBindings[${bindingIndex}]`;
            if (!binding || typeof binding !== 'object' || Array.isArray(binding)) {
                addError(errors, 'invalid-skin-binding', path, 'Skin binding must be an object');
                return;
            }
            if (binding.version !== RASTER_MESH_SCHEMA_VERSION) {
                addError(errors, 'unsupported-skin-version', `${path}.version`, 'unsupported Skin binding version');
            }
            if (typeof binding.meshId !== 'string' || binding.meshId.length === 0) {
                addError(errors, 'invalid-skin-mesh-id', `${path}.meshId`, 'meshId must be a non-empty string');
            } else {
                if (boundMeshIds.has(binding.meshId)) {
                    addError(errors, 'duplicate-skin-binding', `${path}.meshId`, `duplicate Skin binding for Mesh ${binding.meshId}`);
                }
                boundMeshIds.add(binding.meshId);
                if (!meshById.has(binding.meshId)) {
                    addError(errors, 'dangling-skin-mesh-id', `${path}.meshId`, `missing Mesh ${binding.meshId}`);
                }
            }
            if (!Array.isArray(binding.vertexWeights)) {
                addError(errors, 'invalid-vertex-weights', `${path}.vertexWeights`, 'vertexWeights must be an array');
                return;
            }
            const vertexById = verticesByMeshId.get(binding.meshId) || new Map();
            const weightedVertexIds = new Set();
            binding.vertexWeights.forEach((vertexWeight, vertexWeightIndex) => {
                const weightPath = `${path}.vertexWeights[${vertexWeightIndex}]`;
                if (!vertexWeight || typeof vertexWeight !== 'object' || Array.isArray(vertexWeight)) {
                    addError(errors, 'invalid-vertex-weight', weightPath, 'Vertex weight must be an object');
                    return;
                }
                if (typeof vertexWeight.vertexId !== 'string' || vertexWeight.vertexId.length === 0) {
                    addError(errors, 'invalid-weight-vertex-id', `${weightPath}.vertexId`, 'vertexId must be a non-empty string');
                } else {
                    if (weightedVertexIds.has(vertexWeight.vertexId)) {
                        addError(errors, 'duplicate-vertex-weight', `${weightPath}.vertexId`, `duplicate weights for vertex ${vertexWeight.vertexId}`);
                    }
                    weightedVertexIds.add(vertexWeight.vertexId);
                    if (!vertexById.has(vertexWeight.vertexId)) {
                        addError(errors, 'dangling-weight-vertex-id', `${weightPath}.vertexId`, `missing vertex ${vertexWeight.vertexId}`);
                    }
                }
                if (!Array.isArray(vertexWeight.influences)) {
                    addError(errors, 'invalid-influences', `${weightPath}.influences`, 'influences must be an array');
                    return;
                }
                if (vertexWeight.influences.length > RASTER_MESH_MAX_INFLUENCES) {
                    addError(errors, 'too-many-influences', `${weightPath}.influences`, `at most ${RASTER_MESH_MAX_INFLUENCES} influences are allowed`);
                }
                const influenceBoneIds = new Set();
                let totalWeight = 0;
                vertexWeight.influences.forEach((influence, influenceIndex) => {
                    const influencePath = `${weightPath}.influences[${influenceIndex}]`;
                    if (!influence || typeof influence !== 'object' || Array.isArray(influence)) {
                        addError(errors, 'invalid-influence', influencePath, 'Influence must be an object');
                        return;
                    }
                    if (typeof influence.boneId !== 'string' || influence.boneId.length === 0) {
                        addError(errors, 'invalid-influence-bone-id', `${influencePath}.boneId`, 'boneId must be a non-empty string');
                    } else {
                        if (influenceBoneIds.has(influence.boneId)) {
                            addError(errors, 'duplicate-influence-bone-id', `${influencePath}.boneId`, `duplicate Bone ${influence.boneId}`);
                        }
                        influenceBoneIds.add(influence.boneId);
                        if (!boneIds.has(influence.boneId)) {
                            addError(errors, 'dangling-influence-bone-id', `${influencePath}.boneId`, `missing Bone ${influence.boneId}`);
                        }
                    }
                    if (!Number.isFinite(influence.weight) || influence.weight < 0) {
                        addError(errors, 'invalid-influence-weight', `${influencePath}.weight`, 'weight must be finite and non-negative');
                    } else {
                        totalWeight += influence.weight;
                    }
                });
                if (vertexWeight.influences.length > 0 && !(totalWeight > 0)) {
                    addError(errors, 'zero-influence-weight-sum', `${weightPath}.influences`, 'influence weight sum must be positive');
                }
            });
        });
    }

    return { ok: errors.length === 0, errors, meshDefinitions, skinBindings };
}

function remapId(id, idMap) {
    if (id == null) return null;
    if (idMap instanceof Map) return idMap.has(id) ? idMap.get(id) : id;
    if (idMap && typeof idMap === 'object' && hasOwn(idMap, id)) return idMap[id];
    return id;
}

export function remapRasterMeshDefinitions(value, idMap) {
    const meshDefinitions = normalizeRasterMeshDefinitions(value);
    if (!Array.isArray(meshDefinitions)) return meshDefinitions;
    return meshDefinitions.map(mesh => {
        if (!mesh || typeof mesh !== 'object') return clonePlainValue(mesh);
        return {
            ...clonePlainValue(mesh),
            meshId: remapId(mesh.meshId, idMap),
            targetInternalLayerId: remapId(mesh.targetInternalLayerId, idMap),
            vertices: Array.isArray(mesh.vertices)
                ? mesh.vertices.map(vertex => vertex && typeof vertex === 'object'
                    ? { ...clonePlainValue(vertex), vertexId: remapId(vertex.vertexId, idMap) }
                    : clonePlainValue(vertex))
                : clonePlainValue(mesh.vertices),
            triangles: Array.isArray(mesh.triangles)
                ? mesh.triangles.map(triangle => Array.isArray(triangle)
                    ? triangle.map(vertexId => remapId(vertexId, idMap))
                    : clonePlainValue(triangle))
                : clonePlainValue(mesh.triangles),
            ...(hasOwn(mesh, 'generator')
                ? {
                    generator: {
                        ...clonePlainValue(mesh.generator),
                        ...(mesh.generator?.source && typeof mesh.generator.source === 'object'
                            ? {
                                source: {
                                    ...clonePlainValue(mesh.generator.source),
                                    snapshotId: remapId(mesh.generator.source.snapshotId, idMap)
                                }
                            }
                            : {})
                    }
                }
                : {})
        };
    });
}

export function remapRasterSkinBindings(value, idMap) {
    const skinBindings = normalizeRasterSkinBindings(value);
    if (!Array.isArray(skinBindings)) return skinBindings;
    return skinBindings.map(binding => {
        if (!binding || typeof binding !== 'object') return clonePlainValue(binding);
        return {
            ...clonePlainValue(binding),
            meshId: remapId(binding.meshId, idMap),
            vertexWeights: Array.isArray(binding.vertexWeights)
                ? binding.vertexWeights.map(vertexWeight => vertexWeight && typeof vertexWeight === 'object'
                    ? {
                        ...clonePlainValue(vertexWeight),
                        vertexId: remapId(vertexWeight.vertexId, idMap),
                        influences: Array.isArray(vertexWeight.influences)
                            ? vertexWeight.influences.map(influence => influence && typeof influence === 'object'
                                ? { ...clonePlainValue(influence), boneId: remapId(influence.boneId, idMap) }
                                : clonePlainValue(influence))
                            : clonePlainValue(vertexWeight.influences)
                    }
                    : clonePlainValue(vertexWeight))
                : clonePlainValue(binding.vertexWeights)
        };
    });
}

export function getRasterMeshIdsForInternalLayers(meshDefinitionsValue, internalLayerIds) {
    const layerIds = internalLayerIds instanceof Set
        ? internalLayerIds
        : new Set(Array.isArray(internalLayerIds) ? internalLayerIds : []);
    const meshDefinitions = normalizeRasterMeshDefinitions(meshDefinitionsValue);
    if (!Array.isArray(meshDefinitions)) return [];
    return meshDefinitions
        .filter(mesh => layerIds.has(mesh?.targetInternalLayerId))
        .map(mesh => mesh?.meshId)
        .filter(meshId => typeof meshId === 'string' && meshId.length > 0);
}

export function removeRasterSkinningTargets(meshDefinitionsValue, skinBindingsValue, internalLayerIds) {
    const removedMeshIds = new Set(getRasterMeshIdsForInternalLayers(meshDefinitionsValue, internalLayerIds));
    const meshDefinitions = normalizeRasterMeshDefinitions(meshDefinitionsValue);
    const skinBindings = normalizeRasterSkinBindings(skinBindingsValue);
    return {
        meshDefinitions: Array.isArray(meshDefinitions)
            ? meshDefinitions.filter(mesh => !removedMeshIds.has(mesh?.meshId))
            : meshDefinitions,
        skinBindings: Array.isArray(skinBindings)
            ? skinBindings.filter(binding => !removedMeshIds.has(binding?.meshId))
            : skinBindings,
        removedMeshIds: [...removedMeshIds]
    };
}

/**
 * 既存Bone FKを使い、保存しないFrame頂点を評価する。
 * 返すtriangleIndicesは保存triangle順を維持するdense index adapterである。
 */
export function evaluateRasterBoneSkinning(asset, clip, timelineFrame) {
    const validation = validateRasterBoneSkinning(
        asset?.meshDefinitions,
        asset?.skinBindings,
        asset?.internalLayers,
        asset?.rigDefinition
    );
    if (!validation.ok) {
        return { ok: false, errors: validation.errors, meshResults: [], resultByMeshId: new Map() };
    }
    if (!Array.isArray(validation.meshDefinitions) || validation.meshDefinitions.length === 0) {
        return { ok: true, errors: [], meshResults: [], resultByMeshId: new Map() };
    }

    const bindBones = evaluateRigidBones(asset, null, timelineFrame);
    const currentBones = evaluateRigidBones(asset, clip, timelineFrame);
    const errors = [...bindBones.errors, ...currentBones.errors];
    if (!bindBones.ok || !currentBones.ok) {
        return { ok: false, errors, meshResults: [], resultByMeshId: new Map() };
    }

    const bindingByMeshId = new Map((validation.skinBindings || [])
        .map(binding => [binding.meshId, binding]));
    const skinMatrixByBoneId = new Map();
    const referencedBoneIds = new Set();
    (validation.skinBindings || []).forEach(binding => {
        (binding.vertexWeights || []).forEach(vertexWeight => {
            (vertexWeight.influences || []).forEach(influence => referencedBoneIds.add(influence.boneId));
        });
    });
    referencedBoneIds.forEach(boneId => {
        const bindMatrix = bindBones.poseByBoneId.get(boneId)?.worldMatrix;
        const currentMatrix = currentBones.poseByBoneId.get(boneId)?.worldMatrix;
        const inverseBind = bindMatrix ? invertTransformMatrix(bindMatrix) : null;
        if (!bindMatrix || !currentMatrix || !inverseBind) {
            addError(errors, 'non-invertible-bind-bone', `rigDefinition.bones.${boneId}`, `Bone ${boneId} has no invertible bind matrix`);
            return;
        }
        skinMatrixByBoneId.set(boneId, multiplyTransformMatrices(currentMatrix, inverseBind));
    });
    if (errors.length > 0) {
        return { ok: false, errors, meshResults: [], resultByMeshId: new Map() };
    }

    const meshResults = validation.meshDefinitions.map(mesh => {
        const binding = bindingByMeshId.get(mesh.meshId) || null;
        const weightsByVertexId = new Map((binding?.vertexWeights || [])
            .map(vertexWeight => [vertexWeight.vertexId, vertexWeight.influences || []]));
        const vertexIndexById = new Map(mesh.vertices.map((vertex, index) => [vertex.vertexId, index]));
        const vertices = mesh.vertices.map(vertex => {
            const influences = weightsByVertexId.get(vertex.vertexId) || [];
            const weightSum = influences.reduce((sum, influence) => sum + influence.weight, 0);
            if (influences.length === 0 || !(weightSum > 0)) {
                return { vertexId: vertex.vertexId, bindX: vertex.x, bindY: vertex.y, x: vertex.x, y: vertex.y };
            }
            let x = 0;
            let y = 0;
            influences.forEach(influence => {
                const point = applyTransformMatrix(skinMatrixByBoneId.get(influence.boneId), vertex.x, vertex.y);
                const normalizedWeight = influence.weight / weightSum;
                x += point.x * normalizedWeight;
                y += point.y * normalizedWeight;
            });
            return { vertexId: vertex.vertexId, bindX: vertex.x, bindY: vertex.y, x, y };
        });
        const triangleIndices = mesh.triangles.map(triangle => triangle.map(vertexId => vertexIndexById.get(vertexId)));
        return {
            meshId: mesh.meshId,
            targetInternalLayerId: mesh.targetInternalLayerId,
            vertices,
            triangleIndices,
            generator: hasOwn(mesh, 'generator') ? clonePlainValue(mesh.generator) : null
        };
    });
    return {
        ok: true,
        errors: [],
        meshResults,
        resultByMeshId: new Map(meshResults.map(result => [result.meshId, result]))
    };
}
