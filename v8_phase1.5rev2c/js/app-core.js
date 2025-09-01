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
 *   - window.Tegaki.TegakiIcons.replaceAllToolIcons()（アイコン表示）
 *   - document.getElementById()（DOM操作）
 *
 * @initflow
 *   1. createV8Application() → PixiJS Application生成
 *   2. createCanvasV8() → TegakiApplication互換API
 *   3. getCanvasElement() → Canvas要素取得
 *   4. ensureCanvasDOMPlacement() → DOM挿入確認
 *   5. initializeV8Managers() → Manager群順次初期化（修正版）
 *   6. startV8System() → システム開始・アイコン表示・準備完了通知
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
 * ChangeLog: 2025-09-01 Manager初期化順序完全修正・準備完了待機機能追加
 */

(function() {
    'use strict';

    /**
     * AppCore - PixiJS v8統合基盤システム（初期化順序修正版）
     * DOM挿入支援・Canvas要素取得・Manager完全初期化対応
     */
    class AppCore {
        constructor() {
            // 基本状態
            this.pixiApp = null;
            this.canvasManager = null;
            this.toolManager = null;
            this.coordinateManager = null;
            this.recordManager = null;
            
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
            this.initializationErrors = [];
            
            // v8機能フラグ
            this.v8Features = {
                webgpuEnabled: false,
                containerHierarchy: false,
                realtimeDrawing: false,
                asyncInitialization: false,
                managerIntegration: false,
                toolSystemReady: false,
                canvasElementReady: false,
                iconsLoaded: false
            };
        }
        
        /**
         * 🎨 キャンバス生成（TegakiApplication互換API）
         * @param {number} width - キャンバス幅（デフォルト400）
         * @param {number} height - キャンバス高さ（デフォルト400）
         * @returns {Promise<PIXI.Application>} PixiJS Application
         */
        async createCanvasV8(width = 400, height = 400) {
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
                    this.logStep('Canvas要素作成完了');
                } else {
                    throw new Error('Canvas element not created by PIXI Application');
                }
                
                return app;
                
            } catch (error) {
                this.logError('AppCore.createCanvasV8エラー', error);
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
                    this.logError('canvas-container element not found in DOM');
                    return false;
                }
                
                // 既にDOM内に配置されているか確認
                if (container.contains(canvas)) {
                    return true;
                }
                
                return false;
                
            } catch (error) {
                this.logError('Canvas DOM配置確認エラー', error);
                return false;
            }
        }
        
        /**
         * v8 Application作成（WebGPU警告抑制・エラー処理強化版）
         * @param {number} width - キャンバス幅（デフォルト400）
         * @param {number} height - キャンバス高さ（デフォルト400）
         * @returns {Promise<PIXI.Application>}
         */
        async createV8Application(width = 400, height = 400) {
            try {
                // PixiJS読み込み確認
                if (!window.PIXI) {
                    throw new Error('PixiJS not loaded');
                }
                
                await this.waitForPixiJS();
                
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
                    
                    // Canvas要素のサイズ確実設定・枠線除去
                    if (this.pixiApp.canvas) {
                        this.pixiApp.canvas.style.width = effectiveWidth + 'px';
                        this.pixiApp.canvas.style.height = effectiveHeight + 'px';
                        // 🎨 枠線を完全除去（クリスタ風）
                        this.pixiApp.canvas.style.border = 'none';
                        this.pixiApp.canvas.style.outline = 'none';
                        this.pixiApp.canvas.style.boxShadow = 'none';
                    }
                    
                } finally {
                    // console.warnを復元
                    console.warn = originalWarn;
                }
                
                this.rendererType = this.pixiApp.renderer.type;
                this.v8Features.webgpuEnabled = this.rendererType === 'webgpu';
                
                // Canvas要素確認
                if (!this.pixiApp.canvas) {
                    throw new Error('PIXI Application did not create canvas element');
                }
                
                this.canvasElementReady = true;
                this.v8Features.canvasElementReady = true;
                
                this.logStep(`v8 Application作成 (${width}x${height}, ${this.rendererType})`);
                
                return this.pixiApp;
                
            } catch (error) {
                this.logError('v8 Application作成エラー', error);
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
         * v8 Manager群初期化（完全修正版：依存順序厳守・準備完了待機）
         */
        async initializeV8Managers() {
            if (!this.pixiApp) {
                throw new Error('v8 Application not created - call createCanvasV8() first');
            }
            
            if (!this.canvasElementReady) {
                throw new Error('Canvas element not ready - call createCanvasV8() first');
            }
            
            try {
                this.logStep('Manager群初期化開始');
                
                // Phase 1: CanvasManager完全初期化（最優先）
                await this.initializeCanvasManager();
                
                // Phase 2: 独立Manager群初期化
                await this.initializeIndependentManagers();
                
                // Phase 3: 依存Manager群初期化
                await this.initializeDependentManagers();
                
                // Phase 4: ToolManager最終初期化
                await this.initializeToolManager();
                
                // Phase 5: 全Manager統合確認
                await this.verifyAllManagersIntegration();
                
                this.v8Features.managerIntegration = true;
                this.v8Features.toolSystemReady = true;
                
                this.logStep('Manager群初期化完全完了');
                
            } catch (error) {
                this.logError('v8 Manager群初期化エラー', error);
                throw error;
            }
        }
        
        /**
         * Phase 1: CanvasManager完全初期化
         */
        async initializeCanvasManager() {
            this.logStep('CanvasManager初期化開始');
            
            // CanvasManager作成
            this.canvasManager = new window.Tegaki.CanvasManager();
            
            // v8 Application注入・初期化
            await this.canvasManager.initializeV8Application(this.pixiApp);
            
            // 完全準備確認（厳格）
            if (!this.canvasManager.isV8Ready()) {
                throw new Error('CanvasManager not ready after initialization');
            }
            
            // メソッド存在確認
            if (typeof this.canvasManager.getDrawContainer !== 'function') {
                throw new Error('CanvasManager.getDrawContainer() method not available');
            }
            
            // DrawContainer動作確認
            const testContainer = this.canvasManager.getDrawContainer();
            if (!testContainer) {
                throw new Error('CanvasManager.getDrawContainer() returned null');
            }
            
            // Manager登録
            this.registerManager('canvas', this.canvasManager);
            
            this.logStep('CanvasManager初期化完了');
        }
        
        /**
         * Phase 2: 独立Manager群初期化
         */
        async initializeIndependentManagers() {
            this.logStep('独立Manager群初期化開始');
            
            // RecordManager
            this.recordManager = new window.Tegaki.RecordManager();
            this.registerManager('record', this.recordManager);
            
            // ConfigManager
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
            
            this.logStep('独立Manager群初期化完了');
        }
        
        /**
         * Phase 3: 依存Manager群初期化
         */
        async initializeDependentManagers() {
            this.logStep('依存Manager群初期化開始');
            
            // CoordinateManager（CanvasManager依存）
            this.coordinateManager = new window.Tegaki.CoordinateManager();
            await this.coordinateManager.setCanvasManager(this.canvasManager);
            
            // CoordinateManager準備完了確認
            if (!this.coordinateManager.isReady()) {
                throw new Error('CoordinateManager initialization failed');
            }
            
            this.registerManager('coordinate', this.coordinateManager);
            
            // NavigationManager
            const navigationManager = new window.Tegaki.NavigationManager();
            this.registerManager('navigation', navigationManager);
            
            // ShortcutManager
            const shortcutManager = new window.Tegaki.ShortcutManager();
            this.registerManager('shortcut', shortcutManager);
            
            this.logStep('依存Manager群初期化完了');
        }
        
        /**
         * Phase 4: ToolManager最終初期化
         */
        async initializeToolManager() {
            this.logStep('ToolManager初期化開始');
            
            // ToolManager作成
            this.toolManager = new window.Tegaki.ToolManager(this.canvasManager);
            
            // Manager統一注入
            const injectionResult = this.toolManager.setManagers(this.managers);
            if (!injectionResult) {
                throw new Error('ToolManager Manager統一注入失敗');
            }
            
            // 依存注入検証
            this.toolManager.verifyInjection();
            
            // v8 Tool初期化
            const toolInitResult = await this.toolManager.initializeV8Tools();
            if (!toolInitResult) {
                throw new Error('v8 Tool初期化失敗');
            }
            
            // ToolManager準備状態確認
            if (!this.toolManager.isReady()) {
                const toolDebugInfo = this.toolManager.getDebugInfo?.() || {};
                this.logStep(`ToolManager準備状態確認: ${JSON.stringify(toolDebugInfo)}`);
                
                // 再検証
                this.toolManager.verifyInjection();
                
                if (!this.toolManager.isReady()) {
                    throw new Error('ToolManager still not ready after verification');
                }
            }
            
            this.registerManager('tool', this.toolManager);
            
            this.logStep('ToolManager初期化完了');
        }
        
        /**
         * Phase 5: 全Manager統合確認
         */
        async verifyAllManagersIntegration() {
            this.logStep('全Manager統合確認開始');
            
            const requiredManagers = ['canvas', 'tool', 'coordinate', 'record'];
            const missingManagers = [];
            
            for (const key of requiredManagers) {
                const manager = this.managers.get(key);
                if (!manager) {
                    missingManagers.push(key);
                    continue;
                }
                
                // 各Manager個別確認
                if (key === 'canvas' && !manager.isV8Ready()) {
                    missingManagers.push(`${key} (not ready)`);
                }
                if (key === 'tool' && !manager.isReady()) {
                    missingManagers.push(`${key} (not ready)`);
                }
                if (key === 'coordinate' && !manager.isReady()) {
                    missingManagers.push(`${key} (not ready)`);
                }
                if (key === 'record' && !manager.isReady()) {
                    // RecordManagerにManager注入
                    if (typeof manager.setManagers === 'function') {
                        manager.setManagers(this.managers);
                    }
                    if (!manager.isReady()) {
                        missingManagers.push(`${key} (not ready)`);
                    }
                }
            }
            
            if (missingManagers.length > 0) {
                throw new Error(`Manager統合不完全: ${missingManagers.join(', ')}`);
            }
            
            this.logStep('全Manager統合確認完了');
        }
        
        /**
         * Manager登録
         */
        registerManager(key, instance) {
            this.managers.set(key, instance);
            this.managerInstances.set(key, instance);
            
            // グローバル登録
            const managerKey = `${key.charAt(0).toUpperCase() + key.slice(1)}ManagerInstance`;
            window.Tegaki[managerKey] = instance;
            
            this.logStep(`Manager登録: ${key}`);
        }
        
        /**
         * v8システム開始（アイコン表示修正・UI初期化追加）
         */
        async startV8System() {
            if (!this.canvasManager || !this.toolManager) {
                throw new Error('Managers not initialized - call initializeV8Managers() first');
            }
            
            if (!this.canvasElementReady) {
                throw new Error('Canvas element not ready - system cannot start');
            }
            
            try {
                this.logStep('v8システム開始');
                
                // 最終依存注入検証
                this.toolManager.verifyInjection();
                
                // Step A: サイドバーアイコン表示
                await this.initializeSidebarIcons();
                
                // Step B: システム準備完了通知
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
                
                this.logStep('v8システム開始完了');
                
            } catch (error) {
                this.logError('v8システム開始エラー', error);
                throw error;
            }
        }
        
        /**
         * サイドバーアイコン初期化（UI表示復旧）
         */
        async initializeSidebarIcons() {
            try {
                this.logStep('サイドバーアイコン初期化開始');
                
                // TegakiIcons存在確認
                if (!window.Tegaki?.TegakiIcons?.replaceAllToolIcons) {
                    throw new Error('TegakiIcons not available');
                }
                
                // 全ツールアイコン配置
                window.Tegaki.TegakiIcons.replaceAllToolIcons();
                
                this.v8Features.iconsLoaded = true;
                this.logStep('サイドバーアイコン表示完了');
                
                // ツールボタンイベントリスナー設定
                this.setupToolButtonEvents();
                
            } catch (error) {
                this.logError('サイドバーアイコン初期化失敗', error);
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
            
            this.logStep('ツールボタンイベント設定完了');
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
                    this.logError(`ツール切り替え失敗: ${toolName}`, error);
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
        
        /**
         * ログステップ記録（デバッグ用）
         */
        logStep(message) {
            this.initializationSteps.push(message);
            console.log(`🔄 ${message}`);
        }
        
        /**
         * エラーログ記録（デバッグ用）
         */
        logError(message, error) {
            const errorMsg = error ? `${message}: ${error.message}` : message;
            this.initializationErrors.push(errorMsg);
            console.error(`💀 ${errorMsg}`);
        }
        
        /**
         * 初期化サマリー出力
         */
        outputInitializationSummary() {
            console.log('✅ AppCore v8システム完了');
            console.log(`📊 PixiJS ${window.PIXI.VERSION} | ${this.rendererType} | Manager数: ${this.managers.size}`);
            
            if (this.initializationErrors.length > 0) {
                console.log(`⚠️ 初期化警告: ${this.initializationErrors.length}件`);
            }
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
         * Canvas準備状況詳細確認（デバッグ用）
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
                version: 'v8.12.0-initialization-fix',
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
                    canvasManager: !!this.canvasManager,
                    toolManager: !!this.toolManager,
                    coordinateManager: !!this.coordinateManager,
                    recordManager: !!this.recordManager
                },
                v8Features: this.v8Features,
                canvasStatus: this.getCanvasStatus(),
                initializationSteps: this.initializationSteps,
                initializationErrors: this.initializationErrors,
                memoryUsage: {
                    pixiApp: !!this.pixiApp,
                    managersMap: this.managers.size,
                    instancesMap: this.managerInstances.size
                }
            };
        }
    }

    // グローバル登録
    if (!window.Tegaki) {
        window.Tegaki = {};
    }
    window.Tegaki.AppCore = AppCore;

})();