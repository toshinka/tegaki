/**
 * CAF内部Folder / Root Raster PartとFolder別WARPを重複しないRenderIslandとして解決する純粋adapter契約。
 * evaluateRigidParts()とoptional Bone bindingのworld matrixだけを利用し、
 * Pixi / Canvas / UI stateを所有しない。
 * Folder別WARPはCAF Project座標でsubtreeへ先に適用し、所有Part / Bone matrixを一度だけ重ねる。
 * root WARP / root Motion / Laneは呼出側がこのplanの後段へ適用する。
 * clipping owner/sourceがRenderIsland境界を跨ぐ場合はRig適用を拒否し、呼出側は
 * 既存のRigなしRaster合成へfallbackする。
 */

import {
    evaluateRigidBones,
    evaluateRigidParts,
    resolveRigidBindingWorldMatrix
} from './part-rig.js';
import {
    sampleClipFolderDeformers,
    validateClipFolderDeformers
} from './clip-deformer.js';
import { resolveInternalClippingContract } from './internal-layer-clipping-contract.js';
import { resolveRigPartTarget } from './rig-part-target.js';
import { unionRasterBounds } from '../raster-bounds.js';
import { resolveWarpPlacementSample } from './warp-placement.js';
import {
    calculateAffineTransformedBounds
} from '../transform-math.js';

function createEmptyPlan(status = 'none', errors = []) {
    return {
        ok: status === 'none' || status === 'ready',
        status,
        fallbackToRaster: status === 'invalid' || status === 'unsupported',
        errors,
        islands: [],
        islandByPartId: new Map(),
        islandByFolderId: new Map(),
        islandByLayerId: new Map()
    };
}

function addPlanError(code, message, details = {}) {
    return { code, message, ...details };
}

function createIdentityMatrix() {
    return { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 };
}

function createEmptyEffectPlan(status = 'none', rigRenderPlan = createEmptyPlan('none'), errors = []) {
    return {
        kind: 'folder-effect',
        ok: status === 'none' || status === 'ready',
        status,
        fallbackToRaster: status === 'invalid' || status === 'unsupported',
        errors,
        rigRenderPlan,
        islands: [],
        islandByFolderId: new Map(),
        islandByLayerId: new Map()
    };
}

export function collectInternalLayerSubtreeIds(internalLayers, rootLayerId) {
    const layers = Array.isArray(internalLayers) ? internalLayers : [];
    const childrenByParentId = new Map();
    layers.forEach(layer => {
        if (!layer?.id) return;
        const parentId = layer.parentLayerId || null;
        if (!childrenByParentId.has(parentId)) childrenByParentId.set(parentId, []);
        childrenByParentId.get(parentId).push(layer);
    });
    const ids = new Set();
    const visit = layerId => {
        if (!layerId || ids.has(layerId)) return;
        ids.add(layerId);
        (childrenByParentId.get(layerId) || []).forEach(child => visit(child.id));
    };
    visit(rootLayerId);
    return ids;
}

/** RenderIsland境界を跨ぐclipping target/sourceを列挙する。 */
export function validateRigPartClippingBoundary(asset, islandLayerIds) {
    const ids = islandLayerIds instanceof Set ? islandLayerIds : new Set(islandLayerIds || []);
    const errors = [];
    (asset?.internalLayers || []).forEach(layer => {
        if (!layer || layer.type === 'folder') return;
        const contract = resolveInternalClippingContract(asset, layer);
        if (!contract?.owner || !contract.source) return;
        const targetInside = ids.has(layer.id);
        const sourceLayerIds = contract.sourceLayers
            .map(sourceLayer => sourceLayer?.id)
            .filter(Boolean);
        const crossesBoundary = sourceLayerIds.some(sourceLayerId => {
            return ids.has(sourceLayerId) !== targetInside;
        });
        if (!crossesBoundary) return;
        errors.push(addPlanError(
            'clipping-boundary-split',
            'clipping owner/source crosses the Rig Part RenderIsland boundary',
            {
                targetLayerId: layer.id,
                ownerLayerId: contract.owner.id,
                sourceLayerIds
            }
        ));
    });
    return { ok: errors.length === 0, errors };
}

export function validateFolderPartClippingBoundary(asset, islandLayerIds) {
    return validateRigPartClippingBoundary(asset, islandLayerIds);
}

/**
 * Rig Part render planを返す。Folder Partは各Rasterを最も近い登録Folderへ
 * 排他的に割り当て、Root Raster Partは一枚だけを所有する。
 * Rigなしはstatus=none、invalid/unsupportedはfallbackToRaster=trueとなる。
 */
export function createRigPartRenderPlan(asset, clip, timelineFrame) {
    if (asset?.rigDefinition == null) return createEmptyPlan('none');

    const evaluated = evaluateRigidParts(asset, clip, timelineFrame);
    if (!evaluated.ok) return createEmptyPlan('invalid', evaluated.errors);
    if (evaluated.orderedPoses.length === 0) return createEmptyPlan('none');
    const layers = Array.isArray(asset.internalLayers) ? asset.internalLayers : [];
    const layerById = new Map(layers.map(layer => [layer?.id, layer]));
    const partIds = new Set(evaluated.orderedPoses.map(pose => pose.partId));
    const errors = [];
    const findOwningPartId = layer => {
        let current = layer || null;
        const visited = new Set();
        while (current?.id && !visited.has(current.id)) {
            visited.add(current.id);
            if (partIds.has(current.id)) return current.id;
            current = current.parentLayerId ? layerById.get(current.parentLayerId) || null : null;
        }
        return null;
    };
    const targets = evaluated.orderedPoses.map(pose => {
        const target = resolveRigPartTarget(asset, pose.partId);
        if (!target.ok) {
            errors.push(addPlanError(
                target.reason,
                target.reason === 'rig-mode-conflict'
                    ? 'Raster cannot be both a rigid Part and a Mesh / Skin target'
                    : 'Part target must be an internal Folder or a CAF root Raster',
                { partId: pose.partId, targetLayerId: target.layer?.id || null }
            ));
            return null;
        }
        const layerIds = target.targetKind === 'folder'
            ? new Set([...collectInternalLayerSubtreeIds(layers, target.layer.id)].filter(layerId => (
                findOwningPartId(layerById.get(layerId)) === pose.partId
            )))
            : new Set([target.layer.id]);
        const clippingValidation = validateRigPartClippingBoundary(asset, layerIds);
        if (!clippingValidation.ok) errors.push(...clippingValidation.errors);
        return { pose, targetLayer: target.layer, targetKind: target.targetKind, layerIds };
    }).filter(Boolean);
    if (errors.length > 0) {
        const status = errors.some(error => error.code === 'clipping-boundary-split')
            ? 'invalid'
            : 'unsupported';
        return createEmptyPlan(status, errors);
    }

    const bindings = Array.isArray(asset.rigDefinition?.rigidBindings)
        ? asset.rigDefinition.rigidBindings
        : [];
    const evaluatedBones = bindings.length > 0
        ? evaluateRigidBones(asset, clip, timelineFrame)
        : null;
    const bindBones = bindings.length > 0
        ? evaluateRigidBones(asset, null, timelineFrame)
        : null;
    if (evaluatedBones && !evaluatedBones.ok) return createEmptyPlan('invalid', evaluatedBones.errors);
    if (bindBones && !bindBones.ok) return createEmptyPlan('invalid', bindBones.errors);
    const islands = targets.map(({ pose, targetLayer, targetKind, layerIds }) => {
        let worldMatrix = { ...pose.worldMatrix };
        let rigidBinding = null;
        let boneDeltaMatrix = null;
        const binding = bindings.find(candidate => candidate?.partId === pose.partId) || null;
        if (binding) {
            const bonePose = evaluatedBones?.poseByBoneId.get(binding.boneId) || null;
            const bindPose = bindBones?.poseByBoneId.get(binding.boneId) || null;
            if (!bonePose || !bindPose) {
                errors.push(addPlanError(
                    'binding-pose-missing',
                    'Rigid binding Bone pose is unavailable',
                    { boneId: binding.boneId, partId: pose.partId }
                ));
                return null;
            }
            const resolvedBinding = resolveRigidBindingWorldMatrix(pose, bonePose, bindPose);
            if (!resolvedBinding.ok) {
                errors.push(addPlanError(
                    resolvedBinding.reason,
                    resolvedBinding.reason === 'non-invertible-bone-bind'
                        ? 'Bone Bind Pose matrix is not invertible'
                        : 'Rigid binding Bone pose is unavailable',
                    { boneId: binding.boneId, partId: binding.partId }
                ));
                return null;
            }
            boneDeltaMatrix = resolvedBinding.boneDeltaMatrix;
            // 評価順はBone delta → Part rigid。source pointへ右からBone、左からPartを適用する。
            worldMatrix = resolvedBinding.worldMatrix;
            rigidBinding = { boneId: binding.boneId, partId: binding.partId };
        }
        return {
            partId: pose.partId,
            targetLayerId: targetLayer.id,
            targetKind,
            folderId: targetKind === 'folder' ? targetLayer.id : null,
            parentPartId: pose.parentPartId,
            layerIds,
            partWorldMatrix: { ...pose.worldMatrix },
            boneDeltaMatrix: boneDeltaMatrix ? { ...boneDeltaMatrix } : null,
            rigidBinding,
            worldMatrix
        };
    }).filter(Boolean);
    if (errors.length > 0) return createEmptyPlan('invalid', errors);
    const islandByPartId = new Map(islands.map(island => [island.partId, island]));
    const islandByFolderId = new Map(islands
        .filter(island => island.folderId)
        .map(island => [island.folderId, island]));
    const islandByLayerId = new Map();
    islands.forEach(island => {
        island.layerIds.forEach(layerId => islandByLayerId.set(layerId, island));
    });
    return {
        ok: true,
        status: 'ready',
        fallbackToRaster: false,
        errors: [],
        islands,
        islandByPartId,
        islandByFolderId,
        islandByLayerId
    };
}

/** 既存Folder Part consumer向け互換export。plan正本はcreateRigPartRenderPlan()。 */
export function createFolderPartRenderPlan(asset, clip, timelineFrame) {
    return createRigPartRenderPlan(asset, clip, timelineFrame);
}

/**
 * Folder別WARPを既存Folder Part / Bone評価へ重ねる共有RenderIsland plan。
 * sampled deformerはPart / Bone matrix前のCAF Project座標で評価し、root WARPと
 * root Motionは呼出側がこのplanの後に一度だけ適用する。
 */
export function createFolderEffectRenderPlan(asset, clip, timelineFrame) {
    const rigRenderPlan = createRigPartRenderPlan(asset, clip, timelineFrame);
    const validation = validateClipFolderDeformers(
        clip?.folderDeformers,
        asset?.internalLayers || null
    );
    if (!validation.ok) {
        return createEmptyEffectPlan('invalid', rigRenderPlan, validation.errors);
    }
    const sampledByFolderId = sampleClipFolderDeformers(
        validation.value,
        timelineFrame - (Number.isInteger(clip?.startFrame) ? clip.startFrame : 0),
        Math.max(1, Number.isInteger(clip?.duration) ? clip.duration : 1)
    );
    if (rigRenderPlan.status === 'invalid' || rigRenderPlan.status === 'unsupported') {
        return createEmptyEffectPlan(rigRenderPlan.status, rigRenderPlan, rigRenderPlan.errors);
    }
    if (sampledByFolderId.size === 0) {
        return createEmptyEffectPlan('none', rigRenderPlan);
    }

    const layers = Array.isArray(asset?.internalLayers) ? asset.internalLayers : [];
    const layerById = new Map(layers.map(layer => [layer?.id, layer]));
    const targetIds = new Set(sampledByFolderId.keys());
    const registeredPartIds = new Set(
        (asset?.rigDefinition?.parts || []).map(part => part?.partId).filter(Boolean)
    );
    const errors = [];
    const islands = [];

    sampledByFolderId.forEach((sampledDeformer, folderId) => {
        const targetLayer = layerById.get(folderId) || null;
        const layerIds = collectInternalLayerSubtreeIds(layers, folderId);
        const nestedTargetId = [...layerIds]
            .find(layerId => layerId !== folderId && targetIds.has(layerId)) || null;
        if (nestedTargetId) {
            errors.push(addPlanError(
                'folder-deformer-nested-target-unsupported',
                'A Folder WARP target cannot contain another Folder WARP target in the initial slice',
                { folderId, nestedTargetId }
            ));
            return;
        }
        const nestedPartId = [...layerIds]
            .find(layerId => layerId !== folderId && registeredPartIds.has(layerId)) || null;
        if (nestedPartId) {
            errors.push(addPlanError(
                'folder-deformer-nested-part-unsupported',
                'A Folder WARP target cannot contain another registered Folder Part in the initial slice',
                { folderId, nestedPartId }
            ));
            return;
        }
        const clippingValidation = validateFolderPartClippingBoundary(asset, layerIds);
        if (!clippingValidation.ok) {
            errors.push(...clippingValidation.errors.map(error => ({ ...error, folderId })));
            return;
        }
        const rigIsland = rigRenderPlan.status === 'ready'
            ? rigRenderPlan.islandByLayerId?.get(folderId) || null
            : null;
        islands.push({
            folderId,
            targetLayer,
            layerIds,
            sampledDeformer,
            partId: rigIsland?.partId || null,
            partWorldMatrix: rigIsland?.partWorldMatrix
                ? { ...rigIsland.partWorldMatrix }
                : null,
            boneDeltaMatrix: rigIsland?.boneDeltaMatrix
                ? { ...rigIsland.boneDeltaMatrix }
                : null,
            worldMatrix: rigIsland?.worldMatrix
                ? { ...rigIsland.worldMatrix }
                : createIdentityMatrix()
        });
    });

    if (errors.length > 0) {
        return createEmptyEffectPlan('unsupported', rigRenderPlan, errors);
    }
    const islandByFolderId = new Map(islands.map(island => [island.folderId, island]));
    const islandByLayerId = new Map();
    islands.forEach(island => {
        island.layerIds.forEach(layerId => islandByLayerId.set(layerId, island));
    });
    return {
        kind: 'folder-effect',
        ok: true,
        status: 'ready',
        fallbackToRaster: false,
        errors: [],
        rigRenderPlan,
        islands,
        islandByFolderId,
        islandByLayerId
    };
}

/** Folder WARPの部分置換後surface boundsをProject座標で求める。 */
export function calculateFolderDeformerSurfaceBounds(sourceBounds, sampledDeformer) {
    if (!sourceBounds || !sampledDeformer) return sourceBounds || null;
    const renderDeformer = resolveWarpPlacementSample(sampledDeformer, sourceBounds);
    const bindBounds = sampledDeformer.bindBounds || sourceBounds;
    if (!renderDeformer || !Array.isArray(renderDeformer.points) || renderDeformer.points.length === 0) {
        return sourceBounds;
    }
    const destinationPoints = renderDeformer.points.map(point => ({
        x: bindBounds.x + point.x * bindBounds.width,
        y: bindBounds.y + point.y * bindBounds.height
    }));
    const minX = Math.floor(Math.min(...destinationPoints.map(point => point.x)));
    const minY = Math.floor(Math.min(...destinationPoints.map(point => point.y)));
    const maxX = Math.ceil(Math.max(...destinationPoints.map(point => point.x)));
    const maxY = Math.ceil(Math.max(...destinationPoints.map(point => point.y)));
    return unionRasterBounds([
        sourceBounds,
        {
            x: minX,
            y: minY,
            width: Math.max(1, maxX - minX),
            height: Math.max(1, maxY - minY)
        }
    ]);
}

/** Folder WARP、Part / Bone適用後のCAF内部Raster union boundsを共有計算する。 */
export function calculateFolderEffectAssetBounds(
    asset,
    effectPlan,
    getLayerBounds,
    isLayerVisible = () => true
) {
    if (effectPlan?.kind !== 'folder-effect') {
        return calculateRigPartAssetBounds(
            asset,
            effectPlan,
            getLayerBounds,
            isLayerVisible
        );
    }
    if (effectPlan?.status !== 'ready') {
        return calculateRigPartAssetBounds(
            asset,
            effectPlan?.rigRenderPlan || effectPlan,
            getLayerBounds,
            isLayerVisible
        );
    }

    const rigPlan = effectPlan.rigRenderPlan;
    const outsideBounds = [];
    const boundsByRigIsland = new Map((rigPlan?.islands || []).map(island => [island, []]));
    const boundsByEffectIsland = new Map(effectPlan.islands.map(island => [island, []]));
    (asset?.internalLayers || []).forEach(layer => {
        if (!layer || layer.type === 'folder' || !isLayerVisible(layer)) return;
        const bounds = getLayerBounds(layer);
        if (!bounds) return;
        const effectIsland = effectPlan.islandByLayerId.get(layer.id) || null;
        if (effectIsland) {
            boundsByEffectIsland.get(effectIsland)?.push(bounds);
            return;
        }
        const rigIsland = rigPlan?.status === 'ready'
            ? rigPlan.islandByLayerId?.get(layer.id) || null
            : null;
        if (rigIsland) boundsByRigIsland.get(rigIsland)?.push(bounds);
        else outsideBounds.push(bounds);
    });

    const transformedRigBounds = [...boundsByRigIsland].map(([island, bounds]) => {
        const sourceBounds = unionRasterBounds(bounds);
        return sourceBounds
            ? calculateAffineTransformedBounds(sourceBounds, island.worldMatrix)
            : null;
    });
    const transformedEffectBounds = [...boundsByEffectIsland].map(([island, bounds]) => {
        const sourceBounds = unionRasterBounds(bounds);
        const deformedBounds = calculateFolderDeformerSurfaceBounds(
            sourceBounds,
            island.sampledDeformer
        );
        return deformedBounds
            ? calculateAffineTransformedBounds(deformedBounds, island.worldMatrix)
            : null;
    });
    return unionRasterBounds([
        ...outsideBounds,
        ...transformedRigBounds,
        ...transformedEffectBounds
    ]);
}

export function getRigPartRenderIsland(plan, partId) {
    return plan?.status === 'ready' ? plan.islandByPartId?.get(partId) || null : null;
}

export function getFolderPartRenderIsland(plan, folderId) {
    return plan?.status === 'ready' ? plan.islandByFolderId?.get(folderId) || null : null;
}

/** Snapshot取得方法に依存せず、Rig適用後のCAF内部Raster union boundsを共有計算する。 */
export function calculateRigPartAssetBounds(
    asset,
    renderPlan,
    getLayerBounds,
    isLayerVisible = () => true
) {
    const outsideBounds = [];
    const boundsByIsland = new Map((renderPlan?.islands || []).map(island => [island, []]));
    (asset?.internalLayers || []).forEach(layer => {
        if (!layer || layer.type === 'folder' || !isLayerVisible(layer)) return;
        const bounds = getLayerBounds(layer);
        if (!bounds) return;
        const island = renderPlan?.status === 'ready'
            ? renderPlan.islandByLayerId?.get(layer.id) || null
            : null;
        if (island) boundsByIsland.get(island)?.push(bounds);
        else outsideBounds.push(bounds);
    });
    const transformedIslandBounds = [...boundsByIsland].map(([island, bounds]) => {
        const sourceBounds = unionRasterBounds(bounds);
        return sourceBounds
            ? calculateAffineTransformedBounds(sourceBounds, island.worldMatrix)
            : null;
    });
    return unionRasterBounds([
        ...outsideBounds,
        ...transformedIslandBounds
    ]);
}

/** 既存Folder Part consumer向け互換export。 */
export function calculateFolderPartAssetBounds(
    asset,
    renderPlan,
    getLayerBounds,
    isLayerVisible = () => true
) {
    return calculateRigPartAssetBounds(asset, renderPlan, getLayerBounds, isLayerVisible);
}
