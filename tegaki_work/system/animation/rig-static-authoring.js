/**
 * RIG Lens の初回 static Bone authoring preflight / geometry。
 * 未接続BoneにはRaster ownerが保存されないため、単一Raster Assetだけを扱う。
 */
import { evaluateRigidBones } from './part-rig.js';
import { invertTransformMatrixPoint } from '../transform-math.js';

const finitePoint = point => Number.isFinite(point?.x) && Number.isFinite(point?.y);

export function inspectStaticRigAuthoringTarget(asset, layerId) {
    if (!asset || !layerId) return { ok: false, reason: 'CAFとRasterを選択してください。', bones: [] };
    const rasters = (asset.internalLayers || []).filter(layer => layer?.type === 'raster' && !layer.isBackground);
    if (rasters.length !== 1 || rasters[0]?.id !== layerId || rasters[0]?.parentLayerId != null) {
        return { ok: false, reason: '未接続Boneの保存先を一意にするため、CAF直下のRasterが一枚のAssetだけ編集できます。', bones: [] };
    }
    const rig = asset.rigDefinition;
    if ((rig?.parts?.length || 0) > 0 || (rig?.rigidBindings?.length || 0) > 0
        || (asset.meshDefinitions?.length || 0) > 0 || (asset.skinBindings?.length || 0) > 0
        || (rig?.warpAnchorConstraints?.length || 0) > 0) {
        return { ok: false, reason: '既存のBinding／Mesh／複合RIGはこの初回編集面では変更できません。', bones: [] };
    }
    const bones = rig?.bones || [];
    if (!Array.isArray(bones) || bones.length > 2
        || (bones.length > 0 && bones[0]?.parentBoneId != null)
        || (bones.length === 2 && bones[1]?.parentBoneId !== bones[0]?.boneId)
        || bones.some(bone => !bone?.boneId || !Number.isFinite(bone.length) || bone.length <= 0)) {
        return { ok: false, reason: '既存Bone構造は初回の一階層編集範囲外です。', bones: [] };
    }
    return { ok: true, bones };
}

export function planStaticRigBone(asset, layerId, { kind, start, end } = {}) {
    const target = inspectStaticRigAuthoringTarget(asset, layerId);
    if (!target.ok) return target;
    if (!finitePoint(end)) return { ok: false, reason: 'Canvas座標を取得できません。' };
    if (kind === 'root') {
        if (target.bones.length !== 0 || !finitePoint(start)) {
            return { ok: false, reason: 'Rootは未設定の対象に一つだけ配置できます。' };
        }
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const distance = Math.hypot(dx, dy);
        if (!Number.isFinite(distance)) return { ok: false, reason: '不正なBone座標です。' };
        const dragged = distance >= 4;
        return {
            ok: true,
            options: {
                name: 'Root',
                parentBoneId: null,
                bindTransform: {
                    x: start.x, y: start.y, scaleX: 1, scaleY: 1,
                    rotation: dragged ? Math.atan2(dy, dx) : -Math.PI / 2,
                    pivotX: 0, pivotY: 0
                },
                length: dragged ? distance : 48
            }
        };
    }
    if (kind !== 'child' || target.bones.length !== 1) {
        return { ok: false, reason: '子Boneは選択中のRootから一つだけ追加できます。' };
    }
    const root = target.bones[0];
    const evaluated = evaluateRigidBones(asset, null, 0);
    const parentMatrix = evaluated.ok ? evaluated.poseByBoneId.get(root.boneId)?.worldMatrix : null;
    const localEnd = parentMatrix
        ? invertTransformMatrixPoint(parentMatrix, end.x, end.y)
        : null;
    if (!finitePoint(localEnd)) return { ok: false, reason: 'RootのBind位置を解決できません。' };
    const dx = localEnd.x - root.length;
    const dy = localEnd.y;
    const length = Math.hypot(dx, dy);
    if (!Number.isFinite(length) || length < 4) {
        return { ok: false, reason: '子Boneの長さは4px以上にしてください。' };
    }
    return {
        ok: true,
        options: {
            name: 'Bone 1',
            parentBoneId: root.boneId,
            bindTransform: {
                x: root.length, y: 0, scaleX: 1, scaleY: 1,
                rotation: Math.atan2(dy, dx), pivotX: 0, pivotY: 0
            },
            length
        }
    };
}
