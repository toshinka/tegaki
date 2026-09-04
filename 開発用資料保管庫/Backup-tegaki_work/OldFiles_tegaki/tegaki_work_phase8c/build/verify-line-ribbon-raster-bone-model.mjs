import assert from 'node:assert/strict';

import { AUTO_SHAPE_LINE_RIBBON_GENERATOR } from '../system/animation/line-ribbon-raster-bone-setup.js';
import { AUTO_SHAPE_FILL_GENERATOR } from '../system/animation/auto-shape-raster-bone-setup.js';
import { ALPHA_FIT_GRID_GENERATOR } from '../system/animation/raster-bone-auto-setup.js';

globalThis.window = globalThis.window || {};
const { TimelineModel } = await import('../system/animation/animation-data-model.js');

const rows = [
    '.....................',
    '..#################..',
    '..#################..',
    '..#################..',
    '..#################..',
    '..#################..',
    '.....................'
];
const width = rows[0].length;
const height = rows.length;
const pixels = new Uint8ClampedArray(width * height * 4);
rows.forEach((row, y) => [...row].forEach((value, x) => {
    if (value === '#') pixels[(y * width + x) * 4 + 3] = 255;
}));
const snapshot = {
    id: 'snapshot-line-model',
    width,
    height,
    pixels,
    rasterBounds: { x: 0, y: 0, width, height },
    updatedAt: 100
};
const asset = {
    id: 'asset-line-model',
    internalLayers: [{
        id: 'line-raster',
        name: 'Line Raster',
        type: 'raster',
        drawingSnapshotId: snapshot.id
    }],
    rigDefinition: {
        version: 1,
        parts: [],
        bones: [{
            boneId: 'upper',
            parentBoneId: null,
            name: 'Upper',
            bindTransform: { x: 2, y: 3.5, scaleX: 1, scaleY: 1, rotation: 0, pivotX: 0, pivotY: 0 },
            length: 8
        }, {
            boneId: 'lower',
            parentBoneId: 'upper',
            name: 'Lower',
            bindTransform: { x: 8, y: 0, scaleX: 1, scaleY: 1, rotation: 0, pivotX: 0, pivotY: 0 },
            length: 8
        }]
    }
};

const model = new TimelineModel({
    totalFrames: 4,
    drawingSnapshots: [snapshot],
    clipAssets: [{ ...asset }],
    tracks: [{ id: 'lane-line-model', cels: [{ id: 'clip-line-model', assetId: asset.id, duration: 4 }] }]
});
const options = {
    boneIds: ['upper', 'lower'],
    stationSpacing: 2,
    idFactory: kind => `model-line-${kind}`
};
const generated = model.generateClipAssetLineRibbonBoneSetup(asset.id, 'line-raster', options);
assert.equal(generated.ok, true, generated.reason);
assert.equal(generated.generatorMode, 'auto-shape-line');
assert.equal(generated.meshDefinition.generator.type, AUTO_SHAPE_LINE_RIBBON_GENERATOR);
assert.equal(model.getClipAsset(asset.id).meshDefinitions.length, 1);
assert.equal(model.getClipAsset(asset.id).skinBindings.length, 1);
assert.equal(model.getClipAssetRasterMeshStatus(asset.id, 'line-raster').state, 'current');

const meshBeforeRejectedRegenerate = structuredClone(model.getClipAsset(asset.id).meshDefinitions);
const skinBeforeRejectedRegenerate = structuredClone(model.getClipAsset(asset.id).skinBindings);
const rejectedRegenerate = model.generateClipAssetLineRibbonBoneSetup(asset.id, 'line-raster', {
    ...options,
    boneIds: ['upper']
});
assert.equal(rejectedRegenerate.ok, false);
assert.equal(rejectedRegenerate.reason, 'line-ribbon-bone-count');
assert.deepEqual(model.getClipAsset(asset.id).meshDefinitions, meshBeforeRejectedRegenerate);
assert.deepEqual(model.getClipAsset(asset.id).skinBindings, skinBeforeRejectedRegenerate);

const switchModel = new TimelineModel({
    totalFrames: 4,
    drawingSnapshots: [{ ...snapshot, pixels: new Uint8ClampedArray(snapshot.pixels) }],
    clipAssets: [{ ...asset }],
    tracks: [{ id: 'lane-line-switch', cels: [{ id: 'clip-line-switch', assetId: asset.id, duration: 4 }] }]
});
const generatedGrid = switchModel.generateClipAssetRasterBoneSetup(asset.id, 'line-raster', {
    ...options,
    generatorMode: 'alpha-fit-grid',
    columns: 4,
    rows: 4
});
assert.equal(generatedGrid.ok, true, generatedGrid.reason);
assert.equal(generatedGrid.meshDefinition.generator.type, ALPHA_FIT_GRID_GENERATOR);
const generatedShape = switchModel.generateClipAssetRasterBoneSetup(asset.id, 'line-raster', {
    ...options,
    generatorMode: 'auto-shape',
    maxVertices: 128,
    maxBoundaryVertices: 48,
    reservedInteriorVertices: 16,
    maxAreaError: 1,
    guardDistance: 0.5
});
assert.equal(generatedShape.ok, true, generatedShape.reason);
assert.equal(generatedShape.meshDefinition.generator.type, AUTO_SHAPE_FILL_GENERATOR);
const regeneratedLine = switchModel.generateClipAssetRasterBoneSetup(asset.id, 'line-raster', {
    ...options,
    generatorMode: 'auto-shape-line'
});
assert.equal(regeneratedLine.ok, true, regeneratedLine.reason);
assert.equal(regeneratedLine.meshDefinition.generator.type, AUTO_SHAPE_LINE_RIBBON_GENERATOR);
assert.equal(switchModel.getClipAsset(asset.id).meshDefinitions.length, 1);
assert.equal(switchModel.getClipAsset(asset.id).skinBindings.length, 1);

model.getDrawingSnapshot(snapshot.id).updatedAt = 101;
assert.equal(model.getClipAssetRasterMeshStatus(asset.id, 'line-raster').state, 'stale');
assert.equal(
    model.getClipAsset(asset.id).meshDefinitions[0].meshId,
    generated.meshDefinition.meshId,
    'STALE status does not mutate the existing LINE mesh'
);
assert.equal(model.rebaseClipAssetRasterMeshSource(asset.id, 'line-raster').changed, true);
assert.equal(model.getClipAssetRasterMeshStatus(asset.id, 'line-raster').state, 'current');

const duplicatedAsset = model.duplicateClipAsset(asset.id);
assert.equal(duplicatedAsset.ok, true, duplicatedAsset.reason);
assert.equal(
    model.getClipAssetRasterMeshStatus(
        duplicatedAsset.asset.id,
        duplicatedAsset.asset.meshDefinitions[0].targetInternalLayerId
    ).state,
    'current',
    'CAF duplicate rebases LINE source without rebuilding topology'
);
const duplicatedLayer = model.duplicateClipAssetInternalLayer(asset.id, 'line-raster');
assert.equal(duplicatedLayer.ok, true, duplicatedLayer.reason);
assert.equal(model.getClipAssetRasterMeshStatus(asset.id, duplicatedLayer.layer.id).state, 'current');

const restored = new TimelineModel(model.serialize());
assert.deepEqual(restored.serialize(), model.serialize(), 'LINE adapter Project round-trip');

const brokenAsset = {
    ...asset,
    id: 'asset-line-model-broken',
    rigDefinition: { ...asset.rigDefinition, bones: [asset.rigDefinition.bones[0]] }
};
const brokenModel = new TimelineModel({
    totalFrames: 1,
    drawingSnapshots: [snapshot],
    clipAssets: [{ ...brokenAsset }],
    tracks: [{ id: 'lane-broken', cels: [{ id: 'clip-broken', assetId: brokenAsset.id, duration: 1 }] }]
});
const rejected = brokenModel.generateClipAssetLineRibbonBoneSetup(
    brokenAsset.id,
    'line-raster',
    options
);
assert.equal(rejected.ok, false);
assert.equal(rejected.reason, 'line-ribbon-bone-count');
assert.equal(brokenModel.getClipAsset(brokenAsset.id).meshDefinitions?.length || 0, 0);

console.log('verify-line-ribbon-raster-bone-model: explicit GRID/SHAPE/LINE dispatch and replace, CURRENT/STALE/rebase, CAF/Raster duplicate and Project round-trip preserve existing Mesh/Skin authority; invalid chain is rejected without mutation OK');
