import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
    calculateFolderEffectAssetBounds,
    createFolderEffectRenderPlan
} from '../system/animation/folder-part-render-plan.js';
import { createWarpGridDeformer } from '../system/animation/warp-grid-deformer.js';

function raster(id, parentLayerId = null, extra = {}) {
    return {
        id,
        type: 'raster',
        parentLayerId,
        visible: true,
        opacity: 1,
        blendMode: 'normal',
        clippingMode: 'none',
        ...extra
    };
}

function createWarp(bindBounds, xOffset = 0) {
    const deformer = createWarpGridDeformer({ bindBounds });
    const points = deformer.points.map(point => ({ x: point.x + xOffset, y: point.y }));
    return {
        ...deformer,
        keyframes: [
            { frame: 0, interpolation: 'hold', points },
            { frame: 3, interpolation: 'hold', points }
        ]
    };
}

const asset = {
    id: 'asset-layer-warp',
    internalLayers: [
        raster('layer-1'),
        raster('layer-2')
    ],
    rigDefinition: null,
    meshDefinitions: []
};
const clip = {
    startFrame: 10,
    duration: 4,
    layerTransformTracks: [{
        internalLayerId: 'layer-2',
        pivotX: 0,
        pivotY: 0,
        keyframes: [
            { frame: 0, interpolation: 'hold', x: 20, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
            { frame: 3, interpolation: 'hold', x: 20, y: 0, scaleX: 1, scaleY: 1, rotation: 0 }
        ]
    }],
    layerDeformers: {
        version: 1,
        targets: [{
            internalLayerId: 'layer-2',
            deformer: createWarp({ x: 100, y: 100, width: 40, height: 20 }, 0.25)
        }]
    }
};

const plan = createFolderEffectRenderPlan(asset, clip, 10);
assert.equal(plan.status, 'ready');
assert.equal(plan.layerEffects.length, 1);
assert.equal(plan.layerEffectByLayerId.get('layer-2')?.sampledDeformer.type, 'warp-grid');
assert.equal(plan.rigRenderPlan.islandByLayerId.get('layer-2')?.targetKind, 'layer-motion');
assert.equal(plan.rigRenderPlan.islandByLayerId.get('layer-2')?.worldMatrix.tx, 20);

const bounds = calculateFolderEffectAssetBounds(
    asset,
    plan,
    layer => layer.id === 'layer-1'
        ? { x: 10, y: 10, width: 20, height: 20 }
        : { x: 100, y: 100, width: 40, height: 20 }
);
assert.deepEqual(
    bounds,
    { x: 10, y: 10, width: 160, height: 110 },
    'Layer WARP expands the Raster before the Layer Motion matrix is applied'
);

const meshConflict = createFolderEffectRenderPlan({
    ...asset,
    meshDefinitions: [{ meshId: 'mesh-layer-2', targetInternalLayerId: 'layer-2' }]
}, { ...clip, layerTransformTracks: [] }, 10);
assert.equal(meshConflict.status, 'unsupported');
assert.equal(meshConflict.errors[0]?.code, 'layer-deformer-mesh-overlap');

const partFolder = { id: 'part-folder', type: 'folder', parentLayerId: null, visible: true };
const rigConflict = createFolderEffectRenderPlan({
    ...asset,
    internalLayers: [partFolder, raster('layer-2', partFolder.id)],
    rigDefinition: {
        version: 1,
        parts: [{
            partId: partFolder.id,
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
    }
}, {
    ...clip,
    layerTransformTracks: []
}, 10);
assert.equal(rigConflict.status, 'unsupported');
assert.equal(rigConflict.errors[0]?.code, 'layer-deformer-rig-overlap');

const clippingOwner = raster('clip-owner', null, { clippingMode: 'normal' });
const clippingSource = raster('clip-source');
const clippingConflict = createFolderEffectRenderPlan({
    ...asset,
    internalLayers: [clippingOwner, clippingSource]
}, {
    ...clip,
    layerTransformTracks: [],
    layerDeformers: {
        version: 1,
        targets: [{
            internalLayerId: clippingSource.id,
            deformer: createWarp({ x: 0, y: 0, width: 20, height: 20 })
        }]
    }
}, 10);
assert.equal(clippingConflict.status, 'unsupported');
assert.equal(clippingConflict.errors[0]?.code, 'layer-deformer-clipping-overlap');

const clippingOwnerWithoutSource = createFolderEffectRenderPlan({
    ...asset,
    internalLayers: [clippingOwner]
}, {
    ...clip,
    layerTransformTracks: [],
    layerDeformers: {
        version: 1,
        targets: [{
            internalLayerId: clippingOwner.id,
            deformer: createWarp({ x: 0, y: 0, width: 20, height: 20 })
        }]
    }
}, 10);
assert.equal(clippingOwnerWithoutSource.status, 'unsupported');
assert.equal(clippingOwnerWithoutSource.errors[0]?.code, 'layer-deformer-clipping-overlap');

const folderWarp = createWarp({ x: 100, y: 100, width: 40, height: 20 });
const nestedPlan = createFolderEffectRenderPlan({
    ...asset,
    internalLayers: [partFolder, raster('layer-2', partFolder.id)]
}, {
    ...clip,
    folderDeformers: {
        version: 1,
        targets: [{ folderLayerId: partFolder.id, deformer: folderWarp }]
    }
}, 10);
assert.equal(nestedPlan.status, 'ready');
assert.equal(nestedPlan.layerEffects.length, 1);
assert.equal(nestedPlan.islands.length, 1);
assert.equal(nestedPlan.islandByFolderId.get(partFolder.id)?.sampledDeformer.type, 'warp-grid');

const compositorSource = await readFile(
    new URL('../system/animation/timeline-frame-compositor.js', import.meta.url),
    'utf8'
);
const renderGroupStart = compositorSource.indexOf('    _renderAssetLayerGroup(');
const renderGroupEnd = compositorSource.indexOf('    _renderFolderEffectSurface(', renderGroupStart);
const renderGroup = compositorSource.slice(renderGroupStart, renderGroupEnd);
assert.ok(renderGroup.indexOf('if (layerEffect)') >= 0);
assert.ok(
    renderGroup.indexOf('if (layerEffect)') < renderGroup.indexOf('if (renderIsland?.worldMatrix)'),
    'CPU compositor applies individual Layer WARP before Layer Motion / Part affine'
);
assert.match(renderGroup, /layerEffect\.sampledDeformer/u);
assert.match(compositorSource, /_assertLayerDeformerPlanReady\(renderPlan, entry\.clip, asset\.id\)/u);
assert.match(compositorSource, /_createFolderEffectChildRenderPlan/u);

console.log('verify-clip-layer-deformer-render-plan: order, bounds, Folder/root coexistence, and conflict gates OK');
