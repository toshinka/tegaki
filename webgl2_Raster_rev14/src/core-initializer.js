/**
 * @file core-initializer.js - Phase B-Emergency-5
 * @description アプリケーション初期化シーケンス制御（Canvas分離対応）
 * 
 * 【Phase B-Emergency-5 改修内容】
 * 🚨 BE-5: 描画Canvas独立生成フロー
 * 🚨 BE-5: ticker制御コード削除（不要）
 * 🚨 BE-5: GLTextureBridge初期化統合
 * ✅ 初期化順序最適化
 */

window.CoreInitializer = (function() {
    'use strict';

    // ================================================================================
    // ヘルパー関数群
    // ================================================================================
    
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

    // ================================================================================
    // WebGL2初期化（Phase B-Emergency-5: Canvas完全分離）
    // ================================================================================
    
    /**
     * WebGL2初期化（Phase B-Emergency-5）
     * 
     * @param {PIXI.Application} pixiApp - PixiJSアプリ
     * @returns {Promise<boolean>}
     */
    async function initializeWebGL2(pixiApp) {
        console.log('[WebGL2] 🚀 Starting raster initialization (Phase BE-5)...');

        try {
            console.log('[WebGL2] 🔍 Checking dependencies...');
            
            const WebGL2DrawingLayer = window.WebGL2DrawingLayer || window.webgl2DrawingLayer;
            if (!WebGL2DrawingLayer) {
                console.warn('[WebGL2] ⚠️ WebGL2DrawingLayer not found on window, retrying in 500ms...');
                await new Promise(r => setTimeout(r, 500));
            }

            const rl = window.rasterLayer || window.RasterLayer;
            const tb = window.glTextureBridge || window.GLTextureBridge;
            const rbc = window.rasterBrushCore || window.RasterBrushCore;

            if (!rl) throw new Error('[WebGL2] ❌ RasterLayer not found');
            if (!tb) throw new Error('[WebGL2] ❌ GLTextureBridge not found');
            if (!rbc) throw new Error('[WebGL2] ❌ RasterBrushCore not found');

            if (!pixiApp) throw new Error('[WebGL2] ❌ PixiApp not provided');

            const width = window.TEGAKI_CONFIG.canvas.width;
            const height = window.TEGAKI_CONFIG.canvas.height;
            console.log('[WebGL2] 🎯 Target size:', width, 'x', height);

            // ================================================================
            // Step 1: WebGL2DrawingLayer初期化（描画Canvas生成）
            // ================================================================
            console.log('[WebGL2] 🔧 Step 1: Initializing WebGL2DrawingLayer...');

            const webgl2Layer = new window.WebGL2DrawingLayer();
            const initSuccess = webgl2Layer.initialize(width, height);
            
            if (!initSuccess) {
                throw new Error('[WebGL2] ❌ DrawingLayer initialization failed');
            }

            window.webgl2DrawingLayer = webgl2Layer;
            
            console.log('[WebGL2] ✅ Step 1: WebGL2DrawingLayer initialized');
            console.log('  Drawing Canvas:', webgl2Layer.getDrawingCanvas());
            console.log('  GL Context:', webgl2Layer.getGLContext());

            // GLContext確認
            if (!window.GLContext || !window.GLContext.gl) {
                throw new Error('[WebGL2] ❌ GLContext not registered');
            }

            const gl = window.GLContext.gl;
            console.log('[WebGL2] ✅ Step 2: GLContext verified');

            // ================================================================
            // Step 2: RasterLayer既に初期化済み確認
            // ================================================================
            console.log('[WebGL2] 🔧 Step 3: Verifying RasterLayer...');

            if (!window.rasterLayer.initialized) {
                throw new Error('[WebGL2] ❌ RasterLayer not initialized');
            }

            console.log('[WebGL2] ✅ Step 3: RasterLayer verified');

            // ================================================================
            // Step 3: GLTextureBridge初期化
            // ================================================================
            console.log('[WebGL2] 🔧 Step 4: Initializing GLTextureBridge...');

            const drawingCanvas = webgl2Layer.getDrawingCanvas();
            
            // GLTextureBridge インスタンス生成（まだなければ）
            if (!window.glTextureBridge) {
                window.glTextureBridge = new window.GLTextureBridge();
            }
            
            window.glTextureBridge.initialize(drawingCanvas, pixiApp);

            console.log('[WebGL2] ✅ Step 4: GLTextureBridge initialized');

            // ================================================================
            // Step 4: RasterBrushCore初期化
            // ================================================================
            console.log('[WebGL2] 🔧 Step 5: Initializing RasterBrushCore...');

            if (!window.rasterBrushCore) {
                throw new Error('[WebGL2] ❌ RasterBrushCore not found');
            }

            window.rasterBrushCore.initialize(drawingCanvas);

            console.log('[WebGL2] ✅ Step 5: RasterBrushCore initialized');

            // ================================================================
            // Step 5: 統合確認
            // ================================================================
            const modules = {
                'WebGL2DrawingLayer': webgl2Layer.initialized,
                'RasterLayer': window.rasterLayer.initialized,
                'GLTextureBridge': window.glTextureBridge.initialized,
                'BrushStamp': !!window.brushStamp,
                'BrushInterpolator': !!window.brushInterpolator,
                'RasterBrushCore': window.rasterBrushCore.isInitialized()
            };

            console.log('[WebGL2] 📦 Module status:');
            for (const [name, status] of Object.entries(modules)) {
                const icon = status ? '✅' : '⚠️';
                console.log(`  ${icon} ${name}: ${status ? 'ready' : 'not ready'}`);
            }

            const allReady = Object.values(modules).every(status => status === true);
            if (!allReady) {
                console.warn('[WebGL2] ⚠️ Some modules are not ready');
                return false;
            }

            // ================================================================
            // Step 6: デバッグオブジェクト登録
            // ================================================================
            if (!window.TegakiDebug) {
                window.TegakiDebug = {};
            }

            window.TegakiDebug.webgl2Layer = webgl2Layer;
            window.TegakiDebug.rasterLayer = window.rasterLayer;
            window.TegakiDebug.glTextureBridge = window.glTextureBridge;
            window.TegakiDebug.rasterBrushCore = window.rasterBrushCore;
            window.TegakiDebug.gl = gl;

            console.log('[WebGL2] ✅ Debug objects registered');

            console.log('[WebGL2] 🎉 Raster system initialized successfully (Phase BE-5)');
            console.log('[WebGL2]    🚨 Drawing Canvas: Independent');
            console.log('[WebGL2]    🚨 Display Canvas: PixiJS managed');
            console.log('[WebGL2]    🚨 No GL context conflict possible');
            console.log('[WebGL2]    ✅ Ready for drawing');

            return true;

        } catch (error) {
            console.error('[WebGL2] ❌ Initialization error:', error);
            console.error('[WebGL2]', error.stack);
            return false;
        }
    }

    // ================================================================================
    // DrawingApp クラス
    // ================================================================================
    
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
                throw new Error('UIController not found');
            }
            
            const UIController = window.TegakiUI.UIController;
            
            const containerEl = document.getElementById('drawing-canvas');
            if (!containerEl) throw new Error('Canvas container not found');
            
            // ================================================================
            // PixiJS初期化（通常通り・ticker制御不要）
            // ================================================================
            console.log('[DrawingApp] 🎨 Initializing Pixi.js...');

            this.pixiApp = new PIXI.Application();
            const screenWidth = window.innerWidth - 50;
            const screenHeight = window.innerHeight;
            
            await this.pixiApp.init({
                width: screenWidth,
                height: screenHeight,
                backgroundAlpha: 0,
                resolution: 2,
                antialias: true,
                autoDensity: true,
                eventMode: 'static',
                preference: 'webgl2',
                powerPreference: 'high-performance'
                // autoStart: デフォルトtrue（変更不要）
            });
            
            containerEl.innerHTML = '';
            containerEl.appendChild(this.pixiApp.canvas);
            this.pixiApp.canvas.style.width = `${screenWidth}px`;
            this.pixiApp.canvas.style.height = `${screenHeight}px`;
            
            window.pixiApp = this.pixiApp;
            
            console.log('[DrawingApp] ✅ Pixi.js initialized (normal mode)');
            
            // CoreEngine初期化
            this.coreEngine = new CoreEngine(this.pixiApp);
            const drawingApp = this.coreEngine.initialize();
            
            window.coreEngine = this.coreEngine;
            
            const brushSettings = this.coreEngine.getBrushSettings();
            window.brushSettings = brushSettings;
            
            // CoreRuntime初期化
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

            // PopupManager初期化
            this.popupManager = initializePopupManager(this, this.coreEngine);
            
            setupEventBusListeners();
            
            // LayerPanel初期化
            this.layerPanelRenderer = initializeLayerPanel(
                this.coreEngine.getLayerManager(),
                window.TegakiEventBus
            );
            
            // ================================================================
            // WebGL2初期化（Phase BE-5: Canvas分離方式）
            // ================================================================
            console.log('[DrawingApp] 🚀 Initializing WebGL2 (Phase BE-5)...');

            if (this.pixiApp) {
                this.webgl2Enabled = await initializeWebGL2(this.pixiApp);
                
                console.log('[DrawingApp] 📊 WebGL2 Result:', 
                    this.webgl2Enabled ? '✅ SUCCESS' : '❌ FAILED'
                );
                
                if (this.webgl2Enabled) {
                    console.log('[DrawingApp] ✅ Separated WebGL2 system ready');
                    
                    // 診断情報表示
                    if (window.rasterLayer?.getDiagnostics) {
                        const diagnostics = window.rasterLayer.getDiagnostics();
                        console.log('[DrawingApp] 📊 RasterLayer:', diagnostics);
                    }
                    
                    if (window.glTextureBridge?.getPerformanceMetrics) {
                        const metrics = window.glTextureBridge.getPerformanceMetrics();
                        console.log('[DrawingApp] 📊 GLTextureBridge:', metrics);
                    }
                } else {
                    console.error('[DrawingApp] ❌ WebGL2 initialization failed');
                }
            } else {
                console.error('[DrawingApp] ❌ PixiApp not found');
            }
            
            // ExportPopup初期化
            this.initializeExportPopup();
            
            // API登録
            window.drawingAppResizeCanvas = (newWidth, newHeight) => {
                return window.CoreRuntime.api.camera.resize(newWidth, newHeight);
            };
            
            // イベントリスナー設定
            this.setupEventListeners();
            this.updateCanvasInfo();
            this.updateDPRInfo();
            this.startFPSMonitor();
            
            console.log('[DrawingApp] 🎉 Application initialized successfully (Phase BE-5)');
            console.log('[DrawingApp]    🚨 Canvas separation: Complete');
            console.log('[DrawingApp]    ✅ Drawing: Independent Canvas');
            console.log('[DrawingApp]    ✅ Display: PixiJS Canvas');
            
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

    // ================================================================================
    // メイン初期化
    // ================================================================================
    
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

    // ================================================================================
    // エクスポート
    // ================================================================================
    
    return {
        initialize,
        checkDependencies,
        DrawingApp,
        initializeWebGL2,
        initializeLayerPanel
    };
})();

console.log('✅ core-initializer.js Phase B-Emergency-5 loaded');
console.log('   🚨 BE-5: 描画Canvas独立生成フロー');
console.log('   🚨 BE-5: ticker制御コード削除（不要）');
console.log('   🚨 BE-5: GLTextureBridge初期化統合');
console.log('   ✅ Canvas分離による完全独立実現');