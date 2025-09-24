// ===== event-bus.js - 統一EventBusシステム =====
// 全システム間でのイベント連携を担当（Singleton実装）

/*
=== 統一EventBusの責務 ===
- アプリケーション全体のイベント管理
- システム間の疎結合な連携
- イベントログとデバッグ機能
- エラー処理とフォールバック

=== 主要イベント ===
[CoordinateSystem]
- coordinate-transform: 座標変換実行時
- coordinate-accuracy-test: 精度テスト結果

[LayerSystem]
- layer-created: レイヤー作成
- layer-deleted: レイヤー削除  
- layer-selected: レイヤー選択
- layer-transformed: レイヤー変形
- layer-confirmed: 変形確定
- layers-reordered: レイヤー順序変更

[CameraSystem]
- camera-moved: カメラ移動
- window-resized: ウィンドウリサイズ
- pointer-move: マウス/タッチ移動

[UI]
- transform-panel-show/hide: Transform Panel表示制御
- thumbnail-update-requested: サムネイル更新要求
*/

(function() {
    'use strict';
    
    const CONFIG = window.TEGAKI_CONFIG;
    
    const debug = (message, ...args) => {
        if (CONFIG && CONFIG.debug) {
            console.log(`[EventBus] ${message}`, ...args);
        }
    };

    // === 統一EventBus実装 ===
    class UnifiedEventBus {
        constructor() {
            this.listeners = new Map();
            this.eventLog = [];
            this.maxLogSize = 100;
            this.errorHandlers = new Map();
            
            // デバッグ用統計
            this.stats = {
                eventsEmitted: 0,
                errorsHandled: 0,
                listenersCount: 0
            };
            
            debug('UnifiedEventBus initialized');
        }
        
        /**
         * イベントリスナーを登録
         * @param {string} eventName - イベント名
         * @param {Function} callback - コールバック関数
         * @param {Object} options - オプション（once: 一度だけ実行）
         */
        on(eventName, callback, options = {}) {
            if (typeof callback !== 'function') {
                console.error(`EventBus: Invalid callback for event '${eventName}'`);
                return;
            }
            
            if (!this.listeners.has(eventName)) {
                this.listeners.set(eventName, []);
            }
            
            const listener = {
                callback: callback,
                once: options.once || false,
                priority: options.priority || 0,
                id: `${eventName}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
            };
            
            const listeners = this.listeners.get(eventName);
            listeners.push(listener);
            
            // 優先度でソート（高い順）
            listeners.sort((a, b) => b.priority - a.priority);
            
            this.stats.listenersCount++;
            
            debug(`Listener registered: ${eventName} (total: ${listeners.length})`);
            
            // リスナーIDを返却（削除用）
            return listener.id;
        }
        
        /**
         * 一度だけ実行されるイベントリスナーを登録
         * @param {string} eventName - イベント名
         * @param {Function} callback - コールバック関数
         */
        once(eventName, callback) {
            return this.on(eventName, callback, { once: true });
        }
        
        /**
         * イベントリスナーを削除
         * @param {string} eventName - イベント名
         * @param {Function|string} callbackOrId - コールバック関数またはリスナーID
         */
        off(eventName, callbackOrId) {
            if (!this.listeners.has(eventName)) return;
            
            const listeners = this.listeners.get(eventName);
            let removedCount = 0;
            
            if (typeof callbackOrId === 'string') {
                // ID指定での削除
                const index = listeners.findIndex(listener => listener.id === callbackOrId);
                if (index > -1) {
                    listeners.splice(index, 1);
                    removedCount = 1;
                }
            } else {
                // コールバック関数での削除
                for (let i = listeners.length - 1; i >= 0; i--) {
                    if (listeners[i].callback === callbackOrId) {
                        listeners.splice(i, 1);
                        removedCount++;
                    }
                }
            }
            
            // 空になった場合はMapから削除
            if (listeners.length === 0) {
                this.listeners.delete(eventName);
            }
            
            this.stats.listenersCount -= removedCount;
            
            if (removedCount > 0) {
                debug(`Listener(s) removed: ${eventName} (removed: ${removedCount})`);
            }
        }
        
        /**
         * イベントを発火
         * @param {string} eventName - イベント名
         * @param {any} payload - イベントデータ
         * @param {Object} options - オプション
         */
        emit(eventName, payload = null, options = {}) {
            const timestamp = Date.now();
            
            // イベントログに記録
            this.logEvent(eventName, payload, timestamp);
            
            if (!this.listeners.has(eventName)) {
                if (CONFIG && CONFIG.debug) {
                    debug(`No listeners for event: ${eventName}`);
                }
                return;
            }
            
            const listeners = [...this.listeners.get(eventName)];
            const results = [];
            let executedCount = 0;
            
            for (const listener of listeners) {
                try {
                    const result = listener.callback({
                        type: eventName,
                        payload: payload,
                        timestamp: timestamp,
                        stopPropagation: () => { options.stopped = true; }
                    });
                    
                    results.push(result);
                    executedCount++;
                    
                    // once指定の場合は削除
                    if (listener.once) {
                        this.off(eventName, listener.id);
                    }
                    
                    // 伝播停止チェック
                    if (options.stopped) {
                        break;
                    }
                    
                } catch (error) {
                    console.error(`EventBus: Error in listener for '${eventName}':`, error);
                    this.handleListenerError(eventName, error, listener);
                    this.stats.errorsHandled++;
                }
            }
            
            this.stats.eventsEmitted++;
            
            debug(`Event emitted: ${eventName} (listeners: ${executedCount}/${listeners.length})`);
            
            return results;
        }
        
        /**
         * イベントをログに記録
         * @param {string} eventName - イベント名
         * @param {any} payload - ペイロード
         * @param {number} timestamp - タイムスタンプ
         */
        logEvent(eventName, payload, timestamp) {
            const logEntry = {
                eventName,
                payload,
                timestamp,
                payloadSize: this.getPayloadSize(payload)
            };
            
            this.eventLog.push(logEntry);
            
            // ログサイズ制限
            if (this.eventLog.length > this.maxLogSize) {
                this.eventLog.shift();
            }
        }
        
        /**
         * ペイロードサイズの推定
         * @param {any} payload - ペイロード
         * @returns {number} バイト数（推定）
         */
        getPayloadSize(payload) {
            try {
                return JSON.stringify(payload).length;
            } catch (error) {
                return 0; // 循環参照等でJSON化できない場合
            }
        }
        
        /**
         * リスナーエラーの処理
         * @param {string} eventName - イベント名
         * @param {Error} error - エラー
         * @param {Object} listener - リスナー情報
         */
        handleListenerError(eventName, error, listener) {
            const errorHandler = this.errorHandlers.get(eventName);
            if (errorHandler) {
                try {
                    errorHandler(error, listener);
                } catch (handlerError) {
                    console.error(`EventBus: Error in error handler for '${eventName}':`, handlerError);
                }
            }
            
            // 重大なエラーの場合はリスナーを無効化
            if (error.name === 'TypeError' || error.name === 'ReferenceError') {
                console.warn(`EventBus: Disabling problematic listener for '${eventName}'`);
                this.off(eventName, listener.id);
            }
        }
        
        /**
         * エラーハンドラーを設定
         * @param {string} eventName - イベント名
         * @param {Function} handler - エラーハンドラー
         */
        setErrorHandler(eventName, handler) {
            this.errorHandlers.set(eventName, handler);
        }
        
        /**
         * 特定イベントの全リスナーを削除
         * @param {string} eventName - イベント名
         */
        removeAllListeners(eventName) {
            if (eventName) {
                const count = this.listeners.get(eventName)?.length || 0;
                this.listeners.delete(eventName);
                this.stats.listenersCount -= count;
                debug(`All listeners removed for: ${eventName} (count: ${count})`);
            } else {
                // 全イベントのリスナー削除
                const totalCount = Array.from(this.listeners.values())
                    .reduce((sum, listeners) => sum + listeners.length, 0);
                this.listeners.clear();
                this.errorHandlers.clear();
                this.stats.listenersCount = 0;
                debug(`All listeners removed (count: ${totalCount})`);
            }
        }
        
        /**
         * イベントリスト取得
         * @returns {Array} イベント名の配列
         */
        getEventNames() {
            return Array.from(this.listeners.keys());
        }
        
        /**
         * 特定イベントのリスナー数取得
         * @param {string} eventName - イベント名
         * @returns {number} リスナー数
         */
        getListenerCount(eventName) {
            return this.listeners.get(eventName)?.length || 0;
        }
        
        /**
         * 統計情報取得
         * @returns {Object} 統計データ
         */
        getStats() {
            return {
                ...this.stats,
                eventTypes: this.listeners.size,
                recentEvents: this.eventLog.slice(-10).map(log => ({
                    eventName: log.eventName,
                    timestamp: log.timestamp,
                    payloadSize: log.payloadSize
                }))
            };
        }
        
        /**
         * イベントログ取得
         * @param {Object} options - フィルターオプション
         * @returns {Array} イベントログ
         */
        getEventLog(options = {}) {
            let log = [...this.eventLog];
            
            // フィルター適用
            if (options.eventName) {
                log = log.filter(entry => entry.eventName === options.eventName);
            }
            
            if (options.since) {
                log = log.filter(entry => entry.timestamp >= options.since);
            }
            
            if (options.limit) {
                log = log.slice(-options.limit);
            }
            
            return log;
        }
        
        /**
         * デバッグ情報をコンソールに出力
         */
        debugInfo() {
            console.group('🚌 EventBus Debug Info');
            console.log('Statistics:', this.getStats());
            console.log('Event Types:', this.getEventNames());
            console.log('Recent Events:', this.getEventLog({ limit: 10 }));
            
            // リスナー詳細
            console.group('Listeners by Event:');
            for (const [eventName, listeners] of this.listeners.entries()) {
                console.log(`${eventName}: ${listeners.length} listeners`);
            }
            console.groupEnd();
            
            console.groupEnd();
        }
        
        /**
         * システム間連携用のヘルパーメソッド
         */
        
        // CoordinateSystem → LayerSystem連携
        notifyCoordinateTransform(fromSpace, toSpace, point) {
            this.emit('coordinate-transform', {
                fromSpace, toSpace, point,
                source: 'CoordinateSystem'
            });
        }
        
        // LayerSystem → UI連携
        notifyLayerChanged(action, layerData) {
            this.emit(`layer-${action}`, {
                ...layerData,
                source: 'LayerSystem'
            });
        }
        
        // CameraSystem → UI連携
        notifyCameraChanged(cameraState) {
            this.emit('camera-moved', {
                ...cameraState,
                source: 'CameraSystem'
            });
        }
        
        // UI → System連携
        requestSystemAction(system, action, data) {
            this.emit(`${system}-action-requested`, {
                action, data,
                source: 'UI'
            });
        }
    }

    // === グローバルシングルトンEventBus ===
    let globalEventBus = null;
    
    /**
     * EventBusシングルトン取得
     * @returns {UnifiedEventBus}
     */
    function getEventBus() {
        if (!globalEventBus) {
            globalEventBus = new UnifiedEventBus();
            
            // デバッグモードの場合、グローバルに公開
            if (CONFIG && CONFIG.debug) {
                window.debugEventBus = globalEventBus;
            }
        }
        return globalEventBus;
    }
    
    // === グローバル公開 ===
    window.EventBus = getEventBus();
    window.getEventBus = getEventBus;
    
    // 初期化完了通知
    debug('Unified EventBus system loaded');
    
    // システム連携用のグローバルヘルパー
    window.TEGAKI_EVENTS = {
        // よく使用されるイベント名の定数
        COORDINATE_TRANSFORM: 'coordinate-transform',
        LAYER_CREATED: 'layer-created',
        LAYER_SELECTED: 'layer-selected',
        LAYER_DELETED: 'layer-deleted',
        CAMERA_MOVED: 'camera-moved',
        WINDOW_RESIZED: 'window-resized',
        
        // 便利なヘルパー関数
        emit: (eventName, payload) => getEventBus().emit(eventName, payload),
        on: (eventName, callback, options) => getEventBus().on(eventName, callback, options),
        off: (eventName, callback) => getEventBus().off(eventName, callback),
        once: (eventName, callback) => getEventBus().once(eventName, callback)
    };

})();