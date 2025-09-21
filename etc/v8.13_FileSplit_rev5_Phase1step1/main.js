// ===== main.js - 軽量化版（統合制御のみ） =====
// CoreEngineを使用した統合制御とアプリケーション起動のみ

(function() {
    'use strict';
    
    if (typeof PIXI === 'undefined') {
        console.error('PIXI is not loaded');
        return;
    }
    
    console.log('PixiJS loaded:', PIXI.VERSION);
    
    // グローバル設定とUIクラスを取得
    const CONFIG = window.TEGAKI_CONFIG;
    const { UIController } = window.TegakiUI;
    const { CoreEngine } = window.TegakiCore;

    // === インタラクション管理（簡素化版） ===
    class InteractionManager {
        constructor(app, coreEngine) {
            this.app = app;
            this.coreEngine = coreEngine;
            this.setupKeyboardEvents();
            
            // 初期ツール設定
            this.switchTool('pen');
        }

        setupKeyboardEvents() {
            document.addEventListener('keydown', (e) => {
                if (e.key.toLowerCase() === 'p' && !e.ctrlKey && !e.altKey && !e.metaKey) {
                    this.switchTool('pen');
                    e.preventDefault();
                }
                if (e.key.toLowerCase() === 'e' && !e.ctrlKey && !e.altKey && !e.metaKey) {
                    this.switchTool('eraser');
                    e.preventDefault();
                }
            });
        }

        switchTool(tool) {
            this.coreEngine.switchTool(tool);
            
            document.querySelectorAll('.tool-button').forEach(btn => btn.classList.remove('active'));
            const toolBtn = document.getElementById(tool + '-tool');
            if (toolBtn) toolBtn.classList.add('active');

            const toolNames = { pen: 'ベクターペン', eraser: '消しゴム' };
            const toolElement = document.getElementById('current-tool');
            if (toolElement) {
                toolElement.textContent = toolNames[tool] || tool;
            }

            this.updateCursor();
        }

        updateCursor() {
            const layerManager = this.coreEngine.getLayerManager();
            if (layerManager && layerManager.vKeyPressed) {
                // レイヤー操作中はLayerManagerが制御
                return;
            }
            
            const drawingEngine = this.coreEngine.getDrawingEngine();
            const tool = drawingEngine ? drawingEngine.currentTool : 'pen';
            this.app.canvas.style.cursor = tool === 'eraser' ? 'cell' : 'crosshair';
        }
    }

    // === メインアプリケーション（軽量化版） ===
    class DrawingApp {
        constructor() {
            this.pixiApp = null;
            this.coreEngine = null;
            this.interactionManager = null;
            this.uiController = null;
        }

        async initialize() {
            const containerEl = document.getElementById('drawing-canvas');
            if (!containerEl) {
                throw new Error('Canvas container not found');
            }

            // PixiJS初期化
            this.pixiApp = new PIXI.Application();
            
            const dpr = window.devicePixelRatio || 1;
            const screenWidth = window.innerWidth - 50;
            const screenHeight = window.innerHeight;
            
            await this.pixiApp.init({
                width: screenWidth,
                height: screenHeight,
                backgroundAlpha: 0,
                resolution: 1,
                antialias: true,
                eventMode: 'static',
                eventFeatures: {
                    move: true,
                    globalMove: true,
                    click: true,
                    wheel: true,
                }
            });
            
            containerEl.innerHTML = '';
            containerEl.appendChild(this.pixiApp.canvas);

            this.pixiApp.canvas.style.width = `${screenWidth}px`;
            this.pixiApp.canvas.style.height = `${screenHeight}px`;

            // コアエンジン初期化
            this.coreEngine = new CoreEngine(this.pixiApp);
            this.coreEngine.initialize();
            
            // UI・インタラクション初期化
            this.interactionManager = new InteractionManager(this.pixiApp, this.coreEngine);
            this.uiController = new UIController(
                this.coreEngine.getDrawingEngine(), 
                this.coreEngine.getLayerManager(), 
                this.pixiApp
            );

            // ウィンドウリサイズ処理
            this.setupWindowResize();
            
            // キャンバスリサイズ用の統合処理
            this.setupCanvasResize();
            
            // 情報表示・モニタリング
            this.updateCanvasInfo();
            this.updateDPRInfo();
            this.startFPSMonitor();

            return true;
        }
        
        // キャンバスリサイズ処理の統合
        setupCanvasResize() {
            // UIControllerからの呼び出し用にグローバルに公開
            window.drawingAppResizeCanvas = (newWidth, newHeight) => {
                console.log('DrawingApp: Received canvas resize request:', newWidth, 'x', newHeight);
                
                // CoreEngineの統合処理を呼び出し
                this.coreEngine.resizeCanvas(newWidth, newHeight);
                
                // UI情報更新
                this.updateCanvasInfo();
                
                console.log('DrawingApp: Canvas resize completed');
            };
        }

        setupWindowResize() {
            window.addEventListener('resize', () => {
                const newWidth = window.innerWidth - 50;
                const newHeight = window.innerHeight;
                
                this.pixiApp.renderer.resize(newWidth, newHeight);
                this.pixiApp.canvas.style.width = `${newWidth}px`;
                this.pixiApp.canvas.style.height = `${newHeight}px`;
                
                const cameraSystem = this.coreEngine.getCameraSystem();
                cameraSystem.initializeCamera();
                
                // ウィンドウリサイズ時にガイドライン再作成
                cameraSystem.updateGuideLinesForCanvasResize();
            });
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
                    if (element) {
                        element.textContent = fps;
                    }

                    frameCount = 0;
                    lastTime = currentTime;
                }

                requestAnimationFrame(updateFPS);
            };

            updateFPS();
        }
    }

    // === アプリケーション起動 ===
    window.addEventListener('DOMContentLoaded', async () => {
        try {
            console.log('Initializing CoreEngine-based Drawing App...');
            
            const app = new DrawingApp();
            await app.initialize();
            
            window.drawingApp = app;

            console.log('🎨 CoreEngine Drawing App Phase1.5分離版 initialized successfully!');
            console.log('🔧 Phase1.5分離実装完了:');
            console.log('  - ✅ CoreEngine統合: CameraSystem + LayerManager + DrawingEngine + ClipboardSystem');
            console.log('  - ✅ 相互依存関係の内部化: API境界明確化・改修効率向上');
            console.log('  - ✅ main.js軽量化: 約800行→約200行（75%削減）');
            console.log('  - ✅ 非破壊機能完全継承: コピー&ペースト・レイヤー変形確定');
            console.log('  - ✅ Claude改修最適化: 機能別ファイル分離・作業範囲明確化');

        } catch (error) {
            console.error('Failed to initialize CoreEngine Drawing App:', error);
        }
    });

})();