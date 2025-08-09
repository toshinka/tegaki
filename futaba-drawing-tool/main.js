/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1.6
 * メイン初期化スクリプト - main.js
 * 
 * 責務: アプリケーション統合初期化・エラーハンドリング・循環参照解決
 * 依存: 全システムファイル
 * 
 * v1.6修正内容:
 * 1. 循環参照問題の根本解決
 * 2. 初期化順序の最適化
 * 3. エラー回復機能の追加
 * 4. デバッグ機能の強化
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

// ==== 依存関係チェック ====
function checkDependencies() {
    console.log('🔍 依存関係チェック開始...');
    
    const requiredClasses = {
        // PIXI.js
        'PIXI': typeof PIXI !== 'undefined',
        
        // Core classes
        'PixiDrawingApp': typeof PixiDrawingApp !== 'undefined',
        'DrawingToolsSystem': typeof DrawingToolsSystem !== 'undefined',
        'HistoryManager': typeof HistoryManager !== 'undefined',
        'SettingsManager': typeof SettingsManager !== 'undefined',
        'UIManager': typeof UIManager !== 'undefined',
        
        // UI Component classes
        'SliderController': typeof SliderController !== 'undefined',
        'PopupManager': typeof PopupManager !== 'undefined',
        'StatusBarManager': typeof StatusBarManager !== 'undefined',
        
        // History classes
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
        throw new InitializationError(
            `必要なクラスが見つかりません: ${missing.join(', ')}`,
            INIT_STEPS.CHECKING_DEPENDENCIES
        );
    }
    
    console.log('✅ 依存関係チェック完了');
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
    console.log('🔧 DrawingToolsSystem作成中...');
    
    try {
        const toolsSystem = new DrawingToolsSystem(app);
        await toolsSystem.init();
        
        APP_STATE.components.toolsSystem = toolsSystem;
        console.log('✅ DrawingToolsSystem作成完了');
        
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
    console.log('🎭 UIManager作成中...');
    
    try {
        const uiManager = new UIManager(app, toolsSystem);
        await uiManager.init();
        
        APP_STATE.components.uiManager = uiManager;
        console.log('✅ UIManager作成完了');
        
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
    console.log('⚙️ SettingsManager作成中...');
    
    try {
        // 履歴管理システムは toolsSystem から取得
        const historyManager = toolsSystem.getHistoryManager();
        
        const settingsManager = new SettingsManager(
            app, 
            toolsSystem, 
            uiManager, 
            historyManager
        );
        
        await settingsManager.init();
        
        APP_STATE.components.settingsManager = settingsManager;
        console.log('✅ SettingsManager作成完了');
        
        return settingsManager;
    } catch (error) {
        throw new InitializationError(
            'SettingsManager作成に失敗',
            INIT_STEPS.CREATING_SETTINGS_MANAGER,
            error
        );
    }
}

// ==== システム間連携設定 ====
async function connectSystems() {
    console.log('🔗 システム間連携設定中...');
    
    try {
        const { app, toolsSystem, uiManager, settingsManager } = APP_STATE.components;
        const historyManager = toolsSystem.getHistoryManager();
        
        // 1. AppCore に SettingsManager を設定
        if (app.setSettingsManager) {
            app.setSettingsManager(settingsManager);
        }
        
        // 2. UIManager に履歴管理と設定管理を設定
        if (uiManager.setHistoryManager) {
            uiManager.setHistoryManager(historyManager);
        }
        if (uiManager.setSettingsManager) {
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
        
        console.log('✅ システム間連携設定完了');
        
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
    console.log('🎨 最終セットアップ中...');
    
    try {
        const { app, toolsSystem, uiManager, settingsManager } = APP_STATE.components;
        
        // 1. 初期表示更新
        if (uiManager.updateAllDisplays) {
            uiManager.updateAllDisplays();
        }
        
        // 2. アプリケーションエラーハンドラー設定
        setupGlobalErrorHandlers();
        
        // 3. デバッグ機能設定
        setupDebugFunctions();
        
        // 4. パフォーマンス監視開始の確認
        const performanceStats = toolsSystem.getPerformanceStats();
        console.log('📊 パフォーマンス監視状態:', {
            fps: performanceStats.fps || 'N/A',
            memoryUsage: performanceStats.memoryUsage || 'N/A'
        });
        
        // 5. アプリケーション状態の最終確認
        const appStats = app.getStats();
        const systemStats = toolsSystem.getSystemStats();
        const uiStats = uiManager.getUIStats();
        
        console.log('📈 システム状態確認:');
        console.log('  - App:', appStats);
        console.log('  - Tools:', systemStats);
        console.log('  - UI:', uiStats);
        
        console.log('✅ 最終セットアップ完了');
        
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
        console.group('🔍 アプリケーションデバッグ情報');
        console.log('状態:', APP_STATE);
        
        if (APP_STATE.components.app) {
            console.log('App統計:', APP_STATE.components.app.getStats());
        }
        
        if (APP_STATE.components.toolsSystem) {
            console.log('Tools統計:', APP_STATE.components.toolsSystem.getSystemStats());
        }
        
        if (APP_STATE.components.uiManager) {
            console.log('UI統計:', APP_STATE.components.uiManager.getUIStats());
        }
        
        if (APP_STATE.components.settingsManager) {
            console.log('Settings統計:', APP_STATE.components.settingsManager.getSettingsInfo());
        }
        
        console.groupEnd();
    };
    
    // 履歴デバッグ関数
    window.debugHistory = function() {
        if (APP_STATE.components.toolsSystem) {
            APP_STATE.components.toolsSystem.debugHistory();
        } else {
            console.warn('ToolsSystemが利用できません');
        }
    };
    
    // システムテスト関数
    window.testSystem = function() {
        if (APP_STATE.components.toolsSystem) {
            APP_STATE.components.toolsSystem.testHistoryFunction();
        } else {
            console.warn('ToolsSystemが利用できません');
        }
    };
    
    // エラー情報表示関数
    window.showErrorInfo = function() {
        console.group('🚨 エラー情報');
        console.log('エラー統計:', APP_STATE.stats);
        console.log('最後のエラー:', APP_STATE.stats.lastError);
        console.groupEnd();
    };
    
    console.log('🐛 デバッグ機能設定完了');
    console.log('📝 利用可能なデバッグ関数:');
    console.log('  - window.debugApp() - アプリ全体の状態表示');
    console.log('  - window.debugHistory() - 履歴システムの詳細');
    console.log('  - window.testSystem() - システムテスト実行');
    console.log('  - window.showErrorInfo() - エラー情報表示');
}

// ==== 初期化ステップ更新関数 ====
function updateInitStep(step, details = null) {
    APP_STATE.initializationStep = step;
    
    const stepMessages = {
        [INIT_STEPS.CHECKING_DEPENDENCIES]: '依存関係チェック中...',
        [INIT_STEPS.CREATING_APP]: 'アプリケーション作成中...',
        [INIT_STEPS.CREATING_TOOLS_SYSTEM]: 'ツールシステム作成中...',
        [INIT_STEPS.CREATING_UI_MANAGER]: 'UI管理システム作成中...',
        [INIT_STEPS.CREATING_SETTINGS_MANAGER]: '設定管理システム作成中...',
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
        console.log('🚀 ふたば☆ちゃんねる風ベクターお絵描きツール v1.6 初期化開始');
        
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
        console.log('🎉 アプリケーション初期化完了！');
        console.log(`⏱️ 初期化時間: ${APP_STATE.stats.initTime.toFixed(2)}ms`);
        console.log('🎨 描画の準備ができました！');
        
        // システム概要表示
        console.group('📋 システム概要');
        console.log('🖼️  キャンバス: 400×400px');
        console.log('🖊️  ペンツール: 線補正・筆圧対応');
        console.log('🧽 消しゴム: 背景色描画方式');
        console.log('🏛️  履歴管理: Ctrl+Z/Ctrl+Y 対応');
        console.log('⚙️  設定管理: 高DPI・ショートカット対応');
        console.log('🎯 プリセット: 6段階サイズ・ライブプレビュー');
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
            詳細なエラー情報はブラウザのコンソール（F12）をご確認ください。
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
}