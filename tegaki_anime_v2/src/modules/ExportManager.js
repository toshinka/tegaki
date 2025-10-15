// ========================================
// ExportManager.js - APNG/GIF出力処理
// ========================================

(function() {
    'use strict';
    
    class ExportManager {
        constructor(layerManager, canvasManager) {
            this.layerManager = layerManager;
            this.canvasManager = canvasManager;
            
            const config = window.TegakiConstants?.EXPORT_CONFIG || {};
            this.gifQuality = config.GIF_QUALITY || 10;
            this.gifWorkers = config.GIF_WORKERS || 2;
        }
        
        /**
         * APNGとしてエクスポート
         */
        async exportAsApng(frameDelay) {
            // ライブラリの存在確認
            if (!window.UPNG || !window.Zlib) {
                alert('APNG生成ライブラリ(UPNG.js/pako.js)が読み込まれていません。');
                return null;
            }
            
            const frames = [];
            const compositeFrames = this.layerManager.getCompositeFrames();
            
            // 各フレームをArrayBufferに変換
            for (const compositeData of compositeFrames) {
                frames.push(compositeData.data.buffer);
            }
            
            // 各フレームの表示時間（ミリ秒）
            const delays = Array(this.layerManager.frameCount).fill(frameDelay);
            
            // UPNG.encode でAPNGバイナリを生成
            const apngData = UPNG.encode(
                frames,
                this.canvasManager.width,
                this.canvasManager.height,
                0,
                delays
            );
            
            // Blob に変換して返す
            return new Blob([apngData], { type: 'image/png' });
        }
        
        /**
         * GIFとしてエクスポート
         */
        async exportAsGif(frameDelay, onProgress) {
            // ライブラリの存在確認
            if (!window.GIF) {
                alert('GIF生成ライブラリが読み込まれていません。');
                return null;
            }
            
            // Worker URL の取得と確認
            let workerUrl = window.GIF.prototype.options?.workerScript;
            
            // Worker URL が正しく設定されていない場合は再初期化
            if (!workerUrl || !workerUrl.startsWith('blob:')) {
                console.warn('Worker URL not initialized, attempting to reinitialize...');
                
                // グローバルに保存されたWorker URLを確認
                if (window.__gifWorkerUrl && window.__gifWorkerUrl.startsWith('blob:')) {
                    workerUrl = window.__gifWorkerUrl;
                    console.log('Using cached worker URL:', workerUrl);
                } else {
                    console.error('Worker URL not found:', workerUrl);
                    alert('GIF Worker が初期化されていません。ページを再読み込みしてください。');
                    return null;
                }
            }
            
            return new Promise((resolve, reject) => {
                try {
                    // GIF.js インスタンスを作成
                    const gif = new GIF({
                        workers: this.gifWorkers,
                        quality: this.gifQuality,
                        width: this.canvasManager.width,
                        height: this.canvasManager.height,
                        workerScript: workerUrl,
                        debug: false
                    });
                    
                    console.log('GIF instance created with worker:', workerUrl);
                    
                    // 進捗コールバックを登録
                    if (onProgress && typeof onProgress === 'function') {
                        gif.on('progress', onProgress);
                    }
                    
                    // 各フレームを合成してGIFに追加
                    const compositeFrames = this.layerManager.getCompositeFrames();
                    
                    for (const compositeData of compositeFrames) {
                        const frameCanvas = document.createElement('canvas');
                        frameCanvas.width = this.canvasManager.width;
                        frameCanvas.height = this.canvasManager.height;
                        const frameCtx = frameCanvas.getContext('2d');
                        
                        // 合成ImageDataを描画
                        frameCtx.putImageData(compositeData, 0, 0);
                        
                        // GIF にフレームを追加
                        gif.addFrame(frameCanvas, {
                            delay: frameDelay,
                            copy: true
                        });
                    }
                    
                    // 生成完了イベント
                    gif.on('finished', (blob) => {
                        // 進捗コールバックを解除（メモリリーク対策）
                        if (onProgress) {
                            gif.off('progress', onProgress);
                        }
                        resolve(blob);
                    });
                    
                    // エラーハンドリング
                    setTimeout(() => {
                        if (!gif.running) {
                            reject(new Error('GIF rendering timeout'));
                        }
                    }, 30000);
                    
                    // GIF生成を開始
                    gif.render();
                } catch (error) {
                    reject(error);
                }
            });
        }
        
        /**
         * クリーンアップ
         */
        destroy() {
            this.layerManager = null;
            this.canvasManager = null;
        }
    }
    
    // window に公開
    if (typeof window !== 'undefined') {
        window.ExportManager = ExportManager;
        console.log('✅ ExportManager loaded');
    }
})();