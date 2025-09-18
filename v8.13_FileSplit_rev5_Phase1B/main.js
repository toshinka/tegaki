// ===== main.js - 統合制御・エントリーポイント（分割版：約300行に縮小） =====

(function() {
    'use strict';
    
    if (typeof PIXI === 'undefined') {
        console.error('PIXI is not loaded');
        return;
    }
    
    console.log('PixiJS loaded:', PIXI.VERSION);
    
    // グローバル設定とモジュール取得
    const CONFIG = window.TEGAKI_CONFIG;
    const { UIController } = window.TegakiUI;
    const { CameraSystem, LayerManager, DrawingEngine, ClipboardSystem, InteractionManager } = window.TegakiModules;
    
    const log = (...args) => {
        if (CONFIG.debug) console.log(...args);
    };

    // === メインアプリケーション（統合制御のみ） ===
    class DrawingApp {
        constructor() {
            this.pixiApp = null;
            this.cameraSystem = null;
            this.layerManager = null;
            this.drawingEngine = null;
            this.interactionManager = null;
            this.uiController = null;
            this.clipboardSystem = null;
        }

        async initialize() {
            const containerEl = document.getElementById('drawing-canvas');
            if (!containerEl) {
                throw new Error('Canvas container not found');
            }

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

            // === モジュール初期化（分離済みクラスを組み合わせ） ===
            this.cameraSystem = new CameraSystem(this.pixiApp);
            this.layerManager = new LayerManager(this.cameraSystem.canvasContainer, this.pixiApp, this.cameraSystem);
            this.drawingEngine = new DrawingEngine(this.cameraSystem, this.layerManager);
            this.interactionManager = new InteractionManager(this.pixiApp, this.drawingEngine, this.layerManager);
            this.uiController = new UIController(this.drawingEngine, this.layerManager, this.pixiApp);
            this.clipboardSystem = new ClipboardSystem();

            // === 相互参照の設定（モジュール間連携） ===
            this.cameraSystem.layerManager = this.layerManager;
            this.cameraSystem.drawingEngine = this.drawingEngine;

            // === 初期レイヤー作成 ===
            this.layerManager.createLayer('背景', true);
            this.layerManager.createLayer('レイヤー1');
            this.layerManager.setActiveLayer(1);

            // === UI初期化 ===
            this.layerManager.updateLayerPanelUI();
            this.layerManager.updateStatusDisplay();
            window.TegakiUI.initializeSortable(this.layerManager);

            // === システム統合処理 ===
            this.setupTicker();
            this.setupWindowResize();
            this.setupCanvasResize();
            
            // === ステータス情報更新 ===
            this.updateCanvasInfo();
            this.updateDPRInfo();
            this.startFPSMonitor();

            return true;
        }
        
        // === システム統合処理群 ===
        
        setupTicker() {
            this.pixiApp.ticker.add(() => {
                this.layerManager.processThumbnailUpdates();
            });
        }
        
        // 追加: キャンバスリサイズ処理の統合
        setupCanvasResize() {
            // UIControllerからの呼び出し用にグローバルに公開
            window.drawingAppResizeCanvas = (newWidth, newHeight) => {
                console.log('DrawingApp: Received canvas resize request:', newWidth, 'x', newHeight);
                
                // CONFIG更新
                CONFIG.canvas.width = newWidth;
                CONFIG.canvas.height = newHeight;
                
                // CameraSystemの更新
                this.cameraSystem.resizeCanvas(newWidth, newHeight);
                
                // LayerManagerの背景レイヤー更新
                this.layerManager.layers.forEach(layer => {
                    if (layer.layerData.isBackground && layer.layerData.backgroundGraphics) {
                        layer.layerData.backgroundGraphics.clear();
                        layer.layerData.backgroundGraphics.rect(0, 0, newWidth, newHeight);
                        layer.layerData.backgroundGraphics.fill(CONFIG.background.color);
                    }
                });
                
                // UI情報更新
                this.updateCanvasInfo();
                
                // 全レイヤーのサムネイル更新
                for (let i = 0; i < this.layerManager.layers.length; i++) {
                    this.layerManager.requestThumbnailUpdate(i);
                }
                
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
                
                this.cameraSystem.initializeCamera();
                
                // 修正2: ウィンドウリサイズ時にガイドライン再作成
                this.cameraSystem.updateGuideLinesForCanvasResize();
            });
        }

        // === ステータス情報更新群 ===
        
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
            console.log('Initializing Split Drawing App Phase1 (File Split)...');
            
            // 分割モジュールの存在確認
            if (!window.TegakiModules?.CameraSystem) {
                throw new Error('CameraSystem module not loaded');
            }
            if (!window.TegakiModules?.LayerManager) {
                throw new Error('LayerManager module not loaded');
            }
            if (!window.TegakiModules?.DrawingEngine) {
                throw new Error('DrawingEngine module not loaded');
            }
            
            const app = new DrawingApp();
            await app.initialize();
            
            window.drawingApp = app;

            console.log('🎨 Split Drawing App Phase1 (File Split) initialized successfully!');
            console.log('📁 Phase1 ファイル分割完了:');
            console.log('  - ✅ camera-system.js: カメラ・座標変換システム分離');
            console.log('  - ✅ layer-manager.js: レイヤー管理・変形システム分離');
            console.log('  - ✅ drawing-engine.js: 描画エンジン・クリップボード分離');
            console.log('  - ✅ main.js: 統合制御のみに縮小（800行→300行）');
            console.log('  - ✅ 明確なAPI境界設定：window.TegakiModules.* 形式');
            console.log('  - ✅ Claude改修効率化：機能別修正が可能');

        } catch (error) {
            console.error('Failed to initialize Split Drawing App:', error);
        }
    });

})();