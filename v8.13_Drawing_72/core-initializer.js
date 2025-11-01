// ===== core-initializer.js - Phase 4-A: WebGPU初期化追加版 =====

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
        
        console.log('✅ SettingsManager initialized');
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

    /**
     * Phase 4-A: WebGPU初期化
     */
    async function initializeWebGPU(canvas, strokeRenderer) {
        const config = window.TEGAKI_CONFIG;
        
        // WebGPU無効化設定の場合はスキップ
        if (!config.webgpu?.enabled) {
            console.log('[WebGPU] Disabled by config');
            return false;
        }

        // WebGPUCapabilitiesチェック
        if (!window.WebGPUCapabilities) {
            console.warn('[WebGPU] WebGPUCapabilities not loaded');
            return false;
        }

        try {
            // WebGPU対応チェック
            const capabilities = await window.WebGPUCapabilities.checkSupport();
            
            if (!capabilities.supported) {
                console.warn('[WebGPU] Not supported:', capabilities.error);
                return false;
            }

            // WebGPUDrawingLayer初期化
            if (!window.WebGPUDrawingLayer) {
                console.warn('[WebGPU] WebGPUDrawingLayer not loaded');
                return false;
            }

            const webgpuLayer = new window.WebGPUDrawingLayer(canvas);
            const initialized = await webgpuLayer.initialize();

            if (!initialized) {
                console.warn('[WebGPU] Initialization failed');
                return false;
            }

            // StrokeRendererにWebGPUレイヤーを設定
            if (strokeRenderer && strokeRenderer.setWebGPULayer) {
                await strokeRenderer.setWebGPULayer(webgpuLayer);
                console.log('[WebGPU] Integration completed:', {
                    features: capabilities.features,
                    limits: capabilities.limits
                });
            }

            // グローバル参照保存
            window.webgpuLayer = webgpuLayer;

            return true;

        } catch (error) {
            console.error('[WebGPU] Initialization error:', error);
            return false;
        }
    }

    class DrawingApp {
        constructor() {
            this.pixiApp = null;
            this.coreEngine = null;
            this.uiController = null;
            this.popupManager = null;
            this.exportInitialized = false;
            this.webgpuEnabled = false;
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
            
            window.CoreRuntime.init({
                app: this.pixiApp,
                worldContainer: this.coreEngine.getCameraSystem().worldContainer,
                canvasContainer: this.coreEngine.getCameraSystem().canvasContainer,
                cameraSystem: this.coreEngine.getCameraSystem(),
                layerManager: this.coreEngine.getLayerManager(),
                drawingEngine: this.coreEngine.getDrawingEngine()
            });
            
            initializeSettingsManager();
            
            this.uiController = new UIController(
                this.coreEngine.getDrawingEngine(), 
                this.coreEngine.getLayerManager(), 
                this.pixiApp
            );

            this.popupManager = initializePopupManager(this, this.coreEngine);
            
            setupEventBusListeners();
            
            // ✅ Phase 4-A: WebGPU初期化
            const strokeRenderer = this.coreEngine.getDrawingEngine()?.strokeRenderer;
            if (strokeRenderer) {
                this.webgpuEnabled = await initializeWebGPU(
                    this.pixiApp.canvas,
                    strokeRenderer
                );
                
                if (this.webgpuEnabled) {
                    console.log('✅ WebGPU enabled for SDF generation');
                } else {
                    console.log('⚠️ WebGPU not available, using legacy rendering');
                }
            }
            
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
        
        initializeExportSystem() {
            let retryCount = 0;
            const maxRetries = 30;
            
            const tryInit = () => {
                retryCount++;
                
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
                
                const success = window.CoreRuntime.initializeExportSystem(
                    this.pixiApp,
                    () => {
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
                            
                            setTimeout(() => {
                                window.PopupManager.initialize('export');
                                this.exportInitialized = true;
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
            
            if (window.TegakiEventBus) {
                window.TegakiEventBus.on('animation:system-ready', tryInit);
                window.TegakiEventBus.on('animation:initialized', tryInit);
            }
            
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
        DrawingApp,
        initializeWebGPU
    };
})();

console.log('✅ core-initializer.js (Phase 4-A: WebGPU初期化追加版) loaded');