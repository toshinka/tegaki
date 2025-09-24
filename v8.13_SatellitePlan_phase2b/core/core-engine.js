/**
 * Core Engine (Phase2 Integrated) - 修正版
 * PixiJS v8.13 対応版
 * GPT5案指摘対応済み
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
         * 依存関係チェック（緩和版：Phase2のグローバル名対応、警告のみ）
         */
        checkDependencies() {
            const required = [
                { path: 'window.TEGAKI_CONFIG', name: 'TEGAKI_CONFIG', critical: true },
                { path: 'window.CoordinateSystem', name: 'CoordinateSystem', critical: true },
                { path: 'window.TegakiRuntime', name: 'TegakiRuntime', critical: false },
                { path: 'window.TegakiCameraSeparated.CameraSystem', name: 'CameraSystem', critical: false },
                { path: 'window.TegakiLayerSeparated.LayerManager', name: 'LayerManager', critical: false },
                { path: 'window.TegakiDrawingClipboardSeparated.DrawingClipboardSystem', name: 'DrawingClipboardSystem', critical: false }
            ];
            
            const missing = [];
            const warnings = [];
            
            for (const dep of required) {
                try {
                    const obj = this.getNestedObject(window, dep.path);
                    if (obj === undefined) {
                        if (dep.critical) {
                            missing.push(dep.name);
                        } else {
                            warnings.push(dep.name);
                        }
                    }
                } catch (e) {
                    if (dep.critical) {
                        missing.push(dep.name);
                    } else {
                        warnings.push(dep.name);
                    }
                }
            }
            
            if (missing.length > 0) {
                const message = `Missing critical dependencies: ${missing.join(', ')}`;
                console.error('❌ ' + message);
                throw new Error(message);
            }
            
            if (warnings.length > 0) {
                console.warn('⚠️ Missing optional dependencies:', warnings.join(', '));
                console.warn('   Some features may be limited');
            }
            
            console.log('✅ Critical dependencies verified');
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
                
                // PixiJS Application初期化（修正版：非同期対応）
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
         * PixiJS App初期化（修正版：PixiJS v8.13非同期初期化対応）
         */
        async initializePixiApp() {
            console.log('📦 Initializing PixiJS Application...');
            
            const screenWidth = window.innerWidth - 50; // サイドバー分を除く
            const screenHeight = window.innerHeight;
            
            // PixiJS v8.13では非同期初期化が必要
            this.pixiApp = new PIXI.Application();
            
            await this.pixiApp.init({
                width: screenWidth,
                height: screenHeight,
                backgroundAlpha: 0,
                resolution: window.devicePixelRatio || 1,
                antialias: true
            });
            
            // キャンバスDOM設定（v8.13では canvas プロパティを使用）
            this.pixiApp.canvas.style.display = 'block';
            this.pixiApp.canvas.style.position = 'absolute';
            this.pixiApp.canvas.style.top = '0';
            this.pixiApp.canvas.style.left = '0';
            
            // キャンバス要素への追加
            if (this.canvasElement && this.canvasElement.parentNode) {
                this.canvasElement.parentNode.replaceChild(this.pixiApp.canvas, this.canvasElement);
            } else {
                document.body.appendChild(this.pixiApp.canvas);
            }
            
            // ワールドコンテナ作成
            this.worldContainer = new PIXI.Container();
            this.worldContainer.label = 'worldContainer';
            this.worldContainer.eventMode = 'static';
            this.pixiApp.stage.addChild(this.worldContainer);
            
            // 互換性確保: v7系コードがview参照する場合
            this.pixiApp.view = this.pixiApp.canvas;
            
            // リサイズ処理
            this.setupResize();
            
            console.log('✅ PixiJS Application initialized (v8.13 async)');
        }

        /**
         * 分離システム初期化（安全版）
         */
        async initializeSeparatedSystems() {
            console.log('🔧 Initializing separated systems...');
            
            // CameraSystem初期化
            if (window.TegakiCameraSeparated && window.TegakiCameraSeparated.CameraSystem) {
                try {
                    this.cameraSystem = new window.TegakiCameraSeparated.CameraSystem();
                    await this.cameraSystem.initialize(this.pixiApp, this.worldContainer);
                    console.log('✅ CameraSystem initialized');
                } catch (error) {
                    console.warn('⚠️ CameraSystem initialization failed:', error);
                }
            } else {
                console.warn('⚠️ CameraSystem not available');
            }
            
            // LayerManager初期化
            if (window.TegakiLayerSeparated && window.TegakiLayerSeparated.LayerManager) {
                try {
                    this.layerManager = new window.TegakiLayerSeparated.LayerManager();
                    await this.layerManager.initialize(this.pixiApp, this.worldContainer);
                    console.log('✅ LayerManager initialized');
                } catch (error) {
                    console.warn('⚠️ LayerManager initialization failed:', error);
                }
            } else {
                console.warn('⚠️ LayerManager not available');
            }
            
            // DrawingClipboardSystem初期化（存在する場合）
            if (window.TegakiDrawingClipboardSeparated && window.TegakiDrawingClipboardSeparated.DrawingClipboardSystem) {
                try {
                    this.drawingClipboardSystem = new window.TegakiDrawingClipboardSeparated.DrawingClipboardSystem();
                    await this.drawingClipboardSystem.initialize(this.pixiApp, this.worldContainer, this.layerManager);
                    console.log('✅ DrawingClipboardSystem initialized');
                } catch (error) {
                    console.warn('⚠️ DrawingClipboardSystem initialization failed:', error);
                }
            } else {
                console.warn('⚠️ DrawingClipboardSystem not available - basic drawing will be limited');
            }
            
            console.log('✅ Separated systems initialization completed');
        }

        /**
         * システム間連携設定（修正版：CoordinateSystemに安全参照を供給）
         */
        setupCrossReferences() {
            console.log('🔗 Setting up cross-references...');
            
            // CoordinateSystemに安全な参照を設定
            if (window.CoordinateSystem && typeof window.CoordinateSystem.setContainers === 'function') {
                try {
                    // canvasContainerがある場合は渡す（Phase1互換）
                    const canvasContainer = this.worldContainer.children.find(c => c.label === 'canvasContainer') || null;
                    window.CoordinateSystem.setContainers({
                        app: this.pixiApp,
                        worldContainer: this.worldContainer,
                        canvasContainer: canvasContainer
                    });
                    console.log('✅ CoordinateSystem references set');
                } catch (e) {
                    console.warn('CoordinateSystem.setContainers failed:', e);
                }
            }
            
            // カメラシステムへの参照設定
            if (this.cameraSystem) {
                if (this.layerManager && this.cameraSystem.setLayerManager) {
                    this.cameraSystem.setLayerManager(this.layerManager);
                }
                if (this.drawingClipboardSystem && this.cameraSystem.setDrawingEngine) {
                    this.cameraSystem.setDrawingEngine(this.drawingClipboardSystem.getDrawingEngine());
                }
            }
            
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
                    if (drawingSystem && drawingSystem.setDrawingTool) {
                        drawingSystem.setDrawingTool('pen');
                    }
                    this.setActiveToolButton(penTool);
                });
            }
            
            // 消しゴムツール
            const eraserTool = document.getElementById('eraser-tool');
            if (eraserTool) {
                eraserTool.addEventListener('click', () => {
                    if (drawingSystem && drawingSystem.setDrawingTool) {
                        drawingSystem.setDrawingTool('eraser');
                    }
                    this.setActiveToolButton(eraserTool);
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
                    if (this.layerManager && this.layerManager.createLayer) {
                        this.layerManager.createLayer();
                    }
                });
            }
            
            // TegakiUI との連携設定
            if (window.TegakiUI) {
                window.TegakiUI.setCallbacks({
                    onLayerSelect: (index) => {
                        if (this.layerManager) this.layerManager.setActiveLayer(index);
                    },
                    onLayerVisibilityToggle: (index) => {
                        if (this.layerManager) this.layerManager.toggleLayerVisibility(index);
                    },
                    onLayerDelete: (index) => {
                        if (this.layerManager) this.layerManager.deleteLayer(index);
                    },
                    onLayerRename: (index, name) => {
                        if (this.layerManager) this.layerManager.renameLayer(index, name);
                    }
                });
            }
        }

        /**
         * アクティブツールボタン設定
         */
        setActiveToolButton(activeButton) {
            // 全ツールボタンから active クラスを削除
            document.querySelectorAll('.tool-button').forEach(btn => {
                btn.classList.remove('active');
            });
            
            // アクティブボタンに active クラスを追加
            if (activeButton) {
                activeButton.classList.add('active');
            }
        }

        /**
         * リサイズ処理設定
         */
        setupResize() {
            window.addEventListener('resize', () => {
                const screenWidth = window.innerWidth - 50;
                const screenHeight = window.innerHeight;
                
                this.pixiApp.renderer.resize(screenWidth, screenHeight);
                
                // カメラシステムにサイズ変更を通知
                if (this.cameraSystem && this.cameraSystem.updateCamera) {
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
    
    console.log('✅ core-engine.js loaded (Phase2 integrated - fixed)');
})();