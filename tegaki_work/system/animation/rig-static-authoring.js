/**
 * RIG Lens の初回 static Bone authoring preflight / geometry。
 * Bone構造はClipAsset単位、Mesh/Skin bindingはRaster単位の既存正本を使用する。
 */
import { evaluateRigidBones } from './part-rig.js';
import { applyTransformMatrix, invertTransformMatrixPoint } from '../transform-math.js';

const finitePoint = point => Number.isFinite(point?.x) && Number.isFinite(point?.y);
const STRUCTURE_BONE_LENGTH = 48;

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

/**
 * 構造編集で既存Bone正本へ登録するための、有効な仮Bind geometryを作る。
 * これは配置完了を意味しない。配置状態はRight Workspaceのruntime表示だけが持つ。
 */
export function planStaticRigStructureBone(asset, layerId, {
    kind, name, parentBoneId, rootPoint
} = {}) {
    const target = inspectStaticRigAuthoringTarget(asset, layerId);
    if (!target.ok) return target;
    const boneName = typeof name === 'string' && name.trim()
        ? name.trim().slice(0, 64)
        : kind === 'root' ? 'Root' : `Bone ${target.bones.length}`;
    if (kind === 'root') {
        if (target.bones.length !== 0 || !finitePoint(rootPoint)) {
            return { ok: false, reason: 'Rootは未設定の対象に一つだけ作成できます。' };
        }
        return {
            ok: true,
            options: {
                name: boneName,
                parentBoneId: null,
                bindTransform: {
                    x: rootPoint.x, y: rootPoint.y, scaleX: 1, scaleY: 1,
                    rotation: -Math.PI / 2, pivotX: 0, pivotY: 0
                },
                length: STRUCTURE_BONE_LENGTH
            }
        };
    }
    if (kind !== 'child' || target.bones.length === 0) {
        return { ok: false, reason: 'Rootを作成してから子Boneを追加してください。' };
    }
    const parent = target.bones.find(bone => bone.boneId === parentBoneId) || null;
    if (!parent) return { ok: false, reason: '同じRIG内の親Boneを選択してください。' };
    return {
        ok: true,
        options: {
            name: boneName,
            parentBoneId: parent.boneId,
            bindTransform: {
                x: parent.length, y: 0, scaleX: 1, scaleY: 1,
                rotation: -Math.PI / 2, pivotX: 0, pivotY: 0
            },
            length: STRUCTURE_BONE_LENGTH
        }
    };
}

/**
 * 初回Setup用に、今回の構造編集で新規作成されたBoneだけのBind方向を配置する。
 * 既存BoneのBind位置・長さ・階層は保持し、結果は既存Bind evaluatorでCanvas bounds内と確認する。
 */
export function planStaticRigInitialBoneLayout(asset, layerId, {
    boneIds = [], artworkBounds, canvasWidth, canvasHeight
} = {}) {
    const target = inspectStaticRigAuthoringTarget(asset, layerId);
    if (!target.ok) return target;
    if (!Array.isArray(boneIds) || boneIds.length === 0) {
        return { ok: true, reason: '', updates: [] };
    }
    if (![canvasWidth, canvasHeight].every(value => Number.isFinite(value) && value > 0)) {
        return { ok: false, reason: 'Canvas範囲を確認できません。', updates: [] };
    }
    const artworkCenter = resolveStaticRigRootCenter(artworkBounds);
    if (!artworkCenter.ok) return { ...artworkCenter, updates: [] };

    const bones = target.bones;
    const bonesById = new Map(bones.map(bone => [bone.boneId, bone]));
    const pendingIds = new Set(boneIds.filter(id => bonesById.has(id)));
    if (pendingIds.size === 0) return { ok: true, reason: '', updates: [] };
    const root = bones.find(bone => bone.parentBoneId == null);
    if (!root) return { ok: false, reason: '単一Rootを確認できません。', updates: [] };

    const childrenByParent = new Map();
    bones.forEach(bone => {
        if (bone.parentBoneId == null) return;
        const children = childrenByParent.get(bone.parentBoneId) || [];
        children.push(bone);
        childrenByParent.set(bone.parentBoneId, children);
    });

    const rootIsNew = pendingIds.has(root.boneId);
    const canvasCenter = { x: canvasWidth / 2, y: canvasHeight / 2 };
    const centerDeltaX = canvasCenter.x - artworkCenter.point.x;
    const centerDeltaY = canvasCenter.y - artworkCenter.point.y;
    const preferredRootRotation = rootIsNew
        ? (Math.hypot(centerDeltaX, centerDeltaY) > 1
            ? Math.atan2(centerDeltaY, centerDeltaX)
            : -Math.PI / 2)
        : Number(root.bindTransform?.rotation);
    const rootRotations = rootIsNew
        ? [0, ...Array.from({ length: 12 }, (_, index) => (index + 1) * Math.PI / 12)
            .flatMap(offset => [offset, -offset])]
            .map(offset => preferredRootRotation + offset)
        : [preferredRootRotation];
    const fanSpreads = [
        Math.PI * 0.5, Math.PI * 0.42, Math.PI * 0.36,
        Math.PI * 0.30, Math.PI * 0.24, Math.PI * 0.18, Math.PI / 12
    ];

    for (const fanSpread of fanSpreads) {
        for (const rootRotation of rootRotations) {
            const rotations = new Map();
            if (rootIsNew) rotations.set(root.boneId, rootRotation);
            childrenByParent.forEach((siblings) => {
                const denominator = Math.max(1, siblings.length - 1);
                siblings.forEach((bone, index) => {
                    if (!pendingIds.has(bone.boneId)) return;
                    const angle = siblings.length < 2
                        ? 0
                        : ((index / denominator) * 2 - 1) * fanSpread;
                    rotations.set(bone.boneId, angle);
                });
            });

            const candidateBones = bones.map(bone => rotations.has(bone.boneId)
                ? {
                    ...bone,
                    bindTransform: { ...bone.bindTransform, rotation: rotations.get(bone.boneId) }
                }
                : bone);
            const evaluated = evaluateRigidBones({
                ...asset,
                rigDefinition: { ...(asset.rigDefinition || {}), bones: candidateBones }
            }, null, 0);
            if (!evaluated.ok) continue;

            const inCanvas = [...pendingIds].every(boneId => {
                const bone = bonesById.get(boneId);
                const matrix = evaluated.poseByBoneId.get(boneId)?.worldMatrix;
                if (!bone || !matrix) return false;
                const head = applyTransformMatrix(matrix, 0, 0);
                const tail = applyTransformMatrix(matrix, bone.length, 0);
                return [head.x, head.y, tail.x, tail.y].every(Number.isFinite)
                    && [head, tail].every(point => (
                        point.x >= 0 && point.x <= canvasWidth
                        && point.y >= 0 && point.y <= canvasHeight
                    ));
            });
            if (!inCanvas) continue;

            const updates = [...rotations].flatMap(([boneId, rotation]) => {
                const bone = bonesById.get(boneId);
                return bone && bone.bindTransform?.rotation !== rotation
                    ? [{ boneId, bindTransform: { rotation } }]
                    : [];
            });
            return { ok: true, reason: '', updates, fanSpread, rootRotation };
        }
    }

    return {
        ok: false,
        reason: '初期配置がCanvas内に収まりません。階層を浅くするか、RootをCanvas内側へ配置してください。',
        updates: []
    };
}
