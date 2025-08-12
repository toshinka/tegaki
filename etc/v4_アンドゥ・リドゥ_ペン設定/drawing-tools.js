/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1rev4
 * 描画ツール群 - drawing-tools.js (v1.9修正版)
 * 
 * 🔧 v1.9修正内容（Rulebook準拠責務分離版）:
 * 1. ShortcutManager削除 → settings-manager.jsに移行
 * 2. PerformanceMonitor削除 → ui-manager.jsに移行
 * 3. LayerSystem削除 → 将来のlayer-manager.jsに移行
 * 4. StateCapture/StateRestore外部参照修正
 * 5. DrawingToolsSystemエクスポート修正
 * 6. 責務を描画ツールのみに限定（Rulebook第2章準拠）
 * 
 * 責務: 各描画ツール（ペン・消しゴム）とツール管理のみ
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
    
    // 履歴管理システムの後設定メソッド
    setHistoryManager(historyManager) {
        this.historyManager = historyManager;
    }
    
    // 操作開始時の状態キャプチャ
    captureStartState() {
        if (this.historyManager && window.InternalStateCapture) {
            this.operationStartState = window.InternalStateCapture.captureDrawingState(this.app);
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

// ==== ツール管理システム（履歴管理統合版・修正版）====
class ToolManager {
    constructor(app, historyManager = null) {
        this.app = app;
        this.historyManager = historyManager;
        this.tools = new Map();
        this.activeTool = null; // 初期化時はnull
        
        this.initializeTools();
    }
    
    initializeTools() {
        // 履歴管理対応版ツールを登録
        this.registerTool('pen', new VectorPenTool(this.app, this.historyManager));
        this.registerTool('eraser', new EraserTool(this.app, this.historyManager));
        
        console.log(`✅ ${this.tools.size}個のツールを登録完了（履歴管理対応版）`);
    }
    
    // 履歴管理システムの後設定メソッド
    setHistoryManager(historyManager) {
        this.historyManager = historyManager;
        
        // 既存のツールにも履歴管理を設定
        this.tools.forEach(tool => {
            if (tool.setHistoryManager) {
                tool.setHistoryManager(historyManager);
            }
        });
        
        console.log('🔧 ToolManager: 履歴管理システム設定完了');
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
    
    // getCurrentTool() null チェック修正
    getActiveTool() {
        return this.activeTool; // null の可能性あり
    }
    
    getAvailableTools() {
        return Array.from(this.tools.keys());
    }
}

// ==== メインツールシステム統合クラス（v1.9修正版・責務分離版）====
class DrawingToolsSystem {
    constructor(app) {
        this.app = app;
        
        // 履歴管理システムは後で初期化
        this.historyManager = null;
        
        // 描画ツール管理（履歴管理なしで初期化）
        this.toolManager = null;
        
        // 外部システムへの参照
        this.uiManager = null; // UIManagerへの参照
        
        this.isInitialized = false;
    }
    
    async init() {
        try {
            console.log('🎯 DrawingToolsSystem初期化開始（v1.9修正版・責務分離版）...');
            
            // 1. 基本システムの初期化（履歴管理なし）
            this.toolManager = new ToolManager(this.app, null); // 履歴管理は後で設定
            
            // 2. デフォルトツールをアクティブ化（履歴記録前）
            this.toolManager.setActiveTool('pen');
            
            // 3. 履歴管理システムを初期化（ツール準備完了後）
            this.historyManager = new HistoryManager(this.app, this);
            
            // 4. ツールマネージャーに履歴管理を設定
            this.toolManager.setHistoryManager(this.historyManager);
            
            this.isInitialized = true;
            console.log('✅ DrawingToolsSystem初期化完了（v1.9修正版・責務分離版）');
            console.log('🔧 修正項目:');
            console.log('  - ShortcutManager削除（settings-manager.jsに移行）');
            console.log('  - PerformanceMonitor削除（ui-manager.jsに移行）');
            console.log('  - LayerSystem削除（将来のlayer-manager.jsに移行）');
            console.log('  - StateCapture/StateRestore外部参照修正');
            console.log('  - 責務を描画ツール管理のみに限定');
            console.log('🏛️ 履歴管理機能:');
            console.log('  - 描画操作自動記録');
            console.log('  - ツール変更記録');
            
        } catch (error) {
            console.error('❌ DrawingToolsSystem初期化エラー:', error);
            throw error;
        }
    }
    
    // UIManager設定メソッド
    setUIManager(uiManager) {
        this.uiManager = uiManager;
        
        // 履歴管理システムにも設定
        if (this.historyManager) {
            this.historyManager.setUIManager(uiManager);
        }
        
        console.log('🔧 DrawingToolsSystem: UIManager設定完了');
    }
    
    // getPenPresetManager() API メソッド
    getPenPresetManager() {
        if (this.uiManager && this.uiManager.getPenPresetManager) {
            return this.uiManager.getPenPresetManager();
        }
        
        // UIManager経由でPenPresetManagerを取得する試行
        if (typeof window !== 'undefined' && window.uiManager && window.uiManager.getPenPresetManager) {
            return window.uiManager.getPenPresetManager();
        }
        
        console.warn('PenPresetManagerが見つかりません');
        return null;
    }
    
    // ==== 公開API ====
    setTool(toolName) {
        return this.toolManager.setActiveTool(toolName);
    }
    
    // getCurrentTool() null チェック修正
    getCurrentTool() {
        const activeTool = this.toolManager.getActiveTool();
        if (!activeTool) {
            console.warn('getCurrentTool(): アクティブツールが設定されていません');
            return null;
        }
        return activeTool.name;
    }
    
    getAvailableTools() {
        return this.toolManager.getAvailableTools();
    }
    
    updateBrushSettings(settings) {
        // 履歴管理：変更前の設定をキャプチャ
        const beforeSettings = this.historyManager && window.InternalStateCapture ? 
            window.InternalStateCapture.captureBrushSettings(this) : null;
        
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
        if (this.historyManager && beforeSettings && window.InternalStateCapture) {
            const afterSettings = window.InternalStateCapture.captureBrushSettings(this);
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
    
    // ==== デバッグ・統計 ====
    getSystemStats() {
        const historyStats = this.getHistoryStats();
        
        return {
            initialized: this.isInitialized,
            currentTool: this.getCurrentTool(),
            availableTools: this.getAvailableTools(),
            brushSettings: this.getBrushSettings(),
            history: {
                canUndo: this.canUndo(),
                canRedo: this.canRedo(),
                totalRecorded: historyStats?.totalRecorded || 0,
                currentIndex: historyStats?.currentIndex || -1,
                memoryUsageMB: historyStats?.memoryUsageMB || 0
            }
        };
    }
    
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
        
        console.groupEnd();
    }
    
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
        this.uiManager = null;
        
        console.log('✅ DrawingToolsSystem破棄完了');
    }
}

// ==== StateCapture・StateRestore の外部参照エイリアス（修正版）====
// main.js が期待する StateCapture, StateRestore クラスへのエイリアス
// 正しい外部参照実装
const StateCapture = {
    captureDrawingState: (app) => {
        if (typeof window !== 'undefined' && window.InternalStateCapture) {
            return window.InternalStateCapture.captureDrawingState(app);
        }
        console.warn('InternalStateCapture が利用できません');
        return null;
    },
    capturePresetState: (presetManager) => {
        if (typeof window !== 'undefined' && window.InternalStateCapture) {
            return window.InternalStateCapture.capturePresetState(presetManager);
        }
        console.warn('InternalStateCapture が利用できません');
        return null;
    },
    captureBrushSettings: (toolsSystem) => {
        if (typeof window !== 'undefined' && window.InternalStateCapture) {
            return window.InternalStateCapture.captureBrushSettings(toolsSystem);
        }
        console.warn('InternalStateCapture が利用できません');
        return null;
    },
    captureCanvasSettings: (app) => {
        if (typeof window !== 'undefined' && window.InternalStateCapture) {
            return window.InternalStateCapture.captureCanvasSettings(app);
        }
        console.warn('InternalStateCapture が利用できません');
        return null;
    }
};

const StateRestore = {
    restoreDrawingState: (app, state) => {
        if (typeof window !== 'undefined' && window.InternalStateRestore) {
            return window.InternalStateRestore.restoreDrawingState(app, state);
        }
        console.warn('InternalStateRestore が利用できません');
        return false;
    },
    restorePresetState: (presetManager, uiManager, state) => {
        if (typeof window !== 'undefined' && window.InternalStateRestore) {
            return window.InternalStateRestore.restorePresetState(presetManager, uiManager, state);
        }
        console.warn('InternalStateRestore が利用できません');
        return false;
    },
    restoreBrushSettings: (toolsSystem, uiManager, state) => {
        if (typeof window !== 'undefined' && window.InternalStateRestore) {
            return window.InternalStateRestore.restoreBrushSettings(toolsSystem, uiManager, state);
        }
        console.warn('InternalStateRestore が利用できません');
        return false;
    },
    restoreCanvasSettings: (app, uiManager, state) => {
        if (typeof window !== 'undefined' && window.InternalStateRestore) {
            return window.InternalStateRestore.restoreCanvasSettings(app, uiManager, state);
        }
        console.warn('InternalStateRestore が利用できません');
        return false;
    }
};

// ==== エクスポート（修正版）====
if (typeof window !== 'undefined') {
    // メインクラスの確実な登録
    window.DrawingToolsSystem = DrawingToolsSystem;
    window.ToolManager = ToolManager;
    window.VectorPenTool = VectorPenTool;
    window.EraserTool = EraserTool;
    
    // StateCapture/StateRestore エイリアスの確実な登録
    window.StateCapture = StateCapture;
    window.StateRestore = StateRestore;
    
    console.log('🔧 drawing-tools.js v1.9修正版 読み込み完了（責務分離版）');
    console.log('✅ ShortcutManager削除（settings-manager.jsに移行）');
    console.log('✅ PerformanceMonitor削除（ui-manager.jsに移行）');
    console.log('✅ LayerSystem削除（将来のlayer-manager.jsに移行）');
    console.log('✅ StateCapture/StateRestore 外部参照修正');
    console.log('✅ DrawingToolsSystem エクスポート修正');
    console.log('📦 利用可能クラス:');
    console.log('  - DrawingToolsSystem（メイン統合クラス）');
    console.log('  - ToolManager（ツール管理）');
    console.log('  - VectorPenTool, EraserTool（描画ツール）');
    console.log('  - StateCapture, StateRestore（外部参照エイリアス）');
    console.log('🎯 責務: 描画ツール管理のみに限定（Rulebook準拠）');
}

// ES6 module export (将来のTypeScript移行用)
// export { 
//     DrawingToolsSystem, 
//     ToolManager, 
//     VectorPenTool, 
//     EraserTool, 
//     StateCapture,
//     StateRestore
// };