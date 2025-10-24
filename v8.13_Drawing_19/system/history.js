// system/history.js
// ================================================================================
// Phase 1完成: async/await対応 + EventBus修正 + コマンドパターン完全実装
// ================================================================================
// 改修内容:
// - undo/redo をasync対応（消しゴムのマスク復元に対応）
// - 既存のsync entryも動作する後方互換性維持

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

        async push(command) {
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
                
                // コマンドを実行（async対応）
                await command.do();
                
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

        async undo() {
            if (!this.canUndo() || this.isApplying) {
                return;
            }
            
            try {
                this.isApplying = true;
                const command = this.stack[this.index];
                
                // async対応（既存のsync関数も動作）
                await command.undo();
                
                this.index--;
                this._notifyHistoryChanged();
                
            } catch (error) {
                console.error('[History] Undo failed:', error);
            } finally {
                this.isApplying = false;
            }
        }

        async redo() {
            if (!this.canRedo() || this.isApplying) {
                return;
            }
            
            try {
                this.isApplying = true;
                this.index++;
                const command = this.stack[this.index];
                
                // async対応（既存のsync関数も動作）
                await command.do();
                
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
                do: async () => {
                    for (const cmd of commands) {
                        await cmd.do();
                    }
                },
                undo: async () => {
                    const reversed = commands.slice().reverse();
                    for (const cmd of reversed) {
                        await cmd.undo();
                    }
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

        _notifyHistoryChanged() {
            if (window.TegakiEventBus) {
                window.TegakiEventBus.emit('history:changed', {
                    canUndo: this.canUndo(),
                    canRedo: this.canRedo(),
                    stackSize: this.stack.length,
                    currentIndex: this.index
                });
            }
        }

        debug() {
            console.log('[History] Stack:', this.stack.map(cmd => cmd.name));
            console.log('[History] Index:', this.index);
            console.log('[History] Can Undo:', this.canUndo());
            console.log('[History] Can Redo:', this.canRedo());
        }
        
        getLastCommand() {
            return this.stack[this.index] || null;
        }
        
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
    
    console.log('✅ history.js (Phase 1: async対応完了版) loaded');

})();