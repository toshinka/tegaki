import assert from 'node:assert/strict';

import {
    calculateFolderPartAssetBounds,
    createFolderPartRenderPlan
} from '../system/animation/folder-part-render-plan.js';
import { applyTransformMatrix } from '../system/transform-math.js';

const close = (actual, expected, label) => {
    assert.ok(Math.abs(actual - expected) < 1e-8, `${label}: ${actual} !== ${expected}`);
};
const matrixClose = (actual, expected, label) => {
    ['a', 'b', 'c', 'd', 'tx', 'ty'].forEach(field => {
        close(actual[field], expected[field], `${label}.${field}`);
    });
};

const folder = { id: 'folder-part', type: 'folder', parentLayerId: null, visible: true, opacity: 1, blendMode: 'normal' };
const raster = {
    id: 'raster-child',
    type: 'raster',
    parentLayerId: folder.id,
    drawingSnapshotId: 'snapshot-child',
    visible: true,
    opacity: 1,
    blendMode: 'normal',
    clippingMode: 'none'
};
const identityTransform = {
    x: 0,
    y: 0,
    scaleX: 1,
    scaleY: 1,
    rotation: 0,
    pivotX: 0,
    pivotY: 0
};
const createAsset = (options = {}) => ({
    id: 'bone-binding-asset',
    internalLayers: [folder, raster],
    rigDefinition: {
        version: 1,
        parts: [{
            partId: folder.id,
            parentPartId: null,
            bindTransform: { ...identityTransform }
        }],
        bones: options.bones || [{
            boneId: 'bone-root',
            parentBoneId: null,
            bindTransform: {
                ...identityTransform,
                x: 10
            },
            length: 8
        }],
        ...(options.binding === false
            ? {}
            : { rigidBindings: options.bindings || [{ boneId: 'bone-root', partId: folder.id }] })
    }
});
const createClip = (partTransform = {}, boneTransform = {}) => ({
    startFrame: 0,
    duration: 3,
    rigMotion: {
        version: 1,
        partTracks: [{
            partId: folder.id,
            keyframes: [
                { frame: 0, interpolation: 'hold', ...identityTransform, ...partTransform },
                { frame: 2, interpolation: 'hold', ...identityTransform, ...partTransform }
            ]
        }],
        boneTracks: [{
            boneId: 'bone-root',
            keyframes: [
                { frame: 0, interpolation: 'hold', ...identityTransform, ...boneTransform },
                { frame: 2, interpolation: 'hold', ...identityTransform, ...boneTransform }
            ]
        }]
    }
});

const asset = createAsset();
const identityPlan = createFolderPartRenderPlan(asset, createClip({ x: 3 }), 0);
assert.equal(identityPlan.status, 'ready', 'identity Bone delta keeps Folder Part plan ready');
matrixClose(identityPlan.islands[0].worldMatrix, identityPlan.islands[0].partWorldMatrix, 'Bind Pose does not move Part');
assert.deepEqual(identityPlan.islands[0].rigidBinding, { boneId: 'bone-root', partId: folder.id });

const translatedPlan = createFolderPartRenderPlan(asset, createClip({ x: 2 }, { x: 5 }), 0);
close(translatedPlan.islands[0].boneDeltaMatrix.tx, 5, 'Bone translation delta');
close(translatedPlan.islands[0].worldMatrix.tx, 7, 'Part world composes after Bone translation delta');

const rotatedPlan = createFolderPartRenderPlan(asset, createClip({ x: 3 }, { rotation: Math.PI / 2 }), 0);
const rotatedOrigin = applyTransformMatrix(rotatedPlan.islands[0].worldMatrix, 0, 0);
close(rotatedOrigin.x, 13, 'Part translation applies after Bone rotation around Bind origin x');
close(rotatedOrigin.y, -10, 'Bone rotation around Bind origin y');

const scaledPlan = createFolderPartRenderPlan(asset, createClip({ x: -2 }, { scaleX: 2, scaleY: 0.5 }), 0);
const scaledBindOrigin = applyTransformMatrix(scaledPlan.islands[0].worldMatrix, 10, 0);
close(scaledBindOrigin.x, 8, 'Bone scale keeps Bind origin before Part translation');
close(scaledBindOrigin.y, 0, 'Bone scale keeps Bind origin y');

const randomSeekPlan = createFolderPartRenderPlan(asset, createClip({ x: 3 }, { rotation: Math.PI / 2 }), 2);
assert.deepEqual(randomSeekPlan.islands[0].worldMatrix, rotatedPlan.islands[0].worldMatrix, 'binding plan random seek is stateless');

const unboundPlan = createFolderPartRenderPlan(createAsset({ binding: false }), createClip({ x: 4 }, { x: 20 }), 0);
assert.equal(unboundPlan.status, 'ready', 'unbound Bone leaves existing Part plan enabled');
close(unboundPlan.islands[0].worldMatrix.tx, 4, 'unbound Bone does not affect Part');
assert.equal(unboundPlan.islands[0].boneDeltaMatrix, null);

const secondFolder = { ...folder, id: 'folder-second' };
const secondRaster = { ...raster, id: 'raster-second', parentLayerId: secondFolder.id, drawingSnapshotId: 'snapshot-second' };
const multiRootAsset = {
    id: 'multi-root-binding',
    internalLayers: [folder, raster, secondFolder, secondRaster],
    rigDefinition: {
        version: 1,
        parts: [folder.id, secondFolder.id].map(partId => ({
            partId,
            parentPartId: null,
            bindTransform: { ...identityTransform }
        })),
        bones: [
            { boneId: 'bone-root', parentBoneId: null, bindTransform: { ...identityTransform, x: 10 }, length: 8 },
            { boneId: 'bone-second', parentBoneId: null, bindTransform: { ...identityTransform, x: 30 }, length: 8 }
        ],
        rigidBindings: [
            { boneId: 'bone-root', partId: folder.id },
            { boneId: 'bone-second', partId: secondFolder.id }
        ]
    }
};
const multiRootClip = {
    startFrame: 0,
    duration: 1,
    rigMotion: {
        version: 1,
        partTracks: [],
        boneTracks: [
            { boneId: 'bone-root', keyframes: [{ frame: 0, interpolation: 'hold', ...identityTransform, rotation: Math.PI / 4 }] },
            { boneId: 'bone-second', keyframes: [{ frame: 0, interpolation: 'hold', ...identityTransform, x: 6 }] }
        ]
    }
};
const multiRootPlan = createFolderPartRenderPlan(multiRootAsset, multiRootClip, 0);
assert.equal(multiRootPlan.status, 'ready', 'multiple root PIVOT bindings stay independent');
assert.equal(multiRootPlan.islands.length, 2);
assert.equal(multiRootPlan.islandByFolderId.get(secondFolder.id).boneDeltaMatrix.tx, 6);

const childBoneAsset = createAsset({
    bones: [
        ...asset.rigDefinition.bones,
        {
            boneId: 'bone-child',
            parentBoneId: 'bone-root',
            bindTransform: { ...identityTransform, x: 8 },
            length: 4
        }
    ]
});
assert.equal(
    createFolderPartRenderPlan(childBoneAsset, createClip(), 0).status,
    'ready',
    'unbound child Bone does not disable the bound parent RenderIsland'
);

const singularAsset = createAsset({
    bones: [{
        boneId: 'bone-root',
        parentBoneId: null,
        bindTransform: { ...identityTransform, scaleX: 0 },
        length: 8
    }]
});
const singularPlan = createFolderPartRenderPlan(singularAsset, createClip(), 0);
assert.equal(singularPlan.status, 'invalid', 'non-invertible Bind Pose rejected');
assert.equal(singularPlan.errors[0].code, 'non-invertible-bone-bind');

const bounds = new Map([['snapshot-child', { x: 9, y: -1, width: 2, height: 2 }]]);
assert.deepEqual(
    calculateFolderPartAssetBounds(asset, translatedPlan, layer => bounds.get(layer.drawingSnapshotId) || null),
    { x: 16, y: -1, width: 2, height: 2 },
    'shared bounds use final Part/Bone binding matrix'
);

class FakeContext2D {
    constructor(canvas) {
        this.canvas = canvas;
        this.operations = [];
        this.globalAlpha = 1;
        this.globalCompositeOperation = 'source-over';
    }
    save() { this.operations.push(['save']); }
    restore() { this.operations.push(['restore']); }
    translate(x, y) { this.operations.push(['translate', x, y]); }
    transform(a, b, c, d, tx, ty) { this.operations.push(['transform', a, b, c, d, tx, ty]); }
    drawImage(...args) { this.operations.push(['drawImage', ...args]); }
    putImageData(...args) { this.operations.push(['putImageData', ...args]); }
    getImageData(x, y, width, height) {
        return { data: new Uint8ClampedArray(width * height * 4), width, height };
    }
}
const fakeContexts = [];
class FakeCanvas {
    constructor() {
        this.width = 0;
        this.height = 0;
        this.context = new FakeContext2D(this);
        fakeContexts.push(this.context);
    }
    getContext(kind) { return kind === '2d' ? this.context : null; }
}
globalThis.window = { TEGAKI_CONFIG: { canvas: { width: 32, height: 32 } } };
globalThis.document = { createElement: tag => tag === 'canvas' ? new FakeCanvas() : null };
globalThis.ImageData = class ImageData {
    constructor(data, width, height) {
        this.data = data;
        this.width = width;
        this.height = height;
    }
};

const { TimelineFrameCompositor } = await import('../system/animation/timeline-frame-compositor.js');
const snapshots = new Map([['snapshot-child', {
    id: 'snapshot-child',
    width: 2,
    height: 2,
    rasterBounds: bounds.get('snapshot-child'),
    pixels: new Uint8ClampedArray(16).fill(255)
}]]);
const compositor = new TimelineFrameCompositor({
    getDrawingSnapshot(id) { return snapshots.get(id) || null; }
});
const surface = compositor._renderAsset(asset, translatedPlan);
assert.ok(fakeContexts.some(context => context.operations.some(operation => {
    return operation[0] === 'transform'
        && operation.slice(1).every((value, index) => value === [1, 0, 0, 1, 7, 0][index]);
})), 'Canvas adapter applies final shared Part/Bone matrix once');

console.log(
    'verify-bone-folder-binding: inverse Bind delta, Part composition, bounds, random seek, '
    + 'child FK, Canvas matrix OK'
);

const outputArgumentIndex = process.argv.indexOf('--write-project');
if (outputArgumentIndex >= 0) {
    const outputPath = process.argv[outputArgumentIndex + 1];
    assert.ok(outputPath, 'Project fixture output path is required');
    const { writeFile } = await import('node:fs/promises');
    const {
        ClipAssetModel,
        DrawingSnapshotModel,
        TimelineModel
    } = await import('../system/animation/animation-data-model.js');

    const bounds = { x: 112, y: 176, width: 48, height: 24 };
    const pixels = new Uint8ClampedArray(bounds.width * bounds.height * 4);
    for (let offset = 0; offset < pixels.length; offset += 4) {
        pixels[offset] = 180;
        pixels[offset + 1] = 40;
        pixels[offset + 2] = 30;
        pixels[offset + 3] = 255;
    }
    const fixtureSnapshot = new DrawingSnapshotModel({
        id: 'bone-binding-snapshot',
        ...bounds,
        rasterBounds: bounds,
        pixels
    });
    const fixtureModel = new TimelineModel({
        fps: 2,
        totalFrames: 3,
        drawingSnapshots: [fixtureSnapshot]
    });
    const fixtureFolder = fixtureModel.createClipAssetInternalLayer({
        id: 'bone-binding-folder',
        name: 'Bone Part',
        type: 'folder'
    });
    const fixtureRaster = fixtureModel.createClipAssetInternalLayer({
        id: 'bone-binding-raster',
        name: 'Rigid Red',
        type: 'raster',
        parentLayerId: fixtureFolder.id,
        drawingSnapshotId: fixtureSnapshot.id
    });
    const fixtureBoneId = 'bone-binding-root';
    const fixtureAsset = new ClipAssetModel({
        id: 'bone-binding-asset',
        name: 'Phase 6o Bone Binding',
        drawingSnapshotId: fixtureSnapshot.id,
        internalLayers: [fixtureFolder, fixtureRaster],
        rigDefinition: {
            version: 1,
            parts: [{
                partId: fixtureFolder.id,
                parentPartId: null,
                bindTransform: { ...identityTransform }
            }],
            bones: [{
                boneId: fixtureBoneId,
                parentBoneId: null,
                bindTransform: { ...identityTransform, x: 112, y: 188 },
                length: 48
            }],
            rigidBindings: [{ boneId: fixtureBoneId, partId: fixtureFolder.id }]
        }
    });
    fixtureModel.clipAssets.push(fixtureAsset);
    const fixtureLane = fixtureModel.createIndependentLane({ name: 'Bone Lane' });
    const fixtureClip = fixtureLane.addCel({
        id: 'bone-binding-clip',
        assetId: fixtureAsset.id,
        startFrame: 0,
        duration: 3,
        rigMotion: {
            version: 1,
            partTracks: [],
            boneTracks: [{
                boneId: fixtureBoneId,
                keyframes: [
                    { frame: 0, interpolation: 'hold', ...identityTransform },
                    { frame: 1, interpolation: 'hold', ...identityTransform, x: 80 },
                    { frame: 2, interpolation: 'hold', ...identityTransform, rotation: Math.PI / 2 }
                ]
            }]
        }
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
