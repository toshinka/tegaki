/**
 * 🔧 AppCore getAppState メソッド実装修正
 * 
 * 問題: api-gateway.js:476 this.app.getAppState is not a function
 * 対応: AppCore クラスに完全なgetAppStateメソッドを実装
 */

(function() {
    'use strict';
    
    console.log('🔧 AppCore getAppState メソッド修正開始');
    
    // ========================================
    // 🎯 getAppState 完全実装版
    // ========================================
    
    /**
     * AppCore用 getAppState完全実装
     */
    function implementGetAppState() {
        if (!window.AppCore || !window.AppCore.prototype) {
            console.warn('⚠️ AppCore クラスが見つかりません');
            return false;
        }
        
        // 既にメソッドが存在する場合は上書きしない（安全確保）
        if (window.AppCore.prototype.getAppState) {
            console.log('ℹ️ AppCore.getAppState は既に実装済みです');
            return true;
        }
        
        // getAppState完全実装
        window.AppCore.prototype.getAppState = function() {
            try {
                console.log('📊 AppCore.getAppState 実行開始');
                
                // 基本状態情報
                const baseState = {
                    // Phase1.5統合改修対応
                    version: 'v1.5-Phase1.5-fixed',
                    phase: 'Phase1.5統合改修完了版',
                    initialized: this.initialized || false,
                    timestamp: Date.now()
                };
                
                // キャンバス情報
                const canvasState = {
                    width: this.canvasWidth || this.app?.view?.width || 800,
                    height: this.canvasHeight || this.app?.view?.height || 600,
                    backgroundColor: this.canvasBackgroundColor || 0xf0e0d6,
                    backgroundHex: this.canvasBackgroundHex || '#f0e0d6',
                    pixiApp: !!this.app,
                    renderer: this.app?.renderer?.type || 'unknown'
                };
                
                // ツール情報
                const toolState = {
                    currentTool: this.toolSystem?.currentTool || 
                                this.currentTool || 
                                'pen',
                    brushSize: this.toolSystem?.brushSize || 
                              this.brushSize || 
                              (window.configManager ? window.configManager.get('brush.defaultSize') : 16),
                    brushColor: this.toolSystem?.brushColor || 
                               this.brushColor || 
                               (window.configManager ? window.configManager.get('brush.defaultColor') : 0x800000),
                    brushOpacity: this.toolSystem?.brushOpacity || 
                                 this.brushOpacity || 
                                 (window.configManager ? window.configManager.get('brush.defaultOpacity') : 85),
                    isDrawing: this.toolSystem?.isDrawing || this.isDrawing || false
                };
                
                // UI状態
                const uiState = {
                    initialized: !!this.uiController,
                    activePopups: this.uiController?.getActivePopups?.() || [],
                    compactMode: this.uiController?.compactMode || false
                };
                
                // パフォーマンス情報
                const performanceState = {
                    fps: this.performanceMonitor?.getCurrentFPS?.() || 0,
                    memory: this.performanceMonitor?.getMemoryUsage?.() || 0,
                    initialized: !!this.performanceMonitor
                };
                
                // Phase1.5統合管理システム状態
                const managersState = {
                    config: {
                        available: !!window.configManager,
                        settingsCount: window.configManager?.countSettings?.() || 0
                    },
                    error: {
                        available: !!window.errorManager,
                        errorCount: window.errorManager?.getErrorStats?.()?.total || 0
                    },
                    initialization: {
                        available: !!window.initializationManager,
                        status: window.initializationManager?.getInitializationStatus?.() || null
                    },
                    apiGateway: {
                        available: !!window.apiGateway,
                        type: window.apiGateway?.constructor?.name || 'unknown'
                    }
                };
                
                // 描画履歴情報
                const historyState = {
                    commandCount: this.getCommandCount ? this.getCommandCount() : 
                                 this.commandHistory?.length || 0,
                    canUndo: this.canUndo ? this.canUndo() : false,
                    canRedo: this.canRedo ? this.canRedo() : false,
                    totalDrawTime: this.getTotalDrawTime ? this.getTotalDrawTime() : 0
                };
                
                // 依存関係状態
                const dependenciesState = {
                    pixi: {
                        available: typeof PIXI !== 'undefined',
                        version: typeof PIXI !== 'undefined' ? PIXI.VERSION : 'unknown'
                    },
                    lodash: !!window._,
                    extensions: !!window.PixiExtensionsManager
                };
                
                // 診断情報
                const diagnosticsState = {
                    errors: this.getErrors ? this.getErrors() : [],
                    warnings: this.getWarnings ? this.getWarnings() : [],
                    lastError: this.lastError || null
                };
                
                // 完全な状態オブジェクト構築
                const completeState = {
                    // メタ情報
                    ...baseState,
                    
                    // 主要状態
                    canvas: canvasState,
                    tool: toolState,
                    ui: uiState,
                    performance: performanceState,
                    
                    // Phase1.5統合システム
                    managers: managersState,
                    
                    // 機能状態
                    history: historyState,
                    dependencies: dependenciesState,
                    diagnostics: diagnosticsState,
                    
                    // 設定情報（ConfigManager統合対応）
                    settings: window.configManager ? {
                        canvas: window.configManager.getSection?.('canvas') || {},
                        brush: window.configManager.getSection?.('brush') || {},
                        ui: window.configManager.getSection?.('ui') || {},
                        performance: window.configManager.getSection?.('performance') || {}
                    } : {
                        // フォールバック設定
                        canvas: { defaultWidth: 800, defaultHeight: 600 },
                        brush: { defaultSize: 16, defaultColor: 0x800000 },
                        ui: {},
                        performance: { targetFPS: 60 }
                    }
                };
                
                console.log('✅ AppCore.getAppState 実行完了');
                
                return completeState;
                
            } catch (error) {
                console.error('❌ AppCore.getAppState 実行エラー:', error);
                
                // エラー時のフォールバック状態
                return {
                    version: 'v1.5-Phase1.5-error',
                    initialized: false,
                    error: error.message,
                    timestamp: Date.now(),
                    fallback: true,
                    // 最小限の安全な状態
                    canvas: { width: 800, height: 600 },
                    tool: { currentTool: 'pen', brushSize: 16 },
                    managers: {
                        config: { available: !!window.configManager },
                        error: { available: !!window.errorManager }
                    }
                };
            }
        };
        
        console.log('✅ AppCore.getAppState メソッド実装完了');
        return true;
    }
    
    // ========================================
    // 🔧 補助メソッド実装
    // ========================================
    
    /**
     * 不足している補助メソッドを実装
     */
    function implementHelperMethods() {
        if (!window.AppCore || !window.AppCore.prototype) {
            return false;
        }
        
        // getTotalDrawTime 実装
        if (!window.AppCore.prototype.getTotalDrawTime) {
            window.AppCore.prototype.getTotalDrawTime = function() {
                return this.totalDrawTime || 
                       this.performanceMonitor?.getTotalDrawTime?.() || 
                       0;
            };
        }
        
        // getCommandCount 実装
        if (!window.AppCore.prototype.getCommandCount) {
            window.AppCore.prototype.getCommandCount = function() {
                return this.commandHistory?.length || 
                       this.memoryManager?.getCommandCount?.() || 
                       0;
            };
        }
        
        // canUndo 実装
        if (!window.AppCore.prototype.canUndo) {
            window.AppCore.prototype.canUndo = function() {
                return this.memoryManager?.canUndo?.() || 
                       (this.commandHistory && this.commandHistory.length > 0) || 
                       false;
            };
        }
        
        // canRedo 実装
        if (!window.AppCore.prototype.canRedo) {
            window.AppCore.prototype.canRedo = function() {
                return this.memoryManager?.canRedo?.() || 
                       (this.redoHistory && this.redoHistory.length > 0) || 
                       false;
            };
        }
        
        // getErrors 実装
        if (!window.AppCore.prototype.getErrors) {
            window.AppCore.prototype.getErrors = function() {
                return this.errors || 
                       (window.errorManager ? window.errorManager.getErrors?.() : []) || 
                       [];
            };
        }
        
        // getWarnings 実装
        if (!window.AppCore.prototype.getWarnings) {
            window.AppCore.prototype.getWarnings = function() {
                return this.warnings || 
                       (window.errorManager ? window.errorManager.getWarnings?.() : []) || 
                       [];
            };
        }
        
        console.log('✅ AppCore 補助メソッド実装完了');
        return true;
    }
    
    // ========================================
    // 🎯 ConfigManager統合対応
    // ========================================
    
    /**
     * AppCore の ConfigManager統合対応
     */
    function integrateAppCoreWithConfigManager() {
        if (!window.AppCore || !window.AppCore.prototype || !window.configManager) {
            return false;
        }
        
        // canvasWidth プロパティ getter/setter
        if (!Object.getOwnPropertyDescriptor(window.AppCore.prototype, 'canvasWidth')) {
            Object.defineProperty(window.AppCore.prototype, 'canvasWidth', {
                get: function() {
                    return window.configManager.get('canvas.defaultWidth') || 
                           this._canvasWidth || 800;
                },
                set: function(value) {
                    this._canvasWidth = value;
                    if (window.configManager) {
                        window.configManager.set('canvas.defaultWidth', value);
                    }
                },
                enumerable: true,
                configurable: true
            });
        }
        
        // canvasHeight プロパティ getter/setter
        if (!Object.getOwnPropertyDescriptor(window.AppCore.prototype, 'canvasHeight')) {
            Object.defineProperty(window.AppCore.prototype, 'canvasHeight', {
                get: function() {
                    return window.configManager.get('canvas.defaultHeight') || 
                           this._canvasHeight || 600;
                },
                set: function(value) {
                    this._canvasHeight = value;
                    if (window.configManager) {
                        window.configManager.set('canvas.defaultHeight', value);
                    }
                },
                enumerable: true,
                configurable: true
            });
        }
        
        // canvasBackgroundColor プロパティ getter/setter
        if (!Object.getOwnPropertyDescriptor(window.AppCore.prototype, 'canvasBackgroundColor')) {
            Object.defineProperty(window.AppCore.prototype, 'canvasBackgroundColor', {
                get: function() {
                    return window.configManager.get('canvas.backgroundColor') || 
                           this._canvasBackgroundColor || 0xf0e0d6;
                },
                set: function(value) {
                    this._canvasBackgroundColor = value;
                    if (window.configManager) {
                        window.configManager.set('canvas.backgroundColor', value);
                    }
                },
                enumerable: true,
                configurable: true
            });
        }
        
        console.log('✅ AppCore ConfigManager統合完了');
        return true;
    }
    
    // ========================================
    // 🛡️ APIGateway this.app.getAppState エラー対策
    // ========================================
    
    /**
     * APIGateway の getAppState 呼び出しエラー対策
     */
    function fixAPIGatewayGetAppStateCall() {
        // APIGateway クラスの修正
        if (window.APIGateway && window.APIGateway.prototype) {
            const originalGetState = window.APIGateway.prototype.getState;
            
            window.APIGateway.prototype.getState = function() {
                try {
                    // app.getAppState が存在するかチェック
                    if (this.app && typeof this.app.getAppState === 'function') {
                        return this.app.getAppState();
                    } else if (originalGetState) {
                        return originalGetState.call(this);
                    } else {
                        // フォールバック状態
                        return {
                            success: true,
                            initialized: !!this.app,
                            fallback: true,
                            version: 'v1.5-Phase1.5-apigateway-fallback',
                            timestamp: Date.now()
                        };
                    }
                } catch (error) {
                    console.error('❌ APIGateway.getState エラー:', error);
                    return {
                        success: false,
                        error: error.message,
                        fallback: true,
                        timestamp: Date.now()
                    };
                }
            };
            
            console.log('✅ APIGateway getState 呼び出し修正完了');
            return true;
        }
        
        return false;
    }
    
    // ========================================
    // 🚀 修正実行
    // ========================================
    
    /**
     * 全修正実行
     */
    function executeAppCoreGetAppStateFixes() {
        console.group('🔧 AppCore getAppState 修正実行');
        
        const results = {
            getAppState: false,
            helpers: false,
            configIntegration: false,
            apiGatewayFix: false
        };
        
        try {
            // Step1: getAppState メソッド実装
            results.getAppState = implementGetAppState();
            
            // Step2: 補助メソッド実装
            results.helpers = implementHelperMethods();
            
            // Step3: ConfigManager統合
            results.configIntegration = integrateAppCoreWithConfigManager();
            
            // Step4: APIGateway修正
            results.apiGatewayFix = fixAPIGatewayGetAppStateCall();
            
            const successCount = Object.values(results).filter(Boolean).length;
            console.log(`✅ AppCore修正完了: ${successCount}/4`);
            
            return results;
            
        } catch (error) {
            console.error('❌ AppCore修正エラー:', error);
            return { ...results, error: error.message };
        } finally {
            console.groupEnd();
        }
    }
    
    // ========================================
    // 🔍 動作確認システム
    // ========================================
    
    /**
     * getAppState動作確認
     */
    function testGetAppStateFunction() {
        console.group('🧪 getAppState 動作確認');
        
        const testResults = {
            appCoreExists: !!window.AppCore,
            prototypeExists: !!(window.AppCore && window.AppCore.prototype),
            getAppStateExists: !!(window.AppCore && window.AppCore.prototype && window.AppCore.prototype.getAppState),
            canExecute: false,
            executionResult: null
        };
        
        try {
            if (testResults.getAppStateExists) {
                // AppCoreインスタンス確認
                let appCoreInstance = null;
                
                // 各種方法でAppCoreインスタンスを取得試行
                if (window.futabaDrawingTool && window.futabaDrawingTool.appCore) {
                    appCoreInstance = window.futabaDrawingTool.appCore;
                } else if (window.appCore) {
                    appCoreInstance = window.appCore;
                } else {
                    // テスト用インスタンス作成
                    appCoreInstance = new window.AppCore();
                }
                
                if (appCoreInstance) {
                    const result = appCoreInstance.getAppState();
                    testResults.canExecute = true;
                    testResults.executionResult = result;
                    
                    console.log('✅ getAppState 実行成功:', result);
                } else {
                    console.warn('⚠️ AppCore インスタンスが見つかりません');
                }
            }
            
        } catch (error) {
            console.error('❌ getAppState テストエラー:', error);
            testResults.executionResult = { error: error.message };
        }
        
        console.log('🧪 テスト結果:', testResults);
        console.groupEnd();
        
        return testResults;
    }
    
    /**
     * APIGateway統合テスト
     */
    function testAPIGatewayIntegration() {
        console.group('🧪 APIGateway統合テスト');
        
        const testResults = {
            apiGatewayExists: !!window.APIGateway,
            futabaExists: !!window.futaba,
            canGetState: false,
            getStateResult: null
        };
        
        try {
            // window.futaba.getState() テスト
            if (window.futaba && typeof window.futaba.getState === 'function') {
                const result = window.futaba.getState();
                testResults.canGetState = true;
                testResults.getStateResult = result;
                
                console.log('✅ futaba.getState() 実行成功:', result);
            } else {
                console.warn('⚠️ window.futaba.getState が利用できません');
            }
            
            // APIGateway直接テスト
            if (window.apiGateway && typeof window.apiGateway.getState === 'function') {
                const result = window.apiGateway.getState();
                console.log('✅ apiGateway.getState() 実行成功:', result);
            } else {
                console.warn('⚠️ window.apiGateway.getState が利用できません');
            }
            
        } catch (error) {
            console.error('❌ APIGateway統合テストエラー:', error);
            testResults.getStateResult = { error: error.message };
        }
        
        console.log('🧪 APIGateway統合テスト結果:', testResults);
        console.groupEnd();
        
        return testResults;
    }
    
    // ========================================
    // 🎯 PixiJS v8対応準備
    // ========================================
    
    /**
     * PixiJS v8対応準備コメント追加
     */
    function addPixiV8PreparationComments() {
        if (window.AppCore && window.AppCore.prototype) {
            // v8対応準備情報をプロトタイプに追加
            window.AppCore.prototype._pixiV8Migration = {
                version: 'v7-to-v8-prep',
                changes: [
                    'Application初期化: new PIXI.Application() → await PIXI.Application.init()',
                    'Renderer分離: PIXI.Renderer → PIXI.WebGLRenderer/PIXI.CanvasRenderer',
                    'Loader廃止: PIXI.Loader → PIXI.Assets',
                    'Graphics API変更: beginFill/endFill → fill/stroke',
                    'Texture.from変更: 非同期化'
                ],
                preparation: {
                    compatibilityLayer: 'pixi-extensions.js で対応予定',
                    migrationFlag: 'config.v8Migration.enabled',
                    fallbackSupport: true
                }
            };
            
            console.log('📝 PixiJS v8対応準備コメント追加完了');
        }
    }
    
    // ========================================
    // 🚀 自動実行・初期化
    // ========================================
    
    // DOM読み込み後に自動実行
    function initializeAppCoreGetAppStateFix() {
        const fixes = executeAppCoreGetAppStateFixes();
        
        // PixiJS v8準備
        addPixiV8PreparationComments();
        
        // 動作確認テスト
        setTimeout(function() {
            const appCoreTest = testGetAppStateFunction();
            const apiGatewayTest = testAPIGatewayIntegration();
            
            // グローバルテスト結果保存
            window.__APP_CORE_FIX_RESULTS = {
                fixes: fixes,
                tests: {
                    appCore: appCoreTest,
                    apiGateway: apiGatewayTest
                },
                timestamp: Date.now()
            };
            
            console.log('📊 AppCore getAppState修正完了 - 結果:', window.__APP_CORE_FIX_RESULTS);
        }, 200);
        
        return fixes;
    }
    
    // 初期化実行
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeAppCoreGetAppStateFix);
    } else {
        setTimeout(initializeAppCoreGetAppStateFix, 100);
    }
    
    // ========================================
    // 🔧 緊急復旧用グローバル関数
    // ========================================
    
    /**
     * 緊急時 getAppState 復旧関数
     */
    window.emergencyFixGetAppState = function() {
        console.log('🚨 緊急 getAppState 復旧実行');
        
        const results = executeAppCoreGetAppStateFixes();
        
        // 即座動作確認
        const test = testGetAppStateFunction();
        
        return {
            fixes: results,
            test: test,
            success: test.canExecute,
            timestamp: Date.now()
        };
    };
    
    /**
     * AppCore状態診断関数
     */
    window.diagnoseAppCore = function() {
        console.group('🔍 AppCore 状態診断');
        
        const diagnosis = {
            class: {
                exists: !!window.AppCore,
                prototype: !!(window.AppCore && window.AppCore.prototype),
                constructable: false
            },
            methods: {},
            instances: {
                futabaDrawingTool: !!(window.futabaDrawingTool && window.futabaDrawingTool.appCore),
                global: !!window.appCore,
                accessible: false
            },
            integration: {
                configManager: !!window.configManager,
                errorManager: !!window.errorManager,
                apiGateway: !!window.apiGateway
            }
        };
        
        try {
            // クラス構築テスト
            if (window.AppCore) {
                try {
                    new window.AppCore();
                    diagnosis.class.constructable = true;
                } catch (e) {
                    diagnosis.class.constructorError = e.message;
                }
            }
            
            // メソッド存在確認
            if (window.AppCore && window.AppCore.prototype) {
                const methods = ['getAppState', 'initialize', 'getTotalDrawTime', 'getCommandCount'];
                methods.forEach(method => {
                    diagnosis.methods[method] = typeof window.AppCore.prototype[method] === 'function';
                });
            }
            
            // インスタンスアクセス確認
            let appCoreInstance = null;
            if (window.futabaDrawingTool && window.futabaDrawingTool.appCore) {
                appCoreInstance = window.futabaDrawingTool.appCore;
            } else if (window.appCore) {
                appCoreInstance = window.appCore;
            }
            
            diagnosis.instances.accessible = !!appCoreInstance;
            
            if (appCoreInstance && appCoreInstance.getAppState) {
                try {
                    const state = appCoreInstance.getAppState();
                    diagnosis.instances.getAppStateWorking = true;
                    diagnosis.instances.sampleState = state;
                } catch (e) {
                    diagnosis.instances.getAppStateError = e.message;
                }
            }
            
        } catch (error) {
            diagnosis.error = error.message;
        }
        
        console.log('🔍 AppCore診断結果:', diagnosis);
        console.groupEnd();
        
        return diagnosis;
    };
    
    console.log('🔧 AppCore getAppState 修正システム準備完了');
    
})();