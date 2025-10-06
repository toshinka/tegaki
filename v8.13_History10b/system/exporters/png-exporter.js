// ==================================================
// system/exporters/png-exporter.js
// PNG静止画エクスポーター
// ==================================================
window.PNGExporter = (function() {
    'use strict';
    
    class PNGExporter {
        constructor(exportManager) {
            this.manager = exportManager;
        }
        
        async export(options = {}) {
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
    }
    
    return PNGExporter;
})();

console.log('✅ png-exporter.js loaded');