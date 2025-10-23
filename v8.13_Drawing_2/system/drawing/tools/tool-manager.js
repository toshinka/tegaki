/**
 * ToolManager - ツール状態管理・切り替え・ライフサイクル制御
 * Phase 1: ツール基盤の構築
 * 
 * 役割:
 * - ツールの登録・管理
 * - アクティブツールの切り替え
 * - ツールライフサイクル管理
 * 
 * EventBus発行:
 * - 'tool:changed' { from, to, tool }
 * 
 * 依存: EventBus
 * 参考: system/state-manager.js
 */

class ToolManager {
  /**
   * @param {Object} eventBus - EventBus インスタンス
   */
  constructor(eventBus) {
    this.eventBus = eventBus;
    
    // ツールレジストリ: Map<name, ToolClass>
    this.toolRegistry = new Map();
    
    // ツールインスタンスキャッシュ: Map<name, ToolInstance>
    this.toolInstances = new Map();
    
    // 現在のアクティブツール
    this.currentTool = null;
    this.currentToolName = null;
  }

  /**
   * ツールクラスを登録
   * 
   * @param {string} name - ツール識別名 (例: 'pen', 'eraser')
   * @param {class} ToolClass - ToolBase を継承したクラス
   */
  registerTool(name, ToolClass) {
    if (!name || typeof name !== 'string') {
      throw new Error('Tool name must be a non-empty string');
    }
    
    if (!ToolClass || typeof ToolClass !== 'function') {
      throw new Error('ToolClass must be a constructor function');
    }
    
    this.toolRegistry.set(name, ToolClass);
  }

  /**
   * ツールを切り替え
   * 
   * @param {string} name - 切り替え先ツール名
   * @param {Object} dependencies - ツールインスタンス生成時の依存オブジェクト
   * @returns {boolean} 成功時 true
   */
  switchTool(name, dependencies = {}) {
    if (!this.toolRegistry.has(name)) {
      console.error(`Tool "${name}" is not registered`);
      return false;
    }

    const fromName = this.currentToolName;
    
    // 現在のツールを非アクティブ化
    if (this.currentTool) {
      this.currentTool.onDeactivate();
    }

    // ツールインスタンス取得（キャッシュ利用）
    if (!this.toolInstances.has(name)) {
      const ToolClass = this.toolRegistry.get(name);
      const toolInstance = new ToolClass(dependencies);
      this.toolInstances.set(name, toolInstance);
    }

    this.currentTool = this.toolInstances.get(name);
    this.currentToolName = name;

    // 新しいツールをアクティブ化
    this.currentTool.onActivate();

    // イベント発行
    if (this.eventBus) {
      this.eventBus.emit('tool:changed', {
        from: fromName,
        to: name,
        tool: this.currentTool
      });
    }

    return true;
  }

  /**
   * 現在のアクティブツール取得
   * 
   * @returns {ToolBase|null}
   */
  getCurrentTool() {
    return this.currentTool;
  }

  /**
   * 現在のアクティブツール名取得
   * 
   * @returns {string|null}
   */
  getCurrentToolName() {
    return this.currentToolName;
  }

  /**
   * 登録済みツール一覧取得
   * 
   * @returns {string[]}
   */
  getRegisteredToolNames() {
    return Array.from(this.toolRegistry.keys());
  }

  /**
   * ツールが登録されているか確認
   * 
   * @param {string} name
   * @returns {boolean}
   */
  hasTool(name) {
    return this.toolRegistry.has(name);
  }

  /**
   * ツールインスタンスキャッシュをクリア
   * メモリ解放やリセット時に使用
   */
  clearInstances() {
    // 全インスタンスを非アクティブ化
    this.toolInstances.forEach(tool => {
      if (tool.isActive) {
        tool.onDeactivate();
      }
    });
    
    this.toolInstances.clear();
    this.currentTool = null;
    this.currentToolName = null;
  }
}

// グローバル登録
if (typeof window.TegakiDrawing === 'undefined') {
  window.TegakiDrawing = {};
}
window.TegakiDrawing.ToolManager = ToolManager;