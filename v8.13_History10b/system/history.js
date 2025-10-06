// system/history.js
// ================================================================================
// Phase 1: コマンドパターン完全移行
// ================================================================================

(function() {
    'use strict';

    class HistoryManager {
        constructor() {
            this.stack = [];
            this.index = -1;
            this.isApplying = false;
            this.maxSize = 500;
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
                this.stack.splice(this.index + 1);
                command.do();
                this.stack.push(command);
                this.index++;
                
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

        _notifyHistoryChanged() {
            if (window.EventBus) {
                EventBus.emit('history:changed', {
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
    }

    // グローバルインスタンス生成 (既存を上書き)
    window.History = new HistoryManager();

})();