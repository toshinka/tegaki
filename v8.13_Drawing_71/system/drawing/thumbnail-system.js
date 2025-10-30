// ★★★ Phase 4完全修正: レイヤー完全非破壊レンダリング ★★★
        async _renderLayerThumbnail(layer, width, height) {
            try {
                // 背景レイヤーは専用処理
                if (layer.layerData?.isBackground) {
                    return this._generateBackgroundThumbnail(layer, width, height);
                }

                // Step 1: レイヤーの親（フレームコンテナ）を取得
                const frameContainer = layer.parent;
                if (!frameContainer) {
                    console.warn('[ThumbnailSystem] Layer has no parent container');
                    return this._createEmptyCanvas(width, height);
                }

                // Step 2: キャンバスサイズ取得
                const canvasWidth = this.config?.canvas?.width || 800;
                const canvasHeight = this.config?.canvas?.height || 600;

                // Step 3: フレーム全体をRenderTextureに描画
                const frameRT = PIXI.RenderTexture.create({
                    width: canvasWidth,
                    height: canvasHeight,
                    resolution: 1
                });

                if (!frameRT) {
                    console.error('[ThumbnailSystem] RenderTexture creation failed');
                    return this._createEmptyCanvas(width, height);
                }

                // 一時的に他のレイヤーを非表示化（対象レイヤーのみ表示）
                const siblingVisibility = new Map();
                frameContainer.children.forEach(sibling => {
                    if (sibling !== layer) {
                        siblingVisibility.set(sibling, sibling.visible);
                        sibling.visible = false;
                    }
                });

                // レイヤーの元の可視性を保存
                const originalVisibility = layer.visible;
                layer.visible = true;

                // Step 4: レンダリング（レイヤーは元の位置のまま）
                this.app.renderer.render({
                    container: frameContainer,
                    target: frameRT,
                    clear: true
                });

                // Step 5: 可視性を復元
                layer.visible = originalVisibility;
                siblingVisibility.forEach((vis, sibling) => {
                    sibling.visible = vis;
                });

                // Step 6: サムネイルサイズにリサイズ
                const canvas = await this._resizeRenderTextureToCanvas(frameRT, width, height);

                // クリーンアップ
                frameRT.destroy(true);

                return canvas;

            } catch (error) {
                console.error('[ThumbnailSystem] Layer thumbnail failed:', error);
                
                // エラー時も可視性を復元
                if (layer && layer.parent) {
                    layer.parent.children.forEach(sibling => {
                        if (sibling.visible === false && sibling !== layer) {
                            sibling.visible = true;
                        }
                    });
                }
                
                return this._createEmptyCanvas(width, height);
            }
        }// ===== system/drawing/thumbnail-system.js - Phase 1-4完全版 =====
// Phase 1: Vモード終了時のキャッシュ再生成
// Phase 2: キャッシュキー戦略の統一（layerId/frameId + サイズのみ）
// Phase 3: Canvas2D撲滅（PixiJS RenderTexture統一）
// Phase 4完全修正: レイヤーバウンディングボックス対応・座標変換考慮

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
        }

        init(eventBus) {
            if (this.isInitialized) return;
            
            this.eventBus = eventBus || window.TegakiEventBus;
            
            if (this.eventBus) {
                this._setupEventListeners();
            }
            
            this.isInitialized = true;
            console.log('✅ ThumbnailSystem initialized (Phase 1-4完全版)');
            console.log('   ✓ RenderTexture pool: max size ' + this.poolMaxSize);
            console.log('   ✓ Layer bounding box support enabled');
        }

        _setupEventListeners() {
            this.eventBus.on('keyboard:vkey-pressed', () => {
                this.vKeyModeActive = true;
                console.log('🔵 Vkey mode activated');
            });
            
            this.eventBus.on('keyboard:vkey-released', () => {
                this.vKeyModeActive = false;
                console.log('🔴 Vkey mode deactivated - refreshing...');
                this._refreshAllLayerThumbnailsAfterVMode();
            });
            
            // ★★★ Phase 4: layer:transform-updated の優先度高い処理 ★★★
            this.eventBus.on('layer:transform-updated', ({ data }) => {
                const { layerId, layerIndex } = data || {};
                
                if (!layerId && layerIndex === undefined) return;
                
                // Vモード中は pendingVModeRefresh に追加
                if (this.vKeyModeActive && layerId) {
                    this.pendingVModeRefresh.add(layerId);
                    console.log(`📌 [ThumbnailSystem] Pending VMode refresh: ${layerId}`);
                    return;
                }
                
                // Vモード外: 即座にキャッシュクリア
                if (layerId) {
                    this._invalidateLayerCacheByLayerId(layerId);
                    console.log(`🗑️ [ThumbnailSystem] Cache cleared: ${layerId}`);
                }
                
                // throttle処理（100ms）
                if (this.thumbnailUpdateTimer) {
                    clearTimeout(this.thumbnailUpdateTimer);
                }
                
                this.thumbnailUpdateTimer = setTimeout(() => {
                    if (layerIndex !== undefined) {
                        console.log(`📢 [ThumbnailSystem] Emit thumbnail:layer-updated for layer ${layerIndex}`);
                        this.eventBus.emit('thumbnail:layer-updated', {
                            component: 'thumbnail-system',
                            action: 'transform-invalidated',
                            data: { layerIndex, layerId, immediate: false }
                        });
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
            
            this.eventBus.on('camera:resized', () => {
                console.log('📐 [ThumbnailSystem] Canvas resized - clearing all cache');
                this.clearAllCache();
                
                // 全レイヤーサムネイル更新トリガー
                setTimeout(() => {
                    this.eventBus.emit('thumbnail:layer-updated', {
                        component: 'thumbnail-system',
                        action: 'resize-triggered',
                        data: { immediate: true }
                    });
                }, 50);
            });
            
            this.eventBus.on('camera:transform-changed', () => {
                this.clearAllCache();
            });
        }

        async _refreshAllLayerThumbnailsAfterVMode() {
            if (this.pendingVModeRefresh.size === 0) {
                console.log('✅ No layers to refresh');
                return;
            }
            
            console.log(`🔄 Refreshing ${this.pendingVModeRefresh.size} layers`);
            
            const layerMgr = window.layerManager;
            if (!layerMgr) {
                console.warn('⚠️ LayerManager not found');
                return;
            }
            
            const layers = layerMgr.getLayers();
            if (!layers || layers.length === 0) return;
            
            const layerIdsToRefresh = Array.from(this.pendingVModeRefresh);
            this.pendingVModeRefresh.clear();
            
            for (const layerId of layerIdsToRefresh) {
                const layerIndex = layers.findIndex(l => l.layerData?.id === layerId);
                
                if (layerIndex < 0) continue;
                
                this._invalidateLayerCacheByLayerId(layerId);
                
                if (this.eventBus) {
                    console.log(`📢 [ThumbnailSystem] Emit immediate update for layer ${layerIndex}`);
                    this.eventBus.emit('thumbnail:layer-updated', {
                        component: 'thumbnail-system',
                        action: 'vmode-exit-refresh',
                        data: { layerIndex, layerId, immediate: true }
                    });
                }
                
                await new Promise(resolve => setTimeout(resolve, 10));
            }
            
            console.log('✅ All pending thumbnails refreshed');
        }

        // ★★★ Phase 4完全修正: レイヤーバウンディングボックス対応 ★★★
        async generateLayerThumbnail(layer, width = this.defaultLayerThumbSize, height = this.defaultLayerThumbSize) {
            if (!layer || !this.app?.renderer) {
                console.warn('[ThumbnailSystem] Invalid layer or renderer');
                return null;
            }

            // 背景レイヤーは専用処理
            if (layer.layerData?.isBackground) {
                return this._generateBackgroundThumbnail(layer, width, height);
            }

            const layerId = layer.layerData?.id || layer.label;
            const cacheKey = `layer_${layerId}_${width}_${height}`;
            
            // キャッシュチェック
            if (this.layerThumbnailCache.has(cacheKey)) {
                return this.layerThumbnailCache.get(cacheKey);
            }

            // レンダリング
            const canvas = await this._renderLayerThumbnail(layer, width, height);
            
            if (canvas) {
                this.layerThumbnailCache.set(cacheKey, canvas);
                
                // キャッシュサイズ制限
                if (this.layerThumbnailCache.size > this.maxCacheSize) {
                    const firstKey = this.layerThumbnailCache.keys().next().value;
                    this.layerThumbnailCache.delete(firstKey);
                }
            }

            return canvas;
        }

        // ★★★ Phase 4完全修正: 背景レイヤー専用サムネイル ★★★
        async _generateBackgroundThumbnail(layer, width, height) {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                
                // 背景色描画
                const bgColor = this.config?.background?.color || 0xF0E0D6;
                const r = (bgColor >> 16) & 0xFF;
                const g = (bgColor >> 8) & 0xFF;
                const b = bgColor & 0xFF;
                
                ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
                ctx.fillRect(0, 0, width, height);
                
                return canvas;
                
            } catch (error) {
                console.error('[ThumbnailSystem] Background thumbnail failed:', error);
                return null;
            }
        }

        // ★★★ Phase 4完全修正: レイヤーバウンディングボックス考慮 ★★★
        async _renderLayerThumbnail(layer, width, height) {
            try {
                // Step 1: レイヤーのローカルバウンディングボックス取得
                const bounds = layer.getLocalBounds();
                
                // 空のレイヤー対策
                if (bounds.width === 0 || bounds.height === 0) {
                    console.log(`[ThumbnailSystem] Empty layer: ${layer.layerData?.id}`);
                    return this._createEmptyCanvas(width, height);
                }

                // Step 2: バウンディングボックスに基づく一時コンテナ作成
                const tempContainer = new PIXI.Container();
                
                // レイヤーの全子要素を一時コンテナにコピー
                const originalTransform = {
                    x: layer.position.x,
                    y: layer.position.y,
                    scaleX: layer.scale.x,
                    scaleY: layer.scale.y,
                    rotation: layer.rotation,
                    pivotX: layer.pivot.x,
                    pivotY: layer.pivot.y
                };
                
                // 一時的にレイヤーをtempContainerに追加（Transform適用済み）
                tempContainer.addChild(layer);
                
                // Step 3: RenderTexture作成（バウンディングボックスサイズ）
                const paddingRatio = 1.1; // 10%のパディング
                const renderWidth = Math.max(1, Math.ceil(bounds.width * paddingRatio));
                const renderHeight = Math.max(1, Math.ceil(bounds.height * paddingRatio));
                
                const rt = PIXI.RenderTexture.create({
                    width: renderWidth,
                    height: renderHeight,
                    resolution: window.devicePixelRatio || 1
                });

                if (!rt) {
                    tempContainer.removeChild(layer);
                    return null;
                }

                // Step 4: レンダリング（バウンディングボックスの中心を原点に）
                const offsetX = -bounds.x + (renderWidth - bounds.width) / 2;
                const offsetY = -bounds.y + (renderHeight - bounds.height) / 2;
                
                tempContainer.position.set(offsetX, offsetY);

                this.app.renderer.render({
                    container: tempContainer,
                    target: rt,
                    clear: true
                });

                // Step 5: サムネイルサイズにリサイズ
                const canvas = await this._resizeRenderTextureToCanvas(rt, width, height);

                // クリーンアップ
                tempContainer.removeChild(layer);
                rt.destroy(true);

                return canvas;

            } catch (error) {
                console.error('[ThumbnailSystem] Layer thumbnail failed:', error);
                return null;
            }
        }

        // ★★★ Phase 4新規: RenderTextureをキャンバスにリサイズ ★★★
        async _resizeRenderTextureToCanvas(renderTexture, targetWidth, targetHeight) {
            try {
                // RenderTextureからSpriteを作成
                const sprite = PIXI.Sprite.from(renderTexture);
                
                // アスペクト比を保ってスケール計算
                const scaleX = targetWidth / renderTexture.width;
                const scaleY = targetHeight / renderTexture.height;
                const scale = Math.min(scaleX, scaleY);
                
                sprite.scale.set(scale, scale);
                
                // 中央配置
                sprite.x = (targetWidth - renderTexture.width * scale) / 2;
                sprite.y = (targetHeight - renderTexture.height * scale) / 2;
                
                // 最終サムネイル用RenderTexture
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
                
                // Canvas抽出
                const canvas = this.app.renderer.extract.canvas(finalRT);
                
                // クリーンアップ
                sprite.destroy();
                finalRT.destroy(true);
                
                return canvas;
                
            } catch (error) {
                console.error('[ThumbnailSystem] Resize failed:', error);
                return null;
            }
        }

        // ★★★ Phase 4新規: 空のキャンバス作成 ★★★
        _createEmptyCanvas(width, height) {
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            
            // 透明背景
            ctx.clearRect(0, 0, width, height);
            
            return canvas;
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
                console.error('Frame thumbnail failed:', error);
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
                console.error('PixiJS frame thumbnail failed:', error);
                
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
                console.error('RenderTexture acquire failed:', error);
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
                console.error('RenderTexture release failed:', error);
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
                console.error('Canvas to DataURL failed:', error);
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
                }
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

    // グローバル登録（初期化は後で）
    window.ThumbnailSystem = new ThumbnailSystem(
        null,
        window.CoordinateSystem,
        window.TEGAKI_CONFIG
    );

    console.log('✅ thumbnail-system.js loaded (Phase 1-4完全版)');
    console.log('   ✓ Layer bounding box support');
    console.log('   ✓ Transform-aware rendering');
    console.log('   ✓ Empty layer detection');

})();