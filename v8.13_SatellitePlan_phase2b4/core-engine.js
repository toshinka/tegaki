// ===== core-engine.js - 緊急修正版（描画機能復旧） =====
// 分割されたエンジンファイルを統合してCoreEngineクラスを提供

(function() {
    'use strict';
    
    // 依存関係チェック
    const requiredGlobals = [
        'TEGAKI_CONFIG',
        'CoordinateSystem', 
        'CameraSystem',
        'LayerSystem', 
        'DrawingSystem'
    ];
    
    const missingDeps = requiredGlobals.filter(dep => !window[dep]);
    if (missingDeps.length > 0) {
        console.error('CRITICAL: Missing dependencies for core-engine.js:', missingDeps);
        throw new Error(`core-engine.js requires: ${missingDeps.join(', ')}`);
    }
    
    const CONFIG = window.TEGAKI_CONFIG;
    
    // === クリップボードシステム（統合版） ===
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
                const layerId = activeLayer.id;
                const currentTransform = layerManager.layerTransforms?.get(layerId);
                
                let pathsToStore = [];
                
                // ストロークデータをパスデータに変換
                if (activeLayer.strokes && activeLayer.strokes.length > 0) {
                    pathsToStore = activeLayer.strokes.map(stroke => ({
                        id: stroke.id,
                        points: stroke.points || [],
                        color: stroke.color,
                        size: stroke.size,
                        opacity: stroke.opacity,
                        isComplete: stroke.isComplete
                    }));
                }
                
                this.clipboardData = {
                    layerData: {
                        name: activeLayer.name + '_copy',
                        visible: activeLayer.visible,
                        opacity: activeLayer.opacity,
                        paths: this.deepCopyPaths(pathsToStore)
                    },
                    transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
                    metadata: {
                        originalId: layerId,
                        copiedAt: Date.now(),
                        pathCount: pathsToStore.length
                    }
                };

                console.log(`Layer copied: ${pathsToStore.length} strokes preserved`);
                
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

                const { layer } = layerManager.createLayer(layerName, false);

                clipData.layerData.paths.forEach(pathData => {
                    if (pathData.points && pathData.points.length > 0) {
                        const newStroke = {
                            id: pathData.id,
                            points: [...pathData.points],
                            color: pathData.color,
                            size: pathData.size,
                            opacity: pathData.opacity,
                            isComplete: true
                        };
                        
                        layerManager.addStrokeToLayer(layer.id, newStroke);
                    }
                });

                layerManager.setActiveLayer(layer.id);

                console.log(`Layer pasted: ${clipData.layerData.paths.length} strokes restored`);
                
            } catch (error) {
                console.error('Failed to paste layer:', error);
            }
        }

        generateUniqueLayerName(baseName, layerManager) {
            let name = baseName;
            let counter = 1;
            
            const layers = layerManager.getAllLayers ? layerManager.getAllLayers() : [];
            while (layers.some(layer => layer.name === name)) {
                name = `${baseName}_${counter}`;
                counter++;
            }
            
            return name;
        }
        
        setLayerManager(layerManager) {
            this.layerManager = layerManager;
        }
    }

    // === 統合CoreEngineクラス（緊急修正版） ===
    class CoreEngine {
        constructor(app) {
            this.app = app;
            
            // 座標システム初期化
            this.coordinateSystem = new window.CoordinateSystem(app);
            
            // 分割されたシステムを統合
            this.cameraSystem = new window.CameraSystem(app, this.coordinateSystem);
            this.layerManager = new window.LayerSystem(app, this.coordinateSystem);
            this.drawingEngine = new window.DrawingSystem(app, this.coordinateSystem);
            this.clipboardSystem = new ClipboardSystem();
            
            this.setupCrossReferences();
        }
        
        setupCrossReferences() {
            // LayerSystemにコンテナ設定
            this.layerManager.setLayersContainer(this.cameraSystem.canvasContainer);
            
            // 相互参照を設定
            if (this.cameraSystem.setLayerManager) {
                this.cameraSystem.setLayerManager(this.layerManager);
            }
            if (this.cameraSystem.setDrawingEngine) {
                this.cameraSystem.setDrawingEngine(this.drawingEngine);
            }
            
            // DrawingSystemにシステム参照設定
            if (this.drawingEngine.setLayerSystem) {
                this.drawingEngine.setLayerSystem(this.layerManager);
            }
            if (this.drawingEngine.setCameraSystem) {
                this.drawingEngine.setCameraSystem(this.cameraSystem);
            }
            
            this.clipboardSystem.setLayerManager(this.layerManager);
        }
        
        // 公開API
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
        
        // 【緊急修正】統合インタラクション処理 - 描画機能修正
        setupCanvasEvents() {
            console.log('Setting up canvas events...');
            
            this.app.canvas.addEventListener('pointerdown', (e) => {
                if (e.button !== 0) return;

                const rect = this.app.canvas.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;

                console.log('Pointer down:', x, y);
                this.drawingEngine.startDrawing(x, y);
                e.preventDefault();
            });

            this.app.canvas.addEventListener('pointermove', (e) => {
                const rect = this.app.canvas.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;

                this.updateCoordinates(x, y);
                this.drawingEngine.continueDrawing(x, y);
            });
            
            this.app.canvas.addEventListener('pointerup', (e) => {
                if (e.button === 0) {
                    console.log('Pointer up - ending drawing');
                    this.drawingEngine.endDrawing();
                }
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
            
            console.log('Canvas events setup completed');
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
                const allLayers = this.layerManager.getAllLayers ? this.layerManager.getAllLayers() : [];
                allLayers.forEach(layer => {
                    if (layer.isBackground && layer.backgroundGraphics) {
                        layer.backgroundGraphics.clear();
                        layer.backgroundGraphics.rect(0, 0, newWidth, newHeight);
                        layer.backgroundGraphics.fill(CONFIG.background.color);
                    }
                });
                
                // 全レイヤーのサムネイル更新
                allLayers.forEach((layer, index) => {
                    if (this.layerManager.requestThumbnailUpdate) {
                        this.layerManager.requestThumbnailUpdate(index);
                    }
                });
            }
            
            console.log('CoreEngine: Canvas resize completed');
        }
        
        // 初期化処理
        initialize() {
            console.log('Initializing CoreEngine...');
            
            // 初期レイヤー作成
            const backgroundResult = this.layerManager.createLayer('背景', true);
            const layerResult = this.layerManager.createLayer('レイヤー1');
            
            if (layerResult && layerResult.layer) {
                this.layerManager.setActiveLayer(layerResult.layer.id);
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
            
            // キャンバスイベント設定
            this.setupCanvasEvents();
            
            // サムネイル更新ループ
            this.app.ticker.add(() => {
                this.processThumbnailUpdates();
            });
            
            console.log('✅ CoreEngine initialized successfully');
            return this;
        }
    }

    // === グローバル公開 ===
    window.TegakiCore = {
        CoreEngine: CoreEngine,
        ClipboardSystem: ClipboardSystem
    };

    console.log('✅ core-engine.js Emergency Fix loaded');

})();