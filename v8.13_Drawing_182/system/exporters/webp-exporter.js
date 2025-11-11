/**
 * ================================================================================
 * system/exporters/webp-exporter.js - Animated WEBP対応【v8.23.0】
 * ================================================================================
 * 
 * 【依存関係 - Parents】
 *   - system/export-manager.js (エクスポート管理)
 *   - system/camera-system.js (worldContainer/canvasContainer取得)
 *   - system/animation-system.js (フレーム情報)
 * 
 * 【依存関係 - Children】
 *   なし
 * 
 * 【責務】
 *   - WEBP静止画/動画エクスポート
 *   - カメラtransform完全考慮
 *   - Animated WEBP生成（WebM代替推奨）
 * 
 * 【v8.23.0 重要改修】
 *   🔧 カメラのscale/rotation/flipも含めた完全なtransform保存・復元
 *   🔧 worldContainerの全transform状態をバックアップ・リセット・復元
 *   🔧 Animated WEBPは技術的制約のためWebM推奨メッセージ追加
 *   🔧 コンソールログをクリーンアップ
 *   🔧 DRY原則に基づく_backupCameraState()/_restoreCameraState()統一
 * 
 * 【技術的制約】
 *   ⚠️ ブラウザネイティブのCanvas APIはAnimated WEBP生成不可
 *   ✓ 静止画WEBPは完全対応
 *   ✓ 動画はWebM/MP4を推奨（別途実装予定）
 *   ✓ Animated WEBP実装には外部ライブラリ必須（libwebp.js等）
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
        
        /**
         * フレーム数取得
         */
        _getFrameCount() {
            const animData = this.manager.animationSystem?.getAnimationData?.();
            return animData?.frames?.length || 1;
        }
        
        /**
         * エクスポート実行
         */
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
        
        /**
         * Blob生成（静止画/動画自動判定）
         */
        async generateBlob(options = {}) {
            const frameCount = this._getFrameCount();
            
            if (frameCount >= 2) {
                console.warn('⚠️ Animated WEBP: ブラウザネイティブ未対応');
                console.warn('   推奨: WebM/MP4形式を使用してください');
                console.warn('   現在: 全フレームを横並びの静止画として出力します');
                return await this._generateAnimatedWebPFallback(options);
            }
            
            return await this._generateStaticWebP(options);
        }
        
        /**
         * 🔧 v8.23.0: カメラ状態の完全バックアップ
         */
        _backupCameraState() {
            const worldContainer = this.manager.cameraSystem?.worldContainer;
            if (!worldContainer) return null;
            
            return {
                position: { x: worldContainer.position.x, y: worldContainer.position.y },
                scale: { x: worldContainer.scale.x, y: worldContainer.scale.y },
                rotation: worldContainer.rotation,
                pivot: { x: worldContainer.pivot.x, y: worldContainer.pivot.y }
            };
        }
        
        /**
         * 🔧 v8.23.0: カメラ状態の完全復元
         */
        _restoreCameraState(state) {
            if (!state) return;
            
            const worldContainer = this.manager.cameraSystem?.worldContainer;
            if (!worldContainer) return;
            
            worldContainer.position.set(state.position.x, state.position.y);
            worldContainer.scale.set(state.scale.x, state.scale.y);
            worldContainer.rotation = state.rotation;
            worldContainer.pivot.set(state.pivot.x, state.pivot.y);
        }
        
        /**
         * 🔧 v8.23.0: カメラを完全リセット
         */
        _resetCameraForExport() {
            const worldContainer = this.manager.cameraSystem?.worldContainer;
            if (!worldContainer) return;
            
            worldContainer.position.set(0, 0);
            worldContainer.scale.set(1, 1);
            worldContainer.rotation = 0;
            worldContainer.pivot.set(0, 0);
        }
        
        /**
         * 静止画WEBP生成
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
            
            // 🔧 カメラ状態をバックアップ
            const cameraState = this._backupCameraState();
            
            try {
                // 🔧 カメラを完全リセット
                this._resetCameraForExport();
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
                // 🔧 カメラ状態を復元
                this._restoreCameraState(cameraState);
            }
        }
        
        /**
         * 🔧 v8.23.0: Animated WEBPフォールバック（横並びスプライトシート）
         * 
         * ⚠️ 技術的制約:
         *    ブラウザネイティブのCanvas.toBlob()はWEBPアニメーション非対応
         *    真のAnimated WEBPには以下が必要:
         *      1. libwebp.js等の外部ライブラリ
         *      2. WebAssembly実装
         *      3. サーバー側FFmpeg処理
         *    
         *    現在は全フレームを横並びの静止画として出力
         *    動画出力にはWebM/MP4を推奨
         */
        async _generateAnimatedWebPFallback(options = {}) {
            const CONFIG = window.TEGAKI_CONFIG;
            const animData = this.manager.animationSystem.getAnimationData();
            const frameCount = animData.frames.length;
            const resolution = options.resolution || 1;
            const quality = options.quality !== undefined ? options.quality / 100 : 0.95;
            
            const frameWidth = CONFIG.canvas.width * resolution;
            const frameHeight = CONFIG.canvas.height * resolution;
            
            // スプライトシート用キャンバス（横並び）
            const finalCanvas = document.createElement('canvas');
            finalCanvas.width = frameWidth * frameCount;
            finalCanvas.height = frameHeight;
            const ctx = finalCanvas.getContext('2d', { alpha: true });
            
            ctx.clearRect(0, 0, finalCanvas.width, finalCanvas.height);
            
            // 現在の状態をバックアップ
            const backupSnapshots = this.manager.animationSystem.captureAllLayerStates();
            const cameraState = this._backupCameraState();
            
            try {
                // カメラを完全リセット
                this._resetCameraForExport();
                
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
                // 状態を完全復元
                this.manager.animationSystem.restoreFromSnapshots(backupSnapshots);
                this._restoreCameraState(cameraState);
            }
            
            return new Promise((resolve, reject) => {
                finalCanvas.toBlob(
                    (blob) => {
                        if (blob) {
                            resolve(blob);
                        } else {
                            reject(new Error('Animated WEBP fallback generation failed'));
                        }
                    },
                    'image/webp',
                    quality
                );
            });
        }
        
        /**
         * フレームキャプチャ（カメラリセット済み前提）
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
    
    return WebPExporter;
})();