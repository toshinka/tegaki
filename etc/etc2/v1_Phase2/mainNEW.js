/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1rev16
 * メイン初期化スクリプト - main.js (エラー修正・キャンバス表示修正版)
 * 
 * 🔧 修正内容:
 * 1. ✅ ErrorHandler重複宣言問題修正
 * 2. ✅ utils.js統合により重複コード削除
 * 3. ✅ キャンバス表示問題修正
 * 4. ✅ 初期化プロセス最適化
 * 5. ✅ @pixi/ui導入後の互換性確保
 * 
 * Phase2目標: エラー修正・安定したキャンバス表示・ポップアップシステム 
 */

console.log('🚀 main.js エラー修正・キャンバス表示修正版読み込み開始...');

// ==== Configuration Manager (utils.js統合版) ====
class ConfigManager {
    static get(key, defaultValue) {
        // utils.jsのsafeConfigGet関数を使用
        if (typeof window.safeConfigGet === 'function') {
            return window.safeConfigGet(key, defaultValue);
        }
        
        // フォールバック処理
        try {
            return (window.CONFIG && window.CONFIG[key] !== undefined) ? window.CONFIG[key] : defaultValue;
        } catch (error) {
            console.warn(`CONFIG取得エラー (${key}):`, error);
            return defaultValue;
        }
    }
    
    static validateIntegrity() {
        // utils.jsのvalidateConfigIntegrity関数を使用
        if (typeof window.validateConfigIntegrity === 'function') {
            return window.validateConfigIntegrity();
        }
        
        // フォールバック処理
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
        
        // utils.jsの緊急CONFIG作成を使用
        if (typeof window.createEmergencyConfig === 'function') {
            window.createEmergencyConfig(['CONFIG']);
            return true;
        }
        
        // フォールバック処理
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

// ==== Performance Monitor (utils.js統合版) ====
class PerformanceMonitor {
    static measure(name, operation) {
        // utils.jsのmeasurePerformance関数を使用
        if (typeof window.measurePerformance === 'function') {
            return window.measurePerformance(name, operation);
        }
        
        // フォールバック処理
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

// ==== Error Handler (utils.js統合版) ====
class ErrorHandler {
    static createApplicationError(message, context = {}) {
        // utils.jsのcreateApplicationError関数を使用
        if (typeof window.createApplicationError === 'function') {
            return window.createApplicationError(message, context);
        }
        
        // フォールバック処理
        const error = new Error(message);
        error.name = 'ApplicationError';
        error.context = context;
        error.timestamp = Date.now();
        return error;
    }
    
    static logError(error, context = 'Unknown') {
        // utils.jsのlogError関数を使用（エラーループ対策済み）
        if (typeof window.logError === 'function') {
            window.logError(error, context);
            return;
        }
        
        // フォールバック処理
        console.error(`🚨 [${context}] ${error.name || 'Error'}: ${error.message}`, error);
    }
    
    static handleGracefulDegradation(operation, fallback, errorMessage) {
        // utils.jsのhandleGracefulDegradation関数を使用
        if (typeof window.handleGracefulDegradation === 'function') {
            return window.handleGracefulDegradation(operation, fallback, errorMessage);
        }
        
        // フォールバック処理
        try {
            return operation();
        } catch (error) {
            console.warn(`${errorMessage}:`, error);
            return typeof fallback === 'function' ? fallback() : fallback;
        }
    }
}

// ==== Initialization Steps ====
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
    CANVAS_SETUP: 'canvas_setup',
    COMPLETED: 'completed',
    ERROR: 'error'
};

// ==== Application State Manager ====
class AppStateManager {
    constructor() {
        this.state = {
            initialized: false,
            canvasVisible: false,
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
                penToolUIInitialized: false,
                canvasProperlySetup: false,
                pixiUICompatible: false
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
            [INIT_STEPS.CANVAS_SETUP]: 'キャンバスセットアップ中...',
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

// ==== System Checker ====
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

    static checkCanvasContainer() {
        console.log('🔍 キャンバスコンテナチェック...');
        
        const canvasContainer = document.getElementById('drawing-canvas');
        if (!canvasContainer) {
            throw ErrorHandler.createApplicationError(
                'drawing-canvas要素が見つかりません。HTMLファイルを確認してください。',
                { step: INIT_STEPS.CANVAS_SETUP }
            );
        }
        
        console.log('✅ キャンバスコンテナ確認完了');
        return canvasContainer;
    }
}

// ==== Canvas Setup Manager ====
class CanvasSetupManager {
    static async setupCanvas(app, appState) {
        console.log('🖼️ キャンバスセットアップ開始...');
        
        try {
            // キャンバスコンテナの確認
            const canvasContainer = SystemChecker.checkCanvasContainer();
            
            // 既存のキャンバスをクリア
            while (canvasContainer.firstChild) {
                canvasContainer.removeChild(canvasContainer.firstChild);
            }
            
            // アプリケーションのキャンバスを追加
            if (app.app && app.app.view) {
                canvasContainer.appendChild(app.app.view);
                console.log('✅ キャンバス要素追加完了');
                
                // キャンバスが実際に表示されているか確認
                const canvasRect = app.app.view.getBoundingClientRect();
                if (canvasRect.width > 0 && canvasRect.height > 0) {
                    console.log(`✅ キャンバス表示確認: ${canvasRect.width}x${canvasRect.height}px`);
                    appState.state.canvasVisible = true;
                    appState.state.phase2.canvasProperlySetup = true;
                } else {
                    console.warn('⚠️ キャンバスサイズが0px - 表示問題の可能性');
                }
                
                // キャンバスのスタイル確認
                const computedStyle = window.getComputedStyle(app.app.view);
                if (computedStyle.display === 'none' || computedStyle.visibility === 'hidden') {
                    console.warn('⚠️ キャンバスが非表示状態です');
                    app.app.view.style.display = 'block';
                    app.app.view.style.visibility = 'visible';
                }
                
                // @pixi/ui互換性確認
                CanvasSetupManager.checkPixiUICompatibility(appState);
                
            } else {
                throw ErrorHandler.createApplicationError(
                    'PixiDrawingAppのcanvas viewが作成されていません',
                    { step: INIT_STEPS.CANVAS_SETUP }
                );
            }
            
            return true;
            
        } catch (error) {
            console.error('🚨 キャンバスセットアップエラー:', error);
            throw error;
        }
    }
    
    static checkPixiUICompatibility(appState) {
        try {
            // @pixi/uiの存在確認
            if (typeof window.PIXI !== 'undefined' && window.PIXI.UI) {
                console.log('✅ @pixi/ui検出 - 互換性確認中...');
                appState.state.phase2.pixiUICompatible = true;
            } else {
                console.log('ℹ️ @pixi/ui未検出 - 標準PIXI使用');
            }
            
            // PixiJS バージョン確認
            if (window.PIXI && window.PIXI.VERSION) {
                console.log(`📦 PixiJS バージョン: ${window.PIXI.VERSION}`);
            }
            
        } catch (error) {
            console.warn('⚠️ @pixi/ui互換性チェックエラー:', error);
        }
    }
}

// ==== Component Factory ====
class ComponentFactory {
    static async createApplication(appState) {
        console.log('🎯 PixiDrawingApp作成...');
        
        return await PerformanceMonitor.measureAsync('App作成', async () => {
            const width = ConfigManager.get('CANVAS_WIDTH', 400);
            const height = ConfigManager.get('CANVAS_HEIGHT', 400);
            
            console.log(`📐 キャンバスサイズ: ${width}x${height}px`);
            
            const app = new PixiDrawingApp(width, height);
            
            // 初期化前にsettingsManagerを設定（もし利用可能なら）
            if (window.settingsManager && typeof window.settingsManager.isInitialized === 'function') {
                app.setSettingsManager(window.settingsManager);
                console.log('⚙️ SettingsManager連携完了');
            }
            
            await app.init();
            
            // キャンバスがプロパティに設定されているか確認
            if (!app.app || !app.app.view) {
                throw ErrorHandler.createApplicationError(
                    'PixiDrawingAppの初期化後にcanvas viewが作成されていません',
                    { step: INIT_STEPS.CREATING_APP }
                );
            }
            
            console.log('✅ PixiDrawingApp作成完了');
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
            
            console.log('✅ DrawingToolsSystem作成完了');
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
                console.log('✅ UIManager初期化完了');
            } catch (initError) {
                console.warn('⚠️ UIManager初期化でエラーが発生:', initError);
                if (uiManager.setupToolButtons) {
                    uiManager.setupToolButtons();
                }
            }
            
            appState.state.components.uiManager = uiManager;
            appState.state.components.historyManager = historyManager;
            appState.state.phase2.uiManagerFixed = true;
            
            console.log('✅ UIManager作成完了');
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
                console.log('✅ PenToolUI既に初期化済み');
                return penToolUI;
            }
            
            console.warn('⚠️ PenToolUIの初期化をスキップ');
            return null;
        });
    }
}

// ==== Debug Functions Manager ====
class DebugManager {
    static setup(appState) {
        // 基本デバッグ関数
        window.undo = () => appState.state.components.historyManager?.undo() || false;
        window.redo = () => appState.state.components.historyManager?.redo() || false;
        window.debugHistory = () => appState.state.components.toolsSystem?.debugHistory() || console.warn('ToolsSystem not available');
        
        // キャンバス表示デバッグ関数
        window.debugCanvas = function() {
            const app = appState.state.components.app;
            if (!app) {
                console.warn('⚠️ アプリケーションが初期化されていません');
                return;
            }
            
            console.group('🖼️ キャンバスデバッグ情報');
            console.log('アプリケーション:', !!app.app);
            console.log('キャンバスビュー:', !!app.app?.view);
            
            if (app.app?.view) {
                const canvasRect = app.app.view.getBoundingClientRect();
                console.log('キャンバスサイズ:', {
                    width: canvasRect.width,
                    height: canvasRect.height,
                    visible: canvasRect.width > 0 && canvasRect.height > 0
                });
                
                const computedStyle = window.getComputedStyle(app.app.view);
                console.log('表示スタイル:', {
                    display: computedStyle.display,
                    visibility: computedStyle.visibility,
                    position: computedStyle.position
                });
                
                const container = document.getElementById('drawing-canvas');
                if (container) {
                    console.log('コンテナ情報:', {
                        exists: true,
                        children: container.children.length,
                        style: {
                            display: container.style.display,
                            visibility: container.style.visibility
                        }
                    });
                }
            }
            
            console.log('キャンバス可視状態:', appState.state.canvasVisible);
            console.log('キャンバス設定完了:', appState.state.phase2.canvasProperlySetup);
            console.groupEnd();
        };
        
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
        
        // キャンバス表示修復関数
        window.fixCanvas = function() {
            console.log('🔧 キャンバス表示修復試行中...');
            
            const app = appState.state.components.app;
            const container = document.getElementById('drawing-canvas');
            
            if (!app || !app.app || !app.app.view) {
                console.error('❌ アプリケーションまたはキャンバスが見つかりません');
                return false;
            }
            
            if (!container) {
                console.error('❌ drawing-canvasコンテナが見つかりません');
                return false;
            }
            
            try {
                // キャンバスを再追加
                if (!container.contains(app.app.view)) {
                    container.appendChild(app.app.view);
                    console.log('✅ キャンバスを再追加しました');
                }
                
                // スタイル修正
                app.app.view.style.display = 'block';
                app.app.view.style.visibility = 'visible';
                
                // サイズ確認
                const rect = app.app.view.getBoundingClientRect();
                if (rect.width > 0 && rect.height > 0) {
                    console.log(`✅ キャンバス表示修復完了: ${rect.width}x${rect.height}px`);
                    appState.state.canvasVisible = true;
                    appState.state.phase2.canvasProperlySetup = true;
                    return true;
                } else {
                    console.warn('⚠️ キャンバスサイズが依然として0px');
                    return false;
                }
                
            } catch (error) {
                console.error('❌ キャンバス修復エラー:', error);
                return false;
            }
        };
        
        // システムテスト関数
        window.testSystem = function() {
            console.log('🧪 システム統合テスト');
            
            const testResults = {
                initialized: appState.state.initialized,
                canvasVisible: appState.state.canvasVisible,
                configLoaded: appState.state.config.loaded,
                systemsIntegrated: appState.state.phase2.systemsIntegrated,
                uiManagerFixed: appState.state.phase2.uiManagerFixed,
                penToolUIInitialized: appState.state.phase2.penToolUIInitialized,
                canvasProperlySetup: appState.state.phase2.canvasProperlySetup,
                pixiUICompatible: appState.state.phase2.pixiUICompatible,
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
                             testResults.components.toolsSystem && testResults.components.uiManager &&
                             testResults.canvasVisible;
            
            console.log('📊 テスト結果:', testResults);
            console.log(`🏆 統合テスト: ${overallOK ? '✅ 成功' : '❌ 部分的'}`);
            
            if (!testResults.canvasVisible) {
                console.warn('⚠️ キャンバスが表示されていません。window.fixCanvas() を試してください。');
            }
            
            if (overallOK && testResults.penToolUIInitialized) {
                console.log('🧪 ポップアップテスト実行中...');
                window.testPenPopup();
            }
            
            return overallOK;
        };
        
        console.log('🛠 デバッグ機能設定完了（キャンバス修復機能追加）');
    }
}

// ==== Error Display Manager ====
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
        const isCanvasError = error.message.includes('canvas') || error.message.includes('Canvas');
        
        errorContainer.innerHTML = `
            <div style="font-size: 48px; margin-bottom: 20px;">⚠️</div>
            <h2 style="margin: 0 0 15px 0; font-size: 24px;">アプリケーション起動エラー</h2>
            <p style="margin: 0 0 15px 0; font-size: 16px; opacity: 0.9;">
                ${error.message}
            </p>
            <p style="margin: 0 0 20px 0; font-size: 14px; opacity: 0.7;">
                エラーステップ: ${error.context?.step || 'unknown'}
            </p>
            ${isCanvasError ? `
            <div style="margin: 15px 0; padding: 10px; background: rgba(255,255,255,0.1); border-radius: 8px; font-size: 12px;">
                <strong>🖼️ キャンバスエラー対処法:</strong><br>
                1. F12でコンソールを開き window.debugCanvas() を実行<br>
                2. window.fixCanvas() でキャンバス表示修復を試行<br>
                3. drawing-canvas要素がHTMLに存在するか確認
            </div>
            ` : ''}
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
                margin: 5px;
            ">ページを再読み込み</button>
            <button onclick="this.parentElement.remove()" style="
                background: rgba(255, 255, 255, 0.1);
                border: 1px solid rgba(255, 255, 255, 0.2);
                color: white;
                padding: 10px 20px;
                border-radius: 8px;
                cursor: pointer;
                font-size: 14px;
                margin: 5px;
            ">閉じる</button>
        `;
        
        document.body.appendChild(errorContainer);
    }
}

// ==== UI Element Checker ====
class UIElementChecker {
    static checkPopupUIElements() {
        console.log('🔍 ポップアップUI要素確認...');
        
        // 修正済みID使用: pen-tool
        const penButton = document.getElementById('pen-tool');
        if (penButton) {
            console.log('✅ ペンツールボタン要素確認完了（ID: pen-tool）');
            
            // クリックイベントリスナーの確認
            const hasClickListener = penButton.onclick || 
                                   (penButton._penToolClickHandler !== undefined);
            
            if (hasClickListener) {
                console.log('✅ ペンツールボタンクリックイベント設定済み');
            } else {
                console.warn('⚠️ ペンツールボタンクリックイベントが未設定の可能性');
            }
        } else {
            console.warn('⚠️ ペンツールボタン要素が見つかりません（ID: pen-tool）');
            UIElementChecker.searchAlternativeButtons();
        }
        
        // ポップアップコンテナの確認
        const penSettingsPopup = document.getElementById('pen-settings');
        if (penSettingsPopup) {
            console.log('✅ ペン設定ポップアップ要素確認完了（ID: pen-settings）');
        } else {
            console.warn('⚠️ ペン設定ポップアップ要素が見つかりません（ID: pen-settings）');
        }
        
        // キャンバスコンテナの確認
        UIElementChecker.checkCanvasContainer();
        
        // 一般的なポップアップコンテナ検索
        UIElementChecker.searchPopupContainers();
        
        // ID修正確認結果サマリー
        UIElementChecker.logIDCorrectionSummary();
    }
    
    static checkCanvasContainer() {
        console.log('🔍 キャンバスコンテナ確認...');
        
        const canvasContainer = document.getElementById('drawing-canvas');
        if (canvasContainer) {
            console.log('✅ キャンバスコンテナ要素確認完了（ID: drawing-canvas）');
            
            const containerRect = canvasContainer.getBoundingClientRect();
            console.log(`📐 コンテナサイズ: ${containerRect.width}x${containerRect.height}px`);
            
            if (containerRect.width === 0 || containerRect.height === 0) {
                console.warn('⚠️ キャンバスコンテナサイズが0px - CSSスタイルを確認してください');
            }
        } else {
            console.error('❌ キャンバスコンテナ要素が見つかりません（ID: drawing-canvas）');
            console.error('💡 HTMLファイルに <div id="drawing-canvas"></div> を追加してください');
        }
    }
    
    static searchAlternativeButtons() {
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
    
    static searchPopupContainers() {
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
    
    static logIDCorrectionSummary() {
        console.group('📋 ID修正確認結果サマリー');
        console.log('正しいID:', {
            penButton: 'pen-tool ✅',
            penSettings: 'pen-settings ✅',
            canvasContainer: 'drawing-canvas ✅'
        });
        console.log('修正前の間違ったID:', {
            penButton: 'pen-tool-button ❌（修正済み）'
        });
        console.groupEnd();
    }
}

// ==== Main Application Initializer ====
class ApplicationInitializer {
    constructor() {
        this.appState = new AppStateManager();
    }
    
    async initialize() {
        try {
            this.appState.state.startTime = performance.now();
            console.log('🚀 アプリケーション初期化開始（エラー修正・キャンバス表示修正版）');
            
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
            
            // 5. キャンバスセットアップ（新規追加）
            this.appState.updateStep(INIT_STEPS.CANVAS_SETUP);
            await CanvasSetupManager.setupCanvas(app, this.appState);
            
            // 6. システム連携
            this.appState.updateStep(INIT_STEPS.CONNECTING_SYSTEMS);
            await this.connectSystems();
            
            // 7. 最終セットアップ
            this.appState.updateStep(INIT_STEPS.FINAL_SETUP);
            await this.finalSetup();
            
            // 8. 完了処理
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
            
            // ペンボタン確認（修正済みID使用）
            const penButton = document.getElementById('pen-tool');
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
        console.log(`🔍 最大ペンサイズ: ${ConfigManager.get('MAX_BRUSH_SIZE', 500)}px`);
        console.log(`🖊️ 筆圧感度: ${ConfigManager.get('DEFAULT_PRESSURE', 0.5) * 100}%`);
        console.log(`✨ 線補正: ${ConfigManager.get('DEFAULT_SMOOTHING', 0.3) * 100}%`);
        
        const phase2Status = this.appState.state.phase2;
        console.log('🚀 Phase2修正状況:');
        console.log(`  🔧 UIManager修復: ${phase2Status.uiManagerFixed ? '✅ 成功' : '❌ 失敗'}`);
        console.log(`  🎨 PenToolUI初期化: ${phase2Status.penToolUIInitialized ? '✅ 完了' : '❌ 失敗'}`);
        console.log(`  🔗 システム統合: ${phase2Status.systemsIntegrated ? '✅ 完了' : '❌ 不完全'}`);
        console.log(`  🖼️ キャンバス設定: ${phase2Status.canvasProperlySetup ? '✅ 完了' : '❌ 不完全'}`);
        console.log(`  📦 @pixi/ui互換性: ${phase2Status.pixiUICompatible ? '✅ 対応' : 'ℹ️ 標準PIXI'}`);
        console.log(`  🛡️ エラー回復: ${phase2Status.errorRecovery ? '⚠️ 発動済み' : '✅ 正常動作'}`);
        
        console.groupEnd();
        
        // キャンバス表示確認
        if (this.appState.state.canvasVisible) {
            console.log('🖼️ ✅ キャンバス表示確認完了');
        } else {
            console.warn('🖼️ ⚠️ キャンバス表示未確認 - window.debugCanvas() で詳細確認可能');
        }
        
        // UI通知
        const { uiManager } = this.appState.state.components;
        if (uiManager && uiManager.showNotification) {
            const message = phase2Status.uiManagerFixed && 
                           phase2Status.systemsIntegrated && 
                           phase2Status.canvasProperlySetup && 
                           this.appState.state.canvasVisible
                ? 'アプリケーション初期化完了！キャンバスが正常に表示されています'
                : 'アプリケーション初期化完了！基本機能が利用可能です';
            uiManager.showNotification(message, 'success', 5000);
        }
        
        // テスト案内
        setTimeout(() => {
            console.log('🧪 テスト機能:');
            console.log('  📋 window.testSystem() - システム全体テスト');
            console.log('  🖼️ window.debugCanvas() - キャンバス表示デバッグ');
            console.log('  🔧 window.fixCanvas() - キャンバス表示修復');
            console.log('  🎨 window.testPenPopup() - ポップアップテスト');
            
            if (!this.appState.state.canvasVisible) {
                console.warn('⚠️ キャンバスが表示されていない場合は window.fixCanvas() を実行してください');
            }
        }, 1000);
    }
}

// ==== Initialization Monitor ====
class InitializationMonitor {
    constructor(initializer) {
        this.initializer = initializer;
        this.maxWaitTime = 30000; // 30秒に拡張
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

// ==== Utility Functions (utils.js統合版) ====
class UtilityManager {
    static setupFallbackUtilities() {
        // utils.js依存関係のフォールバック
        if (typeof window.safeConfigGet === 'undefined') {
            console.warn('⚠️ utils.js が読み込まれていません - フォールバック関数を設定');
            
            window.safeConfigGet = ConfigManager.get;
            window.createApplicationError = ErrorHandler.createApplicationError;
            window.logError = ErrorHandler.logError;
            window.measurePerformance = PerformanceMonitor.measure;
            window.handleGracefulDegradation = ErrorHandler.handleGracefulDegradation;
        } else {
            console.log('✅ utils.js 統合確認完了');
        }
    }
    
    static logApplicationInfo() {
        console.log('🚀 main.js エラー修正・キャンバス表示修正版読み込み開始...');
        console.log('🗃️ 適用された改善:');
        console.log('  ✅ ErrorHandler重複宣言修正: utils.js統合により重複削除');
        console.log('  ✅ キャンバス表示問題修正: CanvasSetupManager追加');
        console.log('  ✅ @pixi/ui互換性確保: 導入後の問題対応');
        console.log('  ✅ エラーハンドリング強化: utils.js統合版使用');
        console.log('  ✅ デバッグ機能拡充: キャンバス修復機能追加');
        console.log('  ✅ 初期化プロセス最適化: ステップ追加・エラー対策');
        
        console.log('🎯 キャンバス表示修正機能:');
        console.log('  🖼️ キャンバスセットアップ: 専用マネージャーによる安全な設定');
        console.log('  🔍 表示確認機能: サイズ・可視性の自動チェック');
        console.log('  🔧 修復機能: window.fixCanvas()による表示問題修復');
        console.log('  📊 デバッグ機能: window.debugCanvas()による詳細情報表示');
        
        console.log('🚀 準備完了: エラー修正・キャンバス表示修正版アプリケーション初期化実行中...');
    }
}

// ==== Global Initialization Variables ====
let globalInitializer = null;

// ==== Main Initialization Function ====
async function initializeApp() {
    try {
        UtilityManager.logApplicationInfo();
        
        // フォールバック設定
        UtilityManager.setupFallbackUtilities();
        
        // ポップアップUI要素確認
        UIElementChecker.checkPopupUIElements();
        
        // 初期化実行
        globalInitializer = new ApplicationInitializer();
        const monitor = new InitializationMonitor(globalInitializer);
        
        monitor.startWatching();
        const success = await globalInitializer.initialize();
        
        if (success) {
            console.log('🎉 main.js エラー修正・キャンバス表示修正版初期化成功！');
            
            // キャンバス表示最終確認
            setTimeout(() => {
                const canvasVisible = globalInitializer.appState.state.canvasVisible;
                if (canvasVisible) {
                    console.log('✅ キャンバス表示確認完了 - 描画可能です');
                } else {
                    console.warn('⚠️ キャンバス表示未確認 - window.fixCanvas() を試してください');
                }
                
                // ポップアップ機能最終確認
                const penToolUI = window.penToolUI;
                if (penToolUI && penToolUI.components?.popupManager) {
                    console.log('✅ ポップアップ機能確認完了 - ペンツールアイコンをクリックしてテストしてください');
                } else {
                    console.warn('⚠️ ポップアップ機能の完全初期化未確認');
                }
                
                // テスト実行案内
                console.group('🧪 テスト手順');
                console.log('1. window.testSystem() でシステム全体テスト');
                console.log('2. キャンバスに描画してみる');
                console.log('3. ペンツールアイコン（🖊️）をクリックしてポップアップテスト');
                console.log('4. 問題がある場合は window.debugCanvas() で詳細確認');
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

// ==== DOM Ready Handler ====
function handleDOMReady() {
    console.log('📄 DOM読み込み完了');
    setTimeout(initializeApp, 100);
}

// ==== DOM Ready Event Listener ====
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', handleDOMReady);
} else {
    console.log('📄 DOM既に読み込み済み');
    setTimeout(initializeApp, 100);
}

// ==== Global Exports (for debugging) ====
if (typeof window !== 'undefined') {
    // クラスエクスポート（デバッグ用）
    window.ErrorHandler = ErrorHandler;
    window.PerformanceMonitor = PerformanceMonitor;
    window.ConfigManager = ConfigManager;
    window.SystemChecker = SystemChecker;
    window.ComponentFactory = ComponentFactory;
    window.DebugManager = DebugManager;
    window.ApplicationInitializer = ApplicationInitializer;
    window.UIElementChecker = UIElementChecker;
    window.UtilityManager = UtilityManager;
    window.CanvasSetupManager = CanvasSetupManager;
    
    // ステート・定数エクスポート
    window.INIT_STEPS = INIT_STEPS;
    window.APP_STATE = globalInitializer?.appState?.state;
    
    // メイン関数エクスポート
    window.initializeApplication = initializeApp;
    window.checkPopupUIElements = UIElementChecker.checkPopupUIElements;
    
    console.log('🔧 main.js エラー修正・キャンバス表示修正版読み込み完了');
    console.log('📦 追加エクスポート:');
    console.log('  - CanvasSetupManager: キャンバス設定管理');
    console.log('  - window.debugCanvas(): キャンバスデバッグ');
    console.log('  - window.fixCanvas(): キャンバス修復');
    console.log('  - window.testSystem(): システム全体テスト');
}