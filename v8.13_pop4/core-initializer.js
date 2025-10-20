// ===== core-initializer.js - PopupManager対応改修版 =====
// 責務: アプリケーション初期化、PopupManager統合
// 🔥 改修: PopupManager導入、遅延初期化の削除、一元化

window.CoreInitializer = (function() {
    'use strict';

    // 依存関係チェック
    function checkDependencies() {
        const dependencies = [
            { name: 'PIXI', obj: window.PIXI },
            { name: 'TEGAKI_CONFIG', obj: window.TEGAKI_CONFIG },
            { name: 'TegakiEventBus', obj: window.TegakiEventBus },
            { name: 'TegakiPopupManager', obj: window.TegakiPopupManager },
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

    // PopupManager初期化
    function initializePopupManager(app, coreEngine) {
        console.log('🔧 Initializing PopupManager...');
        
        const popupManager = new window.TegakiPopupManager(window.TegakiEventBus);
        
        // 優先度1: Settings（依存関係なし）
        popupManager.register('settings', window.TegakiUI.SettingsPopup, {
            drawingEngine: coreEngine.getDrawingEngine()
        }, { priority: 1 });
        
        // 優先度2: QuickAccess（依存関係なし）
        popupManager.register('quickAccess', window.TegakiUI.QuickAccessPopup, {
            drawingEngine: coreEngine.getDrawingEngine()
        }, { priority: 2 });
        
        // 優先度3: Album（AnimationSystem依存）
        popupManager.register('album', window.TegakiUI.AlbumPopup, {
            app: app.pixiApp,
            layerSystem: coreEngine.getLayerManager(),
            animationSystem: coreEngine.animationSystem
        }, { 
            priority: 3,
            waitFor: ['animationSystem']
        });
        
        // 優先度4: Export（ExportManager依存）
        popupManager.register('export', window.TegakiExportPopup, {
            exportManager: null // 後で設定
        }, { 
            priority: 4,
            waitFor: ['TEGAKI_EXPORT_MANAGER']
        });
        
        // 初期化実行
        popupManager.initializeAll();
        
        // グローバル公開
        window.PopupManager = popupManager;
        
        console.log('✅ PopupManager initialized');
        
        return popupManager;
    }

    // DrawingAppクラス定義
    class DrawingApp {
        constructor() {
            this.pixiApp = null;
            this.coreEngine = null;
            this.uiController = null;
            this.settingsManager = null;
            this.popupManager = null;
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
            
            // SettingsManager初期化
            this.settingsManager = initializeSettingsManager(
                window.TegakiEventBus,
                CONFIG
            );
            
            // CoreRuntime初期化
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

            // PopupManager初期化（UIControllerの後）
            this.popupManager = initializePopupManager(this, this.coreEngine);
            
            // Export System初期化
            this.initializeExportSystem();
            
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
        
        initializeExportSystem() {
            console.log('🔧 Initializing Export System...');
            
            const tryInit = () => {
                if (!window.animationSystem) {
                    console.log('⏳ Waiting for animationSystem...');
                    setTimeout(tryInit, 200);
                    return;
                }
                
                if (!window.CoreRuntime) {
                    console.log('⏳ Waiting for CoreRuntime...');
                    setTimeout(tryInit, 200);
                    return;
                }
                
                // ExportManager初期化
                const success = window.CoreRuntime.initializeExportSystem(
                    this.pixiApp,
                    () => {
                        console.log('✅ Export system initialized');
                        
                        // PopupManagerのExport依存関係を更新
                        if (window.PopupManager && window.TEGAKI_EXPORT_MANAGER) {
                            const exportPopupData = window.PopupManager.popups.get('export');
                            if (exportPopupData) {
                                exportPopupData.dependencies.exportManager = window.TEGAKI_EXPORT_MANAGER;
                                
                                // 再初期化試行
                                window.PopupManager.initialize('export');
                            }
                        }
                        
                        // EventBus通知
                        if (window.TegakiEventBus) {
                            window.TegakiEventBus.emit('export:manager:initialized');
                        }
                    }
                );
                
                if (!success) {
                    console.log('⏳ Export system not ready, retrying...');
                    setTimeout(tryInit, 200);
                }
            };
            
            // EventBusリスナー
            if (window.TegakiEventBus) {
                window.TegakiEventBus.on('animation:system-ready', tryInit);
                window.TegakiEventBus.on('animation:initialized', tryInit);
            }
            
            // 即座に1回試行
            setTimeout(tryInit, 500);
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
        
        // PopupManager診断
        if (window.PopupManager) {
            setTimeout(() => {
                window.PopupManager.diagnose();
            }, 2000);
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

console.log('✅ core-initializer.js (PopupManager統合版) loaded');