/**
 * ============================================================
 * thumbnail-system.js - Phase 3.5: ラスター対応版
 * ============================================================
 * 【役割】
 * - レイヤーサムネイル生成
 * - gl.readPixels() ベース実装
 * 
 * 【親依存】
 * - webgl2-drawing-layer.js
 * - raster-layer.js
 * - layer-system.js
 * 
 * 【Phase 3.5改修内容】
 * ✅ ベクターレンダリング削除
 * ✅ gl.readPixels() ベース実装
 * ✅ RasterLayer.generateThumbnail() 使用
 * ============================================================
 */

(function() {
    'use strict';

    class ThumbnailSystem {
        constructor() {
            this.config = window.TEGAKI_CONFIG?.thumbnail || {
                SIZE: 48,
                RENDER_SCALE: 3,
                QUALITY: 'high'
            };
            
            this.pendingUpdates = new Set();
            this.updateTimer = null;
            this.updateDelay = 100; // ms
            
            this.webgl2Layer = null;
            this.rasterLayer = null;
        }

        /**
         * 初期化
         */
        initialize() {
            this.webgl2Layer = window.WebGL2DrawingLayer;
            this.rasterLayer = window.RasterLayer;
            
            if (!this.webgl2Layer) {
                console.error('[ThumbnailSystem] window.WebGL2DrawingLayer not found');
                return false;
            }
            
            if (!this.rasterLayer) {
                console.error('[ThumbnailSystem] window.RasterLayer not found');
                return false;
            }
            
            console.log('✅ [ThumbnailSystem] Initialized (Raster mode)');
            return true;
        }

        /**
         * サムネイル生成要求
         * @param {number} layerIndex 
         * @param {boolean} immediate - 即座に生成
         */
        requestUpdate(layerIndex, immediate = false) {
            if (immediate) {
                this.generateThumbnail(layerIndex);
            } else {
                this.pendingUpdates.add(layerIndex);
                this._scheduleUpdate();
            }
        }

        /**
         * 更新スケジュール
         */
        _scheduleUpdate() {
            if (this.updateTimer) {
                clearTimeout(this.updateTimer);
            }
            
            this.updateTimer = setTimeout(() => {
                this._processPendingUpdates();
            }, this.updateDelay);
        }

        /**
         * 保留中の更新を処理
         */
        _processPendingUpdates() {
            for (const layerIndex of this.pendingUpdates) {
                this.generateThumbnail(layerIndex);
            }
            
            this.pendingUpdates.clear();
            this.updateTimer = null;
        }

        /**
         * サムネイル生成（メイン処理）
         * @param {number} layerIndex 
         * @returns {HTMLCanvasElement|null}
         */
        generateThumbnail(layerIndex) {
            const layerManager = window.layerManager;
            if (!layerManager) {
                console.error('[ThumbnailSystem] layerManager not found');
                return null;
            }
            
            const layer = layerManager.getLayer(layerIndex);
            if (!layer || !layer.layerData) {
                console.warn('[ThumbnailSystem] Layer not found:', layerIndex);
                return null;
            }
            
            const layerId = layer.layerData.id;
            const thumbnailSize = this.config.SIZE;
            
            // RasterLayerからサムネイル生成
            const thumbnail = this.rasterLayer.generateThumbnail(layerId, thumbnailSize);
            
            if (!thumbnail) {
                console.warn('[ThumbnailSystem] Thumbnail generation failed:', layerId);
                return null;
            }
            
            // レイヤーデータに保存
            layer.layerData.thumbnail = thumbnail;
            
            // イベント発行
            if (window.TegakiEventBus) {
                window.TegakiEventBus.emit('thumbnail:generated', {
                    layerIndex: layerIndex,
                    layerId: layerId,
                    thumbnail: thumbnail
                });
            }
            
            return thumbnail;
        }

        /**
         * 全レイヤーのサムネイル生成
         */
        generateAll() {
            const layerManager = window.layerManager;
            if (!layerManager) return;
            
            const layers = layerManager.getLayers();
            
            for (let i = 0; i < layers.length; i++) {
                this.generateThumbnail(i);
            }
            
            console.log(`✅ [ThumbnailSystem] Generated ${layers.length} thumbnails`);
        }

        /**
         * サムネイルをDataURLとして取得
         * @param {number} layerIndex 
         * @returns {string|null}
         */
        getThumbnailDataURL(layerIndex) {
            const layerManager = window.layerManager;
            if (!layerManager) return null;
            
            const layer = layerManager.getLayer(layerIndex);
            if (!layer || !layer.layerData) return null;
            
            const thumbnail = layer.layerData.thumbnail;
            if (!thumbnail) {
                // サムネイルがない場合は生成
                const generated = this.generateThumbnail(layerIndex);
                if (!generated) return null;
                return generated.toDataURL('image/png');
            }
            
            return thumbnail.toDataURL('image/png');
        }

        /**
         * サムネイルをBlobとして取得
         * @param {number} layerIndex 
         * @returns {Promise<Blob|null>}
         */
        async getThumbnailBlob(layerIndex) {
            const layerManager = window.layerManager;
            if (!layerManager) return null;
            
            const layer = layerManager.getLayer(layerIndex);
            if (!layer || !layer.layerData) return null;
            
            const thumbnail = layer.layerData.thumbnail;
            if (!thumbnail) {
                const generated = this.generateThumbnail(layerIndex);
                if (!generated) return null;
                
                return new Promise((resolve) => {
                    generated.toBlob((blob) => resolve(blob), 'image/png');
                });
            }
            
            return new Promise((resolve) => {
                thumbnail.toBlob((blob) => resolve(blob), 'image/png');
            });
        }

        /**
         * キャッシュクリア
         * @param {number} layerIndex - 指定しない場合は全クリア
         */
        clearCache(layerIndex = null) {
            const layerManager = window.layerManager;
            if (!layerManager) return;
            
            if (layerIndex !== null) {
                const layer = layerManager.getLayer(layerIndex);
                if (layer && layer.layerData) {
                    delete layer.layerData.thumbnail;
                }
            } else {
                const layers = layerManager.getLayers();
                for (const layer of layers) {
                    if (layer.layerData) {
                        delete layer.layerData.thumbnail;
                    }
                }
            }
            
            console.log('🗑️ [ThumbnailSystem] Cache cleared');
        }

        /**
         * サムネイル品質設定
         * @param {string} quality - 'low' | 'medium' | 'high'
         */
        setQuality(quality) {
            const validQualities = ['low', 'medium', 'high'];
            if (!validQualities.includes(quality)) {
                console.error('[ThumbnailSystem] Invalid quality:', quality);
                return;
            }
            
            this.config.QUALITY = quality;
            
            // サイズ調整
            switch (quality) {
                case 'low':
                    this.config.RENDER_SCALE = 1;
                    break;
                case 'medium':
                    this.config.RENDER_SCALE = 2;
                    break;
                case 'high':
                    this.config.RENDER_SCALE = 3;
                    break;
            }
            
            console.log(`🎨 [ThumbnailSystem] Quality set to: ${quality}`);
        }
    }

    // グローバル公開
    window.ThumbnailSystem = new ThumbnailSystem();
    
    // 自動初期化
    if (window.WebGL2DrawingLayer && window.RasterLayer) {
        window.ThumbnailSystem.initialize();
    }
    
    console.log('✅ thumbnail-system.js Phase 3.5 loaded (ラスター対応版)');
    console.log('   ✅ gl.readPixels() ベース実装');
    console.log('   ✅ RasterLayer統合');

})();