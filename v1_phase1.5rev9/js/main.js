/**
 * 🎯 AppCore - Manager束ね専任（基盤システム）- ToolManager初期化修正版
 * 📋 RESPONSIBILITY: Manager作成・Manager間連携・システム統合
 * 🚫 PROHIBITION: UI操作・描画処理・エラー処理・直接DOM操作・フォールバック・フェイルセーフ
 * ✅ PERMISSION: CanvasManager作成・ToolManager作成・設定連携
 * 
 * 📏 DESIGN_PRINCIPLE: Manager統合専門・システム基盤・シンプル・正しい構造でのみ動作
 * 🔄 INTEGRATION: CanvasManager + ToolManager の統合管理
 * 🔧 FIX: CanvasManager → PixiJS設定 → ToolManager の正しい順序・初期化判定修正
 */

// if (!window.XXX) ガードで多重定義を防ぐ
if (!window.Tegaki) {
    window.Tegaki = {};
}

if (!window.Tegaki.AppCore) {
    /**
     * AppCore - Manager統合システム
     * CanvasManager と ToolManager の作成・連携を管理する基盤クラス
     */
    class AppCore {
        constructor() {
            console.log('🎯 AppCore 基盤システム作成（ToolManager初期化修正版）');
            
            this.canvasManager = null;
            this.toolManager = null;
            this.pixiApp = null;
            
            this.initialized = false;
            this.ready = false;
        }
        
        /**
         * CanvasManager初期化（単体）
         */
        async initializeCanvasManager() {
            if (!window.Tegaki.CanvasManager) {
                throw new Error('CanvasManager class not available');
            }
            
            this.canvasManager = new window.Tegaki.CanvasManager();
            
            console.log('✅ CanvasManager 作成完了');
        }
        
        /**
         * PixiJS Application設定（CanvasManagerに転送）
         */
        setPixiApp(pixiApp) {
            if (!pixiApp) {
                throw new Error('PixiJS Application is required');
            }
            
            if (!this.canvasManager) {
                throw new Error('CanvasManager not initialized');
            }
            
            this.pixiApp = pixiApp;
            
            // CanvasManagerに設定（レイヤー構造も作成される）
            this.canvasManager.setPixiApp(pixiApp);
            
            // レイヤー作成確認
            this.verifyLayerStructure();
            
            console.log('✅ AppCore - PixiJS Application設定・レイヤー確認完了');
        }
        
        /**
         * レイヤー構造確認（重要：ToolManager初期化前に実行）
         */
        verifyLayerStructure() {
            if (!this.canvasManager) {
                throw new Error('CanvasManager not available');
            }
            
            // レイヤー存在確認
            const layer0 = this.canvasManager.getLayer('layer0');
            const layer1 = this.canvasManager.getLayer('layer1');
            
            if (!layer0) {
                throw new Error('Background layer (layer0) not created');
            }
            
            if (!layer1) {
                throw new Error('Drawing layer (layer1) not created');
            }
            
            console.log('✅ レイヤー構造確認完了:', {
                layer0: !!layer0,
                layer1: !!layer1,
                activeLayer: this.canvasManager.getActiveLayerId()
            });
        }
        
        /**
         * ToolManager初期化（PixiJS・レイヤー設定後）- Phase1.5 Manager統合修正版
         */
        async initializeToolManager() {
            if (!this.canvasManager) {
                throw new Error('CanvasManager not initialized');
            }
            
            if (!this.canvasManager.isReady()) {
                throw new Error('CanvasManager not ready');
            }
            
            if (!window.Tegaki.ToolManager) {
                throw new Error('ToolManager class not available');
            }
            
            console.log('🔧 ToolManager初期化開始（Phase1.5 Manager統合修正版）...');
            
            this.toolManager = new window.Tegaki.ToolManager();
            
            // CanvasManager設定（レイヤー確認も実行される）
            this.toolManager.setCanvasManager(this.canvasManager);
            console.log('✅ ToolManager - CanvasManager設定完了');
            
            // 🔧 修正：Phase1.5 Manager群設定はapp-coreで実行されるため、
            // ここではツール作成のみ実行する（二重作成を避けるため）
            console.log('🔧 ToolManager基本設定完了 - Phase1.5 Manager統合はapp-coreで実行予定');
            
            // 🔧 修正：初期化判定を詳細に実行
            if (!this.verifyToolManagerBasicInitialization()) {
                throw new Error('ToolManager basic initialization failed');
            }
            
            this.initialized = true;
            console.log('✅ ToolManager 基本初期化完了（Phase1.5 Manager統合修正版）');
        }
        
        /**
         * 🔧 修正：ToolManager基本初期化確認（Phase1.5対応版）
         */
        verifyToolManagerBasicInitialization() {
            console.log('🔍 ToolManager基本初期化確認開始...');
            
            // 基本状態確認
            if (!this.toolManager) {
                console.error('❌ ToolManager インスタンス未作成');
                return false;
            }
            
            // CanvasManager接続確認
            if (!this.toolManager.canvasManager) {
                console.error('❌ ToolManager - CanvasManager未接続');
                return false;
            }
            
            console.log('✅ ToolManager基本初期化確認完了');
            return true;
        }
        
        /**
         * アプリケーション開始（全初期化完了後）
         */
        start() {
            if (!this.initialized) {
                throw new Error('AppCore not fully initialized');
            }
            
            this.ready = true;
            
            console.log('✅ AppCore システム開始完了');
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
         * 初期化状態確認（修正版）
         */
        isReady() {
            // 基本コンポーネント確認
            if (!this.ready || !this.canvasManager || !this.toolManager) {
                return false;
            }
            
            // CanvasManager確認
            if (!this.canvasManager.isReady()) {
                return false;
            }
            
            // ToolManager確認（修正版：より柔軟な判定）
            if (!this.toolManager.initialized) {
                return false;
            }
            
            // ツール存在確認
            const availableTools = this.toolManager.getAvailableTools();
            if (!availableTools || availableTools.length === 0) {
                return false;
            }
            
            // 現在ツール確認
            if (!this.toolManager.getCurrentTool()) {
                return false;
            }
            
            return true;
        }
        
        /**
         * 便利メソッド：ツール選択
         */
        selectTool(toolName) {
            if (!this.toolManager) {
                console.warn('⚠️ ToolManager not available');
                return false;
            }
            
            return this.toolManager.selectTool(toolName);
        }
        
        /**
         * 便利メソッド：キャンバスクリア
         */
        clearCanvas() {
            if (!this.canvasManager) {
                console.warn('⚠️ CanvasManager not available');
                return;
            }
            
            this.canvasManager.clear();
        }
        
        /**
         * 便利メソッド：色変更
         */
        setColor(color) {
            const currentTool = this.toolManager?.getCurrentTool();
            if (currentTool && currentTool.setPenColor) {
                currentTool.setPenColor(color);
            }
        }
        
        /**
         * 便利メソッド：線幅変更
         */
        setLineWidth(width) {
            const currentTool = this.toolManager?.getCurrentTool();
            if (currentTool && currentTool.setPenWidth) {
                currentTool.setPenWidth(width);
            }
        }
        
        /**
         * 便利メソッド：透明度変更
         */
        setOpacity(opacity) {
            const currentTool = this.toolManager?.getCurrentTool();
            if (currentTool && currentTool.setPenOpacity) {
                currentTool.setPenOpacity(opacity);
            }
        }
        
        /**
         * 便利メソッド：消しゴムサイズ変更
         */
        setEraserSize(size) {
            const currentTool = this.toolManager?.getCurrentTool();
            if (currentTool && currentTool.setEraserSize) {
                currentTool.setEraserSize(size);
            }
        }
        
        /**
         * デバッグ情報取得（修正版）
         */
        getDebugInfo() {
            return {
                initialized: this.initialized,
                ready: this.ready,
                hasPixiApp: !!this.pixiApp,
                canvasManager: this.canvasManager?.getDebugInfo() || null,
                toolManager: this.toolManager?.getDebugInfo() || null,
                
                // 詳細情報
                verification: {
                    canvasManagerReady: this.canvasManager?.isReady() || false,
                    toolManagerInitialized: this.toolManager?.initialized || false,
                    availableToolsCount: this.toolManager?.getAvailableTools()?.length || 0,
                    currentToolSet: !!this.toolManager?.getCurrentTool(),
                    layersCreated: {
                        layer0: !!this.canvasManager?.getLayer('layer0'),
                        layer1: !!this.canvasManager?.getLayer('layer1')
                    }
                }
            };
        }
        
        /**
         * クリーンアップ
         */
        destroy() {
            if (this.toolManager) {
                // ToolManager のクリーンアップ（実装されていれば）
                this.toolManager = null;
            }
            
            if (this.canvasManager) {
                // CanvasManager のクリーンアップ（実装されていれば）
                this.canvasManager = null;
            }
            
            this.pixiApp = null;
            this.initialized = false;
            this.ready = false;
            
            console.log('✅ AppCore クリーンアップ完了');
        }
    }
    
    // Tegaki名前空間に登録
    window.Tegaki.AppCore = AppCore;
    
    console.log('🎯 AppCore システム基盤 Loaded（ToolManager初期化修正版）');
} else {
    console.log('⚠️ AppCore already defined - skipping redefinition');
}

console.log('🎯 main.js loaded - AppCore基盤システム完成（ToolManager初期化修正版）');