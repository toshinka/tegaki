/*
 * ===================================================================================
 * Toshinka Tegaki Tool - Drawing Engine Bridge
 * Version: 1.9 (Phase 3 Architecture)
 *
 * このファイルは、描画エンジンのインタフェース（仕様）を定義します。
 * Canvas2DEngineや将来のWebGLEngineは、このクラスで定義された
 * メソッドをすべて実装する必要があります。
 * ===================================================================================
 */

export class DrawingEngine {
    constructor(canvas, width, height) {
        if (this.constructor === DrawingEngine) {
            throw new Error("Abstract classes can't be instantiated.");
        }
    }

    /**
     * 指定されたレイヤー群を合成し、表示キャンバスに最終結果を描画します。
     * @param {Layer[]} layers - 描画するすべてのレイヤーの配列。
     * @param {{minX: number, minY: number, maxX: number, maxY: number}} [dirtyRect] - 再描画が必要な矩形領域（最適化用）。
     */
    compositeAndRender(layers, dirtyRect) {
        throw new Error("Method 'compositeAndRender()' must be implemented.");
    }

    /**
     * 指定されたレイヤーをクリア（透明に）します。
     * @param {Layer} layer - クリア対象のレイヤー。
     */
    clearLayer(layer) {
        throw new Error("Method 'clearLayer()' must be implemented.");
    }
    
    /**
     * 指定されたレイヤーを特定色で塗りつぶします。
     * @param {Layer} layer - 塗りつぶし対象のレイヤー。
     * @param {string} hexColor - 塗りつぶす色（例: '#FF0000'）。
     */
    fillLayer(layer, hexColor) {
        throw new Error("Method 'fillLayer()' must be implemented.");
    }

    /**
     * 指定されたレイヤーに円（ブラシの点）を描画します。
     * @param {Layer} layer - 描画対象のレイヤー。
     * @param {number} x - 円の中心X座標。
     * @param {number} y - 円の中心Y座標。
     * @param {number} radius - 円の半径。
     * @param {{r:number, g:number, b:number, a:number}} color - 描画色。
     * @param {boolean} isEraser - 消しゴムモードかどうか。
     */
    drawCircle(layer, x, y, radius, color, isEraser) {
        throw new Error("Method 'drawCircle()' must be implemented.");
    }

    /**
     * 指定されたレイヤーに線を描画します。
     * @param {Layer} layer - 描画対象のレイヤー。
     * @param {object} from - 開始点 {x, y, pressure}。
     * @param {object} to - 終了点 {x, y, pressure}。
     * @param {number} baseSize - ブラシの基本サイズ。
     * @param {{r:number, g:number, b:number, a:number}} color - 描画色。
     * @param {boolean} isEraser - 消しゴムモードかどうか。
     * @param {object} pressureSettings - 筆圧設定。
     * @param {object} drawingQuality - 描画品質設定。
     */
    drawLine(layer, from, to, baseSize, color, isEraser, pressureSettings, drawingQuality) {
        throw new Error("Method 'drawLine()' must be implemented.");
    }
    
    /**
     * 指定されたレイヤーで塗りつぶし（バケツツール）を実行します。
     * @param {Layer} layer - 処理対象のレイヤー。
     * @param {number} x - 開始点のX座標。
     * @param {number} y - 開始点のY座標。
     * @param {{r:number, g:number, b:number, a:number}} color - 塗りつぶす色。
     */
    floodFill(layer, x, y, color) {
        throw new Error("Method 'floodFill()' must be implemented.");
    }

    /**
     * 上のレイヤーを下のレイヤーに結合します。
     * @param {Layer} topLayer - 上のレイヤー。
     * @param {Layer} bottomLayer - 下のレイヤー（結合先）。
     */
    mergeLayers(topLayer, bottomLayer) {
        throw new Error("Method 'mergeLayers()' must be implemented.");
    }

    /**
     * レイヤーの変形を適用した結果を返します。
     * @param {ImageData} sourceImageData - 元の画像データ。
     * @param {object} transform - 変形情報 {x, y, scale, rotation}。
     * @returns {ImageData} 変形後のImageData。
     */
    getTransformedImageData(sourceImageData, transform) {
        throw new Error("Method 'getTransformedImageData()' must be implemented.");
    }
    
    /**
     * 現在の表示キャンバスの状態をPNGのData URLとしてエクスポートします。
     * @param {Layer[]} layers - エクスポート対象のレイヤー群。
     * @returns {string} Data URL。
     */
    exportToDataURL(layers) {
        throw new Error("Method 'exportToDataURL()' must be implemented.");
    }
}