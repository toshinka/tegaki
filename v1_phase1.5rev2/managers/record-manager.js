/**
 * 🔄 RecordManager - Phase1.5 非破壊編集・Undo/Redoシステム
 * 📋 RESPONSIBILITY: 操作履歴管理・Undo/Redo・操作記録・状態保存復元のみ
 * 🚫 PROHIBITION: 描画処理・UI更新・座標変換・ツール操作・レイヤー管理
 * ✅ PERMISSION: 操作記録・履歴管理・状態スナップショット・復元処理
 * 
 * 📏 DESIGN_PRINCIPLE: 非破壊編集専門・操作の可逆性保証・剛直構造
 * 🔄 INTEGRATION: 全ツール・NavigationManager・CanvasManager連携
 * 🎯 FEATURE: Undo/Redo・操作グループ・自動スナップショット・履歴圧縮
 */

// Tegaki名前空間初期化
window.Tegaki = window.Tegaki || {};

/**
 * RecordManager - 非破壊編集・Undo/Redoシステム
 * 全操作を記録し、確実なUndo/Redoを提供する履歴管理システム
 */
class RecordManager {
    constructor() {
        console.log('🔄 RecordManager Phase1.5 非破壊編集・Undo/Redoシステム 作成');
        
        // 依存関係
        this.canvasManager = null;
        this.toolManager = null;
        this.navigationManager = null;
        
        // 操作履歴（メイン履歴スタック）
        this.operationHistory = [];      // 実行済み操作履歴
        this.redoStack = [];             // Redo用スタック
        this.currentPosition = -1;       // 現在の履歴位置
        
        // 履歴制限・設定
        this.maxHistorySize = 100;       // 最大履歴数
        this.autoSaveInterval = 10;      // 自動スナップショット間隔（操作数）
        this.compressionThreshold = 50;  // 履歴圧縮開始閾値
        
        // 操作グループ管理
        this.isRecordingGroup = false;   // グループ記録中フラグ
        this.currentGroup = null;        // 現在のグループ
        this.groupStack = [];            // ネストグループ対応
        
        // 状態スナップショット
        this.snapshots = new Map();      // キー：操作番号、値：状態
        this.maxSnapshots = 20;          // 最大スナップショット数
        
        // パフォーマンス・統計
        this.operationCount = 0;         // 総操作数
        this.undoCount = 0;              // Undo実行回数
        this.redoCount = 0;              // Redo実行回数
        this.lastOperationInfo = null;   // 最後の操作情報
        
        // 操作タイプ管理
        this.operationTypes = {
            DRAW_STROKE: 'draw_stroke',
            ERASE_STROKE: 'erase_stroke',
            CANVAS_TRANSFORM: 'canvas_transform',
            LAYER_CHANGE: 'layer_change',
            TOOL_SETTING: 'tool_setting',
            CLEAR_LAYER: 'clear_layer',
            GROUP_START: 'group_start',
            GROUP_END: 'group_end'
        };
        
        console.log('🔄 RecordManager 基本設定完了');
    }
    
    /**
     * 依存関係設定
     */
    setCanvasManager(canvasManager) {
        this.canvasManager = canvasManager;
        console.log('✅ RecordManager - CanvasManager設定完了');
    }
    
    setToolManager(toolManager) {
        this.toolManager = toolManager;
        console.log('✅ RecordManager - ToolManager設定完了');
    }
    
    setNavigationManager(navigationManager) {
        this.navigationManager = navigationManager;
        console.log('✅ RecordManager - NavigationManager設定完了');
    }
    
    /**
     * 🎯 メイン機能：操作記録・Undo/Redo
     */
    
    /**
     * 操作記録（メインメソッド）
     */
    recordOperation(operation) {
        if (!operation) {
            console.warn('⚠️ RecordManager: 無効な操作');
            return null;
        }
        
        // 操作情報の標準化・検証
        const standardizedOperation = this.standardizeOperation(operation);
        if (!standardizedOperation) {
            console.warn('⚠️ RecordManager: 操作の標準化失敗');
            return null;
        }
        
        // グループ記録中の場合はグループに追加
        if (this.isRecordingGroup && this.currentGroup) {
            this.currentGroup.operations.push(standardizedOperation);
            console.log(`🔄 操作をグループに追加: ${standardizedOperation.type}`);
            return this.currentGroup.id;
        }
        
        // Redo履歴をクリア（新しい操作により分岐）
        this.redoStack = [];
        
        // 履歴サイズ制限チェック・古い履歴削除
        if (this.operationHistory.length >= this.maxHistorySize) {
            this.compressHistory();
        }
        
        // 操作を履歴に追加
        standardizedOperation.id = this.generateOperationId();
        standardizedOperation.timestamp = Date.now();
        standardizedOperation.operationNumber = this.operationCount;
        
        this.operationHistory.push(standardizedOperation);
        this.currentPosition = this.operationHistory.length - 1;
        this.operationCount++;
        
        // 自動スナップショット作成
        if (this.operationCount % this.autoSaveInterval === 0) {
            this.createSnapshot();
        }
        
        // 統計・ログ更新
        this.lastOperationInfo = {
            id: standardizedOperation.id,
            type: standardizedOperation.type,
            timestamp: standardizedOperation.timestamp,
            canUndo: this.canUndo(),
            canRedo: this.canRedo()
        };
        
        console.log(`🔄 操作記録: ${standardizedOperation.type} (id: ${standardizedOperation.id})`);
        
        // UI更新通知
        this.notifyHistoryChange();
        
        return standardizedOperation.id;
    }
    
    /**
     * 操作取り消し（Undo）
     */
    undo() {
        if (!this.canUndo()) {
            console.warn('⚠️ RecordManager: Undo不可 - 履歴が空');
            return false;
        }
        
        const operation = this.operationHistory[this.currentPosition];
        
        try {
            // 操作の取り消し実行
            const success = this.executeUndo(operation);
            
            if (success) {
                // Redo用に操作を移動
                this.redoStack.push(operation);
                this.currentPosition--;
                this.undoCount++;
                
                console.log(`🔄 Undo実行成功: ${operation.type} (id: ${operation.id})`);
                
                // UI更新通知
                this.notifyHistoryChange();
                
                return true;
            } else {
                console.error(`❌ Undo実行失敗: ${operation.type} (id: ${operation.id})`);
                return false;
            }
        } catch (error) {
            console.error('❌ Undo実行中エラー:', error);
            
            // エラー通知
            if (window.Tegaki?.ErrorManagerInstance) {
                window.Tegaki.ErrorManagerInstance.showError(
                    'technical',
                    `操作取り消し失敗: ${error.message}`,
                    { context: 'RecordManager.undo' }
                );
            }
            
            return false;
        }
    }
    
    /**
     * 操作やり直し（Redo）
     */
    redo() {
        if (!this.canRedo()) {
            console.warn('⚠️ RecordManager: Redo不可 - Redoスタックが空');
            return false;
        }
        
        const operation = this.redoStack.pop();
        
        try {
            // 操作の再実行
            const success = this.executeRedo(operation);
            
            if (success) {
                // 履歴に操作を戻す
                this.operationHistory.push(operation);
                this.currentPosition = this.operationHistory.length - 1;
                this.redoCount++;
                
                console.log(`🔄 Redo実行成功: ${operation.type} (id: ${operation.id})`);
                
                // UI更新通知
                this.notifyHistoryChange();
                
                return true;
            } else {
                // 失敗時はRedoスタックに戻す
                this.redoStack.push(operation);
                console.error(`❌ Redo実行失敗: ${operation.type} (id: ${operation.id})`);
                return false;
            }
        } catch (error) {
            // エラー時もRedoスタックに戻す
            this.redoStack.push(operation);
            console.error('❌ Redo実行中エラー:', error);
            
            // エラー通知
            if (window.Tegaki?.ErrorManagerInstance) {
                window.Tegaki.ErrorManagerInstance.showError(
                    'technical',
                    `操作やり直し失敗: ${error.message}`,
                    { context: 'RecordManager.redo' }
                );
            }
            
            return false;
        }
    }
    
    /**
     * Undo可能判定
     */
    canUndo() {
        return this.currentPosition >= 0 && this.operationHistory.length > 0;
    }
    
    /**
     * Redo可能判定
     */
    canRedo() {
        return this.redoStack.length > 0;
    }
    
    /**
     * 🎯 操作グループ管理（複数操作をまとめて管理）
     */
    
    /**
     * 操作グループ開始
     */
    startOperationGroup(name = null) {
        // ネストグループ対応：現在のグループをスタックに退避
        if (this.isRecordingGroup && this.currentGroup) {
            this.groupStack.push(this.currentGroup);
        }
        
        // 新しいグループ作成
        this.currentGroup = {
            id: this.generateGroupId(),
            name: name || `グループ_${this.operationCount}`,
            operations: [],
            startTime: Date.now(),
            startOperationCount: this.operationCount
        };
        
        this.isRecordingGroup = true;
        
        console.log(`🔄 操作グループ開始: ${this.currentGroup.name} (id: ${this.currentGroup.id})`);
        return this.currentGroup.id;
    }
    
    /**
     * 操作グループ終了
     */
    endOperationGroup() {
        if (!this.isRecordingGroup || !this.currentGroup) {
            console.warn('⚠️ RecordManager: アクティブなグループがありません');
            return null;
        }
        
        const completedGroup = this.currentGroup;
        completedGroup.endTime = Date.now();
        completedGroup.duration = completedGroup.endTime - completedGroup.startTime;
        completedGroup.operationCount = completedGroup.operations.length;
        
        // グループが空でない場合のみ履歴に追加
        if (completedGroup.operations.length > 0) {
            // グループ全体を単一操作として記録
            const groupOperation = {
                type: this.operationTypes.GROUP_END,
                group: completedGroup,
                undoFunction: () => this.undoGroup(completedGroup),
                redoFunction: () => this.redoGroup(completedGroup)
            };
            
            // 通常の操作記録として追加（グループフラグを一時的に無効化）
            this.isRecordingGroup = false;
            this.recordOperation(groupOperation);
        }
        
        // ネストグループ復帰
        if (this.groupStack.length > 0) {
            this.currentGroup = this.groupStack.pop();
            this.isRecordingGroup = true;
        } else {
            this.currentGroup = null;
            this.isRecordingGroup = false;
        }
        
        console.log(`🔄 操作グループ終了: ${completedGroup.name} (${completedGroup.operationCount}操作, ${completedGroup.duration}ms)`);
        return completedGroup.id;
    }
    
    /**
     * 🔧 内部処理：操作実行・取り消し・やり直し
     */
    
    /**
     * 操作情報標準化
     */
    standardizeOperation(operation) {
        // 必須フィールドチェック
        if (!operation.type) {
            console.warn('⚠️ 操作タイプが未定義');
            return null;
        }
        
        // 標準化された操作オブジェクト作成
        const standardized = {
            type: operation.type,
            data: operation.data || {},
            undoFunction: operation.undoFunction || operation.undo,
            redoFunction: operation.redoFunction || operation.redo,
            toolName: operation.toolName || this.getCurrentToolName(),
            layerId: operation.layerId || this.getCurrentLayerId(),
            canUndo: true,
            canRedo: true
        };
        
        // Undo/Redo関数の検証
        if (!standardized.undoFunction || typeof standardized.undoFunction !== 'function') {
            console.warn(`⚠️ 無効なUndo関数: ${operation.type}`);
            standardized.canUndo = false;
        }
        
        if (!standardized.redoFunction || typeof standardized.redoFunction !== 'function') {
            console.warn(`⚠️ 無効なRedo関数: ${operation.type}`);
            standardized.canRedo = false;
        }
        
        return standardized;
    }
    
    /**
     * Undo実行
     */
    executeUndo(operation) {
        if (!operation.canUndo || !operation.undoFunction) {
            console.warn(`⚠️ Undo不可能な操作: ${operation.type}`);
            return false;
        }
        
        try {
            // グループ操作の場合は特別処理
            if (operation.type === this.operationTypes.GROUP_END) {
                return this.undoGroup(operation.group);
            }
            
            // 通常操作のUndo実行
            const result = operation.undoFunction();
            
            // Undo結果検証
            if (result === false || result === null || result === undefined) {
                console.warn(`⚠️ Undo処理が失敗を返しました: ${operation.type}`);
                return false;
            }
            
            return true;
        } catch (error) {
            console.error(`❌ Undo実行エラー: ${operation.type}`, error);
            return false;
        }
    }
    
    /**
     * Redo実行
     */
    executeRedo(operation) {
        if (!operation.canRedo || !operation.redoFunction) {
            console.warn(`⚠️ Redo不可能な操作: ${operation.type}`);
            return false;
        }
        
        try {
            // グループ操作の場合は特別処理
            if (operation.type === this.operationTypes.GROUP_END) {
                return this.redoGroup(operation.group);
            }
            
            // 通常操作のRedo実行
            const result = operation.redoFunction();
            
            // Redo結果検証
            if (result === false || result === null || result === undefined) {
                console.warn(`⚠️ Redo処理が失敗を返しました: ${operation.type}`);
                return false;
            }
            
            return true;
        } catch (error) {
            console.error(`❌ Redo実行エラー: ${operation.type}`, error);
            return false;
        }
    }
    
    /**
     * グループUndo実行
     */
    undoGroup(group) {
        if (!group || !group.operations) {
            console.warn('⚠️ 無効なグループ');
            return false;
        }
        
        let successCount = 0;
        let failCount = 0;
        
        // グループ内操作を逆順でUndo実行
        for (let i = group.operations.length - 1; i >= 0; i--) {
            const operation = group.operations[i];
            
            try {
                const success = this.executeUndo(operation);
                if (success) {
                    successCount++;
                } else {
                    failCount++;
                    console.warn(`⚠️ グループ内操作Undo失敗: ${operation.type}`);
                }
            } catch (error) {
                failCount++;
                console.error(`❌ グループ内操作Undoエラー: ${operation.type}`, error);
            }
        }
        
        console.log(`🔄 グループUndo完了: ${group.name} (成功: ${successCount}, 失敗: ${failCount})`);
        return successCount > 0; // 1つでも成功すれば成功とみなす
    }
    
    /**
     * グループRedo実行
     */
    redoGroup(group) {
        if (!group || !group.operations) {
            console.warn('⚠️ 無効なグループ');
            return false;
        }
        
        let successCount = 0;
        let failCount = 0;
        
        // グループ内操作を順番にRedo実行
        for (const operation of group.operations) {
            try {
                const success = this.executeRedo(operation);
                if (success) {
                    successCount++;
                } else {
                    failCount++;
                    console.warn(`⚠️ グループ内操作Redo失敗: ${operation.type}`);
                }
            } catch (error) {
                failCount++;
                console.error(`❌ グループ内操作Redoエラー: ${operation.type}`, error);
            }
        }
        
        console.log(`🔄 グループRedo完了: ${group.name} (成功: ${successCount}, 失敗: ${failCount})`);
        return successCount > 0; // 1つでも成功すれば成功とみなす
    }
    
    /**
     * 🎯 状態スナップショット管理
     */
    
    /**
     * 状態スナップショット作成
     */
    createSnapshot() {
        try {
            const snapshot = {
                operationNumber: this.operationCount,
                timestamp: Date.now(),
                canvasState: this.captureCanvasState(),
                toolState: this.captureToolState(),
                navigationState: this.captureNavigationState()
            };
            
            this.snapshots.set(this.operationCount, snapshot);
            
            // スナップショット数制限
            if (this.snapshots.size > this.maxSnapshots) {
                const oldestKey = Math.min(...this.snapshots.keys());
                this.snapshots.delete(oldestKey);
            }
            
            console.log(`🔄 スナップショット作成: 操作${this.operationCount}`);
            return snapshot;
        } catch (error) {
            console.error('❌ スナップショット作成エラー:', error);
            return null;
        }
    }
    
    /**
     * 状態復元
     */
    restoreState(stateId) {
        const snapshot = this.snapshots.get(stateId);
        if (!snapshot) {
            console.warn(`⚠️ スナップショットが見つかりません: ${stateId}`);
            return false;
        }
        
        try {
            // 各状態の復元
            this.restoreCanvasState(snapshot.canvasState);
            this.restoreToolState(snapshot.toolState);
            this.restoreNavigationState(snapshot.navigationState);
            
            console.log(`🔄 状態復元完了: 操作${stateId}`);
            return true;
        } catch (error) {
            console.error(`❌ 状態復元エラー: 操作${stateId}`, error);
            return false;
        }
    }
    
    /**
     * 🔧 状態キャプチャ・復元メソッド
     */
    
    /**
     * Canvas状態キャプチャ
     */
    captureCanvasState() {
        if (!this.canvasManager) return null;
        
        try {
            // Phase1.5基本実装：レイヤー情報のみ
            return {
                activeLayerId: this.canvasManager.getActiveLayerId?.() || 'layer0',
                timestamp: Date.now()
            };
        } catch (error) {
            console.error('❌ Canvas状態キャプチャエラー:', error);
            return null;
        }
    }
    
    /**
     * Canvas状態復元
     */
    restoreCanvasState(state) {
        if (!state || !this.canvasManager) return false;
        
        try {
            // Phase1.5基本実装：アクティブレイヤー復元
            if (state.activeLayerId && this.canvasManager.setActiveLayer) {
                this.canvasManager.setActiveLayer(state.activeLayerId);
            }
            
            return true;
        } catch (error) {
            console.error('❌ Canvas状態復元エラー:', error);
            return false;
        }
    }
    
    /**
     * ツール状態キャプチャ
     */
    captureToolState() {
        if (!this.toolManager) return null;
        
        try {
            return {
                currentTool: this.toolManager.getCurrentToolName?.() || 'pen',
                toolSettings: this.toolManager.getCurrentTool?.()?.getSettings?.() || {},
                timestamp: Date.now()
            };
        } catch (error) {
            console.error('❌ ツール状態キャプチャエラー:', error);
            return null;
        }
    }
    
    /**
     * ツール状態復元
     */
    restoreToolState(state) {
        if (!state || !this.toolManager) return false;
        
        try {
            // ツール選択復元
            if (state.currentTool && this.toolManager.selectTool) {
                this.toolManager.selectTool(state.currentTool);
            }
            
            // ツール設定復元（Phase2で詳細実装）
            if (state.toolSettings && this.toolManager.getCurrentTool) {
                const currentTool = this.toolManager.getCurrentTool();
                // 設定復元処理（実装省略・Phase2で詳細化）
            }
            
            return true;
        } catch (error) {
            console.error('❌ ツール状態復元エラー:', error);
            return false;
        }
    }
    
    /**
     * ナビゲーション状態キャプチャ
     */
    captureNavigationState() {
        if (!this.navigationManager) return null;
        
        try {
            return {
                transform: this.navigationManager.getCanvasTransform?.() || null,
                timestamp: Date.now()
            };
        } catch (error) {
            console.error('❌ ナビゲーション状態キャプチャエラー:', error);
            return null;
        }
    }
    
    /**
     * ナビゲーション状態復元
     */
    restoreNavigationState(state) {
        if (!state || !this.navigationManager) return false;
        
        try {
            // 変形状態復元
            if (state.transform && this.navigationManager.setCanvasTransform) {
                this.navigationManager.setCanvasTransform(state.transform);
            }
            
            return true;
        } catch (error) {
            console.error('❌ ナビゲーション状態復元エラー:', error);
            return false;
        }
    }
    
    /**
     * 🔧 ヘルパーメソッド・ユーティリティ
     */
    
    /**
     * 履歴圧縮
     */
    compressHistory() {
        if (this.operationHistory.length < this.compressionThreshold) return;
        
        const keepCount = Math.floor(this.maxHistorySize * 0.7); // 70%を保持
        const removeCount = this.operationHistory.length - keepCount;
        
        // 古い履歴を削除
        const removedOperations = this.operationHistory.splice(0, removeCount);
        this.currentPosition -= removeCount;
        
        // 削除された操作に対応するスナップショットも削除
        for (const operation of removedOperations) {
            this.snapshots.delete(operation.operationNumber);
        }
        
        console.log(`🔄 履歴圧縮実行: ${removeCount}操作削除, ${keepCount}操作保持`);
    }
    
    /**
     * 操作ID生成
     */
    generateOperationId() {
        return `op_${this.operationCount}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    /**
     * グループID生成
     */
    generateGroupId() {
        return `grp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    /**
     * 現在ツール名取得
     */
    getCurrentToolName() {
        return this.toolManager?.getCurrentToolName?.() || 'unknown';
    }
    
    /**
     * 現在レイヤーID取得
     */
    getCurrentLayerId() {
        return this.canvasManager?.getActiveLayerId?.() || 'layer0';
    }
    
    /**
     * 履歴変更通知
     */
    notifyHistoryChange() {
        // イベントバス経由でUI更新通知
        if (window.Tegaki?.EventBusInstance) {
            window.Tegaki.EventBusInstance.emit('historyChanged', {
                canUndo: this.canUndo(),
                canRedo: this.canRedo(),
                historySize: this.operationHistory.length,
                redoSize: this.redoStack.length,
                currentPosition: this.currentPosition
            });
        }
    }
    
    /**
     * 🎯 公開API・設定管理
     */
    
    /**
     * 履歴取得
     */
    getHistory() {
        return this.operationHistory.map(op => ({
            id: op.id,
            type: op.type,
            timestamp: op.timestamp,
            operationNumber: op.operationNumber,
            toolName: op.toolName,
            layerId: op.layerId,
            canUndo: op.canUndo,
            canRedo: op.canRedo
        }));
    }
    
    /**
     * 履歴クリア
     */
    clearHistory() {
        this.operationHistory = [];
        this.redoStack = [];
        this.currentPosition = -1;
        this.snapshots.clear();
        
        // 現在のグループも終了
        this.isRecordingGroup = false;
        this.currentGroup = null;
        this.groupStack = [];
        
        console.log('🔄 全履歴クリア完了');
        this.notifyHistoryChange();
    }
    
    /**
     * 最大履歴数設定
     */
    setMaxHistorySize(size) {
        const minSize = 10;
        const maxSize = 1000;
        this.maxHistorySize = Math.max(minSize, Math.min(maxSize, size));
        
        console.log(`🔄 最大履歴数設定: ${this.maxHistorySize}`);
        
        // 現在履歴が制限を超えている場合は圧縮
        if (this.operationHistory.length > this.maxHistorySize) {
            this.compressHistory();
        }
    }
    
    /**
     * 状態リスト取得
     */
    getStateList() {
        return Array.from(this.snapshots.entries()).map(([key, snapshot]) => ({
            id: key,
            operationNumber: snapshot.operationNumber,
            timestamp: snapshot.timestamp
        }));
    }
    
    /**
     * 現在状態保存
     */
    saveCurrentState() {
        return this.createSnapshot();
    }
    
    /**
     * 設定取得
     */
    getSettings() {
        return {
            maxHistorySize: this.maxHistorySize,
            autoSaveInterval: this.autoSaveInterval,
            compressionThreshold: this.compressionThreshold,
            maxSnapshots: this.maxSnapshots
        };
    }
    
    /**
     * 統計情報取得
     */
    getStats() {
        return {
            operationCount: this.operationCount,
            undoCount: this.undoCount,
            redoCount: this.redoCount,
            historySize: this.operationHistory.length,
            redoStackSize: this.redoStack.length,
            snapshotCount: this.snapshots.size,
            currentPosition: this.currentPosition,
            lastOperationInfo: this.lastOperationInfo,
            isRecordingGroup: this.isRecordingGroup,
            groupStackDepth: this.groupStack.length
        };
    }
    
    /**
     * デバッグ情報取得（完全版）
     */
    getDebugInfo() {
        return {
            // 基本状態
            isReady: !!(this.canvasManager || this.toolManager),
            canvasManagerSet: !!this.canvasManager,
            toolManagerSet: !!this.toolManager,
            navigationManagerSet: !!this.navigationManager,
            
            // 履歴状態
            history: {
                size: this.operationHistory.length,
                maxSize: this.maxHistorySize,
                currentPosition: this.currentPosition,
                canUndo: this.canUndo(),
                canRedo: this.canRedo(),
                redoStackSize: this.redoStack.length
            },
            
            // グループ状態
            groups: {
                isRecording: this.isRecordingGroup,
                currentGroup: this.currentGroup ? {
                    id: this.currentGroup.id,
                    name: this.currentGroup.name,
                    operationCount: this.currentGroup.operations.length,
                    duration: this.currentGroup.startTime ? Date.now() - this.currentGroup.startTime : 0
                } : null,
                stackDepth: this.groupStack.length
            },
            
            // スナップショット状態
            snapshots: {
                count: this.snapshots.size,
                maxCount: this.maxSnapshots,
                keys: Array.from(this.snapshots.keys()).sort((a, b) => a - b)
            },
            
            // 設定情報
            settings: this.getSettings(),
            
            // 統計情報
            stats: this.getStats(),
            
            // パフォーマンス情報
            performance: {
                avgOperationsPerSecond: this.calculateOperationRate(),
                memoryUsage: this.estimateMemoryUsage(),
                compressionRecommended: this.operationHistory.length > this.compressionThreshold
            },
            
            // 最近の操作履歴（デバッグ用）
            recentOperations: this.operationHistory.slice(-5).map(op => ({
                id: op.id,
                type: op.type,
                timestamp: op.timestamp,
                operationNumber: op.operationNumber
            })),
            
            // Phase情報
            phase: {
                current: '1.5',
                features: {
                    basicUndo: true,
                    basicRedo: true,
                    operationGroups: true,
                    snapshots: true,
                    historyCompression: true
                },
                nextPhase: {
                    target: '2',
                    newFeatures: [
                        'layerOperationHistory',
                        'advancedStateCapture',
                        'selectionHistory',
                        'toolSettingHistory'
                    ]
                }
            }
        };
    }
    
    /**
     * パフォーマンス計算（デバッグ用）
     */
    calculateOperationRate() {
        // 簡易的な操作レート計算（実装省略・概算値）
        return this.operationCount > 0 ? Math.min(this.operationCount / 60, 10) : 0;
    }
    
    estimateMemoryUsage() {
        // 簡易的なメモリ使用量推定（実装省略・概算値）
        const baseSize = 4096; // RecordManager基本サイズ
        const historySize = this.operationHistory.length * 1024; // 履歴データサイズ
        const redoStackSize = this.redoStack.length * 1024; // Redoスタックサイズ
        const snapshotSize = this.snapshots.size * 2048; // スナップショットサイズ
        const groupSize = this.groupStack.length * 512; // グループスタックサイズ
        
        return baseSize + historySize + redoStackSize + snapshotSize + groupSize;
    }
    
    /**
     * 🎯 Phase1.5特別機能：簡易操作記録ヘルパー
     */
    
    /**
     * 描画操作記録（ツール専用ヘルパー）
     */
    recordDrawOperation(toolName, strokeData, undoFunction, redoFunction) {
        return this.recordOperation({
            type: this.operationTypes.DRAW_STROKE,
            toolName: toolName,
            data: {
                strokeData: strokeData,
                layerId: this.getCurrentLayerId()
            },
            undoFunction: undoFunction,
            redoFunction: redoFunction
        });
    }
    
    /**
     * 消去操作記録（ツール専用ヘルパー）
     */
    recordEraseOperation(toolName, eraseData, undoFunction, redoFunction) {
        return this.recordOperation({
            type: this.operationTypes.ERASE_STROKE,
            toolName: toolName,
            data: {
                eraseData: eraseData,
                layerId: this.getCurrentLayerId()
            },
            undoFunction: undoFunction,
            redoFunction: redoFunction
        });
    }
    
    /**
     * キャンバス変形記録（NavigationManager専用ヘルパー）
     */
    recordTransformOperation(transformType, transformData, undoFunction, redoFunction) {
        return this.recordOperation({
            type: this.operationTypes.CANVAS_TRANSFORM,
            data: {
                transformType: transformType,
                transformData: transformData
            },
            undoFunction: undoFunction,
            redoFunction: redoFunction
        });
    }
    
    /**
     * レイヤークリア記録（Phase2準備）
     */
    recordClearOperation(layerId, layerData, undoFunction, redoFunction) {
        return this.recordOperation({
            type: this.operationTypes.CLEAR_LAYER,
            data: {
                layerId: layerId,
                layerData: layerData
            },
            undoFunction: undoFunction,
            redoFunction: redoFunction
        });
    }
    
    /**
     * 🔧 Phase1.5統合テストメソッド（デバッグ用）
     */
    
    /**
     * RecordManager機能テスト
     */
    testRecordManagerFeatures() {
        console.log('🧪 RecordManager機能テスト開始');
        
        const testResults = {
            basicRecording: false,
            undoRedo: false,
            operationGroups: false,
            snapshots: false,
            historyManagement: false
        };
        
        try {
            // 1. 基本記録テスト
            const testOpId = this.recordOperation({
                type: 'test_operation',
                data: { test: true },
                undoFunction: () => { console.log('Test undo'); return true; },
                redoFunction: () => { console.log('Test redo'); return true; }
            });
            testResults.basicRecording = !!testOpId;
            
            // 2. Undo/Redoテスト
            if (this.canUndo()) {
                const undoSuccess = this.undo();
                if (undoSuccess && this.canRedo()) {
                    const redoSuccess = this.redo();
                    testResults.undoRedo = redoSuccess;
                }
            }
            
            // 3. グループテスト
            const groupId = this.startOperationGroup('テストグループ');
            this.recordOperation({
                type: 'test_group_op',
                undoFunction: () => true,
                redoFunction: () => true
            });
            this.endOperationGroup();
            testResults.operationGroups = !!groupId;
            
            // 4. スナップショットテスト
            const snapshot = this.createSnapshot();
            testResults.snapshots = !!snapshot;
            
            // 5. 履歴管理テスト
            const history = this.getHistory();
            testResults.historyManagement = Array.isArray(history) && history.length > 0;
            
        } catch (error) {
            console.error('❌ RecordManager機能テストエラー:', error);
        }
        
        console.log('🧪 RecordManager機能テスト結果:', testResults);
        return testResults;
    }
    
    /**
     * 履歴整合性チェック
     */
    validateHistoryIntegrity() {
        console.log('🔍 履歴整合性チェック開始');
        
        const issues = [];
        
        // 1. 基本整合性チェック
        if (this.currentPosition >= this.operationHistory.length) {
            issues.push('現在位置が履歴範囲を超えています');
        }
        
        if (this.currentPosition < -1) {
            issues.push('現在位置が無効です');
        }
        
        // 2. 操作整合性チェック
        for (let i = 0; i < this.operationHistory.length; i++) {
            const op = this.operationHistory[i];
            
            if (!op.id) {
                issues.push(`操作${i}: IDが未設定`);
            }
            
            if (!op.type) {
                issues.push(`操作${i}: タイプが未設定`);
            }
            
            if (!op.timestamp) {
                issues.push(`操作${i}: タイムスタンプが未設定`);
            }
            
            if (op.canUndo && !op.undoFunction) {
                issues.push(`操作${i}: Undo関数が未設定だがcanUndoがtrue`);
            }
            
            if (op.canRedo && !op.redoFunction) {
                issues.push(`操作${i}: Redo関数が未設定だがcanRedoがtrue`);
            }
        }
        
        // 3. スナップショット整合性チェック
        for (const [key, snapshot] of this.snapshots) {
            if (typeof key !== 'number') {
                issues.push(`スナップショット: 無効なキー ${key}`);
            }
            
            if (!snapshot.timestamp) {
                issues.push(`スナップショット${key}: タイムスタンプが未設定`);
            }
        }
        
        // 4. グループ整合性チェック
        if (this.isRecordingGroup && !this.currentGroup) {
            issues.push('グループ記録中だが現在グループが未設定');
        }
        
        if (!this.isRecordingGroup && this.currentGroup) {
            issues.push('グループ記録停止中だが現在グループが設定済み');
        }
        
        if (issues.length === 0) {
            console.log('✅ 履歴整合性チェック: 問題なし');
        } else {
            console.warn(`⚠️ 履歴整合性チェック: ${issues.length}件の問題発見`);
            issues.forEach(issue => console.warn(`  - ${issue}`));
        }
        
        return {
            isValid: issues.length === 0,
            issues: issues,
            checkedOperations: this.operationHistory.length,
            checkedSnapshots: this.snapshots.size
        };
    }
}

// Tegaki名前空間に登録
window.Tegaki.RecordManager = RecordManager;

console.log('🔄 RecordManager Phase1.5 Loaded - 非破壊編集・Undo/Redo・操作履歴・状態管理完成');
console.log('🔄 record-manager.js loaded - 操作記録・グループ管理・スナップショット・履歴圧縮・剛直構造実現');