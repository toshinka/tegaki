import assert from 'node:assert/strict';

import { createChainLocalJointSkinWeights } from '../system/animation/chain-local-joint-skin.js';
import { createRasterBoneDistanceInfluences } from '../system/animation/raster-bone-auto-setup.js';
import { evaluateRasterBoneSkinning } from '../system/animation/raster-bone-skinning.js';

globalThis.window = globalThis.window || {};
const { ClipAssetModel, ClipInstanceModel } = await import('../system/animation/animation-data-model.js');

const close = (actual, expected, epsilon = 1e-8) => {
    assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} !== ${expected}`);
};
const bones = [
    { boneId: 'torso', parentBoneId: null },
    { boneId: 'left-upper', parentBoneId: 'torso' },
    { boneId: 'left-forearm', parentBoneId: 'left-upper' },
    { boneId: 'right-upper', parentBoneId: 'torso' },
    { boneId: 'right-forearm', parentBoneId: 'right-upper' },
    { boneId: 'left-thigh', parentBoneId: 'torso' },
    { boneId: 'right-thigh', parentBoneId: 'torso' }
];
const segments = [
    { boneId: 'torso', start: { x: 0, y: -20 }, end: { x: 0, y: 55 } },
    { boneId: 'left-upper', start: { x: 0, y: 20 }, end: { x: -45, y: 20 } },
    { boneId: 'left-forearm', start: { x: -45, y: 20 }, end: { x: -90, y: 20 } },
    { boneId: 'right-upper', start: { x: 0, y: 20 }, end: { x: 45, y: 20 } },
    { boneId: 'right-forearm', start: { x: 45, y: 20 }, end: { x: 90, y: 20 } },
    { boneId: 'left-thigh', start: { x: -12, y: 55 }, end: { x: -22, y: 105 } },
    { boneId: 'right-thigh', start: { x: 12, y: 55 }, end: { x: 22, y: 105 } }
];
const vertices = [
    { vertexId: 'head', x: 0, y: -48 },
    { vertexId: 'pelvis-center', x: 0, y: 55 },
    { vertexId: 'left-hip-joint', x: -12, y: 55 },
    { vertexId: 'left-upper-middle', x: -25, y: 27 },
    { vertexId: 'left-elbow', x: -45, y: 20 },
    { vertexId: 'left-forearm-middle', x: -70, y: 27 }
];
const before = structuredClone({ vertices, bones, segments });
const result = createChainLocalJointSkinWeights(vertices, bones, segments);
assert.equal(result.ok, true, 'unambiguous humanoid branch fixture accepted');
assert.deepEqual({ vertices, bones, segments }, before, 'pure candidate does not mutate inputs');
assert.deepEqual(
    result.vertexWeights.find(weight => weight.vertexId === 'head').influences,
    [{ boneId: 'torso', weight: 1 }],
    'head is rigid torso and receives no arm/leg branch weight'
);
assert.deepEqual(
    result.vertexWeights.find(weight => weight.vertexId === 'left-forearm-middle').influences,
    [{ boneId: 'left-forearm', weight: 1 }],
    'forearm middle is rigid'
);
assert.deepEqual(
    result.vertexWeights.find(weight => weight.vertexId === 'pelvis-center').influences,
    [{ boneId: 'torso', weight: 1 }],
    'parent region between two child joints remains rigid instead of guessing a branch'
);
const hipInfluences = result.vertexWeights.find(weight => weight.vertexId === 'left-hip-joint').influences;
assert.deepEqual(
    new Set(hipInfluences.map(influence => influence.boneId)),
    new Set(['left-thigh', 'torso']),
    'off-axis child root can still blend with its direct parent'
);
hipInfluences.forEach(influence => close(influence.weight, 0.5));
const elbowInfluences = result.vertexWeights.find(weight => weight.vertexId === 'left-elbow').influences;
assert.deepEqual(elbowInfluences.map(influence => influence.boneId), ['left-forearm', 'left-upper']);
elbowInfluences.forEach(influence => close(influence.weight, 0.5));
result.vertexWeights.forEach(weight => {
    assert.ok(weight.influences.length <= 2, `${weight.vertexId} max-2 influences`);
    assert.ok(weight.influences.every(influence => Number.isFinite(influence.weight) && influence.weight > 0));
    close(weight.influences.reduce((sum, influence) => sum + influence.weight, 0), 1);
});
const reversed = createChainLocalJointSkinWeights(
    [...vertices].reverse(),
    [...bones].reverse(),
    [...segments].reverse()
);
assert.equal(reversed.ok, true);
assert.deepEqual(
    [...reversed.vertexWeights].sort((left, right) => left.vertexId.localeCompare(right.vertexId)),
    [...result.vertexWeights].sort((left, right) => left.vertexId.localeCompare(right.vertexId)),
    'input order does not change per-vertex result'
);

const ambiguousVertices = [{ vertexId: 'shared-root', x: 0, y: 0 }];
const ambiguousBones = [
    { boneId: 'root', parentBoneId: null },
    { boneId: 'left', parentBoneId: 'root' },
    { boneId: 'right', parentBoneId: 'root' }
];
const ambiguousSegments = [
    { boneId: 'root', start: { x: 0, y: -20 }, end: { x: 0, y: 20 } },
    { boneId: 'left', start: { x: 0, y: 0 }, end: { x: -30, y: 0 } },
    { boneId: 'right', start: { x: 0, y: 0 }, end: { x: 30, y: 0 } }
];
const ambiguousBefore = structuredClone({ ambiguousVertices, ambiguousBones, ambiguousSegments });
const ambiguous = createChainLocalJointSkinWeights(
    ambiguousVertices,
    ambiguousBones,
    ambiguousSegments
);
assert.equal(ambiguous.ok, false, 'coincident sibling junction is rejected');
assert.equal(ambiguous.reason, 'chain-local-ambiguous-branch');
assert.equal(ambiguous.vertexId, 'shared-root');
assert.deepEqual(
    { ambiguousVertices, ambiguousBones, ambiguousSegments },
    ambiguousBefore,
    'rejection is non-mutating'
);

const ambiguousJoint = createChainLocalJointSkinWeights(
    [{ vertexId: 'parent-between-close-joints', x: 0, y: 0 }],
    ambiguousBones,
    [
        { boneId: 'root', start: { x: 0, y: -20 }, end: { x: 0, y: 20 } },
        { boneId: 'left', start: { x: -3, y: 0 }, end: { x: -23, y: 0 } },
        { boneId: 'right', start: { x: 3, y: 0 }, end: { x: 23, y: 0 } }
    ]
);
assert.equal(ambiguousJoint.ok, false, 'overlapping child joint bands are rejected');
assert.equal(ambiguousJoint.reason, 'chain-local-ambiguous-joint');

assert.equal(createChainLocalJointSkinWeights(
    [{ vertexId: 'point', x: 0, y: 0 }],
    [{ boneId: 'zero', parentBoneId: null }],
    [{ boneId: 'zero', start: { x: 0, y: 0 }, end: { x: 0, y: 0 } }]
).reason, 'chain-local-zero-length-segment');
assert.equal(createChainLocalJointSkinWeights(
    [{ vertexId: 'point', x: 0, y: 0 }],
    [
        { boneId: 'cycle-a', parentBoneId: 'cycle-b' },
        { boneId: 'cycle-b', parentBoneId: 'cycle-a' }
    ],
    [
        { boneId: 'cycle-a', start: { x: 0, y: 0 }, end: { x: 10, y: 0 } },
        { boneId: 'cycle-b', start: { x: 10, y: 0 }, end: { x: 20, y: 0 } }
    ]
).reason, 'chain-local-bone-cycle');

// Two-Bone strip: current global distance blends most outline vertices, while the
// candidate keeps segment interiors rigid and blends only the short elbow band.
const armBones = [
    {
        boneId: 'upper',
        parentBoneId: null,
        bindTransform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, pivotX: 0, pivotY: 0 },
        length: 50
    },
    {
        boneId: 'forearm',
        parentBoneId: 'upper',
        bindTransform: { x: 50, y: 0, scaleX: 1, scaleY: 1, rotation: 0, pivotX: 0, pivotY: 0 },
        length: 50
    }
];
const armSegments = [
    { boneId: 'upper', start: { x: 0, y: 0 }, end: { x: 50, y: 0 } },
    { boneId: 'forearm', start: { x: 50, y: 0 }, end: { x: 100, y: 0 } }
];
const columns = [0, 35, 45, 50, 55, 65, 80, 100];
const armVertices = columns.flatMap((x, column) => [-6, 6].map((y, row) => ({
    vertexId: `arm-${column}-${row}`,
    x,
    y
})));
const armTriangles = [];
for (let column = 0; column < columns.length - 1; column++) {
    armTriangles.push(
        [`arm-${column}-0`, `arm-${column + 1}-0`, `arm-${column + 1}-1`],
        [`arm-${column}-0`, `arm-${column + 1}-1`, `arm-${column}-1`]
    );
}
const candidate = createChainLocalJointSkinWeights(armVertices, armBones, armSegments);
assert.equal(candidate.ok, true, 'two-Bone strip accepted');
assert.ok(candidate.diagnostics.rigidVertexCount > candidate.diagnostics.jointVertexCount);
const currentWeights = armVertices.map(vertex => ({
    vertexId: vertex.vertexId,
    influences: createRasterBoneDistanceInfluences(vertex, armSegments)
}));
assert.ok(
    currentWeights.filter(weight => weight.influences.length === 2).length
        > candidate.diagnostics.jointVertexCount,
    'candidate confines blending to fewer joint vertices than global distance'
);

function evaluateArm(vertexWeights, degrees) {
    const asset = new ClipAssetModel({
        id: `arm-${degrees}`,
        internalLayers: [{ id: 'arm-raster', name: 'Arm', type: 'raster' }],
        rigDefinition: { version: 1, parts: [], bones: armBones },
        meshDefinitions: [{
            version: 1,
            meshId: 'arm-mesh',
            targetInternalLayerId: 'arm-raster',
            vertices: armVertices,
            triangles: armTriangles
        }],
        skinBindings: [{ version: 1, meshId: 'arm-mesh', vertexWeights }]
    });
    const clip = new ClipInstanceModel({
        id: `clip-${degrees}`,
        assetId: asset.id,
        duration: 1,
        rigMotion: {
            version: 1,
            partTracks: [],
            boneTracks: [{
                boneId: 'forearm',
                keyframes: [{
                    frame: 0,
                    interpolation: 'hold',
                    x: 0,
                    y: 0,
                    scaleX: 1,
                    scaleY: 1,
                    rotation: degrees * Math.PI / 180
                }]
            }]
        }
    });
    const evaluation = evaluateRasterBoneSkinning(asset, clip, 0);
    assert.equal(evaluation.ok, true, `${degrees} degree skin evaluates`);
    return new Map(evaluation.meshResults[0].vertices.map(vertex => [vertex.vertexId, vertex]));
}
function distanceBetween(left, right) {
    return Math.hypot(right.x - left.x, right.y - left.y);
}
function signedArea(left, middle, right) {
    return (middle.x - left.x) * (right.y - left.y) - (middle.y - left.y) * (right.x - left.x);
}
const qualityRows = [];
for (const degrees of [45, 90, 135]) {
    const currentPose = evaluateArm(currentWeights, degrees);
    const candidatePose = evaluateArm(candidate.vertexWeights, degrees);
    const currentWidth = distanceBetween(currentPose.get('arm-6-0'), currentPose.get('arm-6-1'));
    const candidateWidth = distanceBetween(candidatePose.get('arm-6-0'), candidatePose.get('arm-6-1'));
    assert.ok(Math.abs(candidateWidth - 12) < Math.abs(currentWidth - 12), `${degrees}° width improves`);
    close(candidateWidth, 12, 1e-7);
    const currentLength = distanceBetween(currentPose.get('arm-5-0'), currentPose.get('arm-7-0'));
    const candidateLength = distanceBetween(candidatePose.get('arm-5-0'), candidatePose.get('arm-7-0'));
    assert.ok(Math.abs(candidateLength - 35) < Math.abs(currentLength - 35), `${degrees}° length improves`);
    close(candidateLength, 35, 1e-7);
    qualityRows.push({
        degrees,
        currentWidthError: Math.abs(currentWidth - 12),
        candidateWidthError: Math.abs(candidateWidth - 12),
        currentLengthError: Math.abs(currentLength - 35),
        candidateLengthError: Math.abs(candidateLength - 35)
    });
    armTriangles.forEach((triangle, index) => {
        const bind = triangle.map(vertexId => armVertices.find(vertex => vertex.vertexId === vertexId));
        const posed = triangle.map(vertexId => candidatePose.get(vertexId));
        const bindSign = Math.sign(signedArea(...bind));
        const poseSign = Math.sign(signedArea(...posed));
        assert.equal(poseSign, bindSign, `${degrees}° triangle ${index} keeps non-zero winding`);
    });
}

console.log(
    'verify-chain-local-joint-skin: branch-local rigid segments, short joint band, ambiguity rejection and 45/90/135 quality OK',
    qualityRows.map(row => ({
        degrees: row.degrees,
        widthError: `${row.currentWidthError.toFixed(4)} -> ${row.candidateWidthError.toFixed(4)}`,
        lengthError: `${row.currentLengthError.toFixed(4)} -> ${row.candidateLengthError.toFixed(4)}`
    }))
);
