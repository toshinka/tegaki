/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1.0
 * 🎯 AI_WORK_SCOPE: ツール系統括・描画制御・設定管理
 * 🎯 DEPENDENCIES: ConfigManager, ErrorManager, StateManager, EventBus
 * 🎯 UNIFIED_SYSTEMS: ✅ ConfigManager, ErrorManager, StateManager, EventBus統合済み
 * 🎯 ISOLATION_TEST: ✅ 単体テスト可能（ツール単体機能）
 * 🎯 SPLIT_THRESHOLD: 500行制限遵守（ツール制御・分割慎重）
 */

/**
 * ツール管理システム（統一システム統合版・描画問題修正版）
 * 統一システム完全活用・EventBus疎結合・設定値統一
 * Pure JavaScript完全準拠・グローバル公開方式
 */
class ToolManager {
    constructor(appCore = null) {
        this.version = 'v1.0-Phase1.4-drawing-fixed';
        this.appCore = appCore;
        
        // ツール管理の初期化順序修正
        this.currentTool = null; // 後で ConfigManager から取得
        this.registeredTools = new Map();
        this.isDrawing = false;
        this.currentPath = null;
        this.lastPoint = null;
        
        // 統一システム参照
        this.configManager = null;
        this.errorManager = null;
        this.stateManager = null;
        this.eventBus = null;
        
        // 座標管理システム参照
        this.coordinateManager = null;
        
        console.log(`🎨 ToolManager ${this.version} 構築開始（描画修正版）...`);
    }
    
    /**
     * 統一システム統合・ツール管理システム初期化（修正版）
     */
    async initialize() {
        console.group(`🎨 ToolManager 統一システム統合初期化開始 - ${this.version}`);
        
        try {
            const startTime = performance.now();
            
            // Phase 1: 統一システム依存性確認・設定
            this.validateAndSetupUnifiedSystems();
            
            // Phase 2: 座標管理システム統合
            this.setupCoordinateManager();
            
            // Phase 3: デフォルトツール設定（初期化順序修正）
            this.initializeDefaultTool();
            
            // Phase 4: 統一設定値取得・適用
            this.loadConfigurationFromUnifiedSystem();
            
            // Phase 5: EventBus連携設定
            this.setupEventBusIntegration();
            
            // Phase 6: 基本ツール登録
            this.registerBasicTools();
            
            // Phase 7: AppCore描画システム接続確認
            this.validateAppCoreIntegration();
            
            const initTime = performance.now() - startTime;
            console.log(`✅ ToolManager 統一システム統合初期化完了 - ${initTime.toFixed(2)}ms`);
            
            // StateManager状態更新 - 修正版：updateComponentState使用
            if (this.stateManager && typeof this.stateManager.updateComponentState === 'function') {
                this.stateManager.updateComponentState('toolManager', 'initialized', {
                    initTime,
                    unifiedSystemsEnabled: true,
                    currentTool: this.currentTool,
                    version: this.version,
                    appCoreConnected: !!this.appCore
                });
            }
            
            return this;
            
        } catch (error) {
            console.error('❌ ToolManager初期化エラー:', error);
            this.handleInitializationError(error);
            return this;
            
        } finally {
            console.groupEnd();
        }
    }
    
    /**
     * 統一システム依存性確認・設定（修正版）
     */
    validateAndSetupUnifiedSystems() {
        console.log('🔧 統一システム依存性確認開始...');
        
        // ConfigManager依存性確認
        this.configManager = window.ConfigManager;
        if (!this.configManager) {
            throw new Error('ConfigManager が利用できません。統一システムの初期化を確認してください。');
        }
        
        // ErrorManager依存性確認
        this.errorManager = window.ErrorManager;
        if (!this.errorManager) {
            throw new Error('ErrorManager が利用できません。統一システムの初期化を確認してください。');
        }
        
        // StateManager依存性確認（オプショナル）
        this.stateManager = window.StateManager;
        if (!this.stateManager) {
            console.warn('⚠️ StateManager が利用できません。状態管理は制限されます。');
        }
        
        // EventBus依存性確認（オプショナル）
        this.eventBus = window.EventBus;
        if (!this.eventBus) {
            console.warn('⚠️ EventBus が利用できません。イベント通信は制限されます。');
        }
        
        console.log('✅ 統一システム依存性確認完了');
    }
    
    /**
     * 座標管理システム統合（新規）
     */
    setupCoordinateManager() {
        console.log('📐 座標管理システム統合開始...');
        
        try {
            this.coordinateManager = window.CoordinateManager ? new window.CoordinateManager() : null;
            
            if (this.coordinateManager) {
                console.log('✅ CoordinateManager統合完了');
            } else {
                console.warn('⚠️ CoordinateManager未利用可能。座標変換は基本機能のみ');
            }
            
        } catch (error) {
            console.warn('⚠️ CoordinateManager統合失敗:', error.message);
            this.coordinateManager = null;
        }
    }
    
    /**
     * AppCore描画システム接続確認（新規）
     */
    validateAppCoreIntegration() {
        console.log('🎨 AppCore描画システム接続確認...');
        
        if (!this.appCore) {
            console.warn('⚠️ AppCore未接続。描画機能は制限されます。');
            return false;
        }
        
        // PixiJS app確認
        if (!this.appCore.app) {
            console.warn('⚠️ PixiJS app未初期化。描画機能は制限されます。');
            return false;
        }
        
        // 描画コンテナ確認
        if (!this.appCore.drawingContainer) {
            console.warn('⚠️ 描画コンテナ未初期化。描画機能は制限されます。');
            return false;
        }
        
        console.log('✅ AppCore描画システム接続確認完了');
        return true;
    }
    
    /**
     * デフォルトツール設定（初期化順序修正）
     */
    initializeDefaultTool() {
        try {
            // ConfigManagerからデフォルトツール取得（フォールバック付き）
            this.currentTool = this.configManager.getDefaultTool() || 'pen';
            console.log(`🎯 デフォルトツール設定: ${this.currentTool}`);
            
        } catch (error) {
            // フォールバック
            this.currentTool = 'pen';
            console.warn('⚠️ デフォルトツール取得失敗、フォールバック: pen');
        }
    }
    
    /**
     * 統一設定値取得・適用（修正版）
     */
    loadConfigurationFromUnifiedSystem() {
        console.log('⚙️ 統一設定値取得開始...');
        
        try {
            // ツール別設定取得・構築
            this.globalSettings = {
                pen: this.loadToolConfig('pen'),
                eraser: this.loadToolConfig('eraser')
            };
            
            console.log('✅ 統一設定値取得・適用完了');
            
        } catch (error) {
            if (this.errorManager) {
                this.errorManager.showError('error', '設定値取得失敗: ' + error.message);
            }
            
            // フォールバック設定
            this.globalSettings = {
                pen: {
                    brushSize: 16.0,
                    brushColor: 0x800000,
                    opacity: 0.85,
                    pressure: 0.5,
                    smoothing: 0.3
                },
                eraser: {
                    brushSize: 16.0,
                    opacity: 1.0,
                    mode: 'normal'
                }
            };
            
            console.warn('⚠️ フォールバック設定を使用');
        }
    }
    
    /**
     * ツール設定読み込み（安全版）
     */
    loadToolConfig(toolName) {
        const defaultConfigs = {
            pen: {
                brushSize: 16.0,
                brushColor: 0x800000,
                opacity: 0.85,
                pressure: 0.5,
                smoothing: 0.3,
                pressureSensitivity: true,
                edgeSmoothing: true,
                gpuAcceleration: false
            },
            eraser: {
                brushSize: 16.0,
                opacity: 1.0,
                mode: 'normal',
                areaMode: false,
                particles: true
            }
        };
        
        try {
            // ConfigManagerから取得を試行
            const toolConfig = this.configManager.getToolConfig(toolName);
            if (toolConfig && Object.keys(toolConfig).length > 0) {
                return { ...defaultConfigs[toolName], ...toolConfig };
            }
            
            // レガシー互換で再試行
            const drawingConfig = this.configManager.getDrawingConfig(toolName);
            if (drawingConfig && Object.keys(drawingConfig).length > 0) {
                return { ...defaultConfigs[toolName], ...this.mapDrawingConfigToTool(drawingConfig) };
            }
            
        } catch (error) {
            console.warn(`⚠️ ${toolName}設定読み込み失敗:`, error.message);
        }
        
        return defaultConfigs[toolName];
    }
    
    /**
     * DrawingConfigをToolConfigにマッピング
     */
    mapDrawingConfigToTool(drawingConfig) {
        return {
            brushSize: drawingConfig.defaultSize || drawingConfig.brushSize,
            brushColor: drawingConfig.defaultColor || drawingConfig.brushColor,
            opacity: drawingConfig.defaultOpacity || drawingConfig.opacity,
            pressure: drawingConfig.defaultPressure || drawingConfig.pressure,
            smoothing: drawingConfig.defaultSmoothing || drawingConfig.smoothing
        };
    }
    
    /**
     * EventBus統合設定（修正版）
     */
    setupEventBusIntegration() {
        if (!this.eventBus) {
            console.warn('⚠️ EventBus統合スキップ（利用不可）');
            return;
        }
        
        console.log('🚌 EventBus統合設定開始...');
        
        try {
            // UI からのツール変更イベントリスナー
            this.eventBus.on('ui:tool:activated', (data) => {
                this.handleToolActivationFromUI(data.tool);
            });
            
            // 設定変更イベントリスナー
            this.eventBus.on('config:changed', (data) => {
                this.handleConfigChangeFromEventBus(data.key, data.value);
            });
            
            // ツール設定変更イベントリスナー
            this.eventBus.on('tool:pen:size:changed', (data) => {
                this.updateToolSetting('pen', 'brushSize', data.value);
            });
            
            this.eventBus.on('tool:pen:opacity:changed', (data) => {
                this.updateToolSetting('pen', 'opacity', data.value / 100);
            });
            
            // 境界越えイベントリスナー（Phase1.4 境界描画対応）
            this.eventBus.on('boundary.cross.in', (data) => {
                this.handleBoundaryCrossIn(data);
            });
            
            console.log('✅ EventBus統合設定完了');
            
        } catch (error) {
            console.warn('⚠️ EventBus統合設定で問題発生:', error.message);
        }
    }
    
    /**
     * 境界越え描画開始処理（Phase1.4 境界描画問題改修）
     */
    handleBoundaryCrossIn(data) {
        try {
            if (!data || !data.position) {
                console.warn('⚠️ 境界越えデータが不正です');
                return;
            }
            
            const { x, y } = data.position;
            const pressure = data.pressure || 0.5;
            
            console.log(`🎯 境界越え描画開始処理: ToolManager at (${x.toFixed(1)}, ${y.toFixed(1)})`);
            
            // 現在のツールが境界越え対応している場合
            const currentToolInstance = this.registeredTools.get(this.currentTool);
            if (currentToolInstance && typeof currentToolInstance.handleBoundaryCrossIn === 'function') {
                currentToolInstance.handleBoundaryCrossIn(x, y, data);
                console.log(`✅ ツール境界越え処理実行: ${this.currentTool}`);
            } else {
                // フォールバック: 通常の描画開始処理
                this.startDrawing(x, y, pressure);
                console.log(`🔄 境界越えフォールバック描画: ${this.currentTool}`);
            }
            
        } catch (error) {
            if (this.errorManager) {
                this.errorManager.showError('warning', '境界越え描画処理失敗: ' + error.message);
            }
        }
    }
    
    /**
     * 基本ツール登録（新規）
     */
    registerBasicTools() {
        try {
            // 基本ツールは実際のツールクラスがなくても登録する
            const basicTools = this.configManager.getAvailableTools() || ['pen', 'eraser'];
            
            basicTools.forEach(toolName => {
                if (!this.registeredTools.has(toolName)) {
                    // プレースホルダーとしてツール名のみ登録
                    this.registeredTools.set(toolName, {
                        name: toolName,
                        type: 'basic',
                        settings: this.globalSettings[toolName] || {}
                    });
                    
                    console.log(`🔧 基本ツール登録: ${toolName}`);
                }
            });
            
        } catch (error) {
            console.warn('⚠️ 基本ツール登録で問題発生:', error.message);
        }
    }
    
    /**
     * 初期化エラー処理
     */
    handleInitializationError(error) {
        if (this.errorManager) {
            this.errorManager.showError('error', 'ツール管理システム初期化失敗: ' + error.message, {
                additionalInfo: 'ToolManager初期化時のエラー',
                showReload: false
            });
        }
        
        // 最低限の状態を保つ
        if (!this.currentTool) {
            this.currentTool = 'pen';
        }
        
        if (!this.globalSettings) {
            this.globalSettings = {
                pen: {
                    brushSize: 16.0,
                    brushColor: 0x800000,
                    opacity: 0.85,
                    pressure: 0.5,
                    smoothing: 0.3
                },
                eraser: {
                    brushSize: 16.0,
                    opacity: 1.0,
                    mode: 'normal'
                }
            };
        }
        
        console.warn('⚠️ ToolManager フォールバックモードで動作');
    }
    
    // ==========================================
    // 🎯 EventBusイベントハンドラー群
    // ==========================================
    
    /**
     * EventBus: UIからのツール変更処理
     */
    handleToolActivationFromUI(tool) {
        try {
            if (this.currentTool !== tool) {
                this.setTool(tool);
                console.log(`🚌 EventBus: UIからツール変更受信 - ${tool}`);
            }
            
        } catch (error) {
            if (this.errorManager) {
                this.errorManager.showError('warning', 'EventBus UIツール変更処理失敗: ' + error.message);
            }
        }
    }
    
    /**
     * EventBus: 設定変更イベント処理
     */
    handleConfigChangeFromEventBus(key, value) {
        try {
            // ツール関連設定の場合のみ処理
            if (key.startsWith('tools.')) {
                this.applyConfigChangeToTools(key, value);
                console.log(`🚌 EventBus: ツール設定変更受信 - ${key}: ${value}`);
            }
            
        } catch (error) {
            if (this.errorManager) {
                this.errorManager.showError('warning', 'EventBus設定変更処理失敗: ' + error.message);
            }
        }
    }
    
    // ==========================================
    // 🎯 ツール管理メソッド群（統一システム統合版）
    // ==========================================
    
    /**
     * ツール登録
     * @param {string} name - ツール名
     * @param {Object} toolInstance - ツールインスタンス
     */
    registerTool(name, toolInstance) {
        try {
            this.registeredTools.set(name, toolInstance);
            
            // StateManager経由で状態更新 - 修正版：updateComponentState使用
            if (this.stateManager && typeof this.stateManager.updateComponentState === 'function') {
                this.stateManager.updateComponentState('toolManager', 'toolRegistered', {
                    tool: name,
                    timestamp: Date.now(),
                    hasInstance: !!toolInstance
                });
            }
            
            console.log(`🔧 ツール登録: ${name} (${toolInstance.version || 'unknown version'})`);
            
        } catch (error) {
            if (this.errorManager) {
                this.errorManager.showError('warning', 'ツール登録失敗: ' + error.message);
            }
        }
    }
    
    /**
     * ツール設定
     * @param {string} tool - ツール名
     */
    setTool(tool) {
        try {
            // ツールが存在するかチェック
            if (!this.isToolAvailable(tool)) {
                console.warn(`⚠️ 未登録ツール: ${tool}`);
                return false;
            }
            
            const oldTool = this.currentTool;
            
            // 現在のツールを非アクティブ化
            if (oldTool && oldTool !== tool) {
                const oldToolInstance = this.registeredTools.get(oldTool);
                if (oldToolInstance && typeof oldToolInstance.deactivate === 'function') {
                    oldToolInstance.deactivate();
                }
            }
            
            this.currentTool = tool;
            
            // 新しいツールをアクティブ化
            const newToolInstance = this.registeredTools.get(tool);
            if (newToolInstance && typeof newToolInstance.activate === 'function') {
                newToolInstance.activate();
            }
            
            // EventBus経由でツール変更通知
            if (this.eventBus && typeof this.eventBus.emit === 'function') {
                this.eventBus.emit('tool:changed', {
                    tool,
                    oldTool,
                    settings: this.globalSettings[tool] || {},
                    timestamp: Date.now(),
                    source: 'ToolManager'
                });
            }
            
            // StateManager経由で状態更新 - 修正版：updateComponentState使用
            if (this.stateManager && typeof this.stateManager.updateComponentState === 'function') {
                this.stateManager.updateComponentState('toolManager', 'currentTool', {
                    tool,
                    oldTool,
                    timestamp: Date.now()
                });
            }
            
            console.log(`🎯 ツール変更: ${oldTool} → ${tool}`);
            return true;
            
        } catch (error) {
            if (this.errorManager) {
                this.errorManager.showError('warning', 'ツール設定失敗: ' + error.message);
            }
            return false;
        }
    }
    
    /**
     * ツール利用可能性確認
     */
    isToolAvailable(tool) {
        // 基本ツールは常に利用可能
        if (['pen', 'eraser'].includes(tool)) {
            return true;
        }
        
        // 登録済みツールかチェック
        return this.registeredTools.has(tool);
    }
    
    /**
     * 現在のツール取得
     */
    getCurrentTool() {
        return this.currentTool;
    }
    
    /**
     * ツール設定更新
     */
    updateToolSetting(tool, setting, value) {
        try {
            if (!this.globalSettings[tool]) {
                console.warn(`⚠️ 未知のツール: ${tool}`);
                return false;
            }
            
            if (!(setting in this.globalSettings[tool])) {
                console.warn(`⚠️ 未知の設定項目: ${tool}.${setting}`);
                return false;
            }
            
            const oldValue = this.globalSettings[tool][setting];
            this.globalSettings[tool][setting] = value;
            
            // 現在のツールに設定変更を通知
            const currentToolInstance = this.registeredTools.get(this.currentTool);
            if (currentToolInstance && currentToolInstance.updateSettings) {
                currentToolInstance.updateSettings(this.globalSettings[this.currentTool]);
            }
            
            console.log(`🔧 ツール設定更新: ${tool}.${setting} = ${value} (旧: ${oldValue})`);
            return true;
            
        } catch (error) {
            if (this.errorManager) {
                this.errorManager.showError('warning', 'ツール設定更新失敗: ' + error.message);
            }
            return false;
        }
    }
    
    /**
     * 設定変更の適用
     */
    applyConfigChangeToTools(configKey, value) {
        // Config設定からツール設定への変換処理
        const keyMappings = {
            'tools.pen.size': { tool: 'pen', setting: 'brushSize' },
            'tools.pen.opacity': { tool: 'pen', setting: 'opacity' },
            'tools.pen.color': { tool: 'pen', setting: 'brushColor' },
            'tools.eraser.size': { tool: 'eraser', setting: 'brushSize' }
        };
        
        const mapping = keyMappings[configKey];
        if (mapping && this.globalSettings[mapping.tool]) {
            this.updateToolSetting(mapping.tool, mapping.setting, value);
        }
    }
    
    // ==========================================
    // 🎯 描画処理メソッド群（修正版）
    // ==========================================
    
    /**
     * 描画開始（修正版）
     */
    startDrawing(x, y, pressure = 0.5) {
        try {
            if (this.isDrawing) {
                console.warn('⚠️ 既に描画中です');
                return;
            }
            
            this.isDrawing = true;
            this.lastPoint = { x, y };
            
            // 座標変換（CoordinateManager使用）
            let drawingCoords = { x, y };
            if (this.coordinateManager && this.appCore?.app?.view) {
                try {
                    const canvasRect = this.appCore.app.view.getBoundingClientRect();
                    const extractedCoords = this.coordinateManager.extractPointerCoordinates(
                        { global: { x, y }, pressure }, 
                        canvasRect, 
                        this.appCore.app
                    );
                    drawingCoords = extractedCoords.pixi || extractedCoords.canvas;
                } catch (coordError) {
                    console.warn('⚠️ 座標変換失敗、元座標使用:', coordError.message);
                }
            }
            
            // 現在のツールで描画開始
            const currentToolInstance = this.registeredTools.get(this.currentTool);
            if (currentToolInstance && typeof currentToolInstance.startDrawing === 'function') {
                const path = currentToolInstance.startDrawing(drawingCoords.x, drawingCoords.y, pressure);
                this.currentPath = path;
                console.log(`✏️ ツール描画開始: ${this.currentTool} (${currentToolInstance.version || 'unknown'})`);
            } else {
                // フォールバック: AppCore経由で描画
                this.handleDrawingFallback('start', drawingCoords.x, drawingCoords.y, pressure);
            }
            
            // StateManager経由で状態更新 - 修正版：updateComponentState使用
            if (this.stateManager && typeof this.stateManager.updateComponentState === 'function') {
                this.stateManager.updateComponentState('toolManager', 'drawing', {
                    isDrawing: true,
                    tool: this.currentTool,
                    startPoint: { x: drawingCoords.x, y: drawingCoords.y },
                    timestamp: Date.now()
                });
            }
            
            console.log(`✏️ 描画開始: ${this.currentTool} at (${Math.round(drawingCoords.x)}, ${Math.round(drawingCoords.y)})`);
            
        } catch (error) {
            if (this.errorManager) {
                this.errorManager.showError('warning', '描画開始失敗: ' + error.message);
            }
            this.isDrawing = false;
        }
    }
    
    /**
     * 描画継続（修正版）
     */
    continueDrawing(x, y, pressure = 0.5) {
        if (!this.isDrawing) return;
        
        try {
            // 座標変換（CoordinateManager使用）
            let drawingCoords = { x, y };
            if (this.coordinateManager && this.appCore?.app?.view) {
                try {
                    const canvasRect = this.appCore.app.view.getBoundingClientRect();
                    const extractedCoords = this.coordinateManager.extractPointerCoordinates(
                        { global: { x, y }, pressure }, 
                        canvasRect, 
                        this.appCore.app
                    );
                    drawingCoords = extractedCoords.pixi || extractedCoords.canvas;
                } catch (coordError) {
                    console.warn('⚠️ 座標変換失敗、元座標使用:', coordError.message);
                }
            }
            
            // 現在のツールで描画継続
            const currentToolInstance = this.registeredTools.get(this.currentTool);
            if (currentToolInstance && typeof currentToolInstance.continueDrawing === 'function') {
                currentToolInstance.continueDrawing(drawingCoords.x, drawingCoords.y, pressure);
            } else {
                // フォールバック処理
                this.handleDrawingFallback('continue', drawingCoords.x, drawingCoords.y, pressure);
            }
            
            this.lastPoint = { x: drawingCoords.x, y: drawingCoords.y };
            
        } catch (error) {
            if (this.errorManager) {
                this.errorManager.showError('warning', '描画継続失敗: ' + error.message);
            }
        }
    }
    
    /**
     * 描画終了（修正版）
     */
    stopDrawing() {
        if (!this.isDrawing) return;
        
        try {
            // 現在のツールで描画終了
            const currentToolInstance = this.registeredTools.get(this.currentTool);
            if (currentToolInstance && typeof currentToolInstance.stopDrawing === 'function') {
                const completedPath = currentToolInstance.stopDrawing();
                this.currentPath = completedPath;
                console.log(`✏️ ツール描画終了: ${this.currentTool}`);
            } else {
                // フォールバック処理
                this.handleDrawingFallback('stop');
            }
            
            this.isDrawing = false;
            this.currentPath = null;
            this.lastPoint = null;
            
            // StateManager経由で状態更新 - 修正版：updateComponentState使用
            if (this.stateManager && typeof this.stateManager.updateComponentState === 'function') {
                this.stateManager.updateComponentState('toolManager', 'drawing', {
                    isDrawing: false,
                    tool: this.currentTool,
                    timestamp: Date.now()
                });
            }
            
            console.log(`✏️ 描画終了: ${this.currentTool}`);
            
        } catch (error) {
            if (this.errorManager) {
                this.errorManager.showError('warning', '描画終了失敗: ' + error.message);
            }
            this.isDrawing = false;
        }
    }
    
    /**
     * 描画フォールバック処理（改良版）
     */
    handleDrawingFallback(action, x, y, pressure) {
        if (!this.appCore) {
            console.warn(`⚠️ 描画フォールバック: ${action} - AppCore未接続`);
            return;
        }
        
        console.log(`🔧 描画フォールバック: ${action} - AppCore経由`);
        
        try {
            switch (action) {
                case 'start':
                    this.currentPath = this.createBasicPath(x, y, pressure);
                    break;
                case 'continue':
                    if (this.currentPath && this.lastPoint) {
                        this.drawBasicLine(this.lastPoint.x, this.lastPoint.y, x, y, pressure);
                    }
                    break;
                case 'stop':
                    if (this.currentPath) {
                        this.finalizeBasicPath();
                    }
                    break;
            }
        } catch (error) {
            console.warn(`⚠️ フォールバック描画エラー: ${error.message}`);
        }
    }
    
    /**
     * 基本パス作成（フォールバック用）
     */
    createBasicPath(x, y, pressure) {
        if (!this.appCore.drawingContainer) {
            console.warn('⚠️ 描画コンテナが見つかりません');
            return null;
        }
        
        const graphics = new PIXI.Graphics();
        const settings = this.globalSettings[this.currentTool] || {};
        
        // 基本設定適用
        const color = settings.brushColor || 0x800000;
        const size = settings.brushSize || 16.0;
        const alpha = settings.opacity || 0.85;
        
        graphics.lineStyle({
            width: size * (pressure || 0.5),
            color: color,
            alpha: alpha,
            cap: PIXI.LINE_CAP.ROUND,
            join: PIXI.LINE_JOIN.ROUND
        });
        
        graphics.moveTo(x, y);
        
        this.appCore.drawingContainer.addChild(graphics);
        
        const path = {
            id: `fallback_path_${Date.now()}`,
            graphics: graphics,
            tool: this.currentTool,
            fallback: true
        };
        
        if (this.appCore.paths) {
            this.appCore.paths.push(path);
        }
        
        console.log(`🔧 基本パス作成完了: ${path.id}`);
        return path;
    }
    
    /**
     * 基本線描画（フォールバック用）
     */
    drawBasicLine(fromX, fromY, toX, toY, pressure) {
        if (!this.currentPath?.graphics) return;
        
        try {
            const graphics = this.currentPath.graphics;
            const settings = this.globalSettings[this.currentTool] || {};
            
            // 圧力に応じた線幅調整
            const baseSize = settings.brushSize || 16.0;
            const size = baseSize * (pressure || 0.5);
            
            graphics.lineStyle({
                width: size,
                color: settings.brushColor || 0x800000,
                alpha: settings.opacity || 0.85,
                cap: PIXI.LINE_CAP.ROUND,
                join: PIXI.LINE_JOIN.ROUND
            });
            
            graphics.lineTo(toX, toY);
            
        } catch (error) {
            console.warn(`⚠️ 基本線描画エラー: ${error.message}`);
        }
    }
    
    /**
     * 基本パス確定（フォールバック用）
     */
    finalizeBasicPath() {
        if (!this.currentPath) return;
        
        console.log(`🔧 基本パス確定: ${this.currentPath.id}`);
        
        // EventBus通知
        if (this.eventBus && typeof this.eventBus.safeEmit === 'function') {
            this.eventBus.safeEmit('path:created', {
                pathId: this.currentPath.id,
                tool: this.currentTool,
                fallback: true
            });
        }
    }
    
    // ==========================================
    // 🎯 設定操作メソッド群
    // ==========================================
    
    /**
     * ブラシサイズ設定
     */
    setBrushSize(size) {
        try {
            const normalizedSize = Math.max(0.1, Math.min(100, Math.round(size * 10) / 10));
            this.updateToolSetting(this.currentTool, 'brushSize', normalizedSize);
            console.log(`🖌️ ブラシサイズ: ${normalizedSize}px`);
            
        } catch (error) {
            if (this.errorManager) {
                this.errorManager.showError('warning', 'ブラシサイズ設定失敗: ' + error.message);
            }
        }
    }
    
    /**
     * 不透明度設定
     */
    setOpacity(opacity) {
        try {
            const normalizedOpacity = Math.max(0, Math.min(1, Math.round(opacity * 1000) / 1000));
            this.updateToolSetting(this.currentTool, 'opacity', normalizedOpacity);
            console.log(`🌫️ 不透明度: ${Math.round(normalizedOpacity * 100)}%`);
            
        } catch (error) {
            if (this.errorManager) {
                this.errorManager.showError('warning', '不透明度設定失敗: ' + error.message);
            }
        }
    }
    
    /**
     * 筆圧設定
     */
    setPressure(pressure) {
        try {
            const normalizedPressure = Math.max(0, Math.min(1, Math.round(pressure * 1000) / 1000));
            this.updateToolSetting(this.currentTool, 'pressure', normalizedPressure);
            console.log(`✍️ 筆圧: ${Math.round(normalizedPressure * 100)}%`);
            
        } catch (error) {
            if (this.errorManager) {
                this.errorManager.showError('warning', '筆圧設定失敗: ' + error.message);
            }
        }
    }
    
    /**
     * 線補正設定
     */
    setSmoothing(smoothing) {
        try {
            const normalizedSmoothing = Math.max(0, Math.min(1, Math.round(smoothing * 1000) / 1000));
            this.updateToolSetting(this.currentTool, 'smoothing', normalizedSmoothing);
            console.log(`📏 線補正: ${Math.round(normalizedSmoothing * 100)}%`);
            
        } catch (error) {
            if (this.errorManager) {
                this.errorManager.showError('warning', '線補正設定失敗: ' + error.message);
            }
        }
    }
    
    // ==========================================
    // 🎯 状態取得メソッド群
    // ==========================================
    
    /**
     * 描画状態取得
     */
    getDrawingState() {
        return {
            version: this.version,
            unifiedSystemsEnabled: true,
            currentTool: this.currentTool,
            isDrawing: this.isDrawing,
            globalSettings: this.globalSettings ? { ...this.globalSettings } : {},
            registeredTools: Array.from(this.registeredTools.keys()),
            currentPath: this.currentPath ? this.currentPath.id : null,
            lastPoint: this.lastPoint ? { ...this.lastPoint } : null,
            appCoreConnected: !!this.appCore,
            coordinateManagerAvailable: !!this.coordinateManager
        };
    }
    
    /**
     * ツール統計取得
     */
    getToolStats() {
        const stats = {
            version: this.version,
            currentTool: this.currentTool,
            registeredToolsCount: this.registeredTools.size,
            isDrawing: this.isDrawing,
            globalSettings: this.globalSettings ? { ...this.globalSettings } : {},
            unifiedSystems: {
                configManager: !!this.configManager,
                errorManager: !!this.errorManager,
                stateManager: !!this.stateManager,
                eventBus: !!this.eventBus,
                coordinateManager: !!this.coordinateManager
            }
        };
        
        return stats;
    }
    
    /**
     * ツール切り替え可能性チェック
     */
    canSwitchTo(tool) {
        if (this.isDrawing) {
            console.warn('⚠️ 描画中はツール変更できません');
            return false;
        }
        
        if (!this.isToolAvailable(tool)) {
            console.warn(`⚠️ 利用できないツール: ${tool}`);
            return false;
        }
        
        return true;
    }
    
    /**
     * 安全なツール切り替え
     */
    safeSwitchTool(tool) {
        if (!this.canSwitchTo(tool)) return false;
        
        // 描画中の場合は強制終了
        if (this.isDrawing) {
            this.stopDrawing();
        }
        
        return this.setTool(tool);
    }
    
    // ==========================================
    // 🎯 その他操作メソッド群
    // ==========================================
    
    /**
     * デバッグ情報出力
     */
    debugInfo() {
        const state = this.getDrawingState();
        const stats = this.getToolStats();
        
        console.group('🔧 ToolManager デバッグ情報（描画修正版）');
        console.log('📊 状態:', state);
        console.log('📈 統計:', stats);
        console.log('🔧 統一システム健全性:', this.checkUnifiedSystemHealth());
        console.log('📐 座標管理システム状態:', this.coordinateManager?.getCoordinateState?.() || 'N/A');
        console.groupEnd();
        
        return { state, stats };
    }
    
    /**
     * 統一システム健全性チェック
     */
    checkUnifiedSystemHealth() {
        const health = {
            configManager: !!this.configManager && typeof this.configManager.get === 'function',
            errorManager: !!this.errorManager && typeof this.errorManager.showError === 'function',
            stateManager: !!this.stateManager && typeof this.stateManager.updateComponentState === 'function',
            eventBus: !!this.eventBus && typeof this.eventBus.emit === 'function',
            coordinateManager: !!this.coordinateManager && typeof this.coordinateManager.screenToCanvas === 'function',
            appCore: !!this.appCore && !!this.appCore.app
        };
        
        const allHealthy = Object.values(health).every(Boolean);
        
        if (!allHealthy) {
            console.warn('⚠️ 一部のシステムに問題があります:', health);
        }
        
        return { health, allHealthy };
    }
    
    /**
     * 破棄処理
     */
    destroy() {
        try {
            console.log('🗑️ ToolManager破棄開始...');
            
            // 描画中の場合は終了
            if (this.isDrawing) {
                this.stopDrawing();
            }
            
            // 全ツールの非アクティブ化
            this.registeredTools.forEach((tool, name) => {
                if (tool && typeof tool.deactivate === 'function') {
                    tool.deactivate();
                }
                if (tool && typeof tool.destroy === 'function') {
                    tool.destroy();
                }
            });
            
            // EventBusリスナー解除
            if (this.eventBus && typeof this.eventBus.off === 'function') {
                this.eventBus.off('ui:tool:activated');
                this.eventBus.off('config:changed');
                this.eventBus.off('tool:pen:size:changed');
                this.eventBus.off('tool:pen:opacity:changed');
                this.eventBus.off('boundary.cross.in');
            }
            
            // 登録ツールクリア
            this.registeredTools.clear();
            
            // 参照クリア
            this.appCore = null;
            this.currentPath = null;
            this.lastPoint = null;
            this.configManager = null;
            this.errorManager = null;
            this.stateManager = null;
            this.eventBus = null;
            this.coordinateManager = null;
            
            console.log('✅ ToolManager破棄完了');
            
        } catch (error) {
            console.error('❌ ToolManager破棄エラー:', error);
        }
    }
}

// ==========================================
// 🎯 Pure JavaScript グローバル公開
// ==========================================

if (typeof window !== 'undefined') {
    window.ToolManager = ToolManager;
    console.log('✅ ToolManager 描画修正版 グローバル公開完了（Pure JavaScript）');
}

console.log('🔧 ToolManager Phase1.4 描画修正版 - 準備完了');
console.log('📋 統一システム統合完了: ConfigManager・ErrorManager・StateManager・EventBus・CoordinateManager');
console.log('📋 描画問題修正: フォールバック描画・座標変換統合・ツールアクティベーション改善');
console.log('🎯 境界描画対応: boundary.cross.in イベント対応・ツール境界越えメソッド統合');
console.log('💡 使用例: const toolManager = new window.ToolManager(appCore); await toolManager.initialize();');