/**
 * @file system/event-bus.js - v8.13.11 クリーンアップ版
 * @description イベント駆動アーキテクチャの中核
 * 
 * 【v8.13.11 改修内容】
 * 🧹 不要なコンソールログ削除
 * 📝 ヘッダー依存関係明記
 * ✅ 優先度機能維持
 * 
 * 【親ファイル (このファイルが依存)】
 * なし（基盤システム）
 * 
 * 【子ファイル (このファイルに依存)】
 * - 全システムファイル (window.TegakiEventBus使用)
 * - layer-system.js, camera-system.js, drawing-engine.js等
 * 
 * 【機能】
 * - on(event, callback, priority): リスナー登録（優先度指定可）
 * - off(event, callback): リスナー削除
 * - emit(event, data): イベント発火
 * - once(event, callback, priority): 一度だけ実行
 */

export class EventBus {
        constructor() {
            this.events = {};
            this.debug = false;
        }
        
        on(event, callback, priority = 0) {
            if (!this.events[event]) {
                this.events[event] = [];
            }
            
            const listener = {
                handler: callback,
                priority: priority
            };
            
            this.events[event].push(listener);
            this.events[event].sort((a, b) => b.priority - a.priority);
        }
        
        off(event, callback) {
            if (!this.events[event]) return;
            this.events[event] = this.events[event].filter(listener => listener.handler !== callback);
        }
        
        emit(event, data) {
            if (!this.events[event]) return;
            
            this.events[event].forEach(listener => {
                try {
                    listener.handler(data);
                } catch (e) {
                    console.error(`EventBus error in ${event}:`, e);
                }
            });
        }
        
        once(event, callback, priority = 0) {
            const wrapper = (data) => {
                callback(data);
                this.off(event, wrapper);
            };
            this.on(event, wrapper, priority);
        }
        
        getRegisteredEvents() {
            return Object.keys(this.events);
        }
        
        getListenerCount(event) {
            return this.events[event] ? this.events[event].length : 0;
        }
        
        setDebug(enabled) {
            this.debug = enabled;
        }
        
        clear() {
            this.events = {};
        }
        
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
    
    window.TegakiEventBus = new EventBus();
    
    window.TegakiEventBus.EVENTS = {
        LAYER_CREATED: 'layer:created',
        LAYER_DELETED: 'layer:deleted',
        LAYER_ACTIVATED: 'layer:activated',
        LAYER_UPDATED: 'layer:updated',
        LAYER_PATH_ADDED: 'layer:path-added',
        OPERATION_COMMIT: 'operation:commit',
        DRAW_COMMIT: 'draw:commit',
        TRANSFORM_COMMIT: 'transform:commit',
        PASTE_COMMIT: 'paste:commit',
        HISTORY_CHANGED: 'history:changed',
        HISTORY_UNDO_COMPLETED: 'history:undo-completed',
        HISTORY_REDO_COMPLETED: 'history:redo-completed',
        STATE_CHANGED: 'state:changed'
    };
    
    window.EventBus = EventBus;