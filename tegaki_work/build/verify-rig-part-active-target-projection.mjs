import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

globalThis.window = globalThis.window || {};

const { TimelineModel } = await import('../system/animation/animation-data-model.js');
const { historyManager } = await import('../system/history.js');
const { AnimationTablePopup } = await import('../ui/animation-table-popup.js');
const { RightWorkspaceFrame } = await import('../ui/right-workspace-frame.js');

const buildRoot = path.dirname(fileURLToPath(import.meta.url));
const workRoot = path.dirname(buildRoot);
const read = relative => fs.readFileSync(path.join(workRoot, relative), 'utf8');
const frameSource = read('ui/right-workspace-frame.js');
const popupSource = read('ui/animation-table-popup.js');
const modelSource = read('system/animation/animation-data-model.js');

const identity = () => ({ x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, pivotX: 0, pivotY: 0 });
const model = new TimelineModel({
    totalFrames: 3,
    clipAssets: [{
        id: 'r70-projection-asset',
        name: 'R-70 disposable projection fixture',
        internalLayers: [
            { id: 'part-a', name: 'Raster A', type: 'raster', isBackground: false },
            { id: 'part-b', name: 'Raster B', type: 'raster', isBackground: false },
            { id: 'raster-candidate', name: 'Unregistered Raster', type: 'raster', isBackground: false }
        ]
    }],
    tracks: [{ id: 'r70-lane', cels: [{
        id: 'r70-clip', assetId: 'r70-projection-asset', startFrame: 0, duration: 3
    }] }]
});

for (const partId of ['part-a', 'part-b']) {
    assert.equal(model.registerClipAssetRigPart('r70-projection-asset', partId, {
        initialPivot: identity()
    }).changed, true, `${partId} is registered as a disposable PART`);
}

const popup = Object.assign(Object.create(AnimationTablePopup.prototype), {
    model,
    selectedCelId: 'r70-clip',
    selectedInternalLayerId: 'part-a',
    selectedRigBoneId: 'existing-normal-bone-selection',
    isVisible: true,
    _rigLensActivePartProjection: null
});
let renderCount = 0;
popup.render = () => { renderCount++; };

const validTarget = popup.getRigLensPartTarget('r70-projection-asset');
assert.equal(validTarget.ok, true);
assert.equal(validTarget.support.editable, true,
    'the fixture is inside the supported new RIG Lens scope');
assert.deepEqual(validTarget.parts.map(part => part.partId), ['part-a', 'part-b']);

const workspace = Object.assign(Object.create(RightWorkspaceFrame.prototype), {
    rigLensActive: true,
    rigAuthoringKind: 'part',
    rigLensMode: 'setup',
    rigLensTarget: { assetId: 'r70-projection-asset', internalLayerId: 'part-a' },
    rigSelectedPartId: 'part-a',
    _getRigLensTable: () => popup
});
const normalSelection = popup.selectedInternalLayerId;
const normalBoneSelection = popup.selectedRigBoneId;
const serializedBeforeProjection = JSON.stringify(model.serialize());
const historyDepthBeforeProjection = historyManager.stack.length;

function assertContextPart(expectedPartId, label) {
    const context = popup._getSelectedFolderPartTimelineContext();
    assert.equal(context?.part?.partId, expectedPartId, label);
    assert.equal(context?.layer?.id, expectedPartId, `${label}: matching registered raster context`);
}

assert.equal(popup._getSelectedFolderPartTimelineContext()?.part?.partId, 'part-a',
    'without a RIG projection, the current Dock layer selection remains the displayed PART');

assert.equal(workspace._syncRigLensActivePartProjection({
    rigTarget: { eligible: true, assetId: 'r70-projection-asset' }
}), true, 'Right Workspace sends Part A projection');
assert.deepEqual(popup._rigLensActivePartProjection, {
    assetId: 'r70-projection-asset', partId: 'part-a'
});
assertContextPart('part-a', 'Part A is the effective displayed PART context');

workspace.rigSelectedPartId = 'part-b';
assert.equal(workspace._syncRigLensActivePartProjection({
    rigTarget: { eligible: true, assetId: 'r70-projection-asset' }
}), true, 'Right Workspace replaces Part A with Part B');
assertContextPart('part-b', 'changing RIG selection A to B changes the Dock context to B');
assert.equal(popup.selectedInternalLayerId, normalSelection,
    'projection leaves normal CAF internal Layer selection unchanged');
assert.equal(popup.selectedRigBoneId, normalBoneSelection,
    'projection leaves normal CAF Bone selection unchanged');

const renderCountAfterChange = renderCount;
assert.equal(workspace._syncRigLensActivePartProjection({
    rigTarget: { eligible: true, assetId: 'r70-projection-asset' }
}), false, 'repeating the same active target is idempotent');
assert.equal(renderCount, renderCountAfterChange, 'same projection does not rerender the Dock');

workspace.rigLensMode = 'motion';
assert.equal(workspace._syncRigLensActivePartProjection({
    rigTarget: { eligible: true, assetId: 'r70-projection-asset' }
}), false, 'PART MOTION keeps the same projection');
assertContextPart('part-b', 'PART MOTION still displays Part B');
workspace.rigLensMode = 'setup';
assert.equal(workspace._syncRigLensActivePartProjection({
    rigTarget: { eligible: true, assetId: 'r70-projection-asset' }
}), false, 'returning to PART SETUP keeps the same projection');

workspace.rigSelectedPartId = 'raster-candidate';
assert.equal(workspace._syncRigLensActivePartProjection({
    rigTarget: { eligible: true, assetId: 'r70-projection-asset' }
}), true, 'an unregistered raster candidate clears the registered PART projection');
assert.equal(popup._rigLensActivePartProjection, null);
assertContextPart('part-a', 'unregistered Raster does not synthesize a PART timeline target');

workspace.rigSelectedPartId = 'part-b';
assert.equal(workspace._syncRigLensActivePartProjection({
    rigTarget: { eligible: true, assetId: 'r70-projection-asset' }
}), true);
workspace.rigAuthoringKind = 'deform';
assert.equal(workspace._syncRigLensActivePartProjection({
    rigTarget: { eligible: true, assetId: 'r70-projection-asset' }
}), true, 'PART to DEFORM clears the PART projection');
assert.equal(popup._rigLensActivePartProjection, null);

workspace.rigAuthoringKind = 'part';
workspace._syncRigLensActivePartProjection({
    rigTarget: { eligible: true, assetId: 'r70-projection-asset' }
});
workspace.rigLensActive = false;
assert.equal(workspace._syncRigLensActivePartProjection({
    rigTarget: { eligible: true, assetId: 'r70-projection-asset' }
}), true, 'leaving the RIG Lens clears the PART projection');
assert.equal(popup._rigLensActivePartProjection, null);

workspace.rigLensActive = true;
workspace.rigAuthoringKind = 'part';
workspace.rigLensTarget = { assetId: 'r70-projection-asset', internalLayerId: 'part-a' };
workspace.rigSelectedPartId = 'part-b';
workspace._syncRigLensActivePartProjection({
    rigTarget: { eligible: true, assetId: 'r70-projection-asset' }
});
workspace.rigAuthoringKind = null;
workspace.rigSelectedPartId = null;
assert.equal(workspace._syncRigLensActivePartProjection({
    rigTarget: { eligible: true, assetId: 'r70-projection-asset' }
}), true, 'RIG Reset state clears the PART projection');
assert.equal(popup._rigLensActivePartProjection, null);

workspace.rigAuthoringKind = 'part';
workspace.rigSelectedPartId = 'part-b';
workspace._syncRigLensActivePartProjection({
    rigTarget: { eligible: true, assetId: 'r70-projection-asset' }
});
popup.isVisible = false;
workspace.rigSelectedPartId = 'part-a';
workspace._syncRigLensActivePartProjection({
    rigTarget: { eligible: true, assetId: 'r70-projection-asset' }
});
assert.equal(popup._rigLensActivePartProjection?.partId, 'part-a',
    'projection updates while the Dock is closed');
popup.isVisible = true;
assertContextPart('part-a', 'reopened Dock resolves the current, not previous, RIG target');

workspace.rigSelectedPartId = 'part-b';
workspace._syncRigLensActivePartProjection({
    rigTarget: { eligible: true, assetId: 'r70-projection-asset' }
});
assertContextPart('part-b', 'Part B can be reprojected after close/reopen');
assert.equal(workspace._syncRigLensActivePartProjection({
    rigTarget: { eligible: false, assetId: 'other-asset' }
}), true, 'an invalidated or changed CAF target clears the projection');
assert.equal(popup._rigLensActivePartProjection, null);

popup.selectedInternalLayerId = 'raster-candidate';
assertContextPart('part-a', 'without a valid RIG projection, existing first-Part fallback remains');
assert.equal(popup.selectedInternalLayerId, 'raster-candidate',
    'fallback resolution is display-only and preserves normal selection');

assert.equal(popup.selectedInternalLayerId, 'raster-candidate');
assert.equal(popup.selectedRigBoneId, normalBoneSelection);
assert.equal(JSON.stringify(model.serialize()), serializedBeforeProjection,
    'runtime projection does not change the serialized Project model');
assert.equal(historyManager.stack.length, historyDepthBeforeProjection,
    'projection alone creates no History entry');
assert.doesNotMatch(JSON.stringify(model.serialize()), /_rigLensActivePartProjection/u,
    'projection descriptor is absent from serialized model data');

const workspaceProjectionMethod = frameSource.match(/_syncRigLensActivePartProjection\(target\)\s*\{[\s\S]*?\n    \}/u)?.[0] || '';
assert.ok(workspaceProjectionMethod, 'Right Workspace owns the projection transport');
assert.match(workspaceProjectionMethod, /this\.rigSelectedPartId/u);
assert.doesNotMatch(workspaceProjectionMethod, /selectedInternalLayerId\s*=|selectedRigBoneId\s*=/u,
    'Right Workspace projection does not assign Dock selection fields');
assert.match(popupSource, /setRigLensActivePartProjection\(projection, \{ render = true \} = \{\}\)/u);
assert.match(popupSource, /aria-label="Active RIG PART target">ACTIVE/u,
    'the Animation Dock marks the active PART without normal is-selected semantics');
assert.match(popupSource, /const projectedPart = projectedRigPartFolder[\s\S]*?part: projectedPart/u,
    'only the valid projected PART receives the existing PART timeline row renderer');
assert.doesNotMatch(modelSource, /_rigLensActivePartProjection/u,
    'Project schema/model code has no projection state');

console.log('verify-rig-part-active-target-projection: one-way PART projection, display resolution, invalidation, idempotence, runtime-only state, and selection ownership OK');
