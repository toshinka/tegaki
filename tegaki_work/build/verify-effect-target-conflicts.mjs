/** WP-002: real model operation order, rejection atomicity and explicit WARP removal. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createWarpGridDeformer } from '../system/animation/warp-grid-deformer.js';
import { collectInternalLayerSubtreeIds, validateRigPartClippingBoundary } from '../system/animation/folder-part-render-plan.js';
import { TRANSFORM_EDIT_AUTHORITY } from '../system/animation/transform-edit-context.js';
import { TRANSFORM_EDIT_TRANSACTION_TARGET } from '../system/animation/transform-edit-transaction.js';

globalThis.window = { TEGAKI_CONFIG: { debug: false } };
const { TimelineModel } = await import('../system/animation/animation-data-model.js');
const { HistoryManager } = await import('../system/history.js');

const warp = () => createWarpGridDeformer({ bindBounds: { x: 0, y: 0, width: 16, height: 16 } });
const motion = id => [{ internalLayerId: id, pivotX: 0, pivotY: 0, keyframes: [{ frame: 0, x: 2 }] }];
function fixture(folder = false) {
    const model = new TimelineModel({
        clipAssets: [{ id: 'asset', internalLayers: [
            ...(folder ? [{ id: 'folder', type: 'folder' }, { id: 'nested', type: 'folder', parentLayerId: 'folder' }] : []),
            { id: 'raster', type: 'raster', parentLayerId: folder ? 'nested' : null },
            { id: 'other', type: 'raster' }
        ] }, { id: 'unrelated', internalLayers: [{ id: 'elsewhere', type: 'raster' }] }],
        tracks: [{ id: 'lane', cels: [
            { id: 'clip', assetId: 'asset', duration: 8 },
            { id: 'shared', assetId: 'asset', startFrame: 8, duration: 8 },
            { id: 'unrelated-clip', assetId: 'unrelated', duration: 8 }
        ] }]
    });
    return model;
}
function rejectUnchanged(model, action, reason) {
    const before = model.serialize();
    const result = action();
    assert.equal(result.ok, false, `must reject ${reason}`);
    assert.equal(result.reason, reason);
    assert.deepEqual(model.serialize(), before, 'rejection must not mutate any Asset/Clip/timestamp');
    return result;
}
function roundTrip(model) {
    const saved = model.serialize();
    assert.deepEqual(new TimelineModel(saved).serialize(), saved);
}
const effects = {
    warp: { set: (m, clip, id) => m.setClipLayerDeformer(clip, id, warp()), reason: 'layer-deformer-conflict' },
    motion: { set: (m, clip, id) => m.setClipLayerTransformTracks(clip, motion(id)), reason: 'layer-transform-conflict' }
};
for (const [name, effect] of Object.entries(effects)) {
    for (const folder of [false, true]) {
        for (const clip of ['clip', 'shared']) {
            const model = fixture(folder);
            assert.equal(effect.set(model, clip, 'raster').ok, true);
            const result = rejectUnchanged(model,
                () => model.registerClipAssetRigPart('asset', folder ? 'folder' : 'raster'), effect.reason);
            assert.equal(result.clipId, clip);
            assert.equal(result.internalLayerId, 'raster');
            assert.equal(model.registerClipAssetRigPart('unrelated', 'elsewhere').ok, true);
            roundTrip(model);
        }
        const reverse = fixture(folder);
        assert.equal(reverse.registerClipAssetRigPart('asset', folder ? 'folder' : 'raster').ok, true);
        rejectUnchanged(reverse, () => effect.set(reverse, 'clip', 'raster'), 'rig-part-layer-unsupported');
        assert.equal(effect.set(reverse, 'clip', 'other').ok, true);
        roundTrip(reverse);
    }
    // Mesh generation checks all referring Clips before it creates topology/IDs.
    const mesh = fixture();
    assert.equal(effect.set(mesh, 'shared', 'raster').ok, true);
    rejectUnchanged(mesh, () => mesh.generateClipAssetRasterBoneSetup('asset', 'raster'), effect.reason);
    const meshFirst = fixture();
    meshFirst.getClipAsset('asset').meshDefinitions = [{ meshId: 'mesh', targetInternalLayerId: 'raster' }];
    rejectUnchanged(meshFirst, () => effect.set(meshFirst, 'clip', 'raster'), 'mesh-layer-unsupported');

    // Both clipping owner and source, including inherited Folder clipping, are guarded.
    for (const target of ['raster', 'other']) {
        const clipModel = fixture();
        assert.equal(effect.set(clipModel, 'shared', target).ok, true);
        rejectUnchanged(clipModel, () => clipModel.toggleClipAssetInternalLayerClipping('asset', 'raster'), effect.reason);
        const clippingFirst = fixture();
        assert.equal(clippingFirst.toggleClipAssetInternalLayerClipping('asset', 'raster').ok, true);
        rejectUnchanged(clippingFirst, () => effect.set(clippingFirst, 'clip', target), 'internal-clipping-unsupported');
    }
    const inherited = fixture(true);
    assert.equal(inherited.toggleClipAssetInternalLayerClipping('asset', 'folder').ok, true);
    rejectUnchanged(inherited, () => effect.set(inherited, 'clip', 'raster'), 'internal-clipping-unsupported');
    console.log(`effect order: ${name}, direct/Folder/shared Rig, Mesh, clipping owner/source OK`);
}

// Deliberately corrupt old fixture: retain conflicting Rig/Motion and remove WARP only.
const legacy = fixture();
assert.equal(legacy.setClipLayerDeformer('clip', 'raster', warp()).ok, true);
assert.equal(legacy.setClipLayerDeformer('clip', 'other', warp()).ok, true);
legacy.getClipAsset('asset').rigDefinition = { version: 1, parts: [{ partId: 'raster' }], bones: [], rigidBindings: [] };
const clip = legacy.findClipEntry('clip').clip;
clip.layerTransformTracks = motion('raster');
const setup = structuredClone(legacy.getClipAsset('asset').rigDefinition);
const tracks = structuredClone(clip.layerTransformTracks);
const other = structuredClone(clip.layerDeformers.targets.find(t => t.internalLayerId === 'other'));
assert.equal(legacy.removeClipLayerDeformer('clip', 'raster').ok, true);
assert.deepEqual(clip.layerDeformers.targets, [other]);
assert.deepEqual(clip.layerTransformTracks, tracks);
assert.deepEqual(legacy.getClipAsset('asset').rigDefinition, setup);
assert.equal(legacy.removeClipLayerDeformer('clip', 'raster').ok, true, 'repeat removal stays safe');
assert.equal(legacy.setClipLayerTransformTracks('clip', []).ok, true, 'Motion removal also resolves conflict');
roundTrip(fixture());

// Execute production caller methods without mounting Pixi/DOM. Only host services are mocked.
const popupSource = readFileSync(new URL('../ui/animation-table-popup.js', import.meta.url), 'utf8');
function method(name, nextName, dependencies = {}) {
    const start = popupSource.indexOf(`\n    ${name}(`);
    const end = popupSource.indexOf(`\n    ${nextName}(`, start + 1);
    assert(start >= 0 && end > start);
    return new Function(...Object.keys(dependencies), `return ({${popupSource.slice(start, end)}}).${name};`)(...Object.values(dependencies));
}
const register = method('registerInternalRigPartFromExternal', 'registerInternalFolderPartFromExternal', {
    collectInternalLayerSubtreeIds, validateRigPartClippingBoundary
});
const callerHistory = new HistoryManager();
const caller = {
    model: fixture(),
    _captureInternalLayerHistoryState() { return this.model.serialize(); },
    _invalidateSnapshotTextureCache() {},
    _recordInternalLayerHistory(asset, before, name) {
        const after = this.model.serialize();
        callerHistory.record({ name,
            do: () => { this.model = new TimelineModel(after); },
            undo: () => { this.model = new TimelineModel(before); }
        });
    }
};
assert.equal(caller.model.setClipLayerDeformer('shared', 'raster', warp()).ok, true);
const beforeRefusal = caller.model.serialize();
assert.equal(register.call(caller, 'asset', 'raster', { deferUi: true }).ok, false);
assert.equal(callerHistory.stack.length, 0, 'real caller must not record rejected model operation');
assert.deepEqual(caller.model.serialize(), beforeRefusal);
assert.equal(caller.model.removeClipLayerDeformer('shared', 'raster').ok, true);
const beforeRegister = caller.model.serialize();
assert.equal(register.call(caller, 'asset', 'raster', { deferUi: true }).ok, true);
const afterRegister = caller.model.serialize();
assert.equal(callerHistory.stack.length, 1);
callerHistory.undo();
assert.deepEqual(caller.model.serialize(), beforeRegister);
callerHistory.redo();
assert.deepEqual(caller.model.serialize(), afterRegister);

const context = { authority: TRANSFORM_EDIT_AUTHORITY.CLIP_LAYER_TRANSFORM_KEY, clipId: 'clip', internalLayerId: 'raster' };
const startBridge = method('_projectLayerTransformBridgeStart', '_beginLayerTransformBridge', { TRANSFORM_EDIT_AUTHORITY });
const blockedHost = { model: caller.model, getTransformEditContext: () => context };
assert.equal(startBridge.call(blockedHost, { layerId: 'working' }).reason, 'rig-part-layer-unsupported');
const previewBridge = method('_previewLayerTransformBridge', '_finishLayerTransformBridge', {
    TRANSFORM_EDIT_TRANSACTION_TARGET,
    planTransformEditTransactionPreview: () => ({ ok: true })
});
const transaction = { target: TRANSFORM_EDIT_TRANSACTION_TARGET.CLIP_LAYER_TRANSFORM_KEY, clipId: 'clip', internalLayerId: 'raster' };
blockedHost._layerTransformBridgeSession = { transaction, previewApplied: false, changed: false };
const beforePreview = caller.model.serialize();
assert.equal(previewBridge.call(blockedHost, { transaction }).reason, 'rig-part-layer-unsupported');
assert.equal(blockedHost._layerTransformBridgeSession.invalidated, true);
assert.deepEqual(caller.model.serialize(), beforePreview);
assert.equal(callerHistory.stack.length, 1);

// Existing preview must be restored when a static conflict appears during the gesture.
blockedHost._restoreLayerTransformBridgePreview = method('_restoreLayerTransformBridgePreview', '_previewLayerTransformBridge', {
    TRANSFORM_EDIT_TRANSACTION_TARGET
});
transaction.baselineLayerTransformTracks = [];
caller.model.findClipEntry('clip').clip.layerTransformTracks = motion('raster');
blockedHost._layerTransformBridgeSession.previewApplied = true;
blockedHost._layerTransformBridgeSession.changed = true;
assert.equal(previewBridge.call(blockedHost, { transaction }).ok, false);
assert.deepEqual(caller.model.findClipEntry('clip').clip.layerTransformTracks, []);
assert.equal(blockedHost._layerTransformBridgeSession.changed, false);
assert.equal(blockedHost._layerTransformBridgeSession.previewApplied, false);

// A pre-existing unrelated clipping conflict must not veto another target's new clipping.
const unrelatedConflict = fixture();
const unrelatedAsset = unrelatedConflict.getClipAsset('asset');
unrelatedAsset.internalLayers.push({ id: 'new-owner', type: 'raster' }, { id: 'new-source', type: 'raster' });
unrelatedAsset.internalLayers[0].clipping = true;
unrelatedAsset.internalLayers[0].clippingMode = 'normal';
unrelatedConflict.findClipEntry('clip').clip.layerTransformTracks = motion('raster');
assert.equal(unrelatedConflict.toggleClipAssetInternalLayerClipping('asset', 'new-owner').ok, true);

console.log('verify-effect-target-conflicts: atomic rejection, unrelated targets, explicit removal and model round-trip OK');
