/**
 * ================================================================================
 * system/exporters/webp-exporter.js - canvasContainer直接キャプチャ【v8.21.0】
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
 * 【v8.21.0 重要改修】
 *   🔧 canvasContainerを直接renderer.extract.canvas()でキャプチャ
 *   🔧 RenderTexture経由を完全排除（座標系破壊を根本解決）
 *   🔧 カメラフレーム崩壊の完全防止
 *   ⚠️ WEBP動画出力は技術的制約により暫定実装（横並び）
 *      将来的にWebCodecs APIまたはFFmpeg.wasmでの真のアニメーション化を検討
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
                return await this._generateAnimatedWebP(options);
            }
            
            return await this._generateStaticWebP(options);
        }
        
        /**
         * WEBP静止画生成【v8.21.0 完全修正版】
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
            
            // 🔧 v8.21.0: RenderTextureを使わず直接キャプチャ
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
        }
        
        /**
         * WEBP動画生成【v8.21.0】
         * 
         * ⚠️ 技術的制約による暫定実装:
         * ブラウザネイティブのCanvas.toBlob()はアニメーションWEBPを生成できない。
         * 真のアニメーションWEBP生成には以下の選択肢がある:
         * 
         * 1. WebCodecs API（Chrome 94+）- 実装が複雑
         * 2. FFmpeg.wasm - 外部ライブラリ依存
         * 3. libwebp.js - 外部ライブラリ依存
         * 
         * 現在はフレームを横並びにしたWEBP静止画として出力。
         * 将来的にはWebCodecs APIでの実装を検討。
         */
        async _generateAnimatedWebP(options = {}) {
            const CONFIG = window.TEGAKI_CONFIG;
            const animData = this.manager.animationSystem.getAnimationData();
            const frameCount = animData.frames.length;
            const resolution = options.resolution || 1;
            const quality = options.quality !== undefined ? options.quality / 100 : 0.95;
            
            // グリッド配置（暫定実装）
            const gridCols = Math.ceil(Math.sqrt(frameCount));
            const gridRows = Math.ceil(frameCount / gridCols);
            
            const frameWidth = CONFIG.canvas.width * resolution;
            const frameHeight = CONFIG.canvas.height * resolution;
            
            const finalCanvas = document.createElement('canvas');
            finalCanvas.width = frameWidth * gridCols;
            finalCanvas.height = frameHeight * gridRows;
            const ctx = finalCanvas.getContext('2d', { alpha: true });
            
            ctx.clearRect(0, 0, finalCanvas.width, finalCanvas.height);
            
            // 現在の状態をバックアップ
            const backupSnapshots = this.manager.animationSystem.captureAllLayerStates();
            
            try {
                for (let i = 0; i < frameCount; i++) {
                    // フレームを適用
                    this.manager.animationSystem.applyFrameToLayers(i);
                    await this._waitFrame();
                    
                    // フレームをキャプチャ
                    const frameCanvas = await this._captureFrameScreenshot(resolution);
                    
                    // グリッドに配置
                    const gridX = i % gridCols;
                    const gridY = Math.floor(i / gridCols);
                    
                    ctx.drawImage(
                        frameCanvas,
                        gridX * frameWidth,
                        gridY * frameHeight,
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
         * フレームのスクリーンショット取得【v8.21.0 完全修正版】
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
            
            // 🔧 v8.21.0: RenderTextureを使わず直接キャプチャ
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

console.log('✅ webp-exporter.js v8.21.0 loaded');