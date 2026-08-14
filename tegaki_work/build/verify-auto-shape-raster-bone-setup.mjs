import assert from 'node:assert/strict';

import {
    AUTO_SHAPE_FILL_GENERATOR,
    createAutoShapeRasterBoneSetup,
    getAutoShapeRasterMeshStatus,
    rebaseAutoShapeRasterMeshSource
} from '../system/animation/auto-shape-raster-bone-setup.js';
import { CHAIN_LOCAL_JOINT_SKIN_WEIGHT_MODE } from '../system/animation/chain-local-joint-skin.js';
import {
    evaluateRasterBoneSkinning,
    normalizeRasterMeshDefinitions,
    normalizeRasterSkinBindings,
    serializeRasterMeshDefinitions,
    serializeRasterSkinBindings,
    validateRasterBoneSkinning
} from '../system/animation/raster-bone-skinning.js';

globalThis.window = globalThis.window || {};
const { TimelineModel } = await import('../system/animation/animation-data-model.js');

const rows = [
    '............',
    '....####....',
    '...######...',
    '..########..',
    '...######...',
    '....####....',
    '............'
];
const width = rows[0].length;
const height = rows.length;
const pixels = new Uint8ClampedArray(width * height * 4);
rows.forEach((row, y) => [...row].forEach((value, x) => {
    if (value === '#') pixels[(y * width + x) * 4 + 3] = 255;
}));
const snapshot = {
    id: 'snapshot-auto-shape-arm',
    width,
    height,
    pixels,
    rasterBounds: { x: 0, y: 0, width, height },
    updatedAt: 100
};
const rigDefinition = {
    version: 1,
    parts: [],
    bones: [{
        boneId: 'shoulder',
        parentBoneId: null,
        name: 'Shoulder',
        bindTransform: { x: 2, y: 3.5, scaleX: 1, scaleY: 1, rotation: 0, pivotX: 0, pivotY: 0 },
        length: 4
    }, {
        boneId: 'wrist',
        parentBoneId: 'shoulder',
        name: 'Wrist',
        bindTransform: { x: 4, y: 0, scaleX: 1, scaleY: 1, rotation: 0, pivotX: 0, pivotY: 0 },
        length: 4
    }]
};
const asset = {
    id: 'asset-auto-shape-arm',
    internalLayers: [{
        id: 'arm-raster',
        name: 'Arm',
        type: 'raster',
        drawingSnapshotId: snapshot.id
    }],
    rigDefinition
};
const options = {
    boneIds: ['shoulder', 'wrist'],
    maxVertices: 64,
    reservedInteriorVertices: 16,
    maxBoundaryVertices: 12,
    maxAreaError: 1,
    guardDistance: 0.5,
    interiorSpacing: 1.25,
    maxInteriorPoints: 16,
    minimumBarycentricWeight: 0.005
};

const generated = createAutoShapeRasterBoneSetup(asset, 'arm-raster', snapshot, options);
assert.equal(generated.ok, true, generated.reason);
assert.equal(generated.meshDefinition.generator.type, AUTO_SHAPE_FILL_GENERATOR);
assert.equal(generated.meshDefinition.generator.mode, 'fill');
assert.equal(
    generated.meshDefinition.generator.weightMode,
    CHAIN_LOCAL_JOINT_SKIN_WEIGHT_MODE,
    'new explicit AUTO SHAPE uses Chain-local Joint Skin'
);
assert.equal(generated.meshDefinition.vertices.length, generated.topology.vertices.length);
assert.equal(generated.meshDefinition.triangles.length, generated.topology.triangles.length);
assert.ok(generated.meshDefinition.vertices.length <= 64);
assert.equal(generated.meshDefinition.generator.guardDistance, 0.5);
assert.ok(generated.meshDefinition.generator.reducedBoundaryVertexCount <= 12);
assert.ok(generated.meshDefinition.generator.guardVertexCount > 0);
assert.ok(generated.meshDefinition.generator.interiorVertexCount > 0);
assert.deepEqual(generated.contentBounds, { x: 2, y: 1, width: 8, height: 5 });
assert.equal(generated.boneCount, 2);
assert.equal(
    generated.weightDiagnostics.vertexCount,
    generated.meshDefinition.vertices.length,
    'weight diagnostics cover every generated vertex'
);
generated.skinBinding.vertexWeights.forEach(vertexWeight => {
    assert.ok(vertexWeight.influences.length >= 1 && vertexWeight.influences.length <= 2);
    const total = vertexWeight.influences.reduce((sum, influence) => sum + influence.weight, 0);
    assert.ok(Math.abs(total - 1) < 1e-10, 'chain-local weights normalize to one');
});
assert.equal(validateRasterBoneSkinning(
    [generated.meshDefinition],
    [generated.skinBinding],
    asset.internalLayers,
    rigDefinition
).ok, true, 'Auto Shape factory output validates against existing Mesh / Skin schema');
assert.deepEqual(
    serializeRasterMeshDefinitions(normalizeRasterMeshDefinitions([generated.meshDefinition])),
    [generated.meshDefinition],
    'generator provenance survives existing Mesh normalize / serialize'
);
assert.deepEqual(
    serializeRasterSkinBindings(normalizeRasterSkinBindings([generated.skinBinding])),
    [generated.skinBinding],
    'Auto Shape weights survive existing Skin normalize / serialize'
);

const evaluationAsset = {
    ...asset,
    meshDefinitions: [generated.meshDefinition],
    skinBindings: [generated.skinBinding]
};
const identity = evaluateRasterBoneSkinning(evaluationAsset, {
    rigMotion: { version: 1, partTracks: [], boneTracks: [] }
}, 0);
assert.equal(identity.ok, true);
identity.meshResults[0].vertices.forEach((vertex, index) => {
    const bind = generated.meshDefinition.vertices[index];
    assert.ok(Math.abs(vertex.x - bind.x) < 1e-10, `identity x ${index}`);
    assert.ok(Math.abs(vertex.y - bind.y) < 1e-10, `identity y ${index}`);
});

assert.equal(getAutoShapeRasterMeshStatus(generated.meshDefinition, snapshot).state, 'current');
const legacyDistanceMesh = structuredClone(generated.meshDefinition);
delete legacyDistanceMesh.generator.weightMode;
assert.equal(
    getAutoShapeRasterMeshStatus(legacyDistanceMesh, snapshot).state,
    'current',
    'saved legacy AUTO SHAPE remains current and is not regenerated implicitly'
);
assert.equal(
    Object.hasOwn(
        serializeRasterMeshDefinitions(normalizeRasterMeshDefinitions([legacyDistanceMesh]))[0].generator,
        'weightMode'
    ),
    false,
    'legacy generator metadata round-trips without inventing a weight mode'
);
assert.equal(
    getAutoShapeRasterMeshStatus(generated.meshDefinition, { ...snapshot, updatedAt: 101 }).state,
    'stale'
);
assert.equal(
    getAutoShapeRasterMeshStatus({ ...generated.meshDefinition, generator: { type: 'manual' } }, snapshot).state,
    'manual'
);
assert.equal(
    getAutoShapeRasterMeshStatus(
        rebaseAutoShapeRasterMeshSource(generated.meshDefinition, { ...snapshot, updatedAt: 101 }),
        { ...snapshot, updatedAt: 101 }
    ).state,
    'current',
    'explicit duplicate rebase updates source without changing topology'
);

const deterministicA = createAutoShapeRasterBoneSetup(asset, 'arm-raster', snapshot, {
    ...options,
    idFactory: kind => `fixed-${kind}`
});
const deterministicB = createAutoShapeRasterBoneSetup(asset, 'arm-raster', snapshot, {
    ...options,
    idFactory: kind => `fixed-${kind}`
});
assert.deepEqual(deterministicA, deterministicB, 'fixed idFactory makes complete setup deterministic');
const ignoredRuntimeOverride = createAutoShapeRasterBoneSetup(asset, 'arm-raster', snapshot, {
    ...options,
    jointBandRatio: 0.5,
    branchAmbiguityRatio: 0.25,
    idFactory: kind => `fixed-${kind}`
});
assert.deepEqual(
    ignoredRuntimeOverride,
    deterministicA,
    'production AUTO SHAPE keeps v1 ratios fixed instead of creating unsaved per-Project overrides'
);

assert.equal(createAutoShapeRasterBoneSetup({ internalLayers: [] }, 'missing', snapshot).reason, 'layer-not-found');
assert.equal(createAutoShapeRasterBoneSetup({
    internalLayers: [{ id: 'folder', type: 'folder' }]
}, 'folder', snapshot).reason, 'raster-required');
assert.equal(createAutoShapeRasterBoneSetup({
    internalLayers: [{ id: 'arm-raster', type: 'raster' }],
    rigDefinition: { version: 1, parts: [], bones: [] }
}, 'arm-raster', snapshot).reason, 'mesh-bone-required');

const model = new TimelineModel({
    totalFrames: 4,
    drawingSnapshots: [snapshot],
    clipAssets: [{ ...asset }],
    tracks: [{ id: 'lane-auto-shape', cels: [{ id: 'clip-auto-shape', assetId: asset.id, duration: 4 }] }]
});
const modelGenerated = model.generateClipAssetAutoShapeBoneSetup(asset.id, 'arm-raster', options);
assert.equal(modelGenerated.ok, true, modelGenerated.reason);
assert.equal(modelGenerated.generatorMode, 'auto-shape');
assert.equal(model.getClipAssetRasterMeshStatus(asset.id, 'arm-raster').state, 'current');
assert.equal(
    model.getClipAsset(asset.id).meshDefinitions[0].generator.type,
    AUTO_SHAPE_FILL_GENERATOR,
    'TimelineModel installs Auto Shape into the existing Mesh collection'
);
model.getDrawingSnapshot(snapshot.id).updatedAt = 102;
assert.equal(model.getClipAssetRasterMeshStatus(asset.id, 'arm-raster').state, 'stale');
assert.equal(
    model.getClipAsset(asset.id).meshDefinitions[0].meshId,
    modelGenerated.meshDefinition.meshId,
    'STALE status does not overwrite existing Auto Shape'
);
const regenerated = model.generateClipAssetAutoShapeBoneSetup(asset.id, 'arm-raster', options);
assert.equal(regenerated.ok, true, regenerated.reason);
assert.notEqual(regenerated.meshDefinition.meshId, modelGenerated.meshDefinition.meshId);
assert.equal(model.getClipAsset(asset.id).meshDefinitions.length, 1);
assert.equal(model.getClipAssetRasterMeshStatus(asset.id, 'arm-raster').state, 'current');
const assetDuplicate = model.duplicateClipAsset(asset.id);
assert.equal(assetDuplicate.ok, true);
assert.equal(
    model.getClipAssetRasterMeshStatus(
        assetDuplicate.asset.id,
        assetDuplicate.asset.meshDefinitions[0].targetInternalLayerId
    ).state,
    'current',
    'CAF duplicate rebases Auto Shape source to duplicated Snapshot'
);
const layerDuplicate = model.duplicateClipAssetInternalLayer(asset.id, 'arm-raster');
assert.equal(layerDuplicate.ok, true);
assert.equal(
    model.getClipAssetRasterMeshStatus(asset.id, layerDuplicate.layer.id).state,
    'current',
    'Raster duplicate rebases Auto Shape source to duplicated Snapshot'
);
const restored = new TimelineModel(model.serialize());
assert.deepEqual(restored.serialize(), model.serialize(), 'Auto Shape adapter Project round-trip');

const currentHistoryState = model.serialize();
const currentHistoryAsset = model.getClipAsset(asset.id);
const currentHistoryLayer = currentHistoryAsset.internalLayers.find(layer => layer.id === 'arm-raster');
model.getDrawingSnapshot(currentHistoryLayer.drawingSnapshotId).updatedAt += 1;
assert.equal(model.getClipAssetRasterMeshStatus(asset.id, 'arm-raster').state, 'stale');
assert.equal(
    model.rebaseClipAssetRasterMeshSource(asset.id, 'arm-raster').changed,
    true,
    'History restore can rebase a captured CURRENT generator to the restored Snapshot'
);
assert.equal(model.getClipAssetRasterMeshStatus(asset.id, 'arm-raster').state, 'current');
const historyBaseline = new TimelineModel(currentHistoryState);
assert.equal(historyBaseline.getClipAssetRasterMeshStatus(asset.id, 'arm-raster').state, 'current');

console.log('verify-auto-shape-raster-bone-setup: guarded FILL factory, Model replace, stable IDs, max-2 weights, LBS, STALE, History/duplicate rebase and Project round-trip OK');
