import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    inspectStaticRigAuthoringTarget,
    planStaticRigBone,
    planStaticRigInitialBoneLayout,
    planStaticRigStructureBone,
    resolveStaticRigRootCenter
} from '../system/animation/rig-static-authoring.js';
import { applyTransformMatrix } from '../system/transform-math.js';

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

// A named, three-level hierarchy lays out only the Bones created in the current setup pass.
const layoutModel = makeModel();
const layoutAsset = layoutModel.getClipAsset('asset');
const layoutRoot = planStaticRigStructureBone(layoutAsset, 'raster', {
    kind: 'root', name: '体', rootPoint: { x: 200, y: 200 }
});
assert.equal(layoutRoot.ok, true);
assert.equal(layoutModel.registerClipAssetRasterBone('asset', 'raster', {
    ...layoutRoot.options, boneId: 'body'
}).ok, true);
const layoutChildren = [
    ['head', '頭', 'body'], ['left-arm', '左腕', 'body'],
    ['right-arm', '右腕', 'body'], ['left-leg', '左脚', 'body'],
    ['right-leg', '右脚', 'body'], ['left-hand', '左手', 'left-arm'],
    ['right-hand', '右手', 'right-arm'], ['left-foot', '左足', 'left-leg'],
    ['right-foot', '右足', 'right-leg']
];
for (const [boneId, name, parentBoneId] of layoutChildren) {
    const plan = planStaticRigStructureBone(layoutAsset, 'raster', {
        kind: 'child', name, parentBoneId
    });
    assert.equal(plan.ok, true, `${name} has an existing parent Bone`);
    assert.equal(layoutModel.registerClipAssetRasterBone('asset', 'raster', {
        ...plan.options, boneId
    }).ok, true, `${name} registers through the existing CAF Bone model`);
}
const layoutExistingRoot = structuredClone(layoutAsset.rigDefinition.bones[0]);
const layoutBefore = structuredClone(layoutAsset.rigDefinition.bones);
const newLayoutIds = layoutChildren.map(([boneId]) => boneId);
const initialLayout = planStaticRigInitialBoneLayout(layoutAsset, 'raster', {
    boneIds: newLayoutIds,
    artworkBounds: { x: 150, y: 160, width: 100, height: 80 },
    canvasWidth: 400,
    canvasHeight: 400
});
assert.equal(initialLayout.ok, true, initialLayout.reason);
assert.equal(initialLayout.fanSpread, Math.PI * 0.5,
    'the default fitting candidate gives five direct branches enough angular separation');
assert.ok(initialLayout.updates.length > 0);
assert.ok(initialLayout.updates.every(update => newLayoutIds.includes(update.boneId)),
    'only newly created Bones receive initial Bind rotation updates');
assert.equal(initialLayout.updates.some(update => update.boneId === 'body'), false,
    'the pre-existing Root is not part of this initial layout transaction');
assert.deepEqual(layoutAsset.rigDefinition.bones[0], layoutExistingRoot,
    'layout planning never changes the pre-existing Root or its Bind placement');
assert.deepEqual(layoutAsset.rigDefinition.bones, layoutBefore,
    'layout planning is a pure proposal before the existing CAF History owner applies it');
const allBonesAsNew = planStaticRigInitialBoneLayout({
    ...layoutAsset,
    rigDefinition: { ...layoutAsset.rigDefinition, bones: layoutBefore }
}, 'raster', {
    boneIds: layoutBefore.map(bone => bone.boneId),
    artworkBounds: { x: 50, y: 50, width: 100, height: 100 },
    canvasWidth: 400,
    canvasHeight: 400
});
assert.equal(allBonesAsNew.ok, true, allBonesAsNew.reason);
assert.ok(allBonesAsNew.updates.some(update => update.boneId === 'body'),
    'a newly created Root receives the selected artwork-to-Canvas orientation');
assert.ok(Math.abs(allBonesAsNew.rootRotation - Math.PI / 4) < 1e-10,
    'a new Root initially directs the tree toward the Canvas interior');
for (const update of initialLayout.updates) {
    const original = layoutBefore.find(bone => bone.boneId === update.boneId);
    assert.deepEqual(Object.keys(update.bindTransform), ['rotation'],
        'layout changes only the existing Bind direction field');
    assert.ok(original, 'each proposed layout update names an existing Bone');
}
for (const update of initialLayout.updates) {
    assert.equal(layoutModel.setClipAssetRigBoneBindTransform('asset', update.boneId, update.bindTransform).ok, true);
    const original = layoutBefore.find(bone => bone.boneId === update.boneId);
    const updated = layoutAsset.rigDefinition.bones.find(bone => bone.boneId === update.boneId);
    for (const field of ['x', 'y', 'scaleX', 'scaleY', 'pivotX', 'pivotY']) {
        assert.equal(updated.bindTransform[field], original.bindTransform[field],
            `initial layout preserves existing Bind ${field}`);
    }
    assert.equal(updated.length, original.length);
    assert.equal(updated.parentBoneId, original.parentBoneId);
    assert.equal(updated.name, original.name);
}
const laidOut = evaluateRigidBones(layoutAsset, null, 0);
assert.equal(laidOut.ok, true);
const endpoints = new Map(layoutAsset.rigDefinition.bones.map(bone => {
    const world = laidOut.poseByBoneId.get(bone.boneId).worldMatrix;
    return [bone.boneId, {
        head: applyTransformMatrix(world, 0, 0),
        tail: applyTransformMatrix(world, bone.length, 0)
    }];
}));
for (const bone of layoutAsset.rigDefinition.bones) {
    const { head, tail } = endpoints.get(bone.boneId);
    for (const point of [head, tail]) {
        assert.ok(point.x >= 0 && point.x <= 400 && point.y >= 0 && point.y <= 400,
            `${bone.name} remains inside the persisted Canvas coordinate bounds`);
    }
    if (bone.parentBoneId) {
        const parentTail = endpoints.get(bone.parentBoneId).tail;
        assert.ok(Math.hypot(head.x - parentTail.x, head.y - parentTail.y) < 1e-7,
            `${bone.name} remains joined to its existing parent`);
    }
}
const rootChildren = layoutAsset.rigDefinition.bones.filter(bone => bone.parentBoneId === 'body');
const rootChildTails = rootChildren.map(bone => endpoints.get(bone.boneId).tail);
const rootChildLabelAnchors = rootChildren.map(bone => {
    const { head, tail } = endpoints.get(bone.boneId);
    const dx = tail.x - head.x;
    const dy = tail.y - head.y;
    const length = Math.hypot(dx, dy) || 1;
    const fraction = Math.min(0.8, Math.max(0.66, 28 / length));
    return {
        x: head.x + dx * fraction - dy / length * 6,
        y: head.y + dy * fraction + dx / length * 6
    };
});
for (let first = 0; first < rootChildTails.length; first += 1) {
    for (let second = first + 1; second < rootChildTails.length; second += 1) {
        assert.ok(Math.hypot(rootChildTails[first].x - rootChildTails[second].x,
            rootChildTails[first].y - rootChildTails[second].y) > 1,
        'siblings fan out instead of overlapping');
        assert.ok(Math.hypot(rootChildLabelAnchors[first].x - rootChildLabelAnchors[second].x,
            rootChildLabelAnchors[first].y - rootChildLabelAnchors[second].y) > 20,
        'sibling name anchors remain separated enough for short Japanese bone names');
    }
}
const leftArmVector = {
    x: endpoints.get('left-arm').tail.x - endpoints.get('left-arm').head.x,
    y: endpoints.get('left-arm').tail.y - endpoints.get('left-arm').head.y
};
const leftHandVector = {
    x: endpoints.get('left-hand').tail.x - endpoints.get('left-hand').head.x,
    y: endpoints.get('left-hand').tail.y - endpoints.get('left-hand').head.y
};
assert.ok(leftArmVector.x * leftHandVector.x + leftArmVector.y * leftHandVector.y > 0,
    'a grandchild extends along its selected parent branch');
const renameBefore = structuredClone(layoutAsset.rigDefinition.bones.find(bone => bone.boneId === 'left-arm'));
assert.equal(layoutModel.setClipAssetRigBoneName('asset', 'left-arm', '左腕・上').changed, true);
assert.deepEqual(
    layoutAsset.rigDefinition.bones.find(bone => bone.boneId === 'left-arm'),
    { ...renameBefore, name: '左腕・上' },
    'renaming changes the display name only, not Bone ID, parent, or Bind placement'
);
assert.equal(layoutModel.setClipAssetRigBoneName('asset', 'left-arm', '   ').ok, false,
    'empty display names are refused');
const savedLayout = new TimelineModel(layoutModel.serialize()).getClipAsset('asset').rigDefinition.bones;
assert.deepEqual(savedLayout.map(bone => [bone.boneId, bone.name, bone.parentBoneId]),
    layoutAsset.rigDefinition.bones.map(bone => [bone.boneId, bone.name, bone.parentBoneId]),
    'Project round-trip preserves stable Bone IDs, names, and parent links');
assert.deepEqual(savedLayout.map(bone => bone.bindTransform),
    layoutAsset.rigDefinition.bones.map(bone => bone.bindTransform),
    'Project round-trip preserves existing Bind coordinates and new layout directions');
assert.equal(layoutModel.findClipEntry('clip').clip.rigMotion, null,
    'static initial layout and naming do not create Motion KEY data');

const tooSmallModel = makeModel();
const tooSmallAsset = tooSmallModel.getClipAsset('asset');
const tooSmallRoot = planStaticRigStructureBone(tooSmallAsset, 'raster', {
    kind: 'root', name: '体', rootPoint: { x: 30, y: 30 }
});
assert.equal(tooSmallModel.registerClipAssetRasterBone('asset', 'raster', {
    ...tooSmallRoot.options, boneId: 'body'
}).ok, true);
for (const [boneId, parentBoneId] of [['a', 'body'], ['b', 'a'], ['c', 'b']]) {
    const plan = planStaticRigStructureBone(tooSmallAsset, 'raster', {
        kind: 'child', name: boneId, parentBoneId
    });
    assert.equal(tooSmallModel.registerClipAssetRasterBone('asset', 'raster', {
        ...plan.options, boneId
    }).ok, true);
}
const tooSmallBefore = JSON.stringify(tooSmallAsset.serialize());
const rejectedLayout = planStaticRigInitialBoneLayout(tooSmallAsset, 'raster', {
    boneIds: ['body', 'a', 'b', 'c'],
    artworkBounds: { x: 20, y: 20, width: 20, height: 20 },
    canvasWidth: 60,
    canvasHeight: 60
});
assert.equal(rejectedLayout.ok, false, 'a skeleton that cannot fit is rejected instead of placed off Canvas');
assert.equal(JSON.stringify(tooSmallAsset.serialize()), tooSmallBefore,
    'a rejected layout never mutates the saved Bind model');

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
assert.match(source, /applyRigLensStaticInitialLayout\(assetId, layerId, boneIds = \[\]\)[\s\S]*?planStaticRigInitialBoneLayout[\s\S]*?setClipAssetRigBoneBindTransform[\s\S]*?_recordInternalLayerHistoryFromStates/u,
    'the full initial Bind layout is applied as one existing CAF Asset History transaction');

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
