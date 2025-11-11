/**
 * ================================================================================
 * system/exporters/png-exporter.js - 座標系保護・外枠除外【v8.20.0】
 * ================================================================================
 * 
 * 【依存関係 - Parents】
 *   - system/export-manager.js (エクスポート管理)
 *   - system/camera-system.js (worldContainer取得)
 *   - system/layer-system.js (レイヤー情報)
 * 
 * 【依存関係 - Children】
 *   - system/exporters/apng-exporter.js (複数フレーム時)
 * 
 * 【責務】
 *   - PNG静止画エクスポート
 *   - 複数フレーム時はAPNGへ委譲
 * 
 * 【v8.20.0 重要改修 - 座標系保護】
 *   🔧 renderer.resolutionを変更しない（座標系破壊の原因）
 *   🔧 RenderTextureのresolutionパラメータで倍率対応
 *   🔧 エクスポート後のカメラフレーム崩壊を完全防止
 *   🔧 canvasContainerのみキャプチャ（外枠除外）
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
        
        _shouldUseAPNG() {
            const animData = this.manager.animationSystem?.getAnimationData?.();
            const frameCount = animData?.frames?.length || 0;
            return frameCount >= 2;
        }
        
        async export(options = {}) {
            if (!this.manager?.layerSystem) {
                throw new Error('LayerSystem not available');
            }
            
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
         * PNG Blob生成【v8.20.0 座標系保護版】
         * 
         * 重要な改修:
         * 1. renderer.resolutionは絶対に変更しない
         * 2. RenderTextureのresolutionパラメータで倍率を実現
         * 3. カメラ座標系を一切破壊しない
         */
        async generateBlob(options = {}) {
            const CONFIG = window.TEGAKI_CONFIG;
            const resolution = options.resolution || 1;
            const canvasWidth = CONFIG.canvas.width;
            const canvasHeight = CONFIG.canvas.height;
            
            // canvasContainerのみをキャプチャ（外枠除外）
            const canvasContainer = this.manager.cameraSystem?.canvasContainer ||
                                  this.manager.layerSystem.worldContainer?.children?.find(c => c.label === 'canvasContainer');
            
            if (!canvasContainer) {
                throw new Error('canvasContainer not available');
            }
            
            // 🔧 v8.20.0: 座標系を破壊しないためにrenderer.resolutionは触らない
            // RenderTextureのresolutionパラメータで倍率を実現
            const renderTexture = PIXI.RenderTexture.create({
                width: canvasWidth * resolution,
                height: canvasHeight * resolution,
                resolution: resolution,  // ここで倍率を指定
                antialias: true
            });
            
            try {
                // 通常レンダリング（renderer.resolutionは変更しない）
                this.manager.app.renderer.render({
                    container: canvasContainer,
                    target: renderTexture
                });
                
                // Canvas抽出
                const extractedCanvas = this.manager.app.renderer.extract.canvas({
                    target: renderTexture,
                    resolution: 1,
                    antialias: true
                });
                
                // 正確なサイズのCanvasにコピー
                const finalCanvas = document.createElement('canvas');
                finalCanvas.width = canvasWidth * resolution;
                finalCanvas.height = canvasHeight * resolution;
                const ctx = finalCanvas.getContext('2d', { alpha: true });
                
                // 背景をクリア（透明）
                ctx.clearRect(0, 0, finalCanvas.width, finalCanvas.height);
                
                // 抽出したCanvasを描画
                ctx.drawImage(extractedCanvas, 0, 0);
                
                // Blob生成
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
                // リソースクリーンアップ
                renderTexture.destroy(true);
            }
        }
    }
    
    return PNGExporter;
})();

console.log('✅ png-exporter.js v8.20.0 loaded');