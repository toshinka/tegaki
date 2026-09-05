import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

globalThis.window = globalThis.window || {};
globalThis.document = globalThis.document || {
    createElement: () => ({ click() {}, style: {} }),
    addEventListener() {},
    removeEventListener() {}
};
globalThis.document.addEventListener ||= () => {};
globalThis.document.removeEventListener ||= () => {};
globalThis.URL = globalThis.URL || {
    createObjectURL: () => 'blob:fixture',
    revokeObjectURL() {}
};

const {
    ClipAssetModel,
    DrawingSnapshotModel,
    TimelineModel
} = await import('../system/animation/animation-data-model.js');
const { sampleClipBakeState } = await import('../system/animation/clip-bake-sampler.js');
const { createWarpGridDeformer } = await import('../system/animation/warp-grid-deformer.js');
const { ProjectManager } = await import('../system/project-manager.js');

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
            points: deformer.points.map(point => ({ x: point.x + offset, y: point.y + 1 })),
            placement: { x: offset + 3, y: 2, scale: 1.1, rotation: 0.1 }
        }
    ];
    return deformer;
}

const legacy = new TimelineModel({
    tracks: [{ id: 'legacy-lane', cels: [{ id: 'legacy-clip', startFrame: 0, duration: 1 }] }]
});
assert.equal(legacy.validateLayerDeformers().ok, true, 'Missing optional field is identity');
assert.equal(
    Object.hasOwn(legacy.serialize().tracks[0].cels[0], 'layerDeformers'),
    false,
    'Legacy Project output omits the optional field'
);

const snapshotA = createSnapshot('snap-layer-a');
const snapshotB = createSnapshot('snap-layer-b');
const model = new TimelineModel({
    fps: 12,
    totalFrames: 8,
    drawingSnapshots: [snapshotA, snapshotB]
});
const folder = model.createClipAssetInternalLayer({
    id: 'folder-root',
    name: 'Folder',
    type: 'folder'
});
const rasterA = model.createClipAssetInternalLayer({
    id: 'layer-a',
    name: 'Layer A',
    type: 'raster',
    drawingSnapshotId: snapshotA.id,
    parentLayerId: folder.id
});
const rasterB = model.createClipAssetInternalLayer({
    id: 'layer-b',
    name: 'Layer B',
    type: 'raster',
    drawingSnapshotId: snapshotB.id
});
const clipped = model.createClipAssetInternalLayer({
    id: 'layer-clipped',
    name: 'Clipped',
    type: 'raster',
    drawingSnapshotId: snapshotB.id,
    clipping: true
});
const asset = new ClipAssetModel({
    id: 'asset-character',
    name: 'Character',
    drawingSnapshotId: snapshotA.id,
    internalLayers: [folder, rasterA, rasterB, clipped]
});
model.clipAssets.push(asset);
const lane = model.createIndependentLane({ name: 'Character Lane' });
const clip = lane.addCel({
    id: 'clip-character',
    assetId: asset.id,
    startFrame: 1,
    duration: 4,
    layerDeformers: {
        version: 1,
        targets: [{ internalLayerId: rasterA.id, deformer: createWarp(1) }]
    }
});
assert.ok(clip);
assert.equal(model.validateLayerDeformers().ok, true, 'Valid Raster target passes model validation');
assert.equal(model.setClipLayerDeformer(clip.id, rasterB.id, createWarp(2)).ok, true);
assert.equal(model.setClipLayerDeformer(clip.id, folder.id, createWarp()).reason, 'drawable-raster-required');
assert.equal(model.setClipLayerDeformer(clip.id, clipped.id, createWarp()).reason, 'internal-clipping-unsupported');
assert.equal(model.setClipLayerDeformer(clip.id, rasterA.id, { type: 'unknown' }).reason, 'invalid-layer-deformer');
asset.rigDefinition = {
    version: 1,
    parts: [{
        partId: folder.id,
        parentPartId: null,
        bindTransform: {
            x: 0,
            y: 0,
            scaleX: 1,
            scaleY: 1,
            rotation: 0,
            pivotX: 0,
            pivotY: 0
        }
    }]
};
assert.equal(
    model.setClipLayerDeformer(clip.id, rasterA.id, createWarp()).reason,
    'rig-part-layer-unsupported',
    'A Raster inside a registered Folder Part is rejected at the model boundary'
);
assert.equal(model.validateLayerDeformers().ok, false);
asset.rigDefinition = null;
assert.equal(model.validateLayerDeformers().ok, true);

const serializedModel = model.serialize();
const roundTrip = new TimelineModel(serializedModel);
assert.deepEqual(
    roundTrip.findClipEntry(clip.id)?.clip.layerDeformers,
    model.findClipEntry(clip.id)?.clip.layerDeformers,
    'TimelineModel round-trip preserves Layer WARP targets'
);
assert.equal(roundTrip.validateLayerDeformers().ok, true);

const manager = new ProjectManager({ getLayers: () => [] }, {});
manager._getAnimationTable = () => ({
    model,
    selectedCelId: clip.id,
    activeLaneId: lane.id,
    selectedAssetId: asset.id,
    selectedInternalLayerId: rasterA.id
});
const projectData = await manager.exportProject({ profile: true });
const projectRoundTrip = new TimelineModel(JSON.parse(JSON.stringify(projectData)).animation);
assert.deepEqual(
    projectRoundTrip.findClipEntry(clip.id)?.clip.layerDeformers,
    model.findClipEntry(clip.id)?.clip.layerDeformers,
    'ProjectManager JSON preserves Layer WARP targets'
);

const baked = sampleClipBakeState(clip, clip.startFrame + 2);
assert.equal(baked.layerDeformers.targets.length, 2);
assert.ok(baked.layerDeformers.targets.every(target => target.deformer.keyframes.length === 1));
assert.ok(baked.layerDeformers.targets.every(target => target.deformer.keyframes[0].frame === 0));

const duplicated = model.duplicateClipAssetInternalLayer(asset.id, rasterA.id);
assert.equal(duplicated.ok, true);
const duplicateLayerId = duplicated.internalLayerIdMap.get(rasterA.id);
assert.ok(duplicateLayerId);
assert.ok(
    model.findClipEntry(clip.id).clip.layerDeformers.targets
        .some(target => target.internalLayerId === duplicateLayerId),
    'Internal Layer duplicate remaps the matching Layer WARP target'
);
const removed = model.removeClipAssetInternalLayer(asset.id, duplicateLayerId);
assert.equal(removed.ok, true);
assert.equal(
    model.findClipEntry(clip.id).clip.layerDeformers.targets
        .some(target => target.internalLayerId === duplicateLayerId),
    false,
    'Internal Layer delete removes the matching Layer WARP target'
);

const invalidSource = new TimelineModel({
    clipAssets: [asset.serialize()],
    tracks: [{
        id: 'invalid-lane',
        cels: [{
            id: 'invalid-clip',
            assetId: asset.id,
            startFrame: 0,
            duration: 1,
            layerDeformers: {
                version: 99,
                targets: [{ internalLayerId: rasterA.id, deformer: createWarp() }]
            }
        }]
    }]
});
assert.equal(invalidSource.validateLayerDeformers().ok, false, 'Load validation keeps raw schema errors');

const uiSource = await readFile(new URL('../ui/animation-table-popup.js', import.meta.url), 'utf8');
assert.match(uiSource, /layerDeformers: this\._cloneClipInstanceMetadata\(clip\.layerDeformers, null\)/u);
assert.match(uiSource, /remapClipLayerDeformers\(item\.layerDeformers, pastedAssetCopy\.internalLayerIdMap\)/u);
assert.match(uiSource, /remapClipLayerDeformers\([\s\S]*sampled\.layerDeformers,[\s\S]*duplicate\.internalLayerIdMap/u);
assert.match(uiSource, /cel\.layerDeformers = retimeClipLayerDeformers\(/u);
assert.match(uiSource, /cel\.layerDeformers = this\._cloneClipInstanceMetadata\(original\.layerDeformers, null\)/u);

const projectManagerSource = await readFile(new URL('../system/project-manager.js', import.meta.url), 'utf8');
assert.match(projectManagerSource, /validateLayerDeformers\?\.\(\)/u);

console.log('verify-clip-layer-deformer-model: model, Project JSON, copy/remap, delete, bake, retime, and History wiring OK');
