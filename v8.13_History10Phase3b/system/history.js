/**
 * ============================================================================
 * History System - Command Pattern Implementation
 * ============================================================================
 * Phase 1: コマンドパターン完全移行
 * 
 * 【改修内容】
 * - saveState() / restoreState() を完全削除
 * - コマンドパターン方式に統一
 * - index定義の明確化（最後に適用済みのindex = -1スタート）
 * - 再入防止の完全実装
 * 
 * 【使用方法】
 * const command = {
 *     name: 'draw-stroke',
 *     do: () => { ... },      // 実行処理
 *     undo: () => { ... },    // 取り消し処理
 *     meta: { ... }           // メタ情報（オプション）
 * };
 * History.push(command);
 * 
 * ============================================================================
 */

(function() {
    'use strict';

    // 既存のインスタンスがある場合は再利用（二重宣言防止）
    if (window.History && window.History.stack) {
        console.log('✅ system/history.js already loaded');
        return;
    }

    class HistoryManager {
        constructor() {
            // ========== Phase 1: 改修 START ==========
            
            /**
             * コマンドスタック
             * 各要素は { name, do, undo, meta? } の構造
             */
            this.stack = [];
            
            /**
             * 現在のインデックス
             * 定義: 最後に適用済みのコマンドのindex
             * 初期値: -1（何も適用されていない状態）
             */
            this.index = -1;
            
            /**
             * 再入防止フラグ
             * undo/redo実行中はtrueになり、この間のpush()は無視される
             */
            this.isApplying = false;
            
            /**
             * 履歴保持の上限
             */
            this.maxSize = 500;
            
            // ========== Phase 1: 改修 END ==========
        }

        /**
         * コマンドを履歴に追加して実行
         */
        push(command) {
            // ========== Phase 1: 改修 START ==========
            
            // 再入防止: undo/redo実行中は新しいコマンドを追加しない
            if (this.isApplying) {
                return;
            }
            
            // コマンド構造の検証
            if (!this._validateCommand(command)) {
                console.error('[History] Invalid command structure:', command);
                return;
            }

            try {
                // 再入防止フラグをON
                this.isApplying = true;
                
                // 分岐した履歴を破棄
                this.stack.splice(this.index + 1);
                
                // コマンド実行
                command.do();
                
                // 履歴に追加
                this.stack.push(command);
                this.index++;
                
                // 上限チェック
                if (this.stack.length > this.maxSize) {
                    this.stack.shift();
                    this.index--;
                }
                
                // UI更新通知
                this._notifyHistoryChanged();
                
            } catch (error) {
                console.error('[History] Command execution failed:', error);
                
            } finally {
                // 必ず再入防止フラグをOFF
                this.isApplying = false;
            }
            
            // ========== Phase 1: 改修 END ==========
        }

        /**
         * 1つ前の状態に戻す
         */
        undo() {
            // ========== Phase 1: 改修 START ==========
            
            if (!this.canUndo()) {
                return false;
            }
            
            if (this.isApplying) {
                return false;
            }
            
            try {
                this.isApplying = true;
                
                const command = this.stack[this.index];
                command.undo();
                
                this.index--;
                
                this._notifyHistoryChanged();
                
                return true;
                
            } catch (error) {
                console.error('[History] Undo failed:', error);
                return false;
                
            } finally {
                this.isApplying = false;
            }
            
            // ========== Phase 1: 改修 END ==========
        }

        /**
         * 1つ先の状態に進む
         */
        redo() {
            // ========== Phase 1: 改修 START ==========
            
            if (!this.canRedo()) {
                return false;
            }
            
            if (this.isApplying) {
                return false;
            }
            
            try {
                this.isApplying = true;
                
                this.index++;
                
                const command = this.stack[this.index];
                command.do();
                
                this._notifyHistoryChanged();
                
                return true;
                
            } catch (error) {
                console.error('[History] Redo failed:', error);
                this.index--;
                return false;
                
            } finally {
                this.isApplying = false;
            }
            
            // ========== Phase 1: 改修 END ==========
        }

        /**
         * Undo可能か判定
         */
        canUndo() {
            return this.index >= 0;
        }

        /**
         * Redo可能か判定
         */
        canRedo() {
            return this.index < this.stack.length - 1;
        }

        /**
         * 履歴をクリア
         */
        clear() {
            this.stack = [];
            this.index = -1;
            this._notifyHistoryChanged();
        }

        /**
         * 複合コマンド生成
         */
        createComposite(commands, name = 'composite') {
            const allValid = commands.every(cmd => this._validateCommand(cmd));
            if (!allValid) {
                console.error('[History] Invalid command in composite:', commands);
                return null;
            }
            
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
                    count: commands.length,
                    commands: commands.map(cmd => cmd.name)
                }
            };
        }

        /**
         * コマンド構造の検証
         * @private
         */
        _validateCommand(command) {
            if (!command) {
                return false;
            }
            
            if (typeof command.name !== 'string' || command.name.length === 0) {
                console.error('[History] Command name must be a non-empty string');
                return false;
            }
            
            if (typeof command.do !== 'function') {
                console.error('[History] Command.do must be a function');
                return false;
            }
            
            if (typeof command.undo !== 'function') {
                console.error('[History] Command.undo must be a function');
                return false;
            }
            
            return true;
        }

        /**
         * 履歴変更イベント発火
         * @private
         */
        _notifyHistoryChanged() {
            if (window.EventBus || window.TegakiEventBus) {
                const eventBus = window.EventBus || window.TegakiEventBus;
                eventBus.emit('history:changed', {
                    canUndo: this.canUndo(),
                    canRedo: this.canRedo(),
                    stackSize: this.stack.length,
                    currentIndex: this.index
                });
            }
        }

        /**
         * デバッグ用: 履歴スタックの状態表示
         */
        debug() {
            console.group('[History] Debug Info');
            console.log('Stack:', this.stack.map((cmd, i) => {
                const marker = i === this.index ? '→' : ' ';
                return `${marker} ${i}: ${cmd.name}`;
            }));
            console.log('Current Index:', this.index);
            console.log('Stack Length:', this.stack.length);
            console.log('Can Undo:', this.canUndo());
            console.log('Can Redo:', this.canRedo());
            console.log('Is Applying:', this.isApplying);
            console.groupEnd();
        }
    }

    // ========== Phase 1: 改修 START ==========
    // グローバルインスタンス生成（二重宣言を回避）
    window.History = new HistoryManager();
    
    // 開発環境でのデバッグ用
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        window.HistoryDebug = () => window.History.debug();
    }
    
    console.log('✅ system/history.js Phase 1 loaded');
    // ========== Phase 1: 改修 END ==========
    
})();