// HistoryController.js - アンドゥ・リドゥ制御（Phase1基盤・封印対象）

/**
 * 🔥 アンドゥ・リドゥ制御（Phase1基盤・封印対象）
 * 責務: EventStore連携履歴管理、アクション記録・種別管理、状態復元・スナップショット
 */
export class HistoryController {
    constructor(oglEngine, eventStore) {
        this.engine = oglEngine;
        this.eventStore = eventStore;
        
        // 履歴スタック
        this.undoStack = [];
        this.redoStack = [];
        this.maxHistorySize = 50;
        
        // 現在の状態
        this.currentState = null;
        this.lastSavedState = null;
        
        // アクション記録設定
        this.isRecording = true;
        this.batchingEnabled = false;
        this.currentBatch = null;
        
        // アクション種別定義
        this.actionTypes = {
            STROKE: 'stroke',
            TOOL_CHANGE: 'tool_change',
            LAYER_CREATE: 'layer_create',
            LAYER_DELETE: 'layer_delete',
            LAYER_MODIFY: 'layer_modify',
            CANVAS_TRANSFORM: 'canvas_transform',
            BATCH: 'batch'
        };
        
        console.log('✅ HistoryController初期化完了');
    }
    
    /**
     * 履歴管理初期化
     */
    initialize() {
        // EventStore購読
        this.subscribeToEvents();
        
        // 初期状態保存
        this.saveInitialState();
        
        console.log('🗂️ 履歴管理開始');
    }
    
    /**
     * イベント購読開始
     */
    subscribeToEvents() {
        // Phase1: 基本アクション監視
        this.eventStore.on(this.eventStore.eventTypes.STROKE_COMPLETE, 
            this.handleStrokeComplete.bind(this), 'history-controller');
        
        this.eventStore.on(this.eventStore.eventTypes.TOOL_CHANGE, 
            this.handleToolChange.bind(this), 'history-controller');
        
        this.eventStore.on(this.eventStore.eventTypes.HISTORY_UNDO, 
            this.handleUndoRequest.bind(this), 'history-controller');
        
        this.eventStore.on(this.eventStore.eventTypes.HISTORY_REDO, 
            this.handleRedoRequest.bind(this), 'history-controller');
        
        // Phase2: 拡張アクション監視（封印解除時追加）
        /*
        this.eventStore.on('layer:create', this.handleLayerCreate.bind(this), 'history-controller');
        this.eventStore.on('layer:delete', this.handleLayerDelete.bind(this), 'history-controller');
        this.eventStore.on('layer:modify', this.handleLayerModify.bind(this), 'history-controller');
        this.eventStore.on('canvas:transform', this.handleCanvasTransform.bind(this), 'history-controller');
        */
        
        console.log('📝 履歴イベント購読開始');
    }
    
    /**
     * ストローク完了処理
     */
    handleStrokeComplete(eventData) {
        if (!this.isRecording) return;
        
        const action = {
            type: this.actionTypes.STROKE,
            timestamp: Date.now(),
            data: {
                strokeId: eventData.payload.strokeId,
                tool: eventData.payload.tool,
                engineState: this.captureEngineState()
            },
            undo: () => this.undoStroke(eventData.payload.strokeId),
            redo: () => this.redoStroke(eventData.payload.strokeId)
        };
        
        this.addAction(action);
        console.log(`🗂️ ストローク履歴記録: ${eventData.payload.strokeId}`);
    }
    
    /**
     * ツール変更処理
     */
    handleToolChange(eventData) {
        if (!this.isRecording) return;
        
        const previousTool = this.engine.currentTool;
        const newTool = eventData.payload.tool;
        
        if (previousTool === newTool) return;
        
        const action = {
            type: this.actionTypes.TOOL_CHANGE,
            timestamp: Date.now(),
            data: {
                previousTool,
                newTool
            },
            undo: () => this.undoToolChange(previousTool),
            redo: () => this.redoToolChange(newTool)
        };
        
        this.addAction(action);
        console.log(`🗂️ ツール変更履歴記録: ${previousTool} → ${newTool}`);
    }
    
    /**
     * アンドゥ要求処理
     */
    handleUndoRequest(eventData) {
        this.undo();
    }
    
    /**
     * リドゥ要求処理
     */
    handleRedoRequest(eventData) {
        this.redo();
    }
    
    /**
     * アクション追加
     */
    addAction(action) {
        if (!this.isRecording) return;
        
        if (this.batchingEnabled && this.currentBatch) {
            // バッチ処理中
            this.currentBatch.actions.push(action);
            return;
        }
        
        // 通常のアクション追加
        this.undoStack.push(action);
        this.redoStack = []; // リドゥスタッククリア
        
        // 履歴サイズ制限
        if (this.undoStack.length > this.maxHistorySize) {
            this.undoStack.shift();
        }
        
        // 状態変更通知
        this.notifyStateChange();
    }
    
    /**
     * アンドゥ実行
     */
    undo() {
        if (this.undoStack.length === 0) {
            console.log('🗂️ アンドゥできません（履歴なし）');
            return false;
        }
        
        const action = this.undoStack.pop();
        
        try {
            // 記録停止してアンドゥ実行
            this.isRecording = false;
            
            if (action.type === this.actionTypes.BATCH) {
                // バッチアンドゥ
                action.actions.reverse().forEach(batchAction => {
                    if (batchAction.undo) batchAction.undo();
                });
            } else {
                // 単一アクションアンドゥ
                if (action.undo) action.undo();
            }
            
            this.redoStack.push(action);
            
            console.log(`🔙 アンドゥ実行: ${action.type}`, action.data);
            
            this.notifyStateChange();
            return true;
            
        } catch (error) {
            console.error('🚨 アンドゥ実行エラー:', error);
            return false;
        } finally {
            this.isRecording = true;
        }
    }
    
    /**
     * リドゥ実行
     */
    redo() {
        if (this.redoStack.length === 0) {
            console.log('🗂️ リドゥできません（履歴なし）');
            return false;
        }
        
        const action = this.redoStack.pop();
        
        try {
            // 記録停止してリドゥ実行
            this.isRecording = false;
            
            if (action.type === this.actionTypes.BATCH) {
                // バッチリドゥ
                action.actions.forEach(batchAction => {
                    if (batchAction.redo) batchAction.redo();
                });
            } else {
                // 単一アクションリドゥ
                if (action.redo) action.redo();
            }
            
            this.undoStack.push(action);
            
            console.log(`🔜 リドゥ実行: ${action.type}`, action.data);
            
            this.notifyStateChange();
            return true;
            
        } catch (error) {
            console.error('🚨 リドゥ実行エラー:', error);
            return false;
        } finally {
            this.isRecording = true;
        }
    }
    
    /**
     * ストロークアンドゥ
     */
    undoStroke(strokeId) {
        this.engine.removeStroke(strokeId);
        this.eventStore.emit(this.eventStore.eventTypes.STROKE_DELETE, { strokeId });
    }
    
    /**
     * ストロークリドゥ
     */
    redoStroke(strokeId) {
        // 注意: 実際の実装では、ストロークデータを保存して復元する必要がある
        console.log(`🔜 ストロークリドゥ: ${strokeId} (未完全実装)`);
    }
    
    /**
     * ツール変更アンドゥ
     */
    undoToolChange(previousTool) {
        this.engine.setTool(previousTool);
        this.eventStore.emit(this.eventStore.eventTypes.TOOL_CHANGE, { tool: previousTool });
    }
    
    /**
     * ツール変更リドゥ
     */
    redoToolChange(newTool) {
        this.engine.setTool(newTool);
        this.eventStore.emit(this.eventStore.eventTypes.TOOL_CHANGE, { tool: newTool });
    }
    
    /**
     * バッチ処理開始
     */
    startBatch(description = 'バッチ操作') {
        if (this.batchingEnabled) return false;
        
        this.batchingEnabled = true;
        this.currentBatch = {
            type: this.actionTypes.BATCH,
            description,
            timestamp: Date.now(),
            actions: []
        };
        
        console.log(`🗂️ バッチ処理開始: ${description}`);
        return true;
    }
    
    /**
     * バッチ処理終了
     */
    endBatch() {
        if (!this.batchingEnabled || !this.currentBatch) return false;
        
        if (this.currentBatch.actions.length > 0) {
            const batchAction = {
                type: this.actionTypes.BATCH,
                timestamp: this.currentBatch.timestamp,
                data: {
                    description: this.currentBatch.description,
                    actionCount: this.currentBatch.actions.length
                },
                actions: this.currentBatch.actions,
                undo: () => {
                    // バッチアンドゥは addAction で処理
                },
                redo: () => {
                    // バッチリドゥは addAction で処理
                }
            };
            
            this.undoStack.push(batchAction);
            this.redoStack = [];
            
            console.log(`🗂️ バッチ処理終了: ${this.currentBatch.description} (${this.currentBatch.actions.length}件)`);
        }
        
        this.batchingEnabled = false;
        this.currentBatch = null;
        this.notifyStateChange();
        
        return true;
    }
    
    /**
     * エンジン状態キャプチャ
     */
    captureEngineState() {
        return {
            activeStrokeCount: this.engine.activeStrokes.size,
            currentTool: this.engine.currentTool,
            canvasSize: {
                width: this.engine.canvas.width,
                height: this.engine.canvas.height
            }
        };
    }
    
    /**
     * 初期状態保存
     */
    saveInitialState() {
        this.currentState = this.captureEngineState();
        this.lastSavedState = { ...this.currentState };
        
        console.log('🗂️ 初期状態保存:', this.currentState);
    }
    
    /**
     * 状態変更通知
     */
    notifyStateChange() {
        this.currentState = this.captureEngineState();
        
        this.eventStore.emit(this.eventStore.eventTypes.HISTORY_STATE_CHANGE, {
            canUndo: this.canUndo(),
            canRedo: this.canRedo(),
            undoCount: this.undoStack.length,
            redoCount: this.redoStack.length,
            hasUnsavedChanges: this.hasUnsavedChanges()
        });
    }
    
    /**
     * アンドゥ可能判定
     */
    canUndo() {
        return this.undoStack.length > 0;
    }
    
    /**
     * リドゥ可能判定
     */
    canRedo() {
        return this.redoStack.length > 0;
    }
    
    /**
     * 未保存変更判定
     */
    hasUnsavedChanges() {
        return JSON.stringify(this.currentState) !== JSON.stringify(this.lastSavedState);
    }
    
    /**
     * 保存状態マーク
     */
    markAsSaved() {
        this.lastSavedState = { ...this.currentState };
        this.notifyStateChange();
        
        console.log('🗂️ 保存状態マーク');
    }
    
    /**
     * 履歴クリア
     */
    clearHistory() {
        this.undoStack = [];
        this.redoStack = [];
        this.currentBatch = null;
        this.batchingEnabled = false;
        
        this.notifyStateChange();
        
        console.log('🗂️ 履歴クリア');
    }
    
    /**
     * 履歴サイズ制限設定
     */
    setMaxHistorySize(size) {
        this.maxHistorySize = Math.max(1, size);
        
        // 既存履歴のトリム
        while (this.undoStack.length > this.maxHistorySize) {
            this.undoStack.shift();
        }
        
        console.log(`🗂️ 履歴サイズ制限: ${this.maxHistorySize}`);
    }
    
    /**
     * 記録有効/無効切替
     */
    setRecording(enabled) {
        this.isRecording = enabled;
        console.log(`🗂️ 履歴記録${enabled ? '有効' : '無効'}`);
    }
    
    /**
     * 履歴統計取得
     */
    getHistoryStats() {
        const stats = {
            undoCount: this.undoStack.length,
            redoCount: this.redoStack.length,
            maxHistorySize: this.maxHistorySize,
            isRecording: this.isRecording,
            batchingEnabled: this.batchingEnabled,
            hasUnsavedChanges: this.hasUnsavedChanges(),
            actionTypes: {}
        };
        
        // アクション種別別統計
        this.undoStack.forEach(action => {
            stats.actionTypes[action.type] = (stats.actionTypes[action.type] || 0) + 1;
        });
        
        return stats;
    }
    
    /**
     * デバッグ用履歴一覧
     */
    getHistoryList() {
        return {
            undoStack: this.undoStack.map(action => ({
                type: action.type,
                timestamp: action.timestamp,
                data: action.data
            })),
            redoStack: this.redoStack.map(action => ({
                type: action.type,
                timestamp: action.timestamp,
                data: action.data
            }))
        };
    }
}