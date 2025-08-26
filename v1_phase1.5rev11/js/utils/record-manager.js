/**
 * 🔄 RecordManager Phase1.5 実用実装版 - Undo/Redo・操作履歴・非破壊編集
 * 
 * 📋 使用メソッド一覧（依存確認済み ✅）
 * - Array.prototype.push() - JavaScript標準配列操作
 * - Array.prototype.pop() - JavaScript標準配列操作
 * - Map.set() / Map.get() - JavaScript標準Map操作
 * - Date.now() - JavaScript標準時刻取得
 * - Math.random() - JavaScript標準乱数生成
 * - canvasManager.addGraphicsToLayer() - CanvasManager標準メソッド（再描画用）
 * - canvasManager.removeGraphicsFromLayer() - CanvasManager標準メソッド（削除用）
 * 
 * 📋 RESPONSIBILITY: 操作履歴管理・Undo/Redo機能・非破壊編集基盤
 * 🚫 PROHIBITION: 直接描画・UI通知・座標変換・フォールバック処理
 * ✅ PERMISSION: 操作記録・履歴管理・Graphics操作・ツール連携
 * 
 * 📏 DESIGN_PRINCIPLE: スタック型履歴・非破壊編集・操作原子性・メモリ効率
 * 🔄 INTEGRATION: AbstractTool連携・CanvasManager連携・Phase1.5統合
 * 
 * 🔄 RECORD_FLOW: 操作記録の流れ
 * 1. Tool.onPointerDown → RecordManager.startOperation() → 操作開始記録
 * 2. Tool描画処理 → RecordManager記録（並行処理・ブロックしない）
 * 3. Tool.onPointerUp → RecordManager.endOperation() → 操作完了・履歴保存
 * 4. Undo要求 → RecordManager.undo() → Graphics削除・undoStackに移動
 * 5. Redo要求 → RecordManager.redo() → Graphics復元・redoStackから戻し
 */

// Tegaki名前空間初期化
window.Tegaki = window.Tegaki || {};

if (!window.Tegaki.RecordManager) {
    /**
     * RecordManager - Phase1.5 実用実装版
     * 操作履歴管理・Undo/Redo機能・非破壊編集を提供
     */
    class RecordManager {
        constructor() {
            console.log('🔄 RecordManager Phase1.5 実用実装版 - 初期化開始');
            
            // 履歴スタック
            this.operationHistory = [];     // 完了操作履歴（メイン）
            this.undoStack = [];            // Undo用スタック
            this.redoStack = [];            // Redo用スタック
            
            // 進行中操作管理
            this.activeOperations = new Map();  // 進行中操作（ID -> Operation）
            this.operationCounter = 0;           // 操作ID生成用
            
            // 設定
            this.maxHistorySize = 50;       // 最大履歴保持数
            this.autoCleanupThreshold = 100; // 自動クリーンアップ閾値
            
            // Manager連携
            this.canvasManager = null;
            this.eventBus = null;
            
            this.initialized = true;
            console.log('🔄 RecordManager 実用実装完了');
        }
        
        /**
         * CanvasManager設定（Graphics操作用）
         */
        setCanvasManager(canvasManager) {
            this.canvasManager = canvasManager;
            console.log('🔄 RecordManager - CanvasManager設定完了');
        }
        
        /**
         * EventBus設定（イベント配信用）
         */
        setEventBus(eventBus) {
            this.eventBus = eventBus;
            console.log('🔄 RecordManager - EventBus設定完了');
        }
        
        /**
         * 🎯 操作開始記録（Tool → RecordManager）
         * 
         * @param {Object} operationData - 操作データ
         * @param {string} operationData.tool - ツール名
         * @param {string} operationData.type - 操作タイプ
         * @param {Object} operationData.data - 操作固有データ
         * @returns {Object} 操作オブジェクト（継続参照用）
         */
        startOperation(operationData) {
            if (!operationData || !operationData.tool || !operationData.type) {
                console.warn('⚠️ Invalid operation data:', operationData);
                return null;
            }
            
            // 操作ID生成
            const operationId = `op_${Date.now()}_${this.operationCounter++}`;
            
            // 操作オブジェクト作成
            const operation = {
                id: operationId,
                tool: operationData.tool,
                type: operationData.type,
                data: operationData.data || {},
                startTime: Date.now(),
                endTime: null,
                completed: false,
                graphics: null,     // Graphics参照（Tool側で設定）
                metadata: {
                    version: '1.5',
                    canUndo: true,
                    canRedo: true
                }
            };
            
            // 進行中操作として記録
            this.activeOperations.set(operationId, operation);
            
            console.log(`🔄 RecordManager 操作開始記録: ${operationData.tool} - Phase1.5実用版`);
            
            // EventBus通知（任意）
            if (this.eventBus) {
                try {
                    this.eventBus.emit('operation:start', operation);
                } catch (error) {
                    console.warn('⚠️ EventBus通知失敗:', error.message);
                }
            }
            
            return operation;
        }
        
        /**
         * 🎯 操作終了記録（Tool → RecordManager）
         * 
         * @param {string} operationId - 操作ID
         * @param {Object} endData - 終了データ
         * @param {boolean} endData.success - 操作成功フラグ
         * @param {PIXI.Graphics} endData.graphics - 作成されたGraphics
         * @param {Object} endData.strokeData - ストロークデータ（任意）
         */
        endOperation(operationId, endData = {}) {
            if (!operationId) {
                console.warn('⚠️ Invalid operation ID');
                return;
            }
            
            const operation = this.activeOperations.get(operationId);
            if (!operation) {
                console.warn(`⚠️ Operation not found: ${operationId}`);
                return;
            }
            
            // 操作完了処理
            operation.endTime = Date.now();
            operation.completed = true;
            operation.success = endData.success !== false; // デフォルトtrue
            
            // Graphics設定
            if (endData.graphics) {
                operation.graphics = endData.graphics;
            }
            
            // 追加データ設定
            if (endData.strokeData) {
                operation.strokeData = endData.strokeData;
            }
            
            // 進行中操作から削除
            this.activeOperations.delete(operationId);
            
            // 成功した操作のみ履歴に追加
            if (operation.success) {
                this.addToHistory(operation);
            }
            
            console.log(`✅ 操作完了記録: ${operation.tool}・${operation.type} (${operation.endTime - operation.startTime}ms)`);
            
            // EventBus通知（任意）
            if (this.eventBus) {
                try {
                    this.eventBus.emit('operation:end', operation);
                } catch (error) {
                    console.warn('⚠️ EventBus通知失敗:', error.message);
                }
            }
            
            // 自動クリーンアップ
            this.autoCleanup();
        }
        
        /**
         * 履歴追加（内部処理）
         */
        addToHistory(operation) {
            // Redo履歴をクリア（新しい操作が行われたため）
            this.redoStack = [];
            
            // 履歴に追加
            this.operationHistory.push(operation);
            
            // 履歴サイズ制限
            if (this.operationHistory.length > this.maxHistorySize) {
                const removed = this.operationHistory.shift();
                console.log(`🧹 古い履歴削除: ${removed.id}`);
                
                // Graphics削除（メモリ節約）
                if (removed.graphics && this.canvasManager) {
                    try {
                        this.canvasManager.removeGraphicsFromLayer(removed.graphics);
                    } catch (error) {
                        console.warn('⚠️ 古い履歴Graphics削除失敗:', error.message);
                    }
                }
            }
            
            console.log(`📚 履歴追加: ${operation.id} (総履歴: ${this.operationHistory.length})`);
        }
        
        /**
         * 🔄 Undo実行（UI → RecordManager）
         * 
         * @returns {boolean} Undo実行成功フラグ
         */
        undo() {
            if (this.operationHistory.length === 0) {
                console.log('📝 Undo: 履歴なし');
                return false;
            }
            
            const operation = this.operationHistory.pop();
            
            console.log(`↶ Undo実行: ${operation.tool}・${operation.type} (${operation.id})`);
            
            // Graphics削除（Canvas表示から削除）
            if (operation.graphics && this.canvasManager) {
                try {
                    this.canvasManager.removeGraphicsFromLayer(operation.graphics);
                    console.log('🗑️ Undo: Graphics削除完了');
                } catch (error) {
                    console.error('❌ Undo: Graphics削除失敗:', error);
                    // 削除失敗でもUndoは続行
                }
            }
            
            // Tool側のUndo処理呼び出し（任意）
            if (operation.tool && window.Tegaki?.ToolManagerInstance) {
                const toolManager = window.Tegaki.ToolManagerInstance;
                const tool = toolManager.getTool(operation.tool);
                
                if (tool && typeof tool.onUndo === 'function') {
                    try {
                        tool.onUndo(operation);
                        console.log(`🔧 ${operation.tool}Tool.onUndo() 実行完了`);
                    } catch (error) {
                        console.warn(`⚠️ ${operation.tool}Tool.onUndo() 実行失敗:`, error.message);
                    }
                }
            }
            
            // UndoStackに移動
            this.undoStack.push(operation);
            
            // EventBus通知
            if (this.eventBus) {
                try {
                    this.eventBus.emit('operation:undo', operation);
                } catch (error) {
                    console.warn('⚠️ EventBus通知失敗:', error.message);
                }
            }
            
            console.log(`✅ Undo完了: 履歴=${this.operationHistory.length}, Undo Stack=${this.undoStack.length}`);
            return true;
        }
        
        /**
         * 🔄 Redo実行（UI → RecordManager）
         * 
         * @returns {boolean} Redo実行成功フラグ
         */
        redo() {
            if (this.undoStack.length === 0) {
                console.log('📝 Redo: Undoスタック空');
                return false;
            }
            
            const operation = this.undoStack.pop();
            
            console.log(`↷ Redo実行: ${operation.tool}・${operation.type} (${operation.id})`);
            
            // Graphics復元（Canvas表示に追加）
            if (operation.graphics && this.canvasManager) {
                try {
                    this.canvasManager.addGraphicsToLayer(
                        operation.graphics, 
                        operation.data?.layerId
                    );
                    console.log('📥 Redo: Graphics復元完了');
                } catch (error) {
                    console.error('❌ Redo: Graphics復元失敗:', error);
                    // 復元失敗でもRedoは続行
                }
            }
            
            // Tool側のRedo処理呼び出し（任意）
            if (operation.tool && window.Tegaki?.ToolManagerInstance) {
                const toolManager = window.Tegaki.ToolManagerInstance;
                const tool = toolManager.getTool(operation.tool);
                
                if (tool && typeof tool.onRedo === 'function') {
                    try {
                        tool.onRedo(operation);
                        console.log(`🔧 ${operation.tool}Tool.onRedo() 実行完了`);
                    } catch (error) {
                        console.warn(`⚠️ ${operation.tool}Tool.onRedo() 実行失敗:`, error.message);
                    }
                }
            }
            
            // 履歴に戻す
            this.operationHistory.push(operation);
            
            // EventBus通知
            if (this.eventBus) {
                try {
                    this.eventBus.emit('operation:redo', operation);
                } catch (error) {
                    console.warn('⚠️ EventBus通知失敗:', error.message);
                }
            }
            
            console.log(`✅ Redo完了: 履歴=${this.operationHistory.length}, Undo Stack=${this.undoStack.length}`);
            return true;
        }
        
        /**
         * Undo可能判定
         */
        canUndo() {
            return this.operationHistory.length > 0;
        }
        
        /**
         * Redo可能判定
         */
        canRedo() {
            return this.undoStack.length > 0;
        }
        
        /**
         * 操作強制終了（Tool切り替え時など）
         */
        forceEndOperation(operationId) {
            const operation = this.activeOperations.get(operationId);
            if (!operation) return;
            
            console.log(`⚠️ 操作強制終了: ${operation.tool}・${operation.type}`);
            
            // Tool側の強制終了処理
            if (operation.tool && window.Tegaki?.ToolManagerInstance) {
                const toolManager = window.Tegaki.ToolManagerInstance;
                const tool = toolManager.getTool(operation.tool);
                
                if (tool && typeof tool.onOperationForceEnd === 'function') {
                    try {
                        tool.onOperationForceEnd(operation);
                        console.log(`🔧 ${operation.tool}Tool.onOperationForceEnd() 実行完了`);
                    } catch (error) {
                        console.warn(`⚠️ ${operation.tool}Tool.onOperationForceEnd() 失敗:`, error.message);
                    }
                }
            }
            
            // 進行中操作から削除（履歴には追加しない）
            this.activeOperations.delete(operationId);
        }
        
        /**
         * 全進行中操作強制終了
         */
        forceEndAllOperations() {
            const activeIds = Array.from(this.activeOperations.keys());
            console.log(`⚠️ 全操作強制終了: ${activeIds.length}個の操作`);
            
            activeIds.forEach(id => this.forceEndOperation(id));
        }
        
        /**
         * 履歴クリア
         */
        clearHistory() {
            console.log(`🧹 履歴クリア開始: 履歴=${this.operationHistory.length}, Undo=${this.undoStack.length}, Redo=${this.redoStack.length}`);
            
            // 全Graphicsをクリーンアップ
            const allOperations = [
                ...this.operationHistory,
                ...this.undoStack,
                ...this.redoStack
            ];
            
            let cleanupCount = 0;
            allOperations.forEach(operation => {
                if (operation.graphics && this.canvasManager) {
                    try {
                        this.canvasManager.removeGraphicsFromLayer(operation.graphics);
                        cleanupCount++;
                    } catch (error) {
                        console.warn(`⚠️ Graphics削除失敗: ${operation.id}`, error.message);
                    }
                }
            });
            
            // 履歴スタッククリア
            this.operationHistory = [];
            this.undoStack = [];
            this.redoStack = [];
            
            // 進行中操作も強制終了
            this.forceEndAllOperations();
            
            console.log(`✅ 履歴クリア完了: ${cleanupCount}個のGraphics削除`);
            
            // EventBus通知
            if (this.eventBus) {
                try {
                    this.eventBus.emit('history:clear', { cleanupCount });
                } catch (error) {
                    console.warn('⚠️ EventBus通知失敗:', error.message);
                }
            }
        }
        
        /**
         * 自動クリーンアップ（メモリ管理）
         */
        autoCleanup() {
            const totalOperations = this.operationHistory.length + 
                                  this.undoStack.length + 
                                  this.redoStack.length;
            
            if (totalOperations > this.autoCleanupThreshold) {
                console.log(`🧹 自動クリーンアップ実行: ${totalOperations}個の操作`);
                
                // 古い操作から削除（履歴の先頭から）
                const cleanupCount = Math.floor(this.autoCleanupThreshold * 0.2); // 20%削除
                
                for (let i = 0; i < cleanupCount && this.operationHistory.length > 0; i++) {
                    const removed = this.operationHistory.shift();
                    
                    if (removed.graphics && this.canvasManager) {
                        try {
                            this.canvasManager.removeGraphicsFromLayer(removed.graphics);
                        } catch (error) {
                            console.warn(`⚠️ 自動クリーンアップGraphics削除失敗:`, error.message);
                        }
                    }
                }
                
                console.log(`✅ 自動クリーンアップ完了: ${cleanupCount}個削除`);
            }
        }
        
        /**
         * 履歴統計取得
         */
        getHistoryStats() {
            const toolStats = {};
            const typeStats = {};
            
            this.operationHistory.forEach(op => {
                toolStats[op.tool] = (toolStats[op.tool] || 0) + 1;
                typeStats[op.type] = (typeStats[op.type] || 0) + 1;
            });
            
            return {
                totalOperations: this.operationHistory.length,
                undoAvailable: this.undoStack.length,
                redoAvailable: this.redoStack.length,
                activeOperations: this.activeOperations.size,
                toolStats,
                typeStats,
                memoryUsage: {
                    historyMB: this.estimateHistoryMemory(),
                    maxHistorySize: this.maxHistorySize,
                    autoCleanupThreshold: this.autoCleanupThreshold
                }
            };
        }
        
        /**
         * メモリ使用量推定（概算）
         */
        estimateHistoryMemory() {
            let totalSize = 0;
            
            const allOperations = [
                ...this.operationHistory,
                ...this.undoStack,
                ...this.redoStack
            ];
            
            allOperations.forEach(operation => {
                // 基本操作データ
                totalSize += 200; // 基本オブジェクト約200バイト
                
                // ポイント配列
                if (operation.data && operation.data.points) {
                    totalSize += operation.data.points.length * 24; // Point約24バイト
                }
                
                // Graphics（概算）
                if (operation.graphics) {
                    totalSize += 1000; // Graphics約1KB
                }
            });
            
            return Math.round(totalSize / 1024 / 1024 * 100) / 100; // MB単位
        }
        
        /**
         * 🆕 Phase1.5デバッグ情報取得
         */
        getDebugInfo() {
            return {
                initialized: this.initialized,
                managers: {
                    hasCanvasManager: !!this.canvasManager,
                    hasEventBus: !!this.eventBus
                },
                
                history: {
                    operationHistory: this.operationHistory.length,
                    undoStack: this.undoStack.length,
                    redoStack: this.redoStack.length,
                    activeOperations: this.activeOperations.size,
                    canUndo: this.canUndo(),
                    canRedo: this.canRedo()
                },
                
                settings: {
                    maxHistorySize: this.maxHistorySize,
                    autoCleanupThreshold: this.autoCleanupThreshold,
                    operationCounter: this.operationCounter
                },
                
                stats: this.getHistoryStats(),
                
                recentOperations: this.operationHistory.slice(-3).map(op => ({
                    id: op.id,
                    tool: op.tool,
                    type: op.type,
                    duration: op.endTime - op.startTime,
                    hasGraphics: !!op.graphics
                }))
            };
        }
        
        /**
         * 初期化状態確認
         */
        isReady() {
            return this.initialized;
        }
        
        /**
         * 🆕 Phase1.5機能テスト
         */
        testRecordManagerFeatures() {
            const results = { success: [], error: [], warning: [] };
            
            try {
                // 履歴管理テスト
                const initialHistoryLength = this.operationHistory.length;
                
                // 操作開始テスト
                const testOp = this.startOperation({
                    tool: 'test',
                    type: 'test_operation',
                    data: { testData: 'テスト' }
                });
                
                if (testOp && testOp.id) {
                    results.success.push('RecordManager: 操作開始記録正常');
                    
                    // 操作終了テスト
                    this.endOperation(testOp.id, { success: true });
                    
                    if (this.operationHistory.length === initialHistoryLength + 1) {
                        results.success.push('RecordManager: 操作終了記録正常');
                        
                        // Undoテスト
                        const undoSuccess = this.undo();
                        if (undoSuccess && this.operationHistory.length === initialHistoryLength) {
                            results.success.push('RecordManager: Undo機能正常');
                            
                            // Redoテスト
                            const redoSuccess = this.redo();
                            if (redoSuccess && this.operationHistory.length === initialHistoryLength + 1) {
                                results.success.push('RecordManager: Redo機能正常');
                            } else {
                                results.error.push('RecordManager: Redo機能異常');
                            }
                        } else {
                            results.error.push('RecordManager: Undo機能異常');
                        }
                        
                        // クリーンアップ（テストデータ削除）
                        this.undo();
                        
                    } else {
                        results.error.push('RecordManager: 操作終了記録異常');
                    }
                } else {
                    results.error.push('RecordManager: 操作開始記録異常');
                }
                
                // 統計情報テスト
                const stats = this.getHistoryStats();
                if (stats && typeof stats.totalOperations === 'number') {
                    results.success.push('RecordManager: 統計情報機能正常');
                } else {
                    results.error.push('RecordManager: 統計情報機能異常');
                }
                
            } catch (error) {
                results.error.push(`RecordManager機能テストエラー: ${error.message}`);
            }
            
            return results;
        }
    }
    
    // Tegaki名前空間に登録
    window.Tegaki.RecordManager = RecordManager;
    
    // インスタンス作成・グローバル設定
    if (!window.Tegaki.RecordManagerInstance) {
        window.Tegaki.RecordManagerInstance = new RecordManager();
    }
    
    console.log('🔄 RecordManager Phase1.5 実用実装版 Loaded - Undo/Redo・操作履歴・非破壊編集完全対応');
} else {
    console.log('⚠️ RecordManager already defined - skipping redefinition');
}

console.log('🔄 record-manager.js loaded - 実用実装・スタブ→実装変換・Phase1.5完全対応完了');