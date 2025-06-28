/*
 * ===================================================================================
 * Toshinka Tegaki Tool - Drawing Engine Interface
 *
 * このファイルは、すべての描画エンジン（Canvas2D, WebGLなど）が
 * 共通して持つべき機能（API）を定義する、いわば「設計図」や「インターフェース」です。
 * core-engine.jsは、この設計図に書かれた命令だけを使います。
 * ===================================================================================
 */
export class DrawingEngine {
    constructor(canvas) {
        if (this.constructor === DrawingEngine) {
            throw new Error("DrawingEngine is an abstract class and cannot be instantiated directly.");
        }
        this.canvas = canvas;
        this.ctx = null; // 各エンジンで初期化
    }

    // imageDataに直接描画するメソッド群
    drawCircle(imageData, centerX, centerY, radius, color, isEraser) { throw new Error("Method 'drawCircle()' must be implemented."); }
    drawLine(imageData, x0, y0, x1, y1, size, color, isEraser, p0, p1) { throw new Error("Method 'drawLine()' must be implemented."); }
    fill(imageData, color) { throw new Error("Method 'fill()' must be implemented."); }
    clear(imageData) { throw new Error("Method 'clear()' must be implemented."); }
    getTransformedImageData(sourceImageData, transform) { throw new Error("Method 'getTransformedImageData()' must be implemented."); }

    // レイヤー群を合成するメソッド
    compositeLayers(layers, compositionData, dirtyRect) { throw new Error("Method 'compositeLayers()' must be implemented."); }

    // 合成結果をディスプレイに表示するメソッド
    renderToDisplay(compositionData, dirtyRect) { throw new Error("Method 'renderToDisplay()' must be implemented."); }
}