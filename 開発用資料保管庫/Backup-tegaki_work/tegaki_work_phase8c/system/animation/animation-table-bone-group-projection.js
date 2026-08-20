/**
 * Animation Table用のBone target group候補を既存Rig / Mesh / Skinから導出する。
 * 表示projectionだけを返し、Rig、Timeline、History、Projectへ書き戻さない。
 */

function compareBySourceOrder(left, right) {
    return left.order - right.order || left.boneId.localeCompare(right.boneId);
}

export function createAnimationTableBoneGroupProjection(asset) {
    if (!asset || typeof asset !== 'object') {
        return { ok: false, reason: 'asset-required', groups: [] };
    }

    const layers = Array.isArray(asset.internalLayers) ? asset.internalLayers : [];
    const bones = Array.isArray(asset.rigDefinition?.bones) ? asset.rigDefinition.bones : [];
    const parts = Array.isArray(asset.rigDefinition?.parts) ? asset.rigDefinition.parts : [];
    const rigidBindings = Array.isArray(asset.rigDefinition?.rigidBindings)
        ? asset.rigDefinition.rigidBindings
        : [];
    const meshes = Array.isArray(asset.meshDefinitions) ? asset.meshDefinitions : [];
    const skinBindings = Array.isArray(asset.skinBindings) ? asset.skinBindings : [];
    const layerById = new Map(layers.filter(layer => layer?.id).map(layer => [layer.id, layer]));
    const partById = new Map(parts.filter(part => part?.partId).map(part => [part.partId, part]));
    const meshById = new Map(meshes.filter(mesh => mesh?.meshId).map(mesh => [mesh.meshId, mesh]));
    const boneById = new Map(bones.filter(bone => bone?.boneId).map(bone => [bone.boneId, bone]));
    const targetsByBoneId = new Map([...boneById.keys()].map(boneId => [boneId, new Map()]));
    const unresolvedByBoneId = new Map([...boneById.keys()].map(boneId => [boneId, new Set()]));

    const addTarget = (boneId, layerId, source) => {
        if (!boneById.has(boneId)) return;
        const layer = layerById.get(layerId);
        if (!layer) {
            unresolvedByBoneId.get(boneId).add(`${source}-target-missing`);
            return;
        }
        const targets = targetsByBoneId.get(boneId);
        const current = targets.get(layerId) || {
            targetLayerId: layerId,
            targetKind: layer.type === 'folder' ? 'folder' : 'raster',
            targetName: layer.name || (layer.type === 'folder' ? 'Folder' : 'Raster'),
            sources: new Set()
        };
        current.sources.add(source);
        targets.set(layerId, current);
    };

    rigidBindings.forEach(binding => {
        const part = partById.get(binding?.partId);
        if (!part) {
            if (boneById.has(binding?.boneId)) unresolvedByBoneId.get(binding.boneId).add('rigid-part-missing');
            return;
        }
        addTarget(binding?.boneId, part.partId, 'rigid');
    });

    skinBindings.forEach(binding => {
        const mesh = meshById.get(binding?.meshId);
        if (!mesh?.targetInternalLayerId) {
            (Array.isArray(binding?.vertexWeights) ? binding.vertexWeights : []).forEach(vertexWeight => {
                (Array.isArray(vertexWeight?.influences) ? vertexWeight.influences : []).forEach(influence => {
                    if (boneById.has(influence?.boneId)) {
                        unresolvedByBoneId.get(influence.boneId).add('skin-mesh-target-missing');
                    }
                });
            });
            return;
        }
        const referencedBoneIds = new Set((Array.isArray(binding?.vertexWeights) ? binding.vertexWeights : [])
            .flatMap(vertexWeight => (
            (Array.isArray(vertexWeight?.influences) ? vertexWeight.influences : [])
                .filter(influence => Number(influence?.weight) > 0)
                .map(influence => influence?.boneId)
                .filter(Boolean)
        )));
        referencedBoneIds.forEach(boneId => addTarget(boneId, mesh.targetInternalLayerId, 'skin'));
    });

    const entries = [...boneById.values()].map((bone, order) => {
        const targets = [...(targetsByBoneId.get(bone.boneId)?.values() || [])].map(target => ({
            ...target,
            sources: [...target.sources].sort()
        }));
        const status = targets.length === 1
            ? 'target'
            : (targets.length > 1 ? 'shared' : 'unassigned');
        return {
            boneId: bone.boneId,
            boneName: bone.name || `BONE ${order + 1}`,
            parentBoneId: bone.parentBoneId || null,
            order,
            status,
            targetLayerId: status === 'target' ? targets[0].targetLayerId : null,
            targets,
            unresolvedReasons: [...(unresolvedByBoneId.get(bone.boneId) || [])].sort()
        };
    });
    const entryById = new Map(entries.map(entry => [entry.boneId, entry]));
    entries.forEach(entry => {
        const relatedTargetIds = new Set();
        const parent = entry.parentBoneId ? entryById.get(entry.parentBoneId) : null;
        if (parent?.status === 'target') relatedTargetIds.add(parent.targetLayerId);
        entries.forEach(child => {
            if (child.parentBoneId === entry.boneId && child.status === 'target') {
                relatedTargetIds.add(child.targetLayerId);
            }
        });
        entry.relatedTargetLayerIds = [...relatedTargetIds];
    });

    const groups = layers.filter(layer => layer?.id).map((layer, order) => ({
        groupId: `target:${layer.id}`,
        groupKind: 'target',
        targetLayerId: layer.id,
        targetKind: layer.type === 'folder' ? 'folder' : 'raster',
        label: layer.name || (layer.type === 'folder' ? 'Folder' : 'Raster'),
        order,
        bones: entries.filter(entry => entry.status === 'target' && entry.targetLayerId === layer.id)
            .sort(compareBySourceOrder)
    })).filter(group => group.bones.length > 0);
    const shared = entries.filter(entry => entry.status === 'shared').sort(compareBySourceOrder);
    const unassigned = entries.filter(entry => entry.status === 'unassigned').sort(compareBySourceOrder);
    if (shared.length > 0) {
        groups.push({
            groupId: 'shared',
            groupKind: 'shared',
            targetLayerId: null,
            targetKind: null,
            label: 'SHARED / CONNECTION',
            order: layers.length,
            bones: shared
        });
    }
    if (unassigned.length > 0) {
        groups.push({
            groupId: 'unassigned',
            groupKind: 'unassigned',
            targetLayerId: null,
            targetKind: null,
            label: 'UNASSIGNED',
            order: layers.length + 1,
            bones: unassigned
        });
    }

    return {
        ok: true,
        groups,
        stats: {
            boneCount: entries.length,
            targetGroupCount: groups.filter(group => group.groupKind === 'target').length,
            sharedBoneCount: shared.length,
            unassignedBoneCount: unassigned.length
        }
    };
}
