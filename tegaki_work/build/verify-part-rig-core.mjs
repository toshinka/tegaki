import assert from 'node:assert/strict';
import { sampleClipBakeState } from '../system/animation/clip-bake-sampler.js';
import { sampleClipTransform } from '../system/animation/clip-transform-sampler.js';
import {
    evaluateRigidParts,
    moveRigBoneKey,
    moveRigPartKey,
    remapRigMotion,
    validateRigDefinition,
    validateRigMotion
} from '../system/animation/part-rig.js';

globalThis.window = globalThis.window || {};
const {
    ClipAssetModel,
    ClipInstanceModel,
    TimelineModel
} = await import('../system/animation/animation-data-model.js');

function findLayer(asset, name) {
    return asset.internalLayers.find(layer => layer.name === name);
}

function assertLegacyShapeHasNoRigFields(value) {
    assert.equal(Object.hasOwn(value, 'rigDefinition'), false, 'legacy ClipAsset omits rigDefinition');
    assert.equal(Object.hasOwn(value, 'rigMotion'), false, 'legacy ClipInstance omits rigMotion');
}

function assertClose(actual, expected, message, epsilon = 1e-9) {
    assert.ok(Math.abs(actual - expected) <= epsilon, `${message}: ${actual} !== ${expected}`);
}

function assertMatrixClose(actual, expected, message) {
    ['a', 'b', 'c', 'd', 'tx', 'ty'].forEach(field => {
        assertClose(actual[field], expected[field], `${message}.${field}`);
    });
}

const legacyAsset = new ClipAssetModel({
    id: 'asset-source',
    name: 'Legacy CAF',
    internalLayers: [
        { id: 'folder-front', name: 'Front', type: 'folder' },
        {
            id: 'line-layer',
            name: 'Line',
            type: 'raster',
            parentLayerId: 'folder-front',
            clippingMode: 'normal'
        },
        {
            id: 'color-layer',
            name: 'Color',
            type: 'raster',
            parentLayerId: 'folder-front'
        },
        { id: 'body-layer', name: 'Body', type: 'raster' }
    ]
});
const legacyClip = new ClipInstanceModel({
    id: 'clip-source',
    assetId: legacyAsset.id,
    startFrame: 5,
    duration: 5,
    transform: {
        x: 0,
        y: 2,
        scaleX: 1,
        scaleY: 1,
        rotation: 0,
        opacity: 1,
        anchorX: 0.25,
        anchorY: 0.75
    },
    transformKeyframes: [
        {
            frame: 0,
            interpolation: 'linear',
            x: 0,
            y: 2,
            scaleX: 1,
            scaleY: 1,
            rotation: 0,
            opacity: 1
        },
        {
            frame: 4,
            interpolation: 'hold',
            x: 8,
            y: 10,
            scaleX: 2,
            scaleY: 0.5,
            rotation: 1,
            opacity: 0.5
        }
    ]
});

assertLegacyShapeHasNoRigFields(legacyAsset.serialize());
assertLegacyShapeHasNoRigFields(legacyClip.serialize());
assert.deepEqual(sampleClipTransform(legacyClip, 7), {
    x: 4,
    y: 6,
    scaleX: 1.5,
    scaleY: 0.75,
    rotation: 0.5,
    opacity: 0.75,
    blendMode: 'normal',
    blendStrength: 1,
    anchorX: 0.25,
    anchorY: 0.75
}, 'root Motion fixed input');
assert.equal(sampleClipTransform({
    startFrame: 0,
    duration: 3,
    transform: { x: 0 },
    transformKeyframes: [
        { frame: 0, interpolation: 'hold', x: 2 },
        { frame: 2, x: 10 }
    ]
}, 1).x, 2, 'root Motion HOLD fixed input');
const cubicRootSample = sampleClipTransform({
    startFrame: 0,
    duration: 3,
    transform: { x: 0, anchorX: 0.2, anchorY: 0.8 },
    transformKeyframes: [
        {
            frame: 0,
            interpolation: 'linear',
            easing: { type: 'cubic-bezier', x1: 0, y1: 0, x2: 1, y2: 1 },
            x: 0
        },
        { frame: 2, x: 10 }
    ]
}, 1);
assertClose(cubicRootSample.x, 5, 'root Motion cubic-bezier fixed input', 1e-6);
assert.equal(cubicRootSample.anchorX, 0.2, 'root Motion anchorX fixed input');
assert.equal(cubicRootSample.anchorY, 0.8, 'root Motion anchorY fixed input');

const model = new TimelineModel({
    fps: 12,
    totalFrames: 12,
    clipAssets: [legacyAsset.serialize()]
});
const duplicateResult = model.duplicateClipAsset(legacyAsset.id);
assert.equal(duplicateResult.ok, true, 'duplicate ClipAsset');
const duplicatedAsset = duplicateResult.asset;
assert.deepEqual(
    duplicatedAsset.internalLayers.map(layer => layer.name),
    legacyAsset.internalLayers.map(layer => layer.name),
    'display order remains front-to-back'
);
assert.ok(duplicatedAsset.internalLayers.every(layer => {
    const source = findLayer(legacyAsset, layer.name);
    return source && source.id !== layer.id;
}), 'duplicate assigns new internal Layer ids');
assert.equal(
    findLayer(duplicatedAsset, 'Line').parentLayerId,
    findLayer(duplicatedAsset, 'Front').id,
    'display parent is remapped'
);
assert.equal(findLayer(duplicatedAsset, 'Line').clippingMode, 'normal', 'clipping contract remains');

const subtreeResult = model.duplicateClipAssetInternalLayer(legacyAsset.id, 'folder-front');
assert.equal(subtreeResult.ok, true, 'duplicate nested Folder subtree');
assert.equal(subtreeResult.duplicatedLayers.length, 3, 'Folder subtree size');
const duplicatedFolder = subtreeResult.duplicatedLayers[0];
assert.ok(subtreeResult.duplicatedLayers.slice(1).every(layer => {
    return layer.parentLayerId === duplicatedFolder.id;
}), 'subtree display parents use duplicated Folder id');

const roundTrip = new TimelineModel(model.serialize());
assert.deepEqual(roundTrip.serialize(), model.serialize(), 'legacy TimelineModel round-trip');
roundTrip.clipAssets.forEach(asset => assertLegacyShapeHasNoRigFields(asset.serialize()));

const rigDefinition = {
    version: 1,
    parts: [
        {
            partId: 'folder-front',
            parentPartId: null,
            bindTransform: { x: 10, y: 0, scaleX: 1, scaleY: 1, rotation: 0, pivotX: 0, pivotY: 0 }
        },
        {
            partId: 'line-layer',
            parentPartId: 'folder-front',
            bindTransform: { x: 5, y: 0, scaleX: 1, scaleY: 1, rotation: 0, pivotX: 0, pivotY: 0 }
        }
    ]
};
const rigMotion = {
    version: 1,
    partTracks: [
        {
            partId: 'folder-front',
            keyframes: [
                { frame: 0, interpolation: 'linear', x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
                { frame: 4, interpolation: 'hold', x: 8, y: 0, scaleX: 1, scaleY: 1, rotation: 0 }
            ]
        },
        {
            partId: 'line-layer',
            keyframes: [
                { frame: 0, interpolation: 'linear', x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
                { frame: 4, interpolation: 'hold', x: 0, y: 4, scaleX: 1, scaleY: 1, rotation: 0 }
            ]
        }
    ]
};
const movedPartKey = moveRigPartKey(rigMotion, 'folder-front', 0, 2);
assert.equal(movedPartKey.ok, true, 'Part key move succeeds');
assert.equal(movedPartKey.changed, true, 'Part key move reports change');
assert.deepEqual(
    movedPartKey.value.partTracks[0].keyframes.map(key => key.frame),
    [2, 4],
    'Part key move keeps sorted Frame order'
);
assert.equal(
    movedPartKey.value.partTracks[0].keyframes[0].interpolation,
    'linear',
    'Part key move keeps key payload'
);
assert.equal(
    moveRigPartKey(rigMotion, 'folder-front', 0, 4).reason,
    'rig-key-frame-occupied',
    'Part key move does not overwrite an occupied Frame'
);
const movedBoneKey = moveRigBoneKey({
    version: 1,
    partTracks: [],
    boneTracks: [{
        boneId: 'bone-arm',
        keyframes: [
            { frame: 0, interpolation: 'hold', x: 3, y: 4, scaleX: 1, scaleY: 1, rotation: 0 },
            { frame: 3, interpolation: 'linear', x: 8, y: 9, scaleX: 1, scaleY: 1, rotation: 1 }
        ]
    }]
}, 'bone-arm', 3, 2);
assert.equal(movedBoneKey.ok, true, 'Bone key move succeeds');
assert.deepEqual(
    movedBoneKey.value.boneTracks[0].keyframes.map(key => key.frame),
    [0, 2],
    'Bone key move keeps sorted Frame order'
);
assert.equal(movedBoneKey.value.boneTracks[0].keyframes[1].rotation, 1, 'Bone key move keeps pose payload');
const rigAsset = new ClipAssetModel({
    ...legacyAsset.serialize(),
    id: 'asset-rig',
    name: 'Rig CAF',
    rigDefinition
});
const rigClip = new ClipInstanceModel({
    id: 'clip-rig',
    assetId: rigAsset.id,
    startFrame: 5,
    duration: 5,
    rigMotion
});

assert.equal(validateRigDefinition(rigAsset.rigDefinition, rigAsset.internalLayers).ok, true, 'valid Rig definition');
assert.equal(validateRigMotion(rigClip.rigMotion, rigAsset.rigDefinition, rigClip.duration).ok, true, 'valid Rig motion');

const frame7Pose = evaluateRigidParts(rigAsset, rigClip, 7);
assert.equal(frame7Pose.ok, true, '2-level FK evaluates');
assert.deepEqual(frame7Pose.orderedPoses.map(pose => pose.partId), ['folder-front', 'line-layer']);
assertClose(frame7Pose.poseByPartId.get('folder-front').worldMatrix.tx, 14, 'root sampled x');
assertClose(frame7Pose.poseByPartId.get('line-layer').worldMatrix.tx, 19, 'child inherits root x');
assertClose(frame7Pose.poseByPartId.get('line-layer').worldMatrix.ty, 2, 'child sampled y');

const rotatedAsset = new ClipAssetModel({
    ...rigAsset.serialize(),
    id: 'asset-rotated-rig',
    rigDefinition: {
        ...rigDefinition,
        parts: rigDefinition.parts.map(part => part.partId === 'folder-front'
            ? { ...part, bindTransform: { ...part.bindTransform, rotation: Math.PI / 2 } }
            : part)
    }
});
const rotatedPose = evaluateRigidParts(rotatedAsset, new ClipInstanceModel({
    assetId: rotatedAsset.id,
    startFrame: 0,
    duration: 1
}), 0);
assertClose(rotatedPose.poseByPartId.get('line-layer').worldMatrix.tx, 10, 'rotated child world x');
assertClose(rotatedPose.poseByPartId.get('line-layer').worldMatrix.ty, 5, 'rotated child world y');

let sequentialFrame7 = null;
[5, 9, 6, 8, 7].forEach(frame => {
    const pose = evaluateRigidParts(rigAsset, rigClip, frame);
    if (frame === 7) sequentialFrame7 = pose.poseByPartId.get('line-layer').worldMatrix;
});
assertMatrixClose(sequentialFrame7, frame7Pose.poseByPartId.get('line-layer').worldMatrix, 'random seek is stateless');

const invalidDefinition = {
    version: 1,
    parts: [
        ...rigDefinition.parts,
        { ...rigDefinition.parts[1] },
        {
            partId: 'missing-layer',
            parentPartId: 'missing-parent',
            bindTransform: { x: Infinity, y: 0, scaleX: 1, scaleY: 1, rotation: 0, pivotX: 0, pivotY: 0 }
        }
    ]
};
const invalidDefinitionCodes = new Set(
    validateRigDefinition(invalidDefinition, rigAsset.internalLayers).errors.map(error => error.code)
);
assert.ok(invalidDefinitionCodes.has('duplicate-part-id'), 'duplicate Part rejected');
assert.ok(invalidDefinitionCodes.has('dangling-part-id'), 'dangling Part rejected');
assert.ok(invalidDefinitionCodes.has('dangling-parent-part-id'), 'dangling rig parent rejected');
assert.ok(invalidDefinitionCodes.has('non-finite-transform'), 'non-finite bind rejected');

const cycleDefinition = {
    version: 1,
    parts: rigDefinition.parts.map(part => ({
        ...part,
        parentPartId: part.partId === 'folder-front' ? 'line-layer' : 'folder-front'
    }))
};
assert.ok(
    validateRigDefinition(cycleDefinition, rigAsset.internalLayers).errors.some(error => error.code === 'rig-cycle'),
    'rig cycle rejected'
);
const invalidMotionCodes = new Set(validateRigMotion({
    version: 1,
    partTracks: [
        { partId: 'line-layer', keyframes: [{ frame: 5, x: Number.NaN }] },
        { partId: 'missing-layer', keyframes: [] },
        { partId: 'line-layer', keyframes: [] }
    ]
}, rigAsset.rigDefinition, rigClip.duration).errors.map(error => error.code));
assert.ok(invalidMotionCodes.has('part-key-out-of-range'), 'out-of-duration Part key rejected');
assert.ok(invalidMotionCodes.has('non-finite-part-key'), 'non-finite Part key rejected');
assert.ok(invalidMotionCodes.has('dangling-track-part-id'), 'dangling Part track rejected');
assert.ok(invalidMotionCodes.has('duplicate-part-track'), 'duplicate Part track rejected');
const invalidProjectModel = new TimelineModel({
    clipAssets: [{ ...rigAsset.serialize(), rigDefinition: invalidDefinition }],
    tracks: [{
        id: 'lane-invalid-rig',
        cels: [{ ...rigClip.serialize(), rigMotion: { version: 1, partTracks: [{ partId: 'missing-layer', keyframes: [] }] } }]
    }]
});
assert.equal(invalidProjectModel.validatePartRigs().ok, false, 'invalid Project Rig stays explicit and disabled');

const rigModel = new TimelineModel({
    fps: 12,
    totalFrames: 12,
    clipAssets: [rigAsset.serialize()],
    tracks: [{ id: 'lane-rig', name: 'Rig Lane', cels: [rigClip.serialize()] }]
});
const rigRoundTrip = new TimelineModel(rigModel.serialize());
assert.deepEqual(rigRoundTrip.serialize(), rigModel.serialize(), 'Rig TimelineModel round-trip');
assert.equal(rigRoundTrip.validatePartRigs().ok, true, 'Project-load Rig validation result');

const historyBefore = rigModel.serialize();
rigModel.getClipById(rigClip.id).rigMotion.partTracks[0].keyframes[1].x = 12;
const historyAfter = rigModel.serialize();
const historyUndoModel = new TimelineModel(historyBefore);
const historyRedoModel = new TimelineModel(historyAfter);
assert.equal(
    historyUndoModel.getClipById(rigClip.id).rigMotion.partTracks[0].keyframes[1].x,
    8,
    'timeline History undo state retains Rig key'
);
assert.equal(
    historyRedoModel.getClipById(rigClip.id).rigMotion.partTracks[0].keyframes[1].x,
    12,
    'timeline History redo state retains Rig key'
);
rigModel.getClipById(rigClip.id).rigMotion = rigMotion;

const rigDuplicate = rigModel.duplicateClipAsset(rigAsset.id);
assert.equal(rigDuplicate.ok, true, 'duplicate Rig ClipAsset');
assert.ok(rigDuplicate.internalLayerIdMap instanceof Map, 'duplicate exposes shared internal Layer id map');
const duplicatedRigPartIds = rigDuplicate.asset.rigDefinition.parts.map(part => part.partId);
assert.ok(duplicatedRigPartIds.every(partId => !rigDefinition.parts.some(part => part.partId === partId)), 'Part ids remapped');
assert.equal(
    rigDuplicate.asset.rigDefinition.parts[1].parentPartId,
    rigDuplicate.asset.rigDefinition.parts[0].partId,
    'rig parent remapped independently from display parent'
);
const remappedMotion = remapRigMotion(rigClip.rigMotion, rigDuplicate.internalLayerIdMap);
assert.equal(validateRigMotion(remappedMotion, rigDuplicate.asset.rigDefinition, rigClip.duration).ok, true, 'CAF copy motion uses asset id map');

const internalLayerCount = rigAsset.internalLayers.length;
assert.equal(
    rigModel.duplicateClipAssetInternalLayer(rigAsset.id, 'folder-front').reason,
    'rig-part-subtree-unsupported',
    'Part subtree duplicate is explicitly blocked'
);
assert.equal(
    rigModel.removeClipAssetInternalLayer(rigAsset.id, 'line-layer').reason,
    'rig-part-subtree-unsupported',
    'Part layer delete is explicitly blocked'
);
assert.equal(rigAsset.internalLayers.length, internalLayerCount, 'blocked operations do not mutate asset');

const frozenRig = sampleClipBakeState(rigClip, 7);
assert.equal(frozenRig.rigMotion.partTracks.length, 2, 'Bake retains Part tracks');
frozenRig.rigMotion.partTracks.forEach(track => {
    assert.equal(track.keyframes.length, 1, 'Bake emits one Part key');
    assert.equal(track.keyframes[0].frame, 0, 'Bake Part key is Frame 0');
    assert.equal(track.keyframes[0].interpolation, 'hold', 'Bake Part key is HOLD');
});

console.log('verify-part-rig-core: legacy optional shape, validation, shared ID remap, round-trip, 2-level stateless FK, Bake OK');
