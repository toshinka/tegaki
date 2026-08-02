/**
 * Phase 6t Stage A verifier.
 * Covers pure fixed-length 2-Bone IK math and its rotation-delta contract with
 * the existing stateless Bone FK evaluator. It does not add or exercise UI,
 * persistence fields, target tracks, stretch, Mesh, or constraints.
 */

import assert from 'node:assert/strict';

import {
    solveFixedLengthTwoBoneIk,
    normalizeAngle
} from '../system/animation/two-bone-ik.js';
import { evaluateRigidBones } from '../system/animation/part-rig.js';
import { applyTransformMatrix } from '../system/transform-math.js';

const EPSILON = 1e-8;
const close = (actual, expected, label, epsilon = EPSILON) => {
    assert.ok(Math.abs(actual - expected) <= epsilon, `${label}: ${actual} !== ${expected}`);
};
const closePoint = (actual, expected, label, epsilon = EPSILON) => {
    close(actual.x, expected.x, `${label}.x`, epsilon);
    close(actual.y, expected.y, `${label}.y`, epsilon);
};

const baseChain = {
    root: { x: 0, y: 0 },
    joint: { x: 3, y: 0 },
    effector: { x: 3, y: 4 },
    target: { x: 7, y: 0 }
};

const positive = solveFixedLengthTwoBoneIk({ ...baseChain, bendSign: 1 });
assert.equal(positive.ok, true, 'positive bend solves');
close(positive.lengthA, 3, 'first segment length');
close(positive.lengthB, 4, 'second segment length');
close(positive.clampedDistance, 7, 'fully reachable target distance');
closePoint(positive.clampedTarget, baseChain.target, 'reachable target');
close(positive.rootRotationDelta, 0, 'root delta reaches straight target');
close(positive.jointRotationDelta, -Math.PI / 2, 'joint local delta cancels the current bend');

const negative = solveFixedLengthTwoBoneIk({
    ...baseChain,
    target: { x: 3, y: 4 },
    bendSign: -1
});
assert.equal(negative.ok, true, 'negative bend solves');
closePoint(negative.clampedTarget, { x: 3, y: 4 }, 'negative reachable target');
assert.ok(negative.desiredRootAngle > 1.5, 'negative bend chooses the opposite root side');

const repeatTargets = [
    { x: 2, y: 1 },
    { x: -4, y: 3 },
    { x: 5, y: -2 }
];
repeatTargets.forEach(target => {
    const first = solveFixedLengthTwoBoneIk({ ...baseChain, target, bendSign: 1 });
    const second = solveFixedLengthTwoBoneIk({ ...baseChain, target, bendSign: 1 });
    assert.deepEqual(second, first, 'same input remains deterministic');
});

const outerClamp = solveFixedLengthTwoBoneIk({
    ...baseChain,
    target: { x: 20, y: 0 },
    bendSign: 1
});
assert.equal(outerClamp.ok, true, 'outer unreachable target clamps');
close(outerClamp.clampedDistance, 7, 'outer clamp uses fixed maximum reach');
closePoint(outerClamp.clampedTarget, { x: 7, y: 0 }, 'outer clamped target');

const innerClamp = solveFixedLengthTwoBoneIk({
    root: { x: 0, y: 0 },
    joint: { x: 5, y: 0 },
    effector: { x: 1, y: 0 },
    target: { x: 0.5, y: 0 },
    bendSign: 1
});
assert.equal(innerClamp.ok, true, 'inner unreachable target clamps');
close(innerClamp.minimumReach, 1, 'minimum reach');
close(innerClamp.clampedDistance, 1, 'inner clamp uses fixed minimum reach');
closePoint(innerClamp.clampedTarget, { x: 1, y: 0 }, 'inner clamped target');

assert.equal(
    solveFixedLengthTwoBoneIk({ ...baseChain, bendSign: 0 }).reason,
    'invalid-bend-sign',
    'bend sign is explicit'
);
assert.equal(
    solveFixedLengthTwoBoneIk({
        root: { x: 0, y: 0 },
        joint: { x: 0, y: 0 },
        effector: { x: 1, y: 0 },
        target: { x: 2, y: 0 },
        bendSign: 1
    }).reason,
    'zero-length-segment',
    'zero-length chain is rejected'
);
assert.equal(
    solveFixedLengthTwoBoneIk({ ...baseChain, target: { x: 0, y: 0 }, bendSign: 1 }).reason,
    'target-at-root',
    'target at root is rejected'
);
assert.equal(
    solveFixedLengthTwoBoneIk({ ...baseChain, target: { x: Number.NaN, y: 0 }, bendSign: 1 }).reason,
    'non-finite-point',
    'non-finite target is rejected'
);
assert.ok(Math.abs(normalizeAngle(Math.PI * 3) - Math.PI) <= EPSILON, 'angle normalization wraps positive values');
assert.ok(Math.abs(normalizeAngle(-Math.PI * 3) + Math.PI) <= EPSILON, 'angle normalization wraps negative values');
const hugeNormalizedAngle = normalizeAngle(1e308);
assert.ok(Number.isFinite(hugeNormalizedAngle), 'huge finite angle normalizes in constant time');
assert.ok(
    hugeNormalizedAngle >= -Math.PI && hugeNormalizedAngle <= Math.PI,
    'huge finite angle stays in the normalized range'
);
assert.equal(normalizeAngle(Number.NaN), null, 'non-finite angle normalization is rejected');

const frozenInput = Object.freeze({
    root: Object.freeze({ x: 1, y: 2 }),
    joint: Object.freeze({ x: 4, y: 2 }),
    effector: Object.freeze({ x: 4, y: 6 }),
    target: Object.freeze({ x: 7, y: 4 }),
    bendSign: 1
});
const frozenSnapshot = structuredClone(frozenInput);
assert.equal(solveFixedLengthTwoBoneIk(frozenInput).ok, true, 'frozen input solves without mutation');
assert.deepEqual(frozenInput, frozenSnapshot, 'solver leaves every input object unchanged');

const makeTransform = (x = 0, y = 0, rotation = 0) => ({
    x,
    y,
    scaleX: 1,
    scaleY: 1,
    rotation,
    pivotX: 0,
    pivotY: 0
});
const bones = [
    { boneId: 'base', parentBoneId: null, bindTransform: makeTransform(), length: 50 },
    { boneId: 'root', parentBoneId: 'base', bindTransform: makeTransform(3, -2), length: 100 },
    { boneId: 'joint', parentBoneId: 'root', bindTransform: makeTransform(3, 0), length: 200 },
    { boneId: 'effector', parentBoneId: 'joint', bindTransform: makeTransform(0, 4), length: 300 }
];
const asset = {
    internalLayers: [],
    rigDefinition: {
        version: 1,
        parts: [],
        bones,
        rigidBindings: []
    }
};
const clip = {
    duration: 1,
    startFrame: 0,
    rigMotion: {
        version: 1,
        partTracks: [],
        boneTracks: [
            { boneId: 'base', keyframes: [{ frame: 0, x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0.35 }] },
            { boneId: 'root', keyframes: [{ frame: 0, x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0.2 }] },
            { boneId: 'joint', keyframes: [{ frame: 0, x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: -0.15 }] },
            { boneId: 'effector', keyframes: [{ frame: 0, x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 }] }
        ]
    }
};
const before = evaluateRigidBones(asset, clip, 0);
assert.equal(before.ok, true, 'FK fixture evaluates before applying IK');
const beforeRoot = applyTransformMatrix(before.poseByBoneId.get('root').worldMatrix, 0, 0);
const beforeJoint = applyTransformMatrix(before.poseByBoneId.get('joint').worldMatrix, 0, 0);
const beforeEffector = applyTransformMatrix(before.poseByBoneId.get('effector').worldMatrix, 0, 0);
const solveForFk = solveFixedLengthTwoBoneIk({
    root: beforeRoot,
    joint: beforeJoint,
    effector: beforeEffector,
    target: { x: beforeRoot.x + 6, y: beforeRoot.y },
    bendSign: 1
});
assert.equal(solveForFk.ok, true, 'FK fixture has a valid IK solution');
const trackFor = boneId => clip.rigMotion.boneTracks.find(track => track.boneId === boneId);
trackFor('root').keyframes[0].rotation += solveForFk.rootRotationDelta;
trackFor('joint').keyframes[0].rotation += solveForFk.jointRotationDelta;
const after = evaluateRigidBones(asset, clip, 0);
assert.equal(after.ok, true, 'FK fixture evaluates after applying only two rotation deltas');
const afterEffector = applyTransformMatrix(after.poseByBoneId.get('effector').worldMatrix, 0, 0);
closePoint(afterEffector, solveForFk.clampedTarget, 'existing FK reaches clamped target');
close(
    Math.hypot(
        applyTransformMatrix(after.poseByBoneId.get('joint').worldMatrix, 0, 0).x -
            applyTransformMatrix(after.poseByBoneId.get('root').worldMatrix, 0, 0).x,
        applyTransformMatrix(after.poseByBoneId.get('joint').worldMatrix, 0, 0).y -
            applyTransformMatrix(after.poseByBoneId.get('root').worldMatrix, 0, 0).y
    ),
    3,
    'first segment length stays fixed'
);

assert.equal(bones[1].length, 100, 'display length is not used or mutated');
assert.equal(bones[2].length, 200, 'display length is not used or mutated');
assert.equal(bones[3].length, 300, 'display length is not used or mutated');
console.log('verify-two-bone-ik: pure solver, clamp/error cases, and existing FK rotation contract passed');
