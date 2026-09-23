/**
 * RIG Lens の初回 static Bone authoring preflight / geometry。
 * 未接続BoneにはRaster ownerが保存されないため、単一Raster Assetだけを扱う。
 */
import { evaluateRigidBones } from './part-rig.js';
import { invertTransformMatrixPoint } from '../transform-math.js';

const finitePoint = point => Number.isFinite(point?.x) && Number.isFinite(point?.y);

export function inspectStaticRigAuthoringTarget(asset, layerId, options = {}) {
    if (!asset || !layerId) return { ok: false, reason: 'CAFとRasterを選択してください。', bones: [] };
    const rasters = (asset.internalLayers || []).filter(layer => layer?.type === 'raster' && !layer.isBackground);
    if (rasters.length !== 1 || rasters[0]?.id !== layerId || rasters[0]?.parentLayerId != null) {
        return { ok: false, reason: '未接続Boneの保存先を一意にするため、CAF直下のRasterが一枚のAssetだけ編集できます。', bones: [] };
    }
    const rig = asset.rigDefinition;
    if ((rig?.parts?.length || 0) > 0 || (rig?.rigidBindings?.length || 0) > 0
        || (options.allowBound !== true
            && ((asset.meshDefinitions?.length || 0) > 0 || (asset.skinBindings?.length || 0) > 0))
        || (rig?.warpAnchorConstraints?.length || 0) > 0) {
        return { ok: false, reason: '既存のBinding／Mesh／複合RIGはこの初回編集面では変更できません。', bones: [] };
    }
    const bones = rig?.bones || [];
    if (!Array.isArray(bones) || bones.length > 3
        || (bones.length > 0 && bones[0]?.parentBoneId != null)
        || bones.slice(1).some((bone, index) =>
            !bones.slice(0, index + 1).some(parent => parent?.boneId === bone?.parentBoneId))
        || bones.some(bone => !bone?.boneId || !Number.isFinite(bone.length) || bone.length <= 0)) {
        return { ok: false, reason: '既存Bone構造は単一Rasterの3 Bone編集範囲外です。', bones: [] };
    }
    return { ok: true, bones };
}

export function planStaticRigBone(asset, layerId, { kind, start, end, parentBoneId } = {}) {
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
    if (kind !== 'child' || target.bones.length === 0 || target.bones.length >= 3) {
        return { ok: false, reason: '子Boneは選択中のBoneから、合計3 Boneまで追加できます。' };
    }
    // Preserve the single-Root caller contract; a deeper hierarchy requires an explicit selection.
    const selectedParentId = parentBoneId || (target.bones.length === 1 ? target.bones[0].boneId : null);
    const parent = target.bones.find(bone => bone.boneId === selectedParentId);
    if (!parent) return { ok: false, reason: '親Boneを選択してください。' };
    const evaluated = evaluateRigidBones(asset, null, 0);
    const parentMatrix = evaluated.ok ? evaluated.poseByBoneId.get(parent.boneId)?.worldMatrix : null;
    const localEnd = parentMatrix
        ? invertTransformMatrixPoint(parentMatrix, end.x, end.y)
        : null;
    if (!finitePoint(localEnd)) return { ok: false, reason: '親BoneのBind位置を解決できません。' };
    const dx = localEnd.x - parent.length;
    const dy = localEnd.y;
    const length = Math.hypot(dx, dy);
    if (!Number.isFinite(length) || length < 4) {
        return { ok: false, reason: '子Boneの長さは4px以上にしてください。' };
    }
    return {
        ok: true,
        options: {
            name: `Bone ${target.bones.length}`,
            parentBoneId: parent.boneId,
            bindTransform: {
                x: parent.length, y: 0, scaleX: 1, scaleY: 1,
                rotation: Math.atan2(dy, dx), pivotX: 0, pivotY: 0
            },
            length
        }
    };
}
