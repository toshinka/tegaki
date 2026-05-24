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
 * クリップ本体（アセット）
 * 将来、内部レイヤー構造・内部タイムライン・物理演算を持つ。
 */
export class ClipAssetModel {
    constructor(options = {}) {
        this.id = options.id || createId();
        this.name = options.name || 'New Asset';
        this.type = options.type || 'raster'; // 'raster' | 'vector' | 'group'
        this.drawingSnapshotId = options.drawingSnapshotId || null; // 参照
        this.internalLayers = options.internalLayers || []; // 将来用
        this.createdAt = options.createdAt || Date.now();
        this.updatedAt = options.updatedAt || Date.now();
    }

    serialize() {
        return {
            id: this.id,
            name: this.name,
            type: this.type,
            drawingSnapshotId: this.drawingSnapshotId,
            internalLayers: this.internalLayers,
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
        
        // 暫定：実レイヤーとの紐付け
        this.sourceLayerId = options.sourceLayerId || options.layerId || null;
        this.layerId = this.sourceLayerId; // backward compatibility
        
        this.name = options.name || 'Lane';
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
                sourceLayerId: this.sourceLayerId,
                layerId: this.layerId,
                startFrame: frameIndex,
                duration: 1
            });
        }
    }

    serialize() {
        return {
            id: this.id,
            sourceLayerId: this.sourceLayerId,
            layerId: this.layerId, // 互換維持
            name: this.name,
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

    /**
     * 指定IDのクリップアセットを取得
     */
    getClipAsset(assetId) {
        if (!assetId) return null;
        return this.clipAssets.find(a => a.id === assetId) || null;
    }

    /**
     * 指定IDの描画スナップショットを取得
     */
    getDrawingSnapshot(snapshotId) {
        if (!snapshotId) return null;
        return this.drawingSnapshots.find(s => s.id === snapshotId) || null;
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

    /**
     * クリップを独立化（Make Unique）する
     * 参照しているアセットを複製し、自分だけの新しいアセットを参照するようにする。
     */
    makeClipAssetUnique(clipId) {
        const entry = this.findClipEntry(clipId);
        if (!entry) return { ok: false, reason: 'not-found' };

        const clip = entry.clip;
        if (!clip.assetId) return { ok: false, reason: 'no-asset' };

        const originalAsset = this.getClipAsset(clip.assetId);
        if (!originalAsset) return { ok: false, reason: 'asset-not-found' };

        const originalSnapshot = this.getSnapshotForCel(clip);
        if (!originalSnapshot) return { ok: false, reason: 'snapshot-not-found' };

        // 1. スナップショットの複製
        const newSnapshot = new DrawingSnapshotModel({
            width: originalSnapshot.width,
            height: originalSnapshot.height,
            // pixels は Uint8ClampedArray または Array なので slice でコピー
            pixels: originalSnapshot.pixels ? (
                originalSnapshot.pixels instanceof Uint8ClampedArray 
                ? new Uint8ClampedArray(originalSnapshot.pixels) 
                : [...originalSnapshot.pixels]
            ) : null,
            createdAt: Date.now(),
            updatedAt: Date.now()
        });

        // 2. アセットの複製
        const newAsset = new ClipAssetModel({
            name: `${originalAsset.name} copy`,
            type: originalAsset.type,
            drawingSnapshotId: newSnapshot.id,
            // internalLayers は将来用だが一応浅いコピー
            internalLayers: originalAsset.internalLayers ? [...originalAsset.internalLayers] : []
        });

        // 3. モデルへ追加
        this.drawingSnapshots.push(newSnapshot);
        this.clipAssets.push(newAsset);

        // 4. クリップの参照を更新
        clip.assetId = newAsset.id;
        
        // 互換フィールドの更新
        const rasterPixels = newSnapshot.pixels ? (
            newSnapshot.pixels instanceof Uint8ClampedArray
            ? new Uint8ClampedArray(newSnapshot.pixels)
            : [...newSnapshot.pixels]
        ) : null;
        clip.rasterSnapshot = {
            width: newSnapshot.width,
            height: newSnapshot.height,
            pixels: rasterPixels
        };

        return { ok: true, clip, asset: newAsset, snapshot: newSnapshot };
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
        
        // 重なりチェック（自身を除外）
        if (!targetLane.canPlaceCel(targetStartFrame, entry.clip.duration, entry.clip.id)) {
            return { ok: false, reason: 'overlap' };
        }
        
        return { ok: true, lane: targetLane, clip: entry.clip, sourceLane: entry.lane };
    }

    /**
     * クリップを移動
     */
    moveClip(clipId, targetLaneId, targetStartFrame) {
        const check = this.canMoveClip(clipId, targetLaneId, targetStartFrame);
        if (!check.ok) return check;

        const { sourceLane, lane: targetLane, clip } = check;
        
        if (sourceLane.id !== targetLane.id) {
            // レーンを跨ぐ移動
            sourceLane.cels = sourceLane.cels.filter(c => c.id !== clip.id);
            targetLane.cels.push(clip);
            
            // 移動先レーンの実レイヤーIDを継承
            clip.sourceLayerId = targetLane.sourceLayerId;
            clip.layerId = targetLane.layerId;
        }
        
        clip.startFrame = targetStartFrame;
        return { ok: true, lane: targetLane, clip };
    }

    /**
     * LayerSystem のレイヤー一覧とトラックを同期する
     */
    syncWithLayers(layers, activeIndex) {
        if (!layers) return;

        const reversedLayers = [...layers].reverse();
        const activeLayer = layers[activeIndex];
        const activeLayerId = activeLayer?.layerData?.id;

        const newTracks = reversedLayers.map(layer => {
            const layerData = layer.layerData;
            if (!layerData) return null;

            // 既存のレーンがあれば再利用
            const existingLane = this.getLaneForSourceLayer(layerData.id);
            
            if (existingLane) {
                existingLane.name = layerData.name;
                existingLane.type = layerData.isFolder ? 'folder' : 'raster';
                existingLane.active = (layerData.id === activeLayerId);
                return existingLane;
            } else {
                // 新規作成 (LaneModel)
                return new LaneModel({
                    sourceLayerId: layerData.id,
                    layerId: layerData.id,
                    name: layerData.name,
                    type: layerData.isFolder ? 'folder' : 'raster',
                    active: (layerData.id === activeLayerId)
                });
            }
        }).filter(Boolean);

        this.tracks = newTracks;
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
