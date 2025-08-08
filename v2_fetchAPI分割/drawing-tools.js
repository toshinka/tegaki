/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v0.8
 * 描画ツール群 - drawing-tools.js
 * 
 * 責務: 各描画ツールや機能をクラス化・プリセット管理
 * 依存: app-core.js (PixiDrawingApp, CONFIG, EVENTS)
 */

// ==== プリセット管理システム ====
class PenPresetManager {
    constructor() {
        this.presets = this.initializeDefaultPresets();
        this.activePresetId = '16px';
        this.currentSize = 16.0;
        this.currentOpacity = 85.0;
        this.currentColor = 0x800000;
        
        // プリセット表示制限
        this.PREVIEW_SIZE_MIN = 0.5;
        this.PREVIEW_SIZE_MAX = 20;
    }
    
    initializeDefaultPresets() {
        return new Map([
            ['1px', {
                id: '1px',
                size: 1.0,
                opacity: 85.0,
                color: 0x800000,
                displaySize: 0.5, // 表示用の最小サイズ
                label: '1'
            }],
            ['2px', {
                id: '2px',
                size: 2.0,
                opacity: 85.0,
                color: 0x800000,
                displaySize: 2.0,
                label: '2'
            }],
            ['4px', {
                id: '4px',
                size: 4.0,
                opacity: 85.0,
                color: 0x800000,
                displaySize: 4.0,
                label: '4'
            }],
            ['8px', {
                id: '8px',
                size: 8.0,
                opacity: 85.0,
                color: 0x800000,
                displaySize: 8.0,
                label: '8'
            }],
            ['16px', {
                id: '16px',
                size: 16.0,
                opacity: 85.0,
                color: 0x800000,
                displaySize: 16.0,
                label: '16'
            }],
            ['32px', {
                id: '32px',
                size: 32.0,
                opacity: 85.0,
                color: 0x800000,
                displaySize: 20.0, // 表示用の最大サイズ
                label: '32'
            }]
        ]);
    }
    
    // ==== プリセット操作 ====
    setActivePreset(presetId) {
        const preset = this.presets.get(presetId);
        if (!preset) {
            console.warn(`未知のプリセット: ${presetId}`);
            return false;
        }
        
        this.activePresetId = presetId;
        this.currentSize = preset.size;
        this.currentOpacity = preset.opacity;
        this.currentColor = preset.color;
        
        console.log(`プリセット適用: ${presetId} (size: ${preset.size}px, opacity: ${preset.opacity}%)`);
        return true;
    }
    
    getActivePreset() {
        return this.presets.get(this.activePresetId);
    }
    
    updateActivePresetLive(size, opacity, color = null) {
        // アクティブなプリセットのライブ更新（プレビュー用）
        this.currentSize = size;
        this.currentOpacity = opacity;
        if (color !== null) {
            this.currentColor = color;
        }
        
        // プリセット自体は更新せず、表示のみ更新
        return this.generatePreviewData();
    }
    
    // ==== プレビューデータ生成 ====
    generatePreviewData() {
        const previewData = [];
        
        this.presets.forEach(preset => {
            const isActive = preset.id === this.activePresetId;
            
            // アクティブなプリセットは現在の値を使用
            const displaySize = isActive ? this.currentSize : preset.size;
            const displayOpacity = isActive ? this.currentOpacity : preset.opacity;
            const displayColor = isActive ? this.currentColor : preset.color;
            
            // 表示用サイズの制限適用
            const clampedDisplaySize = Math.max(
                this.PREVIEW_SIZE_MIN,
                Math.min(this.PREVIEW_SIZE_MAX, displaySize)
            );
            
            previewData.push({
                id: preset.id,
                label: isActive ? displaySize.toFixed(1) : preset.label,
                size: clampedDisplaySize,
                opacity: displayOpacity,
                color: this.colorToHex(displayColor),
                isActive: isActive,
                originalSize: displaySize
            });
        });
        
        return previewData;
    }
    
    // ==== カラーヘルパー ====
    colorToHex(color) {
        if (typeof color === 'string') return color;
        return '#' + color.toString(16).padStart(6, '0');
    }
    
    hexToColor(hex) {
        if (typeof hex === 'number') return hex;
        return parseInt(hex.replace('#', ''), 16);
    }
    
    // ==== プリセット拡張機能 ====
    addCustomPreset(id, size, opacity, color) {
        const preset = {
            id,
            size: Math.max(0.1, Math.min(100, size)),
            opacity: Math.max(0, Math.min(100, opacity)),
            color: typeof color === 'string' ? this.hexToColor(color) : color,
            displaySize: Math.max(
                this.PREVIEW_SIZE_MIN,
                Math.min(this.PREVIEW_SIZE_MAX, size)
            ),
            label: size.toString(),
            isCustom: true
        };
        
        this.presets.set(id, preset);
        console.log(`カスタムプリセット追加: ${id}`);
        return preset;
    }
    
    removeCustomPreset(presetId) {
        const preset = this.presets.get(presetId);
        if (preset && preset.isCustom) {
            this.presets.delete(presetId);
            
            // アクティブなプリセットが削除された場合、デフォルトに戻す
            if (this.activePresetId === presetId) {
                this.setActivePreset('16px');
            }
            
            console.log(`カスタムプリセット削除: ${presetId}`);
            return true;
        }
        return false;
    }
    
    getAllPresets() {
        return Array.from(this.presets.values());
    }
}

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
        this.presetManager = new PenPresetManager();
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
    
    // ==== プリセット操作API ====
    setPreset(presetId) {
        return this.presetManager.setActivePreset(presetId);
    }
    
    updatePresetLive(size, opacity, color = null) {
        return this.presetManager.updateActivePresetLive(size, opacity, color);
    }
    
    getPresetPreviewData() {
        return this.presetManager.generatePreviewData();
    }
    
    getActivePreset() {
        return this.presetManager.getActivePreset();
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
    
    // ==== プリセット管理API ====
    getPenPresetManager() {
        const penTool = this.tools.get('pen');
        return penTool ? penTool.presetManager : null;
    }
    
    setPenPreset(presetId) {
        const penTool = this.tools.get('pen');
        return penTool ? penTool.setPreset(presetId) : false;
    }
    
    updatePenPresetLive(size, opacity, color = null) {
        const penTool = this.tools.get('pen');
        return penTool ? penTool.updatePresetLive(size, opacity, color) : null;
    }
    
    getPenPresetPreviewData() {
        const penTool = this.tools.get('pen');
        return penTool ? penTool.getPresetPreviewData() : [];
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
        
        // プリセット選択（1-6キー）
        this.register('Digit1', () => this.toolManager.setPenPreset('1px'));
        this.register('Digit2', () => this.toolManager.setPenPreset('2px'));
        this.register('Digit3', () => this.toolManager.setPenPreset('4px'));
        this.register('Digit4', () => this.toolManager.setPenPreset('8px'));
        this.register('Digit5', () => this.toolManager.setPenPreset('16px'));
        this.register('Digit6', () => this.toolManager.setPenPreset('32px'));
        
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