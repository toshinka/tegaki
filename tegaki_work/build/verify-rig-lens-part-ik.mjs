import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateRigidParts, getRigPartKeyAtFrame } from '../system/animation/part-rig.js';
import { applyTransformMatrix } from '../system/transform-math.js';

globalThis.window = globalThis.window || {};
const { AnimationTablePopup } = await import('../ui/animation-table-popup.js');
const { TimelineModel } = await import('../system/animation/animation-data-model.js');
const { ProjectManager } = await import('../system/project-manager.js');

const model = new TimelineModel({
    totalFrames: 3,
    clipAssets: [{ id: 'ik-caf', name: 'Arm', internalLayers: [
        { id: 'torso', name: 'Torso', type: 'raster' },
        { id: 'shoulder', name: 'Shoulder', type: 'raster' },
        { id: 'forearm', name: 'Forearm', type: 'raster' },
        { id: 'hand', name: 'Hand', type: 'raster' },
        { id: 'loose', name: 'Loose', type: 'raster' }
    ] }],
    tracks: [{ id: 'arm-lane', cels: [{
        id: 'arm-clip', assetId: 'ik-caf', startFrame: 0, duration: 3
    }] }]
});
for (const [partId, initialPivot] of [
    ['torso', { x: 75, y: 100 }],
    ['shoulder', { x: 100, y: 100 }],
    ['forearm', { x: 150, y: 100 }],
    ['hand', { x: 185, y: 135 }]
]) {
    assert.equal(model.registerClipAssetRigPart('ik-caf', partId, { initialPivot }).changed, true);
}
assert.equal(model.setClipAssetRigPartParent('ik-caf', 'shoulder', 'torso').ok, true);
assert.equal(model.setClipAssetRigPartParent('ik-caf', 'forearm', 'shoulder').ok, true);
assert.equal(model.setClipAssetRigPartParent('ik-caf', 'hand', 'forearm').ok, true);
model.playback.currentFrame = 1;

const popup = Object.assign(Object.create(AnimationTablePopup.prototype), {
    model,
    selectedCelId: 'arm-clip',
    selectedInternalLayerId: 'hand',
    isPlaying: false,
    _rigLensPartPoseDraft: null,
    _rigLensBonePoseDraft: null,
    _animationPreviewKey: null
});
popup._scheduleMotionEditPreviewRefresh = () => {};
popup._cancelMotionEditPreviewRefresh = () => {};
popup._applyVisibilityPreview = () => {};
popup._invalidateSnapshotTextureCache = () => {};
popup._flushLayerPanelSync = () => {};
popup._scheduleLaneReferencePreviewUpdate = () => {};
popup.render = () => {};
let capturedBefore = 0;
let historyFinishes = [];
popup._captureTimelineHistoryState = () => ({ capture: ++capturedBefore });
popup._finishMotionGestureHistory = (before, type) => historyFinishes.push({ before, type });

assert.equal(popup.getRigLensPartIkChainContext('ik-caf', 'shoulder').ok, false,
    'two-Part chains are refused because they lack a grandparent Root');
assert.equal(popup.getRigLensPartIkChainContext('ik-caf', 'loose').ok, false,
    'unregistered Part is refused');

const torsoBefore = { x: 13, y: -6, scaleX: 1, scaleY: 1, rotation: 0.32 };
assert.equal(popup.previewRigLensPartPose('ik-caf', 'torso', torsoBefore).ok, true,
    'existing parent motion may already be present in the runtime draft');
const canonicalBefore = structuredClone(model.findClipEntry('arm-clip').clip.rigMotion);
const serializedBefore = model.serialize();
const chain = popup.getRigLensPartIkChainContext('ik-caf', 'hand');
assert.equal(chain.ok, true, chain.reason);
assert.equal(chain.rootPartId, 'shoulder');
assert.equal(chain.jointPartId, 'forearm');
assert.equal(chain.effectorPartId, 'hand');
assert.equal(chain.frame, 1);
assert.equal(chain.localFrame, 1);
assert.ok(chain.points.root.x > 100 && chain.points.root.y > 80,
    'chain points include the current ancestor runtime preview');
assert.ok(chain.lengthA > 1 && chain.lengthB > 1);
assert.equal(chain.bendSign, 1, 'starting bend direction is captured once per gesture');

const target = {
    x: chain.points.effector.x + 8,
    y: chain.points.effector.y + 24
};
const solution = popup.previewRigLensPartIkTarget('ik-caf', 'hand', target, chain);
assert.equal(solution.ok, true, solution.reason);
assert.equal(solution.bendSign, chain.bendSign);
assert.deepEqual(model.findClipEntry('arm-clip').clip.rigMotion, canonicalBefore,
    'IK preview does not mutate canonical Motion KEY data');
assert.deepEqual(model.serialize(), serializedBefore,
    'IK preview does not mutate serialized Project state');
assert.deepEqual([...popup._rigLensPartPoseDraft.poses.keys()], ['torso', 'shoulder', 'forearm'],
    'IK adds only root/joint to the existing runtime draft and leaves the effector untouched');
for (const field of ['x', 'y', 'scaleX', 'scaleY']) {
    assert.equal(solution.rootTransform[field], chain.rootTransform[field]);
    assert.equal(solution.jointTransform[field], chain.jointTransform[field]);
}
const posedClip = popup._getRigLensPreviewClip(model.findClipEntry('arm-clip').clip, 1);
const posed = evaluateRigidParts(model.getClipAsset('ik-caf'), posedClip, 1);
assert.equal(posed.ok, true);
const pointAtPivot = partId => {
    const part = model.getClipAsset('ik-caf').rigDefinition.parts.find(item => item.partId === partId);
    return applyTransformMatrix(posed.poseByPartId.get(partId).worldMatrix,
        part.bindTransform.pivotX, part.bindTransform.pivotY);
};
const rootAfter = pointAtPivot('shoulder');
const jointAfter = pointAtPivot('forearm');
const effectorAfter = pointAtPivot('hand');
assert.ok(Math.hypot(rootAfter.x - chain.points.root.x, rootAfter.y - chain.points.root.y) < 1e-7,
    'root pivot remains fixed while its rotation drives descendants');
assert.ok(Math.abs(Math.hypot(jointAfter.x - rootAfter.x, jointAfter.y - rootAfter.y) - chain.lengthA) < 1e-7);
assert.ok(Math.abs(Math.hypot(effectorAfter.x - jointAfter.x,
    effectorAfter.y - jointAfter.y) - chain.lengthB) < 1e-7);
assert.ok(Math.hypot(effectorAfter.x - solution.clampedTarget.x,
    effectorAfter.y - solution.clampedTarget.y) < 1e-7,
'evaluated hand pivot follows the requested reachable target');

const farTarget = {
    x: chain.points.root.x + chain.lengthA + chain.lengthB + 80,
    y: chain.points.root.y
};
const clamped = popup.previewRigLensPartIkTarget('ik-caf', 'hand', farTarget, chain);
assert.equal(clamped.ok, true, clamped.reason);
assert.ok(Math.abs(clamped.clampedDistance - (chain.lengthA + chain.lengthB)) < 1e-7,
    'unreachable target is clamped to the fixed-length reach');
assert.equal(clamped.bendSign, chain.bendSign,
    'successive pointer targets preserve the gesture-start bend side');
const clampedClip = popup._getRigLensPreviewClip(model.findClipEntry('arm-clip').clip, 1);
const clampedEval = evaluateRigidParts(model.getClipAsset('ik-caf'), clampedClip, 1);
const handPart = model.getClipAsset('ik-caf').rigDefinition.parts.find(item => item.partId === 'hand');
const clampedHand = applyTransformMatrix(clampedEval.poseByPartId.get('hand').worldMatrix,
    handPart.bindTransform.pivotX, handPart.bindTransform.pivotY);
assert.ok(Math.hypot(clampedHand.x - clamped.clampedTarget.x,
    clampedHand.y - clamped.clampedTarget.y) < 1e-7);

assert.equal(popup.commitRigLensPartPoseFrame('ik-caf').ok, true);
assert.deepEqual(historyFinishes.map(item => item.type), ['caf-rig-lens-part-frame-key'],
    'the existing single frame-batch History boundary is used exactly once');
assert.deepEqual(historyFinishes[0].before, { capture: 1 });
const committedClip = model.findClipEntry('arm-clip').clip;
for (const partId of ['torso', 'shoulder', 'forearm']) {
    assert.ok(getRigPartKeyAtFrame(committedClip.rigMotion, partId, 1),
        `${partId} is included in the one explicit Frame KEY batch`);
}
assert.equal(getRigPartKeyAtFrame(committedClip.rigMotion, 'hand', 1), null,
    'the effector does not gain a KEY just because it is an IK target');
assert.equal(getRigPartKeyAtFrame(committedClip.rigMotion, 'shoulder', 0), null,
    'IK does not create keys on adjacent Frames');
assert.equal(popup.hasRigLensPartPosePreview(), false,
    'successful KEY commit clears only the existing runtime draft');

const serialized = await Object.create(ProjectManager.prototype)._serializeAnimationForProject(model);
const reloaded = new TimelineModel(JSON.parse(JSON.stringify(serialized)));
const reloadedAsset = reloaded.getClipAsset('ik-caf');
const reloadedClip = reloaded.findClipEntry('arm-clip').clip;
assert.equal(reloadedAsset.rigDefinition.parts.find(part => part.partId === 'forearm').parentPartId,
    'shoulder');
assert.equal(reloadedAsset.rigDefinition.parts.find(part => part.partId === 'hand').parentPartId,
    'forearm');
for (const partId of ['torso', 'shoulder', 'forearm']) {
    assert.ok(getRigPartKeyAtFrame(reloadedClip.rigMotion, partId, 1),
        `${partId} KEY survives the existing Project serialize/revisit path`);
}

const invalidAsset = model.getClipAsset('ik-caf');
const handBind = invalidAsset.rigDefinition.parts.find(part => part.partId === 'hand').bindTransform;
const savedScaleY = handBind.scaleY;
handBind.scaleY = 1.5;
assert.equal(popup.getRigLensPartIkChainContext('ik-caf', 'hand').ok, false,
    'nonuniform chain scale is refused instead of feeding a distorted length to IK');
handBind.scaleY = savedScaleY;
const zeroModel = new TimelineModel({
    totalFrames: 1,
    clipAssets: [{ id: 'zero-caf', internalLayers: [
        { id: 'zero-root', type: 'raster' },
        { id: 'zero-joint', type: 'raster' },
        { id: 'zero-hand', type: 'raster' }
    ] }],
    tracks: [{ id: 'zero-lane', cels: [{
        id: 'zero-clip', assetId: 'zero-caf', startFrame: 0, duration: 1
    }] }]
});
for (const partId of ['zero-root', 'zero-joint', 'zero-hand']) {
    assert.equal(zeroModel.registerClipAssetRigPart('zero-caf', partId, {
        initialPivot: { x: 0, y: 0 }
    }).changed, true);
}
assert.equal(zeroModel.setClipAssetRigPartParent('zero-caf', 'zero-joint', 'zero-root').ok, true);
assert.equal(zeroModel.setClipAssetRigPartParent('zero-caf', 'zero-hand', 'zero-joint').ok, true);
const zeroPopup = Object.assign(Object.create(AnimationTablePopup.prototype), {
    model: zeroModel, selectedCelId: 'zero-clip', isPlaying: false
});
assert.equal(zeroPopup.getRigLensPartIkChainContext('zero-caf', 'zero-hand').reason,
    'IKには長さが0でない2本のPartが必要です。',
    'zero-length links are refused with an actionable reason');

const root = path.dirname(fileURLToPath(import.meta.url));
const popupSource = fs.readFileSync(path.join(root, '../ui/animation-table-popup.js'), 'utf8');
const frameSource = fs.readFileSync(path.join(root, '../ui/right-workspace-frame.js'), 'utf8');
const cssSource = fs.readFileSync(path.join(root, '../styles/components/layer-panel-surface.css'), 'utf8');
assert.match(popupSource, /getRigLensPartIkChainContext[\s\S]*?evaluateRigidParts[\s\S]*?TWO_BONE_IK_EPSILON/u);
assert.match(popupSource, /previewRigLensPartIkTarget[\s\S]*?solveFixedLengthTwoBoneIk[\s\S]*?previewRigLensPartPose/u);
assert.match(frameSource, /rigPartIkButton\.disabled = !ikContext\?\.ok/u,
    'the compact IK control is disabled when no eligible chain exists');
assert.match(frameSource, /_startRigPartIkGesture[\s\S]*?beforePreviews: new Map/u,
    'the gesture captures runtime previews for cancellation rollback');
assert.match(frameSource, /if \(gesture\.kind === 'part-ik'\)[\s\S]*?discardRigLensPartPosePreview/u,
    'pointer cancellation restores or discards only the IK-edited runtime Part previews');
assert.match(frameSource, /right-workspace-rig-part-ik-target/u,
    'the active IK target has a distinct Canvas handle');
assert.match(cssSource, /right-workspace-rig-part-ik-target[\s\S]*?var\(--active-border\)/u);
console.log('PASS: PART 2-link IK uses evaluated parent previews, preserves bend/length, clamps reach, updates only runtime root/joint draft, and commits through the existing Frame KEY batch');
