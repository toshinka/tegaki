/**
 * 🔄 EventBus Simple - シンプルイベント通信
 * 📋 RESPONSIBILITY: コンポーネント間のメッセージ伝達のみ
 * 🚫 PROHIBITION: 複雑なフィルタリング・キューイング・エラー処理
 * ✅ PERMISSION: イベント送信・受信・登録解除
 * 
 * 📏 DESIGN_PRINCIPLE: 単純・直線的・通信専門
 * 🔄 INTEGRATION: Manager・Tool間の疎結合通信
 */

// Tegaki名前空間初期化
window.Tegaki = window.Tegaki || {};

/**
 * EventBus - シンプル版（25行以内）
 * コンポーネント間通信の専任
 */
class EventBus {
    constructor() {
        console.log('🔄 EventBus Simple 作成');
        this.listeners = new Map(); // イベント名 -> 関数配列
    }
    
    /**
     * イベントリスナー登録
     */
    on(eventName, callback) {
        if (!this.listeners.has(eventName)) {
            this.listeners.set(eventName, []);
        }
        this.listeners.get(eventName).push(callback);
    }
    
    /**
     * イベント送信
     */
    emit(eventName, ...args) {
        const callbacks = this.listeners.get(eventName);
        if (callbacks) {
            callbacks.forEach(callback => {
                try {
                    callback(...args);
                } catch (error) {
                    console.error(`❌ EventBus error in ${eventName}:`, error);
                }
            });
        }
    }
    
    /**
     * 安全なイベント送信（エラー隠蔽しない）
     */
    safeEmit(eventName, ...args) {
        try {
            this.emit(eventName, ...args);
        } catch (error) {
            console.error(`❌ EventBus safeEmit failed for ${eventName}:`, error);
            throw error; // エラー隠蔽禁止
        }
    }
    
    /**
     * イベントリスナー削除
     */
    off(eventName, callback) {
        const callbacks = this.listeners.get(eventName);
        if (callbacks) {
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }
        }
    }
    
    /**
     * 全リスナー削除
     */
    clear() {
        this.listeners.clear();
        console.log('🗑️ EventBus listeners cleared');
    }
    
    /**
     * リスナー数取得
     */
    getListenerCount(eventName) {
        return this.listeners.get(eventName)?.length || 0;
    }
}

// Tegaki名前空間に登録
window.Tegaki.EventBus = EventBus;

// インスタンス作成・登録
window.Tegaki.EventBusInstance = new EventBus();

console.log('🔄 EventBus Simple Loaded - シンプルイベント通信');