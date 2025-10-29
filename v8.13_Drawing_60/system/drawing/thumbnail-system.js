// ===== system/drawing/thumbnail-system.js - キャッシュキー修正版 =====
// 修正1: レイヤーサムネイルのキャッシュキーを layer.transform から取得
// 修正2: Vキーモード中のキャッシュ無効化オプション追加

(function() {
    'use strict';

    class ThumbnailSystem {
        constructor(app, coordinateSystem, config) {
            this.app = app;
            this.coordinateSystem = coordinateSystem;
            this.config = config || window.TEGAKI_CONFIG;
            
            // キャッシュ管理
            this.layerThumbnailCache = new Map();
            this.frameThumbnailCache = new Map();
            this.dataURLCache = new Map();
            
            // 設定
            this.defaultLayerThumbSize = 64;
            this.defaultFrameThumbSize = 150;
            this.maxCacheSize = 200;
            this.disableCacheDuringVMode = true; // Vキーモード中はキャッシュ無効
            
            this.eventBus = null;
            this.isInitialized = false;
            this.vKeyModeActive = false; // Vキーモード状態
            
            // RenderTexture の再利用プール
            this.renderTexturePool = [];
            this.poolMaxSize = 10;
        }

        init(eventBus) {
            if (this.isInitialized) return;
            
            this.eventBus = eventBus || window.TegakiEventBus;
            
            if (this.eventBus) {
                this._setupEventListeners();
            }
            
            this.isInitialized = true;
            console.log('✅ ThumbnailSystem initialized');
        }

        _setupEventListeners() {
            // Vキーモード検知
            this.eventBus.on('keyboard:vkey-pressed', () => {
                this.vKeyModeActive = true;
            });
            
            this.eventBus.on('keyboard:vkey-released', () => {
                this.vKeyModeActive = false;
            });
            
            // レイヤーサムネイル更新トリガー
            this.eventBus.on('layer:transform-updated', ({ layerId }) => {
                this._invalidateLayerCacheByLayerId(layerId);
            });
            
            this.eventBus.on('layer:stroke-added', ({ layerIndex }) => {
                this.invalidateLayerCache(layerIndex);
            });
            
            this.eventBus.on('layer:path-added', ({ layerIndex }) => {
                this.invalidateLayerCache(layerIndex);
            });
            
            this.eventBus.on('layer:flip-horizontal', ({ layerId }) => {
                this._invalidateLayerCacheByLayerId(layerId);
            });
            
            this.eventBus.on('layer:flip-vertical', ({ layerId }) => {
                this._invalidateLayerCacheByLayerId(layerId);
            });
            
            // フレームサムネイル更新トリガー
            this.eventBus.on('animation:frame-updated', ({ frameIndex }) => {
                this.invalidateFrameCache(frameIndex);
            });
            
            // リサイズ時は全キャッシュクリア
            this.eventBus.on('camera:resized', ({ width, height }) => {
                this.clearAllCache();
            });
            
            // 全サムネイル再生成トリガー（ズーム等）
            this.eventBus.on('camera:transform-changed', () => {
                this.clearAllCache();
            });
        }

        /**
         * レイヤーサムネイル生成
         * 修正: キャッシュキーを layer.position/rotation/scale から生成
         * 
         * @param {PIXI.Container} layer - レイヤーコンテナ
         * @param {number} width - サムネイル幅（デフォルト64）
         * @param {number} height - サムネイル高さ（デフォルト64）
         * @returns {Promise<HTMLCanvasElement|null>}
         */
        async generateLayerThumbnail(layer, width = this.defaultLayerThumbSize, height = this.defaultLayerThumbSize) {
            if (!layer || !this.app?.renderer) {
                return null;
            }

            // 背景レイヤーは特別扱い
            if (layer.layerData?.isBackground) {
                return null; // UI側で背景色パッチを表示
            }

            // Vキーモード中でキャッシュ無効化が有効な場合、キャッシュをスキップ
            if (this.disableCacheDuringVMode && this.vKeyModeActive) {
                return await this._renderLayerThumbnail(layer, width, height);
            }

            // 修正: キャッシュキーを layer.position/rotation/scale から生成
            const layerId = layer.layerData?.id || layer.label;
            const pos = layer.position;
            const rot = layer.rotation;
            const scale = layer.scale;
            const transform = `${pos.x.toFixed(2)}_${pos.y.toFixed(2)}_${rot.toFixed(4)}_${scale.x.toFixed(3)}_${scale.y.toFixed(3)}`;
            const cacheKey = `layer_${layerId}_${width}_${height}_${transform}`;
            
            if (this.layerThumbnailCache.has(cacheKey)) {
                return this.layerThumbnailCache.get(cacheKey);
            }

            const canvas = await this._renderLayerThumbnail(layer, width, height);
            
            if (canvas) {
                // キャッシュに保存
                this.layerThumbnailCache.set(cacheKey, canvas);
                
                // キャッシュサイズ制限
                if (this.layerThumbnailCache.size > this.maxCacheSize) {
                    const firstKey = this.layerThumbnailCache.keys().next().value;
                    this.layerThumbnailCache.delete(firstKey);
                }
            }

            return canvas;
        }

        /**
         * 内部: レイヤーサムネイルレンダリング実行
         * 
         * @param {PIXI.Container} layer
         * @param {number} width
         * @param {number} height
         * @returns {Promise<HTMLCanvasElement|null>}
         */
        async _renderLayerThumbnail(layer, width, height) {
            try {
                // RenderTexture を取得（プール再利用）
                const rt = this._acquireRenderTexture(width, height);
                if (!rt) return null;

                // レイヤーをレンダリング
                this.app.renderer.render({
                    container: layer,
                    target: rt,
                    clear: true
                });

                // GPU → Canvas（DPI/色空間完全同期）
                const canvas = this.app.renderer.extract.canvas(rt);

                // RenderTexture をプールに戻す
                this._releaseRenderTexture(rt);

                return canvas;

            } catch (error) {
                console.error('Layer thumbnail generation failed:', error);
                return null;
            }
        }

        /**
         * フレームサムネイル生成
         * 修正: キャッシュキーを config.canvas から取得
         * 
         * @param {PIXI.Container} frame - フレームコンテナ
         * @param {number} maxWidth - 最大幅（デフォルト150）
         * @param {number} maxHeight - 最大高さ（デフォルト150）
         * @returns {Promise<HTMLCanvasElement|null>}
         */
        async generateFrameThumbnail(frame, maxWidth = this.defaultFrameThumbSize, maxHeight = this.defaultFrameThumbSize) {
            if (!frame || !this.app?.renderer) {
                return null;
            }

            const frameId = frame.id || frame.label;
            
            // 修正: config.canvas から取得
            const canvasWidth = this.config?.canvas?.width || 800;
            const canvasHeight = this.config?.canvas?.height || 600;

            // アスペクト比を保持してリサイズ
            const aspectRatio = canvasWidth / canvasHeight;
            let thumbWidth, thumbHeight;
            
            if (aspectRatio > 1) {
                thumbWidth = maxWidth;
                thumbHeight = maxWidth / aspectRatio;
            } else {
                thumbHeight = maxHeight;
                thumbWidth = maxHeight * aspectRatio;
            }

            thumbWidth = Math.round(thumbWidth);
            thumbHeight = Math.round(thumbHeight);

            // 修正: キャッシュキーを config.canvas から生成
            const cacheKey = `frame_${frameId}_${canvasWidth}_${canvasHeight}_${thumbWidth}_${thumbHeight}`;
            
            if (this.frameThumbnailCache.has(cacheKey)) {
                return this.frameThumbnailCache.get(cacheKey);
            }

            try {
                // フルサイズで一度レンダリング
                const fullRT = this._acquireRenderTexture(canvasWidth, canvasHeight);
                if (!fullRT) return null;

                this.app.renderer.render({
                    container: frame,
                    target: fullRT,
                    clear: true
                });

                // Canvas を取得してリサイズ
                const fullCanvas = this.app.renderer.extract.canvas(fullRT);
                
                // サムネイルサイズにリサイズ
                const thumbCanvas = document.createElement('canvas');
                thumbCanvas.width = thumbWidth;
                thumbCanvas.height = thumbHeight;
                const ctx = thumbCanvas.getContext('2d');
                
                if (ctx) {
                    ctx.imageSmoothingEnabled = true;
                    ctx.imageSmoothingQuality = 'high';
                    ctx.drawImage(fullCanvas, 0, 0, thumbWidth, thumbHeight);
                }

                // キャッシュに保存
                this.frameThumbnailCache.set(cacheKey, thumbCanvas);
                
                // キャッシュサイズ制限
                if (this.frameThumbnailCache.size > this.maxCacheSize) {
                    const firstKey = this.frameThumbnailCache.keys().next().value;
                    this.frameThumbnailCache.delete(firstKey);
                }
                
                // RenderTexture をプール戻す
                this._releaseRenderTexture(fullRT);

                return thumbCanvas;

            } catch (error) {
                console.error('Frame thumbnail generation failed:', error);
                return null;
            }
        }

        /**
         * Canvas → DataURL 変換
         * 
         * @param {HTMLCanvasElement} canvas
         * @returns {string} DataURL
         */
        canvasToDataURL(canvas) {
            if (!canvas) return null;
            
            try {
                return canvas.toDataURL('image/png');
            } catch (error) {
                console.error('Canvas to DataURL conversion failed:', error);
                return null;
            }
        }

        /**
         * 指定レイヤーのキャッシュをクリア
         * 
         * @param {number} layerIndex
         */
        invalidateLayerCache(layerIndex) {
            if (layerIndex < 0) return;
            
            // 該当レイヤーのキャッシュをクリア
            const keysToDelete = [];
            for (const key of this.layerThumbnailCache.keys()) {
                if (key.includes(`layer_`)) {
                    keysToDelete.push(key);
                }
            }
            
            keysToDelete.forEach(key => {
                this.layerThumbnailCache.delete(key);
            });
        }

        /**
         * LayerId でレイヤーキャッシュをクリア
         * 
         * @param {string} layerId
         */
        _invalidateLayerCacheByLayerId(layerId) {
            const keysToDelete = [];
            for (const key of this.layerThumbnailCache.keys()) {
                if (key.includes(`layer_${layerId}_`)) {
                    keysToDelete.push(key);
                }
            }
            
            keysToDelete.forEach(key => {
                this.layerThumbnailCache.delete(key);
            });
        }

        /**
         * 指定フレームのキャッシュをクリア
         * 
         * @param {number} frameIndex
         */
        invalidateFrameCache(frameIndex) {
            if (frameIndex < 0) return;
            
            const keysToDelete = [];
            for (const key of this.frameThumbnailCache.keys()) {
                if (key.startsWith(`frame_`)) {
                    keysToDelete.push(key);
                }
            }
            
            keysToDelete.forEach(key => {
                this.frameThumbnailCache.delete(key);
            });
        }

        /**
         * 全キャッシュをクリア
         */
        clearAllCache() {
            this.layerThumbnailCache.clear();
            this.frameThumbnailCache.clear();
            this.dataURLCache.clear();
        }

        /**
         * RenderTexture の取得（プール再利用）
         */
        _acquireRenderTexture(width, height) {
            try {
                // プールから既存の RenderTexture を探す
                for (let i = this.renderTexturePool.length - 1; i >= 0; i--) {
                    const rt = this.renderTexturePool[i];
                    if (rt.width === width && rt.height === height) {
                        this.renderTexturePool.splice(i, 1);
                        return rt;
                    }
                }

                // 新規作成
                return PIXI.RenderTexture.create({
                    width: width,
                    height: height,
                    resolution: window.devicePixelRatio || 1
                });

            } catch (error) {
                console.error('RenderTexture acquire failed:', error);
                return null;
            }
        }

        /**
         * RenderTexture をプールに戻す
         */
        _releaseRenderTexture(rt) {
            if (!rt) return;

            try {
                if (this.renderTexturePool.length < this.poolMaxSize) {
                    this.renderTexturePool.push(rt);
                } else {
                    rt.destroy(true);
                }

            } catch (error) {
                rt.destroy(true);
            }
        }

        /**
         * デバッグ情報取得
         */
        getDebugInfo() {
            return {
                layerCacheSize: this.layerThumbnailCache.size,
                frameCacheSize: this.frameThumbnailCache.size,
                dataURLCacheSize: this.dataURLCache.size,
                poolSize: this.renderTexturePool.length,
                isInitialized: this.isInitialized,
                vKeyModeActive: this.vKeyModeActive,
                disableCacheDuringVMode: this.disableCacheDuringVMode
            };
        }

        /**
         * システム破棄時のクリーンアップ
         */
        destroy() {
            this.clearAllCache();
            
            this.renderTexturePool.forEach(rt => {
                try {
                    rt.destroy(true);
                } catch (e) {}
            });
            
            this.renderTexturePool = [];
            this.isInitialized = false;
        }
    }

    // グローバル登録
    window.ThumbnailSystem = new ThumbnailSystem(
        null, // app は core-runtime から設定
        window.CoordinateSystem,
        window.TEGAKI_CONFIG
    );

    console.log('✅ system/drawing/thumbnail-system.js (キャッシュキー修正版) loaded');

})();