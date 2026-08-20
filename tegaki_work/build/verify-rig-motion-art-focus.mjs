import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRigMotionArtFocusProjection } from '../system/animation/rig-motion-art-focus.js';

const asset = {
    internalLayers: [
        { id: 'body', type: 'folder', name: 'BODY' },
        { id: 'torso', type: 'raster', name: 'TORSO', parentLayerId: 'body' },
        { id: 'arm', type: 'folder', name: 'ARM', parentLayerId: 'body' },
        { id: 'hand', type: 'raster', name: 'HAND', parentLayerId: 'arm' },
        { id: 'face', type: 'raster', name: 'FACE' }
    ],
    rigDefinition: {
        parts: [{ partId: 'body' }],
        bones: [
            { boneId: 'root' },
            { boneId: 'arm-parent', parentBoneId: 'root' },
            { boneId: 'hand-bone', parentBoneId: 'arm-parent' },
            { boneId: 'loose' }
        ],
        rigidBindings: [{ partId: 'body', boneId: 'root' }]
    },
    meshDefinitions: [{ meshId: 'hand-mesh', targetInternalLayerId: 'hand' }],
    skinBindings: [{
        meshId: 'hand-mesh',
        vertexWeights: [{
            vertexId: 'v1',
            influences: [
                { boneId: 'hand-bone', weight: 1 },
                { boneId: 'loose', weight: 0 }
            ]
        }]
    }]
};
const before = structuredClone(asset);

assert.deepEqual(
    createRigMotionArtFocusProjection(asset, {
        editorMode: 'motion', scope: 'internal', boneId: 'root', targetLayerId: 'body'
    }),
    {
        ok: true,
        active: true,
        connected: true,
        targetConnected: true,
        reason: 'connected',
        rasterLayerIds: ['torso', 'hand']
    },
    '親Boneはrigid対象Folderと子BoneのSkin対象をどちらも動かす'
);
assert.deepEqual(
    createRigMotionArtFocusProjection(asset, {
        editorMode: 'motion', scope: 'internal', boneId: 'hand-bone', targetLayerId: 'hand'
    }).rasterLayerIds,
    ['hand'],
    '子Boneは自分のSkin対象だけを強調する'
);
assert.deepEqual(
    createRigMotionArtFocusProjection(asset, {
        editorMode: 'motion', scope: 'internal', boneId: 'loose', targetLayerId: 'face'
    }),
    {
        ok: true,
        active: true,
        connected: false,
        targetConnected: false,
        reason: 'motion-unconnected-target',
        rasterLayerIds: ['face']
    },
    'weight 0だけの空Boneは未接続Gateを維持しつつ接続予定の絵を表示する'
);
assert.deepEqual(
    createRigMotionArtFocusProjection(asset, {
        editorMode: 'rig', scope: 'internal', boneId: 'loose', targetLayerId: 'face'
    }).rasterLayerIds,
    ['face'],
    'RIG Setup中は未接続でも選択中の絵を配置対象として残す'
);
assert.equal(
    createRigMotionArtFocusProjection(asset, { editorMode: 'motion', scope: 'caf', boneId: 'root' }).active,
    false,
    'CAF全体Motionでは内部絵を減光しない'
);
assert.equal(
    createRigMotionArtFocusProjection(asset, {
        editorMode: 'motion', scope: 'internal', boneId: 'hand-bone', targetLayerId: 'face'
    }).targetConnected,
    false,
    '別Rasterへ接続済みのBoneを現在Rasterの接続済み表示へ流用しない'
);
assert.deepEqual(asset, before, 'focus projectionは保存正本を変更しない');

const source = readFileSync(new URL('../system/animation/rig-motion-art-focus.js', import.meta.url), 'utf8');
assert.doesNotMatch(source, /historyManager|ProjectManager|serialize\s*\(|\.opacity\s*=/);

console.log('verify-rig-motion-art-focus: rigid / skin / descendant / unconnected-target focus OK');
