/**
 * 🎨 ふたば☆お絵描きツール - 統一イベントバスシステム（修正版）
 * 🎯 AI_WORK_SCOPE: 循環依存排除・イベント駆動アーキテクチャ
 * 🎯 DEPENDENCIES: なし（独立システム）
 * 🎯 PIXI_EXTENSIONS: 使用しない
 * 🎯 ISOLATION_TEST: 可能
 * 🎯 SPLIT_THRESHOLD: 150行以下維持
 * 📋 PHASE_TARGET: Phase1統一化
 * 📋 V8_MIGRATION: v8対応イベント準備済み
 * 🚨 FIX: ErrorManager循環参照防止・エラーハンドリング改善
 */

/**
 * 統一イベントバスシステム（修正版）
 * 循環依存を排除し、疎結合なアーキテクチャを実現
 */
class EventBus {
    /**
     * イベントリスナーマップ
     */
    static events = new Map();
    
    /**
     * イベント統計
     */
    static stats = {
        emitted: 0,
        listeners: 0,
        types: new Set(),
        errors: 0
    };
    
    /**
     * エラーハンドリング状態フラグ
     */
    static _errorHandling = false;
    
    /**
     * イベント発行（修正版）
     * @param {string} eventType - イベントタイプ
     * @param {any} data - イベントデータ
     */
    static emit(eventType, data = null) {
        this.stats.emitted++;
        this.stats.types.add(eventType);
        
        const listeners = this.events.get(eventType) || [];
        
        if (listeners.length === 0) {
            // リスナーがない場合の警告（デバッグ用）
            console.debug(`📡 EventBus: リスナーなし - ${eventType}`);
            return;
        }
        
        console.debug(`📡 EventBus: ${eventType} → ${listeners.length}件のリスナー`);
        
        // リスナー実行（エラーハンドリング付き・修正版）
        listeners.forEach((listener, index) => {
            try {
                listener(data);
            } catch (error) {
                this.stats.errors++;
                console.error(`📡 EventBus: リスナーエラー - ${eventType}[${index}]:`, error);
                
                // 🚨 修正: 循環参照防止・ErrorManager内部エラー特別処理
                if (this._shouldPreventErrorCascade(error, eventType)) {
                    console.error('🔄 EventBus: 循環参照防止 - ErrorManager内部エラー検出');
                    return;
                }
                
                // ErrorManager が利用可能な場合はエラー報告（安全版）
                if (window.ErrorManager && !this._errorHandling) {
                    this._errorHandling = true;
                    
                    try {
                        // safeErrorメソッドがある場合は使用、ない場合は従来のshowError
                        if (typeof window.ErrorManager.safeError === 'function') {
                            window.ErrorManager.safeError(
                                `イベントリスナーエラー: ${eventType} - ${error.message}`,
                                'warning'
                            );
                        } else {
                            window.ErrorManager.showError('warning', 
                                `イベントリスナーエラー: ${eventType} - ${error.message}`,
                                { test: false }
                            );
                        }
                    } catch (errorManagerError) {
                        console.error('🔒 EventBus: ErrorManager呼び出し失敗:', errorManagerError);
                    } finally {
                        // 短時間後にフラグリセット（循環防止）
                        setTimeout(() => {
                            this._errorHandling = false;
                        }, 100);
                    }
                }
            }
        });
    }
    
    /**
     * エラー連鎖防止判定（修正版）
     * @param {Error} error - エラーオブジェクト
     * @param {string} eventType - イベントタイプ
     * @returns {boolean} 防止すべきかどうか
     */
    static _shouldPreventErrorCascade(error, eventType) {
        // ErrorManager内部エラーの検出
        if (error.message && error.message.includes('options is not defined')) {
            return true;
        }
        
        // ErrorManagerからのイベントエラー
        if (eventType.includes('Error') || eventType.includes('error')) {
            return true;
        }
        
        // スタックトレースにErrorManagerが含まれる
        if (error.stack && error.stack.includes('ErrorManager')) {
            return true;
        }
        
        // 既にエラーハンドリング中
        if (this._errorHandling) {
            return true;
        }
        
        return false;
    }
    
    /**
     * イベントリスナー登録
     * @param {string} eventType - イベントタイプ
     * @param {Function} callback - コールバック関数
     * @returns {Function} リスナー削除用関数
     */
    static on(eventType, callback) {
        if (typeof callback !== 'function') {
            throw new Error('EventBus: コールバックは関数である必要があります');
        }
        
        if (!this.events.has(eventType)) {
            this.events.set(eventType, []);
        }
        
        this.events.get(eventType).push(callback);
        this.stats.listeners++;
        
        console.debug(`📡 EventBus: リスナー登録 - ${eventType} (計${this.events.get(eventType).length}件)`);
        
        // リスナー削除用関数を返す
        return () => this.off(eventType, callback);
    }
    
    /**
     * イベントリスナー削除
     * @param {string} eventType - イベントタイプ
     * @param {Function} callback - コールバック関数
     */
    static off(eventType, callback) {
        const listeners = this.events.get(eventType) || [];
        const index = listeners.indexOf(callback);
        
        if (index > -1) {
            listeners.splice(index, 1);
            this.stats.listeners--;
            
            console.debug(`📡 EventBus: リスナー削除 - ${eventType} (残り${listeners.length}件)`);
            
            // リスナーがなくなった場合はイベントタイプも削除
            if (listeners.length === 0) {
                this.events.delete(eventType);
            }
        } else {
            console.warn(`📡 EventBus: 削除対象リスナーが見つからない - ${eventType}`);
        }
    }
    
    /**
     * 特定イベントタイプの全リスナー削除
     * @param {string} eventType - イベントタイプ
     */
    static offAll(eventType) {
        const listeners = this.events.get(eventType) || [];
        this.stats.listeners -= listeners.length;
        
        this.events.delete(eventType);
        
        console.debug(`📡 EventBus: 全リスナー削除 - ${eventType} (${listeners.length}件削除)`);
    }
    
    /**
     * 全イベントリスナー削除
     */
    static clear() {
        const totalListeners = this.stats.listeners;
        
        this.events.clear();
        this.stats.listeners = 0;
        this._errorHandling = false; // エラー状態もリセット
        
        console.debug(`📡 EventBus: 全イベントクリア (${totalListeners}件削除)`);
    }
    
    /**
     * 一度だけ実行されるリスナー登録
     * @param {string} eventType - イベントタイプ
     * @param {Function} callback - コールバック関数
     * @returns {Function} リスナー削除用関数
     */
    static once(eventType, callback) {
        const onceWrapper = (data) => {
            callback(data);
            this.off(eventType, onceWrapper);
        };
        
        return this.on(eventType, onceWrapper);
    }
    
    /**
     * 安全なイベント発行（エラー時フォールバック付き）
     * @param {string} eventType - イベントタイプ
     * @param {any} data - イベントデータ
     */
    static safeEmit(eventType, data = null) {
        try {
            this.emit(eventType, data);
        } catch (error) {
            console.error('📡 EventBus: safeEmit エラー:', error);
            // フォールバック：最低限のログのみ
            console.warn(`📡 EventBus: ${eventType} 発行失敗 - フォールバックモード`);
        }
    }
    
    /**
     * イベント統計取得（修正版）
     * @returns {Object} 統計情報
     */
    static getStats() {
        return {
            totalEmitted: this.stats.emitted,
            totalListeners: this.stats.listeners,
            totalErrors: this.stats.errors,
            eventTypes: Array.from(this.stats.types),
            activeEventTypes: Array.from(this.events.keys()),
            averageListenersPerType: this.events.size > 0 ? 
                Math.round(this.stats.listeners / this.events.size * 100) / 100 : 0,
            errorHandlingState: this._errorHandling
        };
    }
    
    /**
     * イベントリスナー一覧取得
     * @param {string} eventType - イベントタイプ（省略時は全て）
     * @returns {Object} リスナー情報
     */
    static getListeners(eventType = null) {
        if (eventType) {
            return {
                eventType,
                listeners: this.events.get(eventType) || [],
                count: (this.events.get(eventType) || []).length
            };
        }
        
        const result = {};
        this.events.forEach((listeners, type) => {
            result[type] = {
                count: listeners.length,
                listeners: listeners
            };
        });
        
        return result;
    }
    
    /**
     * システム健全性チェック
     * @returns {Object} ヘルスチェック結果
     */
    static healthCheck() {
        const stats = this.getStats();
        
        return {
            healthy: stats.totalErrors < 10 && !this._errorHandling,
            stats,
            warnings: [
                stats.totalErrors > 5 ? `エラー多発: ${stats.totalErrors}件` : null,
                this._errorHandling ? 'エラーハンドリング中' : null,
                stats.totalListeners > 100 ? `リスナー数大: ${stats.totalListeners}件` : null
            ].filter(Boolean),
            recommendations: stats.totalErrors > 5 ? 
                ['getErrorLog()でエラー詳細確認', 'clearErrorLog()でログリセット'] : []
        };
    }
    
    /**
     * デバッグ情報表示（修正版）
     */
    static debug() {
        console.log('📡 EventBus デバッグ情報:');
        console.log('- 統計:', this.getStats());
        console.log('- アクティブイベント:', this.getListeners());
        console.log('- ヘルスチェック:', this.healthCheck());
        
        // メモリ使用量推定
        const memoryEstimate = this.stats.listeners * 100; // 1リスナー約100バイトと仮定
        console.log(`- 推定メモリ使用量: ${memoryEstimate}バイト`);
        
        return this.getStats();
    }
    
    /**
     * エラーログリセット
     */
    static resetErrorState() {
        this._errorHandling = false;
        this.stats.errors = 0;
        console.log('✅ EventBus: エラー状態リセット完了');
    }
}

// 標準イベントタイプ定義（統一化のため）
EventBus.Events = {
    // 描画関連
    BRUSH_SIZE_CHANGED: 'brushSizeChanged',
    BRUSH_COLOR_CHANGED: 'brushColorChanged',
    OPACITY_CHANGED: 'opacityChanged',
    PRESSURE_CHANGED: 'pressureChanged',
    SMOOTHING_CHANGED: 'smoothingChanged',
    TOOL_CHANGED: 'toolChanged',
    
    // 描画動作
    DRAWING_STARTED: 'drawingStarted',
    DRAWING_CONTINUED: 'drawingContinued',
    DRAWING_ENDED: 'drawingEnded',
    PATH_CREATED: 'pathCreated',
    
    // UI関連
    POPUP_OPENED: 'popupOpened',
    POPUP_CLOSED: 'popupClosed',
    SLIDER_CHANGED: 'sliderChanged',
    PRESET_SELECTED: 'presetSelected',
    
    // キャンバス関連
    CANVAS_RESIZED: 'canvasResized',
    CANVAS_CLEARED: 'canvasCleared',
    
    // システム関連
    INITIALIZATION_COMPLETED: 'initializationCompleted',
    ERROR_OCCURRED: 'errorOccurred',
    PERFORMANCE_WARNING: 'performanceWarning'
};

// グローバル公開
window.EventBus = EventBus;

// デバッグ用グローバル関数（修正版）
window.emitEvent = (type, data) => EventBus.emit(type, data);
window.safeEmitEvent = (type, data) => EventBus.safeEmit(type, data);
window.getEventStats = () => EventBus.getStats();
window.debugEventBus = () => EventBus.debug();
window.resetEventBusErrors = () => EventBus.resetErrorState();
window.eventBusHealthCheck = () => EventBus.healthCheck();

console.log('✅ EventBus 初期化完了（修正版）');
console.log(`📡 標準イベント数: ${Object.keys(EventBus.Events).length}個`);
console.log('💡 使用例: EventBus.on(EventBus.Events.BRUSH_SIZE_CHANGED, callback)');
console.log('🛡️ 循環参照防止・エラー連鎖防止機能追加済み');