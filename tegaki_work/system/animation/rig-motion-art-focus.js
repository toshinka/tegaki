/**
 * RIG / Motion authoring中に、選択Boneが実際に動かすRasterを既存の
 * rigidBindings / skinBindingsから導出するdisplay-only projection。
 * 保存正本やLayer opacityは変更しない。
 */

function collectBoneSubtreeIds(bones, rootBoneId) {
    if (!rootBoneId) return new Set();
    const boneIds = new Set((bones || []).map(bone => bone?.boneId).filter(Boolean));
    if (!boneIds.has(rootBoneId)) return new Set();
    const result = new Set([rootBoneId]);
    let changed = true;
    while (changed) {
        changed = false;
        for (const bone of bones || []) {
            if (!bone?.boneId || result.has(bone.boneId)) continue;
            if (bone.parentBoneId && result.has(bone.parentBoneId)) {
                result.add(bone.boneId);
                changed = true;
            }
        }
    }
    return result;
}

function collectTargetRasterIds(layers, targetLayerId) {
    if (!targetLayerId) return new Set();
    const layerById = new Map((layers || []).filter(layer => layer?.id).map(layer => [layer.id, layer]));
    const target = layerById.get(targetLayerId);
    if (!target) return new Set();
    if (target.type === 'raster') return new Set([target.id]);
    if (target.type !== 'folder') return new Set();

    const result = new Set();
    for (const layer of layers || []) {
        if (!layer?.id || layer.type !== 'raster') continue;
        let parentId = layer.parentLayerId || null;
        const visited = new Set();
        while (parentId && !visited.has(parentId)) {
            if (parentId === targetLayerId) {
                result.add(layer.id);
                break;
            }
            visited.add(parentId);
            parentId = layerById.get(parentId)?.parentLayerId || null;
        }
    }
    return result;
}

function collectPositiveSkinBoneIds(binding) {
    return new Set((Array.isArray(binding?.vertexWeights) ? binding.vertexWeights : [])
        .flatMap(vertexWeight => (
            (Array.isArray(vertexWeight?.influences) ? vertexWeight.influences : [])
                .filter(influence => Number(influence?.weight) > 0)
                .map(influence => influence?.boneId)
                .filter(Boolean)
        )));
}

export const RIG_MOTION_UNFOCUSED_ART_ALPHA = 0.28;

export function createRigMotionArtFocusProjection(asset, options = {}) {
    if (!asset || typeof asset !== 'object') {
        return {
            ok: false,
            active: false,
            connected: false,
            targetConnected: false,
            reason: 'asset-required',
            rasterLayerIds: []
        };
    }
    const editorMode = options.editorMode === 'rig' ? 'rig' : 'motion';
    const scope = options.scope === 'internal' ? 'internal' : 'caf';
    if (scope !== 'internal') {
        return {
            ok: true,
            active: false,
            connected: false,
            targetConnected: false,
            reason: 'caf-scope',
            rasterLayerIds: []
        };
    }

    const layers = Array.isArray(asset.internalLayers) ? asset.internalLayers : [];
    const bones = Array.isArray(asset.rigDefinition?.bones) ? asset.rigDefinition.bones : [];
    const parts = Array.isArray(asset.rigDefinition?.parts) ? asset.rigDefinition.parts : [];
    const rigidBindings = Array.isArray(asset.rigDefinition?.rigidBindings)
        ? asset.rigDefinition.rigidBindings
        : [];
    const meshes = Array.isArray(asset.meshDefinitions) ? asset.meshDefinitions : [];
    const skinBindings = Array.isArray(asset.skinBindings) ? asset.skinBindings : [];
    const partById = new Map(parts.filter(part => part?.partId).map(part => [part.partId, part]));
    const meshById = new Map(meshes.filter(mesh => mesh?.meshId).map(mesh => [mesh.meshId, mesh]));
    const influencedBoneIds = collectBoneSubtreeIds(bones, options.boneId || null);
    const affectedRasterIds = new Set();

    if (influencedBoneIds.size > 0) {
        for (const binding of rigidBindings) {
            if (!influencedBoneIds.has(binding?.boneId)) continue;
            const part = partById.get(binding?.partId);
            collectTargetRasterIds(layers, part?.partId).forEach(id => affectedRasterIds.add(id));
        }
        for (const binding of skinBindings) {
            const referencedBoneIds = collectPositiveSkinBoneIds(binding);
            if (![...referencedBoneIds].some(boneId => influencedBoneIds.has(boneId))) continue;
            const mesh = meshById.get(binding?.meshId);
            collectTargetRasterIds(layers, mesh?.targetInternalLayerId).forEach(id => affectedRasterIds.add(id));
        }
    }

    const connected = affectedRasterIds.size > 0;
    if (connected) {
        const selectedTargetRasterIds = collectTargetRasterIds(layers, options.targetLayerId || null);
        const targetConnected = selectedTargetRasterIds.size === 0
            ? true
            : [...selectedTargetRasterIds].some(id => affectedRasterIds.has(id));
        return {
            ok: true,
            active: true,
            connected: true,
            targetConnected,
            reason: 'connected',
            rasterLayerIds: [...affectedRasterIds]
        };
    }

    // 未接続時も選択Rasterは「これから接続する対象」として通常濃度で示す。
    // connected=falseは維持し、Motion keyの許可判定には使わせない。
    const setupTargetRasterIds = collectTargetRasterIds(layers, options.targetLayerId || null);
    return {
        ok: true,
        active: true,
        connected: false,
        targetConnected: false,
        reason: setupTargetRasterIds.size > 0
            ? (editorMode === 'rig' ? 'setup-pending' : 'motion-unconnected-target')
            : 'bone-unbound',
        rasterLayerIds: [...setupTargetRasterIds]
    };
}
