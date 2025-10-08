// ==================================================
// system/exporters/gif-exporter.js
// GIFアニメーションエクスポーター - file://環境対応版
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
            this.workerBlobURL = null;
        }
        
        async generateBlob(options = {}) {
            if (this.isExporting) {
                throw new Error('GIF export already in progress');
            }
            
            if (!this.manager?.animationSystem) {
                throw new Error('AnimationSystem not available');
            }
            
            const animData = this.manager.animationSystem.getAnimationData();
            if (!animData?.cuts || animData.cuts.length === 0) {
                throw new Error('アニメーションにCUTが含まれていません');
            }
            
            const settings = {
                width: options.width || window.TEGAKI_CONFIG.canvas.width,
                height: options.height || window.TEGAKI_CONFIG.canvas.height,
                quality: options.quality || window.TEGAKI_CONFIG.animation.exportSettings.quality
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
                if (!this.workerBlobURL) {
                    this.workerBlobURL = await this.createWorkerBlobURL();
                }
                
                const gif = new GIF({
                    quality: settings.quality,
                    width: settings.width,
                    height: settings.height,
                    workers: 2,
                    workerScript: this.workerBlobURL
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
                    
                    const canvas = await this.renderCutToCanvas(settings);
                    
                    if (canvas) {
                        const delayMs = cut.duration !== undefined && cut.duration !== null
                            ? Math.round(cut.duration * 1000)
                            : 100;
                        
                        gif.addFrame(canvas, { delay: delayMs });
                    }
                    
                    window.TegakiEventBus?.emit('export:frame-rendered', { 
                        frame: i + 1, 
                        total: animData.cuts.length 
                    });
                }
                
                this.manager.animationSystem.restoreFromSnapshots(backupSnapshots);
                
                const blob = await this.renderGIF(gif);
                
                this.isExporting = false;
                return blob;
                
            } catch (error) {
                this.isExporting = false;
                throw new Error('GIF generation failed: ' + error.message);
            }
        }
        
        async export(options = {}) {
            try {
                window.TegakiEventBus?.emit('export:started', { format: 'gif' });
                
                const blob = await this.generateBlob(options);
                
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
                const filename = `tegaki_animation_${timestamp}.gif`;
                
                this.manager.downloadFile(blob, filename);
                
                const animData = this.manager.animationSystem.getAnimationData();
                window.TegakiEventBus?.emit('export:completed', {
                    format: 'gif',
                    size: blob.size,
                    cuts: animData.cuts.length,
                    filename: filename
                });
                
                return { blob, filename, format: 'gif' };
                
            } catch (error) {
                window.TegakiEventBus?.emit('export:failed', { 
                    format: 'gif',
                    error: error.message
                });
                throw error;
            }
        }
        
        async createWorkerBlobURL() {
            const localPath = 'vendor/gif.worker.js';
            const cdnPath = 'https://cdn.jsdelivr.net/npm/gif.js@0.2.0/dist/gif.worker.js';
            
            try {
                const response = await fetch(localPath);
                if (response.ok) {
                    const workerCode = await response.text();
                    const blob = new Blob([workerCode], { type: 'application/javascript' });
                    return URL.createObjectURL(blob);
                }
            } catch (e) {
                // file://環境でのローカルフェッチ失敗は無視
            }
            
            try {
                const response = await fetch(cdnPath);
                if (!response.ok) {
                    throw new Error('CDN fetch failed: ' + response.status);
                }
                const workerCode = await response.text();
                const blob = new Blob([workerCode], { type: 'application/javascript' });
                return URL.createObjectURL(blob);
            } catch (error) {
                throw new Error('Worker script unavailable (local and CDN failed)');
            }
        }
        
        renderGIF(gif) {
            return new Promise((resolve, reject) => {
                let finished = false;
                const TIMEOUT_MS = 120000;
                
                const cleanup = () => {
                    clearTimeout(timeoutId);
                };
                
                const timeoutId = setTimeout(() => {
                    if (!finished) {
                        finished = true;
                        cleanup();
                        reject(new Error('GIF render timeout (120秒経過)'));
                    }
                }, TIMEOUT_MS);
                
                gif.on('finished', (blob) => {
                    if (!finished) {
                        finished = true;
                        cleanup();
                        resolve(blob);
                    }
                });
                
                gif.on('abort', () => {
                    if (!finished) {
                        finished = true;
                        cleanup();
                        reject(new Error('GIF render aborted'));
                    }
                });
                
                try {
                    gif.render();
                } catch (err) {
                    if (!finished) {
                        finished = true;
                        cleanup();
                        reject(err);
                    }
                }
            });
        }
        
        async renderCutToCanvas(settings) {
            const renderTexture = PIXI.RenderTexture.create({
                width: settings.width,
                height: settings.height,
                resolution: 1
            });
            
            const tempContainer = new PIXI.Container();
            
            const layersContainer = this.manager.animationSystem.layerSystem.currentCutContainer;
            if (!layersContainer) {
                throw new Error('currentCutContainer not found');
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
            
            if (settings.width !== window.TEGAKI_CONFIG.canvas.width || 
                settings.height !== window.TEGAKI_CONFIG.canvas.height) {
                const scaleX = settings.width / window.TEGAKI_CONFIG.canvas.width;
                const scaleY = settings.height / window.TEGAKI_CONFIG.canvas.height;
                const scale = Math.min(scaleX, scaleY);
                layersContainer.scale.set(scale, scale);
                
                const scaledWidth = window.TEGAKI_CONFIG.canvas.width * scale;
                const scaledHeight = window.TEGAKI_CONFIG.canvas.height * scale;
                layersContainer.position.set(
                    (settings.width - scaledWidth) / 2,
                    (settings.height - scaledHeight) / 2
                );
            }
            
            this.manager.app.renderer.render({
                container: tempContainer,
                target: renderTexture
            });
            
            const canvas = this.manager.app.renderer.extract.canvas(renderTexture);
            
            tempContainer.removeChild(layersContainer);
            layersContainer.position.set(originalPosition.x, originalPosition.y);
            layersContainer.scale.set(originalPosition.scaleX, originalPosition.scaleY);
            
            if (originalParent) {
                originalParent.addChild(layersContainer);
            }
            
            renderTexture.destroy();
            tempContainer.destroy();
            
            return canvas;
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

console.log('✅ gif-exporter.js loaded');