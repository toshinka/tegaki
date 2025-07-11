// src/core/rendering/rendering-bridge.js
import { WebGLEngine } from './webgl-engine.js';

export class RenderingBridge {
    constructor(canvas) {
        this.canvas = canvas;
        this.gl = null;
        this.currentEngine = null; // currentEngineを初期化
        this.isInitialized = false; // 初期化フラグを追加

        console.log("🔍 RenderingBridge: canvas要素は", canvas);

        // requestAnimationFrame を使い、DOM描画後にWebGL初期化を試みる
        requestAnimationFrame(() => {
            // "webgl2" を優先し、だめなら "webgl" にフォールバック
            this.gl = this.canvas.getContext("webgl2") || this.canvas.getContext("webgl");

            console.log("🔍 RenderingBridge: getContext(webgl/webgl2) 結果", this.gl);

            if (!this.gl) {
                console.error("❌ RenderingBridge: WebGLがサポートされていない、またはコンテキストの取得に失敗しました。");
                alert("お使いのブラウザはWebGLをサポートしていないか、有効になっていません。");
                // isInitialized は false のままなので、タイムアウト処理は CanvasManager 側に任せる
                return;
            }

            console.log("✅ RenderingBridge: WebGLコンテキスト取得成功");

            // --- ⬇️ ここから修正 ⬇️ ---

            // WebGLEngine をインスタンス化し、currentEngine にセット
            this.currentEngine = new WebGLEngine(this.gl, this.canvas);
            console.log("✅ RenderingBridge: WebGLEngine のインスタンス化成功");

            // WebGLの初期化処理（背景色のクリアなど）を呼び出す
            this.initializeGL();

            // 初期化完了フラグを立てる
            this.isInitialized = true;
            console.log("✅ RenderingBridge: 初期化完了フラグを true に設定しました。");

            // --- ⬆️ ここまで修正 ⬆️ ---
        });
    }

    /**
     * WebGLの背景色をクリアする初期化処理
     */
    initializeGL() {
        if (!this.gl) return;
        // 背景色をグレーに設定してクリアする
        this.gl.clearColor(0.9, 0.9, 0.9, 1.0);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT);
        console.log("✅ RenderingBridge: WebGLの背景をクリアしました。");
    }

    /**
     * CanvasManager側で初期化完了を待つためのメソッド
     * @returns {Promise<void>} 初期化が完了したら解決されるPromise
     */
    async waitForInitialization() {
        if (this.isInitialized) {
            return;
        }

        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            const timeout = 5000; // 5秒でタイムアウト

            const check = () => {
                if (this.isInitialized && this.currentEngine) {
                    console.log("✅ RenderingBridge: 初期化完了を検出しました。(waitForInitialization)");
                    resolve();
                } else if (Date.now() - startTime > timeout) {
                    reject(new Error("RenderingBridge初期化タイムアウト"));
                } else {
                    setTimeout(check, 50); // 50msごとに再チェック
                }
            };

            check();
        });
    }


    // --- ⬇️ 以降の描画処理メソッド ⬇️ ---
    // これで currentEngine に処理が渡るようになります

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