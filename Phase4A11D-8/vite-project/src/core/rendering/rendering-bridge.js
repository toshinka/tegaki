// src/core/rendering/rendering-bridge.js
import { WebGLEngine } from './webgl-engine.js';

export class RenderingBridge {
    constructor(canvas, preferredEngine = 'webgl') {
        this.canvas = canvas;
        this.currentEngine = null;

        if (preferredEngine === 'webgl' && WebGLEngine.isSupported()) {
            this.currentEngine = new WebGLEngine(this.canvas);
            console.log("✅ RenderingBridge: WebGL Engine を使用します。");
        } else {
            // WebGLが使えない場合のフォールバックは現在未サポート
            console.error("❌ RenderingBridge: WebGLがサポートされていないため、初期化に失敗しました。");
            alert("お使いのブラウザはWebGLをサポートしていません。");
        }
    }

    drawCircle(centerX, centerY, radius, color, isEraser, layer) {
        this.currentEngine?.drawCircle(centerX, centerY, radius, color, isEraser, layer);
    }

    drawLine(x0, y0, x1, y1, size, color, isEraser, p0, p1, calculatePressureSize, layer) {
        this.currentEngine?.drawLine(x0, y0, x1, y1, size, color, isEraser, p0, p1, calculatePressureSize, layer);
    }

    fill(layer, color) {
        this.currentEngine?.fill(layer, color);
    }

    clear(layer) {
        this.currentEngine?.clear(layer);
    }
    
    getTransformedImageData(layer) {
        return this.currentEngine?.getTransformedImageData(layer);
    }

    compositeLayers(layers, compositionData, dirtyRect) {
        this.currentEngine?.compositeLayers(layers, compositionData, dirtyRect);
    }
    
    renderToDisplay(compositionData, dirtyRect) {
        this.currentEngine?.renderToDisplay(compositionData, dirtyRect);
    }

    syncDirtyRectToImageData(layer, dirtyRect) {
        this.currentEngine?.syncDirtyRectToImageData(layer, dirtyRect);
    }
}