import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { TRANSFORM_EDIT_AUTHORITY } from '../system/animation/transform-edit-context.js';
import { TRANSFORM_EDIT_TRANSACTION_TARGET } from '../system/animation/transform-edit-transaction.js';
import { sampleClipTransform } from '../system/animation/clip-transform-sampler.js';

globalThis.window = globalThis.window || {};
const { TimelineModel } = await import('../system/animation/animation-data-model.js');
const { AnimationTablePopup } = await import('../ui/animation-table-popup.js');
const { LayerSystem } = await import('../system/layer-system.js');

const fixture = () => new TimelineModel({
    clipAssets: [{ id: 'asset', internalLayers: [
        { id: 'folder', type: 'folder' },
        { id: 'raster', type: 'raster', parentLayerId: 'folder' }
    ] }],
    tracks: [{ id: 'lane', cels: [{ id: 'clip', assetId: 'asset', duration: 4 }] }]
});
const normal = fixture();
assert.equal(normal.preflightClipLayerEffectTarget('clip', 'raster').ok, true);
assert.equal(normal.preflightClipFolderTransformTarget('clip', 'folder').ok, true);
assert.equal(normal.preflightClipRasterSourceTransformTarget('clip', 'raster').ok, true);

const deform = fixture();
deform.getClipAsset('asset').meshDefinitions = [{
    meshId: 'mesh', targetInternalLayerId: 'raster'
}];
for (const [check, target] of [
    ['preflightClipLayerEffectTarget', 'raster'],
    ['preflightClipFolderTransformTarget', 'folder'],
    ['preflightClipRasterSourceTransformTarget', 'raster']
]) {
    assert.equal(deform[check]('clip', target).reason, 'mesh-layer-unsupported',
        `${check} rejects the DEFORM Mesh target`);
}

const part = fixture();
assert.equal(part.registerClipAssetRigPart('asset', 'folder').ok, true);
for (const [check, target] of [
    ['preflightClipLayerEffectTarget', 'raster'],
    ['preflightClipFolderTransformTarget', 'folder'],
    ['preflightClipRasterSourceTransformTarget', 'raster']
]) {
    assert.equal(part[check]('clip', target).reason, 'rig-part-layer-unsupported',
        `${check} rejects the PART-owned target`);
}

// Clip-wide keys remain outside the internal ownership guard for both RIG kinds.
for (const model of [normal, deform, part]) {
    assert.equal(model.setClipTransformKeyframes('clip', [{
        frame: 0, x: 7, y: 9, scaleX: 1.2, scaleY: 0.8, rotation: 0.3,
        pivotX: 0, pivotY: 0
    }]).ok, true);
    const transform = sampleClipTransform(model.findClipEntry('clip').clip, 0);
    assert.deepEqual([transform.x, transform.y, transform.scaleX,
        transform.scaleY, transform.rotation], [7, 9, 1.2, 0.8, 0.3]);
}

const bridge = (model, authority, selectedLayerId) => {
    const popup = Object.create(AnimationTablePopup.prototype);
    popup.model = model;
    popup.selectedCelId = 'clip';
    popup.layerSystem = { getActiveLayer: () => ({ layerData: {
        id: 'working', isAnimationWorkingLayer: true
    } }) };
    popup.getTransformEditContext = () => ({
        authority, clipId: 'clip', internalLayerId: 'raster', folderLayerId: 'folder'
    });
    popup.canEditSelectedWorkingLayer = () => true;
    popup._resolveInternalLayerIdForWorkingLayer = () => selectedLayerId;
    popup._resolveWorkingLayerIdForInternalLayer = () => 'working';
    return popup._projectLayerTransformBridgeStart({ layerId: 'working' });
};
for (const [model, expected] of [[deform, 'mesh-layer-unsupported'],
    [part, 'rig-part-layer-unsupported']]) {
    assert.equal(bridge(model, TRANSFORM_EDIT_AUTHORITY.CLIP_LAYER_TRANSFORM_KEY, 'raster').reason,
        expected, 'internal Raster ANIMATE is blocked before the gesture');
    assert.equal(bridge(model, TRANSFORM_EDIT_AUTHORITY.CLIP_FOLDER_TRANSFORM_KEY, 'raster').reason,
        expected, 'Folder ANIMATE is blocked before the gesture');
    assert.equal(bridge(model, TRANSFORM_EDIT_AUTHORITY.LAYER_SOURCE, 'raster').reason,
        expected, 'working Raster SOURCE bake is blocked before the gesture');
}

const availability = (result, isAnimationWorkingLayer = true) => {
    const layerSystem = Object.create(LayerSystem.prototype);
    layerSystem.getActiveLayer = () => ({ layerData: {
        id: 'working', isAnimationWorkingLayer
    } });
    layerSystem._transformEditAdapter = { canStart: () => result };
    return layerSystem;
};
assert.equal(availability({ ok: true, transaction: {
    target: TRANSFORM_EDIT_TRANSACTION_TARGET.CLIP_TRANSFORM_KEY
} }).canStartTransformEditSession(), true, 'Clip-wide ANIMATE stays available');
assert.equal(availability({ ok: true, transaction: {
    target: TRANSFORM_EDIT_TRANSACTION_TARGET.LAYER_SOURCE
} }, false).canStartTransformEditSession(), true, 'normal SOURCE stays available');
const blockedLayer = availability({ ok: false, reason: 'mesh-layer-unsupported' });
assert.equal(blockedLayer.canStartTransformEditSession(), false);
assert.equal(blockedLayer.getTransformEditStartAvailability().reason, 'mesh-layer-unsupported');

const root = path.dirname(fileURLToPath(import.meta.url));
const frameSource = fs.readFileSync(path.join(root, '../ui/right-workspace-frame.js'), 'utf8');
assert.match(frameSource, /transformModeButton\.disabled = !active && !!transformBlockMessage/u);
assert.match(frameSource, /transformModeButton\.title = transformBlockMessage/u);
assert.match(frameSource, /mesh-layer-unsupported[\s\S]*rig-part-layer-unsupported/u);

console.log('PASS: normal and Clip-wide Transform remain available; DEFORM/PART internal, Folder and SOURCE entries are blocked with model reasons');
