/**
 * 🆕 COORDINATE_FEATURE: 座標統合診断実行（完全実装版）
 * ToDoリストで要求された runBoundaryCoordinateIntegrationDiagnosis() メソッド
 * 既存の runBoundaryIntegrationDiagnosis() を拡張した完全版
 */
runBoundaryCoordinateIntegrationDiagnosis() {
    console.group('🔍 BoundaryManager座標統合診断（完全実装版）');
    
    const state = this.getBoundaryState();
    const health = this.checkCoordinateIntegrationHealth();
    
    // 統合機能テスト
    const integrationTests = {
        coordinateManagerAvailable: !!this.coordinateManager,
        canvasElementInitialized: !!this.canvasElement,
        initializeMethodIntegration: typeof this.initialize === 'function',
        expandedHitAreaIntegration: typeof this.createExpandedHitAreaWithCoordinateIntegration === 'function',
        boundaryCheckIntegration: typeof this.checkBoundaryWithCoordinateIntegration === 'function',
        crossInHandlerIntegration: typeof this.handleBoundaryCrossInWithCoordinateIntegration === 'function',
        coordinateValidation: !!(this.coordinateManager && this.coordinateManager.validateCoordinateIntegrity),
        coordinateTransformation: !!(this.coordinateManager && this.coordinateManager.screenToCanvas),
        coordinatePrecision: !!(this.coordinateManager && this.coordinateManager.applyPrecision),
        eventBusIntegration: !!window.EventBus,
        configManagerIntegration: !!window.ConfigManager,
        errorManagerIntegration: !!window.ErrorManager
    };
    
    // 座標統合設定確認
    const coordinateIntegrationConfig = state.coordinateIntegration || {};
    
    // 診断結果
    const diagnosis = {
        state,
        health,
        integrationTests,
        coordinateIntegrationConfig,
        compliance: {
            coordinateUnified: integrationTests.coordinateManagerAvailable && 
                              coordinateIntegrationConfig.integrationEnabled,
            duplicateEliminated: coordinateIntegrationConfig.duplicateElimination || false,
            boundarySystemIntegrated: integrationTests.boundaryCheckIntegration && 
                                     integrationTests.crossInHandlerIntegration,
            eventSystemIntegrated: integrationTests.eventBusIntegration && 
                                  integrationTests.configManagerIntegration && 
                                  integrationTests.errorManagerIntegration,
            fullFunctionality: Object.values(integrationTests).every(Boolean),
            phase2Ready: !!(integrationTests.coordinateManagerAvailable && 
                           coordinateIntegrationConfig.integrationEnabled &&
                           integrationTests.coordinateValidation &&
                           integrationTests.coordinateTransformation)
        }
    };
    
    console.log('📊 BoundaryManager座標統合診断結果:', diagnosis);
    
    // 詳細統計表示
    const passedTests = Object.values(integrationTests).filter(Boolean).length;
    const totalTests = Object.keys(integrationTests).length;
    const testPassRate = Math.round((passedTests / totalTests) * 100);
    
    console.log(`🧪 統合テスト結果: ${passedTests}/${totalTests} PASS (${testPassRate}%)`);
    console.log('🔧 座標統合健全性:', `${health.overallHealth}%`);
    
    // 個別項目表示
    console.log('📋 統合機能詳細:');
    Object.entries(integrationTests).forEach(([key, value]) => {
        console.log(`  ${value ? '✅' : '❌'} ${key}: ${value ? '正常' : '異常'}`);
    });
    
    // コンプライアンス表示
    console.log('📋 コンプライアンス状況:');
    Object.entries(diagnosis.compliance).forEach(([key, value]) => {
        console.log(`  ${value ? '✅' : '❌'} ${key}: ${value ? '適合' : '不適合'}`);
    });
    
    // 推奨事項
    const recommendations = health.recommendations || [];
    
    // 追加の推奨事項
    if (!integrationTests.coordinateManagerAvailable) {
        recommendations.push('CoordinateManagerの初期化が必要');
    }
    
    if (!integrationTests.canvasElementInitialized) {
        recommendations.push('canvasElementの設定が必要');
    }
    
    if (!diagnosis.compliance.coordinateUnified) {
        recommendations.push('座標統合設定の有効化が必要 (coordinate.integration.managerCentralization)');
    }
    
    if (!diagnosis.compliance.duplicateEliminated) {
        recommendations.push('重複排除設定の有効化を推奨 (coordinate.integration.duplicateElimination)');
    }
    
    if (!diagnosis.compliance.fullFunctionality) {
        const missingFeatures = Object.entries(integrationTests)
            .filter(([key, value]) => !value)
            .map(([key]) => key);
        recommendations.push(`不足機能の実装が必要: ${missingFeatures.join(', ')}`);
    }
    
    if (!diagnosis.compliance.phase2Ready) {
        recommendations.push('Phase2準備設定を確認してください (coordinate.layerTransform.enabled)');
    }
    
    // 総合評価
    const overallScore = Math.round((
        (health.overallHealth / 100 * 25) +
        (testPassRate / 100 * 25) +
        (Object.values(diagnosis.compliance).filter(Boolean).length / Object.keys(diagnosis.compliance).length * 50)
    ));
    
    console.log(`📊 総合評価: ${overallScore}/100点`);
    
    if (overallScore >= 90) {
        console.log('🏆 優秀 - BoundaryManager座標統合が完璧に動作しています');
    } else if (overallScore >= 75) {
        console.log('✅ 良好 - BoundaryManager座標統合が正常に動作しています');
    } else if (overallScore >= 60) {
        console.log('⚠️ 要注意 - BoundaryManager座標統合に一部問題があります');
    } else {
        console.warn('❌ 要修正 - BoundaryManager座標統合に重大な問題があります');
    }
    
    if (recommendations.length > 0) {
        console.warn('💡 BoundaryManager推奨事項:', recommendations);
    } else {
        console.log('✅ BoundaryManager座標統合診断: 全ての要件を満たしています');
    }
    
    console.groupEnd();
    
    return {
        ...diagnosis,
        testPassRate,
        overallScore,
        recommendations,
        timestamp: Date.now()
    };
}
            