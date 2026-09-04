import assert from 'node:assert/strict';

import {
    preflightInternalLayerReparent,
    simulateInternalLayerReparent
} from '../system/animation/internal-layer-reparent-gate.js';
import { createWarpGridDeformer } from '../system/animation/warp-grid-deformer.js';

const folder = (id, parentLayerId = null, extra = {}) => ({
    id,
    name: id,
    type: 'folder',
    parentLayerId,
    visible: true,
    clippingMode: 'none',
    ...extra
});
const raster = (id, parentLayerId = null, extra = {}) => ({
    id,
    name: id,
    type: 'raster',
    parentLayerId,
    visible: true,
    isBackground: false,
    clippingMode: 'none',
    ...extra
});
const rigDefinition = partIds => ({
    version: 1,
    parts: partIds.map(partId => ({
        partId,
        parentPartId: null,
        bindTransform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, pivotX: 0, pivotY: 0 }
    }))
});
const unchanged = (asset, clips, action) => {
    const before = JSON.stringify({ asset, clips });
    const result = action();
    assert.equal(JSON.stringify({ asset, clips }), before, `${result.reason} must not mutate input`);
    return result;
};

const partFolder = folder('part-folder');
const partRaster = raster('part-raster', partFolder.id);
const ordinaryFolder = folder('ordinary-folder');
const ordinaryRaster = raster('ordinary-raster', ordinaryFolder.id);
const secondFolder = folder('second-folder');
const rootRasterPart = raster('root-raster-part');
const rootSibling = raster('root-sibling');
const baseAsset = {
    id: 'gate-asset',
    internalLayers: [
        partFolder,
        partRaster,
        ordinaryFolder,
        ordinaryRaster,
        secondFolder,
        rootRasterPart,
        rootSibling
    ],
    rigDefinition: rigDefinition([partFolder.id, rootRasterPart.id])
};

const reorder = unchanged(baseAsset, [], () => preflightInternalLayerReparent({
    asset: baseAsset,
    layerId: rootRasterPart.id,
    targetLayerId: rootSibling.id,
    placement: 'after'
}));
assert.equal(reorder.ok, true);
assert.equal(reorder.reason, 'same-parent-reorder');
assert.equal(reorder.simulation.nextParentLayerId, null);

const displayOnly = unchanged(baseAsset, [], () => preflightInternalLayerReparent({
    asset: baseAsset,
    layerId: ordinaryRaster.id,
    targetLayerId: secondFolder.id,
    placement: 'inside'
}));
assert.equal(displayOnly.ok, true, 'unrigged Raster may move between ordinary Folders');
assert.equal(displayOnly.reason, 'display-only');
assert.equal(displayOnly.simulation.nextParentLayerId, secondFolder.id);

const rootRasterReject = unchanged(baseAsset, [], () => preflightInternalLayerReparent({
    asset: baseAsset,
    layerId: rootRasterPart.id,
    targetLayerId: ordinaryFolder.id,
    placement: 'inside'
}));
assert.equal(rootRasterReject.ok, false);
assert.equal(rootRasterReject.reason, 'raster-part-root-required');

const enterPartReject = unchanged(baseAsset, [], () => preflightInternalLayerReparent({
    asset: baseAsset,
    layerId: ordinaryRaster.id,
    targetLayerId: partFolder.id,
    placement: 'inside'
}));
assert.equal(enterPartReject.reason, 'rig-render-owner-change');
assert.equal(enterPartReject.beforePartId, null);
assert.equal(enterPartReject.afterPartId, partFolder.id);

const leavePartReject = unchanged(baseAsset, [], () => preflightInternalLayerReparent({
    asset: baseAsset,
    layerId: partRaster.id,
    targetLayerId: ordinaryFolder.id,
    placement: 'inside'
}));
assert.equal(leavePartReject.reason, 'rig-render-owner-change');

const folderPartDisplayMove = unchanged(baseAsset, [], () => preflightInternalLayerReparent({
    asset: baseAsset,
    layerId: partFolder.id,
    targetLayerId: secondFolder.id,
    placement: 'inside'
}));
assert.equal(folderPartDisplayMove.ok, true, 'Folder Part may move when its exclusive island is unchanged');
assert.equal(folderPartDisplayMove.reason, 'display-only');

const warpFolder = folder('warp-folder');
const warpRaster = raster('warp-raster', warpFolder.id);
const warpCandidate = raster('warp-candidate');
const warpAsset = {
    id: 'warp-gate-asset',
    internalLayers: [warpFolder, warpRaster, warpCandidate],
    rigDefinition: null
};
const clips = [
    { id: 'clip-without-warp', assetId: warpAsset.id },
    {
        id: 'clip-with-warp',
        assetId: warpAsset.id,
        folderDeformers: {
            version: 1,
            targets: [{
                folderLayerId: warpFolder.id,
                deformer: createWarpGridDeformer()
            }]
        }
    }
];
const warpReject = unchanged(warpAsset, clips, () => preflightInternalLayerReparent({
    asset: warpAsset,
    clips,
    layerId: warpCandidate.id,
    targetLayerId: warpFolder.id,
    placement: 'inside'
}));
assert.equal(warpReject.reason, 'folder-warp-scope-change');
assert.equal(warpReject.clipId, 'clip-with-warp', 'all ClipInstances are inspected');
assert.equal(preflightInternalLayerReparent({
    asset: warpAsset,
    clips: [{ ...clips[1], id: 'foreign-clip', assetId: 'another-asset' }],
    layerId: warpCandidate.id,
    targetLayerId: warpFolder.id,
    placement: 'inside'
}).reason, 'display-only', 'foreign Asset clips do not affect the Gate');

const clippingTarget = raster('clipping-target', null, { clippingMode: 'normal' });
const clippingSource = raster('clipping-source');
const clippingFolder = folder('clipping-folder');
const clippingAsset = {
    id: 'clipping-gate-asset',
    internalLayers: [clippingTarget, clippingSource, clippingFolder],
    rigDefinition: null
};
const clippingReject = unchanged(clippingAsset, [], () => preflightInternalLayerReparent({
    asset: clippingAsset,
    layerId: clippingTarget.id,
    targetLayerId: clippingFolder.id,
    placement: 'inside'
}));
assert.equal(clippingReject.reason, 'clipping-contract-change');
assert.equal(preflightInternalLayerReparent({
    asset: clippingAsset,
    layerId: clippingTarget.id,
    targetLayerId: clippingSource.id,
    placement: 'after'
}).reason, 'same-parent-reorder', 'normal same-parent clipping reorder is not over-blocked');

const meshRaster = raster('mesh-raster');
const meshPartFolder = folder('mesh-part-folder');
const meshAsset = {
    id: 'mesh-gate-asset',
    internalLayers: [meshPartFolder, meshRaster],
    rigDefinition: rigDefinition([meshPartFolder.id]),
    meshDefinitions: [{ meshId: 'mesh', targetInternalLayerId: meshRaster.id }]
};
const meshReject = unchanged(meshAsset, [], () => preflightInternalLayerReparent({
    asset: meshAsset,
    layerId: meshRaster.id,
    targetLayerId: meshPartFolder.id,
    placement: 'inside'
}));
assert.equal(meshReject.reason, 'rig-mode-conflict');

const descendantReject = unchanged(baseAsset, [], () => simulateInternalLayerReparent(
    baseAsset,
    partFolder.id,
    partRaster.id,
    'inside'
));
assert.equal(descendantReject.reason, 'cannot-drop-on-descendant');
assert.equal(
    simulateInternalLayerReparent(baseAsset, 'missing', rootSibling.id, 'after').reason,
    'layer-not-found'
);
assert.equal(
    simulateInternalLayerReparent(baseAsset, rootSibling.id, 'missing', 'after').reason,
    'layer-not-found'
);

globalThis.window = {};
const { TimelineModel } = await import('../system/animation/animation-data-model.js');
const adapterModel = new TimelineModel({
    clipAssets: [warpAsset],
    tracks: [{
        id: 'adapter-lane',
        cels: clips
    }]
});
const adapterBefore = JSON.stringify(adapterModel.serialize());
const adapterResult = adapterModel.preflightClipAssetInternalLayerReparent(
    warpAsset.id,
    warpCandidate.id,
    warpFolder.id,
    'inside'
);
assert.equal(adapterResult.reason, 'folder-warp-scope-change');
assert.equal(adapterModel.getClipInstancesForAsset(warpAsset.id).length, 2);
assert.equal(JSON.stringify(adapterModel.serialize()), adapterBefore, 'TimelineModel adapter is read-only');

console.log(
    'verify-rigged-internal-layer-reparent-gate: same-parent reorder, display-only move, '
    + 'Root Raster/Part/WARP/clipping/Mesh rejection, all-Clip scan, non-mutation OK'
);
