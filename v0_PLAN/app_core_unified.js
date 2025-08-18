/**
 * 🎨 ふたば☆お絵描きツール - 統一システム完全統合版AppCore
 * 🎯 AI_WORK_SCOPE: PixiJSアプリケーション基盤・統一システム完全活用
 * 🎯 DEPENDENCIES: ConfigManager, ErrorManager, StateManager, EventBus, PixiJS
 * 🎯 NODE_MODULES: pixi.js（Graphics, Container, Application使用）
 * 🎯 PIXI_EXTENSIONS: 条件付き使用・フォールバック対応
 * 🎯 ISOLATION_TEST: ❌ 統一システム依存
 * 🎯 SPLIT_THRESHOLD: 400行（統一化により大幅削減）
 * 
 * 📋 PHASE_TARGET: Phase1統一化完了版
 * 📋 V8_MIGRATION: ConfigManager経由でv8対応準備済み
 * 📋 PERFORMANCE_TARGET: 60FPS安定描画・3秒以内初期化
 * 
 * 🔧 統一化内容:
 * - ConfigManager完全活用（全設定値統一）
 * - ErrorManager完全活用（全エラー処理統一）
 * - StateManager連携（状態管理統一）
 * - EventBus完全活用（循環依存排除）
 * - DRY原則準拠（重複コード排除）
 * - SOLID原則準拠（単一責任・依存注入）
 */

/**
 * 統一システム完全統合版AppCore
 * 全設定値・エラー処理・状態管理を統一システム経由で実行
 */
class AppCore {
    constructor() {
        console.log('🎨 AppCore 統一版初期化開始...');
        
        // 統一システム依存確認
        this.validateUnifiedSystems();
        
        // ConfigManager経由で設定取得（統一化）
        this.config = {
            canvas: window.ConfigManager.getCanvasConfig(),
            pixi: window.ConfigManager.getPixiConfig(),
            drawing: window.ConfigManager.getDrawingConfig(),
            performance: window.ConfigManager.getPerformanceConfig(),
            colors: window.ConfigManager.getColors(),
            v8: window.ConfigManager.getV8Config()
        };
        
        // PixiJS関連
        this.app = null;
        this.drawingContainer = null;
        this.uiContainer = null;
        
        // 統一設定から初期化
        this.canvasWidth = this.config.canvas.width;
        this.canvasHeight = this.config.canvas.height;
        this.backgroundColor = this.config.canvas.backgroundColor;
        
        // 描画システム
        this.paths = [];
        this.toolSystem = null;
        this.uiController = null;
        this.performanceMonitor = null;
        
        // 統一フラグ
        this.extensionsAvailable = false;
        this.fallbackMode = false;
        this.isInitialized = false;
        
        console.log('✅ AppCore 統一版コンストラクタ完了');
    }
    
    /**
     * 統一システム依存確認
     */
    validateUnifiedSystems() {
        const requiredSystems = ['ConfigManager', 'ErrorManager', 'StateManager', 'EventBus'];
        const missing = requiredSystems.filter(name => !window[name]);
        
        if (missing.length > 0) {
            const error = new Error(`統一システム未初期化: ${missing.join(', ')}`);
            console.error('💀 AppCore統一版初期化失敗:', error);
            throw error;
        }
        
        console.log('✅ 統一システム依存確認完了');
    }
    
    /**
     * 統一初期化シーケンス
     */
    async initialize() {
        try {
            console.log('🚀 AppCore統一版初期化シーケンス開始...');
            
            // Step 1: DOM要素確認
            this.verifyDOMElements();
            
            // Step 2: 拡張機能確認
            this.checkExtensions();
            
            // Step 3: PixiJS Application統一初期化
            await this.initializePixiApp();
            
            // Step 4: コンテナ初期化
            this.initializeContainers();
            
            // Step 5: サブシステム統一初期化
            await this.initializeSubsystems();
            
            // Step 6: イベント統合
            this.setupUnifiedEventSystem();
            
            // Step 7: 初期化完了確認
            this.verifyInitialization();
            
            this.isInitialized = true;
            console.log('🎉 AppCore統一版初期化完了！');
            
            // EventBus通知（統一化）
            window.EventBus.emit(window.EventBus.Events.INITIALIZATION_COMPLETED, {
                component: 'AppCore',
                unified: true,
                config: this.config,
                features: this.getFeatureStatus()
            });
            
        } catch (error) {
            console.error('💀 AppCore統一版初期化エラー:', error);
            
            // 統一エラー処理
            window.ErrorManager.showError('error', `AppCore初期化失敗: ${error.message}`, {
                showReload: true,
                additionalInfo: 'AppCore統一版初期化時のエラー'
            });
            
            // フォールバック初期化試行
            await this.initializeFallbackMode(error);
        }
    }
    
    /**
     * DOM要素確認（統一版）
     */
    verifyDOMElements() {
        console.log('🔍 DOM要素確認（統一版）...');
        
        const canvasElement = document.getElementById('drawing-canvas');
        if (!canvasElement) {
            throw new Error('drawing-canvas 要素が見つかりません');
        }
        
        // 要素クリア
        while (canvasElement.firstChild) {
            canvasElement.removeChild(canvasElement.firstChild);
        }
        
        console.log('✅ DOM要素確認完了（統一版）');
    }
    
    /**
     * 拡張機能確認（統一版）
     */
    checkExtensions() {
        console.log('🔍 拡張機能確認（統一版）...');
        
        if (window.PixiExtensions?.initialized) {
            this.extensionsAvailable = true;
            const stats = window.PixiExtensions.getStats();
            console.log(`✅ 拡張機能利用可能: ${stats.available}/${stats.total}`);
            
            if (stats.fallbackMode) {
                console.warn('⚠️ 拡張機能フォールバックモード');
                window.ErrorManager.showError('warning', '拡張機能の一部が制限されています');
                this.fallbackMode = true;
            }
        } else {
            console.warn('⚠️ 拡張機能未初期化');
            this.fallbackMode = true;
        }
        
        console.log('✅ 拡張機能確認完了（統一版）');
    }
    
    /**
     * PixiJS Application統一初期化
     */
    async initializePixiApp() {
        console.log('🎮 PixiJS Application統一初期化中...');
        
        try {
            // v8移行対応準備
            const v8Config = this.config.v8;
            
            if (v8Config.enabled && v8Config.apiChanges.applicationInit) {
                // v8用初期化（将来実装）
                console.log('🚀 PixiJS v8初期化モード（準備中）');
                // this.app = await PIXI.Application.init(appConfig);
            } else {
                // v7用初期化（現在）
                const appConfig = {
                    width: this.config.canvas.width,
                    height: this.config.canvas.height,
                    backgroundColor: this.config.canvas.backgroundColor,
                    antialias: this.config.pixi.antialias,
                    resolution: this.config.pixi.resolution,
                    autoDensity: this.config.pixi.autoDensity
                };
                
                console.log('🎮 PixiJS v7初期化設定:', appConfig);
                this.app = new PIXI.Application(appConfig);
            }
            
            // DOM接続
            const canvasElement = document.getElementById('drawing-canvas');
            canvasElement.appendChild(this.app.view);
            
            // スタイル設定（統一版）
            this.app.view.style.display = 'block';
            this.app.view.style.cursor = this.config.pixi.cursor;
            
            // 接続確認
            if (!canvasElement.contains(this.app.view)) {
                throw new Error('PixiJS キャンバスDOM接続失敗');
            }
            
            console.log('✅ PixiJS Application統一初期化完了');
            console.log(`📏 キャンバス: ${this.app.view.width}×${this.app.view.height}`);
            
        } catch (error) {
            window.ErrorManager.showError('error', `PixiJS初期化エラー: ${error.message}`);
            throw error;
        }
    }
    
    /**
     * コンテナ初期化（統一版）
     */
    initializeContainers() {
        console.log('📦 コンテナ初期化（統一版）...');
        
        // 描画コンテナ
        this.drawingContainer = new PIXI.Container();
        this.drawingContainer.name = 'drawing-layer';
        this.app.stage.addChild(this.drawingContainer);
        
        // UIコンテナ
        this.uiContainer = new PIXI.Container();
        this.uiContainer.name = 'ui-layer';
        this.app.stage.addChild(this.uiContainer);
        
        // インタラクション設定
        this.app.stage.interactive = true;
        this.app.stage.hitArea = new PIXI.Rectangle(0, 0, this.canvasWidth, this.canvasHeight);
        
        console.log('✅ コンテナ初期化完了（統一版）');
    }
    
    /**
     * サブシステム統一初期化
     */
    async initializeSubsystems() {
        console.log('🔧 サブシステム統一初期化...');
        
        // DrawingToolSystem統一版初期化
        this.toolSystem = new DrawingToolSystem(this);
        await this.toolSystem.initialize();
        
        // UIController統一版初期化
        this.uiController = new UIController(this.toolSystem);
        await this.uiController.initialize();
        
        // PerformanceMonitor統一版初期化
        this.performanceMonitor = new PerformanceMonitor();
        await this.performanceMonitor.initialize();
        
        console.log('✅ サブシステム統一初期化完了');
    }
    
    /**
     * 統一イベントシステム設定
     */
    setupUnifiedEventSystem() {
        console.log('📡 統一イベントシステム設定...');
        
        // PixiJSイベント → EventBus変換
        this.app.stage.on('pointerdown', (event) => {
            const point = this.getLocalPointerPosition(event);
            window.EventBus.emit(window.EventBus.Events.DRAWING_STARTED, { x: point.x, y: point.y });
        });
        
        this.app.stage.on('pointermove', (event) => {
            const point = this.getLocalPointerPosition(event);
            this.updateCoordinateDisplay(point.x, point.y);
            
            if (this.toolSystem?.isDrawing) {
                window.EventBus.emit(window.EventBus.Events.DRAWING_CONTINUED, { x: point.x, y: point.y });
            }
        });
        
        this.app.stage.on('pointerup', () => {
            window.EventBus.emit(window.EventBus.Events.DRAWING_ENDED, {});
        });
        
        this.app.stage.on('pointerupoutside', () => {
            window.EventBus.emit(window.EventBus.Events.DRAWING_ENDED, {});
        });
        
        // EventBusリスナー設定（循環依存排除）
        window.EventBus.on(window.EventBus.Events.DRAWING_STARTED, (data) => {
            this.toolSystem?.startDrawing(data.x, data.y);
        });
        
        window.EventBus.on(window.EventBus.Events.DRAWING_CONTINUED, (data) => {
            this.toolSystem?.continueDrawing(data.x, data.y);
        });
        
        window.EventBus.on(window.EventBus.Events.DRAWING_ENDED, () => {
            this.toolSystem?.stopDrawing();
        });
        
        // リサイズイベント統合
        window.addEventListener('resize', () => {
            window.EventBus.emit('windowResized', {
                width: window.innerWidth,
                height: window.innerHeight
            });
        });
        
        console.log('✅ 統一イベントシステム設定完了');
    }
    
    /**
     * 座標表示更新（統一版）
     */
    updateCoordinateDisplay(x, y) {
        const coordElement = document.getElementById('coordinates');
        if (coordElement) {
            coordElement.textContent = `x: ${Math.round(x)}, y: ${Math.round(y)}`;
        }
    }
    
    /**
     * ローカルポインター位置取得（統一版）
     */
    getLocalPointerPosition(event) {
        if (!this.app?.view) return { x: 0, y: 0 };
        
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
     * キャンバスリサイズ（統一版）
     */
    resize(newWidth, newHeight, centerContent = false) {
        console.log(`📐 キャンバスリサイズ統一版: ${newWidth}×${newHeight}`);
        
        try {
            // ConfigManager妥当性確認
            if (!window.ConfigManager.validate('canvas.width', newWidth) ||
                !window.ConfigManager.validate('canvas.height', newHeight)) {
                throw new Error(`無効なキャンバスサイズ: ${newWidth}×${newHeight}`);
            }
            
            const oldWidth = this.canvasWidth;
            const oldHeight = this.canvasHeight;
            
            // 設定値更新
            this.canvasWidth = newWidth;
            this.canvasHeight = newHeight;
            
            // PixiJS Application リサイズ
            this.app.renderer.resize(newWidth, newHeight);
            this.app.stage.hitArea = new PIXI.Rectangle(0, 0, newWidth, newHeight);
            
            // コンテンツ中央寄せ
            if (centerContent && this.paths.length > 0) {
                const offsetX = (newWidth - oldWidth) / 2;
                const offsetY = (newHeight - oldHeight) / 2;
                
                this.drawingContainer.x += offsetX;
                this.drawingContainer.y += offsetY;
            }
            
            // EventBus通知
            window.EventBus.emit(window.EventBus.Events.CANVAS_RESIZED, {
                width: newWidth,
                height: newHeight,
                centerContent,
                oldWidth,
                oldHeight
            });
            
            console.log('✅ キャンバスリサイズ完了（統一版）');
            
        } catch (error) {
            window.ErrorManager.showError('error', `キャンバスリサイズ失敗: ${error.message}`);
            throw error;
        }
    }
    
    /**
     * フォールバックモード初期化（統一版）
     */
    async initializeFallbackMode(originalError) {
        console.log('🛡️ フォールバック統一版初期化...');
        
        try {
            this.fallbackMode = true;
            
            // 最小限PixiJS初期化
            if (!this.app) {
                this.app = new PIXI.Application({
                    width: this.config.canvas.width,
                    height: this.config.canvas.height,
                    backgroundColor: this.config.canvas.backgroundColor,
                    antialias: true
                });
                
                const canvasElement = document.getElementById('drawing-canvas');
                if (canvasElement) {
                    canvasElement.appendChild(this.app.view);
                }
            }
            
            // 基本コンテナ
            if (!this.drawingContainer) {
                this.initializeContainers();
            }
            
            // 簡易ツールシステム
            this.toolSystem = new SimpleFallbackToolSystem(this);
            
            // 回復メッセージ（統一版）
            window.ErrorManager.showError('recovery', 
                '基本描画機能は利用可能です。高度な機能が一部制限されています。', {
                duration: 8000
            });
            
            console.log('✅ フォールバック統一版初期化完了');
            
        } catch (fallbackError) {
            console.error('💀 フォールバック統一版も失敗:', fallbackError);
            
            window.ErrorManager.showError('critical', originalError.message, {
                additionalInfo: `フォールバック失敗: ${fallbackError.message}`,
                showDebug: true
            });
        }
    }
    
    /**
     * 初期化完了確認（統一版）
     */
    verifyInitialization() {
        console.log('🔍 初期化完了確認（統一版）...');
        
        const checks = {
            pixiApp: !!this.app,
            canvasInDOM: document.getElementById('drawing-canvas')?.contains(this.app?.view),
            drawingContainer: !!this.drawingContainer,
            toolSystem: !!this.toolSystem,
            uiController: !!this.uiController,
            performanceMonitor: !!this.performanceMonitor,
            unifiedSystems: ['ConfigManager', 'ErrorManager', 'StateManager', 'EventBus']
                .every(name => !!window[name])
        };
        
        const passed = Object.values(checks).filter(Boolean).length;
        const total = Object.keys(checks).length;
        const score = Math.round((passed / total) * 100);
        
        console.log('🔍 統一版初期化検証:', checks);
        console.log(`✅ 検証完了: ${passed}/${total} (${score}%)`);
        
        if (score < 85) {
            const failed = Object.entries(checks)
                .filter(([key, value]) => !value)
                .map(([key]) => key);
            console.warn('⚠️ 初期化未完了:', failed);
        }
        
        // キャンバス表示最終確認
        if (checks.canvasInDOM) {
            console.log('🎉 キャンバス表示確認完了（統一版）');
        } else {
            throw new Error('キャンバス表示確認失敗（統一版）');
        }
    }
    
    /**
     * 機能状態取得（統一版）
     */
    getFeatureStatus() {
        return {
            pixiApp: !!this.app,
            drawingContainer: !!this.drawingContainer,
            toolSystem: !!this.toolSystem,
            uiController: !!this.uiController,
            performanceMonitor: !!this.performanceMonitor,
            extensionsAvailable: this.extensionsAvailable,
            fallbackMode: this.fallbackMode,
            unifiedSystems: {
                config: !!window.ConfigManager,
                error: !!window.ErrorManager,
                state: !!window.StateManager,
                events: !!window.EventBus
            },
            canvasSize: `${this.canvasWidth}×${this.canvasHeight}`,
            pathCount: this.paths.length,
            isInitialized: this.isInitialized
        };
    }
    
    /**
     * 統合デバッグ情報
     */
    getUnifiedDebugInfo() {
        return {
            appCore: this.getFeatureStatus(),
            config: window.ConfigManager?.getDebugInfo(),
            errors: window.ErrorManager?.getErrorStats(),
            state: window.StateManager?.healthCheck(),
            events: window.EventBus?.getStats()
        };
    }
}

/**
 * 統一版描画ツールシステム
 * ConfigManager・EventBus完全活用
 */
class DrawingToolSystem {
    constructor(appCore) {
        this.appCore = appCore;
        
        // ConfigManager経由設定取得（統一化）
        this.config = {
            pen: window.ConfigManager.getDrawingConfig('pen'),
            eraser: window.ConfigManager.getDrawingConfig('eraser')
        };
        
        // 統一設定から初期化
        this.currentTool = 'pen';
        this.isDrawing = false;
        this.currentPath = null;
        this.lastPoint = null;
        
        // 統一設定適用
        this.brushSize = this.config.pen.defaultSize;
        this.brushColor = this.config.pen.defaultColor;
        this.opacity = this.config.pen.defaultOpacity;
        this.pressure = this.config.pen.defaultPressure;
        this.smoothing = this.config.pen.defaultSmoothing;
        this.minDistance = this.config.pen.minDistance;
        
        // 拡張機能状態
        this.extensionsAvailable = appCore.extensionsAvailable;
        
        console.log('🔧 DrawingToolSystem 統一版初期化完了');
    }
    
    /**
     * 統一初期化
     */
    async initialize() {
        console.log('🖊️ DrawingToolSystem統一初期化...');
        
        // EventBusリスナー設定（統一化）
        this.setupEventListeners();
        
        console.log('✅ DrawingToolSystem統一初期化完了');
    }
    
    /**
     * EventBusリスナー設定（統一化）
     */
    setupEventListeners() {
        // ツール変更イベント
        window.EventBus.on(window.EventBus.Events.TOOL_CHANGED, (data) => {
            this.setTool(data.tool);
        });
        
        // ブラシ設定変更イベント
        window.EventBus.on(window.EventBus.Events.BRUSH_SIZE_CHANGED, (data) => {
            this.setBrushSize(data.size);
        });
        
        window.EventBus.on(window.EventBus.Events.OPACITY_CHANGED, (data) => {
            this.setOpacity(data.opacity);
        });
        
        console.log('✅ EventBusリスナー設定完了（統一版）');
    }
    
    /**
     * ツール設定（統一版）
     */
    setTool(tool) {
        if (this.currentTool === tool) return;
        
        this.currentTool = tool;
        
        // 設定切り替え
        if (tool === 'eraser') {
            this.brushSize = this.config.eraser.defaultSize;
            this.opacity = this.config.eraser.opacity;
        } else {
            this.brushSize = this.config.pen.defaultSize;
            this.opacity = this.config.pen.defaultOpacity;
        }
        
        console.log(`🔧 ツール変更（統一版）: ${tool}`);
    }
    
    /**
     * ブラシサイズ設定（統一版）
     */
    setBrushSize(size) {
        // ConfigManager妥当性確認
        if (!window.ConfigManager.validate('drawing.pen.defaultSize', size)) {
            window.ErrorManager.showError('warning', `無効なブラシサイズ: ${size}`);
            return;
        }
        
        this.brushSize = size;
        
        // EventBus通知
        window.EventBus.emit(window.EventBus.Events.BRUSH_SIZE_CHANGED, { size });
        
        console.log(`🖊️ ブラシサイズ設定（統一版）: ${size}`);
    }
    
    /**
     * 不透明度設定（統一版）
     */
    setOpacity(opacity) {
        if (!window.ConfigManager.validate('drawing.pen.defaultOpacity', opacity)) {
            window.ErrorManager.showError('warning', `無効な不透明度: ${opacity}`);
            return;
        }
        
        this.opacity = opacity;
        
        // EventBus通知
        window.EventBus.emit(window.EventBus.Events.OPACITY_CHANGED, { opacity });
        
        console.log(`🎨 不透明度設定（統一版）: ${opacity}`);
    }
    
    /**
     * 描画開始（統一版）
     */
    startDrawing(x, y) {
        this.isDrawing = true;
        this.lastPoint = { x, y };
        
        try {
            // パス作成
            if (this.currentTool === 'pen') {
                this.currentPath = this.createPenPath(x, y);
            } else if (this.currentTool === 'eraser') {
                this.currentPath = this.createEraserPath(x, y);
            }
            
            // EventBus通知
            window.EventBus.emit(window.EventBus.Events.DRAWING_STARTED, {
                tool: this.currentTool,
                x, y,
                brushSize: this.brushSize,
                color: this.brushColor
            });
            
            console.log(`🖊️ 描画開始（統一版）: ${this.currentTool} (${x.toFixed(1)}, ${y.toFixed(1)})`);
            
        } catch (error) {
            window.ErrorManager.showError('error', `描画開始エラー: ${error.message}`);
        }
    }
    
    /**
     * 描画継続（統一版）
     */
    continueDrawing(x, y) {
        if (!this.isDrawing || !this.currentPath || !this.lastPoint) return;
        
        try {
            const distance = Math.sqrt(
                (x - this.lastPoint.x) ** 2 + (y - this.lastPoint.y) ** 2
            );
            
            // 最小距離フィルタ（統一設定）
            if (distance < this.minDistance) return;
            
            // 線描画
            this.drawLine(this.currentPath, this.lastPoint.x, this.lastPoint.y, x, y);
            this.lastPoint = { x, y };
            
        } catch (error) {
            window.ErrorManager.showError('warning', `描画継続エラー: ${error.message}`);
        }
    }
    
    /**
     * 描画終了（統一版）
     */
    stopDrawing() {
        if (!this.isDrawing || !this.currentPath) return;
        
        try {
            // パス完成
            this.currentPath.isComplete = true;
            this.appCore.paths.push(this.currentPath);
            
            // EventBus通知
            window.EventBus.emit(window.EventBus.Events.PATH_CREATED, {
                pathId: this.currentPath.id,
                tool: this.currentTool,
                pointCount: this.currentPath.points.length
            });
            
            console.log(`🖊️ 描画終了（統一版）: ${this.currentPath.points.length}ポイント`);
            
        } catch (error) {
            window.ErrorManager.showError('warning', `描画終了エラー: ${error.message}`);
        } finally {
            this.isDrawing = false;
            this.currentPath = null;
            this.lastPoint = null;
        }
    }
    
    /**
     * ペンパス作成（統一版）
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
            isComplete: false,
            timestamp: Date.now()
        };
        
        // 初回点描画
        path.graphics.beginFill(path.color, path.opacity);
        path.graphics.drawCircle(x, y, path.size / 2);
        path.graphics.endFill();
        
        this.appCore.drawingContainer.addChild(path.graphics);
        return path;
    }
    
    /**
     * 消しゴムパス作成（統一版）
     */
    createEraserPath(x, y) {
        const path = {
            id: `eraser_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            graphics: new PIXI.Graphics(),
            points: [{ x, y, size: this.brushSize }],
            color: this.appCore.backgroundColor,
            size: this.brushSize,
            opacity: this.config.eraser.opacity,
            tool: 'eraser',
            isComplete: false,
            timestamp: Date.now()
        };
        
        // 初回点描画
        path.graphics.beginFill(path.color, path.opacity);
        path.graphics.drawCircle(x, y, path.size / 2);
        path.graphics.endFill();
        
        this.appCore.drawingContainer.addChild(path.graphics);
        return path;
    }
    
    /**
     * 線描画（統一版）
     */
    drawLine(path, x1, y1, x2, y2) {
        const distance = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
        const steps = Math.max(1, Math.ceil(distance / 1.5));
        
        // 連続円形ブラシ（統一版）
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
 * 統一版UIController
 * EventBus完全活用・循環依存排除
 */
class UIController {
    constructor(toolSystem) {
        this.toolSystem = toolSystem;
        
        // ConfigManager経由設定取得（統一化）
        this.config = {
            ui: window.ConfigManager.getUIConfig(),
            colors: window.ConfigManager.getColors()
        };
        
        this.activePopup = null;
        this.sliders = new Map();
        
        console.log('🎨 UIController 統一版初期化完了');
    }
    
    /**
     * 統一初期化
     */
    async initialize() {
        console.log('🎨 UIController統一初期化...');
        
        this.setupToolButtons();
        this.setupPopups();
        this.setupSliders();
        this.setupPresets();
        this.setupEventListeners();
        
        // 初期UI状態設定
        this.updateAllUI();
        
        console.log('✅ UIController統一初期化完了');
    }
    
    /**
     * EventBusリスナー設定（統一化）
     */
    setupEventListeners() {
        // ツール変更時UI更新
        window.EventBus.on(window.EventBus.Events.TOOL_CHANGED, (data) => {
            this.updateToolButtonsUI(data.tool);
        });
        
        // ブラシ設定変更時UI更新
        window.EventBus.on(window.EventBus.Events.BRUSH_SIZE_CHANGED, (data) => {
            this.updateSliderValue('pen-size-slider', data.size);
            this.updateSizePresets();
        });
        
        window.EventBus.on(window.EventBus.Events.OPACITY_CHANGED, (data) => {
            this.updateSliderValue('pen-opacity-slider', data.opacity * 100);
            this.updateSizePresets();
        });
        
        // キャンバスリサイズ時UI更新
        window.EventBus.on(window.EventBus.Events.CANVAS_RESIZED, (data) => {
            this.updateCanvasInfo(data.width, data.height);
        });
        
        console.log('✅ UIController EventBusリスナー設定完了');
    }
    
    /**
     * ツールボタン設定（統一版）
     */
    setupToolButtons() {
        document.querySelectorAll('.tool-button').forEach(btn => {
            btn.addEventListener('click', (e) => {
                if (btn.classList.contains('disabled')) return;
                
                const toolId = btn.id;
                const popupId = btn.getAttribute('data-popup');
                
                // EventBus経由でツール変更（循環依存排除）
                if (toolId === 'pen-tool') {
                    window.EventBus.emit(window.EventBus.Events.TOOL_CHANGED, { tool: 'pen' });
                } else if (toolId === 'eraser-tool') {
                    window.EventBus.emit(window.EventBus.Events.TOOL_CHANGED, { tool: 'eraser' });
                }
                
                if (popupId) {
                    this.togglePopup(popupId);
                }
            });
        });
        
        console.log('✅ ツールボタン設定完了（統一版）');
    }
    
    /**
     * ツールボタンUI更新（統一版）
     */
    updateToolButtonsUI(tool) {
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
    }
    
    /**
     * スライダー設定（統一版）
     */
    setupSliders() {
        const penConfig = this.config.ui.slider;
        
        // ペンサイズスライダー
        this.createSlider('pen-size-slider', 0.1, 100, 
            this.toolSystem.brushSize, 
            (value) => {
                window.EventBus.emit(window.EventBus.Events.BRUSH_SIZE_CHANGED, { size: value });
                return value.toFixed(1) + 'px';
            }
        );
        
        // 不透明度スライダー
        this.createSlider('pen-opacity-slider', 0, 100, 
            this.toolSystem.opacity * 100,
            (value) => {
                window.EventBus.emit(window.EventBus.Events.OPACITY_CHANGED, { opacity: value / 100 });
                return value.toFixed(1) + '%';
            }
        );
        
        // 筆圧スライダー
        this.createSlider('pen-pressure-slider', 0, 100, 
            this.toolSystem.pressure * 100,
            (value) => {
                window.EventBus.emit(window.EventBus.Events.PRESSURE_CHANGED, { pressure: value / 100 });
                return value.toFixed(1) + '%';
            }
        );
        
        // スムージングスライダー
        this.createSlider('pen-smoothing-slider', 0, 100, 
            this.toolSystem.smoothing * 100,
            (value) => {
                window.EventBus.emit(window.EventBus.Events.SMOOTHING_CHANGED, { smoothing: value / 100 });
                return value.toFixed(1) + '%';
            }
        );
        
        console.log('✅ スライダー設定完了（統一版）');
    }
    
    /**
     * スライダー作成（統一版）
     */
    createSlider(sliderId, min, max, initial, callback) {
        const container = document.getElementById(sliderId);
        if (!container) return;
        
        const track = container.querySelector('.slider-track');
        const handle = container.querySelector('.slider-handle');
        const valueDisplay = container.parentNode.querySelector('.slider-value');
        
        if (!track || !handle || !valueDisplay) return;
        
        const sliderData = {
            value: initial,
            min, max, callback,
            track, handle, valueDisplay,
            isDragging: false
        };
        
        this.sliders.set(sliderId, sliderData);
        
        // スロットル処理（統一設定）
        let updateTimeout;
        const throttleMs = this.config.ui.slider.updateThrottle;
        
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
        
        // マウスイベント
        container.addEventListener('mousedown', (e) => {
            sliderData.isDragging = true;
            updateSlider(getValueFromPosition(e.clientX));
            e.preventDefault();
        });
        
        document.addEventListener('mousemove', (e) => {
            if (!sliderData.isDragging) return;
            
            clearTimeout(updateTimeout);
            updateTimeout = setTimeout(() => {
                updateSlider(getValueFromPosition(e.clientX));
            }, throttleMs);
        });
        
        document.addEventListener('mouseup', () => {
            sliderData.isDragging = false;
            clearTimeout(updateTimeout);
        });
        
        // 初期化
        updateSlider(initial);
    }
    
    /**
     * スライダー値更新（統一版）
     */
    updateSliderValue(sliderId, value) {
        const slider = this.sliders.get(sliderId);
        if (!slider) return;
        
        slider.value = value;
        const percentage = ((value - slider.min) / (slider.max - slider.min)) * 100;
        slider.track.style.width = percentage + '%';
        slider.handle.style.left = percentage + '%';
        slider.valueDisplay.textContent = slider.callback(value);
    }
    
    /**
     * ポップアップ設定（統一版）
     */
    setupPopups() {
        // ポップアップトグル処理
        document.querySelectorAll('[data-popup]').forEach(trigger => {
            const popupId = trigger.getAttribute('data-popup');
            trigger.addEventListener('click', () => this.togglePopup(popupId));
        });
        
        console.log('✅ ポップアップ設定完了（統一版）');
    }
    
    /**
     * ポップアップ切り替え（統一版）
     */
    togglePopup(popupId) {
        const popup = document.getElementById(popupId);
        if (!popup) return;
        
        // 他のポップアップを閉じる
        if (this.activePopup && this.activePopup !== popup) {
            this.activePopup.classList.remove('show');
            window.EventBus.emit(window.EventBus.Events.POPUP_CLOSED, { 
                popupId: this.activePopup.id 
            });
        }
        
        // ポップアップ表示切り替え
        const isVisible = popup.classList.contains('show');
        popup.classList.toggle('show', !isVisible);
        
        if (isVisible) {
            this.activePopup = null;
            window.EventBus.emit(window.EventBus.Events.POPUP_CLOSED, { popupId });
        } else {
            this.activePopup = popup;
            window.EventBus.emit(window.EventBus.Events.POPUP_OPENED, { popupId });
        }
    }
    
    /**
     * 全ポップアップ閉じる（統一版）
     */
    closeAllPopups() {
        document.querySelectorAll('.popup-panel').forEach(popup => {
            if (popup.classList.contains('show')) {
                popup.classList.remove('show');
                window.EventBus.emit(window.EventBus.Events.POPUP_CLOSED, { 
                    popupId: popup.id 
                });
            }
        });
        
        this.activePopup = null;
        console.log('🔒 全ポップアップ閉じる（統一版）');
    }
    
    /**
     * プリセット設定（統一版）
     */
    setupPresets() {
        document.querySelectorAll('.size-preset-item').forEach(preset => {
            preset.addEventListener('click', () => {
                const size = parseFloat(preset.getAttribute('data-size'));
                
                // EventBus経由で変更（統一化）
                window.EventBus.emit(window.EventBus.Events.BRUSH_SIZE_CHANGED, { size });
                window.EventBus.emit(window.EventBus.Events.PRESET_SELECTED, { size });
            });
        });
        
        console.log('✅ プリセット設定完了（統一版）');
    }
    
    /**
     * サイズプリセット更新（統一版）
     */
    updateSizePresets() {
        const currentSize = this.toolSystem.brushSize;
        const currentOpacity = Math.round(this.toolSystem.opacity * 100);
        
        document.querySelectorAll('.size-preset-item').forEach(preset => {
            const presetSize = parseFloat(preset.getAttribute('data-size'));
            const circle = preset.querySelector('.size-preview-circle');
            const label = preset.querySelector('.size-preview-label');
            const percent = preset.querySelector('.size-preview-percent');
            
            if (!circle || !label || !percent) return;
            
            // アクティブ状態
            const isActive = Math.abs(presetSize - currentSize) < 0.1;
            preset.classList.toggle('active', isActive);
            
            // 円サイズ（統一カラー適用）
            const circleSize = Math.max(0.5, Math.min(20, (presetSize / 100) * 19.5 + 0.5));
            circle.style.width = circleSize + 'px';
            circle.style.height = circleSize + 'px';
            circle.style.opacity = this.toolSystem.opacity;
            circle.style.backgroundColor = this.config.colors.futabaMaroonHex;
            
            // ラベル更新
            label.textContent = isActive ? currentSize.toFixed(1) : presetSize.toString();
            percent.textContent = currentOpacity + '%';
        });
    }
    
    /**
     * キャンバス情報更新（統一版）
     */
    updateCanvasInfo(width, height) {
        const canvasInfo = document.getElementById('canvas-info');
        if (canvasInfo) {
            canvasInfo.textContent = `${width}×${height}px`;
        }
    }
    
    /**
     * 全UI更新（統一版）
     */
    updateAllUI() {
        // ツールボタン更新
        this.updateToolButtonsUI(this.toolSystem.currentTool);
        
        // スライダー更新
        this.updateSliderValue('pen-size-slider', this.toolSystem.brushSize);
        this.updateSliderValue('pen-opacity-slider', this.toolSystem.opacity * 100);
        this.updateSliderValue('pen-pressure-slider', this.toolSystem.pressure * 100);
        this.updateSliderValue('pen-smoothing-slider', this.toolSystem.smoothing * 100);
        
        // プリセット更新
        this.updateSizePresets();
        
        // カラー表示更新
        const currentColorElement = document.getElementById('current-color');
        if (currentColorElement) {
            currentColorElement.textContent = this.config.colors.futabaMaroonHex;
        }
        
        console.log('✅ 全UI更新完了（統一版）');
    }
}

/**
 * 統一版パフォーマンス監視
 * ConfigManager完全活用
 */
class PerformanceMonitor {
    constructor() {
        // ConfigManager経由設定取得（統一化）
        this.config = window.ConfigManager.getPerformanceConfig();
        
        this.metrics = {
            frameCount: 0,
            currentFPS: 0,
            averageFPS: 0,
            minFPS: Infinity,
            maxFPS: 0
        };
        
        this.lastTime = performance.now();
        this.isRunning = false;
        this.updateCallbacks = new Set();
        
        console.log('📊 PerformanceMonitor 統一版初期化完了');
    }
    
    /**
     * 統一初期化
     */
    async initialize() {
        console.log('📊 PerformanceMonitor統一初期化...');
        
        // EventBusリスナー設定
        window.EventBus.on('performanceWarning', (data) => {
            this.handlePerformanceWarning(data);
        });
        
        console.log('✅ PerformanceMonitor統一初期化完了');
    }
    
    /**
     * 監視開始（統一版）
     */
    start() {
        if (this.isRunning) return;
        
        this.isRunning = true;
        console.log(`📊 パフォーマンス監視開始（目標FPS: ${this.config.targetFPS}）`);
        
        const update = () => {
            if (!this.isRunning) return;
            
            this.updateMetrics();
            this.updateDisplay();
            this.checkPerformanceWarnings();
            
            // コールバック実行
            this.updateCallbacks.forEach(callback => {
                try {
                    callback(this.metrics);
                } catch (error) {
                    console.warn('📊 パフォーマンスコールバックエラー:', error);
                }
            });
            
            requestAnimationFrame(update);
        };
        
        update();
    }
    
    /**
     * メトリクス更新（統一版）
     */
    updateMetrics() {
        this.metrics.frameCount++;
        const currentTime = performance.now();
        
        if (currentTime - this.lastTime >= this.config.updateInterval) {
            const deltaTime = currentTime - this.lastTime;
            const fps = Math.round((this.metrics.frameCount * 1000) / deltaTime);
            
            this.metrics.currentFPS = fps;
            this.metrics.minFPS = Math.min(this.metrics.minFPS, fps);
            this.metrics.maxFPS = Math.max(this.metrics.maxFPS, fps);
            
            // 平均FPS計算（移動平均）
            if (this.metrics.averageFPS === 0) {
                this.metrics.averageFPS = fps;
            } else {
                this.metrics.averageFPS = Math.round((this.metrics.averageFPS * 0.9) + (fps * 0.1));
            }
            
            this.metrics.frameCount = 0;
            this.lastTime = currentTime;
        }
    }
    
    /**
     * 表示更新（統一版）
     */
    updateDisplay() {
        // FPS表示更新
        const fpsElement = document.getElementById('fps');
        if (fpsElement) {
            fpsElement.textContent = this.metrics.currentFPS.toString();
        }
        
        // メモリ使用量表示
        if (performance.memory) {
            const memoryElement = document.getElementById('memory-usage');
            if (memoryElement) {
                const usedMB = Math.round(performance.memory.usedJSHeapSize / 1024 / 1024);
                memoryElement.textContent = `${usedMB}MB`;
            }
        }
    }
    
    /**
     * パフォーマンス警告チェック（統一版）
     */
    checkPerformanceWarnings() {
        const { currentFPS, averageFPS } = this.metrics;
        const targetFPS = this.config.targetFPS;
        
        // 低FPS警告
        if (currentFPS > 0 && currentFPS < targetFPS * 0.5) {
            window.EventBus.emit(window.EventBus.Events.PERFORMANCE_WARNING, {
                type: 'low_fps',
                currentFPS,
                targetFPS,
                severity: 'high'
            });
        }
        
        // 平均FPS警告
        if (averageFPS > 0 && averageFPS < targetFPS * 0.7) {
            window.EventBus.emit(window.EventBus.Events.PERFORMANCE_WARNING, {
                type: 'low_average_fps',
                averageFPS,
                targetFPS,
                severity: 'medium'
            });
        }
        
        // メモリ警告
        if (performance.memory) {
            const usedMB = performance.memory.usedJSHeapSize / 1024 / 1024;
            if (usedMB > 100) { // 100MB超過で警告
                window.EventBus.emit(window.EventBus.Events.PERFORMANCE_WARNING, {
                    type: 'high_memory',
                    usedMB: Math.round(usedMB),
                    severity: 'medium'
                });
            }
        }
    }
    
    /**
     * パフォーマンス警告処理（統一版）
     */
    handlePerformanceWarning(data) {
        console.warn('📊 パフォーマンス警告:', data);
        
        // 重要な警告のみ表示
        if (data.severity === 'high') {
            window.ErrorManager.showError('warning', 
                `パフォーマンス低下: ${data.type} (${data.currentFPS}FPS)`, {
                duration: 5000
            });
        }
    }
    
    /**
     * 更新コールバック追加
     */
    addUpdateCallback(callback) {
        this.updateCallbacks.add(callback);
        return () => this.updateCallbacks.delete(callback);
    }
    
    /**
     * 監視停止
     */
    stop() {
        this.isRunning = false;
        console.log('📊 パフォーマンス監視停止');
    }
}

/**
 * 簡易フォールバックツールシステム（統一版）
 */
class SimpleFallbackToolSystem extends DrawingToolSystem {
    constructor(appCore) {
        super(appCore);
        this.fallbackMode = true;
        console.log('🛡️ SimpleFallbackToolSystem 統一版初期化完了');
    }
    
    async initialize() {
        console.log('🛡️ フォールバック統一版初期化...');
        
        // 基本イベントリスナーのみ設定
        window.EventBus.on(window.EventBus.Events.TOOL_CHANGED, (data) => {
            this.setTool(data.tool);
        });
        
        console.log('✅ フォールバック統一版初期化完了');
    }
}

// グローバル登録（統一版）
if (typeof window !== 'undefined') {
    window.AppCore = AppCore;
    window.DrawingToolSystem = DrawingToolSystem;
    window.UIController = UIController;
    window.PerformanceMonitor = PerformanceMonitor;
    window.SimpleFallbackToolSystem = SimpleFallbackToolSystem;
    
    console.log('🎨 AppCore統一版関連クラス グローバル登録完了');
    console.log('🔧 統一システム完全統合: ConfigManager + ErrorManager + StateManager + EventBus');
}