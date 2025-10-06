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

class History {
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
         * 
         * 例:
         * stack = [cmd1, cmd2, cmd3]
         * index = 2  → cmd3まで適用済み、canUndo()=true, canRedo()=false
         * index = 1  → cmd2まで適用済み、canUndo()=true, canRedo()=true
         * index = -1 → 何も適用されていない、canUndo()=false
         */
        this.index = -1;
        
        /**
         * 再入防止フラグ
         * undo/redo実行中はtrueになり、この間のpush()は無視される
         */
        this.isApplying = false;
        
        /**
         * 履歴保持の上限
         * この数を超えると古い履歴から削除される
         */
        this.maxSize = 500;
        
        // ========== Phase 1: 改修 END ==========
    }

    /**
     * コマンドを履歴に追加して実行
     * 
     * @param {Object} command - コマンドオブジェクト
     * @param {string} command.name - コマンド名（デバッグ用）
     * @param {Function} command.do - 実行処理
     * @param {Function} command.undo - 取り消し処理
     * @param {Object} [command.meta] - メタ情報（オプション）
     * 
     * @example
     * History.push({
     *     name: 'draw-stroke',
     *     do: () => { layer.strokes.push(stroke); },
     *     undo: () => { layer.strokes.pop(); },
     *     meta: { type: 'stroke', layerId: 'layer_001' }
     * });
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
            // 例: stack=[A,B,C,D], index=1(Bまで適用) の状態で新規push
            //     → [A,B] だけ残して [C,D] を削除
            this.stack.splice(this.index + 1);
            
            // コマンド実行
            // 新規コマンドなので do() を実行
            command.do();
            
            // 履歴に追加
            this.stack.push(command);
            this.index++;
            
            // 上限チェック
            if (this.stack.length > this.maxSize) {
                // 最古の履歴を削除
                this.stack.shift();
                this.index--;
            }
            
            // UI更新通知
            this._notifyHistoryChanged();
            
        } catch (error) {
            // コマンド実行に失敗した場合は履歴に追加しない
            console.error('[History] Command execution failed:', error);
            console.error('[History] Failed command:', command);
            // spliceで既に削除した分岐履歴はそのまま（ロールバック不要）
            
        } finally {
            // 必ず再入防止フラグをOFF
            this.isApplying = false;
        }
        
        // ========== Phase 1: 改修 END ==========
    }

    /**
     * 1つ前の状態に戻す
     * 
     * @returns {boolean} - 実行成功した場合true
     */
    undo() {
        // ========== Phase 1: 改修 START ==========
        
        // Undo不可能な状態チェック
        if (!this.canUndo()) {
            return false;
        }
        
        // 再入防止
        if (this.isApplying) {
            return false;
        }
        
        try {
            // 再入防止フラグをON
            this.isApplying = true;
            
            // 現在のコマンドを取り消す
            // index が指すコマンドは「適用済み」なので、それをundoする
            const command = this.stack[this.index];
            command.undo();
            
            // indexを1つ戻す
            this.index--;
            
            // UI更新通知
            this._notifyHistoryChanged();
            
            return true;
            
        } catch (error) {
            // undo失敗時はエラーログのみ
            // indexは変更しない（整合性維持のため）
            console.error('[History] Undo failed:', error);
            console.error('[History] Failed command:', this.stack[this.index]);
            return false;
            
        } finally {
            // 必ず再入防止フラグをOFF
            this.isApplying = false;
        }
        
        // ========== Phase 1: 改修 END ==========
    }

    /**
     * 1つ先の状態に進む
     * 
     * @returns {boolean} - 実行成功した場合true
     */
    redo() {
        // ========== Phase 1: 改修 START ==========
        
        // Redo不可能な状態チェック
        if (!this.canRedo()) {
            return false;
        }
        
        // 再入防止
        if (this.isApplying) {
            return false;
        }
        
        try {
            // 再入防止フラグをON
            this.isApplying = true;
            
            // indexを1つ進める
            this.index++;
            
            // 次のコマンドを実行
            // index を進めた先のコマンドは「未適用」なので、それをdoする
            const command = this.stack[this.index];
            command.do();
            
            // UI更新通知
            this._notifyHistoryChanged();
            
            return true;
            
        } catch (error) {
            // redo失敗時はindexを戻す
            console.error('[History] Redo failed:', error);
            console.error('[History] Failed command:', this.stack[this.index]);
            this.index--;
            return false;
            
        } finally {
            // 必ず再入防止フラグをOFF
            this.isApplying = false;
        }
        
        // ========== Phase 1: 改修 END ==========
    }

    /**
     * Undo可能か判定
     * 
     * @returns {boolean}
     */
    canUndo() {
        // ========== Phase 1: 改修 START ==========
        // index >= 0 なら、少なくとも1つのコマンドが適用済み
        return this.index >= 0;
        // ========== Phase 1: 改修 END ==========
    }

    /**
     * Redo可能か判定
     * 
     * @returns {boolean}
     */
    canRedo() {
        // ========== Phase 1: 改修 START ==========
        // index < stack.length - 1 なら、未適用のコマンドが存在する
        return this.index < this.stack.length - 1;
        // ========== Phase 1: 改修 END ==========
    }

    /**
     * 履歴をクリア
     */
    clear() {
        // ========== Phase 1: 改修 START ==========
        this.stack = [];
        this.index = -1;
        this._notifyHistoryChanged();
        // ========== Phase 1: 改修 END ==========
    }

    /**
     * 複合コマンド生成
     * 複数のコマンドを1つのUndoにまとめる
     * 
     * @param {Array<Object>} commands - コマンド配列
     * @param {string} [name='composite'] - 複合コマンド名
     * @returns {Object} - 複合コマンドオブジェクト
     * 
     * @example
     * const composite = History.createComposite([
     *     { name: 'cmd1', do: ..., undo: ... },
     *     { name: 'cmd2', do: ..., undo: ... }
     * ], 'multi-operation');
     * History.push(composite);
     */
    createComposite(commands, name = 'composite') {
        // ========== Phase 1: 改修 START ==========
        
        // 全コマンドの検証
        const allValid = commands.every(cmd => this._validateCommand(cmd));
        if (!allValid) {
            console.error('[History] Invalid command in composite:', commands);
            return null;
        }
        
        return {
            name: name,
            do: () => {
                // 全コマンドを順番に実行
                commands.forEach(cmd => cmd.do());
            },
            undo: () => {
                // 全コマンドを逆順で取り消し（後入れ先出し）
                commands.slice().reverse().forEach(cmd => cmd.undo());
            },
            meta: {
                type: 'composite',
                count: commands.length,
                commands: commands.map(cmd => cmd.name)
            }
        };
        
        // ========== Phase 1: 改修 END ==========
    }

    /**
     * コマンド構造の検証
     * 
     * @private
     * @param {Object} command - 検証対象のコマンド
     * @returns {boolean}
     */
    _validateCommand(command) {
        // ========== Phase 1: 改修 START ==========
        
        if (!command) {
            return false;
        }
        
        // 必須プロパティのチェック
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
        
        // ========== Phase 1: 改修 END ==========
    }

    /**
     * 履歴変更イベント発火
     * 
     * @private
     */
    _notifyHistoryChanged() {
        // ========== Phase 1: 改修 START ==========
        
        // EventBusが存在する場合のみ発火
        if (window.EventBus) {
            EventBus.emit('history:changed', {
                canUndo: this.canUndo(),
                canRedo: this.canRedo(),
                stackSize: this.stack.length,
                currentIndex: this.index
            });
        }
        
        // ========== Phase 1: 改修 END ==========
    }

    /**
     * デバッグ用: 履歴スタックの状態表示
     */
    debug() {
        // ========== Phase 1: 改修 START ==========
        
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
        
        // ========== Phase 1: 改修 END ==========
    }
}

// ========== Phase 1: 改修 START ==========
// グローバルインスタンス生成
const History = new History();

// グローバル公開（既存コードとの互換性のため）
window.History = History;

// 開発環境でのデバッグ用
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    window.HistoryDebug = () => History.debug();
}
// ========== Phase 1: 改修 END ==========