// ===== system/drawing/thumbnail-system.js - Phase 1-3完全版 =====
// Phase 1: Vモード終了時のキャッシュ再生成
// Phase 2: キャッシュキー戦略の統一（layerId/frameId + サイズのみ）
// Phase 3: Canvas2D撲滅（PixiJS RenderTexture統一）
// 【改修内容】
// - generateFrameThumbnail(): Canvas2D廃止 → PixiJS RenderTexture使用
// - _renderFrameThumbnailPixiJS(): 新規実装（GPU処理でリサイズ）
// - _acquireRenderTexture(): RenderTexture プール管理
// - _releaseRenderTexture(): メモリ効率化

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
            
            this.eventBus = null;
            this.isInitialized = false;
            this.vKeyModeActive = false;
            
            // Phase 1: Vモード終了時の再生成待ちリスト
            this.pendingVModeRefresh = new Set();
            
            // Phase 3: RenderTexture プール管理
            this.renderTexturePool = [];
            this.poolMaxSize = 10;
            this.poolStats = {
                acquired: 0,
                released: 0,
                created: 0
            };
            
            // throttle 用タイマー
            this.thumbnailUpdateTimer = null;
        }

        init(eventBus) {
            if (this.isInitialized) return;
            
            this.eventBus = eventBus || window.TegakiEventBus;
            
            if (this.eventBus) {
                this._setupEventListeners();
            }
            
            this.isInitialized = true;
            console.log('✅ ThumbnailSystem initialized (Phase 1-3)');
            console.log('   ✓ RenderTexture pool: max size ' + this.poolMaxSize);
        }

        _setupEventListeners() {
            // Phase 1: Vキーモード検知
            this.eventBus.on('keyboard:vkey-pressed', () => {
                this.vKeyModeActive = true;
                console.log('🔵 Vkey mode activated - caching enabled');
            });
            
            this.eventBus.on('keyboard:vkey-released', () => {
                this.vKeyModeActive = false;
                console.log('🔴 Vkey mode deactivated - starting thumbnail refresh...');
                
                // Phase 1: Vモード終了時に待機中のレイヤーサムネイルを再生成
                this._refreshAllLayerThumbnailsAfterVMode();
            });
            
            // レイヤー変形時のサムネイル無効化
            this.eventBus.on('layer:transform-updated', ({ data }) => {
                const { layerId, layerIndex } = data || {};
                
                if (!layerId && layerIndex === undefined) return;
                
                // Phase 1: Vモード中は待機リストに追加
                if (this.vKeyModeActive && layerId) {
                    this.pendingVModeRefresh.add(layerId);
                    return;
                }
                
                // 通常時はキャッシュを無効化
                if (layerId) {
                    this._invalidateLayerCacheByLayerId(layerId);
                }
                
                // throttle付き更新リクエスト
                if (this.thumbnailUpdateTimer) {
                    clearTimeout(this.thumbnailUpdateTimer);
                }
                
                this.thumbnailUpdateTimer = setTimeout(() => {
                    if (layerIndex !== undefined) {
                        this.eventBus.emit('thumbnail:layer-updated', {
                            component: 'thumbnail-system',
                            action: 'transform-invalidated',
                            data: { layerIndex, layerId }
                        });
                    }
                    this.thumbnailUpdateTimer = null;
                }, 100);
            });
            
            this.eventBus.on('layer:stroke-added', ({ layerIndex, layerId }) => {
                this.invalidateLayerCache(layerIndex);
            });
            
            this.eventBus.on('layer:path-added', ({ layerIndex, layerId }) => {
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
            
            // 全サムネイル再生成トリガー
            this.eventBus.on('camera:transform-changed', () => {
                this.clearAllCache();
            });
        }

        /**
         * Phase 1: Vモード終了時の全レイヤーサムネイル再生成
         */
        async _refreshAllLayerThumbnailsAfterVMode() {
            if (this.pendingVModeRefresh.size === 0) {
                console.log('✅ No layers to refresh after Vmode exit');
                return;
            }
            
            console.log(`🔄 Refreshing ${this.pendingVModeRefresh.size} layers after Vmode exit`);
            
            const layerMgr = window.CoreRuntime?.internal?.layerManager;
            if (!layerMgr) {
                console.warn('⚠️ LayerManager not found - cannot refresh thumbnails');
                return;
            }
            
            const layers = layerMgr.getLayers();
            if (!layers || layers.length === 0) {
                console.warn('⚠️ No layers available');
                return;
            }
            
            // 待機リストのレイヤーIDを配列化
            const layerIdsToRefresh = Array.from(this.pendingVModeRefresh);
            this.pendingVModeRefresh.clear();
            
            console.log(`📋 Pending layer IDs to refresh:`, layerIdsToRefresh);
            
            // 各レイヤーのサムネイルを再生成
            for (const layerId of layerIdsToRefresh) {
                const layerIndex = layers.findIndex(l => l.layerData?.id === layerId);
                
                if (layerIndex < 0) {
                    console.warn(`⚠️ Layer ID not found: ${layerId}`);
                    continue;
                }
                
                console.log(`🎬 Refreshing layer: index=${layerIndex}, id=${layerId}`);
                
                // キャッシュクリア
                this._invalidateLayerCacheByLayerId(layerId);
                
                // 即座更新トリガー（UI層へ）
                if (this.eventBus) {
                    this.eventBus.emit('thumbnail:layer-updated', {
                        component: 'thumbnail-system',
                        action: 'vmode-exit-refresh',
                        data: { layerIndex, layerId, immediate: true }
                    });
                }
                
                // 次のレイヤーまで少し待機（負荷分散）
                await new Promise(resolve => setTimeout(resolve, 10));
            }
            
            console.log('✅ All pending layer thumbnails refreshed');
        }

        /**
         * Phase 2: レイヤーサムネイル生成
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
                return null;
            }

            const layerId = layer.layerData?.id || layer.label;
            
            // Phase 2: キャッシュキーを layerId + サイズのみ
            const cacheKey = `layer_${layerId}_${width}_${height}`;
            
            if (this.layerThumbnailCache.has(cacheKey)) {
                console.log(`✓ Layer thumbnail cache hit: ${cacheKey}`);
                return this.layerThumbnailCache.get(cacheKey);
            }

            const canvas = await this._renderLayerThumbnail(layer, width, height);
            
            if (canvas) {
                this.layerThumbnailCache.set(cacheKey, canvas);
                console.log(`✓ Layer thumbnail cached: ${cacheKey} (total: ${this.layerThumbnailCache.size})`);
                
                // キャッシュサイズ制限
                if (this.layerThumbnailCache.size > this.maxCacheSize) {
                    const firstKey = this.layerThumbnailCache.keys().next().value;
                    this.layerThumbnailCache.delete(firstKey);
                    console.log(`✓ Evicted cache: ${firstKey}`);
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
                const rt = PIXI.RenderTexture.create({
                    width: width,
                    height: height,
                    resolution: window.devicePixelRatio || 1
                });

                if (!rt) return null;

                this.app.renderer.render({
                    container: layer,
                    target: rt,
                    clear: true
                });

                const canvas = this.app.renderer.extract.canvas(rt);
                rt.destroy(true);

                return canvas;

            } catch (error) {
                console.error('Layer thumbnail generation failed:', error);
                return null;
            }
        }

        /**
         * Phase 3: フレームサムネイル生成
         * 【改修】Canvas2D廃止 → PixiJS RenderTexture使用
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

            // Phase 2: キャッシュキー
            const cacheKey = `frame_${frameId}_${thumbWidth}_${thumbHeight}`;
            
            if (this.frameThumbnailCache.has(cacheKey)) {
                console.log(`✓ Frame thumbnail cache hit: ${cacheKey}`);
                return this.frameThumbnailCache.get(cacheKey);
            }

            try {
                // Phase 3: PixiJS RenderTexture でリサイズ（Canvas2D廃止）
                const thumbCanvas = await this._renderFrameThumbnailPixiJS(
                    frame, 
                    canvasWidth, 
                    canvasHeight, 
                    thumbWidth, 
                    thumbHeight
                );
                
                if (!thumbCanvas) return null;

                this.frameThumbnailCache.set(cacheKey, thumbCanvas);
                console.log(`✓ Frame thumbnail cached: ${cacheKey} (total: ${this.frameThumbnailCache.size})`);
                
                if (this.frameThumbnailCache.size > this.maxCacheSize) {
                    const firstKey = this.frameThumbnailCache.keys().next().value;
                    this.frameThumbnailCache.delete(firstKey);
                    console.log(`✓ Evicted frame cache: ${firstKey}`);
                }

                return thumbCanvas;

            } catch (error) {
                console.error('Frame thumbnail generation failed:', error);
                return null;
            }
        }

        /**
         * Phase 3: PixiJS RenderTexture でフレームサムネイル生成（Canvas2D不使用）
         * 【改修】Canvas2D の ctx.drawImage() を PixiJS RenderTexture に置換
         * 
         * @param {PIXI.Container} frame
         * @param {number} canvasWidth
         * @param {number} canvasHeight
         * @param {number} thumbWidth
         * @param {number} thumbHeight
         * @returns {Promise<HTMLCanvasElement|null>}
         */
        async _renderFrameThumbnailPixiJS(frame, canvasWidth, canvasHeight, thumbWidth, thumbHeight) {
            let fullRT = null;
            let thumbRT = null;
            let tempSprite = null;
            
            try {
                console.log(`🎬 Rendering frame thumbnail: ${canvasWidth}x${canvasHeight} → ${thumbWidth}x${thumbHeight}`);
                
                // 1. フルサイズでレンダリング
                fullRT = this._acquireRenderTexture(canvasWidth, canvasHeight);
                if (!fullRT) {
                    console.error('Failed to acquire full-size RenderTexture');
                    return null;
                }

                this.app.renderer.render({
                    container: frame,
                    target: fullRT,
                    clear: true
                });

                console.log(`✓ Full-size render complete (${fullRT.width}x${fullRT.height})`);

                // 2. リサイズ用RenderTexture作成
                thumbRT = PIXI.RenderTexture.create({
                    width: thumbWidth,
                    height: thumbHeight,
                    resolution: 1
                });

                if (!thumbRT) {
                    console.error('Failed to create thumbnail RenderTexture');
                    this._releaseRenderTexture(fullRT);
                    return null;
                }

                // 3. フルサイズ RenderTexture からスプライト作成
                tempSprite = PIXI.Sprite.from(fullRT);
                
                // 4. アスペクト比を保持したスケール計算
                const scaleX = thumbWidth / canvasWidth;
                const scaleY = thumbHeight / canvasHeight;
                const scale = Math.min(scaleX, scaleY);
                
                console.log(`✓ Scale calculation: x=${scaleX.toFixed(3)}, y=${scaleY.toFixed(3)}, final=${scale.toFixed(3)}`);
                
                tempSprite.scale.set(scale, scale);
                
                // 5. 中央配置
                tempSprite.x = (thumbWidth - canvasWidth * scale) / 2;
                tempSprite.y = (thumbHeight - canvasHeight * scale) / 2;

                // 6. サムネイルサイズでレンダリング（GPU処理）
                this.app.renderer.render({
                    container: tempSprite,
                    target: thumbRT,
                    clear: true
                });

                console.log(`✓ Thumbnail render complete (${thumbRT.width}x${thumbRT.height})`);

                // 7. Canvas取得（GPU → CPU転送）
                const thumbCanvas = this.app.renderer.extract.canvas(thumbRT);

                // 8. クリーンアップ
                tempSprite.destroy();
                this._releaseRenderTexture(fullRT);
                thumbRT.destroy(true);

                console.log(`✓ Thumbnail extracted to Canvas`);

                return thumbCanvas;

            } catch (error) {
                console.error('PixiJS frame thumbnail generation failed:', error);
                
                // エラー時のクリーンアップ
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

        /**
         * Phase 3: RenderTexture 取得（プール再利用）
         * 
         * @param {number} width
         * @param {number} height
         * @returns {PIXI.RenderTexture}
         */
        _acquireRenderTexture(width, height) {
            try {
                // プールから既存の RenderTexture を探す
                for (let i = this.renderTexturePool.length - 1; i >= 0; i--) {
                    const rt = this.renderTexturePool[i];
                    if (rt.width === width && rt.height === height) {
                        this.renderTexturePool.splice(i, 1);
                        this.poolStats.acquired++;
                        console.log(`✓ RenderTexture acquired from pool (size=${this.renderTexturePool.length})`);
                        return rt;
                    }
                }

                // 新規作成
                const newRT = PIXI.RenderTexture.create({
                    width: width,
                    height: height,
                    resolution: window.devicePixelRatio || 1
                });

                this.poolStats.created++;
                console.log(`✓ RenderTexture created (${width}x${height})`);

                return newRT;

            } catch (error) {
                console.error('RenderTexture acquire failed:', error);
                return null;
            }
        }

        /**
         * Phase 3: RenderTexture をプールに戻す
         * 
         * @param {PIXI.RenderTexture} rt
         */
        _releaseRenderTexture(rt) {
            if (!rt) return;

            try {
                if (this.renderTexturePool.length < this.poolMaxSize) {
                    this.renderTexturePool.push(rt);
                    this.poolStats.released++;
                    console.log(`✓ RenderTexture released to pool (size=${this.renderTexturePool.length})`);
                } else {
                    rt.destroy(true);
                    console.log(`✓ RenderTexture destroyed (pool full)`);
                }

            } catch (error) {
                console.error('RenderTexture release failed:', error);
                try {
                    rt.destroy(true);
                } catch (e) {}
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
            
            const keysToDelete = [];
            for (const key of this.layerThumbnailCache.keys()) {
                if (key.startsWith(`layer_`)) {
                    keysToDelete.push(key);
                }
            }
            
            keysToDelete.forEach(key => {
                this.layerThumbnailCache.delete(key);
            });
            
            if (keysToDelete.length > 0) {
                console.log(`✓ Invalidated ${keysToDelete.length} layer cache entries`);
            }
        }

        /**
         * Phase 2: LayerId でレイヤーキャッシュをクリア
         * 
         * @param {string} layerId
         */
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
            
            if (keysToDelete.length > 0) {
                console.log(`✓ Invalidated layer cache for ID: ${layerId} (${keysToDelete.length} entries)`);
            }
        }

        /**
         * Phase 2: FrameId でフレームキャッシュをクリア
         * 
         * @param {string} frameId
         */
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
            
            if (keysToDelete.length > 0) {
                console.log(`✓ Invalidated frame cache for ID: ${frameId} (${keysToDelete.length} entries)`);
            }
        }

        /**
         * 指定フレームのキャッシュをクリア（互換性維持）
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
            
            if (keysToDelete.length > 0) {
                console.log(`✓ Invalidated ${keysToDelete.length} frame cache entries`);
            }
        }

        /**
         * 全キャッシュをクリア
         */
        clearAllCache() {
            const layerCount = this.layerThumbnailCache.size;
            const frameCount = this.frameThumbnailCache.size;
            
            this.layerThumbnailCache.clear();
            this.frameThumbnailCache.clear();
            this.dataURLCache.clear();
            this.pendingVModeRefresh.clear();
            
            console.log(`✓ All caches cleared (layer: ${layerCount}, frame: ${frameCount})`);
        }

        /**
         * デバッグ情報取得
         */
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
                cacheKeyFormat: {
                    layer: 'layer_${layerId}_${width}_${height}',
                    frame: 'frame_${frameId}_${thumbWidth}_${thumbHeight}'
                }
            };
        }

        /**
         * システム破棄時のクリーンアップ
         */
        destroy() {
            this.clearAllCache();
            
            // RenderTexture プールのクリーンアップ
            this.renderTexturePool.forEach(rt => {
                try {
                    rt.destroy(true);
                } catch (e) {}
            });
            
            this.renderTexturePool = [];
            this.isInitialized = false;
            console.log('✓ ThumbnailSystem destroyed');
        }
    }

    // グローバル登録
    window.ThumbnailSystem = new ThumbnailSystem(
        null,
        window.CoordinateSystem,
        window.TEGAKI_CONFIG
    );

    // ========== Phase 3: デバッグコマンド ==========
    window.TegakiDebug = window.TegakiDebug || {};
    
    /**
     * サムネイル更新監視
     */
    window.TegakiDebug.monitorThumbnails = function() {
        console.log('=== Thumbnail Update Monitor Started (Phase 3) ===');
        
        let updateCount = 0;
        let lastUpdate = 0;
        
        window.TegakiEventBus.on('thumbnail:layer-updated', (data) => {
            updateCount++;
            const now = performance.now();
            const delta = lastUpdate ? (now - lastUpdate).toFixed(0) : '-';
            lastUpdate = now;
            
            const action = data.action || '?';
            const immediate = data.data?.immediate ? '⚡' : '';
            
            console.log(`📸 Update #${updateCount} [${action}] ${immediate} (Δ${delta}ms)`);
        });
        
        console.log('✅ Monitor running - check console for updates');
    };
    
    /**
     * キャッシュ状態監視（Phase 3: RenderTexture プール情報付き）
     */
    window.TegakiDebug.inspectThumbnailCache = function() {
        const info = window.ThumbnailSystem?.getDebugInfo();
        console.clear();
        console.log('=== Thumbnail Cache Status (Phase 3) ===');
        console.log(info);
        
        console.log('\n🔧 RenderTexture Pool Status:');
        console.log(`  Current: ${info.renderTexturePool.current}/${info.renderTexturePool.maxSize}`);
        console.log(`  Acquired: ${info.renderTexturePool.stats.acquired}`);
        console.log(`  Released: ${info.renderTexturePool.stats.released}`);
        console.log(`  Created:  ${info.renderTexturePool.stats.created}`);
        console.log(`  Efficiency: ${(info.renderTexturePool.stats.released / (info.renderTexturePool.stats.released + info.renderTexturePool.stats.created) * 100).toFixed(1)}% reused`);
        
        console.log('\n📦 Layer Cache Keys:');
        let count = 0;
        for (const key of window.ThumbnailSystem.layerThumbnailCache.keys()) {
            console.log(`  ${++count}. ${key}`);
        }
        if (count === 0) console.log('  (empty)');
        
        console.log('\n📹 Frame Cache Keys:');
        count = 0;
        for (const key of window.ThumbnailSystem.frameThumbnailCache.keys()) {
            console.log(`  ${++count}. ${key}`);
        }
        if (count === 0) console.log('  (empty)');
        
        if (window.ThumbnailSystem?.pendingVModeRefresh?.size > 0) {
            console.log('\n⏳ Pending Vmode Refresh:');
            for (const layerId of window.ThumbnailSystem.pendingVModeRefresh) {
                console.log(`  - ${layerId}`);
            }
        }
        
        console.log('\n✅ Cache inspection complete');
    };
    
    /**
     * Phase 3: Canvas2D撲滅確認
     */
    window.TegakiDebug.verifyCanvas2DElimination = function() {
        console.log('=== Canvas2D Elimination Verification (Phase 3) ===');
        
        // _renderFrameThumbnailPixiJS メソッドを検査
        const method = window.ThumbnailSystem._renderFrameThumbnailPixiJS.toString();
        
        // 禁止パターン
        const forbiddenPatterns = [
            { pattern: /getContext\s*\(\s*['"]2d['"]\s*\)/, name: 'getContext("2d")' },
            { pattern: /ctx\.drawImage/, name: 'ctx.drawImage()' },
            { pattern: /ctx\.fillRect/, name: 'ctx.fillRect()' },
            { pattern: /ctx\.strokeRect/, name: 'ctx.strokeRect()' }
        ];
        
        console.log('\n🔍 Scanning _renderFrameThumbnailPixiJS():');
        
        let hasViolations = false;
        for (const { pattern, name } of forbiddenPatterns) {
            if (pattern.test(method)) {
                console.log(`  ❌ Found: ${name}`);
                hasViolations = true;
            } else {
                console.log(`  ✅ Not found: ${name}`);
            }
        }
        
        // 必須パターン確認
        const requiredPatterns = [
            { pattern: /PIXI\.RenderTexture\.create/, name: 'PIXI.RenderTexture.create()' },
            { pattern: /this\.app\.renderer\.render/, name: 'renderer.render()' },
            { pattern: /PIXI\.Sprite\.from/, name: 'PIXI.Sprite.from()' },
            { pattern: /_acquireRenderTexture/, name: '_acquireRenderTexture()' },
            { pattern: /_releaseRenderTexture/, name: '_releaseRenderTexture()' }
        ];
        
        console.log('\n✓ Required PixiJS patterns:');
        let allRequired = true;
        for (const { pattern, name } of requiredPatterns) {
            if (pattern.test(method)) {
                console.log(`  ✅ Found: ${name}`);
            } else {
                console.log(`  ❌ Not found: ${name}`);
                allRequired = false;
            }
        }
        
        console.log('\n📊 Result:');
        if (!hasViolations && allRequired) {
            console.log('  ✅ Canvas2D completely eliminated');
            console.log('  ✅ All PixiJS patterns implemented');
        } else {
            console.log('  ⚠️ Some issues detected');
        }
    };
    
    /**
     * Phase 3: RenderTexture プール効率テスト
     */
    window.TegakiDebug.testRenderTexturePool = async function() {
        console.log('=== RenderTexture Pool Efficiency Test (Phase 3) ===');
        
        const animSys = window.CoreRuntime?.internal?.animationSystem;
        if (!animSys || !animSys.animationData?.frames) {
            console.error('Animation system or frames not found');
            return;
        }
        
        const frames = animSys.animationData.frames;
        if (frames.length === 0) {
            console.error('No frames available');
            return;
        }
        
        console.log(`\nTesting with ${frames.length} frames...`);
        
        const initialStats = { ...window.ThumbnailSystem.poolStats };
        console.log('\n📊 Initial stats:', initialStats);
        
        // フレームサムネイル生成
        for (let i = 0; i < Math.min(3, frames.length); i++) {
            console.log(`\n🎬 Generating frame ${i}...`);
            await window.ThumbnailSystem.generateFrameThumbnail(frames[i]);
        }
        
        const finalStats = { ...window.ThumbnailSystem.poolStats };
        console.log('\n📊 Final stats:', finalStats);
        
        const acquired = finalStats.acquired - initialStats.acquired;
        const released = finalStats.released - initialStats.released;
        const created = finalStats.created - initialStats.created;
        
        console.log(`\n📈 Results:`);
        console.log(`  Created:  ${created}`);
        console.log(`  Acquired: ${acquired}`);
        console.log(`  Released: ${released}`);
        
        if (acquired > 0) {
            const reuseRate = (acquired / (acquired + created) * 100).toFixed(1);
            console.log(`  Reuse rate: ${reuseRate}%`);
        }
        
        console.log(`\n✅ Pool efficiency test complete`);
    };
    
    /**
     * 指定レイヤーのサムネイル再生成（手動テスト用）
     */
    window.TegakiDebug.refreshLayerThumbnail = function(layerIndex) {
        const layerMgr = window.CoreRuntime?.internal?.layerManager;
        if (!layerMgr) {
            console.error('LayerManager not found');
            return;
        }
        
        const layers = layerMgr.getLayers();
        if (!layers || !layers[layerIndex]) {
            console.error(`Layer index ${layerIndex} not found`);
            return;
        }
        
        const layer = layers[layerIndex];
        const layerId = layer.layerData?.id;
        
        console.log(`🎬 Manually refreshing layer ${layerIndex} (${layerId})`);
        
        window.ThumbnailSystem._invalidateLayerCacheByLayerId(layerId);
        
        if (window.TegakiEventBus) {
            window.TegakiEventBus.emit('thumbnail:layer-updated', {
                component: 'thumbnail-system',
                action: 'manual-refresh',
                data: { layerIndex, layerId, immediate: true }
            });
        }
    };
    
    /**
     * Phase 2: キャッシュ効率テスト
     */
    window.TegakiDebug.testCacheHitRate = async function() {
        console.log('=== Cache Hit Rate Test ===');
        
        const layerMgr = window.CoreRuntime?.internal?.layerManager;
        if (!layerMgr) {
            console.error('LayerManager not found');
            return;
        }
        
        const layers = layerMgr.getLayers();
        if (!layers || layers.length === 0) {
            console.error('No layers available');
            return;
        }
        
        const layer = layers[0];
        const layerId = layer.layerData?.id;
        console.log(`Testing layer: ${layerId}`);
        
        // キャッシュをクリア
        window.ThumbnailSystem._invalidateLayerCacheByLayerId(layerId);
        console.log('Cache cleared');
        
        // 1回目: キャッシュミス
        console.time('1st generation (cache miss)');
        const result1 = await window.ThumbnailSystem.generateLayerThumbnail(layer, 64, 64);
        console.timeEnd('1st generation (cache miss)');
        console.log(`Cache size after 1st: ${window.ThumbnailSystem.layerThumbnailCache.size}`);
        
        // 2回目: キャッシュヒット期待
        console.time('2nd generation (cache hit expected)');
        const result2 = await window.ThumbnailSystem.generateLayerThumbnail(layer, 64, 64);
        console.timeEnd('2nd generation (cache hit expected)');
        
        // 結果確認
        if (result1 === result2) {
            console.log('✅ PASS: Same canvas returned (cache hit)');
        } else {
            console.log('⚠️ Different canvas returned');
        }
        
        console.log(`\n📊 Final cache state:`);
        console.log(`  Layer cache size: ${window.ThumbnailSystem.layerThumbnailCache.size}`);
        console.log(`  Frame cache size: ${window.ThumbnailSystem.frameThumbnailCache.size}`);
    };
    
    /**
     * Phase 2: キャッシュキー検証
     */
    window.TegakiDebug.validateCacheKeyFormat = function() {
        console.log('=== Cache Key Format Validation (Phase 3) ===');
        
        console.log('\n✓ Layer Cache Keys:');
        let allValid = true;
        const layerKeyRegex = /^layer_[^_]+_\d+_\d+$/;
        
        let count = 0;
        for (const key of window.ThumbnailSystem.layerThumbnailCache.keys()) {
            const isValid = layerKeyRegex.test(key);
            const status = isValid ? '✅' : '❌';
            console.log(`  ${status} ${key}`);
            count++;
            if (!isValid) allValid = false;
        }
        if (count === 0) console.log('  (empty)');
        
        console.log('\n✓ Frame Cache Keys:');
        const frameKeyRegex = /^frame_[^_]+_\d+_\d+$/;
        
        count = 0;
        for (const key of window.ThumbnailSystem.frameThumbnailCache.keys()) {
            const isValid = frameKeyRegex.test(key);
            const status = isValid ? '✅' : '❌';
            console.log(`  ${status} ${key}`);
            count++;
            if (!isValid) allValid = false;
        }
        if (count === 0) console.log('  (empty)');
        
        if (allValid) {
            console.log('\n✅ All cache keys are in correct format');
        } else {
            console.log('\n⚠️ Some cache keys are malformed');
        }
    };

    console.log('✅ system/drawing/thumbnail-system.js (Phase 1-3) loaded');
    console.log('   ✓ Phase 1: Vkey mode events + pendingVModeRefresh');
    console.log('   ✓ Phase 2: Cache key strategy (layerId/frameId + size)');
    console.log('   ✓ Phase 3: Canvas2D eliminated - PixiJS RenderTexture unified');
    console.log('   ✓ RenderTexture pool: max size ' + window.ThumbnailSystem.poolMaxSize);
    console.log('   🔧 Debug: window.TegakiDebug.inspectThumbnailCache()');
    console.log('   🔧 Debug: window.TegakiDebug.monitorThumbnails()');
    console.log('   🔧 Debug: window.TegakiDebug.verifyCanvas2DElimination()');
    console.log('   🔧 Debug: window.TegakiDebug.testRenderTexturePool()');
    console.log('   🔧 Debug: window.TegakiDebug.testCacheHitRate()');
    console.log('   🔧 Debug: window.TegakiDebug.validateCacheKeyFormat()');