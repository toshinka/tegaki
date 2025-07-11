// src/core/drawing-engine.js

/**
 * 描画エンジンのための抽象基底クラス。
 * 各描画エンジン（WebGL, Canvas2Dなど）は、このクラスを継承して実装されます。
 */
export class DrawingEngine {
    constructor(canvas) {
        if (this.constructor === DrawingEngine) {
            throw new Error("Abstract class 'DrawingEngine' cannot be instantiated directly.");
        }
        this.canvas = canvas;
    }

    // --- 描画系メソッド ---

    /**
     * 指定されたレイヤーに円を描画します。
     * @abstract
     */
    drawCircle(centerX, centerY, radius, color, isEraser, layer) {
        throw new Error("Method 'drawCircle()' must be implemented.");
    }

    /**
     * 指定されたレイヤーに線を描画します。
     * @abstract
     */
    drawLine(x0, y0, x1, y1, size, color, isEraser, p0, p1, calculatePressureSize, layer) {
        throw new Error("Method 'drawLine()' must be implemented.");
    }
    
    /**
     * 指定されたレイヤーを特定の色で塗りつぶします。
     * @abstract
     */
    fill(layer, color) {
        throw new Error("Method 'fill()' must be implemented.");
    }
    
    /**
     * 指定されたレイヤーの内容を消去します。
     * @abstract
     */
    clear(layer) {
        throw new Error("Method 'clear()' must be implemented.");
    }

    // --- 合成と表示 ---
    
    /**
     * 変形を適用したレイヤーのImageDataを取得します。
     * @abstract
     */
    getTransformedImageData(layer) {
        throw new Error("Method 'getTransformedImageData()' must be implemented.");
    }

    /**
     * 複数のレイヤーを合成します。
     * @abstract
     */
    compositeLayers(layers, compositionData, dirtyRect) {
        throw new Error("Method 'compositeLayers()' must be implemented.");
    }

    /**
     * 合成結果を画面に表示します。
     * @abstract
     */
    renderToDisplay(compositionData, dirtyRect) {
        throw new Error("Method 'renderToDisplay()' must be implemented.");
    }
    
    // --- データ同期 ---

    /**
     * GPU上のダーティ矩形領域をCPU側のImageDataに同期します。
     * @abstract
     */
    syncDirtyRectToImageData(layer, dirtyRect) {
         throw new Error("Method 'syncDirtyRectToImageData()' must be implemented.");
    }

    /**
     * エンジンが現在の環境でサポートされているかを確認します。
     * @returns {boolean}
     * @static
     */
    static isSupported() {
        return false;
    }
}