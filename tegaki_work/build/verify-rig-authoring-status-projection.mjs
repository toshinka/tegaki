import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
    createRigAuthoringStatusProjection,
    RIG_AUTHORING_STATUS
} from '../system/animation/rig-authoring-status-projection.js';

const raster = { id: 'raster', type: 'raster', parentLayerId: null };
const childRaster = { id: 'child', type: 'raster', parentLayerId: 'folder' };
const folder = { id: 'folder', type: 'folder', parentLayerId: null };
const childFolder = { id: 'child-folder', name: '腕', type: 'folder', parentLayerId: 'folder' };
const background = { id: 'background', type: 'raster', isBackground: true };
const baseAsset = {
    internalLayers: [raster, folder, childFolder, childRaster, background],
    rigDefinition: { parts: [], bones: [], rigidBindings: [] },
    meshDefinitions: [],
    skinBindings: []
};

assert.equal(
    createRigAuthoringStatusProjection(baseAsset, 'raster').status,
    RIG_AUTHORING_STATUS.NONE,
    'unconfigured root Raster is none'
);
assert.equal(
    createRigAuthoringStatusProjection(baseAsset, 'raster').bendSetup?.state,
    'bone-missing',
    'a Raster without an unbound Bone starts from BONE creation'
);
assert.equal(
    createRigAuthoringStatusProjection(baseAsset, 'background').isEligibleTarget,
    false,
    'background is not a RIG authoring target'
);

const parentAsset = structuredClone(baseAsset);
parentAsset.rigDefinition.parts.push({ partId: 'folder' });
assert.equal(createRigAuthoringStatusProjection(parentAsset, 'folder').status, RIG_AUTHORING_STATUS.PARENT);

const wholeAsset = structuredClone(baseAsset);
wholeAsset.rigDefinition.parts.push({ partId: 'raster' });
wholeAsset.rigDefinition.bones.push({ boneId: 'root', parentBoneId: null });
wholeAsset.rigDefinition.rigidBindings.push({ partId: 'raster', boneId: 'root' });
const whole = createRigAuthoringStatusProjection(wholeAsset, 'raster');
assert.equal(whole.status, RIG_AUTHORING_STATUS.WHOLE);
assert.equal(whole.hasRootBoneBinding, true);
assert.equal(whole.parentLinkState, 'root');

const linkedAsset = structuredClone(baseAsset);
linkedAsset.internalLayers.find(layer => layer.id === 'folder').name = '体';
linkedAsset.rigDefinition.parts.push({ partId: 'folder' }, { partId: 'child-folder' });
linkedAsset.rigDefinition.bones.push(
    { boneId: 'body-bone', name: 'BODY', parentBoneId: null },
    { boneId: 'arm-bone', name: 'ARM', parentBoneId: 'body-bone' }
);
linkedAsset.rigDefinition.rigidBindings.push(
    { partId: 'folder', boneId: 'body-bone' },
    { partId: 'child-folder', boneId: 'arm-bone' }
);
const linked = createRigAuthoringStatusProjection(linkedAsset, 'child-folder');
assert.equal(linked.hasRootBoneBinding, true, 'a Part-bound Bone remains configured after parent linking');
assert.equal(linked.boundBone?.boneId, 'arm-bone');
assert.equal(linked.parentLinkState, 'linked');
assert.equal(linked.parentBone?.boneId, 'body-bone');
assert.equal(linked.parentLayer?.name, '体');

const brokenAsset = structuredClone(linkedAsset);
brokenAsset.rigDefinition.bones.find(bone => bone.boneId === 'arm-bone').parentBoneId = 'missing-bone';
const broken = createRigAuthoringStatusProjection(brokenAsset, 'child-folder');
assert.equal(broken.hasRootBoneBinding, true, 'a broken parent reference does not masquerade as a missing PIVOT');
assert.equal(broken.parentLinkState, 'broken');

const boneCandidateAsset = structuredClone(baseAsset);
boneCandidateAsset.rigDefinition.bones.push({ boneId: 'mesh-bone', name: 'MESH BONE', parentBoneId: null });
const boneCandidate = createRigAuthoringStatusProjection(boneCandidateAsset, 'raster');
assert.equal(boneCandidate.bendSetup?.state, 'bone-ready');
assert.equal(boneCandidate.bendSetup?.boneState, 'candidate', 'pre-Mesh Bone stays a candidate, not target-owned');
assert.equal(boneCandidate.bendSetup?.nextActionLabel, 'Meshを作成');

const bendAsset = structuredClone(boneCandidateAsset);
bendAsset.meshDefinitions.push({
    meshId: 'mesh',
    targetInternalLayerId: 'raster',
    generator: { type: 'alpha-fit-grid-v1' }
});
bendAsset.skinBindings.push({
    meshId: 'mesh',
    vertexWeights: [{ vertexId: 'v1', influences: [{ boneId: 'mesh-bone', weight: 1 }] }]
});
const bend = createRigAuthoringStatusProjection(bendAsset, 'raster', { meshState: 'current' });
assert.equal(bend.status, RIG_AUTHORING_STATUS.BEND);
assert.equal(bend.hasSkinBinding, true);
assert.equal(bend.bendSetup?.state, 'ready');
assert.equal(bend.bendSetup?.boneState, 'connected');
assert.equal(bend.bendSetup?.meshGeneratorLabel, 'GRID');
assert.equal(bend.bendSetup?.weightState, 'connected');
assert.equal(bend.bendSetup?.nextActionLabel, 'Weightを確認');
assert.equal(
    createRigAuthoringStatusProjection(bendAsset, 'raster', { meshState: 'stale' }).status,
    RIG_AUTHORING_STATUS.STALE
);
assert.equal(
    createRigAuthoringStatusProjection(bendAsset, 'raster', { meshState: 'stale' }).bendSetup?.nextActionLabel,
    'Meshを更新'
);

const unboundMeshAsset = structuredClone(boneCandidateAsset);
unboundMeshAsset.meshDefinitions.push({ meshId: 'mesh', targetInternalLayerId: 'raster' });
const unboundMesh = createRigAuthoringStatusProjection(unboundMeshAsset, 'raster', { meshState: 'manual' });
assert.equal(unboundMesh.bendSetup?.state, 'mesh-unbound');
assert.equal(unboundMesh.bendSetup?.weightState, 'missing');

const conflictAsset = structuredClone(bendAsset);
conflictAsset.rigDefinition.parts.push({ partId: 'raster' });
const conflict = createRigAuthoringStatusProjection(conflictAsset, 'raster', { meshState: 'stale' });
assert.equal(
    conflict.status,
    RIG_AUTHORING_STATUS.CONFLICT,
    'conflict takes precedence over stale'
);
assert.equal(conflict.bendSetup?.state, 'conflict');

const renderer = await readFile(new URL('../ui/layer-panel-renderer.js', import.meta.url), 'utf8');
const css = await readFile(new URL('../styles/main.css', import.meta.url), 'utf8');
assert.match(renderer, /createRigAuthoringStatusProjection\(asset, layer\?\.id, \{ meshStatus \}\)/u,
    'Layer mirror uses the shared projection with model-derived Mesh freshness');
assert.match(renderer, /rigBadge\.dataset\.rigStatus = options\.rigStatus \|\| 'none'/u,
    'Layer badge exposes the shared status without creating saved state');
assert.match(renderer, /rigBadgeLabel \|\| 'RIG'/u,
    'Layer badge renders the projected method label');
assert.match(css, /data-rig-status="stale"[\s\S]*?data-rig-status="conflict"/u,
    'stale and conflict keep explicit semantic warning treatment');

console.log('verify-rig-authoring-status-projection: none / parent / bend / whole / conflict / stale and shared Layer badge projection OK');
