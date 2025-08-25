/**
 * 🎯 AppCore Simple - シンプル初期化フロー
 * 📋 RESPONSIBILITY: Manager作成と最小限の連携のみ
 * 🚫 PROHIBITION: 複雑な段階制御・診断機能・エラー処理
 * ✅ PERMISSION: Manager作成・インスタンス登録・例外throw
 * 
 * 📏 DESIGN_PRINCIPLE: 単純・直線的・初期化専門
 * 🔄 INTEGRATION: main.jsから呼び出される最小限の初期化
 */

// Tegaki名前空間初期化
window.Tegaki = window.Tegaki || {};

/**
 * AppCore - シンプル版（20行以内）
 * アプリケーション初期化の専任
 */
class AppCore {
    constructor() {
        console.log('🎯 AppCore Simple 作成');
        
        this.initialized = false;
        this.canvasManager = null;
        this.toolManager = null;
    }
    
    /**
     * 基本Manager初期化（シンプル版）
     */
    async initialize() {
        console.log('🔧 AppCore 初期化開始...');
        
        // CanvasManager作成
        if (window.Tegaki?.CanvasManager) {
            this.canvasManager = new window.Tegaki.CanvasManager();
            window.Tegaki.CanvasManagerInstance = this.canvasManager;
            console.log('✅ CanvasManager作成完了');
        } else {
            throw new Error('CanvasManager class not available');
        }
        
        // ToolManager作成
        if (window.Tegaki?.ToolManager) {
            this.toolManager = new window.Tegaki.ToolManager();
            window.Tegaki.ToolManagerInstance = this.toolManager;
            console.log('✅ ToolManager作成完了');
        } else {
            throw new Error('ToolManager class not available');
        }
        
        // ToolManagerにCanvasManagerを設定
        if (this.toolManager && this.canvasManager) {
            this.toolManager.setCanvasManager(this.canvasManager);
            console.log('✅ Manager間連携完了');
        }
        
        this.initialized = true;
        console.log('✅ AppCore 初期化完了');
        
        return true;
    }
    
    /**
     * PixiJS Application設定
     */
    setPixiApp(pixiApp) {
        if (!pixiApp) {
            throw new Error('PixiJS Application is required');
        }
        
        // CanvasManagerにPixiApp設定
        if (this.canvasManager) {
            this.canvasManager.setPixiApp(pixiApp);
            console.log('✅ AppCore - PixiApp設定完了');
        } else {
            throw new Error('CanvasManager not available');
        }
    }
    
    /**
     * 初期化状態確認
     */
    isReady() {
        return this.initialized && this.canvasManager && this.toolManager;
    }
    
    /**
     * Manager取得
     */
    getCanvasManager() {
        return this.canvasManager;
    }
    
    getToolManager() {
        return this.toolManager;
    }
    
    /**
     * クリーンアップ
     */
    destroy() {
        this.canvasManager = null;
        this.toolManager = null;
        this.initialized = false;
        console.log('🧹 AppCore クリーンアップ完了');
    }
}

// Tegaki名前空間に登録
window.Tegaki.AppCore = AppCore;

console.log('🎯 AppCore Simple Loaded - 最小限初期化フロー');