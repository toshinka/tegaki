// Tegaki Tool - Core Initializer Module
// DO NOT use ESM, only global namespace
// 修正: brush:initializedイベント駆動の初期化待ち合わせ

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
            
            this.settingsManager = initializeSettingsManager(
                window.TegakiEventBus,
                CONFIG
            );
            
            const drawingEngine = this.coreEngine.getDrawingEngine();
            
            this.toolSizeManager = initializeToolSizeManager(
                window.TegakiEventBus,
                CONFIG
            );
            
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
            
            await this._linkToolSizeManager(drawingEngine);
            
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
        
        async _linkToolSizeManager(drawingEngine) {
            if (!this.toolSizeManager || !drawingEngine) return;

            const attemptLink = (brushSettingsInstance) => {
                try {
                    this.toolSizeManager.brushSettings = brushSettingsInstance;
                    
                    const penSize = brushSettingsInstance.getBrushSize?.() ?? brushSettingsInstance.size;
                    const penOpacity = brushSettingsInstance.getBrushOpacity?.() ?? brushSettingsInstance.opacity;
                    
                    this.toolSizeManager.penSize = penSize;
                    this.toolSizeManager.penOpacity = penOpacity;
                } catch (e) {
                    console.error('Error linking ToolSizeManager', e);
                }
            };

            if (drawingEngine.settings) {
                attemptLink(drawingEngine.settings);
                return;
            }

            return new Promise((resolve) => {
                let timedOut = false;
                const timeoutId = setTimeout(() => {
                    timedOut = true;
                    resolve();
                }, 5000);

                const onBrushInit = ({ settings }) => {
                    if (timedOut) return;
                    clearTimeout(timeoutId);
                    attemptLink(settings);
                    resolve();
                };

                if (window.TegakiEventBus && typeof window.TegakiEventBus.once === 'function') {
                    window.TegakiEventBus.once('brush:initialized', onBrushInit);
                } else {
                    let retry = 0;
                    const poll = () => {
                        if (drawingEngine.settings) {
                            clearTimeout(timeoutId);
                            attemptLink(drawingEngine.settings);
                            resolve();
                            return;
                        }
                        retry++;
                        if (retry < 100 && !timedOut) {
                            setTimeout(poll, 20);
                        } else {
                            clearTimeout(timeoutId);
                            resolve();
                        }
                    };
                    poll();
                }
            });
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

console.log('✅ core-initializer.js loaded');