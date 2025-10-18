// ===== system/event-bus.js - 警告最適化版 =====
// イベントバスの警告を最適化し、不要なコンソール出力を削減

window.TegakiEventBusClass = (function() {
    'use strict';

    // 警告を出すべき重要イベント（リスナー必須）のホワイトリスト
    const CRITICAL_EVENTS = new Set([
        'layer:added',
        'layer:removed',
        'layer:selected',
        'tool:changed',
        'history:undo',
        'history:redo',
        'drawing:started',
        'drawing:ended'
    ]);

    // 警告を抑制すべきイベント（リスナー不要で正常）
    const SILENT_EVENTS = new Set([
        'ui:mouse-move',           // マウス移動は頻繁で通知のみ
        'core:initialized',        // 初期化完了通知
        'cut:switched',            // カット切り替え通知
        'ui:status-updated',       // UI更新通知
        'export:manager:initialized', // エクスポートマネージャー初期化通知
        'cut:updated'              // カット更新通知
    ]);

    class EventBus {
        constructor() {
            this._events = new Map();
            this._debugMode = false; // デバッグモードはデフォルトOFF
        }

        // デバッグモードの切り替え
        setDebugMode(enabled) {
            this._debugMode = enabled;
            if (enabled) {
                console.log('🔍 EventBus debug mode: ON');
            }
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
            
            // リスナーが存在しない場合の処理
            if (!this._events.has(eventName) || this._events.get(eventName).length === 0) {
                // デバッグモードON、かつ重要イベント、かつサイレントイベントでない場合のみ警告
                if (this._debugMode && CRITICAL_EVENTS.has(eventName) && !SILENT_EVENTS.has(eventName)) {
                    console.warn(`⚠️ No listeners for critical event: "${eventName}"`);
                }
                return;
            }

            const listeners = this._events.get(eventName);

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
    
    // デバッグモードはデフォルトOFF（必要時のみONにする）
    // window.TegakiEventBus.setDebugMode(true);
}

console.log('✅ system/event-bus.js loaded');