/**
 * 🎨 Main.js - AppCoreクラス定義・構文エラー修正版
 * 📋 RESPONSIBILITY: AppCoreクラス定義・TegakiApplicationのインスタンス化・Manager束ね
 * 🚫 PROHIBITION: TegakiApplicationクラス定義・複雑な初期化・エラー隠蔽
 * ✅ PERMISSION: AppCoreクラス定義・Manager管理・例外throw
 * 
 * 📏 DESIGN_PRINCIPLE: 計画書準拠・責任分離・構文エラー撲滅
 * 🔄 INTEGRATION: app-core.jsのTegakiApplicationから呼び出される
 */

// if (!window.AppCore) ガードで多重定義を防ぐ
if (!window.AppCore) {
    
    /**
     * AppCore - main.js版（計画書準拠）
     * 役割: TegakiApplicationをインスタンス化しManagerを束ねる
     */
    class AppCore {
        constructor() {
            console.log('🎯 AppCore - main.js版作成');
            
            this.initialized = false;
            this.canvasManager = null;
            this.toolManager = null;
        }
        
        /**
         * 基本Manager初期化（計画書準拠）
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
         * アプリケーション開始
         */
        start() {
            if (!this.isReady()) {
                throw new Error('AppCore not ready');
            }
            
            console.log('🚀 AppCore アプリケーション開始');
            
            // 基本機能確認
            this.performBasicChecks();
            
            console.log('✅ AppCore アプリケーション開始完了');
        }
        
        /**
         * 基本機能確認
         */
        performBasicChecks() {
            console.log('🔧 基本機能確認開始...');
            
            // CanvasManager確認
            if (!this.canvasManager || !this.canvasManager.initialized) {
                throw new Error('CanvasManager not properly initialized');
            }
            
            // ToolManager確認
            if (!this.toolManager) {
                throw new Error('ToolManager not available');
            }
            
            // 現在のツール確認
            const currentTool = this.toolManager.getCurrentTool();
            if (!currentTool) {
                console.warn('⚠️ No current tool selected');
            } else {
                console.log(`✅ 現在のツール: ${this.toolManager.getCurrentToolName()}`);
            }
            
            console.log('✅ 基本機能確認完了');
        }
        
        /**
         * エラー処理（構文エラー修正含む）
         */
        handleError(error, context = '') {
            console.error(`❌ AppCore Error${context ? ' (' + context + ')' : ''}:`, error);
            
            // ErrorManager経由でエラー表示
            if (window.Tegaki?.ErrorManagerInstance) {
                window.Tegaki.ErrorManagerInstance.showError('error', 
                    `AppCore Error: ${error.message}`, 
                    { context: context }
                );
            }
            
            // エラーを隠蔽せずに再throw
            throw error;
        }
        
        /**
         * クリーンアップ
         */
        destroy() {
            console.log('🧹 AppCore クリーンアップ開始...');
            
            // Manager参照クリア
            this.canvasManager = null;
            this.toolManager = null;
            this.initialized = false;
            
            console.log('✅ AppCore クリーンアップ完了');
        }
        
        /**
         * デバッグ情報取得
         */
        getDebugInfo() {
            return {
                initialized: this.initialized,
                canvasManager: !!this.canvasManager,
                toolManager: !!this.toolManager,
                ready: this.isReady(),
                currentTool: this.toolManager?.getCurrentToolName() || 'none'
            };
        }
    }
    
    // window.AppCore に一意に登録
    window.AppCore = AppCore;
    
    // Tegaki名前空間にも登録
    if (!window.Tegaki) {
        window.Tegaki = {};
    }
    window.Tegaki.AppCore = AppCore;
    
    console.log('✅ AppCore クラス定義完了 - main.js版');
    
    // 構文エラー修正確認用ログ（行192付近のエラー対応）
    console.log('🔧 main.js 構文チェック: 全括弧正常終了確認');
} else {
    console.log('⚠️ AppCore already defined - skipping redefinition');
}

console.log('🎨 main.js loaded - AppCore定義・構文エラー修正完了');