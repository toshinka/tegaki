/**
 * ================================================================================
 * system/exporters/png-exporter.js - DPR=1統一版【v8.14.0】
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
 *   - 等倍出力の保証
 *   - Blob生成（プレビュー/ダウンロード兼用）
 * 
 * 【v8.14.0 改修内容 - DPR=1統一】
 *   🚨 resolution パラメータを完全削除
 *   🚨 常に等倍（1x）で出力
 *   ✅ 描画時と出力時の一貫性確保
 *   ✅ ユーザーの期待値と出力の完全一致
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
         * PNG Blob生成 - DPR=1統一版
         * 
         * 🚨 v8.14.0 重要変更:
         *   - resolution パラメータを完全無視
         *   - 常に等倍（1x）で出力
         *   - options.resolution は互換性のため受け入れるが使用しない
         * 
         * 設計思想:
         *   - 画面表示 = 出力品質の一貫性
         *   - 意図しない高解像度化の防止
         *   - ベクターのジャギー対策は antialias で対応済み
         */
        async generateBlob(options = {}) {
            const CONFIG = window.TEGAKI_CONFIG;
            
            // 🚨 resolution は常に使用しない（互換性のため引数は受け入れる）
            const settings = {
                width: options.width || CONFIG.canvas.width,
                height: options.height || CONFIG.canvas.height
                // resolution は渡さない（export-manager側で1固定）
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

console.log('✅ png-exporter.js v8.14.0 loaded (DPR=1統一)');
console.log('   🚨 resolution パラメータ無視');
console.log('   ✓ 常に等倍（1x）出力');