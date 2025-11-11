/**
 * ================================================================================
 * system/exporters/png-exporter.js - canvasContainer直接キャプチャ【v8.21.0】
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
 * 【v8.21.0 重要改修】
 *   🔧 canvasContainerを直接renderer.extract.canvas()でキャプチャ
 *   🔧 RenderTexture経由を完全排除（座標系破壊を根本解決）
 *   🔧 worldContainer配下のcanvasContainerのみを抽出
 *   🔧 カメラフレーム崩壊の完全防止
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
         * PNG Blob生成【v8.21.0 完全修正版】
         * 
         * 🔧 根本的改善:
         * 1. RenderTextureを使用しない
         * 2. canvasContainerを直接extract.canvas()でキャプチャ
         * 3. 座標系を一切破壊しない
         * 4. カメラフレームは含まれない
         */
        async generateBlob(options = {}) {
            const CONFIG = window.TEGAKI_CONFIG;
            const resolution = options.resolution || 1;
            const canvasWidth = CONFIG.canvas.width;
            const canvasHeight = CONFIG.canvas.height;
            
            // canvasContainerのみをキャプチャ
            const canvasContainer = this.manager.cameraSystem?.canvasContainer ||
                                  this.manager.layerSystem.worldContainer?.children?.find(c => c.label === 'canvasContainer');
            
            if (!canvasContainer) {
                throw new Error('canvasContainer not available');
            }
            
            // 🔧 v8.21.0: RenderTextureを使わず直接キャプチャ
            // renderer.extract.canvas()は指定したcontainerのみをキャプチャする
            const extractedCanvas = this.manager.app.renderer.extract.canvas({
                target: canvasContainer,
                resolution: resolution,
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
        }
    }
    
    return PNGExporter;
})();

console.log('✅ png-exporter.js v8.21.0 loaded');