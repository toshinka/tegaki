// ==================================================
// system/exporters/png-exporter.js
// PNG静止画エクスポーター - バリデーション強化版
// ==================================================
window.PNGExporter = (function() {
    'use strict';
    
    class PNGExporter {
        constructor(exportManager) {
            if (!exportManager) {
                throw new Error('PNGExporter: exportManager is required');
            }
            this.manager = exportManager;
        }
        
        async export(options = {}) {
            if (!this.manager || !this.manager.layerSystem) {
                throw new Error('PNGExporter: manager or layerSystem not available');
            }
            
            window.TegakiEventBus?.emit('export:started', { format: 'png' });
            
            const canvas = this.manager.renderToCanvas(options);
            
            return new Promise((resolve, reject) => {
                canvas.toBlob((blob) => {
                    if (!blob) {
                        const error = new Error('PNG generation failed');
                        window.TegakiEventBus?.emit('export:failed', { format: 'png', error });
                        reject(error);
                        return;
                    }
                    
                    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
                    const filename = `tegaki_${timestamp}.png`;
                    
                    this.manager.downloadFile(blob, filename);
                    
                    window.TegakiEventBus?.emit('export:completed', { 
                        format: 'png', 
                        size: blob.size,
                        filename: filename
                    });
                    
                    resolve({ blob, filename });
                }, 'image/png');
            });
        }
        
        async copy(options = {}) {
            if (!this.manager || !this.manager.layerSystem) {
                throw new Error('PNGExporter: manager or layerSystem not available');
            }
            
            const canvas = this.manager.renderToCanvas(options);
            
            return new Promise((resolve, reject) => {
                canvas.toBlob(async (blob) => {
                    if (!blob) {
                        reject(new Error('PNG generation failed'));
                        return;
                    }
                    
                    const success = await this.manager.copyToClipboard(blob);
                    
                    if (success) {
                        window.TegakiEventBus?.emit('export:copied', { format: 'png' });
                        resolve({ success: true });
                    } else {
                        reject(new Error('Clipboard copy failed'));
                    }
                }, 'image/png');
            });
        }
    }
    
    return PNGExporter;
})();

console.log('✅ png-exporter.js (バリデーション強化版) loaded');