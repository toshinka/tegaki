/**
 * 📄 FILE: js/app-core.js
 * 📌 RESPONSIBILITY: PixiJS v8統合基盤システム・Manager群統一初期化・システム制御
 * ChangeLog: 2025-09-01 <CanvasManager初期化順序修正・依存関係確立・架空メソッド防止システム実装>
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
 *   - verifyManagerMethods(manager, methods): boolean
 *   - emitAppReady(): void
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
 *   5. initializeV8Managers() → Manager群順次初期化（依存順序厳守）
 *      5a. CanvasManager.configure/attach/init/initializeV8Application
 *      5b. CoordinateManager初期化（CanvasManager依存）
 *      5c. 他Manager群初期化
 *      5d. ToolManager初期化・依存注入・検証
 *   6. startV8System() → システム開始・アイコン表示・準備完了通知
 *   7. emitAppReady() → UI系初期化開始通知
 *
 * @forbids
 *   💀 双方向依存禁止
 *   🚫 フォールバック禁止
 *   🚫 フェイルセーフ禁止
 *   🚫 v7/v8二重管理禁止
 *   🚫 未実装メソッド呼び出し禁止（verifyManagerMethods()で防止）
 *   🚫 WebGPU警告垂れ流し禁止
 *   🚫 Canvas DOM挿入責任分散禁止
 *   🚫 Manager初期化順序違反禁止
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
 *   → TegakiApplication.setupCanvas() → AppCore.initializeV8Managers() → AppCore.startV8System() → 完了
 *
 * @method-naming-rules
 *   初期化系: createV8xxx() / initializeV8xxx()
 *   取得系: getManagerInstance() / getV8DebugInfo() / getCanvasElement()
 *   状態系: isV8Ready() / startV8System()
 *   DOM系: ensureCanvasDOMPlacement()
 *   検証系: verifyManagerMethods() / verifManagerInitialization()
 *   
 * @error-handling
 *   throw: 初期化失敗・必須Manager未存在・PixiJS未読み込み・Canvas要素未生成・依存関係違反
 *   false: オプション機能失敗・設定更新失敗
 *   log: 警告レベル・デバッグ情報（過剰ログ削減）
 *
 * @testing-hooks
 *   - getV8DebugInfo(): Object（システム状況詳細）
 *   - isV8Ready(): boolean（準備完了状態）
 *   - getManagerInstance(key): Manager（Manager取得）
 *   - getCanvasElement(): HTMLCanvasElement（Canvas要素取得）
 *   - verifyManagerMethods(manager, methods): boolean（メソッド実装確認）
 *
 * @performance-notes
 *   WebGPU警告抑制・初期化時間最適化
 *   16ms以内目標・メモリリーク防止
 *   400x400固定サイズで高速描画
 *   架空メソッド呼び出し防止による実行時エラー削減
 *
 * @coordinate-contract
 *   CanvasManager.getApplication()経由でCoordinateManagerにPixiJS Application提供
 *   座標変換はCoordinateManager一元管理
 *   DPR補正は一回のみ適用
 *
 * @event-contract
 *   EventBus 'app:ready' 通知でUI系初期化開始
 *   Manager初期化完了後のみイベント発火
 *   エラー発生時は 'app:not-ready' 通知
 */

(function() {
    'use strict';

    /**
     * AppCore - PixiJS v8統合基盤システム
     * Manager初期化順序修正版・架空メソッド防止システム搭載
     */
    class AppCore {
        constructor() {
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
            
            // Manager契約定義（架空メソッド防止）
            this.managerContracts = {
                lifecycle: ['configure', 'attach', 'init', 'isReady', 'dispose'],
                canvasManager: ['getApplication', 'getDrawContainer', 'createStrokeGraphics', 'getCanvasElement', 'initializeV8Application', 'isV8Ready'],
                toolManager: ['setActiveTool', 'getCurrentTool', 'initializeV8Tools', 'setManagers', 'verifyInjection', 'isReady'],
                coordinateManager: ['clientToWorld', 'screenToCanvas', 'setCanvasManager', 'isReady'],
                recordManager: ['addStroke', 'isReady'],
                tool: ['setManagersObject', 'onPointerDown', 'onPointerMove', 'onPointerUp', 'forceEndDrawing', 'destroy', 'getState']
            };
            
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
                coordinateSystemReady: false,
                dependencyVerificationEnabled: true
            };
        }

        // ========================================
        // 架空メソッド防止システム（重要な追加）
        // ========================================

        /**
         * Manager実装メソッド確認（架空メソッド防止）
         * @param {Object} manager - 確認対象Manager
         * @param {Array<string>} requiredMethods - 必須メソッド名リスト
         * @param {string} managerName - Manager名（エラー表示用）
         * @returns {boolean} 全メソッド実装済みフラグ
         */
        verifyManagerMethods(manager, requiredMethods, managerName = 'Unknown') {
            if (!manager) {
                throw new Error(`Manager ${managerName} is null or undefined`);
            }

            const missing = requiredMethods.filter(method => 
                typeof manager[method] !== 'function'
            );
            
            if (missing.length > 0) {
                throw new Error(`Missing methods in ${managerName}: ${missing.join(', ')}`);
            }
            
            console.log(`✅ ${managerName} method verification passed`);
            return true;
        }

        /**
         * Manager契約確認（段階的検証）
         * @param {string} contractType - 契約種別
         * @param {Object} manager - 確認対象Manager
         * @param {string} managerName - Manager名
         */
        verifyManagerContract(contractType, manager, managerName) {
            if (!this.managerContracts[contractType]) {
                throw new Error(`Unknown contract type: ${contractType}`);
            }

            return this.verifyManagerMethods(
                manager, 
                this.managerContracts[contractType], 
                managerName
            );
        }

        /**
         * Manager準備状態確認（isReady()検証）
         * @param {Object} manager - 確認対象Manager
         * @param {string} managerName - Manager名
         * @returns {boolean} 準備完了状態
         */
        verifyManagerReady(manager, managerName) {
            if (typeof manager.isReady !== 'function') {
                throw new Error(`${managerName}.isReady() method not implemented`);
            }

            const ready = manager.isReady();
            if (!ready) {
                // デバッグ情報取得（可能なら）
                const debugInfo = typeof manager.getDebugInfo === 'function' ? 
                    manager.getDebugInfo() : 
                    { status: 'no debug info available' };
                
                throw new Error(`${managerName} not ready. Debug info: ${JSON.stringify(debugInfo, null, 2)}`);
            }

            console.log(`✅ ${managerName} ready state verified`);
            return true;
        }

        // ========================================
        // Canvas作成・要素管理（既存機能）
        // ========================================
        
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
                    return true;
                }
                
                return false;
                
            } catch (error) {
                console.error('❌ Canvas DOM配置確認エラー:', error);
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
                    
                    // Canvas要素のサイズ確実設定
                    if (this.pixiApp.canvas) {
                        this.pixiApp.canvas.style.width = effectiveWidth + 'px';
                        this.pixiApp.canvas.style.height = effectiveHeight + 'px';
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

        // ========================================
        // Manager群初期化（修正版・依存順序厳守）
        // ========================================
        
        /**
         * v8 Manager群初期化（依存順序修正版・架空メソッド防止強化）
         */
        async initializeV8Managers() {
            if (!this.pixiApp) {
                throw new Error('v8 Application not created - call createCanvasV8() first');
            }
            
            if (!this.canvasElementReady) {
                throw new Error('Canvas element not ready - call createCanvasV8() first');
            }
            
            try {
                console.log('🚀 Manager群初期化開始（依存順序厳守版）');
                
                // ========================================
                // STEP 1: CanvasManager完全初期化（最重要修正）
                // ========================================
                
                console.log('Step 1: CanvasManager初期化開始');
                
                // CanvasManager作成
                this.canvasManager = new window.Tegaki.CanvasManager();
                
                // 契約確認（lifecycle + canvasManager専用メソッド）
                this.verifyManagerContract('lifecycle', this.canvasManager, 'CanvasManager');
                this.verifyManagerContract('canvasManager', this.canvasManager, 'CanvasManager');
                
                // ライフサイクル実行（configure → attach → init）
                const canvasConfig = { canvas: { width: 400, height: 400, maxDPR: 2.0 } };
                this.canvasManager.configure(canvasConfig);
                
                const canvasContext = { pixiApp: this.pixiApp };
                this.canvasManager.attach(canvasContext);
                
                await this.canvasManager.init();
                
                // v8 Application注入・完全初期化
                await this.canvasManager.initializeV8Application(this.pixiApp);
                
                // CanvasManager完全準備確認（重要）
                this.verifyManagerReady(this.canvasManager, 'CanvasManager');
                
                // DrawContainer取得テスト（エラーが出ないことを確認）
                const testDrawContainer = this.canvasManager.getDrawContainer();
                if (!testDrawContainer) {
                    throw new Error('CanvasManager.getDrawContainer() returned null after initialization');
                }
                
                console.log('✅ Step 1: CanvasManager完全初期化完了');
                this.initializationSteps.push('CanvasManager完全初期化');
                
                // ========================================
                // STEP 2: 基幹Manager群登録・初期化
                // ========================================
                
                console.log('Step 2: 基幹Manager群初期化開始');
                
                // Manager登録
                this.registerManager('canvas', this.canvasManager);
                this.createAndRegisterBasicManagers();
                
                console.log('✅ Step 2: 基幹Manager群登録完了');
                this.initializationSteps.push('基幹Manager群登録');
                
                // ========================================
                // STEP 3: CoordinateManager初期化（ライフサイクル実行修正）
                // ========================================
                
                console.log('Step 3: CoordinateManager初期化開始');
                
                const coordinateManager = this.managers.get('coordinate');
                if (coordinateManager) {
                    // 契約確認
                    this.verifyManagerContract('coordinateManager', coordinateManager, 'CoordinateManager');
                    
                    // ライフサイクル実行（重要な修正）
                    const coordinateConfig = { coordinate: { dpr: 2.0 } };
                    coordinateManager.configure(coordinateConfig);
                    
                    const coordinateContext = { canvasManager: this.canvasManager };
                    coordinateManager.attach(coordinateContext);
                    
                    await coordinateManager.init();
                    
                    // CanvasManager注入（ライフサイクル後）
                    if (typeof coordinateManager.setCanvasManager === 'function') {
                        await coordinateManager.setCanvasManager(this.canvasManager);
                    }
                    
                    // 準備状態確認
                    this.verifyManagerReady(coordinateManager, 'CoordinateManager');
                    
                    this.v8Features.coordinateSystemReady = true;
                }
                
                console.log('✅ Step 3: CoordinateManager初期化完了');
                this.initializationSteps.push('CoordinateManager初期化');
                
                // ========================================
                // STEP 4: ToolManager初期化・依存注入（最終段階）
                // ========================================
                
                console.log('Step 4: ToolManager初期化開始');
                
                // ToolManager作成
                this.toolManager = new window.Tegaki.ToolManager(this.canvasManager);
                
                // 契約確認
                this.verifyManagerContract('toolManager', this.toolManager, 'ToolManager');
                
                this.registerManager('tool', this.toolManager);
                
                // Manager統一注入（全Manager準備完了後）
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
                
                // ToolManager最終準備確認
                this.verifyManagerReady(this.toolManager, 'ToolManager');
                
                console.log('✅ Step 4: ToolManager初期化完了');
                this.initializationSteps.push('ToolManager初期化・依存注入');
                
                // ========================================
                // STEP 5: 最終検証・フラグ設定
                // ========================================
                
                // 全Manager準備確認
                this.verifyAllManagersReady();
                
                this.v8Features.managerIntegration = true;
                this.v8Features.toolSystemReady = true;
                
                console.log('🎉 Manager群初期化完了（依存順序厳守版）');
                
            } catch (error) {
                console.error('💀 v8 Manager群初期化エラー:', error);
                console.error('🔍 Manager状態:', this.getManagerStatusSummary());
                throw error;
            }
        }

        /**
         * 基幹Manager群作成・登録（ライフサイクル実行修正版）
         */
        createAndRegisterBasicManagers() {
            // CoordinateManager（CanvasManager依存のため後で初期化）
            const coordinateManager = new window.Tegaki.CoordinateManager();
            this.registerManager('coordinate', coordinateManager);
            
            // RecordManager（独立・ライフサイクル実行）
            const recordManager = new window.Tegaki.RecordManager();
            try {
                recordManager.configure({});
                recordManager.attach({});
                recordManager.init();
            } catch (error) {
                console.warn('RecordManager初期化警告:', error);
            }
            this.registerManager('record', recordManager);
            
            // ConfigManager（独立・ライフサイクル実行）
            const configManager = new window.Tegaki.ConfigManager();
            try {
                configManager.configure({});
                configManager.attach({});
                configManager.init();
            } catch (error) {
                console.warn('ConfigManager初期化警告:', error);
            }
            this.registerManager('config', configManager);
            
            // ErrorManager（既存インスタンス使用）
            if (window.Tegaki.ErrorManagerInstance) {
                this.registerManager('error', window.Tegaki.ErrorManagerInstance);
            }
            
            // EventBus（既存インスタンス使用・重要）
            if (window.Tegaki.EventBusInstance) {
                this.registerManager('eventbus', window.Tegaki.EventBusInstance);
            }
            
            // ShortcutManager（独立・ライフサイクル実行）
            const shortcutManager = new window.Tegaki.ShortcutManager();
            try {
                if (typeof shortcutManager.configure === 'function') {
                    shortcutManager.configure({});
                    shortcutManager.attach({});
                    shortcutManager.init();
                }
            } catch (error) {
                console.warn('ShortcutManager初期化警告:', error);
            }
            this.registerManager('shortcut', shortcutManager);
            
            // NavigationManager（CanvasManager依存・後で初期化）
            const navigationManager = new window.Tegaki.NavigationManager();
            this.registerManager('navigation', navigationManager);
        }

        /**
         * 全Manager準備状態確認（最終検証）
         */
        verifyAllManagersReady() {
            const criticalManagers = [
                { key: 'canvas', name: 'CanvasManager' },
                { key: 'tool', name: 'ToolManager' },
                { key: 'coordinate', name: 'CoordinateManager' }
            ];

            for (const { key, name } of criticalManagers) {
                const manager = this.managers.get(key);
                if (manager) {
                    this.verifyManagerReady(manager, name);
                } else {
                    throw new Error(`Critical manager ${name} not found`);
                }
            }
        }

        /**
         * Manager状態サマリー取得（デバッグ用）
         */
        getManagerStatusSummary() {
            const summary = {};
            for (const [key, manager] of this.managers) {
                summary[key] = {
                    exists: !!manager,
                    hasIsReady: typeof manager?.isReady === 'function',
                    ready: manager?.isReady?.() || false,
                    error: manager?._status?.error || null
                };
            }
            return summary;
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
        }

        // ========================================
        // システム開始・UI初期化
        // ========================================
        
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
                // 最終依存注入検証
                this.toolManager.verifyInjection();
                
                // Step A: サイドバーアイコン表示（重要な修正）
                await this.initializeSidebarIcons();
                
                // Step B: システム準備完了通知
                this.emitSystemReady();
                
                // Step C: 初期ツール設定
                this.setDefaultTool();
                
                this.systemStarted = true;
                this.v8Ready = true;
                
                // Step D: app:ready イベント発火（UI初期化開始）
                this.emitAppReady();
                
                // 初期化サマリー出力
                this.outputInitializationSummary();
                
            } catch (error) {
                console.error('💀 v8システム開始エラー:', error);
                this.emitAppNotReady(error);
                throw error;
            }
        }

        /**
         * システム準備完了通知
         */
        emitSystemReady() {
            if (window.Tegaki?.EventBusInstance?.emit) {
                window.Tegaki.EventBusInstance.emit('v8SystemReady', {
                    rendererType: this.rendererType,
                    webgpuSupported: this.webgpuSupported,
                    managers: Array.from(this.managers.keys()),
                    features: this.v8Features,
                    canvasElementReady: this.canvasElementReady
                });
            }
        }

        /**
         * アプリ準備完了通知（UI初期化開始）
         */
        emitAppReady() {
            if (window.Tegaki?.EventBusInstance?.emit) {
                window.Tegaki.EventBusInstance.emit('app:ready', {
                    timestamp: Date.now(),
                    version: 'v8-phase1.5-manager-fixed',
                    managers: Array.from(this.managers.keys()),
                    features: this.v8Features
                });
                console.log('🎉 app:ready イベント発火 - UI初期化開始');
            }
        }

        /**
         * アプリ準備未完了通知（エラー時）
         */
        emitAppNotReady(error) {
            if (window.Tegaki?.EventBusInstance?.emit) {
                window.Tegaki.EventBusInstance.emit('app:not-ready', {
                    error: error.message,
                    timestamp: Date.now(),
                    managerStatus: this.getManagerStatusSummary()
                });
            }
        }

        /**
         * 初期ツール設定
         */
        setDefaultTool() {
            try {
                if (this.toolManager && this.toolManager.isReady()) {
                    this.toolManager.setActiveTool('pen');
                    this.updateToolButtonStates('pen');
                }
            } catch (error) {
                console.warn('初期ツール設定失敗:', error);
            }
        }
        
        /**
         * サイドバーアイコン初期化（UI表示復旧）
         */
        async initializeSidebarIcons() {
            try {
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
        
        /**
         * 初期化サマリー出力（コンソール過剰表示削減版）
         */
        outputInitializationSummary() {
            console.log('✅ AppCore v8システム完了');
            console.log(`📊 PixiJS ${window.PIXI.VERSION} | ${this.rendererType} | Manager数: ${this.managers.size}`);
            
            // デバッグモードでのみ詳細表示
            if (window.Tegaki?.DEBUG_MODE) {
                console.log('🔍 初期化ステップ:', this.initializationSteps);
                console.log('🔍 Manager状態:', this.getManagerStatusSummary());
            }
        }

        // ========================================
        // アクセサーメソッド・状態確認
        // ========================================
        
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
                   this.v8Features.canvasElementReady &&
                   this.v8Features.coordinateSystemReady &&
                   this.v8Features.toolSystemReady;
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
         * v8デバッグ情報取得（包括版）
         */
        getV8DebugInfo() {
            return {
                className: 'AppCore',
                version: 'v8.12.0-manager-initialization-fixed',
                systemStatus: {
                    v8Ready: this.v8Ready,
                    systemStarted: this.systemStarted,
                    pixiAppReady: !!this.pixiApp,
                    canvasElementReady: this.canvasElementReady,
                    canvasManagerReady: this.canvasManager ? this.canvasManager.isReady() : false,
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
                    managerStatus: this.getManagerStatusSummary()
                },
                dependencyVerification: {
                    enabled: this.v8Features.dependencyVerificationEnabled,
                    contractsAvailable: Object.keys(this.managerContracts),
                    verificationMethods: ['verifyManagerMethods', 'verifyManagerContract', 'verifyManagerReady']
                },
                v8Features: this.v8Features,
                canvasStatus: this.getCanvasStatus(),
                initializationSteps: this.initializationSteps,
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
    
    console.log('🚀 AppCore v8 Manager初期化順序修正版 Loaded');
    console.log('📏 修正内容: CanvasManager完全初期化確立・依存順序厳守・架空メソッド防止システム実装');
    console.log('🚀 特徴: Manager契約検証・準備状態確認・段階的初期化・エラーハンドリング強化');

})();