import assert from 'node:assert/strict';
import {
    getClipFolderTransformKeyAtFrame,
    planClipFolderTransformKeyUpsert,
    remapClipFolderTransformTracks,
    retimeClipFolderTransformTracks,
    sampleClipFolderTransform,
    validateClipFolderTransformTracks
} from '../system/animation/clip-folder-transform.js';

globalThis.window = globalThis.window || {};
const { ClipAssetModel, TimelineModel } = await import('../system/animation/animation-data-model.js');
const { sampleClipBakeState } = await import('../system/animation/clip-bake-sampler.js');
const { createWarpGridDeformer } = await import('../system/animation/warp-grid-deformer.js');

const layers = [
    { id: 'folder-a', type: 'folder', parentLayerId: null },
    { id: 'folder-child', type: 'folder', parentLayerId: 'folder-a' },
    { id: 'folder-b', type: 'folder', parentLayerId: null },
    { id: 'raster-a', type: 'raster', parentLayerId: 'folder-a' }
];
const source = [];
const first = planClipFolderTransformKeyUpsert({
    tracks: source,
    folderLayerId: 'folder-a',
    frame: 1,
    duration: 4,
    pivotX: 100,
    pivotY: 80,
    transform: { x: 20, y: 4, scaleX: 1.2, scaleY: 0.8, rotation: 0.25 }
});
assert.equal(first.ok, true);
assert.equal(first.changed, true);
assert.deepEqual(source, [], 'planner must not mutate input tracks');
assert.equal(getClipFolderTransformKeyAtFrame(first.tracks, 'folder-a', 1)?.x, 20);

const clip = { startFrame: 10, duration: 4, folderTransformTracks: first.tracks };
const sampled = sampleClipFolderTransform(clip, 'folder-a', 11);
assert.equal(sampled.x, 20);
assert.equal(sampled.pivotX, 100);
assert.equal(sampleClipFolderTransform(clip, 'folder-b', 11), null);
const baked = sampleClipBakeState(clip, 11);
assert.equal(baked.folderTransformTracks[0].keyframes[0].frame, 0);
assert.equal(baked.folderTransformTracks[0].keyframes[0].x, 20);

const same = planClipFolderTransformKeyUpsert({
    tracks: first.tracks,
    folderLayerId: 'folder-a',
    frame: 1,
    duration: 4,
    pivotX: 100,
    pivotY: 80,
    transform: { x: 20, y: 4, scaleX: 1.2, scaleY: 0.8, rotation: 0.25 }
});
assert.equal(same.changed, false);
assert.equal(same.replaced, true);
assert.equal(planClipFolderTransformKeyUpsert({
    tracks: first.tracks,
    folderLayerId: 'folder-a',
    frame: 2,
    duration: 4,
    pivotX: 101,
    pivotY: 80,
    transform: { x: 1 }
}).reason, 'folder-transform-pivot-mismatch');

assert.equal(validateClipFolderTransformTracks(first.tracks, layers, 4).ok, true);
assert.equal(validateClipFolderTransformTracks(first.tracks, [{ id: 'raster-a', type: 'raster' }], 4).ok, false);
assert.equal(validateClipFolderTransformTracks([
    { folderLayerId: 'raster-a', pivotX: 0, pivotY: 0, keyframes: [] }
], layers, 4).ok, false);
assert.equal(validateClipFolderTransformTracks([
    first.tracks[0],
    { ...first.tracks[0], folderLayerId: 'folder-child' }
], layers, 4).errors.some(error => error.code === 'nested-folder-transform-unsupported'), true);
assert.equal(validateClipFolderTransformTracks([
    { folderLayerId: 'folder-b', pivotX: Number.NaN, pivotY: 0, keyframes: [] }
], layers, 4).errors.some(error => error.code === 'invalid-folder-transform-pivot'), true);

const remapped = remapClipFolderTransformTracks(first.tracks, new Map([['folder-a', 'folder-copy']]));
assert.equal(remapped[0].folderLayerId, 'folder-copy');
assert.equal(first.tracks[0].folderLayerId, 'folder-a');
const terminal = planClipFolderTransformKeyUpsert({
    tracks: first.tracks,
    folderLayerId: 'folder-a',
    frame: 3,
    duration: 4,
    pivotX: 100,
    pivotY: 80,
    transform: { x: 40, y: 0, scaleX: 1, scaleY: 1, rotation: 0 }
});
assert.deepEqual(retimeClipFolderTransformTracks(terminal.tracks, 4, 7)[0].keyframes.map(key => key.frame), [1, 6]);

const model = new TimelineModel({ totalFrames: 8 });
const asset = new ClipAssetModel({ id: 'asset', internalLayers: layers });
model.clipAssets.push(asset);
const lane = model.createIndependentLane({ name: 'Lane' });
lane.addCel({ id: 'clip', assetId: asset.id, startFrame: 0, duration: 4 });
assert.equal(model.setClipFolderTransformTracks('clip', first.tracks).ok, true);
assert.equal(model.findClipEntry('clip').clip.layerTransformTracks.length, 0,
    'Folder KEY must not expand into individual Layer Motion');
const roundTrip = new TimelineModel(model.serialize());
assert.deepEqual(roundTrip.findClipEntry('clip').clip.folderTransformTracks, first.tracks);
const warp = createWarpGridDeformer({ bindBounds: { x: 0, y: 0, width: 20, height: 20 } });
assert.equal(model.setClipFolderDeformer('clip', 'folder-a', warp).reason,
    'folder-deformer-motion-unsupported');
assert.equal(model.setClipFolderTransformTracks('clip', []).ok, true);
assert.equal(model.setClipFolderDeformer('clip', 'folder-a', warp).ok, true);
assert.equal(model.setClipFolderTransformTracks('clip', first.tracks).reason,
    'folder-deformer-motion-unsupported');
assert.equal(model.removeClipFolderDeformer('clip', 'folder-a').ok, true);
assert.equal(model.setClipFolderTransformTracks('clip', first.tracks).ok, true);

const duplicated = model.duplicateClipAssetInternalLayer(asset.id, 'folder-a');
assert.equal(duplicated.ok, true);
const copiedFolderId = duplicated.internalLayerIdMap.get('folder-a');
assert.ok(model.findClipEntry('clip').clip.folderTransformTracks
    .some(track => track.folderLayerId === copiedFolderId));
assert.equal(model.removeClipAssetInternalLayer(asset.id, copiedFolderId).ok, true);
assert.equal(model.findClipEntry('clip').clip.folderTransformTracks
    .some(track => track.folderLayerId === copiedFolderId), false);

console.log('Folder transform schema/model: validate/sample/upsert/remap/retime/roundtrip/duplicate/delete passed.');
