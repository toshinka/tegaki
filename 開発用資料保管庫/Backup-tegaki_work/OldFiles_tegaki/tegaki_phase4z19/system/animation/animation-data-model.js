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
                name: options.name || 'Layer 1',
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
            name: options.name || `Layer ${nextNum}`,
            type: options.type || 'raster',
            drawingSnapshotId: options.drawingSnapshotId || null
        });

        asset.internalLayers.push(layer);
        asset.updatedAt = Date.now();
        return { ok: true, asset, layer };
    }

    /**
     * アセットの内部レイヤーを削除
     */
    removeClipAssetInternalLayer(assetId, layerId) {
        const asset = this.getClipAsset(assetId);
        if (!asset) return { ok: false, reason: 'asset-not-found' };

        if (asset.internalLayers.length <= 1) {
            return { ok: false, reason: 'last-layer' };
        }

        const index = asset.internalLayers.findIndex(l => l.id === layerId);
        if (index === -1) return { ok: false, reason: 'layer-not-found' };

        const removedLayer = asset.internalLayers.splice(index, 1)[0];
        asset.updatedAt = Date.now();
        return { ok: true, asset, layer: removedLayer };
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
        this.tracks.forEach((lane, laneIndex) => {
            const clip = lane.getCelAtFrame(frameIndex);
            if (!clip) return;

            const laneInfo = {
                laneId: lane.id,
                laneName: lane.name,
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
                startFrame: clip.startFrame,
                duration: clip.duration
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
                name: options.layerName || 'Layer 1',
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
        this.ensureClipAssetInternalLayer(originalAsset.id, {
            name: 'Layer 1',
            drawingSnapshotId: originalAsset.drawingSnapshotId
        });

        // 1. スナップショットの複製
        const newSnapshot = new DrawingSnapshotModel({
            width: originalSnapshot.width,
            height: originalSnapshot.height,
            isBlank: originalSnapshot.isBlank, // Phase 4z: Blank状態を継承
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
            folderId: originalAsset.folderId, // Phase 4z3: フォルダを継承
            drawingSnapshotId: newSnapshot.id
        });

        // Phase 4z6: 内部レイヤーのディープコピー
        newAsset.internalLayers = originalAsset.internalLayers.map(layer => {
            return this.createClipAssetInternalLayer({
                ...layer.serialize(),
                id: createId(), // 新規ID
                drawingSnapshotId: newSnapshot.id, // 複製後Snapshotへ
                createdAt: Date.now(),
                updatedAt: Date.now()
            });
        });

        // 整合性補完（既存データで internalLayers が空だった場合など）
        if (newAsset.internalLayers.length === 0) {
            newAsset.internalLayers = [
                this.createClipAssetInternalLayer({
                    name: 'Layer 1',
                    type: 'raster',
                    drawingSnapshotId: newSnapshot.id
                })
            ];
        }

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
