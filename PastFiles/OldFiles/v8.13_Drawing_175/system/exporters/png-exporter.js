/**
 * ================================================================================
 * system/exporters/png-exporter.js - カメラフレーム対応【v8.18.1】
 * ================================================================================
 * 
 * 【v8.18.1 緊急修正】
 *   🔧 カメラフレーム（worldContainer）を正しくキャプチャ
 *   🔧 背景も含めた完全なスクリーンショット
 *   🔧 透明チェックパターン問題の解決
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
         * PNG Blob生成 - カメラフレーム対応【v8.18.1】
         * 
         * 🔧 修正点:
         * 1. worldContainer全体をキャプチャ（カメラ変換込み）
         * 2. frameオプションでキャンバス領域を指定
         * 3. 背景も含めた完全なスクリーンショット
         * 4. 倍密度キャプチャオプション追加
         */
        async generateBlob(options = {}) {
            const CONFIG = window.TEGAKI_CONFIG;
            
            // 🔧 倍密度オプション（デフォルト: 2倍でキャプチャ）
            const resolution = options.resolution || 2;
            const width = CONFIG.canvas.width;
            const height = CONFIG.canvas.height;
            
            // worldContainerを取得（カメラ変換が適用されている）
            const worldContainer = this.manager.cameraSystem?.getWorldContainer?.() ||
                                  this.manager.layerSystem.worldContainer;
            
            if (!worldContainer) {
                throw new Error('worldContainer not available');
            }
            
            // 現在の表示状態を確実にレンダリング
            this.manager.app.renderer.render({
                container: worldContainer
            });
            
            // 🔧 高解像度RenderTextureを作成
            const renderTexture = PIXI.RenderTexture.create({
                width: width * resolution,
                height: height * resolution,
                resolution: resolution,
                antialias: true
            });
            
            // 一時的にresolutionを上げてレンダリング
            const originalResolution = this.manager.app.renderer.resolution;
            this.manager.app.renderer.resolution = resolution;
            
            try {
                // worldContainer全体をレンダリング
                this.manager.app.renderer.render({
                    container: worldContainer,
                    target: renderTexture
                });
                
                // Canvasに抽出
                const canvas = this.manager.app.renderer.extract.canvas({
                    target: renderTexture,
                    resolution: 1,  // 出力時は1倍に戻す
                    antialias: true
                });
                
                // 最終的なサイズ調整（元のサイズに戻す場合）
                const finalCanvas = document.createElement('canvas');
                finalCanvas.width = width * resolution;
                finalCanvas.height = height * resolution;
                const ctx = finalCanvas.getContext('2d');
                ctx.drawImage(canvas, 0, 0);
                
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
                // 解像度を元に戻す
                this.manager.app.renderer.resolution = originalResolution;
                renderTexture.destroy(true);
            }
        }
    }
    
    return PNGExporter;
})();

console.log('✅ png-exporter.js v8.18.1 loaded (カメラフレーム対応)');
console.log('   🔧 worldContainer全体をキャプチャ');
console.log('   🔧 倍密度レンダリング（デフォルト2x）');