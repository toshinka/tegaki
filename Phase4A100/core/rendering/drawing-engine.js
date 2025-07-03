/*
 * ===================================================================================
 * Toshinka Tegaki Tool - Drawing Engine Interface
 * Version 1.3.0 (Non-Destructive Transform Refactor)
 *
 * - 修正：
 * - GPUによる非破壊変形の実装に伴い、CPUベースの変形メソッド
 * - `getTransformedImageData`をインターフェースから削除。
 * - 変形は各エンジンがシェーダーと行列を用いて行う責務を負う。
 * ===================================================================================
 */
export class DrawingEngine {
    constructor(canvas) {
        if (this.constructor === DrawingEngine) {
            throw new Error("DrawingEngine is an abstract class and cannot be instantiated directly.");
        }
        this.canvas = canvas;
        this.ctx = null;
    }

    drawCircle(centerX, centerY, radius, color, isEraser, layer) { throw new Error("Method 'drawCircle()' must be implemented."); }
    drawLine(x0, y0, x1, y1, size, color, isEraser, p0, p1, calculatePressureSize, layer) { throw new Error("Method 'drawLine()' must be implemented."); }
    
    fill(imageData, color) { throw new Error("Method 'fill()' must be implemented."); }
    clear(imageData) { throw new Error("Method 'clear()' must be implemented."); }
    compositeLayers(layers, compositionData, dirtyRect) { throw new Error("Method 'compositeLayers()' must be implemented."); }
    renderToDisplay(compositionData, dirtyRect) { throw new Error("Method 'renderToDisplay()' must be implemented."); }
}