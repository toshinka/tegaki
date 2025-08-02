/**
 * 履歴制御 v3.2 - アンドゥ・リドゥ・状態管理
 * PixiJS統一基盤対応・非破壊性保証・メモリ効率最適化
 * 規約: 総合AIコーディング規約v4.1準拠（PixiJS統一座標対応）
 */

import { cloneDeep } from 'lodash-es';

/**
 * 履歴制御クラス
 * アンドゥ・リドゥ・状態スナップショット・非破壊状態管理
 */
export class HistoryController {
    constructor(eventStore) {
        this.eventStore = eventStore;
        
        // 履歴スタック管理
        this.undoStack = [];
        this.redoStack = [];
        this.maxHistorySize = 50; // メモリ効率考慮
        
        // 現在の状態
        this.currentState = null;
        this.stateVersion = 0;
        
        // 履歴記録設定
        this.config = {
            autoSave: true,
            debounceMs: 500, // 連続操作統合
            compression: true, // 状態圧縮
            pixiIntegration: true // PixiJS統一対応
        };
        
        // デバウンス制御
        this.saveTimeout = null;
        this.pendingChanges = false;
        
        // 統計・監視
        this.stats = {
            totalSaves: 0,
            totalUndos: 0,
            totalRedos: 0,
            memoryUsage: 0,
            compressionRatio: 0
        };
        
        // Phase段階対応
        this.phase1Ready = false;
        
        this.isReady = false;
        this.initialize();
    }
    
    /**
     * 履歴制御初期化
     */
    initialize() {
        try {
            console.log('📚 履歴制御初期化開始');
            
            // EventStore連携設定
            this.setupEventStoreIntegration();
            
            // 自動保存システム設定
            this.setupAutoSave();
            
            // メモリ監視設定
            this.setupMemoryMonitoring();
            
            // 初期状態保存
            this.saveInitialState();
            
            this.phase1Ready = true;
            this.isReady = true;
            
            console.log('✅ 履歴制御初期化完了');
            
        } catch (error) {
            console.error('❌ 履歴制御初期化エラー:', error);
        }
    }
    
    /**
     * EventStore連携設定
     */
    setupEventStoreIntegration() {
        // 履歴操作イベント購読
        this.eventStore.on('history:undo', () => {
            this.undo();
        });
        
        this.eventStore.on('history:redo', () => {
            this.redo();
        });
        
        this.eventStore.on('history:save', (data) => {
            this.saveState(data.description, data.state);
        });
        
        this.eventStore.on('history:clear', () => {
            this.clearHistory();
        });
        
        // 状態変更監視（自動保存用）
        this.eventStore.on('draw:stroke:complete', (data) => {
            this.scheduleAutoSave('描画', data);
        });
        
        this.eventStore.on('draw:clear:complete', (data) => {
            this.scheduleAutoSave('削除', data);
        });
        
        // 🎨 Phase2: レイヤー・ツール操作監視（封印中）
        /*
        this.eventStore.on('layer:create', (data) => {         // 🔒Phase2解封
            this.scheduleAutoSave('レイヤー作成', data);
        });
        
        this.eventStore.on('layer:delete', (data) => {         // 🔒Phase2解封
            this.scheduleAutoSave('レイヤー削除', data);
        });
        
        this.eventStore.on('tool:change', (data) => {          // 🔒Phase2解封
            this.scheduleAutoSave('ツール変更', data);
        });
        */
        
        console.log('📡 EventStore履歴連携設定完了');
    }
    
    /**
     * 自動保存システム設定
     */
    setupAutoSave() {
        if (!this.config.autoSave) {
            return;
        }
        
        // 定期自動保存（アイドル時）
        this.autoSaveInterval = setInterval(() => {
            if (this.pendingChanges) {
                this.performAutoSave();
            }
        }, 30000); // 30秒間隔
        
        // ページ離脱時の緊急保存
        window.addEventListener('beforeunload', () => {
            if (this.pendingChanges) {
                this.performAutoSave();
            }
        });
        
        console.log('💾 自動保存システム設定完了');
    }
    
    /**
     * メモリ監視設定
     */
    setupMemoryMonitoring() {
        this.memoryMonitorInterval = setInterval(() => {
            this.updateMemoryStats();
            this.optimizeMemoryUsage();
        }, 60000); // 1分間隔
        
        console.log('🧠 メモリ監視設定完了');
    }
    
    /**
     * 初期状態保存
     */
    saveInitialState() {
        const initialState = this.captureCurrentState();
        
        this.currentState = initialState;
        this.stateVersion = 1;
        
        // 初期状態を履歴の起点として保存
        this.undoStack.push({
            state: cloneDeep(initialState),
            description: '初期状態',
            timestamp: Date.now(),
            version: this.stateVersion,
            compressed: false
        });
        
        console.log('📚 初期状態保存完了');
    }
    
    /**
     * 現在の状態キャプチャ
     */
    captureCurrentState() {
        try {
            const state = {
                // PixiJS統一状態
                viewport: this.captureViewportState(),
                drawing: this.captureDrawingState(),
                
                // Phase1基本状態
                timestamp: Date.now(),
                version: this.stateVersion + 1,
                
                // 🎨 Phase2: レイヤー・ツール状態（封印中）
                // layers: this.captureLayerState(),      // 🔒Phase2解封
                // tools: this.captureToolState(),        // 🔒Phase2解封
                // ui: this.captureUIState(),             // 🔒Phase2解封
                
                // メタデータ
                metadata: {
                    phase: 1,
                    pixiIntegrated: true,
                    compressed: false
                }
            };
            
            return state;
            
        } catch (error) {
            console.error('❌ 状態キャプチャエラー:', error);
            return null;
        }
    }
    
    /**
     * ビューポート状態キャプチャ
     */
    captureViewportState() {
        return {
            width: window.innerWidth,
            height: window.innerHeight,
            // PixiJS統一座標系データ
            // coordinateSystem: 'pixi-unified'
        };
    }
    
    /**
     * 描画状態キャプチャ（PixiJS Container対応）
     */
    captureDrawingState() {
        // Phase1では基本的な描画データのみ
        return {
            strokes: [], // 実際のストロークデータはPhase2で実装
            totalStrokes: 0,
            // pixiContainers: [], // PixiJS Container状態はPhase2で実装
        };
    }
    
    /**
     * 状態保存（手動）
     */
    saveState(description = '操作', customState = null) {
        try {
            const state = customState || this.captureCurrentState();
            
            if (!state) {
                console.warn('⚠️ 状態キャプチャ失敗: 保存スキップ');
                return false;
            }
            
            // 状態圧縮（大きなデータの場合）
            const compressedState = this.compressState(state);
            
            // 履歴エントリ作成
            const historyEntry = {
                state: compressedState,
                description: description,
                timestamp: Date.now(),
                version: this.stateVersion++,
                compressed: compressedState !== state
            };
            
            // アンドゥスタックに追加
            this.undoStack.push(historyEntry);
            
            // リドゥスタッククリア
            this.redoStack = [];
            
            // 履歴サイズ制限
            this.limitHistorySize();
            
            // 現在状態更新
            this.currentState = state;
            
            // 統計更新
            this.stats.totalSaves++;
            this.updateMemoryStats();
            
            // EventStore通知
            this.eventStore.emit('history:saved', {
                description: description,
                version: historyEntry.version,
                stackSize: this.undoStack.length
            });
            
            console.log(`📚 状態保存: ${description} (v${historyEntry.version})`);
            return true;
            
        } catch (error) {
            console.error('❌ 状態保存エラー:', error);
            return false;
        }
    }
    
    /**
     * 自動保存スケジュール
     */
    scheduleAutoSave(description, data) {
        if (!this.config.autoSave) {
            return;
        }
        
        this.pendingChanges = true;
        
        // デバウンス処理
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
        }
        
        this.saveTimeout = setTimeout(() => {
            this.performAutoSave(description, data);
        }, this.config.debounceMs);
    }
    
    /**
     * 自動保存実行
     */
    performAutoSave(description = '自動保存', data = null) {
        try {
            const success = this.saveState(description);
            
            if (success) {
                this.pendingChanges = false;
            }
            
            return success;
            
        } catch (error) {
            console.error('❌ 自動保存エラー:', error);
            return false;
        }
    }
    
    /**
     * アンドゥ実行
     */
    undo() {
        try {
            if (this.undoStack.length <= 1) {
                console.log('📚 アンドゥ不可: 履歴なし');
                return false;
            }
            
            // 現在の状態をリドゥスタックに移動
            const currentEntry = this.undoStack.pop();
            this.redoStack.push(currentEntry);
            
            // 前の状態を復元
            const previousEntry = this.undoStack[this.undoStack.length - 1];
            const restoredState = this.decompressState(previousEntry.state);
            
            // 状態復元実行
            const success = this.restoreState(restoredState);
            
            if (success) {
                this.currentState = restoredState;
                this.stats.totalUndos++;
                
                // EventStore通知
                this.eventStore.emit('history:undone', {
                    description: previousEntry.description,
                    version: previousEntry.version,
                    stackSize: this.undoStack.length
                });
                
                console.log(`📚 アンドゥ実行: ${previousEntry.description} (v${previousEntry.version})`);
            }
            
            return success;
            
        } catch (error) {
            console.error('❌ アンドゥエラー:', error);
            return false;
        }
    }
    
    /**
     * リドゥ実行
     */
    redo() {
        try {
            if (this.redoStack.length === 0) {
                console.log('📚 リドゥ不可: 履歴なし');
                return false;
            }
            
            // リドゥスタックから状態を復元
            const redoEntry = this.redoStack.pop();
            this.undoStack.push(redoEntry);
            
            const restoredState = this.decompressState(redoEntry.state);
            
            // 状態復元実行
            const success = this.restoreState(restoredState);
            
            if (success) {
                this.currentState = restoredState;
                this.stats.totalRedos++;
                
                // EventStore通知
                this.eventStore.emit('history:redone', {
                    description: redoEntry.description,
                    version: redoEntry.version,
                    stackSize: this.undoStack.length
                });
                
                console.log(`📚 リドゥ実行: ${redoEntry.description} (v${redoEntry.version})`);
            }
            
            return success;
            
        } catch (error) {
            console.error('❌ リドゥエラー:', error);
            return false;
        }
    }
    
    /**
     * 状態復元
     */
    restoreState(state) {
        try {
            // Phase1では基本的な状態復元のみ
            console.log('📚 状態復元実行 (Phase1基本機能)');
            
            // ビューポート復元
            if (state.viewport) {
                this.restoreViewportState(state.viewport);
            }
            
            // 描画状態復元
            if (state.drawing) {
                this.restoreDrawingState(state.drawing);
            }
            
            // 🎨 Phase2: レイヤー・ツール状態復元（封印中）
            /*
            if (state.layers) {                      // 🔒Phase2解封
                this.restoreLayerState(state.layers);
            }
            
            if (state.tools) {                       // 🔒Phase2解封
                this.restoreToolState(state.tools);
            }
            */
            
            return true;
            
        } catch (error) {
            console.error('❌ 状態復元エラー:', error);
            return false;
        }
    }
    
    /**
     * ビューポート状態復元
     */
    restoreViewportState(viewportState) {
        // Phase1では基本的なビューポート情報のみ
        console.log('📚 ビューポート状態復元 (Phase1)');
    }
    
    /**
     * 描画状態復元
     */
    restoreDrawingState(drawingState) {
        // Phase1では基本的な描画情報のみ
        console.log('📚 描画状態復元 (Phase1)');
    }
    
    /**
     * 状態圧縮
     */
    compressState(state) {
        if (!this.config.compression) {
            return state;
        }
        
        try {
            // 単純な圧縮: 不要プロパティ削除
            const compressed = { ...state };
            
            // メタデータ圧縮
            if (compressed.metadata) {
                delete compressed.metadata.debug;
                delete compressed.metadata.temporary;
            }
            
            return compressed;
            
        } catch (error) {
            console.error('❌ 状態圧縮エラー:', error);
            return state;
        }
    }
    
    /**
     * 状態解凍
     */
    decompressState(compressedState) {
        // Phase1では単純解凍のみ
        return compressedState;
    }
    
    /**
     * 履歴サイズ制限
     */
    limitHistorySize() {
        while (this.undoStack.length > this.maxHistorySize) {
            this.undoStack.shift(); // 古い履歴を削除
        }
        
        while (this.redoStack.length > this.maxHistorySize) {
            this.redoStack.shift();
        }
    }
    
    /**
     * 履歴クリア
     */
    clearHistory() {
        const currentEntry = this.undoStack[this.undoStack.length - 1];
        
        this.undoStack = currentEntry ? [currentEntry] : [];
        this.redoStack = [];
        
        console.log('📚 履歴クリア完了');
        
        this.eventStore.emit('history:cleared', {
            timestamp: Date.now()
        });
    }
    
    /**
     * メモリ統計更新
     */
    updateMemoryStats() {
        try {
            const undoMemory = this.calculateMemorySize(this.undoStack);
            const redoMemory = this.calculateMemorySize(this.redoStack);
            
            this.stats.memoryUsage = undoMemory + redoMemory;
            
            // 圧縮率計算
            const totalEntries = this.undoStack.length + this.redoStack.length;
            const compressedEntries = [...this.undoStack, ...this.redoStack]
                .filter(entry => entry.compressed).length;
            
            this.stats.compressionRatio = totalEntries > 0 ? 
                (compressedEntries / totalEntries) * 100 : 0;
            
        } catch (error) {
            console.error('❌ メモリ統計更新エラー:', error);
        }
    }
    
    /**
     * メモリサイズ計算（概算）
     */
    calculateMemorySize(stack) {
        try {
            const jsonString = JSON.stringify(stack);
            return jsonString.length * 2; // UTF-16概算
        } catch (error) {
            return 0;
        }
    }
    
    /**
     * メモリ使用量最適化
     */
    optimizeMemoryUsage() {
        const maxMemoryMB = 50; // 50MB制限
        const currentMemoryMB = this.stats.memoryUsage / (1024 * 1024);
        
        if (currentMemoryMB > maxMemoryMB) {
            console.log('🧠 メモリ使用量制限: 古い履歴を削除');
            
            // 履歴サイズを縮小
            this.maxHistorySize = Math.max(10, Math.floor(this.maxHistorySize * 0.8));
            this.limitHistorySize();
            
            // メモリ統計更新
            this.updateMemoryStats();
        }
    }
    
    /**
     * 履歴統計取得
     */
    getStats() {
        return {
            ...this.stats,
            undoStackSize: this.undoStack.length,
            redoStackSize: this.redoStack.length,
            currentVersion: this.stateVersion,
            memoryUsageMB: Math.round(this.stats.memoryUsage / (1024 * 1024) * 100) / 100,
            canUndo: this.undoStack.length > 1,
            canRedo: this.redoStack.length > 0
        };
    }
    
    /**
     * システム情報取得
     */
    getInfo() {
        return {
            system: '履歴制御システム',
            maxHistorySize: this.maxHistorySize,
            autoSave: this.config.autoSave,
            compression: this.config.compression,
            pixiIntegration: this.config.pixiIntegration,
            phase1Ready: this.phase1Ready,
            ready: this.isReady
        };
    }
    
    /**
     * 履歴一覧取得
     */
    getHistoryList(limit = 10) {
        return this.undoStack.slice(-limit).map((entry, index) => ({
            index: index,
            description: entry.description,
            timestamp: entry.timestamp,
            version: entry.version,
            compressed: entry.compressed,
            isCurrent: index === this.undoStack.length - 1
        }));
    }
    
    /**
     * 準備状態確認
     */
    isReady() {
        return this.isReady && this.eventStore;
    }
    
    /**
     * デバッグ情報表示
     */
    showDebugInfo() {
        console.group('📚 履歴制御 デバッグ情報');
        console.log('統計:', this.getStats());
        console.log('履歴一覧:', this.getHistoryList());
        console.log('設定:', this.config);
        console.groupEnd();
    }
    
    /**
     * 破棄処理
     */
    destroy() {
        try {
            // タイマー停止
            if (this.saveTimeout) {
                clearTimeout(this.saveTimeout);
            }
            if (this.autoSaveInterval) {
                clearInterval(this.autoSaveInterval);
            }
            if (this.memoryMonitorInterval) {
                clearInterval(this.memoryMonitorInterval);
            }
            
            // 最終保存
            if (this.pendingChanges) {
                this.performAutoSave('終了時保存');
            }
            
            // メモリクリア
            this.undoStack = [];
            this.redoStack = [];
            this.currentState = null;
            
            console.log('📚 履歴制御破棄完了');
            
        } catch (error) {
            console.error('❌ 履歴制御破棄エラー:', error);
        }
    }
}