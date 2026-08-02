/**
 * Phase 6s Stage D: Folder WARPを含むProject JSONとAlbum軽量参照のround-trip境界を固定検証する。
 * 公開APIなし。Node固定fixtureとしてProjectManager / AlbumPopupの既存保存経路を直接利用する。
 */
import assert from 'node:assert/strict';

globalThis.window = globalThis.window || {};
globalThis.document = globalThis.document || {
    createElement: () => ({
        click() {},
        style: {}
    }),
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
const { createWarpGridDeformer } = await import('../system/animation/warp-grid-deformer.js');
const { ProjectManager } = await import('../system/project-manager.js');
const { AlbumPopup } = await import('../ui/album-popup.js');
const { albumStorage } = await import('../system/album-storage.js');

function createWarp(offset = 0) {
    const deformer = createWarpGridDeformer({
        bindBounds: { x: 0, y: 0, width: 32, height: 24 }
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
            placement: { x: offset + 4, y: 3, scale: 1.1, rotation: 0.15 }
        }
    ];
    return deformer;
}

const snapshot = new DrawingSnapshotModel({
    id: 'snap-character',
    width: 2,
    height: 2,
    pixels: new Uint8ClampedArray(16)
});
const model = new TimelineModel({
    fps: 12,
    totalFrames: 6,
    drawingSnapshots: [snapshot]
});
const folderBody = model.createClipAssetInternalLayer({
    id: 'folder-body',
    name: 'Body',
    type: 'folder'
});
const folderHair = model.createClipAssetInternalLayer({
    id: 'folder-hair',
    name: 'Hair',
    type: 'folder'
});
const raster = model.createClipAssetInternalLayer({
    id: 'layer-character',
    name: 'Character raster',
    type: 'raster',
    drawingSnapshotId: snapshot.id,
    parentLayerId: folderBody.id
});
const asset = new ClipAssetModel({
    id: 'asset-character',
    name: 'Character',
    drawingSnapshotId: snapshot.id,
    internalLayers: [folderBody, folderHair, raster]
});
model.clipAssets.push(asset);

const lane = model.createIndependentLane({ name: 'Character Lane' });
const clip = lane.addCel({
    id: 'clip-character',
    assetId: asset.id,
    startFrame: 1,
    duration: 4,
    transform: { x: 8, y: -2, scaleX: 1.1, scaleY: 0.9, rotation: 0.2 },
    deformer: createWarp(0),
    folderDeformers: {
        version: 1,
        targets: [
            { folderLayerId: folderHair.id, deformer: createWarp(2) },
            { folderLayerId: folderBody.id, deformer: createWarp(1) }
        ]
    }
});
assert.ok(clip, 'fixture clip is created');

const manager = new ProjectManager({ getLayers: () => [] }, {});
manager._getAnimationTable = () => ({
    model,
    selectedCelId: clip.id,
    activeLaneId: lane.id,
    selectedAssetId: asset.id,
    selectedInternalLayerId: folderHair.id
});

const projectData = await manager.exportProject({ profile: true });
assert.equal(projectData.app, 'tegaki');
assert.ok(projectData.animation, 'animation payload is present');
assert.equal(projectData.animation.drawingSnapshots[0].pixelEncoding, 'base64');
assert.equal(projectData.animation.tracks[0].cels[0].rasterSnapshot, null);

const serializedJson = JSON.stringify(projectData);
assert.ok(serializedJson.length < 100_000, `fixture project remains bounded: ${serializedJson.length}`);
const restored = new TimelineModel(JSON.parse(serializedJson).animation);
const restoredClip = restored.findClipEntry(clip.id)?.clip;
assert.ok(restoredClip, 'Project JSON restores the clip');
assert.deepEqual(restoredClip.folderDeformers, clip.folderDeformers, 'Folder WARP targets round-trip through ProjectManager');
assert.deepEqual(restoredClip.deformer, clip.deformer, 'CAF WARP remains alongside Folder WARP');
assert.deepEqual(restoredClip.transform, clip.transform, 'CAF transform remains alongside both WARP scopes');
assert.equal(restored.clipAssets[0].internalLayers.length, 3, 'Folder and raster identity list round-trips');

const saveResult = await manager.saveProjectDataToFile(projectData);
assert.equal(saveResult.ok, true, 'bounded Project payload can be saved');
assert.equal(saveResult.jsonLength, serializedJson.length, 'save reports the serialized JSON length');
assert.equal(projectData.__exportProfile.jsonLength, serializedJson.length, 'export profile receives the same JSON length');

let nativeWrittenText = null;
const nativeHandle = {
    name: 'character.json',
    async createWritable() {
        return {
            async write(text) { nativeWrittenText = text; },
            async close() {}
        };
    }
};
manager._canUseNativeFileSave = () => true;
const nativeSaveResult = await manager.saveProjectDataToFile(projectData, {
    fileHandle: nativeHandle,
    preferNative: true
});
assert.equal(nativeSaveResult.ok, true);
assert.equal(nativeSaveResult.native, true);
assert.equal(nativeSaveResult.fileName, nativeHandle.name);
assert.equal(nativeSaveResult.jsonLength, serializedJson.length);
assert.equal(nativeWrittenText, serializedJson, 'native save writes the same Project JSON once');

const cyclic = {};
cyclic.self = cyclic;
const originalConsoleError = console.error;
console.error = () => {};
let failedSave;
try {
    failedSave = await manager.saveProjectDataToFile(cyclic);
} finally {
    console.error = originalConsoleError;
}
assert.equal(failedSave.ok, false, 'serialization failure is returned instead of thrown');
assert.equal(failedSave.reason, 'project-json-serialization-failed');

const album = Object.create(AlbumPopup.prototype);
const albumSnapshot = album._serializeDrawingSnapshotForAlbum(snapshot);
assert.ok(Array.isArray(albumSnapshot.pixels), 'Album CAF snapshot uses cloneable pixel data');
assert.deepEqual(albumSnapshot.pixels, [...snapshot.pixels]);
const reference = album._normalizeImportedSnapshot({
    id: 20,
    thumbnail: 'data:image/png;base64,fixture',
    projectData: null,
    projectReference: {
        type: 'file-system-access',
        fileName: 'character.json',
        savedAt: 1,
        hasFileHandle: true
    }
}, 20);
assert.equal(reference.projectData, null, 'Album reference card does not duplicate Project JSON');
assert.equal(reference.projectReference.fileName, 'character.json');

let capturedReferenceSnapshot = null;
const originalPutSnapshot = albumStorage.putSnapshot;
const originalProjectManager = window.projectManager;
try {
    albumStorage.putSnapshot = async value => {
        capturedReferenceSnapshot = value;
        return {
            id: value.id,
            order: value.order,
            timestamp: value.timestamp,
            thumbnail: value.thumbnail,
            currentFrame: value.currentFrame,
            projectReference: {
                type: value.projectReference.type,
                fileName: value.projectReference.fileName,
                savedAt: value.projectReference.savedAt,
                hasFileHandle: !!value.projectReference.fileHandle
            }
        };
    };
    window.projectManager = {
        currentFileHandle: nativeHandle,
        currentFileName: nativeHandle.name,
        async saveToFile(options) {
            assert.equal(options.preferNative, true);
            assert.equal(options.forcePicker, false);
            return {
                ok: true,
                native: true,
                fileName: nativeHandle.name,
                jsonLength: serializedJson.length
            };
        }
    };
    const referenceAlbum = Object.create(AlbumPopup.prototype);
    referenceAlbum.snapshots = [];
    referenceAlbum.animationSystem = { getCurrentFrameIndex: () => 2 };
    referenceAlbum._captureCurrentThumbnail = async () => 'data:image/png;base64,reference';
    referenceAlbum._renderGallery = () => {};
    referenceAlbum._updateStorageStatus = () => {};
    referenceAlbum._updateProjectSaveTargetStatus = () => {};
    await referenceAlbum._saveAnimationReferenceSnapshot();
} finally {
    albumStorage.putSnapshot = originalPutSnapshot;
    window.projectManager = originalProjectManager;
}
assert.ok(capturedReferenceSnapshot, 'Album external-save path creates a reference card');
assert.equal(capturedReferenceSnapshot.projectData, null, 'reference card does not duplicate Project JSON');
assert.deepEqual(capturedReferenceSnapshot.frameStates, [], 'reference card does not duplicate animation frames');
assert.equal(capturedReferenceSnapshot.projectReference.fileHandle, nativeHandle);
assert.equal(capturedReferenceSnapshot.projectReference.fileName, nativeHandle.name);

console.log('verify-folder-deformer-project-roundtrip: Project JSON, save failure handling, and Album reference payload OK');
