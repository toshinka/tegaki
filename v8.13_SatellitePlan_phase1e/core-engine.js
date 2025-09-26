// ===== core-engine.js - 統合エンジン司令塔（分割後） =====
// 各システムをまとめて初期化・接続する「司令塔」
// PixiJS v8.13 対応

(function() {
    'use strict';
    
    // グローバル設定を取得
    const CONFIG = window.TEGAKI_CONFIG;
    
    // EventBus実装
    class EventBus {
        constructor() {
            this.events = new Map();
        }
        
        on(event, callback) {
            if (!this.events.has(event)) {
                this.events.set(event, []);
            }
            this.events.get(event).push(callback);
        }
        
        off(event, callback) {
            if (this.events.has(event)) {
                const callbacks = this.events.get(event);
                const index = callbacks.indexOf(callback);
                if (index > -1) {
                    callbacks.splice(index, 1);
                }
            }
        }
        
        emit(event, data) {
            if (this.events.has(event)) {
                this.events.get(event).forEach(callback => {
                    try {
                        callback(data);
                    } catch (error) {
                        console.error(`Error in event handler for ${event}:`, error);
                    }
                });
            }
        }
    }

    // === 描画エンジン（軽量版） ===
    class DrawingEngine {
        constructor() {
            this.cameraSystem = null;
            this.layerSystem = null;
            this.currentTool = 'pen';
            this.brushSize = CONFIG.pen.size;
            this.brushColor = CONFIG.pen.color;
            this.brushOpacity = CONFIG.pen.opacity;
            this.isDrawing = false;
            this.currentPath = null;
            this.lastPoint = null;
        }

        init(cameraSystem, layerSystem) {
            this.cameraSystem = cameraSystem;
            this.layerSystem = layerSystem;
        }

        startDrawing(screenX, screenY) {
            if (this.isDrawing || this.cameraSystem.spacePressed || this.cameraSystem.isDragging || 
                this.layerSystem.vKeyPressed) return;

            const canvasPoint = this.cameraSystem.screenToCanvasForDrawing(screenX, screenY);
            
            if (!this.cameraSystem.isPointInExtendedCanvas(canvasPoint)) {
                return;
            }
            
            this.isDrawing = true;
            this.lastPoint = canvasPoint;

            const activeLayer = this.layerSystem.getActiveLayer();
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

            this._addPathToActiveLayer(this.currentPath);
        }

        continueDrawing(screenX, screenY) {
            if (!this.isDrawing || !this.currentPath || this.cameraSystem.spacePressed || 
                this.cameraSystem.isDragging || this.layerSystem.vKeyPressed) return;

            const canvasPoint = this.cameraSystem.screenToCanvasForDrawing(screenX, screenY);
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
                this.layerSystem.requestThumbnailUpdate(this.layerSystem.activeLayerIndex);
            }

            this.isDrawing = false;
            this.currentPath = null;
            this.lastPoint = null;
        }
        
        _addPathToActiveLayer(path) {
            const activeLayer = this.layerSystem.getActiveLayer();
            if (!activeLayer) return;
            
            const layerId = activeLayer.layerData.id;
            const transform = this.layerSystem.layerTransforms.get(layerId);
            
            // レイヤーがtransformされている場合、逆変換を適用
            if (transform && (transform.x !== 0 || transform.y !== 0 || 
                transform.rotation !== 0 || Math.abs(transform.scaleX) !== 1 || Math.abs(transform.scaleY) !== 1)) {
                
                // 逆変換行列を作成
                const matrix = new PIXI.Matrix();
                
                const centerX = CONFIG.canvas.width / 2;
                const centerY = CONFIG.canvas.height / 2;
                
                matrix.translate(-centerX - transform.x, -centerY - transform.y);
                matrix.rotate(-transform.rotation);
                matrix.scale(1/transform.scaleX, 1/transform.scaleY);
                matrix.translate(centerX, centerY);
                
                // パスの座標を逆変換
                const transformedGraphics = new PIXI.Graphics();
                path.points.forEach((point, index) => {
                    const transformedPoint = matrix.apply(point);
                    transformedGraphics.circle(transformedPoint.x, transformedPoint.y, path.size / 2);
                    transformedGraphics.fill({ color: path.color, alpha: path.opacity });
                });
                
                path.graphics = transformedGraphics;
            }
            
            activeLayer.layerData.paths.push(path);
            activeLayer.addChild(path.graphics);
        }

        setTool(tool) {
            this.currentTool = tool;
        }

        setBrushSize(size) {
            this.brushSize = Math.max(0.1, Math.min(100, size));
        }

        setBrushOpacity(opacity) {
            this.brushOpacity = Math.max(0, Math.min(1, opacity));
        }
    }

    // === 統合コアエンジンクラス（司令塔版） ===
    class CoreEngine {
        constructor(app) {
            this.app = app;
            
            // EventBus作成
            this.eventBus = new EventBus();
            
            // システム初期化（順序重要）
            this.cameraSystem = new window.TegakiCameraSystem();
            this.layerSystem = new window.TegakiLayerSystem();
            this.drawingEngine = new DrawingEngine();
            this.drawingClipboard = new window.TegakiDrawingClipboard();
            
            // 初期化が完了してから相互参照を設定
            this._initializeSystems();
            this._setupCrossReferences();
        }
        
        _initializeSystems() {
            // 各System初期化（EventBusと設定を渡す）
            this.cameraSystem.init(this.app.stage, this.eventBus, CONFIG);
            this.layerSystem.init(this.cameraSystem.canvasContainer, this.app, this.eventBus, CONFIG);
            this.drawingEngine.init(this.cameraSystem, this.layerSystem);
            this.drawingClipboard.init(this.eventBus, CONFIG);
        }
        
        _setupCrossReferences() {
            // 相互参照を設定
            this.cameraSystem.setLayerManager(this.layerSystem);
            this.cameraSystem.setDrawingEngine(this.drawingEngine);
            this.layerSystem.setCameraSystem(this.cameraSystem);
            this.drawingClipboard.setLayerManager(this.layerSystem);
            
            // UI連携イベントのバインド
            this._bindUIEvents();
        }
        
        _bindUIEvents() {
            // ツール切り替えイベント
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
        
        // === 公開API（main.jsから使用） ===
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
            return this.drawingClipboard;
        }
        
        getEventBus() {
            return this.eventBus;
        }
        
        // === 統合インタラクション処理 ===
        setupCanvasEvents() {
            this.app.canvas.addEventListener('pointerdown', (e) => {
                if (e.button !== 0) return;

                const rect = this.app.canvas.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;

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
            
            // Pointer up は CameraSystem で処理される
        }
        
        switchTool(tool) {
            this.drawingEngine.setTool(tool);
            this.cameraSystem.updateCursor();
            
            // レイヤー移動モードを終了
            if (this.layerSystem.isLayerMoveMode) {
                this.layerSystem.exitLayerMoveMode();
            }
            
            // UI更新
            document.querySelectorAll('.tool-button').forEach(btn => btn.classList.remove('active'));
            const toolBtn = document.getElementById(tool + '-tool');
            if (toolBtn) toolBtn.classList.add('active');

            const toolNames = { pen: 'ベクターペン', eraser: '消しゴム' };
            const toolElement = document.getElementById('current-tool');
            if (toolElement) {
                toolElement.textContent = toolNames[tool] || tool;
            }
            
            this.eventBus.emit('tool:changed', { tool });
        }
        
        updateCoordinates(x, y) {
            this.cameraSystem.updateCoordinates(x, y);
        }
        
        // サムネイル更新処理
        processThumbnailUpdates() {
            this.layerSystem.processThumbnailUpdates();
        }
        
        // キャンバスリサイズ統合処理
        resizeCanvas(newWidth, newHeight) {
            console.log('CoreEngine: Canvas resize request received:', newWidth, 'x', newHeight);
            
            // CONFIG更新
            CONFIG.canvas.width = newWidth;
            CONFIG.canvas.height = newHeight;
            
            // CameraSystemの更新
            this.cameraSystem.resizeCanvas(newWidth, newHeight);
            
            // LayerSystemの背景レイヤー更新
            this.layerSystem.resizeLayers(newWidth, newHeight);
            
            console.log('CoreEngine: Canvas resize completed');
            this.eventBus.emit('canvas:resized', { width: newWidth, height: newHeight });
        }
        
        // 初期化処理
        initialize() {
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
            
            // キャンバスイベント設定
            this.setupCanvasEvents();
            
            // サムネイル更新ループ
            this.app.ticker.add(() => {
                this.processThumbnailUpdates();
            });
            
            console.log('✅ CoreEngine initialized successfully');
            console.log('Systems:', {
                cameraSystem: !!this.cameraSystem,
                layerSystem: !!this.layerSystem,
                drawingEngine: !!this.drawingEngine,
                drawingClipboard: !!this.drawingClipboard
            });
            
            return this;
        }
    }

    // === グローバル公開 ===
    window.TegakiCore = {
        CoreEngine: CoreEngine,
        EventBus: EventBus,
        
        // 個別システムへの参照も提供
        CameraSystem: () => window.TegakiCameraSystem,
        LayerSystem: () => window.TegakiLayerSystem,
        DrawingClipboard: () => window.TegakiDrawingClipboard
    };

})();