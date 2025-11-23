/**
 * ============================================================
 * settings-manager.js - v3.0 Phase 4: 流量設定統合版
 * ============================================================
 * 親ファイル: config.js
 * 依存ファイル:
 *   - system/event-bus.js (EventBus)
 * 子ファイル:
 *   - ui/settings-popup.js (設定UI)
 *   - system/drawing/pressure-handler.js (筆圧処理)
 *   - system/drawing/stroke-renderer.js (流量処理)
 *   - system/export-manager.js (出力解像度取得)
 * ============================================================
 * 【v3.0 Phase 4改修内容】
 * ✅ flowOpacity追加（0.0-1.0）
 * ✅ flowSensitivity追加（0.1-2.0）
 * ✅ flowAccumulation追加（boolean）
 * ✅ 全設定の完全統合
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
                // 筆圧設定
                minPressureSize: 0.0,
                pressureSensitivity: 1.0,
                
                // 補正設定
                smoothing: this.config?.brush?.smoothing?.strength || 0.45,
                
                // 流量設定
                flowOpacity: 1.0,
                flowSensitivity: 1.0,
                flowAccumulation: false,
                
                // UI設定
                statusPanelVisible: this.config?.ui?.statusPanelVisible !== undefined 
                    ? this.config.ui.statusPanelVisible 
                    : true,
                
                // エクスポート設定
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
                // 筆圧
                minPressureSize: (v) => {
                    const num = parseFloat(v);
                    return isNaN(num) ? undefined : Math.max(0.0, Math.min(1.0, num));
                },
                pressureSensitivity: (v) => {
                    const num = parseFloat(v);
                    return isNaN(num) ? undefined : Math.max(0.1, Math.min(3.0, num));
                },
                
                // 補正
                smoothing: (v) => {
                    const num = parseFloat(v);
                    return isNaN(num) ? undefined : Math.max(0.0, Math.min(1.0, num));
                },
                
                // 流量
                flowOpacity: (v) => {
                    const num = parseFloat(v);
                    return isNaN(num) ? undefined : Math.max(0.0, Math.min(1.0, num));
                },
                flowSensitivity: (v) => {
                    const num = parseFloat(v);
                    return isNaN(num) ? undefined : Math.max(0.1, Math.min(2.0, num));
                },
                flowAccumulation: (v) => {
                    return typeof v === 'boolean' ? v : undefined;
                },
                
                // UI
                statusPanelVisible: (v) => {
                    return typeof v === 'boolean' ? v : undefined;
                },
                
                // エクスポート
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
                'flowOpacity',
                'flowSensitivity',
                'flowAccumulation',
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
    
    console.log('✅ settings-manager.js v3.0 loaded (Phase 4: 流量設定統合版)');
    
})();