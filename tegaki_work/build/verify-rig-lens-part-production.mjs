import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRigPartRenderPlan } from '../system/animation/folder-part-render-plan.js';
import {
    evaluateRigidParts, getRigPartKeyAtFrame, resolvePartTransformHandleDrag,
    updateRigPartParent, upsertRigPartKey
} from '../system/animation/part-rig.js';
import { applyTransformMatrix } from '../system/transform-math.js';

globalThis.window = globalThis.window || {};
const { AnimationTablePopup } = await import('../ui/animation-table-popup.js');
const { TimelineModel } = await import('../system/animation/animation-data-model.js');
const { HistoryManager } = await import('../system/history.js');
const { ProjectManager } = await import('../system/project-manager.js');
const model = new TimelineModel({
    totalFrames: 3,
    clipAssets: [{ id: 'caf', name: 'Orbit', internalLayers: [
        { id: 'planet', name: '惑星', type: 'raster' },
        { id: 'moon', name: '衛星', type: 'raster' },
        { id: 'other', name: '無関係', type: 'raster' },
        { id: 'loose', name: '未登録', type: 'raster' }
    ] }],
    tracks: [{ id: 'lane', cels: [{ id: 'clip', assetId: 'caf', startFrame: 0, duration: 3 }] }]
});
assert.equal(model.registerClipAssetRigPart('caf', 'planet', {
    initialPivot: { x: 20, y: 20 }
}).changed, true);
assert.equal(model.registerClipAssetRigPart('caf', 'moon', {
    initialPivot: { x: 65, y: 20 }
}).changed, true);
assert.equal(model.registerClipAssetRigPart('caf', 'moon').changed, false);
let asset = model.getClipAsset('caf');
let clip = model.findClipEntry('clip').clip;
assert.deepEqual(asset.rigDefinition.parts.map(part => part.partId), ['planet', 'moon']);
assert.equal(asset.rigDefinition.parts[0].bindTransform.pivotX, 20);
assert.equal(asset.rigDefinition.parts[1].bindTransform.pivotX, 65);
assert.equal(model.registerClipAssetRigPart('caf', 'other', {
    initialPivot: { x: Number.NaN, y: 0 }
}).reason, 'invalid-part-pivot');
assert.equal(asset.rigDefinition.parts.some(part => part.partId === 'other'), false);
assert.equal(model.registerClipAssetRigPart('caf', 'other', {
    initialPivot: { x: 105, y: 20 }
}).changed, true);
assert.deepEqual(asset.rigDefinition.parts.map(part => part.partId), ['planet', 'moon', 'other']);
assert.equal(model.setClipAssetRigPartBindPivot('caf', 'planet', 21, 20).ok, true);
assert.equal(model.setClipAssetRigPartBindPivot('caf', 'planet', 20, 20).ok, true);
assert.equal(asset.rigDefinition.parts[0].bindTransform.pivotX, 20);
assert.equal(asset.rigDefinition.parts[1].bindTransform.pivotX, 65);
const beforeParent = evaluateRigidParts(asset, clip, 0).poseByPartId.get('moon').worldMatrix;
assert.equal(model.setClipAssetRigPartParent('caf', 'moon', 'planet').ok, true);
assert.equal(model.setClipAssetRigPartParent('caf', 'other', 'moon').ok, true);
const afterParent = evaluateRigidParts(asset, clip, 0).poseByPartId.get('moon').worldMatrix;
for (const field of ['a', 'b', 'c', 'd', 'tx', 'ty']) {
    assert.ok(Math.abs(beforeParent[field] - afterParent[field]) < 1e-8, `parent jump: ${field}`);
}
assert.equal(asset.rigDefinition.parts[1].parentPartId, 'planet');
assert.equal(model.setClipAssetRigPartParent('caf', 'planet', 'moon').reason, 'rig-cycle');
assert.equal(model.setClipAssetRigPartParent('caf', 'moon', 'missing').ok, false);
assert.equal(updateRigPartParent(asset.rigDefinition, 'moon', 'moon').reason, 'self-parent');
assert.equal(model.setClipAssetRigPartParent('missing-asset', 'moon', 'planet').ok, false);
assert.equal(createRigPartRenderPlan(asset, clip, 0).status, 'ready');
assert.equal(createRigPartRenderPlan(asset, clip, 0).islandByLayerId.has('loose'), false);

const movedTransform = resolvePartTransformHandleDrag({
    mode: 'move',
    startTransform: { x: 2, y: -1, scaleX: 1.25, scaleY: 0.8, rotation: 0.35 },
    startPointer: { x: 12, y: 8 },
    currentPointer: { x: 19, y: 3 }
});
assert.deepEqual(movedTransform,
    { x: 9, y: -6, scaleX: 1.25, scaleY: 0.8, rotation: 0.35 },
    'Part translation updates only existing x/y motion fields');

const motionProjectionProbe = Object.create(AnimationTablePopup.prototype);
const parentDraftTransform = {
    x: 11, y: -7, scaleX: 1.4, scaleY: 0.75, rotation: Math.PI / 3
};
motionProjectionProbe._rigLensPartPoseDraft = {
    assetId: 'caf', clipId: 'clip', frame: 0, localFrame: 0,
    poses: new Map([['planet', {
        partId: 'planet', transform: parentDraftTransform, interpolation: 'linear'
    }]])
};
motionProjectionProbe.getRigLensPartMotionTarget = (_assetId, partId) => ({
    ok: true, asset, entry: { clip }, frame: 0,
    part: asset.rigDefinition.parts.find(part => part.partId === partId)
});
motionProjectionProbe._screenToRigProject = event => event.projectPoint;
const parentDraftClip = motionProjectionProbe._getRigLensPreviewClip(clip, 0);
const parentDraftEvaluation = evaluateRigidParts(asset, parentDraftClip, 0);
const parentDraftMatrix = parentDraftEvaluation.poseByPartId.get('planet').worldMatrix;
const startParentLocal = { x: 27, y: -13 };
const endParentLocal = { x: 34, y: -8 };
const startProject = applyTransformMatrix(parentDraftMatrix, startParentLocal.x, startParentLocal.y);
const endProject = applyTransformMatrix(parentDraftMatrix, endParentLocal.x, endParentLocal.y);
const mappedStart = motionProjectionProbe.projectRigLensPartMotionLocalPoint('caf', 'moon', {
    projectPoint: startProject
});
const mappedEnd = motionProjectionProbe.projectRigLensPartMotionLocalPoint('caf', 'moon', {
    projectPoint: endProject
});
assert.ok(Math.abs(mappedStart.x - startParentLocal.x) < 1e-8
    && Math.abs(mappedStart.y - startParentLocal.y) < 1e-8,
    'child drag start is mapped through the parent preview world matrix');
assert.ok(Math.abs(mappedEnd.x - endParentLocal.x) < 1e-8
    && Math.abs(mappedEnd.y - endParentLocal.y) < 1e-8,
    'child drag end is mapped through the same parent preview world matrix');
const childMove = resolvePartTransformHandleDrag({
    mode: 'move', startTransform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
    startPointer: mappedStart, currentPointer: mappedEnd
});
assert.ok(Math.abs(childMove.x - 7) < 1e-8);
assert.ok(Math.abs(childMove.y - 5) < 1e-8);

const identityMotion = { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 };
const baseEvaluation = evaluateRigidParts(asset, clip, 0);
const translatedRootUpdate = upsertRigPartKey(null, 'planet', 0,
    { ...identityMotion, x: 9, y: -6 });
const translatedRootEvaluation = evaluateRigidParts(asset,
    { ...clip, rigMotion: translatedRootUpdate.value }, 0);
for (const partId of ['planet', 'moon', 'other']) {
    const part = asset.rigDefinition.parts.find(candidate => candidate.partId === partId);
    const pivot = part.bindTransform;
    const beforeCenter = applyTransformMatrix(
        baseEvaluation.poseByPartId.get(partId).worldMatrix, pivot.pivotX, pivot.pivotY
    );
    const afterCenter = applyTransformMatrix(
        translatedRootEvaluation.poseByPartId.get(partId).worldMatrix, pivot.pivotX, pivot.pivotY
    );
    assert.ok(Math.abs(afterCenter.x - beforeCenter.x - 9) < 1e-8
        && Math.abs(afterCenter.y - beforeCenter.y + 6) < 1e-8,
    `${partId} follows root translation without rewriting descendant tracks`);
}
const translatedChildUpdate = upsertRigPartKey(null, 'moon', 0,
    { ...identityMotion, x: 4, y: 6 });
const translatedChildEvaluation = evaluateRigidParts(asset,
    { ...clip, rigMotion: translatedChildUpdate.value }, 0);
assert.deepEqual(translatedChildEvaluation.poseByPartId.get('planet').worldMatrix,
    baseEvaluation.poseByPartId.get('planet').worldMatrix,
    'child translation does not move its parent');
for (const partId of ['moon', 'other']) {
    const part = asset.rigDefinition.parts.find(candidate => candidate.partId === partId);
    const pivot = part.bindTransform;
    const beforeCenter = applyTransformMatrix(
        baseEvaluation.poseByPartId.get(partId).worldMatrix, pivot.pivotX, pivot.pivotY
    );
    const afterCenter = applyTransformMatrix(
        translatedChildEvaluation.poseByPartId.get(partId).worldMatrix, pivot.pivotX, pivot.pivotY
    );
    assert.ok(Math.abs(afterCenter.x - beforeCenter.x - 4) < 1e-8
        && Math.abs(afterCenter.y - beforeCenter.y - 6) < 1e-8,
    `${partId} follows child translation while the parent remains still`);
}

const beforePreview = model.serialize();
const parentPose = { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: Math.PI / 2 };
const preview = upsertRigPartKey(clip.rigMotion, 'planet', 0, parentPose);
assert.equal(preview.ok, true);
const previewClip = { ...clip, rigMotion: preview.value };
const previewEval = evaluateRigidParts(asset, previewClip, 0);
const planetWorld = previewEval.poseByPartId.get('planet').worldMatrix;
const moonWorld = previewEval.poseByPartId.get('moon').worldMatrix;
const parentCenter = applyTransformMatrix(planetWorld, 20, 20);
const childCenter = applyTransformMatrix(moonWorld, 65, 20);
assert.ok(Math.abs(parentCenter.x - 20) < 1e-8 && Math.abs(parentCenter.y - 20) < 1e-8);
assert.ok(Math.abs(childCenter.x - 20) < 1e-8 && Math.abs(childCenter.y - 65) < 1e-8,
    'planet rotation makes moon orbit');
assert.equal(createRigPartRenderPlan(asset, previewClip, 0).status, 'ready');
assert.deepEqual(model.serialize(), beforePreview, 'preview is runtime-only');
assert.equal(getRigPartKeyAtFrame(clip.rigMotion, 'planet', 0), null);

const history = new HistoryManager();
assert.equal(model.setClipRigPartKey('clip', 'planet', 0, parentPose).ok, true);
const first = model.serialize();
history.record({ name: 'part-key',
    undo: () => { clip.rigMotion = beforePreview.tracks[0].cels[0].rigMotion; },
    do: () => { clip.rigMotion = first.tracks[0].cels[0].rigMotion; }
});
history.undo();
assert.equal(getRigPartKeyAtFrame(clip.rigMotion, 'planet', 0), null);
history.redo();
assert.ok(getRigPartKeyAtFrame(clip.rigMotion, 'planet', 0));
assert.equal(model.setClipAssetRigPartBindPivot('caf', 'planet', 21, 20).reason, 'part-motion-exists');
assert.equal(model.setClipAssetRigPartParent('caf', 'moon', null).reason, 'part-motion-exists');
assert.equal(model.setClipRigPartKey('clip', 'moon', 0,
    { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: Math.PI / 4 }).ok, true);
assert.equal(model.setClipRigPartKey('clip', 'planet', 1,
    { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: -Math.PI / 3 }).ok, true);
assert.equal(model.setClipRigPartKey('clip', 'moon', 1,
    { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: -Math.PI / 4 }).ok, true);
const pose0 = evaluateRigidParts(asset, clip, 0);
const pose1 = evaluateRigidParts(asset, clip, 1);
assert.notDeepEqual(pose0.poseByPartId.get('moon').worldMatrix,
    pose1.poseByPartId.get('moon').worldMatrix);
assert.notDeepEqual(pose0.poseByPartId.get('planet').worldMatrix,
    pose1.poseByPartId.get('planet').worldMatrix);
const beforeBatch = structuredClone(clip.rigMotion);
const invalidBatch = model.setClipRigPartKeys('clip', 2, [
    { partId: 'planet', transform: { x: 4, y: 0, scaleX: 1, scaleY: 1, rotation: 0 } },
    { partId: 'missing', transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 } }
]);
assert.equal(invalidBatch.ok, false);
assert.deepEqual(clip.rigMotion, beforeBatch, 'invalid batch leaves the ClipInstance untouched');
const batchPoses = [
    { partId: 'planet', transform: { x: 5, y: 0, scaleX: 1, scaleY: 1, rotation: 0 } },
    { partId: 'moon', transform: { x: 0, y: 8, scaleX: 1, scaleY: 1, rotation: 0 },
        options: { interpolation: 'hold' } },
    { partId: 'other', transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: Math.PI / 6 } }
];
const batchResult = model.setClipRigPartKeys('clip', 2, batchPoses);
assert.equal(batchResult.ok, true);
assert.deepEqual(batchResult.keys.map(item => item.partId), ['planet', 'moon', 'other']);
assert.equal(getRigPartKeyAtFrame(clip.rigMotion, 'moon', 2).interpolation, 'hold');
const afterBatch = structuredClone(clip.rigMotion);
history.record({ name: 'part-frame-key-batch',
    undo: () => { clip.rigMotion = structuredClone(beforeBatch); },
    do: () => { clip.rigMotion = structuredClone(afterBatch); }
});
history.undo();
for (const partId of ['planet', 'moon', 'other']) {
    assert.equal(getRigPartKeyAtFrame(clip.rigMotion, partId, 2), null,
        'one Undo removes the whole frame batch');
}
history.redo();
for (const partId of ['planet', 'moon', 'other']) {
    assert.ok(getRigPartKeyAtFrame(clip.rigMotion, partId, 2),
        'one Redo restores the whole frame batch');
}
const serialized = await Object.create(ProjectManager.prototype)._serializeAnimationForProject(model);
const reloaded = new TimelineModel(JSON.parse(JSON.stringify(serialized)));
asset = reloaded.getClipAsset('caf');
clip = reloaded.findClipEntry('clip').clip;
assert.equal(asset.rigDefinition.parts[1].parentPartId, 'planet');
assert.equal(asset.rigDefinition.parts[2].parentPartId, 'moon');
assert.equal(asset.rigDefinition.parts[1].bindTransform.pivotX, 65);
assert.ok(getRigPartKeyAtFrame(clip.rigMotion, 'moon', 1));
for (const partId of ['planet', 'moon', 'other']) {
    assert.ok(getRigPartKeyAtFrame(clip.rigMotion, partId, 2));
}
assert.equal(createRigPartRenderPlan(asset, clip, 1).status, 'ready');
assert.equal(asset.rigDefinition.bones?.length || 0, 0);
assert.equal(asset.meshDefinitions?.length || 0, 0);
assert.equal(asset.skinBindings?.length || 0, 0);

const root = path.dirname(fileURLToPath(import.meta.url));
const popup = fs.readFileSync(path.join(root, '../ui/animation-table-popup.js'), 'utf8');
const frame = fs.readFileSync(path.join(root, '../ui/right-workspace-frame.js'), 'utf8');
const surface = fs.readFileSync(path.join(root, '../styles/components/layer-panel-surface.css'), 'utf8');
assert.match(popup, /previewRigLensPartPose[\s\S]*?_scheduleMotionEditPreviewRefresh/u);
assert.match(popup, /commitRigLensPartPoseFrame[\s\S]*?setClipRigPartKeys[\s\S]*?_finishMotionGestureHistory/u);
assert.match(popup, /_rigLensPartPoseDraft[\s\S]*?new Map\(\)/u);
assert.match(popup, /navigateRigLensPartFrameByDelta[\s\S]*?_navigateTimelineFrameTo/u);
assert.match(frame, /right-workspace-rig-frame-navigation/u);
assert.match(frame, /commitRigLensPartPoseFrame/u);
assert.match(popup, /registerInternalRigPartFromExternal\(assetId, layerId, options = \{\}\)[\s\S]*?options\.selectInternalLayer !== false/u);
assert.match(popup, /registerRigLensPart\(assetId, partId, initialPivot = null\)[\s\S]*?selectInternalLayer: false/u);
assert.match(frame, /_startRigPartPoseGesture[\s\S]*?previewRigLensPartPose/u);
assert.match(frame, /resolvePartTransformHandleDrag[\s\S]*?startPointer: gesture\.startPointer/u,
    'PART root-handle drag uses the existing x/y motion resolver');
assert.match(frame, /_startRigPartPoseGesture\(bone, event, 'move'\)/u,
    'PART MOTION root marker starts translation while the tip remains the rotation handle');
assert.match(popup, /projectRigLensPartMotionLocalPoint[\s\S]*?_getRigLensPreviewClip[\s\S]*?evaluateRigidParts[\s\S]*?invertTransformMatrixPoint/u,
    'child translation pointer coordinates include the current parent preview');
assert.match(frame, /Part \$\{bone\.partId\}を選択、ドラッグして移動/u,
    'root translation affordance remains selectable and accessible');
assert.match(surface, /\.right-workspace-rig-part-move-handle\s*\{\s*cursor:\s*move/u,
    'root translation and tip rotation have distinct pointer affordances');
const partGestureSource = frame.slice(
    frame.indexOf('_startRigPartPoseGesture'), frame.indexOf('_onRigCanvasUp')
);
assert.doesNotMatch(partGestureSource, /setClipRigPartKey(?:s)?\s*\(/u,
    'Part canvas gestures update runtime preview only, not canonical KEY data');
assert.match(frame, /_syncRigPartPivotOverlay[\s\S]*?projectRigLensPartBindPoint[\s\S]*?setRigLensPartPivot/u);
assert.match(popup, /getRigLensPartPivotWorldItems[\s\S]*?canMove/u);
assert.match(frame, /rigPartFrameLabel\.addEventListener\('wheel'/u,
    'frame wheel is owned by the frame-number control only');
assert.doesNotMatch(frame, /rigPartFrameRow\.addEventListener\('wheel'/u,
    'frame controls and surrounding Inspector do not capture wheel input');
assert.match(frame, /details\.textContent = `親：\$\{parentName\}`[\s\S]*?item\.appendChild\(details\)/u,
    'parent hierarchy is projected inside each Part card');
assert.match(frame, /if \(!motion && isSelected\)[\s\S]*?item\.appendChild\(this\.rigPartParentLabel\)/u,
    'parent editing is inline in the selected Setup card only');
assert.match(frame, /item\.appendChild\(this\.rigPartRegisterButton\)/u,
    'Part creation remains reachable from its selected Layer card');
const partSelectionSource = frame.slice(
    frame.indexOf('_selectRigLensPart(partId)'),
    frame.indexOf('_syncRigModeAction(motionTarget, matchesTarget)')
);
assert.match(partSelectionSource, /this\.rigSelectedPartId = partId;[\s\S]*?this\.sync\(\);/u,
    'selecting a Layer updates only the runtime selection projection');
assert.doesNotMatch(partSelectionSource, /History|KEY|setClipRigPartKey/u,
    'Part selection and progressive phase readiness do not mutate History or KEY data');
assert.match(frame, /RIG_PART_OPERATION_MESSAGES[\s\S]*?clipping-boundary-split[\s\S]*?rig-cycle[\s\S]*?function rigPartOperationMessage/u,
    'registration and hierarchy refusals have concise UI reasons');
assert.match(popup, /registerRigLensPart\(assetId, partId, initialPivot = null\)[\s\S]*?initialPivot: pivot[\s\S]*?selectInternalLayer: false/u,
    'explicit Pivot setup can register the Part without changing the selected CAF Layer');
assert.match(popup, /registerInternalRigPartFromExternal\(assetId, layerId, options = \{\}\)[\s\S]*?_recordInternalLayerHistory\(asset, beforeState, 'caf-rig-part-register'/u,
    'Part registration and its initial Pivot share one existing History boundary');
assert.match(popup, /if \(this\.isPlaying\) return \{ ok: false, reason: '再生中はPartを登録できません。' \};/u,
    'playback refusal is reported instead of being mislabeled as a target error');
assert.match(surface, /right-workspace-rig-part-item:has\(> \.right-workspace-rig-part-row\[aria-pressed="true"\]\)[\s\S]*?var\(--active-border\)/u,
    'the existing Part selection projects one Futaba active outline around the whole card');
assert.match(frame, /rigKindRow\.hidden = !this\.rigLensActive/u);
assert.match(frame, /rigPartKindButton\.disabled = !hasPartCandidate/u);
assert.doesNotMatch(frame, /hasSelectedPart|rigLayerEntryButton|right-workspace-rig-layer-entry/u,
    'registered Part does not add a duplicate Layer-side RIG primary entry');
assert.match(frame, /this\.rigPartFrameRow\.hidden = !matchesTarget \|\| !hasLocalFrame/u,
    'RIG Frame row is shown only for the selected target Clip and a valid frame');
assert.match(frame, /_renderRigPartLens[\s\S]*?authoringKind: 'part'[\s\S]*?frameTarget: partTarget/u,
    'PART SETUP and MOTION reuse the existing selected-Clip Frame projection');
assert.match(frame, /authoringKind: 'deform'[\s\S]*?frameTarget: partTarget/u,
    'DEFORM SETUP and MOTION use the selected CAF Clip frame without Part KEY routing');
assert.match(frame, /this\.title\.hidden = rigLensVisible/u,
    'the duplicate normal Layer/Frame target label is hidden only in RIG');
assert.match(surface, /\.right-workspace-target\[hidden\]\s*\{\s*display:\s*none\s*!important\s*;\s*\}/u,
    'the target label hidden state overrides its flex display and collapses its layout slot');
assert.doesNotMatch(frame, /rigReturnButton/u,
    'RIG exit uses the existing guarded LAYER / TRANSFORM primary switch');
assert.match(frame, /commitRigLensPartPoseFrame[\s\S]*?commitRigLensBoneKey/u,
    'PART batch KEY and DEFORM Bone KEY keep their distinct existing terminals');
assert.match(popup, /navigateRigLensPartFrameByDelta[\s\S]*?hasRigLensBonePosePreview/u,
    'RIG Frame navigation refuses pending Bone Pose');
assert.match(popup, /_navigateTimelineFrameTo\(frameIndex, options = \{\}\)\s*\{\s*if \(this\.hasRigLensPartPosePreview\(\) \|\| this\.hasRigLensBonePosePreview\(\)\)/u,
    'direct Frame navigation cannot implicitly discard either RIG Pose draft');
assert.match(popup, /moveTimelineFrameByDelta\(delta, options = \{\}\)\s*\{\s*if \(this\.hasRigLensPartPosePreview\(\) \|\| this\.hasRigLensBonePosePreview\(\)\)/u,
    'Dock Frame navigation preserves pending Part and Bone Pose drafts');
assert.match(surface, /\.right-workspace-rig-part-item\s*\{\s*display:\s*flex/u,
    'Part selection and parent relation share a compact horizontal card row');
assert.match(surface, /\.right-workspace-rig-frame-navigation\.has-pose-cancel\s*\{/u,
    'the Frame row reserves a cancel slot only while a pending Pose can be cancelled');
console.log('PASS: three-Part hierarchy, composite motion, runtime draft, atomic frame KEY batch, one-step Undo/Redo, Project round-trip');
