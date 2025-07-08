// /core/rendering/canvas-manager.js

export class CanvasManager {
  constructor() {
    this.currentTool = null;         // 現在使用中のツール
    this.currentLayer = null;        // 現在の描画対象レイヤー
    this.layers = [];                // すべてのレイヤー（将来的に管理）
  }

  setCurrentTool(tool) {
    this.currentTool = tool;
    console.log("🛠️ ツールを設定:", tool?.name ?? tool);
  }

  setCurrentLayer(layer) {
    this.currentLayer = layer;
    console.log("🖌️ 描画対象レイヤーを設定:", layer?.id ?? "未定義");
  }

  getCurrentLayer() {
    return this.currentLayer;
  }

  // 転写処理や描画座標の変換、描画終了時の保存トリガーなども将来ここに統合
}
