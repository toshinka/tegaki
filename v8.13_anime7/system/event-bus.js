// ===== system/event-bus.js - Phase 0対応版 + 確定イベント定義 =====
// Phase 0: 基盤整備完了版EventBus
// システム間通信基盤として機能（既存機能を壊さない）

(function() {
    'use strict';
    
    class EventBus {
        constructor() {
            this.events = {};
            this.debug = false; // Phase 0は最小ログ
        }
        
        on(event, callback) {
            if (!this.events[event]) {
                this.events[event] = [];
            }
            this.events[event].push(callback);
            
            if (this.debug) {
                console.log(`EventBus: Registered listener for '${event}'`);
            }
        }
        
        off(event, callback) {
            if (!this.events[event]) return;
            this.events[event] = this.events[event].filter(cb => cb !== callback);
            
            if (this.debug) {
                console.log(`EventBus: Removed listener for '${event}'`);
            }
        }
        
        emit(event, data) {
            if (!this.events[event]) return;
            
            if (this.debug && event !== 'ui:mouse-move') { 
                console.log(`EventBus: Emitting '${event}'`, data);
            }
            
            this.events[event].forEach(callback => {
                try {
                    callback(data);
                } catch (e) {
                    console.error(`EventBus error in ${event}:`, e);
                }
            });
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
    }
    
    // Phase 0: グローバルEventBus設定
    window.TegakiEventBus = new EventBus();
    
    // 確定操作イベント定義（プログラムで使用可能）
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
        PASTE_COMMIT: 'paste:commit'
    };
    
    console.log('✅ system/event-bus.js loaded (Phase 0 ready + commit events)');
})();