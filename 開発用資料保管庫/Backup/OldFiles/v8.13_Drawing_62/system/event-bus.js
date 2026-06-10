// ===== system/event-bus.js - Phase 2: 優先度機能追加版 =====
// 🔥 改修方針:
// - リスナー登録時に priority パラメータ追加（オプション）
// - 優先度順（降順）でソート実行
// - 既存コードとの完全互換性維持（priority 省略時はデフォルト0）
//
// ✅ 互換性維持:
// - on(event, callback) → priority なしで呼び出し可能
// - on(event, callback, priority) → 優先度指定
// - 既存の off(), emit() は一切変更なし
// ================================================================================

(function() {
    'use strict';
    
    class EventBus {
        constructor() {
            // 🔥 変更: リスナーを { handler, priority } の形式で保存
            this.events = {}; // { eventName: [{ handler, priority }, ...] }
            this.debug = false;
        }
        
        // 🔥 改修: priority パラメータ追加（オプション、デフォルト0）
        on(event, callback, priority = 0) {
            if (!this.events[event]) {
                this.events[event] = [];
            }
            
            // リスナーをオブジェクトとして保存
            const listener = {
                handler: callback,
                priority: priority
            };
            
            this.events[event].push(listener);
            
            // 🔥 優先度順にソート（降順 = 高い方が先）
            this.events[event].sort((a, b) => b.priority - a.priority);
            
            if (this.debug) {
                console.log(`EventBus: Registered listener for '${event}' with priority ${priority}`);
            }
        }
        
        // ✅ 互換性維持: off() は既存のまま
        off(event, callback) {
            if (!this.events[event]) return;
            
            // 🔥 変更: handler プロパティで比較
            this.events[event] = this.events[event].filter(listener => listener.handler !== callback);
            
            if (this.debug) {
                console.log(`EventBus: Removed listener for '${event}'`);
            }
        }
        
        // ✅ 互換性維持: emit() は優先度順に実行
        emit(event, data) {
            if (!this.events[event]) return;
            
            if (this.debug && event !== 'ui:mouse-move') { 
                console.log(`EventBus: Emitting '${event}'`, data);
            }
            
            // 🔥 変更: 優先度順にソート済みなので順次実行
            this.events[event].forEach(listener => {
                try {
                    listener.handler(data);
                } catch (e) {
                    console.error(`EventBus error in ${event}:`, e);
                }
            });
        }
        
        // ✅ 互換性維持: once() 追加（一度だけ実行）
        once(event, callback, priority = 0) {
            const wrapper = (data) => {
                callback(data);
                this.off(event, wrapper);
            };
            this.on(event, wrapper, priority);
        }
        
        // ✅ 互換性維持: 既存のユーティリティメソッド
        getRegisteredEvents() {
            return Object.keys(this.events);
        }
        
        getListenerCount(event) {
            return this.events[event] ? this.events[event].length : 0;
        }
        
        setDebug(enabled) {
            this.debug = enabled;
        }
        
        // 🔥 新規: 全リスナーをクリア
        clear() {
            this.events = {};
        }
        
        // 🔥 新規: デバッグ情報取得
        getDebugInfo() {
            const info = {};
            for (const [event, listeners] of Object.entries(this.events)) {
                info[event] = listeners.map((l, i) => ({
                    index: i,
                    priority: l.priority,
                    handler: l.handler.name || 'anonymous'
                }));
            }
            return info;
        }
    }
    
    // ===== グローバルEventBus設定 =====
    window.TegakiEventBus = new EventBus();
    
    // ===== イベント定数定義（既存維持 + 追加） =====
    window.TegakiEventBus.EVENTS = {
        // 既存イベント
        LAYER_CREATED: 'layer:created',
        LAYER_DELETED: 'layer:deleted',
        LAYER_ACTIVATED: 'layer:activated',
        LAYER_UPDATED: 'layer:updated',
        LAYER_PATH_ADDED: 'layer:path-added',
        
        // 確定操作イベント（サムネイル更新トリガー）
        OPERATION_COMMIT: 'operation:commit',
        DRAW_COMMIT: 'draw:commit',
        TRANSFORM_COMMIT: 'transform:commit',
        PASTE_COMMIT: 'paste:commit',
        
        // 🔥 新規: History関連イベント
        HISTORY_CHANGED: 'history:changed',
        HISTORY_UNDO_COMPLETED: 'history:undo-completed',
        HISTORY_REDO_COMPLETED: 'history:redo-completed',
        
        // 🔥 新規: State関連イベント
        STATE_CHANGED: 'state:changed'
    };
    
    console.log('✅ system/event-bus.js Phase 2: 優先度機能追加版 loaded');
    window.EventBus = EventBus;
})();

// ===== 使用例（コメント） =====
// // 優先度なし（デフォルト0）
// EventBus.on('test', () => console.log('default'));
//
// // 優先度指定（高い方が先に実行）
// EventBus.on('test', () => console.log('high'), 100);
// EventBus.on('test', () => console.log('low'), -100);
//
// EventBus.emit('test');
// // 出力: "high" → "default" → "low"