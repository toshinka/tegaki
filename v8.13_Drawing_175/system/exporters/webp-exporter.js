/**
 * ================================================================================
 * system/exporters/webp-exporter.js - カメラフレーム対応【v8.18.1】
 * ================================================================================
 * 
 * 【v8.18.1 緊急修正】
 *   🔧 PNG Exporterと同一のカメラフレーム対応
 *   🔧 倍密度レンダリング
 * 
 * ================================================================================
 */

window.WebPExporter = (function() {
    'use strict';
    
    class WebPExporter {
        constructor(exportManager) {
            if (!exportManager) {
                throw new Error('WebPExporter: exportManager is required');
            }
            this.manager = exportManager;
            this.isExporting = false;
        }
        
        _getFrameCount() {
            const animData = this.manager.animationSystem?.getAnimationData?.();
            return animData?.frames?.length || 1;
        }
        
        async export(options = {}) {
            if (this.isExporting) {
                throw new Error('Export already in progress');
            }
            
            const frameCount = this._getFrameCount();
            const formatType = frameCount >= 2 ? 'animated' : 'static';
            
            if (window.TegakiEventBus) {
                window.TegakiEventBus.emit('export:started', { 
                    format: 'webp',
                    type: formatType,
                    frames: frameCount
                });
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
                        type: formatType,
                        size: blob.size,
                        frames: frameCount,
                        filename: filename
                    });
                }
                
                return { blob, filename, format: 'webp', type: formatType };
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
        
        async generateBlob(options = {}) {
            const frameCount = this._getFrameCount();
            
            if (frameCount >= 2) {
                console.log(`🎬 Detected ${frameCount} frames - generating animated WEBP`);
                return await this._generateAnimatedWebP(options);
            }
            
            return await this._generateStaticWebP(options);
        }
        
        /**
         * WEBP静止画生成 - カメラフレーム対応【v8.18.1】
         */
        async _generateStaticWebP(options = {}) {
            const CONFIG = window.TEGAKI_CONFIG;
            const quality = options.quality !== undefined ? options.quality / 100 : 0.95;
            const resolution = options.resolution || 2;
            
            const width = CONFIG.canvas.width;
            const height = CONFIG.canvas.height;
            
            const worldContainer = this.manager.cameraSystem?.getWorldContainer?.() ||
                                  this.manager.layerSystem.worldContainer;
            
            if (!worldContainer) {
                throw new Error('worldContainer not available');
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
                
                return new Promise((resolve, reject) => {
                    finalCanvas.toBlob((blob) => {
                        if (!blob) {
                            reject(new Error('WEBP generation failed'));
                            return;
                        }
                        resolve(blob);
                    }, 'image/webp', quality);
                });
                
            } finally {
                this.manager.app.renderer.resolution = originalResolution;
                renderTexture.destroy(true);
            }
        }
        
        /**
         * WEBP動画生成 - カメラフレーム対応【v8.18.1】
         */
        async _generateAnimatedWebP(options = {}) {
            const CONFIG = window.TEGAKI_CONFIG;
            const animData = this.manager.animationSystem.getAnimationData();
            const frameCount = animData.frames.length;
            const resolution = options.resolution || 2;
            
            const quality = options.quality !== undefined ? options.quality / 100 : 0.95;
            
            const gridCols = Math.ceil(Math.sqrt(frameCount));
            const gridRows = Math.ceil(frameCount / gridCols);
            
            const frameWidth = CONFIG.canvas.width * resolution;
            const frameHeight = CONFIG.canvas.height * resolution;
            
            const finalCanvas = document.createElement('canvas');
            finalCanvas.width = frameWidth * gridCols;
            finalCanvas.height = frameHeight * gridRows;
            const ctx = finalCanvas.getContext('2d');
            
            ctx.clearRect(0, 0, finalCanvas.width, finalCanvas.height);
            
            const backupSnapshots = this.manager.animationSystem.captureAllLayerStates();
            
            try {
                for (let i = 0; i < frameCount; i++) {
                    this.manager.animationSystem.applyFrameToLayers(i);
                    await this._waitFrame();
                    
                    const frameCanvas = await this._captureFrameScreenshot(resolution);
                    
                    const gridX = i % gridCols;
                    const gridY = Math.floor(i / gridCols);
                    
                    ctx.drawImage(
                        frameCanvas,
                        gridX * frameWidth,
                        gridY * frameHeight,
                        frameWidth,
                        frameHeight
                    );
                    
                    if (window.TegakiEventBus) {
                        window.TegakiEventBus.emit('export:progress', { 
                            current: i + 1, 
                            total: frameCount,
                            format: 'webp'
                        });
                    }
                }
            } finally {
                this.manager.animationSystem.restoreFromSnapshots(backupSnapshots);
            }
            
            return new Promise((resolve, reject) => {
                finalCanvas.toBlob(
                    (blob) => {
                        if (blob) {
                            resolve(blob);
                        } else {
                            reject(new Error('Animated WEBP generation failed'));
                        }
                    },
                    'image/webp',
                    quality
                );
            });
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
    
    return WebPExporter;
})();

console.log('✅ webp-exporter.js v8.18.1 loaded (カメラフレーム対応)');