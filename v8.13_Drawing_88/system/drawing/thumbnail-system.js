// ===== system/drawing/thumbnail-system.js - チェックパターン統合版 =====
// 改修内容:
// - CheckerUtils統合（二重実装削除）
// - futabaカラー対応（--futaba-cream / --futaba-background）
// - ui:checker-theme-changed イベント購読追加

(function() {
    'use strict';

    class ThumbnailSystem {
        constructor(app, coordinateSystem, config) {
            this.app = app;
            this.coordinateSystem = coordinateSystem;
            this.config = config || window.TEGAKI_CONFIG;
            
            this.layerThumbnailCache = new Map();
            this.frameThumbnailCache = new Map();
            this.dataURLCache = new Map();
            
            this.defaultLayerThumbSize = 64;
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
            console.log('✅ ThumbnailSystem initialized (checker-utils統合版)');
        }

        _setupEventListeners() {
            // チェックパターンテーマ変更時
            this.eventBus.on('ui:checker-theme-changed', () => {
                this.clearAllCache();
                
                if (window.CheckerUtils) {
                    const colors = window.CheckerUtils.getColorsFromCSS();
                    window.CheckerUtils.updateTheme(colors);
                }
                
                if (window.CoreRuntime?.internal?.layerPanelRenderer) {
                    window.CoreRuntime.internal.layerPanelRenderer.requestUpdate();
                }
            });
            
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
                // カメラ変更時はキャッシュクリアしない（不要な再生成を防止）
            });
        }

        async generateLayerThumbnail(layer, width = this.defaultLayerThumbSize, height = this.defaultLayerThumbSize) {
            if (!layer || !this.app?.renderer) {
                return null;
            }

            if (layer.layerData?.isBackground) {
                return null;
            }

            if (this.disableCacheDuringVMode && this.vKeyModeActive) {
                return await this._renderLayerThumbnail(layer, width, height);
            }

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
                this.layerThumbnailCache.set(cacheKey, canvas);
                
                if (this.layerThumbnailCache.size > this.maxCacheSize) {
                    const firstKey = this.layerThumbnailCache.keys().next().value;
                    this.layerThumbnailCache.delete(firstKey);
                }
            }

            return canvas;
        }

        async _renderLayerThumbnail(layer, width, height) {
            try {
                const rt = this._acquireRenderTexture(width, height);
                if (!rt) return null;

                // 背景チェックパターン追加（CheckerUtils使用）
                const bgContainer = new PIXI.Container();
                
                if (window.CheckerUtils) {
                    const colors = window.CheckerUtils.getColorsFromCSS();
                    const checkerTex = window.CheckerUtils.createCheckerTexture({
                        tilePx: 8,
                        colorA: colors.colorA,
                        colorB: colors.colorB,
                        density: 1,
                        devicePixelRatio: 1
                    });
                    
                    const tilingSprite = new PIXI.TilingSprite(checkerTex, width, height);
                    bgContainer.addChild(tilingSprite);
                }
                
                bgContainer.addChild(layer);

                this.app.renderer.render({
                    container: bgContainer,
                    target: rt,
                    clear: true
                });

                bgContainer.removeChild(layer);

                const canvas = this.app.renderer.extract.canvas(rt);

                this._releaseRenderTexture(rt);

                return canvas;

            } catch (error) {
                console.error('Layer thumbnail generation failed:', error);
                return null;
            }
        }

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

                // 背景チェックパターン追加
                const bgContainer = new PIXI.Container();
                
                if (window.CheckerUtils) {
                    const colors = window.CheckerUtils.getColorsFromCSS();
                    const checkerTex = window.CheckerUtils.createCheckerTexture({
                        tilePx: 16,
                        colorA: colors.colorA,
                        colorB: colors.colorB,
                        density: 1,
                        devicePixelRatio: 1
                    });
                    
                    const tilingSprite = new PIXI.TilingSprite(checkerTex, canvasWidth, canvasHeight);
                    bgContainer.addChild(tilingSprite);
                }
                
                bgContainer.addChild(frame);

                this.app.renderer.render({
                    container: bgContainer,
                    target: fullRT,
                    clear: true
                });

                bgContainer.removeChild(frame);

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
                console.error('Frame thumbnail generation failed:', error);
                return null;
            }
        }

        canvasToDataURL(canvas) {
            if (!canvas) return null;
            
            try {
                return canvas.toDataURL('image/png');
            } catch (error) {
                console.error('Canvas to DataURL conversion failed:', error);
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
            this.dataURLCache.clear();
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
                console.error('RenderTexture acquire failed:', error);
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
                dataURLCacheSize: this.dataURLCache.size,
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

    console.log('✅ system/drawing/thumbnail-system.js (checker-utils統合版) loaded');

})();