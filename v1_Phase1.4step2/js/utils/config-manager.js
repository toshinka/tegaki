/**
 * ConfigManager - アプリケーション設定の保存・読み込み管理
 * 
 * 責務:
 * - 設定値のJSONベース保存・読み込み
 * - localStorage/sessionStorage操作
 * - デフォルト設定の管理
 * 
 * 依存: ErrorManager
 * 公開: window.ConfigManager
 */

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
            window.ErrorManager?.handleError(error, 'ConfigManager.get');
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
            window.ErrorManager?.handleError(error, 'ConfigManager.set');
            return false;
        }
    }

    /**
     * 設定をファイルから読み込み
     * @returns {boolean} 成功/失敗
     */
    load() {
        try {
            const stored = this.storage.getItem(this.storageKey);
            
            if (stored) {
                const parsed = JSON.parse(stored);
                this.config = this._mergeWithDefaults(parsed);
            } else {
                this.config = { ...this.defaultConfig };
            }

            console.log('[ConfigManager] Configuration loaded');
            return true;
        } catch (error) {
            window.ErrorManager?.handleError(error, 'ConfigManager.load', 'error', true);
            this.config = { ...this.defaultConfig };
            return false;
        }
    }

    /**
     * 設定をファイルに保存
     * @returns {boolean} 成功/失敗
     */
    save() {
        try {
            const configJson = JSON.stringify(this.config, null, 2);
            this.storage.setItem(this.storageKey, configJson);
            
            console.log('[ConfigManager] Configuration saved');
            return true;
        } catch (error) {
            window.ErrorManager?.handleError(error, 'ConfigManager.save', 'error', true);
            return false;
        }
    }

    /**
     * 特定の設定をデフォルトに戻す
     * @param {string} key - 設定キー
     * @returns {boolean} 成功/失敗
     */
    reset(key) {
        try {
            const defaultValue = this._getNestedValue(this.defaultConfig, key);
            
            if (defaultValue !== undefined) {
                this._setNestedValue(this.config, key, defaultValue);
                
                if (this.autoSave) {
                    this.save();
                }
                
                console.log(`[ConfigManager] Reset "${key}" to default`);
                return true;
            }
            
            return false;
        } catch (error) {
            window.ErrorManager?.handleError(error, 'ConfigManager.reset');
            return false;
        }
    }

    /**
     * 全設定をデフォルトに戻す
     * @returns {boolean} 成功/失敗
     */
    resetAll() {
        try {
            this.config = { ...this.defaultConfig };
            
            if (this.autoSave) {
                this.save();
            }
            
            console.log('[ConfigManager] All settings reset to default');
            return true;
        } catch (error) {
            window.ErrorManager?.handleError(error, 'ConfigManager.resetAll');
            return false;
        }
    }

    /**
     * 設定の存在確認
     * @param {string} key - 設定キー
     * @returns {boolean} 存在するか
     */
    has(key) {
        try {
            return this._getNestedValue(this.config, key) !== undefined ||
                   this._getNestedValue(this.defaultConfig, key) !== undefined;
        } catch (error) {
            window.ErrorManager?.handleError(error, 'ConfigManager.has');
            return false;
        }
    }

    /**
     * 現在の設定を全て取得
     * @returns {object} 設定オブジェクト
     */
    getAll() {
        return { ...this.config };
    }

    /**
     * デフォルト設定を取得
     * @returns {object} デフォルト設定オブジェクト
     */
    getDefaults() {
        return { ...this.defaultConfig };
    }

    /**
     * 自動保存の有効/無効
     * @param {boolean} enabled - 自動保存有効/無効
     */
    setAutoSave(enabled) {
        this.autoSave = enabled;
        console.log(`[ConfigManager] Auto-save ${enabled ? 'enabled' : 'disabled'}`);
    }

    /**
     * ストレージタイプを変更
     * @param {'localStorage'|'sessionStorage'} storageType - ストレージタイプ
     */
    setStorageType(storageType) {
        try {
            if (storageType === 'localStorage') {
                this.storage = localStorage;
            } else if (storageType === 'sessionStorage') {
                this.storage = sessionStorage;
            } else {
                throw new Error('Invalid storage type. Use "localStorage" or "sessionStorage"');
            }
            
            console.log(`[ConfigManager] Storage type set to ${storageType}`);
        } catch (error) {
            window.ErrorManager?.handleError(error, 'ConfigManager.setStorageType');
        }
    }

    /**
     * 設定をJSONでエクスポート
     * @returns {string} JSON文字列
     */
    exportConfig() {
        try {
            return JSON.stringify(this.config, null, 2);
        } catch (error) {
            window.ErrorManager?.handleError(error, 'ConfigManager.exportConfig');
            return '{}';
        }
    }

    /**
     * JSONから設定をインポート
     * @param {string} jsonString - JSON文字列
     * @returns {boolean} 成功/失敗
     */
    importConfig(jsonString) {
        try {
            const imported = JSON.parse(jsonString);
            this.config = this._mergeWithDefaults(imported);
            
            if (this.autoSave) {
                this.save();
            }
            
            console.log('[ConfigManager] Configuration imported');
            return true;
        } catch (error) {
            window.ErrorManager?.handleError(error, 'ConfigManager.importConfig', 'error', true);
            return false;
        }
    }

    /**
     * デフォルト設定を定義
     * @private
     */
    _getDefaultConfig() {
        return {
            // ペンツール設定
            pen: {
                size: 3,
                color: '#000000',
                opacity: 1.0,
                smoothing: 0.5,
                pressureSensitive: true
            },
            
            // 消しゴムツール設定
            eraser: {
                size: 10,
                opacity: 1.0,
                softness: 0.2
            },
            
            // キャンバス設定
            canvas: {
                backgroundColor: '#ffffff',
                width: 1920,
                height: 1080,
                gridVisible: false,
                gridSize: 20,
                gridColor: '#e0e0e0'
            },
            
            // UI設定
            ui: {
                theme: 'light',
                showToolbar: true,
                toolbarPosition: 'left',
                showStatusBar: true,
                autoHideUI: false
            },
            
            // 操作設定
            interaction: {
                enableTouch: true,
                enableMouse: true,
                enablePen: true,
                invertScrollWheel: false,
                panButton: 2, // 中ボタン
                zoomSpeed: 0.1
            },
            
            // パフォーマンス設定
            performance: {
                maxHistorySize: 50,
                renderQuality: 'high',
                smoothingFrames: 3,
                throttleDrawing: false
            },
            
            // 将来拡張用
            layers: {
                maxLayers: 32,
                defaultBlendMode: 'normal',
                autoCreateLayer: false
            },
            
            shortcuts: {
                enabled: true,
                customMappings: {}
            }
        };
    }

    /**
     * 単一設定の設定
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
     * 複数設定の一括設定
     * @private
     */
    _setMultiple(configObject) {
        for (const [key, value] of Object.entries(configObject)) {
            this._setNestedValue(this.config, key, value);
        }
        
        if (this.autoSave) {
            this.save();
        }
        
        return true;
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
     * デフォルト設定とマージ
     * @private
     */
    _mergeWithDefaults(config) {
        const merged = { ...this.defaultConfig };
        
        const deepMerge = (target, source) => {
            for (const key in source) {
                if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                    if (!target[key] || typeof target[key] !== 'object') {
                        target[key] = {};
                    }
                    deepMerge(target[key], source[key]);
                } else {
                    target[key] = source[key];
                }
            }
        };
        
        deepMerge(merged, config);
        return merged;
    }
}

// グローバルインスタンスを作成・公開
window.ConfigManager = new ConfigManager();

console.log('[ConfigManager] Initialized and registered to window.ConfigManager');