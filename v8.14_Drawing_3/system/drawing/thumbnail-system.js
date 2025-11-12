/**
 * @file thumbnail-system.js - 統一アスペクト比対応版
 * @description レイヤー・フレームのサムネイル生成システム
 * 
 * 【依存関係】
 * ◆ 親ファイル (このファイルが依存):
 *   - config.js (キャンバスサイズ取得)
 *   - PIXI.js v8.13 (RenderTexture, Extract)
 *   - event-bus.js (イベント通信)
 *   - coordinate-system.js (座標系)
 * 
 * ◆ 子ファイル (このファイルに依存):
 *   - layer-panel-renderer.js (サムネイル表示)
 *   - timeline-ui.js (フレームサムネイル表示)
 * 
 * 【設計方針 - v1.1改修】
 * - 全レイヤー(背景含む)でキャンバスアスペクト比を維持
 * - サムネイル最大サイズ: 64x44 (どちらか一辺が最大値)
 * - 背景レイヤーは単色塗りつぶしCanvas生成
 * - 通常レイヤーはPIXI RenderTextureでレンダリング
 * - キャッシュ機構で重複生成を抑制
 */

(function() {
    'use strict';

    class ThumbnailSystem {
        constructor(app, coordinateSystem, config) {
            this.app = app;
            this.coordinateSystem = coordinateSystem;
            this.config = config || window.TEGAKI_CONFIG;
            
            this.layerThumbnailCache = new Map();
            this.frameThumbnailCache = new Map();
            
            this.defaultLayerThumbWidth = 64;
            this.defaultLayerThumbHeight = 44;
            this.defaultFrameThumbSize = 150;
            this.maxCacheSize = 200;
            
            this.eventBus = null;
            this.isInitialized = false;
            this.vKeyModeActive = false;
            
            this.renderTexturePool = [];
            this.poolMaxSize = 10;
            
            this.updateThrottle = 16;
            this.layerUpdateTimer = null;
            this.timelineUpdateTimer = null;
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
            
            this.eventBus.on('layer:updated', ({ layerId }) => {
                if (!this.vKeyModeActive) return;
                
                this._invalidateLayerCacheByLayerId(layerId);
                
                if (this.layerUpdateTimer) {
                    clearTimeout(this.layerUpdateTimer);
                }
                
                this.layerUpdateTimer = setTimeout(() => {
                    const layerMgr = window.CoreRuntime?.internal?.layerManager;
                    if (layerMgr) {
                        const layers = layerMgr.getLayers();
                        const layerIndex = layers.findIndex(l => l.layerData?.id === layerId);
                        
                        if (layerIndex >= 0) {
                            this.eventBus.emit('thumbnail:layer-updated', {
                                component: 'thumbnail-system',
                                action: 'v-mode-transform',
                                data: { layerIndex, layerId }
                            });
                        }
                    }
                    this.layerUpdateTimer = null;
                }, this.updateThrottle);
                
                if (this.timelineUpdateTimer) {
                    clearTimeout(this.timelineUpdateTimer);
                }
                
                this.timelineUpdateTimer = setTimeout(() => {
                    this.eventBus.emit('thumbnail:regenerate-all');
                    this.timelineUpdateTimer = null;
                }, this.updateThrottle);
            });
            
            this.eventBus.on('layer:transform-updated', ({ layerId }) => {
                this._invalidateLayerCacheByLayerId(layerId);
                
                const layerMgr = window.CoreRuntime?.internal?.layerManager;
                if (layerMgr) {
                    const layers = layerMgr.getLayers();
                    const layerIndex = layers.findIndex(l => l.layerData?.id === layerId);
                    
                    if (layerIndex >= 0) {
                        this.eventBus.emit('thumbnail:layer-updated', {
                            component: 'thumbnail-system',
                            action: 'transform-confirmed',
                            data: { layerIndex, layerId }
                        });
                    }
                }
                
                this.eventBus.emit('thumbnail:regenerate-all');
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
         * キャンバスアスペクト比を維持したサムネイルサイズを計算
         * @param {number} maxWidth - サムネイル最大幅
         * @param {number} maxHeight - サムネイル最大高さ
         * @returns {{width: number, height: number}} サムネイルサイズ
         */
        _calculateThumbnailSize(maxWidth, maxHeight) {
            const canvasWidth = this.config?.canvas?.width || 800;
            const canvasHeight = this.config?.canvas?.height || 600;
            
            // 🔧 修正: 正しいアスペクト比計算
            let thumbWidth, thumbHeight;
            const canvasAspect = canvasWidth / canvasHeight;
            const thumbAspect = maxWidth / maxHeight;
            
            if (canvasAspect > thumbAspect) {
                // 横長: 幅を最大にして高さを調整
                thumbWidth = maxWidth;
                thumbHeight = Math.round(maxWidth / canvasAspect);
            } else {
                // 縦長: 高さを最大にして幅を調整
                thumbHeight = maxHeight;
                thumbWidth = Math.round(maxHeight * canvasAspect);
            }
            
            // 念のため最大値チェック
            thumbWidth = Math.min(thumbWidth, maxWidth);
            thumbHeight = Math.min(thumbHeight, maxHeight);

            return { width: thumbWidth, height: thumbHeight };
        }

        /**
         * レイヤーサムネイル生成 (背景・通常レイヤー統一対応)
         */
        async generateLayerThumbnail(layer, layerIndex = 0, maxWidth = null, maxHeight = null) {
            if (!layer) {
                return null;
            }

            const actualMaxWidth = (typeof maxWidth === 'number') ? maxWidth : this.defaultLayerThumbWidth;
            const actualMaxHeight = (typeof maxHeight === 'number') ? maxHeight : this.defaultLayerThumbHeight;

            // 🔧 背景レイヤー: 単色塗りつぶしCanvas生成
            if (layer.layerData?.isBackground) {
                return this._generateBackgroundThumbnail(layer, actualMaxWidth, actualMaxHeight);
            }

            // 通常レイヤー: PIXIレンダリング
            if (this.vKeyModeActive) {
                return await this._renderLayerThumbnail(layer, actualMaxWidth, actualMaxHeight);
            }

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
         * 背景レイヤー専用サムネイル生成
         * キャンバスアスペクト比を維持した単色塗りつぶし
         */
        _generateBackgroundThumbnail(layer, maxWidth, maxHeight) {
            const { width: thumbWidth, height: thumbHeight } = this._calculateThumbnailSize(maxWidth, maxHeight);

            const canvas = document.createElement('canvas');
            canvas.width = thumbWidth;
            canvas.height = thumbHeight;
            
            const ctx = canvas.getContext('2d');
            if (!ctx) return null;

            // 🔧 layerData.backgroundColor から取得
            const bgColor = layer.layerData?.backgroundColor || 0xf0e0d6;
            const r = (bgColor >> 16) & 0xFF;
            const g = (bgColor >> 8) & 0xFF;
            const b = bgColor & 0xFF;
            
            ctx.fillStyle = `rgb(${r},${g},${b})`;
            ctx.fillRect(0, 0, thumbWidth, thumbHeight);

            const dataUrl = canvas.toDataURL('image/png');

            return {
                canvas: canvas,
                dataUrl: dataUrl,
                width: thumbWidth,
                height: thumbHeight
            };
        }

        /**
         * 通常レイヤーのサムネイルレンダリング
         * キャンバスアスペクト比を維持してスケーリング
         */
        async _renderLayerThumbnail(layer, maxWidth, maxHeight) {
            if (!this.app?.renderer) return null;

            try {
                const { width: thumbWidth, height: thumbHeight } = this._calculateThumbnailSize(maxWidth, maxHeight);

                const canvasWidth = this.config?.canvas?.width || 800;
                const canvasHeight = this.config?.canvas?.height || 600;

                const rt = this._acquireRenderTexture(canvasWidth, canvasHeight);
                if (!rt) return null;

                this.app.renderer.render({
                    container: layer,
                    target: rt,
                    clear: true
                });

                const fullCanvas = this.app.renderer.extract.canvas(rt);

                const thumbCanvas = document.createElement('canvas');
                thumbCanvas.width = thumbWidth;
                thumbCanvas.height = thumbHeight;
                const ctx = thumbCanvas.getContext('2d');
                
                if (ctx) {
                    ctx.imageSmoothingEnabled = true;
                    ctx.imageSmoothingQuality = 'high';
                    ctx.drawImage(fullCanvas, 0, 0, thumbWidth, thumbHeight);
                }

                this._releaseRenderTexture(rt);

                const dataUrl = thumbCanvas.toDataURL('image/png');

                return {
                    canvas: thumbCanvas,
                    dataUrl: dataUrl,
                    width: thumbWidth,
                    height: thumbHeight
                };

            } catch (error) {
                return null;
            }
        }

        /**
         * フレームサムネイル生成 (アニメーション用)
         */
        async generateFrameThumbnail(frame, maxWidth = this.defaultFrameThumbSize, maxHeight = this.defaultFrameThumbSize) {
            if (!frame || !this.app?.renderer) {
                return null;
            }

            const frameId = frame.id || frame.label;
            
            const { width: thumbWidth, height: thumbHeight } = this._calculateThumbnailSize(maxWidth, maxHeight);

            const canvasWidth = this.config?.canvas?.width || 800;
            const canvasHeight = this.config?.canvas?.height || 600;

            const cacheKey = `frame_${frameId}_${canvasWidth}_${canvasHeight}_${thumbWidth}_${thumbHeight}`;
            
            if (this.frameThumbnailCache.has(cacheKey)) {
                const cached = this.frameThumbnailCache.get(cacheKey);
                return { 
                    canvas: cached,
                    width: thumbWidth,
                    height: thumbHeight
                };
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

                return {
                    canvas: thumbCanvas,
                    width: thumbWidth,
                    height: thumbHeight
                };

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
                updateThrottle: this.updateThrottle
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

console.log('✅ thumbnail-system.js (v1.1: 統一アスペクト比対応) loaded');