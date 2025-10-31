// ===== system/drawing/thumbnail-system.js - Phase 9: アスペクト比対応完全版 =====

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
            
            this.eventBus = null;
            this.isInitialized = false;
            this.vKeyModeActive = false;
            
            this.pendingVModeRefresh = new Set();
            
            this.renderTexturePool = [];
            this.poolMaxSize = 10;
            this.poolStats = {
                acquired: 0,
                released: 0,
                created: 0
            };
            
            this.thumbnailUpdateTimer = null;
            this.isGenerating = false;
            this.suppressEvents = false;
        }

        init(eventBus) {
            if (this.isInitialized) return;
            
            this.eventBus = eventBus || window.TegakiEventBus;
            
            if (this.eventBus) {
                this._setupEventListeners();
            }
            
            this.isInitialized = true;
            console.log('✅ ThumbnailSystem Phase 9 initialized');
        }

        _setupEventListeners() {
            this.eventBus.on('keyboard:vkey-pressed', () => {
                this.vKeyModeActive = true;
            });
            
            this.eventBus.on('keyboard:vkey-released', () => {
                this.vKeyModeActive = false;
                this._refreshAllLayerThumbnailsAfterVMode();
            });
            
            this.eventBus.on('layer:transform-updated', ({ data }) => {
                const { layerId, layerIndex, immediate } = data || {};
                
                if (!layerId && layerIndex === undefined) return;
                
                if (this.vKeyModeActive && layerId) {
                    this.pendingVModeRefresh.add(layerId);
                    return;
                }
                
                if (layerId) {
                    this._invalidateLayerCacheByLayerId(layerId);
                }
                
                if (this.thumbnailUpdateTimer) {
                    clearTimeout(this.thumbnailUpdateTimer);
                }
                
                const delay = immediate ? 0 : 300;
                
                this.thumbnailUpdateTimer = setTimeout(() => {
                    if (layerIndex !== undefined && !this.suppressEvents) {
                        this.eventBus.emit('thumbnail:layer-updated', {
                            component: 'thumbnail-system',
                            action: 'transform-invalidated',
                            data: { layerIndex, layerId, immediate: false }
                        });
                    }
                    this.thumbnailUpdateTimer = null;
                }, delay);
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
            
            let cameraResizeTimer = null;
            this.eventBus.on('camera:resized', () => {
                this.clearAllCache();
                
                if (cameraResizeTimer) {
                    clearTimeout(cameraResizeTimer);
                }
                
                cameraResizeTimer = setTimeout(() => {
                    if (!this.suppressEvents) {
                        this.eventBus.emit('thumbnail:layer-updated', {
                            component: 'thumbnail-system',
                            action: 'resize-triggered',
                            data: { immediate: true }
                        });
                    }
                }, 500);
            });
            
            let cameraTransformTimer = null;
            this.eventBus.on('camera:transform-changed', () => {
                if (cameraTransformTimer) {
                    clearTimeout(cameraTransformTimer);
                }
                
                cameraTransformTimer = setTimeout(() => {
                    this.clearAllCache();
                }, 300);
            });
        }

        async _refreshAllLayerThumbnailsAfterVMode() {
            if (this.pendingVModeRefresh.size === 0) return;
            
            const layerMgr = window.layerManager;
            if (!layerMgr) return;
            
            const layers = layerMgr.getLayers();
            if (!layers || layers.length === 0) return;
            
            const layerIdsToRefresh = Array.from(this.pendingVModeRefresh);
            this.pendingVModeRefresh.clear();
            
            for (const layerId of layerIdsToRefresh) {
                const layerIndex = layers.findIndex(l => l.layerData?.id === layerId);
                
                if (layerIndex < 0) continue;
                
                this._invalidateLayerCacheByLayerId(layerId);
                
                if (this.eventBus) {
                    this.eventBus.emit('thumbnail:layer-updated', {
                        component: 'thumbnail-system',
                        action: 'vmode-exit-refresh',
                        data: { layerIndex, layerId, immediate: true }
                    });
                }
                
                await new Promise(resolve => setTimeout(resolve, 10));
            }
        }

        // ★★★ Phase 9: アスペクト比を考慮したサムネイル生成 ★★★
        async generateLayerThumbnail(layer, maxWidth = this.defaultLayerThumbSize, maxHeight = this.defaultLayerThumbSize) {
            if (!layer || !this.app?.renderer) return null;
            
            if (this.isGenerating) {
                await new Promise(resolve => setTimeout(resolve, 50));
            }
            
            this.isGenerating = true;

            try {
                // 背景レイヤー
                if (layer.layerData?.isBackground) {
                    return await this._generateBackgroundThumbnail(layer, maxWidth, maxHeight);
                }

                // Phase 9: キャンバスのアスペクト比を計算
                const canvasWidth = this.config?.canvas?.width || 800;
                const canvasHeight = this.config?.canvas?.height || 600;
                const aspectRatio = canvasWidth / canvasHeight;

                // サムネイルサイズをアスペクト比に合わせて調整
                let thumbWidth, thumbHeight;
                if (aspectRatio > 1) {
                    // 横長キャンバス
                    thumbWidth = maxWidth;
                    thumbHeight = Math.round(maxWidth / aspectRatio);
                } else {
                    // 縦長キャンバス
                    thumbHeight = maxHeight;
                    thumbWidth = Math.round(maxHeight * aspectRatio);
                }

                const layerId = layer.layerData?.id || layer.label;
                const cacheKey = `layer_${layerId}_${thumbWidth}_${thumbHeight}`;
                
                if (this.layerThumbnailCache.has(cacheKey)) {
                    return this.layerThumbnailCache.get(cacheKey);
                }

                const canvas = await this._renderLayerThumbnail(layer, thumbWidth, thumbHeight);
                
                if (canvas) {
                    this.layerThumbnailCache.set(cacheKey, canvas);
                    
                    if (this.layerThumbnailCache.size > this.maxCacheSize) {
                        const firstKey = this.layerThumbnailCache.keys().next().value;
                        this.layerThumbnailCache.delete(firstKey);
                    }
                }

                return canvas;
                
            } finally {
                this.isGenerating = false;
            }
        }

        async _generateBackgroundThumbnail(layer, maxWidth, maxHeight) {
            try {
                // Phase 9: 背景もアスペクト比対応
                const canvasWidth = this.config?.canvas?.width || 800;
                const canvasHeight = this.config?.canvas?.height || 600;
                const aspectRatio = canvasWidth / canvasHeight;

                let thumbWidth, thumbHeight;
                if (aspectRatio > 1) {
                    thumbWidth = maxWidth;
                    thumbHeight = Math.round(maxWidth / aspectRatio);
                } else {
                    thumbHeight = maxHeight;
                    thumbWidth = Math.round(maxHeight * aspectRatio);
                }

                const canvas = document.createElement('canvas');
                canvas.width = thumbWidth;
                canvas.height = thumbHeight;
                const ctx = canvas.getContext('2d');
                
                const bgColor = this.config?.background?.color || 0xF0E0D6;
                const r = (bgColor >> 16) & 0xFF;
                const g = (bgColor >> 8) & 0xFF;
                const b = bgColor & 0xFF;
                
                ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
                ctx.fillRect(0, 0, thumbWidth, thumbHeight);
                
                return canvas;
                
            } catch (error) {
                console.error('[Thumb] Background thumbnail failed:', error);
                return null;
            }
        }

        async _renderLayerThumbnail(layer, width, height) {
            try {
                const canvasWidth = this.config?.canvas?.width || 800;
                const canvasHeight = this.config?.canvas?.height || 600;
                
                const bounds = layer.getBounds();
                
                if (bounds.width === 0 || bounds.height === 0) {
                    return this._createEmptyCanvas(width, height);
                }

                const fullRT = PIXI.RenderTexture.create({
                    width: canvasWidth,
                    height: canvasHeight,
                    resolution: 1
                });

                if (!fullRT) {
                    return this._createEmptyCanvas(width, height);
                }

                const frameContainer = layer.parent;
                
                if (!frameContainer) {
                    fullRT.destroy(true);
                    return this._createEmptyCanvas(width, height);
                }

                this.app.renderer.render({
                    container: frameContainer,
                    target: fullRT,
                    clear: true
                });

                const canvas = await this._resizeRenderTextureToCanvas(fullRT, width, height);

                fullRT.destroy(true);

                return canvas;

            } catch (error) {
                console.error('[Thumb] Layer thumbnail failed:', error);
                return this._createEmptyCanvas(width, height);
            }
        }

        async _resizeRenderTextureToCanvas(renderTexture, targetWidth, targetHeight) {
            try {
                const sprite = PIXI.Sprite.from(renderTexture);
                
                const scaleX = targetWidth / renderTexture.width;
                const scaleY = targetHeight / renderTexture.height;
                const scale = Math.min(scaleX, scaleY);
                
                sprite.scale.set(scale, scale);
                sprite.x = (targetWidth - renderTexture.width * scale) / 2;
                sprite.y = (targetHeight - renderTexture.height * scale) / 2;
                
                const finalRT = PIXI.RenderTexture.create({
                    width: targetWidth,
                    height: targetHeight,
                    resolution: 1
                });
                
                this.app.renderer.render({
                    container: sprite,
                    target: finalRT,
                    clear: true
                });
                
                const canvas = this.app.renderer.extract.canvas(finalRT);
                
                sprite.destroy();
                finalRT.destroy(true);
                
                return canvas;
                
            } catch (error) {
                console.error('[Thumb] Resize failed:', error);
                return null;
            }
        }

        _createEmptyCanvas(width, height) {
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, width, height);
            return canvas;
        }

        async generateFrameThumbnail(frame, maxWidth = this.defaultFrameThumbSize, maxHeight = this.defaultFrameThumbSize) {
            if (!frame || !this.app?.renderer) return null;

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

            const cacheKey = `frame_${frameId}_${thumbWidth}_${thumbHeight}`;
            
            if (this.frameThumbnailCache.has(cacheKey)) {
                return this.frameThumbnailCache.get(cacheKey);
            }

            try {
                const thumbCanvas = await this._renderFrameThumbnailPixiJS(
                    frame, 
                    canvasWidth, 
                    canvasHeight, 
                    thumbWidth, 
                    thumbHeight
                );
                
                if (!thumbCanvas) return null;

                this.frameThumbnailCache.set(cacheKey, thumbCanvas);
                
                if (this.frameThumbnailCache.size > this.maxCacheSize) {
                    const firstKey = this.frameThumbnailCache.keys().next().value;
                    this.frameThumbnailCache.delete(firstKey);
                }

                return thumbCanvas;

            } catch (error) {
                console.error('[Thumb] Frame thumbnail failed:', error);
                return null;
            }
        }

        async _renderFrameThumbnailPixiJS(frame, canvasWidth, canvasHeight, thumbWidth, thumbHeight) {
            let fullRT = null;
            let thumbRT = null;
            let tempSprite = null;
            
            try {
                fullRT = this._acquireRenderTexture(canvasWidth, canvasHeight);
                if (!fullRT) return null;

                this.app.renderer.render({
                    container: frame,
                    target: fullRT,
                    clear: true
                });

                thumbRT = PIXI.RenderTexture.create({
                    width: thumbWidth,
                    height: thumbHeight,
                    resolution: 1
                });

                if (!thumbRT) {
                    this._releaseRenderTexture(fullRT);
                    return null;
                }

                tempSprite = PIXI.Sprite.from(fullRT);
                
                const scaleX = thumbWidth / canvasWidth;
                const scaleY = thumbHeight / canvasHeight;
                const scale = Math.min(scaleX, scaleY);
                
                tempSprite.scale.set(scale, scale);
                tempSprite.x = (thumbWidth - canvasWidth * scale) / 2;
                tempSprite.y = (thumbHeight - canvasHeight * scale) / 2;

                this.app.renderer.render({
                    container: tempSprite,
                    target: thumbRT,
                    clear: true
                });

                const thumbCanvas = this.app.renderer.extract.canvas(thumbRT);

                tempSprite.destroy();
                this._releaseRenderTexture(fullRT);
                thumbRT.destroy(true);

                return thumbCanvas;

            } catch (error) {
                console.error('[Thumb] PixiJS frame thumbnail failed:', error);
                
                if (tempSprite) {
                    try { tempSprite.destroy(); } catch (e) {}
                }
                if (fullRT) {
                    this._releaseRenderTexture(fullRT);
                }
                if (thumbRT) {
                    try { thumbRT.destroy(true); } catch (e) {}
                }
                
                return null;
            }
        }

        _acquireRenderTexture(width, height) {
            try {
                for (let i = this.renderTexturePool.length - 1; i >= 0; i--) {
                    const rt = this.renderTexturePool[i];
                    if (rt.width === width && rt.height === height) {
                        this.renderTexturePool.splice(i, 1);
                        this.poolStats.acquired++;
                        return rt;
                    }
                }

                const newRT = PIXI.RenderTexture.create({
                    width: width,
                    height: height,
                    resolution: window.devicePixelRatio || 1
                });

                this.poolStats.created++;
                return newRT;

            } catch (error) {
                console.error('[Thumb] RenderTexture acquire failed:', error);
                return null;
            }
        }

        _releaseRenderTexture(rt) {
            if (!rt) return;

            try {
                if (this.renderTexturePool.length < this.poolMaxSize) {
                    this.renderTexturePool.push(rt);
                    this.poolStats.released++;
                } else {
                    rt.destroy(true);
                }

            } catch (error) {
                console.error('[Thumb] RenderTexture release failed:', error);
                try {
                    rt.destroy(true);
                } catch (e) {}
            }
        }

        canvasToDataURL(canvas) {
            if (!canvas) return null;
            
            try {
                return canvas.toDataURL('image/png');
            } catch (error) {
                console.error('[Thumb] Canvas to DataURL failed:', error);
                return null;
            }
        }

        invalidateLayerCache(layerIndex) {
            if (layerIndex < 0) return;
            
            const keysToDelete = [];
            for (const key of this.layerThumbnailCache.keys()) {
                if (key.startsWith(`layer_`)) {
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
                if (key.startsWith(`layer_${layerId}_`)) {
                    keysToDelete.push(key);
                }
            }
            
            keysToDelete.forEach(key => {
                this.layerThumbnailCache.delete(key);
            });
        }

        _invalidateFrameCacheByFrameId(frameId) {
            const keysToDelete = [];
            
            for (const key of this.frameThumbnailCache.keys()) {
                if (key.startsWith(`frame_${frameId}_`)) {
                    keysToDelete.push(key);
                }
            }
            
            keysToDelete.forEach(key => {
                this.frameThumbnailCache.delete(key);
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
            this.pendingVModeRefresh.clear();
        }

        getDebugInfo() {
            return {
                layerCacheSize: this.layerThumbnailCache.size,
                frameCacheSize: this.frameThumbnailCache.size,
                dataURLCacheSize: this.dataURLCache.size,
                isInitialized: this.isInitialized,
                vKeyModeActive: this.vKeyModeActive,
                pendingVModeRefreshCount: this.pendingVModeRefresh.size,
                pendingLayerIds: Array.from(this.pendingVModeRefresh),
                renderTexturePool: {
                    current: this.renderTexturePool.length,
                    maxSize: this.poolMaxSize,
                    stats: this.poolStats
                },
                isGenerating: this.isGenerating,
                suppressEvents: this.suppressEvents
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

    console.log('✅ thumbnail-system.js Phase 9 loaded');

})();