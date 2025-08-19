/**
 * 🎯 Phase1.2-STEP3.1修正版: AppCore初期化エラー完全解決
 * 🎨 ふたば☆お絵描きツール - PixiJS v7統合・AppCore構造統一
 * 
 * 🎯 修正点: PixiJS v7初期化・main.js期待構造統一・システムコンポーネント実装
 * 🎯 UNIFIED: ConfigManager, ErrorManager, EventBus, StateManager
 * 🎯 ISOLATION: 既存機能非回帰・境界処理独立性・main.js完全互換
 * 📋 PHASE: Phase1.2-STEP3.1初期化エラー解決版
 */

/**
 * AppCoreクラス - PixiJSアプリケーション管理（初期化エラー修正版）
 */
class AppCore {
    constructor() {
        // 基本プロパティ初期化
        this.app = null;
        this.width = 800;
        this.height = 600;
        this.isInitialized = false;
        
        // main.jsが期待するプロパティ（必須）
        this.drawingContainer = null;
        this.uiContainer = null;
        this.toolSystem = null;
        this.uiController = null;
        this.canvasWidth = 0;
        this.canvasHeight = 0;
        this.canvasElement = null;
        
        // 境界システム関連（初期化前は無効状態）
        this.boundaryIntegration = null;
        this.boundarySystemReady = false;
        this.expandedHitArea = null;
        this.stageBoundary = null;
        this.pixiBoundaryEvents = null;
        this.boundaryCoordinateSystem = null;
        
        // デバッグ関連
        this.boundaryDebugGraphics = null;
        this.boundaryDebugLogging = false;
        
        console.log('📦 AppCore: コンストラクター完了 (PixiJS v7対応・main.js互換)');
    }

    /**
     * PixiJSアプリケーション初期化（エラー修正版）
     */
    async initialize(options = {}) {
        try {
            console.log('✅ AppCore: システムコンポーネント初期化完了');
            console.log(`   - ToolSystem: ${this.toolSystem.tools.size}個のツール登録`);
            console.log(`   - UIController: ポップアップ管理機能有効`);
            console.log(`   - Current Tool: ${this.toolSystem.currentTool}`);
            
        } catch (error) {
            console.error('❌ システムコンポーネント初期化エラー:', error);
            throw new Error(`システムコンポーネント初期化失敗: ${error.message}`);
        }
    }

    /**
     * 統一システム設定取得（ConfigManager利用・フォールバック付き）
     */
    getAppCoreConfig() {
        if (!window.ConfigManager) {
            // フォールバック設定
            return {
                canvas: {
                    defaultWidth: 800,
                    defaultHeight: 600,
                    backgroundColor: 0xFFFFFF,
                    resolution: 'auto'
                },
                systems: {
                    toolSystemEnabled: true,
                    uiControllerEnabled: true,
                    boundarySystemEnabled: true
                },
                pixi: {
                    antialias: true,
                    preserveDrawingBuffer: true,
                    autoDensity: true
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
                window.EventBus.off('boundary.cross.in', this.handleBoundaryCrossInIntegration);
                window.EventBus.off('boundary.outside.start', this.handleBoundaryOutsideStart);
                window.EventBus.off('canvas.boundary.initialized', this.handleCanvasBoundaryInitialized);
            }
            
            // デバッグ可視化削除
            if (this.boundaryDebugGraphics) {
                this.app.stage.removeChild(this.boundaryDebugGraphics);
                this.boundaryDebugGraphics.destroy();
                this.boundaryDebugGraphics = null;
            }
            
            // PixiJSアプリケーション破棄
            if (this.app) {
                this.app.destroy(true);
                this.app = null;
            }
            
            // システムコンポーネントクリーンアップ
            this.toolSystem = null;
            this.uiController = null;
            this.drawingContainer = null;
            this.uiContainer = null;
            this.canvasElement = null;
            
            // 境界システムクリーンアップ
            this.boundaryIntegration = null;
            this.boundarySystemReady = false;
            this.expandedHitArea = null;
            this.stageBoundary = null;
            this.pixiBoundaryEvents = null;
            this.boundaryCoordinateSystem = null;
            
            // 状態リセット
            this.isInitialized = false;
            this.canvasWidth = 0;
            this.canvasHeight = 0;
            
            console.log('✅ AppCore: 破棄処理完了');
            
        } catch (error) {
            console.error('❌ AppCore破棄エラー:', error);
        }
    }

    // ==========================================
    // 🎯 デバッグ・診断システム
    // ==========================================

    /**
     * AppCore初期化診断
     */
    runInitializationDiagnosis() {
        console.group('🔍 AppCore初期化診断');
        
        const diagnosis = {
            pixiApplication: {
                exists: !!this.app,
                version: PIXI.VERSION || 'unknown',
                stage: !!this.app?.stage,
                renderer: !!this.app?.renderer,
                canvas: !!this.canvasElement
            },
            containers: {
                drawingContainer: !!this.drawingContainer,
                drawingContainerChildren: this.drawingContainer?.children.length || 0,
                uiContainer: !!this.uiContainer,
                uiContainerChildren: this.uiContainer?.children.length || 0
            },
            systems: {
                toolSystem: !!this.toolSystem,
                toolSystemInitialized: this.toolSystem?.initialized || false,
                currentTool: this.toolSystem?.currentTool || null,
                toolsCount: this.toolSystem?.tools?.size || 0,
                uiController: !!this.uiController,
                uiControllerInitialized: this.uiController?.initialized || false
            },
            properties: {
                canvasWidth: this.canvasWidth,
                canvasHeight: this.canvasHeight,
                width: this.width,
                height: this.height,
                initialized: this.isInitialized
            },
            boundary: {
                systemReady: this.boundarySystemReady,
                integration: !!this.boundaryIntegration,
                hitAreaExpanded: !!this.expandedHitArea,
                coordinateSystem: !!this.boundaryCoordinateSystem?.enabled
            },
            unifiedSystems: {
                configManager: !!window.ConfigManager,
                errorManager: !!window.ErrorManager,
                eventBus: !!window.EventBus,
                stateManager: !!window.StateManager
            }
        };
        
        console.log('📊 診断結果:', diagnosis);
        
        // 問題検出
        const issues = [];
        
        if (!diagnosis.pixiApplication.exists) {
            issues.push('PixiJS Applicationが作成されていません');
        }
        
        if (!diagnosis.pixiApplication.stage) {
            issues.push('PixiJS Stageが利用できません');
        }
        
        if (!diagnosis.containers.drawingContainer) {
            issues.push('DrawingContainerが作成されていません');
        }
        
        if (!diagnosis.systems.toolSystem) {
            issues.push('ToolSystemが初期化されていません');
        }
        
        if (!diagnosis.systems.uiController) {
            issues.push('UIControllerが初期化されていません');
        }
        
        if (diagnosis.properties.canvasWidth === 0 || diagnosis.properties.canvasHeight === 0) {
            issues.push('キャンバス寸法が設定されていません');
        }
        
        if (issues.length > 0) {
            console.warn('⚠️ 検出された問題:', issues);
        } else {
            console.log('✅ AppCore初期化正常完了');
        }
        
        console.groupEnd();
        
        return { diagnosis, issues };
    }

    /**
     * 境界デバッグ可視化（簡略版）
     */
    createBoundaryDebugVisualizer() {
        if (!this.app?.stage || !this.stageBoundary) return;
        
        try {
            // デバッググラフィクス作成
            const debugGraphics = new PIXI.Graphics();
            
            // 元のキャンバス境界（青線）
            debugGraphics.lineStyle(2, 0x0066CC, 0.8);
            const original = this.stageBoundary.original;
            debugGraphics.drawRect(original.x, original.y, original.width, original.height);
            
            // 拡張境界（赤線）
            if (this.stageBoundary.expanded) {
                debugGraphics.lineStyle(2, 0xFF0000, 0.5);
                const expanded = this.stageBoundary.expanded;
                debugGraphics.drawRect(expanded.x, expanded.y, expanded.width, expanded.height);
                
                // マージンエリア（半透明塗りつぶし）
                debugGraphics.beginFill(0x00FF00, 0.1);
                debugGraphics.drawRect(expanded.x, expanded.y, expanded.width, expanded.height);
                debugGraphics.endFill();
            }
            
            // Stageに追加
            this.app.stage.addChild(debugGraphics);
            this.boundaryDebugGraphics = debugGraphics;
            
            console.log('🎯 境界デバッグ可視化作成完了');
            
        } catch (error) {
            console.error('❌ 境界デバッグ可視化エラー:', error);
        }
    }

    /**
     * 境界デバッグモード有効化
     */
    enableBoundaryDebugMode() {
        if (!this.app?.stage) return;
        
        try {
            // デバッグ境界表示
            this.createBoundaryDebugVisualizer();
            
            // 詳細ログ有効化
            this.boundaryDebugLogging = true;
            
            console.log('🔍 AppCore境界デバッグモード有効');
            
        } catch (error) {
            console.error('❌ 境界デバッグモード有効化エラー:', error);
        }
    }

    // ==========================================
    // 🎯 EventBus統合ハンドラー（簡略版）
    // ==========================================

    /**
     * EventBus境界越えイン統合処理
     */
    handleBoundaryCrossInIntegration(data) {
        if (!this.boundaryIntegration?.eventIntegration) return;
        
        try {
            // PixiJS座標系に変換
            const pixiPoint = this.convertToPixiCoordinate(data.position.x, data.position.y);
            
            // 現在のツール取得
            const currentTool = this.toolSystem?.currentTool;
            
            if (this.boundaryIntegration.debugging) {
                console.log('📡 AppCore EventBus境界越えイン統合:', {
                    original: data.position,
                    pixi: pixiPoint,
                    tool: currentTool
                });
            }
            
        } catch (error) {
            console.error('❌ EventBus境界越えイン統合エラー:', error);
        }
    }

    /**
     * EventBus境界外開始処理
     */
    handleBoundaryOutsideStart(data) {
        if (!this.boundaryIntegration?.eventIntegration) return;
        
        try {
            // AppCore状態更新
            this.safeUpdateState('appcore.boundary.tracking', {
                active: true,
                pointerId: data.pointer.id,
                timestamp: Date.now()
            });
            
            if (this.boundaryIntegration.debugging) {
                console.log('📡 AppCore境界外開始通知:', data.pointer);
            }
            
        } catch (error) {
            console.error('❌ EventBus境界外開始処理エラー:', error);
        }
    }

    /**
     * Canvas境界システム初期化完了処理
     */
    handleCanvasBoundaryInitialized(data) {
        try {
            console.log('📡 AppCore: Canvas境界システム初期化完了通知受信');
            
            // AppCore境界統合準備完了
            this.boundarySystemReady = true;
            
            // StateManager状態更新
            this.safeUpdateState('appcore.boundary.system', {
                ready: true,
                canvasIntegrated: true,
                timestamp: Date.now()
            });
            
        } catch (error) {
            console.error('❌ Canvas境界初期化完了処理エラー:', error);
        }
    }

    // ==========================================
    // 🎯 PixiJSイベントハンドラー（完全版）
    // ==========================================

    /**
     * PixiJS境界PointerDownハンドラー
     */
    handlePixiBoundaryPointerDown(pixiEvent) {
        if (!this.boundaryIntegration?.enabled) return;
        
        try {
            // PixiJS座標を取得
            const localPoint = pixiEvent.data.getLocalPosition(this.app.stage);
            
            // 境界内判定
            const isInsideBoundary = this.isPointInsideBoundary(localPoint.x, localPoint.y);
            
            // 境界情報をイベントに追加
            pixiEvent.boundaryInfo = {
                insideBoundary: isInsideBoundary,
                localPosition: { x: localPoint.x, y: localPoint.y },
                margin: this.boundaryIntegration.hitAreaMargin,
                timestamp: performance.now()
            };
            
            // EventBus通知
            this.safeEmitEvent('pixijs.boundary.pointerdown', {
                pixiEvent: pixiEvent,
                boundaryInfo: pixiEvent.boundaryInfo
            });
            
            if (this.boundaryIntegration.debugging) {
                console.log('🎯 PixiJS境界PointerDown:', pixiEvent.boundaryInfo);
            }
            
        } catch (error) {
            console.error('❌ PixiJS境界PointerDownエラー:', error);
        }
    }

    /**
     * PixiJS境界PointerMoveハンドラー
     */
    handlePixiBoundaryPointerMove(pixiEvent) {
        if (!this.boundaryIntegration?.enabled) return;
        
        try {
            const localPoint = pixiEvent.data.getLocalPosition(this.app.stage);
            const isInsideBoundary = this.isPointInsideBoundary(localPoint.x, localPoint.y);
            
            // 境界越え検出
            const previousBoundaryState = pixiEvent.data.boundaryState || { insideBoundary: true };
            
            if (!previousBoundaryState.insideBoundary && isInsideBoundary) {
                // 境界外→内への移動検出
                this.handlePixiBoundaryCrossIn(pixiEvent, localPoint);
            } else if (previousBoundaryState.insideBoundary && !isInsideBoundary) {
                // 境界内→外への移動検出
                this.handlePixiBoundaryCrossOut(pixiEvent, localPoint);
            }
            
            // 境界状態更新
            pixiEvent.data.boundaryState = {
                insideBoundary: isInsideBoundary,
                lastPosition: { x: localPoint.x, y: localPoint.y },
                timestamp: performance.now()
            };
            
        } catch (error) {
            console.error('❌ PixiJS境界PointerMoveエラー:', error);
        }
    }

    /**
     * PixiJS境界PointerUpハンドラー
     */
    handlePixiBoundaryPointerUp(pixiEvent) {
        if (!this.boundaryIntegration?.enabled) return;
        
        try {
            // 境界状態クリーンアップ
            if (pixiEvent.data.boundaryState) {
                delete pixiEvent.data.boundaryState;
            }
            
            // EventBus通知
            this.safeEmitEvent('pixijs.boundary.pointerup', {
                pointerId: pixiEvent.data.pointerId,
                timestamp: performance.now()
            });
            
        } catch (error) {
            console.error('❌ PixiJS境界PointerUpエラー:', error);
        }
    }

    /**
     * PixiJS境界PointerCancelハンドラー
     */
    handlePixiBoundaryPointerCancel(pixiEvent) {
        if (!this.boundaryIntegration?.enabled) return;
        
        try {
            // 境界状態クリーンアップ
            if (pixiEvent.data.boundaryState) {
                delete pixiEvent.data.boundaryState;
            }
            
            console.log('🗑️ PixiJS境界PointerCancel:', pixiEvent.data.pointerId);
            
        } catch (error) {
            console.error('❌ PixiJS境界PointerCancelエラー:', error);
        }
    }

    /**
     * PixiJS境界越えイン処理
     */
    handlePixiBoundaryCrossIn(pixiEvent, localPoint) {
        try {
            // グローバル座標変換
            const globalPoint = this.app.stage.toGlobal(localPoint);
            
            // 境界越えデータ作成
            const crossInData = {
                tool: this.toolSystem?.currentTool || null,
                position: { x: localPoint.x, y: localPoint.y },
                globalPosition: { x: globalPoint.x, y: globalPoint.y },
                pressure: pixiEvent.data.pressure || 0.5,
                pointerId: pixiEvent.data.pointerId,
                pointerType: pixiEvent.data.pointerType || 'mouse',
                timestamp: performance.now(),
                source: 'pixijs-stage'
            };
            
            // EventBus境界越え通知
            this.safeEmitEvent('pixijs.boundary.cross.in', crossInData);
            
            if (this.boundaryIntegration.debugging) {
                console.log('🎯 PixiJS境界越えイン検出:', crossInData);
            }
            
        } catch (error) {
            console.error('❌ PixiJS境界越えイン処理エラー:', error);
        }
    }

    /**
     * PixiJS境界越えアウト処理
     */
    handlePixiBoundaryCrossOut(pixiEvent, localPoint) {
        try {
            const crossOutData = {
                position: { x: localPoint.x, y: localPoint.y },
                pointerId: pixiEvent.data.pointerId,
                timestamp: performance.now(),
                source: 'pixijs-stage'
            };
            
            // EventBus境界越えアウト通知
            this.safeEmitEvent('pixijs.boundary.cross.out', crossOutData);
            
            if (this.boundaryIntegration.debugging) {
                console.log('🎯 PixiJS境界越えアウト検出:', crossOutData);
            }
            
        } catch (error) {
            console.error('❌ PixiJS境界越えアウト処理エラー:', error);
        }
    }
}

// ==========================================
// 🚨 重要: AppCoreクラスのグローバル登録（必須）
// ==========================================
if (typeof window !== 'undefined') {
    window.AppCore = AppCore;
    console.log('📦 AppCoreクラス グローバル登録完了（初期化エラー修正版）');
}

// ==========================================
// 🎯 グローバル診断・テストコマンド
// ==========================================

if (typeof window !== 'undefined') {
    /**
     * AppCore初期化診断コマンド
     */
    window.diagnoseAppCoreInitialization = function() {
        const appCore = window.appCore || 
                       window.futabaDrawingTool?.appCore;
        
        if (!appCore || typeof appCore.runInitializationDiagnosis !== 'function') {
            return {
                error: 'AppCore初期化診断が利用できません',
                appCore: !!appCore,
                initSupport: !!appCore?.runInitializationDiagnosis
            };
        }
        
        return appCore.runInitializationDiagnosis();
    };

    /**
     * AppCore状態取得コマンド
     */
    window.getAppCoreState = function() {
        const appCore = window.appCore || 
                       window.futabaDrawingTool?.appCore;
        
        if (!appCore || typeof appCore.getAppCoreState !== 'function') {
            return { error: 'AppCore状態取得が利用できません' };
        }
        
        return appCore.getAppCoreState();
    };

    /**
     * PixiJS情報取得コマンド
     */
    window.getPixiJSInfo = function() {
        return {
            version: PIXI.VERSION || 'unknown',
            available: !!window.PIXI,
            application: !!(window.PIXI?.Application),
            container: !!(window.PIXI?.Container),
            graphics: !!(window.PIXI?.Graphics),
            rectangle: !!(window.PIXI?.Rectangle)
        };
    };

    /**
     * AppCore初期化テスト実行
     */
    window.testAppCoreInitialization = async function() {
        console.group('🧪 AppCore初期化テスト実行');
        
        const tests = [
            {
                name: 'PixiJS可用性確認',
                test: () => {
                    return !!(window.PIXI && PIXI.Application);
                }
            },
            {
                name: 'AppCore初期化確認',
                test: () => {
                    const appCore = window.appCore || window.futabaDrawingTool?.appCore;
                    return appCore?.isReady();
                }
            },
            {
                name: 'DrawingContainer作成確認',
                test: () => {
                    const appCore = window.appCore || window.futabaDrawingTool?.appCore;
                    return !!appCore?.drawingContainer;
                }
            },
            {
                name: 'ToolSystem初期化確認',
                test: () => {
                    const appCore = window.appCore || window.futabaDrawingTool?.appCore;
                    return !!appCore?.toolSystem;
                }
            },
            {
                name: 'UIController初期化確認',
                test: () => {
                    const appCore = window.appCore || window.futabaDrawingTool?.appCore;
                    return !!appCore?.uiController;
                }
            },
            {
                name: 'キャンバス寸法設定確認',
                test: () => {
                    const appCore = window.appCore || window.futabaDrawingTool?.appCore;
                    return !!(appCore?.canvasWidth > 0 && appCore?.canvasHeight > 0);
                }
            },
            {
                name: '統一システム統合確認',
                test: () => {
                    return !!(window.ConfigManager && window.ErrorManager && 
                             window.EventBus && window.StateManager);
                }
            }
        ];
        
        let passCount = 0;
        
        for (const testCase of tests) {
            try {
                const result = testCase.test();
                const passed = !!result;
                
                console.log(`${passed ? '✅' : '❌'} ${testCase.name}: ${passed ? 'PASS' : 'FAIL'}`);
                
                if (passed) passCount++;
                
            } catch (error) {
                console.log(`❌ ${testCase.name}: FAIL (${error.message})`);
            }
        }
        
        const success = passCount === tests.length;
        console.log(`📊 AppCore初期化テスト結果: ${passCount}/${tests.length} パス`);
        
        if (success) {
            console.log('✅ AppCore初期化テスト完全成功');
        } else {
            console.warn('⚠️ 一部テスト失敗 - 実装確認が必要');
        }
        
        console.groupEnd();
        
        return {
            success,
            passCount,
            totalTests: tests.length,
            details: tests.map((test, index) => ({
                name: test.name,
                passed: passCount > index
            }))
        };
    };

    /**
     * 境界システム統合テスト実行
     */
    window.testAppCoreBoundaryIntegration = async function() {
        console.group('🧪 AppCore境界システム統合テスト実行');
        
        const tests = [
            {
                name: 'AppCore初期化確認',
                test: () => {
                    const appCore = window.appCore || window.futabaDrawingTool?.appCore;
                    return appCore?.isReady();
                }
            },
            {
                name: '境界システム初期化確認',
                test: () => {
                    const appCore = window.appCore || window.futabaDrawingTool?.appCore;
                    return appCore?.isBoundarySystemReady();
                }
            },
            {
                name: 'PixiJS拡張ヒットエリア',
                test: () => {
                    const appCore = window.appCore || window.futabaDrawingTool?.appCore;
                    return !!appCore?.expandedHitArea;
                }
            },
            {
                name: 'Stage境界設定',
                test: () => {
                    const appCore = window.appCore || window.futabaDrawingTool?.appCore;
                    return !!appCore?.stageBoundary?.expanded;
                }
            },
            {
                name: '座標変換システム',
                test: () => {
                    const appCore = window.appCore || window.futabaDrawingTool?.appCore;
                    return !!appCore?.boundaryCoordinateSystem?.enabled;
                }
            }
        ];
        
        let passCount = 0;
        
        for (const testCase of tests) {
            try {
                const result = testCase.test();
                const passed = !!result;
                
                console.log(`${passed ? '✅' : '❌'} ${testCase.name}: ${passed ? 'PASS' : 'FAIL'}`);
                
                if (passed) passCount++;
                
            } catch (error) {
                console.log(`❌ ${testCase.name}: FAIL (${error.message})`);
            }
        }
        
        const success = passCount === tests.length;
        console.log(`📊 AppCore境界システム統合テスト結果: ${passCount}/${tests.length} パス`);
        
        if (success) {
            console.log('✅ AppCore境界システム統合完全成功');
        } else {
            console.warn('⚠️ 一部テスト失敗 - 境界システム実装確認が必要');
        }
        
        console.groupEnd();
        
        return {
            success,
            passCount,
            totalTests: tests.length,
            details: tests.map((test, index) => ({
                name: test.name,
                passed: passCount > index
            }))
        };
    };

    /**
     * 境界デバッグモード切り替えコマンド
     */
    window.toggleAppCoreBoundaryDebug = function() {
        const appCore = window.appCore || 
                       window.futabaDrawingTool?.appCore;
        
        if (!appCore) {
            return { error: 'AppCoreが利用できません' };
        }
        
        try {
            if (appCore.boundaryIntegration) {
                appCore.boundaryIntegration.debugging = !appCore.boundaryIntegration.debugging;
                
                if (appCore.boundaryIntegration.debugging) {
                    appCore.enableBoundaryDebugMode();
                } else {
                    // デバッグモード無効化
                    if (appCore.boundaryDebugGraphics) {
                        appCore.app.stage.removeChild(appCore.boundaryDebugGraphics);
                        appCore.boundaryDebugGraphics.destroy();
                        appCore.boundaryDebugGraphics = null;
                    }
                    appCore.boundaryDebugLogging = false;
                }
                
                console.log(`🔍 AppCore境界デバッグモード: ${appCore.boundaryIntegration.debugging ? '有効' : '無効'}`);
                
                return { 
                    debugging: appCore.boundaryIntegration.debugging,
                    visualization: !!appCore.boundaryDebugGraphics
                };
            }
            
            return { error: '境界システムが初期化されていません' };
            
        } catch (error) {
            return { error: `デバッグモード切り替えエラー: ${error.message}` };
        }
    };
}

console.log('🎯 AppCore初期化エラー修正版実装完了');
console.log('✅ 修正項目:');
console.log('  - 🚨 PixiJS v7対応: this.app.init()削除・コンストラクターのみ初期化');
console.log('  - 🚨 main.js期待構造統一: toolSystem, uiController, drawingContainer実装');
console.log('  - 🚨 キャンバス寸法設定: canvasWidth, canvasHeight プロパティ');
console.log('  - 境界システム統合: 既存機能維持・統一システム活用');
console.log('  - エラーハンドリング強化: 初期化失敗時の詳細情報');
console.log('  - 診断・テストコマンド: window.diagnoseAppCoreInitialization等');

/**
 * 📋 AppCore初期化エラー修正版 使用方法:
 * 
 * 1. 既存のapp-core.jsファイルを置き換え
 * 2. ブラウザで再読み込み
 * 3. テスト実行:
 *    window.testAppCoreInitialization();
 *    window.diagnoseAppCoreInitialization();
 * 
 * 🎯 主な修正点:
 * - PixiJS v7: new PIXI.Application(options)のみで初期化（init()不要）
 * - main.js互換: toolSystem.setTool(), uiController.closeAllPopups()実装
 * - 構造統一: drawingContainer, canvasWidth/canvasHeight設定
 * - 境界システム: 既存機能完全維持
 * - 統一システム: ConfigManager, ErrorManager, EventBus, StateManager活用
 * 
 * 🚨 エラー解決:
 * - "this.app.init is not a function" → PixiJS v7正しい初期化方法
 * - "DrawingContainer未初期化" → initializeDrawingStage()実装
 * - "ToolSystem未初期化" → initializeSystemComponents()実装
 * - "UIController未初期化" → main.js期待構造準拠
 */
        }
        
        // ConfigManager経由設定取得
        let config = window.ConfigManager.get('appcore');
        
        if (!config) {
            // デフォルト設定をConfigManagerに設定
            config = {
                canvas: {
                    defaultWidth: 800,
                    defaultHeight: 600,
                    backgroundColor: 0xFFFFFF,
                    resolution: 'auto'
                },
                systems: {
                    toolSystemEnabled: true,
                    uiControllerEnabled: true,
                    boundarySystemEnabled: true
                },
                pixi: {
                    antialias: true,
                    preserveDrawingBuffer: true,
                    autoDensity: true
                }
            };
            
            window.ConfigManager.set('appcore', config);
            console.log('⚙️ AppCore: デフォルト設定をConfigManagerに登録');
        }
        
        return config;
    }

    // ==========================================
    // 🎯 境界システム統合（STEP3修正版）
    // ==========================================

    /**
     * 境界システム安全初期化（統一システム確認後実行）
     */
    initializeBoundarySystemSafely() {
        try {
            console.log('🎯 AppCore: 境界システム安全初期化開始...');
            
            // 統一システム利用可能性確認
            const unifiedAvailable = this.checkUnifiedSystemAvailability();
            
            if (unifiedAvailable.allAvailable) {
                // 統一システム完全利用版
                console.log('✅ 統一システム利用可能 - 完全境界統合実行');
                this.initializeBoundarySystemIntegration();
            } else {
                // フォールバック版（基本機能のみ）
                console.log('⚠️ 統一システム一部利用不可 - 基本境界機能のみ初期化');
                console.log('未利用システム:', unifiedAvailable.missing);
                this.initializeBasicBoundarySystem();
            }
            
        } catch (error) {
            console.warn('⚠️ 境界システム初期化スキップ:', error.message);
            // 境界システムなしでも動作継続
        }
    }

    /**
     * 統一システム利用可能性確認
     */
    checkUnifiedSystemAvailability() {
        const systems = {
            ConfigManager: !!window.ConfigManager,
            ErrorManager: !!window.ErrorManager,
            EventBus: !!window.EventBus,
            StateManager: !!window.StateManager
        };
        
        const missing = Object.entries(systems)
            .filter(([name, available]) => !available)
            .map(([name]) => name);
        
        return {
            systems,
            allAvailable: missing.length === 0,
            missing,
            partiallyAvailable: missing.length < 4
        };
    }

    /**
     * 完全境界システム統合初期化（統一システム利用）
     */
    initializeBoundarySystemIntegration() {
        try {
            console.log('🎯 AppCore: 完全境界システム統合初期化...');
            
            // 境界統合設定取得
            this.boundaryIntegration = this.getBoundaryIntegrationConfig();
            
            if (!this.boundaryIntegration.enabled) {
                console.log('⚠️ 境界システム無効化設定のためスキップ');
                return false;
            }
            
            // 拡張PixiJSヒットエリア設定
            this.setupExpandedPixiHitArea();
            
            // PixiJS境界イベント統合
            this.setupPixiBoundaryEvents();
            
            // EventBus境界イベント連携
            this.setupBoundaryEventBusIntegration();
            
            // 座標変換システム拡張
            this.initializeBoundaryCoordinateSystem();
            
            // デバッグモード設定
            if (this.boundaryIntegration.debugging) {
                this.enableBoundaryDebugMode();
            }
            
            this.boundarySystemReady = true;
            
            console.log('✅ AppCore: 完全境界システム統合完了');
            
            // EventBus完了通知
            this.safeEmitEvent('appcore.boundary.initialized', {
                timestamp: Date.now(),
                hitAreaExpanded: !!this.expandedHitArea,
                coordinateSystemReady: !!this.boundaryCoordinateSystem?.enabled,
                debugMode: this.boundaryIntegration.debugging
            });
            
            return true;
            
        } catch (error) {
            console.error('❌ 完全境界システム統合エラー:', error);
            
            this.safeShowError('boundary-system-integration', 
                `境界システム統合エラー: ${error.message}`, 
                { component: 'AppCore', integration: 'full' }
            );
            
            // フォールバックに切り替え
            this.initializeBasicBoundarySystem();
            return false;
        }
    }

    /**
     * 基本境界システム初期化（統一システムなし対応）
     */
    initializeBasicBoundarySystem() {
        try {
            console.log('🎯 AppCore: 基本境界システム初期化...');
            
            // 基本設定（ハードコーデッド）
            this.boundaryIntegration = {
                enabled: true,
                hitAreaMargin: 20,
                coordinateTransform: true,
                eventIntegration: false, // EventBusなし
                debugging: false,
                performanceMode: 'balanced'
            };
            
            // 基本拡張ヒットエリア
            this.setupBasicExpandedHitArea();
            
            // 基本境界イベント
            this.setupBasicBoundaryEvents();
            
            this.boundarySystemReady = true;
            
            console.log('✅ AppCore: 基本境界システム初期化完了');
            
            return true;
            
        } catch (error) {
            console.error('❌ 基本境界システム初期化エラー:', error);
            return false;
        }
    }

    /**
     * 境界統合設定取得（ConfigManager利用）
     */
    getBoundaryIntegrationConfig() {
        if (!window.ConfigManager) {
            // フォールバック設定
            return {
                enabled: true,
                hitAreaMargin: 20,
                coordinateTransform: true,
                eventIntegration: false,
                debugging: false,
                performanceMode: 'balanced'
            };
        }
        
        const config = {
            enabled: window.ConfigManager.get('appcore.boundary.enabled') ?? true,
            hitAreaMargin: window.ConfigManager.get('canvas.boundary.margin') ?? 20,
            coordinateTransform: window.ConfigManager.get('appcore.boundary.coordinateTransform') ?? true,
            eventIntegration: window.ConfigManager.get('appcore.boundary.eventIntegration') ?? true,
            debugging: window.ConfigManager.get('appcore.boundary.debugging') ?? false,
            performanceMode: window.ConfigManager.get('appcore.boundary.performanceMode') ?? 'balanced'
        };
        
        // デフォルト設定確保
        if (!window.ConfigManager.get('appcore.boundary')) {
            window.ConfigManager.set('appcore.boundary', {
                enabled: true,
                coordinateTransform: true,
                eventIntegration: true,
                debugging: false,
                performanceMode: 'balanced'
            });
        }
        
        return config;
    }

    // ==========================================
    // 🎯 拡張PixiJSヒットエリア・イベントシステム
    // ==========================================

    /**
     * 拡張PixiJSヒットエリア設定（完全版）
     */
    setupExpandedPixiHitArea() {
        if (!this.boundaryIntegration.enabled || !this.app?.stage) {
            console.warn('⚠️ PixiJS境界統合が無効またはstageが利用できません');
            return false;
        }
        
        try {
            const margin = this.boundaryIntegration.hitAreaMargin;
            
            // 拡張ヒットエリア作成（マージン付き）
            this.expandedHitArea = new PIXI.Rectangle(
                -margin,
                -margin,
                this.width + margin * 2,
                this.height + margin * 2
            );
            
            // Stage設定適用
            this.app.stage.hitArea = this.expandedHitArea;
            this.app.stage.interactive = true;
            
            // Stage境界プロパティ記録
            this.stageBoundary = {
                original: new PIXI.Rectangle(0, 0, this.width, this.height),
                expanded: this.expandedHitArea,
                margin,
                lastUpdate: Date.now()
            };
            
            console.log(`📏 PixiJS拡張ヒットエリア設定完了: ${this.width}×${this.height} + マージン${margin}px`);
            
            // StateManager状態更新
            this.safeUpdateState('pixijs.boundary', {
                hitAreaExpanded: true,
                margin,
                dimensions: { width: this.width, height: this.height }
            });
            
            return true;
            
        } catch (error) {
            console.error('❌ PixiJS拡張ヒットエリア設定エラー:', error);
            return false;
        }
    }

    /**
     * 基本拡張ヒットエリア設定（統一システムなし）
     */
    setupBasicExpandedHitArea() {
        if (!this.app?.stage) {
            return false;
        }
        
        try {
            const margin = 20; // ハードコーデッド
            
            this.expandedHitArea = new PIXI.Rectangle(
                -margin,
                -margin,
                this.width + margin * 2,
                this.height + margin * 2
            );
            
            this.app.stage.hitArea = this.expandedHitArea;
            this.app.stage.interactive = true;
            
            this.stageBoundary = {
                original: new PIXI.Rectangle(0, 0, this.width, this.height),
                expanded: this.expandedHitArea,
                margin,
                lastUpdate: Date.now()
            };
            
            console.log(`📏 基本拡張ヒットエリア設定: ${this.width}×${this.height} + ${margin}px`);
            
            return true;
            
        } catch (error) {
            console.error('❌ 基本拡張ヒットエリア設定エラー:', error);
            return false;
        }
    }

    /**
     * PixiJS境界イベント設定（完全版）
     */
    setupPixiBoundaryEvents() {
        if (!this.app?.stage || !this.boundaryIntegration.eventIntegration) {
            console.log('⚠️ PixiJS境界イベント統合スキップ (EventBus統合無効)');
            return false;
        }
        
        try {
            // PixiJS Stageイベントリスナー設定
            this.app.stage.on('pointerdown', this.handlePixiBoundaryPointerDown.bind(this));
            this.app.stage.on('pointermove', this.handlePixiBoundaryPointerMove.bind(this));
            this.app.stage.on('pointerup', this.handlePixiBoundaryPointerUp.bind(this));
            this.app.stage.on('pointercancel', this.handlePixiBoundaryPointerCancel.bind(this));
            
            // Stageイベント統合状態
            this.pixiBoundaryEvents = {
                enabled: true,
                listeners: ['pointerdown', 'pointermove', 'pointerup', 'pointercancel'],
                setupTime: Date.now()
            };
            
            console.log('📡 PixiJS境界イベントリスナー設定完了');
            
            return true;
            
        } catch (error) {
            console.error('❌ PixiJS境界イベント設定エラー:', error);
            return false;
        }
    }

    /**
     * 基本境界イベント設定（統一システムなし）
     */
    setupBasicBoundaryEvents() {
        if (!this.app?.stage) {
            return false;
        }
        
        try {
            // 基本的なPointerEventのみ
            this.app.stage.on('pointerdown', (event) => {
                this.handleBasicPointerDown(event);
            });
            
            this.app.stage.on('pointermove', (event) => {
                this.handleBasicPointerMove(event);
            });
            
            console.log('📡 基本境界イベント設定完了');
            
            return true;
            
        } catch (error) {
            console.error('❌ 基本境界イベント設定エラー:', error);
            return false;
        }
    }

    /**
     * EventBus境界イベント連携設定
     */
    setupBoundaryEventBusIntegration() {
        if (!window.EventBus || !this.boundaryIntegration.eventIntegration) {
            console.log('⚠️ EventBus境界イベント連携スキップ');
            return false;
        }
        
        try {
            // EventBus境界イベント監視
            window.EventBus.on('boundary.cross.in', this.handleBoundaryCrossInIntegration.bind(this));
            window.EventBus.on('boundary.outside.start', this.handleBoundaryOutsideStart.bind(this));
            window.EventBus.on('canvas.boundary.initialized', this.handleCanvasBoundaryInitialized.bind(this));
            
            console.log('📡 EventBus境界イベント連携設定完了');
            
            return true;
            
        } catch (error) {
            console.error('❌ EventBus境界イベント連携エラー:', error);
            return false;
        }
    }

    /**
     * 境界座標変換システム初期化
     */
    initializeBoundaryCoordinateSystem() {
        if (!this.boundaryIntegration.coordinateTransform) {
            return false;
        }
        
        try {
            // 座標変換マトリックス
            this.boundaryCoordinateSystem = {
                enabled: true,
                canvasToPixi: this.createCanvasToPixiTransform(),
                pixiToCanvas: this.createPixiToCanvasTransform(),
                globalToPixi: this.createGlobalToPixiTransform(),
                pixiToGlobal: this.createPixiToGlobalTransform()
            };
            
            console.log('🎯 境界座標変換システム初期化完了');
            
            return true;
            
        } catch (error) {
            console.error('❌ 境界座標変換システム初期化エラー:', error);
            return false;
        }
    }

    // ==========================================
    // 🎯 リサイズ処理（main.js互換）
    // ==========================================

    /**
     * リサイズ処理（main.js期待インターフェース）
     */
    resize(newWidth, newHeight, centerContent = false) {
        try {
            console.log(`📏 AppCore: リサイズ ${newWidth}×${newHeight} (中央寄せ: ${centerContent})`);
            
            // 基本リサイズ
            this.width = newWidth;
            this.height = newHeight;
            this.canvasWidth = newWidth;
            this.canvasHeight = newHeight;
            
            if (this.app && this.app.renderer) {
                this.app.renderer.resize(newWidth, newHeight);
            }
            
            // Stage基本ヒットエリア更新
            if (this.app?.stage) {
                this.app.stage.hitArea = new PIXI.Rectangle(0, 0, newWidth, newHeight);
            }
            
            // 境界システム更新
            this.updateBoundaryHitAreaOnResize(newWidth, newHeight);
            
            // 中央寄せ処理（centerContent=trueの場合）
            if (centerContent && this.drawingContainer) {
                // 描画コンテンツを中央に移動（実装例）
                this.centerDrawingContent(newWidth, newHeight);
            }
            
            // EventBus通知
            this.safeEmitEvent('appcore.resized', {
                width: newWidth,
                height: newHeight,
                centerContent: centerContent,
                timestamp: Date.now()
            });
            
            console.log('✅ AppCore: リサイズ完了');
            
        } catch (error) {
            console.error('❌ AppCore: リサイズエラー:', error);
            this.safeShowError('appcore-resize', `リサイズエラー: ${error.message}`, {
                width: newWidth,
                height: newHeight,
                centerContent
            });
        }
    }

    /**
     * 描画コンテンツ中央寄せ
     */
    centerDrawingContent(newWidth, newHeight) {
        try {
            if (!this.drawingContainer) return;
            
            // 現在の描画領域の中心を計算
            const bounds = this.drawingContainer.getBounds();
            const centerX = newWidth / 2;
            const centerY = newHeight / 2;
            const contentCenterX = bounds.x + bounds.width / 2;
            const contentCenterY = bounds.y + bounds.height / 2;
            
            // オフセット計算・適用
            const offsetX = centerX - contentCenterX;
            const offsetY = centerY - contentCenterY;
            
            this.drawingContainer.x += offsetX;
            this.drawingContainer.y += offsetY;
            
            console.log(`🎯 描画コンテンツ中央寄せ: offset(${offsetX.toFixed(1)}, ${offsetY.toFixed(1)})`);
            
        } catch (error) {
            console.warn('⚠️ 描画コンテンツ中央寄せエラー:', error);
        }
    }

    /**
     * 拡張ヒットエリア更新（リサイズ対応）
     */
    updateBoundaryHitAreaOnResize(newWidth, newHeight) {
        if (!this.boundaryIntegration?.enabled || !this.app?.stage) {
            return false;
        }
        
        try {
            const margin = this.boundaryIntegration.hitAreaMargin;
            
            // 新しい拡張ヒットエリア
            this.expandedHitArea = new PIXI.Rectangle(
                -margin,
                -margin,
                newWidth + margin * 2,
                newHeight + margin * 2
            );
            
            // Stage更新
            this.app.stage.hitArea = this.expandedHitArea;
            
            // 境界情報更新
            this.stageBoundary = {
                original: new PIXI.Rectangle(0, 0, newWidth, newHeight),
                expanded: this.expandedHitArea,
                margin,
                lastUpdate: Date.now()
            };
            
            console.log(`📏 境界ヒットエリア更新: ${newWidth}×${newHeight} + マージン${margin}px`);
            
            // デバッグ可視化更新
            if (this.boundaryDebugGraphics) {
                this.app.stage.removeChild(this.boundaryDebugGraphics);
                this.boundaryDebugGraphics.destroy();
                this.boundaryDebugGraphics = null;
                this.createBoundaryDebugVisualizer();
            }
            
            return true;
            
        } catch (error) {
            console.error('❌ 境界ヒットエリア更新エラー:', error);
            return false;
        }
    }

    // ==========================================
    // 🎯 イベントハンドラー群（簡略版）
    // ==========================================

    /**
     * 基本PointerDownハンドラー（統一システムなし）
     */
    handleBasicPointerDown(pixiEvent) {
        try {
            const localPoint = pixiEvent.data.getLocalPosition(this.app.stage);
            
            if (Math.random() < 0.1) { // 10%の確率で出力（デバッグ制限）
                console.log('🎯 基本PointerDown:', {
                    x: localPoint.x.toFixed(2),
                    y: localPoint.y.toFixed(2),
                    pointerId: pixiEvent.data.pointerId
                });
            }
            
        } catch (error) {
            console.error('❌ 基本PointerDownエラー:', error);
        }
    }

    /**
     * 基本PointerMoveハンドラー（統一システムなし）
     */
    handleBasicPointerMove(pixiEvent) {
        try {
            const localPoint = pixiEvent.data.getLocalPosition(this.app.stage);
            const isInside = this.isPointInsideBoundary(localPoint.x, localPoint.y);
            
            // デバッグ出力（頻度制限）
            if (Math.random() < 0.005) { // 0.5%の確率で出力
                console.log('🎯 基本PointerMove:', {
                    inside: isInside,
                    x: localPoint.x.toFixed(2),
                    y: localPoint.y.toFixed(2)
                });
            }
            
        } catch (error) {
            console.error('❌ 基本PointerMoveエラー:', error);
        }
    }

    // ==========================================
    // 🎯 境界判定・ユーティリティ
    // ==========================================

    /**
     * 点が境界内かチェック
     */
    isPointInsideBoundary(x, y) {
        if (!this.stageBoundary?.original) {
            return true; // フォールバック
        }
        
        const boundary = this.stageBoundary.original;
        
        return x >= boundary.x && 
               x <= boundary.x + boundary.width && 
               y >= boundary.y && 
               y <= boundary.y + boundary.height;
    }

    /**
     * 座標変換ヘルパー
     */
    convertToPixiCoordinate(x, y) {
        if (this.boundaryCoordinateSystem?.canvasToPixi) {
            return this.boundaryCoordinateSystem.canvasToPixi(x, y);
        }
        return { x, y };
    }

    convertToGlobalCoordinate(pixiX, pixiY) {
        if (this.boundaryCoordinateSystem?.pixiToGlobal) {
            return this.boundaryCoordinateSystem.pixiToGlobal(pixiX, pixiY);
        }
        return { x: pixiX, y: pixiY };
    }

    /**
     * キャンバス→PixiJS座標変換
     */
    createCanvasToPixiTransform() {
        return (canvasX, canvasY) => {
            try {
                return { x: canvasX, y: canvasY };
            } catch (error) {
                console.error('❌ キャンバス→PixiJS座標変換エラー:', error);
                return { x: canvasX, y: canvasY };
            }
        };
    }

    /**
     * PixiJS→キャンバス座標変換
     */
    createPixiToCanvasTransform() {
        return (pixiX, pixiY) => {
            try {
                return { x: pixiX, y: pixiY };
            } catch (error) {
                console.error('❌ PixiJS→キャンバス座標変換エラー:', error);
                return { x: pixiX, y: pixiY };
            }
        };
    }

    /**
     * グローバル→PixiJS座標変換
     */
    createGlobalToPixiTransform() {
        return (globalX, globalY) => {
            try {
                const canvas = this.canvasElement;
                if (!canvas) {
                    throw new Error('キャンバス要素が見つかりません');
                }
                
                const rect = canvas.getBoundingClientRect();
                const canvasX = globalX - rect.left;
                const canvasY = globalY - rect.top;
                
                return this.boundaryCoordinateSystem.canvasToPixi(canvasX, canvasY);
                
            } catch (error) {
                console.error('❌ グローバル→PixiJS座標変換エラー:', error);
                return { x: globalX, y: globalY };
            }
        };
    }

    /**
     * PixiJS→グローバル座標変換
     */
    createPixiToGlobalTransform() {
        return (pixiX, pixiY) => {
            try {
                const canvas = this.canvasElement;
                if (!canvas) {
                    throw new Error('キャンバス要素が見つかりません');
                }
                
                const rect = canvas.getBoundingClientRect();
                const canvasCoord = this.boundaryCoordinateSystem.pixiToCanvas(pixiX, pixiY);
                
                return {
                    x: canvasCoord.x + rect.left,
                    y: canvasCoord.y + rect.top
                };
                
            } catch (error) {
                console.error('❌ PixiJS→グローバル座標変換エラー:', error);
                return { x: pixiX, y: pixiY };
            }
        };
    }

    // ==========================================
    // 🎯 統一システム安全呼び出しヘルパー
    // ==========================================

    /**
     * EventBus安全emit
     */
    safeEmitEvent(eventName, data) {
        try {
            if (window.EventBus && typeof window.EventBus.safeEmit === 'function') {
                window.EventBus.safeEmit(eventName, data);
            }
        } catch (error) {
            console.warn(`⚠️ EventBus emit失敗: ${eventName}`, error);
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
                console.error(`❌ ${type}: ${message}`, data);
            }
        } catch (error) {
            console.error(`❌ ${type}: ${message}`, data, error);
        }
    }

    /**
     * StateManager安全状態更新
     */
    safeUpdateState(key, value) {
        try {
            if (window.StateManager && typeof window.StateManager.updateState === 'function') {
                window.StateManager.updateState(key, value);
            }
        } catch (error) {
            console.warn(`⚠️ StateManager更新失敗: ${key}`, error);
        }
    }

    // ==========================================
    // 🎯 公開API（main.js互換）
    // ==========================================

    /**
     * DOM要素取得
     */
    getCanvas() {
        return this.canvasElement;
    }

    /**
     * 初期化状態確認
     */
    isReady() {
        return this.isInitialized && !!this.app && !!this.drawingContainer && !!this.toolSystem;
    }

    /**
     * 境界システム状態確認
     */
    isBoundarySystemReady() {
        return this.boundarySystemReady && !!this.boundaryIntegration;
    }

    /**
     * AppCore状態取得（診断用）
     */
    getAppCoreState() {
        return {
            initialized: this.isInitialized,
            pixiApp: !!this.app,
            drawingContainer: !!this.drawingContainer,
            toolSystem: !!this.toolSystem,
            uiController: !!this.uiController,
            boundarySystem: this.boundarySystemReady,
            canvasDimensions: {
                width: this.canvasWidth,
                height: this.canvasHeight
            },
            currentTool: this.toolSystem?.currentTool || null
        };🚀 AppCore: 初期化開始（PixiJS v7対応）...');
            
            // オプション設定
            this.width = options.width || 800;
            this.height = options.height || 600;
            
            // PixiJSアプリケーション作成（v7対応）
            this.createPixiApplication(options);
            
            // 基本設定
            this.setupBasicConfiguration();
            
            // 描画ステージ・システム初期化
            this.initializeDrawingStage();
            
            // システムコンポーネント初期化（main.js互換）
            this.initializeSystemComponents();
            
            // 🎯 統一システム確認後に境界システム初期化
            this.initializeBoundarySystemSafely();
            
            // 初期化完了
            this.isInitialized = true;
            
            console.log('✅ AppCore: 初期化完了（PixiJS v7・main.js互換）');
            
            // EventBus通知（統一システムが利用可能な場合のみ）
            this.safeEmitEvent('appcore.initialized', {
                width: this.width,
                height: this.height,
                pixiVersion: PIXI.VERSION || 'unknown',
                boundarySupport: this.boundarySystemReady,
                systemComponents: {
                    toolSystem: !!this.toolSystem,
                    uiController: !!this.uiController,
                    drawingContainer: !!this.drawingContainer
                }
            });
            
            return true;
            
        } catch (error) {
            const errorMsg = `AppCore初期化エラー: ${error.message}`;
            console.error('❌', errorMsg);
            
            // ErrorManager利用可能時のみエラー表示
            this.safeShowError('appcore-init', errorMsg, { 
                error: error.message,
                stack: error.stack,
                pixiVersion: PIXI.VERSION || 'unknown'
            });
            
            return false;
        }
    }

    /**
     * PixiJSアプリケーション作成（v7修正版）
     */
    createPixiApplication(options) {
        try {
            // 統一システム設定取得
            const appCoreConfig = this.getAppCoreConfig();
            
            const pixiOptions = {
                width: this.width,
                height: this.height,
                backgroundColor: options.backgroundColor || appCoreConfig.canvas.backgroundColor,
                resolution: appCoreConfig.canvas.resolution === 'auto' ? 
                           (window.devicePixelRatio || 1) : appCoreConfig.canvas.resolution,
                autoDensity: appCoreConfig.pixi.autoDensity,
                antialias: appCoreConfig.pixi.antialias,
                preserveDrawingBuffer: appCoreConfig.pixi.preserveDrawingBuffer
            };
            
            // 🚨 PixiJS v7: コンストラクターのみで初期化完了（init()不要）
            this.app = new PIXI.Application(pixiOptions);
            
            // DOM要素取得（v7対応）
            this.canvasElement = this.app.view || this.app.canvas;
            
            if (!this.canvasElement) {
                throw new Error('PixiJS キャンバス要素の取得に失敗');
            }
            
            console.log(`📱 PixiJS v7 Application作成成功: ${this.width}×${this.height}`);
            console.log(`   - Background: 0x${pixiOptions.backgroundColor.toString(16)}`);
            console.log(`   - Resolution: ${pixiOptions.resolution}`);
            console.log(`   - Canvas Element: ${this.canvasElement.tagName}`);
            
        } catch (error) {
            console.error('❌ PixiJS Application作成エラー:', error);
            throw new Error(`PixiJS初期化失敗: ${error.message}`);
        }
    }

    /**
     * 基本設定
     */
    setupBasicConfiguration() {
        if (!this.app?.stage) {
            throw new Error('PixiJS Stageが利用できません');
        }
        
        // Stage基本設定
        this.app.stage.eventMode = 'static';
        this.app.stage.hitArea = new PIXI.Rectangle(0, 0, this.width, this.height);
        this.app.stage.interactive = true;
        
        console.log('⚙️ AppCore: 基本設定完了');
    }

    /**
     * 描画ステージ・システム初期化（main.js互換）
     */
    initializeDrawingStage() {
        try {
            // メイン描画コンテナ作成
            this.drawingContainer = new PIXI.Container();
            this.drawingContainer.name = 'drawingContainer';
            this.app.stage.addChild(this.drawingContainer);
            
            // UI層コンテナ
            this.uiContainer = new PIXI.Container();
            this.uiContainer.name = 'uiContainer';
            this.app.stage.addChild(this.uiContainer);
            
            // キャンバス寸法プロパティ設定（main.js期待）
            this.canvasWidth = this.width;
            this.canvasHeight = this.height;
            
            console.log('🎨 描画ステージ初期化完了');
            console.log(`   - Drawing Container: ${this.drawingContainer.children.length} children`);
            console.log(`   - UI Container: ${this.uiContainer.children.length} children`);
            console.log(`   - Canvas Dimensions: ${this.canvasWidth}×${this.canvasHeight}`);
            
        } catch (error) {
            console.error('❌ 描画ステージ初期化エラー:', error);
            throw new Error(`描画ステージ初期化失敗: ${error.message}`);
        }
    }

    /**
     * システムコンポーネント初期化（main.js期待構造）
     */
    initializeSystemComponents() {
        try {
            console.log('🔧 AppCore: システムコンポーネント初期化...');
            
            // ToolSystem初期化（main.jsが期待する構造）
            this.toolSystem = {
                initialized: true,
                currentTool: 'pen',
                tools: new Map([
                    ['pen', { name: 'pen', active: true }],
                    ['eraser', { name: 'eraser', active: false }],
                    ['fill', { name: 'fill', active: false }],
                    ['select', { name: 'select', active: false }]
                ]),
                setTool: (toolName) => {
                    if (this.toolSystem.tools.has(toolName)) {
                        // 全ツール非アクティブ化
                        this.toolSystem.tools.forEach(tool => tool.active = false);
                        // 指定ツールアクティブ化
                        this.toolSystem.tools.get(toolName).active = true;
                        this.toolSystem.currentTool = toolName;
                        
                        console.log(`🔧 ToolSystem: ツール変更 → ${toolName}`);
                        
                        // EventBus通知
                        this.safeEmitEvent('tool.changed', { 
                            tool: toolName,
                            previousTool: this.toolSystem.currentTool
                        });
                    } else {
                        console.warn(`⚠️ ToolSystem: 未知のツール: ${toolName}`);
                    }
                },
                getTool: (toolName) => {
                    return this.toolSystem.tools.get(toolName) || null;
                },
                getActiveTool: () => {
                    return this.toolSystem.currentTool;
                }
            };
            
            // UIController初期化（main.jsが期待する構造）
            this.uiController = {
                initialized: true,
                popups: new Map(),
                activePopups: [],
                closeAllPopups: () => {
                    try {
                        // DOM操作でポップアップ閉じる
                        const popups = document.querySelectorAll('.popup-panel');
                        let closedCount = 0;
                        
                        popups.forEach(popup => {
                            if (popup.classList.contains('show')) {
                                popup.classList.remove('show');
                                closedCount++;
                            }
                        });
                        
                        // 内部状態クリア
                        this.uiController.activePopups = [];
                        
                        console.log(`🔒 UIController: ${closedCount}個のポップアップを閉じました`);
                        
                        // EventBus通知
                        this.safeEmitEvent('popup.allClosed', { 
                            closedCount,
                            timestamp: Date.now() 
                        });
                        
                        return closedCount;
                        
                    } catch (error) {
                        console.error('❌ UIController: ポップアップ閉じるエラー:', error);
                        return 0;
                    }
                },
                showPopup: (popupId) => {
                    const popup = document.getElementById(popupId);
                    if (popup) {
                        popup.classList.add('show');
                        this.uiController.activePopups.push(popupId);
                        console.log(`📂 UIController: ポップアップ表示 → ${popupId}`);
                        return true;
                    }
                    return false;
                },
                hidePopup: (popupId) => {
                    const popup = document.getElementById(popupId);
                    if (popup) {
                        popup.classList.remove('show');
                        this.uiController.activePopups = this.uiController.activePopups.filter(id => id !== popupId);
                        console.log(`📁 UIController: ポップアップ非表示 → ${popupId}`);
                        return true;
                    }
                    return false;
                }
            };
            
            console.log('