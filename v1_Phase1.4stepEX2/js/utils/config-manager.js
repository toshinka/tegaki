/**
 * 🔧 ConfigManager - アプリケーション設定の保存・読み込み管理
 * ✅ UNIFIED_SYSTEM: 統一設定管理・保存システム
 * 📋 RESPONSIBILITY: 「設定値・デフォルト値の統一管理」専門
 * 
 * 📏 DESIGN_PRINCIPLE: 基盤システム・ErrorManager依存
 * 🎯 TEGAKI_NAMESPACE: Tegaki名前空間統一対応済み
 * 🔧 REGISTRY_READY: 初期化レジストリ対応済み
 * 🌈 FUTABA_COLORS: ふたば☆ちゃんねるカラー保持対応
 * 
 * 依存: ErrorManager
 * 公開: Tegaki.ConfigManager, Tegaki.ConfigManagerInstance
 */

// Tegaki名前空間初期化
window.Tegaki = window.Tegaki || {};

class ConfigManager {
    constructor() {
        this.storageKey = 'tegaki_config';
        this.config = {};
        this.defaultConfig = this._getDefaultConfig();
        this.autoSave = true;
        this.storage = localStorage; // localStorage または sessionStorage
        
        // 初期化
        this.load();
    }

    /**
     * 設定値を取得
     * @param {string} key - 設定キー（ドット記法対応: 'pen.size'）
     * @param {*} defaultValue - デフォルト値
     * @returns {*} 設定値
     */
    get(key, defaultValue = null) {
        try {
            const value = this._getNestedValue(this.config, key);
            return value !== undefined ? value : 
                   (this._getNestedValue(this.defaultConfig, key) ?? defaultValue);
        } catch (error) {
            // Tegaki.ErrorManagerInstance 活用（初期化後）
            if (Tegaki.ErrorManagerInstance) {
                Tegaki.ErrorManagerInstance.handle(error, 'ConfigManager.get');
            } else {
                console.error('[ConfigManager.get]', error);
            }
            return defaultValue;
        }
    }

    /**
     * 設定値を設定
     * @param {string|object} key - 設定キーまたは設定オブジェクト
     * @param {*} value - 設定値（keyがオブジェクトの場合は無視）
     * @returns {boolean} 成功/失敗
     */
    set(key, value = undefined) {
        try {
            if (typeof key === 'object' && key !== null) {
                // オブジェクト一括設定
                return this._setMultiple(key);
            } else {
                // 単一設定
                return this._setSingle(key, value);
            }
        } catch (error) {
            if (Tegaki.ErrorManagerInstance) {
                Tegaki.ErrorManagerInstance.handle(error, 'ConfigManager.set');
            } else {
                console.error('[ConfigManager.set]', error);
            }
            return false;
        }
    }

    /**
     * 設定の保存
     * @returns {boolean} 成功/失敗
     */
    save() {
        try {
            const configString = JSON.stringify(this.config);
            this.storage.setItem(this.storageKey, configString);
            console.log('[ConfigManager] 設定を保存しました');
            return true;
        } catch (error) {
            if (Tegaki.ErrorManagerInstance) {
                Tegaki.ErrorManagerInstance.handle(error, 'ConfigManager.save');
            } else {
                console.error('[ConfigManager.save]', error);
            }
            return false;
        }
    }

    /**
     * 設定の読み込み
     * @returns {boolean} 成功/失敗
     */
    load() {
        try {
            const configString = this.storage.getItem(this.storageKey);
            if (configString) {
                this.config = JSON.parse(configString);
                console.log('[ConfigManager] 設定を読み込みました');
            } else {
                this.config = {};
                console.log('[ConfigManager] デフォルト設定を適用しました');
            }
            return true;
        } catch (error) {
            if (Tegaki.ErrorManagerInstance) {
                Tegaki.ErrorManagerInstance.handle(error, 'ConfigManager.load');
            } else {
                console.error('[ConfigManager.load]', error);
            }
            this.config = {};
            return false;
        }
    }

    /**
     * 設定のリセット
     * @returns {boolean} 成功/失敗
     */
    reset() {
        try {
            this.config = {};
            this.storage.removeItem(this.storageKey);
            console.log('[ConfigManager] 設定をリセットしました');
            return true;
        } catch (error) {
            if (Tegaki.ErrorManagerInstance) {
                Tegaki.ErrorManagerInstance.handle(error, 'ConfigManager.reset');
            } else {
                console.error('[ConfigManager.reset]', error);
            }
            return false;
        }
    }

    /**
     * デバッグ情報を取得
     * @returns {object} デバッグ情報
     */
    getDebugInfo() {
        return {
            storageKey: this.storageKey,
            configSize: Object.keys(this.config).length,
            defaultConfigSize: Object.keys(this.defaultConfig).length,
            autoSave: this.autoSave,
            storageType: this.storage === localStorage ? 'localStorage' : 'sessionStorage',
            config: JSON.parse(JSON.stringify(this.config)),
            defaultConfig: JSON.parse(JSON.stringify(this.defaultConfig))
        };
    }

    // ========================================
    // 内部メソッド
    // ========================================

    /**
     * デフォルト設定を取得
     * @private
     */
    _getDefaultConfig() {
        return {
            // ふたば☆ちゃんねるカラー（保持対象）
            theme: {
                colors: {
                    primary: '#800000',           // --futaba-maroon
                    primaryLight: '#aa5a56',      // --futaba-light-maroon  
                    secondary: '#cf9c97',         // --futaba-medium
                    secondaryLight: '#e9c2ba',    // --futaba-light-medium
                    background: '#ffffee',        // --futaba-background
                    surface: '#f0e0d6',          // --futaba-cream
                    text: '#333333',
                    accent: '#800000'
                },
                layout: {
                    sidebarWidth: '60px',
                    toolbarHeight: '50px',
                    statusPanelHeight: '30px'
                }
            },

            // キャンバス設定
            canvas: {
                width: 400,
                height: 400,
                backgroundColor: '#ffffee',  // ふたば背景色
                antialias: true,
                preserveDrawingBuffer: true,
                powerPreference: 'high-performance'
            },

            // ペンツール設定
            pen: {
                size: 3,
                opacity: 1.0,
                pressure: 0.8,
                smoothing: 0.3,
                color: '#800000',  // ふたばマルーン
                presets: [1, 2, 3, 5, 8, 12, 16, 24, 32]
            },

            // 座標系設定（バグ修正対応）
            coordinates: {
                smoothingEnabled: true,
                smoothingFactor: 0.3,
                precision: 2,
                validation: true
            },

            // パフォーマンス設定
            performance: {
                targetFPS: 60,
                enableGPUAcceleration: true,
                memoryLimit: 1024, // MB
                autoCleanup: true
            },

            // UI設定（保持対象）
            ui: {
                popupDraggable: true,
                showCoordinates: true,
                showPressure: true,
                showPerformance: true,
                animationsEnabled: true
            }
        };
    }

    /**
     * ネストされた値を取得
     * @private
     */
    _getNestedValue(obj, path) {
        return path.split('.').reduce((current, key) => current?.[key], obj);
    }

    /**
     * ネストされた値を設定
     * @private
     */
    _setNestedValue(obj, path, value) {
        const keys = path.split('.');
        const lastKey = keys.pop();
        const target = keys.reduce((current, key) => {
            if (!(key in current)) current[key] = {};
            return current[key];
        }, obj);
        target[lastKey] = value;
    }

    /**
     * 単一設定
     * @private
     */
    _setSingle(key, value) {
        this._setNestedValue(this.config, key, value);
        
        if (this.autoSave) {
            this.save();
        }
        
        return true;
    }

    /**
     * 複数設定
     * @private
     */
    _setMultiple(settings) {
        Object.keys(settings).forEach(key => {
            this._setNestedValue(this.config, key, settings[key]);
        });
        
        if (this.autoSave) {
            this.save();
        }
        
        return true;
    }
}

// Tegaki名前空間にクラスを登録
Tegaki.ConfigManager = ConfigManager;

// 初期化レジストリに追加（根幹Manager）
Tegaki._registry = Tegaki._registry || [];
Tegaki._registry.push(() => {
    Tegaki.ConfigManagerInstance = new Tegaki.ConfigManager();
    console.log('[ConfigManager] ✅ Tegaki.ConfigManagerInstance 初期化完了');
});

console.log('[ConfigManager] ✅ Tegaki名前空間統一・レジストリ登録完了');