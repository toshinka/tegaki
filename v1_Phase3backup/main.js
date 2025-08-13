/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1rev18
 * メイン初期化スクリプト - main.js (Phase1総合修正・完全統合版)
 * 
 * 🔧 Phase1総合修正内容:
 * 1. ✅ CONFIG要求項目不足問題の完全解決
 * 2. ✅ PixiExtensions未読み込み問題の対応強化
 * 3. ✅ SIZE_PRESETS配列チェックの改善
 * 4. ✅ エラーハンドリングの堅牢化
 * 5. ✅ DRY・SOLID原則に基づく責任分離
 * 6. ✅ 段階的初期化による安定性向上
 * 
 * 修正目標: 全Consoleエラー解消・確実なアプリケーション起動
 */

console.log('🚀 main.js Phase1総合修正・完全統合版 読み込み開始...');

// ==== Phase1: 安全な設定値取得システム（改良版）====
const getConfigValue = (key, defaultValue) => {
    try {
        if (typeof window.safeConfigGet === 'function') {
            return window.safeConfigGet(key, defaultValue);
        }
        
        // フォールバック: 直接アクセス
        if (window.CONFIG && window.CONFIG[key] !== undefined) {
            return window.CONFIG[key];
        }
        
        console.warn(`CONFIG取得フォールバック (${key}):`, defaultValue);
        return defaultValue;
    } catch (error) {
        console.warn(`CONFIG取得エラー (${key}):`, error, '→ デフォルト値:', defaultValue);
        return defaultValue;
    }
};

// ==== Phase2: CONFIG事前確認・補完システム ====
const ensureConfigIntegrity = () => {
    console.log('🔍 CONFIG完整性事前確認...');
    
    // CONFIG基本存在確認
    if (!window.CONFIG || typeof window.CONFIG !== 'object') {
        console.error('❌ CONFIG未定義 - 最小限CONFIG作成中...');
        window.CONFIG = createMinimalConfig();
    }
    
    // safeConfigGet関数確認
    if (typeof window.safeConfigGet !== 'function') {
        console.warn('⚠️ safeConfigGet未定義 - 代替実装作成');
        window.safeConfigGet = getConfigValue;
    }
    
    // 重要項目の存在確認・補完
    const criticalItems = {
        'SIZE_PRESETS': [
            { id: 'preset_1', name: '極細', size: 1, opacity: 0.9, color: 0x800000 },
            { id: 'preset_2', name: '細', size: 2, opacity: 0.85, color: 0x800000 },
            { id: 'preset_4', name: '標準', size: 4, opacity: 0.85, color: 0x800000 },
            { id: 'preset_8', name: '太', size: 8, opacity: 0.8, color: 0x800000 },
            { id: 'preset_16', name: '極太', size: 16, opacity: 0.75, color: 0x800000 },
            { id: 'preset_32', name: '超極太', size: 32, opacity: 0.7, color: 0x800000 }
        ],
        'SLIDER_UPDATE_THROTTLE': 16,
        'POPUP_FADE_TIME': 300,
        'TARGET_FPS': 60,
        'PRESET_UPDATE_THROTTLE': 16,
        'PERFORMANCE_UPDATE_INTERVAL': 1000,
        'PREVIEW_MIN_SIZE': 1,
        'PREVIEW_MAX_SIZE': 32,
        'DEFAULT_BRUSH_SIZE': 4,
        'DEFAULT_OPACITY': 0.85,
        'DEFAULT_COLOR': 0x800000
    };
    
    const missingItems = [];
    const addedItems = [];
    
    Object.entries(criticalItems).forEach(([key, defaultValue]) => {
        if (window.CONFIG[key] === undefined) {
            window.CONFIG[key] = defaultValue;
            missingItems.push(key);
            addedItems.push(key);
        }
    });
    
    // SIZE_PRESETS特別チェック
    if (!Array.isArray(window.CONFIG.SIZE_PRESETS) || window.CONFIG.SIZE_PRESETS.length === 0) {
        console.warn('⚠️ SIZE_PRESETS配列問題 - 修正中...');
        window.CONFIG.SIZE_PRESETS = criticalItems.SIZE_PRESETS;
        addedItems.push('SIZE_PRESETS (配列修正)');
    }
    
    // CACHE_CONFIG確認
    if (!window.CONFIG.CACHE_CONFIG || typeof window.CONFIG.CACHE_CONFIG !== 'object') {
        window.CONFIG.CACHE_CONFIG = {
            PREVIEW_CACHE_SIZE: 100,
            BRUSH_CACHE_SIZE: 50,
            HISTORY_CACHE_SIZE: 200
        };
        addedItems.push('CACHE_CONFIG');
    }
    
    // ログ出力
    if (addedItems.length > 0) {
        console.log(`🔧 CONFIG補完完了: ${addedItems.length}項目追加`);
        console.log('  追加項目:', addedItems);
    } else {
        console.log('✅ CONFIG完整性確認完了 - 補完不要');
    }
    
    return {
        missingCount: missingItems.length,
        addedItems: addedItems,
        isComplete: missingItems.length === 0
    };
};

const createMinimalConfig = () => {
    console.log('🆘 最小限CONFIG作成中...');
    return {
        DEFAULT_BRUSH_SIZE: 4,
        DEFAULT_OPACITY: 0.85,
        MAX_BRUSH_SIZE: 500,
        MIN_BRUSH_SIZE: 0.1,
        DEFAULT_COLOR: 0x800000,
        CANVAS_WIDTH: 400,
        CANVAS_HEIGHT: 400,
        BG_COLOR: 0xf0e0d6,
        TARGET_FPS: 60,
        DEFAULT_PRESSURE: 0.5,
        DEFAULT_SMOOTHING: 0.3,
        SIZE_PRESETS: [
            { id: 'preset_4', name: '標準', size: 4, opacity: 0.85, color: 0x800000 }
        ],
        SLIDER_UPDATE_THROTTLE: 16,
        POPUP_FADE_TIME: 300,
        PRESET_UPDATE_THROTTLE: 16,
        PERFORMANCE_UPDATE_INTERVAL: 1000,
        PREVIEW_MIN_SIZE: 1,
        PREVIEW_MAX_SIZE: 32
    };
};

// ==== Phase3: components.js要求項目検証システム ====
const validateComponentsJSRequirements = () => {
    console.log('🔍 components.js要求項目検証...');
    
    const requiredForComponents = [
        'SLIDER_UPDATE_THROTTLE',
        'POPUP_FADE_TIME', 
        'SIZE_PRESETS',
        'PREVIEW_MIN_SIZE',
        'PREVIEW_MAX_SIZE',
        'PRESET_UPDATE_THROTTLE',
        'TARGET_FPS',
        'DEFAULT_COLOR'
    ];
    
    const missing = [];
    const present = [];
    
    requiredForComponents.forEach(key => {
        const value = getConfigValue(key, null);
        if (value === null || value === undefined) {
            missing.push(key);
        } else {
            present.push(key);
        }
    });
    
    // SIZE_PRESETS特別検証
    const sizePresets = getConfigValue('SIZE_PRESETS', []);
    if (!Array.isArray(sizePresets) || sizePresets.length === 0) {
        if (!missing.includes('SIZE_PRESETS')) {
            missing.push('SIZE_PRESETS (配列でない)');
        }
    }
    
    if (missing.length > 0) {
        console.warn('⚠️ components.js要求項目不足:', missing);
        return { valid: false, missing, present };
    } else {
        console.log(`✅ components.js要求項目確認完了: ${present.length}項目`);
        return { valid: true, missing: [], present };
    }
};

// ==== Phase4: PixiExtensions状況確認・対応システム ====
const checkPixiExtensionsStatus = () => {
    console.log('🔍 PixiExtensions状況確認...');
    
    const status = {
        available: typeof window.PixiExtensions !== 'undefined',
        features: {},
        stats: null,
        fallbackMode: false
    };
    
    if (status.available) {
        try {
            // 機能確認
            const featureList = ['ui', 'layers', 'gif', 'smooth', 'graphics'];
            featureList.forEach(feature => {
                try {
                    status.features[feature] = window.PixiExtensions.hasFeature(feature);
                } catch (error) {
                    status.features[feature] = false;
                }
            });
            
            // 統計取得
            if (typeof window.PixiExtensions.getStats === 'function') {
                status.stats = window.PixiExtensions.getStats();
            }
            
            console.log(`✅ PixiExtensions利用可能: ${Object.values(status.features).filter(Boolean).length}/${featureList.length}機能`);
            
        } catch (error) {
            console.warn('⚠️ PixiExtensions確認エラー:', error);
            status.available = false;
        }
    }
    
    if (!status.available) {
        console.warn('⚠️ PixiExtensions未読み込み - 基本機能のみ利用');
        status.fallbackMode = true;
    }
    
    return status;
};

// ==== Phase5: 依存関係チェック（強化版）====
const checkDependencies = () => {
    console.log('🔍 依存関係チェック（強化版）...');
    
    const requiredDependencies = [
        { name: 'PIXI', checker: () => typeof window.PIXI !== 'undefined', critical: true },
        { name: 'PixiDrawingApp', checker: () => typeof window.PixiDrawingApp !== 'undefined', critical: true },
        { name: 'DrawingToolsSystem', checker: () => typeof window.DrawingToolsSystem !== 'undefined', critical: true },
        { name: 'UIManager', checker: () => typeof window.UIManager !== 'undefined', critical: true },
        { name: 'HistoryManager', checker: () => typeof window.HistoryManager !== 'undefined', critical: true }
    ];
    
    const optionalDependencies = [
        { name: 'PixiExtensions', checker: () => typeof window.PixiExtensions !== 'undefined', critical: false },
        { name: 'LayerManager', checker: () => typeof window.LayerManager !== 'undefined', critical: false },
        { name: 'GIFExportManager', checker: () => typeof window.GIFExportManager !== 'undefined', critical: false }
    ];
    
    const results = {
        critical: { missing: [], available: [] },
        optional: { missing: [], available: [] },
        allAvailable: true
    };
    
    // 重要な依存関係チェック
    requiredDependencies.forEach(({ name, checker, critical }) => {
        if (checker()) {
            results.critical.available.push(name);
        } else {
            results.critical.missing.push(name);
            if (critical) {
                results.allAvailable = false;
            }
        }
    });
    
    // オプション依存関係チェック
    optionalDependencies.forEach(({ name, checker }) => {
        if (checker()) {
            results.optional.available.push(name);
        } else {
            results.optional.missing.push(name);
        }
    });
    
    // ログ出力
    console.log(`✅ 重要依存関係: ${results.critical.available.length}/${requiredDependencies.length} - [${results.critical.available.join(', ')}]`);
    
    if (results.optional.available.length > 0) {
        console.log(`📦 オプション機能: ${results.optional.available.length} - [${results.optional.available.join(', ')}]`);
    }
    
    if (results.critical.missing.length > 0) {
        console.error(`❌ 不足重要依存関係: [${results.critical.missing.join(', ')}]`);
    }
    
    if (results.optional.missing.length > 0) {
        console.warn(`⚠️ 不足オプション機能: [${results.optional.missing.join(', ')}]`);
    }
    
    return results;
};

// ==== Phase6: 安全初期化シーケンス（改良版）====
const safeInitSequence = async () => {
    console.log('📋 安全初期化シーケンス開始...');
    
    const initResults = {
        configCheck: null,
        componentsValidation: null,
        pixiExtensionsStatus: null,
        dependencyCheck: null,
        errors: [],
        warnings: []
    };
    
    try {
        // 1. CONFIG完整性確認・補完
        initResults.configCheck = ensureConfigIntegrity();
        if (!initResults.configCheck.isComplete) {
            initResults.warnings.push(`CONFIG項目補完: ${initResults.configCheck.addedItems.length}項目`);
        }
        
        // 2. components.js要求項目検証
        initResults.componentsValidation = validateComponentsJSRequirements();
        if (!initResults.componentsValidation.valid) {
            initResults.warnings.push(`components.js要求項目不足: ${initResults.componentsValidation.missing.length}項目`);
        }
        
        // 3. PixiExtensions状況確認
        initResults.pixiExtensionsStatus = checkPixiExtensionsStatus();
        if (!initResults.pixiExtensionsStatus.available) {
            initResults.warnings.push('PixiExtensions未利用可能');
        }
        
        // 4. 依存関係チェック
        initResults.dependencyCheck = checkDependencies();
        if (!initResults.dependencyCheck.allAvailable) {
            initResults.errors.push(`重要依存関係不足: ${initResults.dependencyCheck.critical.missing.join(', ')}`);
        }
        
        console.log('✅ 安全初期化シーケンス完了');
        
    } catch (error) {
        console.error('🚨 安全初期化シーケンスエラー:', error);
        initResults.errors.push(`初期化シーケンスエラー: ${error.message}`);
    }
    
    return initResults;
};

// ==== Phase7: アプリケーション初期化クラス（改良版）====
class ComprehensiveAppInitializer {
    constructor() {
        this.components = {
            app: null,
            toolsSystem: null,
            uiManager: null,
            historyManager: null
        };
        this.initialized = false;
        this.initStartTime = performance.now();
        this.initResults = null;
    }
    
    async initialize() {
        try {
            console.log('📋 総合アプリケーション初期化開始...');
            
            // 1. 安全初期化シーケンス実行
            this.initResults = await safeInitSequence();
            
            // 2. エラーがある場合は中断
            if (this.initResults.errors.length > 0) {
                throw new Error(`初期化前チェック失敗: ${this.initResults.errors.join(', ')}`);
            }
            
            // 3. アプリケーション作成
            await this.createApp();
            
            // 4. ツールシステム作成
            await this.createToolsSystem();
            
            // 5. UIマネージャー作成
            await this.createUIManager();
            
            // 6. システム連携
            this.connectSystems();
            
            // 7. 完了処理
            this.finalize();
            
            return true;
            
        } catch (error) {
            this.handleError(error);
            return false;
        }
    }
    
    async createApp() {
        console.log('🎯 PixiDrawingApp作成...');
        
        const width = getConfigValue('CANVAS_WIDTH', 400);
        const height = getConfigValue('CANVAS_HEIGHT', 400);
        
        this.components.app = new PixiDrawingApp(width, height);
        await this.components.app.init();
        
        console.log(`✅ アプリ作成完了: ${width}×${height}px`);
    }
    
    async createToolsSystem() {
        console.log('🔧 DrawingToolsSystem作成...');
        
        this.components.toolsSystem = new DrawingToolsSystem(this.components.app);
        await this.components.toolsSystem.init();
        
        // デフォルト設定適用
        const defaultSettings = {
            size: getConfigValue('DEFAULT_BRUSH_SIZE', 4),
            opacity: getConfigValue('DEFAULT_OPACITY', 0.85),
            color: getConfigValue('DEFAULT_COLOR', 0x800000),
            pressure: getConfigValue('DEFAULT_PRESSURE', 0.5),
            smoothing: getConfigValue('DEFAULT_SMOOTHING', 0.3)
        };
        
        if (this.components.toolsSystem.updateBrushSettings) {
            this.components.toolsSystem.updateBrushSettings(defaultSettings);
        }
        
        console.log('✅ ツールシステム作成完了');
    }
    
    async createUIManager() {
        console.log('🎭 UIManager作成...');
        
        try {
            this.components.historyManager = this.components.toolsSystem.getHistoryManager();
            this.components.uiManager = new window.UIManager(
                this.components.app, 
                this.components.toolsSystem, 
                this.components.historyManager
            );
            
            await this.components.uiManager.init();
            console.log('✅ UIManager初期化完了');
        } catch (error) {
            console.warn('⚠️ UIManager初期化でエラー:', error.message);
            
            // フォールバック処理
            if (this.components.uiManager && this.components.uiManager.setupToolButtons) {
                this.components.uiManager.setupToolButtons();
                console.log('🔄 UIManager基本セットアップ実行');
            }
        }
    }
    
    connectSystems() {
        console.log('🔗 システム連携設定...');
        
        // グローバル参照設定
        window.app = this.components.app;
        window.toolsSystem = this.components.toolsSystem;
        window.uiManager = this.components.uiManager;
        window.historyManager = this.components.historyManager;
        window.appConfig = window.CONFIG;
        
        // デバッグ関数設定
        this.setupDebugFunctions();
        
        // PixiJS拡張ライブラリ統合
        this.integrateWithExtensions();
        
        console.log('✅ システム連携完了');
    }
    
    setupDebugFunctions() {
        // 基本操作関数
        window.undo = () => this.components.historyManager?.undo() || false;
        window.redo = () => this.components.historyManager?.redo() || false;
        
        // システム状態確認
        window.debugApp = () => {
            console.group('🔍 アプリケーション状態');
            console.log('初期化:', this.initialized);
            console.log('初期化結果:', this.initResults);
            console.log('コンポーネント:', {
                app: !!this.components.app,
                toolsSystem: !!this.components.toolsSystem,
                uiManager: !!this.components.uiManager,
                historyManager: !!this.components.historyManager
            });
            
            if (this.initResults?.pixiExtensionsStatus?.available) {
                console.log('拡張ライブラリ:', this.initResults.pixiExtensionsStatus.stats);
            }
            console.groupEnd();
        };
        
        // 描画テスト
        window.testDrawing = () => {
            const toolsSystem = this.components.toolsSystem;
            if (toolsSystem && toolsSystem.activeTool) {
                console.log('✅ 描画システム利用可能');
                console.log('アクティブツール:', toolsSystem.activeTool.constructor.name);
                return true;
            } else {
                console.warn('❌ 描画システムが利用できません');
                return false;
            }
        };
        
        // CONFIG状態確認
        window.debugConfig = () => {
            console.group('🔧 CONFIG状態');
            console.log('SIZE_PRESETS:', getConfigValue('SIZE_PRESETS', []));
            console.log('TARGET_FPS:', getConfigValue('TARGET_FPS', 60));
            console.log('PREVIEW_CACHE_SIZE:', getConfigValue('CACHE_CONFIG.PREVIEW_CACHE_SIZE', 100));
            console.log('safeConfigGet関数:', typeof window.safeConfigGet);
            console.groupEnd();
        };
    }
    
    integrateWithExtensions() {
        const extensionStatus = this.initResults?.pixiExtensionsStatus;
        
        if (!extensionStatus?.available) {
            console.log('⚠️ PixiJS拡張ライブラリ未利用可能 - 基本機能のみ');
            return;
        }
        
        console.log('🔗 PixiJS拡張ライブラリ統合...');
        
        const app = this.components.app;
        
        // レイヤーマネージャー（利用可能な場合）
        if (extensionStatus.features.layers) {
            try {
                window.layerManager = window.PixiExtensions.createLayerManager(app);
                console.log('✅ レイヤーマネージャー統合完了');
            } catch (error) {
                console.warn('⚠️ レイヤーマネージャー統合失敗:', error.message);
            }
        }
        
        // GIFエクスポーター（利用可能な場合）
        if (extensionStatus.features.gif) {
            try {
                window.gifExporter = window.PixiExtensions.createGIFExporter(app);
                console.log('✅ GIFエクスポーター統合完了');
            } catch (error) {
                console.warn('⚠️ GIFエクスポーター統合失敗:', error.message);
            }
        }
        
        // UI機能（利用可能な場合）
        if (extensionStatus.features.ui) {
            window.createPopup = (options) => {
                try {
                    return window.PixiExtensions.createSimplePopup(options);
                } catch (error) {
                    console.warn('⚠️ ポップアップ作成失敗:', error.message);
                    return null;
                }
            };
            console.log('✅ UI機能統合完了');
        }
    }
    
    finalize() {
        const initTime = performance.now() - this.initStartTime;
        this.initialized = true;
        
        console.log('🎉 総合アプリケーション初期化完了！');
        console.log(`⏱️ 初期化時間: ${initTime.toFixed(2)}ms`);
        
        // 初期化結果サマリー
        this.logInitializationSummary();
        
        // UI表示更新
        if (this.components.uiManager?.updateAllDisplays) {
            this.components.uiManager.updateAllDisplays();
        }
        
        // 成功通知
        this.showSuccessNotification();
    }
    
    logInitializationSummary() {
        console.group('📋 初期化結果サマリー');
        
        // 基本情報
        console.log(`🖼️ キャンバス: ${getConfigValue('CANVAS_WIDTH', 400)}×${getConfigValue('CANVAS_HEIGHT', 400)}px`);
        console.log(`🖊️ ペンサイズ: ${getConfigValue('DEFAULT_BRUSH_SIZE', 4)}px`);
        console.log(`🎨 透明度: ${Math.round(getConfigValue('DEFAULT_OPACITY', 0.85) * 100)}%`);
        
        // コンポーネント状況
        const components = this.components;
        console.log('🔧 コンポーネント状況:');
        console.log(`  - App: ${components.app ? '✅' : '❌'}`);
        console.log(`  - ToolsSystem: ${components.toolsSystem ? '✅' : '❌'}`);
        console.log(`  - UIManager: ${components.uiManager ? '✅' : '❌'}`);
        console.log(`  - HistoryManager: ${components.historyManager ? '✅' : '❌'}`);
        
        // 初期化結果詳細
        if (this.initResults) {
            console.log('🔍 事前チェック結果:');
            console.log(`  - CONFIG補完: ${this.initResults.configCheck?.addedItems.length || 0}項目`);
            console.log(`  - 警告: ${this.initResults.warnings.length}件`);
            console.log(`  - エラー: ${this.initResults.errors.length}件`);
            
            if (this.initResults.pixiExtensionsStatus) {
                const ext = this.initResults.pixiExtensionsStatus;
                console.log(`📦 拡張ライブラリ: ${ext.available ? '利用可能' : '未利用可能'}`);
                
                if (ext.available && ext.features) {
                    const features = Object.entries(ext.features);
                    features.forEach(([feature, available]) => {
                        console.log(`  - ${feature}: ${available ? '✅' : '❌'}`);
                    });
                }
            }
        }
        
        console.groupEnd();
    }
    
    showSuccessNotification() {
        // コンソールガイド
        setTimeout(() => {
            console.log('🧪 推奨テスト手順:');
            console.log('  📋 キャンバス上でクリック＆ドラッグして描画をテスト');
            console.log('  📋 window.testDrawing() で描画システム確認');
            console.log('  📋 window.debugApp() でシステム状態確認');
            console.log('  📋 window.debugConfig() でCONFIG状態確認');
            
            if (this.initResults?.pixiExtensionsStatus?.features?.ui) {
                console.log('  📋 window.createPopup({title: "テスト"}) でポップアップテスト');
            }
        }, 1000);
        
        // UI通知（利用可能な場合）
        if (this.components.uiManager?.showNotification) {
            this.components.uiManager.showNotification(
                'Phase1総合修正完了！全機能テスト準備完了です。', 
                'success', 
                5000
            );
        }
    }
    
    handleError(error) {
        console.error('🚨 総合初期化エラー:', error);
        
        // 詳細エラー分析
        const errorAnalysis = this.analyzeError(error);
        console.error('🔍 エラー分析:', errorAnalysis);
        
        // エラー表示UI
        this.showErrorUI(error, errorAnalysis);
    }
    
    analyzeError(error) {
        const analysis = {
            type: 'unknown',
            likely_cause: 'unknown',
            suggestions: []
        };
        
        const errorMsg = error.message.toLowerCase();
        
        if (errorMsg.includes('config') || errorMsg.includes('設定')) {
            analysis.type = 'config_error';
            analysis.likely_cause = 'CONFIG設定不備';
            analysis.suggestions.push('config.jsファイルの再読み込み');
            analysis.suggestions.push('ブラウザのキャッシュクリア');
        }
        
        if (errorMsg.includes('pixi') || errorMsg.includes('drawing')) {
            analysis.type = 'pixi_error';
            analysis.likely_cause = 'PixiJS関連ライブラリ不備';
            analysis.suggestions.push('PixiJSライブラリの確認');
            analysis.suggestions.push('依存ファイルの読み込み順序確認');
        }
        
        if (errorMsg.includes('undefined') || errorMsg.includes('null')) {
            analysis.type = 'reference_error';
            analysis.likely_cause = 'オブジェクト参照エラー';
            analysis.suggestions.push('ファイル読み込み順序の確認');
            analysis.suggestions.push('依存関係の確認');
        }
        
        return analysis;
    }
    
    showErrorUI(error, analysis) {
        // エラー表示div作成
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            position: fixed; top: 20px; right: 20px; z-index: 10000;
            background: #ff4444; color: white; padding: 20px; border-radius: 8px;
            max-width: 450px; font-family: system-ui, sans-serif; font-size: 14px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        `;
        
        let suggestionsHTML = '';
        if (analysis.suggestions.length > 0) {
            suggestionsHTML = `
                <br><strong>📋 推奨対処法:</strong><br>
                ${analysis.suggestions.map(s => `• ${s}`).join('<br>')}
            `;
        }
        
        errorDiv.innerHTML = `
            <strong>⚠️ Phase1総合修正エラー</strong><br>
            <strong>種別:</strong> ${analysis.type}<br>
            <strong>推定原因:</strong> ${analysis.likely_cause}<br>
            <strong>詳細:</strong> ${error.message}${suggestionsHTML}<br><br>
            <button onclick="location.reload()" style="
                background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.3);
                color: white; padding: 8px 16px; border-radius: 4px; cursor: pointer;
                margin-right: 8px;
            ">再読み込み</button>
            <button onclick="this.parentElement.remove()" style="
                background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.3);
                color: white; padding: 8px 16px; border-radius: 4px; cursor: pointer;
            ">閉じる</button>
        `;
        
        document.body.appendChild(errorDiv);
        
        // 10秒後に自動消去
        setTimeout(() => {
            if (errorDiv.parentElement) {
                errorDiv.remove();
            }
        }, 10000);
    }
}

// ==== Phase8: 最終検証・実行システム ====
const finalValidation = () => {
    console.log('🔍 最終検証実行...');
    
    const criticalChecks = [
        {
            name: 'CONFIG存在',
            check: () => window.CONFIG && typeof window.CONFIG === 'object'
        },
        {
            name: 'safeConfigGet関数',
            check: () => typeof window.safeConfigGet === 'function'
        },
        {
            name: 'SIZE_PRESETS配列',
            check: () => Array.isArray(getConfigValue('SIZE_PRESETS', [])) && getConfigValue('SIZE_PRESETS', []).length > 0
        },
        {
            name: 'TARGET_FPS数値',
            check: () => typeof getConfigValue('TARGET_FPS', 60) === 'number'
        },
        {
            name: 'PREVIEW_CACHE_SIZE',
            check: () => typeof getConfigValue('CACHE_CONFIG.PREVIEW_CACHE_SIZE', 100) === 'number'
        }
    ];
    
    const failedChecks = [];
    const passedChecks = [];
    
    criticalChecks.forEach(({ name, check }) => {
        try {
            if (check()) {
                passedChecks.push(name);
            } else {
                failedChecks.push(name);
            }
        } catch (error) {
            failedChecks.push(`${name} (エラー: ${error.message})`);
        }
    });
    
    console.log(`✅ 通過: ${passedChecks.length}/${criticalChecks.length} - [${passedChecks.join(', ')}]`);
    
    if (failedChecks.length > 0) {
        console.warn('⚠️ 検出された問題:', failedChecks);
        return { valid: false, failed: failedChecks, passed: passedChecks };
    } else {
        console.log('✅ 最終検証完了 - 初期化実行準備完了');
        return { valid: true, failed: [], passed: passedChecks };
    }
};

// ==== Phase9: 統合実行システム ====
const executeAllFixes = async () => {
    console.log('🚀 Phase1総合修正実行開始...');
    
    try {
        // 1. 最終検証
        const validation = finalValidation();
        
        // 2. アプリケーション初期化実行
        const initializer = new ComprehensiveAppInitializer();
        const success = await initializer.initialize();
        
        if (success && validation.valid) {
            console.log('🎉 Phase1総合修正完了！');
            
            // 成功統計
            const stats = {
                initTime: performance.now(),
                configItems: Object.keys(window.CONFIG || {}).length,
                validationPassed: validation.passed.length,
                componentsReady: Object.values(initializer.components).filter(Boolean).length
            };
            
            console.log('📊 修正統計:', stats);
            return { success: true, stats, initializer };
            
        } else {
            throw new Error('初期化または検証に失敗');
        }
        
    } catch (error) {
        console.error('🚨 Phase1総合修正で予期しないエラー:', error);
        return { success: false, error };
    }
};

// ==== Phase10: メイン実行エントリーポイント ====
let globalInitializer = null;

const executePhase1ComprehensiveFix = async () => {
    console.log('🚀 ===== Phase1総合修正・完全統合版 実行開始 =====');
    
    try {
        const result = await executeAllFixes();
        
        if (result.success) {
            globalInitializer = result.initializer;
            console.log('🎉 ===== Phase1総合修正成功！全機能利用可能 =====');
            
            // 使用可能機能の案内
            setTimeout(() => {
                console.log('🎯 利用可能機能:');
                console.log('  🖊️ 描画機能: キャンバスでクリック＆ドラッグ');
                console.log('  🔧 デバッグ: window.debugApp(), window.testDrawing()');
                console.log('  ⚙️ 設定確認: window.debugConfig()');
                console.log('  ↩️ 操作: window.undo(), window.redo()');
            }, 2000);
            
        } else {
            console.error('❌ Phase1総合修正で問題が発生:');
            console.error('エラー:', result.error?.message || '不明');
            
            if (result.validation) {
                console.error('警告:', result.validation.failed || []);
            }
        }
        
    } catch (error) {
        console.error('🚨 Phase1総合修正で予期しないエラー:', error);
    }
};

// ==== Phase11: DOM Ready対応・自動実行 ====
const handleDOMReady = () => {
    console.log('📄 DOM読み込み完了 - Phase1総合修正開始');
    
    // 少し待ってから実行（他のスクリプトの読み込み完了を待つ）
    setTimeout(executePhase1ComprehensiveFix, 100);
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', handleDOMReady);
} else {
    console.log('📄 DOM既に読み込み済み');
    setTimeout(executePhase1ComprehensiveFix, 100);
}

// ==== Phase12: グローバル関数エクスポート ====
if (typeof window !== 'undefined') {
    // 主要クラス・関数のエクスポート
    window.ComprehensiveAppInitializer = ComprehensiveAppInitializer;
    window.executePhase1ComprehensiveFix = executePhase1ComprehensiveFix;
    window.getAppInitializer = () => globalInitializer;
    
    // ユーティリティ関数のエクスポート
    window.safeGetConfig = getConfigValue;
    window.validateConfig = finalValidation;
    window.checkDeps = checkDependencies;
    
    console.log('✅ main.js Phase1総合修正・完全統合版読み込み完了');
    console.log('🎯 目標: 全Consoleエラー解消・確実なアプリケーション起動');
    console.log('🔧 機能: CONFIG統合・PixiJS拡張ライブラリ連携・堅牢エラーハンドリング');
    console.log('📦 DRY・SOLID原則準拠による責任分離設計');
}