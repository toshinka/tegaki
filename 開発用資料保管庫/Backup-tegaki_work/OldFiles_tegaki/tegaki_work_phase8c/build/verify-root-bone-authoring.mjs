import assert from 'node:assert/strict';
import {
    getRigBoneKeyAtFrame,
    resolveBoneRootHandleDrag,
    resolveBoneRotationHandleDrag,
    validateRigDefinition,
    validateRigMotion
} from '../system/animation/part-rig.js';

globalThis.window = {};
const { ClipAssetModel, TimelineModel } = await import('../system/animation/animation-data-model.js');

const model = new TimelineModel({ fps: 8, totalFrames: 8 });
const folder = model.createClipAssetInternalLayer({ id: 'arm-folder', name: 'Arm', type: 'folder' });
const raster = model.createClipAssetInternalLayer({
    id: 'arm-raster',
    name: 'Paint',
    type: 'raster',
    parentLayerId: folder.id
});
const asset = new ClipAssetModel({
    id: 'root-bone-authoring-asset',
    name: 'Root Bone authoring fixture',
    internalLayers: [folder, raster]
});
model.clipAssets.push(asset);
const lane = model.createIndependentLane({ name: 'Bone Lane' });
const clip = lane.addCel({
    id: 'root-bone-authoring-clip',
    assetId: asset.id,
    startFrame: 1,
    duration: 5
});

assert.equal(model.registerClipAssetFolderPart(asset.id, folder.id, { maxParts: 1 }).ok, true);
const registered = model.registerClipAssetRootBoneBinding(asset.id, folder.id, {
    boneId: 'bone-root',
    name: 'Root',
    bindTransform: { x: 80, y: 90, scaleX: 1, scaleY: 1, rotation: 0, pivotX: 0, pivotY: 0 },
    length: 64
});
assert.equal(registered.ok, true);
assert.equal(registered.changed, true);
assert.equal(registered.bone.boneId, 'bone-root');
assert.deepEqual(registered.binding, { boneId: 'bone-root', partId: folder.id });
assert.equal(validateRigDefinition(asset.rigDefinition, asset.internalLayers).ok, true);

const duplicate = model.registerClipAssetRootBoneBinding(asset.id, folder.id, { boneId: 'ignored' });
assert.equal(duplicate.ok, true);
assert.equal(duplicate.changed, false);
assert.equal(asset.rigDefinition.bones.length, 1);
assert.equal(asset.rigDefinition.rigidBindings.length, 1);

const handFolder = model.createClipAssetInternalLayer({ id: 'hand-folder', name: 'Hand', type: 'folder' });
const handRaster = model.createClipAssetInternalLayer({
    id: 'hand-raster',
    name: 'Hand Paint',
    type: 'raster',
    parentLayerId: handFolder.id
});
asset.internalLayers.push(handFolder, handRaster);
assert.equal(model.registerClipAssetFolderPart(asset.id, handFolder.id).ok, true);
const handRegistered = model.registerClipAssetRootBoneBinding(asset.id, handFolder.id, {
    boneId: 'bone-hand',
    name: 'Hand',
    bindTransform: { x: 140, y: 90, scaleX: 1, scaleY: 1, rotation: -Math.PI / 2, pivotX: 0, pivotY: 0 },
    length: 40
});
assert.equal(handRegistered.ok, true, 'second root PIVOT binding registers');
assert.equal(asset.rigDefinition.bones.length, 2);
assert.equal(asset.rigDefinition.rigidBindings.length, 2);
const bindUpdate = model.setClipAssetRigBoneBindTransform(asset.id, 'bone-hand', {
    x: 152,
    y: 96,
    rotation: -Math.PI / 3
});
assert.equal(bindUpdate.ok, true);
assert.equal(bindUpdate.bone.bindTransform.x, 152);
assert.equal(bindUpdate.bone.bindTransform.y, 96);
assert.equal(bindUpdate.bone.bindTransform.rotation, -Math.PI / 3);

const added = model.setClipRigBoneKey(clip.id, 'bone-root', 2, {
    x: 0,
    y: 0,
    scaleX: 1,
    scaleY: 1,
    rotation: Math.PI / 4
}, { interpolation: 'linear' });
assert.equal(added.ok, true);
assert.equal(getRigBoneKeyAtFrame(clip.rigMotion, 'bone-root', 2).rotation, Math.PI / 4);
assert.equal(validateRigMotion(clip.rigMotion, asset.rigDefinition, clip.duration).ok, true);
assert.equal(model.setClipRigBoneKey(clip.id, 'bone-root', 5, {}, {}).reason, 'bone-key-out-of-range');

assert.equal(model.setClipRigPartKey(clip.id, folder.id, 1, {
    x: 4, y: 5, scaleX: 1, scaleY: 1, rotation: 0
}).ok, true);
assert.equal(model.removeClipRigBoneKey(clip.id, 'bone-root', 2).ok, true);
assert.equal(clip.rigMotion.partTracks.length, 1, 'removing final Bone key preserves Part tracks');
assert.equal(Array.isArray(clip.rigMotion.boneTracks), true);
assert.equal(clip.rigMotion.boneTracks.length, 0);

assert.equal(model.setClipRigBoneKey(clip.id, 'bone-root', 3, {
    x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: -0.5
}).ok, true);
assert.equal(model.removeClipRigPartKey(clip.id, folder.id, 1).ok, true);
assert.equal(clip.rigMotion.boneTracks.length, 1, 'removing final Part key preserves Bone tracks');
assert.equal(clip.rigMotion.partTracks.length, 0);

const roundTrip = new TimelineModel(model.serialize());
const roundTripAsset = roundTrip.getClipAsset(asset.id);
const roundTripClip = roundTrip.findClipEntry(clip.id).clip;
assert.equal(validateRigDefinition(roundTripAsset.rigDefinition, roundTripAsset.internalLayers).ok, true);
assert.equal(validateRigMotion(roundTripClip.rigMotion, roundTripAsset.rigDefinition, roundTripClip.duration).ok, true);
assert.equal(getRigBoneKeyAtFrame(roundTripClip.rigMotion, 'bone-root', 3).rotation, -0.5);
assert.equal(roundTripAsset.rigDefinition.bones.length, 2, 'multiple PIVOT Bind Setup round-trips');
assert.equal(
    roundTripAsset.rigDefinition.bones.find(bone => bone.boneId === 'bone-hand').bindTransform.x,
    152
);

const rotated = resolveBoneRotationHandleDrag({
    startTransform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0.25 },
    root: { x: 10, y: 20 },
    startAngle: 0,
    currentPointer: { x: 10, y: 40 }
});
assert.ok(Math.abs(rotated.rotation - (0.25 + Math.PI / 2)) < 1e-9);
const wrapped = resolveBoneRotationHandleDrag({
    startTransform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
    root: { x: 0, y: 0 },
    startAngle: Math.PI - 0.1,
    currentPointer: { x: -1, y: -0.1 }
});
assert.ok(Math.abs(wrapped.rotation) < 0.25, 'angle delta wraps across -PI / PI');

const movedRoot = resolveBoneRootHandleDrag({
    startTransform: { x: 3, y: -4, scaleX: 1, scaleY: 1, rotation: 0.25 },
    startPointer: { x: 100, y: 120 },
    currentPointer: { x: 112, y: 113 }
});
assert.equal(movedRoot.x, 15);
assert.equal(movedRoot.y, -11);
assert.equal(movedRoot.rotation, 0.25, 'root drag preserves rotation');

console.log('verify-root-bone-authoring: root Bone + binding registration, key add/remove, mixed-track preservation, move/rotation handles, round-trip OK');
