import assert from 'node:assert/strict';
import {
    calculateFolderPartAssetBounds,
    createFolderPartRenderPlan
} from '../system/animation/folder-part-render-plan.js';

function folder(id, parentLayerId = null, extra = {}) {
    return { id, type: 'folder', parentLayerId, visible: true, opacity: 1, blendMode: 'normal', ...extra };
}

function raster(id, parentLayerId, drawingSnapshotId, extra = {}) {
    return {
        id,
        type: 'raster',
        parentLayerId,
        drawingSnapshotId,
        visible: true,
        opacity: 1,
        blendMode: 'normal',
        clippingMode: 'none',
        ...extra
    };
}

function rigDefinition(partIds) {
    return {
        version: 1,
        parts: partIds.map(partId => ({
            partId,
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
        }))
    };
}

function clipFor(partId, transform) {
    return {
        startFrame: 0,
        duration: 3,
        rigMotion: {
            version: 1,
            partTracks: [{
                partId,
                keyframes: [
                    { frame: 0, interpolation: 'hold', ...transform },
                    { frame: 2, interpolation: 'hold', ...transform }
                ]
            }]
        }
    };
}

const partFolder = folder('part-folder');
const nestedFolder = folder('nested-folder', partFolder.id);
const clipped = raster('clipped', nestedFolder.id, 'snapshot-clipped', { clippingMode: 'normal' });
const clippingBase = raster('clipping-base', nestedFolder.id, 'snapshot-base');
const outside = raster('outside', null, 'snapshot-outside');
const containedAsset = {
    id: 'contained',
    internalLayers: [partFolder, nestedFolder, clipped, clippingBase, outside],
    rigDefinition: rigDefinition([partFolder.id])
};

const identityPlan = createFolderPartRenderPlan(
    containedAsset,
    clipFor(partFolder.id, {}),
    0
);
assert.equal(identityPlan.status, 'ready');
assert.deepEqual([...identityPlan.islands[0].layerIds], [
    'part-folder',
    'nested-folder',
    'clipped',
    'clipping-base'
]);

const transforms = [
    { x: 10, y: -3 },
    { rotation: Math.PI / 2 },
    { scaleX: 2, scaleY: 0.5 },
    { x: -8, y: 6, scaleX: 1.5, scaleY: 0.75, rotation: -Math.PI / 4 }
];
for (const transform of transforms) {
    const sequential = createFolderPartRenderPlan(containedAsset, clipFor(partFolder.id, transform), 0);
    const randomSeek = createFolderPartRenderPlan(containedAsset, clipFor(partFolder.id, transform), 2);
    assert.equal(sequential.status, 'ready');
    assert.deepEqual(randomSeek.islands[0].worldMatrix, sequential.islands[0].worldMatrix);
}

const snapshotBounds = new Map([
    ['snapshot-clipped', { x: 0, y: 0, width: 2, height: 2 }],
    ['snapshot-base', { x: 1, y: 0, width: 2, height: 2 }],
    ['snapshot-outside', { x: -4, y: -2, width: 1, height: 1 }]
]);
const translatedPlan = createFolderPartRenderPlan(
    containedAsset,
    clipFor(partFolder.id, { x: 10, y: 0 }),
    0
);
const translatedBounds = calculateFolderPartAssetBounds(
    containedAsset,
    translatedPlan,
    layer => snapshotBounds.get(layer.drawingSnapshotId) || null
);
assert.deepEqual(translatedBounds, { x: -4, y: -2, width: 17, height: 4 });

const rotatedPlan = createFolderPartRenderPlan(
    containedAsset,
    clipFor(partFolder.id, { rotation: Math.PI / 2 }),
    0
);
const rotatedBounds = calculateFolderPartAssetBounds(
    containedAsset,
    rotatedPlan,
    layer => snapshotBounds.get(layer.drawingSnapshotId) || null
);
// cos(PI/2)の浮動小数誤差をfloor/ceilで外側へ丸め、端pixelを欠かさない。
assert.deepEqual(rotatedBounds, { x: -4, y: -2, width: 5, height: 5 });

const splitFolder = folder('split-part', null, { clippingMode: 'normal' });
const splitChild = raster('split-child', splitFolder.id, 'split-child-snapshot');
const splitSource = raster('split-source', null, 'split-source-snapshot');
const splitAsset = {
    id: 'split',
    internalLayers: [splitFolder, splitChild, splitSource],
    rigDefinition: rigDefinition([splitFolder.id])
};
const splitPlan = createFolderPartRenderPlan(splitAsset, clipFor(splitFolder.id, { x: 4 }), 0);
assert.equal(splitPlan.status, 'invalid');
assert.equal(splitPlan.fallbackToRaster, true);
assert.equal(splitPlan.errors[0].code, 'clipping-boundary-split');

const reversePart = folder('reverse-part');
const reverseChild = raster('reverse-child', reversePart.id, 'reverse-child-snapshot');
const reverseTarget = raster('reverse-target', null, 'reverse-target-snapshot', { clippingMode: 'normal' });
const reverseAsset = {
    id: 'reverse-split',
    internalLayers: [reverseTarget, reversePart, reverseChild],
    rigDefinition: rigDefinition([reversePart.id])
};
assert.equal(
    createFolderPartRenderPlan(reverseAsset, clipFor(reversePart.id, { x: 4 }), 0).status,
    'invalid'
);

const rasterPartAsset = {
    id: 'raster-part',
    internalLayers: [outside],
    rigDefinition: rigDefinition([outside.id])
};
const rasterPartPlan = createFolderPartRenderPlan(rasterPartAsset, clipFor(outside.id, {}), 0);
assert.equal(rasterPartPlan.status, 'ready', 'CAF root Raster is a one-layer Rig Part');
assert.deepEqual([...rasterPartPlan.islands[0].layerIds], [outside.id]);

const multipleAsset = {
    ...containedAsset,
    rigDefinition: rigDefinition([partFolder.id, nestedFolder.id])
};
const nestedPlan = createFolderPartRenderPlan(multipleAsset, null, 0);
assert.equal(nestedPlan.status, 'ready');
assert.deepEqual([...nestedPlan.islandByFolderId.get(partFolder.id).layerIds], ['part-folder']);
assert.deepEqual(
    [...nestedPlan.islandByFolderId.get(nestedFolder.id).layerIds],
    ['nested-folder', 'clipped', 'clipping-base'],
    'nested Raster belongs only to its nearest registered Folder Part'
);

const siblingA = folder('sibling-a');
const siblingARaster = raster('sibling-a-raster', siblingA.id, 'snapshot-a');
const siblingB = folder('sibling-b');
const siblingBRaster = raster('sibling-b-raster', siblingB.id, 'snapshot-b');
const siblingAsset = {
    id: 'sibling-parts',
    internalLayers: [siblingA, siblingARaster, siblingB, siblingBRaster],
    rigDefinition: rigDefinition([siblingA.id, siblingB.id])
};
const siblingClip = {
    startFrame: 0,
    duration: 1,
    rigMotion: {
        version: 1,
        partTracks: [
            {
                partId: siblingA.id,
                keyframes: [{ frame: 0, interpolation: 'hold', x: 5, y: 0, scaleX: 1, scaleY: 1, rotation: 0 }]
            },
            {
                partId: siblingB.id,
                keyframes: [{ frame: 0, interpolation: 'hold', x: -3, y: 2, scaleX: 1, scaleY: 1, rotation: 0 }]
            }
        ]
    }
};
const siblingPlan = createFolderPartRenderPlan(siblingAsset, siblingClip, 0);
assert.equal(siblingPlan.status, 'ready', 'sibling Folder Parts are independent RenderIslands');
assert.equal(siblingPlan.islands.length, 2);
assert.equal(siblingPlan.islandByLayerId.get(siblingARaster.id)?.partId, siblingA.id);
assert.equal(siblingPlan.islandByLayerId.get(siblingBRaster.id)?.partId, siblingB.id);

const legacyAsset = { ...containedAsset, rigDefinition: null };
assert.equal(createFolderPartRenderPlan(legacyAsset, null, 0).status, 'none');

// Canvas reference adapterがProject座標matrixを一度だけ受けることを固定する。
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
    clearRect(...args) { this.operations.push(['clearRect', ...args]); }
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
const snapshots = new Map([...snapshotBounds].map(([id, bounds]) => [id, {
    id,
    width: bounds.width,
    height: bounds.height,
    rasterBounds: bounds,
    pixels: new Uint8ClampedArray(bounds.width * bounds.height * 4).fill(255)
}]));
const compositor = new TimelineFrameCompositor({
    getDrawingSnapshot(id) { return snapshots.get(id) || null; }
});
const surface = compositor._renderAsset(containedAsset, translatedPlan);
assert.deepEqual(surface.bounds, translatedBounds);
assert.ok(fakeContexts.some(context => context.operations.some(operation => {
    return operation[0] === 'transform'
        && operation.slice(1).every((value, index) => value === [1, 0, 0, 1, 10, 0][index]);
})), 'Canvas adapter applies the shared Folder Part matrix once');

console.log(
    'verify-folder-part-render-plan: nested exclusive RenderIslands, contained/split clipping, '
    + 'identity/translation/rotation/scale, negative bounds, random seek, Canvas matrix OK'
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
    const { createWarpGridDeformer } = await import('../system/animation/warp-grid-deformer.js');

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
    const fixtureSnapshots = [
        solidSnapshot('fixture-red', { x: 80, y: 90, width: 28, height: 20 }, [180, 40, 30, 255]),
        solidSnapshot('fixture-mask', { x: 86, y: 94, width: 16, height: 12 }, [255, 255, 255, 255]),
        solidSnapshot('fixture-blue', { x: 190, y: 92, width: 18, height: 18 }, [30, 70, 180, 255])
    ];
    const fixtureModel = new TimelineModel({
        fps: 2,
        totalFrames: 3,
        drawingSnapshots: fixtureSnapshots
    });
    const fixtureFolder = fixtureModel.createClipAssetInternalLayer({
        id: 'fixture-part-folder',
        name: 'Part Folder',
        type: 'folder'
    });
    const fixtureClipLayer = fixtureModel.createClipAssetInternalLayer({
        id: 'fixture-clipped',
        name: 'Clipped Red',
        type: 'raster',
        parentLayerId: fixtureFolder.id,
        drawingSnapshotId: 'fixture-red',
        clippingMode: 'normal'
    });
    const fixtureMaskLayer = fixtureModel.createClipAssetInternalLayer({
        id: 'fixture-mask-layer',
        name: 'Mask',
        type: 'raster',
        parentLayerId: fixtureFolder.id,
        drawingSnapshotId: 'fixture-mask'
    });
    const fixtureOutsideLayer = fixtureModel.createClipAssetInternalLayer({
        id: 'fixture-outside',
        name: 'Outside Blue',
        type: 'raster',
        drawingSnapshotId: 'fixture-blue'
    });
    const fixtureAsset = new ClipAssetModel({
        id: 'fixture-asset',
        name: 'Phase 6k Folder Part',
        drawingSnapshotId: 'fixture-red',
        internalLayers: [fixtureFolder, fixtureClipLayer, fixtureMaskLayer, fixtureOutsideLayer],
        rigDefinition: rigDefinition([fixtureFolder.id])
    });
    fixtureModel.clipAssets.push(fixtureAsset);
    const fixtureWarp = createWarpGridDeformer({
        bindBounds: { x: 70, y: 80, width: 150, height: 40 }
    });
    fixtureWarp.keyframes = [{
        frame: 0,
        interpolation: 'hold',
        points: fixtureWarp.points
    }];
    const fixtureLane = fixtureModel.createIndependentLane({ name: 'Rig Lane' });
    const fixtureClip = fixtureLane.addCel({
        id: 'fixture-clip',
        assetId: fixtureAsset.id,
        startFrame: 0,
        duration: 3,
        transform: {
            x: 8,
            y: 4,
            scaleX: 1,
            scaleY: 1,
            rotation: 0,
            anchorX: 0.5,
            anchorY: 0.5
        },
        deformer: fixtureWarp,
        rigMotion: {
            version: 1,
            partTracks: [{
                partId: fixtureFolder.id,
                keyframes: [
                    { frame: 0, interpolation: 'linear', x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
                    { frame: 2, interpolation: 'hold', x: 60, y: 20, scaleX: 1.25, scaleY: 0.75, rotation: 0.35 }
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
