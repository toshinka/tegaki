// Tegaki Tool - Core Initializer Module
// Phase1: 初期化順序の明確化と BrushSettings 確実生成

window.CoreInitializer = (function() {
    'use strict';

    function checkDependencies() {
        const dependencies = [
            { name: 'PIXI', obj: window.PIXI },
            { name: 'TEGAKI_CONFIG', obj: window.TEGAKI_CONFIG },
            { name: 'TegakiEventBus', obj: window.TegakiEventBus },
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
        
        // BrushSettingsクラスの存在確認
        if (!window.TegakiDrawing?.BrushSettings && !window.BrushSettings) {
            throw new Error('BrushSettings class not loaded');
        }
        
        return true;
    }

    function buildDOM() {
        const appContainer = document.getElementById('app');
        if (!appContainer) {
            throw new Error('#app container not found');
        }
        
        const mainLayout = window.DOMBuilder.buildMainLayout();
        appContainer.appendChild(mainLayout);
        
        const statusPanel = window.DOMBuilder.buildStatusPanel();
        document.body.appendChild(statusPanel);
    }

    function initializeSettingsManager(eventBus, config) {
        if (!window.TegakiSettingsManager) {
            throw new Error('SettingsManager class not found');
        }

        if (window.TegakiSettingsManager.prototype === undefined) {
            return window.TegakiSettingsManager;
        }

        const settingsManager = new window.TegakiSettingsManager(eventBus, config);
        window.TegakiSettingsManager = settingsManager;
        
        return settingsManager;
    }

    function initializeToolSizeManager(eventBus, config) {
        if (!window.ToolSizeManager) {
            return null;
        }
        
        try {
            const toolSizeManager = new window.ToolSizeManager(config, eventBus);
            window.toolSizeManager = toolSizeManager;
            return toolSizeManager;
        } catch (error) {
            return null;
        }
    }

    function initializeDragVisualFeedback(eventBus, config) {
        if (!window.DragVisualFeedback) {
            return null;
        }
        
        try {
            const dragVisualFeedback = new window.DragVisualFeedback(config, eventBus);
            window.dragVisualFeedback = dragVisualFeedback;
            return dragVisualFeedback;
        } catch (error) {
            return null;
        }
    }

    class DrawingApp {
        constructor() {
            this.pixiApp = null;
            this.coreEngine = null;
            this.uiController = null;
            this.settingsManager = null;
            this.toolSizeManager = null;
            this.dragVisualFeedback = null;
        }
        
        async initialize() {
            const CONFIG = window.TEGAKI_CONFIG;
            const CoreEngine = window.TegakiCore.CoreEngine;
            const { UIController } = window.TegakiUI;
            
            const containerEl = document.getElementById('drawing-canvas');
            if (!containerEl) throw new Error('Canvas container not found');
            
            // Phase1: PixiJS初期化
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
            
            // Phase1: CoreEngine初期化（この中でDrawingEngineが生成される）
            this.coreEngine = new CoreEngine(this.pixiApp);
            const drawingApp = this.coreEngine.initialize();
            
            window.coreEngine = this.coreEngine;
            
            // Phase1: DrawingEngineの取得
            const drawingEngine = this.coreEngine.getDrawingEngine();
            
            // Phase1: グローバル参照設定（ToolSizeManagerからアクセス可能にする）
            window.drawingEngine = drawingEngine;
            
            // Phase1: DrawingEngine.settingsの確認と必要に応じて強制初期化
            if (!drawingEngine?.settings) {
                console.warn('⚠️ DrawingEngine.settings not initialized, attempting manual initialization...');
                
                const BrushSettingsClass = window.TegakiDrawing?.BrushSettings || window.BrushSettings;
                if (BrushSettingsClass) {
                    try {
                        drawingEngine.settings = new BrushSettingsClass(CONFIG, window.TegakiEventBus);
                        console.log('✅ DrawingEngine.settings manually initialized');
                        
                        if (window.TegakiEventBus) {
                            window.TegakiEventBus.emit('brush:initialized', { settings: drawingEngine.settings });
                        }
                    } catch (error) {
                        console.error('❌ Failed to manually initialize DrawingEngine.settings:', error);
                        throw new Error('DrawingEngine.settings initialization failed');
                    }
                } else {
                    throw new Error('BrushSettings class not found');
                }
            }
            
            // Phase1: SettingsManager初期化
            this.settingsManager = initializeSettingsManager(
                window.TegakiEventBus,
                CONFIG
            );
            
            // Phase1: ToolSizeManager初期化（DrawingEngine.settings準備後）
            this.toolSizeManager = initializeToolSizeManager(
                window.TegakiEventBus,
                CONFIG
            );
            
            // Phase1: DragVisualFeedback初期化
            this.dragVisualFeedback = initializeDragVisualFeedback(
                window.TegakiEventBus,
                CONFIG
            );
            
            CoreRuntime.init({
                app: this.pixiApp,
                worldContainer: this.coreEngine.getCameraSystem().worldContainer,
                canvasContainer: this.coreEngine.getCameraSystem().canvasContainer,
                cameraSystem: this.coreEngine.getCameraSystem(),
                layerManager: this.coreEngine.getLayerManager(),
                drawingEngine: this.coreEngine.getDrawingEngine(),
                settingsManager: this.settingsManager
            });
            
            if (window.KeyboardHandler) {
                window.KeyboardHandler.init();
            }
            
            this.uiController = new UIController(
                this.coreEngine.getDrawingEngine(), 
                this.coreEngine.getLayerManager(), 
                this.pixiApp
            );

            this.initializeSettingsPopupDelayed();

            if (this.coreEngine.animationSystem) {
                this.uiController.initializeAlbumPopup(
                    this.coreEngine.animationSystem
                );
            }
            
            window.drawingAppResizeCanvas = (newWidth, newHeight) => {
                return CoreRuntime.api.resizeCanvas(newWidth, newHeight);
            };
            
            this.setupEventListeners();
            this.updateCanvasInfo();
            this.updateDPRInfo();
            this.startFPSMonitor();
            
            window.drawingApp = drawingApp;
            return true;
        }
        
        initializeSettingsPopupDelayed() {
            const maxRetries = 20;
            let retryCount = 0;
            
            const tryInitialize = () => {
                if (window.TegakiUI?.SettingsPopup) {
                    try {
                        if (this.uiController) {
                            const success = this.uiController.initializeSettingsPopup();
                            if (success) {
                                return;
                            }
                        }
                    } catch (error) {
                    }
                }
                
                retryCount++;
                if (retryCount < maxRetries) {
                    setTimeout(tryInitialize, 50);
                }
            };
            
            setTimeout(tryInitialize, 0);
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

    function setupHistoryIntegration() {
        if (window.TegakiEventBus && window.History) {
            window.TegakiEventBus.on('history:changed', (data) => {
                const historyElement = document.getElementById('history-info');
                if (historyElement && data) {
                    const currentIndex = data.currentIndex + 1;
                    const stackSize = data.stackSize;
                    historyElement.textContent = `${currentIndex}/${stackSize}`;
                }
            });
        }
    }

    function initializeExportSystem(app) {
        const initExportWithRetry = () => {
            let retryCount = 0;
            const maxRetries = 20;
            
            const tryInit = () => {
                if (!window.animationSystem) {
                    retryCount++;
                    if (retryCount < maxRetries) {
                        setTimeout(tryInit, 200);
                    }
                    return;
                }
                
                if (!window.CoreRuntime) {
                    retryCount++;
                    if (retryCount < maxRetries) {
                        setTimeout(tryInit, 200);
                    }
                    return;
                }
                
                const success = window.CoreRuntime.initializeExportSystem(
                    app.pixiApp,
                    () => {}
                );
                
                if (success) {
                    if (!window.TEGAKI_EXPORT_POPUP && !window.exportPopup) {
                        if (window.ExportPopup && window.TEGAKI_EXPORT_MANAGER) {
                            try {
                                window.TEGAKI_EXPORT_POPUP = new window.ExportPopup(window.TEGAKI_EXPORT_MANAGER);
                                window.exportPopup = window.TEGAKI_EXPORT_POPUP;
                            } catch (error) {
                            }
                        }
                    }
                    return;
                }
                
                retryCount++;
                if (retryCount < maxRetries) {
                    setTimeout(tryInit, 200);
                }
            };
            
            tryInit();
        };
        
        if (window.TegakiEventBus) {
            window.TegakiEventBus.on('animation:system-ready', initExportWithRetry);
            window.TegakiEventBus.on('animation:initialized', initExportWithRetry);
        }
        
        setTimeout(initExportWithRetry, 500);
    }

    function runDiagnostics() {
        if (window.CoordinateSystem?.diagnoseReferences) {
            window.CoordinateSystem.diagnoseReferences();
        }
        
        if (window.SystemDiagnostics) {
            setTimeout(() => {
                try {
                    const diagnostics = new window.SystemDiagnostics();
                    diagnostics.runFullDiagnostics();
                } catch (diagError) {}
            }, 1000);
        }
    }

    async function initialize() {
        try {
            checkDependencies();
            
            buildDOM();
            
            const app = new DrawingApp();
            await app.initialize();
            
            window.drawingAppInstance = app;
            
            setupHistoryIntegration();
            
            initializeExportSystem(app);
            
            if (window.ResizeSlider) {
                setTimeout(() => {
                    window.ResizeSlider.init();
                }, 100);
            }
            
            runDiagnostics();
            
            return true;
        } catch (error) {
            console.error('Initialization failed:', error);
            throw error;
        }
    }

    return {
        initialize,
        checkDependencies,
        DrawingApp
    };
})();