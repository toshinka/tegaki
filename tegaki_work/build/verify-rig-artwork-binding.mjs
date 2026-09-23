import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspectStaticRigAuthoringTarget, planStaticRigBone } from '../system/animation/rig-static-authoring.js';
import { createRasterSkinRenderPlan } from '../system/animation/raster-skin-render-plan.js';

globalThis.window = globalThis.window || {};
const { TimelineModel, ClipAssetModel } = await import('../system/animation/animation-data-model.js');
const { HistoryManager } = await import('../system/history.js');

const width = 12;
const height = 6;
const pixels = new Uint8ClampedArray(width * height * 4);
for (let y = 1; y <= 4; y++) {
    for (let x = 2; x <= 9; x++) pixels[(y * width + x) * 4 + 3] = 255;
}
const snapshot = {
    id: 'snapshot', width, height,
    rasterBounds: { x: 0, y: 0, width, height }, pixels, updatedAt: 1
};
const model = new TimelineModel({
    totalFrames: 4,
    drawingSnapshots: [snapshot],
    clipAssets: [{
        id: 'asset',
        internalLayers: [{ id: 'raster', type: 'raster', name: 'Art', drawingSnapshotId: snapshot.id }]
    }],
    tracks: [{ id: 'lane', cels: [{ id: 'clip', assetId: 'asset', startFrame: 0, duration: 4 }] }]
});
const asset = model.getClipAsset('asset');
const clip = model.findClipEntry('clip').clip;
const rootPlan = planStaticRigBone(asset, 'raster', {
    kind: 'root', start: { x: 2, y: 3 }, end: { x: 6, y: 3 }
});
assert.equal(rootPlan.ok, true);
assert.equal(model.registerClipAssetRasterBone('asset', 'raster', {
    ...rootPlan.options, boneId: 'root'
}).ok, true);
const childPlan = planStaticRigBone(asset, 'raster', {
    kind: 'child', end: { x: 10, y: 3 }
});
assert.equal(childPlan.ok, true);
assert.equal(model.registerClipAssetRasterBone('asset', 'raster', {
    ...childPlan.options, boneId: 'child'
}).ok, true);
const beforeBinding = asset.serialize();
assert.equal(inspectStaticRigAuthoringTarget(asset, 'raster').ok, true);
assert.equal(asset.meshDefinitions?.length || 0, 0, 'Bone-only is not Artwork Binding');
assert.equal(asset.skinBindings?.length || 0, 0);
assert.equal(model.generateClipAssetRasterBoneSetup('asset', 'wrong').ok, false);
assert.deepEqual(asset.serialize(), beforeBinding, 'invalid target leaves Asset unchanged');

const generated = model.generateClipAssetRasterBoneSetup('asset', 'raster', {
    generatorMode: 'alpha-fit-grid'
});
assert.equal(generated.ok, true);
assert.equal(asset.meshDefinitions.length, 1);
assert.equal(asset.meshDefinitions[0].targetInternalLayerId, 'raster');
assert.equal(asset.skinBindings.length, 1);
assert.equal(asset.skinBindings[0].meshId, asset.meshDefinitions[0].meshId);
assert.deepEqual(new Set(asset.skinBindings[0].vertexWeights.flatMap(row =>
    row.influences.map(influence => influence.boneId))), new Set(['root', 'child']));
assert.equal(inspectStaticRigAuthoringTarget(asset, 'raster').ok, false,
    'bound Asset cannot be edited as an unbound Root gesture');
assert.equal(inspectStaticRigAuthoringTarget(asset, 'raster', { allowBound: true }).ok, true,
    'bound Asset still projects the same Root and child');
assert.equal(clip.rigMotion, null, 'Binding itself creates no Motion KEY');
assert.equal(clip.transformKeyframes?.length || 0, 0);

const bindPlan = createRasterSkinRenderPlan(asset, clip, 0);
assert.equal(bindPlan.status, 'ready');
const posedClip = {
    ...clip,
    rigMotion: {
        version: 1, partTracks: [],
        boneTracks: [{
            boneId: 'root',
            keyframes: [{
                frame: 0, interpolation: 'hold', x: 2, y: 0,
                scaleX: 1, scaleY: 1, rotation: 0
            }]
        }]
    }
};
const posedPlan = createRasterSkinRenderPlan(asset, posedClip, 0);
assert.equal(posedPlan.status, 'ready');
assert.notDeepEqual(posedPlan.meshResults[0].vertices, bindPlan.meshResults[0].vertices,
    'existing Bone Pose evaluation moves Mesh vertices');
assert.equal(clip.rigMotion, null, 'preview pose did not change saved Clip');

const afterBinding = asset.serialize();
const history = new HistoryManager();
const restore = state => { model.clipAssets[0] = new ClipAssetModel(state); };
history.record({
    name: 'caf-raster-bone-auto-grid',
    do: () => restore(afterBinding),
    undo: () => restore(beforeBinding)
});
history.undo();
assert.equal(model.getClipAsset('asset').meshDefinitions?.length || 0, 0);
assert.deepEqual(model.getClipAsset('asset').rigDefinition.bones.map(bone => bone.boneId), ['root', 'child']);
history.redo();
assert.equal(model.getClipAsset('asset').skinBindings.length, 1);
const revisited = new TimelineModel(model.serialize()).getClipAsset('asset');
assert.deepEqual(revisited.rigDefinition.bones.map(bone => bone.boneId), ['root', 'child']);
assert.equal(revisited.skinBindings[0].meshId, revisited.meshDefinitions[0].meshId);

const multiAsset = new ClipAssetModel({
    ...beforeBinding,
    id: 'multi',
    internalLayers: [
        ...beforeBinding.internalLayers,
        { id: 'other', type: 'raster', drawingSnapshotId: snapshot.id }
    ]
});
assert.equal(inspectStaticRigAuthoringTarget(multiAsset, 'raster').ok, false,
    'new RIG refuses ambiguous multi-Raster Bone ownership');
const multiModel = new TimelineModel({
    totalFrames: 4,
    drawingSnapshots: [snapshot],
    clipAssets: [multiAsset.serialize()],
    tracks: [{ id: 'multi-lane', cels: [{ id: 'multi-clip', assetId: 'multi', duration: 4 }] }]
});
const otherBinding = multiModel.generateClipAssetRasterBoneSetup('multi', 'other');
assert.equal(otherBinding.ok, true);
const targetBinding = multiModel.generateClipAssetRasterBoneSetup('multi', 'raster');
assert.equal(targetBinding.ok, true);
assert.equal(multiModel.getClipAsset('multi').meshDefinitions.length, 2);
assert.equal(multiModel.getClipAsset('multi').skinBindings.length, 2);
assert.ok(multiModel.getClipAsset('multi').meshDefinitions.some(mesh => mesh.meshId === otherBinding.meshDefinition.meshId),
    'existing model retains unrelated Raster Mesh');
assert.ok(multiModel.getClipAsset('multi').skinBindings.some(binding => binding.meshId === otherBinding.meshDefinition.meshId),
    'existing model retains unrelated Raster Skin Binding');

const popupSource = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '../ui/animation-table-popup.js'), 'utf8');
assert.match(popupSource, /generateRigLensArtworkBinding[\s\S]*?_generateRasterBoneSetupForTarget/u);
assert.match(popupSource, /_generateRasterBoneSetupForTarget[\s\S]*?generateClipAssetRasterBoneSetup[\s\S]*?_restoreInternalLayerHistoryState[\s\S]*?_recordInternalLayerHistory/u,
    'new and old UI use the same model, rollback, and CAF History boundary');
console.log('PASS: RIG Artwork Binding target, Mesh/Skin, Bone deformation, KEY isolation, History and round-trip');
