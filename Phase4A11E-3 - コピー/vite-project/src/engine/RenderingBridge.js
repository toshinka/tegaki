// [モジュール責務] RenderingBridge.js
// 目的：高レベルのアプリケーションロジック（CanvasInteraction）と、低レベルの描画実装（WebGLRenderer）を分離するための「橋渡し役」。
// CanvasInteractionからの描画命令を受け取り、それを現在の描画エンジン（currentEngine）にそのまま転送する。
// これにより、将来的に描画エンジンをWebGLから別のものに切り替えても、CanvasInteraction側のコードを修正する必要がなくなる。

import WebGLRenderer from './WebGLRenderer.js';

export class RenderingBridge {
    /**
     * [関数責務] constructor: RenderingBridgeを初期化し、WebGLコンテキストの取得と描画エンジンのインスタンス化を試みる。
     * @param {HTMLCanvasElement} canvas - 描画対象のcanvas要素
     */
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

            // WebGLRenderer に取得済みの gl と canvas を渡す
            this.currentEngine = new WebGLRenderer(this.gl, this.canvas);
            
            // エンジン初期化に失敗した場合のガード処理を追加
            if (!this.currentEngine.gl) {
                console.error("❌ RenderingBridge: WebGLRenderer のインスタンス化に失敗しました。");
                return;
            }
            console.log("✅ RenderingBridge: WebGLRenderer のインスタンス化成功");


            this.isInitialized = true;
            console.log("✅ RenderingBridge: 初期化完了フラグを true に設定しました。");
        });
    }

    /**
     * [関数責務] initializeGL: WebGLコンテキストの初期設定（背景色クリアなど）を行う。
     */
    initializeGL() {
        if (!this.gl) return;
        this.gl.clearColor(0.9, 0.9, 0.9, 1.0);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT);
        console.log("✅ RenderingBridge: WebGLの背景をクリアしました。");
    }

    /**
     * [関数責務] waitForInitialization: 非同期で行われる初期化処理が完了するまで待機する。
     * @returns {Promise<void>} 初期化が完了したら解決されるPromise
     */
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

    /**
     * [関数責務] drawCircle: 円の描画命令を現在の描画エンジンに転送する。
     * @param {number} centerX - 中心のX座標
     * @param {number} centerY - 中心のY座標
     * @param {number} radius - 半径
     * @param {object} color - 色 (RGBAオブジェクト)
     * @param {boolean} isEraser - 消しゴムモードか
     * @param {object} layer - 対象レイヤー
     */
    drawCircle(centerX, centerY, radius, color, isEraser, layer) {
        // ✅ 描画経路の可視化
        console.log("➡️ RenderingBridge.drawCircle: 呼び出されました。");
        this.currentEngine?.drawCircle(centerX, centerY, radius, color, isEraser, layer);
    }

    /**
     * [関数責務] drawLine: 線の描画命令を現在の描画エンジンに転送する。
     * @param {number} x0 - 開始点のX座標
     * @param {number} y0 - 開始点のY座標
     * @param {number} x1 - 終了点のX座標
     * @param {number} y1 - 終了点のY座標
     * @param {number} size - ブラシサイズ
     * @param {object} color - 色 (RGBAオブジェクト)
     * @param {boolean} isEraser - 消しゴムモードか
     * @param {number} p0 - 開始点の筆圧
     * @param {number} p1 - 終了点の筆圧
     * @param {function} calculatePressureSize - 筆圧計算関数
     * @param {object} layer - 対象レイヤー
     */
    drawLine(x0, y0, x1, y1, size, color, isEraser, p0, p1, calculatePressureSize, layer) {
        // ✅ 描画経路の可視化
        console.log("➡️ RenderingBridge.drawLine: 呼び出されました。");
        this.currentEngine?.drawLine(x0, y0, x1, y1, size, color, isEraser, p0, p1, calculatePressureSize, layer);
    }

    /**
     * [関数責務] fill: 塗りつぶし命令を現在の描画エンジンに転送する。
     * @param {object} layer - 対象レイヤー
     * @param {object} color - 色 (RGBAオブジェクト)
     */
    fill(layer, color) {
        this.currentEngine?.fill(layer, color);
    }

    /**
     * [関数責務] clear: レイヤー消去命令を現在の描画エンジンに転送する。
     * @param {object} layer - 対象レイヤー
     */
    clear(layer) {
        this.currentEngine?.clear(layer);
    }

    /**
     * [関数責務] getTransformedImageData: 変形後画像データの取得命令を現在の描画エンジンに転送する。
     * @param {object} layer - 対象レイヤー
     * @returns {ImageData | null} 描画エンジンから返された変形後の画像データ
     */
    getTransformedImageData(layer) {
        return this.currentEngine?.getTransformedImageData(layer);
    }

    /**
     * [関数責務] compositeLayers: レイヤー合成命令を現在の描画エンジンに転送する。
     * @param {Array<object>} layers - 全レイヤーの配列
     * @param {object} compositionData - 合成に関する追加データ
     * @param {object} dirtyRect - 再描画が必要な領域
     */
    compositeLayers(layers, compositionData, dirtyRect) {
        // ✅ 指示書: ログを挿入
        console.log("➡️ RenderingBridge.compositeLayers: 呼び出し");
        this.currentEngine?.compositeLayers(layers, compositionData, dirtyRect);
    }

    /**
     * [関数責務] renderToDisplay: 最終表示命令を現在の描画エンジンに転送する。
     * @param {object} compositionData - 表示に関する追加データ
     * @param {object} dirtyRect - 再描画が必要な領域
     */
    renderToDisplay(compositionData, dirtyRect) {
        this.currentEngine?.renderToDisplay(compositionData, dirtyRect);
    }

    /**
     * [関数責務] syncDirtyRectToImageData: GPUからCPUへのデータ同期命令を現在の描画エンジンに転送する。
     * @param {object} layer - 対象レイヤー
     * @param {object} dirtyRect - 同期が必要な領域
     */
    syncDirtyRectToImageData(layer, dirtyRect) {
        this.currentEngine?.syncDirtyRectToImageData(layer, dirtyRect);
    }
}