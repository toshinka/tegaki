import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
    createRigAuthoringStatusProjection,
    RIG_AUTHORING_STATUS
} from '../system/animation/rig-authoring-status-projection.js';

const raster = { id: 'raster', type: 'raster', parentLayerId: null };
const childRaster = { id: 'child', type: 'raster', parentLayerId: 'folder' };
const folder = { id: 'folder', type: 'folder', parentLayerId: null };
const background = { id: 'background', type: 'raster', isBackground: true };
const baseAsset = {
    internalLayers: [raster, folder, childRaster, background],
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

const bendAsset = structuredClone(baseAsset);
bendAsset.meshDefinitions.push({ meshId: 'mesh', targetInternalLayerId: 'raster' });
bendAsset.skinBindings.push({ meshId: 'mesh', vertexWeights: [] });
const bend = createRigAuthoringStatusProjection(bendAsset, 'raster', { meshState: 'current' });
assert.equal(bend.status, RIG_AUTHORING_STATUS.BEND);
assert.equal(bend.hasSkinBinding, true);
assert.equal(
    createRigAuthoringStatusProjection(bendAsset, 'raster', { meshState: 'stale' }).status,
    RIG_AUTHORING_STATUS.STALE
);

const conflictAsset = structuredClone(bendAsset);
conflictAsset.rigDefinition.parts.push({ partId: 'raster' });
assert.equal(
    createRigAuthoringStatusProjection(conflictAsset, 'raster', { meshState: 'stale' }).status,
    RIG_AUTHORING_STATUS.CONFLICT,
    'conflict takes precedence over stale'
);

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
