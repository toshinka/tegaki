// system/drawing/tools/tool-base.js
// 全ツール共通の抽象基底クラス

class ToolBase {
  constructor(engine) {
    if (new.target === ToolBase) {
      throw new Error('ToolBase is abstract and cannot be instantiated directly');
    }
    this.engine = engine;
    this.isActive = false;
  }

  // 必須実装メソッド - 派生クラスでオーバーライド必須
  onPointerDown(worldPos, pressure) {
    throw new Error('onPointerDown must be implemented by derived class');
  }

  onPointerMove(worldPos, pressure) {
    throw new Error('onPointerMove must be implemented by derived class');
  }

  onPointerUp(worldPos, pressure) {
    throw new Error('onPointerUp must be implemented by derived class');
  }

  // オプショナルメソッド - 派生クラスで必要に応じてオーバーライド
  onActivate() {
    this.isActive = true;
  }

  onDeactivate() {
    this.isActive = false;
  }

  getCursor() {
    return 'default';
  }

  // ユーティリティメソッド
  getDataManager() {
    return this.engine.dataManager;
  }

  getBrushSettings() {
    return this.engine.brushSettings;
  }
}