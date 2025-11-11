/**
 * ================================================================================
 * system/exporters/png-exporter.js - カメラtransform完全対応【v8.23.0】
 * ================================================================================
 * 
 * 【依存関係 - Parents】
 *   - system/export-manager.js (エクスポート管理)
 *   - system/camera-system.js (worldContainer/canvasContainer取得)
 *   - system/layer-system.js (レイヤー情報)
 * 
 * 【依存関係 - Children】
 *   - system/exporters/apng-exporter.js (複数フレーム時)
 * 
 * 【責務】
 *   - PNG静止画エクスポート
 *   - 複数フレーム時はAPNGへ委譲
 * 
 * 【v8.23.0 重要改修】
 *   🔧 カメラのscale/rotation/flipも含めた完全なtransform保存・復元
 *   🔧 worldContainerの全transform状態をバックアップ・リセット・復元
 *   🔧 WEBP/APNGと統一された実装パターン（DRY原則）
 *   🔧 コンソールログをクリーンアップ
 * 
 * ================================================================================
 */

window.PNGExporter = (function() {
    'use strict';
    
    class PNGExporter {
        constructor(exportManager) {
            if (!exportManager) {
                throw new Error('PNGExporter: exportManager is required');
            }
            this.manager = exportManager;
        }
        
        /**
         * APNG自動切替判定
         */
        _shouldUseAPNG() {
            const animData = this.manager.animationSystem?.getAnimationData?.();
            const frameCount = animData?.frames?.length || 0;
            return frameCount >= 2;
        }
        
        /**
         * エクスポート実行
         */
        async export(options = {}) {
            if (!this.manager?.layerSystem) {
                throw new Error('LayerSystem not available');
            }
            
            // 複数フレーム時はAPNG委譲
            if (this._shouldUseAPNG()) {
                const apngExporter = this.manager.exporters['apng'];
                if (apngExporter) {
                    return await apngExporter.export(options);
                }
            }
            
            if (window.TegakiEventBus) {
                window.TegakiEventBus.emit('export:started', { format: 'png' });
            }
            
            try {
                const blob = await this.generateBlob(options);
                
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
                
                return { blob, filename, format: 'png' };
            } catch (error) {
                if (window.TegakiEventBus) {
                    window.TegakiEventBus.emit('export:failed', { 
                        format: 'png', 
                        error: error.message 
                    });
                }
                throw error;
            }
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
         * PNG Blob生成【v8.23.0 カメラtransform完全対応】
         */
        async generateBlob(options = {}) {
            const CONFIG = window.TEGAKI_CONFIG;
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
                
                // フレーム待機
                await new Promise(resolve => {
                    requestAnimationFrame(() => {
                        setTimeout(resolve, 16);
                    });
                });
                
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
                            reject(new Error('PNG generation failed'));
                            return;
                        }
                        resolve(blob);
                    }, 'image/png');
                });
            } finally {
                // 🔧 カメラ状態を復元
                this._restoreCameraState(cameraState);
            }
        }
    }
    
    return PNGExporter;
})();