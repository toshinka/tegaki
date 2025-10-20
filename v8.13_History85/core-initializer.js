// Tegaki Tool - Core Initializer Module
// DO NOT use ESM, only global namespace
// 🔥 修正: ExportPopup初期化を確実に実行 + ToolSizePopup初期化追加

window.CoreInitializer = (function() {
    'use strict';

    // 依存関係チェック
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

    // DOM構築
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

    // SettingsManager 初期化
    function initializeSettingsManager(eventBus, config) {
        if (!window.TegakiSettingsManager) {
            throw new Error('SettingsManager class not found');
        }

        // 既にインスタンスの場合はそのまま返す
        if (window.TegakiSettingsManager.prototype === undefined) {
            return window.TegakiSettingsManager;
        }

        // クラスの場合はインスタンス化
        const settingsManager = new window.TegakiSettingsManager(eventBus, config);
        window.TegakiSettingsManager = settingsManager;
        
        return settingsManager;
    }

    // DrawingAppクラス定義
    class DrawingApp {
        constructor() {
            this.pixiApp = null;
            this.coreEngine = null;
            this.uiController = null;
            this.settingsManager = null;
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
            
            // SettingsManager を先に初期化
            this.settingsManager = initializeSettingsManager(
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
            
            // UIController初期化
            console.log('🔧 Initializing UIController...');
            this.uiController = new UIController(
                this.coreEngine.getDrawingEngine(), 
                this.coreEngine.getLayerManager(), 
                this.pixiApp
            );

            // SettingsPopupの遅延初期化
            this.initializeSettingsPopupDelayed();

            // 🔥 ToolSizePopupの遅延初期化
            this.initializeToolSizePopupDelayed();

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
            console.log('🔧 Attempting to initialize SettingsPopup (delayed)...');
            
            const maxRetries = 20;
            let retryCount = 0;
            
            const tryInitialize = () => {
                if (window.TegakiUI?.SettingsPopup) {
                    console.log('✅ SettingsPopup class found, initializing...');
                    
                    try {
                        if (this.uiController) {
                            const success = this.uiController.initializeSettingsPopup();
                            if (success) {
                                console.log('✅ SettingsPopup initialized successfully (delayed)');
                                return;
                            }
                        }
                    } catch (error) {
                        console.error('❌ SettingsPopup initialization failed:', error);
                    }
                }
                
                retryCount++;
                if (retryCount < maxRetries) {
                    setTimeout(tryInitialize, 50);
                } else {
                    console.warn('⚠️ SettingsPopup initialization timeout after', maxRetries * 50, 'ms');
                }
            };
            
            setTimeout(tryInitialize, 0);
        }

        // 🔥 ToolSizePopupの遅延初期化
        initializeToolSizePopupDelayed() {
            console.log('🔧 Attempting to initialize ToolSizePopup (delayed)...');
            
            const maxRetries = 20;
            let retryCount = 0;
            
            const tryInitialize = () => {
                // 必要な依存関係を確認
                const dependencies = {
                    ToolSizePopup: window.ToolSizePopup,
                    DOMBuilder: window.DOMBuilder,
                    StateManager: window.StateManager,
                    ToolSizeManager: window.ToolSizeManager,
                    EventBus: window.EventBus || window.TegakiEventBus,
                    config: window.TEGAKI_CONFIG?.toolSize
                };
                
                const missing = Object.entries(dependencies)
                    .filter(([key, value]) => !value)
                    .map(([key]) => key);
                
                if (missing.length > 0) {
                    console.log(`⏳ Waiting for ToolSizePopup dependencies: ${missing.join(', ')}`);
                    retryCount++;
                    if (retryCount < maxRetries) {
                        setTimeout(tryInitialize, 50);
                    } else {
                        console.warn('⚠️ ToolSizePopup dependencies not ready after', maxRetries * 50, 'ms');
                        console.warn('Missing:', missing);
                    }
                    return;
                }
                
                // DOMBuilder.createエイリアスを確認
                if (!window.DOMBuilder.create && window.DOMBuilder.createElement) {
                    window.DOMBuilder.create = window.DOMBuilder.createElement;
                    console.log('✅ DOMBuilder.create alias added');
                }
                
                // ToolSizePopupを初期化
                try {
                    if (window.ToolSizePopup && !window.ToolSizePopup.initialized) {
                        window.ToolSizePopup.initialize();
                        console.log('✅ ToolSizePopup initialized successfully');
                        console.log('   - Popup element:', !!window.ToolSizePopup.popup);
                        console.log('   - Slot buttons:', window.ToolSizePopup.slotButtons.length);
                    }
                } catch (error) {
                    console.error('❌ ToolSizePopup initialization failed:', error);
                    retryCount++;
                    if (retryCount < maxRetries) {
                        setTimeout(tryInitialize, 100);
                    }
                }
            };
            
            setTimeout(tryInitialize, 100);
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

    // History統合セットアップ
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

    // 🔥 Export System初期化（修正版・確実に実行）
    function initializeExportSystem(app) {
        console.log('🔧 Initializing Export System...');
        
        const initExportWithRetry = () => {
            let retryCount = 0;
            const maxRetries = 20; // リトライ回数増加
            
            const tryInit = () => {
                console.log(`Export init attempt ${retryCount + 1}/${maxRetries}`);
                
                // 必要な依存関係をチェック
                if (!window.animationSystem) {
                    console.log('⏳ Waiting for animationSystem...');
                    retryCount++;
                    if (retryCount < maxRetries) {
                        setTimeout(tryInit, 200);
                    } else {
                        console.error('❌ animationSystem not ready after', maxRetries, 'attempts');
                    }
                    return;
                }
                
                if (!window.CoreRuntime) {
                    console.log('⏳ Waiting for CoreRuntime...');
                    retryCount++;
                    if (retryCount < maxRetries) {
                        setTimeout(tryInit, 200);
                    }
                    return;
                }
                
                // ExportManager初期化
                const success = window.CoreRuntime.initializeExportSystem(
                    app.pixiApp,
                    () => {
                        console.log('✅ Export system initialized successfully');
                    }
                );
                
                if (success) {
                    console.log('✅ ExportManager created');
                    console.log('window.TEGAKI_EXPORT_MANAGER:', !!window.TEGAKI_EXPORT_MANAGER);
                    console.log('window.TEGAKI_EXPORT_POPUP:', !!window.TEGAKI_EXPORT_POPUP);
                    console.log('window.exportPopup:', !!window.exportPopup);
                    
                    // 🔥 ExportPopupがまだ作成されていない場合は手動作成
                    if (!window.TEGAKI_EXPORT_POPUP && !window.exportPopup) {
                        console.log('⚠️ ExportPopup not created, creating manually...');
                        
                        if (window.ExportPopup && window.TEGAKI_EXPORT_MANAGER) {
                            try {
                                window.TEGAKI_EXPORT_POPUP = new window.ExportPopup(window.TEGAKI_EXPORT_MANAGER);
                                window.exportPopup = window.TEGAKI_EXPORT_POPUP; // エイリアス
                                console.log('✅ ExportPopup created manually');
                                console.log('ExportPopup.isVisible:', window.TEGAKI_EXPORT_POPUP.isVisible);
                            } catch (error) {
                                console.error('❌ Failed to create ExportPopup manually:', error);
                            }
                        } else {
                            console.error('❌ ExportPopup class or TEGAKI_EXPORT_MANAGER not available');
                        }
                    }
                    
                    return;
                }
                
                retryCount++;
                if (retryCount < maxRetries) {
                    setTimeout(tryInit, 200);
                } else {
                    console.error('❌ Export system initialization failed after', maxRetries, 'attempts');
                }
            };
            
            tryInit();
        };
        
        // EventBusリスナー
        if (window.TegakiEventBus) {
            window.TegakiEventBus.on('animation:system-ready', initExportWithRetry);
            window.TegakiEventBus.on('animation:initialized', initExportWithRetry);
        }
        
        // 即座に1回試行
        setTimeout(initExportWithRetry, 500);
    }

    // 診断実行
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

    // メイン初期化関数
    async function initialize() {
        try {
            checkDependencies();
            
            buildDOM();
            
            window.KeyboardHandler.init();
            
            const app = new DrawingApp();
            await app.initialize();
            
            window.drawingAppInstance = app;
            
            setupHistoryIntegration();
            
            // 🔥 Export System初期化（修正版）
            initializeExportSystem(app);
            
            // ResizeSliderはDOM構築後に初期化
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

    // 公開API
    return {
        initialize,
        checkDependencies,
        DrawingApp
    };
})();

console.log('✅ core-initializer.js (ExportPopup+ToolSizePopup対応版) loaded');