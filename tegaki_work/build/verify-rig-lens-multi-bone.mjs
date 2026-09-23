import assert from 'node:assert/strict';
import { inspectStaticRigAuthoringTarget, planStaticRigBone } from '../system/animation/rig-static-authoring.js';
import { evaluateRigidBones, getRigBoneKeyAtFrame, upsertRigBoneKey } from '../system/animation/part-rig.js';
import { createRasterSkinRenderPlan } from '../system/animation/raster-skin-render-plan.js';

globalThis.window = globalThis.window || {};
const { TimelineModel, ClipAssetModel } = await import('../system/animation/animation-data-model.js');
const { HistoryManager } = await import('../system/history.js');
const { ProjectManager } = await import('../system/project-manager.js');

const width = 32;
const height = 16;
const pixels = new Uint8ClampedArray(width * height * 4);
for (let y = 4; y < 12; y++) for (let x = 2; x < 30; x++) pixels[(y * width + x) * 4 + 3] = 255;
const model = new TimelineModel({
    totalFrames: 4,
    drawingSnapshots: [{ id: 'snap', width, height, pixels,
        rasterBounds: { x: 0, y: 0, width, height } }],
    clipAssets: [{ id: 'asset', internalLayers: [{
        id: 'raster', type: 'raster', drawingSnapshotId: 'snap'
    }] }],
    tracks: [{ id: 'lane', cels: [{ id: 'clip', assetId: 'asset', startFrame: 0, duration: 4 }] }]
});
let asset = model.getClipAsset('asset');
const clip = model.findClipEntry('clip').clip;
const history = new HistoryManager();
const restore = state => { asset = new ClipAssetModel(state); model.clipAssets[0] = asset; };
const create = (boneId, gesture) => {
    const before = asset.serialize();
    const plan = planStaticRigBone(asset, 'raster', gesture);
    assert.equal(plan.ok, true, plan.reason);
    const result = model.registerClipAssetRasterBone('asset', 'raster', { ...plan.options, boneId });
    assert.equal(result.ok, true, result.reason);
    const after = asset.serialize();
    history.record({ name: `bone-${boneId}`, do: () => restore(after), undo: () => restore(before) });
    return plan;
};

create('root', { kind: 'root', start: { x: 4, y: 8 }, end: { x: 11, y: 8 } });
create('child1', { kind: 'child', parentBoneId: 'root', end: { x: 18, y: 8 } });
assert.equal(planStaticRigBone(asset, 'raster', { kind: 'child', end: { x: 25, y: 8 } }).ok, false,
    'third Bone requires an explicit selected parent');
assert.equal(planStaticRigBone(asset, 'raster', {
    kind: 'child', parentBoneId: 'missing', end: { x: 25, y: 8 }
}).ok, false);
assert.equal(planStaticRigBone(asset, 'raster', {
    kind: 'child', parentBoneId: 'child1', end: { x: 18, y: 8 }
}).ok, false, 'zero-length child is rejected');
create('child2', { kind: 'child', parentBoneId: 'child1', end: { x: 25, y: 8 } });
assert.deepEqual(asset.rigDefinition.bones.map(bone => [bone.boneId, bone.parentBoneId]),
    [['root', null], ['child1', 'root'], ['child2', 'child1']]);
assert.equal(inspectStaticRigAuthoringTarget(asset, 'raster').ok, true);
assert.equal(planStaticRigBone(asset, 'raster', {
    kind: 'child', parentBoneId: 'child2', end: { x: 29, y: 8 }
}).ok, false, 'fourth Bone is outside this lens');
assert.equal(clip.rigMotion, null, 'static authoring creates no Frame-local KEY');
assert.equal(asset.meshDefinitions?.length || 0, 0);
assert.equal(asset.skinBindings?.length || 0, 0);

history.undo();
assert.deepEqual(model.getClipAsset('asset').rigDefinition.bones.map(bone => bone.boneId),
    ['root', 'child1']);
history.redo();
assert.deepEqual(model.getClipAsset('asset').rigDefinition.bones.map(bone => bone.boneId),
    ['root', 'child1', 'child2']);
assert.equal(history.stack.length, 3, 'each creation has one History boundary');

const beforeBinding = asset.serialize();
const generated = model.generateClipAssetRasterBoneSetup('asset', 'raster', {
    generatorMode: 'alpha-fit-grid'
});
assert.equal(generated.ok, true, generated.reason);
assert.equal(asset.meshDefinitions.length, 1);
assert.equal(asset.skinBindings.length, 1);
const boundIds = new Set(asset.skinBindings[0].vertexWeights.flatMap(row =>
    row.influences.map(influence => influence.boneId)));
assert.deepEqual(boundIds, new Set(['root', 'child1', 'child2']));
assert.equal(inspectStaticRigAuthoringTarget(asset, 'raster').ok, false,
    'existing Binding still locks static additions');
assert.equal(inspectStaticRigAuthoringTarget(asset, 'raster', { allowBound: true }).ok, true);
const boundState = asset.serialize();
history.record({ name: 'binding', do: () => restore(boundState), undo: () => restore(beforeBinding) });
history.undo();
assert.equal(model.getClipAsset('asset').skinBindings?.length || 0, 0);
history.redo();
assert.equal(model.getClipAsset('asset').skinBindings.length, 1);

const basePose = evaluateRigidBones(asset, clip, 0);
assert.equal(basePose.ok, true);
const baseSkin = createRasterSkinRenderPlan(asset, clip, 0);
assert.equal(baseSkin.status, 'ready');
const child1Pose = { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0.35 };
const child2Pose = { ...child1Pose, rotation: -0.4 };
const preview = upsertRigBoneKey(clip.rigMotion, 'child1', 0, child1Pose);
assert.equal(preview.ok, true);
const previewClip = { ...clip, rigMotion: preview.value };
assert.notDeepEqual(evaluateRigidBones(asset, previewClip, 0).poseByBoneId.get('child2').worldMatrix,
    basePose.poseByBoneId.get('child2').worldMatrix, 'parent Pose carries child2');
assert.equal(clip.rigMotion, null, 'preview does not save KEY');
assert.equal(model.setClipRigBoneKey('clip', 'child1', 0, child1Pose).ok, true);
assert.equal(model.setClipRigBoneKey('clip', 'child2', 0, child2Pose).ok, true);
assert.equal(model.setClipRigBoneKey('clip', 'child1', 1, { ...child1Pose, rotation: -0.2 }).ok, true);
assert.equal(model.setClipRigBoneKey('clip', 'child2', 1, { ...child2Pose, rotation: 0.55 }).ok, true);
assert.ok(getRigBoneKeyAtFrame(clip.rigMotion, 'child1', 0));
assert.ok(getRigBoneKeyAtFrame(clip.rigMotion, 'child2', 1));
const frame0 = createRasterSkinRenderPlan(asset, clip, 0);
const frame1 = createRasterSkinRenderPlan(asset, clip, 1);
assert.equal(frame0.status, 'ready');
assert.equal(frame1.status, 'ready');
assert.notDeepEqual(frame0.meshResults[0].vertices, frame1.meshResults[0].vertices);
assert.deepEqual(asset.serialize(), boundState, 'Motion KEY leaves Bind/Mesh/Skin unchanged');

const project = Object.create(ProjectManager.prototype);
const serialized = await project._serializeAnimationForProject(model);
const reloaded = new TimelineModel(JSON.parse(JSON.stringify(serialized)));
const reloadedAsset = reloaded.getClipAsset('asset');
const reloadedClip = reloaded.findClipEntry('clip').clip;
assert.deepEqual(reloadedAsset.rigDefinition.bones.map(bone => [
    bone.boneId, bone.parentBoneId, bone.bindTransform
]), asset.rigDefinition.bones.map(bone => [bone.boneId, bone.parentBoneId, bone.bindTransform]));
assert.equal(reloadedAsset.skinBindings.length, 1);
for (const boneId of ['child1', 'child2']) for (const frame of [0, 1]) {
    assert.deepEqual(getRigBoneKeyAtFrame(reloadedClip.rigMotion, boneId, frame),
        getRigBoneKeyAtFrame(clip.rigMotion, boneId, frame));
}
assert.equal(createRasterSkinRenderPlan(reloadedAsset, reloadedClip, 1).status, 'ready');
console.log('PASS: 3-Bone hierarchy, selected parent, AUTO GRID, parent following, F1/F2 KEY, History and Project encoding');
