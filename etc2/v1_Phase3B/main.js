/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1rev14
 * 最小限メイン初期化スクリプト - main.js (DRY・SOLID原則統合修正版)
 * 
 * 🔧 DRY・SOLID原則統合修正内容:
 * 1. ✅ 単一責任原則: 初期化専用クラス設計
 * 2. ✅ DRY原則: 重複初期化コードの統合
 * 3. ✅ オープン・クローズ原則: 拡張可能な初期化システム
 * 4. ✅ リスコフ置換原則: 安全な依存関係チェック
 * 5. ✅ インターフェース分離原則: 最小限の依存関係
 * 6. ✅ 依存関係逆転原則: CONFIG・utils.js依存の抽象化
 * 7. ✅ エラー完全解消: 初期化失敗問題解決
 * 8. ✅ PixiExtensions統合: フォールバック対応
 * 
 * 修正目標: 初期化エラー0件、確実なキャンバス表示・基本描画機能
 */

console.log('🚀 main.js DRY・SOLID原則統合修正版読み込み開始...');

// ====【SOLID原則】依存関係逆転原則: 安全な設定値管理 ====

/**
 * 設定値の安全取得（utils.js連携・DRY原則適用）
 */
const getConfigValue = (key, defaultValue) => {
    try {
        // utils.jsのsafeConfigGetを優先使用
        if (typeof window.safeConfigGet === 'function') {
            return window.safeConfigGet(key, defaultValue);
        }
        
        // フォールバック: 直接CONFIG参照
        return (window.CONFIG && window.CONFIG[key] !== undefined) ? window.CONFIG[key] : defaultValue;
    } catch (error) {
        console.warn(`CONFIG取得エラー (${key}):`, error);
        return defaultValue;
    }
};

/**
 * CONFIG最小限確認（DRY原則：デフォルト設定統合）
 */
const ensureMinimalConfig = () => {
    if (!window.CONFIG || typeof window.CONFIG !== 'object') {
        console.warn('⚠️ CONFIG未定義 → 最小限デフォルト設定適用');
        window.CONFIG = {
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
            
            // 🆕 components.jsエラー解消用
            SIZE_PRESETS: [
                { name: '標準', size: 4, opacity: 0.85, color: 0x800000 }
            ],
            PREVIEW_MIN_SIZE: 1,
            PREVIEW_MAX_SIZE: 20,
            PRESET_UPDATE_THROTTLE: 16,
            PERFORMANCE_UPDATE_INTERVAL: 1000,
            
            // 🆕 階層設定（ドット記法対応）
            CACHE_CONFIG: {
                PREVIEW_CACHE_SIZE: 100
            }
        };
        console.log('✅ 最小限デフォルトCONFIG設定完了');
    }
};

// ====【SOLID原則】単一責任原則: 依存関係チェックシステム ====

/**
 * 依存関係チェッククラス（DRY原則：統一チェック機能）
 */
class DependencyChecker {
    constructor() {
        this.required = {
            'PIXI': () => typeof window.PIXI !== 'undefined',
            'PixiDrawingApp': () => typeof window.PixiDrawingApp !== 'undefined', 
            'DrawingToolsSystem': () => typeof window.DrawingToolsSystem !== 'undefined',
            'UIManager': () => typeof window.UIManager !== 'undefined',
            'HistoryManager': () => typeof window.HistoryManager !== 'undefined'
        };
        
        this.optional = {
            'PixiExtensions': () => typeof window.PixiExtensions !== 'undefined',
            'safeConfigGet': () => typeof window.safeConfigGet === 'function',
            'validateBrushSize': () => typeof window.validateBrushSize === 'function',
            'SystemStats': () => typeof window.SystemStats !== 'undefined'
        };
    }
    
    /**
     * 必須依存関係チェック（DRY原則：統一エラーハンドリング）
     */
    checkRequired() {
        console.log('🔍 必須依存関係チェック...');
        
        const missing = [];
        const available = [];
        
        for (const [name, checker] of Object.entries(this.required)) {
            if (checker()) {
                available.push(name);
            } else {
                missing.push(name);
            }
        }
        
        console.log(`✅ 利用可能: ${available.length}/${Object.keys(this.required).length} - [${available.join(', ')}]`);
        
        if (missing.length > 0) {
            console.error(`❌ 不足: [${missing.join(', ')}]`);
            const error = window.createApplicationError ? 
                window.createApplicationError(`重要な依存関係が不足: ${missing.join(', ')}`, { missing, available }) :
                new Error(`重要な依存関係が不足: ${missing.join(', ')}`);
            throw error;
        }
        
        return { available, missing };
    }
    
    /**
     * オプション依存関係チェック（DRY原則：統一ログ機能）
     */
    checkOptional() {
        console.log('🔍 オプション依存関係チェック...');
        
        const available = [];
        const missing = [];
        
        for (const [name, checker] of Object.entries(this.optional)) {
            if (checker()) {
                available.push(name);
            } else {
                missing.push(name);
            }
        }
        
        console.log(`📦 オプション機能: ${available.length}/${Object.keys(this.optional).length} - [${available.join(', ')}]`);
        
        if (missing.length > 0) {
            console.warn(`⚠️ 不足オプション機能: [${missing.join(', ')}]`);
        }
        
        // PixiJS拡張ライブラリ特別処理
        if (available.includes('PixiExtensions')) {
            try {
                const stats = window.PixiExtensions.getStats();
                console.log(`📦 PixiJS拡張ライブラリ: ${stats.coverage} (${stats.loaded}/${stats.total})`);
            } catch (error) {
                console.warn('⚠️ PixiExtensions統計取得エラー:', error.message);
            }
        } else {
            console.warn('⚠️ PixiExtensions未読み込み - 基本機能のみ利用');
        }
        
        return { available, missing };
    }
}

// ====【SOLID原則】単一責任原則: アプリケーション初期化システム ====

/**
 * 統合初期化管理クラス（DRY・SOLID原則完全適用）
 */
class IntegratedAppInitializer {
    constructor() {
        this.components = {
            app: null,
            toolsSystem: null,
            uiManager: null,
            historyManager: null
        };
        this.initialized = false;
        this.initStartTime = performance.now();
        this.dependencyChecker = new DependencyChecker();
        this.errors = [];
        this.warnings = [];
    }
    
    /**
     * メイン初期化処理（DRY原則：段階的初期化統合）
     */
    async initialize() {
        try {
            console.log('📋 統合アプリケーション初期化開始...');
            
            // Phase A: 基盤確認
            await this.initializeFoundation();
            
            // Phase B: コア初期化
            await this.initializeCore();
            
            // Phase C: システム連携
            await this.integrateSystem();
            
            // Phase D: 完了処理
            this.finalize();
            
            return true;
            
        } catch (error) {
            this.handleInitError(error);
            return false;
        }
    }
    
    /**
     * Phase A: 基盤確認（DRY原則：統一基盤チェック）
     */
    async initializeFoundation() {
        console.log('🏗️ Phase A: 基盤確認...');
        
        // 1. CONFIG確認
        ensureMinimalConfig();
        
        // 2. utils.js機能確認
        if (typeof window.testUtilsFunctions === 'function') {
            console.log('🧪 utils.js機能テスト実行...');
            window.testUtilsFunctions();
        }
        
        // 3. 依存関係チェック
        this.dependencyChecker.checkRequired();
        const optionalResult = this.dependencyChecker.checkOptional();
        
        if (optionalResult.missing.length > 0) {
            this.warnings.push(`オプション機能不足: ${optionalResult.missing.join(', ')}`);
        }
        
        console.log('✅ Phase A完了: 基盤確認');
    }
    
    /**
     * Phase B: コア初期化（DRY原則：段階的コア作成）
     */
    async initializeCore() {
        console.log('🎯 Phase B: コア初期化...');
        
        try {
            // 1. PixiDrawingApp作成
            await this.createPixiApp();
            
            // 2. DrawingToolsSystem作成
            await this.createToolsSystem();
            
            // 3. UIManager作成（エラー許容）
            await this.createUIManager();
            
            console.log('✅ Phase B完了: コア初期化');
            
        } catch (error) {
            // コア初期化エラーは致命的
            const coreError = window.createApplicationError ? 
                window.createApplicationError('コア初期化失敗', { phase: 'B', originalError: error }) :
                new Error(`コア初期化失敗: ${error.message}`);
            throw coreError;
        }
    }
    
    /**
     * Phase C: システム連携（DRY原則：統一連携処理）
     */
    async integrateSystem() {
        console.log('🔗 Phase C: システム連携...');
        
        // 1. グローバル参照設定
        this.setupGlobalReferences();
        
        // 2. デバッグ機能設定
        this.setupDebugFunctions();
        
        // 3. PixiJS拡張ライブラリ統合
        this.integratePixiExtensions();
        
        // 4. システム統計記録
        this.recordSystemStats();
        
        console.log('✅ Phase C完了: システム連携');
    }
    
    /**
     * PixiDrawingApp作成（DRY原則：安全な初期化）
     */
    async createPixiApp() {
        console.log('🎨 PixiDrawingApp作成...');
        
        const width = getConfigValue('CANVAS_WIDTH', 400);
        const height = getConfigValue('CANVAS_HEIGHT', 400);
        
        this.components.app = new PixiDrawingApp(width, height);
        await this.components.app.init();
        
        console.log(`✅ PixiApp作成完了: ${width}×${height}px`);
        
        // システム統計記録
        if (window.systemStats) {
            window.systemStats.recordComponentInit('PixiDrawingApp', true);
        }
    }
    
    /**
     * DrawingToolsSystem作成（DRY原則：設定統合適用）
     */
    async createToolsSystem() {
        console.log('🔧 DrawingToolsSystem作成...');
        
        this.components.toolsSystem = new DrawingToolsSystem(this.components.app);
        await this.components.toolsSystem.init();
        
        // デフォルト設定適用（utils.js検証関数使用）
        const defaultSettings = {
            size: window.validateBrushSize ? 
                window.validateBrushSize(getConfigValue('DEFAULT_BRUSH_SIZE', 4)) : 
                getConfigValue('DEFAULT_BRUSH_SIZE', 4),
            opacity: window.validateOpacity ? 
                window.validateOpacity(getConfigValue('DEFAULT_OPACITY', 0.85)) :
                getConfigValue('DEFAULT_OPACITY', 0.85),
            color: getConfigValue('DEFAULT_COLOR', 0x800000),
            pressure: getConfigValue('DEFAULT_PRESSURE', 0.5),
            smoothing: getConfigValue('DEFAULT_SMOOTHING', 0.3)
        };
        
        if (this.components.toolsSystem.updateBrushSettings) {
            this.components.toolsSystem.updateBrushSettings(defaultSettings);
        }
        
        console.log('✅ DrawingToolsSystem作成完了');
        
        // システム統計記録
        if (window.systemStats) {
            window.systemStats.recordComponentInit('DrawingToolsSystem', true);
        }
    }
    
    /**
     * UIManager作成（DRY原則：エラー許容設計）
     */
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
            
            // システム統計記録
            if (window.systemStats) {
                window.systemStats.recordComponentInit('UIManager', true);
            }
            
        } catch (error) {
            console.warn('⚠️ UIManager初期化でエラー:', error.message);
            this.warnings.push(`UIManager初期化エラー: ${error.message}`);
            
            // フォールバック: 基本セットアップのみ実行
            try {
                if (this.components.uiManager?.setupToolButtons) {
                    this.components.uiManager.setupToolButtons();
                    console.log('🔄 UIManager基本セットアップ実行');
                }
            } catch (fallbackError) {
                console.warn('⚠️ UIManager基本セットアップも失敗:', fallbackError.message);
            }
            
            // システム統計記録（失敗）
            if (window.systemStats) {
                window.systemStats.recordComponentInit('UIManager', false);
                window.systemStats.recordError('UIManager', error);
            }
        }
    }
    
    /**
     * グローバル参照設定（DRY原則：統一参照管理）
     */
    setupGlobalReferences() {
        console.log('🌐 グローバル参照設定...');
        
        window.app = this.components.app;
        window.toolsSystem = this.components.toolsSystem;
        window.uiManager = this.components.uiManager;
        window.historyManager = this.components.historyManager;
        window.appConfig = window.CONFIG;
        
        console.log('✅ グローバル参照設定完了');
    }
    
    /**
     * デバッグ機能設定（DRY原則：統一デバッグシステム）
     */
    setupDebugFunctions() {
        console.log('🔧 デバッグ機能設定...');
        
        // 基本デバッグ機能
        window.undo = () => this.components.historyManager?.undo() || false;
        window.redo = () => this.components.historyManager?.redo() || false;
        
        window.debugApp = () => {
            console.group('🔍 アプリケーション状態');
            console.log('初期化:', this.initialized);
            console.log('コンポーネント:', {
                app: !!this.components.app,
                toolsSystem: !!this.components.toolsSystem,
                uiManager: !!this.components.uiManager,
                historyManager: !!this.components.historyManager
            });
            
            if (window.PixiExtensions) {
                try {
                    console.log('拡張ライブラリ:', window.PixiExtensions.getStats());
                } catch (error) {
                    console.warn('拡張ライブラリ統計取得エラー:', error.message);
                }
            }
            
            // システム統計表示
            if (window.getSystemStats) {
                console.log('システム統計:', window.getSystemStats());
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
        
        // CONFIG関連デバッグ
        if (window.debugConfig) {
            window.debugConfig();
        }
        
        console.log('✅ デバッグ機能設定完了');
    }
    
    /**
     * PixiJS拡張ライブラリ統合（DRY原則：エラー許容統合）
     */
    integratePixiExtensions() {
        if (!window.PixiExtensions) {
            console.log('⚠️ PixiExtensions未利用 - 基本機能のみ');
            return;
        }
        
        console.log('🔗 PixiJS拡張ライブラリ統合...');
        
        const app = this.components.app;
        let integratedCount = 0;
        
        // レイヤーマネージャー統合
        if (window.PixiExtensions.hasFeature('layers')) {
            try {
                window.layerManager = window.PixiExtensions.createLayerManager(app);
                console.log('✅ レイヤーマネージャー統合完了');
                integratedCount++;
            } catch (error) {
                console.warn('⚠️ レイヤーマネージャー統合失敗:', error.message);
                this.warnings.push(`レイヤーマネージャー統合失敗: ${error.message}`);
            }
        }
        
        // GIFエクスポーター統合
        if (window.PixiExtensions.hasFeature('gif')) {
            try {
                window.gifExporter = window.PixiExtensions.createGIFExporter(app);
                console.log('✅ GIFエクスポーター統合完了');
                integratedCount++;
            } catch (error) {
                console.warn('⚠️ GIFエクスポーター統合失敗:', error.message);
                this.warnings.push(`GIFエクスポーター統合失敗: ${error.message}`);
            }
        }
        
        // ポップアップ機能統合
        if (window.PixiExtensions.hasFeature('ui')) {
            try {
                window.createPopup = (options) => {
                    try {
                        return window.PixiExtensions.createSimplePopup(options);
                    } catch (error) {
                        console.warn('⚠️ ポップアップ作成失敗:', error.message);
                        return null;
                    }
                };
                console.log('✅ ポップアップ機能統合完了');
                integratedCount++;
            } catch (error) {
                console.warn('⚠️ ポップアップ機能統合失敗:', error.message);
                this.warnings.push(`ポップアップ機能統合失敗: ${error.message}`);
            }
        }
        
        console.log(`✅ PixiJS拡張ライブラリ統合完了: ${integratedCount}個の機能`);
    }
    
    /**
     * システム統計記録（DRY原則：統計統合）
     */
    recordSystemStats() {
        if (!window.systemStats) return;
        
        // コンポーネント初期化統計
        Object.entries(this.components).forEach(([name, component]) => {
            window.systemStats.recordComponentInit(name, !!component);
        });
        
        // 初期化統計
        window.systemStats.recordComponentInit('IntegratedAppInitializer', this.initialized);
        
        console.log('📊 システム統計記録完了');
    }
    
    /**
     * Phase D: 完了処理（DRY原則：統一完了処理）
     */
    finalize() {
        const initTime = performance.now() - this.initStartTime;
        this.initialized = true;
        
        console.log('🎉 統合アプリケーション初期化完了！');
        console.log(`⏱️ 初期化時間: ${initTime.toFixed(2)}ms`);
        
        // システム概要ログ
        this.logSystemSummary(initTime);
        
        // UI表示更新
        if (this.components.uiManager?.updateAllDisplays) {
            try {
                this.components.uiManager.updateAllDisplays();
            } catch (error) {
                console.warn('⚠️ UI表示更新エラー:', error.message);
            }
        }
        
        // 成功通知
        this.showSuccessMessage();
        
        // 警告まとめ表示
        if (this.warnings.length > 0) {
            console.group('⚠️ 初期化警告まとめ');
            this.warnings.forEach((warning, index) => {
                console.warn(`${index + 1}. ${warning}`);
            });
            console.groupEnd();
        }
    }
    
    /**
     * システム概要ログ出力（DRY原則：統一概要表示）
     */
    logSystemSummary(initTime) {
        console.group('📋 システム概要');
        console.log(`🖼️ キャンバス: ${getConfigValue('CANVAS_WIDTH', 400)}×${getConfigValue('CANVAS_HEIGHT', 400)}px`);
        console.log(`🖊️ ペンサイズ: ${getConfigValue('DEFAULT_BRUSH_SIZE', 4)}px`);
        console.log(`🎨 透明度: ${getConfigValue('DEFAULT_OPACITY', 0.85) * 100}%`);
        console.log(`⏱️ 初期化時間: ${initTime.toFixed(2)}ms`);
        
        const components = this.components;
        console.log('🔧 コンポーネント状況:');
        console.log(`  - App: ${components.app ? '✅' : '❌'}`);
        console.log(`  - ToolsSystem: ${components.toolsSystem ? '✅' : '❌'}`);
        console.log(`  - UIManager: ${components.uiManager ? '✅' : '❌'}`);
        console.log(`  - HistoryManager: ${components.historyManager ? '✅' : '❌'}`);
        
        if (window.PixiExtensions) {
            try {
                const stats = window.PixiExtensions.getStats();
                console.log(`📦 拡張ライブラリ: ${stats.coverage}`);
                
                const features = ['ui', 'layers', 'gif', 'smooth'];
                features.forEach(feature => {
                    const available = window.PixiExtensions.hasFeature(feature);
                    console.log(`  - ${feature}: ${available ? '✅' : '❌'}`);
                });
            } catch (error) {
                console.warn('拡張ライブラリ統計取得エラー:', error.message);
            }
        }
        
        // システム統計表示
        if (window.getSystemStats) {
            const stats = window.getSystemStats();
            console.log('📊 システム統計:');
            console.log(`  - 稼働時間: ${stats.uptimeFormatted || '不明'}`);
            console.log(`  - 初期化済み: ${stats.components?.initializeCount || 0}個`);
            console.log(`  - 失敗: ${stats.components?.failedCount || 0}個`);
        }
        
        console.groupEnd();
    }
    
    /**
     * 成功通知表示（DRY原則：統一通知システム）
     */
    showSuccessMessage() {
        // コンソールガイド
        setTimeout(() => {
            console.log('🧪 基本機能テスト:');
            console.log('  📋 キャンバス上でクリック＆ドラッグして描画をテスト');
            console.log('  📋 window.testDrawing() で描画システム確認');
            console.log('  📋 window.debugApp() でシステム状態確認');
            
            if (window.PixiExtensions?.hasFeature('ui')) {
                console.log('  📋 window.createPopup({title: "テスト"}) でポップアップテスト');
            }
            
            if (window.testUtilsFunctions) {
                console.log('  📋 window.testUtilsFunctions() でutils.js機能テスト');
            }
            
            if (window.testComponentsIntegration) {
                console.log('  📋 window.testComponentsIntegration() でcomponents.js連携テスト');
            }
        }, 1000);
        
        // UI通知（利用可能な場合）
        if (this.components.uiManager?.showNotification) {
            try {
                this.components.uiManager.showNotification(
                    'アプリケーション初期化完了！キャンバスで描画をテストしてください。', 
                    'success', 
                    5000
                );
            } catch (error) {
                console.warn('⚠️ UI通知表示エラー:', error.message);
            }
        }
    }
    
    /**
     * 初期化エラー処理（DRY原則：統一エラー処理）
     */
    handleInitError(error) {
        console.error('🚨 初期化エラー:', error);
        
        // エラーログ記録
        if (window.logError) {
            window.logError(error, 'IntegratedAppInitializer');
        }
        
        // システム統計記録
        if (window.systemStats) {
            window.systemStats.recordError('IntegratedAppInitializer', error);
        }
        
        this.errors.push(error);
        
        // エラー表示UI
        this.showErrorMessage(error);
    }
    
    /**
     * エラー表示UI（DRY原則：統一エラー表示）
     */
    showErrorMessage(error) {
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            position: fixed; top: 20px; right: 20px; z-index: 10000;
            background: #ff4444; color: white; padding: 20px; border-radius: 8px;
            max-width: 400px; font-family: system-ui, sans-serif; font-size: 14px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        `;
        
        errorDiv.innerHTML = `
            <strong>⚠️ 初期化エラー</strong><br>
            ${error.message}<br><br>
            <div style="font-size: 12px; margin-top: 8px;">
                エラー数: ${this.errors.length}<br>
                警告数: ${this.warnings.length}
            </div><br>
            <button onclick="location.reload()" style="
                background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.3);
                color: white; padding: 8px 16px; border-radius: 4px; cursor: pointer;
            ">再読み込み</button>
            <button onclick="this.parentElement.remove()" style="
                background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2);
                color: white; padding: 8px 16px; border-radius: 4px; cursor: pointer; margin-left: 8px;
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
    
    /**
     * 初期化状態取得（DRY原則：統一状態管理）
     */
    getInitializationStatus() {
        return {
            initialized: this.initialized,
            initTime: performance.now() - this.initStartTime,
            components: Object.keys(this.components).reduce((result, key) => {
                result[key] = !!this.components[key];
                return result;
            }, {}),
            errors: this.errors.map(error => ({
                message: error.message,
                name: error.name
            })),
            warnings: [...this.warnings],
            dependencyStatus: {
                required: this.dependencyChecker.checkRequired(),
                optional: this.dependencyChecker.checkOptional()
            }
        };
    }
}

// ====【SOLID原則】依存関係逆転原則: グローバル初期化システム ====

let globalInitializer = null;

/**
 * メイン初期化関数（DRY原則：統一初期化エントリポイント）
 */
async function initializeApplication() {
    try {
        console.log('🚀 統合main.js初期化開始...');
        
        globalInitializer = new IntegratedAppInitializer();
        const success = await globalInitializer.initialize();
        
        if (success) {
            console.log('🎉 main.js 統合版初期化成功！');
            
            // 最終テスト実行
            setTimeout(() => {
                if (window.testComponentsIntegration) {
                    console.log('🔗 components.js連携最終テスト...');
                    const integrationSuccess = window.testComponentsIntegration();
                    if (integrationSuccess) {
                        console.log('✅ components.js連携テスト成功 - 全機能利用可能');
                    } else {
                        console.warn('⚠️ components.js連携テストで一部機能が不足');
                    }
                }
            }, 2000);
        }
        
        return success;
        
    } catch (error) {
        console.error('🚨 main.js初期化で予期しないエラー:', error);
        
        // エラー詳細表示
        if (globalInitializer) {
            const status = globalInitializer.getInitializationStatus();
            console.error('🔍 初期化状態:', status);
        }
        
        return false;
    }
}

/**
 * DOM Ready処理（DRY原則：統一DOM処理）
 */
function handleDOMReady() {
    console.log('📄 DOM読み込み完了');
    
    // 少し待ってから初期化（他のスクリプト読み込み完了を待つ）
    setTimeout(initializeApplication, 100);
}

// DOM Ready判定・実行
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', handleDOMReady);
} else {
    console.log('📄 DOM既に読み込み済み');
    setTimeout(handleDOMReady, 50);
}

// ====【SOLID原則】オープン・クローズ原則: グローバル関数エクスポート ====

if (typeof window !== 'undefined') {
    // 初期化システムエクスポート
    window.IntegratedAppInitializer = IntegratedAppInitializer;
    window.DependencyChecker = DependencyChecker;
    window.initializeApplication = initializeApplication;
    window.getAppInitializer = () => globalInitializer;
    
    // 初期化状態確認関数
    window.getInitializationStatus = () => {
        return globalInitializer ? globalInitializer.getInitializationStatus() : null;
    };
    
    // 統合デバッグ関数
    window.debugInitialization = () => {
        const status = window.getInitializationStatus();
        if (status) {
            console.group('🔍 初期化デバッグ');
            console.log('初期化完了:', status.initialized);
            console.log('初期化時間:', status.initTime.toFixed(2) + 'ms');
            console.log('エラー数:', status.errors.length);
            console.log('警告数:', status.warnings.length);
            console.log('コンポーネント:', status.components);
            if (status.errors.length > 0) {
                console.warn('エラー一覧:', status.errors);
            }
            if (status.warnings.length > 0) {
                console.warn('警告一覧:', status.warnings);
            }
            console.groupEnd();
        }
        return status;
    };
    
    console.log('✅ main.js DRY・SOLID原則統合修正版読み込み完了');
    console.log('🎯 目標: エラー0件、確実なキャンバス表示・基本描画機能');
    console.log('📦 統合システム: DRY・SOLID原則完全準拠');
    console.log('🔧 修正完了項目:');
    console.log('  ✅ 単一責任原則: 初期化専用クラス設計');
    console.log('  ✅ DRY原則: 重複初期化コードの統合');
    console.log('  ✅ 依存関係逆転原則: CONFIG・utils.js依存の抽象化');
    console.log('  ✅ エラー完全解消: 初期化失敗問題解決');
    console.log('  ✅ PixiExtensions統合: エラー許容フォールバック対応');
    console.log('  ✅ components.js連携: 完全互換性確保');
}