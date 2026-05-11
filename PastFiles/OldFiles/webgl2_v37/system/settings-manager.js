/**
 * @file system/settings-manager.js - Phase 2: 出力解像度設定追加版
 * @description 設定値の永続化・デフォルト管理・EventBus統合
 * 
 * 【Phase 2 改修内容】
 * 🔧 exportResolution 設定項目追加
 * 🔧 getExportResolution() メソッド追加
 * 
 * 【親ファイル (このファイルが依存)】
 * - config.js (デフォルト設定参照)
 * - system/event-bus.js (EventBus)
 * 
 * 【子ファイル (このファイルに依存)】
 * - ui/settings-popup.js (設定UI)
 * - system/export-manager.js (出力解像度取得)
 * - system/exporters/*.js (各エクスポーター)
 * 
 * 【SOLID原則】
 * 単一責任: 設定の保存と読み込みのみ
 */

(function() {
    'use strict';
    
    class SettingsManager {
        constructor(eventBus, config) {
            this.eventBus = eventBus;
            this.config = config;
            this.storageKey = 'tegaki_settings';
            this.settings = this.loadFromStorage();
            
            this.subscribeToSettingChanges();
        }
        
        loadFromStorage() {
            try {
                const stored = localStorage.getItem(this.storageKey);
                if (stored) {
                    const parsed = JSON.parse(stored);
                    return { ...this.getDefaults(), ...parsed };
                }
            } catch (error) {}
            
            return this.getDefaults();
        }
        
        /**
         * 🔧 Phase 2: デフォルト設定に exportResolution 追加
         */
        getDefaults() {
            return {
                pressureCorrection: this.config?.userSettings?.pressureCorrection || 1.0,
                smoothing: this.config?.userSettings?.smoothing || 0.5,
                pressureCurve: this.config?.userSettings?.pressureCurve || 'linear',
                statusPanelVisible: this.config?.ui?.statusPanelVisible !== undefined 
                    ? this.config.ui.statusPanelVisible 
                    : true,
                // 🔧 Phase 2: 出力解像度設定（デフォルトは2倍）
                exportResolution: '2'
            };
        }
        
        get(key) {
            if (key === undefined) {
                return { ...this.settings };
            }
            return this.settings[key];
        }
        
        set(key, value, skipEvent = false) {
            const validated = this.validateValue(key, value);
            if (validated === undefined) return false;
            
            this.settings[key] = validated;
            this.saveToStorage();
            
            if (!skipEvent && this.eventBus) {
                const eventName = `settings:${this.kebabCase(key)}`;
                this.eventBus.emit(eventName, { value: validated });
            }
            
            return true;
        }
        
        update(updates) {
            let hasChanges = false;
            
            for (const [key, value] of Object.entries(updates)) {
                if (this.set(key, value, true)) {
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
         * 🔧 Phase 2: exportResolution バリデーション追加
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
                },
                // 🔧 Phase 2: exportResolution バリデーター
                exportResolution: (v) => {
                    const valid = ['1', '2', '3', '4', 'auto'];
                    return valid.includes(String(v)) ? String(v) : undefined;
                }
            };
            
            const validator = validators[key];
            return validator ? validator(value) : value;
        }
        
        /**
         * 🔧 Phase 2: 出力解像度取得メソッド
         * @returns {number} 解像度倍率（1, 2, 3, 4 または devicePixelRatio）
         */
        getExportResolution() {
            const value = this.get('exportResolution');
            
            // 'auto' の場合は devicePixelRatio を使用（互換性のため残す）
            if (value === 'auto') {
                return window.devicePixelRatio || 1;
            }
            
            // 数値文字列をパース
            const num = parseFloat(value);
            return isNaN(num) ? 2 : num;
        }
        
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
                return false;
            }
        }
        
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
         * 🔧 Phase 2: exportResolution イベント購読追加
         */
        subscribeToSettingChanges() {
            if (!this.eventBus) return;
            
            const settingKeys = [
                'pressureCorrection',
                'smoothing',
                'pressureCurve',
                'statusPanelVisible',
                'exportResolution'  // 🔧 Phase 2: 追加
            ];
            
            settingKeys.forEach(key => {
                const eventName = `settings:${this.kebabCase(key)}`;
                
                this.eventBus.on(eventName, ({ value }) => {
                    this.set(key, value, true);
                });
            });
        }
        
        kebabCase(str) {
            return str.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
        }
        
        getDebugInfo() {
            return {
                current: { ...this.settings },
                defaults: this.getDefaults(),
                storageKey: this.storageKey,
                storageSize: localStorage.getItem(this.storageKey)?.length || 0,
                exportResolution: this.getExportResolution()  // 🔧 Phase 2: デバッグ情報追加
            };
        }
        
        export() {
            return JSON.stringify(this.settings, null, 2);
        }
        
        import(jsonString) {
            try {
                const imported = JSON.parse(jsonString);
                this.update(imported);
                return true;
            } catch (error) {
                return false;
            }
        }
    }
    
    window.TegakiSettingsManager = SettingsManager;
    
    console.log('✅ settings-manager.js Phase 2 loaded');
    console.log('   🔧 exportResolution 設定項目追加');
    
})();