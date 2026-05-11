// ==================================================
// system/exporters/png-exporter.js
// PNG静止画エクスポーター - 単一フレーム専用（プレビュー対応）
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
         * PNG出力実行（ダウンロード）
         */
        async export(options) {
            if (!this.manager || !this.manager.layerSystem) {
                throw new Error('LayerSystem not available');
            }
            
            if (window.TegakiEventBus) {
                window.TegakiEventBus.emit('export:started', { format: 'png' });
            }
            
            try {
                const blob = await this.generateBlob(options);
                
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
                const filename = options.filename || ('tegaki_' + timestamp + '.png');
                
                this.manager.downloadFile(blob, filename);
                
                if (window.TegakiEventBus) {
                    window.TegakiEventBus.emit('export:completed', { 
                        format: 'png', 
                        size: blob.size,
                        filename: filename
                    });
                }
                
                return { blob: blob, filename: filename, format: 'png' };
            } catch (error) {
                if (window.TegakiEventBus) {
                    window.TegakiEventBus.emit('export:failed', { 
                        format: 'png', 
                        error: error.message 
                    });
                }
                throw error;
            }
        }
        
        /**
         * PNG Blob生成（プレビュー/ダウンロード兼用）
         */
        async generateBlob(options = {}) {
            const CONFIG = window.TEGAKI_CONFIG;
            
            const settings = {
                width: options.width || CONFIG.canvas.width,
                height: options.height || CONFIG.canvas.height,
                resolution: options.resolution || 2
            };
            
            const canvas = this.manager.renderToCanvas(settings);
            
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

console.log('✅ png-exporter.js (単一フレーム専用・プレビュー対応) loaded');