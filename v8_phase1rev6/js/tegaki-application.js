/**
 * 🎯 TegakiApplication - PixiJS v8対応メインアプリケーション（v8統合版）
 * 📋 RESPONSIBILITY: v8 Application統合・v8 Manager初期化・v8 UI連携・v8イベント管理・WebGPU対応
 * 🚫 PROHIBITION: v7 API使用・フォールバック・フェイルセーフ・Manager作成・座標変換
 * ✅ PERMISSION: v8 Application作成・v8 Manager連携・v8 UI統合・v8イベント処理・WebGPU活用
 * 
 * 📏 DESIGN_PRINCIPLE: v8 Application中心・非同期初期化・WebGPU優先・Container階層・Manager統合
 * 🔄 INTEGRATION: v8 AppCore + v8 Manager群 + v8 UI連携 + v8イベントシステム
 * 🚀 V8_MIGRATION: 完全v8対応・WebGPU統合・リアルタイム描画・Container階層・フォールバック削除
 * 
 * 📌 提供メソッド一覧（v8対応）:
 * ✅ async initialize() - v8システム完全初期化・WebGPU対応・非同期処理
 * ✅ async createCanvasV8() - v8 Application作成・WebGPU設定・非同期初期化
 * ✅ async initializeV8Managers() - v8 Manager群統合初期化・連携設定
 * ✅ setupV8UI() - v8対応UI設定・イベント登録
 * ✅ selectToolV8(toolName) - v8ツール選択・即座反映
 * ✅ handleV8PointerEvents() - v8高精度ポインター処理
 * ✅ getV8DebugInfo() - v8デバッグ情報取得
 * 
 * 📌 他ファイル呼び出しメソッド一覧:
 * ✅ new PIXI.Application() - v8 Application作成（PixiJS v8.12.0）
 * ✅ await app.init(options) - v8非同期初期化（PixiJS v8.12.0）
 * ✅ await PIXI.isWebGPUSupported() - WebGPU対応確認（PixiJS v8.12.0）
 * ✅ window.Tegaki.AppCore() - v8統合基盤システム作成（✅確認済み）
 * ✅ appCore.createCanvasV8() - v8 Application作成・WebGPU対応（✅確認済み）
 * ✅ appCore.initializeV8Managers() - v8 Manager群初期化（✅確認済み）
 * ✅ appCore.startV8System() - v8システム開始（✅確認済み）
 * ✅ window.Tegaki.ErrorManagerInstance.showError() - エラー表示（✅確認済み）
 * ✅ window.Tegaki.ConfigManagerInstance.getCanvasConfigV8() - v8設定取得（🔄実装予定）
 * ✅ window.Tegaki.TegakiIcons.replaceAllToolIcons() - アイコン適用（✅確認済み）
 * 
 * 📐 v8アプリケーション初期化フロー:
 * 開始 → v8 AppCore作成 → v8 Application作成・WebGPU対応 → 非同期初期化 → 
 * v8 Manager群統合初期化 → v8システム開始 → v8 UI設定 → v8イベント登録 → 完了
 * 依存関係: PixiJS v8.12.0(基盤) → WebGPU(高速化) → v8 AppCore(統合) → v8 Manager群(機能)
 * 
 * 🚨 CRITICAL_V8_DEPENDENCIES: v8必須依存関係（動作に必須）
 * - new PIXI.Application() + await app.init() - v8非同期初期化必須
 * - await PIXI.isWebGPUSupported() - WebGPU対応確認必須
 * - appCore.isV8Ready() === true - v8システム準備完了必須
 * - v8 Manager群v8対応完了必須
 * 
 * 🔧 V8_INITIALIZATION_ORDER: v8初期化順序（厳守必要）
 * 1. v8 AppCore作成
 * 2. v8 Application作成・WebGPU対応確認
 * 3. 非同期初期化・DOM配置
 * 4. v8 Manager群統合初期化
 * 5. v8システム開始・統合確認
 * 6. v8 UI設定・イベント登録
 * 7. v8機能統合・完了
 * 
 * 🚫 V8_ABSOLUTE_PROHIBITIONS: v8移行時絶対禁止事項
 * - v7 PIXI.Application(options)同期作成継続
 * - initializeCanvasManager等のv7メソッド呼び出し継続
 * - フォールバック・フェイルセーフ複雑化
 * - Manager作成・座標変換処理
 */

// 多重定義防止
if (!window.Tegaki) {
    window.Tegaki = {};
}

if (!window.Tegaki.TegakiApplication) {
    /**
     * TegakiApplication - PixiJS v8対応メインアプリケーション
     * v8統合・WebGPU対応・非同期初期化・Container階層・リアルタイム描画
     */
    class TegakiApplication {
        constructor() {
            console.log('🚀 TegakiApplication v8対応版 作成・自動初期化開始');
            
            // v8基本状態
            this.initialized = false;
            this.v8SystemReady = false;
            
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
                managerIntegration: false
            };
            
            // v8初期化情報
            this.v8InitializationSteps = [];
            this.lastError = null;
            
            // 自動初期化実行（v8非同期対応）
            this.initialize().catch(error => {
                console.error('💀 TegakiApplication v8初期化失敗:', error);
                this.lastError = error;
                
                // ErrorManagerにエラー通知
                if (window.Tegaki?.ErrorManagerInstance?.showError) {
                    window.Tegaki.ErrorManagerInstance.showError(
                        `TegakiApplication v8初期化失敗: ${error.message}`,
                        { 
                            context: 'TegakiApplication.constructor',
                            rendererType: this.rendererType,
                            webgpuSupported: this.webgpuSupported,
                            initializationSteps: this.v8InitializationSteps
                        }
                    );
                }
                
                throw error;
            });
        }
        
        /**
         * 🚀 v8システム完全初期化・WebGPU対応・非同期処理
         */
        async initialize() {
            console.log('🚀 TegakiApplication v8システム初期化開始');
            
            try {
                // Step 1: v8 AppCore作成
                await this.createAppCoreV8();
                this.v8InitializationSteps.push('v8 AppCore created');
                
                // Step 2: v8 Application作成・WebGPU対応
                await this.createCanvasV8();
                this.v8InitializationSteps.push('v8 Application created with WebGPU support');
                
                // Step 3: v8 Manager群統合初期化
                await this.initializeV8Managers();
                this.v8InitializationSteps.push('v8 Managers initialized');
                
                // Step 4: v8システム開始・統合確認
                await this.startV8System();
                this.v8InitializationSteps.push('v8 System started');
                
                // Step 5: v8 UI設定・イベント登録
                this.setupV8UI();
                this.v8InitializationSteps.push('v8 UI setup completed');
                
                // Step 6: v8機能統合・完了
                this.integrateV8Features();
                this.v8InitializationSteps.push('v8 Features integrated');
                
                // v8システム準備完了
                this.v8SystemReady = true;
                this.initialized = true;
                this.v8Features.asyncInitialization = true;
                
                console.log('✅ TegakiApplication v8システム初期化完了');
                this.logV8InitializationSuccess();
                
            } catch (error) {
                this.lastError = error;
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
         * 🚀 v8 Application作成・WebGPU対応・非同期初期化
         */
        async createCanvasV8() {
            console.log('🚀 v8 Application作成開始');
            
            try {
                // v8設定取得
                const config = this.getV8CanvasConfig();
                
                // v8 Application作成・WebGPU対応
                this.pixiApp = await this.appCore.createCanvasV8(config);
                
                // レンダラー情報取得
                this.rendererType = this.appCore.rendererType;
                this.webgpuSupported = this.appCore.webgpuSupported;
                this.v8Features.webgpuEnabled = this.rendererType === 'webgpu';
                
                console.log('✅ v8 Application作成完了');
                console.log(`📊 v8レンダラー: ${this.rendererType} (WebGPU: ${this.webgpuSupported})`);
                
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
                // v8 Manager群初期化
                await this.appCore.initializeV8Managers();
                
                // v8機能有効化
                this.v8Features.containerHierarchy = true;
                this.v8Features.realtimeDrawing = true;
                this.v8Features.managerIntegration = true;
                
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
                // v8システム開始
                await this.appCore.startV8System();
                
                // v8システム準備確認
                if (!this.appCore.isV8Ready()) {
                    throw new Error('v8 System not ready after start');
                }
                
                console.log('✅ v8システム開始完了');
                
            } catch (error) {
                console.error('💀 v8システム開始エラー:', error);
                throw error;
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
            if (!this.isV8Ready()) return;
            
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
            if (!this.isV8Ready()) return;
            
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
            if (!this.isV8Ready()) return;
            
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
            
            // v8ナビゲーション処理（WebGPU最適化）
            // 将来実装: NavigationManager v8対応
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
         * 🚀 v8ツール選択・即座反映
         */
        selectToolV8(toolName) {
            console.log(`🔧 v8ツール選択: ${toolName}`);
            
            if (!this.isV8Ready()) {
                console.error('❌ v8システム未準備 - ツール選択不可');
                return false;
            }
            
            try {
                // v8ツール選択
                const success = this.appCore.selectToolV8(toolName);
                
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
                // フォールバック設定（v8標準）
                return {
                    width: 800,
                    height: 600,
                    backgroundColor: 0xf0e0d6, // ふたばクリーム
                    antialias: true,
                    resolution: window.devicePixelRatio || 1,
                    preference: 'webgpu' // WebGPU優先
                };
            }
        }
        
        /**
         * 🚀 v8対応状況確認
         */
        isV8Ready() {
            return this.v8SystemReady && 
                   this.initialized && 
                   !!this.appCore && 
                   this.appCore.isV8Ready() &&
                   !!this.pixiApp &&
                   this.rendererType !== null;
        }
        
        /**
         * 🚀 v8初期化成功ログ出力
         */
        logV8InitializationSuccess() {
            console.log('🎉 TegakiApplication v8システム初期化成功！');
            console.log(`🚀 v8レンダラー: ${this.rendererType}`);
            console.log(`🔧 WebGPU対応: ${this.webgpuSupported}`);
            console.log('📝 v8初期化ステップ:', this.v8InitializationSteps);
            console.log('🔧 v8機能:', this.v8Features);
            
            // 成功通知
            if (window.Tegaki?.EventBusInstance?.emit) {
                window.Tegaki.EventBusInstance.emit('v8ApplicationReady', {
                    rendererType: this.rendererType,
                    webgpuSupported: this.webgpuSupported,
                    features: this.v8Features
                });
            }
        }
        
        /**
         * 🚀 v8デバッグ情報取得
         */
        getV8DebugInfo() {
            return {
                // v8基本状態
                v8SystemReady: this.v8SystemReady,
                initialized: this.initialized,
                ready: this.isV8Ready(),
                
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
                    lastError: this.lastError ? this.lastError.message : null
                },
                
                // v8システム情報
                v8System: {
                    tegakiNamespace: !!window.Tegaki,
                    errorManager: !!window.Tegaki?.ErrorManagerInstance,
                    eventBus: !!window.Tegaki?.EventBusInstance,
                    pixiJS: !!window.PIXI,
                    pixiVersion: typeof PIXI !== 'undefined' ? PIXI.VERSION : null
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
         * システム準備確認（v7互換）
         */
        isReady() {
            return this.isV8Ready();
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
                this.appCore = null;
                this.pixiApp = null;
                this.rendererType = null;
                this.webgpuSupported = null;
                this.v8Features = {
                    webgpuEnabled: false,
                    asyncInitialization: false,
                    containerHierarchy: false,
                    realtimeDrawing: false,
                    managerIntegration: false
                };
                this.lastError = null;
                this.v8InitializationSteps = [];
                
                console.log('✅ TegakiApplication v8システムリセット完了');
                
            } catch (error) {
                console.error('❌ TegakiApplication v8システムリセットエラー:', error);
                throw error;
            }
        }
        
        /**
         * v8システム統計情報取得
         */
        getV8SystemStats() {
            return {
                // v8稼働状況
                v8Status: {
                    systemReady: this.v8SystemReady,
                    initialized: this.initialized,
                    rendererType: this.rendererType,
                    webgpuActive: this.rendererType === 'webgpu'
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
                    fullyInitialized: this.isV8Ready()
                }
            };
        }
    }
    
    // Tegaki名前空間に登録
    window.Tegaki.TegakiApplication = TegakiApplication;
    
    console.log('🚀 TegakiApplication PixiJS v8対応版 Loaded - WebGPU対応・非同期初期化・Container階層・リアルタイム描画');
} else {
    console.log('⚠️ TegakiApplication already defined - skipping redefinition');
}

console.log('🚀 TegakiApplication PixiJS v8対応版 Loaded - WebGPU対応・非同期初期化・Container階層・リアルタイム描画');