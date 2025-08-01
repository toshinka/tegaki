/**
 * HistoryController - アンドゥ・リドゥ制御（Phase1基盤）
 * EventStore連携履歴管理・状態復元・スナップショット
 */
export class HistoryController {
    constructor(oglCore, eventStore) {
        this.oglCore = oglCore;
        this.eventStore = eventStore;
        
        // 履歴管理
        this.history = [];
        this.currentIndex = -1;
        this.maxHistorySize = 50;
        
        // アクション種別定義
        this.actionTypes = {
            STROKE: 'stroke',
            TOOL_CHANGE: 'tool_change',
            LAYER_CHANGE: 'layer_change',
            CANVAS_TRANSFORM: 'canvas_transform',
            COLOR_CHANGE: 'color_change',
            LAYER_ADD: 'layer_add',
            LAYER_DELETE: 'layer_delete',
            LAYER_MOVE: 'layer_move',
            MESH_DEFORM: 'mesh_deform'
        };
        
        // スナップショット設定
        this.snapshotInterval = 10; // 10アクションごとにスナップショット
        this.lastSnapshotIndex = -1;
        
        // パフォーマンス最適化
        this.isRecording = true;
        this.batchActions = [];
        this.batchTimer = null;
        this.batchTimeout = 100; // 100ms以内のアクションをバッチ化
        
        this.setupEventSubscriptions();
    }
    
    // 初期化
    initialize() {
        // 初期状態をスナップショット
        this.createInitialSnapshot();
        
        console.log('✅ History controller initialized');
        this.eventStore.emit(this.eventStore.eventTypes.HISTORY_CHANGE, {
            action: 'initialize',
            canUndo: this.canUndo(),
            canRedo: this.canRedo()
        });
    }
    
    // イベント購読設定
    setupEventSubscriptions() {
        // ストローク完了時の履歴記録
        this.eventStore.on(this.eventStore.eventTypes.STROKE_COMPLETE, (data) => {
            this.recordAction({
                type: this.actionTypes.STROKE,
                strokeId: data.payload.strokeId,
                tool: data.payload.tool,
                timestamp: Date.now()
            });
        });
        
        // ツール変更履歴
        this.eventStore.on(this.eventStore.eventTypes.TOOL_CHANGE, (data) => {
            this.recordAction({
                type: this.actionTypes.TOOL_CHANGE,
                previousTool: this.oglCore?.currentTool,
                newTool: data.payload.tool,
                timestamp: Date.now()
            });
        });
        
        // キャンバス変換履歴
        this.eventStore.on(this.eventStore.eventTypes.CANVAS_TRANSFORM, (data) => {
            this.recordAction({
                type: this.actionTypes.CANVAS_TRANSFORM,
                transform: data.payload.transform,
                transformType: data.payload.type,
                timestamp: Date.now()
            });
        });
        
        // 履歴操作リクエスト
        this.eventStore.on(this.eventStore.eventTypes.HISTORY_CHANGE, (data) => {
            const action = data.payload.action;
            if (action === 'undo') {
                this.undo();
            } else if (action === 'redo') {
                this.redo();
            }
        });
    }
    
    // アクション記録
    recordAction(actionData) {
        if (!this.isRecording) return;
        
        // バッチ処理検討
        if (this.shouldBatchAction(actionData)) {
            this.addToBatch(actionData);
            return;
        }
        
        // 現在位置以降の履歴を削除（新しいブランチ作成）
        if (this.currentIndex < this.history.length - 1) {
            this.history.splice(this.currentIndex + 1);
        }
        
        // 履歴サイズ制限
        if (this.history.length >= this.maxHistorySize) {
            this.history.shift();
            this.currentIndex--;
            this.lastSnapshotIndex--;
        }
        
        // スナップショット作成判定
        const needsSnapshot = this.shouldCreateSnapshot();
        if (needsSnapshot) {
            actionData.snapshot = this.createStateSnapshot();
            this.lastSnapshotIndex = this.history.length;
        }
        
        // アクション追加
        this.history.push({
            ...actionData,
            id: this.generateActionId(),
            index: this.history.length
        });
        
        this.currentIndex = this.history.length - 1;
        
        // 履歴変更通知
        this.notifyHistoryChange('record', actionData.type);
        
        console.log(`📝 Action recorded: ${actionData.type} (${this.currentIndex + 1}/${this.history.length})`);
    }
    
    // アンドゥ実行
    undo() {
        if (!this.canUndo()) {
            console.warn('⚠️ Cannot undo: no previous actions');
            return false;
        }
        
        const currentAction = this.history[this.currentIndex];
        
        try {
            // アクション種別に応じた復元処理
            this.revertAction(currentAction);
            
            this.currentIndex--;
            this.notifyHistoryChange('undo', currentAction.type);
            
            console.log(`↶ Undo: ${currentAction.type} (${this.currentIndex + 1}/${this.history.length})`);
            return true;
            
        } catch (error) {
            console.error('🚨 Undo failed:', error);
            this.eventStore.emit(this.eventStore.eventTypes.ENGINE_ERROR, { error, action: 'undo' });
            return false;
        }
    }
    
    // リドゥ実行
    redo() {
        if (!this.canRedo()) {
            console.warn('⚠️ Cannot redo: no next actions');
            return false;
        }
        
        const nextAction = this.history[this.currentIndex + 1];
        
        try {
            // アクション種別に応じた再実行処理
            this.executeAction(nextAction);
            
            this.currentIndex++;
            this.notifyHistoryChange('redo', nextAction.type);
            
            console.log(`↷ Redo: ${nextAction.type} (${this.currentIndex + 1}/${this.history.length})`);
            return true;
            
        } catch (error) {
            console.error('🚨 Redo failed:', error);
            this.eventStore.emit(this.eventStore.eventTypes.ENGINE_ERROR, { error, action: 'redo' });
            return false;
        }
    }
    
    // アンドゥ可能判定
    canUndo() {
        return this.currentIndex >= 0;
    }
    
    // リドゥ可能判定
    canRedo() {
        return this.currentIndex < this.history.length - 1;
    }
    
    // アクション復元
    revertAction(action) {
        switch (action.type) {
            case this.actionTypes.STROKE:
                this.revertStroke(action);
                break;
                
            case this.actionTypes.TOOL_CHANGE:
                if (action.previousTool) {
                    this.oglCore.setTool(action.previousTool);
                }
                break;
                
            case this.actionTypes.CANVAS_TRANSFORM:
                this.revertCanvasTransform(action);
                break;
                
            // Phase2以降で拡張
            case this.actionTypes.LAYER_CHANGE:
                this.revertLayerChange(action);
                break;
                
            default:
                console.warn(`⚠️ Unknown action type for revert: ${action.type}`);
        }
    }
    
    // アクション再実行
    executeAction(action) {
        switch (action.type) {
            case this.actionTypes.STROKE:
                this.redoStroke(action);
                break;
                
            case this.actionTypes.TOOL_CHANGE:
                this.oglCore.setTool(action.newTool);
                break;
                
            case this.actionTypes.CANVAS_TRANSFORM:
                this.redoCanvasTransform(action);
                break;
                
            // Phase2以降で拡張
            case this.actionTypes.LAYER_CHANGE:
                this.redoLayerChange(action);
                break;
                
            default:
                console.warn(`⚠️ Unknown action type for execute: ${action.type}`);
        }
    }
    
    // ストローク復元
    revertStroke(action) {
        // Phase1: 基本的なストローク削除
        const strokeIndex = this.oglCore.strokes.findIndex(
            stroke => stroke.id === action.strokeId
        );
        
        if (strokeIndex !== -1) {
            const stroke = this.oglCore.strokes[strokeIndex];
            
            // OGLシーンから削除
            if (stroke.mesh && stroke.mesh.parent) {
                stroke.mesh.setParent(null);
            }
            
            // ストローク配列から削除
            this.oglCore.strokes.splice(strokeIndex, 1);
            this.oglCore.needsRedraw = true;
        }
    }
    
    // ストローク再実行
    redoStroke(action) {
        // Phase1: 基本的なストローク復元
        // 実際の実装ではスナップショットからの復元が必要
        console.log(`🔄 Redo stroke: ${action.strokeId}`);
        
        // スナップショットが利用可能な場合は復元
        if (action.snapshot) {
            this.restoreFromSnapshot(action.snapshot);
        }
    }
    
    // キャンバス変換復元
    revertCanvasTransform(action) {
        // 前の変換状態を復元（Phase1基盤）
        if (this.currentIndex > 0) {
            const prevAction = this.findPreviousTransformAction();
            if (prevAction && prevAction.transform) {
                this.applyCanvasTransform(prevAction.transform);
            } else {
                // 初期状態に復元
                this.resetCanvasTransform();
            }
        } else {
            this.resetCanvasTransform();
        }
    }
    
    // キャンバス変換再実行
    redoCanvasTransform(action) {
        if (action.transform) {
            this.applyCanvasTransform(action.transform);
        }
    }
    
    // レイヤー変更復元（Phase2で実装）
    revertLayerChange(action) {
        console.log(`🔄 Revert layer change: ${action.type}`);
        // Phase2で詳細実装
    }
    
    // レイヤー変更再実行（Phase2で実装）
    redoLayerChange(action) {
        console.log(`🔄 Redo layer change: ${action.type}`);
        // Phase2で詳細実装
    }
    
    // スナップショット作成判定
    shouldCreateSnapshot() {
        const actionsSinceSnapshot = this.history.length - this.lastSnapshotIndex;
        return actionsSinceSnapshot >= this.snapshotInterval;
    }
    
    // 状態スナップショット作成
    createStateSnapshot() {
        const snapshot = {
            timestamp: Date.now(),
            strokes: this.oglCore.strokes.map(stroke => ({
                id: stroke.id,
                tool: stroke.tool,
                points: [...stroke.points],
                config: { ...stroke.config }
            })),
            currentTool: this.oglCore.currentTool,
            // Phase2以降で拡張
            // layers: this.layerProcessor?.getLayerSnapshot(),
            // canvasTransform: this.inputController?.canvasTransform
        };
        
        return snapshot;
    }
    
    // 初期スナップショット作成
    createInitialSnapshot() {
        const snapshot = this.createStateSnapshot();
        this.recordAction({
            type: 'initial_state',
            snapshot,
            timestamp: Date.now()
        });
    }
    
    // スナップショットから復元
    restoreFromSnapshot(snapshot) {
        if (!snapshot) return;
        
        try {
            // 描画記録を停止
            this.isRecording = false;
            
            // ストローク復元
            this.oglCore.strokes = [];
            if (snapshot.strokes) {
                snapshot.strokes.forEach(strokeData => {
                    // ストロークを再構築
                    this.reconstructStroke(strokeData);
                });
            }
            
            // ツール復元
            if (snapshot.currentTool) {
                this.oglCore.setTool(snapshot.currentTool);
            }
            
            // 再描画
            this.oglCore.needsRedraw = true;
            
            // 描画記録を再開
            this.isRecording = true;
            
            console.log('✅ State restored from snapshot');
            
        } catch (error) {
            console.error('🚨 Snapshot restoration failed:', error);
            this.isRecording = true;
            throw error;
        }
    }
    
    // ストローク再構築
    reconstructStroke(strokeData) {
        // Phase1: 基本的なストローク再構築
        const reconstructedStroke = {
            id: strokeData.id,
            tool: strokeData.tool,
            points: [...strokeData.points],
            config: { ...strokeData.config },
            timestamp: strokeData.timestamp || Date.now()
        };
        
        // OGLジオメトリ再構築
        this.oglCore.currentStroke = reconstructedStroke;
        this.oglCore.createStrokeGeometry();
        this.oglCore.finalizeStroke();
        
        this.oglCore.strokes.push(reconstructedStroke);
        this.oglCore.currentStroke = null;
    }
    
    // バッチ処理判定
    shouldBatchAction(actionData) {
        // 連続する同種のアクションをバッチ化
        const batchableTypes = [
            this.actionTypes.CANVAS_TRANSFORM,
            this.actionTypes.TOOL_CONFIG_CHANGE
        ];
        
        return batchableTypes.includes(actionData.type);
    }
    
    // バッチ追加
    addToBatch(actionData) {
        this.batchActions.push(actionData);
        
        // バッチタイマー設定
        clearTimeout(this.batchTimer);
        this.batchTimer = setTimeout(() => {
            this.processBatch();
        }, this.batchTimeout);
    }
    
    // バッチ処理
    processBatch() {
        if (this.batchActions.length === 0) return;
        
        // バッチアクションを統合
        const batchedAction = {
            type: 'batch',
            actions: [...this.batchActions],
            timestamp: Date.now(),
            summary: `Batch of ${this.batchActions.length} actions`
        };
        
        // 通常の記録処理
        this.recordAction(batchedAction);
        
        // バッチクリア
        this.batchActions = [];
        console.log(`📦 Batch processed: ${batchedAction.actions.length} actions`);
    }
    
    // 前のキャンバス変換アクション検索
    findPreviousTransformAction() {
        for (let i = this.currentIndex - 1; i >= 0; i--) {
            const action = this.history[i];
            if (action.type === this.actionTypes.CANVAS_TRANSFORM) {
                return action;
            }
        }
        return null;
    }
    
    // キャンバス変換適用
    applyCanvasTransform(transform) {
        if (this.inputController) {
            this.inputController.setCanvasTransform(transform);
        }
    }
    
    // キャンバス変換リセット
    resetCanvasTransform() {
        if (this.inputController) {
            this.inputController.resetCanvas();
        }
    }
    
    // 履歴変更通知
    notifyHistoryChange(action, actionType) {
        this.eventStore.emit(this.eventStore.eventTypes.HISTORY_CHANGE, {
            action,
            actionType,
            canUndo: this.canUndo(),
            canRedo: this.canRedo(),
            historyLength: this.history.length,
            currentIndex: this.currentIndex
        });
    }
    
    // アクションID生成
    generateActionId() {
        return `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    // 履歴クリア
    clearHistory() {
        this.history = [];
        this.currentIndex = -1;
        this.lastSnapshotIndex = -1;
        
        this.notifyHistoryChange('clear');
        console.log('🗑️ History cleared');
    }
    
    // 履歴統計取得
    getHistoryStats() {
        const stats = {
            totalActions: this.history.length,
            currentIndex: this.currentIndex,
            canUndo: this.canUndo(),
            canRedo: this.canRedo(),
            snapshotCount: this.history.filter(action => action.snapshot).length,
            actionTypes: {}
        };
        
        this.history.forEach(action => {
            stats.actionTypes[action.type] = (stats.actionTypes[action.type] || 0) + 1;
        });
        
        return stats;
    }
    
    // メモリ最適化
    optimizeMemory() {
        // 古いスナップショットの削除
        const keepSnapshots = 5;
        let snapshotCount = 0;
        
        for (let i = this.history.length - 1; i >= 0; i--) {
            const action = this.history[i];
            if (action.snapshot) {
                snapshotCount++;
                if (snapshotCount > keepSnapshots) {
                    delete action.snapshot;
                }
            }
        }
        
        console.log('🧹 Memory optimized: old snapshots removed');
    }
    
    // デバッグ情報
    getDebugInfo() {
        return {
            historyLength: this.history.length,
            currentIndex: this.currentIndex,
            canUndo: this.canUndo(),
            canRedo: this.canRedo(),
            isRecording: this.isRecording,
            batchSize: this.batchActions.length,
            stats: this.getHistoryStats()
        };
    }
    
    // クリーンアップ
    destroy() {
        clearTimeout(this.batchTimer);
        this.clearHistory();
        this.batchActions = [];
        
        console.log('✅ History controller destroyed');
    }
}