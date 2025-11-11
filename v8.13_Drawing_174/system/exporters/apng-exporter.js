/**
 * ================================================================================
 * system/exporters/apng-exporter.js - DPR=1統一版【v8.14.0】
 * ================================================================================
 * 
 * 【依存関係 - Parents】
 *   - export-manager.js (APNGエクスポート実行)
 *   - animation-system.js (フレーム管理)
 *   - UPNG.js (APNG生成ライブラリ)
 * 
 * 【依存関係 - Children】
 *   なし
 * 
 * 【責務】
 *   - APNGアニメーション出力
 *   - フレームレンダリング（DPR=1固定）
 *   - Blob生成
 * 
 * 【v8.14.0 改修内容 - DPR=1統一】
 *   🚨 resolution=1 固定を明示
 *   ✅ 等倍出力の保証
 *   ✅ 描画時と出力時の一貫性確保
 * ================================================================================
 */

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
        
        async export(options = {}) {
            if (this.isExporting) {
                throw new Error('Export already in progress');
            }
            
            this._checkUPNGAvailability();
            
            if (!this.manager || !this.manager.animationSystem) {
                throw new Error('AnimationSystem not available');
            }
            
            const animData = this.manager.animationSystem.getAnimationData();
            if (!animData || !animData.frames || animData.frames.length < 2) {
                throw new Error('APNGには2つ以上のフレームが必要です');
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
                        frames: animData.frames.length,
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
        
        async generateBlob(options = {}) {
            const CONFIG = window.TEGAKI_CONFIG;
            const animData = this.manager.animationSystem.getAnimationData();
            
            const settings = {
                width: options.width || CONFIG.canvas.width,
                height: options.height || CONFIG.canvas.height,
                fps: options.fps || 12
            };
            
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
            
            const backupSnapshots = this.manager.animationSystem.captureAllLayerStates();
            
            for (let i = 0; i < animData.frames.length; i++) {
                const frame = animData.frames[i];
                
                this.manager.animationSystem.applyFrameToLayers(i);
                await this._waitFrame();
                
                const canvas = await this._renderFrameToCanvas(settings);
                if (!canvas) {
                    throw new Error('Failed to render frame ' + i);
                }
                
                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                
                frames.push(imageData.data.buffer);
                
                const durationMs = frame.duration !== undefined && frame.duration !== null 
                    ? Math.round(frame.duration * 1000)
                    : Math.round(1000 / settings.fps);
                
                delays.push(durationMs);
                
                if (window.TegakiEventBus) {
                    window.TegakiEventBus.emit('export:frame-rendered', { 
                        frame: i + 1, 
                        total: animData.frames.length 
                    });
                }
            }
            
            this.manager.animationSystem.restoreFromSnapshots(backupSnapshots);
            
            const apngBuffer = UPNG.encode(
                frames,
                settings.width,
                settings.height,
                0,
                delays
            );
            
            return new Blob([apngBuffer], { type: 'image/png' });
        }
        
        /**
         * フレームレンダリング - DPR=1統一版
         * 
         * 🚨 v8.14.0 重要変更:
         *   - resolution を常に 1 固定
         *   - 描画時と出力時の解像度を完全一致
         */
        async _renderFrameToCanvas(settings) {
            const CONFIG = window.TEGAKI_CONFIG;
            
            // 🚨 DPR=1固定
            const renderTexture = PIXI.RenderTexture.create({
                width: settings.width,
                height: settings.height,
                resolution: 1
            });
            
            const tempContainer = new PIXI.Container();
            
            const layersContainer = this.manager.animationSystem.layerSystem.currentFrameContainer;
            if (!layersContainer) {
                throw new Error('currentFrameContainer not found');
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
            
            if (settings.width !== CONFIG.canvas.width || settings.height !== CONFIG.canvas.height) {
                const scaleX = settings.width / CONFIG.canvas.width;
                const scaleY = settings.height / CONFIG.canvas.height;
                const scale = Math.min(scaleX, scaleY);
                
                layersContainer.scale.set(scale, scale);
                
                const scaledWidth = CONFIG.canvas.width * scale;
                const scaledHeight = CONFIG.canvas.height * scale;
                
                layersContainer.position.set(
                    (settings.width - scaledWidth) / 2,
                    (settings.height - scaledHeight) / 2
                );
            }
            
            this.manager.app.renderer.render({
                container: tempContainer,
                target: renderTexture
            });
            
            let canvas;
            try {
                const result = this.manager.app.renderer.extract.canvas(renderTexture);
                if (result instanceof Promise) {
                    canvas = await result;
                } else {
                    canvas = result;
                }
            } catch (extractError) {
                throw new Error('Canvas extraction failed: ' + extractError.message);
            }
            
            tempContainer.removeChild(layersContainer);
            layersContainer.position.set(originalPosition.x, originalPosition.y);
            layersContainer.scale.set(originalPosition.scaleX, originalPosition.scaleY);
            
            if (originalParent) {
                originalParent.addChild(layersContainer);
            }
            
            renderTexture.destroy(true);
            tempContainer.destroy({ children: true });
            
            return canvas;
        }
        
        _checkUPNGAvailability() {
            if (typeof UPNG === 'undefined') {
                throw new Error('UPNG.js not loaded');
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
    
    return APNGExporter;
})();

console.log('✅ apng-exporter.js v8.14.0 loaded (DPR=1統一)');