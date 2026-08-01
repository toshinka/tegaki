import assert from 'node:assert/strict';
import { calculateOpaqueRasterBounds } from '../system/raster-bounds.js';
import {
    evaluateRigidBones,
    updateRigBoneParent
} from '../system/animation/part-rig.js';
import { createFolderPartRenderPlan } from '../system/animation/folder-part-render-plan.js';
import { applyTransformMatrix } from '../system/transform-math.js';

const opaque = new Uint8ClampedArray(8 * 6 * 4);
opaque[(2 * 8 + 3) * 4 + 3] = 255;
opaque[(4 * 8 + 6) * 4 + 3] = 64;
assert.deepEqual(calculateOpaqueRasterBounds({
    width: 8,
    height: 6,
    rasterBounds: { x: 10, y: -4, width: 8, height: 6 },
    pixels: opaque
}), { x: 13, y: -2, width: 4, height: 3 });

const makeTransform = (x = 0, y = 0, rotation = 0) => ({
    x, y, scaleX: 1, scaleY: 1, rotation, pivotX: 0, pivotY: 0
});
const layers = [
    { id: 'body', type: 'folder', parentLayerId: null },
    { id: 'body-raster', type: 'raster', parentLayerId: 'body' },
    { id: 'arm2', type: 'folder', parentLayerId: 'body' },
    { id: 'arm2-raster', type: 'raster', parentLayerId: 'arm2' },
    { id: 'arm1', type: 'folder', parentLayerId: 'arm2' },
    { id: 'arm1-raster', type: 'raster', parentLayerId: 'arm1' },
    { id: 'hand', type: 'folder', parentLayerId: 'arm1' },
    { id: 'hand-raster', type: 'raster', parentLayerId: 'hand' }
];
const parts = ['body', 'arm2', 'arm1', 'hand'].map(partId => ({
    partId,
    parentPartId: null,
    bindTransform: makeTransform()
}));
const bones = [
    { boneId: 'body-bone', parentBoneId: null, bindTransform: makeTransform(), length: 10 },
    { boneId: 'arm2-bone', parentBoneId: 'body-bone', bindTransform: makeTransform(10, 0), length: 10 },
    { boneId: 'arm1-bone', parentBoneId: 'arm2-bone', bindTransform: makeTransform(10, 0), length: 10 },
    { boneId: 'hand-bone', parentBoneId: 'arm1-bone', bindTransform: makeTransform(10, 0), length: 10 }
];
const asset = {
    internalLayers: layers,
    rigDefinition: {
        version: 1,
        parts,
        bones,
        rigidBindings: parts.map((part, index) => ({
            partId: part.partId,
            boneId: bones[index].boneId
        }))
    }
};
const clip = {
    startFrame: 0,
    duration: 4,
    rigMotion: {
        version: 1,
        partTracks: [],
        boneTracks: [{
            boneId: 'body-bone',
            keyframes: [{
                frame: 0,
                interpolation: 'hold',
                x: 0,
                y: 0,
                scaleX: 1,
                scaleY: 1,
                rotation: Math.PI / 2
            }]
        }]
    }
};
const evaluated = evaluateRigidBones(asset, clip, 0);
assert.equal(evaluated.ok, true);
const handRoot = applyTransformMatrix(evaluated.poseByBoneId.get('hand-bone').worldMatrix, 0, 0);
assert.ok(Math.abs(handRoot.x) < 1e-8);
assert.ok(Math.abs(handRoot.y - 30) < 1e-8, 'parent rotation propagates through child and grandchild');

const plan = createFolderPartRenderPlan(asset, clip, 0);
assert.equal(plan.status, 'ready');
assert.equal(plan.islandByLayerId.get('body-raster').partId, 'body');
assert.equal(plan.islandByLayerId.get('arm2-raster').partId, 'arm2');
assert.equal(plan.islandByLayerId.get('arm1-raster').partId, 'arm1');
assert.equal(plan.islandByLayerId.get('hand-raster').partId, 'hand');
assert.equal(plan.islandByFolderId.get('body').layerIds.has('hand-raster'), false);
const handPoint = applyTransformMatrix(plan.islandByFolderId.get('hand').worldMatrix, 30, 0);
assert.ok(Math.abs(handPoint.x) < 1e-8);
assert.ok(Math.abs(handPoint.y - 30) < 1e-8, 'child RenderIsland receives FK world delta once');

const roots = {
    version: 1,
    parts: parts.slice(0, 2),
    bones: [
        { boneId: 'root', parentBoneId: null, bindTransform: makeTransform(5, 6), length: 10 },
        { boneId: 'child', parentBoneId: null, bindTransform: makeTransform(25, 16), length: 10 }
    ],
    rigidBindings: [
        { boneId: 'root', partId: 'body' },
        { boneId: 'child', partId: 'arm2' }
    ]
};
const reparented = updateRigBoneParent(roots, 'child', 'root');
assert.equal(reparented.ok, true);
assert.equal(reparented.bone.parentBoneId, 'root');
assert.equal(reparented.bone.bindTransform.x, 20);
assert.equal(reparented.bone.bindTransform.y, 10);
assert.equal(updateRigBoneParent(reparented.value, 'root', 'child').reason, 'bone-cycle');

console.log('Nested Bone FK verifier passed');
