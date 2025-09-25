// ===== core-engine.js - 改修版：システム分割対応 =====
// Phase 2対応版：3つのシステムファイルとの統合を管理
// 既存機能を100%維持しながらアーキテクチャを分散化

(function() {
    'use strict';
    
    // === Phase 1: グローバル登録システム（TegakiSystems） ===
    window.TegakiSystems = window.TegakiSystems || {
        _registry: {},
        _pending: [],
        
        Register: function(name, impl) {
            this._registry[name] = impl;
            console.log(`TegakiSystems: Registered ${name}`);
            if (this._onRegister) this._onRegister(name, impl);
        },
        
        get: function(name) { 
            return this._registry[name]; 
        },
        
        waitFor: function(names, callback) {
            const check = () => {
                const missing = names.filter(n => !this._registry[n]);
                if (missing.length === 0) {
                    callback();
                } else {
                    console.log(`TegakiSystems: Waiting for ${missing.join(', ')}`);
                    setTimeout(check, 10);
                }
            };
            check();
        }
    };

    // === Phase 1: 動的システムファイル読み込み ===
    function loadSystemFiles(callback) {
        const scripts = [
            'systems/camera-system.js',
            'systems/layer-system.js', 
            'systems/drawing-clipboard.js'
        ];
        
        let loaded = 0;
        const errors = [];
        
        console.log('TegakiSystems: Loading system files...');
        
        scripts.forEach(src => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = () => {
                loaded++;
                console.log(`TegakiSystems: Loaded ${src} (${loaded}/${scripts.length})`);
                if (loaded === scripts.length) {
                    if (errors.length > 0) {
                        console.error('TegakiSystems: Some scripts failed to load:', errors);
                    } else {
                        console.log('TegakiSystems: All system files loaded successfully');
                    }
                    callback(errors.length === 0);
                }
            };
            script.onerror = (error) => {
                console.error(`TegakiSystems: Failed to load ${src}:`, error);
                errors.push(src);
                loaded++;
                if (loaded === scripts.length) {
                    callback(false);
                }
            };
            document.head.appendChild(script);
        });
    }

    // === EventBus統一実装 ===
    window.Tegaki = window.Tegaki || {};
    window.Tegaki.EventBus = (function(){
        const handlers = {};
        return {
            on: function(evt, fn) { 
                (handlers[evt] || (handlers[evt] = [])).push(fn); 
            },
            off: function(evt, fn) { 
                if (!handlers[evt]) return; 
                handlers[evt] = handlers[evt].filter(f => f !== fn); 
            },
            emit: function(evt, data) { 
                (handlers[evt] || []).slice().forEach(f => { 
                    try { 
                        f(data); 
                    } catch(e) { 
                        console.warn('EventBus error:', e); 
                    } 
                }); 
            }
        };
    })();

    // === 座標変換API統一 ===
    window.Tegaki.Coords = {
        screenToWorld: function(screenPoint) {
            const cameraSystem = window.TegakiSystems.get('CameraSystem');
            if (cameraSystem) {
                return cameraSystem.screenToWorld(screenPoint);
            }
            console.warn('CameraSystem not available for screenToWorld');
            return { x: 0, y: 0 };
        },
        
        worldToScreen: function(worldPoint) {
            const cameraSystem = window.TegakiSystems.get('CameraSystem');
            if (cameraSystem) {
                return cameraSystem.worldToScreen(worldPoint);
            }
            console.warn('CameraSystem not available for worldToScreen');
            return { x: 0, y: 0 };
        },
        
        worldToLocal: function(container, worldPoint) {
            return container.toLocal(worldPoint);
        },
        
        localToWorld: function(container, localPoint) {
            return container.toGlobal(localPoint);
        }
    };

    // === DrawingEngine（描画制御） ===
    class DrawingEngine {
        constructor(cameraSystem, layerSystem) {
            this.cameraSystem = cameraSystem;
            this.layerSystem = layerSystem;
            this.currentTool = 'pen';
            this.brushSize = window.TEGAKI_CONFIG.pen.size;
            this.brushColor = window.TEGAKI_CONFIG.pen.color;
            this.brushOpacity = window.TEGAKI_CONFIG.pen.opacity;
            this.isDrawing = false;
            this.currentPath = null;
            this.lastPoint = null;
        }

        startDrawing(screenX, screenY) {
            if (this.isDrawing || this.cameraSystem.spacePressed || this.cameraSystem.isDragging || 
                this.layerSystem.vKeyPressed) return;

            const canvasPoint = this.cameraSystem.screenToCanvasForDrawing(screenX, screenY);
            
            if (!this.cameraSystem.isPointInExtendedCanvas || 
                !this.cameraSystem.isPointInExtendedCanvas(canvasPoint)) {
                return;
            }
            
            this.isDrawing = true;
            this.lastPoint = canvasPoint;

            const activeLayer = this.layerSystem.getActiveLayer();
            if (!activeLayer) return;

            const color = this.currentTool === 'eraser' ? 
                         window.TEGAKI_CONFIG.background.color : this.brushColor;
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

            this.addPathToActiveLayer(this.currentPath);
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
        
        addPathToActiveLayer(path) {
            const activeLayer = this.layerSystem.getActiveLayer();
            if (!activeLayer) return;
            
            const layerId = activeLayer.layerData.id;
            const transform = this.layerSystem.layerTransforms.get(layerId);
            
            // レイヤーが変形されている場合、逆変換を適用
            if (transform && (transform.x !== 0 || transform.y !== 0 || 
                transform.rotation !== 0 || Math.abs(transform.scaleX) !== 1 || Math.abs(transform.scaleY) !== 1)) {
                
                const matrix = new PIXI.Matrix();
                const centerX = window.TEGAKI_CONFIG.canvas.width / 2;
                const centerY = window.TEGAKI_CONFIG.canvas.height / 2;
                
                matrix.translate(-centerX - transform.x, -centerY - transform.y);
                matrix.rotate(-transform.rotation);
                matrix.scale(1/transform.scaleX, 1/transform.scaleY);
                matrix.translate(centerX, centerY);
                
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

    // === 統合CoreEngine（改修版） ===
    class CoreEngine {
        constructor(app) {
            this.app = app;
            this.CONFIG = window.TEGAKI_CONFIG;
            
            // システム参照（動的に設定される）
            this.cameraSystem = null;
            this.layerSystem = null;
            this.clipboardSystem = null;
            this.drawingEngine = null;
        }

        // === Phase 2: システム統合初期化 ===
        initialize() {
            console.log('CoreEngine: Starting system integration...');
            
            // システムファイル読み込み
            loadSystemFiles((success) => {
                if (!success) {
                    console.error('CoreEngine: System files loading failed');
                    return;
                }
                
                // システム初期化完了を待機
                window.TegakiSystems.waitFor(['CameraSystem', 'LayerSystem', 'ClipboardSystem'], () => {
                    console.log('CoreEngine: All systems ready, initializing...');
                    this.initializeSystems();
                });
            });
        }

        // システム初期化と相互参照設定
        initializeSystems() {
            try {
                // === CameraSystem初期化 ===
                const CameraSystem = window.TegakiSystems.get('CameraSystem');
                CameraSystem.init({
                    app: this.app
                });
                this.cameraSystem = CameraSystem;

                // === LayerSystem初期化 ===  
                const LayerSystem = window.TegakiSystems.get('LayerSystem');
                LayerSystem.init({
                    app: this.app,
                    rootContainer: this.cameraSystem.canvasContainer
                });
                this.layerSystem = LayerSystem;

                // === ClipboardSystem初期化 ===
                const ClipboardSystem = window.TegakiSystems.get('ClipboardSystem');
                ClipboardSystem.init({
                    app: this.app,
                    layerSystem: this.layerSystem
                });
                this.clipboardSystem = ClipboardSystem;

                // === DrawingEngine初期化 ===
                this.drawingEngine = new DrawingEngine(this.cameraSystem, this.layerSystem);

                // === 相互参照設定 ===
                this.setupCrossReferences();

                // === 後方互換API設定 ===
                this.setupBackwardCompatibility();

                // === キャンバスイベント設定 ===
                this.setupCanvasEvents();

                // === 初期レイヤー作成 ===
                this.createInitialLayers();

                // === UI統合 ===
                this.setupUI();

                // === サムネイル更新ループ ===
                this.setupThumbnailUpdates();

                console.log('✅ CoreEngine: System integration completed successfully');
                
            } catch (error) {
                console.error('❌ CoreEngine: System initialization failed:', error);
            }
        }

        // 相互参照設定
        setupCrossReferences() {
            // CameraSystem ← LayerSystem, DrawingEngine
            this.cameraSystem.setLayerSystem(this.layerSystem);
            this.cameraSystem.setDrawingEngine(this.drawingEngine);

            // LayerSystem ← CameraSystem, DrawingEngine  
            this.layerSystem.setCameraSystem(this.cameraSystem);
            this.layerSystem.setDrawingEngine(this.drawingEngine);

            // ClipboardSystem ← CameraSystem, DrawingEngine
            this.clipboardSystem.setCameraSystem(this.cameraSystem);
            this.clipboardSystem.setDrawingEngine(this.drawingEngine);
        }

        // 後方互換API設定（既存コードが動作するように）
        setupBackwardCompatibility() {
            // グローバル参照維持
            window.App = this.app;
            window.Tegaki = window.Tegaki || {};
            window.Tegaki.stage = this.app.stage;
            window.Tegaki.renderer = this.app.renderer;

            // 既存関数ラッパー
            window.panCamera = (x, y) => {
                this.cameraSystem.panTo(x, y);
            };

            window.createLayer = (options) => {
                return this.layerSystem.createLayer(options.name || 'New Layer', options.isBackground || false);
            };

            window.switchTool = (tool) => {
                this.switchTool(tool);
            };

            // キャンバスリサイズ統合
            window.drawingAppResizeCanvas = (newWidth, newHeight) => {
                return this.resizeCanvas(newWidth, newHeight);
            };
        }

        // キャンバスイベント設定
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
        }

        // 初期レイヤー作成
        createInitialLayers() {
            this.layerSystem.createLayer('背景', true);
            this.layerSystem.createLayer('レイヤー1');
            this.layerSystem.setActiveLayer(1);
            
            this.layerSystem.updateLayerPanelUI();
            this.layerSystem.updateStatusDisplay();
        }

        // UI統合
        setupUI() {
            // SortableJS統合
            if (window.TegakiUI && window.TegakiUI.initializeSortable) {
                window.TegakiUI.initializeSortable(this.layerSystem);
            }
        }

        // サムネイル更新ループ
        setupThumbnailUpdates() {
            this.app.ticker.add(() => {
                this.layerSystem.processThumbnailUpdates();
            });
        }

        // === 公開API ===
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
        
        switchTool(tool) {
            this.cameraSystem.switchTool(tool);
        }
        
        updateCoordinates(x, y) {
            this.cameraSystem.updateCoordinates(x, y);
        }
        
        // キャンバスリサイズ統合処理
        resizeCanvas(newWidth, newHeight) {
            console.log('CoreEngine: Canvas resize request:', newWidth, 'x', newHeight);
            
            // CONFIG更新
            this.CONFIG.canvas.width = newWidth;
            this.CONFIG.canvas.height = newHeight;
            
            // 各システムに通知
            this.cameraSystem.resizeCanvas(newWidth, newHeight);
            
            // 背景レイヤー更新
            this.layerSystem.layers.forEach(layer => {
                if (layer.layerData.isBackground && layer.layerData.backgroundGraphics) {
                    layer.layerData.backgroundGraphics.clear();
                    layer.layerData.backgroundGraphics.rect(0, 0, newWidth, newHeight);
                    layer.layerData.backgroundGraphics.fill(this.CONFIG.background.color);
                }
            });
            
            // 全レイヤーのサムネイル更新
            for (let i = 0; i < this.layerSystem.layers.length; i++) {
                this.layerSystem.requestThumbnailUpdate(i);
            }
            
            console.log('CoreEngine: Canvas resize completed');
        }
    }

    // === グローバル公開（既存APIとの互換性維持） ===
    window.TegakiCore = {
        CoreEngine: CoreEngine
    };

})();