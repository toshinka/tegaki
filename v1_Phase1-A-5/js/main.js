/**
 * 🎨 ふたば☆お絵描きツール - 統一版メインアプリケーション（Task 1-A-1 完全統合版）
 * 🎯 AI_WORK_SCOPE: アプリケーション統括・統一初期化・イベント協調
 * 🎯 DEPENDENCIES: ConfigManager, ErrorManager, StateManager, EventBus, AppCore
 * 🎯 PIXI_EXTENSIONS: 基本利用（PixiExtensions経由）
 * 🎯 ISOLATION_TEST: ConfigManager等依存のため困難
 * 🎯 SPLIT_THRESHOLD: 300行以下維持
 * 📋 PHASE_TARGET: Phase1統一化完了版
 * 📋 V8_MIGRATION: ConfigManager経由でv8対応準備済み
 * 🚨 Task 1-A-1: 統一システム依存性確認・設定値統一・エラー処理統一・状態管理統一・旧関数移譲
 * 🔧 FIX: AppCore依存関係確認強化・詳細エラーログ追加・フォールバック処理改善
 */

/**
 * ふたば☆お絵描きツール - 統一版メインクラス（Task 1-A-1 完全統合版）
 * DRY・SOLID原則完全準拠・統一システム完全活用
 */
class FutabaDrawingTool {
    constructor() {
        // 🚨 Task 1-A-1: ConfigManager経由での設定取得（ハードコード排除）
        this.config = this.loadUnifiedConfig();
        this.version = this.config.version;
        
        this.isInitialized = false;
        this.startTime = performance.now();
        
        // 統一状態管理
        this.appCore = null;
        this.initializationSteps = [];
        
        // 初期化段階フラグ
        this.isInitializing = false;
        
        console.log(`🎨 ${this.version} 初期化開始（Task 1-A-1 統合版）`);
        console.log('🔧 統一システム: ConfigManager + ErrorManager + StateManager + EventBus');
        console.log('🎯 Phase 1-A-1: 統一システム完全統合・DRY・SOLID原則準拠');
    }
    
    /**
     * 🚨 Task 1-A-1: 統一設定値読み込み（ハードコード完全排除）
     */
    loadUnifiedConfig() {
        if (!window.ConfigManager) {
            throw new Error('ConfigManager が利用できません - 統一システム依存関係エラー');
        }
        
        return {
            version: 'v1.0-Phase1-Unified-Task1A1',
            performance: window.ConfigManager.getPerformanceConfig(),
            canvas: window.ConfigManager.getCanvasConfig(),
            drawing: window.ConfigManager.getDrawingConfig(),
            ui: window.ConfigManager.getUIConfig(),
            error: window.ConfigManager.getErrorConfig(),
            colors: window.ConfigManager.getColors()
        };
    }
    
    /**
     * 🚨 Task 1-A-1: 統一システム依存性確認処理（新規追加）
     */
    async validateUnifiedSystems() {
        console.log('🔍 統一システム依存性確認開始（Task 1-A-1）...');
        
        const requiredSystems = [
            { name: 'ConfigManager', check: () => window.ConfigManager },
            { name: 'ErrorManager', check: () => window.ErrorManager },
            { name: 'StateManager', check: () => window.StateManager },
            { name: 'EventBus', check: () => window.EventBus }
        ];
        
        const missing = [];
        const available = {};
        
        // 各統一システムの存在確認
        requiredSystems.forEach(system => {
            if (system.check()) {
                available[system.name] = 'OK';
                console.log(`✅ ${system.name}: 利用可能`);
            } else {
                missing.push(system.name);
                console.error(`❌ ${system.name}: 未初期化`);
            }
        });
        
        // 統一システムの機能確認
        if (window.ConfigManager) {
            const debugInfo = window.ConfigManager.getDebugInfo();
            console.log(`📊 ConfigManager: ${debugInfo.totalSettings}個の設定項目`);
            available.ConfigManager = `${debugInfo.totalSettings} settings`;
        }
        
        if (window.ErrorManager) {
            const errorStats = window.ErrorManager.getErrorStats();
            console.log(`📊 ErrorManager: ${errorStats.total}個のエラーログ`);
            available.ErrorManager = `${errorStats.total} errors logged`;
        }
        
        if (window.StateManager) {
            const healthCheck = window.StateManager.healthCheck();
            console.log(`📊 StateManager: スコア${healthCheck.score}/100`);
            available.StateManager = `Health: ${healthCheck.score}`;
        }
        
        if (window.EventBus) {
            const eventStats = window.EventBus.getStats();
            console.log(`📊 EventBus: ${eventStats.totalListeners}個のリスナー`);
            available.EventBus = `${eventStats.totalListeners} listeners`;
        }
        
        if (missing.length > 0) {
            throw new Error(`統一システム依存関係不足: ${missing.join(', ')}`);
        }
        
        console.log('✅ 統一システム依存性確認完了:', available);
        this.initializationSteps.push('unified-systems');
        
        return { available, missing };
    }
    
    /**
     * 統一初期化シーケンス（Task 1-A-1 統合版）
     */
    async initialize() {
        try {
            console.log('🚀 統一初期化シーケンス開始（Task 1-A-1）');
            
            this.isInitializing = true;
            
            // 🚨 Task 1-A-1: Step 1: 統一システム依存性確認（新規）
            await this.validateUnifiedSystems();
            
            // Step 2: 基本依存関係確認（従来版）
            await this.validateBasicDependencies();
            
            // Step 3: 基盤システム初期化
            await this.initializeFoundationSystems();
            
            // Step 4: AppCore初期化
            await this.initializeAppCore();
            
            // Step 5: システム統合・イベント連携
            this.setupSystemIntegration();
            
            // Step 6: 機能有効化
            this.enableFeatures();
            
            // Step 7: 完了処理
            this.finalizeInitialization();
            
            this.isInitializing = false;
            this.isInitialized = true;
            
            const initTime = performance.now() - this.startTime;
            
            console.log('🎉 統一初期化完了！（Task 1-A-1）');
            console.log(`⏱️ 初期化時間: ${initTime.toFixed(2)}ms`);
            
            // 🚨 Task 1-A-1: StateManager経由での状態表示
            this.displayInitializationSummary();
            
            // EventBus経由での初期化完了イベント発行
            this.emitInitializationComplete(initTime);
            
        } catch (error) {
            console.error('💀 統一初期化失敗:', error);
            
            // 🚨 Task 1-A-1: ErrorManager経由での統一エラー処理
            this.handleInitializationError(error);
            
            // フォールバック試行
            await this.attemptFallbackInitialization(error);
        } finally {
            this.isInitializing = false;
        }
    }
    
    /**
     * 🔧 基本依存関係確認（ConfigManager統合版・強化版）
     */
    async validateBasicDependencies() {
        console.log('🔍 基本依存関係確認（統合版・強化版）...');
        
        // 🚨 Task 1-A-1: ConfigManager経由での依存関係リスト取得
        const requiredLibraries = window.ConfigManager.get('dependencies') || [
            'PIXI', 'AppCore'
        ];
        
        const missing = [];
        const available = {};
        const detailedInfo = {};
        
        // 基本ライブラリ確認（詳細版）
        if (!window.PIXI) {
            missing.push('PixiJS');
            detailedInfo.PIXI = 'ライブラリ未読み込み';
        } else {
            available.PIXI = window.PIXI.VERSION;
            detailedInfo.PIXI = `バージョン: ${window.PIXI.VERSION}`;
            console.log(`✅ PixiJS: ${window.PIXI.VERSION}`);
        }
        
        // 🔧 AppCore確認（詳細版）
        if (!window.AppCore) {
            missing.push('AppCore');
            detailedInfo.AppCore = 'クラス未定義 - js/app-core.js読み込み失敗の可能性';
            
            // 🔧 AppCore読み込み失敗の詳細分析
            console.error('💀 AppCore詳細分析:');
            console.error('- window.AppCore:', typeof window.AppCore);
            console.error('- グローバルオブジェクト確認:', Object.keys(window).filter(key => key.includes('App')));
            
            // script要素確認
            const appCoreScript = Array.from(document.scripts).find(script => 
                script.src && script.src.includes('app-core.js')
            );
            if (appCoreScript) {
                console.error('- app-core.js スクリプト要素:', {
                    src: appCoreScript.src,
                    loaded: appCoreScript.readyState,
                    error: appCoreScript.onerror
                });
            } else {
                console.error('- app-core.js スクリプト要素が見つかりません');
            }
            
        } else {
            available.AppCore = 'OK';
            detailedInfo.AppCore = `クラス定義確認済み: ${typeof window.AppCore}`;
            console.log(`✅ AppCore: クラス利用可能`);
            
            // AppCore関連クラス確認
            const relatedClasses = ['DrawingToolSystem', 'UIController', 'PerformanceMonitor'];
            relatedClasses.forEach(className => {
                if (window[className]) {
                    console.log(`✅ ${className}: 利用可能`);
                    available[className] = 'OK';
                } else {
                    console.warn(`⚠️ ${className}: 未定義`);
                }
            });
        }
        
        // DOM要素確認（詳細版）
        const requiredElements = ['drawing-canvas', 'pen-tool', 'pen-settings'];
        const missingElements = [];
        const availableElements = {};
        
        requiredElements.forEach(id => {
            const element = document.getElementById(id);
            if (!element) {
                missingElements.push(id);
            } else {
                availableElements[id] = {
                    tagName: element.tagName,
                    className: element.className,
                    visible: element.offsetParent !== null
                };
            }
        });
        
        if (missingElements.length > 0) {
            console.warn('⚠️ 不足DOM要素:', missingElements);
            detailedInfo.DOM = `不足要素: ${missingElements.join(', ')}`;
        } else {
            console.log('✅ 必須DOM要素: 全て存在');
            detailedInfo.DOM = '全必須要素存在';
        }
        
        // 🔧 詳細情報ログ出力
        console.log('🔍 依存関係詳細情報:', detailedInfo);
        
        if (missing.length > 0) {
            const errorMessage = `必須依存関係不足: ${missing.join(', ')}`;
            const errorDetails = {
                missing,
                available,
                detailedInfo,
                missingElements,
                availableElements
            };
            
            console.error('💀 依存関係エラー詳細:', errorDetails);
            throw new Error(errorMessage);
        }
        
        console.log('✅ 基本依存関係確認完了:', available);
        this.initializationSteps.push('basic-dependencies');
        
        return { available, missing, detailedInfo };
    }
    
    /**
     * 基盤システム初期化（ConfigManager統合版）
     */
    async initializeFoundationSystems() {
        console.log('🏗️ 基盤システム初期化（統合版）...');
        
        // PixiExtensions初期化
        if (window.PixiExtensions && !window.PixiExtensions.initialized) {
            try {
                await window.PixiExtensions.initialize();
                const stats = window.PixiExtensions.getStats();
                console.log(`✅ PixiExtensions: ${stats.available}/${stats.total}機能利用可能`);
            } catch (error) {
                console.warn('⚠️ PixiExtensions初期化エラー:', error.message);
                
                // 🚨 Task 1-A-1: ErrorManager経由での警告表示
                window.ErrorManager.showError('warning', 
                    `拡張機能の一部が利用できません: ${error.message}`, 
                    { test: false }
                );
            }
        }
        
        console.log('✅ 基盤システム初期化完了');
        this.initializationSteps.push('foundation');
    }
    
    /**
     * 🔧 AppCore初期化（統一版・強化版）
     */
    async initializeAppCore() {
        console.log('🎯 AppCore統一初期化（強化版）...');
        
        // 🔧 AppCore存在確認（詳細版）
        if (!window.AppCore) {
            const errorMessage = 'AppCore クラスが利用できません';
            const diagnosticInfo = {
                windowAppCore: typeof window.AppCore,
                globalCheck: Object.keys(window).filter(key => key.toLowerCase().includes('app')),
                scriptTags: Array.from(document.scripts).map(script => ({
                    src: script.src,
                    readyState: script.readyState
                })).filter(info => info.src.includes('app-core')),
                timestamp: Date.now()
            };
            
            console.error('💀 AppCore診断情報:', diagnosticInfo);
            throw new Error(errorMessage);
        }
        
        try {
            // AppCore作成（詳細ログ付き）
            console.log('🔧 AppCore インスタンス作成中...');
            this.appCore = new window.AppCore();
            console.log('✅ AppCore インスタンス作成成功');
            
            // AppCore初期化実行（詳細ログ付き）
            console.log('🔧 AppCore 初期化実行中...');
            await this.appCore.initialize();
            console.log('✅ AppCore 初期化実行完了');
            
            // 🚨 Task 1-A-1: StateManager経由での状態確認（詳細版）
            const status = this.validateAppCoreStatus();
            if (!status.valid) {
                const errorMessage = `AppCore状態異常: ${status.issues.join(', ')}`;
                console.error('💀 AppCore状態確認失敗:', status);
                throw new Error(errorMessage);
            }
            
            console.log('✅ AppCore状態確認完了:', status);
            this.initializationSteps.push('app-core');
            
        } catch (error) {
            console.error('💀 AppCore初期化エラー:', error);
            
            // 🚨 Task 1-A-1: ErrorManager経由でのエラー情報提供（詳細版）
            const errorInfo = {
                message: error.message,
                stack: error.stack,
                appCoreExists: !!window.AppCore,
                appCoreType: typeof window.AppCore,
                pixiExists: !!window.PIXI,
                pixiVersion: window.PIXI?.VERSION,
                canvasExists: !!document.getElementById('drawing-canvas'),
                canvasElement: document.getElementById('drawing-canvas'),
                timestamp: Date.now(),
                initializationSteps: this.initializationSteps
            };
            
            console.error('🔍 AppCore初期化エラー詳細:', errorInfo);
            
            // ErrorManager経由でのエラー表示
            window.ErrorManager.showError('error', error.message, {
                additionalInfo: `AppCore初期化失敗 - Step: ${this.initializationSteps.join(' → ')}`,
                showReload: true,
                showDebug: true
            });
            
            throw error;
        }
    }
    
    /**
     * AppCore状態確認（StateManager統合版）
     */
    validateAppCoreStatus() {
        const issues = [];
        
        if (!this.appCore) {
            issues.push('AppCoreインスタンス未作成');
            return { valid: false, issues };
        }
        
        // 🚨 Task 1-A-1: StateManager経由での詳細状態確認も可能
        if (!this.appCore.app) issues.push('PixiJS Application未初期化');
        if (!this.appCore.drawingContainer) issues.push('DrawingContainer未初期化');
        if (!this.appCore.toolSystem) issues.push('ToolSystem未初期化');
        if (!this.appCore.uiController) issues.push('UIController未初期化');
        
        return {
            valid: issues.length === 0,
            issues,
            appCoreInfo: {
                hasApp: !!this.appCore.app,
                hasDrawingContainer: !!this.appCore.drawingContainer,
                hasToolSystem: !!this.appCore.toolSystem,
                hasUIController: !!this.appCore.uiController,
                isInitializing: this.appCore.isInitializing,
                initializationComplete: this.appCore.initializationComplete,
                fallbackMode: this.appCore.fallbackMode
            }
        };
    }
    
    /**
     * システム統合・イベント連携設定（統一版）
     */
    setupSystemIntegration() {
        console.log('🔗 システム統合・イベント連携設定（統一版）...');
        
        try {
            // 🚨 Task 1-A-1: ConfigManager経由でのキーボードショートカット設定
            this.setupKeyboardShortcuts();
            
            // リサイズ機能統合
            this.setupResizeHandlers();
            
            // ステータス表示統合
            this.setupStatusDisplay();
            
            // EventBus連携設定
            this.setupEventBusIntegration();
            
            console.log('✅ システム統合完了');
            this.initializationSteps.push('integration');
            
        } catch (error) {
            console.error('💀 システム統合エラー:', error);
            
            // 🚨 Task 1-A-1: ErrorManager経由での統合エラー処理
            window.ErrorManager.showError('warning', 
                `システム統合で一部機能が制限されます: ${error.message}`, 
                { test: false }
            );
        }
    }
    
    /**
     * 🚨 Task 1-A-1: キーボードショートカット設定（ConfigManager統合版）
     */
    setupKeyboardShortcuts() {
        // ConfigManager経由でのショートカット設定取得
        const shortcuts = window.ConfigManager.get('ui.keyboard.shortcuts') || {
            'Escape': 'closeAllPopups',
            'KeyP': 'selectPenTool',
            'KeyE': 'selectEraserTool'
        };
        
        document.addEventListener('keydown', (e) => {
            const action = shortcuts[e.code];
            if (!action || e.ctrlKey || e.altKey || e.shiftKey) return;
            
            // テキスト入力中は無効
            if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
            
            e.preventDefault();
            
            if (this[action]) {
                try {
                    this[action]();
                } catch (error) {
                    console.warn('⚠️ ショートカットアクション実行エラー:', action, error);
                }
            } else {
                console.warn('未定義ショートカットアクション:', action);
            }
        });
        
        console.log(`✅ キーボードショートカット ${Object.keys(shortcuts).length}個設定完了（ConfigManager統合）`);
    }
    
    /**
     * リサイズハンドラ設定（統一版）
     */
    setupResizeHandlers() {
        // 適用ボタン
        const applyResize = document.getElementById('apply-resize');
        const applyResizeCenter = document.getElementById('apply-resize-center');
        
        if (applyResize) {
            applyResize.addEventListener('click', () => this.applyCanvasResize(false));
        }
        
        if (applyResizeCenter) {
            applyResizeCenter.addEventListener('click', () => this.applyCanvasResize(true));
        }
        
        // プリセットボタン
        document.querySelectorAll('.resize-button[data-size]').forEach(button => {
            button.addEventListener('click', (e) => {
                const [width, height] = e.target.getAttribute('data-size').split(',').map(Number);
                const widthInput = document.getElementById('canvas-width');
                const heightInput = document.getElementById('canvas-height');
                
                if (widthInput && heightInput) {
                    widthInput.value = width;
                    heightInput.value = height;
                }
            });
        });
        
        console.log('✅ リサイズハンドラ設定完了');
    }
    
    /**
     * 🚨 Task 1-A-1: ステータス表示統合（ConfigManager統合版）
     */
    setupStatusDisplay() {
        // ConfigManager経由での初期表示設定
        const elements = {
            'current-tool': 'ベクターペン',
            'current-color': window.ConfigManager.get('colors.futabaMaroonHex'),
            'canvas-info': this.appCore ? 
                `${this.appCore.canvasWidth}×${this.appCore.canvasHeight}px` : 
                `${window.ConfigManager.get('canvas.width')}×${window.ConfigManager.get('canvas.height')}px`
        };
        
        Object.entries(elements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) element.textContent = value;
        });
        
        console.log('✅ ステータス表示統合完了（ConfigManager統合）');
    }
    
    /**
     * EventBus連携設定（統一版）
     */
    setupEventBusIntegration() {
        if (!window.EventBus) return;
        
        try {
            // 描画系イベントリスナー設定
            window.EventBus.on(window.EventBus.Events.TOOL_CHANGED, (data) => {
                this.updateToolStatus(data?.tool || 'pen');
            });
            
            window.EventBus.on(window.EventBus.Events.CANVAS_RESIZED, (data) => {
                this.updateCanvasInfo();
            });
            
            window.EventBus.on(window.EventBus.Events.ERROR_OCCURRED, (data) => {
                console.warn('📡 EventBus: エラー通知受信', data);
            });
            
            console.log('✅ EventBus連携設定完了');
        } catch (error) {
            console.error('💀 EventBus連携設定エラー:', error);
        }
    }
    
    /**
     * 機能有効化（統一版）
     */
    enableFeatures() {
        console.log('⚡ 機能有効化...');
        
        try {
            // 初期ツール選択
            this.selectPenTool();
            
            // パフォーマンス監視開始
            if (this.appCore?.performanceMonitor) {
                this.appCore.performanceMonitor.start();
            }
            
            console.log('✅ 機能有効化完了');
            this.initializationSteps.push('features');
        } catch (error) {
            console.error('💀 機能有効化エラー:', error);
        }
    }
    
    /**
     * 最終初期化処理
     */
    finalizeInitialization() {
        console.log('🏁 最終初期化処理...');
        
        // グローバル公開
        window.futabaDrawingTool = this;
        
        // 🚨 Task 1-A-1: 統一デバッグ関数設定（旧関数の統一システム移譲）
        this.setupUnifiedDebugFunctions();
        
        console.log('✅ 最終初期化完了');
        this.initializationSteps.push('finalization');
    }
    
    /**
     * 🚨 Task 1-A-1: 統一デバッグ関数設定（旧関数の統一システム移譲）
     */
    setupUnifiedDebugFunctions() {
        // 🚨 旧関数 → StateManager.getApplicationState() 移譲
        window.getAppState = () => {
            console.warn('🔄 getAppState() is deprecated. Use StateManager.getApplicationState()');
            return window.StateManager.getApplicationState();
        };
        
        // 🚨 旧エラー表示関数 → ErrorManager.showError() 移譲
        window.showErrorMessage = (message) => {
            console.warn('🔄 showErrorMessage() is deprecated. Use ErrorManager.showError()');
            window.ErrorManager.showError('error', message);
        };
        
        window.showRecoveryMessage = (message) => {
            console.warn('🔄 showRecoveryMessage() is deprecated. Use ErrorManager.showError()');
            window.ErrorManager.showError('recovery', message);
        };
        
        window.showCriticalErrorMessage = (message, options = {}) => {
            console.warn('🔄 showCriticalErrorMessage() is deprecated. Use ErrorManager.showCriticalError()');
            window.ErrorManager.showCriticalError(message, options);
        };
        
        // 統一デバッグ関数
        window.startDebugMode = () => this.startDebugMode();
        
        console.log('✅ 統一デバッグ関数設定完了（旧関数移譲済み）');
    }
    
    /**
     * 🚨 Task 1-A-1: 初期化完了イベント発行（EventBus統一版）
     */
    emitInitializationComplete(initTime) {
        if (window.EventBus) {
            setTimeout(() => {
                window.EventBus.safeEmit(window.EventBus.Events.INITIALIZATION_COMPLETED, {
                    version: this.version,
                    initTime,
                    components: this.getComponentStatus(),
                    task: 'Task 1-A-1 完了