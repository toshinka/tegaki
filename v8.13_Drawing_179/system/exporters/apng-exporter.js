/**
 * ================================================================================
 * system/exporters/apng-exporter.js - canvasContainer直接キャプチャ【v8.21.0】
 * ================================================================================
 * 
 * 【依存関係 - Parents】
 *   - system/export-manager.js (エクスポート管理)
 *   - system/camera-system.js (canvasContainer取得)
 *   - system/animation-system.js (フレーム情報)
 *   - UPNG.js (APNG生成ライブラリ)
 * 
 * 【依存関係 - Children】
 *   なし
 * 
 * 【責務】
 *   - APNGアニメーション出力
 *   - 複数フレームの連続キャプチャ
 * 
 * 【v8.21.0 重要改修】
 *   🔧 canvasContainerを直接renderer.extract.canvas()でキャプチャ
 *   🔧 RenderTexture経由を完全排除（座標系破壊を根本解決）
 *   🔧 renderer.resolutionを変更しない
 *   🔧 カメラフレーム崩壊の完全防止
 * 
 * ================================================================================
 */

window.APNGExporter = (function() {
    'use strict';
    
    class APNGExporter {
        constructor(exportManager) {
            if (!exportManager) {
                throw new Error('APNGExporter: exportManager is required');
            }
            this.manager = exportManager;
            this.isExporting = false;
        }
        
        _checkUPNGAvailability() {
            if (typeof UPNG === 'undefined') {
                throw new Error('UPNG.js not loaded. Include: https://cdnjs.cloudflare.com/ajax/libs/upng-js/2.1.0/UPNG.js');
            }
        }
        
        async export(options = {}) {
            if (this.isExporting) {
                throw new Error('Export already in progress');
            }
            
            this._checkUPNGAvailability();
            
            if (!this.manager?.animationSystem) {
                throw new Error('AnimationSystem not available');
            }
            
            const animData = this.manager.animationSystem.getAnimationData();
            if (!animData?.frames || animData.frames.length < 2) {
                throw new Error('APNGには2つ以上のフレームが必要です');
            }
            
            if (window.TegakiEventBus) {
                window.TegakiEventBus.emit('export:started', { 
                    format: 'apng',
                    frames: animData.frames.length
                });
            }
            
            this.isExporting = true;
            
            try {
                const blob = await this.generateBlob(options);
                
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
                const filename = options.filename || `tegaki_animation_${timestamp}.png`;
                
                this.manager.downloadFile(blob, filename);
                
                if (window.TegakiEventBus) {
                    window.TegakiEventBus.emit('export:completed', {
                        format: 'apng',
                        size: blob.size,
                        frames: animData.frames.length,
                        filename: filename
                    });
                }
                
                return { blob, filename, format: 'apng' };
            } catch (error) {
                if (window.TegakiEventBus) {
                    window.TegakiEventBus.emit('export:failed', { 
                        format: 'apng',
                        error: error.message
                    });
                }
                throw error;
            } finally {
                this.isExporting = false;
            }
        }
        
        /**
         * APNG Blob生成【v8.21.0 完全修正版】
         */
        async generateBlob(options = {}) {
            const CONFIG = window.TEGAKI_CONFIG;
            const animData = this.manager.animationSystem.getAnimationData();
            const resolution = options.resolution || 2;
            
            const settings = {
                width: CONFIG.canvas.width * resolution,
                height: CONFIG.canvas.height * resolution,
                fps: options.fps || 12,
                resolution: resolution
            };
            
            const frames = [];
            const delays = [];
            
            const backupSnapshots = this.manager.animationSystem.captureAllLayerStates();
            
            try {
                for (let i = 0; i < animData.frames.length; i++) {
                    const frame = animData.frames[i];
                    
                    this.manager.animationSystem.applyFrameToLayers(i);
                    await this._waitFrame();
                    
                    const canvas = await this._captureFrameScreenshot(settings.resolution);
                    
                    const ctx = canvas.getContext('2d', { willReadFrequently: true });
                    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    
                    frames.push(imageData.data.buffer);
                    
                    const durationMs = frame.duration !== undefined && frame.duration !== null 
                        ? Math.round(frame.duration * 1000)
                        : Math.round(1000 / settings.fps);
                    
                    delays.push(durationMs);
                    
                    if (window.TegakiEventBus) {
                        window.TegakiEventBus.emit('export:progress', { 
                            current: i + 1, 
                            total: animData.frames.length,
                            format: 'apng'
                        });
                    }
                }
            } finally {
                this.manager.animationSystem.restoreFromSnapshots(backupSnapshots);
            }
            
            const apngBuffer = UPNG.encode(
                frames,
                settings.width,
                settings.height,
                0,
                delays
            );
            
            return new Blob([apngBuffer], { type: 'image/png' });
        }
        
        /**
         * フレームのスクリーンショット取得【v8.21.0 完全修正版】
         * 
         * 🔧 根本的改善:
         * 1. RenderTextureを使用しない
         * 2. renderer.resolutionを変更しない
         * 3. canvasContainerを直接extract.canvas()でキャプチャ
         * 4. 座標系を一切破壊しない
         */
        async _captureFrameScreenshot(resolution = 2) {
            const CONFIG = window.TEGAKI_CONFIG;
            const canvasWidth = CONFIG.canvas.width;
            const canvasHeight = CONFIG.canvas.height;
            
            const canvasContainer = this.manager.cameraSystem?.canvasContainer ||
                                  this.manager.layerSystem.worldContainer?.children?.find(c => c.label === 'canvasContainer');
            
            if (!canvasContainer) {
                throw new Error('canvasContainer not found');
            }
            
            // 🔧 v8.21.0: RenderTextureを使わず直接キャプチャ
            // renderer.resolutionは変更しない
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
            
            return finalCanvas;
        }
        
        _waitFrame() {
            return new Promise(resolve => {
                requestAnimationFrame(() => {
                    setTimeout(resolve, 16);
                });
            });
        }
    }
    
    return APNGExporter;
})();

console.log('✅ apng-exporter.js v8.21.0 loaded');