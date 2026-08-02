import assert from 'node:assert/strict';
import { sampleClipBakeState } from '../system/animation/clip-bake-sampler.js';
import { sampleClipDeformer } from '../system/animation/clip-deformer.js';
import { sampleClipTransform } from '../system/animation/clip-transform-sampler.js';
import { createWarpGridDeformer } from '../system/animation/warp-grid-deformer.js';

globalThis.window = globalThis.window || {};
const {
    ClipAssetModel,
    DrawingSnapshotModel,
    TimelineModel
} = await import('../system/animation/animation-data-model.js');

function createPixels(width, height, seed) {
    const pixels = new Uint8ClampedArray(width * height * 4);
    for (let offset = 0; offset < pixels.length; offset += 4) {
        const index = offset / 4;
        pixels[offset] = (seed * 31 + index * 17) % 256;
        pixels[offset + 1] = (seed * 47 + index * 11) % 256;
        pixels[offset + 2] = (seed * 59 + index * 7) % 256;
        pixels[offset + 3] = (seed * 23 + index * 29) % 256;
    }
    return pixels;
}

function createSnapshot(width, height, rasterBounds, seed) {
    return new DrawingSnapshotModel({
        width,
        height,
        rasterBounds,
        pixels: createPixels(width, height, seed)
    });
}

function getLayerSemantics(asset) {
    const byId = new Map(asset.internalLayers.map(layer => [layer.id, layer]));
    return asset.internalLayers.map(layer => ({
        name: layer.name,
        type: layer.type,
        visible: layer.visible,
        opacity: layer.opacity,
        blendMode: layer.blendMode,
        clippingMode: layer.clippingMode,
        isBackground: layer.isBackground,
        parentName: layer.parentLayerId ? byId.get(layer.parentLayerId)?.name || null : null
    }));
}

function assertSnapshotClone(sourceModel, sourceAsset, outputModel, outputAsset) {
    const sourceLayers = new Map(sourceAsset.internalLayers.map(layer => [layer.name, layer]));
    outputAsset.internalLayers.forEach(outputLayer => {
        if (outputLayer.type === 'folder') return;
        const sourceLayer = sourceLayers.get(outputLayer.name);
        const sourceSnapshot = sourceModel.getDrawingSnapshot(sourceLayer.drawingSnapshotId);
        const outputSnapshot = outputModel.getDrawingSnapshot(outputLayer.drawingSnapshotId);
        assert.ok(outputSnapshot, `${outputLayer.name} output Snapshot`);
        assert.notEqual(outputSnapshot.id, sourceSnapshot.id, `${outputLayer.name} independent Snapshot id`);
        assert.notEqual(outputSnapshot.pixels, sourceSnapshot.pixels, `${outputLayer.name} independent pixels`);
        assert.deepEqual(outputSnapshot.rasterBounds, sourceSnapshot.rasterBounds, `${outputLayer.name} rasterBounds`);
        assert.deepEqual([...outputSnapshot.pixels], [...sourceSnapshot.pixels], `${outputLayer.name} pixels`);
    });
}

function assertSampledStateEqual(sourceClip, timelineFrame, outputClip) {
    assert.deepEqual(
        sampleClipTransform(outputClip, outputClip.startFrame),
        sampleClipTransform(sourceClip, timelineFrame),
        `Motion sample at F${timelineFrame + 1}`
    );
    const sourceDeformer = sampleClipDeformer(
        sourceClip.deformer,
        timelineFrame - sourceClip.startFrame,
        sourceClip.duration
    );
    const outputDeformer = sampleClipDeformer(outputClip.deformer, 0, 1);
    assert.deepEqual(outputDeformer, sourceDeformer, `WARP sample at F${timelineFrame + 1}`);
}

async function writeProjectFixture(outputPath, animationModel) {
    assert.ok(outputPath, 'Project fixture output path is required');
    const { writeFile } = await import('node:fs/promises');
    await writeFile(outputPath, JSON.stringify({
        version: 2,
        app: 'tegaki',
        canvas: { width: 400, height: 400 },
        background: { color: 0xf0e0d6, visible: true },
        layers: [],
        animation: animationModel.serialize(),
        animationState: null
    }));
}

const snapshots = [
    createSnapshot(5, 4, { x: -3, y: 2, width: 5, height: 4 }, 1),
    createSnapshot(3, 6, { x: 1, y: -5, width: 3, height: 6 }, 2),
    createSnapshot(4, 3, { x: 7, y: 8, width: 4, height: 3 }, 3),
    createSnapshot(2, 2, { x: -8, y: -6, width: 2, height: 2 }, 4),
    createSnapshot(6, 2, { x: 10, y: -2, width: 6, height: 2 }, 5)
];
const model = new TimelineModel({ drawingSnapshots: snapshots });

const rootFolder = model.createClipAssetInternalLayer({
    name: 'Root Group',
    type: 'folder',
    opacity: 0.7,
    blendMode: 'overlay'
});
const normalClip = model.createClipAssetInternalLayer({
    name: 'Normal Clip',
    type: 'raster',
    drawingSnapshotId: snapshots[1].id,
    parentLayerId: rootFolder.id,
    opacity: 0.5,
    blendMode: 'add',
    clippingMode: 'normal'
});
const normalBase = model.createClipAssetInternalLayer({
    name: 'Normal Base',
    type: 'raster',
    drawingSnapshotId: snapshots[0].id,
    parentLayerId: rootFolder.id,
    blendMode: 'multiply'
});
const nestedFolder = model.createClipAssetInternalLayer({
    name: 'Nested Group',
    type: 'folder',
    parentLayerId: rootFolder.id,
    opacity: 0.6,
    blendMode: 'screen'
});
const inverseClip = model.createClipAssetInternalLayer({
    name: 'Inverse Clip',
    type: 'raster',
    drawingSnapshotId: snapshots[3].id,
    parentLayerId: nestedFolder.id,
    opacity: 0.4,
    blendMode: 'subtract',
    clippingMode: 'inverse'
});
const inverseBaseFolder = model.createClipAssetInternalLayer({
    name: 'Inverse Base Folder',
    type: 'folder',
    parentLayerId: nestedFolder.id,
    opacity: 0.8,
    blendMode: 'normal'
});
const inverseBase = model.createClipAssetInternalLayer({
    name: 'Inverse Base',
    type: 'raster',
    drawingSnapshotId: snapshots[2].id,
    parentLayerId: inverseBaseFolder.id,
    blendMode: 'overlay'
});
const hiddenOffCanvas = model.createClipAssetInternalLayer({
    name: 'Hidden Off-canvas',
    type: 'raster',
    drawingSnapshotId: snapshots[4].id,
    visible: false,
    opacity: 0.25,
    blendMode: 'add'
});
const sourceAsset = new ClipAssetModel({
    name: 'Structured source',
    drawingSnapshotId: snapshots[0].id,
    internalLayers: [
        rootFolder,
        normalClip,
        normalBase,
        nestedFolder,
        inverseClip,
        inverseBaseFolder,
        inverseBase,
        hiddenOffCanvas
    ]
});
model.clipAssets.push(sourceAsset);

const sourceSemantics = getLayerSemantics(sourceAsset);
const warp = createWarpGridDeformer({ bindBounds: { x: -12, y: -9, width: 36, height: 28 } });
const displacedPoints = warp.points.map((point, index) => ({
    x: point.x + (index % 4) * 0.04,
    y: point.y - Math.floor(index / 4) * 0.03
}));
warp.keyframes = [
    {
        frame: 0,
        interpolation: 'linear',
        points: warp.points,
        placement: { x: -4, y: 7, scale: 0.9, rotation: -0.15 }
    },
    {
        frame: 3,
        interpolation: 'hold',
        points: displacedPoints,
        placement: { x: 13, y: -11, scale: 1.35, rotation: 0.4 }
    }
];
const lane = model.createIndependentLane();
const sourceClip = lane.addCel({
    assetId: sourceAsset.id,
    startFrame: 6,
    duration: 4,
    transform: {
        x: -18,
        y: 23,
        scaleX: 0.8,
        scaleY: 1.2,
        rotation: -0.2,
        opacity: 0.75,
        blendMode: 'overlay',
        blendStrength: 0.65
    },
    transformKeyframes: [
        { frame: 0, interpolation: 'linear', x: -20, y: 4, opacity: 0.35 },
        { frame: 3, interpolation: 'hold', x: 16, y: -9, opacity: 0.9 }
    ],
    deformer: warp
});

const bakeLane = model.createIndependentLane({ placement: 'top' });
const outputs = [];
for (let localFrame = 0; localFrame < sourceClip.duration; localFrame++) {
    const timelineFrame = sourceClip.startFrame + localFrame;
    const duplicate = model.duplicateClipAsset(sourceAsset.id, {
        name: `Frame ${localFrame + 1}`,
        folderId: 'bake-folder'
    });
    assert.equal(duplicate.ok, true);
    assert.equal(duplicate.asset.folderId, 'bake-folder');
    assert.deepEqual(getLayerSemantics(duplicate.asset), sourceSemantics);
    assertSnapshotClone(model, sourceAsset, model, duplicate.asset);

    const sampled = sampleClipBakeState(sourceClip, timelineFrame);
    const outputClip = bakeLane.addCel({
        assetId: duplicate.asset.id,
        startFrame: timelineFrame,
        duration: 1,
        ...sampled
    });
    assert.ok(outputClip);
    assert.deepEqual(outputClip.transformKeyframes, []);
    assert.equal(outputClip.deformer.keyframes.length, 1);
    assert.equal(outputClip.deformer.keyframes[0].frame, 0);
    assertSampledStateEqual(sourceClip, timelineFrame, outputClip);
    outputs.push({ clip: outputClip, asset: duplicate.asset });
}

assert.equal(model.tracks[0].id, bakeLane.id, 'structured Bake Lane is topmost');
assert.equal(outputs.length, 4);
assert.equal(new Set(outputs.map(output => output.asset.id)).size, 4, 'one independent Asset per Frame');
assert.equal(
    new Set(outputs.flatMap(output => output.asset.internalLayers)
        .filter(layer => layer.type === 'raster')
        .map(layer => layer.drawingSnapshotId)).size,
    20,
    'one independent Snapshot per raster Layer and Frame'
);

sourceClip.visible = false;

const restored = new TimelineModel(JSON.parse(JSON.stringify(model.serialize())));
assert.equal(restored.getClipById(sourceClip.id)?.visible, false, 'hidden source Clip survives round-trip');
for (let index = 0; index < outputs.length; index++) {
    const sourceOutput = outputs[index];
    const restoredClip = restored.getClipById(sourceOutput.clip.id);
    const restoredAsset = restored.getClipAsset(sourceOutput.asset.id);
    assert.ok(restoredClip);
    assert.ok(restoredAsset);
    assert.deepEqual(getLayerSemantics(restoredAsset), sourceSemantics);
    assertSnapshotClone(model, sourceAsset, restored, restoredAsset);
    assertSampledStateEqual(sourceClip, sourceClip.startFrame + index, restoredClip);
}

const outputArgumentIndex = process.argv.indexOf('--write-project');
if (outputArgumentIndex >= 0) {
    await writeProjectFixture(process.argv[outputArgumentIndex + 1], model);
}

const capacityOutputArgumentIndex = process.argv.indexOf('--write-capacity-project');
if (capacityOutputArgumentIndex >= 0) {
    const capacityOutputPath = process.argv[capacityOutputArgumentIndex + 1];
    const capacityFrameCount = Math.max(
        1,
        Math.min(240, Math.round(Number(process.argv[capacityOutputArgumentIndex + 2]) || 240))
    );
    const capacitySnapshot = createSnapshot(
        400,
        400,
        { x: 0, y: 0, width: 400, height: 400 },
        9
    );
    const capacityModel = new TimelineModel({
        totalFrames: capacityFrameCount,
        drawingSnapshots: [capacitySnapshot]
    });
    const capacityLayer = capacityModel.createClipAssetInternalLayer({
        name: 'Capacity Raster',
        type: 'raster',
        drawingSnapshotId: capacitySnapshot.id
    });
    const capacityAsset = new ClipAssetModel({
        name: `Capacity ${capacityFrameCount}F`,
        drawingSnapshotId: capacitySnapshot.id,
        internalLayers: [capacityLayer]
    });
    capacityModel.clipAssets.push(capacityAsset);
    const capacityWarp = createWarpGridDeformer({
        bindBounds: { x: 0, y: 0, width: 400, height: 400 }
    });
    capacityWarp.keyframes = [{
        frame: 0,
        interpolation: 'hold',
        points: capacityWarp.points
    }];
    capacityModel.createIndependentLane().addCel({
        assetId: capacityAsset.id,
        startFrame: 0,
        duration: capacityFrameCount,
        deformer: capacityWarp,
        rasterSnapshot: capacitySnapshot
    });
    await writeProjectFixture(capacityOutputPath, capacityModel);
}

outputs[0].asset.internalLayers.find(layer => layer.type === 'raster').name = 'Edited independently';
assert.notEqual(outputs[1].asset.internalLayers.find(layer => layer.type === 'raster').name, 'Edited independently');
const firstOutputSnapshot = model.getDrawingSnapshot(
    outputs[0].asset.internalLayers.find(layer => layer.type === 'raster').drawingSnapshotId
);
const secondOutputSnapshot = model.getDrawingSnapshot(
    outputs[1].asset.internalLayers.find(layer => layer.type === 'raster').drawingSnapshotId
);
firstOutputSnapshot.pixels[0] ^= 255;
assert.notEqual(firstOutputSnapshot.pixels[0], secondOutputSnapshot.pixels[0]);

console.log(
    'verify-structured-bake-model: nested Folder, normal/inverse clipping, blend/opacity/visibility, '
    + 'off-canvas bounds, per-Frame Motion/WARP sample, independent edits, Project round-trip OK'
);
