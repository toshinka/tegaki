import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRasterSkinRenderPlan } from '../system/animation/raster-skin-render-plan.js';
import { getRigBoneKeyAtFrame, resolveBoneRotationHandleDrag, upsertRigBoneKey } from '../system/animation/part-rig.js';

globalThis.window = globalThis.window || {};
const { TimelineModel } = await import('../system/animation/animation-data-model.js');
const { HistoryManager } = await import('../system/history.js');
const { ProjectManager } = await import('../system/project-manager.js');

const width = 16;
const height = 8;
const pixels = new Uint8ClampedArray(width * height * 4);
for (let y = 1; y < 7; y++) for (let x = 2; x < 14; x++) pixels[(y * width + x) * 4 + 3] = 255;
const model = new TimelineModel({
    totalFrames: 4,
    drawingSnapshots: [{ id: 'snap', width, height, pixels,
        rasterBounds: { x: 0, y: 0, width, height } }],
    clipAssets: [{ id: 'asset', internalLayers: [{ id: 'raster', type: 'raster', drawingSnapshotId: 'snap' }] }],
    tracks: [{ id: 'lane', cels: [{ id: 'clip', assetId: 'asset', startFrame: 0, duration: 4 }] }]
});
assert.equal(model.registerClipAssetRasterBone('asset', 'raster', {
    boneId: 'root', name: 'Root', parentBoneId: null, length: 6,
    bindTransform: { x: 2, y: 4, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 }
}).ok, true);
assert.equal(model.registerClipAssetRasterBone('asset', 'raster', {
    boneId: 'child', name: 'Child', parentBoneId: 'root', length: 5,
    bindTransform: { x: 6, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 }
}).ok, true);
assert.equal(model.generateClipAssetRasterBoneSetup('asset', 'raster', {
    generatorMode: 'alpha-fit-grid'
}).ok, true);
const asset = model.getClipAsset('asset');
const clip = model.findClipEntry('clip').clip;
const bindState = asset.serialize();
const before = model.serialize();
const basePlan = createRasterSkinRenderPlan(asset, clip, 0);
assert.equal(basePlan.status, 'ready');
const transform = resolveBoneRotationHandleDrag({
    startTransform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
    root: { x: 8, y: 4 }, startAngle: 0, currentPointer: { x: 9, y: 9 }
});
assert.ok(transform.rotation > 0);
const candidate = upsertRigBoneKey(clip.rigMotion, 'child', 0, transform);
assert.equal(candidate.ok, true);
const previewClip = { ...clip, rigMotion: candidate.value };
const previewPlan = createRasterSkinRenderPlan(asset, previewClip, 0);
assert.equal(previewPlan.status, 'ready');
assert.notDeepEqual(previewPlan.meshResults[0].vertices, basePlan.meshResults[0].vertices);
assert.equal(clip.rigMotion, null, 'candidate is not a KEY in canonical Clip');
assert.deepEqual(asset.serialize(), bindState, 'Pose does not change Bind, Mesh or Skin');
assert.deepEqual(model.serialize(), before, 'preview does not change save state');

const history = new HistoryManager();
const committed = model.setClipRigBoneKey('clip', 'child', 0, transform);
assert.equal(committed.ok, true);
const after = model.serialize();
assert.ok(getRigBoneKeyAtFrame(clip.rigMotion, 'child', 0));
history.record({ name: 'caf-rig-lens-bone-key',
    do: () => { model.findClipEntry('clip').clip.rigMotion = after.tracks[0].cels[0].rigMotion; },
    undo: () => { model.findClipEntry('clip').clip.rigMotion = before.tracks[0].cels[0].rigMotion; }
});
history.undo();
assert.equal(getRigBoneKeyAtFrame(clip.rigMotion, 'child', 0), null);
history.redo();
assert.ok(getRigBoneKeyAtFrame(clip.rigMotion, 'child', 0));
const revisited = new TimelineModel(model.serialize());
assert.equal(revisited.getClipAsset('asset').rigDefinition.bones[1].parentBoneId, 'root');
assert.equal(revisited.getClipAsset('asset').skinBindings.length, 1);
assert.ok(getRigBoneKeyAtFrame(revisited.findClipEntry('clip').clip.rigMotion, 'child', 0));
assert.equal(createRasterSkinRenderPlan(revisited.getClipAsset('asset'),
    revisited.findClipEntry('clip').clip, 0).status, 'ready');
assert.equal(getRigBoneKeyAtFrame(revisited.findClipEntry('clip').clip.rigMotion, 'child', 1), null);
assert.equal(model.setClipRigBoneKey('clip', 'missing', 0, transform).ok, false);

const secondTransform = { ...transform, rotation: -0.6 };
assert.equal(model.setClipRigBoneKey('clip', 'child', 1, secondTransform).ok, true);
const projectManager = Object.create(ProjectManager.prototype);
const projectAnimation = await projectManager._serializeAnimationForProject(model);
const reloaded = new TimelineModel(JSON.parse(JSON.stringify(projectAnimation)));
const reloadedAsset = reloaded.getClipAsset('asset');
const reloadedClip = reloaded.findClipEntry('clip').clip;
assert.equal(reloadedAsset.id, asset.id);
assert.equal(reloadedAsset.internalLayers[0].id, 'raster');
assert.deepEqual(reloadedAsset.rigDefinition.bones.map(bone => ({
    id: bone.boneId, parentId: bone.parentBoneId, bind: bone.bindTransform
})), asset.rigDefinition.bones.map(bone => ({
    id: bone.boneId, parentId: bone.parentBoneId, bind: bone.bindTransform
})));
assert.deepEqual(reloadedAsset.meshDefinitions.map(mesh => mesh.meshId),
    asset.meshDefinitions.map(mesh => mesh.meshId));
assert.deepEqual(reloadedAsset.skinBindings.map(binding => binding.meshId),
    asset.skinBindings.map(binding => binding.meshId));
assert.deepEqual(getRigBoneKeyAtFrame(reloadedClip.rigMotion, 'child', 0),
    getRigBoneKeyAtFrame(clip.rigMotion, 'child', 0));
assert.deepEqual(getRigBoneKeyAtFrame(reloadedClip.rigMotion, 'child', 1),
    getRigBoneKeyAtFrame(clip.rigMotion, 'child', 1));
const frame0Plan = createRasterSkinRenderPlan(reloadedAsset, reloadedClip, 0);
const frame1Plan = createRasterSkinRenderPlan(reloadedAsset, reloadedClip, 1);
assert.equal(frame0Plan.status, 'ready');
assert.equal(frame1Plan.status, 'ready');
assert.notDeepEqual(frame0Plan.meshResults[0].vertices, frame1Plan.meshResults[0].vertices);

const root = path.dirname(fileURLToPath(import.meta.url));
const popup = fs.readFileSync(path.join(root, '../ui/animation-table-popup.js'), 'utf8');
const frame = fs.readFileSync(path.join(root, '../ui/right-workspace-frame.js'), 'utf8');
assert.match(popup, /_getRigLensPreviewClip[\s\S]*?upsertRigBoneKey/u);
assert.match(popup, /const previewCel = this\._getRigLensPreviewClip\(cel, frame\)[\s\S]*?createRasterSkinRenderPlan\(asset, previewCel/u);
const motionTargetStart = popup.indexOf('getRigLensMotionTarget(assetId, layerId, boneId)');
const motionTargetEnd = popup.indexOf('\n    _getRigLensPreviewClip(', motionTargetStart);
const motionScreenStart = popup.indexOf('getRigLensMotionScreenBones(assetId, layerId)');
const motionScreenEnd = popup.indexOf('registerRigLensStaticBone(assetId, layerId, gesture)', motionScreenStart);
assert.ok(motionTargetStart >= 0 && motionTargetEnd > motionTargetStart
    && motionScreenStart > motionTargetEnd && motionScreenEnd > motionScreenStart);
const motionTargetSource = popup.slice(motionTargetStart, motionTargetEnd);
assert.match(motionTargetSource,
    /preview && \([\s\S]*?return \{ ok: false, reason: '未確定Poseがあります/u,
    'a stale Bone preview blocks Motion readiness without being discarded');
assert.doesNotMatch(motionTargetSource, /_rigLensPosePreview = null/u,
    'Motion target resolution does not silently clear a pending preview');
assert.match(popup.slice(motionScreenStart, motionScreenEnd),
    /_rigLensPosePreview[\s\S]*?return \[\]/u,
    'stale screen projection hides handles while preserving the pending Pose');
assert.doesNotMatch(popup.slice(motionScreenStart, motionScreenEnd), /cancelRigLensBonePosePreview\(\)/u,
    'Canvas overlay projection does not cancel a pending Pose');
assert.match(popup, /commitRigLensBoneKey[\s\S]*?setClipRigBoneKey[\s\S]*?_finishMotionGestureHistory/u);
assert.match(frame, /_startRigPoseGesture[\s\S]*?resolveBoneRotationHandleDrag/u);
assert.match(frame, /rigKeyButton\.addEventListener\('click', \(\) => this\._commitRigPose\(\)\)/u);
assert.match(frame, /_getRigReturnDestination\(\)[\s\S]*?canStartTransformEditSession/u);
assert.match(frame, /_requireRigPoseResolution\(\)[\s\S]*?hasRigLensBonePosePreview/u);
assert.match(frame, /rigLayerEntryButton\.addEventListener\('click', this\._rigEntryClickHandler\)/u);
assert.match(frame, /event\.key\?\.toLowerCase\(\) === 'v'[\s\S]*?hasRigLensBonePosePreview/u);
if (process.argv[2]) {
    const exportedProject = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
    const loadedProject = new TimelineModel(exportedProject.animation);
    const boundAsset = loadedProject.clipAssets.find(item =>
        item.rigDefinition?.bones?.length === 2
        && item.meshDefinitions?.length === 1
        && item.skinBindings?.length === 1);
    assert.ok(boundAsset, 'real exported Project retains its bound Bone asset');
    const clipEntry = loadedProject.tracks.flatMap(track => track.cels)
        .find(item => item.assetId === boundAsset.id);
    assert.ok(clipEntry, 'real exported Project retains the target Clip');
    const childId = boundAsset.rigDefinition.bones.find(bone => bone.parentBoneId)?.boneId;
    assert.ok(getRigBoneKeyAtFrame(clipEntry.rigMotion, childId, 0));
    assert.ok(getRigBoneKeyAtFrame(clipEntry.rigMotion, childId, 1));
    const first = createRasterSkinRenderPlan(boundAsset, clipEntry, clipEntry.startFrame);
    const second = createRasterSkinRenderPlan(boundAsset, clipEntry, clipEntry.startFrame + 1);
    assert.equal(first.status, 'ready');
    assert.equal(second.status, 'ready');
    assert.notDeepEqual(first.meshResults[0].vertices, second.meshResults[0].vertices);
    console.log('PASS: R-05 exported Project JSON reloaded into TimelineModel with F1/F2 skin evaluation');
}
console.log('PASS: RIG Lens Pose isolation, explicit KEY, Project encoding round-trip, safe exit routing');
