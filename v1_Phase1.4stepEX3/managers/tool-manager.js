/**
 * 🎯 ToolManager - 統合制御・配信管理専門
 * 🔄 CORE_FUNCTION: ツール選択・イベント配信・統合制御
 * 📋 RESPONSIBILITY: 「ツール統合管理」の専門管理
 * 
 * 📏 DESIGN_PRINCIPLE: CanvasManager ← EventBus ← ToolManager → Tool
 * 🚫 PROHIBITION: 直接的な描画処理（Tool委譲必須）
 * ✅ PERMISSION: ツール管理・イベント配信・統合制御
 * 
 * 座標バグ修正における役割:
 * - イベント配信の統一窓口として機能
 * - 座標処理はTool側に完全委譲
 * - CanvasManagerとToolの仲介役に徹する
 */

// Tegaki名前空間初期化（Phase1.4stepEX準拠）
window.Tegaki = window.Tegaki || {};

class ToolManager {
    constructor() {
        this.tools = new Map();
        this.activeTool = null;
        this.canvasManager = null;
        this.coordinateManager = null;
        this.isInitialized = false;
        
        // ツール状態管理
        this.toolState = {
            currentTool: 'pen',
            isActive: false,
            lastUsedTools: [],
            maxToolHistory: 5
        };
        
        // デフォルトツール設定
        this.defaultTools = [
            { name: 'pen', className: 'PenTool' },
            { name: 'eraser', className: 'EraserTool' }
        ];
        
        // ✅ 統一システム依存（Phase1.4stepEX準拠）
        // この段階では直接参照、レジストリ初期化後はTegaki経由に変更予定
    }

    /**
     * ToolManagerを初期化
     * @param {CanvasManager} canvasManager - CanvasManagerインスタンス
     * @param {CoordinateManager} coordinateManager - CoordinateManagerインスタンス
     * @returns {boolean}
     */
    initialize(canvasManager, coordinateManager) {
        try {
            if (this.isInitialized) {
                window.ErrorManager?.warn('ToolManager already initialized', 'ToolManager.initialize');
                return true;
            }

            this.canvasManager = canvasManager;
            this.coordinateManager = coordinateManager;
            
            // デフォルトツール登録
            this._registerDefaultTools();
            
            // イベント配信システム設定
            this._setupEventDelegation();
            
            // 統一システム統合
            this._integrateWithUnifiedSystems();
            
            // 初期ツール設定
            this._setInitialTool();
            
            this.isInitialized = true;
            
            // 統一システム経由での通知
            if (window.EventBus) {
                window.EventBus.emit('toolmanager:initialized', {
                    toolCount: this.tools.size,
                    activeTool: this.toolState.currentTool
                });
            }
            
            console.log('[ToolManager] Successfully initialized - Tool integration ready');
            return true;
        } catch (error) {
            window.ErrorManager?.handleError(error, 'ToolManager.initialize', 'error', true);
            return false;
        }
    }

    /**
     * ツール登録（統合制御の主責務）
     * @param {string} name - ツール名
     * @param {AbstractTool} toolInstance - ツールインスタンス
     * @returns {boolean}
     */
    registerTool(name, toolInstance) {
        try {
            if (this.tools.has(name)) {
                window.ErrorManager?.warn(`Tool ${name} already registered`, 'ToolManager.registerTool');
                return true;
            }

            // AbstractTool継承確認
            if (!this._validateToolInstance(toolInstance)) {
                throw new Error(`Tool ${name} must extend AbstractTool`);
            }

            this.tools.set(name, toolInstance);
            
            // ツール用レイヤー作成
            if (this.canvasManager) {
                this.canvasManager.getLayerForTool(name);
            }
            
            // ツールとCanvasManager統合
            this._integrateToolWithCanvas(name, toolInstance);
            
            // 統一システム経由での通知
            if (window.EventBus) {
                window.EventBus.emit('tool:registered', {
                    toolName: name,
                    toolType: toolInstance.constructor.name
                });
            }

            console.log(`[ToolManager] Tool registered: ${name}`);
            return true;
        } catch (error) {
            window.ErrorManager?.handleError(error, 'ToolManager.registerTool');
            return false;
        }
    }

    /**
     * ツール切り替え（統合制御の主責務）
     * @param {string} toolName - 切り替え先ツール名
     * @returns {boolean}
     */
    setTool(toolName) {
        try {
            if (!this.tools.has(toolName)) {
                throw new Error(`Tool ${toolName} not found`);
            }

            // 現在のツールを無効化
            if (this.activeTool) {
                this.activeTool.deactivate();
            }

            // 新しいツールを有効化
            const newTool = this.tools.get(toolName);
            newTool.activate();
            
            // 状態更新
            this.activeTool = newTool;
            this.toolState.currentTool = toolName;
            this.toolState.isActive = true;
            
            // ツール履歴更新
            this._updateToolHistory(toolName);
            
            // 統一システム経由での状態更新
            if (window.StateManager) {
                window.StateManager.set('tool.current', toolName);
                window.StateManager.set('tool.isActive', true);
            }
            
            if (window.EventBus) {
                window.EventBus.emit('tool:changed', {
                    previousTool: this.toolState.lastUsedTools[0] || null,
                    currentTool: toolName,
                    toolInstance: newTool
                });
            }

            console.log(`[ToolManager] Tool changed to: ${toolName}`);
            return true;
        } catch (error) {
            window.ErrorManager?.handleError(error, 'ToolManager.setTool');
            return false;
        }
    }

    /**
     * アクティブツールに処理を委譲（配信管理の主責務）
     * @param {string} method - 実行メソッド名
     * @param {object} event - イベントオブジェクト
     * @returns {*} ツールの戻り値
     */
    delegateToActiveTool(method, event) {
        try {
            if (!this.activeTool) {
                console.warn('[ToolManager] No active tool for delegation');
                return null;
            }

            if (typeof this.activeTool[method] !== 'function') {
                throw new Error(`Method ${method} not found in active tool`);
            }

            // Tool側に完全委譲（座標処理含む）
            const result = this.activeTool[method](event, this.canvasManager, this.coordinateManager);
            
            // 統一システム経由での処理通知
            if (window.EventBus) {
                window.EventBus.emit('tool:method_delegated', {
                    toolName: this.toolState.currentTool,
                    method,
                    eventType: event?.type
                });
            }

            return result;
        } catch (error) {
            window.ErrorManager?.handleError(error, 'ToolManager.delegateToActiveTool');
            return null;
        }
    }

    /**
     * ポインターイベント処理（統合イベント配信）
     * @param {PointerEvent} event - ポインターイベント
     * @param {string} eventType - イベントタイプ
     * @returns {*}
     */
    handlePointerEvent(event, eventType) {
        try {
            let methodName;
            
            switch (eventType) {
                case 'pointerdown':
                    methodName = 'onPointerDown';
                    break;
                case 'pointermove':
                    methodName = 'onPointerMove';
                    break;
                case 'pointerup':
                    methodName = 'onPointerUp';
                    break;
                case 'pointercancel':
                    methodName = 'onPointerCancel';
                    break;
                default:
                    console.warn(`[ToolManager] Unknown event type: ${eventType}`);
                    return null;
            }

            return this.delegateToActiveTool(methodName, event);
        } catch (error) {
            window.ErrorManager?.handleError(error, 'ToolManager.handlePointerEvent');
            return null;
        }
    }

    /**
     * 現在のツールを取得
     * @returns {AbstractTool|null}
     */
    getCurrentTool() {
        return this.activeTool;
    }

    /**
     * 現在のツール名を取得
     * @returns {string|null}
     */
    getCurrentToolName() {
        return this.toolState.currentTool;
    }

    /**
     * ツール利用可能性確認
     * @param {string} toolName - ツール名
     * @returns {boolean}
     */
    isToolAvailable(toolName) {
        return this.tools.has(toolName);
    }

    /**
     * 登録済みツール一覧取得
     * @returns {Array<string>}
     */
    getAvailableTools() {
        return Array.from(this.tools.keys());
    }

    /**
     * ツール設定更新
     * @param {string} toolName - ツール名
     * @param {string} setting - 設定項目名
     * @param {*} value - 設定値
     * @returns {boolean}
     */
    updateToolSetting(toolName, setting, value) {
        try {
            const tool = this.tools.get(toolName);
            if (!tool) {
                throw new Error(`Tool ${toolName} not found`);
            }

            if (typeof tool.updateSetting !== 'function') {
                throw new Error(`Tool ${toolName} does not support setting updates`);
            }

            tool.updateSetting(setting, value);
            
            // 統一システム経由での通知
            if (window.EventBus) {
                window.EventBus.emit('tool:setting_updated', {
                    toolName,
                    setting,
                    value
                });
            }

            return true;
        } catch (error) {
            window.ErrorManager?.handleError(error, 'ToolManager.updateToolSetting');
            return false;
        }
    }

    /**
     * ツール設定取得
     * @param {string} toolName - ツール名
     * @returns {object|null}
     */
    getToolConfig(toolName) {
        try {
            const tool = this.tools.get(toolName);
            if (!tool) {
                return null;
            }

            if (typeof tool.getSettings === 'function') {
                return tool.getSettings();
            }

            return null;
        } catch (error) {
            window.ErrorManager?.handleError(error, 'ToolManager.getToolConfig');
            return null;
        }
    }

    /**
     * ツール統計情報取得
     * @returns {object}
     */
    getToolStats() {
        return {
            registeredTools: this.tools.size,
            availableTools: this.getAvailableTools(),
            currentTool: this.toolState.currentTool,
            isActive: this.toolState.isActive,
            toolHistory: [...this.toolState.lastUsedTools]
        };
    }

    // ========================================
    // 内部メソッド（統合制御専門）
    // ========================================

    /**
     * デフォルトツール登録
     * @private
     */
    _registerDefaultTools() {
        this.defaultTools.forEach(toolInfo => {
            const ToolClass = window[toolInfo.className];
            if (ToolClass) {
                const toolInstance = new ToolClass();
                this.registerTool(toolInfo.name, toolInstance);
            } else {
                console.warn(`[ToolManager] Default tool class not found: ${toolInfo.className}`);
            }
        });
    }

    /**
     * イベント配信システム設定
     * @private
     */
    _setupEventDelegation() {
        // EventBus経由での配信設定
        if (window.EventBus) {
            // CanvasManagerからのイベント受信
            window.EventBus.on('canvas:pointerdown', (event) => {
                this.handlePointerEvent(event, 'pointerdown');
            });

            window.EventBus.on('canvas:pointermove', (event) => {
                this.handlePointerEvent(event, 'pointermove');
            });

            window.EventBus.on('canvas:pointerup', (event) => {
                this.handlePointerEvent(event, 'pointerup');
            });

            window.EventBus.on('canvas:pointercancel', (event) => {
                this.handlePointerEvent(event, 'pointercancel');
            });
        }

        console.log('[ToolManager] Event delegation system configured');
    }

    /**
     * 統一システム統合
     * @private
     */
    _integrateWithUnifiedSystems() {
        // 初期状態設定
        if (window.StateManager) {
            window.StateManager.set('tool.current', null);
            window.StateManager.set('tool.isActive', false);
            window.StateManager.set('tool.availableTools', this.getAvailableTools());
        }
    }

    /**
     * 初期ツール設定
     * @private
     */
    _setInitialTool() {
        const defaultTool = window.ConfigManager?.get('tool.default', 'pen');
        if (this.tools.has(defaultTool)) {
            this.setTool(defaultTool);
        } else if (this.tools.size > 0) {
            const firstTool = this.tools.keys().next().value;
            this.setTool(firstTool);
        }
    }

    /**
     * ツールインスタンス検証
     * @private
     */
    _validateToolInstance(toolInstance) {
        // AbstractTool必須メソッドの確認
        const requiredMethods = [
            'onPointerDown',
            'onPointerMove', 
            'onPointerUp',
            'activate',
            'deactivate'
        ];

        return requiredMethods.every(method => 
            typeof toolInstance[method] === 'function'
        );
    }

    /**
     * ツールとCanvasManager統合
     * @private
     */
    _integrateToolWithCanvas(toolName, toolInstance) {
        // ツール用Graphics作成・接続
        if (this.canvasManager && typeof toolInstance.attachToCanvas === 'function') {
            try {
                const layer = this.canvasManager.getLayerForTool(toolName);
                toolInstance.attachToCanvas(this.canvasManager, layer);
            } catch (error) {
                console.warn(`[ToolManager] Failed to integrate ${toolName} with canvas:`, error.message);
            }
        }
    }

    /**
     * ツール履歴更新
     * @private
     */
    _updateToolHistory(toolName) {
        // 重複削除
        const index = this.toolState.lastUsedTools.indexOf(toolName);
        if (index > -1) {
            this.toolState.lastUsedTools.splice(index, 1);
        }

        // 先頭に追加
        this.toolState.lastUsedTools.unshift(toolName);

        // 履歴サイズ制限
        if (this.toolState.lastUsedTools.length > this.toolState.maxToolHistory) {
            this.toolState.lastUsedTools.pop();
        }
    }

    /**
     * CanvasManager接続設定
     * @param {CanvasManager} canvasManager - CanvasManagerインスタンス
     */
    setCanvasManager(canvasManager) {
        this.canvasManager = canvasManager;
        console.log('[ToolManager] CanvasManager connection established');
    }

    /**
     * CoordinateManager接続設定
     * @param {CoordinateManager} coordinateManager - CoordinateManagerインスタンス
     */
    setCoordinateManager(coordinateManager) {
        this.coordinateManager = coordinateManager;
        console.log('[ToolManager] CoordinateManager connection established');
    }

    /**
     * Tool-Canvas統合初期化
     */
    initializeToolCanvasIntegration() {
        if (!this.canvasManager) {
            console.warn('[ToolManager] CanvasManager not available for integration');
            return;
        }

        // 全登録ツールとCanvasManager統合
        this.tools.forEach((tool, toolName) => {
            this._integrateToolWithCanvas(toolName, tool);
        });

        console.log('[ToolManager] Tool-Canvas integration completed');
    }

    /**
     * ツール用Graphics作成
     * @param {string} toolName - ツール名
     * @returns {PIXI.Graphics|null}
     */
    createToolGraphics(toolName) {
        if (!this.canvasManager) {
            return null;
        }

        const layer = this.canvasManager.getLayerForTool(toolName);
        const graphics = new PIXI.Graphics();
        
        if (layer) {
            layer.addChild(graphics);
        }

        return graphics;
    }
}

// Tegaki名前空間に登録（Phase1.4stepEX準拠）
Tegaki.ToolManager = ToolManager;

// 初期化レジストリ方式（Phase1.4stepEX準拠）
Tegaki._registry = Tegaki._registry || [];
Tegaki._registry.push(() => {
    Tegaki.ToolManagerInstance = new ToolManager();
    console.log('[ToolManager] Registered to Tegaki namespace');
});

// 🔄 PixiJS v8対応準備コメント
// - イベント配信システムは変更不要
// - Graphics生成部分のAPI更新対応準備済み
// - モジュール化対応設計採用

console.log('[ToolManager] Loaded and ready for registry initialization');