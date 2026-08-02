/**
 * Phase 6t Stage B verifier.
 * Exercises the Motion-tab authoring adapter without mounting DOM: shared
 * eligibility, rotation-only writes, bend flip, gesture baseline/History, and
 * atomic rollback. Project schema and runtime Constraint state stay untouched.
 */

import assert from 'node:assert/strict';

globalThis.window = {};
const { AnimationTablePopup } = await import('../ui/animation-table-popup.js');

const identityTransform = (x = 0, y = 0, rotation = 0, scaleX = 1, scaleY = 1) => ({
    x,
    y,
    scaleX,
    scaleY,
    rotation,
    pivotX: 0,
    pivotY: 0
});

function createProjection(options = {}) {
    const layers = ['root-folder', 'joint-folder', 'effector-folder'].map(id => ({
        id,
        type: 'folder',
        name: id,
        parentLayerId: null,
        visible: true,
        opacity: 1,
        blendMode: 'normal',
        clippingMode: 'none'
    }));
    const ancestor = options.ancestor || null;
    const bones = [
        ...(ancestor ? [ancestor] : []),
        {
            boneId: 'root-bone',
            parentBoneId: ancestor?.boneId || null,
            bindTransform: options.rootTransform || identityTransform(),
            length: 91
        },
        {
            boneId: 'joint-bone',
            parentBoneId: 'root-bone',
            bindTransform: options.jointTransform || identityTransform(3, 0),
            length: 92
        },
        {
            boneId: 'effector-bone',
            parentBoneId: 'joint-bone',
            bindTransform: options.effectorTransform || identityTransform(0, 4),
            length: 93
        }
    ];
    const parts = layers.map(layer => ({
        partId: layer.id,
        parentPartId: null,
        bindTransform: identityTransform()
    }));
    const bindings = [
        { boneId: 'root-bone', partId: 'root-folder' },
        { boneId: 'joint-bone', partId: 'joint-folder' },
        { boneId: 'effector-bone', partId: 'effector-folder' }
    ];
    const asset = {
        id: 'asset-ik',
        internalLayers: layers,
        rigDefinition: { version: 1, parts, bones, rigidBindings: bindings }
    };
    const clip = {
        id: 'clip-ik',
        assetId: asset.id,
        startFrame: 0,
        duration: 6,
        rigMotion: { version: 1, partTracks: [], boneTracks: [] }
    };
    const entry = { clip, lane: { id: 'lane-ik' } };
    const folderById = new Map(layers.map(layer => [layer.id, layer]));
    const boneById = new Map(bones.map(bone => [bone.boneId, bone]));
    const folders = bindings.map(binding => ({
        entry,
        asset,
        layer: folderById.get(binding.partId),
        part: parts.find(part => part.partId === binding.partId),
        binding,
        bone: boneById.get(binding.boneId),
        localFrame: 0,
        isFrameInClip: true,
        boneKey: null,
        boneSampled: identityTransform()
    }));
    return {
        entry,
        asset,
        parts,
        bones,
        bindings,
        folders,
        localFrame: 0,
        isFrameInClip: true
    };
}

const popup = Object.create(AnimationTablePopup.prototype);
popup.model = { playback: { currentFrame: 0 } };
popup.isPlaying = false;
const projection = createProjection();
const effectorFolder = projection.folders.find(folder => folder.bone.boneId === 'effector-bone');
const chain = popup._getMotionIkChainContext(effectorFolder, projection);
assert.equal(chain.ok, true, 'three rigid Folder/Bones are IK eligible');
assert.equal(chain.lengthA, 3, 'eligibility uses evaluated root-to-joint length');
assert.equal(chain.lengthB, 4, 'eligibility uses evaluated joint-to-effector length');
assert.notEqual(chain.lengthA, chain.rootBone.length, 'display Bone length is not the IK segment length');

const zeroProjection = createProjection({ jointTransform: identityTransform() });
const zeroEffector = zeroProjection.folders.find(folder => folder.bone.boneId === 'effector-bone');
assert.equal(
    popup._getMotionIkChainContext(zeroEffector, zeroProjection).reason,
    'zero-length-segment',
    'zero-length chain is disabled before gesture start'
);

const skewProjection = createProjection({
    ancestor: {
        boneId: 'ancestor-bone',
        parentBoneId: null,
        bindTransform: identityTransform(0, 0, 0, 2, 1),
        length: 20
    },
    rootTransform: identityTransform(0, 0, Math.PI / 4)
});
const skewEffector = skewProjection.folders.find(folder => folder.bone.boneId === 'effector-bone');
assert.equal(
    popup._getMotionIkChainContext(skewEffector, skewProjection).reason,
    'non-uniform-or-mirrored-scale',
    'ancestor-produced world skew is not approximated as a rigid chain'
);

const writes = [];
let rollbackCount = 0;
popup.model = {
    playback: { currentFrame: 0 },
    setClipRigBoneKey: (clipId, boneId, frame, transform) => {
        writes.push({ clipId, boneId, frame, transform: { ...transform } });
        return { ok: true, changed: true };
    },
    setClipRigMotion: () => {
        rollbackCount++;
        return { ok: true };
    }
};
popup._invalidateSnapshotTextureCache = () => {};
popup._scheduleMotionEditPreviewRefresh = () => {};
popup._applyVisibilityPreview = () => {};
const applyResult = popup._applyMotionIkTarget(
    projection,
    effectorFolder,
    { x: 5, y: 2 },
    1,
    { deferPreview: true }
);
assert.equal(applyResult.ok, true, 'authoring adapter solves a pointer target');
assert.deepEqual(writes.map(write => write.boneId), ['root-bone', 'joint-bone']);
assert.ok(writes.every(write => Number.isFinite(write.transform.rotation)), 'only finite Pose keys are written');
assert.ok(writes.every(write => write.transform.x === 0 && write.transform.y === 0), 'Bone translation is preserved');
assert.ok(writes.every(write => write.transform.scaleX === 1 && write.transform.scaleY === 1), 'Bone scale is preserved');
assert.equal(rollbackCount, 0, 'successful two-key write does not roll back');

let writeAttempt = 0;
popup.model.setClipRigBoneKey = () => {
    writeAttempt++;
    return writeAttempt === 1 ? { ok: true, changed: true } : { ok: false, reason: 'fixture-failure' };
};
const failedApply = popup._applyMotionIkTarget(
    projection,
    effectorFolder,
    { x: 4, y: 3 },
    1,
    { deferPreview: true }
);
assert.equal(failedApply.ok, false, 'second key failure is reported');
assert.equal(failedApply.rollbackOk, true, 'partial root write is rolled back atomically');
assert.equal(rollbackCount, 1, 'rollback uses the existing rigMotion setter once');

const gesturePopup = Object.create(AnimationTablePopup.prototype);
gesturePopup.model = { playback: { currentFrame: 0 } };
gesturePopup.isPlaying = false;
gesturePopup._motionEditorMode = 'motion';
gesturePopup._motionIkEnabledBones = new Set(['asset-ik:effector-bone']);
gesturePopup._motionIkBendSigns = new Map([['asset-ik:effector-bone', 1]]);
gesturePopup._isRigPivotSetupActive = () => false;
gesturePopup._isMotionBonePivotActive = () => true;
gesturePopup._selectRigPivotTarget = () => true;
gesturePopup._getSelectedCafRigProjection = () => projection;
gesturePopup._getMotionIkChainContext = () => chain;
gesturePopup._screenToRigProject = event => ({ x: event.clientX, y: event.clientY });
gesturePopup._captureTimelineHistoryState = () => ({ marker: 'before' });
let appliedBasePose = null;
gesturePopup._applyMotionIkTarget = (_projection, _folder, _target, _bendSign, options) => {
    appliedBasePose = options.basePose;
    return { ok: true, changed: true };
};
let historyCount = 0;
let restoreCount = 0;
gesturePopup._finishMotionGestureHistory = () => { historyCount++; };
gesturePopup._restoreTimelineHistoryState = () => { restoreCount++; return true; };
gesturePopup._flushLayerPanelSync = () => {};
gesturePopup._scheduleLaneReferencePreviewUpdate = () => {};
gesturePopup.render = () => {};

assert.equal(
    gesturePopup._startRigPivotGesture('effector-folder', 'move', { clientX: 10, clientY: 10 }),
    true,
    'IK gesture starts from the existing PIVOT route'
);
const startBasePose = gesturePopup._rigPivotGesture.basePose;
assert.deepEqual(startBasePose.points, chain.points, 'gesture captures evaluated points once');
assert.equal(
    gesturePopup._moveRigPivotGesture('effector-folder', 'move', { clientX: 20, clientY: 15 }),
    true,
    'pointermove routes through the IK adapter'
);
assert.equal(appliedBasePose, startBasePose, 'every move uses the gesture-start Bone pose');
gesturePopup._finishRigPivotGesture('effector-folder', 'move', { cancelled: false });
assert.equal(historyCount, 1, 'pointerup records one Timeline History item');

gesturePopup._startRigPivotGesture('effector-folder', 'move', { clientX: 10, clientY: 10 });
gesturePopup._moveRigPivotGesture('effector-folder', 'move', { clientX: 22, clientY: 16 });
gesturePopup._finishRigPivotGesture('effector-folder', 'move', { cancelled: true });
assert.equal(restoreCount, 1, 'cancel restores the gesture-start Timeline state');
assert.equal(historyCount, 1, 'cancel does not add History');

const flipPopup = Object.create(AnimationTablePopup.prototype);
flipPopup._motionIkEnabledBones = new Set(['asset-ik:effector-bone']);
flipPopup._motionIkBendSigns = new Map([['asset-ik:effector-bone', 1]]);
flipPopup._getSelectedRigInspectorContext = () => ({ projection, folder: effectorFolder });
flipPopup._getMotionIkChainContext = () => chain;
flipPopup._captureTimelineHistoryState = () => ({ marker: 'flip-before' });
let flipApply = null;
flipPopup._applyMotionIkTarget = (_projection, _folder, target, bendSign) => {
    flipApply = { target, bendSign };
    return { ok: true, changed: true };
};
let flipHistoryCount = 0;
flipPopup._finishMotionGestureHistory = () => { flipHistoryCount++; };
flipPopup.render = () => {};
flipPopup._flushLayerPanelSync = () => {};
flipPopup._scheduleLaneReferencePreviewUpdate = () => {};
assert.equal(flipPopup._flipMotionIkBend(), true, 'bend flip applies immediately');
assert.deepEqual(flipApply.target, chain.points.effector, 'bend flip keeps the current effector target');
assert.equal(flipApply.bendSign, -1, 'bend flip selects the opposite analytical solution');
assert.equal(flipHistoryCount, 1, 'bend flip records one History item');

console.log('verify-two-bone-ik-authoring: eligibility, rotation-only writes, atomic rollback, gesture History/cancel, and bend flip OK');
