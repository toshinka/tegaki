/**
 * ============================================================================
 * ファイル名: system/animation/rig-authoring-status-projection.js
 * 責務: ClipAssetのstatic RIG正本を、Layer / RIG Inspectorが共有する状態へpure投影する
 * 依存: なし
 * 被依存: ui/layer-panel-renderer.js、将来の右RIG Inspector
 * Authority境界:
 * - 入力はClipAsset.rigDefinition / meshDefinitions / skinBindingsと外部で導出済みのMesh鮮度だけ。
 * - selection、History、save、ClipInstance.rigMotion、solver / evaluatorを所有しない。
 * - `none / parent / bend / whole / conflict / stale`は表示状態でありProjectへ保存しない。
 * - Rigid Partのbinding先BoneとRig全体のROOT状態を分離し、親接続後もPIVOT作成済み判定を失わない。
 * ============================================================================
 */

export const RIG_AUTHORING_STATUS = Object.freeze({
    NONE: 'none',
    PARENT: 'parent',
    BEND: 'bend',
    WHOLE: 'whole',
    CONFLICT: 'conflict',
    STALE: 'stale'
});

const STATUS_COPY = Object.freeze({
    [RIG_AUTHORING_STATUS.NONE]: Object.freeze({
        label: 'RIG 未設定',
        badgeLabel: '',
        tooltip: 'RIGは未設定です'
    }),
    [RIG_AUTHORING_STATUS.PARENT]: Object.freeze({
        label: '親子RIG',
        badgeLabel: '親子',
        tooltip: 'Folder配下を一つの親子RIGとして動かします'
    }),
    [RIG_AUTHORING_STATUS.BEND]: Object.freeze({
        label: '曲げRIG',
        badgeLabel: '曲げ',
        tooltip: 'BONEとMeshで一枚絵を曲げます'
    }),
    [RIG_AUTHORING_STATUS.WHOLE]: Object.freeze({
        label: '全体PIVOT',
        badgeLabel: '全体',
        tooltip: '一枚絵を変形せず全体PIVOTで動かします'
    }),
    [RIG_AUTHORING_STATUS.CONFLICT]: Object.freeze({
        label: 'RIG 競合',
        badgeLabel: '競合',
        tooltip: '同じRasterに全体PIVOTとMesh RIGが重複しています'
    }),
    [RIG_AUTHORING_STATUS.STALE]: Object.freeze({
        label: 'Mesh 要更新',
        badgeLabel: '要更新',
        tooltip: '描画更新後のためMeshを確認または再生成してください'
    })
});

function list(value) {
    return Array.isArray(value) ? value : [];
}

function resolveTargetKind(layer) {
    if (layer?.type === 'folder' || layer?.isFolder === true) return 'folder';
    if (layer?.type === 'raster' && layer?.isBackground !== true) return 'raster';
    return null;
}

function resolveMeshGeneratorLabel(generatorType) {
    return {
        'alpha-fit-grid-v1': 'GRID',
        'auto-shape-fill-v1': 'SHAPE',
        'auto-shape-line-ribbon-v1': 'LINE'
    }[generatorType] || (generatorType ? 'MESH' : 'MANUAL');
}

/**
 * ClipAssetのstatic authoring状態を一対象へ投影する。
 * MeshのSTALE判定はDrawingSnapshotを所有するcallerが`meshState: 'stale'`として渡す。
 */
export function createRigAuthoringStatusProjection(asset, targetInternalLayerId, options = {}) {
    const internalLayers = list(asset?.internalLayers);
    const layer = internalLayers.find(candidate => candidate?.id === targetInternalLayerId) || null;
    const targetKind = resolveTargetKind(layer);
    const parts = list(asset?.rigDefinition?.parts);
    const bones = list(asset?.rigDefinition?.bones);
    const rigidBindings = list(asset?.rigDefinition?.rigidBindings);
    const meshDefinitions = list(asset?.meshDefinitions);
    const skinBindings = list(asset?.skinBindings);
    const part = parts.find(candidate => candidate?.partId === targetInternalLayerId) || null;
    const mesh = meshDefinitions.find(candidate => candidate?.targetInternalLayerId === targetInternalLayerId) || null;
    const rigidBinding = part
        ? rigidBindings.find(candidate => candidate?.partId === part.partId) || null
        : null;
    const boundBone = rigidBinding
        ? bones.find(candidate => candidate?.boneId === rigidBinding.boneId) || null
        : null;
    const parentBone = boundBone?.parentBoneId
        ? bones.find(candidate => candidate?.boneId === boundBone.parentBoneId) || null
        : null;
    const parentRigidBinding = parentBone
        ? rigidBindings.find(candidate => candidate?.boneId === parentBone.boneId) || null
        : null;
    const parentLayer = parentRigidBinding
        ? internalLayers.find(candidate => candidate?.id === parentRigidBinding.partId) || null
        : null;
    const parentLinkState = !boundBone
        ? 'missing'
        : (boundBone.parentBoneId == null
            ? 'root'
            : (parentBone ? 'linked' : 'broken'));
    const skinBinding = mesh
        ? skinBindings.find(candidate => candidate?.meshId === mesh.meshId) || null
        : null;
    const hasPart = !!part;
    const hasMesh = !!mesh;
    const meshState = options.meshState || options.meshStatus?.state || null;
    const rigidBoneIds = new Set(rigidBindings
        .map(candidate => candidate?.boneId)
        .filter(Boolean));
    const unboundBones = bones.filter(candidate => (
        candidate?.boneId && !rigidBoneIds.has(candidate.boneId)
    ));
    const skinBoneIds = new Set(list(skinBinding?.vertexWeights).flatMap(vertexWeight => (
        list(vertexWeight?.influences)
            .filter(influence => Number(influence?.weight) > 0)
            .map(influence => influence?.boneId)
            .filter(Boolean)
    )));
    const skinBones = bones.filter(candidate => skinBoneIds.has(candidate?.boneId));
    const missingSkinBoneCount = Math.max(0, skinBoneIds.size - skinBones.length);

    let status = RIG_AUTHORING_STATUS.NONE;
    if (hasPart && hasMesh) {
        status = RIG_AUTHORING_STATUS.CONFLICT;
    } else if (hasMesh && meshState === 'stale') {
        status = RIG_AUTHORING_STATUS.STALE;
    } else if (hasMesh) {
        status = RIG_AUTHORING_STATUS.BEND;
    } else if (hasPart && targetKind === 'folder') {
        status = RIG_AUTHORING_STATUS.PARENT;
    } else if (hasPart && targetKind === 'raster') {
        status = RIG_AUTHORING_STATUS.WHOLE;
    }

    const copy = STATUS_COPY[status];
    const resolvedMeshState = hasMesh ? (meshState || 'unknown') : 'missing';
    const meshGeneratorLabel = resolveMeshGeneratorLabel(mesh?.generator?.type || null);
    let bendSetupState = null;
    if (targetKind === 'raster') {
        if (hasPart && hasMesh) {
            bendSetupState = 'conflict';
        } else if (!hasMesh) {
            bendSetupState = unboundBones.length > 0 ? 'bone-ready' : 'bone-missing';
        } else if (resolvedMeshState === 'stale') {
            bendSetupState = 'stale';
        } else if (!skinBinding || skinBoneIds.size === 0 || missingSkinBoneCount > 0) {
            bendSetupState = 'mesh-unbound';
        } else {
            bendSetupState = 'ready';
        }
    }
    const bendSetup = targetKind === 'raster'
        ? {
            state: bendSetupState,
            boneCount: hasMesh ? skinBoneIds.size : unboundBones.length,
            boneState: hasMesh
                ? (missingSkinBoneCount > 0 || skinBoneIds.size === 0 ? 'broken' : 'connected')
                : (unboundBones.length > 0 ? 'candidate' : 'missing'),
            meshState: resolvedMeshState,
            meshGeneratorLabel,
            weightState: !skinBinding
                ? 'missing'
                : (missingSkinBoneCount > 0 || skinBoneIds.size === 0 ? 'broken' : 'connected'),
            nextActionLabel: {
                'bone-missing': 'BONEを追加',
                'bone-ready': 'Meshを作成',
                stale: 'Meshを更新',
                'mesh-unbound': '設定を確認',
                ready: 'Weightを確認',
                conflict: '競合を確認'
            }[bendSetupState] || '設定を確認'
        }
        : null;
    return {
        status,
        label: copy.label,
        badgeLabel: copy.badgeLabel,
        tooltip: copy.tooltip,
        targetInternalLayerId: targetInternalLayerId || null,
        layer,
        targetKind,
        isEligibleTarget: targetKind === 'folder' || targetKind === 'raster',
        isRigged: status !== RIG_AUTHORING_STATUS.NONE,
        hasPart,
        hasMesh,
        hasRootBoneBinding: !!boundBone,
        hasSkinBinding: !!skinBinding,
        part,
        mesh,
        rigidBinding,
        rootBone: boundBone,
        boundBone,
        parentBone,
        parentRigidBinding,
        parentLayer,
        parentLinkState,
        skinBinding,
        unboundBones,
        skinBones,
        bendSetup
    };
}
