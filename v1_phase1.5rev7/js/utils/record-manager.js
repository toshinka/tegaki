/**
 * 🔄 RecordManager - Phase1.5スタブ実装版
 * 📋 RESPONSIBILITY: Undo/Redo・操作履歴・非破壊編集・状態管理
 * 🚫 PROHIBITION: 描画処理・座標変換・UI制御・ツール実装
 * ✅ PERMISSION: 操作記録・状態スナップショット・EventBus通信・メモリ管理
 * 
 * 📏 DESIGN_PRINCIPLE: 非破壊編集・状態不変性・メモリ効率・EventBus連携
 * 🔄 INTEGRATION: Phase1.5基盤・EventBus必須・AbstractTool連携・全Manager対応
 * 🎯 Phase1.5: 基本Undo/Redo・操作記録基盤・Phase2準備
 */

(function() {
    'use strict';
    
    /**
     * RecordManager - 操作履歴・Undo/Redo管理
     */
    class RecordManager {
        constructor() {
            console.log('🔄 RecordManager Phase1.5スタブ実装 - 初期化開始');
            
            this.eventBus = null;
            
            // 履歴管理（Phase1.5基盤）
            this.history = [];
            this.currentIndex = -1;
            this.maxHistorySize = 50;
            
            // 操作グループ管理（複数操作の束ね）
            this.currentGroup = null;
            this.grouping = false;
            
            // 記録設定（Phase1.5基盤）
            this.enabled = true;
            this.recording = false;
            
            // メモリ管理（Phase1.5準備）
            this.memoryThreshold = 100 * 1024 * 1024; // 100MB
            this.currentMemoryUsage = 0;
            
            this.initializeComplete = false;
            
            console.log('🔄 RecordManager スタブ実装完了');
        }
        
        /**
         * 初期化（Phase1.5スタブ - EventBus連携準備）
         */
        initialize(eventBus) {
            console.log('🔄 RecordManager 初期化 - Phase1.5スタブ版');
            
            if (!eventBus) {
                console.warn('⚠️ RecordManager: EventBus未提供 - Phase1.5開発中');
                return false;
            }
            
            this.eventBus = eventBus;
            
            // Phase1.5: EventBus連携準備（スタブ）
            this.setupEventBusListeners();
            
            // Phase1.5: 初期状態記録（スタブ）
            this.recordInitialState();
            
            this.initializeComplete = true;
            console.log('✅ RecordManager 初期化完了 - Phase1.5スタブ版');
            
            return true;
        }
        
        /**
         * EventBus連携設定（Phase1.5スタブ実装）
         */
        setupEventBusListeners() {
            if (!this.eventBus) return;
            
            console.log('🔄 RecordManager EventBus連携設定 - Phase1.5スタブ');
            
            // Phase1.5: Undo/Redoコマンド受信（スタブ）
            this.eventBus.on('undo', () => {
                this.undo();
            });
            
            this.eventBus.on('redo', () => {
                this.redo();
            });
            
            // Phase1.5: 操作記録コマンド受信（スタブ）
            this.eventBus.on('record:action', (data) => {
                this.recordAction(data);
            });
            
            // Phase1.5: グループ操作コマンド受信（スタブ）
            this.eventBus.on('record:group:start', (data) => {
                this.startGroup(data.name);
            });
            
            this.eventBus.on('record:group:end', () => {
                this.endGroup();
            });
            
            console.log('🔄 RecordManager EventBus連携設定完了 - Phase1.5スタブ');
        }
        
        /**
         * 初期状態記録（Phase1.5スタブ実装）
         */
        recordInitialState() {
            console.log('🔄 RecordManager 初期状態記録 - Phase1.5スタブ');
            
            // Phase1.5: 初期状態のスナップショット作成（スタブ）
            const initialState = {
                type: 'initial',
                timestamp: Date.now(),
                description: 'アプリケーション初期状態',
                data: {
                    canvas: 'initial',
                    layers: [],
                    tools: {}
                }
            };
            
            this.history = [initialState];
            this.currentIndex = 0;
            
            console.log('🔄 RecordManager 初期状態記録完了 - Phase1.5スタブ');
        }
        
        /**
         * 操作記録（Phase1.5スタブ実装）
         */
        recordAction(actionData) {
            if (!this.enabled || !this.initializeComplete) {
                return;
            }
            
            console.log('🔄 RecordManager 操作記録:', actionData.type || 'unknown', '- Phase1.5スタブ');
            
            // Phase1.5: 操作データ作成（スタブ）
            const record = {
                type: actionData.type || 'action',
                timestamp: Date.now(),
                description: actionData.description || '操作',
                data: actionData.data || {},
                undoData: actionData.undoData || {},
                groupId: this.grouping ? this.currentGroup?.id : null
            };
            
            // Phase1.5: 履歴追加処理（スタブ）
            this.addToHistory(record);
            
            // Phase1.5: EventBus通知（スタブ）
            if (this.eventBus) {
                this.eventBus.emit('record:action:recorded', {
                    record,
                    historyLength: this.history.length,
                    currentIndex: this.currentIndex
                });
            }
        }
        
        /**
         * 履歴追加処理（Phase1.5スタブ実装）
         */
        addToHistory(record) {
            // Phase1.5: 現在位置より後の履歴削除（分岐回避）
            if (this.currentIndex < this.history.length - 1) {
                this.history.splice(this.currentIndex + 1);
                console.log('🔄 RecordManager 分岐履歴削除 - Phase1.5スタブ');
            }
            
            // Phase1.5: 履歴追加
            this.history.push(record);
            this.currentIndex = this.history.length - 1;
            
            // Phase1.5: 履歴サイズ制限（スタブ）
            this.enforceHistoryLimit();
            
            console.log(`🔄 RecordManager 履歴追加: ${record.type} (${this.currentIndex + 1}/${this.history.length}) - Phase1.5スタブ`);
        }
        
        /**
         * 履歴サイズ制限（Phase1.5スタブ実装）
         */
        enforceHistoryLimit() {
            if (this.history.length > this.maxHistorySize) {
                const removeCount = this.history.length - this.maxHistorySize;
                this.history.splice(0, removeCount);
                this.currentIndex -= removeCount;
                
                console.log(`🔄 RecordManager 履歴制限適用: ${removeCount}件削除 - Phase1.5スタブ`);
            }
        }
        
        /**
         * Undo実行（Phase1.5スタブ実装）
         */
        undo() {
            if (!this.canUndo()) {
                console.warn('⚠️ RecordManager: Undo不可 - Phase1.5スタブ');
                return false;
            }
            
            const currentRecord = this.history[this.currentIndex];
            console.log(`🔄 RecordManager Undo実行: ${currentRecord.type} - Phase1.5スタブ`);
            
            // Phase1.5: Undo処理（スタブ - 実際の処理は詳細実装で追加）
            this.currentIndex--;
            
            // Phase1.5: EventBus通知（スタブ）
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
         * Redo実行（Phase1.5スタブ実装）
         */
        redo() {
            if (!this.canRedo()) {
                console.warn('⚠️ RecordManager: Redo不可 - Phase1.5スタブ');
                return false;
            }
            
            this.currentIndex++;
            const redoRecord = this.history[this.currentIndex];
            console.log(`🔄 RecordManager Redo実行: ${redoRecord.type} - Phase1.5スタブ`);
            
            // Phase1.5: Redo処理（スタブ - 実際の処理は詳細実装で追加）
            
            // Phase1.5: EventBus通知（スタブ）
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
         * グループ開始（Phase1.5スタブ実装）
         */
        startGroup(groupName) {
            console.log(`🔄 RecordManager グループ開始: ${groupName} - Phase1.5スタブ`);
            
            this.currentGroup = {
                id: `group_${Date.now()}`,
                name: groupName || '操作グループ',
                startTime: Date.now(),
                records: []
            };
            
            this.grouping = true;
            
            // Phase1.5: EventBus通知（スタブ）
            if (this.eventBus) {
                this.eventBus.emit('record:group:started', {
                    group: this.currentGroup
                });
            }
        }
        
        /**
         * グループ終了（Phase1.5スタブ実装）
         */
        endGroup() {
            if (!this.grouping || !this.currentGroup) {
                console.warn('⚠️ RecordManager: アクティブなグループなし - Phase1.5スタブ');
                return;
            }
            
            console.log(`🔄 RecordManager グループ終了: ${this.currentGroup.name} - Phase1.5スタブ`);
            
            this.currentGroup.endTime = Date.now();
            this.currentGroup.duration = this.currentGroup.endTime - this.currentGroup.startTime;
            
            // Phase1.5: EventBus通知（スタブ）
            if (this.eventBus) {
                this.eventBus.emit('record:group:ended', {
                    group: this.currentGroup
                });
            }
            
            this.currentGroup = null;
            this.grouping = false;
        }
        
        /**
         * Undo可否判定（Phase1.5スタブ実装）
         */
        canUndo() {
            return this.currentIndex > 0;
        }
        
        /**
         * Redo可否判定（Phase1.5スタブ実装）
         */
        canRedo() {
            return this.currentIndex < this.history.length - 1;
        }
        
        /**
         * 履歴クリア（Phase1.5スタブ実装）
         */
        clearHistory() {
            console.log('🔄 RecordManager 履歴クリア - Phase1.5スタブ');
            
            this.history = [];
            this.currentIndex = -1;
            this.currentMemoryUsage = 0;
            
            // Phase1.5: 初期状態再記録
            this.recordInitialState();
            
            // Phase1.5: EventBus通知（スタブ）
            if (this.eventBus) {
                this.eventBus.emit('record:history:cleared', {
                    historyLength: this.history.length
                });
            }
        }
        
        /**
         * 記録有効/無効設定（Phase1.5スタブ実装）
         */
        setEnabled(enabled) {
            if (this.enabled !== enabled) {
                console.log(`🔄 RecordManager 記録状態変更: ${this.enabled} -> ${enabled} - Phase1.5スタブ`);
                this.enabled = enabled;
                
                // Phase1.5: EventBus通知（スタブ）
                if (this.eventBus) {
                    this.eventBus.emit('record:enabled:changed', { enabled });
                }
            }
        }
        
        /**
         * 履歴情報取得（Phase1.5スタブ実装）
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
                enabled: this.enabled
            };
        }
        
        /**
         * 履歴一覧取得（Phase1.5スタブ実装）
         */
        getHistory(limit = 10) {
            const start = Math.max(0, this.history.length - limit);
            return this.history.slice(start).map((record, index) => ({
                index: start + index,
                type: record.type,
                description: record.description,
                timestamp: record.timestamp,
                isCurrent: start + index === this.currentIndex,
                groupId: record.groupId
            }));
        }
        
        /**
         * 現在の状態取得（Phase1.5スタブ実装）
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
                initialized: this.initializeComplete
            };
        }
        
        /**
         * Phase1.5ステータス確認
         */
        getPhase15Status() {
            return {
                phase: 'Phase1.5',
                implementation: 'stub',
                features: {
                    basicUndoRedo: 'stub',
                    operationRecording: 'stub',
                    groupOperations: 'stub',
                    memoryManagement: 'stub',
                    eventBusIntegration: this.eventBus ? 'connected' : 'disconnected'
                },
                history: {
                    total: this.history.length,
                    current: this.currentIndex,
                    maxSize: this.maxHistorySize,
                    memoryUsage: `${(this.currentMemoryUsage / 1024 / 1024).toFixed(2)}MB`
                },
                nextStep: 'DetailedImplementation - 状態スナップショット・非破壊編集・メモリ最適化'
            };
        }
    }
    
    // Tegaki名前空間にRecordManagerを公開
    if (typeof window.Tegaki === 'undefined') {
        window.Tegaki = {};
    }
    
    window.Tegaki.RecordManager = RecordManager;
    
    console.log('🔄 RecordManager Phase1.5スタブ実装 - 名前空間登録完了');
    console.log('🔧 次のステップ: 詳細実装・状態スナップショット・AbstractTool統合・メモリ最適化');
    
})();