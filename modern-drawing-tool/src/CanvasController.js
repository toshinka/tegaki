/**
 * CanvasController v3.2 - PixiJS統合キャンバス制御システム
 * ズーム・パン・回転・グリッド表示・Chrome API最適化
 * 規約: 総合AIコーディング規約v4.1準拠（PixiJS統一座標対応）
 */

import * as PIXI from 'pixi.js';

/**
 * PixiJS統合キャンバス制御システム
 * PixiJS Container transform活用による高性能ナビゲーション
 */
export class CanvasController {
    constructor(pixiApp, coordinateUnifier, eventStore) {
        this.app = pixiApp;
        this.coordinate = coordinateUnifier;
        this.eventStore = eventStore;
        
        // キャンバス状態管理
        this.viewport = {
            x: 0,
            y: 0,
            zoom: 1.0,
            rotation: 0,
            minZoom: 0.1,
            maxZoom: 10.0
        };
        
        // ナビゲーション状態
        this.isPanning = false;
        this.isRotating = false;
        this.lastPointerPos = { x: 0, y: 0 };
        this.panStartPos = { x: 0, y: 0 };
        
        // PixiJS Canvas Container
        this.canvasContainer = new PIXI.Container();
        this.backgroundContainer = new PIXI.Container();
        this.gridContainer = new PIXI.Container();
        this.overlayContainer = new PIXI.Container();
        
        // キャンバス設定
        this.canvasSettings = {
            width: 1920,
            height: 1080,
            backgroundColor: 0xffffee, // ふたば背景色
            gridEnabled: true,
            gridSize: 32,
            gridColor: 0x800000, // ふたばマルーン
            gridOpacity: 0.15,
            rulerEnabled: true,
            snapToGrid: false
        };
        
        // スムーズナビゲーション
        this.smoothing = {
            enabled: true,
            factor: 0.15,
            threshold: 0.01,
            currentTarget: { x: 0, y: 0, zoom: 1.0, rotation: 0 },
            isAnimating: false
        };
        
        // パフォーマンス最適化
        this.optimization = {
            cullingEnabled: true,
            cullingBounds: new PIXI.Rectangle(),
            levelOfDetail: true,
            lodThresholds: { low: 0.5, medium: 1.5 },
            renderingDelay: 16 // 60fps
        };
        
        // ジェスチャー制御（マウス・ペンタブレット専用）
        this.gestures = {
            zoomSensitivity: 0.1,
            panSensitivity: 1.0,
            rotationSensitivity: 0.01,
            inertiaEnabled: true,
            inertiaDecay: 0.95
        };
        
        this.initialize();
    }
    
    /**
     * キャンバス制御システム初期化
     */
    initialize() {
        try {
            console.log('🖼️ CanvasController初期化開始 - PixiJS統合キャンバス制御');
            
            // PixiJS Container階層構築
            this.setupContainerHierarchy();
            
            // キャンバス背景・グリッド生成
            this.createCanvasBackground();
            this.createGrid();
            
            // ナビゲーション制御設定
            this.setupNavigationControls();
            
            // イベントリスナー削除
            document.removeEventListener('keydown', this.handleKeyDown);
            document.removeEventListener('keyup', this.handleKeyUp);
            this.app.view.removeEventListener('wheel', this.handleWheelZoom);
            
            // PixiJSコンテナ破棄
            this.canvasContainer.destroy({ children: true });
            this.backgroundContainer.destroy({ children: true });
            this.gridContainer.destroy({ children: true });
            this.overlayContainer.destroy({ children: true });
            
            console.log('🖼️ CanvasController破棄完了');
            
        } catch (error) {
            console.error('❌ CanvasController破棄エラー:', error);
        }
    }
}スナー設定
            this.setupEventListeners();
            
            // パフォーマンス最適化設定
            this.setupPerformanceOptimization();
            
            // 初期ビューポート設定
            this.centerCanvas();
            
            console.log('✅ CanvasController初期化完了 - PixiJS統合キャンバス制御稼働');
            
        } catch (error) {
            console.error('❌ CanvasController初期化エラー:', error);
            throw error;
        }
    }
    
    /**
     * PixiJS Container階層構築
     */
    setupContainerHierarchy() {
        // メインキャンバスContainer
        this.canvasContainer.name = 'canvasMain';
        this.canvasContainer.sortableChildren = true;
        
        // Container階層構築
        this.backgroundContainer.name = 'background';
        this.backgroundContainer.zIndex = 0;
        
        this.gridContainer.name = 'grid';
        this.gridContainer.zIndex = 1;
        
        this.overlayContainer.name = 'overlay';
        this.overlayContainer.zIndex = 100;
        
        // 階層追加
        this.canvasContainer.addChild(
            this.backgroundContainer,
            this.gridContainer,
            this.overlayContainer
        );
        
        // メインStageに追加
        this.app.stage.addChildAt(this.canvasContainer, 0); // 最背面
        
        console.log('🎯 PixiJS Container階層構築完了');
    }
    
    /**
     * キャンバス背景生成
     */
    createCanvasBackground() {
        const background = new PIXI.Graphics();
        
        // ふたば背景色グラデーション
        background.beginFill(this.canvasSettings.backgroundColor);
        background.drawRect(0, 0, this.canvasSettings.width, this.canvasSettings.height);
        background.endFill();
        
        // キャンバス境界線
        background.lineStyle(2, 0x800000, 0.3); // ふたばマルーン
        background.drawRect(0, 0, this.canvasSettings.width, this.canvasSettings.height);
        
        // 境界外のパターン（チェッカーボード）
        this.createTransparencyPattern(background);
        
        this.backgroundContainer.addChild(background);
        this.canvasBackground = background;
        
        console.log('🎨 キャンバス背景生成完了');
    }
    
    /**
     * 透明パターン生成
     */
    createTransparencyPattern(container) {
        const patternSize = 16;
        const pattern = new PIXI.Graphics();
        
        // チェッカーボードパターン
        for (let x = -patternSize * 10; x < this.canvasSettings.width + patternSize * 10; x += patternSize) {
            for (let y = -patternSize * 10; y < this.canvasSettings.height + patternSize * 10; y += patternSize) {
                const isEven = ((x / patternSize) + (y / patternSize)) % 2 === 0;
                if (isEven) {
                    pattern.beginFill(0xcccccc, 0.1);
                    pattern.drawRect(x, y, patternSize, patternSize);
                    pattern.endFill();
                }
            }
        }
        
        // キャンバス外領域マスク
        const outsideMask = new PIXI.Graphics();
        outsideMask.beginFill(0x000000, 0.1);
        outsideMask.drawRect(-patternSize * 10, -patternSize * 10, 
                           this.canvasSettings.width + patternSize * 20, patternSize * 10);
        outsideMask.drawRect(-patternSize * 10, this.canvasSettings.height, 
                           this.canvasSettings.width + patternSize * 20, patternSize * 10);
        outsideMask.drawRect(-patternSize * 10, 0, 
                           patternSize * 10, this.canvasSettings.height);
        outsideMask.drawRect(this.canvasSettings.width, 0, 
                           patternSize * 10, this.canvasSettings.height);
        outsideMask.endFill();
        
        container.addChild(pattern);
        container.addChild(outsideMask);
    }
    
    /**
     * グリッド生成
     */
    createGrid() {
        if (!this.canvasSettings.gridEnabled) return;
        
        const grid = new PIXI.Graphics();
        const gridSize = this.canvasSettings.gridSize;
        
        // 縦線
        for (let x = 0; x <= this.canvasSettings.width; x += gridSize) {
            grid.lineStyle(1, this.canvasSettings.gridColor, this.canvasSettings.gridOpacity);
            grid.moveTo(x, 0);
            grid.lineTo(x, this.canvasSettings.height);
        }
        
        // 横線
        for (let y = 0; y <= this.canvasSettings.height; y += gridSize) {
            grid.lineStyle(1, this.canvasSettings.gridColor, this.canvasSettings.gridOpacity);
            grid.moveTo(0, y);
            grid.lineTo(this.canvasSettings.width, y);
        }
        
        // メジャーグリッド（太線）
        const majorGridSize = gridSize * 5;
        for (let x = 0; x <= this.canvasSettings.width; x += majorGridSize) {
            grid.lineStyle(2, this.canvasSettings.gridColor, this.canvasSettings.gridOpacity * 1.5);
            grid.moveTo(x, 0);
            grid.lineTo(x, this.canvasSettings.height);
        }
        
        for (let y = 0; y <= this.canvasSettings.height; y += majorGridSize) {
            grid.lineStyle(2, this.canvasSettings.gridColor, this.canvasSettings.gridOpacity * 1.5);
            grid.moveTo(0, y);
            grid.lineTo(this.canvasSettings.width, y);
        }
        
        this.gridContainer.addChild(grid);
        this.canvasGrid = grid;
        
        console.log('📐 グリッド生成完了');
    }
    
    /**
     * ナビゲーション制御設定
     */
    setupNavigationControls() {
        // PixiJS InteractionManager統合
        this.app.stage.eventMode = 'static';
        this.app.stage.hitArea = new PIXI.Rectangle(0, 0, this.app.view.width, this.app.view.height);
        
        // ホイールズーム
        this.app.view.addEventListener('wheel', (event) => {
            this.handleWheelZoom(event);
        }, { passive: false });
        
        // パン操作（スペースキー + ドラッグ）
        this.setupPanControls();
        
        // ズームショートカット
        this.setupZoomShortcuts();
        
        console.log('🎮 ナビゲーション制御設定完了');
    }
    
    /**
     * パン操作設定
     */
    setupPanControls() {
        let spacePressed = false;
        
        // スペースキー監視
        document.addEventListener('keydown', (event) => {
            if (event.code === 'Space' && !event.repeat) {
                spacePressed = true;
                this.app.view.style.cursor = 'grab';
                event.preventDefault();
            }
        });
        
        document.addEventListener('keyup', (event) => {
            if (event.code === 'Space') {
                spacePressed = false;
                this.app.view.style.cursor = 'default';
                this.endPan();
            }
        });
        
        // PointerEvents（PixiJS統合）
        this.app.stage.on('pointerdown', (event) => {
            if (spacePressed || event.data.originalEvent.button === 1) { // 中ボタンまたはスペース+左
                this.startPan(event.data.global);
                this.app.view.style.cursor = 'grabbing';
                event.stopPropagation();
            }
        });
        
        this.app.stage.on('pointermove', (event) => {
            if (this.isPanning) {
                this.updatePan(event.data.global);
                event.stopPropagation();
            }
        });
        
        this.app.stage.on('pointerup', (event) => {
            if (this.isPanning) {
                this.endPan();
                this.app.view.style.cursor = spacePressed ? 'grab' : 'default';
                event.stopPropagation();
            }
        });
        
        this.app.stage.on('pointerupoutside', () => {
            this.endPan();
        });
    }
    
    /**
     * ズームショートカット設定
     */
    setupZoomShortcuts() {
        document.addEventListener('keydown', (event) => {
            if (event.ctrlKey || event.metaKey) {
                switch (event.code) {
                    case 'Equal':
                    case 'NumpadAdd':
                        this.zoomIn();
                        event.preventDefault();
                        break;
                    case 'Minus':
                    case 'NumpadSubtract':
                        this.zoomOut();
                        event.preventDefault();
                        break;
                    case 'Digit0':
                    case 'Numpad0':
                        this.resetZoom();
                        event.preventDefault();
                        break;
                }
            }
        });
    }
    
    /**
     * イベントリスナー設定
     */
    setupEventListeners() {
        // キャンバス操作要求
        this.eventStore.on('canvas:zoom', (data) => {
            this.setZoom(data.zoom, data.center);
        });
        
        this.eventStore.on('canvas:pan', (data) => {
            this.pan(data.deltaX, data.deltaY);
        });
        
        this.eventStore.on('canvas:rotate', (data) => {
            this.setRotation(data.rotation);
        });
        
        this.eventStore.on('canvas:center', () => {
            this.centerCanvas();
        });
        
        this.eventStore.on('canvas:fit', () => {
            this.fitToView();
        });
        
        // グリッド制御
        this.eventStore.on('canvas:grid:toggle', () => {
            this.toggleGrid();
        });
        
        this.eventStore.on('canvas:grid:size', (data) => {
            this.setGridSize(data.size);
        });
        
        // キャンバスサイズ変更
        this.eventStore.on('canvas:resize', (data) => {
            this.resizeCanvas(data.width, data.height);
        });
        
        // リサイズ対応
        this.eventStore.on('viewport:resize', (data) => {
            this.handleViewportResize(data.width, data.height);
        });
    }
    
    /**
     * パフォーマンス最適化設定
     */
    setupPerformanceOptimization() {
        if (this.optimization.cullingEnabled) {
            // カリング境界更新
            this.updateCullingBounds();
            
            // 定期最適化
            this.optimizationInterval = setInterval(() => {
                this.performOptimization();
            }, 1000); // 1秒間隔
        }
        
        // LOD（Level of Detail）設定
        if (this.optimization.levelOfDetail) {
            this.setupLevelOfDetail();
        }
    }
    
    /**
     * ホイールズーム処理
     */
    handleWheelZoom(event) {
        event.preventDefault();
        
        const delta = -event.deltaY * this.gestures.zoomSensitivity * 0.01;
        const zoomFactor = Math.exp(delta);
        
        // マウス位置を中心にズーム
        const mousePos = {
            x: event.clientX - this.app.view.offsetLeft,
            y: event.clientY - this.app.view.offsetTop
        };
        
        this.zoomAtPoint(zoomFactor, mousePos);
    }
    
    /**
     * パン開始
     */
    startPan(globalPos) {
        this.isPanning = true;
        this.panStartPos = { x: globalPos.x, y: globalPos.y };
        this.lastPointerPos = { x: globalPos.x, y: globalPos.y };
        
        // スムージング無効化（リアルタイム操作）
        this.smoothing.isAnimating = false;
    }
    
    /**
     * パン更新
     */
    updatePan(globalPos) {
        if (!this.isPanning) return;
        
        const deltaX = (globalPos.x - this.lastPointerPos.x) * this.gestures.panSensitivity;
        const deltaY = (globalPos.y - this.lastPointerPos.y) * this.gestures.panSensitivity;
        
        this.viewport.x += deltaX;
        this.viewport.y += deltaY;
        
        this.updateCanvasTransform();
        this.lastPointerPos = { x: globalPos.x, y: globalPos.y };
        
        // イベント通知
        this.eventStore.emit('canvas:pan:update', {
            x: this.viewport.x,
            y: this.viewport.y,
            deltaX: deltaX,
            deltaY: deltaY
        });
    }
    
    /**
     * パン終了
     */
    endPan() {
        this.isPanning = false;
        
        // イベント通知
        this.eventStore.emit('canvas:pan:end', {
            x: this.viewport.x,
            y: this.viewport.y
        });
    }
    
    /**
     * ズームイン
     */
    zoomIn(factor = 1.25) {
        const center = {
            x: this.app.view.width / 2,
            y: this.app.view.height / 2
        };
        this.zoomAtPoint(factor, center);
    }
    
    /**
     * ズームアウト
     */
    zoomOut(factor = 0.8) {
        const center = {
            x: this.app.view.width / 2,
            y: this.app.view.height / 2
        };
        this.zoomAtPoint(factor, center);
    }
    
    /**
     * 指定点でのズーム
     */
    zoomAtPoint(factor, point) {
        const oldZoom = this.viewport.zoom;
        const newZoom = Math.max(this.viewport.minZoom, 
                               Math.min(this.viewport.maxZoom, oldZoom * factor));
        
        if (newZoom === oldZoom) return;
        
        // ズーム中心計算
        const localPoint = {
            x: (point.x - this.viewport.x) / oldZoom,
            y: (point.y - this.viewport.y) / oldZoom
        };
        
        this.viewport.zoom = newZoom;
        this.viewport.x = point.x - localPoint.x * newZoom;
        this.viewport.y = point.y - localPoint.y * newZoom;
        
        this.updateCanvasTransform();
        
        // イベント通知
        this.eventStore.emit('canvas:zoom:changed', {
            zoom: this.viewport.zoom,
            center: point,
            factor: factor
        });
    }
    
    /**
     * ズーム設定
     */
    setZoom(zoom, center = null) {
        const clampedZoom = Math.max(this.viewport.minZoom, 
                                   Math.min(this.viewport.maxZoom, zoom));
        
        if (center) {
            const factor = clampedZoom / this.viewport.zoom;
            this.zoomAtPoint(factor, center);
        } else {
            this.viewport.zoom = clampedZoom;
            this.updateCanvasTransform();
        }
    }
    
    /**
     * ズームリセット
     */
    resetZoom() {
        this.viewport.zoom = 1.0;
        this.centerCanvas();
    }
    
    /**
     * パン処理
     */
    pan(deltaX, deltaY) {
        this.viewport.x += deltaX;
        this.viewport.y += deltaY;
        this.updateCanvasTransform();
    }
    
    /**
     * 回転設定
     */
    setRotation(rotation) {
        this.viewport.rotation = rotation % (Math.PI * 2);
        this.updateCanvasTransform();
        
        this.eventStore.emit('canvas:rotation:changed', {
            rotation: this.viewport.rotation
        });
    }
    
    /**
     * キャンバス中央配置
     */
    centerCanvas() {
        const viewWidth = this.app.view.width;
        const viewHeight = this.app.view.height;
        
        this.viewport.x = (viewWidth - this.canvasSettings.width * this.viewport.zoom) / 2;
        this.viewport.y = (viewHeight - this.canvasSettings.height * this.viewport.zoom) / 2;
        
        this.updateCanvasTransform();
        
        this.eventStore.emit('canvas:centered', {
            x: this.viewport.x,
            y: this.viewport.y
        });
    }
    
    /**
     * フィットトゥビュー
     */
    fitToView() {
        const viewWidth = this.app.view.width;
        const viewHeight = this.app.view.height;
        const canvasWidth = this.canvasSettings.width;
        const canvasHeight = this.canvasSettings.height;
        
        // アスペクト比を維持してフィット
        const scaleX = (viewWidth * 0.9) / canvasWidth;
        const scaleY = (viewHeight * 0.9) / canvasHeight;
        const scale = Math.min(scaleX, scaleY);
        
        this.viewport.zoom = Math.max(this.viewport.minZoom, 
                                    Math.min(this.viewport.maxZoom, scale));
        
        this.centerCanvas();
        
        this.eventStore.emit('canvas:fitted', {
            zoom: this.viewport.zoom
        });
    }
    
    /**
     * キャンバス変形更新
     */
    updateCanvasTransform() {
        // PixiJS Container変形適用
        this.canvasContainer.x = this.viewport.x;
        this.canvasContainer.y = this.viewport.y;
        this.canvasContainer.scale.set(this.viewport.zoom);
        this.canvasContainer.rotation = this.viewport.rotation;
        
        // カリング境界更新
        this.updateCullingBounds();
        
        // グリッド可視性調整
        this.updateGridVisibility();
    }
    
    /**
     * カリング境界更新
     */
    updateCullingBounds() {
        if (!this.optimization.cullingEnabled) return;
        
        const margin = 100; // 余裕
        const invZoom = 1 / this.viewport.zoom;
        
        this.optimization.cullingBounds.x = (-this.viewport.x - margin) * invZoom;
        this.optimization.cullingBounds.y = (-this.viewport.y - margin) * invZoom;
        this.optimization.cullingBounds.width = (this.app.view.width + margin * 2) * invZoom;
        this.optimization.cullingBounds.height = (this.app.view.height + margin * 2) * invZoom;
    }
    
    /**
     * グリッド可視性更新
     */
    updateGridVisibility() {
        if (!this.canvasGrid) return;
        
        // ズームレベルに応じてグリッド透明度調整
        const zoom = this.viewport.zoom;
        let alpha = this.canvasSettings.gridOpacity;
        
        if (zoom < 0.5) {
            alpha *= zoom * 2; // ズームアウト時に薄く
        } else if (zoom > 2.0) {
            alpha = Math.min(alpha * 1.5, 0.5); // ズームイン時に濃く（上限あり）
        }
        
        this.canvasGrid.alpha = alpha;
        
        // 極端なズームアウト時はグリッド非表示
        this.canvasGrid.visible = zoom > 0.2;
    }
    
    /**
     * Level of Detail設定
     */
    setupLevelOfDetail() {
        this.lodUpdateInterval = setInterval(() => {
            const zoom = this.viewport.zoom;
            let lodLevel = 'high';
            
            if (zoom < this.optimization.lodThresholds.low) {
                lodLevel = 'low';
            } else if (zoom < this.optimization.lodThresholds.medium) {
                lodLevel = 'medium';
            }
            
            this.eventStore.emit('canvas:lod:changed', { level: lodLevel, zoom: zoom });
        }, 200); // 200ms間隔
    }
    
    /**
     * パフォーマンス最適化実行
     */
    performOptimization() {
        if (!this.optimization.cullingEnabled) return;
        
        const bounds = this.optimization.cullingBounds;
        let culledCount = 0;
        
        // 描画オブジェクトの可視性最適化
        const processContainer = (container) => {
            container.children.forEach(child => {
                if (child.getBounds) {
                    const childBounds = child.getBounds();
                    const visible = bounds.intersects(childBounds);
                    
                    if (child.visible !== visible) {
                        child.visible = visible;
                        if (!visible) culledCount++;
                    }
                }
                
                if (child.children && child.children.length > 0) {
                    processContainer(child);
                }
            });
        };
        
        // 描画レイヤーのカリング（他のコンポーネントと連携）
        this.eventStore.emit('canvas:culling:update', {
            bounds: bounds,
            culledCount: culledCount
        });
    }
    
    /**
     * グリッド切り替え
     */
    toggleGrid() {
        this.canvasSettings.gridEnabled = !this.canvasSettings.gridEnabled;
        
        if (this.canvasGrid) {
            this.canvasGrid.visible = this.canvasSettings.gridEnabled;
        }
        
        this.eventStore.emit('canvas:grid:toggled', {
            enabled: this.canvasSettings.gridEnabled
        });
        
        console.log(`📐 グリッド表示: ${this.canvasSettings.gridEnabled ? '有効' : '無効'}`);
    }
    
    /**
     * グリッドサイズ設定
     */
    setGridSize(size) {
        this.canvasSettings.gridSize = Math.max(8, Math.min(128, size));
        
        // グリッド再生成
        this.gridContainer.removeChildren();
        this.createGrid();
        
        this.eventStore.emit('canvas:grid:size:changed', {
            size: this.canvasSettings.gridSize
        });
        
        console.log(`📐 グリッドサイズ変更: ${this.canvasSettings.gridSize}px`);
    }
    
    /**
     * キャンバスサイズ変更
     */
    resizeCanvas(width, height) {
        this.canvasSettings.width = Math.max(100, width);
        this.canvasSettings.height = Math.max(100, height);
        
        // 背景・グリッド再生成
        this.backgroundContainer.removeChildren();
        this.gridContainer.removeChildren();
        
        this.createCanvasBackground();
        this.createGrid();
        
        this.eventStore.emit('canvas:resized', {
            width: this.canvasSettings.width,
            height: this.canvasSettings.height
        });
        
        console.log(`🖼️ キャンバスサイズ変更: ${width}x${height}`);
    }
    
    /**
     * ビューポートリサイズ処理
     */
    handleViewportResize(width, height) {
        // hitArea更新
        this.app.stage.hitArea = new PIXI.Rectangle(0, 0, width, height);
        
        // カリング境界更新
        this.updateCullingBounds();
        
        console.log(`🖥️ ビューポートリサイズ: ${width}x${height}`);
    }
    
    /**
     * 画面座標をキャンバス座標に変換
     */
    screenToCanvas(screenX, screenY) {
        const invZoom = 1 / this.viewport.zoom;
        const canvasX = (screenX - this.viewport.x) * invZoom;
        const canvasY = (screenY - this.viewport.y) * invZoom;
        
        // 回転適用（必要に応じて）
        if (this.viewport.rotation !== 0) {
            const cos = Math.cos(-this.viewport.rotation);
            const sin = Math.sin(-this.viewport.rotation);
            const cx = this.canvasSettings.width / 2;
            const cy = this.canvasSettings.height / 2;
            
            const relX = canvasX - cx;
            const relY = canvasY - cy;
            
            return {
                x: cx + (relX * cos - relY * sin),
                y: cy + (relX * sin + relY * cos)
            };
        }
        
        return { x: canvasX, y: canvasY };
    }
    
    /**
     * キャンバス座標を画面座標に変換
     */
    canvasToScreen(canvasX, canvasY) {
        // 回転適用（必要に応じて）
        let x = canvasX;
        let y = canvasY;
        
        if (this.viewport.rotation !== 0) {
            const cos = Math.cos(this.viewport.rotation);
            const sin = Math.sin(this.viewport.rotation);
            const cx = this.canvasSettings.width / 2;
            const cy = this.canvasSettings.height / 2;
            
            const relX = canvasX - cx;
            const relY = canvasY - cy;
            
            x = cx + (relX * cos - relY * sin);
            y = cy + (relX * sin + relY * cos);
        }
        
        return {
            x: x * this.viewport.zoom + this.viewport.x,
            y: y * this.viewport.zoom + this.viewport.y
        };
    }
    
    /**
     * グリッドスナップ
     */
    snapToGrid(x, y) {
        if (!this.canvasSettings.snapToGrid) {
            return { x, y };
        }
        
        const gridSize = this.canvasSettings.gridSize;
        return {
            x: Math.round(x / gridSize) * gridSize,
            y: Math.round(y / gridSize) * gridSize
        };
    }
    
    /**
     * 可視領域取得
     */
    getVisibleBounds() {
        return {
            x: this.optimization.cullingBounds.x,
            y: this.optimization.cullingBounds.y,
            width: this.optimization.cullingBounds.width,
            height: this.optimization.cullingBounds.height
        };
    }
    
    /**
     * キャンバス設定取得
     */
    getSettings() {
        return {
            canvas: { ...this.canvasSettings },
            viewport: { ...this.viewport },
            optimization: { ...this.optimization },
            gestures: { ...this.gestures }
        };
    }
    
    /**
     * キャンバス設定読み込み
     */
    loadSettings(settings) {
        if (settings.canvas) {
            Object.assign(this.canvasSettings, settings.canvas);
        }
        
        if (settings.viewport) {
            Object.assign(this.viewport, settings.viewport);
            this.updateCanvasTransform();
        }
        
        if (settings.optimization) {
            Object.assign(this.optimization, settings.optimization);
        }
        
        if (settings.gestures) {
            Object.assign(this.gestures, settings.gestures);
        }
        
        // UI要素再生成
        this.backgroundContainer.removeChildren();
        this.gridContainer.removeChildren();
        this.createCanvasBackground();
        this.createGrid();
        
        console.log('🛠️ キャンバス設定読み込み完了');
    }
    
    /**
     * キャンバス情報取得
     */
    getInfo() {
        return {
            canvas: {
                width: this.canvasSettings.width,
                height: this.canvasSettings.height,
                backgroundColor: this.canvasSettings.backgroundColor
            },
            viewport: {
                x: this.viewport.x,
                y: this.viewport.y,
                zoom: this.viewport.zoom,
                rotation: this.viewport.rotation
            },
            state: {
                isPanning: this.isPanning,
                isRotating: this.isRotating,
                gridEnabled: this.canvasSettings.gridEnabled,
                snapToGrid: this.canvasSettings.snapToGrid
            },
            performance: {
                cullingEnabled: this.optimization.cullingEnabled,
                lodEnabled: this.optimization.levelOfDetail
            }
        };
    }
    
    /**
     * パフォーマンス情報取得
     */
    getPerformanceInfo() {
        return {
            cullingBounds: {
                x: this.optimization.cullingBounds.x,
                y: this.optimization.cullingBounds.y,
                width: this.optimization.cullingBounds.width,
                height: this.optimization.cullingBounds.height
            },
            currentZoom: this.viewport.zoom,
            gridVisible: this.canvasGrid ? this.canvasGrid.visible : false,
            containerChildren: this.canvasContainer.children.length,
            memoryUsage: this.estimateMemoryUsage()
        };
    }
    
    /**
     * メモリ使用量推定
     */
    estimateMemoryUsage() {
        let textureMemory = 0;
        let vertexMemory = 0;
        
        const estimateContainer = (container) => {
            container.children.forEach(child => {
                if (child instanceof PIXI.Graphics) {
                    vertexMemory += child.geometry?.graphicsData?.length * 8 || 0;
                } else if (child instanceof PIXI.Sprite && child.texture) {
                    const texture = child.texture;
                    if (texture.baseTexture) {
                        textureMemory += texture.baseTexture.width * texture.baseTexture.height * 4;
                    }
                }
                
                if (child.children && child.children.length > 0) {
                    estimateContainer(child);
                }
            });
        };
        
        estimateContainer(this.canvasContainer);
        
        return {
            textureMemory: Math.round(textureMemory / 1024), // KB
            vertexMemory: Math.round(vertexMemory / 1024), // KB
            total: Math.round((textureMemory + vertexMemory) / 1024) // KB
        };
    }
    
    /**
     * デバッグ情報表示
     */
    debugInfo() {
        const info = this.getInfo();
        const performance = this.getPerformanceInfo();
        
        console.group('🖼️ CanvasController デバッグ情報');
        console.log('キャンバス:', info.canvas);
        console.log('ビューポート:', info.viewport);
        console.log('状態:', info.state);
        console.log('パフォーマンス:', performance);
        console.groupEnd();
        
        return { info, performance };
    }
    
    /**
     * 準備状態確認
     */
    isReady() {
        return !!(this.canvasContainer && this.backgroundContainer && this.gridContainer);
    }
    
    /**
     * 破棄処理
     */
    destroy() {
        try {
            // インターバル停止
            if (this.optimizationInterval) {
                clearInterval(this.optimizationInterval);
            }
            
            if (this.lodUpdateInterval) {
                clearInterval(this.lodUpdateInterval);
            }
            
            // イベントリ