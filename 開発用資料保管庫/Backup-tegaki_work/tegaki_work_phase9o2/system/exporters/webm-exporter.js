/**
 * webm-exporter.js - WebM動画出力エクスポーター
 * 
 * 【依存関係】
 * - config.js (CONFIG.EXPORT設定)
 * - system/layer-system.js (layerManager)
 * - coordinate-system.js (CoordinateSystem)
 * - core-engine.js (app, renderer)
 * 
 * 【外部ライブラリ】
 * - WebMWriter.js (https://cdn.jsdelivr.net/npm/webm-writer@0.3.0/WebMWriter.min.js)
 * 
 * 【責務】
 * - WebM形式での動画出力（MediaRecorder API / WebMWriter.js）
 * - フレームキャプチャとエンコード
 * - プログレス管理
 * 
 * 【バージョン】2.0 - WebMWriter.js統合版
 */

(function() {
    'use strict';

    // WebMWriter.jsの動的ロード
    let webmWriterLoaded = false;
    let webmWriterLoadPromise = null;

    function loadWebMWriter() {
        if (webmWriterLoadPromise) return webmWriterLoadPromise;
        
        webmWriterLoadPromise = new Promise((resolve, reject) => {
            if (window.WebMWriter) {
                webmWriterLoaded = true;
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/webm-writer@0.3.0/WebMWriter.min.js';
            script.onload = () => {
                webmWriterLoaded = true;
                resolve();
            };
            script.onerror = () => {
                reject(new Error('WebMWriter.js の読み込みに失敗しました'));
            };
            document.head.appendChild(script);
        });

        return webmWriterLoadPromise;
    }

    class WebMExporter {
        constructor() {
            this.isRecording = false;
            this.recordedChunks = [];
            this.mediaRecorder = null;
            this.webmWriter = null;
            this.method = 'auto'; // 'auto', 'mediarecorder', 'webmwriter'
            this.currentFrame = 0;
            this.totalFrames = 0;
            this.animationFrameId = null;
        }

        /**
         * WebM出力を開始
         */
        async startExport(options = {}) {
            const settings = {
                duration: options.duration || 5,
                fps: options.fps || 30,
                quality: options.quality || 0.95,
                method: options.method || 'auto',
                onProgress: options.onProgress || (() => {})
            };

            this.totalFrames = Math.floor(settings.duration * settings.fps);
            this.currentFrame = 0;

            try {
                // WebMWriter.jsの読み込み
                await loadWebMWriter();

                // 出力メソッドの決定
                if (settings.method === 'auto') {
                    settings.method = this._selectBestMethod();
                }

                if (settings.method === 'webmwriter') {
                    return await this._exportWithWebMWriter(settings);
                } else {
                    return await this._exportWithMediaRecorder(settings);
                }

            } catch (error) {
                throw error;
            }
        }

        /**
         * 最適な出力メソッドを選択
         */
        _selectBestMethod() {
            // WebGPUレンダラーの場合はWebMWriter推奨
            if (window.app?.renderer?.type === 'webgpu') {
                return 'webmwriter';
            }

            // MediaRecorderのサポート確認
            const canvas = document.createElement('canvas');
            const stream = canvas.captureStream();
            
            if (!MediaRecorder.isTypeSupported('video/webm;codecs=vp9') &&
                !MediaRecorder.isTypeSupported('video/webm;codecs=vp8')) {
                return 'webmwriter';
            }

            return 'mediarecorder';
        }

        /**
         * WebMWriter.jsを使用した出力
         */
        async _exportWithWebMWriter(settings) {
            const renderer = window.app?.renderer;
            if (!renderer) {
                throw new Error('レンダラーが初期化されていません');
            }

            const canvas = renderer.view;
            const width = canvas.width;
            const height = canvas.height;

            // WebMWriterの初期化
            this.webmWriter = new WebMWriter({
                quality: settings.quality,
                frameRate: settings.fps,
                transparent: false
            });

            this.isRecording = true;
            const startTime = Date.now();

            return new Promise((resolve, reject) => {
                const captureFrame = async () => {
                    if (!this.isRecording) {
                        reject(new Error('録画がキャンセルされました'));
                        return;
                    }

                    try {
                        // フレームのキャプチャ
                        const frameCanvas = document.createElement('canvas');
                        frameCanvas.width = width;
                        frameCanvas.height = height;
                        const ctx = frameCanvas.getContext('2d');
                        
                        // レンダラーから画像を取得
                        const imageData = await this._captureRendererFrame(renderer);
                        ctx.putImageData(imageData, 0, 0);

                        // WebMWriterに追加
                        this.webmWriter.addFrame(frameCanvas);

                        this.currentFrame++;
                        const progress = this.currentFrame / this.totalFrames;
                        settings.onProgress(progress);

                        if (this.currentFrame < this.totalFrames) {
                            // 次のフレーム
                            const expectedTime = startTime + (this.currentFrame * 1000 / settings.fps);
                            const delay = Math.max(0, expectedTime - Date.now());
                            
                            setTimeout(() => {
                                this.animationFrameId = requestAnimationFrame(captureFrame);
                            }, delay);
                        } else {
                            // 録画完了
                            this.isRecording = false;
                            
                            this.webmWriter.complete().then(blob => {
                                this._downloadBlob(blob, 'animation.webm');
                                resolve({
                                    success: true,
                                    method: 'webmwriter',
                                    frames: this.currentFrame
                                });
                            }).catch(reject);
                        }

                    } catch (error) {
                        this.isRecording = false;
                        reject(error);
                    }
                };

                captureFrame();
            });
        }

        /**
         * MediaRecorder APIを使用した出力
         */
        async _exportWithMediaRecorder(settings) {
            const renderer = window.app?.renderer;
            if (!renderer) {
                throw new Error('レンダラーが初期化されていません');
            }

            const canvas = renderer.view;
            let stream;

            try {
                stream = canvas.captureStream(settings.fps);
            } catch (error) {
                throw new Error('captureStream()がサポートされていません');
            }

            // MediaRecorderの初期化
            const mimeTypes = [
                'video/webm;codecs=vp9',
                'video/webm;codecs=vp8',
                'video/webm'
            ];

            let mimeType = null;
            for (const type of mimeTypes) {
                if (MediaRecorder.isTypeSupported(type)) {
                    mimeType = type;
                    break;
                }
            }

            if (!mimeType) {
                throw new Error('WebM形式がサポートされていません');
            }

            this.recordedChunks = [];
            this.mediaRecorder = new MediaRecorder(stream, {
                mimeType: mimeType,
                videoBitsPerSecond: 8000000
            });

            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data && event.data.size > 0) {
                    this.recordedChunks.push(event.data);
                }
            };

            return new Promise((resolve, reject) => {
                this.mediaRecorder.onstop = () => {
                    const blob = new Blob(this.recordedChunks, { type: mimeType });
                    this._downloadBlob(blob, 'animation.webm');
                    
                    this.isRecording = false;
                    resolve({
                        success: true,
                        method: 'mediarecorder',
                        size: blob.size
                    });
                };

                this.mediaRecorder.onerror = (error) => {
                    this.isRecording = false;
                    reject(error);
                };

                this.mediaRecorder.start();
                this.isRecording = true;

                // 録画時間後に停止
                const duration = settings.duration * 1000;
                let elapsed = 0;
                const interval = 100;

                const progressTimer = setInterval(() => {
                    elapsed += interval;
                    const progress = Math.min(elapsed / duration, 1);
                    settings.onProgress(progress);

                    if (elapsed >= duration) {
                        clearInterval(progressTimer);
                        this.stopExport();
                    }
                }, interval);
            });
        }

        /**
         * レンダラーからフレームをキャプチャ
         */
        async _captureRendererFrame(renderer) {
            // レンダリング実行
            if (window.app) {
                window.app.render();
            }

            // WebGPU対応のピクセル取得
            if (renderer.type === 'webgpu') {
                return await this._captureWebGPUFrame(renderer);
            }

            // WebGL対応
            const canvas = renderer.view;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            return ctx.getImageData(0, 0, canvas.width, canvas.height);
        }

        /**
         * WebGPUフレームのキャプチャ
         */
        async _captureWebGPUFrame(renderer) {
            const canvas = renderer.view;
            const width = canvas.width;
            const height = canvas.height;

            // Canvasから直接ImageDataを取得
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = width;
            tempCanvas.height = height;
            const ctx = tempCanvas.getContext('2d');
            
            ctx.drawImage(canvas, 0, 0);
            return ctx.getImageData(0, 0, width, height);
        }

        /**
         * 録画を停止
         */
        stopExport() {
            this.isRecording = false;

            if (this.animationFrameId) {
                cancelAnimationFrame(this.animationFrameId);
                this.animationFrameId = null;
            }

            if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
                this.mediaRecorder.stop();
            }

            if (this.webmWriter) {
                this.webmWriter = null;
            }
        }

        /**
         * Blobをダウンロード
         */
        _downloadBlob(blob, filename) {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            
            setTimeout(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }, 100);
        }

        /**
         * 録画状態の取得
         */
        isExporting() {
            return this.isRecording;
        }
    }

    // グローバル登録
    window.WebMExporter = WebMExporter;

})();