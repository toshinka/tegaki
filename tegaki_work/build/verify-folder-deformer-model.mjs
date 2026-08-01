import assert from 'node:assert/strict';

globalThis.window = globalThis.window || {};

const {
    ClipAssetModel,
    DrawingSnapshotModel,
    TimelineModel
} = await import('../system/animation/animation-data-model.js');
const {
    getClipFolderDeformer,
    normalizeClipFolderDeformers,
    remapClipFolderDeformers,
    sampleClipFolderDeformers,
    serializeClipFolderDeformers,
    validateClipFolderDeformers
} = await import('../system/animation/clip-deformer.js');
const { sampleClipBakeState } = await import('../system/animation/clip-bake-sampler.js');
const { createWarpGridDeformer } = await import('../system/animation/warp-grid-deformer.js');

function createSnapshot(id) {
    return new DrawingSnapshotModel({
        id,
        width: 2,
        height: 2,
        pixels: new Uint8ClampedArray(16)
    });
}

function createWarp(offset = 0) {
    const deformer = createWarpGridDeformer({
        bindBounds: { x: 0, y: 0, width: 20, height: 20 }
    });
    deformer.keyframes = [
        {
            frame: 0,
            interpolation: 'linear',
            points: deformer.points,
            placement: { x: offset, y: 0, scale: 1, rotation: 0 }
        },
        {
            frame: 2,
            interpolation: 'hold',
            points: deformer.points.map(point => ({ x: point.x + offset, y: point.y })),
            placement: { x: offset + 3, y: 4, scale: 1.2, rotation: 0.1 }
        }
    ];
    return deformer;
}

const model = new TimelineModel({ totalFrames: 8, drawingSnapshots: [createSnapshot('snap-root')] });
const folder = model.createClipAssetInternalLayer({ id: 'folder-hair', name: 'Hair', type: 'folder' });
const nestedFolder = model.createClipAssetInternalLayer({ id: 'folder-face', name: 'Face', type: 'folder' });
const raster = model.createClipAssetInternalLayer({
    id: 'layer-hair-raster',
    name: 'Hair line',
    type: 'raster',
    drawingSnapshotId: 'snap-root',
    parentLayerId: folder.id
});
const asset = new ClipAssetModel({
    id: 'asset-character',
    name: 'Character',
    internalLayers: [folder, nestedFolder, raster]
});
model.clipAssets.push(asset);

const normalized = normalizeClipFolderDeformers({
    version: 1,
    targets: [
        { folderLayerId: nestedFolder.id, deformer: createWarp(2) },
        { folderLayerId: folder.id, deformer: createWarp(1) }
    ]
});
assert.deepEqual(
    normalized.targets.map(target => target.folderLayerId),
    ['folder-face', 'folder-hair'],
    'Folder targets use canonical ID order'
);
assert.deepEqual(serializeClipFolderDeformers(normalized), normalized);
assert.equal(getClipFolderDeformer(normalized, folder.id)?.type, 'warp-grid');

const valid = validateClipFolderDeformers(normalized, asset.internalLayers);
assert.equal(valid.ok, true);
assert.equal(validateClipFolderDeformers({
    targets: [{ folderLayerId: raster.id, deformer: createWarp() }]
}, asset.internalLayers).ok, false, 'Raster target is rejected');
assert.equal(validateClipFolderDeformers({
    targets: [
        { folderLayerId: folder.id, deformer: createWarp() },
        { folderLayerId: folder.id, deformer: createWarp() }
    ]
}, asset.internalLayers).ok, false, 'Duplicate target is rejected');
assert.equal(validateClipFolderDeformers({ targets: [] }, asset.internalLayers).ok, false, 'Version is required');
assert.equal(validateClipFolderDeformers('invalid', asset.internalLayers).ok, false, 'Collection shape is validated');

const legacyModel = new TimelineModel({
    tracks: [{ id: 'legacy-lane', cels: [{ id: 'legacy-clip', startFrame: 0, duration: 1 }] }]
});
assert.equal(legacyModel.validateFolderDeformers().ok, true, 'Missing optional field is identity');
assert.equal(
    Object.hasOwn(legacyModel.serialize().tracks[0].cels[0], 'folderDeformers'),
    false,
    'Legacy serialize omits the optional field'
);

const invalidSourceModel = new TimelineModel({
    clipAssets: [asset.serialize()],
    tracks: [{
        id: 'invalid-lane',
        cels: [{
            id: 'invalid-clip',
            assetId: asset.id,
            startFrame: 0,
            duration: 1,
            folderDeformers: {
                version: 99,
                targets: [{ folderLayerId: folder.id, deformer: createWarp() }]
            }
        }]
    }]
});
assert.equal(invalidSourceModel.validateFolderDeformers().ok, false, 'Load validation keeps raw version errors');

const lane = model.createIndependentLane({ name: 'Animated' });
const clip = lane.addCel({
    id: 'clip-character',
    assetId: asset.id,
    startFrame: 1,
    duration: 4,
    folderDeformers: normalized
});
assert.ok(clip);
assert.equal(model.validateFolderDeformers().ok, true);
assert.equal(model.setClipFolderDeformer('clip-character', folder.id, createWarp(5)).ok, true);
assert.equal(model.removeClipFolderDeformer('clip-character', nestedFolder.id).ok, true);
assert.equal(model.setClipFolderDeformer('clip-character', raster.id, createWarp()).ok, false);

const roundTrip = new TimelineModel(model.serialize());
const roundTripClip = roundTrip.findClipEntry('clip-character')?.clip;
assert.deepEqual(roundTripClip?.folderDeformers, model.findClipEntry('clip-character')?.clip.folderDeformers);

const sourceClip = model.findClipEntry('clip-character').clip;
sourceClip.folderDeformers = normalized;
const sampled = sampleClipFolderDeformers(sourceClip.folderDeformers, 2, sourceClip.duration);
assert.equal(sampled.size, 2);
assert.equal(sampled.get(folder.id)?.type, 'warp-grid');

const baked = sampleClipBakeState(sourceClip, sourceClip.startFrame + 2);
assert.equal(baked.folderDeformers.targets.length, 2);
assert.ok(baked.folderDeformers.targets.every(target => target.deformer.keyframes.length === 1));
assert.equal(baked.folderDeformers.targets.every(target => target.deformer.keyframes[0].frame === 0), true);

const remapped = remapClipFolderDeformers(normalized, new Map([
    [folder.id, 'folder-hair-copy'],
    [nestedFolder.id, 'folder-face-copy']
]));
assert.deepEqual(
    remapped.targets.map(target => target.folderLayerId),
    ['folder-face-copy', 'folder-hair-copy']
);

const duplicate = model.duplicateClipAsset(asset.id, { name: 'Character copy' });
assert.equal(duplicate.ok, true);
assert.notEqual(duplicate.internalLayerIdMap.get(folder.id), folder.id);

const duplicatedInternal = model.duplicateClipAssetInternalLayer(asset.id, folder.id);
assert.equal(duplicatedInternal.ok, true);
const duplicatedFolderId = duplicatedInternal.internalLayerIdMap.get(folder.id);
assert.ok(duplicatedFolderId);
const expandedTargets = model.findClipEntry('clip-character').clip.folderDeformers.targets;
assert.ok(expandedTargets.some(target => target.folderLayerId === duplicatedFolderId));

const blockedRemoval = model.removeClipAssetInternalLayer(asset.id, duplicatedFolderId);
assert.equal(blockedRemoval.ok, false);
assert.equal(blockedRemoval.reason, 'folder-deformer-target-subtree-unsupported');
assert.equal(model.removeClipFolderDeformer('clip-character', duplicatedFolderId).ok, true);
const removedInternal = model.removeClipAssetInternalLayer(asset.id, duplicatedFolderId);
assert.equal(removedInternal.ok, true);
assert.equal(
    model.findClipEntry('clip-character').clip.folderDeformers.targets.some(target => target.folderLayerId === duplicatedFolderId),
    false,
    'Removing a Folder removes dangling Folder WARP targets'
);

console.log('verify-folder-deformer-model: normalize, validate, sample, persistence, copy/remap, bake, duplicate/delete OK');
