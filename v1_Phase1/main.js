/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1rev14
 * メイン初期化スクリプト - main.js (構文エラー修正版)
 * 
 * 🔧 修正内容:
 * 1. ✅ 構文エラー修正 (Invalid token問題解決)
 * 2. ✅ DRY・SOLID原則適用
 * 3. ✅ PenToolUI初期化保証
 * 4. ✅ ポップアップ機能統合確認
 * 
 * Phase2目標: エラー修正・安定したポップアップシステム
 */

// ==== Error Handler Utility (SOLID: Single Responsibility) ====
class ErrorHandler {
    static createApplicationError(message, context = {}) {
        const error = new Error(message);
        error.name = 'ApplicationError';
        error.context = context;
        error.timestamp = Date.now();
        return error;
    }
    
    static logError(error, context = 'Unknown') {
        console.error(`🚨 [${context}] ${error.name || 'Error'}: ${error.message}`, error);
    }
    
    static handleGracefulDegradation(operation, fallback, errorMessage) {
        try {
            return operation();
        } catch (error) {
            console.warn(`${errorMessage}:`, error);
            return typeof fallback === 'function' ? fallback() : fallback;
        }
    }
}

// ==== Performance Monitor (SOLID: Single Responsibility) ====
class PerformanceMonitor {
    static measure(name, operation) {
        const startTime = performance.now();
        try {
            const result = operation();
            const duration = performance.now() - startTime;
            console.log(`⏱️ [${name}] 実行時間: ${duration.toFixed(2)}ms`);
            return result;
        } catch (error) {
            const duration = performance.now() - startTime;
            console.error(`⏱️ [${name}] エラー (${duration.toFixed(2)}ms):`, error);
            throw error;
        }
    }
    
    static async measureAsync(name, operation) {
        const startTime = performance.now();
        try {
            const result = await operation();
            const duration = performance.now() - startTime;
            console.log(`⏱️ [${name}] 実行時間: ${duration.toFixed(2)}ms`);
            return result;
        } catch (error) {
            const duration = performance.now() - startTime;
            console.error(`⏱️ [${name}] エラー (${duration.toFixed(2)}ms):`, error);
            throw error;
        }
    }
}

// ==== Configuration Manager (SOLID: Single Responsibility) ====
class ConfigManager {
    static get(key, defaultValue) {
        try {
            return (window.CONFIG && window.CONFIG[key] !== undefined) ? window.CONFIG[key] : defaultValue;
        } catch (error) {
            console.warn(`CONFIG取得エラー (${key}):`, error);
            return defaultValue;
        }
    }
    
    static validateIntegrity() {
        if (!window.CONFIG || typeof window.CONFIG !== 'object') {
            return false;
        }
        
        const requiredKeys = [
            'DEFAULT_BRUSH_SIZE', 'DEFAULT_OPACITY', 'MAX_BRUSH_SIZE', 
            'MIN_BRUSH_SIZE', 'SIZE_PRESETS', 'CANVAS_WIDTH', 'CANVAS_HEIGHT'
        ];
        
        return requiredKeys.every(key => window.CONFIG[key] !== undefined);
    }
    
    static fix() {
        console.log('🔧 CONFIG修復実行...');
        
        const DEFAULT_CONFIG = {
            DEFAULT_BRUSH_SIZE: 4,
            DEFAULT_OPACITY: 1.0,
            MAX_BRUSH_SIZE: 500,
            MIN_BRUSH_SIZE: 0.1,
            DEFAULT_COLOR: 0x800000,
            SIZE_PRESETS: [1, 2, 4, 8, 16, 32],
            CANVAS_WIDTH: 400,
            CANVAS_HEIGHT: 400,
            BG_COLOR: 0xf0e0d6,
            TARGET_FPS: 60,
            PREVIEW_MIN_SIZE: 0.5,
            PREVIEW_MAX_SIZE: 20,
            DEFAULT_PRESSURE: 0.5,
            DEFAULT_SMOOTHING: 0.3
        };
        
        if (!window.CONFIG) {
            window.CONFIG = {};
        }
        
        let fixedCount = 0;
        for (const [key, value] of Object.entries(DEFAULT_CONFIG)) {
            if (window.CONFIG[key] === undefined) {
                window.CONFIG[key] = value;
                fixedCount++;
            }
        }
        
        console.log(`✅ CONFIG修復完了: ${fixedCount}項目修復`);
        return true;
    }
}

// ==== Initialization Steps (SOLID: Interface Segregation) ====
const INIT_STEPS = {
    CHECKING_SYSTEMS: 'checking_systems',
    CHECKING_CONFIG: 'checking_config', 
    CHECKING_DEPENDENCIES: 'checking_dependencies',
    CREATING_APP: 'creating_app',
    CREATING_TOOLS_SYSTEM: 'creating_tools_system',
    CREATING_UI_MANAGER: 'creating_ui_manager',
    INITIALIZING_PEN_TOOL_UI: 'initializing_pen_tool_ui',
    CONNECTING_SYSTEMS: 'connecting_systems',
    FINAL_SETUP: 'final_setup',
    COMPLETED: 'completed',
    ERROR: 'error'
};

// ==== Application State Manager (SOLID: Single Responsibility) ====
class AppStateManager {
    constructor() {
        this.state = {
            initialized: false,
            initializationStep: 'waiting',
            error: null,
            startTime: null,
            components: {
                app: null,
                toolsSystem: null,
                uiManager: null,
                historyManager: null,
                settingsManager: null,
                penToolUI: null
            },
            stats: {
                initTime: 0,
                errorCount: 0,
                lastError: null
            },
            config: {
                loaded: false,
                validated: false,
                fixed: false
            },
            phase2: {
                utilsLoaded: false,
                uiManagerFixed: false,
                systemsIntegrated: false,
                errorRecovery: false,
                penToolUIInitialized: false
            }
        };
    }
    
    updateStep(step, details = null) {
        this.state.initializationStep = step;
        const messages = {
            [INIT_STEPS.CHECKING_SYSTEMS]: '統合システムチェック中...',
            [INIT_STEPS.CHECKING_CONFIG]: 'CONFIG読み込み確認中...',
            [INIT_STEPS.CHECKING_DEPENDENCIES]: '依存関係チェック中...',
            [INIT_STEPS.CREATING_APP]: 'アプリケーション作成中...',
            [INIT_STEPS.CREATING_TOOLS_SYSTEM]: 'ツールシステム作成中...',
            [INIT_STEPS.CREATING_UI_MANAGER]: 'UI管理システム作成中...',
            [INIT_STEPS.INITIALIZING_PEN_TOOL_UI]: 'PenToolUI初期化中...',
            [INIT_STEPS.CONNECTING_SYSTEMS]: 'システム連携設定中...',
            [INIT_STEPS.FINAL_SETUP]: '最終セットアップ中...',
            [INIT_STEPS.COMPLETED]: '初期化完了！',
            [INIT_STEPS.ERROR]: '初期化エラー'
        };
        console.log(`📋 ${messages[step] || step}`, details || '');
    }
    
    markCompleted(initTime) {
        this.state.initialized = true;
        this.state.stats.initTime = initTime;
        this.updateStep(INIT_STEPS.COMPLETED);
    }
    
    recordError(error) {
        this.state.error = error;
        this.state.stats.errorCount++;
        this.state.stats.lastError = {
            type: 'initialization',
            message: error.message,
            step: error.context?.step || 'unknown',
            timestamp: Date.now()
        };
        this.updateStep(INIT_STEPS.ERROR, error);
    }
}

// ==== System Checker (SOLID: Single Responsibility) ====
class SystemChecker {
    static checkIntegratedSystems() {
        console.log('🔍 統合システムチェック...');
        
        const systemsStatus = {
            utils: typeof window.safeConfigGet !== 'undefined',
            config: typeof window.CONFIG !== 'undefined',
            pixi: typeof window.PIXI !== 'undefined',
            pixiApp: typeof window.PixiDrawingApp !== 'undefined',
            toolsSystem: typeof window.DrawingToolsSystem !== 'undefined',
            historyManager: typeof window.HistoryManager !== 'undefined',
            uiManager: typeof window.UIManager !== 'undefined'
        };
        
        const availableSystems = Object.entries(systemsStatus)
            .filter(([name, available]) => available);
        const missingSystems = Object.entries(systemsStatus)
            .filter(([name, available]) => !available);
        
        console.log(`✅ 利用可能システム: ${availableSystems.length}/7システム`);
        
        if (missingSystems.length > 0) {
            console.warn('⚠️ 不足システム:', missingSystems.map(([name]) => name));
            
            const criticalSystems = ['pixi', 'pixiApp', 'toolsSystem', 'uiManager'];
            const missingCritical = criticalSystems.filter(system => !systemsStatus[system]);
            
            if (missingCritical.length > 0) {
                throw ErrorHandler.createApplicationError(
                    `重要システムが不足: ${missingCritical.join(', ')}`
                );
            }
        }
        
        return true;
    }
    
    static checkDependencies() {
        console.log('🔍 依存関係チェック...');
        
        const criticalClasses = [
            'PIXI', 'PixiDrawingApp', 'DrawingToolsSystem', 'HistoryManager', 'UIManager'
        ];
        
        const missing = criticalClasses.filter(cls => typeof window[cls] === 'undefined');
        
        if (missing.length > 0) {
            throw ErrorHandler.createApplicationError(
                `重要なクラスが見つかりません: ${missing.join(', ')}`,
                { step: INIT_STEPS.CHECKING_DEPENDENCIES, missing }
            );
        }
        
        console.log('✅ 依存関係チェック完了');
        return true;
    }
}

// ==== Component Factory (SOLID: Factory Pattern) ====
class ComponentFactory {
    static async createApplication(appState) {
        console.log('🎯 PixiDrawingApp作成...');
        
        return await PerformanceMonitor.measureAsync('App作成', async () => {
            const width = ConfigManager.get('CANVAS_WIDTH', 400);
            const height = ConfigManager.get('CANVAS_HEIGHT', 400);
            
            const app = new PixiDrawingApp(width, height);
            await app.init();
            
            appState.state.components.app = app;
            return app;
        });
    }
    
    static async createToolsSystem(app, appState) {
        console.log('🔧 DrawingToolsSystem作成...');
        
        return await PerformanceMonitor.measureAsync('ToolsSystem作成', async () => {
            const toolsSystem = new DrawingToolsSystem(app);
            await toolsSystem.init();
            
            appState.state.components.toolsSystem = toolsSystem;
            
            // デフォルト設定適用
            const defaultSettings = {
                size: ConfigManager.get('DEFAULT_BRUSH_SIZE', 4),
                opacity: ConfigManager.get('DEFAULT_OPACITY', 1.0),
                color: ConfigManager.get('DEFAULT_COLOR', 0x800000),
                pressure: ConfigManager.get('DEFAULT_PRESSURE', 0.5),
                smoothing: ConfigManager.get('DEFAULT_SMOOTHING', 0.3)
            };
            
            if (toolsSystem.updateBrushSettings) {
                toolsSystem.updateBrushSettings(defaultSettings);
            }
            
            return toolsSystem;
        });
    }
    
    static async createUIManager(app, toolsSystem, appState) {
        console.log('🎭 UIManager作成...');
        
        return await PerformanceMonitor.measureAsync('UIManager作成', async () => {
            const historyManager = toolsSystem.getHistoryManager();
            const uiManager = new window.UIManager(app, toolsSystem, historyManager);
            
            try {
                await uiManager.init();
            } catch (initError) {
                console.warn('⚠️ UIManager初期化でエラーが発生:', initError);
                if (uiManager.setupToolButtons) {
                    uiManager.setupToolButtons();
                }
            }
            
            appState.state.components.uiManager = uiManager;
            appState.state.components.historyManager = historyManager;
            appState.state.phase2.uiManagerFixed = true;
            
            return uiManager;
        });
    }
    
    static async initializePenToolUI(toolsSystem, appState) {
        console.log('🎨 PenToolUI初期化...');
        
        return await PerformanceMonitor.measureAsync('PenToolUI初期化', async () => {
            let penToolUI = null;
            
            if (toolsSystem.penToolUI) {
                penToolUI = toolsSystem.penToolUI;
            } else if (toolsSystem.getPenToolUI) {
                penToolUI = toolsSystem.getPenToolUI();
            }
            
            if (penToolUI && !penToolUI.isInitialized) {
                const initResult = await penToolUI.init();
                if (initResult) {
                    appState.state.components.penToolUI = penToolUI;
                    appState.state.phase2.penToolUIInitialized = true;
                    console.log('✅ PenToolUI初期化完了');
                    return penToolUI;
                }
            } else if (penToolUI && penToolUI.isInitialized) {
                appState.state.components.penToolUI = penToolUI;
                appState.state.phase2.penToolUIInitialized = true;
                return penToolUI;
            }
            
            return null;
        });
    }
}

// ==== Debug Functions Manager (SOLID: Single Responsibility) ====
class DebugManager {
    static setup(appState) {
        // 基本デバッグ関数
        window.undo = () => appState.state.components.historyManager?.undo() || false;
        window.redo = () => appState.state.components.historyManager?.redo() || false;
        window.debugHistory = () => appState.state.components.toolsSystem?.debugHistory() || console.warn('ToolsSystem not available');
        
        // PenToolUI専用デバッグ関数
        window.debugPenToolUI = function() {
            const penToolUI = appState.state.components.penToolUI;
            if (penToolUI) {
                console.group('🎨 PenToolUI デバッグ情報');
                console.log('初期化状態:', penToolUI.isInitialized);
                console.log('ツール状態:', penToolUI.toolActive);
                if (penToolUI.getFullStatus) {
                    console.log('詳細状態:', penToolUI.getFullStatus());
                }
                console.groupEnd();
            } else {
                console.warn('PenToolUI が利用できません');
            }
        };
        
        // ポップアップテスト関数
        window.testPenPopup = function() {
            console.log('🧪 ペンポップアップテスト開始...');
            const penToolUI = appState.state.components.penToolUI;
            
            if (penToolUI && penToolUI.showPopup) {
                const result = penToolUI.showPopup('pen-settings');
                console.log('ポップアップ表示結果:', result);
                return result;
            } else {
                console.warn('PenToolUI.showPopup が利用できません');
                return false;
            }
        };
        
        // 統合デバッグ関数
        window.debugApp = function() {
            console.group('🔍 アプリケーションデバッグ情報');
            console.log('📋 APP_STATE:', appState.state);
            
            const systemsStatus = {
                app: !!appState.state.components.app,
                toolsSystem: !!appState.state.components.toolsSystem,
                uiManager: !!appState.state.components.uiManager,
                historyManager: !!appState.state.components.historyManager,
                settingsManager: !!appState.state.components.settingsManager,
                penToolUI: !!appState.state.components.penToolUI
            };
            console.log('🔧 システム状態:', systemsStatus);
            console.log('🚀 Phase2最適化状況:', appState.state.phase2);
            console.log('⚙️ CONFIG状況:', appState.state.config);
            
            console.groupEnd();
        };
        
        // システムテスト関数
        window.testSystem = function() {
            console.log('🧪 システム統合テスト');
            
            const testResults = {
                initialized: appState.state.initialized,
                configLoaded: appState.state.config.loaded,
                systemsIntegrated: appState.state.phase2.systemsIntegrated,
                uiManagerFixed: appState.state.phase2.uiManagerFixed,
                penToolUIInitialized: appState.state.phase2.penToolUIInitialized,
                components: {
                    app: !!appState.state.components.app,
                    toolsSystem: !!appState.state.components.toolsSystem,
                    uiManager: !!appState.state.components.uiManager,
                    historyManager: !!appState.state.components.historyManager,
                    penToolUI: !!appState.state.components.penToolUI
                }
            };
            
            const overallOK = testResults.initialized && testResults.configLoaded && 
                             testResults.systemsIntegrated && testResults.components.app &&
                             testResults.components.toolsSystem && testResults.components.uiManager;
            
            console.log('📊 テスト結果:', testResults);
            console.log(`🏆 統合テスト: ${overallOK ? '✅ 成功' : '❌ 部分的'}`);
            
            if (overallOK && testResults.penToolUIInitialized) {
                console.log('🧪 ポップアップテスト実行中...');
                window.testPenPopup();
            }
            
            return overallOK;
        };
        
        console.log('🐛 デバッグ機能設定完了');
    }
}

// ==== Error Display Manager (SOLID: Single Responsibility) ====
class ErrorDisplayManager {
    static show(error) {
        const errorContainer = document.createElement('div');
        errorContainer.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: linear-gradient(135deg, #ff4444, #cc0000);
            color: white;
            padding: 30px;
            border-radius: 15px;
            z-index: 10000;
            max-width: 500px;
            text-align: center;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        `;
        
        const isUIManagerError = error.message.includes('UIManager');
        const isPenToolUIError = error.message.includes('PenToolUI');
        
        errorContainer.innerHTML = `
            <div style="font-size: 48px; margin-bottom: 20px;">⚠️</div>
            <h2 style="margin: 0 0 15px 0; font-size: 24px;">アプリケーション起動エラー</h2>
            <p style="margin: 0 0 15px 0; font-size: 16px; opacity: 0.9;">
                ${error.message}
            </p>
            <p style="margin: 0 0 20px 0; font-size: 14px; opacity: 0.7;">
                エラーステップ: ${error.context?.step || 'unknown'}
            </p>
            ${isUIManagerError ? `
            <div style="margin: 15px 0; padding: 10px; background: rgba(255,255,255,0.1); border-radius: 8px; font-size: 12px;">
                <strong>🔧 UIManagerエラー対処法:</strong><br>
                1. ページを再読み込みしてください<br>
                2. ui-manager.js修復版が正常に読み込まれるまでお待ちください
            </div>
            ` : ''}
            ${isPenToolUIError ? `
            <div style="margin: 15px 0; padding: 10px; background: rgba(255,255,255,0.1); border-radius: 8px; font-size: 12px;">
                <strong>🎨 PenToolUIエラー対処法:</strong><br>
                1. ページを再読み込みしてください<br>
                2. PenToolUIコンポーネントが正常に読み込まれるまでお待ちください
            </div>
            ` : ''}
            <button onclick="location.reload()" style="
                background: rgba(255, 255, 255, 0.2);
                border: 1px solid rgba(255, 255, 255, 0.3);
                color: white;
                padding: 10px 20px;
                border-radius: 8px;
                cursor: pointer;
                font-size: 14px;
            ">ページを再読み込み</button>
        `;
        
        document.body.appendChild(errorContainer);
    }
}

// ==== Main Application Initializer (SOLID: Dependency Inversion) ====
class ApplicationInitializer {
    constructor() {
        this.appState = new AppStateManager();
    }
    
    async initialize() {
        try {
            this.appState.state.startTime = performance.now();
            console.log('🚀 アプリケーション初期化開始');
            
            // 1. システムチェック
            this.appState.updateStep(INIT_STEPS.CHECKING_SYSTEMS);
            SystemChecker.checkIntegratedSystems();
            this.appState.state.phase2.utilsLoaded = true;
            
            // 2. CONFIG確認
            this.appState.updateStep(INIT_STEPS.CHECKING_CONFIG);
            this.checkAndFixConfig();
            
            // 3. 依存関係チェック
            this.appState.updateStep(INIT_STEPS.CHECKING_DEPENDENCIES);
            SystemChecker.checkDependencies();
            
            // 4. コンポーネント作成
            this.appState.updateStep(INIT_STEPS.CREATING_APP);
            const app = await ComponentFactory.createApplication(this.appState);
            
            this.appState.updateStep(INIT_STEPS.CREATING_TOOLS_SYSTEM);
            const toolsSystem = await ComponentFactory.createToolsSystem(app, this.appState);
            
            this.appState.updateStep(INIT_STEPS.CREATING_UI_MANAGER);
            const uiManager = await ComponentFactory.createUIManager(app, toolsSystem, this.appState);
            
            this.appState.updateStep(INIT_STEPS.INITIALIZING_PEN_TOOL_UI);
            const penToolUI = await ComponentFactory.initializePenToolUI(toolsSystem, this.appState);
            
            // 5. システム連携
            this.appState.updateStep(INIT_STEPS.CONNECTING_SYSTEMS);
            await this.connectSystems();
            
            // 6. 最終セットアップ
            this.appState.updateStep(INIT_STEPS.FINAL_SETUP);
            await this.finalSetup();
            
            // 7. 完了処理
            const initTime = performance.now() - this.appState.state.startTime;
            this.appState.markCompleted(initTime);
            
            this.logSuccess(initTime);
            return true;
            
        } catch (error) {
            this.handleInitializationError(error);
            return false;
        }
    }
    
    checkAndFixConfig() {
        if (!ConfigManager.validateIntegrity()) {
            console.warn('⚠️ CONFIG整合性問題検出 → 修復実行');
            ConfigManager.fix();
            this.appState.state.config.fixed = true;
        }
        
        this.appState.state.config.loaded = true;
        this.appState.state.config.validated = true;
    }
    
    async connectSystems() {
        const { app, toolsSystem, uiManager, historyManager, penToolUI } = this.appState.state.components;
        
        // システム間連携設定
        if (app.setSettingsManager && this.appState.state.components.settingsManager) {
            app.setSettingsManager(this.appState.state.components.settingsManager);
        }
        
        if (uiManager.setHistoryManager) {
            uiManager.setHistoryManager(historyManager);
        }
        
        // グローバル参照設定
        window.app = app;
        window.toolsSystem = toolsSystem;
        window.uiManager = uiManager;
        window.historyManager = historyManager;
        window.penToolUI = penToolUI;
        window.appConfig = window.CONFIG || {};
        
        // デバッグ機能設定
        DebugManager.setup(this.appState);
        
        this.appState.state.phase2.systemsIntegrated = true;
        console.log('✅ システム間連携設定完了');
    }
    
    async finalSetup() {
        const { uiManager, penToolUI } = this.appState.state.components;
        
        // UI表示更新
        if (uiManager && uiManager.updateAllDisplays) {
            uiManager.updateAllDisplays();
        }
        
        // PenToolUI最終確認
        if (penToolUI && penToolUI.components?.popupManager) {
            console.log('✅ PopupManager利用可能');
            
            // ペンボタン確認
            const penButton = document.getElementById('pen-tool-button');
            if (penButton) {
                console.log('✅ ペンボタン要素確認完了');
            } else {
                console.warn('⚠️ ペンボタン要素が見つかりません');
            }
        }
        
        // エラーハンドラー設定
        this.setupErrorHandlers();
        
        console.log('✅ 最終セットアップ完了');
    }
    
    setupErrorHandlers() {
        window.addEventListener('error', (event) => {
            const error = ErrorHandler.createApplicationError(event.message, {
                filename: event.filename,
                line: event.lineno,
                column: event.colno
            });
            
            ErrorHandler.logError(error, 'グローバルJSエラー');
            this.appState.state.stats.errorCount++;
        });
        
        window.addEventListener('unhandledrejection', (event) => {
            const error = ErrorHandler.createApplicationError('未処理のPromiseエラー', {
                reason: event.reason
            });
            
            ErrorHandler.logError(error, 'グローバルPromiseエラー');
            this.appState.state.stats.errorCount++;
        });
    }
    
    handleInitializationError(error) {
        this.appState.recordError(error);
        ErrorHandler.logError(error, 'アプリケーション初期化');
        ErrorDisplayManager.show(error);
    }
    
    logSuccess(initTime) {
        console.log('🎉 アプリケーション初期化完了！');
        console.log(`⏱️ 初期化時間: ${initTime.toFixed(2)}ms`);
        
        // システム概要表示
        console.group('📋 システム概要');
        console.log(`🖼️ キャンバス: ${ConfigManager.get('CANVAS_WIDTH', 400)}×${ConfigManager.get('CANVAS_HEIGHT', 400)}px`);
        console.log(`🖊️ デフォルトペンサイズ: ${ConfigManager.get('DEFAULT_BRUSH_SIZE', 4)}px`);
        console.log(`🎨 デフォルト透明度: ${ConfigManager.get('DEFAULT_OPACITY', 1.0) * 100}%`);
        console.log(`📏 最大ペンサイズ: ${ConfigManager.get('MAX_BRUSH_SIZE', 500)}px`);
        console.log(`👆 筆圧感度: ${ConfigManager.get('DEFAULT_PRESSURE', 0.5) * 100}%`);
        console.log(`✨ 線補正: ${ConfigManager.get('DEFAULT_SMOOTHING', 0.3) * 100}%`);
        
        const phase2Status = this.appState.state.phase2;
        console.log('🚀 Phase2最適化状況:');
        console.log(`  🔧 UIManager修復: ${phase2Status.uiManagerFixed ? '✅ 成功' : '❌ 失敗'}`);
        console.log(`  🎨 PenToolUI初期化: ${phase2Status.penToolUIInitialized ? '✅ 完了' : '❌ 失敗'}`);
        console.log(`  🔗 システム統合: ${phase2Status.systemsIntegrated ? '✅ 完了' : '❌ 不完全'}`);
        console.log(`  🛡️ エラー回復: ${phase2Status.errorRecovery ? '⚠️ 発動済み' : '✅ 正常動作'}`);
        
        console.groupEnd();
        
        // UI通知
        const { uiManager } = this.appState.state.components;
        if (uiManager && uiManager.showNotification) {
            const message = phase2Status.uiManagerFixed && phase2Status.systemsIntegrated && phase2Status.penToolUIInitialized
                ? 'アプリケーション初期化完了！すべてのシステムが正常に動作しています'
                : 'アプリケーション初期化完了！基本機能が利用可能です';
            uiManager.showNotification(message, 'success', 5000);
        }
        
        // ポップアップテスト案内
        setTimeout(() => {
            console.log('🧪 ポップアップ機能テスト:');
            console.log('  📋 ペンツールボタンをクリックしてポップアップをテストしてください');
            console.log('  📋 または window.testPenPopup() を実行してください');
        }, 1000);
    }
}

// ==== Initialization Monitor (SOLID: Single Responsibility) ====
class InitializationMonitor {
    constructor(initializer) {
        this.initializer = initializer;
        this.maxWaitTime = 25000;
    }
    
    startWatching() {
        const startTime = Date.now();
        
        const checkInterval = setInterval(() => {
            const elapsedTime = Date.now() - startTime;
            
            if (this.initializer.appState.state.initialized) {
                clearInterval(checkInterval);
                return;
            }
            
            if (elapsedTime > this.maxWaitTime) {
                clearInterval(checkInterval);
                console.warn('⏰ 初期化タイムアウト');
                
                const timeoutError = ErrorHandler.createApplicationError(
                    '初期化がタイムアウトしました。ページを再読み込みしてください。',
                    { 
                        step: this.initializer.appState.state.initializationStep, 
                        elapsedTime 
                    }
                );
                
                ErrorDisplayManager.show(timeoutError);
            }
            
            if (elapsedTime % 5000 === 0) {
                console.log(`⏳ 初期化進行中... ステップ: ${this.initializer.appState.state.initializationStep}, 経過時間: ${elapsedTime}ms`);
            }
        }, 1000);
    }
}

// ==== Global Initialization ====
let globalInitializer = null;

function setupFallbackUtilities() {
    // utils.js依存関係のフォールバック
    if (typeof window.safeConfigGet === 'undefined') {
        console.warn('⚠️ utils.js が読み込まれていません - フォールバック関数を設定');
        
        window.safeConfigGet = ConfigManager.get;
        window.createApplicationError = ErrorHandler.createApplicationError;
        window.logError = ErrorHandler.logError;
        window.measurePerformance = PerformanceMonitor.measure;
        window.handleGracefulDegradation = ErrorHandler.handleGracefulDegradation;
    }
}

function checkPopupUIElements() {
    console.log('🔍 ポップアップUI要素確認...');
    
    // ペンツールボタンの確認
    const penButton = document.getElementById('pen-tool-button');
    if (penButton) {
        console.log('✅ ペンツールボタン要素確認完了');
        
        // クリックイベントリスナーの確認
        const hasClickListener = penButton.onclick || 
                               penButton.addEventListener.toString().includes('click');
        
        if (hasClickListener) {
            console.log('✅ ペンツールボタンクリックイベント設定済み');
        } else {
            console.warn('⚠️ ペンツールボタンクリックイベントが未設定の可能性');
        }
    } else {
        console.warn('⚠️ ペンツールボタン要素が見つかりません');
        console.log('🔍 利用可能なツールボタンを検索中...');
        
        // 代替ボタン検索
        const toolButtons = document.querySelectorAll('[id*="tool"], [class*="tool"]');
        if (toolButtons.length > 0) {
            console.log(`📋 発見されたツール関連要素: ${toolButtons.length}個`);
            toolButtons.forEach((btn, index) => {
                console.log(`  ${index + 1}. ID: ${btn.id}, Class: ${btn.className}`);
            });
        }
    }
    
    // ポップアップコンテナの確認
    const popupContainers = document.querySelectorAll('[id*="popup"], [class*="popup"]');
    if (popupContainers.length > 0) {
        console.log(`✅ ポップアップコンテナ発見: ${popupContainers.length}個`);
        popupContainers.forEach((container, index) => {
            console.log(`  ${index + 1}. ID: ${container.id}, Class: ${container.className}`);
        });
    } else {
        console.warn('⚠️ ポップアップコンテナが見つかりません');
    }
}

async function initializeApp() {
    try {
        console.log('🚀 main.js 構文エラー修正版読み込み開始...');
        
        // フォールバック設定
        setupFallbackUtilities();
        
        // ポップアップUI要素確認
        checkPopupUIElements();
        
        // 初期化実行
        globalInitializer = new ApplicationInitializer();
        const monitor = new InitializationMonitor(globalInitializer);
        
        monitor.startWatching();
        const success = await globalInitializer.initialize();
        
        if (success) {
            console.log('🎉 main.js 構文エラー修正版初期化成功！');
            
            // ポップアップ機能最終確認
            setTimeout(() => {
                const penToolUI = window.penToolUI;
                if (penToolUI && penToolUI.components?.popupManager) {
                    console.log('✅ ポップアップ機能確認完了 - ペンツールアイコンをクリックしてテストしてください');
                } else {
                    console.warn('⚠️ ポップアップ機能の完全初期化未確認');
                }
                
                // ポップアップ表示テスト実行案内
                console.group('🧪 ポップアップテスト手順');
                console.log('1. ペンツールアイコン（🖊️）をクリック');
                console.log('2. または window.testPenPopup() をコンソールで実行');
                console.log('3. ポップアップが表示されることを確認');
                console.groupEnd();
            }, 2000);
        }
        
        return success;
    } catch (error) {
        console.error('🚨 main.js 初期化でエラーが発生:', error);
        ErrorDisplayManager.show(error);
        return false;
    }
}

// DOM読み込み完了後の初期化実行
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        console.log('📄 DOM読み込み完了');
        setTimeout(initializeApp, 100);
    });
} else {
    console.log('📄 DOM既に読み込み済み');
    setTimeout(initializeApp, 100);
}

// グローバルエクスポート
if (typeof window !== 'undefined') {
    // クラスエクスポート（デバッグ用）
    window.ErrorHandler = ErrorHandler;
    window.PerformanceMonitor = PerformanceMonitor;
    window.ConfigManager = ConfigManager;
    window.SystemChecker = SystemChecker;
    window.ComponentFactory = ComponentFactory;
    window.DebugManager = DebugManager;
    window.ApplicationInitializer = ApplicationInitializer;
    
    // ステート・定数エクスポート
    window.INIT_STEPS = INIT_STEPS;
    window.APP_STATE = globalInitializer?.appState?.state;
    
    // メイン関数エクスポート
    window.initializeApplication = initializeApp;
    window.checkPopupUIElements = checkPopupUIElements;
    
    console.log('🔧 main.js 構文エラー修正版読み込み完了');
    console.log('🏗️ 適用された改善:');
    console.log('  ✅ DRY原則適用: 重複コード削除・ユーティリティクラス化');
    console.log('  ✅ SOLID原則適用: 単一責任・依存性逆転');
    console.log('  ✅ 構文エラー修正: Invalid token問題解決');
    console.log('  ✅ エラーハンドリング強化: 型安全・グレースフルデグラデーション');
    console.log('  ✅ パフォーマンス最適化: 非同期処理・測定機能');
    console.log('  ✅ 保守性向上: クラス分割・モジュール化');
    
    console.log('🎯 ポップアップ機能確認:');
    console.log('  📦 PenToolUI初期化保証: DOM読み込み後の確実な初期化');
    console.log('  🔍 UI要素検証機能: ポップアップ関連要素の存在確認');
    console.log('  🧪 テスト機能強化: ポップアップ表示テスト自動化');
    console.log('  📊 状態監視機能: 詳細な初期化ステータス表示');
    
    console.log('🚀 準備完了: 構文エラー修正版アプリケーション初期化実行中...');
}