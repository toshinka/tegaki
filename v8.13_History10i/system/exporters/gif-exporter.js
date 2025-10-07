// ==================================================
// system/exporters/gif-exporter.js
// GIFアニメーションエクスポーター - Blob URL worker版
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
                window.TegakiEventBus?.emit('export:started', { format: 'gif' });
                
                // Blob URLでworkerを作成（file://環境対応）
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
                
                // プログレスイベント
                gif.on('progress', (progress) => {
                    const progressPercent = Math.round(progress * 100);
                    window.TegakiEventBus?.emit('export:progress', { 
                        format: 'gif',
                        progress: progressPercent 
                    });
                });
                
                // 状態バックアップ
                const backupSnapshots = this.manager.animationSystem.captureAllLayerStates();
                
                // フレーム追加
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
                
                // 状態復元
                this.manager.animationSystem.restoreFromSnapshots(backupSnapshots);
                
                // render完了をPromiseで待機
                const blob = await this.renderGIF(gif);
                
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
                const filename = `tegaki_animation_${timestamp}.gif`;
                
                this.manager.downloadFile(blob, filename);
                
                window.TegakiEventBus?.emit('export:completed', {
                    format: 'gif',
                    size: blob.size,
                    cuts: animData.cuts.length,
                    filename: filename
                });
                
                this.isExporting = false;
                return { blob, filename };
                
            } catch (error) {
                this.isExporting = false;
                window.TegakiEventBus?.emit('export:failed', { 
                    format: 'gif',
                    error 
                });
                throw error;
            }
        }
        
        async copy(options = {}) {
            if (this.isExporting) {
                throw new Error('GIF export already in progress');
            }
            
            // ClipboardItem対応チェック
            if (!navigator.clipboard || !window.ClipboardItem) {
                throw new Error('ブラウザがクリップボードAPIに対応していません');
            }
            
            if (!this.manager || !this.manager.animationSystem) {
                throw new Error('GIFExporter: manager or animationSystem not available');
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
                window.TegakiEventBus?.emit('export:started', { format: 'gif' });
                
                // Blob URLでworkerを作成
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
                
                // プログレスイベント
                gif.on('progress', (progress) => {
                    const progressPercent = Math.round(progress * 100);
                    window.TegakiEventBus?.emit('export:progress', { 
                        format: 'gif',
                        progress: progressPercent 
                    });
                });
                
                // 状態バックアップ
                const backupSnapshots = this.manager.animationSystem.captureAllLayerStates();
                
                // フレーム追加
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
                
                // 状態復元
                this.manager.animationSystem.restoreFromSnapshots(backupSnapshots);
                
                // render完了をPromiseで待機
                const blob = await this.renderGIF(gif);
                
                // クリップボードにコピー（複数のMIMEタイプを試行）
                try {
                    // 方法1: image/gifとして試行
                    try {
                        const item = new ClipboardItem({ 
                            'image/gif': blob 
                        });
                        await navigator.clipboard.write([item]);
                        
                        window.TegakiEventBus?.emit('export:copied', {
                            format: 'gif',
                            size: blob.size,
                            cuts: animData.cuts.length,
                            message: 'GIFアニメーションをコピーしました'
                        });
                        
                        this.isExporting = false;
                        return true;
                    } catch (gifError) {
                        // image/gifが失敗した場合、PNGに変換してコピー
                        // （Chrome/Edgeではimage/gifが非対応のため、この処理が実行される）
                        
                        // 最初のフレームをPNGとしてコピー
                        this.manager.animationSystem.applyCutToLayers(0);
                        await this.waitFrame();
                        
                        const canvas = await this.renderCutToCanvas(settings);
                        if (!canvas) {
                            throw new Error('Canvas rendering failed');
                        }
                        
                        const pngBlob = await new Promise(resolve => {
                            canvas.toBlob(resolve, 'image/png');
                        });
                        
                        if (!pngBlob) {
                            throw new Error('PNG conversion failed');
                        }
                        
                        const pngItem = new ClipboardItem({ 
                            'image/png': pngBlob 
                        });
                        await navigator.clipboard.write([pngItem]);
                        
                        window.TegakiEventBus?.emit('export:copied', {
                            format: 'gif-as-png',
                            size: pngBlob.size,
                            message: '最初のフレームをPNGとしてコピーしました'
                        });
                        
                        this.isExporting = false;
                        return true;
                    }
                    
                } catch (clipboardError) {
                    this.isExporting = false;
                    throw new Error('クリップボードへのコピーに失敗しました: ' + clipboardError.message);
                }
                
            } catch (error) {
                this.isExporting = false;
                window.TegakiEventBus?.emit('export:failed', { 
                    format: 'gif',
                    error 
                });
                throw error;
            }
        }
        
        async createWorkerBlobURL() {
            // CDNからgif.worker.jsを取得してBlob URLを作成
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
                const TIMEOUT_MS = 120000; // 2分
                
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
            try {
                // resolution: 1 に変更（倍率問題を回避）
                const renderTexture = PIXI.RenderTexture.create({
                    width: settings.width,
                    height: settings.height,
                    resolution: 1
                });
                
                const tempContainer = new PIXI.Container();
                
                // layersContainerを直接使用（offsetなし）
                const layersContainer = this.manager.animationSystem.layerSystem.layersContainer || 
                                       this.manager.animationSystem.layerSystem.currentCutContainer;
                
                if (!layersContainer) {
                    throw new Error('layersContainer not found');
                }
                
                // 元の親と位置を保存
                const originalParent = layersContainer.parent;
                const originalPosition = { 
                    x: layersContainer.x, 
                    y: layersContainer.y,
                    scaleX: layersContainer.scale.x,
                    scaleY: layersContainer.scale.y
                };
                
                // 親から一時的に削除
                if (originalParent) {
                    originalParent.removeChild(layersContainer);
                }
                
                // tempContainerに追加（位置リセット）
                tempContainer.addChild(layersContainer);
                layersContainer.position.set(0, 0);
                
                // キャンバスサイズと出力サイズが異なる場合はスケーリング
                if (settings.width !== window.TEGAKI_CONFIG.canvas.width || 
                    settings.height !== window.TEGAKI_CONFIG.canvas.height) {
                    const scaleX = settings.width / window.TEGAKI_CONFIG.canvas.width;
                    const scaleY = settings.height / window.TEGAKI_CONFIG.canvas.height;
                    const scale = Math.min(scaleX, scaleY); // アスペクト比維持
                    layersContainer.scale.set(scale, scale);
                    
                    // センタリング
                    const scaledWidth = window.TEGAKI_CONFIG.canvas.width * scale;
                    const scaledHeight = window.TEGAKI_CONFIG.canvas.height * scale;
                    layersContainer.position.set(
                        (settings.width - scaledWidth) / 2,
                        (settings.height - scaledHeight) / 2
                    );
                }
                
                // レンダリング
                this.manager.app.renderer.render({
                    container: tempContainer,
                    target: renderTexture
                });
                
                // canvasに変換
                const canvas = this.manager.app.renderer.extract.canvas(renderTexture);
                
                // 元の状態に復元
                tempContainer.removeChild(layersContainer);
                layersContainer.position.set(originalPosition.x, originalPosition.y);
                layersContainer.scale.set(originalPosition.scaleX, originalPosition.scaleY);
                
                if (originalParent) {
                    originalParent.addChild(layersContainer);
                }
                
                // クリーンアップ
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

console.log('✅ gif-exporter.js (Blob URL worker版) loaded');