/**
 * [モジュール責務] drawing-engine.js
 * 目的：描画処理を行うすべてのエンジン（WebGL, Canvas2Dなど）が従うべき共通の設計図（インターフェース）を定義する抽象基底クラス。
 * このクラス自体は描画機能を持たず、具体的な描画エンジンが実装すべきメソッド（drawCircle, drawLineなど）の仕様を定める。
 * これにより、将来的に描画エンジンを切り替えても、アプリケーションの他の部分に影響を与えずに済むようにする。
 *
 * @abstract
 */
// 変更: DrawingEngine -> StrokeRenderer
export class StrokeRenderer {
    constructor(canvas) {
        if (this.constructor === StrokeRenderer) { // 変更: DrawingEngine -> StrokeRenderer
            throw new Error("Abstract class 'StrokeRenderer' cannot be instantiated directly.");
        }
        this.canvas = canvas;
    }

    /**
     * [関数責務] isInitialized: エンジンの初期化が成功したかを確認する。
     * @returns {boolean} 初期化済みならtrue
     */
    isInitialized() {
        throw new Error("Method 'isInitialized()' must be implemented.");
    }

    /**
     * [関数責務] drawCircle: 指定されたレイヤーに円を描画する機能の仕様を定義する。
     * @abstract
     */
    drawCircle(centerX, centerY, radius, color, isEraser, layer) {
        throw new Error("Method 'drawCircle()' must be implemented.");
    }

    /**
     * [関数責務] drawLine: 指定されたレイヤーに線を描画する機能の仕様を定義する。
     * @abstract
     */
    drawLine(x0, y0, x1, y1, size, color, isEraser, p0, p1, calculatePressureSize, layer) {
        throw new Error("Method 'drawLine()' must be implemented.");
    }

    /**
     * [関数責務] drawLineSegment: 指定されたレイヤーに線分を描画する機能の仕様を定義する。
     * @abstract
     */
    drawLineSegment(x0, y0, x1, y1, size, color, isEraser, layer) {
        throw new Error("Method 'drawLineSegment()' must be implemented.");
    }

    /**
     * [関数責務] getTransformedImageData: 変形後のレイヤー画像データを取得する機能の仕様を定義する。
     * @abstract
     */
    getTransformedImageData(layer) {
        throw new Error("Method 'getTransformedImageData()' must be implemented.");
    }

    /**
     * [関数責務] compositeLayers: 複数のレイヤーを1枚の画像に合成する機能の仕様を定義する。
     * @abstract
     */
    compositeLayers(layers, dirtyRect) {
        throw new Error("Method 'compositeLayers()' must be implemented.");
    }

    /**
     * [関数責務] renderToDisplay: 合成結果を最終的に画面に表示する機能の仕様を定義する。
     * @abstract
     */
    renderToDisplay(dirtyRect) {
        throw new Error("Method 'renderToDisplay()' must be implemented.");
    }

    /**
     * [関数責務] syncDirtyRectToImageData: GPUメモリからCPUのImageDataへ描画内容を同期する機能の仕様を定義する。
     * @abstract
     */
    syncDirtyRectToImageData(layer, dirtyRect) {
        throw new Error("Method 'syncDirtyRectToImageData()' must be implemented.");
    }

    /**
     * [関数責務] isSupported: この描画エンジンが現在のブラウザ環境でサポートされているかを確認する。
     * @static
     */
    static isSupported() {
        return false;
    }
}