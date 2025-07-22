/**
 * ToolStore.js - ツール状態管理 + Actions統合
 * 
 * 憲章準拠：
 * - Store/Actions/UI三層構造の厳格実装
 * - ToolEngineController厳格連動
 * - ツール選択=エンジン起動の唯一トリガー
 * 
 * Phase2-A制約：
 * - ペンツール中心実装
 * - Actions統合（状態変更の一元管理）
 */
class ToolStore {
    constructor() {
        // 状態管理
        this.state = {
            currentTool: 'pen',
            toolSettings: {
                pen: {
                    size: 3,
                    opacity: 100,
                    color: '#800000'
                },
                brush: {
                    size: 20,
                    opacity: 80,
                    color: '#800000',
                    hardness: 0.8
                },
                eraser: {
                    size: 15,
                    opacity: 100
                }
            }
        };

        // 購読者管理
        this.subscribers = new Set();
        
        // 許可ツールリスト
        this.availableTools = ['pen', 'brush', 'eraser'];
        
        // Actions統合
        this.actions = new ToolActions(this);
    }

    /**
     * 状態購読
     */
    subscribe(callback) {
        this.subscribers.add(callback);
        
        // 購読解除関数を返す
        return () => {
            this.subscribers.delete(callback);
        };
    }

    /**
     * 購読者への通知
     */
    notify(changeType, payload) {
        this.subscribers.forEach(callback => {
            try {
                callback({
                    type: changeType,
                    payload,
                    state: { ...this.state }
                });
            } catch (error) {
                console.error('ToolStore notification error:', error);
            }
        });
    }

    /**
     * 現在のツール取得
     */
    getCurrentTool() {
        return this.state.currentTool;
    }

    /**
     * ツール設定取得
     */
    getToolSettings(toolName = null) {
        const tool = toolName || this.state.currentTool;
        return { ...this.state.toolSettings[tool] };
    }

    /**
     * 現在のツール設定取得
     */
    getCurrentToolSettings() {
        return this.getToolSettings(this.state.currentTool);
    }

    /**
     * 利用可能ツールリスト取得
     */
    getAvailableTools() {
        return [...this.availableTools];
    }

    /**
     * ツール選択状態更新（内部メソッド）
     */
    _updateCurrentTool(toolName) {
        if (!this.availableTools.includes(toolName)) {
            throw new Error(`未対応ツール: ${toolName}`);
        }
        
        const previousTool = this.state.currentTool;
        this.state.currentTool = toolName;
        
        // グローバル状態更新（ToolEngineController用）
        window.currentTool = toolName;
        
        this.notify('TOOL_CHANGED', {
            previousTool,
            currentTool: toolName,
            settings: this.getCurrentToolSettings()
        });
    }

    /**
     * ツール設定更新（内部メソッド）
     */
    _updateToolSettings(toolName, settings) {
        if (!this.state.toolSettings[toolName]) {
            this.state.toolSettings[toolName] = {};
        }
        
        const previousSettings = { ...this.state.toolSettings[toolName] };
        this.state.toolSettings[toolName] = {
            ...this.state.toolSettings[toolName],
            ...settings
        };
        
        this.notify('TOOL_SETTINGS_CHANGED', {
            toolName,
            previousSettings,
            newSettings: this.state.toolSettings[toolName]
        });
    }

    /**
     * 状態リセット
     */
    reset() {
        const initialState = {
            currentTool: 'pen',
            toolSettings: {
                pen: { size: 3, opacity: 100, color: '#800000' },
                brush: { size: 20, opacity: 80, color: '#800000', hardness: 0.8 },
                eraser: { size: 15, opacity: 100 }
            }
        };
        
        this.state = initialState;
        window.currentTool = 'pen';
        
        this.notify('STORE_RESET', { state: this.state });
    }
}

/**
 * ToolActions - ツール操作Actions（Store統合）
 * 
 * 憲章準拠：Actions パターン実装
 * - 全ての状態変更はActionsを経由
 * - ServiceContainer経由でのToolEngineController連動
 */
class ToolActions {
    constructor(store) {
        this.store = store;
    }

    /**
     * ツール選択Action
     */
    selectTool(toolName) {
        try {
            // 憲章準拠：ToolEngineController厳格連動
            const toolEngineController = window.serviceContainer?.get('ToolEngineController');
            if (toolEngineController) {
                // エンジン切り替え前検証
                toolEngineController.validateToolSwitch(toolName);
            }
            
            // Store状態更新
            this.store._updateCurrentTool(toolName);
            
            // ToolEngineController連動（エンジン起動）
            if (toolEngineController) {
                toolEngineController.switchToTool(toolName);
            }
            
            return { success: true, tool: toolName };
            
        } catch (error) {
            console.error('Tool selection failed:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * ツール設定更新Action
     */
    updateToolSettings(toolName, settings) {
        try {
            // 設定値検証
            this._validateSettings(toolName, settings);
            
            // Store状態更新
            this.store._updateToolSettings(toolName, settings);
            
            // 現在選択中ツールの場合、エンジンに即座反映
            if (toolName === this.store.getCurrentTool()) {
                const toolEngineController = window.serviceContainer?.get('ToolEngineController');
                if (toolEngineController) {
                    toolEngineController.updateCurrentToolSettings(settings);
                }
            }
            
            return { success: true, toolName, settings };
            
        } catch (error) {
            console.error('Tool settings update failed:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * 現在ツール設定更新Action（ショートカット）
     */
    updateCurrentToolSettings(settings) {
        const currentTool = this.store.getCurrentTool();
        return this.updateToolSettings(currentTool, settings);
    }

    /**
     * ペンサイズ更新Action（UI連動用）
     */
    updatePenSize(size) {
        const numSize = parseInt(size);
        if (isNaN(numSize) || numSize < 1 || numSize > 50) {
            throw new Error('ペンサイズは1-50の範囲で指定してください');
        }
        
        return this.updateToolSettings('pen', { size: numSize });
    }

    /**
     * ペン透明度更新Action（UI連動用）
     */
    updatePenOpacity(opacity) {
        const numOpacity = parseInt(opacity);
        if (isNaN(numOpacity) || numOpacity < 1 || numOpacity > 100) {
            throw new Error('透明度は1-100の範囲で指定してください');
        }
        
        return this.updateToolSettings('pen', { opacity: numOpacity });
    }

    /**
     * 設定値検証（内部メソッド）
     */
    _validateSettings(toolName, settings) {
        const validators = {
            pen: (s) => {
                if (s.size && (s.size < 1 || s.size > 50)) throw new Error('ペンサイズ範囲外');
                if (s.opacity && (s.opacity < 1 || s.opacity > 100)) throw new Error('透明度範囲外');
            },
            brush: (s) => {
                if (s.size && (s.size < 5 || s.size > 100)) throw new Error('ブラシサイズ範囲外');
                if (s.opacity && (s.opacity < 1 || s.opacity > 100)) throw new Error('透明度範囲外');
                if (s.hardness && (s.hardness < 0 || s.hardness > 1)) throw new Error('硬さ範囲外');
            },
            eraser: (s) => {
                if (s.size && (s.size < 5 || s.size > 100)) throw new Error('消しゴムサイズ範囲外');
            }
        };

        const validator = validators[toolName];
        if (validator) {
            validator(settings);
        }
    }
}

// Phase2-A制約：グローバルエクスポート（後でモジュール化）
window.ToolStore = ToolStore;
window.ToolActions = ToolActions;