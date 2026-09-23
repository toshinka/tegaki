import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRigPartRenderPlan } from '../system/animation/folder-part-render-plan.js';
import {
    evaluateRigidParts, getRigPartKeyAtFrame, updateRigPartParent, upsertRigPartKey
} from '../system/animation/part-rig.js';
import { applyTransformMatrix } from '../system/transform-math.js';

globalThis.window = globalThis.window || {};
const { TimelineModel } = await import('../system/animation/animation-data-model.js');
const { HistoryManager } = await import('../system/history.js');
const { ProjectManager } = await import('../system/project-manager.js');
const model = new TimelineModel({
    totalFrames: 3,
    clipAssets: [{ id: 'caf', name: 'Orbit', internalLayers: [
        { id: 'planet', name: '惑星', type: 'raster' },
        { id: 'moon', name: '衛星', type: 'raster' },
        { id: 'other', name: '無関係', type: 'raster' }
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
assert.equal(model.setClipAssetRigPartBindPivot('caf', 'planet', 21, 20).ok, true);
assert.equal(model.setClipAssetRigPartBindPivot('caf', 'planet', 20, 20).ok, true);
assert.equal(asset.rigDefinition.parts[0].bindTransform.pivotX, 20);
assert.equal(asset.rigDefinition.parts[1].bindTransform.pivotX, 65);
const beforeParent = evaluateRigidParts(asset, clip, 0).poseByPartId.get('moon').worldMatrix;
assert.equal(model.setClipAssetRigPartParent('caf', 'moon', 'planet').ok, true);
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
assert.equal(createRigPartRenderPlan(asset, clip, 0).islandByLayerId.has('other'), false);
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
const serialized = await Object.create(ProjectManager.prototype)._serializeAnimationForProject(model);
const reloaded = new TimelineModel(JSON.parse(JSON.stringify(serialized)));
asset = reloaded.getClipAsset('caf');
clip = reloaded.findClipEntry('clip').clip;
assert.equal(asset.rigDefinition.parts[1].parentPartId, 'planet');
assert.equal(asset.rigDefinition.parts[1].bindTransform.pivotX, 65);
assert.ok(getRigPartKeyAtFrame(clip.rigMotion, 'moon', 1));
assert.equal(createRigPartRenderPlan(asset, clip, 1).status, 'ready');
assert.equal(asset.rigDefinition.bones?.length || 0, 0);
assert.equal(asset.meshDefinitions?.length || 0, 0);
assert.equal(asset.skinBindings?.length || 0, 0);

const root = path.dirname(fileURLToPath(import.meta.url));
const popup = fs.readFileSync(path.join(root, '../ui/animation-table-popup.js'), 'utf8');
const frame = fs.readFileSync(path.join(root, '../ui/right-workspace-frame.js'), 'utf8');
assert.match(popup, /previewRigLensPartPose[\s\S]*?_scheduleMotionEditPreviewRefresh/u);
assert.match(popup, /commitRigLensPartKey[\s\S]*?setClipRigPartKey[\s\S]*?_finishMotionGestureHistory/u);
assert.match(frame, /_startRigPartPoseGesture[\s\S]*?previewRigLensPartPose/u);
assert.match(frame, /_syncRigPartPivotOverlay[\s\S]*?projectRigLensPartBindPoint[\s\S]*?setRigLensPartPivot/u);
assert.match(popup, /getRigLensPartPivotWorldItems[\s\S]*?canMove/u);
assert.match(frame, /hasSelectedPart[\s\S]*?rigLayerEntryButton\.hidden/u,
    'registered Part remains reachable from LAYER when Transform is blocked');
console.log('PASS: two Raster Parts, pivot, no-jump parent, orbit/self-rotation, preview isolation, explicit KEY, History, Project round-trip');
