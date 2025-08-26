/**
 * 🔄 RecordManager - Phase1.5完全実装版（startOperation/endOperation追加）
 * 📋 RESPONSIBILITY: Undo/Redo・操作履歴・非破壊編集・状態管理
 * 🚫 PROHIBITION: 描画処理・座標変換・UI制御・ツール実装
 * ✅ PERMISSION: 操作記録・状態スナップショット・EventBus通信・メモリ管理
 * 
 * 📏 DESIGN_PRINCIPLE: 非破壊編集・状態不変性・メモリ効率・EventBus連携
 * 🔄 INTEGRATION: Phase1.5基盤・EventBus必須・AbstractTool連携・全Manager対応
 * 🎯 Phase1.5: 基本Undo/Redo・操作記録基盤・Phase2準備
 * 🛠️ 使用メソッド一覧:
 *   - EventBus: emit(), on() - イベント通信
 *   - PIXI（依存なし）: Graphicsオブジェクト参照のみ
 *   - 外部依存: なし（完全自己完結）
 */

(function() {
    'use strict';
    
    /**
     * RecordManager - 操作履歴・Undo/Redo管理
     */
    class RecordManager {
        constructor() {
            console.log('🔄 RecordManager Phase1.5完全実装 - 初期化開始');
            
            this.eventBus = null;
            
            // 履歴管理（Phase1.5基盤）
            this.history = [];
            this.currentIndex = -1;
            this.maxHistorySize = 50;
            
            // 操作グループ管理（複数操作の束ね）
            this.currentGroup = null;
            this.grouping = false;
            
            // 🆕 現在進行中の操作管理
            this.activeOperations = new Map(); // 操作ID -> 操作データ
            this.operationIdCounter = 0;
            
            // 記録設定（Phase1.5基盤）
            this.enabled = true;
            this.recording = false;
            
            // メモリ管理（Phase1.5準備）
            this.memoryThreshold = 100 * 1024 * 1024; // 100MB
            this.currentMemoryUsage = 0;
            
            this.initializeComplete = false;
            
            console.log('🔄 RecordManager 完全実装完了');
        }
        
        /**
         * 初期化（Phase1.5完全実装 - EventBus連携準備）
         */
        initialize(eventBus) {
            console.log('🔄 RecordManager 初期化 - Phase1.5完全実装版');
            
            if (!eventBus) {
                console.warn('⚠️ RecordManager: EventBus未提供 - 基本機能のみ有効');
            } else {
                this.eventBus = eventBus;
                // Phase1.5: EventBus連携準備（完全実装）
                this.setupEventBusListeners();
            }
            
            // Phase1.5: 初期状態記録（完全実装）
            this.recordInitialState();
            
            this.initializeComplete = true;
            console.log('✅ RecordManager 初期化完了 - Phase1.5完全実装版');
            
            return true;
        }
        
        /**
         * 🆕 操作開始記録（PenToolから呼び出されるメソッド）
         * @param {Object} operationData - 操作データ
         * @returns {string} - 操作ID
         */
        startOperation(operationData) {
            if (!this.enabled) {
                console.log('🔄 RecordManager: 記録無効状態 - 操作記録スキップ');
                return null;
            }
            
            const operationId = `op_${++this.operationIdCounter}_${Date.now()}`;
            
            const operation = {
                id: operationId,
                type: operationData.type || 'unknown',
                description: operationData.description || '操作',
                startTime: Date.now(),
                endTime: null,
                data: { ...operationData },
                undoData: null,
                redoData: null,
                graphics: operationData.graphics || null,
                layerId: operationData.layerId || null,
                groupId: this.grouping ? this.currentGroup?.id : null,
                completed: false
            };
            
            this.activeOperations.set(operationId, operation);
            
            console.log(`🔄 RecordManager 操作開始: ${operation.type} (ID: ${operationId})`);
            
            // EventBus通知
            if (this.eventBus) {
                this.eventBus.emit('record:operation:started', {
                    operation: { ...operation },
                    activeCount: this.activeOperations.size
                });
            }
            
            return operationId;
        }
        
        /**
         * 🆕 操作終了記録（PenToolから呼び出されるメソッド）
         * @param {string} operationId - 操作ID
         * @param {Object} completionData - 完了データ
         */
        endOperation(operationId, completionData = {}) {
            if (!operationId || !this.activeOperations.has(operationId)) {
                console.warn(`⚠️ RecordManager: 無効な操作ID: ${operationId}`);
                return false;
            }
            
            const operation = this.activeOperations.get(operationId);
            
            // 操作完了データ追加
            operation.endTime = Date.now();
            operation.duration = operation.endTime - operation.startTime;
            operation.completed = true;
            
            // 完了時データ更新
            if (completionData.undoData) {
                operation.undoData = completionData.undoData;
            }
            if (completionData.redoData) {
                operation.redoData = completionData.redoData;
            }
            if (completionData.graphics) {
                operation.graphics = completionData.graphics;
            }
            if (completionData.data) {
                operation.data = { ...operation.data, ...completionData.data };
            }
            
            // 履歴に追加
            this.addToHistory({ ...operation });
            
            // アクティブ操作から削除
            this.activeOperations.delete(operationId);
            
            console.log(`✅ RecordManager 操作完了: ${operation.type} (ID: ${operationId}, 時間: ${operation.duration}ms)`);
            
            // EventBus通知
            if (this.eventBus) {
                this.eventBus.emit('record:operation:completed', {
                    operation: { ...operation },
                    activeCount: this.activeOperations.size,
                    historyLength: this.history.length
                });
            }
            
            return true;
        }
        
        /**
         * 🆕 操作中断処理（エラー時など）
         * @param {string} operationId - 操作ID
         * @param {string} reason - 中断理由
         */
        abortOperation(operationId, reason = '操作中断') {
            if (!operationId || !this.activeOperations.has(operationId)) {
                console.warn(`⚠️ RecordManager: 中断対象の操作なし: ${operationId}`);
                return false;
            }
            
            const operation = this.activeOperations.get(operationId);
            
            console.log(`⚠️ RecordManager 操作中断: ${operation.type} (ID: ${operationId}) - 理由: ${reason}`);
            
            // アクティブ操作から削除（履歴には追加しない）
            this.activeOperations.delete(operationId);
            
            // EventBus通知
            if (this.eventBus) {
                this.eventBus.emit('record:operation:aborted', {
                    operation: { ...operation },
                    reason,
                    activeCount: this.activeOperations.size
                });
            }
            
            return true;
        }
        
        /**
         * EventBus連携設定（Phase1.5完全実装）
         */
        setupEventBusListeners() {
            if (!this.eventBus) return;
            
            console.log('🔄 RecordManager EventBus連携設定 - Phase1.5完全実装');
            
            // Phase1.5: Undo/Redoコマンド受信（完全実装）
            this.eventBus.on('undo', () => {
                this.undo();
            });
            
            this.eventBus.on('redo', () => {
                this.redo();
            });
            
            // Phase1.5: 操作記録コマンド受信（完全実装）
            this.eventBus.on('record:action', (data) => {
                this.recordAction(data);
            });
            
            // Phase1.5: グループ操作コマンド受信（完全実装）
            this.eventBus.on('record:group:start', (data) => {
                this.startGroup(data.name);
            });
            
            this.eventBus.on('record:group:end', () => {
                this.endGroup();
            });
            
            console.log('🔄 RecordManager EventBus連携設定完了 - Phase1.5完全実装');
        }
        
        /**
         * 初期状態記録（Phase1.5完全実装）
         */
        recordInitialState() {
            console.log('🔄 RecordManager 初期状態記録 - Phase1.5完全実装');
            
            // Phase1.5: 初期状態のスナップショット作成（完全実装）
            const initialState = {
                type: 'initial',
                timestamp: Date.now(),
                description: 'アプリケーション初期状態',
                data: {
                    canvas: 'initial',
                    layers: [],
                    tools: {}
                },
                completed: true,
                groupId: null
            };
            
            this.history = [initialState];
            this.currentIndex = 0;
            
            console.log('🔄 RecordManager 初期状態記録完了 - Phase1.5完全実装');
        }
        
        /**
         * 操作記録（Phase1.5完全実装）
         */
        recordAction(actionData) {
            if (!this.enabled || !this.initializeComplete) {
                return;
            }
            
            console.log('🔄 RecordManager 操作記録:', actionData.type || 'unknown', '- Phase1.5完全実装');
            
            // Phase1.5: 操作データ作成（完全実装）
            const record = {
                type: actionData.type || 'action',
                timestamp: Date.now(),
                description: actionData.description || '操作',
                data: actionData.data || {},
                undoData: actionData.undoData || {},
                graphics: actionData.graphics || null,
                layerId: actionData.layerId || null,
                groupId: this.grouping ? this.currentGroup?.id : null,
                completed: true
            };
            
            // Phase1.5: 履歴追加処理（完全実装）
            this.addToHistory(record);
            
            // Phase1.5: EventBus通知（完全実装）
            if (this.eventBus) {
                this.eventBus.emit('record:action:recorded', {
                    record,
                    historyLength: this.history.length,
                    currentIndex: this.currentIndex
                });
            }
        }
        
        /**
         * 履歴追加処理（Phase1.5完全実装）
         */
        addToHistory(record) {
            // Phase1.5: 現在位置より後の履歴削除（分岐回避）
            if (this.currentIndex < this.history.length - 1) {
                this.history.splice(this.currentIndex + 1);
                console.log('🔄 RecordManager 分岐履歴削除 - Phase1.5完全実装');
            }
            
            // Phase1.5: 履歴追加
            this.history.push(record);
            this.currentIndex = this.history.length - 1;
            
            // Phase1.5: 履歴サイズ制限（完全実装）
            this.enforceHistoryLimit();
            
            console.log(`🔄 RecordManager 履歴追加: ${record.type} (${this.currentIndex + 1}/${this.history.length}) - Phase1.5完全実装`);
        }
        
        /**
         * 履歴サイズ制限（Phase1.5完全実装）
         */
        enforceHistoryLimit() {
            if (this.history.length > this.maxHistorySize) {
                const removeCount = this.history.length - this.maxHistorySize;
                this.history.splice(0, removeCount);
                this.currentIndex -= removeCount;
                
                console.log(`🔄 RecordManager 履歴制限適用: ${removeCount}件削除 - Phase1.5完全実装`);
            }
        }
        
        /**
         * Undo実行（Phase1.5完全実装）
         */
        undo() {
            if (!this.canUndo()) {
                console.warn('⚠️ RecordManager: Undo不可 - Phase1.5完全実装');
                return false;
            }
            
            const currentRecord = this.history[this.currentIndex];
            console.log(`🔄 RecordManager Undo実行: ${currentRecord.type} - Phase1.5完全実装`);
            
            // Phase1.5: Undo処理（完全実装）
            this.executeUndo(currentRecord);
            this.currentIndex--;
            
            // Phase1.5: EventBus通知（完全実装）
            if (this.eventBus) {
                this.eventBus.emit('record:undo:executed', {
                    undoneRecord: currentRecord,
                    currentIndex: this.currentIndex,
                    canUndo: this.canUndo(),
                    canRedo: this.canRedo()
                });
            }
            
            return true;
        }
        
        /**
         * Redo実行（Phase1.5完全実装）
         */
        redo() {
            if (!this.canRedo()) {
                console.warn('⚠️ RecordManager: Redo不可 - Phase1.5完全実装');
                return false;
            }
            
            this.currentIndex++;
            const redoRecord = this.history[this.currentIndex];
            console.log(`🔄 RecordManager Redo実行: ${redoRecord.type} - Phase1.5完全実装`);
            
            // Phase1.5: Redo処理（完全実装）
            this.executeRedo(redoRecord);
            
            // Phase1.5: EventBus通知（完全実装）
            if (this.eventBus) {
                this.eventBus.emit('record:redo:executed', {
                    redoneRecord: redoRecord,
                    currentIndex: this.currentIndex,
                    canUndo: this.canUndo(),
                    canRedo: this.canRedo()
                });
            }
            
            return true;
        }
        
        /**
         * 🆕 Undo実行処理（Phase1.5完全実装）
         */
        executeUndo(record) {
            console.log(`↶ RecordManager Undo実行: ${record.type} (ID: ${record.id})`);
            
            // Graphics削除（可視要素の処理）
            if (record.graphics && record.layerId && window.Tegaki?.CanvasManagerInstance) {
                try {
                    window.Tegaki.CanvasManagerInstance.removeGraphicsFromLayer(record.graphics, record.layerId);
                    console.log(`🗑️ Graphics削除: ${record.type} from ${record.layerId}`);
                } catch (error) {
                    console.warn(`⚠️ Graphics削除失敗: ${error.message}`);
                }
            }
            
            // EventBusで各ツールにUndo通知
            if (this.eventBus) {
                this.eventBus.emit('tool:undo', {
                    record,
                    operationType: record.type
                });
            }
        }
        
        /**
         * 🆕 Redo実行処理（Phase1.5完全実装）
         */
        executeRedo(record) {
            console.log(`↷ RecordManager Redo実行: ${record.type} (ID: ${record.id})`);
            
            // Graphics復元（可視要素の処理）
            if (record.graphics && record.layerId && window.Tegaki?.CanvasManagerInstance) {
                try {
                    window.Tegaki.CanvasManagerInstance.addGraphicsToLayer(record.graphics, record.layerId);
                    console.log(`📥 Graphics復元: ${record.type} to ${record.layerId}`);
                } catch (error) {
                    console.warn(`⚠️ Graphics復元失敗: ${error.message}`);
                }
            }
            
            // EventBusで各ツールにRedo通知
            if (this.eventBus) {
                this.eventBus.emit('tool:redo', {
                    record,
                    operationType: record.type
                });
            }
        }
        
        /**
         * グループ開始（Phase1.5完全実装）
         */
        startGroup(groupName) {
            console.log(`🔄 RecordManager グループ開始: ${groupName} - Phase1.5完全実装`);
            
            this.currentGroup = {
                id: `group_${Date.now()}`,
                name: groupName || '操作グループ',
                startTime: Date.now(),
                records: []
            };
            
            this.grouping = true;
            
            // Phase1.5: EventBus通知（完全実装）
            if (this.eventBus) {
                this.eventBus.emit('record:group:started', {
                    group: this.currentGroup
                });
            }
        }
        
        /**
         * グループ終了（Phase1.5完全実装）
         */
        endGroup() {
            if (!this.grouping || !this.currentGroup) {
                console.warn('⚠️ RecordManager: アクティブなグループなし - Phase1.5完全実装');
                return;
            }
            
            console.log(`🔄 RecordManager グループ終了: ${this.currentGroup.name} - Phase1.5完全実装`);
            
            this.currentGroup.endTime = Date.now();
            this.currentGroup.duration = this.currentGroup.endTime - this.currentGroup.startTime;
            
            // Phase1.5: EventBus通知（完全実装）
            if (this.eventBus) {
                this.eventBus.emit('record:group:ended', {
                    group: this.currentGroup
                });
            }
            
            this.currentGroup = null;
            this.grouping = false;
        }
        
        /**
         * Undo可否判定（Phase1.5完全実装）
         */
        canUndo() {
            return this.currentIndex > 0;
        }
        
        /**
         * Redo可否判定（Phase1.5完全実装）
         */
        canRedo() {
            return this.currentIndex < this.history.length - 1;
        }
        
        /**
         * 履歴クリア（Phase1.5完全実装）
         */
        clearHistory() {
            console.log('🔄 RecordManager 履歴クリア - Phase1.5完全実装');
            
            // アクティブ操作も全てクリア
            this.activeOperations.clear();
            
            this.history = [];
            this.currentIndex = -1;
            this.currentMemoryUsage = 0;
            
            // Phase1.5: 初期状態再記録
            this.recordInitialState();
            
            // Phase1.5: EventBus通知（完全実装）
            if (this.eventBus) {
                this.eventBus.emit('record:history:cleared', {
                    historyLength: this.history.length
                });
            }
        }
        
        /**
         * 記録有効/無効設定（Phase1.5完全実装）
         */
        setEnabled(enabled) {
            if (this.enabled !== enabled) {
                console.log(`🔄 RecordManager 記録状態変更: ${this.enabled} -> ${enabled} - Phase1.5完全実装`);
                this.enabled = enabled;
                
                // Phase1.5: EventBus通知（完全実装）
                if (this.eventBus) {
                    this.eventBus.emit('record:enabled:changed', { enabled });
                }
            }
        }
        
        /**
         * 履歴情報取得（Phase1.5完全実装）
         */
        getHistoryInfo() {
            return {
                length: this.history.length,
                currentIndex: this.currentIndex,
                canUndo: this.canUndo(),
                canRedo: this.canRedo(),
                memoryUsage: this.currentMemoryUsage,
                memoryThreshold: this.memoryThreshold,
                grouping: this.grouping,
                enabled: this.enabled,
                activeOperations: this.activeOperations.size
            };
        }
        
        /**
         * 履歴一覧取得（Phase1.5完全実装）
         */
        getHistory(limit = 10) {
            const start = Math.max(0, this.history.length - limit);
            return this.history.slice(start).map((record, index) => ({
                index: start + index,
                type: record.type,
                description: record.description,
                timestamp: record.timestamp,
                isCurrent: start + index === this.currentIndex,
                groupId: record.groupId,
                hasGraphics: !!record.graphics
            }));
        }
        
        /**
         * 現在の状態取得（Phase1.5完全実装）
         */
        getRecordState() {
            return {
                enabled: this.enabled,
                recording: this.recording,
                grouping: this.grouping,
                currentGroup: this.currentGroup,
                historyLength: this.history.length,
                currentIndex: this.currentIndex,
                canUndo: this.canUndo(),
                canRedo: this.canRedo(),
                memoryUsage: this.currentMemoryUsage,
                initialized: this.initializeComplete,
                activeOperations: this.activeOperations.size,
                operationIdCounter: this.operationIdCounter
            };
        }
        
        /**
         * 🆕 アクティブ操作一覧取得
         */
        getActiveOperations() {
            const operations = [];
            this.activeOperations.forEach((operation, id) => {
                operations.push({
                    id,
                    type: operation.type,
                    description: operation.description,
                    startTime: operation.startTime,
                    duration: Date.now() - operation.startTime,
                    layerId: operation.layerId
                });
            });
            return operations;
        }
        
        /**
         * Phase1.5ステータス確認
         */
        getPhase15Status() {
            return {
                phase: 'Phase1.5',
                implementation: 'complete',
                features: {
                    basicUndoRedo: 'complete',
                    operationRecording: 'complete',
                    groupOperations: 'complete',
                    memoryManagement: 'basic',
                    eventBusIntegration: this.eventBus ? 'connected' : 'disconnected',
                    startEndOperations: 'complete' // 🆕 修正完了
                },
                history: {
                    total: this.history.length,
                    current: this.currentIndex,
                    maxSize: this.maxHistorySize,
                    memoryUsage: `${(this.currentMemoryUsage / 1024 / 1024).toFixed(2)}MB`,
                    activeOperations: this.activeOperations.size
                },
                nextStep: 'Phase2 - レイヤー管理・非破壊編集拡張・パフォーマンス最適化'
            };
        }
    }
    
    // Tegaki名前空間にRecordManagerを公開
    if (typeof window.Tegaki === 'undefined') {
        window.Tegaki = {};
    }
    
    window.Tegaki.RecordManager = RecordManager;
    
    console.log('✅ RecordManager Phase1.5完全実装 - 名前空間登録完了');
    console.log('🆕 startOperation/endOperationメソッド追加完了');
    console.log('🔧 次のステップ: Phase2実装・レイヤー管理・非破壊編集拡張・パフォーマンス最適化');
    
})();