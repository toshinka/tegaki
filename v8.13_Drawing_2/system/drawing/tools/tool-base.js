/**
 * ToolBase - 全ツール共通の抽象基底クラス
 * Phase 1: ツール基盤の構築
 * 
 * 役割:
 * - ツール共通インターフェースの定義
 * - ライフサイクル管理の基礎提供
 * 
 * 依存: なし
 */

class ToolBase {
  /**
   * @param {Object} dependencies - ツールが必要とする依存オブジェクト
   * @param {Object} dependencies.dataManager - StrokeDataManager
   * @param {Object} dependencies.eventBus - EventBus
   * @param {Object} dependencies.settings - BrushSettings
   */
  constructor(dependencies = {}) {
    this.dataManager = dependencies.dataManager;
    this.eventBus = dependencies.eventBus;
    this.settings = dependencies.settings;
    
    this.isActive = false;
  }

  /**
   * ツールがアクティブ化される時に呼ばれる
   * オーバーライド可能
   */
  onActivate() {
    this.isActive = true;
  }

  /**
   * ツールが非アクティブ化される時に呼ばれる
   * オーバーライド可能
   */
  onDeactivate() {
    this.isActive = false;
  }

  /**
   * ポインター押下時の処理
   * 必須実装メソッド
   * 
   * @param {Object} worldPos - ワールド座標 { x, y }
   * @param {number} pressure - 筆圧 (0.0 - 1.0)
   */
  onPointerDown(worldPos, pressure) {
    throw new Error('ToolBase.onPointerDown() must be implemented');
  }

  /**
   * ポインター移動時の処理
   * 必須実装メソッド
   * 
   * @param {Object} worldPos - ワールド座標 { x, y }
   * @param {number} pressure - 筆圧 (0.0 - 1.0)
   */
  onPointerMove(worldPos, pressure) {
    throw new Error('ToolBase.onPointerMove() must be implemented');
  }

  /**
   * ポインター解放時の処理
   * 必須実装メソッド
   * 
   * @param {Object} worldPos - ワールド座標 { x, y }
   * @param {number} pressure - 筆圧 (0.0 - 1.0)
   */
  onPointerUp(worldPos, pressure) {
    throw new Error('ToolBase.onPointerUp() must be implemented');
  }

  /**
   * カーソルスタイル取得
   * オーバーライド可能
   * 
   * @returns {string} CSS cursor値
   */
  getCursor() {
    return 'default';
  }

  /**
   * ツール名取得
   * オーバーライド推奨
   * 
   * @returns {string}
   */
  getName() {
    return this.constructor.name;
  }
}

// グローバル登録
if (typeof window.TegakiDrawing === 'undefined') {
  window.TegakiDrawing = {};
}
window.TegakiDrawing.ToolBase = ToolBase;