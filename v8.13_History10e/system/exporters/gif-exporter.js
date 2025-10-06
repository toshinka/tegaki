// ==================================================
// system/exporters/gif-exporter.js
// GIFアニメーションエクスポーター (ExportManager統合版)
// ==================================================
window.GIFExporter = (function() {
    'use strict';
    
    class GIFExporter {
        constructor(exportManager) {
            this.manager = exportManager;
            this.isExporting = false;
        }
        
        async export(options = {}) {
            if (this.isExporting) {
                throw new Error('GIF export already in progress');
            }
            
            const animData = this.manager.animationSystem.getAnimationData();
            if (animData.cuts.length === 0) {
                throw new Error('アニメーションにCUTが含まれていません');
            }
            
            const settings = {
                width: options.width || window.TEGAKI_CONFIG.canvas.width,
                height: options.height || window.TEGAKI_CONFIG.canvas.height,
                quality: options.quality || window.TEGAKI_CONFIG.animation.exportSettings.quality,
                workers: window.TEGAKI_CONFIG.animation.exportSettings.workers
            };
            
            const maxSize = window.TEGAKI_CONFIG.animation.exportSettings;
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
            
            this.isExporting = true;
            
            try {
                window.TegakiEventBus?.emit('export:started', { format: 'gif' });
                
                const gif = new GIF({
                    workers: settings.workers,
                    quality: settings.quality,
                    width: settings.width,
                    height: settings.height,
                    workerScript: 'https://cdn.jsdelivr.net/npm/gif.js@0.2.0/dist/gif.worker.min.js'
                });
                
                gif.on('progress', (progress) => {
                    const progressPercent = Math.round(progress * 100);
                    window.TegakiEventBus?.emit('export:progress', { 
                        format: 'gif',
                        progress: progressPercent 
                    });
                });
                
                const backupSnapshots = this.manager.animationSystem.captureAllLayerStates();
                
                for (let i = 0; i < animData.cuts.length; i++) {
                    const cut = animData.cuts[i];
                    
                    this.manager.animationSystem.applyCutToLayers(i);
                    await this.waitFrame();
                    
                    try {
                        const canvas = await this.renderCutToCanvas(settings);
                        
                        if (canvas) {
                            gif.addFrame(canvas, { 
                                delay: Math.round(cut.duration * 1000)
                            });
                        }
                    } catch (frameError) {
                        console.error(`Error processing cut ${i + 1}:`, frameError);
                    }
                    
                    window.TegakiEventBus?.emit('export:frame-rendered', { 
                        frame: i + 1, 
                        total: animData.cuts.length 
                    });
                }
                
                this.manager.animationSystem.restoreFromSnapshots(backupSnapshots);
                
                return new Promise((resolve, reject) => {
                    gif.on('finished', (blob) => {
                        try {
                            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
                            const filename = `tegaki_animation_${timestamp}.gif`;
                            
                            this.manager.downloadFile(blob, filename);
                            
                            window.TegakiEventBus?.emit('export:completed', {
                                format: 'gif',
                                size: blob.size,
                                cuts: animData.cuts.length,
                                filename: filename
                            });
                            
                            resolve({ blob, filename });
                        } catch (downloadError) {
                            window.TegakiEventBus?.emit('export:failed', { 
                                format: 'gif',
                                error: downloadError 
                            });
                            reject(downloadError);
                        } finally {
                            this.isExporting = false;
                        }
                    });
                    
                    gif.on('abort', () => {
                        this.isExporting = false;
                        window.TegakiEventBus?.emit('export:aborted', { format: 'gif' });
                        reject(new Error('GIF export aborted'));
                    });
                    
                    gif.render();
                });
                
            } catch (error) {
                this.isExporting = false;
                window.TegakiEventBus?.emit('export:failed', { 
                    format: 'gif',
                    error 
                });
                throw error;
            }
        }
        
        async renderCutToCanvas(settings) {
            try {
                const renderTexture = PIXI.RenderTexture.create({
                    width: settings.width,
                    height: settings.height,
                    resolution: 2
                });
                
                const tempContainer = new PIXI.Container();
                
                const offsetX = (settings.width - window.TEGAKI_CONFIG.canvas.width) / 2;
                const offsetY = (settings.height - window.TEGAKI_CONFIG.canvas.height) / 2;
                
                const layersContainer = this.manager.animationSystem.layerSystem.layersContainer;
                const originalParent = layersContainer.parent;
                const originalPosition = { x: layersContainer.x, y: layersContainer.y };
                
                if (originalParent) {
                    originalParent.removeChild(layersContainer);
                }
                
                tempContainer.addChild(layersContainer);
                tempContainer.position.set(offsetX, offsetY);
                
                this.manager.app.renderer.render({
                    container: tempContainer,
                    target: renderTexture
                });
                
                const canvas = this.manager.app.renderer.extract.canvas(renderTexture);
                
                tempContainer.removeChild(layersContainer);
                layersContainer.position.set(originalPosition.x, originalPosition.y);
                
                if (originalParent) {
                    originalParent.addChild(layersContainer);
                }
                
                renderTexture.destroy();
                tempContainer.destroy();
                
                return canvas;
                
            } catch (error) {
                console.error('Canvas rendering failed:', error);
                return null;
            }
        }
        
        waitFrame() {
            return new Promise(resolve => {
                requestAnimationFrame(() => {
                    setTimeout(resolve, 16);
                });
            });
        }
    }
    
    return GIFExporter;
})();

console.log('✅ gif-exporter.js (統合版) loaded');