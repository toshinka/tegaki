/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v0.9
 * プレビュー改善版 - 統合JavaScript
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

// ==== ペンツールクラス ====
class VectorPenTool {
    constructor(app) {
        this.name = 'pen';
        this.app = app;
        this.isActive = false;
        this.currentPath = null;
        this.lastPoint = null;
        this.smoothingBuffer = [];
        this.maxBufferSize = 5;
    }
    
    activate() {
        this.isActive = true;
        console.log('🖊️ ベクターペンツール アクティブ');
        this.app.updateState({ currentTool: 'pen' });
        this.setupEventListeners();
    }
    
    deactivate() {
        this.isActive = false;
        this.cleanup();
    }
    
    setupEventListeners() {
        const drawingLayer = this.app.layers.drawingLayer;
        
        drawingLayer.on(EVENTS.POINTER_DOWN, (event) => {
            if (!this.isActive) return;
            const point = this.app.getLocalPointerPosition(event);
            this.onPointerDown(point.x, point.y, event);
        });
        
        drawingLayer.on(EVENTS.POINTER_MOVE, (event) => {
            if (!this.isActive) return;
            const point = this.app.getLocalPointerPosition(event);
            this.onPointerMove(point.x, point.y, event);
        });
        
        drawingLayer.on(EVENTS.POINTER_UP, (event) => {
            if (!this.isActive) return;
            const point = this.app.getLocalPointerPosition(event);
            this.onPointerUp(point.x, point.y, event);
        });
        
        drawingLayer.on(EVENTS.POINTER_UP_OUTSIDE, (event) => {
            if (!this.isActive) return;
            this.onPointerUp(0, 0, event);
        });
    }
    
    onPointerDown(x, y, event) {
        this.currentPath = this.app.createPath(x, y, 'pen');
        this.lastPoint = { x, y };
        this.smoothingBuffer = [{ x, y }];
        
        console.log(`ペン開始: (${x.toFixed(1)}, ${y.toFixed(1)})`);
    }
    
    onPointerMove(x, y, event) {
        if (!this.currentPath || !this.app.state.isDrawing) return;
        
        // 線補正処理
        const smoothedPoint = this.applySmoothingFilter(x, y);
        
        this.app.extendPath(this.currentPath, smoothedPoint.x, smoothedPoint.y);
        this.lastPoint = smoothedPoint;
    }
    
    onPointerUp(x, y, event) {
        if (this.currentPath) {
            this.app.finalizePath(this.currentPath);
            console.log(`ペン終了: パス完成 (${this.currentPath.points.length}点)`);
        }
        
        this.cleanup();
    }
    
    applySmoothingFilter(x, y) {
        const smoothing = this.app.state.smoothing;
        
        if (smoothing === 0 || this.smoothingBuffer.length === 0) {
            this.smoothingBuffer.push({ x, y });
            return { x, y };
        }
        
        // 移動平均による線補正
        this.smoothingBuffer.push({ x, y });
        if (this.smoothingBuffer.length > this.maxBufferSize) {
            this.smoothingBuffer.shift();
        }
        
        const bufferLength = this.smoothingBuffer.length;
        const avgX = this.smoothingBuffer.reduce((sum, p) => sum + p.x, 0) / bufferLength;
        const avgY = this.smoothingBuffer.reduce((sum, p) => sum + p.y, 0) / bufferLength;
        
        // スムージング強度に応じて補正
        const smoothedX = x + (avgX - x) * smoothing;
        const smoothedY = y + (avgY - y) * smoothing;
        
        return { x: smoothedX, y: smoothedY };
    }
    
    cleanup() {
        this.currentPath = null;
        this.lastPoint = null;
        this.smoothingBuffer = [];
    }
}

// ==== 消しゴムツールクラス ====
class EraserTool {
    constructor(app) {
        this.name = 'eraser';
        this.app = app;
        this.isActive = false;
        this.currentPath = null;
        this.lastPoint = null;
    }
    
    activate() {
        this.isActive = true;
        console.log('🧽 消しゴムツール アクティブ');
        this.app.updateState({ currentTool: 'eraser' });
        this.setupEventListeners();
    }
    
    deactivate() {
        this.isActive = false;
        this.cleanup();
    }
    
    setupEventListeners() {
        const drawingLayer = this.app.layers.drawingLayer;
        
        drawingLayer.on(EVENTS.POINTER_DOWN, (event) => {
            if (!this.isActive) return;
            const point = this.app.getLocalPointerPosition(event);
            this.onPointerDown(point.x, point.y, event);
        });
        
        drawingLayer.on(EVENTS.POINTER_MOVE, (event) => {
            if (!this.isActive) return;
            const point = this.app.getLocalPointerPosition(event);
            this.onPointerMove(point.x, point.y, event);
        });
        
        drawingLayer.on(EVENTS.POINTER_UP, (event) => {
            if (!this.isActive) return;
            const point = this.app.getLocalPointerPosition(event);
            this.onPointerUp(point.x, point.y, event);
        });
        
        drawingLayer.on(EVENTS.POINTER_UP_OUTSIDE, (event) => {
            if (!this.isActive) return;
            this.onPointerUp(0, 0, event);
        });
    }
    
    onPointerDown(x, y, event) {
        // 背景色で描画することで消しゴム効果を実現
        this.currentPath = this.app.createPath(x, y, 'eraser');
        this.lastPoint = { x, y };
        
        console.log(`消しゴム開始: (${x.toFixed(1)}, ${y.toFixed(1)})`);
    }
    
    onPointerMove(x, y, event) {
        if (!this.currentPath || !this.app.state.isDrawing) return;
        
        this.app.extendPath(this.currentPath, x, y);
        this.lastPoint = { x, y };
    }
    
    onPointerUp(x, y, event) {
        if (this.currentPath) {
            this.app.finalizePath(this.currentPath);
            console.log(`消しゴム終了: パス完成`);
        }
        
        this.cleanup();
    }
    
    cleanup() {
        this.currentPath = null;
        this.lastPoint = null;
    }
}

// ==== プリセット管理クラス（改善版） ====
class PenPresetManager {
    constructor(app) {
        this.app = app;
        this.presets = new Map();
        this.activePresetId = null;
        this.currentLiveValues = null;
        
        this.initializeDefaultPresets();
    }
    
    initializeDefaultPresets() {
        const defaultPresets = [
            { id: 'preset-1', size: 1, opacity: 0.85, color: 0x800000, label: '1' },
            { id: 'preset-2', size: 2, opacity: 0.85, color: 0x800000, label: '2' },
            { id: 'preset-4', size: 4, opacity: 0.85, color: 0x800000, label: '4' },
            { id: 'preset-8', size: 8, opacity: 0.85, color: 0x800000, label: '8' },
            { id: 'preset-16', size: 16, opacity: 0.85, color: 0x800000, label: '16' },
            { id: 'preset-32', size: 32, opacity: 0.85, color: 0x800000, label: '32' }
        ];
        
        defaultPresets.forEach(preset => {
            this.presets.set(preset.id, preset);
        });
        
        this.activePresetId = 'preset-16';
        console.log('✅ ペンプリセット初期化完了');
    }
    
    // ライブプレビュー値を更新
    updateActivePresetLive(size, opacity, color = null) {
        if (!this.activePresetId) return;
        
        const activePreset = this.presets.get(this.activePresetId);
        if (!activePreset) return;
        
        this.currentLiveValues = {
            size: size,
            opacity: opacity,
            color: color || activePreset.color
        };
        
        console.log('🎨 ライブプレビュー更新:', {
            preset: this.activePresetId,
            size: size,
            opacity: opacity
        });
    }
    
    // プレビュー表示用データ生成（改善版）
    generatePreviewData() {
        const previewData = [];
        
        this.presets.forEach((preset, presetId) => {
            const isActive = presetId === this.activePresetId;
            
            // アクティブプリセットの場合はライブ値を使用
            let displayValues = preset;
            if (isActive && this.currentLiveValues) {
                displayValues = {
                    ...preset,
                    size: this.currentLiveValues.size,
                    opacity: this.currentLiveValues.opacity,
                    color: this.currentLiveValues.color
                };
            }
            
            // プレビュー円のサイズ計算（最大20px制限）
            const displaySize = Math.min(20, Math.max(0.5, displayValues.size));
            
            previewData.push({
                id: presetId,
                dataSize: preset.size, // data-size属性用の元サイズ
                size: displaySize, // 表示用のサイズ（20px制限）
                opacity: displayValues.opacity,
                color: this.colorToHex(displayValues.color),
                label: displayValues.size.toFixed(1),
                opacityLabel: Math.round(displayValues.opacity * 100) + '%',
                isActive: isActive
            });
        });
        
        return previewData;
    }
    
    // プリセット選択
    selectPreset(presetId) {
        if (!this.presets.has(presetId)) return false;
        
        this.activePresetId = presetId;
        this.currentLiveValues = null; // ライブ値をクリア
        
        const preset = this.presets.get(presetId);
        console.log('🎯 プリセット選択:', presetId, preset);
        
        return preset;
    }
    
    // サイズからプリセットIDを取得
    getPresetIdBySize(size) {
        for (const [presetId, preset] of this.presets) {
            if (Math.abs(preset.size - size) < 0.1) {
                return presetId;
            }
        }
        return null;
    }
    
    // カラー値を16進数に変換
    colorToHex(color) {
        if (typeof color === 'string') return color;
        return '#' + color.toString(16).padStart(6, '0');
    }
    
    getActivePreset() {
        return this.presets.get(this.activePresetId);
    }
    
    getActivePresetId() {
        return this.activePresetId;
    }
}

// ==== スライダーコントローラー ====
class SliderController {
    constructor(sliderId, min, max, initial, updateCallback) {
        this.sliderId = sliderId;
        this.min = min;
        this.max = max;
        this.value = initial;
        this.updateCallback = updateCallback;
        this.isDragging = false;
        this.throttleTimeout = null;
        
        this.elements = this.findElements();
        if (this.elements.container) {
            this.setupEventListeners();
            this.updateDisplay();
        }
    }
    
    findElements() {
        const container = document.getElementById(this.sliderId);
        if (!container) {
            console.warn(`スライダー要素が見つかりません: ${this.sliderId}`);
            return {};
        }
        
        return {
            container,
            track: container.querySelector('.slider-track'),
            handle: container.querySelector('.slider-handle'),
            valueDisplay: container.parentNode.querySelector('.slider-value')
        };
    }
    
    setupEventListeners() {
        const { container } = this.elements;
        
        // マウスイベント
        container.addEventListener('mousedown', (e) => this.onMouseDown(e));
        document.addEventListener('mousemove', (e) => this.onMouseMove(e));
        document.addEventListener('mouseup', () => this.onMouseUp());
    }
    
    onMouseDown(event) {
        this.isDragging = true;
        this.updateValueFromPosition(event.clientX);
        event.preventDefault();
    }
    
    onMouseMove(event) {
        if (!this.isDragging) return;
        this.updateValueFromPosition(event.clientX);
    }
    
    onMouseUp() {
        this.isDragging = false;
    }
    
    updateValueFromPosition(clientX) {
        if (!this.elements.container) return;
        
        const rect = this.elements.container.getBoundingClientRect();
        const percentage = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        const newValue = this.min + percentage * (this.max - this.min);
        
        this.setValue(newValue);
    }
    
    setValue(value, updateDisplay = true) {
        const oldValue = this.value;
        this.value = Math.max(this.min, Math.min(this.max, value));
        
        if (updateDisplay) {
            this.updateDisplay();
        }
        
        // スロットリング付きコールバック実行
        if (this.updateCallback && Math.abs(this.value - oldValue) > 0.001) {
            this.throttledCallback();
        }
    }
    
    throttledCallback() {
        if (this.throttleTimeout) {
            clearTimeout(this.throttleTimeout);
        }
        
        this.throttleTimeout = setTimeout(() => {
            this.updateCallback(this.value);
            this.throttleTimeout = null;
        }, 16);
    }
    
    updateDisplay() {
        if (!this.elements.track || !this.elements.handle) return;
        
        const percentage = ((this.value - this.min) / (this.max - this.min)) * 100;
        
        this.elements.track.style.width = percentage + '%';
        this.elements.handle.style.left = percentage + '%';
        
        if (this.elements.valueDisplay && this.updateCallback) {
            const displayValue = this.updateCallback(this.value, true);
            if (typeof displayValue === 'string') {
                this.elements.valueDisplay.textContent = displayValue;
            }
        }
    }
    
    adjustValue(delta) {
        this.setValue(this.value + delta);
    }
}

// ==== UI管理システム ====
class UIManager {
    constructor(app, penTool, eraserTool) {
        this.app = app;
        this.penTool = penTool;
        this.eraserTool = eraserTool;
        this.activeTool = penTool;
        
        this.penPresetManager = new PenPresetManager(app);
        this.sliders = new Map();
        this.activePopup = null;
        
        this.coordinateUpdateThrottle = null;
    }
    
    async init() {
        try {
            console.log('🎯 UIManager初期化開始...');
            
            this.setupToolButtons();
            this.setupSliders();
            this.setupPresetListeners();
            this.setupResize();
            this.setupCheckboxes();
            this.setupPopups();
            this.setupEventListeners();
            
            // 初期状態の更新
            this.updateAllDisplays();
            
            console.log('✅ UIManager初期化完了');
            
        } catch (error) {
            console.error('❌ UIManager初期化エラー:', error);
            throw error;
        }
    }
    
    setupToolButtons() {
        document.querySelectorAll('.tool-button').forEach(button => {
            button.addEventListener('click', (event) => {
                if (button.classList.contains('disabled')) return;
                
                const toolId = button.id;
                const popupId = button.getAttribute('data-popup');
                
                this.handleToolButtonClick(toolId, popupId, button);
            });
        });
        
        console.log('✅ ツールボタン設定完了');
    }
    
    handleToolButtonClick(toolId, popupId, button) {
        // ツール切り替え
        if (toolId === 'pen-tool') {
            this.setActiveTool(this.penTool, button);
        } else if (toolId === 'eraser-tool') {
            this.setActiveTool(this.eraserTool, button);
        }
        
        // ポップアップ表示/非表示
        if (popupId) {
            this.togglePopup(popupId);
        }
    }
    
    setActiveTool(tool, button) {
        // 現在のツールを非アクティブ化
        if (this.activeTool) {
            this.activeTool.deactivate();
        }
        
        // 新しいツールをアクティブ化
        this.activeTool = tool;
        this.activeTool.activate();
        
        // UI更新
        document.querySelectorAll('.tool-button').forEach(btn => 
            btn.classList.remove('active'));
        if (button) {
            button.classList.add('active');
        }
        
        this.updateStatusBar();
    }
    
    setupSliders() {
        // ペンサイズスライダー
        this.createSlider('pen-size-slider', 0.1, 100, 16.0, (value, displayOnly = false) => {
            if (!displayOnly) {
                this.app.updateState({ brushSize: value });
                // ライブプレビュー更新
                const currentOpacity = this.getCurrentOpacity();
                this.penPresetManager.updateActivePresetLive(value, currentOpacity);
                this.updatePresetsDisplay();
            }
            return value.toFixed(1) + 'px';
        });
        
        // 不透明度スライダー
        this.createSlider('pen-opacity-slider', 0, 100, 85.0, (value, displayOnly = false) => {
            if (!displayOnly) {
                this.app.updateState({ opacity: value / 100 });
                // ライブプレビュー更新
                const currentSize = this.getCurrentSize();
                this.penPresetManager.updateActivePresetLive(currentSize, value / 100);
                this.updatePresetsDisplay();
            }
            return value.toFixed(1) + '%';
        });
        
        // 筆圧スライダー
        this.createSlider('pen-pressure-slider', 0, 100, 50.0, (value, displayOnly = false) => {
            if (!displayOnly) {
                this.app.updateState({ pressure: value / 100 });
            }
            return value.toFixed(1) + '%';
        });
        
        // 線補正スライダー
        this.createSlider('pen-smoothing-slider', 0, 100, 30.0, (value, displayOnly = false) => {
            if (!displayOnly) {
                this.app.updateState({ smoothing: value / 100 });
            }
            return value.toFixed(1) + '%';
        });
        
        this.setupSliderButtons();
        console.log('✅ スライダー設定完了');
    }
    
    createSlider(sliderId, min, max, initial, callback) {
        const slider = new SliderController(sliderId, min, max, initial, callback);
        this.sliders.set(sliderId, slider);
        return slider;
    }
    
    // 現在のサイズを取得
    getCurrentSize() {
        const sizeSlider = this.sliders.get('pen-size-slider');
        return sizeSlider ? sizeSlider.value : 16.0;
    }
    
    // 現在の不透明度を取得
    getCurrentOpacity() {
        const opacitySlider = this.sliders.get('pen-opacity-slider');
        return opacitySlider ? opacitySlider.value / 100 : 0.85;
    }
    
    setupSliderButtons() {
        // スライダー調整ボタンのセットアップ
        const buttonConfigs = [
            // ペンサイズ
            { id: 'pen-size-decrease-small', slider: 'pen-size-slider', delta: -0.1 },
            { id: 'pen-size-decrease', slider: 'pen-size-slider', delta: -1 },
            { id: 'pen-size-decrease-large', slider: 'pen-size-slider', delta: -10 },
            { id: 'pen-size-increase-small', slider: 'pen-size-slider', delta: 0.1 },
            { id: 'pen-size-increase', slider: 'pen-size-slider', delta: 1 },
            { id: 'pen-size-increase-large', slider: 'pen-size-slider', delta: 10 },
            
            // 不透明度
            { id: 'pen-opacity-decrease-small', slider: 'pen-opacity-slider', delta: -0.1 },
            { id: 'pen-opacity-decrease', slider: 'pen-opacity-slider', delta: -1 },
            { id: 'pen-opacity-decrease-large', slider: 'pen-opacity-slider', delta: -10 },
            { id: 'pen-opacity-increase-small', slider: 'pen-opacity-slider', delta: 0.1 },
            { id: 'pen-opacity-increase', slider: 'pen-opacity-slider', delta: 1 },
            { id: 'pen-opacity-increase-large', slider: 'pen-opacity-slider', delta: 10 },
            
            // 筆圧
            { id: 'pen-pressure-decrease-small', slider: 'pen-pressure-slider', delta: -0.1 },
            { id: 'pen-pressure-decrease', slider: 'pen-pressure-slider', delta: -1 },
            { id: 'pen-pressure-decrease-large', slider: 'pen-pressure-slider', delta: -10 },
            { id: 'pen-pressure-increase-small', slider: 'pen-pressure-slider', delta: 0.1 },
            { id: 'pen-pressure-increase', slider: 'pen-pressure-slider', delta: 1 },
            { id: 'pen-pressure-increase-large', slider: 'pen-pressure-slider', delta: 10 },
            
            // 線補正
            { id: 'pen-smoothing-decrease-small', slider: 'pen-smoothing-slider', delta: -0.1 },
            { id: 'pen-smoothing-decrease', slider: 'pen-smoothing-slider', delta: -1 },
            { id: 'pen-smoothing-decrease-large', slider: 'pen-smoothing-slider', delta: -10 },
            { id: 'pen-smoothing-increase-small', slider: 'pen-smoothing-slider', delta: 0.1 },
            { id: 'pen-smoothing-increase', slider: 'pen-smoothing-slider', delta: 1 },
            { id: 'pen-smoothing-increase-large', slider: 'pen-smoothing-slider', delta: 10 }
        ];
        
        buttonConfigs.forEach(config => {
            const button = document.getElementById(config.id);
            if (button) {
                button.addEventListener('click', () => {
                    const slider = this.sliders.get(config.slider);
                    if (slider) {
                        slider.adjustValue(config.delta);
                    }
                });
            }
        });
    }
    
    // プリセット選択イベントの設定（改善版）
    setupPresetListeners() {
        const presetsContainer = document.getElementById('size-presets');
        if (!presetsContainer) {
            console.warn('プリセットコンテナが見つかりません');
            return;
        }
        
        presetsContainer.addEventListener('click', (event) => {
            const presetItem = event.target.closest('.size-preset-item');
            if (!presetItem) return;
            
            const size = parseFloat(presetItem.getAttribute('data-size'));
            if (!isNaN(size)) {
                // プリセット選択処理
                const presetId = this.penPresetManager.getPresetIdBySize(size);
                if (!presetId) return;
                
                const preset = this.penPresetManager.selectPreset(presetId);
                
                if (preset) {
                    // スライダーとアプリを更新
                    this.updateSliderValue('pen-size-slider', preset.size);
                    this.updateSliderValue('pen-opacity-slider', preset.opacity * 100);
                    
                    this.app.updateState({
                        brushSize: preset.size,
                        opacity: preset.opacity
                    });
                    
                    // プリセット表示を更新
                    this.updatePresetsDisplay();
                    
                    console.log(`プリセット選択: サイズ${preset.size}, 不透明度${Math.round(preset.opacity * 100)}%`);
                }
            }
        });
        
        console.log('✅ プリセットリスナー設定完了');
    }
    
    // プリセット表示の更新（改善版・フレーム対応）
    updatePresetsDisplay() {
        const previewData = this.penPresetManager.generatePreviewData();
        const presetsContainer = document.getElementById('size-presets');
        
        if (!presetsContainer) return;
        
        // 既存の要素を更新
        const presetItems = presetsContainer.querySelectorAll('.size-preset-item');
        
        previewData.forEach((data, index) => {
            if (index < presetItems.length) {
                const item = presetItems[index];
                const frame = item.querySelector('.size-preview-frame');
                const circle = item.querySelector('.size-preview-circle');
                const label = item.querySelector('.size-preview-label');
                const percent = item.querySelector('.size-preview-percent');
                
                // data-size属性を更新
                item.setAttribute('data-size', data.dataSize);
                
                if (circle) {
                    circle.style.width = data.size + 'px';
                    circle.style.height = data.size + 'px';
                    circle.style.background = data.color;
                    circle.style.opacity = data.opacity;
                }
                
                if (label) {
                    label.textContent = data.label;
                }
                
                if (percent) {
                    percent.textContent = data.opacityLabel;
                }
                
                // アクティブ状態の更新（枠で表示）
                item.classList.toggle('active', data.isActive);
            }
        });
    }
    
    setupResize() {
        // プリセットボタン
        document.querySelectorAll('.resize-button[data-size]').forEach(button => {
            button.addEventListener('click', () => {
                const [width, height] = button.getAttribute('data-size').split(',').map(Number);
                this.setCanvasSize(width, height);
            });
        });
        
        // 適用ボタン
        const applyButton = document.getElementById('apply-resize');
        const applyCenterButton = document.getElementById('apply-resize-center');
        
        if (applyButton) {
            applyButton.addEventListener('click', () => this.applyResize(false));
        }
        
        if (applyCenterButton) {
            applyCenterButton.addEventListener('click', () => this.applyResize(true));
        }
        
        console.log('✅ リサイズ機能設定完了');
    }
    
    setCanvasSize(width, height) {
        const widthInput = document.getElementById('canvas-width');
        const heightInput = document.getElementById('canvas-height');
        
        if (widthInput) widthInput.value = width;
        if (heightInput) heightInput.value = height;
    }
    
    applyResize(centerContent) {
        try {
            const widthInput = document.getElementById('canvas-width');
            const heightInput = document.getElementById('canvas-height');
            
            if (!widthInput || !heightInput) {
                console.warn('リサイズ入力要素が見つかりません');
                return;
            }
            
            const width = parseInt(widthInput.value);
            const height = parseInt(heightInput.value);
            
            if (isNaN(width) || isNaN(height) || width < 100 || height < 100) {
                console.warn('無効なサイズが指定されました');
                return;
            }
            
            this.app.resize(width, height, centerContent);
            this.updateStatusBar();
            this.hideAllPopups();
            
            console.log(`Canvas resized to ${width}x${height}px (center: ${centerContent})`);
            
        } catch (error) {
            console.error('リサイズエラー:', error);
        }
    }
    
    setupCheckboxes() {
        document.querySelectorAll('.checkbox').forEach(checkbox => {
            checkbox.addEventListener('click', () => {
                checkbox.classList.toggle('checked');
                
                const checkboxId = checkbox.id;
                const isChecked = checkbox.classList.contains('checked');
                
                console.log(`チェックボックス変更: ${checkboxId} = ${isChecked}`);
            });
        });
        
        console.log('✅ チェックボックス設定完了');
    }
    
    setupPopups() {
        // ポップアップ外クリックで閉じる
        document.addEventListener('click', (event) => {
            if (!event.target.closest('.popup-panel') && 
                !event.target.closest('.tool-button[data-popup]')) {
                this.hideAllPopups();
            }
        });
        
        // ESCキーでポップアップを閉じる
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                if (this.activePopup) {
                    this.hideAllPopups();
                } else {
                    this.app.clear(); // キャンバスクリア
                }
            }
        });
        
        // ドラッグ機能の設定
        this.setupPopupDragging();
        
        console.log('✅ ポップアップ設定完了');
    }
    
    setupPopupDragging() {
        document.querySelectorAll('.popup-panel.draggable').forEach(popup => {
            let isDragging = false;
            let dragOffset = { x: 0, y: 0 };
            
            popup.addEventListener('mousedown', (event) => {
                if (event.target === popup || event.target.closest('.popup-title')) {
                    isDragging = true;
                    popup.classList.add('dragging');
                    
                    const rect = popup.getBoundingClientRect();
                    dragOffset.x = event.clientX - rect.left;
                    dragOffset.y = event.clientY - rect.top;
                    event.preventDefault();
                }
            });
            
            document.addEventListener('mousemove', (event) => {
                if (!isDragging) return;
                
                const x = Math.max(0, Math.min(
                    event.clientX - dragOffset.x,
                    window.innerWidth - popup.offsetWidth
                ));
                const y = Math.max(0, Math.min(
                    event.clientY - dragOffset.y,
                    window.innerHeight - popup.offsetHeight
                ));
                
                popup.style.left = x + 'px';
                popup.style.top = y + 'px';
            });
            
            document.addEventListener('mouseup', () => {
                if (isDragging) {
                    isDragging = false;
                    popup.classList.remove('dragging');
                }
            });
        });
    }
    
    showPopup(popupId) {
        this.hideAllPopups();
        
        const popup = document.getElementById(popupId);
        if (popup) {
            popup.classList.add('show');
            this.activePopup = popupId;
            return true;
        }
        return false;
    }
    
    hidePopup(popupId) {
        const popup = document.getElementById(popupId);
        if (popup) {
            popup.classList.remove('show');
            if (this.activePopup === popupId) {
                this.activePopup = null;
            }
            return true;
        }
        return false;
    }
    
    togglePopup(popupId) {
        const popup = document.getElementById(popupId);
        if (!popup) return false;
        
        const isVisible = popup.classList.contains('show');
        return isVisible ? this.hidePopup(popupId) : this.showPopup(popupId);
    }
    
    hideAllPopups() {
        document.querySelectorAll('.popup-panel').forEach(popup => {
            popup.classList.remove('show');
        });
        this.activePopup = null;
    }
    
    setupEventListeners() {
        // キーボードショートカット
        document.addEventListener('keydown', (event) => {
            switch (event.code) {
                case 'KeyB':
                    event.preventDefault();
                    this.setActiveTool(this.penTool, document.getElementById('pen-tool'));
                    break;
                case 'KeyE':
                    event.preventDefault();
                    this.setActiveTool(this.eraserTool, document.getElementById('eraser-tool'));
                    break;
            }
        });
        
        // 描画レイヤーのマウス移動イベント
        if (this.app.layers && this.app.layers.drawingLayer) {
            this.app.layers.drawingLayer.on(EVENTS.POINTER_MOVE, (event) => {
                const point = this.app.getLocalPointerPosition(event);
                this.updateCoordinatesThrottled(point.x, point.y);
                
                // 筆圧モニター更新（描画中のみ）
                if (this.app.state.isDrawing) {
                    const pressure = Math.min(100, this.app.state.pressure * 100 + Math.random() * 20);
                    this.updatePressureMonitor(pressure);
                }
            });
            
            this.app.layers.drawingLayer.on(EVENTS.POINTER_UP, () => {
                this.updatePressureMonitor(0);
            });
        }
        
        console.log('✅ イベントリスナー設定完了');
    }
    
    updateCoordinatesThrottled(x, y) {
        if (this.coordinateUpdateThrottle) {
            clearTimeout(this.coordinateUpdateThrottle);
        }
        
        this.coordinateUpdateThrottle = setTimeout(() => {
            const coordElement = document.getElementById('coordinates');
            if (coordElement) {
                coordElement.textContent = `x: ${Math.round(x)}, y: ${Math.round(y)}`;
            }
        }, 16);
    }
    
    updatePressureMonitor(pressure) {
        const pressureElement = document.getElementById('pressure-monitor');
        if (pressureElement) {
            pressureElement.textContent = pressure.toFixed(1) + '%';
        }
    }
    
    updateStatusBar() {
        const stats = this.app.getStats();
        
        // キャンバス情報
        const canvasInfo = document.getElementById('canvas-info');
        if (canvasInfo) {
            canvasInfo.textContent = `${stats.width}×${stats.height}px`;
        }
        
        // 現在のツール
        const currentTool = document.getElementById('current-tool');
        if (currentTool) {
            const toolNames = {
                pen: 'ベクターペン',
                eraser: '消しゴム'
            };
            currentTool.textContent = toolNames[this.activeTool.name] || this.activeTool.name;
        }
        
        // 現在の色
        const currentColor = document.getElementById('current-color');
        if (currentColor) {
            const color = this.app.state.brushColor;
            const colorStr = '#' + color.toString(16).padStart(6, '0');
            currentColor.textContent = colorStr;
        }
    }
    
    updateSliderValue(sliderId, value) {
        const slider = this.sliders.get(sliderId);
        if (slider) {
            slider.setValue(value);
        }
    }
    
    updateAllDisplays() {
        this.updateStatusBar();
        this.updatePresetsDisplay();
        
        // パフォーマンス監視の開始
        this.startPerformanceMonitoring();
        
        console.log('✅ 全ディスプレイ更新完了');
    }
    
    startPerformanceMonitoring() {
        let frameCount = 0;
        let lastTime = performance.now();
        
        const updatePerformance = (currentTime) => {
            frameCount++;
            const deltaTime = currentTime - lastTime;
            
            // 1秒ごとにFPS計算
            if (deltaTime >= 1000) {
                const fps = Math.round((frameCount * 1000) / deltaTime);
                
                // FPS表示更新
                const fpsElement = document.getElementById('fps');
                if (fpsElement) {
                    fpsElement.textContent = fps;
                }
                
                // メモリ使用量表示（簡易実装）
                const memoryElement = document.getElementById('memory-usage');
                if (memoryElement && performance.memory) {
                    const usedMB = Math.round(performance.memory.usedJSHeapSize / 1024 / 1024 * 10) / 10;
                    memoryElement.textContent = usedMB + 'MB';
                }
                
                // GPU使用率（ダミー値）
                const gpuElement = document.getElementById('gpu-usage');
                if (gpuElement) {
                    const gpuUsage = Math.round(40 + Math.random() * 20);
                    gpuElement.textContent = gpuUsage + '%';
                }
                
                frameCount = 0;
                lastTime = currentTime;
            }
            
            requestAnimationFrame(updatePerformance);
        };
        
        requestAnimationFrame(updatePerformance);
        console.log('📊 パフォーマンス監視開始');
    }
    
    showNotification(message, type = 'info', duration = 3000) {
        const colors = {
            info: '#2196F3',
            success: '#4CAF50',
            warning: '#FF9800',
            error: '#f44336'
        };
        
        const notificationDiv = document.createElement('div');
        notificationDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${colors[type] || colors.info};
            color: white;
            padding: 12px 16px;
            border-radius: 6px;
            z-index: 10000;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
            animation: slideInRight 0.3s ease-out;
            max-width: 300px;
        `;
        
        notificationDiv.textContent = message;
        document.body.appendChild(notificationDiv);
        
        setTimeout(() => {
            if (notificationDiv.parentNode) {
                notificationDiv.style.animation = 'slideOutRight 0.3s ease-in';
                setTimeout(() => {
                    if (notificationDiv.parentNode) {
                        notificationDiv.parentNode.removeChild(notificationDiv);
                    }
                }, 300);
            }
        }, duration);
    }
}

// ==== グローバル変数 ====
let futabaApp = null;
let penTool = null;
let eraserTool = null;
let uiManager = null;

// ==== アプリケーション初期化 ====
window.addEventListener('DOMContentLoaded', async () => {
    try {
        console.log('🚀 ふたば☆ちゃんねる風ベクターお絵描きツール v0.8 起動開始');
        console.log('✨ プレビュー改善版 - 20px固定フレーム & 枠表示');
        
        // 依存関係チェック
        if (typeof PIXI === 'undefined') {
            throw new Error('PIXI.js が読み込まれていません。CDNの読み込みを確認してください。');
        }
        
        // 1. コアアプリケーション初期化
        console.log('🎯 Step 1: コアアプリケーション初期化');
        futabaApp = new PixiDrawingApp(400, 400);
        await futabaApp.init();
        
        // 2. ツール初期化
        console.log('🎯 Step 2: ツール初期化');
        penTool = new VectorPenTool(futabaApp);
        eraserTool = new EraserTool(futabaApp);
        
        // 3. UI管理システム初期化
        console.log('🎯 Step 3: UI管理システム初期化');
        uiManager = new UIManager(futabaApp, penTool, eraserTool);
        await uiManager.init();
        
        // 4. デフォルトツールをアクティブ化
        console.log('🎯 Step 4: デフォルトツール設定');
        penTool.activate();
        
        console.log('🎉 アプリケーション起動完了！');
        console.log('💡 改善ポイント:');
        console.log('  ✅ プレビューフレーム統一 (20px固定)');
        console.log('  ✅ アクティブ状態を枠で表示');
        console.log('  ✅ 大きなプリセットの表示制限');
        console.log('  ✅ 視覚的統一感の向上');
        console.log('💡 利用可能機能:');
        console.log('  ✅ ベクターペン描画 (線補正付き)');
        console.log('  ✅ 消しゴムツール');
        console.log('  ✅ プリセット選択 (改善版プレビュー)');
        console.log('  ✅ キャンバスリサイズ');
        console.log('  ✅ ライブプレビュー更新');
        console.log('  ✅ ショートカット (B: ペン, E: 消しゴム, ESC: クリア)');
        
        // 成功通知
        if (uiManager && uiManager.showNotification) {
            uiManager.showNotification('アプリケーション起動完了！プレビュー改善版', 'success');
        }
        
        // デバッグ用グローバル関数
        window.getAppStatus = () => {
            if (!futabaApp || !uiManager) {
                return { error: 'アプリケーションが初期化されていません' };
            }
            
            return {
                app: futabaApp.getStats(),
                activeTool: uiManager.activeTool.name,
                activePopup: uiManager.activePopup,
                presets: {
                    active: uiManager.penPresetManager.getActivePresetId(),
                    liveValues: uiManager.penPresetManager.currentLiveValues
                },
                timestamp: new Date().toISOString()
            };
        };
        
        window.clearCanvas = () => {
            if (futabaApp) {
                futabaApp.clear();
                console.log('Canvas cleared');
            }
        };
        
        window.testPreview = () => {
            if (uiManager && uiManager.penPresetManager) {
                console.log('🎨 プレビューデータテスト:');
                const previewData = uiManager.penPresetManager.generatePreviewData();
                previewData.forEach((data, index) => {
                    console.log(`  プリセット${index + 1}: サイズ${data.label}, 表示${data.size}px, アクティブ:${data.isActive}`);
                });
            }
        };
        
    } catch (error) {
        console.error('❌ アプリケーション起動エラー:', error);
        showStartupError(error);
    }
});

// ==== エラー表示 ====
function showStartupError(error) {
    const errorDiv = document.createElement('div');
    errorDiv.innerHTML = `
        <div style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); 
                    background: #ffebee; border: 2px solid #f44336; border-radius: 8px; 
                    padding: 20px; max-width: 500px; z-index: 10000; 
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                    box-shadow: 0 8px 24px rgba(244, 67, 54, 0.3);">
            <h3 style="color: #f44336; margin: 0 0 12px 0; font-size: 18px;">
                🚨 アプリケーション起動エラー
            </h3>
            <p style="margin: 0 0 12px 0; color: #333; line-height: 1.5;">
                ${error.message}
            </p>
            <details style="margin: 12px 0; color: #666;">
                <summary style="cursor: pointer; font-weight: 500;">
                    詳細情報を表示
                </summary>
                <pre style="margin: 8px 0 0 0; font-size: 12px; overflow: auto; max-height: 200px;">
${error.stack || 'スタック情報なし'}
                </pre>
            </details>
            <p style="margin: 12px 0 0 0; font-size: 12px; color: #666;">
                💡 ブラウザのコンソール（F12）で詳細を確認できます
            </p>
            <button onclick="this.parentElement.parentElement.remove()" 
                    style="margin: 12px 0 0 0; padding: 8px 16px; background: #f44336; 
                           color: white; border: none; border-radius: 4px; cursor: pointer;">
                閉じる
            </button>
        </div>
    `;
    document.body.appendChild(errorDiv);
}