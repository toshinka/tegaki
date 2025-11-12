/**
 * ================================================================================
 * system/export-manager.js - Animated WEBP対応【v8.32.0】
 * ================================================================================
 * 
 * 【依存関係 - Parents】
 *   - PixiJS v8.13 (renderer.extract API)
 *   - layer-system.js (レイヤー管理)
 *   - animation-system.js (アニメーションデータ)
 *   - camera-system.js (カメラ制御)
 * 
 * 【依存関係 - Children】
 *   - png-exporter.js (PNG出力)
 *   - webp-exporter.js (静止画WEBP出力)
 *   - animated-webp-exporter.js (Animated WEBP出力 - WASM統合)
 *   - psd-exporter.js (PSD出力 - Phase 5: 基盤のみ)
 *   - apng-exporter.js (APNG出力)
 *   - mp4-exporter.js (MP4出力)
 * 
 * 【責務】
 *   - エクスポーター統合管理
 *   - フォーマット自動判定（PNG→APNG / WEBP→Animated WEBP）
 *   - ファイルダウンロード/クリップボード
 *   - 連番PNG出力（ffmpeg変換用）
 * 
 * 【v8.32.0 改修内容】
 *   🔧 Animated WEBP呼び出しを最適化
 *   🔧 animated-webp-exporter.jsへの直接呼び出し
 *   🔧 静止画WEBP/Animated WEBPの完全分離
 * 
 * ================================================================================
 */

window.ExportManager = (function() {
    'use strict';
    
    class ExportManager {
        constructor(app, layerSystem, animationSystem, cameraSystem) {
            if (!app || !app.renderer) {
                throw new Error('ExportManager: app and renderer are required');
            }
            if (!layerSystem) {
                throw new Error('ExportManager: layerSystem is required');
            }
            if (!animationSystem) {
                throw new Error('ExportManager: animationSystem is required');
            }
            
            this.app = app;
            this.layerSystem = layerSystem;
            this.animationSystem = animationSystem;
            this.cameraSystem = cameraSystem;
            this.exporters = {};
            this.currentExport = null;
        }
        
        /**
         * エクスポータ登録
         */
        registerExporter(format, exporter) {
            this.exporters[format] = exporter;
        }
        
        /**
         * フレーム数取得（厳格版）
         */
        _getFrameCount() {
            const animData = this.animationSystem?.getAnimationData?.();
            if (!animData || !animData.frames || !Array.isArray(animData.frames)) {
                return 0;
            }
            return animData.frames.length;
        }
        
        /**
         * APNG自動検出（PNG用）
         */
        _shouldUseAPNG() {
            return this._getFrameCount() >= 2;
        }
        
        /**
         * Animated WEBP自動検出（WEBP用）
         */
        _shouldUseAnimatedWebP() {
            return this._getFrameCount() >= 2;
        }
        
        /**
         * キャンバスサイズ取得
         */
        getCanvasSize() {
            const config = window.TEGAKI_CONFIG?.canvas;
            return {
                width: config?.width || 400,
                height: config?.height || 400
            };
        }
        
        /**
         * エクスポート実行
         */
        async export(format, options = {}) {
            let targetFormat = format;
            let actualFormat = format;
            
            // PNG → APNG自動切替
            if (format === 'png' && this._shouldUseAPNG()) {
                targetFormat = 'apng';
                actualFormat = 'apng';
            }
            
            // WEBP → Animated WEBP判定（エクスポータ分離）
            if (format === 'webp' && this._shouldUseAnimatedWebP()) {
                targetFormat = 'animated-webp';
                actualFormat = 'animated-webp';
            }
            
            const exporter = this.exporters[targetFormat];
            if (!exporter) {
                throw new Error(`Unsupported format: ${targetFormat}`);
            }
            
            this.currentExport = { format: actualFormat, progress: 0 };
            
            try {
                let blob;
                
                // 各エクスポータのexport()メソッドを直接呼び出し
                blob = await exporter.export(options);
                
                // export()の戻り値がオブジェクトの場合、blobを抽出
                if (blob && typeof blob === 'object' && blob.blob) {
                    blob = blob.blob;
                }
                
                // ダウンロード（エクスポータ側でダウンロード済みの場合はスキップ）
                if (!options.skipDownload && blob instanceof Blob) {
                    const timestamp = this._getTimestamp();
                    const filename = this._generateFilename(actualFormat, timestamp);
                    this.downloadFile(blob, filename);
                    
                    // 完了通知
                    if (window.TegakiEventBus) {
                        window.TegakiEventBus.emit('export:completed', {
                            format: actualFormat,
                            filename: filename
                        });
                    }
                    
                    this.currentExport = null;
                    return { blob, format: actualFormat, filename };
                }
                
                this.currentExport = null;
                return blob;
                
            } catch (error) {
                this.currentExport = null;
                
                if (window.TegakiEventBus) {
                    window.TegakiEventBus.emit('export:failed', {
                        format: actualFormat,
                        error: error.message
                    });
                }
                
                throw error;
            }
        }
        
        /**
         * 連番PNG一括出力（ffmpeg変換用）
         */
        async exportSequencePNG(options = {}) {
            const frameCount = this._getFrameCount();
            if (frameCount < 2) {
                throw new Error('アニメーションフレームが2枚以上必要です');
            }
            
            const resolution = options.resolution || 1;
            const timestamp = this._getTimestamp();
            const baseName = `tegaki_${timestamp}`;
            
            this.currentExport = { format: 'sequence-png', progress: 0 };
            
            if (window.TegakiEventBus) {
                window.TegakiEventBus.emit('export:started', { 
                    format: 'sequence-png',
                    total: frameCount
                });
            }
            
            try {
                const pngExporter = this.exporters['png'];
                if (!pngExporter) {
                    throw new Error('PNG Exporter not available');
                }
                
                const currentFrame = this.animationSystem.getCurrentFrameIndex();
                const blobs = [];
                
                // 各フレームを個別に出力
                for (let i = 0; i < frameCount; i++) {
                    // フレーム切り替え
                    this.animationSystem.setCurrentFrame(i);
                    await this._waitFrame();
                    
                    // PNG生成
                    const blob = await pngExporter.generateBlob({
                        resolution: resolution,
                        transparent: options.transparent
                    });
                    
                    // ゼロパディング (0001, 0002, ...)
                    const frameNum = String(i + 1).padStart(4, '0');
                    const filename = `${baseName}_${frameNum}.png`;
                    
                    this.downloadFile(blob, filename);
                    blobs.push({ blob, filename, index: i });
                    
                    // 進捗通知
                    const progress = Math.round(((i + 1) / frameCount) * 100);
                    this.currentExport.progress = progress;
                    
                    if (window.TegakiEventBus) {
                        window.TegakiEventBus.emit('export:progress', {
                            current: i + 1,
                            total: frameCount,
                            progress: progress
                        });
                    }
                }
                
                // 元のフレームに戻す
                this.animationSystem.setCurrentFrame(currentFrame);
                
                // 完了通知
                if (window.TegakiEventBus) {
                    window.TegakiEventBus.emit('export:completed', {
                        format: 'sequence-png',
                        count: frameCount,
                        baseName: baseName
                    });
                }
                
                this.currentExport = null;
                
                const animData = this.animationSystem.getAnimationData();
                return {
                    blobs: blobs,
                    baseName: baseName,
                    frameCount: frameCount,
                    ffmpegCommand: this._generateFFmpegCommand(baseName, animData)
                };
                
            } catch (error) {
                // エラー時も元のフレームに戻す
                const currentFrame = this.animationSystem.getCurrentFrameIndex();
                this.animationSystem.setCurrentFrame(currentFrame);
                
                this.currentExport = null;
                
                if (window.TegakiEventBus) {
                    window.TegakiEventBus.emit('export:failed', {
                        format: 'sequence-png',
                        error: error.message
                    });
                }
                
                throw error;
            }
        }
        
        /**
         * ffmpegコマンド生成
         */
        _generateFFmpegCommand(baseName, animData) {
            const fps = animData.fps || 12;
            
            // Animated WebP用コマンド
            const webpCmd = `ffmpeg -framerate ${fps} -i ${baseName}_%04d.png -c:v libwebp -lossless 0 -quality 90 -loop 0 ${baseName}.webp`;
            
            // MP4用コマンド
            const mp4Cmd = `ffmpeg -framerate ${fps} -i ${baseName}_%04d.png -c:v libx264 -pix_fmt yuv420p -crf 18 ${baseName}.mp4`;
            
            // GIF用コマンド
            const gifCmd = `ffmpeg -framerate ${fps} -i ${baseName}_%04d.png -vf "split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse" ${baseName}.gif`;
            
            return {
                webp: webpCmd,
                mp4: mp4Cmd,
                gif: gifCmd
            };
        }
        
        /**
         * フレーム待機
         */
        async _waitFrame() {
            return new Promise(resolve => requestAnimationFrame(resolve));
        }
        
        /**
         * プレビュー生成【v8.32.0 Animated WEBP完全対応】
         */
        async generatePreview(format, options = {}) {
            let targetFormat = format;
            let actualFormat = format;
            
            // フレーム数を厳格に取得
            const frameCount = this._getFrameCount();
            
            // PNG → APNG自動切替
            if (format === 'png' && frameCount >= 2) {
                targetFormat = 'apng';
                actualFormat = 'apng';
            }
            
            // WEBP → Animated WEBP自動切替
            if (format === 'webp' && frameCount >= 2) {
                targetFormat = 'animated-webp';
                actualFormat = 'animated-webp';
            }
            
            const exporter = this.exporters[targetFormat];
            if (!exporter) {
                throw new Error(`Preview not supported for format: ${targetFormat}`);
            }
            
            let blob;
            
            try {
                // プレビュー用オプション（低解像度・低品質）
                const previewOptions = {
                    ...options,
                    resolution: options.resolution || 1,
                    quality: 80
                };
                
                // generatePreview → generateBlob → export の順で試行
                if (exporter.generatePreview) {
                    blob = await exporter.generatePreview(previewOptions);
                } else if (exporter.generateBlob) {
                    blob = await exporter.generateBlob(previewOptions);
                } else if (exporter.export) {
                    const result = await exporter.export({ ...previewOptions, skipDownload: true });
                    blob = result.blob || result;
                } else {
                    throw new Error(`No suitable method for preview generation`);
                }
                
                if (!blob || blob.size === 0) {
                    throw new Error('プレビュー生成に失敗しました（空のBlobが生成されました）');
                }
                
                return { blob, format: actualFormat };
                
            } catch (error) {
                console.error('Preview generation error:', error);
                throw new Error(`プレビュー生成エラー: ${error.message}`);
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
        
        /**
         * ファイル名生成
         */
        _generateFilename(format, timestamp) {
            const ext = {
                'png': '.png',
                'apng': '.png',
                'webp': '.webp',
                'animated-webp': '.webp',
                'psd': '.psd',
                'mp4': '.mp4'
            }[format] || '.png';
            
            return `tegaki_${timestamp}${ext}`;
        }
        
        /**
         * 各フォーマット別Blob生成メソッド
         */
        async exportAsPNGBlob(options = {}) {
            const exporter = this.exporters['png'];
            if (!exporter?.generateBlob) {
                throw new Error('PNG exporter not available');
            }
            return await exporter.generateBlob(options);
        }
        
        async exportAsAPNGBlob(options = {}) {
            const exporter = this.exporters['apng'];
            if (!exporter?.generateBlob) {
                throw new Error('APNG exporter not available');
            }
            return await exporter.generateBlob(options);
        }
        
        async exportAsWebPBlob(options = {}) {
            if (this._shouldUseAnimatedWebP()) {
                const exporter = this.exporters['animated-webp'];
                if (!exporter?.generateBlob) {
                    throw new Error('Animated WEBP exporter not available');
                }
                return await exporter.generateBlob(options);
            } else {
                const exporter = this.exporters['webp'];
                if (!exporter?.generateBlob) {
                    throw new Error('WEBP exporter not available');
                }
                return await exporter.generateBlob(options);
            }
        }
        
        async exportAsPSDBlob(options = {}) {
            const exporter = this.exporters['psd'];
            if (!exporter?.generateBlob) {
                throw new Error('PSD exporter not available');
            }
            return await exporter.generateBlob(options);
        }
        
        async exportAsAutoBlob(options = {}) {
            const format = this._shouldUseAPNG() ? 'apng' : 'png';
            return await this.generatePreview(format, options).then(r => r.blob);
        }
        
        /**
         * ユーティリティメソッド
         */
        arrayBufferToBase64(buffer) {
            const bytes = new Uint8Array(buffer);
            let binary = '';
            const chunkSize = 0x8000;
            
            for (let i = 0; i < bytes.length; i += chunkSize) {
                const chunk = bytes.subarray(i, i + chunkSize);
                binary += String.fromCharCode.apply(null, chunk);
            }
            
            return btoa(binary);
        }
        
        async blobToDataURL(blob) {
            const arrayBuffer = await blob.arrayBuffer();
            const base64 = this.arrayBufferToBase64(arrayBuffer);
            return `data:${blob.type};base64,${base64}`;
        }
        
        dataURLToBlob(dataURL) {
            const arr = dataURL.split(',');
            const mime = arr[0].match(/:(.*?);/)[1];
            const bstr = atob(arr[1]);
            let n = bstr.length;
            const u8arr = new Uint8Array(n);
            while(n--) {
                u8arr[n] = bstr.charCodeAt(n);
            }
            return new Blob([u8arr], { type: mime });
        }
        
        /**
         * ファイルダウンロード
         */
        downloadFile(blob, filename) {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        }
        
        /**
         * クリップボードコピー
         */
        async copyToClipboard(blob) {
            try {
                const item = new ClipboardItem({ [blob.type]: blob });
                await navigator.clipboard.write([item]);
                return true;
            } catch (error) {
                console.error('Clipboard copy failed:', error);
                return false;
            }
        }
        
        /**
         * エクスポート状態確認
         */
        isExporting() {
            return this.currentExport !== null;
        }
        
        getCurrentProgress() {
            return this.currentExport ? this.currentExport.progress : 0;
        }
        
        abortExport() {
            if (this.currentExport) {
                this.currentExport = null;
                if (window.TegakiEventBus) {
                    window.TegakiEventBus.emit('export:aborted');
                }
            }
        }
    }
    
    return ExportManager;
})();

console.log('✅ export-manager.js v8.32.0 loaded');
console.log('   🔧 Animated WEBP完全対応（WASM統合）');