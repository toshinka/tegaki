import assert from 'node:assert/strict';
import { createRasterBoneDistanceInfluences } from '../system/animation/raster-bone-auto-setup.js';

// Phase 7z Stage A: 一枚人体を簡略化したbranch fixture。
// 現行distance weightが意味領域を持たず、最寄り以外のbranchへ必ず第2weightを配ることを固定する。
const segments = [
    { boneId: 'torso', start: { x: 0, y: -20 }, end: { x: 0, y: 55 } },
    { boneId: 'left-upper-arm', start: { x: 0, y: 20 }, end: { x: -45, y: 20 } },
    { boneId: 'left-forearm', start: { x: -45, y: 20 }, end: { x: -90, y: 20 } },
    { boneId: 'right-upper-arm', start: { x: 0, y: 20 }, end: { x: 45, y: 20 } },
    { boneId: 'right-forearm', start: { x: 45, y: 20 }, end: { x: 90, y: 20 } },
    { boneId: 'left-thigh', start: { x: -12, y: 55 }, end: { x: -22, y: 105 } },
    { boneId: 'right-thigh', start: { x: 12, y: 55 }, end: { x: 22, y: 105 } }
];

const headVertex = { x: 0, y: -48 };
const headWeights = createRasterBoneDistanceInfluences(headVertex, segments);
assert.equal(headWeights.length, 2, '現行distance weightはheadにも2 influenceを作る');
assert.equal(headWeights[0].boneId, 'torso', 'headの最寄りはtorso');
assert.ok(
    headWeights.some(influence => influence.boneId !== 'torso' && influence.weight > 0),
    'headへarm/leg branchの非0 weightが漏れるbaseline'
);
assert.ok(Math.abs(headWeights.reduce((sum, influence) => sum + influence.weight, 0) - 1) < 1e-12);

const leftForearmVertex = { x: -70, y: 31 };
const leftForearmWeights = createRasterBoneDistanceInfluences(leftForearmVertex, segments);
assert.deepEqual(
    leftForearmWeights.map(influence => influence.boneId),
    ['left-forearm', 'left-upper-arm'],
    '肢内では同じdirect chainが偶然上位になるfixture'
);
assert.ok(leftForearmWeights.every(influence => Number.isFinite(influence.weight) && influence.weight > 0));

const repeated = createRasterBoneDistanceInfluences(headVertex, [...segments].reverse());
assert.deepEqual(repeated, headWeights, 'segment入力順によらずboneId tie-breakで決定的');

console.log('verify-chain-local-joint-skin-baseline: current global-distance cross-branch leakage reproduced');
