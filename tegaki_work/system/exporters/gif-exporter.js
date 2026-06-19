/**
 * ================================================================================
 * system/exporters/gif-exporter.js - アンチエイリアス改善版
 * ================================================================================
 * 
 * 【依存関係 - Parents】
 *   - export-manager.js (GIFエクスポート実行)
 *   - animation-system.js (フレーム管理)
 *   - gif.js (GIF生成ライブラリ)
 * 
 * 【依存関係 - Children】
 *   なし
 * 
 * 【責務】
 *   - GIFアニメーション出力
 *   - フレームレンダリング（高品質化）
 *   - Blob生成
 * 
 * 【v8.17.1 改修内容】
 *   🎨 antialias:true で高品質レンダリング
 *   ✅ CDNフォールバックで file:// 環境対応
 *   ✅ ジャギー除去
 * ================================================================================
 */

import * as PIXI from 'pixi.js';
import GIF from 'gif.js';
import gifWorkerUrl from 'gif.js/dist/gif.worker.js?url';

window.GIFExporter = (function() {
    'use strict';
    
    class GIFExporter {
        constructor(exportManager) {
            if (!exportManager) {
                throw new Error('GIFExporter: exportManager is required');
            }
            this.manager = exportManager;
            this.isExporting = false;
            this.workerBlobURL = gifWorkerUrl;
        }
        
        async generateBlob(options = {}) {
            if (this.isExporting) {
                throw new Error('GIF export already in progress');
            }
            
            const frameCount = this.manager.getFrameCount?.() || 0;
            if (frameCount === 0) {
                throw new Error('アニメーションにフレームが含まれていません');
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
                
                const timelineFrames = await this.manager.renderAnimationFrames({
                    ...options,
                    width: settings.width,
                    height: settings.height,
                    resolution: settings.width / window.TEGAKI_CONFIG.canvas.width
                });

                if (timelineFrames) {
                    timelineFrames.forEach((frame, index) => {
                        gif.addFrame(frame.canvas, { delay: frame.delayMs });
                        window.TegakiEventBus?.emit('export:frame-rendered', {
                            frame: index + 1,
                            total: timelineFrames.length
                        });
                    });
                } else {
                    if (!this.manager?.animationSystem) {
                        throw new Error('AnimationSystem not available');
                    }
                    const animData = this.manager.animationSystem.getAnimationData();
                    const backupSnapshots = this.manager.animationSystem.captureAllLayerStates();
                    try {
                        for (let i = 0; i < animData.frames.length; i++) {
                            const frame = animData.frames[i];
                            this.manager.animationSystem.applyFrameToLayers(i);
                            await this.waitFrame();
                            const canvas = await this.renderFrameToCanvas(settings);
                            if (canvas) {
                                const delayMs = frame.duration !== undefined && frame.duration !== null
                                    ? Math.round(frame.duration * 1000)
                                    : 100;
                                gif.addFrame(canvas, { delay: delayMs });
                            }
                            window.TegakiEventBus?.emit('export:frame-rendered', {
                                frame: i + 1,
                                total: animData.frames.length
                            });
                        }
                    } finally {
                        this.manager.animationSystem.restoreFromSnapshots(backupSnapshots);
                    }
                }
                
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
                
                window.TegakiEventBus?.emit('export:completed', {
                    format: 'gif',
                    size: blob.size,
                    frames: this.manager.getFrameCount?.() || 1,
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
        
        /**
         * Workerスクリプト取得 - CDNフォールバック対応
         * 
         * file:// 環境では:
         *   1. ローカルファイル読み込み試行（失敗する）
         *   2. CDNから取得（成功）
         *   3. Blob URLとして返却
         */
        async createWorkerBlobURL() {
            const localPath = 'vendor/gif.worker.js';
            const cdnPath = 'https://cdn.jsdelivr.net/npm/gif.js@0.2.0/dist/gif.worker.js';
            
            // ローカルファイル試行
            try {
                const response = await fetch(localPath);
                if (response.ok) {
                    const workerCode = await response.text();
                    const blob = new Blob([workerCode], { type: 'application/javascript' });
                    console.log('✅ GIF Worker: ローカルファイルから読み込み');
                    return URL.createObjectURL(blob);
                }
            } catch (e) {
                // file:// 環境では失敗するので、CDNへフォールバック
            }
            
            // CDNフォールバック
            try {
                const response = await fetch(cdnPath);
                if (!response.ok) {
                    throw new Error('CDN fetch failed: ' + response.status);
                }
                const workerCode = await response.text();
                const blob = new Blob([workerCode], { type: 'application/javascript' });
                console.log('✅ GIF Worker: CDNから読み込み');
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
        
        /**
         * フレームレンダリング - アンチエイリアス改善版【v8.17.1】
         * 
         * 改善点:
         *   - antialias:true でジャギー除去
         *   - resolution=1 で等倍出力
         */
        async renderFrameToCanvas(settings) {
            // 🎨 v8.17.1: antialias追加
            const renderTexture = PIXI.RenderTexture.create({
                width: settings.width,
                height: settings.height,
                resolution: 1,
                antialias: true  // ジャギー除去
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

console.log('✅ gif-exporter.js v8.17.1 loaded');
console.log('   🎨 antialias:true でジャギー除去');
console.log('   ✓ CDNフォールバックで file:// 対応');
