// === DrawingEngine - PixiJS描画エンジン ===
    class DrawingEngine {
        constructor() {
            this.app = null;
            this.containers = { camera: null, world: null, ui: null };
            this.paths = [];
            this.currentPath = null;
            this.pathRegistry = new Map(); // ✅ 新規追加: パス管理用レジストリ
        }
        
        async initialize() {
            const canvasState = MainController.getState('canvas');
            
            this.app = new PIXI.Application();
            await this.app.init({
                width: canvasState.width,
                height: canvasState.height,
                background: 0xf0e0d6,
                backgroundAlpha: 1,
                antialias: true,
                resolution: 1,
                autoDensity: false
            });
            
            const container = document.getElementById('drawing-canvas');
            if (!container) {
                MainController.emit('system-error', {
                    code: 'DRAWING_CANVAS_NOT_FOUND',
                    details: { message: 'Drawing canvas container not found' },
                    stack: new Error().stack
                });
                return false;
            }
            
            container.appendChild(this.app.canvas);
            
            this.setupContainers();
            this.setupInteraction();
            this.setupEventHandlers();
            
            MainController.emit('system-debug', {
                category: 'init',
                message: 'DrawingEngine initialized',
                data: { 
                    canvasSize: `${canvasState.width}x${canvasState.height}`,
                    pixiVersion: PIXI.VERSION 
                },
                timestamp: Date.now()
            });
            
            return true;
        }
        
        setupContainers() {
            this.containers.camera = new PIXI.Container();
            this.containers.world = new PIXI.Container();
            this.containers.ui = new PIXI.Container();
            
            // マスク設定
            const canvasState = MainController.getState('canvas');
            const maskGraphics = new PIXI.Graphics();
            maskGraphics.rect(0, 0, canvasState.width, canvasState.height);
            maskGraphics.fill(0x000000);
            this.app.stage.addChild(maskGraphics);
            this.containers.camera.mask = maskGraphics;
            
            this.containers.camera.addChild(this.containers.world);
            this.app.stage.addChild(this.containers.camera);
            this.app.stage.addChild(this.containers.ui);
            
            this.containers.world.x = 0;
            this.containers.world.y = 0;
            this.containers.world.scale.set(1);
        }
        
        setupInteraction() {
            this.containers.camera.eventMode = "static";
            const canvasState = MainController.getState('canvas');
            this.containers.camera.hitArea = new PIXI.Rectangle(0, 0, canvasState.width, canvasState.height);
            
            this.containers.camera.on('pointerdown', (e) => this.onPointerDown(e));
            this.containers.camera.on('pointermove', (e) => this.onPointerMove(e));
            this.containers.camera.on('pointerup', (e) => this.onPointerUp(e));
            this.containers.camera.on('pointerupoutside', (e) => this.onPointerUp(e));
            this.containers.camera.on('pointercancel', (e) => this.onPointerUp(e));
        }
        
        setupEventHandlers() {
            MainController.on('draw-start-request', (payload) => this.handleDrawStartRequest(payload));
            MainController.on('draw-continue-request', (payload) => this.handleDrawContinueRequest(payload));
            MainController.on('draw-end-request', (payload) => this.handleDrawEndRequest(payload));
            MainController.on('system-resize-request', (payload) => this.handleSystemResizeRequest(payload));
            
            // ✅ 新規追加: undo/redo対応イベント
            MainController.on('path-restore-request', (payload) => this.handlePathRestoreRequest(payload));
            MainController.on('path-remove-request', (payload) => this.handlePathRemoveRequest(payload));
        }
        
        onPointerDown(event) {
            const spacePressed = MainController.getState('spacePressed');
            const originalEvent = event.data.originalEvent;
            
            if (spacePressed) {
                event.stopPropagation();
            } else {
                if (originalEvent.pointerType === 'pen' && originalEvent.pressure === 0) {
                    return;
                }
                
                window.ToolManager?.startDrawing(event.global.x, event.global.y, spacePressed);
            }
        }
        
        onPointerMove(event) {
            const spacePressed = MainController.getState('spacePressed');
            const originalEvent = event.data.originalEvent;
            
            // 座標更新
            MainController.emit('ui-coordinates-update', { x: event.global.x, y: event.global.y });
            
            if (spacePressed) {
                return;
            } else {
                if (originalEvent.pointerType === 'pen' && originalEvent.pressure === 0) {
                    return;
                }
                
                window.ToolManager?.continueDrawing(event.global.x, event.global.y, spacePressed);
            }
        }
        
        onPointerUp(event) {
            const spacePressed = MainController.getState('spacePressed');
            
            if (!spacePressed) {
                window.ToolManager?.stopDrawing(event.global.x, event.global.y);
            }
        }
        
        createPath(worldX, worldY, settings) {
            const path = {
                id: `path_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                graphics: new PIXI.Graphics(),
                points: [],
                color: settings.color,
                size: settings.size,
                opacity: settings.opacity,
                isComplete: false,
                layerId: MainController.getState('activeLayerId') // ✅ 追加: レイヤーID記録
            };
            
            path.graphics.circle(worldX, worldY, settings.size / 2);
            path.graphics.fill({ color: settings.color, alpha: settings.opacity });
            
            path.points.push({ x: worldX, y: worldY, size: settings.size });
            
            // ✅ 修正: アクティブレイヤーへのパス追加とレジストリ登録
            if (window.LayerManager?.addPathToActiveLayer(path)) {
                this.paths.push(path);
                this.pathRegistry.set(path.id, path); // レジストリに登録
                this.currentPath = path;
                
                MainController.emit('path-created', { 
                    pathId: path.id, 
                    layerId: MainController.getState('activeLayerId'),
                    worldBounds: this.calculatePathBounds(path)
                });
                
                return path;
            }
            
            return null;
        }
        
        extendPath(path, worldX, worldY) {
            if (!path || path.points.length === 0) return;
            
            const lastPoint = path.points[path.points.length - 1];
            const distance = Math.sqrt((worldX - lastPoint.x) ** 2 + (worldY - lastPoint.y) ** 2);
            
            if (distance < 1.5) return;
            
            const steps = Math.max(1, Math.ceil(distance / 1.5));
            for (let i = 1; i <= steps; i++) {
                const t = i / steps;
                const px = lastPoint.x + (worldX - lastPoint.x) * t;
                const py = lastPoint.y + (worldY - lastPoint.y) * t;
                
                path.graphics.circle(px, py, path.size / 2);
                path.graphics.fill({ color: path.color, alpha: path.opacity });
            }
            
            path.points.push({ x: worldX, y: worldY, size: path.size });
        }
        
        finalizePath(path) {
            if (path) {
                path.isComplete = true;
                this.currentPath = null;
                
                // ✅ 修正: 完全なパスデータを記録
                MainController.recordAction('PATH_CREATE', {
                    pathId: path.id,
                    layerId: path.layerId,
                    points: path.points,
                    settings: {
                        color: path.color,
                        size: path.size,
                        opacity: path.opacity
                    },
                    bounds: this.calculatePathBounds(path)
                });
            }
        }
        
        // ✅ 新規追加: パス復元（undo/redo対応）
        // ✅ 新規追加: パス復元（undo/redo対応）
        restorePath(pathData) {
            const path = {
                id: pathData.pathId,
                graphics: new PIXI.Graphics(),
                points: pathData.points,
                color: pathData.settings.color,
                size: pathData.settings.size,
                opacity: pathData.settings.opacity,
                isComplete: true,
                layerId: pathData.layerId
            };
            
            // グラフィックス再描画
            pathData.points.forEach(point => {
                path.graphics.circle(point.x, point.y, point.size / 2);
                path.graphics.fill({ color: path.color, alpha: path.opacity });
            });
            
            // レイヤーに追加
            const layer = window.LayerManager?.layers.get(pathData.layerId);
            if (layer) {
                layer.paths.push(path);
                layer.container.addChild(path.graphics);
                this.paths.push(path);
                this.pathRegistry.set(path.id, path);
                
                MainController.emit('system-debug', {
                    category: 'undo',
                    message: 'Path restored',
                    data: { pathId: path.id, layerId: pathData.layerId },
                    timestamp: Date.now()
                });
            }
        }
        
        // ✅ 新規追加: パス削除（undo/redo対応）
        removePath(pathId) {
            const path = this.pathRegistry.get(pathId);
            if (!path) return false;
            
            // レイヤーから削除
            const layer = window.LayerManager?.layers.get(path.layerId);
            if (layer) {
                const pathIndex = layer.paths.findIndex(p => p.id === pathId);
                if (pathIndex >= 0) {
                    layer.paths.splice(pathIndex, 1);
                    layer.container.removeChild(path.graphics);
                }
            }
            
            // グローバルリストから削除
            const globalIndex = this.paths.findIndex(p => p.id === pathId);
            if (globalIndex >= 0) {
                this.paths.splice(globalIndex, 1);
            }
            
            // グラフィックス破棄
            path.graphics.destroy();
            this.pathRegistry.delete(pathId);
            
            MainController.emit('system-debug', {
                category: 'undo',
                message: 'Path removed',
                data: { pathId, layerId: path.layerId },
                timestamp: Date.now()
            });
            
            return true;
        }
        
        calculatePathBounds(path) {
            if (!path.points.length) return { left: 0, top: 0, right: 0, bottom: 0 };
            
            let minX = path.points[0].x, maxX = path.points[0].x;
            let minY = path.points[0].y, maxY = path.points[0].y;
            
            path.points.forEach(point => {
                minX = Math.min(minX, point.x - point.size / 2);
                maxX = Math.max(maxX, point.x + point.size / 2);
                minY = Math.min(minY, point.y - point.size / 2);
                maxY = Math.max(maxY, point.y + point.size / 2);
            });
            
            return { left: minX, top: minY, right: maxX, bottom: maxY };
        }
        
        resize(newWidth, newHeight) {
            MainController.setState('canvas', { width: newWidth, height: newHeight });
            
            this.app.renderer.resize(newWidth, newHeight);
            
            if (this.containers.camera.mask) {
                this.containers.camera.mask.clear();
                this.containers.camera.mask.rect(0, 0, newWidth, newHeight);
                this.containers.camera.mask.fill(0x000000);
            }
            
            this.containers.camera.hitArea = new PIXI.Rectangle(0, 0, newWidth, newHeight);
            
            // 背景レイヤーサイズ更新
            window.LayerManager?.updateBackgroundSize(newWidth, newHeight);
            
            MainController.emit('ui-canvas-resize', { width: newWidth, height: newHeight });
        }
        
        clear() {
            this.paths.forEach(path => {
                if (path.graphics) {
                    path.graphics.destroy();
                }
            });
            this.paths = [];
            this.pathRegistry.clear();
            this.currentPath = null;
            
            const layers = window.LayerManager?.getAllLayers() || [];
            layers.forEach(layer => {
                layer.paths = [];
                layer.container.removeChildren();
            });
        }
        
        // === イベントハンドラー ===
        
        handleDrawStartRequest(payload) {
            // ✅ 修正: アクティブレイヤー制限強化
            const activeLayer = window.LayerManager?.getActiveLayer();
            if (!activeLayer || activeLayer.id !== payload.layerId) {
                MainController.emit('system-debug', {
                    category: 'drawing',
                    message: 'Draw request rejected - inactive layer',
                    data: { 
                        requestedLayerId: payload.layerId, 
                        activeLayerId: activeLayer?.id 
                    },
                    timestamp: Date.now()
                });
                return; // 非アクティブレイヤーへの描画禁止
            }
            
            const toolSettings = window.ToolManager?.getCurrentToolSettings();
            if (!toolSettings) return;
            
            const settings = {
                color: toolSettings.tool === 'eraser' ? 0xf0e0d6 : toolSettings.color,
                size: toolSettings.size,
                opacity: toolSettings.tool === 'eraser' ? 1.0 : toolSettings.opacity
            };
            
            this.createPath(payload.worldX, payload.worldY, settings);
        }
        
        handleDrawContinueRequest(payload) {
            if (this.currentPath) {
                this.extendPath(this.currentPath, payload.worldX, payload.worldY);
            }
        }
        
        handleDrawEndRequest(payload) {
            if (this.currentPath) {
                this.finalizePath(this.currentPath);
            }
        }
        
        handleSystemResizeRequest(payload) {
            this.resize(payload.width, payload.height);
        }
        
        // ✅ 新規追加: undo/redo対応イベントハンドラー
        handlePathRestoreRequest(payload) {
            this.restorePath(payload);
        }
        
        handlePathRemoveRequest(payload) {
            this.removePath(payload.pathId);
        }
    }
    
    // === FPS監視 ===
    class SystemMonitor {
        constructor() {
            this.frameCount = 0;
            this.lastTime = performance.now();
        }
        
        start() {
            const update = () => {
                this.frameCount++;
                const currentTime = performance.now();
                
                if (currentTime - this.lastTime >= 1000) {
                    const fps = Math.round((this.frameCount * 1000) / (currentTime - this.lastTime));
                    const element = document.getElementById('fps');
                    if (element) {
                        element.textContent = fps;
                    }
                    
                    this.frameCount = 0;
                    this.lastTime = currentTime;
                }
                
                requestAnimationFrame(update);
            };
            
            update();
        }
    }
    
    // === 統合衛星初期化 ===
    const layerManager = new LayerManager();
    const toolManager = new ToolManager();
    const uiManager = new UIManager();
    const drawingEngine = new DrawingEngine();
    const systemMonitor = new SystemMonitor();
    
    // グローバル参照設定
    window.LayerManager = layerManager;
    window.ToolManager = toolManager;
    window.UIManager = uiManager;
    window.DrawingEngine = drawingEngine;
    window.SystemMonitor = systemMonitor;
    
    // MainController準備完了待機
    const initWhenReady = async () => {
        if (window.MainController && MainController.getState) {
            try {
                // DrawingEngine初期化
                await drawingEngine.initialize();
                
                // 各マネージャー初期化
                layerManager.initialize(drawingEngine);
                toolManager.initialize();
                uiManager.initialize();
                systemMonitor.start();
                
                MainController.emit('system-debug', {
                    category: 'init',
                    message: 'layer-tool-ui.js satellite initialized',
                    data: { 
                        components: ['LayerManager', 'ToolManager', 'UIManager', 'DrawingEngine', 'SystemMonitor'],
                        pixiVersion: window.PIXI?.VERSION,
                        improvements: [
                            'Layer panel initial display fixed',
                            'Layer separation enforced',
                            'Editable background layer',
                            'Undo/Redo path management'
                        ]
                    },
                    timestamp: Date.now()
                });
                
            } catch (error) {
                MainController.emit('system-error', {
                    code: 'LAYER_TOOL_UI_INIT_FAILED',
                    details: { message: error.message },
                    stack: error.stack
                });
            }
        } else {
            setTimeout(initWhenReady, 10);
        }
    };
    
    // DOM読み込み完了後に初期化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initWhenReady);
    } else {
        initWhenReady();
    }
    
})();/**
 * 🛰️ layer-tool-ui.js - LayerManager+ToolManager+UIManager+DrawingEngine統合衛星
 * Version: 3.0.0 | Last Modified: 2025-09-07
 * 
 * [🎯 責務範囲]
 * - レイヤー管理（CRUD、並び替え、可視性、変形）
 * - ツール管理（ペン、消しゴム、ブラシ設定）
 * - UI制御（ポップアップ、パネル、ステータス、Lodash最適化）
 * - PixiJS描画エンジン（パス作成・延長・消去、ワールド座標対応）
 * 
 * [🔧 主要修正点]
 * - レイヤーパネル初期表示修正
 * - レイヤー分離強化（アクティブレイヤー制限）
 * - 背景レイヤー編集可能化
 * - undo/redo対応のパス管理
 * 
 * [🔧 主要メソッド - LayerManager]
 * createLayer(name) → layer               - レイヤー作成
 * deleteLayer(id)                         - レイヤー削除
 * setActiveLayer(id)                      - アクティブ設定
 * reorderLayers(from, to)                 - ドラッグ並び替え
 * toggleLayerVisibility(id)               - 表示切替
 * createEditableBackgroundLayer()         - 編集可能背景作成（新規）
 * 
 * [🔧 主要メソッド - ToolManager]
 * selectTool(toolName)                    - ツール選択
 * setBrushSize(size)                      - ブラシサイズ
 * setOpacity(opacity)                     - 不透明度
 * getCurrentToolSettings() → settings      - 現在設定取得
 * 
 * [🔧 主要メソッド - UIManager] 
 * updateLayerPanel()                      - レイヤーパネル更新（debounce）
 * forceUpdateLayerPanel()                 - 強制更新（新規）
 * showPopup(popupId)                      - ポップアップ表示
 * hidePopup(popupId)                      - ポップアップ非表示
 * updateStatusBar(data)                   - ステータス更新（throttle）
 * 
 * [🔧 主要メソッド - DrawingEngine]
 * createPath(worldX, worldY, settings) → path  - パス作成（ワールド座標）
 * extendPath(path, worldX, worldY)             - パス延長
 * finalizePath(path)                           - パス完成
 * restorePath(pathData)                        - パス復元（新規）
 * removePath(pathId)                           - パス削除（新規）
 * 
 * [📡 処理イベント（IN）]
 * - layer-*-request : レイヤー操作要求
 * - tool-*-request : ツール操作要求  
 * - draw-*-request : 描画操作要求
 * - path-restore-request / path-remove-request : undo/redo対応
 * - ui-*-request : UI操作要求
 * 
 * [📤 発火イベント（OUT）]
 * - layer-created/deleted/activated : レイヤー状態変更
 * - tool-selected : ツール選択変更
 * - path-created : パス作成完了
 * - ui-updated : UI状態更新
 * 
 * [🔗 依存関係]
 * ← MainController (イベント・状態)
 * ← PositionManager (座標変換)
 * → PixiJS v8.0.5 (描画エンジン)
 * → Lodash v4.17.21 (debounce, throttle, cloneDeep)
 * → GSAP v3.13.0 (アニメーション)
 * → DOM要素: #layer-list, .popup-panel, .status-panel
 * 
 * [⚠️ 禁止事項]
 * - 座標計算・カメラ制御の直接実行
 * - HammerJS処理・エラー処理の直接実行
 */

(function() {
    'use strict';
    
    // === LayerManager - レイヤー管理衛星 ===
    class LayerManager {
        constructor() {
            this.layers = new Map();
            this.activeLayerId = null;
            this.nextLayerId = 1;
            this.dragState = {
                dragging: false,
                dragItem: null,
                startY: 0,
                offset: 0,
                boundMouseMove: null,
                boundMouseUp: null
            };
        }
        
        initialize(drawingEngine) {
            this.engine = drawingEngine;
            this.createEditableBackgroundLayer(); // ✅ 修正: 編集可能な背景レイヤー
            this.setupEventHandlers();
            
            MainController.emit('system-debug', {
                category: 'init',
                message: 'LayerManager initialized',
                data: { layersCount: this.layers.size },
                timestamp: Date.now()
            });
        }
        
        setupEventHandlers() {
            MainController.on('layer-create-request', (payload) => this.handleLayerCreateRequest(payload));
            MainController.on('layer-delete-request', (payload) => this.handleLayerDeleteRequest(payload));
            MainController.on('layer-activate-request', (payload) => this.handleLayerActivateRequest(payload));
            MainController.on('layer-visibility-toggle', (payload) => this.handleLayerVisibilityToggle(payload));
            MainController.on('layer-reorder-request', (payload) => this.handleLayerReorderRequest(payload));
        }
        
        // ✅ 修正: 編集可能な背景レイヤー作成
        createEditableBackgroundLayer() {
            const layerId = 0;
            const layerName = '背景';
            
            const container = new PIXI.Container();
            container.name = layerName;
            container.visible = true;
            
            // ✅ 変更: 編集可能な背景パスを作成
            const backgroundPath = this.createDefaultBackgroundPath();
            container.addChild(backgroundPath.graphics);
            
            const layer = {
                id: layerId,
                name: layerName,
                container: container,
                visible: true,
                paths: [backgroundPath],  // ✅ 編集可能パスとして管理
                isBackground: true,
                editable: true  // ✅ 編集許可フラグ
            };
            
            this.layers.set(layerId, layer);
            this.engine.containers.world.addChild(container);
            this.activeLayerId = layerId;  // ✅ 背景から開始
            
            // 最初の透明レイヤー作成
            this.createLayer('レイヤー1');
            // ✅ 修正: 背景レイヤーをアクティブのまま維持
        }
        
        // ✅ 新規追加: デフォルト背景パス作成
        createDefaultBackgroundPath() {
            const canvasState = MainController.getState('canvas');
            const path = {
                id: 'background_fill',
                graphics: new PIXI.Graphics(),
                points: [
                    { x: 0, y: 0, size: canvasState.width },
                    { x: canvasState.width, y: canvasState.height, size: 1 }
                ],
                color: 0xf0e0d6,  // futaba-cream
                size: 1,
                opacity: 1,
                isComplete: true,
                isBackgroundFill: true
            };
            
            // 背景全体を塗りつぶし
            path.graphics.rect(0, 0, canvasState.width, canvasState.height);
            path.graphics.fill({ color: 0xf0e0d6, alpha: 1 });
            
            return path;
        }
        
        createLayer(name = null) {
            const layerId = this.nextLayerId++;
            const layerName = name || `レイヤー${layerId}`;
            
            const container = new PIXI.Container();
            container.name = layerName;
            container.visible = true;
            
            const layer = {
                id: layerId,
                name: layerName,
                container: container,
                visible: true,
                paths: [],
                isBackground: false,
                editable: true // すべてのレイヤーは編集可能
            };
            
            this.layers.set(layerId, layer);
            this.engine.containers.world.addChild(container);
            
            MainController.emit('layer-created', { layerId, name: layerName });
            MainController.recordAction('LAYER_CREATE', { layerId, name: layerName });
            
            return layer;
        }
        
        deleteLayer(layerId) {
            if (layerId === 0) return false; // 背景レイヤーは削除不可
            if (this.layers.size <= 2) return false; // 背景+最低1レイヤーは必要
            
            const layer = this.layers.get(layerId);
            if (!layer || layer.isBackground) return false;
            
            // パス破棄
            layer.paths.forEach(path => {
                if (path.graphics) {
                    path.graphics.destroy();
                }
            });
            
            // コンテナ削除
            this.engine.containers.world.removeChild(layer.container);
            layer.container.destroy();
            
            this.layers.delete(layerId);
            
            // アクティブレイヤー調整
            if (this.activeLayerId === layerId) {
                const remainingLayers = Array.from(this.layers.keys()).filter(id => id !== 0);
                this.activeLayerId = remainingLayers[remainingLayers.length - 1] || 0;
            }
            
            MainController.emit('layer-deleted', { layerId });
            MainController.recordAction('LAYER_DELETE', { layerId, name: layer.name });
            
            return true;
        }
        
        setActiveLayer(layerId) {
            if (!this.layers.has(layerId)) return false;
            
            this.activeLayerId = layerId;
            MainController.setState('activeLayerId', layerId);
            MainController.emit('layer-activated', { layerId });
            
            return true;
        }
        
        toggleLayerVisibility(layerId) {
            const layer = this.layers.get(layerId);
            if (!layer) return false;
            
            layer.visible = !layer.visible;
            layer.container.visible = layer.visible;
            
            MainController.emit('layer-visibility-changed', { layerId, visible: layer.visible });
            MainController.recordAction('LAYER_VISIBILITY', { layerId, visible: layer.visible });
            
            return true;
        }
        
        reorderLayers(fromIndex, toIndex) {
            const layerIds = Array.from(this.layers.keys()).filter(id => id !== 0).reverse();
            
            if (fromIndex < 0 || fromIndex >= layerIds.length ||
                toIndex < 0 || toIndex >= layerIds.length ||
                fromIndex === toIndex) return false;
            
            const fromLayerId = layerIds[fromIndex];
            const layerContainers = layerIds.map(id => this.layers.get(id).container);
            const fromContainer = layerContainers[fromIndex];
            
            this.engine.containers.world.removeChild(fromContainer);
            this.engine.containers.world.addChildAt(fromContainer, toIndex + 1); // +1 for background layer
            
            MainController.emit('layer-reordered', { fromIndex, toIndex, layerId: fromLayerId });
            MainController.recordAction('LAYER_REORDER', { fromIndex, toIndex, layerId: fromLayerId });
            
            return true;
        }
        
        getActiveLayer() {
            return this.layers.get(this.activeLayerId);
        }
        
        getAllLayers() {
            return Array.from(this.layers.values());
        }
        
        addPathToActiveLayer(path) {
            const activeLayer = this.getActiveLayer();
            if (activeLayer && path && activeLayer.editable) { // ✅ 編集可能チェック追加
                activeLayer.paths.push(path);
                activeLayer.container.addChild(path.graphics);
                return true;
            }
            return false;
        }
        
        // ✅ 修正: 背景サイズ更新（編集可能背景対応）
        updateBackgroundSize(width, height) {
            const backgroundLayer = this.layers.get(0);
            if (backgroundLayer && backgroundLayer.paths.length > 0) {
                const backgroundPath = backgroundLayer.paths[0];
                if (backgroundPath && backgroundPath.isBackgroundFill) {
                    backgroundPath.graphics.clear();
                    backgroundPath.graphics.rect(0, 0, width, height);
                    backgroundPath.graphics.fill({ color: 0xf0e0d6, alpha: 1 });
                    
                    // ポイント情報更新
                    backgroundPath.points = [
                        { x: 0, y: 0, size: width },
                        { x: width, y: height, size: 1 }
                    ];
                }
            }
        }
        
        // ✅ 新規追加: パスをレイヤーから削除
        removePathFromLayer(pathId, layerId = null) {
            const targetLayerId = layerId || this.activeLayerId;
            const layer = this.layers.get(targetLayerId);
            
            if (layer) {
                const pathIndex = layer.paths.findIndex(p => p.id === pathId);
                if (pathIndex >= 0) {
                    const path = layer.paths[pathIndex];
                    layer.container.removeChild(path.graphics);
                    path.graphics.destroy();
                    layer.paths.splice(pathIndex, 1);
                    return true;
                }
            }
            return false;
        }
        
        // === イベントハンドラー ===
        
        handleLayerCreateRequest(payload) {
            const layer = this.createLayer(payload.name);
            this.setActiveLayer(layer.id);
        }
        
        handleLayerDeleteRequest(payload) {
            this.deleteLayer(payload.layerId);
        }
        
        handleLayerActivateRequest(payload) {
            this.setActiveLayer(payload.layerId);
        }
        
        handleLayerVisibilityToggle(payload) {
            this.toggleLayerVisibility(payload.layerId);
        }
        
        handleLayerReorderRequest(payload) {
            this.reorderLayers(payload.fromIndex, payload.toIndex);
        }
    }
    
    // === ToolManager - ツール管理衛星 ===
    class ToolManager {
        constructor() {
            this.currentTool = 'pen';
            this.brushSize = 16.0;
            this.brushColor = 0x800000;
            this.opacity = 0.85;
            this.drawing = { active: false, path: null, lastPoint: null };
        }
        
        initialize() {
            this.setupEventHandlers();
            
            MainController.emit('system-debug', {
                category: 'init',
                message: '