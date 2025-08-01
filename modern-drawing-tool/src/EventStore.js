// EventStore.js - mitt.js統一イベントバス（Phase1基盤・封印対象）

// mitt.jsのモック実装（外部ライブラリが利用できない場合の代替）
const mitt = () => {
    const all = new Map();
    
    return {
        all,
        on(type, handler) {
            const handlers = all.get(type);
            if (handlers) {
                handlers.push(handler);
            } else {
                all.set(type, [handler]);
            }
        },
        off(type, handler) {
            const handlers = all.get(type);
            if (handlers) {
                if (handler) {
                    handlers.splice(handlers.indexOf(handler) >>> 0, 1);
                } else {
                    all.set(type, []);
                }
            }
        },
        emit(type, evt) {
            (all.get(type) || []).slice().map((handler) => {
                handler(evt);
            });
        }
    };
};

/**
 * 🔥 mitt.js統一イベントバス（Phase1基盤・封印対象）
 * 責務: イベント定義・型安全性、状態同期・購読管理、Phase段階的イベント拡張
 */
export class EventStore {
    constructor() {
        this.emitter = mitt();
        this.subscribers = new Map();
        
        // Phase段階的イベント定義
        this.setupPhaseEvents();
        
        console.log('✅ EventStore基盤初期化完了');
    }
    
    /**
     * Phase段階的イベント定義
     */
    setupPhaseEvents() {
        // 🔥 Phase1: OGL統一基盤イベント
        this.eventTypes = {
            // ストローク関連
            STROKE_START: 'stroke:start',
            STROKE_UPDATE: 'stroke:update', 
            STROKE_COMPLETE: 'stroke:complete',
            STROKE_DELETE: 'stroke:delete',
            
            // ツール関連
            TOOL_CHANGE: 'tool:change',
            TOOL_CONFIG_UPDATE: 'tool:config:update',
            
            // 履歴関連
            HISTORY_UNDO: 'history:undo',
            HISTORY_REDO: 'history:redo',
            HISTORY_STATE_CHANGE: 'history:state:change',
            
            // エンジン関連
            ENGINE_INITIALIZE: 'engine:initialize',
            ENGINE_ERROR: 'engine:error',
            ENGINE_RESIZE: 'engine:resize',
            
            // 入力関連
            INPUT_START: 'input:start',
            INPUT_MOVE: 'input:move',
            INPUT_END: 'input:end',
            INPUT_CANCEL: 'input:cancel',
            
            // 🎨 Phase2: UI・ツール・カラー・レイヤーイベント（封印解除時追加）
            UI_PANEL_TOGGLE: 'ui:panel:toggle',
            UI_POPUP_SHOW: 'ui:popup:show',
            UI_POPUP_HIDE: 'ui:popup:hide',
            UI_VISIBILITY_CHANGE: 'ui:visibility:change',
            LAYER_CREATE: 'layer:create',
            LAYER_DELETE: 'layer:delete',
            LAYER_SELECT: 'layer:select',
            COLOR_CHANGE: 'color:change',
            CANVAS_TRANSFORM: 'canvas:transform',
            
            // システム関連
            SYSTEM_SUCCESS: 'system:success',
            SYSTEM_ERROR: 'system:error',
            SYSTEM_CRITICAL_ERROR: 'system:critical:error',
            
            // アプリケーション関連
            APP_FULLSCREEN_TOGGLE: 'app:fullscreen:toggle',
            APP_RESET: 'app:reset',
            APP_EXPORT: 'app:export'
            
            // ⚡ Phase3: アニメ・ファイル・メッシュ変形イベント（封印解除時追加）
            // ANIMATION_PLAY: 'animation:play',
            // ANIMATION_STOP: 'animation:stop',
            // FILE_SAVE: 'file:save',
            // FILE_LOAD: 'file:load',
            // MESH_DEFORM_START: 'mesh:deform:start'
        };
        
        // イベント型チェック用Set
        this.validEventTypes = new Set(Object.values(this.eventTypes));
    }
    
    /**
     * イベント発火
     */
    emit(eventType, payload = {}) {
        if (!this.validEventTypes.has(eventType)) {
            console.warn(`🚨 未定義イベント: ${eventType}`);
            return false;
        }
        
        const eventData = {
            type: eventType,
            timestamp: Date.now(),
            payload: payload
        };
        
        console.log(`📢 イベント発火: ${eventType}`, payload);
        this.emitter.emit(eventType, eventData);
        
        return true;
    }
    
    /**
     * イベント購読
     */
    on(eventType, handler, subscriberId = null) {
        if (!this.validEventTypes.has(eventType)) {
            console.warn(`🚨 未定義イベント購読: ${eventType}`);
            return null;
        }
        
        // 購読者ID管理
        const subId = subscriberId || `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        if (!this.subscribers.has(subId)) {
            this.subscribers.set(subId, new Set());
        }
        this.subscribers.get(subId).add(eventType);
        
        console.log(`📝 イベント購読: ${eventType} by ${subId}`);
        this.emitter.on(eventType, handler);
        
        return subId;
    }
    
    /**
     * イベント購読一度だけ
     */
    once(eventType, handler, subscriberId = null) {
        if (!this.validEventTypes.has(eventType)) {
            console.warn(`🚨 未定義イベント一回購読: ${eventType}`);
            return null;
        }
        
        const subId = subscriberId || `once_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        console.log(`📝 イベント一回購読: ${eventType} by ${subId}`);
        
        const wrappedHandler = (eventData) => {
            handler(eventData);
            this.off(eventType, wrappedHandler);
        };
        
        this.emitter.on(eventType, wrappedHandler);
        
        return subId;
    }
    
    /**
     * イベント購読解除
     */
    off(eventType, handler = null, subscriberId = null) {
        if (handler) {
            this.emitter.off(eventType, handler);
            console.log(`📝 イベント購読解除: ${eventType}`);
        } else if (subscriberId && this.subscribers.has(subscriberId)) {
            // 購読者IDで一括解除
            const eventTypes = this.subscribers.get(subscriberId);
            eventTypes.forEach(type => {
                this.emitter.off(type);
            });
            this.subscribers.delete(subscriberId);
            console.log(`📝 購読者一括解除: ${subscriberId}`);
        } else {
            this.emitter.off(eventType);
            console.log(`📝 イベント全購読解除: ${eventType}`);
        }
    }
    
    /**
     * 全イベント購読解除
     */
    offAll() {
        this.emitter.all.clear();
        this.subscribers.clear();
        console.log('📝 全イベント購読解除');
    }
    
    /**
     * Phase2イベント拡張（封印解除時実装）
     */
    enablePhase2Events() {
        const phase2Events = {
            // UI関連
            UI_PANEL_TOGGLE: 'ui:panel:toggle',
            UI_POPUP_SHOW: 'ui:popup:show',
            UI_POPUP_HIDE: 'ui:popup:hide',
            UI_TOOL_SELECT: 'ui:tool:select',
            
            // レイヤー関連
            LAYER_CREATE: 'layer:create',
            LAYER_DELETE: 'layer:delete',
            LAYER_SELECT: 'layer:select',
            LAYER_VISIBILITY_TOGGLE: 'layer:visibility:toggle',
            LAYER_OPACITY_CHANGE: 'layer:opacity:change',
            LAYER_BLEND_MODE_CHANGE: 'layer:blend:mode:change',
            LAYER_REORDER: 'layer:reorder',
            
            // カラー関連
            COLOR_CHANGE: 'color:change',
            COLOR_PALETTE_SELECT: 'color:palette:select',
            COLOR_EYEDROPPER_START: 'color:eyedropper:start',
            COLOR_EYEDROPPER_PICK: 'color:eyedropper:pick',
            
            // キャンバス関連
            CANVAS_TRANSFORM: 'canvas:transform',
            CANVAS_RESET_VIEW: 'canvas:reset:view',
            CANVAS_FLIP_HORIZONTAL: 'canvas:flip:horizontal',
            CANVAS_FLIP_VERTICAL: 'canvas:flip:vertical',
            
            // ツール詳細
            TOOL_SIZE_CHANGE: 'tool:size:change',
            TOOL_OPACITY_CHANGE: 'tool:opacity:change',
            TOOL_PRESSURE_TOGGLE: 'tool:pressure:toggle'
        };
        
        // Phase2イベント追加
        Object.assign(this.eventTypes, phase2Events);
        this.validEventTypes = new Set(Object.values(this.eventTypes));
        
        console.log('✅ Phase2イベント拡張完了');
    }
    
    /**
     * Phase3イベント拡張（封印解除時実装）
     */
    enablePhase3Events() {
        const phase3Events = {
            // アニメーション関連
            ANIMATION_PLAY: 'animation:play',
            ANIMATION_PAUSE: 'animation:pause',
            ANIMATION_STOP: 'animation:stop',
            ANIMATION_FRAME_CHANGE: 'animation:frame:change',
            ANIMATION_CUT_CREATE: 'animation:cut:create',
            ANIMATION_CUT_SELECT: 'animation:cut:select',
            ANIMATION_CUT_DELETE: 'animation:cut:delete',
            
            // ファイル関連
            FILE_NEW: 'file:new',
            FILE_OPEN: 'file:open',
            FILE_SAVE: 'file:save',
            FILE_SAVE_AS: 'file:save:as',
            FILE_EXPORT: 'file:export',
            FILE_IMPORT: 'file:import',
            PROJECT_LOAD: 'project:load',
            PROJECT_SAVE: 'project:save',
            
            // 高度ツール関連
            SELECTION_CREATE: 'selection:create',
            SELECTION_MODIFY: 'selection:modify',
            SELECTION_CLEAR: 'selection:clear',
            SHAPE_TOOL_START: 'shape:tool:start',
            SHAPE_TOOL_COMPLETE: 'shape:tool:complete',
            
            // メッシュ変形関連
            MESH_DEFORM_START: 'mesh:deform:start',
            MESH_DEFORM_UPDATE: 'mesh:deform:update',
            MESH_DEFORM_COMPLETE: 'mesh:deform:complete',
            MESH_CONTROL_POINT_SELECT: 'mesh:control:point:select'
        };
        
        // Phase3イベント追加
        Object.assign(this.eventTypes, phase3Events);
        this.validEventTypes = new Set(Object.values(this.eventTypes));
        
        console.log('✅ Phase3イベント拡張完了');
    }
    
    /**
     * デバッグ用: 現在の購読者一覧
     */
    getSubscribers() {
        const subscriberInfo = {};
        this.subscribers.forEach((eventTypes, subscriberId) => {
            subscriberInfo[subscriberId] = Array.from(eventTypes);
        });
        return subscriberInfo;
    }
    
    /**
     * デバッグ用: イベント統計
     */
    getEventStats() {
        return {
            totalEventTypes: this.validEventTypes.size,
            activeSubscribers: this.subscribers.size,
            eventTypes: Object.keys(this.eventTypes)
        };
    }
    
    /**
     * 状態同期ヘルパー
     */
    syncState(stateName, newState, oldState = null) {
        this.emit('state:sync', {
            stateName,
            newState,
            oldState,
            timestamp: Date.now()
        });
    }
    
    /**
     * エラーイベント発火ヘルパー
     */
    emitError(error, context = 'unknown') {
        this.emit(this.eventTypes.ENGINE_ERROR, {
            error: error.message || error,
            stack: error.stack,
            context,
            timestamp: Date.now()
        });
    }
    
    /**
     * 成功イベント発火ヘルパー
     */
    emitSuccess(message, data = {}) {
        this.emit('system:success', {
            message,
            data,
            timestamp: Date.now()
        });
    }
}