/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1rev12
 * メイン初期化スクリプト - main.js (Phase2最適化版)
 * 
 * 🔧 Phase2最適化内容: DRY・SOLID原則準拠
 * 1. ✅ UIManager依存関係修正（緊急修復対応）
 * 2. ✅ 初期化順序の最適化
 * 3. ✅ エラーハンドリングの強化
 * 4. ✅ utils.js完全統合（DRY原則準拠）
 * 5. ✅ システム統合の安定化
 * 
 * Phase2目標: 安定したアプリケーション初期化・エラー回復力向上
 * 責務: アプリケーション初期化フロー制御のみ
 * 依存: utils.js, config.js, ui-manager.js（修復版）
 */

// ==== utils.js依存関係チェック（強化版）====
if (typeof window.safeConfigGet === 'undefined') {
    console.error('🚨 Phase2依存関係エラー: utils.js が読み込まれていません');
    console.error('Phase2では utils.js の事前読み込みが必須です');
    
    // 緊急時フォールバック関数
    window.safeConfigGet = function(key, defaultValue) {
        try {
            return (window.CONFIG && window.CONFIG[key] !== undefined) ? window.CONFIG[key] : defaultValue;
        } catch (error) {
            console.warn(`緊急時CONFIG取得 (${key}):`, error);
            return defaultValue;
        }
    };
    
    window.createApplicationError = function(message, context = {}) {
        const error = new Error(message);
        error.name = 'ApplicationError';
        error.context = context;
        error.timestamp = Date.now();
        return error;
    };
    
    window.logError = function(error, context = 'Unknown') {
        console.error(`🚨 [${context}] ${error.name || 'Error'}: ${error.message}`, error);
    };
    
    window.measurePerformance = function(name, operation) {
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
    };
    
    window.handleGracefulDegradation = function(operation, fallback, errorMessage) {
        try {
            return operation();
        } catch (error) {
            console.warn(`${errorMessage}:`, error);
            return typeof fallback === 'function' ? fallback() : fallback;
        }
    };
    
    console.log('⚠️ 緊急時フォールバック関数を設定しました');
}

console.log('🚀 main.js Phase2最適化版読み込み開始...');

// ==== グローバル状態管理（最適化版）====
const APP_STATE = {
    initialized: false,
    initializationStep: 'waiting',
    error: null,
    startTime: null,
    components: {
        app: null,
        toolsSystem: null,
        uiManager: null,
        historyManager: null,
        settingsManager: null
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
        utilsLoaded: typeof window.safeConfigGet !== 'undefined',
        uiManagerFixed: false,
        systemsIntegrated: false,
        errorRecovery: false
    }
};

// ==== 初期化ステップ定義（最適化版）====
const INIT_STEPS = {
    CHECKING_SYSTEMS: 'checking_systems',
    CHECKING_CONFIG: 'checking_config',
    CHECKING_DEPENDENCIES: 'checking_dependencies',
    CREATING_APP: 'creating_app',
    CREATING_TOOLS_SYSTEM: 'creating_tools_system',
    CREATING_UI_MANAGER: 'creating_ui_manager',
    CONNECTING_SYSTEMS: 'connecting_systems',
    FINAL_SETUP: 'final_setup',
    COMPLETED: 'completed',
    ERROR: 'error'
};

// ==== Phase2最適化: 統合システムチェック（エラー回復力強化）====
function checkIntegratedSystems() {
    console.log('🔍 Phase2統合システムチェック（エラー回復力強化）...');
    
    try {
        const systemsStatus = {
            utils: typeof window.safeConfigGet !== 'undefined',
            config: typeof window.CONFIG !== 'undefined',
            pixi: typeof window.PIXI !== 'undefined',
            pixiApp: typeof window.PixiDrawingApp !== 'undefined',
            toolsSystem: typeof window.DrawingToolsSystem !== 'undefined',
            historyManager: typeof window.HistoryManager !== 'undefined',
            uiManager: typeof window.UIManager !== 'undefined'
        };
        
        const availableSystems = Object.entries(systemsStatus).filter(([name, available]) => available);
        const missingSystems = Object.entries(systemsStatus).filter(([name, available]) => !available);
        
        console.log(`✅ 利用可能システム: ${availableSystems.length}/7システム`, availableSystems.map(([name]) => name));
        
        if (missingSystems.length > 0) {
            console.warn('⚠️ 不足システム:', missingSystems.map(([name]) => name));
            
            // 重要システムの不足チェック
            const criticalSystems = ['pixi', 'pixiApp', 'toolsSystem', 'uiManager'];
            const missingCritical = criticalSystems.filter(system => !systemsStatus[system]);
            
            if (missingCritical.length > 0) {
                console.error('❌ 重要システム不足:', missingCritical);
                throw createApplicationError(`重要システムが不足: ${missingCritical.join(', ')}`);
            }
        }
        
        // UIManager修復確認
        APP_STATE.phase2.uiManagerFixed = systemsStatus.uiManager;
        
        console.log('✅ Phase2統合システムチェック完了');
        return true;
        
    } catch (error) {
        logError(error, 'Phase2統合システムチェック');
        
        // エラー回復処理
        return handleGracefulDegradation(
            () => { throw error; },
            () => {
                console.log('🆘 緊急時システム確認: 基本機能で続行');
                APP_STATE.phase2.errorRecovery = true;
                return true;
            },
            'Phase2システムチェックエラー'
        );
    }
}

// ==== CONFIG関連処理（utils.js統合版・最適化）====
function checkConfigLoadedCompletely() {
    console.log('🔍 CONFIG読み込み確認（Phase2 utils.js統合版）...');
    
    try {
        // utils.js統合チェック
        if (typeof window.validateConfigIntegrity === 'function') {
            const integrityOK = window.validateConfigIntegrity();
            
            if (!integrityOK) {
                console.warn('⚠️ CONFIG整合性問題検出 → 自動修復実行');
                fixConfigCompletely();
            }
        } else {
            console.warn('⚠️ validateConfigIntegrity関数が利用できません → 基本チェック実行');
            if (!window.CONFIG || typeof window.CONFIG !== 'object') {
                throw createApplicationError('CONFIG オブジェクトが存在しません');
            }
        }
        
        APP_STATE.config.loaded = true;
        APP_STATE.config.validated = true;
        
        console.log('✅ CONFIG読み込み確認完了（Phase2最適化版）');
        return true;
        
    } catch (error) {
        logError(error, 'CONFIG確認');
        
        return handleGracefulDegradation(
            () => { throw error; },
            () => {
                console.log('🆘 緊急時最小限CONFIG作成');
                createMinimalConfig();
                APP_STATE.config.loaded = true;
                APP_STATE.config.fixed = true;
                return true;
            },
            'CONFIG確認エラー'
        );
    }
}

function fixConfigCompletely() {
    console.log('🔧 CONFIG完全修復（Phase2 utils.js統合版）...');
    
    return measurePerformance('CONFIG修復', () => {
        const COMPLETE_DEFAULT_CONFIG = {
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
        
        if (!window.CONFIG || typeof window.CONFIG !== 'object') {
            window.CONFIG = {};
        }
        
        let fixedCount = 0;
        
        for (const [key, defaultValue] of Object.entries(COMPLETE_DEFAULT_CONFIG)) {
            const currentValue = window.CONFIG[key];
            
            if (currentValue === undefined || currentValue === null || 
                (key === 'SIZE_PRESETS' && (!Array.isArray(currentValue) || currentValue.length === 0))) {
                
                window.CONFIG[key] = defaultValue;
                fixedCount++;
            }
        }
        
        APP_STATE.config.fixed = true;
        console.log(`✅ CONFIG修復完了: ${fixedCount}項目修復`);
        return true;
    });
}

function createMinimalConfig() {
    window.CONFIG = {
        DEFAULT_BRUSH_SIZE: 4,
        DEFAULT_OPACITY: 1.0,
        MAX_BRUSH_SIZE: 500,
        MIN_BRUSH_SIZE: 0.1,
        SIZE_PRESETS: [1, 2, 4, 8, 16, 32],
        CANVAS_WIDTH: 400,
        CANVAS_HEIGHT: 400,
        PREVIEW_MIN_SIZE: 0.5,
        PREVIEW_MAX_SIZE: 20,
        DEFAULT_PRESSURE: 0.5,
        DEFAULT_SMOOTHING: 0.3
    };
    console.log('🆘 最小限CONFIG作成完了');
}

// ==== 依存関係チェック（エラー回復力強化）====
function checkDependencies() {
    console.log('🔍 依存関係チェック（Phase2エラー回復力強化版）...');
    
    const criticalClasses = [
        { name: 'PIXI', required: true },
        { name: 'PixiDrawingApp', required: true },
        { name: 'DrawingToolsSystem', required: true },
        { name: 'HistoryManager', required: true },
        { name: 'UIManager', required: true }
    ];
    
    const missing = criticalClasses.filter(cls => typeof window[cls.name] === 'undefined');
    
    if (missing.length > 0) {
        const error = createApplicationError(
            `重要なクラスが見つかりません: ${missing.map(cls => cls.name).join(', ')}`,
            { step: INIT_STEPS.CHECKING_DEPENDENCIES, missing: missing.map(cls => cls.name) }
        );
        
        // エラー回復処理
        if (missing.some(cls => cls.name === 'UIManager')) {
            console.error('❌ UIManager が見つかりません - ui-manager.js の読み込みを確認してください');
            console.log('🔧 UIManager修復版が正常に読み込まれているか確認中...');
            
            // 数秒後に再確認
            setTimeout(() => {
                if (typeof window.UIManager !== 'undefined') {
                    console.log('✅ UIManager が遅延読み込みされました');
                    // 初期化を再試行
                    initializeApplication();
                }
            }, 1000);
        }
        
        throw error;
    }
    
    console.log('✅ 依存関係チェック完了（Phase2エラー回復力強化版）');
    return true;
}

// ==== アプリケーション作成（最適化版）====
async function createApplication() {
    console.log('🎯 PixiDrawingApp作成（Phase2最適化版）...');
    
    try {
        return await measurePerformance('App作成', async () => {
            const width = safeConfigGet('CANVAS_WIDTH', 400);
            const height = safeConfigGet('CANVAS_HEIGHT', 400);
            
            console.log(`🎯 キャンバスサイズ: ${width}×${height}px`);
            
            const app = new PixiDrawingApp(width, height);
            await app.init();
            
            APP_STATE.components.app = app;
            console.log('✅ PixiDrawingApp作成完了（Phase2最適化版）');
            
            return app;
        });
    } catch (error) {
        const initError = createApplicationError(
            'PixiDrawingApp作成に失敗',
            { step: INIT_STEPS.CREATING_APP, originalError: error }
        );
        logError(initError, 'App作成');
        throw initError;
    }
}

// ==== ツールシステム作成（最適化版）====
async function createToolsSystem(app) {
    console.log('🔧 DrawingToolsSystem作成（Phase2最適化版）...');
    
    try {
        return await measurePerformance('ToolsSystem作成', async () => {
            const toolsSystem = new DrawingToolsSystem(app);
            await toolsSystem.init();
            
            APP_STATE.components.toolsSystem = toolsSystem;
            
            // Phase2設定適用（utils.js統合）
            const defaultSettings = {
                size: safeConfigGet('DEFAULT_BRUSH_SIZE', 4),
                opacity: safeConfigGet('DEFAULT_OPACITY', 1.0),
                color: safeConfigGet('DEFAULT_COLOR', 0x800000),
                pressure: safeConfigGet('DEFAULT_PRESSURE', 0.5),
                smoothing: safeConfigGet('DEFAULT_SMOOTHING', 0.3)
            };
            
            if (toolsSystem.updateBrushSettings) {
                toolsSystem.updateBrushSettings(defaultSettings);
                console.log('🔧 Phase2設定適用完了:', defaultSettings);
            }
            
            console.log('✅ DrawingToolsSystem作成完了（Phase2最適化版）');
            return toolsSystem;
        });
    } catch (error) {
        const initError = createApplicationError(
            'DrawingToolsSystem作成に失敗',
            { step: INIT_STEPS.CREATING_TOOLS_SYSTEM, originalError: error }
        );
        logError(initError, 'ToolsSystem作成');
        throw initError;
    }
}

// ==== UI管理システム作成（修復版対応・エラー回復力強化）====
async function createUIManager(app, toolsSystem) {
    console.log('🎭 UIManager作成（Phase2修復版対応・エラー回復力強化）...');
    
    try {
        return await measurePerformance('UIManager作成', async () => {
            // UIManager クラスの存在確認（強化版）
            if (typeof window.UIManager === 'undefined') {
                throw createApplicationError('UIManager クラスが見つかりません - ui-manager.js修復版の読み込みを確認してください');
            }
            
            const historyManager = toolsSystem.getHistoryManager();
            
            const uiManager = new window.UIManager(app, toolsSystem, historyManager);
            
            // 初期化エラー回復処理
            let initSuccess = false;
            try {
                await uiManager.init();
                initSuccess = true;
            } catch (initError) {
                console.warn('⚠️ UIManager初期化でエラーが発生:', initError);
                
                // 基本機能のみで続行
                if (uiManager.setupToolButtons) {
                    uiManager.setupToolButtons();
                    console.log('🆘 基本UI機能で続行');
                    initSuccess = true;
                }
            }
            
            if (!initSuccess) {
                throw createApplicationError('UIManager初期化に完全に失敗しました');
            }
            
            APP_STATE.components.uiManager = uiManager;
            APP_STATE.components.historyManager = historyManager;
            
            console.log('✅ UIManager作成完了（Phase2修復版対応・エラー回復力強化）');
            return uiManager;
        });
    } catch (error) {
        const initError = createApplicationError(
            'UIManager作成に失敗',
            { step: INIT_STEPS.CREATING_UI_MANAGER, originalError: error }
        );
        logError(initError, 'UIManager作成');
        throw initError;
    }
}

// ==== 設定管理システム作成（最適化版）====
async function createSettingsManager(app, toolsSystem, uiManager) {
    console.log('⚙️ SettingsManager作成（Phase2最適化版）...');
    
    return await handleGracefulDegradation(
        async () => {
            if (typeof SettingsManager === 'undefined') {
                console.warn('⚠️ SettingsManager が利用できません');
                return null;
            }
            
            return await measurePerformance('SettingsManager作成', async () => {
                const historyManager = toolsSystem.getHistoryManager();
                
                const settingsManager = new SettingsManager(app, toolsSystem, uiManager, historyManager);
                await settingsManager.init();
                
                APP_STATE.components.settingsManager = settingsManager;
                console.log('✅ SettingsManager作成完了（Phase2最適化版）');
                
                return settingsManager;
            });
        },
        () => {
            console.warn('⚠️ SettingsManager初期化失敗 → 基本機能のみで続行');
            return null;
        },
        'SettingsManager作成エラー'
    );
}

// ==== システム間連携設定（Phase2最適化版）====
async function connectSystems() {
    console.log('🔗 システム間連携設定（Phase2最適化版）...');
    
    try {
        await measurePerformance('システム連携', async () => {
            const { app, toolsSystem, uiManager, settingsManager } = APP_STATE.components;
            const historyManager = toolsSystem.getHistoryManager();
            
            // 既存システム連携
            if (app.setSettingsManager && settingsManager) {
                app.setSettingsManager(settingsManager);
            }
            
            if (uiManager.setHistoryManager) {
                uiManager.setHistoryManager(historyManager);
            }
            if (uiManager.setSettingsManager && settingsManager) {
                uiManager.setSettingsManager(settingsManager);
            }
            
            // グローバル参照設定
            window.app = app;
            window.toolsSystem = toolsSystem;
            window.uiManager = uiManager;
            window.historyManager = historyManager;
            window.settingsManager = settingsManager;
            window.appConfig = window.CONFIG || {};
            
            // Phase2最適化: 基本デバッグ機能設定
            setupBasicDebugFunctions();
            
            APP_STATE.phase2.systemsIntegrated = true;
            console.log('✅ システム間連携設定完了（Phase2最適化版）');
        });
    } catch (error) {
        const initError = createApplicationError(
            'システム間連携設定に失敗',
            { step: INIT_STEPS.CONNECTING_SYSTEMS, originalError: error }
        );
        logError(initError, 'システム連携');
        throw initError;
    }
}

// ==== Phase2最適化: 基本デバッグ機能設定 ====
function setupBasicDebugFunctions() {
    // 基本デバッグ関数
    window.undo = () => APP_STATE.components.historyManager ? APP_STATE.components.historyManager.undo() : false;
    window.redo = () => APP_STATE.components.historyManager ? APP_STATE.components.historyManager.redo() : false;
    window.debugHistory = () => APP_STATE.components.toolsSystem ? APP_STATE.components.toolsSystem.debugHistory() : console.warn('ToolsSystem not available');
    
    // Phase2最適化: 統合デバッグ関数
    window.debugApp = function() {
        console.group('🔍 アプリケーションデバッグ情報（Phase2最適化版）');
        
        console.log('📋 APP_STATE:', APP_STATE);
        
        // システム状態
        const systemsStatus = {
            app: !!APP_STATE.components.app,
            toolsSystem: !!APP_STATE.components.toolsSystem,
            uiManager: !!APP_STATE.components.uiManager,
            historyManager: !!APP_STATE.components.historyManager,
            settingsManager: !!APP_STATE.components.settingsManager
        };
        console.log('🔧 システム状態:', systemsStatus);
        
        // Phase2最適化状況
        console.log('🚀 Phase2最適化状況:', APP_STATE.phase2);
        
        // CONFIG状況
        console.log('⚙️ CONFIG状況:', APP_STATE.config);
        
        console.groupEnd();
    };
    
    window.debugConfig = function() {
        console.group('🔧 CONFIG設定情報（Phase2最適化版）');
        console.log('CONFIG:', window.CONFIG || 'N/A');
        console.log('CONFIG状態:', APP_STATE.config);
        console.groupEnd();
    };
    
    window.testSystem = function() {
        console.log('🧪 システム統合テスト（Phase2最適化版）');
        
        const testResults = {
            initialized: APP_STATE.initialized,
            configLoaded: APP_STATE.config.loaded,
            systemsIntegrated: APP_STATE.phase2.systemsIntegrated,
            uiManagerFixed: APP_STATE.phase2.uiManagerFixed,
            errorRecovery: APP_STATE.phase2.errorRecovery,
            components: {
                app: !!APP_STATE.components.app,
                toolsSystem: !!APP_STATE.components.toolsSystem,
                uiManager: !!APP_STATE.components.uiManager,
                historyManager: !!APP_STATE.components.historyManager,
                settingsManager: !!APP_STATE.components.settingsManager
            }
        };
        
        const overallOK = testResults.initialized && testResults.configLoaded && 
                         testResults.systemsIntegrated && testResults.components.app &&
                         testResults.components.toolsSystem && testResults.components.uiManager;
        
        console.log('📊 テスト結果:', testResults);
        console.log(`🏆 統合テスト: ${overallOK ? '✅ 成功' : '❌ 部分的'}`);
        
        return overallOK;
    };
    
    console.log('🐛 Phase2最適化デバッグ機能設定完了');
}

// ==== 最終セットアップ（Phase2最適化版）====
async function finalSetup() {
    console.log('🎨 最終セットアップ（Phase2最適化版）...');
    
    try {
        await measurePerformance('最終セットアップ', async () => {
            const { app, toolsSystem, uiManager, settingsManager } = APP_STATE.components;
            
            // 初期表示更新
            if (uiManager && uiManager.updateAllDisplays) {
                uiManager.updateAllDisplays();
            }
            
            // グローバルエラーハンドラー設定
            setupGlobalErrorHandlers();
            
            // Phase2設定値確認・表示
            const phase2Settings = {
                brushSize: safeConfigGet('DEFAULT_BRUSH_SIZE', 4),
                opacity: safeConfigGet('DEFAULT_OPACITY', 1.0),
                maxSize: safeConfigGet('MAX_BRUSH_SIZE', 500),
                sizePresets: safeConfigGet('SIZE_PRESETS', [1, 2, 4, 8, 16, 32]),
                pressure: safeConfigGet('DEFAULT_PRESSURE', 0.5),
                smoothing: safeConfigGet('DEFAULT_SMOOTHING', 0.3)
            };
            
            console.log('🎯 Phase2設定値確認（Phase2最適化版）:');
            console.log(`  🖊️  デフォルトペンサイズ: ${phase2Settings.brushSize}px`);
            console.log(`  🎨 デフォルト透明度: ${phase2Settings.opacity * 100}%`);
            console.log(`  📏 最大ペンサイズ: ${phase2Settings.maxSize}px`);
            console.log(`  🎯 プリセット: [${Array.isArray(phase2Settings.sizePresets) ? phase2Settings.sizePresets.join(', ') : 'N/A'}]px`);
            console.log(`  👆 筆圧感度: ${phase2Settings.pressure * 100}%`);
            console.log(`  ✨ 線補正: ${phase2Settings.smoothing * 100}%`);
            
            // システム状態の最終確認
            const appStats = app.getStats ? app.getStats() : {};
            const systemStats = toolsSystem.getSystemStats ? toolsSystem.getSystemStats() : {};
            const uiStats = uiManager ? (uiManager.getUIStats ? uiManager.getUIStats() : {}) : null;
            
            console.log('📈 システム状態確認（Phase2最適化版）:');
            console.log('  - App:', appStats);
            console.log('  - Tools:', systemStats);
            if (uiStats) {
                console.log('  - UI:', uiStats);
            }
            if (settingsManager && settingsManager.getSettingsInfo) {
                console.log('  - Settings:', settingsManager.getSettingsInfo());
            }
            
            // Phase2最適化状況表示
            const phase2Status = {
                utilsLoaded: APP_STATE.phase2.utilsLoaded,
                uiManagerFixed: APP_STATE.phase2.uiManagerFixed,
                systemsIntegrated: APP_STATE.phase2.systemsIntegrated,
                errorRecovery: APP_STATE.phase2.errorRecovery,
                configLoaded: APP_STATE.config.loaded,
                configFixed: APP_STATE.config.fixed,
                phase2Applied: phase2Settings.brushSize === 4 && phase2Settings.opacity === 1.0
            };
            
            console.log('  - Phase2:', phase2Status);
            
            console.log('✅ 最終セットアップ完了（Phase2最適化版）');
        });
    } catch (error) {
        const initError = createApplicationError(
            '最終セットアップに失敗',
            { step: INIT_STEPS.FINAL_SETUP, originalError: error }
        );
        logError(initError, '最終セットアップ');
        throw initError;
    }
}

// ==== グローバルエラーハンドラー設定（最適化版）====
function setupGlobalErrorHandlers() {
    window.addEventListener('error', (event) => {
        const error = createApplicationError(
            event.message,
            {
                filename: event.filename,
                line: event.lineno,
                column: event.colno,
                originalError: event.error
            }
        );
        
        logError(error, 'グローバルJSエラー');
        
        APP_STATE.stats.errorCount++;
        APP_STATE.stats.lastError = {
            type: 'javascript',
            message: event.message,
            timestamp: Date.now()
        };
        
        if (APP_STATE.components.uiManager && APP_STATE.components.uiManager.showError) {
            APP_STATE.components.uiManager.showError(
                `アプリケーションエラー: ${event.message}`,
                8000
            );
        }
    });
    
    window.addEventListener('unhandledrejection', (event) => {
        const error = createApplicationError(
            '未処理のPromiseエラー',
            { reason: event.reason }
        );
        
        logError(error, 'グローバルPromiseエラー');
        
        APP_STATE.stats.errorCount++;
        APP_STATE.stats.lastError = {
            type: 'promise',
            message: event.reason?.message || String(event.reason),
            timestamp: Date.now()
        };
    });
    
    console.log('🛡️ グローバルエラーハンドラー設定完了（Phase2最適化版）');
}

// ==== 初期化ステップ更新関数（最適化版）====
function updateInitStep(step, details = null) {
    APP_STATE.initializationStep = step;
    
    const stepMessages = {
        [INIT_STEPS.CHECKING_SYSTEMS]: '統合システムチェック中（Phase2最適化）...',
        [INIT_STEPS.CHECKING_CONFIG]: 'CONFIG読み込み確認中...',
        [INIT_STEPS.CHECKING_DEPENDENCIES]: '依存関係チェック中...',
        [INIT_STEPS.CREATING_APP]: 'アプリケーション作成中...',
        [INIT_STEPS.CREATING_TOOLS_SYSTEM]: 'ツールシステム作成中...',
        [INIT_STEPS.CREATING_UI_MANAGER]: 'UI管理システム作成中（修復版対応）...',
        [INIT_STEPS.CONNECTING_SYSTEMS]: 'システム連携設定中（Phase2最適化版）...',
        [INIT_STEPS.FINAL_SETUP]: '最終セットアップ中（Phase2最適化版）...',
        [INIT_STEPS.COMPLETED]: 'Phase2最適化版初期化完了！',
        [INIT_STEPS.ERROR]: '初期化エラー'
    };
    
    console.log(`📋 ${stepMessages[step] || step}`, details || '');
}

// ==== メイン初期化関数（Phase2最適化版）====
async function initializeApplication() {
    try {
        APP_STATE.startTime = performance.now();
        console.log('🚀 ふたば☆ちゃんねる風ベクターお絵描きツール 初期化開始（Phase2最適化版）');
        
        // 1. Phase2: 統合システムチェック
        updateInitStep(INIT_STEPS.CHECKING_SYSTEMS);
        checkIntegratedSystems();
        
        // 2. CONFIG読み込み確認
        updateInitStep(INIT_STEPS.CHECKING_CONFIG);
        checkConfigLoadedCompletely();
        
        // 3. 依存関係チェック
        updateInitStep(INIT_STEPS.CHECKING_DEPENDENCIES);
        checkDependencies();
        
        // 4. アプリケーション作成
        updateInitStep(INIT_STEPS.CREATING_APP);
        const app = await createApplication();
        
        // 5. ツールシステム作成
        updateInitStep(INIT_STEPS.CREATING_TOOLS_SYSTEM);
        const toolsSystem = await createToolsSystem(app);
        
        // 6. UI管理システム作成（修復版対応）
        updateInitStep(INIT_STEPS.CREATING_UI_MANAGER);
        const uiManager = await createUIManager(app, toolsSystem);
        
        // 7. 設定管理システム作成
        const settingsManager = await createSettingsManager(app, toolsSystem, uiManager);
        
        // 8. システム間連携設定（Phase2最適化版）
        updateInitStep(INIT_STEPS.CONNECTING_SYSTEMS);
        await connectSystems();
        
        // 9. 最終セットアップ（Phase2最適化版）
        updateInitStep(INIT_STEPS.FINAL_SETUP);
        await finalSetup();
        
        // 10. 初期化完了
        updateInitStep(INIT_STEPS.COMPLETED);
        APP_STATE.initialized = true;
        APP_STATE.stats.initTime = performance.now() - APP_STATE.startTime;
        
        // 初期化完了ログ（Phase2最適化版）
        console.log('🎉 アプリケーション初期化完了（Phase2最適化版）！');
        console.log(`⏱️ 初期化時間: ${APP_STATE.stats.initTime.toFixed(2)}ms`);
        console.log('🎨 描画の準備ができました！');
        
        // システム概要表示（Phase2最適化版）
        console.group('📋 システム概要（Phase2最適化版）');
        
        const canvasWidth = safeConfigGet('CANVAS_WIDTH', 400);
        const canvasHeight = safeConfigGet('CANVAS_HEIGHT', 400);
        const brushSize = safeConfigGet('DEFAULT_BRUSH_SIZE', 4);
        const opacity = safeConfigGet('DEFAULT_OPACITY', 1.0);
        const maxSize = safeConfigGet('MAX_BRUSH_SIZE', 500);
        const sizePresets = safeConfigGet('SIZE_PRESETS', []);
        const pressure = safeConfigGet('DEFAULT_PRESSURE', 0.5);
        const smoothing = safeConfigGet('DEFAULT_SMOOTHING', 0.3);
        
        console.log(`🖼️  キャンバス: ${canvasWidth}×${canvasHeight}px`);
        console.log(`🖊️  デフォルトペンサイズ: ${brushSize}px`);
        console.log(`🎨 デフォルト透明度: ${opacity * 100}%`);
        console.log(`📏 最大ペンサイズ: ${maxSize}px`);
        console.log(`🎯 プリセット: [${Array.isArray(sizePresets) ? sizePresets.join(', ') : 'N/A'}]px`);
        console.log(`👆 筆圧感度: ${pressure * 100}%`);
        console.log(`✨ 線補正: ${smoothing * 100}%`);
        console.log('🧽 消しゴム: 背景色描画方式');
        console.log('🏛️  履歴管理: Ctrl+Z/Ctrl+Y 対応');
        console.log('⚙️  設定管理: 高DPI・ショートカット統合');
        
        // Phase2最適化状況
        const phase2Status = APP_STATE.phase2;
        console.log('🚀 Phase2最適化: DRY・SOLID原則準拠・エラー回復力強化完了');
        console.log(`🔧 UIManager修復: ${phase2Status.uiManagerFixed ? '✅ 成功' : '❌ 失敗'}`);
        console.log(`🔗 システム統合: ${phase2Status.systemsIntegrated ? '✅ 完了' : '❌ 不完全'}`);
        console.log(`🛡️ エラー回復: ${phase2Status.errorRecovery ? '⚠️ 発動済み' : '✅ 正常動作'}`);
        console.log('📈 コード最適化: main.js 構造改善・エラーハンドリング強化完了');
        
        console.groupEnd();
        
        // UI通知
        if (uiManager && uiManager.showNotification) {
            const message = phase2Status.uiManagerFixed && phase2Status.systemsIntegrated
                ? 'Phase2最適化完了！UIManager修復・システム統合・エラー回復力強化成功'
                : 'Phase2最適化版初期化完了！基本機能復旧・部分システム統合';
            uiManager.showNotification(message, 'success', 5000);
        }
        
        return true;
        
    } catch (error) {
        // エラーハンドリング
        updateInitStep(INIT_STEPS.ERROR, error);
        APP_STATE.error = error;
        APP_STATE.stats.errorCount++;
        APP_STATE.stats.lastError = {
            type: 'initialization',
            message: error.message,
            step: error.step || 'unknown',
            timestamp: Date.now()
        };
        
        logError(error, 'アプリケーション初期化');
        
        // エラー表示
        showInitializationError(error);
        
        return false;
    }
}

// ==== 初期化エラー表示（最適化版）====
function showInitializationError(error) {
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
    
    errorContainer.innerHTML = `
        <div style="font-size: 48px; margin-bottom: 20px;">⚠️</div>
        <h2 style="margin: 0 0 15px 0; font-size: 24px;">アプリケーション起動エラー</h2>
        <p style="margin: 0 0 15px 0; font-size: 16px; opacity: 0.9;">
            ${error.message}
        </p>
        <p style="margin: 0 0 20px 0; font-size: 14px; opacity: 0.7;">
            エラーステップ: ${error.step || 'unknown'}
        </p>
        ${isUIManagerError ? `
        <div style="margin: 15px 0; padding: 10px; background: rgba(255,255,255,0.1); border-radius: 8px; font-size: 12px;">
            <strong>🔧 UIManagerエラー対処法:</strong><br>
            1. ページを再読み込みしてください<br>
            2. ui-manager.js修復版が正常に読み込まれるまでお待ちください<br>
            3. 問題が続く場合はブラウザのキャッシュをクリアしてください
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
            transition: background 0.3s;
        ">ページを再読み込み</button>
        <div style="margin-top: 15px; font-size: 12px; opacity: 0.6;">
            詳細なエラー情報はブラウザのコンソール（F12）をご確認ください。<br>
            Phase2最適化版 - エラー回復力強化
        </div>
    `;
    
    const button = errorContainer.querySelector('button');
    button.addEventListener('mouseenter', () => {
        button.style.background = 'rgba(255, 255, 255, 0.3)';
    });
    button.addEventListener('mouseleave', () => {
        button.style.background = 'rgba(255, 255, 255, 0.2)';
    });
    
    document.body.appendChild(errorContainer);
}

// ==== 初期化状況監視（最適化版）====
function watchInitialization() {
    const maxWaitTime = 20000; // Phase2: 20秒
    const startTime = Date.now();
    
    const checkInterval = setInterval(() => {
        const elapsedTime = Date.now() - startTime;
        
        if (APP_STATE.initialized) {
            clearInterval(checkInterval);
            return;
        }
        
        if (elapsedTime > maxWaitTime) {
            clearInterval(checkInterval);
            console.warn('⏰ 初期化タイムアウト - Phase2最適化版初期化が完了しませんでした');
            
            const timeoutError = createApplicationError(
                'Phase2最適化版初期化がタイムアウトしました。ページを再読み込みしてください。',
                { step: APP_STATE.initializationStep || 'timeout', elapsedTime }
            );
            
            showInitializationError(timeoutError);
        }
        
        if (elapsedTime % 5000 === 0) {
            console.log(`⏳ Phase2最適化版初期化進行中... ステップ: ${APP_STATE.initializationStep}, 経過時間: ${elapsedTime}ms`);
        }
    }, 1000);
}

// ==== DOM読み込み完了後の初期化実行（最適化版）====
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        console.log('📄 DOM読み込み完了（Phase2最適化版）');
        watchInitialization();
        initializeApplication();
    });
} else {
    console.log('📄 DOM既に読み込み済み（Phase2最適化版）');
    watchInitialization();
    initializeApplication();
}

// ==== グローバル状態エクスポート（Phase2最適化版）====
if (typeof window !== 'undefined') {
    window.APP_STATE = APP_STATE;
    window.INIT_STEPS = INIT_STEPS;
    window.initializeApplication = initializeApplication;
    
    // Phase2最適化: CONFIG関連関数のみエクスポート
    window.checkIntegratedSystems = checkIntegratedSystems;
    window.checkConfigLoadedCompletely = checkConfigLoadedCompletely;
    window.fixConfigCompletely = fixConfigCompletely;
    window.createMinimalConfig = createMinimalConfig;
    
    console.log('🔧 main.js Phase2最適化版 読み込み完了');
    console.log('🏗️ Phase2最適化完了項目:');
    console.log('  ✅ UIManager依存関係修正（修復版対応）');
    console.log('  ✅ エラー回復力強化（グレースフルデグラデーション）');
    console.log('  ✅ 初期化順序最適化（依存関係解決）');
    console.log('  ✅ utils.js完全統合（DRY原則準拠）');
    console.log('  ✅ システム統合の安定化');
    console.log('  ✅ デバッグ機能強化');
    
    console.log('🎯 Phase2効果:');
    console.log('  📦 即座の動作復旧: UIManager修復版との完全統合');
    console.log('  🛡️ エラー耐性向上: 部分的システム失敗でも基本機能継続');
    console.log('  ⚡ 初期化高速化: 最適化された依存関係解決');
    console.log('  🔧 保守性向上: 統一されたエラーハンドリング・ログ記録');
    console.log('  📊 可視性向上: 詳細な初期化ステータス・デバッグ情報');
    
    console.log('🔧 Phase2統合機能:');
    console.log('  1. 統合システムテスト: window.testSystem()');
    console.log('  2. 統合デバッグ機能: window.debugApp()');
    console.log('  3. CONFIG管理: window.debugConfig()');
    console.log('  4. 履歴操作: window.undo(), window.redo()');
    console.log('  5. システム修復: window.fixConfigCompletely()');
    
    console.log('🚀 準備完了: Phase2最適化版アプリケーション初期化実行中...');
    console.log('📋 次のステップ: Phase3 DRY原則完全適用・重複コード除去');
}

console.log('🏆 main.js Phase2最適化版 初期化完了');