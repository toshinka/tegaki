/**
 * ================================================================================
 * system/exporters/png-exporter.js - 独立コンテナ方式【v8.26.0】
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
 * 
 * 【v8.26.0 重要改修】
 *   🔧 カメラ操作を完全排除 - 独立したtempContainerを使用
 *   🔧 worldContainerを一切触らない実装に変更
 *   🔧 レイヤーをクローンして独立コンテナで描画
 *   🔧 Drawing_169の安定性とDrawing_185の機能を統合
 * 
 * 【設計原則】
 *   - カメラ(worldContainer)とは完全に独立
 *   - tempContainerは使い捨て
 *   - カメラ状態のバックアップ/復元は不要
 * 
 * ================================================================================
 */

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
            const animData = this.manager.animationSystem?.getAnimationData?.();
            const frameCount = animData?.frames?.length || 0;
            return frameCount >= 2;
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
                
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
                const filename = options.filename || `tegaki_${timestamp}.png`;
                
                this.manager.downloadFile(blob, filename);
                
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
            container.alpha = layer.opacity / 100;
            
            if (layer.children) {
                for (const child of layer.children) {
                    try {
                        if (child instanceof PIXI.Graphics) {
                            const clone = child.clone ? child.clone() : child;
                            container.addChild(clone);
                        } else if (child instanceof PIXI.Mesh) {
                            const clone = child.clone ? child.clone() : child;
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
            
            // 独立したコンテナを作成（カメラとは無関係）
            const tempContainer = new PIXI.Container();
            
            try {
                // 背景（透明でない場合）
                if (!options.transparent) {
                    const bg = new PIXI.Graphics();
                    bg.rect(0, 0, canvasWidth, canvasHeight);
                    bg.fill(0xFFFFFF);
                    tempContainer.addChild(bg);
                }
                
                // レイヤーをコピー
                const layerManager = this.manager.layerSystem;
                const visibleLayers = layerManager.getAllLayers()
                    .filter(layer => layer.visible)
                    .sort((a, b) => a.zIndex - b.zIndex);
                
                for (const layer of visibleLayers) {
                    const layerCopy = this._cloneLayerForExport(layer);
                    tempContainer.addChild(layerCopy);
                }
                
                // フレーム待機
                await this._waitFrame();
                
                // extract（tempContainerは独立しているためカメラ影響なし）
                const extractedCanvas = this.manager.app.renderer.extract.canvas({
                    target: tempContainer,
                    resolution: resolution,
                    antialias: true
                });
                
                // 最終Canvas作成
                const finalCanvas = document.createElement('canvas');
                finalCanvas.width = canvasWidth * resolution;
                finalCanvas.height = canvasHeight * resolution;
                const ctx = finalCanvas.getContext('2d', { alpha: true });
                
                ctx.clearRect(0, 0, finalCanvas.width, finalCanvas.height);
                ctx.drawImage(extractedCanvas, 0, 0);
                
                return new Promise((resolve, reject) => {
                    finalCanvas.toBlob((blob) => {
                        if (!blob) {
                            reject(new Error('PNG generation failed'));
                            return;
                        }
                        resolve(blob);
                    }, 'image/png');
                });
            } finally {
                // クリーンアップ
                tempContainer.destroy({ children: true });
            }
        }
    }
    
    return PNGExporter;
})();

console.log('✅ png-exporter.js v8.26.0 loaded');
console.log('   🔧 カメラ操作を完全排除（独立コンテナ方式）');
console.log('   🔧 worldContainerとの干渉をゼロに');
console.log('   🔧 カメラ枠ズレを根本解決');