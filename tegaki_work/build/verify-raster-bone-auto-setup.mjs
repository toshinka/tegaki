import assert from 'node:assert/strict';

import {
    ALPHA_FIT_GRID_GENERATOR,
    createAlphaFitRasterBoneSetup,
    getAlphaFitRasterMeshStatus
} from '../system/animation/raster-bone-auto-setup.js';
import { validateRasterBoneSkinning } from '../system/animation/raster-bone-skinning.js';

globalThis.window = globalThis.window || {};
const { TimelineModel } = await import('../system/animation/animation-data-model.js');

const width = 12;
const height = 6;
const pixels = new Uint8ClampedArray(width * height * 4);
for (let y = 1; y <= 4; y++) {
    for (let x = 2; x <= 9; x++) pixels[(y * width + x) * 4 + 3] = 255;
}
const snapshot = {
    id: 'snapshot-arm',
    width,
    height,
    rasterBounds: { x: 0, y: 0, width, height },
    pixels,
    updatedAt: 100
};
const rigDefinition = {
    version: 1,
    parts: [],
    bones: [
        {
            boneId: 'shoulder',
            parentBoneId: null,
            name: 'Shoulder',
            bindTransform: { x: 2, y: 3, scaleX: 1, scaleY: 1, rotation: 0, pivotX: 0, pivotY: 0 },
            length: 4
        },
        {
            boneId: 'wrist',
            parentBoneId: 'shoulder',
            name: 'Wrist',
            bindTransform: { x: 4, y: 0, scaleX: 1, scaleY: 1, rotation: 0, pivotX: 0, pivotY: 0 },
            length: 4
        }
    ]
};
const asset = {
    id: 'asset-arm',
    internalLayers: [{
        id: 'arm-raster',
        name: 'Arm',
        type: 'raster',
        drawingSnapshotId: snapshot.id
    }],
    rigDefinition
};

const generated = createAlphaFitRasterBoneSetup(asset, 'arm-raster', snapshot, {
    boneIds: ['shoulder', 'wrist']
});
assert.equal(generated.ok, true, 'alpha-fit setup generated');
assert.deepEqual(generated.dimensions, { columns: 8, rows: 4, pointCount: 32 }, 'wide Raster selects strip grid');
assert.equal(generated.meshDefinition.vertices.length, 32, 'grid vertex count');
assert.equal(generated.meshDefinition.triangles.length, 42, 'grid triangle count');
assert.equal(generated.meshDefinition.generator.type, ALPHA_FIT_GRID_GENERATOR, 'generator provenance stored');
assert.deepEqual(generated.contentBounds, { x: 2, y: 1, width: 8, height: 4 }, 'alpha tight bounds');
assert.deepEqual(generated.bindBounds, { x: 1, y: 0, width: 10, height: 6 }, 'one-pixel padding stays inside Raster');
generated.skinBinding.vertexWeights.forEach(vertexWeight => {
    assert.ok(vertexWeight.influences.length >= 1 && vertexWeight.influences.length <= 2, 'maximum two influences');
    const total = vertexWeight.influences.reduce((sum, influence) => sum + influence.weight, 0);
    assert.ok(Math.abs(total - 1) < 1e-10, 'distance weights normalize to one');
});
assert.equal(validateRasterBoneSkinning(
    [generated.meshDefinition],
    [generated.skinBinding],
    asset.internalLayers,
    rigDefinition
).ok, true, 'generated setup validates against static schema');

const repeated = createAlphaFitRasterBoneSetup(asset, 'arm-raster', snapshot, {
    boneIds: ['shoulder', 'wrist']
});
assert.deepEqual(repeated, generated, 'fixed input generation is deterministic');
assert.equal(getAlphaFitRasterMeshStatus(generated.meshDefinition, snapshot).state, 'current', 'unchanged source is current');
assert.equal(
    getAlphaFitRasterMeshStatus(generated.meshDefinition, { ...snapshot, updatedAt: 101 }).state,
    'stale',
    'source update marks stale without regeneration'
);

const model = new TimelineModel({
    totalFrames: 4,
    drawingSnapshots: [snapshot],
    clipAssets: [{ ...asset }],
    tracks: [{ id: 'lane-arm', cels: [{ id: 'clip-arm', assetId: asset.id, duration: 4 }] }]
});
const modelGenerated = model.generateClipAssetRasterBoneSetup(asset.id, 'arm-raster');
assert.equal(modelGenerated.ok, true, 'TimelineModel installs alpha-fit Mesh / Skin');
assert.equal(model.getClipAsset(asset.id).meshDefinitions.length, 1, 'one target has one Mesh');
assert.equal(model.getClipAssetRasterMeshStatus(asset.id, 'arm-raster').state, 'current', 'model reports current generator source');
model.getDrawingSnapshot(snapshot.id).updatedAt = 102;
assert.equal(model.getClipAssetRasterMeshStatus(asset.id, 'arm-raster').state, 'stale', 'editing Raster only marks existing Mesh stale');
assert.equal(model.getClipAsset(asset.id).meshDefinitions[0].meshId, modelGenerated.meshDefinition.meshId, 'stale check does not overwrite Mesh');
const regenerated = model.generateClipAssetRasterBoneSetup(asset.id, 'arm-raster');
assert.equal(regenerated.ok, true, 'explicit regenerate succeeds');
assert.equal(model.getClipAsset(asset.id).meshDefinitions.length, 1, 'regenerate replaces rather than duplicates target Mesh');
assert.notEqual(regenerated.meshDefinition.meshId, modelGenerated.meshDefinition.meshId, 'explicit regenerate receives new stable ids');
assert.equal(model.getClipAssetRasterMeshStatus(asset.id, 'arm-raster').state, 'current', 'explicit regenerate clears stale');
const assetDuplicate = model.duplicateClipAsset(asset.id);
assert.equal(assetDuplicate.ok, true, 'auto-fit asset duplicates');
const duplicatedAssetMesh = assetDuplicate.asset.meshDefinitions[0];
assert.equal(
    model.getClipAssetRasterMeshStatus(
        assetDuplicate.asset.id,
        duplicatedAssetMesh.targetInternalLayerId
    ).state,
    'current',
    'asset duplicate rebases generator source to duplicated Snapshot'
);
const layerDuplicate = model.duplicateClipAssetInternalLayer(asset.id, 'arm-raster');
assert.equal(layerDuplicate.ok, true, 'auto-fit Raster duplicates inside Asset');
assert.equal(
    model.getClipAssetRasterMeshStatus(asset.id, layerDuplicate.layer.id).state,
    'current',
    'internal Raster duplicate rebases generator source to duplicated Snapshot'
);
const restored = new TimelineModel(model.serialize());
assert.deepEqual(restored.serialize(), model.serialize(), 'auto setup Project round-trip');

console.log('verify-raster-bone-auto-setup: alpha fit, deterministic grid, max-2 distance weights, stale and explicit regenerate OK');
