/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1.2
 * アプリケーションコア - app-core.js
 * 
 * 責務: PixiJSアプリ生成・描画ループ管理・リソースロード
 * 依存: PIXI.js v7
 */

// ==== 設定定数 ====
const CONFIG = {
    // キャンバス設定
    CANVAS_WIDTH: 400,
    CANVAS_HEIGHT: 400,
    BG_COLOR: 0xf0e0d6,
    
    // 描画設定
    DEFAULT_BRUSH_SIZE: 16.0,
    DEFAULT_BRUSH_COLOR: 0x800000,
    DEFAULT_OPACITY: 0.85,
    DEFAULT_PRESSURE: 0.5,
    DEFAULT_SMOOTHING: 0.3,
    
    // パフォーマンス設定
    ANTIALIAS: true,
    RESOLUTION: 1,
    AUTO_DENSITY: false,
    
    // 描画最適化
    MIN_DISTANCE_FILTER: 1.5,
    BRUSH_STEPS_MULTIPLIER: 1.5
};

// ==== イベント定数 ====
const EVENTS = {
    POINTER_DOWN: 'pointerdown',
    POINTER_MOVE: 'pointermove',
    POINTER_UP: 'pointerup',
    POINTER_UP_OUTSIDE: 'pointerupoutside',
    
    // カスタムイベント
    CANVAS_READY: 'canvas:ready',
    TOOL_CHANGED: 'tool:changed',
    DRAWING_START: 'drawing:start',
    DRAWING_END: 'drawing:end'
};

// ==== メインアプリケーションクラス ====
class PixiDrawingApp {
    constructor(width = CONFIG.CANVAS_WIDTH, height = CONFIG.CANVAS_HEIGHT) {
        this.width = width;
        this.height = height;
        this.app = null;
        
        // レイヤー構造
        this.layers = {
            backgroundLayer: null,
            drawingLayer: null,
            uiLayer: null
        };
        
        // 描画状態
        this.state = {
            currentTool: 'pen',
            brushSize: CONFIG.DEFAULT_BRUSH_SIZE,
            brushColor: CONFIG.DEFAULT_BRUSH_COLOR,
            opacity: CONFIG.DEFAULT_OPACITY,
            pressure: CONFIG.DEFAULT_PRESSURE,
            smoothing: CONFIG.DEFAULT_SMOOTHING,
            isDrawing: false,
            currentPath: null
        };
        
        // 描画データ
        this.paths = [];
        this.currentPathId = 0;
        
        // イベントエミッター（簡易実装）
        this.eventHandlers = new Map();
    }
    
    // ==== 初期化 ====
    async init() {
        try {
            console.log('🎯 PixiDrawingApp初期化開始...');
            
            await this.createApplication();
            this.setupLayers();
            this.setupInteraction();
            this.setupResizeHandler();
            
            console.log('✅ PixiDrawingApp初期化完了');
            this.emit(EVENTS.CANVAS_READY, { app: this.app, layers: this.layers });
            
            return this.app;
            
        } catch (error) {
            console.error('❌ PixiDrawingApp初期化エラー:', error);
            throw error;
        }
    }
    
    async createApplication() {
        // PIXI.js v7の正しい初期化
        this.app = new PIXI.Application({
            width: this.width,
            height: this.height,
            backgroundColor: CONFIG.BG_COLOR,
            antialias: CONFIG.ANTIALIAS,
            resolution: CONFIG.RESOLUTION,
            autoDensity: CONFIG.AUTO_DENSITY
        });
        
        // キャンバス要素をDOMに追加
        const canvasContainer = document.getElementById('drawing-canvas');
        if (!canvasContainer) {
            throw new Error('drawing-canvas要素が見つかりません');
        }
        
        canvasContainer.appendChild(this.app.view);
    }
    
    setupLayers() {
        // レイヤー構造の作成
        this.layers.backgroundLayer = new PIXI.Container();
        this.layers.drawingLayer = new PIXI.Container();
        this.layers.uiLayer = new PIXI.Container();
        
        // ステージに追加（Z-order重要）
        this.app.stage.addChild(this.layers.backgroundLayer);
        this.app.stage.addChild(this.layers.drawingLayer);
        this.app.stage.addChild(this.layers.uiLayer);
        
        console.log('✅ レイヤー構造構築完了');
    }
    
    setupInteraction() {
        // PIXI.js v7のイベント設定
        this.app.stage.eventMode = 'static';
        this.app.stage.hitArea = new PIXI.Rectangle(0, 0, this.width, this.height);
        
        // 描画レイヤーにイベントリスナーを設定
        this.layers.drawingLayer.eventMode = 'static';
        this.layers.drawingLayer.hitArea = new PIXI.Rectangle(0, 0, this.width, this.height);
        
        console.log('✅ インタラクション設定完了');
    }
    
    setupResizeHandler() {
        // リサイズ処理（UI側から呼び出される）
        window.addEventListener('resize', () => {
            // 必要に応じて実装
        });
    }
    
    // ==== 描画API ====
    createPath(x, y, tool = null) {
        const currentTool = tool || this.state.currentTool;
        const pathId = this.generatePathId();
        
        const path = {
            id: pathId,
            graphics: new PIXI.Graphics(),
            points: [],
            color: currentTool === 'eraser' ? CONFIG.BG_COLOR : this.state.brushColor,
            size: this.state.brushSize,
            opacity: currentTool === 'eraser' ? 1.0 : this.state.opacity,
            tool: currentTool,
            isComplete: false,
            timestamp: Date.now()
        };
        
        // 初回描画: 円形ブラシで点を描画
        this.drawCircle(path.graphics, x, y, path.size / 2, path.color, path.opacity);
        path.points.push({ x, y, size: path.size });
        
        // 描画レイヤーに追加
        this.layers.drawingLayer.addChild(path.graphics);
        this.paths.push(path);
        
        this.state.currentPath = path;
        this.state.isDrawing = true;
        
        this.emit(EVENTS.DRAWING_START, { path });
        
        return path;
    }
    
    extendPath(path, x, y) {
        if (!path || path.points.length === 0) return;
        
        const lastPoint = path.points[path.points.length - 1];
        const distance = this.calculateDistance(x, y, lastPoint.x, lastPoint.y);
        
        // 最小距離フィルタ
        if (distance < CONFIG.MIN_DISTANCE_FILTER) return;
        
        // 連続する円形で線を描画
        const steps = Math.max(1, Math.ceil(distance / CONFIG.BRUSH_STEPS_MULTIPLIER));
        for (let i = 1; i <= steps; i++) {
            const t = i / steps;
            const px = lastPoint.x + (x - lastPoint.x) * t;
            const py = lastPoint.y + (y - lastPoint.y) * t;
            
            this.drawCircle(path.graphics, px, py, path.size / 2, path.color, path.opacity);
        }
        
        path.points.push({ x, y, size: path.size });
    }
    
    finalizePath(path) {
        if (!path) return;
        
        path.isComplete = true;
        this.state.currentPath = null;
        this.state.isDrawing = false;
        
        this.emit(EVENTS.DRAWING_END, { path });
    }
    
    // ==== 描画ユーティリティ ====
    drawCircle(graphics, x, y, radius, color, opacity) {
        graphics.beginFill(color, opacity);
        graphics.drawCircle(x, y, radius);
        graphics.endFill();
    }
    
    calculateDistance(x1, y1, x2, y2) {
        return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
    }
    
    generatePathId() {
        return `path_${Date.now()}_${(++this.currentPathId).toString(36)}`;
    }
    
    // ==== 座標変換 ====
    getLocalPointerPosition(event) {
        try {
            const rect = this.app.view.getBoundingClientRect();
            const originalEvent = event.data?.originalEvent || event;
            
            const x = (originalEvent.clientX - rect.left) * (this.width / rect.width);
            const y = (originalEvent.clientY - rect.top) * (this.height / rect.height);
            
            return { x, y };
        } catch (error) {
            console.warn('座標取得エラー:', error);
            return { x: 0, y: 0 };
        }
    }
    
    // ==== 状態管理 ====
    updateState(updates) {
        Object.assign(this.state, updates);
        this.emit(EVENTS.TOOL_CHANGED, { state: this.state });
    }
    
    getState() {
        return { ...this.state };
    }
    
    // ==== キャンバス操作 ====
    resize(newWidth, newHeight, centerContent = false) {
        const oldWidth = this.width;
        const oldHeight = this.height;
        
        this.width = newWidth;
        this.height = newHeight;
        
        this.app.renderer.resize(newWidth, newHeight);
        this.app.stage.hitArea = new PIXI.Rectangle(0, 0, newWidth, newHeight);
        this.layers.drawingLayer.hitArea = new PIXI.Rectangle(0, 0, newWidth, newHeight);
        
        if (centerContent && this.paths.length > 0) {
            const offsetX = (newWidth - oldWidth) / 2;
            const offsetY = (newHeight - oldHeight) / 2;
            
            this.paths.forEach(path => {
                if (path.graphics) {
                    path.graphics.x += offsetX;
                    path.graphics.y += offsetY;
                }
            });
        }
        
        console.log(`Canvas resized to ${newWidth}x${newHeight}px`);
    }
    
    clear() {
        this.paths.forEach(path => {
            if (path.graphics && path.graphics.parent) {
                this.layers.drawingLayer.removeChild(path.graphics);
                path.graphics.destroy();
            }
        });
        this.paths = [];
        this.state.currentPath = null;
        this.state.isDrawing = false;
        
        console.log('Canvas cleared');
    }
    
    // ==== イベントシステム（簡易実装） ====
    on(eventName, handler) {
        if (!this.eventHandlers.has(eventName)) {
            this.eventHandlers.set(eventName, []);
        }
        this.eventHandlers.get(eventName).push(handler);
    }
    
    emit(eventName, data = {}) {
        const handlers = this.eventHandlers.get(eventName);
        if (handlers) {
            handlers.forEach(handler => {
                try {
                    handler(data);
                } catch (error) {
                    console.error(`イベントハンドラーエラー (${eventName}):`, error);
                }
            });
        }
    }
    
    // ==== デバッグ・統計情報 ====
    getStats() {
        return {
            width: this.width,
            height: this.height,
            pathCount: this.paths.length,
            isInitialized: this.app !== null,
            isDrawing: this.state.isDrawing,
            currentTool: this.state.currentTool,
            memoryUsage: this.getMemoryUsage()
        };
    }
    
    getMemoryUsage() {
        // 簡易メモリ使用量計算
        const pathMemory = this.paths.reduce((total, path) => {
            return total + (path.points ? path.points.length * 12 : 0); // x,y,size = 12 bytes
        }, 0);
        
        return {
            pathCount: this.paths.length,
            pathMemoryBytes: pathMemory,
            pathMemoryKB: Math.round(pathMemory / 1024 * 100) / 100
        };
    }
    
    // ==== クリーンアップ ====
    destroy() {
        if (this.app) {
            this.clear();
            this.app.destroy(true, { children: true, texture: true });
            this.app = null;
        }
        
        this.eventHandlers.clear();
        console.log('PixiDrawingApp destroyed');
    }
}

// ==== エクスポート ====
if (typeof window !== 'undefined') {
    window.PixiDrawingApp = PixiDrawingApp;
    window.CONFIG = CONFIG;
    window.EVENTS = EVENTS;
}

// ES6 module export (将来のTypeScript移行用)
// export { PixiDrawingApp, CONFIG, EVENTS };