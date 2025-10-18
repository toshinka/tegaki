// ===== system/event-bus.js - デバッグ強化版 =====
// 🔥 修正ポイント:
// 1. イベント発火・購読のデバッグログ追加
// 2. リスナー登録状況の可視化
// 3. エラーハンドリング強化

window.TegakiEventBusClass = (function() {
    'use strict';

    class EventBus {
        constructor() {
            this._events = new Map();
            this._debugMode = false; // デバッグモードフラグ
            console.log('✅ EventBus initialized');
        }

        // デバッグモードの切り替え
        setDebugMode(enabled) {
            this._debugMode = enabled;
            console.log(`EventBus debug mode: ${enabled ? 'ON' : 'OFF'}`);
        }

        // イベントリスナーを登録
        on(eventName, callback) {
            if (!this._events.has(eventName)) {
                this._events.set(eventName, []);
            }
            
            this._events.get(eventName).push(callback);
            
            if (this._debugMode) {
                console.log(`📝 EventBus.on("${eventName}") - リスナー登録 (合計: ${this._events.get(eventName).length})`);
            }
        }

        // イベントリスナーを削除
        off(eventName, callback) {
            if (!this._events.has(eventName)) return;
            
            const listeners = this._events.get(eventName);
            const index = listeners.indexOf(callback);
            
            if (index > -1) {
                listeners.splice(index, 1);
                
                if (this._debugMode) {
                    console.log(`🗑️ EventBus.off("${eventName}") - リスナー削除 (残り: ${listeners.length})`);
                }
            }
        }

        // 一度だけ実行されるリスナーを登録
        once(eventName, callback) {
            const onceCallback = (data) => {
                callback(data);
                this.off(eventName, onceCallback);
            };
            this.on(eventName, onceCallback);
        }

        // イベントを発火
        emit(eventName, data) {
            if (this._debugMode) {
                console.log(`🔔 EventBus.emit("${eventName}")`, data);
            }
            
            if (!this._events.has(eventName)) {
                if (this._debugMode) {
                    console.warn(`⚠️ No listeners for event: "${eventName}"`);
                }
                return;
            }

            const listeners = this._events.get(eventName);
            
            if (listeners.length === 0) {
                if (this._debugMode) {
                    console.warn(`⚠️ Event "${eventName}" has no listeners`);
                }
                return;
            }

            // 各リスナーを実行（エラーハンドリング付き）
            listeners.forEach((callback, index) => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`❌ Error in listener ${index} for event "${eventName}":`, error);
                }
            });
        }

        // 特定イベントのすべてのリスナーを削除
        removeAllListeners(eventName) {
            if (eventName) {
                this._events.delete(eventName);
                if (this._debugMode) {
                    console.log(`🗑️ All listeners removed for: "${eventName}"`);
                }
            } else {
                this._events.clear();
                if (this._debugMode) {
                    console.log('🗑️ All listeners removed from EventBus');
                }
            }
        }

        // 登録されているすべてのイベント名を取得
        getEventNames() {
            return Array.from(this._events.keys());
        }

        // 特定イベントのリスナー数を取得
        getListenerCount(eventName) {
            if (!this._events.has(eventName)) return 0;
            return this._events.get(eventName).length;
        }

        // デバッグ情報を取得
        getDebugInfo() {
            const info = {};
            this._events.forEach((listeners, eventName) => {
                info[eventName] = listeners.length;
            });
            return info;
        }

        // すべてのイベントとリスナー数を表示
        printDebugInfo() {
            console.log('=== EventBus Debug Info ===');
            console.log(`Total events: ${this._events.size}`);
            
            if (this._events.size === 0) {
                console.log('No events registered');
            } else {
                this._events.forEach((listeners, eventName) => {
                    console.log(`  "${eventName}": ${listeners.length} listener(s)`);
                });
            }
            
            console.log('===========================');
        }
    }

    return EventBus;
})();

// グローバルインスタンスを作成
if (!window.TegakiEventBus) {
    window.TegakiEventBus = new window.TegakiEventBusClass();
    
    // 🔥 P/E+ドラッグ機能のデバッグ用に初期状態でデバッグモードON
    // 動作確認後に false に変更してください
    window.TegakiEventBus.setDebugMode(true);
    
    console.log('✅ TegakiEventBus instance created globally');
}

console.log('✅ system/event-bus.js (デバッグ強化版) loaded');