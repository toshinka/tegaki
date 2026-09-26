import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ALPHA_FIT_GRID_GENERATOR } from '../system/animation/raster-bone-auto-setup.js';
import { AUTO_SHAPE_FILL_GENERATOR } from '../system/animation/auto-shape-raster-bone-setup.js';
import { AUTO_SHAPE_LINE_RIBBON_GENERATOR } from '../system/animation/line-ribbon-raster-bone-setup.js';
import { FIXED_TOPOLOGY_SKIN_WEIGHT_BRUSH_MODE } from '../system/animation/skin-weight-brush.js';
import { LIMITED_SKIN_CORRECTION_MODE } from '../system/animation/skin-influence-correction.js';
import { FIXED_VERTEX_POSITION_EDIT_MODE } from '../system/animation/raster-mesh-vertex-position-edit.js';
import { inspectStaticRigBindAdjustmentTarget } from '../system/animation/rig-static-authoring.js';
import { runStaticRigBindRebindTransaction } from '../system/animation/rig-bind-rebind-transaction.js';
import { validateRasterBoneSkinning } from '../system/animation/raster-bone-skinning.js';

globalThis.window = globalThis.window || {};
const { TimelineModel, ClipAssetModel } = await import('../system/animation/animation-data-model.js');
const { HistoryManager } = await import('../system/history.js');
const { upsertRigBoneKey } = await import('../system/animation/part-rig.js');

const buildRoot = path.dirname(fileURLToPath(import.meta.url));
const workRoot = path.dirname(buildRoot);
const popupSource = fs.readFileSync(path.join(workRoot, 'ui/animation-table-popup.js'), 'utf8');
const workspaceSource = fs.readFileSync(path.join(workRoot, 'ui/right-workspace-frame.js'), 'utf8');
const staticGetterStart = popupSource.indexOf('getRigLensStaticEditTarget(');
const bindGetterStart = popupSource.indexOf('getRigLensStaticBindAdjustmentTarget(');
const partGetterStart = popupSource.indexOf('getRigLensPartTarget(');
assert.ok(staticGetterStart >= 0 && bindGetterStart > staticGetterStart && partGetterStart > bindGetterStart);
const structureGuard = popupSource.slice(staticGetterStart, bindGetterStart);
const bindGuard = popupSource.slice(bindGetterStart, partGetterStart);
assert.match(structureGuard, /_hasRigLensBoneMotionKeys/u,
    'general structure guard still rejects existing Motion KEYs');
assert.match(bindGuard, /allowBound:\s*true[\s\S]*inspectStaticRigBindAdjustmentTarget/u);
assert.doesNotMatch(bindGuard, /_hasRigLensBoneMotionKeys/u,
    'Motion KEYs do not block the operation-specific Bind route');
for (const methodName of [
    'createRigLensStaticStructureBone(',
    'setRigLensStaticBoneParent(',
    'removeRigLensStaticBone('
]) {
    const start = popupSource.indexOf(methodName);
    const end = popupSource.indexOf('\n    }', start);
    assert.ok(start >= 0 && end > start);
    assert.match(popupSource.slice(start, end), /getRigLensStaticEditTarget/u,
        methodName + ' remains under the general structure guard');
}
for (const methodName of [
    'beginRigLensStaticBoneGesture(',
    'projectRigLensStaticBonePoint(',
    'previewRigLensStaticBoneBind(',
    'finishRigLensStaticBoneGesture('
]) {
    const start = popupSource.indexOf(methodName);
    const end = popupSource.indexOf('\n    }', start);
    assert.ok(start >= 0 && end > start);
    assert.match(popupSource.slice(start, end), /getRigLensStaticBindGestureTarget/u,
        methodName + ' uses Bind-only permission');
}
const finishStart = popupSource.indexOf('finishRigLensStaticBoneGesture(');
const finishEnd = popupSource.indexOf('\n    }', finishStart);
const finishSource = popupSource.slice(finishStart, finishEnd);
const previewStart = popupSource.indexOf('previewRigLensStaticBoneBind(');
const previewEnd = popupSource.indexOf('\n    }', previewStart);
assert.doesNotMatch(popupSource.slice(previewStart, previewEnd), /generateClipAssetRasterBoneSetup/u,
    'pointer-move preview never regenerates AUTO GRID');
assert.match(finishSource, /runStaticRigBindRebindTransaction/u);
assert.match(finishSource, /generateClipAssetRasterBoneSetup\([\s\S]*?generatorMode:\s*'alpha-fit-grid'/u);
assert.match(finishSource, /_recordInternalLayerHistoryFromStates/u);
assert.match(finishSource, /_restoreInternalLayerHistoryState/u);
assert.match(workspaceSource, /getRigLensStaticBindGestureTarget/u);
const beginStart = popupSource.indexOf('beginRigLensStaticBoneGesture(');
const beginEnd = popupSource.indexOf('\n    }', beginStart);
assert.match(popupSource.slice(beginStart, beginEnd), /beforeState\?\.asset[\s\S]*beforeState\.assetId/u,
    'the Bind preview cannot start without a rollback-capable CAF snapshot');

const width = 16;
const height = 8;
const pixels = new Uint8ClampedArray(width * height * 4);
for (let y = 1; y < height - 1; y++) {
    for (let x = 2; x < width - 2; x++) pixels[(y * width + x) * 4 + 3] = 255;
}
const snapshot = {
    id: 'snapshot-rebind', width, height,
    rasterBounds: { x: 0, y: 0, width, height }, pixels, updatedAt: 1
};
const rigDefinition = {
    version: 1,
    parts: [],
    bones: [
        {
            boneId: 'root', parentBoneId: null, name: 'Root', length: 5,
            bindTransform: { x: 4, y: 4, scaleX: 1, scaleY: 1, rotation: 0, pivotX: 0, pivotY: 0 }
        },
        {
            boneId: 'child', parentBoneId: 'root', name: 'Child', length: 5,
            bindTransform: { x: 5, y: 0, scaleX: 1, scaleY: 1, rotation: 0, pivotX: 0, pivotY: 0 }
        }
    ]
};
const keyA = upsertRigBoneKey(null, 'root', 0, {
    x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, pivotX: 0, pivotY: 0
}).value;
const keyB = upsertRigBoneKey(null, 'child', 2, {
    x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0.2, pivotX: 0, pivotY: 0
}).value;
const model = new TimelineModel({
    totalFrames: 8,
    drawingSnapshots: [snapshot],
    clipAssets: [{
        id: 'asset',
        internalLayers: [{ id: 'raster', name: 'Raster', type: 'raster', drawingSnapshotId: snapshot.id }],
        rigDefinition
    }],
    tracks: [{ id: 'lane', cels: [
        { id: 'clip-a', assetId: 'asset', startFrame: 0, duration: 4, rigMotion: keyA },
        { id: 'clip-b', assetId: 'asset', startFrame: 4, duration: 4, rigMotion: keyB }
    ] }]
});
assert.equal(model.generateClipAssetRasterBoneSetup('asset', 'raster', {
    generatorMode: 'alpha-fit-grid'
}).ok, true, 'the fixture starts with an AUTO GRID Mesh and Skin');

const inspect = (candidate, meshStatus) =>
    inspectStaticRigBindAdjustmentTarget(candidate, 'raster', { meshStatus });
let asset = model.getClipAsset('asset');
let meshStatus = model.getClipAssetRasterMeshStatus('asset', 'raster');
assert.equal(inspect(asset, meshStatus).ok, true, 'one current AUTO GRID and one Root is safe');

const unsafe = (mutateAsset, mutateStatus = status => status) => {
    const copy = structuredClone(model.getClipAsset('asset').serialize());
    mutateAsset(copy);
    const current = model.getClipAssetRasterMeshStatus('asset', 'raster');
    const status = mutateStatus({ ...current, mesh: copy.meshDefinitions?.[0] || null });
    return inspect(copy, status);
};
assert.equal(unsafe(copy => copy.meshDefinitions.push(structuredClone(copy.meshDefinitions[0]))).ok, false,
    'multiple Meshes remain locked');
assert.equal(unsafe(copy => { copy.meshDefinitions[0].targetInternalLayerId = 'other-raster'; }).ok, false,
    'a Mesh targeting another Raster remains locked');
for (const type of [AUTO_SHAPE_FILL_GENERATOR, AUTO_SHAPE_LINE_RIBBON_GENERATOR, 'manual']) {
    assert.equal(unsafe(copy => { copy.meshDefinitions[0].generator.type = type; }).ok, false,
        type + ' / manual meshes remain locked');
}
assert.equal(unsafe(copy => { copy.meshDefinitions[0].manual = true; }).ok, false,
    'explicit manual Meshes remain locked');
assert.equal(unsafe(copy => {
    copy.meshDefinitions[0].generator.topologyEditMode = FIXED_VERTEX_POSITION_EDIT_MODE;
}).ok, false, 'fixed-topology edits remain locked');
for (const mode of [LIMITED_SKIN_CORRECTION_MODE, FIXED_TOPOLOGY_SKIN_WEIGHT_BRUSH_MODE]) {
    assert.equal(unsafe(copy => { copy.meshDefinitions[0].generator.weightCorrectionMode = mode; }).ok, false,
        mode + ' remains locked');
}
assert.equal(unsafe(copy => { copy.skinBindings.push(structuredClone(copy.skinBindings[0])); }).ok, false,
    'extra Skin bindings remain locked');
assert.equal(unsafe(() => {}, status => ({ ...status, state: 'stale' })).ok, false,
    'stale AUTO GRID remains locked');
assert.equal(unsafe(copy => { copy.rigDefinition.bones[1].parentBoneId = null; }).ok, false,
    'multiple Roots remain locked');
assert.equal(unsafe(copy => { copy.rigDefinition.bones = []; }).ok, false,
    'a missing Root remains locked');

const clipMotionBefore = model.tracks[0].cels.map(clip => [clip.id, JSON.stringify(clip.rigMotion)]);
const history = new HistoryManager();
const restoreAsset = state => {
    const index = model.clipAssets.findIndex(candidate => candidate.id === 'asset');
    if (index < 0 || !state) return false;
    model.clipAssets[index] = new ClipAssetModel(state);
    return true;
};
const applyGesture = transform => {
    const beforeState = structuredClone(model.getClipAsset('asset').serialize());
    assert.equal(model.setClipAssetRigBoneBindTransform('asset', 'root', transform).ok, true);
    const transaction = runStaticRigBindRebindTransaction({
        regenerate: () => model.generateClipAssetRasterBoneSetup('asset', 'raster', {
            generatorMode: 'alpha-fit-grid'
        }),
        captureAfterState: () => structuredClone(model.getClipAsset('asset').serialize()),
        recordHistory: afterState => {
            const previousIndex = history.index;
            history.record({
                name: 'caf-rig-bone-bind-rebind',
                do: () => restoreAsset(afterState),
                undo: () => restoreAsset(beforeState),
                meta: {
                    type: 'caf-rig-bone-bind-rebind',
                    assetId: 'asset',
                    historyKind: 'caf-asset'
                }
            });
            return history.index === previousIndex + 1
                && history.stack[history.index]?.meta?.historyKind === 'caf-asset';
        },
        rollback: () => restoreAsset(beforeState)
    });
    return { beforeState, transaction };
};

const beforeMove = structuredClone(model.getClipAsset('asset').serialize());
const move = applyGesture({ x: 11, y: 13, rotation: 0 });
assert.equal(move.transaction.ok, true, 'Bind position preview regenerates on gesture finish');
assert.ok(Number.isFinite(move.transaction.regenerationMs) && move.transaction.regenerationMs >= 0);
assert.equal(history.index, 0);
assert.equal(history.stack.length, 1, 'one move gesture adds one CAF History entry');
assert.equal(history.stack[0].meta.historyKind, 'caf-asset');
const afterMove = structuredClone(model.getClipAsset('asset').serialize());
assert.notDeepEqual(afterMove.meshDefinitions, beforeMove.meshDefinitions, 'Mesh regenerated after move');
assert.notDeepEqual(afterMove.skinBindings, beforeMove.skinBindings, 'Skin regenerated after move');
history.undo();
assert.deepEqual(model.getClipAsset('asset').serialize(), beforeMove,
    'one Undo restores Bind, Mesh, and Skin together');
history.redo();
assert.deepEqual(model.getClipAsset('asset').serialize(), afterMove,
    'one Redo reapplies Bind, Mesh, and Skin together');

const beforeRotate = structuredClone(model.getClipAsset('asset').serialize());
const rotate = applyGesture({ x: 11, y: 13, rotation: 0.35 });
assert.equal(rotate.transaction.ok, true, 'Bind rotation uses the same existing rebind transaction');
assert.equal(history.index, 1);
assert.equal(history.stack.length, 2, 'one rotation gesture adds one more CAF History entry');
const afterRotate = structuredClone(model.getClipAsset('asset').serialize());
history.undo();
assert.deepEqual(model.getClipAsset('asset').serialize(), beforeRotate,
    'rotation Undo restores the pre-rotation asset');
history.redo();
assert.deepEqual(model.getClipAsset('asset').serialize(), afterRotate,
    'rotation Redo restores the regenerated asset');

assert.deepEqual(model.tracks[0].cels.map(clip => [clip.id, JSON.stringify(clip.rigMotion)]), clipMotionBefore,
    'all shared-asset Clips retain rigMotion and KEY data byte-for-byte');
assert.deepEqual(model.getClipAsset('asset').rigDefinition.bones.map(bone => bone.boneId), ['root', 'child'],
    'regeneration preserves Bone IDs');

const beforeFailedGesture = structuredClone(model.getClipAsset('asset').serialize());
assert.equal(model.setClipAssetRigBoneBindTransform('asset', 'root', {
    x: 21, y: 19, rotation: 0.6
}).ok, true);
const historyCountBeforeFailure = history.stack.length;
const failed = runStaticRigBindRebindTransaction({
    regenerate: () => ({ ok: false, reason: 'fixture-regeneration-failure' }),
    captureAfterState: () => structuredClone(model.getClipAsset('asset').serialize()),
    recordHistory: () => { throw new Error('must not record after a failed regeneration'); },
    rollback: () => restoreAsset(beforeFailedGesture)
});
assert.equal(failed.ok, false);
assert.equal(failed.rolledBack, true);
assert.match(failed.reason, /fixture-regeneration-failure/u);
assert.deepEqual(model.getClipAsset('asset').serialize(), beforeFailedGesture,
    'regeneration failure restores the complete pre-gesture CAF asset');
assert.equal(history.stack.length, historyCountBeforeFailure,
    'regeneration failure adds no History');

const reloaded = new TimelineModel(model.serialize());
const reloadedAsset = reloaded.getClipAsset('asset');
const reloadedStatus = reloaded.getClipAssetRasterMeshStatus('asset', 'raster');
assert.equal(reloadedStatus.state, 'current', 'serialized Mesh source remains current');
assert.equal(validateRasterBoneSkinning(
    reloadedAsset.meshDefinitions,
    reloadedAsset.skinBindings,
    reloadedAsset.internalLayers,
    reloadedAsset.rigDefinition
).ok, true, 'serialization preserves valid Mesh / Skin / Bone references');
assert.deepEqual(reloadedAsset.rigDefinition.bones,
    model.getClipAsset('asset').rigDefinition.bones,
    'serialization preserves the final Bind pose and stable Bone identity');
assert.deepEqual(reloadedAsset.meshDefinitions, model.getClipAsset('asset').meshDefinitions,
    'serialization preserves the regenerated Mesh');
assert.deepEqual(reloadedAsset.skinBindings, model.getClipAsset('asset').skinBindings,
    'serialization preserves the regenerated Skin');
assert.deepEqual(reloaded.tracks[0].cels.map(clip => [clip.id, JSON.stringify(clip.rigMotion)]), clipMotionBefore,
    'serialization preserves shared-asset Motion KEY data');

// Practical generation sample: 512x512 Raster, 2 Bones, one AUTO GRID regenerate.
const practicalPixels = new Uint8ClampedArray(512 * 512 * 4);
for (let y = 48; y < 464; y++) {
    for (let x = 64; x < 448; x++) practicalPixels[(y * 512 + x) * 4 + 3] = 255;
}
const practicalSnapshot = {
    id: 'snapshot-practical', width: 512, height: 512,
    rasterBounds: { x: 0, y: 0, width: 512, height: 512 },
    pixels: practicalPixels, updatedAt: 1
};
const practicalModel = new TimelineModel({
    totalFrames: 1,
    drawingSnapshots: [practicalSnapshot],
    clipAssets: [{
        id: 'practical-asset',
        internalLayers: [{
            id: 'practical-raster', type: 'raster',
            drawingSnapshotId: practicalSnapshot.id
        }],
        rigDefinition
    }],
    tracks: [{ id: 'practical-lane', cels: [
        { id: 'practical-clip', assetId: 'practical-asset', duration: 1 }
    ] }]
});
const practical = runStaticRigBindRebindTransaction({
    regenerate: () => practicalModel.generateClipAssetRasterBoneSetup(
        'practical-asset', 'practical-raster', { generatorMode: 'alpha-fit-grid' }
    ),
    captureAfterState: () => practicalModel.getClipAsset('practical-asset').serialize(),
    recordHistory: () => true,
    rollback: () => true
});
assert.equal(practical.ok, true, '512x512 generation fixture completes');
assert.equal(practical.result.meshDefinition.generator.type, ALPHA_FIT_GRID_GENERATOR);
console.log(
    'verify-rig-safe-rebind-loop: PASS; 512x512 AUTO GRID generation ',
    practical.regenerationMs.toFixed(2),
    ' ms; ',
    practical.result.meshDefinition.vertices.length,
    ' vertices'
);
