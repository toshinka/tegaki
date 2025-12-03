/**
 * ============================================================
 * system/history.js - Phase C-2.3: register()メソッド追加版
 * ============================================================
 * 【親依存】
 * - system/event-bus.js (TegakiEventBus)
 * 
 * 【子依存】
 * - system/drawing/brush-core.js (History.push呼び出し)
 * - ui/keyboard-handler.js (undo/redo/register呼び出し)
 * - system/batch-api.js (batch操作のHistory記録)
 * 
 * 【Phase C-2.3改修内容】
 * 🆕 register()メソッド追加
 *    - do()を実行せずにスタックに登録
 *    - keyboard-handler.jsの二重登録問題を解決
 * ✅ Phase C-2全機能継承
 * 
 * Penpot参考実装:
 * - 構造化コマンドパターン
 * - トランザクション境界管理
 * - エラー時の自動ロールバック
 * ============================================================
 */

(function() {
    'use strict';

    const CommandResult = {
        SUCCESS: 'success',
        FAILURE: 'failure',
        ROLLBACK: 'rollback'
    };

    class HistoryManager {
        constructor() {
            this.stack = [];
            this.index = -1;
            this.isApplying = false;
            this.maxSize = 500;
            
            this.transactionDepth = 0;
            this.transactionCommands = [];
            this.transactionName = null;
            
            this.lastError = null;
            this.errorCount = 0;
            
            this.stats = {
                totalCommands: 0,
                undoCount: 0,
                redoCount: 0,
                rollbackCount: 0,
                errorCount: 0
            };
            
            this._manager = this;
            this.eventBus = null;
            this._initEventBus();
        }

        _initEventBus() {
            if (window.TegakiEventBus) {
                this.eventBus = window.TegakiEventBus;
            } else if (window.eventBus) {
                this.eventBus = window.eventBus;
            } else {
                setTimeout(() => this._initEventBus(), 100);
            }
        }

        _validateCommand(command) {
            if (!command) {
                console.error('[History] Command is null or undefined');
                return false;
            }

            if (typeof command.name !== 'string' || command.name.trim() === '') {
                console.error('[History] Invalid command name:', command);
                return false;
            }

            if (typeof command.do !== 'function') {
                console.error('[History] Command missing do() function:', command.name);
                return false;
            }

            if (typeof command.undo !== 'function') {
                console.error('[History] Command missing undo() function:', command.name);
                return false;
            }

            if (!command.meta || typeof command.meta !== 'object') {
                console.warn('[History] Command missing meta object:', command.name);
            }

            return true;
        }

        _executeCommand(command, operation, operationName) {
            try {
                if (!command || typeof command[operation] !== 'function') {
                    throw new Error(`Command missing ${operation}() function`);
                }

                command[operation]();
                return CommandResult.SUCCESS;

            } catch (error) {
                this.lastError = {
                    command: command.name,
                    operation: operationName,
                    error: error,
                    timestamp: Date.now()
                };
                this.errorCount++;
                this.stats.errorCount++;

                console.error(`[History:${operationName}] Execution failed:`, {
                    command: command.name,
                    error: error.message,
                    stack: error.stack
                });

                return CommandResult.FAILURE;
            }
        }

        beginTransaction(name = 'transaction') {
            this.transactionDepth++;
            
            if (this.transactionDepth === 1) {
                this.transactionCommands = [];
                this.transactionName = name;
            }
        }

        endTransaction() {
            if (this.transactionDepth === 0) {
                console.warn('[History] endTransaction called without beginTransaction');
                return;
            }

            this.transactionDepth--;

            if (this.transactionDepth === 0 && this.transactionCommands.length > 0) {
                const composite = this.createComposite(
                    this.transactionCommands,
                    this.transactionName || 'transaction'
                );
                
                this._pushInternal(composite);
                
                this.transactionCommands = [];
                this.transactionName = null;
            }
        }

        rollbackTransaction() {
            if (this.transactionDepth === 0) {
                console.warn('[History] rollbackTransaction called without active transaction');
                return;
            }

            const commands = [...this.transactionCommands].reverse();
            
            for (const cmd of commands) {
                try {
                    cmd.undo();
                } catch (error) {
                    console.error('[History] Rollback failed:', error);
                }
            }

            this.transactionCommands = [];
            this.transactionName = null;
            this.transactionDepth = 0;
            this.stats.rollbackCount++;
        }

        _pushInternal(command) {
            if (this.isApplying) {
                console.warn('[History] Cannot push command while applying');
                return false;
            }

            if (!this._validateCommand(command)) {
                return false;
            }

            try {
                this.isApplying = true;

                console.log(`[History:Push] Before: index=${this.index}, stack=${this.stack.length}, cmd="${command.name}"`);

                const discarded = this.stack.splice(this.index + 1);
                if (discarded.length > 0) {
                    console.log(`[History:Push] Discarded ${discarded.length} redo commands`);
                }
                
                const result = this._executeCommand(command, 'do', 'Push');
                
                if (result !== CommandResult.SUCCESS) {
                    this.stack.push(...discarded);
                    console.error('[History:Push] Command execution failed, stack restored');
                    return false;
                }

                this.stack.push(command);
                this.index++;
                this.stats.totalCommands++;

                console.log(`[History:Push] After: index=${this.index}, stack=${this.stack.length}`);

                if (this.stack.length > this.maxSize) {
                    const removed = this.stack.shift();
                    this.index--;
                    console.log(`[History:Push] Stack size limit reached, removed oldest command`);
                    
                    if (removed.cleanup && typeof removed.cleanup === 'function') {
                        try {
                            removed.cleanup();
                        } catch (e) {
                            console.warn('[History] Cleanup failed:', e);
                        }
                    }
                }

                this._notifyHistoryChanged();
                return true;

            } catch (error) {
                console.error('[History] Command push failed:', error);
                return false;

            } finally {
                this.isApplying = false;
            }
        }

        push(command) {
            if (this.transactionDepth > 0) {
                if (this._validateCommand(command)) {
                    this.transactionCommands.push(command);
                }
                return;
            }

            return this._pushInternal(command);
        }

        /**
         * 🆕 Phase C-2.3: register()メソッド追加
         * do()を実行せずにスタックに登録
         * @param {Object} command - 登録するコマンド
         * @returns {boolean} 成功/失敗
         */
        register(command) {
            if (this.isApplying) {
                console.warn('[History:Register] Cannot register command while applying');
                return false;
            }

            if (!this._validateCommand(command)) {
                return false;
            }

            try {
                this.isApplying = true;

                console.log(`[History:Register] Before: index=${this.index}, stack=${this.stack.length}, cmd="${command.name}"`);

                // 現在位置より後ろのスタックを削除（Redo破棄）
                const discarded = this.stack.splice(this.index + 1);
                if (discarded.length > 0) {
                    console.log(`[History:Register] Discarded ${discarded.length} redo commands`);
                }

                // 🚨 重要: do()を実行せずにスタックに追加
                this.stack.push(command);
                this.index++;
                this.stats.totalCommands++;

                console.log(`[History:Register] After: index=${this.index}, stack=${this.stack.length} (do not executed)`);

                // スタックサイズ制限
                if (this.stack.length > this.maxSize) {
                    const removed = this.stack.shift();
                    this.index--;
                    console.log(`[History:Register] Stack size limit reached, removed oldest command`);
                    
                    if (removed.cleanup && typeof removed.cleanup === 'function') {
                        try {
                            removed.cleanup();
                        } catch (e) {
                            console.warn('[History] Cleanup failed:', e);
                        }
                    }
                }

                this._notifyHistoryChanged();
                return true;

            } catch (error) {
                console.error('[History:Register] Command registration failed:', error);
                return false;

            } finally {
                this.isApplying = false;
            }
        }

        undo() {
            if (!this.canUndo() || this.isApplying) {
                console.log('[History:Undo] Cannot undo:', { canUndo: this.canUndo(), isApplying: this.isApplying });
                return false;
            }

            try {
                this.isApplying = true;
                const command = this.stack[this.index];

                console.log(`[History:Undo] Before: index=${this.index}, stack=${this.stack.length}, cmd="${command?.name}"`);

                if (!command) {
                    console.error('[History:Undo] Command not found at index:', this.index);
                    return false;
                }

                const result = this._executeCommand(command, 'undo', 'Undo');

                if (result !== CommandResult.SUCCESS) {
                    console.error('[History:Undo] Failed to undo command:', command.name);
                    return false;
                }

                this.index--;
                this.stats.undoCount++;
                
                console.log(`[History:Undo] After: index=${this.index}, stack=${this.stack.length}`);
                console.log(`[History:Undo] Next undo will be: ${this.stack[this.index]?.name || 'none'}`);
                
                this._notifyHistoryChanged();

                return true;

            } catch (error) {
                console.error('[History] Undo failed:', error);
                return false;

            } finally {
                this.isApplying = false;
            }
        }

        redo() {
            if (!this.canRedo() || this.isApplying) {
                return false;
            }

            try {
                this.isApplying = true;
                
                const nextIndex = this.index + 1;
                const command = this.stack[nextIndex];

                if (!command) {
                    console.error('[History:Redo] Command not found at index:', nextIndex);
                    return false;
                }

                const result = this._executeCommand(command, 'do', 'Redo');

                if (result !== CommandResult.SUCCESS) {
                    console.error('[History:Redo] Failed to redo command:', command.name);
                    return false;
                }

                this.index = nextIndex;
                this.stats.redoCount++;
                this._notifyHistoryChanged();

                return true;

            } catch (error) {
                console.error('[History] Redo failed:', error);
                return false;

            } finally {
                this.isApplying = false;
            }
        }

        canUndo() {
            return this.index >= 0 && this.stack.length > 0;
        }

        canRedo() {
            return this.index < this.stack.length - 1;
        }

        clear() {
            for (const cmd of this.stack) {
                if (cmd.cleanup && typeof cmd.cleanup === 'function') {
                    try {
                        cmd.cleanup();
                    } catch (e) {
                        console.warn('[History] Cleanup failed:', e);
                    }
                }
            }

            this.stack = [];
            this.index = -1;
            this.transactionDepth = 0;
            this.transactionCommands = [];
            this.transactionName = null;
            
            this._notifyHistoryChanged();
        }

        createComposite(commands, name = 'composite') {
            if (!Array.isArray(commands) || commands.length === 0) {
                console.error('[History] Invalid commands for composite:', commands);
                return null;
            }

            for (const cmd of commands) {
                if (!this._validateCommand(cmd)) {
                    console.error('[History] Invalid command in composite:', cmd);
                    return null;
                }
            }

            return {
                name: name,
                do: () => {
                    for (const cmd of commands) {
                        const result = this._executeCommand(cmd, 'do', 'Composite-Do');
                        if (result !== CommandResult.SUCCESS) {
                            throw new Error(`Composite command failed at: ${cmd.name}`);
                        }
                    }
                },
                undo: () => {
                    const reversed = [...commands].reverse();
                    for (const cmd of reversed) {
                        const result = this._executeCommand(cmd, 'undo', 'Composite-Undo');
                        if (result !== CommandResult.SUCCESS) {
                            throw new Error(`Composite undo failed at: ${cmd.name}`);
                        }
                    }
                },
                cleanup: () => {
                    for (const cmd of commands) {
                        if (cmd.cleanup && typeof cmd.cleanup === 'function') {
                            try {
                                cmd.cleanup();
                            } catch (e) {
                                console.warn('[History] Composite cleanup failed:', e);
                            }
                        }
                    }
                },
                meta: {
                    type: 'composite',
                    count: commands.length,
                    commands: commands.map(c => ({
                        name: c.name,
                        meta: c.meta
                    }))
                }
            };
        }

        _notifyHistoryChanged() {
            if (this.eventBus) {
                this.eventBus.emit('history:changed', {
                    canUndo: this.canUndo(),
                    canRedo: this.canRedo(),
                    stackSize: this.stack.length,
                    currentIndex: this.index,
                    stats: { ...this.stats }
                });
            }
        }

        debug() {
            console.group('[History] Debug Info');
            console.log('Stack Size:', this.stack.length);
            console.log('Current Index:', this.index);
            console.log('Can Undo:', this.canUndo());
            console.log('Can Redo:', this.canRedo());
            console.log('Transaction Depth:', this.transactionDepth);
            console.log('Stats:', this.stats);
            
            if (this.lastError) {
                console.warn('Last Error:', this.lastError);
            }
            
            console.log('Stack Commands:');
            this.stack.forEach((cmd, idx) => {
                const marker = idx === this.index ? '→' : ' ';
                const meta = cmd.meta || {};
                console.log(`  ${marker} [${idx}] ${cmd.name}`, meta);
            });
            
            console.groupEnd();
        }

        testUndo(count = 2) {
            console.group(`[History:Test] Running ${count} consecutive undos`);
            
            for (let i = 0; i < count; i++) {
                console.log(`\n--- Undo ${i + 1}/${count} ---`);
                const success = this.undo();
                console.log(`Result: ${success ? '✅ Success' : '❌ Failed'}`);
                
                if (!success) {
                    console.error(`Undo ${i + 1} failed, stopping test`);
                    break;
                }
            }
            
            console.log('\n--- Final State ---');
            this.debug();
            console.groupEnd();
        }

        testIntegrity() {
            console.group('[History:Test] Integrity Check');
            
            const issues = [];
            
            if (this.index < -1) {
                issues.push(`Index too low: ${this.index}`);
            }
            if (this.index >= this.stack.length) {
                issues.push(`Index out of bounds: ${this.index} >= ${this.stack.length}`);
            }
            
            this.stack.forEach((cmd, idx) => {
                if (!cmd) {
                    issues.push(`Null command at [${idx}]`);
                } else if (!this._validateCommand(cmd)) {
                    issues.push(`Invalid command at [${idx}]: ${cmd.name}`);
                }
            });
            
            if (this.transactionDepth < 0) {
                issues.push(`Negative transaction depth: ${this.transactionDepth}`);
            }
            
            if (issues.length === 0) {
                console.log('✅ Stack integrity OK');
            } else {
                console.error('❌ Integrity issues found:', issues);
            }
            
            console.groupEnd();
            return issues.length === 0;
        }

        validate() {
            const issues = [];

            if (this.index < -1 || this.index >= this.stack.length) {
                issues.push(`Invalid index: ${this.index} (stack size: ${this.stack.length})`);
            }

            this.stack.forEach((cmd, idx) => {
                if (!this._validateCommand(cmd)) {
                    issues.push(`Invalid command at index ${idx}: ${cmd?.name || 'unknown'}`);
                }
            });

            if (issues.length > 0) {
                console.error('[History] Validation failed:', issues);
                return false;
            }

            return true;
        }

        getStats() {
            return {
                ...this.stats,
                stackSize: this.stack.length,
                currentIndex: this.index,
                canUndo: this.canUndo(),
                canRedo: this.canRedo(),
                errorRate: this.stats.totalCommands > 0 
                    ? (this.stats.errorCount / this.stats.totalCommands * 100).toFixed(2) + '%'
                    : '0%'
            };
        }

        getLastCommand() {
            return this.stack[this.index] || null;
        }

        getStack() {
            return this.stack.map((cmd, idx) => ({
                index: idx,
                name: cmd.name,
                isCurrent: idx === this.index,
                meta: cmd.meta || {}
            }));
        }

        getCommandMetaDetails(index) {
            if (index < 0 || index >= this.stack.length) {
                return null;
            }

            const cmd = this.stack[index];
            return {
                name: cmd.name,
                meta: cmd.meta || {},
                hasCleanup: typeof cmd.cleanup === 'function'
            };
        }

        setMaxSize(size) {
            if (typeof size !== 'number' || size < 1) {
                console.error('[History] Invalid max size:', size);
                return;
            }

            this.maxSize = size;

            while (this.stack.length > this.maxSize) {
                const removed = this.stack.shift();
                this.index--;
                
                if (removed.cleanup && typeof removed.cleanup === 'function') {
                    try {
                        removed.cleanup();
                    } catch (e) {
                        console.warn('[History] Cleanup failed:', e);
                    }
                }
            }
        }
    }

    window.History = new HistoryManager();
    window.historyManager = window.History;

    console.log('✅ history.js Phase C-2.3 loaded');
    console.log('   🆕 register()メソッド追加（do実行なし）');
    console.log('   ✅ Phase C-2全機能継承');

})();