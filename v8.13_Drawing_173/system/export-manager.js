/**
 * ================================================================================
 * system/export-manager.js - DPR=1統一版【v8.14.0】
 * ================================================================================
 * 
 * 【依存関係 - Parents】
 *   - PixiJS v8.13 (RenderTexture, renderer.extract)
 *   - layer-system.js (レイヤー管理)
 *   - animation-system.js (アニメーションデータ)
 *   - camera-system.js (カメラ制御)
 * 
 * 【依存関係 - Children】
 *   - png-exporter.js (PNG出力)
 *   - apng-exporter.js (APNG出力)
 *   - gif-exporter.js (GIF出力)
 *   - webp-exporter.js (WebP出力)
 *   - mp4-exporter.js (MP4出力)
 * 
 * 【責務】
 *   - エクスポーター統合管理
 *   - Canvas描画（DPR=1固定）
 *   - フォーマット自動判定
 *   - ファイルダウンロード/クリップボード
 * 
 * 【v8.14.0 改修内容 - DPR=1統一】
 *   🚨 renderToCanvas で resolution=1 固定
 *   🚨 高DPI出力オプションを完全削除
 *   ✅ 描画時と出力時の解像度を完全一致
 *   ✅ ユーザーの期待値と出力結果の一致を保証
 *   ✅ ベクターラスタライズは antialias で高品質化
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
        
        registerExporter(format, exporter) {
            this.exporters[format] = exporter;
        }
        
        _shouldUseAPNG() {
            const animData = this.animationSystem && this.animationSystem.getAnimationData 
                ? this.animationSystem.getAnimationData() 
                : null;
            const frameCount = animData && animData.frames ? animData.frames.length : 0;
            return frameCount >= 2;
        }
        
        async export(format, options = {}) {
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
        
        async generatePreview(format, options = {}) {
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
        
        async exportAsPNGBlob(options = {}) {
            const exporter = this.exporters['png'];
            if (!exporter || !exporter.generateBlob) {
                throw new Error('PNG exporter not available');
            }
            return await exporter.generateBlob(options);
        }
        
        async exportAsAPNGBlob(options = {}) {
            const exporter = this.exporters['apng'];
            if (!exporter || !exporter.generateBlob) {
                throw new Error('APNG exporter not available');
            }
            return await exporter.generateBlob(options);
        }
        
        async exportAsGIFBlob(options = {}) {
            const exporter = this.exporters['gif'];
            if (!exporter || !exporter.generateBlob) {
                throw new Error('GIF exporter not available');
            }
            return await exporter.generateBlob(options);
        }
        
        async exportAsWebPBlob(options = {}) {
            const exporter = this.exporters['webp'];
            if (!exporter || !exporter.generateBlob) {
                throw new Error('WebP exporter not available');
            }
            return await exporter.generateBlob(options);
        }
        
        async exportAsAutoBlob(options = {}) {
            const format = this._shouldUseAPNG() ? 'apng' : 'png';
            return await this.generatePreview(format, options).then(r => r.blob);
        }
        
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
            return 'data:' + blob.type + ';base64,' + base64;
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
         * Canvas描画 - DPR=1統一版
         * 
         * 🚨 v8.14.0 重要変更:
         *   - resolution を常に 1 固定
         *   - options.resolution パラメータを無視
         *   - 描画時と出力時の解像度を完全一致
         *   - ベクターのジャギー対策は antialias で対応
         * 
         * 設計思想:
         *   - ユーザーが画面で見ている品質 = 出力品質
         *   - 意図しない高解像度化による混乱を防止
         *   - CLIP STUDIO PAINT等の標準的な動作に準拠
         */
        renderToCanvas(options = {}) {
            const width = options.width || window.TEGAKI_CONFIG.canvas.width;
            const height = options.height || window.TEGAKI_CONFIG.canvas.height;
            
            // 🚨 DPR=1固定（options.resolutionを無視）
            const resolution = 1;
            
            const container = options.container || 
                             this.layerSystem.layersContainer || 
                             this.layerSystem.currentFrameContainer;
            
            if (!container) {
                throw new Error('layers container is not available');
            }
            
            if (typeof container.updateLocalTransform !== 'function') {
                throw new Error('provided container is not a PIXI DisplayObject');
            }
            
            // RenderTexture作成（DPR=1固定）
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

console.log('✅ export-manager.js v8.14.0 loaded (DPR=1統一)');
console.log('   🚨 renderToCanvas: resolution=1 固定');
console.log('   ✓ 描画時と出力時の解像度を完全一致');