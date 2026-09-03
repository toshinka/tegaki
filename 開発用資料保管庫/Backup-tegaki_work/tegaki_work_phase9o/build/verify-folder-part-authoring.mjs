import assert from 'node:assert/strict';
import {
    getRigPartKeyAtFrame,
    rebasePartMotionAroundPoint,
    resolvePartTransformHandleDrag,
    sampleRigInstanceMotion,
    validateRigDefinition,
    validateRigMotion
} from '../system/animation/part-rig.js';
import {
    applyTransformMatrix,
    createAffineTransformMatrix
} from '../system/transform-math.js';

globalThis.window = {};
const {
    ClipAssetModel,
    TimelineModel
} = await import('../system/animation/animation-data-model.js');

const model = new TimelineModel({ fps: 8, totalFrames: 12 });
const partFolder = model.createClipAssetInternalLayer({
    id: 'part-folder',
    name: 'Arm',
    type: 'folder'
});
const siblingFolder = model.createClipAssetInternalLayer({
    id: 'sibling-folder',
    name: 'Head',
    type: 'folder'
});
const raster = model.createClipAssetInternalLayer({
    id: 'part-raster',
    name: 'Line',
    type: 'raster',
    parentLayerId: partFolder.id
});
const asset = new ClipAssetModel({
    id: 'asset-part-authoring',
    name: 'Part authoring fixture',
    internalLayers: [partFolder, raster, siblingFolder]
});
model.clipAssets.push(asset);
const lane = model.createIndependentLane({ name: 'Rig Lane' });
const clip = lane.addCel({
    id: 'part-authoring-clip',
    assetId: asset.id,
    startFrame: 3,
    duration: 5
});

const registered = model.registerClipAssetFolderPart(asset.id, partFolder.id, { maxParts: 1 });
assert.equal(registered.ok, true);
assert.equal(registered.changed, true);
assert.equal(registered.part.partId, partFolder.id);
assert.deepEqual(registered.part.bindTransform, {
    x: 0,
    y: 0,
    scaleX: 1,
    scaleY: 1,
    rotation: 0,
    pivotX: 0,
    pivotY: 0
});
assert.equal(validateRigDefinition(asset.rigDefinition, asset.internalLayers).ok, true);

const duplicate = model.registerClipAssetFolderPart(asset.id, partFolder.id, { maxParts: 1 });
assert.equal(duplicate.ok, true);
assert.equal(duplicate.changed, false);
assert.equal(asset.rigDefinition.parts.length, 1);
assert.equal(
    model.registerClipAssetFolderPart(asset.id, siblingFolder.id, { maxParts: 1 }).reason,
    'part-limit'
);
assert.equal(model.registerClipAssetFolderPart(asset.id, raster.id, { maxParts: 1 }).reason, 'folder-required');

const added = model.setClipRigPartKey(clip.id, partFolder.id, 2, {
    x: 12,
    y: -4,
    scaleX: 1.25,
    scaleY: 0.75,
    rotation: 0.3
}, { interpolation: 'linear' });
assert.equal(added.ok, true);
assert.equal(clip.rigMotion.partTracks.length, 1);
assert.equal(clip.rigMotion.partTracks[0].keyframes.length, 1);
assert.equal(validateRigMotion(clip.rigMotion, asset.rigDefinition, clip.duration).ok, true);
assert.deepEqual(sampleRigInstanceMotion(clip, clip.startFrame + 2).get(partFolder.id), {
    x: 12,
    y: -4,
    scaleX: 1.25,
    scaleY: 0.75,
    rotation: 0.3
});

const updated = model.setClipRigPartKey(clip.id, partFolder.id, 2, {
    x: 20,
    y: 5,
    scaleX: 1,
    scaleY: 1,
    rotation: -0.2
}, { interpolation: 'hold' });
assert.equal(updated.ok, true);
assert.equal(clip.rigMotion.partTracks[0].keyframes.length, 1);
assert.equal(getRigPartKeyAtFrame(clip.rigMotion, partFolder.id, 2).interpolation, 'hold');
assert.equal(getRigPartKeyAtFrame(clip.rigMotion, partFolder.id, 2).x, 20);
assert.equal(model.setClipRigPartKey(clip.id, partFolder.id, 5, {}, {}).reason, 'part-key-out-of-range');

assert.equal(model.setClipRigPartKey(clip.id, partFolder.id, 0, {
    x: 0,
    y: 0,
    scaleX: 1,
    scaleY: 1,
    rotation: 0
}, { interpolation: 'linear' }).ok, true);
assert.equal(model.setClipRigPartKey(clip.id, partFolder.id, 4, {
    x: 40,
    y: 10,
    scaleX: 2,
    scaleY: 0.5,
    rotation: 0.4
}, { interpolation: 'hold' }).ok, true);
assert.equal(sampleRigInstanceMotion(clip, clip.startFrame).get(partFolder.id).x, 0);
assert.equal(sampleRigInstanceMotion(clip, clip.startFrame + 1).get(partFolder.id).x, 10);
assert.equal(sampleRigInstanceMotion(clip, clip.startFrame + 3).get(partFolder.id).x, 20);
assert.equal(sampleRigInstanceMotion(clip, clip.startFrame + 4).get(partFolder.id).x, 40);
assert.deepEqual(
    sampleRigInstanceMotion(clip, clip.startFrame + 1),
    sampleRigInstanceMotion(clip, clip.startFrame + 1),
    'random seek is stateless'
);

const roundTrip = new TimelineModel(model.serialize());
const roundTripEntry = roundTrip.findClipEntry(clip.id);
const roundTripAsset = roundTrip.getClipAsset(asset.id);
assert.equal(validateRigDefinition(roundTripAsset.rigDefinition, roundTripAsset.internalLayers).ok, true);
assert.equal(validateRigMotion(roundTripEntry.clip.rigMotion, roundTripAsset.rigDefinition, 5).ok, true);
assert.equal(getRigPartKeyAtFrame(roundTripEntry.clip.rigMotion, partFolder.id, 2).x, 20);

const removed = model.removeClipRigPartKey(clip.id, partFolder.id, 2);
assert.equal(removed.ok, true);
assert.equal(getRigPartKeyAtFrame(clip.rigMotion, partFolder.id, 2), null);
assert.equal(model.removeClipRigPartKey(clip.id, partFolder.id, 2).reason, 'part-key-not-found');
assert.equal(model.removeClipRigPartKey(clip.id, partFolder.id, 0).ok, true);
assert.equal(model.removeClipRigPartKey(clip.id, partFolder.id, 4).ok, true);
assert.equal(clip.rigMotion, null);

const centeredMotion = rebasePartMotionAroundPoint(
    registered.part.bindTransform,
    { x: 0, y: 0, scaleX: 1.5, scaleY: 0.75, rotation: Math.PI / 3 },
    { x: 120, y: 80 },
    { x: 120, y: 80 }
);
const centeredMatrix = createAffineTransformMatrix({
    ...registered.part.bindTransform,
    x: registered.part.bindTransform.x + centeredMotion.x,
    y: registered.part.bindTransform.y + centeredMotion.y,
    scaleX: registered.part.bindTransform.scaleX * centeredMotion.scaleX,
    scaleY: registered.part.bindTransform.scaleY * centeredMotion.scaleY,
    rotation: registered.part.bindTransform.rotation + centeredMotion.rotation
});
const centeredPoint = applyTransformMatrix(centeredMatrix, 120, 80);
assert.ok(Math.abs(centeredPoint.x - 120) < 1e-9);
assert.ok(Math.abs(centeredPoint.y - 80) < 1e-9);

const handleStart = { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 };
assert.deepEqual(resolvePartTransformHandleDrag({
    mode: 'move',
    startTransform: handleStart,
    startPointer: { x: 100, y: 80 },
    currentPointer: { x: 112, y: 73 }
}), { x: 12, y: -7, scaleX: 1, scaleY: 1, rotation: 0 });
const handleScale = resolvePartTransformHandleDrag({
    mode: 'scale',
    bindTransform: registered.part.bindTransform,
    startTransform: handleStart,
    startPointer: { x: 150, y: 80 },
    currentPointer: { x: 180, y: 80 },
    sourceCenter: { x: 120, y: 80 },
    fixedCenter: { x: 120, y: 80 },
    startDistance: 30
});
assert.equal(handleScale.scaleX, 2);
assert.equal(handleScale.scaleY, 2);
const handleRotation = resolvePartTransformHandleDrag({
    mode: 'rotate',
    bindTransform: registered.part.bindTransform,
    startTransform: handleStart,
    startPointer: { x: 150, y: 80 },
    currentPointer: { x: 120, y: 110 },
    sourceCenter: { x: 120, y: 80 },
    fixedCenter: { x: 120, y: 80 },
    startAngle: 0
});
assert.ok(Math.abs(handleRotation.rotation - Math.PI / 2) < 1e-9);

console.log(
    'verify-folder-part-authoring: Folder registration, single-Part limit, key add/update/delete, '
    + 'sample, centered handle algebra, validation, and round-trip OK'
);

const outputArgumentIndex = process.argv.indexOf('--write-project');
if (outputArgumentIndex >= 0) {
    const outputPath = process.argv[outputArgumentIndex + 1];
    assert.ok(outputPath, 'Project fixture output path is required');
    const { writeFile } = await import('node:fs/promises');
    const { DrawingSnapshotModel } = await import('../system/animation/animation-data-model.js');

    const solidSnapshot = (id, bounds, color) => {
        const pixels = new Uint8ClampedArray(bounds.width * bounds.height * 4);
        for (let offset = 0; offset < pixels.length; offset += 4) {
            pixels[offset] = color[0];
            pixels[offset + 1] = color[1];
            pixels[offset + 2] = color[2];
            pixels[offset + 3] = color[3];
        }
        return new DrawingSnapshotModel({ id, ...bounds, rasterBounds: bounds, pixels });
    };

    const fixtureModel = new TimelineModel({
        fps: 2,
        totalFrames: 4,
        drawingSnapshots: [
            solidSnapshot('phase6l-red', { x: 90, y: 90, width: 30, height: 22 }, [180, 40, 30, 255]),
            solidSnapshot('phase6l-blue', { x: 190, y: 96, width: 20, height: 20 }, [30, 70, 180, 255])
        ]
    });
    const fixtureFolder = fixtureModel.createClipAssetInternalLayer({
        id: 'phase6l-part-folder',
        name: 'Arm Folder',
        type: 'folder'
    });
    const fixtureChild = fixtureModel.createClipAssetInternalLayer({
        id: 'phase6l-part-child',
        name: 'Arm Paint',
        type: 'raster',
        parentLayerId: fixtureFolder.id,
        drawingSnapshotId: 'phase6l-red'
    });
    const fixtureOutside = fixtureModel.createClipAssetInternalLayer({
        id: 'phase6l-outside',
        name: 'Outside',
        type: 'raster',
        drawingSnapshotId: 'phase6l-blue'
    });
    const fixtureAsset = new ClipAssetModel({
        id: 'phase6l-asset',
        name: 'Phase 6l Folder Part',
        drawingSnapshotId: 'phase6l-red',
        internalLayers: [fixtureFolder, fixtureChild, fixtureOutside]
    });
    fixtureModel.clipAssets.push(fixtureAsset);
    const fixtureLane = fixtureModel.createIndependentLane({ name: 'Rig Lane' });
    const fixtureClip = fixtureLane.addCel({
        id: 'phase6l-clip',
        assetId: fixtureAsset.id,
        startFrame: 0,
        duration: 4
    });

    await writeFile(outputPath, JSON.stringify({
        version: 2,
        app: 'tegaki',
        canvas: { width: 400, height: 400 },
        background: { color: 0xf0e0d6, visible: true },
        layers: [],
        animation: fixtureModel.serialize(),
        animationState: {
            selectedCelId: fixtureClip.id,
            activeLaneId: fixtureLane.id,
            selectedAssetId: fixtureAsset.id,
            selectedInternalLayerId: fixtureFolder.id,
            playbackScope: 'all',
            includedLaneIds: []
        }
    }));
}
