import assert from 'node:assert/strict';

import { AUTO_SHAPE_FILL_GENERATOR } from '../system/animation/auto-shape-raster-bone-setup.js';
import {
    ALPHA_FIT_GRID_GENERATOR,
    createRasterMeshSourceSignature
} from '../system/animation/raster-bone-auto-setup.js';
import {
    createRasterMeshVertexPositionEditPlan,
    FIXED_VERTEX_POSITION_EDIT_MODE
} from '../system/animation/raster-mesh-vertex-position-edit.js';

globalThis.window = globalThis.window || {};
const { TimelineModel } = await import('../system/animation/animation-data-model.js');

const snapshot = {
    id: 'snapshot-mesh-position',
    width: 20,
    height: 10,
    rasterBounds: { x: 0, y: 0, width: 20, height: 10 },
    pixels: new Uint8ClampedArray(20 * 10 * 4),
    updatedAt: 100
};

function createAsset(generatorType = ALPHA_FIT_GRID_GENERATOR) {
    const vertices = [
        { vertexId: 'v0', x: 0, y: 0 },
        { vertexId: 'v1', x: 20, y: 0 },
        { vertexId: 'v2', x: 0, y: 10 },
        { vertexId: 'v3', x: 20, y: 10 }
    ];
    return {
        id: 'asset-mesh-position',
        internalLayers: [{
            id: 'raster-mesh-position',
            name: 'Mesh position target',
            type: 'raster',
            drawingSnapshotId: snapshot.id
        }],
        rigDefinition: {
            version: 1,
            parts: [],
            rigidBindings: [],
            bones: [{
                boneId: 'bone-root',
                parentBoneId: null,
                name: 'Root',
                bindTransform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, pivotX: 0, pivotY: 0 },
                length: 10
            }]
        },
        meshDefinitions: [{
            version: 1,
            meshId: 'mesh-position',
            targetInternalLayerId: 'raster-mesh-position',
            vertices,
            triangles: [['v0', 'v1', 'v2'], ['v1', 'v3', 'v2']],
            generator: {
                type: generatorType,
                source: createRasterMeshSourceSignature(snapshot)
            }
        }],
        skinBindings: [{
            version: 1,
            meshId: 'mesh-position',
            vertexWeights: vertices.map(vertex => ({
                vertexId: vertex.vertexId,
                influences: [{ boneId: 'bone-root', weight: 1 }]
            }))
        }]
    };
}

const asset = createAsset();
const before = structuredClone(asset);
const moved = createRasterMeshVertexPositionEditPlan(
    asset,
    'raster-mesh-position',
    [{ vertexId: 'v1', x: 18, y: 1 }],
    snapshot.rasterBounds
);
assert.equal(moved.ok, true);
assert.equal(moved.changed, true);
assert.deepEqual(asset, before, 'pure position plan does not mutate the asset');
assert.deepEqual(moved.changedVertexIds, ['v1']);
assert.deepEqual(moved.meshDefinitions[0].triangles, before.meshDefinitions[0].triangles);
assert.deepEqual(moved.skinBindings, before.skinBindings, 'Skin weights remain equivalent');
assert.equal(
    moved.meshDefinitions[0].generator.topologyEditMode,
    FIXED_VERTEX_POSITION_EDIT_MODE
);
assert.deepEqual(
    moved.meshDefinitions[0].vertices.find(vertex => vertex.vertexId === 'v1'),
    { vertexId: 'v1', x: 18, y: 1 }
);

const noOp = createRasterMeshVertexPositionEditPlan(
    asset,
    'raster-mesh-position',
    [{ vertexId: 'v1', x: 20, y: 0 }],
    snapshot.rasterBounds
);
assert.equal(noOp.ok, true);
assert.equal(noOp.changed, false);
assert.equal(noOp.meshDefinitions[0].generator.topologyEditMode, undefined);

assert.equal(createRasterMeshVertexPositionEditPlan(
    asset,
    'raster-mesh-position',
    [{ vertexId: 'v1', x: 18, y: 1 }, { vertexId: 'v1', x: 17, y: 1 }],
    snapshot.rasterBounds
).reason, 'duplicate-vertex-position');
assert.equal(createRasterMeshVertexPositionEditPlan(
    asset,
    'raster-mesh-position',
    [{ vertexId: 'missing', x: 1, y: 1 }],
    snapshot.rasterBounds
).reason, 'vertex-not-found');
assert.equal(createRasterMeshVertexPositionEditPlan(
    asset,
    'raster-mesh-position',
    [{ vertexId: 'v1', x: Number.NaN, y: 1 }],
    snapshot.rasterBounds
).reason, 'invalid-vertex-position');
assert.equal(createRasterMeshVertexPositionEditPlan(
    asset,
    'raster-mesh-position',
    [{ vertexId: 'v1', x: 21, y: 1 }],
    snapshot.rasterBounds
).reason, 'vertex-outside-source');
assert.equal(createRasterMeshVertexPositionEditPlan(
    asset,
    'raster-mesh-position',
    [{ vertexId: 'v1', x: 0, y: 10 }],
    snapshot.rasterBounds
).reason, 'triangle-winding-change');
assert.equal(createRasterMeshVertexPositionEditPlan(
    createAsset('auto-shape-line-ribbon-v1'),
    'raster-mesh-position',
    [{ vertexId: 'v1', x: 18, y: 1 }],
    snapshot.rasterBounds
).reason, 'fixed-topology-generator-required');
assert.equal(createRasterMeshVertexPositionEditPlan(
    createAsset(AUTO_SHAPE_FILL_GENERATOR),
    'raster-mesh-position',
    [{ vertexId: 'v1', x: 18, y: 1 }],
    snapshot.rasterBounds
).ok, true, 'AUTO SHAPE is supported');

const overlapAsset = createAsset();
const overlapVertices = [
    { vertexId: 'a0', x: 0, y: 0 },
    { vertexId: 'a1', x: 4, y: 0 },
    { vertexId: 'a2', x: 0, y: 4 },
    { vertexId: 'b0', x: 6, y: 0 },
    { vertexId: 'b1', x: 10, y: 0 },
    { vertexId: 'b2', x: 6, y: 4 }
];
overlapAsset.meshDefinitions[0].vertices = overlapVertices;
overlapAsset.meshDefinitions[0].triangles = [['a0', 'a1', 'a2'], ['b0', 'b1', 'b2']];
overlapAsset.skinBindings[0].vertexWeights = overlapVertices.map(vertex => ({
    vertexId: vertex.vertexId,
    influences: [{ boneId: 'bone-root', weight: 1 }]
}));
assert.equal(createRasterMeshVertexPositionEditPlan(
    overlapAsset,
    'raster-mesh-position',
    [{ vertexId: 'a1', x: 8, y: 3 }],
    snapshot.rasterBounds
).reason, 'topology-overlap');

const model = new TimelineModel({
    totalFrames: 4,
    drawingSnapshots: [snapshot],
    clipAssets: [createAsset()],
    tracks: [{
        id: 'lane-mesh-position',
        cels: [{
            id: 'clip-mesh-position',
            assetId: 'asset-mesh-position',
            startFrame: 0,
            duration: 4
        }]
    }]
});
assert.equal(model.getClipAssetRasterMeshStatus(
    'asset-mesh-position',
    'raster-mesh-position'
).state, 'current');
const applied = model.applyClipAssetRasterMeshVertexPositionEdit(
    'asset-mesh-position',
    'raster-mesh-position',
    [{ vertexId: 'v1', x: 18, y: 1 }]
);
assert.equal(applied.ok, true);
assert.equal(applied.changed, true);
assert.deepEqual(
    model.getClipAsset('asset-mesh-position').meshDefinitions[0].vertices
        .find(vertex => vertex.vertexId === 'v1'),
    { vertexId: 'v1', x: 18, y: 1 }
);
assert.equal(model.getClipAssetRasterMeshStatus(
    'asset-mesh-position',
    'raster-mesh-position'
).state, 'current', 'manual position edit preserves generator source CURRENT status');
const roundTrip = new TimelineModel(model.serialize());
assert.deepEqual(roundTrip.serialize(), model.serialize(), 'position edit survives Project round-trip');
assert.equal(
    roundTrip.getClipAsset('asset-mesh-position').meshDefinitions[0].generator.topologyEditMode,
    FIXED_VERTEX_POSITION_EDIT_MODE
);

const staleModel = new TimelineModel({
    totalFrames: 4,
    drawingSnapshots: [snapshot],
    clipAssets: [createAsset()]
});
staleModel.getDrawingSnapshot(snapshot.id).updatedAt += 1;
assert.equal(staleModel.applyClipAssetRasterMeshVertexPositionEdit(
    'asset-mesh-position',
    'raster-mesh-position',
    [{ vertexId: 'v1', x: 18, y: 1 }]
).reason, 'mesh-stale');

console.log('Raster Mesh fixed vertex position edit verifier passed.');
