/**
 * 📄 FILE: js/app-core.js
 * 📌 RESPONSIBILITY: PixiJS v8統合基盤システム・Manager群統一初期化・システム制御
 * 
 * @provides
 *   - AppCore（クラス）
 *   - createV8Application(): PIXI.Application
 *   - createCanvasV8(width, height): PIXI.Application
 *   - getCanvasElement(): HTMLCanvasElement
 *   - ensureCanvasDOMPlacement(): void
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
 *   - document.getElementById()（DOM操作）
 *
 * @initflow
 *   1. createV8Application() → PixiJS Application生成
 *   2. createCanvasV8() → TegakiApplication互換API
 *   3. getCanvasElement() → Canvas要素取得
 *   4. ensureCanvasDOMPlacement() → DOM挿入確認
 *   5. initializeV8Managers() → Manager群順次初期化
 *   6. startV8System() → システム開始・準備完了通知
 *
 * @forbids
 *   💀 双方向依存禁止
 *   🚫 フォールバック禁止
 *   🚫 フェイルセーフ禁止
 *   🚫 v7/v8二重管理禁止
 *   🚫 未実装メソッド呼び出し禁止
 *   🚫 WebGPU警告垂れ流し禁止
 *   🚫 Canvas DOM挿入責任分散禁止
 *
 * @manager-key
 *   window.Tegaki.AppCoreInstance
 *
 * @dependencies-strict
 *   REQUIRED: PixiJS v8.12.0, 全Manager群（CanvasManager, ToolManager等）, DOM要素（canvas-container）
 *   OPTIONAL: ErrorManager, EventBus
 *   FORBIDDEN: 他AppCoreインスタンス、v7互換コード
 *
 * @integration-flow
 *   TegakiApplication.initialize() → AppCore.createCanvasV8() → AppCore.getCanvasElement()
 *   → TegakiApplication.setupCanvas() → AppCore.initializeV8Managers() → 完了
 *
 * @method-naming-rules
 *   初期化系: createV8xxx() / initializeV8xxx()
 *   取得系: getManagerInstance() / getV8DebugInfo() / getCanvasElement()
 *   状態系: isV8Ready() / startV8System()
 *   DOM系: ensureCanvasDOMPlacement()
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
     * AppCore - PixiJS v8統合基盤システム
     * DOM挿入支援・Canvas要素取得修正版
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
            this.canvasElementReady = false;
            
            // 初期化ステップ管理
            this.initializationSteps = [];
            
            // v8機能フラグ
            this.v8Features = {
                webgpuEnabled: false,
                containerHierarchy: false,
                realtimeDrawing: false,
                asyncInitialization: false,
                managerIntegration: false,
                toolSystemReady: false,
                canvasElementReady: false
            };
            
            console.log('✅ AppCore v8統合基盤システム 作成完了');
        }
        
        /**
         * 🎨 キャンバス生成（TegakiApplication互換API）
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
                
                // Canvas要素準備確認
                if (app.canvas) {
                    this.canvasElementReady = true;
                    this.v8Features.canvasElementReady = true;
                    console.log('✅ Canvas要素準備完了');
                } else {
                    throw new Error('Canvas element not created by PIXI Application');
                }
                
                console.log(`✅ AppCore.createCanvasV8完了 - ${width}x${height}キャンバス生成`);
                return app;
                
            } catch (error) {
                console.error('💀 AppCore.createCanvasV8エラー:', error);
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
         * Canvas DOM配置確認・支援メソッド（TegakiApplication用）
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
                    console.log('✅ Canvas already properly placed in DOM');
                    return true;
                }
                
                // DOM配置が必要な場合は警告（TegakiApplicationが責任を持つ）
                console.warn('⚠️ Canvas not found in DOM - TegakiApplication.setupCanvas() should handle insertion');
                return false;
                
            } catch (error) {
                console.error('❌ Canvas DOM配置確認エラー:', error);
                return false;
            }
        }
        
        /**
         * Canvas準備状況詳細確認（デバッグ用）
         * @returns {Object} Canvas状態詳細
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
         * v8 Application作成（WebGPU警告抑制・エラー処理強化版）
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
                
                await this.waitForPixiJS();
                console.log('✅ PixiJS v8確認完了:', window.PIXI.VERSION);
                
                // WebGPU対応確認
                this.webgpuSupported = !!window.PIXI.WebGPURenderer;
                
                // Renderer選択とApplication作成
                let rendererPreference;
                if (this.webgpuSupported) {
                    rendererPreference = 'webgpu';
                } else {
                    rendererPreference = 'webgl';
                }
                
                // WebGPU警告抑制：console.warnをフック
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
                    // 400x400サイズ確実適用・DPR制限
                    const effectiveWidth = 400;
                    const effectiveHeight = 400;
                    const maxDPR = 2.0;
                    const effectiveDPR = Math.min(window.devicePixelRatio || 1, maxDPR);
                    
                    // PixiJS Application作成（400x400固定・警告抑制）
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
                    
                    // 抑制した警告の統計出力（デバッグ用）
                    if (suppressedWarnings.length > 0) {
                        console.log(`🔇 WebGPU警告抑制: ${suppressedWarnings.length}件`);
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
                
                console.log(`✅ AppCore - v8 Application作成完了 (${width}x${height})`);
                this.initializationSteps.push(`v8 Application作成 (${width}x${height})`);
                
                return this.pixiApp;
                
            } catch (error) {
                console.error('💀 v8 Application作成エラー:', error);
                throw error;
            }
        }
        
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
        
        /**
         * v8 Manager群初期化（統一登録・初期化順序修正・依存注入検証強化版）
         */
        async initializeV8Managers() {
            console.log('🔧 AppCore - v8 Manager群初期化開始');
            
            if (!this.pixiApp) {
                throw new Error('v8 Application not created - call createCanvasV8() first');
            }
            
            if (!this.canvasElementReady) {
                throw new Error('Canvas element not ready - call createCanvasV8() first');
            }
            
            try {
                // Step 1: CanvasManager v8初期化
                console.log('1️⃣ CanvasManager v8初期化開始...');
                this.canvasManager = new window.Tegaki.CanvasManager();
                
                await this.canvasManager.initializeV8Application(this.pixiApp);
                console.log('✅ CanvasManager v8 Application設定完了');
                
                // CanvasManager完全準備確認
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
                
                console.log('✅ Step 1: CanvasManager v8完全初期化完了');
                this.initializationSteps.push('CanvasManager v8完全初期化');
                
                // Step 2: Manager統一登録
                console.log('2️⃣ Manager統一登録開始...');
                
                // CanvasManager登録
                this.registerManager('canvas', this.canvasManager);
                
                // 他Manager群作成・登録
                this.createAndRegisterManagers();
                
                console.log('✅ Step 2: Manager統一登録完了');
                this.initializationSteps.push('Manager統一登録');
                
                // Step 3: ToolManager v8初期化（依存注入検証強化版）
                console.log('3️⃣ ToolManager v8初期化開始...');
                
                // ToolManager作成前最終確認
                if (!this.canvasManager.isV8Ready()) {
                    throw new Error('CanvasManager not ready for ToolManager initialization');
                }
                
                // CanvasManager参照情報（ToolManager用）
                const canvasManagerForTool = this.canvasManager;
                
                // ToolManager作成・CanvasManager注入
                this.toolManager = new window.Tegaki.ToolManager(canvasManagerForTool);
                console.log('✅ ToolManager作成成功');
                
                this.registerManager('tool', this.toolManager);
                
                // ToolManager Manager統一注入・検証
                const managersForInjection = this.managers;
                
                const injectionResult = this.toolManager.setManagers(managersForInjection);
                if (!injectionResult) {
                    throw new Error('ToolManager Manager統一注入失敗');
                }
                console.log('✅ ToolManager.setManagers() 成功');
                
                // 依存注入検証実行
                this.toolManager.verifyInjection();
                console.log('✅ ToolManager依存注入検証PASS');
                
                // v8 Tool初期化
                const toolInitResult = await this.toolManager.initializeV8Tools();
                if (!toolInitResult) {
                    throw new Error('v8 Tool初期化失敗');
                }
                console.log('✅ ToolManager v8ツール初期化完了');
                
                // ToolManager準備状態確認
                if (!this.toolManager.isReady()) {
                    const toolDebugInfo = this.toolManager.getDebugInfo?.() || {};
                    console.log('🔍 ToolManager準備状態:', toolDebugInfo);
                    
                    this.toolManager.verifyInjection();
                    
                    if (!this.toolManager.isReady()) {
                        throw new Error('ToolManager still not ready after verification');
                    }
                }
                
                console.log('✅ Step 3: ToolManager v8初期化完了');
                this.initialization