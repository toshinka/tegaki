export class ToolManager {
  constructor(layerManager, drawingEngine) {
    this.layerManager = layerManager;
    this.drawingEngine = drawingEngine;

    // 初期ツール設定
    this.currentTool = 'pen';
    console.log(`🖊️ 初期ツール: ${this.currentTool}`);
  }

  setTool(toolName) {
    this.currentTool = toolName;
    console.log(`🛠️ ツールが変更されました: ${this.currentTool}`);
  }

  getTool() {
    return this.currentTool;
  }
}
