/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1rev17
 * 最小限メイン初期化スクリプト - main.js (PixiJS拡張ライブラリ活用版)
 * 
 * 🔧 改修コンセプト:
 * 1. ✅ 最小限設計: キャンバス表示に特化
 * 2. ✅ ライブラリ活用: pixi-extensions.jsの機能を最大活用
 * 3. ✅ エラー解消: クラス重複問題完全解決
 * 4. ✅ 責任分離: UI機能はpixi-extensions.jsに移譲
 * 5. ✅ 高速初期化: 最小限の処理で安定動作保証
 * 
 * Phase2目標: 確実なキャンバス表示・基本描画機能 
 */

console.log('🚀 最小限main.js - PixiJS拡張ライブラリ活用版 読み込み開始...');

// ==== 設定値管理 (CONFIG依存最小化) ====
const getConfigValue = (key, defaultValue) => {
    try {
        return (window.CONFIG && window.CONFIG[key] !== undefined) ? window.CONFIG[key] : defaultValue;
    } catch (error) {
        console.warn(`CONFIG取得エラー (${key}):`, error);
        return defaultValue;
    }
};

const ensureConfig = () => {
    if (!window.CONFIG || typeof window.CONFIG !== 'object') {
        console.warn('⚠️ CONFIG未定義 → デフォルト設定適用');
        window.CONFIG = {
            DEFAULT_BRUSH_SIZE: 4,
            DEFAULT_OPACITY: 1.0,
            MAX_BRUSH_SIZE: 500,
            MIN_BRUSH_SIZE: 0.1,
            DEFAULT_COLOR: 0x800000,
            CANVAS_WIDTH: 400,
            CANVAS_HEIGHT: 400,
            BG_COLOR: 0xf0e0d6,
            TARGET_FPS: 60,
            DEFAULT_PRESSURE: 0.5,
            DEFAULT_SMOOTHING: 0.3
        };
        console.log('✅ デフォルトCONFIG設定完了');
    }
};

// ==== 依存関係チェック ====
const checkDependencies = () => {
    console.log('🔍 依存関係チェック...');
    
    const required = {
        'PIXI': () => typeof window.PIXI !== 'undefined',
        'PixiDrawingApp': () => typeof window.PixiDrawingApp !== 'undefined', 
        'DrawingToolsSystem': () => typeof window.DrawingToolsSystem !== 'undefined',
        'UIManager': () => typeof window.UIManager !== 'undefined',
        'HistoryManager': () => typeof window.HistoryManager !== 'undefined'
    };
    
    const missing = [];
    const available = [];
    
    for (const [name, checker] of Object.entries(required)) {
        if (checker()) {
            available.push(name);
        } else {
            missing.push(name);
        }
    }
    
    console.log(`✅ 利用可能: ${available.length}/${Object.keys(required).length} - [${available.join(', ')}]`);
    
    if (missing.length > 0) {
        console.error(`❌ 不足: [${missing.join(', ')}]`);
        throw new Error(`重要な依存関係が不足: ${missing.join(', ')}`);
    }
    
    // PixiJS拡張ライブラリチェック
    if (typeof window.PixiExtensions !== 'undefined') {
        const stats = window.PixiExtensions.getStats();
        console.log(`📦 PixiJS拡張ライブラリ: ${stats.coverage} (${stats.loaded}/${stats.total})`);
    } else {
        console.warn('⚠️ PixiJS拡張ライブラリが利用できません');
    }
    
    return true;
};

// ==== アプリケーション初期化 ====
class MinimalAppInitializer {
    constructor() {
        this.components = {
            app: null,
            toolsSystem: null,
            uiManager: null,
            historyManager: null
        };
        this.initialized = false;
        this.initStartTime = performance.now();
    }
    
    async initialize() {
        try {
            console.log('📋 最小限アプリケーション初期化開始...');
            
            // 1. CONFIG確認
            ensureConfig();
            
            // 2. 依存関係チェック
            checkDependencies();
            
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
            opacity: getConfigValue('DEFAULT_OPACITY', 1.0),
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
        
        this.components.historyManager = this.components.toolsSystem.getHistoryManager();
        this.components.uiManager = new window.UIManager(
            this.components.app, 
            this.components.toolsSystem, 
            this.components.historyManager
        );
        
        try {
            await this.components.uiManager.init();
            console.log('✅ UIManager初期化完了');
        } catch (error) {
            console.warn('⚠️ UIManager初期化でエラー:', error.message);
            if (this.components.uiManager.setupToolButtons) {
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
        
        // 基本デバッグ関数
        this.setupDebugFunctions();
        
        // PixiJS拡張ライブラリとの連携
        this.integrateWithExtensions();
        
        console.log('✅ システム連携完了');
    }
    
    setupDebugFunctions() {
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
    }
    
    integrateWithExtensions() {
        if (!window.PixiExtensions) return;
        
        console.log('🔗 PixiJS拡張ライブラリ統合...');
        
        const app = this.components.app;
        
        // レイヤーマネージャー作成（利用可能な場合）
        if (window.PixiExtensions.hasFeature('layers')) {
            try {
                window.layerManager = window.PixiExtensions.createLayerManager(app);
                console.log('✅ レイヤーマネージャー統合完了');
            } catch (error) {
                console.warn('⚠️ レイヤーマネージャー統合失敗:', error.message);
            }
        }
        
        // GIFエクスポーター作成（利用可能な場合）
        if (window.PixiExtensions.hasFeature('gif')) {
            try {
                window.gifExporter = window.PixiExtensions.createGIFExporter(app);
                console.log('✅ GIFエクスポーター統合完了');
            } catch (error) {
                console.warn('⚠️ GIFエクスポーター統合失敗:', error.message);
            }
        }
        
        // ポップアップ機能統合（利用可能な場合）
        if (window.PixiExtensions.hasFeature('ui')) {
            window.createPopup = (options) => {
                try {
                    return window.PixiExtensions.createSimplePopup(options);
                } catch (error) {
                    console.warn('⚠️ ポップアップ作成失敗:', error.message);
                    return null;
                }
            };
            console.log('✅ ポップアップ機能統合完了');
        }
    }
    
    finalize() {
        const initTime = performance.now() - this.initStartTime;
        this.initialized = true;
        
        console.log('🎉 最小限アプリケーション初期化完了！');
        console.log(`⏱️ 初期化時間: ${initTime.toFixed(2)}ms`);
        
        // システム概要
        this.logSystemSummary();
        
        // UI表示更新
        if (this.components.uiManager?.updateAllDisplays) {
            this.components.uiManager.updateAllDisplays();
        }
        
        // 成功通知
        this.showSuccessMessage();
    }
    
    logSystemSummary() {
        console.group('📋 システム概要');
        console.log(`🖼️ キャンバス: ${getConfigValue('CANVAS_WIDTH', 400)}×${getConfigValue('CANVAS_HEIGHT', 400)}px`);
        console.log(`🖊️ ペンサイズ: ${getConfigValue('DEFAULT_BRUSH_SIZE', 4)}px`);
        console.log(`🎨 透明度: ${getConfigValue('DEFAULT_OPACITY', 1.0) * 100}%`);
        
        const components = this.components;
        console.log('🔧 コンポーネント状況:');
        console.log(`  - App: ${components.app ? '✅' : '❌'}`);
        console.log(`  - ToolsSystem: ${components.toolsSystem ? '✅' : '❌'}`);
        console.log(`  - UIManager: ${components.uiManager ? '✅' : '❌'}`);
        console.log(`  - HistoryManager: ${components.historyManager ? '✅' : '❌'}`);
        
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
            console.log('🧪 基本機能テスト:');
            console.log('  📋 キャンバス上でクリック＆ドラッグして描画をテスト');
            console.log('  📋 window.testDrawing() で描画システム確認');
            console.log('  📋 window.debugApp() でシステム状態確認');
            if (window.PixiExtensions?.hasFeature('ui')) {
                console.log('  📋 window.createPopup({title: "テスト"}) でポップアップテスト');
            }
        }, 1000);
        
        // UI通知（利用可能な場合）
        if (this.components.uiManager?.showNotification) {
            this.components.uiManager.showNotification(
                'アプリケーション初期化完了！キャンバスで描画をテストしてください。', 
                'success', 
                5000
            );
        }
    }
    
    handleError(error) {
        console.error('🚨 初期化エラー:', error);
        
        // エラー表示
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
            <button onclick="location.reload()" style="
                background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.3);
                color: white; padding: 8px 16px; border-radius: 4px; cursor: pointer;
            ">再読み込み</button>
        `;
        
        document.body.appendChild(errorDiv);
        
        // 3秒後に自動消去
        setTimeout(() => errorDiv.remove(), 8000);
    }
}

// ==== 初期化実行 ====
let globalInitializer = null;

async function initializeApp() {
    try {
        console.log('🚀 最小限main.js初期化開始...');
        
        globalInitializer = new MinimalAppInitializer();
        const success = await globalInitializer.initialize();
        
        if (success) {
            console.log('🎉 main.js 最小限版初期化成功！');
        }
        
        return success;
    } catch (error) {
        console.error('🚨 main.js初期化で予期しないエラー:', error);
        return false;
    }
}

// ==== DOM Ready ====
function handleDOMReady() {
    console.log('📄 DOM読み込み完了');
    setTimeout(initializeApp, 50);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', handleDOMReady);
} else {
    console.log('📄 DOM既に読み込み済み');
    setTimeout(initializeApp, 50);
}

// ==== グローバル関数エクスポート ====
if (typeof window !== 'undefined') {
    window.MinimalAppInitializer = MinimalAppInitializer;
    window.initializeApplication = initializeApp;
    window.getAppInitializer = () => globalInitializer;
    
    console.log('✅ 最小限main.js読み込み完了');
    console.log('🎯 目標: 確実なキャンバス表示・基本描画機能');
    console.log('📦 PixiJS拡張ライブラリ活用でUI機能強化');
}