// ===== キーボードハンドラ（index.html内 <script>タグ部分の置き換え用）=====
// 🔧 修正内容：
// 1. 方向キーの確実な動作（一段飛ばしの修正）
// 2. Undo/Redoの初期化待機処理
// 3. イベント発火順序の最適化

(function() {
    'use strict';
    
    // ===== 統合キーボードショートカット =====
    function setupUnifiedKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // F5, F11, F12は許可
            if (e.key === 'F5' || e.key === 'F11' || e.key === 'F12') return;
            if (e.key.startsWith('F') && e.key.length <= 3) {
                e.preventDefault();
                return;
            }
            
            const eventBus = window.TegakiEventBus;
            if (!eventBus) return;
            
            // 入力フィールドでは無効化
            const activeElement = document.activeElement;
            if (activeElement && (
                activeElement.tagName === 'INPUT' ||
                activeElement.tagName === 'TEXTAREA' ||
                activeElement.isContentEditable
            )) return;
            
            // 🔧 修正1: Undo/Redo - History初期化確認
            if (e.ctrlKey && e.code === 'KeyZ' && !e.shiftKey && !e.altKey) {
                if (window.History && window.History.undo) {
                    window.History.undo();
                    e.preventDefault();
                } else {
                    console.warn('History not initialized yet');
                }
                return;
            }
            
            if (e.ctrlKey && e.code === 'KeyY' && !e.shiftKey && !e.altKey) {
                if (window.History && window.History.redo) {
                    window.History.redo();
                    e.preventDefault();
                } else {
                    console.warn('History not initialized yet');
                }
                return;
            }
            
            if (e.ctrlKey && e.code === 'KeyZ' && e.shiftKey && !e.altKey) {
                if (window.History && window.History.redo) {
                    window.History.redo();
                    e.preventDefault();
                } else {
                    console.warn('History not initialized yet');
                }
                return;
            }
            
            // 🔧 修正2: 方向キー（←/→）- CUT切り替え
            // preventDefaultを確実に実行し、連続実行を防ぐ
            if (e.code === 'ArrowLeft' && !e.ctrlKey && !e.shiftKey && !e.altKey) {
                if (window.animationSystem && typeof window.animationSystem.goToPreviousFrame === 'function') {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    // 🔧 デバウンス処理で連続実行を防ぐ
                    if (!window._arrowKeyDebounce) {
                        window._arrowKeyDebounce = true;
                        window.animationSystem.goToPreviousFrame();
                        
                        setTimeout(() => {
                            window._arrowKeyDebounce = false;
                        }, 100);
                    }
                } else {
                    console.warn('animationSystem.goToPreviousFrame not available');
                }
                return;
            }
            
            if (e.code === 'ArrowRight' && !e.ctrlKey && !e.shiftKey && !e.altKey) {
                if (window.animationSystem && typeof window.animationSystem.goToNextFrame === 'function') {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    // 🔧 デバウンス処理で連続実行を防ぐ
                    if (!window._arrowKeyDebounce) {
                        window._arrowKeyDebounce = true;
                        window.animationSystem.goToNextFrame();
                        
                        setTimeout(() => {
                            window._arrowKeyDebounce = false;
                        }, 100);
                    }
                } else {
                    console.warn('animationSystem.goToNextFrame not available');
                }
                return;
            }
            
            // 🔧 修正3: 方向キー（↑/↓）- レイヤー階層移動
            if (e.code === 'ArrowUp' && !e.ctrlKey && !e.shiftKey && !e.altKey) {
                if (window.drawingApp && window.drawingApp.layerManager) {
                    e.preventDefault();
                    window.drawingApp.layerManager.moveActiveLayerHierarchy('up');
                } else {
                    console.warn('layerManager not available');
                }
                return;
            }
            
            if (e.code === 'ArrowDown' && !e.ctrlKey && !e.shiftKey && !e.altKey) {
                if (window.drawingApp && window.drawingApp.layerManager) {
                    e.preventDefault();
                    window.drawingApp.layerManager.moveActiveLayerHierarchy('down');
                } else {
                    console.warn('layerManager not available');
                }
                return;
            }
            
            // Delete: レイヤークリア
            if (e.code === 'Delete' && !e.ctrlKey && !e.shiftKey && !e.altKey) {
                eventBus.emit('layer:clear-active');
                e.preventDefault();
                return;
            }
            
            // Ctrl+L: 新規レイヤー作成
            if (e.ctrlKey && e.code === 'KeyL' && !e.shiftKey && !e.altKey) {
                if (window.drawingApp && window.drawingApp.layerManager) {
                    const layerSystem = window.drawingApp.layerManager;
                    const newLayerIndex = layerSystem.layers.length + 1;
                    layerSystem.createLayer(`L${newLayerIndex}`, false);
                    e.preventDefault();
                }
                return;
            }
            
            // Shift+N: 新規CUT作成
            if (e.shiftKey && e.code === 'KeyN' && !e.ctrlKey && !e.altKey) {
                if (window.animationSystem) {
                    window.animationSystem.createNewEmptyCut();
                    e.preventDefault();
                }
                return;
            }
            
            // Shift+A: タイムライン表示切替
            if (e.shiftKey && e.code === 'KeyA' && !e.ctrlKey && !e.altKey) {
                eventBus.emit('ui:toggle-timeline');
                e.preventDefault();
                return;
            }
            
            // K: 再生/停止
            if (e.code === 'KeyK' && !e.ctrlKey && !e.shiftKey && !e.altKey) {
                if (window.timelineUI && window.timelineUI.isVisible) {
                    window.timelineUI.togglePlayStop();
                    e.preventDefault();
                }
                return;
            }
            
            // Shift+C: CUTコピー&ペースト
            if (e.shiftKey && e.code === 'KeyC' && !e.ctrlKey && !e.altKey) {
                eventBus.emit('cut:copy-current');
                setTimeout(() => eventBus.emit('cut:paste-right-adjacent'), 10);
                e.preventDefault();
                return;
            }
            
            // P: ペンツール
            if (e.code === 'KeyP' && !e.ctrlKey && !e.altKey && !e.shiftKey) {
                eventBus.emit('tool:select', { tool: 'pen' });
                e.preventDefault();
                return;
            }
            
            // E: 消しゴムツール
            if (e.code === 'KeyE' && !e.ctrlKey && !e.altKey && !e.shiftKey) {
                eventBus.emit('tool:select', { tool: 'eraser' });
                e.preventDefault();
                return;
            }
        });
    }
    
    // ===== 依存関係チェック =====
    function checkPhase1Dependencies() {
        const dependencies = [
            { name: 'PIXI', obj: window.PIXI },
            { name: 'TEGAKI_CONFIG', obj: window.TEGAKI_CONFIG },
            { name: 'TegakiEventBus', obj: window.TegakiEventBus },
            { name: 'Sortable', obj: window.Sortable },
            { name: 'GIF', obj: window.GIF }
        ];
        
        const missing = dependencies.filter(dep => !dep.obj);
        if (missing.length > 0) {
            console.error('Dependencies not loaded:', missing.map(d => d.name).join(', '));
            return false;
        }
        
        if (!window.TEGAKI_CONFIG.animation) {
            console.error('Animation configuration not found');
            return false;
        }
        
        return true;
    }

    function checkCoreRuntime() {
        if (!window.CoreRuntime) return false;
        if (!window.TegakiCore || !window.TegakiCore.CoreEngine) return false;
        return true;
    }

    // ===== アプリケーション初期化 =====
    function initializeApp() {
        const CoreEngine = window.TegakiCore.CoreEngine;
        const CONFIG = window.TEGAKI_CONFIG;
        const { UIController } = window.TegakiUI;
        
        class DrawingApp {
            constructor() {
                this.pixiApp = null;
                this.coreEngine = null;
                this.uiController = null;
            }
            
            async initialize() {
                const containerEl = document.getElementById('drawing-canvas');
                if (!containerEl) {
                    console.error('Canvas container not found');
                    return false;
                }
                
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
                
                // 🔧 修正: CoreEngine初期化（stageを正しく渡す）
                this.coreEngine = new CoreEngine(this.pixiApp);
                this.coreEngine.initialize();
                
                // 🔧 修正: window.drawingAppの構造作成
                window.drawingApp = {
                    pixiApp: this.pixiApp,
                    coreEngine: this.coreEngine,
                    cameraSystem: this.coreEngine.getCameraSystem(),
                    layerManager: this.coreEngine.getLayerManager(),
                    drawingEngine: this.coreEngine.getDrawingEngine(),
                    uiController: null
                };
                
                // CoreRuntime初期化
                const runtimeSuccess = CoreRuntime.init({
                    app: this.pixiApp,
                    worldContainer: this.coreEngine.getCameraSystem().worldContainer,
                    canvasContainer: this.coreEngine.getCameraSystem().canvasContainer,
                    cameraSystem: this.coreEngine.getCameraSystem(),
                    layerManager: this.coreEngine.getLayerManager(),
                    drawingEngine: this.coreEngine.getDrawingEngine()
                });
                
                if (!runtimeSuccess) {
                    console.error('❌ CoreRuntime initialization failed');
                    return false;
                }
                
                // システム初期化完了イベント発火
                if (window.TegakiEventBus) {
                    window.TegakiEventBus.emit('system:ready');
                }
                
                // UIコントローラ作成
                this.uiController = new UIController(
                    this.coreEngine.getDrawingEngine(), 
                    this.coreEngine.getLayerManager(), 
                    this.pixiApp
                );
                
                window.drawingApp.uiController = this.uiController;
                
                // レガシー互換性
                window.drawingAppResizeCanvas = (newWidth, newHeight) => {
                    return CoreRuntime.api.resizeCanvas(newWidth, newHeight);
                };
                
                // リサイズ処理
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
                
                this.updateCanvasInfo();
                this.updateDPRInfo();
                this.startFPSMonitor();
                
                return true;
            }
            
            updateCanvasInfo() {
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
        
        return DrawingApp;
    }

    // ===== History統合 =====
    function setupHistoryIntegration() {
        if (window.TegakiEventBus && window.History) {
            window.TegakiEventBus.on('history:undo-request', () => {
                if (window.History.undo) window.History.undo();
            });
            
            window.TegakiEventBus.on('history:redo-request', () => {
                if (window.History.redo) window.History.redo();
            });
            
            window.TegakiEventBus.on('history:changed', (data) => {
                const historyElement = document.getElementById('history-info');
                if (historyElement && data) {
                    historyElement.textContent = `${data.undoCount || 0}/${window.History.MAX_HISTORY || 50}`;
                }
            });
            
            if (window.History.getHistoryInfo) {
                const info = window.History.getHistoryInfo();
                const historyElement = document.getElementById('history-info');
                if (historyElement) {
                    historyElement.textContent = `${info.undoCount}/${info.maxHistory}`;
                }
            }
        }
    }

    // ===== レイヤーパネル重複修正 =====
    function setupLayerPanelDuplicationFix() {
        if (window.TegakiEventBus) {
            window.TegakiEventBus.on('layer:created', () => {
                setTimeout(() => {
                    if (window.layerSystem && window.layerSystem.updateLayerPanelUI) {
                        window.layerSystem.updateLayerPanelUI();
                    }
                }, 50);
            });
            
            window.TegakiEventBus.on('layer:deleted', () => {
                setTimeout(() => {
                    if (window.layerSystem && window.layerSystem.updateLayerPanelUI) {
                        window.layerSystem.updateLayerPanelUI();
                    }
                }, 50);
            });
        }
    }

    // ===== DOMContentLoaded =====
    window.addEventListener('DOMContentLoaded', async () => {
        console.log('=== お絵かきツール 完全修正版: 起動開始 ===');
        
        if (!checkPhase1Dependencies()) {
            console.error('❌ Dependencies check failed');
            return;
        }
        
        if (!checkCoreRuntime()) {
            console.error('❌ CoreRuntime not initialized');
            return;
        }
        
        const DrawingApp = initializeApp();
        const app = new DrawingApp();
        const success = await app.initialize();
        
        if (!success) {
            console.error('❌ App initialization failed');
            return;
        }
        
        console.log('✅ App initialization successful');
        
        // 🔧 修正: キーボードハンドラをHistory初期化後に設定
        setTimeout(() => {
            setupUnifiedKeyboardShortcuts();
            console.log('✅ Keyboard shortcuts initialized');
        }, 300);
        
        setupHistoryIntegration();
        setupLayerPanelDuplicationFix();
        
        if (window.CoordinateSystem && window.CoordinateSystem.diagnoseReferences) {
            window.CoordinateSystem.diagnoseReferences();
        }
        
        console.log('=== お絵かきツール 完全修正版: 起動完了 ===');
    });

    // ===== ロード前の早期初期化（DOMContentLoadedより前に実行）=====
    if (document.readyState === 'loading') {
        // まだロード中の場合は何もしない（DOMContentLoadedで処理）
    } else {
        // 既にロード完了している場合は即座に実行
        console.warn('⚠️ Document already loaded. Running initialization immediately.');
        const event = new Event('DOMContentLoaded');
        window.dispatchEvent(event);
    }
})();