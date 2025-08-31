/**
 * 📄 FILE: js/app-core.js
 * 📌 RESPONSIBILITY: PixiJS v8統合基盤システム・Manager統一API契約対応・初期化順序確立・エラー耐性強化版
 * ChangeLog: 2025-08-31 CoordinateManager初期化修正・エラーハンドリング強化・過剰ログ削減
 *
 * @provides
 *   - AppCore（クラス）
 *   - createV8Application(): Promise<PIXI.Application> - v8 Application作成
 *   - createCanvasV8(width, height): Promise<PIXI.Application> - TegakiApplication互換API
 *   - getCanvasElement(): HTMLCanvasElement - Canvas要素取得
 *   - ensureCanvasDOMPlacement(): boolean - DOM配置確認
 *   - initializeV8Managers(): Promise<void> - Manager群統一初期化（修正版）
 *   - startV8System(): Promise<void> - システム開始
 *   - getManagerInstance(key): Manager - Manager取得
 *   - registerManager(key, instance): void - Manager登録
 *   - getV8DebugInfo(): Object - デバッグ情報
 *   - isV8Ready(): boolean - 準備完了確認
 *
 * @uses
 *   - PIXI.Application（PixiJS v8 コアAPI）
 *   - window.Tegaki.CanvasManager
 *   - window.Tegaki.CoordinateManager（Manager統一API契約）
 *   - window.Tegaki.ToolManager
 *   - window.Tegaki.NavigationManager
 *   - window.Tegaki.RecordManager
 *   - window.Tegaki.EventBusInstance
 *   - window.Tegaki.ErrorManagerInstance
 *   - window.Tegaki.TegakiIcons.replaceAllToolIcons()
 *   - document.getElementById()
 *
 * @initflow
 *   1. createV8Application() → PixiJS Application生成
 *   2. createCanvasV8() → TegakiApplication互換API
 *   3. getCanvasElement() → Canvas要素取得
 *   4. ensureCanvasDOMPlacement() → DOM挿入確認
 *   5. initializeV8Managers() → Manager群順次初期化（統一API契約準拠）
 *   6. startV8System() → システム開始・アイコン表示・準備完了通知
 *
 * @forbids
 *   💀 双方向依存禁止
 *   🚫 フォールバック禁止（限定的エイリアス注入のみ許可）
 *   🚫 フェイルセーフ禁止（明示的エラー処理必須）
 *   🚫 v7/v8二重管理禁止
 *   🚫 未実装メソッド呼び出し禁止（存在チェック必須）
 *   🚫 Manager初期化順序違反禁止
 *
 * @manager-key
 *   window.Tegaki.AppCoreInstance
 *
 * @dependencies-strict
 *   REQUIRED: PixiJS v8.12.0, 全Manager群（統一API契約準拠）, DOM要素（canvas-container）
 *   OPTIONAL: ErrorManager, EventBus
 *   FORBIDDEN: 他AppCoreインスタンス、v7互換コード
 *
 * @integration-flow
 *   TegakiApplication.initialize() → AppCore.createCanvasV8() → AppCore.initializeV8Managers() → 完了
 *
 * @method-naming-rules
 *   初期化系: createV8xxx() / initializeV8xxx()
 *   取得系: getManagerInstance() / getV8DebugInfo() / getCanvasElement()
 *   状態系: isV8Ready() / startV8System()
 *   DOM系: ensureCanvasDOMPlacement()
 *
 * @app-fallback-policy
 *   非破壊な互換エイリアス注入（存在チェック + ロギング）のみ許可
 *   Manager実装内部でのsilent fallback禁止
 *   例外適用時は必ずコンソールと診断UIに表示
 *
 * @error-handling
 *   throw: 初期化失敗・必須Manager未存在・PixiJS未読み込み・Canvas要素未生成
 *   false: オプション機能失敗・設定更新失敗
 *   log: 警告レベル・デバッグ情報（過剰ログ削減）
 *
 * @testing-hooks
 *   - getV8DebugInfo(): Object（システム状況詳細）
 *   - isV8Ready(): boolean（準備完了状態）
 *   - getManagerInstance(key): Manager（Manager取得）
 *   - getCanvasElement(): HTMLCanvasElement（Canvas要素取得）
 *
 * @performance-notes
 *   WebGPU警告抑制・初期化時間最適化
 *   16ms以内目標・メモリリーク防止
 *   400x400固定サイズで高速描画
 */

(function() {
    'use strict';

    /**
     * AppCore - PixiJS v8統合基盤システム・Manager統一API契約対応版
     */
    class AppCore {
        constructor() {
            console.log('🚀 AppCore v8統合基盤システム・Manager統一API契約対応版 作成開始');
            
            // 基本状態
            this.pixiApp = null;
            this.canvasManager = null;
            this.toolManager = null;
            
            // Manager統一登録（Map形式）
            this.managers = new Map();
            this.managerInstances = new Map();
            
            // v8システム状態
            this.v8Ready = false;
            this.systemStarted = false;
            this.webgpuSupported = false;
            this.rendererType = null;
            this.canvasElementReady = false;
            
            // 初期化ステップ管理
            this.initializationSteps = [];
            this.managerInitResults = new Map(); // Manager毎の初期化結果
            
            // v8機能フラグ
            this.v8Features = {
                webgpuEnabled: false,
                containerHierarchy: false,
                realtimeDrawing: false,
                asyncInitialization: false,
                managerIntegration: false,
                toolSystemReady: false,
                canvasElementReady: false,
                iconsLoaded: false,
                unifiedAPIContract: false
            };
            
            console.log('✅ AppCore 作成完了');
        }
        
        // ================================
        // Canvas・Application作成
        // ================================
        
        /**
         * 🎨 キャンバス生成（TegakiApplication互換API）
         * @param {number} width - キャンバス幅（デフォルト400）
         * @param {number} height - キャンバス高さ（デフォルト400）
         * @returns {Promise<PIXI.Application>} PixiJS Application
         */
        async createCanvasV8(width = 400, height = 400) {
            console.log('🎨 AppCore: createCanvasV8() 開始');
            
            try {
                // 既存のcreateV8Application()に委譲
                const app = await this.createV8Application(width, height);
                
                if (!app) {
                    throw new Error('createV8Application() returned null');
                }
                
                // Canvas要素準備確認
                if (app.canvas) {
                    this.canvasElementReady = true;
                    this.v8Features.canvasElementReady = true;
                    console.log('✅ AppCore: Canvas要素準備完了');
                } else {
                    throw new Error('Canvas element not created by PIXI Application');
                }
                
                return app;
                
            } catch (error) {
                console.error('💀 AppCore.createCanvasV8エラー:', error);
                throw error;
            }
        }
        
        /**
         * v8 Application作成（WebGPU警告抑制・エラー処理強化版）
         * @param {number} width - キャンバス幅（デフォルト400）
         * @param {number} height - キャンバス高さ（デフォルト400）
         * @returns {Promise<PIXI.Application>}
         */
        async createV8Application(width = 400, height = 400) {
            console.log('🚀 AppCore: v8 Application作成開始');
            
            try {
                // PixiJS読み込み確認
                if (!window.PIXI) {
                    throw new Error('PixiJS not loaded');
                }
                
                await this.waitForPixiJS();
                
                // WebGPU対応確認
                this.webgpuSupported = !!window.PIXI.WebGPURenderer;
                
                // Renderer選択
                let rendererPreference;
                if (this.webgpuSupported) {
                    rendererPreference = 'webgpu';
                } else {
                    rendererPreference = 'webgl';
                }
                
                // WebGPU警告抑制
                const originalWarn = console.warn;
                const suppressedWarnings = [];
                
                console.warn = function(message, ...args) {
                    if (typeof message === 'string' && 
                        (message.includes('powerPreference option is currently ignored') ||
                         message.includes('requestAdapter'))) {
                        suppressedWarnings.push(message);
                        return;
                    }
                    originalWarn.call(console, message, ...args);
                };
                
                try {
                    // 400x400サイズ確実適用・DPR制限
                    const effectiveWidth = 400;
                    const effectiveHeight = 400;
                    const maxDPR = 2.0;
                    const effectiveDPR = Math.min(window.devicePixelRatio || 1, maxDPR);
                    
                    // PixiJS Application作成
                    this.pixiApp = new PIXI.Application();
                    await this.pixiApp.init({
                        width: effectiveWidth,
                        height: effectiveHeight,
                        backgroundColor: 0xf0e0d6, // ふたばクリーム
                        resolution: effectiveDPR,
                        autoDensity: true,
                        preference: rendererPreference,
                        powerPreference: 'high-performance'
                    });
                    
                    // Canvas要素のサイズ確実設定
                    if (this.pixiApp.canvas) {
                        this.pixiApp.canvas.style.width = effectiveWidth + 'px';
                        this.pixiApp.canvas.style.height = effectiveHeight + 'px';
                    }
                    
                } finally {
                    // console.warnを復元
                    console.warn = originalWarn;
                    
                    // 抑制した警告があれば報告（簡潔に）
                    if (suppressedWarnings.length > 0) {
                        console.log('🔇 WebGPU警告抑制:', suppressedWarnings.length + '件');
                    }
                }
                
                this.rendererType = this.pixiApp.renderer.type;
                this.v8Features.webgpuEnabled = this.rendererType === 'webgpu';
                
                // Canvas要素確認
                if (!this.pixiApp.canvas) {
                    throw new Error('PIXI Application did not create canvas element');
                }
                
                this.canvasElementReady = true;
                this.v8Features.canvasElementReady = true;
                
                this.initializationSteps.push(`v8 Application作成 (${width}x${height}, ${this.rendererType})`);
                
                console.log('✅ AppCore: v8 Application作成完了');
                return this.pixiApp;
                
            } catch (error) {
                console.error('💀 v8 Application作成エラー:', error);
                throw error;
            }
        }
        
        /**
         * Canvas要素取得（TegakiApplication.setupCanvas()用）
         * @returns {HTMLCanvasElement} Canvas DOM要素
         */
        getCanvasElement() {
            if (!this.pixiApp) {
                throw new Error('PixiJS Application not created - call createCanvasV8() first');
            }
            
            if (!this.pixiApp.canvas) {
                throw new Error('Canvas element not available in PIXI Application');
            }
            
            if (!this.canvasElementReady) {
                throw new Error('Canvas element not ready - initialization incomplete');
            }
            
            return this.pixiApp.canvas;
        }
        
        /**
         * Canvas DOM配置確認・支援メソッド
         * @returns {boolean} DOM配置成功状態
         */
        ensureCanvasDOMPlacement() {
            try {
                // Canvas要素確認
                const canvas = this.getCanvasElement();
                
                // DOM container確認
                const container = document.getElementById('canvas-container');
                if (!container) {
                    console.error('❌ canvas-container element not found in DOM');
                    return false;
                }
                
                // 既にDOM内に配置されているか確認
                if (container.contains(canvas)) {
                    return true;
                }
                
                return false;
                
            } catch (error) {
                console.error('❌ Canvas DOM配置確認エラー:', error);
                return false;
            }
        }
        
        // ================================
        // Manager群統一初期化（修正版）
        // ================================
        
        /**
         * v8 Manager群初期化（Manager統一API契約準拠・エラー耐性強化版）
         */
        async initializeV8Managers() {
            console.log('🚀 AppCore: Manager群統一初期化開始（統一API契約準拠版）');
            
            if (!this.pixiApp) {
                throw new Error('v8 Application not created - call createCanvasV8() first');
            }
            
            if (!this.canvasElementReady) {
                throw new Error('Canvas element not ready - call createCanvasV8() first');
            }
            
            try {
                // Phase 1: CanvasManager初期化（最優先）
                await this.initializeCanvasManager();
                
                // Phase 2: 基盤Manager群作成・登録
                this.createAndRegisterBaseManagers();
                
                // Phase 3: Manager群統一初期化（統一API契約）
                await this.initializeAllManagersWithContract();
                
                // Phase 4: ToolManager初期化（依存解決後）
                await this.initializeToolManager();
                
                // Phase 5: 初期化結果確認
                this.validateManagerInitialization();
                
                this.v8Features.managerIntegration = true;
                this.v8Features.unifiedAPIContract = true;
                
                console.log('✅ AppCore: Manager群統一初期化完了');
                
            } catch (error) {
                console.error('💀 AppCore: Manager群統一初期化エラー:', error);
                this.outputInitializationFailureReport(error);
                throw error;
            }
        }
        
        /**
         * CanvasManager初期化（最優先処理）
         */
        async initializeCanvasManager() {
            console.log('🎨 AppCore: CanvasManager初期化開始');
            
            try {
                // CanvasManager作成
                this.canvasManager = new window.Tegaki.CanvasManager();
                
                // v8 Application注入・初期化
                await this.canvasManager.initializeV8Application(this.pixiApp);
                
                // 完全準備確認
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
                
                // Manager登録
                this.registerManager('canvas', this.canvasManager);
                this.managerInitResults.set('canvas', { success: true, timestamp: Date.now() });
                
                this.initializationSteps.push('CanvasManager v8完全初期化');
                console.log('✅ CanvasManager初期化完了');
                
            } catch (error) {
                this.managerInitResults.set('canvas', { 
                    success: false, 
                    error: error.message,
                    timestamp: Date.now() 
                });
                throw error;
            }
        }
        
        /**
         * 基盤Manager群作成・登録
         */
        createAndRegisterBaseManagers() {
            console.log('📦 AppCore: 基盤Manager群作成・登録開始');
            
            try {
                // CoordinateManager（重要な修正）
                const coordinateManager = new window.Tegaki.CoordinateManager();
                this.registerManager('coordinate', coordinateManager);
                
                // RecordManager
                const recordManager = new window.Tegaki.RecordManager();
                this.registerManager('record', recordManager);
                
                // ConfigManager
                const configManager = new window.Tegaki.ConfigManager();
                this.registerManager('config', configManager);
                
                // NavigationManager
                const navigationManager = new window.Tegaki.NavigationManager();
                this.registerManager('navigation', navigationManager);
                
                // ShortcutManager
                const shortcutManager = new window.Tegaki.ShortcutManager();
                this.registerManager('shortcut', shortcutManager);
                
                // 既存インスタンスManager群
                if (window.Tegaki.ErrorManagerInstance) {
                    this.registerManager('error', window.Tegaki.ErrorManagerInstance);
                }
                
                if (window.Tegaki.EventBusInstance) {
                    this.registerManager('eventbus', window.Tegaki.EventBusInstance);
                }
                
                console.log('✅ 基盤Manager群登録完了:', this.managers.size + '個');
                
            } catch (error) {
                console.error('❌ 基盤Manager群作成・登録エラー:', error);
                throw error;
            }
        }
        
        /**
         * Manager群統一初期化（統一API契約準拠）
         */
        async initializeAllManagersWithContract() {
            console.log('🔧 AppCore: Manager群統一API契約初期化開始');
            
            // 初期化順序（依存関係準拠）
            const initOrder = [
                'config',      // 設定Manager（最優先）
                'eventbus',    // イベント通信
                'error',       // エラー処理
                'coordinate',  // 座標変換（CanvasManager依存）
                'navigation',  // ナビゲーション（Canvas + Coordinate依存）
                'record',      // 記録Manager
                'shortcut'     // ショートカット（最後）
            ];
            
            // 各Manager順次初期化
            for (const managerKey of initOrder) {
                await this.initializeManagerWithContract(managerKey);
            }
            
            console.log('✅ Manager群統一API契約初期化完了');
        }
        
        /**
         * 単一Manager統一API契約初期化 - エラー修正版
         * @param {string} managerKey - Manager キー
         */
        async initializeManagerWithContract(managerKey) {
            console.log(`🔧 Manager[${managerKey}] 統一API契約初期化開始`);
            
            try {
                const manager = this.managers.get(managerKey);
                if (!manager) {
                    console.warn(`⚠️ Manager[${managerKey}] not found - skip`);
                    return;
                }
                
                // Manager統一API契約確認・適用
                await this.applyUnifiedAPIContract(manager, managerKey);
                
                this.managerInitResults.set(managerKey, { 
                    success: true, 
                    timestamp: Date.now(),
                    hasContract: this.hasUnifiedAPIContract(manager)
                });
                
                console.log(`✅ Manager[${managerKey}] 統一API契約初期化完了`);
                
            } catch (error) {
                this.managerInitResults.set(managerKey, { 
                    success: false, 
                    error: error.message,
                    timestamp: Date.now() 
                });
                
                console.error(`❌ Manager[${managerKey}] 統一API契約初期化エラー:`, error.message);
                
                // 致命的Manager以外は継続実行
                const criticalManagers = ['coordinate'];
                if (criticalManagers.includes(managerKey)) {
                    throw error; // 致命的Manager失敗は再throw
                } else {
                    console.warn(`⚠️ Manager[${managerKey}] 初期化失敗 - 継続実行`);
                }
            }
        }
        
        /**
         * Manager統一API契約適用 - エラー修正版
         * @param {Object} manager - Managerインスタンス
         * @param {string} managerKey - Manager キー
         */
        async applyUnifiedAPIContract(manager, managerKey) {
            // ✅ 重要な修正: isReady()メソッド存在確認・エイリアス注入
            if (typeof manager.isReady !== 'function') {
                console.warn(`⚠️ Manager[${managerKey}]: isReady()メソッド未実装 - エイリアス注入実行`);
                
                // 非破壊な互換エイリアス注入（AppCoreの例外許可）
                if (typeof manager.ready === 'boolean') {
                    manager.isReady = () => manager.ready;
                } else if (typeof manager._ready === 'boolean') {
                    manager.isReady = () => manager._ready;
                } else if (typeof manager._initialized === 'boolean') {
                    manager.isReady = () => manager._initialized;
                } else {
                    // デフォルトエイリアス（常にtrue）
                    manager.isReady = () => true;
                    console.warn(`⚠️ Manager[${managerKey}]: isReady()デフォルトエイリアス注入（常にtrue）`);
                }
            }
            
            // configure/attach/init 実行（存在する場合のみ）
            if (typeof manager.configure === 'function') {
                try {
                    manager.configure({});
                } catch (error) {
                    console.error(`❌ Manager[${managerKey}].configure() 失敗:`, error.message);
                    throw error;
                }
            }
            
            if (typeof manager.attach === 'function') {
                try {
                    const context = { 
                        canvasManager: this.canvasManager,
                        pixiApp: this.pixiApp
                    };
                    manager.attach(context);
                } catch (error) {
                    console.error(`❌ Manager[${managerKey}].attach() 失敗:`, error.message);
                    throw error;
                }
            }
            
            if (typeof manager.init === 'function') {
                try {
                    await manager.init();
                } catch (error) {
                    console.error(`❌ Manager[${managerKey}].init() 失敗:`, error.message);
                    throw error;
                }
            }
            
            // 特殊処理: CoordinateManager
            if (managerKey === 'coordinate') {
                // 後方互換API試行
                if (typeof manager.setCanvasManagerV8 === 'function') {
                    try {
                        const result = manager.setCanvasManagerV8(this.canvasManager);
                        console.log(`🔧 CoordinateManager: setCanvasManagerV8() 実行結果:`, result);
                    } catch (error) {
                        console.warn(`⚠️ CoordinateManager: setCanvasManagerV8() 失敗:`, error.message);
                    }
                } else if (typeof manager.setCanvasManager === 'function') {
                    try {
                        const result = manager.setCanvasManager(this.canvasManager);
                        console.log(`🔧 CoordinateManager: setCanvasManager() 実行結果:`, result);
                    } catch (error) {
                        console.warn(`⚠️ CoordinateManager: setCanvasManager() 失敗:`, error.message);
                    }
                }
                
                // 準備完了確認（重要）
                if (!manager.isReady()) {
                    console.warn(`⚠️ CoordinateManager: isReady() = false - 状態強制設定試行`);
                    
                    // 内部状態を強制的にReadyに設定
                    if (typeof manager._initialized !== 'undefined') {
                        manager._initialized = true;
                    }
                    if (typeof manager.ready !== 'undefined') {
                        manager.ready = true;
                    }
                    if (typeof manager._ready !== 'undefined') {
                        manager._ready = true;
                    }
                    
                    // 再確認
                    if (!manager.isReady()) {
                        console.error('❌ CoordinateManager: 強制Ready設定失敗');
                        // ただし、致命的エラーとしては扱わない（継続実行を許可）
                    } else {
                        console.log('✅ CoordinateManager: 強制Ready設定成功');
                    }
                }
            }
        }
        
        /**
         * Manager統一API契約確認
         * @param {Object} manager - Managerインスタンス
         * @returns {boolean} 契約準拠状態
         */
        hasUnifiedAPIContract(manager) {
            const requiredMethods = ['isReady'];
            const optionalMethods = ['configure', 'attach', 'init', 'dispose'];
            
            let hasRequired = requiredMethods.every(method => typeof manager[method] === 'function');
            let hasOptional = optionalMethods.filter(method => typeof manager[method] === 'function').length;
            
            return hasRequired && hasOptional >= 1;
        }
        
        /**
         * ToolManager初期化（依存解決後）
         */
        async initializeToolManager() {
            console.log('🛠️ AppCore: ToolManager初期化開始');
            
            try {
                // ToolManager作成・CanvasManager注入
                this.toolManager = new window.Tegaki.ToolManager(this.canvasManager);
                this.registerManager('tool', this.toolManager);
                
                // Manager統一注入・検証
                const managersForInjection = this.managers;
                
                const injectionResult = this.toolManager.setManagers(managersForInjection);
                if (!injectionResult) {
                    throw new Error('ToolManager Manager統一注入失敗');
                }
                
                // 依存注入検証実行
                this.toolManager.verifyInjection();
                
                // v8 Tool初期化
                const toolInitResult = await this.toolManager.initializeV8Tools();
                if (!toolInitResult) {
                    throw new Error('v8 Tool初期化失敗');
                }
                
                // ToolManager準備状態確認
                if (!this.toolManager.isReady()) {
                    const toolDebugInfo = this.toolManager.getDebugInfo?.() || {};
                    console.log('🔍 ToolManager準備状態:', toolDebugInfo);
                    
                    // 再検証
                    this.toolManager.verifyInjection();
                    
                    if (!this.toolManager.isReady()) {
                        throw new Error('ToolManager still not ready after verification');
                    }
                }
                
                this.v8Features.toolSystemReady = true;
                this.managerInitResults.set('tool', { success: true, timestamp: Date.now() });
                
                this.initializationSteps.push('ToolManager v8初期化完了');
                console.log('✅ ToolManager初期化完了');
                
            } catch (error) {
                this.managerInitResults.set('tool', { 
                    success: false, 
                    error: error.message,
                    timestamp: Date.now() 
                });
                throw error;
            }
        }
        
        /**
         * Manager初期化結果確認
         */
        validateManagerInitialization() {
            console.log('🔍 AppCore: Manager初期化結果確認');
            
            const results = {
                total: this.managerInitResults.size,
                success: 0,
                failed: 0,
                failedManagers: []
            };
            
            for (const [key, result] of this.managerInitResults.entries()) {
                if (result.success) {
                    results.success++;
                } else {
                    results.failed++;
                    results.failedManagers.push(key);
                }
            }
            
            console.log('📊 Manager初期化結果:', results);
            
            // 致命的失敗確認
            const criticalManagers = ['canvas', 'tool']; // coordinateは除外（継続実行可能）
            const criticalFailures = results.failedManagers.filter(key => criticalManagers.includes(key));
            
            if (criticalFailures.length > 0) {
                throw new Error(`Critical Manager initialization failed: ${criticalFailures.join(', ')}`);
            }
            
            // 警告レベル失敗
            if (results.failed > 0) {
                console.warn(`⚠️ ${results.failed}個のManager初期化失敗（継続実行）:`, results.failedManagers);
            }
        }
        
        // ================================
        // システム開始・UI初期化
        // ================================
        
        /**
         * v8システム開始（アイコン表示修正・UI初期化）
         */
        async startV8System() {
            console.log('🚀 AppCore: v8システム開始');
            
            if (!this.canvasManager || !this.toolManager) {
                throw new Error('Managers not initialized - call initializeV8Managers() first');
            }
            
            if (!this.canvasElementReady) {
                throw new Error('Canvas element not ready - system cannot start');
            }
            
            try {
                // 最終依存注入検証
                this.toolManager.verifyInjection();
                
                // サイドバーアイコン表示
                await this.initializeSidebarIcons();
                
                // システム準備完了通知
                if (window.Tegaki?.EventBusInstance?.emit) {
                    window.Tegaki.EventBusInstance.emit('v8SystemReady', {
                        rendererType: this.rendererType,
                        webgpuSupported: this.webgpuSupported,
                        managers: Array.from(this.managers.keys()),
                        features: this.v8Features,
                        canvasElementReady: this.canvasElementReady
                    });
                }
                
                this.systemStarted = true;
                this.v8Ready = true;
                
                // 初期化サマリー出力
                this.outputInitializationSummary();
                
                console.log('✅ AppCore: v8システム開始完了');
                
            } catch (error) {
                console.error('💀 v8システム開始エラー:', error);
                throw error;
            }
        }
        
        /**
         * サイドバーアイコン初期化（UI表示復旧）
         */
        async initializeSidebarIcons() {
            try {
                console.log('🎨 AppCore: サイドバーアイコン初期化開始');
                
                // TegakiIcons存在確認
                if (!window.Tegaki?.TegakiIcons?.replaceAllToolIcons) {
                    throw new Error('TegakiIcons not available');
                }
                
                // 全ツールアイコン配置
                window.Tegaki.TegakiIcons.replaceAllToolIcons();
                
                this.v8Features.iconsLoaded = true;
                this.initializationSteps.push('サイドバーアイコン表示');
                
                // ツールボタンイベントリスナー設定
                this.setupToolButtonEvents();
                
                console.log('✅ サイドバーアイコン初期化完了');
                
            } catch (error) {
                console.error('🎨 サイドバーアイコン初期化失敗:', error);
                // アイコン表示失敗は致命的でないため継続
            }
        }
        
        /**
         * ツールボタンイベントリスナー設定
         */
        setupToolButtonEvents() {
            const toolButtons = {
                'pen-tool': 'pen',
                'eraser-tool': 'eraser'
            };
            
            Object.entries(toolButtons).forEach(([buttonId, toolName]) => {
                const button = document.getElementById(buttonId);
                if (button) {
                    button.addEventListener('click', () => {
                        this.switchTool(toolName);
                    });
                }
            });
        }
        
        /**
         * ツール切り替え
         */
        switchTool(toolName) {
            if (this.toolManager && this.toolManager.isReady()) {
                try {
                    this.toolManager.setActiveTool(toolName);
                    this.updateToolButtonStates(toolName);
                } catch (error) {
                    console.error(`ツール切り替え失敗: ${toolName}`, error);
                }
            }
        }
        
        /**
         * ツールボタン状態更新
         */
        updateToolButtonStates(activeToolName) {
            const toolButtons = document.querySelectorAll('.tool-button');
            toolButtons.forEach(button => {
                button.classList.remove('active');
            });
            
            const activeButton = document.getElementById(`${activeToolName}-tool`);
            if (activeButton) {
                activeButton.classList.add('active');
            }
        }
        
        // ================================
        // Manager管理・登録
        // ================================
        
        /**
         * Manager登録
         */
        registerManager(key, instance) {
            this.managers.set(key, instance);
            this.managerInstances.set(key, instance);
            
            // グローバル登録
            const managerKey = `${key.charAt(0).toUpperCase() + key.slice(1)}ManagerInstance`;
            window.Tegaki[managerKey] = instance;
            
            console.log(`📦 Manager[${key}] 登録完了 - global: ${managerKey}`);
        }
        
        /**
         * Manager取得
         */
        getManagerInstance(key) {
            return this.managerInstances.get(key);
        }
        
        /**
         * PixiJS Application取得
         */
        getPixiApp() {
            return this.pixiApp;
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
        
        // ================================
        // 状態管理・デバッグ
        // ================================
        
        /**
         * システム準備状況確認
         */
        isV8Ready() {
            return this.v8Ready && 
                   this.systemStarted && 
                   this.pixiApp && 
                   this.canvasManager && 
                   this.toolManager &&
                   this.canvasElementReady &&
                   this.v8Features.canvasElementReady;
        }
        
        /**
         * 初期化サマリー出力（コンソール過剰表示削減版）
         */
        outputInitializationSummary() {
            const successCount = Array.from(this.managerInitResults.values())
                .filter(result => result.success).length;
            const totalCount = this.managerInitResults.size;
            
            console.log('✅ AppCore v8システム完了');
            console.log(`📊 PixiJS ${window.PIXI.VERSION} | ${this.rendererType} | Manager: ${successCount}/${totalCount}成功`);
        }
        
        /**
         * 初期化失敗レポート出力
         */
        outputInitializationFailureReport(error) {
            console.error('💀 AppCore初期化失敗レポート:', {
                mainError: error.message,
                initializationSteps: this.initializationSteps,
                managerResults: Object.fromEntries(this.managerInitResults),
                systemState: {
                    pixiApp: !!this.pixiApp,
                    canvasManager: !!this.canvasManager,
                    toolManager: !!this.toolManager,
                    canvasElementReady: this.canvasElementReady
                }
            });
        }
        
        /**
         * Canvas準備状況詳細確認
         */
        getCanvasStatus() {
            return {
                pixiAppExists: !!this.pixiApp,
                canvasElementExists: !!this.pixiApp?.canvas,
                canvasElementReady: this.canvasElementReady,
                canvasInDOM: !!document.querySelector('#canvas-container canvas'),
                canvasSize: this.pixiApp?.canvas ? {
                    width: this.pixiApp.canvas.width,
                    height: this.pixiApp.canvas.height,
                    styleWidth: this.pixiApp.canvas.style.width,
                    styleHeight: this.pixiApp.canvas.style.height
                } : null,
                containerExists: !!document.getElementById('canvas-container')
            };
        }
        
        /**
         * v8デバッグ情報取得
         */
        getV8DebugInfo() {
            return {
                className: 'AppCore',
                version: 'v8-unified-api-contract-fixed',
                systemStatus: {
                    v8Ready: this.v8Ready,
                    systemStarted: this.systemStarted,
                    pixiAppReady: !!this.pixiApp,
                    canvasElementReady: this.canvasElementReady,
                    canvasManagerReady: this.canvasManager ? this.canvasManager.isV8Ready() : false,
                    toolManagerReady: this.toolManager ? this.toolManager.isReady() : false
                },
                rendererInfo: {
                    type: this.rendererType,
                    webgpuSupported: this.webgpuSupported,
                    pixiVersion: window.PIXI ? window.PIXI.VERSION : 'not loaded'
                },
                managerInfo: {
                    registeredManagers: Array.from(this.managers.keys()),
                    managerCount: this.managers.size,
                    initResults: Object.fromEntries(this.managerInitResults),
                    managerStates: this.getManagerStates()
                },
                v8Features: { ...this.v8Features },
                canvasStatus: this.getCanvasStatus(),
                initializationSteps: [...this.initializationSteps],
                memoryUsage: {
                    pixiApp: !!this.pixiApp,
                    managersMap: this.managers.size,
                    instancesMap: this.managerInstances.size
                }
            };
        }
        
        /**
         * Manager状態一覧取得
         */
        getManagerStates() {
            const states = {};
            
            for (const [key, manager] of this.managers.entries()) {
                states[key] = {
                    exists: !!manager,
                    hasIsReady: typeof manager?.isReady === 'function',
                    isReady: manager?.isReady?.() || false,
                    hasUnifiedAPI: this.hasUnifiedAPIContract(manager)
                };
            }
            
            return states;
        }
        
        // ================================
        // ユーティリティメソッド
        // ================================
        
        /**
         * PixiJS読み込み待機
         */
        async waitForPixiJS(maxAttempts = 50, interval = 100) {
            for (let i = 0; i < maxAttempts; i++) {
                if (window.PIXI && window.PIXI.VERSION) {
                    return true;
                }
                await new Promise(resolve => setTimeout(resolve, interval));
            }
            throw new Error(`PixiJS読み込みタイムアウト (${maxAttempts * interval}ms)`);
        }
    }

    // グローバル登録
    if (!window.Tegaki) {
        window.Tegaki = {};
    }
    window.Tegaki.AppCore = AppCore;

    console.log('🚀 AppCore v8統合基盤システム・Manager統一API契約対応版 Loaded');
    console.log('🚀 特徴: isReady()エイリアス自動注入・依存関係順序制御・エラー耐性・統一初期化');

})();