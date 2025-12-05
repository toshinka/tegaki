/**
 * ================================================================================
 * system/exporters/apng-exporter.js - 独立コンテナ方式【v8.31.0】
 * ================================================================================
 * 
 * 【依存関係 - Parents】
 *   - system/export-manager.js (エクスポート管理)
 *   - system/animation-system.js (フレーム情報)
 *   - UPNG.js (APNG生成ライブラリ)
 * 
 * 【依存関係 - Children】
 *   なし
 * 
 * 【責務】
 *   - APNGアニメーション出力
 *   - 複数フレームの連続キャプチャ
 * 
 * 【v8.31.0 根本修正】
 *   🔧 独立コンテナ方式に完全回帰（旧版169のロジック継承）
 *   🔧 currentFrameContainerを一時的にtempContainerへ移動
 *   🔧 worldContainer/cameraSystemへの干渉を完全排除
 *   🔧 resolution倍率対応の統合（ジャギー解消）
 *   🔧 カメラリセット/復元処理の完全削除（不要化）
 * 
 * 【設計原則】
 *   - カメラ状態に一切干渉しない独立レンダリング
 *   - currentFrameContainerの一時的な親変更のみで実装
 *   - 元の親・座標・スケールを完全復元
 * 
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
        
        /**
         * UPNG.js利用可能性チェック
         */
        _checkUPNGAvailability() {
            if (typeof UPNG === 'undefined') {
                throw new Error('UPNG.js not loaded. Include: https://cdnjs.cloudflare.com/ajax/libs/upng-js/2.1.0/UPNG.js');
            }
        }
        
        /**
         * エクスポート実行
         */
        async export(options = {}) {
            if (this.isExporting) {
                throw new Error('Export already in progress');
            }
            
            this._checkUPNGAvailability();
            
            if (!this.manager?.animationSystem) {
                throw new Error('AnimationSystem not available');
            }
            
            const animData = this.manager.animationSystem.getAnimationData();
            if (!animData?.frames || animData.frames.length < 2) {
                throw new Error('APNGには2つ以上のフレームが必要です');
            }
            
            if (window.TegakiEventBus) {
                window.TegakiEventBus.emit('export:started', { 
                    format: 'apng',
                    frames: animData.frames.length
                });
            }
            
            this.isExporting = true;
            
            try {
                const blob = await this.generateBlob(options);
                
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
                const filename = options.filename || `tegaki_animation_${timestamp}.png`;
                
                this.manager.downloadFile(blob, filename);
                
                if (window.TegakiEventBus) {
                    window.TegakiEventBus.emit('export:completed', {
                        format: 'apng',
                        size: blob.size,
                        frames: animData.frames.length,
                        filename: filename
                    });
                }
                
                return { blob, filename, format: 'apng' };
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
         * APNG Blob生成【v8.31.0 独立コンテナ方式】
         */
        async generateBlob(options = {}) {
            const CONFIG = window.TEGAKI_CONFIG;
            const animData = this.manager.animationSystem.getAnimationData();
            const resolution = options.resolution || 2;
            
            const settings = {
                width: CONFIG.canvas.width * resolution,
                height: CONFIG.canvas.height * resolution,
                fps: options.fps || 12,
                resolution: resolution
            };
            
            const frames = [];
            const delays = [];
            
            // レイヤー状態のバックアップ（カメラは触らない）
            const backupSnapshots = this.manager.animationSystem.captureAllLayerStates();
            
            try {
                for (let i = 0; i < animData.frames.length; i++) {
                    const frame = animData.frames[i];
                    
                    // フレーム適用
                    this.manager.animationSystem.applyFrameToLayers(i);
                    await this._waitFrame();
                    
                    // 独立コンテナ方式でレンダリング
                    const canvas = await this._renderFrameToCanvas(settings);
                    
                    const ctx = canvas.getContext('2d', { willReadFrequently: true });
                    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    
                    frames.push(imageData.data.buffer);
                    
                    const durationMs = frame.duration !== undefined && frame.duration !== null 
                        ? Math.round(frame.duration * 1000)
                        : Math.round(1000 / settings.fps);
                    
                    delays.push(durationMs);
                    
                    if (window.TegakiEventBus) {
                        window.TegakiEventBus.emit('export:progress', { 
                            current: i + 1, 
                            total: animData.frames.length,
                            format: 'apng'
                        });
                    }
                }
            } finally {
                // レイヤー状態のみ復元（カメラは触っていないので不要）
                this.manager.animationSystem.restoreFromSnapshots(backupSnapshots);
            }
            
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
         * フレームのレンダリング【v8.31.0 独立コンテナ方式 + resolution対応】
         */
        async _renderFrameToCanvas(settings) {
            const CONFIG = window.TEGAKI_CONFIG;
            
            // RenderTexture作成
            const renderTexture = PIXI.RenderTexture.create({
                width: settings.width,
                height: settings.height,
                resolution: 1
            });
            
            // 独立した一時コンテナ
            const tempContainer = new PIXI.Container();
            
            // currentFrameContainerを取得
            const layersContainer = this.manager.animationSystem.layerSystem.currentFrameContainer;
            if (!layersContainer) {
                throw new Error('currentFrameContainer not found');
            }
            
            // 元の親と座標・スケールを保存
            const originalParent = layersContainer.parent;
            const originalState = {
                x: layersContainer.x,
                y: layersContainer.y,
                scaleX: layersContainer.scale.x,
                scaleY: layersContainer.scale.y
            };
            
            try {
                // 親から一時的に切り離し
                if (originalParent) {
                    originalParent.removeChild(layersContainer);
                }
                
                // 独立コンテナに追加
                tempContainer.addChild(layersContainer);
                layersContainer.position.set(0, 0);
                
                // resolution倍率対応（スケール調整）
                if (settings.resolution !== 1) {
                    layersContainer.scale.set(settings.resolution, settings.resolution);
                }
                
                // レンダリング実行
                this.manager.app.renderer.render({
                    container: tempContainer,
                    target: renderTexture
                });
                
                // Canvas抽出
                let canvas;
                const result = this.manager.app.renderer.extract.canvas(renderTexture);
                if (result instanceof Promise) {
                    canvas = await result;
                } else {
                    canvas = result;
                }
                
                if (!canvas) {
                    throw new Error('Canvas extraction failed');
                }
                
                return canvas;
                
            } finally {
                // 完全復元: 独立コンテナから切り離し
                tempContainer.removeChild(layersContainer);
                
                // 元の座標・スケールに戻す
                layersContainer.position.set(originalState.x, originalState.y);
                layersContainer.scale.set(originalState.scaleX, originalState.scaleY);
                
                // 元の親に戻す
                if (originalParent) {
                    originalParent.addChild(layersContainer);
                }
                
                // クリーンアップ
                renderTexture.destroy(true);
                tempContainer.destroy({ children: true });
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

console.log('✅ apng-exporter.js v8.31.0 loaded');