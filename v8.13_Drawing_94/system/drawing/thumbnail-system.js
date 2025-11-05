// system/drawing/thumbnail-system.js - 完全統合版（二重実装撲滅）

(function() {
    'use strict';

    class ThumbnailSystem {
        constructor(app, coordinateSystem, config) {
            this.app = app;
            this.coordinateSystem = coordinateSystem;
            this.config = config || window.TEGAKI_CONFIG;
            
            this.layerThumbnailCache = new Map();
            this.frameThumbnailCache = new Map();
            
            this.defaultLayerThumbWidth = 74;
            this.defaultLayerThumbHeight = 40;
            this.defaultFrameThumbSize = 150;
            this.maxCacheSize = 200;
            this.disableCacheDuringVMode = true;
            
            this.eventBus = null;
            this.isInitialized = false;
            this.vKeyModeActive = false;
            
            this.renderTexturePool = [];
            this.poolMaxSize = 10;
            
            this.thumbnailUpdateTimer = null;
        }

        init(eventBus) {
            if (this.isInitialized) return;
            
            this.eventBus = eventBus || window.TegakiEventBus;
            
            if (this.eventBus) {
                this._setupEventListeners();
            }
            
            this.isInitialized = true;
        }

        _setupEventListeners() {
            this.eventBus.on('keyboard:vkey-pressed', () => {
                this.vKeyModeActive = true;
            });
            
            this.eventBus.on('keyboard:vkey-released', () => {
                this.vKeyModeActive = false;
            });
            
            this.eventBus.on('layer:transform-updated', ({ layerId }) => {
                this._invalidateLayerCacheByLayerId(layerId);
                
                if (this.thumbnailUpdateTimer) {
                    clearTimeout(this.thumbnailUpdateTimer);
                }
                
                this.thumbnailUpdateTimer = setTimeout(() => {
                    const layerMgr = window.CoreRuntime?.internal?.layerManager;
                    if (layerMgr) {
                        const layers = layerMgr.getLayers();
                        const layerIndex = layers.findIndex(l => l.layerData?.id === layerId);
                        
                        if (layerIndex >= 0) {
                            this.eventBus.emit('thumbnail:layer-updated', {
                                component: 'thumbnail-system',
                                action: 'transform-invalidated',
                                data: {
                                    layerIndex: layerIndex,
                                    layerId: layerId
                                }
                            });
                        }
                    }
                    this.thumbnailUpdateTimer = null;
                }, 100);
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
            
            this.eventBus.on('animation:frame-updated', ({ frameIndex }) => {
                this.invalidateFrameCache(frameIndex);
            });
            
            this.eventBus.on('camera:resized', ({ width, height }) => {
                this.clearAllCache();
            });
            
            this.eventBus.on('camera:transform-changed', () => {
                this.clearAllCache();
            });
        }

        /**
         * レイヤーサムネイル生成（後方互換シグネチャ対応）
         * 新形式: generateLayerThumbnail(layer, layerIndex, maxWidth, maxHeight)
         * 旧形式: generateLayerThumbnail(layer, layerIndex)
         * 
         * @param {PIXI.Container} layer - レイヤーコンテナ
         * @param {number} layerIndex - レイヤーインデックス（後方互換用、使用しない）
         * @param {number} maxWidth - 最大幅（デフォルト74）
         * @param {number} maxHeight - 最大高さ（デフォルト40）
         * @returns {Promise<{canvas: HTMLCanvasElement, dataUrl: string}|null>}
         */
        async generateLayerThumbnail(layer, layerIndex = 0, maxWidth = null, maxHeight = null) {
            if (!layer || !this.app?.renderer) {
                return null;
            }

            // 後方互換: 引数が2つの場合は旧形式
            const actualMaxWidth = (typeof maxWidth === 'number') ? maxWidth : this.defaultLayerThumbWidth;
            const actualMaxHeight = (typeof maxHeight === 'number') ? maxHeight : this.defaultLayerThumbHeight;

            // 背景レイヤーは特別扱い（UI側で処理）
            if (layer.layerData?.isBackground) {
                return null;
            }

            // Vキーモード中はキャッシュをスキップ
            if (this.disableCacheDuringVMode && this.vKeyModeActive) {
                return await this._renderLayerThumbnail(layer, actualMaxWidth, actualMaxHeight);
            }

            // キャッシュキー生成
            const layerId = layer.layerData?.id || layer.label;
            const pos = layer.position;
            const rot = layer.rotation;
            const scale = layer.scale;
            const transform = `${pos.x.toFixed(2)}_${pos.y.toFixed(2)}_${rot.toFixed(4)}_${scale.x.toFixed(3)}_${scale.y.toFixed(3)}`;
            const cacheKey = `layer_${layerId}_${actualMaxWidth}_${actualMaxHeight}_${transform}`;
            
            if (this.layerThumbnailCache.has(cacheKey)) {
                return this.layerThumbnailCache.get(cacheKey);
            }

            const result = await this._renderLayerThumbnail(layer, actualMaxWidth, actualMaxHeight);
            
            if (result) {
                this.layerThumbnailCache.set(cacheKey, result);
                
                if (this.layerThumbnailCache.size > this.maxCacheSize) {
                    const firstKey = this.layerThumbnailCache.keys().next().value;
                    this.layerThumbnailCache.delete(firstKey);
                }
            }

            return result;
        }

        /**
         * 内部: レイヤーサムネイルレンダリング実行
         * アスペクト比を保持してリサイズ
         * 
         * @param {PIXI.Container} layer
         * @param {number} maxWidth
         * @param {number} maxHeight
         * @returns {Promise<{canvas: HTMLCanvasElement, dataUrl: string}|null>}
         */
        async _renderLayerThumbnail(layer, maxWidth, maxHeight) {
            try {
                // キャンバスサイズ取得
                const canvasWidth = this.config?.canvas?.width || 800;
                const canvasHeight = this.config?.canvas?.height || 600;
                const aspectRatio = canvasWidth / canvasHeight;

                // アスペクト比を保持してサムネイルサイズを計算
                let thumbWidth, thumbHeight;
                if (aspectRatio >= maxWidth / maxHeight) {
                    thumbWidth = maxWidth;
                    thumbHeight = Math.round(maxWidth / aspectRatio);
                } else {
                    thumbHeight = maxHeight;
                    thumbWidth = Math.round(maxHeight * aspectRatio);
                }

                // レイヤーの状態を保存
                const originalState = {
                    pos: { x: layer.position.x, y: layer.position.y },
                    scale: { x: layer.scale.x, y: layer.scale.y },
                    rotation: layer.rotation,
                    pivot: { x: layer.pivot.x, y: layer.pivot.y }
                };

                // レイヤーをニュートラル状態に設定
                layer.position.set(0, 0);
                layer.scale.set(1, 1);
                layer.rotation = 0;
                layer.pivot.set(0, 0);

                // フルサイズでレンダリング
                const rt = this._acquireRenderTexture(canvasWidth, canvasHeight);
                if (!rt) {
                    // 状態を復元
                    layer.position.set(originalState.pos.x, originalState.pos.y);
                    layer.scale.set(originalState.scale.x, originalState.scale.y);
                    layer.rotation = originalState.rotation;
                    layer.pivot.set(originalState.pivot.x, originalState.pivot.y);
                    return null;
                }

                this.app.renderer.render({
                    container: layer,
                    target: rt,
                    clear: true
                });

                // GPU → Canvas
                const fullCanvas = this.app.renderer.extract.canvas(rt);

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

                // レイヤーの状態を復元
                layer.position.set(originalState.pos.x, originalState.pos.y);
                layer.scale.set(originalState.scale.x, originalState.scale.y);
                layer.rotation = originalState.rotation;
                layer.pivot.set(originalState.pivot.x, originalState.pivot.y);

                // RenderTexture をプールに戻す
                this._releaseRenderTexture(rt);

                // DataURL 生成
                const dataUrl = thumbCanvas.toDataURL('image/png');

                return {
                    canvas: thumbCanvas,
                    dataUrl: dataUrl
                };

            } catch (error) {
                return null;
            }
        }

        /**
         * フレームサムネイル生成
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
            
            const canvasWidth = this.config?.canvas?.width || 800;
            const canvasHeight = this.config?.canvas?.height || 600;

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

            const cacheKey = `frame_${frameId}_${canvasWidth}_${canvasHeight}_${thumbWidth}_${thumbHeight}`;
            
            if (this.frameThumbnailCache.has(cacheKey)) {
                return this.frameThumbnailCache.get(cacheKey);
            }

            try {
                const fullRT = this._acquireRenderTexture(canvasWidth, canvasHeight);
                if (!fullRT) return null;

                this.app.renderer.render({
                    container: frame,
                    target: fullRT,
                    clear: true
                });

                const fullCanvas = this.app.renderer.extract.canvas(fullRT);
                
                const thumbCanvas = document.createElement('canvas');
                thumbCanvas.width = thumbWidth;
                thumbCanvas.height = thumbHeight;
                const ctx = thumbCanvas.getContext('2d');
                
                if (ctx) {
                    ctx.imageSmoothingEnabled = true;
                    ctx.imageSmoothingQuality = 'high';
                    ctx.drawImage(fullCanvas, 0, 0, thumbWidth, thumbHeight);
                }

                this.frameThumbnailCache.set(cacheKey, thumbCanvas);
                
                if (this.frameThumbnailCache.size > this.maxCacheSize) {
                    const firstKey = this.frameThumbnailCache.keys().next().value;
                    this.frameThumbnailCache.delete(firstKey);
                }
                
                this._releaseRenderTexture(fullRT);

                return thumbCanvas;

            } catch (error) {
                return null;
            }
        }

        invalidateLayerCache(layerIndex) {
            if (layerIndex < 0) return;
            
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

        clearAllCache() {
            this.layerThumbnailCache.clear();
            this.frameThumbnailCache.clear();
        }

        _acquireRenderTexture(width, height) {
            try {
                for (let i = this.renderTexturePool.length - 1; i >= 0; i--) {
                    const rt = this.renderTexturePool[i];
                    if (rt.width === width && rt.height === height) {
                        this.renderTexturePool.splice(i, 1);
                        return rt;
                    }
                }

                return PIXI.RenderTexture.create({
                    width: width,
                    height: height,
                    resolution: window.devicePixelRatio || 1
                });

            } catch (error) {
                return null;
            }
        }

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

        getDebugInfo() {
            return {
                layerCacheSize: this.layerThumbnailCache.size,
                frameCacheSize: this.frameThumbnailCache.size,
                poolSize: this.renderTexturePool.length,
                isInitialized: this.isInitialized,
                vKeyModeActive: this.vKeyModeActive,
                disableCacheDuringVMode: this.disableCacheDuringVMode
            };
        }

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

    window.ThumbnailSystem = new ThumbnailSystem(
        null,
        window.CoordinateSystem,
        window.TEGAKI_CONFIG
    );

})();