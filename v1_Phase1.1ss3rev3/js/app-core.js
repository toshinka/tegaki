/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1.0
 * 🎯 アプリケーションコア（フォールバック対応版）
 * 
 * 🎯 AI_WORK_SCOPE: PixiJSアプリケーション基盤・描画エンジン・ツールシステム
 * 🎯 DEPENDENCIES: libs/pixi-extensions.js, PixiJS Core
 * 🎯 NODE_MODULES: pixi.js（Graphics, Container, Application使用）
 * 🎯 PIXI_EXTENSIONS: 条件付き使用・フォールバック対応
 * 🎯 ISOLATION_TEST: ❌ PixiJS本体依存
 * 🎯 SPLIT_THRESHOLD: 500行超過時 → 機能別分割
 * 
 * 📋 PHASE_TARGET: Phase1
 * 📋 V8_MIGRATION: Application・Graphics・Container API変更対応予定
 * 📋 PERFORMANCE_TARGET: 60FPS安定描画・3秒以内初期化
 */

class AppCore {
    constructor() {
        this.app = null;
        this.drawingContainer = null;
        this.uiContainer = null;
        this.paths = [];
        this.currentTool = 'pen';
        
        // 設定
        this.canvasWidth = 400;
        this.canvasHeight = 400;
        this.backgroundColor = 0xf0e0d6;
        
        // ツールシステム
        this.toolSystem = null;
        this.uiController = null;
        this.performanceMonitor = null;
        
        // 拡張機能フラグ
        this.extensionsAvailable = false;
        this.fallbackMode = false;
        
        console.log('🎨 AppCore インスタンス作成完了');
    }
    
    /**
     * アプリケーション初期化
     */
    async initialize() {
        try {
            console.log('🚀 AppCore 初期化開始...');
            
            // Step 1: 拡張機能確認
            await this.checkExtensions();
            
            // Step 2: PixiJS アプリケーション初期化
            await this.initializePixiApp();
            
            // Step 3: コンテナ初期化
            this.initializeContainers();
            
            // Step 4: ツールシステム初期化
            this.initializeToolSystem();
            
            // Step 5: UI制御初期化
            this.initializeUI();
            
            // Step 6: イベントリスナー設定
            this.setupEventListeners();
            
            // Step 7: 描画エンジン初期化
            this.initializeDrawingEngine();
            
            // Step 8: パフォーマンス監視開始
            this.startPerformanceMonitoring();
            
            console.log('✅ AppCore 初期化完了');
            this.displayInitializationSummary();
            
        } catch (error) {
            console.error('💀 AppCore 初期化エラー:', error);
            await this.initializeFallbackMode(error);
        }
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
                console.warn('⚠️ 拡張機能フォールバックモード検出');
                this.fallbackMode = true;
            }
        } else {
            console.warn('⚠️ 拡張機能未初期化 - フォールバックモード有効');
            this.fallbackMode = true;
        }
    }
    
    /**
     * PixiJS アプリケーション初期化
     */
    async initializePixiApp() {
        console.log('🎮 PixiJS アプリケーション初期化中...');
        
        // アプリケーション設定
        const appConfig = {
            width: this.canvasWidth,
            height: this.canvasHeight,
            backgroundColor: this.backgroundColor,
            antialias: true,
            resolution: window.devicePixelRatio || 1,
            autoDensity: true
        };
        
        // v8対応準備（コメントアウト）
        /*
        // PixiJS v8の場合の設定調整
        if (window.PIXI.VERSION && window.PIXI.VERSION.startsWith('8.')) {
            appConfig.renderer = {
                type: 'webgl', // v8では明示的指定が推奨
                powerPreference: 'high-performance'
            };
        }
        */
        
        // アプリケーション作成
        this.app = new PIXI.Application(appConfig);
        
        // DOM接続
        const canvasContainer = document.getElementById('drawing-canvas') || 
                               document.getElementById('app-root') ||
                               document.body;
        
        canvasContainer.appendChild(this.app.view);
        
        console.log(`✅ PixiJS アプリケーション初期化完了 (${this.canvasWidth}x${this.canvasHeight})`);
    }
    
    /**
     * コンテナ初期化
     */
    initializeContainers() {
        console.log('📦 コンテナ初期化中...');
        
        // 描画用コンテナ
        this.drawingContainer = new PIXI.Container();
        this.drawingContainer.name = 'drawing-layer';
        this.app.stage.addChild(this.drawingContainer);
        
        // UI用コンテナ
        this.uiContainer = new PIXI.Container();
        this.uiContainer.name = 'ui-layer';
        this.app.stage.addChild(this.uiContainer);
        
        // インタラクション設定
        this.app.stage.interactive = true;
        this.app.stage.hitArea = new PIXI.Rectangle(0, 0, this.canvasWidth, this.canvasHeight);
        
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
     * UI制御初期化
     */
    initializeUI() {
        console.log('🎨 UI制御初期化中...');
        
        this.uiController = new UIController(this.toolSystem);
        this.uiController.init();
        
        console.log('✅ UI制御初期化完了');
    }
    
    /**
     * イベントリスナー設定
     */
    setupEventListeners() {
        console.log('🎧 イベントリスナー設定中...');
        
        // 描画イベント
        this.app.stage.on('pointerdown', this.handlePointerDown.bind(this));
        this.app.stage.on('pointermove', this.handlePointerMove.bind(this));
        this.app.stage.on('pointerup', this.handlePointerUp.bind(this));
        this.app.stage.on('pointerupoutside', this.handlePointerUp.bind(this));
        
        // リサイズイベント
        window.addEventListener('resize', this.handleResize.bind(this));
        
        console.log('✅ イベントリスナー設定完了');
    }
    
    /**
     * 描画エンジン初期化
     */
    initializeDrawingEngine() {
        console.log('🖊️ 描画エンジン初期化中...');
        
        // 描画エンジンは ToolSystem 内で管理
        if (this.toolSystem) {
            this.toolSystem.initializeDrawingEngine();
        }
        
        console.log('✅ 描画エンジン初期化完了');
    }
    
    /**
     * パフォーマンス監視開始
     */
    startPerformanceMonitoring() {
        console.log('📊 パフォーマンス監視開始...');
        
        this.performanceMonitor = new PerformanceMonitor();
        this.performanceMonitor.start();
        
        console.log('✅ パフォーマンス監視開始完了');
    }
    
    /**
     * フォールバックモード初期化
     */
    async initializeFallbackMode(error) {
        console.log('🛡️ フォールバックモード初期化中...');
        this.fallbackMode = true;
        
        try {
            // 最低限のPixiJSアプリケーション初期化
            if (!this.app) {
                await this.initializePixiApp();
            }
            
            if (!this.drawingContainer) {
                this.initializeContainers();
            }
            
            // 簡易ツールシステム
            this.toolSystem = new SimpleFallbackToolSystem(this);
            
            // 基本UI
            if (document.getElementById('library-status')) {
                document.getElementById('library-status').textContent = 
                    'フォールバック動作中';
            }
            
            console.log('✅ フォールバックモード初期化完了');
            
        } catch (fallbackError) {
            console.error('💀 フォールバックモード初期化も失敗:', fallbackError);
            this.displayCriticalError(fallbackError);
        }
    }
    
    /**
     * イベントハンドラ: ポインターダウン
     */
    handlePointerDown(event) {
        if (!this.toolSystem) return;
        
        const point = this.getLocalPointerPosition(event);
        this.toolSystem.startDrawing(point.x, point.y);
    }
    
    /**
     * イベントハンドラ: ポインター移動
     */
    handlePointerMove(event) {
        const point = this.getLocalPointerPosition(event);
        
        // 座標表示更新
        if (document.getElementById('coordinates')) {
            document.getElementById('coordinates').textContent = 
                `x: ${Math.round(point.x)}, y: ${Math.round(point.y)}`;
        }
        
        if (!this.toolSystem) return;
        this.toolSystem.continueDrawing(point.x, point.y);
    }
    
    /**
     * イベントハンドラ: ポインターアップ
     */
    handlePointerUp(event) {
        if (!this.toolSystem) return;
        
        this.toolSystem.stopDrawing();
        
        // 筆圧モニターリセット
        if (document.getElementById('pressure-monitor')) {
            document.getElementById('pressure-monitor').textContent = '0.0%';
        }
    }
    
    /**
     * イベントハンドラ: リサイズ
     */
    handleResize() {
        if (!this.app) return;
        
        // リサイズ処理（必要に応じて実装）
        console.log('🔄 ウィンドウリサイズ検出');
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
        
        const x = ((originalEvent.clientX || originalEvent.pageX) - rect.left) * (this.canvasWidth / rect.width);
        const y = ((originalEvent.clientY || originalEvent.pageY) - rect.top) * (this.canvasHeight / rect.height);
        
        return { x, y };
    }
    
    /**
     * キャンバスリサイズ
     */
    resize(newWidth, newHeight, centerContent = false) {
        if (!this.app) return;
        
        const oldWidth = this.canvasWidth;
        const oldHeight = this.canvasHeight;
        
        this.canvasWidth = newWidth;
        this.canvasHeight = newHeight;
        
        // アプリケーションリサイズ
        this.app.renderer.resize(newWidth, newHeight);
        this.app.stage.hitArea = new PIXI.Rectangle(0, 0, newWidth, newHeight);
        
        // コンテンツ中央寄せ
        if (centerContent && this.drawingContainer && this.paths.length > 0) {
            const offsetX = (newWidth - oldWidth) / 2;
            const offsetY = (newHeight - oldHeight) / 2;
            
            this.drawingContainer.x += offsetX;
            this.drawingContainer.y += offsetY;
        }
        
        // ステータス更新
        if (document.getElementById('canvas-info')) {
            document.getElementById('canvas-info').textContent = `${newWidth}×${newHeight}px`;
        }
        
        console.log(`📐 キャンバスリサイズ: ${newWidth}x${newHeight}`);
    }
    
    /**
     * 初期化サマリー表示
     */
    displayInitializationSummary() {
        const summary = {
            pixiApp: !!this.app,
            drawingContainer: !!this.drawingContainer,
            toolSystem: !!this.toolSystem,
            uiController: !!this.uiController,
            performanceMonitor: !!this.performanceMonitor,
            extensionsAvailable: this.extensionsAvailable,
            fallbackMode: this.fallbackMode
        };
        
        console.log('📋 初期化サマリー:', summary);
        
        const initComponents = Object.values(summary).filter(Boolean).length;
        const totalComponents = Object.keys(summary).length;
        
        console.log(`✅ 初期化完了率: ${initComponents}/${totalComponents} (${(initComponents/totalComponents*100).toFixed(1)}%)`);
    }
    
    /**
     * 致命的エラー表示
     */
    displayCriticalError(error) {
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: #800000;
            color: white;
            padding: 20px;
            border-radius: 10px;
            text-align: center;
            z-index: 9999;
            font-family: monospace;
            max-width: 400px;
        `;
        errorDiv.innerHTML = `
            <h3>🚫 致命的エラー</h3>
            <p style="margin: 10px 0;">アプリケーションの初期化に失敗しました</p>
            <details style="margin: 10px 0; text-align: left;">
                <summary style="cursor: pointer;">エラー詳細</summary>
                <pre style="margin: 5px 0; font-size: 10px; overflow: auto; max-height: 100px;">${error.message}</pre>
            </details>
            <button onclick="location.reload()" style="margin-top: 10px; padding: 8px 15px; background: white; color: #800000; border: none; border-radius: 5px; cursor: pointer;">再読み込み</button>
        `;
        document.body.appendChild(errorDiv);
    }
}

/**
 * 描画ツールシステム（統合版）
 */
class DrawingToolSystem {
    constructor(appCore) {
        this.appCore = appCore;
        this.currentTool = 'pen';
        this.isDrawing = false;
        this.currentPath = null;
        this.lastPoint = null;
        
        // ツール設定
        this.brushSize = 16.0;
        this.brushColor = 0x800000;
        this.opacity = 0.85;
        this.pressure = 0.5;
        this.smoothing = 0.3;
        
        // 拡張機能フラグ
        this.extensionsAvailable = appCore.extensionsAvailable;
        
        console.log('🔧 DrawingToolSystem 初期化完了');
    }
    
    /**
     * 描画エンジン初期化
     */
    initializeDrawingEngine() {
        console.log('🖊️ 描画エンジン初期化中...');
        
        // 基本描画機能は常に利用可能
        console.log('✅ 基本描画エンジン初期化完了');
    }
    
    /**
     * ツール設定
     */
    setTool(tool) {
        this.currentTool = tool;
        console.log(`🔧 ツール変更: ${tool}`);
    }
    
    setBrushSize(size) {
        this.brushSize = Math.max(0.1, Math.min(100, Math.round(size * 10) / 10));
    }
    
    setOpacity(opacity) {
        this.opacity = Math.max(0, Math.min(1, Math.round(opacity * 1000) / 1000));
    }
    
    setPressure(pressure) {
        this.pressure = Math.max(0, Math.min(1, Math.round(pressure * 1000) / 1000));
    }
    
    setSmoothing(smoothing) {
        this.smoothing = Math.max(0, Math.min(1, Math.round(smoothing * 1000) / 1000));
    }
    
    /**
     * 描画開始
     */
    startDrawing(x, y) {
        this.isDrawing = true;
        this.lastPoint = { x, y };
        
        // 現在のツールに応じた描画開始
        if (this.currentTool === 'pen') {
            this.currentPath = this.createPenPath(x, y);
        } else if (this.currentTool === 'eraser') {
            this.currentPath = this.createEraserPath(x, y);
        }
        
        // 筆圧モニター更新
        if (document.getElementById('pressure-monitor')) {
            const pressure = this.pressure * 100 + Math.random() * 10;
            document.getElementById('pressure-monitor').textContent = `${pressure.toFixed(1)}%`;
        }
    }
    
    /**
     * 描画継続
     */
    continueDrawing(x, y) {
        if (!this.isDrawing || !this.currentPath || !this.lastPoint) return;
        
        const distance = Math.sqrt((x - this.lastPoint.x) ** 2 + (y - this.lastPoint.y) ** 2);
        
        // 最小距離フィルタ
        if (distance < 1.5) return;
        
        // 線の描画
        this.drawLine(this.currentPath, this.lastPoint.x, this.lastPoint.y, x, y);
        this.lastPoint = { x, y };
        
        // 筆圧モニター更新
        if (document.getElementById('pressure-monitor')) {
            const pressure = this.pressure * 100 + Math.random() * 15;
            document.getElementById('pressure-monitor').textContent = `${pressure.toFixed(1)}%`;
        }
    }
    
    /**
     * 描画終了
     */
    stopDrawing() {
        if (this.currentPath) {
            this.currentPath.isComplete = true;
            this.appCore.paths.push(this.currentPath);
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
        
        // 初回点描画
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
        const path = {
            id: `eraser_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            graphics: new PIXI.Graphics(),
            points: [{ x, y, size: this.brushSize }],
            color: this.appCore.backgroundColor,
            size: this.brushSize,
            opacity: 1.0,
            tool: 'eraser',
            isComplete: false
        };
        
        // 初回点描画
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
        console.log('🛡️ SimpleFallbackToolSystem 初期化完了');
    }
    
    initializeDrawingEngine() {
        console.log('🛡️ フォールバック描画エンジン初期化中...');
        console.log('✅ フォールバック描画エンジン初期化完了');
    }
}

/**
 * UI制御システム（統合版）
 */
class UIController {
    constructor(toolSystem) {
        this.toolSystem = toolSystem;
        this.activePopup = null;
        this.sliders = new Map();
    }
    
    init() {
        console.log('🎨 UI制御システム初期化中...');
        
        this.setupToolButtons();
        this.setupPopups();
        this.setupSliders();
        this.setupPresets();
        this.setupResize();
        this.setupCheckboxes();
        this.updateSizePresets();
        
        console.log('✅ UI制御システム初期化完了');
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
    }
    
    setTool(tool) {
        this.toolSystem.setTool(tool);
        
        document.querySelectorAll('.tool-button').forEach(btn => btn.classList.remove('active'));
        document.getElementById(tool + '-tool').classList.add('active');
        
        const toolNames = { pen: 'ベクターペン', eraser: '消しゴム' };
        if (document.getElementById('current-tool')) {
            document.getElementById('current-tool').textContent = toolNames[tool] || tool;
        }
    }
    
    togglePopup(popupId) {
        const popup = document.getElementById(popupId);
        if (!popup) return;
        
        if (this.activePopup && this.activePopup !== popup) {
            this.activePopup.classList.remove('show');
        }
        
        const isVisible = popup.classList.contains('show');
        popup.classList.toggle('show', !isVisible);
        this.activePopup = isVisible ? null : popup;
    }
    
    setupSliders() {
        this.createSlider('pen-size-slider', 0.1, 100, 16.0, (value) => {
            this.toolSystem.setBrushSize(value);
            this.updateSizePresets();
            return value.toFixed(1) + 'px';
        });
        
        this.createSlider('pen-opacity-slider', 0, 100, 85.0, (value) => {
            this.toolSystem.setOpacity(value / 100);
            this.updateSizePresets();
            return value.toFixed(1) + '%';
        });
        
        this.createSlider('pen-pressure-slider', 0, 100, 50.0, (value) => {
            this.toolSystem.setPressure(value / 100);
            return value.toFixed(1) + '%';
        });
        
        this.createSlider('pen-smoothing-slider', 0, 100, 30.0, (value) => {
            this.toolSystem.setSmoothing(value / 100);
            return value.toFixed(1) + '%';
        });
        
        this.setupSliderButtons();
    }
    
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
        
        const updateSlider = (value) => {
            sliderData.value = Math.max(min, Math.min(max, value));
            const percentage = ((sliderData.value - min) / (max - min)) * 100;
            
            track.style.width = percentage + '%';
            handle.style.left = percentage + '%';
            valueDisplay.textContent = callback(sliderData.value);
        };
        
        const getValueFromPosition = (clientX) => {
            const rect = container.getBoundingClientRect();
            const percentage = (clientX - rect.left) / rect.width;
            return min + (percentage * (max - min));
        };
        
        container.addEventListener('mousedown', (e) => {
            sliderData.isDragging = true;
            updateSlider(getValueFromPosition(e.clientX));
            e.preventDefault();
        });
        
        document.addEventListener('mousemove', (e) => {
            if (sliderData.isDragging) updateSlider(getValueFromPosition(e.clientX));
        });
        
        document.addEventListener('mouseup', () => {
            sliderData.isDragging = false;
        });
        
        updateSlider(initial);
    }
    
    setupSliderButtons() {
        // スライダー調整ボタンの設定（簡略版）
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
        
        // ボタンイベント設定
        const buttonConfigs = [
            { id: 'pen-size-decrease-small', slider: 'pen-size-slider', delta: -0.1 },
            { id: 'pen-size-decrease', slider: 'pen-size-slider', delta: -1 },
            { id: 'pen-size-decrease-large', slider: 'pen-size-slider', delta: -10 },
            { id: 'pen-size-increase-small', slider: 'pen-size-slider', delta: 0.1 },
            { id: 'pen-size-increase', slider: 'pen-size-slider', delta: 1 },
            { id: 'pen-size-increase-large', slider: 'pen-size-slider', delta: 10 }
        ];
        
        buttonConfigs.forEach(config => {
            const button = document.getElementById(config.id);
            if (button) {
                button.addEventListener('click', () => {
                    adjustValue(config.slider, config.delta);
                    if (config.slider === 'pen-size-slider') {
                        this.updateSizePresets();
                    }
                });
            }
        });
    }
    
    setupPresets() {
        document.querySelectorAll('.size-preset-item').forEach(preset => {
            preset.addEventListener('click', () => {
                const size = parseFloat(preset.getAttribute('data-size'));
                this.toolSystem.setBrushSize(size);
                this.updateSliderValue('pen-size-slider', size);
                this.updateSizePresets();
            });
        });
    }
    
    setupResize() {
        document.querySelectorAll('.resize-button[data-size]').forEach(btn => {
            btn.addEventListener('click', () => {
                const [width, height] = btn.getAttribute('data-size').split(',').map(Number);
                const widthInput = document.getElementById('canvas-width');
                const heightInput = document.getElementById('canvas-height');
                if (widthInput) widthInput.value = width;
                if (heightInput) heightInput.value = height;
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
        const currentSize = this.toolSystem.brushSize;
        const currentOpacity = Math.round(this.toolSystem.opacity * 100);
        
        document.querySelectorAll('.size-preset-item').forEach(preset => {
            const presetSize = parseFloat(preset.getAttribute('data-size'));
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
    }
}

/**
 * パフォーマンス監視システム
 */
class PerformanceMonitor {
    constructor() {
        this.frameCount = 0;
        this.lastTime = performance.now();
    }
    
    start() {
        console.log('📊 パフォーマンス監視開始');
        
        const update = () => {
            this.frameCount++;
            const currentTime = performance.now();
            
            if (currentTime - this.lastTime >= 1000) {
                const fps = Math.round((this.frameCount * 1000) / (currentTime - this.lastTime));
                
                if (document.getElementById('fps')) {
                    document.getElementById('fps').textContent = fps;
                }
                
                this.frameCount = 0;
                this.lastTime = currentTime;
            }
            
            requestAnimationFrame(update);
        };
        
        update();
    }
}

// グローバル登録
if (typeof window !== 'undefined') {
    window.AppCore = AppCore;
    window.DrawingToolSystem = DrawingToolSystem;
    window.UIController = UIController;
    window.PerformanceMonitor = PerformanceMonitor;
    
    console.log('🎨 AppCore関連クラス グローバル登録完了');
}