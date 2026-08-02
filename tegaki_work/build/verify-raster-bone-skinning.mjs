import assert from 'node:assert/strict';

import {
    evaluateRasterBoneSkinning,
    validateRasterBoneSkinning
} from '../system/animation/raster-bone-skinning.js';

globalThis.window = globalThis.window || {};

const {
    ClipAssetModel,
    ClipInstanceModel,
    TimelineModel
} = await import('../system/animation/animation-data-model.js');

const close = (actual, expected, label) => {
    assert.ok(Math.abs(actual - expected) < 1e-8, `${label}: ${actual} !== ${expected}`);
};

const internalLayers = [
    { id: 'arm-raster', name: 'Arm', type: 'raster' },
    { id: 'other-raster', name: 'Other', type: 'raster' }
];
const bones = [
    {
        boneId: 'shoulder',
        parentBoneId: null,
        bindTransform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, pivotX: 0, pivotY: 0 },
        length: 5
    },
    {
        boneId: 'elbow',
        parentBoneId: 'shoulder',
        bindTransform: { x: 5, y: 0, scaleX: 1, scaleY: 1, rotation: 0, pivotX: 0, pivotY: 0 },
        length: 5
    },
    {
        boneId: 'wrist',
        parentBoneId: 'elbow',
        bindTransform: { x: 5, y: 0, scaleX: 1, scaleY: 1, rotation: 0, pivotX: 0, pivotY: 0 },
        length: 5
    }
];
const vertex = (column, row) => ({
    vertexId: `v-${column}-${row}`,
    x: column * 5,
    y: row === 0 ? -1 : 1
});
const vertices = [];
for (let row = 0; row < 2; row++) {
    for (let column = 0; column < 4; column++) vertices.push(vertex(column, row));
}
const triangles = [];
for (let column = 0; column < 3; column++) {
    const topLeft = `v-${column}-0`;
    const topRight = `v-${column + 1}-0`;
    const bottomLeft = `v-${column}-1`;
    const bottomRight = `v-${column + 1}-1`;
    triangles.push([topLeft, topRight, bottomRight], [topLeft, bottomRight, bottomLeft]);
}
const influencesForColumn = column => {
    if (column === 0) return [{ boneId: 'shoulder', weight: 1 }];
    if (column === 1) return [
        { boneId: 'shoulder', weight: 1 },
        { boneId: 'elbow', weight: 1 }
    ];
    if (column === 2) return [
        { boneId: 'elbow', weight: 1 },
        { boneId: 'wrist', weight: 1 }
    ];
    return [{ boneId: 'wrist', weight: 1 }];
};
const meshDefinitions = [{
    version: 1,
    meshId: 'arm-mesh',
    targetInternalLayerId: 'arm-raster',
    vertices,
    triangles
}];
const skinBindings = [{
    version: 1,
    meshId: 'arm-mesh',
    vertexWeights: vertices.map(item => ({
        vertexId: item.vertexId,
        influences: influencesForColumn(Number(item.vertexId.split('-')[1]))
    }))
}];
const rigDefinition = { version: 1, parts: [], bones };

const valid = validateRasterBoneSkinning(
    meshDefinitions,
    skinBindings,
    internalLayers,
    rigDefinition
);
assert.equal(valid.ok, true, 'valid one-Raster / three-Bone skin');

const asset = new ClipAssetModel({
    id: 'asset-arm',
    name: 'One Raster Arm',
    internalLayers,
    rigDefinition,
    meshDefinitions,
    skinBindings
});
const identityClip = new ClipInstanceModel({
    id: 'clip-identity',
    assetId: asset.id,
    duration: 5,
    rigMotion: { version: 1, partTracks: [], boneTracks: [] }
});
const identity = evaluateRasterBoneSkinning(asset, identityClip, 0);
assert.equal(identity.ok, true, 'identity skin evaluates');
assert.deepEqual(
    identity.meshResults[0].vertices.map(item => [item.x, item.y]),
    vertices.map(item => [item.x, item.y]),
    'bind == current is exact identity'
);
assert.deepEqual(identity.meshResults[0].triangleIndices[0], [0, 1, 5], 'stable triangle order becomes dense indices');

const rootRotationClip = new ClipInstanceModel({
    id: 'clip-root-rotation',
    assetId: asset.id,
    duration: 1,
    rigMotion: {
        version: 1,
        partTracks: [],
        boneTracks: [{
            boneId: 'shoulder',
            keyframes: [{ frame: 0, interpolation: 'hold', x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: Math.PI / 2 }]
        }]
    }
});
const rootRotation = evaluateRasterBoneSkinning(asset, rootRotationClip, 0);
rootRotation.meshResults[0].vertices.forEach((item, index) => {
    close(item.x, -vertices[index].y, `root rotation x ${index}`);
    close(item.y, vertices[index].x, `root rotation y ${index}`);
});

const elbowRotationClip = new ClipInstanceModel({
    id: 'clip-elbow-rotation',
    assetId: asset.id,
    duration: 1,
    rigMotion: {
        version: 1,
        partTracks: [],
        boneTracks: [{
            boneId: 'elbow',
            keyframes: [{ frame: 0, interpolation: 'hold', x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: Math.PI / 2 }]
        }]
    }
});
const elbowRotation = evaluateRasterBoneSkinning(asset, elbowRotationClip, 0);
const shoulderVertex = elbowRotation.meshResults[0].vertices.find(item => item.vertexId === 'v-0-0');
close(shoulderVertex.x, 0, 'shoulder-only vertex x stays');
close(shoulderVertex.y, -1, 'shoulder-only vertex y stays');
const blendedVertex = elbowRotation.meshResults[0].vertices.find(item => item.vertexId === 'v-1-0');
close(blendedVertex.x, 5.5, 'elbow boundary normalized blend x');
close(blendedVertex.y, -0.5, 'elbow boundary normalized blend y');

const wristRotationClip = new ClipInstanceModel({
    id: 'clip-wrist-rotation',
    assetId: asset.id,
    duration: 1,
    rigMotion: {
        version: 1,
        partTracks: [],
        boneTracks: [{
            boneId: 'wrist',
            keyframes: [{ frame: 0, interpolation: 'hold', x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: Math.PI / 2 }]
        }]
    }
});
const wristRotation = evaluateRasterBoneSkinning(asset, wristRotationClip, 0);
const wristVertex = wristRotation.meshResults[0].vertices.find(item => item.vertexId === 'v-3-0');
close(wristVertex.x, 11, 'wrist-only vertex rotates around wrist x');
close(wristVertex.y, 5, 'wrist-only vertex rotates around wrist y');
const untouchedVertex = wristRotation.meshResults[0].vertices.find(item => item.vertexId === 'v-0-0');
close(untouchedVertex.x, 0, 'wrist does not leak to shoulder x');
close(untouchedVertex.y, -1, 'wrist does not leak to shoulder y');

const randomSeekClip = new ClipInstanceModel({
    id: 'clip-random-seek',
    assetId: asset.id,
    duration: 5,
    rigMotion: {
        version: 1,
        partTracks: [],
        boneTracks: [{
            boneId: 'elbow',
            keyframes: [
                { frame: 0, interpolation: 'linear', x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
                { frame: 4, interpolation: 'hold', x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: Math.PI / 2 }
            ]
        }]
    }
});
const sequential = [0, 1, 2, 3, 4].map(frame => evaluateRasterBoneSkinning(asset, randomSeekClip, frame));
const randomFrame2 = [4, 0, 3, 1, 2]
    .map(frame => ({ frame, result: evaluateRasterBoneSkinning(asset, randomSeekClip, frame) }))
    .find(item => item.frame === 2).result;
assert.deepEqual(randomFrame2.meshResults, sequential[2].meshResults, 'random seek equals sequential evaluation');

const zeroInfluenceBindings = [{
    version: 1,
    meshId: 'arm-mesh',
    vertexWeights: [{ vertexId: 'v-0-0', influences: [] }]
}];
assert.equal(
    validateRasterBoneSkinning(meshDefinitions, zeroInfluenceBindings, internalLayers, rigDefinition).ok,
    true,
    'empty influence list explicitly uses bind position'
);

const invalidCases = [
    {
        label: 'dangling Bone',
        bindings: [{ version: 1, meshId: 'arm-mesh', vertexWeights: [{ vertexId: 'v-0-0', influences: [{ boneId: 'missing', weight: 1 }] }] }],
        code: 'dangling-influence-bone-id'
    },
    {
        label: 'negative weight',
        bindings: [{ version: 1, meshId: 'arm-mesh', vertexWeights: [{ vertexId: 'v-0-0', influences: [{ boneId: 'shoulder', weight: -1 }] }] }],
        code: 'invalid-influence-weight'
    },
    {
        label: 'zero weight sum',
        bindings: [{ version: 1, meshId: 'arm-mesh', vertexWeights: [{ vertexId: 'v-0-0', influences: [{ boneId: 'shoulder', weight: 0 }] }] }],
        code: 'zero-influence-weight-sum'
    },
    {
        label: 'too many influences',
        bindings: [{
            version: 1,
            meshId: 'arm-mesh',
            vertexWeights: [{
                vertexId: 'v-0-0',
                influences: Array.from({ length: 5 }, (_, index) => ({ boneId: index === 0 ? 'shoulder' : `missing-${index}`, weight: 1 }))
            }]
        }],
        code: 'too-many-influences'
    }
];
invalidCases.forEach(testCase => {
    const result = validateRasterBoneSkinning(meshDefinitions, testCase.bindings, internalLayers, rigDefinition);
    assert.equal(result.ok, false, `${testCase.label} rejected`);
    assert.ok(result.errors.some(error => error.code === testCase.code), `${testCase.label} reports ${testCase.code}`);
});

const legacyAsset = new ClipAssetModel({ id: 'legacy', internalLayers });
assert.equal(Object.hasOwn(legacyAsset.serialize(), 'meshDefinitions'), false, 'legacy asset has no Mesh field');
assert.equal(Object.hasOwn(legacyAsset.serialize(), 'skinBindings'), false, 'legacy asset has no Skin field');

const model = new TimelineModel({
    totalFrames: 5,
    clipAssets: [asset.serialize()],
    tracks: [{ id: 'lane-arm', cels: [identityClip.serialize()] }]
});
assert.equal(model.validateRasterBoneSkins().ok, true, 'Timeline validates Raster Bone Skinning');
const restored = new TimelineModel(model.serialize());
assert.deepEqual(restored.serialize(), model.serialize(), 'Mesh / Skin Project round-trip');
const modelAsset = model.getClipAsset(asset.id);

const duplicate = model.duplicateClipAsset(asset.id);
assert.equal(duplicate.ok, true, 'duplicate skinned ClipAsset');
assert.equal(duplicate.asset.meshDefinitions.length, 1);
assert.notEqual(duplicate.asset.meshDefinitions[0].meshId, 'arm-mesh', 'Mesh ID remapped');
assert.notEqual(duplicate.asset.meshDefinitions[0].targetInternalLayerId, 'arm-raster', 'Raster target remapped');
assert.notEqual(duplicate.asset.meshDefinitions[0].vertices[0].vertexId, 'v-0-0', 'vertex ID remapped');
assert.notEqual(duplicate.asset.skinBindings[0].vertexWeights[0].influences[0].boneId, 'shoulder', 'Bone influence remapped');
assert.equal(
    validateRasterBoneSkinning(
        duplicate.asset.meshDefinitions,
        duplicate.asset.skinBindings,
        duplicate.asset.internalLayers,
        duplicate.asset.rigDefinition
    ).ok,
    true,
    'duplicated references validate'
);

const layerDuplicate = model.duplicateClipAssetInternalLayer(asset.id, 'arm-raster');
assert.equal(layerDuplicate.ok, true, 'duplicate skinned Raster layer');
assert.equal(modelAsset.meshDefinitions.length, 2, 'Raster duplicate creates a second static Mesh');
assert.equal(modelAsset.skinBindings.length, 2, 'Raster duplicate creates a second Skin binding');
assert.equal(
    validateRasterBoneSkinning(
        modelAsset.meshDefinitions,
        modelAsset.skinBindings,
        modelAsset.internalLayers,
        modelAsset.rigDefinition
    ).ok,
    true,
    'same-Asset Raster duplicate remaps Mesh / vertex and retains Bone ids'
);

const remove = model.removeClipAssetInternalLayer(asset.id, layerDuplicate.layer.id);
assert.equal(remove.ok, true, 'delete duplicated skinned Raster');
assert.equal(modelAsset.meshDefinitions.length, 1, 'Raster delete cascades matching Mesh');
assert.equal(modelAsset.skinBindings.length, 1, 'Raster delete cascades matching Skin binding');

const authoringModel = new TimelineModel({
    totalFrames: 4,
    clipAssets: [{
        id: 'asset-authoring',
        internalLayers: [{ id: 'one-raster', name: 'Arm Raster', type: 'raster' }]
    }],
    tracks: [{
        id: 'lane-authoring',
        cels: [{ id: 'clip-authoring', assetId: 'asset-authoring', startFrame: 0, duration: 4 }]
    }]
});
const shoulderRegistration = authoringModel.registerClipAssetRasterBone('asset-authoring', 'one-raster', {
    boneId: 'mesh-shoulder',
    name: 'Shoulder',
    length: 32,
    bindTransform: { x: 10, y: 20, rotation: 0 }
});
assert.equal(shoulderRegistration.ok, true, 'Raster Mesh Bone can be registered without a Part');
const elbowRegistration = authoringModel.registerClipAssetRasterBone('asset-authoring', 'one-raster', {
    boneId: 'mesh-elbow',
    parentBoneId: 'mesh-shoulder',
    name: 'Elbow',
    length: 24,
    bindTransform: { x: 32, y: 0, rotation: 0 }
});
assert.equal(elbowRegistration.ok, true, 'second Raster Mesh Bone reuses Bone hierarchy');
const authoringAsset = authoringModel.getClipAsset('asset-authoring');
assert.equal(authoringAsset.rigDefinition.parts.length, 0, 'Raster Mesh Bone does not create Part');
assert.equal(authoringAsset.rigDefinition.rigidBindings, undefined, 'Raster Mesh Bone does not create rigid binding');
assert.equal(authoringAsset.rigDefinition.bones.length, 2, 'one Raster accepts multiple Mesh Bones');
assert.equal(
    authoringModel.setClipRigBoneKey('clip-authoring', 'mesh-elbow', 1, {
        x: 0,
        y: 0,
        scaleX: 1,
        scaleY: 1,
        rotation: Math.PI / 4
    }).ok,
    true,
    'Mesh Bone reuses existing Frame-local Bone Pose track'
);

console.log('verify-raster-bone-skinning: optional schema, validation, LBS, hierarchy, Raster authoring, random seek, remap, round-trip OK');
