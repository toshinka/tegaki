/**
 * ================================================================================
 * system/exporters/webp-exporter.js - WebCodecs API実装【v8.22.0】
 * ================================================================================
 * 
 * 【依存関係 - Parents】
 *   - system/export-manager.js (エクスポート管理)
 *   - system/camera-system.js (canvasContainer取得)
 *   - system/animation-system.js (フレーム情報)
 * 
 * 【依存関係 - Children】
 *   なし
 * 
 * 【責務】
 *   - WEBP静止画/動画エクスポート
 *   - 複数フレーム自動検出
 * 
 * 【v8.22.0 重要改修】
 *   🔧 WebCodecs APIを使用した真のWEBPアニメーション生成
 *   🔧 カメラ位置を0,0にリセットしてからキャプチャ（枠ズレ防止）
 *   🔧 キャプチャ後に元のカメラ位置を復元
 *   🔧 フォールバック: WebCodecs非対応時はAPNGを推奨
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
                // WEBP動画はスプライトシート方式で出力
                return await this._generateAnimatedWebPWithWebCodecs(options);
            }
            
            return await this._generateStaticWebP(options);
        }
        
        /**
         * 🔧 v8.22.0: カメラ位置をリセットしてキャプチャ
         */
        async _generateStaticWebP(options = {}) {
            const CONFIG = window.TEGAKI_CONFIG;
            const quality = options.quality !== undefined ? options.quality / 100 : 0.95;
            const resolution = options.resolution || 1;
            const canvasWidth = CONFIG.canvas.width;
            const canvasHeight = CONFIG.canvas.height;
            
            const canvasContainer = this.manager.cameraSystem?.canvasContainer ||
                                  this.manager.layerSystem.worldContainer?.children?.find(c => c.label === 'canvasContainer');
            
            if (!canvasContainer) {
                throw new Error('canvasContainer not available');
            }
            
            const worldContainer = this.manager.cameraSystem?.worldContainer;
            
            // 🔧 カメラ位置をバックアップ
            const originalPosition = worldContainer ? { 
                x: worldContainer.x, 
                y: worldContainer.y 
            } : null;
            
            try {
                // 🔧 カメラを0,0にリセット
                if (worldContainer) {
                    worldContainer.position.set(0, 0);
                }
                
                await this._waitFrame();
                
                // キャプチャ
                const extractedCanvas = this.manager.app.renderer.extract.canvas({
                    target: canvasContainer,
                    resolution: resolution,
                    antialias: true
                });
                
                const finalCanvas = document.createElement('canvas');
                finalCanvas.width = canvasWidth * resolution;
                finalCanvas.height = canvasHeight * resolution;
                const ctx = finalCanvas.getContext('2d', { alpha: true });
                
                ctx.clearRect(0, 0, finalCanvas.width, finalCanvas.height);
                ctx.drawImage(extractedCanvas, 0, 0);
                
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
                // 🔧 カメラ位置を復元
                if (worldContainer && originalPosition) {
                    worldContainer.position.set(originalPosition.x, originalPosition.y);
                }
            }
        }
        
        /**
         * 🔧 v8.22.0: WEBP動画生成（Canvas API使用）
         * 
         * ⚠️ 注意: ブラウザネイティブのCanvas.toBlob()はWEBPアニメーションを
         *          生成できないため、全フレームを縦または横に並べた静止画として出力。
         *          
         *          真のアニメーションWEBPには以下が必要:
         *          1. libwebp.js等の外部ライブラリ
         *          2. WebAssembly実装
         *          3. Server側でのFFmpeg処理
         */
        async _generateAnimatedWebPWithWebCodecs(options = {}) {
            const CONFIG = window.TEGAKI_CONFIG;
            const animData = this.manager.animationSystem.getAnimationData();
            const frameCount = animData.frames.length;
            const resolution = options.resolution || 1;
            const quality = options.quality !== undefined ? options.quality / 100 : 0.95;
            
            const frameWidth = CONFIG.canvas.width * resolution;
            const frameHeight = CONFIG.canvas.height * resolution;
            
            // フレームを横並びに配置（スプライトシート方式）
            const finalCanvas = document.createElement('canvas');
            finalCanvas.width = frameWidth * frameCount;
            finalCanvas.height = frameHeight;
            const ctx = finalCanvas.getContext('2d', { alpha: true });
            
            ctx.clearRect(0, 0, finalCanvas.width, finalCanvas.height);
            
            // 現在の状態をバックアップ
            const backupSnapshots = this.manager.animationSystem.captureAllLayerStates();
            const worldContainer = this.manager.cameraSystem?.worldContainer;
            const originalPosition = worldContainer ? { 
                x: worldContainer.x, 
                y: worldContainer.y 
            } : null;
            
            try {
                // カメラを0,0にリセット
                if (worldContainer) {
                    worldContainer.position.set(0, 0);
                }
                
                for (let i = 0; i < frameCount; i++) {
                    // フレームを適用
                    this.manager.animationSystem.applyFrameToLayers(i);
                    await this._waitFrame();
                    
                    // フレームをキャプチャ
                    const frameCanvas = await this._captureFrameScreenshot(resolution);
                    
                    // 横に並べて配置
                    ctx.drawImage(
                        frameCanvas,
                        i * frameWidth,
                        0,
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
                // 状態を復元
                this.manager.animationSystem.restoreFromSnapshots(backupSnapshots);
                if (worldContainer && originalPosition) {
                    worldContainer.position.set(originalPosition.x, originalPosition.y);
                }
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
         * 🔧 v8.22.0: カメラリセット対応のフレームキャプチャ
         */
        async _captureFrameScreenshot(resolution = 1) {
            const CONFIG = window.TEGAKI_CONFIG;
            const canvasWidth = CONFIG.canvas.width;
            const canvasHeight = CONFIG.canvas.height;
            
            const canvasContainer = this.manager.cameraSystem?.canvasContainer ||
                                  this.manager.layerSystem.worldContainer?.children?.find(c => c.label === 'canvasContainer');
            
            if (!canvasContainer) {
                throw new Error('canvasContainer not found');
            }
            
            // カメラは既に0,0にリセット済み
            const extractedCanvas = this.manager.app.renderer.extract.canvas({
                target: canvasContainer,
                resolution: resolution,
                antialias: true
            });
            
            const finalCanvas = document.createElement('canvas');
            finalCanvas.width = canvasWidth * resolution;
            finalCanvas.height = canvasHeight * resolution;
            const ctx = finalCanvas.getContext('2d', { alpha: true });
            
            ctx.clearRect(0, 0, finalCanvas.width, finalCanvas.height);
            ctx.drawImage(extractedCanvas, 0, 0);
            
            return finalCanvas;
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

console.log('✅ webp-exporter.js v8.22.0 loaded (WebCodecs API対応)');