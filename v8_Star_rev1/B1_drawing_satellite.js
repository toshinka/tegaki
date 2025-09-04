/**
 * 🛰️ B1_drawing_satellite.js - 描画衛星
 * 
 * 【責務】: PIXI描画処理の専門管理
 * - DrawingEngine（PIXIアプリ管理）
 * - PathRenderer（ベクター描画）
 * - LayerRenderer（レイヤー描画）
 * - CanvasManager（キャンバス制御）
 * 
 * 【AI可読性】: 描画関連の処理はすべてこの衛星で完結
 * 【改修容易性】: PIXI関連の変更はこのファイルのみ
 * 【状態依存】: A1状態衛星から状態を受け取り、描画のみを担当
 */

// ==== DrawingEngine: PIXI描画システム ====
class DrawingEngine {
    constructor() {
        this.app = null;
        this.containers = { 
            camera: null, 
            world: null, 
            ui: null 
        };
        this.layerContainers = new Map(); // layerId -> PIXI.Container
        this.currentPaths = new Map();    // 描画中のパス管理
        this.initialized = false;
    }
    
    async initialize(config = {}) {
        const { width = 400, height = 400 } = config;
        
        try {
            console.log('🛰️ DrawingEngine: Initializing PIXI application');
            
            this.app = new PIXI.Application();
            await this.app.init({
                width,
                height,
                background: 0xf0e0d6,
                backgroundAlpha: 0, // 背景透明でチェッカーボード表示
                antialias: true,
                resolution: 1,
                autoDensity: false
            });
            
            // DOMに追加
            const container = document.getElementById('drawing-canvas');
            if (!container) {
                throw new Error('drawing-canvas element not found');
            }
            container.appendChild(this.app.canvas);
            
            // コンテナ構造設定
            this.setupContainers();
            this.setupInteraction();
            
            this.initialized = true;
            console.log('🛰️ DrawingEngine: Initialized successfully');
            return true;
            
        } catch (error) {
            console.error('🛰️ DrawingEngine: Initialization failed:', error);
            return false;
        }
    }
    
    setupContainers() {
        // メインコンテナ構造
        this.containers.camera = new PIXI.Container();
        this.containers.world = new PIXI.Container();
        this.containers.ui = new PIXI.Container();
        
        // マスク設定（キャンバス境界）
        const maskGraphics = new PIXI.Graphics();
        maskGraphics.rect(0, 0, this.app.canvas.width, this.app.canvas.height);
        maskGraphics.fill(0x000000);
        this.app.stage.addChild(maskGraphics);
        this.containers.camera.mask = maskGraphics;
        
        // 階層構造構築
        this.containers.camera.addChild(this.containers.world);
        this.app.stage.addChild(this.containers.camera);
        this.app.stage.addChild(this.containers.ui);
        
        // 初期位置・スケール
        this.containers.world.x = 0;
        this.containers.world.y = 0;
        this.containers.world.scale.set(1);
        
        console.log('🛰️ DrawingEngine: Container structure initialized');
    }
    
    setupInteraction() {
        // インタラクション設定
        this.containers.camera.eventMode = "static";
        this.containers.camera.hitArea = new PIXI.Rectangle(
            0, 0, 
            this.app.canvas.width, 
            this.app.canvas.height
        );
        
        // イベントハンドラーは後でB3ツール衛星から設定される
        console.log('🛰️ DrawingEngine: Interaction setup ready');
    }
    
    // レイヤーコンテナ管理
    createLayerContainer(layerId, layerName) {
        if (this.layerContainers.has(layerId)) {
            console.warn(`🛰️ DrawingEngine: Layer container ${layerId} already exists`);
            return this.layerContainers.get(layerId);
        }
        
        const container = new PIXI.Container();
        container.name = layerName || `Layer_${layerId}`;
        container.visible = true;
        container.alpha = 1.0;
        
        this.layerContainers.set(layerId, container);
        this.containers.world.addChild(container);
        
        console.log(`🛰️ DrawingEngine: Layer container created - ${container.name} (ID: ${layerId})`);
        return container;
    }
    
    removeLayerContainer(layerId) {
        const container = this.layerContainers.get(layerId);
        if (!container) {
            console.warn(`🛰️ DrawingEngine: Layer container ${layerId} not found`);
            return false;
        }
        
        this.containers.world.removeChild(container);
        container.destroy({ children: true });
        this.layerContainers.delete(layerId);
        
        console.log(`🛰️ DrawingEngine: Layer container removed (ID: ${layerId})`);
        return true;
    }
    
    getLayerContainer(layerId) {
        return this.layerContainers.get(layerId);
    }
    
    setLayerContainerVisibility(layerId, visible) {
        const container = this.layerContainers.get(layerId);
        if (container) {
            container.visible = visible;
            return true;
        }
        return false;
    }
    
    setLayerContainerOpacity(layerId, opacity) {
        const container = this.layerContainers.get(layerId);
        if (container) {
            container.alpha = Math.max(0, Math.min(1, opacity));
            return true;
        }
        return false;
    }
    
    reorderLayerContainer(layerId, index) {
        const container = this.layerContainers.get(layerId);
        if (!container) return false;
        
        this.containers.world.removeChild(container);
        this.containers.world.addChildAt(container, index);
        
        console.log(`🛰️ DrawingEngine: Layer container reordered - ${container.name} → index ${index}`);
        return true;
    }
    
    // キャンバスリサイズ
    resizeCanvas(newWidth, newHeight) {
        if (!this.app) return false;
        
        this.app.renderer.resize(newWidth, newHeight);
        
        // マスクを更新
        if (this.containers.camera.mask) {
            this.containers.camera.mask.clear();
            this.containers.camera.mask.rect(0, 0, newWidth, newHeight);
            this.containers.camera.mask.fill(0x000000);
        }
        
        // ヒットエリアを更新
        this.containers.camera.hitArea = new PIXI.Rectangle(0, 0, newWidth, newHeight);
        
        console.log(`🛰️ DrawingEngine: Canvas resized to ${newWidth}×${newHeight}`);
        return true;
    }
    
    // 描画クリア
    clearAllLayers() {
        this.layerContainers.forEach((container, layerId) => {
            container.removeChildren();
        });
        this.currentPaths.clear();
        console.log('🛰️ DrawingEngine: All layers cleared');
    }
    
    // デバッグ情報
    getEngineInfo() {
        return {
            initialized: this.initialized,
            canvasSize: this.app ? { 
                width: this.app.canvas.width, 
                height: this.app.canvas.height 
            } : null,
            layerCount: this.layerContainers.size,
            activePaths: this.currentPaths.size,
            containers: {
                world: this.containers.world ? this.containers.world.children.length : 0,
                ui: this.containers.ui ? this.containers.ui.children.length : 0
            }
        };
    }
}

// ==== PathRenderer: ベクター描画処理 ====
class PathRenderer {
    constructor(drawingEngine) {
        this.engine = drawingEngine;
        this.pathIdCounter = 0;
    }
    
    // 新しいパスを開始
    startPath(layerId, x, y, style = {}) {
        const { 
            size = 16, 
            color = 0x800000, 
            opacity = 0.85 
        } = style;
        
        const pathId = `path_${Date.now()}_${this.pathIdCounter++}`;
        
        const graphics = new PIXI.Graphics();
        graphics.circle(x, y, size / 2);
        graphics.fill({ color, alpha: opacity });
        
        const path = {
            id: pathId,
            graphics,
            points: [{ x, y, size }],
            color,
            size,
            opacity,
            isComplete: false,
            layerId
        };
        
        // レイヤーコンテナに追加
        const container = this.engine.getLayerContainer(layerId);
        if (container) {
            container.addChild(graphics);
            this.engine.currentPaths.set(pathId, path);
            
            console.log(`🛰️ PathRenderer: Path started - ${pathId} on layer ${layerId}`);
            return path;
        } else {
            console.warn(`🛰️ PathRenderer: Layer container ${layerId} not found`);
            return null;
        }
    }
    
    // パスを拡張
    extendPath(pathId, x, y) {
        const path = this.engine.currentPaths.get(pathId);
        if (!path || path.isComplete) {
            return false;
        }
        
        const lastPoint = path.points[path.points.length - 1];
        const distance = Math.sqrt((x - lastPoint.x) ** 2 + (y - lastPoint.y) ** 2);
        
        // 最小距離チェック（スムージング）
        if (distance < 1.5) {
            return true;
        }
        
        // 補間描画（滑らかな線）
        const steps = Math.max(1, Math.ceil(distance / 1.5));
        for (let i = 1; i <= steps; i++) {
            const t = i / steps;
            const px = lastPoint.x + (x - lastPoint.x) * t;
            const py = lastPoint.y + (y - lastPoint.y) * t;
            
            path.graphics.circle(px, py, path.size / 2);
            path.graphics.fill({ color: path.color, alpha: path.opacity });
        }
        
        path.points.push({ x, y, size: path.size });
        return true;
    }
    
    // パスを完了
    completePath(pathId) {
        const path = this.engine.currentPaths.get(pathId);
        if (!path) return null;
        
        path.isComplete = true;
        this.engine.currentPaths.delete(pathId);
        
        console.log(`🛰️ PathRenderer: Path completed - ${pathId} (${path.points.length} points)`);
        return path;
    }
    
    // パスをキャンセル（削除）
    cancelPath(pathId) {
        const path = this.engine.currentPaths.get(pathId);
        if (!path) return false;
        
        const container = this.engine.getLayerContainer(path.layerId);
        if (container) {
            container.removeChild(path.graphics);
            path.graphics.destroy();
        }
        
        this.engine.currentPaths.delete(pathId);
        console.log(`🛰️ PathRenderer: Path cancelled - ${pathId}`);
        return true;
    }
    
    // レイヤー間でパスをコピー
    copyPath(path, targetLayerId) {
        const targetContainer = this.engine.getLayerContainer(targetLayerId);
        if (!targetContainer) return null;
        
        const clonedGraphics = new PIXI.Graphics();
        
        // 元のパスの描画を再現
        path.points.forEach(point => {
            clonedGraphics.circle(point.x, point.y, point.size / 2);
            clonedGraphics.fill({ 
                color: path.color, 
                alpha: path.opacity 
            });
        });
        
        const clonedPath = {
            id: `path_${Date.now()}_${this.pathIdCounter++}`,
            graphics: clonedGraphics,
            points: [...path.points],
            color: path.color,
            size: path.size,
            opacity: path.opacity,
            isComplete: true,
            layerId: targetLayerId
        };
        
        targetContainer.addChild(clonedGraphics);
        console.log(`🛰️ PathRenderer: Path copied to layer ${targetLayerId}`);
        
        return clonedPath;
    }
    
    // 消しゴム処理（パスの一部を削除）
    erasePath(pathId, eraseX, eraseY, eraseSize) {
        const path = this.engine.currentPaths.get(pathId);
        if (!path) return false;
        
        // 簡易実装：消しゴム範囲内のポイントを除去
        const eraseRadius = eraseSize / 2;
        const originalPointCount = path.points.length;
        
        path.points = path.points.filter(point => {
            const distance = Math.sqrt(
                (point.x - eraseX) ** 2 + (point.y - eraseY) ** 2
            );
            return distance > eraseRadius;
        });
        
        // パスを再描画
        if (path.points.length !== originalPointCount) {
            this.redrawPath(path);
            console.log(`🛰️ PathRenderer: Path erased - ${pathId} (${originalPointCount - path.points.length} points removed)`);
            return true;
        }
        
        return false;
    }
    
    // パスを再描画
    redrawPath(path) {
        path.graphics.clear();
        
        path.points.forEach(point => {
            path.graphics.circle(point.x, point.y, point.size / 2);
            path.graphics.fill({ 
                color: path.color, 
                alpha: path.opacity 
            });
        });
    }
}

// ==== LayerRenderer: レイヤー描画管理 ====
class LayerRenderer {
    constructor(drawingEngine, pathRenderer) {
        this.engine = drawingEngine;
        this.pathRenderer = pathRenderer;
    }
    
    // レイヤー作成時の描画処理
    createLayer(layerData) {
        const { id, name, visible, opacity } = layerData;
        
        const container = this.engine.createLayerContainer(id, name);
        if (!container) return false;
        
        // 初期状態を設定
        this.updateLayerVisibility(id, visible);
        this.updateLayerOpacity(id, opacity);
        
        console.log(`🛰️ LayerRenderer: Layer rendered - ${name} (ID: ${id})`);
        return true;
    }
    
    // レイヤー削除時の描画処理
    removeLayer(layerId) {
        return this.engine.removeLayerContainer(layerId);
    }
    
    // レイヤー表示状態更新
    updateLayerVisibility(layerId, visibility) {
        const visible = (visibility === 'open');
        return this.engine.setLayerContainerVisibility(layerId, visible);
    }
    
    // レイヤー不透明度更新
    updateLayerOpacity(layerId, opacity) {
        return this.engine.setLayerContainerOpacity(layerId, opacity);
    }
    
    // レイヤー順序更新
    updateLayerOrder(layerOrder) {
        // layerOrderに基づいてコンテナを並び替え
        layerOrder.forEach((layerId, index) => {
            this.engine.reorderLayerContainer(layerId, index);
        });
        
        console.log('🛰️ LayerRenderer: Layer order updated');
        return true;
    }
    
    // レイヤー複製時の描画処理
    duplicateLayer(sourceLayerId, targetLayerData) {
        const sourceContainer = this.engine.getLayerContainer(sourceLayerId);
        if (!sourceContainer) return false;
        
        // ターゲットレイヤー作成
        if (!this.createLayer(targetLayerData)) return false;
        
        const targetContainer = this.engine.getLayerContainer(targetLayerData.id);
        if (!targetContainer) return false;
        
        // ソースレイヤーのすべてのGraphicsを複製
        sourceContainer.children.forEach(child => {
            if (child instanceof PIXI.Graphics) {
                const clonedGraphics = child.clone();
                targetContainer.addChild(clonedGraphics);
            }
        });
        
        console.log(`🛰️ LayerRenderer: Layer duplicated - ${sourceLayerId} → ${targetLayerData.id}`);
        return true;
    }
    
    // レイヤー結合時の描画処理
    mergeLayers(sourceLayerId, targetLayerId) {
        const sourceContainer = this.engine.getLayerContainer(sourceLayerId);
        const targetContainer = this.engine.getLayerContainer(targetLayerId);
        
        if (!sourceContainer || !targetContainer) return false;
        
        // ソースのすべての子要素をターゲットに移動
        while (sourceContainer.children.length > 0) {
            const child = sourceContainer.children[0];
            sourceContainer.removeChild(child);
            targetContainer.addChild(child);
        }
        
        console.log(`🛰️ LayerRenderer: Layers merged - ${sourceLayerId} → ${targetLayerId}`);
        return true;
    }
}

// ==== CanvasManager: キャンバス位置制御 ====
class CanvasManager {
    constructor() {
        this.container = null;
        this.position = { x: 0, y: 0, targetX: 0, targetY: 0 };
        this.state = { 
            panning: false, 
            startX: 0, 
            startY: 0,
            pointerId: null,
            pointerType: null
        };
        this.handlers = { move: null, up: null, cancel: null };
        this.updateScheduled = false;
        this.initialized = false;
    }
    
    initialize() {
        this.container = document.getElementById('canvas-container');
        if (!this.container) {
            console.error('🛰️ CanvasManager: canvas-container not found');
            return false;
        }
        
        this.setupPointerEvents();
        this.setInitialPosition();
        this.initialized = true;
        
        console.log('🛰️ CanvasManager: Initialized');
        return true;
    }
    
    setInitialPosition() {
        const viewportCenter = this.calculateViewportCenter();
        
        this.container.style.transform = 'translate(-50%, -50%)';
        this.container.style.left = viewportCenter.x + 'px';
        this.container.style.top = viewportCenter.y + 'px';
    }
    
    calculateViewportCenter() {
        return {
            x: (window.innerWidth - 50) / 2 + 25, // サイドバー50px分を考慮
            y: window.innerHeight / 2
        };
    }
    
    setupPointerEvents() {
        this.container.addEventListener('pointerdown', (e) => this.onPointerDown(e));
        
        this.handlers.move = (e) => this.onPointerMove(e);
        this.handlers.up = (e) => this.onPointerUp(e);
        this.handlers.cancel = (e) => this.onPointerCancel(e);
    }
    
    onPointerDown(e) {
        // スペースキー押下中のみパン可能（Hub経由で確認）
        if (!window.futabaHub?.spacePressed) return;
        
        if (e.pointerType === 'pen' && e.pressure === 0) {
            console.log('🛰️ CanvasManager: Pen floating - ignoring pointerdown');
            return;
        }
        
        this.state.panning = true;
        this.state.startX = e.clientX;
        this.state.startY = e.clientY;
        this.state.pointerId = e.pointerId;
        this.state.pointerType = e.pointerType;
        
        this.container.setPointerCapture(e.pointerId);
        
        this.container.addEventListener('pointermove', this.handlers.move);
        this.container.addEventListener('pointerup', this.handlers.up);
        this.container.addEventListener('pointercancel', this.handlers.cancel);
        
        console.log(`🛰️ CanvasManager: Panning started - ${e.pointerType} (pressure: ${e.pressure})`);
        e.preventDefault();
    }
    
    onPointerMove(e) {
        if (!this.state.panning || e.pointerId !== this.state.pointerId) return;
        if (!window.futabaHub?.spacePressed) return;
        
        if (e.pointerType === 'pen' && e.pressure === 0) {
            console.log('🛰️ CanvasManager: Pen floating during move - ignoring');
            return;
        }
        
        const dx = e.clientX - this.state.startX;
        const dy = e.clientY - this.state.startY;
        
        this.position.targetX += dx;
        this.position.targetY += dy;
        
        const maxOffset = {
            x: (window.innerWidth - 50) / 2,
            y: window.innerHeight / 2
        };
        
        this.position.targetX = Math.max(-maxOffset.x * 2, Math.min(maxOffset.x * 2, this.position.targetX));
        this.position.targetY = Math.max(-maxOffset.y * 2, Math.min(maxOffset.y * 2, this.position.targetY));
        
        this.state.startX = e.clientX;
        this.state.startY = e.clientY;
        this.updateScheduled = true;
        
        e.preventDefault();
    }
    
    onPointerUp(e) {
        if (e.pointerId !== this.state.pointerId) return;
        this.stopPanning();
        console.log('🛰️ CanvasManager: Panning stopped - pointerup');
    }
    
    onPointerCancel(e) {
        if (e.pointerId !== this.state.pointerId) return;
        this.stopPanning();
        console.log('🛰️ CanvasManager: Panning stopped - pointercancel');
    }
    
    stopPanning() {
        this.state.panning = false;
        
        if (this.state.pointerId && this.container.hasPointerCapture(this.state.pointerId)) {
            this.container.releasePointerCapture(this.state.pointerId);
        }
        
        this.container.removeEventListener('pointermove', this.handlers.move);
        this.container.removeEventListener('pointerup', this.handlers.up);
        this.container.removeEventListener('pointercancel', this.handlers.cancel);
        
        this.state.pointerId = null;
        this.state.pointerType = null;
    }
    
    // アニメーション用更新（毎フレーム呼ばれる）
    updatePosition() {
        if (!this.updateScheduled) return;
        
        const { x, y } = this.position;
        const { targetX, targetY } = this.position;
        
        if (x !== targetX || y !== targetY) {
            this.position.x = Math.round(targetX);
            this.position.y = Math.round(targetY);
            
            const viewportCenter = this.calculateViewportCenter();
            
            const offset = {
                x: viewportCenter.x + this.position.x,
                y: viewportCenter.y + this.position.y
            };
            
            this.container.style.transform = 'translate(-50%, -50%)';
            this.container.style.left = offset.x + 'px';
            this.container.style.top = offset.y + 'px';
        }
        
        this.updateScheduled = false;
    }
    
    // 矢印キーでの移動
    moveByArrows(dx, dy) {
        this.position.targetX += dx;
        this.position.targetY += dy;
        
        const maxOffset = {
            x: (window.innerWidth - 50) / 2,
            y: window.innerHeight / 2
        };
        
        this.position.targetX = Math.max(-maxOffset.x * 2, Math.min(maxOffset.x * 2, this.position.targetX));
        this.position.targetY = Math.max(-maxOffset.y * 2, Math.min(maxOffset.y * 2, this.position.targetY));
        
        this.updateScheduled = true;
    }
    
    // ポジションリセット
    reset() {
        this.position = { x: 0, y: 0, targetX: 0, targetY: 0 };
        this.state.panning = false;
        this.stopPanning();
        
        this.setInitialPosition();
        console.log('🛰️ CanvasManager: Position reset');
    }
    
    getPosition() {
        return {
            x: this.position.targetX,
            y: this.position.targetY
        };
    }
}

// ==== B1DrawingSatellite: 描画衛星の統合クラス ====
class B1DrawingSatellite {
    constructor() {
        this.engine = new DrawingEngine();
        this.pathRenderer = new PathRenderer(this.engine);
        this.layerRenderer = new LayerRenderer(this.engine, this.pathRenderer);
        this.canvasManager = new CanvasManager();
        this.stateManager = null;
        this.eventDispatcher = null;
        this.initialized = false;
        this.ticker = null;
    }
    
    async initialize(stateManager, eventDispatcher) {
        try {
            this.stateManager = stateManager;
            this.eventDispatcher = eventDispatcher;
            
            // DrawingEngine初期化
            const success = await this.engine.initialize();
            if (!success) {
                throw new Error('DrawingEngine initialization failed');
            }
            
            // CanvasManager初期化
            if (!this.canvasManager.initialize()) {
                throw new Error('CanvasManager initialization failed');
            }
            
            // アニメーションループ設定
            this.setupAnimationLoop();
            
            // 状態変更の購読
            this.subscribeToStateChanges();
            
            this.initialized = true;
            console.log('🛰️ B1DrawingSatellite: Initialized successfully');
            return true;
            
        } catch (error) {
            console.error('🛰️ B1DrawingSatellite: Initialization failed:', error);
            return false;
        }
    }
    
    setupAnimationLoop() {
        if (this.engine.app && this.engine.app.ticker) {
            this.ticker = this.engine.app.ticker;
            this.ticker.add(() => {
                this.canvasManager.updatePosition();
            });
        }
    }
    
    subscribeToStateChanges() {
        if (!this.stateManager) return;
        
        // レイヤー関連イベント
        this.stateManager.subscribe('layer.created', (data) => {
            this.layerRenderer.createLayer(data.layer);
        });
        
        this.stateManager.subscribe('layer.deleted', (data) => {
            this.layerRenderer.removeLayer(data.layerId);
        });
        
        this.stateManager.subscribe('layer.visibility.changed', (data) => {
            this.layerRenderer.updateLayerVisibility(data.layerId, data.visibility);
        });
        
        this.stateManager.subscribe('layer.opacity.changed', (data) => {
            this.layerRenderer.updateLayerOpacity(data.layerId, data.opacity);
        });
        
        this.stateManager.subscribe('layer.reordered', (data) => {
            this.layerRenderer.updateLayerOrder(data.newOrder);
        });
        
        this.stateManager.subscribe('layer.duplicate.requested', (data) => {
            const sourceLayer = this.stateManager.getLayerById(data.sourceLayerId);
            const targetLayer = this.stateManager.getLayerById(data.targetLayerId);
            if (sourceLayer && targetLayer) {
                this.layerRenderer.duplicateLayer(data.sourceLayerId, targetLayer);
            }
        });
        
        this.stateManager.subscribe('layer.merge.requested', (data) => {
            this.layerRenderer.mergeLayers(data.sourceLayerId, data.targetLayerId);
        });
        
        // UI状態変更
        this.stateManager.subscribe('ui.space.changed', (data) => {
            // スペースキー状態はCanvasManagerが直接参照
        });
    }
    
    // 外部API（B3ツール衛星から呼ばれる）
    startDrawing(x, y, style) {
        const activeLayer = this.stateManager.getActiveLayer();
        if (!activeLayer) return null;
        
        return this.pathRenderer.startPath(activeLayer.id, x, y, style);
    }
    
    continueDrawing(pathId, x, y) {
        return this.pathRenderer.extendPath(pathId, x, y);
    }
    
    stopDrawing(pathId) {
        return this.pathRenderer.completePath(pathId);
    }
    
    cancelDrawing(pathId) {
        return this.pathRenderer.cancelPath(pathId);
    }
    
    eraseAt(x, y, eraseSize) {
        // 現在のパスから消去対象を探す
        let erased = false;
        this.engine.currentPaths.forEach((path, pathId) => {
            if (this.pathRenderer.erasePath(pathId, x, y, eraseSize)) {
                erased = true;
            }
        });
        return erased;
    }
    
    resizeCanvas(width, height) {
        this.engine.resizeCanvas(width, height);
    }
    
    clearCanvas() {
        this.engine.clearAllLayers();
    }
    
    // キャンバス位置制御
    moveCanvas(dx, dy) {
        this.canvasManager.moveByArrows(dx, dy);
    }
    
    resetCanvasPosition() {
        this.canvasManager.reset();
    }
    
    getCanvasPosition() {
        return this.canvasManager.getPosition();
    }
    
    // デバッグ用
    dumpDrawingInfo() {
        console.group('🛰️ B1DrawingSatellite: Drawing Info');
        console.log('Engine:', this.engine.getEngineInfo());
        console.log('Canvas Position:', this.canvasManager.getPosition());
        console.log('Active Paths:', this.engine.currentPaths.size);
        console.log('Layer Containers:', this.engine.layerContainers.size);
        console.groupEnd();
    }
}

// ==== グローバルエクスポート ====
if (typeof window !== 'undefined') {
    window.B1DrawingSatellite = B1DrawingSatellite;
    window.DrawingEngine = DrawingEngine;
    window.PathRenderer = PathRenderer;
    window.LayerRenderer = LayerRenderer;
    window.CanvasManager = CanvasManager;
    
    console.log('🛰️ B1DrawingSatellite: Classes exported to global scope');
}