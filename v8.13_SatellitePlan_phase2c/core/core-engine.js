/**
 * Core Engine (Phase2 Fixed) - 修正版
 * PixiJS v8.13 対応版
 * 主要修正：PixiJS v8.13 API対応、依存関係修正、初期化フロー改善
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
         * 依存関係チェック（修正版：実際のグローバル構造に対応）
         */
        checkDependencies() {
            const required = [
                { path: 'window.TEGAKI_CONFIG', name: 'TEGAKI_CONFIG', critical: true },
                { path: 'window.CoordinateSystem', name: 'CoordinateSystem', critical: true },
                { path: 'window.TegakiRuntime', name: 'TegakiRuntime', critical: false },
                { path: 'window.TegakiCameraSystem', name: 'CameraSystem', critical: false },
                { path: 'window.TegakiLayerSystem', name: 'LayerManager', critical: false },
                { path: 'window.TegakiDrawingClipboard', name: 'DrawingClipboardSystem', critical: false }
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
                console.warn('   Some features may be limited or use fallback implementations');
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
         * 初期化（修正版：v8.13対応）
         */
        async initialize() {
            try {
                console.log('🚀 CoreEngine initialization started');
                
                // 依存関係チェック
                this.checkDependencies();
                
                // PixiJS Application初期化（v8.13対応）
                await this.initializePixiApp();
                
                // 分離システム初期化
                await this.initializeSeparatedSystems();
                
                // システム連携設定
                this.setupCrossReferences();
                
                // UI連携
                this.setupUIIntegration();
                
                // 初期レイヤー作成
                this.createInitialLayers();
                
                // キャンバスイベント設定
                this.setupCanvasEvents();
                
                // サムネイル更新ループ開始
                this.startThumbnailUpdateLoop();
                
                this.isInitialized = true;
                console.log('✅ CoreEngine initialization completed');
                
                return this;
                
            } catch (error) {
                this.initializationError = error;
                console.error('❌ CoreEngine initialization failed:', error);
                throw error;
            }
        }

        /**
         * PixiJS App初期化（修正版：v8.13非同期初期化完全対応）
         */
        async initializePixiApp() {
            console.log('📦 Initializing PixiJS Application...');
            
            const screenWidth = window.innerWidth - 50; // サイドバー分を除く
            const screenHeight = window.innerHeight;
            
            // PixiJS v8.13では非同期初期化が必須
            this.pixiApp = new PIXI.Application();
            
            await this.pixiApp.init({
                width: screenWidth,
                height: screenHeight,
                backgroundAlpha: 0,
                resolution: window.devicePixelRatio || 1,
                antialias: true
            });
            
            // ✅ v8.13では canvas プロパティを使用（view は廃止）
            const canvas = this.pixiApp.canvas;
            canvas.style.display = 'block';
            canvas.style.position = 'absolute';
            canvas.style.top = '0';
            canvas.style.left = '0';
            
            // キャンバス要素への追加（既存要素を置換）
            if (this.canvasElement && this.canvasElement.parentNode) {
                this.canvasElement.parentNode.replaceChild(canvas, this.canvasElement);
                this.canvasElement = canvas; // 参照を更新
            } else {
                document.body.appendChild(canvas);
                this.canvasElement = canvas;
            }
            
            // ワールドコンテナ作成
            this.worldContainer = new PIXI.Container();
            this.worldContainer.label = 'worldContainer';
            this.worldContainer.eventMode = 'static';
            this.pixiApp.stage.addChild(this.worldContainer);
            
            // ✅ 後方互換性確保（v7系コード対応）
            this.pixiApp.view = this.pixiApp.canvas;
            
            // リサイズ処理設定
            this.setupResize();
            
            console.log('✅ PixiJS Application initialized (v8.13 async)');
        }

        /**
         * 分離システム初期化（修正版：実際のファイル構造対応）
         */
        async initializeSeparatedSystems() {
            console.log('🔧 Initializing separated systems...');
            
            // CameraSystem初期化（修正版：実際のグローバル名）
            if (window.TegakiCameraSystem && window.TegakiCameraSystem.CameraSystem) {
                try {
                    this.cameraSystem = new window.TegakiCameraSystem.CameraSystem(this.pixiApp);
                    console.log('✅ CameraSystem initialized');
                } catch (error) {
                    console.warn('⚠️ CameraSystem initialization failed:', error);
                    // フォールバック：内蔵システムを使用
                    this.cameraSystem = this.createFallbackCameraSystem();
                }
            } else {
                console.warn('⚠️ CameraSystem not available - using fallback');
                this.cameraSystem = this.createFallbackCameraSystem();
            }
            
            // LayerManager初期化（修正版：実際のグローバル名）
            if (window.TegakiLayerSystem && window.TegakiLayerSystem.LayerManager) {
                try {
                    this.layerManager = new window.TegakiLayerSystem.LayerManager(
                        this.cameraSystem.canvasContainer, 
                        this.pixiApp, 
                        this.cameraSystem
                    );
                    console.log('✅ LayerManager initialized');
                } catch (error) {
                    console.warn('⚠️ LayerManager initialization failed:', error);
                    this.layerManager = this.createFallbackLayerManager();
                }
            } else {
                console.warn('⚠️ LayerManager not available - using fallback');
                this.layerManager = this.createFallbackLayerManager();
            }
            
            // DrawingClipboardSystem初期化（修正版：実際のグローバル名）
            if (window.TegakiDrawingClipboard && window.TegakiDrawingClipboard.DrawingClipboardSystem) {
                try {
                    this.drawingClipboardSystem = new window.TegakiDrawingClipboard.DrawingClipboardSystem(
                        this.cameraSystem, 
                        this.layerManager
                    );
                    console.log('✅ DrawingClipboardSystem initialized');
                } catch (error) {
                    console.warn('⚠️ DrawingClipboardSystem initialization failed:', error);
                    this.drawingClipboardSystem = this.createFallbackDrawingSystem();
                }
            } else {
                console.warn('⚠️ DrawingClipboardSystem not available - using fallback');
                this.drawingClipboardSystem = this.createFallbackDrawingSystem();
            }
            
            console.log('✅ Separated systems initialization completed');
        }

        /**
         * フォールバック：内蔵CameraSystem
         */
        createFallbackCameraSystem() {
            console.log('Creating fallback CameraSystem...');
            
            const fallbackCamera = {
                worldContainer: this.worldContainer,
                canvasContainer: new PIXI.Container(),
                
                // 基本的なカメラ機能を提供
                screenToCanvasForDrawing(screenX, screenY) {
                    const rect = this.pixiApp.canvas.getBoundingClientRect();
                    const x = screenX - rect.left;
                    const y = screenY - rect.top;
                    return this.canvasContainer.toLocal({ x, y });
                },
                
                setVKeyPressed() {},
                switchTool() {},
                updateCoordinates() {},
                showGuideLines() {},
                hideGuideLines() {}
            };
            
            this.worldContainer.addChild(fallbackCamera.canvasContainer);
            fallbackCamera.canvasContainer.label = 'canvasContainer';
            
            return fallbackCamera;
        }

        /**
         * フォールバック：内蔵LayerManager
         */
        createFallbackLayerManager() {
            console.log('Creating fallback LayerManager...');
            
            return {
                layers: [],
                activeLayerIndex: 0,
                layersContainer: new PIXI.Container(),
                layerTransforms: new Map(),
                
                createLayer(name, isBackground = false) {
                    const layer = new PIXI.Container();
                    layer.label = `layer_${this.layers.length}`;
                    layer.layerData = {
                        id: layer.label,
                        name: name,
                        visible: true,
                        opacity: 1.0,
                        isBackground: isBackground,
                        paths: []
                    };
                    
                    this.layers.push(layer);
                    this.layersContainer.addChild(layer);
                    
                    return { layer, index: this.layers.length - 1 };
                },
                
                setActiveLayer(index) {
                    this.activeLayerIndex = Math.max(0, Math.min(index, this.layers.length - 1));
                },
                
                getActiveLayer() {
                    return this.layers[this.activeLayerIndex] || null;
                },
                
                updateLayerPanelUI() {},
                updateStatusDisplay() {},
                requestThumbnailUpdate() {},
                processThumbnailUpdates() {},
                enterLayerMoveMode() {},
                exitLayerMoveMode() {}
            };
        }

        /**
         * フォールバック：内蔵DrawingEngine
         */
        createFallbackDrawingSystem() {
            console.log('Creating fallback DrawingEngine...');
            
            return {
                currentTool: 'pen',
                isDrawing: false,
                
                startDrawing(screenX, screenY) {
                    console.log('Fallback drawing start:', screenX, screenY);
                },
                
                continueDrawing(screenX, screenY) {},
                
                stopDrawing() {
                    this.isDrawing = false;
                },
                
                setDrawingTool(tool) {
                    this.currentTool = tool;
                },
                
                getDrawingEngine() {
                    return this;
                }
            };
        }

        /**
         * システム間連携設定（修正版）
         */
        setupCrossReferences() {
            console.log('🔗 Setting up cross-references...');
            
            // CoordinateSystemに安全な参照を設定
            if (window.CoordinateSystem && typeof window.CoordinateSystem.setContainers === 'function') {
                try {
                    // canvasContainerがある場合は渡す
                    const canvasContainer = this.cameraSystem.canvasContainer || null;
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
            
            // LayerManagerにCameraSystemを設定
            if (this.layerManager && this.layerManager.setCameraSystem) {
                this.layerManager.setCameraSystem(this.cameraSystem);
            }
            
            console.log('✅ Cross-references established');
        }

        /**
         * UI統合設定（修正版）
         */
        setupUIIntegration() {
            console.log('🎨 Setting up UI integration...');
            
            // ツールパネル統合
            this.setupToolPanel();
            
            // レイヤーパネル統合
            this.setupLayerPanel();
            
            // キャンバスリサイズ統合
            this.setupCanvasResize();
            
            console.log('✅ UI integration completed');
        }

        /**
         * ツールパネル設定（修正版）
         */
        setupToolPanel() {
            // ペンツール
            const penTool = document.getElementById('pen-tool');
            if (penTool) {
                penTool.addEventListener('click', () => {
                    if (this.drawingClipboardSystem && this.drawingClipboardSystem.setDrawingTool) {
                        this.drawingClipboardSystem.setDrawingTool('pen');
                    }
                    this.setActiveToolButton(penTool);
                });
            }
            
            // 消しゴムツール
            const eraserTool = document.getElementById('eraser-tool');
            if (eraserTool) {
                eraserTool.addEventListener('click', () => {
                    if (this.drawingClipboardSystem && this.drawingClipboardSystem.setDrawingTool) {
                        this.drawingClipboardSystem.setDrawingTool('eraser');
                    }
                    this.setActiveToolButton(eraserTool);
                });
            }
            
            // リサイズツール
            const resizeTool = document.getElementById('resize-tool');
            if (resizeTool) {
                resizeTool.addEventListener('click', () => {
                    const resizePanel = document.getElementById('resize-settings');
                    if (resizePanel) {
                        resizePanel.classList.toggle('show');
                    }
                });
            }
        }

        /**
         * レイヤーパネル設定（修正版）
         */
        setupLayerPanel() {
            // レイヤー追加ボタン
            const addLayerBtn = document.getElementById('add-layer-btn');
            if (addLayerBtn) {
                addLayerBtn.addEventListener('click', () => {
                    if (this.layerManager && this.layerManager.createLayer) {
                        const layerName = `レイヤー${this.layerManager.layers.length}`;
                        const { layer, index } = this.layerManager.createLayer(layerName);
                        this.layerManager.setActiveLayer(index);
                        this.layerManager.updateLayerPanelUI();
                        this.layerManager.updateStatusDisplay();
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
         * キャンバスリサイズ統合設定
         */
        setupCanvasResize() {
            const applyResizeBtn = document.getElementById('apply-resize');
            const canvasWidthInput = document.getElementById('canvas-width');
            const canvasHeightInput = document.getElementById('canvas-height');
            
            if (applyResizeBtn && canvasWidthInput && canvasHeightInput) {
                applyResizeBtn.addEventListener('click', () => {
                    const newWidth = parseInt(canvasWidthInput.value, 10);
                    const newHeight = parseInt(canvasHeightInput.value, 10);
                    
                    if (newWidth > 0 && newHeight > 0) {
                        this.resizeCanvas(newWidth, newHeight);
                        
                        // パネルを非表示
                        const resizePanel = document.getElementById('resize-settings');
                        if (resizePanel) {
                            resizePanel.classList.remove('show');
                        }
                    }
                });
            }
        }

        /**
         * 初期レイヤー作成
         */
        createInitialLayers() {
            if (this.layerManager) {
                // 背景レイヤー作成
                this.layerManager.createLayer('背景', true);
                
                // 描画レイヤー作成
                this.layerManager.createLayer('レイヤー1');
                this.layerManager.setActiveLayer(1);
                
                // UI更新
                this.layerManager.updateLayerPanelUI();
                this.layerManager.updateStatusDisplay();
                
                console.log('✅ Initial layers created');
            }
        }

        /**
         * キャンバスイベント設定
         */
        setupCanvasEvents() {
            if (!this.pixiApp.canvas) return;
            
            this.pixiApp.canvas.addEventListener('pointerdown', (e) => {
                if (e.button !== 0) return;

                const rect = this.pixiApp.canvas.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;

                if (this.drawingClipboardSystem && this.drawingClipboardSystem.startDrawing) {
                    this.drawingClipboardSystem.startDrawing(x, y);
                }
                e.preventDefault();
            });

            this.pixiApp.canvas.addEventListener('pointermove', (e) => {
                const rect = this.pixiApp.canvas.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;

                // 座標表示更新
                if (this.cameraSystem && this.cameraSystem.updateCoordinates) {
                    this.cameraSystem.updateCoordinates(x, y);
                }
                
                // 描画継続
                if (this.drawingClipboardSystem && this.drawingClipboardSystem.continueDrawing) {
                    this.drawingClipboardSystem.continueDrawing(x, y);
                }
            });
            
            this.pixiApp.canvas.addEventListener('pointerup', (e) => {
                if (e.button !== 0) return;
                
                if (this.drawingClipboardSystem && this.drawingClipboardSystem.stopDrawing) {
                    this.drawingClipboardSystem.stopDrawing();
                }
            });
            
            // ツール切り替えキー
            document.addEventListener('keydown', (e) => {
                if (e.code === 'KeyP' && !e.ctrlKey && !e.altKey && !e.metaKey) {
                    this.switchTool('pen');
                    e.preventDefault();
                }
                if (e.code === 'KeyE' && !e.ctrlKey && !e.altKey && !e.metaKey) {
                    this.switchTool('eraser');
                    e.preventDefault();
                }
            });
            
            console.log('✅ Canvas events setup completed');
        }

        /**
         * サムネイル更新ループ開始
         */
        startThumbnailUpdateLoop() {
            if (this.pixiApp && this.layerManager) {
                this.pixiApp.ticker.add(() => {
                    if (this.layerManager.processThumbnailUpdates) {
                        this.layerManager.processThumbnailUpdates();
                    }
                });
                console.log('✅ Thumbnail update loop started');
            }
        }

        /**
         * ツール切り替え
         */
        switchTool(tool) {
            if (this.cameraSystem && this.cameraSystem.switchTool) {
                this.cameraSystem.switchTool(tool);
            } else {
                // フォールバック処理
                this.setActiveToolButton(document.getElementById(tool + '-tool'));
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
         * キャンバスリサイズ統合処理
         */
        resizeCanvas(newWidth, newHeight) {
            console.log('CoreEngine: Canvas resize request received:', newWidth, 'x', newHeight);
            
            try {
                // CONFIG更新
                if (window.TEGAKI_CONFIG) {
                    window.TEGAKI_CONFIG.canvas.width = newWidth;
                    window.TEGAKI_CONFIG.canvas.height = newHeight;
                }
                
                // CameraSystemの更新
                if (this.cameraSystem && this.cameraSystem.resizeCanvas) {
                    this.cameraSystem.resizeCanvas(newWidth, newHeight);
                }
                
                // LayerManagerの背景レイヤー更新
                if (this.layerManager && this.layerManager.layers) {
                    this.layerManager.layers.forEach(layer => {
                        if (layer.layerData && layer.layerData.isBackground && layer.layerData.backgroundGraphics) {
                            layer.layerData.backgroundGraphics.clear();
                            layer.layerData.backgroundGraphics.rect(0, 0, newWidth, newHeight);
                            layer.layerData.backgroundGraphics.fill(window.TEGAKI_CONFIG?.background?.color || 0xf0e0d6);
                        }
                    });
                    
                    // 全レイヤーのサムネイル更新
                    for (let i = 0; i < this.layerManager.layers.length; i++) {
                        this.layerManager.requestThumbnailUpdate(i);
                    }
                }
                
                // キャンバス情報表示更新
                const canvasInfo = document.getElementById('canvas-info');
                if (canvasInfo) {
                    canvasInfo.textContent = `${newWidth}×${newHeight}px`;
                }
                
                console.log('✅ CoreEngine: Canvas resize completed');
                return true;
                
            } catch (error) {
                console.error('❌ CoreEngine: Canvas resize failed:', error);
                return false;
            }
        }

        /**
         * ビューポートリサイズ（ブラウザリサイズ対応）
         */
        resizeViewport(newWidth, newHeight) {
            if (this.pixiApp && this.pixiApp.renderer) {
                this.pixiApp.renderer.resize(newWidth, newHeight);
                
                // カメラシステムにサイズ変更を通知
                if (this.cameraSystem && this.cameraSystem.updateCamera) {
                    this.cameraSystem.updateCamera();
                }
                
                console.log('✅ Viewport resized:', newWidth, 'x', newHeight);
            }
        }

        /**
         * リサイズ処理設定
         */
        setupResize() {
            window.addEventListener('resize', () => {
                const screenWidth = window.innerWidth - 50;
                const screenHeight = window.innerHeight;
                
                this.resizeViewport(screenWidth, screenHeight);
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
                layerCount: this.layerManager?.layers?.length || 0,
                cameraInfo: this.cameraSystem?.getCameraInfo ? this.cameraSystem.getCameraInfo() : null
            };
        }

        /**
         * 破棄処理
         */
        destroy() {
            console.log('🗑️ CoreEngine destruction started');
            
            // 分離システム破棄
            if (this.drawingClipboardSystem && this.drawingClipboardSystem.destroy) {
                this.drawingClipboardSystem.destroy();
                this.drawingClipboardSystem = null;
            }
            
            if (this.layerManager && this.layerManager.destroy) {
                this.layerManager.destroy();
                this.layerManager = null;
            }
            
            if (this.cameraSystem && this.cameraSystem.destroy) {
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
    
    console.log('✅ core-engine.js loaded (Phase2 fixed - v8.13 compatible)');
})();