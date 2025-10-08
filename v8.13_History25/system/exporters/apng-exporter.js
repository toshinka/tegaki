// ==================================================
// system/exporters/apng-exporter.js
// APNGアニメーションエクスポーター - 完全修正版
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
         * APNGエクスポート（ダウンロード）
         */
        async export(options = {}) {
            if (this.isExporting) {
                throw new Error('Export already in progress');
            }
            
            this._checkUPNGAvailability();
            
            if (!this.manager || !this.manager.animationSystem) {
                throw new Error('AnimationSystem not available');
            }
            
            const animData = this.manager.animationSystem.getAnimationData();
            if (!animData || !animData.cuts || animData.cuts.length < 2) {
                throw new Error('APNGには2つ以上のCUTが必要です');
            }
            
            if (window.TegakiEventBus) {
                window.TegakiEventBus.emit('export:started', { format: 'apng' });
            }
            
            this.isExporting = true;
            
            try {
                const blob = await this.generateBlob(options);
                
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
                const filename = options.filename || ('tegaki_animation_' + timestamp + '.png');
                
                this.manager.downloadFile(blob, filename);
                
                if (window.TegakiEventBus) {
                    window.TegakiEventBus.emit('export:completed', {
                        format: 'apng',
                        size: blob.size,
                        cuts: animData.cuts.length,
                        filename: filename
                    });
                }
                
                return { blob: blob, filename: filename, format: 'apng' };
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
         * APNG Blob生成（プレビュー/ダウンロード兼用）
         */
        async generateBlob(options = {}) {
            const CONFIG = window.TEGAKI_CONFIG;
            const animData = this.manager.animationSystem.getAnimationData();
            
            const settings = {
                width: options.width || CONFIG.canvas.width,
                height: options.height || CONFIG.canvas.height,
                fps: options.fps || 12
            };
            
            // サイズ制限
            const maxSize = CONFIG.animation.exportSettings || { maxWidth: 1920, maxHeight: 1080 };
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
            
            const frames = [];
            const delays = [];
            
            // レイヤー状態バックアップ
            const backupSnapshots = this.manager.animationSystem.captureAllLayerStates();
            
            // 各CUTレンダリング
            for (let i = 0; i < animData.cuts.length; i++) {
                const cut = animData.cuts[i];
                
                // CUT適用
                this.manager.animationSystem.applyCutToLayers(i);
                await this._waitFrame();
                
                // Canvasレンダリング
                const canvas = await this._renderCutToCanvas(settings);
                if (!canvas) {
                    throw new Error('Failed to render cut ' + i);
                }
                
                // ImageData取得
                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                
                frames.push(imageData.data.buffer);
                
                // 遅延時間（マイクロ秒）
                const duration = cut.duration || (1000 / settings.fps);
                delays.push(Math.round(duration * 1000));
                
                // 進捗通知
                if (window.TegakiEventBus) {
                    window.TegakiEventBus.emit('export:frame-rendered', { 
                        frame: i + 1, 
                        total: animData.cuts.length 
                    });
                }
            }
            
            // レイヤー状態復元
            this.manager.animationSystem.restoreFromSnapshots(backupSnapshots);
            
            // UPNG.encode でAPNG生成
            const apngBuffer = UPNG.encode(
                frames,
                settings.width,
                settings.height,
                0, // 0 = APNG
                delays
            );
            
            return new Blob([apngBuffer], { type: 'image/png' });
        }
        
        /**
         * CUTをCanvasにレンダリング（GIFExporterと同じロジック）
         */
        async _renderCutToCanvas(settings) {
            const CONFIG = window.TEGAKI_CONFIG;
            
            const renderTexture = PIXI.RenderTexture.create({
                width: settings.width,
                height: settings.height,
                resolution: 1
            });
            
            const tempContainer = new PIXI.Container();
            
            // レイヤーコンテナ取得
            const layersContainer = this.manager.animationSystem.layerSystem.currentCutContainer;
            if (!layersContainer) {
                throw new Error('currentCutContainer not found');
            }
            
            // 元の状態保存
            const originalParent = layersContainer.parent;
            const originalPosition = { 
                x: layersContainer.x, 
                y: layersContainer.y,
                scaleX: layersContainer.scale.x,
                scaleY: layersContainer.scale.y
            };
            
            // 一時コンテナに移動
            if (originalParent) {
                originalParent.removeChild(layersContainer);
            }
            
            tempContainer.addChild(layersContainer);
            layersContainer.position.set(0, 0);
            
            // スケール調整
            if (settings.width !== CONFIG.canvas.width || settings.height !== CONFIG.canvas.height) {
                const scaleX = settings.width / CONFIG.canvas.width;
                const scaleY = settings.height / CONFIG.canvas.height;
                const scale = Math.min(scaleX, scaleY);
                
                layersContainer.scale.set(scale, scale);
                
                const scaledWidth = CONFIG.canvas.width * scale;
                const scaledHeight = CONFIG.canvas.height * scale;
                
                // センタリング
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
            
            // Canvas抽出
            const canvas = this.manager.app.renderer.extract.canvas(renderTexture);
            
            // 元の状態復元
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
        }
        
        /**
         * UPNG.js確認
         */
        _checkUPNGAvailability() {
            if (typeof UPNG === 'undefined') {
                throw new Error('UPNG.js not loaded');
            }
        }
        
        /**
         * フレーム待機
         */
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

console.log('✅ apng-exporter.js (完全修正版) loaded');