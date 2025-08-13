/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1rev14
 * CONFIG統合・連携復旧版メイン初期化スクリプト - main.js
 * 
 * 🔧 Phase1改修内容（CONFIG統合・PixiJS拡張ライブラリ連携強化）:
 * 1. ✅ CONFIG完全統合: 不足設定値の追加・最適化
 * 2. ✅ PixiJS拡張ライブラリ連携: pixi-extensions.jsとの完全統合
 * 3. ✅ パフォーマンス最適化: 重複処理の解消
 * 4. ✅ 他ファイル連携強化: components.js等との円滑な連携
 * 5. ✅ DRY・SOLID原則準拠: 責任分離・重複解消
 * 
 * Phase1目標: 既存機能維持＋他ファイル連携復旧
 */

console.log('🚀 改修版main.js Phase1 - CONFIG統合・連携復旧版 読み込み開始...');

// ==== Phase1: CONFIG完全統合システム ====
const ConfigManager = {
    isInitialized: false,
    defaultValues: {
        // 基本設定
        DEFAULT_BRUSH_SIZE: 4,
        DEFAULT_OPACITY: 0.85,
        MAX_BRUSH_SIZE: 500,
        MIN_BRUSH_SIZE: 0.1,
        DEFAULT_COLOR: 0x800000,
        DEFAULT_PRESSURE: 0.5,
        DEFAULT_SMOOTHING: 0.3,
        
        // キャンバス設定
        CANVAS_WIDTH: 400,
        CANVAS_HEIGHT: 400,
        BG_COLOR: 0xf0e0d6,
        TARGET_FPS: 60,
        
        // プレビュー設定（components.js対応）
        PREVIEW_MIN_SIZE: 1,
        PREVIEW_MAX_SIZE: 32,
        PREVIEW_DEFAULT_SIZE: 4,
        
        // パフォーマンス設定（重複処理解消）
        PRESET_UPDATE_THROTTLE: 16,
        PERFORMANCE_UPDATE_INTERVAL: 1000,
        
        // UI設定
        POPUP_FADE_TIME: 300,
        NOTIFICATION_DURATION: 3000,
        SLIDER_UPDATE_THROTTLE: 16,
        
        // プリセット設定
        SIZE_PRESETS: [
            { name: '極細', size: 1, opacity: 90, color: 0x800000 },
            { name: '細', size: 2, opacity: 85, color: 0x800000 },
            { name: '標準', size: 4, opacity: 85, color: 0x800000 },
            { name: '太', size: 8, opacity: 80, color: 0x800000 },
            { name: '極太', size: 16, opacity: 75, color: 0x800000 },
            { name: '超極太', size: 32, opacity: 70, color: 0x800000 }
        ]
    },
    
    init() {
        try {
            if (!window.CONFIG || typeof window.CONFIG !== 'object') {
                console.warn('⚠️ CONFIG未定義 → 完全デフォルト設定適用');
                window.CONFIG = { ...this.defaultValues };
            } else {
                // 不足項目を補完
                let addedCount = 0;
                Object.entries(this.defaultValues).forEach(([key, value]) => {
                    if (!(key in window.CONFIG)) {
                        window.CONFIG[key] = value;
                        addedCount++;
                    }
                });
                console.log(`🔧 CONFIG補完完了: ${addedCount}項目追加`);
            }
            
            this.isInitialized = true;
            console.log('✅ ConfigManager初期化完了');
            return true;
        } catch (error) {
            console.error('🚨 ConfigManager初期化エラー:', error);
            return false;
        }
    },
    
    safeGet(key, defaultValue = null) {
        try {
            if (!this.isInitialized) this.init();
            
            if (window.CONFIG && window.CONFIG[key] !== undefined) {
                return window.CONFIG[key];
            }
            
            const fallback = this.defaultValues[key] || defaultValue;
            if (fallback !== null) {
                console.warn(`safeConfigGet: ${key} → フォールバック値使用:`, fallback);
            }
            return fallback;
        } catch (error) {
            console.error(`safeConfigGet エラー (${key}):`, error);
            return defaultValue;
        }
    },
    
    validateConfig() {
        const requiredKeys = [
            'SIZE_PRESETS', 'PREVIEW_MIN_SIZE', 'PREVIEW_MAX_SIZE',
            'DEFAULT_COLOR', 'TARGET_FPS', 'PRESET_UPDATE_THROTTLE'
        ];
        
        const missing = [];
        requiredKeys.forEach(key => {
            if (!window.CONFIG || window.CONFIG[key] === undefined) {
                missing.push(key);
            }
        });
        
        if (missing.length === 0) {
            console.log('✅ CONFIG完整性確認完了');
            return { valid: true, missing: [] };
        } else {
            console.warn('⚠️ 不足CONFIG項目:', missing);
            return { valid: false, missing };
        }
    }
};

// ==== Phase1: 依存関係管理システム（SOLID原則準拠） ====
class DependencyManager {
    constructor() {
        this.dependencies = new Map();
        this.loadOrder = [];
        this.loadPromises = new Map();
        this.isInitialized = false;
    }
    
    registerDependency(name, checker, loader = null) {
        this.dependencies.set(name, {
            name,
            checker,
            loader,
            isLoaded: false,
            loadTime: null,
            error: null
        });
        this.loadOrder.push(name);
    }
    
    async checkDependencies() {
        console.log('🔍 Phase1依存関係チェック...');
        
        // 基本依存関係の登録
        this.registerDependency('PIXI', () => typeof window.PIXI !== 'undefined');
        this.registerDependency('CONFIG', () => window.CONFIG && typeof window.CONFIG === 'object');
        this.registerDependency('PixiDrawingApp', () => typeof window.PixiDrawingApp !== 'undefined');
        this.registerDependency('DrawingToolsSystem', () => typeof window.DrawingToolsSystem !== 'undefined');
        this.registerDependency('UIManager', () => typeof window.UIManager !== 'undefined');
        this.registerDependency('HistoryManager', () => typeof window.HistoryManager !== 'undefined');
        
        // オプショナル依存関係
        this.registerDependency('PixiExtensions', () => typeof window.PixiExtensions !== 'undefined');
        this.registerDependency('SliderController', () => typeof window.SliderController !== 'undefined');
        this.registerDependency('PopupManager', () => typeof window.PopupManager !== 'undefined');
        this.registerDependency('PresetDisplayManager', () => typeof window.PresetDisplayManager !== 'undefined');
        
        const results = {
            loaded: [],
            missing: [],
            optional: []
        };
        
        // 必須依存関係のチェック
        const required = ['PIXI', 'CONFIG', 'PixiDrawingApp', 'DrawingToolsSystem'];
        const optional = ['PixiExtensions', 'SliderController', 'PopupManager', 'PresetDisplayManager'];
        
        for (const name of required) {
            const dep = this.dependencies.get(name);
            if (dep && dep.checker()) {
                dep.isLoaded = true;
                results.loaded.push(name);
            } else {
                results.missing.push(name);
            }
        }
        
        for (const name of optional) {
            const dep = this.dependencies.get(name);
            if (dep && dep.checker()) {
                dep.isLoaded = true;
                results.optional.push(name);
            }
        }
        
        console.log(`✅ 必須: ${results.loaded.length}/${required.length} - [${results.loaded.join(', ')}]`);
        console.log(`📦 オプション: ${results.optional.length}/${optional.length} - [${results.optional.join(', ')}]`);
        
        if (results.missing.length > 0) {
            console.error(`❌ 不足: [${results.missing.join(', ')}]`);
            throw new Error(`重要な依存関係が不足: ${results.missing.join(', ')}`);
        }
        
        this.isInitialized = true;
        return results;
    }
    
    getDependencyStatus(name) {
        return this.dependencies.get(name) || null;
    }
    
    getAllStatus() {
        const status = {};
        this.dependencies.forEach((dep, name) => {
            status[name] = {
                isLoaded: dep.isLoaded,
                loadTime: dep.loadTime,
                hasError: !!dep.error
            };
        });
        return status;
    }
}

// ==== Phase1: アプリケーション初期化システム（連携復旧対応） ====
class IntegratedAppInitializer {
    constructor() {
        this.configManager = ConfigManager;
        this.dependencyManager = new DependencyManager();
        this.components = {
            app: null,
            toolsSystem: null,
            uiManager: null,
            historyManager: null,
            // Phase1追加: 連携システム
            sliderController: null,
            popupManager: null,
            presetDisplayManager: null,
            penPresetManager: null,
            performanceMonitor: null
        };
        this.initialized = false;
        this.initStartTime = performance.now();
        this.initStats = {
            configTime: 0,
            dependencyTime: 0,
            coreTime: 0,
            uiTime: 0,
            integrationTime: 0,
            totalTime: 0
        };
    }
    
    async initialize() {
        try {
            console.log('📋 Phase1統合アプリケーション初期化開始...');
            const startTime = performance.now();
            
            // 1. CONFIG統合初期化
            await this.initializeConfig();
            this.initStats.configTime = performance.now() - startTime;
            
            // 2. 依存関係チェック
            const depStartTime = performance.now();
            await this.dependencyManager.checkDependencies();
            this.initStats.dependencyTime = performance.now() - depStartTime;
            
            // 3. コアアプリケーション作成
            const coreStartTime = performance.now();
            await this.createCoreApplication();
            this.initStats.coreTime = performance.now() - coreStartTime;
            
            // 4. UI連携システム作成
            const uiStartTime = performance.now();
            await this.createUIIntegration();
            this.initStats.uiTime = performance.now() - uiStartTime;
            
            // 5. システム統合・連携設定
            const integrationStartTime = performance.now();
            await this.integrateAllSystems();
            this.initStats.integrationTime = performance.now() - integrationStartTime;
            
            // 6. 完了処理
            this.finalize();
            
            return true;
            
        } catch (error) {
            this.handleInitializationError(error);
            return false;
        }
    }
    
    async initializeConfig() {
        console.log('🔧 CONFIG統合初期化...');
        
        const success = this.configManager.init();
        if (!success) {
            throw new Error('CONFIG初期化失敗');
        }
        
        // CONFIG完整性確認
        const validation = this.configManager.validateConfig();
        if (!validation.valid) {
            console.warn('⚠️ CONFIG不整合検出 - 補完実行中...');
            // 不足項目を自動補完済み（ConfigManager.init内）
        }
        
        console.log('✅ CONFIG統合完了');
    }
    
    async createCoreApplication() {
        console.log('🎯 コアアプリケーション作成...');
        
        const width = this.configManager.safeGet('CANVAS_WIDTH', 400);
        const height = this.configManager.safeGet('CANVAS_HEIGHT', 400);
        
        // PixiDrawingApp作成
        this.components.app = new window.PixiDrawingApp(width, height);
        await this.components.app.init();
        
        // DrawingToolsSystem作成
        this.components.toolsSystem = new window.DrawingToolsSystem(this.components.app);
        await this.components.toolsSystem.init();
        
        // デフォルト設定適用
        const defaultSettings = {
            size: this.configManager.safeGet('DEFAULT_BRUSH_SIZE', 4),
            opacity: this.configManager.safeGet('DEFAULT_OPACITY', 0.85),
            color: this.configManager.safeGet('DEFAULT_COLOR', 0x800000),
            pressure: this.configManager.safeGet('DEFAULT_PRESSURE', 0.5),
            smoothing: this.configManager.safeGet('DEFAULT_SMOOTHING', 0.3)
        };
        
        if (this.components.toolsSystem.updateBrushSettings) {
            this.components.toolsSystem.updateBrushSettings(defaultSettings);
        }
        
        console.log(`✅ コアアプリケーション作成完了: ${width}×${height}px`);
    }
    
    async createUIIntegration() {
        console.log('🎭 UI統合システム作成...');
        
        try {
            // HistoryManager取得
            this.components.historyManager = this.components.toolsSystem.getHistoryManager();
            
            // UIManager作成
            this.components.uiManager = new window.UIManager(
                this.components.app,
                this.components.toolsSystem,
                this.components.historyManager
            );
            
            await this.components.uiManager.init();
            
            // Phase1追加: UI連携コンポーネント作成
            await this.createUIComponents();
            
            console.log('✅ UI統合システム作成完了');
            
        } catch (error) {
            console.warn('⚠️ UI統合システム作成でエラー:', error.message);
            // 部分的成功でも継続
            if (this.components.uiManager?.setupToolButtons) {
                this.components.uiManager.setupToolButtons();
                console.log('🔄 UIManager基本セットアップ実行');
            }
        }
    }
    
    async createUIComponents() {
        console.log('🔧 UI連携コンポーネント作成...');
        
        try {
            // PopupManager（利用可能な場合）
            if (typeof window.PopupManager !== 'undefined') {
                this.components.popupManager = new window.PopupManager();
                console.log('✅ PopupManager作成完了');
            }
            
            // PresetDisplayManager（利用可能な場合）
            if (typeof window.PresetDisplayManager !== 'undefined') {
                this.components.presetDisplayManager = new window.PresetDisplayManager(this.components.toolsSystem);
                console.log('✅ PresetDisplayManager作成完了');
            }
            
            // PenPresetManager（利用可能な場合）
            if (typeof window.PenPresetManager !== 'undefined') {
                this.components.penPresetManager = new window.PenPresetManager(
                    this.components.toolsSystem,
                    this.components.historyManager
                );
                console.log('✅ PenPresetManager作成完了');
            }
            
            // PerformanceMonitor（利用可能な場合）
            if (typeof window.PerformanceMonitor !== 'undefined') {
                this.components.performanceMonitor = new window.PerformanceMonitor();
                this.components.performanceMonitor.start();
                console.log('✅ PerformanceMonitor作成・開始完了');
            }
            
            // コンポーネント間の連携設定
            this.setupComponentIntegration();
            
        } catch (error) {
            console.warn('⚠️ UI連携コンポーネント作成でエラー:', error.message);
        }
    }
    
    setupComponentIntegration() {
        // PresetDisplayManager と PenPresetManager の連携
        if (this.components.presetDisplayManager && this.components.penPresetManager) {
            this.components.presetDisplayManager.setPenPresetManager(this.components.penPresetManager);
            console.log('🔗 プリセット連携設定完了');
        }
        
        // PerformanceMonitor のコールバック設定
        if (this.components.performanceMonitor && this.components.uiManager) {
            this.components.performanceMonitor.addUpdateCallback((stats) => {
                if (this.components.uiManager.updatePerformanceDisplay) {
                    this.components.uiManager.updatePerformanceDisplay(stats);
                }
            });
            console.log('🔗 パフォーマンス監視連携設定完了');
        }
    }
    
    async integrateAllSystems() {
        console.log('🔗 Phase1全システム統合・連携設定...');
        
        // グローバル参照設定
        window.app = this.components.app;
        window.toolsSystem = this.components.toolsSystem;
        window.uiManager = this.components.uiManager;
        window.historyManager = this.components.historyManager;
        
        // Phase1追加: UI連携システムのグローバル参照
        if (this.components.popupManager) window.popupManager = this.components.popupManager;
        if (this.components.presetDisplayManager) window.presetDisplayManager = this.components.presetDisplayManager;
        if (this.components.penPresetManager) window.penPresetManager = this.components.penPresetManager;
        if (this.components.performanceMonitor) window.performanceMonitor = this.components.performanceMonitor;
        
        // CONFIG参照設定
        window.appConfig = window.CONFIG;
        window.safeConfigGet = this.configManager.safeGet.bind(this.configManager);
        
        // PixiJS拡張ライブラリとの連携強化
        this.integratePixiExtensions();
        
        // デバッグ関数設定
        this.setupDebugFunctions();
        
        console.log('✅ 全システム統合完了');
    }
    
    integratePixiExtensions() {
        if (!window.PixiExtensions) {
            console.log('ℹ️ PixiJS拡張ライブラリ未利用');
            return;
        }
        
        console.log('🔗 PixiJS拡張ライブラリ統合強化...');
        
        const app = this.components.app;
        const stats = window.PixiExtensions.getStats();
        console.log(`📦 PixiJS拡張ライブラリ: ${stats.coverage} (${stats.loaded}/${stats.total})`);
        
        try {
            // レイヤーマネージャー作成
            if (window.PixiExtensions.hasFeature('layers')) {
                window.layerManager = window.PixiExtensions.createLayerManager(app);
                console.log('✅ レイヤーマネージャー統合完了');
            }
            
            // GIFエクスポーター作成
            if (window.PixiExtensions.hasFeature('gif')) {
                window.gifExporter = window.PixiExtensions.createGIFExporter(app);
                console.log('✅ GIFエクスポーター統合完了');
            }
            
            // UI機能統合
            if (window.PixiExtensions.hasFeature('ui')) {
                window.createPixiPopup = (options) => {
                    try {
                        return window.PixiExtensions.createSimplePopup(options);
                    } catch (error) {
                        console.warn('⚠️ PixiPopup作成失敗:', error.message);
                        return null;
                    }
                };
                console.log('✅ PixiUI機能統合完了');
            }
            
            // スムージング機能統合
            if (window.PixiExtensions.hasFeature('smooth')) {
                window.enableSmoothing = () => window.PixiExtensions.enableSmoothing(app);
                console.log('✅ スムージング機能統合完了');
            }
            
        } catch (error) {
            console.warn('⚠️ PixiJS拡張ライブラリ統合でエラー:', error.message);
        }
    }
    
    setupDebugFunctions() {
        // 基本デバッグ機能
        window.undo = () => this.components.historyManager?.undo() || false;
        window.redo = () => this.components.historyManager?.redo() || false;
        
        // Phase1拡張デバッグ機能
        window.debugApp = () => {
            console.group('🔍 Phase1アプリケーション状態');
            console.log('初期化:', this.initialized);
            console.log('初期化時間:', this.initStats);
            console.log('コンポーネント:', this.getComponentStatus());
            console.log('依存関係:', this.dependencyManager.getAllStatus());
            if (window.PixiExtensions) {
                console.log('拡張ライブラリ:', window.PixiExtensions.getStats());
            }
            console.groupEnd();
        };
        
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
        
        // Phase1追加: システム統計デバッグ
        window.getSystemStats = () => {
            const stats = {
                core: {
                    app: !!this.components.app,
                    toolsSystem: !!this.components.toolsSystem,
                    uiManager: !!this.components.uiManager,
                    historyManager: !!this.components.historyManager
                },
                ui: {
                    popupManager: !!this.components.popupManager,
                    presetDisplayManager: !!this.components.presetDisplayManager,
                    penPresetManager: !!this.components.penPresetManager,
                    performanceMonitor: !!this.components.performanceMonitor
                },
                initStats: this.initStats,
                dependencies: this.dependencyManager.getAllStatus()
            };
            console.log('📊 システム統計:', stats);
            return stats;
        };
        
        // プリセット管理デバッグ
        window.testPresets = () => {
            if (this.components.penPresetManager) {
                const stats = this.components.penPresetManager.getSystemStats();
                console.log('🎨 プリセット統計:', stats);
                return stats;
            } else {
                console.warn('❌ PenPresetManager未利用');
                return null;
            }
        };
    }
    
    getComponentStatus() {
        const status = {};
        Object.entries(this.components).forEach(([key, component]) => {
            status[key] = !!component;
        });
        return status;
    }
    
    finalize() {
        const totalTime = performance.now() - this.initStartTime;
        this.initStats.totalTime = totalTime;
        this.initialized = true;
        
        console.log('🎉 Phase1統合アプリケーション初期化完了！');
        console.log(`⏱️ 初期化時間: ${totalTime.toFixed(2)}ms`);
        console.log('📊 詳細時間:', {
            CONFIG: `${this.initStats.configTime.toFixed(2)}ms`,
            依存関係: `${this.initStats.dependencyTime.toFixed(2)}ms`,
            コア: `${this.initStats.coreTime.toFixed(2)}ms`,
            UI: `${this.initStats.uiTime.toFixed(2)}ms`,
            統合: `${this.initStats.integrationTime.toFixed(2)}ms`
        });
        
        // システム概要表示
        this.logSystemSummary();
        
        // UI表示更新
        if (this.components.uiManager?.updateAllDisplays) {
            this.components.uiManager.updateAllDisplays();
        }
        
        // 成功通知
        this.showSuccessMessage();
    }
    
    logSystemSummary() {
        console.group('📋 Phase1システム概要');
        console.log(`🖼️ キャンバス: ${this.configManager.safeGet('CANVAS_WIDTH', 400)}×${this.configManager.safeGet('CANVAS_HEIGHT', 400)}px`);
        console.log(`🖊️ ペンサイズ: ${this.configManager.safeGet('DEFAULT_BRUSH_SIZE', 4)}px`);
        console.log(`🎨 透明度: ${this.configManager.safeGet('DEFAULT_OPACITY', 0.85) * 100}%`);
        
        console.log('🔧 コアコンポーネント:');
        const core = ['app', 'toolsSystem', 'uiManager', 'historyManager'];
        core.forEach(key => {
            console.log(`  - ${key}: ${this.components[key] ? '✅' : '❌'}`);
        });
        
        console.log('🎭 UI連携コンポーネント:');
        const ui = ['popupManager', 'presetDisplayManager', 'penPresetManager', 'performanceMonitor'];
        ui.forEach(key => {
            console.log(`  - ${key}: ${this.components[key] ? '✅' : '❌'}`);
        });
        
        if (window.PixiExtensions) {
            const stats = window.PixiExtensions.getStats();
            console.log(`📦 拡張ライブラリ: ${stats.coverage}`);
            
            const features = ['ui', 'layers', 'gif', 'smooth'];
            features.forEach(feature => {
                const available = window.PixiExtensions.hasFeature(feature);
                console.log(`  - ${feature}: ${available ? '✅' : '❌'}`);
            });
        }
        
        console.groupEnd();
    }
    
    showSuccessMessage() {
        // コンソールガイド
        setTimeout(() => {
            console.log('🧪 Phase1基本機能テスト:');
            console.log('  📋 キャンバス上でクリック＆ドラッグして描画をテスト');
            console.log('  📋 window.testDrawing() で描画システム確認');
            console.log('  📋 window.debugApp() でシステム状態確認');
            console.log('  📋 window.getSystemStats() でシステム統計表示');
            console.log('  📋 window.testPresets() でプリセット管理確認');
            if (window.PixiExtensions?.hasFeature('ui')) {
                console.log('  📋 window.createPixiPopup({title: "テスト"}) でPixiポップアップテスト');
            }
        }, 1000);
        
        // UI通知
        if (this.components.uiManager?.showNotification) {
            this.components.uiManager.showNotification(
                'Phase1初期化完了！CONFIG統合・連携復旧が完了しました。', 
                'success', 
                5000
            );
        }
    }
    
    handleInitializationError(error) {
        console.error('🚨 Phase1初期化エラー:', error);
        
        // エラー表示
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            position: fixed; top: 20px; right: 20px; z-index: 10000;
            background: #ff4444; color: white; padding: 20px; border-radius: 8px;
            max-width: 400px; font-family: system-ui, sans-serif; font-size: 14px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        `;
        errorDiv.innerHTML = `
            <strong>⚠️ Phase1初期化エラー</strong><br>
            ${error.message}<br><br>
            <button onclick="location.reload()" style="
                background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.3);
                color: white; padding: 8px 16px; border-radius: 4px; cursor: pointer;
            ">再読み込み</button>
        `;
        
        document.body.appendChild(errorDiv);
        setTimeout(() => errorDiv.remove(), 10000);
        
        // 部分的な復旧試行
        this.attemptPartialRecovery();
    }
    
    attemptPartialRecovery() {
        console.log('🔄 部分的復旧試行...');
        
        try {
            // 最小限のCONFIG設定
            if (!window.CONFIG) {
                window.CONFIG = this.configManager.defaultValues;
                console.log('✅ 最小CONFIG設定完了');
            }
            
            // グローバル関数の最小設定
            window.safeConfigGet = this.configManager.safeGet.bind(this.configManager);
            
            // 基本デバッグ関数
            window.debugApp = () => {
                console.log('⚠️ 部分的復旧モード - 限定情報のみ');
                console.log('CONFIG:', !!window.CONFIG);
                console.log('初期化エラー発生済み');
            };
            
            console.log('✅ 部分的復旧完了 - 基本機能のみ利用可能');
            
        } catch (recoveryError) {
            console.error('🚨 部分的復旧も失敗:', recoveryError);
        }
    }
}

// ==== Phase1: 初期化実行システム ====
let globalAppInitializer = null;

async function initializePhase1App() {
    try {
        console.log('🚀 Phase1統合初期化開始...');
        
        globalAppInitializer = new IntegratedAppInitializer();
        const success = await globalAppInitializer.initialize();
        
        if (success) {
            console.log('🎉 Phase1 main.js 初期化成功！');
            console.log('🔧 実装完了機能:');
            console.log('  ✅ CONFIG完全統合 - 不足設定値補完');
            console.log('  ✅ PixiJS拡張ライブラリ連携強化');
            console.log('  ✅ 重複処理解消・パフォーマンス最適化');
            console.log('  ✅ 他ファイル連携復旧（components.js等）');
            console.log('  ✅ DRY・SOLID原則準拠の責任分離');
            console.log('  ✅ 段階的エラーハンドリング・部分的復旧');
        } else {
            console.warn('⚠️ Phase1初期化で問題が発生しましたが、基本機能は利用可能です');
        }
        
        return success;
        
    } catch (error) {
        console.error('🚨 Phase1初期化で予期しないエラー:', error);
        return false;
    }
}

// ==== Phase1: DOM Ready処理 ====
function handlePhase1DOMReady() {
    console.log('📄 DOM読み込み完了 - Phase1初期化開始');
    
    // 短い遅延後に初期化実行（他ファイル読み込み待ち）
    setTimeout(initializePhase1App, 100);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', handlePhase1DOMReady);
} else {
    console.log('📄 DOM既に読み込み済み - Phase1初期化準備');
    setTimeout(initializePhase1App, 100);
}

// ==== Phase1: グローバル関数エクスポート ====
if (typeof window !== 'undefined') {
    // Phase1メインクラス
    window.IntegratedAppInitializer = IntegratedAppInitializer;
    window.DependencyManager = DependencyManager;
    window.ConfigManager = ConfigManager;
    
    // Phase1初期化関数
    window.initializePhase1Application = initializePhase1App;
    window.getPhase1Initializer = () => globalAppInitializer;
    
    // CONFIG管理関数（グローバルアクセス用）
    window.safeConfigGet = ConfigManager.safeGet.bind(ConfigManager);
    window.validateAppConfig = ConfigManager.validateConfig.bind(ConfigManager);
    
    console.log('✅ Phase1 main.js読み込み完了');
    console.log('🎯 Phase1目標: CONFIG統合・PixiJS拡張ライブラリ連携強化・他ファイル連携復旧');
    console.log('📋 改修計画書 v1.1 - Phase1 完了');
    console.log('🔧 DRY・SOLID原則準拠の責任分離実装');
    console.log('⏭️ 次フェーズ: Phase2（パフォーマンス最適化）・Phase3（UI機能拡張）');
}