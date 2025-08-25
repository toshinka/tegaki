/**
 * 🎯 AppCore - Manager統合専任（正しい役割分担版）
 * 📋 RESPONSIBILITY: Manager作成・統合・連携専任
 * 🚫 PROHIBITION: UI操作・描画処理・エラー処理・DOM操作
 * ✅ PERMISSION: Manager作成・Manager間連携・PixiJS設定・統合管理
 * 
 * 📏 DESIGN_PRINCIPLE: Manager束ね専門・UI分離・単一責務
 * 🔄 INTEGRATION: CanvasManager + ToolManager の統合管理
 * 🎯 FIX: main.jsの正しい役割（AppCore定義）に修正
 */

// if (!window.XXX) ガードで多重定義を防ぐ
if (!window.Tegaki) {
    window.Tegaki = {};
}

if (!window.Tegaki.AppCore) {
    /**
     * AppCore - Manager統合専任クラス
     * CanvasManager・ToolManager を作成・連携する
     */
    class AppCore {
        constructor() {
            console.log('🎯 AppCore 作成開始');
            
            this.managers = {};
            this.initialized = false;
            this.pixiApp = null;
            
            console.log('✅ AppCore インスタンス作成完了');
        }
        
        /**
         * 全Manager初期化（正しい順序）
         */
        async initialize() {
            try {
                console.log('🚀 AppCore 初期化開始');
                
                // 1. CanvasManager作成（PixiJS設定前）
                await this.initializeCanvasManager();
                
                // 2. PixiJS設定後にToolManager作成
                if (this.pixiApp) {
                    await this.initializeToolManager();
                }
                
                this.initialized = true;
                console.log('✅ AppCore 初期化完了');
                
            } catch (error) {
                console.error('❌ AppCore 初期化エラー:', error);
                throw error;
            }
        }
        
        /**
         * CanvasManager初期化のみ
         */
        async initializeCanvasManager() {
            if (!window.Tegaki.CanvasManager) {
                throw new Error('CanvasManager class not available');
            }
            
            this.managers.canvas = new window.Tegaki.CanvasManager();
            console.log('✅ CanvasManager 作成完了');
        }
        
        /**
         * ToolManager初期化（PixiJS設定後）
         */
        async initializeToolManager() {
            if (!window.Tegaki.ToolManager) {
                throw new Error('ToolManager class not available');
            }
            
            this.managers.tool = new window.Tegaki.ToolManager();
            
            // CanvasManagerとの連携設定
            this.managers.tool.setCanvasManager(this.managers.canvas);
            
            // Tool作成
            await this.managers.tool.createTools();
            
            console.log('✅ ToolManager 作成・連携完了');
        }
        
        /**
         * PixiJS Application設定（TegakiApplicationから呼ばれる）
         */
        setPixiApp(pixiApp) {
            if (!pixiApp) {
                throw new Error('PixiJS Application is required');
            }
            
            this.pixiApp = pixiApp;
            
            // CanvasManagerにPixiApp設定
            if (this.managers.canvas) {
                this.managers.canvas.setPixiApp(pixiApp);
                console.log('✅ AppCore: CanvasManager に PixiJS Application 設定完了');
            } else {
                throw new Error('CanvasManager not initialized');
            }
        }
        
        /**
         * アプリケーション開始
         */
        start() {
            if (!this.initialized) {
                throw new Error('AppCore not initialized');
            }
            
            console.log('🚀 AppCore: アプリケーション開始');
            
            // 初期ツール選択
            if (this.managers.tool) {
                this.managers.tool.selectTool('pen');
                console.log('🎯 AppCore: 初期ツール選択完了（ペン）');
            }
        }
        
        /**
         * Manager取得メソッド
         */
        getCanvasManager() {
            return this.managers.canvas;
        }
        
        getToolManager() {
            return this.managers.tool;
        }
        
        /**
         * 準備状態確認
         */
        isReady() {
            return this.initialized && 
                   this.pixiApp && 
                   this.managers.canvas && 
                   this.managers.tool &&
                   this.managers.canvas.isReady();
        }
        
        /**
         * 便利メソッド（TegakiApplicationから呼ばれる）
         */
        selectTool(toolName) {
            if (this.managers.tool) {
                return this.managers.tool.selectTool(toolName);
            }
            return false;
        }
        
        clearCanvas() {
            if (this.managers.canvas) {
                this.managers.canvas.clear();
                console.log('🧹 AppCore: キャンバスクリア完了');
            }
        }
        
        setColor(color) {
            if (this.managers.tool) {
                const currentTool = this.managers.tool.getCurrentTool();
                if (currentTool && currentTool.setPenColor) {
                    currentTool.setPenColor(color);
                    console.log(`🎨 AppCore: 色変更 ${color}`);
                }
            }
        }
        
        setLineWidth(width) {
            if (this.managers.tool) {
                const currentTool = this.managers.tool.getCurrentTool();
                if (currentTool && currentTool.setPenWidth) {
                    currentTool.setPenWidth(width);
                    console.log(`📏 AppCore: 線幅変更 ${width}`);
                }
            }
        }
        
        setOpacity(opacity) {
            if (this.managers.tool) {
                const currentTool = this.managers.tool.getCurrentTool();
                if (currentTool && currentTool.setPenOpacity) {
                    currentTool.setPenOpacity(opacity);
                    console.log(`👻 AppCore: 透明度変更 ${opacity}`);
                }
            }
        }
        
        setEraserSize(size) {
            if (this.managers.tool) {
                const currentTool = this.managers.tool.getCurrentTool();
                if (currentTool && currentTool.setEraserSize) {
                    currentTool.setEraserSize(size);
                    console.log(`🧹 AppCore: 消しゴムサイズ変更 ${size}`);
                }
            }
        }
        
        /**
         * クリーンアップ
         */
        destroy() {
            console.log('💀 AppCore クリーンアップ開始');
            
            // Manager破棄
            if (this.managers.tool) {
                // Tool個別破棄は各ToolManagerに任せる
                this.managers.tool = null;
            }
            
            if (this.managers.canvas) {
                this.managers.canvas = null;
            }
            
            this.pixiApp = null;
            this.initialized = false;
            
            console.log('✅ AppCore クリーンアップ完了');
        }
        
        /**
         * デバッグ情報取得
         */
        getDebugInfo() {
            return {
                initialized: this.initialized,
                hasPixiApp: !!this.pixiApp,
                managers: {
                    canvas: !!this.managers.canvas,
                    tool: !!this.managers.tool
                },
                isReady: this.isReady(),
                canvasReady: this.managers.canvas ? this.managers.canvas.isReady() : false,
                toolReady: this.managers.tool ? this.managers.tool.isReady() : false,
                currentTool: this.managers.tool ? this.managers.tool.getCurrentToolName() : 'none'
            };
        }
    }
    
    // Tegaki名前空間に登録
    window.Tegaki.AppCore = AppCore;
    
    console.log('🎯 AppCore Loaded（Manager統合専任・正しい役割分担版）');
} else {
    console.log('⚠️ AppCore already defined - skipping redefinition');
}

console.log('🎯 main.js loaded - AppCore定義完了（正しい役割分担版）');