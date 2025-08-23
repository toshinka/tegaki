/**
 * 🎯 ToolManager - 統合制御・配信管理専門
 * 🔄 CORE_FUNCTION: ツール選択・イベント配信・統合制御
 * 📋 RESPONSIBILITY: 「ツール統合管理」の専門管理
 * 🚨 v12修正: エラーハンドリング強化・ツール登録エラー対策
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
        
        // 🚨 v12修正: デフォルトツール設定の安全化
        this.defaultTools = [
            { name: 'pen', className: 'PenTool', instancePath: 'Tegaki.PenToolInstance' },
            { name: 'eraser', className: 'EraserTool', instancePath: 'Tegaki.EraserToolInstance' }
        ];
        
        // ツール登録統計
        this.registrationStats = {
            attempted: 0,
            successful: 0,
            failed: 0,
            errors: []
        };
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
            toolHistory: [...this.toolState.lastUsedTools],
            registrationStats: { ...this.registrationStats }
        };
    }

    // ========================================
    // 内部メソッド（統合制御専門）
    // ========================================

    /**
     * デフォルトツール登録
     * 🚨 v12修正: エラーハンドリング強化・インスタンス解決改善
     * @private
     */
    _registerDefaultTools() {
        console.log('[ToolManager] Registering default tools...');
        
        this.defaultTools.forEach(toolInfo => {
            try {
                console.log(`[ToolManager] Attempting to register ${toolInfo.name}...`);
                
                // インスタンス取得方法の改善
                let toolInstance = null;
                
                // 1. Tegakiインスタンスパスから取得を試行
                if (toolInfo.instancePath) {
                    toolInstance = this._getInstanceByPath(toolInfo.instancePath);
                    if (toolInstance) {
                        console.log(`[ToolManager] Found ${toolInfo.name} via instance path: ${toolInfo.instancePath}`);
                    }
                }
                
                // 2. クラス名からコンストラクタ取得を試行
                if (!toolInstance && toolInfo.className) {
                    const ToolClass = this._getClassByName(toolInfo.className);
                    if (ToolClass) {
                        try {
                            toolInstance = new ToolClass();
                            console.log(`[ToolManager] Created ${toolInfo.name} via constructor: ${toolInfo.className}`);
                        } catch (constructorError) {
                            console.error(`[ToolManager] デフォルトツール作成エラー (${toolInfo.name}):`, constructorError);
                        }
                    }
                }
                
                // 3. 登録実行
                if (toolInstance) {
                    this.registerTool(toolInfo.name, toolInstance);
                } else {
                    console.warn(`[ToolManager] デフォルトツール ${toolInfo.name} のインスタンスが見つかりません`);
                    this.registrationStats.failed++;
                    this.registrationStats.errors.push({
                        toolName: toolInfo.name,
                        error: 'Instance not found',
                        timestamp: new Date().toISOString()
                    });
                }
                
            } catch (error) {
                console.error(`[ToolManager] デフォルトツール登録エラー (${toolInfo.name}):`, error);
                this.registrationStats.failed++;
                this.registrationStats.errors.push({
                    toolName: toolInfo.name,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        });
        
        console.log(`[ToolManager] Default tool registration completed. Success: ${this.registrationStats.successful}, Failed: ${this.registrationStats.failed}`);
    }

    /**
     * イベント配信システム設定
     * @private
     */
    _setupEventDelegation() {
        // EventBus経由での配信設定
        if (this._getEventBus()) {
            const eventBus = this._getEventBus();
            
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
        }

        console.log('[ToolManager] Event delegation system configured');
    }

    /**
     * 統一システム統合
     * @private
     */
    _integrateWithUnifiedSystems() {
        // 初期状態設定
        this._updateState('tool.current', null);
        this._updateState('tool.isActive', false);
        this._updateState('tool.availableTools', this.getAvailableTools());
    }

    /**
     * 初期ツール設定
     * @private
     */
    _setInitialTool() {
        const configManager = this._getConfigManager();
        const defaultTool = configManager ? configManager.get('tool.default', 'pen') : 'pen';
        
        if (this.tools.has(defaultTool)) {
            this.setTool(defaultTool);
        } else if (this.tools.size > 0) {
            const firstTool = this.tools.keys().next().value;
            this.setTool(firstTool);
        } else {
            console.warn('[ToolManager] No tools available for initial selection');
        }
    }

    /**
     * ツールインスタンス検証
     * 🚨 v12修正: 検証強化・null/undefined対応
     * @private
     */
    _validateToolInstance(toolInstance, toolName = 'unknown') {
        try {
            // null/undefined チェック
            if (!toolInstance) {
                console.error(`[ToolManager] Tool instance is null/undefined: ${toolName}`);
                return false;
            }

            // オブジェクト型チェック
            if (typeof toolInstance !== 'object') {
                console.error(`[ToolManager] Tool instance is not an object: ${toolName} (type: ${typeof toolInstance})`);
                return false;
            }

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
                console.error(`[ToolManager] Tool ${toolName} missing required methods: ${missingMethods.join(', ')}`);
                return false;
            }

            // toolName プロパティ確認
            if (!toolInstance.toolName) {
                console.warn(`[ToolManager] Tool ${toolName} missing toolName property`);
                // 警告だけで続行
            }

            return true;

        } catch (error) {
            console.error(`[ToolManager] Tool validation error for ${toolName}:`, error);
            return false;
        }
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
     * 🚨 v12追加: インスタンスパス解決
     * @private
     */
    _resolveToolInstancePath(toolName, className) {
        const pathMappings = {
            'pen': 'Tegaki.PenToolInstance',
            'eraser': 'Tegaki.EraserToolInstance'
        };
        
        return pathMappings[toolName] || `Tegaki.${className}Instance`;
    }

    /**
     * 🚨 v12追加: パス指定によるインスタンス取得
     * @private
     */
    _getInstanceByPath(path) {
        try {
            const pathParts = path.split('.');
            let obj = window;
            
            for (const part of pathParts) {
                if (obj && typeof obj === 'object' && part in obj) {
                    obj = obj[part];
                } else {
                    return null;
                }
            }
            
            return obj;
        } catch (error) {
            console.warn(`[ToolManager] Failed to resolve instance path: ${path}`, error);
            return null;
        }
    }

    /**
     * 🚨 v12追加: クラス名によるコンストラクタ取得
     * @private
     */
    _getClassByName(className) {
        // window からクラスを検索
        if (window[className]) {
            return window[className];
        }
        
        // Tegaki 名前空間からクラスを検索
        if (window.Tegaki && window.Tegaki[className]) {
            return window.Tegaki[className];
        }
        
        return null;
    }

    /**
     * 🚨 v12追加: 統一システム取得メソッド群
     * @private
     */
    _getEventBus() {
        return window.Tegaki?.EventBusInstance || window.EventBus || null;
    }

    _getStateManager() {
        return window.Tegaki?.StateManagerInstance || window.StateManager || null;
    }

    _getErrorManager() {
        return window.Tegaki?.ErrorManagerInstance || window.ErrorManager || null;
    }

    _getConfigManager() {
        return window.Tegaki?.ConfigManagerInstance || window.ConfigManager || null;
    }

    /**
     * 🚨 v12追加: 統一エラーハンドリング
     * @private
     */
    _handleError(error, context, level = 'error', throwError = false) {
        const errorManager = this._getErrorManager();
        if (errorManager) {
            errorManager.handleError(error, context, level, throwError);
        } else {
            console.error(`[ToolManager] ${context}:`, error);
            if (throwError) {
                throw error;
            }
        }
    }

    /**
     * 🚨 v12追加: 統一警告出力
     * @private
     */
    _warn(message, context) {
        const errorManager = this._getErrorManager();
        if (errorManager) {
            errorManager.warn(message, context);
        } else {
            console.warn(`[ToolManager] ${context}: ${message}`);
        }
    }

    /**
     * 🚨 v12追加: 統一イベント発火
     * @private
     */
    _emitEvent(eventType, data) {
        const eventBus = this._getEventBus();
        if (eventBus) {
            eventBus.emit(eventType, data);
        }
    }

    /**
     * 🚨 v12追加: 統一状態更新
     * @private
     */
    _updateState(key, value) {
        const stateManager = this._getStateManager();
        if (stateManager) {
            stateManager.set(key, value);
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

        try {
            const layer = this.canvasManager.getLayerForTool(toolName);
            const graphics = new PIXI.Graphics();
            
            if (layer) {
                layer.addChild(graphics);
            }

            return graphics;
        } catch (error) {
            this._handleError(error, 'ToolManager.createToolGraphics');
            return null;
        }
    }

    /**
     * 🚨 v12追加: ToolManager健全性チェック
     */
    healthCheck() {
        const report = {
            timestamp: new Date().toISOString(),
            isHealthy: true,
            issues: [],
            recommendations: [],
            stats: this.getToolStats()
        };

        try {
            // 初期化状態確認
            if (!this.isInitialized) {
                report.isHealthy = false;
                report.issues.push('ToolManager not initialized');
                report.recommendations.push('Call initialize() method');
            }

            // 統合システム確認
            const systems = ['EventBus', 'StateManager', 'ErrorManager', 'ConfigManager'];
            systems.forEach(system => {
                const instance = this[`_get${system}`]();
                if (!instance) {
                    report.issues.push(`${system} not available`);
                    report.recommendations.push(`Ensure ${system} is loaded`);
                }
            });

            // ツール登録状況確認
            if (this.tools.size === 0) {
                report.isHealthy = false;
                report.issues.push('No tools registered');
                report.recommendations.push('Register at least one tool');
            }

            // アクティブツール確認
            if (!this.activeTool && this.tools.size > 0) {
                report.issues.push('No active tool selected');
                report.recommendations.push('Set an active tool');
            }

            // 統合システム接続確認
            if (!this.canvasManager) {
                report.issues.push('CanvasManager not connected');
            }
            
            if (!this.coordinateManager) {
                report.issues.push('CoordinateManager not connected');
            }

            // 登録エラー確認
            if (this.registrationStats.errors.length > 0) {
                report.issues.push(`${this.registrationStats.errors.length} tool registration errors`);
                report.recommendations.push('Check tool registration errors in stats');
            }

            if (report.issues.length > 0 && report.isHealthy) {
                report.isHealthy = false;
            }

        } catch (error) {
            report.isHealthy = false;
            report.issues.push(`Health check failed: ${error.message}`);
        }

        return report;
    }

    /**
     * 🚨 v12追加: 登録エラーのリセット
     */
    clearRegistrationErrors() {
        this.registrationStats.errors = [];
        console.log('[ToolManager] Registration errors cleared');
    }

    /**
     * 🚨 v12追加: ツール再登録試行
     */
    retryFailedRegistrations() {
        console.log('[ToolManager] Retrying failed tool registrations...');
        
        const failedTools = this.registrationStats.errors.map(error => error.toolName);
        const uniqueFailedTools = [...new Set(failedTools)];
        
        let retryCount = 0;
        
        uniqueFailedTools.forEach(toolName => {
            const toolInfo = this.defaultTools.find(t => t.name === toolName);
            if (toolInfo && !this.tools.has(toolName)) {
                console.log(`[ToolManager] Retrying registration for ${toolName}...`);
                
                if (this.registerToolSafely(toolName, toolInfo.className)) {
                    retryCount++;
                }
            }
        });
        
        console.log(`[ToolManager] Retry completed: ${retryCount} tools successfully registered`);
        return retryCount;
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

// 🔄 PixiJS v8対応準拠コメント
// - イベント配信システムは変更不要
// - Graphics生成部分のAPI更新対応準備済み
// - モジュール化対応設計採用

console.log('[ToolManager] Loaded and ready for registry initialization (v12 enhanced)');
    /**
     * ToolManagerを初期化
     * @param {CanvasManager} canvasManager - CanvasManagerインスタンス
     * @param {CoordinateManager} coordinateManager - CoordinateManagerインスタンス
     * @returns {boolean}
     */
    initialize(canvasManager, coordinateManager) {
        try {
            if (this.isInitialized) {
                this._warn('ToolManager already initialized', 'ToolManager.initialize');
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
            this._emitEvent('toolmanager:initialized', {
                toolCount: this.tools.size,
                activeTool: this.toolState.currentTool,
                registrationStats: this.registrationStats
            });
            
            console.log('[ToolManager] Successfully initialized - Tool integration ready');
            console.log('[ToolManager] Registration stats:', this.registrationStats);
            
            return true;
        } catch (error) {
            this._handleError(error, 'ToolManager.initialize', 'error', true);
            return false;
        }
    }

    /**
     * ツール登録（統合制御の主責務）
     * 🚨 v12修正: エラーハンドリング強化・インスタンス検証追加
     * @param {string} name - ツール名
     * @param {AbstractTool} toolInstance - ツールインスタンス
     * @returns {boolean}
     */
    registerTool(name, toolInstance) {
        this.registrationStats.attempted++;
        
        try {
            if (this.tools.has(name)) {
                console.log(`[ToolManager] Tool ${name} 既に登録済み`);
                return true;
            }

            // ツールインスタンス検証（重要な修正点）
            if (!this._validateToolInstance(toolInstance, name)) {
                this.registrationStats.failed++;
                return false;
            }

            this.tools.set(name, toolInstance);
            
            // ツール用レイヤー作成
            if (this.canvasManager) {
                try {
                    this.canvasManager.getLayerForTool(name);
                } catch (layerError) {
                    this._warn(`Layer creation failed for tool ${name}: ${layerError.message}`, 'ToolManager.registerTool');
                    // レイヤー作成失敗は致命的ではないため続行
                }
            }
            
            // ツールとCanvasManager統合
            this._integrateToolWithCanvas(name, toolInstance);
            
            this.registrationStats.successful++;
            
            // 統一システム経由での通知
            this._emitEvent('tool:registered', {
                toolName: name,
                toolType: toolInstance.constructor.name,
                registrationStats: this.registrationStats
            });

            console.log(`[ToolManager] Tool registered: ${name}`);
            return true;
        } catch (error) {
            this.registrationStats.failed++;
            this.registrationStats.errors.push({
                toolName: name,
                error: error.message,
                timestamp: new Date().toISOString()
            });
            
            this._handleError(error, 'ToolManager.registerTool', 'error', false);
            return false;
        }
    }

    /**
     * 🚨 v12追加: 安全なツール登録メソッド
     * @param {string} name - ツール名
     * @param {string|Function} ToolClass - ツールクラスまたはクラス名
     * @returns {boolean}
     */
    registerToolSafely(name, ToolClass) {
        try {
            let toolInstance = null;
            
            // ツールクラスの解決
            if (typeof ToolClass === 'string') {
                // 文字列の場合は対応するインスタンスを検索
                const instancePath = this._resolveToolInstancePath(name, ToolClass);
                toolInstance = this._getInstanceByPath(instancePath);
                
                if (!toolInstance) {
                    throw new Error(`Tool instance not found: ${instancePath}`);
                }
            } else if (typeof ToolClass === 'function') {
                // コンストラクタ関数の場合はインスタンス化
                toolInstance = new ToolClass();
            } else if (typeof ToolClass === 'object' && ToolClass !== null) {
                // 既にインスタンス化済みオブジェクト
                toolInstance = ToolClass;
            } else {
                throw new Error(`Invalid ToolClass type for ${name}: ${typeof ToolClass}`);
            }

            return this.registerTool(name, toolInstance);

        } catch (error) {
            console.error(`[ToolManager] Safe registration failed for ${name}:`, error);
            this._handleError(error, 'ToolManager.registerToolSafely');
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
            this._updateState('tool.current', toolName);
            this._updateState('tool.isActive', true);
            
            this._emitEvent('tool:changed', {
                previousTool: this.toolState.lastUsedTools[0] || null,
                currentTool: toolName,
                toolInstance: newTool
            });

            console.log(`[ToolManager] Tool changed to: ${toolName}`);
            return true;
        } catch (error) {
            console.error(`[ToolManager] ツール切り替えエラー (${toolName}): ${error.message}`);
            this._handleError(error, 'ToolManager.setTool');
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
            this._emitEvent('tool:method_delegated', {
                toolName: this.toolState.currentTool,
                method,
                eventType: event?.type
            });

            return result;
        } catch (error) {
            this._handleError(error, 'ToolManager.delegateToActiveTool');
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
            this._handleError(error, 'ToolManager.handlePointerEvent');
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
            this._emitEvent('tool:setting_updated', {
                toolName,
                setting,
                value
            });

            return true;
        } catch (error) {
            this._handleError(error, 'ToolManager.updateToolSetting');
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
            this._handleError(error, 'ToolManager.getToolConfig');
            return null;
        }
    }

    /**