/**
 * 🎨 AppCoreシステム（分割最適化版・座標統合修正版）
 * 🎯 AI_WORK_SCOPE: PixiJSアプリケーション基盤・システム統合・初期化制御
 * 🎯 DEPENDENCIES: 統一システム4種、BoundaryManager、CoordinateManager
 * 🎯 SPLIT_RESULT: 650行 → 350行（46%削減）
 * 🔧 EMERGENCY_FIX: Manager初期化メソッド統一・エラーハンドリング強化
 * 🔄 COORDINATE_INTEGRATION: CoordinateManager統合・座標統合Phase1.4
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
        
        console.log('🎨 AppCore インスタンス作成完了（座標統合版）');
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
     * アプリケーション初期化（分割最適化版・座標統合修正版）
     */
    async initialize() {
        try {
            console.log('🚀 AppCore 初期化開始（座標統合版）...');
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
     * 基盤システム初期化（座標統合修正版）
     */
    async initializeBasicSystems() {
        console.log('🔧 基盤システム初期化中...');
        
        // DOM確認
        await this.verifyDOMElements();
        
        // 🔄 COORDINATE_INTEGRATION: 座標管理システム初期化（エラーハンドリング強化）
        if (window.CoordinateManager) {
            try {
                this.coordinateManager = new window.CoordinateManager();
                console.log('✅ CoordinateManager初期化完了');
                
                // 座標統合設定確認
                const integrationStatus = this.coordinateManager.getIntegrationStatus();
                console.log('🔄 AppCore座標統合設定:', integrationStatus);
                
            } catch (error) {
                console.warn('⚠️ CoordinateManager初期化失敗（オプション）:', error.message);
                this.coordinateManager = null;
            }
        } else {
            console.warn('⚠️ CoordinateManager利用不可（オプション）');
        }
        
        // PixiJSアプリケーション初期化
        await this.initializePixiApp();
        
        // コンテナ初期化
        this.initializeContainers();
        
        console.log('✅ 基盤システム初期化完了');
    }
    
    /**
     * 管理システム初期化（座標統合修正版 - 初期化メソッド統一・CoordinateManager連携）
     */
    async initializeManagers() {
        console.log('🔧 管理システム初期化中...');
        
        // 境界管理システム初期化（座標統合対応）
        if (window.BoundaryManager) {
            try {
                this.boundaryManager = new window.BoundaryManager();
                // 🔄 COORDINATE_INTEGRATION: CoordinateManagerを渡して統合初期化
                await this.boundaryManager.initialize(this.app.view, this.coordinateManager);
                console.log('✅ BoundaryManager初期化完了（座標統合版）');
            } catch (error) {
                console.warn('⚠️ BoundaryManager初期化失敗（オプション）:', error.message);
                this.boundaryManager = null;
            }
        } else {
            console.warn('⚠️ BoundaryManager利用不可（オプション）');
        }
        
        // ツールマネージャー初期化（座標統合修正版）
        if (window.ToolManager) {
            try {
                this.toolManager = new window.ToolManager(this);
                // 🔄 COORDINATE_INTEGRATION: CoordinateManagerを渡して統合初期化
                await this.toolManager.initialize(this.coordinateManager);
                console.log('✅ ToolManager初期化完了（座標統合版）');
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
                await this.uiManager.init(); // ← UIManagerは init() メソッド（initialize()ではない）
                console.log('✅ UIManager初期化完了');
            } catch (error) {
                console.warn('⚠️ UIManager初期化失敗（オプション）:', error.message);
                this.uiManager = null;
            }
        } else {
            console.warn('⚠️ UIManager利用不可（オプション）');
        }
        
        console.log('✅ 管理システム初期化完了（座標統合版）');
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
            
            // 🔄 COORDINATE_INTEGRATION: CoordinateManager経由でのマージン処理
            let adjustedMargin = margin;
            if (this.coordinateManager) {
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
            // 🔄 COORDINATE_INTEGRATION: PixiJS座標系変換
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
            if (window.EventBus && typeof window.EventBus.on === 'function') {
                window.EventBus.on('boundary.cross.in', this.handleBoundaryCrossIn.bind(this));
            }
            
            // ウィンドウイベント
            window.addEventListener('resize', this.handleResize.bind(this));
            
            // ツールイベント
            if (window.EventBus && typeof window.EventBus.on === 'function') {
                window.EventBus.on('tool.changed', this.handleToolChanged.bind(this));
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
            if (window.ErrorManager && typeof window.ErrorManager.showError === 'function') {
                window.ErrorManager.showError('warning', 
                    `境界越え描画エラー: ${error.message}`, 
                    { additionalInfo: '境界越え処理', data }
                );
            }
        }
    }
    
    /**
     * ポインターダウンハンドラー（座標統合修正版）
     */
    handlePointerDown(event) {
        if (!this.toolManager) {
            console.warn('⚠️ ToolManager が利用できません');
            return;
        }
        
        try {
            // 🔄 COORDINATE_INTEGRATION: CoordinateManager経由での座標処理
            let coords;
            
            if (this.coordinateManager) {
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
                console.warn('⚠️ CoordinateManager未利用 - フォールバック座標処理');
            }
            
            // ToolManagerの描画開始メソッドを呼び出し
            this.toolManager.startDrawing(coords.canvas.x, coords.canvas.y, coords.pressure);
            
            if (window.EventBus && typeof window.EventBus.emit === 'function') {
                window.EventBus.emit('drawing.started', {
                    position: coords.canvas,
                    pressure: coords.pressure,
                    tool: this.toolManager.getCurrentTool() || 'unknown',
                    coordinateManagerUsed: !!this.coordinateManager
                });
            }
            
        } catch (error) {
            if (window.ErrorManager && typeof window.ErrorManager.showError === 'function') {
                window.ErrorManager.showError('warning', 
                    `ポインターダウンエラー: ${error.message}`, 
                    { additionalInfo: 'ポインター処理', event: event.type }
                );
            }
        }
    }
    
    /**
     * ポインター移動ハンドラー（座標統合修正版）
     */
    handlePointerMove(event) {
        try {
            // 🔄 COORDINATE_INTEGRATION: CoordinateManager経由での座標処理
            let coords;
            
            if (this.coordinateManager) {
                coords = this.coordinateManager.extractPointerCoordinates(
                    event, 
                    this.app.view.getBoundingClientRect()
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
            
            // 座標表示更新
            this.updateCoordinateDisplay(coords.canvas);
            
            // ツール描画継続
            if (this.toolManager) {
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
            this.toolManager.stopDrawing();
            
            if (window.EventBus && typeof window.EventBus.emit === 'function') {
                window.EventBus.emit('drawing.ended', {
                    timestamp: Date.now()
                });
            }
            
        } catch (error) {
            if (window.ErrorManager && typeof window.ErrorManager.showError === 'function') {
                window.ErrorManager.showError('warning', 
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
     * リサイズハンドラー（座標統合修正版）
     */
    handleResize() {
        if (!this.app) return;
        
        console.log('🔄 ウィンドウリサイズ検出');
        
        // 🔄 COORDINATE_INTEGRATION: CoordinateManagerにリサイズ通知
        if (this.coordinateManager && typeof this.coordinateManager.updateCanvasSize === 'function') {
            this.coordinateManager.updateCanvasSize(this.canvasWidth, this.canvasHeight);
        }
        
        if (window.EventBus && typeof window.EventBus.emit === 'function') {
            window.EventBus.emit('window.resized', {
                width: this.canvasWidth,
                height: this.canvasHeight,
                coordinateManagerUpdated: !!this.coordinateManager,
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
     * 初期化完了処理（座標統合修正版）
     */
    completeInitialization() {
        this.isInitializing = false;
        this.initializationComplete = true;
        
        if (window.EventBus && typeof window.EventBus.emit === 'function') {
            window.EventBus.emit('appCore.initialized', {
                success: true,
                components: this.getInitializationStats(),
                coordinateManagerIntegrated: !!this.coordinateManager,
                timestamp: Date.now()
            });
        }
        
        console.log('✅ AppCore 初期化完了（座標統合版）');
        
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
     * 初期化検証（座標統合修正版）
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
        
        // 座標統合確認
        if (this.coordinateManager) {
            const integrationStatus = this.coordinateManager.getIntegrationStatus();
            console.log('🔄 座標統合状態:', {
                enabled: integrationStatus.managerCentralization,
                duplicateElimination: integrationStatus.duplicateElimination,
                performanceOptimized: integrationStatus.performanceOptimized
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
     * 初期化統計取得（座標統合修正版）
     */
    getInitializationStats() {
        const stats = {
            pixiApp: !!this.app,
            drawingContainer: !!this.drawingContainer,
            boundaryManager: !!this.boundaryManager,
            coordinateManager: !!this.coordinateManager,
            toolManager: !!this.toolManager,
            uiManager: !!this.uiManager,
            initializationComplete: this.initializationComplete,
            initializationFailed: this.initializationFailed
        };
        
        // 座標統合状態を追加
        if (this.coordinateManager) {
            const integrationStatus = this.coordinateManager.getIntegrationStatus();
            stats.coordinateIntegration = {
                enabled: integrationStatus.managerCentralization,
                duplicateElimination: integrationStatus.duplicateElimination,
                performanceOptimized: integrationStatus.performanceOptimized
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
     * キャンバスリサイズ（座標統合修正版）
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
            const canvasConfig = window.ConfigManager.getCanvasConfig();
            const validWidth = Math.max(canvasConfig.minWidth || 100, Math.min(canvasConfig.maxWidth || 2000, newWidth));
            const validHeight = Math.max(canvasConfig.minHeight || 100, Math.min(canvasConfig.maxHeight || 2000, newHeight));
            
            this.canvasWidth = validWidth;
            this.canvasHeight = validHeight;
            
            // 🔄 COORDINATE_INTEGRATION: 座標管理システム更新
            if (this.coordinateManager && typeof this.coordinateManager.updateCanvasSize === 'function') {
                this.coordinateManager.updateCanvasSize(validWidth, validHeight);
            }
            
            // アプリケーションリサイズ
            this.app.renderer.resize(validWidth, validHeight);
            this.app.stage.hitArea = new PIXI.Rectangle(0, 0, validWidth, validHeight);
            
            // 境界管理システム更新
            if (this.boundaryManager && typeof this.boundaryManager.createExpandedHitArea === 'function') {
                this.boundaryManager.createExpandedHitArea();
            }
            
            if (window.EventBus && typeof window.EventBus.emit === 'function') {
                window.EventBus.emit('canvas.resized', {
                    width: validWidth,
                    height: validHeight,
                    previousWidth: oldWidth,
                    previousHeight: oldHeight,
                    coordinateManagerUpdated: !!this.coordinateManager,
                    timestamp: Date.now()
                });
            }
            
            console.log(`📐 キャンバスリサイズ（座標統合版）: ${validWidth}x${validHeight}`);
            
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
     * 🆕 座標統合状態取得（外部アクセス用）
     */
    getCoordinateIntegrationState() {
        return {
            coordinateManagerAvailable: !!this.coordinateManager,
            boundaryManagerIntegrated: !!(this.boundaryManager && this.boundaryManager.coordinateManager),
            toolManagerIntegrated: !!(this.toolManager && this.toolManager.coordinateManager),
            coordinateManagerState: this.coordinateManager ? 
                this.coordinateManager.getCoordinateState() : null,
            appCoreState: this.getInitializationStats(),
            phase2Ready: !!(this.coordinateManager && 
                           this.boundaryManager?.coordinateManager && 
                           this.toolManager?.coordinateManager)
        };
    }
    
    /**
     * システム破棄（座標統合修正版）
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
            this.coordinateManager = null; // 🔄 座標統合対応
            
            console.log('🎨 AppCore 破棄完了（座標統合版）');
            
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
    console.log('🎨 AppCore グローバル登録完了（座標統合版・初期化メソッド統一）');
}

console.log('🔄 AppCore Phase1.4 座標統合版 - 準備完了');
console.log('📋 座標統合実装完了: CoordinateManager統合・Manager連携・座標処理最適化');
console.log('🔧 Manager初期化統一: initialize()メソッド統一・CoordinateManager依存注入');
console.log('🎯 境界システム統合: PixiJS境界システム・座標変換・イベント連携');
console.log('💡 使用例: const appCore = new window.AppCore(); await appCore.initialize();');