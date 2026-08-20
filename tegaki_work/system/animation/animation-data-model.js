/**
 * ============================================================================
 * ファイル名: system/animation/animation-data-model.js
 * 責務: 新アニメーションテーブル（ToonSquid風）の純粋データ構造を定義する
 * 依存: system/raster-bounds.js
 * 被依存: animation-system.js, animation-table-popup.js
 * Folder WARP境界: ClipInstance.folderDeformersだけを保存正本とし、既存root deformerの
 * normalize / sampleを再利用する。RenderIsland合成はfolder-part-render-plan.jsのStage Bへ委譲する。
 * ============================================================================
 */

import { normalizeRasterBounds } from '../raster-bounds.js';
import {
    applyClippingMode,
    cycleClippingMode,
    normalizeClippingMode
} from '../clipping-mode.js';
import {
    normalizeClipDeformer,
    normalizeClipFolderDeformers,
    serializeClipFolderDeformers,
    validateClipFolderDeformers,
    removeClipFolderDeformerTarget,
    remapClipFolderDeformers,
    setClipFolderDeformerTarget
} from './clip-deformer.js';
import {
    decodeRasterPixels,
    serializeRasterPixels
} from './raster-pixel-codec.js';
import {
    getRigPartIdsForInternalLayers,
    moveRigBoneKey,
    moveRigPartKey,
    registerRigBoneDefinition,
    registerRootBoneRigidBinding,
    registerRigPartDefinition,
    removeRigDefinitionTargets,
    removeRigMotionTargets,
    removeRigBoneKey,
    removeRigPartKey,
    normalizeRigDefinition,
    normalizeRigMotion,
    remapRigDefinition,
    registerWarpAnchorConstraint,
    removeWarpAnchorConstraint,
    serializeRigDefinition,
    serializeRigMotion,
    updateRigBoneBindTransform,
    updateRigBoneParent,
    upsertRigBoneKey,
    upsertRigPartKey,
    validateRigDefinition,
    validateRigMotion
} from './part-rig.js';
import { resolveRigPartTarget } from './rig-part-target.js';
import {
    getRasterMeshIdsForInternalLayers,
    normalizeRasterMeshDefinitions,
    normalizeRasterSkinBindings,
    remapRasterMeshDefinitions,
    remapRasterSkinBindings,
    removeRasterSkinningTargets,
    serializeRasterMeshDefinitions,
    serializeRasterSkinBindings,
    validateRasterBoneSkinning
} from './raster-bone-skinning.js';
import { preflightInternalLayerReparent } from './internal-layer-reparent-gate.js';
import {
    createAlphaFitRasterBoneSetup,
    getAlphaFitRasterMeshStatus,
    rebaseAlphaFitRasterMeshSource
} from './raster-bone-auto-setup.js';
import {
    AUTO_SHAPE_FILL_GENERATOR,
    createAutoShapeRasterBoneSetup,
    getAutoShapeRasterMeshStatus,
    rebaseAutoShapeRasterMeshSource
} from './auto-shape-raster-bone-setup.js';
import {
    AUTO_SHAPE_LINE_RIBBON_GENERATOR,
    createLineRibbonRasterBoneSetup,
    getLineRibbonRasterMeshStatus,
    rebaseLineRibbonRasterMeshSource
} from './line-ribbon-raster-bone-setup.js';
import { createSkinInfluenceCorrectionPlan } from './skin-influence-correction.js';
import { createSkinWeightBrushPlan } from './skin-weight-brush.js';
import { createRasterMeshVertexPositionEditPlan } from './raster-mesh-vertex-position-edit.js';

/**
 * ID生成ユーティリティ
 */
function createId() {
    return (typeof crypto !== 'undefined' && crypto.randomUUID) 
        ? crypto.randomUUID() 
        : Math.random().toString(36).substring(2) + Date.now().toString(36);
}

function numberOrDefault(value, fallback) {
    return Number.isFinite(value) ? value : fallback;
}

function normalizedOpacity(value, fallback = 1) {
    return Math.max(0, Math.min(1, numberOrDefault(value, fallback)));
}

function normalizedClipBlendMode(value, fallback = 'normal') {
    return new Set(['normal', 'add', 'subtract', 'overlay']).has(value) ? value : fallback;
}

function clonePlainObject(value, fallback = {}) {
    const cloneFallback = () => Array.isArray(fallback) ? [...fallback] : { ...fallback };
    if (!value || typeof value !== 'object') return cloneFallback();
    try {
        return JSON.parse(JSON.stringify(value));
    } catch {
        return cloneFallback();
    }
}

function createDefaultClipTransform() {
    return {
        x: 0,
        y: 0,
        scaleX: 1,
        scaleY: 1,
        rotation: 0,
        opacity: 1,
        blendMode: 'normal',
        blendStrength: 1,
        anchorX: 0.5,
        anchorY: 0.5
    };
}

function normalizeClipTransform(transform = {}) {
    const defaults = createDefaultClipTransform();
    return {
        x: numberOrDefault(transform.x, defaults.x),
        y: numberOrDefault(transform.y, defaults.y),
        scaleX: numberOrDefault(transform.scaleX, defaults.scaleX),
        scaleY: numberOrDefault(transform.scaleY, defaults.scaleY),
        rotation: numberOrDefault(transform.rotation, defaults.rotation),
        opacity: normalizedOpacity(transform.opacity, defaults.opacity),
        blendMode: normalizedClipBlendMode(transform.blendMode, defaults.blendMode),
        blendStrength: normalizedOpacity(transform.blendStrength, defaults.blendStrength),
        anchorX: numberOrDefault(transform.anchorX, defaults.anchorX),
        anchorY: numberOrDefault(transform.anchorY, defaults.anchorY)
    };
}

/**
 * 描画内容の最小保存単位（スナップショット）
 */
export class DrawingSnapshotModel {
    constructor(options = {}) {
        this.id = options.id || createId();
        this.width = options.width || options.rasterBounds?.width || 0;
        this.height = options.height || options.rasterBounds?.height || 0;
        this.rasterBounds = normalizeRasterBounds(options.rasterBounds, {
            width: this.width || 1,
            height: this.height || 1
        });
        if (this.width > 0) this.rasterBounds.width = this.width;
        if (this.height > 0) this.rasterBounds.height = this.height;
        this.pixels = decodeRasterPixels(options.pixels, options.pixelEncoding); // Uint8ClampedArray or Array
        this.isBlank = options.isBlank === true;
        this.createdAt = options.createdAt || Date.now();
        this.updatedAt = options.updatedAt || Date.now();
    }

    serialize(options = {}) {
        const serializedPixels = serializeRasterPixels(this.pixels, options.pixelEncoding);
        return {
            id: this.id,
            width: this.width,
            height: this.height,
            rasterBounds: { ...this.rasterBounds },
            pixels: serializedPixels.pixels,
            ...(serializedPixels.pixelEncoding
                ? { pixelEncoding: serializedPixels.pixelEncoding }
                : {}),
            isBlank: this.isBlank,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };
    }
}

/**
 * クリップ素材のフォルダ
 */
export class ClipAssetFolderModel {
    constructor(options = {}) {
        this.id = options.id || createId();
        this.name = options.name || 'Assets';
        this.parentFolderId = options.parentFolderId || null;
        this.colorTag = options.colorTag || null;
        this.expanded = options.expanded !== false;
        this.createdAt = options.createdAt || Date.now();
        this.updatedAt = options.updatedAt || Date.now();
    }

    serialize() {
        return {
            id: this.id,
            name: this.name,
            parentFolderId: this.parentFolderId,
            colorTag: this.colorTag,
            expanded: this.expanded,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };
    }
}

/**
 * クリップ素材の内部レイヤー
 */
export class ClipAssetInternalLayerModel {
    constructor(options = {}) {
        this.id = options.id || createId();
        this.name = options.name || 'Layer';
        this.type = options.type || 'raster'; // 'raster' | 'folder'
        this.visible = options.visible !== false;
        this.opacity = options.opacity ?? 1;
        this.blendMode = options.blendMode || 'normal';
        this.clippingMode = normalizeClippingMode(options.clippingMode, options.clipping === true);
        this.clipping = this.clippingMode !== 'none';
        this.drawingSnapshotId = options.drawingSnapshotId || null;
        this.parentLayerId = options.parentLayerId || null;
        this.isBackground = options.isBackground === true;
        this.createdAt = options.createdAt || Date.now();
        this.updatedAt = options.updatedAt || Date.now();
    }

    serialize() {
        return {
            id: this.id,
            name: this.name,
            type: this.type,
            visible: this.visible,
            opacity: this.opacity,
            blendMode: this.blendMode,
            clipping: this.clipping,
            clippingMode: this.clippingMode,
            drawingSnapshotId: this.drawingSnapshotId,
            parentLayerId: this.parentLayerId,
            isBackground: this.isBackground,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };
    }
}

/**
 * クリップ本体（アセット）
 * 将来、内部レイヤー構造・内部タイムライン・物理演算を持つ。
 */
export class ClipAssetModel {
    constructor(options = {}) {
        this.id = options.id || createId();
        this.name = options.name || 'New Asset';
        this.type = options.type || 'raster'; // 'raster' | 'vector' | 'group'
        this.folderId = options.folderId || null; // 所属フォルダ
        this.drawingSnapshotId = options.drawingSnapshotId || null; // 参照
        
        // Phase 4z6: モデル化
        this.internalLayers = (options.internalLayers || []).map(layer => new ClipAssetInternalLayerModel(layer));
        this.rigDefinition = options.rigDefinition == null
            ? null
            : normalizeRigDefinition(options.rigDefinition);
        // Raster Mesh topology / SkinWeightはAsset共有のstatic Setup。
        // Bone Pose、Control Mesh / WARP Poseとは別のoptional正本として保持する。
        this.meshDefinitions = options.meshDefinitions == null
            ? null
            : normalizeRasterMeshDefinitions(options.meshDefinitions);
        this.skinBindings = options.skinBindings == null
            ? null
            : normalizeRasterSkinBindings(options.skinBindings);
        
        this.createdAt = options.createdAt || Date.now();
        this.updatedAt = options.updatedAt || Date.now();
    }

    serialize() {
        return {
            id: this.id,
            name: this.name,
            type: this.type,
            folderId: this.folderId,
            drawingSnapshotId: this.drawingSnapshotId,
            internalLayers: this.internalLayers.map(l => l.serialize()),
            ...(this.rigDefinition == null
                ? {}
                : { rigDefinition: serializeRigDefinition(this.rigDefinition) }),
            ...(this.meshDefinitions == null
                ? {}
                : { meshDefinitions: serializeRasterMeshDefinitions(this.meshDefinitions) }),
            ...(this.skinBindings == null
                ? {}
                : { skinBindings: serializeRasterSkinBindings(this.skinBindings) }),
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };
    }
}

/**
 * セル（クリップ）：タイムライン上の特定の時間に配置される実体
 * @alias ClipInstanceModel (Phase 4u移行先)
 */
export class ClipInstanceModel {
    constructor(options = {}) {
        this.id = options.id || createId();
        
        // 暫定：実レイヤーとの紐付け
        this.sourceLayerId = options.sourceLayerId || options.layerId || null;
        this.layerId = this.sourceLayerId; // backward compatibility
        
        this.assetId = options.assetId || null; // 正本となる ClipAsset への参照
        this.startFrame = options.startFrame || 0;
        this.duration = options.duration || 1;
        this.isKeyframe = options.isKeyframe !== false;
        this.visible = options.visible !== false;

        // ClipAsset は絵素材、ClipInstance は配置/運動パラメータを持つ。
        // 将来のキーフレーム・物理演算では、この transform をCAFセル単位の正本にする。
        this.transform = normalizeClipTransform(options.transform || {});
        this.transformKeyframes = Array.isArray(options.transformKeyframes)
            ? options.transformKeyframes.map(keyframe => clonePlainObject(keyframe))
            : [];
        // Phase 6: ClipAssetのRaster正本を変えない、ClipInstance単位の非破壊deformer。
        this.deformer = normalizeClipDeformer(options.deformer);
        // Phase 6s: Folder単位の非破壊deformer。描画・保存の正本は引き続きClipInstance。
        // raw validationはProject復元時の警告用runtime診断であり、serializeしない。
        this._folderDeformerSourceErrors = options.folderDeformers == null
            ? []
            : validateClipFolderDeformers(options.folderDeformers).errors;
        this.folderDeformers = normalizeClipFolderDeformers(options.folderDeformers);
        this.rigMotion = options.rigMotion == null
            ? null
            : normalizeRigMotion(options.rigMotion);
        this.physics = clonePlainObject(options.physics, {
            enabled: false,
            rigId: null,
            cacheId: null
        });
        
        // 暫定互換用：直接 Snapshot 保持
        this.rasterSnapshot = options.rasterSnapshot
            ? {
                ...options.rasterSnapshot,
                pixels: decodeRasterPixels(
                    options.rasterSnapshot.pixels,
                    options.rasterSnapshot.pixelEncoding
                ),
                rasterBounds: normalizeRasterBounds(options.rasterSnapshot.rasterBounds, {
                    width: options.rasterSnapshot.width || 1,
                    height: options.rasterSnapshot.height || 1
                })
            }
            : null;
    }

    serialize() {
        return {
            id: this.id,
            sourceLayerId: this.sourceLayerId,
            layerId: this.layerId, // 互換維持
            assetId: this.assetId,
            startFrame: this.startFrame,
            duration: this.duration,
            isKeyframe: this.isKeyframe,
            visible: this.visible,
            transform: normalizeClipTransform(this.transform),
            transformKeyframes: this.transformKeyframes.map(keyframe => clonePlainObject(keyframe)),
            deformer: normalizeClipDeformer(this.deformer),
            ...(this.folderDeformers == null
                ? {}
                : { folderDeformers: serializeClipFolderDeformers(this.folderDeformers) }),
            ...(this.rigMotion == null
                ? {}
                : { rigMotion: serializeRigMotion(this.rigMotion) }),
            physics: clonePlainObject(this.physics, {
                enabled: false,
                rigId: null,
                cacheId: null
            }),
            rasterSnapshot: this.rasterSnapshot
                ? {
                    ...this.rasterSnapshot,
                    rasterBounds: { ...this.rasterSnapshot.rasterBounds }
                }
                : null
        };
    }
}

/**
 * Timeline上のCAFを移動・複製単位として束ねるGroup。
 * ClipAsset内部Folder、Lane Folderとは別概念。
 */
export class ClipGroupModel {
    constructor(options = {}) {
        this.id = options.id || createId();
        this.name = options.name || 'CAF Group';
        this.clipIds = [...new Set(Array.isArray(options.clipIds) ? options.clipIds.filter(Boolean) : [])];
        this.createdAt = options.createdAt || Date.now();
        this.updatedAt = options.updatedAt || Date.now();
    }

    serialize() {
        return {
            id: this.id,
            name: this.name,
            clipIds: [...this.clipIds],
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };
    }
}

/**
 * 互換エイリアス
 */
export class CelModel extends ClipInstanceModel {}

/**
 * トラック：レイヤーに対応する時間軸の行
 * @alias LaneModel (Phase 4u移行先)
 */
export class LaneModel {
    constructor(options = {}) {
        this.id = options.id || createId();
        
        // 実レイヤーとの紐付けは移行用。null の Lane はアニメ専用行として保持できる。
        this.sourceLayerId = options.sourceLayerId || options.layerId || null;
        this.layerId = this.sourceLayerId; // backward compatibility
        
        this.name = options.name || 'Lane';
        this.displayName = options.displayName || null;
        this.sourceName = options.sourceName || null;
        this.kind = options.kind || (this.sourceLayerId ? 'layer-linked' : 'independent');
        this.orderIndex = Number.isInteger(options.orderIndex) ? options.orderIndex : 0;
        this.sourceMissing = options.sourceMissing === true;
        this.isBackground = options.isBackground === true;
        this.type = options.type || 'raster'; // 'raster' | 'folder'
        this.active = options.active === true;
        // Playback ScopeやCAF内部Layerとは独立した、Lane単位の保存済み表示状態。
        this.visible = options.visible !== false;
        
        // 内部リスト名はまだ cels を維持（大規模置換回避）
        this.cels = (options.cels || options.clips || []).map(clip => new ClipInstanceModel(clip));
    }

    /**
     * 指定フレームにセルがあるか取得
     * @param {number} frameIndex 
     * @returns {ClipInstanceModel|null}
     */
    getCelAtFrame(frameIndex) {
        return this.cels.find(cel => {
            return frameIndex >= cel.startFrame && frameIndex < cel.startFrame + cel.duration;
        }) || null;
    }

    /**
     * セルを追加
     * @param {Object} options 
     */
    addCel(options) {
        if (!this.canPlaceCel(options.startFrame, options.duration || 1)) {
            return null;
        }
        const cel = new ClipInstanceModel(options);
        this.cels.push(cel);
        return cel;
    }

    /**
     * 指定された範囲にセルを配置可能かチェック
     */
    canPlaceCel(startFrame, duration, ignoreCelId = null) {
        const endFrame = startFrame + duration;
        return !this.cels.some(cel => {
            if (ignoreCelId && cel.id === ignoreCelId) return false;
            const celEnd = cel.startFrame + cel.duration;
            return startFrame < celEnd && endFrame > cel.startFrame;
        });
    }

    /**
     * セルの長さを変更
     */
    setCelDuration(celId, newDuration) {
        const cel = this.cels.find(c => c.id === celId);
        if (!cel) return false;

        const duration = Math.max(1, newDuration);
        if (this.canPlaceCel(cel.startFrame, duration, cel.id)) {
            cel.duration = duration;
            return true;
        }
        return false;
    }

    /**
     * 指定フレームのセルを削除
     */
    removeCelAtFrame(frameIndex) {
        this.cels = this.cels.filter(cel => cel.startFrame !== frameIndex);
    }

    /**
     * 指定フレームのセルの有無を反転
     */
    toggleCelAtFrame(frameIndex) {
        const existing = this.getCelAtFrame(frameIndex);
        if (existing) {
            this.removeCelAtFrame(frameIndex);
        } else {
            this.addCel({
                startFrame: frameIndex,
                duration: 1
            });
        }
    }

    detachSourceLayer() {
        this.sourceLayerId = null;
        this.layerId = null;
        this.kind = 'independent';
        this.sourceMissing = false;
        this.cels.forEach(cel => {
            cel.sourceLayerId = null;
            cel.layerId = null;
        });
    }

    serialize() {
        return {
            id: this.id,
            sourceLayerId: this.sourceLayerId,
            layerId: this.layerId, // 互換維持
            name: this.name,
            displayName: this.displayName,
            sourceName: this.sourceName,
            kind: this.kind,
            orderIndex: this.orderIndex,
            sourceMissing: this.sourceMissing,
            isBackground: this.isBackground,
            type: this.type,
            active: this.active,
            visible: this.visible,
            cels: this.cels.map(cel => cel.serialize())
        };
    }
}

/**
 * 互換エイリアス
 */
export class TrackModel extends LaneModel {}

/**
 * タイムライン：全体構造
 */
export class TimelineModel {
    constructor(options = {}) {
        this.fps = options.fps || 8;
        this.totalFrames = options.totalFrames || 24;
        
        // 内部リスト名はまだ tracks を維持
        this.tracks = (options.tracks || []).map(track => new LaneModel(track));
        this.layerSyncInitialized = this.tracks.length > 0;
        
        this.clipAssetFolders = (options.clipAssetFolders || []).map(folder => new ClipAssetFolderModel(folder));
        this.clipGroups = (options.clipGroups || []).map(group => new ClipGroupModel(group));
        this.clipAssets = (options.clipAssets || []).map(asset => new ClipAssetModel(asset));
        this.drawingSnapshots = (options.drawingSnapshots || []).map(snap => new DrawingSnapshotModel(snap));
        this.playback = {
            currentFrame: options.playback?.currentFrame || 0,
            loop: options.playback?.loop !== false,
            endMode: options.playback?.endMode || 'last-clip', // 'timeline' | 'last-clip' | 'out-marker'
            inFrame: (options.playback?.inFrame !== undefined && options.playback?.inFrame !== null) ? Number(options.playback.inFrame) : null,
            outFrame: (options.playback?.outFrame !== undefined && options.playback?.outFrame !== null) ? Number(options.playback.outFrame) : null
        };
        this.clampPlaybackSettings();
    }

    getLaneById(laneId) {
        return this.tracks.find(t => t.id === laneId) || null;
    }

    getLaneForSourceLayer(sourceLayerId) {
        if (!sourceLayerId) return null;
        return this.tracks.find(t => t.sourceLayerId === sourceLayerId || t.layerId === sourceLayerId) || null;
    }

    getLaneDisplayName(lane, laneIndex = null) {
        if (!lane) return 'Lane';
        if (lane.displayName) return lane.displayName;
        if (lane.isBackground) return 'Background';
        if (lane.type === 'folder') return lane.sourceName || lane.name || 'Folder';
        if (lane.kind === 'independent' && lane.name) return lane.name;
        if (!Number.isInteger(laneIndex)) {
            let visibleIndex = 0;
            for (const track of this.tracks) {
                if (track.type === 'folder' || track.isBackground) continue;
                if (track === lane) {
                    laneIndex = visibleIndex;
                    break;
                }
                visibleIndex += 1;
            }
        }
        if (Number.isInteger(laneIndex)) return `Lane ${laneIndex + 1}`;
        return lane.name || 'Lane';
    }

    createIndependentLane(options = {}) {
        const laneIndex = this.tracks.filter(t => t.type !== 'folder' && !t.isBackground).length;
        const lane = new LaneModel({
            ...options,
            sourceLayerId: null,
            layerId: null,
            kind: 'independent',
            name: options.name || `Lane ${laneIndex + 1}`,
            type: options.type || 'raster',
            orderIndex: Number.isInteger(options.orderIndex) ? options.orderIndex : this.tracks.length
        });
        if (options.placement === 'top') {
            this.tracks.unshift(lane);
        } else {
            const backgroundIndex = this.tracks.findIndex(t => t.isBackground);
            if (backgroundIndex >= 0) {
                this.tracks.splice(backgroundIndex, 0, lane);
            } else {
                this.tracks.push(lane);
            }
        }
        this.tracks.forEach((track, index) => { track.orderIndex = index; });
        return lane;
    }

    detachLaneSourceLayer(laneId) {
        const lane = this.getLaneById(laneId);
        if (!lane) return false;
        lane.detachSourceLayer();
        return true;
    }

    getClipById(clipId) {
        for (const lane of this.tracks) {
            const clip = lane.cels.find(c => c.id === clipId);
            if (clip) return clip;
        }
        return null;
    }

    findClipEntry(clipId) {
        for (const lane of this.tracks) {
            const clip = lane.cels.find(c => c.id === clipId);
            if (clip) {
                return { lane, track: lane, clip, cel: clip };
            }
        }
        return null;
    }

    removeClips(clipIds = []) {
        const uniqueIds = [...new Set(
            (Array.isArray(clipIds) ? clipIds : []).filter(Boolean)
        )];
        if (uniqueIds.length === 0) {
            return { ok: false, reason: 'selection-empty' };
        }

        const entries = uniqueIds.map(clipId => this.findClipEntry(clipId));
        if (entries.some(entry => !entry?.lane || !entry?.clip)) {
            return { ok: false, reason: 'clip-not-found' };
        }

        const idSet = new Set(uniqueIds);
        const removedClips = entries.map(entry => ({
            clipId: entry.clip.id,
            assetId: entry.clip.assetId || null,
            laneId: entry.lane.id,
            frameIndex: entry.clip.startFrame,
            duration: entry.clip.duration
        }));
        this.tracks.forEach(lane => {
            lane.cels = (lane.cels || []).filter(clip => !idSet.has(clip.id));
        });
        const groupResult = this.reconcileClipGroups();
        return {
            ok: true,
            clipIds: uniqueIds,
            removedClips,
            removedGroupIds: groupResult.removedGroupIds || []
        };
    }

    getClipGroup(groupId) {
        return this.clipGroups.find(group => group.id === groupId) || null;
    }

    getClipGroupForClip(clipId) {
        if (!clipId) return null;
        return this.clipGroups.find(group => group.clipIds.includes(clipId)) || null;
    }

    canCreateClipGroup(clipIds = []) {
        const uniqueIds = [...new Set(Array.isArray(clipIds) ? clipIds.filter(Boolean) : [])];
        if (uniqueIds.length < 2) return { ok: false, reason: 'selection-too-small' };
        if (uniqueIds.some(clipId => this.getClipGroupForClip(clipId))) {
            return { ok: false, reason: 'already-grouped' };
        }
        return this.checkClipGroupConnectivity(uniqueIds);
    }

    checkClipGroupConnectivity(clipIds = []) {
        const uniqueIds = [...new Set(Array.isArray(clipIds) ? clipIds.filter(Boolean) : [])];
        if (uniqueIds.length < 2) return { ok: false, reason: 'selection-too-small' };
        const movableLanes = this.tracks.filter(lane => lane.type !== 'folder' && !lane.isBackground);
        const entries = uniqueIds.map(clipId => this.findClipEntry(clipId));
        if (entries.some(entry => !entry)) return { ok: false, reason: 'clip-not-found' };
        const nodes = entries.map(entry => ({
            clipId: entry.clip.id,
            laneIndex: movableLanes.findIndex(lane => lane.id === entry.lane.id),
            startFrame: entry.clip.startFrame,
            endFrame: entry.clip.startFrame + Math.max(1, entry.clip.duration || 1)
        }));
        if (nodes.some(node => node.laneIndex < 0)) return { ok: false, reason: 'invalid-lane' };

        const isAdjacent = (a, b) => {
            const laneDistance = Math.abs(a.laneIndex - b.laneIndex);
            if (laneDistance === 0) {
                return a.endFrame === b.startFrame || b.endFrame === a.startFrame;
            }
            if (laneDistance === 1) {
                return a.startFrame < b.endFrame && b.startFrame < a.endFrame;
            }
            return false;
        };

        const visited = new Set([nodes[0].clipId]);
        const queue = [nodes[0]];
        while (queue.length > 0) {
            const current = queue.shift();
            nodes.forEach(candidate => {
                if (visited.has(candidate.clipId) || !isAdjacent(current, candidate)) return;
                visited.add(candidate.clipId);
                queue.push(candidate);
            });
        }
        if (visited.size !== nodes.length) return { ok: false, reason: 'selection-not-contiguous' };
        return { ok: true, clipIds: uniqueIds };
    }

    createClipGroup(clipIds = [], options = {}) {
        const check = this.canCreateClipGroup(clipIds);
        if (!check.ok) return check;
        const group = new ClipGroupModel({
            name: options.name || `CAF Group ${this.clipGroups.length + 1}`,
            clipIds: check.clipIds
        });
        this.clipGroups.push(group);
        return { ok: true, group };
    }

    removeClipGroup(groupId) {
        const index = this.clipGroups.findIndex(group => group.id === groupId);
        if (index < 0) return { ok: false, reason: 'group-not-found' };
        const [group] = this.clipGroups.splice(index, 1);
        return { ok: true, group };
    }

    reconcileClipGroups() {
        const existingClipIds = new Set();
        this.tracks.forEach(lane => (lane.cels || []).forEach(clip => existingClipIds.add(clip.id)));
        const removedGroupIds = [];
        this.clipGroups = this.clipGroups.filter(group => {
            group.clipIds = group.clipIds.filter(clipId => existingClipIds.has(clipId));
            group.updatedAt = Date.now();
            if (this.checkClipGroupConnectivity(group.clipIds).ok) return true;
            removedGroupIds.push(group.id);
            return false;
        });
        return { removedGroupIds };
    }

    setClipTransform(clipId, transform = {}) {
        const entry = this.findClipEntry(clipId);
        if (!entry) return { ok: false, reason: 'clip-not-found' };

        entry.clip.transform = normalizeClipTransform({
            ...(entry.clip.transform || {}),
            ...(transform || {})
        });
        return { ok: true, lane: entry.lane, clip: entry.clip };
    }

    setClipTransformKeyframes(clipId, keyframes = []) {
        const entry = this.findClipEntry(clipId);
        if (!entry) return { ok: false, reason: 'clip-not-found' };

        entry.clip.transformKeyframes = Array.isArray(keyframes)
            ? keyframes.map(keyframe => clonePlainObject(keyframe))
            : [];
        return { ok: true, lane: entry.lane, clip: entry.clip };
    }

    registerClipAssetRigPart(assetId, layerId, options = {}) {
        const asset = this.getClipAsset(assetId);
        if (!asset) return { ok: false, reason: 'asset-not-found' };
        const target = resolveRigPartTarget(asset, layerId);
        if (!target.ok) return target;

        const registration = registerRigPartDefinition(asset.rigDefinition, target.layer.id, {
            maxParts: options.maxParts ?? Number.POSITIVE_INFINITY
        });
        if (!registration.ok) return registration;
        const validation = validateRigDefinition(registration.value, asset.internalLayers);
        if (!validation.ok) {
            return { ok: false, reason: 'invalid-rig-definition', errors: validation.errors };
        }
        asset.rigDefinition = validation.value;
        asset.updatedAt = Date.now();
        return {
            ...registration,
            asset,
            layer: target.layer,
            targetKind: target.targetKind,
            part: registration.part
        };
    }

    registerClipAssetFolderPart(assetId, layerId, options = {}) {
        const asset = this.getClipAsset(assetId);
        if (!asset) return { ok: false, reason: 'asset-not-found' };
        const layer = asset.internalLayers?.find(candidate => candidate?.id === layerId) || null;
        if (!layer) return { ok: false, reason: 'layer-not-found' };
        if (layer.type !== 'folder') return { ok: false, reason: 'folder-required' };
        return this.registerClipAssetRigPart(assetId, layerId, options);
    }

    registerClipAssetRootBoneBinding(assetId, partId, options = {}) {
        const asset = this.getClipAsset(assetId);
        if (!asset) return { ok: false, reason: 'asset-not-found' };
        const part = asset.rigDefinition?.parts?.find(candidate => candidate?.partId === partId) || null;
        if (!part) return { ok: false, reason: 'part-not-found' };
        const target = resolveRigPartTarget(asset, partId);
        if (!target.ok) return target;

        const registration = registerRootBoneRigidBinding(
            asset.rigDefinition,
            options.boneId || createId(),
            partId,
            options
        );
        if (!registration.ok) return registration;
        const validation = validateRigDefinition(registration.value, asset.internalLayers);
        if (!validation.ok) {
            return { ok: false, reason: 'invalid-rig-definition', errors: validation.errors };
        }
        asset.rigDefinition = validation.value;
        asset.updatedAt = Date.now();
        return {
            ...registration,
            asset,
            layer: target.layer,
            targetKind: target.targetKind,
            part
        };
    }

    /**
     * 一枚Rasterをrigid Part方式からMesh Bone Setupへ明示的に戻す。
     * 対象Part / rigid Boneと対応Motion trackだけを除去し、未接続Mesh Boneは維持する。
     */
    removeClipAssetRigidRasterTarget(assetId, layerId) {
        const asset = this.getClipAsset(assetId);
        if (!asset) return { ok: false, changed: false, reason: 'asset-not-found' };
        const layer = asset.internalLayers?.find(candidate => candidate?.id === layerId) || null;
        if (!layer) return { ok: false, changed: false, reason: 'layer-not-found' };
        if (layer.type !== 'raster') return { ok: false, changed: false, reason: 'raster-required' };
        const part = asset.rigDefinition?.parts?.find(candidate => candidate?.partId === layer.id) || null;
        if (!part) return { ok: true, changed: false, asset, layer, removedPartIds: [], removedBoneIds: [] };

        const rigidBoneIds = new Set((asset.rigDefinition?.rigidBindings || [])
            .filter(binding => binding?.partId === part.partId)
            .map(binding => binding?.boneId)
            .filter(Boolean));
        const skinUsesRigidBone = (asset.skinBindings || []).some(binding => (
            (binding?.vertexWeights || []).some(vertexWeight => (
                (vertexWeight?.influences || []).some(influence => (
                    Number(influence?.weight) > 0 && rigidBoneIds.has(influence?.boneId)
                ))
            ))
        ));
        if (skinUsesRigidBone) {
            return { ok: false, changed: false, reason: 'rig-bone-used-by-skin' };
        }

        const removal = removeRigDefinitionTargets(asset.rigDefinition, { partIds: [part.partId] });
        if (!removal.ok) return { ...removal, changed: false };
        const validation = validateRigDefinition(removal.value, asset.internalLayers);
        if (!validation.ok) {
            return {
                ok: false,
                changed: false,
                reason: 'invalid-rig-definition',
                errors: validation.errors
            };
        }
        asset.rigDefinition = validation.value;
        this.tracks.forEach(track => {
            (track.cels || []).forEach(clip => {
                if (clip.assetId !== asset.id) return;
                clip.rigMotion = removeRigMotionTargets(clip.rigMotion, removal);
            });
        });
        asset.updatedAt = Date.now();
        return {
            ok: true,
            changed: removal.changed === true,
            asset,
            layer,
            removedPartIds: removal.partIds,
            removedBoneIds: removal.boneIds
        };
    }

    /**
     * Raster Skinning用のBoneだけを既存Rigへ追加する。
     * Raster / Meshへのweight対応はskinBindingsが所有し、Part rigid bindingは作らない。
     */
    registerClipAssetRasterBone(assetId, layerId, options = {}) {
        const asset = this.getClipAsset(assetId);
        if (!asset) return { ok: false, reason: 'asset-not-found' };
        const layer = asset.internalLayers?.find(candidate => candidate?.id === layerId) || null;
        if (!layer) return { ok: false, reason: 'layer-not-found' };
        if (layer.type !== 'raster') return { ok: false, reason: 'raster-required' };
        if (asset.rigDefinition?.parts?.some(part => part?.partId === layer.id)) {
            return { ok: false, reason: 'rig-mode-conflict', layer };
        }

        const registration = registerRigBoneDefinition(
            asset.rigDefinition,
            options.boneId || createId(),
            options
        );
        if (!registration.ok) return registration;
        const validation = validateRigDefinition(registration.value, asset.internalLayers);
        if (!validation.ok) {
            return { ok: false, reason: 'invalid-rig-definition', errors: validation.errors };
        }
        asset.rigDefinition = validation.value;
        asset.updatedAt = Date.now();
        return { ...registration, asset, layer };
    }

    generateClipAssetRasterBoneSetup(assetId, layerId, options = {}) {
        const asset = this.getClipAsset(assetId);
        if (!asset) return { ok: false, reason: 'asset-not-found' };
        const layer = asset.internalLayers?.find(candidate => candidate?.id === layerId) || null;
        if (!layer) return { ok: false, reason: 'layer-not-found' };
        if (layer.type !== 'raster') return { ok: false, reason: 'raster-required' };
        if (asset.rigDefinition?.parts?.some(part => part?.partId === layer.id)) {
            return { ok: false, reason: 'rig-mode-conflict', layer };
        }
        const snapshot = this.getDrawingSnapshot(layer.drawingSnapshotId);
        if (!snapshot?.pixels) return { ok: false, reason: 'snapshot-not-found' };

        const rigidBoneIds = new Set((asset.rigDefinition?.rigidBindings || [])
            .map(binding => binding?.boneId)
            .filter(Boolean));
        const availableBoneIds = (asset.rigDefinition?.bones || [])
            .map(bone => bone?.boneId)
            .filter(boneId => boneId && !rigidBoneIds.has(boneId));
        const requestedBoneIds = Array.isArray(options.boneIds)
            ? options.boneIds.filter(boneId => availableBoneIds.includes(boneId))
            : availableBoneIds;
        if (requestedBoneIds.length === 0) return { ok: false, reason: 'mesh-bone-required' };

        const generatorMode = options.generatorMode === 'auto-shape-line'
            ? 'auto-shape-line'
            : options.generatorMode === 'auto-shape'
                ? 'auto-shape'
                : 'alpha-fit-grid';
        const factory = generatorMode === 'auto-shape-line'
            ? createLineRibbonRasterBoneSetup
            : generatorMode === 'auto-shape'
                ? createAutoShapeRasterBoneSetup
                : createAlphaFitRasterBoneSetup;
        const generated = factory(asset, layer.id, snapshot, {
            ...options,
            boneIds: requestedBoneIds,
            idFactory: () => createId()
        });
        if (!generated.ok) return generated;
        const previousMesh = (asset.meshDefinitions || [])
            .find(mesh => mesh?.targetInternalLayerId === layer.id) || null;
        const meshDefinitions = [
            ...(asset.meshDefinitions || []).filter(mesh => mesh?.targetInternalLayerId !== layer.id),
            generated.meshDefinition
        ];
        const skinBindings = [
            ...(asset.skinBindings || []).filter(binding => (
                binding?.meshId !== previousMesh?.meshId
                && binding?.meshId !== generated.meshDefinition.meshId
            )),
            generated.skinBinding
        ];
        const validation = validateRasterBoneSkinning(
            meshDefinitions,
            skinBindings,
            asset.internalLayers,
            asset.rigDefinition
        );
        if (!validation.ok) {
            return { ok: false, reason: 'invalid-raster-bone-setup', errors: validation.errors };
        }
        asset.meshDefinitions = validation.meshDefinitions;
        asset.skinBindings = validation.skinBindings;
        asset.updatedAt = Date.now();
        return { ...generated, asset, layer, previousMesh, generatorMode };
    }

    generateClipAssetAutoShapeBoneSetup(assetId, layerId, options = {}) {
        return this.generateClipAssetRasterBoneSetup(assetId, layerId, {
            ...options,
            generatorMode: 'auto-shape'
        });
    }

    generateClipAssetLineRibbonBoneSetup(assetId, layerId, options = {}) {
        return this.generateClipAssetRasterBoneSetup(assetId, layerId, {
            ...options,
            generatorMode: 'auto-shape-line'
        });
    }

    applyClipAssetRasterSkinInfluenceCorrection(assetId, layerId, boneId, vertexIds, action) {
        const asset = this.getClipAsset(assetId);
        if (!asset) return { ok: false, changed: false, reason: 'asset-not-found' };
        const plan = createSkinInfluenceCorrectionPlan(asset, layerId, boneId, vertexIds, action);
        if (!plan.ok || !plan.changed) return { ...plan, asset };
        asset.meshDefinitions = plan.meshDefinitions;
        asset.skinBindings = plan.skinBindings;
        asset.updatedAt = Date.now();
        return { ...plan, asset };
    }

    applyClipAssetRasterSkinWeightBrush(assetId, layerId, boneId, vertexDeltas) {
        const asset = this.getClipAsset(assetId);
        if (!asset) return { ok: false, changed: false, reason: 'asset-not-found' };
        const status = this.getClipAssetRasterMeshStatus(assetId, layerId);
        if (status.state === 'stale') {
            return { ok: false, changed: false, reason: 'mesh-stale', asset };
        }
        if (status.state !== 'current') {
            return { ok: false, changed: false, reason: 'fixed-topology-generator-required', asset };
        }
        const plan = createSkinWeightBrushPlan(asset, layerId, boneId, vertexDeltas);
        if (!plan.ok || !plan.changed) return { ...plan, asset };
        asset.meshDefinitions = plan.meshDefinitions;
        asset.skinBindings = plan.skinBindings;
        asset.updatedAt = Date.now();
        return { ...plan, asset };
    }

    applyClipAssetRasterMeshVertexPositionEdit(assetId, layerId, vertexPositions) {
        const asset = this.getClipAsset(assetId);
        if (!asset) return { ok: false, changed: false, reason: 'asset-not-found' };
        const status = this.getClipAssetRasterMeshStatus(assetId, layerId);
        if (status.state === 'stale') {
            return { ok: false, changed: false, reason: 'mesh-stale', asset };
        }
        if (status.state !== 'current') {
            return { ok: false, changed: false, reason: 'fixed-topology-generator-required', asset };
        }
        const plan = createRasterMeshVertexPositionEditPlan(
            asset,
            layerId,
            vertexPositions,
            status.snapshot?.rasterBounds
        );
        if (!plan.ok || !plan.changed) return { ...plan, asset };
        asset.meshDefinitions = plan.meshDefinitions;
        asset.skinBindings = plan.skinBindings;
        asset.updatedAt = Date.now();
        return { ...plan, asset };
    }

    getClipAssetRasterMeshStatus(assetId, layerId) {
        const asset = this.getClipAsset(assetId);
        const layer = asset?.internalLayers?.find(candidate => candidate?.id === layerId) || null;
        if (!asset || !layer || layer.type !== 'raster') return { state: 'missing', stale: false };
        const mesh = (asset.meshDefinitions || [])
            .find(candidate => candidate?.targetInternalLayerId === layer.id) || null;
        const snapshot = this.getDrawingSnapshot(layer.drawingSnapshotId);
        const status = mesh?.generator?.type === AUTO_SHAPE_LINE_RIBBON_GENERATOR
            ? getLineRibbonRasterMeshStatus(mesh, snapshot)
            : mesh?.generator?.type === AUTO_SHAPE_FILL_GENERATOR
                ? getAutoShapeRasterMeshStatus(mesh, snapshot)
                : getAlphaFitRasterMeshStatus(mesh, snapshot);
        return { ...status, mesh, snapshot };
    }

    /** History / duplicate adapterが既存generator sourceだけを現Snapshotへrebaseする。 */
    rebaseClipAssetRasterMeshSource(assetId, layerId) {
        const asset = this.getClipAsset(assetId);
        const layer = asset?.internalLayers?.find(candidate => candidate?.id === layerId) || null;
        if (!asset || !layer || layer.type !== 'raster' || !Array.isArray(asset.meshDefinitions)) {
            return { ok: false, changed: false };
        }
        const snapshot = this.getDrawingSnapshot(layer.drawingSnapshotId);
        if (!snapshot) return { ok: false, changed: false };
        let changed = false;
        asset.meshDefinitions = asset.meshDefinitions.map(mesh => {
            if (mesh?.targetInternalLayerId !== layer.id) return mesh;
            const rebased = rebaseLineRibbonRasterMeshSource(
                rebaseAutoShapeRasterMeshSource(
                    rebaseAlphaFitRasterMeshSource(mesh, snapshot),
                    snapshot
                ),
                snapshot
            );
            changed = changed || rebased !== mesh;
            return rebased;
        });
        return { ok: true, changed };
    }

    setClipAssetRigBoneBindTransform(assetId, boneId, transform = {}) {
        const asset = this.getClipAsset(assetId);
        if (!asset) return { ok: false, reason: 'asset-not-found' };
        const update = updateRigBoneBindTransform(asset.rigDefinition, boneId, transform);
        if (!update.ok) return update;
        const validation = validateRigDefinition(update.value, asset.internalLayers);
        if (!validation.ok) {
            return { ok: false, reason: 'invalid-rig-definition', errors: validation.errors };
        }
        asset.rigDefinition = validation.value;
        asset.updatedAt = Date.now();
        return { ...update, asset, bone: validation.value.bones.find(bone => bone.boneId === boneId) };
    }

    setClipAssetRigBoneParent(assetId, boneId, parentBoneId = null) {
        const asset = this.getClipAsset(assetId);
        if (!asset) return { ok: false, reason: 'asset-not-found' };
        const update = updateRigBoneParent(asset.rigDefinition, boneId, parentBoneId);
        if (!update.ok) return update;
        const validation = validateRigDefinition(update.value, asset.internalLayers);
        if (!validation.ok) {
            return { ok: false, reason: 'invalid-rig-definition', errors: validation.errors };
        }
        asset.rigDefinition = validation.value;
        asset.updatedAt = Date.now();
        return { ...update, asset, bone: validation.value.bones.find(bone => bone.boneId === boneId) };
    }

    registerClipAssetWarpAnchorConstraint(assetId, constraint) {
        const asset = this.getClipAsset(assetId);
        if (!asset) return { ok: false, reason: 'asset-not-found' };
        const registration = registerWarpAnchorConstraint(asset.rigDefinition, constraint);
        if (!registration.ok) return registration;
        const validation = validateRigDefinition(registration.value, asset.internalLayers);
        if (!validation.ok) {
            return { ok: false, reason: 'invalid-rig-definition', errors: validation.errors };
        }
        asset.rigDefinition = validation.value;
        asset.updatedAt = Date.now();
        return { ...registration, asset, constraint: validation.value.warpAnchorConstraints?.at(-1) || null };
    }

    removeClipAssetWarpAnchorConstraint(assetId, sourceFolderLayerId, targetBoneId) {
        const asset = this.getClipAsset(assetId);
        if (!asset) return { ok: false, reason: 'asset-not-found' };
        const update = removeWarpAnchorConstraint(
            asset.rigDefinition,
            sourceFolderLayerId,
            targetBoneId
        );
        if (!update.ok) return update;
        const validation = validateRigDefinition(update.value, asset.internalLayers);
        if (!validation.ok) {
            return { ok: false, reason: 'invalid-rig-definition', errors: validation.errors };
        }
        asset.rigDefinition = validation.value;
        asset.updatedAt = Date.now();
        return { ...update, asset };
    }

    setClipRigPartKey(clipId, partId, localFrame, transform = {}, options = {}) {
        const entry = this.findClipEntry(clipId);
        if (!entry?.clip) return { ok: false, reason: 'clip-not-found' };
        const asset = entry.clip.assetId ? this.getClipAsset(entry.clip.assetId) : null;
        const definition = validateRigDefinition(asset?.rigDefinition, asset?.internalLayers);
        if (!definition.ok || !definition.value?.parts?.some(part => part?.partId === partId)) {
            return { ok: false, reason: 'part-not-found', errors: definition.errors };
        }
        const duration = Math.max(1, Number.isInteger(entry.clip.duration) ? entry.clip.duration : 1);
        if (!Number.isInteger(localFrame) || localFrame < 0 || localFrame >= duration) {
            return { ok: false, reason: 'part-key-out-of-range' };
        }
        const update = upsertRigPartKey(entry.clip.rigMotion, partId, localFrame, transform, options);
        if (!update.ok) return update;
        const validation = validateRigMotion(update.value, definition.value, duration);
        if (!validation.ok) {
            return { ok: false, reason: 'invalid-rig-motion', errors: validation.errors };
        }
        entry.clip.rigMotion = validation.value;
        return { ...update, lane: entry.lane, clip: entry.clip, asset };
    }

    removeClipRigPartKey(clipId, partId, localFrame) {
        const entry = this.findClipEntry(clipId);
        if (!entry?.clip) return { ok: false, reason: 'clip-not-found' };
        const asset = entry.clip.assetId ? this.getClipAsset(entry.clip.assetId) : null;
        const definition = validateRigDefinition(asset?.rigDefinition, asset?.internalLayers);
        if (!definition.ok || !definition.value?.parts?.some(part => part?.partId === partId)) {
            return { ok: false, reason: 'part-not-found', errors: definition.errors };
        }
        const update = removeRigPartKey(entry.clip.rigMotion, partId, localFrame);
        if (!update.ok) return update;
        const validation = validateRigMotion(update.value, definition.value, entry.clip.duration);
        if (!validation.ok) {
            return { ok: false, reason: 'invalid-rig-motion', errors: validation.errors };
        }
        entry.clip.rigMotion = validation.value;
        return { ...update, lane: entry.lane, clip: entry.clip, asset };
    }

    moveClipRigPartKey(clipId, partId, sourceFrame, targetFrame) {
        const entry = this.findClipEntry(clipId);
        if (!entry?.clip) return { ok: false, reason: 'clip-not-found' };
        const asset = entry.clip.assetId ? this.getClipAsset(entry.clip.assetId) : null;
        const definition = validateRigDefinition(asset?.rigDefinition, asset?.internalLayers);
        if (!definition.ok || !definition.value?.parts?.some(part => part?.partId === partId)) {
            return { ok: false, reason: 'part-not-found', errors: definition.errors };
        }
        const duration = Math.max(1, Number.isInteger(entry.clip.duration) ? entry.clip.duration : 1);
        if (
            !Number.isInteger(sourceFrame)
            || sourceFrame < 0
            || sourceFrame >= duration
            || !Number.isInteger(targetFrame)
            || targetFrame < 0
            || targetFrame >= duration
        ) {
            return { ok: false, reason: 'part-key-out-of-range' };
        }
        const update = moveRigPartKey(entry.clip.rigMotion, partId, sourceFrame, targetFrame);
        if (!update.ok) return update;
        const validation = validateRigMotion(update.value, definition.value, duration);
        if (!validation.ok) {
            return { ok: false, reason: 'invalid-rig-motion', errors: validation.errors };
        }
        entry.clip.rigMotion = validation.value;
        return { ...update, lane: entry.lane, clip: entry.clip, asset };
    }

    setClipRigBoneKey(clipId, boneId, localFrame, transform = {}, options = {}) {
        const entry = this.findClipEntry(clipId);
        if (!entry?.clip) return { ok: false, reason: 'clip-not-found' };
        const asset = entry.clip.assetId ? this.getClipAsset(entry.clip.assetId) : null;
        const definition = validateRigDefinition(asset?.rigDefinition, asset?.internalLayers);
        if (!definition.ok || !definition.value?.bones?.some(bone => bone?.boneId === boneId)) {
            return { ok: false, reason: 'bone-not-found', errors: definition.errors };
        }
        const duration = Math.max(1, Number.isInteger(entry.clip.duration) ? entry.clip.duration : 1);
        if (!Number.isInteger(localFrame) || localFrame < 0 || localFrame >= duration) {
            return { ok: false, reason: 'bone-key-out-of-range' };
        }
        const update = upsertRigBoneKey(entry.clip.rigMotion, boneId, localFrame, transform, options);
        if (!update.ok) return update;
        const validation = validateRigMotion(update.value, definition.value, duration);
        if (!validation.ok) {
            return { ok: false, reason: 'invalid-rig-motion', errors: validation.errors };
        }
        entry.clip.rigMotion = validation.value;
        return { ...update, lane: entry.lane, clip: entry.clip, asset };
    }

    removeClipRigBoneKey(clipId, boneId, localFrame) {
        const entry = this.findClipEntry(clipId);
        if (!entry?.clip) return { ok: false, reason: 'clip-not-found' };
        const asset = entry.clip.assetId ? this.getClipAsset(entry.clip.assetId) : null;
        const definition = validateRigDefinition(asset?.rigDefinition, asset?.internalLayers);
        if (!definition.ok || !definition.value?.bones?.some(bone => bone?.boneId === boneId)) {
            return { ok: false, reason: 'bone-not-found', errors: definition.errors };
        }
        const update = removeRigBoneKey(entry.clip.rigMotion, boneId, localFrame);
        if (!update.ok) return update;
        const validation = validateRigMotion(update.value, definition.value, entry.clip.duration);
        if (!validation.ok) {
            return { ok: false, reason: 'invalid-rig-motion', errors: validation.errors };
        }
        entry.clip.rigMotion = validation.value;
        return { ...update, lane: entry.lane, clip: entry.clip, asset };
    }

    moveClipRigBoneKey(clipId, boneId, sourceFrame, targetFrame) {
        const entry = this.findClipEntry(clipId);
        if (!entry?.clip) return { ok: false, reason: 'clip-not-found' };
        const asset = entry.clip.assetId ? this.getClipAsset(entry.clip.assetId) : null;
        const definition = validateRigDefinition(asset?.rigDefinition, asset?.internalLayers);
        if (!definition.ok || !definition.value?.bones?.some(bone => bone?.boneId === boneId)) {
            return { ok: false, reason: 'bone-not-found', errors: definition.errors };
        }
        const duration = Math.max(1, Number.isInteger(entry.clip.duration) ? entry.clip.duration : 1);
        if (
            !Number.isInteger(sourceFrame)
            || sourceFrame < 0
            || sourceFrame >= duration
            || !Number.isInteger(targetFrame)
            || targetFrame < 0
            || targetFrame >= duration
        ) {
            return { ok: false, reason: 'bone-key-out-of-range' };
        }
        const update = moveRigBoneKey(entry.clip.rigMotion, boneId, sourceFrame, targetFrame);
        if (!update.ok) return update;
        const validation = validateRigMotion(update.value, definition.value, duration);
        if (!validation.ok) {
            return { ok: false, reason: 'invalid-rig-motion', errors: validation.errors };
        }
        entry.clip.rigMotion = validation.value;
        return { ...update, lane: entry.lane, clip: entry.clip, asset };
    }

    /**
     * 複数trackのFrame移動など、呼び出し側で一括編集したRig Motionを検証して反映する。
     * 保存正本は引き続きClipInstance.rigMotionだけとし、UI選択状態は受け取らない。
     */
    setClipRigMotion(clipId, rigMotion = null) {
        const entry = this.findClipEntry(clipId);
        if (!entry?.clip) return { ok: false, reason: 'clip-not-found' };
        const asset = entry.clip.assetId ? this.getClipAsset(entry.clip.assetId) : null;
        const definition = validateRigDefinition(asset?.rigDefinition, asset?.internalLayers);
        if (!definition.ok) {
            return { ok: false, reason: 'invalid-rig-definition', errors: definition.errors };
        }
        const duration = Math.max(1, Number.isInteger(entry.clip.duration) ? entry.clip.duration : 1);
        const validation = validateRigMotion(rigMotion, definition.value, duration);
        if (!validation.ok) {
            return { ok: false, reason: 'invalid-rig-motion', errors: validation.errors };
        }
        entry.clip.rigMotion = validation.value;
        return { ok: true, lane: entry.lane, clip: entry.clip, asset };
    }

    setClipDeformer(clipId, deformer = null) {
        const entry = this.findClipEntry(clipId);
        if (!entry) return { ok: false, reason: 'clip-not-found' };

        entry.clip.deformer = normalizeClipDeformer(deformer);
        return { ok: true, lane: entry.lane, clip: entry.clip };
    }

    /**
     * ClipInstance内のFolderを対象にしたWARPを検証済みcollectionとして設定する。
     * Folder単位のWARPも既存ClipInstance.deformerと同じ保存正本を共有する。
     */
    setClipFolderDeformer(clipId, folderLayerId, deformer = null) {
        const entry = this.findClipEntry(clipId);
        if (!entry?.clip) return { ok: false, reason: 'clip-not-found' };
        const asset = entry.clip.assetId ? this.getClipAsset(entry.clip.assetId) : null;
        if (!asset) return { ok: false, reason: 'asset-not-found' };
        const folder = asset.internalLayers?.find(layer => layer?.id === folderLayerId) || null;
        if (!folder) return { ok: false, reason: 'folder-not-found' };
        if (folder.type !== 'folder') return { ok: false, reason: 'folder-required' };

        if (deformer !== null && deformer !== undefined && !normalizeClipDeformer(deformer)) {
            return { ok: false, reason: 'invalid-folder-deformer' };
        }
        const next = deformer === null || deformer === undefined
            ? removeClipFolderDeformerTarget(entry.clip.folderDeformers, folderLayerId)
            : setClipFolderDeformerTarget(entry.clip.folderDeformers, folderLayerId, deformer);
        const validation = validateClipFolderDeformers(next, asset.internalLayers);
        if (!validation.ok) {
            return { ok: false, reason: 'invalid-folder-deformers', errors: validation.errors };
        }
        entry.clip.folderDeformers = validation.value;
        entry.clip._folderDeformerSourceErrors = [];
        return { ok: true, lane: entry.lane, clip: entry.clip, asset };
    }

    removeClipFolderDeformer(clipId, folderLayerId) {
        return this.setClipFolderDeformer(clipId, folderLayerId, null);
    }

    setClipPhysics(clipId, physics = {}) {
        const entry = this.findClipEntry(clipId);
        if (!entry) return { ok: false, reason: 'clip-not-found' };

        entry.clip.physics = clonePlainObject({
            ...(entry.clip.physics || {}),
            ...(physics || {})
        }, {
            enabled: false,
            rigId: null,
            cacheId: null
        });
        return { ok: true, lane: entry.lane, clip: entry.clip };
    }

    /**
     * 指定IDのクリップアセットを取得
     */
    getClipAsset(assetId) {
        if (!assetId) return null;
        return this.clipAssets.find(a => a.id === assetId) || null;
    }

    getClipInstancesForAsset(assetId) {
        if (!assetId) return [];
        return this.tracks.flatMap(track => (track.cels || [])
            .filter(clip => clip?.assetId === assetId));
    }

    preflightClipAssetInternalLayerReparent(assetId, layerId, targetLayerId, placement = 'after') {
        const asset = this.getClipAsset(assetId);
        if (!asset) return { ok: false, reason: 'asset-not-found' };
        return preflightInternalLayerReparent({
            asset,
            clips: this.getClipInstancesForAsset(assetId),
            layerId,
            targetLayerId,
            placement
        });
    }

    /**
     * 指定IDのクリップアセットフォルダを取得
     */
    getClipAssetFolder(folderId) {
        if (!folderId) return null;
        return this.clipAssetFolders.find(f => f.id === folderId) || null;
    }

    /**
     * デフォルトフォルダを確保する
     */
    ensureDefaultClipAssetFolder() {
        let folder = this.clipAssetFolders.find(f => f.name === 'Default Assets' && !f.parentFolderId);
        if (!folder) {
            folder = new ClipAssetFolderModel({ name: 'Default Assets' });
            this.clipAssetFolders.push(folder);
        }
        return folder;
    }

    /**
     * 新しいアセットフォルダを作成
     */
    createClipAssetFolder(options = {}) {
        if (options.parentFolderId && !this.getClipAssetFolder(options.parentFolderId)) {
            return { ok: false, reason: 'parent-not-found' };
        }
        const folder = new ClipAssetFolderModel(options);
        this.clipAssetFolders.push(folder);
        return { ok: true, folder };
    }

    /**
     * フォルダ名を変更
     */
    renameClipAssetFolder(folderId, name) {
        const folder = this.getClipAssetFolder(folderId);
        if (!folder) return { ok: false, reason: 'not-found' };
        const trimmedName = typeof name === 'string' ? name.trim() : '';
        if (!trimmedName) return { ok: false, reason: 'invalid-name' };
        folder.name = trimmedName;
        folder.updatedAt = Date.now();
        return { ok: true, folder };
    }

    removeClipAssetFolder(folderId) {
        const folderIndex = this.clipAssetFolders.findIndex(folder => folder.id === folderId);
        if (folderIndex < 0) return { ok: false, reason: 'folder-not-found' };
        if (this.getClipAssetsInFolder(folderId).length > 0) {
            return { ok: false, reason: 'folder-not-empty' };
        }

        const [folder] = this.clipAssetFolders.splice(folderIndex, 1);
        return { ok: true, folder };
    }

    renameClipAsset(assetId, name) {
        const asset = this.getClipAsset(assetId);
        if (!asset) return { ok: false, reason: 'asset-not-found' };
        const trimmedName = typeof name === 'string' ? name.trim() : '';
        if (!trimmedName) return { ok: false, reason: 'invalid-name' };

        asset.name = trimmedName;
        asset.updatedAt = Date.now();
        return { ok: true, asset };
    }

    /**
     * アセットをフォルダへ移動
     */
    moveClipAssetToFolder(assetId, folderId) {
        const asset = this.getClipAsset(assetId);
        if (!asset) return { ok: false, reason: 'asset-not-found' };

        if (folderId !== null) {
            const folder = this.getClipAssetFolder(folderId);
            if (!folder) return { ok: false, reason: 'folder-not-found' };
        }

        asset.folderId = folderId;
        asset.updatedAt = Date.now();
        return { ok: true, asset };
    }

    removeClipAsset(assetId, options = {}) {
        const assetIndex = this.clipAssets.findIndex(asset => asset.id === assetId);
        if (assetIndex < 0) return { ok: false, reason: 'asset-not-found' };
        if (this.countAssetReferences(assetId) > 0 && options.force !== true) {
            return { ok: false, reason: 'asset-in-use' };
        }

        const [removedAsset] = this.clipAssets.splice(assetIndex, 1);
        const candidateSnapshotIds = new Set();
        if (removedAsset.drawingSnapshotId) candidateSnapshotIds.add(removedAsset.drawingSnapshotId);
        removedAsset.internalLayers.forEach(layer => {
            if (layer.drawingSnapshotId) candidateSnapshotIds.add(layer.drawingSnapshotId);
        });

        const referencedSnapshotIds = new Set();
        this.clipAssets.forEach(asset => {
            if (asset.drawingSnapshotId) referencedSnapshotIds.add(asset.drawingSnapshotId);
            asset.internalLayers.forEach(layer => {
                if (layer.drawingSnapshotId) referencedSnapshotIds.add(layer.drawingSnapshotId);
            });
        });

        const removedSnapshotIds = [];
        if (options.keepSnapshots !== true) {
            this.drawingSnapshots = this.drawingSnapshots.filter(snapshot => {
                if (!candidateSnapshotIds.has(snapshot.id) || referencedSnapshotIds.has(snapshot.id)) {
                    return true;
                }
                removedSnapshotIds.push(snapshot.id);
                return false;
            });
        }

        return { ok: true, asset: removedAsset, removedSnapshotIds };
    }

    /**
     * 指定フォルダ内のアセット一覧を取得
     */
    getClipAssetsInFolder(folderId) {
        return this.clipAssets.filter(a => a.folderId === folderId);
    }

    /**
     * 内部レイヤーを作成するヘルパー
     */
    createClipAssetInternalLayer(options = {}) {
        return new ClipAssetInternalLayerModel(options);
    }

    /**
     * アセットの内部レイヤー整合性を確保する
     */
    ensureClipAssetInternalLayer(assetId, options = {}) {
        const asset = this.getClipAsset(assetId);
        if (!asset) return { ok: false, reason: 'asset-not-found' };

        if (asset.internalLayers.length === 0) {
            const layer = this.createClipAssetInternalLayer({
                name: options.name || 'レイヤー1',
                drawingSnapshotId: asset.drawingSnapshotId,
                type: 'raster'
            });
            asset.internalLayers.push(layer);
            return { ok: true, asset, layer, created: true };
        }

        return { ok: true, asset, layer: asset.internalLayers[0], created: false };
    }

    /**
     * アセットに内部レイヤーを追加
     */
    addClipAssetInternalLayer(assetId, options = {}) {
        const asset = this.getClipAsset(assetId);
        if (!asset) return { ok: false, reason: 'asset-not-found' };

        const nextNum = asset.internalLayers.length + 1;
        const layer = this.createClipAssetInternalLayer({
            name: options.name || `レイヤー${nextNum}`,
            type: options.type || 'raster',
            visible: options.visible !== false,
            opacity: options.opacity ?? 1,
            blendMode: options.blendMode || 'normal',
            clipping: options.clipping === true,
            clippingMode: options.clippingMode,
            drawingSnapshotId: options.drawingSnapshotId || null,
            parentLayerId: options.parentLayerId || null
        });

        const insertIndex = this._resolveInternalLayerInsertIndex(asset, options);
        asset.internalLayers.splice(insertIndex, 0, layer);
        asset.updatedAt = Date.now();
        return { ok: true, asset, layer };
    }

    addClipAssetInternalFolder(assetId, options = {}) {
        const asset = this.getClipAsset(assetId);
        if (!asset) return { ok: false, reason: 'asset-not-found' };

        const folderCount = asset.internalLayers.filter(layer => layer.type === 'folder').length;
        const folder = this.createClipAssetInternalLayer({
            name: options.name || `フォルダ${folderCount + 1}`,
            type: 'folder',
            visible: options.visible !== false,
            opacity: options.opacity ?? 1,
            blendMode: options.blendMode || 'normal',
            clipping: options.clipping === true,
            clippingMode: options.clippingMode,
            parentLayerId: options.parentLayerId || null
        });

        const insertIndex = this._resolveInternalLayerInsertIndex(asset, options);
        asset.internalLayers.splice(insertIndex, 0, folder);
        asset.updatedAt = Date.now();
        return { ok: true, asset, layer: folder };
    }

    _resolveInternalLayerInsertIndex(asset, options = {}) {
        const layers = asset?.internalLayers || [];
        const referenceId = options.insertAfterLayerId || options.parentLayerId || null;
        if (!referenceId) return layers.length;

        const referenceIndex = layers.findIndex(layer => layer.id === referenceId);
        if (referenceIndex < 0) return layers.length;

        const subtreeIds = new Set([referenceId]);
        let changed = true;
        while (changed) {
            changed = false;
            layers.forEach(layer => {
                if (layer.parentLayerId && subtreeIds.has(layer.parentLayerId) && !subtreeIds.has(layer.id)) {
                    subtreeIds.add(layer.id);
                    changed = true;
                }
            });
        }

        let insertIndex = referenceIndex + 1;
        for (let index = referenceIndex + 1; index < layers.length; index++) {
            if (!subtreeIds.has(layers[index].id)) break;
            insertIndex = index + 1;
        }
        return insertIndex;
    }

    /**
     * アセットの内部レイヤーを削除
     */
    removeClipAssetInternalLayer(assetId, layerId, options = {}) {
        const asset = this.getClipAsset(assetId);
        if (!asset) return { ok: false, reason: 'asset-not-found' };

        const targetLayer = asset.internalLayers.find(l => l.id === layerId);
        const drawableLayers = asset.internalLayers.filter(l => l.type !== 'folder' && l.isBackground !== true);
        const deleteIds = new Set([layerId]);

        if (targetLayer?.type === 'folder') {
            let changed = true;
            while (changed) {
                changed = false;
                asset.internalLayers.forEach(layer => {
                    if (layer.parentLayerId && deleteIds.has(layer.parentLayerId) && !deleteIds.has(layer.id)) {
                        deleteIds.add(layer.id);
                        changed = true;
                    }
                });
            }
        }

        const rigPartIds = getRigPartIdsForInternalLayers(asset.rigDefinition, deleteIds);
        if (rigPartIds.length > 0 && options.removeRigDependencies !== true) {
            return { ok: false, reason: 'rig-part-subtree-unsupported', rigPartIds };
        }
        const folderDeformerRefs = [];
        this.tracks.forEach(track => {
            (track.cels || []).forEach(clip => {
                if (clip.assetId !== asset.id) return;
                (normalizeClipFolderDeformers(clip.folderDeformers)?.targets || [])
                    .filter(target => deleteIds.has(target.folderLayerId))
                    .forEach(target => folderDeformerRefs.push({ clipId: clip.id, target }));
            });
        });
        if (folderDeformerRefs.length > 0) {
            return {
                ok: false,
                reason: 'folder-deformer-target-subtree-unsupported',
                references: folderDeformerRefs
            };
        }

        const deletingDrawableCount = asset.internalLayers.filter(layer => {
            return deleteIds.has(layer.id) && layer.type !== 'folder' && layer.isBackground !== true;
        }).length;
        if (targetLayer?.type !== 'folder' && drawableLayers.length - deletingDrawableCount <= 0) {
            return { ok: false, reason: 'last-layer' };
        }

        const index = asset.internalLayers.findIndex(l => l.id === layerId);
        if (index === -1) return { ok: false, reason: 'layer-not-found' };

        const removedMeshIds = new Set(getRasterMeshIdsForInternalLayers(asset.meshDefinitions, deleteIds));
        const getBindingBoneIds = binding => new Set((binding?.vertexWeights || [])
            .flatMap(weight => weight?.influences || [])
            .map(influence => influence?.boneId)
            .filter(Boolean));
        const removedSkinBoneIds = new Set((asset.skinBindings || [])
            .filter(binding => removedMeshIds.has(binding?.meshId))
            .flatMap(binding => [...getBindingBoneIds(binding)]));
        const remainingSkinBoneIds = new Set((asset.skinBindings || [])
            .filter(binding => !removedMeshIds.has(binding?.meshId))
            .flatMap(binding => [...getBindingBoneIds(binding)]));
        const rigidBoneIds = new Set((asset.rigDefinition?.rigidBindings || [])
            .map(binding => binding?.boneId)
            .filter(Boolean));
        const requestedMeshBoneIds = new Set([...removedSkinBoneIds].filter(boneId => (
            !remainingSkinBoneIds.has(boneId) && !rigidBoneIds.has(boneId)
        )));
        // 削除対象外Boneの祖先として残るMesh Boneは共有構造なので保持する。
        let narrowed = true;
        while (narrowed) {
            narrowed = false;
            (asset.rigDefinition?.bones || []).forEach(bone => {
                if (!bone?.parentBoneId
                    || requestedMeshBoneIds.has(bone.boneId)
                    || !requestedMeshBoneIds.has(bone.parentBoneId)) return;
                requestedMeshBoneIds.delete(bone.parentBoneId);
                narrowed = true;
            });
        }
        const rigidRemovalBoneIds = new Set((asset.rigDefinition?.rigidBindings || [])
            .filter(binding => rigPartIds.includes(binding?.partId))
            .map(binding => binding?.boneId)
            .filter(Boolean));
        const sharedRigidBoneIds = [...rigidRemovalBoneIds]
            .filter(boneId => remainingSkinBoneIds.has(boneId));
        if (sharedRigidBoneIds.length > 0) {
            return {
                ok: false,
                reason: 'rig-bone-used-by-remaining-skin',
                boneIds: sharedRigidBoneIds
            };
        }
        const rigRemoval = options.removeRigDependencies === true
            ? removeRigDefinitionTargets(asset.rigDefinition, {
                partIds: rigPartIds,
                boneIds: [...requestedMeshBoneIds]
            })
            : { ok: true, changed: false, value: asset.rigDefinition, partIds: [], boneIds: [] };
        if (!rigRemoval.ok) return rigRemoval;

        const removedLayers = asset.internalLayers.filter(layer => deleteIds.has(layer.id));
        asset.internalLayers = asset.internalLayers.filter(layer => !deleteIds.has(layer.id));
        const removedSkinning = removeRasterSkinningTargets(
            asset.meshDefinitions,
            asset.skinBindings,
            deleteIds
        );
        asset.meshDefinitions = removedSkinning.meshDefinitions;
        asset.skinBindings = removedSkinning.skinBindings;
        asset.rigDefinition = rigRemoval.value;
        if (rigRemoval.changed) {
            this.tracks.forEach(track => {
                (track.cels || []).forEach(clip => {
                    if (clip.assetId !== asset.id) return;
                    clip.rigMotion = removeRigMotionTargets(clip.rigMotion, {
                        partIds: rigRemoval.partIds,
                        boneIds: rigRemoval.boneIds
                    });
                });
            });
        }
        asset.internalLayers.forEach(layer => {
            if (layer.parentLayerId && deleteIds.has(layer.parentLayerId)) {
                layer.parentLayerId = null;
                layer.updatedAt = Date.now();
            }
        });
        const remainingDrawableLayers = asset.internalLayers.filter(layer => {
            return layer.type !== 'folder' && layer.isBackground !== true;
        });
        let fallbackLayer = null;
        if (remainingDrawableLayers.length === 0) {
            fallbackLayer = this.createClipAssetInternalLayer({
                name: 'レイヤー1',
                type: 'raster'
            });
            asset.internalLayers.push(fallbackLayer);
        }
        asset.updatedAt = Date.now();
        return {
            ok: true,
            asset,
            layer: removedLayers[0],
            removedLayers,
            fallbackLayer,
            removedRigPartIds: rigRemoval.partIds,
            removedRigBoneIds: rigRemoval.boneIds,
            removedMeshIds: removedSkinning.removedMeshIds
        };
    }

    duplicateClipAssetInternalLayer(assetId, layerId) {
        const asset = this.getClipAsset(assetId);
        if (!asset) return { ok: false, reason: 'asset-not-found' };

        const targetLayer = asset.internalLayers.find(layer => layer.id === layerId);
        if (!targetLayer) return { ok: false, reason: 'layer-not-found' };

        const sourceIds = new Set([layerId]);
        if (targetLayer.type === 'folder') {
            let changed = true;
            while (changed) {
                changed = false;
                asset.internalLayers.forEach(layer => {
                    if (layer.parentLayerId && sourceIds.has(layer.parentLayerId) && !sourceIds.has(layer.id)) {
                        sourceIds.add(layer.id);
                        changed = true;
                    }
                });
            }
        }

        const rigPartIds = getRigPartIdsForInternalLayers(asset.rigDefinition, sourceIds);
        if (rigPartIds.length > 0) {
            return { ok: false, reason: 'rig-part-subtree-unsupported', rigPartIds };
        }

        const sourceLayers = asset.internalLayers.filter(layer => sourceIds.has(layer.id));
        const idMap = new Map();
        const duplicatedLayers = sourceLayers.map(layer => {
            const nextSnapshotId = layer.drawingSnapshotId
                ? this._duplicateDrawingSnapshot(layer.drawingSnapshotId)
                : null;
            if (layer.drawingSnapshotId && nextSnapshotId) {
                idMap.set(layer.drawingSnapshotId, nextSnapshotId);
            }
            const duplicate = this.createClipAssetInternalLayer({
                name: `${layer.name} copy`,
                type: layer.type,
                visible: layer.visible !== false,
                opacity: layer.opacity ?? 1,
                blendMode: layer.blendMode || 'normal',
                clipping: layer.clipping === true,
                clippingMode: layer.clippingMode,
                drawingSnapshotId: nextSnapshotId,
                parentLayerId: layer.parentLayerId,
                isBackground: layer.isBackground === true
            });
            idMap.set(layer.id, duplicate.id);
            return duplicate;
        });

        duplicatedLayers.forEach(layer => {
            if (layer.parentLayerId && idMap.has(layer.parentLayerId)) {
                layer.parentLayerId = idMap.get(layer.parentLayerId);
            }
        });

        const insertIndex = Math.max(...sourceLayers.map(layer => asset.internalLayers.findIndex(item => item.id === layer.id))) + 1;
        asset.internalLayers.splice(insertIndex, 0, ...duplicatedLayers);
        const sourceMeshIds = new Set(getRasterMeshIdsForInternalLayers(asset.meshDefinitions, sourceIds));
        const sourceMeshes = Array.isArray(asset.meshDefinitions)
            ? asset.meshDefinitions.filter(mesh => sourceMeshIds.has(mesh?.meshId))
            : [];
        const sourceBindings = Array.isArray(asset.skinBindings)
            ? asset.skinBindings.filter(binding => sourceMeshIds.has(binding?.meshId))
            : [];
        const meshIdMap = new Map(idMap);
        sourceMeshes.forEach(mesh => {
            if (typeof mesh?.meshId === 'string' && mesh.meshId.length > 0) {
                meshIdMap.set(mesh.meshId, createId());
            }
            (mesh?.vertices || []).forEach(vertex => {
                if (typeof vertex?.vertexId === 'string' && vertex.vertexId.length > 0) {
                    meshIdMap.set(vertex.vertexId, createId());
                }
            });
        });
        if (sourceMeshes.length > 0) {
            const duplicatedMeshes = remapRasterMeshDefinitions(sourceMeshes, meshIdMap)
                .map(mesh => {
                    const layer = duplicatedLayers.find(candidate => candidate.id === mesh.targetInternalLayerId);
                    const snapshot = layer?.drawingSnapshotId
                        ? this.getDrawingSnapshot(layer.drawingSnapshotId)
                        : null;
                    return rebaseLineRibbonRasterMeshSource(
                        rebaseAutoShapeRasterMeshSource(
                            rebaseAlphaFitRasterMeshSource(mesh, snapshot),
                            snapshot
                        ),
                        snapshot
                    );
                });
            asset.meshDefinitions = [
                ...(Array.isArray(asset.meshDefinitions) ? asset.meshDefinitions : []),
                ...duplicatedMeshes
            ];
            asset.skinBindings = [
                ...(Array.isArray(asset.skinBindings) ? asset.skinBindings : []),
                ...(remapRasterSkinBindings(sourceBindings, meshIdMap) || [])
            ];
        }
        this.tracks.forEach(track => {
            (track.cels || []).forEach(clip => {
                if (clip.assetId !== asset.id || !clip.folderDeformers) return;
                const sourceTargets = normalizeClipFolderDeformers(clip.folderDeformers)?.targets
                    ?.filter(target => sourceIds.has(target.folderLayerId)) || [];
                if (sourceTargets.length === 0) return;
                const remapped = remapClipFolderDeformers(
                    { version: 1, targets: sourceTargets },
                    idMap
                );
                clip.folderDeformers = normalizeClipFolderDeformers({
                    version: 1,
                    targets: [
                        ...(normalizeClipFolderDeformers(clip.folderDeformers)?.targets || []),
                        ...(remapped?.targets || [])
                    ]
                });
            });
        });
        asset.updatedAt = Date.now();
        return {
            ok: true,
            asset,
            layer: duplicatedLayers[0],
            duplicatedLayers,
            internalLayerIdMap: idMap,
            meshIdMap
        };
    }

    _duplicateDrawingSnapshot(snapshotId) {
        const snapshot = this.getDrawingSnapshot(snapshotId);
        if (!snapshot) return null;

        const pixels = snapshot.pixels && typeof snapshot.pixels.length === 'number'
            ? new Uint8ClampedArray(snapshot.pixels)
            : snapshot.pixels;
        const duplicate = new DrawingSnapshotModel({
            width: snapshot.width,
            height: snapshot.height,
            rasterBounds: snapshot.rasterBounds,
            pixels,
            isBlank: snapshot.isBlank === true
        });
        this.drawingSnapshots.push(duplicate);
        return duplicate.id;
    }

    /**
     * アセットの内部レイヤー名を変更
     */
    renameClipAssetInternalLayer(assetId, layerId, name) {
        const asset = this.getClipAsset(assetId);
        if (!asset) return { ok: false, reason: 'asset-not-found' };

        const layer = asset.internalLayers.find(l => l.id === layerId);
        if (!layer) return { ok: false, reason: 'layer-not-found' };

        const trimmedName = typeof name === 'string' ? name.trim() : '';
        if (!trimmedName) return { ok: false, reason: 'invalid-name' };

        layer.name = trimmedName;
        layer.updatedAt = Date.now();
        return { ok: true, asset, layer };
    }

    /**
     * アセットの内部レイヤーの可視性を切り替え
     */
    toggleClipAssetInternalLayerVisibility(assetId, layerId) {
        const asset = this.getClipAsset(assetId);
        if (!asset) return { ok: false, reason: 'asset-not-found' };

        const layer = asset.internalLayers.find(l => l.id === layerId);
        if (!layer) return { ok: false, reason: 'layer-not-found' };

        layer.visible = layer.visible === false ? true : false;
        layer.updatedAt = Date.now();
        asset.updatedAt = Date.now();
        return { ok: true, asset, layer };
    }

    toggleClipAssetInternalLayerClipping(assetId, layerId) {
        const asset = this.getClipAsset(assetId);
        if (!asset) return { ok: false, reason: 'asset-not-found' };

        const layer = asset.internalLayers.find(l => l.id === layerId);
        if (!layer) return { ok: false, reason: 'layer-not-found' };

        applyClippingMode(layer, cycleClippingMode(layer.clippingMode, layer.clipping === true));
        layer.updatedAt = Date.now();
        asset.updatedAt = Date.now();
        return { ok: true, asset, layer };
    }

    /**
     * アセットの内部レイヤー順序を変更
     * direction: 'up' (添字を減らす = Inspector上で上へ) | 'down' (添字を増やす = 下へ)
     */
    moveClipAssetInternalLayer(assetId, layerId, direction) {
        const asset = this.getClipAsset(assetId);
        if (!asset) return { ok: false, reason: 'asset-not-found' };

        const layers = asset.internalLayers;
        const index = layers.findIndex(l => l.id === layerId);
        if (index === -1) return { ok: false, reason: 'layer-not-found' };

        const targetIndex = (direction === 'up') ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= layers.length) {
            return { ok: false, reason: 'out-of-range' };
        }

        // 要素の入れ替え
        const temp = layers[index];
        layers[index] = layers[targetIndex];
        layers[targetIndex] = temp;

        asset.updatedAt = Date.now();
        return { ok: true, asset, layer: layers[targetIndex], index: targetIndex };
    }

    /**
     * 指定FrameのClipAsset/CAF構造をタイムラインY軸順で解決する (Phase 4z14)
     */
    getFrameAssetTree(frameIndex = this.playback.currentFrame, options = {}) {
        const results = {
            frameIndex,
            groups: [],
            clips: [],
            missingAssets: []
        };

        const laneIdFilter = Array.isArray(options.laneIds) ? new Set(options.laneIds) : null;
        const groupMap = new Map(); // folderId -> group object

        // Uncategorizedグループの初期化 (必要になったら results.groups へ追加)
        const uncategorizedGroup = {
            folderId: null,
            folderName: 'Uncategorized',
            isUncategorized: true,
            laneIds: [],
            clips: []
        };

        // 1. Timeline Y軸順（this.tracksの順）に走査
        let visibleLaneIndex = 0;
        this.tracks.forEach(lane => {
            if (lane.type === 'folder' || lane.isBackground) return;
            if (lane.visible === false) return;
            const laneIndex = visibleLaneIndex++;
            if (laneIdFilter && !laneIdFilter.has(lane.id)) return;
            const clip = lane.getCelAtFrame(frameIndex);
            if (!clip) return;

            const laneInfo = {
                laneId: lane.id,
                laneName: this.getLaneDisplayName(lane, laneIndex),
                laneIndex: laneIndex
            };

            // アセット解決
            if (!clip.assetId) {
                results.missingAssets.push({
                    clipId: clip.id,
                    ...laneInfo,
                    reason: 'no-asset-id'
                });
                return;
            }

            const asset = this.getClipAsset(clip.assetId);
            if (!asset) {
                results.missingAssets.push({
                    clipId: clip.id,
                    ...laneInfo,
                    reason: 'asset-not-found'
                });
                return;
            }

            // スナップショット解決 (isBlank判定用)
            const snapshot = this.getDrawingSnapshot(asset.drawingSnapshotId);

            // Clip Entryの作成
            const clipEntry = {
                clipId: clip.id,
                ...laneInfo,
                assetId: asset.id,
                assetName: asset.name,
                folderId: asset.folderId,
                internalLayerCount: asset.internalLayers.length,
                visibleInternalLayerCount: asset.internalLayers.filter(l => l.visible !== false).length,
                isBlank: snapshot ? snapshot.isBlank === true : true,
                visible: clip.visible !== false,
                startFrame: clip.startFrame,
                duration: clip.duration,
                transform: normalizeClipTransform(clip.transform || {}),
                transformKeyframes: (clip.transformKeyframes || []).map(keyframe => clonePlainObject(keyframe)),
                deformer: normalizeClipDeformer(clip.deformer),
                ...(clip.folderDeformers == null
                    ? {}
                    : { folderDeformers: serializeClipFolderDeformers(clip.folderDeformers) }),
                ...(clip.rigMotion == null ? {} : { rigMotion: serializeRigMotion(clip.rigMotion) }),
                physics: clonePlainObject(clip.physics, {
                    enabled: false,
                    rigId: null,
                    cacheId: null
                })
            };

            // フラットリストへ追加
            results.clips.push(clipEntry);

            // グループ化
            let folder = null;
            if (asset.folderId) {
                folder = this.getClipAssetFolder(asset.folderId);
            }

            if (folder) {
                let group = groupMap.get(folder.id);
                if (!group) {
                    group = {
                        folderId: folder.id,
                        folderName: folder.name,
                        isUncategorized: false,
                        laneIds: [],
                        clips: []
                    };
                    groupMap.set(folder.id, group);
                    results.groups.push(group); // 最初に出現したY軸順で追加
                }
                if (!group.laneIds.includes(lane.id)) group.laneIds.push(lane.id);
                group.clips.push(clipEntry);
            } else {
                // Uncategorized
                if (!results.groups.includes(uncategorizedGroup)) {
                    results.groups.push(uncategorizedGroup); // 最初に出現したY軸順で追加
                }
                if (!uncategorizedGroup.laneIds.includes(lane.id)) uncategorizedGroup.laneIds.push(lane.id);
                uncategorizedGroup.clips.push(clipEntry);
            }
        });

        return results;
    }

    /**
     * 指定IDの描画スナップショットを取得
     */
    getDrawingSnapshot(snapshotId) {
        if (!snapshotId) return null;
        return this.drawingSnapshots.find(s => s.id === snapshotId) || null;
    }

    /**
     * ClipAsset / internal Layerから参照されない旧Raster世代を回収する。
     * Undo / Redoは各History stateが画素を所有して復元するため、Project正本には
     * 現在参照中のDrawingSnapshotだけを残す。
     */
    collectUnreferencedDrawingSnapshots() {
        const referencedIds = new Set();
        (this.clipAssets || []).forEach(asset => {
            if (asset?.drawingSnapshotId) referencedIds.add(asset.drawingSnapshotId);
            (asset?.internalLayers || []).forEach(layer => {
                if (layer?.drawingSnapshotId) referencedIds.add(layer.drawingSnapshotId);
            });
        });

        const beforeCount = this.drawingSnapshots?.length || 0;
        let removedPixelBytes = 0;
        this.drawingSnapshots = (this.drawingSnapshots || []).filter(snapshot => {
            if (referencedIds.has(snapshot?.id)) return true;
            removedPixelBytes += Number(snapshot?.pixels?.byteLength)
                || Number(snapshot?.pixels?.length)
                || 0;
            return false;
        });
        return {
            beforeCount,
            afterCount: this.drawingSnapshots.length,
            removedCount: beforeCount - this.drawingSnapshots.length,
            removedPixelBytes
        };
    }

    /**
     * 空のアセットとスナップショットを作成する
     */
    createBlankClipAsset(options = {}) {
        const width = options.width || 1;
        const height = options.height || 1;
        const pixelCount = width * height * 4;
        const pixels = new Uint8ClampedArray(pixelCount); // 初期値は 0 (透明)

        const snapshot = new DrawingSnapshotModel({
            width,
            height,
            pixels,
            isBlank: true
        });
        this.drawingSnapshots.push(snapshot);

        const asset = new ClipAssetModel({
            name: options.name || 'Blank Clip',
            type: 'raster',
            drawingSnapshotId: snapshot.id,
            folderId: options.folderId || null
        });

        // Phase 4z6: 初期内部レイヤーの追加
        asset.internalLayers = [
            this.createClipAssetInternalLayer({
                name: options.layerName || 'レイヤー1',
                type: 'raster',
                drawingSnapshotId: snapshot.id
            })
        ];

        this.clipAssets.push(asset);

        return { asset, snapshot };
    }

    /**
     * 指定されたアセットが複数のクリップで共有されているかカウントする
     */
    countAssetReferences(assetId) {
        if (!assetId) return 0;
        let count = 0;
        for (const lane of this.tracks) {
            count += lane.cels.filter(clip => clip.assetId === assetId).length;
        }
        return count;
    }

    isAssetShared(assetId) {
        return this.countAssetReferences(assetId) > 1;
    }

    validatePartRigs() {
        const assetResults = [];
        const clipResults = [];
        const definitionByAssetId = new Map();
        const errors = [];

        this.clipAssets.forEach(asset => {
            if (asset.rigDefinition == null) return;
            const result = validateRigDefinition(asset.rigDefinition, asset.internalLayers);
            definitionByAssetId.set(asset.id, result);
            assetResults.push({ assetId: asset.id, ...result });
            result.errors.forEach(error => errors.push({ scope: 'asset', assetId: asset.id, ...error }));
        });
        this.tracks.forEach(track => {
            (track.cels || []).forEach(clip => {
                if (clip.rigMotion == null) return;
                const asset = clip.assetId ? this.getClipAsset(clip.assetId) : null;
                const definitionResult = asset
                    ? (definitionByAssetId.get(asset.id)
                        || validateRigDefinition(asset.rigDefinition, asset.internalLayers))
                    : { value: null };
                const result = validateRigMotion(clip.rigMotion, definitionResult.value, clip.duration);
                clipResults.push({ clipId: clip.id, assetId: clip.assetId || null, ...result });
                result.errors.forEach(error => errors.push({
                    scope: 'clip',
                    clipId: clip.id,
                    assetId: clip.assetId || null,
                    ...error
                }));
            });
        });
        return { ok: errors.length === 0, assetResults, clipResults, errors };
    }

    validateRasterBoneSkins() {
        const assetResults = [];
        const errors = [];
        this.clipAssets.forEach(asset => {
            if (asset.meshDefinitions == null && asset.skinBindings == null) return;
            const result = validateRasterBoneSkinning(
                asset.meshDefinitions,
                asset.skinBindings,
                asset.internalLayers,
                asset.rigDefinition
            );
            assetResults.push({ assetId: asset.id, ...result });
            result.errors.forEach(error => errors.push({ scope: 'asset', assetId: asset.id, ...error }));
        });
        return { ok: errors.length === 0, assetResults, errors };
    }

    validateFolderDeformers() {
        const clipResults = [];
        const errors = [];
        this.tracks.forEach(track => {
            (track.cels || []).forEach(clip => {
                const sourceErrors = Array.isArray(clip._folderDeformerSourceErrors)
                    ? clip._folderDeformerSourceErrors
                    : [];
                if (clip.folderDeformers == null && sourceErrors.length === 0) return;
                const asset = clip.assetId ? this.getClipAsset(clip.assetId) : null;
                const validation = validateClipFolderDeformers(
                    clip.folderDeformers,
                    asset?.internalLayers || null
                );
                const resultErrors = [
                    ...sourceErrors,
                    ...validation.errors,
                    ...(!asset ? [{ code: 'folder-deformer-asset-missing' }] : [])
                ];
                const result = {
                    ok: resultErrors.length === 0,
                    value: validation.value,
                    errors: resultErrors
                };
                clipResults.push({
                    clipId: clip.id,
                    assetId: clip.assetId || null,
                    ...result
                });
                result.errors.forEach(error => errors.push({
                    scope: 'clip',
                    clipId: clip.id,
                    assetId: clip.assetId || null,
                    ...error
                }));
            });
        });
        return { ok: errors.length === 0, clipResults, errors };
    }

    duplicateClipAsset(assetId, options = {}) {
        const sourceAsset = this.getClipAsset(assetId);
        if (!sourceAsset) return { ok: false, reason: 'asset-not-found' };

        const primarySnapshotId = sourceAsset.drawingSnapshotId
            ? this._duplicateDrawingSnapshot(sourceAsset.drawingSnapshotId)
            : null;
        const duplicateAsset = new ClipAssetModel({
            name: options.name || `${sourceAsset.name} copy`,
            type: sourceAsset.type,
            folderId: options.folderId ?? sourceAsset.folderId,
            drawingSnapshotId: primarySnapshotId
        });

        const layerIdMap = new Map();
        duplicateAsset.internalLayers = sourceAsset.internalLayers.map(layer => {
            let snapshotId = null;
            if (layer.drawingSnapshotId) {
                snapshotId = layer.drawingSnapshotId === sourceAsset.drawingSnapshotId
                    ? primarySnapshotId
                    : this._duplicateDrawingSnapshot(layer.drawingSnapshotId);
            }
            const duplicateLayer = this.createClipAssetInternalLayer({
                name: layer.name,
                type: layer.type,
                visible: layer.visible !== false,
                opacity: layer.opacity ?? 1,
                blendMode: layer.blendMode || 'normal',
                clipping: layer.clipping === true,
                clippingMode: layer.clippingMode,
                drawingSnapshotId: snapshotId,
                parentLayerId: layer.parentLayerId,
                isBackground: layer.isBackground === true
            });
            layerIdMap.set(layer.id, duplicateLayer.id);
            return duplicateLayer;
        });

        duplicateAsset.internalLayers.forEach(layer => {
            if (layer.parentLayerId) {
                layer.parentLayerId = layerIdMap.get(layer.parentLayerId) || null;
            }
        });
        const rigIdMap = new Map(layerIdMap);
        sourceAsset.internalLayers.forEach((sourceLayer, index) => {
            const targetSnapshotId = duplicateAsset.internalLayers[index]?.drawingSnapshotId || null;
            if (sourceLayer?.drawingSnapshotId && targetSnapshotId) {
                rigIdMap.set(sourceLayer.drawingSnapshotId, targetSnapshotId);
            }
        });
        if (sourceAsset.drawingSnapshotId && primarySnapshotId) {
            rigIdMap.set(sourceAsset.drawingSnapshotId, primarySnapshotId);
        }
        if (Array.isArray(sourceAsset.rigDefinition?.bones)) {
            sourceAsset.rigDefinition.bones.forEach(bone => {
                if (typeof bone?.boneId === 'string' && bone.boneId.length > 0) {
                    rigIdMap.set(bone.boneId, createId());
                }
            });
        }
        duplicateAsset.rigDefinition = remapRigDefinition(sourceAsset.rigDefinition, rigIdMap);
        if (Array.isArray(sourceAsset.meshDefinitions)) {
            sourceAsset.meshDefinitions.forEach(mesh => {
                if (typeof mesh?.meshId === 'string' && mesh.meshId.length > 0) {
                    rigIdMap.set(mesh.meshId, createId());
                }
                (mesh?.vertices || []).forEach(vertex => {
                    if (typeof vertex?.vertexId === 'string' && vertex.vertexId.length > 0) {
                        rigIdMap.set(vertex.vertexId, createId());
                    }
                });
            });
        }
        duplicateAsset.meshDefinitions = remapRasterMeshDefinitions(sourceAsset.meshDefinitions, rigIdMap)
            ?.map(mesh => {
                const layer = duplicateAsset.internalLayers
                    .find(candidate => candidate.id === mesh.targetInternalLayerId);
                const snapshot = layer?.drawingSnapshotId
                    ? this.getDrawingSnapshot(layer.drawingSnapshotId)
                    : null;
                return rebaseLineRibbonRasterMeshSource(
                    rebaseAutoShapeRasterMeshSource(
                        rebaseAlphaFitRasterMeshSource(mesh, snapshot),
                        snapshot
                    ),
                    snapshot
                );
            });
        duplicateAsset.skinBindings = remapRasterSkinBindings(sourceAsset.skinBindings, rigIdMap);

        const now = Date.now();
        duplicateAsset.createdAt = now;
        duplicateAsset.updatedAt = now;
        this.clipAssets.push(duplicateAsset);
        return {
            ok: true,
            sourceAsset,
            asset: duplicateAsset,
            internalLayerIdMap: layerIdMap,
            rigIdMap
        };
    }

    /**
     * セルに対応するプレビュー用の内部レイヤー一覧を解決する
     */
    getPreviewInternalLayersForCel(cel) {
        if (!cel || !cel.assetId) return null;
        const asset = this.getClipAsset(cel.assetId);
        if (!asset) return null;

        // 内部レイヤーが空なら補完 (安全策)
        if (asset.internalLayers.length === 0) {
            this.ensureClipAssetInternalLayer(asset.id);
        }

        // Folderも階層正本の一部として返す。
        // rasterだけに絞ると parentLayerId の参照先が消え、Folder配下が
        // root previewへ到達できず、旧単一Snapshotへ誤ってfallbackする。
        const hasDrawableRaster = asset.internalLayers.some(layer => {
            return layer.type === 'raster' && this.getDrawingSnapshot(layer.drawingSnapshotId);
        });
        if (!hasDrawableRaster) return null;

        const layers = asset.internalLayers.filter(layer => {
            return layer.type === 'folder'
                || (layer.type === 'raster' && this.getDrawingSnapshot(layer.drawingSnapshotId));
        });

        return {
            ok: true,
            asset,
            layers // Inspector上の並び順（先頭が前面）
        };
    }

    /**
     * セルに対応する描画スナップショットを解決する
     */
    getSnapshotForCel(cel) {
        if (!cel) return null;

        if (cel.assetId) {
            const asset = this.getClipAsset(cel.assetId);
            if (asset && asset.drawingSnapshotId) {
                const snapshot = this.getDrawingSnapshot(asset.drawingSnapshotId);
                if (snapshot) return snapshot;
            }
        }

        return cel.rasterSnapshot || null;
    }

    /**
     * クリップの移動可否を判定
     */
    canMoveClip(clipId, targetLaneId, targetStartFrame) {
        const entry = this.findClipEntry(clipId);
        const targetLane = this.getLaneById(targetLaneId);
        if (!entry || !targetLane) return { ok: false, reason: 'not-found' };
        if (targetLane.type === 'folder') return { ok: false, reason: 'folder-lane' };
        
        if (targetStartFrame < 0 || targetStartFrame + entry.clip.duration > this.totalFrames) {
            return { ok: false, reason: 'out-of-range' };
        }
        
        const plan = this._planClipMoveWithPush(entry, targetLane, targetStartFrame);
        if (!plan.ok) return plan;
        
        return { ok: true, lane: targetLane, clip: entry.clip, sourceLane: entry.lane, plan };
    }

    /**
     * クリップを移動
     */
    moveClip(clipId, targetLaneId, targetStartFrame) {
        const check = this.canMoveClip(clipId, targetLaneId, targetStartFrame);
        if (!check.ok) return check;

        const { sourceLane, lane: targetLane, clip, plan } = check;
        
        if (sourceLane.id !== targetLane.id) {
            // レーンを跨ぐ移動
            sourceLane.cels = sourceLane.cels.filter(c => c.id !== clip.id);
            targetLane.cels.push(clip);
            
            // 移動先Laneが独立Laneなら、旧LayerSystem IDを持ち込まない。
            clip.sourceLayerId = targetLane.sourceLayerId || null;
            clip.layerId = targetLane.layerId || null;
        }

        if (plan?.adjustments) {
            plan.adjustments.forEach(({ clip: adjustedClip, startFrame }) => {
                adjustedClip.startFrame = startFrame;
            });
        }
        
        clip.startFrame = targetStartFrame;
        return { ok: true, lane: targetLane, clip };
    }

    /**
     * 複数クリップを相対配置のまま移動できるか、変更前に一括検証する。
     * 単体moveClipの押し出し契約とは分離し、複数移動では部分移動も押し出しもしない。
     */
    canMoveClips(moves = []) {
        if (!Array.isArray(moves) || moves.length < 2) {
            return { ok: false, reason: 'group-required' };
        }

        const clipIds = new Set();
        const placements = [];
        for (const move of moves) {
            const clipId = move?.clipId;
            const targetLaneId = move?.targetLaneId;
            const targetStartFrame = move?.targetStartFrame;
            if (!clipId || clipIds.has(clipId) || !Number.isInteger(targetStartFrame)) {
                return { ok: false, reason: 'invalid-move' };
            }

            const entry = this.findClipEntry(clipId);
            const targetLane = this.getLaneById(targetLaneId);
            if (!entry || !targetLane) return { ok: false, reason: 'not-found' };
            if (targetLane.type === 'folder' || targetLane.isBackground) {
                return { ok: false, reason: 'invalid-lane' };
            }

            const duration = Math.max(1, entry.clip.duration || 1);
            if (targetStartFrame < 0 || targetStartFrame + duration > this.totalFrames) {
                return { ok: false, reason: 'out-of-range' };
            }

            clipIds.add(clipId);
            placements.push({
                clip: entry.clip,
                sourceLane: entry.lane,
                targetLane,
                targetStartFrame,
                duration
            });
        }

        const rangesByLane = new Map();
        for (const lane of this.tracks) {
            const stationary = (lane.cels || [])
                .filter(clip => !clipIds.has(clip.id))
                .map(clip => ({
                    clipId: clip.id,
                    startFrame: clip.startFrame,
                    endFrame: clip.startFrame + Math.max(1, clip.duration || 1)
                }));
            rangesByLane.set(lane.id, stationary);
        }

        for (const placement of placements) {
            const ranges = rangesByLane.get(placement.targetLane.id) || [];
            const startFrame = placement.targetStartFrame;
            const endFrame = startFrame + placement.duration;
            const overlaps = ranges.some(range => startFrame < range.endFrame && endFrame > range.startFrame);
            if (overlaps) return { ok: false, reason: 'collision' };
            ranges.push({ clipId: placement.clip.id, startFrame, endFrame });
        }

        return { ok: true, placements };
    }

    /**
     * 新規クリップ群の配置を、モデル変更前に一括検証する。
     * copy/paste用。部分配置と暗黙の押し出しは行わない。
     */
    canPlaceClips(placements = []) {
        if (!Array.isArray(placements) || placements.length === 0) {
            return { ok: false, reason: 'placements-required' };
        }

        const checked = [];
        const rangesByLane = new Map();
        for (const lane of this.tracks) {
            rangesByLane.set(lane.id, (lane.cels || []).map(clip => ({
                startFrame: clip.startFrame,
                endFrame: clip.startFrame + Math.max(1, clip.duration || 1)
            })));
        }

        for (const placement of placements) {
            const targetLane = this.getLaneById(placement?.targetLaneId);
            const startFrame = placement?.targetStartFrame;
            const duration = Math.max(1, placement?.duration || 1);
            if (!targetLane) return { ok: false, reason: 'lane-not-found' };
            if (targetLane.type === 'folder' || targetLane.isBackground) {
                return { ok: false, reason: 'invalid-lane' };
            }
            if (!Number.isInteger(startFrame) || startFrame < 0 || startFrame + duration > this.totalFrames) {
                return { ok: false, reason: 'out-of-range' };
            }

            const ranges = rangesByLane.get(targetLane.id) || [];
            const endFrame = startFrame + duration;
            if (ranges.some(range => startFrame < range.endFrame && endFrame > range.startFrame)) {
                return { ok: false, reason: 'collision' };
            }
            ranges.push({ startFrame, endFrame });
            checked.push({ ...placement, targetLane, targetStartFrame: startFrame, duration });
        }

        return { ok: true, placements: checked };
    }

    /**
     * 検証済みの複数クリップを一括確定する。
     */
    moveClips(moves = []) {
        const check = this.canMoveClips(moves);
        if (!check.ok) return check;

        const movingIds = new Set(check.placements.map(item => item.clip.id));
        this.tracks.forEach(lane => {
            lane.cels = (lane.cels || []).filter(clip => !movingIds.has(clip.id));
        });

        check.placements.forEach(placement => {
            const { clip, targetLane, targetStartFrame } = placement;
            clip.startFrame = targetStartFrame;
            clip.sourceLayerId = targetLane.sourceLayerId || null;
            clip.layerId = targetLane.layerId || null;
            targetLane.cels.push(clip);
        });

        return { ok: true, placements: check.placements };
    }

    _planClipMoveWithPush(entry, targetLane, targetStartFrame) {
        const { clip, lane: sourceLane } = entry;
        const duration = Math.max(1, clip.duration || 1);
        const targetEnd = targetStartFrame + duration;
        const totalFrames = Math.max(1, this.totalFrames || 1);
        const others = (targetLane.cels || []).filter(item => item.id !== clip.id);
        const direction = targetLane.id === sourceLane.id
            ? Math.sign(targetStartFrame - clip.startFrame) || 1
            : 1;

        const createPlanState = () => {
            const adjustments = [];
            const plannedStarts = new Map();
            const getStart = (item) => plannedStarts.has(item.id) ? plannedStarts.get(item.id) : item.startFrame;
            const setStart = (item, startFrame) => {
                plannedStarts.set(item.id, startFrame);
                const existing = adjustments.find(entry => entry.clip.id === item.id);
                if (existing) {
                    existing.startFrame = startFrame;
                } else {
                    adjustments.push({ clip: item, startFrame });
                }
            };
            return { adjustments, getStart, setStart };
        };

        const tryPlanLeft = () => {
            const { adjustments, getStart, setStart } = createPlanState();
            let requiredStart = targetStartFrame;
            const previousCels = others
                .filter(item => item.startFrame < targetEnd)
                .sort((a, b) => b.startFrame - a.startFrame);

            for (const item of previousCels) {
                const itemStart = getStart(item);
                const itemEnd = itemStart + Math.max(1, item.duration || 1);
                if (itemEnd <= requiredStart) continue;
                const nextStart = requiredStart - Math.max(1, item.duration || 1);
                if (nextStart < 0) return null;
                setStart(item, nextStart);
                requiredStart = nextStart;
            }
            return { ok: true, adjustments };
        };

        const tryPlanRight = () => {
            const { adjustments, getStart, setStart } = createPlanState();
            let requiredEnd = targetEnd;
            const nextCels = others
                .filter(item => item.startFrame + Math.max(1, item.duration || 1) > targetStartFrame)
                .sort((a, b) => a.startFrame - b.startFrame);

            for (const item of nextCels) {
                const itemStart = getStart(item);
                const itemDuration = Math.max(1, item.duration || 1);
                if (itemStart >= requiredEnd) continue;
                setStart(item, requiredEnd);
                requiredEnd += itemDuration;
                if (requiredEnd > totalFrames) return null;
            }

            return { ok: true, adjustments };
        };

        const preferred = direction < 0 ? tryPlanLeft() : tryPlanRight();
        if (preferred) return preferred;

        const fallback = direction < 0 ? tryPlanRight() : tryPlanLeft();
        if (fallback) return fallback;

        return { ok: false, reason: 'push-out-of-range' };
    }

    /**
     * LayerSystem のレイヤー一覧とトラックを同期する
     */
    syncWithLayers(layers, activeIndex) {
        if (!layers) return;

        const reversedLayers = [...layers].reverse();
        const activeLayer = layers[activeIndex];
        const activeLayerId = activeLayer?.layerData?.id;
        const existingBySourceLayerId = new Map();
        const retainedUnlinkedLanes = [];

        this.tracks.forEach((lane, index) => {
            lane.orderIndex = Number.isInteger(lane.orderIndex) ? lane.orderIndex : index;
            if (lane.sourceLayerId || lane.layerId) {
                existingBySourceLayerId.set(lane.sourceLayerId || lane.layerId, lane);
            } else {
                retainedUnlinkedLanes.push(lane);
            }
        });

        const allowInitialLayerImport = !this.layerSyncInitialized && this.tracks.length === 0;
        const syncActiveFromLayerSystem = allowInitialLayerImport;
        const importableRasterLayers = reversedLayers.filter(layer => {
            const layerData = layer?.layerData;
            return !!(
                layerData &&
                !layerData.isFolder &&
                !layerData.isBackground &&
                !layerData.isAnimationWorkingLayer
            );
        });
        const initialLaneSourceLayer = importableRasterLayers.find(layer => layer.layerData?.id === activeLayerId)
            || importableRasterLayers[0]
            || null;
        const initialLaneSourceLayerId = initialLaneSourceLayer?.layerData?.id || null;
        const newTracks = reversedLayers.map(layer => {
            const layerData = layer.layerData;
            if (!layerData) return null;
            if (layerData.isFolder) return null;
            if (layerData.isBackground) return null;
            if (layerData.isAnimationWorkingLayer) return null;
            if (allowInitialLayerImport && layerData.id !== initialLaneSourceLayerId) return null;

            // 既存のレーンがあれば再利用
            const existingLane = existingBySourceLayerId.get(layerData.id);
            
            if (existingLane) {
                const previousSourceName = existingLane.sourceName;
                if (
                    existingLane.kind === 'layer-linked'
                    && existingLane.displayName
                    && existingLane.displayName === previousSourceName
                    && /^レイヤー\d+$/.test(existingLane.displayName)
                ) {
                    existingLane.displayName = null;
                }
                existingLane.sourceName = layerData.name;
                existingLane.type = layerData.isFolder ? 'folder' : 'raster';
                if (syncActiveFromLayerSystem) {
                    existingLane.active = (layerData.id === activeLayerId);
                }
                existingLane.kind = existingLane.kind || 'layer-linked';
                existingLane.sourceMissing = false;
                existingLane.isBackground = false;
                return existingLane;
            } else {
                if (!allowInitialLayerImport) return null;
                // 新規作成 (LaneModel)
                return new LaneModel({
                    sourceLayerId: layerData.id,
                    layerId: layerData.id,
                    name: 'Lane 1',
                    sourceName: layerData.name,
                    kind: 'layer-linked',
                    type: 'raster',
                    active: true,
                    isBackground: false
                });
            }
        }).filter(Boolean);

        const liveSourceIds = new Set(importableRasterLayers.map(layer => layer.layerData?.id).filter(Boolean));
        const missingSourceLanes = this.tracks.filter(lane => {
            const sourceLayerId = lane.sourceLayerId || lane.layerId;
            if (!sourceLayerId || liveSourceIds.has(sourceLayerId)) return false;
            return lane.cels.length > 0 || lane.kind === 'independent';
        }).map(lane => {
            lane.sourceMissing = true;
            lane.active = false;
            return lane;
        });

        this.tracks = [...newTracks, ...missingSourceLanes, ...retainedUnlinkedLanes];
        this.tracks.forEach((lane, index) => {
            lane.orderIndex = index;
        });
        this.layerSyncInitialized = true;
    }

    /**
     * 現在フレームを設定
     */
    setCurrentFrame(frameIndex) {
        const nextFrame = Math.round(Number(frameIndex));
        if (Number.isFinite(nextFrame) && nextFrame >= 0 && nextFrame < this.totalFrames) {
            this.playback.currentFrame = nextFrame;
        }
    }

    /**
     * 現在の再生設定 (playbackScope 等) を考慮して実質的な再生範囲 (start, end) を決定する
     * @param {Object} options { playbackScope: 'all' | 'activeLane' | 'includedLanes', activeLaneId: string|null, includedLaneIds: Set<string> }
     * @returns {{start: number, end: number}}
     */
    getPlaybackRange(options = {}) {
        let start = 0;
        if (this.playback.inFrame !== null && this.playback.inFrame >= 0) {
            start = Math.min(this.playback.inFrame, this.totalFrames - 1);
        }

        let end = this.totalFrames - 1;
        const endMode = this.playback.endMode || 'timeline';

        if (endMode === 'last-clip') {
            // 現在のscopeに含まれるLaneの中から最後に存在するCAFの終了フレームを取得
            let maxFrame = -1;
            const scope = options.playbackScope || 'all';
            const activeLaneId = options.activeLaneId || null;
            const includedLaneIds = options.includedLaneIds || new Set();

            this.tracks.forEach(track => {
                if (track.isBackground || track.type === 'folder' || track.visible === false) return;

                // フィルタの適用
                if (scope === 'activeLane' && track.id !== activeLaneId) return;
                if (scope === 'includedLanes' && !includedLaneIds.has(track.id)) return;

                track.cels.forEach(cel => {
                    const celEnd = cel.startFrame + cel.duration - 1;
                    if (celEnd > maxFrame) {
                        maxFrame = celEnd;
                    }
                });
            });

            if (maxFrame >= 0) {
                end = Math.min(maxFrame, this.totalFrames - 1);
            }
        } else if (endMode === 'out-marker') {
            if (this.playback.outFrame !== null && this.playback.outFrame >= 0) {
                end = Math.min(this.playback.outFrame, this.totalFrames - 1);
            }
        }

        // 開始位置が終了位置より後の場合は有効終端へ揃え、範囲外再生を避ける。
        if (start > end) {
            start = end;
        }

        return { start, end };
    }

    /**
     * マーカー位置や再生フレームの整合性を維持するためのクランプ処理
     */
    clampPlaybackSettings() {
        const allowedEndModes = new Set(['timeline', 'last-clip', 'out-marker']);
        if (!allowedEndModes.has(this.playback.endMode)) {
            this.playback.endMode = 'timeline';
        }

        this.playback.loop = this.playback.loop !== false;

        this.totalFrames = Math.max(1, Math.round(Number(this.totalFrames) || 1));

        const normalizeFrameOrNull = (value) => {
            if (value === null || value === undefined) return null;
            const frame = Math.round(Number(value));
            if (!Number.isFinite(frame)) return null;
            return Math.max(0, Math.min(this.totalFrames - 1, frame));
        };

        this.playback.currentFrame = Math.max(0, Math.min(
            this.totalFrames - 1,
            Math.round(Number(this.playback.currentFrame) || 0)
        ));
        this.playback.inFrame = normalizeFrameOrNull(this.playback.inFrame);
        this.playback.outFrame = normalizeFrameOrNull(this.playback.outFrame);

        // 反転している場合はOUTをINへ揃える。解除は明示操作で行う。
        if (this.playback.inFrame !== null && this.playback.outFrame !== null && this.playback.inFrame > this.playback.outFrame) {
            this.playback.outFrame = this.playback.inFrame;
        }

    }

    /**
     * フレームを一コマ進める（再生範囲とループ設定を考慮）
     * @param {Object} options { playbackScope: 'all'|'activeLane'|'includedLanes', activeLaneId: string|null, includedLaneIds: Set<string> }
     */
    advanceFrame(options = {}) {
        const { start, end } = this.getPlaybackRange(options);

        // 再生中のフレームが現在の有効範囲外であれば、まず開始フレームに移動する
        if (this.playback.currentFrame < start || this.playback.currentFrame > end) {
            this.playback.currentFrame = start;
            return true;
        }

        let nextFrame = this.playback.currentFrame + 1;
        if (nextFrame > end) {
            if (this.playback.loop) {
                nextFrame = start;
            } else {
                return false;
            }
        }
        this.playback.currentFrame = nextFrame;
        return true;
    }

    serialize() {
        return {
            fps: this.fps,
            totalFrames: this.totalFrames,
            tracks: this.tracks.map(track => track.serialize()),
            clipAssetFolders: this.clipAssetFolders.map(folder => folder.serialize()),
            clipGroups: this.clipGroups.map(group => group.serialize()),
            clipAssets: this.clipAssets.map(asset => asset.serialize()),
            drawingSnapshots: this.drawingSnapshots.map(snap => snap.serialize()),
            playback: { ...this.playback }
        };
    }
}

// グローバル登録 (下位互換維持 + 新名称追加)
window.CelModel = CelModel;
window.ClipInstanceModel = ClipInstanceModel;
window.TrackModel = TrackModel;
window.LaneModel = LaneModel;
window.TimelineModel = TimelineModel;
window.DrawingSnapshotModel = DrawingSnapshotModel;
window.ClipAssetModel = ClipAssetModel;
window.ClipAssetFolderModel = ClipAssetFolderModel;
window.ClipGroupModel = ClipGroupModel;
window.ClipAssetInternalLayerModel = ClipAssetInternalLayerModel;
