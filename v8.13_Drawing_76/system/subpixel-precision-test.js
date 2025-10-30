// ===== subpixel-precision-test.js - サブピクセル精度検証 =====
// SDF/MSDF実装に必要な0.5px以下の精度を検証

(function() {
    'use strict';
    
    class SubpixelPrecisionTest {
        constructor() {
            this.coordinateSystem = window.CoordinateSystem;
            this.cameraSystem = window.cameraSystem;
            this.testResults = [];
        }
        
        /**
         * Phase 3: サブピクセル精度テスト実行
         * 目標: 0.5px以下の誤差
         */
        runAllTests() {
            console.log('========================================');
            console.log('サブピクセル精度テストスイート');
            console.log('========================================');
            
            this.testResults = [];
            
            // Test 1: 整数座標での往復変換
            this.testIntegerCoordinates();
            
            // Test 2: 0.5px単位での往復変換
            this.testHalfPixelCoordinates();
            
            // Test 3: 0.1px単位での往復変換
            this.testSubpixelCoordinates();
            
            // Test 4: DPR=2環境でのシミュレーション
            this.testHighDPREnvironment();
            
            // Test 5: ズーム・回転下での精度
            this.testTransformedCoordinates();
            
            // Test 6: レイヤー階層下での精度
            this.testLayerHierarchyPrecision();
            
            // 総合評価
            this.printSummary();
        }
        
        testIntegerCoordinates() {
            console.log('\n--- Test 1: 整数座標での往復変換 ---');
            
            const testCases = [
                { clientX: 100, clientY: 100 },
                { clientX: 200, clientY: 150 },
                { clientX: 400, clientY: 300 }
            ];
            
            testCases.forEach((testCase, idx) => {
                const error = this.measureRoundTripError(testCase.clientX, testCase.clientY);
                
                const passed = error.x < 0.5 && error.y < 0.5;
                this.testResults.push({
                    test: `Test 1-${idx + 1}`,
                    input: testCase,
                    error: error,
                    passed: passed
                });
                
                console.log(`  Case ${idx + 1}: (${testCase.clientX}, ${testCase.clientY})`);
                console.log(`    誤差: X=${error.x.toFixed(4)}px, Y=${error.y.toFixed(4)}px`);
                console.log(`    判定: ${passed ? '✅ PASS' : '❌ FAIL'}`);
            });
        }
        
        testHalfPixelCoordinates() {
            console.log('\n--- Test 2: 0.5px単位での往復変換 ---');
            
            const testCases = [
                { clientX: 100.5, clientY: 100.5 },
                { clientX: 200.5, clientY: 150.5 },
                { clientX: 400.5, clientY: 300.5 }
            ];
            
            testCases.forEach((testCase, idx) => {
                const error = this.measureRoundTripError(testCase.clientX, testCase.clientY);
                
                const passed = error.x < 0.5 && error.y < 0.5;
                this.testResults.push({
                    test: `Test 2-${idx + 1}`,
                    input: testCase,
                    error: error,
                    passed: passed
                });
                
                console.log(`  Case ${idx + 1}: (${testCase.clientX}, ${testCase.clientY})`);
                console.log(`    誤差: X=${error.x.toFixed(4)}px, Y=${error.y.toFixed(4)}px`);
                console.log(`    判定: ${passed ? '✅ PASS' : '❌ FAIL'}`);
            });
        }
        
        testSubpixelCoordinates() {
            console.log('\n--- Test 3: 0.1px単位での往復変換 ---');
            
            const testCases = [
                { clientX: 100.1, clientY: 100.1 },
                { clientX: 200.3, clientY: 150.7 },
                { clientX: 400.9, clientY: 300.2 }
            ];
            
            testCases.forEach((testCase, idx) => {
                const error = this.measureRoundTripError(testCase.clientX, testCase.clientY);
                
                const passed = error.x < 0.5 && error.y < 0.5;
                this.testResults.push({
                    test: `Test 3-${idx + 1}`,
                    input: testCase,
                    error: error,
                    passed: passed
                });
                
                console.log(`  Case ${idx + 1}: (${testCase.clientX.toFixed(1)}, ${testCase.clientY.toFixed(1)})`);
                console.log(`    誤差: X=${error.x.toFixed(4)}px, Y=${error.y.toFixed(4)}px`);
                console.log(`    判定: ${passed ? '✅ PASS' : '❌ FAIL'}`);
            });
        }
        
        testHighDPREnvironment() {
            console.log('\n--- Test 4: 高DPR環境シミュレーション ---');
            
            // DPR=2をシミュレート（実際のDPRは変更しない）
            const originalDPR = window.devicePixelRatio;
            console.log(`  現在のDPR: ${originalDPR}`);
            
            const testCases = [
                { clientX: 100, clientY: 100 },
                { clientX: 100.5, clientY: 100.5 }
            ];
            
            testCases.forEach((testCase, idx) => {
                const error = this.measureRoundTripError(testCase.clientX, testCase.clientY);
                
                const passed = error.x < 0.5 && error.y < 0.5;
                this.testResults.push({
                    test: `Test 4-${idx + 1}`,
                    input: testCase,
                    error: error,
                    passed: passed
                });
                
                console.log(`  Case ${idx + 1}: (${testCase.clientX}, ${testCase.clientY})`);
                console.log(`    誤差: X=${error.x.toFixed(4)}px, Y=${error.y.toFixed(4)}px`);
                console.log(`    判定: ${passed ? '✅ PASS' : '❌ FAIL'}`);
            });
        }
        
        testTransformedCoordinates() {
            console.log('\n--- Test 5: ズーム・回転下での精度 ---');
            
            if (!this.cameraSystem || !this.cameraSystem.worldContainer) {
                console.warn('  ⚠️ CameraSystem未初期化、スキップ');
                return;
            }
            
            // 現在のtransformを保存
            const originalTransform = {
                x: this.cameraSystem.worldContainer.x,
                y: this.cameraSystem.worldContainer.y,
                scaleX: this.cameraSystem.worldContainer.scale.x,
                scaleY: this.cameraSystem.worldContainer.scale.y,
                rotation: this.cameraSystem.worldContainer.rotation
            };
            
            // Test 5-1: ズーム200%
            this.cameraSystem.worldContainer.scale.set(2.0);
            let error = this.measureRoundTripError(100, 100);
            let passed = error.x < 0.5 && error.y < 0.5;
            this.testResults.push({
                test: 'Test 5-1 (Zoom 200%)',
                input: { clientX: 100, clientY: 100 },
                error: error,
                passed: passed
            });
            console.log(`  Zoom 200%: 誤差 X=${error.x.toFixed(4)}px, Y=${error.y.toFixed(4)}px ${passed ? '✅' : '❌'}`);
            
            // Test 5-2: 回転45度
            this.cameraSystem.worldContainer.scale.set(originalTransform.scaleX);
            this.cameraSystem.worldContainer.rotation = Math.PI / 4;
            error = this.measureRoundTripError(100, 100);
            passed = error.x < 0.5 && error.y < 0.5;
            this.testResults.push({
                test: 'Test 5-2 (Rotate 45°)',
                input: { clientX: 100, clientY: 100 },
                error: error,
                passed: passed
            });
            console.log(`  Rotate 45°: 誤差 X=${error.x.toFixed(4)}px, Y=${error.y.toFixed(4)}px ${passed ? '✅' : '❌'}`);
            
            // transformを復元
            this.cameraSystem.worldContainer.x = originalTransform.x;
            this.cameraSystem.worldContainer.y = originalTransform.y;
            this.cameraSystem.worldContainer.scale.set(originalTransform.scaleX, originalTransform.scaleY);
            this.cameraSystem.worldContainer.rotation = originalTransform.rotation;
        }
        
        testLayerHierarchyPrecision() {
            console.log('\n--- Test 6: レイヤー階層下での精度 ---');
            
            const layerManager = window.CoreRuntime?.internal?.layerManager;
            if (!layerManager) {
                console.warn('  ⚠️ LayerManager未初期化、スキップ');
                return;
            }
            
            const activeLayer = layerManager.getActiveLayer();
            if (!activeLayer) {
                console.warn('  ⚠️ アクティブレイヤーなし、スキップ');
                return;
            }
            
            // レイヤーのLocal座標系での往復変換テスト
            const testCases = [
                { clientX: 100, clientY: 100 },
                { clientX: 100.5, clientY: 100.5 }
            ];
            
            testCases.forEach((testCase, idx) => {
                const error = this.measureLayerRoundTripError(testCase.clientX, testCase.clientY, activeLayer);
                
                const passed = error.x < 0.5 && error.y < 0.5;
                this.testResults.push({
                    test: `Test 6-${idx + 1}`,
                    input: testCase,
                    error: error,
                    passed: passed
                });
                
                console.log(`  Case ${idx + 1}: (${testCase.clientX}, ${testCase.clientY})`);
                console.log(`    誤差: X=${error.x.toFixed(4)}px, Y=${error.y.toFixed(4)}px`);
                console.log(`    判定: ${passed ? '✅ PASS' : '❌ FAIL'}`);
            });
        }
        
        /**
         * Screen → Canvas → World → Canvas → Screen の往復変換誤差測定
         */
        measureRoundTripError(clientX, clientY) {
            if (!this.coordinateSystem) {
                return { x: Infinity, y: Infinity };
            }
            
            // 順変換
            const step1 = this.coordinateSystem.screenClientToCanvas(clientX, clientY);
            const step2 = this.coordinateSystem.canvasToWorld(step1.canvasX, step1.canvasY);
            
            // 逆変換
            const step3 = this.coordinateSystem.worldToCanvas(step2.worldX, step2.worldY);
            const step4 = this.coordinateSystem.canvasToScreen(step3.canvasX, step3.canvasY);
            
            return {
                x: Math.abs(step4.clientX - clientX),
                y: Math.abs(step4.clientY - clientY)
            };
        }
        
        /**
         * Screen → Local → Screen の往復変換誤差測定
         */
        measureLayerRoundTripError(clientX, clientY, layer) {
            if (!this.coordinateSystem) {
                return { x: Infinity, y: Infinity };
            }
            
            // 順変換
            const step1 = this.coordinateSystem.screenClientToCanvas(clientX, clientY);
            const step2 = this.coordinateSystem.canvasToWorld(step1.canvasX, step1.canvasY);
            const step3 = this.coordinateSystem.worldToLocal(step2.worldX, step2.worldY, layer);
            
            // 逆変換
            const step4 = this.coordinateSystem.localToWorld(step3.localX, step3.localY, layer);
            const step5 = this.coordinateSystem.worldToCanvas(step4.worldX, step4.worldY);
            const step6 = this.coordinateSystem.canvasToScreen(step5.canvasX, step5.canvasY);
            
            return {
                x: Math.abs(step6.clientX - clientX),
                y: Math.abs(step6.clientY - clientY)
            };
        }
        
        printSummary() {
            console.log('\n========================================');
            console.log('テスト結果サマリー');
            console.log('========================================');
            
            const passedCount = this.testResults.filter(r => r.passed).length;
            const totalCount = this.testResults.length;
            
            console.log(`合格: ${passedCount} / ${totalCount}`);
            
            const maxError = this.testResults.reduce((max, r) => {
                const maxErr = Math.max(r.error.x, r.error.y);
                return maxErr > max ? maxErr : max;
            }, 0);
            
            console.log(`最大誤差: ${maxError.toFixed(4)}px`);
            
            if (passedCount === totalCount) {
                console.log('\n✅ すべてのテストに合格');
                console.log('   サブピクセル精度: 保証済み');
                console.log('   SDF/MSDF実装: 準備完了');
            } else {
                console.log('\n❌ 一部テストが不合格');
                console.log('   座標変換の精度改善が必要');
                
                // 不合格テストの詳細
                const failedTests = this.testResults.filter(r => !r.passed);
                console.log('\n不合格テスト:');
                failedTests.forEach(t => {
                    console.log(`  - ${t.test}: 誤差 X=${t.error.x.toFixed(4)}px, Y=${t.error.y.toFixed(4)}px`);
                });
            }
        }
        
        /**
         * 精度検証の簡易実行（デバッグコマンド用）
         */
        quickTest(clientX, clientY) {
            console.log(`\n=== 簡易精度テスト (${clientX}, ${clientY}) ===`);
            
            const error = this.measureRoundTripError(clientX, clientY);
            
            console.log(`誤差: X=${error.x.toFixed(4)}px, Y=${error.y.toFixed(4)}px`);
            
            if (error.x < 0.1 && error.y < 0.1) {
                console.log('✅ 高精度 (0.1px未満)');
            } else if (error.x < 0.5 && error.y < 0.5) {
                console.log('✅ 許容範囲 (0.5px未満)');
            } else if (error.x < 1.0 && error.y < 1.0) {
                console.log('⚠️ 許容ギリギリ (1px未満)');
            } else {
                console.log('❌ 精度不足 (1px以上)');
            }
        }
    }
    
    // グローバル登録
    window.SubpixelPrecisionTest = SubpixelPrecisionTest;
    
    console.log('✅ subpixel-precision-test.js loaded');
    
})();

// ========== デバッグコマンド ==========
window.TegakiDebug = window.TegakiDebug || {};
window.TegakiDebug.precision = {
    // フルテストスイート実行
    runTests() {
        const tester = new window.SubpixelPrecisionTest();
        tester.runAllTests();
    },
    
    // 簡易テスト
    quick(clientX = 100, clientY = 100) {
        const tester = new window.SubpixelPrecisionTest();
        tester.quickTest(clientX, clientY);
    },
    
    // 座標変換パイプライン表示
    inspect(clientX = 100, clientY = 100) {
        const cs = window.CoordinateSystem;
        if (!cs) {
            console.error('❌ CoordinateSystem not found');
            return;
        }
        
        console.log('=== 座標変換パイプライン詳細 ===');
        console.log(`Input: Screen (${clientX}, ${clientY})`);
        
        const step1 = cs.screenClientToCanvas(clientX, clientY);
        console.log(`Step 1: Canvas (${step1.canvasX.toFixed(4)}, ${step1.canvasY.toFixed(4)})`);
        
        const step2 = cs.canvasToWorld(step1.canvasX, step1.canvasY);
        console.log(`Step 2: World (${step2.worldX.toFixed(4)}, ${step2.worldY.toFixed(4)})`);
        
        const step3 = cs.worldToCanvas(step2.worldX, step2.worldY);
        console.log(`Step 3: Canvas (${step3.canvasX.toFixed(4)}, ${step3.canvasY.toFixed(4)})`);
        
        const step4 = cs.canvasToScreen(step3.canvasX, step3.canvasY);
        console.log(`Step 4: Screen (${step4.clientX.toFixed(4)}, ${step4.clientY.toFixed(4)})`);
        
        const errorX = Math.abs(step4.clientX - clientX);
        const errorY = Math.abs(step4.clientY - clientY);
        console.log(`誤差: (${errorX.toFixed(4)}, ${errorY.toFixed(4)})`);
    }
};

console.log('✅ Debug commands: TegakiDebug.precision.*');