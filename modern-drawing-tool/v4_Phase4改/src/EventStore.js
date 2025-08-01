/**
 * EventStore - mitt.js統一イベントバス（Phase1基盤）
 * 🔧 無限再帰エラー修正版
 */
import mitt from 'mitt';

export class EventStore {
    constructor() {
        this.emitter = mitt();
        this.history = [];
        this.maxHistory = 1000;
        
        // 🔧 無限再帰防止フラグ
        this.isEmitting = false;
        this.recursionDepth = 0;
        this.maxRecursionDepth = 10;
        
        // イベント定義（Phase段階的拡張）
        this.eventTypes = {
            // Phase1: 基本イベント
            ENGINE_READY: 'engine:ready',
            ENGINE_ERROR: 'engine:error',
            STROKE_START: 'stroke:start',
            STROKE_MOVE: 'stroke:move',
            STROKE_COMPLETE: 'stroke:complete',
            TOOL_CHANGE: 'tool:change',
            TOOL_CONFIG_CHANGE: 'tool:config:change',
            UNDO: 'history:undo',
            REDO: 'history:redo',
            
            // Phase2: UI・レイヤー・カラーイベント
            UI_SIDEBAR_TOGGLE: 'ui:sidebar:toggle',
            UI_POPUP_OPEN: 'ui:popup:open',
            UI_POPUP_CLOSE: 'ui:popup:close',
            LAYER_ADD: 'layer:add',
            LAYER_DELETE: 'layer:delete',
            LAYER_SELECT: 'layer:select',
            LAYER_UPDATE: 'layer:update',
            COLOR_CHANGE: 'color:change',
            CANVAS_TRANSFORM: 'canvas:transform',
            
            // 🔧 履歴管理専用（循環防止）
            HISTORY_CHANGE: 'history:change',
            HISTORY_INTERNAL: 'history:internal',
            
            // Phase3: アニメーション・ファイルイベント
            ANIMATION_START: 'animation:start',
            ANIMATION_STOP: 'animation:stop',
            ANIMATION_FRAME_CHANGE: 'animation:frame:change',
            FILE_SAVE: 'file:save',
            FILE_LOAD: 'file:load',
            
            // 汎用
            DEBUG: 'debug',
            TEST: 'test'
        };
        
        // デバッグモード
        this.debugMode = process.env.NODE_ENV === 'development';
        
        this.setupErrorHandling();
    }
    
    // 🔧 イベント発火（無限再帰防止強化版）
    emit(eventName, payload = null) {
        // 🚨 無限再帰防止チェック
        if (this.recursionDepth >= this.maxRecursionDepth) {
            console.error(`🚨 EventStore: Maximum recursion depth exceeded for event: ${eventName}`);
            return null;
        }
        
        if (this.isEmitting && this.recursionDepth > 5) {
            console.warn(`⚠️ EventStore: Deep recursion detected for event: ${eventName} (depth: ${this.recursionDepth})`);
        }
        
        this.recursionDepth++;
        this.isEmitting = true;
        
        const eventData = {
            type: eventName,
            timestamp: Date.now(),
            payload: payload,
            recursionDepth: this.recursionDepth
        };
        
        try {
            // 🔧 特定イベントの履歴記録スキップ（無限ループ防止）
            if (!this.isInternalEvent(eventName)) {
                this.recordEvent(eventData);
            }
            
            // デバッグログ
            if (this.debugMode && this.recursionDepth < 3) {
                console.log(`📡 Event: ${eventName}`, payload);
            }
            
            // mitt.js経由で発火
            this.emitter.emit(eventName, eventData);
            
            return eventData;
            
        } catch (error) {
            console.error(`🚨 EventStore emit error for ${eventName}:`, error);
            return null;
        } finally {
            this.recursionDepth--;
            if (this.recursionDepth <= 0) {
                this.isEmitting = false;
                this.recursionDepth = 0;
            }
        }
    }
    
    // 🔧 内部イベント判定（履歴記録除外）
    isInternalEvent(eventName) {
        const internalEvents = [
            this.eventTypes.HISTORY_CHANGE,
            this.eventTypes.HISTORY_INTERNAL,
            this.eventTypes.ENGINE_ERROR,
            this.eventTypes.DEBUG
        ];
        return internalEvents.includes(eventName);
    }
    
    // イベント購読
    on(eventName, handler) {
        if (typeof handler !== 'function') {
            console.error('🚨 Event handler must be a function:', eventName);
            return;
        }
        
        // 🔧 ハンドラーラッピング（エラー処理強化）
        const wrappedHandler = (eventData) => {
            try {
                handler(eventData);
            } catch (error) {
                console.error(`🚨 Event handler error for ${eventName}:`, error);
                // エラーを他のハンドラーに伝播させない
            }
        };
        
        this.emitter.on(eventName, wrappedHandler);
        
        if (this.debugMode) {
            console.log(`🔔 Subscribed to: ${eventName}`);
        }
    }
    
    // イベント購読解除
    off(eventName, handler) {
        this.emitter.off(eventName, handler);
        
        if (this.debugMode) {
            console.log(`🔕 Unsubscribed from: ${eventName}`);
        }
    }
    
    // 一度だけ実行
    once(eventName, handler) {
        const wrappedHandler = (eventData) => {
            try {
                handler(eventData);
            } catch (error) {
                console.error(`🚨 Event handler error for ${eventName}:`, error);
            } finally {
                this.off(eventName, wrappedHandler);
            }
        };
        
        this.on(eventName, wrappedHandler);
    }
    
    // 全リスナー削除
    clear() {
        this.emitter.all.clear();
        this.history = [];
        this.recursionDepth = 0;
        this.isEmitting = false;
        
        if (this.debugMode) {
            console.log('🧹 All event listeners cleared');
        }
    }
    
    // 🔧 イベント履歴記録（無限ループ防止強化）
    recordEvent(eventData) {
        try {
            // 履歴サイズ制限チェック
            if (this.history.length >= this.maxHistory) {
                this.history.shift(); // 古いイベントを削除
            }
            
            this.history.push(eventData);
            
        } catch (error) {
            console.error('🚨 EventStore: Failed to record event:', error);
        }
    }
    
    // 履歴取得
    getHistory(eventType = null, limit = 100) {
        try {
            let history = this.history;
            
            if (eventType) {
                history = history.filter(event => event.type === eventType);
            }
            
            return history.slice(-limit);
        } catch (error) {
            console.error('🚨 EventStore: Failed to get history:', error);
            return [];
        }
    }
    
    // 最新イベント取得
    getLastEvent(eventType = null) {
        try {
            const history = eventType ? 
                this.history.filter(event => event.type === eventType) : 
                this.history;
            
            return history[history.length - 1] || null;
        } catch (error) {
            console.error('🚨 EventStore: Failed to get last event:', error);
            return null;
        }
    }
    
    // エラーハンドリング設定
    setupErrorHandling() {
        // 未処理のエラーをキャッチ
        this.on(this.eventTypes.ENGINE_ERROR, (data) => {
            console.error('🚨 Engine Error:', data.payload);
            
            // 🔧 致命的エラーの場合のみ追加通知（無限ループ防止）
            if (data.payload && data.payload.fatal && this.recursionDepth <= 1) {
                // 内部イベントとして発火（履歴記録なし）
                setTimeout(() => {
                    this.emit('app:fatal:error', data.payload);
                }, 0);
            }
        });
        
        // デバッグイベント処理
        this.on(this.eventTypes.DEBUG, (data) => {
            if (this.debugMode) {
                console.log('🔧 Debug:', data.payload);
            }
        });
    }
    
    // イベント統計
    getEventStats() {
        try {
            const stats = {};
            
            this.history.forEach(event => {
                stats[event.type] = (stats[event.type] || 0) + 1;
            });
            
            return {
                totalEvents: this.history.length,
                eventTypes: Object.keys(stats).length,
                breakdown: stats,
                listenerCount: this.emitter.all.size,
                recursionDepth: this.recursionDepth,
                isEmitting: this.isEmitting
            };
        } catch (error) {
            console.error('🚨 EventStore: Failed to get stats:', error);
            return {
                totalEvents: 0,
                eventTypes: 0,
                breakdown: {},
                listenerCount: 0,
                recursionDepth: this.recursionDepth,
                isEmitting: this.isEmitting
            };
        }
    }
    
    // Phase段階的イベント追加
    addPhaseEvents(phaseEvents) {
        Object.assign(this.eventTypes, phaseEvents);
        
        if (this.debugMode) {
            console.log('📈 Phase events added:', Object.keys(phaseEvents));
        }
    }
    
    // デバッグ情報
    debug() {
        return {
            eventTypes: this.eventTypes,
            history: this.getHistory(null, 10),
            stats: this.getEventStats(),
            debugMode: this.debugMode,
            recursionDepth: this.recursionDepth,
            isEmitting: this.isEmitting
        };
    }
    
    // 🔧 パフォーマンス監視（無限ループ検出強化）
    startPerformanceMonitoring() {
        if (!this.debugMode) return;
        
        setInterval(() => {
            const stats = this.getEventStats();
            
            // 無限ループ警告
            if (this.recursionDepth > 5) {
                console.error('🚨 EventStore: Infinite recursion detected!', {
                    recursionDepth: this.recursionDepth,
                    isEmitting: this.isEmitting,
                    totalEvents: stats.totalEvents
                });
            }
            
            // メモリ使用量警告
            if (stats.totalEvents > 500) {
                console.warn('⚠️ High event activity:', stats);
            }
            
            if (stats.listenerCount > 50) {
                console.warn('⚠️ High listener count:', stats.listenerCount);
            }
        }, 30000); // 30秒ごと
    }
    
    // 🔧 緊急停止機能
    emergencyStop() {
        console.warn('🚨 EventStore: Emergency stop activated');
        this.clear();
        this.recursionDepth = 0;
        this.isEmitting = false;
    }
    
    // テスト用ヘルパー
    emitTest(eventName, payload) {
        return this.emit(this.eventTypes.TEST, {
            testEvent: eventName,
            testPayload: payload,
            timestamp: Date.now()
        });
    }
    
    // バッチイベント発火
    emitBatch(events) {
        const results = [];
        
        events.forEach(({ eventName, payload }) => {
            results.push(this.emit(eventName, payload));
        });
        
        return results;
    }
    
    // 条件付きイベント発火
    emitIf(condition, eventName, payload) {
        if (condition) {
            return this.emit(eventName, payload);
        }
        return null;
    }
    
    // 遅延イベント発火
    emitDelay(eventName, payload, delay) {
        return new Promise((resolve) => {
            setTimeout(() => {
                const result = this.emit(eventName, payload);
                resolve(result);
            }, delay);
        });
    }
    
    // イベントチェーン
    chain(eventName, payload) {
        const chainData = {
            originalEvent: eventName,
            originalPayload: payload,
            chain: [],
            addNext: (nextEvent, nextPayload) => {
                chainData.chain.push({ event: nextEvent, payload: nextPayload });
                return chainData;
            },
            execute: () => {
                // 元イベント発火
                this.emit(eventName, payload);
                
                // チェーンイベント順次発火
                chainData.chain.forEach(({ event, payload }, index) => {
                    setTimeout(() => {
                        this.emit(event, payload);
                    }, index * 100); // 100ms間隔
                });
            }
        };
        
        return chainData;
    }
}