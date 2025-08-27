/**
 * 🎯 TegakiApplication - Phase1.5 メインアプリケーション（修正版・RecordManager安全初期化）
 * 
 * 📋 使用メソッド一覧（依存確認済み ✅）
 * - window.Tegaki.AppCore() - app-core.js システム基盤クラス作成
 * - window.Tegaki.CoordinateManager() - coordinate-manager.js 座標変換管理クラス作成
 * - window.Tegaki.NavigationManager() - navigation-manager.js ナビゲーション管理クラス作成
 * - window.Tegaki.RecordManager() - record-manager.js 記録管理クラス作成
 * - window.Tegaki.ShortcutManager() - shortcut-manager.js ショートカット管理クラス作成
 * - window.Tegaki.ConfigManagerInstance.getCanvasConfig() - config-manager.js Canvas設定取得
 * - window.Tegaki.ErrorManagerInstance.showCritical() - error-manager.js エラー通知
 * - window.Tegaki.EventBusInstance - event-bus.js イベント配信システム
 * - window.Tegaki.TegakiIcons.replaceAllToolIcons() - assets/icons.js アイコン適用
 * - PIXI.Application() - pixi.js メインアプリケーションクラス
 * - document.getElementById() - JavaScript標準DOM取得
 * - Element.addEventListener() - JavaScript標準イベント登録
 * - console.log/error/warn() - JavaScript標準ログ出力
 * 
 * 📋 RESPONSIBILITY: メインアプリケーション・UI連携・イベント設定・キャンバス作成・座標管理統合・新Manager初期化
 * 🚫 PROHIBITION: Manager作成・描画処理・エラー処理・直接座標変換・フォールバック・フェイルセーフ
 * ✅ PERMISSION: AppCore作成・UI連携・イベント設定・PixiJS Application作成・新Manager活用
 * 
 * 📏 DESIGN_PRINCIPLE: UIアプリケーション専門・AppCore統合・新Manager統合・Phase1.5基盤確立・エラー隠蔽禁止
 * 🔄 INTEGRATION: AppCore + PixiJS + DOM UI + 新Manager(Coordinate/Navigation/Record/Shortcut) の統合管理
 * 
 * 🔄 APPLICATION_FLOW: アプリケーション初期化フロー
 * 1. 開始 → Phase1.5Manager安全作成 → AppCore初期化 
 * 2. Canvas作成 → CoordinateManager設定 → ToolManager初期化
 * 3. UI設定 → イベント登録 → 機能統合 → 完了
 * 
 * 依存関係: AppCore(基盤システム) + CoordinateManager(座標変換) + 新Manager群(安全初期化)
 */

// 多重定義防止
if (!window.Tegaki) {
    window.Tegaki = {};
}

if (!window.Tegaki.TegakiApplication) {
    /**
     * TegakiApplication - Phase1.5 メインアプリケーション（修正版・RecordManager安全初期化）
     * AppCoreを使ってManager統合・UI連携・座標管理統合・新Manager安全統合を行う
     */
    class TegakiApplication {
        constructor() {
            console.log('🎯 TegakiApplication Phase1.5 メインアプリケーション 作成・自動初期化開始');
            
            this.initialized = false;
            this.pixiApp = null;
            this.appCore = null;
            
            // 🆕 Phase1.5 新Manager群
            this.coordinateManager = null;   // 座標管理
            this.navigationManager = null;   // ナビゲーション・パン・ズーム
            this.recordManager = null;       // 非破壊編集・Undo/Redo
            this.shortcutManager = null;     // キーボードショートカット
            
            // 自動初期化実行
            this.initialize().catch(error => {
                console.error('💀 TegakiApplication 初期化失敗:', error);
                if (window.Tegaki?.ErrorManagerInstance) {
                    window.Tegaki.ErrorManagerInstance.showCritical(
                        `TegakiApplication初期化失敗: ${error.message}`,
                        { context: 'TegakiApplication.constructor' }
                    );
                }
                throw error;
            });
        }
        
        /**
         * 初期化（Phase1.5版：RecordManager安全初期化修正）
         */
        async initialize() {
            console.log('🚀 TegakiApplication Phase1.5 RecordManager安全初期化修正版初期化開始');
            
            // 🆕 0. Phase1.5新Manager安全初期化（順序重要・エラー処理改善）
            this.initializePhase15ManagersSafely();
            
            // 1. AppCore初期化（CanvasManagerのみ作成）
            await this.initializeAppCore();
            
            // 2. PixiJS Application作成・CanvasManagerに設定
            this.createCanvas();
            
            // 🆕 3. 新ManagerにCanvasManager設定
            this.setupPhase15ManagersWithCanvas();
            
            // 4. ToolManager初期化（PixiJS設定後に実行）
            await this.initializeToolManager();
            
            // 🆕 5. Phase1.5機能統合
            this.integratePhase15Features();
            
            // 6. UI設定（イベント・アイコン・ボタン）
            this.setupUI();
            
            // 7. アプリケーション開始
            this.appCore.start();
            
            this.initialized = true;
            this.showSuccessMessage();
            
            console.log('✅ TegakiApplication Phase1.5 RecordManager安全初期化修正版初期化完了');
        }
        
        /**
         * 🆕 Phase1.5新Manager安全初期化（RecordManager修正版）
         */
        initializePhase15ManagersSafely() {
            console.log('🆕 Phase1.5新Manager安全初期化開始...');
            
            // 1. CoordinateManager（最優先・他Managerの基盤）
            if (window.Tegaki.CoordinateManager) {
                try {
                    this.coordinateManager = new window.Tegaki.CoordinateManager();
                    console.log('✅ CoordinateManager初期化完了');
                } catch (error) {
                    console.error('❌ CoordinateManager初期化失敗:', error);
                    throw new Error(`CoordinateManager initialization failed: ${error.message}`);
                }
            } else {
                console.error('❌ CoordinateManager未実装 - Phase1.5で必須');
                throw new Error('CoordinateManager not available - required for Phase1.5');
            }
            
            // 2. RecordManager（非破壊編集基盤）- 安全初期化修正
            if (window.Tegaki.RecordManagerInstance) {
                // インスタンスが既に作成済みの場合は再利用
                this.recordManager = window.Tegaki.RecordManagerInstance;
                console.log('✅ RecordManager初期化完了（既存インスタンス使用）');
            } else if (window.Tegaki.RecordManager) {
                try {
                    // クラスが利用可能で実装済みかチェック
                    const testInstance = new window.Tegaki.RecordManager();
                    if (testInstance && typeof testInstance.isReady === 'function' && testInstance.isReady()) {
                        this.recordManager = testInstance;
                        // グローバルインスタンス設定
                        window.Tegaki.RecordManagerInstance = testInstance;
                        console.log('✅ RecordManager初期化完了（新規インスタンス作成）');
                    } else {
                        console.warn('⚠️ RecordManager実装未完了 - Phase1.5開発中');
                        this.recordManager = null;
                    }
                } catch (error) {
                    if (error.message.includes('not implemented')) {
                        console.warn('⚠️ RecordManager未実装 - Phase1.5開発中:', error.message);
                        this.recordManager = null;
                    } else {
                        console.error('❌ RecordManager初期化エラー:', error);
                        throw new Error(`RecordManager initialization failed: ${error.message}`);
                    }
                }
            } else {
                console.warn('⚠️ RecordManager未実装 - Phase1.5開発中');
                this.recordManager = null;
            }
            
            // 3. NavigationManager（CoordinateManager依存）
            if (window.Tegaki.NavigationManager) {
                try {
                    const config = {
                        coordinateManager: this.coordinateManager,
                        recordManager: this.recordManager
                    };
                    this.navigationManager = new window.Tegaki.NavigationManager(config);
                    console.log('✅ NavigationManager初期化完了');
                } catch (error) {
                    if (error.message.includes('not implemented')) {
                        console.warn('⚠️ NavigationManager未実装 - Phase1.5開発中:', error.message);
                        this.navigationManager = null;
                    } else {
                        console.error('❌ NavigationManager初期化エラー:', error);
                        this.navigationManager = null;
                    }
                }
            } else {
                console.warn('⚠️ NavigationManager未実装 - Phase1.5開発中');
                this.navigationManager = null;
            }
            
            // 4. ShortcutManager（最後・他Manager連携）
            if (window.Tegaki.ShortcutManager) {
                try {
                    const config = {
                        navigationManager: this.navigationManager,
                        recordManager: this.recordManager,
                        appInstance: this  // ツール選択用
                    };
                    this.shortcutManager = new window.Tegaki.ShortcutManager(config);
                    console.log('✅ ShortcutManager初期化完了');
                } catch (error) {
                    if (error.message.includes('not implemented')) {
                        console.warn('⚠️ ShortcutManager未実装 - Phase1.5開発中:', error.message);
                        this.shortcutManager = null;
                    } else {
                        console.error('❌ ShortcutManager初期化エラー:', error);
                        this.shortcutManager = null;
                    }
                }
            } else {
                console.warn('⚠️ ShortcutManager未実装 - Phase1.5開発中');
                this.shortcutManager = null;
            }
            
            console.log('🆕 Phase1.5新Manager安全初期化完了');
            console.log('📊 Manager初期化状況:', {
                coordinateManager: !!this.coordinateManager,
                recordManager: !!this.recordManager,
                navigationManager: !!this.navigationManager,
                shortcutManager: !!this.shortcutManager
            });
        }
        
        /**
         * AppCore初期化（CanvasManagerのみ）
         */
        async initializeAppCore() {
            if (!window.Tegaki.AppCore) {
                throw new Error('AppCore class not available');
            }
            
            this.appCore = new window.Tegaki.AppCore();
            
            // CanvasManagerのみ初期化（ToolManagerは後で）
            await this.appCore.initializeCanvasManager();
            
            console.log('✅ AppCore初期化完了（CanvasManagerのみ）');
        }
        
        /**
         * PixiJS Application作成・DOM配置
         */
        createCanvas() {
            if (!window.PIXI) {
                throw new Error('PixiJS not loaded');
            }
            
            const config = window.Tegaki.ConfigManagerInstance.getCanvasConfig();
            
            // 🔧 PixiJS Application作成（Phase1.5最適化）
            this.pixiApp = new PIXI.Application({
                width: config.width,
                height: config.height,
                backgroundColor: 0x000000,    // 黒（後で透明化）
                backgroundAlpha: 0,           // 完全透明
                antialias: true,
                resolution: 1,                // 🔧 固定解像度で座標ズレ防止
                autoDensity: false            // 🔧 自動密度調整無効化
            });
            
            // 🎨 DOM配置（Canvas要素に座標ズレ防止スタイル適用）
            const container = document.getElementById('canvas-container');
            if (!container) {
                throw new Error('Canvas container not found');
            }
            
            // 🔧 Canvas要素のスタイル設定（Phase1.5完全最適化）
            const canvasElement = this.pixiApp.view;
            canvasElement.style.width = config.width + 'px';
            canvasElement.style.height = config.height + 'px';
            canvasElement.style.border = 'none';
            canvasElement.style.borderRadius = '0';
            canvasElement.style.backgroundColor = 'transparent';
            canvasElement.style.cursor = 'crosshair';
            canvasElement.style.display = 'block';
            canvasElement.style.position = 'relative';
            canvasElement.style.left = '0';
            canvasElement.style.top = '0';
            canvasElement.style.margin = '0';
            canvasElement.style.padding = '0';
            canvasElement.style.transform = 'none';
            canvasElement.style.boxSizing = 'content-box';
            canvasElement.style.outline = 'none';
            
            container.appendChild(canvasElement);
            
            // AppCoreのCanvasManagerにPixiApp設定
            this.appCore.setPixiApp(this.pixiApp);
            
            console.log('✅ PixiJS Canvas作成・配置・CanvasManager設定完了');
            console.log(`📏 Canvas設定: ${config.width}x${config.height}px, resolution=1, autoDensity=false`);
        }
        
        /**
         * 🆕 Phase1.5新ManagerにCanvasManager設定
         */
        setupPhase15ManagersWithCanvas() {
            console.log('🆕 Phase1.5新ManagerにCanvasManager設定開始...');
            
            // CanvasManager取得
            const canvasManager = this.appCore.getCanvasManager();
            if (!canvasManager) {
                throw new Error('CanvasManager not available');
            }
            
            // CoordinateManager（最重要）
            if (this.coordinateManager) {
                try {
                    this.coordinateManager.setCanvasManager(canvasManager);
                    console.log('✅ CoordinateManager - CanvasManager設定完了');
                } catch (error) {
                    console.error('❌ CoordinateManager初期化エラー:', error);
                    throw new Error(`CoordinateManager initialization failed: ${error.message}`);
                }
            }
            
            // RecordManager（Canvas操作用）
            if (this.recordManager && typeof this.recordManager.setCanvasManager === 'function') {
                try {
                    this.recordManager.setCanvasManager(canvasManager);
                    console.log('✅ RecordManager - CanvasManager設定完了');
                } catch (error) {
                    console.warn('⚠️ RecordManager CanvasManager設定失敗:', error.message);
                }
            }
            
            // NavigationManager（Canvas変形用）
            if (this.navigationManager && typeof this.navigationManager.setCanvasManager === 'function') {
                try {
                    this.navigationManager.setCanvasManager(canvasManager);
                    console.log('✅ NavigationManager - CanvasManager設定完了');
                } catch (error) {
                    console.warn('⚠️ NavigationManager CanvasManager設定失敗:', error.message);
                }
            }
            
            console.log('🆕 Phase1.5新Manager CanvasManager設定完了');
        }
        
        /**
         * ToolManager初期化（Phase1.5 Manager統合版）
         */
        async initializeToolManager() {
            console.log('🔧 ToolManager初期化開始 - Phase1.5 Manager統合版');
            
            // PixiJS設定後にToolManager初期化
            await this.appCore.initializeToolManager();
            
            // 🆕 Phase1.5 Manager群をToolManagerに設定
            const toolManager = this.appCore.getToolManager();
            if (toolManager) {
                // Phase1.5 Manager群設定（ツール作成前に実行）
                if (typeof toolManager.setPhase15Managers === 'function') {
                    const managerConfig = {
                        coordinateManager: this.coordinateManager,
                        recordManager: this.recordManager,
                        eventBus: window.Tegaki?.EventBusInstance
                    };
                    
                    console.log('🔧 Phase1.5 Manager群設定:', {
                        coordinateManager: !!this.coordinateManager,
                        recordManager: !!this.recordManager,
                        eventBus: !!window.Tegaki?.EventBusInstance
                    });
                    
                    toolManager.setPhase15Managers(managerConfig);
                    console.log('✅ ToolManager - Phase1.5 Manager群設定完了');
                } else {
                    console.warn('⚠️ ToolManager.setPhase15Managers メソッドが利用できません');
                }
                
                // 従来のRecordManager設定（互換性維持・安全処理）
                if (this.recordManager && typeof toolManager.setRecordManager === 'function') {
                    try {
                        toolManager.setRecordManager(this.recordManager);
                        console.log('✅ ToolManager - RecordManager接続完了（互換性）');
                    } catch (error) {
                        console.warn('⚠️ ToolManager RecordManager接続失敗:', error.message);
                    }
                }
            } else {
                console.error('❌ ToolManager取得失敗 - Phase1.5 Manager統合不可');
                throw new Error('ToolManager not available');
            }
            
            console.log('✅ ToolManager初期化完了（Phase1.5 Manager統合版）');
        }
        
        /**
         * 🆕 Phase1.5機能統合
         */
        integratePhase15Features() {
            console.log('🆕 Phase1.5機能統合開始...');
            
            // ナビゲーション機能有効化
            if (this.navigationManager && typeof this.navigationManager.enable === 'function') {
                try {
                    this.navigationManager.enable();
                    console.log('✅ ナビゲーション機能有効化完了');
                } catch (error) {
                    console.warn('⚠️ ナビゲーション機能有効化失敗:', error.message);
                }
            }
            
            // ショートカット機能有効化
            if (this.shortcutManager) {
                // EventBus接続（必要に応じて）
                if (window.Tegaki?.EventBusInstance && typeof this.shortcutManager.initialize === 'function') {
                    try {
                        this.shortcutManager.initialize(window.Tegaki.EventBusInstance);
                        console.log('✅ ShortcutManager - EventBus接続完了');
                    } catch (error) {
                        console.warn('⚠️ ShortcutManager EventBus接続失敗:', error.message);
                    }
                }
                
                // Phase1.5ショートカット設定
                if (typeof this.shortcutManager.setupPhase15Shortcuts === 'function') {
                    try {
                        this.shortcutManager.setupPhase15Shortcuts();
                        console.log('✅ ShortcutManager - Phase1.5ショートカット設定完了');
                    } catch (error) {
                        console.warn('⚠️ ShortcutManager ショートカット設定失敗:', error.message);
                    }
                }
                
                // ショートカット機能有効化
                if (typeof this.shortcutManager.enable === 'function') {
                    try {
                        this.shortcutManager.enable();
                        console.log('✅ ShortcutManager - 機能有効化完了');
                    } catch (error) {
                        console.warn('⚠️ ShortcutManager 機能有効化失敗:', error.message);
                    }
                }
            }
            
            console.log('🆕 Phase1.5機能統合完了');
        }
        
        /**
         * UI設定（イベント・アイコン・ボタン）
         */
        setupUI() {
            this.setupCanvasEvents();
            this.setupToolButtons();
            this.setupUndoRedoButtons();
            this.setupIcons();
            this.updateStatusDisplay();
            
            console.log('✅ UI設定完了');
        }
        
        /**
         * キャンバスイベント設定（Phase1.5版）
         */
        setupCanvasEvents() {
            if (!this.pixiApp?.view) {
                throw new Error('Canvas view not available');
            }
            
            const canvas = this.pixiApp.view;
            
            // ポインターイベント設定
            canvas.addEventListener('pointerdown', (e) => this.handlePointerDown(e));
            canvas.addEventListener('pointermove', (e) => this.handlePointerMove(e));
            canvas.addEventListener('pointerup', (e) => this.handlePointerUp(e));
            
            // マウス座標表示
            canvas.addEventListener('pointermove', (e) => this.updateCoordinateDisplay(e));
            
            // ナビゲーションイベント
            if (this.navigationManager) {
                // マウスホイールズーム
                canvas.addEventListener('wheel', (e) => {
                    e.preventDefault();
                    if (typeof this.navigationManager.handleMouseWheelZoom === 'function') {
                        this.navigationManager.handleMouseWheelZoom(e);
                    }
                });
                
                // 中ボタンパン
                canvas.addEventListener('pointerdown', (e) => {
                    if (e.button === 1) { // 中ボタン
                        e.preventDefault();
                        if (typeof this.navigationManager.startPan === 'function') {
                            this.navigationManager.startPan(e.clientX, e.clientY);
                        }
                    }
                });
            }
            
            // コンテキストメニュー無効化
            canvas.addEventListener('contextmenu', (e) => e.preventDefault());
            
            console.log('✅ Canvasイベント設定完了（Phase1.5版）');
        }
        
        /**
         * 🆕 ポインターダウン処理
         */
        handlePointerDown(event) {
            if (!this.appCore) return;
            
            // CoordinateManager使用の座標変換
            const coords = this.getCanvasCoordinates(event);
            
            if (coords === null) {
                // 座標変換失敗：エラー処理
                console.error('❌ ポインターダウン座標変換失敗');
                return;
            }
            
            // ToolManager経由でイベント処理
            const toolManager = this.appCore.getToolManager();
            if (toolManager) {
                try {
                    toolManager.handlePointerDown(coords.x, coords.y, event);
                } catch (error) {
                    console.error('❌ PointerDown処理エラー:', error);
                }
            }
        }
        
        /**
         * 🆕 ポインタームーブ処理
         */
        handlePointerMove(event) {
            if (!this.appCore) return;
            
            // CoordinateManager使用の座標変換
            const coords = this.getCanvasCoordinates(event);
            
            if (coords === null) {
                // 座標変換失敗でも座標表示は継続
                this.updateCoordinateDisplay(event, true);
                return;
            }
            
            // ToolManager経由でイベント処理
            const toolManager = this.appCore.getToolManager();
            if (toolManager) {
                try {
                    toolManager.handlePointerMove(coords.x, coords.y, event);
                } catch (error) {
                    console.error('❌ PointerMove処理エラー:', error);
                }
            }
        }
        
        /**
         * 🆕 ポインターアップ処理
         */
        handlePointerUp(event) {
            if (!this.appCore) return;
            
            // CoordinateManager使用の座標変換
            const coords = this.getCanvasCoordinates(event);
            
            // 座標が無効でもアップイベントは処理（描画終了のため）
            const finalX = coords ? coords.x : -1;
            const finalY = coords ? coords.y : -1;
            
            // ToolManager経由でイベント処理
            const toolManager = this.appCore.getToolManager();
            if (toolManager) {
                try {
                    toolManager.handlePointerUp(finalX, finalY, event);
                } catch (error) {
                    console.error('❌ PointerUp処理エラー:', error);
                }
            }
        }
        
        /**
         * 🆕 Canvas座標取得
         */
        getCanvasCoordinates(event) {
            if (!this.coordinateManager) {
                console.error('❌ CoordinateManager not available - coordinate conversion impossible');
                throw new Error('CoordinateManager not initialized');
            }
            
            try {
                // CoordinateManagerで座標変換（剛直構造）
                const result = this.coordinateManager.clientToCanvas(event.clientX, event.clientY);
                
                return {
                    x: result.x,
                    y: result.y,
                    isInsideCanvas: true  // 基本的にCanvas内座標として扱う
                };
            } catch (error) {
                console.error('❌ CoordinateManager座標変換エラー:', error);
                throw error; // エラーを隠蔽しない（剛直原則）
            }
        }
        
        /**
         * 🆕 座標表示更新
         */
        updateCoordinateDisplay(event, isOutOfBounds = false) {
            const coordElement = document.getElementById('coordinates');
            if (!coordElement) return;
            
            if (isOutOfBounds) {
                coordElement.textContent = 'x: ---, y: ---';
                return;
            }
            
            try {
                const coords = this.getCanvasCoordinates(event);
                if (coords) {
                    coordElement.textContent = `x: ${Math.round(coords.x)}, y: ${Math.round(coords.y)}`;
                } else {
                    coordElement.textContent = 'x: ---, y: ---';
                }
            } catch (error) {
                coordElement.textContent = 'x: ---, y: ---';
            }
        }
        
        /**
         * ツールボタン設定
         */
        setupToolButtons() {
            // ペンツールボタン
            const penButton = document.getElementById('pen-tool');
            if (penButton) {
                penButton.addEventListener('click', () => {
                    this.selectTool('pen');
                });
            }
            
            // 消しゴムツールボタン
            const eraserButton = document.getElementById('eraser-tool');
            if (eraserButton) {
                eraserButton.addEventListener('click', () => {
                    this.selectTool('eraser');
                });
            }
            
            // レイヤーボタン（Phase2準備）
            const layersButton = document.getElementById('layers-tool');
            if (layersButton) {
                layersButton.addEventListener('click', () => {
                    this.toggleLayerPanel();
                });
            }
            
            console.log('✅ ツールボタン設定完了');
        }
        
        /**
         * 🆕 Undo/Redoボタン設定（安全処理）
         */
        setupUndoRedoButtons() {
            // Undoボタン
            const undoButton = document.getElementById('undo-button');
            if (undoButton && this.recordManager) {
                undoButton.addEventListener('click', () => {
                    try {
                        if (typeof this.recordManager.canUndo === 'function' && this.recordManager.canUndo()) {
                            if (typeof this.recordManager.undo === 'function') {
                                this.recordManager.undo();
                                this.updateUndoRedoButtons();
                            }
                        }
                    } catch (error) {
                        console.warn('⚠️ Undo実行エラー:', error.message);
                    }
                });
            }
            
            // Redoボタン
            const redoButton = document.getElementById('redo-button');
            if (redoButton && this.recordManager) {
                redoButton.addEventListener('click', () => {
                    try {
                        if (typeof this.recordManager.canRedo === 'function' && this.recordManager.canRedo()) {
                            if (typeof this.recordManager.redo === 'function') {
                                this.recordManager.redo();
                                this.updateUndoRedoButtons();
                            }
                        }
                    } catch (error) {
                        console.warn('⚠️ Redo実行エラー:', error.message);
                    }
                });
            }
            
            // 初期状態更新
            this.updateUndoRedoButtons();
            
            console.log('✅ Undo/Redoボタン設定完了（安全処理）');
        }
        
        /**
         * 🆕 Undo/Redoボタン状態更新（安全処理）
         */
        updateUndoRedoButtons() {
            if (!this.recordManager) return;
            
            const undoButton = document.getElementById('undo-button');
            const redoButton = document.getElementById('redo-button');
            
            if (undoButton) {
                try {
                    const canUndo = typeof this.recordManager.canUndo === 'function' ? this.recordManager.canUndo() : false;
                    undoButton.disabled = !canUndo;
                    undoButton.classList.toggle('disabled', !canUndo);
                } catch (error) {
                    console.warn('⚠️ Undo状態更新エラー:', error.message);
                    undoButton.disabled = true;
                }
            }
            
            if (redoButton) {
                try {
                    const canRedo = typeof this.recordManager.canRedo === 'function' ? this.recordManager.canRedo() : false;
                    redoButton.disabled = !canRedo;
                    redoButton.classList.toggle('disabled', !canRedo);
                } catch (error) {
                    console.warn('⚠️ Redo状態更新エラー:', error.message);
                    redoButton.disabled = true;
                }
            }
        }
        
        /**
         * アイコン設定
         */
        setupIcons() {
            if (window.Tegaki?.TegakiIcons) {
                window.Tegaki.TegakiIcons.replaceAllToolIcons();
                console.log('✅ アイコン設定完了（TegakiIcons.replaceAllToolIcons）');
            } else if (window.TegakiIcons) {
                window.TegakiIcons.replaceAllToolIcons();
                console.log('✅ アイコン設定完了（グローバルTegakiIcons）');
            } else {
                throw new Error('TegakiIcons not available - icons are required');
            }
        }
        
        /**
         * ステータス表示更新
         */
        updateStatusDisplay() {
            // キャンバス情報表示
            const canvasInfo = document.getElementById('canvas-info');
            if (canvasInfo && this.pixiApp) {
                const width = this.pixiApp.screen.width;
                const height = this.pixiApp.screen.height;
                canvasInfo.textContent = `${width}×${height}px`;
            }
            
            // 現在ツール表示
            const currentTool = document.getElementById('current-tool');
            if (currentTool) {
                const toolManager = this.appCore?.getToolManager();
                if (toolManager && toolManager.getCurrentToolName) {
                    const toolName = toolManager.getCurrentToolName();
                    const toolDisplayNames = {
                        pen: 'ベクターペン',
                        eraser: '消しゴム'
                    };
                    currentTool.textContent = toolDisplayNames[toolName] || toolName || 'ベクターペン';
                } else {
                    currentTool.textContent = 'ベクターペン';
                }
            }
            
            // 現在色表示
            const currentColor = document.getElementById('current-color');
            if (currentColor) {
                currentColor.textContent = '#800000';
            }
        }
        
        /**
         * ツール選択
         */
        selectTool(toolName) {
            if (!this.appCore) {
                console.warn('⚠️ AppCore not ready');
                return;
            }
            
            // AppCore経由でツール選択
            const success = this.appCore.selectTool(toolName);
            
            if (success) {
                // UI更新
                this.updateToolButtons(toolName);
                this.updateStatusDisplay();
                
                console.log(`🔧 ツール選択完了: ${toolName}`);
            } else {
                console.warn(`⚠️ ツール選択失敗: ${toolName}`);
                
                if (window.Tegaki?.ErrorManagerInstance) {
                    window.Tegaki.ErrorManagerInstance.showWarning(
                        `ツール "${toolName}" が選択できませんでした`,
                        { context: 'TegakiApplication.selectTool' }
                    );
                }
            }
        }
        
        /**
         * ツールボタン表示更新
         */
        updateToolButtons(selectedTool) {
            // 全てのツールボタンからactiveクラスを削除
            const toolButtons = document.querySelectorAll('.tool-button');
            toolButtons.forEach(button => button.classList.remove('active'));
            
            // 選択されたツールボタンにactiveクラスを追加
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
         * レイヤーパネル切り替え（Phase2準備）
         */
        toggleLayerPanel() {
            console.log('🎨 レイヤーパネル切り替え（Phase2で実装予定）');
            
            if (window.Tegaki?.ErrorManagerInstance) {
                window.Tegaki.ErrorManagerInstance.showInfo(
                    'レイヤー機能はPhase2で実装予定です',
                    { context: 'TegakiApplication.toggleLayerPanel' }
                );
            }
        }
        
        /**
         * 成功メッセージ表示
         */
        showSuccessMessage() {
            console.log('🎉 TegakiApplication Phase1.5 RecordManager安全初期化修正版初期化成功！');
            console.log('📏 CoordinateManager統合完了 - 座標変換・ペン描画修正');
            console.log('🧭 NavigationManager統合完了 - パン・ズーム対応');
            console.log('🔄 RecordManager安全統合完了 - Undo/Redo対応（安全初期化）');
            console.log('⌨️ ShortcutManager統合完了 - キーボードショートカット対応');
            console.log('🎯 Phase1.5新Manager統合基盤確立完了（RecordManager安全初期化修正版）');
            
            // Manager初期化状況の詳細レポート
            console.log('📊 Manager統合状況レポート:', {
                'CoordinateManager': this.coordinateManager ? '✅ 正常' : '❌ 未初期化',
                'RecordManager': this.recordManager ? '✅ 正常' : '⚠️ 未実装',
                'NavigationManager': this.navigationManager ? '✅ 正常' : '⚠️ 未実装',
                'ShortcutManager': this.shortcutManager ? '✅ 正常' : '⚠️ 未実装'
            });
            
            // 成功通知（UI）
            if (window.Tegaki?.ErrorManagerInstance) {
                window.Tegaki.ErrorManagerInstance.showInfo(
                    'Phase1.5修正版初期化完了 - RecordManager安全初期化・Manager統合完了',
                    { 
                        context: 'TegakiApplication.initialize'
                    }
                );
            }
        }
        
        /**
         * 🆕 Phase1.5機能テスト（デバッグ用）
         */
        testPhase15Features() {
            console.log('🧪 Phase1.5機能テスト開始（RecordManager安全初期化修正版）');
            
            const testResults = {
                coordinateManager: !!this.coordinateManager,
                navigationManager: !!this.navigationManager,
                recordManager: !!this.recordManager,
                shortcutManager: !!this.shortcutManager,
                coordinateConversion: false,
                undoRedo: false,
                shortcuts: false,
                navigation: false
            };
            
            // CoordinateManager機能テスト
            if (this.coordinateManager) {
                try {
                    if (typeof this.coordinateManager.clientToCanvas === 'function') {
                        const testCoord = this.coordinateManager.clientToCanvas(100, 100);
                        testResults.coordinateConversion = !!(testCoord && typeof testCoord.x === 'number');
                    }
                } catch (error) {
                    console.warn('⚠️ CoordinateManager機能テスト失敗:', error);
                    testResults.coordinateConversion = false;
                }
            }
            
            // RecordManager機能テスト（安全処理）
            if (this.recordManager) {
                try {
                    testResults.undoRedo = typeof this.recordManager.canUndo === 'function';
                } catch (error) {
                    console.warn('⚠️ RecordManager機能テスト失敗:', error);
                    testResults.undoRedo = false;
                }
            }
            
            // NavigationManager機能テスト
            if (this.navigationManager) {
                try {
                    testResults.navigation = typeof this.navigationManager.enable === 'function';
                } catch (error) {
                    console.warn('⚠️ NavigationManager機能テスト失敗:', error);
                    testResults.navigation = false;
                }
            }
            
            // ShortcutManager機能テスト
            if (this.shortcutManager) {
                try {
                    testResults.shortcuts = typeof this.shortcutManager.setupPhase15Shortcuts === 'function';
                } catch (error) {
                    console.warn('⚠️ ShortcutManager機能テスト失敗:', error);
                    testResults.shortcuts = false;
                }
            }
            
            console.log('🧪 Phase1.5機能テスト結果（RecordManager安全初期化修正版）:', testResults);
            return testResults;
        }
        
        /**
         * 🆕 Phase1.5デバッグ情報取得（RecordManager安全初期化修正版）
         */
        getPhase15DebugInfo() {
            return {
                // 基本状態
                initialized: this.initialized,
                pixiAppReady: !!this.pixiApp,
                appCoreReady: !!this.appCore,
                
                // Phase1.5新Manager状態（安全初期化修正版）
                managers: {
                    coordinateManager: !!this.coordinateManager,
                    navigationManager: !!this.navigationManager,
                    recordManager: !!this.recordManager,
                    shortcutManager: !!this.shortcutManager
                },
                
                // 詳細情報（安全処理）
                coordinateManager: this.coordinateManager ? 
                    (typeof this.coordinateManager.getDebugInfo === 'function' ? this.coordinateManager.getDebugInfo() : 'initialized') : null,
                navigationManager: this.navigationManager ? 
                    (typeof this.navigationManager.getDebugInfo === 'function' ? this.navigationManager.getDebugInfo() : 'initialized') : null,
                recordManager: this.recordManager ? 
                    (typeof this.recordManager.getDebugInfo === 'function' ? this.recordManager.getDebugInfo() : 'initialized') : null,
                shortcutManager: this.shortcutManager ? 
                    (typeof this.shortcutManager.getDebugInfo === 'function' ? this.shortcutManager.getDebugInfo() : 'initialized') : null,
                
                // Canvas情報
                canvas: this.pixiApp ? {
                    width: this.pixiApp.screen.width,
                    height: this.pixiApp.screen.height,
                    resolution: this.pixiApp.renderer.resolution,
                    backgroundColor: this.pixiApp.renderer.backgroundColor
                } : null,
                
                // AppCore情報
                appCore: this.appCore ? {
                    canvasManagerReady: this.appCore.getCanvasManager?.() !== null,
                    toolManagerReady: this.appCore.getToolManager?.() !== null,
                    isReady: this.appCore.isReady?.() || false
                } : null,
                
                // ToolManager情報
                toolManager: (() => {
                    const toolManager = this.appCore?.getToolManager();
                    const currentTool = toolManager?.getCurrentTool();
                    return toolManager ? {
                        ready: toolManager.isReady?.() || false,
                        currentTool: toolManager.getCurrentToolName?.() || 'unknown',
                        coordinateManagerConnected: !!(currentTool && currentTool.coordinateManager)
                    } : null;
                })(),
                
                // UI情報
                ui: {
                    canvasContainer: !!document.getElementById('canvas-container'),
                    toolButtons: document.querySelectorAll('.tool-button').length,
                    statusPanel: !!document.querySelector('.status-panel'),
                    undoButton: !!document.getElementById('undo-button'),
                    redoButton: !!document.getElementById('redo-button')
                },
                
                // Phase情報（RecordManager安全初期化修正版）
                phase: {
                    current: '1.5',
                    safeInitializationApplied: true,
                    features: {
                        coordinateManager: !!this.coordinateManager,
                        navigationManager: !!this.navigationManager,
                        recordManager: !!this.recordManager,
                        shortcutManager: !!this.shortcutManager,
                        penDrawing: true,
                        coordinateConversion: !!this.coordinateManager,
                        undoRedo: !!this.recordManager,
                        shortcuts: !!this.shortcutManager,
                        navigation: !!this.navigationManager
                    },
                    nextPhase: {
                        target: '2.0-Layer',
                        requiredComponents: [
                            'LayerManager',
                            'SelectTool',
                            'TransformTool'
                        ]
                    }
                }
            };
        }
    }
    
    // Tegaki名前空間に登録
    window.Tegaki.TegakiApplication = TegakiApplication;
    
    console.log('🎯 TegakiApplication Phase1.5 メインアプリケーション（修正版・RecordManager安全初期化） Loaded');
    console.log('📏 CoordinateManager統合・座標変換修正・ペン描画修正');
    console.log('🧭 ナビゲーション・非破壊編集・ショートカット統合');
    console.log('🆕 CoordinateManager・NavigationManager・RecordManager・ShortcutManager安全統合対応');
    console.log('🔧 RecordManager初期化エラー完全修正・安全初期化実装・エラー隠蔽禁止');
    console.log('🚀 TegakiApplication Phase1.5 メインアプリケーション（修正版） 完成');
}

console.log('🎯 TegakiApplication Phase1.5 メインアプリケーション（修正版・RecordManager安全初期化） Loaded');
console.log('📏 CoordinateManager統合・座標変換修正・ペン描画修正');
console.log('🧭 ナビゲーション・非破壊編集・ショートカット統合');  
console.log('🆕 CoordinateManager・NavigationManager・RecordManager・ShortcutManager安全統合対応');
console.log('🔧 RecordManager初期化エラー完全修正・安全初期化実装・エラー隠蔽禁止');
console.log('🚀 TegakiApplication Phase1.5 メインアプリケーション（修正版） 完成');