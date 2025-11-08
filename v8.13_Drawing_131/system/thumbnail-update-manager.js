// system/history.js - アンドゥ/リドゥ完全復旧版
// ===================================================================
// 【依存ファイル】
// - event-bus.js (window.TegakiEventBus)
//
// 【このファイルに依存するファイル】
// - keyboard-handler.js (Ctrl+Z/Y処理)
// - layer-system.js (履歴登録)
// - drawing-clipboard.js (履歴登録)
//
// 【主要メソッド】
// - push(command): コマンド登録・実行
// - undo(): 一つ戻る
// - redo(): 一つ進む
// - canUndo()/canRedo(): 実行可能判定
//
// 【Phase 3完全修正内容】
// ✅ EventBus統一: window.TegakiEventBus使用
// ✅ Redo null参照エラー修正
// ✅ コマンド実行時の例外ハンドリング強化
// ✅ 履歴変更通知の確実な実行
// ✅ デバッグ機能追加
// ===================================================================

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
            
            this._setupEventBus();
        }

        /**
         * EventBusリスナー設定
         */
        _setupEventBus() {
            // EventBusの初期化を待つ
            const checkEventBus = () => {
                if (window.TegakiEventBus) {
                    // 何もしない（現在は外部からの履歴操作イベントはない）
                } else {
                    setTimeout(checkEventBus, 50);
                }
            };
            checkEventBus();
        }

        /**
         * コマンドを実行・スタックに追加
         */
        push(command) {
            if (this.isApplying) {
                console.warn('[History] Ignoring push during undo/redo');
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
                try {
                    command.do();
                } catch (doError) {
                    console.error('[History] Command execution failed during push:', doError);
                    throw doError;
                }
                
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
                console.error('[History] Push failed, rolling back:', error);
                this.stack.splice(this.index + 1);
            } finally {
                this.isApplying = false;
            }
        }

        /**
         * 一つ戻る
         */
        undo() {
            if (!this.canUndo() || this.isApplying) {
                console.warn('[History] Cannot undo:', { canUndo: this.canUndo(), isApplying: this.isApplying });
                return;
            }
            
            try {
                this.isApplying = true;
                const command = this.stack[this.index];
                
                if (!command) {
                    console.error('[History:Undo] Command is null at index:', this.index);
                    return;
                }
                
                console.log('[History:Undo] Executing:', command.name, 'Index:', this.index);
                
                try {
                    command.undo();
                } catch (undoError) {
                    console.error('[History:Undo] Exception in undo:', undoError, command);
                    throw undoError;
                }
                
                this.index--;
                this._notifyHistoryChanged();
                
                console.log('[History:Undo] Success, new index:', this.index);
                
            } catch (error) {
                console.error('[History] Undo failed:', error);
            } finally {
                this.isApplying = false;
            }
        }

        /**
         * 一つ進む
         */
        redo() {
            if (!this.canRedo() || this.isApplying) {
                console.warn('[History] Cannot redo:', { canRedo: this.canRedo(), isApplying: this.isApplying });
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

                console.log('[History:Redo] Executing:', command.name, 'Index:', this.index);

                try {
                    command.do();
                } catch (doError) {
                    console.error('[History:Redo] Exception in do():', doError, command);
                    this.index--;
                    throw doError;
                }

                this._notifyHistoryChanged();
                
                console.log('[History:Redo] Success, new index:', this.index);
                
            } catch (error) {
                console.error('[History] Redo failed:', error);
                this.index--;
            } finally {
                this.isApplying = false;
            }
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
            console.log('[History] Cleared');
        }

        /**
         * 複合コマンド作成
         */
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

        /**
         * コマンド構造の検証
         */
        _validateCommand(command) {
            return (
                command &&
                typeof command.name === 'string' &&
                typeof command.do === 'function' &&
                typeof command.undo === 'function'
            );
        }

        /**
         * 履歴変更通知
         */
        _notifyHistoryChanged() {
            if (window.TegakiEventBus) {
                window.TegakiEventBus.emit('history:changed', {
                    canUndo: this.canUndo(),
                    canRedo: this.canRedo(),
                    stackSize: this.stack.length,
                    currentIndex: this.index
                });
                
                console.log('[History] State changed:', {
                    canUndo: this.canUndo(),
                    canRedo: this.canRedo(),
                    index: this.index,
                    stackSize: this.stack.length
                });
            } else {
                console.warn('[History] TegakiEventBus not available for notification');
            }
        }

        /**
         * デバッグ情報出力
         */
        debug() {
            console.log('[History] ===== Debug Info =====');
            console.log('Stack:', this.stack.map(cmd => cmd.name));
            console.log('Index:', this.index);
            console.log('Can Undo:', this.canUndo());
            console.log('Can Redo:', this.canRedo());
            console.log('Is Applying:', this.isApplying);
            console.log('Stack Size:', this.stack.length);
            console.log('================================');
        }
        
        /**
         * 最後のコマンド取得
         */
        getLastCommand() {
            return this.stack[this.index] || null;
        }
        
        /**
         * スタック全体を取得
         */
        getStack() {
            return this.stack.map((cmd, idx) => ({
                index: idx,
                name: cmd.name,
                isCurrent: idx === this.index,
                meta: cmd.meta
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
                meta: cmd.meta,
                hasStoredStrokeObject: !!cmd.meta?._storedStrokeObject,
                storedSettings: cmd.meta?._storedSettings
            };
        }
    }

    // グローバルインスタンス作成
    window.History = new HistoryManager();
    
    // デバッグ用グローバル関数
    window.debugHistory = () => window.History.debug();
    
    console.log('✅ history.js (Phase 3: アンドゥ/リドゥ完全復旧版) loaded');
    console.log('💡 デバッグ: コンソールで debugHistory() を実行');

})();