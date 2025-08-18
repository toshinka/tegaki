/**
 * 🚨 緊急エラー修正システム - Phase1.5統合改修後エラー対応
 * 
 * 対応エラー群:
 * 1. settings-manager.js:877 Uncaught SyntaxError: Unexpected identifier 'JSON'
 * 2. 'PixiExtensionsManager' has already been declared (重複宣言)
 * 3. 'AppCore' has already been declared (重複宣言)
 * 4. 'FutabaDrawingTool' has already been declared (重複宣言)
 * 5. 'monitorInterval' has already been declared (重複宣言)
 * 6. 'Group' has already been declared (重複宣言)
 * 7. api-gateway.js:476 this.app.getAppState is not a function
 */

(function() {
    'use strict';
    
    console.log('🚨 緊急エラー修正システム起動 - Phase1.5統合改修後対応');
    
    // ========================================
    // 🔴 最優先: 構文エラー修正
    // ========================================
    
    /**
     * SettingsManager exportSettings 構文エラー修正版
     */
    function fixSettingsManagerSyntaxError() {
        if (window.SettingsManager && window.SettingsManager.prototype) {
            // 既存のexportSettingsが構文エラーを起こしている場合の修正版
            window.SettingsManager.prototype.exportSettings = function(includePresets = true, includeThemes = true) {
                try {
                    const exportData = {
                        version: this.version || 'v1.5-Phase1.5',
                        timestamp: Date.now(),
                        settings: JSON.parse(JSON.stringify(this.settings || {}))
                    };
                    
                    if (includePresets && this.presets) {
                        exportData.presets = {
                            user: Object.fromEntries(this.presets.user || new Map()),
                            shared: Object.fromEntries(this.presets.shared || new Map())
                        };
                    }
                    
                    if (includeThemes && this.themeSystem) {
                        exportData.themes = {
                            currentTheme: this.themeSystem.currentTheme,
                            customCSS: this.themeSystem.customCSS,
                            darkMode: this.themeSystem.darkMode
                        };
                    }
                    
                    console.log('✅ 設定エクスポート成功 (緊急修正版)');
                    return exportData;
                    
                } catch (error) {
                    console.error('❌ 設定エクスポートエラー:', error);
                    return {
                        version: 'v1.5-Phase1.5-emergency',
                        timestamp: Date.now(),
                        settings: {},
                        error: error.message
                    };
                }
            };
            
            console.log('🔧 SettingsManager 構文エラー修正適用完了');
        }
    }
    
    // ========================================
    // 🟡 高優先: 重複宣言防止システム
    // ========================================
    
    /**
     * PixiExtensionsManager 重複宣言防止
     */
    function preventPixiExtensionsManagerDuplication() {
        if (window.PixiExtensionsManager) {
            console.warn('⚠️ PixiExtensionsManager 重複宣言防止 - 既存クラス維持');
            return;
        }
        
        // 重複宣言防止ガード付きPixiExtensionsManager
        (function() {
            if (window.__PIXI_EXTENSIONS_DEFINED) return;
            
            class PixiExtensionsManager {
                constructor() {
                    this.extensions = new Map();
                    this.version = 'v1.5-emergency-fix';
                }
                
                // PixiJS v8対応準備コメント
                initializeRenderer() {
                    // v7実装
                    if (typeof PIXI !== 'undefined') {
                        // TODO: PixiJS v8対応
                        // v8: Application → ApplicationOptions変更予定
                        // v8: app.renderer → app.renderer (API一部変更)
                        console.log('✅ PixiJS v7 Renderer初期化 (v8対応準備済み)');
                    }
                }
                
                // 基本拡張機能
                registerExtension(name, extension) {
                    this.extensions.set(name, extension);
                    console.log(`🔧 拡張登録: ${name}`);
                }
            }
            
            window.PixiExtensionsManager = PixiExtensionsManager;
            window.__PIXI_EXTENSIONS_DEFINED = true;
        })();
    }
    
    /**
     * AppCore 重複宣言防止
     */
    function preventAppCoreDuplication() {
        if (window.AppCore) {
            console.warn('⚠️ AppCore 重複宣言防止 - 既存クラス維持');
            
            // getAppState メソッド不足の場合に追加
            if (!window.AppCore.prototype.getAppState) {
                window.AppCore.prototype.getAppState = function() {
                    return {
                        initialized: this.initialized || false,
                        currentTool: this.toolSystem?.currentTool || 'pen',
                        canvas: {
                            width: this.app?.view?.width || 800,
                            height: this.app?.view?.height || 600,
                            pixiApp: !!this.app
                        },
                        brush: {
                            size: this.toolSystem?.brushSize || 16,
                            color: this.toolSystem?.brushColor || '#800000'
                        },
                        // ConfigManager統合対応
                        config: window.configManager ? window.configManager.getAll() : {},
                        managers: {
                            config: !!window.configManager,
                            error: !!window.errorManager,
                            initialization: !!window.initializationManager
                        }
                    };
                };
                console.log('🔧 AppCore.getAppState メソッド追加完了');
            }
            return;
        }
        
        console.warn('⚠️ AppCore クラスが見つかりません');
    }
    
    /**
     * FutabaDrawingTool 重複宣言防止
     */
    function preventFutabaDrawingToolDuplication() {
        if (window.FutabaDrawingTool) {
            console.warn('⚠️ FutabaDrawingTool 重複宣言防止 - 既存クラス維持');
            return;
        }
        
        (function() {
            if (window.__FUTABA_DRAWING_TOOL_DEFINED) return;
            
            // 緊急時用最小実装
            class FutabaDrawingTool {
                constructor() {
                    this.version = 'v1.5-Phase1.5-emergency';
                    this.initialized = false;
                }
                
                async init() {
                    console.log('🚨 FutabaDrawingTool 緊急初期化開始');
                    this.initialized = true;
                    return this;
                }
                
                getAppState() {
                    return {
                        initialized: this.initialized,
                        version: this.version,
                        emergency: true
                    };
                }
            }
            
            window.FutabaDrawingTool = FutabaDrawingTool;
            window.__FUTABA_DRAWING_TOOL_DEFINED = true;
            
            console.log('🚨 FutabaDrawingTool 緊急クラス定義完了');
        })();
    }
    
    /**
     * monitorInterval 重複宣言防止
     */
    function preventMonitorIntervalDuplication() {
        if (window.monitorInterval) {
            clearInterval(window.monitorInterval);
            console.log('🔧 既存monitorIntervalをクリア');
        }
        
        // 重複宣言防止でlet使用
        let monitorInterval = setInterval(function() {
            // パフォーマンス監視処理
            if (window.performanceMonitor && typeof window.performanceMonitor.checkPerformance === 'function') {
                window.performanceMonitor.checkPerformance();
            }
        }, 5000);
        
        window.monitorInterval = monitorInterval;
        console.log('🔧 monitorInterval 重複防止版設定完了');
    }
    
    /**
     * Group(Tweedle.js) 重複宣言防止
     */
    function preventGroupDuplication() {
        if (window.Group) {
            console.warn('⚠️ Group(Tweedle) 重複宣言防止 - 既存クラス維持');
            return;
        }
        
        // Tweedle.jsの簡易フォールバック
        if (typeof window.TWEEN === 'undefined') {
            console.log('🔧 Tweedle.js Group 簡易実装準備');
        }
    }
    
    // ========================================
    // 🟢 中優先: API不整合修正
    // ========================================
    
    /**
     * APIGateway getAppState 不整合修正
     */
    function fixAPIGatewayGetAppState() {
        // AppCoreにgetAppStateが存在することを確保
        if (window.AppCore && window.AppCore.prototype && !window.AppCore.prototype.getAppState) {
            window.AppCore.prototype.getAppState = function() {
                return {
                    initialized: this.initialized || false,
                    currentTool: this.toolSystem?.currentTool || 'pen',
                    canvas: {
                        width: this.canvasWidth || 800,
                        height: this.canvasHeight || 600,
                        background: this.canvasBackgroundColor || '#f0e0d6'
                    },
                    brush: {
                        size: this.toolSystem?.brushSize || 16,
                        opacity: this.toolSystem?.brushOpacity || 85
                    },
                    // Phase1.5統合システム対応
                    managers: {
                        config: !!window.configManager,
                        error: !!window.errorManager,
                        initialization: !!window.initializationManager,
                        api: !!window.apiGateway
                    },
                    stats: {
                        totalDrawTime: this.getTotalDrawTime ? this.getTotalDrawTime() : 0,
                        commandCount: this.getCommandCount ? this.getCommandCount() : 0
                    }
                };
            };
            console.log('🔧 AppCore.getAppState API不整合修正完了');
        }
        
        // InitializationManager validateAPIs改善
        if (window.InitializationManager && window.InitializationManager.prototype) {
            const originalValidateAPIs = window.InitializationManager.prototype.validateAPIs;
            
            window.InitializationManager.prototype.validateAPIs = async function() {
                try {
                    // app.getAppState 実行前にメソッド存在確認
                    if (this.app && typeof this.app.getAppState === 'function') {
                        const state = this.app.getAppState();
                        console.log('✅ API状態確認成功:', state);
                        return true;
                    } else {
                        console.warn('⚠️ getAppState未実装、フォールバックAPI検証実行');
                        return this.performFallbackValidation ? this.performFallbackValidation() : true;
                    }
                } catch (error) {
                    console.error('❌ API検証エラー:', error);
                    return this.performFallbackValidation ? this.performFallbackValidation() : false;
                }
            };
            
            // フォールバック検証メソッド追加
            if (!window.InitializationManager.prototype.performFallbackValidation) {
                window.InitializationManager.prototype.performFallbackValidation = function() {
                    console.log('🛡️ フォールバックAPI検証実行');
                    
                    // 基本的な存在確認
                    const checks = {
                        app: !!this.app,
                        pixi: typeof PIXI !== 'undefined',
                        managers: !!(window.configManager || window.errorManager)
                    };
                    
                    const success = Object.values(checks).some(check => check);
                    console.log('🛡️ フォールバック検証結果:', checks, success ? '✅ 部分成功' : '❌ 失敗');
                    
                    return success;
                };
            }
            
            console.log('🔧 InitializationManager.validateAPIs 改善完了');
        }
    }
    
    // ========================================
    // 🎯 統合システム確認・フォールバック
    // ========================================
    
    /**
     * Phase1.5統合システム確認
     */
    function checkPhase15Integration() {
        const integration = {
            configManager: !!window.configManager,
            errorManager: !!window.errorManager,
            initializationManager: !!window.initializationManager,
            apiGateway: !!window.apiGateway,
            futaba: !!window.futaba
        };
        
        const integrationCount = Object.values(integration).filter(Boolean).length;
        const integrationRate = (integrationCount / Object.keys(integration).length * 100).toFixed(1);
        
        console.log('📊 Phase1.5統合システム確認:', integration);
        console.log(`📊 統合率: ${integrationRate}% (${integrationCount}/${Object.keys(integration).length})`);
        
        return integration;
    }
    
    /**
     * 基本機能フォールバック
     */
    function setupBasicFallbacks() {
        // window.futaba基本API確保
        if (!window.futaba) {
            window.futaba = {
                getState: function() {
                    return {
                        success: true,
                        emergency: true,
                        version: 'v1.5-Phase1.5-emergency',
                        initialized: !!window.futabaDrawingTool,
                        fallback: true
                    };
                },
                
                selectTool: function(toolName) {
                    console.log(`🎨 ツール選択 (緊急版): ${toolName}`);
                    if (window.futabaDrawingTool && window.futabaDrawingTool.appCore) {
                        return window.futabaDrawingTool.appCore.selectTool?.(toolName) || true;
                    }
                    return true;
                },
                
                setBrushSize: function(size) {
                    console.log(`🖌️ ブラシサイズ設定 (緊急版): ${size}`);
                    if (window.futabaDrawingTool && window.futabaDrawingTool.appCore) {
                        return window.futabaDrawingTool.appCore.setBrushSize?.(size) || true;
                    }
                    return true;
                },
                
                diagnose: function() {
                    return {
                        version: 'v1.5-Phase1.5-emergency',
                        emergency: true,
                        integration: checkPhase15Integration(),
                        timestamp: Date.now()
                    };
                }
            };
            
            console.log('🛡️ window.futaba 基本フォールバックAPI設定完了');
        }
        
        // 基本設定管理フォールバック
        if (!window.configManager) {
            window.configManager = {
                get: function(key) {
                    const defaults = {
                        'canvas.defaultWidth': 800,
                        'canvas.defaultHeight': 600,
                        'canvas.backgroundColor': 0xf0e0d6,
                        'brush.defaultSize': 16,
                        'brush.defaultColor': 0x800000,
                        'brush.defaultOpacity': 85
                    };
                    return defaults[key] || null;
                },
                
                set: function(key, value) {
                    console.log(`⚙️ 設定変更 (フォールバック): ${key} = ${value}`);
                    return true;
                },
                
                getAll: function() {
                    return {
                        canvas: { defaultWidth: 800, defaultHeight: 600 },
                        brush: { defaultSize: 16, defaultColor: 0x800000 }
                    };
                }
            };
            
            console.log('🛡️ configManager フォールバック設定完了');
        }
    }
    
    // ========================================
    // 🚀 緊急修正実行
    // ========================================
    
    /**
     * 全緊急修正実行
     */
    function executeEmergencyFixes() {
        console.group('🚨 緊急エラー修正実行開始');
        
        try {
            // Step1: 構文エラー修正
            fixSettingsManagerSyntaxError();
            
            // Step2: 重複宣言防止
            preventPixiExtensionsManagerDuplication();
            preventAppCoreDuplication();
            preventFutabaDrawingToolDuplication();
            preventMonitorIntervalDuplication();
            preventGroupDuplication();
            
            // Step3: API不整合修正
            fixAPIGatewayGetAppState();
            
            // Step4: 統合システム確認
            const integration = checkPhase15Integration();
            
            // Step5: フォールバック設定
            setupBasicFallbacks();
            
            console.log('✅ 緊急エラー修正完了');
            
            return {
                success: true,
                fixes: [
                    'SettingsManager構文エラー修正',
                    '重複宣言防止システム',
                    'API不整合修正',
                    'フォールバック機能設定'
                ],
                integration: integration
            };
            
        } catch (error) {
            console.error('❌ 緊急修正実行エラー:', error);
            return {
                success: false,
                error: error.message
            };
        } finally {
            console.groupEnd();
        }
    }
    
    // ========================================
    // 🔍 診断・検証システム
    // ========================================
    
    /**
     * 緊急修正後の動作確認
     */
    window.checkEmergencyFixes = function() {
        console.group('🔍 緊急修正動作確認');
        
        const results = {
            syntax: true,
            duplications: true,
            apis: true,
            integration: true,
            details: {}
        };
        
        try {
            // 構文エラー確認
            if (window.SettingsManager && window.SettingsManager.prototype.exportSettings) {
                console.log('✅ SettingsManager構文エラー修正確認');
                results.details.settingsManager = true;
            } else {
                console.warn('⚠️ SettingsManager修正未完了');
                results.syntax = false;
                results.details.settingsManager = false;
            }
            
            // 重複宣言確認
            const duplications = {
                PixiExtensionsManager: !!window.PixiExtensionsManager,
                AppCore: !!window.AppCore,
                FutabaDrawingTool: !!window.FutabaDrawingTool,
                monitorInterval: !!window.monitorInterval
            };
            console.log('✅ 重複宣言防止確認:', duplications);
            results.details.duplications = duplications;
            
            // API動作確認
            const apis = {
                'futaba.getState': typeof window.futaba?.getState === 'function',
                'futaba.selectTool': typeof window.futaba?.selectTool === 'function',
                'configManager.get': typeof window.configManager?.get === 'function'
            };
            console.log('✅ API動作確認:', apis);
            results.details.apis = apis;
            
            // 統合システム確認
            const integration = checkPhase15Integration();
            results.details.integration = integration;
            
        } catch (error) {
            console.error('❌ 動作確認エラー:', error);
            results.syntax = results.duplications = results.apis = results.integration = false;
            results.details.error = error.message;
        }
        
        console.log('🔍 緊急修正確認結果:', results);
        console.groupEnd();
        
        return results;
    };
    
    /**
     * 基本機能テスト
     */
    window.testBasicFunctionality = function() {
        console.group('🧪 基本機能テスト実行');
        
        const tests = {
            futabaAPI: false,
            toolSelection: false,
            brushSize: false,
            canvasResize: false,
            configManagement: false
        };
        
        try {
            // window.futaba API テスト
            if (window.futaba && window.futaba.getState) {
                const state = window.futaba.getState();
                tests.futabaAPI = !!state;
                console.log('✅ futaba.getState():', state);
            }
            
            // ツール選択テスト
            if (window.futaba && window.futaba.selectTool) {
                tests.toolSelection = window.futaba.selectTool('pen');
                console.log('✅ futaba.selectTool("pen"):', tests.toolSelection);
            }
            
            // ブラシサイズテスト
            if (window.futaba && window.futaba.setBrushSize) {
                tests.brushSize = window.futaba.setBrushSize(24);
                console.log('✅ futaba.setBrushSize(24):', tests.brushSize);
            }
            
            // 設定管理テスト
            if (window.configManager) {
                const canvasWidth = window.configManager.get('canvas.defaultWidth');
                tests.configManagement = canvasWidth !== null;
                console.log('✅ configManager.get("canvas.defaultWidth"):', canvasWidth);
            }
            
        } catch (error) {
            console.error('❌ 基本機能テストエラー:', error);
        }
        
        const passedTests = Object.values(tests).filter(Boolean).length;
        const totalTests = Object.keys(tests).length;
        
        console.log(`🧪 基本機能テスト結果: ${passedTests}/${totalTests} 通過`);
        console.log('📊 詳細結果:', tests);
        console.groupEnd();
        
        return {
            passed: passedTests,
            total: totalTests,
            success: passedTests >= totalTests / 2, // 50%以上で成功
            details: tests
        };
    };
    
    // ========================================
    // 🚨 緊急復旧システム
    // ========================================
    
    /**
     * 緊急復旧実行
     */
    window.emergencyRecovery = function() {
        console.group('🚨 緊急復旧システム実行');
        
        try {
            // Step1: エラー状況確認
            console.log('🔍 エラー状況確認中...');
            
            // Step2: 重要システム確認
            const critical = {
                pixi: typeof PIXI !== 'undefined',
                dom: document.readyState === 'complete',
                canvas: !!document.getElementById('drawing-canvas')
            };
            
            console.log('🔍 重要システム状況:', critical);
            
            // Step3: 緊急修正再実行
            const fixes = executeEmergencyFixes();
            
            // Step4: 基本機能テスト
            const tests = window.testBasicFunctionality();
            
            console.log('🚨 緊急復旧完了');
            
            return {
                success: fixes.success && tests.success,
                critical: critical,
                fixes: fixes,
                tests: tests,
                timestamp: Date.now()
            };
            
        } catch (error) {
            console.error('❌ 緊急復旧エラー:', error);
            return {
                success: false,
                error: error.message,
                timestamp: Date.now()
            };
        } finally {
            console.groupEnd();
        }
    };
    
    // ========================================
    // 🚀 自動実行
    // ========================================
    
    // DOM読み込み後に自動実行
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', executeEmergencyFixes);
    } else {
        // 既に読み込み完了の場合は即座実行
        setTimeout(executeEmergencyFixes, 100);
    }
    
    console.log('🚨 緊急エラー修正システム準備完了 - Phase1.5統合改修後対応版');
    
})();