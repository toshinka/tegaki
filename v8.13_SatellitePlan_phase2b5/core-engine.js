// ===== core-engine.js - 修正版（元版機能完全継承） =====
// 元版のcore-engine.jsから完全な機能を継承し、分割版の問題を解決

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

    // === クリップボード管理システム（元版から完全継承） ===
    class ClipboardSystem {
        constructor() {
            this.clipboardData = null;
            this.setupKeyboardEvents();
        }

        setupKeyboardEvents() {
            document.addEventListener('keydown', (e) => {
                if (e.ctrlKey && e.code === 'KeyC' && !e.altKey && !e.metaKey) {
                    this.copyActiveLayer();
                    e.preventDefault();
                }
                
                if (e.ctrlKey && e.code === 'KeyV' && !e.altKey && !e.metaKey) {
                    this.pasteLayer();
                    e.preventDefault();
                }
            });
        }

        copyActiveLayer() {
            const layerManager = this.layerManager;
            if (!layerManager) return;

            const activeLayer = layerManager.getActiveLayer();
            if (!activeLayer) return;

            try {
                const layerId = activeLayer.layerData.id;
                const currentTransform = layerManager.layerTransforms?.get(layerId);
                
                let pathsToStore = [];
                
                if (activeLayer.layerData.paths && activeLayer.layerData.paths.length > 0) {
                    pathsToStore = activeLayer.layerData.paths;
                }
                
                this.clipboardData = {
                    layerData: {
                        name: activeLayer.layerData.name + '_copy',
                        visible: activeLayer.layerData.visible,
                        opacity: activeLayer.layerData.opacity,
                        paths: this.deepCopyPaths(pathsToStore),
                        isBackground: activeLayer.layerData.isBackground,
                        backgroundData: activeLayer.layerData.isBackground ? {
                            color: CONFIG.background.color
                        } : null
                    },
                    transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
                    metadata: {
                        originalId: layerId,
                        copiedAt: Date.now(),
                        pathCount: pathsToStore.length
                    }
                };

                console.log(`Layer copied: ${pathsToStore.length} paths preserved`);
                
            } catch (error) {
                console.error('Failed to copy layer:', error);
            }
        }

        deepCopyPaths(paths) {
            return (paths || []).map(path => ({
                id: `path_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                points: (path.points || []).map(point => ({ x: point.x, y: point.y })),
                color: path.color,
                size: path.size,
                opacity: path.opacity,
                isComplete: path.isComplete || true
            }));
        }

        pasteLayer() {
            const layerManager = this.layerManager;
            if (!layerManager || !this.clipboardData) return;

            try {
                const clipData = this.clipboardData;
                const layerName = this.generateUniqueLayerName(clipData.layerData.name, layerManager);

                const { layer } = layerManager.createLayer(layerName, clipData.layerData.isBackground || false);

                if (clipData.layerData.backgroundData) {
                    const bg = new PIXI.Graphics();
                    bg.rect(0, 0, CONFIG.canvas.width, CONFIG.canvas.height);
                    bg.fill(clipData.layerData.backgroundData.color);
                    layer.addChild(bg);
                    layer.layerData.backgroundGraphics = bg;
                }

                clipData.layerData.paths.forEach(pathData => {
                    if (pathData.points && pathData.points.length > 0) {
                        const newPath = {
                            id: pathData.id,
                            points: [...pathData.points],
                            color: pathData.color,
                            size: pathData.size,
                            opacity: pathData.opacity,
                            isComplete: true,
                            graphics: null
                        };
                        
                        // Graphics再生成
                        newPath.graphics = new PIXI.Graphics();
                        newPath.points.forEach(point => {
                            newPath.graphics.circle(point.x, point.y, newPath.size / 2);
                            newPath.graphics.fill({ color: newPath.color, alpha: newPath.opacity });
                        });
                        
                        layer.layerData.paths.push(newPath);
                        layer.addChild(newPath.graphics);
                    }
                });

                layerManager.setActiveLayer(layerManager.layers.indexOf(layer));
                layerManager.updateLayerPanelUI();
                layerManager.updateStatusDisplay();

                console.log(`Layer pasted: ${clipData.layerData.paths.length} paths restored`);
                
            } catch (error) {
                console.error('Failed to paste layer:', error);
            }
        }

        generateUniqueLayerName(baseName, layerManager) {
            let name = baseName;
            let counter = 1;
            
            while (layerManager.layers.some(layer => layer.layerData.name === name)) {
                name = `${baseName}_${counter}`;
                counter++;
            }
            
            return name;
        }
        
        setLayerManager(layerManager) {
            this.layerManager = layerManager;
        }
    }

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

    // === 統合CoreEngineクラス（元版から完全継承 + EventBus統合） ===
    class CoreEngine {
        constructor(app) {
            this.app = app;
            
            // EventBus初期化（Phase1指示）
            this.eventBus = new EventBus();
            
            // 分割されたシステムを統合（依存関係チェック付き）
            this.coordinateSystem = this.initializeCoordinateSystem(app);
            this.cameraSystem = this.initializeCameraSystem(app);
            this.layerManager = this.initializeLayerSystem(app);
            this.drawingEngine = this.initializeDrawingSystem(app);
            this.clipboardSystem = new ClipboardSystem();
            
            this.setupCrossReferences();
            this.setupEventBus();
        }

        initializeCoordinateSystem(app) {
            if (window.CoordinateSystem) {
                return new window.CoordinateSystem(app);
            } else {
                console.warn('CoordinateSystem not found, using fallback');
                return this.createFallbackCoordinateSystem(app);
            }
        }

        createFallbackCoordinateSystem(app) {
            return {
                screenToWorld: (screenPoint) => {
                    const canvas = app.view;
                    const rect = canvas.getBoundingClientRect();
                    const localX = (screenPoint.x - rect.left) * (canvas.width / rect.width);
                    const localY = (screenPoint.y - rect.top) * (canvas.height / rect.height);
                    return { x: localX, y: localY };
                },
                worldToScreen: (worldPoint) => {
                    return worldPoint; // 簡易実装
                }
            };
        }

        initializeCameraSystem(app) {
            if (window.CameraSystem) {
                return new window.CameraSystem(app, this.coordinateSystem);
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

            return {
                worldContainer,
                canvasContainer,
                screenToWorld: (screenX, screenY) => {
                    return { x: screenX, y: screenY };
                },
                screenToCanvasForDrawing: (screenX, screenY) => {
                    const rect = app.canvas.getBoundingClientRect();
                    const x = screenX - rect.left;
                    const y = screenY - rect.top;
                    return canvasContainer.toLocal({ x, y });
                },
                isPointInExtendedCanvas: (point) => {
                    return point.x >= -50 && point.x <= CONFIG.canvas.width + 50 &&
                           point.y >= -50 && point.y <= CONFIG.canvas.height + 50;
                },
                updateCoordinates: (x, y) => {
                    const element = document.getElementById('coordinates');
                    if (element) {
                        element.textContent = `x: ${Math.round(x)}, y: ${Math.round(y)}`;
                    }
                },
                setVKeyPressed: () => {},
                switchTool: () => {},
                resizeCanvas: (width, height) => {},
                showGuideLines: () => {},
                hideGuideLines: () => {},
                setLayerManager: () => {},
                setDrawingEngine: () => {}
            };
        }

        initializeLayerSystem(app) {
            if (window.LayerSystem) {
                return new window.LayerSystem(app, this.coordinateSystem);
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
                
                updateLayerPanelUI: () => {},
                updateStatusDisplay: () => {},
                requestThumbnailUpdate: () => {},
                processThumbnailUpdates: () => {}
            };
        }

        initializeDrawingSystem(app) {
            if (window.DrawingSystem) {
                return new window.DrawingSystem(app, this.coordinateSystem);
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
            
            this.clipboardSystem.setLayerManager(this.layerManager);
        }

        setupEventBus() {
            // ポインターイベントをEventBus経由で配信
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
        
        getClipboardSystem() {
            return this.clipboardSystem;
        }

        getEventBus() {
            return this.eventBus;
        }
        
        // === Phase1指示対応：統合されたイベント処理 ===
        setupCanvasEvents() {
            console.log('Setting up canvas events with EventBus...');
            
            // ポインター入力をEventBus経由で配信
            this.app.canvas.addEventListener('pointerdown', (e) => {
                const rect = this.app.canvas.getBoundingClientRect();
                const screenPoint = { x: e.clientX, y: e.clientY };
                const localPoint = { x: e.clientX - rect.left, y: e.clientY - rect.top };
                
                // Phase1指示：screenToWorld変換を確実に実行
                let worldPoint = localPoint;
                if (this.cameraSystem.screenToWorld) {
                    worldPoint = this.cameraSystem.screenToWorld(screenPoint.x, screenPoint.y);
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
                    worldPoint = this.cameraSystem.screenToWorld(screenPoint.x, screenPoint.y);
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
                    worldPoint = this.cameraSystem.screenToWorld(screenPoint.x, screenPoint.y);
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
            
            console.log('✅ CoreEngine initialized successfully with full inheritance');
            return this;
        }
    }

    // === グローバル公開 ===
    window.TegakiCore = {
        CoreEngine: CoreEngine,
        ClipboardSystem: ClipboardSystem,
        EventBus: EventBus
    };

    console.log('✅ Fixed core-engine.js loaded - Full feature inheritance from original version');

})();