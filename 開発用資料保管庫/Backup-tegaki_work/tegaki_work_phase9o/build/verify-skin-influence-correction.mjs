import assert from 'node:assert/strict';

import {
    createSkinInfluenceCorrectionPlan,
    LIMITED_SKIN_CORRECTION_MODE,
    SKIN_INFLUENCE_CORRECTION_ACTIONS
} from '../system/animation/skin-influence-correction.js';

function createAsset() {
    return {
        id: 'asset-1',
        internalLayers: [{ id: 'raster-1', type: 'raster' }],
        rigDefinition: {
            bones: [
                { boneId: 'parent', parentBoneId: null },
                { boneId: 'child', parentBoneId: 'parent' }
            ],
            parts: [],
            rigidBindings: []
        },
        meshDefinitions: [{
            version: 1,
            meshId: 'mesh-1',
            targetInternalLayerId: 'raster-1',
            vertices: [
                { vertexId: 'v1', x: 0, y: 0 },
                { vertexId: 'v2', x: 10, y: 0 },
                { vertexId: 'v3', x: 0, y: 10 }
            ],
            triangles: [['v1', 'v2', 'v3']],
            generator: {
                type: 'auto-shape-fill-v1',
                weightMode: 'chain-local-joint-v1',
                source: { snapshotId: 'snapshot-1' }
            }
        }],
        skinBindings: [{
            version: 1,
            meshId: 'mesh-1',
            vertexWeights: [
                { vertexId: 'v1', influences: [{ boneId: 'parent', weight: 1 }] },
                { vertexId: 'v2', influences: [{ boneId: 'parent', weight: 1 }] },
                { vertexId: 'v3', influences: [{ boneId: 'child', weight: 1 }] }
            ]
        }]
    };
}

const asset = createAsset();
const before = structuredClone(asset);
const boneOnly = createSkinInfluenceCorrectionPlan(
    asset,
    'raster-1',
    'child',
    ['v1'],
    SKIN_INFLUENCE_CORRECTION_ACTIONS.BONE_ONLY
);
assert.equal(boneOnly.ok, true);
assert.equal(boneOnly.changed, true);
assert.deepEqual(asset, before, 'pure plan must not mutate the asset');
assert.deepEqual(
    boneOnly.skinBindings[0].vertexWeights.find(weight => weight.vertexId === 'v1').influences,
    [{ boneId: 'child', weight: 1 }]
);
assert.equal(
    boneOnly.meshDefinitions[0].generator.weightCorrectionMode,
    LIMITED_SKIN_CORRECTION_MODE
);

const parentBlend = createSkinInfluenceCorrectionPlan(
    asset,
    'raster-1',
    'child',
    ['v2'],
    SKIN_INFLUENCE_CORRECTION_ACTIONS.PARENT_BLEND
);
assert.equal(parentBlend.ok, true);
assert.deepEqual(
    parentBlend.skinBindings[0].vertexWeights.find(weight => weight.vertexId === 'v2').influences,
    [
        { boneId: 'child', weight: 0.5 },
        { boneId: 'parent', weight: 0.5 }
    ]
);

const none = createSkinInfluenceCorrectionPlan(
    asset,
    'raster-1',
    'child',
    ['v3'],
    SKIN_INFLUENCE_CORRECTION_ACTIONS.NONE
);
assert.equal(none.ok, true);
assert.deepEqual(
    none.skinBindings[0].vertexWeights.find(weight => weight.vertexId === 'v3').influences,
    []
);

const noOp = createSkinInfluenceCorrectionPlan(
    asset,
    'raster-1',
    'child',
    ['v3'],
    SKIN_INFLUENCE_CORRECTION_ACTIONS.BONE_ONLY
);
assert.equal(noOp.ok, true);
assert.equal(noOp.changed, false);
assert.equal(noOp.meshDefinitions[0].generator.weightCorrectionMode, undefined);

const missingVertex = createSkinInfluenceCorrectionPlan(
    asset,
    'raster-1',
    'child',
    ['missing'],
    SKIN_INFLUENCE_CORRECTION_ACTIONS.BONE_ONLY
);
assert.equal(missingVertex.ok, false);
assert.equal(missingVertex.reason, 'vertex-not-found');

const rootBlend = createSkinInfluenceCorrectionPlan(
    asset,
    'raster-1',
    'parent',
    ['v1'],
    SKIN_INFLUENCE_CORRECTION_ACTIONS.PARENT_BLEND
);
assert.equal(rootBlend.ok, false);
assert.equal(rootBlend.reason, 'parent-bone-required');

const wrongGenerator = createAsset();
wrongGenerator.meshDefinitions[0].generator.type = 'alpha-fit-grid-v1';
const rejected = createSkinInfluenceCorrectionPlan(
    wrongGenerator,
    'raster-1',
    'child',
    ['v1'],
    SKIN_INFLUENCE_CORRECTION_ACTIONS.BONE_ONLY
);
assert.equal(rejected.ok, false);
assert.equal(rejected.reason, 'chain-local-auto-shape-required');

console.log('verify-skin-influence-correction: PASS');
