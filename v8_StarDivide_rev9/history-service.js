/**
 * ==========================================================
 * @module HistoryService
 * @role   操作履歴の記録と Undo/Redo 管理
 * @depends MainController (イベント経由)
 * @provides
 *   - record(action): 新しいアクションを履歴に追加
 *   - handleUndo(): 直前のアクションを取り消す
 *   - handleRedo(): 取り消したアクションをやり直す
 *   - getState(): 履歴状態の取得
 *   - clear(): 履歴のクリア
 * @notes
 *   - 全ての確定イベントは必ず主星経由でここに登録される。
 *   - 衛星同士で直接アクセスしないこと。
 *   - コンソールログはdebugフラグで制御する。
 * ==========================================================
 */
window.MyApp = window.MyApp || {};
(function(global){
    class HistoryService {
        constructor() {
            this.name = 'HistoryService';
            this.mainApi = null;
            this.stack = [];
            this.index = -1;
            this.maxSize = 50; // メモリ使用量を抑制
        }

        register(mainApi) { 
            this.mainApi = mainApi; 
        }

        record(action) {
            // action: {type, payload, snapshot?, timestamp}
            if (!action || !action.type) return;
            
            // 現在より後の履歴を削除
            this.stack = this.stack.slice(0, this.index + 1);
            this.stack.push(action);
            this.index++;
            
            // サイズ制限
            if(this.stack.length > this.maxSize) {
                const removeCount = this.stack.length - this.maxSize;
                this.stack.splice(0, removeCount);
                this.index -= removeCount;
            }
            
            if(this.mainApi && this.mainApi.debugMode) {
                console.log('[History] record:', action.type);
            }
        }

        handleUndo() {
            if(this.index < 0) return;
            
            const action = this.stack[this.index--];
            this._applyUndoAction(action);
            
            if(this.mainApi && this.mainApi.debugMode) {
                console.log('[History] undo:', action.type);
            }
        }

        handleRedo() {
            if(this.index >= this.stack.length - 1) return;
            
            const action = this.stack[++this.index];
            this._applyRedoAction(action);
            
            if(this.mainApi && this.mainApi.debugMode) {
                console.log('[History] redo:', action.type);
            }
        }

        _applyUndoAction(action) {
            // 簡易Undo実装（主要操作のみ）
            switch(action.type) {
                case 'stroke':
                    // ストロークの削除（実装は簡略化）
                    if(this.mainApi && this.mainApi.debugMode) {
                        console.log('[History] Undo stroke:', action.payload.pathId);
                    }
                    break;
                case 'layerReorder':
                    // レイヤー順序の復元
                    if(this.mainApi && action.payload) {
                        // fromIndex と toIndex を逆転して復元
                        this.mainApi.notify({
                            type: 'layers.reorderRequest',
                            payload: {
                                fromIndex: action.payload.toIndex,
                                toIndex: action.payload.fromIndex
                            }
                        });
                    }
                    break;
                default:
                    if(this.mainApi && this.mainApi.debugMode) {
                        console.log('[History] Undo not implemented for:', action.type);
                    }
            }
        }

        _applyRedoAction(action) {
            // 簡易Redo実装
            switch(action.type) {
                case 'stroke':
                    // ストロークの復元
                    if(this.mainApi && this.mainApi.debugMode) {
                        console.log('[History] Redo stroke:', action.payload.pathId);
                    }
                    break;
                case 'layerReorder':
                    // レイヤー順序の再適用
                    if(this.mainApi && action.payload) {
                        this.mainApi.notify({
                            type: 'layers.reorderRequest',
                            payload: action.payload
                        });
                    }
                    break;
                default:
                    if(this.mainApi && this.mainApi.debugMode) {
                        console.log('[History] Redo not implemented for:', action.type);
                    }
            }
        }

        getState() {
            return {
                canUndo: this.index >= 0,
                canRedo: this.index < this.stack.length - 1,
                total: this.stack.length,
                currentIndex: this.index
            };
        }

        clear() {
            this.stack = [];
            this.index = -1;
            if(this.mainApi && this.mainApi.debugMode) {
                console.log('[History] cleared');
            }
        }
    }

    global.MyApp.HistoryService = HistoryService;
})(window);