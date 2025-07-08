// /core/rendering/canvas-manager.js
export class CanvasManager {
  constructor() {
    this.currentTool = null;         // 現在使用中のツール
    this.currentLayer = null;        // 現在の描画対象レイヤー
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
}