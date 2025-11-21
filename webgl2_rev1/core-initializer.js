/**
 * @file core-initializer.js - Phase 2.1 WebGL2統合版
 * @description アプリケーション初期化シーケンス制御
 * 
 * 【Phase 2.1 改修内容】
 * ✅ WebGPU → WebGL2 への切り替え
 * ✅ GLStrokeProcessor 初期化追加
 * ✅ StrokeRenderer へのWebGL2接続
 * ✅ Phase 2の全機能を完全継承
 * 
 * 【依存関係 - Parents】
 * - core-engine.js (CoreEngine・ExportManager生成元)
 * - core-runtime.js (CoreRuntime)
 * - ui-panels.js (UIController)
 * - system/drawing/webgl2/webgl2-drawing-layer.js (WebGL2DrawingLayer)
 * - system/drawing/webgl2/gl-stroke-processor.js (GLStrokeProcessor)
 * 
 * 【依存関係 - Children】
 * - なし（初期化ルート）
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
     * ========================================================================
     * 🆕 Phase 2.1: WebGL2 初期化（WebGPU廃止）
     * ========================================================================
     */
    async function initializeWebGL2(canvas, strokeRenderer) {
        const config = window.TEGAKI_CONFIG;
        
        // WebGL2が無効化されている場合はスキップ
        if (config.webgpu?.enabled === false) {
            console.log('[WebGL2] Disabled by config');
            return false;
        }

        // WebGLContext確認
        if (!window.WebGLContext && !window.WebGL2DrawingLayer) {
            console.warn('[WebGL2] WebGL2DrawingLayer not loaded');
            return false;
        }

        try {
            // WebGL2 context取得
            const gl = canvas.getContext('webgl2', {
                alpha: true,
                antialias: true,
                premultipliedAlpha: true,
                preserveDrawingBuffer: false
            });

            if (!gl) {
                console.warn('[WebGL2] Context creation failed');
                return false;
            }

            // WebGLContext Singleton初期化
            if (window.WebGLContext) {
                const initialized = window.WebGLContext.initialize(gl);
                if (!initialized) {
                    console.warn('[WebGL2] WebGLContext initialization failed');
                    return false;
                }
            }

            // GLStrokeProcessor Singleton初期化
            if (window.GLStrokeProcessor) {
                const processorInitialized = window.GLStrokeProcessor.initialize(gl);
                if (!processorInitialized) {
                    console.warn('[WebGL2] GLStrokeProcessor initialization failed');
                    return false;
                }
            } else {
                console.warn('[WebGL2] GLStrokeProcessor not loaded');
                return false;
            }

            // StrokeRenderer に WebGL2 接続
            if (strokeRenderer && strokeRenderer.setWebGLLayer) {
                await strokeRenderer.setWebGLLayer(null); // WebGL2の場合は引数不要
                console.log('✅ [WebGL2] StrokeRenderer connected to WebGL2 pipeline');
            } else {
                console.warn('[WebGL2] StrokeRenderer.setWebGLLayer() not found');
            }

            console.log('✅ [WebGL2] Initialization complete');
            return true;

        } catch (error) {
            console.error('[WebGL2] Initialization error:', error);
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
            
            // CoreEngine初期化
            this.coreEngine = new CoreEngine(this.pixiApp);
            const drawingApp = this.coreEngine.initialize();
            
            // グローバル参照設定
            window.coreEngine = this.coreEngine;
            
            const brushSettings = this.coreEngine.getBrushSettings();
            window.brushSettings = brushSettings;
            
            // CoreRuntime初期化 + CoreEngine参照設定
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
            
            // UIController初期化
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
            
            // 🆕 Phase 2.1: WebGL2初期化
            const strokeRenderer = this.coreEngine.getDrawingEngine()?.strokeRenderer;
            if (strokeRenderer) {
                this.webgl2Enabled = await initializeWebGL2(
                    this.pixiApp.canvas,
                    strokeRenderer
                );
            }
            
            // ExportPopup登録
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
        
        /**
         * ExportPopup登録専用メソッド
         * ExportManager生成は不要（CoreEngineで実行済み）
         */
        initializeExportPopup() {
            let retryCount = 0;
            const maxRetries = 30;
            
            const tryRegisterPopup = () => {
                retryCount++;
                
                // CoreEngine.exportManagerの確認
                const exportManager = this.coreEngine?.getExportManager();
                
                if (!exportManager) {
                    if (retryCount < maxRetries) {
                        setTimeout(tryRegisterPopup, 200);
                    }
                    return;
                }
                
                // ExportPopupの確認
                if (!window.TegakiExportPopup) {
                    if (retryCount < maxRetries) {
                        setTimeout(tryRegisterPopup, 200);
                    }
                    return;
                }
                
                // PopupManager登録
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
            
            // イベントリスナー登録
            if (window.TegakiEventBus) {
                window.TegakiEventBus.on('export:manager-initialized', tryRegisterPopup);
            }
            
            // 初回試行
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

console.log('✅ core-initializer.js (Phase 2.1 WebGL2統合版) loaded');
console.log('   🆕 WebGPU → WebGL2 切り替え完了');
console.log('   ✅ GLStrokeProcessor 初期化追加');
console.log('   ✅ Phase 2 全機能継承');