/**
 * 🎨 AppCoreシステム（高DPI修正版）
 * 🎯 AI_WORK_SCOPE: PixiJSアプリケーション基盤・高DPI対応・サイズ制御
 * 🎯 DEPENDENCIES: 統一システム4種、BoundaryManager、CoordinateManager
 * 🔧 HIGHDPI_FIX: resolution固定・CSS強制サイズ・devicePixelRatio補正削除
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
        
        console.log('🎨 AppCore インスタンス作成完了（高DPI修正版）');
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
     * 設定初期化（高DPI対応設定追加）
     */
    initializeConfig() {
        try {
            const canvasConfig = window.ConfigManager.getCanvasConfig();
            this.canvasWidth = canvasConfig.width;
            this.canvasHeight = canvasConfig.height;
            this.backgroundColor = canvasConfig.backgroundColor;
            
            // 境界描画設定
            this.boundaryConfig = window.ConfigManager.get('canvas.boundary') || {
                enabled: true,
                margin: 20,
                trackingEnabled: true
            };
            
            // 🔧 高DPI対応設定追加
            this.highDPIConfig = window.ConfigManager.get('canvas.highDPI') || {
                forceResolution: 1,           // resolution固定値
                forceCSSSize: true,           // CSSサイズ強制適用
                disableDevicePixelRatio: true // devicePixelRatio補正無効
            };
            
        } catch (error) {
            console.warn('⚠️ 設定初期化で問題発生、フォールバック使用:', error.message);
            
            // フォールバック設定（高DPI対応含む）
            this.canvasWidth = 400;
            this.canvasHeight = 400;
            this.backgroundColor = 0xf0e0d6;
            this.boundaryConfig = { enabled: true, margin: 20, trackingEnabled: true };
            this.highDPIConfig = { forceResolution: 1, forceCSSSize: true, disableDevicePixelRatio: true };
        }
    }
    
    /**
     * アプリケーション初期化
     */
    async initialize() {
        try {
            console.log('🚀 AppCore 初期化開始（高DPI修正版）...');
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
        if (window.CoordinateManager) {
            try {
                this.coordinateManager = new window.CoordinateManager();
                console.log('✅ CoordinateManager初期化完了');
            } catch (error) {
                console.warn('⚠️ CoordinateManager初期化失敗:', error.message);
                this.coordinateManager = null;
            }
        } else {
            console.warn('⚠️ CoordinateManager利用不可');
        }
        
        // PixiJSアプリケーション初期化（高DPI修正版）
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
        if (window.BoundaryManager) {
            try {
                this.boundaryManager = new window.BoundaryManager();
                await this.boundaryManager.initialize(this.app.view, this.coordinateManager);
                console.log('✅ BoundaryManager初期化完了');
            } catch (error) {
                console.warn('⚠️ BoundaryManager初期化失敗:', error.message);
                this.boundaryManager = null;
            }
        }
        
        // ツールマネージャー初期化
        if (window.ToolManager) {
            try {
                this.toolManager = new window.ToolManager(this);
                await this.toolManager.initialize();
                console.log('✅ ToolManager初期化完了');
            } catch (error) {
                console.warn('⚠️ ToolManager初期化失敗:', error.message);
                this.toolManager = null;
            }
        }
        
        // UIマネージャー初期化
        if (window.UIManager) {
            try {
                this.uiManager = new window.UIManager(this);
                await this.uiManager.init();
                console.log('✅ UIManager初期化完了');
            } catch (error) {
                console.warn('⚠️ UIManager初期化失敗:', error.message);
                this.uiManager = null;
            }
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
        
        // 🔧 高DPI表示サイズ強制適用
        this.enforceCanvasDisplaySize();
        
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
     * PixiJSアプリケーション初期化（高DPI修正版）
     */
    async initializePixiApp() {
        try {
            const canvasConfig = window.ConfigManager.getCanvasConfig();
            const pixiConfig = window.ConfigManager.getPixiConfig();
            
            console.log('🔧 PixiJS初期化（高DPI修正版）...');
            console.log('📊 DevicePixelRatio:', window.devicePixelRatio || 1);
            
            // 🔧 高DPI修正: resolution を 1 に固定
            const fixedResolution = this.highDPIConfig.forceResolution || 1;
            
            this.app = new PIXI.Application({
                width: canvasConfig.width,
                height: canvasConfig.height,
                backgroundColor: canvasConfig.backgroundColor,
                antialias: pixiConfig.antialias,
                resolution: fixedResolution, // 🔧 devicePixelRatioではなく固定値
                autoDensity: false           // 🔧 自動密度調整を無効化
            });
            
            const canvasElement = document.getElementById('drawing-canvas');
            canvasElement.appendChild(this.app.view);
            
            // 🔧 キャンバス要素の基本設定（高DPI対応）
            this.app.view.style.cursor = pixiConfig.cursor || 'crosshair';
            this.app.view.style.touchAction = 'none';
            
            console.log('✅ PixiJS基盤初期化完了');
            console.log(`📊 Canvas内部サイズ: ${this.app.view.width}x${this.app.view.height}`);
            console.log(`📊 Canvas解像度: ${this.app.renderer.resolution}`);
            
        } catch (error) {
            console.error('❌ PixiJSアプリケーション初期化失敗:', error);
            throw error;
        }
    }
    
    /**
     * 🔧 キャンバス表示サイズ強制適用（高DPI修正の核心）
     */
    enforceCanvasDisplaySize() {
        try {
            console.log('🔧 キャンバス表示サイズ強制適用中...');
            
            const canvasElement = this.app.view;
            if (!canvasElement) {
                console.warn('⚠️ Canvas要素が見つかりません');
                return;
            }
            
            // 🔧 CSS強制サイズ設定
            canvasElement.style.width = `${this.canvasWidth}px`;
            canvasElement.style.height = `${this.canvasHeight}px`;
            canvasElement.style.maxWidth = `${this.canvasWidth}px`;
            canvasElement.style.maxHeight = `${this.canvasHeight}px`;
            canvasElement.style.minWidth = `${this.canvasWidth}px`;
            canvasElement.style.minHeight = `${this.canvasHeight}px`;
            
            // 🔧 additional CSS防御的設定
            canvasElement.style.objectFit = 'contain';
            canvasElement.style.imageRendering = 'crisp-edges'; // 高DPI環境での鮮明化
            
            console.log(`✅ 表示サイズ強制適用完了: ${this.canvasWidth}x${this.canvasHeight}px`);
            console.log(`📊 実際のCSS width: ${canvasElement.style.width}`);
            console.log(`📊 実際のCSS height: ${canvasElement.style.height}`);
            
            // 🔧 CoordinateManager にサイズ情報同期
            if (this.coordinateManager && typeof this.coordinateManager.updateCanvasSize === 'function') {
                this.coordinateManager.updateCanvasSize(this.canvasWidth, this.canvasHeight);
                console.log('✅ CoordinateManager サイズ同期完了');
            }
            
        } catch (error) {
            console.error('❌ キャンバス表示サイズ強制適用失敗:', error);
            // エラーでも処理継続（重要度低）
        }
    }
    
    /**
     * コンテナ初期化
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
     * PixiJS境界システム統合初期化
     */
    initializePixiBoundarySystem() {
        if (!this.app || !this.boundaryManager) {
            console.warn('⚠️ PixiJS境界システム統合スキップ');
            return;
        }
        
        try {
            console.log('🎯 PixiJS境界システム統合初期化中...');
            
            const margin = this.boundaryManager.boundaryMargin || 20;
            this.app.stage.hitArea = new PIXI.Rectangle(
                -margin,
                -margin,
                this.canvasWidth + margin * 2,
                this.canvasHeight + margin * 2
            );
            
            this.app.stage.interactive = true;
            this.app.stage.interactiveChildren = true;
            
            this.setupPixiBoundaryEvents();
            
            console.log('✅ PixiJS境界システム統合完了');
            
        } catch (error) {
            console.warn('⚠️ PixiJS境界システム統合で問題発生:', error.message);
        }
    }
    
    /**
     * PixiJS境界イベント設定
     */
    setupPixiBoundaryEvents() {
        try {
            if (window.EventBus && typeof window.EventBus.on === 'function') {
                window.EventBus.on('boundary.cross.in', (data) => {
                    this.handlePixiBoundaryCross(data);
                });
            }
            
            this.app.stage.on('pointerenter', (event) => {
                if (window.EventBus && typeof window.EventBus.emit === 'function') {
                    window.EventBus.emit('pixi.pointer.enter', { event });
                }
            });
            
            this.app.stage.on('pointerleave', (event) => {
                if (window.EventBus && typeof window.EventBus.emit === 'function') {
                    window.EventBus.emit('pixi.pointer.leave', { event });
                }
            });
            
        } catch (error) {
            console.warn('⚠️ PixiJS境界イベント設定で問題発生:', error.message);
        }
    }
    
    /**
     * PixiJS境界越え処理
     */
    handlePixiBoundaryCross(data) {
        if (!this.coordinateManager) return;
        
        try {
            const pixiCoords = this.coordinateManager.canvasToPixi(
                data.position.x, 
                data.position.y, 
                this.app
            );
            
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
     * イベントリスナー設定
     */
    setupEventListeners() {
        try {
            // PixiJS描画イベント
            this.app.stage.on('pointerdown', this.handlePointerDown.bind(this));
            this.app.stage.on('pointermove', this.handlePointerMove.bind(this));
            this.app.stage.on('pointerup', this.handlePointerUp.bind(this));
            this.app.stage.on('pointerupoutside', this.handlePointerUp.bind(this));
            
            // 境界越えイベント
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
     * 境界越え描画開始処理
     */
    handleBoundaryCrossIn(data) {
        if (!this.toolManager) return;
        
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
     * ポインターダウンハンドラー（高DPI対応）
     */
    handlePointerDown(event) {
        if (!this.toolManager || !this.coordinateManager) {
            console.warn('⚠️ ToolManager または CoordinateManager が利用できません');
            return;
        }
        
        try {
            // 🔧 高DPI対応: 修正されたCoordinateManagerを使用
            const coords = this.coordinateManager.extractPointerCoordinates(
                event, 
                this.app.view.getBoundingClientRect(), 
                this.app
            );
            
            console.log(`🎯 PointerDown: screen(${coords.screen.x}, ${coords.screen.y}) → canvas(${coords.canvas.x}, ${coords.canvas.y})`);
            
            // ToolManagerの描画開始
            this.toolManager.startDrawing(coords.canvas.x, coords.canvas.y, coords.pressure);
            
            if (window.EventBus && typeof window.EventBus.emit === 'function') {
                window.EventBus.emit('drawing.started', {
                    position: coords.canvas,
                    pressure: coords.pressure,
                    tool: this.toolManager.getCurrentTool() || 'unknown'
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
     * ポインター移動ハンドラー（高DPI対応）
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
            if (this.toolManager) {
                this.toolManager.continueDrawing(coords.canvas.x, coords.canvas.y, coords.pressure);
            }
            
        } catch (error) {
            console.warn('⚠️ ポインター移動処理エラー:', error.message);
        }
    }
    
    /**
     * ポインターアップハンドラー
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
     * 座標表示更新
     */
    updateCoordinateDisplay(canvasCoords) {
        try {
            const coordinatesElement = document.getElementById('coordinates');
            if (coordinatesElement) {
                coordinatesElement.textContent = `x: ${Math.round(canvasCoords.x)}, y: ${Math.round(canvasCoords.y)}`;
            }
        } catch (error) {
            console.warn('⚠️ 座標表示更新エラー:', error.message);
        }
    }
    
    /**
     * リサイズハンドラー（高DPI対応）
     */
    handleResize() {
        if (!this.app) return;
        
        console.log('🔄 ウィンドウリサイズ検出');
        
        // 🔧 リサイズ時も表示サイズを再適用
        setTimeout(() => {
            this.enforceCanvasDisplaySize();
        }, 100);
        
        if (window.EventBus && typeof window.EventBus.emit === 'function') {
            window.EventBus.emit('window.resized', {
                timestamp: Date.now()
            });
        }
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
        
        if (window.EventBus && typeof window.EventBus.emit === 'function') {
            window.EventBus.emit('appCore.initialized', {
                success: true,
                components: this.getInitializationStats(),
                timestamp: Date.now()
            });
        }
        
        console.log('✅ AppCore 初期化完了（高DPI修正版）');
    }
    
    /**
     * 初期化エラー処理
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
            uiManager: !!this.uiManager,
            canvasSize: this.verifyCanvasSize() // 🔧 サイズ検証追加
        };
        
        const passCount = Object.values(verification).filter(Boolean).length;
        const totalCount = Object.keys(verification).length;
        
        console.log(`✅ 初期化検証: ${passCount}/${totalCount} (${(passCount/totalCount*100).toFixed(1)}%)`);
        
        if (passCount < 4) {
            const failed = Object.entries(verification)
                .filter(([key, value]) => !value)
                .map(([key]) => key);
            
            if (window.ErrorManager && typeof window.ErrorManager.showError === 'function') {
                window.ErrorManager.showError('warning', `初期化未完了: ${failed.join(', ')}`);
            }
        }
    }
    
    /**
     * 🔧 キャンバスサイズ検証（高DPI対応）
     */
    verifyCanvasSize() {
        try {
            if (!this.app?.view) return false;
            
            const canvasElement = this.app.view;
            const computedStyle = getComputedStyle(canvasElement);
            const displayWidth = parseInt(computedStyle.width, 10);
            const displayHeight = parseInt(computedStyle.height, 10);
            
            const isCorrectSize = displayWidth === this.canvasWidth && displayHeight === this.canvasHeight;
            
            console.log(`🔍 キャンバスサイズ検証:`);
            console.log(`📊 期待サイズ: ${this.canvasWidth}x${this.canvasHeight}px`);
            console.log(`📊 実際サイズ: ${displayWidth}x${displayHeight}px`);
            console.log(`📊 検証結果: ${isCorrectSize ? '✅ 正常' : '❌ 不整合'}`);
            
            if (!isCorrectSize) {
                console.warn('⚠️ キャンバスサイズが期待値と異なります。再適用します...');
                this.enforceCanvasDisplaySize();
            }
            
            return isCorrectSize;
            
        } catch (error) {
            console.warn('⚠️ キャンバスサイズ検証エラー:', error.message);
            return false;
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
            initializationFailed: this.initializationFailed,
            canvasSize: this.verifyCanvasSize(),
            highDPIConfig: this.highDPIConfig
        };
    }
    
    /**
     * フォールバックモード初期化
     */
    async initializeFallbackMode(originalError) {
        console.log('🛡️ フォールバックモード初期化中...');
        
        try {
            if (!this.app) {
                const fallbackConfig = {
                    width: this.canvasWidth || 400,
                    height: this.canvasHeight || 400,
                    backgroundColor: this.backgroundColor || 0xf0e0d6,
                    resolution: 1 // 🔧 フォールバックでもresolution=1
                };
                
                this.app = new PIXI.Application(fallbackConfig);
                const canvasElement = document.getElementById('drawing-canvas');
                if (canvasElement) {
                    canvasElement.appendChild(this.app.view);
                    // フォールバックでもサイズ強制適用
                    this.enforceCanvasDisplaySize();
                }
            }
            
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
     * キャンバスリサイズ（高DPI対応）
     */
    resize(newWidth, newHeight, centerContent = false) {
        if (!this.app) {
            console.warn('⚠️ PixiJSアプリが初期化されていません');
            return;
        }
        
        try {
            const oldWidth = this.canvasWidth;
            const oldHeight = this.canvasHeight;
            
            const canvasConfig = window.ConfigManager.getCanvasConfig();
            const validWidth = Math.max(canvasConfig.minWidth || 100, Math.min(canvasConfig.maxWidth || 2000, newWidth));
            const validHeight = Math.max(canvasConfig.minHeight || 100, Math.min(canvasConfig.maxHeight || 2000, newHeight));
            
            this.canvasWidth = validWidth;
            this.canvasHeight = validHeight;
            
            // 座標管理システム更新
            if (this.coordinateManager && typeof this.coordinateManager.updateCanvasSize === 'function') {
                this.coordinateManager.updateCanvasSize(validWidth, validHeight);
            }
            
            // アプリケーションリサイズ
            this.app.renderer.resize(validWidth, validHeight);
            this.app.stage.hitArea = new PIXI.Rectangle(0, 0, validWidth, validHeight);
            
            // 🔧 リサイズ後も表示サイズ強制適用
            this.enforceCanvasDisplaySize();
            
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
                    timestamp: Date.now()
                });
            }
            
            console.log(`📐 キャンバスリサイズ: ${validWidth}x${validHeight}`);
            
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
     * 🔧 高DPI診断情報取得（デバッグ用）
     */
    getHighDPIDiagnostics() {
        try {
            const canvasElement = this.app?.view;
            const computedStyle = canvasElement ? getComputedStyle(canvasElement) : null;
            
            return {
                devicePixelRatio: window.devicePixelRatio || 1,
                pixiResolution: this.app?.renderer?.resolution || 'N/A',
                canvasInternalSize: canvasElement ? { 
                    width: canvasElement.width, 
                    height: canvasElement.height 
                } : 'N/A',
                canvasDisplaySize: computedStyle ? {
                    width: computedStyle.width,
                    height: computedStyle.height
                } : 'N/A',
                expectedSize: { width: this.canvasWidth, height: this.canvasHeight },
                highDPIConfig: this.highDPIConfig,
                coordinateManagerState: this.coordinateManager?.getCoordinateState() || 'N/A'
            };
        } catch (error) {
            return { error: error.message };
        }
    }
    
    /**
     * システム破棄
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
    console.log('🎨 AppCore グローバル登録完了（高DPI修正版）');
}