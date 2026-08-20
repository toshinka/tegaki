import assert from 'node:assert/strict';

import { AUTO_SHAPE_FILL_GENERATOR } from '../system/animation/auto-shape-raster-bone-setup.js';
import {
    ALPHA_FIT_GRID_GENERATOR,
    createRasterMeshSourceSignature
} from '../system/animation/raster-bone-auto-setup.js';
import { validateRasterBoneSkinning } from '../system/animation/raster-bone-skinning.js';
import {
    createSkinWeightBrushPlan,
    FIXED_TOPOLOGY_SKIN_WEIGHT_BRUSH_MODE
} from '../system/animation/skin-weight-brush.js';

globalThis.window = globalThis.window || {};
const { TimelineModel } = await import('../system/animation/animation-data-model.js');

const snapshot = {
    id: 'snapshot-brush',
    width: 20,
    height: 10,
    rasterBounds: { x: 0, y: 0, width: 20, height: 10 },
    pixels: new Uint8ClampedArray(20 * 10 * 4),
    updatedAt: 100
};

function createAsset(generatorType = ALPHA_FIT_GRID_GENERATOR) {
    return {
        id: 'asset-brush',
        internalLayers: [{
            id: 'raster-brush',
            name: 'Brush target',
            type: 'raster',
            drawingSnapshotId: snapshot.id
        }],
        rigDefinition: {
            version: 1,
            parts: [],
            rigidBindings: [],
            bones: [{
                boneId: 'root',
                parentBoneId: null,
                name: 'Root',
                bindTransform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, pivotX: 0, pivotY: 0 },
                length: 10
            }, {
                boneId: 'arm',
                parentBoneId: 'root',
                name: 'Arm',
                bindTransform: { x: 10, y: 0, scaleX: 1, scaleY: 1, rotation: 0, pivotX: 0, pivotY: 0 },
                length: 10
            }, {
                boneId: 'hand',
                parentBoneId: 'arm',
                name: 'Hand',
                bindTransform: { x: 10, y: 0, scaleX: 1, scaleY: 1, rotation: 0, pivotX: 0, pivotY: 0 },
                length: 5
            }]
        },
        meshDefinitions: [{
            version: 1,
            meshId: 'mesh-brush',
            targetInternalLayerId: 'raster-brush',
            vertices: [
                { vertexId: 'v-root', x: 0, y: 0 },
                { vertexId: 'v-mix', x: 10, y: 0 },
                { vertexId: 'v-arm', x: 0, y: 10 },
                { vertexId: 'v-rest', x: 10, y: 10 },
                { vertexId: 'v-tie', x: 20, y: 0 }
            ],
            triangles: [
                ['v-root', 'v-mix', 'v-arm'],
                ['v-mix', 'v-rest', 'v-arm'],
                ['v-mix', 'v-tie', 'v-rest']
            ],
            generator: {
                type: generatorType,
                source: createRasterMeshSourceSignature(snapshot)
            }
        }],
        skinBindings: [{
            version: 1,
            meshId: 'mesh-brush',
            vertexWeights: [
                { vertexId: 'v-root', influences: [{ boneId: 'root', weight: 1 }] },
                { vertexId: 'v-mix', influences: [{ boneId: 'root', weight: 0.75 }, { boneId: 'arm', weight: 0.25 }] },
                { vertexId: 'v-arm', influences: [{ boneId: 'arm', weight: 1 }] },
                { vertexId: 'v-rest', influences: [] },
                { vertexId: 'v-tie', influences: [{ boneId: 'root', weight: 0.5 }, { boneId: 'hand', weight: 0.5 }] }
            ]
        }]
    };
}

function influencesFor(plan, vertexId) {
    return plan.skinBindings[0].vertexWeights
        .find(vertexWeight => vertexWeight.vertexId === vertexId).influences;
}

function assertCanonicalWeights(plan) {
    plan.skinBindings[0].vertexWeights.forEach(vertexWeight => {
        assert.ok(vertexWeight.influences.length <= 2, `${vertexWeight.vertexId}: maximum two influences`);
        vertexWeight.influences.forEach(influence => {
            assert.equal(Number.isFinite(influence.weight), true);
            assert.ok(influence.weight >= 0);
        });
        if (vertexWeight.influences.length > 0) {
            const total = vertexWeight.influences.reduce((sum, influence) => sum + influence.weight, 0);
            assert.ok(Math.abs(total - 1) <= 1e-9, `${vertexWeight.vertexId}: influences sum to one`);
        }
    });
}

const asset = createAsset();
const before = structuredClone(asset);
const addToExisting = createSkinWeightBrushPlan(asset, 'raster-brush', 'arm', [
    { vertexId: 'v-mix', delta: 0.25 }
]);
assert.equal(addToExisting.ok, true);
assert.equal(addToExisting.changed, true);
assert.deepEqual(asset, before, 'pure brush plan does not mutate the asset');
assert.deepEqual(influencesFor(addToExisting, 'v-mix'), [
    { boneId: 'arm', weight: 0.5 },
    { boneId: 'root', weight: 0.5 }
]);
assert.equal(
    addToExisting.meshDefinitions[0].generator.weightCorrectionMode,
    FIXED_TOPOLOGY_SKIN_WEIGHT_BRUSH_MODE
);

const addNewBone = createSkinWeightBrushPlan(asset, 'raster-brush', 'arm', [
    { vertexId: 'v-root', delta: 0.25 }
]);
assert.deepEqual(influencesFor(addNewBone, 'v-root'), [
    { boneId: 'arm', weight: 0.25 },
    { boneId: 'root', weight: 0.75 }
]);

const subtract = createSkinWeightBrushPlan(asset, 'raster-brush', 'arm', [
    { vertexId: 'v-mix', delta: -0.1 }
]);
assert.deepEqual(influencesFor(subtract, 'v-mix'), [
    { boneId: 'arm', weight: 0.15 },
    { boneId: 'root', weight: 0.85 }
]);

const skipped = createSkinWeightBrushPlan(asset, 'raster-brush', 'arm', [
    { vertexId: 'v-arm', delta: -0.25 }
]);
assert.equal(skipped.ok, true);
assert.equal(skipped.changed, false);
assert.deepEqual(skipped.skippedVertices, [{ vertexId: 'v-arm', reason: 'companion-required' }]);
assert.equal(skipped.meshDefinitions[0].generator.weightCorrectionMode, undefined);

const explicitRest = createSkinWeightBrushPlan(asset, 'raster-brush', 'arm', [
    { vertexId: 'v-arm', delta: -1 }
]);
assert.deepEqual(influencesFor(explicitRest, 'v-arm'), []);

const clampToSelected = createSkinWeightBrushPlan(asset, 'raster-brush', 'arm', [
    { vertexId: 'v-root', delta: 2 }
]);
assert.deepEqual(influencesFor(clampToSelected, 'v-root'), [{ boneId: 'arm', weight: 1 }]);

const deterministicTie = createSkinWeightBrushPlan(asset, 'raster-brush', 'arm', [
    { vertexId: 'v-tie', delta: 0.25 }
]);
assert.deepEqual(influencesFor(deterministicTie, 'v-tie'), [
    { boneId: 'arm', weight: 0.25 },
    { boneId: 'hand', weight: 0.75 }
], 'equal companion weights use boneId order');

const multiVertex = createSkinWeightBrushPlan(asset, 'raster-brush', 'arm', [
    { vertexId: 'v-root', delta: 0.1 },
    { vertexId: 'v-mix', delta: 0.2 },
    { vertexId: 'v-arm', delta: -0.1 }
]);
assert.equal(multiVertex.changed, true);
assert.deepEqual(multiVertex.changedVertexIds, ['v-root', 'v-mix']);
assert.deepEqual(multiVertex.skippedVertices, [{ vertexId: 'v-arm', reason: 'companion-required' }]);
assert.deepEqual(
    influencesFor(multiVertex, 'v-tie'),
    asset.skinBindings[0].vertexWeights.find(weight => weight.vertexId === 'v-tie').influences,
    'unrequested branch remains equivalent'
);
assertCanonicalWeights(multiVertex);
assert.equal(validateRasterBoneSkinning(
    multiVertex.meshDefinitions,
    multiVertex.skinBindings,
    asset.internalLayers,
    asset.rigDefinition
).ok, true);

const noOp = createSkinWeightBrushPlan(asset, 'raster-brush', 'arm', [
    { vertexId: 'v-mix', delta: 0 }
]);
assert.equal(noOp.ok, true);
assert.equal(noOp.changed, false);
assert.equal(noOp.meshDefinitions[0].generator.weightCorrectionMode, undefined);

const autoShape = createSkinWeightBrushPlan(createAsset(AUTO_SHAPE_FILL_GENERATOR), 'raster-brush', 'arm', [
    { vertexId: 'v-root', delta: 0.1 }
]);
assert.equal(autoShape.ok, true, 'AUTO SHAPE is supported');

const duplicateUpdate = createSkinWeightBrushPlan(asset, 'raster-brush', 'arm', [
    { vertexId: 'v-root', delta: 0.1 },
    { vertexId: 'v-root', delta: 0.2 }
]);
assert.equal(duplicateUpdate.reason, 'duplicate-vertex-delta');
assert.deepEqual(duplicateUpdate.duplicateVertexIds, ['v-root']);
assert.equal(createSkinWeightBrushPlan(asset, 'raster-brush', 'arm', [
    { vertexId: 'missing', delta: 0.1 }
]).reason, 'vertex-not-found');
assert.equal(createSkinWeightBrushPlan(asset, 'raster-brush', 'arm', [
    { vertexId: 'v-root', delta: Number.NaN }
]).reason, 'invalid-vertex-delta');
assert.equal(createSkinWeightBrushPlan(asset, 'raster-brush', 'missing', [
    { vertexId: 'v-root', delta: 0.1 }
]).reason, 'bone-not-found');
const unsupported = createAsset('auto-shape-line-ribbon-v1');
assert.equal(createSkinWeightBrushPlan(unsupported, 'raster-brush', 'arm', [
    { vertexId: 'v-root', delta: 0.1 }
]).reason, 'fixed-topology-generator-required');

const model = new TimelineModel({
    totalFrames: 4,
    drawingSnapshots: [snapshot],
    clipAssets: [createAsset()],
    tracks: [{
        id: 'lane-brush',
        cels: [{ id: 'clip-brush', assetId: 'asset-brush', startFrame: 0, duration: 4 }]
    }]
});
assert.equal(model.getClipAssetRasterMeshStatus('asset-brush', 'raster-brush').state, 'current');
const applied = model.applyClipAssetRasterSkinWeightBrush(
    'asset-brush',
    'raster-brush',
    'arm',
    [{ vertexId: 'v-root', delta: 0.25 }]
);
assert.equal(applied.ok, true);
assert.equal(applied.changed, true);
assert.deepEqual(
    model.getClipAsset('asset-brush').skinBindings[0].vertexWeights
        .find(weight => weight.vertexId === 'v-root').influences,
    [{ boneId: 'arm', weight: 0.25 }, { boneId: 'root', weight: 0.75 }]
);

const roundTrip = new TimelineModel(model.serialize());
assert.deepEqual(roundTrip.serialize(), model.serialize(), 'brush result survives Project round-trip');
const duplicate = model.duplicateClipAsset('asset-brush');
assert.equal(duplicate.ok, true, duplicate.reason);
assert.equal(
    model.getClipAssetRasterMeshStatus(
        duplicate.asset.id,
        duplicate.asset.meshDefinitions[0].targetInternalLayerId
    ).state,
    'current',
    'CAF duplicate rebases source and keeps brush weights'
);
assert.equal(validateRasterBoneSkinning(
    duplicate.asset.meshDefinitions,
    duplicate.asset.skinBindings,
    duplicate.asset.internalLayers,
    duplicate.asset.rigDefinition
).ok, true);

const staleAssetBefore = structuredClone(model.getClipAsset('asset-brush').serialize());
model.getDrawingSnapshot(snapshot.id).updatedAt = 101;
const stale = model.applyClipAssetRasterSkinWeightBrush(
    'asset-brush',
    'raster-brush',
    'arm',
    [{ vertexId: 'v-root', delta: 0.1 }]
);
assert.equal(stale.ok, false);
assert.equal(stale.reason, 'mesh-stale');
assert.deepEqual(model.getClipAsset('asset-brush').serialize(), staleAssetBefore, 'STALE rejects before mutation');

console.log('verify-skin-weight-brush: pure transfer, stable IDs, max-2 weights, CURRENT adapter, STALE, duplicate and Project round-trip OK');
