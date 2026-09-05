import assert from 'node:assert/strict';

globalThis.window = globalThis.window || {};
const {
    ClipAssetInternalLayerModel,
    ClipAssetModel,
    DrawingSnapshotModel,
    TimelineModel
} = await import('../system/animation/animation-data-model.js');
const { ProjectManager } = await import('../system/project-manager.js');

const pixelFixture = new Uint8ClampedArray([
    0, 1, 2, 3,
    40, 80, 120, 255
]);
const referenced = new DrawingSnapshotModel({
    id: 'snapshot-live',
    width: 2,
    height: 1,
    pixels: pixelFixture
});
const orphan = new DrawingSnapshotModel({
    id: 'snapshot-orphan',
    width: 2,
    height: 1,
    pixels: new Uint8ClampedArray(pixelFixture)
});
const asset = new ClipAssetModel({
    id: 'asset-live',
    drawingSnapshotId: referenced.id,
    internalLayers: [new ClipAssetInternalLayerModel({
        id: 'layer-live',
        drawingSnapshotId: referenced.id
    })]
});
const model = new TimelineModel({
    totalFrames: 8,
    clipAssets: [asset],
    drawingSnapshots: [referenced, orphan],
    tracks: [{
        id: 'lane-1',
        cels: [{
            id: 'clip-modern',
            assetId: asset.id,
            startFrame: 0,
            duration: 4,
            rasterSnapshot: {
                width: 2,
                height: 1,
                pixels: new Uint8ClampedArray(pixelFixture)
            }
        }, {
            id: 'clip-legacy',
            assetId: null,
            startFrame: 4,
            duration: 4,
            rasterSnapshot: {
                width: 2,
                height: 1,
                pixels: new Uint8ClampedArray(pixelFixture)
            }
        }]
    }]
});

const collection = model.collectUnreferencedDrawingSnapshots();
assert.equal(collection.removedCount, 1, 'one orphan snapshot is collected');
assert.equal(collection.removedPixelBytes, pixelFixture.byteLength, 'orphan bytes are reported');
assert.deepEqual(model.drawingSnapshots.map(snapshot => snapshot.id), ['snapshot-live']);

const manager = Object.create(ProjectManager.prototype);
const serialized = await manager._serializeAnimationForProject(model);
assert.equal(serialized.drawingSnapshots.length, 1, 'only referenced snapshot is serialized');
assert.equal(serialized.drawingSnapshots[0].pixelEncoding, 'base64');
assert.equal(typeof serialized.drawingSnapshots[0].pixels, 'string');
assert.equal(serialized.tracks[0].cels[0].rasterSnapshot, null, 'asset-backed compat pixels are omitted');
assert.equal(serialized.tracks[0].cels[1].rasterSnapshot.pixelEncoding, 'base64');

const json = JSON.stringify(serialized);
assert.ok(json.length < 2500, `fixture JSON stays compact: ${json.length}`);
const restored = new TimelineModel(JSON.parse(json));
assert.deepEqual(
    [...restored.getDrawingSnapshot('snapshot-live').pixels],
    [...pixelFixture],
    'base64 DrawingSnapshot round-trips'
);
assert.deepEqual(
    [...restored.tracks[0].cels[1].rasterSnapshot.pixels],
    [...pixelFixture],
    'legacy rasterSnapshot base64 round-trips'
);

model.drawingSnapshots.push(new DrawingSnapshotModel({
    id: 'snapshot-stale-before-save',
    width: 2,
    height: 1,
    pixels: new Uint8ClampedArray(pixelFixture)
}));
const exportManager = new ProjectManager({ getLayers: () => [] }, {});
exportManager._getAnimationTable = () => ({
    model,
    _saveSelectedClipFromWorkingLayers: options => {
        assert.equal(options, undefined, 'Project export does not force recapture a clean CAF Raster');
        model.drawingSnapshots.push(new DrawingSnapshotModel({
            id: 'snapshot-stale-after-capture',
            width: 2,
            height: 1,
            pixels: new Uint8ClampedArray(pixelFixture)
        }));
    }
});
const projectData = await exportManager.exportProject({ profile: true });
assert.deepEqual(
    model.drawingSnapshots.map(snapshot => snapshot.id),
    ['snapshot-live'],
    'export collects stale generations both before and after working-layer capture'
);
assert.equal(projectData.animation.drawingSnapshots[0].pixelEncoding, 'base64');
assert.equal(projectData.__exportProfile.animation.snapshotCollection.beforeSave.removedCount, 1);
assert.equal(projectData.__exportProfile.animation.snapshotCollection.afterSave.removedCount, 1);

let transformActive = true;
const transformSaveOrder = [];
const transformManager = new ProjectManager({
    getLayerMoveCommitState: () => ({ active: transformActive, hasPendingTransform: transformActive }),
    exitLayerMoveMode: options => {
        assert.equal(options.deferredForBusyIndicator, true, 'Project save uses synchronous transform commit path');
        transformSaveOrder.push('commit-transform');
        transformActive = false;
    },
    getLayers: () => {
        transformSaveOrder.push('collect-layers');
        return [];
    }
}, {});
const transformProjectData = await transformManager.exportProject({ profile: true });
assert.deepEqual(
    transformSaveOrder,
    ['commit-transform', 'collect-layers'],
    'Layer Transform is committed before Project layer collection'
);
assert.equal(transformActive, false, 'Layer Transform mode is closed before Project serialization');
assert.equal(transformProjectData.__exportProfile.timings.commitLayerTransformMs >= 0, true);

console.log('Project JSON compaction verification passed');
