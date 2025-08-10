/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1rev5
 * メイン初期化スクリプト - main.js 
 * 
 * 🔧 v1.9修正内容（Rulebook準拠・責務分離対応版）:
 * 1. 依存関係チェック修正（削除されたクラスの除外）
 * 2. ShortcutManager、PerformanceMonitor、LayerSystemの依存関係削除
 * 3. 正しいクラス配置確認
 * 4. エラーハンドリング最適化
 * 
 * 責務: アプリケーション統合初期化・エラーハンドリング・循環参照解決
 * 依存: 全システムファイル（Rulebook準拠7ファイル構成）
 */

// ==== グローバル状態管理 ====
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
    }
};

// ==== 初期化ステップ定義 ====
const INIT_STEPS = {
    CHECKING_DEPENDENCIES: 'checking_dependencies',
    CREATING_APP: 'creating_app',
    CREATING_TOOLS_SYSTEM: 'creating_tools_system',
    CREATING_UI_MANAGER: 'creating_ui_manager',
    CREATING_SETTINGS_MANAGER: 'creating_settings_manager',
    CONNECTING_SYSTEMS: 'connecting_systems',
    FINAL_SETUP: 'final_setup',
    COMPLETED: 'completed',
    ERROR: 'error'
};

// ==== エラーハンドリングシステム ====
class InitializationError extends Error {
    constructor(message, step, originalError = null) {
        super(message);
        this.name = 'InitializationError';
        this.step = step;
        this.originalError = originalError;
        this.timestamp = Date.now();
    }
}

// ==== 依存関係チェック（v1.9修正版・責務分離対応）====
function checkDependencies() {
    console.log('🔍 依存関係チェック開始（v1.9修正版・責務分離対応）...');
    
    const requiredClasses = {
        // PIXI.js
        'PIXI': typeof PIXI !== 'undefined',
        
        // Core classes（必須）
        'PixiDrawingApp': typeof PixiDrawingApp !== 'undefined',
        'DrawingToolsSystem': typeof DrawingToolsSystem !== 'undefined',
        'HistoryManager': typeof HistoryManager !== 'undefined',
        'UIManager': typeof UIManager !== 'undefined',
        
        // Settings classes（必須）
        'SettingsManager': typeof SettingsManager !== 'undefined',
        'ShortcutManager': typeof ShortcutManager !== 'undefined', // settings-manager.js内
        
        // UI Component classes（ui/components.jsから）
        'SliderController': typeof SliderController !== 'undefined',
        'PopupManager': typeof PopupManager !== 'undefined',
        'StatusBarManager': typeof StatusBarManager !== 'undefined',
        
        // Performance Monitor（ui-manager.js内）
        'PerformanceMonitor': typeof PerformanceMonitor !== 'undefined',
        
        // State management（history-manager.js内）
        'InternalStateCapture': typeof InternalStateCapture !== 'undefined',
        'InternalStateRestore': typeof InternalStateRestore !== 'undefined',
        
        // StateCapture/StateRestore エイリアス（drawing-tools.js内）
        'StateCapture': typeof StateCapture !== 'undefined',
        'StateRestore': typeof StateRestore !== 'undefined'
    };
    
    const missing = [];
    const available = [];
    
    for (const [className, isAvailable] of Object.entries(requiredClasses)) {
        if (isAvailable) {
            available.push(className);
        } else {
            missing.push(className);
        }
    }
    
    console.log(`✅ 利用可能: ${available.length}個`, available);
    
    if (missing.length > 0) {
        console.error(`❌ 不足: ${missing.length}個`, missing);
        
        // 重要でない不足があっても警告のみで続行する場合の処理
        const criticalMissing = missing.filter(className => 
            ['PIXI', 'PixiDrawingApp', 'DrawingToolsSystem', 'HistoryManager', 'UIManager'].includes(className)
        );
        
        if (criticalMissing.length > 0) {
            throw new InitializationError(
                `重要なクラスが見つかりません: ${criticalMissing.join(', ')}`,
                INIT_STEPS.CHECKING_DEPENDENCIES
            );
        } else {
            console.warn(`⚠️ 一部クラスが不足していますが、初期化を続行します: ${missing.join(', ')}`);
        }
    }
    
    console.log('✅ 依存関係チェック完了（v1.9修正版）');
    console.log('🔧 修正項目:');
    console.log('  - ShortcutManager: settings-manager.js内で確認');
    console.log('  - PerformanceMonitor: ui-manager.js内で確認');
    console.log('  - LayerSystem: 削除（将来のlayer-manager.js予定）');
    console.log('  - StateCapture/StateRestore: 正しい参照確認');
    
    return true;
}

// ==== アプリケーション作成 ====
async function createApplication() {
    console.log('🎯 PixiDrawingApp作成中...');
    
    try {
        const app = new PixiDrawingApp(400, 400);
        await app.init(); // settings-managerはnullで初期化（後で設定）
        
        APP_STATE.components.app = app;
        console.log('✅ PixiDrawingApp作成完了');
        
        return app;
    } catch (error) {
        throw new InitializationError(
            'PixiDrawingApp作成に失敗',
            INIT_STEPS.CREATING_APP,
            error
        );
    }
}

// ==== ツールシステム作成 ====
async function createToolsSystem(app) {
    console.log('🔧 DrawingToolsSystem作成中（v1.9責務分離版）...');
    
    try {
        const toolsSystem = new DrawingToolsSystem(app);
        await toolsSystem.init();
        
        APP_STATE.components.toolsSystem = toolsSystem;
        console.log('✅ DrawingToolsSystem作成完了（v1.9責務分離版）');
        
        return toolsSystem;
    } catch (error) {
        throw new InitializationError(
            'DrawingToolsSystem作成に失敗',
            INIT_STEPS.CREATING_TOOLS_SYSTEM,
            error
        );
    }
}

// ==== UI管理システム作成 ====
async function createUIManager(app, toolsSystem) {
    console.log('🎭 UIManager作成中（v1.9パフォーマンス監視統合版）...');
    
    try {
        const uiManager = new UIManager(app, toolsSystem);
        await uiManager.init();
        
        APP_STATE.components.uiManager = uiManager;
        console.log('✅ UIManager作成完了（v1.9パフォーマンス監視統合版）');
        
        return uiManager;
    } catch (error) {
        throw new InitializationError(
            'UIManager作成に失敗',
            INIT_STEPS.CREATING_UI_MANAGER,
            error
        );
    }
}

// ==== 設定管理システム作成 ====
async function createSettingsManager(app, toolsSystem, uiManager) {
    console.log('⚙️ SettingsManager作成中（v1.9ショートカット統合版）...');
    
    try {
        // 履歴管理システムは toolsSystem から取得
        const historyManager = toolsSystem.getHistoryManager();
        
        if (typeof SettingsManager === 'undefined') {
            console.warn('⚠️ SettingsManager が利用できません。基本機能のみで続行します。');
            return null;
        }
        
        const settingsManager = new SettingsManager(
            app, 
            toolsSystem, 
            uiManager, 
            historyManager
        );
        
        await settingsManager.init();
        
        APP_STATE.components.settingsManager = settingsManager;
        console.log('✅ SettingsManager作成完了（v1.9ショートカット統合版）');
        
        return settingsManager;
    } catch (error) {
        console.warn('⚠️ SettingsManager初期化に失敗:', error);
        console.warn('基本機能のみで続行します。');
        return null;
    }
}

// ==== システム間連携設定 ====
async function connectSystems() {
    console.log('🔗 システム間連携設定中（v1.9修正版）...');
    
    try {
        const { app, toolsSystem, uiManager, settingsManager } = APP_STATE.components;
        const historyManager = toolsSystem.getHistoryManager();
        
        // 1. AppCore に SettingsManager を設定
        if (app.setSettingsManager && settingsManager) {
            app.setSettingsManager(settingsManager);
        }
        
        // 2. UIManager に履歴管理と設定管理を設定
        if (uiManager.setHistoryManager) {
            uiManager.setHistoryManager(historyManager);
        }
        if (uiManager.setSettingsManager && settingsManager) {
            uiManager.setSettingsManager(settingsManager);
        }
        
        // 3. 設定変更イベントの接続
        if (settingsManager && uiManager) {
            settingsManager.on('settings:changed', (event) => {
                if (uiManager.handleSettingChange) {
                    uiManager.handleSettingChange(event.key, event.newValue);
                }
            });
            
            settingsManager.on('settings:loaded', (event) => {
                if (uiManager.handleSettingsLoaded) {
                    uiManager.handleSettingsLoaded(event.settings);
                }
            });
        }
        
        // 4. グローバル参照設定（デバッグ用）
        window.app = app;
        window.toolsSystem = toolsSystem;
        window.uiManager = uiManager;
        window.historyManager = historyManager;
        window.settingsManager = settingsManager;
        
        // 5. デバッグ用のグローバル関数設定
        window.undo = () => historyManager ? historyManager.undo() : false;
        window.redo = () => historyManager ? historyManager.redo() : false;
        window.debugHistory = () => toolsSystem ? toolsSystem.debugHistory() : console.warn('ToolsSystem not available');
        window.testHistory = () => toolsSystem ? toolsSystem.testHistoryFunction() : console.warn('ToolsSystem not available');
        window.getHistoryStats = () => historyManager ? historyManager.getStats() : null;
        window.clearHistory = () => historyManager ? historyManager.clearHistory() : false;
        window.showSystemStats = () => toolsSystem ? console.log(toolsSystem.getSystemStats()) : console.warn('ToolsSystem not available');
        
        // 6. v1.9追加：パフォーマンス統計とUI統合デバッグ関数
        window.getPerformanceStats = () => uiManager ? uiManager.getPerformanceStats() : null;
        window.debugUI = () => uiManager ? uiManager.debugUI() : console.warn('UIManager not available');
        window.debugSettings = () => settingsManager ? settingsManager.debugSettings() : console.warn('SettingsManager not available');
        
        console.log('✅ システム間連携設定完了（v1.9修正版）');
        console.log('🐛 デバッグ関数設定完了:');
        console.log('  【履歴管理】');
        console.log('    - window.undo() - アンドゥ実行');
        console.log('    - window.redo() - リドゥ実行');
        console.log('    - window.debugHistory() - 履歴詳細表示');
        console.log('    - window.testHistory() - 履歴機能テスト');
        console.log('    - window.getHistoryStats() - 履歴統計取得');
        console.log('    - window.clearHistory() - 履歴クリア');
        console.log('  【システム統計】');
        console.log('    - window.showSystemStats() - システム統計表示');
        console.log('    - window.getPerformanceStats() - パフォーマンス統計（v1.9新規）');
        console.log('  【デバッグ】');
        console.log('    - window.debugUI() - UI管理デバッグ（v1.9新規）');
        console.log('    - window.debugSettings() - 設定管理デバッグ（v1.9新規）');
        
    } catch (error) {
        throw new InitializationError(
            'システム間連携設定に失敗',
            INIT_STEPS.CONNECTING_SYSTEMS,
            error
        );
    }
}

// ==== 最終セットアップ ====
async function finalSetup() {
    console.log('🎨 最終セットアップ中（v1.9修正版）...');
    
    try {
        const { app, toolsSystem, uiManager, settingsManager } = APP_STATE.components;
        
        // 1. 初期表示更新
        if (uiManager && uiManager.updateAllDisplays) {
            uiManager.updateAllDisplays();
        }
        
        // 2. アプリケーションエラーハンドラー設定
        setupGlobalErrorHandlers();
        
        // 3. デバッグ機能設定
        setupDebugFunctions();
        
        // 4. パフォーマンス監視状態確認（v1.9新規）
        if (uiManager && uiManager.getPerformanceStats) {
            const performanceStats = uiManager.getPerformanceStats();
            console.log('📊 パフォーマンス監視状態:', {
                fps: performanceStats.fps || 'N/A',
                memoryUsage: performanceStats.memoryUsage || 'N/A',
                integrated: 'UI統合版'
            });
        }
        
        // 5. ショートカットシステム状態確認（v1.9新規）
        if (settingsManager && settingsManager.getShortcutInfo) {
            const shortcutInfo = settingsManager.getShortcutInfo();
            console.log('⌨️ ショートカットシステム状態:', {
                enabled: shortcutInfo.enabled,
                managerActive: shortcutInfo.manager?.isEnabled || false,
                integrated: 'Settings統合版'
            });
        }
        
        // 6. アプリケーション状態の最終確認
        const appStats = app.getStats ? app.getStats() : {};
        const systemStats = toolsSystem.getSystemStats ? toolsSystem.getSystemStats() : {};
        const uiStats = uiManager ? uiManager.getUIStats() : null;
        
        console.log('📈 システム状態確認（v1.9修正版）:');
        console.log('  - App:', appStats);
        console.log('  - Tools:', systemStats);
        if (uiStats) {
            console.log('  - UI:', uiStats);
        }
        if (settingsManager && settingsManager.getSettingsInfo) {
            console.log('  - Settings:', settingsManager.getSettingsInfo());
        }
        
        console.log('✅ 最終セットアップ完了（v1.9修正版）');
        
    } catch (error) {
        throw new InitializationError(
            '最終セットアップに失敗',
            INIT_STEPS.FINAL_SETUP,
            error
        );
    }
}

// ==== グローバルエラーハンドラー設定 ====
function setupGlobalErrorHandlers() {
    // JavaScript エラー
    window.addEventListener('error', (event) => {
        console.error('🚨 アプリケーションエラー:', {
            message: event.message,
            filename: event.filename,
            line: event.lineno,
            column: event.colno,
            error: event.error
        });
        
        APP_STATE.stats.errorCount++;
        APP_STATE.stats.lastError = {
            type: 'javascript',
            message: event.message,
            timestamp: Date.now()
        };
        
        // UI通知（利用可能な場合）
        if (APP_STATE.components.uiManager && APP_STATE.components.uiManager.showError) {
            APP_STATE.components.uiManager.showError(
                `アプリケーションエラー: ${event.message}`,
                8000
            );
        }
    });
    
    // Promise エラー
    window.addEventListener('unhandledrejection', (event) => {
        console.error('🚨 未処理のPromiseエラー:', event.reason);
        
        APP_STATE.stats.errorCount++;
        APP_STATE.stats.lastError = {
            type: 'promise',
            message: event.reason?.message || String(event.reason),
            timestamp: Date.now()
        };
    });
    
    console.log('🛡️ グローバルエラーハンドラー設定完了');
}

// ==== デバッグ機能設定 ====
function setupDebugFunctions() {
    // グローバルデバッグ関数
    window.debugApp = function() {
        console.group('🔍 アプリケーションデバッグ情報（v1.9修正版）');
        console.log('状態:', APP_STATE);
        
        if (APP_STATE.components.app) {
            console.log('App統計:', APP_STATE.components.app.getStats ? APP_STATE.components.app.getStats() : 'N/A');
        }
        
        if (APP_STATE.components.toolsSystem) {
            console.log('Tools統計:', APP_STATE.components.toolsSystem.getSystemStats ? APP_STATE.components.toolsSystem.getSystemStats() : 'N/A');
        }
        
        if (APP_STATE.components.uiManager) {
            console.log('UI統計:', APP_STATE.components.uiManager.getUIStats ? APP_STATE.components.uiManager.getUIStats() : 'N/A');
            
            // v1.9新規：パフォーマンス統計も含める
            if (APP_STATE.components.uiManager.getPerformanceStats) {
                console.log('Performance統計:', APP_STATE.components.uiManager.getPerformanceStats());
            }
        }
        
        if (APP_STATE.components.settingsManager && APP_STATE.components.settingsManager.getSettingsInfo) {
            console.log('Settings統計:', APP_STATE.components.settingsManager.getSettingsInfo());
            
            // v1.9新規：ショートカット情報も含める
            if (APP_STATE.components.settingsManager.getShortcutInfo) {
                console.log('Shortcut統計:', APP_STATE.components.settingsManager.getShortcutInfo());
            }
        }
        
        console.groupEnd();
    };
    
    // エラー情報表示関数
    window.showErrorInfo = function() {
        console.group('🚨 エラー情報');
        console.log('エラー統計:', APP_STATE.stats);
        console.log('最後のエラー:', APP_STATE.stats.lastError);
        console.groupEnd();
    };
    
    // v1.9新規：統合テスト関数
    window.testSystem = function() {
        console.group('🧪 システム統合テスト（v1.9修正版）');
        
        // 1. 基本機能テスト
        console.log('1. 基本機能テスト...');
        console.log('   - App初期化:', !!APP_STATE.components.app);
        console.log('   - ToolsSystem:', !!APP_STATE.components.toolsSystem);
        console.log('   - UIManager:', !!APP_STATE.components.uiManager);
        console.log('   - HistoryManager:', !!APP_STATE.components.historyManager);
        console.log('   - SettingsManager:', !!APP_STATE.components.settingsManager);
        
        // 2. 履歴機能テスト
        console.log('2. 履歴機能テスト...');
        if (APP_STATE.components.toolsSystem && APP_STATE.components.toolsSystem.testHistoryFunction) {
            APP_STATE.components.toolsSystem.testHistoryFunction();
        }
        
        // 3. パフォーマンス監視テスト（v1.9新規）
        console.log('3. パフォーマンス監視テスト...');
        if (APP_STATE.components.uiManager && APP_STATE.components.uiManager.getPerformanceStats) {
            const perfStats = APP_STATE.components.uiManager.getPerformanceStats();
            console.log('   - FPS:', perfStats.fps || 'N/A');
            console.log('   - メモリ:', perfStats.memoryUsage || 'N/A');
        }
        
        // 4. ショートカットシステムテスト（v1.9新規）
        console.log('4. ショートカットシステムテスト...');
        if (APP_STATE.components.settingsManager && APP_STATE.components.settingsManager.getShortcutInfo) {
            const shortcutInfo = APP_STATE.components.settingsManager.getShortcutInfo();
            console.log('   - ショートカット有効:', shortcutInfo.enabled);
            console.log('   - マネージャー状態:', shortcutInfo.manager?.isEnabled || false);
        }
        
        console.log('✅ システム統合テスト完了');
        console.groupEnd();
    };
    
    console.log('🐛 デバッグ機能設定完了（v1.9修正版）');
    console.log('📝 利用可能なデバッグ関数:');
    console.log('  - window.debugApp() - アプリ全体の状態表示（パフォーマンス統計含む）');
    console.log('  - window.showErrorInfo() - エラー情報表示');
    console.log('  - window.testSystem() - システム統合テスト（v1.9新規）');
}

// ==== 初期化ステップ更新関数 ====
function updateInitStep(step, details = null) {
    APP_STATE.initializationStep = step;
    
    const stepMessages = {
        [INIT_STEPS.CHECKING_DEPENDENCIES]: '依存関係チェック中（v1.9責務分離版）...',
        [INIT_STEPS.CREATING_APP]: 'アプリケーション作成中...',
        [INIT_STEPS.CREATING_TOOLS_SYSTEM]: 'ツールシステム作成中（責務分離版）...',
        [INIT_STEPS.CREATING_UI_MANAGER]: 'UI管理システム作成中（パフォーマンス統合版）...',
        [INIT_STEPS.CREATING_SETTINGS_MANAGER]: '設定管理システム作成中（ショートカット統合版）...',
        [INIT_STEPS.CONNECTING_SYSTEMS]: 'システム連携設定中...',
        [INIT_STEPS.FINAL_SETUP]: '最終セットアップ中...',
        [INIT_STEPS.COMPLETED]: '初期化完了！',
        [INIT_STEPS.ERROR]: '初期化エラー'
    };
    
    console.log(`📋 ${stepMessages[step] || step}`, details || '');
}

// ==== メイン初期化関数 ====
async function initializeApplication() {
    try {
        APP_STATE.startTime = performance.now();
        console.log('🚀 ふたば☆ちゃんねる風ベクターお絵描きツール v1.9 初期化開始（修正版・責務分離対応）');
        
        // 1. 依存関係チェック
        updateInitStep(INIT_STEPS.CHECKING_DEPENDENCIES);
        checkDependencies();
        
        // 2. アプリケーション作成
        updateInitStep(INIT_STEPS.CREATING_APP);
        const app = await createApplication();
        
        // 3. ツールシステム作成
        updateInitStep(INIT_STEPS.CREATING_TOOLS_SYSTEM);
        const toolsSystem = await createToolsSystem(app);
        
        // 4. UI管理システム作成
        updateInitStep(INIT_STEPS.CREATING_UI_MANAGER);
        const uiManager = await createUIManager(app, toolsSystem);
        
        // 5. 設定管理システム作成
        updateInitStep(INIT_STEPS.CREATING_SETTINGS_MANAGER);
        const settingsManager = await createSettingsManager(app, toolsSystem, uiManager);
        
        // 6. システム間連携設定
        updateInitStep(INIT_STEPS.CONNECTING_SYSTEMS);
        await connectSystems();
        
        // 7. 最終セットアップ
        updateInitStep(INIT_STEPS.FINAL_SETUP);
        await finalSetup();
        
        // 8. 初期化完了
        updateInitStep(INIT_STEPS.COMPLETED);
        APP_STATE.initialized = true;
        APP_STATE.stats.initTime = performance.now() - APP_STATE.startTime;
        
        // 初期化完了ログ
        console.log('🎉 アプリケーション初期化完了（v1.9修正版・責務分離対応）！');
        console.log(`⏱️ 初期化時間: ${APP_STATE.stats.initTime.toFixed(2)}ms`);
        console.log('🎨 描画の準備ができました！');
        
        // システム概要表示（v1.9修正版）
        console.group('📋 システム概要（v1.9修正版・Rulebook準拠）');
        console.log('🖼️  キャンバス: 400×400px');
        console.log('🖊️  ペンツール: 線補正・筆圧対応');
        console.log('🧽 消しゴム: 背景色描画方式');
        console.log('🏛️  履歴管理: Ctrl+Z/Ctrl+Y 対応');
        console.log('⚙️  設定管理: 高DPI・ショートカット統合');
        console.log('⌨️  ショートカット: P+キー組み合わせ対応');
        console.log('📊 パフォーマンス監視: UI統合版');
        console.log('🎯 プリセット: 6段階サイズ・ライブプレビュー');
        console.log('🔧 責務分離: Rulebook準拠7ファイル構成');
        console.groupEnd();
        
        // UI通知
        if (uiManager && uiManager.showNotification) {
            uiManager.showNotification(
                'アプリケーション初期化完了！',
                'success',
                3000
            );
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
        
        console.error('💥 アプリケーション初期化失敗:', {
            step: error.step,
            message: error.message,
            originalError: error.originalError,
            stack: error.stack
        });
        
        // エラー表示（可能であれば）
        showInitializationError(error);
        
        return false;
    }
}

// ==== 初期化エラー表示 ====
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
    
    errorContainer.innerHTML = `
        <div style="font-size: 48px; margin-bottom: 20px;">⚠️</div>
        <h2 style="margin: 0 0 15px 0; font-size: 24px;">アプリケーション起動エラー</h2>
        <p style="margin: 0 0 15px 0; font-size: 16px; opacity: 0.9;">
            ${error.message}
        </p>
        <p style="margin: 0 0 20px 0; font-size: 14px; opacity: 0.7;">
            エラーステップ: ${error.step}
        </p>
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
            v1.9修正版・責務分離対応
        </div>
    `;
    
    // ホバー効果
    const button = errorContainer.querySelector('button');
    button.addEventListener('mouseenter', () => {
        button.style.background = 'rgba(255, 255, 255, 0.3)';
    });
    button.addEventListener('mouseleave', () => {
        button.style.background = 'rgba(255, 255, 255, 0.2)';
    });
    
    document.body.appendChild(errorContainer);
}

// ==== 初期化状況監視 ====
function watchInitialization() {
    const maxWaitTime = 15000; // 15秒
    const startTime = Date.now();
    
    const checkInterval = setInterval(() => {
        const elapsedTime = Date.now() - startTime;
        
        if (APP_STATE.initialized) {
            clearInterval(checkInterval);
            return;
        }
        
        if (elapsedTime > maxWaitTime) {
            clearInterval(checkInterval);
            console.warn('⏰ 初期化タイムアウト - 初期化が完了しませんでした');
            
            const timeoutError = new InitializationError(
                '初期化がタイムアウトしました。ページを再読み込みしてください。',
                APP_STATE.initializationStep || 'timeout'
            );
            
            showInitializationError(timeoutError);
        }
        
        // 進行状況をログ出力（デバッグ用）
        if (elapsedTime % 5000 === 0) { // 5秒ごと
            console.log(`⏳ 初期化進行中... ステップ: ${APP_STATE.initializationStep}, 経過時間: ${elapsedTime}ms`);
        }
    }, 1000);
}

// ==== DOM読み込み完了後の初期化実行 ====
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        console.log('📄 DOM読み込み完了');
        watchInitialization();
        initializeApplication();
    });
} else {
    console.log('📄 DOM既に読み込み済み');
    watchInitialization();
    initializeApplication();
}

// ==== グローバル状態エクスポート（デバッグ用）====
if (typeof window !== 'undefined') {
    window.APP_STATE = APP_STATE;
    window.INIT_STEPS = INIT_STEPS;
    window.initializeApplication = initializeApplication; // 手動再初期化用
    
    console.log('🔧 main.js v1.9修正版 読み込み完了（責務分離対応）');
    console.log('🔧 修正項目:');
    console.log('  ✅ 依存関係チェック修正（削除されたクラスの除外）');
    console.log('  ✅ ShortcutManager: settings-manager.js内で確認');
    console.log('  ✅ PerformanceMonitor: ui-manager.js内で確認');
    console.log('  ✅ LayerSystem削除（将来のlayer-manager.js予定）');
    console.log('  ✅ StateCapture/StateRestore: 正しい外部参照確認');
    console.log('  ✅ エラーハンドリング最適化');
    console.log('🏗️ Rulebook準拠7ファイル構成:');
    console.log('  1. app-core.js（PixiJS基盤）');
    console.log('  2. settings-manager.js（設定・ショートカット統合）');
    console.log('  3. history-manager.js（履歴システム）');
    console.log('  4. drawing-tools.js（描画ツール・責務分離版）');
    console.log('  5. ui/components.js（UIコンポーネント）');
    console.log('  6. ui-manager.js（UI統合・パフォーマンス監視統合）');
    console.log('  7. main.js（システム統合・循環参照解決）');
}