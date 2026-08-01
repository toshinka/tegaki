import assert from 'node:assert/strict';

import {
    evaluateRigidBones,
    normalizeRigDefinition,
    normalizeRigMotion,
    remapRigDefinition,
    remapRigMotion,
    sampleRigMotionForBake,
    validateRigDefinition,
    validateRigMotion
} from '../system/animation/part-rig.js';
globalThis.window = globalThis.window || {};

const {
    ClipAssetModel,
    ClipInstanceModel,
    TimelineModel
} = await import('../system/animation/animation-data-model.js');

const close = (actual, expected, label) => {
    assert.ok(Math.abs(actual - expected) < 1e-8, `${label}: ${actual} !== ${expected}`);
};

const legacyDefinition = normalizeRigDefinition({ version: 1, parts: [] });
const legacyMotion = normalizeRigMotion({ version: 1, partTracks: [] });
assert.equal(Object.hasOwn(legacyDefinition, 'bones'), false, 'legacy RigDefinition shape has no bones');
assert.equal(Object.hasOwn(legacyDefinition, 'rigidBindings'), false, 'legacy RigDefinition shape has no rigidBindings');
assert.equal(Object.hasOwn(legacyMotion, 'boneTracks'), false, 'legacy RigMotion shape has no boneTracks');

const internalLayers = [
    { id: 'folder-root', type: 'folder' },
    { id: 'layer-body', type: 'raster', parentLayerId: 'folder-root' }
];
const rigDefinition = {
    version: 1,
    parts: [{
        partId: 'folder-root',
        parentPartId: null,
        bindTransform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, pivotX: 0, pivotY: 0 }
    }],
    bones: [
        {
            boneId: 'bone-root',
            parentBoneId: null,
            bindTransform: { x: 10, y: 0, scaleX: 1, scaleY: 1, rotation: 0, pivotX: 0, pivotY: 0 },
            length: 5
        },
        {
            boneId: 'bone-child',
            parentBoneId: 'bone-root',
            bindTransform: { x: 5, y: 0, scaleX: 1, scaleY: 1, rotation: 0, pivotX: 0, pivotY: 0 },
            length: 4
        },
        {
            boneId: 'bone-tip',
            parentBoneId: 'bone-child',
            bindTransform: { x: 4, y: 0, scaleX: 1, scaleY: 1, rotation: 0, pivotX: 0, pivotY: 0 },
            length: 2
        }
    ],
    rigidBindings: [{ boneId: 'bone-root', partId: 'folder-root' }]
};
const rigMotion = {
    version: 1,
    partTracks: [],
    boneTracks: [
        {
            boneId: 'bone-root',
            keyframes: [
                { frame: 0, interpolation: 'linear', x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
                { frame: 4, interpolation: 'hold', x: 8, y: 0, scaleX: 1, scaleY: 1, rotation: 0 }
            ]
        },
        {
            boneId: 'bone-child',
            keyframes: [
                { frame: 0, interpolation: 'linear', x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
                { frame: 4, interpolation: 'hold', x: 0, y: 4, scaleX: 1, scaleY: 1, rotation: 0 }
            ]
        }
    ]
};

assert.equal(validateRigDefinition(rigDefinition, internalLayers).ok, true, 'valid Bone definition');
assert.equal(validateRigMotion(rigMotion, rigDefinition, 5).ok, true, 'valid Bone motion');

const asset = new ClipAssetModel({
    id: 'asset-bone',
    name: 'Bone CAF',
    internalLayers,
    rigDefinition
});
const clip = new ClipInstanceModel({
    id: 'clip-bone',
    assetId: asset.id,
    startFrame: 5,
    duration: 5,
    rigMotion
});
const frame7 = evaluateRigidBones(asset, clip, 7);
assert.equal(frame7.ok, true, '3-level Bone FK evaluates');
assert.deepEqual(frame7.orderedPoses.map(pose => pose.boneId), ['bone-root', 'bone-child', 'bone-tip']);
close(frame7.poseByBoneId.get('bone-root').worldMatrix.tx, 14, 'root sampled x');
close(frame7.poseByBoneId.get('bone-child').worldMatrix.tx, 19, 'child inherits root x');
close(frame7.poseByBoneId.get('bone-child').worldMatrix.ty, 2, 'child sampled y');
close(frame7.poseByBoneId.get('bone-tip').worldMatrix.tx, 23, 'grandchild inherits chain x');
close(frame7.poseByBoneId.get('bone-tip').worldMatrix.ty, 2, 'grandchild inherits chain y');

let randomSeekFrame7 = null;
[5, 9, 6, 8, 7].forEach(frame => {
    const pose = evaluateRigidBones(asset, clip, frame);
    if (frame === 7) randomSeekFrame7 = pose.poseByBoneId.get('bone-tip').worldMatrix;
});
assert.deepEqual(randomSeekFrame7, frame7.poseByBoneId.get('bone-tip').worldMatrix, 'Bone FK is stateless');

const invalidDefinitionCodes = new Set(validateRigDefinition({
    version: 1,
    parts: rigDefinition.parts,
    bones: [
        rigDefinition.bones[0],
        { ...rigDefinition.bones[0] },
        {
            boneId: 'folder-root',
            parentBoneId: 'missing-bone',
            bindTransform: { x: Infinity, y: 0, scaleX: 1, scaleY: 1, rotation: 0, pivotX: 0, pivotY: 0 },
            length: -1
        }
    ]
}, internalLayers).errors.map(error => error.code));
assert.ok(invalidDefinitionCodes.has('duplicate-bone-id'), 'duplicate Bone rejected');
assert.ok(invalidDefinitionCodes.has('bone-id-collision'), 'Bone/internal Layer id collision rejected');
assert.ok(invalidDefinitionCodes.has('dangling-parent-bone-id'), 'dangling Bone parent rejected');
assert.ok(invalidDefinitionCodes.has('non-finite-transform'), 'non-finite Bone bind rejected');
assert.ok(invalidDefinitionCodes.has('invalid-bone-length'), 'negative Bone length rejected');
const invalidBindingCodes = new Set(validateRigDefinition({
    ...rigDefinition,
    rigidBindings: [
        { boneId: 'missing-bone', partId: 'folder-root' },
        { boneId: 'bone-root', partId: 'missing-part' },
        { boneId: 'bone-root', partId: 'folder-root' }
    ]
}, internalLayers).errors.map(error => error.code));
assert.ok(invalidBindingCodes.has('dangling-binding-bone-id'), 'dangling binding Bone rejected');
assert.ok(invalidBindingCodes.has('dangling-binding-part-id'), 'dangling binding Part rejected');
assert.ok(invalidBindingCodes.has('duplicate-bone-binding'), 'duplicate Bone binding rejected');
assert.ok(invalidBindingCodes.has('duplicate-part-binding'), 'duplicate Part binding rejected');

const cycleDefinition = {
    ...rigDefinition,
    bones: rigDefinition.bones.map(bone => ({
        ...bone,
        parentBoneId: bone.boneId === 'bone-root' ? 'bone-tip' : bone.parentBoneId
    }))
};
assert.ok(
    validateRigDefinition(cycleDefinition, internalLayers).errors.some(error => error.code === 'bone-cycle'),
    'Bone cycle rejected'
);

const invalidMotionCodes = new Set(validateRigMotion({
    version: 1,
    partTracks: [],
    boneTracks: [
        { boneId: 'bone-child', keyframes: [{ frame: 5, x: Number.NaN }] },
        { boneId: 'missing-bone', keyframes: [] },
        { boneId: 'bone-child', keyframes: [] }
    ]
}, rigDefinition, 5).errors.map(error => error.code));
assert.ok(invalidMotionCodes.has('bone-key-out-of-range'), 'out-of-duration Bone key rejected');
assert.ok(invalidMotionCodes.has('non-finite-bone-key'), 'non-finite Bone key rejected');
assert.ok(invalidMotionCodes.has('dangling-track-bone-id'), 'dangling Bone track rejected');
assert.ok(invalidMotionCodes.has('duplicate-bone-track'), 'duplicate Bone track rejected');

const rigIdMap = new Map([
    ['folder-root', 'folder-copy'],
    ['bone-root', 'bone-root-copy'],
    ['bone-child', 'bone-child-copy'],
    ['bone-tip', 'bone-tip-copy']
]);
const remappedDefinition = remapRigDefinition(rigDefinition, rigIdMap);
const remappedMotion = remapRigMotion(rigMotion, rigIdMap);
assert.equal(remappedDefinition.parts[0].partId, 'folder-copy', 'Part uses shared Rig id map');
assert.equal(remappedDefinition.bones[1].parentBoneId, 'bone-root-copy', 'Bone parent uses shared Rig id map');
assert.deepEqual(
    remappedDefinition.rigidBindings[0],
    { boneId: 'bone-root-copy', partId: 'folder-copy' },
    'rigid binding uses shared Rig id map'
);
assert.equal(remappedMotion.boneTracks[0].boneId, 'bone-root-copy', 'Bone track uses shared Rig id map');

const model = new TimelineModel({
    fps: 12,
    totalFrames: 12,
    clipAssets: [asset.serialize()],
    tracks: [{ id: 'lane-bone', cels: [clip.serialize()] }]
});
const groupedRigMove = normalizeRigMotion(model.findClipEntry('clip-bone').clip.rigMotion);
groupedRigMove.boneTracks = groupedRigMove.boneTracks.map(track => ({
    ...track,
    keyframes: track.keyframes.map(key => key.frame === 0 ? { ...key, frame: 1 } : key)
}));
assert.equal(
    model.setClipRigMotion('clip-bone', groupedRigMove).ok,
    true,
    'validated whole Rig Motion accepts same-delta multi-track KEY move'
);
assert.deepEqual(
    model.findClipEntry('clip-bone').clip.rigMotion.boneTracks.map(track => track.keyframes.map(key => key.frame)),
    [[1, 4], [1, 4]],
    'same-delta multi-track KEY move keeps each Bone track ordered'
);
assert.deepEqual(new TimelineModel(model.serialize()).serialize(), model.serialize(), 'Bone Project round-trip');
assert.equal(model.validatePartRigs().ok, true, 'Project validation includes Bone schema');
const duplicate = model.duplicateClipAsset(asset.id);
assert.equal(duplicate.ok, true, 'Bone asset duplicate');
assert.ok(duplicate.rigIdMap instanceof Map, 'asset duplicate exposes shared Rig id map');
assert.ok(duplicate.asset.rigDefinition.bones.every(bone => !rigDefinition.bones.some(source => source.boneId === bone.boneId)), 'Bone ids remapped');
const duplicatedMotion = remapRigMotion(rigMotion, duplicate.rigIdMap);
assert.equal(validateRigMotion(duplicatedMotion, duplicate.asset.rigDefinition, clip.duration).ok, true, 'CAF copy Bone motion validates');

const frozen = sampleRigMotionForBake(clip, 7);
assert.equal(frozen.boneTracks.length, 2, 'Bake retains Bone tracks');
frozen.boneTracks.forEach(track => {
    assert.equal(track.keyframes.length, 1, 'Bake emits one Bone key');
    assert.equal(track.keyframes[0].frame, 0, 'Bake Bone key is Frame 0');
    assert.equal(track.keyframes[0].interpolation, 'hold', 'Bake Bone key is HOLD');
});

console.log('verify-bone-rig-core: optional shape, validation, shared Rig ID remap, round-trip, 3-level stateless FK, Bake OK');
