/**
 * ============================================================
 * system/history.js - Phase C-2: Penpot参考改善版
 * ============================================================
 * 【親依存】
 * - system/event-bus.js (TegakiEventBus)
 * 
 * 【子依存】
 * - system/drawing/brush-core.js (History.push呼び出し)
 * - ui/keyboard-handler.js (undo/redo呼び出し)
 * - system/batch-api.js (batch操作のHistory記録)
 * 
 * 【Phase C-2改修内容】
 * ✅ トランザクション機構追加
 * ✅ コマンド検証強化
 * ✅ エラー回復機構統一
 * ✅ メタデータ管理拡張
 * ✅ スタック整合性保証
 * ✅ グループ化コマンド改善
 * ✅ デバッグ機能拡張
 * ✅ アンドゥ/リドゥの参照安定化
 * 
 * Penpot参考実装:
 * - 構造化コマンドパターン
 * - トランザクション境界管理
 * - エラー時の自動ロールバック
 * ============================================================
 */

(function() {
    'use strict';

    /**
     * コマンド実行結果の型定義
     */
    const CommandResult = {
        SUCCESS: 'success',
        FAILURE: 'failure',
        ROLLBACK: 'rollback'
    };

    /**
     * HistoryManager - Penpot参考改善版
     */
    class HistoryManager {
        constructor() {
            // コアスタック
            this.stack = [];
            this.index = -1;
            this.isApplying = false;
            this.maxSize = 500;
            
            // トランザクション管理
            this.transactionDepth = 0;
            this.transactionCommands = [];
            this.transactionName = null;
            
            // エラー追跡
            this.lastError = null;
            this.errorCount = 0;
            
            // 統計情報
            this.stats = {
                totalCommands: 0,
                undoCount: 0,
                redoCount: 0,
                rollbackCount: 0,
                errorCount: 0
            };
            
            // 後方互換性（既存コードが window.History._manager.isApplying を参照）
            this._manager = this;
            
            // EventBus参照
            this.eventBus = null;
            this._initEventBus();
        }

        /**
         * EventBus初期化（遅延ロード対応）
         */
        _initEventBus() {
            if (window.TegakiEventBus) {
                this.eventBus = window.TegakiEventBus;
            } else if (window.eventBus) {
                this.eventBus = window.eventBus;
            } else {
                setTimeout(() => this._initEventBus(), 100);
            }
        }

        /**
         * コマンド検証（厳格化）
         */
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

            // メタデータ検証（警告のみ）
            if (!command.meta || typeof command.meta !== 'object') {
                console.warn('[History] Command missing meta object:', command.name);
            }

            return true;
        }

        /**
         * コマンド実行ラッパー（エラーハンドリング統一）
         */
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

        /**
         * トランザクション開始
         */
        beginTransaction(name = 'transaction') {
            this.transactionDepth++;
            
            if (this.transactionDepth === 1) {
                this.transactionCommands = [];
                this.transactionName = name;
            }
        }

        /**
         * トランザクション終了（コミット）
         */
        endTransaction() {
            if (this.transactionDepth === 0) {
                console.warn('[History] endTransaction called without beginTransaction');
                return;
            }

            this.transactionDepth--;

            if (this.transactionDepth === 0 && this.transactionCommands.length > 0) {
                // トランザクション内の全コマンドをグループ化
                const composite = this.createComposite(
                    this.transactionCommands,
                    this.transactionName || 'transaction'
                );
                
                this._pushInternal(composite);
                
                this.transactionCommands = [];
                this.transactionName = null;
            }
        }

        /**
         * トランザクションロールバック
         */
        rollbackTransaction() {
            if (this.transactionDepth === 0) {
                console.warn('[History] rollbackTransaction called without active transaction');
                return;
            }

            // トランザクション内の全コマンドを逆順で undo
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

        /**
         * コマンド追加（内部実装）- デバッグ強化版
         */
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

                // 現在位置より後ろのスタックを削除（Redo破棄）
                const discarded = this.stack.splice(this.index + 1);
                if (discarded.length > 0) {
                    console.log(`[History:Push] Discarded ${discarded.length} redo commands`);
                }
                
                //⚠️ 重要: コマンド実行前のインデックス保存
                const prevIndex = this.index;
                
                // コマンド実行
                const result = this._executeCommand(command, 'do', 'Push');
                
                if (result !== CommandResult.SUCCESS) {
                    // 失敗時は破棄したスタックを復元
                    this.stack.push(...discarded);
                    console.error('[History:Push] Command execution failed, stack restored');
                    return false;
                }

                // スタックに追加
                this.stack.push(command);
                this.index++;
                this.stats.totalCommands++;

                console.log(`[History:Push] After: index=${this.index}, stack=${this.stack.length}`);

                // スタックサイズ制限
                if (this.stack.length > this.maxSize) {
                    const removed = this.stack.shift();
                    this.index--;
                    console.log(`[History:Push] Stack size limit reached, removed oldest command`);
                    
                    // 削除されたコマンドのクリーンアップ
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

        /**
         * コマンド追加（公開API）
         */
        push(command) {
            // トランザクション中はバッファに追加
            if (this.transactionDepth > 0) {
                if (this._validateCommand(command)) {
                    this.transactionCommands.push(command);
                }
                return;
            }

            return this._pushInternal(command);
        }

        /**
         * Undo実行（改善版 + デバッグ強化）
         */
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

                // Undo実行
                const result = this._executeCommand(command, 'undo', 'Undo');

                if (result !== CommandResult.SUCCESS) {
                    // 失敗時はインデックスを戻さない
                    console.error('[History:Undo] Failed to undo command:', command.name);
                    return false;
                }

                // 成功時のみインデックス更新
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

        /**
         * Redo実行（改善版）
         */
        redo() {
            if (!this.canRedo() || this.isApplying) {
                return false;
            }

            try {
                this.isApplying = true;
                
                // 次のコマンドを取得
                const nextIndex = this.index + 1;
                const command = this.stack[nextIndex];

                if (!command) {
                    console.error('[History:Redo] Command not found at index:', nextIndex);
                    return false;
                }

                // Redo実行
                const result = this._executeCommand(command, 'do', 'Redo');

                if (result !== CommandResult.SUCCESS) {
                    console.error('[History:Redo] Failed to redo command:', command.name);
                    return false;
                }

                // 成功時のみインデックス更新
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

        /**
         * Undo可能判定
         */
        canUndo() {
            return this.index >= 0 && this.stack.length > 0;
        }

        /**
         * Redo可能判定
         */
        canRedo() {
            return this.index < this.stack.length - 1;
        }

        /**
         * スタッククリア
         */
        clear() {
            // クリーンアップ実行
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

        /**
         * コンポジットコマンド作成（改善版）
         */
        createComposite(commands, name = 'composite') {
            if (!Array.isArray(commands) || commands.length === 0) {
                console.error('[History] Invalid commands for composite:', commands);
                return null;
            }

            // 全コマンド検証
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
                    // 逆順で undo
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

        /**
         * EventBus通知
         */
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

        /**
         * デバッグ情報出力（詳細版）
         */
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

        /**
         * コンソールテスト: 連続Undo実行
         */
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

        /**
         * コンソールテスト: スタック整合性チェック
         */
        testIntegrity() {
            console.group('[History:Test] Integrity Check');
            
            const issues = [];
            
            // インデックス範囲
            if (this.index < -1) {
                issues.push(`Index too low: ${this.index}`);
            }
            if (this.index >= this.stack.length) {
                issues.push(`Index out of bounds: ${this.index} >= ${this.stack.length}`);
            }
            
            // コマンド検証
            this.stack.forEach((cmd, idx) => {
                if (!cmd) {
                    issues.push(`Null command at [${idx}]`);
                } else if (!this._validateCommand(cmd)) {
                    issues.push(`Invalid command at [${idx}]: ${cmd.name}`);
                }
            });
            
            // トランザクション状態
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

        /**
         * スタック検証
         */
        validate() {
            const issues = [];

            // インデックス範囲チェック
            if (this.index < -1 || this.index >= this.stack.length) {
                issues.push(`Invalid index: ${this.index} (stack size: ${this.stack.length})`);
            }

            // 各コマンド検証
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

        /**
         * 統計情報取得
         */
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

        /**
         * 最後のコマンド取得
         */
        getLastCommand() {
            return this.stack[this.index] || null;
        }

        /**
         * スタック全体取得（デバッグ用）
         */
        getStack() {
            return this.stack.map((cmd, idx) => ({
                index: idx,
                name: cmd.name,
                isCurrent: idx === this.index,
                meta: cmd.meta || {}
            }));
        }

        /**
         * コマンドメタ詳細取得
         */
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

        /**
         * スタック容量設定
         */
        setMaxSize(size) {
            if (typeof size !== 'number' || size < 1) {
                console.error('[History] Invalid max size:', size);
                return;
            }

            this.maxSize = size;

            // 既存スタックがサイズ超過している場合は切り詰め
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

    // グローバルインスタンス作成
    window.History = new HistoryManager();
    
    // 後方互換性（一部コードが window.historyManager を参照）
    window.historyManager = window.History;

    console.log('✅ history.js Phase C-2 loaded (Penpot参考改善版 + デバッグ強化)');
    console.log('   ✅ トランザクション機構追加');
    console.log('   ✅ コマンド検証強化');
    console.log('   ✅ エラー回復機構統一');
    console.log('   ✅ スタック整合性保証');
    console.log('   ✅ アンドゥ/リドゥ安定化');
    console.log('   🔍 デバッグログ強化版');
    console.log('\n📊 Console Test Commands:');
    console.log('   History.debug() - スタック状態表示');
    console.log('   History.testUndo(2) - 連続Undo実行テスト');
    console.log('   History.testIntegrity() - 整合性チェック');
    console.log('   History.getStack() - スタック全体取得');

})();