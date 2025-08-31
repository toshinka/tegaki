/**
 * 🚀 main.js - PixiJS v8統合エントリーポイント（v8完全対応版）
 * 📋 RESPONSIBILITY: v8統合エントリーポイント・グローバル関数提供・v8デバッグ機能・WebGPU対応確認
 * 🚫 PROHIBITION: Manager作成・UI操作・描画処理・フォールバック・フェイルセーフ・v7 API混在
 * ✅ PERMISSION: v8統合関数提供・v8デバッグ機能・v8テスト機能・WebGPU状況確認・v8統合確認
 * 
 * 📏 DESIGN_PRINCIPLE: v8統合エントリーポイント・グローバル関数統一・v8機能確認・WebGPU対応
 * 🔄 INTEGRATION: v8 TegakiApplication + v8 AppCore + v8デバッグ機能 + WebGPU統合
 * 🚀 V8_MIGRATION: 完全v8対応・WebGPU統合・フォールバック削除・v8デバッグ統合
 * 
 * 📌 提供メソッド一覧（v8対応）:
 * ✅ window.debugTegakiV8() - v8専用デバッグ情報表示・WebGPU状況・レンダラー情報
 * ✅ window.runV8IntegrationTest() - v8統合テスト実行・機能確認・WebGPU確認
 * ✅ window.getV8SystemInfo() - v8システム情報取得・統計情報・状況レポート
 * ✅ window.resetV8System() - v8システムリセット・デバッグ用・完全初期化
 * ✅ window.testV8Performance() - v8性能テスト・WebGPU vs WebGL・描画性能
 * 
 * 📌 他ファイル呼び出しメソッド一覧:
 * ✅ window.Tegaki.TegakiApplicationInstance - v8対応TegakiApplication（✅確認済み）
 * ✅ app.getV8DebugInfo() - v8デバッグ情報取得（✅確認済み）
 * ✅ app.getV8SystemStats() - v8統計情報取得（✅確認済み）
 * ✅ app.resetV8System() - v8システムリセット（✅確認済み）
 * ✅ PIXI.VERSION - PixiJS v8バージョン情報（PixiJS v8.12.0）
 * ✅ PIXI.isWebGPUSupported() - WebGPU対応確認（PixiJS v8.12.0）
 * 
 * 📐 v8統合確認フロー:
 * 開始 → PixiJS v8確認 → TegakiApplication v8確認 → WebGPU対応確認 → 
 * v8機能統合確認 → デバッグ情報表示 → 統合テスト実行 → 完了
 * 依存関係: PixiJS v8.12.0(基盤) → v8 TegakiApplication(統合) → v8デバッグ機能(確認)
 * 
 * 🚨 CRITICAL_V8_DEPENDENCIES: v8必須依存関係（動作に必須）
 * - PIXI.VERSION.startsWith('8.') - PixiJS v8必須
 * - window.Tegaki.TegakiApplicationInstance.isV8Ready() === true - v8システム準備必須
 * - WebGPU API利用可能性確認必須
 * 
 * 🚫 V8_ABSOLUTE_PROHIBITIONS: v8移行時絶対禁止事項
 * - v7互換コード・フォールバック継続
 * - AppCore直接作成・Manager直接作成継続
 * - フォールバック・フェイルセーフ複雑化
 */

// 多重定義防止
if (typeof window.debugTegakiV8 === 'undefined') {
    
    /**
     * 🚀 v8専用デバッグ情報表示・WebGPU状況・レンダラー情報
     */
    window.debugTegakiV8 = function() {
        console.log('🚀 === TegakiApplication v8デバッグ情報 ===');
        
        // PixiJS v8確認
        if (typeof PIXI !== 'undefined') {
            console.log(`📦 PixiJS: ${PIXI.VERSION} ${PIXI.VERSION.startsWith('8.') ? '✅' : '❌ v8必須'}`);
        } else {
            console.log('❌ PixiJS未読み込み');
            return;
        }
        
        // TegakiApplication v8確認
        const app = window.Tegaki?.TegakiApplicationInstance;
        if (app) {
            console.log('🎯 TegakiApplication:', app.isV8Ready() ? '✅ v8準備完了' : '❌ v8未準備');
            
            // v8デバッグ情報取得
            if (typeof app.getV8DebugInfo === 'function') {
                const debugInfo = app.getV8DebugInfo();
                
                // v8レンダラー情報
                console.log('🖥️ v8レンダラー情報:');
                console.log(`  - タイプ: ${debugInfo.rendererInfo?.type || 'unknown'}`);
                console.log(`  - WebGPU対応: ${debugInfo.rendererInfo?.webgpuSupported ? '✅' : '❌'}`);
                console.log(`  - WebGPU使用中: ${debugInfo.rendererInfo?.webgpuActive ? '🚀' : '📊'}`);
                
                // v8機能状況
                console.log('🔧 v8機能状況:');
                Object.entries(debugInfo.v8Features || {}).forEach(([feature, enabled]) => {
                    console.log(`  - ${feature}: ${enabled ? '✅' : '❌'}`);
                });
                
                // v8初期化状況
                console.log('📝 v8初期化状況:');
                console.log(`  - ステップ完了: ${debugInfo.v8Initialization?.stepsCompleted || 0}`);
                console.log(`  - エラー: ${debugInfo.v8Initialization?.lastError || 'なし'}`);
                
                // v8 AppCore状況
                if (debugInfo.appCore) {
                    console.log('🚀 v8 AppCore状況:');
                    console.log(`  - v8システム準備: ${debugInfo.appCore.v8SystemReady ? '✅' : '❌'}`);
                    console.log(`  - Manager初期化: ${debugInfo.appCore.v8Managers?.canvasManagerV8Ready ? '✅' : '❌'}`);
                }
                
            } else {
                console.log('⚠️ v8デバッグ情報取得不可（旧バージョン）');
            }
        } else {
            console.log('❌ TegakiApplication未初期化');
        }
        
        // WebGPU API確認
        if (typeof PIXI.isWebGPUSupported === 'function') {
            PIXI.isWebGPUSupported().then(supported => {
                console.log(`🚀 WebGPU API対応: ${supported ? '✅' : '❌'}`);
            });
        } else {
            console.log('❌ WebGPU API確認不可（PixiJS v8未対応）');
        }
        
        console.log('🚀 === v8デバッグ情報終了 ===');
    };
    
    /**
     * 🚀 v8統合テスト実行・機能確認・WebGPU確認
     */
    window.runV8IntegrationTest = function() {
        console.log('🧪 === TegakiApplication v8統合テスト開始 ===');
        
        const testResults = {
            pixiV8: false,
            webgpuAPI: null,
            tegakiApp: false,
            appCore: false,
            canvasManager: false,
            toolManager: false,
            renderer: null,
            webgpuActive: false
        };
        
        // Test 1: PixiJS v8確認
        if (typeof PIXI !== 'undefined' && PIXI.VERSION.startsWith('8.')) {
            testResults.pixiV8 = true;
            console.log('Test 1: ✅ PixiJS v8読み込み');
        } else {
            console.log('Test 1: ❌ PixiJS v8読み込み失敗');
        }
        
        // Test 2: WebGPU API確認
        if (typeof PIXI.isWebGPUSupported === 'function') {
            PIXI.isWebGPUSupported().then(supported => {
                testResults.webgpuAPI = supported;
                console.log(`Test 2: ${supported ? '✅' : '📊'} WebGPU API対応: ${supported}`);
            });
        } else {
            console.log('Test 2: ❌ WebGPU API確認不可');
        }
        
        // Test 3: TegakiApplication v8確認
        const app = window.Tegaki?.TegakiApplicationInstance;
        if (app && typeof app.isV8Ready === 'function' && app.isV8Ready()) {
            testResults.tegakiApp = true;
            console.log('Test 3: ✅ TegakiApplication v8準備完了');
            
            // Test 4: AppCore v8確認
            const appCore = app.getAppCore?.();
            if (appCore && typeof appCore.isV8Ready === 'function' && appCore.isV8Ready()) {
                testResults.appCore = true;
                console.log('Test 4: ✅ AppCore v8準備完了');
                
                // Test 5: CanvasManager v8確認
                const canvasManager = appCore.getCanvasManager?.();
                if (canvasManager && typeof canvasManager.isV8Ready === 'function' && canvasManager.isV8Ready()) {
                    testResults.canvasManager = true;
                    console.log('Test 5: ✅ CanvasManager v8準備完了');
                } else {
                    console.log('Test 5: ❌ CanvasManager v8未準備');
                }
                
                // Test 6: ToolManager v8確認
                const toolManager = appCore.getToolManager?.();
                if (toolManager) {
                    testResults.toolManager = true;
                    console.log('Test 6: ✅ ToolManager v8準備完了');
                } else {
                    console.log('Test 6: ❌ ToolManager v8未準備');
                }
                
                // Test 7: レンダラー確認
                const webgpuStatus = app.getWebGPUStatus?.();
                if (webgpuStatus) {
                    testResults.renderer = webgpuStatus.rendererType;
                    testResults.webgpuActive = webgpuStatus.active;
                    console.log(`Test 7: ✅ レンダラー: ${webgpuStatus.rendererType} (WebGPU: ${webgpuStatus.active})`);
                } else {
                    console.log('Test 7: ❌ レンダラー情報取得不可');
                }
                
            } else {
                console.log('Test 4: ❌ AppCore v8未準備');
            }
        } else {
            console.log('Test 3: ❌ TegakiApplication v8未準備');
        }
        
        // テスト結果サマリー
        const passedTests = Object.values(testResults).filter(result => 
            result === true || (result !== null && result !== false)
        ).length;
        const totalTests = Object.keys(testResults).length;
        
        console.log('📊 v8統合テスト結果:');
        console.log(`  - 合格: ${passedTests}/${totalTests}`);
        console.log(`  - PixiJS v8: ${testResults.pixiV8 ? '✅' : '❌'}`);
        console.log(`  - WebGPU API: ${testResults.webgpuAPI === null ? '⏳' : (testResults.webgpuAPI ? '✅' : '📊')}`);
        console.log(`  - TegakiApp v8: ${testResults.tegakiApp ? '✅' : '❌'}`);
        console.log(`  - AppCore v8: ${testResults.appCore ? '✅' : '❌'}`);
        console.log(`  - Canvas v8: ${testResults.canvasManager ? '✅' : '❌'}`);
        console.log(`  - Tool v8: ${testResults.toolManager ? '✅' : '❌'}`);
        console.log(`  - レンダラー: ${testResults.renderer || '❌'}`);
        console.log(`  - WebGPU使用: ${testResults.webgpuActive ? '🚀' : '📊'}`);
        
        console.log('🧪 === v8統合テスト終了 ===');
        
        return testResults;
    };
    
    /**
     * 🚀 v8システム情報取得・統計情報・状況レポート
     */
    window.getV8SystemInfo = function() {
        console.log('📊 === v8システム情報取得開始 ===');
        
        const systemInfo = {
            // v8基盤情報
            v8Foundation: {
                pixiVersion: typeof PIXI !== 'undefined' ? PIXI.VERSION : null,
                pixiV8: typeof PIXI !== 'undefined' && PIXI.VERSION.startsWith('8.'),
                webgpuAPI: typeof PIXI?.isWebGPUSupported === 'function'
            },
            
            // v8アプリケーション情報
            v8Application: null,
            
            // v8性能情報
            v8Performance: {
                rendererType: null,
                webgpuSupported: null,
                webgpuActive: false
            },
            
            // v8統合状況
            v8Integration: {
                fullyReady: false,
                managersReady: 0,
                featuresEnabled: 0
            }
        };
        
        // TegakiApplication情報取得
        const app = window.Tegaki?.TegakiApplicationInstance;
        if (app) {
            if (typeof app.getV8DebugInfo === 'function') {
                systemInfo.v8Application = app.getV8DebugInfo();
            }
            
            if (typeof app.getV8SystemStats === 'function') {
                const stats = app.getV8SystemStats();
                systemInfo.v8Integration.fullyReady = app.isV8Ready?.() || false;
                systemInfo.v8Integration.featuresEnabled = stats.v8Features?.enabled || 0;
            }
            
            if (typeof app.getWebGPUStatus === 'function') {
                const webgpu = app.getWebGPUStatus();
                systemInfo.v8Performance.rendererType = webgpu.rendererType;
                systemInfo.v8Performance.webgpuSupported = webgpu.supported;
                systemInfo.v8Performance.webgpuActive = webgpu.active;
            }
        }
        
        console.log('📊 v8システム情報:', systemInfo);
        console.log('📊 === v8システム情報取得終了 ===');
        
        return systemInfo;
    };
    
    /**
     * 🚀 v8システムリセット・デバッグ用・完全初期化
     */
    window.resetV8System = function() {
        console.log('🔄 === v8システムリセット開始 ===');
        
        const app = window.Tegaki?.TegakiApplicationInstance;
        if (app && typeof app.resetV8System === 'function') {
            try {
                app.resetV8System();
                console.log('✅ v8システムリセット完了');
                console.log('⚠️ ページリロードが推奨されます');
            } catch (error) {
                console.error('❌ v8システムリセットエラー:', error);
            }
        } else {
            console.log('⚠️ v8システムリセット機能未対応');
        }
        
        console.log('🔄 === v8システムリセット終了 ===');
    };
    
    /**
     * 🚀 v8性能テスト・WebGPU vs WebGL・描画性能
     */
    window.testV8Performance = function() {
        console.log('⚡ === v8性能テスト開始 ===');
        
        const performanceResults = {
            rendererType: null,
            webgpuSupported: null,
            webgpuActive: false,
            drawingPerformance: null,
            frameRate: null
        };
        
        const app = window.Tegaki?.TegakiApplicationInstance;
        if (app) {
            // レンダラー情報取得
            const webgpu = app.getWebGPUStatus?.();
            if (webgpu) {
                performanceResults.rendererType = webgpu.rendererType;
                performanceResults.webgpuSupported = webgpu.supported;
                performanceResults.webgpuActive = webgpu.active;
            }
            
            // 描画性能測定（将来実装）
            console.log('⚡ 描画性能測定は将来実装予定');
        }
        
        console.log('⚡ v8性能テスト結果:', performanceResults);
        console.log('⚡ === v8性能テスト終了 ===');
        
        return performanceResults;
    };
    
    console.log('🚀 main.js v8統合エントリーポイント Loaded - グローバル関数・デバッグ機能・WebGPU対応');
    
} else {
    console.log('⚠️ main.js v8機能 already defined - skipping redefinition');
}

// v8統合確認実行（自動）
if (typeof window.PIXI !== 'undefined' && window.PIXI.VERSION.startsWith('8.')) {
    console.log('✅ PixiJS v8確認完了 - v8統合機能利用可能');
    
    // v8自動確認（5秒後）
    setTimeout(() => {
        if (window.Tegaki?.TegakiApplicationInstance?.isV8Ready?.()) {
            console.log('✅ TegakiApplication v8初期化完了');
            console.log('🚀 デバッグ: window.debugTegakiV8() でv8情報確認可能');
        } else {
            console.log('⚠️ TegakiApplication v8初期化未完了');
        }
    }, 5000);
} else {
    console.log('⚠️ PixiJS v8未確認 - v8機能制限あり');
}