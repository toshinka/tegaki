/**
 * CAF internal Layerのclipping owner/source/Folder子孫解決を共有する。
 * preview、Frame compositor、animation working Layer表示だけが利用し、
 * TimelineModel正本や通常LayerSystemのHistoryは統合しない。
 */
import { CLIPPING_MODES, getClippingMode } from '../clipping-mode.js';

export function findInternalClippingOwner(asset, layer) {
    if (!asset || !layer) return null;
    const byId = new Map((asset.internalLayers || []).map(item => [item.id, item]));
    let current = layer;
    const visited = new Set();
    while (current && !visited.has(current.id)) {
        visited.add(current.id);
        if (getClippingMode(current) !== CLIPPING_MODES.NONE) return current;
        current = current.parentLayerId ? byId.get(current.parentLayerId) : null;
    }
    return null;
}

export function findInternalClippingSource(asset, owner, isEffectivelyVisible = null) {
    if (!asset || !owner) return null;
    const layers = asset.internalLayers || [];
    const ownerIndex = layers.findIndex(item => item.id === owner.id);
    if (ownerIndex < 0) return null;
    const parentId = owner.parentLayerId || null;
    for (let index = ownerIndex + 1; index < layers.length; index++) {
        const candidate = layers[index];
        if (!candidate || (candidate.parentLayerId || null) !== parentId) continue;
        return !isEffectivelyVisible || isEffectivelyVisible(candidate) ? candidate : null;
    }
    return null;
}

export function getInternalFolderRasterDescendants(asset, folderId) {
    const layers = asset?.internalLayers || [];
    const result = [];
    const collect = parentId => {
        layers.forEach(layer => {
            if ((layer.parentLayerId || null) !== parentId) return;
            if (layer.type === 'folder') collect(layer.id);
            else if (layer.isBackground !== true) result.push(layer);
        });
    };
    collect(folderId);
    return result;
}

export function resolveInternalClippingContract(asset, layer, isEffectivelyVisible = null) {
    const owner = findInternalClippingOwner(asset, layer);
    if (!owner) return null;
    const source = findInternalClippingSource(asset, owner, isEffectivelyVisible);
    const sourceLayers = source?.type === 'folder'
        ? getInternalFolderRasterDescendants(asset, source.id)
        : (source ? [source] : []);
    return {
        owner,
        source,
        sourceLayers,
        mode: getClippingMode(owner)
    };
}
