/**
 * RIG Lens の初回 static Bone authoring preflight / geometry。
 * Bone構造はClipAsset単位、Mesh/Skin bindingはRaster単位の既存正本を使用する。
 */
import { evaluateRigidBones } from './part-rig.js';
import { invertTransformMatrixPoint } from '../transform-math.js';

const finitePoint = point => Number.isFinite(point?.x) && Number.isFinite(point?.y);

export function resolveStaticRigRootCenter(bounds) {
    if (![bounds?.x, bounds?.y, bounds?.width, bounds?.height].every(Number.isFinite)
        || bounds.width <= 0 || bounds.height <= 0) {
        return { ok: false, reason: 'Artwork Boundsを確認できません。', point: null };
    }
    const point = {
        x: bounds.x + bounds.width / 2,
        y: bounds.y + bounds.height / 2
    };
    return finitePoint(point)
        ? { ok: true, reason: '', point }
        : { ok: false, reason: 'Artwork Boundsの中心座標が不正です。', point: null };
}

export function inspectStaticRigAuthoringTarget(asset, layerId, options = {}) {
    if (!asset || !layerId) return { ok: false, reason: 'CAFとRasterを選択してください。', bones: [] };
    const layer = (asset.internalLayers || []).find(candidate => candidate?.id === layerId) || null;
    if (!layer) return { ok: false, reason: 'CAF内のRasterを選択してください。', bones: [] };
    if (layer.type !== 'raster' || layer.isBackground === true) {
        return { ok: false, reason: '背景以外のRasterを選択してください。', bones: [] };
    }
    if (layer.parentLayerId != null) {
        return { ok: false, reason: 'CAF直下のRasterを選択してください。', bones: [] };
    }
    const rig = asset.rigDefinition;
    if ((rig?.parts?.length || 0) > 0 || (rig?.rigidBindings?.length || 0) > 0
        || (rig?.warpAnchorConstraints?.length || 0) > 0) {
        return { ok: false, reason: '既存のBinding／Mesh／複合RIGはこの初回編集面では変更できません。', bones: [] };
    }
    const meshDefinitions = Array.isArray(asset.meshDefinitions) ? asset.meshDefinitions : [];
    const skinBindings = Array.isArray(asset.skinBindings) ? asset.skinBindings : [];
    const targetMesh = meshDefinitions.find(mesh => mesh?.targetInternalLayerId === layerId) || null;
    if (options.allowBound !== true) {
        if (options.allowExistingOtherRasterBindings === true) {
            if (targetMesh) {
                return { ok: false, reason: 'このRasterはすでにArtworkへ接続されています。', bones: [] };
            }
        } else if (meshDefinitions.length > 0 || skinBindings.length > 0) {
            return { ok: false, reason: 'Artwork接続後はBone構造を変更できません。', bones: [] };
        }
    }
    const bones = rig?.bones ?? [];
    const boneIds = new Set(Array.isArray(bones) ? bones.map(bone => bone?.boneId) : []);
    const rootCount = Array.isArray(bones)
        ? bones.filter(bone => bone?.parentBoneId == null).length : -1;
    const validBoneData = Array.isArray(bones) && bones.every(bone => (
        !!bone?.boneId
        && Number.isFinite(bone.length)
        && bone.length > 0
        && (bone.parentBoneId == null || boneIds.has(bone.parentBoneId))
    ));
    const evaluated = Array.isArray(bones) && bones.length > 0
        ? evaluateRigidBones(asset, null, 0) : null;
    if (!validBoneData
        || (bones.length > 0 && rootCount !== 1)
        || (evaluated && !evaluated.ok)) {
        return { ok: false, reason: '既存Bone構造を安全に編集できません。', bones: [] };
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
    if (kind !== 'child' || target.bones.length === 0) {
        return { ok: false, reason: '子Boneは選択中のBoneから追加できます。' };
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
