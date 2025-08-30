/**
 * 📄 FILE: js/tegaki-application.js
 * 📌 RESPONSIBILITY: PixiJS v8対応メインアプリケーション・イベント座標透過修正版
 * 
 * @provides
 *   - TegakiApplication（クラス）
 *   - async initialize(): void
 *   - async setupCanvas(): void
 *   - getCanvasElement(): HTMLCanvasElement
 *   - getToolManager(): ToolManager
 *   - isReady(): boolean
 *   - getDebugInfo(): Object
 *
 * @uses
 *   - window.Tegaki.AppCore
 *   - window.Tegaki.TegakiIcons.replaceAllToolIcons()
 *   - document.getElementById()
 *
 * @initflow
 *   1. AppCore作成 → 2. Canvas作成 → 3. DOM挿入 → 4. Manager初期化 → 5. UI設定 → 6. 完了
 *
 * @forbids
 *   💀 双方向依存禁止
 *   🚫 Canvas DOM挿入スキップ禁止
 *   🚫 原始イベント変換禁止（必ずそのまま透過）
 *   🚫 clientX/Y の独自オブジェクト化禁止
 *
 * @manager-key
 *   window.Tegaki.TegakiApplicationInstance
 *
 * @event-contract
 *   ・onPointerDown/Move/Up は原始PointerEvent をそのまま渡す
 *   ・clientX/Y を独自オブジェクトに変換しない
 *   ・addEventListener は passive:false を明示
 *   ・バインド先は app.view の <canvas> に限定
 *
 * @coordinate-contract
 *   ・座標変換は Tool 側の CoordinateManager で実行
 *   ・TegakiApplication は座標に一切関与しない
 *   ・原始DOMイベントの透過に専念
 *
 * @input-validation
 *   ・event.clientX/Y の存在確認のみ実行
 *   ・変換処理は Tool 側に移譲
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
                
                // 自動初期化実行
                this.initialize().catch(error => {
                    console.error('💀 TegakiApplication 初期化失敗:', error);
                    this.lastError = error;
                    this.initialized = false;
                    this.fullyReady = false;
                });
            }
            
            /**
             * システム完全初期化
             */
            async initialize() {
                try {
                    // Step 1: AppCore作成
                    await this.createAppCoreV8();
                    
                    // Step 2: Canvas作成
                    await this.createCanvasV8();
                    
                    // Step 3: Canvas DOM挿入（重要）
                    await this.setupCanvas();
                    this.canvasDOMReady = true;
                    
                    // Step 4: Manager群初期化
                    await this.initializeV8Managers();
                    
                    // Step 5: システム開始
                    await this.startV8System();
                    
                    // Step 6: UI設定
                    this.setupV8UI();
                    
                    // Step 7: 完了
                    this.initialized = true;
                    this.fullyReady = true;
                    this.initializationEndTime = Date.now();
                    
                    // 完了通知
                    this.notifyInitializationComplete();
                    
                } catch (error) {
                    this.lastError = error;
                    console.error('💀 初期化エラー:', error);
                    throw error;
                }
            }
            
            /**
             * AppCore作成
             */
            async createAppCoreV8() {
                if (!window.Tegaki?.AppCore) {
                    throw new Error('AppCore class not available');
                }
                
                this.appCore = new window.Tegaki.AppCore();
            }
            
            /**
             * Canvas作成（400x400固定）
             */
            async createCanvasV8() {
                try {
                    this.pixiApp = await this.appCore.createCanvasV8(400, 400);
                    
                    if (!this.pixiApp) {
                        throw new Error('Canvas creation failed');
                    }
                    
                    // レンダラー情報取得
                    this.rendererType = this.appCore.rendererType;
                    this.webgpuSupported = this.appCore.webgpuSupported;
                    
                    return this.pixiApp;
                    
                } catch (error) {
                    console.error('Canvas作成エラー:', error);
                    throw error;
                }
            }
            
            /**
             * Canvas DOM挿入処理（キャンバス表示の核心）
             */
            async setupCanvas() {
                try {
                    // Canvas要素取得
                    if (!this.pixiApp || !this.pixiApp.canvas) {
                        throw new Error('Canvas element not available');
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
                    
                    // Canvas表示確実化
                    this.ensureCanvasVisibility(canvas);
                    
                    // ポインターイベント設定（原始イベント透過）
                    this.setupPointerEvents(canvas);
                    
                    // DOM挿入成功確認
                    if (!container.contains(canvas)) {
                        throw new Error('Canvas DOM insertion failed');
                    }
                    
                } catch (error) {
                    console.error('Canvas DOM挿入失敗:', error);
                    throw error;
                }
            }
            
            /**
             * Canvas表示確実化
             */
            ensureCanvasVisibility(canvas) {
                canvas.style.cssText = `
                    display: block !important;
                    width: 400px !important;
                    height: 400px !important;
                    background: #f0e0d6 !important;
                    cursor: crosshair !important;
                    user-select: none !important;
                    touch-action: none !important;
                    position: relative !important;
                    z-index: 10 !important;
                `;
                
                // Canvas属性設定
                const dpr = Math.min(window.devicePixelRatio || 1, 2.0);
                canvas.setAttribute('width', 400 * dpr);
                canvas.setAttribute('height', 400 * dpr);
            }
            
            /**
             * ポインターイベント設定（原始イベント透過）
             * 🔥 修正の核心：原始イベントをそのまま Tool に渡す
             */
            setupPointerEvents(canvas) {
                // 原始イベントを直接透過
                canvas.addEventListener('pointerdown', (e) => {
                    this.onPointerDown(e); // 原始DOMイベントをそのまま渡す
                }, { passive: false });
                
                canvas.addEventListener('pointermove', (e) => {
                    this.onPointerMove(e); // 原始DOMイベントをそのまま渡す
                }, { passive: false });
                
                canvas.addEventListener('pointerup', (e) => {
                    this.onPointerUp(e); // 原始DOMイベントをそのまま渡す
                }, { passive: false });
                
                canvas.addEventListener('pointercancel', (e) => {
                    this.onPointerUp(e); // キャンセル時も Up として処理
                }, { passive: false });
                
                canvas.addEventListener('contextmenu', (e) => e.preventDefault());
            }
            
            /**
             * Manager群初期化
             */
            async initializeV8Managers() {
                if (!this.appCore) {
                    throw new Error('AppCore not available');
                }
                
                try {
                    await this.appCore.initializeV8Managers();
                    
                    this.canvasManager = this.appCore.getCanvasManager();
                    this.toolManager = this.appCore.getToolManager();
                    
                    if (!this.canvasManager || !this.toolManager) {
                        throw new Error('Required managers not initialized');
                    }
                    
                } catch (error) {
                    console.error('Manager初期化エラー:', error);
                    throw error;
                }
            }
            
            /**
             * システム開始
             */
            async startV8System() {
                if (!this.appCore) {
                    throw new Error('AppCore not available');
                }
                
                try {
                    await this.appCore.startV8System();
                } catch (error) {
                    console.error('システム開始エラー:', error);
                    throw error;
                }
            }
            
            /**
             * UI設定・アイコン表示
             */
            setupV8UI() {
                try {
                    // サイドバーアイコン表示
                    this.setupSidebarIcons();
                    
                    // ツールボタンイベント
                    this.setupToolButtonEvents();
                    
                    // ステータス表示更新
                    this.updateStatusDisplay();
                    
                } catch (error) {
                    console.error('UI設定エラー:', error);
                }
            }
            
            /**
             * サイドバーアイコン表示
             */
            setupSidebarIcons() {
                try {
                    if (window.Tegaki?.TegakiIcons?.replaceAllToolIcons) {
                        window.Tegaki.TegakiIcons.replaceAllToolIcons();
                    }
                } catch (error) {
                    console.error('アイコン表示失敗:', error);
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
            }
            
            // ========================================
            // ポインターイベント処理（原始イベント透過）
            // ========================================
            
            /**
             * ポインターダウン処理（原始イベント透過）
             * 🔥 修正の核心：座標変換は一切せず、原始イベントをそのまま渡す
             */
            onPointerDown(event) {
                if (!this.isReady()) {
                    console.warn('⚠️ TegakiApplication 初期化未完了');
                    return;
                }
                
                try {
                    // clientX/Y 基本確認（変換はしない）
                    if (typeof event.clientX !== 'number' || typeof event.clientY !== 'number') {
                        console.warn('⚠️ 無効なクライアント座標: x=' + event.clientX + ', y=' + event.clientY);
                        return;
                    }
                    
                    const tool = this.toolManager.getCurrentTool();
                    if (tool && typeof tool.onPointerDown === 'function') {
                        // 🔥 重要：原始DOMイベントをそのまま渡す
                        tool.onPointerDown(event);
                    }
                } catch (error) {
                    console.error('ポインターダウンエラー:', error);
                }
            }
            
            /**
             * ポインタームーブ処理（原始イベント透過）
             */
            onPointerMove(event) {
                if (!this.isReady()) return;
                
                try {
                    // clientX/Y 基本確認（変換はしない）
                    if (typeof event.clientX !== 'number' || typeof event.clientY !== 'number') {
                        return; // Move では警告を出さない（頻度が高いため）
                    }
                    
                    const tool = this.toolManager.getCurrentTool();
                    if (tool && typeof tool.onPointerMove === 'function') {
                        // 🔥 重要：原始DOMイベントをそのまま渡す
                        tool.onPointerMove(event);
                    }
                    
                    // 座標表示更新
                    this.updateCoordinateDisplay(event.clientX, event.clientY);
                } catch (error) {
                    console.error('ポインタームーブエラー:', error);
                }
            }
            
            /**
             * ポインターアップ処理（原始イベント透過）
             */
            onPointerUp(event) {
                if (!this.isReady()) return;
                
                try {
                    const tool = this.toolManager.getCurrentTool();
                    if (tool && typeof tool.onPointerUp === 'function') {
                        // 🔥 重要：原始DOMイベントをそのまま渡す
                        tool.onPointerUp(event);
                    }
                } catch (error) {
                    console.error('ポインターアップエラー:', error);
                }
            }
            
            /**
             * 座標表示更新
             */
            updateCoordinateDisplay(clientX, clientY) {
                const coordinatesEl = document.getElementById('coordinates');
                if (coordinatesEl) {
                    coordinatesEl.textContent = `x: ${Math.round(clientX)}, y: ${Math.round(clientY)}`;
                }
            }
            
            // ========================================
            // ツール管理・UI制御
            // ========================================
            
            /**
             * ツール選択
             */
            selectToolV8(toolName) {
                if (!this.toolManager || !this.toolManager.isReady()) {
                    return false;
                }
                
                try {
                    this.toolManager.setActiveTool(toolName);
                    this.updateToolButtonStates(toolName);
                    
                    // ツール表示更新
                    const toolInfo = document.getElementById('current-tool');
                    if (toolInfo) {
                        const toolDisplayNames = {
                            'pen': 'v8ベクターペン',
                            'eraser': 'v8消しゴム'
                        };
                        toolInfo.textContent = toolDisplayNames[toolName] || toolName;
                    }
                    
                    return true;
                    
                } catch (error) {
                    console.error(`ツール選択失敗: ${toolName}`, error);
                    return false;
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
                    autoDensity: true
                };
            }
            
            // ========================================
            // 状態確認・取得メソッド
            // ========================================
            
            /**
             * システム準備完了確認
             */
            isReady() {
                return this.initialized && 
                       this.fullyReady && 
                       this.canvasDOMReady &&
                       !!this.pixiApp &&
                       !!this.appCore &&
                       this.appCore.isV8Ready();
            }
            
            /**
             * Canvas要素取得
             */
            getCanvasElement() {
                if (!this.appCore) {
                    throw new Error('AppCore not available');
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
             * 初期化完了通知
             */
            notifyInitializationComplete() {
                const elapsedTime = this.initializationEndTime - this.initializationStartTime;
                console.log(`✅ TegakiApplication 初期化完了 (${elapsedTime}ms)`);
                console.log(`📊 ${this.rendererType} | Canvas: ${this.canvasDOMReady}`);
                
                // EventBus通知
                if (window.Tegaki?.EventBusInstance?.emit) {
                    window.Tegaki.EventBusInstance.emit('tegakiApplicationReady', {
                        rendererType: this.rendererType,
                        webgpuSupported: this.webgpuSupported,
                        initializationTime: elapsedTime
                    });
                }
                
                // ローディング画面を隠す
                if (window.hideLoadingScreen) {
                    window.hideLoadingScreen();
                }
            }
            
            /**
             * デバッグ情報取得
             */
            getDebugInfo() {
                return {
                    className: 'TegakiApplication',
                    version: 'v8-event-pass-through',
                    systemStatus: {
                        initialized: this.initialized,
                        fullyReady: this.fullyReady,
                        canvasDOMReady: this.canvasDOMReady
                    },
                    rendererInfo: {
                        type: this.rendererType,
                        webgpuSupported: this.webgpuSupported
                    },
                    appCoreReady: this.appCore?.isV8Ready() || false,
                    initializationTime: this.initializationEndTime ? 
                        (this.initializationEndTime - this.initializationStartTime) : null
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
                    canvasDisplayed: this.canvasDOMReady
                };
            }
        }

        // グローバル公開
        window.Tegaki.TegakiApplication = TegakiApplication;

    } else {
        console.log('⚠️ TegakiApplication already loaded - skipping redefinition');
    }

})();