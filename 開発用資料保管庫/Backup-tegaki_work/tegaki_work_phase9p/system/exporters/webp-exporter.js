/**
 * ================================================================================
 * system/exporters/webp-exporter.js - 静止画WEBP専用【v8.33.0】
 * ================================================================================
 * 
 * 【依存関係 - Parents】
 *   - system/export-manager.js
 *   - system/animation-system.js (currentFrameContainer取得)
 * 
 * 【依存関係 - Children】
 *   なし
 * 
 * 【責務】
 *   - 静止画WEBP生成のみ
 *   - 独立コンテナ方式によるカメラ干渉の完全排除
 *   - 複数フレーム時はWebMへ自動誘導（export-manager.js側で処理）
 * 
 * 【v8.33.0 改修内容】
 *   🔧 静止画WEBP専用に簡素化
 *   🔧 currentFrameContainerから取得（APNGと同じパターン）
 *   🔧 独立コンテナ方式でカメラ干渉なし
 *   🔧 resolution倍率対応
 *   ⚠️ 複数フレーム時はWebM推奨（アルファ値維持・軽量）
 * 
 * 【設計原則】
 *   - Canvas.toBlob('image/webp') を直接使用
 *   - ブラウザネイティブAPI のみ（外部ライブラリ不要）
 * 
 * ================================================================================
 */

import * as PIXI from 'pixi.js';

window.WEBPExporter = (function() {
    'use strict';
    
    class WEBPExporter {
        constructor(exportManager) {
            if (!exportManager) {
                throw new Error('WEBPExporter: exportManager is required');
            }
            this.manager = exportManager;
            this.isExporting = false;
        }
        
        /**
         * エクスポート実行
         */
        async export(options = {}) {
            if (this.isExporting) {
                throw new Error('Export already in progress');
            }
            
            if (!this.manager?.animationSystem) {
                throw new Error('AnimationSystem not available');
            }
            
            if (window.TegakiEventBus) {
                window.TegakiEventBus.emit('export:started', { format: 'webp' });
            }
            
            this.isExporting = true;
            
            try {
                const blob = await this.generateBlob(options);
                
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
                const filename = options.filename || `tegaki_${timestamp}.webp`;
                
                this.manager.downloadFile(blob, filename);
                
                if (window.TegakiEventBus) {
                    window.TegakiEventBus.emit('export:completed', {
                        format: 'webp',
                        size: blob.size,
                        filename: filename
                    });
                }
                
                return { blob, filename, format: 'webp' };
            } catch (error) {
                if (window.TegakiEventBus) {
                    window.TegakiEventBus.emit('export:failed', { 
                        format: 'webp',
                        error: error.message
                    });
                }
                throw error;
            } finally {
                this.isExporting = false;
            }
        }
        
        /**
         * 静止画WEBP Blob生成【v8.33.0 独立コンテナ方式】
         */
        async generateBlob(options = {}) {
            const CONFIG = window.TEGAKI_CONFIG;
            const resolution = options.resolution || 2;
            const quality = options.quality !== undefined ? options.quality / 100 : 0.9;
            
            const settings = {
                width: CONFIG.canvas.width * resolution,
                height: CONFIG.canvas.height * resolution,
                resolution: resolution
            };
            
            // 独立コンテナ方式でレンダリング
            const canvas = await this._renderToCanvas(settings);
            
            // WEBP変換（ブラウザネイティブAPI）
            const blob = await new Promise((resolve, reject) => {
                canvas.toBlob(
                    blob => {
                        if (!blob || blob.size === 0) {
                            reject(new Error('WEBP Blob生成に失敗しました'));
                        } else {
                            resolve(blob);
                        }
                    },
                    'image/webp',
                    quality
                );
            });
            
            return blob;
        }
        
        /**
         * Canvasへのレンダリング【v8.33.0 独立コンテナ方式 + resolution対応】
         */
        async _renderToCanvas(settings) {
            const CONFIG = window.TEGAKI_CONFIG;
            
            // RenderTexture作成
            const renderTexture = PIXI.RenderTexture.create({
                width: settings.width,
                height: settings.height,
                resolution: 1
            });
            
            // 独立した一時コンテナ
            const tempContainer = new PIXI.Container();
            
            // currentFrameContainerを取得
            const layersContainer = this.manager.animationSystem.layerSystem.currentFrameContainer;
            if (!layersContainer) {
                throw new Error('currentFrameContainer not found');
            }
            
            // 元の親と座標・スケールを保存
            const originalParent = layersContainer.parent;
            const originalState = {
                x: layersContainer.x,
                y: layersContainer.y,
                scaleX: layersContainer.scale.x,
                scaleY: layersContainer.scale.y
            };
            
            try {
                // 親から一時的に切り離し
                if (originalParent) {
                    originalParent.removeChild(layersContainer);
                }
                
                // 独立コンテナに追加
                tempContainer.addChild(layersContainer);
                layersContainer.position.set(0, 0);
                
                // resolution倍率対応（スケール調整）
                if (settings.resolution !== 1) {
                    layersContainer.scale.set(settings.resolution, settings.resolution);
                }
                
                // レンダリング実行
                this.manager.app.renderer.render({
                    container: tempContainer,
                    target: renderTexture
                });
                
                // Canvas抽出
                let canvas;
                const result = this.manager.app.renderer.extract.canvas(renderTexture);
                if (result instanceof Promise) {
                    canvas = await result;
                } else {
                    canvas = result;
                }
                
                if (!canvas) {
                    throw new Error('Canvas extraction failed');
                }
                
                return canvas;
                
            } finally {
                // 完全復元: 独立コンテナから切り離し
                tempContainer.removeChild(layersContainer);
                
                // 元の座標・スケールに戻す
                layersContainer.position.set(originalState.x, originalState.y);
                layersContainer.scale.set(originalState.scaleX, originalState.scaleY);
                
                // 元の親に戻す
                if (originalParent) {
                    originalParent.addChild(layersContainer);
                }
                
                // クリーンアップ
                renderTexture.destroy(true);
                tempContainer.destroy({ children: true });
            }
        }
        
        /**
         * プレビュー生成（軽量版）
         */
        async generatePreview(options = {}) {
            const previewOptions = {
                ...options,
                resolution: options.resolution || 1,
                quality: 80
            };
            
            try {
                const blob = await this.generateBlob(previewOptions);
                
                if (!blob || blob.size === 0) {
                    throw new Error('プレビュー生成に失敗しました');
                }
                
                return blob;
                
            } catch (error) {
                console.error('WEBP Preview generation error:', error);
                throw new Error(`WEBPプレビュー生成エラー: ${error.message}`);
            }
        }
        
        /**
         * 旧メソッド名（後方互換）
         */
        async generateStaticWebP(options = {}) {
            return await this.generateBlob(options);
        }
    }
    
    return WEBPExporter;
})();

console.log('✅ webp-exporter.js v8.33.0 loaded (静止画WEBP専用)');
console.log('   ⚠️ 複数フレーム時はWebM推奨（アルファ値維持・軽量）');
