/**
 * Core Engine (Phase2 Integrated)
 * PixiJS v8.13 対応版
 * 分離システムの統合管理
 */
(function() {
    'use strict';

    class CoreEngine {
        constructor(canvasElement) {
            this.canvasElement = canvasElement;
            this.pixiApp = null;
            this.worldContainer = null;
            
            // 分離システム
            this.cameraSystem = null;
            this.layerManager = null;
            this.drawingClipboardSystem = null;
            
            // 初期化状態
            this.isInitialized = false;
            this.initializationError = null;
        }

        /**
         * 依存関係チェック（強化版）
         */
        checkDependencies() {
            const required = [
                { path: 'window.CONFIG', name: 'CONFIG' },
                { path: 'window.CoordinateSystem', name: 'CoordinateSystem' },
                { path: 'window.TegakiRuntime', name: 'TegakiRuntime' },
                { path: 'window.TegakiUI', name: 'TegakiUI' },
                { path: 'window.TegakiCameraSeparated.CameraSystem', name: 'CameraSystem' },
                { path: 'window.TegakiLayerSeparated.LayerManager', name: 'LayerManager' },
                { path: 'window.TegakiDrawingClipboardSeparated.DrawingClipboardSystem', name: 'DrawingClipboardSystem' }
            ];
            
            const missing = [];
            
            for (const dep of required) {
                try {
                    const obj = this.getNestedObject(window, dep.path);
                    if (obj === undefined) {
                        missing.push(dep.name);
                    }
                } catch (e) {
                    missing.push(dep.name);
                }
            }
            
            if (missing.length > 0) {
                const message = `Missing separated systems: ${missing.join(', ')}`;
                console.error('❌ ' + message);
                throw new Error(message);
            }
            
            console.log('✅ All separated system dependencies verified');
            return true;
        }

        /**
         * ネストされたオブジェクトを安全に取得
         */
        getNestedObject(obj, path) {
            const parts = path.split('.');
            let current = obj;
            
            for (let i = 1; i < parts.length; i++) { // window を skip
                const part = parts[i];
                if (current && typeof current === 'object' && part in current) {
                    current = current[part];
                } else {
                    return undefined;
                }
            }
            
            return current;
        }

        /**
         * 初期化
         */
        async initialize() {
            try {
                console.log('🚀 CoreEngine initialization started');
                
                // 依存関係チェック
                this.checkDependencies();
                
                // PixiJS Application初期化
                await this.initializePixiApp();
                
                // 分離システム初期化
                await this.initializeSeparatedSystems();
                
                // システム連携設定
                this.setupCrossReferences();
                
                // UI連携
                this.setupUIIntegration();
                
                this.isInitialized = true;
                console.log('✅ CoreEngine initialization completed');
                
            } catch (error) {
                this.initializationError = error;
                console.error('❌ CoreEngine initialization failed:', error);
                throw error;
            }
        }

        /**
         * PixiJS App初期化
         */
        async initializePixiApp() {
            console.log('📦 Initializing PixiJS Application...');
            
            const screenWidth = window.innerWidth - 250; // レイヤーパネル分を除く
            const screenHeight = window.innerHeight;
            
            this.pixiApp = new PIXI.Application();
            
            await this.pixiApp.init({
                width: screenWidth,
                height: screenHeight,
                backgroundAlpha: 0,
                resolution: window.devicePixelRatio || 1,
                antialias: true,
                eventMode: 'static'
            });
            
            // キャンバスDOM設定
            this.pixiApp.canvas.style.display = 'block';
            this.pixiApp.canvas.style.position = 'absolute';
            this.pixiApp.canvas.style.top = '0';
            this.pixiApp.canvas.style.left = '0';
            
            // キャンバス要素に追加
            if (this.canvasElement) {
                this.canvasElement.parentNode.replaceChild(this.pixiApp.canvas, this.canvasElement);
            }
            
            // ワールドコンテナ作成
            this.worldContainer = new PIXI.Container();
            this.worldContainer.eventMode = 'static';
            this.pixiApp.stage.addChild(this.worldContainer);
            
            // リサイズ処理
            this.setupResize();
            
            console.log('✅ PixiJS Application initialized');
        }

        /**
         * 分離システム初期化
         */
        async initializeSeparatedSystems() {
            console.log('🔧 Initializing separated systems...');
            
            // CameraSystem初期化
            this.cameraSystem = new window.TegakiCameraSeparated.CameraSystem();
            await this.cameraSystem.initialize(this.pixiApp, this.worldContainer);
            
            // LayerManager初期化
            this.layerManager = new window.TegakiLayerSeparated.LayerManager();
            await this.layerManager.initialize(this.pixiApp, this.worldContainer);
            
            // DrawingClipboardSystem初期化
            this.drawingClipboardSystem = new window.TegakiDrawingClipboardSeparated.DrawingClipboardSystem();
            await this.drawingClipboardSystem.initialize(this.pixiApp, this.worldContainer, this.layerManager);
            
            console.log('✅ Separated systems initialized');
        }

        /**
         * システム間連携設定
         */
        setupCrossReferences() {
            console.log('🔗 Setting up cross-references...');
            
            // カメラシステムへの参照設定
            this.cameraSystem.setLayerManager(this.layerManager);
            this.cameraSystem.setDrawingEngine(this.drawingClipboardSystem.getDrawingEngine());
            
            console.log('✅ Cross-references established');
        }

        /**
         * UI統合設定
         */
        setupUIIntegration() {
            console.log('🎨 Setting up UI integration...');
            
            // ツールパネル統合
            this.setupToolPanel();
            
            // レイヤーパネル統合
            this.setupLayerPanel();
            
            console.log('✅ UI integration completed');
        }

        /**
         * ツールパネル設定
         */
        setupToolPanel() {
            const drawingSystem = this.drawingClipboardSystem;
            
            // ペンツール
            const penTool = document.getElementById('pen-tool');
            if (penTool) {
                penTool.addEventListener('click', () => {
                    drawingSystem.setDrawingTool('pen');
                    this.setActiveToolButton(penTool);
                });
            }
            
            // 消しゴムツール
            const eraserTool = document.getElementById('eraser-tool');
            if (eraserTool) {
                eraserTool.addEventListener('click', () => {
                    drawingSystem.setDrawingTool('eraser');
                    this.setActiveToolButton(eraserTool);
                });
            }
            
            // ブラシサイズ
            const brushSize = document.getElementById('brush-size');
            const brushSizeValue = document.getElementById('brush-size-value');
            if (brushSize && brushSizeValue) {
                brushSize.addEventListener('input', (e) => {
                    const size = parseInt(e.target.value);
                    brushSizeValue.textContent = size;
                    drawingSystem.setBrushSettings({ size });
                });
            }
            
            // ブラシ色
            const brushColor = document.getElementById('brush-color');
            if (brushColor) {
                brushColor.addEventListener('change', (e) => {
                    const color = parseInt(e.target.value.replace('#', ''), 16);
                    drawingSystem.setBrushSettings({ color });
                });
            }
            
            // 不透明度
            const brushOpacity = document.getElementById('brush-opacity');
            const opacityValue = document.getElementById('opacity-value');
            if (brushOpacity && opacityValue) {
                brushOpacity.addEventListener('input', (e) => {
                    const opacity = parseInt(e.target.value);
                    opacityValue.textContent = opacity;
                    drawingSystem.setBrushSettings({ opacity });
                });
            }
        }

        /**
         * レイヤーパネル設定
         */
        setupLayerPanel() {
            // レイヤー追加ボタン
            const addLayerBtn = document.getElementById('add-layer-btn');
            if (addLayerBtn) {
                addLayerBtn.addEventListener('click', () => {
                    this.layerManager.createLayer();
                });
            }
            
            // TegakiUI との連携設定
            if (window.TegakiUI) {
                window.TegakiUI.setCallbacks({
                    onLayerSelect: (index) => this.layerManager.setActiveLayer(index),
                    onLayerVisibilityToggle: (index) => this.layerManager.toggleLayerVisibility(index),
                    onLayerDelete: (index) => this.layerManager.deleteLayer(index),
                    onLayerRename: (index, name) => this.layerManager.renameLayer(index, name)
                });
            }
        }

        /**
         * アクティブツールボタン設定
         */
        setActiveToolButton(activeButton) {
            // 全ツールボタンから active クラスを削除
            document.querySelectorAll('.tool-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            
            // アクティブボタンに active クラスを追加
            activeButton.classList.add('active');
        }

        /**
         * リサイズ処理設定
         */
        setupResize() {
            window.addEventListener('resize', () => {
                const screenWidth = window.innerWidth - 250;
                const screenHeight = window.innerHeight;
                
                this.pixiApp.renderer.resize(screenWidth, screenHeight);
                
                // カメラシステムにサイズ変更を通知
                if (this.cameraSystem) {
                    this.cameraSystem.updateCamera();
                }
            });
        }

        /**
         * カメラシステム取得
         */
        getCameraSystem() {
            return this.cameraSystem;
        }

        /**
         * レイヤーマネージャー取得
         */
        getLayerManager() {
            return this.layerManager;
        }

        /**
         * 描画クリップボードシステム取得
         */
        getDrawingClipboardSystem() {
            return this.drawingClipboardSystem;
        }

        /**
         * PixiJSアプリケーション取得
         */
        getPixiApp() {
            return this.pixiApp;
        }

        /**
         * ワールドコンテナ取得
         */
        getWorldContainer() {
            return this.worldContainer;
        }

        /**
         * 初期化状態確認
         */
        isEngineInitialized() {
            return this.isInitialized;
        }

        /**
         * 初期化エラー取得
         */
        getInitializationError() {
            return this.initializationError;
        }

        /**
         * デバッグ情報取得
         */
        getDebugInfo() {
            return {
                initialized: this.isInitialized,
                error: this.initializationError?.message,
                pixiApp: !!this.pixiApp,
                worldContainer: !!this.worldContainer,
                cameraSystem: !!this.cameraSystem,
                layerManager: !!this.layerManager,
                drawingClipboardSystem: !!this.drawingClipboardSystem,
                layerCount: this.layerManager?.getLayerCount() || 0,
                cameraInfo: this.cameraSystem?.getCameraInfo() || null
            };
        }

        /**
         * 破棄処理
         */
        destroy() {
            console.log('🗑️ CoreEngine destruction started');
            
            // 分離システム破棄
            if (this.drawingClipboardSystem) {
                this.drawingClipboardSystem.destroy();
                this.drawingClipboardSystem = null;
            }
            
            if (this.layerManager) {
                this.layerManager.destroy();
                this.layerManager = null;
            }
            
            if (this.cameraSystem) {
                this.cameraSystem.destroy();
                this.cameraSystem = null;
            }
            
            // PixiJS破棄
            if (this.pixiApp) {
                this.pixiApp.destroy(true);
                this.pixiApp = null;
            }
            
            this.worldContainer = null;
            this.isInitialized = false;
            
            console.log('✅ CoreEngine destroyed');
        }
    }

    // グローバル公開
    if (!window.TegakiCore) {
        window.TegakiCore = {};
    }
    window.TegakiCore.CoreEngine = CoreEngine;
    
    console.log('✅ core-engine.js loaded (Phase2 integrated)');
})();