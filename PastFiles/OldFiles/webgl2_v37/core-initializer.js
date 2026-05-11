/**
 * ================================================================================
 * core-initializer.js - Phase 1.2.7 WebGL2キャンバスサイズ修正版
 * ================================================================================
 * 
 * 【Phase 1.2.7更新内容】
 * 🔧 WebGL2キャンバスサイズを論理キャンバス（config.canvas）に合わせる
 * 🔧 cameraFrameBoundsが正しいサイズで初期化されるように修正
 * 🔧 ユーザー可変キャンバスサイズに対応
 * ✅ Phase 1.2.6完全継承
 * 
 * 【修正理由】
 * - index.htmlでWebGL2キャンバスが1920x1080にハードコード
 * - 論理キャンバス（400x400）と不一致
 * - 座標変換・クリッピングが正常に機能しない原因
 * 
 * ================================================================================
 */

window.CoreInitializer = (function() {
    'use strict';

    function checkDependencies() {
        const dependencies = [
            { name: 'PIXI', obj: window.PIXI },
            { name: 'TEGAKI_CONFIG', obj: window.TEGAKI_CONFIG },
            { name: 'CoordinateSystem', obj: window.CoordinateSystem },
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

    function initializeCoordinateSystem(worldContainer) {
        if (!window.CoordinateSystem) {
            console.error('[CoreInit] ❌ CoordinateSystem not found');
            return false;
        }

        const webgl2Canvas = document.querySelector('#webgl2-canvas');
        if (!webgl2Canvas) {
            console.error('[CoreInit] ❌ WebGL2 canvas not found');
            return false;
        }

        if (!worldContainer) {
            console.error('[CoreInit] ❌ worldContainer not available');
            return false;
        }

        if (!worldContainer.position) {
            console.warn('[CoreInit] ⚠️ worldContainer.position is undefined, setting default');
            worldContainer.position = { x: 0, y: 0 };
        }
        if (!worldContainer.scale) {
            console.warn('[CoreInit] ⚠️ worldContainer.scale is undefined, setting default');
            worldContainer.scale = { x: 1, y: 1 };
        }

        const result = window.CoordinateSystem.initialize(webgl2Canvas, worldContainer);
        
        if (!result) {
            console.error('[CoreInit] ❌ CoordinateSystem initialization failed');
            return false;
        }

        console.log('[CoreInit] ✅ CoordinateSystem initialized');

        return true;
    }

    async function initializeWebGL2(strokeRenderer, pixiApp) {
        const config = window.TEGAKI_CONFIG;

        try {
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

            if (!window.GLStrokeProcessor) {
                console.error('[WebGL2] GLStrokeProcessor not found');
                return false;
            }

            await window.GLStrokeProcessor.initialize(gl);
            console.log('[WebGL2] GLStrokeProcessor initialized');

            if (window.GLMSDFPipeline) {
                await window.GLMSDFPipeline.initialize(gl);
                console.log('[WebGL2] GLMSDFPipeline initialized');
            } else {
                console.warn('[WebGL2] GLMSDFPipeline not found (MSDF disabled)');
            }

            if (window.GLTextureBridge) {
                await window.GLTextureBridge.initialize(gl, pixiApp);
                console.log('[WebGL2] GLTextureBridge initialized');
            } else {
                console.warn('[WebGL2] GLTextureBridge not found');
            }

            if (window.GLMaskLayer) {
                // 🔧 Phase 1.2.7: 論理キャンバスサイズを使用
                const maskWidth = config.canvas?.width || 400;
                const maskHeight = config.canvas?.height || 400;
                const maskLayerInit = await window.GLMaskLayer.initialize(maskWidth, maskHeight);
                
                if (maskLayerInit) {
                    console.log('[WebGL2] GLMaskLayer initialized');
                } else {
                    console.warn('[WebGL2] GLMaskLayer initialization failed');
                }
            } else {
                console.warn('[WebGL2] GLMaskLayer not found');
            }

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

    /**
     * 🔧 Phase 1.2.5: 親子関係強制確立関数
     */
    function ensureParentChildRelationship(layerManager, cameraSystem) {
        if (!layerManager || !cameraSystem) {
            console.error('[CoreInit] ❌ Cannot establish relationship: missing systems');
            return false;
        }

        const currentFrameContainer = layerManager.currentFrameContainer;
        const worldContainer = cameraSystem.worldContainer;

        if (!currentFrameContainer || !worldContainer) {
            console.error('[CoreInit] ❌ Missing containers:', {
                currentFrameContainer: !!currentFrameContainer,
                worldContainer: !!worldContainer
            });
            return false;
        }

        // 現在の親をチェック
        const currentParent = currentFrameContainer.parent;

        if (currentParent !== worldContainer) {
            console.log('[CoreInit] 🔧 Re-establishing parent-child relationship...');

            // 既存の親から削除
            if (currentParent) {
                currentParent.removeChild(currentFrameContainer);
            }

            // worldContainerの子として追加
            worldContainer.addChildAt(currentFrameContainer, 0);

            // 検証
            const isChild = currentFrameContainer.parent === worldContainer;
            const childIndex = isChild ? worldContainer.children.indexOf(currentFrameContainer) : -1;

            console.log('[CoreInit] Parent-child re-establishment:', {
                success: isChild,
                childIndex: childIndex,
                worldContainerChildren: worldContainer.children.length
            });

            return isChild;
        }

        console.log('[CoreInit] ✅ Parent-child relationship already valid');
        return true;
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
            
            // ========================================
            // 🔧 Phase 1.2.7: WebGL2キャンバスサイズ設定
            // ========================================
            const webgl2Canvas = document.getElementById('webgl2-canvas');
            if (webgl2Canvas) {
                // 論理キャンバスサイズに設定
                webgl2Canvas.width = CONFIG.canvas.width;
                webgl2Canvas.height = CONFIG.canvas.height;
                
                console.log('[CoreInit] 🔧 WebGL2 canvas resized to logical canvas size:', {
                    width: CONFIG.canvas.width,
                    height: CONFIG.canvas.height
                });
                
                // 表示サイズはCSSで制御されるため、ここでは変更しない
            } else {
                console.error('[CoreInit] ❌ WebGL2 canvas not found');
            }
            
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
            
            this.coreEngine = new CoreEngine(this.pixiApp);
            window.coreEngine = this.coreEngine;
            
            console.log('[CoreInit] Calling CoreEngine.initialize()...');
            const drawingApp = this.coreEngine.initialize();
            console.log('[CoreInit] ✅ CoreEngine.initialize() complete');
            
            // worldContainerが確定
            const worldContainer = this.coreEngine.cameraSystem.worldContainer;
            if (!worldContainer) {
                throw new Error('worldContainer not created by CameraSystem');
            }
            console.log('[CoreInit] ✅ worldContainer ready:', {
                x: worldContainer.x,
                y: worldContainer.y,
                scale: worldContainer.scale?.x
            });
            
            // ========================================
            // 🔧 Phase 1.2.4: LayerSystemとCameraSystemを接続
            // ========================================
            console.log('[CoreInit] Connecting LayerSystem and CameraSystem...');
            const layerManager = this.coreEngine.getLayerManager();
            const cameraSystem = this.coreEngine.getCameraSystem();
            
            if (layerManager && cameraSystem) {
                layerManager.setCameraSystem(cameraSystem);
                
                const currentFrameContainer = layerManager.currentFrameContainer;
                const worldContainer = cameraSystem.worldContainer;
                
                if (currentFrameContainer && worldContainer) {
                    const isChild = currentFrameContainer.parent === worldContainer;
                    console.log('[CoreInit] Parent-child verification:', {
                        currentFrameContainer: !!currentFrameContainer,
                        worldContainer: !!worldContainer,
                        isChild: isChild,
                        childIndex: isChild ? worldContainer.children.indexOf(currentFrameContainer) : -1,
                        worldContainerChildren: worldContainer.children.length
                    });
                    
                    if (!isChild) {
                        console.error('[CoreInit] ❌ Failed to establish parent-child relationship!');
                        console.error('  currentFrameContainer parent:', currentFrameContainer.parent?.label || 'none');
                        console.error('  Expected parent:', worldContainer.label);
                        
                        console.log('[CoreInit] Forcing parent-child relationship...');
                        if (currentFrameContainer.parent) {
                            currentFrameContainer.parent.removeChild(currentFrameContainer);
                        }
                        worldContainer.addChildAt(currentFrameContainer, 0);
                        
                        const finalCheck = currentFrameContainer.parent === worldContainer;
                        console.log('[CoreInit] Force established:', finalCheck ? '✅ Success' : '❌ Failed');
                    } else {
                        console.log('[CoreInit] ✅ LayerSystem and CameraSystem connected successfully');
                    }
                } else {
                    console.error('[CoreInit] ❌ Missing containers:', {
                        currentFrameContainer: !!currentFrameContainer,
                        worldContainer: !!worldContainer
                    });
                }
            } else {
                console.error('[CoreInit] ❌ Cannot connect LayerSystem and CameraSystem:', {
                    layerManager: !!layerManager,
                    cameraSystem: !!cameraSystem
                });
            }
            
            console.log('[CoreInit] Verifying CoordinateSystem...');
            if (window.CoordinateSystem && typeof window.CoordinateSystem.dumpState === 'function') {
                const coordState = window.CoordinateSystem.dumpState();
                console.log('[CoreInit] CoordinateSystem final state:', coordState);
            }
            
            // ========================================
            // 🔧 Phase 1.2.5: AnimationSystem初期化後の親子関係再確立
            // ========================================
            
            // AnimationSystem初期化完了イベントをリッスン
            window.TegakiEventBus.on('animation:system-ready', () => {
                console.log('[CoreInit] 🔧 Phase 1.2.5: Re-establishing parent-child after AnimationSystem...');
                
                // 少し遅延させてAnimationSystemの処理が完了するのを待つ
                setTimeout(() => {
                    ensureParentChildRelationship(layerManager, cameraSystem);
                    
                    // デバッグ用: 親子関係検証
                    if (layerManager.verifyParentChain) {
                        layerManager.verifyParentChain();
                    }
                }, 500);
            });
            
            const brushSettings = this.coreEngine.getBrushSettings();
            window.brushSettings = brushSettings;
            
            window.CoreRuntime.init({
                app: this.pixiApp,
                worldContainer: this.coreEngine.getCameraSystem().worldContainer,
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
                this.webgl2Enabled = await initializeWebGL2(strokeRenderer, this.pixiApp);
                
                if (this.webgl2Enabled) {
                    if (window.BrushCore) {
                        console.log('[App] Re-initializing BrushCore with WebGL2 components');
                        
                        window.BrushCore.glStrokeProcessor = window.GLStrokeProcessor;
                        window.BrushCore.glMSDFPipeline = window.GLMSDFPipeline;
                        window.BrushCore.textureBridge = window.GLTextureBridge || window.WebGPUTextureBridge;
                        window.BrushCore.glMaskLayer = window.GLMaskLayer;
                        
                        if (!window.BrushCore.strokeRecorder) {
                            window.BrushCore.strokeRecorder = window.strokeRecorder || window.StrokeRecorder;
                        }
                        if (!window.BrushCore.layerManager) {
                            window.BrushCore.layerManager = window.layerManager || window.layerSystem;
                        }
                        if (!window.BrushCore.eventBus) {
                            window.BrushCore.eventBus = window.TegakiEventBus || window.eventBus;
                        }
                        
                        window.BrushCore.msdfAvailable = !!(
                            window.BrushCore.glStrokeProcessor &&
                            window.BrushCore.glMSDFPipeline &&
                            window.BrushCore.textureBridge
                        );
                        
                        window.BrushCore.maskAvailable = !!(
                            window.BrushCore.glMaskLayer && 
                            window.BrushCore.glMaskLayer.initialized
                        );
                        
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
        initializeCoordinateSystem,
        ensureParentChildRelationship
    };
})();

console.log('✅ core-initializer.js Phase 1.2.7 WebGL2キャンバスサイズ修正版 loaded');
console.log('   🔧 WebGL2キャンバスを論理キャンバスサイズに自動設定');
console.log('   🔧 ユーザー可変キャンバスサイズに完全対応');
console.log('   ✅ Phase 1.2.6完全継承');