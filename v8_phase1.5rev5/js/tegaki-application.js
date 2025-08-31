/**
 * 📄 FILE: js/tegaki-application.js
 * 📌 RESPONSIBILITY: PixiJS v8対応メインアプリケーション・Canvas DOM挿入確実化・Manager初期化フロー修正
 * ChangeLog: 2025-09-01 <Manager初期化フロー修正・AppCore連携強化・エラーハンドリング改善>
 * 
 * @provides
 *   - TegakiApplication（クラス）
 *   - async initialize(): void
 *   - async setupCanvas(): void
 *   - async initializeV8Managers(): void
 *   - getCanvasElement(): HTMLCanvasElement
 *   - getToolManager(): ToolManager
 *   - isReady(): boolean
 *   - getDebugInfo(): Object
 *
 * @uses
 *   - window.Tegaki.AppCore（システム基盤）
 *   - window.Tegaki.TegakiIcons.replaceAllToolIcons()（UI表示）
 *   - document.getElementById()（DOM操作）
 *   - window.Tegaki.EventBusInstance（イベント通信）
 *
 * @initflow
 *   1. createAppCoreV8() → AppCore作成
 *   2. createCanvasV8() → PixiJS Application作成
 *   3. setupCanvas() → Canvas DOM挿入確実化
 *   4. initializeV8Managers() → Manager群順次初期化（AppCore委譲）
 *   5. startV8System() → システム開始・UI表示
 *   6. setupV8UI() → ツールボタン・イベント設定
 *   7. notifyInitializationComplete() → 完了通知
 *
 * @forbids
 *   💀 双方向依存禁止
 *   🚫 Canvas DOM挿入スキップ禁止
 *   🚫 Manager初期化順序違反禁止
 *   🚫 AppCore経由以外でのManager初期化禁止
 *   🚫 アイコン表示スキップ禁止
 *   🚫 座標イベント直接処理禁止（CoordinateManager経由必須）
 *
 * @manager-key
 *   window.Tegaki.TegakiApplicationInstance
 *
 * @dependencies-strict
 *   REQUIRED: window.Tegaki.AppCore, PixiJS v8, DOM（canvas-container）
 *   OPTIONAL: window.Tegaki.TegakiIcons, window.Tegaki.EventBusInstance
 *   FORBIDDEN: 直接Manager作成、v7互換コード
 *
 * @integration-flow
 *   Bootstrap → TegakiApplication.initialize() → AppCore連携 → Manager群準備 → UI表示 → 完了
 *
 * @method-naming-rules
 *   初期化系: initializeV8xxx() / createV8xxx() / setupV8xxx()
 *   取得系: getCanvasElement() / getToolManager() / getDebugInfo()
 *   状態系: isReady() / isV8Ready()
 *   イベント系: onPointerDown/Move/Up()
 *   UI系: setupV8UI() / updateToolButtonStates()
 *
 * @error-handling
 *   throw: 初期化失敗・必須依存未存在・Canvas DOM挿入失敗
 *   catch: 初期化中エラーは this.lastError に保持・再throw
 *   log: ステップ毎の進捗・エラー詳細（簡潔化）
 *
 * @testing-hooks
 *   - getDebugInfo(): システム詳細状態
 *   - isReady(): 完全準備状態確認
 *   - getV8FeatureStatus(): v8機能状況
 *   - lastError: 最後のエラー情報
 *
 * @performance-notes
 *   Canvas DOM挿入確実化・ポインターイベント最適化
 *   400x400固定サイズ・DPR制限2.0
 *   Manager初期化をAppCoreに完全委譲（責任分離）
 *
 * @coordinate-contract
 *   ポインターイベントはclientX/Y座標のまま渡す
 *   座標変換はCoordinateManager一元処理
 *   Tool側で直接座標変換しない
 *
 * @event-contract
 *   Canvas要素にポインターイベント直接バインド
 *   passive:false明示・contextmenu防止
 *   座標計算はCoordinateManager経由
 */

(function() {
    'use strict';

    // 多重定義防止
    if (!window.Tegaki) {
        window.Tegaki = {};
    }

    if (!window.Tegaki.TegakiApplication) {
        class TegakiApplication {
            constructor() {
                console.log('🚀 TegakiApplication v8 Manager初期化フロー修正版 作成開始');
                
                // 基本状態
                this.initialized = false;
                this.fullyReady = false;
                this.canvasDOMReady = false;
                
                // システム参照
                this.appCore = null;
                this.pixiApp = null;
                this.canvasManager = null;
                this.toolManager = null;
                
                // レンダラー情報
                this.rendererType = null;
                this.webgpuSupported = null;
                
                // 初期化情報
                this.initializationStartTime = Date.now();
                this.initializationEndTime = null;
                this.lastError = null;
                this.initializationSteps = [];
                
                // 自動初期化実行（エラーハンドリング強化）
                this.initialize().catch(error => {
                    console.error('💀 TegakiApplication 初期化失敗:', error);
                    this.lastError = error;
                    this.initialized = false;
                    this.fullyReady = false;
                    
                    // エラー詳細ログ（デバッグ支援）
                    console.error('🔍 初期化ステップ:', this.initializationSteps);
                    console.error('🔍 AppCore状態:', this.appCore?.getV8DebugInfo());
                });
            }
            
            /**
             * システム完全初期化（修正版・責任分離強化）
             */
            async initialize() {
                try {
                    console.log('🚀 TegakiApplication 初期化開始');
                    
                    // Step 1: AppCore作成
                    await this.createAppCoreV8();
                    this.initializationSteps.push('AppCore作成');
                    
                    // Step 2: Canvas作成
                    await this.createCanvasV8();
                    this.initializationSteps.push('Canvas作成');
                    
                    // Step 3: Canvas DOM挿入（重要）
                    await this.setupCanvas();
                    this.canvasDOMReady = true;
                    this.initializationSteps.push('Canvas DOM挿入');
                    
                    // Step 4: Manager群初期化（AppCore完全委譲）
                    await this.initializeV8Managers();
                    this.initializationSteps.push('Manager群初期化');
                    
                    // Step 5: システム開始（UI表示含む）
                    await this.startV8System();
                    this.initializationSteps.push('システム開始');
                    
                    // Step 6: UI設定
                    this.setupV8UI();
                    this.initializationSteps.push('UI設定');
                    
                    // Step 7: 最終確認・完了
                    await this.finalizeInitialization();
                    this.initialized = true;
                    this.fullyReady = true;
                    this.initializationEndTime = Date.now();
                    this.initializationSteps.push('初期化完了');
                    
                    // 完了通知
                    this.notifyInitializationComplete();
                    this.logV8InitializationSuccess();
                    
                } catch (error) {
                    this.lastError = error;
                    console.error('💀 初期化エラー:', error);
                    console.error('🔍 失敗ステップ:', this.initializationSteps);
                    throw error;
                }
            }
            
            /**
             * AppCore作成（依存確認強化）
             */
            async createAppCoreV8() {
                if (!window.Tegaki?.AppCore) {
                    throw new Error('AppCore class not available - check file loading order');
                }
                
                this.appCore = new window.Tegaki.AppCore();
                
                if (!this.appCore) {
                    throw new Error('AppCore instance creation failed');
                }
                
                console.log('✅ AppCore作成完了');
            }
            
            /**
             * Canvas作成（400x400固定・エラーハンドリング強化）
             */
            async createCanvasV8() {
                try {
                    if (!this.appCore) {
                        throw new Error('AppCore not available for Canvas creation');
                    }
                    
                    this.pixiApp = await this.appCore.createCanvasV8(400, 400);
                    
                    if (!this.pixiApp) {
                        throw new Error('Canvas creation returned null');
                    }
                    
                    if (!this.pixiApp.canvas) {
                        throw new Error('Canvas element not created by PixiJS Application');
                    }
                    
                    // レンダラー情報取得
                    this.rendererType = this.appCore.rendererType;
                    this.webgpuSupported = this.appCore.webgpuSupported;
                    
                    console.log(`✅ Canvas作成完了 (${this.rendererType})`);
                    return this.pixiApp;
                    
                } catch (error) {
                    console.error('💀 Canvas作成エラー:', error);
                    throw error;
                }
            }
            
            /**
             * Canvas DOM挿入処理（表示確実化・枠なし対応）
             */
            async setupCanvas() {
                try {
                    console.log('🎨 Canvas DOM挿入開始');
                    
                    // Canvas要素取得
                    if (!this.pixiApp || !this.pixiApp.canvas) {
                        throw new Error('Canvas element not available for DOM insertion');
                    }
                    
                    const canvas = this.pixiApp.canvas;
                    
                    // DOM container確認・作成
                    let container = document.getElementById('canvas-container');
                    if (!container) {
                        container = document.createElement('div');
                        container.id = 'canvas-container';
                        container.style.cssText = `
                            width: 400px;
                            height: 400px;
                            position: relative;
                            margin: 20px auto;
                            background-color: #f0e0d6;
                        `;
                        document.body.appendChild(container);
                    }
                    
                    // Canvas DOM挿入
                    if (!container.contains(canvas)) {
                        // 既存canvas削除
                        const existingCanvas = container.querySelector('canvas');
                        if (existingCanvas) {
                            container.removeChild(existingCanvas);
                        }
                        
                        // 新canvas挿入
                        container.appendChild(canvas);
                    }
                    
                    // Canvas表示確実化（枠なし対応）
                    this.ensureCanvasVisibility(canvas);
                    
                    // ポインターイベント設定
                    this.setupPointerEvents(canvas);
                    
                    // DOM挿入成功確認
                    if (!container.contains(canvas)) {
                        throw new Error('Canvas DOM insertion verification failed');
                    }
                    
                    console.log('✅ Canvas DOM挿入完了');
                    
                } catch (error) {
                    console.error('💀 Canvas DOM挿入失敗:', error);
                    throw error;
                }
            }
            
            /**
             * Canvas表示確実化（枠なし・クリスタ風）
             */
            ensureCanvasVisibility(canvas) {
                canvas.style.cssText = `
                    display: block !important;
                    width: 400px !important;
                    height: 400px !important;
                    border: none !important;
                    background: #f0e0d6 !important;
                    cursor: crosshair !important;
                    user-select: none !important;
                    touch-action: none !important;
                    position: relative !important;
                    z-index: 10 !important;
                `;
                
                // Canvas属性設定（DPR制限）
                const dpr = Math.min(window.devicePixelRatio || 1, 2.0);
                canvas.setAttribute('width', 400 * dpr);
                canvas.setAttribute('height', 400 * dpr);
            }
            
            /**
             * ポインターイベント設定（座標処理統一）
             */
            setupPointerEvents(canvas) {
                const eventOptions = { passive: false };
                
                canvas.addEventListener('pointerdown', (e) => this.onPointerDown(e), eventOptions);
                canvas.addEventListener('pointermove', (e) => this.onPointerMove(e), eventOptions);
                canvas.addEventListener('pointerup', (e) => this.onPointerUp(e), eventOptions);
                canvas.addEventListener('pointercancel', (e) => this.onPointerUp(e), eventOptions);
                canvas.addEventListener('contextmenu', (e) => e.preventDefault(), eventOptions);
                
                console.log('✅ ポインターイベント設定完了');
            }
            
            /**
             * Manager群初期化（AppCore完全委譲・エラー処理強化）
             */
            async initializeV8Managers() {
                if (!this.appCore) {
                    throw new Error('AppCore not available for Manager initialization');
                }
                
                try {
                    console.log('🔧 Manager群初期化開始（AppCore委譲）');
                    
                    // AppCoreに初期化を完全委譲（重要な修正）
                    await this.appCore.initializeV8Managers();
                    
                    // 初期化完了後、参照取得
                    this.canvasManager = this.appCore.getCanvasManager();
                    this.toolManager = this.appCore.getToolManager();
                    
                    // 必須Manager存在確認
                    if (!this.canvasManager) {
                        throw new Error('CanvasManager not available after initialization');
                    }
                    
                    if (!this.toolManager) {
                        throw new Error('ToolManager not available after initialization');
                    }
                    
                    // Manager準備状態確認
                    if (!this.canvasManager.isReady()) {
                        throw new Error('CanvasManager not ready after initialization');
                    }
                    
                    if (!this.toolManager.isReady()) {
                        throw new Error('ToolManager not ready after initialization');
                    }
                    
                    console.log('✅ Manager群初期化完了');
                    
                } catch (error) {
                    console.error('💀 Manager初期化エラー:', error);
                    
                    // デバッグ情報出力
                    if (this.appCore) {
                        console.error('🔍 AppCore状態:', this.appCore.getV8DebugInfo());
                    }
                    
                    throw error;
                }
            }
            
            /**
             * システム開始（AppCore委譲）
             */
            async startV8System() {
                if (!this.appCore) {
                    throw new Error('AppCore not available for system start');
                }
                
                try {
                    console.log('🚀 v8システム開始');
                    
                    await this.appCore.startV8System();
                    
                    console.log('✅ v8システム開始完了');
                    
                } catch (error) {
                    console.error('💀 システム開始エラー:', error);
                    throw error;
                }
            }
            
            /**
             * UI設定・ツールボタン連携
             */
            setupV8UI() {
                try {
                    console.log('🎨 UI設定開始');
                    
                    // ツールボタンイベント設定
                    this.setupToolButtonEvents();
                    
                    // ステータス表示更新
                    this.updateStatusDisplay();
                    
                    // 初期ツール設定
                    this.setDefaultTool();
                    
                    console.log('✅ UI設定完了');
                    
                } catch (error) {
                    console.error('🎨 UI設定エラー:', error);
                    // UI設定失敗は致命的でないため継続
                }
            }
            
            /**
             * 初期ツール設定
             */
            setDefaultTool() {
                try {
                    if (this.toolManager && this.toolManager.isReady()) {
                        this.selectToolV8('pen');
                    }
                } catch (error) {
                    console.warn('初期ツール設定失敗:', error);
                }
            }
            
            /**
             * ツールボタンイベント設定
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
                            this.selectToolV8(toolName);
                        });
                    }
                });
            }
            
            /**
             * ステータス表示更新
             */
            updateStatusDisplay() {
                const rendererInfo = document.getElementById('renderer-info');
                if (rendererInfo) {
                    rendererInfo.textContent = this.rendererType === 'webgpu' ? 'WebGPU' : 'WebGL2';
                }
                
                const canvasInfo = document.getElementById('canvas-info');
                if (canvasInfo) {
                    canvasInfo.textContent = `400x400 | ${this.canvasDOMReady ? 'DOM Ready' : 'DOM Not Ready'}`;
                }
            }
            
            /**
             * 最終確認・完了処理
             */
            async finalizeInitialization() {
                // 必須コンポーネント最終確認
                if (!this.pixiApp || !this.canvasManager || !this.toolManager) {
                    throw new Error('Required components not ready for finalization');
                }
                
                if (!this.canvasDOMReady) {
                    throw new Error('Canvas DOM not ready for finalization');
                }
                
                // AppCore準備状態最終確認
                if (!this.appCore || !this.appCore.isV8Ready()) {
                    throw new Error('AppCore not ready for finalization');
                }
                
                console.log('✅ 最終確認完了');
            }

            // ========================================
            // ポインターイベント処理（座標統一・修正版）
            // ========================================
            
            /**
             * ポインターダウン処理（CoordinateManager経由座標変換）
             */
            onPointerDown(event) {
                if (!this.isReady()) {
                    return;
                }
                
                try {
                    event.preventDefault();
                    
                    const tool = this.toolManager.getCurrentTool();
                    if (tool && typeof tool.onPointerDown === 'function') {
                        // DOM座標をそのまま渡す（CoordinateManagerで変換）
                        const eventData = {
                            clientX: event.clientX,
                            clientY: event.clientY,
                            pointerId: event.pointerId,
                            pressure: event.pressure || 1.0,
                            originalEvent: event
                        };
                        
                        tool.onPointerDown(eventData);
                    }
                } catch (error) {
                    console.error('💀 ポインターダウンエラー:', error);
                }
            }
            
            /**
             * ポインタームーブ処理
             */
            onPointerMove(event) {
                if (!this.isReady()) {
                    return;
                }
                
                try {
                    const tool = this.toolManager.getCurrentTool();
                    if (tool && typeof tool.onPointerMove === 'function') {
                        const eventData = {
                            clientX: event.clientX,
                            clientY: event.clientY,
                            pointerId: event.pointerId,
                            pressure: event.pressure || 1.0,
                            originalEvent: event
                        };
                        
                        tool.onPointerMove(eventData);
                    }
                    
                    // 座標表示更新（デバッグ用）
                    this.updateCoordinateDisplay(event.clientX, event.clientY);
                    
                } catch (error) {
                    console.error('💀 ポインタームーブエラー:', error);
                }
            }
            
            /**
             * ポインターアップ処理
             */
            onPointerUp(event) {
                if (!this.isReady()) {
                    return;
                }
                
                try {
                    const tool = this.toolManager.getCurrentTool();
                    if (tool && typeof tool.onPointerUp === 'function') {
                        const eventData = {
                            clientX: event.clientX,
                            clientY: event.clientY,
                            pointerId: event.pointerId,
                            pressure: event.pressure || 0.0,
                            originalEvent: event
                        };
                        
                        tool.onPointerUp(eventData);
                    }
                } catch (error) {
                    console.error('💀 ポインターアップエラー:', error);
                }
            }
            
            /**
             * 座標表示更新（デバッグ支援）
             */
            updateCoordinateDisplay(clientX, clientY) {
                const coordinatesEl = document.getElementById('coordinates');
                if (coordinatesEl) {
                    coordinatesEl.textContent = `Client: ${Math.round(clientX)}, ${Math.round(clientY)}`;
                }
            }

            // ========================================
            // ツール管理・UI制御
            // ========================================
            
            /**
             * ツール選択（v8対応・エラーハンドリング強化）
             */
            selectToolV8(toolName) {
                if (!this.toolManager || !this.toolManager.isReady()) {
                    console.warn(`ToolManager not ready for tool selection: ${toolName}`);
                    return false;
                }
                
                try {
                    this.toolManager.setActiveTool(toolName);
                    this.updateToolButtonStates(toolName);
                    this.updateToolDisplay(toolName);
                    
                    console.log(`✅ ツール切り替え: ${toolName}`);
                    return true;
                    
                } catch (error) {
                    console.error(`💀 ツール選択失敗: ${toolName}`, error);
                    return false;
                }
            }
            
            /**
             * ツール表示更新
             */
            updateToolDisplay(toolName) {
                const toolInfo = document.getElementById('current-tool');
                if (toolInfo) {
                    const toolDisplayNames = {
                        'pen': 'v8ベクターペン',
                        'eraser': 'v8消しゴム'
                    };
                    toolInfo.textContent = toolDisplayNames[toolName] || toolName;
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
             * Canvas設定取得
             */
            getV8CanvasConfig() {
                return {
                    width: 400,
                    height: 400,
                    background: 0xf0e0d6,
                    resolution: Math.min(window.devicePixelRatio || 1, 2.0),
                    autoDensity: true,
                    preference: this.webgpuSupported ? 'webgpu' : 'webgl'
                };
            }

            // ========================================
            // 状態確認・取得メソッド
            // ========================================
            
            /**
             * システム準備完了確認（完全版）
             */
            isReady() {
                return this.initialized && 
                       this.fullyReady && 
                       this.canvasDOMReady &&
                       !!this.pixiApp &&
                       !!this.appCore &&
                       this.appCore.isV8Ready() &&
                       !!this.canvasManager &&
                       this.canvasManager.isReady() &&
                       !!this.toolManager &&
                       this.toolManager.isReady();
            }
            
            /**
             * Canvas要素取得
             */
            getCanvasElement() {
                if (!this.appCore) {
                    throw new Error('AppCore not available for Canvas element retrieval');
                }
                return this.appCore.getCanvasElement();
            }
            
            /**
             * ToolManager取得
             */
            getToolManager() {
                return this.toolManager;
            }
            
            /**
             * CanvasManager取得
             */
            getCanvasManager() {
                return this.canvasManager;
            }
            
            /**
             * AppCore取得
             */
            getAppCore() {
                return this.appCore;
            }
            
            /**
             * 初期化成功ログ（簡潔版）
             */
            logV8InitializationSuccess() {
                const elapsedTime = this.initializationEndTime - this.initializationStartTime;
                console.log(`✅ TegakiApplication 初期化完了 (${elapsedTime}ms)`);
                console.log(`📊 ${this.rendererType} | Canvas DOM: ${this.canvasDOMReady ? '✅' : '❌'} | Manager: ${this.isReady() ? '✅' : '❌'}`);
            }
            
            /**
             * 初期化完了通知（EventBus連携）
             */
            notifyInitializationComplete() {
                try {
                    // EventBus通知
                    if (window.Tegaki?.EventBusInstance?.emit) {
                        window.Tegaki.EventBusInstance.emit('tegakiApplicationReady', {
                            rendererType: this.rendererType,
                            webgpuSupported: this.webgpuSupported,
                            initializationTime: this.initializationEndTime - this.initializationStartTime,
                            managersReady: this.isReady(),
                            features: this.getV8FeatureStatus()
                        });
                    }
                    
                    // ローディング画面を隠す（存在する場合）
                    if (typeof window.hideLoadingScreen === 'function') {
                        window.hideLoadingScreen();
                    }
                    
                    console.log('🎉 初期化完了通知送信');
                    
                } catch (error) {
                    console.error('初期化完了通知エラー:', error);
                }
            }
            
            /**
             * デバッグ情報取得（包括版）
             */
            getDebugInfo() {
                return {
                    className: 'TegakiApplication',
                    version: 'v8-manager-initialization-flow-fixed',
                    systemStatus: {
                        initialized: this.initialized,
                        fullyReady: this.fullyReady,
                        canvasDOMReady: this.canvasDOMReady,
                        ready: this.isReady()
                    },
                    rendererInfo: {
                        type: this.rendererType,
                        webgpuSupported: this.webgpuSupported,
                        webgpuActive: this.rendererType === 'webgpu'
                    },
                    componentStatus: {
                        appCoreReady: this.appCore?.isV8Ready() || false,
                        pixiAppReady: !!this.pixiApp,
                        canvasManagerReady: this.canvasManager?.isReady() || false,
                        toolManagerReady: this.toolManager?.isReady() || false
                    },
                    initializationInfo: {
                        startTime: this.initializationStartTime,
                        endTime: this.initializationEndTime,
                        elapsedTime: this.initializationEndTime ? 
                            (this.initializationEndTime - this.initializationStartTime) : null,
                        steps: this.initializationSteps,
                        lastError: this.lastError ? {
                            message: this.lastError.message,
                            name: this.lastError.name
                        } : null
                    },
                    appCoreDebug: this.appCore ? this.appCore.getV8DebugInfo() : null
                };
            }
            
            /**
             * v8機能状況取得
             */
            getV8FeatureStatus() {
                return {
                    systemReady: this.isReady(),
                    rendererType: this.rendererType,
                    webgpuActive: this.rendererType === 'webgpu',
                    canvasDisplayed: this.canvasDOMReady,
                    managersReady: {
                        canvas: this.canvasManager?.isReady() || false,
                        tool: this.toolManager?.isReady() || false,
                        appCore: this.appCore?.isV8Ready() || false
                    },
                    features: {
                        pointerEvents: true,
                        coordinateTransform: true,
                        toolSwitching: !!this.toolManager,
                        uiIntegration: this.canvasDOMReady
                    }
                };
            }
            
            /**
             * エラー状態確認
             */
            hasErrors() {
                return !!this.lastError || !this.initialized || !this.fullyReady;
            }
            
            /**
             * エラー詳細取得
             */
            getErrorDetails() {
                if (!this.lastError) {
                    return null;
                }
                
                return {
                    error: this.lastError,
                    initializationSteps: this.initializationSteps,
                    systemStatus: {
                        initialized: this.initialized,
                        fullyReady: this.fullyReady,
                        canvasDOMReady: this.canvasDOMReady
                    },
                    debugInfo: this.getDebugInfo()
                };
            }
        }

        // グローバル公開
        window.Tegaki.TegakiApplication = TegakiApplication;
        
        console.log('🚀 TegakiApplication v8 Manager初期化フロー修正版 Loaded');
        console.log('📏 修正内容: AppCore完全委譲・Manager初期化順序修正・エラーハンドリング強化・座標処理統一');
        console.log('🚀 特徴: 責任分離・依存関係明確化・Canvas DOM挿入確実化・ポインターイベント最適化');

    } else {
        console.log('⚠️ TegakiApplication already loaded - skipping redefinition');
    }

})();