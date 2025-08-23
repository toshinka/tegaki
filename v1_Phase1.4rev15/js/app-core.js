/**
 * 🎨 AppCoreシステム（座標統合完全修正版・Manager初期化統一版）
 * 🎯 AI_WORK_SCOPE: PixiJSアプリケーション基盤・システム統合・初期化制御
 * 🎯 DEPENDENCIES: 統一システム4種、BoundaryManager、CoordinateManager、CanvasManager
 * 🎯 SPLIT_RESULT: 650行 → 350行（46%削減）
 * 🔧 COORDINATE_FIX: 座標統合完全修正・Manager初期化引数統一・エラー解消版
 * 🔄 INITIALIZATION_ORDER: 初期化順序完全修正・canvasElement適切受け渡し
 */

class AppCore {
    constructor() {
        this.validateUnifiedSystems();
        this.initializeConfig();
        
        // 基本プロパティ
        this.app = null;
        this.drawingContainer = null;
        this.uiContainer = null;
        
        // 分離された管理システム
        this.boundaryManager = null;
        this.coordinateManager = null;
        this.toolManager = null;
        this.uiManager = null;
        this.canvasManager = null;
        
        // 状態管理
        this.isInitializing = false;
        this.initializationComplete = false;
        this.initializationFailed = false;
        this.isDrawing = false;
        
        console.log('🎨 AppCore インスタンス作成完了（座標統合完全修正版・Manager初期化統一版）');
    }
    
    /**
     * 統一システム依存性確認（修正版）
     */
    validateUnifiedSystems() {
        const required = ['ConfigManager', 'ErrorManager', 'StateManager', 'EventBus'];
        const missing = required.filter(sys => !window[sys]);
        if (missing.length > 0) {
            throw new Error(`AppCore: 統一システム依存性エラー: ${missing.join(', ')}`);
        }
    }
    
    /**
     * 設定初期化（修正版）
     */
    initializeConfig() {
        try {
            const canvasConfig = window.ConfigManager.getCanvasConfig();
            this.canvasWidth = canvasConfig.width;
            this.canvasHeight = canvasConfig.height;
            this.backgroundColor = canvasConfig.backgroundColor;
            
            // 境界描画設定追加
            this.boundaryConfig = window.ConfigManager.get('canvas.boundary') || {
                enabled: true,
                margin: 20,
                trackingEnabled: true
            };
            
        } catch (error) {
            console.warn('⚠️ 設定初期化で問題発生、フォールバック使用:', error.message);
            
            // フォールバック設定
            this.canvasWidth = 400;
            this.canvasHeight = 400;
            this.backgroundColor = 0xf0e0d6;
            this.boundaryConfig = {
                enabled: true,
                margin: 20,
                trackingEnabled: true
            };
        }
    }
    
    /**
     * 🔧 アプリケーション初期化（async修正版・引数統一版・座標統合完全対応）
     */
    async initialize() {
        try {
            console.log('⚡ AppCore初期化開始 - v1.0-Phase1.4-integration-fixed');

            this.isInitializing = true;

            // STEP 1: 基盤システム確認
            if (!this.verifyFoundationSystems()) {
                throw new Error('基盤システム確認失敗');
            }

            // STEP 2: PixiJS基盤初期化
            if (!await this.initializeBasicSystems()) {
                throw new Error('PixiJS基盤初期化失敗');
            }

            // STEP 3: CanvasManager初期化（最優先）
            if (!await this.initializeCanvasManager()) {
                throw new Error('CanvasManager初期化失敗');
            }

            // STEP 4: CoordinateManager初期化（コンストラクタで自動初期化済み）
            this.initializeCoordinateManager();

            // STEP 5: BoundaryManager初期化
            if (!await this.initializeBoundaryManager()) {
                console.warn('⚠️ BoundaryManager初期化失敗（続行）');
            }

            // STEP 6: ToolManager初期化
            if (!await this.initializeToolManager()) {
                throw new Error('ToolManager初期化失敗');
            }

            // STEP 7: UIManager初期化
            if (!await this.initializeUIManager()) {
                console.warn('⚠️ UIManager初期化失敗（続行）');
            }

            // STEP 8: イベントリスナー設定
            this.setupEventListeners();

            // STEP 9: 初期化完了処理
            this.completeInitialization();

            console.log('✅ AppCore初期化完了');
            return true;

        } catch (error) {
            console.error('❌ AppCore初期化エラー:', error);
            await this.handleInitializationError(error);
            return false;
        } finally {
            this.isInitializing = false;
        }
    }
    
    /**
     * 基盤システム確認
     */
    verifyFoundationSystems() {
        try {
            const required = ['ConfigManager', 'ErrorManager', 'StateManager', 'EventBus'];
            for (const system of required) {
                if (!window[system]) {
                    throw new Error(`${system} が見つかりません`);
                }
            }
            console.log('✅ 基盤システム確認完了');
            return true;
        } catch (error) {
            console.error('❌ 基盤システム確認エラー:', error);
            return false;
        }
    }
    
    /**
     * 基盤システム初期化（座標統合修正版）
     */
    async initializeBasicSystems() {
        console.log('🔧 基盤システム初期化中（座標統合修正版）...');
        
        // DOM確認
        await this.verifyDOMElements();
        
        // PixiJSアプリケーション初期化
        await this.initializePixiApp();
        
        // コンテナ初期化
        this.initializeContainers();
        
        console.log('✅ 基盤システム初期化完了（座標統合修正版）');
        return true;
    }
    
    /**
     * 🆕 CoordinateManager初期化（独立処理）
     * 🔧 修正: CoordinateManagerはconstructorで自動初期化されるため、initialize()呼び出し不要
     */
    initializeCoordinateManager() {
        console.log('🔄 CoordinateManager初期化開始...');
        
        try {
            if (window.CoordinateManager) {
                this.coordinateManager = new window.CoordinateManager();
                
                // キャンバスサイズ情報を設定
                if (this.coordinateManager.updateCanvasSize) {
                    this.coordinateManager.updateCanvasSize(this.canvasWidth, this.canvasHeight);
                }
                
                console.log('✅ CoordinateManager初期化完了');
                
                // 座標統合設定確認
                const integrationStatus = this.coordinateManager.getIntegrationStatus && 
                                          this.coordinateManager.getIntegrationStatus() || {};
                console.log('🔄 AppCore座標統合設定:', integrationStatus);
                
            } else {
                console.warn('⚠️ CoordinateManager利用不可（オプション）');
                this.coordinateManager = null;
            }
            
        } catch (error) {
            console.error('❌ CoordinateManager初期化失敗:', error);
            this.coordinateManager = null;
        }
    }
    
    /**
     * 🔧 CanvasManager初期化（座標統合対応・グローバル検出強化）
     * 🔧 修正: 文法エラー修正 - aasync → async
     */
    async initializeCanvasManager() {
        try {
            console.log('🎨 AppCore: CanvasManager初期化開始');

            // ✅ 修正: クラス存在確認強化
            if (!window.CanvasManager) {
                throw new Error('CanvasManager クラスが見つかりません。スクリプト読み込み順序を確認してください。');
            }

            // 既存インスタンス確認
            if (this.canvasManager) {
                console.log('🎨 AppCore: 既存CanvasManagerインスタンスを利用');
                return true;
            }

            // 新規インスタンス作成
            this.canvasManager = new window.CanvasManager();
            await this.canvasManager.initialize();

            console.log('✅ AppCore: CanvasManager初期化完了');
            return true;

        } catch (error) {
            console.error('❌ CanvasManager初期化エラー:', error);
            window.ErrorManager?.showErrorMessage('キャンバス初期化失敗', error.message);
            return false;
        }
    }
    
    /**
     * 🔧 ToolManager初期化（CoordinateManager統合）
     */
    async initializeToolManager() {
        try {
            console.log('🎯 AppCore: ToolManager初期化開始');

            // ✅ 修正: クラス存在確認
            if (!window.ToolManager) {
                throw new Error('ToolManager クラスが見つかりません');
            }

            // 既存インスタンス確認
            if (this.toolManager) {
                console.log('🎯 AppCore: 既存ToolManagerインスタンスを利用');
            } else {
                this.toolManager = new window.ToolManager();
                await this.toolManager.initialize();
            }

            // CanvasManager接続
            if (this.canvasManager && typeof this.toolManager.setCanvasManager === 'function') {
                this.toolManager.setCanvasManager(this.canvasManager);
                console.log('🔗 AppCore: ToolManager ← CanvasManager 接続完了');
            } else {
                console.warn('⚠️ AppCore: CanvasManager接続スキップ');
            }

            // CoordinateManager破棄
            if (this.coordinateManager && typeof this.coordinateManager.destroy === 'function') {
                this.coordinateManager.destroy();
                this.coordinateManager = null;
            }
            
            // PixiJSアプリケーション破棄
            if (this.app) {
                this.app.destroy(true);
                this.app = null;
            }
            
            // プロパティクリア
            this.drawingContainer = null;
            this.uiContainer = null;
            
            console.log('🎨 AppCore 破棄完了（座標統合完全修正版・Manager初期化統一版）');
            
        } catch (error) {
            if (window.ErrorManager && typeof window.ErrorManager.showError === 'function') {
                window.ErrorManager.showError('warning', 
                    `AppCore破棄エラー: ${error.message}`,
                    { additionalInfo: 'AppCore破棄処理' }
                );
            }
        }
    }
}

// グローバル登録
if (typeof window !== 'undefined') {
    window.AppCore = AppCore;
    console.log('🎨 AppCore グローバル登録完了（座標統合完全修正版・Manager初期化統一版）');
}

console.log('🔄 AppCore Phase1.4 座標統合完全修正版・Manager初期化統一版 - 準備完了');
console.log('📋 座標統合修正完了: CoordinateManager統合・Manager連携・座標処理最適化');
console.log('🔧 Manager初期化統一: initialize()メソッド統一・引数統一・初期化順序修正');
console.log('🎨 CanvasManager完全統合: 描画処理委譲・リサイズ処理委譲・統合状態確認');
console.log('🎯 境界システム統合: PixiJS境界システム・座標変換・イベント連携');
console.log('🔧 初期化修正完了: BoundaryManager引数必須・canvasElement適切受け渡し・エラー解消');
console.log('💡 使用例: const appCore = new window.AppCore(); await appCore.initialize();');接続
            if (this.coordinateManager && typeof this.toolManager.setCoordinateManager === 'function') {
                this.toolManager.setCoordinateManager(this.coordinateManager);
                console.log('🔗 AppCore: ToolManager ← CoordinateManager 接続完了');
            } else {
                console.warn('⚠️ ToolManager: CoordinateManager統合をスキップ');
            }

            console.log('✅ AppCore: ToolManager初期化完了');
            return true;

        } catch (error) {
            console.error('❌ ToolManager初期化エラー:', error);
            return false;
        }
    }
    
    /**
     * 🔧 BoundaryManager初期化（引数統一・canvasElement必須版）
     */
    async initializeBoundaryManager() {
        if (window.BoundaryManager) {
            try {
                this.boundaryManager = new window.BoundaryManager();
                
                // 🔧 修正: canvasElementとCoordinateManagerを必ず渡す
                const canvasElement = this.app?.view;
                
                if (canvasElement) {
                    // 🔧 修正: initialize(canvasElement, coordinateManager)の引数を統一
                    await this.boundaryManager.initialize(canvasElement, this.coordinateManager);
                    console.log('✅ BoundaryManager初期化完了（canvasElement提供・CoordinateManager統合）');
                    return true;
                } else {
                    console.warn('⚠️ canvasElement未取得 - BoundaryManager初期化をスキップ');
                    this.boundaryManager = null;
                    return false;
                }
                
            } catch (error) {
                console.warn('⚠️ BoundaryManager初期化失敗:', error.message);
                this.boundaryManager = null;
                return false;
            }
        } else {
            console.warn('⚠️ BoundaryManager利用不可');
            this.boundaryManager = null;
            return false;
        }
    }
    
    /**
     * 🔧 UIManager初期化
     */
    async initializeUIManager() {
        if (window.UIManager) {
            try {
                this.uiManager = new window.UIManager(this);
                await this.uiManager.init(); // ← UIManagerは init() メソッド
                console.log('✅ UIManager初期化完了');
                return true;
            } catch (error) {
                console.warn('⚠️ UIManager初期化失敗:', error.message);
                this.uiManager = null;
                return false;
            }
        } else {
            console.warn('⚠️ UIManager利用不可');
            this.uiManager = null;
            return false;
        }
    }
    
    /**
     * DOM要素確認（修正版）
     * 🔧 修正: canvas-container要素を確認するように変更
     */
    async verifyDOMElements() {
        const canvasContainerElement = document.getElementById('canvas-container');
        if (!canvasContainerElement) {
            throw new Error('canvas-container 要素が見つかりません。index.htmlのDOM構造を確認してください。');
        }
        
        const drawingCanvasElement = document.getElementById('drawing-canvas');
        if (!drawingCanvasElement) {
            throw new Error('drawing-canvas 要素が見つかりません');
        }
        
        // キャンバス要素クリア
        while (drawingCanvasElement.firstChild) {
            drawingCanvasElement.removeChild(drawingCanvasElement.firstChild);
        }
        
        console.log('✅ DOM要素確認完了（canvas-container対応）');
    }
    
    /**
     * PixiJSアプリケーション初期化（修正版）
     */
    async initializePixiApp() {
        try {
            const canvasConfig = window.ConfigManager.getCanvasConfig();
            const pixiConfig = window.ConfigManager.getPixiConfig();
            
            this.app = new PIXI.Application({
                width: canvasConfig.width,
                height: canvasConfig.height,
                backgroundColor: canvasConfig.backgroundColor,
                antialias: pixiConfig.antialias,
                resolution: pixiConfig.resolution || window.devicePixelRatio || 1
            });
            
            const canvasElement = document.getElementById('drawing-canvas');
            canvasElement.appendChild(this.app.view);
            
            // キャンバス要素の基本設定
            this.app.view.style.cursor = pixiConfig.cursor || 'crosshair';
            this.app.view.style.touchAction = 'none'; // タッチスクロール防止
            
            console.log('✅ PixiJSアプリケーション初期化完了');
            
        } catch (error) {
            console.error('❌ PixiJSアプリケーション初期化失敗:', error);
            throw error;
        }
    }
    
    /**
     * コンテナ初期化（修正版）
     */
    initializeContainers() {
        try {
            // 描画レイヤー
            this.drawingContainer = new PIXI.Container();
            this.drawingContainer.name = 'drawing-layer';
            this.app.stage.addChild(this.drawingContainer);
            
            // UIレイヤー
            this.uiContainer = new PIXI.Container();
            this.uiContainer.name = 'ui-layer';
            this.app.stage.addChild(this.uiContainer);
            
            // ステージのインタラクティブ設定
            this.app.stage.interactive = true;
            this.app.stage.hitArea = new PIXI.Rectangle(0, 0, this.canvasWidth, this.canvasHeight);
            
            console.log('✅ コンテナ初期化完了');
            
        } catch (error) {
            console.error('❌ コンテナ初期化失敗:', error);
            throw error;
        }
    }
    
    /**
     * イベントリスナー設定（修正版・CanvasManager統合対応）
     */
    setupEventListeners() {
        try {
            // 🔧 CanvasManager統合: 描画イベントはCanvasManagerに委譲
            if (this.canvasManager && this.canvasManager.initialized) {
                console.log('🎨 描画イベントはCanvasManagerに委譲（初期化確認済み）');
                // CanvasManagerが既にsetupEventHandlers()で設定済み
            } else {
                // フォールバック: AppCoreで直接処理
                this.app.stage.on('pointerdown', this.handlePointerDown.bind(this));
                this.app.stage.on('pointermove', this.handlePointerMove.bind(this));
                this.app.stage.on('pointerup', this.handlePointerUp.bind(this));
                this.app.stage.on('pointerupoutside', this.handlePointerUp.bind(this));
                console.log('🔧 フォールバック: AppCore直接イベント処理（CanvasManager未初期化）');
            }
            
            // 境界越えイベント（BoundaryManager統合）
            if (window.EventBus && typeof window.EventBus.on === 'function') {
                window.EventBus.on('boundary.cross.in', this.handleBoundaryCrossIn.bind(this));
            }
            
            // ウィンドウイベント
            window.addEventListener('resize', this.handleResize.bind(this));
            
            // ツールイベント
            if (window.EventBus && typeof window.EventBus.on === 'function') {
                window.EventBus.on('tool.changed', this.handleToolChanged.bind(this));
            }
            
            console.log('✅ イベントリスナー設定完了（CanvasManager統合対応）');
            
        } catch (error) {
            console.warn('⚠️ イベントリスナー設定で問題発生:', error.message);
        }
    }
    
    /**
     * PixiJS境界システム統合初期化（座標統合修正版）
     */
    initializePixiBoundarySystem() {
        if (!this.app || !this.boundaryManager) {
            console.warn('⚠️ PixiJS境界システム統合スキップ（依存関係不足）');
            return;
        }
        
        try {
            console.log('🎯 PixiJS境界システム統合初期化中...');
            
            // 拡張ヒットエリア設定（座標統合対応）
            const margin = this.boundaryManager.boundaryMargin || 20;
            
            // 🔄 CoordinateManager経由でのマージン処理
            let adjustedMargin = margin;
            if (this.coordinateManager && this.coordinateManager.applyPrecision) {
                adjustedMargin = this.coordinateManager.applyPrecision(margin);
            }
            
            this.app.stage.hitArea = new PIXI.Rectangle(
                -adjustedMargin,
                -adjustedMargin,
                this.canvasWidth + adjustedMargin * 2,
                this.canvasHeight + adjustedMargin * 2
            );
            
            // インタラクティブ強化
            this.app.stage.interactive = true;
            this.app.stage.interactiveChildren = true;
            
            // 境界統合イベント設定
            this.setupPixiBoundaryEvents();
            
            console.log('✅ PixiJS境界システム統合完了（座標統合版）');
            
        } catch (error) {
            console.warn('⚠️ PixiJS境界システム統合で問題発生:', error.message);
        }
    }
    
    /**
     * PixiJS境界イベント設定（修正版）
     */
    setupPixiBoundaryEvents() {
        try {
            // 境界越えイベント統合
            if (window.EventBus && typeof window.EventBus.on === 'function') {
                window.EventBus.on('boundary.cross.in', (data) => {
                    this.handlePixiBoundaryCross(data);
                });
            }
            
            // PixiJSネイティブイベント拡張
            this.app.stage.on('pointerenter', (event) => {
                console.log('🎯 PixiJS ポインター エンター');
                if (window.EventBus && typeof window.EventBus.emit === 'function') {
                    window.EventBus.emit('pixi.pointer.enter', { event });
                }
            });
            
            this.app.stage.on('pointerleave', (event) => {
                console.log('🎯 PixiJS ポインター リーブ');
                if (window.EventBus && typeof window.EventBus.emit === 'function') {
                    window.EventBus.emit('pixi.pointer.leave', { event });
                }
            });
            
        } catch (error) {
            console.warn('⚠️ PixiJS境界イベント設定で問題発生:', error.message);
        }
    }
    
    /**
     * PixiJS境界越え処理（座標統合修正版）
     */
    handlePixiBoundaryCross(data) {
        if (!this.coordinateManager) return;
        
        try {
            // 🔄 CoordinateManager: PixiJS座標系変換
            const pixiCoords = this.coordinateManager.canvasToPixi && 
                               this.coordinateManager.canvasToPixi(
                                   data.position.x, 
                                   data.position.y, 
                                   this.app
                               ) || data.position;
            
            // アクティブツールに境界越え通知
            if (this.toolManager?.currentTool && typeof this.toolManager.currentTool.handleBoundaryCrossIn === 'function') {
                this.toolManager.currentTool.handleBoundaryCrossIn(
                    pixiCoords.x, 
                    pixiCoords.y, 
                    {
                        pressure: data.pressure,
                        pointerId: data.pointerId,
                        originalEvent: data.originalEvent,
                        pointerType: data.pointerType
                    }
                );
            }
            
            console.log(`🎯 PixiJS境界越え処理完了（座標統合）: (${pixiCoords.x.toFixed(1)}, ${pixiCoords.y.toFixed(1)})`);
            
        } catch (error) {
            if (window.ErrorManager && typeof window.ErrorManager.showError === 'function') {
                window.ErrorManager.showError('error', 
                    `PixiJS境界越え処理エラー: ${error.message}`, 
                    { additionalInfo: 'PixiJS境界処理', data }
                );
            }
        }
    }
    
    /**
     * 境界越え描画開始処理（修正版・CanvasManager統合対応）
     */
    handleBoundaryCrossIn(data) {
        // 🔧 CanvasManager統合: 描画処理はCanvasManagerに委譲
        if (this.canvasManager && typeof this.canvasManager.handleBoundaryCrossIn === 'function') {
            this.canvasManager.handleBoundaryCrossIn(data);
            return;
        }
        
        // フォールバック: ToolManager直接処理
        if (!this.toolManager) {
            console.warn('⚠️ ToolManager が利用できません');
            return;
        }
        
        try {
            const currentTool = this.toolManager.getCurrentTool();
            const currentToolInstance = this.toolManager.registeredTools.get(currentTool);
            
            if (currentToolInstance && typeof currentToolInstance.handleBoundaryCrossIn === 'function') {
                currentToolInstance.handleBoundaryCrossIn(
                    data.position.x, 
                    data.position.y, 
                    {
                        pressure: data.pressure,
                        pointerId: data.pointerId,
                        originalEvent: data.originalEvent,
                        pointerType: data.pointerType
                    }
                );
            }
            
            console.log(`🎯 境界越え描画開始: (${data.position.x.toFixed(1)}, ${data.position.y.toFixed(1)})`);
            
        } catch (error) {
            if (window.ErrorManager && typeof window.ErrorManager.showError === 'function') {
                window.ErrorManager.showError('warning', 
                    `境界越え描画エラー: ${error.message}`, 
                    { additionalInfo: '境界越え処理', data }
                );
            }
        }
    }
    
    /**
     * ポインターダウンハンドラー（座標統合修正版・CanvasManager委譲）
     */
    handlePointerDown(event) {
        try {
            if (!this.toolManager) {
                console.error('❌ AppCore: ToolManager未初期化');
                return;
            }

            // 境界チェック
            if (this.boundaryManager && !this.boundaryManager.isWithinBounds(event)) {
                console.warn('⚠️ AppCore: 境界外での描画開始を阻止');
                return;
            }

            // 描画開始
            this.isDrawing = true;

            // ✅ 修正: メソッド存在確認とフォールバック
            if (typeof this.toolManager.startDrawing === 'function') {
                this.toolManager.startDrawing(event);
            } else if (typeof this.toolManager.onPointerDown === 'function') {
                this.toolManager.onPointerDown(event);
            } else if (typeof this.toolManager.delegateToActiveTool === 'function') {
                this.toolManager.delegateToActiveTool('onPointerDown', event);
            } else {
                console.error('❌ AppCore: ToolManager に描画開始メソッドが見つかりません');
            }

        } catch (error) {
            console.error('❌ AppCore: ポインター押下処理エラー:', error);
            this.isDrawing = false;
        }
    }
    
    /**
     * ポインター移動ハンドラー（座標統合修正版・CanvasManager委譲）
     */
    handlePointerMove(event) {
        if (!this.isDrawing) return;
        
        // 🔧 CanvasManager統合: 描画処理はCanvasManagerに委譲
        if (this.canvasManager && typeof this.canvasManager.handlePointerMove === 'function') {
            this.canvasManager.handlePointerMove(event);
            return;
        }
        
        // フォールバック: 直接処理
        try {
            // 🔄 CoordinateManager経由での座標処理
            let coords;
            
            if (this.coordinateManager && this.coordinateManager.extractPointerCoordinates) {
                coords = this.coordinateManager.extractPointerCoordinates(
                    event, 
                    this.app.view.getBoundingClientRect(),
                    this.app
                );
            } else {
                // フォールバック処理
                const rect = this.app.view.getBoundingClientRect();
                coords = {
                    canvas: {
                        x: event.clientX - rect.left,
                        y: event.clientY - rect.top
                    },
                    pressure: event.pressure || 0.5
                };
            }
            
            if (coords) {
                // 座標表示更新
                this.updateCoordinateDisplay(coords.canvas);
                
                // ツール描画継続
                if (this.toolManager && typeof this.toolManager.continueDrawing === 'function') {
                    this.toolManager.continueDrawing(coords.canvas.x, coords.canvas.y, coords.pressure);
                }
            }
            
        } catch (error) {
            // ポインター移動エラーは頻繁に発生する可能性があるため、警告レベル
            console.warn('⚠️ ポインター移動処理エラー:', error.message);
        }
    }
    
    /**
     * ポインターアップハンドラー（修正版・CanvasManager委譲）
     */
    handlePointerUp(event) {
        try {
            if (!this.isDrawing || !this.toolManager) {
                return;
            }

            // ✅ 修正: メソッド存在確認とフォールバック
            if (typeof this.toolManager.finishDrawing === 'function') {
                this.toolManager.finishDrawing(event);
            } else if (typeof this.toolManager.onPointerUp === 'function') {
                this.toolManager.onPointerUp(event);
            } else if (typeof this.toolManager.delegateToActiveTool === 'function') {
                this.toolManager.delegateToActiveTool('onPointerUp', event);
            } else {
                console.error('❌ AppCore: ToolManager に描画終了メソッドが見つかりません');
            }

            this.isDrawing = false;

            // イベント発火
            if (window.EventBus && typeof window.EventBus.emit === 'function') {
                window.EventBus.emit('drawing.ended', {
                    timestamp: Date.now()
                });
            }

        } catch (error) {
            console.error('❌ AppCore: ポインター離脱処理エラー:', error);
            this.isDrawing = false;
        }
    }
    
    /**
     * 座標表示更新（修正版）
     */
    updateCoordinateDisplay(canvasCoords) {
        try {
            const coordinatesElement = document.getElementById('coordinates');
            if (coordinatesElement) {
                coordinatesElement.textContent = `x: ${Math.round(canvasCoords.x)}, y: ${Math.round(canvasCoords.y)}`;
            }
        } catch (error) {
            // 座標表示エラーは致命的ではないため、ログのみ
            console.warn('⚠️ 座標表示更新エラー:', error.message);
        }
    }
    
    /**
     * リサイズハンドラー（座標統合修正版・CanvasManager委譲）
     */
    handleResize() {
        if (!this.app) return;
        
        console.log('🔄 ウィンドウリサイズ検出');
        
        // 🔧 CanvasManager統合: リサイズ処理はCanvasManagerに委譲
        if (this.canvasManager && typeof this.canvasManager.resize === 'function') {
            this.canvasManager.resize(this.canvasWidth, this.canvasHeight);
        }
        
        // 🔄 CoordinateManagerにリサイズ通知
        if (this.coordinateManager && typeof this.coordinateManager.updateCanvasSize === 'function') {
            this.coordinateManager.updateCanvasSize(this.canvasWidth, this.canvasHeight);
        }
        
        if (window.EventBus && typeof window.EventBus.emit === 'function') {
            window.EventBus.emit('window.resized', {
                width: this.canvasWidth,
                height: this.canvasHeight,
                coordinateManagerUpdated: !!this.coordinateManager,
                canvasManagerUpdated: !!this.canvasManager,
                timestamp: Date.now()
            });
        }
    }
    
    /**
     * ツール変更ハンドラー（修正版）
     */
    handleToolChanged(data) {
        console.log(`🔧 ツール変更: ${data.previousTool || '不明'} → ${data.tool || '不明'}`);
    }
    
    /**
     * 初期化完了処理（座標統合修正版・CanvasManager対応）
     */
    completeInitialization() {
        this.isInitializing = false;
        this.initializationComplete = true;
        
        if (window.EventBus && typeof window.EventBus.emit === 'function') {
            window.EventBus.emit('appCore.initialized', {
                success: true,
                components: this.getInitializationStats(),
                coordinateManagerIntegrated: !!this.coordinateManager,
                canvasManagerIntegrated: !!this.canvasManager,
                timestamp: Date.now()
            });
        }
        
        console.log('✅ AppCore 初期化完了（座標統合完全修正版・Manager初期化統一版）');
        
        // 🆕 座標統合診断の自動実行
        if (typeof window.checkCoordinateIntegration === 'function') {
            setTimeout(() => {
                console.log('🔍 座標統合自動診断実行中...');
                window.checkCoordinateIntegration();
            }, 1000);
        }
    }
    
    /**
     * 初期化エラー処理（修正版）
     */
    async handleInitializationError(error) {
        console.error('💀 AppCore初期化エラー:', error);
        
        this.initializationFailed = true;
        this.isInitializing = false;
        
        if (window.ErrorManager && typeof window.ErrorManager.showError === 'function') {
            window.ErrorManager.showError('error', error.message, {
                additionalInfo: 'AppCore初期化失敗',
                showReload: true
            });
        }
        
        // フォールバックモード試行
        await this.initializeFallbackMode(error);
    }
    
    /**
     * 初期化検証（座標統合修正版・CanvasManager対応）
     */
    verifyInitialization() {
        const verification = {
            pixiApp: !!this.app,
            drawingContainer: !!this.drawingContainer,
            coordinateManager: !!this.coordinateManager,
            canvasManager: !!this.canvasManager,
            toolManager: !!this.toolManager,
            boundaryManager: !!this.boundaryManager,
            uiManager: !!this.uiManager
        };
        
        const passCount = Object.values(verification).filter(Boolean).length;
        const totalCount = Object.keys(verification).length;
        
        console.log(`✅ 初期化検証: ${passCount}/${totalCount} (${(passCount/totalCount*100).toFixed(1)}%)`);
        
        // 座標統合確認
        if (this.coordinateManager) {
            const integrationStatus = this.coordinateManager.getIntegrationStatus && 
                                      this.coordinateManager.getIntegrationStatus() || {};
            console.log('🔄 座標統合状態:', {
                enabled: integrationStatus.managerCentralization,
                duplicateElimination: integrationStatus.duplicateElimination,
                performanceOptimized: integrationStatus.performanceOptimized
            });
        }
        
        // CanvasManager統合確認
        if (this.canvasManager && this.canvasManager.getCoordinateIntegrationState) {
            const canvasIntegrationState = this.canvasManager.getCoordinateIntegrationState();
            console.log('🎨 CanvasManager座標統合状態:', {
                coordinateManagerAvailable: canvasIntegrationState.coordinateManagerAvailable,
                integrationEnabled: canvasIntegrationState.integrationEnabled,
                duplicateElimination: canvasIntegrationState.duplicateElimination
            });
        }
        
        if (passCount < 3) { // 最低限PixiJS, DrawingContainer, 1つのManagerがあれば動作可能
            const failed = Object.entries(verification)
                .filter(([key, value]) => !value)
                .map(([key]) => key);
            
            if (window.ErrorManager && typeof window.ErrorManager.showError === 'function') {
                window.ErrorManager.showError('warning', `初期化未完了: ${failed.join(', ')}`);
            }
        }
    }
    
    /**
     * 初期化統計取得（座標統合修正版・CanvasManager対応）
     */
    getInitializationStats() {
        const stats = {
            pixiApp: !!this.app,
            drawingContainer: !!this.drawingContainer,
            coordinateManager: !!this.coordinateManager,
            canvasManager: !!this.canvasManager,
            toolManager: !!this.toolManager,
            boundaryManager: !!this.boundaryManager,
            uiManager: !!this.uiManager,
            initializationComplete: this.initializationComplete,
            initializationFailed: this.initializationFailed
        };
        
        // 座標統合状態を追加
        if (this.coordinateManager && this.coordinateManager.getIntegrationStatus) {
            const integrationStatus = this.coordinateManager.getIntegrationStatus();
            stats.coordinateIntegration = {
                enabled: integrationStatus.managerCentralization,
                duplicateElimination: integrationStatus.duplicateElimination,
                performanceOptimized: integrationStatus.performanceOptimized
            };
        }
        
        // CanvasManager統合状態を追加
        if (this.canvasManager && this.canvasManager.getCoordinateIntegrationState) {
            const canvasIntegrationState = this.canvasManager.getCoordinateIntegrationState();
            stats.canvasManagerIntegration = {
                coordinateManagerAvailable: canvasIntegrationState.coordinateManagerAvailable,
                integrationEnabled: canvasIntegrationState.integrationEnabled,
                duplicateElimination: canvasIntegrationState.duplicateElimination
            };
        }
        
        return stats;
    }
    
    /**
     * フォールバックモード初期化（修正版）
     */
    async initializeFallbackMode(originalError) {
        console.log('🛡️ フォールバックモード初期化中...');
        
        try {
            // 最低限のPixiJSアプリケーション作成
            if (!this.app) {
                const fallbackConfig = {
                    width: window.ConfigManager?.get('canvas.width') || 400,
                    height: window.ConfigManager?.get('canvas.height') || 400,
                    backgroundColor: window.ConfigManager?.get('canvas.backgroundColor') || 0xf0e0d6
                };
                
                this.app = new PIXI.Application(fallbackConfig);
                const canvasElement = document.getElementById('drawing-canvas');
                if (canvasElement) {
                    canvasElement.appendChild(this.app.view);
                }
            }
            
            // 最低限のコンテナ作成
            if (!this.drawingContainer) {
                this.initializeContainers();
            }
            
            if (window.ErrorManager && typeof window.ErrorManager.showError === 'function') {
                window.ErrorManager.showError('recovery', '基本描画機能は利用可能です', {
                    additionalInfo: 'フォールバックモードで動作中'
                });
            }
            
            console.log('✅ フォールバックモード初期化完了');
            
        } catch (fallbackError) {
            console.error('💀 フォールバックモード初期化失敗:', fallbackError);
            if (window.ErrorManager && typeof window.ErrorManager.showCriticalError === 'function') {
                window.ErrorManager.showCriticalError(originalError.message, {
                    additionalInfo: `フォールバック失敗: ${fallbackError.message}`
                });
            }
        }
    }
    
    /**
     * キャンバスリサイズ（座標統合修正版・CanvasManager委譲）
     */
    resize(newWidth, newHeight, centerContent = false) {
        if (!this.app) {
            console.warn('⚠️ PixiJSアプリが初期化されていません');
            return;
        }
        
        try {
            // 🔧 CanvasManager統合: リサイズ処理はCanvasManagerに委譲
            if (this.canvasManager && typeof this.canvasManager.resize === 'function') {
                const success = this.canvasManager.resize(newWidth, newHeight, centerContent);
                if (success) {
                    // AppCore内部サイズも更新
                    this.canvasWidth = newWidth;
                    this.canvasHeight = newHeight;
                    console.log(`📐 キャンバスリサイズ（CanvasManager委譲）: ${newWidth}x${newHeight}`);
                }
                return success;
            }
            
            // フォールバック: 直接処理
            const oldWidth = this.canvasWidth;
            const oldHeight = this.canvasHeight;
            
            // ConfigManager経由での妥当性確認
            const canvasConfig = window.ConfigManager.getCanvasConfig();
            const validWidth = Math.max(canvasConfig.minWidth || 100, Math.min(canvasConfig.maxWidth || 2000, newWidth));
            const validHeight = Math.max(canvasConfig.minHeight || 100, Math.min(canvasConfig.maxHeight || 2000, newHeight));
            
            this.canvasWidth = validWidth;
            this.canvasHeight = validHeight;
            
            // 🔄 CoordinateManager更新
            if (this.coordinateManager && typeof this.coordinateManager.updateCanvasSize === 'function') {
                this.coordinateManager.updateCanvasSize(validWidth, validHeight);
            }
            
            // アプリケーションリサイズ
            this.app.renderer.resize(validWidth, validHeight);
            this.app.stage.hitArea = new PIXI.Rectangle(0, 0, validWidth, validHeight);
            
            // 境界管理システム更新
            if (this.boundaryManager && typeof this.boundaryManager.updateCanvasSize === 'function') {
                this.boundaryManager.updateCanvasSize();
            }
            
            if (window.EventBus && typeof window.EventBus.emit === 'function') {
                window.EventBus.emit('canvas.resized', {
                    width: validWidth,
                    height: validHeight,
                    previousWidth: oldWidth,
                    previousHeight: oldHeight,
                    coordinateManagerUpdated: !!this.coordinateManager,
                    canvasManagerUsed: false,
                    timestamp: Date.now()
                });
            }
            
            console.log(`📐 キャンバスリサイズ（座標統合版・フォールバック）: ${validWidth}x${validHeight}`);
            
        } catch (error) {
            if (window.ErrorManager && typeof window.ErrorManager.showError === 'function') {
                window.ErrorManager.showError('error', 
                    `キャンバスリサイズエラー: ${error.message}`, 
                    { additionalInfo: 'キャンバスリサイズ', newWidth, newHeight }
                );
            }
        }
    }
    
    /**
     * 🆕 座標統合状態取得（外部アクセス用・CanvasManager対応）
     */
    getCoordinateIntegrationState() {
        return {
            coordinateManagerAvailable: !!this.coordinateManager,
            boundaryManagerIntegrated: !!(this.boundaryManager && this.boundaryManager.coordinateManager),
            toolManagerIntegrated: !!(this.toolManager && this.toolManager.coordinateManager),
            canvasManagerIntegrated: !!(this.canvasManager && this.canvasManager.coordinateManager),
            coordinateManagerState: this.coordinateManager ? 
                (this.coordinateManager.getCoordinateState ? this.coordinateManager.getCoordinateState() : 'available') : null,
            canvasManagerState: this.canvasManager ?
                (this.canvasManager.getCoordinateIntegrationState ? this.canvasManager.getCoordinateIntegrationState() : 'available') : null,
            appCoreState: this.getInitializationStats(),
            phase2Ready: !!(this.coordinateManager && 
                           this.boundaryManager?.coordinateManager && 
                           this.toolManager?.coordinateManager &&
                           this.canvasManager?.coordinateManager)
        };
    }
    
    /**
     * システム破棄（座標統合修正版・CanvasManager対応）
     */
    dispose() {
        try {
            // CanvasManager破棄
            if (this.canvasManager && typeof this.canvasManager.dispose === 'function') {
                this.canvasManager.dispose();
                this.canvasManager = null;
            }
            
            // 境界管理システム破棄
            if (this.boundaryManager && typeof this.boundaryManager.dispose === 'function') {
                this.boundaryManager.dispose();
                this.boundaryManager = null;
            }
            
            // ツールマネージャー破棄
            if (this.toolManager && typeof this.toolManager.dispose === 'function') {
                this.toolManager.dispose();
                this.toolManager = null;
            }
            
            // UIマネージャー破棄
            if (this.uiManager && typeof this.uiManager.dispose === 'function') {
                this.uiManager.dispose();
                this.uiManager = null;
            }
            
            // CoordinateManager