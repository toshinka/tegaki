import assert from 'node:assert/strict';
import {
    removeRigDefinitionTargets,
    removeRigMotionTargets,
    validateRigDefinition
} from '../system/animation/part-rig.js';

const identity = { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, pivotX: 0, pivotY: 0 };
const definition = {
    version: 1,
    parts: [
        { partId: 'layer-a', parentPartId: null, bindTransform: identity },
        { partId: 'layer-b', parentPartId: null, bindTransform: identity }
    ],
    bones: [
        { boneId: 'bone-a', parentBoneId: null, bindTransform: identity, length: 32 },
        { boneId: 'bone-b', parentBoneId: null, bindTransform: identity, length: 32 }
    ],
    rigidBindings: [
        { boneId: 'bone-a', partId: 'layer-a' },
        { boneId: 'bone-b', partId: 'layer-b' }
    ],
    warpAnchorConstraints: [
        { sourceFolderLayerId: 'layer-a', targetBoneId: 'bone-b' }
    ]
};

const removed = removeRigDefinitionTargets(definition, { partIds: ['layer-a'] });
assert.equal(removed.ok, true);
assert.deepEqual(removed.partIds, ['layer-a']);
assert.deepEqual(removed.boneIds, ['bone-a']);
assert.deepEqual(removed.value.parts.map(part => part.partId), ['layer-b']);
assert.deepEqual(removed.value.bones.map(bone => bone.boneId), ['bone-b']);
assert.deepEqual(removed.value.rigidBindings, [{ boneId: 'bone-b', partId: 'layer-b' }]);
assert.deepEqual(removed.value.warpAnchorConstraints, []);
assert.equal(validateRigDefinition(removed.value, [
    { id: 'layer-b', type: 'raster', parentLayerId: null }
]).ok, true);

const motion = removeRigMotionTargets({
    version: 1,
    partTracks: [
        { partId: 'layer-a', keyframes: [{ frame: 0, transform: identity }] },
        { partId: 'layer-b', keyframes: [{ frame: 0, transform: identity }] }
    ],
    boneTracks: [
        { boneId: 'bone-a', keyframes: [{ frame: 0, transform: identity }] },
        { boneId: 'bone-b', keyframes: [{ frame: 0, transform: identity }] }
    ]
}, removed);
assert.deepEqual(motion.partTracks.map(track => track.partId), ['layer-b']);
assert.deepEqual(motion.boneTracks.map(track => track.boneId), ['bone-b']);

const externalChild = removeRigDefinitionTargets({
    ...definition,
    bones: [
        ...definition.bones,
        { boneId: 'bone-child', parentBoneId: 'bone-a', bindTransform: identity, length: 20 }
    ]
}, { partIds: ['layer-a'] });
assert.equal(externalChild.ok, false);
assert.equal(externalChild.reason, 'rig-bone-external-child');
assert.deepEqual(externalChild.externalChildBoneIds, ['bone-child']);

const externalPartChild = removeRigDefinitionTargets({
    ...definition,
    parts: [
        ...definition.parts,
        { partId: 'layer-child', parentPartId: 'layer-a', bindTransform: identity }
    ]
}, { partIds: ['layer-a'] });
assert.equal(externalPartChild.ok, false);
assert.equal(externalPartChild.reason, 'rig-part-external-child');
assert.deepEqual(externalPartChild.externalChildPartIds, ['layer-child']);

assert.deepEqual(removeRigDefinitionTargets(null), {
    ok: true,
    changed: false,
    value: null,
    partIds: [],
    boneIds: []
});

globalThis.window = globalThis.window || {};
const { ClipAssetModel, TimelineModel } = await import('../system/animation/animation-data-model.js');
const model = new TimelineModel({ fps: 8, totalFrames: 8 });
const asset = new ClipAssetModel({
    id: 'cascade-asset',
    internalLayers: [
        { id: 'raster-a', name: 'A', type: 'raster' },
        { id: 'raster-b', name: 'B', type: 'raster' }
    ]
});
model.clipAssets.push(asset);
const lane = model.createIndependentLane({ name: 'Cascade' });
const clip = lane.addCel({ id: 'cascade-clip', assetId: asset.id, startFrame: 0, duration: 4 });
for (const [partId, boneId, x] of [['raster-a', 'bone-raster-a', 20], ['raster-b', 'bone-raster-b', 60]]) {
    assert.equal(model.registerClipAssetRigPart(asset.id, partId).ok, true);
    assert.equal(model.registerClipAssetRootBoneBinding(asset.id, partId, {
        boneId,
        bindTransform: { ...identity, x },
        length: 24
    }).ok, true);
    assert.equal(model.setClipRigBoneKey(clip.id, boneId, 1, { ...identity, rotation: 0.25 }).ok, true);
}
const cascade = model.removeClipAssetInternalLayer(asset.id, 'raster-a', {
    removeRigDependencies: true
});
assert.equal(cascade.ok, true);
assert.deepEqual(cascade.removedRigPartIds, ['raster-a']);
assert.deepEqual(cascade.removedRigBoneIds, ['bone-raster-a']);
assert.deepEqual(asset.rigDefinition.parts.map(part => part.partId), ['raster-b']);
assert.deepEqual(asset.rigDefinition.bones.map(bone => bone.boneId), ['bone-raster-b']);
assert.deepEqual(clip.rigMotion.boneTracks.map(track => track.boneId), ['bone-raster-b']);
assert.equal(validateRigDefinition(asset.rigDefinition, asset.internalLayers).ok, true);

console.log('verify-rig-target-removal: explicit cascade, motion cleanup and external-child refusal OK');
