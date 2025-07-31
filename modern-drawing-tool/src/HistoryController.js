/**
 * HistoryController.js - アンドゥ・リドゥ制御 (Phase1 履歴ファイル)
 * 履歴管理・スタック制御・アクション記録・状態復元・複合操作統合
 * v2.0 OGL統一制約準拠・スナップショット最適化・メモリ効率化
 */

import { throttle, debounce, cloneDeep } from 'lodash-es';
import mitt from 'mitt';

// === 履歴管理・スタック制御（200-250行） ===

/**
 * OGL統一履歴管理システム
 * スナップショット + 差分記録による効率的履歴制御
 */
class OGLHistoryManager {
    constructor(oglEngine, eventBus) {
        this.engine = oglEngine;
        this.eventBus = eventBus;
        
        // 履歴スタック
        this.undoStack = [];
        this.redoStack = [];
        this.maxHistorySize = 50; // メモリ効率化
        
        // 現在状態
        this.currentState = null;
        this.isRestoring = false;
        this.autoSaveEnabled = true;
        
        // スナップショット制御
        this.snapshotInterval = 10; // アクション数間隔
        this.actionsSinceSnapshot = 0;
        this.lastSnapshotTime = 0;
        
        // 複合操作制御
        this.batchMode = false;
        this.batchActions = [];
        this.batchStartTime = 0;
        
        // パフォーマンス制御
        this.snapshotThrottle = throttle(this.createSnapshot.bind(this), 1000);
        this.saveDebounce = debounce(this.saveState.bind(this), 500);
        
        this.initializeHistorySystem();
    }
    
    /**
     * 履歴システム初期化
     */
    initializeHistorySystem() {
        // 初期状態スナップショット
        this.createSnapshot('initial');
        
        // エンジン状態監視
        this.setupStateMonitoring();
        
        // メモリ管理
        this.setupMemoryManagement();
        
        console.log('📚 OGL履歴管理システム初期化完了');
    }
    
    /**
     * エンジン状態監視設定
     */
    setupStateMonitoring() {
        // 描画イベント監視
        this.eventBus.on('drawing:end', (event) => {
            if (!this.isRestoring) {
                this.recordAction('stroke', {
                    type: 'stroke',
                    strokeId: event.strokeId,
                    tool: event.tool,
                    timestamp: performance.now()
                });
            }
        });
        
        // レイヤー操作監視
        this.eventBus.on('layer:changed', (event) => {
            if (!this.isRestoring) {
                this.recordAction('layer', {
                    type: 'layer',
                    operation: event.operation,
                    layerId: event.layerId,
                    timestamp: performance.now()
                });
            }
        });
        
        // 変形操作監視
        this.eventBus.on('transform:applied', (event) => {
            if (!this.isRestoring) {
                this.recordAction('transform', {
                    type: 'transform',
                    operation: event.operation,
                    target: event.target,
                    timestamp: performance.now()
                });
            }
        });
    }
    
    /**
     * メモリ管理設定
     */
    setupMemoryManagement() {
        // 定期的なメモリクリーンアップ
        setInterval(() => {
            this.cleanupOldHistory();
        }, 30000); // 30秒間隔
        
        // メモリ使用量監視
        if ('memory' in performance) {
            setInterval(() => {
                const memInfo = performance.memory;
                if (memInfo.usedJSHeapSize > memInfo.jsHeapSizeLimit * 0.8) {
                    console.warn('⚠️ メモリ使用量高 - 履歴クリーンアップ実行');
                    this.forceCleanup();
                }
            }, 10000);
        }
    }
    
    /**
     * スナップショット作成
     */
    createSnapshot(label = 'snapshot') {
        try {
            const snapshot = {
                id: `snapshot_${Date.now()}_${Math.random()}`,
                label: label,
                timestamp: performance.now(),
                
                // OGLエンジン状態
                engineState: this.captureEngineState(),
                
                // レイヤー状態
                layerState: this.captureLayerState(),
                
                // キャンバス状態
                canvasState: this.captureCanvasState(),
                
                // メタデータ
                metadata: {
                    version: '2.0',
                    actionCount: this.actionsSinceSnapshot,
                    memoryUsage: this.getMemoryUsage()
                }
            };
            
            this.currentState = snapshot;
            this.lastSnapshotTime = performance.now();
            this.actionsSinceSnapshot = 0;
            
            return snapshot;
        } catch (error) {
            console.error('❌ スナップショット作成失敗:', error);
            return null;
        }
    }
    
    /**
     * OGLエンジン状態キャプチャ
     */
    captureEngineState() {
        return {
            scene: this.serializeOGLScene(),
            camera: {
                position: this.engine.camera.position.clone(),
                rotation: this.engine.camera.rotation.clone(),
                scale: this.engine.camera.scale.clone()
            },
            viewport: {
                width: this.engine.canvas.width,
                height: this.engine.canvas.height
            },
            quality: this.engine.qualitySettings || {}
        };
    }
    
    /**
     * OGLシーン状態シリアライズ
     */
    serializeOGLScene() {
        const sceneData = {
            strokes: [],
            meshes: [],
            transforms: []
        };
        
        // ストローク情報収集
        if (this.engine.strokeRenderer) {
            this.engine.strokeRenderer.activeStrokes.forEach((stroke, id) => {
                sceneData.strokes.push({
                    id: id,
                    points: stroke.points,
                    color: stroke.color,
                    width: stroke.width,
                    opacity: stroke.opacity,
                    completed: stroke.completed
                });
            });
        }
        
        return sceneData;
    }
    
    /**
     * レイヤー状態キャプチャ
     */
    captureLayerState() {
        if (!this.engine.layers) return null;
        
        const layerData = [];
        this.engine.layers.forEach((layer, id) => {
            layerData.push({
                id: id,
                visible: layer.visible,
                opacity: layer.opacity,
                blendMode: layer.blendMode,
                transform: layer.transform ? {
                    position: layer.transform.position.clone(),
                    rotation: layer.transform.rotation.clone(),
                    scale: layer.transform.scale.clone()
                } : null
            });
        });
        
        return {
            layers: layerData,
            activeLayerId: this.engine.activeLayerId
        };
    }
    
    /**
     * キャンバス状態キャプチャ
     */
    captureCanvasState() {
        return {
            transform: this.engine.canvasTransform ? {
                elements: Array.from(this.engine.canvasTransform.elements)
            } : null,
            background: this.engine.backgroundColor || '#f0e0d6',
            grid: this.engine.gridVisible || false
        };
    }
    
    /**
     * メモリ使用量取得
     */
    getMemoryUsage() {
        if ('memory' in performance) {
            return {
                used: performance.memory.usedJSHeapSize,
                total: performance.memory.totalJSHeapSize,
                limit: performance.memory.jsHeapSizeLimit
            };
        }
        return null;
    }
}

// === アクション記録・種別管理（200-250行） ===

/**
 * アクション記録システム
 * 操作種別管理・差分記録・効率的復元
 */
class ActionRecorder {
    constructor(historyManager) {
        this.historyManager = historyManager;
        
        // アクション種別定義
        this.actionTypes = {
            'stroke': {
                canMerge: false,
                needsSnapshot: true,
                description: 'ストローク描画'
            },
            'layer': {
                canMerge: true,
                needsSnapshot: false,
                description: 'レイヤー操作'
            },
            'transform': {
                canMerge: true,
                needsSnapshot: false,
                description: '変形操作'
            },
            'property': {
                canMerge: true,
                needsSnapshot: false,
                description: 'プロパティ変更'
            },
            'tool': {
                canMerge: false,
                needsSnapshot: false,
                description: 'ツール切り替え'
            }
        };
        
        // アクション記録設定
        this.recordingEnabled = true;
        this.maxActionSize = 1000; // 大きなアクションの制限
        this.mergeWindow = 1000; // マージ可能時間窓（ms）
        
        // 記録統計
        this.stats = {
            totalActions: 0,
            mergedActions: 0,
            snapshotCount: 0,
            lastActionTime: 0
        };
    }
    
    /**
     * アクション記録
     */
    recordAction(actionType, actionData) {
        if (!this.recordingEnabled || this.historyManager.isRestoring) {
            return;
        }
        
        const action = this.createAction(actionType, actionData);
        if (!action) return;
        
        // マージ可能性チェック
        const lastAction = this.getLastAction();
        if (this.canMergeWithLastAction(action, lastAction)) {
            this.mergeWithLastAction(action, lastAction);
            this.stats.mergedActions++;
            return;
        }
        
        // 新規アクション追加
        this.addNewAction(action);
        
        // スナップショット判定
        if (this.shouldCreateSnapshot(action)) {
            this.historyManager.snapshotThrottle();
        }
        
        // 統計更新
        this.updateStats(action);
    }
    
    /**
     * アクション作成
     */
    createAction(actionType, actionData) {
        const actionDef = this.actionTypes[actionType];
        if (!actionDef) {
            console.warn(`⚠️ 未知のアクション種別: ${actionType}`);
            return null;
        }
        
        const action = {
            id: `action_${Date.now()}_${Math.random()}`,
            type: actionType,
            timestamp: performance.now(),
            data: cloneDeep(actionData),
            size: this.calculateActionSize(actionData),
            description: actionDef.description,
            canMerge: actionDef.canMerge,
            needsSnapshot: actionDef.needsSnapshot
        };
        
        // サイズ制限チェック
        if (action.size > this.maxActionSize) {
            console.warn(`⚠️ アクションサイズ制限超過: ${action.size}bytes`);
            return null;
        }
        
        return action;
    }
    
    /**
     * 最後のアクション取得
     */
    getLastAction() {
        const undoStack = this.historyManager.undoStack;
        return undoStack.length > 0 ? undoStack[undoStack.length - 1] : null;
    }
    
    /**
     * マージ可能性判定
     */
    canMergeWithLastAction(newAction, lastAction) {
        if (!lastAction || !newAction.canMerge || !lastAction.canMerge) {
            return false;
        }
        
        // 同じタイプかチェック
        if (newAction.type !== lastAction.type) {
            return false;
        }
        
        // 時間窓チェック
        const timeDiff = newAction.timestamp - lastAction.timestamp;
        if (timeDiff > this.mergeWindow) {
            return false;
        }
        
        // タイプ固有のマージ判定
        switch (newAction.type) {
            case 'property':
                return this.canMergePropertyActions(newAction, lastAction);
            case 'transform':
                return this.canMergeTransformActions(newAction, lastAction);
            case 'layer':
                return this.canMergeLayerActions(newAction, lastAction);
            default:
                return false;
        }
    }
    
    /**
     * プロパティアクションマージ判定
     */
    canMergePropertyActions(newAction, lastAction) {
        return newAction.data.target === lastAction.data.target &&
               newAction.data.property === lastAction.data.property;
    }
    
    /**
     * 変形アクションマージ判定
     */
    canMergeTransformActions(newAction, lastAction) {
        return newAction.data.target === lastAction.data.target &&
               newAction.data.operation === lastAction.data.operation;
    }
    
    /**
     * レイヤーアクションマージ判定
     */
    canMergeLayerActions(newAction, lastAction) {
        return newAction.data.layerId === lastAction.data.layerId &&
               newAction.data.operation === lastAction.data.operation;
    }
    
    /**
     * 最後のアクションとマージ
     */
    mergeWithLastAction(newAction, lastAction) {
        // 最終値で更新
        lastAction.data.finalValue = newAction.data.value || newAction.data.finalValue;
        lastAction.timestamp = newAction.timestamp;
        lastAction.description = `${lastAction.description} (連続操作)`;
        
        console.log(`🔄 アクションマージ: ${newAction.type}`);
    }
    
    /**
     * 新規アクション追加
     */
    addNewAction(action) {
        this.historyManager.undoStack.push(action);
        
        // スタックサイズ制限
        if (this.historyManager.undoStack.length > this.historyManager.maxHistorySize) {
            this.historyManager.undoStack.shift();
        }
        
        // リドゥスタッククリア（新しいアクション後は無効）
        this.historyManager.redoStack.length = 0;
        
        console.log(`📝 新規アクション記録: ${action.type} (${action.description})`);
    }
    
    /**
     * スナップショット作成判定
     */
    shouldCreateSnapshot(action) {
        if (!action.needsSnapshot) return false;
        
        this.historyManager.actionsSinceSnapshot++;
        
        // 間隔チェック
        if (this.historyManager.actionsSinceSnapshot >= this.historyManager.snapshotInterval) {
            return true;
        }
        
        // 重要アクションチェック
        if (action.type === 'stroke' || action.type === 'layer') {
            return true;
        }
        
        return false;
    }
    
    /**
     * アクションサイズ計算
     */
    calculateActionSize(data) {
        return JSON.stringify(data).length;
    }
    
    /**
     * 統計更新
     */
    updateStats(action) {
        this.stats.totalActions++;
        this.stats.lastActionTime = action.timestamp;
        
        if (action.needsSnapshot) {
            this.stats.snapshotCount++;
        }
    }
}

// === 状態復元・スナップショット（150-200行） ===

/**
 * 状態復元システム
 * スナップショット復元・差分適用・OGL統一復元
 */
class StateRestorer {
    constructor(historyManager, oglEngine) {
        this.historyManager = historyManager;
        this.engine = oglEngine;
        
        // 復元制御
        this.restoreInProgress = false;
        this.restoreQueue = [];
        this.maxRestoreAttempts = 3;
        
        // 復元統計
        this.restoreStats = {
            successCount: 0,
            failureCount: 0,
            averageTime: 0
        };
    }
    
    /**
     * アンドゥ実行
     */
    async undo() {
        if (this.restoreInProgress || this.historyManager.undoStack.length === 0) {
            return false;
        }
        
        const startTime = performance.now();
        this.restoreInProgress = true;
        this.historyManager.isRestoring = true;
        
        try {
            const action = this.historyManager.undoStack.pop();
            const success = await this.restoreActionState(action, 'undo');
            
            if (success) {
                this.historyManager.redoStack.push(action);
                this.historyManager.eventBus.emit('history:undo', { action });
                console.log(`↶ アンドゥ実行: ${action.description}`);
            } else {
                // 失敗時は元に戻す
                this.historyManager.undoStack.push(action);
            }
            
            this.updateRestoreStats(success, performance.now() - startTime);
            return success;
            
        } catch (error) {
            console.error('❌ アンドゥ実行エラー:', error);
            return false;
        } finally {
            this.restoreInProgress = false;
            this.historyManager.isRestoring = false;
        }
    }
    
    /**
     * リドゥ実行
     */
    async redo() {
        if (this.restoreInProgress || this.historyManager.redoStack.length === 0) {
            return false;
        }
        
        const startTime = performance.now();
        this.restoreInProgress = true;
        this.historyManager.isRestoring = true;
        
        try {
            const action = this.historyManager.redoStack.pop();
            const success = await this.restoreActionState(action, 'redo');
            
            if (success) {
                this.historyManager.undoStack.push(action);
                this.historyManager.eventBus.emit('history:redo', { action });
                console.log(`↷ リドゥ実行: ${action.description}`);
            } else {
                // 失敗時は元に戻す
                this.historyManager.redoStack.push(action);
            }
            
            this.updateRestoreStats(success, performance.now() - startTime);
            return success;
            
        } catch (error) {
            console.error('❌ リドゥ実行エラー:', error);
            return false;
        } finally {
            this.restoreInProgress = false;
            this.historyManager.isRestoring = false;
        }
    }
    
    /**
     * アクション状態復元
     */
    async restoreActionState(action, direction) {
        try {
            switch (action.type) {
                case 'stroke':
                    return await this.restoreStrokeAction(action, direction);
                case 'layer':
                    return await this.restoreLayerAction(action, direction);
                case 'transform':
                    return await this.restoreTransformAction(action, direction);
                case 'property':
                    return await this.restorePropertyAction(action, direction);
                default:
                    console.warn(`⚠️ 未対応アクション復元: ${action.type}`);
                    return false;
            }
        } catch (error) {
            console.error(`❌ アクション復元失敗: ${action.type}`, error);
            return false;
        }
    }
    
    /**
     * ストロークアクション復元
     */
    async restoreStrokeAction(action, direction) {
        const strokeId = action.data.strokeId;
        
        if (direction === 'undo') {
            // ストローク削除
            if (this.engine.strokeRenderer && this.engine.strokeRenderer.strokeMeshes.has(strokeId)) {
                const mesh = this.engine.strokeRenderer.strokeMeshes.get(strokeId);
                this.engine.scene.removeChild(mesh);
                this.engine.strokeRenderer.strokeMeshes.delete(strokeId);
                this.engine.strokeRenderer.strokeGeometry.delete(strokeId);
                this.engine.strokeRenderer.activeStrokes.delete(strokeId);
            }
        } else {
            // ストローク復元
            const strokeData = action.data;
            if (strokeData.points && strokeData.points.length > 0) {
                // ストロークを再生成
                this.engine.strokeRenderer.activeStrokes.set(strokeId, {
                    id: strokeId,
                    points: strokeData.points,
                    color: strokeData.color,
                    width: strokeData.width,
                    opacity: strokeData.opacity,
                    completed: true
                });
                
                this.engine.strokeRenderer.createStrokeGeometry(strokeId);
                this.engine.strokeRenderer.updateStrokeGeometry(strokeId);
            }
        }
        
        this.engine.requestRender();
        return true;
    }
    
    /**
     * レイヤーアクション復元
     */
    async restoreLayerAction(action, direction) {
        const { layerId, operation, oldValue, newValue } = action.data;
        const layer = this.engine.layers.get(layerId);
        
        if (!layer) {
            console.warn(`⚠️ レイヤー復元失敗: ${layerId} not found`);
            return false;
        }
        
        const targetValue = direction === 'undo' ? oldValue : newValue;
        
        switch (operation) {
            case 'visibility':
                layer.visible = targetValue;
                break;
            case 'opacity':
                layer.opacity = targetValue;
                break;
            case 'blendMode':
                layer.blendMode = targetValue;
                break;
            default:
                console.warn(`⚠️ 未対応レイヤー操作: ${operation}`);
                return false;
        }
        
        this.engine.requestRender();
        return true;
    }
    
    /**
     * 変形アクション復元
     */
    async restoreTransformAction(action, direction) {
        const { target, operation, oldTransform, newTransform } = action.data;
        const targetTransform = direction === 'undo' ? oldTransform : newTransform;
        
        // 変形適用ロジック（OGL Transform使用）
        if (target === 'canvas') {
            this.engine.canvasTransform.copy(targetTransform);
        } else {
            // レイヤー変形
            const layer = this.engine.layers.get(target);
            if (layer && layer.transform) {
                layer.transform.position.copy(targetTransform.position);
                layer.transform.rotation.copy(targetTransform.rotation);
                layer.transform.scale.copy(targetTransform.scale);
            }
        }
        
        this.engine.requestRender();
        return true;
    }
    
    /**
     * プロパティアクション復元
     */
    async restorePropertyAction(action, direction) {
        const { target, property, oldValue, newValue } = action.data;
        const targetValue = direction === 'undo' ? oldValue : newValue;
        
        // プロパティ適用
        if (target && property) {
            this.setObjectProperty(target, property, targetValue);
            this.engine.requestRender();
            return true;
        }
        
        return false;
    }
    
    /**
     * オブジェクトプロパティ設定
     */
    setObjectProperty(target, property, value) {
        const keys = property.split('.');
        let obj = target;
        
        for (let i = 0; i < keys.length - 1; i++) {
            obj = obj[keys[i]];
            if (!obj) return;
        }
        
        obj[keys[keys.length - 1]] = value;
    }
    
    /**
     * 復元統計更新
     */
    updateRestoreStats(success, duration) {
        if (success) {
            this.restoreStats.successCount++;
        } else {
            this.restoreStats.failureCount++;
        }
        
        // 平均時間更新
        const totalCount = this.restoreStats.successCount + this.restoreStats.failureCount;
        this.restoreStats.averageTime = (this.restoreStats.averageTime * (totalCount - 1) + duration) / totalCount;
    }
}

// === 複合操作・グループ化（100行） ===

/**
 * 複合操作管理システム
 * バッチ操作・グループ化・複合アンドゥ
 */
class BatchOperationManager {
    constructor(historyManager) {
        this.historyManager = historyManager;
        
        // バッチ操作状態
        this.activeBatches = new Map();
        this.batchIdCounter = 0;
        
        // 自動バッチ設定
        this.autoBatchWindow = 2000; // 2秒以内の連続操作をバッチ化
        this.autoBatchTypes = ['property', 'transform']; // 自動バッチ対象
    }
    
    /**
     * バッチ操作開始
     */
    startBatch(label = '複合操作') {
        const batchId = `batch_${++this.batchIdCounter}`;
        
        const batch = {
            id: batchId,
            label: label,
            startTime: performance.now(),
            actions: [],
            completed: false
        };
        
        this.activeBatches.set(batchId, batch);
        this.historyManager.batchMode = true;
        
        console.log(`📦 バッチ操作開始: ${label} (${batchId})`);
        return batchId;
    }
    
    /**
     * バッチ操作終了
     */
    endBatch(batchId) {
        const batch = this.activeBatches.get(batchId);
        if (!batch || batch.completed) {
            return false;
        }
        
        batch.completed = true;
        batch.endTime = performance.now();
        batch.duration = batch.endTime - batch.startTime;
        
        // バッチアクション作成
        if (batch.actions.length > 0) {
            const batchAction = {
                id: `batch_action_${batchId}`,
                type: 'batch',
                timestamp: batch.endTime,
                data: {
                    batchId: batchId,
                    label: batch.label,
                    actions: batch.actions,
                    duration: batch.duration
                },
                description: `${batch.label} (${batch.actions.length}操作)`,
                canMerge: false,
                needsSnapshot: true
            };
            
            this.historyManager.undoStack.push(batchAction);
            this.historyManager.redoStack.length = 0; // リドゥスタッククリア
        }
        
        this.activeBatches.delete(batchId);
        
        // 全バッチが終了したらバッチモード解除
        if (this.activeBatches.size === 0) {
            this.historyManager.batchMode = false;
        }
        
        console.log(`📦 バッチ操作終了: ${batch.label} (${batch.actions.length}操作, ${batch.duration.toFixed(1)}ms)`);
        return true;
    }
    
    /**
     * バッチにアクション追加
     */
    addActionToBatch(batchId, action) {
        const batch = this.activeBatches.get(batchId);
        if (batch && !batch.completed) {
            batch.actions.push(action);
            return true;
        }
        return false;
    }
    
    /**
     * 自動バッチ判定
     */
    shouldAutoBatch(action, lastAction) {
        if (!lastAction || !this.autoBatchTypes.includes(action.type)) {
            return false;
        }
        
        const timeDiff = action.timestamp - lastAction.timestamp;
        return timeDiff <= this.autoBatchWindow && action.type === lastAction.type;
    }
}

// === OGL履歴コントローラー統合エクスポート ===

/**
 * OGL履歴コントローラー統合クラス
 */
export class HistoryController {
    constructor(oglEngine, eventBus) {
        this.engine = oglEngine;
        this.eventBus = eventBus;
        
        // コンポーネント初期化
        this.historyManager = new OGLHistoryManager(oglEngine, eventBus);
        this.actionRecorder = new ActionRecorder(this.historyManager);
        this.stateRestorer = new StateRestorer(this.historyManager, oglEngine);
        this.batchManager = new BatchOperationManager(this.historyManager);
        
        // ショートカット統合
        this.setupShortcutIntegration();
        
        // パフォーマンス監視
        this.setupPerformanceMonitoring();
        
        console.log('📚 OGL履歴コントローラー初期化完了');
    }
    
    /**
     * ショートカット統合設定
     */
    setupShortcutIntegration() {
        // アンドゥ・リドゥショートカット
        this.eventBus.on('shortcut:undo', () => {
            this.undo();
        });
        
        this.eventBus.on('shortcut:redo', () => {
            this.redo();
        });
        
        // バッチ操作ショートカット
        this.eventBus.on('shortcut:batch-start', (event) => {
            this.startBatch(event.label || '複合操作');
        });
        
        this.eventBus.on('shortcut:batch-end', (event) => {
            if (event.batchId) {
                this.endBatch(event.batchId);
            }
        });
    }
    
    /**
     * パフォーマンス監視設定
     */
    setupPerformanceMonitoring() {
        // 履歴サイズ監視
        setInterval(() => {
            const undoCount = this.historyManager.undoStack.length;
            const redoCount = this.historyManager.redoStack.length;
            const memoryUsage = this.historyManager.getMemoryUsage();
            
            if (undoCount > this.historyManager.maxHistorySize * 0.9) {
                console.warn(`⚠️ 履歴スタック容量警告: ${undoCount}/${this.historyManager.maxHistorySize}`);
            }
            
            if (memoryUsage && memoryUsage.used > memoryUsage.limit * 0.8) {
                console.warn('⚠️ メモリ使用量警告 - 履歴クリーンアップ推奨');
                this.historyManager.forceCleanup();
            }
        }, 15000); // 15秒間隔
    }
    
    /**
     * アンドゥ実行
     */
    async undo() {
        const success = await this.stateRestorer.undo();
        if (success) {
            this.eventBus.emit('history:changed', {
                type: 'undo',
                canUndo: this.canUndo(),
                canRedo: this.canRedo()
            });
        }
        return success;
    }
    
    /**
     * リドゥ実行
     */
    async redo() {
        const success = await this.stateRestorer.redo();
        if (success) {
            this.eventBus.emit('history:changed', {
                type: 'redo',
                canUndo: this.canUndo(),
                canRedo: this.canRedo()
            });
        }
        return success;
    }
    
    /**
     * アクション記録
     */
    recordAction(actionType, actionData) {
        this.actionRecorder.recordAction(actionType, actionData);
        
        // 履歴状態変更通知
        this.eventBus.emit('history:changed', {
            type: 'record',
            actionType: actionType,
            canUndo: this.canUndo(),
            canRedo: this.canRedo()
        });
    }
    
    /**
     * バッチ操作開始
     */
    startBatch(label) {
        return this.batchManager.startBatch(label);
    }
    
    /**
     * バッチ操作終了
     */
    endBatch(batchId) {
        const success = this.batchManager.endBatch(batchId);
        if (success) {
            this.eventBus.emit('history:changed', {
                type: 'batch',
                canUndo: this.canUndo(),
                canRedo: this.canRedo()
            });
        }
        return success;
    }
    
    /**
     * スナップショット作成
     */
    createSnapshot(label) {
        return this.historyManager.createSnapshot(label);
    }
    
    /**
     * アンドゥ可能性判定
     */
    canUndo() {
        return this.historyManager.undoStack.length > 0 && !this.stateRestorer.restoreInProgress;
    }
    
    /**
     * リドゥ可能性判定
     */
    canRedo() {
        return this.historyManager.redoStack.length > 0 && !this.stateRestorer.restoreInProgress;
    }
    
    /**
     * 履歴統計取得
     */
    getHistoryStats() {
        return {
            undoCount: this.historyManager.undoStack.length,
            redoCount: this.historyManager.redoStack.length,
            actionStats: this.actionRecorder.stats,
            restoreStats: this.stateRestorer.restoreStats,
            memoryUsage: this.historyManager.getMemoryUsage(),
            activeBatches: this.batchManager.activeBatches.size
        };
    }
    
    /**
     * 履歴クリーンアップ
     */
    cleanupHistory() {
        this.historyManager.cleanupOldHistory();
        this.eventBus.emit('history:cleaned');
    }
    
    /**
     * リソース解放
     */
    destroy() {
        // 履歴データクリア
        this.historyManager.undoStack.length = 0;
        this.historyManager.redoStack.length = 0;
        this.batchManager.activeBatches.clear();
        
        console.log('🗑️ OGL履歴コントローラー解放完了');
    }
}

// 追加のヘルパー関数
OGLHistoryManager.prototype.cleanupOldHistory = function() {
    const cutoffTime = performance.now() - (5 * 60 * 1000); // 5分前より古い履歴
    
    // 古いアンドゥ履歴削除
    this.undoStack = this.undoStack.filter(action => action.timestamp > cutoffTime);
    
    // 古いリドゥ履歴削除
    this.redoStack = this.redoStack.filter(action => action.timestamp > cutoffTime);
    
    console.log(`🧹 履歴クリーンアップ実行 - Undo:${this.undoStack.length}, Redo:${this.redoStack.length}`);
};

OGLHistoryManager.prototype.forceCleanup = function() {
    // 強制的に履歴サイズを半分に削減
    const targetSize = Math.floor(this.maxHistorySize / 2);
    
    if (this.undoStack.length > targetSize) {
        this.undoStack.splice(0, this.undoStack.length - targetSize);
    }
    
    if (this.redoStack.length > targetSize) {
        this.redoStack.splice(0, this.redoStack.length - targetSize);
    }
    
    console.log('🚨 強制履歴クリーンアップ実行');
};

// モジュールエクスポート
export { 
    OGLHistoryManager, 
    ActionRecorder, 
    StateRestorer, 
    BatchOperationManager 
};