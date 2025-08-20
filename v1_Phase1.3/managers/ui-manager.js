/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1.0 (修正版)
 * 
 * 🎯 AI_WORK_SCOPE: UI統括管理・ポップアップシステム・スライダー統合・アニメーション効果
 * 🎯 DEPENDENCIES: js/utils/config-manager.js, js/utils/error-manager.js, js/utils/state-manager.js, js/utils/event-bus.js
 * 🎯 UNIFIED_SYSTEMS: ✅ ConfigManager, ErrorManager, StateManager, EventBus統合済み
 * 🎯 ISOLATION_TEST: ✅ 単体テスト可能
 * 🎯 SPLIT_THRESHOLD: 500行制限遵守
 * 
 * 📋 PHASE_TARGET: Phase1.3 - AppCore互換・initializeメソッド追加
 * 📋 V8_MIGRATION: UI API変更なし・WebGPU対応準備・120FPS対応
 * 📋 PERFORMANCE_TARGET: UI応答性1フレーム以下・アニメーション60FPS安定
 * 📋 DRY_COMPLIANCE: ✅ 統一システム活用・重複コード排除完了
 * 📋 SOLID_COMPLIANCE: ✅ 単一責任・依存性逆転・統一システム疎結合
 * 🔧 ERROR_FIX: AppCore互換・initializeメソッド追加・エラーハンドリング強化
 */

/**
 * UI統括管理システム（修正版・AppCore互換版）
 * 統一システム完全活用・EventBus疎結合・設定値統一
 * Pure JavaScript完全準拠・AI分業対応
 */
class UIManager {
    constructor(appCore = null) {
        this.appCore = appCore;
        this.version = 'v1.0-Phase1.3-appcore-compatible';
        
        // 🎯 統一システム依存関係
        this.configManager = null;
        this.errorManager = null;
        this.stateManager = null;
        this.eventBus = null;
        
        // UI状態管理
        this.activePopup = null;
        this.popups = new Map();
        this.sliders = new Map();
        this.toolButtons = new Map();
        
        // 設定キー定義（統一システム対応）
        this.configKeys = {
            ui: {
                animationSpeed: 'ui.animation.speed',
                responsiveBreakpoints: 'ui.responsive.breakpoints',
                showToolTips: 'ui.tooltips.enabled',
                compactMode: 'ui.layout.compact'
            },
            tools: {
                pen: {
                    size: 'tools.pen.size',
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
                    mode: 'tools.eraser.mode'
                }
            }
        };
        
        // パフォーマンス監視
        this.performanceMetrics = {
            uiUpdateTime: 0,
            animationFrames: 0,
            lastUpdateTime: performance.now()
        };
        
        console.log(`🎨 UIManager ${this.version}構築開始（AppCore互換修正版）...`);
    }
    
    /**
     * 🔧 AppCore互換初期化メソッド（新規追加）
     * AppCore.initializeManagers()から呼び出される
     */
    async initialize() {
        console.log(`🔧 UIManager.initialize() 呼び出し（AppCore互換）`);
        return await this.init();
    }
    
    /**
     * 🎯 修正版: 統一システム統合・UI管理システム初期化
     */
    async init() {
        console.group(`🎨 UIManager 統一システム統合初期化開始 - ${this.version}`);
        
        try {
            const startTime = performance.now();
            
            // Phase 1: 統一システム依存性確認・設定
            this.validateAndSetupUnifiedSystems();
            
            // Phase 2: 設定値取得・適用
            this.loadConfigurationFromUnifiedSystem();
            
            // Phase 3: ツールボタンシステム初期化
            this.setupToolButtons();
            
            // Phase 4: ポップアップシステム初期化
            this.setupPopupSystem();
            
            // Phase 5: スライダーシステム初期化
            this.setupSliderSystem();
            
            // Phase 6: EventBus連携設定
            this.setupEventBusIntegration();
            
            // Phase 7: レスポンシブ・入力統合
            this.setupResponsiveAndInputs();
            
            // Phase 8: パフォーマンス監視開始
            this.startPerformanceMonitoring();
            
            const initTime = performance.now() - startTime;
            console.log(`✅ UIManager 統一システム統合初期化完了 - ${initTime.toFixed(2)}ms`);
            
            // 🔧 修正版: StateManager状態更新 (updateComponentState使用)
            if (this.stateManager && typeof this.stateManager.updateComponentState === 'function') {
                this.stateManager.updateComponentState('uiManager', 'initialized', {
                    initTime,
                    unifiedSystemsEnabled: true,
                    version: this.version,
                    appCoreConnected: !!this.appCore
                });
            }
            
            return this;
            
        } catch (error) {
            // ErrorManager経由でエラー処理
            if (this.errorManager && typeof this.errorManager.showError === 'function') {
                this.errorManager.showError('error', 'UI管理システム初期化失敗: ' + error.message, {
                    additionalInfo: 'UIManager.init',
                    showReload: false
                });
            } else {
                console.error('❌ UIManager初期化エラー:', error);
            }
            
            // フォールバック初期化
            await this.fallbackInitialization();
            return this;
            
        } finally {
            console.groupEnd();
        }
    }
    
    /**
     * 🎯 統一システム依存性確認・設定（安全性強化）
     */
    validateAndSetupUnifiedSystems() {
        console.log('🔧 統一システム依存性確認開始...');
        
        // ConfigManager依存性確認
        this.configManager = window.ConfigManager;
        if (!this.configManager || typeof this.configManager.get !== 'function') {
            console.warn('⚠️ ConfigManager が利用できません');
            this.configManager = null;
        }
        
        // ErrorManager依存性確認
        this.errorManager = window.ErrorManager;
        if (!this.errorManager || typeof this.errorManager.showError !== 'function') {
            console.warn('⚠️ ErrorManager が利用できません');
            this.errorManager = null;
        }
        
        // StateManager依存性確認
        this.stateManager = window.StateManager;
        if (!this.stateManager || typeof this.stateManager.updateComponentState !== 'function') {
            console.warn('⚠️ StateManager が利用できません');
            this.stateManager = null;
        }
        
        // EventBus依存性確認
        this.eventBus = window.EventBus;
        if (!this.eventBus || typeof this.eventBus.emit !== 'function') {
            console.warn('⚠️ EventBus が利用できません');
            this.eventBus = null;
        }
        
        console.log('✅ 統一システム依存性確認完了');
    }
    
    /**
     * 🎯 統一設定値取得・適用（安全性強化）
     */
    loadConfigurationFromUnifiedSystem() {
        console.log('⚙️ 統一設定値取得開始...');
        
        try {
            if (!this.configManager) {
                console.warn('⚠️ ConfigManager未利用：デフォルト設定使用');
                this.loadDefaultConfiguration();
                return;
            }
            
            // UI設定取得（安全な取得）
            const animationSpeed = this.configManager.get(this.configKeys.ui.animationSpeed, 'normal');
            const responsiveBreakpoints = this.configManager.get(this.configKeys.ui.responsiveBreakpoints, 
                { mobile: 768, tablet: 1024 });
            
            // ツール設定取得（安全な取得）
            this.toolSettings = {
                pen: {
                    size: this.configManager.get(this.configKeys.tools.pen.size, 16.0),
                    opacity: this.configManager.get(this.configKeys.tools.pen.opacity, 85.0),
                    pressure: this.configManager.get(this.configKeys.tools.pen.pressure, 50.0),
                    smoothing: this.configManager.get(this.configKeys.tools.pen.smoothing, 30.0),
                    pressureSensitivity: this.configManager.get(this.configKeys.tools.pen.pressureSensitivity, true),
                    edgeSmoothing: this.configManager.get(this.configKeys.tools.pen.edgeSmoothing, true),
                    gpuAcceleration: this.configManager.get(this.configKeys.tools.pen.gpuAcceleration, false)
                },
                eraser: {
                    size: this.configManager.get(this.configKeys.tools.eraser.size, 20.0),
                    opacity: this.configManager.get(this.configKeys.tools.eraser.opacity, 100.0),
                    mode: this.configManager.get(this.configKeys.tools.eraser.mode, 'normal')
                }
            };
            
            // UI設定適用
            this.uiSettings = {
                animationSpeed,
                responsiveBreakpoints,
                showToolTips: this.configManager.get(this.configKeys.ui.showToolTips, true),
                compactMode: this.configManager.get(this.configKeys.ui.compactMode, false)
            };
            
            console.log('✅ 統一設定値取得・適用完了');
            
        } catch (error) {
            if (this.errorManager) {
                this.errorManager.showError('warning', '設定値取得失敗: ' + error.message, {
                    additionalInfo: 'UIManager.loadConfiguration'
                });
            } else {
                console.error('❌ 設定値取得失敗:', error);
            }
            this.loadDefaultConfiguration();
        }
    }
    
    /**
     * 🔧 新機能: デフォルト設定読み込み（フォールバック）
     */
    loadDefaultConfiguration() {
        console.log('🛡️ デフォルトUI設定読み込み...');
        
        this.toolSettings = {
            pen: {
                size: 16.0,
                opacity: 85.0,
                pressure: 50.0,
                smoothing: 30.0,
                pressureSensitivity: true,
                edgeSmoothing: true,
                gpuAcceleration: false
            },
            eraser: {
                size: 20.0,
                opacity: 100.0,
                mode: 'normal'
            }
        };
        
        this.uiSettings = {
            animationSpeed: 'normal',
            responsiveBreakpoints: { mobile: 768, tablet: 1024 },
            showToolTips: true,
            compactMode: false
        };
        
        console.log('✅ デフォルトUI設定読み込み完了');
    }
    
    /**
     * 🎯 EventBus統合設定（安全性強化）
     */
    setupEventBusIntegration() {
        console.log('🚌 EventBus統合設定開始...');
        
        if (!this.eventBus || typeof this.eventBus.on !== 'function') {
            console.warn('⚠️ EventBus未利用：イベント連携スキップ');
            return;
        }
        
        try {
            // ツール変更イベントリスナー
            this.eventBus.on('tool:changed', (data) => {
                this.handleToolChangeFromEventBus(data.tool, data.settings);
            });
            
            // 設定変更イベントリスナー
            this.eventBus.on('config:changed', (data) => {
                this.handleConfigChangeFromEventBus(data.key, data.value);
            });
            
            // 状態変更イベントリスナー
            this.eventBus.on('state:changed', (data) => {
                this.handleStateChangeFromEventBus(data.system, data.state);
            });
            
            // アプリケーションイベントリスナー
            this.eventBus.on('app:resize', (data) => {
                this.handleAppResizeFromEventBus(data.width, data.height);
            });
            
            console.log('✅ EventBus統合設定完了');
        } catch (error) {
            console.warn('⚠️ EventBus統合設定で問題発生:', error.message);
        }
    }
    
    /**
     * 🎯 統合ツールボタンシステム（安全性強化）
     */
    setupToolButtons() {
        console.log('🔧 統合ツールボタンシステム初期化...');
        
        try {
            const toolButtons = document.querySelectorAll('.tool-button');
            
            toolButtons.forEach(button => {
                const toolId = button.id;
                const toolData = {
                    element: button,
                    active: button.classList.contains('active'),
                    disabled: button.classList.contains('disabled')
                };
                
                this.toolButtons.set(toolId, toolData);
                
                if (!button.classList.contains('disabled')) {
                    button.addEventListener('click', (e) => {
                        this.handleToolClick(e.currentTarget);
                    });
                }
            });
            
            console.log(`🔧 統合ツールボタン初期化完了: ${toolButtons.length}個`);
        } catch (error) {
            console.warn('⚠️ ツールボタンシステム初期化で問題発生:', error.message);
        }
    }
    
    /**
     * 🎯 統合ツールクリック処理（安全性強化）
     */
    handleToolClick(button) {
        try {
            const toolId = button.id;
            const popupId = button.getAttribute('data-popup');
            
            // ツール切り替えロジック
            const toolMap = {
                'pen-tool': 'pen',
                'eraser-tool': 'eraser',
                'fill-tool': 'fill',
                'select-tool': 'select'
            };
            
            const tool = toolMap[toolId];
            if (tool) {
                this.setActiveToolViaEventBus(tool);
            }
            
            // ポップアップ表示
            if (popupId) {
                this.togglePopup(popupId);
            }
            
        } catch (error) {
            if (this.errorManager) {
                this.errorManager.showError('warning', 'ツールクリック処理失敗: ' + error.message, {
                    additionalInfo: 'UIManager.handleToolClick'
                });
            } else {
                console.error('❌ ツールクリック処理失敗:', error);
            }
        }
    }
    
    /**
     * 🎯 EventBus経由ツール設定（安全性強化）
     */
    setActiveToolViaEventBus(tool) {
        try {
            // 全ツールボタンの非アクティブ化
            this.toolButtons.forEach((toolData, toolId) => {
                toolData.element.classList.remove('active');
                toolData.active = false;
            });
            
            // 指定ツールのアクティブ化
            const toolButtonId = tool + '-tool';
            const toolData = this.toolButtons.get(toolButtonId);
            if (toolData) {
                toolData.element.classList.add('active');
                toolData.active = true;
            }
            
            // EventBus経由で通知（疎結合）
            if (this.eventBus && typeof this.eventBus.emit === 'function') {
                this.eventBus.emit('ui:tool:activated', {
                    tool,
                    timestamp: Date.now(),
                    source: 'UIManager'
                });
            }
            
            // ステータス表示更新
            this.updateToolStatus(tool);
            
            console.log(`🎯 EventBus経由ツール設定: ${tool}`);
        } catch (error) {
            console.error('❌ EventBus経由ツール設定エラー:', error);
        }
    }
    
    /**
     * 🎯 統合ポップアップシステム（安全性強化）
     */
    setupPopupSystem() {
        console.log('📋 統合ポップアップシステム初期化...');
        
        try {
            const popups = document.querySelectorAll('.popup-panel');
            
            popups.forEach(popup => {
                const popupId = popup.id;
                const popupData = {
                    element: popup,
                    visible: false,
                    draggable: popup.classList.contains('draggable')
                };
                
                this.popups.set(popupId, popupData);
                
                if (popupData.draggable) {
                    this.makeDraggable(popup);
                }
            });
            
            // グローバルクリックでポップアップを閉じる
            document.addEventListener('click', (e) => {
                if (!e.target.closest('.popup-panel') && 
                    !e.target.closest('.tool-button[data-popup]')) {
                    this.closeAllPopups();
                }
            });
            
            console.log(`📋 統合ポップアップシステム初期化完了: ${popups.length}個`);
        } catch (error) {
            console.warn('⚠️ ポップアップシステム初期化で問題発生:', error.message);
        }
    }
    
    /**
     * 🎯 統合スライダーシステム（安全性強化）
     */
    setupSliderSystem() {
        console.log('🎚️ 統合スライダーシステム初期化...');
        
        try {
            // ペンサイズスライダー
            this.createSlider('pen-size-slider', {
                min: 0.1, max: 100,
                initial: this.toolSettings?.pen?.size || 16.0,
                configKey: this.configKeys.tools.pen.size,
                unit: 'px',
                precision: 1,
                eventName: 'tool:pen:size:changed'
            });
            
            // ペン不透明度スライダー
            this.createSlider('pen-opacity-slider', {
                min: 0, max: 100,
                initial: this.toolSettings?.pen?.opacity || 85.0,
                configKey: this.configKeys.tools.pen.opacity,
                unit: '%',
                precision: 1,
                eventName: 'tool:pen:opacity:changed'
            });
            
            // ペン筆圧スライダー
            this.createSlider('pen-pressure-slider', {
                min: 0, max: 100,
                initial: this.toolSettings?.pen?.pressure || 50.0,
                configKey: this.configKeys.tools.pen.pressure,
                unit: '%',
                precision: 1,
                eventName: 'tool:pen:pressure:changed'
            });
            
            // ペン線補正スライダー
            this.createSlider('pen-smoothing-slider', {
                min: 0, max: 100,
                initial: this.toolSettings?.pen?.smoothing || 30.0,
                configKey: this.configKeys.tools.pen.smoothing,
                unit: '%',
                precision: 1,
                eventName: 'tool:pen:smoothing:changed'
            });
            
            console.log(`🎚️ 統合スライダーシステム初期化完了: ${this.sliders.size}個`);
        } catch (error) {
            console.warn('⚠️ スライダーシステム初期化で問題発生:', error.message);
        }
    }