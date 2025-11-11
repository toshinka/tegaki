/**
 * ================================================================================
 * system/exporters/apng-exporter.js - カメラフレーム対応
 * ================================================================================
 * 
 * 【v8.18.1 緊急修正】
 *   🔧 PNG/WEBP Exporterと同一のカメラフレーム対応
 *   🔧 倍密度レンダリング
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
         * APNG Blob生成 - カメラフレーム対応【v8.18.1】
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
         * フレームのスクリーンショット取得【v8.18.1】
         */
        async _captureFrameScreenshot(resolution = 2) {
            const CONFIG = window.TEGAKI_CONFIG;
            const width = CONFIG.canvas.width;
            const height = CONFIG.canvas.height;
            
            const worldContainer = this.manager.cameraSystem?.getWorldContainer?.() ||
                                  this.manager.layerSystem.worldContainer;
            
            if (!worldContainer) {
                throw new Error('worldContainer not found');
            }
            
            this.manager.app.renderer.render({ container: worldContainer });
            
            const renderTexture = PIXI.RenderTexture.create({
                width: width * resolution,
                height: height * resolution,
                resolution: resolution,
                antialias: true
            });
            
            const originalResolution = this.manager.app.renderer.resolution;
            this.manager.app.renderer.resolution = resolution;
            
            try {
                this.manager.app.renderer.render({
                    container: worldContainer,
                    target: renderTexture
                });
                
                const canvas = this.manager.app.renderer.extract.canvas({
                    target: renderTexture,
                    resolution: 1,
                    antialias: true
                });
                
                const finalCanvas = document.createElement('canvas');
                finalCanvas.width = width * resolution;
                finalCanvas.height = height * resolution;
                const ctx = finalCanvas.getContext('2d');
                ctx.drawImage(canvas, 0, 0);
                
                return finalCanvas;
                
            } finally {
                this.manager.app.renderer.resolution = originalResolution;
                renderTexture.destroy(true);
            }
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

console.log('✅ apng-exporter.js v8.18.1 loaded (カメラフレーム対応)');