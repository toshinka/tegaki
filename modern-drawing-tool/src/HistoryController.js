// HistoryController.js - アンドゥ・リドゥ制御（650-750行）

/**
 * 📚 OGL統一エンジン用履歴管理コントローラー
 * アクション記録・状態復元・スナップショット管理・複合操作対応
 */
export class HistoryController {
    constructor(oglEngine) {
        this.engine = oglEngine;
        
        // 履歴管理・スタック制御
        this.undoStack = [];
        this.redoStack = [];
        this.maxHistorySize = 50; // デフォルト50操作まで
        this.currentHistoryIndex = -1;
        
        // アクション記録・種別管理
        this.actionTypes = {
            STROKE: 'stroke',
            TOOL_CHANGE: 'tool_change',
            LAYER_OPERATION: 'layer_operation',
            CANVAS_OPERATION: 'canvas_operation',
            SELECTION_OPERATION: 'selection_operation',
            TRANSFORM_OPERATION: 'transform_operation',
            COLOR_CHANGE: 'color_change',
            CLEAR_CANVAS: 'clear_canvas',
            // Phase2以降で追加予定
            AIRBRUSH_STROKE: 'airbrush_stroke',        // Phase2
            BLUR_OPERATION: 'blur_operation',          // Phase2
            SHAPE_CREATION: 'shape_creation',          // Phase3
            MESH_DEFORM: 'mesh_deform',               // Phase4
            ANIMATION_KEYFRAME: 'animation_keyframe'   // Phase4
        };
        
        // 状態復元・スナップショット管理
        this.snapshotCache = new Map();
        this.compressionEnabled = true;
        this.snapshotInterval = 5; // 5操作ごとに完全スナップショット
        
        // 複合操作・グループ化
        this.groupedActions = [];
        this.isGrouping = false;
        this.currentGroupId = null;
        this.groupTimeout = null;
        
        // パフォーマンス最適化
        this.isRecording = true;
        this.batchActions = [];
        this.batchTimeout = null;
        this.debounceTime = 100; // 100ms以内の連続操作は統合
        
        // Phase2以降拡張予定
        // this.advancedHistory = null;             // Phase2で高度履歴機能
        // this.historyAnalytics = null;            // Phase2で履歴分析
        // this.historyUI = null;                   // Phase2で履歴UI表示
        // this.historyCompression = null;          // Phase3で履歴圧縮
        // this.historyPersistence = null;          // Phase4で永続化
        // this.collaborativeHistory = null;        // Phase4で協調履歴
        
        console.log('📚 履歴管理コントローラー初期化');
    }
    
    /**
     * 🔧 履歴管理初期化
     */
    initialize() {
        // 履歴サイズ設定（デバイス性能に応じて調整）
        this.adjustHistorySizeByDevice();
        
        // エンジンからの履歴イベント購読
        this.subscribeToEngineEvents();
        
        // メモリ管理設定
        this.setupMemoryManagement();
        
        console.log(`📚 履歴管理初期化完了 - 最大履歴数: ${this.maxHistorySize}`);
    }
    
    /**
     * 📱 デバイス性能に応じた履歴サイズ調整
     */
    adjustHistorySizeByDevice() {
        const memory = navigator.deviceMemory || 4; // GB
        const hardwareConcurrency = navigator.hardwareConcurrency || 4;
        
        if (memory >= 8 && hardwareConcurrency >= 8) {
            this.maxHistorySize = 100; // 高性能デバイス
        } else if (memory >= 4 && hardwareConcurrency >= 4) {
            this.maxHistorySize = 50;  // 標準デバイス
        } else {
            this.maxHistorySize = 25;  // 低性能デバイス
            this.compressionEnabled = true;
        }
        
        console.log(`📱 デバイス性能調整: RAM ${memory}GB, CPU ${hardwareConcurrency}コア -> 履歴${this.maxHistorySize}操作`);
    }
    
    /**
     * 🎧 エンジンイベント購読
     */
    subscribeToEngineEvents() {
        // ストローク描画完了
        this.engine.onStrokeComplete = (strokeData) => {
            this.recordAction(this.actionTypes.STROKE, {
                strokeData: this.compressStrokeData(strokeData),
                timestamp: Date.now(),
                tool: this.engine.currentTool
            });
        };
        
        // ツール変更
        this.engine.onToolChange = (oldTool, newTool) => {
            this.recordAction(this.actionTypes.TOOL_CHANGE, {
                oldTool,
                newTool,
                timestamp: Date.now()
            });
        };
        
        // キャンバスクリア
        this.engine.onCanvasClear = () => {
            this.recordAction(this.actionTypes.CLEAR_CANVAS, {
                previousSnapshot: this.createCanvasSnapshot(),
                timestamp: Date.now()
            });
        };
        
        // Phase2以降で追加イベント購読
        /*
        this.engine.onAirbrushComplete = (airbrushData) => {
            this.recordAction(this.actionTypes.AIRBRUSH_STROKE, airbrushData);
        };
        
        this.engine.onBlurOperation = (blurData) => {
            this.recordAction(this.actionTypes.BLUR_OPERATION, blurData);
        };
        */
    }
    
    /**
     * 📝 アクション記録
     */
    recordAction(actionType, actionData) {
        if (!this.isRecording) return;
        
        const action = {
            id: this.generateActionId(),
            type: actionType,
            data: actionData,
            timestamp: Date.now(),
            groupId: this.currentGroupId,
            beforeState: this.shouldCreateSnapshot(actionType) ? this.createCanvasSnapshot() : null,
            afterState: null // 遅延作成
        };
        
        // デバウンス処理（連続操作の統合）
        if (this.shouldDebounceAction(actionType)) {
            this.addToBatch(action);
        } else {
            this.commitAction(action);
        }
    }
    
    /**
     * ⏱️ デバウンス判定
     */
    shouldDebounceAction(actionType) {
        const debounceTypes = [
            this.actionTypes.STROKE,
            this.actionTypes.AIRBRUSH_STROKE,
            this.actionTypes.BLUR_OPERATION
        ];
        
        return debounceTypes.includes(actionType);
    }
    
    /**
     * 📦 バッチアクション追加
     */
    addToBatch(action) {
        this.batchActions.push(action);
        
        // バッチタイムアウトリセット
        if (this.batchTimeout) {
            clearTimeout(this.batchTimeout);
        }
        
        this.batchTimeout = setTimeout(() => {
            this.commitBatchActions();
        }, this.debounceTime);
    }
    
    /**
     * 🚀 バッチアクションコミット
     */
    commitBatchActions() {
        if (this.batchActions.length === 0) return;
        
        if (this.batchActions.length === 1) {
            // 単一アクション
            this.commitAction(this.batchActions[0]);
        } else {
            // 複数アクションを統合
            const mergedAction = this.mergeBatchActions(this.batchActions);
            this.commitAction(mergedAction);
        }
        
        this.batchActions = [];
        this.batchTimeout = null;
    }
    
    /**
     * 🔄 バッチアクション統合
     */
    mergeBatchActions(actions) {
        const firstAction = actions[0];
        const lastAction = actions[actions.length - 1];
        
        return {
            id: this.generateActionId(),
            type: firstAction.type,
            data: {
                mergedActions: actions.map(a => a.data),
                startTimestamp: firstAction.timestamp,
                endTimestamp: lastAction.timestamp,
                actionCount: actions.length
            },
            timestamp: lastAction.timestamp,
            groupId: firstAction.groupId,
            beforeState: firstAction.beforeState,
            afterState: null,
            isMerged: true
        };
    }
    
    /**
     * ✅ アクションコミット
     */
    commitAction(action) {
        // Redo スタッククリア（新しいアクションでブランチ作成）
        this.redoStack = [];
        
        // After State 作成（必要に応じて）
        if (this.shouldCreateSnapshot(action.type)) {
            action.afterState = this.createCanvasSnapshot();
        }
        
        // Undo スタックに追加
        this.undoStack.push(action);
        this.currentHistoryIndex++;
        
        // 履歴サイズ制限
        this.enforceHistoryLimit();
        
        // スナップショット管理
        this.manageSnapshots();
        
        this.logAction('record', action);
    }
    
    /**
     * 📸 スナップショット作成判定
     */
    shouldCreateSnapshot(actionType) {
        const snapshotTypes = [
            this.actionTypes.STROKE,
            this.actionTypes.CLEAR_CANVAS,
            this.actionTypes.LAYER_OPERATION,
            this.actionTypes.CANVAS_OPERATION,
            this.actionTypes.TRANSFORM_OPERATION
        ];
        
        return snapshotTypes.includes(actionType);
    }
    
    /**
     * 📸 キャンバススナップショット作成
     */
    createCanvasSnapshot() {
        try {
            // OGL統一エンジンからスナップショット取得
            const snapshot = this.engine.createSnapshot();
            
            if (this.compressionEnabled) {
                return this.compressSnapshot(snapshot);
            }
            
            return snapshot;
            
        } catch (error) {
            console.error('🚨 スナップショット作成エラー:', error);
            return null;
        }
    }
    
    /**
     * 🗜️ スナップショット圧縮
     */
    compressSnapshot(snapshot) {
        // Phase3で詳細圧縮実装予定
        try {
            return {
                compressed: true,
                data: snapshot, // 実際の圧縮はPhase3で実装
                originalSize: JSON.stringify(snapshot).length,
                compressedSize: JSON.stringify(snapshot).length // Phase3で実装
            };
        } catch (error) {
            console.error('🚨 スナップショット圧縮エラー:', error);
            return snapshot;
        }
    }
    
    /**
     * 🗜️ ストロークデータ圧縮
     */
    compressStrokeData(strokeData) {
        // 不要な精度削減・重複除去
        if (!strokeData || !strokeData.points) return strokeData;
        
        const compressed = {
            ...strokeData,
            points: strokeData.points.filter((point, index) => {
                // 最初と最後の点は必ず保持
                if (index === 0 || index === strokeData.points.length - 1) return true;
                
                // 距離が近すぎる点は除去
                const prevPoint = strokeData.points[index - 1];
                const distance = Math.sqrt(
                    Math.pow(point.x - prevPoint.x, 2) + 
                    Math.pow(point.y - prevPoint.y, 2)
                );
                
                return distance > 2.0; // 2px以上の距離がある点のみ保持
            })
        };
        
        return compressed;
    }
    
    /**
     * 📏 履歴サイズ制限実行
     */
    enforceHistoryLimit() {
        while (this.undoStack.length > this.maxHistorySize) {
            const removedAction = this.undoStack.shift();
            this.currentHistoryIndex--;
            
            // 削除されたアクションのスナップショットをキャッシュから削除
            if (removedAction.beforeState) {
                this.snapshotCache.delete(removedAction.id);
            }
        }
    }
    
    /**
     * 📸 スナップショット管理
     */
    manageSnapshots() {
        // 定期的な完全スナップショット作成
        if (this.undoStack.length % this.snapshotInterval === 0) {
            const fullSnapshot = this.createFullSnapshot();
            this.snapshotCache.set(`full_${Date.now()}`, fullSnapshot);
        }
        
        // 古いスナップショット削除
        this.cleanupOldSnapshots();
    }
    
    /**
     * 📸 完全スナップショット作成
     */
    createFullSnapshot() {
        return {
            canvas: this.engine.createSnapshot(),
            settings: this.engine.getEngineState(),
            timestamp: Date.now(),
            historyIndex: this.currentHistoryIndex
        };
    }
    
    /**
     * 🧹 古いスナップショットクリーンアップ
     */
    cleanupOldSnapshots() {
        const maxCacheSize = 10;
        const cacheKeys = Array.from(this.snapshotCache.keys());
        
        if (cacheKeys.length > maxCacheSize) {
            const oldestKeys = cacheKeys
                .filter(key => key.startsWith('full_'))
                .sort()
                .slice(0, cacheKeys.length - maxCacheSize);
            
            oldestKeys.forEach(key => this.snapshotCache.delete(key));
        }
    }
    
    /**
     * ↩️ アンドゥ実行
     */
    undo() {
        if (this.undoStack.length === 0) {
            console.log('📚 アンドゥ履歴が空です');
            return false;
        }
        
        // バッチアクション強制コミット
        this.commitBatchActions();
        
        const action = this.undoStack.pop();
        this.redoStack.push(action);
        this.currentHistoryIndex--;
        
        try {
            this.revertAction(action);
            this.logAction('undo', action);
            return true;
            
        } catch (error) {
            console.error('🚨 アンドゥ実行エラー:', error);
            // エラー時は履歴を元に戻す
            this.undoStack.push(action);
            this.redoStack.pop();
            this.currentHistoryIndex++;
            return false;
        }
    }
    
    /**
     * ↪️ リドゥ実行
     */
    redo() {
        if (this.redoStack.length === 0) {
            console.log('📚 リドゥ履歴が空です');
            return false;
        }
        
        const action = this.redoStack.pop();
        this.undoStack.push(action);
        this.currentHistoryIndex++;
        
        try {
            this.reapplyAction(action);
            this.logAction('redo', action);
            return true;
            
        } catch (error) {
            console.error('🚨 リドゥ実行エラー:', error);
            // エラー時は履歴を元に戻す
            this.redoStack.push(action);
            this.undoStack.pop();
            this.currentHistoryIndex--;
            return false;
        }
    }
    
    /**
     * 🔄 アクション復元
     */
    revertAction(action) {
        switch (action.type) {
            case this.actionTypes.STROKE:
                this.revertStroke(action);
                break;
            case this.actionTypes.TOOL_CHANGE:
                this.revertToolChange(action);
                break;
            case this.actionTypes.CLEAR_CANVAS:
                this.revertCanvasClear(action);
                break;
            case this.actionTypes.COLOR_CHANGE:
                this.revertColorChange(action);
                break;
            // Phase2以降で追加操作対応
            /*
            case this.actionTypes.AIRBRUSH_STROKE:
                this.revertAirbrushStroke(action);
                break;
            case this.actionTypes.BLUR_OPERATION:
                this.revertBlurOperation(action);
                break;
            case this.actionTypes.LAYER_OPERATION:
                this.revertLayerOperation(action);
                break;
            case this.actionTypes.MESH_DEFORM:
                this.revertMeshDeform(action);
                break;
            */
            default:
                console.warn(`⚠️ 未対応アクション復元: ${action.type}`);
        }
    }
    
    /**
     * 🔄 アクション再適用
     */
    reapplyAction(action) {
        switch (action.type) {
            case this.actionTypes.STROKE:
                this.reapplyStroke(action);
                break;
            case this.actionTypes.TOOL_CHANGE:
                this.reapplyToolChange(action);
                break;
            case this.actionTypes.CLEAR_CANVAS:
                this.reapplyCanvasClear(action);
                break;
            case this.actionTypes.COLOR_CHANGE:
                this.reapplyColorChange(action);
                break;
            // Phase2以降で追加操作対応
            /*
            case this.actionTypes.AIRBRUSH_STROKE:
                this.reapplyAirbrushStroke(action);
                break;
            case this.actionTypes.BLUR_OPERATION:
                this.reapplyBlurOperation(action);
                break;
            */
            default:
                console.warn(`⚠️ 未対応アクション再適用: ${action.type}`);
        }
    }
    
    /**
     * 🎨 ストローク復元
     */
    revertStroke(action) {
        if (action.beforeState) {
            this.engine.restoreSnapshot(action.beforeState);
        } else {
            // スナップショットがない場合は履歴から復元
            this.restoreFromHistory(this.currentHistoryIndex);
        }
    }
    
    /**
     * 🎨 ストローク再適用
     */
    reapplyStroke(action) {
        if (action.afterState) {
            this.engine.restoreSnapshot(action.afterState);
        } else if (action.data.strokeData) {
            // ストロークデータから再描画
            this.engine.replayStroke(action.data.strokeData);
        }
    }
    
    /**
     * 🔧 ツール変更復元
     */
    revertToolChange(action) {
        this.engine.selectTool(action.data.oldTool);
    }
    
    /**
     * 🔧 ツール変更再適用
     */
    reapplyToolChange(action) {
        this.engine.selectTool(action.data.newTool);
    }
    
    /**
     * 🖼️ キャンバスクリア復元
     */
    revertCanvasClear(action) {
        if (action.data.previousSnapshot) {
            this.engine.restoreSnapshot(action.data.previousSnapshot);
        }
    }
    
    /**
     * 🖼️ キャンバスクリア再適用
     */
    reapplyCanvasClear(action) {
        this.engine.clearCanvas();
    }
    
    /**
     * 🎨 色変更復元・再適用
     */
    revertColorChange(action) {
        if (action.data.oldColor) {
            this.engine.setCurrentColor(action.data.oldColor);
        }
    }
    
    reapplyColorChange(action) {
        if (action.data.newColor) {
            this.engine.setCurrentColor(action.data.newColor);
        }
    }
    
    /**
     * 📋 履歴から復元
     */
    restoreFromHistory(targetIndex) {
        // 最新の完全スナップショットから開始
        const baseSnapshot = this.findNearestSnapshot(targetIndex);
        if (baseSnapshot) {
            this.engine.restoreSnapshot(baseSnapshot.canvas);
            
            // スナップショット以降のアクションを再適用
            const actionsToReplay = this.undoStack.slice(baseSnapshot.historyIndex + 1, targetIndex + 1);
            actionsToReplay.forEach(action => this.reapplyAction(action));
        }
    }
    
    /**
     * 🔍 最寄りスナップショット検索
     */
    findNearestSnapshot(targetIndex) {
        const snapshots = Array.from(this.snapshotCache.values())
            .filter(snapshot => snapshot.historyIndex <= targetIndex)
            .sort((a, b) => b.historyIndex - a.historyIndex);
        
        return snapshots[0] || null;
    }
    
    /**
     * 🏷️ 複合操作グループ開始
     */
    startGroup(groupName = null) {
        this.isGrouping = true;
        this.currentGroupId = this.generateGroupId(groupName);
        this.groupedActions = [];
        
        console.log(`🏷️ 複合操作開始: ${this.currentGroupId}`);
    }
    
    /**
     * 🏷️ 複合操作グループ終了
     */
    endGroup() {
        if (!this.isGrouping) return;
        
        this.isGrouping = false;
        const groupId = this.currentGroupId;
        this.currentGroupId = null;
        
        console.log(`🏷️ 複合操作終了: ${groupId} (${this.groupedActions.length}個のアクション)`);
        this.groupedActions = [];
    }
    
    /**
     * 🆔 アクションID生成
     */
    generateActionId() {
        return `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    /**
     * 🆔 グループID生成
     */
    generateGroupId(groupName) {
        const name = groupName || 'group';
        return `${name}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    }
    
    /**
     * 📊 履歴統計取得
     */
    getHistoryStats() {
        return {
            undoCount: this.undoStack.length,
            redoCount: this.redoStack.length,
            maxHistorySize: this.maxHistorySize,
            currentIndex: this.currentHistoryIndex,
            snapshotCacheSize: this.snapshotCache.size,
            isRecording: this.isRecording,
            isGrouping: this.isGrouping,
            batchActionsCount: this.batchActions.length,
            memoryUsage: this.estimateMemoryUsage()
        };
    }
    
    /**
     * 💾 メモリ使用量推定
     */
    estimateMemoryUsage() {
        try {
            const undoSize = JSON.stringify(this.undoStack).length;
            const redoSize = JSON.stringify(this.redoStack).length;
            const cacheSize = JSON.stringify(Array.from(this.snapshotCache.values())).length;
            
            return {
                undoStackMB: (undoSize / 1024 / 1024).toFixed(2),
                redoStackMB: (redoSize / 1024 / 1024).toFixed(2),
                snapshotCacheMB: (cacheSize / 1024 / 1024).toFixed(2),
                totalMB: ((undoSize + redoSize + cacheSize) / 1024 / 1024).toFixed(2)
            };
        } catch (error) {
            return { error: 'メモリ使用量計算エラー' };
        }
    }
    
    /**
     * 🧹 メモリ管理設定
     */
    setupMemoryManagement() {
        // メモリ不足検出
        if ('memory' in performance) {
            const memoryInfo = performance.memory;
            const usageRatio = memoryInfo.usedJSHeapSize / memoryInfo.jsHeapSizeLimit;
            
            if (usageRatio > 0.8) {
                console.warn('⚠️ メモリ使用量が高いため履歴サイズを削減');
                this.maxHistorySize = Math.max(10, Math.floor(this.maxHistorySize * 0.7));
            }
        }
        
        // 定期的なメモリクリーンアップ
        setInterval(() => {
            this.performMemoryCleanup();
        }, 30000); // 30秒ごと
    }
    
    /**
     * 🧹 メモリクリーンアップ実行
     */
    performMemoryCleanup() {
        const stats = this.getHistoryStats();
        const totalMB = parseFloat(stats.memoryUsage.totalMB);
        
        if (totalMB > 50) { // 50MB以上で積極的クリーンアップ
            console.log(`🧹 メモリクリーンアップ実行: ${totalMB}MB使用中`);
            
            // 古いスナップショット削除
            this.cleanupOldSnapshots();
            
            // 履歴サイズ削減
            const targetSize = Math.floor(this.maxHistorySize * 0.8);
            while (this.undoStack.length > targetSize) {
                this.undoStack.shift();
                this.currentHistoryIndex--;
            }
        }
    }
    
    /**
     * 📝 アクションログ出力
     */
    logAction(operation, action) {
        if (import.meta.env?.DEV) {
            console.log(`📚 History ${operation}:`, {
                type: action.type,
                id: action.id,
                timestamp: new Date(action.timestamp).toLocaleTimeString(),
                groupId: action.groupId,
                undoCount: this.undoStack.length,
                redoCount: this.redoStack.length
            });
        }
    }
    
    /**
     * ⚙️ 履歴記録制御
     */
    setRecording(enabled) {
        this.isRecording = enabled;
        if (!enabled) {
            // 記録停止時はバッチをクリア
            this.batchActions = [];
            if (this.batchTimeout) {
                clearTimeout(this.batchTimeout);
                this.batchTimeout = null;
            }
        }
        console.log(`📚 履歴記録 ${enabled ? '開始' : '停止'}`);
    }
    
    /**
     * 🗑️ 履歴クリア
     */
    clearHistory() {
        // バッチアクション強制コミット
        this.commitBatchActions();
        
        this.undoStack = [];
        this.redoStack = [];
        this.currentHistoryIndex = -1;
        this.snapshotCache.clear();
        
        console.log('🗑️ 履歴クリア完了');
    }
    
    /**
     * 🧹 リソース解放
     */
    dispose() {
        // タイムアウトクリア
        if (this.batchTimeout) {
            clearTimeout(this.batchTimeout);
        }
        if (this.groupTimeout) {
            clearTimeout(this.groupTimeout);
        }
        
        // 履歴クリア
        this.clearHistory();
        
        // エンジンイベント購読解除
        if (this.engine) {
            this.engine.onStrokeComplete = null;
            this.engine.onToolChange = null;
            this.engine.onCanvasClear = null;
        }
        
        console.log('🧹 履歴コントローラー 解放完了');
    }
    
    // Phase2以降拡張予定機能スタブ
    
    /**
     * Phase2: 高度履歴機能
     */
    /*
    initializeAdvancedHistory() {
        // Phase2で実装: 履歴ブランチ・タグ・検索機能
        // this.advancedHistory = new AdvancedHistoryManager();
    }
    
    createHistoryBranch(branchName) {
        // Phase2で実装: 履歴ブランチ作成
    }
    
    searchHistory(query) {
        // Phase2で実装: 履歴検索
    }
    
    tagHistoryPoint(tagName) {
        // Phase2で実装: 履歴ポイントタグ付け
    }
    */
    
    /**
     * Phase2: 履歴分析
     */
    /*
    initializeHistoryAnalytics() {
        // Phase2で実装: 履歴使用パターン分析
        // this.historyAnalytics = new HistoryAnalytics();
    }
    
    getUsagePatterns() {
        // Phase2で実装: 使用パターン分析結果取得