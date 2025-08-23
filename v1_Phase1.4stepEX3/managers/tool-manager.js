/**
 * 🎯 ToolManager - 統合制御・配信管理専門 (修正版)
 * 🔄 CORE_FUNCTION: ツール選択・イベント配信・統合制御
 * 📋 RESPONSIBILITY: 「ツール統合管理」の専門管理
 * 
 * 📏 DESIGN_PRINCIPLE: CanvasManager ← EventBus ← ToolManager → Tool
 * 🚫 PROHIBITION: 直接的な描画処理（Tool委譲必須）
 * ✅ PERMISSION: ツール管理・イベント配信・統合制御
 * 
 * 🔧 修正内容:
 * - Tegaki名前空間からのツール検索追加
 * - window/Tegakiブリッジ対応
 * - 初期化順序修正
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
        
        // 🔧 修正1: デフォルトツール設定（Tegaki名前空間対応）
        this.defaultTools = [
            { name: 'pen', className: 'PenTool' },
            { name: 'eraser', className: 'EraserTool' }
        ];
        
        console.log('[ToolManager] Constructor completed');
    }

    /**
     * ToolManagerを初期化
     * @param {CanvasManager} canvasManager - CanvasManagerインスタンス
     * @param {CoordinateManager} coordinateManager - CoordinateManagerインスタンス
     * @returns {boolean}
     */
    initialize(canvasManager, coordinateManager) {
        try {
            console.log('[ToolManager] Initialize開始...');
            
            if (this.isInitialized) {
                console.warn('[ToolManager] 既に初期化済みです');
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
            const eventBus = Tegaki.EventBusInstance || window.EventBus;
            if (eventBus) {
                eventBus.emit('toolmanager:initialized', {
                    toolCount: this.tools.size,
                    activeTool: this.toolState.currentTool
                });
            }
            
            console.log('[ToolManager] 初期化完了 - Tool integration ready');
            return true;
        } catch (error) {
            console.error('[ToolManager] 初期化エラー:', error);
            const errorManager = Tegaki.ErrorManagerInstance || window.ErrorManager;
            if (errorManager) {
                errorManager.handle(error, 'ToolManager.initialize');
            }
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
                console.warn(`[ToolManager] Tool ${name} 既に登録済み`);
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
            const eventBus = Tegaki.EventBusInstance || window.EventBus;
            if (eventBus) {
                eventBus.emit('tool:registered', {
                    toolName: name,
                    toolType: toolInstance.constructor.name
                });
            }

            console.log(`[ToolManager] Tool registered: ${name}`);
            return true;
        } catch (error) {
            console.error(`[ToolManager] ツール登録エラー (${name}):`, error);
            const errorManager = Tegaki.ErrorManagerInstance || window.ErrorManager;
            if (errorManager) {
                errorManager.handle(error, 'ToolManager.registerTool');
            }
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
            const stateManager = Tegaki.StateManagerInstance || window.StateManager;
            if (stateManager) {
                stateManager.set('tool.current', toolName);
                stateManager.set('tool.isActive', true);
            }
            
            const eventBus = Tegaki.EventBusInstance || window.EventBus;
            if (eventBus) {
                eventBus.emit('tool:changed', {
                    previousTool: this.toolState.lastUsedTools[0] || null,
                    currentTool: toolName,
                    toolInstance: newTool
                });
            }

            console.log(`[ToolManager] Tool changed to: ${toolName}`);
            return true;
        } catch (error) {
            console.error(`[ToolManager] ツール切り替えエラー (${toolName}):`, error);
            const errorManager = Tegaki.ErrorManagerInstance || window.ErrorManager;
            if (errorManager) {
                errorManager.handle(error, 'ToolManager.setTool');
            }
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
                console.warn('[ToolManager] アクティブツールがありません');
                return null;
            }

            if (typeof this.activeTool[method] !== 'function') {
                throw new Error(`Method ${method} not found in active tool`);
            }

            // Tool側に完全委譲（座標処理含む）
            const result = this.activeTool[method](event, this.canvasManager, this.coordinateManager);
            
            // 統一システム経由での処理通知
            const eventBus = Tegaki.EventBusInstance || window.EventBus;
            if (eventBus) {
                eventBus.emit('tool:method_delegated', {
                    toolName: this.toolState.currentTool,
                    method,
                    eventType: event?.type
                });
            }

            return result;
        } catch (error) {
            console.error(`[ToolManager] ツールメソッド委譲エラー (${method}):`, error);
            const errorManager = Tegaki.ErrorManagerInstance || window.ErrorManager;
            if (errorManager) {
                errorManager.handle(error, 'ToolManager.delegateToActiveTool');
            }
            return null;
        }
    }

    /**
     * 登録済みツール一覧取得
     * @returns {Array<string>}
     */
    getAvailableTools() {
        return Array.from(this.tools.keys());
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

    // ========================================
    // 内部メソッド（統合制御専門）
    // ========================================

    /**
     * 🔧 修正2: デフォルトツール登録（Tegaki名前空間対応）
     * @private
     */
    _registerDefaultTools() {
        console.log('[ToolManager] デフォルトツール登録開始...');
        
        this.defaultTools.forEach(toolInfo => {
            // 🔧 修正: window.* が無ければ Tegaki.* を探す
            const ToolClass = 
                window[toolInfo.className] ||
                (window.Tegaki && window.Tegaki[toolInfo.className]);

            if (ToolClass) {
                try {
                    const toolInstance = new ToolClass();
                    this.registerTool(toolInfo.name, toolInstance);
                    console.log(`[ToolManager] デフォルトツール登録成功: ${toolInfo.name}`);
                } catch (error) {
                    console.error(`[ToolManager] デフォルトツール作成エラー (${toolInfo.name}):`, error);
                }
            } else {
                console.warn(`[ToolManager] Default tool class not found: ${toolInfo.className}`);
            }
        });
        
        console.log(`[ToolManager] デフォルトツール登録完了 (${this.tools.size}個)`);
    }

    /**
     * イベント配信システム設定
     * @private
     */
    _setupEventDelegation() {
        // EventBus経由での配信設定
        const eventBus = Tegaki.EventBusInstance || window.EventBus;
        if (eventBus) {
            // CanvasManagerからのイベント受信
            eventBus.on('canvas:pointerdown', (event) => {
                this.handlePointerEvent(event, 'pointerdown');
            });

            eventBus.on('canvas:pointermove', (event) => {
                this.handlePointerEvent(event, 'pointermove');
            });

            eventBus.on('canvas:pointerup', (event) => {
                this.handlePointerEvent(event, 'pointerup');
            });

            eventBus.on('canvas:pointercancel', (event) => {
                this.handlePointerEvent(event, 'pointercancel');
            });
            
            console.log('[ToolManager] Event delegation system configured');
        } else {
            console.warn('[ToolManager] EventBus not available for delegation');
        }
    }

    /**
     * 統一システム統合
     * @private
     */
    _integrateWithUnifiedSystems() {
        // 初期状態設定
        const stateManager = Tegaki.StateManagerInstance || window.StateManager;
        if (stateManager) {
            stateManager.set('tool.current', null);
            stateManager.set('tool.isActive', false);
            stateManager.set('tool.availableTools', this.getAvailableTools());
        }
    }

    /**
     * 初期ツール設定
     * @private
     */
    _setInitialTool() {
        const configManager = Tegaki.ConfigManagerInstance || window.ConfigManager;
        const defaultTool = configManager?.get('tool.default') || 'pen';
        
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
                console.warn(`[ToolManager] ${toolName} とCanvas統合失敗:`, error.message);
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
            console.error(`[ToolManager] ポインターイベント処理エラー (${eventType}):`, error);
            const errorManager = Tegaki.ErrorManagerInstance || window.ErrorManager;
            if (errorManager) {
                errorManager.handle(error, 'ToolManager.handlePointerEvent');
            }
            return null;
        }
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

console.log('[ToolManager] Loaded and ready for registry initialization (修正版)');