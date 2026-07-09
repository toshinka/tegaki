/**
 * ================================================================================
 * system/exporters/png-exporter.js - プレビュー生成強化【v8.29.0】
 * ================================================================================
 * 
 * 【依存関係 - Parents】
 *   - system/export-manager.js (エクスポート管理)
 *   - system/layer-system.js (レイヤー情報)
 * 
 * 【依存関係 - Children】
 *   - system/exporters/apng-exporter.js (複数フレーム時)
 * 
 * 【責務】
 *   - PNG静止画エクスポート
 *   - 複数フレーム時はAPNGへ委譲
 *   - プレビュー生成の確実性保証
 * 
 * 【v8.29.0 改修内容】
 *   🔧 generatePreview()メソッド追加
 *   🔧 エラーハンドリング強化
 *   🔧 Blob生成の確実性向上
 * 
 * 【設計原則】
 *   - カメラ(worldContainer)とは完全に独立
 *   - tempContainerは使い捨て
 *   - カメラ状態のバックアップ/復元は不要
 * 
 * ================================================================================
 */

import * as PIXI from 'pixi.js';

window.PNGExporter = (function() {
    'use strict';
    
    class PNGExporter {
        constructor(exportManager) {
            if (!exportManager) {
                throw new Error('PNGExporter: exportManager is required');
            }
            this.manager = exportManager;
        }
        
        /**
         * APNG自動切替判定
         */
        _shouldUseAPNG() {
            return this.manager.getFrameCount?.() >= 2;
        }
        
        /**
         * エクスポート実行
         */
        async export(options = {}) {
            if (!this.manager?.layerSystem) {
                throw new Error('LayerSystem not available');
            }
            
            // 複数フレーム時はAPNG委譲
            if (this._shouldUseAPNG()) {
                const apngExporter = this.manager.exporters['apng'];
                if (apngExporter) {
                    return await apngExporter.export(options);
                }
            }
            
            if (window.TegakiEventBus) {
                window.TegakiEventBus.emit('export:started', { format: 'png' });
            }
            
            try {
                const blob = await this.generateBlob(options);
                
                if (!blob || blob.size === 0) {
                    throw new Error('PNG生成に失敗しました（空のBlobが生成されました）');
                }
                
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
                const filename = options.filename || `tegaki_${timestamp}.png`;
                
                if (!options.skipDownload) {
                    this.manager.downloadFile(blob, filename);
                }
                
                if (window.TegakiEventBus) {
                    window.TegakiEventBus.emit('export:completed', { 
                        format: 'png', 
                        size: blob.size,
                        filename: filename
                    });
                }
                
                return { blob, filename, format: 'png' };
            } catch (error) {
                if (window.TegakiEventBus) {
                    window.TegakiEventBus.emit('export:failed', { 
                        format: 'png', 
                        error: error.message 
                    });
                }
                throw error;
            }
        }
        
        /**
         * プレビュー生成
         * v8.29.0追加
         */
        async generatePreview(options = {}) {
            // 複数フレーム時はAPNG委譲
            if (this._shouldUseAPNG()) {
                const apngExporter = this.manager.exporters['apng'];
                if (apngExporter && apngExporter.generatePreview) {
                    return await apngExporter.generatePreview(options);
                }
            }
            
            // プレビュー用の低解像度設定
            const previewOptions = {
                ...options,
                resolution: options.resolution || 1,
                transparent: options.transparent !== undefined ? options.transparent : true
            };
            
            try {
                const blob = await this.generateBlob(previewOptions);
                
                if (!blob || blob.size === 0) {
                    throw new Error('プレビュー生成に失敗しました');
                }
                
                return blob;
            } catch (error) {
                console.error('PNG Preview generation error:', error);
                throw new Error(`PNGプレビュー生成エラー: ${error.message}`);
            }
        }
        
        /**
         * フレーム待機
         */
        async _waitFrame() {
            return new Promise(resolve => requestAnimationFrame(resolve));
        }
        
        /**
         * レイヤーをクローン（独立コンテナ用）
         */
        _cloneLayerForExport(layer) {
            const container = new PIXI.Container();
            container.alpha = (layer.layerData?.opacity !== undefined) ? layer.layerData.opacity : (layer.alpha !== undefined ? layer.alpha : 1);
            
            if (layer.children) {
                for (const child of layer.children) {
                    try {
                        if (child instanceof PIXI.Graphics) {
                            const clone = child.clone ? child.clone() : child;
                            container.addChild(clone);
                        } else if (child instanceof PIXI.Mesh) {
                            const clone = child.clone ? child.clone() : child;
                            container.addChild(clone);
                        } else if (child instanceof PIXI.Sprite) {
                            // 🆕 Raster Sprite (RenderTexture) 対応
                            const clone = new PIXI.Sprite(child.texture);
                            clone.position.copyFrom(child.position);
                            clone.scale.copyFrom(child.scale);
                            clone.rotation = child.rotation;
                            clone.pivot.copyFrom(child.pivot);
                            clone.anchor.copyFrom(child.anchor);
                            clone.alpha = child.alpha;
                            clone.blendMode = child.blendMode;
                            container.addChild(clone);
                        }
                    } catch (error) {
                        console.warn('Layer clone failed:', error);
                    }
                }
            }
            
            return container;
        }
        
        /**
         * PNG Blob生成【v8.26.0 独立コンテナ方式】
         * 
         * カメラ(worldContainer)を一切触らず、
         * 独立したtempContainerで描画することで
         * カメラ枠のズレを完全に防止
         */
        async generateBlob(options = {}) {
            const CONFIG = window.TEGAKI_CONFIG;
            const resolution = options.resolution || 1;
            const canvasWidth = CONFIG.canvas.width;
            const canvasHeight = CONFIG.canvas.height;

            try {
                // フレーム待機
                await this._waitFrame();

                const exportedCanvas = this.manager.renderToCanvas({
                    width: canvasWidth,
                    height: canvasHeight,
                    resolution,
                    transparent: options.transparent === true
                });

                if (!exportedCanvas) {
                    throw new Error('Canvas抽出に失敗しました');
                }

                return new Promise((resolve, reject) => {
                    exportedCanvas.toBlob((blob) => {
                        if (!blob) {
                            reject(new Error('PNG Blob生成に失敗しました'));
                            return;
                        }
                        resolve(blob);
                    }, 'image/png');
                });
            } catch (error) {
                console.error('PNG generation error:', error);
                throw error;
            }
        }
    }
    
    return PNGExporter;
})();

console.log('✅ png-exporter.js v8.29.0 loaded');
console.log('   🔧 generatePreview()メソッド追加');
console.log('   🔧 エラーハンドリング強化');
console.log('   🔧 Blob生成の確実性向上');
