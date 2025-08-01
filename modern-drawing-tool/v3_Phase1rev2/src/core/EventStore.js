// 🎯 統一イベント管理システム - mitt.js活用・疎結合アーキテクチャ
// Phase1-3全体のイベント統合管理

/**
 * 🚀 EventStore - mitt.js活用統一イベントバス
 * 
 * 【責務】
 * - 全コンポーネント間の疎結合通信
 * - イベントタイプの一元管理
 * - デバッグ・ログ機能
 * - Phase2・3段階的イベント拡張
 */

// mitt.jsの軽量実装（外部依存なし・CDN不要）
function createEventEmitter() {
    const events = {};
    
    return {
        on(type, handler) {
            (events[type] || (events[type] = [])).push(handler);
        },
        
        off(type, handler) {
            if (!events[type]) return;
            const index = events[type].indexOf(handler);
            if (index > -1) {
                events[type].splice(index, 1);
            }
        },
        
        emit(type, data) {
            if (!events[type]) return;
            events[type].forEach(handler => {
                try {
                    handler(data);
                } catch (error) {
                    console.error(`EventStore エラー [${type}]:`, error);
                }
            });
        },
        
        clear() {
            Object.keys(events).forEach(key => delete events[key]);
        },
        
        getEventTypes() {
            return Object.keys(events);
        },
        
        getListenerCount(type) {
            return events[type] ? events[type].length : 0;
        }
    };
}

export class EventStore {
    constructor() {
        // mitt.js互換の軽量イベントエミッター
        this.emitter = createEventEmitter();
        
        // イベントタイプ定義（Phase段階管理）
        this.setupPhase1Events();
        
        // デバッグ・ログ機能
        this.debugMode = false;
        this.eventLog = [];
        this.maxLogSize = 1000;
        
        // イベント統計
        this.eventStats = new Map();
        
        console.log('🎯 EventStore初期化完了');
    }

    /**
     * 🔥 Phase1イベントタイプ定義（統一座標・基本描画）
     */
    setupPhase1Events() {
        this.eventTypes = {
            // 統一座標イベント
            COORDINATE_TRANSFORM: 'coordinate:transform',
            COORDINATE_UPDATE: 'coordinate:update',
            
            // 描画イベント
            STROKE_START: 'stroke:start',
            STROKE_MOVE: 'stroke:move', 
            STROKE_COMPLETE: 'stroke:complete',
            STROKE_CANCEL: 'stroke:cancel',
            
            // ツールイベント
            TOOL_CHANGE: 'tool:change',
            TOOL_CONFIG_UPDATE: 'tool:config:update',
            
            // レンダリングイベント
            RENDER_FRAME: 'render:frame',
            RENDER_STROKE_FINALIZED: 'render:stroke-finalized',
            RENDER_CLEAR: 'render:clear',
            
            // 履歴イベント
            HISTORY_CHANGE: 'history:change',
            HISTORY_UNDO: 'history:undo',
            HISTORY_REDO: 'history:redo',
            
            // 入力イベント
            INPUT_MOUSE_DOWN: 'input:mouse:down',
            INPUT_MOUSE_MOVE: 'input:mouse:move',
            INPUT_MOUSE_UP: 'input:mouse:up',
            INPUT_KEY_DOWN: 'input:key:down',
            INPUT_KEY_UP: 'input:key:up',
            
            // キャンバスイベント
            CANVAS_RESIZE: 'canvas:resize',
            CANVAS_ZOOM: 'canvas:zoom',
            CANVAS_PAN: 'canvas:pan',
            
            // システムイベント
            SYSTEM_ERROR: 'system:error',
            SYSTEM_WARNING: 'system:warning',
            SYSTEM_INIT_COMPLETE: 'system:init:complete'
        };
    }

    // 🎨 Phase2イベントタイプ拡張（解封時有効化）
    /*
    setupPhase2Events() {                    // 🔒Phase2解封
        Object.assign(this.eventTypes, {
            // UIイベント
            UI_POPUP_SHOW: 'ui:popup:show',
            UI_POPUP_HIDE: 'ui:popup:hide',
            UI_SIDEBAR_TOGGLE: 'ui:sidebar:toggle',
            UI_PANEL_SWITCH: 'ui:panel:switch',
            
            // ベクターレイヤーイベント  
            VECTOR_LAYER_CREATE: 'vectorLayer:create',
            VECTOR_LAYER_DELETE: 'vectorLayer:delete',
            VECTOR_LAYER_SELECT: 'vectorLayer:select',
            VECTOR_LAYER_TRANSFORM: 'vectorLayer:transform',
            VECTOR_LAYER_MERGE: 'vectorLayer:merge',
            
            // カラーイベント
            COLOR_CHANGE: 'color:change',
            COLOR_PALETTE_UPDATE: 'color:palette:update',
            COLOR_PICKER_OPEN: 'color:picker:open',
            
            // ファイルイベント
            FILE_OPEN: 'file:open',
            FILE_SAVE: 'file:save',
            FILE_EXPORT: 'file:export',
            FILE_IMPORT: 'file:import'
        });
        
        console.log('🎨 Phase2イベントタイプ拡張完了');
    }
    */

    // ⚡ Phase3イベントタイプ拡張（解封時有効化）  
    /*
    setupPhase3Events() {                    // 🔒Phase3解封
        Object.assign(this.eventTypes, {
            // Chrome API イベント
            OFFSCREEN_PROCESS_START: 'offscreen:process:start',
            OFFSCREEN_PROCESS_COMPLETE: 'offscreen:process:complete',
            WEBCODECS_EXPORT_START: 'webcodecs:export:start',
            WEBCODECS_EXPORT_PROGRESS: 'webcodecs:export:progress',
            WEBCODECS_EXPORT_COMPLETE: 'webcodecs:export:complete',
            
            // アニメーションイベント
            ANIMATION_PLAY: 'animation:play',
            ANIMATION_PAUSE: 'animation:pause',
            ANIMATION_STOP: 'animation:stop',
            ANIMATION_FRAME_CHANGE: 'animation:frame:change',
            ANIMATION_TIMELINE_UPDATE: 'animation:timeline:update',
            
            // メッシュ変形イベント
            MESH_DEFORM_START: 'mesh:deform:start',
            MESH_DEFORM_UPDATE: 'mesh:deform:update',
            MESH_DEFORM_COMPLETE: 'mesh:deform:complete',
            
            // 高度な出力イベント
            EXPORT_VIDEO_START: 'export:video:start',
            EXPORT_VIDEO_PROGRESS: 'export:video:progress',
            EXPORT_VIDEO_COMPLETE: 'export:video:complete'
        });
        
        console.log('⚡ Phase3イベントタイプ拡張完了');
    }
    */

    /**
     * 📡 イベント購読
     */
    on(type, handler) {
        if (typeof handler !== 'function') {
            console.error('EventStore.on: ハンドラーは関数である必要があります');
            return;
        }

        this.emitter.on(type, handler);
        this.updateEventStats(type, 'subscribe');
        
        if (this.debugMode) {
            console.log(`📡 イベント購読: ${type}`, { 
                listenerCount: this.emitter.getListenerCount(type) 
            });
        }
    }

    /**
     * 📡 イベント購読解除
     */
    off(type, handler) {
        this.emitter.off(type, handler);
        this.updateEventStats(type, 'unsubscribe');
        
        if (this.debugMode) {
            console.log(`📡 イベント購読解除: ${type}`, { 
                listenerCount: this.emitter.getListenerCount(type) 
            });
        }
    }

    /**
     * 📢 イベント発火
     */
    emit(type, data = {}) {
        // データの時刻記録
        const eventData = {
            ...data,
            timestamp: Date.now(),
            eventType: type
        };

        // ログ記録
        this.logEvent(type, eventData);
        
        // 統計更新
        this.updateEventStats(type, 'emit');
        
        // デバッグ出力
        if (this.debugMode) {
            console.log(`📢 イベント発火: ${type}`, eventData);
        }

        // イベント発火
        this.emitter.emit(type, eventData);
    }

    /**
     * 🔄 ワンタイムイベント購読
     */
    once(type, handler) {
        const onceHandler = (data) => {
            handler(data);
            this.off(type, onceHandler);
        };
        
        this.on(type, onceHandler);
    }

    /**
     * 📊 イベントログ記録
     */
    logEvent(type, data) {
        const logEntry = {
            type,
            data,
            timestamp: Date.now(),
            id: this.generateEventId()
        };

        this.eventLog.push(logEntry);
        
        // ログサイズ制限
        if (this.eventLog.length > this.maxLogSize) {
            this.eventLog.shift();
        }
    }

    /**
     * 📈 イベント統計更新
     */
    updateEventStats(type, action) {
        if (!this.eventStats.has(type)) {
            this.eventStats.set(type, {
                emitCount: 0,
                subscribeCount: 0,
                unsubscribeCount: 0,
                lastEmit: null,
                avgInterval: 0
            });
        }

        const stats = this.eventStats.get(type);
        
        switch (action) {
            case 'emit':
                const now = Date.now();
                if (stats.lastEmit) {
                    const interval = now - stats.lastEmit;
                    stats.avgInterval = (stats.avgInterval * stats.emitCount + interval) / (stats.emitCount + 1);
                }
                stats.emitCount++;
                stats.lastEmit = now;
                break;
                
            case 'subscribe':
                stats.subscribeCount++;
                break;
                
            case 'unsubscribe':
                stats.unsubscribeCount++;
                break;
        }
    }

    /**
     * 🆔 イベントID生成
     */
    generateEventId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    /**
     * 🐛 デバッグモード切り替え
     */
    setDebugMode(enabled) {
        this.debugMode = enabled;
        console.log(`🐛 EventStore デバッグモード: ${enabled ? '有効' : '無効'}`);
    }

    /**
     * 📊 イベント統計取得
     */
    getEventStats(type = null) {
        if (type) {
            return this.eventStats.get(type) || null;
        }
        
        return Object.fromEntries(this.eventStats);
    }

    /**
     * 📜 イベントログ取得
     */
    getEventLog(limit = 100) {
        return this.eventLog.slice(-limit);
    }

    /**
     * 🔍 イベントログフィルタ
     */
    filterEventLog(filter) {
        return this.eventLog.filter(entry => {
            if (filter.type && entry.type !== filter.type) return false;
            if (filter.since && entry.timestamp < filter.since) return false;
            if (filter.until && entry.timestamp > filter.until) return false;
            return true;
        });
    }

    /**
     * 📡 購読者数取得
     */
    getListenerCount(type) {
        return this.emitter.getListenerCount(type);
    }

    /**
     * 📋 登録済みイベントタイプ一覧
     */
    getRegisteredEventTypes() {
        return this.emitter.getEventTypes();
    }

    /**
     * 🔥 高頻度イベント最適化
     */
    throttle(type, handler, delay = 16) {
        let lastCall = 0;
        let timeoutId = null;
        
        const throttledHandler = (data) => {
            const now = Date.now();
            
            if (now - lastCall >= delay) {
                handler(data);
                lastCall = now;
            } else {
                clearTimeout(timeoutId);
                timeoutId = setTimeout(() => {
                    handler(data);
                    lastCall = Date.now();
                }, delay - (now - lastCall));
            }
        };
        
        this.on(type, throttledHandler);
        return throttledHandler;
    }

    /**
     * 🔥 デバウンス処理
     */
    debounce(type, handler, delay = 100) {
        let timeoutId = null;
        
        const debouncedHandler = (data) => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => handler(data), delay);
        };
        
        this.on(type, debouncedHandler);
        return debouncedHandler;
    }

    /**
     * 🎯 イベントバッチ処理
     */
    batch(events) {
        events.forEach(({ type, data }) => {
            this.emit(type, data);
        });
    }

    /**
     * 🔔 イベント待機（Promise対応）
     */
    waitFor(type, timeout = 5000) {
        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                this.off(type, handler);
                reject(new Error(`イベント待機タイムアウト: ${type}`));
            }, timeout);
            
            const handler = (data) => {
                clearTimeout(timeoutId);
                resolve(data);
            };
            
            this.once(type, handler);
        });
    }

    /**
     * 🔄 イベントチェーン
     */
    chain(events) {
        const chainPromise = events.reduce((promise, { type, emit: shouldEmit, data }) => {
            return promise.then(() => {
                if (shouldEmit) {
                    this.emit(type, data);
                }
                return this.waitFor(type);
            });
        }, Promise.resolve());
        
        return chainPromise;
    }

    /**
     * ⚠️ エラーイベント発火
     */
    emitError(error, context = {}) {
        this.emit(this.eventTypes.SYSTEM_ERROR, {
            error: {
                message: error.message,
                stack: error.stack,
                name: error.name
            },
            context,
            severity: 'error'
        });
    }

    /**
     * ⚠️ 警告イベント発火
     */
    emitWarning(message, context = {}) {
        this.emit(this.eventTypes.SYSTEM_WARNING, {
            message,
            context,
            severity: 'warning'
        });
    }

    /**
     * 📊 パフォーマンス監視
     */
    startPerformanceMonitoring() {
        setInterval(() => {
            const stats = this.getEventStats();
            const highFrequencyEvents = Object.entries(stats)
                .filter(([type, data]) => data.avgInterval < 16) // 60FPS以下
                .map(([type, data]) => ({ type, ...data }));
            
            if (highFrequencyEvents.length > 0) {
                console.warn('⚠️ 高頻度イベント検出:', highFrequencyEvents);
            }
        }, 10000); // 10秒間隔
    }

    /**
     * 🧹 ログクリア
     */
    clearLog() {
        this.eventLog = [];
        console.log('🧹 EventStore ログクリア完了');
    }

    /**
     * 📊 統計リセット
     */
    resetStats() {
        this.eventStats.clear();
        console.log('📊 EventStore 統計リセット完了');
    }

    /**
     * 🗑️ 全イベント購読解除
     */
    removeAllListeners() {
        this.emitter.clear();
        this.resetStats();
        console.log('🗑️ EventStore 全購読解除完了');
    }

    /**
     * 🗑️ リソース解放
     */
    destroy() {
        this.removeAllListeners();
        this.clearLog();
        this.eventTypes = null;
        this.emitter = null;
        
        console.log('🗑️ EventStore リソース解放完了');
    }
}