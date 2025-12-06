/**
 * ================================================================
 * [PART 1/2] Dependencies & Initialization
 * ================================================================
 * ⚠️ このファイルは2パートに分割されています
 * ⚠️ 各パートを順番にコピペして結合してください
 * ================================================================
 */

/**
 * @file core-initializer.js - Phase 5.2: ラスター対応版
 * @description アプリケーション初期化シーケンス制御
 * 
 * 【Phase 5.2 改修内容】
 * ✅ ラスターシステム初期化追加
 * ✅ WebGL2DrawingLayer初期化
 * ✅ RasterLayer初期化
 * ✅ RasterBrushCore初期化
 * ✅ Phase 4.1全機能継承
 * 
 * 【親依存】
 * - core-engine.js (CoreEngine)
 * - core-runtime.js (CoreRuntime)
 * - ui-panels.js (UIController)
 * - webgl2-drawing-layer.js (WebGL2DrawingLayer)
 * - raster-layer.js (RasterLayer)
 * - raster-brush-core.js (RasterBrushCore)
 */

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
            { name: 'KeyboardHandler', obj: window.KeyboardHandler },
            { name: 'TegakiUI', obj: window.TegakiUI }
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
        
        return settingsManager;
    }

    function initializePopupManager(app, coreEngine) {
        const popupManager = new window.TegakiPopupManager(window.TegakiEventBus);
        
        const brushSettings = coreEngine.getBrushSettings();
        
        popupManager.register('settings', window.TegakiUI.SettingsPopup, {
            drawingEngine: coreEngine.getDrawingEngine()
        }, { priority: 1 });
        
        popupManager.register('quickAccess', window.TegakiUI.QuickAccessPopup, {
            drawingEngine: coreEngine.getDrawingEngine(),
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
        
        popupManager.initializeAll();
        window.PopupManager = popupManager;
        
        return popupManager;
    }

    function setupEventBusListeners() {
        const eventBus = window.TegakiEventBus;
        if (!eventBus) return;

        const statusDisplay = new window.TegakiUI.StatusDisplayRenderer(
            window.TegakiEventBus,
            window.settingsManager
        );
        statusDisplay.setupEventListeners();
        window.StatusDisplayRenderer = statusDisplay;
    }

    function initializeLayerPanel(layerSystem, eventBus) {
        if (!window.LayerPanelRenderer) {
            console.warn('[CoreInit] LayerPanelRenderer not loaded');
            return null;
        }

        const container = document.getElementById('layer-list');
        if (!container) {
            console.warn('[CoreInit] #layer-list container not found');
            return null;
        }

        const layerPanelRenderer = new window.LayerPanelRenderer(
            container,
            layerSystem,
            eventBus
        );

        const layers = layerSystem.getLayers();
        const activeIndex = layerSystem.getActiveLayerIndex();
        layerPanelRenderer.render(layers, activeIndex, null);

        window.layerPanelRenderer = layerPanelRenderer;
        
        return layerPanelRenderer;
    }

    /**
     * WebGL2初期化（ラスター版）
     */
    async function initializeWebGL2(canvas) {
        console.log('[WebGL2] Starting raster initialization...');

        try {
            if (!window.WebGL2DrawingLayer) {
                console.error('[WebGL2] WebGL2DrawingLayer not found');
                return false;
            }

            if (!canvas) {
                console.error('[WebGL2] Canvas not provided');
                return false;
            }

            const width = window.TEGAKI_CONFIG.canvas.width;
            const height = window.TEGAKI_CONFIG.canvas.height;

            console.log('[WebGL2] Initializing with canvas:', canvas.width, 'x', canvas.height);
            console.log('[WebGL2] Target size:', width, 'x', height);

            // WebGL2DrawingLayer初期化
            const success = await window.WebGL2DrawingLayer.initialize(canvas, width, height);
            
            if (!success) {
                console.error('[WebGL2] DrawingLayer initialization failed');
                return false;
            }

            console.log('[WebGL2] ✅ DrawingLayer initialized');

            // Pixi統合
            if (window.pixiApp) {
                window.WebGL2DrawingLayer.setPixiApp(window.pixiApp);
            }

            // RasterLayer確認
            if (window.RasterLayer && window.RasterLayer.initialized) {
                console.log('[WebGL2] ✅ RasterLayer ready');
            } else {
                console.warn('[WebGL2] ⚠️ RasterLayer not initialized');
            }

            // RasterBrushCore確認
            if (window.RasterBrushCore && window.RasterBrushCore.initialized) {
                console.log('[WebGL2] ✅ RasterBrushCore ready');
            } else {
                console.warn('[WebGL2] ⚠️ RasterBrushCore not initialized');
            }

            // BrushStamp確認
            if (window.BrushStamp) {
                console.log('[WebGL2] ✅ BrushStamp ready');
            }

            // BrushInterpolator確認
            if (window.BrushInterpolator) {
                console.log('[WebGL2] ✅ BrushInterpolator ready');
            }

            // デバッグオブジェクト登録
            if (window.TegakiDebug) {
                window.TegakiDebug.webgl2Layer = window.WebGL2DrawingLayer;
                window.TegakiDebug.rasterLayer = window.RasterLayer;
                window.TegakiDebug.rasterBrush = window.RasterBrushCore;
            }

            return true;

        } catch (error) {
            console.error('[WebGL2] Raster initialization error:', error);
            return false;
        }
    }

/**
 * ================================================================
 * [END PART 1] - 次は PART 2 をこの下に貼り付けてください
 * ================================================================
 */


/**
 * ================================================================
 * [PART 2/2] DrawingApp Class & Main Logic
 * ================================================================
 * ⚠️ PART 1 の下にこのコードを貼り付けてください
 * ================================================================
 */

    class DrawingApp {
        constructor() {
            this.pixiApp = null;
            this.coreEngine = null;
            this.uiController = null;
            this.popupManager = null;
            this.layerPanelRenderer = null;
            this.exportInitialized = false;
            this.webgl2Enabled = false;
        }
        
        async initialize() {
            const CONFIG = window.TEGAKI_CONFIG;
            const CoreEngine = window.TegakiCore.CoreEngine;
            
            if (!window.TegakiUI || !window.TegakiUI.UIController) {
                throw new Error('UIController not found - ui-panels.js may not be loaded');
            }
            
            const UIController = window.TegakiUI.UIController;
            
            const containerEl = document.getElementById('drawing-canvas');
            if (!containerEl) throw new Error('Canvas container not found');
            
            this.pixiApp = new PIXI.Application();
            const screenWidth = window.innerWidth - 50;
            const screenHeight = window.innerHeight;
            
            // Phase 4.1: アンチエイリアス強化設定
            await this.pixiApp.init({
                width: screenWidth,
                height: screenHeight,
                backgroundAlpha: 0,
                resolution: 2,              // 高解像度レンダリング
                antialias: true,            // AA有効
                autoDensity: true,          // DPR自動対応
                eventMode: 'static',
                preference: 'webgl2',       // WebGL2優先
                powerPreference: 'high-performance' // 高性能モード
            });
            
            containerEl.innerHTML = '';
            containerEl.appendChild(this.pixiApp.canvas);
            this.pixiApp.canvas.style.width = `${screenWidth}px`;
            this.pixiApp.canvas.style.height = `${screenHeight}px`;
            
            window.pixiApp = this.pixiApp;
            
            if (!this.pixiApp.ticker.started) {
                this.pixiApp.ticker.start();
                console.log('[DrawingApp] ✅ Pixi Ticker started');
            }
            
            // Phase 4.1: AA設定確認
            console.log('[DrawingApp] ✅ Resolution:', this.pixiApp.renderer.resolution);
            console.log('[DrawingApp] ✅ Antialias:', this.pixiApp.renderer.context.contextOptions?.antialias);
            
            this.coreEngine = new CoreEngine(this.pixiApp);
            const drawingApp = this.coreEngine.initialize();
            
            window.coreEngine = this.coreEngine;
            
            const brushSettings = this.coreEngine.getBrushSettings();
            window.brushSettings = brushSettings;
            
            window.CoreRuntime.init({
                app: this.pixiApp,
                worldContainer: this.coreEngine.getCameraSystem().worldContainer,
                canvasContainer: this.coreEngine.getCameraSystem().canvasContainer,
                cameraSystem: this.coreEngine.getCameraSystem(),
                layerManager: this.coreEngine.getLayerManager(),
                drawingEngine: this.coreEngine.getDrawingEngine(),
                coreEngine: this.coreEngine
            });
            
            initializeSettingsManager();
            
            this.uiController = new UIController(
                this.coreEngine.getDrawingEngine(), 
                this.coreEngine.getLayerManager(), 
                this.pixiApp
            );
            window.uiController = this.uiController;

            this.popupManager = initializePopupManager(this, this.coreEngine);
            
            setupEventBusListeners();
            
            this.layerPanelRenderer = initializeLayerPanel(
                this.coreEngine.getLayerManager(),
                window.TegakiEventBus
            );
            
            // Phase 5.2: ラスター版WebGL2初期化
            console.log('[DrawingApp] Initializing WebGL2 (Raster mode)...');

            if (this.pixiApp.canvas) {
                this.webgl2Enabled = await initializeWebGL2(this.pixiApp.canvas);
                console.log('[DrawingApp] WebGL2 Raster result:', this.webgl2Enabled);
                
                if (this.webgl2Enabled) {
                    console.log('[DrawingApp] ✅ Raster drawing system ready');
                } else {
                    console.error('[DrawingApp] ❌ Raster drawing system failed');
                }
            } else {
                console.error('[DrawingApp] Canvas not found');
            }
            
            this.initializeExportPopup();
            
            window.drawingAppResizeCanvas = (newWidth, newHeight) => {
                return window.CoreRuntime.api.camera.resize(newWidth, newHeight);
            };
            
            this.setupEventListeners();
            this.updateCanvasInfo();
            this.updateDPRInfo();
            this.startFPSMonitor();
            
            return true;
        }
        
        initializeExportPopup() {
            let retryCount = 0;
            const maxRetries = 30;
            
            const tryRegisterPopup = () => {
                retryCount++;
                
                const exportManager = this.coreEngine?.getExportManager();
                
                if (!exportManager) {
                    if (retryCount < maxRetries) {
                        setTimeout(tryRegisterPopup, 200);
                    }
                    return;
                }
                
                if (!window.TegakiExportPopup) {
                    if (retryCount < maxRetries) {
                        setTimeout(tryRegisterPopup, 200);
                    }
                    return;
                }
                
                if (!this.exportInitialized && window.PopupManager) {
                    window.PopupManager.register('export', window.TegakiExportPopup, {
                        exportManager: exportManager
                    }, { 
                        priority: 5,
                        waitFor: []
                    });
                    
                    setTimeout(() => {
                        window.PopupManager.initialize('export');
                        this.exportInitialized = true;
                    }, 100);
                }
            };
            
            if (window.TegakiEventBus) {
                window.TegakiEventBus.on('export:manager-initialized', tryRegisterPopup);
            }
            
            setTimeout(tryRegisterPopup, 300);
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
        DrawingApp,
        initializeWebGL2,
        initializeLayerPanel
    };
})();

console.log('✅ core-initializer.js Phase 5.2 loaded (ラスター対応版)');
console.log('   ✅ WebGL2DrawingLayer初期化');
console.log('   ✅ RasterLayer統合');
console.log('   ✅ RasterBrushCore統合');
console.log('   ✅ Phase 4.1全機能継承');

/**
 * ================================================================
 * [END PART 2] - ファイル完成！
 * ================================================================
 */
