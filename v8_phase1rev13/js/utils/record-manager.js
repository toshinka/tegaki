/**
 * 🔄 RecordManager - PixiJS v8対応Undo/Redo・操作履歴・非破壊編集管理
 * 📋 RESPONSIBILITY: v8対応操作履歴管理・Undo/Redo機能・非破壊編集基盤・v8 Graphics記録
 * 🚫 PROHIBITION: 直接描画・UI通知・座標変換・フォールバック処理
 * ✅ PERMISSION: v8操作記録・履歴管理・Graphics操作・Tool連携・WebGPU最適化
 * 
 * 📏 DESIGN_PRINCIPLE: スタック型履歴・非破壊編集・操作原子性・メモリ効率・v8 Graphics活用
 * 🔄 INTEGRATION: AbstractTool v8連携・CanvasManager v8連携・EventBus通知・v8高精度記録
 * 🎯 V8_FEATURE: v8 Graphics記録・WebGPU最適化・高精度操作履歴・Container階層対応
 * 
 * === v8記録フロー ===
 * 開始: Tool.onPointerDown → RecordManager.startOperationV8() → v8操作開始記録
 * 処理: Tool描画処理 → RecordManager記録（並行処理・ブロックしない）
 * 終了: Tool.onPointerUp → RecordManager.endOperationV8() → v8操作完了・履歴保存
 * Undo: Undo要求 → RecordManager.undoV8() → v8 Graphics削除・undoStackに移動
 * Redo: Redo要求 → RecordManager.redoV8() → v8 Graphics復元・redoStackから戻し
 * 
 * === 提供メソッド ===
 * - async setCanvasManagerV8(canvasManager) : v8対応CanvasManager設定
 * - startOperationV8(operationData) : v8操作開始記録
 * - endOperationV8(operationId, endData) : v8操作終了記録
 * - undoV8() : v8 Undo実行
 * - redoV8() : v8 Redo実行
 * - recordDrawV8(graphics, layerId, metadata) : v8描画記録
 * - serializeGraphicsV8(graphics) : v8 Graphics シリアライズ
 * 
 * === 他ファイル呼び出しメソッド ===
 * - canvasManager.addGraphicsToLayerV8() : v8 Graphics配置
 * - canvasManager.removeGraphicsFromLayerV8() : v8 Graphics削除
 * - window.Tegaki.EventBusInstance.emit() : イベント配信
 * - window.Tegaki.ToolManagerInstance.getTool() : Tool取得
 * - tool.onUndoV8() : v8 Tool側Undo処理
 * - tool.onRedoV8() : v8 Tool側Redo処理
 */

// Tegaki名前空間初期化
window.Tegaki = window.Tegaki || {};

if (!window.Tegaki.RecordManager) {
    /**
     * RecordManager - PixiJS v8対応履歴管理
     * 操作履歴管理・Undo/Redo機能・非破壊編集を提供（v8対応版）
     */
    class RecordManager {
        constructor() {
            console.log('🔄 RecordManager v8対応版 初期化開始');
            
            // v8履歴スタック
            this.operationHistory = [];     // 完了操作履歴（メイン）
            this.undoStack = [];            // Undo用スタック
            this.redoStack = [];            // Redo用スタック
            
            // v8進行中操作管理
            this.activeOperations = new Map();  // 進行中操作（ID -> Operation）
            this.operationCounter = 0;           // 操作ID生成用
            
            // v8設定
            this.maxHistorySize = 50;         // 最大履歴保持数
            this.autoCleanupThreshold = 100;  // 自動クリーンアップ閾値
            this.webgpuSupported = false;     // WebGPU対応フラグ
            this.highPerformanceMode = false; // 高性能モード
            
            // v8 Manager連携
            this.canvasManager = null;
            this.eventBus = null;
            this.v8Ready = false;
            
            console.log('✅ RecordManager v8対応版 初期化完了');
        }
        
        /**
         * v8対応CanvasManager設定
         * @param {CanvasManager} canvasManager - v8対応CanvasManager
         */
        async setCanvasManagerV8(canvasManager) {
            console.log('🔧 RecordManager - v8 CanvasManager設定開始');
            
            if (!canvasManager) {
                throw new Error('RecordManager: CanvasManager is required for v8');
            }
            
            if (!canvasManager.isV8Ready()) {
                throw new Error('RecordManager: CanvasManager v8 not ready');
            }
            
            this.canvasManager = canvasManager;
            
            // v8機能確認
            if (canvasManager.webgpuSupported) {
                this.webgpuSupported = true;
                this.highPerformanceMode = true;
                console.log('🚀 RecordManager: WebGPU高性能モード有効');
            }
            
            await this.initializeV8Features();
            
            this.v8Ready = true;
            console.log('✅ RecordManager - v8 CanvasManager設定完了');
        }
        
        /**
         * EventBus設定（v8対応）
         * @param {EventBus} eventBus - EventBusインスタンス
         */
        setEventBus(eventBus) {
            this.eventBus = eventBus;
            console.log('✅ RecordManager - v8 EventBus設定完了');
        }
        
        /**
         * v8機能初期化
         */
        async initializeV8Features() {
            console.log('🔄 RecordManager v8機能初期化開始');
            
            // v8高性能設定適用
            if (this.webgpuSupported) {
                // WebGPU環境での最適化
                this.autoCleanupThreshold = 150; // より多く保持可能
                console.log('🚀 WebGPU最適化設定適用');
            }
            
            console.log('✅ RecordManager v8機能初期化完了');
        }
        
        /**
         * v8操作開始記録（Tool → RecordManager）
         * @param {Object} operationData - v8操作データ
         * @param {string} operationData.tool - ツール名
         * @param {string} operationData.type - 操作タイプ
         * @param {Object} operationData.data - 操作固有データ
         * @param {string} operationData.layerId - v8レイヤーID
         * @returns {Object} v8操作オブジェクト（継続参照用）
         */
        startOperationV8(operationData) {
            if (!operationData || !operationData.tool || !operationData.type) {
                console.warn('⚠️ Invalid v8 operation data:', operationData);
                return null;
            }
            
            // v8操作ID生成
            const operationId = `v8_op_${Date.now()}_${this.operationCounter++}`;
            
            // v8操作オブジェクト作成
            const operation = {
                id: operationId,
                tool: operationData.tool,
                type: operationData.type,
                data: operationData.data || {},
                layerId: operationData.layerId || 'main',
                startTime: Date.now(),
                endTime: null,
                completed: false,
                graphics: null,     // v8 Graphics参照（Tool側で設定）
                metadata: {
                    version: 'v8',
                    pixiVersion: typeof PIXI !== 'undefined' ? PIXI.VERSION : 'unknown',
                    canUndo: true,
                    canRedo: true,
                    webgpuMode: this.webgpuSupported,
                    rendererType: this.canvasManager?.pixiApp?.renderer?.type || 'unknown'
                }
            };
            
            // 進行中操作として記録
            this.activeOperations.set(operationId, operation);
            
            console.log(`🔄 RecordManager v8操作開始記録: ${operationData.tool} - WebGPU: ${this.webgpuSupported}`);
            
            // v8 EventBus通知
            this.emitV8Event('operation:start', operation);
            
            return operation;
        }
        
        /**
         * v8操作終了記録（Tool → RecordManager）
         * @param {string} operationId - v8操作ID
         * @param {Object} endData - v8終了データ
         * @param {boolean} endData.success - 操作成功フラグ
         * @param {PIXI.Graphics} endData.graphics - v8作成されたGraphics
         * @param {Object} endData.strokeData - v8ストロークデータ（任意）
         */
        endOperationV8(operationId, endData = {}) {
            if (!operationId) {
                console.warn('⚠️ Invalid v8 operation ID');
                return;
            }
            
            const operation = this.activeOperations.get(operationId);
            if (!operation) {
                console.warn(`⚠️ v8 Operation not found: ${operationId}`);
                return;
            }
            
            // v8操作完了処理
            operation.endTime = Date.now();
            operation.completed = true;
            operation.success = endData.success !== false; // デフォルトtrue
            
            // v8 Graphics設定
            if (endData.graphics) {
                operation.graphics = endData.graphics;
                
                // v8 Graphics追加情報記録
                operation.graphicsData = this.serializeGraphicsV8(endData.graphics);
            }
            
            // v8追加データ設定
            if (endData.strokeData) {
                operation.strokeData = endData.strokeData;
            }
            
            // 進行中操作から削除
            this.activeOperations.delete(operationId);
            
            // 成功した操作のみ履歴に追加
            if (operation.success) {
                this.addToV8History(operation);
            }
            
            const duration = operation.endTime - operation.startTime;
            console.log(`✅ v8操作完了記録: ${operation.tool}・${operation.type} (${duration}ms) WebGPU: ${this.webgpuSupported}`);
            
            // v8 EventBus通知
            this.emitV8Event('operation:end', operation);
            
            // v8自動クリーンアップ
            this.autoCleanupV8();
        }
        
        /**
         * v8履歴追加（内部処理）
         * @param {Object} operation - v8操作オブジェクト
         */
        addToV8History(operation) {
            // Redo履歴をクリア（新しい操作が行われたため）
            this.redoStack = [];
            
            // v8履歴に追加
            this.operationHistory.push(operation);
            
            // v8履歴サイズ制限
            if (this.operationHistory.length > this.maxHistorySize) {
                const removed = this.operationHistory.shift();
                console.log(`🧹 v8古い履歴削除: ${removed.id}`);
                
                // v8 Graphics削除（メモリ節約）
                if (removed.graphics && this.canvasManager) {
                    try {
                        this.canvasManager.removeGraphicsFromLayerV8?.(removed.graphics, removed.layerId);
                    } catch (error) {
                        console.warn('⚠️ v8古い履歴Graphics削除失敗:', error.message);
                    }
                }
            }
            
            console.log(`📚 v8履歴追加: ${operation.id} (総履歴: ${this.operationHistory.length})`);
        }
        
        /**
         * v8 Undo実行（UI → RecordManager）
         * @returns {boolean} v8 Undo実行成功フラグ
         */
        undoV8() {
            if (this.operationHistory.length === 0) {
                console.log('📝 v8 Undo: 履歴なし');
                return false;
            }
            
            const operation = this.operationHistory.pop();
            
            console.log(`↶ v8 Undo実行: ${operation.tool}・${operation.type} (${operation.id})`);
            
            // v8 Graphics削除（Canvas表示から削除）
            if (operation.graphics && this.canvasManager) {
                try {
                    if (this.canvasManager.removeGraphicsFromLayerV8) {
                        this.canvasManager.removeGraphicsFromLayerV8(operation.graphics, operation.layerId);
                    } else {
                        // フォールバック: 通常削除
                        this.canvasManager.removeGraphicsFromLayer?.(operation.graphics, operation.layerId);
                    }
                    console.log('🗑️ v8 Undo: Graphics削除完了');
                } catch (error) {
                    console.error('❌ v8 Undo: Graphics削除失敗:', error);
                    // 削除失敗でもUndoは続行
                }
            }
            
            // v8 Tool側のUndo処理呼び出し（任意）
            if (operation.tool && window.Tegaki?.ToolManagerInstance) {
                const toolManager = window.Tegaki.ToolManagerInstance;
                const tool = toolManager.getTool?.(operation.tool);
                
                if (tool) {
                    // v8対応Undoメソッドを優先
                    if (typeof tool.onUndoV8 === 'function') {
                        try {
                            tool.onUndoV8(operation);
                            console.log(`🔧 ${operation.tool}Tool.onUndoV8() 実行完了`);
                        } catch (error) {
                            console.warn(`⚠️ ${operation.tool}Tool.onUndoV8() 実行失敗:`, error.message);
                        }
                    } else if (typeof tool.onUndo === 'function') {
                        // フォールバック: 通常Undo
                        try {
                            tool.onUndo(operation);
                            console.log(`🔧 ${operation.tool}Tool.onUndo() フォールバック実行完了`);
                        } catch (error) {
                            console.warn(`⚠️ ${operation.tool}Tool.onUndo() フォールバック失敗:`, error.message);
                        }
                    }
                }
            }
            
            // UndoStackに移動
            this.undoStack.push(operation);
            
            // v8 EventBus通知
            this.emitV8Event('operation:undo', operation);
            
            console.log(`✅ v8 Undo完了: 履歴=${this.operationHistory.length}, Undo Stack=${this.undoStack.length}`);
            return true;
        }
        
        /**
         * v8 Redo実行（UI → RecordManager）
         * @returns {boolean} v8 Redo実行成功フラグ
         */
        redoV8() {
            if (this.undoStack.length === 0) {
                console.log('📝 v8 Redo: Undoスタック空');
                return false;
            }
            
            const operation = this.undoStack.pop();
            
            console.log(`↷ v8 Redo実行: ${operation.tool}・${operation.type} (${operation.id})`);
            
            // v8 Graphics復元（Canvas表示に追加）
            if (operation.graphics && this.canvasManager) {
                try {
                    if (this.canvasManager.addGraphicsToLayerV8) {
                        this.canvasManager.addGraphicsToLayerV8(operation.graphics, operation.layerId);
                    } else {
                        // フォールバック: 通常追加
                        this.canvasManager.addGraphicsToLayer?.(operation.graphics, operation.layerId);
                    }
                    console.log('📥 v8 Redo: Graphics復元完了');
                } catch (error) {
                    console.error('❌ v8 Redo: Graphics復元失敗:', error);
                    // 復元失敗でもRedoは続行
                }
            }
            
            // v8 Tool側のRedo処理呼び出し（任意）
            if (operation.tool && window.Tegaki?.ToolManagerInstance) {
                const toolManager = window.Tegaki.ToolManagerInstance;
                const tool = toolManager.getTool?.(operation.tool);
                
                if (tool) {
                    // v8対応Redoメソッドを優先
                    if (typeof tool.onRedoV8 === 'function') {
                        try {
                            tool.onRedoV8(operation);
                            console.log(`🔧 ${operation.tool}Tool.onRedoV8() 実行完了`);
                        } catch (error) {
                            console.warn(`⚠️ ${operation.tool}Tool.onRedoV8() 実行失敗:`, error.message);
                        }
                    } else if (typeof tool.onRedo === 'function') {
                        // フォールバック: 通常Redo
                        try {
                            tool.onRedo(operation);
                            console.log(`🔧 ${operation.tool}Tool.onRedo() フォールバック実行完了`);
                        } catch (error) {
                            console.warn(`⚠️ ${operation.tool}Tool.onRedo() フォールバック失敗:`, error.message);
                        }
                    }
                }
            }
            
            // 履歴に戻す
            this.operationHistory.push(operation);
            
            // v8 EventBus通知
            this.emitV8Event('operation:redo', operation);
            
            console.log(`✅ v8 Redo完了: 履歴=${this.operationHistory.length}, Undo Stack=${this.undoStack.length}`);
            return true;
        }
        
        /**
         * v8描画記録（Tool直接呼び出し用）
         * @param {PIXI.Graphics} graphics - v8 Graphics
         * @param {string} layerId - v8レイヤーID
         * @param {Object} metadata - v8メタデータ
         */
        recordDrawV8(graphics, layerId, metadata = {}) {
            const operation = {
                type: 'draw',
                timestamp: Date.now(),
                layerId: layerId,
                graphicsData: this.serializeGraphicsV8(graphics),
                graphics: graphics,
                metadata: {
                    ...metadata,
                    pixiVersion: typeof PIXI !== 'undefined' ? PIXI.VERSION : 'unknown',
                    rendererType: this.canvasManager?.pixiApp?.renderer?.type || 'unknown',
                    v8Mode: true,
                    webgpuMode: this.webgpuSupported
                }
            };
            
            this.addToV8History(operation);
            console.log(`🎨 v8描画記録完了: レイヤー=${layerId}, WebGPU=${this.webgpuSupported}`);
        }
        
        /**
         * v8 Graphics シリアライズ
         * @param {PIXI.Graphics} graphics - v8 Graphics
         * @returns {Object} v8シリアライズデータ
         */
        serializeGraphicsV8(graphics) {
            if (!graphics) return null;
            
            try {
                return {
                    // v8基本情報
                    bounds: graphics.getBounds(),
                    visible: graphics.visible,
                    alpha: graphics.alpha,
                    
                    // v8描画情報
                    strokeStyle: graphics.strokeStyle,
                    fillStyle: graphics.fillStyle,
                    
                    // v8変形情報
                    transform: {
                        position: { x: graphics.position.x, y: graphics.position.y },
                        scale: { x: graphics.scale.x, y: graphics.scale.y },
                        rotation: graphics.rotation,
                        pivot: { x: graphics.pivot.x, y: graphics.pivot.y }
                    },
                    
                    // v8階層情報
                    children: graphics.children.length,
                    parent: !!graphics.parent,
                    zIndex: graphics.zIndex,
                    
                    // v8メタデータ
                    serializedAt: Date.now(),
                    v8Serialized: true,
                    rendererType: this.canvasManager?.pixiApp?.renderer?.type || 'unknown'
                };
            } catch (error) {
                console.warn('⚠️ v8 Graphics シリアライズ失敗:', error.message);
                return {
                    error: error.message,
                    serializedAt: Date.now(),
                    v8Serialized: false
                };
            }
        }
        
        /**
         * v8 Undo可能判定
         * @returns {boolean} v8 Undo可能状況
         */
        canUndoV8() {
            return this.v8Ready && this.operationHistory.length > 0;
        }
        
        /**
         * v8 Redo可能判定
         * @returns {boolean} v8 Redo可能状況
         */
        canRedoV8() {
            return this.v8Ready && this.undoStack.length > 0;
        }
        
        /**
         * v8自動クリーンアップ（メモリ管理）
         */
        autoCleanupV8() {
            const totalOperations = this.operationHistory.length + 
                                  this.undoStack.length + 
                                  this.redoStack.length;
            
            if (totalOperations > this.autoCleanupThreshold) {
                console.log(`🧹 v8自動クリーンアップ実行: ${totalOperations}個の操作`);
                
                // v8古い操作から削除（履歴の先頭から）
                const cleanupCount = Math.floor(this.autoCleanupThreshold * 0.2); // 20%削除
                
                for (let i = 0; i < cleanupCount && this.operationHistory.length > 0; i++) {
                    const removed = this.operationHistory.shift();
                    
                    if (removed.graphics && this.canvasManager) {
                        try {
                            this.canvasManager.removeGraphicsFromLayerV8?.(removed.graphics, removed.layerId);
                        } catch (error) {
                            console.warn(`⚠️ v8自動クリーンアップGraphics削除失敗:`, error.message);
                        }
                    }
                }
                
                console.log(`✅ v8自動クリーンアップ完了: ${cleanupCount}個削除`);
            }
        }
        
        /**
         * v8履歴統計取得
         * @returns {Object} v8履歴統計情報
         */
        getV8HistoryStats() {
            const toolStats = {};
            const typeStats = {};
            const rendererStats = {};
            
            this.operationHistory.forEach(op => {
                toolStats[op.tool] = (toolStats[op.tool] || 0) + 1;
                typeStats[op.type] = (typeStats[op.type] || 0) + 1;
                
                const renderer = op.metadata?.rendererType || 'unknown';
                rendererStats[renderer] = (rendererStats[renderer] || 0) + 1;
            });
            
            return {
                // v8基本統計
                totalOperations: this.operationHistory.length,
                undoAvailable: this.undoStack.length,
                redoAvailable: this.redoStack.length,
                activeOperations: this.activeOperations.size,
                
                // v8詳細統計
                toolStats,
                typeStats,
                rendererStats,
                
                // v8パフォーマンス
                v8Performance: {
                    webgpuOperations: rendererStats.webgpu || 0,
                    webglOperations: rendererStats.webgl || 0,
                    highPerformanceMode: this.highPerformanceMode
                },
                
                // v8メモリ使用量
                memoryUsage: {
                    historyMB: this.estimateV8HistoryMemory(),
                    maxHistorySize: this.maxHistorySize,
                    autoCleanupThreshold: this.autoCleanupThreshold
                }
            };
        }
        
        /**
         * v8メモリ使用量推定（概算）
         * @returns {number} v8推定メモリ使用量（MB）
         */
        estimateV8HistoryMemory() {
            let totalSize = 0;
            
            const allOperations = [
                ...this.operationHistory,
                ...this.undoStack,
                ...this.redoStack
            ];
            
            allOperations.forEach(operation => {
                // v8基本操作データ
                totalSize += 300; // v8拡張オブジェクト約300バイト
                
                // v8ポイント配列
                if (operation.data && operation.data.points) {
                    totalSize += operation.data.points.length * 32; // v8高精度Point約32バイト
                }
                
                // v8 Graphics（概算）
                if (operation.graphics) {
                    totalSize += 1500; // v8 Graphics約1.5KB
                }
                
                // v8メタデータ
                if (operation.metadata) {
                    totalSize += 200; // v8メタデータ約200バイト
                }
            });
            
            return Math.round(totalSize / 1024 / 1024 * 100) / 100; // MB単位
        }
        
        /**
         * v8イベント配信（内部処理）
         * @param {string} eventName - イベント名
         * @param {Object} eventData - v8イベントデータ
         */
        emitV8Event(eventName, eventData) {
            // v8拡張イベントデータ
            const v8EventData = {
                ...eventData,
                v8Mode: true,
                webgpuSupported: this.webgpuSupported,
                timestamp: Date.now()
            };
            
            if (this.eventBus?.emit) {
                try {
                    this.eventBus.emit(eventName, v8EventData);
                } catch (error) {
                    console.warn(`⚠️ v8イベント配信失敗 ${eventName}:`, error.message);
                }
            }
            
            // グローバルEventBusも試行
            if (window.Tegaki?.EventBusInstance?.emit) {
                try {
                    window.Tegaki.EventBusInstance.emit(eventName, v8EventData);
                } catch (error) {
                    console.warn(`⚠️ グローバルv8イベント配信失敗 ${eventName}:`, error.message);
                }
            }
        }
        
        /**
         * v8準備完了確認
         * @returns {boolean} v8対応状況
         */
        isV8Ready() {
            return this.v8Ready && 
                   !!this.canvasManager && 
                   this.canvasManager.isV8Ready();
        }
        
        /**
         * v8履歴クリア
         */
        clearV8History() {
            console.log(`🧹 v8履歴クリア開始: 履歴=${this.operationHistory.length}, Undo=${this.undoStack.length}, Redo=${this.redoStack.length}`);
            
            // 全v8 Graphicsをクリーンアップ
            const allOperations = [
                ...this.operationHistory,
                ...this.undoStack,
                ...this.redoStack
            ];
            
            let cleanupCount = 0;
            allOperations.forEach(operation => {
                if (operation.graphics && this.canvasManager) {
                    try {
                        if (this.canvasManager.removeGraphicsFromLayerV8) {
                            this.canvasManager.removeGraphicsFromLayerV8(operation.graphics, operation.layerId);
                        } else {
                            this.canvasManager.removeGraphicsFromLayer?.(operation.graphics, operation.layerId);
                        }
                        cleanupCount++;
                    } catch (error) {
                        console.warn(`⚠️ v8 Graphics削除失敗: ${operation.id}`, error.message);
                    }
                }
            });
            
            // v8履歴スタッククリア
            this.operationHistory = [];
            this.undoStack = [];
            this.redoStack = [];
            
            // 進行中操作も強制終了
            this.forceEndAllV8Operations();
            
            console.log(`✅ v8履歴クリア完了: ${cleanupCount}個のGraphics削除`);
            
            // v8 EventBus通知
            this.emitV8Event('history:clear', { cleanupCount, v8Mode: true });
        }
        
        /**
         * v8進行中操作強制終了
         * @param {string} operationId - v8操作ID
         */
        forceEndV8Operation(operationId) {
            const operation = this.activeOperations.get(operationId);
            if (!operation) return;
            
            console.log(`⚠️ v8操作強制終了: ${operation.tool}・${operation.type}`);
            
            // v8 Tool側の強制終了処理
            if (operation.tool && window.Tegaki?.ToolManagerInstance) {
                const toolManager = window.Tegaki.ToolManagerInstance;
                const tool = toolManager.getTool?.(operation.tool);
                
                if (tool) {
                    // v8対応強制終了メソッドを優先
                    if (typeof tool.onOperationForceEndV8 === 'function') {
                        try {
                            tool.onOperationForceEndV8(operation);
                            console.log(`🔧 ${operation.tool}Tool.onOperationForceEndV8() 実行完了`);
                        } catch (error) {
                            console.warn(`⚠️ ${operation.tool}Tool.onOperationForceEndV8() 失敗:`, error.message);
                        }
                    } else if (typeof tool.onOperationForceEnd === 'function') {
                        // フォールバック: 通常強制終了
                        try {
                            tool.onOperationForceEnd(operation);
                            console.log(`🔧 ${operation.tool}Tool.onOperationForceEnd() フォールバック実行完了`);
                        } catch (error) {
                            console.warn(`⚠️ ${operation.tool}Tool.onOperationForceEnd() フォールバック失敗:`, error.message);
                        }
                    }
                }
            }
            
            // 進行中操作から削除（履歴には追加しない）
            this.activeOperations.delete(operationId);
        }
        
        /**
         * 全v8進行中操作強制終了
         */
        forceEndAllV8Operations() {
            const activeIds = Array.from(this.activeOperations.keys());
            console.log(`⚠️ 全v8操作強制終了: ${activeIds.length}個の操作`);
            
            activeIds.forEach(id => this.forceEndV8Operation(id));
        }
        
        /**
         * v8デバッグ情報取得
         * @returns {Object} v8デバッグ情報
         */
        getDebugInfo() {
            return {
                // v8基本状態
                v8Ready: this.v8Ready,
                webgpuSupported: this.webgpuSupported,
                highPerformanceMode: this.highPerformanceMode,
                
                // Manager連携状態
                managers: {
                    canvasManager: !!this.canvasManager,
                    canvasManagerV8Ready: this.canvasManager?.isV8Ready() || false,
                    eventBus: !!this.eventBus
                },
                
                // v8履歴状態
                history: {
                    operationHistory: this.operationHistory.length,
                    undoStack: this.undoStack.length,
                    redoStack: this.redoStack.length,
                    activeOperations: this.activeOperations.size,
                    canUndoV8: this.canUndoV8(),
                    canRedoV8: this.canRedoV8()
                },
                
                // v8設定
                settings: {
                    maxHistorySize: this.maxHistorySize,
                    autoCleanupThreshold: this.autoCleanupThreshold,
                    operationCounter: this.operationCounter
                },
                
                // v8統計情報
                stats: this.getV8HistoryStats(),
                
                // v8最新操作（デバッグ用）
                recentOperations: this.operationHistory.slice(-3).map(op => ({
                    id: op.id,
                    tool: op.tool,
                    type: op.type,
                    layerId: op.layerId,
                    duration: op.endTime - op.startTime,
                    hasGraphics: !!op.graphics,
                    v8Mode: op.metadata?.v8Mode || false,
                    webgpuMode: op.metadata?.webgpuMode || false,
                    rendererType: op.metadata?.rendererType || 'unknown'
                })),
                
                // v8パフォーマンス情報
                performance: {
                    webgpuAccelerated: this.webgpuSupported,
                    memoryOptimized: this.highPerformanceMode,
                    estimatedMemoryMB: this.estimateV8HistoryMemory(),
                    rendererType: this.canvasManager?.pixiApp?.renderer?.type || 'unknown'
                },
                
                // v8進行中操作詳細
                activeOperationsDetail: Array.from(this.activeOperations.values()).map(op => ({
                    id: op.id,
                    tool: op.tool,
                    type: op.type,
                    layerId: op.layerId,
                    startTime: op.startTime,
                    duration: Date.now() - op.startTime,
                    hasGraphics: !!op.graphics
                }))
            };
        }
        
        /**
         * v8機能テスト
         * @returns {Object} v8機能テスト結果
         */
        testV8RecordManagerFeatures() {
            const results = { success: [], error: [], warning: [] };
            
            try {
                // v8履歴管理テスト
                const initialHistoryLength = this.operationHistory.length;
                
                // v8操作開始テスト
                const testOp = this.startOperationV8({
                    tool: 'test',
                    type: 'test_operation_v8',
                    data: { testData: 'v8テスト' },
                    layerId: 'test_layer'
                });
                
                if (testOp && testOp.id && testOp.metadata.v8Mode) {
                    results.success.push('RecordManager v8: 操作開始記録正常');
                    
                    // v8操作終了テスト
                    this.endOperationV8(testOp.id, { success: true });
                    
                    if (this.operationHistory.length === initialHistoryLength + 1) {
                        results.success.push('RecordManager v8: 操作終了記録正常');
                        
                        // v8 Undoテスト
                        const undoSuccess = this.undoV8();
                        if (undoSuccess && this.operationHistory.length === initialHistoryLength) {
                            results.success.push('RecordManager v8: Undo機能正常');
                            
                            // v8 Redoテスト
                            const redoSuccess = this.redoV8();
                            if (redoSuccess && this.operationHistory.length === initialHistoryLength + 1) {
                                results.success.push('RecordManager v8: Redo機能正常');
                            } else {
                                results.error.push('RecordManager v8: Redo機能異常');
                            }
                        } else {
                            results.error.push('RecordManager v8: Undo機能異常');
                        }
                        
                        // クリーンアップ（テストデータ削除）
                        this.undoV8();
                        
                    } else {
                        results.error.push('RecordManager v8: 操作終了記録異常');
                    }
                } else {
                    results.error.push('RecordManager v8: 操作開始記録異常');
                }
                
                // v8統計情報テスト
                const stats = this.getV8HistoryStats();
                if (stats && typeof stats.totalOperations === 'number' && stats.v8Performance) {
                    results.success.push('RecordManager v8: 統計情報機能正常');
                } else {
                    results.error.push('RecordManager v8: 統計情報機能異常');
                }
                
                // WebGPU対応テスト
                if (this.webgpuSupported) {
                    results.success.push('RecordManager v8: WebGPU対応正常');
                } else {
                    results.warning.push('RecordManager v8: WebGPU未対応（WebGL動作）');
                }
                
            } catch (error) {
                results.error.push(`RecordManager v8機能テストエラー: ${error.message}`);
            }
            
            return results;
        }
        
        /**
         * v8状態リセット
         */
        resetV8() {
            console.log('🔄 RecordManager v8状態リセット開始');
            
            // 履歴クリア
            this.clearV8History();
            
            // 基本状態リセット
            this.canvasManager = null;
            this.v8Ready = false;
            this.webgpuSupported = false;
            this.highPerformanceMode = false;
            this.operationCounter = 0;
            
            console.log('✅ RecordManager v8状態リセット完了');
        }
    }
    
    // Tegaki名前空間に登録
    window.Tegaki.RecordManager = RecordManager;
    
    console.log('🔄 RecordManager PixiJS v8対応版 Loaded');
    console.log('📏 v8機能: Graphics記録・WebGPU最適化・高精度操作履歴・Container階層対応');
    console.log('🚀 v8特徴: 非破壊編集・v8 Graphics活用・高性能メモリ管理・WebGPU加速');
    console.log('✅ v8準備完了: setCanvasManagerV8()でv8対応CanvasManager設定後に利用可能');
}

console.log('🔄 RecordManager PixiJS v8対応版 Loaded - Graphics記録・WebGPU最適化・高精度履歴管理完了');