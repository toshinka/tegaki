// ==================================================
// system/export-manager.js
// エクスポート統合管理システム - 静音ダウンロード対応版
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
        
        async export(format, options = {}) {
            const exporter = this.exporters[format];
            if (!exporter) {
                throw new Error(`Unsupported format: ${format}`);
            }
            
            this.currentExport = { format, progress: 0 };
            
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
         * copyGifToClipboard
         * GIF BlobをClipboard APIを使ってクリップボードへコピー
         * @param {Blob} blob - image/gif MIME type のBlob
         * @returns {Promise<void>}
         * @throws {Error} code付きエラー (NO_CLIPBOARD_API, NO_CLIPBOARDITEM, CLIPBOARD_WRITE_FAILED)
         */
        async copyGifToClipboard(blob) {
            if (!navigator.clipboard) {
                const err = new Error('Clipboard API not available');
                err.code = 'NO_CLIPBOARD_API';
                throw err;
            }
            if (typeof ClipboardItem === 'undefined') {
                const err = new Error('ClipboardItem not supported in this environment');
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
                return;
            } catch (e) {
                const err = new Error('CLIPBOARD_WRITE_FAILED: ' + (e && e.message));
                err.code = 'CLIPBOARD_WRITE_FAILED';
                err.inner = e;
                throw err;
            }
        }
        
        /**
         * copyGifToClipboardWithFallback
         * GIF Blobをクリップボードへコピーを試行し、失敗時に新規タブで開く（静音）
         * @param {Blob} blob - image/gif MIME type のBlob
         * @returns {Promise<{ok: boolean, method: string}>}
         */
        async copyGifToClipboardWithFallback(blob) {
            try {
                await this.copyGifToClipboard(blob);
                return { ok: true, method: 'clipboard' };
            } catch (err) {
                try {
                    const url = URL.createObjectURL(blob);
                    
                    // 新規タブで開く（ダウンロードダイアログなし）
                    const newTab = window.open(url, '_blank');
                    
                    // URLを10秒後に解放
                    setTimeout(() => URL.revokeObjectURL(url), 10000);
                    
                    if (!newTab) {
                        throw new Error('ポップアップがブロックされました');
                    }
                } catch (openErr) {
                    const fallbackErr = new Error('FALLBACK_OPEN_FAILED: ' + (openErr && openErr.message));
                    fallbackErr.code = 'FALLBACK_OPEN_FAILED';
                    throw fallbackErr;
                }
                return { ok: false, method: 'fallback' };
            }
        }
        
        renderToCanvas(options = {}) {
            const width = options.width || window.TEGAKI_CONFIG.canvas.width;
            const height = options.height || window.TEGAKI_CONFIG.canvas.height;
            const resolution = options.resolution || 2;
            
            const container = options.container || 
                             this.layerSystem.layersContainer || 
                             this.layerSystem.currentCutContainer;
            
            if (!container) {
                throw new Error('ExportManager.renderToCanvas: layers container is not available. Ensure layerSystem.currentCutContainer is properly initialized.');
            }
            
            if (typeof container.updateLocalTransform !== 'function') {
                throw new Error('ExportManager.renderToCanvas: provided container is not a PIXI DisplayObject');
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
            return this.currentExport?.progress || 0;
        }
        
        abortExport() {
            if (this.currentExport) {
                this.currentExport = null;
                window.TegakiEventBus?.emit('export:aborted');
            }
        }
    }
    
    return ExportManager;
})();

console.log('✅ export-manager.js (静音ダウンロード対応版) loaded');