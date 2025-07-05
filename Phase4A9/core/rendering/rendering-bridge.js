/*
 * ===================================================================================
 * Toshinka Tegaki Tool - Rendering Bridge
 * Version: 4.0.4 (Consolidated)
 *
 * - 変更なし
 * - 他のファイルとのバージョン整合性のため更新
 * ===================================================================================
 */

import { WebGLEngine } from './webgl-engine.js';

export class RenderingBridge {
    constructor(canvas) {
        this.canvas = canvas;
        this.width = canvas.width;
        this.height = canvas.height;
        this.engines = {};
        this.currentEngineType = 'webgl';

        this.initEngines();
    }

    initEngines() {
        if (WebGLEngine.isSupported()) {
            this.engines['webgl'] = new WebGLEngine(this.canvas);
            console.log("Rendering Bridge: WebGL engine initialized.");
        } else {
            // 将来的に2D Canvasフォールバックを実装する場合
            // this.engines['canvas2d'] = new Canvas2DEngine(this.canvas);
            // this.currentEngineType = 'canvas2d';
            console.error("Rendering Bridge: WebGL not supported, and no fallback engine is available.");
        }
    }

    get activeEngine() {
        return this.engines[this.currentEngineType];
    }

    drawCircle(centerX, centerY, radius, color, isEraser, layer) {
        this.activeEngine?.drawCircle(centerX, centerY, radius, color, isEraser, layer);
    }
    
    drawLine(x0, y0, x1, y1, size, color, isEraser, p0, p1, calculatePressureSize, layer) {
        this.activeEngine?.drawLine(x0, y0, x1, y1, size, color, isEraser, p0, p1, calculatePressureSize, layer);
    }
    
    compositeLayers(layers, compositionData, dirtyRect) {
        this.activeEngine?.compositeLayers(layers, compositionData, dirtyRect);
    }
    
    renderToDisplay(compositionData, dirtyRect) {
        this.activeEngine?.renderToDisplay(compositionData, dirtyRect);
    }

    syncDirtyRectToImageData(layer, dirtyRect) {
        this.activeEngine?.syncDirtyRectToImageData(layer, dirtyRect);
    }
}