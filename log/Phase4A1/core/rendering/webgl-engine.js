/*
 * ===================================================================================
 * Toshinka Tegaki Tool - WebGL Engine (Skeleton)
 * Version: 0.1.0 (Phase 4A-1)
 *
 * WebGL描画エンジンの「骨格」です。
 * この段階では、画面を特定の色でクリアする最低限の機能のみを実装します。
 * ===================================================================================
 */
import { DrawingEngine } from './drawing-engine.js';

export class WebGLEngine extends DrawingEngine {
    constructor(canvas) {
        super(canvas);
        this.gl = null; // まずはnullで初期化

        try {
            // WebGLコンテキストを取得
            this.gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
            if (!this.gl) {
                throw new Error('WebGL is not supported in this browser.');
            }
        } catch (e) {
            console.error("WebGL Engine initialization failed:", e);
            // glがnullのままなので、このエンジンは利用不可状態になります
            return;
        }

        // 成功した場合、クリア用の色を設定
        this.gl.clearColor(0.1, 0.1, 0.1, 1.0); // 動作確認用のダークグレー
    }

    /**
     * WebGLが利用可能か事前にチェックするための静的メソッド
     * @returns {boolean}
     */
    static isSupported() {
        try {
            const canvas = document.createElement('canvas');
            return !!(window.WebGLRenderingContext && (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
        } catch (e) {
            return false;
        }
    }

    // --- DrawingEngineのインターフェース実装 ---

    /**
     * WebGLコンテキストを使ってキャンバスを指定色でクリアします。
     * @param {ImageData} imageData - (このエンジンでは未使用ですが、互換性のために存在)
     */
    clear(imageData) {
        if (!this.gl) return;
        
        // WebGLのビューポートを設定し、クリア処理を実行
        this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT);

        // 互換性のため、渡されたimageDataもクリアします
        if (imageData) {
            imageData.data.fill(0);
        }
    }

    // ▼▼▼ 以下は未実装のメソッド群です ▼▼▼

    drawCircle(imageData, centerX, centerY, radius, color, isEraser) {
        // Phase 4A-2以降で実装
    }

    drawLine(imageData, x0, y0, x1, y1, size, color, isEraser, p0, p1, calculatePressureSize) {
        // Phase 4A-2以降で実装
    }

    fill(imageData, color) {
        // Phase 4A-2以降で実装
    }

    getTransformedImageData(sourceImageData, transform) {
        // Phase 4A-2以降で実装
        console.warn("WebGL getTransformedImageData is not implemented yet.");
        return sourceImageData; 
    }

    compositeLayers(layers, compositionData, dirtyRect) {
        // Phase 4A-3以降で実装
        // WebGLエンジンがアクティブなことを示すために、クリア処理を呼んでおく
        this.clear(compositionData);
    }

    renderToDisplay(compositionData, dirtyRect) {
        // Phase 4A-3以降で実装
        // WebGLは直接displayCanvasに描画するため、このメソッドはCanvas2Dとは役割が異なります。
        // この段階では何もしません。
    }
}