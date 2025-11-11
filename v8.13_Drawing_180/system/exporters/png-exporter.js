/**
 * ================================================================================
 * system/exporters/png-exporter.js - カメラリセット対応【v8.22.0】
 * ================================================================================
 * 
 * 【依存関係 - Parents】
 *   - system/export-manager.js (エクスポート管理)
 *   - system/camera-system.js (canvasContainer取得)
 *   - system/layer-system.js (レイヤー情報)
 * 
 * 【依存関係 - Children】
 *   - system/exporters/apng-exporter.js (複数フレーム時)
 * 
 * 【責務】
 *   - PNG静止画エクスポート
 *   - 複数フレーム時はAPNGへ委譲
 * 
 * 【v8.22.0 重要改修】
 *   🔧 キャプチャ前にカメラ位置を0,0にリセット（枠ズレ防止）
 *   🔧 キャプチャ後にカメラ位置を復元
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
         * PNG Blob生成【v8.22.0 カメラリセット対応】
         */
        async generateBlob(options = {}) {
            const CONFIG = window.TEGAKI_CONFIG;
            const resolution = options.resolution || 1;
            const canvasWidth = CONFIG.canvas.width;
            const canvasHeight = CONFIG.canvas.height;
            
            const canvasContainer = this.manager.cameraSystem?.canvasContainer ||
                                  this.manager.layerSystem.worldContainer?.children?.find(c => c.label === 'canvasContainer');
            
            if (!canvasContainer) {
                throw new Error('canvasContainer not available');
            }
            
            const worldContainer = this.manager.cameraSystem?.worldContainer;
            
            // 🔧 v8.22.0: カメラ位置をバックアップ
            const originalPosition = worldContainer ? { 
                x: worldContainer.x, 
                y: worldContainer.y 
            } : null;
            
            try {
                // 🔧 カメラを0,0にリセット
                if (worldContainer) {
                    worldContainer.position.set(0, 0);
                }
                
                // フレーム待機
                await new Promise(resolve => {
                    requestAnimationFrame(() => {
                        setTimeout(resolve, 16);
                    });
                });
                
                // キャプチャ
                const extractedCanvas = this.manager.app.renderer.extract.canvas({
                    target: canvasContainer,
                    resolution: resolution,
                    antialias: true
                });
                
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
                // 🔧 カメラ位置を復元
                if (worldContainer && originalPosition) {
                    worldContainer.position.set(originalPosition.x, originalPosition.y);
                }
            }
        }
    }
    
    return PNGExporter;
})();

console.log('✅ png-exporter.js v8.22.0 loaded');