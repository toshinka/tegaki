// src/core/rendering/rendering-bridge.js
import { WebGLEngine } from './webgl-engine.js';

export class RenderingBridge {
    // --- ⬇️ ここから修正 ⬇️ ---

    constructor(canvas) {
        this.canvas = canvas;
        this.gl = null; // glをクラスプロパティとして初期化
        // this.currentEngine は一旦使わないのでコメントアウト or 削除
        // this.currentEngine = null; 

        console.log("🔍 RenderingBridge: canvas要素は", canvas);

        // requestAnimationFrame を使い、DOM描画後にWebGL初期化を試みる 
        requestAnimationFrame(() => {
            // "webgl2" を優先し、だめなら "webgl" にフォールバック
            this.gl = canvas.getContext("webgl2") || canvas.getContext("webgl");

            console.log("🔍 RenderingBridge: getContext(webgl/webgl2) 結果", this.gl);

            if (!this.gl) {
                console.error("❌ RenderingBridge: WebGLがサポートされていない、またはコンテキストの取得に失敗しました。");
                alert("お使いのブラウザはWebGLをサポートしていないか、有効になっていません。");
                return;
            }

            console.log("✅ RenderingBridge: WebGL初期化成功");

            // WebGLの初期化処理（背景色のクリアなど）を呼び出す 
            this.initializeGL();

            // TODO: ここで本来の WebGLEngine を new する処理に戻す必要がある
            // this.currentEngine = new WebGLEngine(this.canvas);
        });
    }

    // 新しく追加するメソッド [cite: 3]
    initializeGL() {
        // 背景色をグレーに設定してクリアする 
        this.gl.clearColor(0.9, 0.9, 0.9, 1.0);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT);
    }

    // --- ⬆️ ここまで修正 ⬆️ ---

    // 以降のメソッドは、今後 WebGLEngine を再接続するまで動作しません
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