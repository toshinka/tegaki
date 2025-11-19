/**
 * ================================================================================
 * core-initializer.js - WebGL2対応完全版 (Phase 1.2.2 CoordinateSystem初期化修正)
 * ================================================================================
 * 
 * 📁 親ファイル依存:
 *   - PIXI.js v8.14 (CDN)
 *   - config.js (TEGAKI_CONFIG)
 *   - coordinate-system.js (CoordinateSystem) ⭐ 追加
 *   - system/event-bus.js (TegakiEventBus)
 *   - system/popup-manager.js (TegakiPopupManager)
 *   - system/settings-manager.js (TegakiSettingsManager)
 *   - ui/dom-builder.js (DOMBuilder)
 *   - core-runtime.js (CoreRuntime)
 *   - core-engine.js (CoreEngine)
 * 
 * 📄 子ファイル初期化:
 *   - coordinate-system.js (座標変換パイプライン) ⭐ 追加
 *   - system/drawing/webgl2/webgl2-drawing-layer.js
 *   - system/drawing/webgl2/gl-stroke-processor.js
 *   - system/drawing/webgl2/gl-msdf-pipeline.js
 *   - system/drawing/webgl2/gl-texture-bridge.js
 *   - system/drawing/webgl2/gl-mask-layer.js
 *   - system/drawing/stroke-renderer.js
 *   - system/drawing/brush-core.js
 * 
 * 【Phase 1.2.2更新内容】
 * ⭐ CoordinateSystem初期化タイミング修正（CoreEngine.initialize()完了後）
 * ⭐ worldContainer生成確認後の確実な初期化
 * ⭐ updateTransform()呼び出しエラーの修正
 * 
 * 【Phase 6.1更新内容】
 * 🔧 BrushCore再初期化のタイミング問題を修正
 * ✅ WebGL2コンポーネント設定を初期化フラグリセット前に実施
 * ✅ 非同期初期化中のsetBrushSettings()エラーを防止
 * ✅ msdfAvailable/maskAvailableフラグの確実な更新
 * 
 * ================================================================================
 */

window.CoreInitializer = (function() {
    'use strict';

    function checkDependencies() {
        const dependencies = [
            { name: 'PIXI', obj: window.PIXI },
            { name: 'TEGAKI_CONFIG', obj: window.TEGAKI_CONFIG },
            { name: 'CoordinateSystem', obj: window.CoordinateSystem }, // ⭐ 追加
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
        const eventBus = window.cameraSystem?.eventBus || this.eventBus;
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
            return null;
        }

        const container = document.getElementById('layer-list');
        if (!container) {
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
     * ⭐ CoordinateSystem初期化（Phase 1.2.2 修正版）
     * @param {PIXI.Container} worldContainer - PixiJS worldContainer
     * @returns {boolean} 初期化成功/失敗
     */
    function initializeCoordinateSystem(worldContainer) {
        if (!window.CoordinateSystem) {
            console.error('[CoreInit] ❌ CoordinateSystem not found');
            return false;
        }

        // WebGL2キャンバス取得
        const webgl2Canvas = document.querySelector('#webgl2-canvas');
        if (!webgl2Canvas) {
            console.error('[CoreInit] ❌ WebGL2 canvas not found');
            return false;
        }

        // worldContainer確認
        if (!worldContainer) {
            console.error('[CoreInit] ❌ worldContainer not available');
            return false;
        }

        // worldContainerのposition初期化確認（エラー回避）
        if (!worldContainer.position) {
            console.warn('[CoreInit] ⚠️ worldContainer.position is undefined, setting default');
            worldContainer.position = { x: 0, y: 0 };
        }
        if (!worldContainer.scale) {
            console.warn('[CoreInit] ⚠️ worldContainer.scale is undefined, setting default');
            worldContainer.scale = { x: 1, y: 1 };
        }

        // CoordinateSystem初期化実行（updateTransform()は内部で呼ばれる）
        const result = window.CoordinateSystem.initialize(webgl2Canvas, worldContainer);
        
        if (!result) {
            console.error('[CoreInit] ❌ CoordinateSystem initialization failed');
            return false;
        }

        console.log('[CoreInit] ✅ CoordinateSystem initialized');

        return true;
    }

    /**
     * WebGL2初期化（Phase 6完全版）
     * @param {Object} strokeRenderer - StrokeRenderer instance
     * @param {PIXI.Application} pixiApp - PixiJS Application
     */
    async function initializeWebGL2(strokeRenderer, pixiApp) {
        const config = window.TEGAKI_CONFIG;

        try {
            // 1. WebGL2DrawingLayer初期化
            if (!window.WebGL2DrawingLayer) {
                console.error('[WebGL2] WebGL2DrawingLayer not found');
                return false;
            }

            const drawingLayerInit = await window.WebGL2DrawingLayer.initialize();
            if (!drawingLayerInit) {
                console.error('[WebGL2] Drawing Layer initialization failed');
                return false;
            }

            const gl = window.WebGL2DrawingLayer.getGL();
            console.log('[WebGL2] Drawing Layer initialized');

            // 2. GLStrokeProcessor初期化
            if (!window.GLStrokeProcessor) {
                console.error('[WebGL2] GLStrokeProcessor not found');
                return false;
            }

            await window.GLStrokeProcessor.initialize(gl);
            console.log('[WebGL2] GLStrokeProcessor initialized');

            // 3. GLMSDFPipeline初期化
            if (window.GLMSDFPipeline) {
                await window.GLMSDFPipeline.initialize(gl);
                console.log('[WebGL2] GLMSDFPipeline initialized');
            } else {
                console.warn('[WebGL2] GLMSDFPipeline not found (MSDF disabled)');
            }

            // 4. GLTextureBridge初期化
            if (window.GLTextureBridge) {
                await window.GLTextureBridge.initialize(gl, pixiApp);
                console.log('[WebGL2] GLTextureBridge initialized');
            } else {
                console.warn('[WebGL2] GLTextureBridge not found (Sprite conversion disabled)');
            }

            // 5. GLMaskLayer初期化
            if (window.GLMaskLayer) {
                const maskWidth = config.canvas?.width || 1920;
                const maskHeight = config.canvas?.height || 1080;
                const maskLayerInit = await window.GLMaskLayer.initialize(maskWidth, maskHeight);
                
                if (maskLayerInit) {
                    console.log('[WebGL2] GLMaskLayer initialized');
                } else {
                    console.warn('[WebGL2] GLMaskLayer initialization failed');
                }
            } else {
                console.warn('[WebGL2] GLMaskLayer not found (Eraser mask disabled)');
            }

            // 6. StrokeRenderer初期化
            if (!strokeRenderer) {
                console.error('[WebGL2] StrokeRenderer not provided');
                return false;
            }

            await strokeRenderer.initialize();
            console.log('[WebGL2] StrokeRenderer initialized');

            console.log('[WebGL2] ✅ Phase 6 initialization complete');
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
                throw new Error('UIController not found');
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
                antialias: true,
                eventMode: 'static',
                preference: 'webgl',
                hello: false
            });
            
            containerEl.innerHTML = '';
            containerEl.appendChild(this.pixiApp.canvas);
            this.pixiApp.canvas.style.width = `${screenWidth}px`;
            this.pixiApp.canvas.style.height = `${screenHeight}px`;
            
            this.pixiApp.ticker.stop();
            
            this.pixiApp.stage.eventMode = 'static';
            this.pixiApp.stage.interactiveChildren = false;
            
            this.pixiApp.renderer.render(this.pixiApp.stage);
            
            // ⭐ CoreEngine初期化（ここでcameraSystemとworldContainerが生成される）
            this.coreEngine = new CoreEngine(this.pixiApp);
            const drawingApp = this.coreEngine.initialize();
            
            window.coreEngine = this.coreEngine;
            
            const brushSettings = this.coreEngine.getBrushSettings();
            window.brushSettings = brushSettings;

            // ⭐ Phase 1.2.2: CoordinateSystem初期化（CoreEngine初期化完了後）
            const cameraSystem = this.coreEngine.getCameraSystem();
            if (cameraSystem && cameraSystem.worldContainer) {
                console.log('[CoreInit] Initializing CoordinateSystem...');
                const coordInitSuccess = initializeCoordinateSystem(cameraSystem.worldContainer);
                if (!coordInitSuccess) {
                    console.warn('[CoreInit] ⚠️ CoordinateSystem initialization failed, drawing may not work correctly');
                } else {
                    // 初期化確認ログ
                    const state = window.CoordinateSystem.dumpState();
                    console.log('[CoreInit] CoordinateSystem state:', state);
                }
            } else {
                console.error('[CoreInit] ❌ cameraSystem or worldContainer not available');
            }
            
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
            } else {
                // WebGL2初期化（Phase 6）
                this.webgl2Enabled = await initializeWebGL2(strokeRenderer, this.pixiApp);
                
                if (this.webgl2Enabled) {
                    // ✅ Phase 6.1修正: BrushCore再初期化タイミング改善
                    if (window.BrushCore) {
                        console.log('[App] Re-initializing BrushCore with WebGL2 components');
                        
                        // ✅ STEP 1: まずWebGL2コンポーネントを設定（初期化フラグは触らない）
                        window.BrushCore.glStrokeProcessor = window.GLStrokeProcessor;
                        window.BrushCore.glMSDFPipeline = window.GLMSDFPipeline;
                        window.BrushCore.textureBridge = window.GLTextureBridge || window.WebGPUTextureBridge;
                        window.BrushCore.glMaskLayer = window.GLMaskLayer;
                        
                        // ✅ STEP 2: 既存の依存関係も確認・再設定
                        if (!window.BrushCore.strokeRecorder) {
                            window.BrushCore.strokeRecorder = window.strokeRecorder || window.StrokeRecorder;
                        }
                        if (!window.BrushCore.layerManager) {
                            window.BrushCore.layerManager = window.layerManager || window.layerSystem;
                        }
                        if (!window.BrushCore.eventBus) {
                            window.BrushCore.eventBus = window.TegakiEventBus || window.eventBus;
                        }
                        
                        // ✅ STEP 3: msdfAvailable / maskAvailable フラグを更新
                        window.BrushCore.msdfAvailable = !!(
                            window.BrushCore.glStrokeProcessor &&
                            window.BrushCore.glMSDFPipeline &&
                            window.BrushCore.textureBridge
                        );
                        
                        window.BrushCore.maskAvailable = !!(
                            window.BrushCore.glMaskLayer && 
                            window.BrushCore.glMaskLayer.initialized
                        );
                        
                        // ✅ STEP 4: 初期化されていない場合のみ初期化実行
                        if (!window.BrushCore.initialized) {
                            console.log('[App] BrushCore not yet initialized, initializing now...');
                            await window.BrushCore.initialize();
                        } else {
                            console.log('[App] BrushCore already initialized, components updated');
                        }
                        
                        console.log('[App] ✅ BrushCore re-initialized with WebGL2 (Phase 6.1)', {
                            msdfAvailable: window.BrushCore.msdfAvailable,
                            maskAvailable: window.BrushCore.maskAvailable,
                            initialized: window.BrushCore.initialized
                        });
                    }
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
            
            if (this.coreEngine.startRenderLoop) {
                this.coreEngine.startRenderLoop();
            } else {
                this.startManualRenderLoop();
            }
            
            return true;
        }
        
        startManualRenderLoop() {
            const renderLoop = () => {
                if (this.pixiApp && this.pixiApp.renderer && this.pixiApp.stage) {
                    this.pixiApp.renderer.render(this.pixiApp.stage);
                }
                
                requestAnimationFrame(renderLoop);
            };
            
            requestAnimationFrame(renderLoop);
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
        initializeWebGL2,
        initializeLayerPanel,
        initializeCoordinateSystem // ⭐ エクスポート追加
    };
})();

console.log('✅ core-initializer.js Phase 1.2.2 CoordinateSystem初期化修正版 loaded');
console.log('   ⭐ CoreEngine.initialize()完了後にCoordinateSystem初期化');
console.log('   ⭐ worldContainer.position/scale未定義エラーの回避');
console.log('   ⭐ 元ファイルの全メソッド・機能を完全継承');