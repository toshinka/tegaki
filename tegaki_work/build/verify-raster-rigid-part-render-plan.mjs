import assert from 'node:assert/strict';

import { sampleClipBakeState } from '../system/animation/clip-bake-sampler.js';
import {
    calculateFolderPartAssetBounds,
    calculateRigPartAssetBounds,
    createFolderEffectRenderPlan,
    createFolderPartRenderPlan,
    createRigPartRenderPlan,
    getRigPartRenderIsland
} from '../system/animation/folder-part-render-plan.js';
import { createRasterSkinRenderPlan } from '../system/animation/raster-skin-render-plan.js';
import { resolveRigPartTarget } from '../system/animation/rig-part-target.js';
import { createAffineTransformMatrix } from '../system/transform-math.js';

globalThis.window = {};
const {
    ClipAssetModel,
    DrawingSnapshotModel,
    TimelineModel
} = await import('../system/animation/animation-data-model.js');

const snapshotBounds = { x: 2, y: 3, width: 4, height: 2 };
const snapshot = new DrawingSnapshotModel({
    id: 'root-raster-snapshot',
    ...snapshotBounds,
    rasterBounds: snapshotBounds,
    pixels: new Uint8ClampedArray(snapshotBounds.width * snapshotBounds.height * 4).fill(255)
});
const model = new TimelineModel({ fps: 8, totalFrames: 4, drawingSnapshots: [snapshot] });
const rootRaster = model.createClipAssetInternalLayer({
    id: 'root-raster',
    name: 'Root Raster',
    type: 'raster',
    drawingSnapshotId: snapshot.id
});
const folder = model.createClipAssetInternalLayer({
    id: 'paint-folder',
    name: 'Paint Folder',
    type: 'folder'
});
const nestedRaster = model.createClipAssetInternalLayer({
    id: 'nested-raster',
    name: 'Nested Raster',
    type: 'raster',
    parentLayerId: folder.id
});
const backgroundRaster = model.createClipAssetInternalLayer({
    id: 'background-raster',
    name: 'Background',
    type: 'raster',
    isBackground: true
});
const asset = new ClipAssetModel({
    id: 'root-raster-rig-asset',
    name: 'Root Raster Rig fixture',
    internalLayers: [rootRaster, folder, nestedRaster, backgroundRaster]
});
model.clipAssets.push(asset);

assert.equal(resolveRigPartTarget(asset, folder.id).targetKind, 'folder');
assert.equal(resolveRigPartTarget(asset, rootRaster.id).targetKind, 'raster');
assert.equal(resolveRigPartTarget(asset, nestedRaster.id).reason, 'raster-part-root-required');
assert.equal(resolveRigPartTarget(asset, backgroundRaster.id).reason, 'part-target-background-unsupported');
assert.equal(resolveRigPartTarget(asset, 'missing').reason, 'part-target-not-found');

const registration = model.registerClipAssetRigPart(asset.id, rootRaster.id);
assert.equal(registration.ok, true, 'CAF root Raster registers without a wrapper Folder');
assert.equal(registration.targetKind, 'raster');
assert.equal(
    model.registerClipAssetFolderPart(asset.id, rootRaster.id).reason,
    'folder-required',
    'legacy Folder-only authoring API keeps its contract'
);
const binding = model.registerClipAssetRootBoneBinding(asset.id, rootRaster.id, {
    boneId: 'root-raster-bone',
    name: 'Root Raster PIVOT',
    bindTransform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, pivotX: 0, pivotY: 0 },
    length: 16
});
assert.equal(binding.ok, true, 'Root Raster Part accepts the existing rigid Bone binding');
assert.equal(binding.targetKind, 'raster');
const boneCountBeforeConflict = asset.rigDefinition.bones.length;
assert.equal(
    model.registerClipAssetRasterBone(asset.id, rootRaster.id).reason,
    'rig-mode-conflict',
    'Rigid Root Raster cannot enter Raster Skin authoring'
);
assert.equal(model.generateClipAssetRasterBoneSetup(asset.id, rootRaster.id).reason, 'rig-mode-conflict');
assert.equal(asset.rigDefinition.bones.length, boneCountBeforeConflict, 'conflict rejection is non-mutating');

const lane = model.createIndependentLane({ name: 'Root Raster Rig Lane' });
const clip = lane.addCel({
    id: 'root-raster-rig-clip',
    assetId: asset.id,
    startFrame: 0,
    duration: 3
});
for (const frame of [0, 2]) {
    assert.equal(model.setClipRigBoneKey(clip.id, 'root-raster-bone', frame, {
        x: 9,
        y: -4,
        scaleX: 1,
        scaleY: 1,
        rotation: 0
    }, { interpolation: 'hold' }).ok, true);
}

const plan = createRigPartRenderPlan(asset, clip, 0);
const randomSeekPlan = createRigPartRenderPlan(asset, clip, 2);
assert.equal(plan.status, 'ready');
assert.equal(plan.islands.length, 1);
const island = getRigPartRenderIsland(plan, rootRaster.id);
assert.equal(island.targetKind, 'raster');
assert.equal(island.targetLayerId, rootRaster.id);
assert.equal(island.folderId, null);
assert.deepEqual([...island.layerIds], [rootRaster.id]);
assert.equal(plan.islandByLayerId.get(rootRaster.id), island);
assert.deepEqual(island.worldMatrix, { a: 1, b: 0, c: 0, d: 1, tx: 9, ty: -4 });
assert.deepEqual(randomSeekPlan.islands[0].worldMatrix, island.worldMatrix, 'random seek is stateless');
assert.deepEqual(
    createFolderPartRenderPlan(asset, clip, 0).islands[0].worldMatrix,
    island.worldMatrix,
    'legacy render-plan export delegates to the generic Part authority'
);

const unboundAsset = {
    ...asset,
    rigDefinition: {
        version: 1,
        parts: asset.rigDefinition.parts.map(part => ({ ...part }))
    }
};
const transformFixtures = [
    { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
    { x: 6, y: -2, scaleX: 1, scaleY: 1, rotation: 0 },
    { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: Math.PI / 3 },
    { x: 0, y: 0, scaleX: 1.5, scaleY: 0.5, rotation: 0 },
    { x: -3, y: 5, scaleX: 1.25, scaleY: 0.75, rotation: -Math.PI / 4 }
];
const transformPlans = transformFixtures.map(transform => {
    const transformClip = {
        startFrame: 0,
        duration: 3,
        rigMotion: {
            version: 1,
            partTracks: [{
                partId: rootRaster.id,
                keyframes: [
                    { frame: 0, interpolation: 'hold', ...transform },
                    { frame: 2, interpolation: 'hold', ...transform }
                ]
            }]
        }
    };
    const sequential = createRigPartRenderPlan(unboundAsset, transformClip, 0);
    const seek = createRigPartRenderPlan(unboundAsset, transformClip, 2);
    assert.equal(sequential.status, 'ready');
    assert.deepEqual(sequential.islands[0].worldMatrix, createAffineTransformMatrix(transform));
    assert.deepEqual(sequential.islands[0].worldMatrix, seek.islands[0].worldMatrix);
    return sequential;
});

const bakedState = sampleClipBakeState(clip, 2);
const bakedPlan = createRigPartRenderPlan(asset, {
    ...bakedState,
    startFrame: 0,
    duration: 1
}, 0);
assert.deepEqual(bakedPlan.islands[0].worldMatrix, randomSeekPlan.islands[0].worldMatrix);

const expectedBounds = { x: 11, y: -1, width: 4, height: 2 };
const getLayerBounds = layer => layer.id === rootRaster.id ? snapshotBounds : null;
assert.deepEqual(calculateRigPartAssetBounds(asset, plan, getLayerBounds), expectedBounds);
assert.deepEqual(calculateFolderPartAssetBounds(asset, plan, getLayerBounds), expectedBounds);

const roundTrip = new TimelineModel(model.serialize());
assert.deepEqual(roundTrip.serialize(), model.serialize(), 'Root Raster Rig Project round-trip');
assert.equal(roundTrip.getClipAsset(asset.id).rigDefinition.parts[0].partId, rootRaster.id);
const duplicate = model.duplicateClipAsset(asset.id, { name: 'Root Raster Rig copy' });
assert.equal(duplicate.ok, true, 'CAF asset copy retains Root Raster Rig through the shared id map');
const copiedRootRasterId = duplicate.internalLayerIdMap.get(rootRaster.id);
assert.equal(duplicate.asset.rigDefinition.parts[0].partId, copiedRootRasterId);
assert.equal(
    duplicate.asset.internalLayers.find(layer => layer.id === copiedRootRasterId)?.parentLayerId,
    null
);

const conflictAsset = {
    ...asset,
    meshDefinitions: [{
        version: 1,
        meshId: 'conflicting-mesh',
        targetInternalLayerId: rootRaster.id
    }]
};
assert.equal(resolveRigPartTarget(conflictAsset, rootRaster.id).reason, 'rig-mode-conflict');
const conflictRigPlan = createRigPartRenderPlan(conflictAsset, clip, 0);
assert.equal(conflictRigPlan.status, 'unsupported');
assert.equal(conflictRigPlan.errors[0].code, 'rig-mode-conflict');
const conflictEffectPlan = createFolderEffectRenderPlan(conflictAsset, clip, 0);
assert.equal(
    conflictEffectPlan.status,
    'unsupported',
    'Rig conflict remains explicit even when no Folder WARP is active'
);
const conflictSkinPlan = createRasterSkinRenderPlan(conflictAsset, clip, 0, {
    folderEffectPlan: conflictEffectPlan
});
assert.equal(conflictSkinPlan.status, 'unsupported');
assert.equal(conflictSkinPlan.errors[0].code, 'rig-mode-conflict');

// CPU/Bake/export consumerと同じCanvas adapterがRoot Rasterへ共有matrixを一度だけ適用する。
class FakeContext2D {
    constructor(canvas) {
        this.canvas = canvas;
        this.operations = [];
        this.globalAlpha = 1;
        this.globalCompositeOperation = 'source-over';
    }
    save() { this.operations.push(['save']); }
    restore() { this.operations.push(['restore']); }
    translate(...args) { this.operations.push(['translate', ...args]); }
    transform(...args) { this.operations.push(['transform', ...args]); }
    drawImage(...args) { this.operations.push(['drawImage', ...args]); }
    putImageData(...args) { this.operations.push(['putImageData', ...args]); }
    clearRect(...args) { this.operations.push(['clearRect', ...args]); }
    getImageData(x, y, width, height) {
        return { data: new Uint8ClampedArray(width * height * 4), width, height };
    }
}
const fakeContexts = [];
class FakeCanvas {
    constructor() {
        this.width = 0;
        this.height = 0;
        this.context = new FakeContext2D(this);
        fakeContexts.push(this.context);
    }
    getContext(kind) { return kind === '2d' ? this.context : null; }
}
globalThis.window.TEGAKI_CONFIG = { canvas: { width: 32, height: 32 } };
globalThis.document = { createElement: tag => tag === 'canvas' ? new FakeCanvas() : null };
globalThis.ImageData = class ImageData {
    constructor(data, width, height) {
        this.data = data;
        this.width = width;
        this.height = height;
    }
};

const { TimelineFrameCompositor } = await import('../system/animation/timeline-frame-compositor.js');
const compositor = new TimelineFrameCompositor({
    getDrawingSnapshot(id) { return id === snapshot.id ? snapshot : null; }
});
const surface = compositor._renderAsset(asset, plan);
assert.deepEqual(surface.bounds, expectedBounds);
assert.ok(fakeContexts.some(context => context.operations.some(operation => {
    return operation[0] === 'transform'
        && operation.slice(1).every((value, index) => value === [1, 0, 0, 1, 9, -4][index]);
})), 'Canvas compositor applies the Root Raster Part matrix once');
for (const transformPlan of transformPlans) {
    const matrix = transformPlan.islands[0].worldMatrix;
    compositor._renderAsset(unboundAsset, transformPlan);
    assert.ok(fakeContexts.some(context => context.operations.some(operation => (
        operation[0] === 'transform'
        && operation.slice(1).every((value, index) => (
            value === [matrix.a, matrix.b, matrix.c, matrix.d, matrix.tx, matrix.ty][index]
        ))
    ))), 'Canvas compositor consumes the shared identity/translation/rotation/scale matrix');
}

console.log(
    'verify-raster-rigid-part-render-plan: target resolution, authoring, Bone matrix, random seek, '
    + 'bounds, CPU compositor, save/load, CAF copy, Mesh conflict OK'
);
