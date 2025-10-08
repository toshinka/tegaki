// ==================================================
// system/exporters/png-exporter.js
// PNG/APNGスマートエクスポーター - CUT数自動判定版
// CUT複数 → APNG / CUT単一 → PNG
// ==================================================
window.PNGExporter = (function() {
    'use strict';
    
    class PNGExporter {
        constructor(exportManager) {
            if (!exportManager) {
                throw new Error('PNGExporter: exportManager is required');
            }
            this.manager = exportManager;
            this.isExporting = false;
        }
        
        /**
         * CUT数を取得してフォーマット判定
         */
        _determineFormat() {
            if (!this.manager?.animationSystem) {
                return 'png'; // アニメーションシステムが無い場合は単一PNG
            }
            
            const animData = this.manager.animationSystem.getAnimationData();
            const cutCount = animData?.cuts?.length || 0;
            
            // CUTが2つ以上ある場合はAPNG
            return cutCount >= 2 ? 'apng' : 'png';
        }
        
        /**
         * エクスポート（自動判定）
         */
        async export(options = {}) {
            if (this.isExporting) {
                throw new Error('Export already in progress');
            }
            
            const format = this._determineFormat();
            
            if (format === 'apng') {
                return await this._exportAPNG(options);
            } else {
                return await this._exportPNG(options);
            }
        }
        
        /**
         * コピー（自動判定）
         */
        async copy(options = {}) {
            if (this.isExporting) {
                throw new Error('Export already in progress');
            }
            
            const format = this._determineFormat();
            
            if (format === 'apng') {
                return await this._copyAPNG(options);
            } else {
                return await this._copyPNG(options);
            }
        }
        
        // ========================================
        // 単一PNG出力
        // ========================================
        
        async _exportPNG(options = {}) {
            if (!this.manager?.layerSystem) {
                throw new Error('LayerSystem not available');
            }
            
            if (window.TegakiEventBus) {
                window.TegakiEventBus.emit('export:started', { format: 'png' });
            }
            
            const canvas = this.manager.renderToCanvas(options);
            
            return new Promise((resolve, reject) => {
                canvas.toBlob((blob) => {
                    if (!blob) {
                        const error = new Error('PNG generation failed');
                        if (window.TegakiEventBus) {
                            window.TegakiEventBus.emit('export:failed', { format: 'png', error: error.message });
                        }
                        reject(error);
                        return;
                    }
                    
                    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
                    const filename = options.filename || `tegaki_${timestamp}.png`;
                    
                    this.manager.downloadFile(blob, filename);
                    
                    if (window.TegakiEventBus) {
                        window.TegakiEventBus.emit('export:completed', { 
                            format: 'png', 
                            size: blob.size,
                            filename: filename
                        });
                    }
                    
                    resolve({ blob, filename, format: 'png' });
                }, 'image/png');
            });
        }
        
        async _copyPNG(options = {}) {
            if (!this.manager?.layerSystem) {
                throw new Error('LayerSystem not available');
            }
            
            const canvas = this.manager.renderToCanvas(options);
            
            return new Promise((resolve, reject) => {
                canvas.toBlob(async (blob) => {
                    if (!blob) {
                        reject(new Error('PNG generation failed'));
                        return;
                    }
                    
                    const success = await this.manager.copyToClipboard(blob);
                    
                    if (success) {
                        if (window.TegakiEventBus) {
                            window.TegakiEventBus.emit('export:copied', { format: 'png' });
                        }
                        resolve({ success: true, format: 'png' });
                    } else {
                        reject(new Error('Clipboard copy failed'));
                    }
                }, 'image/png');
            });
        }
        
        // ========================================
        // APNG出力（複数CUT）
        // ========================================
        
        async _exportAPNG(options = {}) {
            this._checkUPNGAvailability();
            
            if (!this.manager?.animationSystem) {
                throw new Error('AnimationSystem not available');
            }
            
            const animData = this.manager.animationSystem.getAnimationData();
            if (!animData?.cuts || animData.cuts.length < 2) {
                throw new Error('APNGには2つ以上のCUTが必要です');
            }
            
            if (window.TegakiEventBus) {
                window.TegakiEventBus.emit('export:started', { format: 'apng' });
            }
            
            this.isExporting = true;
            
            try {
                const blob = await this._generateAPNGBlob(options);
                
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
                const filename = options.filename || `tegaki_animation_${timestamp}.png`;
                
                this.manager.downloadFile(blob, filename);
                
                if (window.TegakiEventBus) {
                    window.TegakiEventBus.emit('export:completed', {
                        format: 'apng',
                        size: blob.size,
                        cuts: animData.cuts.length,
                        filename: filename
                    });
                }
                
                this.isExporting = false;
                return { blob, filename, format: 'apng' };
                
            } catch (error) {
                this.isExporting = false;
                if (window.TegakiEventBus) {
                    window.TegakiEventBus.emit('export:failed', { 
                        format: 'apng',
                        error: error.message
                    });
                }
                throw error;
            }
        }
        
        async _copyAPNG(options = {}) {
            this._checkUPNGAvailability();
            
            try {
                if (window.TegakiEventBus) {
                    window.TegakiEventBus.emit('export:started', { format: 'apng' });
                }
                
                const blob = await this._generateAPNGBlob(options);
                const dataUrl = await this.manager.blobToDataURL(blob);
                
                if (window.TegakiEventBus) {
                    window.TegakiEventBus.emit('export:copied', {
                        format: 'apng',
                        blob: blob,
                        dataUrl: dataUrl,
                        message: 'APNGはクリップボードコピー未対応です。ダウンロードをご利用ください'
                    });
                }
                
                return { 
                    success: false, 
                    blob, 
                    dataUrl,
                    format: 'apng',
                    message: 'APNGはクリップボードコピー未対応'
                };
                
            } catch (error) {
                if (window.TegakiEventBus) {
                    window.TegakiEventBus.emit('export:failed', { 
                        format: 'apng',
                        error: error.message
                    });
                }
                throw error;
            }
        }
        
        /**
         * APNG Blob生成
         */
        async _generateAPNGBlob(options = {}) {
            const CONFIG = window.TEGAKI_CONFIG;
            const animData = this.manager.animationSystem.getAnimationData();
            
            const settings = {
                width: options.width || CONFIG.canvas.width,
                height: options.height || CONFIG.canvas.height,
                fps: options.fps || 12
            };
            
            // サイズ制限適用
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
            
            const frames = [];
            const delays = [];
            
            // レイヤー状態のバックアップ
            const backupSnapshots = this.manager.animationSystem.captureAllLayerStates();
            
            // 各CUTをレンダリング
            for (let i = 0; i < animData.cuts.length; i++) {
                const cut = animData.cuts[i];
                
                // CUTを適用
                this.manager.animationSystem.applyCutToLayers(i);
                await this._waitFrame();
                
                // Canvas取得
                const canvas = await this._renderCutToCanvas(settings);
                
                if (!canvas) {
                    throw new Error(`Failed to render cut ${i}`);
                }
                
                // Canvas → ImageData → ArrayBuffer
                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                
                // UPNG.jsはRGBA形式のArrayBufferを要求
                frames.push(imageData.data.buffer);
                
                // 遅延時間（ミリ秒）
                const duration = cut.duration || (1000 / settings.fps);
                delays.push(Math.round(duration));
                
                // 進捗通知
                if (window.TegakiEventBus) {
                    window.TegakiEventBus.emit('export:frame-rendered', { 
                        frame: i + 1, 
                        total: animData.cuts.length 
                    });
                }
            }
            
            // レイヤー状態を復元
            this.manager.animationSystem.restoreFromSnapshots(backupSnapshots);
            
            // UPNG.encode でAPNG生成
            const apngBuffer = UPNG.encode(
                frames,
                settings.width,
                settings.height,
                0, // 0 = APNG (animated PNG)
                delays
            );
            
            // Blob生成（MIMEタイプは image/png）
            const blob = new Blob([apngBuffer], { type: 'image/png' });
            
            return blob;
        }
        
        /**
         * CUTをCanvasにレンダリング
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
            
            // 元の状態を保存
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
            
            // スケール調整（アスペクト比維持）
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
            
            // Canvasに展開
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
        }
        
        /**
         * UPNG.jsの読み込み確認
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
        
        /**
         * デバッグ情報
         */
        getDebugInfo() {
            const format = this._determineFormat();
            const animData = this.manager?.animationSystem?.getAnimationData();
            
            return {
                isExporting: this.isExporting,
                determinedFormat: format,
                cutCount: animData?.cuts?.length || 0,
                upngAvailable: typeof UPNG !== 'undefined',
                animationSystemAvailable: !!this.manager?.animationSystem,
                layerSystemAvailable: !!this.manager?.layerSystem
            };
        }
    }
    
    return PNGExporter;
})();

console.log('✅ png-exporter.js (PNG/APNG自動判定版) loaded');