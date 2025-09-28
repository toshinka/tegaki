// ===== system/history.js - Phase6改修版: 履歴システム実装 =====
// CHG: 軽量・確実なCommand パターン履歴システム

/*
=== Phase6改修完了ヘッダー ===

【改修内容】
✅ 軽量Commandパターン履歴システム実装
✅ CTRL+Z/CTRL+Y対応
✅ 非破壊的操作のスタック管理
✅ EventBus統合
✅ メモリ効率重視の設計

【新規実装】
- History.push(command)
- History.undo()
- History.redo()
- EventBus連携
- スタックサイズ制限

=== Phase6改修完了ヘッダー終了 ===
*/

(function() {
    'use strict';
    
    class HistorySystem {
        constructor() {
            this.undoStack = [];
            this.redoStack = [];
            this.MAX_HISTORY = 50; // メモリ効率重視
            this.eventBus = null;
            
            this.initializeEventBus();
        }
        
        initializeEventBus() {
            // EventBus取得
            this.eventBus = window.TegakiEventBus;
            
            if (this.eventBus) {
                // EventBus経由でのUndo/Redoイベント受信
                this.eventBus.on('history:undo', () => {
                    this.undo();
                });
                
                this.eventBus.on('history:redo', () => {
                    this.redo();
                });
                
                console.log('✅ HistorySystem: EventBus integration established');
            } else {
                console.warn('HistorySystem: EventBus not available - manual operation only');
            }
        }
        
        // CHG: Phase6改修 - コマンド追加
        push(command) {
            if (!command || typeof command.undo !== 'function' || typeof command.redo !== 'function') {
                console.error('HistorySystem: Invalid command - must have undo() and redo() methods');
                return false;
            }
            
            // CHG: スタックサイズ制限
            if (this.undoStack.length >= this.MAX_HISTORY) {
                const removedCommand = this.undoStack.shift();
                
                // 古いコマンドのクリーンアップ（メモリリーク防止）
                if (removedCommand.cleanup && typeof removedCommand.cleanup === 'function') {
                    try {
                        removedCommand.cleanup();
                    } catch (cleanupError) {
                        console.warn('HistorySystem: Command cleanup failed:', cleanupError);
                    }
                }
            }
            
            // コマンドをUndoスタックに追加
            this.undoStack.push(command);
            
            // Redoスタックをクリア（新しいアクションでRedo履歴は無効）
            this.clearRedoStack();
            
            // 統計・状態通知
            if (this.eventBus) {
                this.eventBus.emit('history:changed', { 
                    undoCount: this.undoStack.length, 
                    redoCount: this.redoStack.length,
                    canUndo: this.canUndo(),
                    canRedo: this.canRedo()
                });
            }
            
            console.log(`📝 History: Command pushed (${this.undoStack.length}/${this.MAX_HISTORY})`, 
                       command.meta?.type || 'unnamed');
            
            return true;
        }
        
        // CHG: Phase6改修 - Undo実行
        undo() {
            const command = this.undoStack.pop();
            if (!command) {
                console.log('🔄 History: No operations to undo');
                return false;
            }
            
            try {
                console.log('🔄 History: Undoing operation:', command.meta?.type || 'unnamed');
                
                // Undo実行
                command.undo();
                
                // Redoスタックに移動
                this.redoStack.push(command);
                
                // 状態通知
                if (this.eventBus) {
                    this.eventBus.emit('history:changed', { 
                        undoCount: this.undoStack.length, 
                        redoCount: this.redoStack.length,
                        canUndo: this.canUndo(),
                        canRedo: this.canRedo()
                    });
                    
                    this.eventBus.emit('history:undo-completed', {
                        operationType: command.meta?.type,
                        undoCount: this.undoStack.length
                    });
                }
                
                // UI状態表示更新
                this.updateUIStatus();
                
                return true;
                
            } catch (error) {
                console.error('❌ History: Undo operation failed:', error);
                
                // エラー時はコマンドを元に戻す
                this.undoStack.push(command);
                
                if (this.eventBus) {
                    this.eventBus.emit('history:undo-failed', { 
                        error: error.message,
                        operationType: command.meta?.type
                    });
                }
                
                return false;
            }
        }
        
        // CHG: Phase6改修 - Redo実行
        redo() {
            const command = this.redoStack.pop();
            if (!command) {
                console.log('🔄 History: No operations to redo');
                return false;
            }
            
            try {
                console.log('🔄 History: Redoing operation:', command.meta?.type || 'unnamed');
                
                // Redo実行
                command.redo();
                
                // Undoスタックに戻す
                this.undoStack.push(command);
                
                // 状態通知
                if (this.eventBus) {
                    this.eventBus.emit('history:changed', { 
                        undoCount: this.undoStack.length, 
                        redoCount: this.redoStack.length,
                        canUndo: this.canUndo(),
                        canRedo: this.canRedo()
                    });
                    
                    this.eventBus.emit('history:redo-completed', {
                        operationType: command.meta?.type,
                        redoCount: this.redoStack.length
                    });
                }
                
                // UI状態表示更新
                this.updateUIStatus();
                
                return true;
                
            } catch (error) {
                console.error('❌ History: Redo operation failed:', error);
                
                // エラー時はコマンドを元に戻す
                this.redoStack.push(command);
                
                if (this.eventBus) {
                    this.eventBus.emit('history:redo-failed', { 
                        error: error.message,
                        operationType: command.meta?.type
                    });
                }
                
                return false;
            }
        }
        
        // Redoスタッククリア（メモリリーク防止）
        clearRedoStack() {
            this.redoStack.forEach(command => {
                if (command.cleanup && typeof command.cleanup === 'function') {
                    try {
                        command.cleanup();
                    } catch (cleanupError) {
                        console.warn('HistorySystem: Redo command cleanup failed:', cleanupError);
                    }
                }
            });
            
            this.redoStack.length = 0;
        }
        
        // 履歴状態確認
        canUndo() {
            return this.undoStack.length > 0;
        }
        
        canRedo() {
            return this.redoStack.length > 0;
        }
        
        // 履歴情報取得
        getHistoryInfo() {
            return {
                undoCount: this.undoStack.length,
                redoCount: this.redoStack.length,
                maxHistory: this.MAX_HISTORY,
                canUndo: this.canUndo(),
                canRedo: this.canRedo(),
                recentOperations: this.undoStack.slice(-5).map(cmd => cmd.meta?.type || 'unnamed').reverse()
            };
        }
        
        // 履歴クリア
        clear() {
            // クリーンアップ処理
            [...this.undoStack, ...this.redoStack].forEach(command => {
                if (command.cleanup && typeof command.cleanup === 'function') {
                    try {
                        command.cleanup();
                    } catch (cleanupError) {
                        console.warn('HistorySystem: Command cleanup failed during clear:', cleanupError);
                    }
                }
            });
            
            this.undoStack.length = 0;
            this.redoStack.length = 0;
            
            if (this.eventBus) {
                this.eventBus.emit('history:cleared');
                this.eventBus.emit('history:changed', { 
                    undoCount: 0, 
                    redoCount: 0,
                    canUndo: false,
                    canRedo: false
                });
            }
            
            this.updateUIStatus();
            console.log('🗑️ History: All history cleared');
        }
        
        // UI状態表示更新
        updateUIStatus() {
            const historyElement = document.getElementById('history-info');
            if (historyElement) {
                historyElement.textContent = `${this.undoStack.length}/${this.MAX_HISTORY}`;
            }
        }
        
        // CHG: Phase6改修 - 便利メソッド：レイヤー操作用コマンド生成
        createLayerCommand(type, layerId, undoData, redoData) {
            return {
                undo: () => {
                    if (window.drawingClipboard && window.drawingClipboard.restoreLayerFromSnapshot) {
                        window.drawingClipboard.restoreLayerFromSnapshot(layerId, undoData);
                    } else {
                        console.warn('HistorySystem: Layer restore method not available');
                    }
                },
                redo: () => {
                    if (window.drawingClipboard && window.drawingClipboard.restoreLayerFromClipboard) {
                        window.drawingClipboard.restoreLayerFromClipboard(layerId, redoData);
                    } else {
                        console.warn('HistorySystem: Layer restore method not available');
                    }
                },
                meta: {
                    type: type,
                    layerId: layerId,
                    timestamp: Date.now()
                },
                cleanup: () => {
                    // メモリリークを防ぐため、大きなデータへの参照をクリア
                    undoData = null;
                    redoData = null;
                }
            };
        }
        
        // CHG: Phase6改修 - 便利メソッド：描画操作用コマンド生成
        createDrawingCommand(type, undoFunc, redoFunc, metadata = {}) {
            return {
                undo: undoFunc,
                redo: redoFunc,
                meta: {
                    type: type,
                    timestamp: Date.now(),
                    ...metadata
                }
            };
        }
        
        // デバッグ情報
        getDebugInfo() {
            return {
                undoStackSize: this.undoStack.length,
                redoStackSize: this.redoStack.length,
                maxHistory: this.MAX_HISTORY,
                memoryUsage: this.estimateMemoryUsage(),
                eventBusAvailable: !!this.eventBus,
                recentOperations: this.undoStack.slice(-10).map((cmd, index) => ({
                    index: this.undoStack.length - 10 + index,
                    type: cmd.meta?.type || 'unnamed',
                    timestamp: cmd.meta?.timestamp,
                    hasCleanup: typeof cmd.cleanup === 'function'
                }))
            };
        }
        
        // メモリ使用量推定（デバッグ用）
        estimateMemoryUsage() {
            let estimatedSize = 0;
            
            const countCommand = (cmd) => {
                // 基本的なオブジェクトサイズ推定
                estimatedSize += 200; // 基本コマンドオブジェクト
                
                if (cmd.meta) {
                    estimatedSize += JSON.stringify(cmd.meta).length * 2; // 文字列サイズ推定
                }
            };
            
            this.undoStack.forEach(countCommand);
            this.redoStack.forEach(countCommand);
            
            return {
                estimated: `${Math.round(estimatedSize / 1024)}KB`,
                commands: this.undoStack.length + this.redoStack.length
            };
        }
    }
    
    // CHG: Phase6改修 - グローバル履歴システム初期化
    const globalHistory = new HistorySystem();
    
    // グローバル公開
    window.TegakiHistorySystem = HistorySystem;
    window.History = globalHistory;
    
    // CHG: Phase6改修 - レガシー互換API
    window.historySystem = globalHistory;
    
    console.log('✅ history.js Phase6改修版 loaded - History system implemented');
    console.log('   - ✅ Command pattern with undo/redo functionality');
    console.log('   - ✅ CTRL+Z/CTRL+Y EventBus integration');
    console.log('   - ✅ Memory-efficient stack management');
    console.log('   - ✅ Non-destructive operation support');
    console.log('   - ✅ UI status integration');
    console.log('   - 🔧 Global API: History.push(), History.undo(), History.redo()');
    
})();