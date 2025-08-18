/**
 * 🎨 ふたば☆お絵描きツール - 統一イベントバスシステム
 * 🎯 AI_WORK_SCOPE: 循環依存排除・イベント駆動アーキテクチャ
 * 🎯 DEPENDENCIES: なし（独立システム）
 * 🎯 PIXI_EXTENSIONS: 使用しない
 * 🎯 ISOLATION_TEST: 可能
 * 🎯 SPLIT_THRESHOLD: 150行以下維持
 * 📋 PHASE_TARGET: Phase1統一化
 * 📋 V8_MIGRATION: v8対応イベント準備済み
 */

/**
 * 統一イベントバスシステム
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
        types: new Set()
    };
    
    /**
     * イベント発行
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
        
        // リスナー実行（エラーハンドリング付き）
        listeners.forEach((listener, index) => {
            try {
                listener(data);
            } catch (error) {
                console.error(`📡 EventBus: リスナーエラー - ${eventType}[${index}]:`, error);
                
                // ErrorManager が利用可能な場合はエラー報告
                if (window.ErrorManager) {
                    window.ErrorManager.showError('warning', 
                        `イベントリスナーエラー: ${eventType} - ${error.message}`);
                }
            }
        });
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
     * イベント統計取得
     * @returns {Object} 統計情報
     */
    static getStats() {
        return {
            totalEmitted: this.stats.emitted,
            totalListeners: this.stats.listeners,
            eventTypes: Array.from(this.stats.types),
            activeEventTypes: Array.from(this.events.keys()),
            averageListenersPerType: this.events.size > 0 ? 
                Math.round(this.stats.listeners / this.events.size * 100) / 100 : 0
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
     * デバッグ情報表示
     */
    static debug() {
        console.log('📡 EventBus デバッグ情報:');
        console.log('- 統計:', this.getStats());
        console.log('- アクティブイベント:', this.getListeners());
        
        // メモリ使用量推定
        const memoryEstimate = this.stats.listeners * 100; // 1リスナー約100バイトと仮定
        console.log(`- 推定メモリ使用量: ${memoryEstimate}バイト`);
        
        return this.getStats();
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

// デバッグ用グローバル関数
window.emitEvent = (type, data) => EventBus.emit(type, data);
window.getEventStats = () => EventBus.getStats();
window.debugEventBus = () => EventBus.debug();

console.log('✅ EventBus 初期化完了');
console.log(`📡 標準イベント数: ${Object.keys(EventBus.Events).length}個`);
console.log('💡 使用例: EventBus.on(EventBus.Events.BRUSH_SIZE_CHANGED, callback)');