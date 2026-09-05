/**
 * Phase 6s Stage B: Folder WARP / Part / Bone / root評価順とunsupported境界を固定検証する。
 * 公開APIなし。純粋planとCPU compositor adapterをNode fixtureで照合する。
 */
import assert from 'node:assert/strict';
import {
    calculateFolderEffectAssetBounds,
    createFolderEffectRenderPlan
} from '../system/animation/folder-part-render-plan.js';
import { createWarpGridDeformer } from '../system/animation/warp-grid-deformer.js';

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

function createWarp(xOffset = 0) {
    const deformer = createWarpGridDeformer({
        bindBounds: { x: 0, y: 0, width: 10, height: 10 }
    });
    const points = deformer.points.map(point => ({
        x: point.x + xOffset / 10,
        y: point.y
    }));
    deformer.points = points;
    deformer.keyframes = [{ frame: 0, interpolation: 'hold', points }];
    return deformer;
}

function clipWithTargets(targets, extra = {}) {
    return {
        startFrame: 0,
        duration: 3,
        folderDeformers: { version: 1, targets },
        ...extra
    };
}

const folderA = folder('folder-a');
const rasterA = raster('raster-a', folderA.id, 'snapshot-a');
const folderB = folder('folder-b');
const rasterB = raster('raster-b', folderB.id, 'snapshot-b');
const siblingAsset = {
    id: 'sibling-asset',
    internalLayers: [folderA, rasterA, folderB, rasterB],
    rigDefinition: null
};
const siblingClip = clipWithTargets([
    { folderLayerId: folderA.id, deformer: createWarp(10) },
    { folderLayerId: folderB.id, deformer: createWarp(0) }
]);
const siblingPlan = createFolderEffectRenderPlan(siblingAsset, siblingClip, 0);
assert.equal(siblingPlan.status, 'ready');
assert.equal(siblingPlan.islands.length, 2);
assert.equal(siblingPlan.islandByLayerId.get(rasterA.id)?.folderId, folderA.id);
assert.equal(siblingPlan.islandByLayerId.get(rasterB.id)?.folderId, folderB.id);
assert.deepEqual(siblingPlan.islandByFolderId.get(folderA.id).worldMatrix, {
    a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0
});

const boundsBySnapshotId = new Map([
    ['snapshot-a', { x: 0, y: 0, width: 10, height: 10 }],
    ['snapshot-b', { x: 100, y: 0, width: 10, height: 10 }]
]);
assert.deepEqual(
    calculateFolderEffectAssetBounds(
        siblingAsset,
        siblingPlan,
        layer => boundsBySnapshotId.get(layer.drawingSnapshotId) || null
    ),
    { x: 0, y: 0, width: 110, height: 10 },
    'Warped Folder A expands without changing sibling Folder B bounds'
);

const partFolder = folder('part-folder');
const targetFolder = folder('target-folder', partFolder.id, { opacity: 0.6, blendMode: 'multiply' });
const targetRaster = raster('target-raster', targetFolder.id, 'target-snapshot');
const partAsset = {
    id: 'part-asset',
    internalLayers: [partFolder, targetFolder, targetRaster],
    rigDefinition: rigDefinition([partFolder.id])
};
const partClip = clipWithTargets(
    [{ folderLayerId: targetFolder.id, deformer: createWarp(4) }],
    {
        rigMotion: {
            version: 1,
            partTracks: [{
                partId: partFolder.id,
                keyframes: [0, 2].map(frame => ({
                    frame,
                    interpolation: 'hold',
                    x: 20,
                    y: -3,
                    scaleX: 1,
                    scaleY: 1,
                    rotation: 0
                }))
            }]
        }
    }
);
const partPlan = createFolderEffectRenderPlan(partAsset, partClip, 0);
assert.equal(partPlan.status, 'ready');
assert.equal(partPlan.islands[0].partId, partFolder.id);
assert.equal(partPlan.islands[0].worldMatrix.tx, 20);
assert.equal(partPlan.islands[0].worldMatrix.ty, -3);
assert.deepEqual(
    calculateFolderEffectAssetBounds(
        partAsset,
        partPlan,
        () => ({ x: 0, y: 0, width: 10, height: 10 })
    ),
    { x: 20, y: -3, width: 14, height: 10 },
    'Folder WARP bounds are transformed by Part matrix after deformation'
);
assert.deepEqual(
    createFolderEffectRenderPlan(partAsset, partClip, 2).islands[0].worldMatrix,
    partPlan.islands[0].worldMatrix,
    'Random seek is stateless'
);

const nestedTargetClip = clipWithTargets([
    { folderLayerId: partFolder.id, deformer: createWarp() },
    { folderLayerId: targetFolder.id, deformer: createWarp() }
]);
assert.equal(
    createFolderEffectRenderPlan(partAsset, nestedTargetClip, 0).status,
    'unsupported',
    'Nested Folder WARP targets are explicit unsupported'
);

const childPartAsset = {
    ...partAsset,
    rigDefinition: rigDefinition([partFolder.id, targetFolder.id])
};
assert.equal(
    createFolderEffectRenderPlan(
        childPartAsset,
        clipWithTargets([{ folderLayerId: partFolder.id, deformer: createWarp() }]),
        0
    ).status,
    'unsupported',
    'A target containing another registered Part is explicit unsupported'
);

const splitFolder = folder('split-folder', null, { clippingMode: 'normal' });
const splitChild = raster('split-child', splitFolder.id, 'split-child-snapshot');
const splitSource = raster('split-source', null, 'split-source-snapshot');
const splitAsset = {
    id: 'split-asset',
    internalLayers: [splitFolder, splitChild, splitSource],
    rigDefinition: null
};
const splitPlan = createFolderEffectRenderPlan(
    splitAsset,
    clipWithTargets([{ folderLayerId: splitFolder.id, deformer: createWarp() }]),
    0
);
assert.equal(splitPlan.status, 'unsupported');
assert.equal(splitPlan.errors[0].code, 'clipping-boundary-split');

const legacyPlan = createFolderEffectRenderPlan(siblingAsset, { startFrame: 0, duration: 1 }, 0);
assert.equal(legacyPlan.status, 'none');
assert.equal(legacyPlan.rigRenderPlan.status, 'none');

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
    drawImage(...args) {
        this.operations.push([
            'drawImage',
            this.globalAlpha,
            this.globalCompositeOperation,
            ...args
        ]);
    }
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
globalThis.window = { TEGAKI_CONFIG: { canvas: { width: 128, height: 128 } } };
globalThis.document = { createElement: tag => tag === 'canvas' ? new FakeCanvas() : null };
globalThis.ImageData = class ImageData {
    constructor(data, width, height) {
        this.data = data;
        this.width = width;
        this.height = height;
    }
};

const { TimelineFrameCompositor } = await import('../system/animation/timeline-frame-compositor.js');
const snapshots = new Map([
    ['target-snapshot', {
        id: 'target-snapshot',
        width: 10,
        height: 10,
        rasterBounds: { x: 0, y: 0, width: 10, height: 10 },
        pixels: new Uint8ClampedArray(400).fill(255)
    }]
]);
const compositor = new TimelineFrameCompositor({
    getDrawingSnapshot(id) { return snapshots.get(id) || null; }
});
const cpuSurface = compositor._renderAsset(partAsset, partPlan);
assert.deepEqual(cpuSurface.bounds, { x: 20, y: -3, width: 14, height: 10 });
assert.ok(fakeContexts.some(context => context.operations.some(operation => {
    return operation[0] === 'transform'
        && operation.slice(1).every((value, index) => value === [1, 0, 0, 1, 20, -3][index]);
})), 'CPU adapter applies Folder WARP before the owning Part matrix once');
assert.ok(fakeContexts.some(context => context.operations.some(operation => {
    return operation[0] === 'drawImage'
        && operation[1] === 0.6
        && operation[2] === 'multiply';
})), 'Target Folder opacity and blend are recomposed after Folder WARP');

const order = [];
const rootWarp = createWarp(2);
const orderClip = clipWithTargets(
    [{ folderLayerId: folderA.id, deformer: createWarp(1) }],
    {
        id: 'order-clip',
        assetId: siblingAsset.id,
        deformer: rootWarp,
        transform: { x: 5, y: 4, scaleX: 1, scaleY: 1, rotation: 0 }
    }
);
class OrderCompositor extends TimelineFrameCompositor {
    _renderAsset(asset, renderPlan) {
        assert.equal(renderPlan.kind, 'folder-effect');
        assert.equal(renderPlan.status, 'ready');
        order.push('folder-warp-and-part');
        return { canvas: new FakeCanvas(), bounds: { x: 0, y: 0, width: 10, height: 10 } };
    }
    _deformAssetSurface(surface) {
        order.push('root-warp');
        return surface;
    }
    _drawTransformedClip() {
        order.push('root-motion');
    }
}
const orderCompositor = new OrderCompositor({
    findClipEntry(id) {
        return id === orderClip.id ? { clip: orderClip } : null;
    },
    getClipAsset(id) {
        return id === siblingAsset.id ? siblingAsset : null;
    }
});
assert.ok(orderCompositor.renderClipFrameSurface(orderClip.id, 0, {
    sourceWidth: 128,
    sourceHeight: 128
}));
assert.deepEqual(order, [
    'folder-warp-and-part',
    'root-warp',
    'root-motion'
], 'Shared export/Bake path keeps Folder WARP and Part before root WARP and root Motion');

console.log(
    'verify-folder-deformer-render-plan: sibling targets, Part/root order, bounds, random seek, '
    + 'Folder opacity/blend, CPU adapter, nested Part/target and clipping fallback OK'
);
