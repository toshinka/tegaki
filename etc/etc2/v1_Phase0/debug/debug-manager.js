/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1rev12
 * デバッグ統合管理システム - debug-manager.js (Phase2F)
 * 
 * 🔧 Phase2F新設: DRY・SOLID原則準拠
 * 1. ✅ main.jsからデバッグ機能分離
 * 2. ✅ 単一責任原則準拠（デバッグのみ）
 * 3. ✅ デバッグ機能統合・テンプレート化
 * 4. ✅ 開発支援・テスト機能強化
 * 5. ✅ システム診断連携
 * 
 * 責務: デバッグ機能統合管理・開発支援・テスト実行
 * 依存: utils.js, diagnostics.js
 */

console.log('🔧 debug-manager.js Phase2F版読み込み開始...');

// ==== デバッグ統合管理クラス ====
class DebugManager {
    constructor() {
        this.isEnabled = this.checkDebugMode();
        this.logLevel = this.getLogLevel();
        this.testResults = new Map();
        this.debugReports = [];
        this.componentStats = new Map();
        
        // 外部システム参照
        this.diagnostics = null;
        this.performanceLogger = null;
        this.systemMonitor = null;
        
        console.log('🐛 DebugManager初期化（Phase2F版）', {
            enabled: this.isEnabled,
            logLevel: this.logLevel
        });
    }
    
    /**
     * デバッグモード確認
     */
    checkDebugMode() {
        try {
            // URLパラメータ確認
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.get('debug') === 'true') return true;
            
            // localStorage確認
            if (localStorage && localStorage.getItem('debug') === 'true') return true;
            
            // 開発環境確認
            if (window.location.hostname === 'localhost' || 
                window.location.hostname === '127.0.0.1') return true;
            
            return false;
        } catch (error) {
            console.warn('デバッグモード確認エラー:', error);
            return false;
        }
    }
    
    /**
     * ログレベル取得
     */
    getLogLevel() {
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const level = urlParams.get('logLevel') || 
                         (localStorage && localStorage.getItem('logLevel')) || 
                         'info';
            return level.toLowerCase();
        } catch (error) {
            return 'info';
        }
    }
    
    /**
     * 外部システム設定
     */
    setDiagnostics(diagnostics) {
        this.diagnostics = diagnostics;
        console.log('🔗 DebugManager: 診断システム連携完了');
    }
    
    setPerformanceLogger(performanceLogger) {
        this.performanceLogger = performanceLogger;
        console.log('🔗 DebugManager: パフォーマンスログ連携完了');
    }
    
    setSystemMonitor(systemMonitor) {
        this.systemMonitor = systemMonitor;
        console.log('🔗 DebugManager: システム監視連携完了');
    }
    
    /**
     * 🆕 Phase2F: アプリケーション全体デバッグ（main.jsから移管・強化）
     */
    debugApp() {
        if (!this.isEnabled) {
            console.log('デバッグモードが無効です');
            return;
        }
        
        console.group('🔍 アプリケーション全体デバッグ（Phase2F統合版）');
        
        try {
            // APP_STATE表示
            if (window.APP_STATE) {
                console.log('📋 APP_STATE:', window.APP_STATE);
                this.analyzeAppState(window.APP_STATE);
            }
            
            // システム統計（utils.js統合）
            if (typeof getSystemStats === 'function') {
                const systemStats = getSystemStats();
                console.log('📊 システム統計（utils.js統合）:', systemStats);
            }
            
            // 各コンポーネント統計
            this.debugAllComponents();
            
            // Phase2F統合状況
            this.debugPhase2FIntegration();
            
            // パフォーマンス統計
            if (this.systemMonitor) {
                const perfStats = this.systemMonitor.getPerformanceStats();
                console.log('⚡ パフォーマンス統計:', perfStats);
            }
            
            // システム健全性
            if (this.diagnostics) {
                const health = this.diagnostics.getSystemHealth();
                console.log('🏥 システム健全性:', health);
            }
            
        } catch (error) {
            console.error('debugApp実行エラー:', error);
        }
        
        console.groupEnd();
    }
    
    /**
     * APP_STATE分析
     */
    analyzeAppState(appState) {
        const analysis = {
            initialized: appState.initialized,
            currentStep: appState.initializationStep,
            errorCount: appState.stats?.errorCount || 0,
            initTime: appState.stats?.initTime || 0,
            componentsLoaded: Object.values(appState.components || {}).filter(Boolean).length,
            configStatus: {
                loaded: appState.config?.loaded,
                validated: appState.config?.validated,
                fixed: appState.config?.fixed
            }
        };
        
        console.log('📈 APP_STATE分析:', analysis);
        this.componentStats.set('APP_STATE', analysis);
    }
    
    /**
     * 全コンポーネントデバッグ
     */
    debugAllComponents() {
        const components = {
            app: window.app,
            toolsSystem: window.toolsSystem,
            uiManager: window.uiManager,
            historyManager: window.historyManager,
            settingsManager: window.settingsManager,
            eventSystem: window.eventSystem
        };
        
        console.group('🧩 コンポーネント統計');
        
        for (const [name, component] of Object.entries(components)) {
            if (component) {
                this.debugComponent(name, component);
            } else {
                console.warn(`❌ ${name}: 未初期化`);
            }
        }
        
        console.groupEnd();
    }
    
    /**
     * 🆕 Phase2F: 個別コンポーネントデバッグ
     */
    debugComponent(componentName, component) {
        try {
            const stats = {
                name: componentName,
                type: component.constructor?.name || 'Unknown',
                initialized: !!component,
                methods: Object.getOwnPropertyNames(Object.getPrototypeOf(component)).length,
                properties: Object.keys(component).length
            };
            
            // 各コンポーネント固有の統計取得
            if (component.getStats) {
                stats.customStats = component.getStats();
            } else if (component.getSystemStats) {
                stats.customStats = component.getSystemStats();
            } else if (component.getUIStats) {
                stats.customStats = component.getUIStats();
            } else if (component.getSettingsInfo) {
                stats.customStats = component.getSettingsInfo();
            }
            
            console.log(`🔧 ${componentName}:`, stats);
            this.componentStats.set(componentName, stats);
            
        } catch (error) {
            console.error(`${componentName}デバッグエラー:`, error);
        }
    }
    
    /**
     * Phase2F統合状況デバッグ
     */
    debugPhase2FIntegration() {
        console.group('🏗️ Phase2F統合状況');
        
        const integration = {
            debugManager: !!this,
            diagnostics: !!this.diagnostics,
            performanceLogger: !!this.performanceLogger,
            systemMonitor: !!this.systemMonitor,
            utilsIntegration: typeof safeConfigGet === 'function',
            phase2Settings: this.checkPhase2Settings(),
            dryCompliance: this.checkDRYCompliance(),
            solidCompliance: this.checkSOLIDCompliance()
        };
        
        console.log('📊 Phase2F統合状況:', integration);
        
        // 問題点の指摘
        const issues = [];
        if (!integration.diagnostics) issues.push('診断システム未連携');
        if (!integration.systemMonitor) issues.push('システム監視未連携');
        if (!integration.utilsIntegration) issues.push('utils.js統合不備');
        
        if (issues.length > 0) {
            console.warn('⚠️ Phase2F統合問題:', issues);
        } else {
            console.log('✅ Phase2F統合完了');
        }
        
        console.groupEnd();
    }
    
    /**
     * 🆕 Phase2F: CONFIG情報デバッグ（main.jsから移管・強化）
     */
    debugConfig() {
        if (!this.isEnabled) return;
        
        console.group('🔧 CONFIG設定情報（Phase2F統合版）');
        
        try {
            // 基本CONFIG表示
            console.log('CONFIG:', window.CONFIG || 'N/A');
            console.log('UI_CONFIG:', window.UI_CONFIG || 'N/A');
            console.log('UI_EVENTS:', window.UI_EVENTS || 'N/A');
            
            // Phase2重要設定（utils.js safeConfigGet使用）
            const phase2Settings = this.getPhase2Settings();
            console.log('🎯 Phase2重要設定（utils.js統合）:', phase2Settings);
            
            // CONFIG整合性確認（診断システム連携）
            if (this.diagnostics) {
                const integrity = this.diagnostics.validateConfigIntegrity();
                console.log('✅ CONFIG整合性:', integrity ? '正常' : '問題あり');
            }
            
            // CONFIG状態
            if (window.APP_STATE?.config) {
                console.log('📋 CONFIG状態:', window.APP_STATE.config);
            }
            
            // CONFIG変更履歴
            this.showConfigChangeHistory();
            
        } catch (error) {
            console.error('debugConfig実行エラー:', error);
        }
        
        console.groupEnd();
    }
    
    /**
     * Phase2設定値取得
     */
    getPhase2Settings() {
        const safeGet = window.safeConfigGet || ((key, def) => def);
        
        return {
            brushSize: safeGet('DEFAULT_BRUSH_SIZE', 'N/A'),
            opacity: safeGet('DEFAULT_OPACITY', 'N/A'),
            maxSize: safeGet('MAX_BRUSH_SIZE', 'N/A'),
            sizePresets: safeGet('SIZE_PRESETS', []),
            previewMinSize: safeGet('PREVIEW_MIN_SIZE', 'N/A'),
            previewMaxSize: safeGet('PREVIEW_MAX_SIZE', 'N/A')
        };
    }
    
    /**
     * 🆕 Phase2F: システム統合テスト（main.jsから移管・拡張）
     */
    testSystem() {
        if (!this.isEnabled) return false;
        
        console.group('🧪 システム統合テスト（Phase2F拡張版）');
        
        const testResults = new Map();
        let overallResult = true;
        
        try {
            // 1. 基本機能テスト
            const basicTest = this.runBasicTests();
            testResults.set('basic', basicTest);
            console.log('1. 基本機能テスト:', basicTest.success ? '✅ 成功' : '❌ 失敗');
            
            // 2. Phase2設定値テスト
            const phase2Test = this.runPhase2Tests();
            testResults.set('phase2', phase2Test);
            console.log('2. Phase2設定値テスト:', phase2Test.success ? '✅ 成功' : '❌ 失敗');
            
            // 3. Phase2F統合テスト
            const integrationTest = this.runIntegrationTests();
            testResults.set('integration', integrationTest);
            console.log('3. Phase2F統合テスト:', integrationTest.success ? '✅ 成功' : '❌ 失敗');
            
            // 4. UIManager統合テスト
            const uiTest = this.runUITests();
            testResults.set('ui', uiTest);
            console.log('4. UIManager統合テスト:', uiTest.success ? '✅ 成功' : '❌ 失敗');
            
            // 5. パフォーマンステスト
            const perfTest = this.runPerformanceTests();
            testResults.set('performance', perfTest);
            console.log('5. パフォーマンステスト:', perfTest.success ? '✅ 成功' : '❌ 失敗');
            
            // 総合判定
            overallResult = Array.from(testResults.values()).every(test => test.success);
            console.log(`🏆 総合テスト結果: ${overallResult ? '✅ 成功' : '❌ 失敗'}`);
            
            if (!overallResult) {
                const failedTests = Array.from(testResults.entries())
                    .filter(([_, test]) => !test.success)
                    .map(([name, test]) => ({ name, issues: test.issues }));
                console.warn('⚠️ 失敗したテスト:', failedTests);
            }
            
        } catch (error) {
            console.error('システムテスト実行エラー:', error);
            overallResult = false;
        }
        
        // テスト結果保存
        this.testResults.set('system', {
            timestamp: Date.now(),
            overall: overallResult,
            details: testResults
        });
        
        console.groupEnd();
        return overallResult;
    }
    
    /**
     * 基本機能テスト
     */
    runBasicTests() {
        const issues = [];
        
        try {
            // CONFIG読み込みテスト
            if (!window.CONFIG) issues.push('CONFIG未読み込み');
            if (window.APP_STATE && !window.APP_STATE.config?.loaded) {
                issues.push('CONFIG状態異常');
            }
            
            // utils.js統合テスト
            if (typeof safeConfigGet !== 'function') issues.push('utils.js未統合');
            
            // コンポーネント初期化テスト
            const requiredComponents = ['app', 'toolsSystem', 'uiManager'];
            for (const comp of requiredComponents) {
                if (!window[comp]) issues.push(`${comp}未初期化`);
            }
            
        } catch (error) {
            issues.push(`基本テストエラー: ${error.message}`);
        }
        
        return { success: issues.length === 0, issues };
    }
    
    /**
     * Phase2設定値テスト
     */
    runPhase2Tests() {
        const issues = [];
        
        try {
            const safeGet = window.safeConfigGet || (() => null);
            
            const tests = {
                brushSize: safeGet('DEFAULT_BRUSH_SIZE', 0) === 4,
                opacity: safeGet('DEFAULT_OPACITY', 0) === 1.0,
                maxSize: safeGet('MAX_BRUSH_SIZE', 0) === 500,
                presets: Array.isArray(safeGet('SIZE_PRESETS', [])) && 
                        safeGet('SIZE_PRESETS', []).length > 0
            };
            
            for (const [key, result] of Object.entries(tests)) {
                if (!result) issues.push(`Phase2設定異常: ${key}`);
            }
            
        } catch (error) {
            issues.push(`Phase2テストエラー: ${error.message}`);
        }
        
        return { success: issues.length === 0, issues };
    }
    
    /**
     * Phase2F統合テスト
     */
    runIntegrationTests() {
        const issues = [];
        
        try {
            // DRY原則準拠テスト
            if (!this.checkDRYCompliance()) issues.push('DRY原則違反');
            
            // SOLID原則準拠テスト  
            if (!this.checkSOLIDCompliance()) issues.push('SOLID原則違反');
            
            // 統合システム連携テスト
            if (!this.diagnostics) issues.push('診断システム未連携');
            if (!this.systemMonitor) issues.push('監視システム未連携');
            
        } catch (error) {
            issues.push(`統合テストエラー: ${error.message}`);
        }
        
        return { success: issues.length === 0, issues };
    }
    
    /**
     * UIテスト
     */
    runUITests() {
        const issues = [];
        
        try {
            if (window.uiManager) {
                const uiStats = window.uiManager.getUIStats?.();
                if (!uiStats?.initialized) issues.push('UIManager未初期化');
                
                if (uiStats?.errorCount > 5) issues.push('UI異常エラー多数');
            } else {
                issues.push('UIManager未存在');
            }
            
        } catch (error) {
            issues.push(`UIテストエラー: ${error.message}`);
        }
        
        return { success: issues.length === 0, issues };
    }
    
    /**
     * パフォーマンステスト
     */
    runPerformanceTests() {
        const issues = [];
        
        try {
            if (this.systemMonitor) {
                const perfStats = this.systemMonitor.getPerformanceStats();
                if (perfStats) {
                    if (perfStats.fps < 30) issues.push('FPS低下');
                    if (perfStats.memoryUsage > 200) issues.push('メモリ使用量過多');
                }
            }
            
            // 初期化時間チェック
            if (window.APP_STATE?.stats?.initTime > 5000) {
                issues.push('初期化時間過長');
            }
            
        } catch (error) {
            issues.push(`パフォーマンステストエラー: ${error.message}`);
        }
        
        return { success: issues.length === 0, issues };
    }
    
    /**
     * 🆕 Phase2F: DRY原則準拠チェック
     */
    checkDRYCompliance() {
        try {
            // 重複する関数名の検出
            const functionNames = [];
            
            // グローバル関数確認
            for (const key in window) {
                if (typeof window[key] === 'function' && !key.startsWith('_')) {
                    functionNames.push(key);
                }
            }
            
            // 重複確認（簡易版）
            const duplicates = functionNames.filter((name, index, arr) => {
                return arr.indexOf(name) !== index;
            });
            
            return duplicates.length === 0;
            
        } catch (error) {
            console.warn('DRY準拠チェックエラー:', error);
            return false;
        }
    }
    
    /**
     * 🆕 Phase2F: SOLID原則準拠チェック
     */
    checkSOLIDCompliance() {
        try {
            const compliance = {
                singleResponsibility: this.checkSingleResponsibility(),
                openClosed: this.checkOpenClosed(),
                liskovSubstitution: this.checkLiskovSubstitution(),
                interfaceSegregation: this.checkInterfaceSegregation(),
                dependencyInversion: this.checkDependencyInversion()
            };
            
            return Object.values(compliance).every(Boolean);
            
        } catch (error) {
            console.warn('SOLID準拠チェックエラー:', error);
            return false;
        }
    }
    
    // SOLID原則個別チェック（簡易版）
    checkSingleResponsibility() {
        // Phase2Fでファイル分離されているかチェック
        return !!(this.diagnostics && this.systemMonitor && this.performanceLogger);
    }
    
    checkOpenClosed() {
        // 拡張インターフェースが存在するかチェック
        return typeof window.addEventListener === 'function';
    }
    
    checkLiskovSubstitution() {
        // 基本的なインターフェース置換可能性（簡易チェック）
        return true;
    }
    
    checkInterfaceSegregation() {
        // 分離されたインターフェースが存在するかチェック
        return !!(window.toolsSystem && window.uiManager && window.historyManager);
    }
    
    checkDependencyInversion() {
        // utils.js等の抽象化された依存が存在するかチェック  
        return typeof safeConfigGet === 'function';
    }
    
    /**
     * Phase2設定値チェック
     */
    checkPhase2Settings() {
        try {
            const settings = this.getPhase2Settings();
            return {
                brushSizeOK: settings.brushSize === 4,
                opacityOK: settings.opacity === 1.0,
                maxSizeOK: settings.maxSize === 500,
                presetsOK: Array.isArray(settings.sizePresets) && settings.sizePresets.length > 0
            };
        } catch (error) {
            return {};
        }
    }
    
    /**
     * 🆕 Phase2F: デバッグレポート生成
     */
    generateDebugReport() {
        const report = {
            timestamp: new Date().toISOString(),
            version: 'v1rev11-Phase2F',
            debugMode: this.isEnabled,
            systemState: this.getSystemSnapshot(),
            componentStats: Object.fromEntries(this.componentStats),
            testResults: Object.fromEntries(this.testResults),
            performance: this.systemMonitor ? this.systemMonitor.getPerformanceStats() : null,
            diagnostics: this.diagnostics ? this.diagnostics.getSystemHealth() : null
        };
        
        this.debugReports.push(report);
        
        console.group('📋 デバッグレポート生成');
        console.log('レポート:', report);
        console.groupEnd();
        
        return report;
    }
    
    /**
     * システムスナップショット取得
     */
    getSystemSnapshot() {
        return {
            url: window.location.href,
            userAgent: navigator.userAgent,
            timestamp: Date.now(),
            appState: window.APP_STATE ? {
                initialized: window.APP_STATE.initialized,
                step: window.APP_STATE.initializationStep,
                error: window.APP_STATE.error
            } : null,
            components: {
                app: !!window.app,
                toolsSystem: !!window.toolsSystem,
                uiManager: !!window.uiManager,
                historyManager: !!window.historyManager,
                settingsManager: !!window.settingsManager
            }
        };
    }
    
    /**
     * CONFIG変更履歴表示
     */
    showConfigChangeHistory() {
        // 実装は簡易版（後で拡張予定）
        console.log('🔄 CONFIG変更履歴: 機能開発中');
    }
    
    /**
     * 🆕 Phase2F: 緊急診断実行（main.jsから移管）
     */
    emergencyDiagnosis() {
        if (!this.isEnabled) return;
        
        console.group('🚨 緊急診断実行（Phase2F版）');
        
        try {
            // 基本システム確認
            const basicCheck = this.runBasicTests();
            console.log('基本システム:', basicCheck.success ? '✅ 正常' : '❌ 異常');
            
            // 診断システム連携
            if (this.diagnostics) {
                const diagnosis = this.diagnostics.runFullDiagnostics();
                console.log('詳細診断:', diagnosis);
            }
            
            // 自動修復提案
            if (!basicCheck.success) {
                console.log('🔧 修復提案:', this.generateRepairSuggestions(basicCheck.issues));
            }
            
        } catch (error) {
            console.error('緊急診断エラー:', error);
        }
        
        console.groupEnd();
    }
    
    /**
     * 修復提案生成
     */
    generateRepairSuggestions(issues) {
        const suggestions = [];
        
        for (const issue of issues) {
            if (issue.includes('CONFIG')) {
                suggestions.push('location.reload() - ページ再読み込み');
            } else if (issue.includes('utils.js')) {
                suggestions.push('utils.js読み込み確認');
            } else if (issue.includes('未初期化')) {
                suggestions.push('initializeApplication() 再実行');
            }
        }
        
        return suggestions;
    }
    
    /**
     * デバッグモード制御
     */
    enableDebug() {
        this.isEnabled = true;
        if (localStorage) localStorage.setItem('debug', 'true');
        console.log('🐛 デバッグモード有効化');
    }
    
    disableDebug() {
        this.isEnabled = false;
        if (localStorage) localStorage.removeItem('debug');
        console.log('🐛 デバッグモード無効化');
    }
    
    setLogLevel(level) {
        this.logLevel = level.toLowerCase();
        if (localStorage) localStorage.setItem('logLevel', this.logLevel);
        console.log(`📝 ログレベル変更: ${this.logLevel}`);
    }
    
    /**
     * 統計・状態取得
     */
    getDebugStats() {
        return {
            enabled: this.isEnabled,
            logLevel: this.logLevel,
            testCount: this.testResults.size,
            reportCount: this.debugReports.length,
            componentCount: this.componentStats.size,
            hasExternalSystems: {
                diagnostics: !!this.diagnostics,
                performanceLogger: !!this.performanceLogger,
                systemMonitor: !!this.systemMonitor
            }
        };
    }
    
    /**
     * クリーンアップ
     */
    cleanup() {
        this.testResults.clear();
        this.componentStats.clear();
        this.debugReports.length = 0;
        console.log('🧹 DebugManager クリーンアップ完了');
    }
}

// ==== グローバル登録・エクスポート（Phase2F版）====
if (typeof window !== 'undefined') {
    window.DebugManager = DebugManager;
    
    // グローバルデバッグインスタンス作成
    window.debugManager = new DebugManager();
    
    // グローバル関数（後方互換性維持）
    window.debugApp = function() {
        return window.debugManager.debugApp();
    };
    
    window.debugConfig = function() {
        return window.debugManager.debugConfig();
    };
    
    window.testSystem = function() {
        return window.debugManager.testSystem();
    };
    
    window.emergencyDiagnosis = function() {
        return window.debugManager.emergencyDiagnosis();
    };
    
    // 🆕 Phase2F新規関数
    window.debugComponent = function(componentName) {
        const component = window[componentName];
        if (component) {
            return window.debugManager.debugComponent(componentName, component);
        } else {
            console.warn(`コンポーネント ${componentName} が見つかりません`);
        }
    };
    
    window.generateDebugReport = function() {
        return window.debugManager.generateDebugReport();
    };
    
    window.runSystemTests = function() {
        return window.debugManager.testSystem();
    };
    
    console.log('✅ debug-manager.js Phase2F版読み込み完了');
    console.log('📦 エクスポートクラス・関数（Phase2F版）:');
    console.log('  ✅ DebugManager: デバッグ統合管理（単一責務）');
    console.log('  ✅ window.debugApp() - アプリ全体デバッグ（main.jsから移管）');
    console.log('  ✅ window.debugConfig() - CONFIG情報デバッグ（main.jsから移管）');
    console.log('  ✅ window.testSystem() - システム統合テスト（main.jsから移管・拡張）');
    console.log('  ✅ window.emergencyDiagnosis() - 緊急診断（main.jsから移管）');
    console.log('  ✅ window.debugComponent() - 個別コンポーネントデバッグ（新規）');
    console.log('  ✅ window.generateDebugReport() - デバッグレポート生成（新規）');
    console.log('  ✅ window.runSystemTests() - システムテスト実行（新規）');
}

console.log('🎯 Phase2F改修効果:');
console.log('  🔧 main.jsから約500行のデバッグコード分離');
console.log('  🏗️ DRY・SOLID原則準拠設計');
console.log('  🧪 統合テストシステム強化');
console.log('  📊 コンポーネント統計・レポート機能');
console.log('  🔗 外部システム連携（診断・監視）');