import assert from 'node:assert/strict';

import { createControlMeshRenderData } from '../system/animation/control-mesh-rasterizer.js';
import {
    calculateRasterSkinPlanBounds,
    createRasterSkinDeformer,
    createRasterSkinRenderPlan,
    deformRasterSnapshotWithSkin
} from '../system/animation/raster-skin-render-plan.js';

const identity = {
    x: 0,
    y: 0,
    scaleX: 1,
    scaleY: 1,
    rotation: 0,
    pivotX: 0,
    pivotY: 0
};
const raster = {
    id: 'skin-raster',
    type: 'raster',
    drawingSnapshotId: 'skin-snapshot',
    parentLayerId: null,
    visible: true,
    opacity: 1,
    blendMode: 'normal',
    clippingMode: 'none'
};
const vertices = [
    { vertexId: 'a', x: 0, y: 0 },
    { vertexId: 'b', x: 4, y: 0 },
    { vertexId: 'c', x: 4, y: 2 },
    { vertexId: 'd', x: 0, y: 2 }
];
const asset = {
    id: 'skin-asset',
    internalLayers: [raster],
    rigDefinition: {
        version: 1,
        parts: [],
        bones: [{
            boneId: 'skin-bone',
            parentBoneId: null,
            bindTransform: { ...identity },
            length: 4
        }]
    },
    meshDefinitions: [{
        version: 1,
        meshId: 'skin-mesh',
        targetInternalLayerId: raster.id,
        vertices,
        triangles: [['a', 'b', 'c'], ['a', 'c', 'd']]
    }],
    skinBindings: [{
        version: 1,
        meshId: 'skin-mesh',
        vertexWeights: vertices.map(vertex => ({
            vertexId: vertex.vertexId,
            influences: [{ boneId: 'skin-bone', weight: 1 }]
        }))
    }]
};
const clip = {
    id: 'skin-clip',
    assetId: asset.id,
    startFrame: 0,
    duration: 1,
    rigMotion: {
        version: 1,
        partTracks: [],
        boneTracks: [{
            boneId: 'skin-bone',
            keyframes: [{ frame: 0, interpolation: 'hold', ...identity, x: 3 }]
        }]
    }
};
const plan = createRasterSkinRenderPlan(asset, clip, 0);
assert.equal(plan.status, 'ready', 'one non-clipped Raster skin plan is ready');
assert.equal(plan.resultByLayerId.get(raster.id)?.meshId, 'skin-mesh');

const sourceBounds = { x: 0, y: 0, width: 4, height: 2 };
assert.deepEqual(
    calculateRasterSkinPlanBounds(plan, () => sourceBounds),
    { x: 0, y: 0, width: 7, height: 2 },
    'skin bounds include source and translated destination'
);
const deformer = createRasterSkinDeformer(plan.meshResults[0], sourceBounds);
const pixiData = createControlMeshRenderData(deformer, sourceBounds);
assert.deepEqual(
    Array.from(pixiData.positions),
    plan.meshResults[0].vertices.flatMap(vertex => [vertex.x, vertex.y]),
    'Pixi adapter consumes the same evaluated Project vertices'
);
assert.deepEqual(Array.from(pixiData.indices), [0, 1, 2, 0, 2, 3], 'Pixi adapter keeps saved triangle order');

const pixels = new Uint8ClampedArray(4 * 2 * 4);
for (let offset = 0; offset < pixels.length; offset += 4) {
    pixels[offset] = 128;
    pixels[offset + 1] = 32;
    pixels[offset + 2] = 16;
    pixels[offset + 3] = 255;
}
const snapshot = { id: 'skin-snapshot', width: 4, height: 2, rasterBounds: sourceBounds, pixels };
const cpuResult = deformRasterSnapshotWithSkin(snapshot, plan.meshResults[0], {
    maxAxis: 64,
    maxPixels: 4096
});
assert.deepEqual(cpuResult.bounds, { x: 0, y: 0, width: 7, height: 2 });
assert.ok(cpuResult.pixels.some((value, index) => index % 4 === 3 && value > 0), 'CPU adapter produces visible pixels');

const clippedAsset = {
    ...asset,
    internalLayers: [
        { ...raster, clippingMode: 'normal', clipping: true },
        { id: 'mask-raster', type: 'raster', parentLayerId: null, visible: true, clippingMode: 'none' }
    ]
};
const clippedPlan = createRasterSkinRenderPlan(clippedAsset, clip, 0);
assert.equal(clippedPlan.status, 'unsupported', 'skinned clipping participant is explicit unsupported');
assert.equal(clippedPlan.errors[0].code, 'raster-skin-clipping-unsupported');

const folderEffectPlan = {
    status: 'ready',
    islands: [{ layerIds: new Set([raster.id]) }],
    rigRenderPlan: { status: 'none', islands: [] }
};
const effectPlan = createRasterSkinRenderPlan(asset, clip, 0, { folderEffectPlan });
assert.equal(effectPlan.status, 'unsupported', 'active Folder WARP / rigid island is explicit unsupported');
assert.equal(effectPlan.errors[0].code, 'raster-skin-folder-effect-unsupported');
assert.equal(createRasterSkinRenderPlan({ ...asset, meshDefinitions: null }, clip, 0).status, 'none');

class FakeContext2D {
    constructor(canvas) {
        this.canvas = canvas;
        this.operations = [];
        this.globalAlpha = 1;
        this.globalCompositeOperation = 'source-over';
    }
    save() { this.operations.push(['save']); }
    restore() { this.operations.push(['restore']); }
    translate(...args) { this.operations.push(['translate', ...args]); }
    transform(...args) { this.operations.push(['transform', ...args]); }
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
const compositor = new TimelineFrameCompositor({
    getDrawingSnapshot(id) { return id === snapshot.id ? snapshot : null; }
});
const surface = compositor._renderAsset(asset, null, plan);
assert.deepEqual(surface.bounds, { x: 0, y: 0, width: 7, height: 2 }, 'CPU compositor uses shared Skin bounds');
assert.ok(fakeContexts.some(context => context.operations.some(operation => operation[0] === 'putImageData')),
    'CPU compositor receives triangle-rasterized pixels');

console.log('verify-raster-skin-render-plan: shared vertices, Pixi data, CPU raster, bounds, unsupported boundaries OK');
