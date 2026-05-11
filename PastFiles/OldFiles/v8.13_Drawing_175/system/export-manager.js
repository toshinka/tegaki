/**
 * ================================================================================
 * system/export-manager.js - スクリーンショット方式統合【v8.18.0】
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
 *   - webp-exporter.js (WEBP出力)
 *   - psd-exporter.js (PSD出力 - Phase 5: 基盤のみ)
 *   - apng-exporter.js (APNG出力)
 *   - mp4-exporter.js (MP4出力)
 * 
 * 【責務】
 *   - エクスポーター統合管理
 *   - フォーマット自動判定
 *   - ファイルダウンロード/クリップボード
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
         * エクスポート実行
         * 
         * PNGの場合はフレーム数でAPNG自動切替
         */
        async export(format, options = {}) {
            let targetFormat = format;
            
            // PNG → APNG自動切替
            if (format === 'png' && this._shouldUseAPNG()) {
                targetFormat = 'apng';
                console.log('🎬 Auto-switching: PNG → APNG (multiple frames detected)');
            }
            
            const exporter = this.exporters[targetFormat];
            if (!exporter) {
                throw new Error(`Unsupported format: ${targetFormat}`);
            }
            
            this.currentExport = { format: targetFormat, progress: 0 };
            
            try {
                const result = await exporter.export(options);
                this.currentExport = null;
                return result;
            } catch (error) {
                this.currentExport = null;
                throw error;
            }
        }
        
        /**
         * プレビュー生成
         */
        async generatePreview(format, options = {}) {
            let targetFormat = format;
            
            // PNG → APNG自動切替
            if (format === 'png' && this._shouldUseAPNG()) {
                targetFormat = 'apng';
            }
            
            const exporter = this.exporters[targetFormat];
            if (!exporter || !exporter.generateBlob) {
                throw new Error(`Preview not supported for format: ${targetFormat}`);
            }
            
            const blob = await exporter.generateBlob(options);
            return { blob, format: targetFormat };
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
            if (!exporter?.generateBlob) {
                throw new Error('WEBP exporter not available');
            }
            return await exporter.generateBlob(options);
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

console.log('✅ export-manager.js v8.18.0 loaded (スクリーンショット方式統合)');
console.log('   🎨 renderToCanvas() 廃止（後方互換あり）');
console.log('   ✓ WEBP/PSDエクスポータ対応');
console.log('   ❌ GIFエクスポータ削除');