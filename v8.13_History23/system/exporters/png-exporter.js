// ==================================================
// system/exporters/png-exporter.js
// PNG静止画エクスポーター - 単一フレーム専用
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
        
        /**
         * PNG画像エクスポート（ダウンロード）
         */
        async export(options = {}) {
            if (!this.manager?.layerSystem) {
                throw new Error('LayerSystem not available');
            }
            
            window.TegakiEventBus?.emit('export:started', { format: 'png' });
            
            try {
                const blob = await this.generateBlob(options);
                
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
                const filename = options.filename || `tegaki_${timestamp}.png`;
                
                this.manager.downloadFile(blob, filename);
                
                window.TegakiEventBus?.emit('export:completed', { 
                    format: 'png', 
                    size: blob.size,
                    filename: filename
                });
                
                return { blob, filename, format: 'png' };
            } catch (error) {
                window.TegakiEventBus?.emit('export:failed', { 
                    format: 'png', 
                    error: error.message 
                });
                throw error;
            }
        }
        
        /**
         * PNG Blob生成（プレビュー用）
         */
        async generateBlob(options = {}) {
            const canvas = this.manager.renderToCanvas(options);
            
            return new Promise((resolve, reject) => {
                canvas.toBlob((blob) => {
                    if (!blob) {
                        reject(new Error('PNG generation failed'));
                        return;
                    }
                    resolve(blob);
                }, 'image/png');
            });
        }
    }
    
    return PNGExporter;
})();

console.log('✅ png-exporter.js (単一フレーム専用) loaded');