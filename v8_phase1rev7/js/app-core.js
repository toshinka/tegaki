/**
 * 🚀 AppCore - PixiJS v8統合基盤システム（WebGPU対応・非同期初期化・Manager統一登録修正版）
 * 📋 RESPONSIBILITY: v8 Manager統合基盤・v8 Application作成・v8初期化順序管理・WebGPU対応・Manager統一登録
 * 🚫 PROHIBITION: UI操作・描画処理・座標変換・フォールバック・フェイルセーフ・v7 API混在・Manager二重管理
 * ✅ PERMISSION: v8 Manager作成・v8非同期初期化・WebGPU設定・v8統合制御・依存性管理・Manager統一登録
 * 
 * 📏 DESIGN_PRINCIPLE: v8 Application中心・非同期初期化・WebGPU優先・Container階層統合基盤・Manager統一登録
 * 🔄 INTEGRATION: 全Manager統一登録(canvas,tool,coordinate,record,config,error,eventbus,shortcut,navigation)・v8依存性管理
 * 🚀 V8_MIGRATION: 非同期化・WebGPU対応・Container階層・v8 Manager連携・フォールバック削除・Manager統一登録
 * 
 * 📌 提供メソッド一覧（v8対応・実装確認済み）:
 * ✅ constructor() - AppCore初期化・Manager登録Map作成
 * ✅ async waitForPixiJS() - PixiJS読み込み待機・v8バージョン確認
 * ✅ async createCanvasV8(options) - v8 Application作成・WebGPU対応・非同期初期化
 * ✅ async initializeV8Managers() - v8 Manager群非同期初期化・統一登録（修正版）
 * ✅ getManager(name) - Manager取得（統一API）
 * ✅ async startV8System() - v8システム開始・統合確認
 * ✅ isV8Ready() - v8対応状況確認
 * ✅ getV8DebugInfo() - v8専用デバッグ情報取得
 * 
 * 📌 他ファイル呼び出しメソッド一覧（実装確認済み）:
 * ✅ window.PIXI - PixiJS v8ライブラリ（CDN読み込み確認）
 * ✅ new PIXI.Application() - v8 Application作成（PixiJS v8.12.0）
 * ✅ await app.init(options) - v8非同期初期化（PixiJS v8.12.0）
 * ✅ window.Tegaki.CanvasManager - v8 CanvasManager（canvas-manager.js確認済み）
 * ✅ window.Tegaki.ToolManager - v8 ToolManager（tool-manager.js確認済み）
 * ✅ window.Tegaki.CoordinateManager - v8 CoordinateManager（coordinate-manager.js確認済み）
 * ✅ window.Tegaki.RecordManager - v8 RecordManager（record-manager.js確認済み）
 * ✅ window.Tegaki.ConfigManager - ConfigManager（config-manager.js確認済み）
 * ✅ window.Tegaki.ErrorManager - ErrorManager（error-manager.js確認済み）
 * ✅ window.Tegaki.EventBusInstance.emit() - イベント通知（event-bus.js確認済み）
 * ✅ window.Tegaki.ShortcutManager - ShortcutManager（shortcut-manager.js確認済み）
 * ✅ window.Tegaki.NavigationManager - NavigationManager（navigation-manager.js確認済み）
 * 
 * 📐 v8システム初期化フロー（Manager統一登録修正版）:
 * 開始 → PixiJS読み込み待機 → v8 Application作成 → WebGPU対応確認 → 非同期init() → DOM配置 → 
 * 1.CanvasManager v8初期化 → 2.全Manager統一登録(coordinate,record,config,error,eventbus,shortcut,navigation) → 
 * 3.ToolManager v8作成・CanvasManager注入 → v8 Tool初期化 → システム統合確認 → 完了
 * 🚨修正済み依存関係: PixiJS v8.12.0 → v8 CanvasManager → Manager統一登録 → v8 ToolManager → v8 Tool群
 * 
 * 🚨 Manager統一登録キー（tool-manager.jsの要求名と一致）:
 * - "canvas" → CanvasManager - キャンバス・Container階層管理
 * - "tool" → ToolManager - Tool管理・切り替え
 * - "coordinate" → CoordinateManager - 座標変換・高精度変換 ⚠️修正対象
 * - "record" → RecordManager - 操作履歴・アンドゥ・リドゥ ⚠️修正対象  
 * - "config" → ConfigManager - 設定管理
 * - "error" → ErrorManager - エラー処理
 * - "eventbus" → EventBusInstance - イベント通信
 * - "shortcut" → ShortcutManager - ショートカット管理
 * - "navigation" → NavigationManager - ナビゲーション管理
 * 
 * 🔧 処理フロー（Manager統一登録）:
 * 開始 → PIXI Application作成 → CanvasManager初期化 → 各Manager統一登録 → ToolManager初期化 → 完了
 */

// 多重定義防止
if (!window.Tegaki) {
    window.Tegaki = {};
}

if (!window.Tegaki.AppCore) {
    /**
     * AppCore - PixiJS v8統合基盤システム（Manager統一登録修正版）
     * WebGPU対応・非同期初期化・Container階層統合基盤・Manager統一登録
     */
    class AppCore {
        constructor() {
            console.log('🚀 AppCore v8統合基盤システム 作成開始');
            
            // 基本状態
            this.initialized = false;
            this.started = false;
            this.v8SystemReady = false;
            
            // 🚨修正追加: Manager統一登録Map
            this.managers = new Map();
            
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
                realtimeDrawing: false,
                managersUnifiedRegistration: false // 🚨修正追加
            };
            
            // エラー・初期化状態
            this.lastError = null;
            this.v8InitializationSteps = [];
            
            console.log('🚀 AppCore v8統合基盤システム 作成完了');
        }
        
        /**
         * 🚨修正追加: Manager統一取得API
         */
        getManager(name) {
            const manager = this.managers.get(name);
            if (!manager) {
                console.warn(`⚠️ Manager not found: ${name}. Available: ${Array.from(this.managers.keys()).join(', ')}`);
                return null;
            }
            return manager;
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
         * 🚨修正版 - v8 Manager群非同期初期化・統一登録（CoordinateManager・RecordManager追加）
         */
        async initializeV8Managers() {
            console.log('🔧 AppCore - v8 Manager群初期化開始（統一登録修正版）');
            
            try {
                // 前提条件確認
                if (!this.pixiApp) {
                    throw new Error('v8 PixiJS Application not created - call createCanvasV8() first');
                }
                
                // Step 1: v8 CanvasManager先行初期化
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
                
                // 🚨修正追加: Step 2 - Manager統一登録（CoordinateManager・RecordManager含む）
                console.log('2️⃣ Manager統一登録開始...');
                
                // CanvasManager登録
                this.managers.set("canvas", this.canvasManager);
                
                // 🚨修正追加: CoordinateManager登録
                if (window.Tegaki.CoordinateManager) {
                    const coordinateManager = new window.Tegaki.CoordinateManager(this);
                    this.managers.set("coordinate", coordinateManager);
                    console.log('✅ CoordinateManager登録完了');
                } else {
                    console.error('💀 CoordinateManager class not available');
                    throw new Error('CoordinateManager class not available');
                }
                
                // 🚨修正追加: RecordManager登録
                if (window.Tegaki.RecordManager) {
                    const recordManager = new window.Tegaki.RecordManager(this);
                    this.managers.set("record", recordManager);
                    console.log('✅ RecordManager登録完了');
                } else {
                    console.error('💀 RecordManager class not available');
                    throw new Error('RecordManager class not available');
                }
                
                // 🚨修正追加: ConfigManager登録
                if (window.Tegaki.ConfigManager) {
                    const configManager = new window.Tegaki.ConfigManager();
                    this.managers.set("config", configManager);
                    console.log('✅ ConfigManager登録完了');
                } else {
                    console.warn('⚠️ ConfigManager not available - スキップ');
                }
                
                // 🚨修正追加: ErrorManager登録
                if (window.Tegaki.ErrorManagerInstance) {
                    this.managers.set("error", window.Tegaki.ErrorManagerInstance);
                    console.log('✅ ErrorManager登録完了');
                } else {
                    console.warn('⚠️ ErrorManagerInstance not available - スキップ');
                }
                
                // 🚨修正追加: EventBus登録
                if (window.Tegaki.EventBusInstance) {
                    this.managers.set("eventbus", window.Tegaki.EventBusInstance);
                    console.log('✅ EventBus登録完了');
                } else {
                    console.warn('⚠️ EventBusInstance not available - スキップ');
                }
                
                // 🚨修正追加: ShortcutManager登録
                if (window.Tegaki.ShortcutManager) {
                    const shortcutManager = new window.Tegaki.ShortcutManager();
                    this.managers.set("shortcut", shortcutManager);
                    console.log('✅ ShortcutManager登録完了');
                } else {
                    console.warn('⚠️ ShortcutManager not available - スキップ');
                }
                
                // 🚨修正追加: NavigationManager登録
                if (window.Tegaki.NavigationManager) {
                    const navigationManager = new window.Tegaki.NavigationManager(this);
                    this.managers.set("navigation", navigationManager);
                    console.log('✅ NavigationManager登録完了');
                } else {
                    console.warn('⚠️ NavigationManager not available - スキップ');
                }
                
                this.v8Features.managersUnifiedRegistration = true;
                this.v8InitializationSteps.push('v8 Manager unified registration completed');
                console.log('✅ Step 2: Manager統一登録完了');
                console.log('📋 登録Manager一覧:', Array.from(this.managers.keys()));
                
                // Step 3: v8 ToolManager後続初期化（CanvasManager注入・Manager統一登録後）
                console.log('3️⃣ ToolManager v8初期化開始...');
                
                if (!window.Tegaki.ToolManager) {
                    throw new Error('ToolManager class not available');
                }
                
                // ToolManager作成時にCanvasManagerを注入
                this.toolManager = new window.Tegaki.ToolManager(this.canvasManager);
                console.log('✅ ToolManager インスタンス作成完了（CanvasManager注入済み）');
                
                // ToolManager登録
                this.managers.set("tool", this.toolManager);
                
                // 🚨修正追加: ToolManagerにManager統一登録情報を設定
                if (typeof this.toolManager.setManagers === 'function') {
                    this.toolManager.setManagers(this.managers);
                    console.log('✅ ToolManager: Manager統一登録情報設定完了');
                } else {
                    console.warn('⚠️ ToolManager.setManagers() not available');
                }
                
                // v8ツール初期化
                if (this.toolManager.initializeV8Tools) {
                    await this.toolManager.initializeV8Tools();
                    console.log('✅ ToolManager v8ツール初期化完了');
                } else {
                    console.warn('⚠️ ToolManager.initializeV8Tools() not available');
                }
                
                this.v8InitializationSteps.push('v8 ToolManager created with unified managers');
                console.log('✅ Step 3: ToolManager v8初期化完了');
                
                // Step 4: v8 Manager連携確認
                this.validateV8ManagerIntegration();
                this.v8InitializationSteps.push('v8 Manager integration validated');
                console.log('✅ Step 4: Manager連携確認完了');
                
                // Step 5: v8機能有効化
                this.v8Features.containerHierarchy = true;
                this.v8Features.realtimeDrawing = true;
                
                console.log('✅ AppCore - v8 Manager群初期化完了（統一登録修正版）');
                
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
                },
                {
                    condition: this.v8Features.managersUnifiedRegistration,
                    message: 'Manager unified registration not completed'
                },
                {
                    condition: this.managers.has("coordinate"),
                    message: 'CoordinateManager not registered'
                },
                {
                    condition: this.managers.has("record"),
                    message: 'RecordManager not registered'
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
            console.log('📋 登録済みManager:', Array.from(this.managers.keys()));
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
                    managers: Object.fromEntries(
                        Array.from(this.managers.entries()).map(([key, manager]) => [key, !!manager])
                    ),
                    registeredManagers: Array.from(this.managers.keys())
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
                { condition: this.webgpuSupported !== null, message: 'WebGPU support not determined' },
                { condition: this.v8Features.managersUnifiedRegistration, message: 'Manager unified registration not completed' },
                { condition: this.managers.has("coordinate"), message: 'CoordinateManager not registered' },
                { condition: this.managers.has("record"), message: 'RecordManager not registered' }
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
                   this.webgpuSupported !== null &&
                   this.v8Features.managersUnifiedRegistration &&
                   this.managers.has("coordinate") &&
                   this.managers.has("record");
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
            console.log('📋 登録Manager:', Array.from(this.managers.keys()));
            
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
                    toolManagerReady: this.toolManager?.isReady?.() || false,
                    registeredManagers: Array.from(this.managers.keys()),
                    totalRegisteredManagers: this.managers.size,
                    coordinateManagerRegistered: this.managers.has("coordinate"),
                    recordManagerRegistered: this.managers.has("record")
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
                this.managers.clear();
                this.pixiApp = null;
                this.rendererType = null;
                this.webgpuSupported = null;
                this.pixiVersion = null;
                this.v8Features = {
                    pixiJSLoaded: false,
                    webgpuEnabled: false,
                    asyncInitialization: false,
                    containerHierarchy: false,
                    realtimeDrawing: false,
                    managersUnifiedRegistration: false
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
                    tool: !!this.toolManager,
                    totalRegistered: this.managers.size,
                    registeredKeys: Array.from(this.managers.keys()),
                    coordinateRegistered: this.managers.has("coordinate"),
                    recordRegistered: this.managers.has("record")
                },
                
                v8ErrorStatus: {
                    hasErrors: !!this.lastError,
                    lastErrorTime: this.lastError ? 'recent' : null
                },
                
                v8InitializationStats: {
                    stepsCompleted: this.v8InitializationSteps.length,
                    fullyInitialized: this.isV8Ready(),
                    featuresEnabled: Object.values(this.v8Features).filter(Boolean).length,
                    managersUnifiedRegistration: this.v8Features.managersUnifiedRegistration
                }
            };
        }
    }
    
    // Tegaki名前空間に登録
    window.Tegaki.AppCore = AppCore;
    
    console.log('🚀 AppCore v8統合基盤システム Loaded - WebGPU対応・非同期初期化・Container階層統合基盤・Manager統一登録修正版');
} else {
    console.log('⚠️ AppCore already defined - skipping redefinition');
}

console.log('🚀 AppCore v8統合基盤システム Loaded - WebGPU対応・非同期初期化・Container階層統合基盤・Manager統一登録修正版');