/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1rev10
 * メイン初期化スクリプト - main.js
 * 
 * 🔧 CONFIG連携修正強化内容:
 * 1. ✅ safeConfigGet関数実装（完全なundefinedアクセス回避）
 * 2. ✅ CONFIG妥当性チェック・自動修復機能強化
 * 3. ✅ SIZE_PRESETS空配列問題の根本解決
 * 4. ✅ デフォルト値フォールバック強化
 * 5. ✅ エラー時のグレースフル・デグラデーション
 * 6. ✅ 初期化順序最適化（段階的エラーハンドリング）
 * 7. ✅ Phase2C緊急修正版ui-manager.js対応
 * 
 * 修正目標: CONFIG値アクセスエラー完全解決・アプリケーション確実起動
 * 対象: CONFIG関連エラー・初期化失敗・空配列問題
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
    },
    config: {
        loaded: false,
        values: null,
        validated: false,
        fixed: false
    }
};

// ==== 初期化ステップ定義 ====
const INIT_STEPS = {
    CHECKING_CONFIG: 'checking_config',
    VALIDATING_CONFIG: 'validating_config',
    FIXING_CONFIG: 'fixing_config',
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

// ==== CONFIG連携修正強化: 完全な安全アクセス関数 ====
function safeConfigGet(key, defaultValue = null) {
    try {
        // CONFIG オブジェクトの存在確認
        if (!window.CONFIG || typeof window.CONFIG !== 'object') {
            console.warn(`safeConfigGet: CONFIG未初期化 (${key}) → デフォルト値使用:`, defaultValue);
            return defaultValue;
        }
        
        // キーの存在確認
        if (!(key in window.CONFIG)) {
            console.warn(`safeConfigGet: キー不存在 (${key}) → デフォルト値使用:`, defaultValue);
            return defaultValue;
        }
        
        const value = window.CONFIG[key];
        
        // null/undefined チェック
        if (value === null || value === undefined) {
            console.warn(`safeConfigGet: 値がnull/undefined (${key}) → デフォルト値使用:`, defaultValue);
            return defaultValue;
        }
        
        // 特別処理: SIZE_PRESETS
        if (key === 'SIZE_PRESETS') {
            if (!Array.isArray(value)) {
                console.warn(`safeConfigGet: SIZE_PRESETS が配列でない (${key}) → デフォルト値使用:`, defaultValue);
                return defaultValue || [1, 2, 4, 8, 16, 32];
            }
            
            if (value.length === 0) {
                console.warn(`safeConfigGet: SIZE_PRESETS が空配列 (${key}) → デフォルト値使用:`, defaultValue);
                return defaultValue || [1, 2, 4, 8, 16, 32];
            }
            
            // 配列要素の妥当性確認
            const validElements = value.filter(element => {
                const num = parseFloat(element);
                return !isNaN(num) && num > 0 && num <= 1000;
            });
            
            if (validElements.length === 0) {
                console.warn(`safeConfigGet: SIZE_PRESETS に有効要素なし (${key}) → デフォルト値使用:`, defaultValue);
                return defaultValue || [1, 2, 4, 8, 16, 32];
            }
            
            if (validElements.length !== value.length) {
                console.warn(`safeConfigGet: SIZE_PRESETS の一部要素が無効 → 有効要素のみ返却:`, validElements);
                return validElements;
            }
        }
        
        // 数値型の妥当性確認
        if (typeof defaultValue === 'number') {
            const numValue = parseFloat(value);
            if (isNaN(numValue)) {
                console.warn(`safeConfigGet: 数値変換失敗 (${key}: ${value}) → デフォルト値使用:`, defaultValue);
                return defaultValue;
            }
            
            // 範囲チェック
            if (key === 'DEFAULT_OPACITY' && (numValue < 0 || numValue > 1)) {
                console.warn(`safeConfigGet: DEFAULT_OPACITY 範囲外 (${numValue}) → デフォルト値使用:`, defaultValue);
                return defaultValue;
            }
            
            if (key.includes('SIZE') && numValue < 0) {
                console.warn(`safeConfigGet: サイズ値が負数 (${key}: ${numValue}) → デフォルト値使用:`, defaultValue);
                return defaultValue;
            }
        }
        
        return value;
        
    } catch (error) {
        console.error(`safeConfigGet: アクセスエラー (${key}):`, error, '→ デフォルト値使用:', defaultValue);
        return defaultValue;
    }
}

// ==== CONFIG連携修正強化: CONFIG完全修復機能 ====
function fixConfigCompletely() {
    console.log('🔧 CONFIG完全修復開始...');
    
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
    
    // 各設定値の完全修復
    for (const [key, defaultValue] of Object.entries(COMPLETE_DEFAULT_CONFIG)) {
        try {
            // 現在値の検証
            const currentValue = window.CONFIG[key];
            let needsFix = false;
            let reason = '';
            
            // 存在チェック
            if (currentValue === undefined || currentValue === null) {
                needsFix = true;
                reason = '未定義または null';
            }
            // 配列の特別処理
            else if (key === 'SIZE_PRESETS') {
                if (!Array.isArray(currentValue)) {
                    needsFix = true;
                    reason = '配列でない';
                } else if (currentValue.length === 0) {
                    needsFix = true;
                    reason = '空配列';
                } else {
                    // 要素妥当性チェック
                    const validElements = currentValue.filter(elem => {
                        const num = parseFloat(elem);
                        return !isNaN(num) && num > 0 && num <= 1000;
                    });
                    if (validElements.length === 0) {
                        needsFix = true;
                        reason = '有効要素なし';
                    } else if (validElements.length !== currentValue.length) {
                        // 無効要素を含む場合は有効要素のみで更新
                        window.CONFIG[key] = validElements;
                        fixedCount++;
                        console.log(`🔧 修正: ${key} → 有効要素のみ [${validElements.join(', ')}] （無効要素削除）`);
                        continue;
                    }
                }
            }
            // 数値の妥当性チェック
            else if (typeof defaultValue === 'number') {
                const numValue = parseFloat(currentValue);
                if (isNaN(numValue)) {
                    needsFix = true;
                    reason = '数値でない';
                } else if (key === 'DEFAULT_OPACITY' && (numValue < 0 || numValue > 1)) {
                    needsFix = true;
                    reason = '透明度範囲外 (0-1)';
                } else if (key.includes('SIZE') && numValue < 0) {
                    needsFix = true;
                    reason = 'サイズが負数';
                }
            }
            // 文字列の妥当性チェック
            else if (typeof defaultValue === 'string' && typeof currentValue !== 'string') {
                needsFix = true;
                reason = '文字列でない';
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
            console.error(`🔧 修復（エラー）: ${key} = ${JSON.stringify(defaultValue)}`, error);
        }
    }
    
    // 修復結果
    APP_STATE.config.fixed = true;
    console.log('✅ CONFIG完全修復完了:');
    console.log(`  📝 チェック項目: ${Object.keys(COMPLETE_DEFAULT_CONFIG).length}個`);
    console.log(`  🔧 修復項目: ${fixedCount}個`);
    console.log(`  🆕 新規作成: ${createdCount}個`);
    
    if (fixedCount > 0 || createdCount > 0) {
        console.log('🆘 CONFIG に問題がありましたが、完全修復により正常化しました。');
    } else {
        console.log('✨ CONFIG は正常でした。');
    }
    
    return true;
}

// ==== CONFIG連携修正強化: CONFIG読み込み確認（完全版）====
function checkConfigLoadedCompletely() {
    console.log('🔍 CONFIG読み込み完認強化版開始...');
    
    try {
        // 1. 基本オブジェクト存在確認
        const configObjects = [
            'CONFIG', 'UI_CONFIG', 'UI_EVENTS', 'CONFIG_VALIDATION',
            'PREVIEW_UTILS', 'DEFAULT_SETTINGS', 'FUTABA_COLORS'
        ];
        
        const missing = [];
        const available = [];
        
        configObjects.forEach(objName => {
            if (window[objName] && typeof window[objName] === 'object') {
                available.push(objName);
            } else {
                missing.push(objName);
            }
        });
        
        console.log(`✅ CONFIG関連オブジェクト利用可能: ${available.length}/${configObjects.length}個`, available);
        
        if (missing.length > 0) {
            console.warn(`⚠️ CONFIG関連オブジェクト不足: ${missing.length}個`, missing);
        }
        
        // 2. 必須CONFIG確認・作成
        if (!window.CONFIG) {
            console.error('❌ 必須のCONFIGオブジェクトが見つかりません → 作成します');
            window.CONFIG = {};
        }
        
        // 3. CONFIG完全修復実行
        fixConfigCompletely();
        
        // 4. 重要設定値の最終確認
        const criticalValues = {
            'DEFAULT_BRUSH_SIZE': safeConfigGet('DEFAULT_BRUSH_SIZE', 4),
            'DEFAULT_OPACITY': safeConfigGet('DEFAULT_OPACITY', 1.0),
            'MAX_BRUSH_SIZE': safeConfigGet('MAX_BRUSH_SIZE', 500),
            'SIZE_PRESETS': safeConfigGet('SIZE_PRESETS', [1, 2, 4, 8, 16, 32]),
            'PREVIEW_MIN_SIZE': safeConfigGet('PREVIEW_MIN_SIZE', 0.5),
            'PREVIEW_MAX_SIZE': safeConfigGet('PREVIEW_MAX_SIZE', 20)
        };
        
        console.log('🔧 重要設定値確認完了:');
        Object.entries(criticalValues).forEach(([key, value]) => {
            if (key === 'SIZE_PRESETS') {
                console.log(`  ✅ ${key}: [${Array.isArray(value) ? value.join(', ') : 'N/A'}] (${Array.isArray(value) ? value.length : 0}個)`);
            } else if (key === 'DEFAULT_OPACITY') {
                console.log(`  ✅ ${key}: ${value} (${typeof value === 'number' ? (value * 100) + '%' : 'N/A'})`);
            } else {
                console.log(`  ✅ ${key}: ${value}${typeof value === 'number' && key.includes('SIZE') ? 'px' : ''}`);
            }
        });
        
        // 5. Phase2デフォルト値変更確認
        const phase2Changes = {
            brushSizeChanged: criticalValues.DEFAULT_BRUSH_SIZE === 4,
            opacityChanged: criticalValues.DEFAULT_OPACITY === 1.0,
            maxSizeChanged: criticalValues.MAX_BRUSH_SIZE === 500,
            presetsValid: Array.isArray(criticalValues.SIZE_PRESETS) && criticalValues.SIZE_PRESETS.length > 0
        };
        
        const changesOK = Object.values(phase2Changes).every(Boolean);
        console.log('🎯 Phase2デフォルト値変更確認:', changesOK ? '✅ 全て適用済み' : '❌ 一部未適用');
        
        if (!changesOK) {
            console.warn('Phase2変更状況:', phase2Changes);
        }
        
        // 6. 最終状態設定
        APP_STATE.config.values = window.CONFIG;
        APP_STATE.config.loaded = true;
        APP_STATE.config.validated = true;
        
        console.log('✅ CONFIG読み込み確認完了（完全版）');
        return true;
        
    } catch (error) {
        console.error('❌ CONFIG読み込み確認エラー:', error);
        
        // 緊急時の最小限CONFIG作成
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
        
        console.log('🆘 緊急時最小限CONFIG作成完了');
        APP_STATE.config.loaded = true;
        return true;
    }
}

// ==== 依存関係チェック（Phase2C緊急修正対応版）====
function checkDependencies() {
    console.log('🔍 依存関係チェック開始（Phase2C緊急修正対応版）...');
    
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
        
        // UI Component classes（ui/components.jsから・準必須）
        'SliderController': typeof SliderController !== 'undefined',
        'PopupManager': typeof PopupManager !== 'undefined',
        'StatusBarManager': typeof StatusBarManager !== 'undefined',
        'PresetDisplayManager': typeof PresetDisplayManager !== 'undefined',
        
        // Phase2C緊急修正: 既存システム（必須）
        'PenPresetManager': typeof PenPresetManager !== 'undefined',
        'PerformanceMonitor': typeof PerformanceMonitor !== 'undefined',
        
        // State management（history-manager.js内・必須）
        'InternalStateCapture': typeof InternalStateCapture !== 'undefined',
        'InternalStateRestore': typeof InternalStateRestore !== 'undefined',
        
        // StateCapture/StateRestore エイリアス（drawing-tools.js内・必須）
        'StateCapture': typeof StateCapture !== 'undefined',
        'StateRestore': typeof StateRestore !== 'undefined',
        
        // Phase2C緊急修正: 新システム（オプショナル・段階的実装用）
        'PresetManager': typeof PresetManager !== 'undefined', // 将来実装
        'PerformanceMonitorSystem': typeof PerformanceMonitorSystem !== 'undefined' // 将来実装
    };
    
    const missing = [];
    const available = [];
    const optional = [];
    
    // 必須・準必須・オプショナルの分類
    const criticalClasses = [
        'PIXI', 'PixiDrawingApp', 'DrawingToolsSystem', 'HistoryManager', 'UIManager',
        'PenPresetManager', 'PerformanceMonitor', 'InternalStateCapture', 'InternalStateRestore',
        'StateCapture', 'StateRestore'
    ];
    
    const optionalClasses = ['PresetManager', 'PerformanceMonitorSystem'];
    
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
    console.log(`🔄 段階的実装予定: ${optional.length}個`, optional);
    
    if (missing.length > 0) {
        console.warn(`❌ 不足: ${missing.length}個`, missing);
        
        // クリティカルなクラスの不足チェック
        const criticalMissing = missing.filter(className => criticalClasses.includes(className));
        
        if (criticalMissing.length > 0) {
            console.error('🚨 重要なクラスが見つかりません:', criticalMissing);
            throw new InitializationError(
                `重要なクラスが見つかりません: ${criticalMissing.join(', ')}`,
                INIT_STEPS.CHECKING_DEPENDENCIES
            );
        } else {
            console.warn(`⚠️ 一部クラスが不足していますが、初期化を続行します: ${missing.join(', ')}`);
        }
    } else {
        console.log('✨ 全ての必須クラスが利用可能です');
    }
    
    if (optional.length > 0) {
        console.log(`🔮 段階的実装準備: ${optional.join(', ')} は後日実装予定`);
    }
    
    console.log('✅ 依存関係チェック完了（Phase2C緊急修正対応版）');
    return true;
}

// ==== アプリケーション作成（CONFIG連携修正強化版）====
async function createApplication() {
    console.log('🎯 PixiDrawingApp作成中（CONFIG連携修正強化版）...');
    
    try {
        // CONFIG値を安全に取得
        const width = safeConfigGet('CANVAS_WIDTH', 400);
        const height = safeConfigGet('CANVAS_HEIGHT', 400);
        
        console.log(`🎯 キャンバスサイズ: ${width}×${height}px`);
        
        const app = new PixiDrawingApp(width, height);
        await app.init();
        
        APP_STATE.components.app = app;
        console.log(`✅ PixiDrawingApp作成完了（${width}×${height}px）`);
        
        return app;
    } catch (error) {
        throw new InitializationError(
            'PixiDrawingApp作成に失敗',
            INIT_STEPS.CREATING_APP,
            error
        );
    }
}

// ==== ツールシステム作成（CONFIG連携修正強化版）====
async function createToolsSystem(app) {
    console.log('🔧 DrawingToolsSystem作成中（CONFIG連携修正強化版）...');
    
    try {
        const toolsSystem = new DrawingToolsSystem(app);
        await toolsSystem.init();
        
        APP_STATE.components.toolsSystem = toolsSystem;
        
        // Phase2デフォルト値をCONFIGから安全に取得して適用
        const defaultSettings = {
            size: safeConfigGet('DEFAULT_BRUSH_SIZE', 4),
            opacity: safeConfigGet('DEFAULT_OPACITY', 1.0),
            color: safeConfigGet('DEFAULT_COLOR', 0x800000),
            pressure: safeConfigGet('DEFAULT_PRESSURE', 0.5),
            smoothing: safeConfigGet('DEFAULT_SMOOTHING', 0.3)
        };
        
        if (toolsSystem.updateBrushSettings) {
            toolsSystem.updateBrushSettings(defaultSettings);
            console.log('🔧 Phase2デフォルト設定適用完了:', defaultSettings);
        }
        
        console.log('✅ DrawingToolsSystem作成完了（CONFIG連携修正強化版）');
        
        return toolsSystem;
    } catch (error) {
        throw new InitializationError(
            'DrawingToolsSystem作成に失敗',
            INIT_STEPS.CREATING_TOOLS_SYSTEM,
            error
        );
    }
}

// ==== UI管理システム作成（Phase2C緊急修正対応版）====
async function createUIManager(app, toolsSystem) {
    console.log('🎭 UIManager作成中（Phase2C緊急修正対応版）...');
    
    try {
        // 履歴管理システムを取得
        const historyManager = toolsSystem.getHistoryManager();
        
        // Phase2C緊急修正版UIManagerを作成
        const uiManager = new UIManager(app, toolsSystem, historyManager);
        await uiManager.init();
        
        APP_STATE.components.uiManager = uiManager;
        APP_STATE.components.historyManager = historyManager;
        
        console.log('✅ UIManager作成完了（Phase2C緊急修正対応版）');
        
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
        const historyManager = toolsSystem.getHistoryManager();
        
        if (typeof SettingsManager === 'undefined') {
            console.warn('⚠️ SettingsManager が利用できません。基本機能のみで続行します。');
            return null;
        }
        
        const settingsManager = new SettingsManager(app, toolsSystem, uiManager, historyManager);
        await settingsManager.init();
        
        APP_STATE.components.settingsManager = settingsManager;
        console.log('✅ SettingsManager作成完了');
        
        return settingsManager;
    } catch (error) {
        console.warn('⚠️ SettingsManager初期化に失敗:', error);
        console.warn('基本機能のみで続行します。');
        return null;
    }
}

// ==== システム間連携設定（CONFIG連携修正強化版）====
async function connectSystems() {
    console.log('🔗 システム間連携設定中（CONFIG連携修正強化版）...');
    
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
        
        // 5. CONFIG関連のグローバル参照
        window.appConfig = window.CONFIG || {};
        window.uiConfig = window.UI_CONFIG || {};
        
        // 6. デバッグ用のグローバル関数設定
        window.undo = () => historyManager ? historyManager.undo() : false;
        window.redo = () => historyManager ? historyManager.redo() : false;
        window.debugHistory = () => toolsSystem ? toolsSystem.debugHistory() : console.warn('ToolsSystem not available');
        window.testHistory = () => toolsSystem ? toolsSystem.testHistoryFunction() : console.warn('ToolsSystem not available');
        window.getHistoryStats = () => historyManager ? historyManager.getStats() : null;
        window.clearHistory = () => historyManager ? historyManager.clearHistory() : false;
        window.showSystemStats = () => toolsSystem ? console.log(toolsSystem.getSystemStats()) : console.warn('ToolsSystem not available');
        
        // 7. CONFIG連携デバッグ関数（強化版）
        window.debugConfig = () => {
            console.group('🔧 CONFIG設定情報（連携修正強化版）');
            console.log('CONFIG:', window.CONFIG || 'N/A');
            console.log('UI_CONFIG:', window.UI_CONFIG || 'N/A');
            console.log('UI_EVENTS:', window.UI_EVENTS || 'N/A');
            console.log('DEFAULT_SETTINGS:', window.DEFAULT_SETTINGS || 'N/A');
            
            // Phase2重要設定の表示
            const criticalSettings = [
                'DEFAULT_BRUSH_SIZE', 'DEFAULT_OPACITY', 'MAX_BRUSH_SIZE',
                'SIZE_PRESETS', 'PREVIEW_MIN_SIZE', 'PREVIEW_MAX_SIZE'
            ].reduce((obj, key) => {
                obj[key] = safeConfigGet(key, 'N/A');
                return obj;
            }, {});
            
            console.log('Phase2重要設定:', criticalSettings);
            console.log('CONFIG状態:', APP_STATE.config);
            console.groupEnd();
        };
        
        // 8. 安全アクセス関数をグローバル公開
        window.safeConfigGet = safeConfigGet;
        
        console.log('✅ システム間連携設定完了（CONFIG連携修正強化版）');
        console.log('🐛 デバッグ関数設定完了:');
        console.log('  📋 基本機能: undo(), redo(), debugHistory(), testHistory()');
        console.log('  📊 統計: getHistoryStats(), showSystemStats()');
        console.log('  🔧 CONFIG: debugConfig(), safeConfigGet()');
        
    } catch (error) {
        throw new InitializationError(
            'システム間連携設定に失敗',
            INIT_STEPS.CONNECTING_SYSTEMS,
            error
        );
    }
}

// ==== 最終セットアップ（CONFIG連携修正強化版）====
async function finalSetup() {
    console.log('🎨 最終セットアップ中（CONFIG連携修正強化版）...');
    
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
        
        // 4. Phase2設定値確認・表示
        const phase2Settings = {
            brushSize: safeConfigGet('DEFAULT_BRUSH_SIZE', 4),
            opacity: safeConfigGet('DEFAULT_OPACITY', 1.0),
            maxSize: safeConfigGet('MAX_BRUSH_SIZE', 500),
            sizePresets: safeConfigGet('SIZE_PRESETS', [1, 2, 4, 8, 16, 32])
        };
        
        console.log('🎯 Phase2設定値確認:');
        console.log(`  🖊️  デフォルトペンサイズ: ${phase2Settings.brushSize}px（16→4に変更）`);
        console.log(`  🎨 デフォルト透明度: ${phase2Settings.opacity * 100}%（85%→100%に変更）`);
        console.log(`  📏 最大ペンサイズ: ${phase2Settings.maxSize}px（100→500に変更）`);
        console.log(`  🎯 プリセット: [${Array.isArray(phase2Settings.sizePresets) ? phase2Settings.sizePresets.join(', ') : 'N/A'}]px`);
        
        // 5. システム状態の最終確認
        const appStats = app.getStats ? app.getStats() : {};
        const systemStats = toolsSystem.getSystemStats ? toolsSystem.getSystemStats() : {};
        const uiStats = uiManager ? uiManager.getUIStats() : null;
        
        console.log('📈 システム状態確認（CONFIG連携修正強化版）:');
        console.log('  - App:', appStats);
        console.log('  - Tools:', systemStats);
        if (uiStats) {
            console.log('  - UI:', uiStats);
        }
        if (settingsManager && settingsManager.getSettingsInfo) {
            console.log('  - Settings:', settingsManager.getSettingsInfo());
        }
        
        // CONFIG情報表示
        console.log('  - Config:', {
            loaded: APP_STATE.config.loaded,
            validated: APP_STATE.config.validated,
            fixed: APP_STATE.config.fixed,
            phase2Applied: phase2Settings.brushSize === 4 && phase2Settings.opacity === 1.0
        });
        
        console.log('✅ 最終セットアップ完了（CONFIG連携修正強化版）');
        
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

// ==== デバッグ機能設定（CONFIG連携修正強化版）====
function setupDebugFunctions() {
    // グローバルデバッグ関数
    window.debugApp = function() {
        console.group('🔍 アプリケーションデバッグ情報（CONFIG連携修正強化版）');
        console.log('状態:', APP_STATE);
        
        if (APP_STATE.components.app) {
            console.log('App統計:', APP_STATE.components.app.getStats ? APP_STATE.components.app.getStats() : 'N/A');
        }
        
        if (APP_STATE.components.toolsSystem) {
            console.log('Tools統計:', APP_STATE.components.toolsSystem.getSystemStats ? APP_STATE.components.toolsSystem.getSystemStats() : 'N/A');
        }
        
        if (APP_STATE.components.uiManager) {
            console.log('UI統計:', APP_STATE.components.uiManager.getUIStats ? APP_STATE.components.uiManager.getUIStats() : 'N/A');
        }
        
        if (APP_STATE.components.settingsManager && APP_STATE.components.settingsManager.getSettingsInfo) {
            console.log('Settings統計:', APP_STATE.components.settingsManager.getSettingsInfo());
        }
        
        // CONFIG情報表示（強化版）
        if (APP_STATE.config.loaded) {
            const configInfo = {
                loaded: APP_STATE.config.loaded,
                validated: APP_STATE.config.validated,
                fixed: APP_STATE.config.fixed
            };
            
            // Phase2重要設定確認
            const phase2Settings = {
                brushSize: safeConfigGet('DEFAULT_BRUSH_SIZE', 'N/A'),
                opacity: safeConfigGet('DEFAULT_OPACITY', 'N/A'),
                maxSize: safeConfigGet('MAX_BRUSH_SIZE', 'N/A'),
                sizePresets: safeConfigGet('SIZE_PRESETS', [])
            };
            
            console.log('Config状態:', configInfo);
            console.log('Phase2設定:', phase2Settings);
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
    
    // CONFIG連携テスト関数（強化版）
    window.testConfigSystem = function() {
        console.group('🧪 CONFIGシステムテスト（連携修正強化版）');
        
        // 1. 基本アクセステスト
        console.log('1. 基本アクセステスト...');
        const testKeys = [
            'DEFAULT_BRUSH_SIZE', 'DEFAULT_OPACITY', 'MAX_BRUSH_SIZE',
            'SIZE_PRESETS', 'PREVIEW_MIN_SIZE', 'PREVIEW_MAX_SIZE'
        ];
        
        testKeys.forEach(key => {
            const value = safeConfigGet(key, 'DEFAULT');
            console.log(`  ${key}: ${JSON.stringify(value)}`);
        });
        
        // 2. Phase2デフォルト値テスト
        console.log('2. Phase2デフォルト値テスト...');
        const phase2Tests = [
            { key: 'DEFAULT_BRUSH_SIZE', expected: 4, actual: safeConfigGet('DEFAULT_BRUSH_SIZE', 0) },
            { key: 'DEFAULT_OPACITY', expected: 1.0, actual: safeConfigGet('DEFAULT_OPACITY', 0) },
            { key: 'MAX_BRUSH_SIZE', expected: 500, actual: safeConfigGet('MAX_BRUSH_SIZE', 0) }
        ];
        
        phase2Tests.forEach(test => {
            const passed = test.actual === test.expected;
            console.log(`  ${test.key}: ${passed ? '✅' : '❌'} ${test.actual} (期待値: ${test.expected})`);
        });
        
        // 3. SIZE_PRESTESテスト
        console.log('3. SIZE_PRESTESテスト...');
        const presets = safeConfigGet('SIZE_PRESETS', []);
        console.log(`  配列判定: ${Array.isArray(presets) ? '✅' : '❌'}`);
        console.log(`  要素数: ${Array.isArray(presets) ? presets.length : 'N/A'}`);
        console.log(`  内容: [${Array.isArray(presets) ? presets.join(', ') : 'N/A'}]`);
        
        // 4. エラーハンドリングテスト
        console.log('4. エラーハンドリングテスト...');
        const errorTest1 = safeConfigGet('NON_EXISTENT_KEY', 'DEFAULT_VALUE');
        const errorTest2 = safeConfigGet(null, 'NULL_KEY_TEST');
        console.log(`  存在しないキー: ${errorTest1}`);
        console.log(`  nullキー: ${errorTest2}`);
        
        console.log('✅ CONFIGシステムテスト完了');
        console.groupEnd();
    };
    
    // 統合システムテスト関数（強化版）
    window.testSystem = function() {
        console.group('🧪 システム統合テスト（CONFIG連携修正強化版）');
        
        // 1. 基本機能テスト
        console.log('1. 基本機能テスト...');
        console.log('   - CONFIG読み込み:', APP_STATE.config.loaded);
        console.log('   - CONFIG妥当性チェック:', APP_STATE.config.validated);
        console.log('   - CONFIG修復完了:', APP_STATE.config.fixed);
        console.log('   - App初期化:', !!APP_STATE.components.app);
        console.log('   - ToolsSystem:', !!APP_STATE.components.toolsSystem);
        console.log('   - UIManager:', !!APP_STATE.components.uiManager);
        console.log('   - HistoryManager:', !!APP_STATE.components.historyManager);
        console.log('   - SettingsManager:', !!APP_STATE.components.settingsManager);
        
        // 2. Phase2デフォルト値テスト
        console.log('2. Phase2デフォルト値テスト...');
        const brushSize = safeConfigGet('DEFAULT_BRUSH_SIZE', 0);
        const opacity = safeConfigGet('DEFAULT_OPACITY', 0);
        const maxSize = safeConfigGet('MAX_BRUSH_SIZE', 0);
        const sizePresets = safeConfigGet('SIZE_PRESETS', []);
        
        console.log(`   - デフォルトサイズ: ${brushSize}px (期待値: 4px) ${brushSize === 4 ? '✅' : '❌'}`);
        console.log(`   - デフォルト透明度: ${opacity * 100}% (期待値: 100%) ${opacity === 1.0 ? '✅' : '❌'}`);
        console.log(`   - 最大サイズ: ${maxSize}px (期待値: 500px) ${maxSize === 500 ? '✅' : '❌'}`);
        console.log(`   - プリセット数: ${Array.isArray(sizePresets) ? sizePresets.length : 0} (期待値: 6個) ${Array.isArray(sizePresets) && sizePresets.length === 6 ? '✅' : '❌'}`);
        
        // 3. UIManagerテスト（Phase2C緊急修正版）
        console.log('3. UIManagerテスト（Phase2C緊急修正版）...');
        if (APP_STATE.components.uiManager) {
            const uiStats = APP_STATE.components.uiManager.getUIStats();
            console.log('   - 初期化完了:', uiStats.initialized);
            console.log('   - PenPresetManager:', uiStats.components.penPresetManager);
            console.log('   - PerformanceMonitor:', uiStats.components.performanceMonitor);
            console.log('   - エラーカウント:', `${uiStats.errorCount}/${uiStats.maxErrors}`);
        }
        
        // 4. 履歴機能テスト
        console.log('4. 履歴機能テスト...');
        if (APP_STATE.components.toolsSystem && APP_STATE.components.toolsSystem.testHistoryFunction) {
            APP_STATE.components.toolsSystem.testHistoryFunction();
        }
        
        // 5. CONFIGシステムテスト
        console.log('5. CONFIGシステムテスト...');
        if (typeof window.testConfigSystem === 'function') {
            window.testConfigSystem();
        }
        
        console.log('✅ システム統合テスト完了（CONFIG連携修正強化版）');
        console.groupEnd();
    };
    
    console.log('🐛 デバッグ機能設定完了（CONFIG連携修正強化版）');
    console.log('📝 利用可能なデバッグ関数:');
    console.log('  - window.debugApp() - アプリ全体の状態表示（CONFIG強化版）');
    console.log('  - window.showErrorInfo() - エラー情報表示');
    console.log('  - window.testSystem() - システム統合テスト（CONFIG強化版）');
    console.log('  - window.testConfigSystem() - CONFIGシステムテスト（新規）');
    console.log('  - window.safeConfigGet(key, defaultValue) - 安全CONFIG取得');
}

// ==== 初期化ステップ更新関数 ====
function updateInitStep(step, details = null) {
    APP_STATE.initializationStep = step;
    
    const stepMessages = {
        [INIT_STEPS.CHECKING_CONFIG]: 'CONFIG読み込み確認中（完全版）...',
        [INIT_STEPS.VALIDATING_CONFIG]: 'CONFIG妥当性チェック中...',
        [INIT_STEPS.FIXING_CONFIG]: 'CONFIG完全修復中...',
        [INIT_STEPS.CHECKING_DEPENDENCIES]: '依存関係チェック中（Phase2C緊急修正対応版）...',
        [INIT_STEPS.CREATING_APP]: 'アプリケーション作成中（CONFIG連携修正強化版）...',
        [INIT_STEPS.CREATING_TOOLS_SYSTEM]: 'ツールシステム作成中（CONFIG連携修正強化版）...',
        [INIT_STEPS.CREATING_UI_MANAGER]: 'UI管理システム作成中（Phase2C緊急修正対応版）...',
        [INIT_STEPS.CREATING_SETTINGS_MANAGER]: '設定管理システム作成中...',
        [INIT_STEPS.CONNECTING_SYSTEMS]: 'システム連携設定中（CONFIG連携修正強化版）...',
        [INIT_STEPS.FINAL_SETUP]: '最終セットアップ中（CONFIG連携修正強化版）...',
        [INIT_STEPS.COMPLETED]: '初期化完了！',
        [INIT_STEPS.ERROR]: '初期化エラー'
    };
    
    console.log(`📋 ${stepMessages[step] || step}`, details || '');
}

// ==== メイン初期化関数（CONFIG連携修正強化版）====
async function initializeApplication() {
    try {
        APP_STATE.startTime = performance.now();
        console.log('🚀 ふたば☆ちゃんねる風ベクターお絵描きツール 初期化開始（CONFIG連携修正強化版）');
        
        // 1. CONFIG読み込み確認（完全版）
        updateInitStep(INIT_STEPS.CHECKING_CONFIG);
        checkConfigLoadedCompletely();
        
        // 2. 依存関係チェック（Phase2C緊急修正対応版）
        updateInitStep(INIT_STEPS.CHECKING_DEPENDENCIES);
        checkDependencies();
        
        // 3. アプリケーション作成（CONFIG連携修正強化版）
        updateInitStep(INIT_STEPS.CREATING_APP);
        const app = await createApplication();
        
        // 4. ツールシステム作成（CONFIG連携修正強化版）
        updateInitStep(INIT_STEPS.CREATING_TOOLS_SYSTEM);
        const toolsSystem = await createToolsSystem(app);
        
        // 5. UI管理システム作成（Phase2C緊急修正対応版）
        updateInitStep(INIT_STEPS.CREATING_UI_MANAGER);
        const uiManager = await createUIManager(app, toolsSystem);
        
        // 6. 設定管理システム作成
        updateInitStep(INIT_STEPS.CREATING_SETTINGS_MANAGER);
        const settingsManager = await createSettingsManager(app, toolsSystem, uiManager);
        
        // 7. システム間連携設定（CONFIG連携修正強化版）
        updateInitStep(INIT_STEPS.CONNECTING_SYSTEMS);
        await connectSystems();
        
        // 8. 最終セットアップ（CONFIG連携修正強化版）
        updateInitStep(INIT_STEPS.FINAL_SETUP);
        await finalSetup();
        
        // 9. 初期化完了
        updateInitStep(INIT_STEPS.COMPLETED);
        APP_STATE.initialized = true;
        APP_STATE.stats.initTime = performance.now() - APP_STATE.startTime;
        
        // 初期化完了ログ
        console.log('🎉 アプリケーション初期化完了（CONFIG連携修正強化版）！');
        console.log(`⏱️ 初期化時間: ${APP_STATE.stats.initTime.toFixed(2)}ms`);
        console.log('🎨 描画の準備ができました！');
        
        // システム概要表示（強化版）
        console.group('📋 システム概要（CONFIG連携修正強化版）');
        
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
        console.log('🔧 CONFIG連携修正: 完全修復・安全アクセス・エラー解決');
        console.log('🏗️ Phase2C緊急修正: 既存システム活用・段階的拡張準備');
        console.groupEnd();
        
        // UI通知
        if (uiManager && uiManager.showNotification) {
            uiManager.showNotification(
                'CONFIG連携修正強化版初期化完了！基本機能復旧・Phase2設定適用',
                'success',
                4000
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
            CONFIG連携修正強化版
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
    window.safeConfigGet = safeConfigGet; // 安全CONFIG取得
    window.fixConfigCompletely = fixConfigCompletely; // CONFIG修復
    window.checkConfigLoadedCompletely = checkConfigLoadedCompletely; // CONFIG確認
    
    console.log('🔧 main.js CONFIG連携修正強化版 読み込み完了');
    console.log('🔧 CONFIG連携修正強化項目:');
    console.log('  ✅ safeConfigGet関数実装（完全なundefinedアクセス回避）');
    console.log('  ✅ fixConfigCompletely関数実装（自動修復機能）');
    console.log('  ✅ checkConfigLoadedCompletely関数実装（完全確認）');
    console.log('  ✅ SIZE_PRESETS空配列問題の根本解決');
    console.log('  ✅ デフォルト値フォールバック強化');
    console.log('  ✅ エラー時のグレースフル・デグラデーション');
    console.log('  ✅ 初期化順序最適化（段階的エラーハンドリング）');
    console.log('  ✅ Phase2C緊急修正版ui-manager.js対応');
    console.log('🏗️ CONFIG修復機能:');
    console.log('  1. window.safeConfigGet(key, defaultValue) - 安全なCONFIG値取得');
    console.log('  2. window.fixConfigCompletely() - CONFIG完全修復');
    console.log('  3. window.checkConfigLoadedCompletely() - CONFIG完全確認');
    console.log('  4. window.testConfigSystem() - CONFIGシステムテスト');
    console.log('🚀 準備完了: アプリケーション初期化実行中...');
}

// ==== 依存関係チェック（Phase2C緊急修正対応版）====
function checkDependencies() {
    console.log('🔍 依存関係チェック開始（Phase2C緊急修正対応版）...');
    
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
        
        // UI Component classes（ui/components.jsから・必須）
        'SliderController': typeof SliderController !== 'undefined',
        'PopupManager': typeof PopupManager !== 'undefined',
        'StatusBarManager': typeof StatusBarManager !== 'undefined',
        'PresetDisplayManager': typeof PresetDisplayManager !== 'undefined',
        
        // Phase2C緊急修正: 既存システム（必須・ui/components.js定義）
        'PenPresetManager': typeof PenPresetManager !== 'undefined',
        'PerformanceMonitor': typeof PerformanceMonitor !== 'undefined',
        
        // State management（history-manager.js内・必須）
        'InternalStateCapture': typeof InternalStateCapture !== 'undefined',
        'InternalStateRestore': typeof InternalStateRestore !== 'undefined',
        
        // StateCapture/StateRestore エイリアス（drawing-tools.js内・必須）
        'StateCapture': typeof StateCapture !== 'undefined',
        'StateRestore': typeof StateRestore !== 'undefined',
        
        // Phase2C緊急修正: 新システム（オプショナル・段階的実装用）
        'PresetManager': typeof PresetManager !== 'undefined', // 将来実装
        'PerformanceMonitorSystem': typeof PerformanceMonitorSystem !== 'undefined' // 将来実装
    };
    
    const missing = [];
    const available = [];
    const optional = [];
    
    // Phase2C緊急修正: 必須・準必須・オプショナルの分類調整
    const criticalClasses = [
        'PIXI', 'PixiDrawingApp', 'DrawingToolsSystem', 'HistoryManager', 'UIManager',
        'SliderController', 'PopupManager', 'StatusBarManager', 'PresetDisplayManager',
        'PenPresetManager', 'PerformanceMonitor', 'InternalStateCapture', 'InternalStateRestore',
        'StateCapture', 'StateRestore'
    ];
    
    const optionalClasses = ['PresetManager', 'PerformanceMonitorSystem', 'SettingsManager'];
    
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
    console.log(`🔄 段階的実装予定: ${optional.length}個`, optional);
    
    if (missing.length > 0) {
        console.warn(`❌ 不足: ${missing.length}個`, missing);
        
        // クリティカルなクラスの不足チェック
        const criticalMissing = missing.filter(className => criticalClasses.includes(className));
        
        if (criticalMissing.length > 0) {
            console.error('🚨 重要なクラスが見つかりません:', criticalMissing);
            throw new InitializationError(
                `重要なクラスが見つかりません: ${criticalMissing.join(', ')}`,
                INIT_STEPS.CHECKING_DEPENDENCIES
            );
        } else {
            console.warn(`⚠️ 一部クラスが不足していますが、初期化を続行します: ${missing.join(', ')}`);
        }
    } else {
        console.log('✨ 全ての必須クラスが利用可能です');
    }
    
    if (optional.length > 0) {
        console.log(`🔮 段階的実装準備: ${optional.join(', ')} は後日実装予定`);
    }
    
    console.log('✅ 依存関係チェック完了（Phase2C緊急修正対応版）');
    return true;
}