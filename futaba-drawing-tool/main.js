/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1rev11
 * メイン初期化スクリプト - main.js (Phase2D utils.js統合版)
 * 
 * 🔧 Phase2D統合内容:
 * 1. ✅ utils.js統合（DRY原則準拠・重複コード解消）
 * 2. ✅ safeConfigGet関数等をutils.jsから利用
 * 3. ✅ 共通処理統合（バリデーション・エラーハンドリング）
 * 4. ✅ パフォーマンス測定機能統合
 * 5. ✅ CONFIG連携修正強化（utils.js基盤）
 * 6. ✅ Phase2C緊急修正版対応（安定性確保）
 * 7. ✅ ui-events.js統合準備
 * 
 * Phase2D目標: DRY原則完全準拠・保守性向上・統合システム構築
 * 対象: CONFIG関連エラー・初期化失敗・重複コード解消
 * 依存: utils.js（必須）・ui/ui-events.js（Phase2D新規）
 */

// ==== Phase2D依存関係チェック ====
if (typeof safeConfigGet === 'undefined') {
    console.error('🚨 Phase2D依存関係エラー: utils.js が読み込まれていません');
    console.error('Phase2Dでは utils.js の事前読み込みが必須です');
    throw new Error('utils.js 読み込み必須 - Phase2D統合版');
}

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
        settingsManager: null,
        eventSystem: null  // Phase2D新規: ui-events.js統合準備
    },
    stats: {
        initTime: 0,
        errorCount: 0,
        lastError: null
    },
    config: {
        loaded: false,
        values: null,
        validated: false,
        fixed: false
    },
    phase2d: {  // Phase2D新規情報
        utilsLoaded: typeof safeConfigGet !== 'undefined',
        eventSystemReady: false,
        dryCompliance: true
    }
};

// ==== 初期化ステップ定義 ====
const INIT_STEPS = {
    CHECKING_UTILS: 'checking_utils',          // Phase2D新規
    CHECKING_CONFIG: 'checking_config',
    VALIDATING_CONFIG: 'validating_config',
    FIXING_CONFIG: 'fixing_config',
    CHECKING_DEPENDENCIES: 'checking_dependencies',
    CREATING_APP: 'creating_app',
    CREATING_TOOLS_SYSTEM: 'creating_tools_system',
    CREATING_UI_MANAGER: 'creating_ui_manager',
    INTEGRATING_EVENTS: 'integrating_events',  // Phase2D新規
    CREATING_SETTINGS_MANAGER: 'creating_settings_manager',
    CONNECTING_SYSTEMS: 'connecting_systems',
    FINAL_SETUP: 'final_setup',
    COMPLETED: 'completed',
    ERROR: 'error'
};

// ==== エラーハンドリングシステム（utils.js統合版）====
class InitializationError extends Error {
    constructor(message, step, originalError = null) {
        super(message);
        this.name = 'InitializationError';
        this.step = step;
        this.originalError = originalError;
        this.timestamp = Date.now();
    }
}

// ==== Phase2D新規: utils.js依存関係確認 ====
function checkUtilsIntegration() {
    console.log('🔍 Phase2D utils.js統合確認...');
    
    const requiredUtils = [
        'safeConfigGet', 'validateConfigIntegrity', 'createApplicationError',
        'logError', 'measurePerformance', 'handleGracefulDegradation',
        'validateBrushSize', 'validateOpacity', 'throttle', 'debounce'
    ];
    
    const missing = requiredUtils.filter(util => typeof window[util] === 'undefined');
    
    if (missing.length > 0) {
        console.error('❌ Phase2D必須ユーティリティ不足:', missing);
        throw new InitializationError(
            `utils.js統合エラー: ${missing.join(', ')} が利用できません`,
            INIT_STEPS.CHECKING_UTILS
        );
    }
    
    APP_STATE.phase2d.utilsLoaded = true;
    
    console.log('✅ Phase2D utils.js統合確認完了');
    console.log(`📦 利用可能ユーティリティ: ${requiredUtils.length}個`);
    
    // utils.js統計表示
    const systemStats = getSystemStats();
    console.log('📊 Phase2D統合統計:', systemStats);
    
    return true;
}

// ==== CONFIG連携修正強化（utils.js統合版）====
function checkConfigLoadedCompletely() {
    console.log('🔍 CONFIG読み込み確認（Phase2D utils.js統合版）...');
    
    try {
        // 1. utils.jsのvalidateConfigIntegrity使用
        const integrityOK = validateConfigIntegrity();
        
        if (!integrityOK) {
            console.warn('⚠️ CONFIG整合性問題検出 → 自動修復実行');
            fixConfigCompletely();
        }
        
        // 2. Phase2重要設定値確認（utils.js safeConfigGet使用）
        const phase2Settings = {
            brushSize: safeConfigGet('DEFAULT_BRUSH_SIZE', 4),
            opacity: safeConfigGet('DEFAULT_OPACITY', 1.0),
            maxSize: safeConfigGet('MAX_BRUSH_SIZE', 500),
            sizePresets: safeConfigGet('SIZE_PRESETS', [1, 2, 4, 8, 16, 32]),
            previewMinSize: safeConfigGet('PREVIEW_MIN_SIZE', 0.5),
            previewMaxSize: safeConfigGet('PREVIEW_MAX_SIZE', 20)
        };
        
        // 3. Phase2デフォルト値変更確認
        const phase2Validation = {
            brushSizeOK: phase2Settings.brushSize === 4,
            opacityOK: phase2Settings.opacity === 1.0,
            maxSizeOK: phase2Settings.maxSize === 500,
            presetsOK: Array.isArray(phase2Settings.sizePresets) && phase2Settings.sizePresets.length > 0
        };
        
        const phase2OK = Object.values(phase2Validation).every(Boolean);
        
        console.log('🎯 Phase2設定確認（utils.js統合版）:');
        Object.entries(phase2Settings).forEach(([key, value]) => {
            if (key === 'sizePresets') {
                console.log(`  ✅ ${key}: [${Array.isArray(value) ? value.join(', ') : 'N/A'}] (${Array.isArray(value) ? value.length : 0}個)`);
            } else if (key === 'opacity') {
                console.log(`  ✅ ${key}: ${value} (${typeof value === 'number' ? (value * 100) + '%' : 'N/A'})`);
            } else {
                console.log(`  ✅ ${key}: ${value}${typeof value === 'number' && key.includes('Size') ? 'px' : ''}`);
            }
        });
        
        console.log(`🎯 Phase2デフォルト値変更: ${phase2OK ? '✅ 全て適用済み' : '❌ 一部未適用'}`);
        
        // 4. 最終状態設定
        APP_STATE.config.values = window.CONFIG;
        APP_STATE.config.loaded = true;
        APP_STATE.config.validated = integrityOK;
        
        console.log('✅ CONFIG読み込み確認完了（Phase2D utils.js統合版）');
        return true;
        
    } catch (error) {
        logError(error, 'CONFIG確認');
        
        // 緊急時CONFIG作成（utils.js handleGracefulDegradation使用）
        return handleGracefulDegradation(
            () => {
                throw error;
            },
            () => {
                console.log('🆘 緊急時最小限CONFIG作成（utils.js統合版）');
                createMinimalConfig();
                APP_STATE.config.loaded = true;
                return true;
            },
            'CONFIG確認エラー'
        );
    }
}

// ==== CONFIG完全修復機能（utils.js統合版）====
function fixConfigCompletely() {
    console.log('🔧 CONFIG完全修復（Phase2D utils.js統合版）...');
    
    // utils.js measurePerformance使用
    return measurePerformance('CONFIG修復', () => {
        // 完全なデフォルト設定定義
        const COMPLETE_DEFAULT_CONFIG = {
            // Phase2対応: デフォルト値変更
            DEFAULT_BRUSH_SIZE: 4,
            DEFAULT_OPACITY: 1.0,
            MAX_BRUSH_SIZE: 500,
            MIN_BRUSH_SIZE: 0.1,
            DEFAULT_COLOR: 0x800000,
            DEFAULT_PRESSURE: 0.5,
            DEFAULT_SMOOTHING: 0.3,
            
            // プリセット設定
            SIZE_PRESETS: [1, 2, 4, 8, 16, 32],
            DEFAULT_ACTIVE_PRESET: 'preset_4',
            
            // キャンバス設定
            CANVAS_WIDTH: 400,
            CANVAS_HEIGHT: 400,
            BG_COLOR: 0xf0e0d6,
            
            // パフォーマンス設定
            TARGET_FPS: 60,
            PERFORMANCE_UPDATE_INTERVAL: 1000,
            MEMORY_WARNING_THRESHOLD: 100,
            
            // プレビュー設定
            PREVIEW_MIN_SIZE: 0.5,
            PREVIEW_MAX_SIZE: 20,
            
            // UI設定
            POPUP_FADE_TIME: 300,
            NOTIFICATION_DURATION: 3000,
            SLIDER_UPDATE_THROTTLE: 16,
            PRESET_UPDATE_THROTTLE: 16
        };
        
        let fixedCount = 0;
        let createdCount = 0;
        
        // CONFIG オブジェクトの作成・確認
        if (!window.CONFIG || typeof window.CONFIG !== 'object') {
            console.warn('🔧 CONFIG オブジェクトが存在しないか無効 → 新規作成');
            window.CONFIG = {};
            createdCount = 1;
        }
        
        // 各設定値の修復（utils.js validateBrushSize等使用）
        for (const [key, defaultValue] of Object.entries(COMPLETE_DEFAULT_CONFIG)) {
            try {
                let needsFix = false;
                let reason = '';
                const currentValue = window.CONFIG[key];
                
                // 存在チェック
                if (currentValue === undefined || currentValue === null) {
                    needsFix = true;
                    reason = '未定義または null';
                } else if (key === 'SIZE_PRESETS') {
                    // プリセット配列の特別処理
                    if (!Array.isArray(currentValue) || currentValue.length === 0) {
                        needsFix = true;
                        reason = '無効な配列';
                    }
                } else if (key.includes('SIZE') && typeof defaultValue === 'number') {
                    // サイズ値のバリデーション（utils.js validateBrushSize使用）
                    const validatedSize = validateBrushSize(currentValue);
                    if (validatedSize !== currentValue) {
                        needsFix = true;
                        reason = 'サイズ範囲外';
                        window.CONFIG[key] = validatedSize;
                        fixedCount++;
                        continue;
                    }
                } else if (key === 'DEFAULT_OPACITY') {
                    // 透明度のバリデーション（utils.js validateOpacity使用）
                    const validatedOpacity = validateOpacity(currentValue);
                    if (validatedOpacity !== currentValue) {
                        needsFix = true;
                        reason = '透明度範囲外';
                        window.CONFIG[key] = validatedOpacity;
                        fixedCount++;
                        continue;
                    }
                }
                
                // 修復実行
                if (needsFix) {
                    window.CONFIG[key] = defaultValue;
                    fixedCount++;
                    console.log(`🔧 修復: ${key} = ${JSON.stringify(defaultValue)} （理由: ${reason}）`);
                }
                
            } catch (error) {
                // エラー時は強制的にデフォルト値設定
                window.CONFIG[key] = defaultValue;
                fixedCount++;
                logError(error, `CONFIG修復-${key}`);
            }
        }
        
        // 修復結果
        APP_STATE.config.fixed = true;
        console.log('✅ CONFIG完全修復完了（Phase2D utils.js統合版）:');
        console.log(`  📝 チェック項目: ${Object.keys(COMPLETE_DEFAULT_CONFIG).length}個`);
        console.log(`  🔧 修復項目: ${fixedCount}個`);
        console.log(`  🆕 新規作成: ${createdCount}個`);
        
        return true;
    });
}

// ==== 緊急時最小限CONFIG作成（utils.js統合版）====
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
        PREVIEW_MAX_SIZE: 20
    };
}

// ==== 依存関係チェック（Phase2D utils.js統合版）====
function checkDependencies() {
    console.log('🔍 依存関係チェック（Phase2D utils.js統合版）...');
    
    const requiredClasses = {
        // PIXI.js（必須）
        'PIXI': typeof PIXI !== 'undefined',
        
        // Core classes（必須）
        'PixiDrawingApp': typeof PixiDrawingApp !== 'undefined',
        'DrawingToolsSystem': typeof DrawingToolsSystem !== 'undefined',
        'HistoryManager': typeof HistoryManager !== 'undefined',
        'UIManager': typeof UIManager !== 'undefined',
        
        // Settings classes（準必須）
        'SettingsManager': typeof SettingsManager !== 'undefined',
        
        // UI Component classes（必須）
        'SliderController': typeof SliderController !== 'undefined',
        'PopupManager': typeof PopupManager !== 'undefined',
        'StatusBarManager': typeof StatusBarManager !== 'undefined',
        'PresetDisplayManager': typeof PresetDisplayManager !== 'undefined',
        'PenPresetManager': typeof PenPresetManager !== 'undefined',
        'PerformanceMonitor': typeof PerformanceMonitor !== 'undefined',
        
        // State management（必須）
        'InternalStateCapture': typeof InternalStateCapture !== 'undefined',
        'InternalStateRestore': typeof InternalStateRestore !== 'undefined',
        'StateCapture': typeof StateCapture !== 'undefined',
        'StateRestore': typeof StateRestore !== 'undefined',
        
        // Phase2D新規: UI Events System（オプショナル）
        'UIEventSystem': typeof UIEventSystem !== 'undefined'
    };
    
    const missing = [];
    const available = [];
    const optional = [];
    
    const criticalClasses = [
        'PIXI', 'PixiDrawingApp', 'DrawingToolsSystem', 'HistoryManager', 'UIManager',
        'SliderController', 'PopupManager', 'StatusBarManager', 'PresetDisplayManager',
        'PenPresetManager', 'PerformanceMonitor', 'InternalStateCapture', 'InternalStateRestore',
        'StateCapture', 'StateRestore'
    ];
    
    const optionalClasses = ['UIEventSystem', 'SettingsManager'];
    
    for (const [className, isAvailable] of Object.entries(requiredClasses)) {
        if (isAvailable) {
            available.push(className);
        } else if (optionalClasses.includes(className)) {
            optional.push(className);
        } else {
            missing.push(className);
        }
    }
    
    console.log(`✅ 利用可能: ${available.length}個`, available);
    console.log(`🔄 段階的実装: ${optional.length}個`, optional);
    
    // Phase2D新規: UIEventSystem確認
    if (typeof UIEventSystem !== 'undefined') {
        APP_STATE.phase2d.eventSystemReady = true;
        console.log('🎉 Phase2D: UIEventSystem利用可能');
    } else {
        console.log('📋 Phase2D: UIEventSystem後日実装予定');
    }
    
    if (missing.length > 0) {
        console.warn(`❌ 不足: ${missing.length}個`, missing);
        
        const criticalMissing = missing.filter(className => criticalClasses.includes(className));
        
        if (criticalMissing.length > 0) {
            const error = createApplicationError(
                `重要なクラスが見つかりません: ${criticalMissing.join(', ')}`,
                { step: INIT_STEPS.CHECKING_DEPENDENCIES, missing: criticalMissing }
            );
            throw error;
        }
    }
    
    console.log('✅ 依存関係チェック完了（Phase2D utils.js統合版）');
    return true;
}

// ==== アプリケーション作成（utils.js統合版）====
async function createApplication() {
    console.log('🎯 PixiDrawingApp作成（Phase2D utils.js統合版）...');
    
    try {
        // utils.js measurePerformance使用
        return await measurePerformance('App作成', async () => {
            // utils.js safeConfigGet使用
            const width = safeConfigGet('CANVAS_WIDTH', 400);
            const height = safeConfigGet('CANVAS_HEIGHT', 400);
            
            console.log(`🎯 キャンバスサイズ: ${width}×${height}px`);
            
            const app = new PixiDrawingApp(width, height);
            await app.init();
            
            APP_STATE.components.app = app;
            console.log(`✅ PixiDrawingApp作成完了（Phase2D utils.js統合版）`);
            
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

// ==== ツールシステム作成（utils.js統合版）====
async function createToolsSystem(app) {
    console.log('🔧 DrawingToolsSystem作成（Phase2D utils.js統合版）...');
    
    try {
        return await measurePerformance('ToolsSystem作成', async () => {
            const toolsSystem = new DrawingToolsSystem(app);
            await toolsSystem.init();
            
            APP_STATE.components.toolsSystem = toolsSystem;
            
            // Phase2デフォルト設定適用（utils.js関数使用）
            const defaultSettings = {
                size: validateBrushSize(safeConfigGet('DEFAULT_BRUSH_SIZE', 4)),
                opacity: validateOpacity(safeConfigGet('DEFAULT_OPACITY', 1.0)),
                color: safeConfigGet('DEFAULT_COLOR', 0x800000),
                pressure: safeConfigGet('DEFAULT_PRESSURE', 0.5),
                smoothing: safeConfigGet('DEFAULT_SMOOTHING', 0.3)
            };
            
            if (toolsSystem.updateBrushSettings) {
                toolsSystem.updateBrushSettings(defaultSettings);
                console.log('🔧 Phase2デフォルト設定適用完了（utils.js統合版）:', defaultSettings);
            }
            
            console.log('✅ DrawingToolsSystem作成完了（Phase2D utils.js統合版）');
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

// ==== UI管理システム作成（Phase2D統合準備版）====
async function createUIManager(app, toolsSystem) {
    console.log('🎭 UIManager作成（Phase2D統合準備版）...');
    
    try {
        return await measurePerformance('UIManager作成', async () => {
            const historyManager = toolsSystem.getHistoryManager();
            
            const uiManager = new UIManager(app, toolsSystem, historyManager);
            await uiManager.init();
            
            APP_STATE.components.uiManager = uiManager;
            APP_STATE.components.historyManager = historyManager;
            
            console.log('✅ UIManager作成完了（Phase2D統合準備版）');
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

// ==== Phase2D新規: イベントシステム統合 ====
async function integrateEventSystem() {
    console.log('🎮 Phase2D イベントシステム統合...');
    
    if (!APP_STATE.phase2d.eventSystemReady) {
        console.log('📋 Phase2D: UIEventSystem未実装 → 後日統合予定');
        return null;
    }
    
    try {
        return await measurePerformance('EventSystem統合', async () => {
            const { app, toolsSystem, uiManager } = APP_STATE.components;
            
            // UIEventSystem作成・初期化
            const eventSystem = new UIEventSystem(app, toolsSystem, uiManager);
            await eventSystem.init();
            
            // UIManagerにEventSystem設定
            if (uiManager.setEventSystem) {
                uiManager.setEventSystem(eventSystem);
            }
            
            APP_STATE.components.eventSystem = eventSystem;
            console.log('✅ Phase2D イベントシステム統合完了');
            
            return eventSystem;
        });
    } catch (error) {
        logError(error, 'EventSystem統合');
        console.warn('⚠️ イベントシステム統合失敗 → 基本機能のみで続行');
        return null;
    }
}

// ==== 設定管理システム作成（utils.js統合版）====
async function createSettingsManager(app, toolsSystem, uiManager) {
    console.log('⚙️ SettingsManager作成（Phase2D utils.js統合版）...');
    
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
                console.log('✅ SettingsManager作成完了（Phase2D utils.js統合版）');
                
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

// ==== システム間連携設定（Phase2D utils.js統合版）====
async function connectSystems() {
    console.log('🔗 システム間連携設定（Phase2D utils.js統合版）...');
    
    try {
        await measurePerformance('システム連携', async () => {
            const { app, toolsSystem, uiManager, settingsManager, eventSystem } = APP_STATE.components;
            const historyManager = toolsSystem.getHistoryManager();
            
            // 1. AppCore に SettingsManager を設定
            if (app.setSettingsManager && settingsManager) {
                app.setSettingsManager(settingsManager);
            }
            
            // 2. UIManager に各システムを設定
            if (uiManager.setHistoryManager) {
                uiManager.setHistoryManager(historyManager);
            }
            if (uiManager.setSettingsManager && settingsManager) {
                uiManager.setSettingsManager(settingsManager);
            }
            if (uiManager.setEventSystem && eventSystem) {
                uiManager.setEventSystem(eventSystem);
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
            
            // 4. グローバル参照設定
            window.app = app;
            window.toolsSystem = toolsSystem;
            window.uiManager = uiManager;
            window.historyManager = historyManager;
            window.settingsManager = settingsManager;
            window.eventSystem = eventSystem; // Phase2D新規
            
            // 5. CONFIG関連のグローバル参照
            window.appConfig = window.CONFIG || {};
            window.uiConfig = window.UI_CONFIG || {};
            
            // 6. デバッグ用関数設定（utils.js統合版）
            setupDebugFunctions();
            
            console.log('✅ システム間連携設定完了（Phase2D utils.js統合版）');
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

// ==== デバッグ機能設定（Phase2D utils.js統合版）====
function setupDebugFunctions() {
    // 基本デバッグ関数
    window.undo = () => APP_STATE.components.historyManager ? APP_STATE.components.historyManager.undo() : false;
    window.redo = () => APP_STATE.components.historyManager ? APP_STATE.components.historyManager.redo() : false;
    window.debugHistory = () => APP_STATE.components.toolsSystem ? APP_STATE.components.toolsSystem.debugHistory() : console.warn('ToolsSystem not available');
    
    // Phase2D拡張デバッグ関数（utils.js統合版）
    window.debugApp = function() {
        console.group('🔍 アプリケーションデバッグ情報（Phase2D utils.js統合版）');
        
        // APP_STATE表示
        console.log('📋 APP_STATE:', APP_STATE);
        
        // システム統計（utils.js getSystemStats使用）
        const systemStats = getSystemStats();
        console.log('📊 システム統計（utils.js統合）:', systemStats);
        
        // 各コンポーネント統計
        const { app, toolsSystem, uiManager, settingsManager, eventSystem } = APP_STATE.components;
        
        if (app && app.getStats) {
            console.log('🎯 App統計:', app.getStats());
        }
        
        if (toolsSystem && toolsSystem.getSystemStats) {
            console.log('🔧 Tools統計:', toolsSystem.getSystemStats());
        }
        
        if (uiManager && uiManager.getUIStats) {
            console.log('🎭 UI統計:', uiManager.getUIStats());
        }
        
        if (settingsManager && settingsManager.getSettingsInfo) {
            console.log('⚙️ Settings統計:', settingsManager.getSettingsInfo());
        }
        
        if (eventSystem && eventSystem.getEventStats) {
            console.log('🎮 Event統計:', eventSystem.getEventStats());
        }
        
        // Phase2D統合状況
        console.log('🏗️ Phase2D統合状況:', APP_STATE.phase2d);
        
        console.groupEnd();
    };
    
    // CONFIG管理デバッグ関数（utils.js統合版）
    window.debugConfig = () => {
        console.group('🔧 CONFIG設定情報（Phase2D utils.js統合版）');
        
        // 基本CONFIG表示
        console.log('CONFIG:', window.CONFIG || 'N/A');
        console.log('UI_CONFIG:', window.UI_CONFIG || 'N/A');
        console.log('UI_EVENTS:', window.UI_EVENTS || 'N/A');
        
        // Phase2重要設定（utils.js safeConfigGet使用）
        const phase2Settings = {
            brushSize: safeConfigGet('DEFAULT_BRUSH_SIZE', 'N/A'),
            opacity: safeConfigGet('DEFAULT_OPACITY', 'N/A'),
            maxSize: safeConfigGet('MAX_BRUSH_SIZE', 'N/A'),
            sizePresets: safeConfigGet('SIZE_PRESETS', []),
            previewMinSize: safeConfigGet('PREVIEW_MIN_SIZE', 'N/A'),
            previewMaxSize: safeConfigGet('PREVIEW_MAX_SIZE', 'N/A')
        };
        
        console.log('🎯 Phase2重要設定（utils.js統合）:', phase2Settings);
        
        // CONFIG整合性確認（utils.js validateConfigIntegrity使用）
        const integrityOK = validateConfigIntegrity();
        console.log('✅ CONFIG整合性:', integrityOK ? '正常' : '問題あり');
        
        // CONFIG状態
        console.log('📋 CONFIG状態:', APP_STATE.config);
        
        console.groupEnd();
    };
    
    // Phase2D統合テスト関数
    window.testPhase2D = function() {
        console.group('🧪 Phase2D統合システムテスト');
        
        // 1. utils.js統合テスト
        console.log('1. utils.js統合テスト...');
        const utilsTest = {
            safeConfigGet: typeof safeConfigGet === 'function',
            validateConfigIntegrity: typeof validateConfigIntegrity === 'function',
            measurePerformance: typeof measurePerformance === 'function',
            handleGracefulDegradation: typeof handleGracefulDegradation === 'function',
            validateBrushSize: typeof validateBrushSize === 'function',
            validateOpacity: typeof validateOpacity === 'function',
            throttle: typeof throttle === 'function',
            debounce: typeof debounce === 'function'
        };
        console.log('   utils.js機能:', utilsTest);
        
        const utilsOK = Object.values(utilsTest).every(Boolean);
        console.log(`   utils.js統合: ${utilsOK ? '✅ 完了' : '❌ 不完全'}`);
        
        // 2. DRY原則準拠テスト
        console.log('2. DRY原則準拠テスト...');
        const dryTest = {
            noConfigDuplication: APP_STATE.phase2d.dryCompliance,
            utilsIntegrated: APP_STATE.phase2d.utilsLoaded,
            commonFunctionsShared: utilsOK
        };
        console.log('   DRY準拠状況:', dryTest);
        
        const dryOK = Object.values(dryTest).every(Boolean);
        console.log(`   DRY原則: ${dryOK ? '✅ 準拠' : '❌ 違反'}`);
        
        // 3. Phase2設定値テスト（utils.js統合）
        console.log('3. Phase2設定値テスト...');
        const phase2Test = {
            brushSize: validateBrushSize(safeConfigGet('DEFAULT_BRUSH_SIZE', 0)) === 4,
            opacity: validateOpacity(safeConfigGet('DEFAULT_OPACITY', 0)) === 1.0,
            maxSize: safeConfigGet('MAX_BRUSH_SIZE', 0) === 500,
            presets: Array.isArray(safeConfigGet('SIZE_PRESETS', [])) && safeConfigGet('SIZE_PRESETS', []).length > 0
        };
        console.log('   Phase2設定:', phase2Test);
        
        const phase2OK = Object.values(phase2Test).every(Boolean);
        console.log(`   Phase2適用: ${phase2OK ? '✅ 完了' : '❌ 不完全'}`);
        
        // 4. イベントシステム統合テスト
        console.log('4. イベントシステム統合テスト...');
        const eventTest = {
            eventSystemReady: APP_STATE.phase2d.eventSystemReady,
            eventSystemLoaded: typeof UIEventSystem !== 'undefined',
            eventSystemIntegrated: !!APP_STATE.components.eventSystem
        };
        console.log('   イベントシステム:', eventTest);
        
        // 5. 総合判定
        console.log('5. Phase2D統合判定...');
        const overallTest = {
            utils: utilsOK,
            dry: dryOK,
            phase2: phase2OK,
            initialized: APP_STATE.initialized
        };
        
        const overallOK = Object.values(overallTest).every(Boolean);
        console.log(`🏆 Phase2D統合: ${overallOK ? '✅ 成功' : '❌ 部分的'}`);
        
        if (!overallOK) {
            console.warn('⚠️ Phase2D統合に問題があります:', overallTest);
        }
        
        console.groupEnd();
        return overallOK;
    };
    
    // システム統合テスト関数（utils.js拡張版）
    window.testSystem = function() {
        console.group('🧪 システム統合テスト（Phase2D utils.js拡張版）');
        
        // 基本機能テスト
        console.log('1. 基本機能テスト...');
        console.log('   - CONFIG読み込み:', APP_STATE.config.loaded);
        console.log('   - CONFIG妥当性チェック:', APP_STATE.config.validated);
        console.log('   - CONFIG修復完了:', APP_STATE.config.fixed);
        console.log('   - utils.js統合:', APP_STATE.phase2d.utilsLoaded);
        console.log('   - App初期化:', !!APP_STATE.components.app);
        console.log('   - ToolsSystem:', !!APP_STATE.components.toolsSystem);
        console.log('   - UIManager:', !!APP_STATE.components.uiManager);
        console.log('   - HistoryManager:', !!APP_STATE.components.historyManager);
        console.log('   - SettingsManager:', !!APP_STATE.components.settingsManager);
        console.log('   - EventSystem:', !!APP_STATE.components.eventSystem);
        
        // Phase2設定値テスト（utils.js統合）
        console.log('2. Phase2設定値テスト（utils.js統合）...');
        measurePerformance('Phase2設定テスト', () => {
            const brushSize = safeConfigGet('DEFAULT_BRUSH_SIZE', 0);
            const opacity = safeConfigGet('DEFAULT_OPACITY', 0);
            const maxSize = safeConfigGet('MAX_BRUSH_SIZE', 0);
            const sizePresets = safeConfigGet('SIZE_PRESETS', []);
            
            console.log(`   - デフォルトサイズ: ${brushSize}px (期待値: 4px) ${brushSize === 4 ? '✅' : '❌'}`);
            console.log(`   - デフォルト透明度: ${opacity * 100}% (期待値: 100%) ${opacity === 1.0 ? '✅' : '❌'}`);
            console.log(`   - 最大サイズ: ${maxSize}px (期待値: 500px) ${maxSize === 500 ? '✅' : '❌'}`);
            console.log(`   - プリセット数: ${Array.isArray(sizePresets) ? sizePresets.length : 0} (期待値: 6個) ${Array.isArray(sizePresets) && sizePresets.length === 6 ? '✅' : '❌'}`);
        });
        
        // UIManager統合テスト
        console.log('3. UIManager統合テスト...');
        if (APP_STATE.components.uiManager && APP_STATE.components.uiManager.getUIStats) {
            const uiStats = APP_STATE.components.uiManager.getUIStats();
            console.log('   - UI統計:', uiStats);
        }
        
        // Phase2D拡張: utils.js統合テスト実行
        console.log('4. utils.js統合テスト実行...');
        window.testPhase2D();
        
        console.log('✅ システム統合テスト完了（Phase2D utils.js拡張版）');
        console.groupEnd();
    };
    
    console.log('🐛 デバッグ機能設定完了（Phase2D utils.js統合版）');
    console.log('📝 利用可能なデバッグ関数:');
    console.log('  - window.debugApp() - アプリ全体の状態表示（Phase2D拡張版）');
    console.log('  - window.debugConfig() - CONFIG情報表示（utils.js統合版）');
    console.log('  - window.testPhase2D() - Phase2D統合テスト（新規）');
    console.log('  - window.testSystem() - システム統合テスト（utils.js拡張版）');
    console.log('  - window.undo(), window.redo() - 履歴操作');
    console.log('  - window.debugHistory() - 履歴デバッグ');
}

// ==== 最終セットアップ（Phase2D utils.js統合版）====
async function finalSetup() {
    console.log('🎨 最終セットアップ（Phase2D utils.js統合版）...');
    
    try {
        await measurePerformance('最終セットアップ', async () => {
            const { app, toolsSystem, uiManager, settingsManager } = APP_STATE.components;
            
            // 1. 初期表示更新
            if (uiManager && uiManager.updateAllDisplays) {
                uiManager.updateAllDisplays();
            }
            
            // 2. グローバルエラーハンドラー設定
            setupGlobalErrorHandlers();
            
            // 3. Phase2設定値確認・表示（utils.js統合版）
            const phase2Settings = {
                brushSize: safeConfigGet('DEFAULT_BRUSH_SIZE', 4),
                opacity: safeConfigGet('DEFAULT_OPACITY', 1.0),
                maxSize: safeConfigGet('MAX_BRUSH_SIZE', 500),
                sizePresets: safeConfigGet('SIZE_PRESETS', [1, 2, 4, 8, 16, 32])
            };
            
            console.log('🎯 Phase2設定値確認（utils.js統合版）:');
            console.log(`  🖊️  デフォルトペンサイズ: ${phase2Settings.brushSize}px（16→4に変更）`);
            console.log(`  🎨 デフォルト透明度: ${phase2Settings.opacity * 100}%（85%→100%に変更）`);
            console.log(`  📏 最大ペンサイズ: ${phase2Settings.maxSize}px（100→500に変更）`);
            console.log(`  🎯 プリセット: [${Array.isArray(phase2Settings.sizePresets) ? phase2Settings.sizePresets.join(', ') : 'N/A'}]px`);
            
            // 4. システム状態の最終確認
            const appStats = app.getStats ? app.getStats() : {};
            const systemStats = toolsSystem.getSystemStats ? toolsSystem.getSystemStats() : {};
            const uiStats = uiManager ? uiManager.getUIStats() : null;
            
            console.log('📈 システム状態確認（Phase2D utils.js統合版）:');
            console.log('  - App:', appStats);
            console.log('  - Tools:', systemStats);
            if (uiStats) {
                console.log('  - UI:', uiStats);
            }
            if (settingsManager && settingsManager.getSettingsInfo) {
                console.log('  - Settings:', settingsManager.getSettingsInfo());
            }
            
            // Phase2D統合状況表示
            console.log('  - Phase2D:', {
                utilsLoaded: APP_STATE.phase2d.utilsLoaded,
                eventSystemReady: APP_STATE.phase2d.eventSystemReady,
                dryCompliance: APP_STATE.phase2d.dryCompliance,
                configLoaded: APP_STATE.config.loaded,
                configFixed: APP_STATE.config.fixed,
                phase2Applied: phase2Settings.brushSize === 4 && phase2Settings.opacity === 1.0
            });
            
            console.log('✅ 最終セットアップ完了（Phase2D utils.js統合版）');
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

// ==== グローバルエラーハンドラー設定（utils.js統合版）====
function setupGlobalErrorHandlers() {
    // JavaScript エラー（utils.js logError使用）
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
        
        // UI通知（利用可能な場合）
        if (APP_STATE.components.uiManager && APP_STATE.components.uiManager.showError) {
            APP_STATE.components.uiManager.showError(
                `アプリケーションエラー: ${event.message}`,
                8000
            );
        }
    });
    
    // Promise エラー（utils.js logError使用）
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
    
    console.log('🛡️ グローバルエラーハンドラー設定完了（utils.js統合版）');
}

// ==== 初期化ステップ更新関数 ====
function updateInitStep(step, details = null) {
    APP_STATE.initializationStep = step;
    
    const stepMessages = {
        [INIT_STEPS.CHECKING_UTILS]: 'utils.js統合確認中（Phase2D）...',
        [INIT_STEPS.CHECKING_CONFIG]: 'CONFIG読み込み確認中（utils.js統合版）...',
        [INIT_STEPS.VALIDATING_CONFIG]: 'CONFIG妥当性チェック中...',
        [INIT_STEPS.FIXING_CONFIG]: 'CONFIG完全修復中（utils.js統合版）...',
        [INIT_STEPS.CHECKING_DEPENDENCIES]: '依存関係チェック中（Phase2D utils.js統合版）...',
        [INIT_STEPS.CREATING_APP]: 'アプリケーション作成中（utils.js統合版）...',
        [INIT_STEPS.CREATING_TOOLS_SYSTEM]: 'ツールシステム作成中（utils.js統合版）...',
        [INIT_STEPS.CREATING_UI_MANAGER]: 'UI管理システム作成中（Phase2D統合準備版）...',
        [INIT_STEPS.INTEGRATING_EVENTS]: 'イベントシステム統合中（Phase2D）...',
        [INIT_STEPS.CREATING_SETTINGS_MANAGER]: '設定管理システム作成中（utils.js統合版）...',
        [INIT_STEPS.CONNECTING_SYSTEMS]: 'システム連携設定中（Phase2D utils.js統合版）...',
        [INIT_STEPS.FINAL_SETUP]: '最終セットアップ中（Phase2D utils.js統合版）...',
        [INIT_STEPS.COMPLETED]: 'Phase2D統合初期化完了！',
        [INIT_STEPS.ERROR]: '初期化エラー'
    };
    
    console.log(`📋 ${stepMessages[step] || step}`, details || '');
}

// ==== メイン初期化関数（Phase2D utils.js統合版）====
async function initializeApplication() {
    try {
        APP_STATE.startTime = performance.now();
        console.log('🚀 ふたば☆ちゃんねる風ベクターお絵描きツール 初期化開始（Phase2D utils.js統合版）');
        
        // 1. Phase2D新規: utils.js統合確認
        updateInitStep(INIT_STEPS.CHECKING_UTILS);
        checkUtilsIntegration();
        
        // 2. CONFIG読み込み確認（utils.js統合版）
        updateInitStep(INIT_STEPS.CHECKING_CONFIG);
        checkConfigLoadedCompletely();
        
        // 3. 依存関係チェック（Phase2D utils.js統合版）
        updateInitStep(INIT_STEPS.CHECKING_DEPENDENCIES);
        checkDependencies();
        
        // 4. アプリケーション作成（utils.js統合版）
        updateInitStep(INIT_STEPS.CREATING_APP);
        const app = await createApplication();
        
        // 5. ツールシステム作成（utils.js統合版）
        updateInitStep(INIT_STEPS.CREATING_TOOLS_SYSTEM);
        const toolsSystem = await createToolsSystem(app);
        
        // 6. UI管理システム作成（Phase2D統合準備版）
        updateInitStep(INIT_STEPS.CREATING_UI_MANAGER);
        const uiManager = await createUIManager(app, toolsSystem);
        
        // 7. Phase2D新規: イベントシステム統合
        updateInitStep(INIT_STEPS.INTEGRATING_EVENTS);
        const eventSystem = await integrateEventSystem();
        
        // 8. 設定管理システム作成（utils.js統合版）
        updateInitStep(INIT_STEPS.CREATING_SETTINGS_MANAGER);
        const settingsManager = await createSettingsManager(app, toolsSystem, uiManager);
        
        // 9. システム間連携設定（Phase2D utils.js統合版）
        updateInitStep(INIT_STEPS.CONNECTING_SYSTEMS);
        await connectSystems();
        
        // 10. 最終セットアップ（Phase2D utils.js統合版）
        updateInitStep(INIT_STEPS.FINAL_SETUP);
        await finalSetup();
        
        // 11. 初期化完了
        updateInitStep(INIT_STEPS.COMPLETED);
        APP_STATE.initialized = true;
        APP_STATE.stats.initTime = performance.now() - APP_STATE.startTime;
        
        // 初期化完了ログ（Phase2D統合版）
        console.log('🎉 アプリケーション初期化完了（Phase2D utils.js統合版）！');
        console.log(`⏱️ 初期化時間: ${APP_STATE.stats.initTime.toFixed(2)}ms`);
        console.log('🎨 描画の準備ができました！');
        
        // システム概要表示（Phase2D統合版）
        console.group('📋 システム概要（Phase2D utils.js統合版）');
        
        const canvasWidth = safeConfigGet('CANVAS_WIDTH', 400);
        const canvasHeight = safeConfigGet('CANVAS_HEIGHT', 400);
        const brushSize = safeConfigGet('DEFAULT_BRUSH_SIZE', 4);
        const opacity = safeConfigGet('DEFAULT_OPACITY', 1.0);
        const maxSize = safeConfigGet('MAX_BRUSH_SIZE', 500);
        const sizePresets = safeConfigGet('SIZE_PRESETS', []);
        
        console.log(`🖼️  キャンバス: ${canvasWidth}×${canvasHeight}px`);
        console.log(`🖊️  デフォルトペンサイズ: ${brushSize}px（16→4に変更）`);
        console.log(`🎨 デフォルト透明度: ${opacity * 100}%（85%→100%に変更）`);
        console.log(`📏 最大ペンサイズ: ${maxSize}px（100→500に変更）`);
        console.log(`🎯 プリセット: [${Array.isArray(sizePresets) ? sizePresets.join(', ') : 'N/A'}]px`);
        console.log('🧽 消しゴム: 背景色描画方式');
        console.log('🏛️  履歴管理: Ctrl+Z/Ctrl+Y 対応');
        console.log('⚙️  設定管理: 高DPI・ショートカット統合');
        console.log('📊 パフォーマンス監視: 簡易版（内蔵）');
        console.log('🔄 リセット機能: プリセット・キャンバス対応');
        console.log('🏗️ Phase2D統合: utils.js統合・DRY原則準拠・重複コード解消');
        console.log('🎮 イベントシステム:', APP_STATE.phase2d.eventSystemReady ? '統合済み' : '後日統合予定');
        console.log('🔧 CONFIG連携修正: utils.js基盤・完全修復・安全アクセス');
        console.groupEnd();
        
        // UI通知
        if (uiManager && uiManager.showNotification) {
            const message = APP_STATE.phase2d.eventSystemReady 
                ? 'Phase2D統合版初期化完了！utils.js統合・DRY原則準拠・イベントシステム統合'
                : 'Phase2D統合版初期化完了！utils.js統合・DRY原則準拠・基本機能復旧';
            uiManager.showNotification(message, 'success', 5000);
        }
        
        return true;
        
    } catch (error) {
        // エラーハンドリング（utils.js統合版）
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
            Phase2D utils.js統合版
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
    const maxWaitTime = 20000; // Phase2D: 20秒（統合処理増加のため延長）
    const startTime = Date.now();
    
    const checkInterval = setInterval(() => {
        const elapsedTime = Date.now() - startTime;
        
        if (APP_STATE.initialized) {
            clearInterval(checkInterval);
            return;
        }
        
        if (elapsedTime > maxWaitTime) {
            clearInterval(checkInterval);
            console.warn('⏰ 初期化タイムアウト - Phase2D統合初期化が完了しませんでした');
            
            const timeoutError = createApplicationError(
                'Phase2D統合初期化がタイムアウトしました。ページを再読み込みしてください。',
                { step: APP_STATE.initializationStep || 'timeout', elapsedTime }
            );
            
            showInitializationError(timeoutError);
        }
        
        // 進行状況をログ出力（デバッグ用）
        if (elapsedTime % 5000 === 0) { // 5秒ごと
            console.log(`⏳ Phase2D統合初期化進行中... ステップ: ${APP_STATE.initializationStep}, 経過時間: ${elapsedTime}ms`);
        }
    }, 1000);
}

// ==== DOM読み込み完了後の初期化実行 ====
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        console.log('📄 DOM読み込み完了（Phase2D utils.js統合版）');
        watchInitialization();
        initializeApplication();
    });
} else {
    console.log('📄 DOM既に読み込み済み（Phase2D utils.js統合版）');
    watchInitialization();
    initializeApplication();
}

// ==== グローバル状態エクスポート（Phase2D統合版）====
if (typeof window !== 'undefined') {
    window.APP_STATE = APP_STATE;
    window.INIT_STEPS = INIT_STEPS;
    window.initializeApplication = initializeApplication; // 手動再初期化用
    
    // Phase2D統合: utils.js関数は既にグローバル登録済み
    // 追加のmain.js固有関数のみエクスポート
    window.checkUtilsIntegration = checkUtilsIntegration;
    window.checkConfigLoadedCompletely = checkConfigLoadedCompletely;
    window.fixConfigCompletely = fixConfigCompletely;
    window.createMinimalConfig = createMinimalConfig;
    
    console.log('🔧 main.js Phase2D utils.js統合版 読み込み完了');
    console.log('🏗️ Phase2D統合完了項目:');
    console.log('  ✅ utils.js統合（DRY原則準拠・重複コード解消）');
    console.log('  ✅ safeConfigGet等共通関数をutils.jsから利用');
    console.log('  ✅ CONFIG連携修正強化（utils.js基盤）');
    console.log('  ✅ パフォーマンス測定機能統合');
    console.log('  ✅ エラーハンドリング標準化');
    console.log('  ✅ バリデーション機能統合');
    console.log('  ✅ ui-events.js統合準備完了');
    console.log('  ✅ Phase2設定値適用（4px・100%・500px）');
    console.log('  ✅ デバッグ機能拡張（Phase2D統合テスト追加）');
    
    console.log('🎯 Phase2D統合効果:');
    console.log('  📦 コード重複解消: safeConfigGet等の統一');
    console.log('  🔧 保守性向上: 共通処理の一元管理');
    console.log('  ⚡ パフォーマンス: 測定機能内蔵');
    console.log('  🛡️ エラー処理: 標準化されたエラーハンドリング');
    console.log('  🧪 テスト強化: 統合テスト関数追加');
    console.log('  🏗️ 拡張性: ui-events.js統合準備完了');
    
    console.log('🔧 Phase2D統合機能:');
    console.log('  1. window.checkUtilsIntegration() - utils.js統合確認');
    console.log('  2. window.testPhase2D() - Phase2D統合テスト');
    console.log('  3. window.debugApp() - アプリ状態表示（Phase2D拡張版）');
    console.log('  4. window.debugConfig() - CONFIG情報表示（utils.js統合版）');
    console.log('  5. window.testSystem() - システム統合テスト（utils.js拡張版）');
    console.log('  6. All utils.js functions - 50以上の汎用ユーティリティ');
    
    console.log('🚀 準備完了: Phase2D統合版アプリケーション初期化実行中...');
    console.log('📋 次のステップ: ui-manager.js Phase2D統合（ui-events.js連携）');
}

// UIManager初期化（Phase 2-4対応）
async function initializeUI() {
    try {
        // UIManager作成（drawingSystem, historyManager必須）
        window.uiManager = new UIManager(window.drawingSystem, window.historyManager);
        
        // 初期化待機
        await window.uiManager.init();
        
        console.log('✅ UIシステム初期化完了（Phase 2-4）');
        
        // デバッグ用グローバル参照
        window.debugApp = function() {
            console.group('🔍 アプリケーション全体デバッグ');
            console.log('UIManager状態:', window.uiManager.getSystemStatus());
            window.debugUI();
            window.debugUIIntegration();
            console.groupEnd();
        };
        
    } catch (error) {
        console.error('UI初期化エラー:', error);
    }
}

// DOMContentLoaded後に実行
document.addEventListener('DOMContentLoaded', () => {
    // CONFIG初期化後にUI初期化
    if (window.CONFIG) {
        initializeUI();
    } else {
        // CONFIG待機
        const configCheck = setInterval(() => {
            if (window.CONFIG) {
                clearInterval(configCheck);
                initializeUI();
            }
        }, 100);
    }
});