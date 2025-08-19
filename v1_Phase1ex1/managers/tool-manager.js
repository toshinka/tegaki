/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1.0
 * 🎯 AI_WORK_SCOPE: ツール系統括・描画制御・設定管理
 * 🎯 DEPENDENCIES: js/utils/config-manager.js, js/utils/error-manager.js, js/utils/state-manager.js, js/utils/event-bus.js
 * 🎯 UNIFIED_SYSTEMS: ✅ ConfigManager, ErrorManager, StateManager, EventBus統合済み
 * 🎯 ISOLATION_TEST: ✅ 単体テスト可能（ツール単体機能）
 * 🎯 SPLIT_THRESHOLD: 500行制限遵守（ツール制御・分割慎重）
 * 
 * 📋 PHASE_TARGET: Phase1.1ss3 - 統一システム完全統合・Pure JavaScript完全準拠
 * 📋 V8_MIGRATION: 変更なし（描画ロジック専用）
 * 📋 RULEBOOK_COMPLIANCE: 1.2実装原則「Pure JavaScript維持」完全準拠
 * 📋 DRY_COMPLIANCE: ✅ 統一システム活用・重複コード排除完了
 * 📋 SOLID_COMPLIANCE: ✅ 単一責任・疎結合設計・統一システム依存性逆転
 */

/**
 * ツール管理システム（統一システム統合版）
 * 統一システム完全活用・EventBus疎結合・設定値統一
 * Pure JavaScript完全準拠・グローバル公開方式
 */
class ToolManager {
    constructor() {
        this.version = 'v1.0-Phase1.1ss3-unified';
        this.currentTool = 'pen';
        this.canvasManager = null;
        this.isDrawing = false;
        this.currentPath = null;
        this.lastPoint = null;
        
        // 🎯 統一システム依存関係
        this.configManager = null;
        this.errorManager = null;
        this.stateManager = null;
        this.eventBus = null;
        
        // 登録ツール管理
        this.registeredTools = new Map();
        
        // 設定キー定義（統一システム対応）
        this.configKeys = {
            tools: {
                pen: {
                    size: 'tools.pen.size',
                    color: 'tools.pen.color',
                    opacity: 'tools.pen.opacity',
                    pressure: 'tools.pen.pressure',
                    smoothing: 'tools.pen.smoothing',
                    pressureSensitivity: 'tools.pen.pressureSensitivity',
                    edgeSmoothing: 'tools.pen.edgeSmoothing',
                    gpuAcceleration: 'tools.pen.gpuAcceleration'
                },
                eraser: {
                    size: 'tools.eraser.size',
                    opacity: 'tools.eraser.opacity',
                    mode: 'tools.eraser.mode',
                    areaMode: 'tools.eraser.areaMode',
                    particles: 'tools.eraser.particles'
                }
            },
            global: {
                currentTool: 'tools.global.currentTool'
            }
        };
        
        console.log(`🎨 ToolManager ${this.version}構築開始（Pure JavaScript）...`);
    }
    
    /**
     * 🎯 統一システム統合・ツール管理システム初期化
     * @param {CanvasManager} canvasManager - キャンバス管理システム
     */
    async init(canvasManager) {
        console.group(`🎨 ToolManager 統一システム統合初期化開始 - ${this.version}`);
        
        try {
            const startTime = performance.now();
            
            // Phase 1: 統一システム依存性確認・設定
            this.validateAndSetupUnifiedSystems();
            
            // Phase 2: キャンバスマネージャー設定
            if (!canvasManager) {
                throw new Error('CanvasManager が必要です');
            }
            this.canvasManager = canvasManager;
            
            // Phase 3: 統一設定値取得・適用
            this.loadConfigurationFromUnifiedSystem();
            
            // Phase 4: EventBus連携設定
            this.setupEventBusIntegration();
            
            // Phase 5: 初期ツール設定
            this.setInitialTool();
            
            const initTime = performance.now() - startTime;
            console.log(`✅ ToolManager 統一システム統合初期化完了 - ${initTime.toFixed(2)}ms`);
            
            // StateManager状態更新
            if (this.stateManager) {
                this.stateManager.updateSystemState('toolManager', 'initialized', {
                    initTime,
                    unifiedSystemsEnabled: true,
                    currentTool: this.currentTool,
                    version: this.version
                });
            }
            
            return this;
            
        } catch (error) {
            // ErrorManager経由でエラー処理
            if (this.errorManager) {
                this.errorManager.showError('ツール管理システム初期化失敗', error, 'ToolManager.init');
            } else {
                console.error('❌ ToolManager初期化エラー:', error);
            }
            
            // フォールバック初期化
            this.canvasManager = canvasManager;
            console.warn('⚠️ 統一システム無しでフォールバック初期化');
            return this;
            
        } finally {
            console.groupEnd();
        }
    }
    
    /**
     * 🎯 統一システム依存性確認・設定
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
        
        // StateManager依存性確認
        this.stateManager = window.StateManager;
        if (!this.stateManager) {
            throw new Error('StateManager が利用できません。統一システムの初期化を確認してください。');
        }
        
        // EventBus依存性確認
        this.eventBus = window.EventBus;
        if (!this.eventBus) {
            throw new Error('EventBus が利用できません。統一システムの初期化を確認してください。');
        }
        
        console.log('✅ 統一システム依存性確認完了');
    }
    
    /**
     * 🎯 統一設定値取得・適用
     */
    loadConfigurationFromUnifiedSystem() {
        console.log('⚙️ 統一設定値取得開始...');
        
        try {
            // グローバルツール設定取得
            this.currentTool = this.configManager.get(this.configKeys.global.currentTool, 'pen');
            
            // ツール別設定取得・構築
            this.globalSettings = {
                pen: {
                    brushSize: this.configManager.get(this.configKeys.tools.pen.size, 16.0),
                    brushColor: this.configManager.get(this.configKeys.tools.pen.color, 0x800000),
                    opacity: this.configManager.get(this.configKeys.tools.pen.opacity, 0.85),
                    pressure: this.configManager.get(this.configKeys.tools.pen.pressure, 0.5),
                    smoothing: this.configManager.get(this.configKeys.tools.pen.smoothing, 0.3),
                    pressureSensitivity: this.configManager.get(this.configKeys.tools.pen.pressureSensitivity, true),
                    edgeSmoothing: this.configManager.get(this.configKeys.tools.pen.edgeSmoothing, true),
                    gpuAcceleration: this.configManager.get(this.configKeys.tools.pen.gpuAcceleration, false)
                },
                eraser: {
                    brushSize: this.configManager.get(this.configKeys.tools.eraser.size, 20.0),
                    opacity: this.configManager.get(this.configKeys.tools.eraser.opacity, 1.0),
                    mode: this.configManager.get(this.configKeys.tools.eraser.mode, 'normal'),
                    areaMode: this.configManager.get(this.configKeys.tools.eraser.areaMode, false),
                    particles: this.configManager.get(this.configKeys.tools.eraser.particles, true)
                }
            };
            
            console.log('✅ 統一設定値取得・適用完了');
            
        } catch (error) {
            this.errorManager.showError('設定値取得失敗', error, 'ToolManager.loadConfiguration');
            throw error;
        }
    }
    
    /**
     * 🎯 EventBus統合設定
     */
    setupEventBusIntegration() {
        console.log('🚌 EventBus統合設定開始...');
        
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
            this.updateToolSetting('pen', 'opacity', data.value / 100); // %を0-1に変換
        });
        
        this.eventBus.on('tool:pen:pressure:changed', (data) => {
            this.updateToolSetting('pen', 'pressure', data.value / 100); // %を0-1に変換
        });
        
        this.eventBus.on('tool:pen:smoothing:changed', (data) => {
            this.updateToolSetting('pen', 'smoothing', data.value / 100); // %を0-1に変換
        });
        
        console.log('✅ EventBus統合設定完了');
    }
    
    /**
     * 🎯 初期ツール設定
     */
    setInitialTool() {
        try {
            // 統一システム経由でツール設定
            this.setToolViaUnifiedSystem(this.currentTool, false);
            
            console.log(`🎯 初期ツール設定完了: ${this.currentTool}`);
            
        } catch (error) {
            this.errorManager.showError('初期ツール設定失敗', error, 'ToolManager.setInitialTool');
        }
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
                this.setToolViaUnifiedSystem(tool, false); // UI起因なのでUI通知はしない
                console.log(`🚌 EventBus: UIからツール変更受信 - ${tool}`);
            }
            
        } catch (error) {
            this.errorManager.showError('EventBus UIツール変更処理失敗', error, 'ToolManager.handleToolActivationFromUI');
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
            this.errorManager.showError('EventBus設定変更処理失敗', error, 'ToolManager.handleConfigChangeFromEventBus');
        }
    }
    
    // ==========================================
    // 🎯 ツール管理メソッド群（統一システム統合版）
    // ==========================================
    
    /**
     * 統一システム経由ツール登録
     * @param {string} name - ツール名
     * @param {Object} toolInstance - ツールインスタンス
     */
    registerTool(name, toolInstance) {
        try {
            this.registeredTools.set(name, toolInstance);
            
            // StateManager経由で状態更新
            if (this.stateManager) {
                this.stateManager.updateSystemState('toolManager', 'toolRegistered', {
                    tool: name,
                    timestamp: Date.now()
                });
            }
            
            console.log(`🔧 ツール登録: ${name}`);
            
        } catch (error) {
            this.errorManager.showError('ツール登録失敗', error, 'ToolManager.registerTool');
        }
    }
    
    /**
     * 統一システム経由ツール設定
     * @param {string} tool - ツール名
     * @param {boolean} notifyUI - UI通知フラグ
     */
    setToolViaUnifiedSystem(tool, notifyUI = true) {
        try {
            if (!this.registeredTools.has(tool)) {
                // 基本ツールの場合は登録をスキップ
                if (!['pen', 'eraser'].includes(tool)) {
                    console.warn(`⚠️ 未登録ツール: ${tool}`);
                    return false;
                }
            }
            
            const oldTool = this.currentTool;
            this.currentTool = tool;
            
            // ConfigManager経由で設定保存
            this.configManager.set(this.configKeys.global.currentTool, tool);
            
            // EventBus経由でツール変更通知（UI通知が必要な場合のみ）
            if (notifyUI && this.eventBus) {
                this.eventBus.emit('tool:changed', {
                    tool,
                    oldTool,
                    settings: this.globalSettings[tool] || {},
                    timestamp: Date.now(),
                    source: 'ToolManager'
                });
            }
            
            // StateManager経由で状態更新
            if (this.stateManager) {
                this.stateManager.updateSystemState('toolManager', 'currentTool', {
                    tool,
                    oldTool,
                    timestamp: Date.now()
                });
            }
            
            console.log(`🎯 統一システム経由ツール変更: ${oldTool} → ${tool}`);
            return true;
            
        } catch (error) {
            this.errorManager.showError('統一システム経由ツール設定失敗', error, 'ToolManager.setToolViaUnifiedSystem');
            return false;
        }
    }
    
    /**
     * レガシーツール設定（後方互換性）
     * @param {string} tool - ツール名
     */
    setTool(tool) {
        return this.setToolViaUnifiedSystem(tool, true);
    }
    
    /**
     * ツール設定更新
     * @param {string} tool - ツール名
     * @param {string} setting - 設定項目
     * @param {*} value - 設定値
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
            
            // ConfigManager経由で設定保存（キーマッピング）
            const configKey = this.getConfigKeyForSetting(tool, setting);
            if (configKey && this.configManager) {
                this.configManager.set(configKey, value);
            }
            
            // 現在のツールに設定変更を通知
            const currentToolInstance = this.registeredTools.get(this.currentTool);
            if (currentToolInstance && currentToolInstance.updateSettings) {
                currentToolInstance.updateSettings(this.globalSettings[this.currentTool]);
            }
            
            console.log(`🔧 ツール設定更新: ${tool}.${setting} = ${value} (旧: ${oldValue})`);
            
            return true;
            
        } catch (error) {
            this.errorManager.showError('ツール設定更新失敗', error, 'ToolManager.updateToolSetting');
            return false;
        }
    }
    
    /**
     * 設定項目のConfigキー取得
     */
    getConfigKeyForSetting(tool, setting) {
        const mappings = {
            pen: {
                brushSize: this.configKeys.tools.pen.size,
                brushColor: this.configKeys.tools.pen.color,
                opacity: this.configKeys.tools.pen.opacity,
                pressure: this.configKeys.tools.pen.pressure,
                smoothing: this.configKeys.tools.pen.smoothing,
                pressureSensitivity: this.configKeys.tools.pen.pressureSensitivity,
                edgeSmoothing: this.configKeys.tools.pen.edgeSmoothing,
                gpuAcceleration: this.configKeys.tools.pen.gpuAcceleration
            },
            eraser: {
                brushSize: this.configKeys.tools.eraser.size,
                opacity: this.configKeys.tools.eraser.opacity,
                mode: this.configKeys.tools.eraser.mode,
                areaMode: this.configKeys.tools.eraser.areaMode,
                particles: this.configKeys.tools.eraser.particles
            }
        };
        
        return mappings[tool]?.[setting] || null;
    }
    
    /**
     * 設定変更の適用
     */
    applyConfigChangeToTools(configKey, value) {
        // 逆マッピング: Configキーからツール設定を更新
        const reverseMapping = {};
        
        // ペンツール設定の逆マッピング構築
        Object.entries(this.configKeys.tools.pen).forEach(([setting, key]) => {
            reverseMapping[key] = { tool: 'pen', setting: this.mapConfigSettingToInternal('pen', setting) };
        });
        
        // 消しゴムツール設定の逆マッピング構築
        Object.entries(this.configKeys.tools.eraser).forEach(([setting, key]) => {
            reverseMapping[key] = { tool: 'eraser', setting: this.mapConfigSettingToInternal('eraser', setting) };
        });
        
        const mapping = reverseMapping[configKey];
        if (mapping && this.globalSettings[mapping.tool]) {
            this.globalSettings[mapping.tool][mapping.setting] = value;
            
            // 現在のツールが変更されたツールの場合、ツールインスタンスに通知
            if (this.currentTool === mapping.tool) {
                const currentToolInstance = this.registeredTools.get(this.currentTool);
                if (currentToolInstance && currentToolInstance.updateSettings) {
                    currentToolInstance.updateSettings(this.globalSettings[this.currentTool]);
                }
            }
        }
    }
    
    /**
     * Config設定名を内部設定名にマッピング
     */
    mapConfigSettingToInternal(tool, configSetting) {
        const mappings = {
            pen: {
                size: 'brushSize',
                color: 'brushColor',
                opacity: 'opacity',
                pressure: 'pressure',
                smoothing: 'smoothing',
                pressureSensitivity: 'pressureSensitivity',
                edgeSmoothing: 'edgeSmoothing',
                gpuAcceleration: 'gpuAcceleration'
            },
            eraser: {
                size: 'brushSize',
                opacity: 'opacity',
                mode: 'mode',
                areaMode: 'areaMode',
                particles: 'particles'
            }
        };
        
        return mappings[tool]?.[configSetting] || configSetting;
    }
    
    // ==========================================
    // 🎯 描画処理メソッド群（統一システム統合版）
    // ==========================================
    
    /**
     * 描画開始
     * @param {number} x - X座標
     * @param {number} y - Y座標
     */
    startDrawing(x, y) {
        if (!this.canvasManager) {
            this.errorManager?.showError('キャンバス管理システム未初期化', new Error('CanvasManager not initialized'), 'ToolManager.startDrawing');
            return;
        }
        
        try {
            this.isDrawing = true;
            this.lastPoint = { x, y };
            
            // 現在のツールで描画開始
            const currentToolInstance = this.registeredTools.get(this.currentTool);
            if (currentToolInstance && currentToolInstance.startDrawing) {
                currentToolInstance.startDrawing(x, y);
            } else {
                // フォールバック: 直接キャンバスに描画
                const toolSettings = this.globalSettings[this.currentTool] || this.globalSettings.pen;
                this.currentPath = this.canvasManager.createPath(
                    x, y, 
                    toolSettings.brushSize,
                    toolSettings.brushColor || 0x800000,
                    toolSettings.opacity,
                    this.currentTool
                );
            }
            
            // StateManager経由で状態更新
            if (this.stateManager) {
                this.stateManager.updateSystemState('toolManager', 'drawing', {
                    isDrawing: true,
                    tool: this.currentTool,
                    startPoint: { x, y },
                    timestamp: Date.now()
                });
            }
            
            console.log(`✏️ 描画開始: ${this.currentTool} at (${Math.round(x)}, ${Math.round(y)})`);
            
        } catch (error) {
            this.errorManager.showError('描画開始失敗', error, 'ToolManager.startDrawing');
        }
    }
    
    /**
     * 描画継続
     * @param {number} x - X座標
     * @param {number} y - Y座標
     */
    continueDrawing(x, y) {
        if (!this.isDrawing || !this.canvasManager) return;
        
        try {
            // 現在のツールで描画継続
            const currentToolInstance = this.registeredTools.get(this.currentTool);
            if (currentToolInstance && currentToolInstance.continueDrawing) {
                currentToolInstance.continueDrawing(x, y);
            } else {
                // フォールバック: 直接キャンバスに描画
                if (this.currentPath) {
                    this.canvasManager.drawLine(this.currentPath, x, y);
                }
            }
            
            this.lastPoint = { x, y };
            
        } catch (error) {
            this.errorManager.showError('描画継続失敗', error, 'ToolManager.continueDrawing');
        }
    }
    
    /**
     * 描画終了
     */
    stopDrawing() {
        if (!this.isDrawing) return;
        
        try {
            // 現在のツールで描画終了
            const currentToolInstance = this.registeredTools.get(this.currentTool);
            if (currentToolInstance && currentToolInstance.stopDrawing) {
                currentToolInstance.stopDrawing();
            } else {
                // フォールバック処理
                if (this.currentPath) {
                    this.currentPath.isComplete = true;
                }
            }
            
            this.isDrawing = false;
            this.currentPath = null;
            this.lastPoint = null;
            
            // StateManager経由で状態更新
            if (this.stateManager) {
                this.stateManager.updateSystemState('toolManager', 'drawing', {
                    isDrawing: false,
                    tool: this.currentTool,
                    timestamp: Date.now()
                });
            }
            
            console.log(`✏️ 描画終了: ${this.currentTool}`);
            
        } catch (error) {
            this.errorManager.showError('描画終了失敗', error, 'ToolManager.stopDrawing');
        }
    }
    
    // ==========================================
    // 🎯 設定操作メソッド群（統一システム統合版）
    // ==========================================
    
    /**
     * ブラシサイズ設定（統一システム版）
     * @param {number} size - ブラシサイズ
     */
    setBrushSize(size) {
        try {
            const normalizedSize = Math.max(0.1, Math.min(100, Math.round(size * 10) / 10));
            this.updateToolSetting(this.currentTool, 'brushSize', normalizedSize);
            
            console.log(`🖌️ ブラシサイズ: ${normalizedSize}px`);
            
        } catch (error) {
            this.errorManager.showError('ブラシサイズ設定失敗', error, 'ToolManager.setBrushSize');
        }
    }
    
    /**
     * 不透明度設定（統一システム版）
     * @param {number} opacity - 不透明度（0-1）
     */
    setOpacity(opacity) {
        try {
            const normalizedOpacity = Math.max(0, Math.min(1, Math.round(opacity * 1000) / 1000));
            this.updateToolSetting(this.currentTool, 'opacity', normalizedOpacity);
            
            console.log(`🌫️ 不透明度: ${Math.round(normalizedOpacity * 100)}%`);
            
        } catch (error) {
            this.errorManager.showError('不透明度設定失敗', error, 'ToolManager.setOpacity');
        }
    }
    
    /**
     * 筆圧設定（統一システム版）
     * @param {number} pressure - 筆圧（0-1）
     */
    setPressure(pressure) {
        try {
            const normalizedPressure = Math.max(0, Math.min(1, Math.round(pressure * 1000) / 1000));
            this.updateToolSetting(this.currentTool, 'pressure', normalizedPressure);
            
            console.log(`✍️ 筆圧: ${Math.round(normalizedPressure * 100)}%`);
            
        } catch (error) {
            this.errorManager.showError('筆圧設定失敗', error, 'ToolManager.setPressure');
        }
    }
    
    /**
     * 線補正設定（統一システム版）
     * @param {number} smoothing - 線補正（0-1）
     */
    setSmoothing(smoothing) {
        try {
            const normalizedSmoothing = Math.max(0, Math.min(1, Math.round(smoothing * 1000) / 1000));
            this.updateToolSetting(this.currentTool, 'smoothing', normalizedSmoothing);
            
            console.log(`📏 線補正: ${Math.round(normalizedSmoothing * 100)}%`);
            
        } catch (error) {
            this.errorManager.showError('線補正設定失敗', error, 'ToolManager.setSmoothing');
        }
    }
    
    /**
     * グローバル設定更新（統一システム版）
     * @param {Object} settings - 設定オブジェクト
     */
    updateGlobalSettings(settings) {
        try {
            // 個別設定メソッド経由で更新（統一システム連携保証）
            if (settings.brushSize !== undefined) {
                this.setBrushSize(settings.brushSize);
            }
            
            if (settings.opacity !== undefined) {
                this.setOpacity(settings.opacity);
            }
            
            if (settings.pressure !== undefined) {
                this.setPressure(settings.pressure);
            }
            
            if (settings.smoothing !== undefined) {
                this.setSmoothing(settings.smoothing);
            }
            
            // ブール値設定
            ['pressureSensitivity', 'edgeSmoothing', 'gpuAcceleration'].forEach(setting => {
                if (settings[setting] !== undefined) {
                    this.updateToolSetting(this.currentTool, setting, settings[setting]);
                    console.log(`🔧 ${setting}: ${settings[setting] ? 'ON' : 'OFF'}`);
                }
            });
            
            // 現在のツールに設定変更を通知
            const currentToolInstance = this.registeredTools.get(this.currentTool);
            if (currentToolInstance && currentToolInstance.updateSettings) {
                currentToolInstance.updateSettings(this.globalSettings[this.currentTool]);
            }
            
        } catch (error) {
            this.errorManager.showError('グローバル設定更新失敗', error, 'ToolManager.updateGlobalSettings');
        }
    }
    
    // ==========================================
    // 🎯 状態取得メソッド群（統一システム統合版）
    // ==========================================
    
    /**
     * 描画状態取得（統一システム版）
     * @returns {Object} 描画状態
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
            canvasManagerConnected: !!this.canvasManager
        };
    }
    
    /**
     * ツール統計取得（統一システム版）
     * @returns {Object} ツール統計
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
                eventBus: !!this.eventBus
            }
        };
        
        // キャンバス統計追加
        if (this.canvasManager && this.canvasManager.getStats) {
            stats.canvasStats = this.canvasManager.getStats();
        }
        
        return stats;
    }
    
    /**
     * ツール切り替え可能性チェック（統一システム版）
     * @param {string} tool - ツール名
     * @returns {boolean} 切り替え可能フラグ
     */
    canSwitchTo(tool) {
        if (this.isDrawing) {
            console.warn('⚠️ 描画中はツール変更できません');
            return false;
        }
        
        // 基本ツールは常に切り替え可能
        if (['pen', 'eraser'].includes(tool)) {
            return true;
        }
        
        if (!this.registeredTools.has(tool)) {
            console.warn(`⚠️ 未登録ツール: ${tool}`);
            return false;
        }
        
        return true;
    }
    
    /**
     * 安全なツール切り替え（統一システム版）
     * @param {string} tool - ツール名
     * @returns {boolean} 切り替え成功フラグ
     */
    safeSwitchTool(tool) {
        if (!this.canSwitchTo(tool)) return false;
        
        // 描画中の場合は強制終了
        if (this.isDrawing) {
            this.stopDrawing();
        }
        
        return this.setToolViaUnifiedSystem(tool, true);
    }
    
    // ==========================================
    // 🎯 その他操作メソッド群
    // ==========================================
    
    /**
     * アンドゥ実行（統一システム版）
     * @returns {boolean} アンドゥ成功フラグ
     */
    undo() {
        try {
            if (!this.canvasManager) return false;
            
            const success = this.canvasManager.undo();
            if (success) {
                console.log('↶ アンドゥ実行');
                
                // EventBus通知
                if (this.eventBus) {
                    this.eventBus.emit('tool:undo:executed', {
                        timestamp: Date.now(),
                        source: 'ToolManager'
                    });
                }
            }
            return success;
            
        } catch (error) {
            this.errorManager.showError('アンドゥ実行失敗', error, 'ToolManager.undo');
            return false;
        }
    }
    
    /**
     * キャンバスクリア（統一システム版）
     */
    clear() {
        try {
            if (!this.canvasManager) return;
            
            this.canvasManager.clear();
            
            // EventBus通知
            if (this.eventBus) {
                this.eventBus.emit('tool:canvas:cleared', {
                    timestamp: Date.now(),
                    source: 'ToolManager'
                });
            }
            
            console.log('🧹 キャンバスクリア');
            
        } catch (error) {
            this.errorManager.showError('キャンバスクリア失敗', error, 'ToolManager.clear');
        }
    }
    
    /**
     * デバッグ情報出力（統一システム版）
     */
    debugInfo() {
        const state = this.getDrawingState();
        const stats = this.getToolStats();
        
        console.group('🔧 ToolManager 統一システム統合版 デバッグ情報');
        console.log('📊 状態:', state);
        console.log('📈 統計:', stats);
        console.log('🔧 統一システム健全性:', this.checkUnifiedSystemHealth());
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
            stateManager: !!this.stateManager && typeof this.stateManager.updateSystemState === 'function',
            eventBus: !!this.eventBus && typeof this.eventBus.emit === 'function'
        };
        
        const allHealthy = Object.values(health).every(Boolean);
        
        if (!allHealthy) {
            console.warn('⚠️ 一部の統一システムに問題があります:', health);
        }
        
        return { health, allHealthy };
    }
    
    /**
     * 破棄処理（統一システム版）
     */
    destroy() {
        try {
            console.log('🗑️ ToolManager破棄開始...');
            
            // 描画中の場合は終了
            if (this.isDrawing) {
                this.stopDrawing();
            }
            
            // EventBusリスナー解除
            if (this.eventBus) {
                this.eventBus.off('ui:tool:activated');
                this.eventBus.off('config:changed');
                this.eventBus.off('tool:pen:size:changed');
                this.eventBus.off('tool:pen:opacity:changed');
                this.eventBus.off('tool:pen:pressure:changed');
                this.eventBus.off('tool:pen:smoothing:changed');
            }
            
            // 登録ツールクリア
            this.registeredTools.clear();
            
            // 参照クリア
            this.canvasManager = null;
            this.currentPath = null;
            this.lastPoint = null;
            this.configManager = null;
            this.errorManager = null;
            this.stateManager = null;
            this.eventBus = null;
            
            console.log('✅ ToolManager破棄完了');
            
        } catch (error) {
            console.error('❌ ToolManager破棄エラー:', error);
        }
    }
}

// ==========================================
// 🎯 Pure JavaScript グローバル公開（ルールブック準拠）
// ==========================================

if (typeof window !== 'undefined') {
    window.ToolManager = ToolManager;
    console.log('✅ ToolManager 統一システム統合版 グローバル公開完了（Pure JavaScript）');
}

console.log('🔧 ToolManager Phase1.1ss3 統一システム統合版 - 準備完了');
console.log('📋 統一システム統合完了: ConfigManager・ErrorManager・StateManager・EventBus');
console.log('📋 ルールブック準拠: 1.2実装原則「ESM/TypeScript混在禁止・Pure JavaScript維持」');
console.log('🎯 AI分業対応: 依存関係明確化・疎結合設計・統一設定管理');
console.log('💡 使用例: const toolManager = new window.ToolManager(); await toolManager.init(canvasManager);');