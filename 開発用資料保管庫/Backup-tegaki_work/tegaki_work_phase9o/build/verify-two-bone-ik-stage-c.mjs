/**
 * Phase 6t Stage C fixed fixture.
 * Exercises the Pose Bake result through the existing model, stateless FK,
 * Folder RenderIsland plan, Project round-trip, random seek, and Bake sample.
 * This is not an owner UI/pen fixture and intentionally adds no IK schema.
 */

import assert from 'node:assert/strict';

import {
    evaluateRigidBones,
    sampleBoneInstanceMotion,
    sampleRigMotionForBake,
    getRigBoneTrack
} from '../system/animation/part-rig.js';
import { createFolderPartRenderPlan } from '../system/animation/folder-part-render-plan.js';
import { solveFixedLengthTwoBoneIk } from '../system/animation/two-bone-ik.js';
import { applyTransformMatrix } from '../system/transform-math.js';

globalThis.window = globalThis.window || {};
const { ClipAssetModel, TimelineModel } = await import('../system/animation/animation-data-model.js');

const EPSILON = 1e-8;
const close = (actual, expected, label, epsilon = EPSILON) => {
    assert.ok(Math.abs(actual - expected) <= epsilon, `${label}: ${actual} !== ${expected}`);
};
const closePoint = (actual, expected, label, epsilon = EPSILON) => {
    close(actual.x, expected.x, `${label}.x`, epsilon);
    close(actual.y, expected.y, `${label}.y`, epsilon);
};
const pointAtRoot = matrix => applyTransformMatrix(matrix, 0, 0);
const matrixSignature = matrix => [
    matrix.a, matrix.b, matrix.c, matrix.d, matrix.tx, matrix.ty
];
const closeMatrix = (actual, expected, label) => {
    matrixSignature(actual).forEach((value, index) => close(value, matrixSignature(expected)[index], `${label}[${index}]`));
};

const makeTransform = (x = 0, y = 0, rotation = 0) => ({
    x,
    y,
    scaleX: 1,
    scaleY: 1,
    rotation,
    pivotX: 0,
    pivotY: 0
});

const model = new TimelineModel({ fps: 12, totalFrames: 8 });
const layers = [];
const parts = [];
const bones = [
    { boneId: 'arm2-bone', parentBoneId: null, bindTransform: makeTransform(), length: 80 },
    { boneId: 'arm1-bone', parentBoneId: 'arm2-bone', bindTransform: makeTransform(3, 0), length: 160 },
    { boneId: 'hand-bone', parentBoneId: 'arm1-bone', bindTransform: makeTransform(0, 4), length: 240 }
];
for (const [index, name] of ['ARM2', 'ARM1', 'HAND'].entries()) {
    const folder = model.createClipAssetInternalLayer({
        id: `${name.toLowerCase()}-folder`,
        name,
        type: 'folder',
        parentLayerId: null,
        visible: true,
        opacity: 1,
        blendMode: 'normal',
        clippingMode: 'none'
    });
    const raster = model.createClipAssetInternalLayer({
        id: `${name.toLowerCase()}-raster`,
        name: `${name} image`,
        type: 'raster',
        parentLayerId: folder.id,
        visible: true,
        opacity: 1,
        blendMode: 'normal',
        clippingMode: 'none'
    });
    layers.push(folder, raster);
    parts.push({
        partId: folder.id,
        parentPartId: null,
        bindTransform: makeTransform()
    });
    assert.equal(index, parts.length - 1, 'fixture folder order is stable');
}

const asset = new ClipAssetModel({
    id: 'stage-c-ik-asset',
    name: 'Stage C IK fixture',
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
});
model.clipAssets.push(asset);

const makeClip = id => model.createIndependentLane({ name: `${id} Lane` }).addCel({
    id,
    assetId: asset.id,
    startFrame: 0,
    duration: 4,
    rigMotion: { version: 1, partTracks: [], boneTracks: [] }
});
const reachableClip = makeClip('stage-c-reachable');
const clampedClip = makeClip('stage-c-clamped');
const fkClip = makeClip('stage-c-fk');

const evaluatePoints = clip => {
    const evaluated = evaluateRigidBones(asset, clip, 0);
    assert.equal(evaluated.ok, true, `${clip.id} FK evaluates`);
    return {
        evaluated,
        root: pointAtRoot(evaluated.poseByBoneId.get('arm2-bone').worldMatrix),
        joint: pointAtRoot(evaluated.poseByBoneId.get('arm1-bone').worldMatrix),
        effector: pointAtRoot(evaluated.poseByBoneId.get('hand-bone').worldMatrix)
    };
};

const applyPoseBake = (clip, target, bendSign) => {
    const before = evaluatePoints(clip);
    const solution = solveFixedLengthTwoBoneIk({
        root: before.root,
        joint: before.joint,
        effector: before.effector,
        target,
        bendSign
    });
    assert.equal(solution.ok, true, `${clip.id} solver accepts target`);
    const sampled = sampleBoneInstanceMotion(clip, 0);
    const identityMotion = { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 };
    const rootMotion = sampled.get('arm2-bone') || identityMotion;
    const jointMotion = sampled.get('arm1-bone') || identityMotion;
    assert.ok(rootMotion && jointMotion, `${clip.id} has sampled Bone defaults`);
    const rootWrite = model.setClipRigBoneKey(clip.id, 'arm2-bone', 0, {
        ...rootMotion,
        rotation: rootMotion.rotation + solution.rootRotationDelta
    }, { interpolation: 'hold' });
    assert.equal(rootWrite.ok, true, `${clip.id} root rotation key writes`);
    const jointWrite = model.setClipRigBoneKey(clip.id, 'arm1-bone', 0, {
        ...jointMotion,
        rotation: jointMotion.rotation + solution.jointRotationDelta
    }, { interpolation: 'hold' });
    assert.equal(jointWrite.ok, true, `${clip.id} joint rotation key writes`);
    return { before, solution };
};

const initialReach = evaluatePoints(reachableClip);
const reachableTarget = {
    x: initialReach.root.x + 5,
    y: initialReach.root.y + 1
};
const reachable = applyPoseBake(reachableClip, reachableTarget, 1);
const reachableAfter = evaluatePoints(reachableClip);
closePoint(reachableAfter.effector, reachable.solution.clampedTarget, 'reachable IK target');
close(
    Math.hypot(
        reachableAfter.joint.x - reachableAfter.root.x,
        reachableAfter.joint.y - reachableAfter.root.y
    ),
    reachable.solution.lengthA,
    'reachable first segment remains fixed'
);
close(
    Math.hypot(
        reachableAfter.effector.x - reachableAfter.joint.x,
        reachableAfter.effector.y - reachableAfter.joint.y
    ),
    reachable.solution.lengthB,
    'reachable second segment remains fixed'
);
assert.equal(getRigBoneTrack(reachableClip.rigMotion, 'hand-bone'), null, 'effector receives no IK key');
const reachableRootKey = getRigBoneTrack(reachableClip.rigMotion, 'arm2-bone').keyframes[0];
const reachableJointKey = getRigBoneTrack(reachableClip.rigMotion, 'arm1-bone').keyframes[0];
for (const key of [reachableRootKey, reachableJointKey]) {
    assert.equal(key.x, 0, 'IK preserves Bone translation');
    assert.equal(key.y, 0, 'IK preserves Bone translation');
    assert.equal(key.scaleX, 1, 'IK preserves Bone scaleX');
    assert.equal(key.scaleY, 1, 'IK preserves Bone scaleY');
}

const initialClamp = evaluatePoints(clampedClip);
const outerTarget = {
    x: initialClamp.root.x + 100,
    y: initialClamp.root.y
};
const clamped = applyPoseBake(clampedClip, outerTarget, 1);
const clampedAfter = evaluatePoints(clampedClip);
closePoint(clampedAfter.effector, clamped.solution.clampedTarget, 'outer unreachable target clamps');
assert.ok(clamped.solution.clampedDistance < 100, 'outer target is unreachable and clamped');
close(
    Math.hypot(
        clampedAfter.effector.x - clampedAfter.root.x,
        clampedAfter.effector.y - clampedAfter.root.y
    ),
    clamped.solution.lengthA + clamped.solution.lengthB,
    'outer clamp keeps total reach fixed'
);
for (const boneId of ['arm2-bone', 'arm1-bone', 'hand-bone']) {
    const matrix = evaluateRigidBones(asset, clampedClip, 0).poseByBoneId.get(boneId).worldMatrix;
    close(Math.hypot(matrix.a, matrix.b), 1, `${boneId} image scaleX remains one`);
    close(Math.hypot(matrix.c, matrix.d), 1, `${boneId} image scaleY remains one`);
}

// FK mode remains a single-parent rotation path and does not synthesize child keys.
assert.equal(model.setClipRigBoneKey(fkClip.id, 'arm2-bone', 0, {
    x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: Math.PI / 2
}, { interpolation: 'hold' }).ok, true);
const fkAfter = evaluatePoints(fkClip);
assert.equal(getRigBoneTrack(fkClip.rigMotion, 'arm1-bone'), null, 'FK parent rotation adds no child key');
assert.ok(fkAfter.effector.y > 0, 'FK parent rotation propagates to child and effector');

// Stateless random seek and Pose Bake sample use the same evaluator.
const expectedReach = evaluateRigidBones(asset, reachableClip, 0);
for (const frame of [3, 1, 2, 0, 3, 0]) {
    const seek = evaluateRigidBones(asset, reachableClip, frame);
    assert.equal(seek.ok, true, `random seek F${frame + 1} evaluates`);
    if (frame === 0) {
        closeMatrix(
            seek.poseByBoneId.get('hand-bone').worldMatrix,
            expectedReach.poseByBoneId.get('hand-bone').worldMatrix,
            'random seek returns same Pose'
        );
    }
}

const bakedMotion = sampleRigMotionForBake(reachableClip, 0);
assert.equal(bakedMotion.boneTracks.length, 2, 'Pose Bake retains only existing root/joint Bone tracks');
const bakedClip = {
    startFrame: 0,
    duration: 1,
    rigMotion: bakedMotion
};
const baked = evaluateRigidBones(asset, bakedClip, 0);
assert.equal(baked.ok, true, 'sampled Pose Bake evaluates through FK');
closeMatrix(
    baked.poseByBoneId.get('hand-bone').worldMatrix,
    expectedReach.poseByBoneId.get('hand-bone').worldMatrix,
    'Pose Bake sample matches source frame'
);

const restored = new TimelineModel(JSON.parse(JSON.stringify(model.serialize())));
const restoredReach = restored.findClipEntry(reachableClip.id)?.clip;
const restoredClamp = restored.findClipEntry(clampedClip.id)?.clip;
assert.ok(restoredReach && restoredClamp, 'Project round-trip restores IK clips');
assert.deepEqual(restoredReach.rigMotion, reachableClip.rigMotion, 'reachable Bone Pose keys round-trip');
assert.deepEqual(restoredClamp.rigMotion, clampedClip.rigMotion, 'clamped Bone Pose keys round-trip');
const restoredEval = evaluateRigidBones(restored.getClipAsset(asset.id), restoredReach, 0);
assert.equal(restoredEval.ok, true, 'restored IK Pose evaluates');
closeMatrix(
    restoredEval.poseByBoneId.get('hand-bone').worldMatrix,
    expectedReach.poseByBoneId.get('hand-bone').worldMatrix,
    'restored Pose matches source'
);

const renderPlan = createFolderPartRenderPlan(asset, reachableClip, 0);
assert.equal(renderPlan.status, 'ready', 'Folder RenderIsland plan remains ready after IK Pose Bake');
for (const folder of ['arm2-folder', 'arm1-folder', 'hand-folder']) {
    const island = renderPlan.islandByFolderId.get(folder);
    assert.ok(island, `${folder} RenderIsland remains addressable`);
    assert.equal(island.layerIds.has(folder.replace('-folder', '-raster')), true);
    close(Math.hypot(island.worldMatrix.a, island.worldMatrix.b), 1, `${folder} island scaleX remains one`);
    close(Math.hypot(island.worldMatrix.c, island.worldMatrix.d), 1, `${folder} island scaleY remains one`);
}

console.log(
    'verify-two-bone-ik-stage-c: reachable/clamped Pose Bake, fixed lengths, FK, random seek, '
    + 'Project round-trip, Folder RenderPlan, and Bake sample OK'
);
