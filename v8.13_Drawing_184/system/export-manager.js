/**
 * ================================================================================
 * system/export-manager.js - スクリーンショット方式統合【v8.24.0】
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
 *   - webp-exporter.js (WEBP/Animated WEBP出力)
 *   - psd-exporter.js (PSD出力 - Phase 5: 基盤のみ)
 *   - apng-exporter.js (APNG出力)
 *   - mp4-exporter.js (MP4出力)
 * 
 * 【責務】
 *   - エクスポーター統合管理
 *   - フォーマット自動判定（PNG→APNG / WEBP→Animated WEBP）
 *   - ファイルダウンロード/クリップボード
 * 
 * 【v8.24.0 改修内容】
 *   🔧 WEBP自動判定追加（フレーム数≧2でAnimated WEBP）
 *   🔧 Animated WEBP対応のためwebp-exporter統合
 * 
 * 【v8.18.0 重要改修 - スクリーンショット方式】
 *   ✅ renderToCanvas() を廃止
 *   ✅ 各エクスポータが直接 renderer.extract.canvas() を使用
 *   ✅ RenderTexture経由を完全排除
 *   ✅ WEBP/PSDエクスポータ追加
 *   ❌ GIFエクスポータ削除
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
         * 
         * v8.18.0: WEBP/PSD追加、GIF削除
         * v8.24.0: WEBP自動判定追加
         */
        registerExporter(format, exporter) {
            this.exporters[format] = exporter;
            console.log(`✅ Exporter registered: ${format}`);
        }
        
        /**
         * APNG自動検出（PNG用）
         */
        _shouldUseAPNG() {
            const animData = this.animationSystem?.getAnimationData?.();
            const frameCount = animData?.frames?.length || 0;
            return frameCount >= 2;
        }
        
        /**
         * Animated WEBP自動検出（WEBP用）
         * v8.24.0追加
         */
        _shouldUseAnimatedWebP() {
            const animData = this.animationSystem?.getAnimationData?.();
            const frameCount = animData?.frames?.length || 0;
            return frameCount >= 2;
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
         * 
         * PNG: フレーム数≧2で自動APNG
         * WEBP: フレーム数≧2で自動Animated WEBP
         */
        async export(format, options = {}) {
            let targetFormat = format;
            let actualFormat = format;
            
            // PNG → APNG自動切替
            if (format === 'png' && this._shouldUseAPNG()) {
                targetFormat = 'apng';
                actualFormat = 'apng';
                console.log('🎬 Auto-switching: PNG → APNG (multiple frames detected)');
            }
            
            // WEBP → Animated WEBP判定（統一エクスポータ使用）
            if (format === 'webp' && this._shouldUseAnimatedWebP()) {
                targetFormat = 'webp'; // エクスポータは同じ
                actualFormat = 'animated-webp';
                options.animated = true; // フラグで判定
                console.log('🎬 Auto-switching: WEBP → Animated WEBP (multiple frames detected)');
            }
            
            const exporter = this.exporters[targetFormat];
            if (!exporter) {
                throw new Error(`Unsupported format: ${targetFormat}`);
            }
            
            this.currentExport = { format: actualFormat, progress: 0 };
            
            try {
                let blob;
                
                // WEBPの場合はアニメーション判定
                if (format === 'webp' && options.animated) {
                    blob = await exporter.generateAnimatedWebP(options);
                } else {
                    blob = await exporter.generateStaticWebP 
                        ? await exporter.generateStaticWebP(options) 
                        : await exporter.export(options);
                }
                
                // ダウンロード
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
         * プレビュー生成
         * v8.24.0: Animated WEBP対応
         */
        async generatePreview(format, options = {}) {
            let targetFormat = format;
            let actualFormat = format;
            
            // PNG → APNG自動切替
            if (format === 'png' && this._shouldUseAPNG()) {
                targetFormat = 'apng';
                actualFormat = 'apng';
            }
            
            // WEBP → Animated WEBP判定
            if (format === 'webp' && this._shouldUseAnimatedWebP()) {
                targetFormat = 'webp';
                actualFormat = 'animated-webp';
                options.animated = true;
            }
            
            const exporter = this.exporters[targetFormat];
            if (!exporter) {
                throw new Error(`Preview not supported for format: ${targetFormat}`);
            }
            
            let blob;
            
            // エクスポータがgeneratePreviewを持っていればそれを使用
            if (exporter.generatePreview) {
                blob = await exporter.generatePreview(options);
            } else if (format === 'webp' && options.animated && exporter.generateAnimatedWebP) {
                blob = await exporter.generateAnimatedWebP({
                    ...options,
                    resolution: 0.5, // プレビューは低解像度
                    quality: 70
                });
            } else if (exporter.generateStaticWebP) {
                blob = await exporter.generateStaticWebP({
                    ...options,
                    resolution: 0.5,
                    quality: 70
                });
            } else if (exporter.generateBlob) {
                blob = await exporter.generateBlob(options);
            } else if (exporter.export) {
                blob = await exporter.export(options);
            } else {
                throw new Error(`No suitable method for preview generation: ${targetFormat}`);
            }
            
            return { blob, format: actualFormat };
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
         * 
         * ⚠️ これらは後方互換のため残すが、
         *    実際は各エクスポータのgenerateBlob()を直接使用推奨
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
            const exporter = this.exporters['webp'];
            if (!exporter) {
                throw new Error('WEBP exporter not available');
            }
            
            // アニメーション判定
            if (this._shouldUseAnimatedWebP()) {
                return await exporter.generateAnimatedWebP(options);
            } else {
                return await exporter.generateStaticWebP(options);
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
        
        /**
         * 🚨 廃止メソッド - renderToCanvas()
         * 
         * v8.18.0: スクリーンショット方式により不要
         * 
         * 各エクスポータは直接 renderer.extract.canvas() を使用するため、
         * この中間レイヤーは削除。
         * 
         * もし既存コードで使われている場合のため、
         * 警告を出して代替実装を提供。
         */
        renderToCanvas(options = {}) {
            console.warn('⚠️ renderToCanvas() is deprecated in v8.18.0');
            console.warn('   Use renderer.extract.canvas() directly in exporters');
            
            // 後方互換のための最小実装
            const container = options.container || 
                             this.layerSystem.layersContainer || 
                             this.layerSystem.currentFrameContainer;
            
            if (!container) {
                throw new Error('Container not available');
            }
            
            // スクリーンショット方式で代替
            return this.app.renderer.extract.canvas({
                target: container,
                resolution: 1,
                alpha: true,
                antialias: true
            });
        }
    }
    
    return ExportManager;
})();

console.log('✅ export-manager.js v8.24.0 loaded (Animated WEBP対応)');
console.log('   🎨 WEBP自動判定追加（フレーム数≧2）');
console.log('   🎬 PNG→APNG / WEBP→Animated WEBP 自動切替');
console.log('   ✓ webpxmux.js統合対応');