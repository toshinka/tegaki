// ==================================================
// system/export-manager.js
// エクスポート統合管理 - PNG/APNG自動判定対応（デバッグ版）
// ==================================================
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
        
        registerExporter(format, exporter) {
            this.exporters[format] = exporter;
        }
        
        /**
         * PNG出力自動判定（CUT数で判定）
         */
        _shouldUseAPNG() {
            const animData = this.animationSystem && this.animationSystem.getAnimationData 
                ? this.animationSystem.getAnimationData() 
                : null;
            const cutCount = animData && animData.cuts ? animData.cuts.length : 0;
            return cutCount >= 2;
        }
        
        /**
         * エクスポート実行（自動判定対応）
         */
        async export(format, options = {}) {
            // PNG指定時はCUT数で自動判定
            let targetFormat = format;
            if (format === 'png' && this._shouldUseAPNG()) {
                targetFormat = 'apng';
            }
            
            const exporter = this.exporters[targetFormat];
            if (!exporter) {
                throw new Error('Unsupported format: ' + targetFormat);
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
         * プレビュー生成（自動判定対応）
         */
        async generatePreview(format, options = {}) {
            // PNG指定時はCUT数で自動判定
            let targetFormat = format;
            if (format === 'png' && this._shouldUseAPNG()) {
                targetFormat = 'apng';
            }
            
            const exporter = this.exporters[targetFormat];
            if (!exporter || !exporter.generateBlob) {
                throw new Error('Preview not supported for format: ' + targetFormat);
            }
            
            const blob = await exporter.generateBlob(options);
            return { blob: blob, format: targetFormat };
        }
        
        /**
         * ArrayBuffer → Base64変換
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
        
        /**
         * Blob → Data URL変換
         */
        async blobToDataURL(blob) {
            const arrayBuffer = await blob.arrayBuffer();
            const base64 = this.arrayBufferToBase64(arrayBuffer);
            return 'data:' + blob.type + ';base64,' + base64;
        }
        
        /**
         * GIFクリップボードコピー
         */
        async copyGifToClipboard(blob) {
            if (!navigator.clipboard) {
                const err = new Error('Clipboard API not available');
                err.code = 'NO_CLIPBOARD_API';
                throw err;
            }
            if (typeof ClipboardItem === 'undefined') {
                const err = new Error('ClipboardItem not supported');
                err.code = 'NO_CLIPBOARDITEM';
                throw err;
            }
            
            let targetBlob = blob;
            if (blob.type !== 'image/gif') {
                const buffer = await blob.arrayBuffer();
                targetBlob = new Blob([buffer], { type: 'image/gif' });
            }
            
            try {
                const clipboardItem = new ClipboardItem({ 'image/gif': targetBlob });
                await navigator.clipboard.write([clipboardItem]);
            } catch (e) {
                const err = new Error('Clipboard write failed: ' + (e && e.message));
                err.code = 'CLIPBOARD_WRITE_FAILED';
                err.inner = e;
                throw err;
            }
        }
        
        /**
         * GIFコピー（フォールバック付き）
         */
        async copyGifWithPreviewFallback(blob) {
            try {
                await this.copyGifToClipboard(blob);
                return { success: true, blob: blob };
            } catch (err) {
                const dataUrl = await this.blobToDataURL(blob);
                return { success: false, blob: blob, dataUrl: dataUrl };
            }
        }
        
        /**
         * Canvasレンダリング
         */
        renderToCanvas(options = {}) {
            const width = options.width || window.TEGAKI_CONFIG.canvas.width;
            const height = options.height || window.TEGAKI_CONFIG.canvas.height;
            const resolution = options.resolution || 2;
            
            const container = options.container || 
                             this.layerSystem.layersContainer || 
                             this.layerSystem.currentCutContainer;
            
            if (!container) {
                throw new Error('layers container is not available');
            }
            
            if (typeof container.updateLocalTransform !== 'function') {
                throw new Error('provided container is not a PIXI DisplayObject');
            }
            
            const renderTexture = PIXI.RenderTexture.create({
                width: width,
                height: height,
                resolution: resolution
            });
            
            this.app.renderer.render({
                container: container,
                target: renderTexture
            });
            
            const canvas = this.app.renderer.extract.canvas(renderTexture);
            renderTexture.destroy();
            
            return canvas;
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
                return false;
            }
        }
        
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

console.log('✅ export-manager.js (PNG/APNG自動判定対応・デバッグ版) loaded');