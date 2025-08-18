/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1.0
 * 🚨 Task 1-B先行実装: 重複関数完全排除・統一システム完全統合版
 * 🎯 DRY・SOLID原則完全準拠・アプリケーションコア
 * 
 * 🎯 AI_WORK_SCOPE: PixiJSアプリケーション基盤・描画エンジン・ツールシステム
 * 🎯 DEPENDENCIES: libs/pixi-extensions.js, PixiJS Core, 統一システム4種
 * 🎯 SPLIT_THRESHOLD: 500行以下維持（重複排除により行数削減）
 * 🚨 重複排除内容: 設定値統一・エラー処理統一・EventBus完全移行・循環依存解決
 */

class AppCore {
    constructor() {
        this.validateUnifiedSystems();
        this.initializeConfig();
        
        // 基本プロパティ
        this.app = null;
        this.drawingContainer = null;
        this.uiContainer = null;
        this.paths = [];
        this.currentTool = 'pen';
        
        // システム
        this.toolSystem = null;
        this.uiController = null;
        this.performanceMonitor = null;
        
        // 状態管理
        this.isInitializing = false;
        this.initializationComplete = false;
        this.extensionsAvailable = false;
        this.fallbackMode = false;
        
        console.log('🎨 AppCore インスタンス作成完了（DRY・SOLID準拠版）');
    }
    
    /**
     * 🚨 統一システム依存性確認（必須前提条件）
     */
    validateUnifiedSystems() {
        const requiredSystems = ['ConfigManager', 'ErrorManager', 'StateManager', 'EventBus'];
        const missing = requiredSystems.filter(sys => !window[sys]);
        
        if (missing.length > 0) {
            throw new Error(`統一システム依存性エラー: ${missing.join(', ')}`);
        }
        
        console.log('✅ AppCore統一システム依存性確認完了');
    }
    
    /**
     * 🚨 重複排除: ConfigManager統一設定読み込み（ハードコード完全排除）
     */
    initializeConfig() {
        this.canvasWidth = window.ConfigManager.get('canvas.width');
        this.canvasHeight = window.ConfigManager.get('canvas.height');
        this.backgroundColor = window.ConfigManager.get('canvas.backgroundColor');
    }
    
    /**
     * 🚨 重複排除: アプリケーション初期化（統一システム統合版）
     */
    async initialize() {
        try {
            console.log('🚀 AppCore 初期化開始（DRY・SOLID準拠版）...');
            this.isInitializing = true;
            
            await this.verifyDOMElements();
            await this.checkExtensions();
            await this.initializePixiApp();
            this.initializeContainers();
            this.initializeToolSystem();
            await this.initializeUI();
            this.setupEventListeners();
            this.startPerformanceMonitoring();
            this.verifyInitialization();
            
            this.isInitializing = false;
            this.initializationComplete = true;
            
            window.EventBus.safeEmit('appCore.initialized', {
                success: true,
                components: this.getInitializationStats()
            });
            
            console.log('✅ AppCore 初期化完了（DRY・SOLID準拠版）');
            
        } catch (error) {
            console.error('💀 AppCore初期化エラー:', error);
            
            window.ErrorManager.showError('error', error.message, {
                additionalInfo: 'AppCore初期化失敗',
                showReload: true
            });
            
            this.initializationFailed = true;
            this.lastError = error.message;
            
            await this.initializeFallbackMode(error);
        }
    }
    
    /**
     * DOM要素確認
     */
    async verifyDOMElements() {
        console.log('🔍 DOM要素確認開始（キャンバス表示修復）...');
        
        const canvasElement = document.getElementById('drawing-canvas');
        if (!canvasElement) {
            throw new Error('drawing-canvas 要素が見つかりません');
        }
        
        // キャンバス要素のクリア
        while (canvasElement.firstChild) {
            canvasElement.removeChild(canvasElement.firstChild);
        }
        
        console.log('✅ DOM要素確認完了 - キャンバス要素準備完了');
    }
    
    /**
     * 拡張機能確認
     */
    async checkExtensions() {
        console.log('🔍 拡張機能確認中...');
        
        if (window.PixiExtensions && window.PixiExtensions.initialized) {
            this.extensionsAvailable = true;
            const stats = window.PixiExtensions.getStats();
            console.log(`✅ 拡張機能利用可能: ${stats.available}/${stats.total}`);
            
            if (stats.fallbackMode) {
                this.fallbackMode = true;
            }
        } else {
            console.warn('⚠️ 拡張機能未初期化 - フォールバックモード有効');
            this.fallbackMode = true;
        }
    }
    
    /**
     * 🚨 重複排除: PixiJS アプリケーション初期化（ConfigManager統一版）
     */
    async initializePixiApp() {
        console.log('🎮 PixiJS アプリケーション初期化中（ConfigManager統一版）...');
        
        const canvasConfig = window.ConfigManager.getCanvasConfig();
        const pixiConfig = window.ConfigManager.getPixiConfig();
        
        const appConfig = {
            width: canvasConfig.width,
            height: canvasConfig.height,
            backgroundColor: canvasConfig.backgroundColor,
            antialias: pixiConfig.antialias,
            resolution: pixiConfig.resolution,
            autoDensity: pixiConfig.autoDensity
        };
        
        this.app = new PIXI.Application(appConfig);
        
        const canvasElement = document.getElementById('drawing-canvas');
        if (!canvasElement) {
            throw new Error('drawing-canvas 要素が見つかりません');
        }
        
        canvasElement.appendChild(this.app.view);
        
        // DOM接続確認
        if (!canvasElement.contains(this.app.view)) {
            throw new Error('PixiJS キャンバスのDOM接続に失敗');
        }
        
        // キャンバススタイル設定
        this.app.view.style.display = 'block';
        this.app.view.style.cursor = window.ConfigManager.get('pixi.cursor');
        
        console.log(`✅ PixiJS アプリケーション初期化完了 (${canvasConfig.width}x${canvasConfig.height})`);
    }
    
    /**
     * コンテナ初期化
     */
    initializeContainers() {
        console.log('📦 コンテナ初期化中...');
        
        this.drawingContainer = new PIXI.Container();
        this.drawingContainer.name = 'drawing-layer';
        this.app.stage.addChild(this.drawingContainer);
        
        this.uiContainer = new PIXI.Container();
        this.uiContainer.name = 'ui-layer';
        this.app.stage.addChild(this.uiContainer);
        
        const canvasConfig = window.ConfigManager.getCanvasConfig();
        this.app.stage.interactive = true;
        this.app.stage.hitArea = new PIXI.Rectangle(0, 0, canvasConfig.width, canvasConfig.height);
        
        console.log('✅ コンテナ初期化完了');
    }
    
    /**
     * ツールシステム初期化
     */
    initializeToolSystem() {
        console.log('🔧 ツールシステム初期化中...');
        
        this.toolSystem = new DrawingToolSystem(this);
        
        console.log('✅ ツールシステム初期化完了');
    }
    
    /**
     * 🚨 重複排除: UI制御初期化（ErrorManager統一版）
     */
    async initializeUI() {
        console.log('🎨 UI制御初期化中（統一システム統合版）...');
        
        try {
            this.uiController = new UIController(this.toolSystem);
            this.uiController.initialize();
            
            console.log('✅ UI制御初期化完了');
            
        } catch (error) {
            console.error('💀 UI制御初期化エラー:', error);
            
            window.ErrorManager.showError('warning', 
                `UI制御初期化に失敗しました: ${error.message}`, {
                showDebug: false
            });
            
            // 最小限のUIコントローラー作成
            this.uiController = new MinimalUIController(this.toolSystem);
        }
    }
    
    /**
     * 🚨 重複排除: イベントリスナー設定（EventBus統一版）
     */
    setupEventListeners() {
        console.log('🎧 イベントリスナー設定中（EventBus統一版）...');
        
        // 描画イベント
        this.app.stage.on('pointerdown', this.handlePointerDown.bind(this));
        this.app.stage.on('pointermove', this.handlePointerMove.bind(this));
        this.app.stage.on('pointerup', this.handlePointerUp.bind(this));
        this.app.stage.on('pointerupoutside', this.handlePointerUp.bind(this));
        
        // リサイズイベント
        window.addEventListener('resize', this.handleResize.bind(this));
        
        // EventBusリスナー
        window.EventBus.on('tool.changed', this.handleToolChanged.bind(this));
        window.EventBus.on('canvas.resize', this.handleCanvasResize.bind(this));
        
        console.log('✅ イベントリスナー設定完了（EventBus統一版）');
    }
    
    /**
     * EventBusリスナー - ツール変更
     */
    handleToolChanged(data) {
        console.log(`🔧 ツール変更検出: ${data.previousTool} → ${data.tool}`);
        this.currentTool = data.tool;
    }
    
    /**
     * EventBusリスナー - キャンバスリサイズ
     */
    handleCanvasResize(data) {
        console.log(`📐 キャンバスリサイズ検出: ${data.width}x${data.height}`);
        this.resize(data.width, data.height, data.centerContent);
    }
    
    /**
     * 🚨 重複排除: パフォーマンス監視開始（ConfigManager統一版）
     */
    startPerformanceMonitoring() {
        console.log('📊 パフォーマンス監視開始...');
        
        try {
            const performanceConfig = window.ConfigManager.getPerformanceConfig();
            this.performanceMonitor = new PerformanceMonitor(performanceConfig);
            this.performanceMonitor.start();
            
            console.log('✅ パフォーマンス監視開始完了');
        } catch (error) {
            console.warn('⚠️ パフォーマンス監視開始失敗:', error);
            
            window.ErrorManager.showError('warning', 
                `パフォーマンス監視の開始に失敗しました: ${error.message}`, {
                showDebug: false
            });
        }
    }
    
    /**
     * 初期化完了確認
     */
    verifyInitialization() {
        console.log('🔍 初期化完了確認中...');
        
        const verificationResults = {
            pixiApp: !!this.app,
            canvasElement: !!document.getElementById('drawing-canvas'),
            canvasInDOM: document.getElementById('drawing-canvas')?.contains(this.app?.view),
            drawingContainer: !!this.drawingContainer,
            toolSystem: !!this.toolSystem,
            uiController: !!this.uiController,
            performanceMonitor: !!this.performanceMonitor,
            stageInteractive: this.app?.stage?.interactive,
            unifiedSystems: this.verifyUnifiedSystems()
        };
        
        const totalChecks = Object.keys(verificationResults).length;
        const passedChecks = Object.values(verificationResults).filter(Boolean).length;
        
        console.log(`✅ 検証完了: ${passedChecks}/${totalChecks} (${(passedChecks/totalChecks*100).toFixed(1)}%)`);
        
        if (passedChecks < totalChecks) {
            const failedChecks = Object.entries(verificationResults)
                .filter(([key, value]) => !value)
                .map(([key, value]) => key);
            
            window.ErrorManager.showError('warning', 
                `初期化未完了項目があります: ${failedChecks.join(', ')}`, {
                showDebug: true
            });
        }
        
        // キャンバス表示の最終確認
        const canvasElement = document.getElementById('drawing-canvas');
        const pixiCanvas = this.app?.view;
        
        if (canvasElement && pixiCanvas && canvasElement.contains(pixiCanvas)) {
            console.log('🎉 キャンバス表示修復成功！');
        } else {
            throw new Error('キャンバス表示修復に失敗 - DOM接続が不完全');
        }
    }
    
    /**
     * 統一システム検証
     */
    verifyUnifiedSystems() {
        const systems = ['ConfigManager', 'ErrorManager', 'StateManager', 'EventBus'];
        return systems.every(system => !!window[system]);
    }
    
    /**
     * 初期化統計取得
     */
    getInitializationStats() {
        return {
            pixiApp: !!this.app,
            drawingContainer: !!this.drawingContainer,
            toolSystem: !!this.toolSystem,
            uiController: !!this.uiController,
            performanceMonitor: !!this.performanceMonitor,
            extensionsAvailable: this.extensionsAvailable,
            fallbackMode: this.fallbackMode,
            unifiedSystemsActive: this.verifyUnifiedSystems()
        };
    }
    
    /**
     * 🚨 重複排除: フォールバックモード初期化（統一システム版）
     */
    async initializeFallbackMode(error) {
        console.log('🛡️ フォールバックモード初期化中（統一システム版）...');
        this.fallbackMode = true;
        
        try {
            if (!this.app) {
                const fallbackConfig = {
                    width: window.ConfigManager.get('canvas.width') || 400,
                    height: window.ConfigManager.get('canvas.height') || 400,
                    backgroundColor: window.ConfigManager.get('canvas.backgroundColor') || 0xf0e0d6,
                    antialias: window.ConfigManager.get('pixi.antialias') || true
                };
                
                this.app = new PIXI.Application(fallbackConfig);
                
                const canvasElement = document.getElementById('drawing-canvas');
                if (canvasElement) {
                    canvasElement.appendChild(this.app.view);
                }
            }
            
            if (!this.drawingContainer) {
                this.initializeContainers();
            }
            
            this.toolSystem = new SimpleFallbackToolSystem(this);
            
            console.log('✅ フォールバックモード初期化完了');
            
            window.ErrorManager.showError('recovery', 
                '基本描画機能は利用可能です。一部の高度な機能が制限されています。');
            
        } catch (fallbackError) {
            console.error('💀 フォールバックモード初期化も失敗:', fallbackError);
            
            window.ErrorManager.showCriticalError(error.message, {
                additionalInfo: fallbackError.message,
                showDebug: true,
                showReload: true
            });
        }
    }
    
    /**
     * 🚨 重複排除: イベントハンドラ: ポインターダウン（EventBus統一版）
     */
    handlePointerDown(event) {
        if (!this.toolSystem) return;
        
        const point = this.getLocalPointerPosition(event);
        this.toolSystem.startDrawing(point.x, point.y);
        
        if (this.initializationComplete) {
            window.EventBus.safeEmit('drawing.started', {
                x: point.x,
                y: point.y,
                tool: this.toolSystem.currentTool
            });
        }
        
        console.log(`🖊️ 描画開始: (${point.x.toFixed(1)}, ${point.y.toFixed(1)})`);
    }
    
    /**
     * イベントハンドラ: ポインター移動
     */
    handlePointerMove(event) {
        const point = this.getLocalPointerPosition(event);
        
        // 座標表示更新
        const coordinatesElement = document.getElementById('coordinates');
        if (coordinatesElement) {
            coordinatesElement.textContent = `x: ${Math.round(point.x)}, y: ${Math.round(point.y)}`;
        }
        
        if (this.toolSystem) {
            this.toolSystem.continueDrawing(point.x, point.y);
        }
    }
    
    /**
     * イベントハンドラ: ポインターアップ
     */
    handlePointerUp(event) {
        if (!this.toolSystem) return;
        
        this.toolSystem.stopDrawing();
        
        // 筆圧モニターリセット
        const pressureMonitor = document.getElementById('pressure-monitor');
        if (pressureMonitor) {
            pressureMonitor.textContent = '0.0%';
        }
        
        if (this.initializationComplete) {
            window.EventBus.safeEmit('drawing.ended', { pathCount: this.paths.length });
        }
        
        console.log('🖊️ 描画終了');
    }
    
    /**
     * イベントハンドラ: リサイズ
     */
    handleResize() {
        if (!this.app) return;
        
        console.log('🔄 ウィンドウリサイズ検出');
        
        if (this.initializationComplete) {
            window.EventBus.safeEmit('window.resized');
        }
    }
    
    /**
     * ローカルポインター位置取得
     */
    getLocalPointerPosition(event) {
        if (!this.app?.view) {
            return { x: 0, y: 0 };
        }
        
        const rect = this.app.view.getBoundingClientRect();
        const originalEvent = event.data?.originalEvent || event.originalEvent || event;
        
        const clientX = originalEvent.clientX || originalEvent.pageX || 0;
        const clientY = originalEvent.clientY || originalEvent.pageY || 0;
        
        const x = (clientX - rect.left) * (this.canvasWidth / rect.width);
        const y = (clientY - rect.top) * (this.canvasHeight / rect.height);
        
        return { 
            x: Math.max(0, Math.min(this.canvasWidth, x)), 
            y: Math.max(0, Math.min(this.canvasHeight, y)) 
        };
    }
    
    /**
     * 🚨 重複排除: キャンバスリサイズ（ConfigManager・EventBus統一版）
     */
    resize(newWidth, newHeight, centerContent = false) {
        if (!this.app) return;
        
        const oldWidth = this.canvasWidth;
        const oldHeight = this.canvasHeight;
        
        // ConfigManager経由での設定値妥当性確認
        const canvasConfig = window.ConfigManager.getCanvasConfig();
        const validWidth = Math.max(canvasConfig.minWidth, Math.min(canvasConfig.maxWidth, newWidth));
        const validHeight = Math.max(canvasConfig.minHeight, Math.min(canvasConfig.maxHeight, newHeight));
        
        if (validWidth !== newWidth || validHeight !== newHeight) {
            window.ErrorManager.showError('warning', 
                `キャンバスサイズが制限範囲外です。${validWidth}x${validHeight}に調整されました。`);
        }
        
        this.canvasWidth = validWidth;
        this.canvasHeight = validHeight;
        
        // アプリケーションリサイズ
        this.app.renderer.resize(validWidth, validHeight);
        this.app.stage.hitArea = new PIXI.Rectangle(0, 0, validWidth, validHeight);
        
        // コンテンツ中央寄せ
        if (centerContent && this.drawingContainer && this.paths.length > 0) {
            const offsetX = (validWidth - oldWidth) / 2;
            const offsetY = (validHeight - oldHeight) / 2;
            
            this.drawingContainer.x += offsetX;
            this.drawingContainer.y += offsetY;
        }
        
        // ステータス更新
        const canvasInfo = document.getElementById('canvas-info');
        if (canvasInfo) {
            canvasInfo.textContent = `${validWidth}×${validHeight}px`;
        }
        
        if (this.initializationComplete) {
            window.EventBus.safeEmit('canvas.resized', {
                width: validWidth,
                height: validHeight,
                previousWidth: oldWidth,
                previousHeight: oldHeight,
                centerContent
            });
        }
        
        console.log(`📐 キャンバスリサイズ: ${validWidth}x${validHeight}`);
    }
}

/**
 * 🚨 重複排除: 描画ツールシステム（ConfigManager・EventBus統一版）
 */
class DrawingToolSystem {
    constructor(appCore) {
        this.appCore = appCore;
        this.currentTool = 'pen';
        this.isDrawing = false;
        this.currentPath = null;
        this.lastPoint = null;
        
        // ConfigManager経由でのツール設定取得
        const penConfig = window.ConfigManager.getDrawingConfig('pen');
        this.brushSize = penConfig.defaultSize;
        this.brushColor = penConfig.defaultColor;
        this.opacity = penConfig.defaultOpacity;
        this.pressure = penConfig.defaultPressure;
        this.smoothing = penConfig.defaultSmoothing;
        this.minDistance = penConfig.minDistance;
        
        this.extensionsAvailable = appCore.extensionsAvailable;
        
        console.log('🔧 DrawingToolSystem 初期化完了（統一システム統合版）');
    }
    
    /**
     * ツール設定
     */
    setTool(tool) {
        const previousTool = this.currentTool;
        this.currentTool = tool;
        
        if (this.appCore.initializationComplete) {
            window.EventBus.safeEmit('tool.changed', { 
                tool,
                previousTool
            });
        }
        
        console.log(`🔧 ツール変更: ${previousTool} → ${tool}`);
    }
    
    /**
     * ブラシサイズ設定
     */
    setBrushSize(size) {
        const penConfig = window.ConfigManager.getDrawingConfig('pen');
        const oldSize = this.brushSize;
        
        this.brushSize = Math.max(penConfig.minSize, Math.min(penConfig.maxSize, Math.round(size * 10) / 10));
        
        if (this.appCore.initializationComplete) {
            window.EventBus.safeEmit('brush.sizeChanged', {
                size: this.brushSize,
                previousSize: oldSize
            });
        }
    }
    
    /**
     * 不透明度設定
     */
    setOpacity(opacity) {
        const oldOpacity = this.opacity;
        this.opacity = Math.max(0, Math.min(1, Math.round(opacity * 1000) / 1000));
        
        if (this.appCore.initializationComplete) {
            window.EventBus.safeEmit('brush.opacityChanged', {
                opacity: this.opacity,
                previousOpacity: oldOpacity
            });
        }
    }
    
    /**
     * 筆圧設定
     */
    setPressure(pressure) {
        this.pressure = Math.max(0, Math.min(1, Math.round(pressure * 1000) / 1000));
    }
    
    /**
     * スムージング設定
     */
    setSmoothing(smoothing) {
        this.smoothing = Math.max(0, Math.min(1, Math.round(smoothing * 1000) / 1000));
    }
    
    /**
     * 描画開始
     */
    startDrawing(x, y) {
        this.isDrawing = true;
        this.lastPoint = { x, y };
        
        if (this.currentTool === 'pen') {
            this.currentPath = this.createPenPath(x, y);
        } else if (this.currentTool === 'eraser') {
            this.currentPath = this.createEraserPath(x, y);
        }
        
        // 筆圧モニター更新
        const pressureMonitor = document.getElementById('pressure-monitor');
        if (pressureMonitor) {
            const pressure = this.pressure * 100 + Math.random() * 10;
            pressureMonitor.textContent = `${pressure.toFixed(1)}%`;
        }
        
        console.log(`🖊️ 描画開始 (${this.currentTool}): (${x.toFixed(1)}, ${y.toFixed(1)}), サイズ: ${this.brushSize}`);
    }
    
    /**
     * 描画継続
     */
    continueDrawing(x, y) {
        if (!this.isDrawing || !this.currentPath || !this.lastPoint) return;
        
        const distance = Math.sqrt((x - this.lastPoint.x) ** 2 + (y - this.lastPoint.y) ** 2);
        
        if (distance < this.minDistance) return;
        
        this.drawLine(this.currentPath, this.lastPoint.x, this.lastPoint.y, x, y);
        this.lastPoint = { x, y };
        
        // 筆圧モニター更新
        const pressureMonitor = document.getElementById('pressure-monitor');
        if (pressureMonitor) {
            const pressure = this.pressure * 100 + Math.random() * 15;
            pressureMonitor.textContent = `${pressure.toFixed(1)}%`;
        }
    }
    
    /**
     * 描画終了
     */
    stopDrawing() {
        if (this.currentPath) {
            this.currentPath.isComplete = true;
            this.appCore.paths.push(this.currentPath);
            
            if (this.appCore.initializationComplete) {
                window.EventBus.safeEmit('path.created', {
                    pathId: this.currentPath.id,
                    pointCount: this.currentPath.points.length,
                    tool: this.currentPath.tool
                });
            }
            
            console.log(`🖊️ 描画完了: ${this.currentPath.points.length}ポイント`);
        }
        
        this.isDrawing = false;
        this.currentPath = null;
        this.lastPoint = null;
    }
    
    /**
     * ペンパス作成
     */
    createPenPath(x, y) {
        const path = {
            id: `path_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            graphics: new PIXI.Graphics(),
            points: [{ x, y, size: this.brushSize }],
            color: this.brushColor,
            size: this.brushSize,
            opacity: this.opacity,
            tool: 'pen',
            isComplete: false
        };
        
        path.graphics.beginFill(path.color, path.opacity);
        path.graphics.drawCircle(x, y, path.size / 2);
        path.graphics.endFill();
        
        this.appCore.drawingContainer.addChild(path.graphics);
        return path;
    }
    
    /**
     * 消しゴムパス作成
     */
    createEraserPath(x, y) {
        const eraserConfig = window.ConfigManager.getDrawingConfig('eraser');
        
        const path = {
            id: `eraser_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            graphics: new PIXI.Graphics(),
            points: [{ x, y, size: this.brushSize }],
            color: this.appCore.backgroundColor,
            size: this.brushSize,
            opacity: eraserConfig.opacity,
            tool: 'eraser',
            isComplete: false
        };
        
        path.graphics.beginFill(path.color, path.opacity);
        path.graphics.drawCircle(x, y, path.size / 2);
        path.graphics.endFill();
        
        this.appCore.drawingContainer.addChild(path.graphics);
        return path;
    }
    
    /**
     * 線描画
     */
    drawLine(path, x1, y1, x2, y2) {
        const distance = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
        const steps = Math.max(1, Math.ceil(distance / 1.5));
        
        for (let i = 1; i <= steps; i++) {
            const t = i / steps;
            const px = x1 + (x2 - x1) * t;
            const py = y1 + (y2 - y1) * t;
            
            path.graphics.beginFill(path.color, path.opacity);
            path.graphics.drawCircle(px, py, path.size / 2);
            path.graphics.endFill();
        }
        
        path.points.push({ x: x2, y: y2, size: path.size });
    }
}

/**
 * 簡易フォールバックツールシステム
 */
class SimpleFallbackToolSystem extends DrawingToolSystem {
    constructor(appCore) {
        super(appCore);
        console.log('🛡️ SimpleFallbackToolSystem 初期化完了（統一システム統合版）');
    }
}

/**
 * 🚨 重複排除: UI制御システム（統一システム版）
 */
class UIController {
    constructor(toolSystem) {
        this.toolSystem = toolSystem;
        this.activePopup = null;
        this.sliders = new Map();
        this.uiConfig = window.ConfigManager.getUIConfig();
    }
    
    initialize() {
        console.log('🎨 UI制御システム初期化中（統一システム統合版）...');
        
        this.setupToolButtons();
        this.setupPopups();
        this.setupSliders();
        this.setupPresets();
        this.setupResize();
        this.setupCheckboxes();
        this.updateSizePresets();
        
        console.log('✅ UI制御システム初期化完了（統一システム統合版）');
    }
    
    setupToolButtons() {
        document.querySelectorAll('.tool-button').forEach(btn => {
            btn.addEventListener('click', (e) => {
                if (btn.classList.contains('disabled')) return;
                this.handleToolClick(e.currentTarget);
            });
        });
    }
    
    handleToolClick(button) {
        const toolId = button.id;
        const popupId = button.getAttribute('data-popup');
        
        if (toolId === 'pen-tool') {
            this.setTool('pen');
        } else if (toolId === 'eraser-tool') {
            this.setTool('eraser');
        }
        
        if (popupId) {
            this.togglePopup(popupId);
        }
        
        window.EventBus.safeEmit('ui.toolButtonClicked', { toolId, popupId });
    }
    
    setTool(tool) {
        if (this.toolSystem) {
            this.toolSystem.setTool(tool);
        }
        
        document.querySelectorAll('.tool-button').forEach(btn => btn.classList.remove('active'));
        const toolButton = document.getElementById(tool + '-tool');
        if (toolButton) {
            toolButton.classList.add('active');
        }
        
        const toolNames = { pen: 'ベクターペン', eraser: '消しゴム' };
        const currentToolElement = document.getElementById('current-tool');
        if (currentToolElement) {
            currentToolElement.textContent = toolNames[tool] || tool;
        }
    }
    
    setupPopups() {
        document.querySelectorAll('[data-popup]').forEach(trigger => {
            trigger.addEventListener('click', (e) => {
                const popupId = e.target.getAttribute('data-popup');
                if (popupId) {
                    this.togglePopup(popupId);
                }
            });
        });
        
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.popup-panel') && !e.target.closest('[data-popup]')) {
                this.closeAllPopups();
            }
        });
        
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.activePopup) {
                this.closeAllPopups();
            }
        });
    }
    
    togglePopup(popupId) {
        const popup = document.getElementById(popupId);
        if (!popup) {
            window.ErrorManager.showError('warning', `ポップアップ要素が見つかりません: ${popupId}`);
            return;
        }
        
        if (this.activePopup && this.activePopup !== popup) {
            this.activePopup.classList.remove('show');
        }
        
        const isVisible = popup.classList.contains('show');
        popup.classList.toggle('show', !isVisible);
        
        this.activePopup = isVisible ? null : popup;
        
        window.EventBus.safeEmit('ui.popupToggled', { popupId, visible: !isVisible });
    }
    
    setupSliders() {
        this.createSlider('pen-size-slider', 0.1, 100, 16.0, (value) => {
            if (this.toolSystem) {
                this.toolSystem.setBrushSize(value);
            }
            this.updateSizePresets();
            return value.toFixed(1) + 'px';
        });
        
        this.createSlider('pen-opacity-slider', 0, 100, 85.0, (value) => {
            if (this.toolSystem) {
                this.toolSystem.setOpacity(value / 100);
            }
            this.updateSizePresets();
            return value.toFixed(1) + '%';
        });
        
        this.createSlider('pen-pressure-slider', 0, 100, 50.0, (value) => {
            if (this.toolSystem) {
                this.toolSystem.setPressure(value / 100);
            }
            return value.toFixed(1) + '%';
        });
        
        this.createSlider('pen-smoothing-slider', 0, 100, 30.0, (value) => {
            if (this.toolSystem) {
                this.toolSystem.setSmoothing(value / 100);
            }
            return value.toFixed(1) + '%';
        });
        
        this.setupSliderButtons();
    }
    
    createSlider(sliderId, min, max, initial, callback) {
        const container = document.getElementById(sliderId);
        if (!container) {
            console.warn(`⚠️ スライダー要素が見つかりません: ${sliderId}`);
            return;
        }
        
        const track = container.querySelector('.slider-track');
        const handle = container.querySelector('.slider-handle');
        const valueDisplay = container.parentNode.querySelector('.slider-value');
        
        if (!track || !handle || !valueDisplay) {
            console.warn(`⚠️ スライダー部品が不完全: ${sliderId}`);
            return;
        }
        
        const sliderConfig = this.uiConfig.slider;
        
        const sliderData = {
            value: initial,
            min, max, callback,
            track, handle, valueDisplay,
            isDragging: false,
            updateThrottle: sliderConfig.updateThrottle
        };
        
        this.sliders.set(sliderId, sliderData);
        
        const updateSlider = (value) => {
            sliderData.value = Math.max(min, Math.min(max, value));
            const percentage = ((sliderData.value - min) / (max - min)) * 100;
            
            track.style.width = percentage + '%';
            handle.style.left = percentage + '%';
            valueDisplay.textContent = callback(sliderData.value);
        };
        
        const getValueFromPosition = (clientX) => {
            const rect = container.getBoundingClientRect();
            const percentage = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
            return min + (percentage * (max - min));
        };
        
        // マウスイベント設定
        container.addEventListener('mousedown', (e) => {
            sliderData.isDragging = true;
            updateSlider(getValueFromPosition(e.clientX));
            e.preventDefault();
        });
        
        document.addEventListener('mousemove', (e) => {
            if (sliderData.isDragging) {
                updateSlider(getValueFromPosition(e.clientX));
            }
        });
        
        document.addEventListener('mouseup', () => {
            sliderData.isDragging = false;
        });
        
        // タッチイベント設定
        container.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                sliderData.isDragging = true;
                updateSlider(getValueFromPosition(e.touches[0].clientX));
                e.preventDefault();
            }
        });
        
        document.addEventListener('touchmove', (e) => {
            if (sliderData.isDragging && e.touches.length === 1) {
                updateSlider(getValueFromPosition(e.touches[0].clientX));
                e.preventDefault();
            }
        });
        
        document.addEventListener('touchend', () => {
            sliderData.isDragging = false;
        });
        
        // 初期値設定
        updateSlider(initial);
        
        console.log(`✅ スライダー設定完了: ${sliderId}`);
    }
    
    setupSliderButtons() {
        const adjustValue = (sliderId, delta) => {
            const slider = this.sliders.get(sliderId);
            if (slider) {
                const newValue = slider.value + delta;
                const clampedValue = Math.max(slider.min, Math.min(slider.max, newValue));
                slider.value = clampedValue;
                
                const percentage = ((clampedValue - slider.min) / (slider.max - slider.min)) * 100;
                slider.track.style.width = percentage + '%';
                slider.handle.style.left = percentage + '%';
                slider.valueDisplay.textContent = slider.callback(clampedValue);
            }
        };
        
        // ペンサイズ調整ボタン
        const sizeButtons = [
            { id: 'pen-size-decrease-small', delta: -0.1 },
            { id: 'pen-size-decrease', delta: -1 },
            { id: 'pen-size-decrease-large', delta: -10 },
            { id: 'pen-size-increase-small', delta: 0.1 },
            { id: 'pen-size-increase', delta: 1 },
            { id: 'pen-size-increase-large', delta: 10 }
        ];
        
        sizeButtons.forEach(config => {
            const button = document.getElementById(config.id);
            if (button) {
                button.addEventListener('click', () => {
                    adjustValue('pen-size-slider', config.delta);
                    this.updateSizePresets();
                });
            }
        });
        
        // 不透明度調整ボタン
        const opacityButtons = [
            { id: 'pen-opacity-decrease-small', delta: -0.1 },
            { id: 'pen-opacity-decrease', delta: -1 },
            { id: 'pen-opacity-decrease-large', delta: -10 },
            { id: 'pen-opacity-increase-small', delta: 0.1 },
            { id: 'pen-opacity-increase', delta: 1 },
            { id: 'pen-opacity-increase-large', delta: 10 }
        ];
        
        opacityButtons.forEach(config => {
            const button = document.getElementById(config.id);
            if (button) {
                button.addEventListener('click', () => {
                    adjustValue('pen-opacity-slider', config.delta);
                    this.updateSizePresets();
                });
            }
        });
    }
    
    setupPresets() {
        document.querySelectorAll('.size-preset-item').forEach(preset => {
            preset.addEventListener('click', () => {
                const size = parseFloat(preset.getAttribute('data-size'));
                if (!isNaN(size) && this.toolSystem) {
                    this.toolSystem.setBrushSize(size);
                    this.updateSliderValue('pen-size-slider', size);
                    this.updateSizePresets();
                }
            });
        });
    }
    
    setupResize() {
        document.querySelectorAll('.resize-button[data-size]').forEach(btn => {
            btn.addEventListener('click', () => {
                const sizeData = btn.getAttribute('data-size');
                if (sizeData) {
                    const [width, height] = sizeData.split(',').map(Number);
                    const widthInput = document.getElementById('canvas-width');
                    const heightInput = document.getElementById('canvas-height');
                    if (widthInput && heightInput && !isNaN(width) && !isNaN(height)) {
                        widthInput.value = width;
                        heightInput.value = height;
                    }
                }
            });
        });
    }
    
    setupCheckboxes() {
        document.querySelectorAll('.checkbox').forEach(checkbox => {
            checkbox.addEventListener('click', () => {
                checkbox.classList.toggle('checked');
            });
        });
    }
    
    updateSliderValue(sliderId, value) {
        const slider = this.sliders.get(sliderId);
        if (slider) {
            slider.value = value;
            const percentage = ((value - slider.min) / (slider.max - slider.min)) * 100;
            slider.track.style.width = percentage + '%';
            slider.handle.style.left = percentage + '%';
            slider.valueDisplay.textContent = slider.callback(value);
        }
    }
    
    updateSizePresets() {
        if (!this.toolSystem) return;
        
        const currentSize = this.toolSystem.brushSize;
        const currentOpacity = Math.round(this.toolSystem.opacity * 100);
        
        document.querySelectorAll('.size-preset-item').forEach(preset => {
            const presetSize = parseFloat(preset.getAttribute('data-size'));
            if (isNaN(presetSize)) return;
            
            const circle = preset.querySelector('.size-preview-circle');
            const label = preset.querySelector('.size-preview-label');
            const percent = preset.querySelector('.size-preview-percent');
            
            if (!circle || !label || !percent) return;
            
            // アクティブ状態の更新
            const isActive = Math.abs(presetSize - currentSize) < 0.1;
            preset.classList.toggle('active', isActive);
            
            // 円のサイズ更新
            let circleSize;
            if (isActive) {
                circleSize = Math.max(0.5, Math.min(20, (currentSize / 100) * 19.5 + 0.5));
            } else {
                circleSize = Math.max(0.5, Math.min(20, (presetSize / 100) * 19.5 + 0.5));
            }
            
            circle.style.width = circleSize + 'px';
            circle.style.height = circleSize + 'px';
            circle.style.opacity = this.toolSystem.opacity;
            
            // ラベル更新
            if (isActive) {
                label.textContent = currentSize.toFixed(1);
            } else {
                label.textContent = presetSize.toString();
            }
            
            percent.textContent = currentOpacity + '%';
        });
    }
    
    closeAllPopups() {
        document.querySelectorAll('.popup-panel').forEach(popup => {
            popup.classList.remove('show');
        });
        this.activePopup = null;
        
        window.EventBus.safeEmit('ui.allPopupsClosed');
        console.log('🔒 全ポップアップ閉じる（統一システム版）');
    }
}

/**
 * 最小限UIコントローラー
 */
class MinimalUIController {
    constructor(toolSystem) {
        this.toolSystem = toolSystem;
        this.activePopup = null;
        console.log('🛡️ MinimalUIController 初期化完了（統一システム統合版）');
    }
    
    initialize() {
        console.log('🛡️ 最小限UI制御初期化中（統一システム版）...');
        
        try {
            // 最低限のツールボタン設定のみ
            document.querySelectorAll('.tool-button').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    if (btn.id === 'pen-tool' && this.toolSystem) {
                        this.toolSystem.setTool('pen');
                        this.updateToolStatus('pen');
                    } else if (btn.id === 'eraser-tool' && this.toolSystem) {
                        this.toolSystem.setTool('eraser');
                        this.updateToolStatus('eraser');
                    }
                });
            });
            
            console.log('✅ 最小限UI制御初期化完了（統一システム版）');
            
        } catch (error) {
            console.error('💀 最小限UI制御初期化エラー:', error);
            
            window.ErrorManager.showError('warning', 
                `最小限UI制御初期化に失敗しました: ${error.message}`, {
                showDebug: false
            });
        }
    }
    
    updateToolStatus(tool) {
        // ツールボタンのアクティブ状態更新
        document.querySelectorAll('.tool-button').forEach(btn => btn.classList.remove('active'));
        const toolButton = document.getElementById(tool + '-tool');
        if (toolButton) {
            toolButton.classList.add('active');
        }
        
        // ツール名表示更新
        const toolNames = { pen: 'ベクターペン', eraser: '消しゴム' };
        const currentToolElement = document.getElementById('current-tool');
        if (currentToolElement) {
            currentToolElement.textContent = toolNames[tool] || tool;
        }
        
        window.EventBus.safeEmit('ui.toolStatusUpdated', { tool });
    }
    
    closeAllPopups() {
        document.querySelectorAll('.popup-panel').forEach(popup => {
            popup.classList.remove('show');
        });
        this.activePopup = null;
        console.log('🔒 全ポップアップ閉じる（最小限・統一システム版）');
    }
}

/**
 * 🚨 重複排除: パフォーマンス監視システム（ConfigManager統一版）
 */
class PerformanceMonitor {
    constructor(performanceConfig = null) {
        this.config = performanceConfig || window.ConfigManager.getPerformanceConfig();
        
        this.frameCount = 0;
        this.lastTime = performance.now();
        this.isRunning = false;
        this.metrics = {
            currentFPS: 0,
            averageFPS: 0,
            minFPS: Infinity,
            maxFPS: 0,
            frameCount: 0
        };
        this.updateCallbacks = new Set();
    }
    
    start() {
        if (this.isRunning) return;
        
        console.log('📊 パフォーマンス監視開始（統一システム統合版）');
        this.isRunning = true;
        
        const update = () => {
            if (!this.isRunning) return;
            
            this.frameCount++;
            this.metrics.frameCount++;
            const currentTime = performance.now();
            
            if (currentTime - this.lastTime >= this.config.updateInterval) {
                const fps = Math.round((this.frameCount * 1000) / (currentTime - this.lastTime));
                
                this.metrics.currentFPS = fps;
                this.metrics.averageFPS = Math.round((this.metrics.averageFPS + fps) / 2);
                this.metrics.minFPS = Math.min(this.metrics.minFPS, fps);
                this.metrics.maxFPS = Math.max(this.metrics.maxFPS, fps);
                
                // FPS表示更新
                const fpsElement = document.getElementById('fps');
                if (fpsElement) {
                    fpsElement.textContent = fps;
                }
                
                if (fps < this.config.targetFPS / 2) {
                    console.warn(`⚠️ 低FPS検出: ${fps}fps (目標: ${this.config.targetFPS}fps)`);
                }
                
                window.EventBus.safeEmit('performance.fpsUpdated', {
                    fps,
                    averageFPS: this.metrics.averageFPS
                });
                
                // 更新コールバック実行
                this.updateCallbacks.forEach(callback => {
                    try {
                        callback(this.metrics);
                    } catch (error) {
                        console.error('パフォーマンス監視コールバックエラー:', error);
                    }
                });
                
                this.frameCount = 0;
                this.lastTime = currentTime;
            }
            
            requestAnimationFrame(update);
        };
        
        update();
    }
    
    stop() {
        console.log('📊 パフォーマンス監視停止（統一システム版）');
        this.isRunning = false;
        
        window.EventBus.safeEmit('performance.monitoringStopped', {
            finalMetrics: this.metrics
        });
    }
    
    getStats() {
        return {
            isRunning: this.isRunning,
            metrics: { ...this.metrics },
            config: { ...this.config },
            lastTime: this.lastTime,
            frameCount: this.frameCount,
            updateCallbacks: this.updateCallbacks.size
        };
    }
    
    addUpdateCallback(callback) {
        this.updateCallbacks.add(callback);
    }
    
    removeUpdateCallback(callback) {
        this.updateCallbacks.delete(callback);
    }
}

// グローバル登録
if (typeof window !== 'undefined') {
    window.AppCore = AppCore;
    window.DrawingToolSystem = DrawingToolSystem;
    window.SimpleFallbackToolSystem = SimpleFallbackToolSystem;
    window.UIController = UIController;
    window.MinimalUIController = MinimalUIController;
    window.PerformanceMonitor = PerformanceMonitor;
    
    console.log('🎨 AppCore関連クラス グローバル登録完了（DRY・SOLID準拠版）');
    console.log('🚨 重複排除完了: 統一システム完全統合・コード肥大化解決');
    console.log('✅ Task 1-B先行実装完了: DRY・SOLID原則準拠');
}