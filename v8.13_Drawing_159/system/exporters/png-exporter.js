/**
 * ================================================================================
 * system/exporters/png-exporter.js - 高DPI対応PNG出力【Phase 1完成】
 * ================================================================================
 * 
 * 【依存関係 - Parents】
 *   - export-manager.js (renderToCanvas呼び出し)
 *   - event-bus.js (イベント発行)
 * 
 * 【依存関係 - Children】
 *   なし
 * 
 * 【責務】
 *   - PNG静止画エクスポート（単一フレーム）
 *   - 高DPI描画と出力の整合性確保
 *   - Blob生成（プレビュー/ダウンロード兼用）
 * 
 * 【改修内容】
 *   ✅ devicePixelRatio を出力時に適用
 *   ✅ resolution='auto' で画面と同等の高精細出力
 *   ✅ 明示的resolution指定も可能
 *   ✅ 描画体験と出力の一貫性確保
 * ================================================================================
 */

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
         * 
         * 🔧 高DPI対応:
         *   options.resolution = 'auto' → devicePixelRatio を使用
         *   options.resolution = number → 明示的に指定
         *   デフォルト: 2x（高品質出力）
         */
        async generateBlob(options = {}) {
            const CONFIG = window.TEGAKI_CONFIG;
            
            // 解像度の決定
            let resolution;
            if (options.resolution === 'auto') {
                // 画面と同等のDPIで出力
                resolution = window.devicePixelRatio || 1;
            } else if (typeof options.resolution === 'number') {
                // 明示的指定
                resolution = options.resolution;
            } else {
                // デフォルト: 高品質2x
                resolution = 2;
            }
            
            const settings = {
                width: options.width || CONFIG.canvas.width,
                height: options.height || CONFIG.canvas.height,
                resolution: resolution
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

console.log('✅ png-exporter.js (高DPI対応版) loaded');
console.log('   ✓ resolution="auto" で画面DPI適用');
console.log('   ✓ 描画体験と出力の整合性確保');