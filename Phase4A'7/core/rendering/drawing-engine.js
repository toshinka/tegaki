/*
 * ===================================================================================
 * Toshinka Tegaki Tool - Drawing Engine Interface
 * Version 1.2.0 (GPU Drawing Prep)
 *
 * - 修正：
 * - GPUへの直接描画を前提としたインターフェースに変更。
 * - drawCircle, drawLineからimageData引数を削除。
 * - 各エンジンは、代わりに渡されるlayerオブジェクトから描画対象を判断する責務を負う。
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

    // ★★★ 修正: imageData引数を削除 ★★★
    drawCircle(centerX, centerY, radius, color, isEraser, layer) { throw new Error("Method 'drawCircle()' must be implemented."); }
    drawLine(x0, y0, x1, y1, size, color, isEraser, p0, p1, calculatePressureSize, layer) { throw new Error("Method 'drawLine()' must be implemented."); }
    
    // 以下は変更なし
    fill(imageData, color) { throw new Error("Method 'fill()' must be implemented."); }
    clear(imageData) { throw new Error("Method 'clear()' must be implemented."); }
    getTransformedImageData(sourceImageData, transform) { throw new Error("Method 'getTransformedImageData()' must be implemented."); }
    compositeLayers(layers, compositionData, dirtyRect) { throw new Error("Method 'compositeLayers()' must be implemented."); }
    renderToDisplay(compositionData, dirtyRect) { throw new Error("Method 'renderToDisplay()' must be implemented."); }
}
