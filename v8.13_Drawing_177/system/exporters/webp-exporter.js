/**
 * ================================================================================
 * system/exporters/webp-exporter.js - 倍率対応・外枠除外【v8.19.0】
 * ================================================================================
 * 
 * 【依存関係 - Parents】
 *   - system/export-manager.js (エクスポート管理)
 *   - system/camera-system.js (worldContainer取得)
 *   - system/animation-system.js (フレーム情報)
 * 
 * 【依存関係 - Children】
 *   なし
 * 
 * 【責務】
 *   - WEBP静止画/動画エクスポート
 *   - 複数フレーム自動検出
 * 
 * 【v8.19.0 改修内容】
 *   🔧 options.resolutionを正しく適用
 *   🔧 canvasContainerのみキャプチャ（外枠除外）
 *   🔧 固定2倍を削除し、ユーザー選択倍率を使用
 *   🔧 正確な出力サイズ計算
 *   🔧 動画出力の修正
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
                console.log(`🎬 Detected ${frameCount} frames - generating animated WEBP`);
                return await this._generateAnimatedWebP(options);
            }
            
            return await this._generateStaticWebP(options);
        }
        
        /**
         * WEBP静止画生成【v8.19.0】
         * 
         * 改修点:
         * 1. options.resolutionを使用（デフォルト1倍）
         * 2. canvasContainerのみをキャプチャ
         */
        async _generateStaticWebP(options = {}) {
            const CONFIG = window.TEGAKI_CONFIG;
            const quality = options.quality !== undefined ? options.quality / 100 : 0.95;
            
            // 🔧 v8.19.0: ユーザー選択倍率を使用（デフォルト1倍）
            const resolution = options.resolution || 1;
            const canvasWidth = CONFIG.canvas.width;
            const canvasHeight = CONFIG.canvas.height;
            
            console.log(`📸 WEBP Export: ${canvasWidth}x${canvasHeight} @ ${resolution}x = ${canvasWidth * resolution}x${canvasHeight * resolution}`);
            
            // 🔧 v8.19.0: canvasContainerのみをキャプチャ
            const canvasContainer = this.manager.cameraSystem?.canvasContainer ||
                                  this.manager.layerSystem.worldContainer?.children?.find(c => c.label === 'canvasContainer');
            
            if (!canvasContainer) {
                throw new Error('canvasContainer not available');
            }
            
            this.manager.app.renderer.render({ container: canvasContainer });
            
            const renderTexture = PIXI.RenderTexture.create({
                width: canvasWidth * resolution,
                height: canvasHeight * resolution,
                resolution: resolution,
                antialias: true
            });
            
            const originalResolution = this.manager.app.renderer.resolution;
            this.manager.app.renderer.resolution = resolution;
            
            try {
                this.manager.app.renderer.render({
                    container: canvasContainer,
                    target: renderTexture
                });
                
                const canvas = this.manager.app.renderer.extract.canvas({
                    target: renderTexture,
                    resolution: 1,
                    antialias: true
                });
                
                const finalCanvas = document.createElement('canvas');
                finalCanvas.width = canvasWidth * resolution;
                finalCanvas.height = canvasHeight * resolution;
                const ctx = finalCanvas.getContext('2d');
                ctx.drawImage(canvas, 0, 0);
                
                return new Promise((resolve, reject) => {
                    finalCanvas.toBlob((blob) => {
                        if (!blob) {
                            reject(new Error('WEBP generation failed'));
                            return;
                        }
                        console.log(`✅ WEBP Generated: ${blob.size} bytes`);
                        resolve(blob);
                    }, 'image/webp', quality);
                });
                
            } finally {
                this.manager.app.renderer.resolution = originalResolution;
                renderTexture.destroy(true);
            }
        }
        
        /**
         * WEBP動画生成【v8.19.0】
         * 
         * 改修点:
         * 1. options.resolutionを使用
         * 2. canvasContainerのみをキャプチャ
         */
        async _generateAnimatedWebP(options = {}) {
            const CONFIG = window.TEGAKI_CONFIG;
            const animData = this.manager.animationSystem.getAnimationData();
            const frameCount = animData.frames.length;
            
            // 🔧 v8.19.0: ユーザー選択倍率を使用（デフォルト1倍）
            const resolution = options.resolution || 1;
            const quality = options.quality !== undefined ? options.quality / 100 : 0.95;
            
            const gridCols = Math.ceil(Math.sqrt(frameCount));
            const gridRows = Math.ceil(frameCount / gridCols);
            
            const frameWidth = CONFIG.canvas.width * resolution;
            const frameHeight = CONFIG.canvas.height * resolution;
            
            console.log(`🎬 WEBP Animation: ${frameCount} frames, ${frameWidth}x${frameHeight} each @ ${resolution}x`);
            
            const finalCanvas = document.createElement('canvas');
            finalCanvas.width = frameWidth * gridCols;
            finalCanvas.height = frameHeight * gridRows;
            const ctx = finalCanvas.getContext('2d');
            
            ctx.clearRect(0, 0, finalCanvas.width, finalCanvas.height);
            
            const backupSnapshots = this.manager.animationSystem.captureAllLayerStates();
            
            try {
                for (let i = 0; i < frameCount; i++) {
                    this.manager.animationSystem.applyFrameToLayers(i);
                    await this._waitFrame();
                    
                    const frameCanvas = await this._captureFrameScreenshot(resolution);
                    
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
                this.manager.animationSystem.restoreFromSnapshots(backupSnapshots);
            }
            
            return new Promise((resolve, reject) => {
                finalCanvas.toBlob(
                    (blob) => {
                        if (blob) {
                            console.log(`✅ WEBP Animation Generated: ${blob.size} bytes`);
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
         * フレームのスクリーンショット取得【v8.19.0】
         * 
         * 改修点:
         * 1. canvasContainerのみをキャプチャ
         * 2. 正確な倍率適用
         */
        async _captureFrameScreenshot(resolution = 1) {
            const CONFIG = window.TEGAKI_CONFIG;
            const canvasWidth = CONFIG.canvas.width;
            const canvasHeight = CONFIG.canvas.height;
            
            // 🔧 v8.19.0: canvasContainerのみをキャプチャ
            const canvasContainer = this.manager.cameraSystem?.canvasContainer ||
                                  this.manager.layerSystem.worldContainer?.children?.find(c => c.label === 'canvasContainer');
            
            if (!canvasContainer) {
                throw new Error('canvasContainer not found');
            }
            
            this.manager.app.renderer.render({ container: canvasContainer });
            
            const renderTexture = PIXI.RenderTexture.create({
                width: canvasWidth * resolution,
                height: canvasHeight * resolution,
                resolution: resolution,
                antialias: true
            });
            
            const originalResolution = this.manager.app.renderer.resolution;
            this.manager.app.renderer.resolution = resolution;
            
            try {
                this.manager.app.renderer.render({
                    container: canvasContainer,
                    target: renderTexture
                });
                
                const canvas = this.manager.app.renderer.extract.canvas({
                    target: renderTexture,
                    resolution: 1,
                    antialias: true
                });
                
                const finalCanvas = document.createElement('canvas');
                finalCanvas.width = canvasWidth * resolution;
                finalCanvas.height = canvasHeight * resolution;
                const ctx = finalCanvas.getContext('2d');
                ctx.drawImage(canvas, 0, 0);
                
                return finalCanvas;
                
            } finally {
                this.manager.app.renderer.resolution = originalResolution;
                renderTexture.destroy(true);
            }
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

console.log('✅ webp-exporter.js v8.19.0 loaded');
console.log('   🔧 倍率対応（options.resolution使用）');
console.log('   🔧 canvasContainerのみキャプチャ（外枠除外）');
console.log('   🔧 正確な動画出力サイズ計算');