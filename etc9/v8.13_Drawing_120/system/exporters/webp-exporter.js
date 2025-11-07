// ==================================================
// system/exporters/webp-exporter.js
// WebPエクスポーター - 静止画・動画自動判定対応版
// ==================================================
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
        
        async export(options = {}) {
            if (this.isExporting) {
                throw new Error('Export already in progress');
            }
            
            if (window.TegakiEventBus) {
                window.TegakiEventBus.emit('export:started', { format: 'webp' });
            }
            
            this.isExporting = true;
            
            try {
                const blob = await this.generateBlob(options);
                
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
                const filename = options.filename || ('tegaki_' + timestamp + '.webp');
                
                this.manager.downloadFile(blob, filename);
                
                const frameCount = this._getFrameCount();
                const formatType = frameCount >= 2 ? 'animated' : 'static';
                
                if (window.TegakiEventBus) {
                    window.TegakiEventBus.emit('export:completed', {
                        format: 'webp',
                        type: formatType,
                        size: blob.size,
                        frames: frameCount,
                        filename: filename
                    });
                }
                
                return { blob: blob, filename: filename, format: 'webp', type: formatType };
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
                return await this._generateAnimatedWebPAsFallback(options);
            }
            
            return await this._generateStaticWebP(options);
        }
        
        async _generateAnimatedWebPAsFallback(options = {}) {
            const CONFIG = window.TEGAKI_CONFIG;
            const animData = this.manager.animationSystem.getAnimationData();
            
            const settings = {
                width: options.width || CONFIG.canvas.width,
                height: options.height || CONFIG.canvas.height,
                quality: (options.quality !== undefined ? options.quality : 80) / 100
            };
            
            const maxSize = CONFIG.animation?.exportSettings || { maxWidth: 1920, maxHeight: 1080 };
            if (settings.width > maxSize.maxWidth) {
                const ratio = maxSize.maxWidth / settings.width;
                settings.width = maxSize.maxWidth;
                settings.height = Math.round(settings.height * ratio);
            }
            if (settings.height > maxSize.maxHeight) {
                const ratio = maxSize.maxHeight / settings.height;
                settings.height = maxSize.maxHeight;
                settings.width = Math.round(settings.width * ratio);
            }
            
            const gridCols = Math.ceil(Math.sqrt(animData.frames.length));
            const gridRows = Math.ceil(animData.frames.length / gridCols);
            
            const finalCanvas = document.createElement('canvas');
            finalCanvas.width = settings.width * gridCols;
            finalCanvas.height = settings.height * gridRows;
            const ctx = finalCanvas.getContext('2d');
            
            const backupSnapshots = this.manager.animationSystem.captureAllLayerStates();
            
            for (let i = 0; i < animData.frames.length; i++) {
                this.manager.animationSystem.applyFrameToLayers(i);
                await this._waitFrame();
                
                const frameCanvas = await this._renderFrameToCanvas(settings);
                
                const gridX = i % gridCols;
                const gridY = Math.floor(i / gridCols);
                
                ctx.drawImage(
                    frameCanvas,
                    gridX * settings.width,
                    gridY * settings.height,
                    settings.width,
                    settings.height
                );
                
                if (window.TegakiEventBus) {
                    window.TegakiEventBus.emit('export:frame-rendered', { 
                        frame: i + 1, 
                        total: animData.frames.length 
                    });
                }
            }
            
            this.manager.animationSystem.restoreFromSnapshots(backupSnapshots);
            
            return new Promise((resolve, reject) => {
                finalCanvas.toBlob(
                    (blob) => {
                        if (blob) {
                            resolve(blob);
                        } else {
                            reject(new Error('WebP スプライトシート生成失敗'));
                        }
                    },
                    'image/webp',
                    settings.quality
                );
            });
        }
        
        async _renderFrameToCanvas(settings) {
            const CONFIG = window.TEGAKI_CONFIG;
            
            const renderTexture = PIXI.RenderTexture.create({
                width: settings.width,
                height: settings.height,
                resolution: 1
            });
            
            const tempContainer = new PIXI.Container();
            
            const layersContainer = this.manager.animationSystem.layerSystem.currentFrameContainer;
            if (!layersContainer) {
                throw new Error('currentFrameContainer not found');
            }
            
            const originalParent = layersContainer.parent;
            const originalPosition = { 
                x: layersContainer.x, 
                y: layersContainer.y,
                scaleX: layersContainer.scale.x,
                scaleY: layersContainer.scale.y
            };
            
            if (originalParent) {
                originalParent.removeChild(layersContainer);
            }
            
            tempContainer.addChild(layersContainer);
            layersContainer.position.set(0, 0);
            
            if (settings.width !== CONFIG.canvas.width || settings.height !== CONFIG.canvas.height) {
                const scaleX = settings.width / CONFIG.canvas.width;
                const scaleY = settings.height / CONFIG.canvas.height;
                const scale = Math.min(scaleX, scaleY);
                
                layersContainer.scale.set(scale, scale);
                
                const scaledWidth = CONFIG.canvas.width * scale;
                const scaledHeight = CONFIG.canvas.height * scale;
                
                layersContainer.position.set(
                    (settings.width - scaledWidth) / 2,
                    (settings.height - scaledHeight) / 2
                );
            }
            
            this.manager.app.renderer.render({
                container: tempContainer,
                target: renderTexture
            });
            
            let canvas;
            try {
                const result = this.manager.app.renderer.extract.canvas(renderTexture);
                if (result instanceof Promise) {
                    canvas = await result;
                } else {
                    canvas = result;
                }
            } catch (extractError) {
                throw new Error('Canvas extraction failed: ' + extractError.message);
            }
            
            tempContainer.removeChild(layersContainer);
            layersContainer.position.set(originalPosition.x, originalPosition.y);
            layersContainer.scale.set(originalPosition.scaleX, originalPosition.scaleY);
            
            if (originalParent) {
                originalParent.addChild(layersContainer);
            }
            
            renderTexture.destroy(true);
            tempContainer.destroy({ children: true });
            
            return canvas;
        }
        
        _waitFrame() {
            return new Promise(resolve => {
                requestAnimationFrame(() => {
                    setTimeout(resolve, 16);
                });
            });
        }
        
        async _generateStaticWebP(options = {}) {
            const CONFIG = window.TEGAKI_CONFIG;
            
            const settings = {
                width: options.width || CONFIG.canvas.width,
                height: options.height || CONFIG.canvas.height,
                quality: (options.quality !== undefined ? options.quality : 80) / 100
            };
            
            const maxSize = CONFIG.animation?.exportSettings || { maxWidth: 1920, maxHeight: 1080 };
            if (settings.width > maxSize.maxWidth) {
                const ratio = maxSize.maxWidth / settings.width;
                settings.width = maxSize.maxWidth;
                settings.height = Math.round(settings.height * ratio);
            }
            if (settings.height > maxSize.maxHeight) {
                const ratio = maxSize.maxHeight / settings.height;
                settings.height = maxSize.maxHeight;
                settings.width = Math.round(settings.width * ratio);
            }
            
            const canvas = this.manager.renderToCanvas({
                width: settings.width,
                height: settings.height,
                resolution: 1
            });
            
            return new Promise((resolve, reject) => {
                canvas.toBlob(
                    (blob) => {
                        if (blob) {
                            resolve(blob);
                        } else {
                            reject(new Error('WebP blob generation failed'));
                        }
                    },
                    'image/webp',
                    settings.quality
                );
            });
        }
        
        _getFrameCount() {
            if (this.manager?.animationSystem?.getAnimationData) {
                const animData = this.manager.animationSystem.getAnimationData();
                if (animData?.frames) {
                    return animData.frames.length;
                }
            }
            return 1;
        }
    }
    
    return WebPExporter;
})();

console.log('✅ webp-exporter.js (静止画・動画自動判定対応版) loaded');