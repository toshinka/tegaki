/**
 * ============================================================================
 * ファイル名: system/animation/animation-data-model.js
 * 責務: 新アニメーションテーブル（ToonSquid風）の純粋データ構造を定義する
 * 依存: なし
 * 被依存: animation-system.js, animation-table-popup.js
 * ============================================================================
 */

/**
 * セル（クリップ）：トラック上の特定の時間に配置される描画の塊
 */
export class CelModel {
    constructor(options = {}) {
        this.id = options.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2));
        this.layerId = options.layerId || null; // LayerSystem の実レイヤーID
        this.startFrame = options.startFrame || 0;
        this.duration = options.duration || 1;
        this.isKeyframe = options.isKeyframe !== false;
    }

    serialize() {
        return {
            id: this.id,
            layerId: this.layerId,
            startFrame: this.startFrame,
            duration: this.duration,
            isKeyframe: this.isKeyframe
        };
    }
}

/**
 * トラック：レイヤーに対応する時間軸の行
 */
export class TrackModel {
    constructor(options = {}) {
        this.id = options.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2));
        this.layerId = options.layerId || null; // 対応する LayerSystem のレイヤーID
        this.name = options.name || 'Track';
        this.type = options.type || 'raster'; // 'raster' | 'folder'
        this.cels = (options.cels || []).map(cel => new CelModel(cel));
        this.active = options.active === true;
    }

    /**
     * 指定フレームにセルがあるか取得
     * @param {number} frameIndex 
     * @returns {CelModel|null}
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
        const cel = new CelModel(options);
        this.cels.push(cel);
        return cel;
    }

    /**
     * 指定された範囲にセルを配置可能かチェック
     * @param {number} startFrame 
     * @param {number} duration 
     * @param {string} ignoreCelId 
     * @returns {boolean}
     */
    canPlaceCel(startFrame, duration, ignoreCelId = null) {
        const endFrame = startFrame + duration;
        return !this.cels.some(cel => {
            if (ignoreCelId && cel.id === ignoreCelId) return false;
            const celEnd = cel.startFrame + cel.duration;
            // 範囲の重なりチェック
            return startFrame < celEnd && endFrame > cel.startFrame;
        });
    }

    /**
     * セルの長さを変更
     * @param {string} celId 
     * @param {number} newDuration 
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
     * @param {number} frameIndex 
     */
    removeCelAtFrame(frameIndex) {
        this.cels = this.cels.filter(cel => cel.startFrame !== frameIndex);
    }

    /**
     * 指定フレームのセルの有無を反転（MVP用）
     * @param {number} frameIndex 
     */
    toggleCelAtFrame(frameIndex) {
        const existing = this.getCelAtFrame(frameIndex);
        if (existing) {
            this.removeCelAtFrame(frameIndex);
        } else {
            this.addCel({
                layerId: this.layerId,
                startFrame: frameIndex,
                duration: 1
            });
        }
    }

    serialize() {
        return {
            id: this.id,
            layerId: this.layerId,
            name: this.name,
            type: this.type,
            active: this.active,
            cels: this.cels.map(cel => cel.serialize())
        };
    }
}

/**
 * タイムライン：全体構造
 */
export class TimelineModel {
    constructor(options = {}) {
        this.fps = options.fps || 12;
        this.totalFrames = options.totalFrames || 24; // MVP: 24フレーム
        this.tracks = (options.tracks || []).map(track => new TrackModel(track));
        this.playback = {
            currentFrame: options.playback?.currentFrame || 0,
            loop: options.playback?.loop !== false
        };
    }

    /**
     * LayerSystem のレイヤー一覧とトラックを同期する
     * @param {Array} layers LayerSystem.getLayers() の戻り値
     * @param {number} activeIndex 現在のアクティブレイヤーインデックス
     */
    syncWithLayers(layers, activeIndex) {
        if (!layers) return;

        // レイヤーパネルと同じく、上（インデックス大）から下へ表示するため reverse
        const reversedLayers = [...layers].reverse();
        const activeLayer = layers[activeIndex];
        const activeLayerId = activeLayer?.layerData?.id;

        const newTracks = reversedLayers.map(layer => {
            const layerData = layer.layerData;
            if (!layerData) return null;

            // 既存のトラックがあれば再利用
            const existingTrack = this.tracks.find(t => t.layerId === layerData.id);
            
            if (existingTrack) {
                existingTrack.name = layerData.name;
                existingTrack.type = layerData.isFolder ? 'folder' : 'raster';
                existingTrack.active = (layerData.id === activeLayerId);
                return existingTrack;
            } else {
                // 新規作成
                return new TrackModel({
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
     * @param {number} frameIndex 
     */
    setCurrentFrame(frameIndex) {
        if (frameIndex >= 0 && frameIndex < this.totalFrames) {
            this.playback.currentFrame = frameIndex;
        }
    }

    /**
     * フレームを一コマ進める
     * @returns {boolean} 進行した場合は true, 停止した場合は false
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
            playback: { ...this.playback }
        };
    }
}

// 下位互換性のためにグローバルに登録
window.CelModel = CelModel;
window.TrackModel = TrackModel;
window.TimelineModel = TimelineModel;
