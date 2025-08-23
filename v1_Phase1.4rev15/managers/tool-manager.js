/**
 * 🎯 ToolManager - ツール選択・配信制御専門
 * 🔄 EVENT_DELEGATION: CanvasManager → Tool へのイベント配信
 * ✅ TOOL_LIFECYCLE: ツールインスタンス管理・Graphics接続制御
 * 📋 RESPONSIBILITY: 「ツールの選択と配信制御」
 * 🚫 DRAWING_PROHIBITION: 直接的な描画処理は禁止（Tool委譲のみ）
 * 
 * 📏 DESIGN_PRINCIPLE: CanvasEvent → 適切なTool → Graphics生成
 * 🎯 ARCHITECTURE: AbstractTool継承ツールの統一管理
 * 
 * @version 1.0-Phase1.4-unified-control-enhanced
 * @author Tegaki Development Team
 * @since Phase1.0
 */

class ToolManager {
    constructor() {
        this.tools = {};
        this.activeTool = null;
        this.activeToolName = 'pen';
        this.canvasManager = null;
        this.coordinateManager = null;
        this.isInitialized = false;
        
        // ツール設定
        this.toolSettings = {
            pen: { color: 0x000000, width: 2, opacity: 1.0 },
            eraser: { width: 10, opacity: 1.0 },
            brush: { color: 0x000000, width: 5, opacity: 0.8 }
        };
        
        console.log('🎯 ToolManager初期化開始 - v1.0-Phase1.4-unified-control-enhanced');
    }

    /**
     * ToolManager初期化
     * @returns {Promise<boolean>} 初期化成功可否
     */
    async initialize() {
        try {
            console.log('🎯 ToolManager初期化開始');

            // 基盤システム確認
            if (!window.ErrorManager || !window.StateManager || !window.EventBus) {
                throw new Error('基盤システム（ErrorManager, StateManager, EventBus）未初期化');
            }

            // ツールインスタンス作成
            if (!this.createToolInstances()) {
                throw new Error('ツールインスタンス作成失敗');
            }

            // 初期ツール設定
            if (!this.setActiveTool(this.activeToolName)) {
                console.warn('⚠️ ToolManager: 初期ツール設定失敗、penツールにフォールバック');
                this.setActiveTool('pen');
            }

            // イベント配信システム初期化
            this.initializeEventDelegation();

            this.isInitialized = true;
            console.log('✅ ToolManager初期化完了');
            console.log('🔧 利用可能ツール:', Object.keys(this.tools));
            console.log('🎯 アクティブツール:', this.activeToolName);

            return true;

        } catch (error) {
            console.error('❌ ToolManager初期化エラー:', error);
            window.ErrorManager?.showErrorMessage('ツール管理システム初期化失敗', error.message);
            return false;
        }
    }

    /**
     * ツールインスタンス作成
     * @returns {boolean} 作成成功可否
     */
    createToolInstances() {
        try {
            // PenTool作成
            if (window.PenTool) {
                this.tools.pen = new window.PenTool();
                console.log('🖊️ PenTool インスタンス作成完了');
            } else {
                console.warn('⚠️ PenTool クラス未登録');
            }

            // EraserTool作成
            if (window.EraserTool) {
                this.tools.eraser = new window.EraserTool();
                console.log('🧹 EraserTool インスタンス作成完了');
            } else {
                console.warn('⚠️ EraserTool クラス未登録');
            }

            // 最低1つのツールが必要
            if (Object.keys(this.tools).length === 0) {
                throw new Error('利用可能なツールがありません');
            }

            console.log('🔧 ツールインスタンス作成完了:', Object.keys(this.tools));
            return true;

        } catch (error) {
            console.error('❌ ツールインスタンス作成エラー:', error);
            return false;
        }
    }

    /**
     * CanvasManager接続・統合
     * @param {CanvasManager} canvasManager - キャンバス管理インスタンス
     * @returns {boolean} 接続成功可否
     */
    setCanvasManager(canvasManager) {
        try {
            if (!canvasManager) {
                console.error('❌ ToolManager: CanvasManager が null です');
                return false;
            }

            this.canvasManager = canvasManager;

            // 全ツールにCanvasManager接続
            let connectedCount = 0;
            Object.values(this.tools).forEach(tool => {
                if (tool && typeof tool.setCanvasManager === 'function') {
                    if (tool.setCanvasManager(canvasManager)) {
                        connectedCount++;
                    }
                }
            });

            console.log('🔗 ToolManager: CanvasManager統合完了');
            console.log(`📊 接続済みツール数: ${connectedCount}/${Object.keys(this.tools).length}`);

            // イベント配信を再初期化
            this.initializeEventDelegation();

            return true;

        } catch (error) {
            console.error('❌ ToolManager: CanvasManager接続エラー:', error);
            return false;
        }
    }

    /**
     * CoordinateManager接続・統合
     * @param {CoordinateManager} coordinateManager - 座標管理インスタンス
     * @returns {boolean} 接続成功可否
     */
    setCoordinateManager(coordinateManager) {
        try {
            if (!coordinateManager) {
                console.error('❌ ToolManager: CoordinateManager が null です');
                return false;
            }

            this.coordinateManager = coordinateManager;

            // 全ツールにCoordinateManager接続
            let connectedCount = 0;
            Object.values(this.tools).forEach(tool => {
                if (tool && typeof tool.setCoordinateManager === 'function') {
                    if (tool.setCoordinateManager(coordinateManager)) {
                        connectedCount++;
                    }
                }
            });

            console.log('🔗 ToolManager: CoordinateManager統合完了');
            console.log(`📊 接続済みツール数: ${connectedCount}/${Object.keys(this.tools).length}`);

            return true;

        } catch (error) {
            console.error('❌ ToolManager: CoordinateManager接続エラー:', error);
            return false;
        }
    }

    /**
     * イベント配信システム初期化
     */
    initializeEventDelegation() {
        try {
            if (!this.canvasManager) {
                console.warn('⚠️ ToolManager: CanvasManager未接続 - イベント配信無効');
                return false;
            }

            console.log('🔄 ToolManager: イベント配信システム初期化完了');
            return true;

        } catch (error) {
            console.error('❌ ToolManager: イベント配信初期化エラー:', error);
            return false;
        }
    }

    /**
     * アクティブツール設定
     * @param {string} toolName - ツール名
     * @returns {boolean} 設定成功可否
     */
    setActiveTool(toolName) {
        try {
            if (!this.tools[toolName]) {
                console.error(`❌ ToolManager: ツール '${toolName}' が見つかりません`);
                return false;
            }

            // 現在のツールをリセット
            if (this.activeTool && typeof this.activeTool.reset === 'function') {
                this.activeTool.reset();
            }

            // 新しいツールを設定
            this.activeTool = this.tools[toolName];
            this.activeToolName = toolName;

            // ツール設定適用
            if (this.toolSettings[toolName] && typeof this.activeTool.updateSettings === 'function') {
                this.activeTool.updateSettings(this.toolSettings[toolName]);
            }

            console.log(`🎯 ToolManager: アクティブツール変更: ${toolName}`);

            // 状態通知
            window.EventBus?.emit('tool-changed', {
                toolName: toolName,
                tool: this.activeTool
            });

            return true;

        } catch (error) {
            console.error(`❌ ToolManager: ツール '${toolName}' 設定エラー:`, error);
            return false;
        }
    }

    /**
     * アクティブツールにイベント委譲
     * @param {string} method - 呼び出すメソッド名
     * @param {Event} event - イベントオブジェクト
     * @returns {boolean} 委譲成功可否
     */
    delegateToActiveTool(method, event) {
        try {
            if (!this.activeTool) {
                console.warn('⚠️ ToolManager: アクティブツールが設定されていません');
                return false;
            }

            if (typeof this.activeTool[method] !== 'function') {
                console.error(`❌ ToolManager: メソッド '${method}' が ${this.activeToolName} に存在しません`);
                return false;
            }

            // メソッド実行
            const result = this.activeTool[method](event);
            
            // 結果ログ
            if (result) {
                console.log(`🎯 ToolManager: ${this.activeToolName}.${method}() 実行成功`);
            } else {
                console.warn(`⚠️ ToolManager: ${this.activeToolName}.${method}() 実行失敗`);
            }

            return result;

        } catch (error) {
            console.error(`❌ ToolManager: ${method} 委譲エラー:`, error);
            return false;
        }
    }

    // === AppCore互換メソッド（エラー解決用） ===

    /**
     * 描画開始（onPointerDown委譲）
     * @param {Event} event - ポインターイベント
     * @returns {boolean} 開始成功可否
     */
    startDrawing(event) {
        return this.delegateToActiveTool('onPointerDown', event);
    }

    /**
     * 描画継続（onPointerMove委譲）
     * 🔧 ERROR_FIX: this.toolManager.continueDrawing is not a function 解決
     * @param {Event} event - ポインターイベント
     * @returns {boolean} 継続成功可否
     */
    continueDrawing(event) {
        return this.delegateToActiveTool('onPointerMove', event);
    }

    /**
     * 描画終了（onPointerUp委譲）
     * @param {Event} event - ポインターイベント
     * @returns {boolean} 終了成功可否
     */
    finishDrawing(event) {
        return this.delegateToActiveTool('onPointerUp', event);
    }

    // === ツール設定管理 ===

    /**
     * ツール設定更新
     * @param {string} toolName - ツール名
     * @param {Object} settings - 新しい設定
     * @returns {boolean} 更新成功可否
     */
    updateToolSettings(toolName, settings) {
        try {
            if (!this.toolSettings[toolName]) {
                this.toolSettings[toolName] = {};
            }

            // 設定マージ
            this.toolSettings[toolName] = { ...this.toolSettings[toolName], ...settings };

            // アクティブツールの場合は即座に適用
            if (toolName === this.activeToolName && this.activeTool && 
                typeof this.activeTool.updateSettings === 'function') {
                this.activeTool.updateSettings(this.toolSettings[toolName]);
            }

            console.log(`🔧 ToolManager: ${toolName} 設定更新完了`, this.toolSettings[toolName]);
            return true;

        } catch (error) {
            console.error(`❌ ToolManager: ${toolName} 設定更新エラー:`, error);
            return false;
        }
    }

    /**
     * ツール設定取得
     * @param {string} toolName - ツール名
     * @returns {Object} ツール設定
     */
    getToolSettings(toolName) {
        return this.toolSettings[toolName] || {};
    }

    // === 状態管理・情報取得 ===

    /**
     * 現在のツール状態取得
     * @returns {Object} ツール状態情報
     */
    getToolState() {
        const state = {
            activeToolName: this.activeToolName,
            isInitialized: this.isInitialized,
            availableTools: Object.keys(this.tools),
            canvasManagerConnected: !!this.canvasManager,
            coordinateManagerConnected: !!this.coordinateManager
        };

        // アクティブツールの詳細状態
        if (this.activeTool && typeof this.activeTool.getDrawingState === 'function') {
            state.activeToolState = this.activeTool.getDrawingState();
        }

        return state;
    }

    /**
     * ツールリスト取得
     * @returns {Array} 利用可能ツール名配列
     */
    getAvailableTools() {
        return Object.keys(this.tools);
    }

    /**
     * 現在のアクティブツール名取得
     * @returns {string} アクティブツール名
     */
    getActiveToolName() {
        return this.activeToolName;
    }

    /**
     * 全ツールリセット
     * @returns {boolean} リセット成功可否
     */
    resetAllTools() {
        try {
            let resetCount = 0;
            Object.values(this.tools).forEach(tool => {
                if (tool && typeof tool.reset === 'function') {
                    if (tool.reset()) {
                        resetCount++;
                    }
                }
            });

            console.log(`🔄 ToolManager: ${resetCount}個のツールをリセット完了`);
            return true;

        } catch (error) {
            console.error('❌ ToolManager: 全ツールリセットエラー:', error);
            return false;
        }
    }

    /**
     * ToolManager破棄
     */
    dispose() {
        try {
            // 全ツール破棄
            Object.values(this.tools).forEach(tool => {
                if (tool && typeof tool.dispose === 'function') {
                    tool.dispose();
                }
            });

            // 参照クリア
            this.tools = {};
            this.activeTool = null;
            this.canvasManager = null;
            this.coordinateManager = null;
            this.isInitialized = false;

            console.log('🗑️ ToolManager破棄完了');
            return true;

        } catch (error) {
            console.error('❌ ToolManager破棄エラー:', error);
            return false;
        }
    }
}

// グローバル登録
if (typeof window !== 'undefined') {
    window.ToolManager = ToolManager;
    console.log('🎯 ToolManager クラスをグローバルに登録完了');
} else {
    // Node.js環境対応
    module.exports = ToolManager;
}

// 初期化完了通知
console.log('🎯 ToolManager v1.0-Phase1.4-unified-control-enhanced 初期化完了');