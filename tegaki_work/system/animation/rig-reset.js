/**
 * Bounded cleanup planner for the current RIG Lens setup shapes.
 * It owns no UI, History, pixels, or persisted mode state.
 */

import {
    evaluateRigidBones,
    evaluateRigidParts,
    normalizeRigMotion,
    removeRigDefinitionTargets,
    removeRigMotionTargets,
    validateRigDefinition,
    validateRigMotion
} from './part-rig.js';
import { resolveRigPartTarget } from './rig-part-target.js';
import {
    normalizeRasterMeshDefinitions,
    normalizeRasterSkinBindings,
    removeRasterSkinningTargets,
    validateRasterBoneSkinning
} from './raster-bone-skinning.js';
import { ALPHA_FIT_GRID_GENERATOR } from './raster-bone-auto-setup.js';
import { FIXED_VERTEX_POSITION_EDIT_MODE } from './raster-mesh-vertex-position-edit.js';
import { LIMITED_SKIN_CORRECTION_MODE } from './skin-influence-correction.js';
import { FIXED_TOPOLOGY_SKIN_WEIGHT_BRUSH_MODE } from './skin-weight-brush.js';

const RIG_DEFINITION_FIELDS = new Set([
    'version', 'parts', 'bones', 'rigidBindings', 'warpAnchorConstraints'
]);
const RIG_MOTION_FIELDS = new Set(['version', 'partTracks', 'boneTracks']);
const PART_FIELDS = new Set(['partId', 'parentPartId', 'bindTransform']);
const BONE_FIELDS = new Set(['boneId', 'parentBoneId', 'bindTransform', 'length', 'name']);
const RIGID_BINDING_FIELDS = new Set(['boneId', 'partId']);
const ANCHOR_FIELDS = new Set([
    'version', 'sourceFolderLayerId', 'targetBoneId', 'bindPoint', 'enabled'
]);
const TRANSFORM_FIELDS = new Set(['x', 'y', 'scaleX', 'scaleY', 'rotation', 'pivotX', 'pivotY']);
const PART_MOTION_KEY_FIELDS = new Set(['frame', 'interpolation', 'x', 'y', 'scaleX', 'scaleY', 'rotation']);
const BONE_MOTION_KEY_FIELDS = PART_MOTION_KEY_FIELDS;
const PART_TRACK_FIELDS = new Set(['partId', 'keyframes']);
const BONE_TRACK_FIELDS = new Set(['boneId', 'keyframes']);
const MESH_FIELDS = new Set(['version', 'meshId', 'targetInternalLayerId', 'vertices', 'triangles', 'generator']);
const MESH_VERTEX_FIELDS = new Set(['vertexId', 'x', 'y']);
const MESH_GENERATOR_FIELDS = new Set([
    'type', 'columns', 'rows', 'contentBounds', 'bindBounds', 'source',
    'topologyEditMode', 'weightCorrectionMode'
]);
const MESH_SOURCE_FIELDS = new Set(['snapshotId', 'updatedAt', 'width', 'height', 'rasterBounds']);
const BOUNDS_FIELDS = new Set(['x', 'y', 'width', 'height']);
const SKIN_BINDING_FIELDS = new Set(['version', 'meshId', 'vertexWeights']);
const VERTEX_WEIGHT_FIELDS = new Set(['vertexId', 'influences']);
const INFLUENCE_FIELDS = new Set(['boneId', 'weight']);

function hasOnlyFields(value, fields) {
    return !!value && typeof value === 'object' && !Array.isArray(value)
        && Object.keys(value).every(field => fields.has(field));
}

function hasNoUnknownRigFields(rigDefinition) {
    if (!hasOnlyFields(rigDefinition, RIG_DEFINITION_FIELDS)) return false;
    if (!rigDefinition.parts.every(part => (
        hasOnlyFields(part, PART_FIELDS)
        && hasOnlyFields(part.bindTransform, TRANSFORM_FIELDS)
    ))) return false;
    const bones = Array.isArray(rigDefinition.bones) ? rigDefinition.bones : [];
    if (!bones.every(bone => (
        hasOnlyFields(bone, BONE_FIELDS)
        && hasOnlyFields(bone.bindTransform, TRANSFORM_FIELDS)
    ))) return false;
    const bindings = Array.isArray(rigDefinition.rigidBindings) ? rigDefinition.rigidBindings : [];
    if (!bindings.every(binding => hasOnlyFields(binding, RIGID_BINDING_FIELDS))) return false;
    const anchors = Array.isArray(rigDefinition.warpAnchorConstraints)
        ? rigDefinition.warpAnchorConstraints : [];
    return anchors.every(anchor => (
        hasOnlyFields(anchor, ANCHOR_FIELDS)
        && hasOnlyFields(anchor.bindPoint, new Set(['x', 'y']))
    ));
}

function hasNoUnknownMotionFields(rigMotion) {
    if (rigMotion == null) return true;
    if (!hasOnlyFields(rigMotion, RIG_MOTION_FIELDS)) return false;
    const partTracks = Array.isArray(rigMotion.partTracks) ? rigMotion.partTracks : [];
    if (!partTracks.every(track => (
        hasOnlyFields(track, PART_TRACK_FIELDS)
        && Array.isArray(track.keyframes)
        && track.keyframes.every(key => hasOnlyFields(key, PART_MOTION_KEY_FIELDS))
    ))) return false;
    const boneTracks = Array.isArray(rigMotion.boneTracks) ? rigMotion.boneTracks : [];
    return boneTracks.every(track => (
        hasOnlyFields(track, BONE_TRACK_FIELDS)
        && Array.isArray(track.keyframes)
        && track.keyframes.every(key => hasOnlyFields(key, BONE_MOTION_KEY_FIELDS))
    ));
}

function hasNoUnknownMeshFields(meshDefinitions, skinBindings) {
    if (!meshDefinitions.every(mesh => (
        hasOnlyFields(mesh, MESH_FIELDS)
        && Array.isArray(mesh.vertices)
        && mesh.vertices.every(vertex => hasOnlyFields(vertex, MESH_VERTEX_FIELDS))
        && hasOnlyFields(mesh.generator, MESH_GENERATOR_FIELDS)
        && hasOnlyFields(mesh.generator.source, MESH_SOURCE_FIELDS)
        && hasOnlyFields(mesh.generator.contentBounds, BOUNDS_FIELDS)
        && hasOnlyFields(mesh.generator.bindBounds, BOUNDS_FIELDS)
        && hasOnlyFields(mesh.generator.source.rasterBounds, BOUNDS_FIELDS)
    ))) return false;
    return skinBindings.every(binding => (
        hasOnlyFields(binding, SKIN_BINDING_FIELDS)
        && Array.isArray(binding.vertexWeights)
        && binding.vertexWeights.every(vertexWeight => (
            hasOnlyFields(vertexWeight, VERTEX_WEIGHT_FIELDS)
            && Array.isArray(vertexWeight.influences)
            && vertexWeight.influences.every(influence => hasOnlyFields(influence, INFLUENCE_FIELDS))
        ))
    ));
}

function containsUnsupportedMesh(mesh) {
    const generator = mesh?.generator;
    if (mesh?.manual === true || mesh?.isManual === true || generator?.manual === true) return true;
    if (generator?.type !== ALPHA_FIT_GRID_GENERATOR) return true;
    if (generator.topologyEditMode != null
        && generator.topologyEditMode !== FIXED_VERTEX_POSITION_EDIT_MODE) return true;
    if (generator.weightCorrectionMode != null
        && ![
            LIMITED_SKIN_CORRECTION_MODE,
            FIXED_TOPOLOGY_SKIN_WEIGHT_BRUSH_MODE
        ].includes(generator.weightCorrectionMode)) return true;
    return false;
}

function fail(reason) {
    return { ok: false, reason, affectedClipCount: 0, affectedRigKeyCount: 0 };
}

function clipKeyCount(rigMotion, partIds, boneIds, mode) {
    const motion = normalizeRigMotion(rigMotion);
    if (!motion) return 0;
    const partCount = mode === 'part'
        ? (motion.partTracks || []).reduce((sum, track) => (
            sum + (partIds.has(track?.partId) ? track.keyframes.length : 0)
        ), 0)
        : 0;
    const boneCount = (motion.boneTracks || []).reduce((sum, track) => (
        sum + (boneIds.has(track?.boneId) ? track.keyframes.length : 0)
    ), 0);
    return partCount + boneCount;
}

/** Build an all-or-nothing plan for a supported current RIG Lens rig. */
export function createClipAssetRigResetPlan(asset, clips = []) {
    if (!asset?.id) return fail('asset-not-found');
    if (!Array.isArray(clips)) return fail('invalid-clip-set');

    const rigDefinition = asset.rigDefinition;
    const definitionValidation = validateRigDefinition(rigDefinition, asset.internalLayers);
    if (!definitionValidation.ok || !definitionValidation.value) {
        return fail('unsupported-rig-definition');
    }
    const normalizedRig = definitionValidation.value;
    if (!hasNoUnknownRigFields(normalizedRig)) return fail('unsupported-rig-data');

    const parts = normalizedRig.parts;
    const bones = Array.isArray(normalizedRig.bones) ? normalizedRig.bones : [];
    const rigidBindings = Array.isArray(normalizedRig.rigidBindings) ? normalizedRig.rigidBindings : [];
    const warpAnchorConstraints = Array.isArray(normalizedRig.warpAnchorConstraints)
        ? normalizedRig.warpAnchorConstraints : [];
    const meshDefinitions = normalizeRasterMeshDefinitions(asset.meshDefinitions);
    const skinBindings = normalizeRasterSkinBindings(asset.skinBindings);
    if ((meshDefinitions != null && !Array.isArray(meshDefinitions))
        || (skinBindings != null && !Array.isArray(skinBindings))) return fail('unsupported-mesh-data');
    const meshes = Array.isArray(meshDefinitions) ? meshDefinitions : [];
    const skins = Array.isArray(skinBindings) ? skinBindings : [];
    const hasMeshData = meshes.length > 0 || skins.length > 0;

    let mode = null;
    if (parts.length > 0) {
        mode = 'part';
        if (hasMeshData) return fail('mixed-part-deform-rig');
        if (parts.some(part => !resolveRigPartTarget(asset, part.partId).ok)) {
            return fail('unsupported-part-target');
        }
    } else {
        mode = 'deform';
        if (rigidBindings.length > 0 || warpAnchorConstraints.length > 0) {
            return fail('unsupported-rig-composition');
        }
        if (bones.length === 0) return fail('empty-rig-setup');
        if (bones.filter(bone => bone.parentBoneId == null).length !== 1
            || bones.some(bone => !Number.isFinite(bone.length) || bone.length <= 0)) {
            return fail('unsupported-deform-bones');
        }
        if (hasMeshData) {
            const meshValidation = validateRasterBoneSkinning(
                asset.meshDefinitions, asset.skinBindings, asset.internalLayers, normalizedRig
            );
            if (!meshValidation.ok) return fail('unsupported-mesh-skinning');
            if (meshes.some(mesh => containsUnsupportedMesh(mesh)
                || !asset.internalLayers?.some(layer => (
                    layer?.id === mesh.targetInternalLayerId
                    && layer.type === 'raster'
                    && layer.isBackground !== true
                    && layer.parentLayerId == null
                )))) {
                return fail('unsupported-mesh-generator');
            }
            if (!hasNoUnknownMeshFields(meshes, skins)) return fail('unsupported-mesh-data');
        }
    }

    const boneIds = new Set(bones.map(bone => bone.boneId));
    const partIds = new Set(parts.map(part => part.partId));
    if (mode === 'part') {
        const boundBoneIds = new Set(rigidBindings.map(binding => binding.boneId));
        const anchorBoneIds = new Set(warpAnchorConstraints.map(constraint => constraint.targetBoneId));
        if (bones.some(bone => !boundBoneIds.has(bone.boneId) && !anchorBoneIds.has(bone.boneId))) {
            return fail('unsupported-unowned-part-bone');
        }
        const bindRemoval = removeRigDefinitionTargets(normalizedRig, {
            partIds: [...partIds], boneIds: [...boneIds]
        });
        if (!bindRemoval.ok) return fail('unsupported-part-ownership');
        const remainingParts = bindRemoval.value?.parts || [];
        const remainingBones = bindRemoval.value?.bones || [];
        const remainingBindings = bindRemoval.value?.rigidBindings || [];
        const remainingConstraints = bindRemoval.value?.warpAnchorConstraints || [];
        if (remainingParts.length || remainingBones.length || remainingBindings.length || remainingConstraints.length) {
            return fail('unsupported-part-ownership');
        }
        const partsEvaluation = evaluateRigidParts({ ...asset, rigDefinition: normalizedRig }, null, 0);
        const bonesEvaluation = bones.length > 0
            ? evaluateRigidBones({ ...asset, rigDefinition: normalizedRig }, null, 0)
            : { ok: true };
        if (!partsEvaluation.ok || !bonesEvaluation.ok) return fail('invalid-part-evaluation');
    } else {
        const bindRemoval = removeRigDefinitionTargets(normalizedRig, { boneIds: [...boneIds] });
        if (!bindRemoval.ok || (bindRemoval.value?.bones || []).length > 0) {
            return fail('unsupported-deform-ownership');
        }
        const bonesEvaluation = evaluateRigidBones({ ...asset, rigDefinition: normalizedRig }, null, 0);
        if (!bonesEvaluation.ok) return fail('invalid-deform-evaluation');
    }

    const clipUpdates = [];
    let affectedRigKeyCount = 0;
    for (const clip of clips) {
        if (!clip || clip.assetId !== asset.id) return fail('invalid-clip-set');
        const motionValidation = validateRigMotion(clip.rigMotion, normalizedRig, clip.duration);
        if (!motionValidation.ok || !hasNoUnknownMotionFields(motionValidation.value)) {
            return fail('unsupported-clip-rig-motion');
        }
        const nextRigMotion = removeRigMotionTargets(clip.rigMotion, {
            partIds: mode === 'part' ? [...partIds] : [],
            boneIds: [...boneIds]
        });
        affectedRigKeyCount += clipKeyCount(clip.rigMotion, partIds, boneIds, mode);
        clipUpdates.push({ clip, rigMotion: nextRigMotion });
    }

    const removedMeshData = removeRasterSkinningTargets(
        asset.meshDefinitions, asset.skinBindings,
        new Set(meshes.map(mesh => mesh.targetInternalLayerId))
    );
    if ((removedMeshData.meshDefinitions || []).length > 0
        || (removedMeshData.skinBindings || []).length > 0) {
        return fail(mode === 'part' ? 'mixed-part-deform-rig' : 'unsupported-mesh-ownership');
    }

    return {
        ok: true,
        assetId: asset.id,
        mode,
        partIds: [...partIds],
        boneIds: [...boneIds],
        affectedClipCount: clips.length,
        affectedRigKeyCount,
        nextRigDefinition: null,
        nextMeshDefinitions: null,
        nextSkinBindings: null,
        clipUpdates
    };
}
