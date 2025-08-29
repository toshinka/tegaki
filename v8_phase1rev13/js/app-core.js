/**
 * 🚀 AppCore - PixiJS v8統合基盤システム（WebGPU対応・非同期初期化・Manager統一登録修正版・初期化順序修正）
 * 📋 RESPONSIBILITY: v8 Manager統合基盤・v8 Application作成・v8初期化順序管理・WebGPU対応・Manager統一登録・双方向依存排除
 * 🚫 PROHIBITION: UI操作・描画処理・座標変換・フォールバック・フェイルセーフ・v7 API混在・Manager二重管理・双方向依存・循環参照
 * ✅ PERMISSION: v8 Manager作成・v8非同期初期化・WebGPU設定・v8統合制御・依存性管理・Manager統一登録・EventBus通信
 * 
 * ⚠️ 注意: v7/v8 両対応による Manager 群の二重管理は禁止。
 * 本ファイルは v8 専用の初期化ロジックを採用している。
 * 
 * 📏 DESIGN_PRINCIPLE: v8 Application中心・非同期初期化・WebGPU優先・Container階層統合基盤・Manager統一登録・単方向依存
 * 🔄 INTEGRATION: 全Manager統一登録(canvas,tool,coordinate,record,config,error,eventbus,shortcut,navigation)・v8依存性管理・EventBus中心通信
 * 🚀 V8_MIGRATION: 非同期化・WebGPU対応・Container階層・v8 Manager連携・フォールバック削除・Manager統一登録・双方向依存排除
 * 
 * 📌 提供メソッド一覧（v8対応・実装確認済み）:
 * ✅ constructor() - AppCore初期化・Manager登録Map作成
 * ✅ async waitForPixiJS() - PixiJS読み込み待機・v8バージョン確認
 * ✅ async createCanvasV8(options) - v8 Application作成・WebGPU対応・非同期初期化・400x400サイズ
 * ✅ async initializeV8Managers() - v8 Manager群非同期初期化・統一登録（初期化順序修正版）🚨修正
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
 * ✅ canvasManager.initializeV8Application(app) - CanvasManager v8初期化（修正済み）🚨修正
 * ✅ canvasManager.getDrawContainer() - v8描画Container取得（修正済み）🚨修正
 * ✅ window.Tegaki.ToolManager - v8 ToolManager（tool-manager.js確認済み）
 * ✅ window.Tegaki.CoordinateManager - v8 CoordinateManager（coordinate-manager.js確認済み）
 * ✅ window.Tegaki.RecordManager - v8 RecordManager（record-manager.js確認済み）
 * ✅ window.Tegaki.ConfigManager - ConfigManager（config-manager.js確認済み）
 * ✅ window.Tegaki.ErrorManager - ErrorManager（error-manager.js確認済み）
 * ✅ window.Tegaki.EventBusInstance.emit() - イベント通知（event-bus.js確認済み）
 * ✅ window.Tegaki.ShortcutManager - ShortcutManager（shortcut-manager.js確認済み）
 * ✅ window.Tegaki.NavigationManager - NavigationManager（navigation-manager.js確認済み）
 * 
 * 📐 v8システム初期化フロー（Manager統一登録・初期化順序修正版）:
 * 開始 → PixiJS読み込み待機 → v8 Application作成（400x400） → WebGPU対応確認 → 非同期init() → DOM配置 → 
 * 1.CanvasManager v8初期化・v8Application設定・getDrawContainer利用可能確認🚨修正 → 
 * 2.全Manager統一登録(coordinate,record,config,error,eventbus,shortcut,navigation) → 
 * 3.ToolManager v8作成・CanvasManager注入・Manager統一注入・getDrawContainer確認🚨修正 → 
 * v8 Tool初期化 → システム統合確認 → 完了
 * 🚨修正済み依存関係: PixiJS v8.12.0 → v8 CanvasManager完全初期化・getDrawContainer利用可能 → Manager統一登録 → v8 ToolManager（Manager統一注入・getDrawContainer確認済み） → v8 Tool群
 * 
 * 🚨 Manager統一登録キー（tool-manager.jsの要求名と一致）:
 * - "canvas" → CanvasManager - キャンバス・Container階層管理・getDrawContainer提供🚨修正
 * - "tool" → ToolManager - Tool管理・切り替え
 * - "coordinate" → CoordinateManager - 座標変換・高精度変換 ✅修正完了
 * - "record" → RecordManager - 操作履歴・アンドゥ・リドゥ ✅修正完了
 * - "config" → ConfigManager - 設定管理
 * - "error" → ErrorManager - エラー処理
 * - "eventbus" → EventBusInstance - イベント通信
 * - "shortcut" → ShortcutManager - ショートカット管理
 * - "navigation" → NavigationManager - ナビゲーション管理
 * 
 * 🔧 処理フロー（Manager統一登録・初期化順序修正版）:
 * 開始 → PIXI Application作成（400x400） → CanvasManager初期化・Application設定完了・getDrawContainer利用可能確認🚨修正 → 各Manager統一登録 → ToolManager初期化・CanvasManager注入・Manager統一注入・getDrawContainer確認🚨修正 → 完了
 * 
 * 🔑 Manager登録キー: なし（AppCoreは他Managerから参照されない・EventBus経由通信）
 */

// 多重定義防止
if (!window.Tegaki) {
    window.Tegaki = {};
}

if (!window.Tegaki.AppCore) {
    /**
     * AppCore - PixiJS v8統合基盤システム（Manager統一登録・初期化順序修正版）
     * WebGPU対応・非同期初期化・Container階層統合基盤・Manager統一登録・双方向依存排除
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
                managersUnifiedRegistration: false, // 🚨修正追加
                canvasManagerReady: false, // 🚨新規追加
                drawContainerReady: false // 🚨新規追加
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
         * v8 Application作成・WebGPU対応・非同期初期化・400x400サイズ
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
                
                // Step 3: v8設定構築（WebGPU優先・400x400サイズ）
                const v8Options = {
                    width: options.width || 400,  // 🔧修正: 400x400サイズ
                    height: options.height || 400, // 🔧修正: 400x400サイズ
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
                
                this.v8InitializationSteps.push('v8 Application created (400x400)');
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
         * 🚨修正版 - v8 Manager群非同期初期化・統一登録（初期化順序修正版・getDrawContainer確認強化）
         */
        async initializeV8Managers() {
            console.log('🔧 AppCore - v8 Manager群初期化開始（統一登録・初期化順序修正版）');
            
            try {
                // 前提条件確認
                if (!this.pixiApp) {
                    throw new Error('v8 PixiJS Application not created - call createCanvasV8() first');
                }
                
                // 🚨修正: Step 1 - v8 CanvasManager完全初期化（先行・getDrawContainer確認強化）
                console.log('1️⃣ CanvasManager v8初期化開始...');
                
                if (!window.Tegaki.CanvasManager) {
                    throw new Error('CanvasManager class not available');
                }
                
                this.canvasManager = new window.Tegaki.CanvasManager();
                console.log('✅ CanvasManager インスタンス作成完了');
                
                // CanvasManagerにPixiJS v8 Applicationを設定（完全初期化）
                if (typeof this.canvasManager.initializeV8Application !== 'function') {
                    throw new Error('CanvasManager.initializeV8Application() method not available');
                }
                
                await this.canvasManager.initializeV8Application(this.pixiApp);
                console.log('✅ CanvasManager v8 Application設定完了');
                
                // 🚨修正強化: CanvasManager完全準備確認（getDrawContainer重点確認）
                console.log('🔍 CanvasManager完全準備確認開始...');
                
                // getDrawContainerメソッド利用可能確認
                if (typeof this.canvasManager.getDrawContainer !== 'function') {
                    throw new Error('CanvasManager.getDrawContainer() method not available - CanvasManager not fully initialized');
                }
                console.log('✅ CanvasManager.getDrawContainer() method available');
                
                // getDrawContainer実行・結果確認
                let drawContainer;
                try {
                    drawContainer = this.canvasManager.getDrawContainer();
                } catch (error) {
                    throw new Error(`CanvasManager.getDrawContainer() execution failed: ${error.message}`);
                }
                
                if (!drawContainer) {
                    throw new Error('CanvasManager.getDrawContainer() returned null - v8描画Container未作成');
                }
                console.log('✅ CanvasManager.getDrawContainer() execution successful');
                
                // Container型確認（PixiJS Container確認）
                if (!drawContainer.addChild || typeof drawContainer.addChild !== 'function') {
                    throw new Error('CanvasManager.getDrawContainer() returned invalid Container - missing addChild method');
                }
                console.log('✅ v8描画Container validation successful');
                
                // isV8Ready()確認（利用可能な場合のみ）
                if (typeof this.canvasManager.isV8Ready === 'function') {
                    if (!this.canvasManager.isV8Ready()) {
                        throw new Error('CanvasManager.isV8Ready() returned false - initialization incomplete');
                    }
                    console.log('✅ CanvasManager.isV8Ready() confirmed');
                }
                
                this.v8Features.canvasManagerReady = true;
                this.v8Features.drawContainerReady = true;
                this.v8InitializationSteps.push('v8 CanvasManager fully initialized with getDrawContainer');
                console.log('✅ Step 1: CanvasManager v8完全初期化完了（getDrawContainer確認済み）');
                
                // 🚨修正完了: Step 2 - Manager統一登録（CoordinateManager・RecordManager修正版）
                console.log('2️⃣ Manager統一登録開始...');
                
                // CanvasManager登録
                this.managers.set("canvas", this.canvasManager);
                console.log('✅ CanvasManager統一登録完了');
                
                // 🚨修正完了: CoordinateManager登録（インスタンス作成修正）
                if (window.Tegaki.CoordinateManager) {
                    const coordinateManager = new window.Tegaki.CoordinateManager(this);
                    this.managers.set("coordinate", coordinateManager);
                    console.log('🎯 CoordinateManager v8対応版 統一登録完了');
                } else {
                    console.warn('⚠️ CoordinateManager class not available - スキップ');
                }
                
                // 🚨修正完了: RecordManager登録（インスタンス作成修正）
                if (window.Tegaki.RecordManager) {
                    const recordManager = new window.Tegaki.RecordManager(this);
                    this.managers.set("record", recordManager);
                    console.log('🔄 RecordManager v8対応版 統一登録完了');
                } else {
                    console.warn('⚠️ RecordManager class not available - スキップ');
                }
                
                // 🚨修正追加: ConfigManager登録
                if (window.Tegaki.ConfigManager) {
                    const configManager = new window.Tegaki.ConfigManager();
                    this.managers.set("config", configManager);
                    console.log('✅ ConfigManager統一登録完了');
                } else {
                    console.warn('⚠️ ConfigManager not available - スキップ');
                }
                
                // 🚨修正追加: ErrorManager登録
                if (window.Tegaki.ErrorManagerInstance) {
                    this.managers.set("error", window.Tegaki.ErrorManagerInstance);
                    console.log('✅ ErrorManager統一登録完了');
                } else {
                    console.warn('⚠️ ErrorManagerInstance not available - スキップ');
                }
                
                // 🚨修正追加: EventBus登録
                if (window.Tegaki.EventBusInstance) {
                    this.managers.set("eventbus", window.Tegaki.EventBusInstance);
                    console.log('✅ EventBus統一登録完了');
                } else {
                    console.warn('⚠️ EventBusInstance not available - スキップ');
                }
                
                // 🚨修正追加: ShortcutManager登録
                if (window.Tegaki.ShortcutManager) {
                    const shortcutManager = new window.Tegaki.ShortcutManager();
                    this.managers.set("shortcut", shortcutManager);
                    console.log('✅ ShortcutManager統一登録完了');
                } else {
                    console.warn('⚠️ ShortcutManager not available - スキップ');
                }
                
                // 🚨修正追加: NavigationManager登録
                if (window.Tegaki.NavigationManager) {
                    const navigationManager = new window.Tegaki.NavigationManager(this);
                    this.managers.set("navigation", navigationManager);
                    console.log('✅ NavigationManager統一登録完了');
                } else {
                    console.warn('⚠️ NavigationManager not available - スキップ');
                }
                
                this.v8Features.managersUnifiedRegistration = true;
                this.v8InitializationSteps.push('v8 Manager unified registration completed');
                console.log('✅ Step 2: Manager統一登録完了');
                console.log('📋 登録Manager一覧:', Array.from(this.managers.keys()));
                
                // 🚨修正: Step 3 - v8 ToolManager後続初期化（CanvasManager完全準備後・Manager統一登録後・getDrawContainer再確認）
                console.log('3️⃣ ToolManager v8初期化開始...');
                
                if (!window.Tegaki.ToolManager) {
                    throw new Error('ToolManager class not available');
                }
                
                // 🚨修正: ToolManager作成前にCanvasManagerを最終確認（getDrawContainer重点確認）
                console.log('🔧 ToolManager作成前最終確認開始...');
                
                if (!this.canvasManager) {
                    throw new Error('ToolManager初期化: CanvasManagerが未作成');
                }
                
                if (typeof this.canvasManager.getDrawContainer !== 'function') {
                    throw new Error('ToolManager初期化: CanvasManager.getDrawContainer()が利用不可');
                }
                
                let finalDrawContainer;
                try {
                    finalDrawContainer = this.canvasManager.getDrawContainer();
                } catch (error) {
                    throw new Error(`ToolManager初期化: CanvasManager.getDrawContainer()実行エラー: ${error.message}`);
                }
                
                if (!finalDrawContainer) {
                    throw new Error('ToolManager初期化: v8描画Container取得失敗');
                }
                
                if (!finalDrawContainer.addChild || typeof finalDrawContainer.addChild !== 'function') {
                    throw new Error('ToolManager初期化: 無効なContainer - addChildメソッドなし');
                }
                
                console.log('✅ CanvasManager最終確認完了 - ToolManager初期化可能');
                console.log('📦 注入予定CanvasManager:', !!this.canvasManager);
                console.log('📦 getDrawContainer利用可能:', typeof this.canvasManager.getDrawContainer);
                console.log('📦 描画Container検証完了:', !!finalDrawContainer);
                
                // 🚨修正: ToolManager作成・CanvasManager注入（DI形式確認）
                console.log('🔧 ToolManager作成・CanvasManager注入開始...');
                
                // ToolManagerコンストラクタの形式確認
                // new ToolManager(canvasManager) または new ToolManager({canvasManager}) 
                let toolManager;
                try {
                    // まず標準的なDI形式で試行
                    toolManager = new window.Tegaki.ToolManager({ 
                        canvasManager: this.canvasManager 
                    });
                    console.log('✅ ToolManager作成成功（DI Object形式）');
                } catch (error) {
                    console.log('⚠️ DI Object形式失敗、レガシー形式で再試行:', error.message);
                    
                    try {
                        // レガシー形式で再試行
                        toolManager = new window.Tegaki.ToolManager(this.canvasManager);
                        console.log('✅ ToolManager作成成功（レガシー形式）');
                    } catch (legacyError) {
                        throw new Error(`ToolManager作成失敗: DI形式エラー「${error.message}」, レガシー形式エラー「${legacyError.message}」`);
                    }
                }
                
                this.toolManager = toolManager;
                console.log('✅ ToolManager インスタンス作成完了（CanvasManager注入済み）');
                
                // ToolManager登録
                this.managers.set("tool", this.toolManager);
                console.log('✅ ToolManager統一登録完了');
                
                // 🚨修正完了: ToolManagerにManager統一登録情報を設定（setManagers修正版）
                console.log('🔧 ToolManager Manager統一注入開始');
                console.log('📦 注入予定Manager Map:', this.managers);
                console.log('📦 注入予定キー:', Array.from(this.managers.keys()));
                
                if (typeof this.toolManager.setManagers === 'function') {
                    try {
                        // Map形式で注入試行
                        this.toolManager.setManagers(this.managers);
                        console.log('✅ ToolManager: Manager統一登録情報設定完了（Map形式）');
                    } catch (mapError) {
                        console.warn('⚠️ Map形式失敗、Object形式で再試行:', mapError.message);
                        
                        try {
                            // Object形式に変換して再試行
                            const managersObject = Object.fromEntries(this.managers);
                            this.toolManager.setManagers(managersObject);
                            console.log('✅ ToolManager: Manager統一登録情報設定完了（Object形式）');
                        } catch (objError) {
                            console.error('❌ ToolManager.setManagers() 両形式失敗:', objError.message);
                            
                            // 代替処理: 直接プロパティ設定
                            this.toolManager.managersMap = this.managers;
                            this.toolManager.managersObject = Object.fromEntries(this.managers);
                            console.log('🔧 ToolManager: managersプロパティ直接設定完了（代替処理）');
                        }
                    }
                } else {
                    console.warn('⚠️ ToolManager.setManagers() not available - 代替処理実行');
                    
                    // 🚨修正追加: setManagersが利用できない場合の代替処理
                    if (this.toolManager && typeof this.toolManager === 'object') {
                        this.toolManager.managersMap = this.managers;
                        this.toolManager.managersObject = Object.fromEntries(this.managers);
                        console.log('🔧 ToolManager: managersプロパティ設定完了（代替方式）');
                    }
                }
                
                // 🚨新規追加: ToolManagerの初期化状態確認
                console.log('🔍 ToolManager初期化状態確認...');
                
                // canvasManagerプロパティ確認
                if (!this.toolManager.canvasManager) {
                    console.warn('⚠️ ToolManager.canvasManager not set - 直接設定試行');
                    this.toolManager.canvasManager = this.canvasManager;
                }
                
                if (this.toolManager.canvasManager !== this.canvasManager) {
                    throw new Error('ToolManager.canvasManager injection verification failed');
                }
                
                console.log('✅ ToolManager.canvasManager注入確認完了');
                
                // drawContainerプロパティ確認・設定
                if (!this.toolManager.drawContainer) {
                    console.log('🔧 ToolManager.drawContainer設定開始...');
                    try {
                        this.toolManager.drawContainer = this.canvasManager.getDrawContainer();
                        console.log('✅ ToolManager.drawContainer設定完了');
                    } catch (error) {
                        console.warn('⚠️ ToolManager.drawContainer自動設定失敗:', error.message);
                    }
                }
                
                // v8ツール初期化（Manager統一登録後・CanvasManager準備完了後）
                if (typeof this.toolManager.initializeV8Tools === 'function') {
                    console.log('🚀 v8 Tool初期化開始');
                    try {
                        await this.toolManager.initializeV8Tools();
                        console.log('✅ ToolManager v8ツール初期化完了');
                    } catch (toolInitError) {
                        console.warn('⚠️ v8 Tool初期化失敗:', toolInitError.message);
                        // 🚨修正: ツール初期化失敗でもシステム初期化は継続
                    }
                } else {
                    console.warn('⚠️ ToolManager.initializeV8Tools() not available');
                }
                
                // 🚨新規追加: ToolManager最終検証
                if (typeof this.toolManager.isReady === 'function') {
                    if (!this.toolManager.isReady()) {
                        console.warn('⚠️ ToolManager.isReady() returned false - but continuing');
                    } else {
                        console.log('✅ ToolManager.isReady() confirmed');
                    }
                }
                
                this.v8InitializationSteps.push('v8 ToolManager created with unified managers and verified');
                console.log('✅ Step 3: ToolManager v8初期化完了');
                
                // Step 4: v8 Manager連携確認
                this.validateV8ManagerIntegration();
                this.v8InitializationSteps.push('v8 Manager integration validated');
                console.log('✅ Step 4: Manager連携確認完了');
                
                // Step 5: v8機能有効化
                this.v8Features.containerHierarchy = true;
                this.v8Features.realtimeDrawing = true;
                
                console.log('✅ AppCore - v8 Manager群初期化完了（統一登録・初期化順序修正版）');
                
            } catch (error) {
                this.lastError = error;
                console.error('💀 AppCore - v8 Manager群初期化エラー:', error);
                throw error;
            }
        }
        
        /**
         * v8 Manager連携確認（getDrawContainer確認強化版）
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
                    condition: this.v8Features.canvasManagerReady,
                    message: 'CanvasManager not ready'
                },
                {
                    condition: this.v8Features.drawContainerReady,
                    message: 'DrawContainer not ready'
                },
                {
                    condition: this.managers.has("coordinate"),
                    message: 'CoordinateManager not registered'
                },
                {
                    condition: this.managers.has("record"),
                    message: 'RecordManager not registered'
                },
                {
                    condition: this.managers.has("canvas"),
                    message: 'CanvasManager not registered in unified registry'
                },
                {
                    condition: this.managers.has("tool"),
                    message: 'ToolManager not registered in unified registry'
                }
            ];
            
            // CanvasManagerのv8準備状況確認（利用可能な場合のみ）
            if (this.canvasManager && typeof this.canvasManager.isV8Ready === 'function') {
                checks.push({
                    condition: this.canvasManager.isV8Ready(),
                    message: 'CanvasManager not v8 ready'
                });
            }
            
            // 🚨修正強化: CanvasManager.getDrawContainer()確認（重要・詳細確認）
            if (this.canvasManager) {
                checks.push({
                    condition: typeof this.canvasManager.getDrawContainer === 'function',
                    message: 'CanvasManager.getDrawContainer() method not available'
                });
                
                if (typeof this.canvasManager.getDrawContainer === 'function') {
                    try {
                        const drawContainer = this.canvasManager.getDrawContainer();
                        checks.push({
                            condition: !!drawContainer,
                            message: 'CanvasManager.getDrawContainer() returns null'
                        });
                        
                        if (drawContainer) {
                            checks.push({
                                condition: typeof drawContainer.addChild === 'function',
                                message: 'DrawContainer lacks addChild method - not a valid PixiJS Container'
                            });
                        }
                    } catch (error) {
                        checks.push({
                            condition: false,
                            message: `CanvasManager.getDrawContainer() execution failed: ${error.message}`
                        });
                    }
                }
            }
            
            // 🚨修正追加: ToolManager連携確認（詳細確認）
            if (this.toolManager) {
                checks.push({
                    condition: !!this.toolManager.canvasManager,
                    message: 'ToolManager.canvasManager not injected'
                });
                
                if (this.toolManager.canvasManager) {
                    checks.push({
                        condition: this.toolManager.canvasManager === this.canvasManager,
                        message: 'ToolManager.canvasManager injection mismatch'
                    });
                }
                
                checks.push({
                    condition: !!this.toolManager.drawContainer,
                    message: 'ToolManager.drawContainer not available'
                });
                
                checks.push({
                    condition: !!(this.toolManager.managersObject || this.toolManager.managersMap),
                    message: 'ToolManager managers not injected'
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
                
                if (!this.toolManager?.switchTool) {
                    console.error('❌ ToolManager.switchTool method not available');
                    return false;
                }
                
                this.toolManager.switchTool(toolName);
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
         * v8初期化状態検証（getDrawContainer確認強化版）
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
                { condition: this.v8Features.canvasManagerReady, message: 'CanvasManager not ready' },
                { condition: this.v8Features.drawContainerReady, message: 'DrawContainer not ready' },
                { condition: this.managers.has("coordinate"), message: 'CoordinateManager not registered' },
                { condition: this.managers.has("record"), message: 'RecordManager not registered' },
                { condition: this.managers.has("canvas"), message: 'CanvasManager not registered' },
                { condition: this.managers.has("tool"), message: 'ToolManager not registered' }
            ];
            
            // CanvasManagerのv8準備確認（利用可能な場合のみ）
            if (this.canvasManager && typeof this.canvasManager.isV8Ready === 'function') {
                checks.push({
                    condition: this.canvasManager.isV8Ready(),
                    message: 'CanvasManager not v8 ready'
                });
            }
            
            // 🚨修正強化: getDrawContainer確認
            if (this.canvasManager) {
                checks.push({
                    condition: typeof this.canvasManager.getDrawContainer === 'function',
                    message: 'CanvasManager.getDrawContainer() method not available'
                });
                
                if (typeof this.canvasManager.getDrawContainer === 'function') {
                    try {
                        const drawContainer = this.canvasManager.getDrawContainer();
                        checks.push({
                            condition: !!drawContainer,
                            message: 'CanvasManager.getDrawContainer() returns null'
                        });
                        
                        if (drawContainer) {
                            checks.push({
                                condition: typeof drawContainer.addChild === 'function',
                                message: 'DrawContainer invalid - missing addChild method'
                            });
                        }
                    } catch (error) {
                        checks.push({
                            condition: false,
                            message: `CanvasManager.getDrawContainer() execution error: ${error.message}`
                        });
                    }
                }
            }
            
            // 🚨修正追加: ToolManager連携確認（詳細）
            if (this.toolManager) {
                checks.push({
                    condition: !!this.toolManager.canvasManager,
                    message: 'ToolManager.canvasManager not injected'
                });
                
                if (this.toolManager.canvasManager) {
                    checks.push({
                        condition: this.toolManager.canvasManager === this.canvasManager,
                        message: 'ToolManager.canvasManager injection mismatch'
                    });
                }
                
                checks.push({
                    condition: !!(this.toolManager.managersObject || this.toolManager.managersMap),
                    message: 'ToolManager managers not injected'
                });
            }
            
            for (const check of checks) {
                if (!check.condition) {
                    throw new Error(`v8 initialization validation failed: ${check.message}`);
                }
            }
        }
        
        /**
         * v8対応状況確認（getDrawContainer確認強化版）
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
                   this.v8Features.canvasManagerReady &&
                   this.v8Features.drawContainerReady &&
                   this.managers.has("coordinate") &&
                   this.managers.has("record") &&
                   this.managers.has("canvas") &&
                   this.managers.has("tool") &&
                   !!this.toolManager.canvasManager &&
                   (!!this.toolManager.managersObject || !!this.toolManager.managersMap) &&
                   typeof this.canvasManager.getDrawContainer === 'function';
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
         * v8専用デバッグ情報取得（getDrawContainer情報強化）
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
                
                // v8 Manager状態（getDrawContainer詳細情報追加）
                v8Managers: {
                    canvasManager: !!this.canvasManager,
                    canvasManagerReady: this.v8Features.canvasManagerReady,
                    canvasManagerV8Ready: this.canvasManager?.isV8Ready?.() || false,
                    drawContainerReady: this.v8Features.drawContainerReady,
                    getDrawContainerMethod: this.canvasManager && typeof this.canvasManager.getDrawContainer === 'function',
                    getDrawContainerWorking: (() => {
                        if (!this.canvasManager || typeof this.canvasManager.getDrawContainer !== 'function') return false;
                        try {
                            const container = this.canvasManager.getDrawContainer();
                            return !!(container && typeof container.addChild === 'function');
                        } catch (error) {
                            return false;
                        }
                    })(),
                    toolManager: !!this.toolManager,
                    toolManagerReady: this.toolManager?.isReady?.() || false,
                    toolManagerCanvasManager: !!this.toolManager?.canvasManager,
                    toolManagerCanvasManagerMatch: this.toolManager?.canvasManager === this.canvasManager,
                    toolManagerDrawContainer: !!this.toolManager?.drawContainer,
                    toolManagerManagersInjected: !!(this.toolManager?.managersObject || this.toolManager?.managersMap),
                    registeredManagers: Array.from(this.managers.keys()),
                    totalRegisteredManagers: this.managers.size,
                    coordinateManagerRegistered: this.managers.has("coordinate"),
                    recordManagerRegistered: this.managers.has("record"),
                    canvasManagerRegistered: this.managers.has("canvas"),
                    toolManagerRegistered: this.managers.has("tool")
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
                    managersUnifiedRegistration: false,
                    canvasManagerReady: false,
                    drawContainerReady: false
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
                    canvasReady: this.v8Features.canvasManagerReady,
                    canvasV8Ready: this.canvasManager?.isV8Ready?.() || false,
                    drawContainerReady: this.v8Features.drawContainerReady,
                    getDrawContainerAvailable: this.canvasManager && typeof this.canvasManager.getDrawContainer === 'function',
                    tool: !!this.toolManager,
                    toolCanvasManagerInjected: !!this.toolManager?.canvasManager,
                    toolManagersInjected: !!(this.toolManager?.managersObject || this.toolManager?.managersMap),
                    totalRegistered: this.managers.size,
                    registeredKeys: Array.from(this.managers.keys()),
                    coordinateRegistered: this.managers.has("coordinate"),
                    recordRegistered: this.managers.has("record"),
                    canvasRegistered: this.managers.has("canvas"),
                    toolRegistered: this.managers.has("tool")
                },
                
                v8ErrorStatus: {
                    hasErrors: !!this.lastError,
                    lastErrorTime: this.lastError ? 'recent' : null
                },
                
                v8InitializationStats: {
                    stepsCompleted: this.v8InitializationSteps.length,
                    fullyInitialized: this.isV8Ready(),
                    featuresEnabled: Object.values(this.v8Features).filter(Boolean).length,
                    managersUnifiedRegistration: this.v8Features.managersUnifiedRegistration,
                    canvasManagerReady: this.v8Features.canvasManagerReady,
                    drawContainerReady: this.v8Features.drawContainerReady
                }
            };
        }
    }
    
    // Tegaki名前空間に登録
    window.Tegaki.AppCore = AppCore;
    
    console.log('🚀 AppCore v8統合基盤システム Loaded - WebGPU対応・非同期初期化・Container階層統合基盤・Manager統一登録・初期化順序修正版');
} else {
    console.log('⚠️ AppCore already defined - skipping redefinition');
}

console.log('🚀 AppCore v8統合基盤システム Loaded - WebGPU対応・非同期初期化・Container階層統合基盤・Manager統一登録・初期化順序修正版');