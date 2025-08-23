/**
 * 📊 StateManager - アプリケーション状態管理システム
 * ✅ UNIFIED_SYSTEM: 統一状態管理・変更追跡システム
 * 📋 RESPONSIBILITY: 「現在状態・一時状態の統一管理」専門
 * 
 * 📏 DESIGN_PRINCIPLE: EventBus疎結合・ErrorManager安全処理
 * 🎯 TEGAKI_NAMESPACE: Tegaki名前空間統一対応済み
 * 🔧 REGISTRY_READY: 初期化レジストリ対応済み
 * 
 * 依存: EventBus, ErrorManager
 * 公開: Tegaki.StateManager, Tegaki.StateManagerInstance
 */

// Tegaki名前空間初期化
window.Tegaki = window.Tegaki || {};

class StateManager {
    constructor() {
        this.state = this._getInitialState();
        this.history = [];
        this.maxHistorySize = 50;
        this.subscribers = new Map();
    }

    /**
     * 状態値を取得（改修手順書対応）
     * @param {string} key - 状態キー（ドット記法対応）
     * @param {*} defaultValue - デフォルト値
     * @returns {*} 状態値
     */
    getState(key, defaultValue = null) {
        try {
            const value = this._getNestedValue(this.state, key);
            return value !== undefined ? value : defaultValue;
        } catch (error) {
            if (Tegaki.ErrorManagerInstance) {
                Tegaki.ErrorManagerInstance.handle(error, 'StateManager.getState');
            } else {
                console.error('[StateManager.getState]', error);
            }
            return defaultValue;
        }
    }

    /**
     * 状態値を設定（改修手順書対応）
     * @param {string} key - 状態キー
     * @param {*} value - 状態値
     * @param {boolean} notify - 変更通知を送るか
     * @returns {boolean} 成功/失敗
     */
    setState(key, value, notify = true) {
        try {
            const oldValue = this.getState(key);
            const oldState = { ...this.state };
            
            this._setNestedValue(this.state, key, value);
            
            // 履歴に追加
            this._addToHistory(oldState, { ...this.state });
            
            if (notify && oldValue !== value) {
                this._notifyChange(key, value, oldValue);
            }
            
            return true;
        } catch (error) {
            if (Tegaki.ErrorManagerInstance) {
                Tegaki.ErrorManagerInstance.handle(error, 'StateManager.setState');
            } else {
                console.error('[StateManager.setState]', error);
            }
            return false;
        }
    }

    /**
     * 旧get互換メソッド（下位互換）
     */
    get(key, defaultValue = null) {
        return this.getState(key, defaultValue);
    }

    /**
     * 旧set互換メソッド（下位互換）
     */
    set(key, value = undefined, notify = true) {
        if (typeof key === 'object' && key !== null) {
            // オブジェクト一括設定
            return this._setMultiple(key, notify);
        } else {
            // 単一設定
            return this.setState(key, value, notify);
        }
    }

    /**
     * コンポーネント状態を更新（拡張API）
     * @param {string} component - コンポーネント名
     * @param {string} state - 状態名  
     * @param {*} data - 状態データ
     * @returns {boolean} 成功/失敗
     */
    updateComponentState(component, state, data) {
        const key = `components.${component}.${state}`;
        return this.setState(key, data);
    }

    /**
     * システム状態を更新（拡張API）
     * @param {string} system - システム名
     * @param {string} state - 状態名
     * @param {*} data - 状態データ  
     * @returns {boolean} 成功/失敗
     */
    updateSystemState(system, state, data) {
        const key = `systems.${system}.${state}`;
        return this.setState(key, data);
    }

    /**
     * コンポーネント状態を取得（拡張API）
     * @param {string} component - コンポーネント名
     * @returns {object} コンポーネント状態
     */
    getComponentState(component) {
        return this.getState(`components.${component}`, {});
    }

    /**
     * システム状態を取得（拡張API）
     * @param {string} system - システム名
     * @returns {object} システム状態
     */
    getSystemState(system) {
        return this.getState(`systems.${system}`, {});
    }

    /**
     * 全コンポーネント状態を取得（拡張API）
     * @returns {object} 全コンポーネント状態
     */
    getAllComponentStates() {
        return this.getState('components', {});
    }

    /**
     * 全システム状態を取得（拡張API）
     * @returns {object} 全システム状態
     */
    getAllSystemStates() {
        return this.getState('systems', {});
    }

    /**
     * 状態の存在確認
     * @param {string} key - 状態キー
     * @returns {boolean} 存在するか
     */
    has(key) {
        try {
            return this._getNestedValue(this.state, key) !== undefined;
        } catch (error) {
            if (Tegaki.ErrorManagerInstance) {
                Tegaki.ErrorManagerInstance.handle(error, 'StateManager.has');
            } else {
                console.error('[StateManager.has]', error);
            }
            return false;
        }
    }

    /**
     * 状態変更を監視
     * @param {string} key - 監視する状態キー
     * @param {function} callback - コールバック関数
     * @param {object} options - オプション
     * @returns {function} 監視解除関数
     */
    watch(key, callback, options = {}) {
        try {
            const {
                immediate = false,
                deep = false
            } = options;
            
            if (!this.subscribers.has(key)) {
                this.subscribers.set(key, []);
            }
            
            const subscriber = {
                callback,
                deep,
                id: this._generateSubscriberId()
            };
            
            this.subscribers.get(key).push(subscriber);
            
            // immediate オプションで即座に実行
            if (immediate) {
                const currentValue = this.getState(key);
                callback(currentValue, undefined, key);
            }
            
            // 監視解除関数を返す
            return () => this.unwatch(key, subscriber.id);
        } catch (error) {
            if (Tegaki.ErrorManagerInstance) {
                Tegaki.ErrorManagerInstance.handle(error, 'StateManager.watch');
            } else {
                console.error('[StateManager.watch]', error);
            }
            return () => {};
        }
    }

    /**
     * 状態監視を解除
     * @param {string} key - 状態キー
     * @param {string} subscriberId - 購読者ID
     * @returns {boolean} 成功/失敗
     */
    unwatch(key, subscriberId) {
        try {
            if (this.subscribers.has(key)) {
                const subscribers = this.subscribers.get(key);
                const index = subscribers.findIndex(sub => sub.id === subscriberId);
                
                if (index !== -1) {
                    subscribers.splice(index, 1);
                    
                    // 購読者がいなくなったら削除
                    if (subscribers.length === 0) {
                        this.subscribers.delete(key);
                    }
                    
                    return true;
                }
            }
            return false;
        } catch (error) {
            if (Tegaki.ErrorManagerInstance) {
                Tegaki.ErrorManagerInstance.handle(error, 'StateManager.unwatch');
            } else {
                console.error('[StateManager.unwatch]', error);
            }
            return false;
        }
    }

    /**
     * 現在の状態を全て取得
     * @returns {object} 状態オブジェクト
     */
    getAll() {
        return { ...this.state };
    }

    /**
     * 状態をリセット
     * @param {boolean} notify - 変更通知を送るか
     */
    reset(notify = true) {
        try {
            const oldState = { ...this.state };
            this.state = this._getInitialState();
            
            if (notify) {
                this._notifyChange('*', this.state, oldState);
                // EventBus は初期化後に利用
                if (Tegaki.EventBusInstance) {
                    Tegaki.EventBusInstance.emit('state:reset', this.state);
                }
            }
            
            console.log('[StateManager] State reset to initial values');
        } catch (error) {
            if (Tegaki.ErrorManagerInstance) {
                Tegaki.ErrorManagerInstance.handle(error, 'StateManager.reset');
            } else {
                console.error('[StateManager.reset]', error);
            }
        }
    }

    /**
     * 健全性チェック（拡張API）
     * @returns {object} チェック結果
     */
    healthCheck() {
        try {
            const issues = [];
            
            // 基本状態チェック
            if (!this.state.app) issues.push('Missing app state');
            if (!this.state.tool) issues.push('Missing tool state');
            if (!this.state.canvas) issues.push('Missing canvas state');
            
            // サブスクライバー整合性チェック
            let orphanedSubscribers = 0;
            this.subscribers.forEach((subs, key) => {
                if (subs.length === 0) orphanedSubscribers++;
            });
            
            return {
                healthy: issues.length === 0,
                issues,
                stats: this.getStats(),
                orphanedSubscribers
            };
        } catch (error) {
            if (Tegaki.ErrorManagerInstance) {
                Tegaki.ErrorManagerInstance.handle(error, 'StateManager.healthCheck');
            }
            return { healthy: false, issues: ['Health check failed'] };
        }
    }

    /**
     * 状態履歴を取得
     * @param {number} limit - 取得件数制限
     * @returns {Array} 状態履歴
     */
    getHistory(limit = 10) {
        return this.history.slice(-limit);
    }

    /**
     * 現在の状態統計を取得
     * @returns {object} 統計情報
     */
    getStats() {
        return {
            stateKeys: Object.keys(this.state).length,
            subscribers: this.subscribers.size,
            historySize: this.history.length,
            subscriberDetails: Array.from(this.subscribers.entries()).map(([key, subs]) => ({
                key,
                subscriberCount: subs.length
            }))
        };
    }

    // ========================================
    // 内部メソッド
    // ========================================

    /**
     * 初期状態を定義
     * @private
     */
    _getInitialState() {
        return {
            // アプリケーション状態
            app: {
                initialized: false,
                loading: false,
                error: null
            },
            
            // ツール状態
            tool: {
                active: 'pen',
                previous: null,
                isDrawing: false,
                currentStroke: null
            },
            
            // キャンバス状態（UI画像対応400x400）
            canvas: {
                isDirty: false,
                hasContent: false,
                zoom: 1.0,
                panX: 0,
                panY: 0,
                width: 400,    // UI画像に合わせて
                height: 400,   // UI画像に合わせて
                isTransforming: false
            },
            
            // UI状態
            ui: {
                activePanel: null,
                toolbarVisible: true,
                statusBarVisible: true,
                popupVisible: false,
                currentPopup: null,
                isDragging: false
            },
            
            // インタラクション状態
            interaction: {
                pointerDown: false,
                pointerType: 'mouse',
                pressure: 0,
                tiltX: 0,
                tiltY: 0,
                isTouch: false,
                multitouch: false,
                touchCount: 0
            },
            
            // 操作状態
            operation: {
                canUndo: false,
                canRedo: false,
                isUndoing: false,
                isRedoing: false,
                isSaving: false
            },
            
            // パフォーマンス状態（UI画像対応）
            performance: {
                fps: 60,           // UI画像対応
                renderTime: 0,
                drawCalls: 0,
                isThrottling: false,
                gpuUsage: 45,      // UI画像対応
                memoryUsage: 1.2   // UI画像対応（GB）
            },
            
            // 将来拡張用
            layers: {
                active: 0,
                count: 1,
                visible: [true]
            },
            
            shortcuts: {
                enabled: true,
                activeModifiers: []
            },
            
            // コンポーネント状態（拡張API用）
            components: {},
            
            // システム状態（拡張API用）
            systems: {}
        };
    }

    /**
     * 複数状態の一括設定
     * @private
     */
    _setMultiple(stateObject, notify) {
        const changes = {};
        
        for (const [key, value] of Object.entries(stateObject)) {
            const oldValue = this.getState(key);
            this._setNestedValue(this.state, key, value);
            
            if (oldValue !== value) {
                changes[key] = { oldValue, newValue: value };
            }
        }
        
        if (notify && Object.keys(changes).length > 0) {
            for (const [key, change] of Object.entries(changes)) {
                this._notifyChange(key, change.newValue, change.oldValue);
            }
        }
    }

    /**
     * 変更を通知
     * @private
     */
    _notifyChange(key, newValue, oldValue) {
        // 購読者に通知
        if (this.subscribers.has(key)) {
            const subscribers = this.subscribers.get(key);
            subscribers.forEach(subscriber => {
                try {
                    subscriber.callback(newValue, oldValue, key);
                } catch (error) {
                    if (Tegaki.ErrorManagerInstance) {
                        Tegaki.ErrorManagerInstance.handle(error, 'StateManager.notifyChange');
                    } else {
                        console.error('[StateManager.notifyChange]', error);
                    }
                }
            });
        }
        
        // EventBusに通知（初期化後）
        if (Tegaki.EventBusInstance) {
            Tegaki.EventBusInstance.emit('state:change', {
                key,
                newValue,
                oldValue,
                timestamp: Date.now()
            });
            
            // 特定のイベントも発火
            Tegaki.EventBusInstance.emit(`state:change:${key}`, {
                newValue,
                oldValue,
                timestamp: Date.now()
            });
        }
    }

    /**
     * ネストした値を取得（ドット記法対応）
     * @private
     */
    _getNestedValue(obj, key) {
        return key.split('.').reduce((current, prop) => 
            current && current[prop] !== undefined ? current[prop] : undefined, obj
        );
    }

    /**
     * ネストした値を設定（ドット記法対応）
     * @private
     */
    _setNestedValue(obj, key, value) {
        const keys = key.split('.');
        const lastKey = keys.pop();
        const target = keys.reduce((current, prop) => {
            if (current[prop] === undefined || typeof current[prop] !== 'object') {
                current[prop] = {};
            }
            return current[prop];
        }, obj);
        
        target[lastKey] = value;
    }

    /**
     * 履歴に追加
     * @private
     */
    _addToHistory(oldState, newState) {
        this.history.push({
            timestamp: Date.now(),
            oldState,
            newState
        });
        
        // 履歴サイズ制限
        if (this.history.length > this.maxHistorySize) {
            this.history.shift();
        }
    }

    /**
     * 購読者ID生成
     * @private
     */
    _generateSubscriberId() {
        return `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}

// Tegaki名前空間にクラスを登録
Tegaki.StateManager = StateManager;

// 初期化レジストリに追加（根幹Manager）
Tegaki._registry = Tegaki._registry || [];
Tegaki._registry.push(() => {
    Tegaki.StateManagerInstance = new Tegaki.StateManager();
    console.log('[StateManager] ✅ Tegaki.StateManagerInstance 初期化完了');
});

console.log('[StateManager] ✅ Tegaki名前空間統一・レジストリ登録完了');