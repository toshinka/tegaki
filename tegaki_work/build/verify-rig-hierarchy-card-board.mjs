import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspectStaticRigAuthoringTarget, planStaticRigStructureBone } from '../system/animation/rig-static-authoring.js';

const buildRoot = path.dirname(fileURLToPath(import.meta.url));
const workRoot = path.dirname(buildRoot);
const read = relative => fs.readFileSync(path.join(workRoot, relative), 'utf8');
const frameSource = read('ui/right-workspace-frame.js');
const popupSource = read('ui/animation-table-popup.js');
const css = read('styles/components/layer-panel-surface.css');

assert.match(frameSource, /rigStructureAddBoneButton\.textContent = '＋ Bone'/u);
assert.match(frameSource, /kind === 'board'[\s\S]*?root\?\.boneId/u,
    'the board add action registers each initial card under the one existing Root');
assert.match(frameSource, /_getRigHierarchyCardTree\(bones\)[\s\S]*?parentBoneId[\s\S]*?number: parts\.join\('-'\)/u,
    'display numbers are derived from parent links and serialized Bone enumeration');
assert.match(frameSource, /serialized bones\[\] enumeration as sibling display order/u);
assert.match(frameSource, /card\.draggable = !isRoot/u);
assert.match(frameSource, /_onRigHierarchyCardDragOver[\s\S]*?is-drop-invalid[\s\S]*?_onRigHierarchyCardDrop/u);
assert.match(frameSource, /appendToSiblingEnd: true/u);
assert.doesNotMatch(frameSource, /rigStructureChildButton|rigStructureSiblingButton/u,
    'the board has no permanent child/sibling action column');
assert.match(popupSource, /setRigLensStaticBoneParent\(assetId, layerId, boneId, parentBoneId, options = \{\}\)[\s\S]*?appendToSiblingEnd/u,
    'the existing CAF parent/history adapter forwards array-order append without a new schema');
assert.match(css, /right-workspace-rig-structure-board-viewport[\s\S]*?overflow: auto/u);
assert.match(css, /right-workspace-rig-structure-editor \[hidden\][\s\S]*?display: none !important/u,
    'dialog buttons respect hidden state after being moved into the modal');
assert.match(css, /right-workspace-rig-hierarchy-card\.is-drop-target/u);
assert.match(css, /right-workspace-rig-hierarchy-card\.is-drop-invalid/u);
assert.match(frameSource, /right-workspace-rig-hierarchy-name-input/u,
    'the structure board exposes inline Bone-name editing');
assert.match(frameSource, /setRigLensStaticBoneName/u,
    'inline naming reaches the existing static CAF name adapter');
assert.match(popupSource, /setRigLensStaticBoneName\(assetId, layerId, boneId, name\)[\s\S]*?setClipAssetRigBoneName[\s\S]*?_recordInternalLayerHistory/u,
    'renaming uses the existing CAF Asset History owner');
const compactListStart = frameSource.indexOf('_renderRigCompactBoneList(container, bones)');
const compactListEnd = frameSource.indexOf('_renderRigBoneTree(container, bones', compactListStart);
const compactListSource = frameSource.slice(compactListStart, compactListEnd);
assert.match(compactListSource, /this\.rigSelectedBoneId === bone\.boneId/u);
assert.match(compactListSource, /button\.addEventListener\('click',[\s\S]*?_selectRigLensBone\(bone\.boneId\)/u,
    'the flat selector uses the existing selected Bone ID and Canvas selection path');
assert.match(compactListSource, /parentDetail[\s\S]*?placement[\s\S]*?action/u,
    'the selected Bone card projects parent, placement, and current Canvas action');
assert.match(frameSource, /_closeRigStructureEditor\(returnToCanvas\)[\s\S]*?pendingCreatedIds[\s\S]*?applyRigLensStaticInitialLayout/u,
    'returning from the board lays out only this-session unverified Bones');
assert.match(frameSource, /right-workspace-rig-parent-link/u);
assert.match(frameSource, /right-workspace-rig-bone-name-label/u);
assert.match(css, /right-workspace-rig-bone-tree--flat[\s\S]*?overflow: auto/u,
    'the right Workspace selector is flat and internally scrollable');
assert.match(css, /right-workspace-rig-hierarchy-name-input:focus-visible/u);

globalThis.window = globalThis.window || {};
const { TimelineModel } = await import('../system/animation/animation-data-model.js');
const { evaluateRigidBones, serializeRigDefinition } = await import('../system/animation/part-rig.js');
const { RightWorkspaceFrame } = await import('../ui/right-workspace-frame.js');

const model = new TimelineModel({
    totalFrames: 4,
    clipAssets: [{ id: 'asset', internalLayers: [{ id: 'raster', type: 'raster', name: 'Test art' }] }],
    tracks: [{ id: 'lane', cels: [{ id: 'clip', assetId: 'asset', startFrame: 0, duration: 4 }] }]
});
const asset = model.getClipAsset('asset');
const bind = (x, y = 12) => ({ x, y, scaleX: 1, scaleY: 1, rotation: 0, pivotX: 0, pivotY: 0 });
const register = (boneId, name, parentBoneId, x, length = 24) => model.registerClipAssetRasterBone(
    'asset', 'raster', { boneId, name, parentBoneId, bindTransform: bind(x), length }
);
assert.equal(register('root', 'Root', null, 10, 40).ok, true);

const addFrame = Object.create(RightWorkspaceFrame.prototype);
Object.assign(addFrame, {
    rigLensActive: true,
    rigAuthoringKind: 'deform',
    rigLensMode: 'setup',
    rigLensTarget: { assetId: 'asset', internalLayerId: 'raster' },
    rigSelectedBoneId: 'root',
    rigPlacementVerifiedBoneIds: new Set(),
    rigTreeCollapsedBoneIds: new Set(),
    rigStructureNameInput: { value: 'Bone 1' },
    rigStructureStatus: { textContent: '' },
    rigEntryMessage: '',
    rigPointerGesture: null,
    rigPlacementMode: null,
    rigStructureCreatedBoneIds: new Set(),
    rigStructureDrag: null,
    rigStructureEditorTree: { querySelectorAll: () => [] },
    sync() {}
});
addFrame._getRigLensEditTarget = () => inspectStaticRigAuthoringTarget(asset, 'raster');
addFrame._getRigLensTable = () => ({
    createRigLensStaticStructureBone: (_assetId, layerId, options) => {
        const plan = planStaticRigStructureBone(asset, layerId, options);
        if (!plan.ok) return plan;
        const nextId = `card-${asset.rigDefinition.bones.length}`;
        return model.registerClipAssetRasterBone('asset', layerId, {
            ...plan.options,
            boneId: nextId
        });
    }
});

for (let index = 1; index <= 6; index += 1) {
    assert.equal(addFrame._createRigLensStructureBone('board'), true,
        `＋ Bone creates initial card ${index}`);
}
const initialBones = asset.rigDefinition.bones;
assert.equal(initialBones.filter(bone => bone.parentBoneId == null).length, 1,
    'six initial cards do not create additional model Roots');
assert.deepEqual(initialBones.slice(1).map(bone => bone.parentBoneId), Array(6).fill('root'));
assert.deepEqual(initialBones.slice(1).map(bone => bone.name), [
    'Bone 1', 'Bone 2', 'Bone 3', 'Bone 4', 'Bone 5', 'Bone 6'
], 'names remain independent of hierarchy numbers');
assert.equal(model.findClipEntry('clip').clip.rigMotion, null);
assert.equal(asset.meshDefinitions?.length || 0, 0);
assert.equal(asset.skinBindings?.length || 0, 0);

const projection = addFrame._getRigHierarchyCardTree(initialBones);
assert.equal(projection.root.boneId, 'root');
assert.deepEqual(projection.children.map(item => item.number), ['1', '2', '3', '4', '5', '6']);
assert.deepEqual(projection.children.map(item => item.bone.boneId), initialBones.slice(1).map(bone => bone.boneId));

const card1 = initialBones[1].boneId;
const card2 = initialBones[2].boneId;
const card3 = initialBones[3].boneId;
const card4 = initialBones[4].boneId;
const beforeMoveWorld = evaluateRigidBones(asset, null, 0);
const beforeCard2World = beforeMoveWorld.poseByBoneId.get(card2).worldMatrix;
let historyEntries = 0;
const calls = [];
addFrame._getRigLensTable = () => ({
    setRigLensStaticBoneParent: (assetId, layerId, boneId, parentBoneId, options) => {
        calls.push({ assetId, layerId, boneId, parentBoneId, options });
        const result = model.setClipAssetRigBoneParent(assetId, boneId, parentBoneId, options);
        if (result.ok && result.changed) historyEntries += 1;
        return result;
    }
});
addFrame.rigStructureEditorDialog = { open: true };

const dragCard = { classList: { add() {}, remove() {} } };
const dragEvent = {
    prevented: false,
    dataTransfer: { effectAllowed: '', text: '', setData(_type, value) { this.text = value; } },
    preventDefault() { this.prevented = true; }
};
const dropEvent = { prevented: false, preventDefault() { this.prevented = true; } };
const doDrop = (sourceId, targetId) => {
    addFrame._onRigHierarchyCardDragStart(dragEvent, sourceId, dragCard);
    return addFrame._onRigHierarchyCardDrop(dropEvent, targetId, dragCard);
};

assert.equal(doDrop(card2, card1), true, 'dropping card 2 onto card 1 reparents card 2');
assert.equal(historyEntries, 1, 'one accepted drop produces one CAF-history adapter operation');
assert.deepEqual(calls[0], {
    assetId: 'asset', layerId: 'raster', boneId: card2,
    parentBoneId: card1, options: { appendToSiblingEnd: true }
});
assert.equal(addFrame.rigSelectedBoneId, card2, 'the moved stable ID remains selected');
assert.deepEqual(
    [asset.rigDefinition.bones.find(bone => bone.boneId === card2).boneId,
        asset.rigDefinition.bones.find(bone => bone.boneId === card2).name],
    [card2, 'Bone 2'], 'reparent does not rewrite Bone ID or name'
);
const afterCard2World = evaluateRigidBones(asset, null, 0).poseByBoneId.get(card2).worldMatrix;
for (const field of ['a', 'b', 'c', 'd', 'tx', 'ty']) {
    assert.ok(Math.abs(beforeCard2World[field] - afterCard2World[field]) < 1e-8,
        `existing parent mutator preserves Bind World ${field}`);
}

assert.equal(doDrop(card3, card1), true, 'a later card becomes the next child');
let tree = addFrame._getRigHierarchyCardTree(asset.rigDefinition.bones);
assert.deepEqual(tree.children.map(item => item.number), ['1', '2', '3', '4']);
assert.deepEqual(tree.children[0].children.map(item => item.number), ['1-1', '1-2']);
assert.equal(tree.children[0].children[0].bone.boneId, card2);
assert.equal(doDrop(card4, card2), true, 'a card may be dropped onto a nested card');
tree = addFrame._getRigHierarchyCardTree(asset.rigDefinition.bones);
assert.equal(tree.children[0].children[0].children[0].number, '1-1-1');
assert.equal(tree.children[0].children[0].children[0].bone.boneId, card4);

const historyBeforeInvalid = historyEntries;
const callsBeforeInvalid = calls.length;
assert.deepEqual(addFrame._inspectRigHierarchyDrop(asset.rigDefinition.bones, card2, card4), {
    ok: false, reason: 'bone-cycle'
}, 'a descendant target is invalid');
assert.equal(doDrop(card2, card4), false, 'drop onto own descendant is rejected');
assert.equal(doDrop(card2, card2), false, 'self-drop is rejected');
assert.deepEqual(addFrame._inspectRigHierarchyDrop(asset.rigDefinition.bones, 'root', card1), {
    ok: false, reason: 'root-cannot-move'
}, 'the hierarchy guard rejects moving its Root');
assert.equal(historyEntries, historyBeforeInvalid);
assert.equal(calls.length, callsBeforeInvalid, 'invalid drops never reach the CAF mutator');
assert.equal(asset.rigDefinition.bones.find(bone => bone.boneId === card2).parentBoneId, card1,
    'invalid operations leave the previous hierarchy intact');

addFrame._onRigHierarchyCardDragStart(dragEvent, card3, dragCard);
addFrame.rigLensTarget.assetId = 'other-asset';
assert.equal(addFrame._onRigHierarchyCardDrop(dropEvent, card2, dragCard), false,
    'a drag cannot cross the captured CAF identity');
assert.equal(historyEntries, historyBeforeInvalid);
addFrame.rigLensTarget.assetId = 'asset';

const savedBones = serializeRigDefinition(asset.rigDefinition).bones;
assert.deepEqual(savedBones.map(bone => bone.boneId), asset.rigDefinition.bones.map(bone => bone.boneId),
    'the existing serialized Bone enumeration retains the sibling-order projection');
const reopened = new TimelineModel(model.serialize()).getClipAsset('asset').rigDefinition.bones;
assert.deepEqual(reopened.map(bone => [bone.boneId, bone.parentBoneId]),
    asset.rigDefinition.bones.map(bone => [bone.boneId, bone.parentBoneId]),
    'Project save/revisit preserves the hierarchy and its existing array order');
assert.equal(model.findClipEntry('clip').clip.rigMotion, null, 'board edits do not create Motion KEYs');

console.log('PASS: RIG hierarchy card numbering, Root-child creation, guarded D&D, append order, stable IDs, Bind World, and Project serialization');
