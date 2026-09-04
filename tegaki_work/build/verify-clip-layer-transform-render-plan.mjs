import assert from 'node:assert/strict';
import {
    calculateRigPartAssetBounds,
    createRigPartRenderPlan
} from '../system/animation/folder-part-render-plan.js';

const asset = {
    internalLayers: [
        { id: 'layer-1', type: 'raster', parentLayerId: null, visible: true },
        { id: 'layer-2', type: 'raster', parentLayerId: null, visible: true }
    ],
    rigDefinition: null,
    meshDefinitions: []
};
const clip = {
    startFrame: 10,
    duration: 6,
    layerTransformTracks: [{
        internalLayerId: 'layer-2',
        pivotX: 150,
        pivotY: 120,
        keyframes: [
            { frame: 0, interpolation: 'linear', x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
            { frame: 4, interpolation: 'linear', x: 40, y: -20, scaleX: 1, scaleY: 1, rotation: 0 }
        ]
    }]
};

const plan = createRigPartRenderPlan(asset, clip, 12);
assert.equal(plan.ok, true);
assert.equal(plan.status, 'ready');
assert.equal(plan.islands.length, 1);
assert.equal(plan.islandByLayerId.has('layer-1'), false,
    'an unkeyed sibling Raster must remain outside the Layer Motion island');
const layer2Island = plan.islandByLayerId.get('layer-2');
assert.ok(layer2Island);
assert.equal(layer2Island.targetKind, 'layer-motion');
assert.equal(layer2Island.worldMatrix.tx, 20);
assert.equal(layer2Island.worldMatrix.ty, -10);

const bounds = calculateRigPartAssetBounds(
    asset,
    plan,
    layer => layer.id === 'layer-1'
        ? { x: 10, y: 10, width: 20, height: 20 }
        : { x: 100, y: 100, width: 40, height: 20 }
);
assert.deepEqual(bounds, { x: 10, y: 10, width: 150, height: 100 },
    'only the keyed Raster bounds should receive the sampled transform');

const meshConflict = createRigPartRenderPlan({
    ...asset,
    meshDefinitions: [{ id: 'mesh-2', targetInternalLayerId: 'layer-2' }]
}, clip, 12);
assert.equal(meshConflict.status, 'unsupported');
assert.equal(meshConflict.errors[0]?.code, 'layer-transform-mesh-overlap');

console.log('Clip internal Layer transform RenderIsland verifier passed.');
