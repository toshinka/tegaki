/**
 * 🧪 座標系集中管理強化テスト・動作確認スクリプト
 * 🎯 AI_WORK_SCOPE: 座標統合確認・Phase2準備確認・重複排除確認
 * 🎯 DEPENDENCIES: CoordinateManager, ConfigManager, ErrorManager, EventBus
 * 🔄 COORDINATE_REFACTOR: 座標処理完全集約確認
 * 📐 UNIFIED_COORDINATE: 重複排除・責任分界明確化確認
 * 🎯 PHASE2_READY: レイヤーシステム対応基盤確認
 * 💡 PERFORMANCE: 座標処理パフォーマンス確認
 */

/**
 * 🧪 座標系統合テストマネージャー
 */
class CoordinateIntegrationTester {
    constructor() {
        this.testResults = [];
        this.startTime = 0;
        this.endTime = 0;
        
        console.log('🧪 CoordinateIntegrationTester 初期化');
    }
    
    /**
     * 🔍 Step 5: 動作確認とテスト実行
     */
    async runAllTests() {
        console.group('🧪 === 座標系集中管理強化 完全テスト実行 ===');
        this.startTime = performance.now();
        
        try {
            // Phase 1: 基本システム確認
            await this.testBasicSystems();
            
            // Phase 2: 座標統合確認
            await this.testCoordinateIntegration();
            
            // Phase 3: 重複排除確認
            await this.testDuplicateElimination();
            
            // Phase 4: Phase2準備確認
            await this.testPhase2Readiness();
            
            // Phase 5: パフォーマンス確認
            await this.testPerformance();
            
            // 総合結果
            this.generateFinalReport();
            
        } catch (error) {
            console.error('❌ テスト実行エラー:', error);
        } finally {
            this.endTime = performance.now();
            console.groupEnd();
        }
    }
    
    /**
     * 🔧 Phase 1: 基本システム確認
     */
    async testBasicSystems() {
        console.group('🔧 Phase 1: 基本システム確認');
        
        const tests = [
            {
                name: 'ConfigManager利用可能性',
                test: () => {
                    return window.ConfigManager !== undefined &&
                           typeof window.ConfigManager.get === 'function';
                }
            },
            {
                name: 'CoordinateManager利用可能性',
                test: () => {
                    return window.CoordinateManager !== undefined &&
                           typeof window.CoordinateManager === 'function';
                }
            },
            {
                name: 'ErrorManager統合',
                test: () => {
                    return window.ErrorManager !== undefined &&
                           typeof window.ErrorManager.showError === 'function';
                }
            },
            {
                name: 'EventBus統合',
                test: () => {
                    return window.EventBus !== undefined &&
                           typeof window.EventBus.safeEmit === 'function';
                }
            },
            {
                name: '座標設定取得',
                test: () => {
                    const config = window.ConfigManager.getCoordinateConfig();
                    return config && typeof config === 'object';
                }
            }
        ];
        
        for (const testCase of tests) {
            const result = await this.executeTest(testCase, 'BasicSystem');
            this.testResults.push(result);
        }
        
        console.groupEnd();
    }
    
    /**
     * 📐 Phase 2: 座標統合確認
     */
    async testCoordinateIntegration() {
        console.group('📐 Phase 2: 座標統合確認');
        
        // CoordinateManagerインスタンス生成
        let coordinateManager;
        try {
            coordinateManager = new window.CoordinateManager();
        } catch (error) {
            console.error('❌ CoordinateManager生成失敗:', error);
            console.groupEnd();
            return;
        }
        
        const tests = [
            {
                name: 'CoordinateManager初期化',
                test: () => {
                    return coordinateManager && 
                           coordinateManager.precision !== undefined;
                }
            },
            {
                name: '基本座標変換',
                test: () => {
                    const mockRect = { left: 0, top: 0, width: 400, height: 400 };
                    const result = coordinateManager.screenToCanvas(100, 100, mockRect);
                    return result && 
                           typeof result.x === 'number' && 
                           typeof result.y === 'number';
                }
            },
            {
                name: 'PointerEvent座標抽出',
                test: () => {
                    const mockEvent = { clientX: 150, clientY: 150, pressure: 0.8 };
                    const mockRect = { left: 0, top: 0, width: 400, height: 400 };
                    const result = coordinateManager.extractPointerCoordinates(mockEvent, mockRect);
                    return result && 
                           result.screen && 
                           result.canvas && 
                           result.pressure !== undefined;
                }
            },
            {
                name: '距離計算（旧coordinates.js統合）',
                test: () => {
                    const p1 = { x: 0, y: 0 };
                    const p2 = { x: 3, y: 4 };
                    const distance = coordinateManager.calculateDistance(p1, p2);
                    return Math.abs(distance - 5) < 0.01; // 3-4-5直角三角形
                }
            },
            {
                name: '角度計算（旧coordinates.js統合）',
                test: () => {
                    const p1 = { x: 0, y: 0 };
                    const p2 = { x: 1, y: 0 };
                    const angle = coordinateManager.calculateAngle(p1, p2);
                    return Math.abs(angle - 0) < 0.01; // 0ラジアン（右向き）
                }
            },
            {
                name: '座標補間（旧coordinates.js統合）',
                test: () => {
                    const p1 = { x: 0, y: 0 };
                    const p2 = { x: 10, y: 10 };
                    const points = coordinateManager.interpolatePoints(p1, p2, 2);
                    return points.length === 3 && 
                           points[1].x === 5 && 
                           points[1].y === 5;
                }
            },
            {
                name: '座標妥当性確認',
                test: () => {
                    const validCoord = { x: 100, y: 100 };
                    const invalidCoord = { x: NaN, y: 100 };
                    return coordinateManager.validateCoordinateIntegrity(validCoord) &&
                           !coordinateManager.validateCoordinateIntegrity(invalidCoord);
                }
            }
        ];
        
        for (const testCase of tests) {
            const result = await this.executeTest(testCase, 'CoordinateIntegration');
            this.testResults.push(result);
        }
        
        console.groupEnd();
    }
    
    /**
     * 🗑️ Phase 3: 重複排除確認
     */
    async testDuplicateElimination() {
        console.group('🗑️ Phase 3: 重複排除確認');
        
        const tests = [
            {
                name: 'coordinates.js非推奨警告',
                test: () => {
                    // coordinates.jsが非推奨化されていることを確認
                    if (window.CoordinateUtils && window.CoordinateUtils.distance) {
                        // 非推奨警告が出力されるかテスト
                        const originalWarn = console.warn;
                        let warnCalled = false;
                        console.warn = (...args) => {
                            if (args[0] && args[0].includes('非推奨')) {
                                warnCalled = true;
                            }
                            originalWarn.apply(console, args);
                        };
                        
                        window.CoordinateUtils.distance({ x: 0, y: 0 }, { x: 1, y: 1 });
                        
                        console.warn = originalWarn;
                        return warnCalled;
                    }
                    return true; // coordinates.jsが存在しない場合は成功
                }
            },
            {
                name: '座標統合設定確認',
                test: () => {
                    const managerCentralization = window.ConfigManager.isCoordinateIntegrationEnabled();
                    const duplicateElimination = window.ConfigManager.isDuplicateEliminationEnabled();
                    return managerCentralization && duplicateElimination;
                }
            },
            {
                name: 'migration設定確認',
                test: () => {
                    const migration = window.ConfigManager.get('coordinate.migration');
                    return migration &&
                           migration.removeCoordinatesJs === true &&
                           migration.coordinateUtilsDeprecated === true &&
                           migration.unifyCanvasCoordinates === true;
                }
            },
            {
                name: '統一システム統合テスト',
                test: () => {
                    try {
                        const result = window.testUnifiedSystems();
                        return result && result.allHealthy === true;
                    } catch (error) {
                        return false;
                    }
                }
            }
        ];
        
        for (const testCase of tests) {
            const result = await this.executeTest(testCase, 'DuplicateElimination');
            this.testResults.push(result);
        }
        
        console.groupEnd();
    }
    
    /**
     * 🎯 Phase 4: Phase2準備確認
     */
    async testPhase2Readiness() {
        console.group('🎯 Phase 4: Phase2準備確認');
        
        const coordinateManager = new window.CoordinateManager();
        
        const tests = [
            {
                name: 'レイヤー変形API',
                test: () => {
                    const testCoord = { x: 100, y: 100 };
                    const layerTransform = {
                        translation: { x: 50, y: 50 },
                        rotation: Math.PI / 4,
                        scale: { x: 1.5, y: 1.5 }
                    };
                    const result = coordinateManager.transformCoordinatesForLayer(testCoord, layerTransform);
                    return result && 
                           typeof result.x === 'number' && 
                           typeof result.y === 'number' &&
                           result.x !== testCoord.x && 
                           result.y !== testCoord.y;
                }
            },
            {
                name: 'バッチ座標処理API',
                test: () => {
                    const mockEvents = [
                        { clientX: 10, clientY: 10, pressure: 0.5 },
                        { clientX: 20, clientY: 20, pressure: 0.6 },
                        { clientX: 30, clientY: 30, pressure: 0.7 }
                    ];
                    const mockRect = { left: 0, top: 0, width: 400, height: 400 };
                    const results = coordinateManager.processBatchCoordinates(mockEvents, mockRect);
                    return results && 
                           results.length === 3 && 
                           results[0].canvas && 
                           results[0].pressure !== undefined;
                }
            },
            {
                name: 'Phase2準備設定',
                test: () => {
                    const phase2Status = window.ConfigManager.getPhase2ReadinessStatus();
                    return phase2Status &&
                           phase2Status.layerTransformReady === true &&
                           phase2Status.performanceOptimized === true &&
                           phase2Status.coordinateUnified === true &&
                           phase2Status.duplicateEliminated === true &&
                           phase2Status.overallReadiness >= 0.95;
                }
            },
            {
                name: '座標キャッシュ機能',
                test: () => {
                    const cacheStats = coordinateManager.getCacheStats();
                    return cacheStats && 
                           typeof cacheStats.enabled === 'boolean' &&
                           typeof cacheStats.maxSize === 'number';
                }
            },
            {
                name: 'レイヤー対応設定',
                test: () => {
                    const coordinateConfig = window.ConfigManager.getCoordinateConfig();
                    return coordinateConfig &&
                           coordinateConfig.layerTransform &&
                           coordinateConfig.layerTransform.enabled === true;
                }
            }
        ];
        
        for (const testCase of tests) {
            const result = await this.executeTest(testCase, 'Phase2Readiness');
            this.testResults.push(result);
        }
        
        console.groupEnd();
    }
    
    /**
     * ⚡ Phase 5: パフォーマンス確認
     */
    async testPerformance() {
        console.group('⚡ Phase 5: パフォーマンス確認');
        
        const coordinateManager = new window.CoordinateManager();
        
        const tests = [
            {
                name: '座標変換パフォーマンス（100回）',
                test: () => {
                    const mockRect = { left: 0, top: 0, width: 400, height: 400 };
                    const startTime = performance.now();
                    
                    for (let i = 0; i < 100; i++) {
                        coordinateManager.screenToCanvas(100 + i, 100 + i, mockRect);
                    }
                    
                    const duration = performance.now() - startTime;
                    console.log(`  座標変換100回: ${duration.toFixed(2)}ms`);
                    
                    return duration < 50; // 50ms以下で完了することを期待
                }
            },
            {
                name: 'バッチ処理パフォーマンス',
                test: () => {
                    const mockEvents = Array.from({ length: 50 }, (_, i) => ({
                        clientX: 10 + i,
                        clientY: 10 + i,
                        pressure: 0.5 + (i * 0.01)
                    }));
                    const mockRect = { left: 0, top: 0, width: 400, height: 400 };
                    
                    const startTime = performance.now();
                    const results = coordinateManager.processBatchCoordinates(mockEvents, mockRect);
                    const duration = performance.now() - startTime;
                    
                    console.log(`  バッチ処理50座標: ${duration.toFixed(2)}ms`);
                    
                    return duration < 30 && results.length === 50;
                }
            },
            {
                name: 'キャッシュヒット率',
                test: () => {
                    const mockRect = { left: 0, top: 0, width: 400, height: 400 };
                    
                    // 同じ座標を複数回変換
                    coordinateManager.screenToCanvas(100, 100, mockRect);
                    coordinateManager.screenToCanvas(100, 100, mockRect);
                    coordinateManager.screenToCanvas(100, 100, mockRect);
                    
                    const cacheStats = coordinateManager.getCacheStats();
                    return cacheStats.enabled && cacheStats.size > 0;
                }
            },
            {
                name: 'メモリ使用量確認',
                test: () => {
                    if (!window.performance || !window.performance.memory) {
                        return true; // メモリAPI利用不可の場合は成功とする
                    }
                    
                    const memoryBefore = window.performance.memory.usedJSHeapSize;
                    
                    // 大量座標処理
                    const mockRect = { left: 0, top: 0, width: 400, height: 400 };
                    for (let i = 0; i < 1000; i++) {
                        coordinateManager.screenToCanvas(i % 400, (i * 2) % 400, mockRect);
                    }
                    
                    const memoryAfter = window.performance.memory.usedJSHeapSize;
                    const memoryIncrease = memoryAfter - memoryBefore;
                    
                    console.log(`  メモリ増加: ${(memoryIncrease / 1024).toFixed(2)}KB`);
                    
                    return memoryIncrease < 1024 * 1024; // 1MB以下の増加
                }
            }
        ];
        
        for (const testCase of tests) {
            const result = await this.executeTest(testCase, 'Performance');
            this.testResults.push(result);
        }
        
        console.groupEnd();
    }
    
    /**
     * 🧪 テスト実行ヘルパー
     */
    async executeTest(testCase, category) {
        const startTime = performance.now();
        let passed = false;
        let error = null;
        
        try {
            const result = await testCase.test();
            passed = !!result;
        } catch (e) {
            error = e.message;
        }
        
        const duration = performance.now() - startTime;
        const status = passed ? '✅' : '❌';
        
        console.log(`${status} ${testCase.name}: ${passed ? 'PASS' : 'FAIL'} (${duration.toFixed(2)}ms)${error ? ` - ${error}` : ''}`);
        
        return {
            name: testCase.name,
            category,
            passed,
            duration,
            error
        };
    }
    
    /**
     * 📊 最終レポート生成
     */
    generateFinalReport() {
        const totalDuration = this.endTime - this.startTime;
        const totalTests = this.testResults.length;
        const passedTests = this.testResults.filter(r => r.passed).length;
        const failedTests = totalTests - passedTests;
        
        // カテゴリ別集計
        const categories = {};
        this.testResults.forEach(result => {
            if (!categories[result.category]) {
                categories[result.category] = { total: 0, passed: 0 };
            }
            categories[result.category].total++;
            if (result.passed) categories[result.category].passed++;
        });
        
        console.group('📊 === 座標系集中管理強化 最終レポート ===');
        
        console.log(`⏱️  総実行時間: ${totalDuration.toFixed(2)}ms`);
        console.log(`🧪 総テスト数: ${totalTests}`);
        console.log(`✅ 成功: ${passedTests} (${((passedTests/totalTests)*100).toFixed(1)}%)`);
        console.log(`❌ 失敗: ${failedTests} (${((failedTests/totalTests)*100).toFixed(1)}%)`);
        
        console.log('\n📋 カテゴリ別結果:');
        Object.entries(categories).forEach(([category, stats]) => {
            const percentage = ((stats.passed / stats.total) * 100).toFixed(1);
            const status = stats.passed === stats.total ? '✅' : '⚠️';
            console.log(`  ${status} ${category}: ${stats.passed}/${stats.total} (${percentage}%)`);
        });
        
        // 失敗テスト詳細
        const failedTestDetails = this.testResults.filter(r => !r.passed);
        if (failedTestDetails.length > 0) {
            console.log('\n❌ 失敗テスト詳細:');
            failedTestDetails.forEach(test => {
                console.log(`  - ${test.name}: ${test.error || '原因不明'}`);
            });
        }
        
        // 総合判定
        console.log('\n🎯 総合判定:');
        if (passedTests === totalTests) {
            console.log('🎉 完全成功! 座標系集中管理強化が完了しました。');
            console.log('✅ Phase2レイヤーシステム移行準備完了');
        } else if (passedTests >= totalTests * 0.9) {
            console.log('⚡ ほぼ成功! 軽微な問題がありますが基本機能は動作します。');
            console.log('🔄 失敗項目の修正後にPhase2移行推奨');
        } else if (passedTests >= totalTests * 0.7) {
            console.log('⚠️ 部分成功。重要な問題があります。');
            console.log('🛠️ 失敗項目の修正が必要です。');
        } else {
            console.log('❌ 失敗。座標系統合に重大な問題があります。');
            console.log('🚨 実装を見直してください。');
        }
        
        console.log('\n📐 座標統合確認コマンド:');
        console.log('  - window.testCoordinateIntegration()');
        console.log('  - window.checkCoordinateIntegration()');
        console.log('  - new CoordinateManager().runCoordinateTest()');
        
        console.groupEnd();
        
        return {
            totalTests,
            passedTests,
            failedTests,
            successRate: (passedTests / totalTests) * 100,
            totalDuration,
            categories,
            overallSuccess: passedTests === totalTests
        };
    }
}

// ==========================================
// 🌍 グローバル公開・実行システム
// ==========================================

if (typeof window !== 'undefined') {
    // CoordinateIntegrationTester グローバル公開
    window.CoordinateIntegrationTester = CoordinateIntegrationTester;
    
    /**
     * 🧪 簡単実行用グローバル関数
     */
    window.runCoordinateIntegrationTests = async () => {
        const tester = new CoordinateIntegrationTester();
        return await tester.runAllTests();
    };
    
    /**
     * 🔍 座標統合状態確認
     */
    window.checkCoordinateIntegrationStatus = () => {
        console.group('🔍 座標統合状態確認');
        
        const status = {
            configManager: !!window.ConfigManager,
            coordinateManager: !!window.CoordinateManager,
            errorManager: !!window.ErrorManager,
            eventBus: !!window.EventBus,
            coordinateConfig: null,
            integration: null,
            phase2Ready: false
        };
        
        try {
            if (status.configManager) {
                status.coordinateConfig = window.ConfigManager.getCoordinateConfig();
                status.integration = {
                    managerCentralization: window.ConfigManager.isCoordinateIntegrationEnabled(),
                    duplicateElimination: window.ConfigManager.isDuplicateEliminationEnabled()
                };
                
                const phase2Status = window.ConfigManager.getPhase2ReadinessStatus();
                status.phase2Ready = phase2Status.overallReadiness >= 0.95;
            }
            
            if (status.coordinateManager) {
                const manager = new window.CoordinateManager();
                status.coordinateManagerState = manager.getCoordinateState();
            }
            
        } catch (error) {
            console.error('状態確認エラー:', error);
        }
        
        console.log('📊 座標統合状態:', status);
        
        const recommendations = [];
        if (!status.configManager) recommendations.push('ConfigManagerの初期化が必要');
        if (!status.coordinateManager) recommendations.push('CoordinateManagerの初期化が必要');
        if (!status.integration?.managerCentralization) recommendations.push('座標統合設定の有効化が必要');
        if (!status.integration?.duplicateElimination) recommendations.push('重複排除設定の有効化が必要');
        if (!status.phase2Ready) recommendations.push('Phase2準備設定の確認が必要');
        
        if (recommendations.length > 0) {
            console.warn('⚠️ 推奨事項:', recommendations);
        } else {
            console.log('✅ 座標統合: 全て正常です');
        }
        
        console.groupEnd();
        
        return status;
    };
    
    /**
     * 🚀 自動初期化確認・テスト実行
     */
    setTimeout(async () => {
        console.group('🚀 座標系集中管理強化 自動確認');
        
        try {
            // 基本システム確認
            const status = window.checkCoordinateIntegrationStatus();
            
            // 統合テスト実行推奨確認
            if (status.configManager && status.coordinateManager && 
                status.integration?.managerCentralization && 
                status.integration?.duplicateElimination) {
                
                console.log('🎯 座標統合確認完了 - 統合テスト実行を推奨');
                console.log('💡 実行方法: window.runCoordinateIntegrationTests()');
                
                // 開発環境での自動実行（オプション）
                const isDevelopment = window.location.hostname === 'localhost' || 
                                     window.location.hostname === '127.0.0.1';
                
                if (isDevelopment) {
                    console.log('🧪 開発環境検出 - 自動テスト実行中...');
                    await window.runCoordinateIntegrationTests();
                }
                
            } else {
                console.warn('⚠️ 座標統合未完了 - 設定確認が必要');
            }
            
        } catch (error) {
            console.error('❌ 自動確認エラー:', error);
        }
        
        console.groupEnd();
    }, 1500);
    
    console.log('🧪 CoordinateIntegrationTester グローバル公開完了');
    console.log('💡 使用方法:');
    console.log('  - window.runCoordinateIntegrationTests() - 完全テスト実行');
    console.log('  - window.checkCoordinateIntegrationStatus() - 状態確認');
}

/**
 * 📋 テスト項目まとめ
 * 
 * 🔧 Phase 1: 基本システム確認
 *   - ConfigManager/CoordinateManager/ErrorManager/EventBus利用可能性
 *   - 座標設定取得確認
 * 
 * 📐 Phase 2: 座標統合確認
 *   - CoordinateManager初期化・基本座標変換
 *   - PointerEvent座標抽出
 *   - 距離・角度計算・座標補間（旧coordinates.js統合）
 *   - 座標妥当性確認
 * 
 * 🗑️ Phase 3: 重複排除確認
 *   - coordinates.js非推奨警告
 *   - 座標統合設定確認・migration設定確認
 *   - 統一システム統合確認
 * 
 * 🎯 Phase 4: Phase2準備確認
 *   - レイヤー変形API・バッチ座標処理API
 *   - Phase2準備設定・座標キャッシュ機能
 *   - レイヤー対応設定
 * 
 * ⚡ Phase 5: パフォーマンス確認
 *   - 座標変換パフォーマンス・バッチ処理パフォーマンス
 *   - キャッシュヒット率・メモリ使用量確認
 */

console.log('🧪 座標系集中管理強化テストシステム準備完了');
console.log('🚀 自動実行: 1.5秒後に統合確認開始');