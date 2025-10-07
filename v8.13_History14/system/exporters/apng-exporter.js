// ==================================================
// system/exporters/apng-exporter.js
// APNGアニメーションエクスポーター - UPNG.js利用
// ==================================================
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
        
        /**
         * APNG Blob生成
         * GIF exporterと同じパターンで実装
         */
        async generateApngBlob(options = {}) {
            if (this.isExporting) {
                throw new Error('APNG export already in progress');
            }
            
            // UPNG.js 読み込み確認
            if (typeof UPNG === 'undefined') {
                throw new Error('UPNG.js not loaded. Please include: <script src="https://cdnjs.cloudflare.com/ajax/libs/upng-js/2.1.0/UPNG.min.js"></script>');
            }
            
            if (!this.manager || !this.manager.animationSystem) {
                throw new Error('APNGExporter: manager or animationSystem not available');
            }
            
            const animData = this.manager.animationSystem.getAnimationData();
            if (!animData || !animData.cuts || animData.cuts.length === 0) {
                throw new Error('アニメーションにCUTが含まれていません');
            }
            
            const settings = {
                width: options.width || window.TEGAKI_CONFIG.canvas.width,
                height: options.height || window.TEGAKI_CONFIG.canvas.height,
                fps: options.fps || 12
            };
            
            // サイズ制限
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
                const frames = [];
                const delays = [];
                
                // レイヤー状態のバックアップ
                const backupSnapshots = this.manager.animationSystem.captureAllLayerStates();
                
                // 各CUTをレンダリング
                for (let i = 0; i < animData.cuts.length; i++) {
                    const cut = animData.cuts[i];
                    
                    this.manager.animationSystem.applyCutToLayers(i);
                    await this.waitFrame();
                    
                    const canvas = await this.renderCutToCanvas(settings);
                    
                    if (canvas) {
                        // CanvasからImageDataを取得
                        const ctx = canvas.getContext('2d');
                        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                        
                        // UPNG用にArrayBufferを追加
                        frames.push(imageData.data.buffer);
                        
                        // 遅延時間（ミリ秒）
                        delays.push(Math.round(cut.duration * 1000));
                    }
                    
                    window.TegakiEventBus?.emit('export:frame-rendered', { 
                        frame: i + 1, 
                        total: animData.cuts.length 
                    });
                }
                
                // レイヤー状態を復元
                this.manager.animationSystem.restoreFromSnapshots(backupSnapshots);
                
                // UPNG.encode でAPNG生成
                // 引数: frames(ArrayBuffer[]), width, height, cnum(0=APNG), delays
                const apngBuffer = UPNG.encode(
                    frames,
                    settings.width,
                    settings.height,
                    0, // 0 = APNG (animated PNG)
                    delays
                );
                
                // Blobとしてラップ
                const blob = new Blob([apngBuffer], { type: 'image/apng' });
                
                this.isExporting = false;
                console.log('[APNG] Blob generated:', blob.size, 'bytes');
                return blob;
                
            } catch (error) {
                this.isExporting = false;
                console.error('[APNG] Generation failed:', error);
                throw new Error('APNG generation failed: ' + error.message);
            }
        }
        
        /**
         * エクスポート（ダウンロード）
         */
        async export(options = {}) {
            try {
                window.TegakiEventBus?.emit('export:started', { format: 'apng' });
                
                const blob = await this.generateApngBlob(options);
                
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
                const filename = `tegaki_animation_${timestamp}.apng`;
                
                this.manager.downloadFile(blob, filename);
                
                const animData = this.manager.animationSystem.getAnimationData();
                window.TegakiEventBus?.emit('export:completed', {
                    format: 'apng',
                    size: blob.size,
                    cuts: animData.cuts.length,
                    filename: filename
                });
                
                return { blob, filename };
                
            } catch (error) {
                window.TegakiEventBus?.emit('export:failed', { 
                    format: 'apng',
                    error 
                });
                throw error;
            }
        }
        
        /**
         * コピー（クリップボード試行 + プレビュー表示）
         */
        async copy(options = {}) {
            let blob = null;
            
            try {
                window.TegakiEventBus?.emit('export:started', { format: 'apng' });
                
                blob = await this.generateApngBlob(options);
                
                // クリップボードは image/png のみサポート
                // APNGは直接コピー不可のため、プレビュー表示のみ
                const dataUrl = await this.manager.blobToDataURL(blob);
                
                window.TegakiEventBus?.emit('export:copied', {
                    format: 'apng',
                    blob: blob,
                    dataUrl: dataUrl,
                    message: 'APNGはクリップボードコピー未対応です。ダウンロードして使用してください'
                });
                
                return { success: false, blob, dataUrl };
                
            } catch (error) {
                window.TegakiEventBus?.emit('export:failed', { 
                    format: 'apng',
                    error 
                });
                throw error;
            }
        }
        
        /**
         * CUTをCanvasにレンダリング
         * gif-exporter.jsと同じロジック
         */
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
            
            // スケール調整
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
            
            // 元の状態に復元
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
    
    return APNGExporter;
})();

console.log('✅ apng-exporter.js loaded');