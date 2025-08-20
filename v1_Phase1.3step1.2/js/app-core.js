/**
 * 🎨 AppCoreシステム（キャンバス倍加問題修正完全版）
 * 🎯 AI_WORK_SCOPE: PixiJSアプリケーション基盤・システム統合・初期化制御
 * 🎯 DEPENDENCIES: 統一システム4種、BoundaryManager、CoordinateManager
 * 🚨 CANVAS_SIZE_FIX: キャンバス倍加問題の完全修正版
 * 🛠️ DPI_REMOVAL: devicePixelRatio使用除去・固定resolution=1・DPI補償処理削除
 */

// 🔧 DUPLICATE_FIX: 既存AppCore定義をチェックして重複を防ぐ
if (typeof window.AppCore !== 'undefined') {
    console.warn('⚠️ AppCore already defined - redefining...');
    delete window.AppCore;
}

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
        
        console.log('🎨 AppCore インスタンス作成完了（キャンバス倍加修正版）');
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
        
        // 統一システムへの参照を確立
        this.configManager = window.ConfigManager;
        this.errorManager = window.ErrorManager;
        this.stateManager = window.StateManager;
        this.eventBus = window.EventBus;
        
        console.log('✅ AppCore: 統一システム依存性確認完了');
    }
    
    /**
     * 設定初期化（統一システム参照使用版）
     */
    initializeConfig() {
        try {
            const canvasConfig = this.configManager.getCanvasConfig();
            this.canvasWidth = canvasConfig.width;
            this.canvasHeight = canvasConfig.height;
            this.backgroundColor = canvasConfig.backgroundColor;
            
            // 境界描画設定追加
            this.boundaryConfig = this.configManager.get('canvas.boundary') || {
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
     * アプリケーション初期化（修正版）
     */
    async initialize() {
        try {
            console.log('🚀 AppCore 初期化開始（キャンバス倍加修正版）...');
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
     * 基盤システム初期化（CoordinateManager初期化修正版）
     */
    async initializeBasicSystems() {
        console.log('🔧 基盤システム初期化中...');
        
        // DOM確認
        await this.verifyDOMElements();
        
        // PixiJSアプリケーション初期化（CoordinateManagerより先に）
        await this.initializePixiApp();
        
        // コンテナ初期化
        this.initializeContainers();
        
        // CoordinateManager初期化（PixiJS初期化後に実行）
        if (window.CoordinateManager) {
            try {
                // CoordinateManagerに必要な設定を事前に準備
                const coordinateConfig = this.configManager.getCoordinateConfig();
                const canvasConfig = this.configManager.getCanvasConfig();
                
                // CoordinateManagerクラスを直接インスタンス化（引数なし）
                this.coordinateManager = new window.CoordinateManager();
                
                console.log('✅ CoordinateManager初期化完了');
                
                // キャンバスサイズ設定（初期化後）
                if (typeof this.coordinateManager.updateCanvasSize === 'function') {
                    this.coordinateManager.updateCanvasSize(canvasConfig.width, canvasConfig.height);
                }
                
            } catch (error) {
                console.warn('⚠️ CoordinateManager初期化失敗（オプション）:', error.message);
                console.warn('⚠️ 詳細:', error);
                this.coordinateManager = null;
            }
        } else {
            console.warn('⚠️ CoordinateManager利用不可（オプション）');
        }
        
        console.log('✅ 基盤システム初期化完了');
    }
    
    /**
     * 管理システム初期化（BoundaryManager初期化修正版）
     */
    async initializeManagers() {
        console.log('🔧 管理システム初期化中...');
        
        // 境界管理システム初期化
        if (window.BoundaryManager) {
            try {
                // BoundaryManager初期化時の設定取得を修正
                this.boundaryManager = new window.BoundaryManager();
                
                // BoundaryManagerの初期化メソッドが存在する場合のみ呼び出し
                if (typeof this.boundaryManager.initialize === 'function') {
                    await this.boundaryManager.initialize(this.app.view, this.coordinateManager);
                } else if (typeof this.boundaryManager.init === 'function') {
                    await this.boundaryManager.init(this.app.view, this.coordinateManager);
                }
                
                console.log('✅ BoundaryManager初期化完了');
            } catch (error) {
                console.warn('⚠️ BoundaryManager初期化失敗（オプション）:', error.message);
                console.warn('⚠️ 詳細:', error);
                this.boundaryManager = null;
            }
        } else {
            console.warn('⚠️ BoundaryManager利用不可（オプション）');
        }
        
        // ツールマネージャー初期化（修正版）
        if (window.ToolManager) {
            try {
                this.toolManager = new window.ToolManager(this);
                
                // ToolManagerの初期化メソッド呼び出し
                if (typeof this.toolManager.initialize === 'function') {
                    await this.toolManager.initialize();
                } else if (typeof this.toolManager.init === 'function') {
                    await this.toolManager.init();
                }
                
                console.log('✅ ToolManager初期化完了');
            } catch (error) {
                console.warn('⚠️ ToolManager初期化失敗（オプション）:', error.message);
                this.toolManager = null;
            }
        } else {
            console.warn('⚠️ ToolManager利用不可（オプション）');
        }
        
        // UIマネージャー初期化（修正版 - init()メソッド使用）
        if (window.UIManager) {
            try {
                this.uiManager = new window.UIManager(this);
                
                // UIManagerの初期化メソッド呼び出し
                if (typeof this.uiManager.init === 'function') {
                    await this.uiManager.init();
                } else if (typeof this.uiManager.initialize === 'function') {
                    await this.uiManager.initialize();
                }
                
                console.log('✅ UIManager初期化完了');
            } catch (error) {
                console.warn('⚠️ UIManager初期化失敗（オプション）:', error.message);
                this.uiManager = null;
            }
        } else {
            console.warn('⚠️ UIManager利用不可（オプション）');
        }
        
        console.log('✅ 管理システム初期化完了');
    }
    
    /**
     * アプリケーション初期化（修正版）
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
     * DOM要素確認（修正版）
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
     * 🚨 修正版: PixiJSアプリケーション初期化（キャンバス倍加修正版）
     */
    async initializePixiApp() {
        try {
            const canvasConfig = this.configManager.getCanvasConfig();
            const pixiConfig = this.configManager.getPixiConfig();
            
            console.log('🚨 PixiJS初期化開始（キャンバス倍加修正版）', {
                targetSize: `${canvasConfig.width}×${canvasConfig.height}`,
                devicePixelRatio: window.devicePixelRatio || 1,
                resolution: 1
            });
            
            // 🚨 修正: PixiJS Application 作成（強制設定版）
            this.app = new PIXI.Application({
                width: canvasConfig.width,
                height: canvasConfig.height,
                backgroundColor: canvasConfig.backgroundColor,
                antialias: pixiConfig.antialias,
                resolution: 1,              // 🚨 強制固定
                autoDensity: false,         // 🚨 強制無効化
                powerPreference: 'default', // 🚨 追加: GPU設定
                hello: false                // 🚨 追加: PixiJSロゴ非表示
            });
            
            const canvasElement = document.getElementById('drawing-canvas');
            canvasElement.appendChild(this.app.view);
            
            // 🚨 最重要修正: キャンバス要素の強制サイズ設定
            const canvas = this.app.view;
            
            // Canvas要素の実際のサイズを強制設定
            canvas.width = canvasConfig.width;
            canvas.height = canvasConfig.height;
            
            // CSSスタイルも強制設定
            canvas.style.width = canvasConfig.width + 'px';
            canvas.style.height = canvasConfig.height + 'px';
            canvas.style.maxWidth = canvasConfig.width + 'px';
            canvas.style.maxHeight = canvasConfig.height + 'px';
            
            // 🚨 追加修正: すべての変換をリセット
            canvas.style.transform = 'none';
            canvas.style.transformOrigin = 'top left';
            canvas.style.zoom = '1';
            canvas.style.scale = '1';
            
            // 🚨 追加修正: レンダリング設定
            canvas.style.imageRendering = 'pixelated';
            canvas.style.cursor = pixiConfig.cursor || 'crosshair';
            canvas.style.touchAction = 'none';
            canvas.style.userSelect = 'none';
            canvas.style.display = 'block';
            canvas.style.boxSizing = 'content-box';
            
            // 🚨 CSS変数に実際のサイズを設定
            document.documentElement.style.setProperty('--canvas-width', canvasConfig.width + 'px');
            document.documentElement.style.setProperty('--canvas-height', canvasConfig.height + 'px');
            
            // 🚨 PixiJS内部設定の強制確認・修正
            if (this.app.renderer) {
                // レンダラーの解像度を強制設定
                this.app.renderer.resolution = 1;
                
                // レンダラーのサイズを強制設定
                this.app.renderer.resize(canvasConfig.width, canvasConfig.height);
                
                console.log('🚨 PixiJS レンダラー設定確認:', {
                    width: this.app.renderer.width,
                    height: this.app.renderer.height,
                    resolution: this.app.renderer.resolution,
                    autoResize: this.app.renderer.autoResize
                });
            }
            
            // 🚨 サイズ検証とデバッグ情報
            const actualRect = canvas.getBoundingClientRect();
            console.log('🚨 キャンバス実際のサイズ確認:', {
                canvas_width: canvas.width,
                canvas_height: canvas.height,
                style_width: canvas.style.width,
                style_height: canvas.style.height,
                client_width: canvas.clientWidth,
                client_height: canvas.clientHeight,
                bounding_rect: {
                    width: actualRect.width,
                    height: actualRect.height
                }
            });
            
            // 🚨 サイズ不一致の検出と警告
            if (Math.abs(actualRect.width - canvasConfig.width) > 1 || 
                Math.abs(actualRect.height - canvasConfig.height) > 1) {
                console.error('🚨 キャンバスサイズ不一致検出!', {
                    expected: `${canvasConfig.width}×${canvasConfig.height}`,
                    actual: `${actualRect.width}×${actualRect.height}`,
                    scale_factor: `${(actualRect.width / canvasConfig.width).toFixed(2)}×${(actualRect.height / canvasConfig.height).toFixed(2)}`
                });
                
                // 🚨 緊急再修正実行
                this.forceCanvasResize(canvasConfig.width, canvasConfig.height);
            }
            
            console.log('✅ PixiJSアプリケーション初期化完了（キャンバス倍加修正版）');
            console.log(`📐 キャンバス最終サイズ: ${canvasConfig.width}×${canvasConfig.height}px (resolution=1固定)`);
            
        } catch (error) {
            console.error('❌ PixiJSアプリケーション初期化失敗:', error);
            throw error;
        }
    }
    
    /**
     * 🚨 新規追加: 緊急キャンバスリサイズ
     */
    forceCanvasResize(targetWidth, targetHeight) {
        try {
            console.log('🚨 緊急キャンバスリサイズ実行中...', `${targetWidth}×${targetHeight}`);
            
            const canvas = this.app.view;
            
            // すべてのサイズ設定を強制実行
            canvas.width = targetWidth;
            canvas.height = targetHeight;
            canvas.style.width = targetWidth + 'px';
            canvas.style.height = targetHeight + 'px';
            canvas.style.maxWidth = targetWidth + 'px';
            canvas.style.maxHeight = targetHeight + 'px';
            canvas.style.minWidth = targetWidth + 'px';
            canvas.style.minHeight = targetHeight + 'px';
            
            // 変換系プロパティを再度強制リセット
            canvas.style.transform = 'none';
            canvas.style.webkitTransform = 'none';
            canvas.style.mozTransform = 'none';
            canvas.style.msTransform = 'none';
            canvas.style.oTransform = 'none';
            canvas.style.zoom = '1';
            canvas.style.scale = '1';
            
            // PixiJSレンダラーも再設定
            if (this.app.renderer) {
                this.app.renderer.resize(targetWidth, targetHeight);
                this.app.renderer.resolution = 1;
            }
            
            // 検証
            const newRect = canvas.getBoundingClientRect();
            console.log('🚨 緊急リサイズ後サイズ:', {
                width: newRect.width,
                height: newRect.height,
                success: Math.abs(newRect.width - targetWidth) <= 1 && Math.abs(newRect.height - targetHeight) <= 1
            });
            
        } catch (error) {
            console.error('❌ 緊急キャンバスリサイズ失敗:', error);
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
     * PixiJS境界システム統合初期化（修正版）
     */
    initializePixiBoundarySystem() {
        if (!this.app || !this.boundaryManager) {
            console.warn('⚠️ PixiJS境界システム統合スキップ（依存関係不足）');
            return;
        }
        
        try {
            console.log('🎯 PixiJS境界システム統合初期化中...');
            
            // 拡張ヒットエリア設定
            const margin = this.boundaryManager.boundaryMargin || 20;
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
            if (this.eventBus && typeof this.eventBus.on === 'function') {
                this.eventBus.on('boundary.cross.in', (data) => {
                    this.handlePixiBoundaryCross(data);
                });
            }
            
            // PixiJSネイティブイベント拡張
            this.app.stage.on('pointerenter', (event) => {
                console.log('🎯 PixiJS ポインター エンター');
                if (this.eventBus && typeof this.eventBus.emit === 'function') {
                    this.eventBus.emit('pixi.pointer.enter', { event });
                }
            });
            
            this.app.stage.on('pointerleave', (event) => {
                console.log('🎯 PixiJS ポインター リーブ');
                if (this.eventBus && typeof this.eventBus.emit === 'function') {
                    this.eventBus.emit('pixi.pointer.leave', { event });
                }
            });
            
        } catch (error) {
            console.warn('⚠️ PixiJS境界イベント設定で問題発生:', error.message);
        }
    }
    
    /**
     * PixiJS境界越え処理（修正版）
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
            if (this.errorManager && typeof this.errorManager.showError === 'function') {
                this.errorManager.showError('error', 
                    `PixiJS境界越え処理エラー: ${error.message}`, 
                    { additionalInfo: 'PixiJS境界処理', data }
                );
            }
        }
    }
    
    /**
     * イベントリスナー設定（修正版）
     */
    setupEventListeners() {
        try {
            // PixiJS描画イベント
            this.app.stage.on('pointerdown', this.handlePointerDown.bind(this));
            this.app.stage.on('pointermove', this.handlePointerMove.bind(this));
            this.app.stage.on('pointerup', this.handlePointerUp.bind(this));
            this.app.stage.on('pointerupoutside', this.handlePointerUp.bind(this));
            
            // 境界越えイベント（BoundaryManager統合）
            if (this.eventBus && typeof this.eventBus.on === 'function') {
                this.eventBus.on('boundary.cross.in', this.handleBoundaryCrossIn.bind(this));
            }
            
            // ウィンドウイベント
            window.addEventListener('resize', this.handleResize.bind(this));
            
            // ツールイベント
            if (this.eventBus && typeof this.eventBus.on === 'function') {
                this.eventBus.on('tool.changed', this.handleToolChanged.bind(this));
            }
            
            console.log('✅ イベントリスナー設定完了');
            
        } catch (error) {
            console.warn('⚠️ イベントリスナー設定で問題発生:', error.message);
        }
    }
    
    /**
     * 境界越え描画開始処理（修正版）
     */
    handleBoundaryCrossIn(data) {
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
            if (this.errorManager && typeof this.errorManager.showError === 'function') {
                this.errorManager.showError('warning', 
                    `境界越え描画エラー: ${error.message}`, 
                    { additionalInfo: '境界越え処理', data }
                );
            }
        }
    }
    
    /**
     * ポインターダウンハンドラー（ToolManager存在チェック強化版）
     */
    handlePointerDown(event) {
        if (!this.toolManager || !this.coordinateManager) {
            console.warn('⚠️ ToolManager または CoordinateManager が利用できません');
            return;
        }
        
        try {
            const coords = this.coordinateManager.extractPointerCoordinates(
                event, 
                this.app.view.getBoundingClientRect(), 
                this.app
            );
            
            // ToolManagerの描画開始メソッド呼び出し
            if (typeof this.toolManager.startDrawing === 'function') {
                this.toolManager.startDrawing(coords.canvas.x, coords.canvas.y, coords.pressure);
            } else {
                console.warn('⚠️ ToolManager.startDrawing メソッドが利用できません');
            }
            
            if (this.eventBus && typeof this.eventBus.emit === 'function') {
                this.eventBus.emit('drawing.started', {
                    position: coords.canvas,
                    pressure: coords.pressure,
                    tool: (typeof this.toolManager.getCurrentTool === 'function') ? 
                          this.toolManager.getCurrentTool() : 'unknown'
                });
            }
            
        } catch (error) {
            if (this.errorManager && typeof this.errorManager.showError === 'function') {
                this.errorManager.showError('warning', 
                    `ポインターダウンエラー: ${error.message}`, 
                    { additionalInfo: 'ポインター処理', event: event.type }
                );
            }
        }
    }
    
    /**
     * ポインター移動ハンドラー（修正版）
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
            if (this.toolManager && typeof this.toolManager.continueDrawing === 'function') {
                this.toolManager.continueDrawing(coords.canvas.x, coords.canvas.y, coords.pressure);
            }
            
        } catch (error) {
            // ポインター移動エラーは頻繁に発生する可能性があるため、警告レベル
            console.warn('⚠️ ポインター移動処理エラー:', error.message);
        }
    }
    
    /**
     * ポインターアップハンドラー（修正版）
     */
    handlePointerUp(event) {
        if (!this.toolManager) return;
        
        try {
            if (typeof this.toolManager.stopDrawing === 'function') {
                this.toolManager.stopDrawing();
            }
            
            if (this.eventBus && typeof this.eventBus.emit === 'function') {
                this.eventBus.emit('drawing.ended', {
                    timestamp: Date.now()
                });
            }
            
        } catch (error) {
            if (this.errorManager && typeof this.errorManager.showError === 'function') {
                this.errorManager.showError('warning', 
                    `ポインターアップエラー: ${error.message}`, 
                    { additionalInfo: 'ポインター処理', event: event.type }
                );
            }
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
     * リサイズハンドラー（修正版）
     */
    handleResize() {
        if (!this.app) return;
        
        console.log('🔄 ウィンドウリサイズ検出');
        if (this.eventBus && typeof this.eventBus.emit === 'function') {
            this.eventBus.emit('window.resized', {
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
     * 初期化完了処理（修正版）
     */
    completeInitialization() {
        this.isInitializing = false;
        this.initializationComplete = true;
        
        if (this.eventBus && typeof this.eventBus.emit === 'function') {
            this.eventBus.emit('appCore.initialized', {
                success: true,
                components: this.getInitializationStats(),
                timestamp: Date.now()
            });
        }
        
        console.log('✅ AppCore 初期化完了（キャンバス倍加修正版）');
    }
    
    /**
     * 初期化エラー処理（修正版）
     */
    async handleInitializationError(error) {
        console.error('💀 AppCore初期化エラー:', error);
        
        this.initializationFailed = true;
        this.isInitializing = false;
        
        if (this.errorManager && typeof this.errorManager.showError === 'function') {
            this.errorManager.showError('error', error.message, {
                additionalInfo: 'AppCore初期化失敗',
                showReload: true
            });
        }
        
        // フォールバックモード試行
        await this.initializeFallbackMode(error);
    }
    
    /**
     * 初期化検証（修正版）
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
        
        if (passCount < 3) { // 最低限PixiJS, DrawingContainer, 1つのManagerがあれば動作可能
            const failed = Object.entries(verification)
                .filter(([key, value]) => !value)
                .map(([key]) => key);
            
            if (this.errorManager && typeof this.errorManager.showError === 'function') {
                this.errorManager.showError('warning', `初期化未完了: ${failed.join(', ')}`);
            }
        }
    }
    
    /**
     * 初期化統計取得（修正版）
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
     * フォールバックモード初期化（キャンバス倍加修正版）
     */
    async initializeFallbackMode(originalError) {
        console.log('🛡️ フォールバックモード初期化中...');
        
        try {
            // 最低限のPixiJSアプリケーション作成
            if (!this.app) {
                const fallbackConfig = {
                    width: this.configManager?.get('canvas.width') || 400,
                    height: this.configManager?.get('canvas.height') || 400,
                    backgroundColor: this.configManager?.get('canvas.backgroundColor') || 0xf0e0d6,
                    resolution: 1, // フォールバックでも固定値1
                    autoDensity: false // フォールバックでもDPI自動調整無効
                };
                
                this.app = new PIXI.Application(fallbackConfig);
                const canvasElement = document.getElementById('drawing-canvas');
                if (canvasElement) {
                    canvasElement.appendChild(this.app.view);
                    
                    // フォールバックでもキャンバスサイズ強制設定
                    const canvas = this.app.view;
                    canvas.width = fallbackConfig.width;
                    canvas.height = fallbackConfig.height;
                    canvas.style.width = fallbackConfig.width + 'px';
                    canvas.style.height = fallbackConfig.height + 'px';
                    canvas.style.transform = 'none';
                    canvas.style.zoom = '1';
                }
            }
            
            // 最低限のコンテナ作成
            if (!this.drawingContainer) {
                this.initializeContainers();
            }
            
            if (this.errorManager && typeof this.errorManager.showError === 'function') {
                this.errorManager.showError('recovery', '基本描画機能は利用可能です', {
                    additionalInfo: 'フォールバックモードで動作中（キャンバス倍加修正版）'
                });
            }
            
            console.log('✅ フォールバックモード初期化完了（キャンバス倍加修正版）');
            
        } catch (fallbackError) {
            console.error('💀 フォールバックモード初期化失敗:', fallbackError);
            if (this.errorManager && typeof this.errorManager.showCriticalError === 'function') {
                this.errorManager.showCriticalError(originalError.message, {
                    additionalInfo: `フォールバック失敗: ${fallbackError.message}`
                });
            }
        }
    }
    
    /**
     * 🚨 修正版: キャンバスリサイズ（DPI考慮除去版・倍加修正版）
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
            const canvasConfig = this.configManager.getCanvasConfig();
            const validWidth = Math.max(canvasConfig.minWidth || 100, Math.min(canvasConfig.maxWidth || 2000, newWidth));
            const validHeight = Math.max(canvasConfig.minHeight || 100, Math.min(canvasConfig.maxHeight || 2000, newHeight));
            
            this.canvasWidth = validWidth;
            this.canvasHeight = validHeight;
            
            // 座標管理システム更新
            if (this.coordinateManager && typeof this.coordinateManager.updateCanvasSize === 'function') {
                this.coordinateManager.updateCanvasSize(validWidth, validHeight);
            }
            
            // 🚨 修正: アプリケーションリサイズ（キャンバス倍加修正版）
            this.app.renderer.resize(validWidth, validHeight);
            this.app.stage.hitArea = new PIXI.Rectangle(0, 0, validWidth, validHeight);
            
            // 🚨 追加: キャンバス要素の強制サイズ再設定
            const canvas = this.app.view;
            canvas.width = validWidth;
            canvas.height = validHeight;
            canvas.style.width = validWidth + 'px';
            canvas.style.height = validHeight + 'px';
            canvas.style.maxWidth = validWidth + 'px';
            canvas.style.maxHeight = validHeight + 'px';
            canvas.style.transform = 'none';
            canvas.style.zoom = '1';
            
            // CSS変数更新
            document.documentElement.style.setProperty('--canvas-width', validWidth + 'px');
            document.documentElement.style.setProperty('--canvas-height', validHeight + 'px');
            
            // 境界管理システム更新
            if (this.boundaryManager && typeof this.boundaryManager.createExpandedHitArea === 'function') {
                this.boundaryManager.createExpandedHitArea();
            }
            
            if (this.eventBus && typeof this.eventBus.emit === 'function') {
                this.eventBus.emit('canvas.resized', {
                    width: validWidth,
                    height: validHeight,
                    previousWidth: oldWidth,
                    previousHeight: oldHeight,
                    timestamp: Date.now()
                });
            }
            
            console.log(`📐 キャンバスリサイズ: ${validWidth}x${validHeight} (resolution=1固定・倍加修正済み)`);
            
            // 🚨 リサイズ後のサイズ検証
            const newRect = canvas.getBoundingClientRect();
            if (Math.abs(newRect.width - validWidth) > 1 || Math.abs(newRect.height - validHeight) > 1) {
                console.warn('🚨 リサイズ後もサイズ不一致:', {
                    expected: `${validWidth}×${validHeight}`,
                    actual: `${newRect.width}×${newRect.height}`
                });
                // 再度強制修正
                this.forceCanvasResize(validWidth, validHeight);
            }
            
        } catch (error) {
            if (this.errorManager && typeof this.errorManager.showError === 'function') {
                this.errorManager.showError('error', 
                    `キャンバスリサイズエラー: ${error.message}`, 
                    { additionalInfo: 'キャンバスリサイズ', newWidth, newHeight }
                );
            }
        }
    }
    
    /**
     * システム破棄（修正版）
     */
    destroy() {
        try {
            // 境界管理システム破棄
            if (this.boundaryManager && typeof this.boundaryManager.destroy === 'function') {
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
            if (this.errorManager && typeof this.errorManager.showError === 'function') {
                this.errorManager.showError('warning', 
                    `AppCore破棄エラー: ${error.message}`,
                    { additionalInfo: 'AppCore破棄処理' }
                );
            }
        }
    }
    
    /**
     * 🚨 新規追加: キャンバスサイズ診断
     */
    diagnoseCanvasSize() {
        if (!this.app || !this.app.view) {
            console.log('❌ PixiJSアプリが初期化されていません');
            return null;
        }
        
        const canvas = this.app.view;
        const rect = canvas.getBoundingClientRect();
        const canvasConfig = this.configManager.getCanvasConfig();
        
        const diagnosis = {
            expected: {
                width: canvasConfig.width,
                height: canvasConfig.height
            },
            canvas_element: {
                width: canvas.width,
                height: canvas.height
            },
            css_style: {
                width: canvas.style.width,
                height: canvas.style.height,
                transform: canvas.style.transform,
                zoom: canvas.style.zoom
            },
            computed: {
                clientWidth: canvas.clientWidth,
                clientHeight: canvas.clientHeight,
                boundingRect: {
                    width: rect.width,
                    height: rect.height
                }
            },
            pixi_renderer: {
                width: this.app.renderer.width,
                height: this.app.renderer.height,
                resolution: this.app.renderer.resolution
            },
            scale_factors: {
                x: rect.width / canvasConfig.width,
                y: rect.height / canvasConfig.height
            },
            is_correct: Math.abs(rect.width - canvasConfig.width) <= 1 && Math.abs(rect.height - canvasConfig.height) <= 1
        };
        
        console.log('🔍 キャンバスサイズ診断結果:', diagnosis);
        
        if (!diagnosis.is_correct) {
            console.error('🚨 キャンバスサイズ問題検出!', {
                問題: 'サイズが一致しません',
                期待値: `${diagnosis.expected.width}×${diagnosis.expected.height}`,
                実際値: `${rect.width}×${rect.height}`,
                倍率: `${diagnosis.scale_factors.x.toFixed(2)}×${diagnosis.scale_factors.y.toFixed(2)}`
            });
        }
        
        return diagnosis;
    }
}

// グローバル登録（重複チェック付き）
if (typeof window !== 'undefined') {
    if (window.AppCore) {
        console.warn('⚠️ AppCore was already registered - replacing...');
    }
    window.AppCore = AppCore;
    console.log('🎨 AppCore グローバル登録完了（キャンバス倍加修正版）');
    
    // 🚨 デバッグ用グローバル関数追加
    window.debugCanvasSize = function() {
        if (window.appCore && typeof window.appCore.diagnoseCanvasSize === 'function') {
            return window.appCore.diagnoseCanvasSize();
        } else {
            console.log('❌ AppCore インスタンスが見つかりません');
            return null;
        }
    };
    
    window.fixCanvasSize = function() {
        if (window.appCore && window.ConfigManager) {
            const config = window.ConfigManager.getCanvasConfig();
            if (typeof window.appCore.forceCanvasResize === 'function') {
                window.appCore.forceCanvasResize(config.width, config.height);
                console.log('🚨 キャンバスサイズ強制修正実行完了');
            }
        }
    };
}