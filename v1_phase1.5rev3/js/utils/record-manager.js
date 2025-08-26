/**
 * 🔄 RecordManager - 操作履歴・非破壊編集システム（Phase1.5スタブ版）
 * 📋 RESPONSIBILITY: Undo/Redo・操作記録・状態管理・履歴管理
 * 🚫 PROHIBITION: 描画処理・UI操作・ツール管理
 * ✅ PERMISSION: 操作履歴・状態保存・Undo/Redo・非破壊編集
 * 
 * 📏 DESIGN_PRINCIPLE: 非破壊編集・操作の可逆性・メモリ効率・段階的実装
 * 🔄 INTEGRATION: 全ツール・UI・キーボードショートカット連携
 * 🎯 Phase1.5: 基本Undo/Redo・操作記録基盤（詳細実装は後続Phase1.5で完成）
 */

// Tegaki名前空間初期化
window.Tegaki = window.Tegaki || {};

/**
 * RecordManager - 操作履歴・非破壊編集システム（スタブ版）
 * Phase1.5で段階的に実装予定・現在は基本構造のみ
 */
class RecordManager {
    constructor() {
        console.log('🔄 RecordManager Phase1.5 スタブ版 - 基本クラス定義のみ');
        
        // 基本状態
        this.isInitialized = false;
        this.maxHistorySize = 100; // 最大履歴数
        
        // 操作履歴
        this.operationHistory = [];
        this.currentHistoryIndex = -1;
        
        // 操作グループ（複数操作をまとめる）
        this.currentOperationGroup = null;
        this.operationGroupStack = [];
        
        // 状態スナップショット
        this.stateSnapshots = new Map();
        this.nextSnapshotId = 0;
        
        // 統計情報
        this.totalOperations = 0;
        this.undoCount = 0;
        this.redoCount = 0;
        
        console.log('🔄 RecordManager スタブ作成完了 - Phase1.5で詳細実装予定');
    }
    
    /**
     * 初期化
     */
    initialize(options = {}) {
        this.maxHistorySize = options.maxHistorySize || this.maxHistorySize;
        this.isInitialized = true;
        
        console.log(`🔄 RecordManager 初期化完了 - 履歴上限: ${this.maxHistorySize}操作`);
        return true;
    }
    
    /**
     * 操作記録（メイン機能・スタブ）
     */
    recordOperation(operation) {
        if (!this.isInitialized) {
            console.warn('⚠️ RecordManager not initialized');
            return false;
        }
        
        if (!operation || typeof operation !== 'object') {
            console.warn('⚠️ Invalid operation object');
            return false;
        }
        
        // 基本操作構造の検証
        const operationRecord = {
            id: this.generateOperationId(),
            type: operation.type || 'unknown',
            tool: operation.tool || 'unknown',
            timestamp: Date.now(),
            data: operation.data || {},
            undoFunction: operation.undo || null,
            redoFunction: operation.redo || null,
            canUndo: typeof operation.undo === 'function'
        };
        
        // 現在位置より後の履歴を削除（新しい操作による分岐）
        if (this.currentHistoryIndex < this.operationHistory.length - 1) {
            this.operationHistory.splice(this.currentHistoryIndex + 1);
        }
        
        // 履歴に追加
        this.operationHistory.push(operationRecord);
        this.currentHistoryIndex++;
        
        // 履歴サイズ制限
        if (this.operationHistory.length > this.maxHistorySize) {
            this.operationHistory.shift();
            this.currentHistoryIndex--;
        }
        
        this.totalOperations++;
        
        console.log(`🔄 操作記録（スタブ）: ${operationRecord.type} [${operationRecord.id}]`);
        return operationRecord.id;
    }
    
    /**
     * Undo実行（スタブ）
     */
    undo() {
        if (!this.isInitialized) {
            console.warn('⚠️ RecordManager not initialized');
            return false;
        }
        
        if (!this.canUndo()) {
            console.warn('⚠️ Undo不可能');
            return false;
        }
        
        const operation = this.operationHistory[this.currentHistoryIndex];
        
        try {
            // Undo関数実行
            if (operation.undoFunction && typeof operation.undoFunction === 'function') {
                const result = operation.undoFunction();
                
                this.currentHistoryIndex--;
                this.undoCount++;
                
                console.log(`🔄 Undo実行（スタブ）: ${operation.type} [${operation.id}]`);
                return result;
            } else {
                console.warn(`⚠️ Undo関数未定義: ${operation.type}`);
                return false;
            }
        } catch (error) {
            console.error('💀 Undo実行エラー:', error);
            return false;
        }
    }
    
    /**
     * Redo実行（スタブ）
     */
    redo() {
        if (!this.isInitialized) {
            console.warn('⚠️ RecordManager not initialized');
            return false;
        }
        
        if (!this.canRedo()) {
            console.warn('⚠️ Redo不可能');
            return false;
        }
        
        const operation = this.operationHistory[this.currentHistoryIndex + 1];
        
        try {
            // Redo関数実行
            if (operation.redoFunction && typeof operation.redoFunction === 'function') {
                const result = operation.redoFunction();
                
                this.currentHistoryIndex++;
                this.redoCount++;
                
                console.log(`🔄 Redo実行（スタブ）: ${operation.type} [${operation.id}]`);
                return result;
            } else {
                console.warn(`⚠️ Redo関数未定義: ${operation.type}`);
                return false;
            }
        } catch (error) {
            console.error('💀 Redo実行エラー:', error);
            return false;
        }
    }
    
    /**
     * Undo可能判定
     */
    canUndo() {
        return this.currentHistoryIndex >= 0 && 
               this.currentHistoryIndex < this.operationHistory.length;
    }
    
    /**
     * Redo可能判定
     */
    canRedo() {
        return this.currentHistoryIndex < this.operationHistory.length - 1;
    }
    
    /**
     * 操作履歴取得
     */
    getHistory() {
        return {
            operations: this.operationHistory.map(op => ({
                id: op.id,
                type: op.type,
                tool: op.tool,
                timestamp: op.timestamp,
                canUndo: op.canUndo
            })),
            currentIndex: this.currentHistoryIndex,
            canUndo: this.canUndo(),
            canRedo: this.canRedo()
        };
    }
    
    /**
     * 履歴クリア
     */
    clearHistory() {
        this.operationHistory = [];
        this.currentHistoryIndex = -1;
        this.stateSnapshots.clear();
        
        console.log('🔄 履歴クリア（スタブ）');
        return true;
    }
    
    /**
     * 操作グループ開始（スタブ・Phase1.5詳細実装予定）
     */
    startOperationGroup(groupName) {
        const group = {
            name: groupName || `Group_${Date.now()}`,
            startIndex: this.operationHistory.length,
            operations: []
        };
        
        this.operationGroupStack.push(group);
        this.currentOperationGroup = group;
        
        console.log(`🔄 操作グループ開始（スタブ）: ${group.name}`);
        return group.name;
    }
    
    /**
     * 操作グループ終了（スタブ・Phase1.5詳細実装予定）
     */
    endOperationGroup() {
        if (!this.currentOperationGroup) {
            console.warn('⚠️ 開始されていない操作グループの終了');
            return false;
        }
        
        const group = this.operationGroupStack.pop();
        this.currentOperationGroup = this.operationGroupStack.length > 0 ? 
                                   this.operationGroupStack[this.operationGroupStack.length - 1] : null;
        
        console.log(`🔄 操作グループ終了（スタブ）: ${group.name} - ${group.operations.length}操作`);
        return group;
    }
    
    /**
     * 現在状態保存（スナップショット・スタブ）
     */
    saveCurrentState() {
        const snapshotId = this.nextSnapshotId++;
        const snapshot = {
            id: snapshotId,
            timestamp: Date.now(),
            historyIndex: this.currentHistoryIndex,
            operationCount: this.operationHistory.length,
            // Phase1.5で実際の状態データを保存
            data: null // スタブ
        };
        
        this.stateSnapshots.set(snapshotId, snapshot);
        
        console.log(`🔄 状態保存（スタブ）: ID ${snapshotId}`);
        return snapshotId;
    }
    
    /**
     * 状態復元（スナップショット・スタブ）
     */
    restoreState(stateId) {
        const snapshot = this.stateSnapshots.get(stateId);
        
        if (!snapshot) {
            console.warn(`⚠️ 無効な状態ID: ${stateId}`);
            return false;
        }
        
        // スタブ：実際の復元処理はPhase1.5で実装
        console.log(`🔄 状態復元（スタブ）: ID ${stateId}`);
        return true;
    }
    
    /**
     * 保存状態一覧取得
     */
    getStateList() {
        return Array.from(this.stateSnapshots.values()).map(snapshot => ({
            id: snapshot.id,
            timestamp: snapshot.timestamp,
            operationCount: snapshot.operationCount
        }));
    }
    
    /**
     * 最大履歴サイズ設定
     */
    setMaxHistorySize(size) {
        const minSize = 10;
        const maxSize = 1000;
        
        this.maxHistorySize = Math.max(minSize, Math.min(maxSize, size));
        
        // 現在の履歴がサイズを超えている場合は調整
        if (this.operationHistory.length > this.maxHistorySize) {
            const removeCount = this.operationHistory.length - this.maxHistorySize;
            this.operationHistory.splice(0, removeCount);
            this.currentHistoryIndex -= removeCount;
        }
        
        console.log(`🔄 最大履歴サイズ設定: ${this.maxHistorySize}操作`);
        return true;
    }
    
    /**
     * 操作ID生成
     */
    generateOperationId() {
        return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    /**
     * デバッグ情報取得
     */
    getDebugInfo() {
        return {
            // 基本状態
            isInitialized: this.isInitialized,
            maxHistorySize: this.maxHistorySize,
            
            // 履歴状態
            operationCount: this.operationHistory.length,
            currentIndex: this.currentHistoryIndex,
            canUndo: this.canUndo(),
            canRedo: this.canRedo(),
            
            // 統計
            stats: {
                totalOperations: this.totalOperations,
                undoCount: this.undoCount,
                redoCount: this.redoCount
            },
            
            // グループ
            currentGroup: this.currentOperationGroup?.name || null,
            groupStackDepth: this.operationGroupStack.length,
            
            // スナップショット
            snapshotCount: this.stateSnapshots.size,
            
            // Phase情報
            phase: {
                current: '1.5',
                implementationStatus: 'stub', // スタブ実装
                features: {
                    basicUndo: true,
                    basicRedo: true,
                    operationRecord: true,
                    operationGroups: 'stub',
                    stateSnapshots: 'stub',
                    advancedHistory: false // Phase2で実装
                }
            }
        };
    }
    
    /**
     * Phase1.5準備完了判定
     */
    isReadyForPhase15() {
        return this.isInitialized;
    }
    
    /**
     * Phase2準備機能（将来実装用プレースホルダー）
     */
    enableAdvancedHistory() {
        console.log('🔄 高度履歴機能（Phase2で実装予定）');
        return false; // Phase2で実装
    }
    
    setHistoryCompression(enabled) {
        console.log('🔄 履歴圧縮設定（Phase2で実装予定）');
        return false; // Phase2で実装
    }
    
    enableAutoSave() {
        console.log('🔄 自動保存機能（Phase2で実装予定）');
        return false; // Phase2で実装
    }
}

// Tegaki名前空間に登録
window.Tegaki.RecordManager = RecordManager;

console.log('🔄 RecordManager Phase1.5 Loaded - スタブ版・Undo/Redo基盤準備完了');
console.log('🔄 record-manager.js loaded - Phase1.5基本クラス・非破壊編集基盤準備');