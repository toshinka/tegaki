// ===== core-engine.js - 改修版：GPT5案準拠・機能完全継承 =====
// phase1b4の機能を分離システムで実現、座標系統一、EventBus疎結合
// PixiJS v8.13準拠・非破壊変形確定・座標変換API厳格化

(function() {
    'use strict';
    
    const CONFIG = window.TEGAKI_CONFIG;
    
    // === グローバルシステム登録機構 ===
    window.TegakiSystems = window.TegakiSystems || {
        _registry: {},
        Register: function(name, impl) {
            this._registry[name] = impl;
            console.log(`✅ TegakiSystems: ${name} registered`);
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
                    console.log(`⏳ TegakiSystems: Waiting for ${missing.join(', ')}`);
                    setTimeout(check, 10);
                }
            };
            check();
        }
    };

    // === EventBus統一実装（GPT5案準拠） ===
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
                if (CONFIG.debug) console.log(`EventBus: ${evt}`, data);
                (handlers[evt] || []).slice().forEach(f => { 
                    try { 
                        f(data); 
                    } catch(e) { 
                        console.warn(`EventBus error in ${evt}:`, e); 
                    } 
                }); 
            }
        };
    })();

    // === 座標変換API統一（GPT5案準拠の厳格実装） ===
    window.Tegaki.Coords = {
        // スクリーン→ワールド変換（input: screen, returns: world）
        screenToWorld: function(screenPoint) {
            const cameraSystem = window.TegakiSystems.get('CameraSystem');
            if (!cameraSystem) {
                console.warn('CameraSystem not available for screenToWorld');
                return { x: screenPoint.x, y: screenPoint.y };
            }
            return cameraSystem.screenToWorld(screenPoint);
        },
        
        // ワールド→キャンバス変換（input: world, returns: canvas）
        worldToCanvas: function(worldPoint) {
            const cameraSystem = window.TegakiSystems.get('CameraSystem');
            if (!cameraSystem) {
                console.warn('CameraSystem not available for worldToCanvas');
                return { x: worldPoint.x, y: worldPoint.y };
            }
            return cameraSystem.worldToCanvas(worldPoint);
        },
        
        // スクリーン→キャンバス変換（input: screen, returns: canvas - canonical coordinates）
        screenToCanvas: function(screenPoint) {
            const worldPoint = this.screenToWorld(screenPoint);
            return this.worldToCanvas(worldPoint);
        },
        
        // キャンバス→ワールド変換（input: canvas, returns: world）
        canvasToWorld: function(canvasPoint) {
            const cameraSystem = window.TegakiSystems.get('CameraSystem');
            if (!cameraSystem) {
                console.warn('CameraSystem not available for canvasToWorld');
                return { x: canvasPoint.x, y: canvasPoint.y };
            }
            return cameraSystem.canvasToWorld(canvasPoint);
        },
        
        // キャンバス→スクリーン変換（input: canvas, returns: screen）
        canvasToScreen: function(canvasPoint) {
            const worldPoint = this.canvasToWorld(canvasPoint);
            const cameraSystem = window.TegakiSystems.get('CameraSystem');
            if (!cameraSystem) {
                return { x: worldPoint.x, y: worldPoint.y };
            }
            return cameraSystem.worldToScreen(worldPoint);
        }
    };

    // === DrawingEngine（改修版：座標系統一・レイヤー変形逆変換対応） ===
    class DrawingEngine {
        constructor(options = {}) {
            this.cameraSystem = options.cameraSystem;
            this.layerSystem = options.layerSystem;
            this.currentTool = 'pen';
            this.brushSize = CONFIG.pen.size;
            this.brushColor = CONFIG.pen.color;
            this.brushOpacity = CONFIG.pen.opacity;
            this.isDrawing = false;
            this.currentPath = null;
            this.lastPoint = null;
            
            // EventBusリスナー設定
            this.setupEventListeners();
        }

        setupEventListeners() {
            // ツール変更時の通知
            window.Tegaki.EventBus.on('tool:changed', (data) => {
                this.setTool(data.tool);
            });
            
            // レイヤー変形確定時のパス調整
            window.Tegaki.EventBus.on('layer:transform:confirmed', (data) => {
                if (this.isDrawing && this.currentPath) {
                    console.log('DrawingEngine: Layer transform confirmed during drawing - adjusting current path');
                    this.adjustCurrentPathForTransform(data.layerId);
                }
            });
        }

        startDrawing(screenX, screenY) {
            if (this.isDrawing || this.cameraSystem?.spacePressed || this.cameraSystem?.isDragging || 
                this.layerSystem?.vKeyPressed) return;

            // GPT5案準拠：canonical座標を取得（input: screen, returns: canvas）
            const canvasPoint = window.Tegaki.Coords.screenToCanvas({ x: screenX, y: screenY });
            
            if (!this.cameraSystem?.isPointInExtendedCanvas(canvasPoint)) {
                return;
            }
            
            this.isDrawing = true;
            this.lastPoint = canvasPoint;

            const activeLayer = this.layerSystem?.getActiveLayer();
            if (!activeLayer) return;

            const color = this.currentTool === 'eraser' ? CONFIG.background.color : this.brushColor;
            const opacity = this.currentTool === 'eraser' ? 1.0 : this.brushOpacity;

            this.currentPath = {
                id: `path_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                graphics: new PIXI.Graphics(),
                points: [{ x: canvasPoint.x, y: canvasPoint.y }], // canonical座標で保存
                color: color,
                size: this.brushSize,
                opacity: opacity,
                isComplete: false
            };

            this.currentPath.graphics.circle(canvasPoint.x, canvasPoint.y, this.brushSize / 2);
            this.currentPath.graphics.fill({ color: color, alpha: opacity });

            // GPT5案準拠：パスをcanonical座標でレイヤーに追加
            this.addPathToActiveLayer(this.currentPath);
            
            // EventBus通知
            window.Tegaki.EventBus.emit('drawing:started', {
                layerId: activeLayer.layerData.id,
                pathId: this.currentPath.id,
                tool: this.currentTool
            });
        }

        continueDrawing(screenX, screenY) {
            if (!this.isDrawing || !this.currentPath || this.cameraSystem?.spacePressed || 
                this.cameraSystem?.isDragging || this.layerSystem?.vKeyPressed) return;

            const canvasPoint = window.Tegaki.Coords.screenToCanvas({ x: screenX, y: screenY });
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

                // GPT5案準拠：パスはcanonical座標で保存
                this.currentPath.points.push({ x, y });
            }

            this.lastPoint = canvasPoint;
        }

        stopDrawing() {
            if (!this.isDrawing) return;

            if (this.currentPath) {
                this.currentPath.isComplete = true;
                this.layerSystem?.requestThumbnailUpdate(this.layerSystem.activeLayerIndex);
                
                // EventBus通知
                window.Tegaki.EventBus.emit('drawing:completed', {
                    layerId: this.layerSystem?.getActiveLayer()?.layerData?.id,
                    pathId: this.currentPath.id,
                    pointCount: this.currentPath.points.length
                });
            }

            this.isDrawing = false;
            this.currentPath = null;
            this.lastPoint = null;
        }
        
        // GPT5案準拠：パスをcanonical座標でレイヤーに追加（レイヤー変形逆変換対応）
        addPathToActiveLayer(path) {
            const activeLayer = this.layerSystem?.getActiveLayer();
            if (!activeLayer) return;
            
            const layerId = activeLayer.layerData.id;
            const transform = this.layerSystem?.layerTransforms?.get(layerId);
            
            // レイヤーが変形されている場合、描画Graphicsに逆変換を適用
            if (this.layerSystem?.isTransformNonDefault(transform)) {
                console.log('DrawingEngine: Applying inverse transform to drawing graphics');
                
                // 逆変換行列を作成
                const centerX = CONFIG.canvas.width / 2;
                const centerY = CONFIG.canvas.height / 2;
                
                const inverseMatrix = new PIXI.Matrix();
                inverseMatrix.translate(centerX, centerY);
                inverseMatrix.scale(1/transform.scaleX, 1/transform.scaleY);
                inverseMatrix.rotate(-transform.rotation);
                inverseMatrix.translate(-centerX - transform.x, -centerY - transform.y);
                
                // 新しいGraphicsを作成（パス座標は変更せずcanonical座標を維持）
                const transformedGraphics = new PIXI.Graphics();
                
                path.points.forEach(point => {
                    const transformedPoint = inverseMatrix.apply(point);
                    transformedGraphics.circle(transformedPoint.x, transformedPoint.y, path.size / 2);
                    transformedGraphics.fill({ color: path.color, alpha: path.opacity });
                });
                
                path.graphics = transformedGraphics;
            }
            
            // パスをレイヤーに追加（パスデータはcanonical座標で保存）
            activeLayer.layerData.paths.push(path);
            activeLayer.addChild(path.graphics);
            
            console.log('DrawingEngine: Path added in canonical coordinates, points:', path.points.slice(0, 3));
        }

        // レイヤー変形確定時の現在描画パス調整
        adjustCurrentPathForTransform(layerId) {
            if (!this.currentPath || !this.isDrawing) return;
            
            const activeLayer = this.layerSystem?.getActiveLayer();
            if (!activeLayer || activeLayer.layerData.id !== layerId) return;
            
            // 現在のパスGraphicsをリセット（パス座標はcanonicalを維持）
            if (this.currentPath.graphics) {
                activeLayer.removeChild(this.currentPath.graphics);
                this.currentPath.graphics.destroy();
                
                this.currentPath.graphics = new PIXI.Graphics();
                this.currentPath.points.forEach(point => {
                    this.currentPath.graphics.circle(point.x, point.y, this.currentPath.size / 2);
                    this.currentPath.graphics.fill({ 
                        color: this.currentPath.color, 
                        alpha: this.currentPath.opacity 
                    });
                });
                
                activeLayer.addChild(this.currentPath.graphics);
            }
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
        
        // システム参照設定
        setCameraSystem(cameraSystem) {
            this.cameraSystem = cameraSystem;
        }
        
        setLayerSystem(layerSystem) {
            this.layerSystem = layerSystem;
        }
    }

    // === システムファイル動的読み込み ===
    function loadSystemFiles(callback) {
        const scripts = [
            'systems/camera-system.js',
            'systems/layer-system.js', 
            'systems/drawing-clipboard.js'
        ];
        
        let loaded = 0;
        const errors = [];
        
        console.log('CoreEngine: Loading system files...');
        
        scripts.forEach(src => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = () => {
                loaded++;
                console.log(`✅ CoreEngine: Loaded ${src} (${loaded}/${scripts.length})`);
                if (loaded === scripts.length) {
                    callback(errors.length === 0);
                }
            };
            script.onerror = (error) => {
                console.error(`❌ CoreEngine: Failed to load ${src}:`, error);
                errors.push(src);
                loaded++;
                if (loaded === scripts.length) {
                    callback(false);
                }
            };
            document.head.appendChild(script);
        });
    }

    // === 統合CoreEngine（改修版：機能完全継承・EventBus疎結合） ===
    class CoreEngine {
        constructor(app) {
            this.app = app;
            this.CONFIG = CONFIG;
            
            // システム参照
            this.cameraSystem = null;
            this.layerSystem = null;
            this.clipboardSystem = null;
            this.drawingEngine = null;
        }

        // 初期化：システム統合とEventBus設定
        initialize() {
            console.log('🚀 CoreEngine: Starting system integration with EventBus...');
            
            // EventBusリスナー設定
            this.setupEventBusListeners();
            
            // システムファイル読み込み
            loadSystemFiles((success) => {
                if (!success) {
                    console.error('❌ CoreEngine: System files loading failed');
                    return;
                }
                
                // システム初期化完了を待機
                window.TegakiSystems.waitFor(['CameraSystem', 'LayerSystem', 'ClipboardSystem'], () => {
                    console.log('🔄 CoreEngine: All systems ready, initializing...');
                    this.initializeSystems();
                });
            });
        }

        // EventBusリスナー設定（疎結合通信）
        setupEventBusListeners() {
            // レイヤー変形確定時（GPT5案準拠）
            window.Tegaki.EventBus.on('layer:transform:confirmed', (data) => {
                console.log('CoreEngine: Layer transform confirmed:', data.layerId);
                if (this.layerSystem) {
                    this.layerSystem.requestThumbnailUpdate(data.layerIndex || this.layerSystem.activeLayerIndex);
                }
            });

            // カメラリサイズ時（GPT5案準拠）
            window.Tegaki.EventBus.on('camera:resize', (data) => {
                console.log('CoreEngine: Camera resized:', data.width, 'x', data.height);
                this.updateBackgroundLayers(data.width, data.height);
            });

            // レイヤーパス変更時（GPT5案準拠）
            window.Tegaki.EventBus.on('layer:paths:changed', (data) => {
                console.log('CoreEngine: Layer paths changed:', data.layerId);
                if (this.layerSystem) {
                    const layerIndex = this.layerSystem.layers.findIndex(l => l.layerData.id === data.layerId);
                    if (layerIndex >= 0) {
                        this.layerSystem.requestThumbnailUpdate(layerIndex);
                    }
                }
            });
            
            // 描画完了時
            window.Tegaki.EventBus.on('drawing:completed', (data) => {
                // パス変更通知を発行
                window.Tegaki.EventBus.emit('layer:paths:changed', { layerId: data.layerId });
            });
        }

        // システム初期化と相互参照設定
        initializeSystems() {
            try {
                console.log('🔄 CoreEngine: Initializing individual systems...');
                
                // CameraSystem初期化
                const CameraSystemClass = window.TegakiSystems.get('CameraSystem');
                CameraSystemClass.init({ app: this.app });
                this.cameraSystem = CameraSystemClass;

                // LayerSystem初期化（CameraSystemの参照を渡す）
                const LayerSystemClass = window.TegakiSystems.get('LayerSystem');
                LayerSystemClass.init({
                    app: this.app,
                    rootContainer: this.cameraSystem.canvasContainer,
                    cameraSystem: this.cameraSystem
                });
                this.layerSystem = LayerSystemClass;

                // ClipboardSystem初期化
                const ClipboardSystemClass = window.TegakiSystems.get('ClipboardSystem');
                ClipboardSystemClass.init({
                    app: this.app,
                    layerSystem: this.layerSystem
                });
                this.clipboardSystem = ClipboardSystemClass;

                // DrawingEngine初期化（統合版）
                this.drawingEngine = new DrawingEngine({
                    cameraSystem: this.cameraSystem,
                    layerSystem: this.layerSystem
                });

                // 相互参照設定（EventBus併用）
                this.setupCrossReferences();

                // 後方互換API設定
                this.setupBackwardCompatibility();

                // キャンバスイベント設定
                this.setupCanvasEvents();

                // 初期レイヤー作成
                this.createInitialLayers();

                // UI統合
                this.setupUI();

                // サムネイル更新ループ
                this.setupThumbnailUpdates();

                console.log('✅ CoreEngine: System integration completed successfully');
                
                // 初期化完了通知
                window.Tegaki.EventBus.emit('core:initialized', {
                    systems: ['CameraSystem', 'LayerSystem', 'ClipboardSystem', 'DrawingEngine']
                });
                
            } catch (error) {
                console.error('❌ CoreEngine: System initialization failed:', error);
            }
        }

        // 相互参照設定（EventBus経由で疎結合 + 直接参照併用）
        setupCrossReferences() {
            // CameraSystem ← → LayerSystem
            this.cameraSystem.setLayerSystem(this.layerSystem);
            this.cameraSystem.setDrawingEngine(this.drawingEngine);
            this.layerSystem.setCameraSystem(this.cameraSystem);
            
            // DrawingEngine → 各システム
            this.drawingEngine.setCameraSystem(this.cameraSystem);
            this.drawingEngine.setLayerSystem(this.layerSystem);
            
            // ClipboardSystem → LayerSystem
            this.clipboardSystem.setLayerSystem(this.layerSystem);
        }

        // 後方互換API設定（phase1b4互換）
        setupBackwardCompatibility() {
            window.App = this.app;
            window.Tegaki = window.Tegaki || {};
            window.Tegaki.stage = this.app.stage;
            window.Tegaki.renderer = this.app.renderer;

            // phase1b4互換API
            window.drawingAppResizeCanvas = (newWidth, newHeight) => {
                return this.resizeCanvas(newWidth, newHeight);
            };
            
            // LayerManager互換API
            window.LayerManager = {
                getActiveLayer: () => this.layerSystem?.getActiveLayer(),
                setActiveLayer: (index) => this.layerSystem?.setActiveLayer(index),
                createLayer: (name, isBackground) => this.layerSystem?.createLayer(name, isBackground),
                layers: this.layerSystem?.layers || [],
                updateLayerPanelUI: () => this.layerSystem?.updateLayerPanelUI(),
                updateStatusDisplay: () => this.layerSystem?.updateStatusDisplay()
            };
        }

        // キャンバスイベント設定（phase1b4機能継承）
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

            // pointerup はCameraSystemが処理（レイヤー操作との競合回避）

            // ツール切り替えキー（phase1b4互換）
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

        // 初期レイヤー作成（phase1b4互換）
        createInitialLayers() {
            this.layerSystem.createLayer('背景', true);
            this.layerSystem.createLayer('レイヤー1');
            this.layerSystem.setActiveLayer(1);
            
            this.layerSystem.updateLayerPanelUI();
            this.layerSystem.updateStatusDisplay();
        }

        // UI統合（phase1b4互換）
        setupUI() {
            if (window.TegakiUI && window.TegakiUI.initializeSortable) {
                window.TegakiUI.initializeSortable(this.layerSystem);
            }
        }

        // サムネイル更新ループ（phase1b4互換）
        setupThumbnailUpdates() {
            this.app.ticker.add(() => {
                this.layerSystem.processThumbnailUpdates();
            });
        }

        // 背景レイヤー更新（EventBus対応）
        updateBackgroundLayers(newWidth, newHeight) {
            if (!this.layerSystem?.layers) return;
            
            this.layerSystem.layers.forEach(layer => {
                if (layer.layerData.isBackground && layer.layerData.backgroundGraphics) {
                    layer.layerData.backgroundGraphics.clear();
                    layer.layerData.backgroundGraphics.rect(0, 0, newWidth, newHeight);
                    layer.layerData.backgroundGraphics.fill(CONFIG.background.color);
                }
            });
        }

        // === 公開API（phase1b4互換） ===
        getCameraSystem() { return this.cameraSystem; }
        getLayerManager() { return this.layerSystem; } // phase1b4互換名
        getLayerSystem() { return this.layerSystem; }
        getDrawingEngine() { return this.drawingEngine; }
        getClipboardSystem() { return this.clipboardSystem; }
        
        switchTool(tool) {
            // EventBus通知でDrawingEngineが受信
            window.Tegaki.EventBus.emit('tool:changed', { tool });
            
            // UI更新はCameraSystemが処理
            this.cameraSystem?.switchTool(tool);
        }
        
        updateCoordinates(x, y) {
            this.cameraSystem?.updateCoordinates(x, y);
        }
        
        // キャンバスリサイズ統合処理（GPT5案準拠・EventBus対応）
        resizeCanvas(newWidth, newHeight) {
            console.log('CoreEngine: Canvas resize request:', newWidth, 'x', newHeight);
            
            // CONFIG更新
            CONFIG.canvas.width = newWidth;
            CONFIG.canvas.height = newHeight;
            
            // EventBus通知（GPT5案準拠）
            window.Tegaki.EventBus.emit('camera:resize', { 
                width: newWidth, 
                height: newHeight 
            });
            
            // CameraSystem更新
            this.cameraSystem?.resizeCanvas(newWidth, newHeight);
            
            // 全レイヤーのサムネイル更新リクエスト
            if (this.layerSystem?.layers) {
                for (let i = 0; i < this.layerSystem.layers.length; i++) {
                    this.layerSystem.requestThumbnailUpdate(i);
                }
            }
            
            console.log('CoreEngine: Canvas resize completed');
        }
        
        // デバッグ用システム状態取得
        getSystemStatus() {
            return {
                cameraSystem: !!this.cameraSystem,
                layerSystem: !!this.layerSystem,
                clipboardSystem: !!this.clipboardSystem,
                drawingEngine: !!this.drawingEngine,
                layerCount: this.layerSystem?.layers?.length || 0,
                activeLayerIndex: this.layerSystem?.activeLayerIndex || -1,
                hasClipboardData: this.clipboardSystem?.hasContent() || false,
                eventBusHandlers: Object.keys(window.Tegaki.EventBus.handlers || {})
            };
        }
    }

    // グローバル公開（phase1b4互換）
    window.TegakiCore = {
        CoreEngine: CoreEngine,
        
        // 個別クラスも公開（必要に応じて）
        DrawingEngine: DrawingEngine,
        
        // 座標変換API公開（GPT5案準拠）
        Coords: window.Tegaki.Coords,
        
        // EventBus公開
        EventBus: window.Tegaki.EventBus
    };

})();