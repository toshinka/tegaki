// ===== system/drawing/thumbnail-system.js - Phase 2完全版 =====
// Phase 2: TransformStack対応 + アスペクト比統一 + キャッシュキー生成一元化

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
            
            this.debugEnabled = false;
        }

        init(eventBus) {
            if (this.isInitialized) return;
            
            this.eventBus = eventBus || window.TegakiEventBus;
            
            if (this.eventBus) {
                this._setupEventListeners();
            }
            
            this.isInitialized = true;
            console.log('✅ ThumbnailSystem Phase 2: TransformStack対応完了');
        }

        _setupEventListeners() {
            // Vキーモード管理
            this.eventBus.on('keyboard:vkey-pressed', () => {
                this.vKeyModeActive = true;
            });
            
            this.eventBus.on('keyboard:vkey-released', () => {
                this.vKeyModeActive = false;
                this._refreshAllLayerThumbnailsAfterVMode();
                this._triggerTimelineUpdate();
            });
            
            // レイヤー変形イベント
            this.eventBus.on('layer:transform-updated', ({ data }) => {
                const { layerId, layerIndex, immediate } = data || {};
                
                if (!layerId && layerIndex === undefined) return;
                
                // Vキーモード中は保留
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
            
            // 描画イベント
            this.eventBus.on('layer:stroke-added', ({ layerIndex }) => {
                this.invalidateLayerCache(layerIndex);
            });
            
            this.eventBus.on('layer:path-added', ({ layerIndex }) => {
                this.invalidateLayerCache(layerIndex);
            });
            
            // 反転イベント
            this.eventBus.on('layer:flip-horizontal', ({ layerId }) => {
                this._invalidateLayerCacheByLayerId(layerId);
            });
            
            this.eventBus.on('layer:flip-vertical', ({ layerId }) => {
                this._invalidateLayerCacheByLayerId(layerId);
            });
            
            // フレーム更新
            this.eventBus.on('animation:frame-updated', ({ frameIndex }) => {
                this.invalidateFrameCache(frameIndex);
            });
            
            // カメラリサイズ
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
            
            // カメラ変形
            let cameraTransformTimer = null;
            this.eventBus.on('camera:transform-changed', () => {
                if (cameraTransformTimer) {
                    clearTimeout(cameraTransformTimer);
                }
                
                cameraTransformTimer = setTimeout(() => {
                    this.clearAllCache();
                    if (!this.suppressEvents) {
                        this.eventBus.emit('thumbnail:layer-updated', {
                            component: 'thumbnail-system',
                            action: 'camera-transform',
                            data: { immediate: true }
                        });
                    }
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

        _triggerTimelineUpdate() {
            if (!this.eventBus) return;
            
            if (typeof gsap !== 'undefined') {
                gsap.delayedCall(0.05, () => {
                    this.eventBus.emit('thumbnail:regenerate-all');
                });
            } else {
                setTimeout(() => {
                    this.eventBus.emit('thumbnail:regenerate-all');
                }, 50);
            }
        }

        // ========== Phase 2: アスペクト比計算統一 ==========
        _calculateThumbnailSize(maxWidth, maxHeight) {
            const canvasWidth = this.config.canvas.width;
            const canvasHeight = this.config.canvas.height;
            const aspectRatio = canvasWidth / canvasHeight;
            
            if (aspectRatio > 1) {
                return {
                    width: maxWidth,
                    height: Math.round(maxWidth / aspectRatio)
                };
            } else {
                return {
                    width: Math.round(maxHeight * aspectRatio),
                    height: maxHeight
                };
            }
        }

        // ========== Phase 2: TransformHash生成 ==========
        _getTransformHash() {
            const cameraStack = window.cameraSystem?.transformStack;
            if (!cameraStack) {
                // フォールバック: 既存のカメラシステムから取得
                const cameraSystem = window.cameraSystem;
                if (cameraSystem?.worldContainer) {
                    const pos = cameraSystem.worldContainer.position;
                    const scale = cameraSystem.worldContainer.scale;
                    const rotation = cameraSystem.rotation || 0;
                    return `${pos.x.toFixed(1)}_${pos.y.toFixed(1)}_${Math.abs(scale.x).toFixed(2)}_${Math.round(rotation % 360)}`;
                }
                return 'no-transform';
            }
            
            const t = cameraStack.getTransform();
            return `${t.x.toFixed(1)}_${t.y.toFixed(1)}_${Math.abs(t.scaleX).toFixed(2)}_${(t.rotation * 180 / Math.PI).toFixed(0)}`;
        }

        _getLayerTransformHash(layerId) {
            const layerTransform = window.layerManager?.transform;
            if (!layerTransform?.layerTransformStacks) return 'no-layer-transform';
            
            const stack = layerTransform.layerTransformStacks.get(layerId);
            if (!stack) return 'no-layer-transform';
            
            const t = stack.getTransform();
            return `${t.x.toFixed(1)}_${t.y.toFixed(1)}_${Math.abs(t.scaleX).toFixed(2)}_${(t.rotation * 180 / Math.PI).toFixed(0)}`;
        }

        // ========== Phase 2: キャッシュキー生成統一 ==========
        _generateCacheKey(type, id, size, transformHash) {
            return `${type}_${id}_${size.width}_${size.height}_${transformHash}`;
        }

        // ========== Phase 2: レイヤーサムネイル生成（TransformStack対応） ==========
        async generateLayerThumbnail(layer, maxWidth = this.defaultLayerThumbSize, maxHeight = this.defaultLayerThumbSize) {
            if (!layer || !this.app?.renderer) return null;
            
            if (this.isGenerating) {
                await new Promise(resolve => setTimeout(resolve, 50));
            }
            
            this.isGenerating = true;

            try {
                // 背景レイヤー
                if (layer.layerData?.isBackground) {
                    return await this._generateBackgroundThumbnail(maxWidth, maxHeight);
                }

                const size = this._calculateThumbnailSize(maxWidth, maxHeight);
                const layerId = layer.layerData?.id || layer.label;
                
                // Phase 2: TransformHashでキャッシュキー生成
                const cameraHash = this._getTransformHash();
                const layerHash = this._getLayerTransformHash(layerId);
                const transformHash = `${cameraHash}_${layerHash}`;
                const cacheKey = this._generateCacheKey('layer', layerId, size, transformHash);
                
                if (this.layerThumbnailCache.has(cacheKey)) {
                    return this.layerThumbnailCache.get(cacheKey);
                }

                const canvas = await this._renderLayerThumbnail(layer, size.width, size.height);
                
                if (canvas) {
                    this.layerThumbnailCache.set(cacheKey, canvas);
                    this._pruneCache(this.layerThumbnailCache);
                }

                return canvas;
                
            } finally {
                this.isGenerating = false;
            }
        }

        async _generateBackgroundThumbnail(maxWidth, maxHeight) {
            try {
                const size = this._calculateThumbnailSize(maxWidth, maxHeight);

                const canvas = document.createElement('canvas');
                canvas.width = size.width;
                canvas.height = size.height;
                const ctx = canvas.getContext('2d');
                
                const bgColor = this.config?.background?.color || 0xF0E0D6;
                const r = (bgColor >> 16) & 0xFF;
                const g = (bgColor >> 8) & 0xFF;
                const b = bgColor & 0xFF;
                
                ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
                ctx.fillRect(0, 0, size.width, size.height);
                
                return canvas;
                
            } catch (error) {
                if (this.debugEnabled) {
                    console.error('[Thumb] Background thumbnail failed:', error);
                }
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

                // フレームコンテナ全体を取得（カメラ変形が適用されている）
                const frameContainer = layer.parent;
                
                if (!frameContainer) {
                    return this._createEmptyCanvas(width, height);
                }

                // カメラ変形を含めてレンダリング
                const fullRT = PIXI.RenderTexture.create({
                    width: canvasWidth,
                    height: canvasHeight,
                    resolution: 1
                });

                if (!fullRT) {
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
                if (this.debugEnabled) {
                    console.error('[Thumb] Layer thumbnail failed:', error);
                }
                return this._createEmptyCanvas(width, height);
            }
        }

        // ========== Phase 2: フレームサムネイル生成（TransformStack対応） ==========
        async generateFrameThumbnail(frame, maxWidth = this.defaultFrameThumbSize, maxHeight = this.defaultFrameThumbSize) {
            if (!frame || !this.app?.renderer) return null;

            const size = this._calculateThumbnailSize(maxWidth, maxHeight);
            const frameId = frame.id || frame.label;
            
            // フレームはカメラtransformのみ考慮
            const transformHash = this._getTransformHash();
            const cacheKey = this._generateCacheKey('frame', frameId, size, transformHash);
            
            if (this.frameThumbnailCache.has(cacheKey)) {
                return this.frameThumbnailCache.get(cacheKey);
            }

            try {
                const thumbCanvas = await this._renderFrameThumbnailPixiJS(
                    frame, 
                    this.config.canvas.width,
                    this.config.canvas.height,
                    size.width, 
                    size.height
                );
                
                if (!thumbCanvas) return null;

                this.frameThumbnailCache.set(cacheKey, thumbCanvas);
                this._pruneCache(this.frameThumbnailCache);

                return thumbCanvas;

            } catch (error) {
                if (this.debugEnabled) {
                    console.error('[Thumb] Frame thumbnail failed:', error);
                }
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
                if (this.debugEnabled) {
                    console.error('[Thumb] PixiJS frame thumbnail failed:', error);
                }
                
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
                if (this.debugEnabled) {
                    console.error('[Thumb] Resize failed:', error);
                }
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

        // ========== Phase 2: キャッシュ管理 ==========
        _pruneCache(cache) {
            if (cache.size > this.maxCacheSize) {
                const deleteCount = cache.size - this.maxCacheSize;
                const keys = Array.from(cache.keys());
                for (let i = 0; i < deleteCount; i++) {
                    cache.delete(keys[i]);
                }
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
                if (this.debugEnabled) {
                    console.error('[Thumb] RenderTexture acquire failed:', error);
                }
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
                if (this.debugEnabled) {
                    console.error('[Thumb] RenderTexture release failed:', error);
                }
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
                if (this.debugEnabled) {
                    console.error('[Thumb] Canvas to DataURL failed:', error);
                }
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

        setDebugMode(enabled) {
            this.debugEnabled = enabled;
            console.log(`[ThumbnailSystem] Debug mode: ${enabled ? 'ON' : 'OFF'}`);
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
                suppressEvents: this.suppressEvents,
                debugEnabled: this.debugEnabled
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

    // シングルトンインスタンス作成
    window.ThumbnailSystem = new ThumbnailSystem(
        null,
        window.CoordinateSystem,
        window.TEGAKI_CONFIG
    );

    // デバッグコマンド
    window.debugThumbnailSystem = () => {
        window.ThumbnailSystem.setDebugMode(true);
        console.log(window.ThumbnailSystem.getDebugInfo());
    };

    console.log('✅ thumbnail-system.js Phase 2完全版 loaded');
    console.log('   ✓ TransformStackからtransform取得');
    console.log('   ✓ アスペクト比計算統一');
    console.log('   ✓ キャッシュキー生成一元化');
    console.log('   ✓ transformHash実装');

})();