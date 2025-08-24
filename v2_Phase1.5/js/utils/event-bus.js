/**
 * 🔄 EventBus - アプリケーション全体のイベント中継システム
 * ✅ UNIFIED_SYSTEM: 統一イベント通信・疎結合システム
 * 📋 RESPONSIBILITY: 「Manager間疎結合通信・イベント配信」専門
 * 
 * 📏 DESIGN_PRINCIPLE: 基盤システム・依存関係なし
 * 🎯 TEGAKI_NAMESPACE: Tegaki名前空間統一対応済み
 * 🔧 REGISTRY_READY: 初期化レジストリ対応済み
 * 🛡️ ERROR_SAFE: エラー連鎖防止・安全発行対応
 * 
 * 依存: なし（基盤クラス）
 * 公開: Tegaki.EventBus, Tegaki.EventBusInstance
 */

// Tegaki名前空間初期化
window.Tegaki = window.Tegaki || {};

class EventBus {
    constructor() {
        this.listeners = {};  // 改修手順書テンプレートに合わせてeventsからlistenersに変更
        this.debugMode = false;
        this.errorCount = 0;
        this.maxErrorCount = 10; // エラー連鎖防止
    }

    /**
     * イベントリスナーを登録（改修手順書対応）
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

        // 改修手順書テンプレートに合わせた初期化
        this.listeners[event] = this.listeners[event] || [];

        const listener = {
            callback,
            context,
            id: this._generateListenerId()
        };

        this.listeners[event].push(listener);

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
        if (!this.listeners[event]) {
            return false;
        }

        const listenerArray = this.listeners[event];
        const index = listenerArray.findIndex(listener => 
            listener.callback === callback && listener.context === context
        );

        if (index !== -1) {
            const removedListener = listenerArray.splice(index, 1)[0];
            
            if (this.debugMode) {
                console.log(`[EventBus] Removed listener for "${event}"`, removedListener.id);
            }

            // リスナー配列が空になったら削除
            if (listenerArray.length === 0) {
                delete this.listeners[event];
            }
            
            return true;
        }

        return false;
    }

    /**
     * イベントを発火（改修手順書対応）
     * @param {string} event - イベント名
     * @param {*} data - イベントデータ
     */
    emit(event, data = null) {
        if (this.debugMode) {
            console.log(`[EventBus] Emitting "${event}"`, data);
        }

        // 改修手順書テンプレートに合わせたリスナー実行
        const eventListeners = this.listeners[event] || [];
        let executedCount = 0;

        eventListeners.forEach(listener => {
            try {
                if (listener.context) {
                    listener.callback.call(listener.context, data, event);
                } else {
                    listener.callback(data, event);
                }
                executedCount++;
            } catch (error) {
                this.errorCount++;
                console.error(`[EventBus] Error in listener for "${event}":`, error);
                
                // ErrorManager活用（初期化後）
                if (Tegaki.ErrorManagerInstance) {
                    Tegaki.ErrorManagerInstance.handle(error, `EventBus.emit:${event}`);
                }
                
                // エラー連鎖防止
                if (this.errorCount > this.maxErrorCount) {
                    console.error('[EventBus] Too many errors, stopping event processing');
                    this.preventErrorCascade(error, event);
                    return;
                }
            }
        });

        if (this.debugMode) {
            console.log(`[EventBus] Executed ${executedCount} listeners for "${event}"`);
        }

        return executedCount;
    }

    /**
     * 安全なイベント発火（エラー対策強化版）
     * @param {string} event - イベント名
     * @param {*} data - イベントデータ
     * @returns {boolean} 成功/失敗
     */
    safeEmit(event, data = null) {
        try {
            const count = this.emit(event, data);
            return count >= 0;
        } catch (error) {
            console.error(`[EventBus] safeEmit failed for "${event}":`, error);
            
            if (Tegaki.ErrorManagerInstance) {
                Tegaki.ErrorManagerInstance.handle(error, `EventBus.safeEmit:${event}`);
            }
            
            return false;
        }
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
     * エラー状態をリセット（安全性強化）
     */
    resetErrorState() {
        this.errorCount = 0;
        console.log('[EventBus] Error state reset');
    }

    /**
     * エラー連鎖を防止
     * @param {Error} error - 発生したエラー
     * @param {string} eventType - イベントタイプ
     */
    preventErrorCascade(error, eventType) {
        console.warn(`[EventBus] Error cascade prevention activated for "${eventType}"`);
        
        // 一時的にイベント処理を停止
        const originalEmit = this.emit;
        this.emit = (event, data) => {
            console.warn(`[EventBus] Event "${event}" blocked due to error cascade prevention`);
            return 0;
        };
        
        // 1秒後に復帰
        setTimeout(() => {
            this.emit = originalEmit;
            this.resetErrorState();
            console.log('[EventBus] Event processing restored after error cascade prevention');
        }, 1000);
    }

    /**
     * イベントが登録されているかチェック
     * @param {string} event - イベント名
     * @returns {boolean}
     */
    hasListeners(event) {
        return this.listeners[event] && this.listeners[event].length > 0;
    }

    /**
     * 登録されているイベント一覧を取得
     * @returns {string[]}
     */
    getRegisteredEvents() {
        return Object.keys(this.listeners);
    }

    /**
     * 特定イベントのリスナー数を取得
     * @param {string} event - イベント名
     * @returns {number}
     */
    getListenerCount(event) {
        return this.listeners[event] ? this.listeners[event].length : 0;
    }

    /**
     * 健全性チェック（拡張API）
     * @returns {object} チェック結果
     */
    healthCheck() {
        try {
            const stats = this.getStats();
            const issues = [];
            
            // 異常なリスナー数チェック
            Object.entries(this.listeners).forEach(([event, listeners]) => {
                if (listeners.length > 50) {
                    issues.push(`Too many listeners for "${event}": ${listeners.length}`);
                }
            });
            
            // エラー率チェック
            if (this.errorCount > this.maxErrorCount / 2) {
                issues.push(`High error count: ${this.errorCount}`);
            }
            
            return {
                healthy: issues.length === 0,
                issues,
                stats,
                errorCount: this.errorCount
            };
        } catch (error) {
            return { 
                healthy: false, 
                issues: ['Health check failed'],
                error: error.message 
            };
        }
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
        const eventCount = Object.keys(this.listeners).length;
        this.listeners = {};
        this.resetErrorState();
        
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
            totalEvents: Object.keys(this.listeners).length,
            totalListeners: 0,
            events: {},
            errorCount: this.errorCount
        };

        for (const [event, listeners] of Object.entries(this.listeners)) {
            stats.totalListeners += listeners.length;
            stats.events[event] = listeners.length;
        }

        return stats;
    }

    // ========================================
    // 内部メソッド
    // ========================================

    /**
     * リスナーID生成（内部使用）
     * @private
     */
    _generateListenerId() {
        return `listener_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}

// Tegaki名前空間にクラスを登録
Tegaki.EventBus = EventBus;

// 初期化レジストリに追加（根幹Manager）
Tegaki._registry = Tegaki._registry || [];
Tegaki._registry.push(() => {
    Tegaki.EventBusInstance = new Tegaki.EventBus();
    
    // 開発時のデバッグ設定
    if (typeof window !== 'undefined' && window.location && window.location.search.includes('debug=true')) {
        Tegaki.EventBusInstance.setDebugMode(true);
    }
    
    console.log('[EventBus] ✅ Tegaki.EventBusInstance 初期化完了');
});

console.log('[EventBus] ✅ Tegaki名前空間統一・レジストリ登録完了');