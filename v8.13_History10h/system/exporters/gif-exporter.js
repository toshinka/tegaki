// ==================================================
// system/exporters/gif-exporter.js
// GIFアニメーションエクスポーター - バリデーション強化版
// ==================================================
window.GIFExporter = (function() {
    'use strict';
    
    class GIFExporter {
        constructor(exportManager) {
            if (!exportManager) {
                throw new Error('GIFExporter: exportManager is required');
            }
            this.manager = exportManager;
            this.isExporting = false;
        }
        
        async export(options = {}) {
            if (this.isExporting) {
                throw new Error('GIF export already in progress');
            }
            
            if (!this.manager || !this.manager.animationSystem) {
                throw new Error('GIFExporter: manager or animationSystem not available');
            }
            
            if (!this.manager.animationSystem.captureAllLayerStates) {
                throw new Error('GIFExporter: required method captureAllLayerStates missing in AnimationSystem');
            }
            
            if (!this.manager.animationSystem.restoreFromSnapshots) {
                throw new Error('GIFExporter: required method restoreFromSnapshots missing in AnimationSystem');
            }
            
            if (!this.manager.animationSystem.applyCutToLayers) {
                throw new Error('GIFExporter: required method applyCutToLayers missing in AnimationSystem');
            }
            
            const animData = this.manager.animationSystem.getAnimationData();
            if (!animData || !animData.cuts || animData.cuts.length === 0) {
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
                console.log('[GIF Export] Starting GIF export with', animData.cuts.length, 'cuts');
                
                const gif = new GIF({
                    workers: 0,
                    quality: settings.quality,
                    width: settings.width,
                    height: settings.height,
                    workerScript: undefined
                });
                
                console.log('[GIF Export] GIF instance created');
                
                gif.on('progress', (progress) => {
                    const progressPercent = Math.round(progress * 100);
                    console.log('[GIF Export] Progress:', progressPercent + '%');
                    window.TegakiEventBus?.emit('export:progress', { 
                        format: 'gif',
                        progress: progressPercent 
                    });
                });
                
                console.log('[GIF Export] Capturing initial state');
                const backupSnapshots = this.manager.animationSystem.captureAllLayerStates();
                console.log('[GIF Export] State captured, processing', animData.cuts.length, 'frames');
                
                for (let i = 0; i < animData.cuts.length; i++) {
                    const cut = animData.cuts[i];
                    console.log(`[GIF Export] Processing frame ${i + 1}/${animData.cuts.length}`);
                    
                    this.manager.animationSystem.applyCutToLayers(i);
                    await this.waitFrame();
                    
                    try {
                        const canvas = await this.renderCutToCanvas(settings);
                        console.log(`[GIF Export] Frame ${i + 1} rendered:`, canvas ? 'success' : 'failed');
                        
                        if (canvas) {
                            gif.addFrame(canvas, { 
                                delay: Math.round(cut.duration * 1000)
                            });
                            console.log(`[GIF Export] Frame ${i + 1} added to GIF`);
                        }
                    } catch (frameError) {
                        console.error(`[GIF Export] Error processing cut ${i + 1}:`, frameError);
                    }
                    
                    window.TegakiEventBus?.emit('export:frame-rendered', { 
                        frame: i + 1, 
                        total: animData.cuts.length 
                    });
                }
                
                console.log('[GIF Export] All frames added, restoring state');
                this.manager.animationSystem.restoreFromSnapshots(backupSnapshots);
                console.log('[GIF Export] Starting GIF render');
                
                return new Promise((resolve, reject) => {
                    gif.on('finished', (blob) => {
                        console.log('[GIF Export] GIF render finished, blob size:', blob.size);
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
                
                // layersContainerまたはcurrentCutContainerを取得
                const layersContainer = this.manager.animationSystem.layerSystem.layersContainer || 
                                       this.manager.animationSystem.layerSystem.currentCutContainer;
                
                if (!layersContainer) {
                    throw new Error('layersContainer not found');
                }
                
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

console.log('✅ gif-exporter.js (バリデーション強化版) loaded');