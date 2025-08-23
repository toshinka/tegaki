/**
 * EventBus - アプリケーション全体のイベント中継システム
 * 
 * 責務:
 * - Manager間の疎結合通信
 * - イベントの登録・削除・発火
 * - デバッグ用イベント追跡
 * 
 * 依存: なし（基盤クラス）
 * 公開: window.EventBus
 */

class EventBus {
    constructor() {
        this.events = new Map();
        this.debugMode = false;
    }

    /**
     * イベントリスナーを登録
     * @param {string} event - イベント名
     * @param {function} callback - コールバック関数
     * @param {object} context - thisコンテキスト（オプション）
     */
    on(event, callback, context = null) {
        if (typeof event !== 'string') {
            throw new Error('Event name must be a string');
        }
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function');
        }

        if (!this.events.has(event)) {
            this.events.set(event, []);
        }

        const listener = {
            callback,
            context,
            id: this._generateListenerId()
        };

        this.events.get(event).push(listener);

        if (this.debugMode) {
            console.log(`[EventBus] Registered listener for "${event}"`, listener.id);
        }

        // リスナー削除用の関数を返す
        return () => this.off(event, callback, context);
    }

    /**
     * イベントリスナーを削除
     * @param {string} event - イベント名
     * @param {function} callback - コールバック関数
     * @param {object} context - thisコンテキスト（オプション）
     */
    off(event, callback, context = null) {
        if (!this.events.has(event)) {
            return false;
        }

        const listeners = this.events.get(event);
        const index = listeners.findIndex(listener => 
            listener.callback === callback && listener.context === context
        );

        if (index !== -1) {
            const removedListener = listeners.splice(index, 1)[0];
            
            if (this.debugMode) {
                console.log(`[EventBus] Removed listener for "${event}"`, removedListener.id);
            }

            // リスナー配列が空になったら削除
            if (listeners.length === 0) {
                this.events.delete(event);
            }
            
            return true;
        }

        return false;
    }

    /**
     * 特定イベントのすべてのリスナーを削除
     * @param {string} event - イベント名
     */
    removeAllListeners(event) {
        if (this.events.has(event)) {
            const count = this.events.get(event).length;
            this.events.delete(event);
            
            if (this.debugMode) {
                console.log(`[EventBus] Removed all ${count} listeners for "${event}"`);
            }
            
            return count;
        }
        return 0;
    }

    /**
     * イベントを発火
     * @param {string} event - イベント名
     * @param {*} data - イベントデータ
     */
    emit(event, data = null) {
        if (this.debugMode) {
            console.log(`[EventBus] Emitting "${event}"`, data);
        }

        if (!this.events.has(event)) {
            if (this.debugMode) {
                console.log(`[EventBus] No listeners for "${event}"`);
            }
            return 0;
        }

        const listeners = this.events.get(event).slice(); // コピーを作成
        let executedCount = 0;

        for (const listener of listeners) {
            try {
                if (listener.context) {
                    listener.callback.call(listener.context, data, event);
                } else {
                    listener.callback(data, event);
                }
                executedCount++;
            } catch (error) {
                console.error(`[EventBus] Error in listener for "${event}":`, error);
                // エラーが発生してもその他のリスナーは実行継続
            }
        }

        if (this.debugMode) {
            console.log(`[EventBus] Executed ${executedCount} listeners for "${event}"`);
        }

        return executedCount;
    }

    /**
     * 一度だけ実行されるイベントリスナーを登録
     * @param {string} event - イベント名
     * @param {function} callback - コールバック関数
     * @param {object} context - thisコンテキスト（オプション）
     */
    once(event, callback, context = null) {
        const onceWrapper = (data, eventName) => {
            this.off(event, onceWrapper, context);
            if (context) {
                callback.call(context, data, eventName);
            } else {
                callback(data, eventName);
            }
        };

        return this.on(event, onceWrapper, context);
    }

    /**
     * イベントが登録されているかチェック
     * @param {string} event - イベント名
     * @returns {boolean}
     */
    hasListeners(event) {
        return this.events.has(event) && this.events.get(event).length > 0;
    }

    /**
     * 登録されているイベント一覧を取得
     * @returns {string[]}
     */
    getRegisteredEvents() {
        return Array.from(this.events.keys());
    }

    /**
     * 特定イベントのリスナー数を取得
     * @param {string} event - イベント名
     * @returns {number}
     */
    getListenerCount(event) {
        return this.events.has(event) ? this.events.get(event).length : 0;
    }

    /**
     * デバッグモードの切り替え
     * @param {boolean} enabled - デバッグモード有効/無効
     */
    setDebugMode(enabled) {
        this.debugMode = enabled;
        console.log(`[EventBus] Debug mode ${enabled ? 'enabled' : 'disabled'}`);
    }

    /**
     * すべてのイベントリスナーをクリア
     */
    clear() {
        const eventCount = this.events.size;
        this.events.clear();
        
        if (this.debugMode) {
            console.log(`[EventBus] Cleared all events (${eventCount} events removed)`);
        }
    }

    /**
     * 内部統計情報を取得
     * @returns {object}
     */
    getStats() {
        const stats = {
            totalEvents: this.events.size,
            totalListeners: 0,
            events: {}
        };

        for (const [event, listeners] of this.events) {
            stats.totalListeners += listeners.length;
            stats.events[event] = listeners.length;
        }

        return stats;
    }

    /**
     * リスナーID生成（内部使用）
     * @private
     */
    _generateListenerId() {
        return `listener_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}

// グローバルインスタンスを作成・公開
window.EventBus = new EventBus();

// 開発時のデバッグ用
if (typeof window !== 'undefined' && window.location && window.location.search.includes('debug=true')) {
    window.EventBus.setDebugMode(true);
    console.log('[EventBus] Initialized with debug mode enabled');
}

console.log('[EventBus] Initialized and registered to window.EventBus');