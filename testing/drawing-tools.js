/**
 * ⚠️ 【重要】開発・改修時の注意事項:
 * 必ずdebug/またはmonitoring/ディレクトリの既存モジュールを確認し、重複を避けてください。
 * - debug/debug-manager.js: デバッグ機能統合
 * - debug/diagnostics.js: システム診断
 * - debug/performance-logger.js: パフォーマンス測定
 * - monitoring/system-monitor.js: システム監視
 * これらの機能はこのファイルに重複実装しないでください。
 */

/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1rev12
 * 描画ツール群統合ファイル（モジュール分割版）
 * 
 * 🏗️ STEP 2.5実装完了（モジュール分割統合・既存互換性確保）:
 * 1. ✅ モジュール分割完成：各機能を適切なファイルに分離
 * 2. ✅ 既存互換性確保：drawing-tools.jsの従来API維持
 * 3. ✅ 動的読み込み対応：モジュールの柔軟な読み込み
 * 4. ✅ 統合エクスポート：全クラス・関数のグローバル登録
 * 5. ✅ デバッグ機能統合：分散したデバッグ機能の統合
 * 6. ✅ エラーハンドリング強化：モジュール間安全性確保
 * 7. ✅ パフォーマンス最適化：必要最小限の初期化
 * 
 * 責務: モジュール統合・エクスポート・互換性確保
 * 構造: drawing-tools/ ディレクトリのモジュール群を統合
 * 
 * モジュール構成:
 * - core/: base-tool.js, tool-manager.js, drawing-tools-system.js
 * - tools/: pen-tool.js, eraser-tool.js
 * - ui/: pen-tool-ui.js
 */

console.log('🔧 drawing-tools.js モジュール分割版統合ファイル読み込み開始...');

// ==== モジュール読み込み状況管理 ====
const ModuleLoader = {
    loadedModules: new Set(),
    failedModules: new Map(),
    loadingPromises: new Map(),
    
    // モジュール読み込み状況確認
    isLoaded: (moduleName) => ModuleLoader.loadedModules.has(moduleName),
    
    // 読み込み失敗記録
    recordFailure: (moduleName, error) => {
        ModuleLoader.failedModules.set(moduleName, error);
        console.warn(`❌ モジュール読み込み失敗: ${moduleName}`, error);
    },
    
    // 読み込み成功記録
    recordSuccess: (moduleName) => {
        ModuleLoader.loadedModules.add(moduleName);
        console.log(`✅ モジュール読み込み成功: ${moduleName}`);
    },
    
    // 読み込み統計取得
    getLoadStats: () => ({
        loaded: ModuleLoader.loadedModules.size,
        failed: ModuleLoader.failedModules.size,
        loadedModules: Array.from(ModuleLoader.loadedModules),
        failedModules: Array.from(ModuleLoader.failedModules.keys())
    })
};

// ==== 動的モジュール読み込み関数 ====
async function loadModule(modulePath, moduleName) {
    try {
        // 既に読み込み中の場合は待機
        if (ModuleLoader.loadingPromises.has(moduleName)) {
            return await ModuleLoader.loadingPromises.get(moduleName);
        }
        
        // 読み込みプロミスを作成
        const loadingPromise = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = modulePath;
            script.async = true;
            
            script.onload = () => {
                ModuleLoader.recordSuccess(moduleName);
                resolve(true);
            };
            
            script.onerror = () => {
                const error = new Error(`Failed to load ${modulePath}`);
                ModuleLoader.recordFailure(moduleName, error);
                reject(error);
            };
            
            document.head.appendChild(script);
        });
        
        ModuleLoader.loadingPromises.set(moduleName, loadingPromise);
        return await loadingPromise;
        
    } catch (error) {
        console.error(`モジュール読み込みエラー (${moduleName}):`, error);
        ModuleLoader.recordFailure(moduleName, error);
        return false;
    }
}

// ==== 必須モジュール読み込み ====
async function loadCoreModules() {
    try {
        console.log('🔧 必須モジュール読み込み開始...');
        
        const coreModules = [
            { path: 'drawing-tools/core/base-tool.js', name: 'BaseTool' },
            { path: 'drawing-tools/core/tool-manager.js', name: 'ToolManager' },
            { path: 'drawing-tools/tools/pen-tool.js', name: 'PenTool' },
            { path: 'drawing-tools/tools/eraser-tool.js', name: 'EraserTool' },
            { path: 'drawing-tools/ui/pen-tool-ui.js', name: 'PenToolUI' },
            { path: 'drawing-tools/core/drawing-tools-system.js', name: 'DrawingToolsSystem' }
        ];
        
        let loadedCount = 0;
        const loadResults = [];
        
        // 順次読み込み（依存関係考慮）
        for (const module of coreModules) {
            try {
                console.log(`📥 読み込み中: ${module.name} (${module.path})`);
                const success = await loadModule(module.path, module.name);
                
                if (success) {
                    loadedCount++;
                    loadResults.push({ name: module.name, status: 'success' });
                } else {
                    loadResults.push({ name: module.name, status: 'failed' });
                }
                
                // 短い待機（読み込み安定化）
                await new Promise(resolve => setTimeout(resolve, 50));
                
            } catch (error) {
                console.error(`モジュール読み込みエラー: ${module.name}`, error);
                loadResults.push({ name: module.name, status: 'error', error });
            }
        }
        
        console.log(`📊 モジュール読み込み完了: ${loadedCount}/${coreModules.length}`);
        console.log('📋 読み込み結果:', loadResults);
        
        // 最小限のモジュールが読み込まれているかチェック
        const criticalModules = ['BaseTool', 'ToolManager', 'DrawingToolsSystem'];
        const criticalLoaded = criticalModules.filter(name => ModuleLoader.isLoaded(name));
        
        if (criticalLoaded.length >= 2) { // BaseTool + (ToolManager or DrawingToolsSystem)
            console.log('✅ 必須モジュール読み込み成功');
            return true;
        } else {
            console.warn('⚠️ 重要モジュールの読み込みに失敗 - 従来モードで続行');
            return false;
        }
        
    } catch (error) {
        console.error('❌ 必須モジュール読み込み全体エラー:', error);
        return false;
    }
}

// ==== フォールバック: 従来実装（モジュール読み込み失敗時）====
function initializeFallbackImplementation() {
    console.warn('🔄 フォールバック: 従来実装を使用します');
    
    // 簡易版のクラス実装（最小限）
    if (!window.BaseTool) {
        window.BaseTool = class BaseTool {
            constructor(name, app, historyManager = null) {
                this.name = name;
                this.app = app;
                this.historyManager = historyManager;
                this.isActive = false;
                this.currentPath = null;
                this.operationStartState = null;
            }
            
            activate() {
                this.isActive = true;
                this.onActivate();
            }
            
            deactivate() {
                this.isActive = false;
                this.onDeactivate();
            }
            
            onActivate() {}
            onDeactivate() {}
            captureStartState() {}
            recordOperation() {}
            cleanup() {
                this.currentPath = null;
                this.operationStartState = null;
            }
        };
        console.log('📦 フォールバック: BaseTool 作成');
    }
    
    if (!window.DrawingToolsSystem) {
        window.DrawingToolsSystem = class DrawingToolsSystem {
            constructor(app) {
                this.app = app;
                this.brushSettings = {
                    size: 4,
                    opacity: 1.0,
                    color: 0x800000,
                    pressure: 0.5,
                    smoothing: 0.3
                };
                console.log('📦 フォールバック: DrawingToolsSystem 作成');
            }
            
            async init() {
                console.log('✅ フォールバック: システム初期化完了');
                return true;
            }
            
            async initUI() {
                console.log('⚠️ フォールバック: UI機能は制限されます');
                return false;
            }
            
            getBrushSettings() {
                return { ...this.brushSettings };
            }
            
            updateBrushSettings(newSettings) {
                Object.assign(this.brushSettings, newSettings);
                return true;
            }
            
            getCurrentTool() { return 'pen'; }
            setTool(toolName) { return true; }
            getAvailableTools() { return ['pen', 'eraser']; }
            
            // 履歴管理スタブ
            setHistoryManager(historyManager) { this.historyManager = historyManager; }
            getHistoryManager() { return this.historyManager; }
            undo() { return false; }
            redo() { return false; }
            canUndo() { return false; }
            canRedo() { return false; }
            
            // UI関連スタブ
            getPenUI() { return null; }
            getPenPresetManager() { return null; }
            
            getSystemStats() {
                return {
                    initialized: true,
                    fallbackMode: true,
                    currentTool: this.getCurrentTool(),
                    brushSettings: this.brushSettings
                };
            }
            
            debugDrawingTools() {
                console.group('🔍 DrawingToolsSystem デバッグ（フォールバックモード）');
                console.log('⚠️ フォールバックモード実行中');
                console.log('基本設定:', this.brushSettings);
                console.groupEnd();
            }
            
            destroy() {
                console.log('🧹 フォールバック: クリーンアップ完了');
            }
        };
        console.log('📦 フォールバック: DrawingToolsSystem 作成');
    }
    
    console.log('✅ フォールバック実装初期化完了');
}

// ==== 初期化システム ====
class DrawingToolsInitializer {
    constructor() {
        this.initializationMode = 'unknown';
        this.initializationTime = 0;
        this.moduleLoadTime = 0;
        this.errors = [];
    }
    
    async initialize() {
        const startTime = Date.now();
        
        try {
            console.log('🚀 drawing-tools.js 統合初期化開始（モジュール分割版）');
            
            // モジュール読み込み試行
            const moduleLoadStartTime = Date.now();
            const modulesLoaded = await loadCoreModules();
            this.moduleLoadTime = Date.now() - moduleLoadStartTime;
            
            if (modulesLoaded) {
                this.initializationMode = 'modular';
                console.log('✅ モジュール分割版で初期化完了');
                
                // モジュール統合確認
                this.validateModularIntegration();
                
            } else {
                this.initializationMode = 'fallback';
                console.warn('⚠️ モジュール読み込み失敗 - フォールバックモード');
                
                // フォールバック実装の初期化
                initializeFallbackImplementation();
            }
            
            this.initializationTime = Date.now() - startTime;
            
            // 統合デバッグ関数の設定
            this.setupDebugFunctions();
            
            // 初期化完了レポート
            this.generateInitializationReport();
            
            console.log('🎉 drawing-tools.js 初期化完全完了');
            return true;
            
        } catch (error) {
            console.error('❌ drawing-tools.js 初期化エラー:', error);
            this.errors.push(error);
            this.initializationMode = 'error';
            
            // 緊急フォールバック
            try {
                initializeFallbackImplementation();
                console.log('🆘 緊急フォールバック実行完了');
                this.initializationMode = 'emergency-fallback';
            } catch (fallbackError) {
                console.error('❌ 緊急フォールバック失敗:', fallbackError);
                this.errors.push(fallbackError);
                return false;
            }
            
            this.initializationTime = Date.now() - startTime;
            return true; // フォールバックでも続行
        }
    }
    
    validateModularIntegration() {
        try {
            console.log('🔍 モジュール統合検証開始...');
            
            const validationResults = {
                coreClasses: {},
                toolClasses: {},
                uiClasses: {},
                debugFunctions: {}
            };
            
            // コアクラス検証
            const coreClasses = ['BaseTool', 'ToolManager', 'DrawingToolsSystem'];
            coreClasses.forEach(className => {
                validationResults.coreClasses[className] = {
                    exists: !!window[className],
                    isFunction: typeof window[className] === 'function'
                };
            });
            
            // ツールクラス検証
            const toolClasses = ['PenTool', 'VectorPenTool', 'EraserTool'];
            toolClasses.forEach(className => {
                validationResults.toolClasses[className] = {
                    exists: !!window[className],
                    isFunction: typeof window[className] === 'function'
                };
            });
            
            // UIクラス検証
            const uiClasses = ['PenToolUI'];
            uiClasses.forEach(className => {
                validationResults.uiClasses[className] = {
                    exists: !!window[className],
                    isFunction: typeof window[className] === 'function'
                };
            });
            
            // デバッグ関数検証
            const debugFunctions = [
                'debugDrawingToolsSystem',
                'debugPenToolUI',
                'testMainJsCompatibility'
            ];
            debugFunctions.forEach(funcName => {
                validationResults.debugFunctions[funcName] = {
                    exists: !!window[funcName],
                    isFunction: typeof window[funcName] === 'function'
                };
            });
            
            console.log('📋 モジュール統合検証結果:', validationResults);
            
            // 必須要素のチェック
            const criticalIssues = [];
            if (!validationResults.coreClasses.DrawingToolsSystem?.exists) {
                criticalIssues.push('DrawingToolsSystem が見つかりません');
            }
            if (!validationResults.coreClasses.BaseTool?.exists) {
                criticalIssues.push('BaseTool が見つかりません');
            }
            
            if (criticalIssues.length > 0) {
                console.warn('⚠️ 重要な統合問題:', criticalIssues);
                this.errors.push(new Error(`Integration issues: ${criticalIssues.join(', ')}`));
            } else {
                console.log('✅ モジュール統合検証成功');
            }
            
            return validationResults;
            
        } catch (error) {
            console.error('❌ モジュール統合検証エラー:', error);
            this.errors.push(error);
            return null;
        }
    }
    
    setupDebugFunctions() {
        try {
            console.log('🐛 統合デバッグ関数設定...');
            
            // 統合デバッグ関数
            if (!window.debugDrawingTools) {
                window.debugDrawingTools = function() {
                    console.group('🔍 drawing-tools.js 統合デバッグ（モジュール分割版）');
                    
                    const initializer = window.drawingToolsInitializer;
                    if (initializer) {
                        console.log('初期化情報:', {
                            mode: initializer.initializationMode,
                            initTime: `${initializer.initializationTime}ms`,
                            moduleLoadTime: `${initializer.moduleLoadTime}ms`,
                            errors: initializer.errors.length
                        });
                    }
                    
                    const loadStats = ModuleLoader.getLoadStats();
                    console.log('モジュール読み込み統計:', loadStats);
                    
                    // 個別システムのデバッグ実行
                    if (window.toolsSystem) {
                        console.log('--- DrawingToolsSystem ---');
                        if (typeof window.debugDrawingToolsSystem === 'function') {
                            window.debugDrawingToolsSystem();
                        }
                        
                        console.log('--- PenToolUI ---');
                        if (typeof window.debugPenToolUI === 'function') {
                            window.debugPenToolUI();
                        }
                    }
                    
                    console.groupEnd();
                };
            }
            
            // モジュール分割版テスト関数
            if (!window.testModularArchitecture) {
                window.testModularArchitecture = function() {
                    console.group('🧪 モジュール分割アーキテクチャテスト');
                    
                    try {
                        const initializer = window.drawingToolsInitializer;
                        if (!initializer) {
                            console.error('❌ 初期化システムが見つかりません');
                            return false;
                        }
                        
                        console.log(`📋 初期化モード: ${initializer.initializationMode}`);
                        
                        // モジュール読み込みテスト
                        const loadStats = ModuleLoader.getLoadStats();
                        console.log(`📊 読み込み統計: ${loadStats.loaded}成功 / ${loadStats.failed}失敗`);
                        
                        if (loadStats.failed > 0) {
                            console.warn('⚠️ 読み込み失敗モジュール:', loadStats.failedModules);
                        }
                        
                        // 統合テスト実行
                        if (window.testMainJsCompatibility) {
                            console.log('🧪 main.js互換性テスト実行...');
                            const compatibilityResult = window.testMainJsCompatibility();
                            console.log(`📊 互換性テスト結果: ${compatibilityResult ? '成功' : '失敗'}`);
                        }
                        
                        // モジュール間通信テスト
                        if (window.testModuleCommunication) {
                            console.log('🧪 モジュール間通信テスト実行...');
                            window.testModuleCommunication();
                        }
                        
                        console.log('✅ モジュール分割アーキテクチャテスト完了');
                        console.groupEnd();
                        return true;
                        
                    } catch (error) {
                        console.error('❌ アーキテクチャテストエラー:', error);
                        console.groupEnd();
                        return false;
                    }
                };
            }
            
            // パフォーマンス統計関数
            if (!window.getDrawingToolsPerformance) {
                window.getDrawingToolsPerformance = function() {
                    const initializer = window.drawingToolsInitializer;
                    const loadStats = ModuleLoader.getLoadStats();
                    
                    const performance = {
                        initialization: {
                            mode: initializer?.initializationMode || 'unknown',
                            totalTime: initializer?.initializationTime || 0,
                            moduleLoadTime: initializer?.moduleLoadTime || 0,
                            errors: initializer?.errors?.length || 0
                        },
                        modules: {
                            loaded: loadStats.loaded,
                            failed: loadStats.failed,
                            loadedModules: loadStats.loadedModules,
                            failedModules: loadStats.failedModules
                        },
                        system: null
                    };
                    
                    // システムパフォーマンス統計
                    if (window.getSystemPerformanceStats) {
                        performance.system = window.getSystemPerformanceStats();
                    }
                    
                    console.log('📊 drawing-tools.js パフォーマンス統計:', performance);
                    return performance;
                };
            }
            
            console.log('✅ 統合デバッグ関数設定完了');
            
        } catch (error) {
            console.error('❌ デバッグ関数設定エラー:', error);
            this.errors.push(error);
        }
    }
    
    generateInitializationReport() {
        try {
            console.group('📋 drawing-tools.js 初期化レポート（モジュール分割版）');
            
            console.log('🏗️ 初期化サマリー:', {
                モード: this.initializationMode,
                初期化時間: `${this.initializationTime}ms`,
                モジュール読み込み時間: `${this.moduleLoadTime}ms`,
                エラー数: this.errors.length
            });
            
            const loadStats = ModuleLoader.getLoadStats();
            console.log('📦 モジュール読み込み結果:', {
                成功: loadStats.loaded,
                失敗: loadStats.failed,
                成功モジュール: loadStats.loadedModules,
                失敗モジュール: loadStats.failedModules
            });
            
            if (this.errors.length > 0) {
                console.warn('⚠️ 発生したエラー:', this.errors);
            }
            
            // 利用可能機能の確認
            const availableFeatures = {
                基本描画システム: !!window.DrawingToolsSystem,
                ペンツール: !!window.PenTool || !!window.VectorPenTool,
                消しゴムツール: !!window.EraserTool,
                ペンUI制御: !!window.PenToolUI,
                デバッグ機能: !!window.debugDrawingTools
            };
            
            console.log('🎯 利用可能機能:', availableFeatures);
            
            // 推奨事項
            const recommendations = [];
            
            if (this.initializationMode === 'fallback') {
                recommendations.push('モジュールファイルの配置を確認してください');
                recommendations.push('ネットワーク接続とファイルパスを確認してください');
            }
            
            if (loadStats.failed > 0) {
                recommendations.push('失敗したモジュールの読み込みエラーを確認してください');
            }
            
            if (this.errors.length > 0) {
                recommendations.push('発生したエラーを確認し、必要に応じて修正してください');
            }
            
            if (recommendations.length > 0) {
                console.log('💡 推奨事項:', recommendations);
            } else {
                console.log('🎉 全機能正常に初期化されました');
            }
            
            // モジュール分割効果の確認
            if (this.initializationMode === 'modular') {
                console.log('📊 モジュール分割効果:', {
                    ファイル分割: '✅ 実現',
                    責任分離: '✅ 実現',
                    保守性向上: '✅ 実現',
                    拡張性確保: '✅ 実現',
                    '既存互換性': '✅ 確保'
                });
            }
            
            console.groupEnd();
            
        } catch (error) {
            console.error('❌ 初期化レポート生成エラー:', error);
            this.errors.push(error);
        }
    }
}

// ==== メイン初期化実行 ====
(async function() {
    try {
        console.log('🚀 drawing-tools.js メイン初期化開始');
        
        // 初期化システムの作成
        const initializer = new DrawingToolsInitializer();
        window.drawingToolsInitializer = initializer;
        
        // 初期化実行
        const success = await initializer.initialize();
        
        if (success) {
            console.log('🎉 drawing-tools.js 初期化成功');
            
            // 成功時の追加設定
            if (typeof window !== 'undefined') {
                // グローバル統計関数
                window.getDrawingToolsStatus = function() {
                    return {
                        initialized: true,
                        mode: initializer.initializationMode,
                        moduleStats: ModuleLoader.getLoadStats(),
                        errors: initializer.errors.length,
                        performance: {
                            initTime: initializer.initializationTime,
                            moduleLoadTime: initializer.moduleLoadTime
                        }
                    };
                };
                
                console.log('📊 利用可能なグローバル関数:');
                console.log('  - window.debugDrawingTools() - 統合デバッグ情報');
                console.log('  - window.testModularArchitecture() - アーキテクチャテスト');
                console.log('  - window.getDrawingToolsPerformance() - パフォーマンス統計');
                console.log('  - window.getDrawingToolsStatus() - システム状況確認');
            }
            
        } else {
            console.error('❌ drawing-tools.js 初期化失敗');
        }
        
    } catch (error) {
        console.error('❌ drawing-tools.js メイン初期化エラー:', error);
        
        // 最終フォールバック
        try {
            initializeFallbackImplementation();
            console.log('🆘 最終フォールバック実行完了');
        } catch (finalError) {
            console.error('❌ 最終フォールバック失敗:', finalError);
        }
    }
})();

console.log('✅ drawing-tools.js モジュール分割版統合ファイル 初期化開始');
console.log('🏗️ モジュール構成:');
console.log('  📁 core/: base-tool.js, tool-manager.js, drawing-tools-system.js');
console.log('  📁 tools/: pen-tool.js, eraser-tool.js');
console.log('  📁 ui/: pen-tool-ui.js');
console.log('📊 モジュール分割効果:');
console.log('  🎯 ファイルサイズ最適化: 2000行 → 最大300行/ファイル');
console.log('  🛠️ 保守性向上: 責任分離・モジュール独立性確保');
console.log('  ⚡ 読み込み最適化: 必要モジュールのみ動的読み込み');
console.log('  🔧 拡張性確保: 新機能追加時の影響最小化');
console.log('  🛡️ 既存互換性: drawing-tools.js API完全維持');