// ===== system/drawing/thumbnail-system.js - Phase 1-3完全版 =====
// Phase 1: Vモード終了時のキャッシュ再生成
// Phase 2: キャッシュキー戦略変更（layerIdのみ）
// Phase 3: Canvas2D完全撲滅（PixiJS RenderTexture使用）
// Phase 5: デバッグコマンド追加

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
            this.disableCacheDuringVMode = false; // Phase 1: Vモード中もキャッシュ有効化
            
            this.eventBus = null;
            this.isInitialized = false;
            this.vKeyModeActive = false;
            
            // RenderTexture の再利用プール
            this.renderTexturePool = [];
            this.poolMaxSize = 10;
            
            // throttle 用タイマー
            this.thumbnailUpdateTimer = null;
            
            // Phase 1: Vモード終了時の再生成待ちリスト
            this.pendingVModeRefresh = new Set();
        }

        init(eventBus) {
            if (this.isInitialized) return;
            
            this.eventBus = eventBus || window.TegakiEventBus;
            
            if (this.eventBus) {
                this._setupEventListeners();
            }
            
            this.isInitialized = true;
            console.log('✅ ThumbnailSystem initialized (Phase 1-3)');
        }

        _setupEventListeners() {
            // Phase 1: Vキーモード検知と再生成
            this.eventBus.on('keyboard:vkey-pressed', () => {
                this.vKeyModeActive = true;
            });
            
            this.eventBus.on('keyboard:vkey-released', () => {
                this.vKeyModeActive = false;
                
                // Phase 1: Vモード終了時に全レイヤーサムネイル再生成
                this._refreshAllLayerThumbnailsAfterVMode();
            });
            
            // レイヤー変形時のサムネイル更新
            this.eventBus.on('layer:transform-updated', ({ data }) => {
                const { layerId, layerIndex } = data || {};
                
                if (layerId) {
                    // Phase 2: layerIdでキャッシュ無効化
                    this._invalidateLayerCacheByLayerId(layerId);
                    
                    // Phase 1: Vモード中は待機リストに追加
                    if (this.vKeyModeActive) {
                        this.pendingVModeRefresh.add(layerId);
                        return;
                    }
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

        // Phase 1: Vモード終了時の全レイヤーサムネイル再生成
        async _refreshAllLayerThumbnailsAfterVMode() {
            if (this.pendingVModeRefresh.size === 0) return;
            
            const layerMgr = window.CoreRuntime?.internal?.layerManager;
            if (!layerMgr) return;
            
            const layers = layerMgr.getLayers();
            
            // 待機リストのレイヤーIDを配列化
            const layerIdsToRefresh = Array.from(this.pendingVModeRefresh);
            this.pendingVModeRefresh.clear();
            
            // 各レイヤーのサムネイルを再生成
            for (const layerId of layerIdsToRefresh) {
                const layerIndex = layers.findIndex(l => l.layerData?.id === layerId);
                
                if (layerIndex >= 0) {
                    // キャッシュクリア
                    this._invalidateLayerCacheByLayerId(layerId);
                    
                    // 即座更新トリガー
                    this.eventBus.emit('thumbnail:layer-updated', {
                        component: 'thumbnail-system',
                        action: 'vmode-exit-refresh',
                        data: { layerIndex, layerId, immediate: true }
                    });
                }
                
                // 次のレイヤーまで少し待機（負荷分散）
                await new Promise(resolve => setTimeout(resolve, 10));
            }
        }

        /**
         * レイヤーサムネイル生成
         * Phase 2: キャッシュキーを layerId のみに変更
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

            // Phase 2: キャッシュキーを layerId + サイズのみに変更
            const layerId = layer.layerData?.id || layer.label;
            const cacheKey = `layer_${layerId}_${width}_${height}`;
            
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
         * Phase 3: Canvas2D不使用（PixiJS extract.canvas()のみ）
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

                // GPU → Canvas（PixiJS内部処理のみ）
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
         * Phase 3: Canvas2D撲滅（PixiJS RenderTextureでリサイズ）
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
            
            // config.canvas から取得
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

            // Phase 2: キャッシュキーを frameId + サイズのみに変更
            const cacheKey = `frame_${frameId}_${thumbWidth}_${thumbHeight}`;
            
            if (this.frameThumbnailCache.has(cacheKey)) {
                return this.frameThumbnailCache.get(cacheKey);
            }

            try {
                // Phase 3: PixiJS RenderTextureでリサイズ（Canvas2D不使用）
                const thumbCanvas = await this._renderFrameThumbnailPixiJS(
                    frame, 
                    canvasWidth, 
                    canvasHeight, 
                    thumbWidth, 
                    thumbHeight
                );
                
                if (!thumbCanvas) return null;

                // キャッシュに保存
                this.frameThumbnailCache.set(cacheKey, thumbCanvas);
                
                // キャッシュサイズ制限
                if (this.frameThumbnailCache.size > this.maxCacheSize) {
                    const firstKey = this.frameThumbnailCache.keys().next().value;
                    this.frameThumbnailCache.delete(firstKey);
                }

                return thumbCanvas;

            } catch (error) {
                console.error('Frame thumbnail generation failed:', error);
                return null;
            }
        }

        /**
         * Phase 3: PixiJS RenderTextureでフレームサムネイル生成（Canvas2D不使用）
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
                // 1. フルサイズでレンダリング
                fullRT = this._acquireRenderTexture(canvasWidth, canvasHeight);
                if (!fullRT) return null;

                this.app.renderer.render({
                    container: frame,
                    target: fullRT,
                    clear: true
                });

                // 2. リサイズ用RenderTexture作成
                thumbRT = PIXI.RenderTexture.create({
                    width: thumbWidth,
                    height: thumbHeight,
                    resolution: 1
                });

                // 3. スプライト作成とスケール設定
                tempSprite = PIXI.Sprite.from(fullRT);
                
                // アスペクト比を保持したスケール計算
                const scaleX = thumbWidth / canvasWidth;
                const scaleY = thumbHeight / canvasHeight;
                const scale = Math.min(scaleX, scaleY);
                
                tempSprite.scale.set(scale, scale);
                
                // 中央配置
                tempSprite.x = (thumbWidth - canvasWidth * scale) / 2;
                tempSprite.y = (thumbHeight - canvasHeight * scale) / 2;

                // 4. サムネイルサイズでレンダリング
                this.app.renderer.render({
                    container: tempSprite,
                    target: thumbRT,
                    clear: true
                });

                // 5. Canvas取得
                const thumbCanvas = this.app.renderer.extract.canvas(thumbRT);

                // 6. クリーンアップ
                tempSprite.destroy();
                this._releaseRenderTexture(fullRT);
                thumbRT.destroy(true);

                return thumbCanvas;

            } catch (error) {
                console.error('PixiJS frame thumbnail generation failed:', error);
                
                // クリーンアップ
                if (tempSprite) tempSprite.destroy();
                if (fullRT) this._releaseRenderTexture(fullRT);
                if (thumbRT) thumbRT.destroy(true);
                
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
            
            // 全レイヤーキャッシュをクリア（Phase 2でキャッシュキーが変わったため）
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
         * Phase 2: layerIdベースのキャッシュキーに対応
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
            this.pendingVModeRefresh.clear();
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
                disableCacheDuringVMode: this.disableCacheDuringVMode,
                pendingVModeRefreshCount: this.pendingVModeRefresh.size
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

    // ========== Phase 5: デバッグコマンド ==========
    window.TegakiDebug = window.TegakiDebug || {};
    
    // サムネイル更新監視
    window.TegakiDebug.monitorThumbnails = function() {
        console.log('=== Thumbnail Update Monitor Started ===');
        
        let updateCount = 0;
        let lastUpdate = 0;
        
        window.TegakiEventBus.on('thumbnail:layer-updated', (data) => {
            updateCount++;
            const now = performance.now();
            const delta = lastUpdate ? (now - lastUpdate).toFixed(0) : '-';
            lastUpdate = now;
            
            console.log(`📸 Thumbnail Update #${updateCount} (Δ${delta}ms)`, data);
        });
        
        window.TegakiEventBus.on('layer:transform-updated', (data) => {
            console.log(`🔄 Transform Updated`, data);
        });
    };
    
    // キャッシュ状態監視
    window.TegakiDebug.inspectThumbnailCache = function() {
        const info = window.ThumbnailSystem?.getDebugInfo();
        console.log('=== Thumbnail Cache Status ===');
        console.log(info);
        
        // キャッシュキーの一覧
        if (window.ThumbnailSystem?.layerThumbnailCache) {
            console.log('Layer Cache Keys:');
            for (const key of window.ThumbnailSystem.layerThumbnailCache.keys()) {
                console.log(`  - ${key}`);
            }
        }
        
        if (window.ThumbnailSystem?.frameThumbnailCache) {
            console.log('Frame Cache Keys:');
            for (const key of window.ThumbnailSystem.frameThumbnailCache.keys()) {
                console.log(`  - ${key}`);
            }
        }
    };
    
    // 強制全サムネイル再生成
    window.TegakiDebug.regenerateAllThumbnails = async function() {
        console.log('=== Regenerating All Thumbnails ===');
        
        // キャッシュクリア
        if (window.ThumbnailSystem) {
            window.ThumbnailSystem.clearAllCache();
        }
        
        // レイヤーパネル更新
        const layerPanel = window.CoreRuntime?.internal?.layerPanelRenderer;
        if (layerPanel) {
            await layerPanel.updateAllThumbnails();
        }
        
        // タイムライン更新
        const animSys = window.CoreRuntime?.internal?.animationSystem;
        if (animSys?.regenerateAllThumbnails) {
            await animSys.regenerateAllThumbnails();
        }
        
        console.log('✅ All thumbnails regenerated');
    };

    console.log('✅ system/drawing/thumbnail-system.js (Phase 1-3完全版) loaded');
    console.log('   - Phase 1: Vモード終了時のキャッシュ再生成');
    console.log('   - Phase 2: キャッシュキー戦略変更（layerId/frameIdのみ）');
    console.log('   - Phase 3: Canvas2D完全撲滅（PixiJS RenderTexture使用）');
    console.log('   - Debug: window.TegakiDebug.monitorThumbnails()');
    console.log('   - Debug: window.TegakiDebug.inspectThumbnailCache()');
    console.log('   - Debug: window.TegakiDebug.regenerateAllThumbnails()');

})();