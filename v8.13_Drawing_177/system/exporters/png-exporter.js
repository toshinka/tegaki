/**
 * ================================================================================
 * system/exporters/png-exporter.js - 倍率対応・外枠除外【v8.19.0】
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
 * 【v8.19.0 改修内容】
 *   🔧 options.resolutionを正しく適用
 *   🔧 cameraFrameを含まないcanvasContainerのみキャプチャ
 *   🔧 固定2倍を削除し、ユーザー選択倍率を使用
 *   🔧 正確な出力サイズ計算
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
                console.log('🎬 Multiple frames detected - delegating to APNG exporter');
                const apngExporter = this.manager.exporters['apng'];
                if (apngExporter) {
                    return await apngExporter.export(options);
                }
                console.warn('⚠️ APNG exporter not available, exporting single frame');
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
         * PNG Blob生成【v8.19.0】
         * 
         * 改修点:
         * 1. options.resolutionを使用（デフォルト1倍）
         * 2. canvasContainerのみをキャプチャ（cameraFrameを除外）
         * 3. 正確な等倍/倍率出力
         */
        async generateBlob(options = {}) {
            const CONFIG = window.TEGAKI_CONFIG;
            
            // 🔧 v8.19.0: ユーザー選択倍率を使用（デフォルト1倍）
            const resolution = options.resolution || 1;
            const canvasWidth = CONFIG.canvas.width;
            const canvasHeight = CONFIG.canvas.height;
            
            console.log(`📸 PNG Export: ${canvasWidth}x${canvasHeight} @ ${resolution}x = ${canvasWidth * resolution}x${canvasHeight * resolution}`);
            
            // 🔧 v8.19.0: canvasContainerのみをキャプチャ（外枠除外）
            const canvasContainer = this.manager.cameraSystem?.canvasContainer ||
                                  this.manager.layerSystem.worldContainer?.children?.find(c => c.label === 'canvasContainer');
            
            if (!canvasContainer) {
                throw new Error('canvasContainer not available');
            }
            
            // 現在の表示状態を確実にレンダリング
            this.manager.app.renderer.render({
                container: canvasContainer
            });
            
            // 🔧 出力解像度でRenderTextureを作成
            const renderTexture = PIXI.RenderTexture.create({
                width: canvasWidth * resolution,
                height: canvasHeight * resolution,
                resolution: resolution,
                antialias: true
            });
            
            // 一時的にresolutionを上げてレンダリング
            const originalResolution = this.manager.app.renderer.resolution;
            this.manager.app.renderer.resolution = resolution;
            
            try {
                // canvasContainer全体をレンダリング
                this.manager.app.renderer.render({
                    container: canvasContainer,
                    target: renderTexture
                });
                
                // Canvasに抽出
                const canvas = this.manager.app.renderer.extract.canvas({
                    target: renderTexture,
                    resolution: 1,
                    antialias: true
                });
                
                // 最終キャンバス（正確なサイズ）
                const finalCanvas = document.createElement('canvas');
                finalCanvas.width = canvasWidth * resolution;
                finalCanvas.height = canvasHeight * resolution;
                const ctx = finalCanvas.getContext('2d');
                ctx.drawImage(canvas, 0, 0);
                
                // Blob生成
                return new Promise((resolve, reject) => {
                    finalCanvas.toBlob((blob) => {
                        if (!blob) {
                            reject(new Error('PNG generation failed'));
                            return;
                        }
                        console.log(`✅ PNG Generated: ${blob.size} bytes`);
                        resolve(blob);
                    }, 'image/png');
                });
                
            } finally {
                // 解像度を元に戻す
                this.manager.app.renderer.resolution = originalResolution;
                renderTexture.destroy(true);
            }
        }
    }
    
    return PNGExporter;
})();

console.log('✅ png-exporter.js v8.19.0 loaded');
console.log('   🔧 倍率対応（options.resolution使用）');
console.log('   🔧 canvasContainerのみキャプチャ（外枠除外）');
console.log('   🔧 正確な出力サイズ計算');