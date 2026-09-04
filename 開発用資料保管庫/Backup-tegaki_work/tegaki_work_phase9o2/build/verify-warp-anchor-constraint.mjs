import assert from 'node:assert/strict';
import {
    evaluateRigidBones,
    normalizeRigDefinition,
    registerWarpAnchorConstraint,
    removeWarpAnchorConstraint,
    remapRigDefinition,
    validateRigDefinition
} from '../system/animation/part-rig.js';
import { sampleClipBakeState } from '../system/animation/clip-bake-sampler.js';
import { createRectGridTopology } from '../system/animation/warp-grid-topology.js';
import { createRectControlMeshDeformer } from '../system/animation/control-mesh-deformer.js';
import { mapWarpBindPointToPose } from '../system/animation/warp-triangle-point-map.js';

globalThis.window = globalThis.window || {};
const { ClipAssetModel, TimelineModel } = await import('../system/animation/animation-data-model.js');

const layers = [{ id: 'arm-folder', type: 'folder', parentLayerId: null }];
const bindBounds = { x: 0, y: 0, width: 100, height: 100 };
const grid = createRectGridTopology({ columns: 4, rows: 4 });
const movedGridPoints = grid.points.map(point => ({ x: point.x + 0.2, y: point.y }));

const makeDefinition = (bindPoint = { x: 50, y: 50 }) => normalizeRigDefinition({
    version: 1,
    parts: [{
        partId: 'arm-folder',
        parentPartId: null,
        bindTransform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, pivotX: 0, pivotY: 0 }
    }],
    bones: [
        {
            boneId: 'arm-root',
            parentBoneId: null,
            bindTransform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, pivotX: 0, pivotY: 0 },
            length: 50
        },
        {
            boneId: 'hand',
            parentBoneId: 'arm-root',
            bindTransform: { x: 50, y: 50, scaleX: 1, scaleY: 1, rotation: 0, pivotX: 0, pivotY: 0 },
            length: 20
        },
        {
            boneId: 'thumb',
            parentBoneId: 'hand',
            bindTransform: { x: 20, y: 0, scaleX: 1, scaleY: 1, rotation: 0, pivotX: 0, pivotY: 0 },
            length: 10
        },
        {
            boneId: 'elbow-sibling',
            parentBoneId: 'arm-root',
            bindTransform: { x: 10, y: 0, scaleX: 1, scaleY: 1, rotation: 0, pivotX: 0, pivotY: 0 },
            length: 10
        }
    ],
    rigidBindings: [{ boneId: 'arm-root', partId: 'arm-folder' }],
    warpAnchorConstraints: [{
        sourceFolderLayerId: 'arm-folder',
        targetBoneId: 'hand',
        bindPoint,
        enabled: true
    }]
});

const makeGridClip = () => ({
    id: 'grid-clip',
    startFrame: 0,
    duration: 1,
    rigMotion: null,
    folderDeformers: {
        version: 1,
        targets: [{
            folderLayerId: 'arm-folder',
            deformer: {
                type: 'warp-grid',
                version: 1,
                columns: 4,
                rows: 4,
                bindBounds,
                bindPoints: grid.points,
                points: movedGridPoints,
                keyframes: []
            }
        }]
    }
});

const asset = { rigDefinition: makeDefinition(), internalLayers: layers };
const validation = validateRigDefinition(asset.rigDefinition, layers);
assert.equal(validation.ok, true, 'valid direct-child anchor definition');

const dormant = evaluateRigidBones(asset, { id: 'no-warp', startFrame: 0, duration: 1 }, 0);
assert.equal(dormant.ok, true, 'missing Folder WARP keeps FK valid');
assert.equal(dormant.poseByBoneId.get('hand').worldMatrix.tx, 50);
assert.equal(dormant.anchorDiagnostics[0].code, 'warp-anchor-dormant');

const gridPose = evaluateRigidBones(asset, makeGridClip(), 0);
assert.equal(gridPose.ok, true, 'fixed GRID anchor evaluates');
assert.equal(gridPose.poseByBoneId.get('arm-root').worldMatrix.tx, 0, 'source Bone unchanged');
assert.ok(Math.abs(gridPose.poseByBoneId.get('hand').worldMatrix.tx - 70) < 1e-8, 'direct child follows deformed anchor');
assert.ok(Math.abs(gridPose.poseByBoneId.get('hand').worldMatrix.ty - 50) < 1e-8, 'direct child keeps Y');
assert.ok(Math.abs(gridPose.poseByBoneId.get('thumb').worldMatrix.tx - 90) < 1e-8, 'descendant inherits once');
assert.ok(Math.abs(gridPose.poseByBoneId.get('elbow-sibling').worldMatrix.tx - 10) < 1e-8, 'sibling remains unchanged');
assert.ok(Math.abs(gridPose.anchorDiagnostics.find(item => item.code === 'warp-anchor-applied')?.x - 20) < 1e-8);

const placedGridClip = makeGridClip();
placedGridClip.folderDeformers.targets[0].deformer.keyframes = [{
    frame: 0,
    interpolation: 'hold',
    points: movedGridPoints,
    placement: { x: 12, y: -7, scale: 2, rotation: Math.PI / 2 }
}];
const placedGridPose = evaluateRigidBones(asset, placedGridClip, 0);
assert.ok(Math.abs(placedGridPose.poseByBoneId.get('hand').worldMatrix.tx - 50) < 1e-8, 'GRID placement keeps X');
assert.ok(Math.abs(placedGridPose.poseByBoneId.get('hand').worldMatrix.ty - 90) < 1e-8, 'GRID placement transforms delta');

const control = createRectControlMeshDeformer({ columns: 2, rows: 2, bindBounds });
const movedControlPoints = control.points.map(point => ({ x: point.x + 0.1, y: point.y }));
const controlClip = {
    id: 'control-clip',
    startFrame: 0,
    duration: 1,
    rigMotion: null,
    folderDeformers: {
        version: 1,
        targets: [{
            folderLayerId: 'arm-folder',
            deformer: { ...control, points: movedControlPoints, keyframes: [] }
        }]
    }
};
const controlPose = evaluateRigidBones(asset, controlClip, 0);
assert.equal(controlPose.ok, true, 'Control Mesh anchor evaluates');
assert.ok(Math.abs(controlPose.poseByBoneId.get('hand').worldMatrix.tx - 60) < 1e-8);

const placedControlClip = {
    ...controlClip,
    folderDeformers: {
        ...controlClip.folderDeformers,
        targets: [{
            folderLayerId: 'arm-folder',
            deformer: {
                ...control,
                points: movedControlPoints,
                keyframes: [{
                    frame: 0,
                    interpolation: 'hold',
                    points: movedControlPoints,
                    placement: { x: -4, y: 9, scale: 1.5, rotation: Math.PI / 2 }
                }]
            }
        }]
    }
};
const placedControlPose = evaluateRigidBones(asset, placedControlClip, 0);
assert.ok(Math.abs(placedControlPose.poseByBoneId.get('hand').worldMatrix.tx - 50) < 1e-8, 'Control Mesh placement keeps X');
assert.ok(Math.abs(placedControlPose.poseByBoneId.get('hand').worldMatrix.ty - 65) < 1e-8, 'Control Mesh placement transforms delta');

const degenerateControlClip = {
    ...controlClip,
    folderDeformers: {
        ...controlClip.folderDeformers,
        targets: [{
            folderLayerId: 'arm-folder',
            deformer: {
                ...control,
                bindPoints: control.bindPoints.map(() => ({ x: 0.5, y: 0.5 })),
                points: control.points.map(() => ({ x: 0.5, y: 0.5 }))
            }
        }]
    }
};
const degenerateBefore = JSON.stringify(degenerateControlClip.folderDeformers);
const degeneratePose = evaluateRigidBones(asset, degenerateControlClip, 0);
assert.equal(degeneratePose.ok, true, 'degenerate Control Mesh keeps FK valid');
assert.equal(degeneratePose.poseByBoneId.get('hand').worldMatrix.tx, 50);
assert.equal(degeneratePose.anchorDiagnostics[0].code, 'warp-anchor-dormant');
assert.ok(Number.isFinite(degeneratePose.poseByBoneId.get('hand').worldMatrix.tx));
assert.equal(JSON.stringify(degenerateControlClip.folderDeformers), degenerateBefore, 'invalid topology does not mutate Project data');

const staleAsset = { rigDefinition: makeDefinition({ x: 200, y: 200 }), internalLayers: layers };
const stalePose = evaluateRigidBones(staleAsset, makeGridClip(), 0);
assert.equal(stalePose.ok, true, 'outside anchor keeps base FK valid');
assert.equal(stalePose.poseByBoneId.get('hand').worldMatrix.tx, 50);
assert.equal(stalePose.anchorDiagnostics.find(item => item.code === 'warp-anchor-stale')?.reason, 'outside');

const insideBoundsOutsideTriangle = mapWarpBindPointToPose({
    point: { x: 90, y: 90 },
    bindBounds: { x: 0, y: 0, width: 100, height: 100 },
    bindPoints: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }],
    points: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }],
    triangles: [[0, 1, 2]]
});
assert.equal(insideBoundsOutsideTriangle.ok, false, 'triangle outside is rejected even inside rectangular bounds');
assert.equal(insideBoundsOutsideTriangle.reason, 'outside');

const duplicate = registerWarpAnchorConstraint(asset.rigDefinition, {
    sourceFolderLayerId: 'arm-folder',
    targetBoneId: 'hand',
    bindPoint: { x: 50, y: 50 }
});
assert.equal(duplicate.ok, false);
assert.equal(duplicate.reason, 'warp-anchor-constraint-duplicate');

const removed = removeWarpAnchorConstraint(asset.rigDefinition, 'arm-folder', 'hand');
assert.equal(removed.ok, true);
assert.equal(removed.changed, true);
assert.equal(removed.value.warpAnchorConstraints, undefined);

const remapped = remapRigDefinition(asset.rigDefinition, new Map([
    ['arm-folder', 'arm-folder-copy'],
    ['arm-root', 'arm-root-copy'],
    ['hand', 'hand-copy']
]));
assert.equal(remapped.warpAnchorConstraints[0].sourceFolderLayerId, 'arm-folder-copy');
assert.equal(remapped.warpAnchorConstraints[0].targetBoneId, 'hand-copy');
assert.equal(remapped.rigidBindings[0].partId, 'arm-folder-copy');
assert.equal(remapped.rigidBindings[0].boneId, 'arm-root-copy');

const invalidParent = makeDefinition();
invalidParent.bones[1].parentBoneId = null;
const invalidValidation = validateRigDefinition(invalidParent, layers);
assert.equal(invalidValidation.ok, false);
assert.ok(invalidValidation.errors.some(error => error.code === 'warp-anchor-target-not-direct-child'));

const invalidEntry = makeDefinition();
invalidEntry.warpAnchorConstraints = [null];
const invalidEntryValidation = validateRigDefinition(invalidEntry, layers);
assert.equal(invalidEntryValidation.ok, false);
assert.ok(invalidEntryValidation.errors.some(error => error.code === 'warp-anchor-constraint-invalid'));

const invalidEnabled = makeDefinition();
invalidEnabled.warpAnchorConstraints[0].enabled = 'false';
const invalidEnabledValidation = validateRigDefinition(invalidEnabled, layers);
assert.equal(invalidEnabledValidation.ok, false);
assert.ok(invalidEnabledValidation.errors.some(error => error.code === 'warp-anchor-enabled-invalid'));

const multiple = makeDefinition();
multiple.warpAnchorConstraints.push({
    sourceFolderLayerId: 'arm-folder',
    targetBoneId: 'elbow-sibling',
    bindPoint: { x: 50, y: 50 },
    enabled: true
});
const multipleValidation = validateRigDefinition(multiple, layers);
assert.equal(multipleValidation.ok, false);
assert.ok(multipleValidation.errors.some(error => error.code === 'warp-anchor-multiple-unsupported'));

const nestedPartLayers = [...layers, {
    id: 'nested-part-folder',
    type: 'folder',
    parentLayerId: 'arm-folder'
}];
const nestedPart = makeDefinition();
nestedPart.parts.push({
    partId: 'nested-part-folder',
    parentPartId: 'arm-folder',
    bindTransform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, pivotX: 0, pivotY: 0 }
});
nestedPart.rigidBindings.push({ boneId: 'hand', partId: 'nested-part-folder' });
const nestedPartValidation = validateRigDefinition(nestedPart, nestedPartLayers);
assert.equal(nestedPartValidation.ok, false);
assert.ok(nestedPartValidation.errors.some(error => error.code === 'warp-anchor-source-subtree-part-unsupported'));

const nestedWarpAsset = {
    rigDefinition: makeDefinition(),
    internalLayers: [...layers, {
        id: 'nested-warp-folder',
        type: 'folder',
        parentLayerId: 'arm-folder'
    }]
};
const nestedWarpClip = makeGridClip();
nestedWarpClip.folderDeformers.targets.push({
    folderLayerId: 'nested-warp-folder',
    deformer: nestedWarpClip.folderDeformers.targets[0].deformer
});
const nestedWarpPose = evaluateRigidBones(nestedWarpAsset, nestedWarpClip, 0);
assert.equal(nestedWarpPose.ok, true);
assert.equal(nestedWarpPose.poseByBoneId.get('hand').worldMatrix.tx, 50);
assert.equal(
    nestedWarpPose.anchorDiagnostics[0].code,
    'warp-anchor-subtree-warp-unsupported'
);

const roundTripAsset = new ClipAssetModel({
    id: 'anchor-roundtrip',
    name: 'Anchor roundtrip',
    internalLayers: layers,
    rigDefinition: asset.rigDefinition
});
const restoredAsset = new ClipAssetModel(JSON.parse(JSON.stringify(roundTripAsset.serialize())));
assert.deepEqual(restoredAsset.rigDefinition, asset.rigDefinition, 'anchor RigDefinition round-trips');

const roundTripModel = new TimelineModel({ clipAssets: [roundTripAsset] });
const roundTripLane = roundTripModel.createIndependentLane();
const roundTripClip = roundTripLane.addCel({
    assetId: roundTripAsset.id,
    startFrame: 0,
    duration: 1,
    folderDeformers: makeGridClip().folderDeformers
});
const restoredModel = new TimelineModel(JSON.parse(JSON.stringify(roundTripModel.serialize())));
assert.deepEqual(
    restoredModel.getClipAsset(roundTripAsset.id)?.rigDefinition,
    asset.rigDefinition,
    'Project reload preserves anchor RigDefinition'
);
assert.deepEqual(
    restoredModel.getClipById(roundTripClip.id)?.folderDeformers,
    roundTripClip.folderDeformers,
    'Project reload preserves Folder WARP pose'
);
const originalRoundTripMatrix = evaluateRigidBones(
    roundTripAsset,
    roundTripClip,
    0
).poseByBoneId.get('hand').worldMatrix;
const restoredRoundTripMatrix = evaluateRigidBones(
    restoredModel.getClipAsset(roundTripAsset.id),
    restoredModel.getClipById(roundTripClip.id),
    0
).poseByBoneId.get('hand').worldMatrix;
assert.deepEqual(restoredRoundTripMatrix, originalRoundTripMatrix, 'Project reload preserves anchor matrix');

const keyedClip = makeGridClip();
keyedClip.id = 'keyed-grid-clip';
keyedClip.duration = 3;
keyedClip.folderDeformers.targets[0].deformer.keyframes = [
    { frame: 0, interpolation: 'hold', points: grid.points },
    { frame: 2, interpolation: 'hold', points: movedGridPoints }
];
const seekMatrices = [2, 0, 1, 2].map(frame => (
    evaluateRigidBones(asset, keyedClip, frame).poseByBoneId.get('hand').worldMatrix
));
assert.deepEqual(seekMatrices[0], seekMatrices[3], 'random seek is stateless');
const bakedState = sampleClipBakeState(keyedClip, 2);
const bakedClip = { ...keyedClip, startFrame: 0, duration: 1, ...bakedState };
const sourceMatrix = evaluateRigidBones(asset, keyedClip, 2).poseByBoneId.get('hand').worldMatrix;
const bakedMatrix = evaluateRigidBones(asset, bakedClip, 0).poseByBoneId.get('hand').worldMatrix;
assert.deepEqual(bakedMatrix, sourceMatrix, 'structured bake preserves anchor matrix');

console.log('verify-warp-anchor-constraint: ok');
