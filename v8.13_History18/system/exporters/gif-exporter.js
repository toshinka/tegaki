// ==================================================
// system/exporters/gif-exporter.js
// GIFアニメーションエクスポーター - デバッグ版
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
        
        async generateGifBlob(options = {}) {
            if (this.isExporting) {
                throw new Error('GIF export already in progress');
            }
            
            if (!this.manager || !this.manager.animationSystem) {
                throw new Error('GIFExporter: manager or animationSystem not available');
            }
            
            if (!this.manager.animationSystem.captureAllLayerStates) {
                throw new Error('GIFExporter: required method captureAllLayerStates missing');
            }
            
            if (!this.manager.animationSystem.restoreFromSnapshots) {
                throw new Error('GIFExporter: required method restoreFromSnapshots missing');
            }
            
            if (!this.manager.animationSystem.applyCutToLayers) {
                throw new Error('GIFExporter: required method applyCutToLayers missing');
            }
            
            const animData = this.manager.animationSystem.getAnimationData();
            if (!animData || !animData.cuts || animData.cuts.length === 0) {
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
                        gif.addFrame(canvas, { 
                            delay: Math.round(cut.duration * 1000)
                        });
                    }
                    
                    window.TegakiEventBus?.emit('export:frame-rendered', { 
                        frame: i + 1, 
                        total: animData.cuts.length 
                    });
                }
                
                this.manager.animationSystem.restoreFromSnapshots(backupSnapshots);
                
                const blob = await this.renderGIF(gif);
                
                this.isExporting = false;
                console.log('[GIF] Blob generated:', blob.size, 'bytes', blob.type);
                return blob;
                
            } catch (error) {
                this.isExporting = false;
                console.error('[GIF] Generation failed:', error);
                const err = new Error('GIF generation failed: ' + error.message);
                err.inner = error;
                throw err;
            }
        }
        
        async export(options = {}) {
            try {
                window.TegakiEventBus?.emit('export:started', { format: 'gif' });
                
                const blob = await this.generateGifBlob(options);
                
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
                
                return { blob, filename };
                
            } catch (error) {
                window.TegakiEventBus?.emit('export:failed', { 
                    format: 'gif',
                    error 
                });
                throw error;
            }
        }
        
        async copy(options = {}) {
            let blob = null;
            
            try {
                console.log('[GIF Copy] Starting...');
                window.TegakiEventBus?.emit('export:started', { format: 'gif' });
                
                blob = await this.generateGifBlob(options);
                console.log('[GIF Copy] Blob generated, attempting clipboard...');
                
                const result = await this.manager.copyGifWithPreviewFallback(blob);
                console.log('[GIF Copy] Result:', result);
                
                if (result.success) {
                    console.log('[GIF Copy] Clipboard success');
                    window.TegakiEventBus?.emit('export:copied', {
                        format: 'gif',
                        blob: blob,
                        dataUrl: null,
                        message: 'クリップボードにコピーしました'
                    });
                } else {
                    console.log('[GIF Copy] Clipboard failed, showing preview with dataUrl length:', result.dataUrl?.length);
                    window.TegakiEventBus?.emit('export:copied', {
                        format: 'gif',
                        blob: blob,
                        dataUrl: result.dataUrl,
                        message: 'プレビューを表示しました。右クリックでコピーできます'
                    });
                }
                
                return result;
                
            } catch (error) {
                console.error('[GIF Copy] Error:', error);
                if (blob) {
                    console.log('[GIF Copy] Fallback: generating dataUrl for preview');
                    const dataUrl = await this.manager.blobToDataURL(blob);
                    console.log('[GIF Copy] DataUrl length:', dataUrl.length);
                    window.TegakiEventBus?.emit('export:copied', {
                        format: 'gif',
                        blob: blob,
                        dataUrl: dataUrl,
                        message: 'エラーが発生しました。プレビューから保存してください'
                    });
                } else {
                    window.TegakiEventBus?.emit('export:failed', { 
                        format: 'gif',
                        error 
                    });
                    throw error;
                }
            }
        }
        
        async createWorkerBlobURL() {
            try {
                const response = await fetch('https://cdn.jsdelivr.net/npm/gif.js@0.2.0/dist/gif.worker.js');
                const workerCode = await response.text();
                const blob = new Blob([workerCode], { type: 'application/javascript' });
                return URL.createObjectURL(blob);
            } catch (error) {
                throw new Error('Worker script fetch failed: ' + error.message);
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
            
            const layersContainer = this.manager.animationSystem.layerSystem.layersContainer || 
                                   this.manager.animationSystem.layerSystem.currentCutContainer;
            
            if (!layersContainer) {
                throw new Error('layersContainer not found');
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

console.log('✅ gif-exporter.js (デバッグ版) loaded');