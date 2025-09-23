// ===== core-engine.js - 完全修正版（Phase1継承 + 分割版統合） =====
// 元版の機能を100%継承し、分割版の問題を解決する統合エンジン

(function() {
    'use strict';
    
    // グローバル設定を取得
    const CONFIG = window.TEGAKI_CONFIG;
    if (!CONFIG) {
        console.error('CRITICAL: TEGAKI_CONFIG not found');
        throw new Error('TEGAKI_CONFIG is required');
    }
    
    const log = (...args) => {
        if (CONFIG.debug) console.log(...args);
    };

    // === EventBus システム（Phase1指示対応：統合されたイベント処理） ===
    class EventBus {
        constructor() {
            this.listeners = new Map();
        }

        on(event, callback) {
            if (!this.listeners.has(event)) {
                this.listeners.set(event, []);
            }
            this.listeners.get(event).push(callback);
        }

        emit(event, data) {
            if (this.listeners.has(event)) {
                this.listeners.get(event).forEach(callback => {
                    try {
                        callback(data);
                    } catch (error) {
                        console.error('EventBus callback error:', error);
                    }
                });
            }
        }

        off(event, callback) {
            if (this.listeners.has(event)) {
                const callbacks = this.listeners.get(event);
                const index = callbacks.indexOf(callback);
                if (index > -1) {
                    callbacks.splice(index, 1);
                }
            }
        }
    }

    // === 統合CoreEngineクラス（元版から完全継承 + 分割版統合） ===
    class CoreEngine {
        constructor(app) {
            this.app = app;
            
            // EventBus初期化（Phase1指示）
            this.eventBus = new EventBus();
            
            // 分割されたシステムを統合初期化
            this.coordinateSystem = this.initializeCoordinateSystem(app);
            this.cameraSystem = this.initializeCameraSystem(app);
            this.layerManager = this.initializeLayerSystem(app);
            this.drawingEngine = this.initializeDrawingSystem(app);
            
            // 相互参照設定
            this.setupCrossReferences();
            this.setupEventBus();
        }

        // === 修正版：CoordinateSystemの安全な初期化 ===
        initializeCoordinateSystem(app) {
            if (window.CoordinateSystem) {
                try {
                    return new window.CoordinateSystem(app);
                } catch (error) {
                    console.warn('CoordinateSystem initialization failed, using fallback:', error);
                    return this.createFallbackCoordinateSystem(app);
                }
            } else {
                console.warn('CoordinateSystem not found, using fallback');
                return this.createFallbackCoordinateSystem(app);
            }
        }

        createFallbackCoordinateSystem(app) {
            return {
                screenToWorld: (screenPoint) => {
                    const canvas = app.canvas || app.view;
                    const rect = canvas.getBoundingClientRect();
                    const localX = (screenPoint.x - rect.left) * (canvas.width / rect.width);
                    const localY = (screenPoint.y - rect.top) * (canvas.height / rect.height);
                    return { x: localX, y: localY };
                },
                worldToScreen: (worldPoint) => {
                    return worldPoint; // 簡易実装
                },
                validatePoint: (point) => {
                    return point && 
                           typeof point.x === 'number' && 
                           typeof point.y === 'number' && 
                           isFinite(point.x) && 
                           isFinite(point.y);
                }
            };
        }

        // === 修正版：CameraSystemの安全な初期化とAPI統合 ===
        initializeCameraSystem(app) {
            if (window.CameraSystem) {
                try {
                    const cameraSystem = new window.CameraSystem(app, this.coordinateSystem);
                    
                    // Phase1指示対応：必須メソッドの確保
                    if (!cameraSystem.screenToCanvasForDrawing) {
                        cameraSystem.screenToCanvasForDrawing = (screenX, screenY) => {
                            return this.coordinateSystem.screenToWorld({ x: screenX, y: screenY });
                        };
                    }

                    if (!cameraSystem.isPointInExtendedCanvas) {
                        cameraSystem.isPointInExtendedCanvas = (canvasPoint, margin = 50) => {
                            return canvasPoint.x >= -margin && 
                                   canvasPoint.x <= CONFIG.canvas.width + margin &&
                                   canvasPoint.y >= -margin && 
                                   canvasPoint.y <= CONFIG.canvas.height + margin;
                        };
                    }

                    return cameraSystem;
                } catch (error) {
                    console.warn('CameraSystem initialization failed, using fallback:', error);
                    return this.createFallbackCameraSystem(app);
                }
            } else {
                console.warn('CameraSystem not found, using fallback');
                return this.createFallbackCameraSystem(app);
            }
        }

        createFallbackCameraSystem(app) {
            const worldContainer = new PIXI.Container();
            worldContainer.label = 'worldContainer';
            app.stage.addChild(worldContainer);
            
            const canvasContainer = new PIXI.Container();
            canvasContainer.label = 'canvasContainer';
            worldContainer.addChild(canvasContainer);

            // 完全な座標変換実装
            const screenToCanvasForDrawing = (screenX, screenY) => {
                const canvas = app.canvas || app.view;
                const rect = canvas.getBoundingClientRect();
                const localX = screenX - rect.left;
                const localY = screenY - rect.top;
                return canvasContainer.toLocal({ x: localX, y: localY });
            };

            return {
                worldContainer,
                canvasContainer,
                spacePressed: false,
                isDragging: false,
                vKeyPressed: false,
                
                screenToCanvasForDrawing,
                screenToCanvas: screenToCanvasForDrawing,
                screenToWorld: (screenX, screenY) => {
                    return screenToCanvasForDrawing(screenX, screenY);
                },
                
                isPointInExtendedCanvas: (point, margin = 50) => {
                    return point.x >= -margin && point.x <= CONFIG.canvas.width + margin &&
                           point.y >= -margin && point.y <= CONFIG.canvas.height + margin;
                },
                
                updateCoordinates: (x, y) => {
                    const element = document.getElementById('coordinates');
                    if (element) {
                        element.textContent = `x: ${Math.round(x)}, y: ${Math.round(y)}`;
                    }
                },
                
                setVKeyPressed: (pressed) => { this.vKeyPressed = pressed; },
                switchTool: (tool) => {
                    document.querySelectorAll('.tool-button').forEach(btn => btn.classList.remove('active'));
                    const toolBtn = document.getElementById(tool + '-tool');
                    if (toolBtn) toolBtn.classList.add('active');

                    const toolNames = { pen: 'ベクターペン', eraser: '消しゴム' };
                    const toolElement = document.getElementById('current-tool');
                    if (toolElement) {
                        toolElement.textContent = toolNames[tool] || tool;
                    }
                },
                
                resizeCanvas: (width, height) => {
                    CONFIG.canvas.width = width;
                    CONFIG.canvas.height = height;
                },
                
                showGuideLines: () => {},
                hideGuideLines: () => {},
                setLayerManager: () => {},
                setDrawingEngine: () => {}
            };
        }

        // === 修正版：LayerSystemの安全な初期化とAPI統合 ===
        initializeLayerSystem(app) {
            if (window.LayerSystem) {
                try {
                    const layerSystem = new window.LayerSystem(app, this.coordinateSystem);
                    
                    // 必須API確保（元版互換）
                    if (!layerSystem.layerTransforms) {
                        layerSystem.layerTransforms = new Map();
                    }

                    if (!layerSystem.getActiveLayer) {
                        layerSystem.getActiveLayer = function() {
                            return this.activeLayerIndex >= 0 ? this.layers[this.activeLayerIndex] : null;
                        };
                    }

                    if (!layerSystem.setActiveLayer) {
                        layerSystem.setActiveLayer = function(index) {
                            if (index >= 0 && index < this.layers.length) {
                                this.activeLayerIndex = index;
                                this.updateLayerPanelUI();
                                this.updateStatusDisplay();
                            }
                        };
                    }

                    if (!layerSystem.setLayersContainer) {
                        layerSystem.setLayersContainer = function(container) {
                            if (this.layersContainer && container) {
                                container.addChild(this.layersContainer);
                            }
                        };
                    }

                    return layerSystem;
                } catch (error) {
                    console.warn('LayerSystem initialization failed, using fallback:', error);
                    return this.createFallbackLayerSystem(app);
                }
            } else {
                console.warn('LayerSystem not found, using fallback');
                return this.createFallbackLayerSystem(app);
            }
        }

        createFallbackLayerSystem(app) {
            const layersContainer = new PIXI.Container();
            layersContainer.label = 'layersContainer';
            
            return {
                layers: [],
                layersContainer,
                activeLayerIndex: -1,
                layerCounter: 0,
                layerTransforms: new Map(),
                thumbnailUpdateQueue: new Set(),
                vKeyPressed: false,
                isLayerMoveMode: false,
                
                setLayersContainer: (container) => {
                    container.addChild(layersContainer);
                },
                
                createLayer: (name, isBackground = false) => {
                    const layer = new PIXI.Container();
                    const layerId = `layer_${this.layerCounter++}`;
                    
                    layer.label = layerId;
                    layer.layerData = {
                        id: layerId,
                        name: name,
                        visible: true,
                        opacity: 1.0,
                        isBackground: isBackground,
                        paths: []
                    };

                    this.layerTransforms.set(layerId, {
                        x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1
                    });

                    if (isBackground) {
                        const bg = new PIXI.Graphics();
                        bg.rect(0, 0, CONFIG.canvas.width, CONFIG.canvas.height);
                        bg.fill(CONFIG.background.color);
                        layer.addChild(bg);
                        layer.layerData.backgroundGraphics = bg;
                    }

                    this.layers.push(layer);
                    layersContainer.addChild(layer);
                    return { layer, index: this.layers.length - 1 };
                },
                
                getActiveLayer: () => {
                    return this.activeLayerIndex >= 0 ? this.layers[this.activeLayerIndex] : null;
                },
                
                setActiveLayer: (index) => {
                    if (index >= 0 && index < this.layers.length) {
                        this.activeLayerIndex = index;
                        this.updateLayerPanelUI();
                        this.updateStatusDisplay();
                    }
                },
                
                updateLayerPanelUI: () => {
                    if (window.TegakiUI && window.TegakiUI.updateLayerPanelUI) {
                        window.TegakiUI.updateLayerPanelUI(this);
                    }
                },
                
                updateStatusDisplay: () => {
                    const statusElement = document.getElementById('current-layer');
                    if (statusElement && this.activeLayerIndex >= 0) {
                        const layer = this.layers[this.activeLayerIndex];
                        statusElement.textContent = layer.layerData.name;
                    }
                },
                
                requestThumbnailUpdate: (index) => {
                    this.thumbnailUpdateQueue.add(index);
                },
                
                processThumbnailUpdates: () => {
                    if (!app?.renderer || this.thumbnailUpdateQueue.size === 0) return;
                    this.thumbnailUpdateQueue.forEach(layerIndex => {
                        // サムネイル更新処理（簡易版）
                        console.log('Processing thumbnail for layer:', layerIndex);
                    });
                    this.thumbnailUpdateQueue.clear();
                }
            };
        }

        // === 修正版：DrawingSystemの安全な初期化とAPI統合 ===
        initializeDrawingSystem(app) {
            if (window.DrawingSystem) {
                try {
                    const drawingSystem = new window.DrawingSystem(app, this.coordinateSystem);
                    
                    // Phase1指示対応：統一されたAPI確保
                    if (!drawingSystem.startDrawing && drawingSystem.startStroke) {
                        drawingSystem.startDrawing = drawingSystem.startStroke.bind(drawingSystem);
                    }
                    if (!drawingSystem.continueDrawing && drawingSystem.continueStroke) {
                        drawingSystem.continueDrawing = drawingSystem.continueStroke.bind(drawingSystem);
                    }
                    if (!drawingSystem.endDrawing && drawingSystem.endStroke) {
                        drawingSystem.endDrawing = drawingSystem.endStroke.bind(drawingSystem);
                    }
                    if (!drawingSystem.endDrawing && drawingSystem.stopDrawing) {
                        drawingSystem.endDrawing = drawingSystem.stopDrawing.bind(drawingSystem);
                    }

                    return drawingSystem;
                } catch (error) {
                    console.warn('DrawingSystem initialization failed, using fallback:', error);
                    return this.createFallbackDrawingSystem(app);
                }
            } else {
                console.warn('DrawingSystem not found, using fallback');
                return this.createFallbackDrawingSystem(app);
            }
        }

        createFallbackDrawingSystem(app) {
            return {
                currentTool: 'pen',
                isDrawing: false,
                currentPath: null,
                brushSize: CONFIG.pen.size,
                brushColor: CONFIG.pen.color,
                brushOpacity: CONFIG.pen.opacity,
                
                setTool: (tool) => { this.currentTool = tool; },
                setBrushSize: (size) => { this.brushSize = size; },
                setBrushOpacity: (opacity) => { this.brushOpacity = opacity; },
                setLayerSystem: () => {},
                setCameraSystem: () => {},
                
                startDrawing: (screenX, screenY) => {
                    if (this.isDrawing) return;
                    
                    const canvasPoint = this.cameraSystem.screenToCanvasForDrawing(screenX, screenY);
                    if (!this.cameraSystem.isPointInExtendedCanvas(canvasPoint)) return;
                    
                    this.isDrawing = true;
                    const activeLayer = this.layerManager.getActiveLayer();
                    if (!activeLayer) return;

                    const color = this.currentTool === 'eraser' ? CONFIG.background.color : this.brushColor;
                    const opacity = this.currentTool === 'eraser' ? 1.0 : this.brushOpacity;

                    this.currentPath = {
                        id: `path_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                        graphics: new PIXI.Graphics(),
                        points: [{ x: canvasPoint.x, y: canvasPoint.y }],
                        color: color,
                        size: this.brushSize,
                        opacity: opacity,
                        isComplete: false
                    };

                    this.currentPath.graphics.circle(canvasPoint.x, canvasPoint.y, this.brushSize / 2);
                    this.currentPath.graphics.fill({ color: color, alpha: opacity });

                    activeLayer.layerData.paths.push(this.currentPath);
                    activeLayer.addChild(this.currentPath.graphics);
                },
                
                continueDrawing: (screenX, screenY) => {
                    if (!this.isDrawing || !this.currentPath) return;
                    
                    const canvasPoint = this.cameraSystem.screenToCanvasForDrawing(screenX, screenY);
                    const lastPoint = this.currentPath.points[this.currentPath.points.length - 1];
                    
                    const distance = Math.sqrt(
                        Math.pow(canvasPoint.x - lastPoint.x, 2) + 
                        Math.pow(canvasPoint.y - lastPoint.y, 2)
                    );

                    if (distance < 1) return;

                    this.currentPath.graphics.circle(canvasPoint.x, canvasPoint.y, this.brushSize / 2);
                    this.currentPath.graphics.fill({ 
                        color: this.currentPath.color, 
                        alpha: this.currentPath.opacity 
                    });

                    this.currentPath.points.push({ x: canvasPoint.x, y: canvasPoint.y });
                },
                
                endDrawing: () => {
                    if (!this.isDrawing) return;
                    if (this.currentPath) {
                        this.currentPath.isComplete = true;
                        this.layerManager.requestThumbnailUpdate(this.layerManager.activeLayerIndex);
                    }
                    this.isDrawing = false;
                    this.currentPath = null;
                }
            };
        }
        
        setupCrossReferences() {
            // レイヤーシステムにコンテナ設定
            if (this.layerManager.setLayersContainer) {
                this.layerManager.setLayersContainer(this.cameraSystem.canvasContainer);
            }
            
            // 相互参照を設定
            if (this.cameraSystem.setLayerManager) {
                this.cameraSystem.setLayerManager(this.layerManager);
            }
            if (this.cameraSystem.setDrawingEngine) {
                this.cameraSystem.setDrawingEngine(this.drawingEngine);
            }
            
            if (this.drawingEngine.setLayerSystem) {
                this.drawingEngine.setLayerSystem(this.layerManager);
            }
            if (this.drawingEngine.setCameraSystem) {
                this.drawingEngine.setCameraSystem(this.cameraSystem);
            }
        }

        setupEventBus() {
            // Phase1指示対応：EventBus経由でのポインターイベント配信
            this.eventBus.on('pointer.down', (data) => {
                if (data.originalEvent.button !== 0) return;
                this.drawingEngine.startDrawing(data.screen.x, data.screen.y);
            });

            this.eventBus.on('pointer.move', (data) => {
                this.updateCoordinates(data.screen.x, data.screen.y);
                this.drawingEngine.continueDrawing(data.screen.x, data.screen.y);
            });

            this.eventBus.on('pointer.up', (data) => {
                if (data.originalEvent.button === 0) {
                    this.drawingEngine.endDrawing();
                }
            });
        }
        
        // === Phase1指示対応：統合されたイベント処理 ===
        setupCanvasEvents() {
            console.log('Setting up canvas events with EventBus integration...');
            
            // ポインター入力をEventBus経由で配信
            this.app.canvas.addEventListener('pointerdown', (e) => {
                const rect = this.app.canvas.getBoundingClientRect();
                const screenPoint = { x: e.clientX, y: e.clientY };
                const localPoint = { x: e.clientX - rect.left, y: e.clientY - rect.top };
                
                // Phase1指示：screenToWorld変換を確実に実行
                let worldPoint = localPoint;
                if (this.cameraSystem.screenToWorld) {
                    try {
                        worldPoint = this.cameraSystem.screenToWorld(screenPoint.x, screenPoint.y);
                    } catch (error) {
                        console.warn('screenToWorld failed, using fallback:', error);
                        worldPoint = this.coordinateSystem.screenToWorld(screenPoint);
                    }
                }
                
                this.eventBus.emit('pointer.down', {
                    screen: screenPoint,
                    local: localPoint,
                    world: worldPoint,
                    originalEvent: e
                });
                
                e.preventDefault();
            });

            this.app.canvas.addEventListener('pointermove', (e) => {
                const rect = this.app.canvas.getBoundingClientRect();
                const screenPoint = { x: e.clientX, y: e.clientY };
                const localPoint = { x: e.clientX - rect.left, y: e.clientY - rect.top };
                
                let worldPoint = localPoint;
                if (this.cameraSystem.screenToWorld) {
                    try {
                        worldPoint = this.cameraSystem.screenToWorld(screenPoint.x, screenPoint.y);
                    } catch (error) {
                        worldPoint = this.coordinateSystem.screenToWorld(screenPoint);
                    }
                }
                
                this.eventBus.emit('pointer.move', {
                    screen: screenPoint,
                    local: localPoint,
                    world: worldPoint,
                    originalEvent: e
                });
            });
            
            this.app.canvas.addEventListener('pointerup', (e) => {
                const rect = this.app.canvas.getBoundingClientRect();
                const screenPoint = { x: e.clientX, y: e.clientY };
                const localPoint = { x: e.clientX - rect.left, y: e.clientY - rect.top };
                
                let worldPoint = localPoint;
                if (this.cameraSystem.screenToWorld) {
                    try {
                        worldPoint = this.cameraSystem.screenToWorld(screenPoint.x, screenPoint.y);
                    } catch (error) {
                        worldPoint = this.coordinateSystem.screenToWorld(screenPoint);
                    }
                }
                
                this.eventBus.emit('pointer.up', {
                    screen: screenPoint,
                    local: localPoint,  
                    world: worldPoint,
                    originalEvent: e
                });
            });
            
            // ツール切り替えキー
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
            
            console.log('Canvas events setup completed with EventBus integration');
        }
        
        // === 公開API ===
        getCameraSystem() {
            return this.cameraSystem;
        }
        
        getLayerManager() {
            return this.layerManager;
        }
        
        getDrawingEngine() {
            return this.drawingEngine;
        }

        getEventBus() {
            return this.eventBus;
        }
        
        switchTool(tool) {
            if (this.cameraSystem.switchTool) {
                this.cameraSystem.switchTool(tool);
            }
            if (this.drawingEngine.setTool) {
                this.drawingEngine.setTool(tool);
            }
        }
        
        updateCoordinates(x, y) {
            if (this.cameraSystem.updateCoordinates) {
                this.cameraSystem.updateCoordinates(x, y);
            }
        }
        
        // サムネイル更新処理
        processThumbnailUpdates() {
            if (this.layerManager.processThumbnailUpdates) {
                this.layerManager.processThumbnailUpdates();
            }
        }
        
        // キャンバスリサイズ統合処理
        resizeCanvas(newWidth, newHeight) {
            console.log('CoreEngine: Canvas resize request received:', newWidth, 'x', newHeight);
            
            // CONFIG更新
            CONFIG.canvas.width = newWidth;
            CONFIG.canvas.height = newHeight;
            CONFIG.canvas.defaultWidth = newWidth;
            CONFIG.canvas.defaultHeight = newHeight;
            
            // CameraSystemの更新
            if (this.cameraSystem.resizeCanvas) {
                this.cameraSystem.resizeCanvas(newWidth, newHeight);
            }
            
            // LayerManagerの背景レイヤー更新
            if (this.layerManager.layers) {
                this.layerManager.layers.forEach(layer => {
                    if (layer.layerData.isBackground && layer.layerData.backgroundGraphics) {
                        layer.layerData.backgroundGraphics.clear();
                        layer.layerData.backgroundGraphics.rect(0, 0, newWidth, newHeight);
                        layer.layerData.backgroundGraphics.fill(CONFIG.background.color);
                    }
                });
                
                // 全レイヤーのサムネイル更新
                for (let i = 0; i < this.layerManager.layers.length; i++) {
                    if (this.layerManager.requestThumbnailUpdate) {
                        this.layerManager.requestThumbnailUpdate(i);
                    }
                }
            }
            
            console.log('CoreEngine: Canvas resize completed');
        }
        
        // 初期化処理（元版から完全継承）
        initialize() {
            console.log('Initializing CoreEngine with full feature inheritance...');
            
            // 初期レイヤー作成
            const backgroundResult = this.layerManager.createLayer('背景', true);
            const layerResult = this.layerManager.createLayer('レイヤー1');
            
            if (layerResult && layerResult.layer) {
                this.layerManager.setActiveLayer(layerResult.index);
            }
            
            // UI更新
            if (this.layerManager.updateLayerPanelUI) {
                this.layerManager.updateLayerPanelUI();
            }
            if (this.layerManager.updateStatusDisplay) {
                this.layerManager.updateStatusDisplay();
            }
            
            // UI初期化（SortableJS）
            if (window.TegakiUI && window.TegakiUI.initializeSortable) {
                window.TegakiUI.initializeSortable(this.layerManager);
            }
            
            // キャンバスイベント設定（EventBus統合版）
            this.setupCanvasEvents();
            
            // サムネイル更新ループ
            this.app.ticker.add(() => {
                this.processThumbnailUpdates();
            });
            
            console.log('✅ Fixed core-engine.js loaded - Complete integration with fallback systems');

})(); CoreEngine initialized successfully with full inheritance');
            return this;
        }
    }

    // === グローバル公開 ===
    window.TegakiCore = {
        CoreEngine: CoreEngine,
        EventBus: EventBus
    };

    console.log('✅