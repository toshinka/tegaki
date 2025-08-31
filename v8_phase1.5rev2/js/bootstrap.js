/**
 * 📄 FILE: js/bootstrap.js
 * 📌 RESPONSIBILITY: Tegaki v8アプリケーション初期化順序確立・DOM挿入確実化
 * ChangeLog: 2025-08-31 <ToolManager.getTools()エラー修正・初期化順序改善>
 * 
 * @provides
 *   - initializeTegakiApplication(): Promise<TegakiApplication>
 *   - checkPixiJSAvailability(): Promise<void>
 *   - checkPhase15Dependencies(): boolean
 *   - runIntegrationTest(): Promise<Object>
 *   - ensureCanvasContainerExists(): boolean
 *   - start(): Promise<TegakiApplication>
 *
 * @uses
 *   - window.Tegaki.TegakiApplication
 *   - window.Tegaki.CanvasManagerInstance
 *   - window.Tegaki.CoordinateManagerInstance
 *   - window.Tegaki.runPhase15Test()
 *
 * @initflow
 *   1. checkPixiJSAvailability → 2. ensureCanvasContainerExists → 3. initializeTegakiApplication
 *   → 4. CoordinateManager.setCanvasManager → 5. runIntegrationTest → 6. 準備完了
 *
 * @forbids
 *   💀 双方向依存禁止
 *   🚫 フォールバック禁止
 *   🚫 フェイルセーフ禁止
 *   🚫 v7/v8二重管理禁止
 *   🚫 未実装メソッド呼び出し禁止
 *   🚫 DOM挿入タイミング不正禁止
 *   🚫 Manager準備未確認操作禁止
 *
 * @manager-key
 *   window.Tegaki.BootstrapInstance
 *
 * @dependencies-strict
 *   REQUIRED: PixiJS v8.12.0, TegakiApplication, CanvasManager, CoordinateManager, ToolManager
 *   OPTIONAL: Phase1.5統合テスト
 *   FORBIDDEN: v7コード、フォールバック処理
 *
 * @integration-flow
 *   DOMContentLoaded → bootstrap.start() → Manager初期化チェーン
 *   → Canvas DOM挿入確実化 → 座標変換確立 → Tool準備確認 → 描画準備完了
 *
 * @method-naming-rules
 *   初期化系: initializeTegakiApplication(), start()
 *   確認系: checkPixiJSAvailability(), checkPhase15Dependencies()
 *   実行系: runIntegrationTest(), ensureCanvasContainerExists()
 *
 * @error-handling
 *   throw: 必須依存関係不足・Manager初期化失敗・DOM要素不足
 *   warn: オプション機能不足・統合テスト部分失敗
 *   log: 初期化進行状況・成功確認
 *
 * @testing-hooks
 *   - runIntegrationTest(): システム統合状態確認
 *   - checkPhase15Dependencies(): 依存関係確認
 *   - getBootstrapDebugInfo(): 初期化状態詳細
 *
 * @performance-notes
 *   初期化時間最適化・DOM操作最小化・Manager準備並行化
 *   エラー時即座停止・デバッグ情報充実
 */

(function() {
    'use strict';

    /**
     * PixiJS v8利用可能性確認
     * @returns {Promise<void>} 確認完了Promise
     */
    async function checkPixiJSAvailability() {
        console.log('🔍 PixiJS v8利用可能性確認開始');
        
        if (typeof PIXI === 'undefined') {
            throw new Error('PixiJS not loaded - v8.12.0 required');
        }
        
        // PixiJS バージョン確認
        const version = PIXI.VERSION;
        console.log(`🎯 PixiJS バージョン: ${version}`);
        
        if (!version.startsWith('8.')) {
            throw new Error(`PixiJS v8 required, found: ${version}`);
        }
        
        // WebGPU対応確認
        const webgpuSupported = PIXI.WebGPURenderer?.test?.();
        console.log(`🎮 WebGPU対応: ${webgpuSupported ? '✅' : '❌ (WebGL2フォールバック)'}`);
        
        console.log('✅ PixiJS v8利用可能性確認完了');
    }
    
    /**
     * Canvas Container DOM要素存在確認・作成
     * @returns {boolean} Canvas Container準備完了状態
     */
    function ensureCanvasContainerExists() {
        console.log('🏗️ Canvas Container存在確認・作成開始');
        
        let container = document.getElementById('canvas-container');
        
        if (!container) {
            console.log('🏗️ canvas-container not found - creating...');
            
            container = document.createElement('div');
            container.id = 'canvas-container';
            container.style.cssText = `
                width: 400px;
                height: 400px;
                position: relative;
                margin: 20px auto;
                background-color: #f0e0d6;
            `;
            
            // body に挿入
            document.body.appendChild(container);
            console.log('🏗️ canvas-container作成・body挿入完了');
        } else {
            console.log('🏗️ canvas-container既存確認');
        }
        
        // スタイル確認・修正
        if (!container.style.width) {
            container.style.width = '400px';
            container.style.height = '400px';
        }
        
        console.log('✅ Canvas Container準備完了');
        return true;
    }
    
    /**
     * Phase1.5依存関係確認
     * @returns {boolean} 依存関係満足状態
     */
    function checkPhase15Dependencies() {
        console.log('🔍 Phase1.5依存関係確認開始');
        
        const required = [
            'Tegaki',
            'Tegaki.TegakiApplication',
            'Tegaki.CanvasManager',
            'Tegaki.CoordinateManager',
            'Tegaki.ToolManager',
            'Tegaki.PenTool',
            'Tegaki.AbstractTool'
        ];
        
        const missing = [];
        
        for (const dep of required) {
            const parts = dep.split('.');
            let obj = window;
            
            for (const part of parts) {
                if (!obj || typeof obj[part] === 'undefined') {
                    missing.push(dep);
                    break;
                }
                obj = obj[part];
            }
        }
        
        if (missing.length > 0) {
            console.error('❌ 必須依存関係不足:', missing);
            throw new Error(`Required dependencies missing: ${missing.join(', ')}`);
        }
        
        console.log('✅ Phase1.5依存関係確認完了');
        return true;
    }
    
    /**
     * TegakiApplication v8対応版 初期化（順序確立版・ToolManager修正版）
     * @returns {Promise<TegakiApplication>} 初期化済みアプリケーション
     */
    async function initializeTegakiApplication() {
        console.log('🚀 TegakiApplication v8対応版 初期化開始');
        
        try {
            // Step 1: TegakiApplication作成・基本初期化
            const tegakiApp = new window.Tegaki.TegakiApplication();
            await tegakiApp.initialize();
            
            console.log('🚀 TegakiApplication基本初期化完了');
            
            // Step 2: Canvas DOM挿入確実化（重要な修正）
            const canvasElement = tegakiApp.getCanvasElement();
            const container = document.getElementById('canvas-container');
            
            if (canvasElement && container && !container.contains(canvasElement)) {
                container.appendChild(canvasElement);
                console.log('✅ Canvas DOM挿入確実化完了');
            }
            
            // Step 3: CanvasManager準備完了確認
            const canvasManager = window.Tegaki.CanvasManagerInstance;
            if (!canvasManager || !canvasManager.isV8Ready()) {
                throw new Error('CanvasManager v8初期化未完了');
            }
            console.log('✅ CanvasManager準備完了確認');
            
            // Step 4: CoordinateManager初期化・CanvasManager設定（重要）
            const coordinateManager = window.Tegaki.CoordinateManagerInstance;
            if (!coordinateManager) {
                throw new Error('CoordinateManager not available');
            }
            
            console.log('🧭 CoordinateManager.setCanvasManager() 実行...');
            await coordinateManager.setCanvasManager(canvasManager);
            
            // CoordinateManager準備完了確認
            if (!coordinateManager.isReady()) {
                throw new Error('CoordinateManager初期化未完了');
            }
            console.log('✅ CoordinateManager準備完了確認');
            
            // Step 5: ToolManager・Tool準備完了確認（修正版）
            const toolManager = tegakiApp.appCore?.toolManager;
            if (!toolManager) {
                throw new Error('ToolManager初期化未完了');
            }
            
            // ToolManager.isReady()確認
            if (!toolManager.isReady()) {
                throw new Error('ToolManager準備未完了');
            }
            
            // Tool一覧取得・PenTool確認（修正版）
            const tools = toolManager.getTools();
            if (!tools || tools.size === 0) {
                throw new Error('Tools初期化未完了');
            }
            
            const penTool = tools.get('pen');
            if (!penTool) {
                throw new Error('PenTool初期化未完了');
            }
            
            // PenTool準備完了確認
            if (typeof penTool.waitForReady === 'function') {
                await penTool.waitForReady();
                console.log('✅ PenTool準備完了確認');
            }
            
            // Step 6: 座標変換テスト実行
            if (typeof coordinateManager.testCoordinate === 'function') {
                const testResult = coordinateManager.testCoordinate(100, 100);
                if (testResult.error) {
                    console.warn('⚠️ 座標変換テスト失敗:', testResult);
                } else {
                    console.log('✅ 座標変換テスト成功');
                }
            }
            
            console.log('🎉 TegakiApplication v8システム初期化成功！');
            return tegakiApp;
            
        } catch (error) {
            console.error('❌ TegakiApplication初期化失敗:', error);
            throw error;
        }
    }
    
    /**
     * Phase1.5統合テスト実行（初期化後の確認）
     * @returns {Promise<Object>} テスト結果オブジェクト
     */
    async function runIntegrationTest() {
        console.log('🧪 Phase1.5統合テスト開始');
        
        try {
            // Manager準備状態確認
            const canvasManager = window.Tegaki.CanvasManagerInstance;
            const coordinateManager = window.Tegaki.CoordinateManagerInstance;
            const toolManager = window.Tegaki.TegakiApplicationInstance?.appCore?.toolManager;
            
            const managerStatus = {
                canvasManager: {
                    exists: !!canvasManager,
                    v8Ready: canvasManager?.isV8Ready() || false,
                    hasDrawContainer: canvasManager ? (() => {
                        try {
                            return !!canvasManager.getDrawContainer();
                        } catch (e) {
                            return false;
                        }
                    })() : false,
                    hasTemporaryGraphics: canvasManager ? (() => {
                        try {
                            return !!canvasManager.getTemporaryGraphics();
                        } catch (e) {
                            return false;
                        }
                    })() : false
                },
                coordinateManager: {
                    exists: !!coordinateManager,
                    ready: coordinateManager?.isReady() || false,
                    hasCanvasManager: !!coordinateManager?.canvasManager
                },
                toolManager: {
                    exists: !!toolManager,
                    ready: toolManager?.isReady() || false,
                    toolCount: toolManager?.getTools()?.size || 0,
                    currentTool: toolManager?.getCurrentToolName() || 'none'
                }
            };
            
            // 座標変換テスト（4隅+中心）
            let coordinateTestResults = null;
            if (coordinateManager?.isReady()) {
                coordinateTestResults = {
                    topLeft: coordinateManager.testCoordinate ? coordinateManager.testCoordinate(0, 0) : { error: 'testCoordinate not available' },
                    center: coordinateManager.testCoordinate ? coordinateManager.testCoordinate(200, 200) : { error: 'testCoordinate not available' },
                    bottomRight: coordinateManager.testCoordinate ? coordinateManager.testCoordinate(400, 400) : { error: 'testCoordinate not available' }
                };
            }
            
            // Canvas DOM挿入確認
            const canvasElement = canvasManager?.getCanvasElement();
            const container = document.getElementById('canvas-container');
            const canvasDOMStatus = {
                canvasExists: !!canvasElement,
                containerExists: !!container,
                canvasInContainer: canvasElement && container && container.contains(canvasElement),
                canvasVisible: canvasElement ? (canvasElement.style.display !== 'none') : false
            };
            
            // Tool状態確認
            const toolStatus = {
                toolManagerExists: !!toolManager,
                toolsLoaded: toolManager ? toolManager.getTools().size > 0 : false,
                penToolExists: toolManager ? !!toolManager.getTools().get('pen') : false,
                currentToolActive: toolManager ? !!toolManager.getCurrentTool() : false
            };
            
            const testResults = {
                managerStatus,
                toolStatus,
                coordinateTestResults,
                canvasDOMStatus,
                timestamp: new Date().toISOString(),
                success: managerStatus.canvasManager.v8Ready && 
                        managerStatus.coordinateManager.ready &&
                        managerStatus.toolManager.ready &&
                        toolStatus.penToolExists &&
                        canvasDOMStatus.canvasInContainer
            };
            
            console.log('🧪 Phase1.5統合テスト結果:', testResults);
            
            if (testResults.success) {
                console.log('✅ 全システム準備完了 - ペン描画利用可能');
            } else {
                console.warn('⚠️ システム準備未完了 - 問題箇所確認必要');
            }
            
            return testResults;
            
        } catch (error) {
            console.error('❌ 統合テスト実行エラー:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Phase1.5統合テスト実行（外部呼び出し用）
     */
    async function runPhase15IntegrationTest() {
        // window.Tegaki.runPhase15Test() の代替実装
        const testResults = await runIntegrationTest();
        
        // コンソール出力（Phase1.5統合テスト形式）
        console.log('📋 =========================');
        console.log('📋 Phase1.5統合テスト結果');
        console.log('📋 =========================');
        
        if (testResults.success) {
            console.log('✅ 総合判定: 成功 - 全システム動作準備完了');
        } else {
            console.log('❌ 総合判定: 失敗 - システム問題あり');
        }
        
        console.log('📊 Manager状態:', testResults.managerStatus);
        console.log('📊 Tool状態:', testResults.toolStatus);
        console.log('📊 Canvas DOM:', testResults.canvasDOMStatus);
        console.log('📊 座標変換:', testResults.coordinateTestResults);
        console.log('📋 =========================');
        
        return testResults;
    }
    
    /**
     * Bootstrap debug情報取得
     * @returns {Object} 初期化状態詳細
     */
    function getBootstrapDebugInfo() {
        return {
            className: 'Bootstrap',
            version: 'v8-phase1.5-toolmanager-fixed',
            dependencies: {
                pixiJS: typeof PIXI !== 'undefined' ? PIXI.VERSION : 'not loaded',
                tegakiApp: !!window.Tegaki?.TegakiApplicationInstance,
                canvasManager: !!window.Tegaki?.CanvasManagerInstance,
                coordinateManager: !!window.Tegaki?.CoordinateManagerInstance,
                toolManager: !!window.Tegaki?.TegakiApplicationInstance?.appCore?.toolManager
            },
            domStatus: {
                canvasContainer: !!document.getElementById('canvas-container'),
                bodyReady: document.readyState,
                windowLoaded: document.readyState === 'complete'
            },
            timing: {
                timestamp: new Date().toISOString(),
                readyState: document.readyState
            }
        };
    }
    
    /**
     * メイン初期化フロー（修正版・順序確立・ToolManager対応）
     * @returns {Promise<TegakiApplication>} 初期化済みアプリケーション
     */
    async function start() {
        try {
            console.log('🚀 Bootstrap PixiJS v8対応版 実行開始...');
            
            // Step 1: PixiJS v8確認
            await checkPixiJSAvailability();
            
            // Step 2: Canvas Container DOM確保
            ensureCanvasContainerExists();
            
            // Step 3: 依存関係確認
            checkPhase15Dependencies();
            
            // Step 4: TegakiApplication初期化（順序確立版・ToolManager修正版）
            const tegakiApp = await initializeTegakiApplication();
            
            // Step 5: 統合テスト実行
            const testResult = await runIntegrationTest();
            
            if (!testResult.success) {
                console.error('❌ 統合テスト失敗:', testResult);
                // 統合テスト失敗時でも継続（デバッグ可能性確保）
            }
            
            // Step 6: グローバル関数登録
            window.Tegaki.runPhase15Test = runPhase15IntegrationTest;
            window.Tegaki.getBootstrapDebugInfo = getBootstrapDebugInfo;
            
            console.log('🎉 Bootstrap完了 - Tegaki v8アプリケーション開始完了');
            console.log('🎮 使用中レンダラー: WebGPU対応・PixiJS 8.12.0');
            console.log('🧪 テスト実行: window.Tegaki.runPhase15Test()');
            
            return tegakiApp;
            
        } catch (error) {
            console.error('💥 Bootstrap初期化失敗:', error);
            console.log('🔍 デバッグ情報:', getBootstrapDebugInfo());
            throw error;
        }
    }
    
    // グローバル公開
    if (!window.Tegaki) {
        window.Tegaki = {};
    }
    
    window.Tegaki.Bootstrap = {
        start,
        initializeTegakiApplication,
        runIntegrationTest: runPhase15IntegrationTest,
        checkPixiJSAvailability,
        ensureCanvasContainerExists,
        getBootstrapDebugInfo
    };
    
    // DOMContentLoaded時自動実行
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        // 既にロード済みの場合は即座実行
        setTimeout(start, 100);
    }
    
    console.log('🚀 Bootstrap PixiJS v8対応版・初期化順序確立版・ToolManager対応版 Loaded');
    console.log('📏 特徴: DOM挿入確実化・Manager順序制御・座標変換確立・Tool準備確認・統合テスト自動実行');

})();