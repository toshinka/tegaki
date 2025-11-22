/**
 * ============================================================
 * settings-manager.js - v2.4 筆圧設定対応版
 * ============================================================
 * 親ファイル: config.js
 * 依存ファイル:
 *   - system/event-bus.js (EventBus)
 * 子ファイル:
 *   - ui/settings-popup.js (設定UI)
 *   - system/drawing/pressure-handler.js (筆圧処理)
 *   - system/export-manager.js (出力解像度取得)
 * ============================================================
 * 【v2.4 改修内容】
 * - minPressureSize追加（0.0-1.0）
 * - pressureSensitivity追加（0.1-3.0）
 * - pressureCorrection/pressureCurve廃止
 * - exportResolution継承
 * ============================================================
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
        
        getDefaults() {
            return {
                minPressureSize: 0.0,
                pressureSensitivity: 1.0,
                smoothing: this.config?.userSettings?.smoothing || 0.5,
                statusPanelVisible: this.config?.ui?.statusPanelVisible !== undefined 
                    ? this.config.ui.statusPanelVisible 
                    : true,
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
        
        validateValue(key, value) {
            const validators = {
                minPressureSize: (v) => {
                    const num = parseFloat(v);
                    return isNaN(num) ? undefined : Math.max(0.0, Math.min(1.0, num));
                },
                pressureSensitivity: (v) => {
                    const num = parseFloat(v);
                    return isNaN(num) ? undefined : Math.max(0.1, Math.min(3.0, num));
                },
                smoothing: (v) => {
                    const num = parseFloat(v);
                    return isNaN(num) ? undefined : Math.max(0.0, Math.min(1.0, num));
                },
                statusPanelVisible: (v) => {
                    return typeof v === 'boolean' ? v : undefined;
                },
                exportResolution: (v) => {
                    const valid = ['1', '2', '3', '4', 'auto'];
                    return valid.includes(String(v)) ? String(v) : undefined;
                }
            };
            
            const validator = validators[key];
            return validator ? validator(value) : value;
        }
        
        getExportResolution() {
            const value = this.get('exportResolution');
            
            if (value === 'auto') {
                return window.devicePixelRatio || 1;
            }
            
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
        
        subscribeToSettingChanges() {
            if (!this.eventBus) return;
            
            const settingKeys = [
                'minPressureSize',
                'pressureSensitivity',
                'smoothing',
                'statusPanelVisible',
                'exportResolution'
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
                exportResolution: this.getExportResolution()
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
    
    console.log('✅ settings-manager.js v2.4 loaded (筆圧設定対応版)');
    console.log('   ✅ minPressureSize/pressureSensitivity 追加');
    console.log('   ❌ pressureCorrection/pressureCurve 廃止');
    
})();