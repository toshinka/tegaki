/**
 * 統一EventStore v3.2 - mitt.js活用統一イベントバス
 * PixiJS統合・疎結合アーキテクチャ・高性能イベント管理
 * 規約: 総合AIコーディング規約v4.1準拠（PixiJS統一座標対応）
 */

import mitt from 'mitt';

/**
 * 統一EventStore - アプリケーション全体のイベント管理
 * mitt.js活用による軽量・高速・疎結合イベントシステム
 */
export class EventStore {
    constructor() {
        // mitt.js イベントエミッター
        this.emitter = mitt();
        
        // イベント統計・監視
        this.stats = {
            totalEvents: 0,
            totalListeners: 0,
            eventTypes: new Map(),
            errors: 0,
            performance: {
                startTime: Date.now(),
                lastEventTime: null,
                averageEventTime: 0
            }
        };
        
        // Phase段階対応イベントバッファ
        this.eventBuffer = [];
        this.bufferEnabled = false;
        
        // デバッグ・ログ設定
        this.debugMode = process.env.NODE_ENV === 'development';
        this.eventLog = [];
        this.maxLogSize = 1000;
        
        this.isHealthy = true;
        this.initialize();
    }
    
    /**
     * EventStore初期化
     */
    initialize() {
        try {
            // グローバルエラーハンドリング設定
            this.setupErrorHandling();
            
            // パフォーマンス監視設定
            this.setupPerformanceMonitoring();
            
            // Phase1基本イベント登録
            this.registerPhase1Events();
            
            console.log('📡 EventStore初期化完了 - mitt.js統一イベントバス');
            
        } catch (error) {
            console.error('❌ EventStore初期化エラー:', error);
            this.stats.errors++;
            this.isHealthy = false;
        }
    }
    
    /**
     * エラーハンドリング設定
     */
    setupErrorHandling() {
        // mitt.js内部エラーをキャッチ
        const originalEmit = this.emitter.emit;
        this.emitter.emit = (type, event) => {
            try {
                this.logEvent('emit', type, event);
                return originalEmit.call(this.emitter, type, event);
            } catch (error) {
                console.error('❌ EventStore emit エラー:', error);
                this.stats.errors++;
                this.handleEventError(type, event, error);
            }
        };
    }
    
    /**
     * パフォーマンス監視設定
     */
    setupPerformanceMonitoring() {
        // イベント処理時間監視
        this.performanceObserver = {
            startTime: null,
            endTime: null,
            measurements: []
        };
        
        // 定期統計更新
        this.statsInterval = setInterval(() => {
            this.updateStats();
        }, 5000); // 5秒間隔
    }
    
    /**
     * Phase1基本イベント登録
     */
    registerPhase1Events() {
        // PixiJS統一座標系イベント
        this.registerEventType('coordinate:transform');
        this.registerEventType('coordinate:update');
        this.registerEventType('viewport:resize');
        this.registerEventType('viewport:updated');
        
        // PixiJS統一描画イベント
        this.registerEventType('draw:start');
        this.registerEventType('draw:continue');
        this.registerEventType('draw:end');
        this.registerEventType('draw:clear');
        
        // 入力制御イベント
        this.registerEventType('input:pointer:down');
        this.registerEventType('input:pointer:move');
        this.registerEventType('input:pointer:up');
        this.registerEventType('input:key:down');
        this.registerEventType('input:key:up');
        
        // 履歴制御イベント
        this.registerEventType('history:undo');
        this.registerEventType('history:redo');
        this.registerEventType('history:save');
        this.registerEventType('history:clear');
        
        // システムイベント
        this.registerEventType('system:ready');
        this.registerEventType('system:error');
        this.registerEventType('system:phase:change');
        
        console.log('📡 Phase1基本イベント登録完了');
    }
    
    /**
     * イベントタイプ登録
     */
    registerEventType(eventType) {
        if (!this.stats.eventTypes.has(eventType)) {
            this.stats.eventTypes.set(eventType, {
                count: 0,
                lastEmitted: null,
                listeners: 0
            });
        }
    }
    
    /**
     * イベント発信（mitt.jsラッパー）
     */
    emit(type, data = null) {
        try {
            const startTime = performance.now();
            
            // イベント統計更新
            this.updateEventStats(type);
            
            // バッファリング対応
            if (this.bufferEnabled) {
                this.eventBuffer.push({ type, data, timestamp: Date.now() });
                return;
            }
            
            // mitt.js経由でイベント発信
            this.emitter.emit(type, data);
            
            // パフォーマンス記録
            const endTime = performance.now();
            this.recordPerformance(type, endTime - startTime);
            
            this.stats.totalEvents++;
            this.stats.performance.lastEventTime = Date.now();
            
        } catch (error) {
            console.error(`❌ EventStore emit エラー [${type}]:`, error);
            this.stats.errors++;
        }
    }
    
    /**
     * イベントリスナー登録（mitt.jsラッパー）
     */
    on(type, handler) {
        try {
            // リスナー統計更新
            this.updateListenerStats(type, 'add');
            
            // mitt.js経由でリスナー登録
            this.emitter.on(type, handler);
            
            this.stats.totalListeners++;
            
            if (this.debugMode) {
                console.debug(`📡 EventStore リスナー登録: ${type}`);
            }
            
        } catch (error) {
            console.error(`❌ EventStore on エラー [${type}]:`, error);
            this.stats.errors++;
        }
    }
    
    /**
     * イベントリスナー削除（mitt.jsラッパー）
     */
    off(type, handler) {
        try {
            // リスナー統計更新
            this.updateListenerStats(type, 'remove');
            
            // mitt.js経由でリスナー削除
            this.emitter.off(type, handler);
            
            this.stats.totalListeners = Math.max(0, this.stats.totalListeners - 1);
            
            if (this.debugMode) {
                console.debug(`📡 EventStore リスナー削除: ${type}`);
            }
            
        } catch (error) {
            console.error(`❌ EventStore off エラー [${type}]:`, error);
            this.stats.errors++;
        }
    }
    
    /**
     * 一回限りイベントリスナー（カスタム実装）
     */
    once(type, handler) {
        const wrappedHandler = (data) => {
            handler(data);
            this.off(type, wrappedHandler);
        };
        
        this.on(type, wrappedHandler);
    }
    
    /**
     * イベント統計更新
     */
    updateEventStats(type) {
        if (this.stats.eventTypes.has(type)) {
            const eventStat = this.stats.eventTypes.get(type);
            eventStat.count++;
            eventStat.lastEmitted = Date.now();
        } else {
            this.registerEventType(type);
            this.updateEventStats(type); // 再帰呼び出し
        }
    }
    
    /**
     * リスナー統計更新
     */
    updateListenerStats(type, action) {
        if (this.stats.eventTypes.has(type)) {
            const eventStat = this.stats.eventTypes.get(type);
            if (action === 'add') {
                eventStat.listeners++;
            } else if (action === 'remove') {
                eventStat.listeners = Math.max(0, eventStat.listeners - 1);
            }
        }
    }
    
    /**
     * パフォーマンス記録
     */
    recordPerformance(type, duration) {
        this.performanceObserver.measurements.push({
            type,
            duration,
            timestamp: Date.now()
        });
        
        // 測定データサイズ制限
        if (this.performanceObserver.measurements.length > 100) {
            this.performanceObserver.measurements = 
                this.performanceObserver.measurements.slice(-50);
        }
        
        // 平均処理時間更新
        const totalDuration = this.performanceObserver.measurements
            .reduce((sum, m) => sum + m.duration, 0);
        this.stats.performance.averageEventTime = 
            totalDuration / this.performanceObserver.measurements.length;
    }
    
    /**
     * イベントログ記録
     */
    logEvent(action, type, data) {
        if (!this.debugMode) return;
        
        const logEntry = {
            action,
            type,
            data: this.sanitizeLogData(data),
            timestamp: Date.now(),
            id: this.generateLogId()
        };
        
        this.eventLog.push(logEntry);
        
        // ログサイズ制限
        if (this.eventLog.length > this.maxLogSize) {
            this.eventLog = this.eventLog.slice(-Math.floor(this.maxLogSize * 0.8));
        }
    }
    
    /**
     * ログデータ無害化
     */
    sanitizeLogData(data) {
        if (!data) return null;
        
        try {
            // 循環参照・巨大オブジェクト対策
            return JSON.parse(JSON.stringify(data, (key, value) => {
                if (key === 'pixiApp' || key === 'stage' || key === 'renderer') {
                    return '[PixiJS Object]';
                }
                if (typeof value === 'function') {
                    return '[Function]';
                }
                return value;
            }));
        } catch (error) {
            return '[Unserializable Data]';
        }
    }
    
    /**
     * ログID生成
     */
    generateLogId() {
        return 'evt_' + Date.now().toString(36) + '_' + 
               Math.random().toString(36).substr(2, 5);
    }
    
    /**
     * イベントバッファ制御
     */
    enableBuffer() {
        this.bufferEnabled = true;
        console.log('📡 EventStore バッファリング有効化');
    }
    
    disableBuffer() {
        this.bufferEnabled = false;
        console.log('📡 EventStore バッファリング無効化');
    }
    
    flushBuffer() {
        if (this.eventBuffer.length > 0) {
            console.log(`📡 EventStore バッファフラッシュ: ${this.eventBuffer.length}件`);
            
            this.eventBuffer.forEach(bufferedEvent => {
                this.emit(bufferedEvent.type, bufferedEvent.data);
            });
            
            this.eventBuffer = [];
        }
    }
    
    /**
     * イベントエラーハンドリング
     */
    handleEventError(type, data, error) {
        const errorEvent = {
            originalType: type,
            originalData: data,
            error: error.message,
            timestamp: Date.now()
        };
        
        // エラーイベント発信（再帰防止）
        try {
            this.emitter.emit('system:error', errorEvent);
        } catch (nestedError) {
            console.error('❌ ネストしたEventStoreエラー:', nestedError);
        }
    }
    
    /**
     * 統計更新
     */
    updateStats() {
        const uptime = Date.now() - this.stats.performance.startTime;
        
        // 健全性チェック
        this.isHealthy = this.stats.errors < 10 && 
                         this.stats.performance.averageEventTime < 10;
        
        if (this.debugMode) {
            console.debug('📡 EventStore統計更新:', {
                uptime: Math.round(uptime / 1000) + 's',
                totalEvents: this.stats.totalEvents,
                totalListeners: this.stats.totalListeners,
                errors: this.stats.errors,
                healthy: this.isHealthy
            });
        }
    }
    
    /**
     * 統計情報取得
     */
    getStats() {
        return {
            ...this.stats,
            uptime: Date.now() - this.stats.performance.startTime,
            eventTypes: Array.from(this.stats.eventTypes.entries()),
            bufferSize: this.eventBuffer.length,
            logSize: this.eventLog.length,
            healthy: this.isHealthy
        };
    }
    
    /**
     * イベントログ取得
     */
    getEventLog(limit = 50) {
        return this.eventLog.slice(-limit);
    }
    
    /**
     * 健全性確認
     */
    isHealthy() {
        return this.isHealthy;
    }
    
    /**
     * Phase2準備チェック（将来実装用）
     */
    checkPhase2Ready() {
        // Phase2イベント予約登録
        const phase2Events = [
            'tool:select', 'tool:change', 'tool:config',
            'ui:show', 'ui:hide', 'ui:update',
            'color:select', 'color:change',
            'layer:create', 'layer:delete', 'layer:select'
        ];
        
        phase2Events.forEach(eventType => {
            // this.registerEventType(eventType); // 🔒Phase2解封
        });
        
        console.log('🎨 Phase2イベント準備完了');
    }
    
    /**
     * Phase3準備チェック（将来実装用）
     */
    checkPhase3Ready() {
        // Phase3イベント予約登録
        const phase3Events = [
            'offscreen:process', 'offscreen:complete',
            'animation:play', 'animation:stop',
            'export:start', 'export:progress', 'export:complete',
            'project:save', 'project:load'
        ];
        
        phase3Events.forEach(eventType => {
            // this.registerEventType(eventType); // 🔒Phase3解封
        });
        
        console.log('⚡ Phase3イベント準備完了');
    }
    
    /**
     * デバッグ情報表示
     */
    showDebugInfo() {
        console.group('📡 EventStore デバッグ情報');
        console.log('統計:', this.getStats());
        console.log('最新ログ:', this.getEventLog(10));
        console.log('パフォーマンス:', this.performanceObserver.measurements.slice(-5));
        console.groupEnd();
    }
    
    /**
     * 破棄処理
     */
    destroy() {
        try {
            // インターバル停止
            if (this.statsInterval) {
                clearInterval(this.statsInterval);
            }
            
            // 全リスナー削除
            this.emitter.all.clear();
            
            // バッファクリア
            this.eventBuffer = [];
            this.eventLog = [];
            
            console.log('📡 EventStore破棄完了');
            
        } catch (error) {
            console.error('❌ EventStore破棄エラー:', error);
        }
    }
}