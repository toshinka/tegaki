/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1rev13
 * 描画ツール群 - drawing-tools.js (緊急復旧版・重複定義解消)
 * 
 * 🚑 緊急修正内容（重複定義解消）:
 * 1. ✅ 全クラス定義を統合ファイルに戻す
 * 2. ✅ モジュール分割ファイルとの重複を解消
 * 3. ✅ DrawingToolsSystem の正常動作復旧
 * 4. ✅ main.js 初期化エラーの解消
 * 
 * 責務: 各描画ツール（ペン・消しゴム）とツール管理のみ
 * 依存: app-core.js (PixiDrawingApp, CONFIG, EVENTS), history-manager.js
 * 
 * 重要: 分割ファイルは一時的に無効化し、このファイルに統合
 */

console.log('🚑 drawing-tools.js 緊急復旧版読み込み開始...');

// ==== EVENTS定数の安全取得 ====
const DRAWING_TOOLS_EVENTS = window.EVENTS || {
    POINTER_DOWN: 'pointerdown',
    POINTER_MOVE: 'pointermove', 
    POINTER_UP: 'pointerup',
    POINTER_UP_OUTSIDE: 'pointerupoutside'
};

// ==== ベースツールクラス（統合版）====
class BaseToolIntegrated {
    constructor(name, app, historyManager = null) {
        this.name = name;
        this.app = app;
        this.historyManager = historyManager;
        this.isActive = false;
        this.currentPath = null;
        this.operationStartState = null;
        this.lastPoint = null;
        
        console.log(`🔧 BaseToolIntegrated初期化: ${name}（緊急復旧版）`);
    }
    
    activate() {
        this.isActive = true;
        this.onActivate();
        console.log(`🔴 ${this.name} アクティブ化完了（緊急復旧版）`);
    }
    
    deactivate() {
        this.isActive = false;
        this.onDeactivate();
        this.cleanup();
        console.log(`⚫ ${this.name} 非アクティブ化完了（緊急復旧版）`);
    }
    
    setHistoryManager(historyManager) {
        this.historyManager = historyManager;
        console.log(`📚 ${this.name}: 履歴管理システム設定完了（緊急復旧版）`);
    }
    
    captureStartState() {
        if (this.historyManager && window.InternalStateCapture) {
            this.operationStartState = window.InternalStateCapture.captureDrawingState(this.app);
        }
    }
    
    recordOperation() {
        if (this.historyManager && this.operationStartState) {
            this.historyManager.recordDrawingOperation(this.name, this.operationStartState);
            this.operationStartState = null;
        }
    }
    
    cleanup() {
        this.currentPath = null;
        this.lastPoint = null;
        this.operationStartState = null;
    }
    
    // 抽象メソッド
    onActivate() {}
    onDeactivate() {}
    onPointerDown(x, y, event) {}
    onPointerMove(x, y, event) {}
    onPointerUp(x, y, event) {}
}

// ==== ベクターペンツール（統合版）====
class VectorPenToolIntegrated extends BaseToolIntegrated {
    constructor(app, historyManager = null) {
        super('pen', app, historyManager);
        this.smoothingBuffer = [];
        this.maxBufferSize = 5;
    }
    
    onActivate() {
        console.log('🖊️ ベクターペンツール アクティブ（緊急復旧版）');
        this.app.updateState({ currentTool: 'pen' });
        this.setupEventListeners();
    }
    
    onDeactivate() {
        this.cleanup();
    }
    
    setupEventListeners() {
        const drawingLayer = this.app.layers.drawingLayer;
        
        drawingLayer.on(DRAWING_TOOLS_EVENTS.POINTER_DOWN, (event) => {
            if (!this.isActive) return;
            const point = this.app.getLocalPointerPosition(event);
            this.onPointerDown(point.x, point.y, event);
        });
        
        drawingLayer.on(DRAWING_TOOLS_EVENTS.POINTER_MOVE, (event) => {
            if (!this.isActive) return;
            const point = this.app.getLocalPointerPosition(event);
            this.onPointerMove(point.x, point.y, event);
        });
        
        drawingLayer.on(DRAWING_TOOLS_EVENTS.POINTER_UP, (event) => {
            if (!this.isActive) return;
            const point = this.app.getLocalPointerPosition(event);
            this.onPointerUp(point.x, point.y, event);
        });
        
        drawingLayer.on(DRAWING_TOOLS_EVENTS.POINTER_UP_OUTSIDE, (event) => {
            if (!this.isActive) return;
            this.onPointerUp(0, 0, event);
        });
    }
    
    onPointerDown(x, y, event) {
        this.captureStartState();
        this.currentPath = this.app.createPath(x, y, 'pen');
        this.lastPoint = { x, y };
        this.smoothingBuffer = [{ x, y }];
        console.log(`ペン開始: (${x.toFixed(1)}, ${y.toFixed(1)})（緊急復旧版）`);
    }
    
    onPointerMove(x, y, event) {
        if (!this.currentPath || !this.app.state.isDrawing) return;
        
        const smoothedPoint = this.applySmoothingFilter(x, y);
        this.app.extendPath(this.currentPath, smoothedPoint.x, smoothedPoint.y);
        this.lastPoint = smoothedPoint;
    }
    
    onPointerUp(x, y, event) {
        if (this.currentPath) {
            this.app.finalizePath(this.currentPath);
            this.recordOperation();
            console.log(`ペン終了: パス完成（緊急復旧版）`);
        }
        this.cleanup();
    }
    
    applySmoothingFilter(x, y) {
        const smoothing = this.app.state.smoothing || 0;
        
        if (smoothing === 0 || this.smoothingBuffer.length === 0) {
            this.smoothingBuffer.push({ x, y });
            return { x, y };
        }
        
        this.smoothingBuffer.push({ x, y });
        if (this.smoothingBuffer.length > this.maxBufferSize) {
            this.smoothingBuffer.shift();
        }
        
        const bufferLength = this.smoothingBuffer.length;
        const avgX = this.smoothingBuffer.reduce((sum, p) => sum + p.x, 0) / bufferLength;
        const avgY = this.smoothingBuffer.reduce((sum, p) => sum + p.y, 0) / bufferLength;
        
        const smoothedX = x + (avgX - x) * smoothing;
        const smoothedY = y + (avgY - y) * smoothing;
        
        return { x: smoothedX, y: smoothedY };
    }
    
    cleanup() {
        super.cleanup();
        this.smoothingBuffer = [];
    }
}

// ==== 消しゴムツール（統合版）====
class EraserToolIntegrated extends BaseToolIntegrated {
    constructor(app, historyManager = null) {
        super('eraser', app, historyManager);
    }
    
    onActivate() {
        console.log('🧽 消しゴムツール アクティブ（緊急復旧版）');
        this.app.updateState({ currentTool: 'eraser' });
        this.setupEventListeners();
    }
    
    onDeactivate() {
        this.cleanup();
    }
    
    setupEventListeners() {
        const drawingLayer = this.app.layers.drawingLayer;
        
        drawingLayer.on(DRAWING_TOOLS_EVENTS.POINTER_DOWN, (event) => {
            if (!this.isActive) return;
            const point = this.app.getLocalPointerPosition(event);
            this.onPointerDown(point.x, point.y, event);
        });
        
        drawingLayer.on(DRAWING_TOOLS_EVENTS.POINTER_MOVE, (event) => {
            if (!this.isActive) return;
            const point = this.app.getLocalPointerPosition(event);
            this.onPointerMove(point.x, point.y, event);
        });
        
        drawingLayer.on(DRAWING_TOOLS_EVENTS.POINTER_UP, (event) => {
            if (!this.isActive) return;
            const point = this.app.getLocalPointerPosition(event);
            this.onPointerUp(point.x, point.y, event);
        });
        
        drawingLayer.on(DRAWING_TOOLS_EVENTS.POINTER_UP_OUTSIDE, (event) => {
            if (!this.isActive) return;
            this.onPointerUp(0, 0, event);
        });
    }
    
    onPointerDown(x, y, event) {
        this.captureStartState();
        this.currentPath = this.app.createPath(x, y, 'eraser');
        this.lastPoint = { x, y };
        console.log(`消しゴム開始: (${x.toFixed(1)}, ${y.toFixed(1)})（緊急復旧版）`);
    }
    
    onPointerMove(x, y, event) {
        if (!this.currentPath || !this.app.state.isDrawing) return;
        
        this.app.extendPath(this.currentPath, x, y);
        this.lastPoint = { x, y };
    }
    
    onPointerUp(x, y, event) {
        if (this.currentPath) {
            this.app.finalizePath(this.currentPath);
            this.recordOperation();
            console.log(`消しゴム終了: パス完成（緊急復旧版）`);
        }
        this.cleanup();
    }
}

// ==== ツール管理システム（統合版）====
class ToolManagerIntegrated {
    constructor(app, historyManager = null) {
        this.app = app;
        this.historyManager = historyManager;
        this.tools = new Map();
        this.activeTool = null;
        
        this.initializeTools();
        console.log('🔧 ToolManagerIntegrated初期化完了（緊急復旧版）');
    }
    
    initializeTools() {
        this.registerTool('pen', new VectorPenToolIntegrated(this.app, this.historyManager));
        this.registerTool('eraser', new EraserToolIntegrated(this.app, this.historyManager));
        console.log(`✅ ${this.tools.size}個のツールを登録完了（緊急復旧版）`);
    }
    
    setHistoryManager(historyManager) {
        this.historyManager = historyManager;
        this.tools.forEach(tool => {
            if (tool.setHistoryManager) {
                tool.setHistoryManager(historyManager);
            }
        });
        console.log('🔧 ToolManagerIntegrated: 履歴管理システム設定完了（緊急復旧版）');
    }
    
    registerTool(name, tool) {
        this.tools.set(name, tool);
        console.log(`🔧 ツール登録（緊急復旧版）: ${name}`);
    }
    
    setActiveTool(toolName) {
        if (!this.tools.has(toolName)) {
            console.warn(`未知のツール: ${toolName}`);
            return false;
        }
        
        const beforeTool = this.activeTool ? this.activeTool.name : null;
        
        if (this.activeTool) {
            this.activeTool.deactivate();
        }
        
        this.activeTool = this.tools.get(toolName);
        this.activeTool.activate();
        
        if (this.historyManager && beforeTool !== toolName) {
            this.historyManager.recordToolChange(beforeTool, toolName);
        }
        
        console.log(`🔄 ツール切り替え（緊急復旧版）: ${toolName}`);
        return true;
    }
    
    getActiveTool() {
        return this.activeTool;
    }
    
    getAvailableTools() {
        return Array.from(this.tools.keys());
    }
    
    getAllTools() {
        return this.tools;
    }
    
    getTool(name) {
        return this.tools.get(name);
    }
}

// ==== メインツールシステム統合クラス（緊急復旧版）====
class DrawingToolsSystemEmergencyFix {
    constructor(app) {
        this.app = app;
        this.historyManager = null;
        this.toolManager = null;
        this.uiManager = null;
        this.isInitialized = false;
        
        console.log('🚑 DrawingToolsSystemEmergencyFix初期化開始...');
    }
    
    async init() {
        try {
            console.log('🚑 DrawingToolsSystemEmergencyFix初期化開始（緊急復旧版）...');
            
            // 1. ツールマネージャーの初期化
            this.toolManager = new ToolManagerIntegrated(this.app, null);
            
            // 2. デフォルトツールをアクティブ化
            this.toolManager.setActiveTool('pen');
            
            // 3. 履歴管理システムの初期化
            this.historyManager = new HistoryManager(this.app, this);
            
            // 4. ツールマネージャーに履歴管理を設定
            this.toolManager.setHistoryManager(this.historyManager);
            
            this.isInitialized = true;
            console.log('✅ DrawingToolsSystemEmergencyFix初期化完了（緊急復旧版）');
            
        } catch (error) {
            console.error('❌ DrawingToolsSystemEmergencyFix初期化エラー:', error);
            throw error;
        }
    }
    
    // UIManager設定
    setUIManager(uiManager) {
        this.uiManager = uiManager;
        if (this.historyManager) {
            this.historyManager.setUIManager(uiManager);
        }
        console.log('🔧 DrawingToolsSystemEmergencyFix: UIManager設定完了');
    }
    
    // PenPresetManager取得
    getPenPresetManager() {
        if (this.uiManager && this.uiManager.getPenPresetManager) {
            return this.uiManager.getPenPresetManager();
        }
        
        if (typeof window !== 'undefined' && window.uiManager && window.uiManager.getPenPresetManager) {
            return window.uiManager.getPenPresetManager();
        }
        
        console.warn('PenPresetManagerが見つかりません（緊急復旧版）');
        return null;
    }
    
    // ==== 公開API ====
    setTool(toolName) {
        return this.toolManager.setActiveTool(toolName);
    }
    
    getCurrentTool() {
        const activeTool = this.toolManager.getActiveTool();
        if (!activeTool) {
            console.warn('getCurrentTool(): アクティブツールが設定されていません（緊急復旧版）');
            return null;
        }
        return activeTool.name;
    }
    
    getAvailableTools() {
        return this.toolManager.getAvailableTools();
    }
    
    // Phase2: ブラシ設定更新（緊急復旧版・範囲拡張対応）
    updateBrushSettings(settings) {
        const beforeSettings = this.historyManager && window.InternalStateCapture ? 
            window.InternalStateCapture.captureBrushSettings(this) : null;
        
        const updates = {};
        
        // Phase2: ペンサイズ範囲の拡張（0.1 ～ 500）
        if ('size' in settings) {
            const minSize = this.safeConfigGet('MIN_BRUSH_SIZE', 0.1);
            const maxSize = this.safeConfigGet('MAX_BRUSH_SIZE', 500);
            
            updates.brushSize = Math.max(minSize, Math.min(maxSize, settings.size));
            
            if (settings.size > maxSize) {
                console.warn(`⚠️ ペンサイズ ${settings.size} は最大値 ${maxSize} を超えています。${maxSize} に制限されました。`);
            } else if (settings.size < minSize) {
                console.warn(`⚠️ ペンサイズ ${settings.size} は最小値 ${minSize} を下回っています。${minSize} に制限されました。`);
            }
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
        
        // 履歴記録
        if (this.historyManager && beforeSettings && window.InternalStateCapture) {
            const afterSettings = window.InternalStateCapture.captureBrushSettings(this);
            this.historyManager.recordBrushSettingChange(beforeSettings, afterSettings);
        }
        
        console.log('🎨 ブラシ設定更新（緊急復旧版）:', updates);
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
    
    // 安全なCONFIG取得
    safeConfigGet(key, defaultValue = null) {
        try {
            if (!window.CONFIG || typeof window.CONFIG !== 'object') {
                return defaultValue;
            }
            
            if (!(key in window.CONFIG)) {
                return defaultValue;
            }
            
            const value = window.CONFIG[key];
            return (value === null || value === undefined) ? defaultValue : value;
            
        } catch (error) {
            console.error(`CONFIG取得エラー (${key}):`, error);
            return defaultValue;
        }
    }
    
    // ==== 履歴管理関連API ====
    getHistoryManager() {
        return this.historyManager;
    }
    
    undo() {
        return this.historyManager ? this.historyManager.undo() : false;
    }
    
    redo() {
        return this.historyManager ? this.historyManager.redo() : false;
    }
    
    canUndo() {
        return this.historyManager ? this.historyManager.canUndo() : false;
    }
    
    canRedo() {
        return this.historyManager ? this.historyManager.canRedo() : false;
    }
    
    getHistoryStats() {
        return this.historyManager ? this.historyManager.getStats() : null;
    }
    
    getHistoryList() {
        return this.historyManager ? this.historyManager.getHistoryList() : [];
    }
    
    setHistoryRecording(enabled) {
        if (this.historyManager) {
            return this.historyManager.setRecording(enabled);
        }
        return false;
    }
    
    clearHistory() {
        if (this.historyManager) {
            this.historyManager.clearHistory();
        }
    }
    
    // ==== デバッグ・統計 ====
    getSystemStats() {
        const historyStats = this.getHistoryStats();
        const brushSettings = this.getBrushSettings();
        
        const minSize = this.safeConfigGet('MIN_BRUSH_SIZE', 0.1);
        const maxSize = this.safeConfigGet('MAX_BRUSH_SIZE', 500);
        const defaultSize = this.safeConfigGet('DEFAULT_BRUSH_SIZE', 4);
        const defaultOpacity = this.safeConfigGet('DEFAULT_OPACITY', 1.0);
        
        return {
            initialized: this.isInitialized,
            currentTool: this.getCurrentTool(),
            availableTools: this.getAvailableTools(),
            brushSettings: {
                ...brushSettings,
                sizeRange: { min: minSize, max: maxSize, default: defaultSize, current: brushSettings.size },
                opacityRange: { min: 0, max: 1, default: defaultOpacity, current: brushSettings.opacity }
            },
            history: {
                canUndo: this.canUndo(),
                canRedo: this.canRedo(),
                totalRecorded: historyStats?.totalRecorded || 0,
                currentIndex: historyStats?.currentIndex || -1,
                memoryUsageMB: historyStats?.memoryUsageMB || 0
            },
            emergencyFixActive: true // 緊急復旧版であることを示す
        };
    }
    
    debugHistory() {
        if (this.historyManager) {
            this.historyManager.debugHistory();
        } else {
            console.warn('履歴管理システムが利用できません（緊急復旧版）');
        }
    }
    
    debugSystem() {
        console.group('🔍 DrawingToolsSystemEmergencyFix デバッグ情報');
        console.log('システム統計:', this.getSystemStats());
        
        if (this.historyManager) {
            console.log('履歴統計:', this.getHistoryStats());
            console.log('履歴リスト:', this.getHistoryList());
        }
        
        console.groupEnd();
    }
    
    testHistoryFunction() {
        console.group('🧪 履歴機能テスト（緊急復旧版）');
        
        console.log('1. 初期状態:', {
            canUndo: this.canUndo(),
            canRedo: this.canRedo(),
            historyLength: this.getHistoryStats()?.historyLength || 0
        });
        
        console.log('2. ブラシ設定変更実行...');
        this.updateBrushSettings({ size: 50, opacity: 1.0 });
        
        console.log('3. 変更後の状態:', {
            canUndo: this.canUndo(),
            canRedo: this.canRedo(),
            historyLength: this.getHistoryStats()?.historyLength || 0
        });
        
        console.log('4. 範囲外値テスト...');
        this.updateBrushSettings({ size: 600 });
        this.updateBrushSettings({ size: 0.05 });
        
        console.log('5. アンドゥ実行...');
        const undoResult = this.undo();
        console.log('アンドゥ結果:', undoResult);
        
        console.log('6. アンドゥ後の状態:', {
            canUndo: this.canUndo(),
            canRedo: this.canRedo(),
            brushSettings: this.getBrushSettings()
        });
        
        console.log('7. リドゥ実行...');
        const redoResult = this.redo();
        console.log('リドゥ結果:', redoResult);
        
        console.log('8. 最終状態:', {
            canUndo: this.canUndo(),
            canRedo: this.canRedo(),
            brushSettings: this.getBrushSettings()
        });
        
        console.groupEnd();
    }
    
    destroy() {
        console.log('🚑 DrawingToolsSystemEmergencyFix破棄開始...');
        
        if (this.toolManager && this.toolManager.activeTool) {
            this.toolManager.activeTool.deactivate();
        }
        
        if (this.historyManager) {
            this.historyManager.destroy();
        }
        
        this.historyManager = null;
        this.toolManager = null;
        this.uiManager = null;
        
        console.log('✅ DrawingToolsSystemEmergencyFix破棄完了');
    }
}

// ==== StateCapture・StateRestore エイリアス（緊急復旧版）====
const StateCaptureEmergencyFix = {
    captureDrawingState: (app) => {
        if (typeof window !== 'undefined' && window.InternalStateCapture) {
            return window.InternalStateCapture.captureDrawingState(app);
        }
        console.warn('InternalStateCapture が利用できません（緊急復旧版）');
        return null;
    },
    capturePresetState: (presetManager) => {
        if (typeof window !== 'undefined' && window.InternalStateCapture) {
            return window.InternalStateCapture.capturePresetState(presetManager);
        }
        console.warn('InternalStateCapture が利用できません（緊急復旧版）');
        return null;
    },
    captureBrushSettings: (toolsSystem) => {
        if (typeof window !== 'undefined' && window.InternalStateCapture) {
            return window.InternalStateCapture.captureBrushSettings(toolsSystem);
        }
        console.warn('InternalStateCapture が利用できません（緊急復旧版）');
        return null;
    },
    captureCanvasSettings: (app) => {
        if (typeof window !== 'undefined' && window.InternalStateCapture) {
            return window.InternalStateCapture.captureCanvasSettings(app);
        }
        console.warn('InternalStateCapture が利用できません（緊急復旧版）');
        return null;
    }
};

const StateRestoreEmergencyFix = {
    restoreDrawingState: (app, state) => {
        if (typeof window !== 'undefined' && window.InternalStateRestore) {
            return window.InternalStateRestore.restoreDrawingState(app, state);
        }
        console.warn('InternalStateRestore が利用できません（緊急復旧版）');
        return false;
    },
    restorePresetState: (presetManager, uiManager, state) => {
        if (typeof window !== 'undefined' && window.InternalStateRestore) {
            return window.InternalStateRestore.restorePresetState(presetManager, uiManager, state);
        }
        console.warn('InternalStateRestore が利用できません（緊急復旧版）');
        return false;
    },
    restoreBrushSettings: (toolsSystem, uiManager, state) => {
        if (typeof window !== 'undefined' && window.InternalStateRestore) {
            return window.InternalStateRestore.restoreBrushSettings(toolsSystem, uiManager, state);
        }
        console.warn('InternalStateRestore が利用できません（緊急復旧版）');
        return false;
    },
    restoreCanvasSettings: (app, uiManager, state) => {
        if (typeof window !== 'undefined' && window.InternalStateRestore) {
            return window.InternalStateRestore.restoreCanvasSettings(app, uiManager, state);
        }
        console.warn('InternalStateRestore が利用できません（緊急復旧版）');
        return false;
    }
};

// ==== グローバル登録・エクスポート（緊急復旧版）====
if (typeof window !== 'undefined') {
    // メインクラスの登録（緊急復旧版）
    window.DrawingToolsSystem = DrawingToolsSystemEmergencyFix;
    window.ToolManager = ToolManagerIntegrated;
    window.BaseTool = BaseToolIntegrated;
    window.VectorPenTool = VectorPenToolIntegrated;
    window.EraserTool = EraserToolIntegrated;
    
    // StateCapture/StateRestore エイリアスの登録
    window.StateCapture = StateCaptureEmergencyFix;
    window.StateRestore = StateRestoreEmergencyFix;
    
    // 緊急復旧版のデバッグ関数
    window.testEmergencyFix = function() {
        console.group('🚑 緊急復旧テスト');
        
        const classChecks = {
            DrawingToolsSystem: !!window.DrawingToolsSystem,
            ToolManager: !!window.ToolManager,
            BaseTool: !!window.BaseTool,
            VectorPenTool: !!window.VectorPenTool,
            EraserTool: !!window.EraserTool,
            StateCapture: !!window.StateCapture,
            StateRestore: !!window.StateRestore
        };
        
        console.log('クラス存在確認:', classChecks);
        
        const allClassesOK = Object.values(classChecks).every(Boolean);
        console.log(`🏆 緊急復旧: ${allClassesOK ? '✅ 成功' : '❌ 失敗'}`);
        
        if (allClassesOK) {
            console.log('✅ 全ての必要なクラスが利用可能です');
            console.log('✅ main.js の初期化が成功するはずです');
        } else {
            const missing = Object.entries(classChecks).filter(([name, exists]) => !exists);
            console.error('❌ 不足クラス:', missing.map(([name]) => name));
        }
        
        console.groupEnd();
        return allClassesOK;
    };
    
    console.log('🚑 drawing-tools.js 緊急復旧版 読み込み完了');
    console.log('🔧 緊急復旧項目:');
    console.log('  ✅ 重複クラス定義の解消');
    console.log('  ✅ DrawingToolsSystem の正常動作復旧');
    console.log('  ✅ 全必要クラスの統合ファイル内実装');
    console.log('  ✅ main.js 初期化エラーの解消');
    console.log('📦 緊急復旧版利用可能クラス:');
    console.log('  - DrawingToolsSystemEmergencyFix（メイン統合クラス）');
    console.log('  - ToolManagerIntegrated（ツール管理）');
    console.log('  - BaseToolIntegrated（基底クラス）');
    console.log('  - VectorPenToolIntegrated, EraserToolIntegrated（描画ツール）');
    console.log('  - StateCaptureEmergencyFix, StateRestoreEmergencyFix（状態管理）');
    console.log('🧪 緊急復旧テスト関数:');
    console.log('  - window.testEmergencyFix() - 緊急復旧成功確認');
    
    // 自動テスト実行
    setTimeout(() => {
        console.log('🧪 自動緊急復旧テスト実行中...');
        window.testEmergencyFix();
    }, 100);
}

console.log('🏆 drawing-tools.js 緊急復旧版 初期化完了');