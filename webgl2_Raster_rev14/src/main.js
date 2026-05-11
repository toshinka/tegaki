/**
 * ファイル名: main.js
 * 責務: エントリーポイント、モジュール統合
 * 依存: src/ 下の全モジュール
 */

console.log('--- main.js loading ---');

// Styles
import './styles/main.css';

// Config & Base
import './config.js';
import './coordinate-system.js';

// Event System
import './system/event-bus.js';

// Data Models
import './system/data-models.js';
import './system/batch-api.js';

// Debug
import './system/debug-utils.js';

// System
import './system/popup-manager.js';
import './system/state-manager.js';
import './system/settings-manager.js';
import './system/camera-system.js';
import './system/layer-transform.js';
import './system/checker-utils.js';
import './system/layer-system.js';
import './system/drawing-clipboard.js';
import './system/history.js';
import './system/virtual-album.js';
import './system/animation-system.js';

// Raster Drawing System
import './system/drawing/shader-inline.js';
import './system/drawing/raster/brush-stamp.js';
import './system/drawing/raster/brush-interpolator.js';
import './system/drawing/raster/raster-layer.js';
import './system/drawing/raster/raster-brush-core.js';

// WebGL2 Integration
import './system/drawing/webgl2/gl-texture-bridge.js';
import './system/drawing/webgl2/webgl2-drawing-layer.js';

// Drawing System - Base
import './system/drawing/pointer-handler.js';
import './system/drawing/pressure-handler.js';
import './system/drawing/stroke-recorder.js';

// Drawing System - Integration
import './system/drawing/thumbnail-system.js';
import './system/drawing/brush-settings.js';
import './system/drawing/stroke-transformer.js';
import './system/drawing/blend-modes.js';
import './system/processing/vector-operations.js';
import './system/drawing/brush-core.js';
import './system/drawing/fill-tool.js';
import './system/drawing/drawing-engine.js';

// Export System
import './system/quick-export-ui.js';
import './system/export-manager.js';
import './system/exporters/png-exporter.js';
import './system/exporters/webp-exporter.js';
import './system/exporters/psd-exporter.js';
import './system/exporters/apng-exporter.js';
import './system/exporters/webm-exporter.js';
import './system/exporters/mp4-exporter.js';

// UI
import './ui/dom-builder.js';
import './ui/slider-utils.js';
import './ui/keyboard-handler.js';
import './ui/resize-popup.js';
import './ui/layer-panel-renderer.js';
import './ui/status-display-renderer.js';
import './ui/timeline-thumbnail-utils.js';
import './ui/timeline-ui.js';
import './ui/album-popup.js';
import './ui/settings-popup.js';
import './ui/quick-access-popup.js';
import './ui/export-popup.js';
import './ui/ui-panels.js';

// Core
import './core-runtime.js';
import './core-engine.js';
import './core-initializer.js';

console.log('--- main.js loaded, waiting for DOMContentLoaded ---');

// Boot
// ESMモジュールは常にdeferされるため、多くの場合DOMContentLoadedは既に発火しているか、直後に発火します
const init = async () => {
    try {
        console.log('🚀 ラスター版 v3.0 (ESM) 起動プロセス開始');
        
        // 依存関係がwindowにセットされるのを極わずかに待つ（CDNスクリプト対策）
        if (!window.PIXI) {
            console.log('⏳ PIXIの読み込みを待機中...');
            let retries = 0;
            while (!window.PIXI && retries < 50) {
                await new Promise(r => setTimeout(r, 100));
                retries++;
            }
        }

        if (window.CoreInitializer) {
            await window.CoreInitializer.initialize();
            console.log('✅ ラスター版初期化完了');

            if (window.pixiApp && window.pixiApp.ticker) {
                if (!window.pixiApp.ticker.started) {
                    console.warn('⚠️ Pixi Ticker is STOPPED - forcing start');
                    window.pixiApp.ticker.start();
                }
            }
        } else {
            console.error('❌ CoreInitializerが見つかりません');
        }

    } catch (error) {
        console.error('❌ 初期化失敗:', error);
        // エラー詳細を画面に出す（デバッグ用）
        const debugDiv = document.createElement('div');
        debugDiv.style.color = 'red';
        debugDiv.style.padding = '20px';
        debugDiv.style.background = 'white';
        debugDiv.style.position = 'fixed';
        debugDiv.style.top = '0';
        debugDiv.style.zIndex = '10000';
        debugDiv.innerHTML = `<h3>初期化エラー</h3><pre>${error.stack}</pre>`;
        document.body.appendChild(debugDiv);
    }
};

if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
