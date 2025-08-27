/**
 * 🎯 AppCore - Phase1.5基盤システム（CoordinateManager修正対応版）
 * 📋 RESPONSIBILITY: Manager統合基盤・CanvasManager作成・ToolManager作成・システム初期化順序管理・Phase1.5Manager連携
 * 🚫 PROHIBITION: UI操作・描画処理・座標変換・イベント処理・直接エラー表示・フォールバック・フェイルセーフ
 * ✅ PERMISSION: Manager作成・Manager設定・初期化順序制御・システム統合・Phase1.5対応・依存性管理
 * 
 * 📏 DESIGN_PRINCIPLE: システム基盤専門・Manager統合基盤・初期化順序制御・Phase1.5完全対応・剛直構造
 * 🔄 INTEGRATION: CanvasManager + ToolManager + Phase1.5Manager群 の統合基盤・依存性管理・初期化順序制御
 * 🎯 FEATURE: Manager作成・Manager統合・システム初期化・Phase1.5基盤・PixiJS統合・剛直構造
 * 🆕 Phase1.5: CoordinateManager統合基盤・NavigationManager連携・RecordManager連携・ShortcutManager連携
 * 
 * 📌 使用メソッド一覧（他ファイル依存）:
 * ✅ window.Tegaki.CanvasManager() - Canvas管理クラス作成
 * ✅ window.Tegaki.ToolManager() - ツール管理クラス作成
 * ✅ window.Tegaki.ErrorManagerInstance.showCritical() - 致命的エラー通知
 * ✅ window.Tegaki.ConfigManagerInstance.getCanvasConfig() - Canvas設定取得
 * ✅ window.Tegaki.EventBusInstance - イベント配信システム
 * 
 * 📌 提供メソッド一覧（外部向け）:
 * ✅ initializeCanvasManager() - CanvasManager初期化
 * ✅ initializeToolManager() - ToolManager初期化
 * ✅ setPixiApp(pixiApp) - PixiJS Application設定
 * ✅ getCanvasManager() - CanvasManager取得
 * ✅ getToolManager() - ToolManager取得
 * ✅ selectTool(toolName) - ツール選択
 * ✅ start() - システム開始
 * ✅ isReady() - 準備状況確認
 * ✅ getDebugInfo() - デバッグ情報取得
 * 
 * 📐 システム初期化フロー:
 * 開始 → CanvasManager作成 → PixiApp設定 → ToolManager作成 → Phase1.5Manager連携 → システム開始 → 完了
 * 依存関係: CanvasManager(基盤) → PixiJS(描画基盤) → ToolManager(ツール基盤) → Phase1.5Manager群(機能拡張)
 */

// 多重定義防止
if (!window.Tegaki) {
    window.Tegaki = {};
}

if (!window.Tegaki.AppCore) {
    /**
     * AppCore - Phase1.5基盤システム（CoordinateManager修正対応版）
     * Manager統合基盤・初期化順序制御・システム基盤を担当
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
            
            // Phase1.5対応状態
            this.phase15Ready = false;
            this.coordinateManagerConnected = false;
            
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
                
                // CanvasManagerにPixiJS設定
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
         * ToolManager初期化（第三段階：Phase1.5対応版）
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
                
                this.toolManager = new window.Tegaki.ToolManager();
                this.initializationSteps.push('ToolManager created');
                
                // CanvasManager設定
                this.toolManager.setCanvasManager(this.canvasManager);
                this.initializationSteps.push('ToolManager - CanvasManager connected');
                
                // EventBus設定
                if (window.Tegaki?.EventBusInstance) {
                    this.toolManager.setEventBus(window.Tegaki.EventBusInstance);
                    this.initializationSteps.push('ToolManager - EventBus connected');
                }
                
                console.log('✅ AppCore - ToolManager初期化完了（Phase1.5対応版）');
                
            } catch (error) {
                this.lastError = error;
                console.error('❌ AppCore - ToolManager初期化エラー:', error);
                throw new Error(`ToolManager initialization failed: ${error.message}`);
            }
        }
        
        /**
         * Phase1.5 Manager群連携設定（第四段階：追加設定）
         * @param {Object} phase15Managers - Phase1.5 Manager群
         */
        connectPhase15Managers(phase15Managers) {
            console.log('🆕 AppCore - Phase1.5 Manager群連携設定開始');
            
            try {
                if (!this.toolManager) {
                    throw new Error('ToolManager not initialized');
                }
                
                const { coordinateManager, recordManager, navigationManager, shortcutManager } = phase15Managers;
                
                // CoordinateManager連携（最優先）
                if (coordinateManager && typeof this.toolManager.setPhase15Managers === 'function') {
                    const managerConfig = {
                        coordinateManager,
                        recordManager,
                        eventBus: window.Tegaki?.EventBusInstance
                    };
                    
                    this.toolManager.setPhase15Managers(managerConfig);
                    this.coordinateManagerConnected = true;
                    this.initializationSteps.push('Phase1.5 Managers connected to ToolManager');
                    
                    console.log('✅ AppCore - Phase1.5 Manager群連携完了');
                } else {
                    console.warn('⚠️ AppCore - ToolManager.setPhase15Managers method not available');
                }
                
                // RecordManager設定（互換性）
                if (recordManager && typeof this.toolManager.setRecordManager === 'function') {
                    this.toolManager.setRecordManager(recordManager);
                    this.initializationSteps.push('RecordManager connected (compatibility)');
                }
                
                this.phase15Ready = true;
                
            } catch (error) {
                this.lastError = error;
                console.error('❌ AppCore - Phase1.5 Manager群連携エラー:', error);
                throw new Error(`Phase1.5 managers connection failed: ${error.message}`);
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
                
                // CanvasManager開始
                if (this.canvasManager && typeof this.canvasManager.start === 'function') {
                    this.canvasManager.start();
                }
                
                // ToolManager開始
                if (this.toolManager && typeof this.toolManager.start === 'function') {
                    this.toolManager.start();
                }
                
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
                
                const success = this.toolManager.selectTool(toolName);
                
                if (success) {
                    console.log(`✅ AppCore - ツール選択成功: ${toolName}`);
                } else {
                    console.warn(`⚠️ AppCore - ツール選択失敗: ${toolName}`);
                }
                
                return success;
                
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
         * Phase1.5準備状況確認
         * @returns {boolean} Phase1.5準備完了フラグ
         */
        isPhase15Ready() {
            return this.phase15Ready && this.coordinateManagerConnected;
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
            console.log(`🆕 Phase1.5対応: ${this.isPhase15Ready() ? '✅ 完了' : '⚠️ 未完了'}`);
            console.log('📝 初期化ステップ:', this.initializationSteps);
            
            if (this.lastError) {
                console.log('❌ 最新エラー:', this.lastError.message);
            }
        }
        
        /**
         * デバッグ情報取得（Phase1.5完全対応）
         * @returns {Object} デバッグ情報
         */
        getDebugInfo() {
            return {
                // 基本状態
                initialized: this.initialized,
                started: this.started,
                ready: this.isReady(),
                
                // Phase1.5状態
                phase15Ready: this.phase15Ready,
                coordinateManagerConnected: this.coordinateManagerConnected,
                
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
                    currentTool: typeof this.toolManager.getCurrentToolName === 'function' ? 
                        this.toolManager.getCurrentToolName() : 'unknown',
                    availableTools: typeof this.toolManager.getAvailableTools === 'function' ? 
                        this.toolManager.getAvailableTools() : [],
                    phase15Connected: this.coordinateManagerConnected
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
                // Manager停止
                if (this.toolManager && typeof this.toolManager.stop === 'function') {
                    this.toolManager.stop();
                }
                
                if (this.canvasManager && typeof this.canvasManager.stop === 'function') {
                    this.canvasManager.stop();
                }
                
                // 状態リセット
                this.initialized = false;
                this.started = false;
                this.phase15Ready = false;
                this.coordinateManagerConnected = false;
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
                
                // Phase1.5機能状態
                phase15Features: {
                    coordinateManager: this.coordinateManagerConnected,
                    ready: this.phase15Ready
                },
                
                // エラー統計
                errorStatus: {
                    hasErrors: !!this.lastError,
                    lastErrorTime: this.lastError ? 'recent' : null
                },
                
                // 初期化統計
                initializationStats: {
                    stepsCompleted: this.initializationSteps.length,
                    fullyInitialized: this.isReady(),
                    phase15Ready: this.isPhase15Ready()
                }
            };
        }
    }
    
    // Tegaki名前空間に登録（Phase1.5完全対応）
    window.Tegaki.AppCore = AppCore;
    
    console.log('🎯 AppCore Phase1.5基盤システム Loaded - Manager統合基盤・初期化順序制御・CoordinateManager修正対応');
    console.log('📏 機能: CanvasManager作成・ToolManager作成・PixiJS統合・Phase1.5Manager連携・システム基盤');
    console.log('🔧 Phase1.5対応: CoordinateManager統合基盤・Manager連携・剛直構造・エラー隠蔽禁止');
    console.log('🚀 システム基盤確立完了 - Manager統合・初期化順序制御・Phase1.5完全対応');
}

console.log('🎯 AppCore Phase1.5基盤システム Loaded - Manager統合基盤・初期化順序制御・CoordinateManager修正対応');
console.log('📏 機能: CanvasManager作成・ToolManager作成・PixiJS統合・Phase1.5Manager連携・システム基盤');
console.log('🔧 Phase1.5対応: CoordinateManager統合基盤・Manager連携・剛直構造・エラー隠蔽禁止');
console.log('🚀 システム基盤確立完了 - Manager統合・初期化順序制御・Phase1.5完全対応');