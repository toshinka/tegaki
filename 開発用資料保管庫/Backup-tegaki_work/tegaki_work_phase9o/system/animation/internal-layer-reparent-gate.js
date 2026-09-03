/**
 * CAF internal Layerの表示階層移動をmutation前に検査するpure Gate。
 * 表示親をRig親へ同期せず、移動前後の実効Part / Folder WARP / clipping所属だけを比較する。
 */

import { normalizeClipFolderDeformers } from './clip-deformer.js';
import { resolveInternalClippingContract } from './internal-layer-clipping-contract.js';

function normalizedParentId(layer) {
    return layer?.parentLayerId || null;
}

function collectSubtreeIds(layers, rootLayerId) {
    const ids = new Set([rootLayerId]);
    let changed = true;
    while (changed) {
        changed = false;
        layers.forEach(layer => {
            if (layer?.parentLayerId && ids.has(layer.parentLayerId) && !ids.has(layer.id)) {
                ids.add(layer.id);
                changed = true;
            }
        });
    }
    return ids;
}

function normalizePlacement(targetLayer, placement) {
    if (placement === 'inside' && targetLayer?.type === 'folder') return 'inside';
    return placement === 'before' ? 'before' : 'after';
}

/** 現行D&Dと同じparent/order結果をclone上に構築する。入力assetは変更しない。 */
export function simulateInternalLayerReparent(asset, layerId, targetLayerId, placement = 'after') {
    const sourceLayers = Array.isArray(asset?.internalLayers) ? asset.internalLayers : [];
    if (!layerId || !targetLayerId || layerId === targetLayerId) {
        return { ok: false, reason: 'invalid-target' };
    }
    const sourceLayer = sourceLayers.find(layer => layer?.id === layerId) || null;
    const targetLayer = sourceLayers.find(layer => layer?.id === targetLayerId) || null;
    if (!sourceLayer || !targetLayer) return { ok: false, reason: 'layer-not-found' };

    const movingIds = collectSubtreeIds(sourceLayers, layerId);
    if (movingIds.has(targetLayerId)) {
        return { ok: false, reason: 'cannot-drop-on-descendant' };
    }

    const layers = sourceLayers.map(layer => ({ ...layer }));
    const movingLayer = layers.find(layer => layer.id === layerId);
    const clonedTarget = layers.find(layer => layer.id === targetLayerId);
    const nextPlacement = normalizePlacement(clonedTarget, placement);
    const movedLayers = layers.filter(layer => movingIds.has(layer.id));
    const remainingLayers = layers.filter(layer => !movingIds.has(layer.id));
    const targetIndex = remainingLayers.findIndex(layer => layer.id === targetLayerId);
    if (targetIndex < 0) return { ok: false, reason: 'target-not-found' };

    const previousParentLayerId = normalizedParentId(movingLayer);
    const nextParentLayerId = nextPlacement === 'inside'
        ? clonedTarget.id
        : normalizedParentId(clonedTarget);
    movingLayer.parentLayerId = nextParentLayerId;

    let insertIndex = targetIndex;
    if (nextPlacement === 'after' || nextPlacement === 'inside') {
        const targetSubtreeIds = collectSubtreeIds(remainingLayers, targetLayerId);
        insertIndex = targetIndex + 1;
        for (let index = targetIndex + 1; index < remainingLayers.length; index++) {
            if (!targetSubtreeIds.has(remainingLayers[index].id)) break;
            insertIndex = index + 1;
        }
    }
    remainingLayers.splice(insertIndex, 0, ...movedLayers);
    return {
        ok: true,
        reason: null,
        placement: nextPlacement,
        previousParentLayerId,
        nextParentLayerId,
        index: insertIndex,
        movingIds,
        asset: { ...asset, internalLayers: remainingLayers },
        layers: remainingLayers
    };
}

function getAncestorOwnerId(asset, layer, targetIds) {
    const layerById = new Map((asset?.internalLayers || []).map(item => [item?.id, item]));
    let current = layer || null;
    const visited = new Set();
    while (current?.id && !visited.has(current.id)) {
        visited.add(current.id);
        if (targetIds.has(current.id)) return current.id;
        current = current.parentLayerId ? layerById.get(current.parentLayerId) || null : null;
    }
    return null;
}

function getPartOwnerByRasterId(asset) {
    const partIds = new Set((asset?.rigDefinition?.parts || [])
        .map(part => part?.partId)
        .filter(Boolean));
    return new Map((asset?.internalLayers || [])
        .filter(layer => layer?.type === 'raster' && layer.isBackground !== true)
        .map(layer => [layer.id, getAncestorOwnerId(asset, layer, partIds)]));
}

function getFolderWarpOwnersByRasterId(asset, clips) {
    const result = new Map();
    const rasters = (asset?.internalLayers || [])
        .filter(layer => layer?.type === 'raster' && layer.isBackground !== true);
    (Array.isArray(clips) ? clips : []).forEach((clip, clipIndex) => {
        if (clip?.assetId && asset?.id && clip.assetId !== asset.id) return;
        const targetIds = new Set((normalizeClipFolderDeformers(clip?.folderDeformers)?.targets || [])
            .map(target => target?.folderLayerId)
            .filter(Boolean));
        if (targetIds.size === 0) return;
        const clipId = clip?.id || `clip-${clipIndex}`;
        rasters.forEach(layer => {
            result.set(`${clipId}\u0000${layer.id}`, getAncestorOwnerId(asset, layer, targetIds));
        });
    });
    return result;
}

function clippingContractSignature(asset, layer) {
    const contract = resolveInternalClippingContract(asset, layer);
    if (!contract) return null;
    return JSON.stringify({
        ownerLayerId: contract.owner?.id || null,
        sourceLayerId: contract.source?.id || null,
        sourceLayerIds: (contract.sourceLayers || []).map(source => source?.id).filter(Boolean),
        mode: contract.mode || null
    });
}

function getClippingContractsByRasterId(asset) {
    return new Map((asset?.internalLayers || [])
        .filter(layer => layer?.type === 'raster' && layer.isBackground !== true)
        .map(layer => [layer.id, clippingContractSignature(asset, layer)]));
}

function firstMapDifference(before, after) {
    const keys = new Set([...before.keys(), ...after.keys()]);
    for (const key of keys) {
        if ((before.get(key) ?? null) !== (after.get(key) ?? null)) {
            return { key, before: before.get(key) ?? null, after: after.get(key) ?? null };
        }
    }
    return null;
}

/**
 * @returns {{ok:boolean, reason:string, kind?:string, simulation?:object}}
 */
export function preflightInternalLayerReparent({
    asset,
    clips = [],
    layerId,
    targetLayerId,
    placement = 'after'
} = {}) {
    if (!asset) return { ok: false, reason: 'asset-not-found' };
    const simulation = simulateInternalLayerReparent(asset, layerId, targetLayerId, placement);
    if (!simulation.ok) return simulation;

    if (simulation.previousParentLayerId === simulation.nextParentLayerId) {
        return {
            ok: true,
            reason: 'same-parent-reorder',
            kind: 'same-parent-reorder',
            simulation
        };
    }

    const afterAsset = simulation.asset;
    const afterLayerById = new Map(afterAsset.internalLayers.map(layer => [layer.id, layer]));
    for (const part of asset.rigDefinition?.parts || []) {
        const target = afterLayerById.get(part?.partId) || null;
        if (target?.type === 'raster' && normalizedParentId(target) !== null) {
            return {
                ok: false,
                reason: 'raster-part-root-required',
                partId: part.partId,
                simulation
            };
        }
    }

    const beforePartOwners = getPartOwnerByRasterId(asset);
    const afterPartOwners = getPartOwnerByRasterId(afterAsset);
    const partDifference = firstMapDifference(beforePartOwners, afterPartOwners);
    if (partDifference) {
        const meshTargetIds = new Set((asset.meshDefinitions || [])
            .map(mesh => mesh?.targetInternalLayerId)
            .filter(Boolean));
        if (meshTargetIds.has(partDifference.key) && partDifference.after !== null) {
            return {
                ok: false,
                reason: 'rig-mode-conflict',
                rasterLayerId: partDifference.key,
                beforePartId: partDifference.before,
                afterPartId: partDifference.after,
                simulation
            };
        }
        return {
            ok: false,
            reason: 'rig-render-owner-change',
            rasterLayerId: partDifference.key,
            beforePartId: partDifference.before,
            afterPartId: partDifference.after,
            simulation
        };
    }

    const warpDifference = firstMapDifference(
        getFolderWarpOwnersByRasterId(asset, clips),
        getFolderWarpOwnersByRasterId(afterAsset, clips)
    );
    if (warpDifference) {
        const separatorIndex = warpDifference.key.indexOf('\u0000');
        return {
            ok: false,
            reason: 'folder-warp-scope-change',
            clipId: warpDifference.key.slice(0, separatorIndex),
            rasterLayerId: warpDifference.key.slice(separatorIndex + 1),
            beforeFolderLayerId: warpDifference.before,
            afterFolderLayerId: warpDifference.after,
            simulation
        };
    }

    const clippingDifference = firstMapDifference(
        getClippingContractsByRasterId(asset),
        getClippingContractsByRasterId(afterAsset)
    );
    if (clippingDifference) {
        return {
            ok: false,
            reason: 'clipping-contract-change',
            rasterLayerId: clippingDifference.key,
            beforeContract: clippingDifference.before,
            afterContract: clippingDifference.after,
            simulation
        };
    }

    return {
        ok: true,
        reason: 'display-only',
        kind: 'display-only',
        simulation
    };
}
