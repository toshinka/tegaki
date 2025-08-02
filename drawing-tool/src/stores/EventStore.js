/**
 * イベントストア・mitt.js統一イベント管理
 * モダンお絵かきツール v3.3 - Phase1統合イベントシステム
 * 
 * 機能:
 * - mitt.js軽量イベントバス統合
 * - PixiJS v8システム間連携イベント
 * - Chrome API統合イベント処理
 * - エアスプレー・履歴・ショートカット統合
 * - デバッグ・監視・エラーハンドリング
 */

import mitt from 'mitt';

/**
 * EventStore - 統合イベント管理
 * mitt.js活用・PixiJS v8統合・Chrome API連携
 */
class EventStore {
    constructor() {
        // mitt.js軽量イベントバス
        this.emitter = mitt();
        
        // イベント統計・監視
        this.eventStats = {
            totalEvents: 0,
            eventCounts: new Map(),
            errorCounts: new Map(),
            lastActivity: Date.now()
        };
        
        // エラーハンドリング
        this.errorHandlers = new Map();
        this.debugMode = false;
        
        // パフォーマンス監視
        this.performanceMetrics = {
            averageEventTime: 0,
            slowEvents: [],
            eventQueue: []
        };
        
        // Phase1専用イベント定義
        this.phase1Events = new Set([
            // 描画関連
            'drawing-start', 'drawing-update', 'drawing-end',
            'tool-changed', 'tool-config-updated',
            
            // エアスプレー関連（v3.3新機能）
            'airbrush-spray', 'airbrush-settings-change',
            
            // レイヤー関連
            'layer-created', 'layer-deleted', 'layer-clear',
            'layer-navigation', 'layer-content-mode',
            
            // キャンバス関連
            'canvas-resize', 'canvas-clear', 'canvas-move',
            'canvas-flip', 'canvas-reset-view',
            
            // 履歴関連
            'history-action', 'history-updated', 'undo-executed', 'redo-executed',
            'history-cleared',
            
            // ショートカット関連
            'shortcut-executed', 'shortcut-error', 'shortcut-hold-end',
            
            // UI関連
            'ui-panel-toggle', 'popup-hide', 'ui-panel-reset',
            
            // システム関連
            'error-occurred', 'webgpu-state-change', 'performance-warning'
        ]);
        
        this.initializeEventHandling();
        this.setupPerformanceMonitoring();
        
        console.log('✅ EventStore初期化完了 - mitt.js統一イベント管理');
    }
    
    /**
     * イベントハンドリング初期化
     * エラー処理・統計収集設定
     */
    initializeEventHandling() {
        // 全イベント監視（統計・デバッグ用）
        this.emitter.on('*', (type, data) => {
            this.recordEventStats(type, data);
            
            if (this.debugMode) {
                console.log(`📡 Event: ${type}`, data);
            }
        });
        
        // エラーイベント専用処理
        this.emitter.on('error-occurred', (data) => {
            this.handleSystemError(data);
        });
        
        // パフォーマンス警告処理
        this.emitter.on('performance-warning', (data) => {
            console.warn('⚠️ パフォーマンス警告:', data);
        });
        
        console.log('🔧 イベントハンドリング初期化完了');
    }
    
    /**
     * パフォーマンス監視設定
     * イベント処理時間・キュー監視
     */
    setupPerformanceMonitoring() {
        // 定期的な統計更新
        setInterval(() => {
            this.updatePerformanceMetrics();
            this.checkEventQueueHealth();
        }, 10000); // 10秒間隔
        
        console.log('📊 パフォーマンス監視設定完了');
    }
    
    /**
     * イベント発行
     * mitt.js統合・パフォーマンス監視・エラーハンドリング
     */
    emit(eventType, data = null) {
        const startTime = performance.now();
        
        try {
            // Phase1イベント検証
            if (!this.phase1Events.has(eventType)) {
                console.warn(`⚠️ 未定義イベント: ${eventType}`);
            }
            
            // データ検証
            const validatedData = this.validateEventData(eventType, data);
            
            // イベント発行（mitt.js）
            this.emitter.emit(eventType, validatedData);
            
            // パフォーマンス記録
            const duration = performance.now() - startTime;
            this.recordEventPerformance(eventType, duration);
            
            return true;
            
        } catch (error) {
            console.error(`❌ イベント発行エラー [${eventType}]:`, error);
            this.emit('error-occurred', {
                type: 'event-emission',
                eventType: eventType,
                error: error.message,
                timestamp: Date.now()
            });
            return false;
        }
    }
    
    /**
     * イベント監視登録
     * mitt.js統合・エラーハンドリング強化
     */
    on(eventType, handler) {
        if (typeof handler !== 'function') {
            throw new Error('イベントハンドラーは関数である必要があります');
        }
        
        // エラーハンドリングラッパー
        const wrappedHandler = (data) => {
            try {
                handler(data);
            } catch (error) {
                console.error(`❌ イベントハンドラーエラー [${eventType}]:`, error);
                this.emit('error-occurred', {
                    type: 'event-handler',
                    eventType: eventType,
                    error: error.message,
                    timestamp: Date.now()
                });
            }
        };
        
        this.emitter.on(eventType, wrappedHandler);
        
        console.log(`🔗 イベントリスナー登録: ${eventType}`);
        return wrappedHandler;
    }
    
    /**
     * イベント監視解除
     */
    off(eventType, handler) {
        this.emitter.off(eventType, handler);
        console.log(`🔓 イベントリスナー解除: ${eventType}`);
    }
    
    /**
     * 一度だけ実行するイベント監視
     */
    once(eventType, handler) {
        const wrappedHandler = (data) => {
            try {
                handler(data);
            } catch (error) {
                console.error(`❌ ワンタイムハンドラーエラー [${eventType}]:`, error);
            }
        };
        
        // mitt.jsにはonce機能がないため実装
        const onceWrapper = (data) => {
            wrappedHandler(data);
            this.off(eventType, onceWrapper);
        };
        
        this.on(eventType, onceWrapper);
        return onceWrapper;
    }
    
    /**
     * イベントデータ検証
     * Phase1専用データ構造検証
     */
    validateEventData(eventType, data) {
        // イベント別データ検証ルール
        const validationRules = {
            'drawing-start': ['x', 'y', 'toolConfig'],
            'drawing-update': ['x', 'y'],
            'drawing-end': ['x', 'y'],
            'tool-changed': ['tool'],
            'airbrush-spray': ['x', 'y', 'pressure', 'settings'],
            'airbrush-settings-change': ['property'],
            'layer-created': ['name'],
            'layer-deleted': ['layerId'],
            'canvas-resize': ['width', 'height'],
            'history-action': ['type'],
            'shortcut-executed': ['shortcut', 'action'],
            'error-occurred': ['type', 'error']
        };
        
        const rules = validationRules[eventType];
        if (!rules || !data) {
            return data;
        }
        
        // 必須フィールド検証
        const missingFields = rules.filter(field => !(field in data));
        if (missingFields.length > 0) {
            console.warn(`⚠️ イベントデータ不備 [${eventType}]:`, missingFields);
        }
        
        return data;
    }
    
    /**
     * イベント統計記録
     * 使用頻度・パフォーマンス監視
     */
    recordEventStats(eventType, data) {
        this.eventStats.totalEvents++;
        this.eventStats.lastActivity = Date.now();
        
        // イベント種別カウント
        const currentCount = this.eventStats.eventCounts.get(eventType) || 0;
        this.eventStats.eventCounts.set(eventType, currentCount + 1);
    }
    
    /**
     * イベントパフォーマンス記録
     * 処理時間・遅延検出
     */
    recordEventPerformance(eventType, duration) {
        // 遅いイベント検出（5ms以上）
        if (duration > 5) {
            this.performanceMetrics.slowEvents.push({
                eventType: eventType,
                duration: duration,
                timestamp: Date.now()
            });
            
            // 最新10件のみ保持
            if (this.performanceMetrics.slowEvents.length > 10) {
                this.performanceMetrics.slowEvents.shift();
            }
        }
        
        // 平均処理時間更新
        const currentAvg = this.performanceMetrics.averageEventTime;
        this.performanceMetrics.averageEventTime = 
            (currentAvg * 0.9) + (duration * 0.1); // 指数移動平均
    }
    
    /**
     * システムエラーハンドリング
     * 重要エラーの集約・通知
     */
    handleSystemError(errorData) {
        const errorType = errorData.type;
        
        // エラーカウント更新
        const currentCount = this.eventStats.errorCounts.get(errorType) || 0;
        this.eventStats.errorCounts.set(errorType, currentCount + 1);
        
        // 重要エラーの特別処理
        const criticalErrors = [
            'pixi-initialization',
            'webgpu-fallback',
            'state-capture',
            'state-restore'
        ];
        
        if (criticalErrors.includes(errorType)) {
            console.error('🚨 重要エラー発生:', errorData);
            
            // カスタムエラーハンドラー実行
            const customHandler = this.errorHandlers.get(errorType);
            if (customHandler) {
                customHandler(errorData);
            }
        }
    }
    
    /**
     * カスタムエラーハンドラー登録
     */
    registerErrorHandler(errorType, handler) {
        this.errorHandlers.set(errorType, handler);
        console.log(`🛡️ エラーハンドラー登録: ${errorType}`);
    }
    
    /**
     * パフォーマンスメトリクス更新
     */
    updatePerformanceMetrics() {
        const now = Date.now();
        const timeSinceLastActivity = now - this.eventStats.lastActivity;
        
        // 非アクティブ状態検出（30秒以上）
        if (timeSinceLastActivity > 30000) {
            console.log('😴 イベント非アクティブ状態');
        }
        
        // メモリ使用量警告
        if (this.performanceMetrics.slowEvents.length > 5) {
            this.emit('performance-warning', {
                type: 'slow-events',
                count: this.performanceMetrics.slowEvents.length,
                events: this.performanceMetrics.slowEvents
            });
        }
    }
    
    /**
     * イベントキュー健全性チェック
     */
    checkEventQueueHealth() {
        // mitt.jsは同期処理のためキューは存在しないが、
        // 将来の拡張性のため監視ポイントを用意
        
        const queueSize = this.performanceMetrics.eventQueue.length;
        if (queueSize > 100) {
            this.emit('performance-warning', {
                type: 'event-queue-overflow',
                queueSize: queueSize
            });
        }
    }
    
    /**
     * Phase1イベント一覧取得
     */
    getPhase1Events() {
        return Array.from(this.phase1Events).sort();
    }
    
    /**
     * イベント統計取得
     */
    getEventStats() {
        return {
            totalEvents: this.eventStats.totalEvents,
            eventCounts: Object.fromEntries(this.eventStats.eventCounts),
            errorCounts: Object.fromEntries(this.eventStats.errorCounts),
            lastActivity: new Date(this.eventStats.lastActivity).toISOString(),
            averageEventTime: this.performanceMetrics.averageEventTime.toFixed(2) + 'ms',
            slowEventCount: this.performanceMetrics.slowEvents.length
        };
    }
    
    /**
     * デバッグモード切り替え
     */
    setDebugMode(enabled) {
        this.debugMode = enabled;
        console.log(`🐛 デバッグモード: ${enabled ? 'ON' : 'OFF'}`);
    }
    
    /**
     * 全イベントリスナークリア
     */
    clearAllListeners() {
        this.emitter.all.clear();
        console.log('🗑️ 全イベントリスナークリア完了');
    }
    
    /**
     * 特定イベントのリスナー数取得
     */
    getListenerCount(eventType) {
        const listeners = this.emitter.all.get(eventType);
        return listeners ? listeners.length : 0;
    }
    
    /**
     * アクティブイベント種別一覧
     */
    getActiveEventTypes() {
        return Array.from(this.emitter.all.keys()).sort();
    }
    
    /**
     * イベント発行テスト（デバッグ用）
     */
    testEvent(eventType, testData = {}) {
        console.log(`🧪 テストイベント発行: ${eventType}`);
        
        const testPayload = {
            ...testData,
            test: true,
            timestamp: Date.now()
        };
        
        return this.emit(eventType, testPayload);
    }
    
    /**
     * システム状態診断
     */
    diagnoseSystem() {
        const diagnosis = {
            eventStore: {
                totalEvents: this.eventStats.totalEvents,
                activeListeners: this.emitter.all.size,
                averageEventTime: this.performanceMetrics.averageEventTime,
                errorCount: Array.from(this.eventStats.errorCounts.values()).reduce((a, b) => a + b, 0)
            },
            performance: {
                slowEvents: this.performanceMetrics.slowEvents.length,
                lastActivity: Date.now() - this.eventStats.lastActivity,
                memoryPressure: this.emitter.all.size > 50 ? 'high' : 'normal'
            },
            health: 'good' // デフォルト
        };
        
        // 健全性判定
        if (diagnosis.performance.slowEvents > 3) {
            diagnosis.health = 'warning';
        }
        if (diagnosis.eventStore.errorCount > 10) {
            diagnosis.health = 'critical';
        }
        
        return diagnosis;
    }
    
    /**
     * Phase1向け便利メソッド群
     */
    
    // 描画関連イベント
    emitDrawingStart(x, y, toolConfig) {
        return this.emit('drawing-start', { x, y, toolConfig, timestamp: Date.now() });
    }
    
    emitDrawingUpdate(x, y, pressure = 1.0) {
        return this.emit('drawing-update', { x, y, pressure, timestamp: Date.now() });
    }
    
    emitDrawingEnd(x, y) {
        return this.emit('drawing-end', { x, y, timestamp: Date.now() });
    }
    
    // ツール関連イベント
    emitToolChange(tool, config = {}) {
        return this.emit('tool-changed', { tool, config, timestamp: Date.now() });
    }
    
    // エアスプレー関連（v3.3新機能）
    emitAirbrushSpray(x, y, pressure, settings) {
        return this.emit('airbrush-spray', { x, y, pressure, settings, timestamp: Date.now() });
    }
    
    // 履歴関連イベント
    emitHistoryAction(type, data = {}) {
        return this.emit('history-action', { type, ...data, timestamp: Date.now() });
    }
    
    // エラー関連イベント
    emitError(type, error, context = {}) {
        return this.emit('error-occurred', {
            type,
            error: error instanceof Error ? error.message : error,
            context,
            timestamp: Date.now()
        });
    }
    
    /**
     * リソース解放
     */
    destroy() {
        // 全リスナークリア
        this.clearAllListeners();
        
        // 統計データクリア
        this.eventStats.eventCounts.clear();
        this.eventStats.errorCounts.clear();
        this.errorHandlers.clear();
        
        // パフォーマンスデータクリア
        this.performanceMetrics.slowEvents = [];
        this.performanceMetrics.eventQueue = [];
        
        console.log('🗑️ EventStore リソース解放完了');
    }
}

export default EventStore;