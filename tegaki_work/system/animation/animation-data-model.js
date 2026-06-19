/**
 * ============================================================================
 * ファイル名: system/animation/animation-data-model.js
 * 責務: 新アニメーションテーブル（ToonSquid風）の純粋データ構造を定義する
 * 依存: なし
 * 被依存: animation-system.js, animation-table-popup.js
 * ============================================================================
 */

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
        this.width = options.width || 0;
        this.height = options.height || 0;
        this.pixels = options.pixels || null; // Uint8ClampedArray or Array
        this.isBlank = options.isBlank === true;
        this.createdAt = options.createdAt || Date.now();
        this.updatedAt = options.updatedAt || Date.now();
    }

    serialize() {
        return {
            id: this.id,
            width: this.width,
            height: this.height,
            pixels: this.pixels && typeof this.pixels.length === 'number' ? Array.from(this.pixels) : this.pixels,
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
        this.clipping = options.clipping === true;
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
        this.physics = clonePlainObject(options.physics, {
            enabled: false,
            rigId: null,
            cacheId: null
        });
        
        // 暫定互換用：直接 Snapshot 保持
        this.rasterSnapshot = options.rasterSnapshot || null; 
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
            physics: clonePlainObject(this.physics, {
                enabled: false,
                rigId: null,
                cacheId: null
            }),
            rasterSnapshot: this.rasterSnapshot
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
        this.fps = options.fps || 12;
        this.totalFrames = options.totalFrames || 24;
        
        // 内部リスト名はまだ tracks を維持
        this.tracks = (options.tracks || []).map(track => new LaneModel(track));
        this.layerSyncInitialized = this.tracks.length > 0;
        
        this.clipAssetFolders = (options.clipAssetFolders || []).map(folder => new ClipAssetFolderModel(folder));
        this.clipAssets = (options.clipAssets || []).map(asset => new ClipAssetModel(asset));
        this.drawingSnapshots = (options.drawingSnapshots || []).map(snap => new DrawingSnapshotModel(snap));
        this.playback = {
            currentFrame: options.playback?.currentFrame || 0,
            loop: options.playback?.loop !== false
        };
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
        const backgroundIndex = this.tracks.findIndex(t => t.isBackground);
        if (backgroundIndex >= 0) {
            this.tracks.splice(backgroundIndex, 0, lane);
        } else {
            this.tracks.push(lane);
        }
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
            blendMode: 'normal',
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
    removeClipAssetInternalLayer(assetId, layerId) {
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

        const deletingDrawableCount = asset.internalLayers.filter(layer => {
            return deleteIds.has(layer.id) && layer.type !== 'folder' && layer.isBackground !== true;
        }).length;
        if (targetLayer?.type !== 'folder' && drawableLayers.length - deletingDrawableCount <= 0) {
            return { ok: false, reason: 'last-layer' };
        }

        const index = asset.internalLayers.findIndex(l => l.id === layerId);
        if (index === -1) return { ok: false, reason: 'layer-not-found' };

        const removedLayers = asset.internalLayers.filter(layer => deleteIds.has(layer.id));
        asset.internalLayers = asset.internalLayers.filter(layer => !deleteIds.has(layer.id));
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
        return { ok: true, asset, layer: removedLayers[0], removedLayers, fallbackLayer };
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

        const sourceLayers = asset.internalLayers.filter(layer => sourceIds.has(layer.id));
        const idMap = new Map();
        const duplicatedLayers = sourceLayers.map(layer => {
            const nextSnapshotId = layer.drawingSnapshotId
                ? this._duplicateDrawingSnapshot(layer.drawingSnapshotId)
                : null;
            const duplicate = this.createClipAssetInternalLayer({
                name: `${layer.name} copy`,
                type: layer.type,
                visible: layer.visible !== false,
                opacity: layer.opacity ?? 1,
                blendMode: layer.blendMode || 'normal',
                clipping: layer.clipping === true,
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
        asset.updatedAt = Date.now();
        return { ok: true, asset, layer: duplicatedLayers[0], duplicatedLayers };
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
        return { ok: true, asset, layer };
    }

    toggleClipAssetInternalLayerClipping(assetId, layerId) {
        const asset = this.getClipAsset(assetId);
        if (!asset) return { ok: false, reason: 'asset-not-found' };

        const layer = asset.internalLayers.find(l => l.id === layerId);
        if (!layer) return { ok: false, reason: 'layer-not-found' };

        layer.clipping = layer.clipping !== true;
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

        const now = Date.now();
        duplicateAsset.createdAt = now;
        duplicateAsset.updatedAt = now;
        this.clipAssets.push(duplicateAsset);
        return { ok: true, sourceAsset, asset: duplicateAsset };
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

        // Preview対象レイヤーの抽出 (raster かつ実Snapshotあり)
        const layers = asset.internalLayers.filter(l => {
            return l.type === 'raster' && this.getDrawingSnapshot(l.drawingSnapshotId);
        });

        if (layers.length === 0) return null;

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
        if (frameIndex >= 0 && frameIndex < this.totalFrames) {
            this.playback.currentFrame = frameIndex;
        }
    }

    /**
     * フレームを一コマ進める
     */
    advanceFrame() {
        let nextFrame = this.playback.currentFrame + 1;
        if (nextFrame >= this.totalFrames) {
            if (this.playback.loop) {
                nextFrame = 0;
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
window.ClipAssetInternalLayerModel = ClipAssetInternalLayerModel;
