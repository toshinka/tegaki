// system/history.js
// ================================================================================
// Phase 2: EventBus修正 + コマンドパターン完全実装
// ================================================================================
// 改修内容:
// - _notifyHistoryChanged()でwindow.TegakiEventBusを使用
// - 既存機能完全継承

(function() {
    'use strict';

    class HistoryManager {
        constructor() {
            this.stack = [];
            this.index = -1;
            this.isApplying = false;
            this.maxSize = 500;
            
            // 後方互換性（既存コードが window.History._manager.isApplying を参照）
            this._manager = this;
        }

        push(command) {
            if (this.isApplying) {
                return;
            }
            
            if (!this._validateCommand(command)) {
                console.error('[History] Invalid command structure:', command);
                return;
            }

            try {
                this.isApplying = true;
                
                // 現在位置より後ろのスタックを削除
                this.stack.splice(this.index + 1);
                
                // コマンドを実行
                command.do();
                
                // スタックに追加
                this.stack.push(command);
                this.index++;
                
                // スタックサイズ制限
                if (this.stack.length > this.maxSize) {
                    this.stack.shift();
                    this.index--;
                }
                
                this._notifyHistoryChanged();
                
            } catch (error) {
                console.error('[History] Command execution failed:', error);
                this.stack.splice(this.index + 1);
            } finally {
                this.isApplying = false;
            }
        }

        undo() {
            if (!this.canUndo() || this.isApplying) {
                return;
            }
            
            try {
                this.isApplying = true;
                const command = this.stack[this.index];
                command.undo();
                this.index--;
                this._notifyHistoryChanged();
                
            } catch (error) {
                console.error('[History] Undo failed:', error);
            } finally {
                this.isApplying = false;
            }
        }

        redo() {
            if (!this.canRedo() || this.isApplying) {
                return;
            }
            
            try {
                this.isApplying = true;
                this.index++;
                const command = this.stack[this.index];
                command.do();
                this._notifyHistoryChanged();
                
            } catch (error) {
                console.error('[History] Redo failed:', error);
                this.index--;
            } finally {
                this.isApplying = false;
            }
        }

        canUndo() {
            return this.index >= 0;
        }

        canRedo() {
            return this.index < this.stack.length - 1;
        }

        clear() {
            this.stack = [];
            this.index = -1;
            this._notifyHistoryChanged();
        }

        createComposite(commands, name = 'composite') {
            return {
                name: name,
                do: () => {
                    commands.forEach(cmd => cmd.do());
                },
                undo: () => {
                    commands.slice().reverse().forEach(cmd => cmd.undo());
                },
                meta: {
                    type: 'composite',
                    count: commands.length
                }
            };
        }

        _validateCommand(command) {
            return (
                command &&
                typeof command.name === 'string' &&
                typeof command.do === 'function' &&
                typeof command.undo === 'function'
            );
        }

        // ========== Phase 2: 改修 START ==========
        _notifyHistoryChanged() {
            // 🔥 修正: window.EventBus → window.TegakiEventBus
            if (window.TegakiEventBus) {
                window.TegakiEventBus.emit('history:changed', {
                    canUndo: this.canUndo(),
                    canRedo: this.canRedo(),
                    stackSize: this.stack.length,
                    currentIndex: this.index
                });
            }
        }
        // ========== Phase 2: 改修 END ==========

        debug() {
            console.log('[History] Stack:', this.stack.map(cmd => cmd.name));
            console.log('[History] Index:', this.index);
            console.log('[History] Can Undo:', this.canUndo());
            console.log('[History] Can Redo:', this.canRedo());
        }
        
        // デバッグ用：最後のコマンドを表示
        getLastCommand() {
            return this.stack[this.index] || null;
        }
        
        // デバッグ用：スタック全体を取得
        getStack() {
            return this.stack.map((cmd, idx) => ({
                index: idx,
                name: cmd.name,
                isCurrent: idx === this.index,
                meta: cmd.meta
            }));
        }
    }

    window.History = new HistoryManager();
    
    console.log('✅ history.js (Phase 2: EventBus修正版) loaded');

})();