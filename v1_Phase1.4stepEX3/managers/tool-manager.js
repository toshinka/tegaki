/**
 * 🎯 ToolManager - 統合制御・配信管理専門
 * 🔄 CORE_FUNCTION: ツール選択・イベント配信・統合制御
 * 📋 RESPONSIBILITY: 「ツール統合管理」の専門管理
 * 
 * 📏 DESIGN_PRINCIPLE: CanvasManager ← EventBus ← ToolManager → Tool
 * 🚫 PROHIBITION: 直接的な描画処理（Tool委譲必須）
 * ✅ PERMISSION: ツール管理・イベント配信・統合制御
 * 
 * 🔧 修正内容:
 * - デフォルトツール探索の複数名前空間対応
 * - ツール登録エラーハンドリング強化
 * - 初期化順序保証（CanvasManager依存解決）
 * - コンストラクタエラー完全対策
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
            currentTool: null,
            isActive: false,
            lastUsedTools: [],
            maxToolHistory: 5
        };
        
        // デフォルトツール設定（修正：クラス探索強化）
        this.defaultTools = [
            { 
                name: 'pen', 
                className: 'PenTool',
                searchPaths: ['window.PenTool', 'Tegaki.PenTool', 'window.Tegaki.PenTool']
            },
            { 
                name: 'eraser', 
                className: 'EraserTool',
                searchPaths: ['window.EraserTool', 'Tegaki.EraserTool', 'window.Tegaki.EraserTool']
            }
        ];
        
        // ✅ 統一システム依存（Phase1.4stepEX準拠）
        // この段階では直接参照、レジストリ初期化後はTegaki経由に変更予定
    }

    /**
     * ToolManagerを初期化（修正：エラーハンドリング強化）
     * @param {CanvasManager} canvasManager - CanvasManagerインスタンス
     * @param {CoordinateManager} coordinateManager - CoordinateManagerインスタンス
     * @returns {boolean}
     */
    initialize(canvasManager, coordinateManager) {
        try {
            if (this.isInitialized) {
                console.warn('[ToolManager] 既に初期化済みです');
                return true;
            }

            // 必須依存関係確認（修正：事前確認強化）
            if (!canvasManager) {
                throw new Error('CanvasManager が提供されていません');
            }
            
            if (!coordinateManager) {
                throw new Error('CoordinateManager が提供されていません');
            }

            this.canvasManager = canvasManager;
            this.coordinateManager = coordinateManager;
            
            // デフォルトツール登録（修正：エラー時継続実行）
            this._registerDefaultTools();
            
            // イベント配信システム設定
            this._setupEventDelegation();
            
            // 統一システム統合
            this._integrateWithUnifiedSystems();
            
            this.isInitialized = true;
            
            // 統一システム経由での通知
            const eventBus = Tegaki.EventBusInstance || window.EventBus;
            if (eventBus) {
                eventBus.emit('toolmanager:initialized', {
                    toolCount: this.tools.size,
                    activeTool: this.toolState.currentTool
                });
            }
            
            console.log(`[ToolManager] ✅ 初期化完了 - ${this.tools.size}個のツールが利用可能`);
            return true;
            
        } catch (error) {
            console.error('[ToolManager] ❌ 初期化エラー:', error);
            
            // ErrorManager経由でのエラーハンドリング
            const errorManager = Tegaki.ErrorManagerInstance || window.ErrorManager;
            if (errorManager) {
                errorManager.handleError?.(error, 'ToolManager.initialize', 'error', true);
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
            if (!name || !toolInstance) {
                throw new Error('ツール名またはインスタンスが無効です');
            }

            if (this.tools.has(name)) {
                console.log(`[ToolManager] Tool ${name} 既に登録済み`);
                return true;
            }

            // AbstractTool継承確認（修正：より詳細な検証）
            if (!this._validateToolInstance(toolInstance)) {
                throw new Error(`Tool ${name} は AbstractTool を継承している必要があります`);
            }

            this.tools.set(name, toolInstance);
            
            // ツール用レイヤー作成（修正：CanvasManager存在確認）
            if (this.canvasManager && typeof this.canvasManager.getLayerForTool === 'function') {
                try {
                    this.canvasManager.getLayerForTool(name);
                } catch (layerError) {
                    console.warn(`[ToolManager] レイヤー作成警告 (${name}):`, layerError.message);
                }
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

            console.log(`[ToolManager] ✅ ツール登録完了: ${name}`);
            return true;
            
        } catch (error) {
            console.error(`[ToolManager] ❌ ツール登録エラー (${name}):`, error);
            
            const errorManager = Tegaki.ErrorManagerInstance || window.ErrorManager;
            if (errorManager) {
                errorManager.handleError?.(error, 'ToolManager.registerTool');
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
                console.error(`[ToolManager] ツール切り替えエラー (${toolName}): Error: Tool ${toolName} not found`);
                throw new Error(`Tool ${toolName} not found`);
            }

            // 現在のツールを無効化
            if (this.activeTool && typeof this.activeTool.deactivate === 'function') {
                try {
                    this.activeTool.deactivate();
                } catch (deactivateError) {
                    console.warn(`[ToolManager] ツール無効化警告:`, deactivateError.message);
                }
            }

            // 新しいツールを有効化
            const newTool = this.tools.get(toolName);
            if (typeof newTool.activate === 'function') {
                try {
                    newTool.activate();
                } catch (activateError) {
                    console.warn(`[ToolManager] ツール有効化警告:`, activateError.message);
                }
            }
            
            // 状態更新
            const previousTool = this.toolState.currentTool;
            this.activeTool = newTool;
            this.toolState.currentTool = toolName;
            this.toolState.isActive = true;
            
            // ツール履歴更新
            this._updateToolHistory(toolName);
            
            // 統一システム経由での状態更新
            const stateManager = Tegaki.StateManagerInstance || window.StateManager;
            if (stateManager) {
                stateManager.set?.('tool.current', toolName);
                stateManager.set?.('tool.isActive', true);
            }
            
            const eventBus = Tegaki.EventBusInstance || window.EventBus;
            if (eventBus) {
                eventBus.emit('tool:changed', {
                    previousTool,
                    currentTool: toolName,
                    toolInstance: newTool
                });
            }

            console.log(`[ToolManager] ✅ ツール切り替え完了: ${toolName}`);
            return true;
            
        } catch (error) {
            console.error(`[ToolManager] ❌ ツール切り替えエラー (${toolName}):`, error.message);
            
            const errorManager = Tegaki.ErrorManagerInstance || window.ErrorManager;
            if (errorManager) {
                errorManager.handleError?.(error, 'ToolManager.setTool');
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
            console.error('[ToolManager] ❌ ツール委譲エラー:', error);
            
            const errorManager = Tegaki.ErrorManagerInstance || window.ErrorManager;
            if (errorManager) {
                errorManager.handleError?.(error, 'ToolManager.delegateToActiveTool');
            }
            
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
                    console.warn(`[ToolManager] 未知のイベントタイプ: ${eventType}`);
                    return null;
            }

            return this.delegateToActiveTool(methodName, event);
            
        } catch (error) {
            console.error('[ToolManager] ❌ ポインターイベント処理エラー:', error);
            
            const errorManager = Tegaki.ErrorManagerInstance || window.ErrorManager;
            if (errorManager) {
                errorManager.handleError?.(error, 'ToolManager.handlePointerEvent');
            }
            
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

            if (typeof tool.updateSetting === 'function') {
                tool.updateSetting(setting, value);
            } else if (typeof tool.updateSettings === 'function') {
                tool.updateSettings({ [setting]: value });
            } else {
                console.warn(`[ToolManager] Tool ${toolName} does not support setting updates`);
                return false;
            }
            
            // 統一システム経由での通知
            const eventBus = Tegaki.EventBusInstance || window.EventBus;
            if (eventBus) {
                eventBus.emit('tool:setting_updated', {
                    toolName,
                    setting,
                    value
                });
            }

            return true;
            
        } catch (error) {
            console.error('[ToolManager] ❌ ツール設定更新エラー:', error);
            
            const errorManager = Tegaki.ErrorManagerInstance || window.ErrorManager;
            if (errorManager) {
                errorManager.handleError?.(error, 'ToolManager.updateToolSetting');
            }
            
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
            console.error('[ToolManager] ❌ ツール設定取得エラー:', error);
            
            const errorManager = Tegaki.ErrorManagerInstance || window.ErrorManager;
            if (errorManager) {
                errorManager.handleError?.(error, 'ToolManager.getToolConfig');
            }
            
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
     * デフォルトツール登録（修正：複数名前空間対応・エラー継続）
     * @private
     */
    _registerDefaultTools() {
        console.log('[ToolManager] デフォルトツール登録開始...');
        
        let successCount = 0;
        let errorCount = 0;
        
        this.defaultTools.forEach((toolInfo, index) => {
            try {
                console.log(`[ToolManager] ツール探索中: ${toolInfo.name} (${toolInfo.className})`);
                
                // 修正：複数パスでクラス探索
                let ToolClass = null;
                let foundPath = null;
                
                // 1. 直接的な window 参照を試行
                ToolClass = window[toolInfo.className];
                if (ToolClass) {
                    foundPath = `window.${toolInfo.className}`;
                }
                
                // 2. Tegaki 名前空間を試行
                if (!ToolClass && window.Tegaki && window.Tegaki[toolInfo.className]) {
                    ToolClass = window.Tegaki[toolInfo.className];
                    foundPath = `Tegaki.${toolInfo.className}`;
                }
                
                // 3. カスタム検索パスを試行
                if (!ToolClass && toolInfo.searchPaths) {
                    for (const path of toolInfo.searchPaths) {
                        try {
                            const pathSegments = path.split('.');
                            let current = window;
                            
                            for (const segment of pathSegments) {
                                if (segment === 'window') continue;
                                current = current[segment];
                                if (!current) break;
                            }
                            
                            if (current && typeof current === 'function') {
                                ToolClass = current;
                                foundPath = path;
                                break;
                            }
                        } catch (pathError) {
                            // パス探索エラーは無視して次を試す
                        }
                    }
                }
                
                if (ToolClass) {
                    console.log(`[ToolManager] ツールクラス発見: ${foundPath}`);
                    
                    // 修正：コンストラクタエラー対策
                    let toolInstance = null;
                    try {
                        toolInstance = new ToolClass();
                    } catch (constructorError) {
                        console.error(`[ToolManager] デフォルトツール作成エラー (${toolInfo.name}):`, constructorError);
                        errorCount++;
                        return; // この項目はスキップして次へ
                    }
                    
                    const registerResult = this.registerTool(toolInfo.name, toolInstance);
                    if (registerResult) {
                        successCount++;
                        console.log(`[ToolManager] ✅ デフォルトツール作成成功: ${toolInfo.name}`);
                    } else {
                        errorCount++;
                        console.warn(`[ToolManager] ⚠️ デフォルトツール登録失敗: ${toolInfo.name}`);
                    }
                } else {
                    console.warn(`[ToolManager] ⚠️ デフォルトツールクラス未発見: ${toolInfo.className}`);
                    console.log(`[ToolManager] 探索パス:`, toolInfo.searchPaths || [`window.${toolInfo.className}`, `Tegaki.${toolInfo.className}`]);
                    errorCount++;
                }
                
            } catch (error) {
                console.error(`[ToolManager] ❌ デフォルトツール処理エラー (${toolInfo.name}):`, error);
                errorCount++;
            }
        });
        
        console.log(`[ToolManager] デフォルトツール登録完了: ${successCount}個成功, ${errorCount}個失敗`);
        
        // 登録されたツールの確認
        if (this.tools.size > 0) {
            console.log('[ToolManager] 登録済みツール:', Array.from(this.tools.keys()));
        } else {
            console.warn('[ToolManager] ⚠️ 登録されたツールがありません');
        }
    }

    /**
     * イベント配信システム設定
     * @private
     */
    _setupEventDelegation() {
        try {
            // EventBus経由での配信設定
            const eventBus = Tegaki.EventBusInstance || window.EventBus;
            if (!eventBus) {
                console.warn('[ToolManager] EventBus が利用できません');
                return;
            }

            // CanvasManagerからのイベント受信
            const eventMappings = [
                { event: 'canvas:pointerdown', handler: (event) => this.handlePointerEvent(event, 'pointerdown') },
                { event: 'canvas:pointermove', handler: (event) => this.handlePointerEvent(event, 'pointermove') },
                { event: 'canvas:pointerup', handler: (event) => this.handlePointerEvent(event, 'pointerup') },
                { event: 'canvas:pointercancel', handler: (event) => this.handlePointerEvent(event, 'pointercancel') }
            ];

            eventMappings.forEach(({ event, handler }) => {
                if (typeof eventBus.on === 'function') {
                    eventBus.on(event, handler);
                }
            });

            console.log('[ToolManager] ✅ イベント配信システム設定完了');
            
        } catch (error) {
            console.error('[ToolManager] ❌ イベント配信システム設定エラー:', error);
        }
    }

    /**
     * 統一システム統合
     * @private
     */
    _integrateWithUnifiedSystems() {
        try {
            // 初期状態設定
            const stateManager = Tegaki.StateManagerInstance || window.StateManager;
            if (stateManager) {
                stateManager.set?.('tool.current', null);
                stateManager.set?.('tool.isActive', false);
                stateManager.set?.('tool.availableTools', this.getAvailableTools());
            }
            
            console.log('[ToolManager] ✅ 統一システム統合完了');
            
        } catch (error) {
            console.error('[ToolManager] ❌ 統一システム統合エラー:', error);
        }
    }

    /**
     * ツールインスタンス検証（修正：より詳細な検証）
     * @private
     */
    _validateToolInstance(toolInstance) {
        try {
            // AbstractTool必須メソッドの確認
            const requiredMethods = [
                'onPointerDown',
                'onPointerMove', 
                'onPointerUp',
                'activate',
                'deactivate'
            ];

            const missingMethods = requiredMethods.filter(method => 
                typeof toolInstance[method] !== 'function'
            );

            if (missingMethods.length > 0) {
                console.error('[ToolManager] ツール検証失敗 - 不足メソッド:', missingMethods);
                return false;
            }

            return true;
            
        } catch (error) {
            console.error('[ToolManager] ❌ ツール検証エラー:', error);
            return false;
        }
    }

    /**
     * ツールとCanvasManager統合
     * @private
     */
    _integrateToolWithCanvas(toolName, toolInstance) {
        try {
            // ツール用Graphics作成・接続
            if (this.canvasManager && typeof toolInstance.attachToCanvas === 'function') {
                try {
                    const layer = this.canvasManager.getLayerForTool(toolName);
                    toolInstance.attachToCanvas(this.canvasManager, layer);
                    console.log(`[ToolManager] ✅ ${toolName} キャンバス統合完了`);
                } catch (error) {
                    console.warn(`[ToolManager] ⚠️ ${toolName} キャンバス統合警告:`, error.message);
                }
            }
        } catch (error) {
            console.error(`[ToolManager] ❌ ツールキャンバス統合エラー (${toolName}):`, error);
        }
    }

    /**
     * ツール履歴更新
     * @private
     */
    _updateToolHistory(toolName) {
        try {
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
        } catch (error) {
            console.error('[ToolManager] ❌ ツール履歴更新エラー:', error);
        }
    }

    /**
     * CanvasManager接続設定
     * @param {CanvasManager} canvasManager - CanvasManagerインスタンス
     */
    setCanvasManager(canvasManager) {
        this.canvasManager = canvasManager;
        console.log('[ToolManager] ✅ CanvasManager接続確立');
    }

    /**
     * CoordinateManager接続設定
     * @param {CoordinateManager} coordinateManager - CoordinateManagerインスタンス
     */
    setCoordinateManager(coordinateManager) {
        this.coordinateManager = coordinateManager;
        console.log('[ToolManager] ✅ CoordinateManager接続確立');
    }

    /**
     * Tool-Canvas統合初期化
     */
    initializeToolCanvasIntegration() {
        try {
            if (!this.canvasManager) {
                console.warn('[ToolManager] CanvasManager が統合に利用できません');
                return;
            }

            // 全登録ツールとCanvasManager統合
            this.tools.forEach((tool, toolName) => {
                this._integrateToolWithCanvas(toolName, tool);
            });

            console.log('[ToolManager] ✅ Tool-Canvas統合完了');
            
        } catch (error) {
            console.error('[ToolManager] ❌ Tool-Canvas統合エラー:', error);
        }
    }

    /**
     * ツール用Graphics作成
     * @param {string} toolName - ツール名
     * @returns {PIXI.Graphics|null}
     */
    createToolGraphics(toolName) {
        try {
            if (!this.canvasManager) {
                console.warn('[ToolManager] CanvasManager が利用できません');
                return null;
            }

            if (typeof PIXI === 'undefined' || !PIXI.Graphics) {
                console.warn('[ToolManager] PIXI.Graphics が利用できません');
                return null;
            }

            const layer = this.canvasManager.getLayerForTool(toolName);
            const graphics = new PIXI.Graphics();
            
            if (layer && typeof layer.addChild === 'function') {
                layer.addChild(graphics);
            }

            return graphics;
            
        } catch (error) {
            console.error('[ToolManager] ❌ ツール用Graphics作成エラー:', error);
            return null;
        }
    }

    /**
     * デバッグ情報取得
     * @returns {object}
     */
    getDebugInfo() {
        return {
            isInitialized: this.isInitialized,
            toolCount: this.tools.size,
            availableTools: this.getAvailableTools(),
            currentTool: this.toolState.currentTool,
            isActive: this.toolState.isActive,
            canvasManagerReady: !!this.canvasManager,
            coordinateManagerReady: !!this.coordinateManager,
            toolHistory: [...this.toolState.lastUsedTools]
        };
    }
}

// Tegaki名前空間に登録（Phase1.4stepEX準拠）
Tegaki.ToolManager = ToolManager;

// 初期化レジストリ方式（Phase1.4stepEX準拠）
Tegaki._registry = Tegaki._registry || [];
Tegaki._registry.push(() => {
    Tegaki.ToolManagerInstance = new ToolManager();
    console.log('[ToolManager] ✅ Tegaki名前空間に登録完了');
});

// 🔄 PixiJS v8対応準備コメント
// - イベント配信システムは変更不要
// - Graphics生成部分のAPI更新対応準備済み
// - モジュール化対応設計採用

console.log('[ToolManager] ✅ 読み込み完了（修正版）- レジストリ初期化待機中');