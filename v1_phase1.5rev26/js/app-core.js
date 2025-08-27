/**
 * 🎯 AppCore - Phase1.5基盤システム（架空メソッド完全修正版）
 * 📋 RESPONSIBILITY: Manager統合基盤・CanvasManager作成・ToolManager作成・システム初期化順序管理
 * 🚫 PROHIBITION: UI操作・描画処理・座標変換・フォールバック・フェイルセーフ・架空メソッド呼び出し
 * ✅ PERMISSION: Manager作成・Manager設定・初期化順序制御・システム統合・依存性管理
 * 
 * 📏 DESIGN_PRINCIPLE: システム基盤専門・Manager統合基盤・初期化順序制御・剛直構造
 * 🔄 INTEGRATION: CanvasManager + ToolManager 統合基盤・依存性管理・初期化順序制御
 * 🔧 FIX: 架空メソッド削除・実在メソッドのみ使用・エラー隠蔽禁止・正しい初期化順序
 * 
 * 📌 使用メソッド一覧:
 * ✅ window.Tegaki.CanvasManager(constructor) - Canvas管理クラス作成（canvas-manager.js）
 * ✅ window.Tegaki.ToolManager(canvasManager) - ツール管理クラス作成（tool-manager.js）
 * ✅ canvasManager.setPixiApp(pixiApp) - PixiJS設定（canvas-manager.js）
 * ✅ window.Tegaki.ErrorManagerInstance.showError() - エラー表示（error-manager.js）
 * ❌ toolManager.setCanvasManager() - 削除（架空メソッド）
 * ❌ toolManager.setEventBus() - 削除（架空メソッド）
 * ❌ toolManager.setPhase15Managers() - 削除（架空メソッド）
 * 
 * 📐 システム初期化フロー:
 * 開始 → CanvasManager作成 → PixiApp設定 → ToolManager作成（CanvasManager渡し） → システム開始 → 完了
 * 依存関係: CanvasManager(基盤) → PixiJS(描画基盤) → ToolManager(ツール基盤・コンストラクタでCanvasManager受取)
 */

// 多重定義防止
if (!window.Tegaki) {
    window.Tegaki = {};
}

if (!window.Tegaki.AppCore) {
    /**
     * AppCore - Phase1.5基盤システム（架空メソッド完全修正版）
     */
    class AppCore {
        constructor() {
            console.log('🎯 AppCore Phase1.5基盤システム 作成開始');
            
            // 基本状態
            this.initialized = false;
            this.started = false;
            
            // 基盤Manager群
            this.canvasManager = null;
            this.toolManager = null;
            
            // PixiJS Application
            this.pixiApp = null;
            
            // エラー状態
            this.lastError = null;
            this.initializationSteps = [];
            
            console.log('🎯 AppCore Phase1.5基盤システム 作成完了');
        }
        
        /**
         * CanvasManager初期化（第一段階）
         */
        async initializeCanvasManager() {
            console.log('🎨 AppCore - CanvasManager初期化開始');
            
            try {
                // CanvasManager作成（剛直構造）
                if (!window.Tegaki.CanvasManager) {
                    throw new Error('CanvasManager class not available');
                }
                
                this.canvasManager = new window.Tegaki.CanvasManager();
                this.initializationSteps.push('CanvasManager created');
                
                console.log('✅ AppCore - CanvasManager作成完了');
                
            } catch (error) {
                this.lastError = error;
                console.error('❌ AppCore - CanvasManager初期化エラー:', error);
                throw new Error(`CanvasManager initialization failed: ${error.message}`);
            }
        }
        
        /**
         * PixiJS Application設定（第二段階）
         * @param {PIXI.Application} pixiApp - PixiJS Application
         */
        setPixiApp(pixiApp) {
            console.log('🚀 AppCore - PixiJS Application設定開始');
            
            try {
                if (!pixiApp) {
                    throw new Error('PixiJS Application is required');
                }
                
                if (!this.canvasManager) {
                    throw new Error('CanvasManager not initialized - call initializeCanvasManager() first');
                }
                
                this.pixiApp = pixiApp;
                
                // CanvasManagerにPixiJS設定（実在メソッド）
                this.canvasManager.setPixiApp(pixiApp);
                this.initializationSteps.push('PixiJS Application set');
                
                console.log('✅ AppCore - PixiJS Application設定完了');
                console.log(`📏 PixiJS設定: ${pixiApp.screen.width}x${pixiApp.screen.height}px`);
                
            } catch (error) {
                this.lastError = error;
                console.error('❌ AppCore - PixiJS Application設定エラー:', error);
                throw new Error(`PixiJS Application setup failed: ${error.message}`);
            }
        }
        
        /**
         * ToolManager初期化（第三段階：修正版）
         * 🔧 修正: ToolManagerコンストラクタでCanvasManagerを渡す方式に変更
         */
        async initializeToolManager() {
            console.log('🖊️ AppCore - ToolManager初期化開始（Phase1.5対応版）');
            
            try {
                // 前提条件確認
                if (!this.canvasManager) {
                    throw new Error('CanvasManager not initialized');
                }
                
                if (!this.pixiApp) {
                    throw new Error('PixiJS Application not set');
                }
                
                // ToolManager作成（剛直構造）
                if (!window.Tegaki.ToolManager) {
                    throw new Error('ToolManager class not available');
                }
                
                // 🔧 修正: ToolManagerコンストラクタでCanvasManagerを直接渡す
                this.toolManager = new window.Tegaki.ToolManager(this.canvasManager);
                this.initializationSteps.push('ToolManager created with CanvasManager');
                
                console.log('✅ AppCore - ToolManager初期化完了（Phase1.5対応版）');
                
            } catch (error) {
                this.lastError = error;
                console.error('❌ AppCore - ToolManager初期化エラー:', error);
                throw new Error(`ToolManager initialization failed: ${error.message}`);
            }
        }
        
        /**
         * システム開始（最終段階）
         */
        start() {
            console.log('🚀 AppCore - システム開始');
            
            try {
                // 初期化状況確認
                this.validateInitialization();
                
                // 基本状態更新
                this.started = true;
                this.initialized = true;
                this.initializationSteps.push('System started');
                
                console.log('✅ AppCore - システム開始完了');
                this.logInitializationSummary();
                
            } catch (error) {
                this.lastError = error;
                console.error('❌ AppCore - システム開始エラー:', error);
                throw new Error(`System start failed: ${error.message}`);
            }
        }
        
        /**
         * ツール選択（統合API）
         * @param {string} toolName - ツール名
         * @returns {boolean} 選択成功フラグ
         */
        selectTool(toolName) {
            console.log(`🔧 AppCore - ツール選択: ${toolName}`);
            
            try {
                if (!this.toolManager) {
                    console.error('❌ ToolManager not initialized');
                    return false;
                }
                
                if (typeof this.toolManager.selectTool !== 'function') {
                    console.error('❌ ToolManager.selectTool method not available');
                    return false;
                }
                
                this.toolManager.selectTool(toolName);
                console.log(`✅ AppCore - ツール選択成功: ${toolName}`);
                return true;
                
            } catch (error) {
                this.lastError = error;
                console.error('❌ AppCore - ツール選択エラー:', error);
                return false;
            }
        }
        
        /**
         * CanvasManager取得
         * @returns {CanvasManager|null} CanvasManager
         */
        getCanvasManager() {
            return this.canvasManager;
        }
        
        /**
         * ToolManager取得
         * @returns {ToolManager|null} ToolManager
         */
        getToolManager() {
            return this.toolManager;
        }
        
        /**
         * PixiJS Application取得
         * @returns {PIXI.Application|null} PixiJS Application
         */
        getPixiApp() {
            return this.pixiApp;
        }
        
        /**
         * システム準備状況確認
         * @returns {boolean} 準備完了フラグ
         */
        isReady() {
            return this.initialized && this.started && 
                   !!this.canvasManager && !!this.toolManager && !!this.pixiApp;
        }
        
        /**
         * 初期化状態検証（剛直構造）
         * @throws {Error} 未初期化時は例外発生
         */
        validateInitialization() {
            const checks = [
                { condition: !!this.canvasManager, message: 'CanvasManager not initialized' },
                { condition: !!this.toolManager, message: 'ToolManager not initialized' },
                { condition: !!this.pixiApp, message: 'PixiJS Application not set' }
            ];
            
            for (const check of checks) {
                if (!check.condition) {
                    throw new Error(check.message);
                }
            }
        }
        
        /**
         * 初期化サマリーログ出力
         */
        logInitializationSummary() {
            console.log('📋 AppCore 初期化サマリー:');
            console.log(`🎯 基盤システム: ${this.isReady() ? '✅ 完了' : '❌ 未完了'}`);
            console.log('📝 初期化ステップ:', this.initializationSteps);
            
            if (this.lastError) {
                console.log('❌ 最新エラー:', this.lastError.message);
            }
        }
        
        /**
         * デバッグ情報取得（Phase1.5対応）
         * @returns {Object} デバッグ情報
         */
        getDebugInfo() {
            return {
                // 基本状態
                initialized: this.initialized,
                started: this.started,
                ready: this.isReady(),
                
                // Manager状態
                managers: {
                    canvasManager: !!this.canvasManager,
                    toolManager: !!this.toolManager
                },
                
                // PixiJS状態
                pixiApp: this.pixiApp ? {
                    width: this.pixiApp.screen.width,
                    height: this.pixiApp.screen.height,
                    resolution: this.pixiApp.renderer.resolution,
                    ready: true
                } : null,
                
                // CanvasManager詳細
                canvasManager: this.canvasManager ? 
                    (typeof this.canvasManager.getDebugInfo === 'function' ? 
                        this.canvasManager.getDebugInfo() : 'initialized') : null,
                
                // ToolManager詳細
                toolManager: this.toolManager ? {
                    ready: typeof this.toolManager.isReady === 'function' ? this.toolManager.isReady() : true,
                    availableTools: typeof this.toolManager.getAvailableTools === 'function' ? 
                        this.toolManager.getAvailableTools() : []
                } : null,
                
                // 初期化情報
                initialization: {
                    steps: this.initializationSteps,
                    stepsCompleted: this.initializationSteps.length,
                    lastError: this.lastError ? this.lastError.message : null
                },
                
                // システム情報
                system: {
                    tegakiNamespace: !!window.Tegaki,
                    errorManager: !!window.Tegaki?.ErrorManagerInstance,
                    configManager: !!window.Tegaki?.ConfigManagerInstance,
                    eventBus: !!window.Tegaki?.EventBusInstance,
                    pixiJS: !!window.PIXI
                }
            };
        }
        
        /**
         * システムリセット（デバッグ用）
         */
        reset() {
            console.log('🔄 AppCore - システムリセット開始');
            
            try {
                // 状態リセット
                this.initialized = false;
                this.started = false;
                this.canvasManager = null;
                this.toolManager = null;
                this.pixiApp = null;
                this.lastError = null;
                this.initializationSteps = [];
                
                console.log('✅ AppCore - システムリセット完了');
                
            } catch (error) {
                console.error('❌ AppCore - システムリセットエラー:', error);
                throw new Error(`System reset failed: ${error.message}`);
            }
        }
        
        /**
         * システム統計情報取得（監視用）
         * @returns {Object} 統計情報
         */
        getSystemStats() {
            return {
                // 稼働時間（概算）
                uptime: this.started ? 'running' : 'stopped',
                
                // Manager状態
                managersActive: {
                    canvas: !!this.canvasManager,
                    tool: !!this.toolManager
                },
                
                // エラー統計
                errorStatus: {
                    hasErrors: !!this.lastError,
                    lastErrorTime: this.lastError ? 'recent' : null
                },
                
                // 初期化統計
                initializationStats: {
                    stepsCompleted: this.initializationSteps.length,
                    fullyInitialized: this.isReady()
                }
            };
        }
    }
    
    // Tegaki名前空間に登録
    window.Tegaki.AppCore = AppCore;
    
    console.log('🎯 AppCore Phase1.5基盤システム Loaded - Manager統合基盤・初期化順序制御・架空メソッド完全修正版');
} else {
    console.log('⚠️ AppCore already defined - skipping redefinition');
}

console.log('🎯 AppCore Phase1.5基盤システム Loaded - Manager統合基盤・初期化順序制御・架空メソッド完全修正版');