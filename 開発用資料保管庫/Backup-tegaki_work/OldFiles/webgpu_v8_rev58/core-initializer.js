/**
 * ================================================================================
 * core-initializer.js - Phase 2+3完全版
 * ================================================================================
 * 
 * 📁 親ファイル依存:
 *   - PIXI.js v8.14, config.js, event-bus.js
 * 
 * 📄 子ファイル初期化:
 *   - webgpu-drawing-layer.js
 *   - msdf-pipeline-manager.js
 *   - brush-core.js
 * 
 * 【Phase 2+3改修内容】
 * ✅ WebGPU初期化成功時のみPipeline生成
 * ✅ BrushCore強制再初期化
 * ✅ msdfAvailable強制設定
 * 
 * ================================================================================
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

    async function initializeWebGPU(strokeRenderer) {
        const config = window.TEGAKI_CONFIG;
        
        if (!config.webgpu?.enabled) {
            console.warn('[WebGPU] Disabled in config');
            return false;
        }

        try {
            if (!window.WebGPUDrawingLayer) {
                console.error('[WebGPU] WebGPUDrawingLayer not found');
                return false;
            }

            // 🔧 Phase 2: WebGPU初期化
            const drawingLayerInit = await window.WebGPUDrawingLayer.initialize();
            if (!drawingLayerInit) {
                console.warn('[WebGPU] Drawing Layer init failed, continuing without WebGPU');
                return false;
            }

            const device = window.WebGPUDrawingLayer.getDevice();
            const format = window.WebGPUDrawingLayer.getFormat();
            const sampleCount = window.WebGPUDrawingLayer.getSampleCount();

            // 🔧 Phase 3: Pipeline初期化
            if (!window.GPUStrokeProcessor) {
                console.error('[WebGPU] GPUStrokeProcessor not found');
                return false;
            }

            await window.GPUStrokeProcessor.initialize(device);

            if (!window.MSDFPipelineManager) {
                console.error('[WebGPU] MSDFPipelineManager not found');
                return false;
            }

            await window.MSDFPipelineManager.initialize(device, format, sampleCount);

            // 🔧 Pipeline強制生成
            await window.MSDFPipelineManager._createJFAPipeline();
            await window.MSDFPipelineManager._createEncodePipeline();
            await window.MSDFPipelineManager._createRenderPipeline();
            
            const pipelineCheck = {
                jfa: !!window.MSDFPipelineManager.jfaPipeline,
                encode: !!window.MSDFPipelineManager.encodePipeline,
                render: !!window.MSDFPipelineManager.polygonRenderPipeline
            };
            
            console.log('[WebGPU] Pipelines:', pipelineCheck);

            if (!window.WebGPUTextureBridge) {
                console.error('[WebGPU] WebGPUTextureBridge not found');
                return false;
            }

            const bridgeInit = await window.WebGPUTextureBridge.initialize();
            if (!bridgeInit) {
                console.error('[WebGPU] Texture Bridge init failed');
                return false;
            }

            if (window.WebGPUMaskLayer) {
                const canvasWidth = config.canvas?.width || 1920;
                const canvasHeight = config.canvas?.height || 1080;
                
                const maskLayer = new window.WebGPUMaskLayer(window.WebGPUDrawingLayer);
                maskLayer.width = canvasWidth;
                maskLayer.height = canvasHeight;
                maskLayer.device = device;
                maskLayer.queue = device.queue;
                
                window.webgpuMaskLayer = maskLayer;
            }

            if (!strokeRenderer) {
                console.error('[WebGPU] StrokeRenderer not provided');
                return false;
            }

            await strokeRenderer.initialize();

            if (typeof strokeRenderer.initMSDFMode === 'function') {
                strokeRenderer.initMSDFMode(null, device, format);
            }

            console.log('✅ [WebGPU] Full initialization complete');
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
            this.layerPanelRenderer = null;
            this.exportInitialized = false;
            this.webgpuEnabled = false;
        }
        
        async initialize() {
            const CONFIG = window.TEGAKI_CONFIG;
            const CoreEngine = window.TegakiCore.CoreEngine;
            
            if (!window.TegakiUI || !window.TegakiUI.UIController) {
                throw new Error('UIController not found');
            }
            
            // 🔧 WebGPU Device を最優先で確保（Pixi初期化前）
            let webgpuDevice = null;
            if (window.WebGPUDrawingLayer && CONFIG.webgpu?.enabled) {
                const drawingLayerInit = await window.WebGPUDrawingLayer.initialize();
                if (drawingLayerInit) {
                    webgpuDevice = window.WebGPUDrawingLayer.getDevice();
                    console.log('[App] WebGPU Device secured before Pixi init');
                }
            }
            
            const UIController = window.TegakiUI.UIController;
            
            const containerEl = document.getElementById('drawing-canvas');
            if (!containerEl) throw new Error('Canvas container not found');
            
            const screenWidth = window.innerWidth - 50;
            const screenHeight = window.innerHeight;
            
            this.pixiApp = new PIXI.Application();
            await this.pixiApp.init({
                width: screenWidth,
                height: screenHeight,
                backgroundColor: 0xFFFFEE,
                resolution: 1,
                antialias: false, // WebGPU競合回避
                eventMode: 'static',
                preference: 'webgl', // WebGL2のみ使用
                powerPreference: 'low-power', // GPU負荷を最小化
                hello: false,
                forceCanvas: false // WebGL強制
            });
            
            containerEl.innerHTML = '';
            containerEl.appendChild(this.pixiApp.canvas);
            this.pixiApp.canvas.style.width = `${screenWidth}px`;
            this.pixiApp.canvas.style.height = `${screenHeight}px`;
            
            // 🔧 Pixi Ticker完全停止（WebGPU競合回避）
            this.pixiApp.ticker.stop();
            this.pixiApp.ticker.autoStart = false;
            this.pixiApp.ticker.maxFPS = 0; // レンダリング無効化
            
            // 🔧 Stage相互作用完全無効化
            this.pixiApp.stage.eventMode = 'none';
            this.pixiApp.stage.interactiveChildren = false;
            this.pixiApp.stage.renderable = false; // レンダリング無効
            
            // 初回レンダリングのみ実行（UI構築用）
            this.pixiApp.renderer.render(this.pixiApp.stage);
            
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
            
            const strokeRenderer = window.strokeRenderer;
            
            if (!strokeRenderer) {
                console.error('[App] StrokeRenderer not found');
            } else if (webgpuDevice) {
                // 🔧 WebGPU Device が既に確保されている場合のみ初期化続行
                const format = window.WebGPUDrawingLayer.getFormat();
                const sampleCount = window.WebGPUDrawingLayer.getSampleCount();

                if (window.GPUStrokeProcessor) {
                    await window.GPUStrokeProcessor.initialize(webgpuDevice);
                }

                if (window.MSDFPipelineManager) {
                    await window.MSDFPipelineManager.initialize(webgpuDevice, format, sampleCount);
                    await window.MSDFPipelineManager._createJFAPipeline();
                    await window.MSDFPipelineManager._createEncodePipeline();
                    await window.MSDFPipelineManager._createRenderPipeline();
                }

                if (window.WebGPUTextureBridge) {
                    await window.WebGPUTextureBridge.initialize();
                }

                if (window.WebGPUMaskLayer) {
                    const canvasWidth = CONFIG.canvas?.width || 1920;
                    const canvasHeight = CONFIG.canvas?.height || 1080;
                    
                    const maskLayer = new window.WebGPUMaskLayer(window.WebGPUDrawingLayer);
                    maskLayer.width = canvasWidth;
                    maskLayer.height = canvasHeight;
                    maskLayer.device = webgpuDevice;
                    maskLayer.queue = webgpuDevice.queue;
                    
                    window.webgpuMaskLayer = maskLayer;
                }

                await strokeRenderer.initialize();
                if (typeof strokeRenderer.initMSDFMode === 'function') {
                    strokeRenderer.initMSDFMode(null, webgpuDevice, format);
                }

                this.webgpuEnabled = true;
                console.log('✅ [WebGPU] Full initialization complete');
                
                // 🔧 BrushCore強制再初期化
                if (window.BrushCore) {
                    window.BrushCore.initialized = false;
                    window.BrushCore.gpuStrokeProcessor = window.GPUStrokeProcessor;
                    window.BrushCore.msdfPipelineManager = window.MSDFPipelineManager;
                    window.BrushCore.textureBridge = window.WebGPUTextureBridge;
                    
                    await window.BrushCore.initialize();
                    window.BrushCore.msdfAvailable = true;
                    
                    console.log('✅ [BrushCore] Forced init:', {
                        initialized: window.BrushCore.initialized,
                        msdfAvailable: window.BrushCore.msdfAvailable
                    });
                }
                
                if (window.webgpuMaskLayer && window.BrushCore) {
                    window.BrushCore.webgpuMaskLayer = window.webgpuMaskLayer;
                }
            }
            
            this.initializeExportPopup();
            
            window.drawingAppResizeCanvas = (newWidth, newHeight) => {
                return window.CoreRuntime.api.camera.resize(newWidth, newHeight);
            };
            
            this.setupEventListeners();
            this.updateCanvasInfo();
            this.updateDPRInfo();
            this.startFPSMonitor();
            
            // 🔧 Render Loop: CoreEngine のみ使用（Pixi手動レンダリング無効）
            if (this.coreEngine.startRenderLoop) {
                this.coreEngine.startRenderLoop();
            }
            // 🔧 Pixi手動レンダリングループは起動しない（WebGPU競合回避）
            
            return true;
        }
        
        // 🔧 このメソッドは使用しない
        startManualRenderLoop() {
            // WebGPU競合回避のため、Pixiの手動レンダリングは無効化
            console.warn('[App] Pixi manual render loop disabled for WebGPU compatibility');
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
                
                const pixiCanvas = this.pixiApp.canvas;
                if (pixiCanvas) {
                    pixiCanvas.style.width = `${newWidth}px`;
                    pixiCanvas.style.height = `${newHeight}px`;
                }
                
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
        initializeWebGPU,
        initializeLayerPanel
    };
})();

console.log('✅ core-initializer.js Phase 2+3 loaded');