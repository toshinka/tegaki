// ===== system/settings-manager.js - チェッカーテーマ監視追加版 =====
// 改修内容:
// - CSS変数監視機能追加
// - ui:checker-theme-changed イベント発火

(function() {
    'use strict';
    
    class SettingsManager {
        constructor(eventBus, config) {
            this.eventBus = eventBus;
            this.config = config;
            this.storageKey = 'tegaki_settings';
            this.settings = this.loadFromStorage();
            
            this.subscribeToSettingChanges();
            this._setupCSSVariableMonitoring();
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
                pressureCorrection: this.config?.userSettings?.pressureCorrection || 1.0,
                smoothing: this.config?.userSettings?.smoothing || 0.5,
                pressureCurve: this.config?.userSettings?.pressureCurve || 'linear',
                statusPanelVisible: this.config?.ui?.statusPanelVisible !== undefined 
                    ? this.config.ui.statusPanelVisible 
                    : true,
            };
        }
        
        get(key) {
            if (key === undefined) {
                return { ...this.settings };
            }
            
            // CSS変数取得
            if (typeof key === 'string' && key.startsWith('--')) {
                const root = document.documentElement;
                const computedStyle = getComputedStyle(root);
                return computedStyle.getPropertyValue(key).trim();
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
                'pressureCorrection',
                'smoothing',
                'pressureCurve',
                'statusPanelVisible'
            ];
            
            settingKeys.forEach(key => {
                const eventName = `settings:${this.kebabCase(key)}`;
                
                this.eventBus.on(eventName, ({ value }) => {
                    this.set(key, value, true);
                });
            });
        }
        
        /**
         * CSS変数監視（チェックパターン色変更検知）
         */
        _setupCSSVariableMonitoring() {
            if (!this.eventBus) return;
            
            const root = document.documentElement;
            const targetVariables = ['--futaba-cream', '--futaba-background'];
            
            let lastValues = {};
            targetVariables.forEach(varName => {
                const computedStyle = getComputedStyle(root);
                lastValues[varName] = computedStyle.getPropertyValue(varName).trim();
            });
            
            // MutationObserverでCSS変数変更を監視
            const observer = new MutationObserver(() => {
                let hasChanged = false;
                const computedStyle = getComputedStyle(root);
                
                targetVariables.forEach(varName => {
                    const currentValue = computedStyle.getPropertyValue(varName).trim();
                    if (currentValue && currentValue !== lastValues[varName]) {
                        lastValues[varName] = currentValue;
                        hasChanged = true;
                    }
                });
                
                if (hasChanged) {
                    this.eventBus.emit('ui:checker-theme-changed', {
                        colors: lastValues
                    });
                }
            });
            
            observer.observe(root, {
                attributes: true,
                attributeFilter: ['style', 'class']
            });
            
            this.cssObserver = observer;
        }
        
        kebabCase(str) {
            return str.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
        }
        
        getDebugInfo() {
            return {
                current: { ...this.settings },
                defaults: this.getDefaults(),
                storageKey: this.storageKey,
                storageSize: localStorage.getItem(this.storageKey)?.length || 0
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
        
        destroy() {
            if (this.cssObserver) {
                this.cssObserver.disconnect();
            }
        }
    }
    
    window.TegakiSettingsManager = SettingsManager;
    console.log('✅ system/settings-manager.js (チェッカーテーマ監視追加版) loaded');
    
})();