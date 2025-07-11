// src/core/rendering/rendering-bridge.js
import { WebGLEngine } from './webgl-engine.js';

export class RenderingBridge {
    constructor(canvas, preferredEngine = 'webgl') {
        this.canvas = canvas;
        this.currentEngine = null;

        // --- ⬇️ ここから修正 ⬇️ ---

        // 指示書[cite: 10]に基づき、デバッグログを追加
        console.log("🔍 RenderingBridge: canvas要素は", canvas);

        // WebGLコンテキストをまず"webgl2"で試し、だめなら"webgl"で試すフォールバック処理 
        const gl = canvas.getContext("webgl2", { premultipliedAlpha: false }) || canvas.getContext("webgl", { premultipliedAlpha: false });

        // getContextの結果をログに出力 [cite: 10]
        console.log("🔍 RenderingBridge: getContext(webgl/webgl2) 結果", gl);

        if (preferredEngine === 'webgl' && gl) {
            console.log("✅ RenderingBridge: WebGLコンテキストの取得に成功しました。");
            try {
                this.currentEngine = new WebGLEngine(this.canvas);
                console.log("✅ RenderingBridge: WebGL Engine を使用します。");
            } catch (e) {
                console.error("❌ RenderingBridge: WebGLEngineのインスタンス化中にエラーが発生しました。", e);
                alert("WebGLエンジンの初期化中にエラーが発生しました。");
            }
        } else {
            // エラーメッセージをより具体的に変更
            console.error("❌ RenderingBridge: WebGLがサポートされていない、またはコンテキストの取得に失敗したため、初期化に失敗しました。");
            alert("お使いのブラウザはWebGLをサポートしていないか、有効になっていません。");
        }
        // --- ⬆️ ここまで修正 ⬆️ ---
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