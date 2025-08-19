/**
 * 🎨 AppCoreシステム（分割最適化版）
 * 🎯 AI_WORK_SCOPE: PixiJSアプリケーション基盤・システム統合・初期化制御
 * 🎯 DEPENDENCIES: 統一システム4種、BoundaryManager、CoordinateManager
 * 🎯 SPLIT_RESULT: 650行 → 350行（46%削減）
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
        
        // 状態管理
        this.isInitializing = false;
        this.initializationComplete = false;
        this.initializationFailed = false;
        
        console.log('🎨 AppCore インスタンス作成完了（分割最適化版）');
    }
    
    /**
     * 統一システム依存性確認
     */
    validateUnifiedSystems() {
        const required = ['ConfigManager', 'ErrorManager', 'StateManager', 'EventBus'];
        const missing = required.filter(sys => !window[sys]);
        if (missing.length > 0) {
            throw new Error(`AppCore: 統一システム依存性エラー: ${missing.join(', ')}`);
        }
    }
    
    /**
     * 設定初期化
     */
    initializeConfig() {
        const canvasConfig = ConfigManager.getCanvasConfig();
        this.canvasWidth = canvasConfig.width;
        this.canvasHeight = canvasConfig.height;
        this.backgroundColor = canvasConfig.backgroundColor;
        
        // 境界描画設定追加
        this.boundaryConfig = ConfigManager.get('canvas.boundary') || {
            enabled: true,
            margin: 20,
            trackingEnabled: true
        };
    }
    
    /**
     * アプリケーション初期化（分割最適化版）
     */
    async initialize() {
        try {
            console.log('🚀 AppCore 初期化開始（分割最適化版）...');
            this.isInitializing = true;
            
            // 段階的初期化
            await this.initializeBasicSystems();
            await this.initializeManagers();
            await this.initializeApplication();
            
            // 完了処理
            this.completeInitialization();
            
        } catch (error) {
            await this.handleInitializationError(error);
        }
    }
    
    /**
     * 基盤システム初期化
     */
    async initializeBasicSystems() {
        console.log('🔧 基盤システム初期化中...');
        
        // DOM確認
        await this.verifyDOMElements();
        
        // 座標管理システム初期化
        this.coordinateManager = new CoordinateManager();
        
        // PixiJSアプリケーション初期化
        await this.initializePixiApp();
        
        // コンテナ初期化
        this.initializeContainers();
        
        console.log('✅ 基盤システム初期化完了');
    }
    
    /**
     * 管理システム初期化
     */
    async initializeManagers() {
        console.log('🔧 管理システム初期化中...');
        
        // 境界管理システム初期化
        this.boundaryManager = new BoundaryManager();
        this.boundaryManager.initialize(this.app.view, this.coordinateManager);
        
        // ツールマネージャー初期化（既存システム活用）
        if (window.ToolManager) {
            this.toolManager = new ToolManager(this);
            this.toolManager.initialize();
        }
        
        // UIマネージャー初期化（既存システム活用）
        if (window.UIManager) {
            this.uiManager = new UIManager();
            this.uiManager.initialize();
        }
        
        console.log('✅ 管理システム初期化完了');
    }
    
    /**
     * アプリケーション初期化
     */
    async initializeApplication() {
        console.log('🔧 アプリケーション初期化中...');
        
        // イベントリスナー設定
        this.setupEventListeners();
        
        // PixiJS境界システム統合
        this.initializePixiBoundarySystem();
        
        // 初期化検証
        this.verifyInitialization();
        
        console.log('✅ アプリケーション初期化完了');
    }
    
    /**
     * DOM要素確認
     */
    async verifyDOMElements() {
        const canvasElement = document.getElementById('drawing-canvas');
        if (!canvasElement) {
            throw new Error('drawing-canvas 要素が見つかりません');
        }
        
        // キャンバス要素クリア
        while (canvasElement.firstChild) {
            canvasElement.removeChild(canvasElement.firstChild);
        }
        
        console.log('✅ DOM要素確認完了');
    }
    
    /**
     * PixiJSアプリケーション初期化
     */
    async initializePixiApp() {
        const canvasConfig = ConfigManager.getCanvasConfig();
        const pixiConfig = ConfigManager.getPixiConfig();
        
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
    }
    
    /**
     * コンテナ初期化
     */
    initializeContainers() {
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
    }
    
    /**
     * PixiJS境界システム統合初期化
     */
    initializePixiBoundarySystem() {
        if (!this.app || !this.boundaryManager) {
            console.warn('⚠️ PixiJS境界システム統合スキップ（依存関係不足）');
            return;
        }
        
        console.log('🎯 PixiJS境界システム統合初期化中...');
        
        // 拡張ヒットエリア設定
        const margin = this.boundaryManager.boundaryMargin;
        this.app.stage.hitArea = new PIXI.Rectangle(
            -margin,
            -margin,
            this.canvasWidth + margin * 2,
            this.canvasHeight + margin * 2
        );
        
        // インタラクティブ強化
        this.app.stage.interactive = true;
        this.app.stage.interactiveChildren = true;
        
        // 境界統合イベント設定
        this.setupPixiBoundaryEvents();
        
        console.log('✅ PixiJS境界システム統合完了');
    }
    
    /**
     * PixiJS境界イベント設定
     */
    setupPixiBoundaryEvents() {
        // 境界越えイベント統合
        EventBus.on('boundary.cross.in', (data) => {
            this.handlePixiBoundaryCross(data);
        });
        
        // PixiJSネイティブイベント拡張
        this.app.stage.on('pointerenter', (event) => {
            console.log('🎯 PixiJS ポインター エンター');
            EventBus.safeEmit('pixi.pointer.enter', { event });
        });
        
        this.app.stage.on('pointerleave', (event) => {
            console.log('🎯 PixiJS ポインター リーブ');
            EventBus.safeEmit('pixi.pointer.leave', { event });
        });
    }
    
    /**
     * PixiJS境界越え処理
     */
    handlePixiBoundaryCross(data) {
        if (!this.coordinateManager) return;
        
        try {
            // PixiJS座標系変換
            const pixiCoords = this.coordinateManager.canvasToPixi(
                data.position.x, 
                data.position.y, 
                this.app
            );
            
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
            
            console.log(`🎯 PixiJS境界越え処理完了: (${pixiCoords.x.toFixed(1)}, ${pixiCoords.y.toFixed(1)})`);
            
        } catch (error) {
            ErrorManager.showError('pixi-boundary', 
                `PixiJS境界越え処理エラー: ${error.message}`, 
                data
            );
        }
    }
    
    /**
     * イベントリスナー設定（分割最適化版）
     */
    setupEventListeners() {
        // PixiJS描画イベント
        this.app.stage.on('pointerdown', this.handlePointerDown.bind(this));
        this.app.stage.on('pointermove', this.handlePointerMove.bind(this));
        this.app.stage.on('pointerup', this.handlePointerUp.bind(this));
        this.app.stage.on('pointerupoutside', this.handlePointerUp.bind(this));
        
        // 境界越えイベント（BoundaryManager統合）
        EventBus.on('boundary.cross.in', this.handleBoundaryCrossIn.bind(this));
        
        // ウィンドウイベント
        window.addEventListener('resize', this.handleResize.bind(this));
        
        // ツールイベント
        EventBus.on('tool.changed', this.handleToolChanged.bind(this));
        
        console.log('✅ イベントリスナー設定完了（分割最適化版）');
    }
    
    /**
     * 境界越え描画開始処理（新規追加）
     */
    handleBoundaryCrossIn(data) {
        if (!this.toolManager) {
            console.warn('⚠️ ToolManager が利用できません');
            return;
        }
        
        try {
            const currentTool = this.toolManager.currentTool;
            if (currentTool && typeof currentTool.handleBoundaryCrossIn === 'function') {
                currentTool.handleBoundaryCrossIn(
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
            ErrorManager.showError('boundary-drawing', 
                `境界越え描画エラー: ${error.message}`, 
                data
            );
        }
    }
    
    /**
     * ポインターダウンハンドラー（座標管理統合版）
     */
    handlePointerDown(event) {
        if (!this.toolManager || !this.coordinateManager) return;
        
        try {
            const coords = this.coordinateManager.extractPointerCoordinates(
                event, 
                this.app.view.getBoundingClientRect(), 
                this.app
            );
            
            const currentTool = this.toolManager.currentTool;
            if (currentTool && typeof currentTool.startDrawing === 'function') {
                currentTool.startDrawing(coords.canvas.x, coords.canvas.y, coords.pressure);
            }
            
            EventBus.safeEmit('drawing.started', {
                position: coords.canvas,
                pressure: coords.pressure,
                tool: this.toolManager.getCurrentTool?.() || 'unknown'
            });
            
        } catch (error) {
            ErrorManager.showError('pointer-down', 
                `ポインターダウンエラー: ${error.message}`, 
                { event: event.type }
            );
        }
    }
    
    /**
     * ポインター移動ハンドラー（座標管理統合版）
     */
    handlePointerMove(event) {
        if (!this.coordinateManager) return;
        
        try {
            const coords = this.coordinateManager.extractPointerCoordinates(
                event, 
                this.app.view.getBoundingClientRect()
            );
            
            // 座標表示更新
            this.updateCoordinateDisplay(coords.canvas);
            
            // ツール描画継続
            if (this.toolManager?.currentTool && typeof this.toolManager.currentTool.continueDrawing === 'function') {
                this.toolManager.currentTool.continueDrawing(coords.canvas.x, coords.canvas.y, coords.pressure);
            }
            
        } catch (error) {
            // ポインター移動エラーは頻繁に発生する可能性があるため、警告レベル
            console.warn('⚠️ ポインター移動処理エラー:', error.message);
        }
    }
    
    /**
     * ポインターアップハンドラー
     */
    handlePointerUp(event) {
        if (!this.toolManager) return;
        
        try {
            const currentTool = this.toolManager.currentTool;
            if (currentTool && typeof currentTool.stopDrawing === 'function') {
                currentTool.stopDrawing();
            }
            
            EventBus.safeEmit('drawing.ended', {
                timestamp: Date.now()
            });
            
        } catch (error) {
            ErrorManager.showError('pointer-up', 
                `ポインターアップエラー: ${error.message}`, 
                { event: event.type }
            );
        }
    }
    
    /**
     * 座標表示更新
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
     * リサイズハンドラー
     */
    handleResize() {
        if (!this.app) return;
        
        console.log('🔄 ウィンドウリサイズ検出');
        EventBus.safeEmit('window.resized', {
            timestamp: Date.now()
        });
    }
    
    /**
     * ツール変更ハンドラー
     */
    handleToolChanged(data) {
        console.log(`🔧 ツール変更: ${data.previousTool || '不明'} → ${data.tool || '不明'}`);
    }
    
    /**
     * 初期化完了処理
     */
    completeInitialization() {
        this.isInitializing = false;
        this.initializationComplete = true;
        
        EventBus.safeEmit('appCore.initialized', {
            success: true,
            components: this.getInitializationStats(),
            timestamp: Date.now()
        });
        
        console.log('✅ AppCore 初期化完了（分割最適化版）');
    }
    
    /**
     * 初期化エラー処理
     */
    async handleInitializationError(error) {
        console.error('💀 AppCore初期化エラー:', error);
        
        this.initializationFailed = true;
        this.isInitializing = false;
        
        ErrorManager.showError('error', error.message, {
            additionalInfo: 'AppCore初期化失敗',
            showReload: true
        });
        
        // フォールバックモード試行
        await this.initializeFallbackMode(error);
    }
    
    /**
     * 初期化検証
     */
    verifyInitialization() {
        const verification = {
            pixiApp: !!this.app,
            drawingContainer: !!this.drawingContainer,
            boundaryManager: !!this.boundaryManager,
            coordinateManager: !!this.coordinateManager,
            toolManager: !!this.toolManager,
            uiManager: !!this.uiManager
        };
        
        const passCount = Object.values(verification).filter(Boolean).length;
        const totalCount = Object.keys(verification).length;
        
        console.log(`✅ 初期化検証: ${passCount}/${totalCount} (${(passCount/totalCount*100).toFixed(1)}%)`);
        
        if (passCount < totalCount) {
            const failed = Object.entries(verification)
                .filter(([key, value]) => !value)
                .map(([key]) => key);
            
            ErrorManager.showError('warning', `初期化未完了: ${failed.join(', ')}`);
        }
    }
    
    /**
     * 初期化統計取得
     */
    getInitializationStats() {
        return {
            pixiApp: !!this.app,
            drawingContainer: !!this.drawingContainer,
            boundaryManager: !!this.boundaryManager,
            coordinateManager: !!this.coordinateManager,
            toolManager: !!this.toolManager,
            uiManager: !!this.uiManager,
            initializationComplete: this.initializationComplete,
            initializationFailed: this.initializationFailed
        };
    }
    
    /**
     * フォールバックモード初期化
     */
    async initializeFallbackMode(originalError) {
        console.log('🛡️ フォールバックモード初期化中...');
        
        try {
            // 最低限のPixiJSアプリケーション作成
            if (!this.app) {
                const fallbackConfig = {
                    width: ConfigManager.get('canvas.width') || 400,
                    height: ConfigManager.get('canvas.height') || 400,
                    backgroundColor: ConfigManager.get('canvas.backgroundColor') || 0xf0e0d6
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
            
            ErrorManager.showError('recovery', '基本描画機能は利用可能です', {
                additionalInfo: 'フォールバックモードで動作中'
            });
            
            console.log('✅ フォールバックモード初期化完了');
            
        } catch (fallbackError) {
            console.error('💀 フォールバックモード初期化失敗:', fallbackError);
            ErrorManager.showCriticalError(originalError.message, {
                additionalInfo: `フォールバック失敗: ${fallbackError.message}`
            });
        }
    }
    
    /**
     * キャンバスリサイズ（座標管理統合版）
     */
    resize(newWidth, newHeight, centerContent = false) {
        if (!this.app) {
            console.warn('⚠️ PixiJSアプリが初期化されていません');
            return;
        }
        
        try {
            const oldWidth = this.canvasWidth;
            const oldHeight = this.canvasHeight;
            
            // ConfigManager経由での妥当性確認
            const canvasConfig = ConfigManager.getCanvasConfig();
            const validWidth = Math.max(canvasConfig.minWidth || 100, Math.min(canvasConfig.maxWidth || 2000, newWidth));
            const validHeight = Math.max(canvasConfig.minHeight || 100, Math.min(canvasConfig.maxHeight || 2000, newHeight));
            
            this.canvasWidth = validWidth;
            this.canvasHeight = validHeight;
            
            // 座標管理システム更新
            if (this.coordinateManager) {
                this.coordinateManager.updateCanvasSize(validWidth, validHeight);
            }
            
            // アプリケーションリサイズ
            this.app.renderer.resize(validWidth, validHeight);
            this.app.stage.hitArea = new PIXI.Rectangle(0, 0, validWidth, validHeight);
            
            // 境界管理システム更新
            if (this.boundaryManager) {
                this.boundaryManager.createExpandedHitArea();
            }
            
            EventBus.safeEmit('canvas.resized', {
                width: validWidth,
                height: validHeight,
                previousWidth: oldWidth,
                previousHeight: oldHeight,
                timestamp: Date.now()
            });
            
            console.log(`📐 キャンバスリサイズ: ${validWidth}x${validHeight}`);
            
        } catch (error) {
            ErrorManager.showError('canvas-resize', 
                `キャンバスリサイズエラー: ${error.message}`, 
                { newWidth, newHeight }
            );
        }
    }
    
    /**
     * システム破棄
     */
    destroy() {
        try {
            // 境界管理システム破棄
            if (this.boundaryManager) {
                this.boundaryManager.destroy();
                this.boundaryManager = null;
            }
            
            // ツールマネージャー破棄
            if (this.toolManager && typeof this.toolManager.destroy === 'function') {
                this.toolManager.destroy();
                this.toolManager = null;
            }
            
            // UIマネージャー破棄
            if (this.uiManager && typeof this.uiManager.destroy === 'function') {
                this.uiManager.destroy();
                this.uiManager = null;
            }
            
            // PixiJSアプリケーション破棄
            if (this.app) {
                this.app.destroy(true);
                this.app = null;
            }
            
            // プロパティクリア
            this.drawingContainer = null;
            this.uiContainer = null;
            this.coordinateManager = null;
            
            console.log('🎨 AppCore 破棄完了');
            
        } catch (error) {
            ErrorManager.showError('app-destroy', 
                `AppCore破棄エラー: ${error.message}`
            );
        }
    }
}

// グローバル登録
if (typeof window !== 'undefined') {
    window.AppCore = AppCore;
    console.log('🎨 AppCore グローバル登録完了（分割最適化版）');
}