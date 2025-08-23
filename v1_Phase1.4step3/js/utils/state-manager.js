/**
 * StateManager - アプリケーション状態管理システム
 * 
 * 責務:
 * - 現在状態管理（アクティブツール、描画中フラグなど）
 * - 状態変更の通知・追跡
 * - 一時的な状態管理（ConfigManagerとは責務分離）
 * 
 * 依存: EventBus, ErrorManager
 * 公開: window.StateManager
 */

class StateManager {
    constructor() {
        this.state = this._getInitialState();
        this.history = [];
        this.maxHistorySize = 50;
        this.subscribers = new Map();
        
        // EventBus連携
        this.eventBus = window.EventBus;
    }

    /**
     * 状態値を取得
     * @param {string} key - 状態キー（ドット記法対応）
     * @param {*} defaultValue - デフォルト値
     * @returns {*} 状態値
     */
    get(key, defaultValue = null) {
        try {
            const value = this._getNestedValue(this.state, key);
            return value !== undefined ? value : defaultValue;
        } catch (error) {
            window.ErrorManager?.handleError(error, 'StateManager.get');
            return defaultValue;
        }
    }

    /**
     * 状態値を設定
     * @param {string|object} key - 状態キーまたは状態オブジェクト
     * @param {*} value - 状態値
     * @param {boolean} notify - 変更通知を送るか
     * @returns {boolean} 成功/失敗
     */
    set(key, value = undefined, notify = true) {
        try {
            const oldState = { ...this.state };
            
            if (typeof key === 'object' && key !== null) {
                // オブジェクト一括設定
                this._setMultiple(key, notify);
            } else {
                // 単一設定
                this._setSingle(key, value, notify);
            }
            
            // 履歴に追加
            this._addToHistory(oldState, { ...this.state });
            
            return true;
        } catch (error) {
            window.ErrorManager?.handleError(error, 'StateManager.set');
            return false;
        }
    }

    /**
     * 状態の存在確認
     * @param {string} key - 状態キー
     * @returns {boolean} 存在するか
     */
    has(key) {
        try {
            return this._getNestedValue(this.state, key) !== undefined;
        } catch (error) {
            window.ErrorManager?.handleError(error, 'StateManager.has');
            return false;
        }
    }

    /**
     * 状態変更を監視
     * @param {string} key - 監視する状態キー
     * @param {function} callback - コールバック関数
     * @param {object} options - オプション
     * @returns {function} 監視解除関数
     */
    watch(key, callback, options = {}) {
        try {
            const {
                immediate = false,
                deep = false
            } = options;
            
            if (!this.subscribers.has(key)) {
                this.subscribers.set(key, []);
            }
            
            const subscriber = {
                callback,
                deep,
                id: this._generateSubscriberId()
            };
            
            this.subscribers.get(key).push(subscriber);
            
            // immediate オプションで即座に実行
            if (immediate) {
                const currentValue = this.get(key);
                callback(currentValue, undefined, key);
            }
            
            // 監視解除関数を返す
            return () => this.unwatch(key, subscriber.id);
        } catch (error) {
            window.ErrorManager?.handleError(error, 'StateManager.watch');
            return () => {};
        }
    }

    /**
     * 状態監視を解除
     * @param {string} key - 状態キー
     * @param {string} subscriberId - 購読者ID
     * @returns {boolean} 成功/失敗
     */
    unwatch(key, subscriberId) {
        try {
            if (this.subscribers.has(key)) {
                const subscribers = this.subscribers.get(key);
                const index = subscribers.findIndex(sub => sub.id === subscriberId);
                
                if (index !== -1) {
                    subscribers.splice(index, 1);
                    
                    // 購読者がいなくなったら削除
                    if (subscribers.length === 0) {
                        this.subscribers.delete(key);
                    }
                    
                    return true;
                }
            }
            return false;
        } catch (error) {
            window.ErrorManager?.handleError(error, 'StateManager.unwatch');
            return false;
        }
    }

    /**
     * 特定キーの全監視を解除
     * @param {string} key - 状態キー
     */
    unwatchAll(key) {
        if (this.subscribers.has(key)) {
            this.subscribers.delete(key);
        }
    }

    /**
     * 現在の状態を全て取得
     * @returns {object} 状態オブジェクト
     */
    getAll() {
        return { ...this.state };
    }

    /**
     * 状態をリセット
     * @param {boolean} notify - 変更通知を送るか
     */
    reset(notify = true) {
        try {
            const oldState = { ...this.state };
            this.state = this._getInitialState();
            
            if (notify) {
                this._notifyChange('*', this.state, oldState);
                this.eventBus?.emit('state:reset', this.state);
            }
            
            console.log('[StateManager] State reset to initial values');
        } catch (error) {
            window.ErrorManager?.handleError(error, 'StateManager.reset');
        }
    }

    /**
     * 状態履歴を取得
     * @param {number} limit - 取得件数制限
     * @returns {Array} 状態履歴
     */
    getHistory(limit = 10) {
        return this.history.slice(-limit);
    }

    /**
     * 状態履歴をクリア
     */
    clearHistory() {
        const count = this.history.length;
        this.history = [];
        console.log(`[StateManager] Cleared ${count} state history entries`);
    }

    /**
     * 現在の状態統計を取得
     * @returns {object} 統計情報
     */
    getStats() {
        return {
            stateKeys: Object.keys(this.state).length,
            subscribers: this.subscribers.size,
            historySize: this.history.length,
            subscriberDetails: Array.from(this.subscribers.entries()).map(([key, subs]) => ({
                key,
                subscriberCount: subs.length
            }))
        };
    }

    /**
     * 初期状態を定義
     * @private
     */
    _getInitialState() {
        return {
            // アプリケーション状態
            app: {
                initialized: false,
                loading: false,
                error: null
            },
            
            // ツール状態
            tool: {
                active: 'pen',
                previous: null,
                isDrawing: false,
                currentStroke: null
            },
            
            // キャンバス状態
            canvas: {
                isDirty: false,
                hasContent: false,
                zoom: 1.0,
                panX: 0,
                panY: 0,
                width: 1920,
                height: 1080,
                isTransforming: false
            },
            
            // UI状態
            ui: {
                activePanel: null,
                toolbarVisible: true,
                statusBarVisible: true,
                popupVisible: false,
                currentPopup: null,
                isDragging: false
            },
            
            // インタラクション状態
            interaction: {
                pointerDown: false,
                pointerType: 'mouse',
                pressure: 0,
                tiltX: 0,
                tiltY: 0,
                isTouch: false,
                multitouch: false,
                touchCount: 0
            },
            
            // 操作状態
            operation: {
                canUndo: false,
                canRedo: false,
                isUndoing: false,
                isRedoing: false,
                isSaving: false
            },
            
            // パフォーマンス状態
            performance: {
                fps: 60,
                renderTime: 0,
                drawCalls: 0,
                isThrottling: false
            },
            
            // 将来拡張用
            layers: {
                active: 0,
                count: 1,
                visible: [true]
            },
            
            shortcuts: {
                enabled: true,
                activeModifiers: []
            }
        };
    }

    /**
     * 単一状態の設定
     * @private
     */
    _setSingle(key, value, notify) {
        const oldValue = this.get(key);
        this._setNestedValue(this.state, key, value);
        
        if (notify && oldValue !== value) {
            this._notifyChange(key, value, oldValue);
        }
    }

    /**
     * 複数状態の一括設定
     * @private
     */
    _setMultiple(stateObject, notify) {
        const changes = {};
        
        for (const [key, value] of Object.entries(stateObject)) {
            const oldValue = this.get(key);
            this._setNestedValue(this.state, key, value);
            
            if (oldValue !== value) {
                changes[key] = { oldValue, newValue: value };
            }
        }
        
        if (notify && Object.keys(changes).length > 0) {
            for (const [key, change] of Object.entries(changes)) {
                this._notifyChange(key, change.newValue, change.oldValue);
            }
        }
    }

    /**
     * 変更を通知
     * @private
     */
    _notifyChange(key, newValue, oldValue) {
        // 購読者に通知
        if (this.subscribers.has(key)) {
            const subscribers = this.subscribers.get(key);
            subscribers.forEach(subscriber => {
                try {
                    subscriber.callback(newValue, oldValue, key);
                } catch (error) {
                    window.ErrorManager?.handleError(error, 'StateManager.notifyChange');
                }
            });
        }
        
        // EventBusに通知
        this.eventBus?.emit('state:change', {
            key,
            newValue,
            oldValue,
            timestamp: Date.now()
        });
        
        // 特定のイベントも発火
        this.eventBus?.emit(`state:change:${key}`, {
            newValue,
            oldValue,
            timestamp: Date.now()
        });
    }

    /**
     * ネストした値を取得（ドット記法対応）
     * @private
     */
    _getNestedValue(obj, key) {
        return key.split('.').reduce((current, prop) => 
            current && current[prop] !== undefined ? current[prop] : undefined, obj
        );
    }

    /**
     * ネストした値を設定（ドット記法対応）
     * @private
     */
    _setNestedValue(obj, key, value) {
        const keys = key.split('.');
        const lastKey = keys.pop();
        const target = keys.reduce((current, prop) => {
            if (current[prop] === undefined || typeof current[prop] !== 'object') {
                current[prop] = {};
            }
            return current[prop];
        }, obj);
        
        target[lastKey] = value;
    }

    /**
     * 履歴に追加
     * @private
     */
    _addToHistory(oldState, newState) {
        this.history.push({
            timestamp: Date.now(),
            oldState,
            newState
        });
        
        // 履歴サイズ制限
        if (this.history.length > this.maxHistorySize) {
            this.history.shift();
        }
    }

    /**
     * 購読者ID生成
     * @private
     */
    _generateSubscriberId() {
        return `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}

// グローバルインスタンスを作成・公開
window.StateManager = new StateManager();

console.log('[StateManager] Initialized and registered to window.StateManager');