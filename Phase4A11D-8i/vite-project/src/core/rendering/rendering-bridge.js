// src/core/rendering/rendering-bridge.js
import WebGLEngine from './webgl-engine.js';

export class RenderingBridge {
    constructor(canvas) {
        this.canvas = canvas;
        this.gl = null;
        this.currentEngine = null;
        this.isInitialized = false;

        console.log("🔍 RenderingBridge: canvas要素は", canvas);

        requestAnimationFrame(() => {
            this.gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
            console.log("🔍 RenderingBridge: getContext(webgl/webgl2) 結果", this.gl);

            if (!this.gl) {
                console.error("❌ RenderingBridge: WebGLがサポートされていない、またはコンテキストの取得に失敗しました。");
                alert("お使いのブラウザはWebGLをサポートしていないか、有効になっていません。");
                return;
            }

            console.log("✅ RenderingBridge: WebGL初期化成功");

            this.initializeGL();

            // 【修正】WebGLEngine に取得済みの gl と canvas を渡す
            this.currentEngine = new WebGLEngine(this.gl, this.canvas);
            
            // エンジン初期化に失敗した場合のガード処理を追加
            if (!this.currentEngine.gl) {
                console.error("❌ RenderingBridge: WebGLEngine のインスタンス化に失敗しました。");
                return;
            }
            console.log("✅ RenderingBridge: WebGLEngine のインスタンス化成功");


            this.isInitialized = true;
            console.log("✅ RenderingBridge: 初期化完了フラグを true に設定しました。");
        });
    }

    initializeGL() {
        if (!this.gl) return;
        this.gl.clearColor(0.9, 0.9, 0.9, 1.0);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT);
        console.log("✅ RenderingBridge: WebGLの背景をクリアしました。");
    }

    async waitForInitialization() {
        if (this.isInitialized) return;

        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            const timeout = 5000;
            const check = () => {
                if (this.isInitialized && this.currentEngine) {
                    console.log("✅ RenderingBridge: 初期化完了を検出しました。(waitForInitialization)");
                    resolve();
                } else if (Date.now() - startTime > timeout) {
                    reject(new Error("RenderingBridge初期化タイムアウト"));
                } else {
                    setTimeout(check, 50);
                }
            };
            check();
        });
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