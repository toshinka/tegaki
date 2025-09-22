// ===== core-engine.js - 統合コアエンジン（Phase2分離完了版） =====
// Phase1.5改修 + Phase2分離完了：各Engineを統合制御する軽量ファサード
// 🚨 Phase1.5改修完了：冗長メソッド削除・座標変換統一・Phase2分割準備完了 🚨

/*
=== Phase2分離完了 + Phase1.5改修完了ヘッダー ===

【Phase2分離完了】
✅ CameraSystem → camera-system.js 完全分離
✅ LayerManager → layer-system.js 完全分離  
✅ DrawingEngine → drawing-engine.js 完全分離
✅ ClipboardSystem → clipboard-system.js 完全分離

【Phase1.5改修完了】
✅ 冗長メソッド削除: 重複座標変換メソッド完全排除
✅ API境界明確化: CoordinateSystem統一使用
✅ 座標変換精度検証: テストスイート追加
✅ 分割準備コメント: 依存関係・責務明確化

【現在の役割】
- 各分離Engineの初期化・統合制御
- 依存注入・相互参照設定
- 統合インタラクション処理
- CoreRuntime向け公開API提供

【アーキテクチャ】
UI Layer (index.html, ui-panels.js)
  ↓ 統一API
CoreRuntime (公開窓口)
  ↓ Engine統合
CoreEngine (分離Engine統合制御) ← 現在のファイル
  ↓ 個別Engine
CameraSystem + LayerManager + DrawingEngine + ClipboardSystem

【Dependencies】
- CONFIG: config.js グローバル設定
- window.CoordinateSystem: coordinate-system.js 統一座標API
- PIXI: PixiJS v8.13
- camera-system.js: CameraSystem
- layer-system.js: LayerManager  
- drawing-engine.js: DrawingEngine
- clipboard-system.js: ClipboardSystem

=== Phase2分離完了 + Phase1.5改修完了ヘッダー終了 ===
*/

(function() {
    'use strict';
    
    // グローバル設定を取得
    const CONFIG = window.TEGAKI_CONFIG;
    
    const log = (...args) => {
        if (CONFIG.debug) console.log(...args);
    };

    // === 【Phase1.5新規追加】座標変換精度検証テストスイート ===
    const CoordinateTestSuite = {
        // 往復変換精度テスト
        testRoundTripAccuracy() {
            if (!window.CoordinateSystem) {
                console.error('CoordinateSystem not available for testing');
                return false;
            }
            
            const testPoints = [
                { x: 100, y: 100 },
                { x: 500, y: 300 },
                { x: 0, y: 0 },
                { x: CONFIG.canvas.width, y: CONFIG.canvas.height }
            ];
            
            console.log('=== 座標変換精度テスト開始 ===');
            
            let allTestsPassed = true;
            
            testPoints.forEach((original, index) => {
                try {
                    // screen → canvas → screen
                    const screenPoint = window.CoordinateSystem.canvasToScreen(original.x, original.y);
                    const backToCanvas = window.CoordinateSystem.screenToCanvas(screenPoint.x, screenPoint.y);
                    
                    const error = Math.sqrt(
                        Math.pow(original.x - backToCanvas.x, 2) + 
                        Math.pow(original.y - backToCanvas.y, 2)
                    );
                    
                    const passed = error < 0.001;
                    console.log(`Test ${index + 1}: 誤差 ${error.toFixed(6)}px`, 
                               passed ? '✅ PASS' : '❌ FAIL');
                    
                    if (!passed) {
                        console.error(`座標変換精度エラー: ${JSON.stringify(original)} → ${JSON.stringify(backToCanvas)}`);
                        allTestsPassed = false;
                    }
                } catch (testError) {
                    console.error(`Test ${index + 1} failed:`, testError);
                    allTestsPassed = false;
                }
            });
            
            console.log('=== 座標変換精度テスト完了 ===');
            console.log('結果:', allTestsPassed ? '✅ 全テスト合格' : '❌ テスト失敗あり');
            
            return allTestsPassed;
        }
    };

    // === 【Phase1.5新規追加】Phase1.5検証スイート ===
    const Phase15ValidationSuite = {
        checkAPIUnification() {
            return {
                coreRuntimeAvailable: !!window.CoreRuntime,
                apiMethodsCount: Object.keys(window.CoreRuntime?.api || {}).length,
                coordinateSystemUnified: !!window.CoordinateSystem,
                configLoaded: !!window.TEGAKI_CONFIG,
                splitEnginesAvailable: !!(window.TegakiCameraSystem && 
                                         window.TegakiLayerManager && 
                                         window.TegakiDrawingEngine &&
                                         window.TegakiClipboardSystem)
            };
        },
        
        checkFunctionalIntegrity() {
            const tests = [];
            
            // ツール切り替えテスト
            tests.push({
                name: 'Tool Switching',
                test: () => {
                    try {
                        return window.CoreRuntime?.api?.setTool && 
                               window.CoreRuntime.api.setTool('pen') && 
                               window.CoreRuntime.api.setTool('eraser');
                    } catch {
                        return false;
                    }
                }
            });
            
            // 座標変換テスト
            tests.push({
                name: 'Coordinate Transform',
                test: () => {
                    try {
                        const original = { x: 100, y: 100 };
                        const screen = window.CoordinateSystem.canvasToScreen(original.x, original.y);
                        const back = window.CoordinateSystem.screenToCanvas(screen.x, screen.y);
                        const error = Math.sqrt(Math.pow(original.x - back.x, 2) + Math.pow(original.y - back.y, 2));
                        return error < 0.001;
                    } catch {
                        return false;
                    }
                }
            });
            
            // Engine分離チェック
            tests.push({
                name: 'Engine Separation',
                test: () => {
                    return !!(window.TegakiCameraSystem && 
                             window.TegakiLayerManager && 
                             window.TegakiDrawingEngine &&
                             window.TegakiClipboardSystem);
                }
            });
            
            return tests.map(test => ({
                ...test,
                result: test.test()
            }));
        }
    };

    // === 統合コアエンジンクラス（Phase2分離完了版） ===
    class CoreEngine {
        constructor(app) {
            this.app = app;
            
            // 【Phase2改修】分離Engineクラスの依存確認
            this.validateSplitEngines();
            
            // 【Phase2改修】分離されたEngineを初期化
            this.cameraSystem = new window.TegakiCameraSystem(app);
            this.layerManager = new window.TegakiLayerManager(this.cameraSystem.canvasContainer, app, this.cameraSystem);
            this.drawingEngine = new window.TegakiDrawingEngine(this.cameraSystem, this.layerManager);
            this.clipboardSystem = new window.TegakiClipboardSystem();
            
            // 相互参照を設定
            this.setupCrossReferences();
            
            // 【Phase1.5追加】初期化時に座標変換精度テスト実行
            if (CONFIG.debug) {
                setTimeout(() => {
                    CoordinateTestSuite.testRoundTripAccuracy();
                }, 100);
            }
        }
        
        // 【Phase2新規】分離Engineの依存確認
        validateSplitEngines() {
            const requiredEngines = [
                'TegakiCameraSystem',
                'TegakiLayerManager', 
                'TegakiDrawingEngine',
                'TegakiClipboardSystem'
            ];
            
            const missingEngines = requiredEngines.filter(name => !window[name]);
            
            if (missingEngines.length > 0) {
                console.error('CRITICAL: Missing split engine classes:', missingEngines);
                throw new Error(`Phase2 split engines not loaded: ${missingEngines.join(', ')}`);
            }
            
            console.log('✅ All Phase2 split engines validated successfully');
        }
        
        setupCrossReferences() {
            // CameraSystemに参照を設定
            this.cameraSystem.setLayerManager(this.layerManager);
            this.cameraSystem.setDrawingEngine(this.drawingEngine);
            
            // ClipboardSystemに参照を設定
            this.clipboardSystem.setLayerManager(this.layerManager);
        }
        
        // === 公開API（CoreRuntimeから使用） ===
        getCameraSystem() {
            return this.cameraSystem;
        }
        
        getLayerManager() {
            return this.layerManager;
        }
        
        getDrawingEngine() {
            return this.drawingEngine;
        }
        
        getClipboardSystem() {
            return this.clipboardSystem;
        }
        
        // === 統合インタラクション処理 ===
        setupCanvasEvents() {
            this.app.canvas.addEventListener('pointerdown', (e) => {
                if (e.button !== 0) return;

                const rect = this.app.canvas.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;

                this.drawingEngine.startDrawing(x, y);
                e.preventDefault();
            });

            this.app.canvas.addEventListener('pointermove', (e) => {
                const rect = this.app.canvas.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;

                this.updateCoordinates(x, y);
                this.drawingEngine.continueDrawing(x, y);
            });
            
            // ツール切り替えキー
            document.addEventListener('keydown', (e) => {
                if (e.key.toLowerCase() === 'p' && !e.ctrlKey && !e.altKey && !e.metaKey) {
                    this.switchTool('pen');
                    e.preventDefault();
                }
                if (e.key.toLowerCase() === 'e' && !e.ctrlKey && !e.altKey && !e.metaKey) {
                    this.switchTool('eraser');
                    e.preventDefault();
                }
            });
        }
        
        switchTool(tool) {
            this.cameraSystem.switchTool(tool);
        }
        
        updateCoordinates(x, y) {
            this.cameraSystem.updateCoordinates(x, y);
        }
        
        // サムネイル更新処理
        processThumbnailUpdates() {
            this.layerManager.processThumbnailUpdates();
        }
        
        // キャンバスリサイズ統合処理
        resizeCanvas(newWidth, newHeight) {
            console.log('CoreEngine: Canvas resize request received:', newWidth, 'x', newHeight);
            
            // CONFIG更新
            CONFIG.canvas.width = newWidth;
            CONFIG.canvas.height = newHeight;
            
            // CameraSystemの更新
            this.cameraSystem.resizeCanvas(newWidth, newHeight);
            
            // LayerManagerの背景レイヤー更新
            this.layerManager.layers.forEach(layer => {
                if (layer.layerData.isBackground && layer.layerData.backgroundGraphics) {
                    layer.layerData.backgroundGraphics.clear();
                    layer.layerData.backgroundGraphics.rect(0, 0, newWidth, newHeight);
                    layer.layerData.backgroundGraphics.fill(CONFIG.background.color);
                }
            });
            
            // 全レイヤーのサムネイル更新
            for (let i = 0; i < this.layerManager.layers.length; i++) {
                this.layerManager.requestThumbnailUpdate(i);
            }
            
            console.log('CoreEngine: Canvas resize completed');
        }
        
        // 初期化処理
        initialize() {
            // 初期レイヤー作成
            this.layerManager.createLayer('背景', true);
            this.layerManager.createLayer('レイヤー1');
            this.layerManager.setActiveLayer(1);
            
            this.layerManager.updateLayerPanelUI();
            this.layerManager.updateStatusDisplay();
            
            // UI初期化（SortableJS）
            if (window.TegakiUI && window.TegakiUI.initializeSortable) {
                window.TegakiUI.initializeSortable(this.layerManager);
            }
            
            // キャンバスイベント設定
            this.setupCanvasEvents();
            
            // サムネイル更新ループ
            this.app.ticker.add(() => {
                this.processThumbnailUpdates();
            });
            
            // 【Phase1.5追加】最終検証実行
            this.runPhase15FinalValidation();
            
            console.log('✅ CoreEngine Phase2分離版 initialized successfully');
            return this;
        }
        
        // 【Phase1.5新規】最終検証実行
        runPhase15FinalValidation() {
            console.log('=== Phase1.5 + Phase2 最終検証開始 ===');
            
            // API統一確認
            const apiStatus = Phase15ValidationSuite.checkAPIUnification();
            console.log('API統一状況:', apiStatus);
            
            // 機能完全性確認
            const functionalTests = Phase15ValidationSuite.checkFunctionalIntegrity();
            console.log('機能テスト結果:');
            functionalTests.forEach(test => {
                console.log(`  - ${test.name}: ${test.result ? '✅ PASS' : '❌ FAIL'}`);
            });
            
            // 座標変換精度確認
            const coordinateAccuracy = CoordinateTestSuite.testRoundTripAccuracy();
            
            // 総合判定
            const apiReady = Object.values(apiStatus).every(v => v);
            const functionalReady = functionalTests.every(test => test.result);
            
            if (apiReady && functionalReady && coordinateAccuracy) {
                console.log('✅ Phase1.5 + Phase2 完全成功！');
                console.log('   - 冗長メソッド削除完了');
                console.log('   - 座標変換統一完了');
                console.log('   - Engine分離完了');  
                console.log('   - API境界明確化完了');
                console.log('   - 精度検証合格');
            } else {
                console.warn('⚠️  Phase1.5 + Phase2 未完了項目あり');
                console.log('   - API Ready:', apiReady);
                console.log('   - Functional Ready:', functionalReady);
                console.log('   - Coordinate Accurate:', coordinateAccuracy);
            }
            
            console.log('=== Phase1.5 + Phase2 最終検証完了 ===');
        }
    }

    // === グローバル公開 ===
    window.TegakiCore = {
        CoreEngine: CoreEngine,
        
        // 【Phase1.5追加】検証ツール公開
        CoordinateTestSuite: CoordinateTestSuite,
        Phase15ValidationSuite: Phase15ValidationSuite
    };

    console.log('✅ core-engine.js Phase2分離完了版 loaded');
    console.log('   - Engine classes split into separate files');
    console.log('   - Phase1.5 redundancy elimination completed');
    console.log('   - CoordinateSystem integration unified');
    console.log('   - Precision validation suite added');
    console.log('   - API boundaries clearly established');

})();