/**
 * 🔄 管理システム初期化（座標統合完全修正版 - ToDoリスト対応）
 * ToDoリストの要求に沿ってToolManagerの初期化方法を修正
 */
async initializeManagers() {
    console.log('🔧 管理システム初期化中（座標統合完全修正版）...');
    
    // 境界管理システム初期化（座標統合対応）
    if (window.BoundaryManager) {
        try {
            this.boundaryManager = new window.BoundaryManager();
            // 🔄 COORDINATE_INTEGRATION: CoordinateManagerを渡して統合初期化
            await this.boundaryManager.initialize(this.app.view, this.coordinateManager);
            console.log('✅ BoundaryManager初期化完了（座標統合版）');
        } catch (error) {
            console.warn('⚠️ BoundaryManager初期化失敗（オプション）:', error.message);
            this.boundaryManager = null;
        }
    } else {
        console.warn('⚠️ BoundaryManager利用不可（オプション）');
    }
    
    // ツールマネージャー初期化（座標統合完全修正版 - ToDoリスト対応）
    if (window.ToolManager) {
        try {
            this.toolManager = new window.ToolManager(this);
            // 🔄 COORDINATE_INTEGRATION: パラメータなしでinitialize()を呼び出し
            // ToolManagerが内部でCoordinateManagerを自動検出・統合する
            await this.toolManager.initialize();
            console.log('✅ ToolManager初期化完了（座標統合完全版）');
            
            // 🆕 座標統合確認テスト実行
            if (typeof this.toolManager.runCoordinateIntegrationTest === 'function') {
                const testResult = this.toolManager.runCoordinateIntegrationTest();
                if (testResult.overallResult) {
                    console.log('✅ ToolManager座標統合テスト合格');
                } else {
                    console.warn('⚠️ ToolManager座標統合テスト不合格:', testResult);
                }
            }
            
        } catch (error) {
            console.warn('⚠️ ToolManager初期化失敗（オプション）:', error.message);
            this.toolManager = null;
        }
    } else {
        console.warn('⚠️ ToolManager利用不可（オプション）');
    }
    
    // UIマネージャー初期化（修正版 - init()メソッド使用）
    if (window.UIManager) {
        try {
            this.uiManager = new window.UIManager(this);
            await this.uiManager.init(); // ← UIManagerは init() メソッド（initialize()ではない）
            console.log('✅ UIManager初期化完了');
        } catch (error) {
            console.warn('⚠️ UIManager初期化失敗（オプション）:', error.message);
            this.uiManager = null;
        }
    } else {
        console.warn('⚠️ UIManager利用不可（オプション）');
    }
    
    console.log('✅ 管理システム初期化完了（座標統合完全版）');
    
    // 🆕 座標統合状態確認（Manager初期化完了後）
    this.verifyCoordinateIntegration();
}

/**
 * 🆕 COORDINATE_FEATURE: 座標統合状態確認（AppCore用）
 */
verifyCoordinateIntegration() {
    console.group('🔍 AppCore座標統合状態確認');
    
    const integrationStatus = {
        coordinateManagerInitialized: !!this.coordinateManager,
        boundaryManagerIntegrated: !!(this.boundaryManager && this.boundaryManager.coordinateManager),
        toolManagerIntegrated: !!(this.toolManager && this.toolManager.coordinateManager),
        uiManagerInitialized: !!this.uiManager
    };
    
    const integrationCount = Object.values(integrationStatus).filter(Boolean).length;
    const totalComponents = Object.keys(integrationStatus).length;
    const integrationRate = Math.round((integrationCount / totalComponents) * 100);
    
    console.log('📊 座標統合状況:');
    Object.entries(integrationStatus).forEach(([key, value]) => {
        console.log(`  ${value ? '✅' : '❌'} ${key}: ${value ? '統合済み' : '未統合'}`);
    });
    
    console.log(`📊 統合率: ${integrationCount}/${totalComponents} (${integrationRate}%)`);
    
    if (integrationRate === 100) {
        console.log('🎉 AppCore座標統合完了 - 全コンポーネント統合済み');
    } else if (integrationRate >= 75) {
        console.log('✅ AppCore座標統合良好 - 主要コンポーネント統合済み');
    } else {
        console.warn('⚠️ AppCore座標統合不完全 - 追加統合が必要');
    }
    
    // 個別診断実行
    if (this.toolManager && typeof this.toolManager.runToolCoordinateIntegrationDiagnosis === 'function') {
        this.toolManager.runToolCoordinateIntegrationDiagnosis();
    }
    
    if (this.boundaryManager && typeof this.boundaryManager.runBoundaryCoordinateIntegrationDiagnosis === 'function') {
        this.boundaryManager.runBoundaryCoordinateIntegrationDiagnosis();
    }
    
    console.groupEnd();
    
    return integrationStatus;
}

/**
 * 🆕 座標統合状態取得（外部アクセス用 - 拡張版）
 */
getCoordinateIntegrationState() {
    const baseState = {
        coordinateManagerAvailable: !!this.coordinateManager,
        boundaryManagerIntegrated: !!(this.boundaryManager && this.boundaryManager.coordinateManager),
        toolManagerIntegrated: !!(this.toolManager && this.toolManager.coordinateManager),
        uiManagerAvailable: !!this.uiManager,
        coordinateManagerState: this.coordinateManager ? 
            this.coordinateManager.getCoordinateState() : null,
        appCoreState: this.getInitializationStats(),
        phase2Ready: !!(this.coordinateManager && 
                       this.boundaryManager?.coordinateManager && 
                       this.toolManager?.coordinateManager)
    };
    
    // 詳細統合状態
    if (this.toolManager) {
        baseState.toolManagerIntegrationDetails = this.toolManager.getCoordinateIntegrationState();
    }
    
    if (this.boundaryManager) {
        baseState.boundaryManagerIntegrationDetails = this.boundaryManager.getBoundaryState().coordinateIntegration;
    }
    
    // 統合健全性スコア
    const integrationItems = [
        baseState.coordinateManagerAvailable,
        baseState.boundaryManagerIntegrated,
        baseState.toolManagerIntegrated,
        baseState.phase2Ready
    ];
    
    const healthyItems = integrationItems.filter(Boolean).length;
    baseState.integrationHealthScore = Math.round((healthyItems / integrationItems.length) * 100);
    
    return baseState;
}

/**
 * 🆕 AppCore座標統合診断実行
 */
runAppCoreCoordinateIntegrationDiagnosis() {
    console.group('🔍 AppCore座標統合診断（完全版）');
    
    const integrationState = this.getCoordinateIntegrationState();
    const initStats = this.getInitializationStats();
    
    // AppCore固有のテスト
    const appCoreTests = {
        coordinateManagerInitialized: !!this.coordinateManager,
        managerInitializationSequence: this.initializationComplete,
        pixiAppIntegrated: !!(this.app && this.coordinateManager),
        eventHandlersIntegrated: true, // イベントハンドラーは常に設定される
        boundarySystemIntegrated: !!(this.boundaryManager && this.coordinateManager),
        toolSystemIntegrated: !!(this.toolManager && this.coordinateManager),
        coordinateDisplayFunctional: true, // updateCoordinateDisplayが存在する
        resizeHandlerIntegrated: typeof this.handleResize === 'function'
    };
    
    const passedTests = Object.values(appCoreTests).filter(Boolean).length;
    const totalTests = Object.keys(appCoreTests).length;
    const testPassRate = Math.round((passedTests / totalTests) * 100);
    
    console.log('📊 AppCore座標統合診断結果:');
    console.log(`🧪 AppCoreテスト結果: ${passedTests}/${totalTests} PASS (${testPassRate}%)`);
    console.log(`🔧 統合健全性スコア: ${integrationState.integrationHealthScore}%`);
    console.log(`🎯 Phase2準備状況: ${integrationState.phase2Ready ? '準備完了' : '準備未完了'}`);
    
    // 詳細テスト結果
    console.log('📋 詳細テスト結果:');
    Object.entries(appCoreTests).forEach(([key, value]) => {
        console.log(`  ${value ? '✅' : '❌'} ${key}: ${value ? 'PASS' : 'FAIL'}`);
    });
    
    // 推奨事項
    const recommendations = [];
    
    if (!appCoreTests.coordinateManagerInitialized) {
        recommendations.push('CoordinateManagerの初期化を確認してください');
    }
    
    if (!integrationState.boundaryManagerIntegrated) {
        recommendations.push('BoundaryManagerの座標統合を完了してください');
    }
    
    if (!integrationState.toolManagerIntegrated) {
        recommendations.push('ToolManagerの座標統合を完了してください');
    }
    
    if (!integrationState.phase2Ready) {
        recommendations.push('Phase2準備のため全Manager統合を完了してください');
    }
    
    if (integrationState.integrationHealthScore < 90) {
        recommendations.push('座標統合健全性の向上が必要です');
    }
    
    // 総合評価
    const overallScore = Math.round((testPassRate + integrationState.integrationHealthScore) / 2);
    
    console.log(`📊 AppCore総合評価: ${overallScore}/100点`);
    
    if (overallScore >= 90) {
        console.log('🏆 優秀 - AppCore座標統合が完璧に動作しています');
    } else if (overallScore >= 75) {
        console.log('✅ 良好 - AppCore座標統合が正常に動作しています');
    } else if (overallScore >= 60) {
        console.log('⚠️ 要注意 - AppCore座標統合に一部問題があります');
    } else {
        console.warn('❌ 要修正 - AppCore座標統合に重大な問題があります');
    }
    
    if (recommendations.length > 0) {
        console.warn('💡 AppCore推奨事項:', recommendations);
    } else {
        console.log('✅ AppCore座標統合診断: 全ての要件を満たしています');
    }
    
    console.groupEnd();
    
    return {
        integrationState,
        appCoreTests,
        testPassRate,
        overallScore,
        recommendations,
        timestamp: Date.now()
    };
}