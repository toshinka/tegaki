import assert from 'node:assert/strict';

import { inspectStaticRigBindGestureTarget } from '../system/animation/rig-static-authoring.js';

globalThis.window = globalThis.window || {};
const { TimelineModel, ClipAssetModel } = await import('../system/animation/animation-data-model.js');
const { historyManager } = await import('../system/history.js');
const { AnimationTablePopup } = await import('../ui/animation-table-popup.js');

const model = new TimelineModel({
    totalFrames: 3,
    clipAssets: [{
        id: 'asset',
        internalLayers: [{ id: 'raster', type: 'raster' }],
        rigDefinition: {
            version: 1, parts: [],
            bones: [{
                boneId: 'root', parentBoneId: null, name: 'Root', length: 40,
                bindTransform: {
                    x: 10, y: 12, scaleX: 1, scaleY: 1, rotation: 0,
                    pivotX: 0, pivotY: 0
                }
            }]
        }
    }],
    tracks: [{ id: 'lane', cels: [{ id: 'clip', assetId: 'asset', duration: 3 }] }]
});
historyManager.clear();
const popup = Object.assign(Object.create(AnimationTablePopup.prototype), {
    model, selectedCelId: 'clip', selectedInternalLayerId: 'raster', isPlaying: false
});
popup._screenToRigProject = event => ({ x: event.x, y: event.y });
popup._projectToBoneParentLocal = point => point;
popup._captureInternalLayerHistoryState = asset => ({
    assetId: asset.id, asset: structuredClone(asset.serialize())
});
popup._restoreInternalLayerHistoryState = (assetId, state) => {
    const index = model.clipAssets.findIndex(asset => asset.id === assetId);
    if (index < 0 || state?.assetId !== assetId) return false;
    model.clipAssets[index] = new ClipAssetModel(state.asset);
    return true;
};
popup._estimateActiveCafAssetHistoryBytes = () => 1;
for (const name of [
    '_invalidateSnapshotTextureCache', '_applyVisibilityPreview', 'render',
    '_flushLayerPanelSync', '_scheduleLaneReferencePreviewUpdate'
]) popup[name] = () => {};

let generationCalls = 0;
model.generateClipAssetRasterBoneSetup = () => {
    generationCalls++;
    throw new Error('PRE_BIND must not generate AUTO GRID');
};
const asset = () => model.getClipAsset('asset');
const bone = () => asset().rigDefinition.bones[0];
const snapshot = () => structuredClone(asset().serialize());
const permission = popup.getRigLensStaticBindGestureTarget('asset', 'raster');
assert.equal(permission.ok, true);
assert.equal(permission.mode, 'pre_bind');
assert.equal(popup.getRigLensStaticBindAdjustmentTarget('asset', 'raster').ok, false,
    'R-35 safe rebind continues to require an existing AUTO GRID');
assert.doesNotMatch(permission.reason || '', /Mesh|AUTO GRID/u,
    'initial Setup does not present a post-bind error');

const beforeMove = snapshot();
const move = popup.beginRigLensStaticBoneGesture('asset', 'raster', 'root', { x: 10, y: 12 });
assert.equal(move.ok, true, 'the first pointerdown can begin a pre-bind gesture');
assert.equal(move.permissionMode, 'pre_bind');
assert.equal(historyManager.stack.length, 0, 'pointerdown only selects and captures');
assert.deepEqual(popup.projectRigLensStaticBonePoint('asset', 'raster', 'root', { x: 18, y: 20 }),
    { x: 18, y: 20 });
assert.equal(popup.previewRigLensStaticBoneBind('asset', 'raster', 'root', {
    ...move.startTransform, x: 18, y: 20
}).ok, true);
assert.equal(historyManager.stack.length, 0, 'pointermove remains a preview');
assert.equal(popup.finishRigLensStaticBoneGesture(
    'asset', 'raster', 'root', move.startTransform, move.beforeState, move.permissionMode
).ok, true);
assert.equal(historyManager.stack.length, 1, 'one Move gesture records one CAF asset command');
assert.equal(historyManager.stack[0].meta.historyKind, 'caf-asset');
assert.equal(historyManager.stack[0].meta.type, 'caf-rig-bone-bind-setup');
const afterMove = snapshot();
assert.deepEqual([bone().bindTransform.x, bone().bindTransform.y], [18, 20]);
assert.deepEqual(asset().meshDefinitions || [], [], 'Move did not create a Mesh');
assert.deepEqual(asset().skinBindings || [], [], 'Move did not create a Skin');
historyManager.undo();
assert.deepEqual(snapshot(), beforeMove, 'one Undo restores the complete pre-move asset');
historyManager.redo();
assert.deepEqual(snapshot(), afterMove, 'one Redo reapplies the move');

const beforeRotate = snapshot();
const rotate = popup.beginRigLensStaticBoneGesture('asset', 'raster', 'root', { x: 18, y: 20 });
assert.equal(rotate.ok, true);
assert.equal(popup.previewRigLensStaticBoneBind('asset', 'raster', 'root', {
    ...rotate.startTransform, rotation: 0.4
}).ok, true);
assert.equal(popup.finishRigLensStaticBoneGesture(
    'asset', 'raster', 'root', rotate.startTransform, rotate.beforeState, rotate.permissionMode
).ok, true);
assert.equal(historyManager.stack.length, 2, 'one Rotate gesture adds one CAF asset command');
const afterRotate = snapshot();
assert.equal(bone().bindTransform.rotation, 0.4);
historyManager.undo();
assert.deepEqual(snapshot(), beforeRotate, 'one Undo restores the pre-rotation asset');
historyManager.redo();
assert.deepEqual(snapshot(), afterRotate, 'one Redo reapplies rotation');
assert.equal(generationCalls, 0, 'neither pre-bind gesture invoked the generator');
assert.deepEqual(model.tracks[0].cels[0].rigMotion?.boneTracks || [], [],
    'static Setup never adds Motion KEYs');

const beforeCancel = snapshot();
const cancelled = popup.beginRigLensStaticBoneGesture('asset', 'raster', 'root', { x: 18, y: 20 });
assert.equal(popup.previewRigLensStaticBoneBind('asset', 'raster', 'root', {
    ...cancelled.startTransform, x: 25
}).ok, true);
assert.equal(popup.cancelRigLensStaticBoneGesture('asset', cancelled.beforeState).ok, true);
assert.deepEqual(snapshot(), beforeCancel, 'cancel restores the preview');
assert.equal(historyManager.stack.length, 2, 'cancel adds no History');

const noChange = popup.beginRigLensStaticBoneGesture('asset', 'raster', 'root', { x: 18, y: 20 });
assert.equal(popup.finishRigLensStaticBoneGesture(
    'asset', 'raster', 'root', noChange.startTransform, noChange.beforeState, noChange.permissionMode
).changed, false);
assert.equal(historyManager.stack.length, 2, 'selection without movement adds no History');

const beforeLimitedMove = snapshot();
historyManager.maxSize = 1;
const limited = popup.beginRigLensStaticBoneGesture('asset', 'raster', 'root', { x: 18, y: 20 });
assert.equal(popup.previewRigLensStaticBoneBind('asset', 'raster', 'root', {
    ...limited.startTransform, x: 21
}).ok, true);
assert.equal(popup.finishRigLensStaticBoneGesture(
    'asset', 'raster', 'root', limited.startTransform, limited.beforeState, limited.permissionMode
).ok, true, 'a valid command remains recorded when the History limit evicts old entries');
assert.equal(historyManager.stack.length, 1);
historyManager.undo();
assert.deepEqual(snapshot(), beforeLimitedMove);
historyManager.maxSize = 250;
assert.equal(generationCalls, 0);

const unsafe = snapshot();
unsafe.meshDefinitions = [{ meshId: 'unsupported', targetInternalLayerId: 'raster', manual: true }];
const blocked = inspectStaticRigBindGestureTarget(unsafe, 'raster');
assert.equal(blocked.mode, 'blocked', 'a connected unsafe target never enters PRE_BIND');
assert.equal(blocked.ok, false);
model.clipAssets[0] = new ClipAssetModel(unsafe);
assert.equal(popup.getRigLensStaticBindGestureTarget('asset', 'raster').ok, false);
assert.equal(popup.beginRigLensStaticBoneGesture('asset', 'raster', 'root', { x: 18, y: 20 }).ok, false);
assert.equal(popup.getRigLensStaticEditTarget('asset', 'raster').ok, false,
    'the gesture permission does not unlock structure editing');

console.log('PASS: PRE_BIND Move/Rotate, CAF History, Undo/Redo, cancel, zero generator calls, and unsafe block');
