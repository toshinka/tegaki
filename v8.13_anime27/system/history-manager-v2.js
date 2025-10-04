// ================================================================================
// system/history-manager-v2.js - Phase2: Command-based History (新実装)
// ================================================================================
// 🎯 Command パターンに基づく Undo/Redo
// ✅ 既存 history.js と並行稼働（段階的移行）
// 🔧 Redo機能の完全実装

(function() {
    'use strict';
    
    const MAX_HISTORY = 50;
    
    class HistoryManagerV2 {
        constructor(stateManager, eventBus) {
            this.stateManager = stateManager;
            this.eventBus = eventBus || window.TegakiEventBus;
            
            // Command スタック
            this.undoStack = [];
            this.redoStack = [];
            
            this.maxHistory = MAX_HISTORY;
            
            // Undo/Redo実行中フラグ
            this.isExecuting = false;
            
            // 有効化フラグ（既存historyと切り替え用）
            this.enabled = false;
            
            this._setupEventListeners();
        }
        
        // ===== 有効化/無効化 =====
        
        enable() {
            this.enabled = true;
            console.log('✅ HistoryManagerV2 enabled');
        }
        
        disable() {
            this.enabled = false;
            console.log('⚠️ HistoryManagerV2 disabled');
        }
        
        // ===== イベントリスナー =====
        
        _setupEventListeners() {
            if (!this.eventBus) return;
            
            // Undo/Redo リクエスト
            this.eventBus.on('history-v2:undo-request', () => {
                if (this.enabled) this.undo();
            });
            
            this.eventBus.on('history-v2:redo-request', () => {
                if (this.enabled) this.redo();
            });
            
            // Clear
            this.eventBus.on('history-v2:clear', () => {
                if (this.enabled) this.clear();
            });
        }
        
        // ===== Command 実行 =====
        
        execute(command) {
            if (!this.enabled) return;
            if (this.isExecuting) return;
            
            this.isExecuting = true;
            
            try {
                // 現在の State を取得
                const oldState = this.stateManager.getState();
                
                // Command 実行
                const newState = command.execute(oldState);
                
                // State を更新
                this.stateManager.setState(newState, 'command:execute');
                
                // 逆 Command を生成
                const inverseCommand = command.createInverse(oldState, newState);
                
                // Undo スタックに追加
                this.undoStack.push(inverseCommand);
                
                // Redo スタックをクリア
                this.redoStack = [];
                
                // スタックサイズ制限
                if (this.undoStack.length > this.maxHistory) {
                    this.undoStack.shift();
                }
                
                this._emitStateChanged();
                
            } catch (error) {
                console.error('❌ Command execution failed:', error);
            } finally {
                this.isExecuting = false;
            }
        }
        
        // ===== Undo =====
        
        undo() {
            if (!this.canUndo()) return false;
            if (this.isExecuting) return false;
            
            this.isExecuting = true;
            
            try {
                // Undo スタックから Command を取得
                const command = this.undoStack.pop();
                
                // 現在の State を取得
                const oldState = this.stateManager.getState();
                
                // Command 実行（= 元に戻す）
                const newState = command.execute(oldState);
                
                // State を更新
                this.stateManager.setRestoring(true);
                this.stateManager.setState(newState, 'undo');
                this.stateManager.setRestoring(false);
                
                // Redo 用に逆 Command を生成
                const redoCommand = command.createInverse(oldState, newState);
                
                // Redo スタックに追加
                this.redoStack.push(redoCommand);
                
                this._emitStateChanged();
                
                if (this.eventBus) {
                    this.eventBus.emit('history-v2:undo-completed', {
                        canUndo: this.canUndo(),
                        canRedo: this.canRedo()
                    });
                }
                
                return true;
                
            } catch (error) {
                console.error('❌ Undo failed:', error);
                return false;
            } finally {
                this.isExecuting = false;
            }
        }
        
        // ===== Redo (完全実装) =====
        
        redo() {
            if (!this.canRedo()) return false;
            if (this.isExecuting) return false;
            
            this.isExecuting = true;
            
            try {
                // Redo スタックから Command を取得
                const command = this.redoStack.pop();
                
                // 現在の State を取得
                const oldState = this.stateManager.getState();
                
                // Command 実行（= やり直す）
                const newState = command.execute(oldState);
                
                // State を更新
                this.stateManager.setRestoring(true);
                this.stateManager.setState(newState, 'redo');
                this.stateManager.setRestoring(false);
                
                // Undo 用に逆 Command を生成
                const undoCommand = command.createInverse(oldState, newState);
                
                // Undo スタックに追加
                this.undoStack.push(undoCommand);
                
                this._emitStateChanged();
                
                if (this.eventBus) {
                    this.eventBus.emit('history-v2:redo-completed', {
                        canUndo: this.canUndo(),
                        canRedo: this.canRedo()
                    });
                }
                
                return true;
                
            } catch (error) {
                console.error('❌ Redo failed:', error);
                return false;
            } finally {
                this.isExecuting = false;
            }
        }
        
        // ===== スタック状態 =====
        
        canUndo() {
            return this.undoStack.length > 0;
        }
        
        canRedo() {
            return this.redoStack.length > 0;
        }
        
        // ===== スタッククリア =====
        
        clear() {
            this.undoStack = [];
            this.redoStack = [];
            this._emitStateChanged();
        }
        
        // ===== 履歴情報 =====
        
        getHistoryInfo() {
            return {
                undoCount: this.undoStack.length,
                redoCount: this.redoStack.length,
                maxHistory: this.maxHistory,
                canUndo: this.canUndo(),
                canRedo: this.canRedo(),
                enabled: this.enabled
            };
        }
        
        // ===== 状態変更通知 =====
        
        _emitStateChanged() {
            if (this.eventBus) {
                this.eventBus.emit('history-v2:changed', {
                    undoCount: this.undoStack.length,
                    redoCount: this.redoStack.length,
                    canUndo: this.canUndo(),
                    canRedo: this.canRedo()
                });
            }
        }
        
        // ===== デバッグ情報 =====
        
        getDebugInfo() {
            return {
                undoStackSize: this.undoStack.length,
                redoStackSize: this.redoStack.length,
                maxHistory: this.maxHistory,
                isExecuting: this.isExecuting,
                enabled: this.enabled,
                recentUndoCommands: this.undoStack.slice(-5).map(cmd => cmd.getDescription()),
                recentRedoCommands: this.redoStack.slice(-5).map(cmd => cmd.getDescription())
            };
        }
    }
    
    // ===== グローバル公開 =====
    
    window.TegakiHistoryManagerV2 = HistoryManagerV2;
    
    console.log('✅ history-manager-v2.js loaded (Phase2 - Command-based)');
    
})();