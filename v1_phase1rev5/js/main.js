/**
 * 🖊️ AppCore - Manager束ね専任（main.js版）
 * 📋 RESPONSIBILITY: Manager作成・Manager間連携のみ
 * 🚫 PROHIBITION: UI操作・描画処理・エラー処理・PixiJS Application作成
 * ✅ PERMISSION: Manager作成・連携設定・初期化制御・便利メソッド
 * 
 * 📏 DESIGN_PRINCIPLE: Manager統合専門・シンプル・直線的
 * 🔄 INTEGRATION: CanvasManager + ToolManager の統合管理
 */

// if (!window.XXX) ガードで多重定義を防ぐ
if (!window.Tegaki) {
    window.Tegaki = {};
}

if (!window.Tegaki.AppCore) {
    /**
     * AppCore - Manager束ね専任版
     * CanvasManager + ToolManager の統合管理のみ
     */
    class AppCore {
        constructor() {
            console.log('🖊️ AppCore - Manager束ね版作成');
            
            this.initialized = false;
            this.canvasManager = null;
            this.toolManager = null;
        }
        
        /**
         * 初期化（Manager作成・連携設定）
         */
        async initialize() {
            try {
                console.log('🚀 AppCore 初期化開始');
                
                // 1. CanvasManager作成
                await this.initializeCanvasManager();
                
                // 2. ToolManager作成・連携設定
                await this.initializeToolManager();
                
                // 3. 初期化完了
                this.initialized = true;
                console.log('✅ AppCore 初期化完了');
                
                return true;
                
            } catch (error) {
                console.error('❌ AppCore初期化エラー:', error);
                throw error;
            }
        }
        
        /**
         * CanvasManager初期化
         */
        async initializeCanvasManager() {
            if (!window.Tegaki.CanvasManager) {
                throw new Error('CanvasManager class not available');
            }
            
            this.canvasManager = new window.Tegaki.CanvasManager();
            
            // グローバル参照作成（デバッグ用）
            window.Tegaki.CanvasManagerInstance = this.canvasManager;
            
            console.log('✅ CanvasManager 作成完了');
        }
        
        /**
         * ToolManager初期化
         */
        async initializeToolManager() {
            if (!window.Tegaki.ToolManager) {
                throw new Error('ToolManager class not available');
            }
            
            this.toolManager = new window.Tegaki.ToolManager();
            
            // 依存関係設定
            this.toolManager.setCanvasManager(this.canvasManager);
            
            // グローバル参照作成（デバッグ用）
            window.Tegaki.ToolManagerInstance = this.toolManager;
            
            console.log('✅ ToolManager 作成・連携完了');
        }
        
        /**
         * PixiJS Application設定
         */
        setPixiApp(pixiApp) {
            if (!pixiApp) {
                throw new Error('PixiJS Application is required');
            }
            
            if (!this.canvasManager) {
                throw new Error('CanvasManager not initialized');
            }
            
            // CanvasManagerにPixiApp設定
            this.canvasManager.setPixiApp(pixiApp);
            
            console.log('✅ AppCore - PixiApp設定完了');
        }
        
        /**
         * CanvasManager取得
         */
        getCanvasManager() {
            return this.canvasManager;
        }
        
        /**
         * ToolManager取得
         */
        getToolManager() {
            return this.toolManager;
        }
        
        /**
         * 準備状態確認
         */
        isReady() {
            return this.initialized && 
                   !!this.canvasManager && 
                   this.canvasManager.isReady() &&
                   !!this.toolManager &&
                   this.toolManager.isReady();
        }
        
        /**
         * アプリケーション開始
         */
        start() {
            if (!this.isReady()) {
                throw new Error('AppCore not ready for start');
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
            console.log('🔍 AppCore - 基本機能確認開始');
            
            const checks = {
                canvasManagerReady: this.canvasManager?.isReady() || false,
                toolManagerReady: this.toolManager?.isReady() || false,
                pixiAppSet: !!this.canvasManager?.getPixiApp(),
                layersCreated: (this.canvasManager?.layers?.size || 0) > 0,
                toolsCreated: (this.toolManager?.tools?.size || 0) > 0
            };
            
            console.log('🔍 基本機能確認結果:', checks);
            
            const allChecksPass = Object.values(checks).every(check => check === true);
            
            if (allChecksPass) {
                console.log('✅ 全基本機能確認完了');
            } else {
                console.warn('⚠️ 一部基本機能に問題があります');
            }
            
            return checks;
        }
        
        /**
         * ツール選択（便利メソッド）
         */
        selectTool(toolName) {
            return this.toolManager?.selectTool(toolName) || false;
        }
        
        /**
         * キャンバスクリア（便利メソッド）
         */
        clearCanvas() {
            if (this.canvasManager) {
                this.canvasManager.clear();
                return true;
            }
            return false;
        }
        
        /**
         * 色変更（便利メソッド）
         */
        setColor(color) {
            const currentTool = this.toolManager?.getCurrentTool();
            if (currentTool && currentTool.setPenColor) {
                currentTool.setPenColor(color);
                return true;
            }
            return false;
        }
        
        /**
         * 線幅変更（便利メソッド）
         */
        setLineWidth(width) {
            const currentTool = this.toolManager?.getCurrentTool();
            if (currentTool && currentTool.setPenWidth) {
                currentTool.setPenWidth(width);
                return true;
            }
            return false;
        }
        
        /**
         * 透明度変更（便利メソッド）
         */
        setOpacity(opacity) {
            const currentTool = this.toolManager?.getCurrentTool();
            if (currentTool && currentTool.setPenOpacity) {
                currentTool.setPenOpacity(opacity);
                return true;
            } else if (currentTool && currentTool.setEraserOpacity) {
                currentTool.setEraserOpacity(opacity);
                return true;
            }
            return false;
        }
        
        /**
         * 消しゴムサイズ変更（便利メソッド）
         */
        setEraserSize(size) {
            const currentTool = this.toolManager?.getCurrentTool();
            if (currentTool && currentTool.setEraserSize) {
                currentTool.setEraserSize(size);
                return true;
            }
            return false;
        }
        
        /**
         * クリーンアップ
         */
        destroy() {
            console.log('🧹 AppCore - クリーンアップ開始');
            
            // 参照クリア
            this.canvasManager = null;
            this.toolManager = null;
            this.initialized = false;
            
            console.log('✅ AppCore - クリーンアップ完了');
        }
        
        /**
         * デバッグ情報取得
         */
        getDebugInfo() {
            return {
                initialized: this.initialized,
                ready: this.isReady(),
                canvasManager: this.canvasManager?.getDebugInfo() || null,
                toolManager: this.toolManager?.getDebugInfo() || null
            };
        }
    }
    
    // Tegaki名前空間に登録
    window.Tegaki.AppCore = AppCore;
    
    console.log('🖊️ AppCore Manager束ね版 Loaded');
} else {
    console.log('⚠️ AppCore already defined - skipping redefinition');
}

console.log('🖊️ main.js loaded - Manager束ね専任完了');