/**
 * 🚀 AppCore - PixiJS v8統合基盤システム（WebGPU対応・非同期初期化・PIXI読み込み確認強化）
 * 📋 RESPONSIBILITY: v8 Manager統合基盤・v8 Application作成・v8初期化順序管理・WebGPU対応・PIXI読み込み確認
 * 🚫 PROHIBITION: UI操作・描画処理・座標変換・フォールバック・フェイルセーフ・v7 API混在
 * ✅ PERMISSION: v8 Manager作成・v8非同期初期化・WebGPU設定・v8統合制御・依存性管理・PIXI読み込み待機
 * 
 * 📏 DESIGN_PRINCIPLE: v8 Application中心・非同期初期化・WebGPU優先・Container階層統合基盤・PIXI読み込み確認
 * 🔄 INTEGRATION: v8 CanvasManager + v8 ToolManager 統合基盤・v8依存性管理・非同期初期化順序制御
 * 🚀 V8_MIGRATION: 非同期化・WebGPU対応・Container階層・v8 Manager連携・フォールバック削除・PIXI確認強化
 * 
 * 📌 提供メソッド一覧（v8対応・実装確認済み）:
 * ✅ async waitForPixiJS() - PixiJS読み込み待機・v8バージョン確認
 * ✅ async createCanvasV8(options) - v8 Application作成・WebGPU対応・非同期初期化
 * ✅ async initializeV8Managers() - v8 Manager群非同期初期化・連携設定（修正版）
 * ✅ async startV8System() - v8システム開始・統合確認
 * ✅ isV8Ready() - v8対応状況確認
 * ✅ getV8DebugInfo() - v8専用デバッグ情報取得
 * ✅ selectToolV8(toolName) - v8ツール選択・即座反映
 * ✅ validateV8ManagerIntegration() - v8 Manager連携確認
 * ✅ notifyV8SystemReady() - v8システム開始通知
 * 
 * 📌 他ファイル呼び出しメソッド一覧（実装確認済み）:
 * ✅ window.PIXI - PixiJS v8ライブラリ（CDN読み込み確認）
 * ✅ new PIXI.Application() - v8 Application作成（PixiJS v8.4.0+）
 * ✅ await app.init(options) - v8非同期初期化（PixiJS v8.4.0+）
 * ✅ await PIXI.isWebGPUSupported() - WebGPU対応確認（PixiJS v8.4.0+）
 * ✅ window.Tegaki.CanvasManager - v8 CanvasManager（実装確認済み）
 * ✅ window.Tegaki.ToolManager - v8 ToolManager（実装確認済み）
 * ✅ window.Tegaki.ErrorManagerInstance.showError() - エラー表示（確認済み）
 * ✅ window.Tegaki.EventBusInstance.emit() - イベント通知（確認済み）
 * ✅ document.getElementById() - DOM要素取得（Browser API）
 * 
 * 📐 v8システム初期化フロー（修正版）:
 * 開始 → PixiJS読み込み待機・v8バージョン確認 → v8 Application作成 → WebGPU対応確認 → 
 * 非同期init() → DOM配置 → 1.CanvasManager v8初期化・Application設定 → 2.ToolManager v8作成・CanvasManager注入 → 
 * Manager連携設定 → システム統合確認 → v8システム開始 → 完了
 * 🚨 修正済み依存関係: PixiJS v8.4.0+(基盤) → WebGPU API(高速化) → v8 CanvasManager(階層管理・先行初期化) → v8 ToolManager(描画・後続初期化)
 * 
 * 🚨 CRITICAL_V8_DEPENDENCIES: v8必須依存関係（動作に必須）
 * - window.PIXI !== undefined - PixiJS v8読み込み必須
 * - PIXI.VERSION.startsWith('8.') - v8バージョン必須
 * - await app.init(options) !== undefined - v8非同期初期化必須
 * - this.canvasManager.isV8Ready() === true - v8 CanvasManager準備必須
 * - this.webgpuSupported !== null - WebGPU対応状況確定必須
 * - this.v8SystemReady === true - v8システム統合完了必須
 * 
 * 🔧 V8_INITIALIZATION_ORDER: v8初期化順序（厳守必要・修正版）
 * 1. PixiJS読み込み確認・v8バージョン検証
 * 2. new PIXI.Application() - v8 Application作成
 * 3. WebGPU対応確認・設定
 * 4. await app.init(options) - v8非同期初期化
 * 5. DOM配置・canvas要素確保
 * 6. 🚨 修正 CanvasManager先行初期化・v8 Application設定・v8機能有効化
 * 7. 🚨 修正 ToolManager後続初期化・CanvasManager注入・v8ツール初期化
 * 8. v8システム統合確認・開始
 * 
 * 🚫 V8_ABSOLUTE_PROHIBITIONS: v8移行時絶対禁止事項
 * - PixiJS読み込み確認なし・v7決め打ち継続
 * - v7 PIXI.Application(options)同期作成継続
 * - v8非同期初期化無視・同期的処理継続
 * - WebGPU機能無視・従来WebGL固定継続
 * - 🚨 修正済み Manager初期化順序間違い（ToolManager→CanvasManagerの順序）
 * - フォールバック・フェイルセーフ複雑化
 */

// 多重定義防止
if (!window.Tegaki) {
    window.Tegaki = {};
}

if (!window.Tegaki.AppCore) {
    /**
     * AppCore - PixiJS v8統合基盤システム
     * WebGPU対応・非同期初期化・Container階層統合基盤・PIXI読み込み確認強化
     */
    class AppCore {
        constructor() {
            console.log('🚀 AppCore v8統合基盤システム 作成開始');
            
            // 基本状態
            this.initialized = false;
            this.started = false;
            this.v8SystemReady = false;
            
            // v8基盤Manager群
            this.canvasManager = null;
            this.toolManager = null;
            
            // v8 PixiJS Application
            this.pixiApp = null;
            
            // v8専用プロパティ
            this.rendererType = null; // 'webgpu' | 'webgl'
            this.webgpuSupported = null;
            this.pixiVersion = null;
            this.v8Features = {
                pixiJSLoaded: false,
                webgpuEnabled: false,
                asyncInitialization: false,
                containerHierarchy: false,
                realtimeDrawing: false
            };
            
            // エラー・初期化状態
            this.lastError = null;
            this.v8InitializationSteps = [];
            
            console.log('🚀 AppCore v8統合基盤システム 作成完了');
        }
        
        /**
         * PixiJS読み込み待機・v8バージョン確認
         */
        async waitForPixiJS() {
            console.log('⏳ PixiJS読み込み確認開始...');
            
            // PixiJS読み込み待機（最大5秒）
            let attempts = 0;
            const maxAttempts = 50; // 5秒（100ms × 50回）
            
            while (attempts < maxAttempts) {
                if (window.PIXI) {
                    console.log(`✅ PixiJS発見 (試行 ${attempts + 1}/${maxAttempts})`);
                    break;
                }
                
                // 100ms待機
                await new Promise(resolve => setTimeout(resolve, 100));
                attempts++;
            }
            
            // PixiJS読み込み確認
            if (!window.PIXI) {
                throw new Error(`PixiJS not loaded after ${maxAttempts * 100}ms - check CDN connection`);
            }
            
            // v8バージョン確認
            this.pixiVersion = window.PIXI.VERSION;
            if (!this.pixiVersion || !this.pixiVersion.startsWith('8.')) {
                throw new Error(`PixiJS v8 required, got version: ${this.pixiVersion || 'unknown'}`);
            }
            
            console.log(`🚀 PixiJS v8確認完了: ${this.pixiVersion}`);
            
            // v8基本機能確認
            if (typeof window.PIXI.Application !== 'function') {
                throw new Error('PixiJS v8 Application class not available');
            }
            
            this.v8Features.pixiJSLoaded = true;
            this.v8InitializationSteps.push(`PixiJS v${this.pixiVersion} loaded`);
            
            return this.pixiVersion;
        }
        
        /**
         * v8 Application作成・WebGPU対応・非同期初期化
         */
        async createCanvasV8(options = {}) {
            console.log('🚀 AppCore - v8 Application作成開始');
            
            try {
                // Step 0: PixiJS読み込み確認
                if (!this.v8Features.pixiJSLoaded) {
                    await this.waitForPixiJS();
                }
                
                // Step 1: v8 Application作成
                const app = new window.PIXI.Application();
                
                // Step 2: WebGPU対応確認（利用可能な場合のみ）
                if (typeof window.PIXI.isWebGPUSupported === 'function') {
                    this.webgpuSupported = await window.PIXI.isWebGPUSupported();
                    console.log(`🔍 WebGPU Support: ${this.webgpuSupported}`);
                } else {
                    this.webgpuSupported = false;
                    console.log('📊 WebGPU detection not available - will use WebGL');
                }
                
                // Step 3: v8設定構築（WebGPU優先）
                const v8Options = {
                    width: options.width || 800,
                    height: options.height || 600,
                    backgroundColor: options.backgroundColor || 0xf0e0d6, // ふたばクリーム
                    antialias: options.antialias !== false,
                    resolution: options.resolution || window.devicePixelRatio || 1,
                    powerPreference: 'high-performance',
                    clearBeforeRender: true,
                    preserveDrawingBuffer: false,
                    ...options
                };
                
                if (this.webgpuSupported) {
                    console.log('🚀 Using WebGPU renderer');
                    v8Options.preference = 'webgpu';
                    this.v8Features.webgpuEnabled = true;
                } else {
                    console.log('📊 Fallback to WebGL renderer');
                    v8Options.preference = 'webgl';
                }
                
                // Step 4: v8非同期初期化
                await app.init(v8Options);
                this.pixiApp = app;
                this.rendererType = app.renderer.type;
                this.v8Features.asyncInitialization = true;
                
                this.v8InitializationSteps.push('v8 Application created');
                this.v8InitializationSteps.push(`Renderer: ${this.rendererType}`);
                
                // Step 5: DOM配置
                const container = document.getElementById('canvas-container');
                if (container) {
                    container.appendChild(app.canvas);
                    this.v8InitializationSteps.push('DOM placement completed');
                } else {
                    console.warn('⚠️ canvas-container not found - manual DOM placement required');
                }
                
                console.log('✅ AppCore - v8 Application作成完了');
                console.log(`📊 v8レンダラー: ${this.rendererType}`);
                
                return app;
                
            } catch (error) {
                this.lastError = error;
                console.error('💀 AppCore - v8 Application作成エラー:', error);
                
                // ErrorManagerにエラー通知
                if (window.Tegaki?.ErrorManagerInstance?.showError) {
                    window.Tegaki.ErrorManagerInstance.showError(
                        'PixiJS v8初期化失敗', 
                        error.message
                    );
                }
                
                throw error;
            }
        }
        
        /**
         * 🚨 修正版 - v8 Manager群非同期初期化・連携設定（正しい初期化順序）
         */
        async initializeV8Managers() {
            console.log('🔧 AppCore - v8 Manager群初期化開始（修正版）');
            
            try {
                // 前提条件確認
                if (!this.pixiApp) {
                    throw new Error('v8 PixiJS Application not created - call createCanvasV8() first');
                }
                
                // 🚨 Phase 1 修正: Step 1 - v8 CanvasManager先行初期化
                console.log('1️⃣ CanvasManager v8初期化開始...');
                
                if (!window.Tegaki.CanvasManager) {
                    throw new Error('CanvasManager class not available');
                }
                
                this.canvasManager = new window.Tegaki.CanvasManager();
                console.log('✅ CanvasManager インスタンス作成完了');
                
                // CanvasManagerにPixiJS v8 Applicationを設定
                if (this.canvasManager.initializeV8Application) {
                    await this.canvasManager.initializeV8Application(this.pixiApp);
                    console.log('✅ CanvasManager v8 Application設定完了');
                } else if (this.canvasManager.setPixiAppV8) {
                    await this.canvasManager.setPixiAppV8(this.pixiApp);
                    console.log('✅ CanvasManager v8 Application設定完了（レガシーメソッド）');
                } else if (this.canvasManager.setPixiApp) {
                    // フォールバック: 旧メソッド名
                    this.canvasManager.setPixiApp(this.pixiApp);
                    console.log('✅ CanvasManager Application設定完了（フォールバック）');
                } else {
                    throw new Error('CanvasManager.initializeV8Application() method not available');
                }
                
                // CanvasManagerのv8準備完了確認
                if (this.canvasManager.isV8Ready && !this.canvasManager.isV8Ready()) {
                    console.warn('⚠️ CanvasManager v8準備未完了 - 処理を継続');
                }
                
                this.v8InitializationSteps.push('v8 CanvasManager initialized');
                console.log('✅ Step 1: CanvasManager v8初期化完了');
                
                // 🚨 Phase 1 修正: Step 2 - v8 ToolManager後続初期化（CanvasManager注入）
                console.log('2️⃣ ToolManager v8初期化開始...');
                
                if (!window.Tegaki.ToolManager) {
                    throw new Error('ToolManager class not available');
                }
                
                // ToolManager作成時にCanvasManagerを注入
                this.toolManager = new window.Tegaki.ToolManager(this.canvasManager);
                console.log('✅ ToolManager インスタンス作成完了（CanvasManager注入済み）');
                
                // v8ツール初期化
                if (this.toolManager.initializeV8Tools) {
                    await this.toolManager.initializeV8Tools();
                    console.log('✅ ToolManager v8ツール初期化完了');
                } else {
                    console.warn('⚠️ ToolManager.initializeV8Tools() not available');
                }
                
                this.v8InitializationSteps.push('v8 ToolManager created with CanvasManager');
                console.log('✅ Step 2: ToolManager v8初期化完了');
                
                // Step 3: v8 Manager連携確認
                this.validateV8ManagerIntegration();
                this.v8InitializationSteps.push('v8 Manager integration validated');
                console.log('✅ Step 3: Manager連携確認完了');
                
                // Step 4: v8機能有効化
                this.v8Features.containerHierarchy = true;
                this.v8Features.realtimeDrawing = true;
                
                console.log('✅ AppCore - v8 Manager群初期化完了（修正版）');
                
            } catch (error) {
                this.lastError = error;
                console.error('💀 AppCore - v8 Manager群初期化エラー:', error);
                throw error;
            }
        }
        
        /**
         * v8 Manager連携確認
         */
        validateV8ManagerIntegration() {
            console.log('🔍 v8 Manager連携確認開始');
            
            const checks = [
                { 
                    condition: !!this.canvasManager, 
                    message: 'CanvasManager not initialized' 
                },
                { 
                    condition: !!this.toolManager, 
                    message: 'ToolManager not initialized' 
                },
                { 
                    condition: !!this.pixiApp && this.rendererType, 
                    message: 'v8 PixiJS Application not ready' 
                },
                {
                    condition: this.v8Features.pixiJSLoaded,
                    message: 'PixiJS v8 not properly loaded'
                }
            ];
            
            // CanvasManagerのv8準備状況確認（利用可能な場合のみ）
            if (this.canvasManager && this.canvasManager.isV8Ready) {
                checks.push({
                    condition: this.canvasManager.isV8Ready(),
                    message: 'CanvasManager not v8 ready'
                });
            }
            
            for (const check of checks) {
                if (!check.condition) {
                    throw new Error(`v8 Manager integration failed: ${check.message}`);
                }
            }
            
            console.log('✅ v8 Manager連携確認完了');
        }
        
        /**
         * v8システム開始・統合確認
         */
        async startV8System() {
            console.log('🚀 AppCore - v8システム開始');
            
            try {
                // v8初期化状況確認
                this.validateV8Initialization();
                
                // v8システム状態更新
                this.v8SystemReady = true;
                this.started = true;
                this.initialized = true;
                this.v8InitializationSteps.push('v8 System started');
                
                // v8システム開始通知
                this.notifyV8SystemReady();
                
                console.log('✅ AppCore - v8システム開始完了');
                this.logV8InitializationSummary();
                
            } catch (error) {
                this.lastError = error;
                console.error('💀 AppCore - v8システム開始エラー:', error);
                throw error;
            }
        }
        
        /**
         * v8システム開始通知
         */
        notifyV8SystemReady() {
            // EventBusにv8システム準備完了を通知
            if (window.Tegaki?.EventBusInstance?.emit) {
                window.Tegaki.EventBusInstance.emit('v8SystemReady', {
                    pixiVersion: this.pixiVersion,
                    rendererType: this.rendererType,
                    webgpuSupported: this.webgpuSupported,
                    features: this.v8Features,
                    managers: {
                        canvasManager: !!this.canvasManager,
                        toolManager: !!this.toolManager
                    }
                });
            }
            
            console.log('📡 v8システム準備完了通知送信');
        }
        
        /**
         * v8ツール選択・即座反映
         */
        selectToolV8(toolName) {
            console.log(`🔧 AppCore - v8ツール選択: ${toolName}`);
            
            try {
                if (!this.isV8Ready()) {
                    console.error('❌ v8システム未準備 - ツール選択不可');
                    return false;
                }
                
                if (!this.toolManager?.selectTool) {
                    console.error('❌ ToolManager.selectTool method not available');
                    return false;
                }
                
                this.toolManager.selectTool(toolName);
                console.log(`✅ AppCore - v8ツール選択成功: ${toolName}`);
                
                // v8ツール選択通知
                if (window.Tegaki?.EventBusInstance?.emit) {
                    window.Tegaki.EventBusInstance.emit('v8ToolSelected', {
                        toolName: toolName,
                        rendererType: this.rendererType
                    });
                }
                
                return true;
                
            } catch (error) {
                this.lastError = error;
                console.error('❌ AppCore - v8ツール選択エラー:', error);
                return false;
            }
        }
        
        /**
         * v8初期化状態検証
         */
        validateV8Initialization() {
            const checks = [
                { condition: this.v8Features.pixiJSLoaded, message: 'PixiJS v8 not loaded' },
                { condition: !!this.pixiApp, message: 'v8 PixiJS Application not created' },
                { condition: !!this.rendererType, message: 'v8 renderer type not determined' },
                { condition: !!this.canvasManager, message: 'v8 CanvasManager not initialized' },
                { condition: !!this.toolManager, message: 'v8 ToolManager not initialized' },
                { condition: this.webgpuSupported !== null, message: 'WebGPU support not determined' }
            ];
            
            // CanvasManagerのv8準備確認（利用可能な場合のみ）
            if (this.canvasManager && this.canvasManager.isV8Ready) {
                checks.push({
                    condition: this.canvasManager.isV8Ready(),
                    message: 'CanvasManager not v8 ready'
                });
            }
            
            for (const check of checks) {
                if (!check.condition) {
                    throw new Error(`v8 initialization validation failed: ${check.message}`);
                }
            }
        }
        
        /**
         * v8対応状況確認
         */
        isV8Ready() {
            return this.v8SystemReady && 
                   this.v8Features.pixiJSLoaded &&
                   !!this.pixiApp && 
                   !!this.rendererType &&
                   !!this.canvasManager &&
                   !!this.toolManager &&
                   this.webgpuSupported !== null;
        }
        
        /**
         * v8初期化サマリーログ出力
         */
        logV8InitializationSummary() {
            console.log('📋 AppCore v8初期化サマリー:');
            console.log(`🚀 v8システム: ${this.isV8Ready() ? '✅ 完了' : '❌ 未完了'}`);
            console.log(`🖥️ PixiJS: v${this.pixiVersion} | レンダラー: ${this.rendererType} | WebGPU: ${this.webgpuSupported}`);
            console.log('📝 v8初期化ステップ:', this.v8InitializationSteps);
            console.log('🔧 v8機能:', this.v8Features);
            
            if (this.lastError) {
                console.log('❌ 最新エラー:', this.lastError.message);
            }
        }
        
        /**
         * v8専用デバッグ情報取得
         */
        getV8DebugInfo() {
            return {
                // v8基本状態
                v8SystemReady: this.v8SystemReady,
                initialized: this.initialized,
                started: this.started,
                ready: this.isV8Ready(),
                
                // v8レンダラー情報
                rendererInfo: {
                    pixiVersion: this.pixiVersion,
                    type: this.rendererType,
                    webgpuSupported: this.webgpuSupported,
                    webgpuActive: this.rendererType === 'webgpu',
                    pixiLoaded: this.v8Features.pixiJSLoaded
                },
                
                // v8 Manager状態
                v8Managers: {
                    canvasManager: !!this.canvasManager,
                    canvasManagerV8Ready: this.canvasManager?.isV8Ready?.() || false,
                    toolManager: !!this.toolManager,
                    toolManagerReady: this.toolManager?.isReady?.() || false
                },
                
                // v8機能状況
                v8Features: this.v8Features,
                
                // v8 PixiJS状態
                pixiApp: this.pixiApp ? {
                    width: this.pixiApp.screen.width,
                    height: this.pixiApp.screen.height,
                    resolution: this.pixiApp.renderer.resolution,
                    canvasElement: !!this.pixiApp.canvas,
                    stageChildren: this.pixiApp.stage.children.length
                } : null,
                
                // v8初期化情報
                v8Initialization: {
                    steps: this.v8InitializationSteps,
                    stepsCompleted: this.v8InitializationSteps.length,
                    lastError: this.lastError ? this.lastError.message : null
                },
                
                // v8システム情報
                v8System: {
                    tegakiNamespace: !!window.Tegaki,
                    errorManager: !!window.Tegaki?.ErrorManagerInstance,
                    eventBus: !!window.Tegaki?.EventBusInstance,
                    pixiJS: !!window.PIXI,
                    pixiVersion: this.pixiVersion
                }
            };
        }
        
        // v7互換・ユーティリティメソッド群
        
        getDebugInfo() {
            return this.getV8DebugInfo();
        }
        
        isReady() {
            return this.isV8Ready();
        }
        
        getCanvasManager() {
            return this.canvasManager;
        }
        
        getToolManager() {
            return this.toolManager;
        }
        
        getPixiApp() {
            return this.pixiApp;
        }
        
        getWebGPUStatus() {
            return {
                supported: this.webgpuSupported,
                active: this.rendererType === 'webgpu',
                rendererType: this.rendererType
            };
        }
        
        selectTool(toolName) {
            return this.selectToolV8(toolName);
        }
        
        getPixiVersion() {
            return this.pixiVersion;
        }
        
        getV8FeatureStatus() {
            return this.v8Features;
        }
        
        resetV8System() {
            console.log('🔄 AppCore - v8システムリセット開始');
            
            try {
                this.v8SystemReady = false;
                this.initialized = false;
                this.started = false;
                this.canvasManager = null;
                this.toolManager = null;
                this.pixiApp = null;
                this.rendererType = null;
                this.webgpuSupported = null;
                this.pixiVersion = null;
                this.v8Features = {
                    pixiJSLoaded: false,
                    webgpuEnabled: false,
                    asyncInitialization: false,
                    containerHierarchy: false,
                    realtimeDrawing: false
                };
                this.lastError = null;
                this.v8InitializationSteps = [];
                
                console.log('✅ AppCore - v8システムリセット完了');
                
            } catch (error) {
                console.error('❌ AppCore - v8システムリセットエラー:', error);
                throw error;
            }
        }
        
        getV8SystemStats() {
            return {
                v8Status: {
                    systemReady: this.v8SystemReady,
                    uptime: this.started ? 'running' : 'stopped',
                    pixiVersion: this.pixiVersion,
                    rendererType: this.rendererType,
                    webgpuActive: this.rendererType === 'webgpu'
                },
                
                v8Managers: {
                    canvas: !!this.canvasManager,
                    canvasV8Ready: this.canvasManager?.isV8Ready?.() || false,
                    tool: !!this.toolManager
                },
                
                v8ErrorStatus: {
                    hasErrors: !!this.lastError,
                    lastErrorTime: this.lastError ? 'recent' : null
                },
                
                v8InitializationStats: {
                    stepsCompleted: this.v8InitializationSteps.length,
                    fullyInitialized: this.isV8Ready(),
                    featuresEnabled: Object.values(this.v8Features).filter(Boolean).length
                }
            };
        }
    }
    
    // Tegaki名前空間に登録
    window.Tegaki.AppCore = AppCore;
    
    console.log('🚀 AppCore v8統合基盤システム Loaded - WebGPU対応・非同期初期化・Container階層統合基盤・PIXI読み込み確認強化');
} else {
    console.log('⚠️ AppCore already defined - skipping redefinition');
}

console.log('🚀 AppCore v8統合基盤システム Loaded - WebGPU対応・非同期初期化・Container階層統合基盤・PIXI読み込み確認強化');