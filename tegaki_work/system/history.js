/**
 * ============================================================================
 * ファイル名: system/history.js
 * 責務: アンドゥ・リドゥ（履歴管理）を担当する
 * 依存: system/event-bus.js
 * 被依存: core-initializer.js, drawing-engine.js等
 * 公開API: HistoryManager, historyManager
 * イベント発火: history:changed
 * イベント受信: なし
 * グローバル登録: window.History
 * 実装状態: ♻️移植
 * ============================================================================
 */

import { TegakiEventBus } from './event-bus.js';

export class HistoryManager {
    constructor() {
        this.stack = [];
        this.index = -1;
        this.isApplying = false;
        this.maxSize = 250;
        this.maxMemoryBytes = 256 * 1024 * 1024;
        
        // 後方互換性
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
            
            if (window.TEGAKI_CONFIG?.debug) {
                console.log(`[History] Push: ${command.name}`, command.meta || {});
            }

            // 現在位置より後ろのスタックを削除
            this.stack.splice(this.index + 1);
            
            // コマンドを実行
            command.do();
            
            // スタックに追加
            this.stack.push(command);
            this.index++;
            
            this._enforceLimits();
            
            this._notifyHistoryChanged(command, 'push');
            
        } catch (error) {
            console.error('[History] Command execution failed:', error);
            this.stack.splice(this.index + 1);
        } finally {
            this.isApplying = false;
        }
    }

    record(command) {
        if (this.isApplying) {
            return;
        }

        if (!this._validateCommand(command)) {
            console.error('[History] Invalid applied command structure:', command);
            return;
        }

        this.stack.splice(this.index + 1);
        this.stack.push(command);
        this.index++;

        this._enforceLimits();

        if (window.TEGAKI_CONFIG?.debug) {
            console.log(`[History] Record applied: ${command.name}`, command.meta || {});
        }

        this._notifyHistoryChanged(command, 'record');
    }

    undo() {
        if (!this.canUndo() || this.isApplying) {
            return;
        }
        
        try {
            this.isApplying = true;
            const command = this.stack[this.index];
            
            try {
                command.undo();
            } catch (undoError) {
                console.error('[History:Undo] Exception in undo:', undoError, command);
                throw undoError;
            }
            
            this.index--;
            this._notifyHistoryChanged(command, 'undo');
            
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
            
            if (!command) {
                console.error('[History:Redo] Command is null at index:', this.index);
                this.index--;
                return;
            }

            try {
                command.do();
            } catch (doError) {
                console.error('[History:Redo] Exception in do():', doError, command);
                this.index--;
                throw doError;
            }

            this._notifyHistoryChanged(command, 'redo');
            
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
        this._notifyHistoryChanged(null, 'clear');
    }

    configureLimits(options = {}) {
        const maxEntries = Number(options.maxEntries);
        const maxMemoryMB = Number(options.maxMemoryMB);
        if (Number.isFinite(maxEntries)) {
            this.maxSize = Math.max(1, Math.round(maxEntries));
        }
        if (Number.isFinite(maxMemoryMB)) {
            this.maxMemoryBytes = Math.max(1, maxMemoryMB) * 1024 * 1024;
        }
        this._enforceLimits();
        this._notifyHistoryChanged(null, 'limits-changed');
    }

    getUsage() {
        return {
            entries: this.stack.length,
            maxEntries: this.maxSize,
            bytes: this._getTotalByteSize(),
            maxBytes: this.maxMemoryBytes
        };
    }

    _getCommandByteSize(command) {
        const declared = Number(command?.byteSize ?? command?.meta?.byteSize);
        return Number.isFinite(declared) && declared > 0 ? declared : 0;
    }

    _getTotalByteSize() {
        return this.stack.reduce((total, command) => {
            return total + this._getCommandByteSize(command);
        }, 0);
    }

    _enforceLimits() {
        let totalBytes = this._getTotalByteSize();
        while (
            this.stack.length > 0
            && (
                this.stack.length > this.maxSize
                || (this.stack.length > 1 && totalBytes > this.maxMemoryBytes)
            )
        ) {
            const removed = this.stack.shift();
            totalBytes -= this._getCommandByteSize(removed);
            this.index--;
        }
        this.index = Math.max(-1, Math.min(this.index, this.stack.length - 1));
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

    _notifyHistoryChanged(command = null, action = 'changed') {
        if (TegakiEventBus) {
            TegakiEventBus.emit('history:changed', {
                canUndo: this.canUndo(),
                canRedo: this.canRedo(),
                stackSize: this.stack.length,
                currentIndex: this.index,
                usage: this.getUsage(),
                action,
                commandName: command?.name || null,
                meta: command?.meta || null
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

export const historyManager = new HistoryManager();

// 下位互換性のためにグローバルに登録
window.History = historyManager;
