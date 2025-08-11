/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1rev12
 * アプリケーションコア - app-core.js（Phase2: デフォルト値変更版）
 * 
 * 🔧 v1rev5b修正内容（Phase2: デフォルト値変更）:
 * 1. ✅ DEFAULT_BRUSH_SIZE: 16 → 4 に変更
 * 2. ✅ DEFAULT_OPACITY: 0.85 → 1.0 (100%) に変更
 * 3. ✅ ペンサイズ最大値: 100 → 500 に変更（updateBrushSettings対応）
 * 
 * 責務: PixiJSアプリ生成・描画ループ管理・リソースロード・設定連携
 * 依存: PIXI.js v7, settings-manager.js
 * 
 * Phase2目標: デフォルト値の仕様変更に対応
 */

// ==== 動的設定定数（Phase2: デフォルト値変更版）====
const CONFIG = {
    // キャンバス設定
    CANVAS_WIDTH: 400,
    CANVAS_HEIGHT: 400,
    BG_COLOR: 0xf0e0d6,
    
    // 🆕 Phase2: 描画設定のデフォルト値変更
    DEFAULT_BRUSH_SIZE: 4.0,         // 16.0 → 4.0 に変更
    DEFAULT_BRUSH_COLOR: 0x800000,
    DEFAULT_OPACITY: 1.0,            // 0.85 → 1.0 (100%) に変更
    DEFAULT_PRESSURE: 0.5,
    DEFAULT_SMOOTHING: 0.3,
    
    // 🆕 Phase2: ペンサイズ範囲拡張
    MIN_BRUSH_SIZE: 0.1,
    MAX_BRUSH_SIZE: 500,             // 100 → 500 に変更
    
    // パフォーマンス設定（動的取得）
    ANTIALIAS: true,
    get RESOLUTION() {
        // SettingsManager が利用可能な場合は設定から取得
        if (window.settingsManager && window.settingsManager.isInitialized) {
            return window.settingsManager.isHighDpiEnabled() ? 
                (window.devicePixelRatio || 1) : 1;
        }
        // フォールバック: 初期化前は低DPI
        return 1;
    },
    get AUTO_DENSITY() {
        if (window.settingsManager && window.settingsManager.isInitialized) {
            return window.settingsManager.isHighDpiEnabled();
        }
        return false;
    },
    
    // 描画最適化
    MIN_DISTANCE_FILTER: 1.5,
    BRUSH_STEPS_MULTIPLIER: 1.5
};

// ==== イベント定数（拡張版） ====
const EVENTS = {
    POINTER_DOWN: 'pointerdown',
    POINTER_MOVE: 'pointermove',
    POINTER_UP: 'pointerup',
    POINTER_UP_OUTSIDE: 'pointerupoutside',
    
    // カスタムイベント
    CANVAS_READY: 'canvas:ready',
    TOOL_CHANGED: 'tool:changed',
    DRAWING_START: 'drawing:start',
    DRAWING_END: 'drawing:end',
    
    // 設定関連イベント（新規追加）
    SETTINGS_APPLIED: 'settings:applied',
    HIGH_DPI_CHANGED: 'highDpi:changed',
    APP_REINITIALIZED: 'app:reinitialized',
    
    // 🆕 Phase2: ブラシ設定変更イベント
    BRUSH_SIZE_CHANGED: 'brush:sizeChanged',
    BRUSH_OPACITY_CHANGED: 'brush:opacityChanged'
};

// ==== メインアプリケーションクラス（Phase2デフォルト値変更版） ====
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
        
        // 🆕 Phase2: 描画状態のデフォルト値変更
        this.state = {
            currentTool: 'pen',
            brushSize: CONFIG.DEFAULT_BRUSH_SIZE,        // 4.0
            brushColor: CONFIG.DEFAULT_BRUSH_COLOR,
            opacity: CONFIG.DEFAULT_OPACITY,            // 1.0 (100%)
            pressure: CONFIG.DEFAULT_PRESSURE,
            smoothing: CONFIG.DEFAULT_SMOOTHING,
            isDrawing: false,
            currentPath: null
        };
        
        // 描画データ
        this.paths = [];
        this.currentPathId = 0;
        
        // 設定関連（新規追加）
        this.settingsManager = null;
        this.lastHighDpiState = false;
        
        // イベントエミッター（簡易実装）
        this.eventHandlers = new Map();
    }
    
    // ==== 初期化（設定連携版） ====
    async init(settingsManager = null) {
        try {
            console.log('🎯 PixiDrawingApp初期化開始（v1rev5b Phase2デフォルト値変更版）...');
            
            // SettingsManager の登録
            if (settingsManager) {
                this.settingsManager = settingsManager;
                this.setupSettingsEventListeners();
            }
            
            await this.createApplication();
            this.setupLayers();
            this.setupInteraction();
            this.setupResizeHandler();
            
            console.log('✅ PixiDrawingApp初期化完了（v1rev5b Phase2）');
            console.log('🔧 Phase2修正項目:');
            console.log(`  - デフォルトブラシサイズ: 16 → ${CONFIG.DEFAULT_BRUSH_SIZE}`);
            console.log(`  - デフォルト透明度: 85% → ${CONFIG.DEFAULT_OPACITY * 100}%`);
            console.log(`  - 最大ブラシサイズ: 100 → ${CONFIG.MAX_BRUSH_SIZE}`);
            
            this.emit(EVENTS.CANVAS_READY, { app: this.app, layers: this.layers });
            
            return this.app;
            
        } catch (error) {
            console.error('❌ PixiDrawingApp初期化エラー:', error);
            throw error;
        }
    }
    
    // ==== 設定イベントリスナー設定 ====
    setupSettingsEventListeners() {
        if (!this.settingsManager) return;
        
        // 高DPI設定変更の監視
        this.settingsManager.on(SETTINGS_EVENTS.HIGH_DPI_CHANGED || 'settings:highDpiChanged', (event) => {
            console.log('🖥️ 高DPI設定変更検知:', event.enabled);
            this.handleHighDpiChange(event.enabled);
        });
        
        // その他の設定変更監視（将来拡張用）
        this.settingsManager.on(SETTINGS_EVENTS.SETTING_CHANGED || 'settings:changed', (event) => {
            this.handleSettingChange(event.key, event.value);
        });
    }
    
    // ==== アプリケーション作成（設定対応版） ====
    async createApplication() {
        // 現在の設定から解像度とautoDensityを取得
        const resolution = CONFIG.RESOLUTION;
        const autoDensity = CONFIG.AUTO_DENSITY;
        
        console.log(`📱 PixiJSアプリケーション作成: 解像度${resolution}, autoDensity=${autoDensity}`);
        
        // PIXI.js v7の正しい初期化
        this.app = new PIXI.Application({
            width: this.width,
            height: this.height,
            backgroundColor: CONFIG.BG_COLOR,
            antialias: CONFIG.ANTIALIAS,
            resolution: resolution,
            autoDensity: autoDensity
        });
        
        // 現在の高DPI状態を記録
        this.lastHighDpiState = autoDensity;
        
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
    
    // ==== 高DPI設定変更処理（新規追加） ====
    async handleHighDpiChange(enabled) {
        try {
            console.log(`🔄 高DPI設定変更: ${enabled ? 'ON' : 'OFF'}`);
            
            // 現在の描画状態をキャプチャ
            const drawingState = this.captureDrawingState();
            
            // アプリケーションを再初期化
            await this.reinitializeWithHighDpi(enabled);
            
            // 描画状態を復元
            if (drawingState) {
                this.restoreDrawingState(drawingState);
            }
            
            this.lastHighDpiState = enabled;
            this.emit(EVENTS.HIGH_DPI_CHANGED, { enabled });
            
            console.log('✅ 高DPI設定変更完了');
            
        } catch (error) {
            console.error('❌ 高DPI設定変更エラー:', error);
            throw error;
        }
    }
    
    // ==== アプリケーション再初期化（新規追加） ====
    async reinitializeWithHighDpi(highDpiEnabled) {
        try {
            console.log('🔄 PixiJSアプリケーション再初期化開始...');
            
            const canvasContainer = document.getElementById('drawing-canvas');
            if (!canvasContainer) {
                throw new Error('drawing-canvas要素が見つかりません');
            }
            
            // 既存アプリケーションの破棄
            if (this.app) {
                canvasContainer.removeChild(this.app.view);
                this.app.destroy(true, { children: true, texture: false });
            }
            
            // 新しい解像度設定で再作成
            const resolution = highDpiEnabled ? (window.devicePixelRatio || 1) : 1;
            const autoDensity = highDpiEnabled;
            
            this.app = new PIXI.Application({
                width: this.width,
                height: this.height,
                backgroundColor: CONFIG.BG_COLOR,
                antialias: CONFIG.ANTIALIAS,
                resolution: resolution,
                autoDensity: autoDensity
            });
            
            // DOM要素を再配置
            canvasContainer.appendChild(this.app.view);
            
            // レイヤー構造とインタラクションを再構築
            this.setupLayers();
            this.setupInteraction();
            
            this.emit(EVENTS.APP_REINITIALIZED, { 
                resolution, 
                autoDensity, 
                highDpiEnabled 
            });
            
            console.log(`✅ PixiJSアプリケーション再初期化完了 (解像度: ${resolution})`);
            
        } catch (error) {
            console.error('❌ PixiJSアプリケーション再初期化エラー:', error);
            throw error;
        }
    }
    
    // ==== 描画状態のキャプチャ・復元（新規追加） ====
    captureDrawingState() {
        try {
            if (!this.layers || !this.layers.drawingLayer) return null;
            
            // パスデータと描画内容をキャプチャ
            const pathsData = this.paths.map(path => ({
                id: path.id,
                color: path.color,
                size: path.size,
                opacity: path.opacity,
                tool: path.tool,
                points: [...path.points],
                isComplete: path.isComplete,
                timestamp: path.timestamp
            }));
            
            return {
                paths: pathsData,
                currentPathId: this.currentPathId,
                state: { ...this.state },
                timestamp: Date.now()
            };
            
        } catch (error) {
            console.warn('⚠️ 描画状態キャプチャエラー:', error);
            return null;
        }
    }
    
    restoreDrawingState(drawingState) {
        try {
            if (!drawingState || !this.layers) return false;
            
            // レイヤーをクリア
            this.layers.drawingLayer.removeChildren();
            
            // パスを復元
            this.paths = [];
            this.currentPathId = drawingState.currentPathId || 0;
            
            drawingState.paths.forEach(pathData => {
                const graphics = new PIXI.Graphics();
                
                // ポイントから描画を再現
                pathData.points.forEach((point, index) => {
                    if (index === 0) {
                        // 最初の点
                        this.drawCircle(graphics, point.x, point.y, pathData.size / 2, pathData.color, pathData.opacity);
                    } else {
                        // 線の描画
                        const prevPoint = pathData.points[index - 1];
                        const distance = this.calculateDistance(point.x, point.y, prevPoint.x, prevPoint.y);
                        const steps = Math.max(1, Math.ceil(distance / CONFIG.BRUSH_STEPS_MULTIPLIER));
                        
                        for (let i = 1; i <= steps; i++) {
                            const t = i / steps;
                            const px = prevPoint.x + (point.x - prevPoint.x) * t;
                            const py = prevPoint.y + (point.y - prevPoint.y) * t;
                            this.drawCircle(graphics, px, py, pathData.size / 2, pathData.color, pathData.opacity);
                        }
                    }
                });
                
                // パスオブジェクトを復元
                const restoredPath = {
                    ...pathData,
                    graphics: graphics
                };
                
                this.layers.drawingLayer.addChild(graphics);
                this.paths.push(restoredPath);
            });
            
            // 状態を復元
            if (drawingState.state) {
                this.state = { ...this.state, ...drawingState.state };
                this.state.currentPath = null; // 描画中状態はリセット
                this.state.isDrawing = false;
            }
            
            console.log(`✅ 描画状態復元完了: ${this.paths.length}個のパス`);
            return true;
            
        } catch (error) {
            console.error('❌ 描画状態復元エラー:', error);
            return false;
        }
    }
    
    // ==== 設定変更処理（新規追加） ====
    handleSettingChange(key, value) {
        // 将来的に他の設定変更に対応
        switch (key) {
            case 'highDpi':
                // 既に handleHighDpiChange で処理される
                break;
            default:
                console.log(`⚙️ 設定変更: ${key} = ${value}`);
                break;
        }
    }
    
    // ==== 描画API（変更なし） ====
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
    
    // ==== 描画ユーティリティ（変更なし） ====
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
    
    // ==== 座標変換（変更なし） ====
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
    
    // ==== 🆕 Phase2: 状態管理の拡張版 ====
    updateState(updates) {
        const oldState = { ...this.state };
        Object.assign(this.state, updates);
        
        // 🆕 Phase2: 個別の変更イベント発火
        if ('brushSize' in updates && updates.brushSize !== oldState.brushSize) {
            this.emit(EVENTS.BRUSH_SIZE_CHANGED, { 
                oldSize: oldState.brushSize, 
                newSize: updates.brushSize 
            });
        }
        
        if ('opacity' in updates && updates.opacity !== oldState.opacity) {
            this.emit(EVENTS.BRUSH_OPACITY_CHANGED, { 
                oldOpacity: oldState.opacity, 
                newOpacity: updates.opacity 
            });
        }
        
        this.emit(EVENTS.TOOL_CHANGED, { state: this.state, oldState });
    }
    
    getState() {
        return { ...this.state };
    }
    
    // ==== キャンバス操作（変更なし） ====
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
    
    // ==== 設定連携メソッド（新規追加） ====
    setSettingsManager(settingsManager) {
        this.settingsManager = settingsManager;
        this.setupSettingsEventListeners();
        console.log('⚙️ SettingsManager連携完了');
    }
    
    getCurrentResolution() {
        return this.app ? this.app.renderer.resolution : 1;
    }
    
    isHighDpiActive() {
        return this.lastHighDpiState;
    }
    
    // ==== イベントシステム（変更なし） ====
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
    
    // ==== デバッグ・統計情報（Phase2拡張版） ====
    getStats() {
        return {
            width: this.width,
            height: this.height,
            pathCount: this.paths.length,
            isInitialized: this.app !== null,
            isDrawing: this.state.isDrawing,
            currentTool: this.state.currentTool,
            resolution: this.getCurrentResolution(),
            isHighDpi: this.isHighDpiActive(),
            hasSettingsManager: !!this.settingsManager,
            memoryUsage: this.getMemoryUsage(),
            // 🆕 Phase2: ブラシ設定の詳細統計
            brushSettings: {
                size: this.state.brushSize,
                opacity: this.state.opacity,
                color: this.state.brushColor,
                pressure: this.state.pressure,
                smoothing: this.state.smoothing,
                sizeRange: {
                    min: CONFIG.MIN_BRUSH_SIZE,
                    max: CONFIG.MAX_BRUSH_SIZE,
                    default: CONFIG.DEFAULT_BRUSH_SIZE
                },
                opacityRange: {
                    min: 0,
                    max: 1,
                    default: CONFIG.DEFAULT_OPACITY
                }
            }
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
    
    // ==== クリーンアップ（拡張版） ====
    destroy() {
        if (this.app) {
            this.clear();
            this.app.destroy(true, { children: true, texture: true });
            this.app = null;
        }
        
        this.eventHandlers.clear();
        this.settingsManager = null;
        
        console.log('PixiDrawingApp destroyed');
    }
}

// ==== エクスポート ====
if (typeof window !== 'undefined') {
    window.PixiDrawingApp = PixiDrawingApp;
    window.CONFIG = CONFIG;
    window.EVENTS = EVENTS;
    
    console.log('🎯 app-core.js v1rev5b 読み込み完了（Phase2: デフォルト値変更版）');
    console.log('🔧 Phase2修正項目:');
    console.log(`  ✅ デフォルトブラシサイズ: 16 → ${CONFIG.DEFAULT_BRUSH_SIZE}`);
    console.log(`  ✅ デフォルト透明度: 85% → ${CONFIG.DEFAULT_OPACITY * 100}%`);
    console.log(`  ✅ ペンサイズ最大値: 100 → ${CONFIG.MAX_BRUSH_SIZE}`);
    console.log(`  ✅ ブラシ設定変更イベント追加（BRUSH_SIZE_CHANGED, BRUSH_OPACITY_CHANGED）`);
    console.log('🎨 新仕様:');
    console.log(`  - ペンサイズ範囲: ${CONFIG.MIN_BRUSH_SIZE} ～ ${CONFIG.MAX_BRUSH_SIZE}px`);
    console.log(`  - デフォルト透明度: ${CONFIG.DEFAULT_OPACITY * 100}%（不透明）`);
}

// ES6 module export (将来のTypeScript移行用)
// export { PixiDrawingApp, CONFIG, EVENTS };