// ===== core-initializer.js - 座標統合版 完全修正版 =====

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
            // ✅ 統合座標システム依存性
            { name: 'TegakiCoordinateUnification', obj: window.TegakiCoordinateUnification },
            { name: 'TegakiLayerTransform', obj: window.TegakiLayerTransform },
            { name: 'TegakiCameraSystem', obj: window.TegakiCameraSystem },
            { name: 'TegakiLayerSystem', obj: window.TegakiLayerSystem },
        ];
        
        const missing = dependencies.filter(dep => !dep.obj);
        if (missing.length > 0) {
            throw new Error(`Dependencies not loaded: ${missing.map(d => d.name).join(', ')}`);
        }
        
        if (!window.TEGAKI_CONFIG.animation) {
            throw new Error('Animation configuration not found');
        }
        
        // ✅ 修正: CoreEngine の登録パスを修正
        if (!window.CoreRuntime) {
            throw new Error('CoreRuntime not loaded');
        }
        
        if (!window.TegakiCoreEngine) {
            throw new Error('CoreEngine not loaded (TegakiCoreEngine)');
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
        
        const brushSettings = coreEngine.brushSettings;
        
        popupManager.register('settings', window.TegakiUI.SettingsPopup, {
            drawingEngine: coreEngine.drawingEngine
        }, { priority: 1 });
        
        popupManager.register('quickAccess', window.TegakiUI.QuickAccessPopup, {
            drawingEngine: coreEngine.drawingEngine,
            eventBus: window.TegakiEventBus,
            brushSettings: brushSettings
        }, { priority: 2 });
        
        popupManager.register('album', window.TegakiUI.AlbumPopup, {
            app: app.pixiApp,
            layerSystem: coreEngine.layerSystem,
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

    class DrawingApp {
        constructor() {
            this.pixiApp = null;
            this.coreEngine = null;
            this.uiController = null;
            this.popupManager = null;
            this.exportInitialized = false;
        }
        
        async initialize() {
            const CONFIG = window.TEGAKI_CONFIG;
            // ✅ 修正: CoreEngine の登録パスを修正
            const CoreEngine = window.TegakiCoreEngine;
            const UIController = window.TegakiUI.UIController;
            
            if (!UIController) throw new Error('UIController not found');
            if (!CoreEngine) throw new Error('CoreEngine not found');
            
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
            
            // ✅ CoreEngine (統合版) をインスタンス化
            this.coreEngine = new CoreEngine(this.pixiApp);
            
            // ✅ CoreEngine 初期化（非同期）
            await this.coreEngine.initialize();
            
            window.coreEngine = this.coreEngine;
            
            const brushSettings = this.coreEngine.brushSettings;
            window.BrushSettings = brushSettings;
            
            // ✅ CoreRuntime 初期化
            window.CoreRuntime.init({
                app: this.pixiApp,
                worldContainer: this.coreEngine.cameraSystem.worldContainer,
                canvasContainer: this.coreEngine.cameraSystem.canvasContainer,
                cameraSystem: this.coreEngine.cameraSystem,
                layerManager: this.coreEngine.layerSystem,
                drawingEngine: this.coreEngine.drawingEngine
            });
            
            initializeSettingsManager();
            
            this.uiController = new UIController(
                this.coreEngine.drawingEngine, 
                this.coreEngine.layerSystem, 
                this.pixiApp
            );

            this.popupManager = initializePopupManager(this, this.coreEngine);
            
            setupEventBusListeners();
            
            this.initializeExportSystem();
            
            window.drawingAppResizeCanvas = (newWidth, newHeight) => {
                return window.CoreRuntime.updateCanvasSize(newWidth, newHeight);
            };
            
            this.setupEventListeners();
            this.updateCanvasInfo();
            this.updateDPRInfo();
            this.startFPSMonitor();
            
            console.log('✅ DrawingApp initialization complete');
            
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
                const cameraSystem = this.coreEngine.cameraSystem;
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
            const fpsElement = document.getElementById('fps-monitor');
            if (!fpsElement) return;
            
            let lastTime = performance.now();
            let frameCount = 0;
            let fps = 0;
            
            const updateFPS = () => {
                frameCount++;
                const currentTime = performance.now();
                const deltaTime = currentTime - lastTime;
                
                if (deltaTime >= 1000) {
                    fps = Math.round((frameCount * 1000) / deltaTime);
                    fpsElement.textContent = `${fps} FPS`;
                    frameCount = 0;
                    lastTime = currentTime;
                }
                
                requestAnimationFrame(updateFPS);
            };
            
            updateFPS();
        }
    }

    return {
        async initialize() {
            try {
                checkDependencies();
                buildDOM();
                
                const app = new DrawingApp();
                const result = await app.initialize();
                
                window.DrawingApp = app;
                
                return result;
            } catch (error) {
                console.error('❌ CoreInitializer Error:', error);
                throw error;
            }
        }
    };
})();

console.log('✅ core-initializer.js (座標統合版) loaded');