/**
 * Rig Partが所有するCAF internal Layer targetを保存fieldなしで分類するpure helper。
 * Folderは既存subtree Part、CAF直下Rasterは一枚だけのLeaf Partとして扱う。
 */

function findInternalLayer(asset, partId) {
    return (Array.isArray(asset?.internalLayers) ? asset.internalLayers : [])
        .find(layer => layer?.id === partId) || null;
}

function hasRasterMeshTarget(asset, layerId) {
    return (Array.isArray(asset?.meshDefinitions) ? asset.meshDefinitions : [])
        .some(mesh => mesh?.targetInternalLayerId === layerId);
}

export function resolveRigPartTarget(asset, partId) {
    if (typeof partId !== 'string' || partId.length === 0) {
        return { ok: false, reason: 'invalid-part-id', partId, layer: null, targetKind: null };
    }
    const layer = findInternalLayer(asset, partId);
    if (!layer) {
        return { ok: false, reason: 'part-target-not-found', partId, layer: null, targetKind: null };
    }
    if (layer.type === 'folder') {
        return { ok: true, reason: null, partId, layer, targetKind: 'folder' };
    }
    if (layer.type !== 'raster') {
        return { ok: false, reason: 'part-target-type-unsupported', partId, layer, targetKind: null };
    }
    if (layer.isBackground === true) {
        return { ok: false, reason: 'part-target-background-unsupported', partId, layer, targetKind: null };
    }
    if (layer.parentLayerId != null) {
        return { ok: false, reason: 'raster-part-root-required', partId, layer, targetKind: null };
    }
    if (hasRasterMeshTarget(asset, layer.id)) {
        return { ok: false, reason: 'rig-mode-conflict', partId, layer, targetKind: null };
    }
    return { ok: true, reason: null, partId, layer, targetKind: 'raster' };
}
