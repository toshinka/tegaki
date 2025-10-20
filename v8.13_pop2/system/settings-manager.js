// ===== system/settings-manager.js =====
// 責務: 設定値の永続化・デフォルト管理・EventBus統合
// SOLID原則: 単一責任（設定の保存と読み込みのみ）

(function() {
    'use strict';
    
    class SettingsManager {
        constructor(eventBus, config) {
            this.eventBus = eventBus;
            this.config = config;
            this.storageKey = 'tegaki_settings';
            this.settings = this.loadFromStorage();
            
            // 設定変更を監視してlocalStorageに保存
            this.subscribeToSettingChanges();
        }
        
        /**
         * localStorageから設定を読み込み
         * 存在しない場合はデフォルト値を返す
         */
        loadFromStorage() {
            try {
                const stored = localStorage.getItem(this.storageKey);
                if (stored) {
                    const parsed = JSON.parse(stored);
                    // デフォルト値とマージ（新しい設定項目への対応）
                    return { ...this.getDefaults(), ...parsed };
                }
            } catch (error) {
                console.error('[SettingsManager] Load error:', error);
            }
            
            return this.getDefaults();
        }
        
        /**
         * デフォルト設定値を取得
         * config.js の値を優先し、なければハードコーデッド値
         */
        getDefaults() {
            return {
                // ブラシ設定
                pressureCorrection: this.config?.userSettings?.pressureCorrection || 1.0,
                smoothing: this.config?.userSettings?.smoothing || 0.5,
                pressureCurve: this.config?.userSettings?.pressureCurve || 'linear',
                
                // UI設定
                statusPanelVisible: this.config?.ui?.statusPanelVisible !== undefined 
                    ? this.config.ui.statusPanelVisible 
                    : true,
                
                // 将来追加予定の設定項目
                // theme: this.config?.ui?.theme || 'futaba',
                // keyBindings: this.config?.keyBindings || {},
            };
        }
        
        /**
         * 設定値を取得
         * @param {string} key - 設定キー（省略時は全設定を返す）
         */
        get(key) {
            if (key === undefined) {
                return { ...this.settings }; // シャローコピーで返す
            }
            return this.settings[key];
        }
        
        /**
         * 設定値を更新
         * @param {string} key - 設定キー
         * @param {*} value - 設定値
         * @param {boolean} skipEvent - EventBus発行をスキップ（内部使用）
         */
        set(key, value, skipEvent = false) {
            // 値の検証
            const validated = this.validateValue(key, value);
            if (validated === undefined) {
                console.warn(`[SettingsManager] Invalid value for ${key}:`, value);
                return false;
            }
            
            // 設定を更新
            this.settings[key] = validated;
            
            // localStorageに保存
            this.saveToStorage();
            
            // EventBusで通知（skipEventがfalseの場合）
            if (!skipEvent && this.eventBus) {
                const eventName = `settings:${this.kebabCase(key)}`;
                this.eventBus.emit(eventName, { value: validated });
            }
            
            return true;
        }
        
        /**
         * 複数の設定を一括更新
         * @param {Object} updates - { key: value, ... }
         */
        update(updates) {
            let hasChanges = false;
            
            for (const [key, value] of Object.entries(updates)) {
                if (this.set(key, value, true)) { // skipEvent=true
                    hasChanges = true;
                }
            }
            
            if (hasChanges && this.eventBus) {
                this.eventBus.emit('settings:updated', { 
                    settings: { ...this.settings } 
                });
            }
            
            return hasChanges;
        }
        
        /**
         * 設定値の検証
         * @param {string} key - 設定キー
         * @param {*} value - 設定値
         * @returns {*} 検証済みの値（不正な場合はundefined）
         */
        validateValue(key, value) {
            const validators = {
                pressureCorrection: (v) => {
                    const num = parseFloat(v);
                    return isNaN(num) ? undefined : Math.max(0.1, Math.min(3.0, num));
                },
                smoothing: (v) => {
                    const num = parseFloat(v);
                    return isNaN(num) ? undefined : Math.max(0.0, Math.min(1.0, num));
                },
                pressureCurve: (v) => {
                    return ['linear', 'ease-in', 'ease-out'].includes(v) ? v : undefined;
                },
                statusPanelVisible: (v) => {
                    return typeof v === 'boolean' ? v : undefined;
                }
            };
            
            const validator = validators[key];
            return validator ? validator(value) : value;
        }
        
        /**
         * localStorageに保存
         */
        saveToStorage() {
            try {
                localStorage.setItem(this.storageKey, JSON.stringify(this.settings));
                
                if (this.eventBus) {
                    this.eventBus.emit('settings:saved', { 
                        timestamp: Date.now() 
                    });
                }
                
                return true;
            } catch (error) {
                console.error('[SettingsManager] Save error:', error);
                return false;
            }
        }
        
        /**
         * 設定をデフォルトにリセット
         */
        reset() {
            this.settings = this.getDefaults();
            this.saveToStorage();
            
            if (this.eventBus) {
                this.eventBus.emit('settings:reset', { 
                    settings: { ...this.settings } 
                });
            }
        }
        
        /**
         * EventBusから設定変更を購読
         * UI層からの変更を受け取ってlocalStorageに保存
         */
        subscribeToSettingChanges() {
            if (!this.eventBus) return;
            
            // 個別設定の変更を監視
            const settingKeys = [
                'pressureCorrection',
                'smoothing',
                'pressureCurve',
                'statusPanelVisible'
            ];
            
            settingKeys.forEach(key => {
                const eventName = `settings:${this.kebabCase(key)}`;
                
                this.eventBus.on(eventName, ({ value }) => {
                    // skipEvent=true でEventBusの再発行を防ぐ
                    this.set(key, value, true);
                });
            });
        }
        
        /**
         * camelCase → kebab-case 変換
         * @param {string} str
         */
        kebabCase(str) {
            return str.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
        }
        
        /**
         * デバッグ情報取得
         */
        getDebugInfo() {
            return {
                current: { ...this.settings },
                defaults: this.getDefaults(),
                storageKey: this.storageKey,
                storageSize: localStorage.getItem(this.storageKey)?.length || 0
            };
        }
        
        /**
         * エクスポート（将来の設定共有機能用）
         */
        export() {
            return JSON.stringify(this.settings, null, 2);
        }
        
        /**
         * インポート（将来の設定共有機能用）
         */
        import(jsonString) {
            try {
                const imported = JSON.parse(jsonString);
                this.update(imported);
                return true;
            } catch (error) {
                console.error('[SettingsManager] Import error:', error);
                return false;
            }
        }
    }
    
    // グローバル登録
    window.TegakiSettingsManager = SettingsManager;
    
    console.log('✅ system/settings-manager.js loaded');
    console.log('   - 責務: 設定の永続化・デフォルト管理');
    console.log('   - SOLID原則準拠: 単一責任');
    console.log('   - EventBus統合: 設定変更の購読と通知');
    
})();