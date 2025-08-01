import mitt from 'mitt';

/**
 * EventStore - mitt.js統一イベントバス（Phase1基盤）
 * 全コンポーネント間の疎結合通信を実現
 */
export class EventStore {
    constructor() {
        this.emitter = mitt();
        this.eventTypes = this.defineEventTypes();
        this.subscriptions = new Map();
        this.history = [];
        this.maxHistorySize = 100;
        
        this.setupDebugLogging();
    }
    
    // イベント定義（Phase段階的拡張）
    defineEventTypes() {
        return {
            // Phase1: 基本イベント
            STROKE_START: 'stroke:start',
            STROKE_UPDATE: 'stroke:update',
            STROKE_COMPLETE: 'stroke:complete',
            TOOL_CHANGE: 'tool:change',
            HISTORY_CHANGE: 'history:change',
            ENGINE_READY: 'engine:ready',
            ENGINE_ERROR: 'engine:error',
            
            // Phase2: UI・ツールイベント
            UI_POPUP_OPEN: 'ui:popup:open',
            UI_POPUP_CLOSE: 'ui:popup:close',
            UI_SIDEBAR_TOGGLE: 'ui:sidebar:toggle',
            TOOL_CONFIG_CHANGE: 'tool:config:change',
            COLOR_CHANGE: 'color:change',
            
            // Phase3: レイヤー・キャンバスイベント
            LAYER_ADD: 'layer:add',
            LAYER_DELETE: 'layer:delete',
            LAYER_SELECT: 'layer:select',
            LAYER_VISIBILITY_CHANGE: 'layer:visibility:change',
            CANVAS_TRANSFORM: 'canvas:transform',
            CANVAS_RESET: 'canvas:reset',
            
            // Phase4: アニメーション・ファイルイベント
            ANIMATION_START: 'animation:start',
            ANIMATION_STOP: 'animation:stop',
            ANIMATION_FRAME_CHANGE: 'animation:frame:change',
            FILE_LOAD: 'file:load',
            FILE_SAVE: 'file:save',
            PROJECT_CHANGE: 'project:change',
            MESH_DEFORM_START: 'mesh:deform:start',
            MESH_DEFORM_END: 'mesh:deform:end'
        };
    }
    
    // イベント発火
    emit(eventType, payload = {}) {
        const eventData = {
            type: eventType,
            payload,
            timestamp: Date.now(),
            id: this.generateEventId()
        };
        
        // 履歴記録
        this.addToHistory(eventData);
        
        // イベント発火
        this.emitter.emit(eventType, eventData);
        
        return eventData.id;
    }
    
    // イベント購読
    on(eventType, handler, options = {}) {
        const wrappedHandler = (eventData) => {
            try {
                if (options.once) {
                    this.off(eventType, wrappedHandler);
                }
                handler(eventData);
            } catch (error) {
                console.error(`EventStore handler error for ${eventType}:`, error);
                this.emit(this.eventTypes.ENGINE_ERROR, { error, eventType });
            }
        };
        
        this.emitter.on(eventType, wrappedHandler);
        
        // 購読記録
        if (!this.subscriptions.has(eventType)) {
            this.subscriptions.set(eventType, new Set());
        }
        this.subscriptions.get(eventType).add(wrappedHandler);
        
        return wrappedHandler;
    }
    
    // イベント購読解除
    off(eventType, handler) {
        this.emitter.off(eventType, handler);
        
        if (this.subscriptions.has(eventType)) {
            this.subscriptions.get(eventType).delete(handler);
        }
    }
    
    // 一度だけ実行される購読
    once(eventType, handler) {
        return this.on(eventType, handler, { once: true });
    }
    
    // 全イベント購読解除
    clear() {
        this.emitter.all.clear();
        this.subscriptions.clear();
    }
    
    // イベント履歴管理
    addToHistory(eventData) {
        this.history.push(eventData);
        if (this.history.length > this.maxHistorySize) {
            this.history.shift();
        }
    }
    
    // イベント履歴取得
    getHistory(eventType = null, limit = 10) {
        let filtered = this.history;
        
        if (eventType) {
            filtered = this.history.filter(event => event.type === eventType);
        }
        
        return filtered.slice(-limit);
    }
    
    // イベント統計
    getEventStats() {
        const stats = {};
        this.history.forEach(event => {
            stats[event.type] = (stats[event.type] || 0) + 1;
        });
        return stats;
    }
    
    // 購読者数取得
    getSubscriberCount(eventType = null) {
        if (eventType) {
            return this.subscriptions.get(eventType)?.size || 0;
        }
        
        let total = 0;
        this.subscriptions.forEach(subscribers => {
            total += subscribers.size;
        });
        return total;
    }
    
    // イベントID生成
    generateEventId() {
        return `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    // デバッグログ設定
    setupDebugLogging() {
        if (process.env.NODE_ENV === 'development') {
            // 開発時のみイベントログ出力
            this.emitter.on('*', (type, data) => {
                console.log(`🔄 Event: ${type}`, data);
            });
        }
    }
    
    // Phase段階的イベント追加
    addPhaseEvents(phaseNumber, additionalEvents) {
        Object.assign(this.eventTypes, additionalEvents);
        console.log(`✅ Phase${phaseNumber} events added:`, Object.keys(additionalEvents));
    }
    
    // デバッグ用情報出力
    debug() {
        return {
            eventTypes: Object.keys(this.eventTypes).length,
            subscriptions: this.getSubscriberCount(),
            history: this.history.length,
            stats: this.getEventStats()
        };
    }
}