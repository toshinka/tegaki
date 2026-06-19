/**
 * ============================================================================
 * ファイル名: system/event-bus.js
 * 責務: イベント駆動アーキテクチャの中核となるメッセージバス
 * 依存: なし
 * 被依存: 全システムファイル
 * 公開API: EventBus, TegakiEventBus
 * イベント発火: なし
 * イベント受信: なし
 * グローバル登録: window.TegakiEventBus, window.EventBus
 * 実装状態: ♻️移植
 * ============================================================================
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

export const TegakiEventBus = new EventBus();

TegakiEventBus.EVENTS = {
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

// 下位互換性のためにグローバルに登録（将来的に削除検討）
window.EventBus = EventBus;
window.TegakiEventBus = TegakiEventBus;
