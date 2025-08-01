// ⏰ 履歴管理システム - アンドゥ・リドゥ・状態管理・Phase拡張対応
// 非破壊編集・状態スナップショット・効率的メモリ管理

/**
 * 🚀 HistoryController - 統一履歴管理システム
 * 
 * 【責務】
 * - アンドゥ・リドゥ機能の完全実装
 * - 非破壊編集の状態管理
 * - 効率的なメモリ使用でのスナップショット管理
 * - Phase2・3での高度な履歴機能拡張
 */
export class HistoryController {
    constructor(eventStore) {
        this.eventStore = eventStore;
        
        // 履歴スタック
        this.undoStack = [];
        this.redoStack = [];
        
        // 設定
        this.maxHistorySize = 50; // 最大履歴数
        this.maxMemoryUsage = 100 * 1024 * 1024; // 100MB制限
        this.autoSaveInterval = 30000; // 30秒間隔でオートセーブ
        
        // 状態管理
        this.currentState = null;
        this.stateId = 0;
        this.memoryUsage = 0;
        
        // アクション分類
        this.actionTypes = {
            STROKE: 'stroke',
            TRANSFORM: 'transform',
            LAYER_CHANGE: 'layer_change',
            PROPERTY_CHANGE: 'property_change',
            BATCH: 'batch'
        };

        // Phase2・3拡張準備
        // this.advancedHistory = []; // 🔒Phase2解封：レイヤー履歴
        // this.animationHistory = []; // 🔒Phase3解封：アニメーション履歴
        
        // デバッグ機能
        this.debugMode = false;
        this.historyLog = [];
        
        // イベントリスナー設定
        this.setupEventListeners();
        
        // オートセーブ設定
        this.setupAutoSave();
        
        console.log('⏰ HistoryController初期化完了');
    }

    /**
     * ✅ アクション検証
     */
    validateAction(action) {
        if (!action || typeof action !== 'object') return false;
        if (!action.type) return false;
        if (!action.data) return false;
        
        return true;
    }

    /**
     * 📊 アクションサイズ計算
     */
    calculateActionSize(action) {
        try {
            const serialized = JSON.stringify(action);
            return new Blob([serialized]).size;
        } catch (error) {
            console.warn('⚠️ アクションサイズ計算失敗:', error);
            return 1024; // デフォルト1KB
        }
    }

    /**
     * 🧹 メモリ使用量最適化
     */
    optimizeMemoryUsage() {
        console.log('🧹 メモリ最適化開始:', this.formatMemorySize(this.memoryUsage));
        
        // 古い履歴削除
        const targetSize = this.maxMemoryUsage * 0.7; // 70%まで削減
        
        while (this.memoryUsage > targetSize && this.undoStack.length > 0) {
            const oldestAction = this.undoStack.shift();
            this.memoryUsage -= oldestAction.memorySize;
        }
        
        // リドゥスタックも最適化
        while (this.redoStack.length > this.maxHistorySize / 2) {
            this.redoStack.shift();
        }
        
        console.log('✅ メモリ最適化完了:', this.formatMemorySize(this.memoryUsage));
    }

    /**
     * 📏 履歴サイズ制限
     */
    enforceHistoryLimit() {
        while (this.undoStack.length > this.maxHistorySize) {
            const removedAction = this.undoStack.shift();
            this.memoryUsage -= removedAction.memorySize;
        }
        
        while (this.redoStack.length > this.maxHistorySize) {
            this.redoStack.shift();
        }
    }

    /**
     * 🗑️ リドゥスタッククリア
     */
    clearRedoStack() {
        this.redoStack.forEach(action => {
            this.memoryUsage -= action.memorySize;
        });
        this.redoStack = [];
    }

    /**
     * ❓ アンドゥ可能判定
     */
    canUndo() {
        return this.undoStack.length > 0;
    }

    /**
     * ❓ リドゥ可能判定
     */
    canRedo() {
        return this.redoStack.length > 0;
    }

    /**
     * 📦 バッチアクション作成
     */
    createBatchAction(actions, description = 'バッチ操作') {
        return {
            type: this.actionTypes.BATCH,
            description: description,
            data: {
                actions: actions.map(action => ({ ...action }))
            },
            reverseData: {
                actionCount: actions.length
            }
        };
    }

    /**
     * 🎯 バッチアクション開始
     */
    startBatch(description = 'バッチ操作') {
        this.batchActions = [];
        this.batchDescription = description;
        this.isBatching = true;
        
        console.log('🎯 バッチアクション開始:', description);
    }

    /**
     * 📦 バッチアクション追加
     */
    addToBatch(action) {
        if (!this.isBatching) {
            console.warn('⚠️ バッチ処理中ではありません');
            return false;
        }
        
        this.batchActions.push(action);
        return true;
    }

    /**
     * ✅ バッチアクション完了
     */
    completeBatch() {
        if (!this.isBatching || this.batchActions.length === 0) {
            console.warn('⚠️ 完了できるバッチがありません');
            return false;
        }
        
        const batchAction = this.createBatchAction(this.batchActions, this.batchDescription);
        this.addAction(batchAction);
        
        // リセット
        this.batchActions = [];
        this.batchDescription = '';
        this.isBatching = false;
        
        console.log('✅ バッチアクション完了:', batchAction.description);
        return true;
    }

    /**
     * ❌ バッチアクション取り消し
     */
    cancelBatch() {
        this.batchActions = [];
        this.batchDescription = '';
        this.isBatching = false;
        
        console.log('❌ バッチアクション取り消し');
    }

    /**
     * 💾 オートセーブ設定
     */
    setupAutoSave() {
        if (this.autoSaveInterval > 0) {
            this.autoSaveTimer = setInterval(() => {
                this.createAutoSavePoint();
            }, this.autoSaveInterval);
        }
    }

    /**
     * 💾 オートセーブポイント作成
     */
    createAutoSavePoint() {
        if (this.undoStack.length === 0) return;
        
        const saveAction = {
            type: 'auto_save',
            description: 'オートセーブ',
            data: {
                timestamp: Date.now(),
                historyLength: this.undoStack.length,
                memoryUsage: this.memoryUsage
            },
            isAutoSave: true
        };
        
        // オートセーブログ
        if (!this.autoSaveLog) {
            this.autoSaveLog = [];
        }
        
        this.autoSaveLog.push(saveAction);
        
        // オートセーブログ制限
        if (this.autoSaveLog.length > 10) {
            this.autoSaveLog.shift();
        }
        
        console.log('💾 オートセーブポイント作成:', new Date().toLocaleTimeString());
    }

    /**
     * 🚨 システムエラー処理
     */
    handleSystemError(event) {
        // エラー時の緊急バックアップ
        this.createEmergencyBackup();
        
        console.error('🚨 システムエラー - 履歴緊急保存実行');
    }

    /**
     * 🆘 緊急バックアップ作成
     */
    createEmergencyBackup() {
        try {
            const backup = {
                undoStack: this.undoStack.slice(-10), // 最新10個のみ
                timestamp: Date.now(),
                type: 'emergency_backup'
            };
            
            localStorage.setItem('historyEmergencyBackup', JSON.stringify(backup));
            console.log('🆘 緊急バックアップ作成完了');
        } catch (error) {
            console.error('❌ 緊急バックアップ失敗:', error);
        }
    }

    /**
     * 🔄 緊急バックアップ復元
     */
    restoreEmergencyBackup() {
        try {
            const backupJson = localStorage.getItem('historyEmergencyBackup');
            if (!backupJson) return false;
            
            const backup = JSON.parse(backupJson);
            
            // バックアップから復元（確認付き）
            const confirmed = confirm('緊急バックアップが見つかりました。復元しますか？');
            if (confirmed) {
                this.undoStack = backup.undoStack || [];
                this.redoStack = [];
                this.recalculateMemoryUsage();
                
                console.log('🔄 緊急バックアップ復元完了');
                return true;
            }
        } catch (error) {
            console.error('❌ 緊急バックアップ復元失敗:', error);
        }
        
        return false;
    }

    /**
     * 🔢 メモリ使用量再計算
     */
    recalculateMemoryUsage() {
        this.memoryUsage = this.undoStack.reduce((total, action) => {
            return total + (action.memorySize || 0);
        }, 0);
        
        console.log('🔢 メモリ使用量再計算:', this.formatMemorySize(this.memoryUsage));
    }

    /**
     * 📊 メモリサイズフォーマット
     */
    formatMemorySize(bytes) {
        const units = ['B', 'KB', 'MB', 'GB'];
        let size = bytes;
        let unitIndex = 0;
        
        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }
        
        return `${size.toFixed(1)} ${units[unitIndex]}`;
    }

    /**
     * 📝 履歴アクションログ
     */
    logHistoryAction(operation, action) {
        const logEntry = {
            operation: operation,
            actionType: action.type,
            actionId: action.id,
            timestamp: Date.now(),
            memorySize: action.memorySize,
            description: action.description || action.type
        };
        
        this.historyLog.push(logEntry);
        
        // ログサイズ制限
        if (this.historyLog.length > 100) {
            this.historyLog.shift();
        }
    }

    /**
     * 📊 履歴統計取得
     */
    getHistoryStats() {
        return {
            undoStackSize: this.undoStack.length,
            redoStackSize: this.redoStack.length,
            memoryUsage: this.memoryUsage,
            formattedMemoryUsage: this.formatMemorySize(this.memoryUsage),
            maxHistorySize: this.maxHistorySize,
            maxMemoryUsage: this.maxMemoryUsage,
            canUndo: this.canUndo(),
            canRedo: this.canRedo(),
            isBatching: this.isBatching,
            autoSaveCount: this.autoSaveLog?.length || 0,
            totalActions: this.stateId
        };
    }

    /**
     * 📜 履歴一覧取得
     */
    getHistoryList(limit = 20) {
        return this.undoStack.slice(-limit).map(action => ({
            id: action.id,
            type: action.type,
            description: action.description || action.type,
            timestamp: action.timestamp,
            memorySize: this.formatMemorySize(action.memorySize)
        }));
    }

    /**
     * 🔍 履歴検索
     */
    searchHistory(query) {
        const searchTerm = query.toLowerCase();
        
        return this.undoStack.filter(action => {
            return action.type.toLowerCase().includes(searchTerm) ||
                   (action.description && action.description.toLowerCase().includes(searchTerm));
        });
    }

    /**
     * 🧹 履歴クリア
     */
    clearHistory() {
        const confirmed = confirm('履歴をすべてクリアしますか？この操作は取り消せません。');
        if (!confirmed) return false;
        
        this.undoStack = [];
        this.redoStack = [];
        this.memoryUsage = 0;
        this.stateId = 0;
        
        // イベント通知
        this.eventStore.emit(this.eventStore.eventTypes.HISTORY_CHANGE, {
            action: 'clear',
            canUndo: false,
            canRedo: false,
            historySize: 0
        });
        
        console.log('🧹 履歴クリア完了');
        return true;
    }

    /**
     * ⚙️ 設定更新
     */
    updateSettings(settings) {
        if (settings.maxHistorySize !== undefined) {
            this.maxHistorySize = Math.max(1, settings.maxHistorySize);
            this.enforceHistoryLimit();
        }
        
        if (settings.maxMemoryUsage !== undefined) {
            this.maxMemoryUsage = Math.max(1024 * 1024, settings.maxMemoryUsage); // 最小1MB
            if (this.memoryUsage > this.maxMemoryUsage) {
                this.optimizeMemoryUsage();
            }
        }
        
        if (settings.autoSaveInterval !== undefined) {
            this.autoSaveInterval = Math.max(0, settings.autoSaveInterval);
            
            // オートセーブタイマー再設定
            if (this.autoSaveTimer) {
                clearInterval(this.autoSaveTimer);
            }
            this.setupAutoSave();
        }
        
        console.log('⚙️ 履歴設定更新完了:', settings);
    }

    /**
     * 💾 設定保存
     */
    saveSettings() {
        const settings = {
            maxHistorySize: this.maxHistorySize,
            maxMemoryUsage: this.maxMemoryUsage,
            autoSaveInterval: this.autoSaveInterval,
            debugMode: this.debugMode
        };
        
        try {
            localStorage.setItem('historySettings', JSON.stringify(settings));
            return true;
        } catch (error) {
            console.error('❌ 履歴設定保存失敗:', error);
            return false;
        }
    }

    /**
     * 📂 設定読み込み
     */
    loadSettings() {
        try {
            const settingsJson = localStorage.getItem('historySettings');
            if (!settingsJson) return false;
            
            const settings = JSON.parse(settingsJson);
            this.updateSettings(settings);
            
            return true;
        } catch (error) {
            console.error('❌ 履歴設定読み込み失敗:', error);
            return false;
        }
    }

    /**
     * 🐛 デバッグモード切り替え
     */
    setDebugMode(enabled) {
        this.debugMode = enabled;
        console.log(`🐛 履歴デバッグモード: ${enabled ? '有効' : '無効'}`);
    }

    // 🎨 Phase2拡張メソッド（解封時有効化）
    /*
    setupAdvancedHistory() {                        // 🔒Phase2解封
        // レイヤー履歴管理
        this.layerHistory = [];
        this.propertyHistory = [];
        
        // レイヤーイベント購読
        this.eventStore.on('vectorLayer:create', this.handleLayerCreate.bind(this));
        this.eventStore.on('vectorLayer:delete', this.handleLayerDelete.bind(this));
        this.eventStore.on('vectorLayer:transform', this.handleLayerTransform.bind(this));
        
        console.log('🎨 Phase2履歴機能拡張完了');
    }

    handleLayerCreate(event) {                      // 🔒Phase2解封
        const layerAction = {
            type: this.actionTypes.LAYER_CHANGE,
            subType: 'create',
            data: {
                layerId: event.layerId,
                layerData: event.layerData,
                position: event.position
            },
            reverseData: {
                layerId: event.layerId
            }
        };
        
        this.addAction(layerAction);
    }
    */

    // ⚡ Phase3拡張メソッド（解封時有効化）
    /*
    setupAnimationHistory() {                       // 🔒Phase3解封
        // アニメーション履歴管理
        this.keyframeHistory = [];
        this.timelineHistory = [];
        
        // アニメーションイベント購読
        this.eventStore.on('animation:keyframe:add', this.handleKeyframeAdd.bind(this));
        this.eventStore.on('animation:timeline:update', this.handleTimelineUpdate.bind(this));
        
        console.log('⚡ Phase3アニメーション履歴機能拡張完了');
    }

    createAnimationSnapshot() {                     // 🔒Phase3解封
        // アニメーション状態のスナップショット作成
        return {
            keyframes: [...this.keyframeHistory],
            timeline: { ...this.timelineHistory },
            timestamp: Date.now()
        };
    }
    */

 /**
     * 🗑️ リソース解放
     */
    destroy() {
        // オートセーブタイマー停止
        if (this.autoSaveTimer) {
            clearInterval(this.autoSaveTimer);
        }
        
        // 設定保存
        this.saveSettings();
        
        // 緊急バックアップ作成
        this.createEmergencyBackup();
        
        // データクリア
        this.undoStack = [];
        this.redoStack = [];
        this.batchActions = [];
        this.historyLog = [];
        this.autoSaveLog = [];
        
        console.log('🗑️ HistoryController リソース解放完了');
    }

    /**
     * 🎛️ イベントリスナー設定
     */
    setupEventListeners() {
        // 描画イベント
        this.eventStore.on(this.eventStore.eventTypes.STROKE_COMPLETE, this.handleStrokeComplete.bind(this));
        
        // 履歴操作イベント
        this.eventStore.on(this.eventStore.eventTypes.HISTORY_UNDO, this.undo.bind(this));
        this.eventStore.on(this.eventStore.eventTypes.HISTORY_REDO, this.redo.bind(this));
        
        // ショートカットイベント
        this.eventStore.on('history:undo', this.undo.bind(this));
        this.eventStore.on('history:redo', this.redo.bind(this));
        
        // 座標変換イベント
        this.eventStore.on(this.eventStore.eventTypes.COORDINATE_TRANSFORM, this.handleCoordinateTransform.bind(this));
        
        // システムイベント
        this.eventStore.on(this.eventStore.eventTypes.SYSTEM_ERROR, this.handleSystemError.bind(this));
    }

    /**
     * 📝 アクション追加
     */
    addAction(action) {
        if (!this.validateAction(action)) {
            console.warn('⚠️ 無効なアクション:', action);
            return false;
        }

        // 状態ID生成
        const stateAction = {
            ...action,
            id: ++this.stateId,
            timestamp: Date.now(),
            memorySize: this.calculateActionSize(action)
        };

        // メモリ使用量チェック
        if (this.memoryUsage + stateAction.memorySize > this.maxMemoryUsage) {
            this.optimizeMemoryUsage();
        }

        // アンドゥスタックに追加
        this.undoStack.push(stateAction);
        this.memoryUsage += stateAction.memorySize;
        
        // リドゥスタッククリア（新しいアクションでリドゥ無効）
        this.clearRedoStack();
        
        // 履歴サイズ制限
        this.enforceHistoryLimit();
        
        // 履歴変更イベント
        this.eventStore.emit(this.eventStore.eventTypes.HISTORY_CHANGE, {
            action: 'add',
            canUndo: this.canUndo(),
            canRedo: this.canRedo(),
            historySize: this.undoStack.length
        });

        // デバッグログ
        if (this.debugMode) {
            this.logHistoryAction('add', stateAction);
        }

        console.log('📝 アクション追加:', action.type, `(履歴: ${this.undoStack.length})`);
        return true;
    }

    /**
     * ⏪ アンドゥ実行
     */
    undo() {
        if (!this.canUndo()) {
            console.warn('⚠️ アンドゥできません');
            return false;
        }

        const action = this.undoStack.pop();
        this.memoryUsage -= action.memorySize;
        
        // リドゥスタックに移動
        this.redoStack.push(action);
        
        // アクション実行（逆操作）
        this.executeReverseAction(action);
        
        // 履歴変更イベント
        this.eventStore.emit(this.eventStore.eventTypes.HISTORY_CHANGE, {
            action: 'undo',
            undoneAction: action,
            canUndo: this.canUndo(),  
            canRedo: this.canRedo(),
            historySize: this.undoStack.length
        });

        // デバッグログ
        if (this.debugMode) {
            this.logHistoryAction('undo', action);
        }

        console.log('⏪ アンドゥ実行:', action.type, `(履歴: ${this.undoStack.length})`);
        return true;
    }

    /**
     * ⏩ リドゥ実行
     */
    redo() {
        if (!this.canRedo()) {
            console.warn('⚠️ リドゥできません');
            return false;
        }

        const action = this.redoStack.pop();
        
        // アンドゥスタックに戻す
        this.undoStack.push(action);
        this.memoryUsage += action.memorySize;
        
        // アクション実行（順操作）
        this.executeForwardAction(action);
        
        // 履歴変更イベント
        this.eventStore.emit(this.eventStore.eventTypes.HISTORY_CHANGE, {
            action: 'redo',
            redoneAction: action,
            canUndo: this.canUndo(),
            canRedo: this.canRedo(),
            historySize: this.undoStack.length
        });

        // デバッグログ
        if (this.debugMode) {
            this.logHistoryAction('redo', action);
        }

        console.log('⏩ リドゥ実行:', action.type, `(履歴: ${this.undoStack.length})`);
        return true;
    }

    /**
     * 🖌️ ストローク完了処理
     */
    handleStrokeComplete(event) {
        const strokeAction = {
            type: this.actionTypes.STROKE,
            data: {
                points: event.points ? [...event.points] : [],
                tool: event.tool,
                properties: event.properties || {},
                layerId: event.layerId || 'default'
            },
            reverseData: {
                // 削除用の情報（Phase2でレイヤー管理と連携）
                position: this.undoStack.length
            }
        };

        this.addAction(strokeAction);
    }

    /**
     * 📐 座標変換処理
     */
    handleCoordinateTransform(event) {
        const transformAction = {
            type: this.actionTypes.TRANSFORM,
            data: {
                transform: event.transform,
                affectedObjects: event.affectedObjects || [],
                transformType: event.transformType || 'view'
            },
            reverseData: {
                inverseTransform: this.calculateInverseTransform(event.transform)
            }
        };

        this.addAction(transformAction);
    }

    /**
     * 🔄 逆変換計算
     */
    calculateInverseTransform(transform) {
        const inverse = {};
        
        if (transform.pan) {
            inverse.pan = { x: -transform.pan.x, y: -transform.pan.y };
        }
        
        if (transform.zoom) {
            inverse.zoom = 1 / transform.zoom;
        }
        
        if (transform.rotation) {
            inverse.rotation = -transform.rotation;
        }
        
        return inverse;
    }

    /**
     * ⚡ 順方向アクション実行
     */
    executeForwardAction(action) {
        switch (action.type) {
            case this.actionTypes.STROKE:
                this.executeStrokeAction(action, 'forward');
                break;
                
            case this.actionTypes.TRANSFORM:
                this.executeTransformAction(action, 'forward');
                break;
                
            case this.actionTypes.LAYER_CHANGE:
                this.executeLayerAction(action, 'forward');
                break;
                
            case this.actionTypes.BATCH:
                this.executeBatchAction(action, 'forward');
                break;
                
            default:
                console.warn('⚠️ 不明なアクションタイプ:', action.type);
        }
    }

    /**
     * ⚡ 逆方向アクション実行
     */
    executeReverseAction(action) {
        switch (action.type) {
            case this.actionTypes.STROKE:
                this.executeStrokeAction(action, 'reverse');
                break;
                
            case this.actionTypes.TRANSFORM:
                this.executeTransformAction(action, 'reverse');
                break;
                
            case this.actionTypes.LAYER_CHANGE:
                this.executeLayerAction(action, 'reverse');
                break;
                
            case this.actionTypes.BATCH:
                this.executeBatchAction(action, 'reverse');
                break;
                
            default:
                console.warn('⚠️ 不明なアクションタイプ:', action.type);
        }
    }

    /**
     * 🖌️ ストロークアクション実行
     */
    executeStrokeAction(action, direction) {
        if (direction === 'forward') {
            // ストローク追加
            this.eventStore.emit('render:stroke-add', {
                stroke: action.data,
                position: action.reverseData.position
            });
        } else {
            // ストローク削除
            this.eventStore.emit('render:stroke-remove', {
                position: action.reverseData.position
            });
        }
    }

    /**
     * 📐 変換アクション実行
     */
    executeTransformAction(action, direction) {
        const transform = direction === 'forward' ? 
            action.data.transform : 
            action.reverseData.inverseTransform;
        
        this.eventStore.emit(this.eventStore.eventTypes.COORDINATE_TRANSFORM, {
            transform: transform,
            isHistoryReplay: true
        });
    }

    /**
     * 📚 レイヤーアクション実行（Phase2実装予定）
     */
    executeLayerAction(action, direction) {
        // Phase2でVectorLayerProcessorと連携
        console.log('📚 レイヤーアクション（Phase2実装予定）:', direction);
    }

    /**
     * 📦 バッチアクション実行
     */
    executeBatchAction(action, direction) {
        const actions = direction === 'forward' ? 
            action.data.actions : 
            [...action.data.actions].reverse();
        
        actions.forEach(subAction => {
            if (direction === 'forward') {
                this.executeForwardAction(subAction);
            } else {
                this.executeReverseAction(subAction);
            }
        });
    }

    /**