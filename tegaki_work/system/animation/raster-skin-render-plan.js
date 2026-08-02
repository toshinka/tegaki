/**
 * static Raster Meshを既存Bone Poseとtriangle adapterへ接続する共有render plan。
 * preview / compositorは同じ評価済み頂点と保存triangle順を消費する。
 */

import { getClippingMode, CLIPPING_MODES } from '../clipping-mode.js';
import { normalizeRasterBounds, unionRasterBounds } from '../raster-bounds.js';
import {
    findInternalClippingOwner,
    findInternalClippingSource,
    getInternalFolderRasterDescendants
} from './internal-layer-clipping-contract.js';
import { evaluateRasterBoneSkinning } from './raster-bone-skinning.js';
import { warpRgbaWithTriangles } from './warp-grid-rasterizer.js';

function createEmptyPlan(status = 'none', errors = []) {
    return {
        kind: 'raster-skin',
        status,
        errors,
        resultByLayerId: new Map(),
        meshResults: []
    };
}

function collectClippingRasterIds(asset) {
    const ids = new Set();
    for (const layer of asset?.internalLayers || []) {
        if (!layer || getClippingMode(layer) === CLIPPING_MODES.NONE) continue;
        const owner = findInternalClippingOwner(asset, layer);
        if (owner?.type === 'raster') ids.add(owner.id);
        if (owner?.type === 'folder') {
            getInternalFolderRasterDescendants(asset, owner.id).forEach(item => ids.add(item.id));
        }
        const source = owner ? findInternalClippingSource(asset, owner) : null;
        if (source?.type === 'raster') ids.add(source.id);
        if (source?.type === 'folder') {
            getInternalFolderRasterDescendants(asset, source.id).forEach(item => ids.add(item.id));
        }
    }
    return ids;
}

function getActiveEffectLayerIds(folderEffectPlan) {
    const ids = new Set();
    if (folderEffectPlan?.status !== 'ready') return ids;
    (folderEffectPlan.islands || []).forEach(island => {
        island?.layerIds?.forEach?.(layerId => ids.add(layerId));
    });
    const rigPlan = folderEffectPlan.rigRenderPlan;
    if (rigPlan?.status === 'ready') {
        (rigPlan.islands || []).forEach(island => {
            island?.layerIds?.forEach?.(layerId => ids.add(layerId));
        });
    }
    return ids;
}

export function createRasterSkinRenderPlan(asset, clip, timelineFrame, options = {}) {
    if (!Array.isArray(asset?.meshDefinitions) || asset.meshDefinitions.length === 0) {
        return createEmptyPlan();
    }
    const evaluation = evaluateRasterBoneSkinning(asset, clip, timelineFrame);
    if (!evaluation.ok) return createEmptyPlan('invalid', evaluation.errors);

    const clippingRasterIds = collectClippingRasterIds(asset);
    const activeEffectLayerIds = getActiveEffectLayerIds(options.folderEffectPlan);
    const errors = [];
    evaluation.meshResults.forEach(result => {
        if (clippingRasterIds.has(result.targetInternalLayerId)) {
            errors.push({
                code: 'raster-skin-clipping-unsupported',
                path: `meshDefinitions.${result.meshId}.targetInternalLayerId`,
                message: `Raster ${result.targetInternalLayerId} participates in internal clipping`
            });
        }
        if (activeEffectLayerIds.has(result.targetInternalLayerId)) {
            errors.push({
                code: 'raster-skin-folder-effect-unsupported',
                path: `meshDefinitions.${result.meshId}.targetInternalLayerId`,
                message: `Raster ${result.targetInternalLayerId} also belongs to an active Folder WARP / rigid RenderIsland`
            });
        }
    });
    if (errors.length > 0) return createEmptyPlan('unsupported', errors);

    const resultByLayerId = new Map();
    evaluation.meshResults.forEach(result => resultByLayerId.set(result.targetInternalLayerId, result));
    return {
        kind: 'raster-skin',
        status: 'ready',
        errors: [],
        resultByLayerId,
        meshResults: evaluation.meshResults
    };
}

/** Project座標頂点を既存triangle adapterのBind bounds正規化pointへ変換する。 */
export function createRasterSkinDeformer(meshResult, sourceBoundsValue) {
    if (!meshResult || !Array.isArray(meshResult.vertices) || meshResult.vertices.length < 3) return null;
    const sourceBounds = normalizeRasterBounds(sourceBoundsValue, { width: 1, height: 1 });
    if (!(sourceBounds.width > 0) || !(sourceBounds.height > 0)) return null;
    const toNormalized = (x, y) => ({
        x: (x - sourceBounds.x) / sourceBounds.width,
        y: (y - sourceBounds.y) / sourceBounds.height
    });
    return {
        type: 'control-mesh',
        bindBounds: sourceBounds,
        bindPoints: meshResult.vertices.map(vertex => toNormalized(vertex.bindX, vertex.bindY)),
        points: meshResult.vertices.map(vertex => toNormalized(vertex.x, vertex.y)),
        triangles: meshResult.triangleIndices.map(triangle => [...triangle]),
        placement: null
    };
}

export function calculateRasterSkinResultBounds(meshResult, sourceBoundsValue) {
    const sourceBounds = normalizeRasterBounds(sourceBoundsValue, { width: 1, height: 1 });
    if (!meshResult?.vertices?.length) return sourceBounds;
    const left = Math.floor(Math.min(...meshResult.vertices.map(vertex => vertex.x)));
    const top = Math.floor(Math.min(...meshResult.vertices.map(vertex => vertex.y)));
    const right = Math.ceil(Math.max(...meshResult.vertices.map(vertex => vertex.x)));
    const bottom = Math.ceil(Math.max(...meshResult.vertices.map(vertex => vertex.y)));
    return unionRasterBounds([
        sourceBounds,
        { x: left, y: top, width: Math.max(1, right - left), height: Math.max(1, bottom - top) }
    ]);
}

export function calculateRasterSkinPlanBounds(plan, getSourceBounds) {
    if (plan?.status !== 'ready') return null;
    return unionRasterBounds(plan.meshResults.map(result => {
        const sourceBounds = getSourceBounds?.(result.targetInternalLayerId);
        return sourceBounds ? calculateRasterSkinResultBounds(result, sourceBounds) : null;
    }));
}

/** CPU / Bake / export用。WARPと同じpremultiplied triangle rasterizerを使う。 */
export function deformRasterSnapshotWithSkin(snapshot, meshResult, options = {}) {
    if (!snapshot?.pixels || !snapshot.width || !snapshot.height) return null;
    const sourceBounds = normalizeRasterBounds(snapshot.rasterBounds, {
        x: 0,
        y: 0,
        width: snapshot.width,
        height: snapshot.height
    });
    const deformer = createRasterSkinDeformer(meshResult, sourceBounds);
    if (!deformer) return null;
    return warpRgbaWithTriangles({
        pixels: snapshot.pixels instanceof Uint8ClampedArray
            ? snapshot.pixels
            : new Uint8ClampedArray(snapshot.pixels),
        width: snapshot.width,
        height: snapshot.height,
        sourceBounds,
        deformer,
        triangles: deformer.triangles,
        maxAxis: options.maxAxis,
        maxPixels: options.maxPixels
    });
}
