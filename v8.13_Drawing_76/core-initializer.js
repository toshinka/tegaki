// ===== core-initializer.js - Phase 2統合版: BrushCore対応 =====
// Phase 2改修: DrawingEngine → BrushCore統合
// Phase 2完全修正: LayerPanelRenderer初期化追加
// 修正1: SettingsManager初期化をpopup登録前に移動
// 修正2: ExportPopup登録をExportManager完全初期化後に実行
// 修正3: LayerPanelRenderer初期化追加（Phase 2対応）

window.CoreInitializer = (function() {
    'use strict';

    function checkDependencies() {
        const dependencies = [
            { name: 'PIXI', obj: window.PIXI },
            { name: 'TEGAKI_CONFIG', obj: window.TEGAKI_CONFIG },
            { name: 'TegakiEventBus', obj: window.TegakiEventBus },
            { name: 'TegakiPopupManager', obj: window.TegakiPopupManager },
            { name: 'TegakiSettingsManager', obj: window.TegakiSettingsManager },
            { name: 'Sortable', obj: window.Sortable },
            { name: 'pako', obj: window.pako },
            { name: 'UPNG', obj: window.UPNG },
            { name: 'GIF', obj: window.GIF },
            { name: 'DOMBuilder', obj: window.DOMBuilder },
            { name: 'KeyboardHandler', obj: window.KeyboardHandler }
        ];
        
        const missing = dependencies.filter(dep => !dep.obj);
        if (missing.length > 0) {
            throw new Error(`Dependencies not loaded: ${missing.map(d => d.name).join(', ')}`);
        }
        
        if (!window.TEGAKI_CONFIG.animation) {
            throw new Error('Animation configuration not found');
        }
        
        if (!window.CoreRuntime || !window.TegakiCore?.CoreEngine) {
            throw new Error('CoreRuntime or CoreEngine not loaded');
        }
        
        // Phase 2: BrushCore依存確認
        if (!window.BrushCore) {
            throw new Error('BrushCore not loaded - check script load order');
        }
        
        return true;
    }

    function buildDOM() {
        const appContainer = document.getElementById('app');
        if (!appContainer) throw new Error('#app container not found');
        
        const mainLayout = window.DOMBuilder.buildMainLayout();
        appContainer.appendChild(mainLayout);
        
        const statusPanel = window.DOMBuilder.buildStatusPanel();
        document.body.appendChild(statusPanel);
    }

    // ★ 修正1: SettingsManagerを先に初期化してグローバルに配置
    function initializeSettingsManager() {
        if (window.settingsManager) {
            return window.settingsManager;
        }
        
        const settingsManager = new window.TegakiSettingsManager(
            window.TegakiEventBus,
            window.TEGAKI_CONFIG
        );
        window.settingsManager = settingsManager;
        window.TegakiSettingsManager = settingsManager;
        
        console.log('✅ SettingsManager initialized');
        return settingsManager;
    }

    // ★★★ Phase 2完全修正: LayerPanelRenderer初期化 ★★★
    function initializeLayerPanelRenderer(layerSystem, animationSystem) {
        if (!window.TegakiUI?.LayerPanelRenderer) {
            console.warn('⚠️ LayerPanelRenderer not found - skipping initialization');
            return null;
        }
        
        const container = document.getElementById('layer-list');
        if (!container) {
            console.warn('⚠️ #layer-list container not found');
            return null;
        }
        
        const layerPanelRenderer = new window.TegakiUI.LayerPanelRenderer();
        layerPanelRenderer.init(container, layerSystem, animationSystem);
        
        // グローバル参照を複数箇所に設定（診断コマンド対応）
        window.TegakiUI.layerPanelRenderer = layerPanelRenderer;
        
        if (!window.CoreRuntime.internal) {
            window.CoreRuntime.internal = {};
        }
        window.CoreRuntime.internal.layerPanelRenderer = layerPanelRenderer;
        
        console.log('✅ LayerPanelRenderer initialized and registered');
        console.log('   - window.TegakiUI.layerPanelRenderer');
        console.log('   - window.CoreRuntime.internal.layerPanelRenderer');
        
        return layerPanelRenderer;
    }

    function initializePopupManager(app, coreEngine) {
        const popupManager = new window.TegakiPopupManager(window.TegakiEventBus);
        
        const brushSettings = coreEngine.getBrushSettings();
        
        // Phase 2: BrushCoreを渡す（DrawingEngine廃止）
        const brushCore = coreEngine.getBrushCore();
        
        popupManager.register('settings', window.TegakiUI.SettingsPopup, {
            brushCore: brushCore, // Phase 2: 追加
            drawingEngine: brushCore // Phase 2: 互換性維持
        }, { priority: 1 });
        
        popupManager.register('quickAccess', window.TegakiUI.QuickAccessPopup, {
            brushCore: brushCore, // Phase 2: 追加
            drawingEngine: brushCore, // Phase 2: 互換性維持
            eventBus: window.TegakiEventBus,
            brushSettings: brushSettings
        }, { priority: 2 });
        
        popupManager.register('album', window.TegakiUI.AlbumPopup, {
            app: app.pixiApp,
            layerSystem: coreEngine.getLayerManager(),
            animationSystem: coreEngine.animationSystem
        }, { 
            priority: 3,
            waitFor: ['animationSystem']
        });
        
        popupManager.register('resize', window.TegakiUI.ResizePopup, {
            coreEngine: coreEngine,
            history: window.History
        }, { priority: 4 });
        
        // exportは後で登録（ExportManager初期化後）
        
        popupManager.initializeAll();
        window.PopupManager = popupManager;
        
        return popupManager;
    }

    function setupEventBusListeners() {
        const eventBus = window.TegakiEventBus;
        if (!eventBus) return;

        // StatusDisplayRendererに引数を渡す
        const statusDisplay = new window.TegakiUI.StatusDisplayRenderer(
            window.TegakiEventBus,
            window.settingsManager
        );
        statusDisplay.setupEventListeners();
        window.StatusDisplayRenderer = statusDisplay;
    }

    class DrawingApp {
        constructor() {
            this.pixiApp = null;
            this.coreEngine = null;
            this.uiController = null;
            this.popupManager = null;
            this.layerPanelRenderer = null;
            this.exportInitialized = false;
        }
        
        async initialize() {
            const CONFIG = window.TEGAKI_CONFIG;
            const CoreEngine = window.TegakiCore.CoreEngine;
            const UIController = window.TegakiUI.UIController;
            
            if (!UIController) throw new Error('UIController not found');
            
            const containerEl = document.getElementById('drawing-canvas');
            if (!containerEl) throw new Error('Canvas container not found');
            
            this.pixiApp = new PIXI.Application();
            const screenWidth = window.innerWidth - 50;
            const screenHeight = window.innerHeight;
            
            await this.pixiApp.init({
                width: screenWidth,
                height: screenHeight,
                backgroundAlpha: 0,
                resolution: 1,
                antialias: true,
                eventMode: 'static'
            });
            
            containerEl.innerHTML = '';
            containerEl.appendChild(this.pixiApp.canvas);
            this.pixiApp.canvas.style.width = `${screenWidth}px`;
            this.pixiApp.canvas.style.height = `${screenHeight}px`;
            
            this.coreEngine = new CoreEngine(this.pixiApp);
            
            const drawingApp = this.coreEngine.initialize();
            
            window.coreEngine = this.coreEngine;
            
            const brushSettings = this.coreEngine.getBrushSettings();
            window.BrushSettings = brushSettings;
            
            // Phase 2: BrushCore参照を追加
            const brushCore = this.coreEngine.getBrushCore();
            
            window.CoreRuntime.init({
                app: this.pixiApp,
                worldContainer: this.coreEngine.getCameraSystem().worldContainer,
                canvasContainer: this.coreEngine.getCameraSystem().canvasContainer,
                cameraSystem: this.coreEngine.getCameraSystem(),
                layerManager: this.coreEngine.getLayerManager(),
                brushCore: brushCore, // Phase 2: 追加
                drawingEngine: brushCore // Phase 2: 互換性維持
            });
            
            // ★ 修正1: SettingsManagerを先に初期化
            initializeSettingsManager();
            
            // Phase 2: UIControllerにもBrushCoreを渡す
            this.uiController = new UIController(
                brushCore, // Phase 2: BrushCore
                this.coreEngine.getLayerManager(), 
                this.pixiApp
            );

            this.popupManager = initializePopupManager(this, this.coreEngine);
            
            setupEventBusListeners();
            
            // ★★★ Phase 2完全修正: LayerPanelRenderer初期化 ★★★
            // AnimationSystem初期化後に実行（依存関係考慮）
            setTimeout(() => {
                this.layerPanelRenderer = initializeLayerPanelRenderer(
                    this.coreEngine.getLayerManager(),
                    this.coreEngine.getAnimationSystem()
                );
                
                // 初回レンダリング
                if (this.layerPanelRenderer) {
                    const layers = this.coreEngine.getLayerManager().getLayers();
                    const activeIndex = this.coreEngine.getLayerManager().activeLayerIndex;
                    this.layerPanelRenderer.render(
                        layers, 
                        activeIndex, 
                        this.coreEngine.getAnimationSystem()
                    );
                }
            }, 100);
            
            // ★ 修正2: ExportSystem初期化
            this.initializeExportSystem();
            
            window.drawingAppResizeCanvas = (newWidth, newHeight) => {
                return window.CoreRuntime.api.resizeCanvas(newWidth, newHeight);
            };
            
            this.setupEventListeners();
            this.updateCanvasInfo();
            this.updateDPRInfo();
            this.startFPSMonitor();
            
            return true;
        }
        
        // ★ 修正2: ExportManager初期化完了後にExportPopupを登録
        initializeExportSystem() {
            let retryCount = 0;
            const maxRetries = 30;
            
            const tryInit = () => {
                retryCount++;
                
                // 依存関係チェック
                if (!window.animationSystem || !window.CoreRuntime) {
                    if (retryCount < maxRetries) {
                        setTimeout(tryInit, 200);
                    }
                    return;
                }
                
                if (!window.ExportManager || !window.PNGExporter || 
                    !window.APNGExporter || !window.GIFExporter) {
                    if (retryCount < maxRetries) {
                        setTimeout(tryInit, 200);
                    }
                    return;
                }
                
                // ExportManagerを初期化
                const success = window.CoreRuntime.initializeExportSystem(
                    this.pixiApp,
                    () => {
                        // ★ コールバック: ExportManager初期化成功後にExportPopupを登録
                        if (!this.exportInitialized && 
                            window.PopupManager && 
                            window.TEGAKI_EXPORT_MANAGER &&
                            window.TegakiExportPopup) {
                            
                            window.PopupManager.register('export', window.TegakiExportPopup, {
                                exportManager: window.TEGAKI_EXPORT_MANAGER
                            }, { 
                                priority: 5,
                                waitFor: []
                            });
                            
                            // 即座に初期化
                            setTimeout(() => {
                                window.PopupManager.initialize('export');
                                this.exportInitialized = true;
                                console.log('✅ ExportPopup registered and initialized');
                            }, 100);
                        }
                        
                        if (window.TegakiEventBus) {
                            window.TegakiEventBus.emit('export:manager:initialized');
                        }
                    }
                );
                
                if (!success && retryCount < maxRetries) {
                    setTimeout(tryInit, 200);
                }
            };
            
            // EventBusリスナー登録
            if (window.TegakiEventBus) {
                window.TegakiEventBus.on('animation:system-ready', tryInit);
                window.TegakiEventBus.on('animation:initialized', tryInit);
            }
            
            // 初回トライ
            setTimeout(tryInit, 300);
        }
        
        setupEventListeners() {
            window.addEventListener('resize', () => {
                const newWidth = window.innerWidth - 50;
                const newHeight = window.innerHeight;
                this.pixiApp.renderer.resize(newWidth, newHeight);
                this.pixiApp.canvas.style.width = `${newWidth}px`;
                this.pixiApp.canvas.style.height = `${newHeight}px`;
                const cameraSystem = this.coreEngine.getCameraSystem();
                cameraSystem.initializeCamera();
                cameraSystem.updateGuideLinesForCanvasResize();
            });
        }
        
        updateCanvasInfo() {
            const CONFIG = window.TEGAKI_CONFIG;
            const element = document.getElementById('canvas-info');
            if (element) {
                element.textContent = `${CONFIG.canvas.width}×${CONFIG.canvas.height}px`;
            }
        }
        
        updateDPRInfo() {
            const element = document.getElementById('dpr-info');
            if (element) {
                element.textContent = (window.devicePixelRatio || 1).toFixed(1);
            }
        }
        
        startFPSMonitor() {
            let frameCount = 0;
            let lastTime = performance.now();
            
            const updateFPS = () => {
                frameCount++;
                const currentTime = performance.now();
                
                if (currentTime - lastTime >= 1000) {
                    const fps = Math.round((frameCount * 1000) / (currentTime - lastTime));
                    const element = document.getElementById('fps');
                    if (element) element.textContent = fps;
                    frameCount = 0;
                    lastTime = currentTime;
                }
                requestAnimationFrame(updateFPS);
            };
            updateFPS();
        }
    }

    async function initialize() {
        checkDependencies();
        buildDOM();
        
        if (window.KeyboardHandler && window.KeyboardHandler.init) {
            window.KeyboardHandler.init();
            document._keyboardHandlerInitialized = true;
        }
        
        const app = new DrawingApp();
        await app.initialize();
        
        window.drawingAppInstance = app;
        
        if (window.ResizeSlider) {
            setTimeout(() => window.ResizeSlider.init(), 100);
        }
        
        return true;
    }

    return {
        initialize,
        checkDependencies,
        DrawingApp
    };
})();

console.log('✅ core-initializer.js (Phase 2統合版: BrushCore対応) loaded');
console.log('   ✓ Phase 2: DrawingEngine → BrushCore統合');
console.log('   ✓ Phase 2: LayerPanelRenderer初期化追加');
console.log('   ✓ グローバル参照: TegakiUI.layerPanelRenderer');
console.log('   ✓ グローバル参照: CoreRuntime.internal.layerPanelRenderer');