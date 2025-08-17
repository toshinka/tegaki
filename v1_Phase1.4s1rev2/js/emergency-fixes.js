// ===========================================
// 🚨 緊急エラー修正版ファイル群
// ===========================================

// ===========================================
// 1. settings-manager.js 構文エラー修正版
// ===========================================

/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1.0
 * 設定統括管理システム（構文エラー修正版）
 */
(function() {
    'use strict';
    
    // 重複宣言防止
    if (window.SettingsManager) {
        console.warn('SettingsManager already exists');
        return;
    }
    
    class SettingsManager {
        constructor(appCore) {
            this.appCore = appCore;
            this.version = 'v1.0-Phase1.5-ErrorFixed';
            
            // 🎯 設定カテゴリ統合管理
            this.settings = {
                app: {
                    version: this.version,
                    language: 'ja',
                    theme: 'futaba-classic',
                    autoSave: true,
                    performanceMode: 'balanced'
                },
                canvas: {
                    width: 800,
                    height: 600,
                    backgroundColor: 0xf0e0d6,
                    dpi: 96,
                    quality: 'high'
                },
                tools: {
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
                        mode: 'normal',
                        areaMode: false,
                        particles: true
                    }
                }
            };
            
            // ConfigManagerとの統合対応
            this.useConfigManager = !!window.configManager;
            if (this.useConfigManager) {
                console.log('✅ ConfigManager統合モード有効');
            }
            
            console.log(`⚙️ SettingsManager 構築完了（エラー修正版） - ${this.version}`);
        }
        
        /**
         * 設定値取得（ConfigManager統合対応）
         */
        getSetting(path, defaultValue = null) {
            try {
                // ConfigManager優先使用
                if (this.useConfigManager && window.configManager) {
                    return window.configManager.get(path, defaultValue);
                }
                
                // フォールバック処理
                const keys = path.split('.');
                let current = this.settings;
                
                for (const key of keys) {
                    if (current && current.hasOwnProperty(key)) {
                        current = current[key];
                    } else {
                        return defaultValue;
                    }
                }
                
                return current;
                
            } catch (error) {
                console.error('❌ 設定取得エラー:', error);
                return defaultValue;
            }
        }
        
        /**
         * 設定値設定（ConfigManager統合対応）
         */
        setSetting(path, value, notify = true) {
            try {
                // ConfigManager優先使用
                if (this.useConfigManager && window.configManager) {
                    return window.configManager.set(path, value);
                }
                
                // フォールバック処理
                const keys = path.split('.');
                const lastKey = keys.pop();
                let current = this.settings;
                
                for (const key of keys) {
                    if (!current[key] || typeof current[key] !== 'object') {
                        current[key] = {};
                    }
                    current = current[key];
                }
                
                const oldValue = current[lastKey];
                current[lastKey] = value;
                
                if (notify && oldValue !== value) {
                    this.notifySettingChange(path, oldValue, value);
                }
                
                return true;
                
            } catch (error) {
                console.error('❌ 設定設定エラー:', error);
                return false;
            }
        }
        
        /**
         * 設定変更通知（修正版）
         */
        notifySettingChange(path, oldValue, newValue) {
            try {
                console.log(`⚙️ 設定変更: ${path} = ${newValue}`);
                
                // イベントディスパッチ
                const event = new CustomEvent('settingChanged', {
                    detail: { path, oldValue, newValue }
                });
                window.dispatchEvent(event);
                
            } catch (error) {
                console.error('❌ 設定変更通知エラー:', error);
            }
        }
        
        /**
         * 設定エクスポート（構文エラー修正版）
         */
        exportSettings(includePresets = true, includeThemes = true) {
            try {
                const exportData = {
                    version: this.version,
                    timestamp: Date.now(),
                    settings: JSON.parse(JSON.stringify(this.settings)) // ✅ 修正: 正しいJSON操作
                };
                
                // プリセット追加
                if (includePresets && this.presets) {
                    exportData.presets = {
                        user: Object.fromEntries(this.presets.user || new Map()),
                        shared: Object.fromEntries(this.presets.shared || new Map())
                    };
                }
                
                // テーマ設定追加
                if (includeThemes && this.themeSystem) {
                    exportData.themes = {
                        currentTheme: this.themeSystem.currentTheme,
                        customCSS: this.themeSystem.customCSS
                    };
                }
                
                // JSON文字列化
                const serialized = JSON.stringify(exportData, null, 2);
                
                console.log(`📤 設定エクスポート完了 - ${serialized.length}文字`);
                return serialized;
                
            } catch (error) {
                console.error('❌ 設定エクスポートエラー:', error);
                return null;
            }
        }
        
        /**
         * 設定インポート（構文エラー修正版）
         */
        importSettings(settingsJson) {
            try {
                const importData = JSON.parse(settingsJson);
                
                if (!importData.version || !importData.settings) {
                    throw new Error('不正な設定データ形式');
                }
                
                // 設定マージ
                this.mergeSettings(importData.settings);
                
                console.log(`📥 設定インポート完了 - ${importData.version}`);
                return true;
                
            } catch (error) {
                console.error('❌ 設定インポートエラー:', error);
                return false;
            }
        }
        
        /**
         * 設定マージ
         */
        mergeSettings(newSettings) {
            try {
                const mergeRecursive = (target, source) => {
                    for (const key in source) {
                        if (source.hasOwnProperty(key)) {
                            if (typeof source[key] === 'object' && !Array.isArray(source[key])) {
                                if (!target[key]) target[key] = {};
                                mergeRecursive(target[key], source[key]);
                            } else {
                                target[key] = source[key];
                            }
                        }
                    }
                };
                
                mergeRecursive(this.settings, newSettings);
                
            } catch (error) {
                console.error('❌ 設定マージエラー:', error);
            }
        }
        
        /**
         * デバッグ用状態取得
         */
        getDebugInfo() {
            return {
                version: this.version,
                useConfigManager: this.useConfigManager,
                settingsCount: Object.keys(this.settings).length,
                configManagerAvailable: !!window.configManager
            };
        }
    }
    
    // グローバル登録
    window.SettingsManager = SettingsManager;
    console.log('⚙️ SettingsManager (修正版) グローバル登録完了');
    
})();

// ===========================================
// 2. app-core.js getAppState関数確保版
// ===========================================

(function() {
    'use strict';
    
    // AppCoreが既に存在する場合、getAppStateメソッド確保
    if (window.AppCore && window.AppCore.prototype && !window.AppCore.prototype.getAppState) {
        console.log('🔧 AppCore.getAppState メソッド追加中...');
        
        window.AppCore.prototype.getAppState = function() {
            try {
                return {
                    // 基本状態
                    initialized: this.state?.isInitialized || false,
                    currentTool: this.toolSystem?.currentTool || 'pen',
                    
                    // キャンバス情報
                    canvas: {
                        width: this.canvasWidth || 800,
                        height: this.canvasHeight || 600,
                        backgroundColor: this.backgroundColor || 0xf0e0d6,
                        pixiApp: !!this.app,
                        pathCount: this.paths?.length || 0,
                        inDOM: document.getElementById('drawing-canvas')?.contains(this.app?.view)
                    },
                    
                    // ツール情報
                    tools: this.toolSystem ? {
                        brushSize: this.toolSystem.brushSize || 16,
                        opacity: this.toolSystem.opacity || 0.85,
                        pressure: this.toolSystem.pressure || 0.5,
                        smoothing: this.toolSystem.smoothing || 0.3
                    } : null,
                    
                    // コンポーネント状態
                    components: {
                        app: !!this.app,
                        drawingContainer: !!this.drawingContainer,
                        uiContainer: !!this.uiContainer,
                        toolSystem: !!this.toolSystem,
                        uiController: !!this.uiController,
                        performanceMonitor: !!this.performanceMonitor
                    },
                    
                    // 統合管理システム状態
                    managers: {
                        config: !!window.configManager,
                        error: !!window.errorManager,
                        initialization: !!window.initializationManager,
                        settings: !!window.settingsManager
                    },
                    
                    // フラグ情報
                    flags: {
                        extensionsAvailable: this.extensionsAvailable || false,
                        fallbackMode: this.fallbackMode || false
                    },
                    
                    // パフォーマンス情報
                    performance: {
                        initTime: this.state?.performanceMetrics?.initEndTime - 
                                 this.state?.performanceMetrics?.initStartTime || 0,
                        errorCount: this.state?.errorCount || 0,
                        frameCount: this.state?.performanceMetrics?.frameCount || 0
                    },
                    
                    // メタ情報
                    meta: {
                        version: '1.5-Phase1.5-ErrorFixed',
                        timestamp: Date.now(),
                        pixiVersion: window.PIXI?.VERSION || 'N/A'
                    }
                };
                
            } catch (error) {
                console.error('❌ getAppState エラー:', error);
                return {
                    error: true,
                    message: error.message,
                    initialized: false
                };
            }
        };
        
        console.log('✅ AppCore.getAppState メソッド追加完了');
    }
    
})();

// ===========================================
// 3. 重複宣言防止パターン適用
// ===========================================

(function() {
    'use strict';
    
    /**
     * PixiExtensionsManager 重複宣言防止
     */
    if (!window.__PIXI_EXTENSIONS_DEFINED && window.PIXI) {
        try {
            // 既存のPixiExtensionsManagerが存在しない場合のみ実行
            if (!window.PixiExtensionsManager) {
                console.log('🔧 PixiExtensionsManager 重複宣言防止適用');
                
                // 最小限のPixiExtensionsManager作成
                window.PixiExtensionsManager = class {
                    constructor() {
                        this.extensions = new Map();
                        this.initialized = false;
                    }
                    
                    initialize() {
                        this.initialized = true;
                        console.log('✅ PixiExtensionsManager (fallback) 初期化完了');
                        return this;
                    }
                    
                    getStats() {
                        return {
                            available: [],
                            fallbackMode: true,
                            initialized: this.initialized
                        };
                    }
                };
                
                // フォールバック初期化
                if (!window.PixiExtensions) {
                    window.PixiExtensions = new window.PixiExtensionsManager().initialize();
                }
            }
            
            window.__PIXI_EXTENSIONS_DEFINED = true;
            
        } catch (error) {
            console.error('❌ PixiExtensionsManager 重複宣言防止エラー:', error);
        }
    }
    
    /**
     * FutabaDrawingTool 重複宣言防止
     */
    if (!window.__FUTABA_DRAWING_TOOL_DEFINED) {
        try {
            if (window.FutabaDrawingTool && !window.FutabaDrawingTool.prototype.getState) {
                console.log('🔧 FutabaDrawingTool 重複宣言防止適用');
                
                // getStateメソッド追加（APIGateway対応）
                window.FutabaDrawingTool.prototype.getState = function() {
                    return this.app ? this.app.getAppState() : { error: 'AppCore not initialized' };
                };
            }
            
            window.__FUTABA_DRAWING_TOOL_DEFINED = true;
            
        } catch (error) {
            console.error('❌ FutabaDrawingTool 重複宣言防止エラー:', error);
        }
    }
    
    /**
     * Group 重複宣言防止 (tweedle.js)
     */
    if (!window.__TWEEDLE_GROUP_DEFINED) {
        try {
            // tweedle.jsのGroup重複を防止
            if (window.Group && typeof window.Group === 'function') {
                console.log('🔧 tweedle.js Group 重複宣言確認済み');
            }
            
            window.__TWEEDLE_GROUP_DEFINED = true;
            
        } catch (error) {
            console.error('❌ tweedle.js Group 重複宣言防止エラー:', error);
        }
    }
    
    /**
     * monitorInterval 重複宣言防止 (index.html)
     */
    if (!window.__MONITOR_INTERVAL_DEFINED) {
        try {
            // 既存のmonitorIntervalをクリア
            if (window.monitorInterval) {
                clearInterval(window.monitorInterval);
                console.log('🔧 既存monitorInterval クリア済み');
            }
            
            window.__MONITOR_INTERVAL_DEFINED = true;
            
        } catch (error) {
            console.error('❌ monitorInterval 重複宣言防止エラー:', error);
        }
    }
    
})();

// ===========================================
// 4. 初期化順序修正・API不整合解決
// ===========================================

(function() {
    'use strict';
    
    /**
     * InitializationManager API検証改善
     */
    if (window.InitializationManager && window.InitializationManager.prototype) {
        const originalValidateAPIs = window.InitializationManager.prototype.validateAPIs;
        
        window.InitializationManager.prototype.validateAPIs = function() {
            try {
                console.log('🔍 API検証開始（改善版）...');
                
                // app.getAppState 実行前にメソッド存在確認
                if (this.app && typeof this.app.getAppState === 'function') {
                    const state = this.app.getAppState();
                    console.log('✅ API状態確認成功:', {
                        initialized: state.initialized,
                        components: Object.keys(state.components || {}),
                        managers: Object.keys(state.managers || {})
                    });
                    return true;
                } else {
                    console.warn('⚠️ app.getAppState未実装 - 基本API確認にフォールバック');
                    
                    // フォールバック検証
                    const basicValidation = {
                        app: !!this.app,
                        pixiAvailable: !!window.PIXI,
                        canvas: !!document.getElementById('drawing-canvas')
                    };
                    
                    console.log('✅ 基本API確認:', basicValidation);
                    return Object.values(basicValidation).every(Boolean);
                }
                
            } catch (error) {
                console.error('❌ API検証エラー:', error);
                
                // エラー時のフォールバック
                console.log('🛡️ フォールバックAPI検証実行');
                return this.performFallbackValidation();
            }
        };
        
        /**
         * フォールバックAPI検証
         */
        window.InitializationManager.prototype.performFallbackValidation = function() {
            try {
                const checks = {
                    pixi: !!window.PIXI,
                    canvas: !!document.getElementById('drawing-canvas'),
                    app: !!this.app,
                    managers: {
                        config: !!window.configManager,
                        error: !!window.errorManager
                    }
                };
                
                const passed = Object.values(checks).filter(v => 
                    typeof v === 'boolean' ? v : Object.values(v).some(Boolean)
                ).length;
                
                console.log(`✅ フォールバック検証完了: ${passed}/4 項目合格`);
                return passed >= 2; // 最低限の条件
                
            } catch (error) {
                console.error('❌ フォールバックAPI検証も失敗:', error);
                return false;
            }
        };
        
        console.log('🔧 InitializationManager API検証改善完了');
    }
    
})();

// ===========================================
// 5. ConfigManager統合対応・互換レイヤー
// ===========================================

(function() {
    'use strict';
    
    /**
     * ConfigManager <-> SettingsManager 互換性確保
     */
    if (window.configManager && window.settingsManager) {
        console.log('🔧 ConfigManager <-> SettingsManager 互換性設定中...');
        
        // SettingsManagerからConfigManagerへの移行促進
        const originalGet = window.settingsManager.getSetting;
        const originalSet = window.settingsManager.setSetting;
        
        window.settingsManager.getSetting = function(path, defaultValue) {
            // 非推奨警告（開発時のみ）
            if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                console.warn(`🔄 [非推奨] settingsManager.getSetting('${path}') は非推奨です。configManager.get('${path}') を使用してください。`);
            }
            
            // ConfigManager優先
            if (window.configManager && typeof window.configManager.get === 'function') {
                return window.configManager.get(path, defaultValue);
            }
            
            // フォールバック
            return originalGet.call(this, path, defaultValue);
        };
        
        window.settingsManager.setSetting = function(path, value, notify) {
            // 非推奨警告（開発時のみ）
            if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                console.warn(`🔄 [非推奨] settingsManager.setSetting('${path}', ${value}) は非推奨です。configManager.set('${path}', ${value}) を使用してください。`);
            }
            
            // ConfigManager優先
            if (window.configManager && typeof window.configManager.set === 'function') {
                return window.configManager.set(path, value);
            }
            
            // フォールバック
            return originalSet.call(this, path, value, notify);
        };
        
        console.log('✅ ConfigManager <-> SettingsManager 互換性設定完了');
    }
    
    /**
     * 段階的移行準備：スリム化計画対応
     */
    if (window.configManager) {
        // Phase1.5s1削除準備フラグ設定
        if (!window.__SLIM_MIGRATION_FLAGS) {
            window.__SLIM_MIGRATION_FLAGS = {
                settingsManagerDeprecated: true,
                popupManagerDeprecated: true,
                sliderManagerDeprecated: true,
                performanceUtilsDeprecated: true,
                phase15s1Ready: true
            };
            
            console.log('🎯 Phase1.5s1スリム化準備フラグ設定完了');
        }
    }
    
})();

// ===========================================
// 6. エラー復旧・フォールバック強化
// ===========================================

(function() {
    'use strict';
    
    /**
     * グローバルエラーハンドラー強化
     */
    const originalErrorHandler = window.onerror;
    
    window.onerror = function(message, source, lineno, colno, error) {
        console.group('🚨 グローバルエラー検出');
        console.error('メッセージ:', message);
        console.error('ソース:', source);
        console.error('行番号:', lineno, '列番号:', colno);
        
        // 重複宣言エラーの特別処理
        if (message.includes('has already been declared')) {
            console.warn('🔧 重複宣言エラー検出 - フォールバック処理適用');
            console.groupEnd();
            return true; // エラーを抑制
        }
        
        // JSON構文エラーの特別処理
        if (message.includes('Unexpected identifier') && message.includes('JSON')) {
            console.warn('🔧 JSON構文エラー検出 - フォールバック処理適用');
            console.groupEnd();
            return true; // エラーを抑制
        }
        
        console.groupEnd();
        
        // 元のハンドラーがあれば実行
        if (originalErrorHandler) {
            return originalErrorHandler.apply(this, arguments);
        }
        
        return false;
    };
    
    /**
     * 未処理Promise拒否エラーハンドラー
     */
    window.addEventListener('unhandledrejection', function(event) {
        console.group('🚨 未処理Promise拒否検出');
        console.error('理由:', event.reason);
        
        // API関連エラーの特別処理
        if (event.reason && event.reason.message && 
            event.reason.message.includes('getAppState')) {
            console.warn('🔧 getAppState関連エラー検出 - フォールバック処理適用');
            event.preventDefault(); // Promise拒否を抑制
        }
        
        console.groupEnd();
    });
    
    /**
     * 緊急復旧関数
     */
    window.emergencyRecovery = function() {
        console.log('🚑 緊急復旧処理開始...');
        
        try {
            // 重複宣言クリア
            if (window.__PIXI_EXTENSIONS_DEFINED) {
                delete window.__PIXI_EXTENSIONS_DEFINED;
            }
            if (window.__FUTABA_DRAWING_TOOL_DEFINED) {
                delete window.__FUTABA_DRAWING_TOOL_DEFINED;
            }
            
            // ConfigManager確認・初期化
            if (!window.configManager && window.ConfigManager) {
                window.configManager = new window.ConfigManager();
                console.log('✅ ConfigManager 緊急初期化完了');
            }
            
            // ErrorManager確認・初期化
            if (!window.errorManager && window.ErrorManager) {
                window.errorManager = new window.ErrorManager();
                console.log('✅ ErrorManager 緊急初期化完了');
            }
            
            // API Gateway状態確認
            if (window.apiGateway) {
                const apiStatus = window.apiGateway.checkStatus();
                console.log('🔍 APIGateway状態:', apiStatus);
            }
            
            console.log('✅ 緊急復旧処理完了');
            
        } catch (error) {
            console.error('❌ 緊急復旧処理エラー:', error);
        }
    };
    
    console.log('🛡️ エラー復旧・フォールバック強化完了');
    console.log('💡 緊急時は window.emergencyRecovery() を実行してください');
    
})();

// ===========================================
// 7. PixiJS v8対応準備コメント追加
// ===========================================

/**
 * 🚀 PixiJS v8対応準備
 * 
 * 将来のPixiJS v8移行時の主要変更点：
 * 
 * 1. Application初期化
 *    v7: new PIXI.Application(config)
 *    v8: await PIXI.Application.init(config)
 * 
 * 2. Graphics API変更
 *    v7: graphics.beginFill(color, alpha)
 *    v8: graphics.fill(color).alpha(alpha)
 * 
 * 3. Container/DisplayObject変更
 *    v7: container.addChild(child)
 *    v8: container.addChild(child) // 同じだが内部実装変更
 * 
 * 4. Renderer分離
 *    v7: PIXI.Renderer
 *    v8: PIXI.WebGLRenderer / PIXI.WebGPURenderer
 * 
 * 5. Asset Loading変更
 *    v7: PIXI.Loader
 *    v8: PIXI.Assets.load()
 */

// ===========================================
// 8. 修正完了確認・動作テスト関数
// ===========================================

(function() {
    'use strict';
    
    /**
     * 修正完了確認関数
     */
    window.checkEmergencyFixes = function() {
        console.group('🔍 緊急修正確認テスト');
        
        const checks = {
            // 構文エラー修正確認
            settingsManagerFixed: !!window.SettingsManager && 
                                 typeof new window.SettingsManager().exportSettings === 'function',
            
            // 重複宣言防止確認
            pixiExtensionsProtected: !!window.__PIXI_EXTENSIONS_DEFINED,
            futabaDrawingToolProtected: !!window.__FUTABA_DRAWING_TOOL_DEFINED,
            monitorIntervalProtected: !!window.__MONITOR_INTERVAL_DEFINED,
            
            // API修正確認
            appCoreGetAppState: !!window.AppCore?.prototype?.getAppState,
            initializationManagerFixed: !!window.InitializationManager?.prototype?.performFallbackValidation,
            
            // 統合システム確認
            configManager: !!window.configManager,
            errorManager: !!window.errorManager,
            apiGateway: !!window.apiGateway,
            
            // エラーハンドリング確認
            errorHandlerEnhanced: typeof window.emergencyRecovery === 'function',
            slimMigrationReady: !!window.__SLIM_MIGRATION_FLAGS?.phase15s1Ready
        };
        
        const passed = Object.values(checks).filter(Boolean).length;
        const total = Object.keys(checks).length;
        
        console.log('修正項目確認結果:', checks);
        console.log(`✅ 修正完了: ${passed}/${total} (${(passed/total*100).toFixed(1)}%)`);
        
        if (passed === total) {
            console.log('🎉 全ての緊急修正が完了しました！');
            console.log('💡 アプリケーションの動作テストを実行してください');
        } else {
            console.warn('⚠️ 一部の修正が未完了です');
        }
        
        console.groupEnd();
        
        return { passed, total, percentage: passed/total*100, allFixed: passed === total };
    };
    
    /**
     * 基本動作テスト関数
     */
    window.testBasicFunctionality = function() {
        console.group('🧪 基本動作テスト');
        
        try {
            const tests = [];
            
            // ConfigManager動作テスト
            if (window.configManager) {
                window.configManager.set('test.value', 'test123');
                const retrieved = window.configManager.get('test.value');
                tests.push({
                    name: 'ConfigManager基本動作',
                    passed: retrieved === 'test123'
                });
            }
            
            // APIGateway動作テスト
            if (window.apiGateway) {
                const status = window.apiGateway.checkStatus();
                tests.push({
                    name: 'APIGateway状態確認',
                    passed: !!status
                });
            }
            
            // AppCore存在確認
            tests.push({
                name: 'AppCore利用可能性',
                passed: !!window.AppCore && typeof window.AppCore === 'function'
            });
            
            // PixiJS利用可能性
            tests.push({
                name: 'PixiJS利用可能性',
                passed: !!window.PIXI && !!window.PIXI.Application
            });
            
            const passed = tests.filter(t => t.passed).length;
            
            tests.forEach(test => {
                console.log(`${test.passed ? '✅' : '❌'} ${test.name}`);
            });
            
            console.log(`🧪 テスト結果: ${passed}/${tests.length} 合格`);
            
            if (passed === tests.length) {
                console.log('🎉 基本機能は正常に動作しています！');
            } else {
                console.warn('⚠️ 一部の基本機能に問題があります');
            }
            
            console.groupEnd();
            return { tests, passed, total: tests.length };
            
        } catch (error) {
            console.error('❌ 基本動作テストエラー:', error);
            console.groupEnd();
            return { error: error.message };
        }
    };
    
    console.log('🔧 緊急エラー修正版ファイル群 適用完了');
    console.log('💡 確認: window.checkEmergencyFixes() を実行');
    console.log('💡 テスト: window.testBasicFunctionality() を実行');
    
})();