/**
 * ================================================================================
 * system/export-manager.js - PixiJS v8最適化版【v8.17.0】
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
 *   - Canvas描画（PixiJS v8 API準拠）
 *   - フォーマット自動判定
 *   - ファイルダウンロード/クリップボード
 * 
 * 【v8.17.1 改修内容】
 *   🎨 PixiJS v8の extract.canvas() を正しく使用
 *   ✅ antialias:true でアンチエイリアス強化
 *   ✅ PNG/GIF両方で高品質出力
 *   ✅ MSAA_QUALITY未定義エラー修正
 * 
 * 【技術詳細】
 *   - RenderTexture: multisample=HIGH で高品質化
 *   - extract.canvas(): PixiJSの最適化された変換を利用
 *   - 上下反転: 自動処理（PixiJS内部で対応済み）
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
         * Canvas描画 - PixiJS v8最適化版【v8.17.1】
         * 
         * 🎨 アプローチ:
         *   1. RenderTexture作成（antialiasで高品質化）
         *   2. GPU上でレンダリング
         *   3. extract.canvas() でCanvas取得（PixiJS最適化済み）
         * 
         * メリット:
         *   - PixiJS v8の最適化されたパイプラインを活用
         *   - アンチエイリアスで高品質化
         *   - 上下反転・色空間変換を自動処理
         * 
         * @param {Object} options - 描画オプション
         * @param {number} options.width - 出力幅
         * @param {number} options.height - 出力高さ
         * @param {PIXI.Container} options.container - レンダリング対象
         * @returns {HTMLCanvasElement} 高品質キャンバス
         */
        renderToCanvas(options = {}) {
            const width = options.width || window.TEGAKI_CONFIG.canvas.width;
            const height = options.height || window.TEGAKI_CONFIG.canvas.height;
            
            const container = options.container || 
                             this.layerSystem.layersContainer || 
                             this.layerSystem.currentFrameContainer;
            
            if (!container) {
                throw new Error('layers container is not available');
            }
            
            if (typeof container.updateLocalTransform !== 'function') {
                throw new Error('provided container is not a PIXI DisplayObject');
            }
            
            // ステップ1: 高品質RenderTexture作成
            // PixiJS v8では antialias オプションを使用
            const renderTexture = PIXI.RenderTexture.create({
                width: width,
                height: height,
                resolution: 1,
                antialias: true  // v8.17.1: MSAA_QUALITY.HIGH の代わり
            });
            
            // ステップ2: GPU上でレンダリング
            this.app.renderer.render({
                container: container,
                target: renderTexture
            });
            
            // ステップ3: PixiJS最適化済みCanvasに変換
            const canvas = this.app.renderer.extract.canvas(renderTexture);
            
            // RenderTexture破棄
            renderTexture.destroy(true);
            
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

console.log('✅ export-manager.js v8.17.1 loaded (PixiJS v8最適化)');
console.log('   🎨 antialias:true で高品質化');
console.log('   ✓ extract.canvas() でシンプル化');
console.log('   ✓ PNG/GIF両方で高品質出力');