// [モジュール責務] drawing-engine.js
// 目的：描画処理を行うすべてのエンジン（WebGL, Canvas2Dなど）が従うべき共通の設計図（インターフェース）を定義する抽象基底クラス。
// このクラス自体は描画機能を持たず、具体的な描画エンジンが実装すべきメソッド（drawCircle, drawLineなど）の仕様を定める。
// これにより、将来的に描画エンジンを切り替えても、アプリケーションの他の部分に影響を与えずに済むようにする。

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
     * [関数責務] drawCircle: 指定されたレイヤーに円を描画する機能の仕様を定義する。
     * @abstract
     * @param {number} centerX - 中心のX座標
     * @param {number} centerY - 中心のY座標
     * @param {number} radius - 半径
     * @param {object} color - 色 (RGBAオブジェクト)
     * @param {boolean} isEraser - 消しゴムモードか
     * @param {object} layer - 対象レイヤー
     */
    drawCircle(centerX, centerY, radius, color, isEraser, layer) {
        throw new Error("Method 'drawCircle()' must be implemented.");
    }

    /**
     * [関数責務] drawLine: 指定されたレイヤーに線を描画する機能の仕様を定義する。
     * @abstract
     * @param {number} x0 - 開始点のX座標
     * @param {number} y0 - 開始点のY座標
     * @param {number} x1 - 終了点のX座標
     * @param {number} y1 - 終了点のY座標
     * @param {number} size - ブラシサイズ
     * @param {object} color - 色 (RGBAオブジェクト)
     * @param {boolean} isEraser - 消しゴムモードか
     * @param {number} p0 - 開始点の筆圧
     * @param {number} p1 - 終了点の筆圧
     * @param {function} calculatePressureSize - 筆圧を反映したサイズを計算する関数
     * @param {object} layer - 対象レイヤー
     */
    drawLine(x0, y0, x1, y1, size, color, isEraser, p0, p1, calculatePressureSize, layer) {
        throw new Error("Method 'drawLine()' must be implemented.");
    }
    
    /**
     * [関数責務] fill: 指定されたレイヤーを特定の色で塗りつぶす機能の仕様を定義する。
     * @abstract
     * @param {object} layer - 対象レイヤー
     * @param {object} color - 色 (RGBAオブジェクト)
     */
    fill(layer, color) {
        throw new Error("Method 'fill()' must be implemented.");
    }
    
    /**
     * [関数責務] clear: 指定されたレイヤーの内容をすべて消去する機能の仕様を定義する。
     * @abstract
     * @param {object} layer - 対象レイヤー
     */
    clear(layer) {
        throw new Error("Method 'clear()' must be implemented.");
    }

    // --- 合成と表示 ---
    
    /**
     * [関数責務] getTransformedImageData: 変形（移動・回転・拡大縮小）が適用された後のレイヤーの画像データを取得する機能の仕様を定義する。
     * @abstract
     * @param {object} layer - 対象レイヤー
     * @returns {ImageData | null} 変形後の画像データ
     */
    getTransformedImageData(layer) {
        throw new Error("Method 'getTransformedImageData()' must be implemented.");
    }

    /**
     * [関数責務] compositeLayers: 複数のレイヤーを1枚の画像に合成する機能の仕様を定義する。
     * @abstract
     * @param {Array<object>} layers - 合成対象の全レイヤーの配列
     * @param {object} compositionData - 合成に関する追加データ（現在は未使用）
     * @param {object} dirtyRect - 再描画が必要な領域
     */
    compositeLayers(layers, compositionData, dirtyRect) {
        throw new Error("Method 'compositeLayers()' must be implemented.");
    }

    /**
     * [関数責務] renderToDisplay: 合成結果を最終的に画面に見えるように表示する機能の仕様を定義する。
     * @abstract
     * @param {object} compositionData - 表示に関する追加データ（現在は未使用）
     * @param {object} dirtyRect - 再描画が必要な領域
     */
    renderToDisplay(compositionData, dirtyRect) {
        throw new Error("Method 'renderToDisplay()' must be implemented.");
    }
    
    // --- データ同期 ---

    /**
     * [関数責務] syncDirtyRectToImageData: GPUメモリ上で行われた描画内容を、CPUが扱えるImageData形式に同期（コピー）する機能の仕様を定義する。
     * @abstract
     * @param {object} layer - 対象レイヤー
     * @param {object} dirtyRect - 同期が必要な領域
     */
    syncDirtyRectToImageData(layer, dirtyRect) {
         throw new Error("Method 'syncDirtyRectToImageData()' must be implemented.");
    }

    /**
     * [関数責務] isSupported: この描画エンジンが現在のブラウザ環境でサポートされているかを確認する静的メソッドの仕様を定義する。
     * @returns {boolean} サポートされていればtrue
     * @static
     */
    static isSupported() {
        return false;
    }
}