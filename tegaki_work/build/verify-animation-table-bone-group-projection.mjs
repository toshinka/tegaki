import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createAnimationTableBoneGroupProjection } from '../system/animation/animation-table-bone-group-projection.js';

const asset = {
    internalLayers: [
        { id: 'folder-arm', type: 'folder', name: 'ARM' },
        { id: 'raster-body', type: 'raster', name: 'BODY' },
        { id: 'raster-face', type: 'raster', name: 'FACE' }
    ],
    rigDefinition: {
        parts: [{ partId: 'folder-arm' }],
        bones: [
            { boneId: 'rigid-arm', name: 'ARM ROOT' },
            { boneId: 'body', name: 'BODY BONE', parentBoneId: 'connector' },
            { boneId: 'body-child', name: 'BODY CHILD', parentBoneId: 'body' },
            { boneId: 'shared', name: 'SHARED' },
            { boneId: 'connector', name: 'CONNECTOR' },
            { boneId: 'loose', name: 'LOOSE' }
        ],
        rigidBindings: [{ bindingId: 'rb-arm', partId: 'folder-arm', boneId: 'rigid-arm' }]
    },
    meshDefinitions: [
        { meshId: 'mesh-body', targetInternalLayerId: 'raster-body' },
        { meshId: 'mesh-face', targetInternalLayerId: 'raster-face' }
    ],
    skinBindings: [
        {
            meshId: 'mesh-body',
            vertexWeights: [
                { vertexId: 'b0', influences: [{ boneId: 'body', weight: 1 }] },
                { vertexId: 'b1', influences: [{ boneId: 'body-child', weight: 1 }] },
                { vertexId: 'b2', influences: [{ boneId: 'shared', weight: 0.25 }] }
            ]
        },
        {
            meshId: 'mesh-face',
            vertexWeights: [
                { vertexId: 'f0', influences: [{ boneId: 'shared', weight: 1 }] }
            ]
        }
    ]
};
const before = structuredClone(asset);
const projection = createAnimationTableBoneGroupProjection(asset);

assert.equal(projection.ok, true);
assert.deepEqual(projection.groups.map(group => [group.groupId, group.bones.map(bone => bone.boneId)]), [
    ['target:folder-arm', ['rigid-arm']],
    ['target:raster-body', ['body', 'body-child']],
    ['shared', ['shared']],
    ['unassigned', ['connector', 'loose']]
]);
assert.deepEqual(
    projection.groups.find(group => group.groupId === 'shared').bones[0].targets.map(target => target.targetLayerId),
    ['raster-body', 'raster-face'],
    '複数Raster参照Boneを一方へfallbackしない'
);
assert.deepEqual(
    projection.groups.find(group => group.groupId === 'unassigned').bones[0].relatedTargetLayerIds,
    ['raster-body'],
    '外部親Boneは子target候補を診断するが自動所属させない'
);
assert.deepEqual(asset, before, 'Table group projectionは保存正本を変更しない');

const source = readFileSync(new URL('../system/animation/animation-table-bone-group-projection.js', import.meta.url), 'utf8');
assert.doesNotMatch(source, /historyManager|ProjectManager|serialize\s*\(|boneGroupId|isRigged/);
assert.match(source, /groupKind:\s*'shared'/);
assert.match(source, /groupKind:\s*'unassigned'/);

console.log('verify-animation-table-bone-group-projection: exact target / shared / unassigned / connector diagnosis OK');
