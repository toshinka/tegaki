/**
 * ============================================================================
 * ファイル名: system/settings-manager.js
 * 責務: 設定値の永続化・デフォルト管理・EventBus統合
 * 依存: config.js, system/event-bus.js
 * 被依存: core-initializer.js, ui/settings-popup.js等
 * 公開API: SettingsManager
 * イベント発火: settings:*, settings:updated, settings:saved, settings:reset
 * イベント受信: settings:*
 * グローバル登録: window.TegakiSettingsManager
 * 実装状態: ♻️移植
 * ============================================================================
 */

export class SettingsManager {
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
        const historyDefaults = this.getAutomaticHistoryDefaults();
        return {
            pressureCorrection: this.config?.userSettings?.pressureCorrection || 1.0,
            smoothing: this.config?.userSettings?.smoothing || 0.5,
            pressureCurve: this.config?.userSettings?.pressureCurve || 'linear',
            airbrushFlow: this.config?.BRUSH_DEFAULTS?.airbrushFlow ?? 0.08,
            airbrushSoftness: this.config?.BRUSH_DEFAULTS?.airbrushSoftness ?? 0.8,
            airbrushScatter: this.config?.BRUSH_DEFAULTS?.airbrushScatter ?? 0.0,
            statusPanelVisible: this.config?.ui?.statusPanelVisible !== undefined 
                ? this.config.ui.statusPanelVisible 
                : true,
            exportResolution: '2',
            bucketGapClose: 0,
            bucketUnderpaint: 1,
            bucketReferenceAllLayers: true,
            historyAutoAdjust: true,
            historyMaxEntries: historyDefaults.maxEntries,
            historyMaxMemoryMB: historyDefaults.maxMemoryMB
        };
    }

    getAutomaticHistoryDefaults() {
        const deviceMemory = Number(globalThis.navigator?.deviceMemory);
        if (Number.isFinite(deviceMemory)) {
            if (deviceMemory <= 4) return { maxEntries: 100, maxMemoryMB: 128 };
            if (deviceMemory < 16) return { maxEntries: 250, maxMemoryMB: 256 };
            return { maxEntries: 500, maxMemoryMB: 512 };
        }
        return { maxEntries: 250, maxMemoryMB: 256 };
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
            airbrushFlow: (v) => {
                const num = parseFloat(v);
                return isNaN(num) ? undefined : Math.max(0.01, Math.min(1.0, num));
            },
            airbrushSoftness: (v) => {
                const num = parseFloat(v);
                return isNaN(num) ? undefined : Math.max(0.0, Math.min(1.0, num));
            },
            airbrushScatter: (v) => {
                const num = parseFloat(v);
                return isNaN(num) ? undefined : Math.max(0.0, Math.min(1.0, num));
            },
            statusPanelVisible: (v) => {
                return typeof v === 'boolean' ? v : undefined;
            },
            exportResolution: (v) => {
                const valid = ['1', '2', '3', '4', 'auto'];
                return valid.includes(String(v)) ? String(v) : undefined;
            },
            bucketGapClose: (v) => {
                const num = parseInt(v, 10);
                return isNaN(num) ? undefined : Math.max(0, Math.min(3, num));
            },
            bucketUnderpaint: (v) => {
                const num = parseInt(v, 10);
                return isNaN(num) ? undefined : Math.max(0, Math.min(4, num));
            },
            bucketReferenceAllLayers: (v) => {
                return typeof v === 'boolean' ? v : undefined;
            },
            historyAutoAdjust: (v) => {
                return typeof v === 'boolean' ? v : undefined;
            },
            historyMaxEntries: (v) => {
                const num = parseInt(v, 10);
                return [50, 100, 250, 500].includes(num) ? num : undefined;
            },
            historyMaxMemoryMB: (v) => {
                const num = parseInt(v, 10);
                return [128, 256, 512, 1024].includes(num) ? num : undefined;
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
            'pressureCorrection',
            'smoothing',
            'pressureCurve',
            'airbrushFlow',
            'airbrushSoftness',
            'airbrushScatter',
            'statusPanelVisible',
            'exportResolution',
            'bucketGapClose',
            'bucketUnderpaint',
            'bucketReferenceAllLayers',
            'historyAutoAdjust',
            'historyMaxEntries',
            'historyMaxMemoryMB'
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

// 下位互換性のためにグローバルに登録
window.TegakiSettingsManager = SettingsManager;
