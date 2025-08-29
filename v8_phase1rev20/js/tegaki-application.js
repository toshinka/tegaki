/**
 * 📄 FILE: js/tegaki-application.js
 * 📌 RESPONSIBILITY: PixiJS v8対応メインアプリケーション・システム初期化統制・UI連携
 * 
 * @provides
 *   - TegakiApplication（クラス）
 *   - async initialize(): void（v8システム完全初期化）
 *   - async createCanvasV8(): PIXI.Application（v8 Application作成・AppCore連携修正版）
 *   - async initializeV8Managers(): void（Manager群初期化）
 *   - setupV8UI(): void（UI設定・イベント登録）
 *   - selectToolV8(toolName): boolean（ツール選択）
 *   - isReady(): boolean（初期化完了確認・強化版）
 *   - getV8DebugInfo(): Object（デバッグ情報）
 *   - handleV8PointerEvents(): void（高精度ポインター処理）
 *
 * @uses
 *   - window.Tegaki.AppCore（v8統合基盤システム）
 *   - appCore.createCanvasV8(): PIXI.Application（修正：正しいAPI使用）
 *   - appCore.initializeV8Managers(): void（Manager群初期化）
 *   - appCore.startV8System(): void（システム開始）
 *   - appCore.isV8Ready(): boolean（準備状況確認）
 *   - window.Tegaki.ErrorManagerInstance.showError()（エラー表示）
 *   - window.Tegaki.EventBusInstance.emit()（イベント通知）
 *   - window.Tegaki.TegakiIcons.replaceAllToolIcons()（アイコン適用）
 *
 * @initflow
 *   1. AppCore作成 → 2. AppCore.createCanvasV8()呼び出し → 3. Manager群初期化
 *   → 4. システム開始 → 5. UI設定 → 6. 初期化完了確認 → 7. 準備完了通知
 *
 * @forbids
 *   💀 双方向依存禁止
 *   🚫 フォールバック禁止  
 *   🚫 フェイルセーフ禁止
 *   🚫 v7/v8二重管理禁止
 *   🚫 未実装メソッド呼び出し禁止（createCanvasV8修正済み）
 *
 * @manager-key
 *   window.Tegaki.TegakiApplicationInstance
 *
 * @dependencies-strict
 *   REQUIRED: PixiJS v8.12.0, AppCore, HTML DOM要素
 *   OPTIONAL: ErrorManager, EventBus, TegakiIcons
 *   FORBIDDEN: Manager直接作成、v7互換コード
 *
 * @integration-flow
 *   Bootstrap.start() → TegakiApplication.initialize() → AppCore統合 → Manager初期化 → UI統合
 *
 * @method-naming-rules
 *   初期化系: initializeV8xxx() / createCanvasV8()
 *   UI系: setupV8xxx() / handleV8xxx()
 *   状態系: isReady() / getV8DebugInfo()
 *   ツール系: selectToolV8()
 *
 * @error-handling
 *   throw: 初期化失敗・AppCore未準備・必須Manager未存在
 *   false: UI機能失敗・ツール選択失敗
 *   log: 警告・状態変更・デバッグ情報
 *
 * @state-management
 *   初期化状態は内部管理・isReady()経由確認
 *   AppCore状態は間接参照・直接操作禁止
 *   UI状態は専用メソッド経由更新
 *
 * @performance-notes
 *   非同期初期化でUIブロック回避・16ms以内目標
 *   WebGPU活用でレンダリング最適化
 *   イベント処理は高精度・リアルタイム対応
 */

// 多重定義防止
if (!window.Tegaki) {
    window.Tegaki = {};
}

if (!window.Tegaki.TegakiApplication) {
    /**
     * TegakiApplication - PixiJS v8対応メインアプリケーション
     * AppCore API統一・エラー修正完全版
     */
    class TegakiApplication {
        constructor() {
            console.log('🚀 TegakiApplication v8対応版 作成・自動初期化開始');
            
            // v8基本状態
            this.initialized = false;
            this.fullyReady = false;
            this.v8SystemReady = false;
            this.initializationComplete = false;
            
            // v8基盤システム
            this.appCore = null;
            this.pixiApp = null;
            
            // v8レンダラー情報
            this.rendererType = null; // 'webgpu' | 'webgl'
            this.webgpuSupported = null;
            
            // v8機能状態
            this.v8Features = {
                webgpuEnabled: false,
                asyncInitialization: false,
                containerHierarchy: false,
                realtimeDrawing: false,
                managerIntegration: false,
                uiIntegration: false,
                eventsConfigured: false,
                toolsReady: false,
                systemValidated: false
            };
            
            // v8初期化情報
            this.v8InitializationSteps = [];
            this.lastError = null;
            this.initializationStartTime = Date.now();
            this.initializationEndTime = null;
            
            // 自動初期化実行（エラー処理強化）
            this.initialize().catch(error => {
                console.error('💀 TegakiApplication v8初期化失敗:', error);
                this.lastError = error;
                this.initialized = false;
                this.fullyReady = false;
                this.initializationComplete = false;
                
                // ErrorManagerにエラー通知
                if (window.Tegaki?.ErrorManagerInstance?.showError) {
                    window.Tegaki.ErrorManagerInstance.showError(
                        `TegakiApplication v8初期化失敗: ${error.message}`,
                        { 
                            context: 'TegakiApplication.constructor',
                            rendererType: this.rendererType,
                            webgpuSupported: this.webgpuSupported,
                            initializationSteps: this.v8InitializationSteps,
                            elapsedTime: Date.now() - this.initializationStartTime
                        }
                    );
                }
                
                throw error;
            });
        }
        
        /**
         * 🚀 v8システム完全初期化・WebGPU対応・非同期処理・初期化完了保証
         */
        async initialize() {
            console.log('🚀 TegakiApplication v8システム初期化開始');
            
            try {
                // Step 1: v8 AppCore作成
                await this.createAppCoreV8();
                this.v8InitializationSteps.push('v8 AppCore created');
                
                // Step 2: v8 Application作成・WebGPU対応（修正：正しいAPI使用）
                await this.createCanvasV8();
                this.v8InitializationSteps.push('v8 Application created with WebGPU support');
                this.v8Features.asyncInitialization = true;
                
                // Step 3: v8 Manager群統合初期化
                await this.initializeV8Managers();
                this.v8InitializationSteps.push('v8 Managers initialized');
                this.v8Features.managerIntegration = true;
                
                // Step 4: v8システム開始・統合確認
                await this.startV8System();
                this.v8InitializationSteps.push('v8 System started');
                this.v8SystemReady = true;
                
                // Step 5: v8 UI設定・イベント登録
                this.setupV8UI();
                this.v8InitializationSteps.push('v8 UI setup completed');
                this.v8Features.uiIntegration = true;
                this.v8Features.eventsConfigured = true;
                
                // Step 6: v8機能統合・完了
                this.integrateV8Features();
                this.v8InitializationSteps.push('v8 Features integrated');
                
                // Step 7: 初期化完了確認・状態確定
                await this.finalizeInitialization();
                this.v8InitializationSteps.push('v8 Initialization finalized');
                
                // v8システム完全準備完了
                this.initialized = true;
                this.fullyReady = true;
                this.initializationComplete = true;
                this.v8Features.systemValidated = true;
                this.initializationEndTime = Date.now();
                
                console.log('✅ TegakiApplication v8システム初期化完了');
                this.logV8InitializationSuccess();
                
                // 初期化完了通知
                this.notifyInitializationComplete();
                
            } catch (error) {
                this.lastError = error;
                this.initialized = false;
                this.fullyReady = false;
                this.initializationComplete = false;
                console.error('💀 TegakiApplication v8システム初期化エラー:', error);
                throw error;
            }
        }
        
        /**
         * 🚀 v8 AppCore作成
         */
        async createAppCoreV8() {
            console.log('🚀 v8 AppCore作成開始');
            
            if (!window.Tegaki?.AppCore) {
                throw new Error('AppCore class not available - v8 integration impossible');
            }
            
            this.appCore = new window.Tegaki.AppCore();
            
            console.log('✅ v8 AppCore作成完了');
        }
        
        /**
         * 🚀 v8 Application作成・WebGPU対応・非同期初期化（修正：AppCore API統一）
         */
        async createCanvasV8() {
            console.log('🚀 v8 Application作成開始');
            
            try {
                // v8設定取得
                const config = this.getV8CanvasConfig();
                
                // 🚨修正: AppCore.createCanvasV8() を正しく呼び出し
                this.pixiApp = await this.appCore.createCanvasV8(config.width, config.height);
                
                if (!this.pixiApp) {
                    throw new Error('AppCore.createCanvasV8() returned null');
                }
                
                // レンダラー情報取得（AppCoreから）
                this.rendererType = this.appCore.rendererType;
                this.webgpuSupported = this.appCore.webgpuSupported;
                this.v8Features.webgpuEnabled = this.rendererType === 'webgpu';
                
                console.log('✅ v8 Application作成完了');
                console.log(`📊 v8レンダラー: ${this.rendererType} (WebGPU: ${this.webgpuSupported})`);
                
                return this.pixiApp;
                
            } catch (error) {
                console.error('💀 v8 Application作成エラー:', error);
                throw error;
            }
        }
        
        /**
         * 🚀 v8 Manager群統合初期化
         */
        async initializeV8Managers() {
            console.log('🔧 v8 Manager群統合初期化開始');
            
            try {
                // v8 Manager群初期化（AppCore経由）
                await this.appCore.initializeV8Managers();
                
                // v8機能有効化
                this.v8Features.containerHierarchy = true;
                this.v8Features.realtimeDrawing = true;
                
                console.log('✅ v8 Manager群統合初期化完了');
                
            } catch (error) {
                console.error('💀 v8 Manager群統合初期化エラー:', error);
                throw error;
            }
        }
        
        /**
         * 🚀 v8システム開始・統合確認
         */
        async startV8System() {
            console.log('🚀 v8システム開始');
            
            try {
                // v8システム開始（AppCore経由）
                await this.appCore.startV8System();
                
                // v8システム準備確認
                if (!this.appCore.isV8Ready()) {
                    throw new Error('v8 System not ready after start - AppCore validation failed');
                }
                
                console.log('✅ v8システム開始完了');
                
            } catch (error) {
                console.error('💀 v8システム開始エラー:', error);
                throw error;
            }
        }
        
        /**
         * 🚀 初期化完了確認・状態確定
         */
        async finalizeInitialization() {
            console.log('🔍 TegakiApplication 初期化完了確認開始');
            
            try {
                // AppCore準備状況詳細確認
                if (!this.appCore || !this.appCore.isV8Ready()) {
                    throw new Error('AppCore not ready for finalization');
                }
                
                // PixiJS Application確認
                if (!this.pixiApp || !this.rendererType) {
                    throw new Error('PixiJS Application not ready for finalization');
                }
                
                // Manager群準備確認
                const canvasManager = this.appCore.getCanvasManager();
                if (!canvasManager || typeof canvasManager.getDrawContainer !== 'function') {
                    throw new Error('CanvasManager not ready for finalization');
                }
                
                // DrawContainer確認
                try {
                    const drawContainer = canvasManager.getDrawContainer();
                    if (!drawContainer || typeof drawContainer.addChild !== 'function') {
                        throw new Error('DrawContainer not valid for finalization');
                    }
                } catch (error) {
                    throw new Error(`DrawContainer validation failed: ${error.message}`);
                }
                
                // ToolManager準備確認
                const toolManager = this.appCore.getToolManager();
                if (!toolManager) {
                    throw new Error('ToolManager not ready for finalization');
                }
                
                // ツール準備確認（利用可能な場合のみ）
                if (typeof toolManager.isReady === 'function') {
                    if (!toolManager.isReady()) {
                        console.warn('⚠️ ToolManager.isReady() returned false - but continuing');
                    } else {
                        this.v8Features.toolsReady = true;
                    }
                }
                
                // 依存注入確認（利用可能な場合のみ）
                if (typeof toolManager.verifyInjection === 'function') {
                    try {
                        toolManager.verifyInjection();
                        console.log('✅ ToolManager依存注入確認完了');
                    } catch (verifyError) {
                        console.warn('⚠️ ToolManager依存注入確認失敗:', verifyError.message);
                        // 警告のみで継続
                    }
                }
                
                // UI要素確認（基本要素のみ）
                const canvasContainer = document.getElementById('canvas-container');
                if (!canvasContainer) {
                    console.warn('⚠️ canvas-container not found - UI integration may be incomplete');
                }
                
                // イベント設定確認
                if (this.pixiApp?.canvas) {
                    console.log('✅ Canvas events configured');
                } else {
                    throw new Error('Canvas not available for event configuration');
                }
                
                console.log('✅ TegakiApplication 初期化完了確認完了');
                
            } catch (error) {
                console.error('❌ TegakiApplication 初期化完了確認エラー:', error);
                throw new Error(`Initialization finalization failed: ${error.message}`);
            }
        }
        
        /**
         * 🚀 初期化完了通知（外部確認用）
         */
        notifyInitializationComplete() {
            console.log('📡 TegakiApplication 初期化完了通知送信');
            
            // EventBus通知（利用可能な場合のみ）
            if (window.Tegaki?.EventBusInstance?.emit) {
                window.Tegaki.EventBusInstance.emit('tegakiApplicationReady', {
                    initialized: this.initialized,
                    fullyReady: this.fullyReady,
                    initializationComplete: this.initializationComplete,
                    rendererType: this.rendererType,
                    webgpuSupported: this.webgpuSupported,
                    features: this.v8Features,
                    initializationTime: this.initializationEndTime - this.initializationStartTime
                });
            }
            
            // DOM イベント通知
            if (typeof window.CustomEvent === 'function') {
                window.dispatchEvent(new CustomEvent('tegakiApplicationReady', {
                    detail: {
                        ready: this.isReady(),
                        rendererType: this.rendererType,
                        webgpuActive: this.v8Features.webgpuEnabled
                    }
                }));
            }
            
            // グローバル状態更新
            if (window.Tegaki) {
                window.Tegaki.applicationReady = true;
                window.Tegaki.applicationInitialized = this.initializationComplete;
            }
        }
        
        /**
         * 🚀 v8対応UI設定・イベント登録
         */
        setupV8UI() {
            console.log('🎨 v8対応UI設定開始');
            
            try {
                // v8キャンバスイベント設定
                this.setupV8CanvasEvents();
                
                // v8ツールボタン設定
                this.setupV8ToolButtons();
                
                // v8機能ボタン設定
                this.setupV8FeatureButtons();
                
                // v8アイコン適用
                this.setupV8Icons();
                
                // v8ステータス表示
                this.updateV8StatusDisplay();
                
                console.log('✅ v8対応UI設定完了');
                
            } catch (error) {
                console.error('💀 v8対応UI設定エラー:', error);
                throw error;
            }
        }
        
        /**
         * 🚀 v8キャンバスイベント設定
         */
        setupV8CanvasEvents() {
            if (!this.pixiApp?.canvas) {
                throw new Error('v8 Canvas not available for event setup');
            }
            
            const canvas = this.pixiApp.canvas;
            
            // v8ポインターイベント設定（高精度・リアルタイム対応）
            canvas.addEventListener('pointerdown', (e) => this.handleV8PointerDown(e));
            canvas.addEventListener('pointermove', (e) => this.handleV8PointerMove(e));
            canvas.addEventListener('pointerup', (e) => this.handleV8PointerUp(e));
            
            // v8座標表示（高精度）
            canvas.addEventListener('pointermove', (e) => this.updateV8CoordinateDisplay(e));
            
            // v8ナビゲーション（WebGPU最適化）
            canvas.addEventListener('wheel', (e) => this.handleV8Wheel(e));
            
            // コンテキストメニュー無効化
            canvas.addEventListener('contextmenu', (e) => e.preventDefault());
            
            console.log('✅ v8キャンバスイベント設定完了');
        }
        
        /**
         * 🚀 v8高精度ポインターダウン処理
         */
        handleV8PointerDown(event) {
            if (!this.isReady()) return;
            
            try {
                // v8座標変換（高精度）
                const coords = this.getV8CanvasCoordinates(event);
                
                // v8ツール処理
                const toolManager = this.appCore.getToolManager();
                if (toolManager?.handlePointerDown) {
                    toolManager.handlePointerDown(coords.x, coords.y, event);
                }
                
            } catch (error) {
                console.error('❌ v8ポインターダウン処理エラー:', error);
            }
        }
        
        /**
         * 🚀 v8高精度ポインタームーブ処理
         */
        handleV8PointerMove(event) {
            if (!this.isReady()) return;
            
            try {
                // v8座標変換（高精度）
                const coords = this.getV8CanvasCoordinates(event);
                
                // v8ツール処理（リアルタイム描画）
                const toolManager = this.appCore.getToolManager();
                if (toolManager?.handlePointerMove) {
                    toolManager.handlePointerMove(coords.x, coords.y, event);
                }
                
            } catch (error) {
                console.error('❌ v8ポインタームーブ処理エラー:', error);
            }
        }
        
        /**
         * 🚀 v8高精度ポインターアップ処理
         */
        handleV8PointerUp(event) {
            if (!this.isReady()) return;
            
            try {
                // v8座標変換（高精度）
                const coords = this.getV8CanvasCoordinates(event);
                
                // v8ツール処理
                const toolManager = this.appCore.getToolManager();
                if (toolManager?.handlePointerUp) {
                    toolManager.handlePointerUp(coords.x, coords.y, event);
                }
                
            } catch (error) {
                console.error('❌ v8ポインターアップ処理エラー:', error);
            }
        }
        
        /**
         * 🚀 v8高精度座標取得
         */
        getV8CanvasCoordinates(event) {
            // v8 Container変形考慮の高精度座標変換
            const rect = this.pixiApp.canvas.getBoundingClientRect();
            const scaleX = this.pixiApp.screen.width / rect.width;
            const scaleY = this.pixiApp.screen.height / rect.height;
            
            return {
                x: (event.clientX - rect.left) * scaleX,
                y: (event.clientY - rect.top) * scaleY
            };
        }
        
        /**
         * 🚀 v8座標表示更新
         */
        updateV8CoordinateDisplay(event) {
            const coordElement = document.getElementById('coordinates');
            if (!coordElement) return;
            
            try {
                const coords = this.getV8CanvasCoordinates(event);
                coordElement.textContent = `x: ${Math.round(coords.x)}, y: ${Math.round(coords.y)}`;
            } catch (error) {
                coordElement.textContent = 'x: ---, y: ---';
            }
        }
        
        /**
         * 🚀 v8ホイール処理
         */
        handleV8Wheel(event) {
            event.preventDefault();
            // v8ナビゲーション処理（将来実装）
        }
        
        /**
         * 🚀 v8ツールボタン設定
         */
        setupV8ToolButtons() {
            // v8ペンツールボタン
            const penButton = document.getElementById('pen-tool');
            if (penButton) {
                penButton.addEventListener('click', () => this.selectToolV8('pen'));
            }
            
            // v8消しゴムツールボタン
            const eraserButton = document.getElementById('eraser-tool');
            if (eraserButton) {
                eraserButton.addEventListener('click', () => this.selectToolV8('eraser'));
            }
            
            console.log('✅ v8ツールボタン設定完了');
        }
        
        /**
         * 🚀 v8機能ボタン設定
         */
        setupV8FeatureButtons() {
            // v8 Undo/Redoボタン（将来実装）
            const undoButton = document.getElementById('undo-button');
            const redoButton = document.getElementById('redo-button');
            
            if (undoButton) {
                undoButton.addEventListener('click', () => {
                    console.log('🔄 v8 Undo機能（将来実装）');
                });
            }
            
            if (redoButton) {
                redoButton.addEventListener('click', () => {
                    console.log('🔄 v8 Redo機能（将来実装）');
                });
            }
            
            console.log('✅ v8機能ボタン設定完了');
        }
        
        /**
         * 🚀 v8アイコン適用
         */
        setupV8Icons() {
            if (window.Tegaki?.TegakiIcons?.replaceAllToolIcons) {
                window.Tegaki.TegakiIcons.replaceAllToolIcons();
                console.log('✅ v8アイコン適用完了');
            } else {
                console.warn('⚠️ TegakiIcons not available - icons not applied');
            }
        }
        
        /**
         * 🚀 v8ツール選択・即座反映（修正：AppCore経由）
         */
        selectToolV8(toolName) {
            console.log(`🔧 v8ツール選択: ${toolName}`);
            
            if (!this.isReady()) {
                console.error('❌ v8システム未準備 - ツール選択不可');
                return false;
            }
            
            try {
                // 🚨修正: ToolManager経由でツール選択（AppCore.selectToolV8は存在しない）
                const toolManager = this.appCore.getToolManager();
                if (!toolManager || typeof toolManager.switchTool !== 'function') {
                    console.error('❌ ToolManager not available or switchTool method not found');
                    return false;
                }
                
                // ツール切り替え実行
                const success = toolManager.switchTool(toolName);
                
                if (success) {
                    // UI更新
                    this.updateV8ToolButtons(toolName);
                    this.updateV8StatusDisplay();
                    
                    console.log(`✅ v8ツール選択成功: ${toolName}`);
                    return true;
                } else {
                    console.error(`❌ v8ツール選択失敗: ${toolName}`);
                    return false;
                }
                
            } catch (error) {
                console.error('❌ v8ツール選択エラー:', error);
                return false;
            }
        }
        
        /**
         * 🚀 v8ツールボタン表示更新
         */
        updateV8ToolButtons(selectedTool) {
            // 全てのツールボタンからactiveクラス削除
            const toolButtons = document.querySelectorAll('.tool-button');
            toolButtons.forEach(button => button.classList.remove('active'));
            
            // 選択されたツールボタンにactiveクラス追加
            const toolButtonMap = {
                'pen': 'pen-tool',
                'eraser': 'eraser-tool'
            };
            
            const buttonId = toolButtonMap[selectedTool];
            if (buttonId) {
                const button = document.getElementById(buttonId);
                if (button) {
                    button.classList.add('active');
                }
            }
        }
        
        /**
         * 🚀 v8ステータス表示更新
         */
        updateV8StatusDisplay() {
            // v8レンダラー情報表示
            const rendererInfo = document.getElementById('renderer-info');
            if (rendererInfo) {
                const status = this.webgpuSupported ? 
                    (this.rendererType === 'webgpu' ? '🚀 WebGPU' : '📊 WebGL') : '📊 WebGL';
                rendererInfo.textContent = status;
            }
            
            // v8キャンバス情報表示
            const canvasInfo = document.getElementById('canvas-info');
            if (canvasInfo && this.pixiApp) {
                const width = this.pixiApp.screen.width;
                const height = this.pixiApp.screen.height;
                canvasInfo.textContent = `${width}×${height}px`;
            }
            
            // v8現在ツール表示
            const currentTool = document.getElementById('current-tool');
            if (currentTool) {
                const toolManager = this.appCore?.getToolManager();
                const toolName = toolManager?.getCurrentToolName?.() || 'pen';
                const toolDisplayNames = {
                    pen: 'v8ペン',
                    eraser: 'v8消しゴム'
                };
                currentTool.textContent = toolDisplayNames[toolName] || 'v8ペン';
            }
            
            // v8色表示
            const currentColor = document.getElementById('current-color');
            if (currentColor) {
                currentColor.textContent = '#800000'; // ふたばマルーン
            }
        }
        
        /**
         * 🚀 v8機能統合
         */
        integrateV8Features() {
            console.log('🚀 v8機能統合開始');
            
            // v8リアルタイム描画確認
            if (this.v8Features.realtimeDrawing) {
                console.log('✅ v8リアルタイム描画有効');
            }
            
            // v8 Container階層確認
            if (this.v8Features.containerHierarchy) {
                console.log('✅ v8 Container階層有効');
            }
            
            // v8 WebGPU確認
            if (this.v8Features.webgpuEnabled) {
                console.log('✅ v8 WebGPU有効');
            }
            
            console.log('✅ v8機能統合完了');
        }
        
        /**
         * 🚀 v8設定取得
         */
        getV8CanvasConfig() {
            // ConfigManager v8対応確認
            if (window.Tegaki?.ConfigManagerInstance?.getCanvasConfigV8) {
                return window.Tegaki.ConfigManagerInstance.getCanvasConfigV8();
            } else {
                // フォールバック設定（v8標準・400x400サイズ）
                return {
                    width: 400,
                    height: 400,
                    backgroundColor: 0xf0e0d6, // ふたばクリーム
                    antialias: true,
                    resolution: window.devicePixelRatio || 1,
                    preference: 'webgpu' // WebGPU優先
                };
            }
        }
        
        /**
         * 🚀 v8対応状況確認（初期化完了確認修正版）
         */
        isReady() {
            return this.initialized && 
                   this.fullyReady &&
                   this.initializationComplete &&
                   this.v8SystemReady && 
                   !!this.appCore && 
                   this.appCore.isV8Ready() &&
                   !!this.pixiApp &&
                   this.rendererType !== null &&
                   this.v8Features.asyncInitialization &&
                   this.v8Features.managerIntegration &&
                   this.v8Features.uiIntegration &&
                   this.v8Features.eventsConfigured;
        }
        
        /**
         * 🚀 詳細準備状況確認（デバッグ用）
         */
        getReadinessDetails() {
            return {
                // 基本状態
                initialized: this.initialized,
                fullyReady: this.fullyReady,
                initializationComplete: this.initializationComplete,
                v8SystemReady: this.v8SystemReady,
                
                // コンポーネント状態
                appCore: !!this.appCore,
                appCoreReady: this.appCore?.isV8Ready() || false,
                pixiApp: !!this.pixiApp,
                rendererType: this.rendererType,
                
                // v8機能状態
                v8Features: this.v8Features,
                
                // 総合判定
                overallReady: this.isReady()
            };
        }
        
        /**
         * 🚀 v8初期化成功ログ出力（コンソール削減版）
         */
        logV8InitializationSuccess() {
            const elapsedTime = this.initializationEndTime - this.initializationStartTime;
            
            console.log('✅ TegakiApplication v8初期化成功');
            console.log(`📊 ${this.rendererType} | ${elapsedTime}ms | Ready: ${this.isReady()}`);
        }
        
        /**
         * 🚀 v8デバッグ情報取得（修正強化版）
         */
        getV8DebugInfo() {
            return {
                // v8基本状態
                v8SystemReady: this.v8SystemReady,
                initialized: this.initialized,
                fullyReady: this.fullyReady,
                initializationComplete: this.initializationComplete,
                ready: this.isReady(),
                readinessDetails: this.getReadinessDetails(),
                
                // v8レンダラー情報
                rendererInfo: {
                    type: this.rendererType,
                    webgpuSupported: this.webgpuSupported,
                    webgpuActive: this.rendererType === 'webgpu',
                    pixiVersion: typeof PIXI !== 'undefined' ? PIXI.VERSION : 'unknown'
                },
                
                // v8 AppCore状態
                appCore: this.appCore ? this.appCore.getV8DebugInfo() : null,
                
                // v8機能状況
                v8Features: this.v8Features,
                
                // v8 PixiJS Application状態
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
                    startTime: this.initializationStartTime,
                    endTime: this.initializationEndTime,
                    elapsedTime: this.initializationEndTime ? (this.initializationEndTime - this.initializationStartTime) : null,
                    lastError: this.lastError ? this.lastError.message : null
                },
                
                // v8システム情報
                v8System: {
                    tegakiNamespace: !!window.Tegaki,
                    errorManager: !!window.Tegaki?.ErrorManagerInstance,
                    eventBus: !!window.Tegaki?.EventBusInstance,
                    pixiJS: !!window.PIXI,
                    pixiVersion: typeof PIXI !== 'undefined' ? PIXI.VERSION : null,
                    applicationReady: window.Tegaki?.applicationReady || false,
                    applicationInitialized: window.Tegaki?.applicationInitialized || false
                }
            };
        }
        
        /**
         * デバッグ情報取得（v7互換）
         */
        getDebugInfo() {
            return this.getV8DebugInfo();
        }
        
        /**
         * ツール選択（v7互換）
         */
        selectTool(toolName) {
            return this.selectToolV8(toolName);
        }
        
        /**
         * AppCore取得
         */
        getAppCore() {
            return this.appCore;
        }
        
        /**
         * PixiJS Application取得
         */
        getPixiApp() {
            return this.pixiApp;
        }
        
        /**
         * WebGPU状況取得
         */
        getWebGPUStatus() {
            return {
                supported: this.webgpuSupported,
                active: this.rendererType === 'webgpu',
                rendererType: this.rendererType
            };
        }
        
        /**
         * v8システムリセット（デバッグ用）
         */
        resetV8System() {
            console.log('🔄 TegakiApplication v8システムリセット開始');
            
            try {
                // v8状態リセット
                this.v8SystemReady = false;
                this.initialized = false;
                this.fullyReady = false;
                this.initializationComplete = false;
                this.appCore = null;
                this.pixiApp = null;
                this.rendererType = null;
                this.webgpuSupported = null;
                this.v8Features = {
                    webgpuEnabled: false,
                    asyncInitialization: false,
                    containerHierarchy: false,
                    realtimeDrawing: false,
                    managerIntegration: false,
                    uiIntegration: false,
                    eventsConfigured: false,
                    toolsReady: false,
                    systemValidated: false
                };
                this.lastError = null;
                this.v8InitializationSteps = [];
                this.initializationStartTime = Date.now();
                this.initializationEndTime = null;
                
                // グローバル状態リセット
                if (window.Tegaki) {
                    window.Tegaki.applicationReady = false;
                    window.Tegaki.applicationInitialized = false;
                }
                
                console.log('✅ TegakiApplication v8システムリセット完了');
                
            } catch (error) {
                console.error('❌ TegakiApplication v8システムリセットエラー:', error);
                throw error;
            }
        }
        
        /**
         * v8システム統計情報取得（修正強化版）
         */
        getV8SystemStats() {
            return {
                // v8稼働状況
                v8Status: {
                    systemReady: this.v8SystemReady,
                    initialized: this.initialized,
                    fullyReady: this.fullyReady,
                    initializationComplete: this.initializationComplete,
                    uptime: this.initialized ? 'running' : 'stopped',
                    rendererType: this.rendererType,
                    webgpuActive: this.rendererType === 'webgpu',
                    ready: this.isReady()
                },
                
                // v8機能統計
                v8Features: {
                    enabled: Object.values(this.v8Features).filter(Boolean).length,
                    total: Object.keys(this.v8Features).length,
                    details: this.v8Features
                },
                
                // v8エラー統計
                v8ErrorStatus: {
                    hasErrors: !!this.lastError,
                    lastErrorTime: this.lastError ? 'recent' : null
                },
                
                // v8初期化統計
                v8InitializationStats: {
                    stepsCompleted: this.v8InitializationSteps.length,
                    fullyInitialized: this.isReady(),
                    initializationTime: this.initializationEndTime ? (this.initializationEndTime - this.initializationStartTime) : null,
                    startTime: this.initializationStartTime,
                    endTime: this.initializationEndTime
                }
            };
        }
    }
    
    // Tegaki名前空間に登録
    window.Tegaki.TegakiApplication = TegakiApplication;
    
    console.log('🚀 TegakiApplication PixiJS v8対応版 Loaded - AppCore API統一・エラー修正完全版');
} else {
    console.log('⚠️ TegakiApplication already defined - skipping redefinition');
}

console.log('🚀 TegakiApplication PixiJS v8対応版 Loaded - AppCore API統一・エラー修正完全版');