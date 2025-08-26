/**
 * 🧪 Phase1.5統合テスト - 新Manager統合動作確認
 * 📋 RESPONSIBILITY: Phase1.5新Manager統合状況確認・動作テスト・デバッグ情報表示
 * 🚫 PROHIBITION: Manager作成・アプリケーション制御・UI操作
 * ✅ PERMISSION: 統合状況確認・機能テスト・レポート生成・コンソール出力
 * 
 * 📏 DESIGN_PRINCIPLE: テスト専用・非破壊確認・統合状況レポート
 * 🔄 INTEGRATION: 全Manager統合状況確認・Phase1.5機能テスト
 * 🎯 FEATURE: 動作確認・エラー検出・統合レポート・Phase1.5完全対応
 * 🆕 Phase1.5: 新Manager統合テスト・AbstractTool確認・非破壊編集テスト
 */

// Tegaki名前空間初期化
window.Tegaki = window.Tegaki || {};

if (!window.Tegaki.Phase15IntegrationTest) {
    /**
     * Phase15IntegrationTest - Phase1.5統合テスト
     * 新Manager統合状況・動作確認・レポート生成を行う
     */
    class Phase15IntegrationTest {
        constructor() {
            console.log('🧪 Phase1.5統合テスト開始');
            
            this.testResults = {
                timestamp: new Date().toISOString(),
                phase: '1.5',
                success: [],
                warning: [],
                error: [],
                summary: null
            };
            
            this.appInstance = null;
        }
        
        /**
         * 統合テスト実行（メインエントリー）
         */
        async runIntegrationTest() {
            console.log('🚀 Phase1.5統合テスト実行開始...');
            
            try {
                // Step1: 基本依存関係確認
                this.checkBasicDependencies();
                
                // Step2: 新Manager確認
                this.checkPhase15Managers();
                
                // Step3: AbstractTool確認
                this.checkAbstractTool();
                
                // Step4: ツール統合確認
                this.checkToolIntegration();
                
                // Step5: アプリケーション統合確認
                this.checkApplicationIntegration();
                
                // Step6: 機能テスト
                await this.runFunctionalTests();
                
                // Step7: レポート生成
                this.generateReport();
                
                console.log('✅ Phase1.5統合テスト完了');
                return this.testResults;
                
            } catch (error) {
                console.error('❌ Phase1.5統合テスト失敗:', error);
                this.testResults.error.push(`統合テスト実行エラー: ${error.message}`);
                this.generateReport();
                throw error;
            }
        }
        
        /**
         * Step1: 基本依存関係確認
         */
        checkBasicDependencies() {
            console.log('🔍 Step1: 基本依存関係確認...');
            
            // Tegaki名前空間確認
            if (window.Tegaki) {
                this.testResults.success.push('Tegaki名前空間: 利用可能');
            } else {
                this.testResults.error.push('Tegaki名前空間: 未定義');
                return;
            }
            
            // Phase1基本クラス確認
            const phase1Classes = [
                'TegakiApplication',
                'AppCore', 
                'CanvasManager',
                'ToolManager',
                'ErrorManager',
                'ConfigManager',
                'EventBus'
            ];
            
            phase1Classes.forEach(className => {
                if (window.Tegaki[className]) {
                    this.testResults.success.push(`Phase1基本クラス ${className}: 利用可能`);
                } else {
                    this.testResults.error.push(`Phase1基本クラス ${className}: 未定義`);
                }
            });
            
            // PixiJS確認
            if (window.PIXI) {
                this.testResults.success.push('PixiJS: 利用可能');
            } else {
                this.testResults.error.push('PixiJS: 未定義');
            }
        }
        
        /**
         * Step2: Phase1.5新Manager確認
         */
        checkPhase15Managers() {
            console.log('🔍 Step2: Phase1.5新Manager確認...');
            
            const phase15Managers = [
                'CoordinateManager',
                'NavigationManager',
                'RecordManager',
                'ShortcutManager'
            ];
            
            phase15Managers.forEach(managerName => {
                if (window.Tegaki[managerName]) {
                    this.testResults.success.push(`Phase1.5新Manager ${managerName}: 実装済み`);
                    
                    // インスタンス作成テスト
                    try {
                        const instance = new window.Tegaki[managerName]();
                        this.testResults.success.push(`${managerName}: インスタンス作成成功`);
                        
                        // 基本メソッド確認
                        if (typeof instance.getDebugInfo === 'function') {
                            this.testResults.success.push(`${managerName}: デバッグ機能利用可能`);
                        }
                        
                    } catch (error) {
                        this.testResults.error.push(`${managerName}: インスタンス作成失敗 - ${error.message}`);
                    }
                } else {
                    this.testResults.warning.push(`Phase1.5新Manager ${managerName}: 未実装`);
                }
            });
        }
        
        /**
         * Step3: AbstractTool確認
         */
        checkAbstractTool() {
            console.log('🔍 Step3: AbstractTool確認...');
            
            if (window.Tegaki.AbstractTool) {
                this.testResults.success.push('AbstractTool: 実装済み');
                
                // AbstractToolインスタンス作成テスト
                try {
                    // AbstractToolは抽象クラスなので直接インスタンス化はできない
                    // 代わりにクラス構造を確認
                    const AbstractTool = window.Tegaki.AbstractTool;
                    
                    // 必須メソッドの存在確認
                    const requiredMethods = [
                        'setManagers',
                        'setRecordManager',
                        'setCoordinateManager',
                        'onPointerDown',
                        'onPointerMove', 
                        'onPointerUp',
                        'activate',
                        'deactivate',
                        'getState',
                        'getDebugInfo'
                    ];
                    
                    requiredMethods.forEach(methodName => {
                        if (AbstractTool.prototype[methodName]) {
                            this.testResults.success.push(`AbstractTool.${methodName}: 実装済み`);
                        } else {
                            this.testResults.error.push(`AbstractTool.${methodName}: 未実装`);
                        }
                    });
                    
                } catch (error) {
                    this.testResults.error.push(`AbstractTool確認エラー: ${error.message}`);
                }
            } else {
                this.testResults.error.push('AbstractTool: 未実装');
            }
        }
        
        /**
         * Step4: ツール統合確認
         */
        checkToolIntegration() {
            console.log('🔍 Step4: ツール統合確認...');
            
            // PenTool確認
            if (window.Tegaki.PenTool) {
                this.testResults.success.push('PenTool: 実装済み');
                
                try {
                    const penTool = new window.Tegaki.PenTool();
                    
                    // AbstractTool継承確認
                    if (penTool instanceof window.Tegaki.AbstractTool) {
                        this.testResults.success.push('PenTool: AbstractTool継承成功');
                    } else {
                        this.testResults.error.push('PenTool: AbstractTool継承失敗');
                    }
                    
                    // Phase1.5機能テスト
                    if (typeof penTool.testPhase15Features === 'function') {
                        const penTestResults = penTool.testPhase15Features();
                        this.testResults.success.push('PenTool: Phase1.5機能テスト実行可能');
                        
                        // テスト結果をマージ
                        this.testResults.success.push(...penTestResults.success);
                        this.testResults.warning.push(...penTestResults.warning);
                        this.testResults.error.push(...penTestResults.error);
                    }
                    
                } catch (error) {
                    this.testResults.error.push(`PenTool確認エラー: ${error.message}`);
                }
            } else {
                this.testResults.error.push('PenTool: 未実装');
            }
            
            // EraserTool確認
            if (window.Tegaki.EraserTool) {
                this.testResults.success.push('EraserTool: 実装済み');
                
                try {
                    const eraserTool = new window.Tegaki.EraserTool();
                    
                    // AbstractTool継承確認
                    if (eraserTool instanceof window.Tegaki.AbstractTool) {
                        this.testResults.success.push('EraserTool: AbstractTool継承成功');
                    } else {
                        this.testResults.error.push('EraserTool: AbstractTool継承失敗');
                    }
                    
                    // Phase1.5機能テスト
                    if (typeof eraserTool.testPhase15Features === 'function') {
                        const eraserTestResults = eraserTool.testPhase15Features();
                        this.testResults.success.push('EraserTool: Phase1.5機能テスト実行可能');
                        
                        // テスト結果をマージ
                        this.testResults.success.push(...eraserTestResults.success);
                        this.testResults.warning.push(...eraserTestResults.warning);
                        this.testResults.error.push(...eraserTestResults.error);
                    }
                    
                } catch (error) {
                    this.testResults.error.push(`EraserTool確認エラー: ${error.message}`);
                }
            } else {
                this.testResults.error.push('EraserTool: 未実装');
            }
        }
        
        /**
         * Step5: アプリケーション統合確認
         */
        checkApplicationIntegration() {
            console.log('🔍 Step5: アプリケーション統合確認...');
            
            // TegakiApplicationインスタンス確認
            if (window.TegakiAppInstance) {
                this.appInstance = window.TegakiAppInstance;
                this.testResults.success.push('TegakiApplication: インスタンス利用可能');
                
                // Phase1.5統合状況確認
                if (typeof this.appInstance.checkPhase15Integration === 'function') {
                    const integrationResults = this.appInstance.checkPhase15Integration();
                    this.testResults.success.push('TegakiApplication: Phase1.5統合確認実行可能');
                    
                    // 統合結果をマージ
                    this.testResults.success.push(...integrationResults.success);
                    this.testResults.warning.push(...integrationResults.warning);  
                    this.testResults.error.push(...integrationResults.error);
                }
                
                // Phase1.5デバッグ情報確認
                if (typeof this.appInstance.getPhase15DebugInfo === 'function') {
                    const debugInfo = this.appInstance.getPhase15DebugInfo();
                    this.testResults.success.push('TegakiApplication: Phase1.5デバッグ情報取得可能');
                    
                    // Manager統合状況確認
                    if (debugInfo.managers) {
                        Object.entries(debugInfo.managers).forEach(([managerName, isAvailable]) => {
                            if (isAvailable) {
                                this.testResults.success.push(`TegakiApplication: ${managerName}統合済み`);
                            } else {
                                this.testResults.warning.push(`TegakiApplication: ${managerName}未統合`);
                            }
                        });
                    }
                }
                
            } else {
                this.testResults.warning.push('TegakiApplication: インスタンス未作成（まだ初期化されていない可能性）');
            }
        }
        
        /**
         * Step6: 機能テスト実行
         */
        async runFunctionalTests() {
            console.log('🔍 Step6: 機能テスト実行...');
            
            // 座標変換テスト
            this.testCoordinateTransform();
            
            // 非破壊編集テスト  
            this.testNonDestructiveEdit();
            
            // ショートカットテスト
            this.testShortcuts();
            
            // ナビゲーションテスト
            this.testNavigation();
        }
        
        /**
         * 座標変換テスト
         */
        testCoordinateTransform() {
            if (window.Tegaki.CoordinateManager) {
                try {
                    const coordManager = new window.Tegaki.CoordinateManager();
                    
                    // Canvas要素がない状態での基本テスト
                    const testResult = coordManager.screenToCanvas(100, 100);
                    if (testResult && typeof testResult === 'object') {
                        this.testResults.success.push('CoordinateManager: 座標変換機能正常');
                    } else {
                        this.testResults.warning.push('CoordinateManager: 座標変換テスト要Canvas設定');
                    }
                } catch (error) {
                    this.testResults.error.push(`CoordinateManager機能テストエラー: ${error.message}`);
                }
            } else {
                this.testResults.warning.push('CoordinateManager: 未実装のため座標変換テストスキップ');
            }
        }
        
        /**
         * 非破壊編集テスト
         */
        testNonDestructiveEdit() {
            if (window.Tegaki.RecordManager) {
                try {
                    const recordManager = new window.Tegaki.RecordManager();
                    
                    // 基本操作テスト
                    if (typeof recordManager.canUndo === 'function' && 
                        typeof recordManager.canRedo === 'function') {
                        this.testResults.success.push('RecordManager: Undo/Redo機能利用可能');
                        
                        // 初期状態確認
                        if (!recordManager.canUndo() && !recordManager.canRedo()) {
                            this.testResults.success.push('RecordManager: 初期状態正常');
                        }
                    }
                } catch (error) {
                    this.testResults.error.push(`RecordManager機能テストエラー: ${error.message}`);
                }
            } else {
                this.testResults.warning.push('RecordManager: 未実装のため非破壊編集テストスキップ');
            }
        }
        
        /**
         * ショートカットテスト
         */
        testShortcuts() {
            if (window.Tegaki.ShortcutManager) {
                try {
                    const shortcutManager = new window.Tegaki.ShortcutManager();
                    
                    // 基本機能確認
                    if (typeof shortcutManager.registerShortcut === 'function') {
                        this.testResults.success.push('ShortcutManager: ショートカット登録機能利用可能');
                    }
                    
                    if (typeof shortcutManager.handleKeydown === 'function') {
                        this.testResults.success.push('ShortcutManager: キーボードイベント処理機能利用可能');
                    }
                } catch (error) {
                    this.testResults.error.push(`ShortcutManager機能テストエラー: ${error.message}`);
                }
            } else {
                this.testResults.warning.push('ShortcutManager: 未実装のためショートカットテストスキップ');
            }
        }
        
        /**
         * ナビゲーションテスト
         */
        testNavigation() {
            if (window.Tegaki.NavigationManager) {
                try {
                    const navManager = new window.Tegaki.NavigationManager();
                    
                    // 基本機能確認
                    if (typeof navManager.panCanvas === 'function') {
                        this.testResults.success.push('NavigationManager: パン機能利用可能');
                    }
                    
                    if (typeof navManager.zoomCanvas === 'function') {
                        this.testResults.success.push('NavigationManager: ズーム機能利用可能');
                    }
                } catch (error) {
                    this.testResults.error.push(`NavigationManager機能テストエラー: ${error.message}`);
                }
            } else {
                this.testResults.warning.push('NavigationManager: 未実装のためナビゲーションテストスキップ');
            }
        }
        
        /**
         * Step7: レポート生成
         */
        generateReport() {
            console.log('📊 Step7: レポート生成...');
            
            // 統計計算
            const totalTests = this.testResults.success.length + 
                               this.testResults.warning.length + 
                               this.testResults.error.length;
            
            const successRate = totalTests > 0 ? 
                Math.round((this.testResults.success.length / totalTests) * 100) : 0;
            
            this.testResults.summary = {
                totalTests,
                successCount: this.testResults.success.length,
                warningCount: this.testResults.warning.length,
                errorCount: this.testResults.error.length,
                successRate: successRate + '%',
                status: this.testResults.error.length === 0 ? 
                    (this.testResults.warning.length === 0 ? 'PASS' : 'PASS_WITH_WARNINGS') : 'FAIL'
            };
            
            // コンソール出力
            console.log('\n🧪 ===== Phase1.5統合テスト結果 =====');
            console.log(`📊 総テスト数: ${totalTests}`);
            console.log(`✅ 成功: ${this.testResults.success.length}`);
            console.log(`⚠️ 警告: ${this.testResults.warning.length}`);
            console.log(`❌ エラー: ${this.testResults.error.length}`);
            console.log(`📈 成功率: ${successRate}%`);
            console.log(`🎯 総合判定: ${this.testResults.summary.status}`);
            
            // 詳細出力
            if (this.testResults.success.length > 0) {
                console.log('\n✅ 成功項目:');
                this.testResults.success.forEach(item => console.log(`  ✓ ${item}`));
            }
            
            if (this.testResults.warning.length > 0) {
                console.log('\n⚠️ 警告項目:');
                this.testResults.warning.forEach(item => console.log(`  ⚠ ${item}`));
            }
            
            if (this.testResults.error.length > 0) {
                console.log('\n❌ エラー項目:');
                this.testResults.error.forEach(item => console.log(`  ✗ ${item}`));
            }
            
            console.log('\n🧪 ===== Phase1.5統合テスト完了 =====\n');
            
            // Phase1.5実装推奨順序の表示
            this.showImplementationGuidance();
        }
        
        /**
         * Phase1.5実装推奨順序表示
         */
        showImplementationGuidance() {
            console.log('🎯 ===== Phase1.5実装推奨順序 =====');
            console.log('Step1: CoordinateManager実装（座標系統一の基盤）');
            console.log('Step2: RecordManager実装（非破壊編集の基盤）');
            console.log('Step3: NavigationManager実装（パン・ズーム機能）');
            console.log('Step4: ShortcutManager実装（キーボード操作）');
            console.log('Step5: 既存ツール修正（AbstractTool継承対応）');
            console.log('Step6: 統合テスト・動作確認・バグ修正');
            console.log('🎯 ================================\n');
        }
        
        /**
         * テスト結果取得
         */
        getResults() {
            return { ...this.testResults };
        }
        
        /**
         * HTML形式レポート生成
         */
        generateHtmlReport() {
            const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Phase1.5統合テスト結果</title>
    <style>
        body { font-family: monospace; margin: 20px; background: #f5f5f5; }
        .header { background: #2c3e50; color: white; padding: 20px; border-radius: 5px; }
        .summary { background: white; padding: 20px; margin: 10px 0; border-radius: 5px; border-left: 5px solid #3498db; }
        .success { color: #27ae60; }
        .warning { color: #f39c12; }
        .error { color: #e74c3c; }
        .section { background: white; margin: 10px 0; padding: 15px; border-radius: 5px; }
        ul { list-style: none; padding: 0; }
        li { padding: 5px 0; }
        .status { font-size: 24px; font-weight: bold; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🧪 Phase1.5統合テスト結果</h1>
        <p>実行時刻: ${this.testResults.timestamp}</p>
        <p class="status">総合判定: ${this.testResults.summary?.status || 'UNKNOWN'}</p>
    </div>
    
    <div class="summary">
        <h2>📊 テスト概要</h2>
        <p>総テスト数: ${this.testResults.summary?.totalTests || 0}</p>
        <p class="success">✅ 成功: ${this.testResults.success.length}</p>
        <p class="warning">⚠️ 警告: ${this.testResults.warning.length}</p>  
        <p class="error">❌ エラー: ${this.testResults.error.length}</p>
        <p>成功率: ${this.testResults.summary?.successRate || '0%'}</p>
    </div>
    
    <div class="section">
        <h2 class="success">✅ 成功項目</h2>
        <ul>
            ${this.testResults.success.map(item => `<li class="success">✓ ${item}</li>`).join('')}
        </ul>
    </div>
    
    <div class="section">
        <h2 class="warning">⚠️ 警告項目</h2>
        <ul>
            ${this.testResults.warning.map(item => `<li class="warning">⚠ ${item}</li>`).join('')}
        </ul>
    </div>
    
    <div class="section">
        <h2 class="error">❌ エラー項目</h2>
        <ul>
            ${this.testResults.error.map(item => `<li class="error">✗ ${item}</li>`).join('')}
        </ul>
    </div>
    
    <div class="section">
        <h2>🎯 実装推奨順序</h2>
        <ol>
            <li>CoordinateManager実装（座標系統一の基盤）</li>
            <li>RecordManager実装（非破壊編集の基盤）</li>
            <li>NavigationManager実装（パン・ズーム機能）</li>
            <li>ShortcutManager実装（キーボード操作）</li>
            <li>既存ツール修正（AbstractTool継承対応）</li>
            <li>統合テスト・動作確認・バグ修正</li>
        </ol>
    </div>
</body>
</html>
            `;
            
            return html;
        }
    }
    
    // Tegaki名前空間に登録
    window.Tegaki.Phase15IntegrationTest = Phase15IntegrationTest;
    
    // 自動実行用ヘルパー関数
    window.Tegaki.runPhase15Test = async function() {
        const tester = new window.Tegaki.Phase15IntegrationTest();
        return await tester.runIntegrationTest();
    };
}

console.log('🧪 Phase1.5統合テスト Loaded');
console.log('📏 新Manager統合状況確認・機能テスト・レポート生成・Phase1.5完全対応');
console.log('🔄 使用方法: window.Tegaki.runPhase15Test() でテスト実行');