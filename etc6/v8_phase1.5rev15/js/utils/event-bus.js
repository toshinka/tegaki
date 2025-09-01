// ChangeLog: 2025-09-01 Manager統一ライフサイクル実装・架空メソッド撲滅
/**
 * @provides
 *   ・EventBus - アプリケーション内イベント管理（Manager統一ライフサイクル準拠）
 *   ・configure(config) - 同期：設定注入
 *   ・attach(context) - 同期：Pixi Application / app.view / stage 等の参照注入
 *   ・init() -> Promise - 非同期可能：内部初期化（完了後に isReady=true へ）
 *   ・isReady() -> boolean - 同期：準備完了判定（AppCore が依存）
 *   ・dispose() - 同期/非同期：解放
 *   ・on(event, callback) - イベントリスナー登録
 *   ・off(event, callback) - イベントリスナー削除
 *   ・emit(event, data) - イベント発火
 *   ・once(event, callback) - 一回限りのイベントリスナー
 *
 * @uses
 *   ・なし（他ファイル依存なし）
 *
 * @initflow
 *   ・1. EventBus.configure() - 設定注入
 *   ・2. EventBus.attach() - コンテキスト注入（オプション）
 *   ・3. EventBus.init() - 内部初期化完了
 *
 * @forbids
 *   ・💀 双方向依存禁止
 *   ・🚫 フォールバック（無条件な振る舞いの切替）原則禁止
 *   ・🚫 フェイルセーフ（無条件の例外無視／silent swallow）原則禁止
 *   ・🚫 v7/v8 両対応による二重管理禁止
 *   ・🚫 外部ビルドツール - Vite/TypeScript/ESM/Webpack禁止
 *   ・🚫 未実装メソッド呼び出し禁止
 *   ・🚫 目先のエラー修正のための DRY／SOLID 原則違反
 *
 * @manager-key
 *   ・window.Tegaki.EventBusInstance
 *
 * @dependencies-strict
 *   ・必須依存: なし
 *   ・オプション依存: なし
 *   ・禁止依存: なし（純粋なイベント管理）
 *
 * @integration-flow
 *   ・AppCore により Phase1 で初期化される
 *   ・他の Manager や Tool からイベント送受信に使用される
 *
 * @event-contract
 *   ・すべてのアプリ内イベントはこのEventBus経由で処理
 *   ・DOM イベントバインドは bootstrap 層のみに限定
 *   ・イベント名は 'namespace:action' 形式を推奨（例: 'app:ready', 'tool:changed'）
 *
 * @error-handling
 *   ・init() は Promise を返し、エラーは reject
 *   ・内部エラーは this._status で保持
 *   ・個別リスナーのエラーはログ出力するが全体を停止しない
 *
 * @testing-hooks
 *   ・clearAllListeners() - テスト用全リスナー削除
 *   ・getListenerCount() - デバッグ用リスナー数取得
 */

class EventBus {
    constructor() {
        console.log('🔄 EventBus Manager統一ライフサイクル版 作成');
        
        // Manager統一ライフサイクル状態管理
        this._ready = false;
        this._status = {
            ready: false,
            error: null,
            initialized: false
        };
        
        // イベント管理
        this._listeners = new Map();
        this._onceListeners = new Map();
        
        // 設定・コンテキスト
        this._config = null;
        this._context = null;
        
        console.log('✅ EventBus 構築完了');
    }
    
    // ============ Manager統一ライフサイクルAPI ============
    
    /**
     * 設定注入（同期）
     * @param {Object} config - 設定オブジェクト
     */
    configure(config) {
        try {
            this._config = config || {};
            console.log('🔄 EventBus: configure() 完了');
            return true;
        } catch (error) {
            console.error('🔄 EventBus: configure() 失敗:', error);
            this._status.error = error.message;
            return false;
        }
    }
    
    /**
     * コンテキスト注入（同期）
     * @param {Object} context - Pixi Application等のコンテキスト
     */
    attach(context) {
        try {
            this._context = context || {};
            console.log('🔄 EventBus: attach() 完了');
            return true;
        } catch (error) {
            console.error('🔄 EventBus: attach() 失敗:', error);
            this._status.error = error.message;
            return false;
        }
    }
    
    /**
     * 内部初期化（非同期可能）
     * @returns {Promise<boolean>}
     */
    async init() {
        try {
            console.log('🔄 EventBus: init() 開始');
            
            // 基本的な初期化（EventBusは特に重い処理なし）
            this._status.initialized = true;
            this._status.ready = true;
            this._ready = true;
            
            console.log('✅ EventBus: init() 完了');
            return true;
            
        } catch (error) {
            console.error('🔄 EventBus: init() 失敗:', error);
            this._status.error = error.message;
            this._status.ready = false;
            this._ready = false;
            throw error;
        }
    }
    
    /**
     * 準備完了判定（同期）
     * @returns {boolean}
     */
    isReady() {
        return this._ready && this._status.ready;
    }
    
    /**
     * 解放処理（同期）
     */
    dispose() {
        try {
            console.log('🔄 EventBus: dispose() 開始');
            
            // 全リスナー削除
            this._listeners.clear();
            this._onceListeners.clear();
            
            // 状態リセット
            this._ready = false;
            this._status = {
                ready: false,
                error: null,
                initialized: false
            };
            this._config = null;
            this._context = null;
            
            console.log('✅ EventBus: dispose() 完了');
            
        } catch (error) {
            console.error('🔄 EventBus: dispose() 失敗:', error);
        }
    }
    
    // ============ イベント管理API ============
    
    /**
     * イベントリスナー登録
     * @param {string} event - イベント名
     * @param {Function} callback - コールバック関数
     */
    on(event, callback) {
        if (typeof event !== 'string' || typeof callback !== 'function') {
            console.warn('🔄 EventBus: on() - 無効な引数をスキップ');
            return;
        }
        
        if (!this._listeners.has(event)) {
            this._listeners.set(event, []);
        }
        this._listeners.get(event).push(callback);
        
        // デバッグ用（詳細ログは開発時のみ）
        if (this._config && this._config.debug) {
            console.log(`🔄 EventBus: リスナー登録 '${event}' (計${this._listeners.get(event).length}個)`);
        }
    }
    
    /**
     * イベントリスナー削除
     * @param {string} event - イベント名
     * @param {Function} callback - コールバック関数
     */
    off(event, callback) {
        if (!this._listeners.has(event)) {
            return;
        }
        
        const listeners = this._listeners.get(event);
        const index = listeners.indexOf(callback);
        if (index > -1) {
            listeners.splice(index, 1);
            
            // 空になったら削除
            if (listeners.length === 0) {
                this._listeners.delete(event);
            }
        }
    }
    
    /**
     * イベント発火
     * @param {string} event - イベント名
     * @param {*} data - イベントデータ
     */
    emit(event, data) {
        if (typeof event !== 'string') {
            console.warn('🔄 EventBus: emit() - 無効なイベント名をスキップ');
            return;
        }
        
        try {
            // 通常のリスナー
            if (this._listeners.has(event)) {
                const listeners = this._listeners.get(event);
                for (const callback of listeners) {
                    try {
                        callback(data);
                    } catch (error) {
                        console.error(`🔄 EventBus: リスナーエラー '${event}':`, error);
                        // 個別リスナーのエラーは全体を停止しない
                    }
                }
            }
            
            // 一回限りリスナー
            if (this._onceListeners.has(event)) {
                const listeners = this._onceListeners.get(event);
                // コピーを作って削除してから実行（再帰呼び出し対策）
                const listenersToCall = [...listeners];
                this._onceListeners.delete(event);
                
                for (const callback of listenersToCall) {
                    try {
                        callback(data);
                    } catch (error) {
                        console.error(`🔄 EventBus: onceリスナーエラー '${event}':`, error);
                    }
                }
            }
            
        } catch (error) {
            console.error('🔄 EventBus: emit() エラー:', error);
        }
    }
    
    /**
     * 一回限りのイベントリスナー
     * @param {string} event - イベント名
     * @param {Function} callback - コールバック関数
     */
    once(event, callback) {
        if (typeof event !== 'string' || typeof callback !== 'function') {
            console.warn('🔄 EventBus: once() - 無効な引数をスキップ');
            return;
        }
        
        if (!this._onceListeners.has(event)) {
            this._onceListeners.set(event, []);
        }
        this._onceListeners.get(event).push(callback);
    }
    
    // ============ デバッグ・テスト用API ============
    
    /**
     * 全リスナー削除（テスト用）
     */
    clearAllListeners() {
        this._listeners.clear();
        this._onceListeners.clear();
        console.log('🔄 EventBus: 全リスナー削除完了');
    }
    
    /**
     * リスナー数取得（デバッグ用）
     * @param {string} event - イベント名（省略時は全体）
     * @returns {number|Object}
     */
    getListenerCount(event) {
        if (event) {
            const normalCount = this._listeners.has(event) ? this._listeners.get(event).length : 0;
            const onceCount = this._onceListeners.has(event) ? this._onceListeners.get(event).length : 0;
            return normalCount + onceCount;
        }
        
        // 全体の統計
        const stats = {
            totalEvents: this._listeners.size + this._onceListeners.size,
            totalListeners: 0,
            normalListeners: 0,
            onceListeners: 0
        };
        
        for (const listeners of this._listeners.values()) {
            stats.normalListeners += listeners.length;
        }
        for (const listeners of this._onceListeners.values()) {
            stats.onceListeners += listeners.length;
        }
        
        stats.totalListeners = stats.normalListeners + stats.onceListeners;
        return stats;
    }
    
    /**
     * ステータス取得
     * @returns {Object}
     */
    getStatus() {
        return {
            ...this._status,
            listenerStats: this.getListenerCount()
        };
    }
}

// グローバル名前空間に登録
if (typeof window !== 'undefined') {
    if (!window.Tegaki) {
        window.Tegaki = {};
    }
    window.Tegaki.EventBus = EventBus;
    
    console.log('🔄 EventBus Manager統一ライフサイクル版 Loaded');
    console.log('📏 修正内容: Manager統一ライフサイクル実装・configure/attach/init/isReady/dispose追加・架空メソッド撲滅');
    console.log('🚀 特徴: アプリ内イベント管理・リスナー管理・エラー分離・テスト用API・統合テスト対応');
}