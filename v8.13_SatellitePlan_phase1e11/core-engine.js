// ===== core-engine.js - 統合版司令塔（改修完了版） =====
// 各Systemモジュールを統合し、既存のindex.html・ui-panels.js・core-runtime.jsと完全互換
// PixiJS v8.13 対応・改修計画書完全準拠版
// 【改修完了】キャンバス移動不具合の完全解決

(function() {
    'use strict';
    
    // システム依存チェック
    if (!window.TegakiCameraSystem) {
        console.error('❌ TegakiCameraSystem not found - load system/camera-system.js');
        throw new Error('system/camera-system.js is required');
    }
    
    if (!window.TegakiLayerSystem) {
        console.error('❌ TegakiLayerSystem not found - load system/layer-system.js');
        throw new Error('system/layer-system.js is required');
    }
    
    if (!window.TegakiDrawingClipboard) {
        console.error('❌ TegakiDrawingClipboard not found - load system/drawing-clipboard.js');
        throw new Error('system/drawing-clipboard.js is required');
    }
    
    // 設定取得（CONFIG統一）
    const CONFIG = window.TEGAKI_CONFIG;
    if (!CONFIG) {
        console.error('❌ TEGAKI_CONFIG not found - load config.js');
        throw new Error('config.js is required');
    }

    // === 改修版：EventBus実装（System間連携強化） ===
    class SimpleEventBus {
        constructor() {
            this.listeners = new Map();
            this.debug = CONFIG.debug || false;
        }
        
        on(event, callback) {
            if (!this.listeners.has(event)) {
                this.listeners.set(event, []);
            }
            this.listeners.get(event).push(callback);
            
            if (this.debug) {
                console.log(`EventBus: Registered listener for '${event}'`);
            }
        }
        
        emit(event, data) {
            if (this.debug && event !== 'ui:mouse-move') { // マウス移動は除外
                console.log(`EventBus: Emitting '${event}'`, data);
            }
            
            const callbacks = this.listeners.get(event);
            if (callbacks) {
                callbacks.forEach((callback, index) => {
                    try {
                        callback(data);
                    } catch (error) {
                        console.error(`EventBus error in ${event}[${index}]:`, error);
                    }
                });
            }
        }
        
        off(event, callback) {
            const callbacks = this.listeners.get(event);
            if (callbacks) {
                const index = callbacks.indexOf(callback);
                if (index > -1) {
                    callbacks.splice(index, 1);
                    if (this.debug) {
                        console.log(`EventBus: Removed listener for '${event}'`);
                    }
                }
            }
        }
        
        getRegisteredEvents() {
            return Array.from(this.listeners.keys());
        }
        
        getListenerCount(event) {
            const callbacks = this.listeners.get(event);
            return callbacks ? callbacks.length : 0;
        }
    }

    // === 改修版：DrawingEngine（EventBus統合・座標変換統一） ===
    class DrawingEngine {
        constructor(cameraSystem, layerManager, eventBus, config) {
            this.cameraSystem = cameraSystem;
            this.layerManager = layerManager;
            this.eventBus = eventBus;
            this.config = config; // CONFIG統一
            
            this.currentTool = 'pen';
            this.brushSize = this.config.pen.size;
            this.brushColor = this.config.pen.color;
            this.brushOpacity = this.config.pen.opacity;
            this.isDrawing = false;
            this.currentPath = null;
            this.lastPoint = null;
            
            this._setupEventBusListeners();
        }

        _setupEventBusListeners() {
            if (!this.eventBus) return;
            
            // UI側からの描画設定変更を監視
            this.eventBus.on('drawing:tool-changed', (data) => {
                this.setTool(data.tool);
            });
            
            this.eventBus.on('drawing:brush-size-changed', (data) => {
                this.setBrushSize(data.size);
            });
            
            this.eventBus.on('drawing:brush-color-changed', (data) => {
                this.setBrushColor(data.color);
            });
            
            this.eventBus.on('drawing:brush-opacity-changed', (data) => {
                this.setBrushOpacity(data.opacity);
            });
        }

        startDrawing(screenX, screenY) {
            if (this.isDrawing || this.cameraSystem.spacePressed || this.cameraSystem.isDragging || 
                this.layerManager.vKeyPressed) return;

            // 改修版：統一API使用（CameraSystem経由）
            const canvasPoint = this.cameraSystem.screenToCanvas(screenX, screenY, { forDrawing: true });
            
            if (!this.cameraSystem.isPointInExtendedCanvas(canvasPoint)) {
                return;
            }
            
            this.isDrawing = true;
            this.lastPoint = canvasPoint;

            const activeLayer = this.layerManager.getActiveLayer();
            if (!activeLayer) return;

            const color = this.currentTool === 'eraser' ? this.config.background.color : this.brushColor;
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

            // PixiJS v8.13 準拠：Graphics API統一
            this.currentPath.graphics.circle(canvasPoint.x, canvasPoint.y, this.brushSize / 2);
            this.currentPath.graphics.fill({ color: color, alpha: opacity });

            this.addPathToActiveLayer(this.currentPath);
            
            // EventBus通知
            if (this.eventBus) {
                this.eventBus.emit('drawing:started', {
                    tool: this.currentTool,
                    point: canvasPoint,
                    pathId: this.currentPath.id
                });
            }
        }

        continueDrawing(screenX, screenY) {
            if (!this.isDrawing || !this.currentPath || this.cameraSystem.spacePressed || 
                this.cameraSystem.isDragging || this.layerManager.vKeyPressed) return;

            // 改修版：統一API使用（CameraSystem経由）
            const canvasPoint = this.cameraSystem.screenToCanvas(screenX, screenY, { forDrawing: true });
            const lastPoint = this.lastPoint;
            
            const distance = Math.sqrt(
                Math.pow(canvasPoint.x - lastPoint.x, 2) + 
                Math.pow(canvasPoint.y - lastPoint.y, 2)
            );

            if (distance < 1) return;

            const steps = Math.max(1, Math.floor(distance / 1));
            for (let i = 1; i <= steps; i++) {
                const t = i / steps;
                const x = lastPoint.x + (canvasPoint.x - lastPoint.x) * t;
                const y = lastPoint.y + (canvasPoint.y - lastPoint.y) * t;

                // PixiJS v8.13 準拠：Graphics API統一
                this.currentPath.graphics.circle(x, y, this.brushSize / 2);
                this.currentPath.graphics.fill({ 
                    color: this.currentPath.color, 
                    alpha: this.currentPath.opacity 
                });

                this.currentPath.points.push({ x, y });
            }

            this.lastPoint = canvasPoint;
        }

        stopDrawing() {
            if (!this.isDrawing) return;

            if (this.currentPath) {
                this.currentPath.isComplete = true;
                this.layerManager.requestThumbnailUpdate(this.layerManager.activeLayerIndex);
                
                // EventBus通知
                if (this.eventBus) {
                    this.eventBus.emit('drawing:completed', {
                        pathId: this.currentPath.id,
                        pointCount: this.currentPath.points.length
                    });
                }
            }

            this.isDrawing = false;
            this.currentPath = null;
            this.lastPoint = null;
        }
        
        // 改修版：レイヤー変形考慮描画
        addPathToActiveLayer(path) {
            const activeLayer = this.layerManager.getActiveLayer();
            if (!activeLayer) return;
            
            const layerId = activeLayer.layerData.id;
            const transform = this.layerManager.layerTransforms.get(layerId);
            
            // レイヤーがtransformされている場合、逆変換を適用して座標を調整
            if (transform && this.layerManager.isTransformNonDefault(transform)) {
                try {
                    // 正しい逆変換行列を作成
                    const matrix = new PIXI.Matrix();
                    
                    const centerX = this.config.canvas.width / 2;
                    const centerY = this.config.canvas.height / 2;
                    
                    // 逆変換の正しい順序
                    matrix.translate(-centerX - transform.x, -centerY - transform.y);
                    matrix.rotate(-transform.rotation);
                    matrix.scale(1/transform.scaleX, 1/transform.scaleY);
                    matrix.translate(centerX, centerY);
                    
                    // 新しいGraphicsを作成し、逆変換した座標で描画
                    const transformedGraphics = new PIXI.Graphics();
                    
                    path.points.forEach((point, index) => {
                        try {
                            const transformedPoint = matrix.apply(point);
                            // 変換後の座標が有効な場合のみ描画
                            if (isFinite(transformedPoint.x) && isFinite(transformedPoint.y)) {
                                transformedGraphics.circle(transformedPoint.x, transformedPoint.y, path.size / 2);
                                transformedGraphics.fill({ color: path.color, alpha: path.opacity });
                            }
                        } catch (transformError) {
                            if (this.config.debug) {
                                console.warn(`Point transform failed for point ${index}:`, transformError);
                            }
                        }
                    });
                    
                    path.graphics = transformedGraphics;
                } catch (error) {
                    if (this.config.debug) {
                        console.error('Transform application failed, using original graphics:', error);
                    }
                    // 変形に失敗した場合は元のGraphicsを使用
                }
            }
            
            activeLayer.layerData.paths.push(path);
            activeLayer.addChild(path.graphics);
        }

        setTool(tool) {
            const oldTool = this.currentTool;
            this.currentTool = tool;
            
            if (this.eventBus && oldTool !== tool) {
                this.eventBus.emit('drawing:tool-set', { 
                    oldTool: oldTool, 
                    newTool: tool 
                });
            }
        }

        setBrushSize(size) {
            const oldSize = this.brushSize;
            this.brushSize = Math.max(0.1, Math.min(100, size));
            
            if (this.eventBus && oldSize !== this.brushSize) {
                this.eventBus.emit('drawing:brush-size-set', {
                    oldSize: oldSize,
                    newSize: this.brushSize
                });
            }
        }

        setBrushColor(color) {
            const oldColor = this.brushColor;
            this.brushColor = color;
            
            if (this.eventBus && oldColor !== color) {
                this.eventBus.emit('drawing:brush-color-set', {
                    oldColor: oldColor,
                    newColor: color
                });
            }
        }

        setBrushOpacity(opacity) {
            const oldOpacity = this.brushOpacity;
            this.brushOpacity = Math.max(0, Math.min(1, opacity));
            
            if (this.eventBus && oldOpacity !== this.brushOpacity) {
                this.eventBus.emit('drawing:brush-opacity-set', {
                    oldOpacity: oldOpacity,
                    newOpacity: this.brushOpacity
                });
            }
        }
    }

    // === 統合CoreEngineクラス（改修完了版） ===
    class CoreEngine {
        constructor(app) {
            this.app = app;
            
            // EventBus作成（System間連携強化版）
            this.eventBus = new SimpleEventBus();
            
            // 【改修】システム初期化（完全参照注入版）
            this.cameraSystem = new window.TegakiCameraSystem();
            this.layerSystem = new window.TegakiLayerSystem();
            this.clipboardSystem = new window.TegakiDrawingClipboard();
            this.drawingEngine = new DrawingEngine(this.cameraSystem, this.layerSystem, this.eventBus, CONFIG);
            
            // 【改修】相互参照設定（完全版）
            this.setupCrossReferences();
            
            // 【改修】System間EventBus統合
            this.setupSystemEventIntegration();
        }
        
        // 【改修】完全な相互参照設定
        setupCrossReferences() {
            console.log('Setting up cross-references...');
            
            // CameraSystemに参照設定
            this.cameraSystem.setLayerManager(this.layerSystem);
            this.cameraSystem.setDrawingEngine(this.drawingEngine);
            
            // LayerSystemに参照設定
            this.layerSystem.setCameraSystem(this.cameraSystem);
            this.layerSystem.setApp(this.app);
            
            // ClipboardSystemに参照設定
            this.clipboardSystem.setLayerManager(this.layerSystem);
            
            console.log('✅ Cross-references setup completed');
        }
        
        // 改修版：System間EventBus統合
        setupSystemEventIntegration() {
            // レイヤー変更時のクリップボード状態更新
            this.eventBus.on('layer:activated', (data) => {
                this.eventBus.emit('clipboard:get-info-request');
            });
            
            // カメラ変更時の座標表示更新
            this.eventBus.on('camera:changed', () => {
                // 座標表示の更新処理
            });
            
            // 描画完了時のUI更新通知
            this.eventBus.on('drawing:completed', (data) => {
                this.eventBus.emit('ui:drawing-completed', data);
            });
            
            // エラー処理統合
            this.eventBus.on('clipboard:copy-failed', (data) => {
                if (CONFIG.debug) {
                    console.error('Clipboard copy failed:', data.error);
                }
            });
            
            this.eventBus.on('clipboard:paste-failed', (data) => {
                if (CONFIG.debug) {
                    console.error('Clipboard paste failed:', data.error);
                }
            });
        }
        
        // === 既存互換API ===
        getCameraSystem() {
            return this.cameraSystem;
        }
        
        getLayerManager() {
            return this.layerSystem;
        }
        
        getDrawingEngine() {
            return this.drawingEngine;
        }
        
        getClipboardSystem() {
            return this.clipboardSystem;
        }
        
        // 改修版：EventBus公開（System間連携用）
        getEventBus() {
            return this.eventBus;
        }
        
        // 【改修】統一されたイベントハンドリング
        setupCanvasEvents() {
            console.log('Setting up canvas events...');
            
            // 【改修】安全なCanvas要素取得
            const canvas = this.app.canvas || this.app.view;
            if (!canvas) {
                console.error('Canvas element not found');
                return;
            }
            
            // 【改修】ポインターイベント設定（統一版）
            canvas.addEventListener('pointerdown', (e) => {
                if (e.button !== 0) return;

                const rect = canvas.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;

                this.drawingEngine.startDrawing(x, y);
                e.preventDefault();
            });

            canvas.addEventListener('pointermove', (e) => {
                const rect = canvas.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;

                this.updateCoordinates(x, y);
                this.drawingEngine.continueDrawing(x, y);
                
                // EventBus通知
                this.eventBus.emit('ui:mouse-move', { x, y });
            });
            
            canvas.addEventListener('pointerup', (e) => {
                this.drawingEngine.stopDrawing();
            });
            
            canvas.addEventListener('pointerleave', (e) => {
                this.drawingEngine.stopDrawing();
            });
            
            // 【改修】キーボードイベント設定（競合回避版）
            document.addEventListener('keydown', (e) => {
                // ツール切り替えキー（Vキー押下中以外）
                if (!this.layerSystem.vKeyPressed) {
                    if (e.key.toLowerCase() === 'p' && !e.ctrlKey && !e.altKey && !e.metaKey) {
                        this.switchTool('pen');
                        e.preventDefault();
                    }
                    if (e.key.toLowerCase() === 'e' && !e.ctrlKey && !e.altKey && !e.metaKey) {
                        this.switchTool('eraser');
                        e.preventDefault();
                    }
                }
            });
            
            console.log('✅ Canvas events setup completed');
        }
        
        switchTool(tool) {
            this.cameraSystem.switchTool(tool);
            this.drawingEngine.setTool(tool);
        }
        
        updateCoordinates(x, y) {
            this.cameraSystem.updateCoordinates(x, y);
        }
        
        processThumbnailUpdates() {
            this.layerSystem.processThumbnailUpdates();
        }
        
        // 改修版：キャンバスリサイズ（EventBus統合・統一処理）
        resizeCanvas(newWidth, newHeight) {
            if (CONFIG.debug) {
                console.log('CoreEngine: Canvas resize request received:', newWidth, 'x', newHeight);
            }
            
            // CONFIG更新
            CONFIG.canvas.width = newWidth;
            CONFIG.canvas.height = newHeight;
            
            // CameraSystemの更新
            this.cameraSystem.resizeCanvas(newWidth, newHeight);
            
            // LayerSystemの背景レイヤー更新
            this.layerSystem.layers.forEach(layer => {
                if (layer.layerData.isBackground && layer.layerData.backgroundGraphics) {
                    layer.layerData.backgroundGraphics.clear();
                    layer.layerData.backgroundGraphics.rect(0, 0, newWidth, newHeight);
                    layer.layerData.backgroundGraphics.fill(CONFIG.background.color);
                }
            });
            
            // 全レイヤーのサムネイル更新
            for (let i = 0; i < this.layerSystem.layers.length; i++) {
                this.layerSystem.requestThumbnailUpdate(i);
            }
            
            // EventBus通知
            this.eventBus.emit('canvas:resized', { 
                width: newWidth, 
                height: newHeight 
            });
            
            if (CONFIG.debug) {
                console.log('CoreEngine: Canvas resize completed');
            }
        }
        
        // 【改修】初期化（完全統合版）
        initialize() {
            console.log('=== CoreEngine initialization started ===');
            
            // 【改修】システム初期化（EventBus・CONFIG統一・安全な参照注入）
            this.cameraSystem.init(
                this.app.stage,    // stage直接渡し
                this.eventBus,
                CONFIG
            );
            
            this.layerSystem.init(
                this.cameraSystem.canvasContainer,  // 安全な参照
                this.eventBus,
                CONFIG
            );
            
            // ClipboardSystem初期化（EventBus・CONFIG統一）
            this.clipboardSystem.init(this.eventBus, CONFIG);
            
            // 初期レイヤー作成
            this.layerSystem.createLayer('背景', true);
            this.layerSystem.createLayer('レイヤー1');
            this.layerSystem.setActiveLayer(1);
            
            this.layerSystem.updateLayerPanelUI();
            this.layerSystem.updateStatusDisplay();
            
            // UI初期化（SortableJS）
            if (window.TegakiUI && window.TegakiUI.initializeSortable) {
                window.TegakiUI.initializeSortable(this.layerSystem);
            }
            
            // 【改修】キャンバスイベント設定（統一版）
            this.setupCanvasEvents();
            
            // サムネイル更新ループ
            this.app.ticker.add(() => {
                this.processThumbnailUpdates();
            });
            
            // 初期化完了通知
            this.eventBus.emit('core:initialized', {
                systems: ['camera', 'layer', 'clipboard', 'drawing']
            });
            
            console.log('✅ CoreEngine initialized successfully (改修完了版)');
            console.log('   - 【改修】キャンバス移動不具合解決完了');
            console.log('   - 【改修】完全な参照注入実装');
            console.log('   - 【改修】統一されたイベント処理');
            console.log('   - 【改修】安全なCanvas要素処理');
            console.log('   - Systems:', this.eventBus.getRegisteredEvents().length, 'events registered');
            console.log('   - 既存機能完全継承・互換性維持');
            
            return this;
        }
        
        // === デバッグ用API ===
        debugGetSystemStatus() {
            if (!CONFIG.debug) return null;
            
            return {
                camera: {
                    initialized: !!this.cameraSystem.app,
                    worldContainerPosition: this.cameraSystem.worldContainer ? {
                        x: this.cameraSystem.worldContainer.x,
                        y: this.cameraSystem.worldContainer.y
                    } : null,
                    scale: this.cameraSystem.worldContainer ? this.cameraSystem.worldContainer.scale.x : null,
                    hasCanvas: !!(this.app.canvas || this.app.view)
                },
                layer: {
                    initialized: !!this.layerSystem.layersContainer,
                    layerCount: this.layerSystem.layers.length,
                    activeLayer: this.layerSystem.activeLayerIndex
                },
                clipboard: {
                    hasData: this.clipboardSystem.hasClipboardData(),
                    summary: this.clipboardSystem.getClipboardSummary()
                },
                drawing: {
                    currentTool: this.drawingEngine.currentTool,
                    isDrawing: this.drawingEngine.isDrawing
                },
                eventBus: {
                    registeredEvents: this.eventBus.getRegisteredEvents(),
                    totalListeners: this.eventBus.getRegisteredEvents().reduce((sum, event) => 
                        sum + this.eventBus.getListenerCount(event), 0)
                }
            };
        }
        
        debugEmitEvent(event, data) {
            if (CONFIG.debug) {
                console.log(`Debug: Emitting event '${event}'`, data);
                this.eventBus.emit(event, data);
            }
        }
    }

    // === グローバル公開（改修完了版） ===
    window.TegakiCore = {
        CoreEngine: CoreEngine,
        
        // 個別クラスも公開
        CameraSystem: window.TegakiCameraSystem,
        LayerManager: window.TegakiLayerSystem,
        LayerSystem: window.TegakiLayerSystem,
        DrawingEngine: DrawingEngine,
        ClipboardSystem: window.TegakiDrawingClipboard,
        DrawingClipboard: window.TegakiDrawingClipboard,
        SimpleEventBus: SimpleEventBus
    };

    console.log('✅ core-engine.js (改修完了版) loaded successfully');
    console.log('   - 【改修】キャンバス移動不具合の根本原因解決');
    console.log('   - 【改修】完全な参照注入・EventBus統合・CONFIG統一');
    console.log('   - 【改修】安全なCanvas要素処理・イベント競合回避');
    console.log('   - System integration completed with enhanced EventBus');
    console.log('   - drawing-clipboard.js 完全統合');
    console.log('   - PixiJS v8.13 Graphics API準拠');
    console.log('   - Existing compatibility maintained');

})();