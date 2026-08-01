/**
 * CAF内部Folder Partを重複しないRenderIslandとして解決する純粋adapter契約。
 * evaluateRigidParts()とoptional Bone bindingのworld matrixだけを利用し、
 * Pixi / Canvas / UI stateを所有しない。
 * clipping owner/sourceがRenderIsland境界を跨ぐ場合はRig適用を拒否し、呼出側は
 * 既存のRigなしRaster合成へfallbackする。
 */

import { evaluateRigidBones, evaluateRigidParts } from './part-rig.js';
import { resolveInternalClippingContract } from './internal-layer-clipping-contract.js';
import { unionRasterBounds } from '../raster-bounds.js';
import {
    calculateAffineTransformedBounds,
    invertTransformMatrix,
    multiplyTransformMatrices
} from '../transform-math.js';

function createEmptyPlan(status = 'none', errors = []) {
    return {
        ok: status === 'none' || status === 'ready',
        status,
        fallbackToRaster: status === 'invalid' || status === 'unsupported',
        errors,
        islands: [],
        islandByFolderId: new Map(),
        islandByLayerId: new Map()
    };
}

function addPlanError(code, message, details = {}) {
    return { code, message, ...details };
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
export function validateFolderPartClippingBoundary(asset, islandLayerIds) {
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
            'clipping owner/source crosses the Folder Part RenderIsland boundary',
            {
                targetLayerId: layer.id,
                ownerLayerId: contract.owner.id,
                sourceLayerIds
            }
        ));
    });
    return { ok: errors.length === 0, errors };
}

/**
 * Folder Part render planを返す。nested Partでは各Rasterを最も近い登録Folderへ
 * 排他的に割り当て、親子RenderIslandの二重変換を防ぐ。
 * Rigなしはstatus=none、invalid/unsupportedはfallbackToRaster=trueとなる。
 */
export function createFolderPartRenderPlan(asset, clip, timelineFrame) {
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
        const targetLayer = layerById.get(pose.partId) || null;
        if (!targetLayer || targetLayer.type !== 'folder') {
            errors.push(addPlanError(
                'folder-part-required',
                'Part target must be an internal Folder',
                { partId: pose.partId }
            ));
            return null;
        }
        const subtreeIds = collectInternalLayerSubtreeIds(layers, targetLayer.id);
        const layerIds = new Set([...subtreeIds].filter(layerId => (
            findOwningPartId(layerById.get(layerId)) === pose.partId
        )));
        const clippingValidation = validateFolderPartClippingBoundary(asset, layerIds);
        if (!clippingValidation.ok) errors.push(...clippingValidation.errors);
        return { pose, targetLayer, layerIds };
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
    const islands = targets.map(({ pose, targetLayer, layerIds }) => {
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
            const inverseBindMatrix = bindPose ? invertTransformMatrix(bindPose.worldMatrix) : null;
            if (!inverseBindMatrix) {
                errors.push(addPlanError(
                    'non-invertible-bone-bind',
                    'Bone Bind Pose matrix is not invertible',
                    { boneId: binding.boneId }
                ));
                return null;
            }
            boneDeltaMatrix = multiplyTransformMatrices(bonePose.worldMatrix, inverseBindMatrix);
            // 評価順はBone delta → Part rigid。source pointへ右からBone、左からPartを適用する。
            worldMatrix = multiplyTransformMatrices(pose.worldMatrix, boneDeltaMatrix);
            rigidBinding = { boneId: binding.boneId, partId: binding.partId };
        }
        return {
            partId: pose.partId,
            folderId: targetLayer.id,
            parentPartId: pose.parentPartId,
            layerIds,
            partWorldMatrix: { ...pose.worldMatrix },
            boneDeltaMatrix: boneDeltaMatrix ? { ...boneDeltaMatrix } : null,
            rigidBinding,
            worldMatrix
        };
    }).filter(Boolean);
    if (errors.length > 0) return createEmptyPlan('invalid', errors);
    const islandByFolderId = new Map(islands.map(island => [island.folderId, island]));
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
        islandByFolderId,
        islandByLayerId
    };
}

export function getFolderPartRenderIsland(plan, folderId) {
    return plan?.status === 'ready' ? plan.islandByFolderId?.get(folderId) || null : null;
}

/** Snapshot取得方法に依存せず、Rig適用後のCAF内部Raster union boundsを共有計算する。 */
export function calculateFolderPartAssetBounds(
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
