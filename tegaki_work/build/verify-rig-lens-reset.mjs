import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

globalThis.window = globalThis.window || {};

const { TimelineModel } = await import('../system/animation/animation-data-model.js');
const { PART_RIG_SCHEMA_VERSION } = await import('../system/animation/part-rig.js');
const { RASTER_MESH_SCHEMA_VERSION } = await import('../system/animation/raster-bone-skinning.js');
const { ALPHA_FIT_GRID_GENERATOR } = await import('../system/animation/raster-bone-auto-setup.js');
const { AnimationTablePopup } = await import('../ui/animation-table-popup.js');
const { historyManager } = await import('../system/history.js');

const buildRoot = path.dirname(fileURLToPath(import.meta.url));
const workRoot = path.dirname(buildRoot);
const read = relative => fs.readFileSync(path.join(workRoot, relative), 'utf8');
const frameSource = read('ui/right-workspace-frame.js');
const popupSource = read('ui/animation-table-popup.js');
const modelSource = read('system/animation/animation-data-model.js');

const identity = () => ({ x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, pivotX: 0, pivotY: 0 });
const bone = (boneId, parentBoneId = null) => ({
    boneId,
    parentBoneId,
    bindTransform: identity(),
    length: 24
});
const layer = (id, options = {}) => ({
    id,
    name: options.name || id,
    type: options.type || 'raster',
    isBackground: false,
    parentLayerId: options.parentLayerId || null,
    drawingSnapshotId: options.drawingSnapshotId || null
});
const partDefinition = partId => ({ partId, parentPartId: null, bindTransform: identity() });
const partMotion = (partId, frames = [0]) => ({
    version: PART_RIG_SCHEMA_VERSION,
    partTracks: [{
        partId,
        keyframes: frames.map((frame, index) => ({ frame, x: index + 1, interpolation: 'linear' }))
    }]
});
const boneMotion = (boneId, frames = [0]) => ({
    version: PART_RIG_SCHEMA_VERSION,
    partTracks: [],
    boneTracks: [{
        boneId,
        keyframes: frames.map((frame, index) => ({ frame, rotation: index / 10, interpolation: 'linear' }))
    }]
});

function createPartAsset({ id = 'part-asset', withAnchor = false } = {}) {
    const selectedLayerId = 'part-raster';
    const folderId = 'part-folder';
    const rigBones = withAnchor ? [bone('part-root'), bone('anchor-child', 'part-root')] : [bone('part-root')];
    const assetLayers = withAnchor
        ? [layer(folderId, { type: 'folder' }), layer('nested-raster', { parentLayerId: folderId }), layer(selectedLayerId)]
        : [layer(selectedLayerId)];
    const rigDefinition = {
        version: PART_RIG_SCHEMA_VERSION,
        parts: [partDefinition(withAnchor ? folderId : selectedLayerId)],
        bones: rigBones,
        rigidBindings: [{ boneId: 'part-root', partId: withAnchor ? folderId : selectedLayerId }],
        ...(withAnchor ? {
            warpAnchorConstraints: [{
                version: 1,
                sourceFolderLayerId: folderId,
                targetBoneId: 'anchor-child',
                bindPoint: { x: 4, y: 7 },
                enabled: true
            }]
        } : {})
    };
    return {
        id,
        name: id,
        internalLayers: assetLayers,
        rigDefinition,
        selectedLayerId
    };
}

function createDeformAsset({ id = 'deform-asset', generatedMesh = true } = {}) {
    const rasterId = `${id}-raster`;
    const asset = {
        id,
        name: id,
        internalLayers: [layer(rasterId, { drawingSnapshotId: 'pixels' })],
        rigDefinition: {
            version: PART_RIG_SCHEMA_VERSION,
            parts: [],
            bones: [bone(`${id}-root`)]
        }
    };
    if (!generatedMesh) return { ...asset, selectedLayerId: rasterId };

    const meshId = `${id}-mesh`;
    const vertices = [
        { vertexId: `${id}-v1`, x: 0, y: 0 },
        { vertexId: `${id}-v2`, x: 10, y: 0 },
        { vertexId: `${id}-v3`, x: 0, y: 10 }
    ];
    asset.meshDefinitions = [{
        version: RASTER_MESH_SCHEMA_VERSION,
        meshId,
        targetInternalLayerId: rasterId,
        vertices,
        triangles: [[vertices[0].vertexId, vertices[1].vertexId, vertices[2].vertexId]],
        generator: {
            type: ALPHA_FIT_GRID_GENERATOR,
            columns: 2,
            rows: 2,
            contentBounds: { x: 0, y: 0, width: 10, height: 10 },
            bindBounds: { x: 0, y: 0, width: 10, height: 10 },
            source: {
                snapshotId: 'pixels', updatedAt: 1, width: 10, height: 10,
                rasterBounds: { x: 0, y: 0, width: 10, height: 10 }
            }
        }
    }];
    asset.skinBindings = [{
        version: RASTER_MESH_SCHEMA_VERSION,
        meshId,
        vertexWeights: vertices.map(vertex => ({
            vertexId: vertex.vertexId,
            influences: [{ boneId: `${id}-root`, weight: 1 }]
        }))
    }];
    return { ...asset, selectedLayerId: rasterId };
}

function makeClip(id, assetId, options = {}) {
    return {
        id,
        assetId,
        startFrame: options.startFrame || 0,
        duration: options.duration || 3,
        transform: options.transform || { x: 8, y: 12, scaleX: 1.2, scaleY: 0.8, rotation: 0.25 },
        transformKeyframes: options.transformKeyframes || [{
            frame: 0, x: 8, y: 12, scaleX: 1.2, scaleY: 0.8, rotation: 0.25
        }],
        layerTransformTracks: options.layerTransformTracks || [{
            internalLayerId: options.layerId || `${assetId}-raster`,
            pivotX: 3,
            pivotY: 6,
            keyframes: [{ frame: 0, x: 2, y: 4, scaleX: 1, scaleY: 1, rotation: 0 }]
        }],
        rigMotion: options.rigMotion || null
    };
}

function makeTimeline(assets, clips, snapshots = []) {
    return new TimelineModel({
        fps: 12,
        totalFrames: 24,
        tracks: [{ id: 'lane-1', name: 'Lane 1', type: 'raster', cels: clips }],
        clipAssets: assets.map(({ selectedLayerId, ...asset }) => asset),
        drawingSnapshots: snapshots
    });
}

function makePopup(model, selectedCelId, selectedLayerId) {
    const popup = Object.create(AnimationTablePopup.prototype);
    Object.assign(popup, {
        model,
        selectedCelId,
        selectedCelIds: new Set([selectedCelId]),
        selectedAssetId: model.getClipById(selectedCelId)?.assetId || null,
        selectedAssetFolderId: null,
        selectedInternalLayerId: selectedLayerId,
        activeLaneId: 'lane-1',
        isLaneOnlySelected: false,
        includedLaneIds: new Set(),
        playbackScope: 'all',
        isPlaying: false,
        isClipEditModeActive: false,
        _getSelectedCelIds: () => new Set(popup.selectedCelIds),
        _activateClipEntry: () => true,
        _syncWorkingLayersForCurrentFrame: () => true,
        _invalidateSnapshotTextureCache: () => {},
        _applyVisibilityPreview: () => {},
        _scheduleLaneReferencePreviewUpdate: () => {},
        _flushLayerPanelSync: () => {},
        render: () => {}
    });
    return popup;
}

function resetHistory() {
    historyManager.stack.splice(0, historyManager.stack.length);
    historyManager.index = -1;
    historyManager.isApplying = false;
    historyManager.recordingSuppressionDepth = 0;
}

// PART reset owns all Parts, rigid-bound / anchor Bones, and their instance tracks.
const part = createPartAsset();
const other = createDeformAsset({ id: 'other-asset', generatedMesh: false });
const partModel = makeTimeline(
    [part, other],
    [
        makeClip('part-clip-a', part.id, { layerId: part.selectedLayerId, rigMotion: {
            ...partMotion(part.selectedLayerId, [0, 2]),
            boneTracks: [{ boneId: 'part-root', keyframes: [{ frame: 1, x: 5 }] }]
        } }),
        makeClip('part-clip-b', part.id, { layerId: part.selectedLayerId, rigMotion: partMotion(part.selectedLayerId, [1]) }),
        makeClip('part-clip-c', part.id, { layerId: part.selectedLayerId }),
        makeClip('other-clip', other.id, { layerId: other.selectedLayerId, rigMotion: boneMotion('other-asset-root', [0]) })
    ],
    [{ id: 'pixels', width: 1, height: 1, pixels: new Uint8ClampedArray([11, 22, 33, 255]) }]
);
const partPlan = partModel.getClipAssetRigResetPlan(part.id);
assert.deepEqual(partPlan, {
    ok: true, assetId: part.id, mode: 'part', affectedClipCount: 3, affectedRigKeyCount: 4
});
const partClipA = partModel.getClipById('part-clip-a');
const partClipTransform = structuredClone(partClipA.transform);
const partClipTransformKeys = structuredClone(partClipA.transformKeyframes);
const partLayerTransformTracks = structuredClone(partClipA.layerTransformTracks);
const pixelBefore = [...partModel.drawingSnapshots[0].pixels];
const partReset = partModel.resetClipAssetRig(part.id, { expectedMode: 'part' });
assert.equal(partReset.ok, true);
assert.equal(partModel.getClipAsset(part.id).rigDefinition, null);
assert.equal(partModel.getClipAsset(part.id).meshDefinitions, null);
assert.equal(partModel.getClipAsset(part.id).skinBindings, null);
for (const id of ['part-clip-a', 'part-clip-b', 'part-clip-c']) {
    assert.equal(partModel.getClipById(id).rigMotion, null, `${id} rigMotion reset`);
}
assert.ok(partModel.getClipAsset(other.id).rigDefinition?.bones?.length, 'other CAF rig remains intact');
assert.ok(partModel.getClipById('other-clip').rigMotion?.boneTracks?.length, 'other CAF motion remains intact');
assert.deepEqual(partClipA.transform, partClipTransform, 'CAF Clip transform is unchanged');
assert.deepEqual(partClipA.transformKeyframes, partClipTransformKeys, 'CAF Clip transform keys are unchanged');
assert.deepEqual(partClipA.layerTransformTracks, partLayerTransformTracks, 'Layer transform tracks are unchanged');
assert.deepEqual([...partModel.drawingSnapshots[0].pixels], pixelBefore, 'artwork pixels are unchanged');

// A validated PART WARP anchor is removed only with its fully-owned folder Part and Bones.
const anchoredPart = createPartAsset({ id: 'anchored-part-asset', withAnchor: true });
const anchorModel = makeTimeline(
    [anchoredPart],
    [makeClip('anchor-clip', anchoredPart.id, {
        layerId: anchoredPart.selectedLayerId,
        rigMotion: {
            ...partMotion('part-folder', [0]),
            boneTracks: [{ boneId: 'anchor-child', keyframes: [{ frame: 1, y: 3 }] }]
        }
    })]
);
assert.equal(anchorModel.getClipAssetRigResetPlan(anchoredPart.id).ok, true,
    'supported PART WARP anchor ownership is eligible');
assert.equal(anchorModel.resetClipAssetRig(anchoredPart.id).ok, true);
assert.equal(anchorModel.getClipAsset(anchoredPart.id).rigDefinition, null,
    'PART reset removes its constrained Bone and anchor definition together');

// A current simple RIG remains resettable when none of its Clip instances has RIG KEYs.
resetHistory();
const zeroKeyPart = createPartAsset({ id: 'zero-key-part-asset' });
const zeroKeyPartModel = makeTimeline([zeroKeyPart], [
    makeClip('zero-key-part-clip', zeroKeyPart.id, { layerId: zeroKeyPart.selectedLayerId })
]);
const zeroKeyPartPopup = makePopup(zeroKeyPartModel, 'zero-key-part-clip', zeroKeyPart.selectedLayerId);
assert.deepEqual(zeroKeyPartPopup.getRigLensResetPlan(zeroKeyPart.id), {
    ok: true, assetId: zeroKeyPart.id, mode: 'part', affectedClipCount: 1, affectedRigKeyCount: 0
});
assert.equal(zeroKeyPartPopup.resetRigLensSetup(zeroKeyPart.id, 'part').ok, true);
assert.equal(historyManager.stack.length, 1, 'zero-key reset remains one Timeline History item');
assert.equal(zeroKeyPartModel.getClipAsset(zeroKeyPart.id).rigDefinition, null);
resetHistory();

// DEFORM accepts current Alpha Fit Grid topology and clears all shared Clip bone tracks.
const deform = createDeformAsset();
const deformClipAData = makeClip('deform-clip-a', deform.id, {
    layerId: deform.selectedLayerId,
    rigMotion: boneMotion('deform-asset-root', [0, 2])
});
const deformClipBData = makeClip('deform-clip-b', deform.id, { layerId: deform.selectedLayerId });
const unrelated = createDeformAsset({ id: 'unrelated-asset', generatedMesh: true });
const unrelatedClipData = makeClip('unrelated-clip', unrelated.id, {
    layerId: unrelated.selectedLayerId,
    rigMotion: boneMotion('unrelated-asset-root', [1])
});
const deformModel = makeTimeline(
    [deform, unrelated], [deformClipAData, deformClipBData, unrelatedClipData],
    [{ id: 'pixels', width: 10, height: 10, pixels: new Uint8ClampedArray(400).fill(64), updatedAt: 1 }]
);
const popup = makePopup(deformModel, 'deform-clip-a', deform.selectedLayerId);
const livePlan = popup.getRigLensResetPlan(deform.id);
assert.equal(livePlan.ok, true);
assert.equal(livePlan.mode, 'deform');
assert.equal(livePlan.affectedClipCount, 2);
assert.equal(livePlan.affectedRigKeyCount, 2);
const deformClipA = deformModel.getClipById('deform-clip-a');
const deformClipAClipTransform = structuredClone(deformClipA.transform);
const deformClipAClipTransformKeys = structuredClone(deformClipA.transformKeyframes);
const deformClipALayerTransformTracks = structuredClone(deformClipA.layerTransformTracks);
const deformPixelsBefore = [...deformModel.drawingSnapshots[0].pixels];

resetHistory();
const resetResult = popup.resetRigLensSetup(deform.id, 'deform');
assert.equal(resetResult.ok, true);
assert.equal(historyManager.stack.length, 1, 'one reset creates exactly one History entry');
assert.equal(historyManager.index, 0);
assert.equal(historyManager.stack[0].meta.historyKind, 'timeline', 'reset uses Timeline History');
assert.equal(historyManager.stack[0].meta.type, 'caf-rig-lens-reset');
assert.equal(deformModel.getClipAsset(deform.id).rigDefinition, null);
assert.equal(deformModel.getClipAsset(deform.id).meshDefinitions, null);
assert.equal(deformModel.getClipAsset(deform.id).skinBindings, null);
assert.equal(deformModel.getClipById('deform-clip-a').rigMotion, null);
assert.equal(deformModel.getClipById('deform-clip-b').rigMotion, null);
assert.ok(deformModel.getClipAsset(unrelated.id).meshDefinitions?.length, 'unrelated CAF Mesh remains intact');
assert.ok(deformModel.getClipById('unrelated-clip').rigMotion?.boneTracks?.length,
    'unrelated CAF Motion remains intact');
assert.deepEqual(deformClipA.transform, deformClipAClipTransform);
assert.deepEqual(deformClipA.transformKeyframes, deformClipAClipTransformKeys);
assert.deepEqual(deformClipA.layerTransformTracks, deformClipALayerTransformTracks);
assert.deepEqual([...deformModel.drawingSnapshots[0].pixels], deformPixelsBefore);

historyManager.undo();
assert.ok(popup.model.getClipAsset(deform.id).rigDefinition?.bones?.length, 'one Undo restores the Asset rig');
assert.ok(popup.model.getClipAsset(deform.id).meshDefinitions?.length, 'one Undo restores Mesh topology');
assert.ok(popup.model.getClipAsset(deform.id).skinBindings?.length, 'one Undo restores Skin bindings');
assert.equal(popup.model.getClipById('deform-clip-a').rigMotion.boneTracks[0].keyframes.length, 2,
    'one Undo restores all Clip Motion keys');
assert.equal(popup.model.getClipById('deform-clip-b').rigMotion, null);
assert.deepEqual([...popup.model.drawingSnapshots[0].pixels], deformPixelsBefore,
    'Undo preserves artwork pixels');
historyManager.redo();
assert.equal(popup.model.getClipAsset(deform.id).rigDefinition, null, 'one Redo reapplies the reset');
assert.equal(popup.model.getClipById('deform-clip-a').rigMotion, null);

// Playback, model eligibility, unknown legacy shapes, and failed History recording cannot half-reset.
resetHistory();
const guardedModel = makeTimeline([createPartAsset()], [makeClip('guarded-clip', 'part-asset', {
    layerId: 'part-raster', rigMotion: partMotion('part-raster', [0])
})]);
const guardedPopup = makePopup(guardedModel, 'guarded-clip', 'part-raster');
guardedPopup.isPlaying = true;
assert.equal(guardedPopup.getRigLensResetPlan('part-asset').ok, false, 'playback blocks reset');
assert.ok(guardedModel.getClipAsset('part-asset').rigDefinition);
guardedPopup.isPlaying = false;
historyManager.recordingSuppressionDepth = 1;
assert.equal(guardedPopup.getRigLensResetPlan('part-asset').ok, false,
    'History suppression blocks reset before mutation');
historyManager.recordingSuppressionDepth = 0;
guardedPopup._recordTimelineHistory = () => false;
const failedHistoryResult = guardedPopup.resetRigLensSetup('part-asset', 'part');
assert.equal(failedHistoryResult.ok, false);
assert.equal(failedHistoryResult.rolledBack, true);
assert.ok(guardedPopup.model.getClipAsset('part-asset').rigDefinition,
    'History failure restores the Asset setup');
assert.ok(guardedPopup.model.getClipById('guarded-clip').rigMotion,
    'History failure restores Clip Motion');
assert.equal(historyManager.stack.length, 0, 'History failure adds no entry');

const unsupportedMixed = createDeformAsset({ id: 'mixed-asset', generatedMesh: false });
unsupportedMixed.rigDefinition.parts = [partDefinition(unsupportedMixed.selectedLayerId)];
unsupportedMixed.rigDefinition.bones = [bone('mixed-root')];
unsupportedMixed.rigDefinition.rigidBindings = [{ boneId: 'mixed-root', partId: unsupportedMixed.selectedLayerId }];
unsupportedMixed.meshDefinitions = [{ meshId: 'manual', targetInternalLayerId: unsupportedMixed.selectedLayerId }];
const mixedModel = makeTimeline([unsupportedMixed], [makeClip('mixed-clip', unsupportedMixed.id, {
    layerId: unsupportedMixed.selectedLayerId
})]);
assert.equal(mixedModel.getClipAssetRigResetPlan(unsupportedMixed.id).ok, false,
    'PART plus DEFORM Mesh is ineligible');

const manualMesh = createDeformAsset({ id: 'manual-mesh-asset' });
manualMesh.meshDefinitions[0].generator.type = 'manual-grid';
const manualModel = makeTimeline([manualMesh], [makeClip('manual-mesh-clip', manualMesh.id, {
    layerId: manualMesh.selectedLayerId
})]);
assert.equal(manualModel.getClipAssetRigResetPlan(manualMesh.id).ok, false,
    'manual / legacy Mesh is ineligible');

const unknownRig = createPartAsset({ id: 'unknown-rig-asset' });
unknownRig.rigDefinition.futureSetup = { owner: 'unknown' };
const unknownModel = makeTimeline([unknownRig], [makeClip('unknown-rig-clip', unknownRig.id, {
    layerId: unknownRig.selectedLayerId
})]);
assert.equal(unknownModel.getClipAssetRigResetPlan(unknownRig.id).ok, false,
    'unrecognized Rig metadata is not guessed away');

const danglingMotionRig = createPartAsset({ id: 'dangling-motion-asset' });
const danglingMotionModel = makeTimeline([danglingMotionRig], [makeClip('dangling-motion-clip', danglingMotionRig.id, {
    layerId: danglingMotionRig.selectedLayerId,
    rigMotion: partMotion('missing-part', [0])
})]);
assert.equal(danglingMotionModel.getClipAssetRigResetPlan(danglingMotionRig.id).ok, false,
    'unsupported Clip references are refused');

const atomicAsset = createPartAsset({ id: 'atomic-asset' });
const atomicModel = makeTimeline([atomicAsset], [
    makeClip('atomic-clip-a', atomicAsset.id, {
        layerId: atomicAsset.selectedLayerId,
        rigMotion: partMotion(atomicAsset.selectedLayerId, [0])
    }),
    makeClip('atomic-clip-b', atomicAsset.id, {
        layerId: atomicAsset.selectedLayerId,
        rigMotion: partMotion(atomicAsset.selectedLayerId, [0])
    })
]);
const atomicSecondClip = atomicModel.getClipById('atomic-clip-b');
const atomicSecondMotion = atomicSecondClip.rigMotion;
Object.defineProperty(atomicSecondClip, 'rigMotion', {
    configurable: true,
    get: () => atomicSecondMotion,
    set: () => { throw new Error('injected Clip write failure'); }
});
const atomicFirstMotion = atomicModel.getClipById('atomic-clip-a').rigMotion;
const atomicAssetBefore = atomicModel.getClipAsset(atomicAsset.id).rigDefinition;
const atomicResult = atomicModel.resetClipAssetRig(atomicAsset.id);
assert.equal(atomicResult.ok, false);
assert.equal(atomicModel.getClipAsset(atomicAsset.id).rigDefinition, atomicAssetBefore,
    'model mutation failure restores the Asset fields');
assert.equal(atomicModel.getClipById('atomic-clip-a').rigMotion, atomicFirstMotion,
    'model mutation failure restores already-updated Clip Motion');
assert.equal(atomicModel.getClipById('atomic-clip-b').rigMotion, atomicSecondMotion,
    'failed Clip Motion write remains unchanged');

const armHandler = frameSource.match(/_armRigResetConfirmation\(\) \{[\s\S]*?\n    _cancelRigResetConfirmation\(\)/u)?.[0] || '';
assert.ok(armHandler, 'inline reset confirmation has an explicit arm handler');
assert.doesNotMatch(armHandler, /resetRigLensSetup/u,
    'the first click only opens confirmation and never removes data');
assert.match(frameSource, /rigResetConfirmationOpen = true/u);
assert.match(frameSource, /_confirmRigReset\(\)[\s\S]*?resetRigLensSetup/u,
    'deletion is limited to the explicit confirmation action');
assert.match(frameSource, /this\.rigAuthoringKind = null;[\s\S]*?this\.rigLensMode = 'setup'/u,
    'successful Reset returns to an unselected runtime RIG Lens');
assert.doesNotMatch(frameSource, /window\.confirm\(/u, 'reset does not use window.confirm');
assert.match(frameSource, /affectedClipCount[\s\S]*?affectedRigKeyCount/u,
    'confirmation counts come from the live model plan');
const frameGuard = frameSource.match(/_getRigResetFrameBlockReason\(\) \{[\s\S]*?\n    \}\n\n    _formatRigResetReason/u)?.[0] || '';
assert.match(frameGuard, /this\.rigPointerGesture \|\| this\.rigStructureDrag \|\| this\.rigPlacementMode/u,
    'active RIG pointer and placement gestures block Reset');
assert.match(frameGuard, /this\._hasRigPosePreview\(table\)[\s\S]*?table\?\.isPlaying === true/u,
    'Pose preview and playback block Reset');
assert.match(frameGuard, /transformSessionActive === true[\s\S]*?getLayerMoveCommitState[\s\S]*?hasPendingTransform === true/u,
    'active and unresolved Transform state blocks Reset');
const popupResetPlan = popupSource.match(/getRigLensResetPlan\(assetId\) \{[\s\S]*?\n    \}\n\n    resetRigLensSetup/u)?.[0] || '';
assert.match(popupResetPlan, /_rigPivotGesture[\s\S]*?_rigMeshVertexEditGesture[\s\S]*?isClipEditModeActive[\s\S]*?isPlaying/u,
    'model-owned RIG gestures, Clip editing, and playback block Reset');
assert.match(popupSource, /_restoreTimelineHistoryState\(beforeState\)[\s\S]*?Timeline Historyへ記録できない/u,
    'History failure rolls back the full Timeline before-state');
const resetPopupStart = popupSource.indexOf('resetRigLensSetup(');
const resetPopupMethod = popupSource.slice(resetPopupStart, popupSource.indexOf('\n    }', resetPopupStart));
assert.ok(resetPopupStart >= 0 && resetPopupMethod.includes("'caf-rig-lens-reset'"),
    'the reset records a dedicated Timeline History item');
assert.ok(popupSource.includes("historyKind: 'timeline'"),
    'the existing History wrapper labels the reset item as Timeline History');
assert.ok(modelSource.includes("import { createClipAssetRigResetPlan } from './rig-reset.js';"),
    'Asset and Clip cleanup use the bounded reset planner');
assert.ok(read('system/animation/rig-reset.js').includes('removeRigMotionTargets'),
    'Asset and Clip cleanup share the existing rig-motion removal helper');

console.log('verify-rig-lens-reset: bounded PART/DEFORM cleanup, shared Clip counts, Timeline Undo/Redo, rollback, and unsupported-state refusal OK');
