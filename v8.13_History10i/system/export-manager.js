// ==================================================
// system/export-manager.js
// エクスポート統合管理システム - バリデーション強化版
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
        
        renderToCanvas(options = {}) {
            const width = options.width || window.TEGAKI_CONFIG.canvas.width;
            const height = options.height || window.TEGAKI_CONFIG.canvas.height;
            const resolution = options.resolution || 2;
            
            // layersContainerまたはcurrentCutContainerを取得
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
                console.error('Clipboard copy failed:', error);
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

console.log('✅ export-manager.js (バリデーション強化版) loaded');