// bootstrap.js の初期化順序修正版（重要部分のみ抜粋）
// 完全版は既存ファイルに統合してください

/**
 * TegakiApplication v8対応版 インスタンス化・初期化順序確立版
 */
async function initializeTegakiApplication() {
    console.log('TegakiApplication v8対応版 インスタンス化開始...');
    
    try {
        // Step 1: TegakiApplication作成・基本初期化
        const tegakiApp = new window.Tegaki.TegakiApplication();
        await tegakiApp.initialize();
        
        // Step 2: CanvasManager準備完了確認
        const canvasManager = window.Tegaki.CanvasManagerInstance;
        if (!canvasManager || !canvasManager.isV8Ready()) {
            throw new Error('CanvasManager v8初期化未完了');
        }
        
        // Step 3: CoordinateManager初期化・CanvasManager設定
        const coordinateManager = window.Tegaki.CoordinateManagerInstance;
        await coordinateManager.setCanvasManager(canvasManager);
        
        // CoordinateManager準備完了確認
        if (!coordinateManager.isReady()) {
            throw new Error('CoordinateManager初期化未完了');
        }
        
        // Step 4: ToolManager初期化確認
        const toolManager = tegakiApp.appCore?.toolManager;
        if (!toolManager) {
            throw new Error('ToolManager初期化未完了');
        }
        
        // Step 5: PenTool準備完了確認
        const penTool = toolManager.getCurrentTool();
        if (penTool && penTool.toolName === 'pen') {
            await penTool.waitForReady();
            console.log('PenTool準備完了確認');
        }
        
        // Step 6: 座標変換テスト実行
        const testResult = coordinateManager.testCoordinateConversion(100, 100);
        if (!testResult.success) {
            console.warn('座標変換テスト失敗:', testResult);
        }
        
        console.log('TegakiApplication v8システム初期化成功！');
        return tegakiApp;
        
    } catch (error) {
        console.error('TegakiApplication初期化失敗:', error);
        throw error;
    }
}

/**
 * Phase1.5統合テスト実行（初期化後の確認）
 */
async function runIntegrationTest() {
    console.log('Phase1.5統合テスト開始');
    
    try {
        // Manager準備状態確認
        const canvasManager = window.Tegaki.CanvasManagerInstance;
        const coordinateManager = window.Tegaki.CoordinateManagerInstance;
        
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
                })() : false
            },
            coordinateManager: {
                exists: !!coordinateManager,
                ready: coordinateManager?.isReady() || false,
                hasCanvasManager: !!coordinateManager?.canvasManager
            }
        };
        
        // 座標変換テスト（4隅+中心）
        let coordinateTestResults = null;
        if (coordinateManager?.isReady()) {
            coordinateTestResults = coordinateManager.testAllCorners();
        }
        
        const testResults = {
            managerStatus,
            coordinateTestResults,
            timestamp: new Date().toISOString(),
            success: managerStatus.canvasManager.v8Ready && 
                    managerStatus.coordinateManager.ready
        };
        
        console.log('Phase1.5統合テスト結果:', testResults);
        
        if (testResults.success) {
            console.log('✅ 全システム準備完了 - ペン描画利用可能');
        } else {
            console.warn('⚠️ システム準備未完了');
        }
        
        return testResults;
        
    } catch (error) {
        console.error('統合テスト実行エラー:', error);
        return { success: false, error: error.message };
    }
}

// 修正版の初期化フロー
async function start() {
    try {
        console.log('Bootstrap PixiJS v8対応版 実行開始...');
        
        // Step 1: PixiJS確認
        await checkPixiJSAvailability();
        
        // Step 2: 依存関係確認
        checkPhase15Dependencies();
        
        // Step 3: TegakiApplication初期化（順序確立版）
        const tegakiApp = await initializeTegakiApplication();
        
        // Step 4: 統合テスト実行
        const testResult = await runIntegrationTest();
        
        if (!testResult.success) {
            throw new Error('統合テスト失敗');
        }
        
        console.log('Bootstrap完了 - Tegaki v8アプリケーション開始完了');
        console.log('使用中レンダラー: WebGPU対応・PixiJS 8.12.0');
        
        return tegakiApp;
        
    } catch (error) {
        console.error('Bootstrap初期化失敗:', error);
        throw error;
    }
}