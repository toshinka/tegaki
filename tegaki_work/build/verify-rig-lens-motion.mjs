import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRasterSkinRenderPlan } from '../system/animation/raster-skin-render-plan.js';
import {
    evaluateRigidBones,
    getRigBoneKeyAtFrame,
    resolveBoneRootHandleDrag,
    resolveBoneRotationHandleDrag,
    upsertRigBoneKey
} from '../system/animation/part-rig.js';
import { invertTransformMatrixPoint } from '../system/transform-math.js';

globalThis.window = globalThis.window || {};
const { TimelineModel } = await import('../system/animation/animation-data-model.js');
const { HistoryManager } = await import('../system/history.js');
const { historyManager } = await import('../system/history.js');
const { ProjectManager } = await import('../system/project-manager.js');
const { AnimationTablePopup } = await import('../ui/animation-table-popup.js');
const { RightWorkspaceFrame } = await import('../ui/right-workspace-frame.js');

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
const translatedTransform = resolveBoneRootHandleDrag({
    startTransform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
    startPointer: { x: 4, y: 7 }, currentPointer: { x: 9, y: 3 }
});
assert.deepEqual({ x: translatedTransform.x, y: translatedTransform.y }, { x: 5, y: -4 });
const baseBoneEvaluation = evaluateRigidBones(asset, clip, 0);
const translatedRootMotion = upsertRigBoneKey(clip.rigMotion, 'root', 0, translatedTransform);
assert.equal(translatedRootMotion.ok, true);
const translatedBoneEvaluation = evaluateRigidBones(
    asset, { ...clip, rigMotion: translatedRootMotion.value }, 0
);
for (const boneId of ['root', 'child']) {
    const baseMatrix = baseBoneEvaluation.poseByBoneId.get(boneId).worldMatrix;
    const movedMatrix = translatedBoneEvaluation.poseByBoneId.get(boneId).worldMatrix;
    assert.equal(movedMatrix.tx - baseMatrix.tx, translatedTransform.x,
        `${boneId} consumes persisted Bone Motion x translation`);
    assert.equal(movedMatrix.ty - baseMatrix.ty, translatedTransform.y,
        `${boneId} consumes persisted Bone Motion y translation`);
}
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
const workspaceStyles = fs.readFileSync(
    path.join(root, '../styles/components/layer-panel-surface.css'), 'utf8'
);
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
    /draft\?\.poses\?\.size && !this\._matchesRigLensBonePoseDraft[\s\S]*?return \{ ok: false, reason: '未確定Poseがあります/u,
    'a stale Bone preview blocks Motion readiness without being discarded');
assert.doesNotMatch(motionTargetSource, /_rigLensBonePoseDraft = null/u,
    'Motion target resolution does not silently clear a pending preview');
assert.match(popup.slice(motionScreenStart, motionScreenEnd),
    /_rigLensBonePoseDraft[\s\S]*?return \[\]/u,
    'stale screen projection hides handles while preserving the pending Pose');
assert.doesNotMatch(popup.slice(motionScreenStart, motionScreenEnd), /cancelRigLensBonePosePreview\(\)/u,
    'Canvas overlay projection does not cancel a pending Pose');
assert.match(popup, /commitRigLensBoneKey[\s\S]*?setClipRigMotion[\s\S]*?caf-rig-lens-bone-frame-key[\s\S]*?_finishMotionGestureHistory/u,
    'DEFORM Bone drafts use one validated Frame-level rigMotion commit');
assert.match(popup, /restoreRigLensBonePoseDraft[\s\S]*?draft\.poses\.delete\(boneId\)/u,
    'gesture cancellation removes only the current Bone draft');
assert.match(frame, /commitRigLensBoneKey\?\.[\s\S]*?commitRigLensPartPoseFrame\?\./u,
    'PointerUp commits the active DEFORM Bone or PART gesture through its existing owner');
assert.match(frame, /this\.rigKeyButton\.hidden = !isMotion \|\| !boneDraftMatches/u,
    'ordinary Motion no longer presents a separate post-gesture KEY action');
assert.match(frame,
    /frameKeyState: isMotion && motionTarget\?\.ok[\s\S]*?showFrameKeyDelete: isMotion && !!motionTarget\?\.key && !boneDraftMatches/u,
    'DEFORM Motion projects current selected-Bone KEY state and only offers deletion for an existing KEY');
assert.match(frame,
    /this\.rigFrameKeyState\.textContent = frameKeyState\?\.exists \? '◆' : ''/u,
    'Frame row uses only the KEY diamond and omits empty-state text');
assert.match(frame, /rigFrameKeyState\.hidden = !frameKeyState\?\.exists \|\| !keepFrameNumberWithKey/u,
    'KEY indicator is absent when the current Bone has no Frame KEY');
assert.match(frame,
    /this\.rigFrameKeyState\.classList\.toggle\('is-keyed', !!frameKeyState\?\.exists\)/u,
    'the KEY indicator styling tracks only an existing Frame KEY');
assert.match(frame,
    /this\.rigFrameKeyDeleteButton\.addEventListener\('click', \(\) => this\._deleteRigLensBoneKey\(\)\)/u,
    'the Frame row delete action is a separate explicit control');
assert.match(popup,
    /deleteRigLensBoneKey\(assetId, layerId, boneId\)[\s\S]*?if \(!target\.key\)[\s\S]*?removeClipRigBoneKey\([\s\S]*?'caf-bone-key-delete'/u,
    'selected-Bone deletion is KEY-only and uses the existing Timeline deletion History contract');
assert.match(frame, /_startRigPoseGesture[\s\S]*?resolveBoneRotationHandleDrag/u);
assert.match(frame,
    /projectRigLensBoneMotionLocalPoint\?\.[\s\S]*?resolveBoneRootHandleDrag/u,
    'Bone Move maps Canvas pointers into the current parent-local frame and reuses x/y Motion');
assert.match(frame,
    /const selectedBoneMotion = boneMotion[\s\S]*?if \(!selectedBoneMotion\)[\s\S]*?right-workspace-rig-motion-handle--rotate[\s\S]*?data-rig-operation', 'move'/u,
    'only the selected DEFORM Bone receives separate Move and Rotate affordances');
assert.match(frame, /right-workspace-rig-bone-motion-joint/u,
    'DEFORM Motion retains circular joints without treating them as Move/Rotate handles');
assert.match(workspaceStyles,
    /\.right-workspace-rig-rotate-arc,\s*\.right-workspace-rig-move-cue\s*\{[^}]*stroke-linejoin: round[^}]*pointer-events: none/su,
    'Motion manipulation cues are quiet stroked SVG paths that never own input');
assert.match(workspaceStyles,
    /\.right-workspace-rig-rotate-hit\s*\{[^}]*stroke: transparent[^}]*pointer-events: stroke/su,
    'visual cues stay small while invisible hit geometry stays grabbable');
assert.doesNotMatch(frame, /right-workspace-rig-motion-handle-hit/u,
    'Motion no longer draws detached circular Move / Rotate buttons');
assert.match(frame, /cue\.classList\.add\('right-workspace-rig-move-cue'\)/u,
    'Move is a crosshair cue on the Bone origin');
assert.match(frame, /arc\.setAttribute\('d', `\$\{svgArcPath\(bone\.head\.x, bone\.head\.y, radius, from, to\)\}/u,
    'Rotate is an arc centred on the Bone pivot');
assert.match(workspaceStyles,
    /\.right-workspace-rig-frame-key-state[\s\S]*?pointer-events: none/u,
    'the KEY diamond is a non-interactive status indicator');
assert.match(frame, /rigKeyButton\.addEventListener\('click', \(\) => this\._commitRigPose\(\)\)/u);
const boneSelectionStart = frame.indexOf('_selectRigLensBone(boneId)');
const boneSelectionEnd = frame.indexOf('\n    _selectRigLensPart(', boneSelectionStart);
assert.ok(boneSelectionStart >= 0 && boneSelectionEnd > boneSelectionStart);
assert.doesNotMatch(frame.slice(boneSelectionStart, boneSelectionEnd), /_requireRigPoseResolution/u,
    'Bone selection does not require committing or cancelling another Bone draft');
const poseGestureStart = frame.indexOf('_startRigPoseGesture(bone, event, operation =');
const poseGestureEnd = frame.indexOf('\n    _startRigPartPoseGesture(', poseGestureStart);
assert.ok(poseGestureStart >= 0 && poseGestureEnd > poseGestureStart);
assert.doesNotMatch(frame.slice(poseGestureStart, poseGestureEnd), /_requireRigPoseResolution/u,
    'Canvas Bone switching retains same-frame draft editing');
assert.match(frame, /restoreRigLensBonePoseDraft\?\./u);
assert.match(frame, /_getRigReturnDestination\(\)[\s\S]*?canStartTransformEditSession/u);
assert.match(frame, /_requireRigPoseResolution\(\)[\s\S]*?hasRigLensBonePosePreview/u);
assert.doesNotMatch(frame, /rigLayerEntryButton|right-workspace-rig-layer-entry/u,
    'ordinary Layer-side RIG entry uses the top-level RIG lens instead of a duplicate CTA');
assert.match(frame, /event\.key\?\.toLowerCase\(\) === 'v'[\s\S]*?hasRigLensBonePosePreview/u);

historyManager.clear();
model.playback.currentFrame = 3;
const autoPopup = Object.create(AnimationTablePopup.prototype);
Object.assign(autoPopup, {
    model,
    selectedCelId: 'clip',
    selectedCelIds: new Set(['clip']),
    selectedInternalLayerId: 'raster',
    selectedAssetId: 'asset',
    selectedAssetFolderId: null,
    activeLaneId: 'lane',
    includedLaneIds: new Set(),
    playbackScope: 'all',
    isLaneOnlySelected: false,
    isPlaying: false,
    _rigLensPartPoseDraft: null,
    _rigLensBonePoseDraft: null,
    _animationPreviewKey: null
});
autoPopup._scheduleMotionEditPreviewRefresh = () => {};
autoPopup._cancelMotionEditPreviewRefresh = () => {};
autoPopup._applyVisibilityPreview = () => {};
autoPopup._invalidateSnapshotTextureCache = () => {};
autoPopup._flushLayerPanelSync = () => {};
autoPopup._scheduleLaneReferencePreviewUpdate = () => {};
autoPopup._activateClipEntry = () => {};
autoPopup._syncWorkingLayersForCurrentFrame = () => {};
autoPopup.render = () => {};
const createPointerWorkspace = gesture => {
    const workspace = Object.create(RightWorkspaceFrame.prototype);
    Object.assign(workspace, {
        rigLensActive: true,
        rigLensMode: 'motion',
        rigAuthoringKind: 'deform',
        rigPlacementMode: null,
        rigPointerGesture: gesture,
        rigEntryMessage: '',
        _getRigLensTable: () => autoPopup,
        sync() {}
    });
    return workspace;
};
const originalCoreEngine = window.coreEngine;
window.coreEngine = { getApp: () => ({ canvas: { releasePointerCapture() {} } }) };
const finishBoneGesture = (boneId, transform, pointerId) => {
    assert.equal(autoPopup.previewRigLensBonePose('asset', 'raster', boneId, transform).ok, true);
    const workspace = createPointerWorkspace({
        kind: 'pose', pointerId, assetId: 'asset', layerId: 'raster', boneId,
        beforePreview: null, moved: true
    });
    const event = { pointerId, preventDefault() {}, stopImmediatePropagation() {} };
    workspace._onRigCanvasUp(event);
    assert.equal(autoPopup.hasRigLensBonePosePreview(), false,
        'a completed Bone pointer gesture leaves no ordinary runtime draft');
};
const autoRootTarget = autoPopup.getRigLensMotionTarget('asset', 'raster', 'root');
const autoRootPose = { ...autoRootTarget.sampled, x: autoRootTarget.sampled.x + 2 };
finishBoneGesture('root', autoRootPose, 701);
assert.equal(historyManager.stack.length, 1, 'one Bone gesture records one Timeline History operation');
assert.ok(getRigBoneKeyAtFrame(model.findClipEntry('clip').clip.rigMotion, 'root', 3));
const autoChildTarget = autoPopup.getRigLensMotionTarget('asset', 'raster', 'child');
const autoChildPose = { ...autoChildTarget.sampled, rotation: autoChildTarget.sampled.rotation + 0.17 };
finishBoneGesture('child', autoChildPose, 702);
assert.equal(historyManager.stack.length, 2, 'the next Bone gesture is a separate Undo operation');
assert.deepEqual(historyManager.stack.map(item => item.name), [
    'caf-rig-lens-bone-frame-key', 'caf-rig-lens-bone-frame-key'
]);
assert.ok(getRigBoneKeyAtFrame(model.findClipEntry('clip').clip.rigMotion, 'root', 3),
    'editing a second Bone preserves the first Bone KEY at the same Frame');
assert.ok(getRigBoneKeyAtFrame(model.findClipEntry('clip').clip.rigMotion, 'child', 3));
historyManager.undo();
assert.equal(getRigBoneKeyAtFrame(model.findClipEntry('clip').clip.rigMotion, 'child', 3), null);
assert.ok(getRigBoneKeyAtFrame(model.findClipEntry('clip').clip.rigMotion, 'root', 3));
historyManager.undo();
assert.equal(getRigBoneKeyAtFrame(model.findClipEntry('clip').clip.rigMotion, 'root', 3), null);
historyManager.redo();
historyManager.redo();
assert.ok(getRigBoneKeyAtFrame(model.findClipEntry('clip').clip.rigMotion, 'root', 3));
assert.ok(getRigBoneKeyAtFrame(model.findClipEntry('clip').clip.rigMotion, 'child', 3));

const rootKeyBeforeMove = getRigBoneKeyAtFrame(
    model.findClipEntry('clip').clip.rigMotion, 'root', 3
);
const moveTarget = autoPopup.getRigLensMotionTarget('asset', 'raster', 'root');
const moveStartTransform = { ...moveTarget.sampled };
autoPopup.projectRigLensBoneMotionLocalPoint = () => ({ x: 7, y: -3 });
const moveWorkspace = createPointerWorkspace({
    kind: 'pose', operation: 'move', pointerId: 705, assetId: 'asset',
    layerId: 'raster', boneId: 'root', startPointer: { x: 0, y: 0 },
    startTransform: moveStartTransform, beforePreview: null,
    startClientX: 10, startClientY: 10, moved: false
});
const moveResultingTransform = resolveBoneRootHandleDrag({
    startTransform: moveStartTransform,
    startPointer: { x: 0, y: 0 },
    currentPointer: { x: 7, y: -3 }
});
moveWorkspace._onRigCanvasMove({
    pointerId: 705, clientX: 20, clientY: 16,
    preventDefault() {}, stopImmediatePropagation() {}
});
assert.deepEqual(
    autoPopup.getRigLensMotionTarget('asset', 'raster', 'root').preview.transform,
    moveResultingTransform,
    'Move updates only the runtime Bone Pose draft before pointer-up'
);
moveWorkspace._onRigCanvasUp({
    pointerId: 705, preventDefault() {}, stopImmediatePropagation() {}
});
const movedRootKey = getRigBoneKeyAtFrame(
    model.findClipEntry('clip').clip.rigMotion, 'root', 3
);
assert.deepEqual({ x: movedRootKey.x, y: movedRootKey.y }, {
    x: moveResultingTransform.x, y: moveResultingTransform.y
});
assert.equal(historyManager.stack.length, 3,
    'one completed Move gesture auto-commits one KEY and one History operation');
const translatedRevisit = new TimelineModel(model.serialize());
assert.deepEqual({
    x: getRigBoneKeyAtFrame(translatedRevisit.findClipEntry('clip').clip.rigMotion, 'root', 3).x,
    y: getRigBoneKeyAtFrame(translatedRevisit.findClipEntry('clip').clip.rigMotion, 'root', 3).y
}, { x: movedRootKey.x, y: movedRootKey.y },
'Bone Motion translation survives project-model serialization and revisit');
historyManager.undo();
assert.deepEqual(
    getRigBoneKeyAtFrame(model.findClipEntry('clip').clip.rigMotion, 'root', 3),
    rootKeyBeforeMove,
    'one Undo restores the immediately preceding KEY after one Move gesture'
);
historyManager.redo();
assert.deepEqual(
    getRigBoneKeyAtFrame(model.findClipEntry('clip').clip.rigMotion, 'root', 3),
    movedRootKey
);

const deletionHistoryRecords = [];
const deletePopup = Object.create(AnimationTablePopup.prototype);
Object.assign(deletePopup, {
    model,
    selectedCelId: 'clip',
    selectedInternalLayerId: 'raster',
    isPlaying: false,
    _rigLensBonePoseDraft: null,
    _captureTimelineHistoryState: () => model.serialize(),
    _recordTimelineHistory: (beforeState, afterState, name, meta) => {
        deletionHistoryRecords.push({ beforeState, afterState, name, meta });
        AnimationTablePopup.prototype._recordTimelineHistory.call(
            deletePopup, beforeState, afterState, name, meta
        );
    },
    _estimateTimelineHistoryTransitionBytes: () => 1,
    _getTimelineHistoryStateStats: () => ({ snapshots: 0, snapshotPixelBytes: 0 }),
    _restoreTimelineHistoryState: state => model.setClipRigMotion(
        'clip', state.tracks[0].cels[0].rigMotion
    ),
    _invalidateSnapshotTextureCache() {},
    render() {},
    _flushLayerPanelSync() {},
    _scheduleLaneReferencePreviewUpdate() {}
});
deletePopup._rigLensBonePoseDraft = {
    assetId: 'asset', layerId: 'raster', clipId: 'clip', frame: 3, localFrame: 3,
    poses: new Map([['root', { boneId: 'root', transform: { x: 1, y: 1 } }]])
};
assert.equal(deletePopup.deleteRigLensBoneKey('asset', 'raster', 'root').ok, false,
    'KEY deletion waits for an existing matching Pose draft to be resolved');
assert.equal(deletionHistoryRecords.length, 0);
deletePopup._rigLensBonePoseDraft = null;
const rootFrameTwoKey = getRigBoneKeyAtFrame(model.findClipEntry('clip').clip.rigMotion, 'root', 2);
const deletedRootKey = deletePopup.deleteRigLensBoneKey('asset', 'raster', 'root');
assert.equal(deletedRootKey.ok, true);
assert.equal(getRigBoneKeyAtFrame(model.findClipEntry('clip').clip.rigMotion, 'root', 3), null);
assert.deepEqual(getRigBoneKeyAtFrame(model.findClipEntry('clip').clip.rigMotion, 'root', 2), rootFrameTwoKey,
    'the adjacent Frame KEY is untouched');
assert.ok(getRigBoneKeyAtFrame(model.findClipEntry('clip').clip.rigMotion, 'child', 3),
    'the other Bone KEY at the same Frame is untouched');
assert.equal(deletionHistoryRecords.length, 1, 'one KEY deletion creates one History record');
assert.equal(deletionHistoryRecords[0].name, 'caf-bone-key-delete');
assert.deepEqual({
    type: deletionHistoryRecords[0].meta.type,
    clipId: deletionHistoryRecords[0].meta.clipId,
    boneId: deletionHistoryRecords[0].meta.boneId,
    localFrame: deletionHistoryRecords[0].meta.localFrame
}, { type: 'caf-bone-key-delete', clipId: 'clip', boneId: 'root', localFrame: 3 });
assert.equal(historyManager.stack.length, 4);
historyManager.undo();
assert.ok(getRigBoneKeyAtFrame(model.findClipEntry('clip').clip.rigMotion, 'root', 3),
    'Timeline Undo restores the deleted current-Frame KEY');
historyManager.redo();
assert.equal(getRigBoneKeyAtFrame(model.findClipEntry('clip').clip.rigMotion, 'root', 3), null,
    'Timeline Redo reapplies the same current-Frame KEY deletion');
assert.equal(deletePopup.deleteRigLensBoneKey('asset', 'raster', 'root').ok, false,
    'the delete-only action cannot add a KEY when the current Frame has none');
assert.equal(deletionHistoryRecords.length, 1);

const cancelBefore = model.serialize();
const cancelTarget = autoPopup.getRigLensMotionTarget('asset', 'raster', 'root');
assert.equal(autoPopup.previewRigLensBonePose('asset', 'raster', 'root', {
    ...cancelTarget.sampled, x: cancelTarget.sampled.x + 5
}).ok, true);
const cancelWorkspace = createPointerWorkspace({
    kind: 'pose', pointerId: 703, assetId: 'asset', layerId: 'raster', boneId: 'root',
    beforePreview: null, moved: true
});
cancelWorkspace._onRigCanvasCancel({
    pointerId: 703, preventDefault() {}, stopImmediatePropagation() {}
});
assert.deepEqual(model.serialize(), cancelBefore, 'pointercancel restores only the active preview gesture');
assert.equal(historyManager.stack.length, 4, 'a canceled gesture adds no History operation');
assert.equal(autoPopup.hasRigLensBonePosePreview(), false);
const blurTarget = autoPopup.getRigLensMotionTarget('asset', 'raster', 'root');
assert.equal(autoPopup.previewRigLensBonePose('asset', 'raster', 'root', {
    ...blurTarget.sampled, y: blurTarget.sampled.y + 4
}).ok, true);
const blurWorkspace = createPointerWorkspace({
    kind: 'pose', pointerId: 704, assetId: 'asset', layerId: 'raster', boneId: 'root',
    beforePreview: null, moved: true
});
blurWorkspace._onRigWindowBlur();
assert.equal(autoPopup.hasRigLensBonePosePreview(), false, 'window blur cancels the in-flight gesture preview');
assert.equal(historyManager.stack.length, 4, 'window blur does not create History');
const escapeTarget = autoPopup.getRigLensMotionTarget('asset', 'raster', 'root');
assert.equal(autoPopup.previewRigLensBonePose('asset', 'raster', 'root', {
    ...escapeTarget.sampled, x: escapeTarget.sampled.x + 1
}).ok, true);
const escapeWorkspace = createPointerWorkspace({
    kind: 'pose', operation: 'move', pointerId: 706, assetId: 'asset',
    layerId: 'raster', boneId: 'root', beforePreview: null, moved: true
});
escapeWorkspace._cancelRigPlacement();
assert.equal(autoPopup.hasRigLensBonePosePreview(), false,
    'the existing Escape cancellation owner restores the in-flight Move preview');
assert.equal(historyManager.stack.length, 4, 'Escape cancellation does not create History');
window.coreEngine = originalCoreEngine;

model.playback.currentFrame = 2;
const batchHistoryRecords = [];
const batchPopup = Object.create(AnimationTablePopup.prototype);
Object.assign(batchPopup, {
    model,
    selectedCelId: 'clip',
    selectedInternalLayerId: 'raster',
    isPlaying: false,
    _rigLensPartPoseDraft: null,
    _rigLensBonePoseDraft: null,
    _animationPreviewKey: null,
    _captureTimelineHistoryState: () => model.serialize(),
    _recordTimelineHistory: (beforeState, afterState, name, meta) => {
        batchHistoryRecords.push({ beforeState, afterState, name, meta });
    },
    _scheduleMotionEditPreviewRefresh() {},
    _cancelMotionEditPreviewRefresh() {},
    _applyVisibilityPreview() {},
    _invalidateSnapshotTextureCache() {},
    render() {},
    _flushLayerPanelSync() {},
    _scheduleLaneReferencePreviewUpdate() {}
});
const batchAsset = model.getClipAsset('asset');
const batchClip = model.findClipEntry('clip').clip;
const rootMotionTarget = batchPopup.getRigLensMotionTarget('asset', 'raster', 'root');
const childMotionTarget = batchPopup.getRigLensMotionTarget('asset', 'raster', 'child');
assert.equal(rootMotionTarget.ok, true, rootMotionTarget.reason);
assert.equal(childMotionTarget.ok, true, childMotionTarget.reason);
const frameTwoBefore = JSON.parse(JSON.stringify(batchClip.rigMotion));
const frameTwoBeforeEvaluation = evaluateRigidBones(batchAsset, batchClip, 2);
const rootPose = { ...rootMotionTarget.sampled, x: rootMotionTarget.sampled.x + 2 };
const childPose = { ...childMotionTarget.sampled, rotation: childMotionTarget.sampled.rotation + 0.35 };
assert.equal(batchPopup.previewRigLensBonePose('asset', 'raster', 'root', rootPose).ok, true);
const switchedBoneTarget = batchPopup.getRigLensMotionTarget('asset', 'raster', 'child');
assert.equal(switchedBoneTarget.ok, true, 'switching Bone keeps a same-frame draft editable');
assert.equal(switchedBoneTarget.preview, null, 'the selected Bone has no preview until it is edited');
assert.deepEqual(batchPopup.getRigLensBonePoseDraftSummary('asset', 'raster')?.boneIds, ['root']);
assert.equal(batchPopup.previewRigLensBonePose('asset', 'raster', 'child', childPose).ok, true);
assert.equal(batchPopup.getRigLensBonePoseDraftSummary('asset', 'raster')?.count, 2);
assert.deepEqual(batchClip.rigMotion, frameTwoBefore, 'runtime draft does not mutate saved KEY data');
const frameTwoPreviewClip = batchPopup._getRigLensPreviewClip(batchClip, 2);
assert.ok(getRigBoneKeyAtFrame(frameTwoPreviewClip.rigMotion, 'root', 2));
assert.ok(getRigBoneKeyAtFrame(frameTwoPreviewClip.rigMotion, 'child', 2));
const rootOnlyMotion = upsertRigBoneKey(batchClip.rigMotion, 'root', 2, rootPose).value;
const rootOnlyEvaluation = evaluateRigidBones(batchAsset, { ...batchClip, rigMotion: rootOnlyMotion }, 2);
const fullDraftEvaluation = evaluateRigidBones(batchAsset, frameTwoPreviewClip, 2);
batchPopup._screenToRigProject = () => ({ x: 21, y: -7 });
const childMoveLocalPoint = batchPopup.projectRigLensBoneMotionLocalPoint(
    'asset', 'raster', 'child', {}
);
assert.deepEqual(childMoveLocalPoint, invertTransformMatrixPoint(
    fullDraftEvaluation.poseByBoneId.get('root').worldMatrix, 21, -7
), 'child Move coordinates invert the parent matrix including its current runtime preview');
delete batchPopup._screenToRigProject;
assert.notDeepEqual(
    frameTwoBeforeEvaluation.poseByBoneId.get('child').worldMatrix,
    rootOnlyEvaluation.poseByBoneId.get('child').worldMatrix,
    'parent Bone draft continues to move its child through the existing evaluator'
);
assert.notDeepEqual(
    rootOnlyEvaluation.poseByBoneId.get('child').worldMatrix,
    fullDraftEvaluation.poseByBoneId.get('child').worldMatrix,
    'the child Bone draft is composed with the parent preview'
);
const draftPlan = createRasterSkinRenderPlan(batchAsset, frameTwoPreviewClip, 2);
assert.equal(draftPlan.status, 'ready');
assert.notDeepEqual(draftPlan.meshResults[0].vertices,
    createRasterSkinRenderPlan(batchAsset, batchClip, 2).meshResults[0].vertices);
const frameTwoKeyResult = batchPopup.commitRigLensBoneKey('asset', 'raster', 'child');
assert.equal(frameTwoKeyResult.ok, true, frameTwoKeyResult.reason);
assert.equal(frameTwoKeyResult.changedBoneCount, 2);
assert.equal(batchHistoryRecords.length, 1, 'the frame batch records exactly one History boundary');
assert.equal(batchHistoryRecords[0].name, 'caf-rig-lens-bone-frame-key');
assert.ok(getRigBoneKeyAtFrame(batchClip.rigMotion, 'root', 2));
assert.ok(getRigBoneKeyAtFrame(batchClip.rigMotion, 'child', 2));
assert.equal(batchPopup.hasRigLensBonePosePreview(), false);

model.playback.currentFrame = 3;
const frameThreeSavedMotion = JSON.stringify(batchClip.rigMotion);
const rootAtThree = batchPopup.getRigLensMotionTarget('asset', 'raster', 'root');
const childAtThree = batchPopup.getRigLensMotionTarget('asset', 'raster', 'child');
const firstChildDraft = { ...childAtThree.sampled, rotation: childAtThree.sampled.rotation + 0.1 };
assert.equal(batchPopup.previewRigLensBonePose('asset', 'raster', 'root', {
    ...rootAtThree.sampled, y: rootAtThree.sampled.y + 1
}).ok, true);
assert.equal(batchPopup.previewRigLensBonePose('asset', 'raster', 'child', firstChildDraft).ok, true);
assert.equal(batchPopup.previewRigLensBonePose('asset', 'raster', 'child', {
    ...firstChildDraft, rotation: firstChildDraft.rotation + 0.2
}).ok, true);
assert.equal(batchPopup.restoreRigLensBonePoseDraft(
    'asset', 'raster', 'child', firstChildDraft
), true);
assert.deepEqual(batchPopup.getRigLensMotionTarget('asset', 'raster', 'child').preview.transform,
    firstChildDraft, 'pointer cancellation restores only this Bone to its prior draft');
assert.equal(batchPopup.restoreRigLensBonePoseDraft('asset', 'raster', 'child', null), true);
assert.deepEqual(batchPopup.getRigLensBonePoseDraftSummary('asset', 'raster')?.boneIds, ['root'],
    'discarding one gesture leaves the other Bone draft intact');
const historyBeforeFrameCancel = batchHistoryRecords.length;
assert.equal(batchPopup.cancelRigLensBonePosePreview(), true);
assert.equal(JSON.stringify(batchClip.rigMotion), frameThreeSavedMotion,
    'Frame Pose cancel preserves all previously saved KEYs');
assert.equal(batchHistoryRecords.length, historyBeforeFrameCancel,
    'preview and cancel do not create History');

assert.equal(batchPopup.previewRigLensBonePose('asset', 'raster', 'root', {
    ...rootAtThree.sampled, x: rootAtThree.sampled.x + 1
}).ok, true);
batchPopup._rigLensBonePoseDraft.poses.set('missing-bone', {
    boneId: 'missing-bone',
    transform: { x: 1, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
    interpolation: 'linear'
});
const invalidBatchBefore = JSON.stringify(batchClip.rigMotion);
const invalidBatchHistoryCount = batchHistoryRecords.length;
const invalidBatch = batchPopup.commitRigLensBoneKey('asset', 'raster', 'root');
assert.equal(invalidBatch.ok, false, 'an invalid Bone prevents the whole batch from committing');
assert.equal(JSON.stringify(batchClip.rigMotion), invalidBatchBefore,
    'invalid batch leaves no partial KEY writes');
assert.equal(batchHistoryRecords.length, invalidBatchHistoryCount);
assert.equal(batchPopup.hasRigLensBonePosePreview(), true, 'failed batch remains available for explicit recovery');
assert.equal(batchPopup.cancelRigLensBonePosePreview(), true);

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
console.log('PASS: RIG Lens Pose isolation, Frame KEY state/deletion, auto-key, Project round-trip, safe exit routing');
