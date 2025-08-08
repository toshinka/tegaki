/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v0.8
 * 描画ツール群 - drawing-tools.js（修正版）
 * 
 * 責務: 各描画ツールや機能をクラス化
 * 依存: app-core.js (PixiDrawingApp, CONFIG, EVENTS)
 */

// ==== ベースツールクラス ====
class BaseTool {
    constructor(name, app) {
        this.name = name;
        this.app = app;
        this.isActive = false;
        this.currentPath = null;
    }
    
    activate() {
        this.isActive = true;
        this.onActivate();
    }
    
    deactivate() {
        this.isActive = false;
        this.onDeactivate();
    }
    
    // 抽象メソッド（サブクラスで実装）
    onActivate() {}
    onDeactivate() {}
    onPointerDown(x, y, event) {}
    onPointerMove(x, y, event) {}
    onPointerUp(x, y, event) {}
}

// ==== ベクターペンツール ====
class VectorPenTool extends BaseTool {
    constructor(app) {
        super('pen', app);
        this.lastPoint = null;
        this.smoothingBuffer = [];
        this.maxBufferSize = 5;
    }
    
    onActivate() {
        console.log('🖊️ ベクターペンツール アクティブ');
        this.app.updateState({ currentTool: 'pen' });
        
        // 描画レイヤーにイベントリスナーを設定
        this.setupEventListeners();
    }
    
    onDeactivate() {
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

// ==== 消しゴムツール ====
class EraserTool extends BaseTool {
    constructor(app) {
        super('eraser', app);
        this.lastPoint = null;
    }
    
    onActivate() {
        console.log('🧽 消しゴムツール アクティブ');
        this.app.updateState({ currentTool: 'eraser' });
        this.setupEventListeners();
    }
    
    onDeactivate() {
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

// ==== ペンプリセット管理システム ====
class PenPresetManager {
    constructor(app) {
        this.app = app;
        this.presets = new Map();
        this.activePresetId = null;
        this.currentLiveValues = null;
        
        this.initializeDefaultPresets();
    }
    
    initializeDefaultPresets() {
        // デフォルトプリセット（HTMLから移植）
        const defaultPresets = [
            { id: 'preset-1', size: 1.0, opacity: 85, color: 0x800000, label: '1' },
            { id: 'preset-2', size: 2.0, opacity: 85, color: 0x800000, label: '2' },
            { id: 'preset-4', size: 4.0, opacity: 85, color: 0x800000, label: '4' },
            { id: 'preset-8', size: 8.0, opacity: 85, color: 0x800000, label: '8' },
            { id: 'preset-16', size: 16.0, opacity: 85, color: 0x800000, label: '16' },
            { id: 'preset-32', size: 32.0, opacity: 85, color: 0x800000, label: '32' }
        ];
        
        defaultPresets.forEach(preset => {
            this.presets.set(preset.id, {
                ...preset,
                originalSize: preset.size,
                timestamp: Date.now()
            });
        });
        
        // デフォルトアクティブプリセット（16px）
        this.activePresetId = 'preset-16';
        
        console.log(`✅ ${this.presets.size}個のペンプリセットを初期化`);
    }
    
    setActivePreset(presetId) {
        if (!this.presets.has(presetId)) {
            console.warn(`未知のプリセット: ${presetId}`);
            return false;
        }
        
        const preset = this.presets.get(presetId);
        this.activePresetId = presetId;
        
        // アプリケーション状態を更新
        this.app.updateState({
            brushSize: preset.size,
            brushColor: preset.color,
            opacity: preset.opacity / 100
        });
        
        console.log(`プリセット選択: ${preset.label} (size: ${preset.size}, opacity: ${preset.opacity}%)`);
        return true;
    }
    
    getActivePreset() {
        return this.activePresetId ? this.presets.get(this.activePresetId) : null;
    }
    
    updateActivePresetLive(size, opacity, color = null) {
        if (!this.activePresetId) return;
        
        // ライブ値として保持（プリセット本体は変更しない）
        this.currentLiveValues = {
            size: size,
            opacity: opacity,
            color: color || this.getActivePreset().color
        };
    }
    
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
            
            // プレビュー円のサイズ計算（表示サイズは最大20pxに制限）
            const displaySize = Math.min(20, Math.max(0.5, displayValues.size));
            
            previewData.push({
                id: presetId,
                originalSize: preset.originalSize,
                size: displaySize,
                opacity: displayValues.opacity,
                color: this.colorToHex(displayValues.color),
                label: preset.label,
                isActive: isActive
            });
        });
        
        return previewData;
    }
    
    colorToHex(color) {
        if (typeof color === 'number') {
            return '#' + color.toString(16).padStart(6, '0');
        }
        return color;
    }
    
    // ==== 公開API ====
    getAllPresets() {
        return Array.from(this.presets.entries()).map(([id, preset]) => ({
            id,
            ...preset
        }));
    }
    
    addPreset(id, size, opacity, color, label) {
        this.presets.set(id, {
            id,
            size,
            opacity,
            color,
            label,
            originalSize: size,
            timestamp: Date.now()
        });
        
        console.log(`プリセット追加: ${label} (${id})`);
        return true;
    }
    
    removePreset(presetId) {
        if (this.presets.has(presetId)) {
            this.presets.delete(presetId);
            
            // アクティブプリセットが削除された場合、最初のプリセットに切り替え
            if (this.activePresetId === presetId) {
                const firstPresetId = this.presets.keys().next().value;
                if (firstPresetId) {
                    this.setActivePreset(firstPresetId);
                }
            }
            
            console.log(`プリセット削除: ${presetId}`);
            return true;
        }
        return false;
    }
    
    getPresetCount() {
        return this.presets.size;
    }
}

// ==== ツール管理システム ====
class ToolManager {
    constructor(app) {
        this.app = app;
        this.tools = new Map();
        this.activeTool = null;
        
        this.initializeTools();
    }
    
    initializeTools() {
        // 各ツールを登録
        this.registerTool('pen', new VectorPenTool(this.app));
        this.registerTool('eraser', new EraserTool(this.app));
        
        // 将来のツール（コメントアウト）
        // this.registerTool('fill', new FillTool(this.app));
        // this.registerTool('select', new SelectTool(this.app));
        
        console.log(`✅ ${this.tools.size}個のツールを登録完了`);
    }
    
    registerTool(name, tool) {
        this.tools.set(name, tool);
        console.log(`🔧 ツール登録: ${name}`);
    }
    
    setActiveTool(toolName) {
        if (!this.tools.has(toolName)) {
            console.warn(`未知のツール: ${toolName}`);
            return false;
        }
        
        // 現在のツールを非アクティブ化
        if (this.activeTool) {
            this.activeTool.deactivate();
        }
        
        // 新しいツールをアクティブ化
        this.activeTool = this.tools.get(toolName);
        this.activeTool.activate();
        
        console.log(`🔄 ツール切り替え: ${toolName}`);
        return true;
    }
    
    getActiveTool() {
        return this.activeTool;
    }
    
    getAvailableTools() {
        return Array.from(this.tools.keys());
    }
}

// ==== パフォーマンス監視システム ====
class PerformanceMonitor {
    constructor() {
        this.frameCount = 0;
        this.lastTime = performance.now();
        this.isRunning = false;
        this.stats = {
            fps: 0,
            frameTime: 0,
            memoryUsage: 0
        };
    }
    
    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        
        const update = (currentTime) => {
            if (!this.isRunning) return;
            
            this.frameCount++;
            const deltaTime = currentTime - this.lastTime;
            
            // 1秒ごとにFPS計算
            if (deltaTime >= 1000) {
                this.stats.fps = Math.round((this.frameCount * 1000) / deltaTime);
                this.stats.frameTime = Math.round(deltaTime / this.frameCount * 100) / 100;
                
                this.updateUI();
                
                this.frameCount = 0;
                this.lastTime = currentTime;
            }
            
            requestAnimationFrame(update);
        };
        
        requestAnimationFrame(update);
        console.log('📊 パフォーマンス監視開始');
    }
    
    stop() {
        this.isRunning = false;
        console.log('📊 パフォーマンス監視停止');
    }
    
    updateUI() {
        // FPS表示更新
        const fpsElement = document.getElementById('fps');
        if (fpsElement) {
            fpsElement.textContent = this.stats.fps;
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
    }
    
    getStats() {
        return { ...this.stats };
    }
}

// ==== ショートカット管理システム ====
class ShortcutManager {
    constructor(toolManager, app) {
        this.toolManager = toolManager;
        this.app = app;
        this.shortcuts = new Map();
        this.isEnabled = true;
    }
    
    init() {
        this.registerDefaultShortcuts();
        this.setupEventListeners();
        console.log('⌨️ ショートカットシステム初期化完了');
    }
    
    registerDefaultShortcuts() {
        // ツール切り替え
        this.register('KeyB', () => this.toolManager.setActiveTool('pen'));
        this.register('KeyE', () => this.toolManager.setActiveTool('eraser'));
        
        // 操作系
        this.register('Escape', () => this.app.clear());
        
        // 将来の機能（コメントアウト）
        // this.register('KeyZ', (e) => e.ctrlKey && this.undo());
        // this.register('KeyY', (e) => e.ctrlKey && this.redo());
    }
    
    register(keyCode, handler) {
        this.shortcuts.set(keyCode, handler);
        console.log(`⌨️ ショートカット登録: ${keyCode}`);
    }
    
    setupEventListeners() {
        document.addEventListener('keydown', (event) => {
            if (!this.isEnabled) return;
            
            const handler = this.shortcuts.get(event.code);
            if (handler) {
                event.preventDefault();
                try {
                    handler(event);
                } catch (error) {
                    console.error(`ショートカットハンドラーエラー (${event.code}):`, error);
                }
            }
        });
    }
    
    enable() {
        this.isEnabled = true;
    }
    
    disable() {
        this.isEnabled = false;
    }
}

// ==== レイヤーシステム（将来機能用） ====
class LayerSystem {
    constructor(app) {
        this.app = app;
        this.layers = [];
        this.activeLayerId = null;
        this.layerIdCounter = 0;
    }
    
    init() {
        console.log('📚 レイヤーシステム初期化 (プレースホルダー)');
        
        // デフォルトレイヤー作成
        this.createLayer('Background');
        this.createLayer('Drawing');
        
        if (this.layers.length > 0) {
            this.setActiveLayer(this.layers[1].id); // Drawing レイヤーをアクティブに
        }
    }
    
    createLayer(name = 'Layer') {
        const layer = {
            id: ++this.layerIdCounter,
            name: name,
            container: new PIXI.Container(),
            visible: true,
            opacity: 1.0,
            locked: false,
            timestamp: Date.now()
        };
        
        this.layers.push(layer);
        console.log(`📚 レイヤー作成: ${name} (ID: ${layer.id})`);
        
        return layer;
    }
    
    setActiveLayer(layerId) {
        const layer = this.layers.find(l => l.id === layerId);
        if (layer) {
            this.activeLayerId = layerId;
            console.log(`📚 アクティブレイヤー設定: ${layer.name}`);
        }
    }
    
    getActiveLayer() {
        return this.layers.find(l => l.id === this.activeLayerId);
    }
    
    deleteLayer(layerId) {
        const index = this.layers.findIndex(l => l.id === layerId);
        if (index > -1) {
            const layer = this.layers[index];
            this.layers.splice(index, 1);
            console.log(`📚 レイヤー削除: ${layer.name}`);
        }
    }
}

// ==== メインツールシステム統合クラス ====
class DrawingToolsSystem {
    constructor(app) {
        this.app = app;
        this.toolManager = new ToolManager(app);
        this.penPresetManager = new PenPresetManager(app); // 追加
        this.performanceMonitor = new PerformanceMonitor();
        this.shortcutManager = new ShortcutManager(this.toolManager, app);
        this.layerSystem = new LayerSystem(app);
        
        this.isInitialized = false;
    }
    
    async init() {
        try {
            console.log('🎯 DrawingToolsSystem初期化開始...');
            
            // 各サブシステムの初期化
            this.layerSystem.init();
            this.shortcutManager.init();
            
            // デフォルトツールをアクティブ化
            this.toolManager.setActiveTool('pen');
            
            // デフォルトプリセットを適用
            this.penPresetManager.setActivePreset('preset-16');
            
            // パフォーマンス監視開始
            this.performanceMonitor.start();
            
            this.isInitialized = true;
            console.log('✅ DrawingToolsSystem初期化完了');
            
        } catch (error) {
            console.error('❌ DrawingToolsSystem初期化エラー:', error);
            throw error;
        }
    }
    
    // ==== 公開API ====
    setTool(toolName) {
        return this.toolManager.setActiveTool(toolName);
    }
    
    getCurrentTool() {
        const activeTool = this.toolManager.getActiveTool();
        return activeTool ? activeTool.name : null;
    }
    
    getAvailableTools() {
        return this.toolManager.getAvailableTools();
    }
    
    updateBrushSettings(settings) {
        const updates = {};
        
        if ('size' in settings) {
            updates.brushSize = Math.max(0.1, Math.min(100, settings.size));
        }
        if ('color' in settings) {
            updates.brushColor = settings.color;
        }
        if ('opacity' in settings) {
            updates.opacity = Math.max(0, Math.min(1, settings.opacity));
        }
        if ('pressure' in settings) {
            updates.pressure = Math.max(0, Math.min(1, settings.pressure));
        }
        if ('smoothing' in settings) {
            updates.smoothing = Math.max(0, Math.min(1, settings.smoothing));
        }
        
        this.app.updateState(updates);
        console.log('🎨 ブラシ設定更新:', updates);
    }
    
    getBrushSettings() {
        const state = this.app.getState();
        return {
            size: state.brushSize,
            color: state.brushColor,
            opacity: state.opacity,
            pressure: state.pressure,
            smoothing: state.smoothing
        };
    }
    
    // ==== プリセット管理API（UIManager連携用） ====
    getPenPresetManager() {
        return this.penPresetManager;
    }
    
    // ==== パフォーマンス関連 ====
    getPerformanceStats() {
        return {
            ...this.performanceMonitor.getStats(),
            ...this.app.getStats()
        };
    }
    
    // ==== レイヤー関連 ====
    createLayer(name) {
        return this.layerSystem.createLayer(name);
    }
    
    setActiveLayer(layerId) {
        this.layerSystem.setActiveLayer(layerId);
    }
    
    getActiveLayer() {
        return this.layerSystem.getActiveLayer();
    }
    
    // ==== ショートカット関連 ====
    registerShortcut(keyCode, handler) {
        this.shortcutManager.register(keyCode, handler);
    }
    
    enableShortcuts() {
        this.shortcutManager.enable();
    }
    
    disableShortcuts() {
        this.shortcutManager.disable();
    }
    
    // ==== デバッグ・統計 ====
    getSystemStats() {
        return {
            initialized: this.isInitialized,
            currentTool: this.getCurrentTool(),
            availableTools: this.getAvailableTools(),
            brushSettings: this.getBrushSettings(),
            performance: this.getPerformanceStats(),
            layerCount: this.layerSystem.layers.length,
            activeLayer: this.getActiveLayer()?.name,
            presetCount: this.penPresetManager.getPresetCount(),
            activePreset: this.penPresetManager.getActivePreset()?.label
        };
    }
    
    // ==== クリーンアップ ====
    destroy() {
        this.performanceMonitor.stop();
        
        // ツールの非アクティブ化
        if (this.toolManager.activeTool) {
            this.toolManager.activeTool.deactivate();
        }
        
        console.log('DrawingToolsSystem destroyed');
    }
}

// ==== エクスポート ====
if (typeof window !== 'undefined') {
    window.DrawingToolsSystem = DrawingToolsSystem;
    window.ToolManager = ToolManager;
    window.PenPresetManager = PenPresetManager; // 追加
    window.VectorPenTool = VectorPenTool;
    window.EraserTool = EraserTool;
    window.PerformanceMonitor = PerformanceMonitor;
    window.ShortcutManager = ShortcutManager;
    window.LayerSystem = LayerSystem;
}

// ES6 module export (将来のTypeScript移行用)
// export { 
//     DrawingToolsSystem, 
//     ToolManager, 
//     PenPresetManager, // 追加
//     VectorPenTool, 
//     EraserTool, 
//     PerformanceMonitor, 
//     ShortcutManager, 
//     LayerSystem 
// };