/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1.2
 * 描画ツール群 - drawing-tools.js (履歴管理統合版)
 * 
 * 責務: 各描画ツールや機能をクラス化・履歴管理との統合
 * 依存: app-core.js (PixiDrawingApp, CONFIG, EVENTS), history-manager.js
 */

// ==== ベースツールクラス ====
class BaseTool {
    constructor(name, app, historyManager = null) {
        this.name = name;
        this.app = app;
        this.historyManager = historyManager;
        this.isActive = false;
        this.currentPath = null;
        this.operationStartState = null; // 履歴管理用の開始状態
    }
    
    activate() {
        this.isActive = true;
        this.onActivate();
    }
    
    deactivate() {
        this.isActive = false;
        this.onDeactivate();
    }
    
    // 操作開始時の状態キャプチャ
    captureStartState() {
        if (this.historyManager) {
            this.operationStartState = StateCapture.captureDrawingState(this.app);
        }
    }
    
    // 操作終了時の履歴記録
    recordOperation() {
        if (this.historyManager && this.operationStartState) {
            this.historyManager.recordDrawingOperation(
                this.name, 
                this.operationStartState
            );
            this.operationStartState = null;
        }
    }
    
    // 抽象メソッド（サブクラスで実装）
    onActivate() {}
    onDeactivate() {}
    onPointerDown(x, y, event) {}
    onPointerMove(x, y, event) {}
    onPointerUp(x, y, event) {}
}

// ==== ベクターペンツール（履歴管理対応版）====
class VectorPenTool extends BaseTool {
    constructor(app, historyManager = null) {
        super('pen', app, historyManager);
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
        // 履歴管理：操作開始状態をキャプチャ
        this.captureStartState();
        
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
            
            // 履歴管理：描画操作を記録
            this.recordOperation();
            
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
        this.operationStartState = null;
    }
}

// ==== 消しゴムツール（履歴管理対応版）====
class EraserTool extends BaseTool {
    constructor(app, historyManager = null) {
        super('eraser', app, historyManager);
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
        // 履歴管理：操作開始状態をキャプチャ
        this.captureStartState();
        
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
            
            // 履歴管理：消しゴム操作を記録
            this.recordOperation();
            
            console.log(`消しゴム終了: パス完成`);
        }
        
        this.cleanup();
    }
    
    cleanup() {
        this.currentPath = null;
        this.lastPoint = null;
        this.operationStartState = null;
    }
}

// ==== ペンプリセット管理クラス（履歴管理対応版）====
class PenPresetManager {
    constructor(drawingToolsSystem, historyManager = null) {
        this.drawingToolsSystem = drawingToolsSystem;
        this.historyManager = historyManager;
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
        console.log('✅ ペンプリセット初期化完了（履歴管理対応版）');
    }
    
    selectPreset(presetId) {
        if (!this.presets.has(presetId)) return false;
        
        // 履歴管理：変更前の状態をキャプチャ
        const beforeState = this.historyManager ? 
            StateCapture.capturePresetState(this) : null;
        
        // プリセット選択実行
        this.activePresetId = presetId;
        this.currentLiveValues = null;
        
        const preset = this.presets.get(presetId);
        
        // 履歴管理：変更後の状態を記録
        if (this.historyManager && beforeState) {
            const afterState = StateCapture.capturePresetState(this);
            this.historyManager.recordPresetChange(beforeState, afterState);
        }
        
        console.log('🎯 プリセット選択（履歴対応）:', presetId, preset);
        
        return preset;
    }
    
    updateActivePresetLive(size, opacity, color = null) {
        if (!this.activePresetId) return;
        
        const activePreset = this.presets.get(this.activePresetId);
        if (!activePreset) return;
        
        this.currentLiveValues = {
            size: size,
            opacity: opacity,
            color: color || activePreset.color
        };
        
        console.log('🎨 ライブプレビュー更新（履歴対応）:', {
            preset: this.activePresetId,
            size: size,
            opacity: opacity
        });
    }
    
    generatePreviewData() {
        const previewData = [];
        
        this.presets.forEach((preset, presetId) => {
            const isActive = presetId === this.activePresetId;
            
            let displayValues = preset;
            if (isActive && this.currentLiveValues) {
                displayValues = {
                    ...preset,
                    size: this.currentLiveValues.size,
                    opacity: this.currentLiveValues.opacity,
                    color: this.currentLiveValues.color
                };
            }
            
            const displaySize = Math.min(20, Math.max(0.5, displayValues.size));
            
            previewData.push({
                id: presetId,
                dataSize: preset.size,
                size: displaySize,
                opacity: displayValues.opacity,
                color: this.colorToHex(displayValues.color),
                label: displayValues.size.toFixed(1),
                opacityLabel: Math.round(displayValues.opacity * 100) + '%',
                isActive: isActive
            });
        });
        
        return previewData;
    }
    
    getPresetIdBySize(size) {
        for (const [presetId, preset] of this.presets) {
            if (Math.abs(preset.size - size) < 0.1) {
                return presetId;
            }
        }
        return null;
    }
    
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
    
    // 履歴復元用のプリセットデータ適用
    applyPresetData(presetId, presetData) {
        if (!presetId || !presetData) return false;
        
        try {
            this.activePresetId = presetData.activePresetId || presetId;
            this.currentLiveValues = presetData.currentLiveValues ? 
                { ...presetData.currentLiveValues } : null;
            
            console.log('🔄 プリセットデータ復元:', presetId, presetData);
            return true;
        } catch (error) {
            console.error('プリセットデータ適用エラー:', error);
            return false;
        }
    }
}

// ==== ツール管理システム（履歴管理統合版）====
class ToolManager {
    constructor(app, historyManager = null) {
        this.app = app;
        this.historyManager = historyManager;
        this.tools = new Map();
        this.activeTool = null;
        
        this.initializeTools();
    }
    
    initializeTools() {
        // 履歴管理対応版ツールを登録
        this.registerTool('pen', new VectorPenTool(this.app, this.historyManager));
        this.registerTool('eraser', new EraserTool(this.app, this.historyManager));
        
        console.log(`✅ ${this.tools.size}個のツールを登録完了（履歴管理対応版）`);
    }
    
    registerTool(name, tool) {
        this.tools.set(name, tool);
        console.log(`🔧 ツール登録（履歴対応）: ${name}`);
    }
    
    setActiveTool(toolName) {
        if (!this.tools.has(toolName)) {
            console.warn(`未知のツール: ${toolName}`);
            return false;
        }
        
        // 履歴管理：ツール変更を記録
        const beforeTool = this.activeTool ? this.activeTool.name : null;
        
        // 現在のツールを非アクティブ化
        if (this.activeTool) {
            this.activeTool.deactivate();
        }
        
        // 新しいツールをアクティブ化
        this.activeTool = this.tools.get(toolName);
        this.activeTool.activate();
        
        // 履歴管理：ツール変更を記録
        if (this.historyManager && beforeTool !== toolName) {
            this.historyManager.recordToolChange(beforeTool, toolName);
        }
        
        console.log(`🔄 ツール切り替え（履歴対応）: ${toolName}`);
        return true;
    }
    
    getActiveTool() {
        return this.activeTool;
    }
    
    getAvailableTools() {
        return Array.from(this.tools.keys());
    }
}

// ==== ショートカット管理システム（履歴管理対応版）====
class ShortcutManager {
    constructor(toolManager, app, historyManager = null) {
        this.toolManager = toolManager;
        this.app = app;
        this.historyManager = historyManager;
        this.shortcuts = new Map();
        this.isEnabled = true;
    }
    
    init() {
        this.registerDefaultShortcuts();
        this.setupEventListeners();
        console.log('⌨️ ショートカットシステム初期化完了（履歴管理対応版）');
    }
    
    registerDefaultShortcuts() {
        // ツール切り替え
        this.register('KeyB', () => this.toolManager.setActiveTool('pen'));
        this.register('KeyE', () => this.toolManager.setActiveTool('eraser'));
        
        // 操作系
        this.register('Escape', () => this.clearCanvasWithHistory());
        
        // 🎯 履歴管理ショートカット（メインの追加機能）
        this.register('KeyZ', (e) => {
            if (e.ctrlKey && !e.shiftKey) {
                e.preventDefault();
                this.executeUndo();
            }
        });
        
        this.register('KeyY', (e) => {
            if (e.ctrlKey) {
                e.preventDefault();
                this.executeRedo();
            }
        });
        
        // Ctrl+Shift+Z でもリドゥ対応（Photoshop風）
        this.register('KeyZ', (e) => {
            if (e.ctrlKey && e.shiftKey) {
                e.preventDefault();
                this.executeRedo();
            }
        });
        
        console.log('⌨️ 履歴管理ショートカット登録完了:');
        console.log('  - Ctrl+Z: アンドゥ');
        console.log('  - Ctrl+Y: リドゥ');
        console.log('  - Ctrl+Shift+Z: リドゥ');
    }
    
    // 履歴管理付きキャンバスクリア
    clearCanvasWithHistory() {
        if (this.historyManager) {
            this.historyManager.recordCanvasClear();
        }
        this.app.clear();
    }
    
    // アンドゥ実行
    executeUndo() {
        if (!this.historyManager) {
            console.warn('履歴管理システムが利用できません');
            return false;
        }
        
        const success = this.historyManager.undo();
        
        if (!success) {
            // アンドゥできない場合の通知（音や視覚効果なし、ログのみ）
            console.log('アンドゥ: 実行できる履歴がありません');
        }
        
        return success;
    }
    
    // リドゥ実行
    executeRedo() {
        if (!this.historyManager) {
            console.warn('履歴管理システムが利用できません');
            return false;
        }
        
        const success = this.historyManager.redo();
        
        if (!success) {
            // リドゥできない場合の通知（音や視覚効果なし、ログのみ）
            console.log('リドゥ: 実行できる履歴がありません');
        }
        
        return success;
    }
    
    register(keyCode, handler) {
        if (!this.shortcuts.has(keyCode)) {
            this.shortcuts.set(keyCode, []);
        }
        this.shortcuts.get(keyCode).push(handler);
        console.log(`⌨️ ショートカット登録: ${keyCode}`);
    }
    
    setupEventListeners() {
        document.addEventListener('keydown', (event) => {
            if (!this.isEnabled) return;
            
            const handlers = this.shortcuts.get(event.code);
            if (handlers) {
                for (const handler of handlers) {
                    try {
                        if (handler(event) !== false) {
                            // ハンドラーがfalseを返さない限り、以降のハンドラーは実行しない
                            break;
                        }
                    } catch (error) {
                        console.error(`ショートカットハンドラーエラー (${event.code}):`, error);
                    }
                }
            }
        });
    }
    
    enable() {
        this.isEnabled = true;
        console.log('⌨️ ショートカット有効化');
    }
    
    disable() {
        this.isEnabled = false;
        console.log('⌨️ ショートカット無効化');
    }
    
    // 現在のショートカット一覧を取得
    getRegisteredShortcuts() {
        const shortcuts = {};
        this.shortcuts.forEach((handlers, keyCode) => {
            shortcuts[keyCode] = handlers.length;
        });
        return shortcuts;
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
        
        // メモリ使用量表示
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

// ==== メインツールシステム統合クラス（履歴管理統合版）====
class DrawingToolsSystem {
    constructor(app) {
        this.app = app;
        
        // 履歴管理システムを最初に初期化
        this.historyManager = null; // init()で初期化される
        
        // その他のシステム（履歴管理を依存として渡す）
        this.toolManager = null;
        this.penPresetManager = null;
        this.performanceMonitor = new PerformanceMonitor();
        this.shortcutManager = null;
        this.layerSystem = new LayerSystem(app);
        
        this.isInitialized = false;
    }
    
    async init() {
        try {
            console.log('🎯 DrawingToolsSystem初期化開始（履歴管理統合版）...');
            
            // 1. 履歴管理システムを最初に初期化
            this.historyManager = new HistoryManager(this.app, this);
            
            // 2. 履歴管理を依存として他システムを初期化
            this.toolManager = new ToolManager(this.app, this.historyManager);
            this.penPresetManager = new PenPresetManager(this, this.historyManager);
            this.shortcutManager = new ShortcutManager(
                this.toolManager, 
                this.app, 
                this.historyManager
            );
            
            // 3. 各サブシステムの初期化
            this.layerSystem.init();
            this.shortcutManager.init();
            
            // 4. デフォルトツールをアクティブ化
            this.toolManager.setActiveTool('pen');
            
            // 5. パフォーマンス監視開始
            this.performanceMonitor.start();
            
            this.isInitialized = true;
            console.log('✅ DrawingToolsSystem初期化完了（履歴管理統合版）');
            console.log('🏛️ 履歴管理機能:');
            console.log('  - Ctrl+Z: アンドゥ');
            console.log('  - Ctrl+Y: リドゥ');
            console.log('  - Ctrl+Shift+Z: リドゥ（代替）');
            console.log('  - 描画操作自動記録');
            console.log('  - プリセット変更記録');
            console.log('  - ツール変更記録');
            
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
        // 履歴管理：変更前の設定をキャプチャ
        const beforeSettings = this.historyManager ? 
            StateCapture.captureBrushSettings(this) : null;
        
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
        
        // 履歴管理：変更後の設定を記録
        if (this.historyManager && beforeSettings) {
            const afterSettings = StateCapture.captureBrushSettings(this);
            this.historyManager.recordBrushSettingChange(beforeSettings, afterSettings);
        }
        
        console.log('🎨 ブラシ設定更新（履歴対応）:', updates);
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
    
    // ==== 履歴管理関連API ====
    
    /**
     * 履歴管理システムへのアクセサー
     */
    getHistoryManager() {
        return this.historyManager;
    }
    
    /**
     * PenPresetManagerへのアクセサー
     */
    getPenPresetManager() {
        return this.penPresetManager;
    }
    
    /**
     * アンドゥ実行
     */
    undo() {
        return this.historyManager ? this.historyManager.undo() : false;
    }
    
    /**
     * リドゥ実行
     */
    redo() {
        return this.historyManager ? this.historyManager.redo() : false;
    }
    
    /**
     * アンドゥ可能状態
     */
    canUndo() {
        return this.historyManager ? this.historyManager.canUndo() : false;
    }
    
    /**
     * リドゥ可能状態
     */
    canRedo() {
        return this.historyManager ? this.historyManager.canRedo() : false;
    }
    
    /**
     * 履歴統計取得
     */
    getHistoryStats() {
        return this.historyManager ? this.historyManager.getStats() : null;
    }
    
    /**
     * 履歴リスト取得（デバッグ用）
     */
    getHistoryList() {
        return this.historyManager ? this.historyManager.getHistoryList() : [];
    }
    
    /**
     * 履歴記録の有効/無効切り替え
     */
    setHistoryRecording(enabled) {
        if (this.historyManager) {
            return this.historyManager.setRecording(enabled);
        }
        return false;
    }
    
    /**
     * 履歴クリア
     */
    clearHistory() {
        if (this.historyManager) {
            this.historyManager.clearHistory();
        }
    }
    
    // ==== パフォーマンス関連 ====
    getPerformanceStats() {
        const baseStats = this.performanceMonitor.getStats();
        const appStats = this.app.getStats();
        const historyStats = this.getHistoryStats();
        
        return {
            ...baseStats,
            ...appStats,
            history: historyStats
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
    
    getRegisteredShortcuts() {
        return this.shortcutManager.getRegisteredShortcuts();
    }
    
    // ==== デバッグ・統計 ====
    getSystemStats() {
        const historyStats = this.getHistoryStats();
        
        return {
            initialized: this.isInitialized,
            currentTool: this.getCurrentTool(),
            availableTools: this.getAvailableTools(),
            brushSettings: this.getBrushSettings(),
            performance: this.getPerformanceStats(),
            layerCount: this.layerSystem.layers.length,
            activeLayer: this.getActiveLayer()?.name,
            history: {
                canUndo: this.canUndo(),
                canRedo: this.canRedo(),
                totalRecorded: historyStats?.totalRecorded || 0,
                currentIndex: historyStats?.currentIndex || -1,
                memoryUsageMB: historyStats?.memoryUsageMB || 0
            },
            shortcuts: this.getRegisteredShortcuts()
        };
    }
    
    // ==== デバッグメソッド ====
    
    /**
     * 履歴の詳細表示（デバッグ用）
     */
    debugHistory() {
        if (this.historyManager) {
            this.historyManager.debugHistory();
        } else {
            console.warn('履歴管理システムが利用できません');
        }
    }
    
    /**
     * 履歴デバッグモードの切り替え
     */
    toggleHistoryDebug() {
        if (this.historyManager) {
            this.historyManager.toggleDebugMode();
        }
    }
    
    /**
     * システム全体のデバッグ情報表示
     */
    debugSystem() {
        console.group('🔍 DrawingToolsSystem デバッグ情報');
        console.log('システム統計:', this.getSystemStats());
        
        if (this.historyManager) {
            console.log('履歴統計:', this.getHistoryStats());
            console.log('履歴リスト:', this.getHistoryList());
        }
        
        console.log('ショートカット:', this.getRegisteredShortcuts());
        console.groupEnd();
    }
    
    // ==== テスト用メソッド ====
    
    /**
     * 履歴機能のテスト実行
     */
    testHistoryFunction() {
        console.group('🧪 履歴機能テスト');
        
        // 1. 現在の状態を確認
        console.log('1. 初期状態:', {
            canUndo: this.canUndo(),
            canRedo: this.canRedo(),
            historyLength: this.getHistoryStats()?.historyLength || 0
        });
        
        // 2. ダミーのブラシ設定変更
        console.log('2. ブラシ設定変更実行...');
        this.updateBrushSettings({ size: 20, opacity: 0.7 });
        
        // 3. 変更後の状態確認
        console.log('3. 変更後の状態:', {
            canUndo: this.canUndo(),
            canRedo: this.canRedo(),
            historyLength: this.getHistoryStats()?.historyLength || 0
        });
        
        // 4. アンドゥテスト
        console.log('4. アンドゥ実行...');
        const undoResult = this.undo();
        console.log('アンドゥ結果:', undoResult);
        
        // 5. アンドゥ後の状態確認
        console.log('5. アンドゥ後の状態:', {
            canUndo: this.canUndo(),
            canRedo: this.canRedo(),
            brushSettings: this.getBrushSettings()
        });
        
        // 6. リドゥテスト
        console.log('6. リドゥ実行...');
        const redoResult = this.redo();
        console.log('リドゥ結果:', redoResult);
        
        // 7. 最終状態確認
        console.log('7. 最終状態:', {
            canUndo: this.canUndo(),
            canRedo: this.canRedo(),
            brushSettings: this.getBrushSettings()
        });
        
        console.groupEnd();
    }
    
    // ==== クリーンアップ ====
    destroy() {
        console.log('🎯 DrawingToolsSystem破棄開始...');
        
        // パフォーマンス監視停止
        this.performanceMonitor.stop();
        
        // ツールの非アクティブ化
        if (this.toolManager && this.toolManager.activeTool) {
            this.toolManager.activeTool.deactivate();
        }
        
        // 履歴管理システムの破棄
        if (this.historyManager) {
            this.historyManager.destroy();
        }
        
        // 参照のクリア
        this.historyManager = null;
        this.toolManager = null;
        this.penPresetManager = null;
        this.shortcutManager = null;
        
        console.log('✅ DrawingToolsSystem破棄完了');
    }
}

// ==== エクスポート ====
if (typeof window !== 'undefined') {
    window.DrawingToolsSystem = DrawingToolsSystem;
    window.ToolManager = ToolManager;
    window.VectorPenTool = VectorPenTool;
    window.EraserTool = EraserTool;
    window.PenPresetManager = PenPresetManager;
    window.PerformanceMonitor = PerformanceMonitor;
    window.ShortcutManager = ShortcutManager;
    window.LayerSystem = LayerSystem;
}

// ES6 module export (将来のTypeScript移行用)
// export { 
//     DrawingToolsSystem, 
//     ToolManager, 
//     VectorPenTool, 
//     EraserTool, 
//     PenPresetManager,
//     PerformanceMonitor, 
//     ShortcutManager, 
//     LayerSystem 
// };