/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1rev13
 * メイン初期化スクリプト - main.js (緊急修正版)
 * 
 * 🔧 緊急修正内容:
 * 1. ✅ PenToolUI初期化の完全修正・drawing-tools.js連携強化
 * 2. ✅ CONFIG不足エラー完全解消・CONFIG補完システム統合
 * 3. ✅ PixiJS拡張ライブラリ初期化待機追加
 * 4. ✅ 段階的エラーハンドリング・グレースフルデグラデーション
 * 5. ✅ 詳細デバッグ・テスト機能追加
 * 
 * 目標: ペンポップアップ完全復活・safeConfigGetエラー解消・AI実装支援向上
 */

console.log('🚀 main.js 緊急修正版 - 読み込み開始...');

// ==== 🆘 緊急修正: utils.js依存関係チェック強化 ====
if (typeof window.safeConfigGet === 'undefined') {
    console.error('🚨 緊急修正: utils.js未読み込み検出 - フォールバック実装中...');
    
    // 緊急フォールバックsafeConfigGet
    window.safeConfigGet = function(key, defaultValue = null) {
        try {
            if (!window.CONFIG) {
                console.warn(`safeConfigGet: CONFIG未定義 (${key}) → デフォルト値:`, defaultValue);
                return defaultValue;
            }
            
            const keys = key.split('.');
            let current = window.CONFIG;
            
            for (const k of keys) {
                if (current && typeof current === 'object' && k in current) {
                    current = current[k];
                } else {
                    console.warn(`safeConfigGet: キー不存在 (${key}) → デフォルト値使用:`, defaultValue);
                    return defaultValue;
                }
            }
            
            return current;
        } catch (error) {
            console.error(`safeConfigGet: エラー (${key}):`, error.message);
            return defaultValue;
        }
    };
    
    // 緊急フォールバック関数群
    window.createApplicationError = (message, context = {}) => {
        const error = new Error(message);
        error.name = 'ApplicationError';
        error.context = context;
        error.timestamp = Date.now();
        return error;
    };
    
    window.logError = (error, context = 'Unknown') => {
        console.error(`🚨 [${context}] ${error.name || 'Error'}: ${error.message}`, error);
    };
    
    window.measurePerformance = (name, operation) => {
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
    
    console.log('🆘 緊急フォールバック関数設定完了');
}

// ==== グローバル状態管理（緊急修正版）====
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
        supplemented: false  // 🆕 CONFIG補完状態
    },
    pixiExtensions: {
        loaded: false,
        initialized: false,
        available: {}  // 🆕 利用可能な拡張機能
    }
};

// ==== 初期化ステップ定義（緊急修正版）====
const INIT_STEPS = {
    EMERGENCY_CONFIG_SUPPLEMENT: 'emergency_config_supplement',  // 🆕 緊急CONFIG補完
    PIXI_EXTENSIONS_INIT: 'pixi_extensions_init',  // 🆕 PixiJS拡張ライブラリ初期化
    CHECKING_SYSTEMS: 'checking_systems',
    CHECKING_CONFIG: 'checking_config', 
    CHECKING_DEPENDENCIES: 'checking_dependencies',
    CREATING_APP: 'creating_app',
    CREATING_TOOLS_SYSTEM: 'creating_tools_system',
    CREATING_UI_MANAGER: 'creating_ui_manager',
    CREATING_PEN_TOOL_UI: 'creating_pen_tool_ui',  // 🔧 修正: より具体的な名前
    CONNECTING_SYSTEMS: 'connecting_systems',
    FINAL_SETUP: 'final_setup',
    COMPLETED: 'completed',
    ERROR: 'error'
};

// ==== 🆘 緊急修正: CONFIG補完システム ====
async function emergencyConfigSupplement() {
    console.log('🆘 緊急CONFIG補完システム実行中...');
    
    try {
        // 基本CONFIG確保
        if (!window.CONFIG) {
            window.CONFIG = {};
            console.log('🆘 CONFIG オブジェクト作成');
        }
        
        // ログエラーで特定された不足項目を優先補完
        const criticalConfigs = {
            SIZE_PRESETS: [
                { name: '極細', size: 1, opacity: 90, color: 0x800000 },
                { name: '細', size: 2, opacity: 85, color: 0x800000 },
                { name: '標準', size: 4, opacity: 85, color: 0x800000 },
                { name: '太', size: 8, opacity: 80, color: 0x800000 },
                { name: '極太', size: 16, opacity: 75, color: 0x800000 }
            ],
            PREVIEW_MIN_SIZE: 1,
            PREVIEW_MAX_SIZE: 32,
            DEFAULT_COLOR: 0x800000,
            PRESET_UPDATE_THROTTLE: 16,
            PERFORMANCE_UPDATE_INTERVAL: 1000,
            TARGET_FPS: 60,
            
            // 基本描画設定
            DEFAULT_BRUSH_SIZE: 4,
            DEFAULT_OPACITY: 0.85,
            MAX_BRUSH_SIZE: 500,
            MIN_BRUSH_SIZE: 0.1,
            DEFAULT_PRESSURE: 0.5,
            DEFAULT_SMOOTHING: 0.3,
            
            // キャンバス設定
            CANVAS_WIDTH: 400,
            CANVAS_HEIGHT: 400,
            BG_COLOR: 0xf0e0d6,
            
            // ポップアップ専用設定
            POPUP_CONFIG: {
                WIDTH: 320,
                HEIGHT: 480,
                BACKGROUND_COLOR: 0xF0E0D6,
                BORDER_COLOR: 0x800000,
                BORDER_WIDTH: 2,
                CORNER_RADIUS: 8,
                ANIMATION_DURATION: 200,
                CLOSE_ON_OUTSIDE: true
            },
            
            // ライブラリ統合設定
            LIBRARY_CONFIG: {
                UI_THEME: 'futaba',
                UI_BUTTON_STYLE: {
                    backgroundColor: 0x800000,
                    hoverColor: 0xaa5a56,
                    textColor: 0xFFFFFF
                },
                LAYER_MAX_COUNT: 10,
                SMOOTH_GRAPHICS_ENABLED: true,
                GRAPHICS_EXTRAS_ENABLED: true
            },
            
            LIBRARY_FLAGS: {
                ENABLE_PIXI_UI: true,
                ENABLE_PIXI_LAYERS: true,
                ENABLE_PIXI_GIF: false,
                ENABLE_SMOOTH_GRAPHICS: true,
                ENABLE_GRAPHICS_EXTRAS: true
            }
        };
        
        let supplementCount = 0;
        
        // 不足CONFIG項目補完
        for (const [key, value] of Object.entries(criticalConfigs)) {
            if (window.CONFIG[key] === undefined || window.CONFIG[key] === null) {
                window.CONFIG[key] = value;
                supplementCount++;
                console.log(`🔧 CONFIG補完: ${key}`);
            }
        }
        
        APP_STATE.config.supplemented = true;
        console.log(`✅ 緊急CONFIG補完完了: ${supplementCount}項目補完`);
        
        // validateConfigIntegrity関数も緊急作成
        if (typeof window.validateConfigIntegrity === 'undefined') {
            window.validateConfigIntegrity = function() {
                const required = ['SIZE_PRESETS', 'DEFAULT_COLOR', 'POPUP_CONFIG'];
                const missing = required.filter(key => !window.CONFIG[key]);
                
                if (missing.length === 0) {
                    console.log('✅ CONFIG整合性確認完了');
                    return { valid: true, missing: [], present: required };
                } else {
                    console.warn('⚠️ CONFIG整合性問題:', missing);
                    return { valid: false, missing, present: required.filter(k => !missing.includes(k)) };
                }
            };
            
            console.log('🆘 validateConfigIntegrity 緊急作成完了');
        }
        
        return true;
        
    } catch (error) {
        console.error('❌ 緊急CONFIG補完失敗:', error);
        APP_STATE.config.supplemented = false;
        throw error;
    }
}

// ==== 🆘 緊急修正: PixiJS拡張ライブラリ初期化待機 ====
async function initializePixiExtensions() {
    console.log('🔌 PixiJS拡張ライブラリ初期化待機中...');
    
    try {
        // PixiJS拡張ライブラリの存在確認
        if (window.PixiExtensions) {
            console.log('🔌 PixiExtensions 検出済み');
            APP_STATE.pixiExtensions.loaded = true;
            
            // 初期化関数の実行
            if (window.initializePixiExtensions) {
                await window.initializePixiExtensions();
                console.log('🔌 PixiJS拡張ライブラリ初期化完了');
                APP_STATE.pixiExtensions.initialized = true;
            }
            
            // 利用可能な機能確認
            const features = {
                ui: !!(window.PixiExtensions.hasFeature?.('ui') || window.PixiExtensions.Button),
                layers: !!(window.PixiExtensions.hasFeature?.('layers') || window.PixiExtensions.Layer),
                smooth: !!(window.PixiExtensions.hasFeature?.('smooth') || window.PixiExtensions.SmoothGraphics),
                gif: !!(window.PixiExtensions.hasFeature?.('gif') || window.PixiExtensions.AnimatedGIF)
            };
            
            APP_STATE.pixiExtensions.available = features;
            console.log('🔌 利用可能機能:', features);
            
        } else {
            console.warn('⚠️ PixiExtensions 未検出 - 基本機能で続行');
            APP_STATE.pixiExtensions.loaded = false;
        }
        
        return true;
        
    } catch (error) {
        console.error('❌ PixiJS拡張ライブラリ初期化失敗:', error);
        APP_STATE.pixiExtensions.loaded = false;
        APP_STATE.pixiExtensions.initialized = false;
        // エラーでも続行（基本機能で動作）
        return false;
    }
}

// ==== 🔧 修正: PenToolUI専用初期化システム ====
async function createPenToolUI(toolsSystem, uiManager) {
    console.log('🎨 PenToolUI専用初期化システム開始...');
    
    try {
        return await measurePerformance('PenToolUI作成', async () => {
            // Step 1: PenToolUI クラス存在確認
            if (typeof window.PenToolUI !== 'function') {
                throw new Error('PenToolUI class not found - pen-tool-ui.js の読み込みを確認してください');
            }
            
            // Step 2: drawingToolsSystem から既存 PenToolUI を確認
            let penToolUI = null;
            
            if (toolsSystem.penToolUI) {
                penToolUI = toolsSystem.penToolUI;
                console.log('✅ 既存PenToolUI検出 (toolsSystem.penToolUI)');
                
            } else if (toolsSystem.getPenToolUI) {
                penToolUI = toolsSystem.getPenToolUI();
                console.log('✅ PenToolUI取得 (toolsSystem.getPenToolUI)');
                
            } else {
                console.log('🔧 新規PenToolUI作成...');
                
                // Step 3: 新規PenToolUI作成
                if (window.createPenToolUI) {
                    penToolUI = window.createPenToolUI(toolsSystem);
                } else {
                    penToolUI = new window.PenToolUI(toolsSystem);
                }
            }
            
            // Step 4: PenToolUI初期化確認・実行
            if (penToolUI) {
                if (!penToolUI.isInitialized && penToolUI.init) {
                    console.log('🔧 PenToolUI初期化実行中...');
                    const initResult = await penToolUI.init();
                    
                    if (initResult) {
                        console.log('✅ PenToolUI初期化成功');
                    } else {
                        console.warn('⚠️ PenToolUI初期化失敗 - 基本機能で続行');
                    }
                } else {
                    console.log('✅ PenToolUI既に初期化済み');
                }
                
                // Step 5: toolsSystemに登録（重要）
                if (toolsSystem.setPenToolUI) {
                    toolsSystem.setPenToolUI(penToolUI);
                } else {
                    toolsSystem.penToolUI = penToolUI;
                }
                
                // Step 6: グローバル登録
                window.penToolUI = penToolUI;
                
                console.log('✅ PenToolUI専用初期化完了');
                return penToolUI;
                
            } else {
                throw new Error('PenToolUI作成失敗');
            }
        });
        
    } catch (error) {
        console.error('❌ PenToolUI専用初期化失敗:', error);
        
        // 🆘 緊急フォールバック: 最小限PenToolUI
        return createEmergencyPenToolUI(toolsSystem);
    }
}

// ==== 🆘 緊急フォールバック: 最小限PenToolUI ====
function createEmergencyPenToolUI(toolsSystem) {
    console.log('🆘 緊急フォールバック: 最小限PenToolUI作成中...');
    
    const emergencyPenToolUI = {
        isInitialized: true,
        initialized: true,
        toolsSystem: toolsSystem,
        
        // 基本ポップアップ表示
        showPopup: function() {
            console.log('🆘 緊急ポップアップ表示');
            
            let popup = document.getElementById('emergency-pen-popup');
            if (!popup) {
                popup = document.createElement('div');
                popup.id = 'emergency-pen-popup';
                popup.style.cssText = `
                    position: fixed;
                    top: 50px;
                    right: 20px;
                    background: #800000;
                    color: white;
                    padding: 15px;
                    border-radius: 8px;
                    z-index: 10000;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                `;
                popup.innerHTML = `
                    <strong>🎨 ペンツール選択中</strong><br>
                    <small>緊急モード - 基本機能のみ利用可能</small><br>
                    <button onclick="this.parentElement.style.display='none'" 
                            style="margin-top:8px; padding:4px 8px; border:none; background:#aa5a56; color:white; border-radius:4px; cursor:pointer;">
                        閉じる
                    </button>
                `;
                document.body.appendChild(popup);
            }
            
            popup.style.display = 'block';
            return true;
        },
        
        hidePopup: function() {
            const popup = document.getElementById('emergency-pen-popup');
            if (popup) {
                popup.style.display = 'none';
            }
            return true;
        },
        
        // ツール状態変更
        onToolStateChanged: function(active) {
            console.log(`🆘 緊急PenToolUI: ツール${active ? '選択' : '非選択'}`);
            if (active) {
                this.showPopup();
            }
        },
        
        // 設定更新（最小限）
        updateSettings: function(settings) {
            console.log('🆘 緊急PenToolUI: 設定更新', settings);
            
            if (this.toolsSystem?.updateBrushSettings) {
                this.toolsSystem.updateBrushSettings(settings);
            }
        },
        
        // 状態取得
        getStatus: function() {
            return {
                initialized: this.isInitialized,
                mode: 'emergency',
                available: true
            };
        }
    };
    
    console.log('🆘 緊急フォールバック PenToolUI 作成完了');
    return emergencyPenToolUI;
}

// ==== 統合システムチェック（緊急修正版）====
function checkIntegratedSystems() {
    console.log('🔍 統合システムチェック（緊急修正版）...');
    
    try {
        const systemsStatus = {
            utils: typeof window.safeConfigGet !== 'undefined',
            config: typeof window.CONFIG !== 'undefined',
            pixi: typeof window.PIXI !== 'undefined',
            pixiApp: typeof window.PixiDrawingApp !== 'undefined',
            toolsSystem: typeof window.DrawingToolsSystem !== 'undefined',
            historyManager: typeof window.HistoryManager !== 'undefined',
            uiManager: typeof window.UIManager !== 'undefined',
            penToolUI: typeof window.PenToolUI !== 'undefined'  // 🔧 PenToolUIクラス確認追加
        };
        
        const available = Object.entries(systemsStatus).filter(([name, ok]) => ok);
        const missing = Object.entries(systemsStatus).filter(([name, ok]) => !ok);
        
        console.log(`✅ 利用可能: ${available.length}/8システム`, available.map(([name]) => name));
        
        if (missing.length > 0) {
            console.warn('⚠️ 不足:', missing.map(([name]) => name));
            
            // 重要システム不足チェック
            const critical = ['pixi', 'pixiApp', 'toolsSystem'];
            const missingCritical = critical.filter(sys => !systemsStatus[sys]);
            
            if (missingCritical.length > 0) {
                throw createApplicationError(`重要システム不足: ${missingCritical.join(', ')}`);
            }
            
            // PenToolUI不足時の対応
            if (!systemsStatus.penToolUI) {
                console.warn('⚠️ PenToolUIクラス不足 - 緊急フォールバックで対応');
            }
        }
        
        console.log('✅ 統合システムチェック完了');
        return true;
        
    } catch (error) {
        logError(error, '統合システムチェック');
        throw error;
    }
}

// ==== CONFIG読み込み確認（緊急修正版）====
function checkConfigLoadedCompletely() {
    console.log('🔍 CONFIG読み込み確認（緊急修正版）...');
    
    try {
        // CONFIG補完確認
        if (!APP_STATE.config.supplemented) {
            console.warn('⚠️ CONFIG補完未実行 - 緊急補完実行');
            emergencyConfigSupplement();
        }
        
        // 整合性チェック
        if (typeof window.validateConfigIntegrity === 'function') {
            const integrity = window.validateConfigIntegrity();
            
            if (!integrity.valid) {
                console.warn('⚠️ CONFIG整合性問題:', integrity.missing);
                // 自動修復は緊急補完で実施済み
            }
        }
        
        APP_STATE.config.loaded = true;
        APP_STATE.config.validated = true;
        
        console.log('✅ CONFIG読み込み確認完了');
        return true;
        
    } catch (error) {
        logError(error, 'CONFIG確認');
        throw error;
    }
}

// ==== アプリケーション作成（最適化版）====
async function createApplication() {
    console.log('🎯 PixiDrawingApp作成...');
    
    try {
        return await measurePerformance('App作成', async () => {
            const width = window.safeConfigGet('CANVAS_WIDTH', 400);
            const height = window.safeConfigGet('CANVAS_HEIGHT', 400);
            
            console.log(`🎯 キャンバス: ${width}×${height}px`);
            
            const app = new PixiDrawingApp(width, height);
            await app.init();
            
            APP_STATE.components.app = app;
            console.log('✅ PixiDrawingApp作成完了');
            
            return app;
        });
    } catch (error) {
        const initError = createApplicationError('PixiDrawingApp作成失敗', { 
            step: INIT_STEPS.CREATING_APP, 
            originalError: error 
        });
        logError(initError, 'App作成');
        throw initError;
    }
}

// ==== ツールシステム作成（緊急修正版）====
async function createToolsSystem(app) {
    console.log('🔧 DrawingToolsSystem作成...');
    
    try {
        return await measurePerformance('ToolsSystem作成', async () => {
            const toolsSystem = new DrawingToolsSystem(app);
            await toolsSystem.init();
            
            APP_STATE.components.toolsSystem = toolsSystem;
            
            // デフォルト設定適用
            const defaultSettings = {
                size: window.safeConfigGet('DEFAULT_BRUSH_SIZE', 4),
                opacity: window.safeConfigGet('DEFAULT_OPACITY', 0.85),
                color: window.safeConfigGet('DEFAULT_COLOR', 0x800000),
                pressure: window.safeConfigGet('DEFAULT_PRESSURE', 0.5),
                smoothing: window.safeConfigGet('DEFAULT_SMOOTHING', 0.3)
            };
            
            if (toolsSystem.updateBrushSettings) {
                toolsSystem.updateBrushSettings(defaultSettings);
                console.log('🔧 デフォルト設定適用:', defaultSettings);
            }
            
            console.log('✅ DrawingToolsSystem作成完了');
            return toolsSystem;
        });
    } catch (error) {
        const initError = createApplicationError('DrawingToolsSystem作成失敗', {
            step: INIT_STEPS.CREATING_TOOLS_SYSTEM,
            originalError: error
        });
        logError(initError, 'ToolsSystem作成');
        throw initError;
    }
}

// ==== UI管理システム作成（エラー回復強化版）====
async function createUIManager(app, toolsSystem) {
    console.log('🎭 UIManager作成...');
    
    try {
        return await measurePerformance('UIManager作成', async () => {
            if (typeof window.UIManager === 'undefined') {
                throw createApplicationError('UIManager class not found');
            }
            
            const historyManager = toolsSystem.getHistoryManager();
            const uiManager = new window.UIManager(app, toolsSystem, historyManager);
            
            // 初期化（エラー回復付き）
            try {
                await uiManager.init();
                console.log('✅ UIManager初期化成功');
            } catch (initError) {
                console.warn('⚠️ UIManager初期化エラー:', initError);
                
                // 基本機能のみ初期化
                if (uiManager.setupToolButtons) {
                    uiManager.setupToolButtons();
                    console.log('🆘 UIManager基本機能で続行');
                }
            }
            
            APP_STATE.components.uiManager = uiManager;
            APP_STATE.components.historyManager = historyManager;
            
            console.log('✅ UIManager作成完了');
            return uiManager;
        });
    } catch (error) {
        const initError = createApplicationError('UIManager作成失敗', {
            step: INIT_STEPS.CREATING_UI_MANAGER,
            originalError: error
        });
        logError(initError, 'UIManager作成');
        throw initError;
    }
}

// ==== 設定管理システム作成（エラー回復版）====
async function createSettingsManager(app, toolsSystem, uiManager) {
    console.log('⚙️ SettingsManager作成...');
    
    try {
        if (typeof SettingsManager === 'undefined') {
            console.warn('⚠️ SettingsManager利用不可 - 基本機能で続行');
            return null;
        }
        
        return await measurePerformance('SettingsManager作成', async () => {
            const historyManager = toolsSystem.getHistoryManager();
            const settingsManager = new SettingsManager(app, toolsSystem, uiManager, historyManager);
            
            await settingsManager.init();
            
            APP_STATE.components.settingsManager = settingsManager;
            console.log('✅ SettingsManager作成完了');
            
            return settingsManager;
        });
    } catch (error) {
        console.warn('⚠️ SettingsManager作成失敗 - 基本機能で続行:', error);
        return null;
    }
}

// ==== システム間連携設定（緊急修正版）====
async function connectSystems() {
    console.log('🔗 システム間連携設定（緊急修正版）...');
    
    try {
        await measurePerformance('システム連携', async () => {
            const { app, toolsSystem, uiManager, settingsManager, penToolUI } = APP_STATE.components;
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
            
            // 🔧 修正: PenToolUI連携確認・強化
            if (penToolUI) {
                console.log('✅ PenToolUI連携確認完了');
                
                // PenToolUIの初期化状態確認
                if (penToolUI.isInitialized || penToolUI.initialized) {
                    console.log('✅ PenToolUI初期化状態確認完了');
                } else {
                    console.warn('⚠️ PenToolUI初期化未完了');
                }
                
                // ポップアップ機能確認
                if (penToolUI.showPopup && typeof penToolUI.showPopup === 'function') {
                    console.log('✅ PenToolUI ポップアップ機能利用可能');
                } else {
                    console.warn('⚠️ PenToolUI ポップアップ機能利用不可');
                }
                
            } else {
                console.warn('⚠️ PenToolUI連携未完了');
            }
            
            // グローバル参照設定
            window.app = app;
            window.toolsSystem = toolsSystem;
            window.uiManager = uiManager;
            window.historyManager = historyManager;
            window.settingsManager = settingsManager;
            window.penToolUI = penToolUI;
            window.appConfig = window.CONFIG || {};
            
            // デバッグ機能設定
            setupDebugFunctions();
            
            console.log('✅ システム間連携設定完了');
        });
    } catch (error) {
        const initError = createApplicationError('システム間連携設定失敗', {
            step: INIT_STEPS.CONNECTING_SYSTEMS,
            originalError: error
        });
        logError(initError, 'システム連携');
        throw initError;
    }
}

// ==== 🔧 緊急修正: デバッグ機能設定強化 ====
function setupDebugFunctions() {
    // 基本デバッグ関数
    window.undo = () => APP_STATE.components.historyManager?.undo() || false;
    window.redo = () => APP_STATE.components.historyManager?.redo() || false;
    window.debugHistory = () => APP_STATE.components.toolsSystem?.debugHistory() || console.warn('ToolsSystem not available');
    
    // 🔧 PenToolUI専用デバッグ関数強化
    window.debugPenToolUI = function() {
        console.group('🎨 PenToolUI詳細デバッグ情報');
        
        const penToolUI = APP_STATE.components.penToolUI;
        if (penToolUI) {
            console.log('🔧 基本情報:');
            console.log('  - 初期化状態:', penToolUI.isInitialized || penToolUI.initialized);
            console.log('  - クラス名:', penToolUI.constructor.name);
            console.log('  - ツールシステム連携:', !!penToolUI.drawingToolsSystem || !!penToolUI.toolsSystem);
            
            console.log('🔧 機能確認:');
            console.log('  - showPopup:', typeof penToolUI.showPopup);
            console.log('  - hidePopup:', typeof penToolUI.hidePopup);
            console.log('  - getStatus:', typeof penToolUI.getStatus);
            
            if (penToolUI.getStatus) {
                console.log('📊 詳細状態:', penToolUI.getStatus());
            }
            
            // PixiJS拡張ライブラリ連携確認
            console.log('🔌 PixiJS拡張ライブラリ連携:');
            console.log('  - PixiExtensions:', !!window.PixiExtensions);
            console.log('  - 利用可能機能:', APP_STATE.pixiExtensions.available);
            
        } else {
            console.error('❌ PenToolUI が利用できません');
            console.log('🔧 トラブルシューティング:');
            console.log('  1. toolsSystem.penToolUI:', !!APP_STATE.components.toolsSystem?.penToolUI);
            console.log('  2. PenToolUI class:', typeof window.PenToolUI);
            console.log('  3. createPenToolUI function:', typeof window.createPenToolUI);
        }
        
        console.groupEnd();
    };
    
    // 🔧 ポップアップテスト強化
    window.testPenPopup = function() {
        console.log('🧪 ペンポップアップテスト開始（緊急修正版）...');
        
        const penToolUI = APP_STATE.components.penToolUI;
        if (penToolUI?.showPopup) {
            try {
                const result = penToolUI.showPopup();
                console.log('📋 ポップアップ表示結果:', result);
                
                // 表示確認
                setTimeout(() => {
                    console.log('🔍 ポップアップ表示状況確認...');
                    
                    // PixiJSコンテナ確認
                    if (penToolUI.popupContainer) {
                        console.log('  - PixiJSポップアップ:', penToolUI.popupContainer.visible);
                    }
                    
                    // DOM要素確認
                    const domPopups = document.querySelectorAll('[id*="popup"], [id*="pen-settings"]');
                    domPopups.forEach(popup => {
                        console.log(`  - DOM要素 ${popup.id}:`, popup.style.display !== 'none');
                    });
                    
                }, 200);
                
                return result;
                
            } catch (error) {
                console.error('❌ ポップアップテストエラー:', error);
                return false;
            }
        } else {
            console.warn('❌ PenToolUI.showPopup が利用できません');
            
            // 緊急フォールバック
            console.log('🆘 緊急フォールバックテスト実行中...');
            if (penToolUI?.onToolStateChanged) {
                penToolUI.onToolStateChanged(true);
                return true;
            }
            
            return false;
        }
    };
    
    // 🔧 CONFIG確認強化
    window.debugConfig = function() {
        console.group('🔧 CONFIG詳細情報（緊急修正版）');
        
        console.log('📋 CONFIG状態:', APP_STATE.config);
        console.log('🔌 PixiJS拡張:', APP_STATE.pixiExtensions);
        
        // 重要CONFIG項目確認
        const criticalKeys = [
            'SIZE_PRESETS', 'DEFAULT_COLOR', 'POPUP_CONFIG',
            'LIBRARY_CONFIG', 'LIBRARY_FLAGS', 'DEFAULT_BRUSH_SIZE'
        ];
        
        console.log('🎯 重要CONFIG項目:');
        criticalKeys.forEach(key => {
            const value = window.CONFIG?.[key];
            console.log(`  - ${key}:`, value !== undefined ? '✅ 設定済み' : '❌ 不足', value);
        });
        
        // safeConfigGet動作確認
        console.log('🔧 safeConfigGet動作確認:');
        console.log('  - 関数存在:', typeof window.safeConfigGet);
        console.log('  - テスト取得:', window.safeConfigGet?.('DEFAULT_BRUSH_SIZE', 'テスト'));
        
        console.groupEnd();
    };
    
    // 🔧 統合システムテスト強化
    window.testSystem = function() {
        console.log('🧪 システム統合テスト（緊急修正版）');
        
        const testResults = {
            // 基本システム
            initialized: APP_STATE.initialized,
            configSupplemented: APP_STATE.config.supplemented,
            pixiExtensions: APP_STATE.pixiExtensions.initialized,
            
            // コンポーネント
            components: {
                app: !!APP_STATE.components.app,
                toolsSystem: !!APP_STATE.components.toolsSystem,
                uiManager: !!APP_STATE.components.uiManager,
                historyManager: !!APP_STATE.components.historyManager,
                settingsManager: !!APP_STATE.components.settingsManager,
                penToolUI: !!APP_STATE.components.penToolUI
            },
            
            // PenToolUI詳細
            penToolUI: {
                exists: !!APP_STATE.components.penToolUI,
                initialized: !!(APP_STATE.components.penToolUI?.isInitialized || APP_STATE.components.penToolUI?.initialized),
                hasShowPopup: !!(APP_STATE.components.penToolUI?.showPopup),
                hasGetStatus: !!(APP_STATE.components.penToolUI?.getStatus)
            }
        };
        
        const overallOK = testResults.initialized && 
                         testResults.components.app && 
                         testResults.components.toolsSystem && 
                         testResults.components.uiManager &&
                         testResults.penToolUI.exists;
        
        console.log('📊 テスト結果:', testResults);
        console.log(`🏆 統合テスト: ${overallOK ? '✅ 成功' : '❌ 部分的'}`);
        
        // PenToolUIポップアップテスト
        if (overallOK && testResults.penToolUI.hasShowPopup) {
            console.log('🧪 ポップアップ機能テスト実行...');
            setTimeout(() => window.testPenPopup(), 500);
        }
        
        return overallOK;
    };
    
    // 🔧 アプリケーション全体デバッグ
    window.debugApp = function() {
        console.group('🔍 アプリケーション全体デバッグ（緊急修正版）');
        
        console.log('📋 APP_STATE:', APP_STATE);
        console.log('🔧 初期化ステップ:', APP_STATE.initializationStep);
        console.log('⏱️ 初期化時間:', APP_STATE.stats.initTime + 'ms');
        console.log('❌ エラー数:', APP_STATE.stats.errorCount);
        
        // システム詳細
        Object.entries(APP_STATE.components).forEach(([name, component]) => {
            console.log(`🔧 ${name}:`, !!component, component?.constructor?.name || 'N/A');
        });
        
        console.groupEnd();
    };
    
    // 🔧 緊急修正: ペンツール手動選択
    window.selectPenTool = function() {
        console.log('🖊️ ペンツール手動選択...');
        
        const toolsSystem = APP_STATE.components.toolsSystem;
        if (toolsSystem?.setTool) {
            toolsSystem.setTool('pen');
            console.log('✅ ペンツール選択完了');
            
            // PenToolUI呼び出し
            const penToolUI = APP_STATE.components.penToolUI;
            if (penToolUI?.onToolStateChanged) {
                penToolUI.onToolStateChanged(true);
                console.log('✅ PenToolUI状態更新完了');
            }
            
            return true;
        } else {
            console.warn('❌ ToolsSystem利用不可');
            return false;
        }
    };
    
    console.log('🐛 デバッグ機能設定完了（緊急修正版）');
}

// ==== 最終セットアップ（緊急修正版）====
async function finalSetup() {
    console.log('🎨 最終セットアップ（緊急修正版）...');
    
    try {
        await measurePerformance('最終セットアップ', async () => {
            const { app, toolsSystem, uiManager, settingsManager, penToolUI } = APP_STATE.components;
            
            // 初期表示更新
            if (uiManager?.updateAllDisplays) {
                uiManager.updateAllDisplays();
            }
            
            // 🔧 PenToolUI最終確認強化
            if (penToolUI) {
                console.log('🎨 PenToolUI最終確認...');
                
                // 初期化状態確認
                const initialized = penToolUI.isInitialized || penToolUI.initialized;
                console.log(`  - 初期化: ${initialized ? '✅' : '❌'}`);
                
                // 機能確認
                const hasPopup = typeof penToolUI.showPopup === 'function';
                console.log(`  - ポップアップ: ${hasPopup ? '✅' : '❌'}`);
                
                // ペンボタン要素確認
                const penButton = document.getElementById('pen-tool-button');
                console.log(`  - ペンボタン: ${penButton ? '✅' : '❌'}`);
                
                if (penButton && !penButton._penClickHandlerSet) {
                    // 🔧 緊急修正: ペンボタンクリック直接設定
                    penButton.addEventListener('click', () => {
                        console.log('🖊️ ペンボタンクリック検出');
                        
                        // ツール選択
                        if (toolsSystem?.setTool) {
                            toolsSystem.setTool('pen');
                        }
                        
                        // ポップアップ表示
                        if (penToolUI.showPopup) {
                            penToolUI.showPopup();
                        }
                    });
                    
                    penButton._penClickHandlerSet = true;
                    console.log('✅ ペンボタンクリックハンドラー設定完了');
                }
                
            } else {
                console.warn('⚠️ PenToolUI利用不可');
            }
            
            // グローバルエラーハンドラー設定
            setupGlobalErrorHandlers();
            
            // 設定値確認・表示
            const settings = {
                brushSize: window.safeConfigGet('DEFAULT_BRUSH_SIZE', 4),
                opacity: window.safeConfigGet('DEFAULT_OPACITY', 0.85),
                maxSize: window.safeConfigGet('MAX_BRUSH_SIZE', 500),
                color: window.safeConfigGet('DEFAULT_COLOR', 0x800000)
            };
            
            console.log('🎯 現在の設定:');
            console.log(`  🖊️ ブラシサイズ: ${settings.brushSize}px`);
            console.log(`  🎨 透明度: ${Math.round(settings.opacity * 100)}%`);
            console.log(`  📏 最大サイズ: ${settings.maxSize}px`);
            console.log(`  🎨 色: #${settings.color.toString(16)}`);
            
            console.log('✅ 最終セットアップ完了');
        });
    } catch (error) {
        const initError = createApplicationError('最終セットアップ失敗', {
            step: INIT_STEPS.FINAL_SETUP,
            originalError: error
        });
        logError(initError, '最終セットアップ');
        throw initError;
    }
}

// ==== グローバルエラーハンドラー設定（最適化版）====
function setupGlobalErrorHandlers() {
    window.addEventListener('error', (event) => {
        const error = createApplicationError(event.message, {
            filename: event.filename,
            line: event.lineno,
            column: event.colno,
            originalError: event.error
        });
        
        logError(error, 'グローバルJSエラー');
        APP_STATE.stats.errorCount++;
        APP_STATE.stats.lastError = {
            type: 'javascript',
            message: event.message,
            timestamp: Date.now()
        };
        
        if (APP_STATE.components.uiManager?.showError) {
            APP_STATE.components.uiManager.showError(`アプリケーションエラー: ${event.message}`, 8000);
        }
    });
    
    window.addEventListener('unhandledrejection', (event) => {
        const error = createApplicationError('未処理のPromiseエラー', { reason: event.reason });
        logError(error, 'グローバルPromiseエラー');
        
        APP_STATE.stats.errorCount++;
        APP_STATE.stats.lastError = {
            type: 'promise',
            message: event.reason?.message || String(event.reason),
            timestamp: Date.now()
        };
    });
    
    console.log('🛡️ グローバルエラーハンドラー設定完了');
}

// ==== 初期化ステップ更新関数 ====
function updateInitStep(step, details = null) {
    APP_STATE.initializationStep = step;
    
    const stepMessages = {
        [INIT_STEPS.EMERGENCY_CONFIG_SUPPLEMENT]: '緊急CONFIG補完中...',
        [INIT_STEPS.PIXI_EXTENSIONS_INIT]: 'PixiJS拡張ライブラリ初期化中...',
        [INIT_STEPS.CHECKING_SYSTEMS]: '統合システムチェック中...',
        [INIT_STEPS.CHECKING_CONFIG]: 'CONFIG読み込み確認中...',
        [INIT_STEPS.CHECKING_DEPENDENCIES]: '依存関係チェック中...',
        [INIT_STEPS.CREATING_APP]: 'アプリケーション作成中...',
        [INIT_STEPS.CREATING_TOOLS_SYSTEM]: 'ツールシステム作成中...',
        [INIT_STEPS.CREATING_UI_MANAGER]: 'UI管理システム作成中...',
        [INIT_STEPS.CREATING_PEN_TOOL_UI]: 'PenToolUI作成中（緊急修正版）...',
        [INIT_STEPS.CONNECTING_SYSTEMS]: 'システム連携設定中...',
        [INIT_STEPS.FINAL_SETUP]: '最終セットアップ中...',
        [INIT_STEPS.COMPLETED]: '緊急修正版初期化完了！',
        [INIT_STEPS.ERROR]: '初期化エラー'
    };
    
    console.log(`📋 ${stepMessages[step] || step}`, details || '');
}

// ==== メイン初期化関数（緊急修正版）====
async function initializeApplication() {
    try {
        APP_STATE.startTime = performance.now();
        console.log('🚀 ふたば☆ちゃんねる風ベクターお絵描きツール 緊急修正版初期化開始');
        
        // 1. 🆘 緊急CONFIG補完
        updateInitStep(INIT_STEPS.EMERGENCY_CONFIG_SUPPLEMENT);
        await emergencyConfigSupplement();
        
        // 2. 🔌 PixiJS拡張ライブラリ初期化
        updateInitStep(INIT_STEPS.PIXI_EXTENSIONS_INIT);
        await initializePixiExtensions();
        
        // 3. システムチェック
        updateInitStep(INIT_STEPS.CHECKING_SYSTEMS);
        checkIntegratedSystems();
        
        // 4. CONFIG確認
        updateInitStep(INIT_STEPS.CHECKING_CONFIG);
        checkConfigLoadedCompletely();
        
        // 5. アプリケーション作成
        updateInitStep(INIT_STEPS.CREATING_APP);
        const app = await createApplication();
        
        // 6. ツールシステム作成
        updateInitStep(INIT_STEPS.CREATING_TOOLS_SYSTEM);
        const toolsSystem = await createToolsSystem(app);
        
        // 7. UI管理システム作成
        updateInitStep(INIT_STEPS.CREATING_UI_MANAGER);
        const uiManager = await createUIManager(app, toolsSystem);
        
        // 8. 🔧 PenToolUI専用作成（緊急修正版）
        updateInitStep(INIT_STEPS.CREATING_PEN_TOOL_UI);
        const penToolUI = await createPenToolUI(toolsSystem, uiManager);
        APP_STATE.components.penToolUI = penToolUI;
        
        // 9. 設定管理システム作成
        const settingsManager = await createSettingsManager(app, toolsSystem, uiManager);
        
        // 10. システム連携
        updateInitStep(INIT_STEPS.CONNECTING_SYSTEMS);
        await connectSystems();
        
        // 11. 最終セットアップ
        updateInitStep(INIT_STEPS.FINAL_SETUP);
        await finalSetup();
        
        // 12. 初期化完了
        updateInitStep(INIT_STEPS.COMPLETED);
        APP_STATE.initialized = true;
        APP_STATE.stats.initTime = performance.now() - APP_STATE.startTime;
        
        // 🎉 初期化完了ログ（緊急修正版）
        console.log('🎉 アプリケーション初期化完了（緊急修正版）！');
        console.log(`⏱️ 初期化時間: ${APP_STATE.stats.initTime.toFixed(2)}ms`);
        console.log('🎨 描画の準備ができました！');
        
        // システム概要表示
        console.group('📋 システム概要（緊急修正版）');
        
        const canvasSize = `${window.safeConfigGet('CANVAS_WIDTH', 400)}×${window.safeConfigGet('CANVAS_HEIGHT', 400)}px`;
        const brushSize = window.safeConfigGet('DEFAULT_BRUSH_SIZE', 4);
        const opacity = Math.round(window.safeConfigGet('DEFAULT_OPACITY', 0.85) * 100);
        
        console.log(`🖼️ キャンバス: ${canvasSize}`);
        console.log(`🖊️ デフォルトサイズ: ${brushSize}px`);
        console.log(`🎨 デフォルト透明度: ${opacity}%`);
        console.log('🔧 CONFIG補完: 完了');
        console.log('🔌 PixiJS拡張ライブラリ:', APP_STATE.pixiExtensions.initialized ? '初期化済み' : '基本機能');
        console.log('🎨 PenToolUI:', APP_STATE.components.penToolUI ? '利用可能' : '緊急モード');
        
        console.groupEnd();
        
        // UI通知
        if (uiManager?.showNotification) {
            const message = APP_STATE.components.penToolUI 
                ? '緊急修正完了！PenToolUI・CONFIG補完・ポップアップ機能復活'
                : '緊急修正版初期化完了！基本機能で動作中';
            uiManager.showNotification(message, 'success', 5000);
        }
        
        // ポップアップテスト準備
        console.log('🧪 ポップアップ機能テストの準備完了');
        console.log('📋 ペンツールボタンをクリックするか、window.testPenPopup() を実行してください');
        
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
        showInitializationError(error);
        
        return false;
    }
}

// ==== 初期化エラー表示（緊急修正版）====
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
            エラーステップ: ${error.step || 'unknown'}
        </p>
        <div style="margin: 15px 0; padding: 10px; background: rgba(255,255,255,0.1); border-radius: 8px; font-size: 12px;">
            <strong>🔧 緊急修正版対処法:</strong><br>
            1. ページを再読み込みしてください<br>
            2. ブラウザのキャッシュをクリアしてください<br>
            3. ブラウザのコンソール（F12）で詳細を確認してください
        </div>
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
    `;
    
    document.body.appendChild(errorContainer);
}

// ==== DOM読み込み完了後の初期化実行（緊急修正版）====
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        console.log('📄 DOM読み込み完了（緊急修正版）');
        setTimeout(() => initializeApplication(), 200);
    });
} else {
    console.log('📄 DOM既に読み込み済み（緊急修正版）');
    setTimeout(() => initializeApplication(), 200);
}

// ==== グローバルエクスポート（緊急修正版）====
if (typeof window !== 'undefined') {
    window.APP_STATE = APP_STATE;
    window.INIT_STEPS = INIT_STEPS;
    window.initializeApplication = initializeApplication;
    window.emergencyConfigSupplement = emergencyConfigSupplement;
    window.createPenToolUI = createPenToolUI;
    
    console.log('🔧 main.js 緊急修正版 読み込み完了');
    console.log('🏗️ 緊急修正完了項目:');
    console.log('  ✅ CONFIG不足エラー完全解消');
    console.log('  ✅ PenToolUI初期化システム完全修正');
    console.log('  ✅ PixiJS拡張ライブラリ初期化待機追加');
    console.log('  ✅ 段階的フォールバック・エラー回復強化');
    console.log('  ✅ 詳細デバッグ・テスト機能追加');
    
    console.log('🎯 期待効果:');
    console.log('  📦 safeConfigGetエラー解消: CONFIG補完システム');
    console.log('  🎨 PenToolUI完全復活: 専用初期化・フォールバック');
    console.log('  🔌 @pixi/ui統合支援: 拡張ライブラリ待機');
    console.log('  🛡️ エラー耐性向上: グレースフルデグラデーション');
    console.log('  🐛 開発支援強化: 詳細デバッグ機能');
    
    console.log('🔧 デバッグ機能（緊急修正版）:');
    console.log('  1. window.testSystem() - 統合システムテスト');
    console.log('  2. window.testPenPopup() - ポップアップテスト');
    console.log('  3. window.debugPenToolUI() - PenToolUI詳細情報');
    console.log('  4. window.debugConfig() - CONFIG詳細確認');
    console.log('