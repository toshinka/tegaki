/*
 * ===================================================================================
 * Toshinka Tegaki Tool - WebGL Engine (Skeleton)
 * Version: 0.1.0 (Phase 4A-1)
 *
 * WebGLによる描画を行うエンジン。
 * このステップでは、WebGLの初期化と画面クリア機能のみを実装する「骨格」です。
 * ===================================================================================
 */
import { DrawingEngine } from './drawing-engine.js';

export class WebGLEngine extends DrawingEngine {
    constructor(canvas) {
        super(canvas);
        this.gl = null;
        this.width = canvas.width;
        this.height = canvas.height;

        try {
            // WebGLコンテキストを取得
            this.gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
            if (!this.gl) {
                throw new Error('WebGL is not supported in this browser.');
            }
            // this.ctxはDrawingEngineの定義に合わせてnullのままにしておくか、this.glを代入します。
            // ここではthis.glを主に使うため、this.ctxは未使用です。
            this.ctx = this.gl;

            this._initialize();
        } catch (error) {
            console.error("Failed to initialize WebGL Engine:", error);
            // エラーが発生した場合、このエンジンは機能しないようにする
            this.gl = null;
        }
    }

    /**
     * WebGLの初期設定
     * @private
     */
    _initialize() {
        if (!this.gl) return;
        const gl = this.gl;
        // ビューポートをキャンバスサイズに設定
        gl.viewport(0, 0, this.width, this.height);
        // 背景色（クリアカラー）を設定 (デバッグ用に暗い色にしておきます)
        gl.clearColor(0.1, 0.1, 0.15, 1.0);
    }

    // --- DrawingEngineインターフェースの実装 ---
    // Phase 4A-1では、ほとんどのメソッドは未実装（空）にしておきます。

    drawCircle(imageData, centerX, centerY, radius, color, isEraser) {
        // (未実装)
    }

    drawLine(imageData, x0, y0, x1, y1, size, color, isEraser, p0, p1, calculatePressureSize) {
        // (未実装)
    }

    fill(imageData, color) {
        // (未実装)
    }

    clear(imageData) {
        // WebGLではimageDataを直接クリアするのではなく、フレームバッファをクリアする
        if (!this.gl) return;
        this.gl.clear(this.gl.COLOR_BUFFER_BIT);
    }
    
    getTransformedImageData(sourceImageData, transform) {
        // (未実装)
        // WebGLではシェーダーで変形を行うため、このメソッドは異なるアプローチになる可能性があります。
        return sourceImageData; // とりあえず元のデータを返す
    }

    compositeLayers(layers, compositionData, dirtyRect) {
        // (未実装)
        // Phase 4A-1では、レイヤー合成の代わりに単純な画面クリア処理をここに記述します。
        // compositionDataはWebGLでは使用しません。
        if (!this.gl) return;
        this.gl.clear(this.gl.COLOR_BUFFER_BIT);
    }

    renderToDisplay(compositionData, dirtyRect) {
        // WebGLでは、描画命令は即座に実行されるかキューに入るため、
        // このメソッドは、すべての描画が終わったことを保証する役割になります。
        // compositionData, dirtyRectはWebGLでは使用しません。
        if (!this.gl) return;
        this.gl.flush(); // コマンドキューをGPUに送信
    }
}