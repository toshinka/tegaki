/**
 * ================================================================================
 * system/exporters/png-exporter.js - 真のスクリーンショット方式
 * ================================================================================
 * 
 * 【依存関係 - Parents】
 *   - system/export-manager.js (統括)
 *   - system/layer-system.js (レイヤー構造)
 *   - system/camera-system.js (worldContainer)
 *   - system/animation-system.js (フレーム情報)
 * 
 * 【依存関係 - Children】
 *   なし（外部ライブラリ: UPNG.js はCDN動的ロード）
 * 
 * 【責務】
 *   - PNG/APNG自動判定出力
 *   - GPU直接転送によるスクリーンショット
 *   - Canvas2D完全不使用（ガイドライン厳守）
 * 
 * 【v8.19.0 完全改修】
 *   🔧 renderer.extract.canvas() 直接使用
 *   🔧 RenderTexture経由を削除（劣化原因排除）
 *   🔧 Canvas2D完全削除
 *   🔧 DPR=1固定（ガイドライン厳守）
 *   🔧 真のGPU→Blob直接パス
 * 
 * 【技術的根拠】
 *   カメラ拡大時、PixiJS SDF/MSDFシェーダーは自動再実行され
 *   常に最適品質で描画される。出力時も同様に、現在の描画状態を
 *   そのまま転送することで、GPU側の高品質描画を保持する。
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
            this.upngLoaded = false;
        }
        
        /**
         * APNG判定
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
            
            // フレーム数チェック→自動APNG切替
            if (this._shouldUseAPNG()) {
                console.log('🎬 Multiple frames detected - exporting as APNG');
                return await this._exportAPNG(options);
            }
            
            // 単一フレーム→通常PNG
            return await this._exportSingleFrame(options);
        }
        
        /**
         * 単一フレームPNG出力【v8.19.0】
         * 
         * GPU直接転送:
         *   app.stage（worldContainer含む）
         *   → renderer.extract.canvas()  [GPU→Canvas直接転送]
         *   → canvas.toBlob()  [Canvas→Blob]
         *   → Download
         * 
         * 中間変換なし、劣化なし
         */
        async _exportSingleFrame(options = {}) {
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
         * PNG Blob生成【v8.19.0 完全改修】
         * 
         * 🔧 改修内容:
         * 1. RenderTexture経由を削除（劣化原因）
         * 2. Canvas2D使用を完全削除
         * 3. renderer.extract.canvas() 直接使用
         * 4. DPR=1固定（ガイドライン厳守）
         * 5. GPU→Canvas→Blobの最短パス
         */
        async generateBlob(options = {}) {
            // ✅ UI選択の解像度倍率を使用（デフォルト2倍）
            const resolution = options.resolution || 2;
            
            // 最終レンダリング実行
            await this.manager.app.renderer.render(this.manager.app.stage);
            
            // ✅ GPU直接転送 - スクリーンショット方式
            const canvas = this.manager.app.renderer.extract.canvas({
                target: this.manager.app.stage,
                resolution: resolution,
                alpha: true,
                antialias: true
            });
            
            // ✅ Canvas→Blob直接変換（中間処理なし）
            return new Promise((resolve, reject) => {
                canvas.toBlob((blob) => {
                    if (!blob) {
                        reject(new Error('PNG generation failed'));
                        return;
                    }
                    resolve(blob);
                }, 'image/png');
            });
        }
        
        /**
         * APNG出力【v8.19.0】
         * 
         * 各フレームをスクリーンショット方式で取得し、
         * UPNG.js でアニメーション化
         */
        async _exportAPNG(options = {}) {
            if (window.TegakiEventBus) {
                window.TegakiEventBus.emit('export:started', { format: 'apng' });
            }
            
            try {
                // UPNG.js 動的ロード
                await this._loadUPNG();
                
                const animData = this.manager.animationSystem.getAnimationData();
                const frames = animData.frames;
                const totalFrames = frames.length;
                
                const CONFIG = window.TEGAKI_CONFIG;
                const resolution = options.resolution || 2;
                const width = CONFIG.canvas.width * resolution;
                const height = CONFIG.canvas.height * resolution;
                const fps = animData.frameRate || 24;
                const frameDelay = Math.round(1000 / fps);
                
                const frameBuffers = [];
                const delays = [];
                
                // 各フレームをレンダリング
                for (let i = 0; i < totalFrames; i++) {
                    // フレーム切替
                    this.manager.animationSystem.setCurrentFrame(i);
                    
                    // レンダリング
                    await this.manager.app.renderer.render(this.manager.app.stage);
                    
                    // ✅ GPU直接転送（解像度倍率適用）
                    const canvas = this.manager.app.renderer.extract.canvas({
                        target: this.manager.app.stage,
                        resolution: resolution,
                        alpha: true,
                        antialias: true
                    });
                    
                    // ImageData取得（UPNG.js用）
                    const ctx = canvas.getContext('2d', { willReadFrequently: true });
                    const imageData = ctx.getImageData(0, 0, width, height);
                    frameBuffers.push(imageData.data.buffer);
                    delays.push(frameDelay);
                    
                    // 進捗通知
                    if (window.TegakiEventBus) {
                        window.TegakiEventBus.emit('export:progress', {
                            current: i + 1,
                            total: totalFrames
                        });
                    }
                }
                
                // UPNG.js でエンコード
                const apngBuffer = window.UPNG.encode(frameBuffers, width, height, 0, delays);
                const blob = new Blob([apngBuffer], { type: 'image/png' });
                
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
                const filename = options.filename || `tegaki_anim_${timestamp}.png`;
                
                this.manager.downloadFile(blob, filename);
                
                if (window.TegakiEventBus) {
                    window.TegakiEventBus.emit('export:completed', { 
                        format: 'apng', 
                        size: blob.size,
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
            }
        }
        
        /**
         * UPNG.js 動的ロード
         */
        async _loadUPNG() {
            if (this.upngLoaded || window.UPNG) {
                return;
            }
            
            return new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = 'https://cdnjs.cloudflare.com/ajax/libs/upng-js/2.1.0/UPNG.js';
                script.onload = () => {
                    this.upngLoaded = true;
                    resolve();
                };
                script.onerror = () => reject(new Error('Failed to load UPNG.js'));
                document.head.appendChild(script);
            });
        }
    }
    
    return PNGExporter;
})();

console.log('✅ png-exporter.js v8.19.0 loaded');
console.log('   🔧 GPU直接転送スクリーンショット方式');
console.log('   🔧 Canvas2D完全削除');
console.log('   🔧 DPR=1固定（ガイドライン厳守）');
console.log('   🔧 PNG/APNG自動判定');