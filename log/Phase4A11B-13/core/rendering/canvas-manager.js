// /core/rendering/canvas-manager.js
export class CanvasManager {
  constructor() {
    this.currentTool = null;         // 現在使用中のツール
    this.currentLayer = null;        // 現在の描画対象レイヤー
    // Phase 4A11B-13の指示に基づき追加
    this.currentColor = null;        // 現在の描画色
    this.brushSize = null;           // 現在のブラシサイズ
  }

  /**
   * 現在使用するツールを設定します。
   * @param {string | object} tool - ツール名またはツールオブジェクト
   */
  setCurrentTool(tool) {
    this.currentTool = tool;
    console.log("🛠️ ツールを設定:", tool?.name ?? tool);
  }

  /**
   * 現在の描画対象レイヤーを設定します。
   * @param {object} layer - レイヤーオブジェクト
   */
  setCurrentLayer(layer) {
    this.currentLayer = layer;
  }

  /**
   * 現在の描画対象レイヤーを取得します。
   * @returns {object | null} 現在のレイヤーオブジェクト
   */
  getCurrentLayer() {
    return this.currentLayer;
  }
  
  /**
   * 現在の描画色を設定します。 [cite: 10]
   * @param {string} color - 色 (例: '#RRGGBB')
   */
  setCurrentColor(color) {
    this.currentColor = color;
  }

  /**
   * 現在のブラシサイズを設定します。 [cite: 10]
   * @param {number} size - ブラシサイズ
   */
  setCurrentSize(size) {
    this.brushSize = size;
  }
}