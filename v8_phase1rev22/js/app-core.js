/**
 * 📄 FILE: js/app-core.js
 * 📌 RESPONSIBILITY: PixiJS v8統合基盤システム・Manager群統一初期化・システム制御
 * 
 * @provides
 *   - AppCore（クラス）
 *   - createV8Application(): PIXI.Application
 *   - createCanvasV8(width, height): PIXI.Application ✅NEW
 *   - initializeV8Managers(): void  
 *   - startV8System(): void
 *   - getManagerInstance(key): Manager
 *   - registerManager(key, instance): void
 *   - getV8DebugInfo(): Object
 *   - isV8Ready(): boolean
 *
 * @uses
 *   - PIXI.Application（PixiJS v8 コアAPI）
 *   - window.Tegaki.CanvasManager（キャンバス管理）
 *   - window.Tegaki.ToolManager（ツール管理）
 *   - window.Tegaki.CoordinateManager（座標管理）
 *   - window.Tegaki.NavigationManager（ナビゲーション）
 *   - window.Tegaki.RecordManager（記録管理）
 *   - window.Tegaki.EventBusInstance（イベント通信）
 *   - window.Tegaki.ErrorManagerInstance（エラー処理）
 *
 * @initflow
 *   1. createV8Application() → PixiJS Application生成
 *   2. createCanvasV8() → TegakiApplication互換API ✅NEW
 *   3. initializeV8Managers() → Manager群順次初期化
 *   4. startV8System() → システム開始・準備完了通知
 *
 * @forbids
 *   💀 双方向依存禁止
 *   🚫 フォールバック禁止
 *   🚫 フェイルセーフ禁止
 *   🚫 v7/v8二重管理禁止
 *   🚫 未実装メソッド呼び出し禁止
 *   🚫 WebGPU警告垂れ流し禁止 ✅NEW
 *
 * @manager-key
 *   window.Tegaki.AppCoreInstance
 *
 * @dependencies-strict
 *   REQUIRED: PixiJS v8.12.0, 全Manager群（CanvasManager, ToolManager等）
 *   OPTIONAL: ErrorManager, EventBus
 *   FORBIDDEN: 他AppCoreインスタンス、v7互換コード
 *
 * @integration-flow
 *   TegakiApplication.initialize() → AppCore.createCanvasV8() → AppCore.initializeV8Managers() → 完了
 *
 * @method-naming-rules
 *   初期化系: createV8xxx() / initializeV8xxx()
 *   取得系: getManagerInstance() / getV8DebugInfo()
 *   状態系: isV8Ready() / startV8System()
 *   
 * @error-handling
 *   throw: 初期化失敗・必須Manager未存在・PixiJS未読み込み
 *   false: オプション機能失敗・設定更新失敗
 *   log: 警告レベル・デバッグ情報（過剰ログ削減）
 *
 * @testing-hooks
 *   - getV8DebugInfo(): Object（システム状況詳細）
 *   - isV8Ready(): boolean（準備完了状態）
 *   - getManagerInstance(key): Manager（Manager取得）
 *
 * @performance-notes
 *   WebGPU警告抑制・初期化時間最適化
 *   16ms以内目標・メモリリーク防止
 */

(function() {
    'use strict';

    /**
     * AppCore - PixiJS v8統合基盤システム
     * WebGPU警告抑制・初期化順序修正版
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
            this.webgpuSupported = false;
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
         * 🎨 キャンバス生成（TegakiApplication互換API）✅NEW
         * tegaki-application.js の createCanvasV8() 呼び出し対応
         * @param {number} width - キャンバス幅（デフォルト400）
         * @param {number} height - キャンバス高さ（デフォルト400）
         * @returns {Promise<PIXI.Application>} PixiJS Application
         */
        async createCanvasV8(width = 400, height = 400) {
            console.log(`🎨 AppCore.createCanvasV8(${width}, ${height}) - TegakiApplication互換API`);
            
            try {
                // 既存のcreateV8Application()に委譲
                const app = await this.createV8Application(width, height);
                
                if (!app) {
                    throw new Error('createV8Application() returned null');
                }
                
                console.log(`✅ AppCore.createCanvasV8完了 - ${width}x${height}キャンバス生成`);
                return app;
                
            } catch (error) {
                console.error('💀 AppCore.createCanvasV8エラー:', error);
                throw error;
            }
        }
        
        /**
         * 🚀 v8 Application作成（WebGPU警告抑制・エラー処理強化版）
         * @param {number} width - キャンバス幅（デフォルト400）
         * @param {number} height - キャンバス高さ（デフォルト400）
         * @returns {Promise<PIXI.Application>}
         */
        async createV8Application(width = 400, height = 400) {
            console.log(`🚀 AppCore - v8 Application作成開始 (${width}x${height})`);
            
            try {
                // PixiJS読み込み確認
                if (!window.PIXI) {
                    throw new Error('PixiJS not loaded');
                }
                
                console.log('⏳ PixiJS読み込み確認開始...');
                await this.waitForPixiJS();
                console.log('🚀 PixiJS v8確認完了:', window.PIXI.VERSION);
                
                // WebGPU対応確認
                this.webgpuSupported = !!window.PIXI.WebGPURenderer;
                console.log('🔍 WebGPU Support:', this.webgpuSupported);
                
                // Renderer選択とApplication作成
                let rendererPreference;
                if (this.webgpuSupported) {
                    rendererPreference = 'webgpu';
                    console.log('🚀 Using WebGPU renderer');
                } else {
                    rendererPreference = 'webgl';
                    console.log('🔄 Using WebGL renderer');
                }
                
                // 🚨WebGPU警告抑制：console.warnをフック
                const originalWarn = console.warn;
                const suppressedWarnings = [];
                
                console.warn = function(message, ...args) {
                    // WebGPU関連の既知警告を抑制
                    if (typeof message === 'string' && 
                        (message.includes('powerPreference option is currently ignored') ||
                         message.includes('requestAdapter'))) {
                        suppressedWarnings.push(message);
                        return; // ログ出力しない
                    }
                    // その他の警告は通常出力
                    originalWarn.call(console, message, ...args);
                };
                
                try {
                    // PixiJS Application作成（指定サイズ・警告抑制）
                    this.pixiApp = new PIXI.Application();
                    await this.pixiApp.init({
                        width: width,
                        height: height,
                        backgroundColor: 0xf0e0d6, // ふたばクリーム
                        resolution: Math.min(window.devicePixelRatio || 1, 2.0), // DPR制限
                        autoDensity: true,
                        preference: rendererPreference,
                        powerPreference: 'high-performance'
                    });
                } finally {
                    // console.warnを復元
                    console.warn = originalWarn;
                    
                    // 抑制した警告の統計出力（デバッグ用）
                    if (suppressedWarnings.length > 0) {
                        console.log(`🔇 WebGPU警告抑制: ${suppressedWarnings.length}件`);
                    }
                }
                
                this.rendererType = this.pixiApp.renderer.type;
                this.v8Features.webgpuEnabled = this.rendererType === 'webgpu';
                
                console.log(`✅ AppCore - v8 Application作成完了 (${width}x${height})`);
                console.log('📊 v8レンダラー:', this.rendererType);
                this.initializationSteps.push(`v8 Application作成 (${width}x${height})`);
                
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
                throw new Error('v8 Application not created - call createCanvasV8() first');
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
                    console.log('🔍 ToolManager準備状態確認:');
                    const toolDebugInfo = this.toolManager.getDebugInfo?.() || {};
                    console.log('  - CanvasManager:', !!toolDebugInfo.canvasManager);
                    console.log('  - getDrawContainer method:', typeof toolDebugInfo.canvasManager?.getDrawContainer);
                    console.log('  - DrawContainer:', !!toolDebugInfo.drawContainer);
                    console.log('  - Managers:', !!toolDebugInfo.managers);
                    console.log('  - Tools:', toolDebugInfo.toolsCount + '個');
                    console.log('  - CurrentTool:', toolDebugInfo.currentTool);
                    
                    // 詳細検証
                    this.toolManager.verifyInjection();
                    
                    if (!this.toolManager.isReady()) {
                        throw new Error('ToolManager still not ready after verification');
                    }
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
            console.log('🎯 CoordinateManager v8対応版 作成開始');
            const coordinateManager = new window.Tegaki.CoordinateManager();
            this.registerManager('coordinate', coordinateManager);
            console.log('✅ CoordinateManager v8対応版 作成完了');
            
            // RecordManager
            console.log('🚀 RecordManager v8初期化開始');
            const recordManager = new window.Tegaki.RecordManager();
            this.registerManager('record', recordManager);
            console.log('✅ v8準備完了: setManagersでManager統合後に利用可能');
            console.log('🔄 RecordManager v8対応版 作成完了');
            
            // ConfigManager
            console.log('🔧 ConfigManager v8対応版 作成');
            const configManager = new window.Tegaki.ConfigManager();
            this.registerManager('config', configManager);
            
            // ErrorManager（既存インスタンス使用）
            if (window.Tegaki.ErrorManagerInstance) {
                this.registerManager('error', window.Tegaki.ErrorManagerInstance);
            }
            
            // EventBus（既存インスタンス使用）
            if (window.Tegaki.EventBusInstance) {
                this.registerManager('eventbus', window.Tegaki.EventBusInstance);
            }
            
            // ShortcutManager
            console.log('⌨️ ShortcutManager Phase1.5スタブ実装 - 初期化開始');
            const shortcutManager = new window.Tegaki.ShortcutManager();
            this.registerManager('shortcut', shortcutManager);
            console.log('⌨️ ShortcutManager スタブ実装完了');
            
            // NavigationManager
            console.log('🧭 NavigationManager v8対応版 初期化開始');
            const navigationManager = new window.Tegaki.NavigationManager();
            this.registerManager('navigation', navigationManager);
            console.log('✅ NavigationManager v8対応版 初期化完了');
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
                console.log('🔍 ToolManager依存注入検証開始...');
                this.toolManager.verifyInjection();
                console.log('✅ ToolManager依存注入検証完了 - 全検証PASS');
                
                // システム準備完了通知
                console.log('📡 v8システム準備完了通知送信');
                if (window.Tegaki?.EventBusInstance?.emit) {
                    window.Tegaki.EventBusInstance.emit('v8SystemReady', {
                        rendererType: this.rendererType,
                        webgpuSupported: this.webgpuSupported,
                        managers: Array.from(this.managers.keys()),
                        features: this.v8Features
                    });
                }
                
                this.systemStarted = true;
                this.v8Ready = true;
                
                console.log('✅ AppCore - v8システム開始完了');
                
                // 初期化サマリー出力（過剰ログ削減版）
                this.outputInitializationSummary();
                
            } catch (error) {
                console.error('💀 v8システム開始エラー:', error);
                throw error;
            }
        }
        
        /**
         * 📋 初期化サマリー出力（コンソール過剰表示削減版）
         */
        outputInitializationSummary() {
            console.log('✅ AppCore v8システム完了');
            console.log(`📊 PixiJS ${window.PIXI.VERSION} | ${this.rendererType} | Manager数: ${this.managers.size}`);
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
                    webgpuSupported: this.webgpuSupported,
                    webgpuActive: this.v8Features.webgpuEnabled
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
    console.log('🚀 AppCore v8統合基盤システム Loaded - WebGPU警告抑制・初期化順序修正版');

})();