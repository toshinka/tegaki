import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const buildRoot = path.dirname(fileURLToPath(import.meta.url));
const workRoot = path.dirname(buildRoot);
const frameSource = fs.readFileSync(path.join(workRoot, 'ui/right-workspace-frame.js'), 'utf8');

globalThis.window = globalThis.window || {};
const { RightWorkspaceFrame } = await import('../ui/right-workspace-frame.js');

const makeTarget = (assetId, internalLayerId, overrides = {}) => ({
    eligible: true,
    assetId,
    internalLayerId,
    assetName: assetId.toUpperCase(),
    layerName: internalLayerId.toUpperCase(),
    ...overrides
});
const makeFrame = ({
    active = makeTarget('asset-a', 'raster-a'),
    selected = active,
    gesture = null,
    structureDrag = null,
    posePreview = false,
    transitionPending = false
} = {}) => {
    const frame = Object.create(RightWorkspaceFrame.prototype);
    const calls = [];
    Object.assign(frame, {
        rigLensActive: true,
        rigLensTarget: { ...active },
        lastRigTargetKey: `${active.assetId}:${active.internalLayerId}`,
        rigTargetSwitchPending: transitionPending,
        rigPointerGesture: gesture,
        rigStructureDrag: structureDrag,
        rigEntryMessage: transitionPending ? '旧い切替待ち表示' : '',
        rigLensMode: 'motion',
        rigAuthoringKind: 'deform',
        rigSelectedBoneId: 'bone-a',
        rigPlacementMode: 'child',
        rigPartIkEffectorId: 'part-a',
        getTarget: () => ({ rigTarget: selected }),
        _hasRigPosePreview: () => posePreview,
        _exitRigToLayer: options => {
            calls.push({ kind: 'exit', options });
            frame.rigLensActive = false;
            frame.rigLensTarget = null;
            frame.transformLensRequested = options.showTransformGate === true;
            return true;
        },
        _enterRigLens: options => {
            calls.push({ kind: 'enter', options });
            frame.rigLensTarget = { ...selected };
            frame.lastRigTargetKey = `${selected.assetId}:${selected.internalLayerId}`;
            frame.rigTargetSwitchPending = false;
            frame.rigEntryMessage = '';
            frame.rigLensMode = 'setup';
            frame.rigAuthoringKind = selected.authoringKind || 'deform';
            frame.rigSelectedBoneId = null;
            frame.rigPlacementMode = null;
            frame.rigPartIkEffectorId = null;
            return true;
        }
    });
    return { frame, calls };
};

const sameSelection = makeTarget('asset-a', 'raster-a', {
    assetName: 'Renamed CAF', layerName: 'Renamed Raster'
});
const same = makeFrame({
    selected: sameSelection,
    transitionPending: true
});
assert.equal(same.frame._syncActiveRigLensTarget(sameSelection), 'same-target');
assert.deepEqual(same.calls, [], 'same target refresh does not exit or re-enter RIG');
assert.equal(same.frame.rigLensTarget.assetName, 'Renamed CAF', 'same target refreshes its display metadata');
assert.equal(same.frame.rigLensTarget.layerName, 'Renamed Raster');
assert.equal(same.frame.rigLensMode, 'motion', 'same target preserves the active SETUP/MOTION lens');
assert.equal(same.frame.rigSelectedBoneId, 'bone-a');
assert.equal(same.frame.rigEntryMessage, '', 'returning to the active target clears only the pending-switch notice');

const nextDeform = makeTarget('asset-b', 'raster-b', { authoringKind: 'deform' });
const deformSwitch = makeFrame({ selected: nextDeform });
assert.equal(deformSwitch.frame._syncActiveRigLensTarget(nextDeform), 'retargeted');
assert.deepEqual(deformSwitch.calls, [{ kind: 'enter', options: { sync: false } }],
    'a new valid target reuses RIG entry without recursive sync');
assert.equal(deformSwitch.frame.rigLensTarget.assetId, 'asset-b');
assert.equal(deformSwitch.frame.rigAuthoringKind, 'deform');
assert.equal(deformSwitch.frame.rigLensMode, 'setup', 'new target starts from its model-derived entry state');

const nextPart = makeTarget('asset-c', 'raster-c', { authoringKind: 'part' });
const partSwitch = makeFrame({ selected: nextPart });
assert.equal(partSwitch.frame._syncActiveRigLensTarget(nextPart), 'retargeted');
assert.equal(partSwitch.frame.rigAuthoringKind, 'part', 'PART target mode follows the existing entry resolver');
assert.equal(partSwitch.frame.rigLensTarget.internalLayerId, 'raster-c');

const invalidSelection = { eligible: false, reason: 'Folder cannot be a RIG target.' };
const invalid = makeFrame({ selected: invalidSelection });
assert.equal(invalid.frame._syncActiveRigLensTarget(invalidSelection), 'layer');
assert.deepEqual(invalid.calls, [{ kind: 'exit', options: { sync: false } }],
    'an invalid selection returns to LAYER without selecting TRANSFORM');
assert.equal(invalid.frame.rigLensActive, false);
assert.equal(invalid.frame.rigLensTarget, null, 'an invalid target cannot retain the old CAF reference');
assert.equal(invalid.frame.transformLensRequested, false);

for (const guard of [
    { gesture: { kind: 'pose', pointerId: 31 }, message: /RIG操作中/u },
    { structureDrag: { pointerMode: true, pointerId: 32 }, message: /RIG操作中/u },
    { posePreview: true, message: /未確定Pose/u }
]) {
    const selected = makeTarget('asset-next', 'raster-next');
    const guarded = makeFrame({ selected, ...guard });
    assert.equal(guarded.frame._syncActiveRigLensTarget(selected), 'deferred');
    assert.deepEqual(guarded.calls, [], 'an unsafe switch never commits, cancels, exits or enters implicitly');
    assert.equal(guarded.frame.rigTargetSwitchPending, true);
    assert.match(guarded.frame.rigEntryMessage, guard.message);
}

const guardedByEntry = makeFrame({ selected: nextDeform });
guardedByEntry.frame._enterRigLens = options => {
    guardedByEntry.calls.push({ kind: 'guarded-entry', options });
    guardedByEntry.frame.rigEntryMessage = '既存entry guard';
    return false;
};
assert.equal(guardedByEntry.frame._syncActiveRigLensTarget(nextDeform), 'guarded');
assert.equal(guardedByEntry.frame.rigLensActive, true,
    'a rejected entry remains behind its existing guard instead of changing lens implicitly');

assert.match(frameSource, /const rigTargetIdentityKey = target =>/u,
    'RIG target identity is a runtime projection of existing CAF and Raster ids');
assert.match(frameSource, /if \(this\.rigLensActive\) \{\s*this\._syncActiveRigLensTarget\(rigTarget\)/u,
    'every current Workspace sync reconciles the active RIG target first');
assert.match(frameSource, /_syncActiveRigLensTarget\(rigTarget\)[\s\S]*?_renderRigLens\(target\)/u,
    'current selection synchronization runs before the RIG artwork and mode projection');
const activeSync = frameSource.match(/_syncActiveRigLensTarget\(target\)[\s\S]*?\n    _returnToTransform\(\)/u)?.[0] || '';
assert.ok(activeSync, 'active target reconciliation is implemented in one bounded helper');
assert.doesNotMatch(activeSync, /History|registerRigLens|commitRigLens|setRigLens/u,
    'selection navigation does not mutate RIG model data or History');
assert.doesNotMatch(frameSource, /対象を確認してからTransformへ戻ってください/u,
    'the stale parent-lens instruction is removed');

console.log('PASS: same-target refresh, valid PART/DEFORM retarget, invalid LAYER fallback, and gesture/Pose guards');
