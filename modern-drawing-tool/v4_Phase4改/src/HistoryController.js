/**
 * HistoryController - アンドゥ・リドゥ制御（Phase1基盤）
 * EventStore連携履歴管理・状態復元・スナップショット
 * 🔧 無限再帰エラー修正版
 */
export class HistoryController {
    constructor(oglCore, eventStore) {
        this.oglCore = oglCore;
        this.eventStore = eventStore;
        
        // 履歴管理
        this.history = [];
        this.currentIndex = -1;
        this.maxHistorySize = 50;
        
        // 🔧 無限再帰防止フラグ
        this.isRecording = true;
        this.isNotifying = false;
        this.recordingDepth = 0;
        this.maxRecordingDepth = 3;
        
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
            MESH_DEFORM: 'mesh_deform',
            INITIAL_STATE: 'initial_state'
        };
        
        // スナップショット設定
        this.snapshotInterval = 10; // 10アクションごとにスナップショット
        this.lastSnapshotIndex = -1;
        
        // パフォーマンス最適化
        this.batchActions = [];
        this.batchTimer = null;
        this.batchTimeout = 100; // 100ms以内のアクションをバッチ化
        
        // 🔧 遅延初期化（無限ループ防止）
        setTimeout(() => {
            this.setupEventSubscriptions();
        }, 0);
    }
    
    // 初期化
    initialize() {
        if (this.isNotifying) {
            console.warn('⚠️ HistoryController: Already initializing, skipping...');
            return;
        }
        
        try {
            // 初期状態をスナップショット
            this.createInitialSnapshot();
            
            console.log('✅ History controller initialized');
            
            // 🔧 初期化完了通知（循環防止）
            this.safeNotifyHistoryChange('initialize');
            
        } catch (error) {
            console.error('🚨 HistoryController initialization failed:', error);
        }
    }
    
    // 🔧 イベント購読設定（循環防止強化）
    setupEventSubscriptions() {
        // ストローク完了時の履歴記録
        this.eventStore.on(this.eventStore.eventTypes.STROKE_COMPLETE, (data) => {
            if (!this.isRecording || this.recordingDepth > 0) return;
            
            this.recordActionSafe({
                type: this.actionTypes.STROKE,
                strokeId: data.payload?.strokeId || 'unknown',
                tool: data.payload?.tool || 'pen',
                timestamp: Date.now()
            });
        });
        
        // ツール変更履歴
        this.eventStore.on(this.eventStore.eventTypes.TOOL_CHANGE, (data) => {
            if (!this.isRecording || this.recordingDepth > 0) return;
            
            this.recordActionSafe({
                type: this.actionTypes.TOOL_CHANGE,
                previousTool: this.oglCore?.currentTool || 'pen',
                newTool: data.payload?.tool || 'pen',
                timestamp: Date.now()
            });
        });
        
        // キャンバス変換履歴
        this.eventStore.on(this.eventStore.eventTypes.CANVAS_TRANSFORM, (data) => {
            if (!this.isRecording || this.recordingDepth > 0) return;
            
            this.recordActionSafe({
                type: this.actionTypes.CANVAS_TRANSFORM,
                transform: data.payload?.transform || {},
                transformType: data.payload?.type || 'unknown',
                timestamp: Date.now()
            });
        });
        
        // 🔧 履歴操作リクエスト（外部からのundo/redo要求）
        this.eventStore.on('history:request', (data) => {
            const action = data.payload?.action;
            if (action === 'undo') {
                this.undo();
            } else if (action === 'redo') {
                this.redo();
            }
        });
    }
    
    // 🔧 安全なアクション記録（無限ループ防止）
    recordActionSafe(actionData) {
        if (this.recordingDepth >= this.maxRecordingDepth) {
            console.warn('⚠️ HistoryController: Maximum recording depth reached, skipping action');
            return;
        }
        
        this.recordingDepth++;
        
        try {
            this.recordAction(actionData);
        } catch (error) {
            console.error('🚨 HistoryController: recordAction failed:', error);
        } finally {
            this.recordingDepth--;
        }
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
            try {
                actionData.snapshot = this.createStateSnapshot();
                this.lastSnapshotIndex = this.history.length;
            } catch (error) {
                console.error('🚨 Snapshot creation failed:', error);
            }
        }
        
        // アクション追加
        this.history.push({
            ...actionData,
            id: this.generateActionId(),
            index: this.history.length
        });
        
        this.currentIndex = this.history.length - 1;
        
        // 🔧 履歴変更通知（安全版）
        this.safeNotifyHistoryChange('record', actionData.type);
        
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
            // 記録停止（循環防止）
            this.isRecording = false;
            
            // アクション種別に応じた復元処理
            this.revertAction(currentAction);
            
            this.currentIndex--;
            this.safeNotifyHistoryChange('undo', currentAction.type);
            
            console.log(`↶ Undo: ${currentAction.type} (${this.currentIndex + 1}/${this.history.length})`);
            return true;
            
        } catch (error) {
            console.error('🚨 Undo failed:', error);
            this.eventStore.emit(this.eventStore.eventTypes.ENGINE_ERROR, { error, action: 'undo' });
            return false;
        } finally {
            // 記録再開
            setTimeout(() => {
                this.isRecording = true;
            }, 100);
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
            // 記録停止（循環防止）
            this.isRecording = false;
            
            // アクション種別に応じた再実行処理
            this.executeAction(nextAction);
            
            this.currentIndex++;
            this.safeNotifyHistoryChange('redo', nextAction.type);
            
            console.log(`↷ Redo: ${nextAction.type} (${this.currentIndex + 1}/${this.history.length})`);
            return true;
            
        } catch (error) {
            console.error('🚨 Redo failed:', error);
            this.eventStore.emit(this.eventStore.eventTypes.ENGINE_ERROR, { error, action: 'redo' });
            return false;
        } finally {
            // 記録再開
            setTimeout(() => {
                this.isRecording = true;
            }, 100);
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
                if (action.previousTool && this.oglCore?.setTool) {
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
                if (this.oglCore?.setTool) {
                    this.oglCore.setTool(action.newTool);
                }
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
        if (!this.oglCore?.strokes) return;
        
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
        try {
            const snapshot = {
                timestamp: Date.now(),
                strokes: this.oglCore?.strokes ? this.oglCore.strokes.map(stroke => ({
                    id: stroke.id,
                    tool: stroke.tool,
                    points: stroke.points ? [...stroke.points] : [],
                    config: stroke.config ? { ...stroke.config } : {}
                })) : [],
                currentTool: this.oglCore?.currentTool || 'pen',
                // Phase2以降で拡張
                // layers: this.layerProcessor?.getLayerSnapshot(),
                // canvasTransform: this.inputController?.canvasTransform
            };
            
            return snapshot;
        } catch (error) {
            console.error('🚨 createStateSnapshot failed:', error);
            return {
                timestamp: Date.now(),
                strokes: [],
                currentTool: 'pen'
            };
        }
    }
    
    // 初期スナップショット作成
    createInitialSnapshot() {
        try {
            const snapshot = this.createStateSnapshot();
            this.recordAction({
                type: this.actionTypes.INITIAL_STATE,
                snapshot,
                timestamp: Date.now()
            });
        } catch (error) {
            console.error('🚨 createInitialSnapshot failed:', error);
        }
    }
    
    // スナップショットから復元
    restoreFromSnapshot(snapshot) {
        if (!snapshot) return;
        
        try {
            // 描画記録を停止
            this.isRecording = false;
            
            // ストローク復元
            if (this.oglCore) {
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
            }
            
            console.log('✅ State restored from snapshot');
            
        } catch (error) {
            console.error('🚨 Snapshot restoration failed:', error);
            throw error;
        } finally {
            // 描画記録を再開
            setTimeout(() => {
                this.isRecording = true;
            }, 100);
        }
    }
    
    // ストローク再構築
    reconstructStroke(strokeData) {
        // Phase1: 基本的なストローク再構築
        try {
            const reconstructedStroke = {
                id: strokeData.id,
                tool: strokeData.tool,
                points: [...strokeData.points],
                config: { ...strokeData.config },
                timestamp: strokeData.timestamp || Date.now()
            };
            
            // OGLジオメトリ再構築
            if (this.oglCore) {
                this.oglCore.currentStroke = reconstructedStroke;
                this.oglCore.createStrokeGeometry?.();
                this.oglCore.finalizeStroke?.();
                
                this.oglCore.strokes.push(reconstructedStroke);
                this.oglCore.currentStroke = null;
            }
        } catch (error) {
            console.error('🚨 reconstructStroke failed:', error);
        }
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
    
    // 🔧 安全な履歴変更通知（無限ループ防止）
    safeNotifyHistoryChange(action, actionType = null) {
        if (this.isNotifying) {
            console.warn('⚠️ HistoryController: Already notifying, skipping...');
            return;
        }
        
        this.isNotifying = true;
        
        try {
            // 遅延実行で循環参照を回避
            setTimeout(() => {
                this.eventStore.emit(this.eventStore.eventTypes.HISTORY_CHANGE, {
                    action,
                    actionType,
                    canUndo: this.canUndo(),
                    canRedo: this.canRedo(),
                    historyLength: this.history.length,
                    currentIndex: this.currentIndex
                });
                
                this.isNotifying = false;
            }, 0);
        } catch (error) {
            console.error('🚨 safeNotifyHistoryChange failed:', error);
            this.isNotifying = false;
        }
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
        
        this.safeNotifyHistoryChange('clear');
        console.log('🗑️ History cleared');
    }
    
    // 履歴統計取得
    getHistoryStats() {
        try {
            const stats = {
                totalActions: this.history.length,
                currentIndex: this.currentIndex,
                canUndo: this.canUndo(),
                canRedo: this.canRedo(),
                snapshotCount: this.history.filter(action => action.snapshot).length,
                actionTypes: {},
                isRecording: this.isRecording,
                isNotifying: this.isNotifying,
                recordingDepth: this.recordingDepth
            };
            
            this.history.forEach(action => {
                stats.actionTypes[action.type] = (stats.actionTypes[action.type] || 0) + 1;
            });
            
            return stats;
        } catch (error) {
            console.error('🚨 getHistoryStats failed:', error);
            return {
                totalActions: 0,
                currentIndex: -1,
                canUndo: false,
                canRedo: false,
                snapshotCount: 0,
                actionTypes: {},
                isRecording: this.isRecording,
                isNotifying: this.isNotifying,
                recordingDepth: this.recordingDepth
            };
        }
    }
    
    // メモリ最適化
    optimizeMemory() {
        try {
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
        } catch (error) {
            console.error('🚨 optimizeMemory failed:', error);
        }
    }
    
    // デバッグ情報
    getDebugInfo() {
        return {
            historyLength: this.history.length,
            currentIndex: this.currentIndex,
            canUndo: this.canUndo(),
            canRedo: this.canRedo(),
            isRecording: this.isRecording,
            isNotifying: this.isNotifying,
            recordingDepth: this.recordingDepth,
            batchSize: this.batchActions.length,
            stats: this.getHistoryStats()
        };
    }
    
    // クリーンアップ
    destroy() {
        clearTimeout(this.batchTimer);
        this.clearHistory();
        this.batchActions = [];
        this.isRecording = false;
        this.isNotifying = false;
        this.recordingDepth = 0;
        
        console.log('✅ History controller destroyed');
    }
}