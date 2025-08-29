/**
 * 🚀 AppCore - PixiJS v8統合基盤システム（400x400キャンバス・コンソール削減修正版）
 * 
 * @provides AppCore, createV8Application, initializeV8Managers, startV8System, 
 *           getManagerInstance, registerManager, getV8DebugInfo
 * @uses PIXI.Application, window.Tegaki.CanvasManager, window.Tegaki.ToolManager, 
 *       各種Manager (CoordinateManager, NavigationManager, RecordManager等)
 * @initflow 1. createV8Application → 2. CanvasManager初期化 → 3. Manager群登録 → 
 *           4. ToolManager初期化 → 5. startV8System → 6. 準備完了通知
 * @forbids 💀双方向依存禁止 🚫フォールバック禁止 🚫フェイルセーフ禁止 🚫v7/v8両対応二重管理禁止
 * @manager-key window.Tegaki.AppCoreInstance
 * @dependencies-strict PixiJS v8.12.0(必須), 全Manager群(必須), ErrorManager(オプション)
 * @integration-flow TegakiApplication → AppCore.initialize → Manager群初期化 → システム開始
 * @method-naming-rules createV8Application()/initializeV8Managers()/startV8System()統一
 * @error-handling 初期化失敗時は例外スロー、Manager注入失敗は即停止
 * @performance-notes WebGPU対応、DPR制限、リアルタイム描画、60fps対応
 */

(function() {
    'use strict';

    /**
     * AppCore - PixiJS v8統合基盤システム
     * 400x400キャンバス・コンソール削減修正版
     */
    class AppCore {
        constructor() {
            console.log('🚀 AppCore v8統合基盤システム 作成開始');
            
            // 基本状態
            this.pixiApp = null;
            this.canvasManager = null;
            this.toolManager = null;
            
            // Manager統一登録
            this.managers = new Map();
            this.managerInstances = new Map();
            
            // v8システム状態
            this.v8Ready = false;
            this.systemStarted = false;
            this.webGPUSupported = false;
            this.rendererType = null;
            
            // 初期化ステップ管理
            this.initializationSteps = [];
            
            // v8機能フラグ
            this.v8Features = {
                webgpuEnabled: false,
                containerHierarchy: false,
                realtimeDrawing: false,
                asyncInitialization: false,
                managerIntegration: false,
                toolSystemReady: false
            };
            
            console.log('🚀 AppCore v8統合基盤システム 作成完了');
        }
        
        /**
         * 🚀 v8 Application作成（400x400デフォルトサイズ）
         */
        async createV8Application() {
            console.log('🚀 AppCore - v8 Application作成開始');
            
            try {
                // PixiJS読み込み確認
                if (!window.PIXI) {
                    throw new Error('PixiJS not loaded');
                }
                
                console.log('⏳ PixiJS読み込み確認開始...');
                await this.waitForPixiJS();
                console.log('🚀 PixiJS v8確認完了:', window.PIXI.VERSION);
                
                // WebGPU対応確認
                this.webGPUSupported = !!window.PIXI.WebGPURenderer;
                console.log('🔍 WebGPU Support:', this.webGPUSupported);
                
                // Renderer選択とApplication作成（400x400固定）
                let rendererPreference;
                if (this.webGPUSupported) {
                    rendererPreference = 'webgpu';
                    console.log('🚀 Using WebGPU renderer');
                } else {
                    rendererPreference = 'webgl';
                    console.log('🔄 Using WebGL renderer');
                }
                
                // PixiJS Application作成（400x400サイズ指定）
                this.pixiApp = new PIXI.Application();
                await this.pixiApp.init({
                    width: 400,
                    height: 400,
                    backgroundColor: 0xf0e0d6, // ふたばクリーム
                    resolution: Math.min(window.devicePixelRatio || 1, 2.0), // DPR制限
                    autoDensity: true,
                    preference: rendererPreference,
                    powerPreference: 'high-performance'
                });
                
                this.rendererType = this.pixiApp.renderer.type;
                this.v8Features.webgpuEnabled = this.rendererType === 'webgpu';
                
                console.log('✅ AppCore - v8 Application作成完了');
                console.log('📊 v8レンダラー:', this.rendererType);
                this.initializationSteps.push('v8 Application作成');
                
                return this.pixiApp;
                
            } catch (error) {
                console.error('💀 v8 Application作成エラー:', error);
                throw error;
            }
        }
        
        /**
         * ⏳ PixiJS読み込み待機
         */
        async waitForPixiJS(maxAttempts = 50, interval = 100) {
            for (let i = 0; i < maxAttempts; i++) {
                if (window.PIXI && window.PIXI.VERSION) {
                    console.log(`✅ PixiJS発見 (試行 ${i + 1}/${maxAttempts})`);
                    return true;
                }
                await new Promise(resolve => setTimeout(resolve, interval));
            }
            throw new Error(`PixiJS読み込みタイムアウト (${maxAttempts * interval}ms)`);
        }
        
        /**
         * 🔧 v8 Manager群初期化（統一登録・初期化順序修正・依存注入検証強化版）
         */
        async initializeV8Managers() {
            console.log('🔧 AppCore - v8 Manager群初期化開始（統一登録・初期化順序修正・依存注入検証強化版）');
            
            if (!this.pixiApp) {
                throw new Error('v8 Application not created - call createV8Application() first');
            }
            
            try {
                // Step 1: CanvasManager v8初期化
                console.log('1️⃣ CanvasManager v8初期化開始...');
                this.canvasManager = new window.Tegaki.CanvasManager();
                console.log('✅ CanvasManager インスタンス作成完了');
                
                await this.canvasManager.initializeV8Application(this.pixiApp);
                console.log('✅ CanvasManager v8 Application設定完了');
                
                // CanvasManager完全準備確認
                console.log('🔍 CanvasManager完全準備確認開始...');
                if (typeof this.canvasManager.getDrawContainer !== 'function') {
                    throw new Error('CanvasManager.getDrawContainer() method not available');
                }
                
                const testContainer = this.canvasManager.getDrawContainer();
                if (!testContainer) {
                    throw new Error('CanvasManager.getDrawContainer() returned null');
                }
                
                if (!this.canvasManager.isV8Ready()) {
                    throw new Error('CanvasManager not ready');
                }
                
                console.log('✅ Step 1: CanvasManager v8完全初期化完了（getDrawContainer確認済み）');
                this.initializationSteps.push('CanvasManager v8完全初期化');
                
                // Step 2: Manager統一登録
                console.log('2️⃣ Manager統一登録開始...');
                
                // CanvasManager登録
                this.registerManager('canvas', this.canvasManager);
                console.log('✅ CanvasManager統一登録完了');
                
                // 他Manager群作成・登録
                this.createAndRegisterManagers();
                
                console.log('✅ Step 2: Manager統一登録完了');
                console.log('📋 登録Manager一覧:', Array.from(this.managers.keys()));
                this.initializationSteps.push('Manager統一登録');
                
                // Step 3: ToolManager v8初期化（依存注入検証強化版）
                console.log('3️⃣ ToolManager v8初期化開始（依存注入検証強化版）...');
                
                // ToolManager作成前最終確認
                console.log('🔧 ToolManager作成前最終確認開始...');
                if (!this.canvasManager.isV8Ready()) {
                    throw new Error('CanvasManager not ready for ToolManager initialization');
                }
                console.log('✅ CanvasManager最終確認完了 - ToolManager初期化可能');
                
                // CanvasManager参照情報（ToolManager用）
                const canvasManagerForTool = this.canvasManager;
                console.log('📦 注入予定CanvasManager:', !!canvasManagerForTool);
                console.log('📦 getDrawContainer利用可能:', typeof canvasManagerForTool.getDrawContainer);
                console.log('📦 描画Container検証完了:', !!canvasManagerForTool.getDrawContainer());
                
                // ToolManager作成・CanvasManager注入
                console.log('🔧 ToolManager作成・CanvasManager注入開始...');
                this.toolManager = new window.Tegaki.ToolManager(canvasManagerForTool);
                console.log('✅ ToolManager作成成功（DI Object形式）');
                console.log('✅ ToolManager インスタンス作成完了');
                
                this.registerManager('tool', this.toolManager);
                console.log('✅ ToolManager統一登録完了');
                
                // ToolManager Manager統一注入・検証
                console.log('🔧 ToolManager Manager統一注入・検証開始...');
                const managersForInjection = this.managers;
                console.log('📦 注入予定Manager Map:', managersForInjection);
                console.log('📦 注入予定キー:', Array.from(managersForInjection.keys()));
                
                const injectionResult = this.toolManager.setManagers(managersForInjection);
                if (!injectionResult) {
                    throw new Error('ToolManager Manager統一注入失敗');
                }
                console.log('✅ ToolManager.setManagers() 成功（Map形式）');
                
                // 依存注入検証実行
                console.log('🔍 ToolManager依存注入検証開始...');
                this.toolManager.verifyInjection();
                console.log('✅ ToolManager依存注入検証PASS');
                
                // v8 Tool初期化
                console.log('🚀 v8 Tool初期化開始（依存注入検証完了後）');
                const toolInitResult = await this.toolManager.initializeV8Tools();
                if (!toolInitResult) {
                    throw new Error('v8 Tool初期化失敗');
                }
                console.log('✅ ToolManager v8ツール初期化完了');
                
                // ToolManager準備状態確認
                if (!this.toolManager.isReady()) {
                    throw new Error('ToolManager not ready after initialization');
                }
                console.log('✅ ToolManager.isReady() confirmed');
                
                console.log('✅ Step 3: ToolManager v8初期化完了（依存注入検証強化版）');
                this.initializationSteps.push('ToolManager v8初期化');
                
                // Step 4: Manager連携確認
                console.log('🔍 v8 Manager連携確認開始（依存注入検証強化版）');
                this.toolManager.verifyInjection();
                console.log('✅ v8 Manager連携確認完了（依存注入検証強化版）');
                
                console.log('📋 登録済みManager:', Array.from(this.managers.keys()));
                console.log('✅ ToolManager依存注入検証状態:', true);
                console.log('✅ Step 4: Manager連携確認完了');
                this.initializationSteps.push('Manager連携確認');
                
                this.v8Features.managerIntegration = true;
                this.v8Features.toolSystemReady = true;
                
                console.log('✅ AppCore - v8 Manager群初期化完了（統一登録・初期化順序修正・依存注入検証強化版）');
                
            } catch (error) {
                console.error('💀 v8 Manager群初期化エラー:', error);
                throw error;
            }
        }
        
        /**
         * 🔧 他Manager群作成・登録
         */
        createAndRegisterManagers() {
            // CoordinateManager
            const coordinateManager = new window.Tegaki.CoordinateManager();
            this.registerManager('coordinate', coordinateManager);
            
            // RecordManager
            const recordManager = new window.Tegaki.RecordManager();
            this.registerManager('record', recordManager);
            
            // ConfigManager
            const configManager = new window.Tegaki.ConfigManager();
            this.registerManager('config', configManager);
            
            // ErrorManager
            if (window.Tegaki.ErrorManagerInstance) {
                this.registerManager('error', window.Tegaki.ErrorManagerInstance);
            }
            
            // EventBus
            if (window.Tegaki.EventBusInstance) {
                this.registerManager('eventbus', window.Tegaki.EventBusInstance);
            }
            
            // ShortcutManager
            const shortcutManager = new window.Tegaki.ShortcutManager();
            this.registerManager('shortcut', shortcutManager);
            
            // NavigationManager
            const navigationManager = new window.Tegaki.NavigationManager();
            this.registerManager('navigation', navigationManager);
        }
        
        /**
         * 📝 Manager登録
         */
        registerManager(key, instance) {
            this.managers.set(key, instance);
            this.managerInstances.set(key, instance);
            
            // グローバル登録
            const managerKey = `${key.charAt(0).toUpperCase() + key.slice(1)}ManagerInstance`;
            window.Tegaki[managerKey] = instance;
        }
        
        /**
         * 🚀 v8システム開始
         */
        async startV8System() {
            console.log('🚀 AppCore - v8システム開始');
            
            if (!this.canvasManager || !this.toolManager) {
                throw new Error('Managers not initialized - call initializeV8Managers() first');
            }
            
            try {
                // 最終依存注入検証
                this.toolManager.verifyInjection();
                
                // システム準備完了通知
                console.log('📡 v8システム準備完了通知送信');
                if (window.Tegaki?.EventBusInstance?.emit) {
                    window.Tegaki.EventBusInstance.emit('v8SystemReady', {
                        rendererType: this.rendererType,
                        webGPUSupported: this.webGPUSupported,
                        managers: Array.from(this.managers.keys()),
                        features: this.v8Features
                    });
                }
                
                this.systemStarted = true;
                this.v8Ready = true;
                
                console.log('✅ AppCore - v8システム開始完了');
                
                // 初期化サマリー出力
                this.outputInitializationSummary();
                
            } catch (error) {
                console.error('💀 v8システム開始エラー:', error);
                throw error;
            }
        }
        
        /**
         * 📋 初期化サマリー出力
         */
        outputInitializationSummary() {
            console.log('📋 AppCore v8初期化サマリー:');
            console.log('🚀 v8システム: ✅ 完了');
            console.log(`🖥️ PixiJS: ${window.PIXI.VERSION} | レンダラー: ${this.rendererType} | WebGPU: ${this.v8Features.webgpuEnabled}`);
            console.log('🔍 依存注入検証: ✅ PASS');
            console.log('📝 v8初期化ステップ:', this.initializationSteps);
            console.log('🔧 v8機能:', this.v8Features);
            console.log('📋 登録Manager:', Array.from(this.managers.keys()));
        }
        
        /**
         * 📦 Manager取得
         */
        getManagerInstance(key) {
            return this.managerInstances.get(key);
        }
        
        /**
         * 🖥️ PixiJS Application取得
         */
        getPixiApp() {
            return this.pixiApp;
        }
        
        /**
         * 🎨 CanvasManager取得
         */
        getCanvasManager() {
            return this.canvasManager;
        }
        
        /**
         * 🔧 ToolManager取得
         */
        getToolManager() {
            return this.toolManager;
        }
        
        /**
         * 🔍 システム準備状況確認
         */
        isV8Ready() {
            return this.v8Ready && this.systemStarted && this.pixiApp && this.canvasManager && this.toolManager;
        }
        
        /**
         * 🧪 v8デバッグ情報取得
         */
        getV8DebugInfo() {
            return {
                className: 'AppCore',
                version: 'v8.12.0',
                systemStatus: {
                    v8Ready: this.v8Ready,
                    systemStarted: this.systemStarted,
                    pixiAppReady: !!this.pixiApp,
                    canvasManagerReady: this.canvasManager ? this.canvasManager.isV8Ready() : false,
                    toolManagerReady: this.toolManager ? this.toolManager.isReady() : false
                },
                rendererInfo: {
                    type: this.rendererType,
                    webGPUSupported: this.webGPUSupported,
                    webGPUActive: this.v8Features.webgpuEnabled
                },
                managers: {
                    totalCount: this.managers.size,
                    registeredKeys: Array.from(this.managers.keys())
                },
                v8Features: this.v8Features,
                initializationSteps: this.initializationSteps,
                pixiInfo: this.pixiApp ? {
                    width: this.pixiApp.screen.width,
                    height: this.pixiApp.screen.height,
                    resolution: this.pixiApp.renderer.resolution,
                    rendererType: this.pixiApp.renderer.type
                } : null
            };
        }
        
        /**
         * v7互換デバッグ情報
         */
        getDebugInfo() {
            return this.getV8DebugInfo();
        }
    }
    
    // グローバル登録
    if (!window.Tegaki) {
        window.Tegaki = {};
    }
    
    window.Tegaki.AppCore = AppCore;
    console.log('🚀 AppCore v8統合基盤システム Loaded - 400x400キャンバス・コンソール削減・描画修正版');

})();