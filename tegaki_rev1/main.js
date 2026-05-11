/**
 * ============================================================================
 * ファイル名: main.js
 * 責務: アプリケーションのエントリーポイント
 * 依存: 各種システムモジュール
 * ============================================================================
 */

import * as PIXI from 'pixi.js';
import { TEGAKI_CONFIG } from './config.js';
import { coordinateSystem } from './coordinate-system.js';
import { EventBus } from './system/event-bus.js';
import { FreehandStroke } from './system/drawing/freehand-stroke.js';
import { brushCore } from './system/drawing/brush-core.js';
import { DrawingEngine } from './system/drawing/drawing-engine.js';
import { StrokeRecorder } from './system/drawing/stroke-recorder.js';

// Legacy side-effect imports (これらのファイルはまだESM化していないが、
// Viteが適切に処理してwindowに登録してくれることを期待する)
// もしくは順次ESM化していく
import './system/data-models.js';
import './system/batch-api.js';
import './system/debug-utils.js';
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

// WebGL2 Base
import './system/drawing/webgl2/gl-texture-bridge.js';
import './system/drawing/webgl2/gl-msdf-pipeline.js';
import './system/drawing/webgl2/gl-stroke-processor.js';
import './system/drawing/webgl2/webgl2-drawing-layer.js';
import './system/drawing/webgl2/gl-mask-layer.js';

// Earcut Triangulator
import './system/drawing/earcut-triangulator.js';

// Drawing System
import './system/drawing/pointer-handler.js';
import './system/drawing/pressure-handler.js';
import './system/drawing/stroke-renderer.js';
import './system/drawing/thumbnail-system.js';
import './system/drawing/brush-settings.js';
import './system/drawing/stroke-transformer.js';
import './system/drawing/blend-modes.js';
import './system/processing/vector-operations.js';
import './system/drawing/fill-tool.js';

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

import './core-runtime.js';
import './core-engine.js';
import './core-initializer.js';

async function init() {
    console.log('🚀 Tegaki Tool starting...');
    
    // 既存のグローバル変数を維持しつつ ESM 化を進める
    window.PIXI = PIXI;
    window.TEGAKI_CONFIG = TEGAKI_CONFIG;
    window.CoordinateSystem = coordinateSystem;
    window.BrushCore = brushCore;
    window.DrawingEngine = DrawingEngine;
    window.StrokeRecorder = StrokeRecorder;
    
    // 初期化処理
    try {
        // 暫定的に既存の CoreInitializer を使う
        if (window.CoreInitializer) {
            await window.CoreInitializer.initialize();
        }

        // 全システムの初期化が終わった後に BrushCore を初期化
        brushCore.init();
        
    } catch (error) {
        console.error('❌ Initialization failed:', error);
    }
}

init();
