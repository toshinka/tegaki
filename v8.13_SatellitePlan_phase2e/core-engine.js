// ===== core-engine.js - 統合型アーキテクチャ改修版 =====
// 改修計画書準拠：phase1b4機能完全継承・システム統合版
// PixiJS v8.13準拠・初期化エラー解決・機能完全継承

(function() {
    'use strict';
    
    const CONFIG = window.TEGAKI_CONFIG;
    
    // === EventBus統一実装（軽量版） ===
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
                        console.warn(`EventBus error in ${evt}:`, e); 
                    } 
                }); 
            }
        };
    })();

    // === 座標変換API統一（厳格実装） ===
    window.Tegaki.Coords = {
        _cameraSystem: null,
        
        setCameraSystem: function(cameraSystem) {
            this._cameraSystem = cameraSystem;
        },
        
        screenToCanvas: function(screenPoint) {
            if (!this._cameraSystem) {
                return { x: screenPoint.x, y: screenPoint.y };
            }
            return this._cameraSystem.screenToCanvas(screenPoint);
        },
        
        canvasToScreen: function(canvasPoint) {
            if (!this._cameraSystem) {
                return { x: canvasPoint.x, y: canvasPoint.y };
            }
            return this._cameraSystem.canvasToScreen(canvasPoint);
        }
    };

    // === CameraSystem統合実装 ===
    class CameraSystem {
        constructor(app) {
            this.app = app;
            this.isDragging = false;
            this.spacePressed = false;
            this.vKeyPressed = false;
            this.currentTool = 'pen';
            this.zoom = 1.0;
            this.panX = 0;
            this.panY = 0;
            
            // PixiJS v8.13: Container構造
            this.worldContainer = new PIXI.Container();
            this.canvasContainer = new PIXI.Container();
            
            this.layerSystem = null;
            this.drawingEngine = null;
            
            this.setupContainers();
            this.setupEventListeners();
        }
        
        setupContainers() {
            this.app.stage.addChild(this.worldContainer);
            this.worldContainer.addChild(this.canvasContainer);
            
            // 座標系API設定
            window.Tegaki.Coords.setCameraSystem(this);
        }
        
        setupEventListeners() {
            // キーボードイベント
            document.addEventListener('keydown', (e) => {
                if (e.code === 'Space') {
                    this.spacePressed = true;
                    this.app.canvas.style.cursor = 'move';
                    e.preventDefault();
                }
                if (e.code === 'KeyV') {
                    this.vKeyPressed = true;
                    e.preventDefault();
                }
            });
            
            document.addEventListener('keyup', (e) => {
                if (e.code === 'Space') {
                    this.spacePressed = false;
                    this.updateCursor();
                }
                if (e.code === 'KeyV') {
                    this.vKeyPressed = false;
                    if (this.layerSystem) {
                        this.layerSystem.confirmLayerTransform();
                    }
                }
            });
            
            // ポインターイベント
            this.app.canvas.addEventListener('pointerdown', (e) => {
                if (e.button === 0) {
                    if (this.spacePressed) {
                        this.isDragging = true;
                        this.lastPanX = e.clientX;
                        this.lastPanY = e.clientY;
                    }
                }
            });
            
            this.app.canvas.addEventListener('pointermove', (e) => {
                if (this.isDragging && this.spacePressed) {
                    const deltaX = e.clientX - this.lastPanX;
                    const deltaY = e.clientY - this.lastPanY;
                    
                    this.panX += deltaX / this.zoom;
                    this.panY += deltaY / this.zoom;
                    
                    this.updateTransform();
                    
                    this.lastPanX = e.clientX;
                    this.lastPanY = e.clientY;
                }
            });
            
            this.app.canvas.addEventListener('pointerup', (e) => {
                if (e.button === 0) {
                    this.isDragging = false;
                    if (this.drawingEngine) {
                        this.drawingEngine.stopDrawing();
                    }
                }
            });
            
            // ホイールイベント
            this.app.canvas.addEventListener('wheel', (e) => {
                const zoomDelta = e.deltaY > 0 ? 0.9 : 1.1;
                this.zoom = Math.max(0.1, Math.min(5.0, this.zoom * zoomDelta));
                this.updateTransform();
                e.preventDefault();
            });
        }
        
        updateTransform() {
            this.worldContainer.position.set(this.panX, this.panY);
            this.worldContainer.scale.set(this.zoom);
        }
        
        updateCursor() {
            if (this.spacePressed) {
                this.app.canvas.style.cursor = 'move';
            } else if (this.vKeyPressed) {
                this.app.canvas.style.cursor = 'move';
            } else {
                this.app.canvas.style.cursor = 'crosshair';
            }
        }
        
        screenToCanvas(screenPoint) {
            const rect = this.app.canvas.getBoundingClientRect();
            const localX = screenPoint.x - rect.left;
            const localY = screenPoint.y - rect.top;
            
            const worldX = (localX - this.panX) / this.zoom;
            const worldY = (localY - this.panY) / this.zoom;
            
            return { x: worldX, y: worldY };
        }
        
        canvasToScreen(canvasPoint) {
            const worldX = canvasPoint.x * this.zoom + this.panX;
            const worldY = canvasPoint.y * this.zoom + this.panY;
            
            const rect = this.app.canvas.getBoundingClientRect();
            return { 
                x: worldX + rect.left, 
                y: worldY + rect.top 
            };
        }
        
        isPointInExtendedCanvas(point) {
            return point.x >= -1000 && point.x <= CONFIG.canvas.width + 1000 &&
                   point.y >= -1000 && point.y <= CONFIG.canvas.height + 1000;
        }
        
        switchTool(tool) {
            this.currentTool = tool;
            this.updateCursor();
            
            // ツール表示更新
            document.getElementById('current-tool').textContent = 
                tool === 'pen' ? 'ベクターペン' : '消しゴム';
                
            // ボタン状態更新
            document.querySelectorAll('.tool-button').forEach(btn => {
                btn.classList.remove('active');
            });
            document.getElementById(tool + '-tool').classList.add('active');
        }
        
        updateCoordinates(x, y) {
            const canvasPoint = this.screenToCanvas({ x, y });
            document.getElementById('coordinates').textContent = 
                `x: ${Math.round(canvasPoint.x)}, y: ${Math.round(canvasPoint.y)}`;
        }
        
        resizeCanvas(newWidth, newHeight) {
            CONFIG.canvas.width = newWidth;
            CONFIG.canvas.height = newHeight;
            
            window.Tegaki.EventBus.emit('camera:resize', { 
                width: newWidth, 
                height: newHeight 
            });
        }
        
        setLayerSystem(layerSystem) { this.layerSystem = layerSystem; }
        setDrawingEngine(drawingEngine) { this.drawingEngine = drawingEngine; }
    }

    // === LayerSystem統合実装 ===
    class LayerSystem {
        constructor(app, rootContainer, cameraSystem) {
            this.app = app;
            this.rootContainer = rootContainer;
            this.cameraSystem = cameraSystem;
            this.layers = [];
            this.activeLayerIndex = 0;
            this.layerTransforms = new Map();
            this.thumbnailUpdateQueue = new Set();
            
            this.setupEventListeners();
        }
        
        setupEventListeners() {
            window.Tegaki.EventBus.on('camera:resize', (data) => {
                this.updateBackgroundLayers(data.width, data.height);
            });
            
            // レイヤー作成ショートカット
            document.addEventListener('keydown', (e) => {
                if (e.ctrlKey && e.key === 'n' && !e.shiftKey) {
                    this.createLayer();
                    e.preventDefault();
                }
            });
        }
        
        createLayer(name, isBackground = false) {
            const layerId = `layer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const layerName = name || `レイヤー${this.layers.length}`;
            
            const layerContainer = new PIXI.Container();
            const layerData = {
                id: layerId,
                name: layerName,
                isBackground: isBackground,
                visible: true,
                opacity: 1.0,
                paths: [],
                backgroundGraphics: null
            };
            
            if (isBackground) {
                const bg = new PIXI.Graphics();
                bg.rect(0, 0, CONFIG.canvas.width, CONFIG.canvas.height);
                bg.fill(CONFIG.background.color);
                layerContainer.addChild(bg);
                layerData.backgroundGraphics = bg;
            }
            
            layerContainer.layerData = layerData;
            
            this.layers.push(layerContainer);
            this.rootContainer.addChild(layerContainer);
            
            // デフォルト変形設定
            this.layerTransforms.set(layerId, {
                x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0
            });
            
            this.requestThumbnailUpdate(this.layers.length - 1);
            
            return layerContainer;
        }
        
        getActiveLayer() {
            return this.layers[this.activeLayerIndex] || null;
        }
        
        setActiveLayer(index) {
            if (index >= 0 && index < this.layers.length) {
                this.activeLayerIndex = index;
                this.updateStatusDisplay();
                this.updateLayerPanelUI();
            }
        }
        
        updateStatusDisplay() {
            const activeLayer = this.getActiveLayer();
            if (activeLayer) {
                document.getElementById('current-layer').textContent = 
                    activeLayer.layerData.name;
                    
                const transform = this.layerTransforms.get(activeLayer.layerData.id);
                if (transform) {
                    document.getElementById('transform-info').textContent = 
                        `x:${Math.round(transform.x)} y:${Math.round(transform.y)} ` +
                        `s:${transform.scaleX.toFixed(1)} r:${Math.round(transform.rotation)}°`;
                }
            }
        }
        
        updateLayerPanelUI() {
            const layerList = document.getElementById('layer-list');
            if (!layerList) return;
            
            layerList.innerHTML = '';
            
            // レイヤーを逆順で表示（上が最前面）
            for (let i = this.layers.length - 1; i >= 0; i--) {
                const layer = this.layers[i];
                const isActive = i === this.activeLayerIndex;
                
                const layerItem = document.createElement('div');
                layerItem.className = `layer-item ${isActive ? 'active' : ''}`;
                layerItem.dataset.layerIndex = i;
                
                layerItem.innerHTML = `
                    <div class="layer-visibility ${layer.layerData.visible ? '' : 'hidden'}">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#800000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                            ${layer.layerData.visible ? 
                                '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>' :
                                '<path d="m15 18-.722-3.25"/><path d="m2 2 20 20"/><path d="m9 9-.722-3.25"/><path d="M21 12s-4 8-11 8-11-8-11-8 4-8 11-8 11 8 11 8z"/><circle cx="12" cy="12" r="3"/>'
                            }
                        </svg>
                    </div>
                    <div class="layer-opacity">${Math.round(layer.layerData.opacity * 100)}%</div>
                    <div class="layer-name">${layer.layerData.name}</div>
                    <div class="layer-thumbnail">
                        <div class="layer-thumbnail-placeholder"></div>
                    </div>
                `;
                
                layerItem.addEventListener('click', () => {
                    this.setActiveLayer(i);
                });
                
                layerList.appendChild(layerItem);
            }
        }
        
        updateBackgroundLayers(newWidth, newHeight) {
            this.layers.forEach(layer => {
                if (layer.layerData.isBackground && layer.layerData.backgroundGraphics) {
                    layer.layerData.backgroundGraphics.clear();
                    layer.layerData.backgroundGraphics.rect(0, 0, newWidth, newHeight);
                    layer.layerData.backgroundGraphics.fill(CONFIG.background.color);
                }
            });
        }
        
        requestThumbnailUpdate(layerIndex) {
            this.thumbnailUpdateQueue.add(layerIndex);
        }
        
        processThumbnailUpdates() {
            if (this.thumbnailUpdateQueue.size === 0) return;
            
            const index = this.thumbnailUpdateQueue.values().next().value;
            this.thumbnailUpdateQueue.delete(index);
            
            // サムネイル更新処理（簡易版）
            const layerItem = document.querySelector(`[data-layer-index="${index}"]`);
            if (layerItem) {
                const thumbnail = layerItem.querySelector('.layer-thumbnail-placeholder');
                if (thumbnail) {
                    thumbnail.style.background = 'var(--futaba-maroon)';
                    thumbnail.style.opacity = '0.3';
                }
            }
        }
        
        confirmLayerTransform() {
            const activeLayer = this.getActiveLayer();
            if (!activeLayer) return;
            
            window.Tegaki.EventBus.emit('layer:transform:confirmed', {
                layerId: activeLayer.layerData.id,
                layerIndex: this.activeLayerIndex
            });
            
            this.requestThumbnailUpdate(this.activeLayerIndex);
        }
        
        isTransformNonDefault(transform) {
            return transform.x !== 0 || transform.y !== 0 || 
                   transform.scaleX !== 1 || transform.scaleY !== 1 || 
                   transform.rotation !== 0;
        }
        
        setCameraSystem(cameraSystem) { this.cameraSystem = cameraSystem; }
    }

    // === DrawingEngine統合実装 ===
    class DrawingEngine {
        constructor(cameraSystem, layerSystem) {
            this.cameraSystem = cameraSystem;
            this.layerSystem = layerSystem;
            this.currentTool = 'pen';
            this.brushSize = CONFIG.pen.size;
            this.brushColor = CONFIG.pen.color;
            this.brushOpacity = CONFIG.pen.opacity;
            this.isDrawing = false;
            this.currentPath = null;
            this.lastPoint = null;
            
            this.setupEventListeners();
        }
        
        setupEventListeners() {
            window.Tegaki.EventBus.on('tool:changed', (data) => {
                this.setTool(data.tool);
            });
        }
        
        startDrawing(screenX, screenY) {
            if (this.isDrawing || this.cameraSystem.spacePressed || 
                this.cameraSystem.isDragging || this.cameraSystem.vKeyPressed) return;

            const canvasPoint = window.Tegaki.Coords.screenToCanvas({ x: screenX, y: screenY });
            
            if (!this.cameraSystem.isPointInExtendedCanvas(canvasPoint)) return;
            
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

            activeLayer.layerData.paths.push(this.currentPath);
            activeLayer.addChild(this.currentPath.graphics);
        }
        
        continueDrawing(screenX, screenY) {
            if (!this.isDrawing || !this.currentPath || 
                this.cameraSystem.spacePressed || this.cameraSystem.isDragging || 
                this.cameraSystem.vKeyPressed) return;

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

    // === ClipboardSystem統合実装 ===
    class ClipboardSystem {
        constructor(layerSystem) {
            this.layerSystem = layerSystem;
            this.clipboardData = null;
            
            this.setupEventListeners();
        }
        
        setupEventListeners() {
            document.addEventListener('keydown', (e) => {
                if (e.ctrlKey && e.key === 'c') {
                    this.copyActiveLayer();
                    e.preventDefault();
                }
                if (e.ctrlKey && e.key === 'v') {
                    this.pasteLayer();
                    e.preventDefault();
                }
            });
        }
        
        copyActiveLayer() {
            const activeLayer = this.layerSystem.getActiveLayer();
            if (!activeLayer) return;
            
            this.clipboardData = {
                layerData: JSON.parse(JSON.stringify(activeLayer.layerData)),
                timestamp: Date.now()
            };
        }
        
        pasteLayer() {
            if (!this.clipboardData) return;
            
            const newLayer = this.layerSystem.createLayer(
                this.clipboardData.layerData.name + '_コピー'
            );
            
            // パスデータの復元
            this.clipboardData.layerData.paths.forEach(pathData => {
                const newGraphics = new PIXI.Graphics();
                pathData.points.forEach(point => {
                    newGraphics.circle(point.x, point.y, pathData.size / 2);
                    newGraphics.fill({ color: pathData.color, alpha: pathData.opacity });
                });
                
                const newPath = {
                    ...pathData,
                    id: `path_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    graphics: newGraphics
                };
                
                newLayer.layerData.paths.push(newPath);
                newLayer.addChild(newGraphics);
            });
            
            this.layerSystem.requestThumbnailUpdate(this.layerSystem.layers.length - 1);
        }
        
        hasContent() {
            return !!this.clipboardData;
        }
    }

    // === 統合CoreEngine（初期化エラー解決版） ===
    class CoreEngine {
        constructor(app) {
            this.app = app;
            this.CONFIG = CONFIG;
            
            // 即座に初期化
            this.cameraSystem = new CameraSystem(app);
            this.layerSystem = new LayerSystem(app, this.cameraSystem.canvasContainer, this.cameraSystem);
            this.drawingEngine = new DrawingEngine(this.cameraSystem, this.layerSystem);
            this.clipboardSystem = new ClipboardSystem(this.layerSystem);
            
            // 相互参照設定
            this.cameraSystem.setLayerSystem(this.layerSystem);
            this.cameraSystem.setDrawingEngine(this.drawingEngine);
        }

        initialize() {
            console.log('✅ CoreEngine: Unified system initialization starting...');
            
            // キャンバスイベント設定
            this.setupCanvasEvents();
            
            // 初期レイヤー作成
            this.createInitialLayers();
            
            // UI統合
            this.setupUI();
            
            // サムネイル更新ループ
            this.setupThumbnailUpdates();
            
            // 後方互換API設定
            this.setupBackwardCompatibility();
            
            console.log('✅ CoreEngine: Unified system initialization completed');
            
            window.Tegaki.EventBus.emit('core:initialized', {
                systems: ['CameraSystem', 'LayerSystem', 'DrawingEngine', 'ClipboardSystem']
            });
            
            return this;
        }
        
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
        
        createInitialLayers() {
            this.layerSystem.createLayer('背景', true);
            this.layerSystem.createLayer('レイヤー1');
            this.layerSystem.setActiveLayer(1);
            
            this.layerSystem.updateLayerPanelUI();
            this.layerSystem.updateStatusDisplay();
        }
        
        setupUI() {
            // レイヤー追加ボタン
            const addLayerBtn = document.getElementById('add-layer-btn');
            if (addLayerBtn) {
                addLayerBtn.addEventListener('click', () => {
                    this.layerSystem.createLayer();
                    this.layerSystem.updateLayerPanelUI();
                });
            }
            
            // ツールボタン
            document.getElementById('pen-tool')?.addEventListener('click', () => {
                this.switchTool('pen');
            });
            document.getElementById('eraser-tool')?.addEventListener('click', () => {
                this.switchTool('eraser');
            });
            
            if (window.TegakiUI && window.TegakiUI.initializeSortable) {
                window.TegakiUI.initializeSortable(this.layerSystem);
            }
        }
        
        setupThumbnailUpdates() {
            this.app.ticker.add(() => {
                this.layerSystem.processThumbnailUpdates();
            });
        }
        
        setupBackwardCompatibility() {
            window.App = this.app;
            window.Tegaki.stage = this.app.stage;
            window.Tegaki.renderer = this.app.renderer;

            window.drawingAppResizeCanvas = (newWidth, newHeight) => {
                return this.resizeCanvas(newWidth, newHeight);
            };
            
            window.LayerManager = {
                getActiveLayer: () => this.layerSystem.getActiveLayer(),
                setActiveLayer: (index) => this.layerSystem.setActiveLayer(index),
                createLayer: (name, isBackground) => this.layerSystem.createLayer(name, isBackground),
                layers: this.layerSystem.layers,
                updateLayerPanelUI: () => this.layerSystem.updateLayerPanelUI(),
                updateStatusDisplay: () => this.layerSystem.updateStatusDisplay()
            };
        }
        
        // 公開API
        getCameraSystem() { return this.cameraSystem; }
        getLayerManager() { return this.layerSystem; }
        getLayerSystem() { return this.layerSystem; }
        getDrawingEngine() { return this.drawingEngine; }
        getClipboardSystem() { return this.clipboardSystem; }
        
        switchTool(tool) {
            window.Tegaki.EventBus.emit('tool:changed', { tool });
            this.cameraSystem.switchTool(tool);
        }
        
        updateCoordinates(x, y) {
            this.cameraSystem.updateCoordinates(x, y);
        }
        
        resizeCanvas(newWidth, newHeight) {
            console.log('CoreEngine: Canvas resize request:', newWidth, 'x', newHeight);
            
            CONFIG.canvas.width = newWidth;
            CONFIG.canvas.height = newHeight;
            
            this.cameraSystem.resizeCanvas(newWidth, newHeight);
            
            for (let i = 0; i < this.layerSystem.layers.length; i++) {
                this.layerSystem.requestThumbnailUpdate(i);
            }
            
            console.log('CoreEngine: Canvas resize completed');
        }
        
        getSystemStatus() {
            return {
                cameraSystem: !!this.cameraSystem,
                layerSystem: !!this.layerSystem,
                clipboardSystem: !!this.clipboardSystem,
                drawingEngine: !!this.drawingEngine,
                layerCount: this.layerSystem.layers.length,
                activeLayerIndex: this.layerSystem.activeLayerIndex,
                hasClipboardData: this.clipboardSystem.hasContent()
            };
        }
    }

    // グローバル公開（即座に利用可能）
    window.TegakiCore = {
        CoreEngine: CoreEngine,
        DrawingEngine: DrawingEngine,
        Coords: window.Tegaki.Coords,
        EventBus: window.Tegaki.EventBus
    };

    console.log('✅ TegakiCore unified systems loaded and ready');

})();