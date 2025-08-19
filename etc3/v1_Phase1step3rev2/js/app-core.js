/**
 * 🎯 AppCore 状態管理設計修正版
 * 🎨 ふたば☆お絵描きツール - PixiJS統合システム
 * 
 * 🔧 修正点: 
 * - StateManager.updateState()削除（存在しない機能）
 * - EventBusによる状態変更通知パターン統一
 * - 状態管理の責任範囲明確化
 * - DRY・SOLID原則準拠の設計修正
 * 
 * 📋 設計思想:
 * - StateManager: 状態取得専用（現状維持）
 * - AppCore: 内部状態管理 + EventBus通知
 * - EventBus: 状態変更通知の統一インターフェース
 * 
 * ⚠⚠⚠ ESM禁止: import/export使用禁止・Pure JavaScript維持 ⚠⚠⚠
 */

/**
 * AppCore - PixiJS Application管理専用クラス（状態管理修正版）
 * 🎯 責任範囲: PixiJS初期化・基本Stage管理・外部システム統合・内部状態管理
 */
class AppCore {
    constructor() {
        // 基本プロパティ
        this.app = null;
        this.width = 800;
        this.height = 600;
        this.isInitialized = false;
        
        // コンテナ
        this.drawingContainer = null;
        this.uiContainer = null;
        
        // 外部システム統合（責任分離）
        this.boundaryManager = null;
        this.coordinateManager = null;
        
        // 統合ステータス
        this.integrationStatus = {
            boundary: false,
            coordinate: false,
            unified: false
        };
        
        // 🔧 追加: 内部状態管理
        this.internalState = {
            initialized: false,
            dimensions: { width: 800, height: 600 },
            lastUpdate: Date.now(),
            changeHistory: []
        };
        
        console.log('📦 AppCore: 構築完了（状態管理修正版）');
    }

    /**
     * AppCore初期化（PixiJS管理のみ）
     */
    async initialize(options) {
        try {
            console.log('🚀 AppCore: 初期化開始（状態管理修正版）...');
            
            // オプション設定
            const opts = options || {};
            this.width = opts.width || 800;
            this.height = opts.height || 600;
            
            // PixiJS Application作成
            await this.createPixiApplication(opts);
            
            // 基本設定
            this.setupBasicConfiguration();
            
            // 描画ステージ初期化
            this.initializeDrawingStage();
            
            // 外部システム統合
            this.integrateBoundarySystem();
            this.integrateCoordinateSystem();
            this.integrateUnifiedSystems();
            
            this.isInitialized = true;
            
            // 🔧 修正: 内部状態更新
            this.updateInternalState('initialized', true);
            this.updateInternalState('dimensions', { width: this.width, height: this.height });
            
            console.log('✅ AppCore: 初期化完了（状態管理修正版）');
            
            // EventBus通知（安全呼び出し）
            this.safeEmitEvent('appcore.initialized', {
                width: this.width,
                height: this.height,
                integration: this.integrationStatus,
                timestamp: Date.now()
            });
            
            return true;
            
        } catch (error) {
            console.error('❌ AppCore破棄エラー:', error);
        }
    }
}

// ==========================================
// 🎯 グローバル診断・テストコマンド
// ==========================================

/**
 * AppCore診断コマンド（状態管理対応版）
 */
if (typeof window !== 'undefined') {
    window.diagnoseAppCore = function() {
        const appCore = window.appCore || 
                       window.futabaDrawingTool?.appCore ||
                       window.canvasManager?.appCore;
        
        if (!appCore) {
            return {
                error: 'AppCoreが利用できません',
                appCore: false,
                window: {
                    appCore: !!window.appCore,
                    futabaDrawingTool: !!window.futabaDrawingTool,
                    canvasManager: !!window.canvasManager
                }
            };
        }
        
        return {
            core: {
                initialized: appCore.isInitialized,
                pixiApp: !!appCore.app,
                stage: !!appCore.app?.stage,
                renderer: !!appCore.app?.renderer,
                dimensions: { width: appCore.width, height: appCore.height }
            },
            containers: {
                drawing: !!appCore.drawingContainer,
                ui: !!appCore.uiContainer,
                stageChildren: appCore.app?.stage?.children?.length || 0
            },
            integration: appCore.getIntegrationStatus ? appCore.getIntegrationStatus() : {},
            internalState: appCore.getInternalState ? appCore.getInternalState() : {},
            systems: {
                configManager: !!window.ConfigManager,
                errorManager: !!window.ErrorManager,
                eventBus: !!window.EventBus,
                stateManager: !!window.StateManager,
                boundaryManager: !!window.BoundaryManager,
                coordinateManager: !!window.CoordinateManager
            },
            performance: {
                ready: appCore.isReady ? appCore.isReady() : false,
                canvas: !!appCore.getCanvas()
            }
        };
    };

    /**
     * AppCore状態管理テスト
     */
    window.testAppCoreStateManagement = function() {
        console.group('🧪 AppCore状態管理テスト実行');
        
        const appCore = window.appCore || window.futabaDrawingTool?.appCore;
        if (!appCore) {
            console.error('❌ AppCoreが見つかりません');
            console.groupEnd();
            return { success: false, error: 'AppCore not found' };
        }
        
        const tests = [
            {
                name: '内部状態管理機能確認',
                test: function() {
                    return typeof appCore.updateInternalState === 'function' &&
                           typeof appCore.getInternalState === 'function';
                }
            },
            {
                name: '状態変更通知機能確認',
                test: function() {
                    return typeof appCore.notifyStateChange === 'function';
                }
            },
            {
                name: 'EventBus状態通知確認',
                test: function() {
                    return typeof appCore.safeEmitEvent === 'function';
                }
            },
            {
                name: '内部状態データ存在確認',
                test: function() {
                    const state = appCore.getInternalState();
                    return state && state.current && typeof state.current.initialized === 'boolean';
                }
            },
            {
                name: '状態変更履歴機能確認',
                test: function() {
                    const state = appCore.getInternalState();
                    return state && Array.isArray(state.current.changeHistory);
                }
            }
        ];
        
        let passCount = 0;
        const results = [];
        
        for (let i = 0; i < tests.length; i++) {
            const testCase = tests[i];
            try {
                const result = testCase.test();
                const passed = !!result;
                
                console.log((passed ? '✅' : '❌') + ' ' + testCase.name + ': ' + (passed ? 'PASS' : 'FAIL'));
                
                if (passed) passCount++;
                
                results.push({
                    name: testCase.name,
                    passed: passed,
                    result: result
                });
                
            } catch (error) {
                console.log('❌ ' + testCase.name + ': FAIL (' + error.message + ')');
                results.push({
                    name: testCase.name,
                    passed: false,
                    error: error.message
                });
            }
        }
        
        const success = passCount === tests.length;
        console.log('📊 状態管理テスト結果: ' + passCount + '/' + tests.length + ' パス');
        
        if (success) {
            console.log('✅ 状態管理機能完全動作');
        } else {
            console.warn('⚠️ 一部状態管理機能に問題');
        }
        
        console.groupEnd();
        
        return {
            success: success,
            passCount: passCount,
            totalTests: tests.length,
            results: results
        };
    };

    /**
     * AppCore統計取得コマンド（状態管理対応版）
     */
    window.getAppCoreStats = function() {
        const appCore = window.appCore || 
                       window.futabaDrawingTool?.appCore ||
                       window.canvasManager?.appCore;
        
        if (!appCore) {
            return { error: 'AppCore統計が利用できません' };
        }
        
        return {
            system: {
                initialized: appCore.isInitialized,
                ready: appCore.isReady ? appCore.isReady() : false,
                dimensions: { width: appCore.width, height: appCore.height },
                integrationStatus: appCore.integrationStatus
            },
            pixi: {
                app: !!appCore.app,
                stage: !!appCore.app?.stage,
                renderer: appCore.app?.renderer?.type || 'unknown',
                children: appCore.app?.stage?.children?.length || 0
            },
            managers: {
                boundary: !!appCore.boundaryManager,
                coordinate: !!appCore.coordinateManager
            },
            unified: {
                configManager: !!window.ConfigManager,
                errorManager: !!window.ErrorManager,
                eventBus: !!window.EventBus,
                stateManager: !!window.StateManager
            },
            stateManagement: appCore.getInternalState ? appCore.getInternalState() : null
        };
    };

    /**
     * AppCore統合テスト実行（状態管理対応版）
     */
    window.testAppCoreIntegration = function() {
        console.group('🧪 AppCore統合テスト実行（状態管理対応版）');
        
        const tests = [
            {
                name: 'AppCore初期化確認',
                test: function() {
                    const appCore = window.appCore || window.futabaDrawingTool?.appCore;
                    return appCore && appCore.isReady ? appCore.isReady() : false;
                }
            },
            {
                name: 'PixiJS Application確認',
                test: function() {
                    const appCore = window.appCore || window.futabaDrawingTool?.appCore;
                    return !!(appCore?.app && appCore.app.stage);
                }
            },
            {
                name: 'DrawingContainer確認',
                test: function() {
                    const appCore = window.appCore || window.futabaDrawingTool?.appCore;
                    return !!appCore?.drawingContainer;
                }
            },
            {
                name: '統一システム統合確認',
                test: function() {
                    return !!(window.ConfigManager && window.ErrorManager && 
                             window.EventBus && window.StateManager);
                }
            },
            {
                name: 'BoundaryManager統合確認',
                test: function() {
                    const appCore = window.appCore || window.futabaDrawingTool?.appCore;
                    return !appCore || !!appCore.boundaryManager || !window.BoundaryManager;
                }
            },
            {
                name: 'CoordinateManager統合確認',
                test: function() {
                    const appCore = window.appCore || window.futabaDrawingTool?.appCore;
                    return !appCore || !!appCore.coordinateManager || !window.CoordinateManager;
                }
            },
            {
                name: '状態管理機能確認',
                test: function() {
                    const appCore = window.appCore || window.futabaDrawingTool?.appCore;
                    return appCore && typeof appCore.getInternalState === 'function' &&
                           typeof appCore.updateInternalState === 'function';
                }
            }
        ];
        
        let passCount = 0;
        const results = [];
        
        for (let i = 0; i < tests.length; i++) {
            const testCase = tests[i];
            try {
                const result = testCase.test();
                const passed = !!result;
                
                console.log((passed ? '✅' : '❌') + ' ' + testCase.name + ': ' + (passed ? 'PASS' : 'FAIL'));
                
                if (passed) passCount++;
                
                results.push({
                    name: testCase.name,
                    passed: passed,
                    result: result
                });
                
            } catch (error) {
                console.log('❌ ' + testCase.name + ': FAIL (' + error.message + ')');
                results.push({
                    name: testCase.name,
                    passed: false,
                    error: error.message
                });
            }
        }
        
        const success = passCount === tests.length;
        console.log('📊 AppCore統合テスト結果: ' + passCount + '/' + tests.length + ' パス');
        
        if (success) {
            console.log('✅ AppCore統合完全成功（状態管理対応版）');
        } else {
            console.warn('⚠️ 一部テスト失敗 - 実装確認が必要');
        }
        
        console.groupEnd();
        
        return {
            success: success,
            passCount: passCount,
            totalTests: tests.length,
            results: results
        };
    };
}

console.log('🎯 AppCore状態管理設計修正版実装完了');
console.log('✅ 修正項目:');
console.log('  - StateManager.updateState()削除（存在しない機能の呼び出し削除）');
console.log('  - EventBusによる状態変更通知パターン統一');
console.log('  - 内部状態管理機能追加（updateInternalState, getInternalState）');
console.log('  - 状態変更履歴機能追加（changeHistory管理）');
console.log('  - 状態管理の責任範囲明確化（AppCore内部 + EventBus通知）');
console.log('  - DRY・SOLID原則準拠の設計修正');
console.log('  - 診断・テストコマンド: window.testAppCoreStateManagement等');
console.log('🔧 設計思想:');
console.log('  - StateManager: 状態取得専用（現状維持）');
console.log('  - AppCore: 内部状態管理 + EventBus通知');
console.log('  - EventBus: 状態変更通知の統一インターフェース');

    /**
     * PixiJS Application作成 (v7対応)
     */
    async createPixiApplication(options) {
        console.log('🎨 PixiJS Application作成開始...');
        
        const pixiOptions = {
            width: this.width,
            height: this.height,
            backgroundColor: options.backgroundColor || 0xFFFFFF,
            resolution: window.devicePixelRatio || 1,
            autoDensity: true,
            antialias: true,
            preserveDrawingBuffer: true
        };
        
        // PixiJS v7: new PIXI.Application()で初期化完了
        this.app = new PIXI.Application(pixiOptions);
        
        console.log('📱 PixiJS Application作成完了:', this.width + 'x' + this.height);
        
        // AppとCanvasの確認
        if (!this.app) {
            throw new Error('PixiJS Application作成に失敗しました');
        }
        
        if (!this.app.stage) {
            throw new Error('PixiJS Stage作成に失敗しました');
        }
        
        console.log('✅ PixiJS Application/Stage検証完了');
    }

    /**
     * Stage基本設定
     */
    setupBasicConfiguration() {
        if (!this.app || !this.app.stage) {
            throw new Error('PixiJS Stageが利用できません');
        }
        
        // Stage基本設定
        this.app.stage.eventMode = 'static';
        this.app.stage.hitArea = new PIXI.Rectangle(0, 0, this.width, this.height);
        this.app.stage.interactive = true;
        
        console.log('⚙️ AppCore: Stage基本設定完了');
    }

    /**
     * 描画ステージ初期化
     */
    initializeDrawingStage() {
        // メイン描画コンテナ
        this.drawingContainer = new PIXI.Container();
        this.app.stage.addChild(this.drawingContainer);
        
        // UI層コンテナ
        this.uiContainer = new PIXI.Container();
        this.app.stage.addChild(this.uiContainer);
        
        console.log('🎨 AppCore: 描画ステージ初期化完了');
    }

    /**
     * 境界システム統合（外部委譲）
     */
    integrateBoundarySystem() {
        try {
            if (typeof window.BoundaryManager === 'function') {
                console.log('🎯 BoundaryManager統合開始...');
                
                this.boundaryManager = new window.BoundaryManager(this);
                this.boundaryManager.initialize();
                
                this.integrationStatus.boundary = true;
                console.log('✅ BoundaryManager統合完了');
                
            } else {
                console.warn('⚠️ BoundaryManager未利用（オプション機能）');
                this.integrationStatus.boundary = false;
            }
        } catch (error) {
            console.error('❌ BoundaryManager統合エラー:', error);
            this.integrationStatus.boundary = false;
        }
    }

    /**
     * 座標システム統合（外部委譲）
     */
    integrateCoordinateSystem() {
        try {
            if (typeof window.CoordinateManager === 'function') {
                console.log('📍 CoordinateManager統合開始...');
                
                this.coordinateManager = new window.CoordinateManager(this);
                this.coordinateManager.initialize();
                
                this.integrationStatus.coordinate = true;
                console.log('✅ CoordinateManager統合完了');
                
            } else {
                console.warn('⚠️ CoordinateManager未利用（オプション機能）');
                this.integrationStatus.coordinate = false;
            }
        } catch (error) {
            console.error('❌ CoordinateManager統合エラー:', error);
            this.integrationStatus.coordinate = false;
        }
    }

    /**
     * 統一システム統合
     */
    integrateUnifiedSystems() {
        try {
            const systems = ['ConfigManager', 'ErrorManager', 'EventBus', 'StateManager'];
            const available = systems.filter(function(sys) { return !!window[sys]; });
            
            console.log('🔗 統一システム統合:', available.join(', '));
            
            this.integrationStatus.unified = available.length === systems.length;
            
            if (this.integrationStatus.unified) {
                // 統一システム完全統合時の追加設定
                this.setupUnifiedSystemsIntegration();
                console.log('✅ 統一システム完全統合完了');
            } else {
                console.warn('⚠️ 統一システム一部未利用:', 
                    systems.filter(function(sys) { return !window[sys]; }).join(', ')
                );
            }
            
        } catch (error) {
            console.error('❌ 統一システム統合エラー:', error);
            this.integrationStatus.unified = false;
        }
    }

    /**
     * 統一システム完全統合時の設定（修正版）
     */
    setupUnifiedSystemsIntegration() {
        console.log('🔧 統一システム統合設定（状態管理修正版）...');
        
        // ConfigManager設定
        if (window.ConfigManager) {
            this.config = window.ConfigManager.getAppCoreConfig ? window.ConfigManager.getAppCoreConfig() : {};
            console.log('✅ ConfigManager統合完了');
        }
        
        // EventBusリスナー設定
        if (window.EventBus) {
            const self = this;
            window.EventBus.on('canvas.resize', function(data) { self.handleCanvasResize(data); });
            window.EventBus.on('appcore.destroy', function() { self.destroy(); });
            console.log('✅ EventBusリスナー設定完了');
        }
        
        // 🔧 修正: StateManager.updateState()削除
        // ✅ 代替: EventBusによる状態変更通知
        this.safeEmitEvent('appcore.state.changed', {
            property: 'unified_systems',
            value: {
                initialized: true,
                integration: this.integrationStatus,
                dimensions: { width: this.width, height: this.height }
            },
            timestamp: Date.now()
        });
        
        console.log('✅ 状態変更通知完了（EventBus経由）');
        
        // StateManagerへの状態変更履歴通知
        this.notifyStateChange('appcore.initialized', true);
        this.notifyStateChange('appcore.dimensions', { width: this.width, height: this.height });
    }

    /**
     * 🔧 新機能: 内部状態更新
     */
    updateInternalState(key, value) {
        const previousValue = this.internalState[key];
        this.internalState[key] = value;
        this.internalState.lastUpdate = Date.now();
        
        // 変更履歴記録
        this.internalState.changeHistory.push({
            key: key,
            previousValue: previousValue,
            newValue: value,
            timestamp: Date.now()
        });
        
        // 履歴サイズ制限
        if (this.internalState.changeHistory.length > 50) {
            this.internalState.changeHistory.shift();
        }
        
        // EventBus通知
        this.safeEmitEvent('appcore.state.changed', {
            property: key,
            value: value,
            previous: previousValue,
            timestamp: Date.now()
        });
        
        console.log('📊 AppCore内部状態更新:', key, '=', value);
    }

    /**
     * 🔧 新機能: StateManagerへの状態変更通知
     */
    notifyStateChange(eventName, data) {
        try {
            // StateManagerの状態変更記録機能を活用
            if (window.StateManager && typeof window.StateManager.recordStateChange === 'function') {
                window.StateManager.recordStateChange(eventName, data);
            }
            
            // EventBusでも同時通知
            this.safeEmitEvent('state.change.recorded', {
                event: eventName,
                data: data,
                source: 'AppCore',
                timestamp: Date.now()
            });
            
        } catch (error) {
            console.warn('⚠️ 状態変更通知失敗:', eventName, error);
        }
    }

    /**
     * キャンバスリサイズ処理
     */
    resize(newWidth, newHeight) {
        try {
            console.log('📏 AppCore: リサイズ', newWidth + 'x' + newHeight);
            
            // 基本リサイズ
            this.width = newWidth;
            this.height = newHeight;
            
            if (this.app && this.app.renderer) {
                this.app.renderer.resize(newWidth, newHeight);
            }
            
            // Stage hitArea更新
            if (this.app && this.app.stage) {
                this.app.stage.hitArea = new PIXI.Rectangle(0, 0, newWidth, newHeight);
            }
            
            // 🔧 修正: 内部状態更新
            this.updateInternalState('dimensions', { width: newWidth, height: newHeight });
            
            // 外部システムリサイズ通知
            if (this.boundaryManager && typeof this.boundaryManager.handleResize === 'function') {
                this.boundaryManager.handleResize(newWidth, newHeight);
            }
            
            if (this.coordinateManager && typeof this.coordinateManager.handleResize === 'function') {
                this.coordinateManager.handleResize(newWidth, newHeight);
            }
            
            // EventBus通知
            this.safeEmitEvent('appcore.resized', {
                width: newWidth,
                height: newHeight,
                timestamp: Date.now()
            });
            
            console.log('✅ AppCore: リサイズ完了');
            
        } catch (error) {
            console.error('❌ AppCore: リサイズエラー:', error);
            this.safeShowError('appcore-resize', 
                'リサイズエラー: ' + error.message,
                { width: newWidth, height: newHeight }
            );
        }
    }

    /**
     * EventBusリサイズハンドラー
     */
    handleCanvasResize(data) {
        if (data && data.width && data.height) {
            this.resize(data.width, data.height);
        }
    }

    /**
     * DOM要素取得 (v7対応)
     */
    getCanvas() {
        return this.app ? (this.app.canvas || this.app.view) : null;
    }

    /**
     * 初期化状態確認
     */
    isReady() {
        return this.isInitialized && !!this.app && !!this.app.stage;
    }

    /**
     * システム統合状態確認
     */
    getIntegrationStatus() {
        return {
            boundary: this.integrationStatus.boundary,
            coordinate: this.integrationStatus.coordinate,
            unified: this.integrationStatus.unified,
            boundaryManager: !!this.boundaryManager,
            coordinateManager: !!this.coordinateManager,
            pixiApp: !!this.app,
            stage: !!this.app?.stage,
            drawingContainer: !!this.drawingContainer,
            uiContainer: !!this.uiContainer
        };
    }

    /**
     * 🔧 新機能: 内部状態取得
     */
    getInternalState() {
        return {
            current: this.internalState,
            integration: this.integrationStatus,
            ready: this.isReady(),
            lastUpdate: this.internalState.lastUpdate,
            changeHistoryCount: this.internalState.changeHistory.length
        };
    }

    /**
     * EventBus安全emit
     */
    safeEmitEvent(eventName, data) {
        try {
            if (window.EventBus && typeof window.EventBus.safeEmit === 'function') {
                window.EventBus.safeEmit(eventName, data);
            }
        } catch (error) {
            console.warn('⚠️ EventBus emit失敗: ' + eventName, error);
        }
    }

    /**
     * ErrorManager安全エラー表示
     */
    safeShowError(type, message, data) {
        try {
            if (window.ErrorManager && typeof window.ErrorManager.showError === 'function') {
                window.ErrorManager.showError(type, message, data);
            } else {
                console.error('❌ ' + type + ': ' + message, data);
            }
        } catch (error) {
            console.error('❌ ' + type + ': ' + message, data, error);
        }
    }

    /**
     * AppCore破棄処理
     */
    destroy() {
        try {
            console.log('🗑️ AppCore: 破棄処理開始...');
            
            // EventBusリスナー削除
            if (window.EventBus) {
                window.EventBus.off('canvas.resize', this.handleCanvasResize);
                window.EventBus.off('appcore.destroy', this.destroy);
            }
            
            // 外部システム破棄
            if (this.boundaryManager && typeof this.boundaryManager.destroy === 'function') {
                this.boundaryManager.destroy();
                this.boundaryManager = null;
            }
            
            if (this.coordinateManager && typeof this.coordinateManager.destroy === 'function') {
                this.coordinateManager.destroy();
                this.coordinateManager = null;
            }
            
            // PixiJS破棄
            if (this.app) {
                this.app.destroy(true);
                this.app = null;
            }
            
            // コンテナクリア
            this.drawingContainer = null;
            this.uiContainer = null;
            
            // ステータスクリア
            this.isInitialized = false;
            this.integrationStatus = {
                boundary: false,
                coordinate: false,
                unified: false
            };
            
            // 🔧 修正: 内部状態クリア
            this.internalState = {
                initialized: false,
                dimensions: { width: 0, height: 0 },
                lastUpdate: Date.now(),
                changeHistory: []
            };
            
            console.log('✅ AppCore: 破棄処理完了');
            
        } catch (