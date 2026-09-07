import assert from 'node:assert/strict';
import {
    calculateRigPartAssetBounds,
    createRigPartRenderPlan
} from '../system/animation/folder-part-render-plan.js';

const asset = {
    internalLayers: [
        { id: 'folder', type: 'folder', parentLayerId: null, visible: true },
        { id: 'child-1', type: 'raster', parentLayerId: 'folder', visible: true },
        { id: 'child-2', type: 'raster', parentLayerId: 'folder', visible: true },
        { id: 'sibling', type: 'raster', parentLayerId: null, visible: true }
    ],
    rigDefinition: null,
    meshDefinitions: []
};
const folderTrack = {
    folderLayerId: 'folder',
    pivotX: 0,
    pivotY: 0,
    keyframes: [
        { frame: 0, interpolation: 'linear', x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
        { frame: 2, interpolation: 'linear', x: 20, y: -10, scaleX: 1, scaleY: 1, rotation: 0 }
    ]
};
const clip = {
    startFrame: 10,
    duration: 4,
    folderTransformTracks: [folderTrack]
};

const plan = createRigPartRenderPlan(asset, clip, 11);
assert.equal(plan.ok, true);
assert.equal(plan.status, 'ready');
assert.equal(plan.islands.length, 1);
const island = plan.islandByFolderId.get('folder');
assert.equal(island.targetKind, 'folder-motion');
assert.deepEqual([...island.layerIds], ['folder', 'child-1', 'child-2']);
assert.equal(plan.islandByLayerId.get('child-1'), island);
assert.equal(plan.islandByLayerId.get('child-2'), island);
assert.equal(plan.islandByLayerId.has('sibling'), false);
assert.equal(island.worldMatrix.tx, 10);
assert.equal(island.worldMatrix.ty, -5);

const boundsById = new Map([
    ['child-1', { x: 0, y: 0, width: 10, height: 10 }],
    ['child-2', { x: 20, y: 0, width: 10, height: 10 }],
    ['sibling', { x: 100, y: 100, width: 10, height: 10 }]
]);
assert.deepEqual(
    calculateRigPartAssetBounds(asset, plan, layer => boundsById.get(layer.id) || null),
    { x: 10, y: -5, width: 100, height: 115 },
    'the Folder union receives one matrix while the root sibling remains outside'
);

const withLaterChild = {
    ...asset,
    internalLayers: [
        ...asset.internalLayers,
        { id: 'child-later', type: 'raster', parentLayerId: 'folder', visible: true }
    ]
};
const laterPlan = createRigPartRenderPlan(withLaterChild, clip, 11);
assert.equal(laterPlan.islandByLayerId.get('child-later')?.folderId, 'folder',
    'descendants are resolved from the current Asset hierarchy, not persisted in the key');

const layerOverlap = createRigPartRenderPlan(asset, {
    ...clip,
    layerTransformTracks: [{
        internalLayerId: 'child-2',
        pivotX: 0,
        pivotY: 0,
        keyframes: [{ frame: 1, interpolation: 'linear', x: 1, y: 0, scaleX: 1, scaleY: 1, rotation: 0 }]
    }]
}, 11);
assert.equal(layerOverlap.status, 'unsupported');
assert.equal(layerOverlap.errors.some(error => error.code === 'folder-transform-layer-motion-overlap'), true);

const meshOverlap = createRigPartRenderPlan({
    ...asset,
    meshDefinitions: [{ meshId: 'mesh', targetInternalLayerId: 'child-1' }]
}, clip, 11);
assert.equal(meshOverlap.status, 'unsupported');
assert.equal(meshOverlap.errors.some(error => error.code === 'folder-transform-mesh-overlap'), true);

console.log('Folder transform RenderIsland: subtree/late child/bounds/conflict contract passed.');
