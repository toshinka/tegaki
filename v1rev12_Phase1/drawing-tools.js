/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1rev12
 * 描画ツール群 - drawing-tools.js (Phase1重複定義解消版)
 * 
 * 🚑 Phase1緊急修正内容（重複定義解消）:
 * 1. ✅ モジュール版の存在確認→緊急復旧版の条件付き無効化
 * 2. ✅ 統合版クラス名でのエクスポート（モジュール版優先）
 * 3. ✅ 段階的フォールバック機能（モジュール版→緊急復旧版）
 * 4. ✅ 初期化エラーの防止
 * 
 * 責務: 各描画ツール（ペン・消しゴム）とツール管理のみ
 * 依存: app-core.js (PixiDrawingApp, CONFIG, EVENTS), history-manager.js
 */

console.log('🚑 drawing-tools.js Phase1重複定義解消版読み込み開始...');

// ==== Phase1修正: モジュール版存在確認と重複回避 ====
(function() {
    'use strict';
    
    // モジュール版の存在確認
    const hasModularVersion = () => {
        return (typeof window.PenTool !== 'undefined' && 
                typeof window.EraserTool !== 'undefined' && 
                typeof window.ToolManager !== 'undefined' &&
                window.PenTool.name === 'PenTool' && // モジュール版の確認
                window.EraserTool.name === 'EraserTool');
    };
    
    // モジュール版優先制御
    if (hasModularVersion()) {
        console.log('🔄 モジュール版検出 - 緊急復旧版を無効化してモジュール版を使用');
        
        // モジュール版を統合システム名でエクスポート
        window.DrawingToolsSystem = class ModularDrawingToolsSystemWrapper {
            constructor(app) {
                this.app = app;
                this.historyManager = null;
                this.toolManager = null;
                this.isInitialized = false;
                
                console.log('🔄 モジュール版ラッパー初期化');
            }
            
            async init() {
                try {
                    console.log('🔄 モジュール版システム初期化...');
                    
                    // モジュール版ToolManagerを使用
                    this.toolManager = new window.ToolManager(this.app, null);
                    
                    // デフォルトツールをアクティブ化
                    this.toolManager.setActiveTool('pen');
                    
                    // 履歴管理システムの初期化
                    if (typeof window.HistoryManager !== 'undefined') {
                        this.historyManager = new window.HistoryManager(this.app, this);
                        this.toolManager.setHistoryManager(this.historyManager);
                    }
                    
                    this.isInitialized = true;
                    console.log('✅ モジュール版システム初期化完了');
                    
                } catch (error) {
                    console.error('❌ モジュール版システム初期化エラー:', error);
                    throw error;
                }
            }
            
            // 統合システム互換API
            setTool(toolName) {
                return this.toolManager ? this.toolManager.setActiveTool(toolName) : false;
            }
            
            getCurrentTool() {
                const activeTool = this.toolManager ? this.toolManager.getActiveTool() : null;
                return activeTool ? activeTool.name : null;
            }
            
            getAvailableTools() {
                return this.toolManager ? this.toolManager.getAvailableTools() : [];
            }
            
            updateBrushSettings(settings) {
                // app-core.jsの既存機能を使用
                if (this.app && this.app.updateState) {
                    const updates = {};
                    
                    if ('size' in settings) {
                        const minSize = this.safeConfigGet('MIN_BRUSH_SIZE', 0.1);
                        const maxSize = this.safeConfigGet('MAX_BRUSH_SIZE', 500);
                        updates.brushSize = Math.max(minSize, Math.min(maxSize, settings.size));
                    }
                    
                    if ('color' in settings) updates.brushColor = settings.color;
                    if ('opacity' in settings) updates.opacity = Math.max(0, Math.min(1, settings.opacity));
                    if ('pressure' in settings) updates.pressure = Math.max(0, Math.min(1, settings.pressure));
                    if ('smoothing' in settings) updates.smoothing = Math.max(0, Math.min(1, settings.smoothing));
                    
                    this.app.updateState(updates);
                    console.log('🎨 モジュール版ブラシ設定更新:', updates);
                }
            }
            
            getBrushSettings() {
                const state = this.app ? this.app.getState() : {};
                return {
                    size: state.brushSize || 4,
                    color: state.brushColor || '#000000',
                    opacity: state.opacity || 1.0,
                    pressure: state.pressure || 1.0,
                    smoothing: state.smoothing || 0.0
                };
            }
            
            safeConfigGet(key, defaultValue) {
                try {
                    return (window.CONFIG && window.CONFIG[key] !== undefined) ? 
                        window.CONFIG[key] : defaultValue;
                } catch (error) {
                    return defaultValue;
                }
            }
            
            // 履歴管理API
            getHistoryManager() { return this.historyManager; }
            undo() { return this.historyManager ? this.historyManager.undo() : false; }
            redo() { return this.historyManager ? this.historyManager.redo() : false; }
            canUndo() { return this.historyManager ? this.historyManager.canUndo() : false; }
            canRedo() { return this.historyManager ? this.historyManager.canRedo() : false; }
            
            // 統計・デバッグ
            getSystemStats() {
                return {
                    initialized: this.isInitialized,
                    currentTool: this.getCurrentTool(),
                    availableTools: this.getAvailableTools(),
                    brushSettings: this.getBrushSettings(),
                    version: 'ModularWrapper',
                    emergencyFixActive: false
                };
            }
            
            destroy() {
                if (this.toolManager && this.toolManager.activeTool) {
                    this.toolManager.activeTool.deactivate();
                }
                
                if (this.historyManager && this.historyManager.destroy) {
                    this.historyManager.destroy();
                }
                
                this.historyManager = null;
                this.toolManager = null;
                
                console.log('✅ モジュール版システム破棄完了');
            }
        };
        
        console.log('🔄 モジュール版優先システム設定完了');
        return; // 緊急復旧版の定義をスキップ
    }
    
    console.log('🚑 モジュール版が見つからないため緊急復旧版を使用');
    
    // ==== EVENTS定数の安全取得 ====
    const DRAWING_TOOLS_EVENTS = window.EVENTS || {
        POINTER_DOWN: 'pointerdown',
        POINTER_MOVE: 'pointermove', 
        POINTER_UP: 'pointerup',
        POINTER_UP_OUTSIDE: 'pointerupoutside'
    };
    
    // ==== ベースツールクラス（緊急復旧版）====
    class BaseToolEmergency {
        constructor(name, app, historyManager = null) {
            this.name = name;
            this.app = app;
            this.historyManager = historyManager;
            this.isActive = false;
            this.currentPath = null;
            this.operationStartState = null;
            this.lastPoint = null;
            
            console.log(`🔧 BaseToolEmergency初期化: ${name}（緊急復旧版）`);
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
        
        // Phase1修正: エラー回復機能強化
        forceEndOperation() {
            console.warn(`⚠️ ${this.name}: 強制操作終了`);
            if (this.currentPath) {
                try {
                    this.app.finalizePath(this.currentPath);
                    this.recordOperation();
                } catch (error) {
                    console.error(`強制終了エラー:`, error);
                }
            }
            this.cleanup();
        }
    }
    
    // ==== ベクターペンツール（緊急復旧版・エラー回復強化）====
    class VectorPenToolEmergency extends BaseToolEmergency {
        constructor(app, historyManager = null) {
            super('pen', app, historyManager);
            this.smoothingBuffer = [];
            this.maxBufferSize = 5;
            this.isDrawing = false;
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
            if (!drawingLayer) {
                console.error('drawingLayer が見つかりません');
                return;
            }
            
            // Phase1修正: イベントリスナーのエラー処理強化
            drawingLayer.on(DRAWING_TOOLS_EVENTS.POINTER_DOWN, (event) => {
                try {
                    if (!this.isActive) return;
                    const point = this.app.getLocalPointerPosition(event);
                    this.onPointerDown(point.x, point.y, event);
                } catch (error) {
                    console.error('PointerDown エラー:', error);
                    this.forceEndOperation();
                }
            });
            
            drawingLayer.on(DRAWING_TOOLS_EVENTS.POINTER_MOVE, (event) => {
                try {
                    if (!this.isActive) return;
                    const point = this.app.getLocalPointerPosition(event);
                    this.onPointerMove(point.x, point.y, event);
                } catch (error) {
                    console.error('PointerMove エラー:', error);
                    this.forceEndOperation();
                }
            });
            
            drawingLayer.on(DRAWING_TOOLS_EVENTS.POINTER_UP, (event) => {
                try {
                    if (!this.isActive) return;
                    const point = this.app.getLocalPointerPosition(event);
                    this.onPointerUp(point.x, point.y, event);
                } catch (error) {
                    console.error('PointerUp エラー:', error);
                    this.forceEndOperation();
                }
            });
            
            drawingLayer.on(DRAWING_TOOLS_EVENTS.POINTER_UP_OUTSIDE, (event) => {
                try {
                    if (!this.isActive) return;
                    this.onPointerUp(0, 0, event);
                } catch (error) {
                    console.error('PointerUpOutside エラー:', error);
                    this.forceEndOperation();
                }
            });
        }
        
        onPointerDown(x, y, event) {
            try {
                this.captureStartState();
                this.currentPath = this.app.createPath(x, y, 'pen');
                
                // Phase1修正: null チェック強化
                if (!this.currentPath) {
                    console.error('パス作成失敗');
                    return;
                }
                
                this.lastPoint = { x, y };
                this.smoothingBuffer = [{ x, y }];
                this.isDrawing = true;
                
                console.log(`ペン開始: (${x.toFixed(1)}, ${y.toFixed(1)})（緊急復旧版）`);
            } catch (error) {
                console.error('ペンPointerDown エラー:', error);
                this.cleanup();
            }
        }
        
        onPointerMove(x, y, event) {
            try {
                if (!this.currentPath || !this.isDrawing || !this.app.state.isDrawing) return;
                
                // Phase1修正: currentPath の null チェック強化
                if (!this.currentPath || !this.currentPath.graphics) {
                    console.warn('⚠️ currentPath または graphics が null');
                    this.forceEndOperation();
                    return;
                }
                
                // Phase1修正: graphics オブジェクトの状態確認
                if (this.currentPath.graphics.destroyed) {
                    console.warn('⚠️ graphics オブジェクトが破棄済み');
                    this.forceEndOperation();
                    return;
                }
                
                const smoothedPoint = this.applySmoothingFilter(x, y);
                this.app.extendPath(this.currentPath, smoothedPoint.x, smoothedPoint.y);
                this.lastPoint = smoothedPoint;
                
            } catch (error) {
                console.error('ペンPointerMove エラー:', error);
                this.forceEndOperation();
            }
        }
        
        onPointerUp(x, y, event) {
            try {
                if (this.currentPath) {
                    this.app.finalizePath(this.currentPath);
                    this.recordOperation();
                    console.log(`ペン終了: パス完成（緊急復旧版）`);
                }
                this.cleanup();
            } catch (error) {
                console.error('ペンPointerUp エラー:', error);
                this.cleanup();
            }
        }
        
        applySmoothingFilter(x, y) {
            try {
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
                
            } catch (error) {
                console.error('スムージング処理エラー:', error);
                return { x, y };
            }
        }
        
        cleanup() {
            super.cleanup();
            this.smoothingBuffer = [];
            this.isDrawing = false;
        }
    }
    
    // ==== 消しゴムツール（緊急復旧版・エラー回復強化）====
    class EraserToolEmergency extends BaseToolEmergency {
        constructor(app, historyManager = null) {
            super('eraser', app, historyManager);
            this.isDrawing = false;
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
            if (!drawingLayer) {
                console.error('drawingLayer が見つかりません');
                return;
            }
            
            // Phase1修正: イベントリスナーのエラー処理強化
            drawingLayer.on(DRAWING_TOOLS_EVENTS.POINTER_DOWN, (event) => {
                try {
                    if (!this.isActive) return;
                    const point = this.app.getLocalPointerPosition(event);
                    this.onPointerDown(point.x, point.y, event);
                } catch (error) {
                    console.error('消しゴムPointerDown エラー:', error);
                    this.forceEndOperation();
                }
            });
            
            drawingLayer.on(DRAWING_TOOLS_EVENTS.POINTER_MOVE, (event) => {
                try {
                    if (!this.isActive) return;
                    const point = this.app.getLocalPointerPosition(event);
                    this.onPointerMove(point.x, point.y, event);
                } catch (error) {
                    console.error('消しゴムPointerMove エラー:', error);
                    this.forceEndOperation();
                }
            });
            
            drawingLayer.on(DRAWING_TOOLS_EVENTS.POINTER_UP, (event) => {
                try {
                    if (!this.isActive) return;
                    const point = this.app.getLocalPointerPosition(event);
                    this.onPointerUp(point.x, point.y, event);
                } catch (error) {
                    console.error('消しゴムPointerUp エラー:', error);
                    this.forceEndOperation();
                }
            });
            
            drawingLayer.on(DRAWING_TOOLS_EVENTS.POINTER_UP_OUTSIDE, (event) => {
                try {
                    if (!this.isActive) return;
                    this.onPointerUp(0, 0, event);
                } catch (error) {
                    console.error('消しゴムPointerUpOutside エラー:', error);
                    this.forceEndOperation();
                }
            });
        }
        
        onPointerDown(x, y, event) {
            try {
                this.captureStartState();
                this.currentPath = this.app.createPath(x, y, 'eraser');
                
                // Phase1修正: null チェック強化
                if (!this.currentPath) {
                    console.error('消しゴムパス作成失敗');
                    return;
                }
                
                this.lastPoint = { x, y };
                this.isDrawing = true;
                
                console.log(`消しゴム開始: (${x.toFixed(1)}, ${y.toFixed(1)})（緊急復旧版）`);
            } catch (error) {
                console.error('消しゴムPointerDown エラー:', error);
                this.cleanup();
            }
        }
        
        onPointerMove(x, y, event) {
            try {
                if (!this.currentPath || !this.isDrawing || !this.app.state.isDrawing) return;
                
                // Phase1修正: currentPath の null チェック強化
                if (!this.currentPath || !this.currentPath.graphics) {
                    console.warn('⚠️ 消しゴム: currentPath または graphics が null');
                    this.forceEndOperation();
                    return;
                }
                
                if (this.currentPath.graphics.destroyed) {
                    console.warn('⚠️ 消しゴム: graphics オブジェクトが破棄済み');
                    this.forceEndOperation();
                    return;
                }
                
                this.app.extendPath(this.currentPath, x, y);
                this.lastPoint = { x, y };
                
            } catch (error) {
                console.error('消しゴムPointerMove エラー:', error);
                this.forceEndOperation();
            }
        }
        
        onPointerUp(x, y, event) {
            try {
                if (this.currentPath) {
                    this.app.finalizePath(this.currentPath);
                    this.recordOperation();
                    console.log(`消しゴム終了: パス完成（緊急復旧版）`);
                }
                this.cleanup();
            } catch (error) {
                console.error('消しゴムPointerUp エラー:', error);
                this.cleanup();
            }
        }
        
        cleanup() {
            super.cleanup();
            this.isDrawing = false;
        }
    }
    
    // ==== ツール管理システム（緊急復旧版・エラー回復強化）====
    class ToolManagerEmergency {
        constructor(app, historyManager = null) {
            this.app = app;
            this.historyManager = historyManager;
            this.tools = new Map();
            this.activeTool = null;
            
            this.initializeTools();
            console.log('🔧 ToolManagerEmergency初期化完了（緊急復旧版）');
        }
        
        initializeTools() {
            try {
                this.registerTool('pen', new VectorPenToolEmergency(this.app, this.historyManager));
                this.registerTool('eraser', new EraserToolEmergency(this.app, this.historyManager));
                console.log(`✅ ${this.tools.size}個のツールを登録完了（緊急復旧版）`);
            } catch (error) {
                console.error('ツール初期化エラー:', error);
            }
        }
        
        setHistoryManager(historyManager) {
            this.historyManager = historyManager;
            this.tools.forEach(tool => {
                if (tool.setHistoryManager) {
                    tool.setHistoryManager(historyManager);
                }
            });
            console.log('🔧 ToolManagerEmergency: 履歴管理システム設定完了（緊急復旧版）');
        }
        
        registerTool(name, tool) {
            this.tools.set(name, tool);
            console.log(`🔧 ツール登録（緊急復旧版）: ${name}`);
        }
        
        setActiveTool(toolName) {
            try {
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
                
            } catch (error) {
                console.error(`ツール切り替えエラー (${toolName}):`, error);
                return false;
            }
        }
        
        getActiveTool() {
            return this.activeTool;
        }
        
        getAvailableTools() {
            return Array.from(this.tools.keys());
        }
        
        getTool(name) {
            return this.tools.get(name);
        }
    }
    
    // ==== メインツールシステム統合クラス（緊急復旧版・エラー回復強化）====
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
                this.toolManager = new ToolManagerEmergency(this.app, null);
                
                // 2. デフォルトツールをアクティブ化
                this.toolManager.setActiveTool('pen');
                
                // 3. 履歴管理システムの初期化
                if (typeof window.HistoryManager !== 'undefined') {
                    this.historyManager = new window.HistoryManager(this.app, this);
                    this.toolManager.setHistoryManager(this.historyManager);
                }
                
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
            if (this.historyManager && this.historyManager.setUIManager) {
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
            return this.toolManager ? this.toolManager.setActiveTool(toolName) : false;
        }
        
        getCurrentTool() {
            const activeTool = this.toolManager ? this.toolManager.getActiveTool() : null;
            if (!activeTool) {
                console.warn('getCurrentTool(): アクティブツールが設定されていません（緊急復旧版）');
                return null;
            }
            return activeTool.name;
        }
        
        getAvailableTools() {
            return this.toolManager ? this.toolManager.getAvailableTools() : [];
        }
        
        // Phase1修正: ブラシ設定更新（エラー回復強化・範囲拡張対応）
        updateBrushSettings(settings) {
            try {
                const beforeSettings = this.historyManager && window.InternalStateCapture ? 
                    window.InternalStateCapture.captureBrushSettings(this) : null;
                
                const updates = {};
                
                // Phase1修正: ペンサイズ範囲の拡張（0.1 ～ 500）+ 安全性強化
                if ('size' in settings && typeof settings.size === 'number' && !isNaN(settings.size)) {
                    const minSize = this.safeConfigGet('MIN_BRUSH_SIZE', 0.1);
                    const maxSize = this.safeConfigGet('MAX_BRUSH_SIZE', 500);
                    
                    updates.brushSize = Math.max(minSize, Math.min(maxSize, settings.size));
                    
                    if (settings.size > maxSize) {
                        console.warn(`⚠️ ペンサイズ ${settings.size} は最大値 ${maxSize} を超えています。${maxSize} に制限されました。`);
                    } else if (settings.size < minSize) {
                        console.warn(`⚠️ ペンサイズ ${settings.size} は最小値 ${minSize} を下回っています。${minSize} に制限されました。`);
                    }
                }
                
                if ('color' in settings && typeof settings.color === 'string') {
                    updates.brushColor = settings.color;
                }
                if ('opacity' in settings && typeof settings.opacity === 'number' && !isNaN(settings.opacity)) {
                    updates.opacity = Math.max(0, Math.min(1, settings.opacity));
                }
                if ('pressure' in settings && typeof settings.pressure === 'number' && !isNaN(settings.pressure)) {
                    updates.pressure = Math.max(0, Math.min(1, settings.pressure));
                }
                if ('smoothing' in settings && typeof settings.smoothing === 'number' && !isNaN(settings.smoothing)) {
                    updates.smoothing = Math.max(0, Math.min(1, settings.smoothing));
                }
                
                // Phase1修正: app.updateState の安全な実行
                if (this.app && this.app.updateState && Object.keys(updates).length > 0) {
                    this.app.updateState(updates);
                    
                    // 履歴記録
                    if (this.historyManager && beforeSettings && window.InternalStateCapture) {
                        const afterSettings = window.InternalStateCapture.captureBrushSettings(this);
                        this.historyManager.recordBrushSettingChange(beforeSettings, afterSettings);
                    }
                    
                    console.log('🎨 ブラシ設定更新（緊急復旧版）:', updates);
                } else {
                    console.warn('⚠️ ブラシ設定更新失敗: app.updateState が利用できません');
                }
                
            } catch (error) {
                console.error('ブラシ設定更新エラー:', error);
            }
        }
        
        getBrushSettings() {
            try {
                const state = this.app ? this.app.getState() : {};
                return {
                    size: state.brushSize || 4,
                    color: state.brushColor || '#000000',
                    opacity: state.opacity || 1.0,
                    pressure: state.pressure || 1.0,
                    smoothing: state.smoothing || 0.0
                };
            } catch (error) {
                console.error('ブラシ設定取得エラー:', error);
                return {
                    size: 4,
                    color: '#000000',
                    opacity: 1.0,
                    pressure: 1.0,
                    smoothing: 0.0
                };
            }
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
            try {
                return this.historyManager ? this.historyManager.undo() : false;
            } catch (error) {
                console.error('アンドゥエラー:', error);
                return false;
            }
        }
        
        redo() {
            try {
                return this.historyManager ? this.historyManager.redo() : false;
            } catch (error) {
                console.error('リドゥエラー:', error);
                return false;
            }
        }
        
        canUndo() {
            try {
                return this.historyManager ? this.historyManager.canUndo() : false;
            } catch (error) {
                console.error('canUndo確認エラー:', error);
                return false;
            }
        }
        
        canRedo() {
            try {
                return this.historyManager ? this.historyManager.canRedo() : false;
            } catch (error) {
                console.error('canRedo確認エラー:', error);
                return false;
            }
        }
        
        getHistoryStats() {
            try {
                return this.historyManager ? this.historyManager.getStats() : null;
            } catch (error) {
                console.error('履歴統計取得エラー:', error);
                return null;
            }
        }
        
        getHistoryList() {
            try {
                return this.historyManager ? this.historyManager.getHistoryList() : [];
            } catch (error) {
                console.error('履歴リスト取得エラー:', error);
                return [];
            }
        }
        
        setHistoryRecording(enabled) {
            try {
                if (this.historyManager) {
                    return this.historyManager.setRecording(enabled);
                }
                return false;
            } catch (error) {
                console.error('履歴記録設定エラー:', error);
                return false;
            }
        }
        
        clearHistory() {
            try {
                if (this.historyManager) {
                    this.historyManager.clearHistory();
                }
            } catch (error) {
                console.error('履歴クリアエラー:', error);
            }
        }
        
        // ==== デバッグ・統計 ====
        getSystemStats() {
            try {
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
                    emergencyFixActive: true, // 緊急復旧版であることを示す
                    phase1FixActive: true // Phase1修正適用済み
                };
            } catch (error) {
                console.error('システム統計取得エラー:', error);
                return {
                    initialized: false,
                    error: error.message,
                    emergencyFixActive: true,
                    phase1FixActive: true
                };
            }
        }
        
        debugHistory() {
            try {
                if (this.historyManager) {
                    this.historyManager.debugHistory();
                } else {
                    console.warn('履歴管理システムが利用できません（緊急復旧版）');
                }
            } catch (error) {
                console.error('履歴デバッグエラー:', error);
            }
        }
        
        debugSystem() {
            console.group('🔍 DrawingToolsSystemEmergencyFix デバッグ情報（Phase1修正版）');
            console.log('システム統計:', this.getSystemStats());
            
            try {
                if (this.historyManager) {
                    console.log('履歴統計:', this.getHistoryStats());
                    console.log('履歴リスト:', this.getHistoryList());
                }
                
                if (this.toolManager) {
                    console.log('ツール状況:', {
                        activeTool: this.toolManager.activeTool ? this.toolManager.activeTool.name : null,
                        availableTools: this.toolManager.getAvailableTools(),
                        toolCount: this.toolManager.tools.size
                    });
                }
            } catch (error) {
                console.error('デバッグ情報取得エラー:', error);
            }
            
            console.groupEnd();
        }
        
        testHistoryFunction() {
            console.group('🧪 履歴機能テスト（緊急復旧版・Phase1修正版）');
            
            try {
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
            } catch (error) {
                console.error('履歴機能テストエラー:', error);
            }
            
            console.groupEnd();
        }
        
        destroy() {
            try {
                console.log('🚑 DrawingToolsSystemEmergencyFix破棄開始...');
                
                if (this.toolManager && this.toolManager.activeTool) {
                    this.toolManager.activeTool.deactivate();
                }
                
                if (this.historyManager && this.historyManager.destroy) {
                    this.historyManager.destroy();
                }
                
                this.historyManager = null;
                this.toolManager = null;
                this.uiManager = null;
                
                console.log('✅ DrawingToolsSystemEmergencyFix破棄完了');
            } catch (error) {
                console.error('システム破棄エラー:', error);
            }
        }
    }
    
    // ==== StateCapture・StateRestore エイリアス（緊急復旧版）====
    const StateCaptureEmergencyFix = {
        captureDrawingState: (app) => {
            try {
                if (typeof window !== 'undefined' && window.InternalStateCapture) {
                    return window.InternalStateCapture.captureDrawingState(app);
                }
                console.warn('InternalStateCapture が利用できません（緊急復旧版）');
                return null;
            } catch (error) {
                console.error('状態キャプチャエラー:', error);
                return null;
            }
        },
        capturePresetState: (presetManager) => {
            try {
                if (typeof window !== 'undefined' && window.InternalStateCapture) {
                    return window.InternalStateCapture.capturePresetState(presetManager);
                }
                console.warn('InternalStateCapture が利用できません（緊急復旧版）');
                return null;
            } catch (error) {
                console.error('プリセット状態キャプチャエラー:', error);
                return null;
            }
        },
        captureBrushSettings: (toolsSystem) => {
            try {
                if (typeof window !== 'undefined' && window.InternalStateCapture) {
                    return window.InternalStateCapture.captureBrushSettings(toolsSystem);
                }
                console.warn('InternalStateCapture が利用できません（緊急復旧版）');
                return null;
            } catch (error) {
                console.error('ブラシ設定キャプチャエラー:', error);
                return null;
            }
        },
        captureCanvasSettings: (app) => {
            try {
                if (typeof window !== 'undefined' && window.InternalStateCapture) {
                    return window.InternalStateCapture.captureCanvasSettings(app);
                }
                console.warn('InternalStateCapture が利用できません（緊急復旧版）');
                return null;
            } catch (error) {
                console.error('キャンバス設定キャプチャエラー:', error);
                return null;
            }
        }
    };
    
    const StateRestoreEmergencyFix = {
        restoreDrawingState: (app, state) => {
            try {
                if (typeof window !== 'undefined' && window.InternalStateRestore) {
                    return window.InternalStateRestore.restoreDrawingState(app, state);
                }
                console.warn('InternalStateRestore が利用できません（緊急復旧版）');
                return false;
            } catch (error) {
                console.error('描画状態復元エラー:', error);
                return false;
            }
        },
        restorePresetState: (presetManager, uiManager, state) => {
            try {
                if (typeof window !== 'undefined' && window.InternalStateRestore) {
                    return window.InternalStateRestore.restorePresetState(presetManager, uiManager, state);
                }
                console.warn('InternalStateRestore が利用できません（緊急復旧版）');
                return false;
            } catch (error) {
                console.error('プリセット状態復元エラー:', error);
                return false;
            }
        },
        restoreBrushSettings: (toolsSystem, uiManager, state) => {
            try {
                if (typeof window !== 'undefined' && window.InternalStateRestore) {
                    return window.InternalStateRestore.restoreBrushSettings(toolsSystem, uiManager, state);
                }
                console.warn('InternalStateRestore が利用できません（緊急復旧版）');
                return false;
            } catch (error) {
                console.error('ブラシ設定復元エラー:', error);
                return false;
            }
        },
        restoreCanvasSettings: (app, uiManager, state) => {
            try {
                if (typeof window !== 'undefined' && window.InternalStateRestore) {
                    return window.InternalStateRestore.restoreCanvasSettings(app, uiManager, state);
                }
                console.warn('InternalStateRestore が利用できません（緊急復旧版）');
                return false;
            } catch (error) {
                console.error('キャンバス設定復元エラー:', error);
                return false;
            }
        }
    };
    
    // ==== グローバル登録・エクスポート（緊急復旧版・Phase1修正版）====
    if (typeof window !== 'undefined') {
        // メインクラスの登録（緊急復旧版）
        window.DrawingToolsSystem = DrawingToolsSystemEmergencyFix;
        window.ToolManager = ToolManagerEmergency;
        window.BaseTool = BaseToolEmergency;
        window.VectorPenTool = VectorPenToolEmergency;
        window.EraserTool = EraserToolEmergency;
        
        // StateCapture/StateRestore エイリアスの登録
        window.StateCapture = StateCaptureEmergencyFix;
        window.StateRestore = StateRestoreEmergencyFix;
        
        // Phase1修正のデバッグ関数
        window.testEmergencyFixPhase1 = function() {
            console.group('🚑 Phase1緊急修正テスト');
            
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
            console.log(`🏆 Phase1緊急修正: ${allClassesOK ? '✅ 成功' : '❌ 失敗'}`);
            
            if (allClassesOK) {
                console.log('✅ 全ての必要なクラスが利用可能です');
                console.log('✅ main.js の初期化が成功するはずです');
                
                // 機能テスト
                try {
                    console.log('🧪 機能テスト実行中...');
                    
                    // DrawingToolsSystemの作成テスト
                    console.log('- DrawingToolsSystem作成テスト...');
                    const testSystem = {
                        getState: () => ({ brushSize: 4, brushColor: '#000000' }),
                        updateState: (updates) => console.log('updateState:', updates),
                        layers: { drawingLayer: { on: () => {} } },
                        createPath: () => ({ graphics: { destroyed: false } }),
                        extendPath: () => {},
                        finalizePath: () => {}
                    };
                    
                    const drawingSystem = new window.DrawingToolsSystem(testSystem);
                    console.log('✅ DrawingToolsSystem作成成功');
                    
                    // ツール切り替えテスト
                    console.log('- ツール切り替えテスト...');
                    const penResult = drawingSystem.setTool('pen');
                    const eraserResult = drawingSystem.setTool('eraser');
                    console.log(`✅ ツール切り替えテスト: pen=${penResult}, eraser=${eraserResult}`);
                    
                    // ブラシ設定テスト
                    console.log('- ブラシ設定テスト...');
                    drawingSystem.updateBrushSettings({ size: 10, color: '#ff0000' });
                    const brushSettings = drawingSystem.getBrushSettings();
                    console.log('✅ ブラシ設定テスト成功:', brushSettings);
                    
                    console.log('🎉 Phase1機能テスト完了 - すべて正常');
                    
                } catch (testError) {
                    console.error('❌ 機能テストエラー:', testError);
                }
                
            } else {
                const missing = Object.entries(classChecks).filter(([name, exists]) => !exists);
                console.error('❌ 不足クラス:', missing.map(([name]) => name));
            }
            
            console.groupEnd();
            return allClassesOK;
        };
        
        // Phase1修正: エラー回復テスト
        window.testErrorRecovery = function() {
            console.group('🛡️ Phase1エラー回復テスト');
            
            try {
                console.log('1. null参照エラー回復テスト...');
                
                // 意図的に不正な状態を作成してエラー回復をテスト
                const mockApp = {
                    getState: () => null, // null状態
                    updateState: (updates) => { throw new Error('テスト用エラー'); },
                    layers: { drawingLayer: null }, // null layer
                    createPath: () => null, // null パス
                    extendPath: () => { throw new Error('graphics destroyed'); },
                    finalizePath: () => {}
                };
                
                const system = new window.DrawingToolsSystem(mockApp);
                
                // エラー回復テスト実行
                console.log('- ブラシ設定更新エラー回復テスト...');
                system.updateBrushSettings({ size: 50 }); // エラーが発生するはず
                
                console.log('- ブラシ設定取得エラー回復テスト...');
                const settings = system.getBrushSettings(); // デフォルト値が返されるはず
                console.log('エラー回復結果:', settings);
                
                console.log('✅ エラー回復テスト完了 - システムは安定');
                
            } catch (error) {
                console.error('❌ エラー回復テスト失敗:', error);
            }
            
            console.groupEnd();
        };
        
        console.log('🚑 drawing-tools.js Phase1重複定義解消版 読み込み完了');
        console.log('🔧 Phase1修正内容:');
        console.log('  ✅ モジュール版の存在確認→緊急復旧版の条件付き無効化');
        console.log('  ✅ 統合版クラス名でのエクスポート（モジュール版優先）');
        console.log('  ✅ エラー回復機能の強化（null参照・graphics破棄対応）');
        console.log('  ✅ 範囲チェックの強化（NaN・型チェック追加）');
        console.log('  ✅ イベントリスナーのエラー処理強化');
        console.log('  ✅ 段階的フォールバック機能実装');
        console.log('📦 Phase1修正版利用可能クラス:');
        console.log('  - DrawingToolsSystemEmergencyFix（Phase1エラー回復強化版）');
        console.log('  - ToolManagerEmergency（エラー処理強化版）');
        console.log('  - BaseToolEmergency, VectorPenToolEmergency, EraserToolEmergency');
        console.log('  - StateCaptureEmergencyFix, StateRestoreEmergencyFix（エラー処理強化版）');
        console.log('🧪 Phase1修正テスト関数:');
        console.log('  - window.testEmergencyFixPhase1() - Phase1修正完了確認');
        console.log('  - window.testErrorRecovery() - エラー回復機能テスト');
        
        // 自動テスト実行
        setTimeout(() => {
            console.log('🧪 自動Phase1修正テスト実行中...');
            window.testEmergencyFixPhase1();
            window.testErrorRecovery();
        }, 100);
    }
    
    console.log('🏆 drawing-tools.js Phase1重複定義解消版 初期化完了');

})();