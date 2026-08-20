/**
 * CAF Part / BONEのoptional保存schema、ID remap、validation、rigid FKを提供する純粋module。
 * Part identityはClipAsset internal Layer / Folderのstable idを再利用し、
 * display parent (`parentLayerId`) とrig parent (`parentPartId`)を混同しない。
 * Bone identity (`boneId`) とBone hierarchy (`parentBoneId`)もdisplay / Part階層から分離する。
 * Bind PoseはClipAsset.rigDefinition、Animate PoseはClipInstance.rigMotionだけが所有する。
 * Pixi / DOM / working Layer / Historyは所有しない。
 */

import { sampleTransformTrack } from './clip-transform-sampler.js';
import {
    createAffineTransformMatrix,
    invertTransformMatrix,
    multiplyTransformMatrices
} from '../transform-math.js';

export const PART_RIG_SCHEMA_VERSION = 1;

const PART_TRANSFORM_DEFAULTS = Object.freeze({
    x: 0,
    y: 0,
    scaleX: 1,
    scaleY: 1,
    rotation: 0,
    pivotX: 0,
    pivotY: 0
});

const PART_MOTION_FIELDS = Object.freeze(['x', 'y', 'scaleX', 'scaleY', 'rotation']);
const PART_BIND_FIELDS = Object.freeze([...PART_MOTION_FIELDS, 'pivotX', 'pivotY']);
const BONE_MOTION_FIELDS = PART_MOTION_FIELDS;
const BONE_BIND_FIELDS = PART_BIND_FIELDS;

function clonePlainValue(value) {
    if (value === undefined) return undefined;
    if (value === null || typeof value !== 'object') return value;
    try {
        return structuredClone(value);
    } catch {
        try {
            return JSON.parse(JSON.stringify(value));
        } catch {
            return value;
        }
    }
}

function hasOwn(value, key) {
    return value != null && Object.prototype.hasOwnProperty.call(value, key);
}

function normalizePartTransform(value, fields = PART_BIND_FIELDS) {
    const source = value && typeof value === 'object' ? clonePlainValue(value) : {};
    return fields.reduce((result, field) => {
        result[field] = hasOwn(source, field) ? source[field] : PART_TRANSFORM_DEFAULTS[field];
        return result;
    }, {});
}

function normalizePartDefinition(part) {
    if (!part || typeof part !== 'object' || Array.isArray(part)) return clonePlainValue(part);
    return {
        ...clonePlainValue(part),
        partId: hasOwn(part, 'partId') ? part.partId : null,
        parentPartId: hasOwn(part, 'parentPartId') ? part.parentPartId : null,
        bindTransform: normalizePartTransform(part.bindTransform)
    };
}

function normalizePartTrack(track) {
    if (!track || typeof track !== 'object' || Array.isArray(track)) return clonePlainValue(track);
    return {
        ...clonePlainValue(track),
        partId: hasOwn(track, 'partId') ? track.partId : null,
        keyframes: Array.isArray(track.keyframes)
            ? track.keyframes.map(key => clonePlainValue(key))
            : clonePlainValue(track.keyframes)
    };
}

function normalizeBoneDefinition(bone) {
    if (!bone || typeof bone !== 'object' || Array.isArray(bone)) return clonePlainValue(bone);
    return {
        ...clonePlainValue(bone),
        boneId: hasOwn(bone, 'boneId') ? bone.boneId : null,
        parentBoneId: hasOwn(bone, 'parentBoneId') ? bone.parentBoneId : null,
        bindTransform: normalizePartTransform(bone.bindTransform, BONE_BIND_FIELDS),
        length: hasOwn(bone, 'length') ? bone.length : 0
    };
}

function normalizeBoneTrack(track) {
    if (!track || typeof track !== 'object' || Array.isArray(track)) return clonePlainValue(track);
    return {
        ...clonePlainValue(track),
        boneId: hasOwn(track, 'boneId') ? track.boneId : null,
        keyframes: Array.isArray(track.keyframes)
            ? track.keyframes.map(key => clonePlainValue(key))
            : clonePlainValue(track.keyframes)
    };
}

function normalizeRigidBinding(binding) {
    if (!binding || typeof binding !== 'object' || Array.isArray(binding)) return clonePlainValue(binding);
    return {
        ...clonePlainValue(binding),
        boneId: hasOwn(binding, 'boneId') ? binding.boneId : null,
        partId: hasOwn(binding, 'partId') ? binding.partId : null
    };
}

export function normalizeRigDefinition(value) {
    if (value == null) return null;
    if (typeof value !== 'object' || Array.isArray(value)) return clonePlainValue(value);
    return {
        ...clonePlainValue(value),
        version: hasOwn(value, 'version') ? value.version : PART_RIG_SCHEMA_VERSION,
        parts: Array.isArray(value.parts)
            ? value.parts.map(normalizePartDefinition)
            : clonePlainValue(value.parts),
        ...(hasOwn(value, 'bones')
            ? {
                bones: Array.isArray(value.bones)
                    ? value.bones.map(normalizeBoneDefinition)
                    : clonePlainValue(value.bones)
            }
            : {}),
        ...(hasOwn(value, 'rigidBindings')
            ? {
                rigidBindings: Array.isArray(value.rigidBindings)
                    ? value.rigidBindings.map(normalizeRigidBinding)
                    : clonePlainValue(value.rigidBindings)
            }
            : {})
    };
}

export function normalizeRigMotion(value) {
    if (value == null) return null;
    if (typeof value !== 'object' || Array.isArray(value)) return clonePlainValue(value);
    return {
        ...clonePlainValue(value),
        version: hasOwn(value, 'version') ? value.version : PART_RIG_SCHEMA_VERSION,
        partTracks: Array.isArray(value.partTracks)
            ? value.partTracks.map(normalizePartTrack)
            : clonePlainValue(value.partTracks),
        ...(hasOwn(value, 'boneTracks')
            ? {
                boneTracks: Array.isArray(value.boneTracks)
                    ? value.boneTracks.map(normalizeBoneTrack)
                    : clonePlainValue(value.boneTracks)
            }
            : {})
    };
}

export function serializeRigDefinition(value) {
    return normalizeRigDefinition(value);
}

export function serializeRigMotion(value) {
    return normalizeRigMotion(value);
}

export function createIdentityPartDefinition(partId) {
    return {
        partId,
        parentPartId: null,
        bindTransform: normalizePartTransform(null)
    };
}

export function createRootBoneDefinition(boneId, options = {}) {
    return {
        boneId,
        parentBoneId: null,
        bindTransform: normalizePartTransform(options.bindTransform, BONE_BIND_FIELDS),
        length: hasOwn(options, 'length') ? options.length : 0,
        ...(typeof options.name === 'string' && options.name.length > 0
            ? { name: options.name }
            : {})
    };
}

/**
 * Partのsource pointが指定Project座標に留まるよう、motionのx/yを再計算する。
 * Canvas handleのscale / rotateがFolder内容の見た目中心を基準に動くための純粋代数で、
 * bindTransformやkey正本を所有しない。
 */
export function rebasePartMotionAroundPoint(bindTransform, motionTransform, sourcePoint, targetPoint) {
    const bind = normalizePartTransform(bindTransform);
    const motion = normalizePartTransform(motionTransform, PART_MOTION_FIELDS);
    const sourceX = Number(sourcePoint?.x);
    const sourceY = Number(sourcePoint?.y);
    const targetX = Number(targetPoint?.x);
    const targetY = Number(targetPoint?.y);
    if (![sourceX, sourceY, targetX, targetY].every(Number.isFinite)) return motion;

    const scaleX = bind.scaleX * motion.scaleX;
    const scaleY = bind.scaleY * motion.scaleY;
    const rotation = bind.rotation + motion.rotation;
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    const a = scaleX * cos;
    const b = scaleX * sin;
    const c = -scaleY * sin;
    const d = scaleY * cos;
    const finalX = targetX
        - bind.pivotX
        - a * (sourceX - bind.pivotX)
        - c * (sourceY - bind.pivotY);
    const finalY = targetY
        - bind.pivotY
        - b * (sourceX - bind.pivotX)
        - d * (sourceY - bind.pivotY);
    return {
        ...motion,
        x: finalX - bind.x,
        y: finalY - bind.y
    };
}

/** Canvas handleのfixed-input解決。modeごとのgesture状態を保存せず、同じ入力から同じkey値を返す。 */
export function resolvePartTransformHandleDrag(options = {}) {
    const mode = options.mode;
    const start = normalizePartTransform(options.startTransform, PART_MOTION_FIELDS);
    const startPointer = options.startPointer;
    const currentPointer = options.currentPointer;
    if (![startPointer?.x, startPointer?.y, currentPointer?.x, currentPointer?.y]
        .every(Number.isFinite)) return start;
    if (mode === 'move') {
        return {
            ...start,
            x: start.x + currentPointer.x - startPointer.x,
            y: start.y + currentPointer.y - startPointer.y
        };
    }

    const center = options.fixedCenter;
    const sourceCenter = options.sourceCenter;
    if (![center?.x, center?.y, sourceCenter?.x, sourceCenter?.y].every(Number.isFinite)) return start;
    const next = { ...start };
    if (mode === 'rotate') {
        const startAngle = Number.isFinite(options.startAngle)
            ? options.startAngle
            : Math.atan2(startPointer.y - center.y, startPointer.x - center.x);
        next.rotation += Math.atan2(
            currentPointer.y - center.y,
            currentPointer.x - center.x
        ) - startAngle;
    } else if (mode === 'scale') {
        const startDistance = Number.isFinite(options.startDistance) && options.startDistance > 0
            ? options.startDistance
            : Math.hypot(startPointer.x - center.x, startPointer.y - center.y) || 1;
        const factor = Math.max(0.08, Math.min(12,
            Math.hypot(currentPointer.x - center.x, currentPointer.y - center.y) / startDistance
        ));
        const minScale = Number.isFinite(options.minScale) ? Math.max(0.001, options.minScale) : 0.1;
        const maxScale = Number.isFinite(options.maxScale)
            ? Math.max(minScale, options.maxScale)
            : 30;
        const scaleValue = value => {
            const sign = value < 0 ? -1 : 1;
            return sign * Math.max(minScale, Math.min(maxScale, Math.abs(value * factor)));
        };
        next.scaleX = scaleValue(start.scaleX);
        next.scaleY = scaleValue(start.scaleY);
    } else {
        return start;
    }
    return rebasePartMotionAroundPoint(
        options.bindTransform,
        next,
        sourceCenter,
        center
    );
}

/** root Bone先端dragをrotation Poseへ変換する純粋helper。 */
export function resolveBoneRotationHandleDrag(options = {}) {
    const start = normalizePartTransform(options.startTransform, BONE_MOTION_FIELDS);
    const root = options.root;
    const currentPointer = options.currentPointer;
    const startAngle = Number(options.startAngle);
    if (![root?.x, root?.y, currentPointer?.x, currentPointer?.y, startAngle].every(Number.isFinite)) {
        return start;
    }
    const currentAngle = Math.atan2(currentPointer.y - root.y, currentPointer.x - root.x);
    let delta = currentAngle - startAngle;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    return { ...start, rotation: start.rotation + delta };
}

/** root Bone中心dragをtranslation Poseへ変換する純粋helper。 */
export function resolveBoneRootHandleDrag(options = {}) {
    const start = normalizePartTransform(options.startTransform, BONE_MOTION_FIELDS);
    const startPointer = options.startPointer;
    const currentPointer = options.currentPointer;
    if (![startPointer?.x, startPointer?.y, currentPointer?.x, currentPointer?.y]
        .every(Number.isFinite)) {
        return start;
    }
    return {
        ...start,
        x: start.x + currentPointer.x - startPointer.x,
        y: start.y + currentPointer.y - startPointer.y
    };
}

/** ClipAssetの既存Rig定義へ、internal Folder IDをPart identityとして追加する純粋helper。 */
export function registerRigPartDefinition(rigDefinition, partId, options = {}) {
    if (typeof partId !== 'string' || partId.length === 0) {
        return { ok: false, reason: 'invalid-part-id', value: rigDefinition, part: null };
    }
    const normalized = rigDefinition == null
        ? { version: PART_RIG_SCHEMA_VERSION, parts: [] }
        : normalizeRigDefinition(rigDefinition);
    if (!normalized || !Array.isArray(normalized.parts)) {
        return { ok: false, reason: 'invalid-rig-definition', value: normalized, part: null };
    }
    const existing = normalized.parts.find(part => part?.partId === partId) || null;
    if (existing) {
        return { ok: true, changed: false, value: normalized, part: existing };
    }
    const maxParts = Number.isInteger(options.maxParts) && options.maxParts >= 0
        ? options.maxParts
        : Number.POSITIVE_INFINITY;
    if (normalized.parts.length >= maxParts) {
        return { ok: false, reason: 'part-limit', value: normalized, part: null };
    }
    const part = createIdentityPartDefinition(partId);
    return {
        ok: true,
        changed: true,
        value: {
            ...normalized,
            parts: [...normalized.parts, part]
        },
        part
    };
}

/** 一つのroot Boneと一つの既存Folder Partを同じstatic Setup更新として登録する。 */
export function registerRootBoneRigidBinding(rigDefinition, boneId, partId, options = {}) {
    if (typeof boneId !== 'string' || boneId.length === 0) {
        return { ok: false, reason: 'invalid-bone-id', value: rigDefinition, bone: null, binding: null };
    }
    if (typeof partId !== 'string' || partId.length === 0) {
        return { ok: false, reason: 'invalid-part-id', value: rigDefinition, bone: null, binding: null };
    }
    const normalized = normalizeRigDefinition(rigDefinition);
    if (!normalized || !Array.isArray(normalized.parts)) {
        return { ok: false, reason: 'invalid-rig-definition', value: normalized, bone: null, binding: null };
    }
    if (!normalized.parts.some(part => part?.partId === partId)) {
        return { ok: false, reason: 'part-not-found', value: normalized, bone: null, binding: null };
    }
    const bones = Array.isArray(normalized.bones) ? normalized.bones : [];
    const bindings = Array.isArray(normalized.rigidBindings) ? normalized.rigidBindings : [];
    const existingBinding = bindings.find(binding => binding?.partId === partId) || null;
    const existingBone = existingBinding
        ? bones.find(bone => bone?.boneId === existingBinding.boneId) || null
        : null;
    if (existingBone && existingBinding) {
        return {
            ok: true,
            changed: false,
            value: normalized,
            bone: existingBone,
            binding: existingBinding
        };
    }
    if (bones.some(candidate => candidate?.boneId === boneId)) {
        return { ok: false, reason: 'duplicate-bone-id', value: normalized, bone: null, binding: null };
    }
    const maxBones = Number.isInteger(options.maxBones) && options.maxBones >= 0
        ? options.maxBones
        : Number.POSITIVE_INFINITY;
    if (bones.length >= maxBones) {
        return { ok: false, reason: 'bone-limit', value: normalized, bone: null, binding: null };
    }
    const bone = {
        ...createRootBoneDefinition(boneId, options),
        parentBoneId: options.parentBoneId || null
    };
    const binding = { boneId, partId };
    return {
        ok: true,
        changed: true,
        value: {
            ...normalized,
            bones: [...bones, bone],
            rigidBindings: [...bindings, binding]
        },
        bone,
        binding
    };
}

/** static SetupのBone Bind Transformだけをimmutableに更新する。Frame Pose正本は触らない。 */
export function updateRigBoneBindTransform(rigDefinition, boneId, transform = {}) {
    const normalized = normalizeRigDefinition(rigDefinition);
    if (!normalized || !Array.isArray(normalized.bones)) {
        return { ok: false, reason: 'invalid-rig-definition', value: normalized, bone: null };
    }
    const boneIndex = normalized.bones.findIndex(bone => bone?.boneId === boneId);
    if (boneIndex < 0) {
        return { ok: false, reason: 'bone-not-found', value: normalized, bone: null };
    }
    const previous = normalized.bones[boneIndex];
    const bone = {
        ...previous,
        bindTransform: normalizePartTransform({
            ...previous.bindTransform,
            ...clonePlainValue(transform)
        }, BONE_BIND_FIELDS)
    };
    const bones = normalized.bones.map((candidate, index) => index === boneIndex ? bone : candidate);
    return {
        ok: true,
        changed: BONE_BIND_FIELDS.some(field => bone.bindTransform[field] !== previous.bindTransform[field]),
        value: { ...normalized, bones },
        bone
    };
}

function decomposeRigMatrix(matrix) {
    const scaleX = Math.hypot(matrix.a, matrix.b);
    if (!Number.isFinite(scaleX) || scaleX < 1e-8) return null;
    const determinant = matrix.a * matrix.d - matrix.b * matrix.c;
    const scaleY = determinant / scaleX;
    return {
        x: matrix.tx,
        y: matrix.ty,
        scaleX,
        scaleY,
        rotation: Math.atan2(matrix.b, matrix.a),
        pivotX: 0,
        pivotY: 0
    };
}

/** parentBoneIdだけを更新し、現在のBind world matrixを保つ。 */
export function updateRigBoneParent(rigDefinition, boneId, parentBoneId = null) {
    const normalized = normalizeRigDefinition(rigDefinition);
    if (!normalized || !Array.isArray(normalized.bones)) {
        return { ok: false, reason: 'invalid-rig-definition', value: normalized, bone: null };
    }
    const bone = normalized.bones.find(candidate => candidate?.boneId === boneId) || null;
    const parent = parentBoneId
        ? normalized.bones.find(candidate => candidate?.boneId === parentBoneId) || null
        : null;
    if (!bone) return { ok: false, reason: 'bone-not-found', value: normalized, bone: null };
    if (parentBoneId && !parent) {
        return { ok: false, reason: 'parent-bone-not-found', value: normalized, bone: null };
    }
    if (boneId === parentBoneId) {
        return { ok: false, reason: 'self-parent-bone', value: normalized, bone: null };
    }
    const descendantIds = new Set();
    const visitDescendants = currentId => {
        normalized.bones.forEach(candidate => {
            if (candidate?.parentBoneId !== currentId || descendantIds.has(candidate.boneId)) return;
            descendantIds.add(candidate.boneId);
            visitDescendants(candidate.boneId);
        });
    };
    visitDescendants(boneId);
    if (parentBoneId && descendantIds.has(parentBoneId)) {
        return { ok: false, reason: 'bone-cycle', value: normalized, bone: null };
    }
    if ((bone.parentBoneId || null) === (parentBoneId || null)) {
        return { ok: true, changed: false, value: normalized, bone };
    }

    const { ordered } = orderRigHierarchy(normalized.bones, 'boneId', 'parentBoneId');
    const worldById = new Map();
    ordered.forEach(candidate => {
        const local = createAffineTransformMatrix(candidate.bindTransform);
        const parentWorld = candidate.parentBoneId ? worldById.get(candidate.parentBoneId) : null;
        worldById.set(
            candidate.boneId,
            parentWorld ? multiplyTransformMatrices(parentWorld, local) : local
        );
    });
    const previousWorld = worldById.get(boneId);
    const parentWorld = parentBoneId ? worldById.get(parentBoneId) : null;
    const inverseParent = parentWorld ? invertTransformMatrix(parentWorld) : null;
    if (!previousWorld || (parentWorld && !inverseParent)) {
        return { ok: false, reason: 'non-invertible-parent-bind', value: normalized, bone: null };
    }
    const localMatrix = inverseParent
        ? multiplyTransformMatrices(inverseParent, previousWorld)
        : previousWorld;
    const bindTransform = decomposeRigMatrix(localMatrix);
    if (!bindTransform) {
        return { ok: false, reason: 'non-decomposable-bind', value: normalized, bone: null };
    }
    const updatedBone = {
        ...bone,
        parentBoneId: parentBoneId || null,
        bindTransform
    };
    return {
        ok: true,
        changed: true,
        value: {
            ...normalized,
            bones: normalized.bones.map(candidate => (
                candidate?.boneId === boneId ? updatedBone : candidate
            ))
        },
        bone: updatedBone
    };
}

export function getRigPartTrack(rigMotion, partId) {
    const normalized = normalizeRigMotion(rigMotion);
    if (!normalized || !Array.isArray(normalized.partTracks)) return null;
    return normalized.partTracks.find(track => track?.partId === partId) || null;
}

export function getRigPartKeyAtFrame(rigMotion, partId, localFrame) {
    if (!Number.isInteger(localFrame)) return null;
    return getRigPartTrack(rigMotion, partId)?.keyframes
        ?.findLast?.(key => key?.frame === localFrame) || null;
}

function moveRigTrackKey(rigMotion, trackField, idField, targetId, sourceFrame, targetFrame) {
    if (
        typeof targetId !== 'string'
        || targetId.length === 0
        || !Number.isInteger(sourceFrame)
        || sourceFrame < 0
        || !Number.isInteger(targetFrame)
        || targetFrame < 0
    ) {
        return { ok: false, reason: 'invalid-rig-key-move-target', value: rigMotion, key: null };
    }
    const normalized = normalizeRigMotion(rigMotion);
    const tracks = Array.isArray(normalized?.[trackField]) ? normalized[trackField] : null;
    if (!normalized || !tracks) {
        return { ok: false, reason: 'rig-key-not-found', value: rigMotion, key: null };
    }
    const trackIndex = tracks.findIndex(track => track?.[idField] === targetId);
    const sourceTrack = trackIndex >= 0 ? tracks[trackIndex] : null;
    const sourceKeyIndex = sourceTrack?.keyframes?.findIndex(key => key?.frame === sourceFrame) ?? -1;
    if (sourceKeyIndex < 0) {
        return { ok: false, reason: 'rig-key-not-found', value: normalized, key: null };
    }
    if (sourceFrame === targetFrame) {
        return {
            ok: true,
            changed: false,
            value: normalized,
            key: clonePlainValue(sourceTrack.keyframes[sourceKeyIndex])
        };
    }
    if (sourceTrack.keyframes.some((key, index) => index !== sourceKeyIndex && key?.frame === targetFrame)) {
        return { ok: false, reason: 'rig-key-frame-occupied', value: normalized, key: null };
    }

    const nextTracks = tracks.map((track, index) => {
        const normalizedTrack = trackField === 'boneTracks'
            ? normalizeBoneTrack(track)
            : normalizePartTrack(track);
        if (index !== trackIndex) return normalizedTrack;
        const nextKeys = normalizedTrack.keyframes.map((key, keyIndex) => (
            keyIndex === sourceKeyIndex ? { ...key, frame: targetFrame } : key
        ));
        nextKeys.sort((left, right) => left.frame - right.frame);
        return { ...normalizedTrack, [idField]: targetId, keyframes: nextKeys };
    });
    const key = clonePlainValue(nextTracks[trackIndex].keyframes.find(item => item.frame === targetFrame));
    return {
        ok: true,
        changed: true,
        value: { ...normalized, [trackField]: nextTracks },
        key
    };
}

/** Part keyの内容を維持したまま別Frameへ移動する。既存keyへの上書きは行わない。 */
export function moveRigPartKey(rigMotion, partId, sourceFrame, targetFrame) {
    return moveRigTrackKey(rigMotion, 'partTracks', 'partId', partId, sourceFrame, targetFrame);
}

/** Part keyをimmutableに追加/更新する。保存fieldは既存PART_MOTION_FIELDSだけ。 */
export function upsertRigPartKey(rigMotion, partId, localFrame, transform = {}, options = {}) {
    if (typeof partId !== 'string' || partId.length === 0 || !Number.isInteger(localFrame) || localFrame < 0) {
        return { ok: false, reason: 'invalid-part-key-target', value: rigMotion, key: null };
    }
    const normalized = rigMotion == null
        ? { version: PART_RIG_SCHEMA_VERSION, partTracks: [] }
        : normalizeRigMotion(rigMotion);
    if (!normalized || !Array.isArray(normalized.partTracks)) {
        return { ok: false, reason: 'invalid-rig-motion', value: normalized, key: null };
    }
    const interpolation = options.interpolation === 'hold' ? 'hold' : 'linear';
    const motionTransform = normalizePartTransform(transform, PART_MOTION_FIELDS);
    const key = { frame: localFrame, interpolation, ...motionTransform };
    const trackIndex = normalized.partTracks.findIndex(track => track?.partId === partId);
    const nextTracks = normalized.partTracks.map(track => normalizePartTrack(track));
    if (trackIndex < 0) {
        nextTracks.push({ partId, keyframes: [key] });
    } else {
        const previousTrack = nextTracks[trackIndex];
        const nextKeys = (previousTrack.keyframes || []).filter(candidate => candidate?.frame !== localFrame);
        nextKeys.push(key);
        nextKeys.sort((left, right) => left.frame - right.frame);
        nextTracks[trackIndex] = { ...previousTrack, partId, keyframes: nextKeys };
    }
    return {
        ok: true,
        changed: true,
        value: { ...normalized, partTracks: nextTracks },
        key
    };
}

/** 現在FrameのPart keyだけを削除し、空track/空Rig Motionは正本へ残さない。 */
export function removeRigPartKey(rigMotion, partId, localFrame) {
    if (typeof partId !== 'string' || !Number.isInteger(localFrame)) {
        return { ok: false, reason: 'invalid-part-key-target', value: rigMotion };
    }
    const normalized = normalizeRigMotion(rigMotion);
    if (!normalized || !Array.isArray(normalized.partTracks)) {
        return { ok: false, reason: 'part-key-not-found', value: rigMotion };
    }
    let changed = false;
    const nextTracks = normalized.partTracks.flatMap(track => {
        if (track?.partId !== partId || !Array.isArray(track.keyframes)) return [normalizePartTrack(track)];
        const nextKeys = track.keyframes.filter(key => key?.frame !== localFrame);
        changed = nextKeys.length !== track.keyframes.length;
        return nextKeys.length > 0 ? [{ ...normalizePartTrack(track), keyframes: nextKeys }] : [];
    });
    if (!changed) return { ok: false, reason: 'part-key-not-found', value: normalized };
    return {
        ok: true,
        changed: true,
        value: nextTracks.length > 0 || (Array.isArray(normalized.boneTracks) && normalized.boneTracks.length > 0)
            ? { ...normalized, partTracks: nextTracks }
            : null
    };
}

export function getRigBoneTrack(rigMotion, boneId) {
    const normalized = normalizeRigMotion(rigMotion);
    if (!normalized || !Array.isArray(normalized.boneTracks)) return null;
    return normalized.boneTracks.find(track => track?.boneId === boneId) || null;
}

export function getRigBoneKeyAtFrame(rigMotion, boneId, localFrame) {
    if (!Number.isInteger(localFrame)) return null;
    return getRigBoneTrack(rigMotion, boneId)?.keyframes
        ?.findLast?.(key => key?.frame === localFrame) || null;
}

/** Bone keyの内容を維持したまま別Frameへ移動する。既存keyへの上書きは行わない。 */
export function moveRigBoneKey(rigMotion, boneId, sourceFrame, targetFrame) {
    return moveRigTrackKey(rigMotion, 'boneTracks', 'boneId', boneId, sourceFrame, targetFrame);
}

/** Bone Pose keyをimmutableに追加/更新する。static Bind Poseは変更しない。 */
export function upsertRigBoneKey(rigMotion, boneId, localFrame, transform = {}, options = {}) {
    if (typeof boneId !== 'string' || boneId.length === 0 || !Number.isInteger(localFrame) || localFrame < 0) {
        return { ok: false, reason: 'invalid-bone-key-target', value: rigMotion, key: null };
    }
    const normalized = rigMotion == null
        ? { version: PART_RIG_SCHEMA_VERSION, partTracks: [], boneTracks: [] }
        : normalizeRigMotion(rigMotion);
    if (!normalized || !Array.isArray(normalized.partTracks)) {
        return { ok: false, reason: 'invalid-rig-motion', value: normalized, key: null };
    }
    const interpolation = options.interpolation === 'hold' ? 'hold' : 'linear';
    const motionTransform = normalizePartTransform(transform, BONE_MOTION_FIELDS);
    const key = { frame: localFrame, interpolation, ...motionTransform };
    const tracks = Array.isArray(normalized.boneTracks) ? normalized.boneTracks : [];
    const trackIndex = tracks.findIndex(track => track?.boneId === boneId);
    const nextTracks = tracks.map(track => normalizeBoneTrack(track));
    if (trackIndex < 0) {
        nextTracks.push({ boneId, keyframes: [key] });
    } else {
        const previousTrack = nextTracks[trackIndex];
        const nextKeys = (previousTrack.keyframes || []).filter(candidate => candidate?.frame !== localFrame);
        nextKeys.push(key);
        nextKeys.sort((left, right) => left.frame - right.frame);
        nextTracks[trackIndex] = { ...previousTrack, boneId, keyframes: nextKeys };
    }
    return {
        ok: true,
        changed: true,
        value: { ...normalized, boneTracks: nextTracks },
        key
    };
}

/** 現在FrameのBone keyだけを削除し、他のPart/Bone trackは維持する。 */
export function removeRigBoneKey(rigMotion, boneId, localFrame) {
    if (typeof boneId !== 'string' || !Number.isInteger(localFrame)) {
        return { ok: false, reason: 'invalid-bone-key-target', value: rigMotion };
    }
    const normalized = normalizeRigMotion(rigMotion);
    if (!normalized || !Array.isArray(normalized.boneTracks)) {
        return { ok: false, reason: 'bone-key-not-found', value: rigMotion };
    }
    let changed = false;
    const nextTracks = normalized.boneTracks.flatMap(track => {
        if (track?.boneId !== boneId || !Array.isArray(track.keyframes)) return [normalizeBoneTrack(track)];
        const nextKeys = track.keyframes.filter(key => key?.frame !== localFrame);
        changed = nextKeys.length !== track.keyframes.length;
        return nextKeys.length > 0 ? [{ ...normalizeBoneTrack(track), keyframes: nextKeys }] : [];
    });
    if (!changed) return { ok: false, reason: 'bone-key-not-found', value: normalized };
    return {
        ok: true,
        changed: true,
        value: nextTracks.length > 0 || normalized.partTracks.length > 0
            ? { ...normalized, boneTracks: nextTracks }
            : null
    };
}

function addError(errors, code, path, message) {
    errors.push({ code, path, message });
}

function validateTransform(value, fields, path, errors) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        addError(errors, 'invalid-transform', path, 'transform must be an object');
        return;
    }
    fields.forEach(field => {
        if (!Number.isFinite(value[field])) {
            addError(errors, 'non-finite-transform', `${path}.${field}`, `${field} must be finite`);
        }
    });
}

function getInternalLayerIds(internalLayers) {
    return new Set((Array.isArray(internalLayers) ? internalLayers : [])
        .map(layer => typeof layer === 'string' ? layer : layer?.id)
        .filter(id => typeof id === 'string' && id.length > 0));
}

function validateHierarchyCycles(entriesById, parentField, path, code, label, errors) {
    const visitState = new Map();
    const visit = id => {
        const state = visitState.get(id) || 0;
        if (state === 2) return;
        if (state === 1) {
            addError(errors, code, path, `cycle detected at ${label} ${id}`);
            return;
        }
        visitState.set(id, 1);
        const parentId = entriesById.get(id)?.[parentField];
        if (parentId && entriesById.has(parentId)) visit(parentId);
        visitState.set(id, 2);
    };
    entriesById.forEach((_, id) => visit(id));
}

export function validateRigDefinition(value, internalLayers = []) {
    if (value == null) return { ok: true, errors: [], value: null };
    const rigDefinition = normalizeRigDefinition(value);
    const errors = [];
    if (!rigDefinition || typeof rigDefinition !== 'object' || Array.isArray(rigDefinition)) {
        addError(errors, 'invalid-rig-definition', 'rigDefinition', 'rigDefinition must be an object');
        return { ok: false, errors, value: rigDefinition };
    }
    if (rigDefinition.version !== PART_RIG_SCHEMA_VERSION) {
        addError(errors, 'unsupported-rig-version', 'rigDefinition.version', 'unsupported rigDefinition version');
    }
    if (!Array.isArray(rigDefinition.parts)) {
        addError(errors, 'invalid-parts', 'rigDefinition.parts', 'parts must be an array');
        return { ok: false, errors, value: rigDefinition };
    }

    const internalLayerIds = getInternalLayerIds(internalLayers);
    const partsById = new Map();
    rigDefinition.parts.forEach((part, index) => {
        const path = `rigDefinition.parts[${index}]`;
        if (!part || typeof part !== 'object' || Array.isArray(part)) {
            addError(errors, 'invalid-part', path, 'Part must be an object');
            return;
        }
        if (typeof part.partId !== 'string' || part.partId.length === 0) {
            addError(errors, 'invalid-part-id', `${path}.partId`, 'partId must be a non-empty string');
        } else {
            if (partsById.has(part.partId)) {
                addError(errors, 'duplicate-part-id', `${path}.partId`, `duplicate Part ${part.partId}`);
            }
            partsById.set(part.partId, part);
            if (!internalLayerIds.has(part.partId)) {
                addError(errors, 'dangling-part-id', `${path}.partId`, `missing internal Layer ${part.partId}`);
            }
        }
        if (part.parentPartId != null && (typeof part.parentPartId !== 'string' || part.parentPartId.length === 0)) {
            addError(errors, 'invalid-parent-part-id', `${path}.parentPartId`, 'parentPartId must be null or a non-empty string');
        }
        validateTransform(part.bindTransform, PART_BIND_FIELDS, `${path}.bindTransform`, errors);
    });

    rigDefinition.parts.forEach((part, index) => {
        if (!part || typeof part !== 'object' || typeof part.partId !== 'string') return;
        if (part.parentPartId === part.partId) {
            addError(errors, 'self-parent', `rigDefinition.parts[${index}].parentPartId`, 'Part cannot parent itself');
        } else if (part.parentPartId != null && !partsById.has(part.parentPartId)) {
            addError(
                errors,
                'dangling-parent-part-id',
                `rigDefinition.parts[${index}].parentPartId`,
                `missing parent Part ${part.parentPartId}`
            );
        }
    });

    validateHierarchyCycles(
        partsById,
        'parentPartId',
        'rigDefinition.parts',
        'rig-cycle',
        'Part',
        errors
    );

    let bonesById = new Map();
    if (hasOwn(rigDefinition, 'bones')) {
        if (!Array.isArray(rigDefinition.bones)) {
            addError(errors, 'invalid-bones', 'rigDefinition.bones', 'bones must be an array');
        } else {
            bonesById = new Map();
            rigDefinition.bones.forEach((bone, index) => {
                const path = `rigDefinition.bones[${index}]`;
                if (!bone || typeof bone !== 'object' || Array.isArray(bone)) {
                    addError(errors, 'invalid-bone', path, 'Bone must be an object');
                    return;
                }
                if (typeof bone.boneId !== 'string' || bone.boneId.length === 0) {
                    addError(errors, 'invalid-bone-id', `${path}.boneId`, 'boneId must be a non-empty string');
                } else {
                    if (bonesById.has(bone.boneId)) {
                        addError(errors, 'duplicate-bone-id', `${path}.boneId`, `duplicate Bone ${bone.boneId}`);
                    }
                    bonesById.set(bone.boneId, bone);
                    if (internalLayerIds.has(bone.boneId)) {
                        addError(errors, 'bone-id-collision', `${path}.boneId`, 'boneId must not reuse an internal Layer / Part id');
                    }
                }
                if (bone.parentBoneId != null && (typeof bone.parentBoneId !== 'string' || bone.parentBoneId.length === 0)) {
                    addError(errors, 'invalid-parent-bone-id', `${path}.parentBoneId`, 'parentBoneId must be null or a non-empty string');
                }
                validateTransform(bone.bindTransform, BONE_BIND_FIELDS, `${path}.bindTransform`, errors);
                if (!Number.isFinite(bone.length) || bone.length < 0) {
                    addError(errors, 'invalid-bone-length', `${path}.length`, 'length must be finite and non-negative');
                }
            });
            rigDefinition.bones.forEach((bone, index) => {
                if (!bone || typeof bone !== 'object' || typeof bone.boneId !== 'string') return;
                if (bone.parentBoneId === bone.boneId) {
                    addError(errors, 'self-parent-bone', `rigDefinition.bones[${index}].parentBoneId`, 'Bone cannot parent itself');
                } else if (bone.parentBoneId != null && !bonesById.has(bone.parentBoneId)) {
                    addError(
                        errors,
                        'dangling-parent-bone-id',
                        `rigDefinition.bones[${index}].parentBoneId`,
                        `missing parent Bone ${bone.parentBoneId}`
                    );
                }
            });
            validateHierarchyCycles(
                bonesById,
                'parentBoneId',
                'rigDefinition.bones',
                'bone-cycle',
                'Bone',
                errors
            );
        }
    }

    if (hasOwn(rigDefinition, 'rigidBindings')) {
        if (!Array.isArray(rigDefinition.rigidBindings)) {
            addError(errors, 'invalid-rigid-bindings', 'rigDefinition.rigidBindings', 'rigidBindings must be an array');
        } else {
            const boundBoneIds = new Set();
            const boundPartIds = new Set();
            rigDefinition.rigidBindings.forEach((binding, index) => {
                const path = `rigDefinition.rigidBindings[${index}]`;
                if (!binding || typeof binding !== 'object' || Array.isArray(binding)) {
                    addError(errors, 'invalid-rigid-binding', path, 'rigid binding must be an object');
                    return;
                }
                if (typeof binding.boneId !== 'string' || binding.boneId.length === 0) {
                    addError(errors, 'invalid-binding-bone-id', `${path}.boneId`, 'boneId must be a non-empty string');
                } else {
                    if (boundBoneIds.has(binding.boneId)) {
                        addError(errors, 'duplicate-bone-binding', `${path}.boneId`, `duplicate binding for Bone ${binding.boneId}`);
                    }
                    boundBoneIds.add(binding.boneId);
                    if (!bonesById.has(binding.boneId)) {
                        addError(errors, 'dangling-binding-bone-id', `${path}.boneId`, `missing Bone ${binding.boneId}`);
                    }
                }
                if (typeof binding.partId !== 'string' || binding.partId.length === 0) {
                    addError(errors, 'invalid-binding-part-id', `${path}.partId`, 'partId must be a non-empty string');
                } else {
                    if (boundPartIds.has(binding.partId)) {
                        addError(errors, 'duplicate-part-binding', `${path}.partId`, `duplicate binding for Part ${binding.partId}`);
                    }
                    boundPartIds.add(binding.partId);
                    if (!partsById.has(binding.partId)) {
                        addError(errors, 'dangling-binding-part-id', `${path}.partId`, `missing Part ${binding.partId}`);
                    }
                }
            });
        }
    }

    return { ok: errors.length === 0, errors, value: rigDefinition };
}

export function validateRigMotion(value, rigDefinition, duration = 1) {
    if (value == null) return { ok: true, errors: [], value: null };
    const rigMotion = normalizeRigMotion(value);
    const errors = [];
    if (!rigMotion || typeof rigMotion !== 'object' || Array.isArray(rigMotion)) {
        addError(errors, 'invalid-rig-motion', 'rigMotion', 'rigMotion must be an object');
        return { ok: false, errors, value: rigMotion };
    }
    if (rigMotion.version !== PART_RIG_SCHEMA_VERSION) {
        addError(errors, 'unsupported-rig-motion-version', 'rigMotion.version', 'unsupported rigMotion version');
    }
    if (!Array.isArray(rigMotion.partTracks)) {
        addError(errors, 'invalid-part-tracks', 'rigMotion.partTracks', 'partTracks must be an array');
        return { ok: false, errors, value: rigMotion };
    }

    const partIds = new Set(Array.isArray(rigDefinition?.parts)
        ? rigDefinition.parts.map(part => part?.partId).filter(Boolean)
        : []);
    const seenTrackIds = new Set();
    const normalizedDuration = Math.max(1, Number.isInteger(duration) ? duration : 1);
    rigMotion.partTracks.forEach((track, trackIndex) => {
        const path = `rigMotion.partTracks[${trackIndex}]`;
        if (!track || typeof track !== 'object' || Array.isArray(track)) {
            addError(errors, 'invalid-part-track', path, 'Part track must be an object');
            return;
        }
        if (typeof track.partId !== 'string' || track.partId.length === 0) {
            addError(errors, 'invalid-track-part-id', `${path}.partId`, 'partId must be a non-empty string');
        } else {
            if (seenTrackIds.has(track.partId)) {
                addError(errors, 'duplicate-part-track', `${path}.partId`, `duplicate Part track ${track.partId}`);
            }
            seenTrackIds.add(track.partId);
            if (!partIds.has(track.partId)) {
                addError(errors, 'dangling-track-part-id', `${path}.partId`, `missing Part ${track.partId}`);
            }
        }
        if (!Array.isArray(track.keyframes)) {
            addError(errors, 'invalid-part-keyframes', `${path}.keyframes`, 'keyframes must be an array');
            return;
        }
        track.keyframes.forEach((key, keyIndex) => {
            const keyPath = `${path}.keyframes[${keyIndex}]`;
            if (!key || typeof key !== 'object' || Array.isArray(key)) {
                addError(errors, 'invalid-part-key', keyPath, 'keyframe must be an object');
                return;
            }
            if (!Number.isInteger(key.frame) || key.frame < 0 || key.frame >= normalizedDuration) {
                addError(errors, 'part-key-out-of-range', `${keyPath}.frame`, 'keyframe is outside Clip duration');
            }
            if (key.interpolation != null && !['linear', 'hold'].includes(key.interpolation)) {
                addError(errors, 'invalid-part-interpolation', `${keyPath}.interpolation`, 'unsupported interpolation');
            }
            PART_MOTION_FIELDS.forEach(field => {
                if (hasOwn(key, field) && !Number.isFinite(key[field])) {
                    addError(errors, 'non-finite-part-key', `${keyPath}.${field}`, `${field} must be finite`);
                }
            });
        });
    });

    if (hasOwn(rigMotion, 'boneTracks')) {
        if (!Array.isArray(rigMotion.boneTracks)) {
            addError(errors, 'invalid-bone-tracks', 'rigMotion.boneTracks', 'boneTracks must be an array');
        } else {
            const boneIds = new Set(Array.isArray(rigDefinition?.bones)
                ? rigDefinition.bones.map(bone => bone?.boneId).filter(Boolean)
                : []);
            const seenBoneTrackIds = new Set();
            rigMotion.boneTracks.forEach((track, trackIndex) => {
                const path = `rigMotion.boneTracks[${trackIndex}]`;
                if (!track || typeof track !== 'object' || Array.isArray(track)) {
                    addError(errors, 'invalid-bone-track', path, 'Bone track must be an object');
                    return;
                }
                if (typeof track.boneId !== 'string' || track.boneId.length === 0) {
                    addError(errors, 'invalid-track-bone-id', `${path}.boneId`, 'boneId must be a non-empty string');
                } else {
                    if (seenBoneTrackIds.has(track.boneId)) {
                        addError(errors, 'duplicate-bone-track', `${path}.boneId`, `duplicate Bone track ${track.boneId}`);
                    }
                    seenBoneTrackIds.add(track.boneId);
                    if (!boneIds.has(track.boneId)) {
                        addError(errors, 'dangling-track-bone-id', `${path}.boneId`, `missing Bone ${track.boneId}`);
                    }
                }
                if (!Array.isArray(track.keyframes)) {
                    addError(errors, 'invalid-bone-keyframes', `${path}.keyframes`, 'keyframes must be an array');
                    return;
                }
                track.keyframes.forEach((key, keyIndex) => {
                    const keyPath = `${path}.keyframes[${keyIndex}]`;
                    if (!key || typeof key !== 'object' || Array.isArray(key)) {
                        addError(errors, 'invalid-bone-key', keyPath, 'keyframe must be an object');
                        return;
                    }
                    if (!Number.isInteger(key.frame) || key.frame < 0 || key.frame >= normalizedDuration) {
                        addError(errors, 'bone-key-out-of-range', `${keyPath}.frame`, 'keyframe is outside Clip duration');
                    }
                    if (key.interpolation != null && !['linear', 'hold'].includes(key.interpolation)) {
                        addError(errors, 'invalid-bone-interpolation', `${keyPath}.interpolation`, 'unsupported interpolation');
                    }
                    BONE_MOTION_FIELDS.forEach(field => {
                        if (hasOwn(key, field) && !Number.isFinite(key[field])) {
                            addError(errors, 'non-finite-bone-key', `${keyPath}.${field}`, `${field} must be finite`);
                        }
                    });
                });
            });
        }
    }
    return { ok: errors.length === 0, errors, value: rigMotion };
}

function remapId(id, idMap) {
    if (id == null) return null;
    if (idMap instanceof Map) return idMap.has(id) ? idMap.get(id) : id;
    if (idMap && typeof idMap === 'object' && hasOwn(idMap, id)) return idMap[id];
    return id;
}

export function remapRigDefinition(value, internalLayerIdMap) {
    const rigDefinition = normalizeRigDefinition(value);
    if (!rigDefinition || !Array.isArray(rigDefinition.parts)) return rigDefinition;
    return {
        ...rigDefinition,
        parts: rigDefinition.parts.map(part => {
            if (!part || typeof part !== 'object') return clonePlainValue(part);
            return {
                ...clonePlainValue(part),
                partId: remapId(part.partId, internalLayerIdMap),
                parentPartId: remapId(part.parentPartId, internalLayerIdMap)
            };
        }),
        ...(hasOwn(rigDefinition, 'bones')
            ? {
                bones: Array.isArray(rigDefinition.bones)
                    ? rigDefinition.bones.map(bone => {
                        if (!bone || typeof bone !== 'object') return clonePlainValue(bone);
                        return {
                            ...clonePlainValue(bone),
                            boneId: remapId(bone.boneId, internalLayerIdMap),
                            parentBoneId: remapId(bone.parentBoneId, internalLayerIdMap)
                        };
                    })
                    : clonePlainValue(rigDefinition.bones)
            }
            : {}),
        ...(hasOwn(rigDefinition, 'rigidBindings')
            ? {
                rigidBindings: Array.isArray(rigDefinition.rigidBindings)
                    ? rigDefinition.rigidBindings.map(binding => {
                        if (!binding || typeof binding !== 'object') return clonePlainValue(binding);
                        return {
                            ...clonePlainValue(binding),
                            boneId: remapId(binding.boneId, internalLayerIdMap),
                            partId: remapId(binding.partId, internalLayerIdMap)
                        };
                    })
                    : clonePlainValue(rigDefinition.rigidBindings)
            }
            : {})
    };
}

export function remapRigMotion(value, internalLayerIdMap) {
    const rigMotion = normalizeRigMotion(value);
    if (!rigMotion || !Array.isArray(rigMotion.partTracks)) return rigMotion;
    return {
        ...rigMotion,
        partTracks: rigMotion.partTracks.map(track => {
            if (!track || typeof track !== 'object') return clonePlainValue(track);
            return {
                ...clonePlainValue(track),
                partId: remapId(track.partId, internalLayerIdMap)
            };
        }),
        ...(hasOwn(rigMotion, 'boneTracks')
            ? {
                boneTracks: Array.isArray(rigMotion.boneTracks)
                    ? rigMotion.boneTracks.map(track => {
                        if (!track || typeof track !== 'object') return clonePlainValue(track);
                        return {
                            ...clonePlainValue(track),
                            boneId: remapId(track.boneId, internalLayerIdMap)
                        };
                    })
                    : clonePlainValue(rigMotion.boneTracks)
            }
            : {})
    };
}

export function getRigPartIdsForInternalLayers(rigDefinition, internalLayerIds) {
    const ids = internalLayerIds instanceof Set ? internalLayerIds : new Set(internalLayerIds || []);
    if (!Array.isArray(rigDefinition?.parts)) return [];
    return rigDefinition.parts
        .map(part => part?.partId)
        .filter(partId => typeof partId === 'string' && ids.has(partId));
}

function pickPartMotionTransform(sampled) {
    return PART_MOTION_FIELDS.reduce((result, field) => {
        result[field] = sampled[field];
        return result;
    }, {});
}

export function sampleRigInstanceMotion(clip, timelineFrame) {
    const rigMotion = normalizeRigMotion(clip?.rigMotion);
    if (!rigMotion || !Array.isArray(rigMotion.partTracks)) return new Map();
    const startFrame = Number.isInteger(clip?.startFrame) ? clip.startFrame : 0;
    const duration = Math.max(1, Number.isInteger(clip?.duration) ? clip.duration : 1);
    const localFrame = (Number.isFinite(timelineFrame) ? timelineFrame : startFrame) - startFrame;
    const sampled = new Map();
    rigMotion.partTracks.forEach(track => {
        if (!track || typeof track.partId !== 'string' || !Array.isArray(track.keyframes)) return;
        sampled.set(track.partId, pickPartMotionTransform(sampleTransformTrack(
            PART_TRANSFORM_DEFAULTS,
            track.keyframes,
            localFrame,
            duration
        )));
    });
    return sampled;
}

export function sampleBoneInstanceMotion(clip, timelineFrame) {
    const rigMotion = normalizeRigMotion(clip?.rigMotion);
    if (!rigMotion || !Array.isArray(rigMotion.boneTracks)) return new Map();
    const startFrame = Number.isInteger(clip?.startFrame) ? clip.startFrame : 0;
    const duration = Math.max(1, Number.isInteger(clip?.duration) ? clip.duration : 1);
    const localFrame = (Number.isFinite(timelineFrame) ? timelineFrame : startFrame) - startFrame;
    const sampled = new Map();
    rigMotion.boneTracks.forEach(track => {
        if (!track || typeof track.boneId !== 'string' || !Array.isArray(track.keyframes)) return;
        sampled.set(track.boneId, pickPartMotionTransform(sampleTransformTrack(
            PART_TRANSFORM_DEFAULTS,
            track.keyframes,
            localFrame,
            duration
        )));
    });
    return sampled;
}

function composeRigLocalTransform(bindTransform, motionTransform) {
    const bind = normalizePartTransform(bindTransform);
    const motion = normalizePartTransform(motionTransform, PART_MOTION_FIELDS);
    return {
        x: bind.x + motion.x,
        y: bind.y + motion.y,
        scaleX: bind.scaleX * motion.scaleX,
        scaleY: bind.scaleY * motion.scaleY,
        rotation: bind.rotation + motion.rotation,
        pivotX: bind.pivotX,
        pivotY: bind.pivotY
    };
}

function orderRigHierarchy(entries, idField, parentField) {
    const entriesById = new Map(entries.map(entry => [entry[idField], entry]));
    const ordered = [];
    const visited = new Set();
    const visit = entry => {
        if (!entry || visited.has(entry[idField])) return;
        if (entry[parentField]) visit(entriesById.get(entry[parentField]));
        visited.add(entry[idField]);
        ordered.push(entry);
    };
    entries.forEach(visit);
    return { entriesById, ordered };
}

export function evaluateRigidParts(asset, clip, timelineFrame) {
    const definitionValidation = validateRigDefinition(asset?.rigDefinition, asset?.internalLayers);
    const motionValidation = validateRigMotion(
        clip?.rigMotion,
        definitionValidation.value,
        clip?.duration
    );
    const errors = [...definitionValidation.errors, ...motionValidation.errors];
    if (errors.length > 0) {
        return { ok: false, errors, orderedPoses: [], poseByPartId: new Map() };
    }
    const rigDefinition = definitionValidation.value;
    if (!rigDefinition) {
        return { ok: true, errors: [], orderedPoses: [], poseByPartId: new Map() };
    }

    const sampledMotion = sampleRigInstanceMotion(clip, timelineFrame);
    const { ordered: orderedParts } = orderRigHierarchy(
        rigDefinition.parts,
        'partId',
        'parentPartId'
    );

    const poseByPartId = new Map();
    const orderedPoses = orderedParts.map(part => {
        const motionTransform = sampledMotion.get(part.partId)
            || normalizePartTransform(null, PART_MOTION_FIELDS);
        const localTransform = composeRigLocalTransform(part.bindTransform, motionTransform);
        const localMatrix = createAffineTransformMatrix(localTransform);
        const parentPose = part.parentPartId ? poseByPartId.get(part.parentPartId) : null;
        const worldMatrix = parentPose
            ? multiplyTransformMatrices(parentPose.worldMatrix, localMatrix)
            : localMatrix;
        const pose = {
            partId: part.partId,
            parentPartId: part.parentPartId || null,
            bindTransform: normalizePartTransform(part.bindTransform),
            motionTransform,
            localTransform,
            localMatrix,
            worldMatrix
        };
        poseByPartId.set(part.partId, pose);
        return pose;
    });
    return { ok: true, errors: [], orderedPoses, poseByPartId };
}

export function evaluateRigidBones(asset, clip, timelineFrame) {
    const definitionValidation = validateRigDefinition(asset?.rigDefinition, asset?.internalLayers);
    const motionValidation = validateRigMotion(
        clip?.rigMotion,
        definitionValidation.value,
        clip?.duration
    );
    const errors = [...definitionValidation.errors, ...motionValidation.errors];
    if (errors.length > 0) {
        return { ok: false, errors, orderedPoses: [], poseByBoneId: new Map() };
    }
    const bones = Array.isArray(definitionValidation.value?.bones)
        ? definitionValidation.value.bones
        : [];
    if (bones.length === 0) {
        return { ok: true, errors: [], orderedPoses: [], poseByBoneId: new Map() };
    }

    const sampledMotion = sampleBoneInstanceMotion(clip, timelineFrame);
    const { ordered: orderedBones } = orderRigHierarchy(bones, 'boneId', 'parentBoneId');
    const poseByBoneId = new Map();
    const orderedPoses = orderedBones.map(bone => {
        const motionTransform = sampledMotion.get(bone.boneId)
            || normalizePartTransform(null, BONE_MOTION_FIELDS);
        const localTransform = composeRigLocalTransform(bone.bindTransform, motionTransform);
        const localMatrix = createAffineTransformMatrix(localTransform);
        const parentPose = bone.parentBoneId ? poseByBoneId.get(bone.parentBoneId) : null;
        const worldMatrix = parentPose
            ? multiplyTransformMatrices(parentPose.worldMatrix, localMatrix)
            : localMatrix;
        const pose = {
            boneId: bone.boneId,
            parentBoneId: bone.parentBoneId || null,
            length: bone.length,
            bindTransform: normalizePartTransform(bone.bindTransform, BONE_BIND_FIELDS),
            motionTransform,
            localTransform,
            localMatrix,
            worldMatrix
        };
        poseByBoneId.set(bone.boneId, pose);
        return pose;
    });
    return { ok: true, errors: [], orderedPoses, poseByBoneId };
}

export function sampleRigMotionForBake(clip, timelineFrame) {
    const rigMotion = normalizeRigMotion(clip?.rigMotion);
    if (!rigMotion || !Array.isArray(rigMotion.partTracks)) return null;
    const sampled = sampleRigInstanceMotion(clip, timelineFrame);
    const sampledBones = sampleBoneInstanceMotion(clip, timelineFrame);
    return {
        version: PART_RIG_SCHEMA_VERSION,
        partTracks: rigMotion.partTracks.map(track => ({
            partId: track.partId,
            keyframes: [{
                frame: 0,
                interpolation: 'hold',
                ...sampled.get(track.partId)
            }]
        })),
        ...(hasOwn(rigMotion, 'boneTracks')
            ? {
                boneTracks: Array.isArray(rigMotion.boneTracks)
                    ? rigMotion.boneTracks.map(track => ({
                        boneId: track.boneId,
                        keyframes: [{
                            frame: 0,
                            interpolation: 'hold',
                            ...sampledBones.get(track.boneId)
                        }]
                    }))
                    : clonePlainValue(rigMotion.boneTracks)
            }
            : {})
    };
}
