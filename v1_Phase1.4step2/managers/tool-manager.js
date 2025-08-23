/**
 * ToolManager - ツール管理システム
 * 
 * 責務:
 * - 現在アクティブなツールの管理
 * - ツール切替処理
 * - CanvasManagerからのPointerイベント受信→アクティブツールへ転送
 * - ツール固有イベントの中継
 * 
 * 依存: EventBus, StateManager, ツール群(PenTool, EraserTool)
 * 公開: window.ToolManager
 */

class ToolManager {
    constructor() {
        this.tools = new Map();
        this.activeTool = null;
        this.previousTool = null;
        
        this.isInitialized = false;
        
        // イベント参照
        this.eventBus = window.EventBus;
        this.stateManager = window.StateManager;
        
        // 入力状態管理
        this.inputState = {
            isPointerDown: false,
            activePointerId: null,
            currentPointer: null
        };
    }

    /**
     * ToolManagerを初期化
     * @returns {boolean} 成功/失敗
     */
    initialize() {
        try {
            if (this.isInitialized) {
                console.warn('[ToolManager] Already initialized');
                return true;
            }

            // 利用可能なツールを登録
            this._registerTools();
            
            // イベントリスナーを設定
            this._setupEventListeners();
            
            // デフォルトツールを設定
            this._setDefaultTool();
            
            this.isInitialized = true;
            console.log('[ToolManager] Successfully initialized');
            
            this.eventBus?.emit('toolmanager:initialized', {
                availableTools: Array.from(this.tools.keys()),
                activeTool: this.activeTool?.name
            });
            
            return true;
        } catch (error) {
            window.ErrorManager?.handleError(error, 'ToolManager.initialize', 'error', true);
            return false;
        }
    }

    /**
     * アクティブツールを設定
     * @param {string} toolName - ツール名
     * @returns {boolean} 成功/失敗
     */
    setActiveTool(toolName) {
        try {
            if (!this.tools.has(toolName)) {
                window.ErrorManager?.handleError(`Tool "${toolName}" not found`, 'ToolManager.setActiveTool');
                return false;
            }

            const newTool = this.tools.get(toolName);
            
            // 同じツールの場合は何もしない
            if (this.activeTool === newTool) {
                return true;
            }

            // 描画中の場合は現在のストロークを完了
            if (this.activeTool && this.activeTool.isDrawing) {
                this.activeTool.endStroke();
                this._updateInputState(false, null, null);
            }

            // 現在のツールを無効化
            if (this.activeTool) {
                this.previousTool = this.activeTool;
                this.activeTool.deactivate();
            }

            // 新しいツールを有効化
            this.activeTool = newTool;
            this.activeTool.activate();

            // 状態を更新
            this.stateManager?.set('tool.active', toolName);
            this.stateManager?.set('tool.previous', this.previousTool?.name || null);

            console.log(`[ToolManager] Active tool changed to: ${toolName}`);
            
            this.eventBus?.emit('tool:change', {
                newTool: toolName,
                previousTool: this.previousTool?.name,
                toolInstance: this.activeTool
            });

            return true;
        } catch (error) {
            window.ErrorManager?.handleError(error, 'ToolManager.setActiveTool');
            return false;
        }
    }

    /**
     * 現在のアクティブツールを取得
     * @returns {AbstractTool|null} アクティブツール
     */
    getActiveTool() {
        return this.activeTool;
    }

    /**
     * 前回のツールに切り替え
     * @returns {boolean} 成功/失敗
     */
    switchToPreviousTool() {
        if (this.previousTool) {
            return this.setActiveTool(this.previousTool.name);
        }
        return false;
    }

    /**
     * 利用可能なツール一覧を取得
     * @returns {Array} ツール名の配列
     */
    getAvailableTools() {
        return Array.from(this.tools.keys());
    }

    /**
     * 指定ツールの設定を取得
     * @param {string} toolName - ツール名
     * @returns {object|null} ツール設定
     */
    getToolSettings(toolName) {
        const tool = this.tools.get(toolName);
        return tool ? tool.getSettings() : null;
    }

    /**
     * 指定ツールの設定を更新
     * @param {string} toolName - ツール名
     * @param {object} settings - 新しい設定
     * @returns {boolean} 成功/失敗
     */
    updateToolSettings(toolName, settings) {
        try {
            const tool = this.tools.get(toolName);
            if (!tool) {
                return false;
            }

            tool.updateSettings(settings);
            
            // アクティブツールの場合は状態も更新
            if (this.activeTool === tool) {
                this.eventBus?.emit('tool:active-settings-updated', {
                    toolName,
                    settings: tool.getSettings()
                });
            }

            return true;
        } catch (error) {
            window.ErrorManager?.handleError(error, 'ToolManager.updateToolSettings');
            return false;
        }
    }

    /**
     * ツールの統計情報を取得
     * @param {string} toolName - ツール名（省略時は全ツール）
     * @returns {object} 統計情報
     */
    getToolStats(toolName = null) {
        try {
            if (toolName) {
                const tool = this.tools.get(toolName);
                return tool ? tool.getStats() : null;
            }

            // 全ツールの統計
            const allStats = {};
            for (const [name, tool] of this.tools) {
                allStats[name] = tool.getStats();
            }
            return allStats;
        } catch (error) {
            window.ErrorManager?.handleError(error, 'ToolManager.getToolStats');
            return null;
        }
    }

    /**
     * PointerDownイベント処理
     * @param {object} pointerInfo - ポインター情報
     */
    handlePointerDown(pointerInfo) {
        try {
            if (!this.activeTool) {
                return;
            }

            // 既に描画中の場合は無視（マルチタッチ対応時に重要）
            if (this.inputState.isPointerDown && 
                this.inputState.activePointerId !== pointerInfo.pointerId) {
                return;
            }

            // 入力状態を更新
            this._updateInputState(true, pointerInfo.pointerId, pointerInfo);

            // アクティブツールにストローク開始を通知
            this.activeTool.startStroke(pointerInfo);

            console.log(`[ToolManager] Pointer down handled by ${this.activeTool.name}Tool`);
        } catch (error) {
            window.ErrorManager?.handleError(error, 'ToolManager.handlePointerDown');
        }
    }

    /**
     * PointerMoveイベント処理
     * @param {object} pointerInfo - ポインター情報
     */
    handlePointerMove(pointerInfo) {
        try {
            if (!this.activeTool) {
                return;
            }

            // 描画中でない場合、または異なるポインターの場合は無視
            if (!this.inputState.isPointerDown || 
                this.inputState.activePointerId !== pointerInfo.pointerId) {
                return;
            }

            // 入力状態を更新
            this._updateInputState(true, pointerInfo.pointerId, pointerInfo);

            // アクティブツールに点追加を通知
            this.activeTool.addPoint(pointerInfo);
        } catch (error) {
            window.ErrorManager?.handleError(error, 'ToolManager.handlePointerMove');
        }
    }

    /**
     * PointerUpイベント処理
     * @param {object} pointerInfo - ポインター情報
     */
    handlePointerUp(pointerInfo) {
        try {
            if (!this.activeTool) {
                return;
            }

            // 描画中でない場合、または異なるポインターの場合は無視
            if (!this.inputState.isPointerDown || 
                this.inputState.activePointerId !== pointerInfo.pointerId) {
                return;
            }

            // アクティブツールにストローク終了を通知
            this.activeTool.endStroke(pointerInfo);

            // 入力状態をリセット
            this._updateInputState(false, null, null);

            console.log(`[ToolManager] Pointer up handled by ${this.activeTool.name}Tool`);
        } catch (error) {
            window.ErrorManager?.handleError(error, 'ToolManager.handlePointerUp');
        }
    }

    /**
     * PointerCancelイベント処理
     * @param {object} cancelInfo - キャンセル情報
     */
    handlePointerCancel(cancelInfo) {
        try {
            if (!this.activeTool) {
                return;
            }

            // 描画中の場合は強制終了
            if (this.inputState.isPointerDown && 
                this.inputState.activePointerId === cancelInfo.pointerId) {
                
                this.activeTool.endStroke();
                this._updateInputState(false, null, null);
                
                console.log(`[ToolManager] Pointer canceled, stroke force-ended`);
            }
        } catch (error) {
            window.ErrorManager?.handleError(error, 'ToolManager.handlePointerCancel');
        }
    }

    // ========================================
    // 内部メソッド
    // ========================================

    /**
     * ツールを登録
     * @private
     */
    _registerTools() {
        try {
            // PenTool登録
            if (window.PenTool) {
                this.tools.set('pen', window.PenTool);
                console.log('[ToolManager] PenTool registered');
            }

            // EraserTool登録
            if (window.EraserTool) {
                this.tools.set('eraser', window.EraserTool);
                console.log('[ToolManager] EraserTool registered');
            }

            // 将来のツール拡張用
            // if (window.BrushTool) this.tools.set('brush', window.BrushTool);
            // if (window.LineTool) this.tools.set('line', window.LineTool);

            console.log(`[ToolManager] ${this.tools.size} tools registered`);
        } catch (error) {
            window.ErrorManager?.handleError(error, 'ToolManager._registerTools');
        }
    }

    /**
     * イベントリスナーを設定
     * @private
     */
    _setupEventListeners() {
        try {
            if (!this.eventBus) {
                return;
            }

            // CanvasManagerからのPointerイベントを受信
            this.eventBus.on('canvas:pointerdown', (pointerInfo) => {
                this.handlePointerDown(pointerInfo);
            });

            this.eventBus.on('canvas:pointermove', (pointerInfo) => {
                this.handlePointerMove(pointerInfo);
            });

            this.eventBus.on('canvas:pointerup', (pointerInfo) => {
                this.handlePointerUp(pointerInfo);
            });

            this.eventBus.on('canvas:pointercancel', (cancelInfo) => {
                this.handlePointerCancel(cancelInfo);
            });

            // ツール切替要求を受信
            this.eventBus.on('ui:tool-change-request', (data) => {
                if (data.toolName) {
                    this.setActiveTool(data.toolName);
                }
            });

            // 設定変更要求を受信
            this.eventBus.on('ui:tool-settings-change', (data) => {
                if (data.toolName && data.settings) {
                    this.updateToolSettings(data.toolName, data.settings);
                }
            });

            // 将来のショートカット対応
            this.eventBus.on('shortcut:tool-switch', (data) => {
                if (data.toolName) {
                    this.setActiveTool(data.toolName);
                } else if (data.action === 'previous') {
                    this.switchToPreviousTool();
                }
            });

            console.log('[ToolManager] Event listeners setup complete');
        } catch (error) {
            window.ErrorManager?.handleError(error, 'ToolManager._setupEventListeners');
        }
    }

    /**
     * デフォルトツールを設定
     * @private
     */
    _setDefaultTool() {
        try {
            // 設定からデフォルトツールを取得
            const defaultToolName = window.ConfigManager?.get('tool.default', 'pen');
            
            if (this.tools.has(defaultToolName)) {
                this.setActiveTool(defaultToolName);
            } else if (this.tools.has('pen')) {
                // フォールバック: ペンツール
                this.setActiveTool('pen');
            } else if (this.tools.size > 0) {
                // フォールバック: 最初に見つかったツール
                const firstTool = this.tools.keys().next().value;
                this.setActiveTool(firstTool);
            }
        } catch (error) {
            window.ErrorManager?.handleError(error, 'ToolManager._setDefaultTool');
        }
    }

    /**
     * 入力状態を更新
     * @private
     */
    _updateInputState(isDown, pointerId, pointerInfo) {
        this.inputState.isPointerDown = isDown;
        this.inputState.activePointerId = pointerId;
        this.inputState.currentPointer = pointerInfo;

        // StateManagerにも反映
        this.stateManager?.set('tool.isDrawing', isDown && this.activeTool?.isDrawing);
        this.stateManager?.set('interaction.pointerDown', isDown);
        
        if (pointerInfo) {
            this.stateManager?.set('interaction.pointerType', pointerInfo.pointerType);
            this.stateManager?.set('interaction.pressure', pointerInfo.pressure);
        }
    }

    /**
     * 現在の入力状態を取得
     * @returns {object} 入力状態
     */
    getInputState() {
        return {
            ...this.inputState,
            isDrawing: this.activeTool?.isDrawing || false
        };
    }

    /**
     * 全ツールをリセット
     */
    resetAllTools() {
        try {
            for (const [name, tool] of this.tools) {
                tool.reset();
            }
            
            console.log('[ToolManager] All tools reset');
            this.eventBus?.emit('toolmanager:tools-reset');
        } catch (error) {
            window.ErrorManager?.handleError(error, 'ToolManager.resetAllTools');
        }
    }
}

// グローバルインスタンスを作成・公開
window.ToolManager = new ToolManager();

console.log('[ToolManager] Initialized and registered to window.ToolManager');