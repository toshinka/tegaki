import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspectStaticRigAuthoringTarget, planStaticRigBone } from '../system/animation/rig-static-authoring.js';

globalThis.window = globalThis.window || {};
const { TimelineModel, ClipAssetModel } = await import('../system/animation/animation-data-model.js');
const { HistoryManager } = await import('../system/history.js');

const makeModel = () => new TimelineModel({
    totalFrames: 4,
    clipAssets: [{ id: 'asset', internalLayers: [{ id: 'raster', type: 'raster', name: 'Art' }] }],
    tracks: [{ id: 'lane', cels: [{ id: 'clip', assetId: 'asset', startFrame: 0, duration: 4 }] }]
});
const model = makeModel();
const asset = model.getClipAsset('asset');
const clip = model.findClipEntry('clip').clip;
const before = JSON.stringify(asset.serialize());
assert.equal(inspectStaticRigAuthoringTarget(asset, 'raster').ok, true);
assert.equal(planStaticRigBone(asset, 'raster', { kind: 'child', end: { x: 20, y: 20 } }).ok, false);
assert.equal(planStaticRigBone(asset, 'raster', {
    kind: 'root', start: { x: -1e308, y: 0 }, end: { x: 1e308, y: 0 }
}).ok, false, 'overflowed length is rejected before mutation');
assert.equal(JSON.stringify(asset.serialize()), before, 'cancel before commit leaves Asset unchanged');

const root = planStaticRigBone(asset, 'raster', {
    kind: 'root', start: { x: 10, y: 20 }, end: { x: 10, y: 20 }
});
assert.equal(root.ok, true);
assert.equal(root.options.length, 48);
const registeredRoot = model.registerClipAssetRasterBone('asset', 'raster', {
    ...root.options, boneId: 'root'
});
assert.equal(registeredRoot.ok, true);
assert.equal(registeredRoot.bone.parentBoneId, null);
const afterRoot = asset.serialize();

const child = planStaticRigBone(asset, 'raster', {
    kind: 'child', end: { x: 30, y: -28 }
});
assert.equal(child.ok, true);
assert.equal(child.options.parentBoneId, 'root');
assert.ok(child.options.length >= 4);
const registeredChild = model.registerClipAssetRasterBone('asset', 'raster', {
    ...child.options, boneId: 'child'
});
assert.equal(registeredChild.ok, true);
assert.equal(registeredChild.bone.parentBoneId, 'root');
assert.equal(asset.rigDefinition.bones.length, 2);
assert.equal(planStaticRigBone(asset, 'raster', { kind: 'child', end: { x: 40, y: -28 } }).ok, false);
assert.equal(clip.rigMotion, null, 'static authoring does not create Frame-local motion');
assert.equal(clip.transformKeyframes?.length || 0, 0, 'static authoring does not create KEY');
assert.equal(asset.meshDefinitions?.length || 0, 0);
assert.equal(asset.skinBindings?.length || 0, 0);
assert.equal(asset.rigDefinition.parts.length, 0);
assert.equal(asset.rigDefinition.rigidBindings?.length || 0, 0);

const restored = new TimelineModel(model.serialize());
const restoredBones = restored.getClipAsset('asset').rigDefinition.bones;
assert.deepEqual(restoredBones.map(bone => [bone.boneId, bone.parentBoneId]),
    [['root', null], ['child', 'root']], 'save/revisit preserves identity and hierarchy');
assert.deepEqual(restoredBones.map(bone => bone.bindTransform), asset.rigDefinition.bones.map(bone => bone.bindTransform));
assert.deepEqual(afterRoot.rigDefinition.bones.map(bone => bone.boneId), ['root'],
    'one creation boundary has only Root');

// The CAF owner records applied before/after Asset snapshots through History.record.
const afterChild = asset.serialize();
const history = new HistoryManager();
const restoreAsset = state => { model.clipAssets[0] = new ClipAssetModel(state); };
history.record({ name: 'root', do: () => restoreAsset(afterRoot), undo: () => restoreAsset(JSON.parse(before)) });
history.record({ name: 'child', do: () => restoreAsset(afterChild), undo: () => restoreAsset(afterRoot) });
assert.equal(history.stack.length, 2, 'one History entry per creation');
history.undo();
assert.deepEqual(model.getClipAsset('asset').rigDefinition.bones.map(bone => bone.boneId), ['root']);
history.undo();
assert.equal(model.getClipAsset('asset').rigDefinition, null);
history.redo();
history.redo();
assert.deepEqual(model.getClipAsset('asset').rigDefinition.bones.map(bone => bone.boneId), ['root', 'child']);

const multi = makeModel().getClipAsset('asset');
multi.internalLayers.push({ id: 'second', type: 'raster' });
assert.equal(inspectStaticRigAuthoringTarget(multi, 'raster').ok, true,
    'an explicitly selected direct Raster resolves within a multi-Raster CAF');
assert.equal(inspectStaticRigAuthoringTarget(multi, 'second').ok, true,
    'each direct Raster resolves by its stable internal Layer ID');
assert.equal(planStaticRigBone(multi, 'raster', {
    kind: 'root', start: { x: 12, y: 18 }, end: { x: 40, y: 18 }
}).ok, true, 'Root placement uses the selected Raster context without changing Asset-level Bone storage');
assert.equal(inspectStaticRigAuthoringTarget(multi, 'missing').ok, false,
    'an unresolved selected Raster is refused');
const nested = {
    ...multi,
    internalLayers: multi.internalLayers.map(layer => layer.id === 'second'
        ? { ...layer, parentLayerId: 'folder' } : layer)
};
assert.equal(inspectStaticRigAuthoringTarget(nested, 'second').ok, false,
    'nested Raster targets remain outside the initial DEFORM edit surface');
const partConflict = {
    ...multi,
    rigDefinition: { version: 1, parts: [{ partId: 'second' }], bones: [], rigidBindings: [] }
};
assert.equal(inspectStaticRigAuthoringTarget(partConflict, 'raster').ok, false,
    'existing PART ownership remains a DEFORM conflict');
assert.equal(inspectStaticRigAuthoringTarget(asset, 'wrong').ok, false);
const source = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '../ui/animation-table-popup.js'), 'utf8');
assert.match(source, /registerRigLensStaticBone[\s\S]*?registerInternalRasterBoneFromExternal/u,
    'RIG Lens commits through existing CAF Asset/History route');
assert.match(source, /registerInternalRasterBoneFromExternal[\s\S]*?_recordInternalLayerHistory\(asset, beforeState, 'caf-raster-bone-register'/u,
    'one existing CAF History command owns creation');
console.log('PASS: static Root/child model, guard, cancel, KEY isolation, serialization and existing History route');
