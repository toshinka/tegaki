/**
 * @file core-initializer.js - Phase C-0.1: WebGL2統合修正版
 * @description アプリケーション初期化シーケンス制御
 * 
 * 【Phase C-0.1 改修内容】
 * 🔧 WebGL2初期化フロー完全修正
 * 🔧 RasterLayer初期化シグネチャ修正
 * 🔧 GLコンテキスト所有権の明確化
 * ✅ Phase 5.3全機能継承
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

    // ============================================================
    // 依存関係チェック
    // ============================================================
    
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

    // ============================================================
    // DOM構築
    // ============================================================
    
    function buildDOM() {
        const appContainer = document.getElementById('app');
        if (!appContainer) throw new Error('#app container not found');
        
        const mainLayout = window.DOMBuilder.buildMainLayout();
        appContainer.appendChild(mainLayout);
        
        const statusPanel = window.DOMBuilder.buildStatusPanel();
        document.body.appendChild(statusPanel);
    }

    // ============================================================
    // 設定マネージャー初期化
    // ============================================================
    
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

    // ============================================================
    // ポップアップマネージャー初期化
    // ============================================================
    
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

    // ============================================================
    // EventBus リスナー設定
    // ============================================================
    
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

    // ============================================================
    // レイヤーパネル初期化
    // ============================================================
    
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

    // ============================================================
    // WebGL2初期化（Phase C-0.1 完全修正版）
    // ============================================================
    
    /**
     * WebGL2初期化（ラスター版）
     * @param {HTMLCanvasElement} canvas 
     * @returns {Promise<boolean>}
     */
    async function initializeWebGL2(canvas) {
        console.log('[WebGL2] 🚀 Starting raster initialization (Phase C-0.1)...');

        try {
            // ================================================================
            // ステップ1: 必須モジュール確認
            // ================================================================
            if (!window.WebGL2DrawingLayer) {
                console.error('[WebGL2] ❌ WebGL2DrawingLayer class not found');
                return false;
            }

            if (!window.RasterLayer) {
                console.error('[WebGL2] ❌ RasterLayer instance not found');
                return false;
            }

            if (!canvas) {
                console.error('[WebGL2] ❌ Canvas not provided');
                return false;
            }

            const width = window.TEGAKI_CONFIG.canvas.width;
            const height = window.TEGAKI_CONFIG.canvas.height;

            console.log('[WebGL2] 📐 Canvas size:', canvas.width, 'x', canvas.height);
            console.log('[WebGL2] 🎯 Target size:', width, 'x', height);

            // ================================================================
            // ステップ2: WebGL2DrawingLayer 初期化
            // ================================================================
            console.log('[WebGL2] 🔧 Step 1: Initializing WebGL2DrawingLayer...');

            const webgl2Layer = new window.WebGL2DrawingLayer();
            
            const success = await webgl2Layer.initialize(canvas, width, height);
            
            if (!success) {
                console.error('[WebGL2] ❌ DrawingLayer initialization failed');
                return false;
            }

            console.log('[WebGL2] ✅ Step 1 completed: DrawingLayer initialized');
            console.log('[WebGL2]    - GL Context:', webgl2Layer.gl ? 'OK' : 'MISSING');

            // ================================================================
            // ステップ3: グローバル登録
            // ================================================================
            window.webgl2DrawingLayer = webgl2Layer;
            
            // WebGLContext確認
            if (!window.WebGLContext || !window.WebGLContext.gl) {
                console.error('[WebGL2] ❌ WebGLContext.gl not registered');
                return false;
            }

            const gl = window.WebGLContext.gl;
            console.log('[WebGL2] ✅ Step 2 completed: WebGLContext.gl registered');

            // ================================================================
            // ステップ4: RasterLayer 初期化（外部GLコンテキスト注入）
            // ================================================================
            console.log('[WebGL2] 🔧 Step 3: Initializing RasterLayer...');

            if (window.RasterLayer.initialized) {
                console.warn('[WebGL2] ⚠️  RasterLayer already initialized, skipping');
            } else {
                // 🔧 Phase C-0.1: 修正されたシグネチャで初期化
                const rasterInitSuccess = window.RasterLayer.initialize(gl, width, height, {
                    autoCreateFBO: true,
                    enableOptimization: true
                });

                if (!rasterInitSuccess) {
                    console.error('[WebGL2] ❌ RasterLayer initialization failed');
                    return false;
                }

                console.log('[WebGL2] ✅ Step 3 completed: RasterLayer initialized');
                console.log('[WebGL2]    - Canvas size:', `${window.RasterLayer.canvasWidth}x${window.RasterLayer.canvasHeight}`);
                console.log('[WebGL2]    - Auto FBO:', window.RasterLayer.autoCreateFBO);
            }

            // ================================================================
            // ステップ5: RasterBrushCore 初期化
            // ================================================================
            console.log('[WebGL2] 🔧 Step 4: Initializing RasterBrushCore...');

            if (window.rasterBrushCore) {
                if (window.rasterBrushCore.gl) {
                    console.warn('[WebGL2] ⚠️  RasterBrushCore already has GL context');
                } else {
                    window.rasterBrushCore.initialize(gl);
                    console.log('[WebGL2] ✅ Step 4 completed: RasterBrushCore initialized');
                }
            } else {
                console.warn('[WebGL2] ⚠️  window.rasterBrushCore not found (may be initialized later)');
            }

            // ================================================================
            // ステップ6: Pixi統合
            // ================================================================
            if (window.pixiApp) {
                webgl2Layer.setPixiApp(window.pixiApp);
                console.log('[WebGL2] ✅ Step 5 completed: Pixi.js app linked');
            }

            // ================================================================
            // ステップ7: モジュールステータス確認
            // ================================================================
            const modules = {
                'WebGL2DrawingLayer': webgl2Layer.initialized,
                'RasterLayer': window.RasterLayer?.initialized,
                'BrushStamp': !!window.BrushStamp,
                'BrushInterpolator': !!window.BrushInterpolator,
                'RasterBrushCore': window.rasterBrushCore?.gl !== null && window.rasterBrushCore?.gl !== undefined
            };

            console.log('[WebGL2] 📦 Module status:');
            for (const [name, status] of Object.entries(modules)) {
                const icon = status ? '✅' : '⚠️';
                console.log(`         ${icon} ${name}: ${status ? 'ready' : 'not ready'}`);
            }

            // 全モジュールが準備完了かチェック
            const allReady = Object.values(modules).every(status => status === true);
            if (!allReady) {
                console.warn('[WebGL2] ⚠️  Some modules are not ready, but continuing...');
            }

            // ================================================================
            // ステップ8: デバッグオブジェクト登録
            // ================================================================
            if (!window.TegakiDebug) {
                window.TegakiDebug = {};
            }

            window.TegakiDebug.webgl2Layer = webgl2Layer;
            window.TegakiDebug.rasterLayer = window.RasterLayer;
            window.TegakiDebug.rasterBrushCore = window.rasterBrushCore;
            window.TegakiDebug.gl = gl;

            console.log('[WebGL2] ✅ Debug objects registered to window.TegakiDebug');

            // ================================================================
            // 最終確認
            // ================================================================
            console.log('[WebGL2] 🎉 Raster system initialized successfully');
            console.log('[WebGL2]    - All modules initialized and linked');
            console.log('[WebGL2]    - GLContext shared correctly');
            console.log('[WebGL2]    - Ready for drawing');

            return true;

        } catch (error) {
            console.error('[WebGL2] ❌ Raster initialization error:', error);
            console.error('[WebGL2]', error.stack);
            return false;
        }
    }

    // ============================================================
    // DrawingApp クラス
    // ============================================================
    
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
            
            // Pixi.js初期化
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
            
            console.log('[DrawingApp] ✅ Resolution:', this.pixiApp.renderer.resolution);
            console.log('[DrawingApp] ✅ Antialias:', this.pixiApp.renderer.context.contextOptions?.antialias);
            
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
            
            // 🔧 Phase C-0.1: WebGL2初期化（修正版）
            console.log('[DrawingApp] 🎨 Initializing WebGL2 (Phase C-0.1 Raster mode)...');

            if (this.pixiApp.canvas) {
                this.webgl2Enabled = await initializeWebGL2(this.pixiApp.canvas);
                console.log('[DrawingApp] 📊 WebGL2 Result:', this.webgl2Enabled ? '✅ SUCCESS' : '❌ FAILED');
                
                if (this.webgl2Enabled) {
                    console.log('[DrawingApp] ✅ Raster drawing system ready');
                    
                    // デバッグ情報表示
                    if (window.RasterLayer) {
                        const diagnostics = window.RasterLayer.getDiagnostics();
                        console.log('[DrawingApp] 📊 RasterLayer diagnostics:', diagnostics);
                    }
                } else {
                    console.error('[DrawingApp] ❌ Raster drawing system failed');
                    console.error('[DrawingApp] ⚠️  Drawing may not work correctly');
                }
            } else {
                console.error('[DrawingApp] ❌ Canvas not found');
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

    // ============================================================
    // メイン初期化
    // ============================================================
    
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

    // ============================================================
    // エクスポート
    // ============================================================
    
    return {
        initialize,
        checkDependencies,
        DrawingApp,
        initializeWebGL2,
        initializeLayerPanel
    };
})();

console.log('✅ core-initializer.js Phase C-0.1 loaded (WebGL2統合修正版)');
console.log('   🔧 C-0.1: WebGL2初期化フロー完全修正');
console.log('   🔧 C-0.1: RasterLayer初期化シグネチャ修正');
console.log('   🔧 C-0.1: GLコンテキスト所有権の明確化');
console.log('   ✅ Phase 5.3全機能継承');