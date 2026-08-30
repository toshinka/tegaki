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
    const rootBone = rigidBinding
        ? bones.find(candidate => (
            candidate?.boneId === rigidBinding.boneId
            && candidate.parentBoneId == null
        )) || null
        : null;
    const skinBinding = mesh
        ? skinBindings.find(candidate => candidate?.meshId === mesh.meshId) || null
        : null;
    const hasPart = !!part;
    const hasMesh = !!mesh;
    const meshState = options.meshState || options.meshStatus?.state || null;

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
        hasRootBoneBinding: !!rootBone,
        hasSkinBinding: !!skinBinding,
        part,
        mesh,
        rigidBinding,
        rootBone,
        skinBinding
    };
}
