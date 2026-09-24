import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    inspectStaticRigAuthoringTarget,
    planStaticRigBone,
    planStaticRigStructureBone,
    resolveStaticRigRootCenter
} from '../system/animation/rig-static-authoring.js';

globalThis.window = globalThis.window || {};
const { TimelineModel, ClipAssetModel } = await import('../system/animation/animation-data-model.js');
const { evaluateRigidBones } = await import('../system/animation/part-rig.js');
const { HistoryManager } = await import('../system/history.js');

const makeModel = () => new TimelineModel({
    totalFrames: 4,
    clipAssets: [{ id: 'asset', internalLayers: [{ id: 'raster', type: 'raster', name: 'Art' }] }],
    tracks: [{ id: 'lane', cels: [{ id: 'clip', assetId: 'asset', startFrame: 0, duration: 4 }] }]
});
const model = makeModel();
const asset = model.getClipAsset('asset');
const clip = model.findClipEntry('clip').clip;
assert.deepEqual(resolveStaticRigRootCenter({ x: 8, y: 10, width: 20, height: 30 }), {
    ok: true, reason: '', point: { x: 18, y: 25 }
}, 'the direct Root point is the selected Artwork Bounds center');
assert.equal(resolveStaticRigRootCenter({ x: 0, y: 0, width: 0, height: 10 }).ok, false,
    'empty Artwork Bounds cannot place a Root');
const before = JSON.stringify(asset.serialize());
assert.equal(inspectStaticRigAuthoringTarget(asset, 'raster').ok, true);
assert.equal(planStaticRigBone(asset, 'raster', { kind: 'child', end: { x: 20, y: 20 } }).ok, false);
assert.equal(planStaticRigBone(asset, 'raster', {
    kind: 'root', start: { x: -1e308, y: 0 }, end: { x: 1e308, y: 0 }
}).ok, false, 'overflowed length is rejected before mutation');
assert.equal(JSON.stringify(asset.serialize()), before, 'cancel before commit leaves Asset unchanged');

const structureModel = makeModel();
const structureAsset = structureModel.getClipAsset('asset');
function registerStructureBone(options, boneId, name = options.name) {
    const registration = { ...options, boneId, name };
    return structureModel.registerClipAssetRasterBone('asset', 'raster', registration);
}
const structureRootPlan = planStaticRigStructureBone(structureAsset, 'raster', {
    kind: 'root', name: ' Pelvis ', rootPoint: { x: 84, y: 96 }
});
assert.equal(structureRootPlan.ok, true, 'a structure-first Root gets a valid provisional Bind transform');
assert.equal(structureRootPlan.options.name, 'Pelvis');
assert.equal(structureRootPlan.options.parentBoneId, null);
assert.deepEqual(
    [structureRootPlan.options.bindTransform.x, structureRootPlan.options.bindTransform.y], [84, 96]
);
assert.ok(Number.isFinite(structureRootPlan.options.length) && structureRootPlan.options.length > 0);
assert.equal(planStaticRigStructureBone(structureAsset, 'raster', {
    kind: 'root', rootPoint: { x: Number.NaN, y: 0 }
}).ok, false, 'invalid root coordinates are refused');
assert.equal(registerStructureBone(structureRootPlan.options, 'structure-root').ok, true);
assert.equal(planStaticRigStructureBone(structureAsset, 'raster', {
    kind: 'root', rootPoint: { x: 0, y: 0 }
}).ok, false, 'the single-root model refuses a second Root');
const structureChild = parentBoneId => planStaticRigStructureBone(
    structureAsset, 'raster', { kind: 'child', name: 'Torso', parentBoneId }
);
const torsoPlan = structureChild('structure-root');
assert.equal(torsoPlan.ok, true);
assert.equal(torsoPlan.options.parentBoneId, 'structure-root');
assert.equal(registerStructureBone(torsoPlan.options, 'torso').ok, true);
const leftLegPlan = structureChild('structure-root');
const rightLegPlan = structureChild('structure-root');
assert.equal(leftLegPlan.ok && rightLegPlan.ok, true);
assert.equal(registerStructureBone(leftLegPlan.options, 'left-leg', 'Left leg').ok, true);
assert.equal(registerStructureBone(rightLegPlan.options, 'right-leg', 'Right leg').ok, true);
assert.deepEqual(structureAsset.rigDefinition.bones.map(bone => [bone.boneId, bone.parentBoneId]), [
    ['structure-root', null], ['torso', 'structure-root'],
    ['left-leg', 'structure-root'], ['right-leg', 'structure-root']
], 'siblings share the selected parent in the existing Bone hierarchy');
assert.equal(evaluateRigidBones(structureAsset, null, 0).ok, true,
    'valid provisional Bind transforms remain evaluable before Artwork binding');
assert.equal(structureModel.findClipEntry('clip').clip.rigMotion, null,
    'structure-first authoring does not create a Motion KEY');
const restoredStructure = new TimelineModel(structureModel.serialize())
    .getClipAsset('asset').rigDefinition.bones;
assert.deepEqual(restoredStructure.map(bone => [bone.boneId, bone.parentBoneId]),
    structureAsset.rigDefinition.bones.map(bone => [bone.boneId, bone.parentBoneId]),
    'structure-first Bone identity and parentage survive Project serialization');

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
assert.match(source, /createRigLensStaticStructureBone[\s\S]*?planStaticRigStructureBone[\s\S]*?registerInternalRasterBoneFromExternal/u,
    'structure-first registration delegates through the existing CAF Asset/History owner');

const branchingModel = makeModel();
const branchingAsset = branchingModel.getClipAsset('asset');
const rootPlan = planStaticRigBone(branchingAsset, 'raster', {
    kind: 'root', start: { x: 0, y: 0 }, end: { x: 0, y: 0 }
});
assert.equal(rootPlan.ok, true);
assert.equal(branchingModel.registerClipAssetRasterBone('asset', 'raster', {
    ...rootPlan.options, boneId: 'root'
}).ok, true);
const addChild = (boneId, parentBoneId, end) => {
    const plan = planStaticRigBone(branchingAsset, 'raster', {
        kind: 'child', parentBoneId, end
    });
    assert.equal(plan.ok, true, `${boneId} is valid from selected parent ${parentBoneId}`);
    const registered = branchingModel.registerClipAssetRasterBone('asset', 'raster', {
        ...plan.options, boneId
    });
    assert.equal(registered.ok, true);
    assert.equal(registered.bone.parentBoneId, parentBoneId);
    return registered.bone;
};
addChild('torso', 'root', { x: 0, y: -96 });
addChild('right-arm', 'torso', { x: 24, y: -96 });
addChild('left-arm', 'torso', { x: -24, y: -96 });
addChild('leg', 'root', { x: 24, y: 0 });
assert.equal(branchingAsset.rigDefinition.bones.length, 5,
    'static authoring permits a branched structure beyond the former three-Bone setup cap');
assert.equal(planStaticRigBone(branchingAsset, 'raster', {
    kind: 'child', end: { x: 30, y: -100 }
}).ok, false, 'after several Bones, a parent must be explicitly selected');

const beforeReparent = evaluateRigidBones(branchingAsset, null, 0);
assert.equal(beforeReparent.ok, true);
const oldArmWorld = beforeReparent.poseByBoneId.get('left-arm').worldMatrix;
const reparent = branchingModel.setClipAssetRigBoneParent('asset', 'left-arm', 'root');
assert.equal(reparent.ok, true);
assert.equal(reparent.bone.parentBoneId, 'root');
const afterReparent = evaluateRigidBones(branchingAsset, null, 0);
const newArmWorld = afterReparent.poseByBoneId.get('left-arm').worldMatrix;
for (const field of ['a', 'b', 'c', 'd', 'tx', 'ty']) {
    assert.ok(Math.abs(oldArmWorld[field] - newArmWorld[field]) < 1e-8,
        `safe reparent preserves Bind world matrix field ${field}`);
}
assert.equal(branchingModel.setClipAssetRigBoneParent('asset', 'left-arm', 'left-arm').ok, false,
    'self-parenting is refused');
assert.equal(branchingModel.setClipAssetRigBoneParent('asset', 'torso', 'right-arm').reason, 'bone-cycle',
    'a descendant cannot be made the parent');
assert.equal(branchingModel.setClipAssetRigBoneParent('asset', 'left-arm', 'missing').ok, false,
    'a missing parent is refused');

const beforeRootMove = evaluateRigidBones(branchingAsset, null, 0).poseByBoneId.get('right-arm').worldMatrix;
const rootMove = branchingModel.setClipAssetRigBoneBindTransform('asset', 'root', { x: 15, y: 7 });
assert.equal(rootMove.ok, true);
const afterRootMove = evaluateRigidBones(branchingAsset, null, 0).poseByBoneId.get('right-arm').worldMatrix;
assert.ok(Math.abs(afterRootMove.tx - beforeRootMove.tx - 15) < 1e-8);
assert.ok(Math.abs(afterRootMove.ty - beforeRootMove.ty - 7) < 1e-8,
    'moving a parent carries descendant Bind poses without rewriting child IDs or parents');
assert.equal(branchingModel.findClipEntry('clip').clip.rigMotion, null,
    'static authoring does not create Frame-local Motion KEYs');
const revisitedBranches = new TimelineModel(branchingModel.serialize())
    .getClipAsset('asset').rigDefinition.bones;
assert.deepEqual(revisitedBranches.map(bone => [bone.boneId, bone.parentBoneId]), [
    ['root', null], ['torso', 'root'], ['right-arm', 'torso'], ['left-arm', 'root'], ['leg', 'root']
], 'Project save/revisit preserves Bone identity and branched parent links');
assert.deepEqual(revisitedBranches.map(bone => bone.bindTransform),
    branchingAsset.rigDefinition.bones.map(bone => bone.bindTransform),
    'Project save/revisit preserves edited Bind locations');

const rootMethodStart = source.indexOf('createRigLensStaticRootAtArtworkCenter(');
const rootMethodEnd = source.indexOf('generateRigLensArtworkBinding(', rootMethodStart);
assert.match(source.slice(rootMethodStart, rootMethodEnd),
    /resolveStaticRigRootCenter[\s\S]*?_getDrawingSnapshotContentBounds[\s\S]*?registerRigLensStaticBone/u,
    'direct Root creation uses selected Raster content bounds and existing registration');
assert.match(source, /getRigLensStaticEditTarget[\s\S]*?_hasRigLensBoneMotionKeys[\s\S]*?boneTracks/u,
    'static structure edits are guarded when existing Bone Motion KEYs are present');
assert.match(source, /finishRigLensStaticBoneGesture[\s\S]*?_recordInternalLayerHistory/u,
    'a static Bind drag uses one existing CAF Asset History boundary');
assert.match(source, /setRigLensStaticBoneParent[\s\S]*?setClipAssetRigBoneParent[\s\S]*?_recordInternalLayerHistory/u,
    'new Workspace reparenting uses the existing world-preserving model mutator and History owner');
console.log('PASS: centered Root, branched Bone authoring, safe reparent, Bind movement, key/binding guards, serialization, and CAF History route');
