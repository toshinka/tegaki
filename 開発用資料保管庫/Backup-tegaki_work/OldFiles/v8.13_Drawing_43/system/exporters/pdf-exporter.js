// ==================================================
// system/exporters/pdf-exporter.js
// PDFエクスポーター - CUT→FRAME完全対応版
// ==================================================
window.PDFExporter = (function() {
    'use strict';
    
    class PDFExporter {
        constructor(exportManager) {
            if (!exportManager) {
                throw new Error('PDFExporter: exportManager is required');
            }
            this.manager = exportManager;
            this.isExporting = false;
        }
        
        async export(options = {}) {
            if (this.isExporting) {
                throw new Error('Export already in progress');
            }
            
            this._checkJsPDFAvailability();
            
            if (!this.manager || !this.manager.animationSystem) {
                throw new Error('AnimationSystem not available');
            }
            
            const animData = this.manager.animationSystem.getAnimationData();
            if (!animData || !animData.frames || animData.frames.length === 0) {
                throw new Error('エクスポート可能なフレームがありません');
            }
            
            if (window.TegakiEventBus) {
                window.TegakiEventBus.emit('export:started', { format: 'pdf' });
            }
            
            this.isExporting = true;
            
            try {
                const blob = await this.generateBlob(options);
                
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
                const filename = options.filename || ('tegaki_frames_' + timestamp + '.pdf');
                
                this.manager.downloadFile(blob, filename);
                
                if (window.TegakiEventBus) {
                    window.TegakiEventBus.emit('export:completed', {
                        format: 'pdf',
                        size: blob.size,
                        frames: animData.frames.length,
                        filename: filename
                    });
                }
                
                return { blob: blob, filename: filename, format: 'pdf' };
            } catch (error) {
                if (window.TegakiEventBus) {
                    window.TegakiEventBus.emit('export:failed', { 
                        format: 'pdf',
                        error: error.message
                    });
                }
                throw error;
            } finally {
                this.isExporting = false;
            }
        }
        
        async generateBlob(options = {}) {
            const CONFIG = window.TEGAKI_CONFIG;
            const animData = this.manager.animationSystem.getAnimationData();
            
            const settings = {
                width: options.width || CONFIG.canvas.width,
                height: options.height || CONFIG.canvas.height,
                orientation: options.orientation || 'portrait'
            };
            
            const maxSize = CONFIG.animation?.exportSettings || { maxWidth: 1920, maxHeight: 1080 };
            if (settings.width > maxSize.maxWidth) {
                const ratio = maxSize.maxWidth / settings.width;
                settings.width = maxSize.maxWidth;
                settings.height = Math.round(settings.height * ratio);
            }
            if (settings.height > maxSize.maxHeight) {
                const ratio = maxSize.maxHeight / settings.height;
                settings.height = maxSize.maxHeight;
                settings.width = Math.round(settings.width * ratio);
            }
            
            const pdf = new jspdf.jsPDF({
                orientation: settings.orientation,
                unit: 'px',
                format: [settings.width, settings.height]
            });
            
            const backupSnapshots = this.manager.animationSystem.captureAllLayerStates();
            
            for (let i = 0; i < animData.frames.length; i++) {
                if (i > 0) {
                    pdf.addPage();
                }
                
                this.manager.animationSystem.applyFrameToLayers(i);
                await this._waitFrame();
                
                const canvas = await this._renderFrameToCanvas(settings);
                if (!canvas) {
                    throw new Error('Failed to render frame ' + i);
                }
                
                const imgData = canvas.toDataURL('image/png');
                pdf.addImage(imgData, 'PNG', 0, 0, settings.width, settings.height);
                
                if (window.TegakiEventBus) {
                    window.TegakiEventBus.emit('export:frame-rendered', { 
                        frame: i + 1, 
                        total: animData.frames.length 
                    });
                }
            }
            
            this.manager.animationSystem.restoreFromSnapshots(backupSnapshots);
            
            return pdf.output('blob');
        }
        
        async _renderFrameToCanvas(settings) {
            const CONFIG = window.TEGAKI_CONFIG;
            
            const renderTexture = PIXI.RenderTexture.create({
                width: settings.width,
                height: settings.height,
                resolution: 1
            });
            
            const tempContainer = new PIXI.Container();
            
            const layersContainer = this.manager.animationSystem.layerSystem.currentFrameContainer;
            if (!layersContainer) {
                throw new Error('currentFrameContainer not found');
            }
            
            const originalParent = layersContainer.parent;
            const originalPosition = { 
                x: layersContainer.x, 
                y: layersContainer.y,
                scaleX: layersContainer.scale.x,
                scaleY: layersContainer.scale.y
            };
            
            if (originalParent) {
                originalParent.removeChild(layersContainer);
            }
            
            tempContainer.addChild(layersContainer);
            layersContainer.position.set(0, 0);
            
            if (settings.width !== CONFIG.canvas.width || settings.height !== CONFIG.canvas.height) {
                const scaleX = settings.width / CONFIG.canvas.width;
                const scaleY = settings.height / CONFIG.canvas.height;
                const scale = Math.min(scaleX, scaleY);
                
                layersContainer.scale.set(scale, scale);
                
                const scaledWidth = CONFIG.canvas.width * scale;
                const scaledHeight = CONFIG.canvas.height * scale;
                
                layersContainer.position.set(
                    (settings.width - scaledWidth) / 2,
                    (settings.height - scaledHeight) / 2
                );
            }
            
            this.manager.app.renderer.render({
                container: tempContainer,
                target: renderTexture
            });
            
            let canvas;
            try {
                const result = this.manager.app.renderer.extract.canvas(renderTexture);
                if (result instanceof Promise) {
                    canvas = await result;
                } else {
                    canvas = result;
                }
            } catch (extractError) {
                throw new Error('Canvas extraction failed: ' + extractError.message);
            }
            
            tempContainer.removeChild(layersContainer);
            layersContainer.position.set(originalPosition.x, originalPosition.y);
            layersContainer.scale.set(originalPosition.scaleX, originalPosition.scaleY);
            
            if (originalParent) {
                originalParent.addChild(layersContainer);
            }
            
            renderTexture.destroy(true);
            tempContainer.destroy({ children: true });
            
            return canvas;
        }
        
        _checkJsPDFAvailability() {
            if (typeof jspdf === 'undefined' || !jspdf.jsPDF) {
                throw new Error('jsPDF ライブラリが読み込まれていません。HTMLに以下を追加してください:\n<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>');
            }
        }
        
        _waitFrame() {
            return new Promise(resolve => {
                requestAnimationFrame(() => {
                    setTimeout(resolve, 16);
                });
            });
        }
    }
    
    return PDFExporter;
})();

console.log('✅ pdf-exporter.js (CUT→FRAME完全対応版) loaded');