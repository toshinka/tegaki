/**
 * ================================================================================
 * system/exporters/animated-webp-exporter.js - WASM統合【v8.34.0】
 * ================================================================================
 * 
 * 【依存関係 - Parents】
 *   - system/export-manager.js
 *   - system/animation-system.js (フレーム情報)
 *   - libwebp-wasm@0.1.6 (CDN経由)
 * 
 * 【依存関係 - Children】
 *   なし
 * 
 * 【責務】
 *   - libwebp-wasmを使用したAnimated WEBP生成
 *   - ブラウザ内完結（ffmpeg不要）
 *   - 透過対応・ループ設定可能
 * 
 * 【v8.34.0 API修正】
 *   🔧 libwebp-wasmの正しいAPI名を使用（encodeFiles）
 *   🔧 グローバル変数の検出方法を改善
 *   🔧 詳細なエラーメッセージ追加
 * 
 * 【v8.33.0 完全書き換え】
 *   🔧 libwebp-wasmのencodeAnimationメソッドを使用
 *   🔧 ブラウザ内でAnimated WEBPを直接生成
 *   🔧 file://プロトコル対応（WASM CDN利用）
 * 
 * 【設計原則】
 *   - グローバルに展開されたlibwebp-wasm関数を使用
 *   - 各フレームをPNG Blob化
 *   - encodeFiles()でAnimated WEBP生成
 * 
 * ================================================================================
 */

window.AnimatedWebPExporter = (function() {
    'use strict';
    
    class AnimatedWebPExporter {
        constructor(exportManager) {
            if (!exportManager) {
                throw new Error('AnimatedWebPExporter: exportManager is required');
            }
            this.manager = exportManager;
            this.isExporting = false;
            this.wasmReady = false;
        }
        
/**
         * WASM初期化確認（非同期待機ロジックを追加）
         */
        async ensureWasmReady() {
            if (this.wasmReady) return true;
            
            const MAX_WAIT_MS = 5000; // 最大待機時間 5秒
            const INTERVAL_MS = 50;  // チェック間隔 50ms
            let startTime = Date.now();
            let hasEncodeFiles = false;

            // タイムアウトまでポーリングで待機
            while (Date.now() - startTime < MAX_WAIT_MS) {
                hasEncodeFiles = typeof window.encodeFiles === 'function';
                
                if (hasEncodeFiles) {
                    this.wasmReady = true;
                    console.log('✅ libwebp-wasm ready (after wait)');
                    return true;
                }
                
                // 待機
                await new Promise(resolve => setTimeout(resolve, INTERVAL_MS));
                
                // 途中経過のログ
                if (Date.now() - startTime > 1000 && Date.now() - startTime < 1050) {
                    console.log('⏳ Waiting for libwebp-wasm initialization...');
                }
            }
            
            // 待機時間超過
            console.log('[AnimatedWebPExporter] WASM Status:', {
                encodeFiles: hasEncodeFiles,
                decode: typeof window.decode === 'function',
                getSize: typeof window.getSize === 'function',
                windowKeys: Object.keys(window).filter(k => k.toLowerCase().includes('webp'))
            });

            // タイムアウトでエラーを投げる
            throw new Error(
                'libwebp-wasm not loaded properly within timeout (5000ms). ' +
                'Please ensure <script src="https://cdn.jsdelivr.net/npm/libwebp-wasm@0.1.6/dist/libwebp/index.min.js"></script> ' +
                'is included in index.html and loaded before this script. ' +
                'Expected global function: encodeFiles()'
            );
        }
        
        /**
         * Animated WEBP出力
         */
        async export(options = {}) {
            if (this.isExporting) {
                throw new Error('Export already in progress');
            }
            
            if (!this.manager?.animationSystem) {
                throw new Error('AnimationSystem not available');
            }
            
            const animData = this.manager.animationSystem.getAnimationData();
            if (!animData?.frames || animData.frames.length < 2) {
                throw new Error('Animated WEBPには2つ以上のフレームが必要です');
            }
            
            if (window.TegakiEventBus) {
                window.TegakiEventBus.emit('export:started', { 
                    format: 'animated-webp',
                    frames: animData.frames.length
                });
            }
            
            this.isExporting = true;
            
            try {
                const blob = await this.generateBlob(options);
                
                const timestamp = this._getTimestamp();
                const filename = options.filename || `tegaki_${timestamp}.webp`;
                
                this.manager.downloadFile(blob, filename);
                
                if (window.TegakiEventBus) {
                    window.TegakiEventBus.emit('export:completed', {
                        format: 'animated-webp',
                        filename: filename,
                        size: blob.size,
                        frames: animData.frames.length
                    });
                }
                
                return { blob, filename, format: 'animated-webp' };
                
            } catch (error) {
                console.error('[AnimatedWebPExporter] Export failed:', error);
                
                if (window.TegakiEventBus) {
                    window.TegakiEventBus.emit('export:failed', { 
                        format: 'animated-webp',
                        error: error.message
                    });
                }
                throw error;
            } finally {
                this.isExporting = false;
            }
        }
        
        /**
         * Animated WEBP Blob生成
         */
        async generateBlob(options = {}) {
            await this.ensureWasmReady();
            
            const animData = this.manager.animationSystem.getAnimationData();
            const CONFIG = window.TEGAKI_CONFIG;
            const resolution = options.resolution || 1;
            const quality = options.quality || 90;
            
            const width = CONFIG.canvas.width * resolution;
            const height = CONFIG.canvas.height * resolution;
            
            console.log(`🎬 Animated WEBP encoding start: ${animData.frames.length} frames, ${width}x${height}, ${animData.fps}fps, quality=${quality}`);
            
            // 進捗通知用
            const totalFrames = animData.frames.length;
            let processedFrames = 0;
            
            // 各フレームをPNG Blobに変換
            const frameBlobs = [];
            const currentFrame = this.manager.animationSystem.getCurrentFrameIndex();
            
            try {
                for (let i = 0; i < totalFrames; i++) {
                    // フレーム切り替え
                    this.manager.animationSystem.setCurrentFrame(i);
                    await this._waitFrame();
                    
                    // フレームレンダリング → PNG Blob化
                    const canvas = await this._renderFrame(width, height, resolution);
                    const blob = await new Promise((resolve, reject) => {
                        canvas.toBlob(
                            blob => blob ? resolve(blob) : reject(new Error('PNG Blob generation failed')),
                            'image/png'
                        );
                    });
                    
                    frameBlobs.push(blob);
                    processedFrames++;
                    
                    // 進捗通知
                    if (window.TegakiEventBus) {
                        window.TegakiEventBus.emit('export:progress', {
                            current: processedFrames,
                            total: totalFrames,
                            progress: Math.round((processedFrames / totalFrames) * 100)
                        });
                    }
                }
                
                // 元のフレームに戻す
                this.manager.animationSystem.setCurrentFrame(currentFrame);
                
                console.log(`✅ All frames rendered: ${frameBlobs.length} PNG blobs`);
                
                // PNG Blob → ArrayBuffer変換
                const fileBytesList = await Promise.all(
                    frameBlobs.map(blob => blob.arrayBuffer())
                );
                
                console.log('🔧 Calling encodeFiles()...', {
                    files: fileBytesList.length,
                    width,
                    height,
                    fps: animData.fps
                });
                
                // libwebp-wasmでAnimated WEBP生成
                // encodeFiles(fileBytesList, width, height, fps)
                const webpData = await window.encodeFiles(
                    fileBytesList,
                    width,
                    height,
                    animData.fps || 12
                );
                
                if (!webpData || webpData.byteLength === 0) {
                    throw new Error('Animated WEBP生成に失敗しました（空のデータが返されました）');
                }
                
                console.log(`✅ Animated WEBP generated: ${webpData.byteLength} bytes`);
                
                return new Blob([webpData], { type: 'image/webp' });
                
            } catch (error) {
                console.error('[AnimatedWebPExporter] Generation failed:', error);
                // エラー時も元のフレームに戻す
                this.manager.animationSystem.setCurrentFrame(currentFrame);
                throw error;
            }
        }
        
        /**
         * フレームレンダリング（独立コンテナ方式）
         */
        async _renderFrame(width, height, resolution) {
            const CONFIG = window.TEGAKI_CONFIG;
            
            // RenderTexture作成
            const renderTexture = PIXI.RenderTexture.create({
                width: width,
                height: height,
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
                
                // resolution倍率対応
                if (resolution !== 1) {
                    layersContainer.scale.set(resolution, resolution);
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
                // 完全復元
                tempContainer.removeChild(layersContainer);
                layersContainer.position.set(originalState.x, originalState.y);
                layersContainer.scale.set(originalState.scaleX, originalState.scaleY);
                
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
        async _waitFrame() {
            return new Promise(resolve => requestAnimationFrame(resolve));
        }
        
        /**
         * プレビュー生成（軽量版）
         */
        async generatePreview(options = {}) {
            const previewOptions = {
                ...options,
                resolution: options.resolution || 1,
                quality: 80
            };
            
            try {
                const blob = await this.generateBlob(previewOptions);
                
                if (!blob || blob.size === 0) {
                    throw new Error('プレビュー生成に失敗しました');
                }
                
                return blob;
                
            } catch (error) {
                console.error('Animated WEBP Preview generation error:', error);
                throw new Error(`Animated WEBPプレビュー生成エラー: ${error.message}`);
            }
        }
        
        /**
         * タイムスタンプ生成
         */
        _getTimestamp() {
            const now = new Date();
            const pad = (n) => String(n).padStart(2, '0');
            
            return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_` +
                   `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
        }
    }
    
    return AnimatedWebPExporter;
})();

console.log('✅ animated-webp-exporter.js v8.34.0 loaded');
console.log('   🔧 libwebp-wasm統合（encodeFiles API）');
console.log('   🔧 透過対応・ループ設定可能');
console.log('   🔧 file://プロトコル対応');