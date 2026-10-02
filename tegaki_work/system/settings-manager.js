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

import { normalizePressureCurvePoints } from './drawing/pressure-curve.js';
import { normalizeUserBrushPresets } from './drawing/brush-presets.js';

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
            pressureCurvePoints: null,
            stabilizerMode: 'follow',
            stabilizerCatchUp: true,
            brushPresets: { pen: [], airbrush: [] },
            qtpBrushPresetIds: { pen: null, airbrush: null }, // QTPの二行目に出すpreset id(null=全て)
            pressureOpacityEnabled: this.config?.userSettings?.pressureOpacityEnabled !== false,
            pressureOpacityStrength: this.config?.userSettings?.pressureOpacityStrength ?? 0.65,
            airbrushFlow: this.config?.BRUSH_DEFAULTS?.airbrushFlow ?? 0.08,
            airbrushSoftness: this.config?.BRUSH_DEFAULTS?.airbrushSoftness ?? 0.8,
            airbrushScatter: this.config?.BRUSH_DEFAULTS?.airbrushScatter ?? 0.0,
            airbrushBuildupRate: this.config?.brushEngine?.airbrushBuildupRate ?? 20,
            penVelocityThinning: this.config?.brushEngine?.penVelocityThinning ?? 0.3,
            airbrushTiltStrength: this.config?.brushEngine?.airbrushTiltStrength ?? 0.5,
            penDabSoftness: this.config?.brushEngine?.penDabSoftness ?? 0,
            penEdgeAA: this.config?.brushEngine?.penEdgeAA ?? 0,
            penPressureSmoothing: this.config?.brushEngine?.penPressureSmoothing ?? 0.5,
            penTaperIn: this.config?.brushEngine?.penTaperIn ?? 0,
            penTaperOut: this.config?.brushEngine?.penTaperOut ?? 0,
            eraserDabSoftness: this.config?.brushEngine?.eraserDabSoftness ?? 0,
            eraserPressureStrength: 0,
            penTiltStrength: this.config?.brushEngine?.penTiltStrength ?? 0,
            statusPanelVisible: this.config?.ui?.statusPanelVisible !== undefined 
                ? this.config.ui.statusPanelVisible 
                : true,
            exportResolution: '2',
            bucketGapClose: 0,
            bucketUnderpaint: 1,
            bucketReferenceAllLayers: true,
            animationAutoCreateOnNext: true,
            emergencyRecoveryEnabled: this.config?.userSettings?.emergencyRecoveryEnabled !== false,
            emergencyRecoveryIntervalSeconds:
                this.config?.userSettings?.emergencyRecoveryIntervalSeconds ?? 60,
            emergencyRecoveryOnHide: this.config?.userSettings?.emergencyRecoveryOnHide !== false,
            shortcutHelpVisible: true, // 画面左上の「?」ショートカットヘルプ
            historyAutoAdjust: true,
            historyMaxEntries: historyDefaults.maxEntries,
            historyMaxMemoryMB: historyDefaults.maxMemoryMB
        };
    }

    getAutomaticHistoryDefaults() {
        const deviceMemory = Number(globalThis.navigator?.deviceMemory);
        const heapLimitMB = Number(globalThis.performance?.memory?.jsHeapSizeLimit) / 1024 / 1024;
        const heapLimitGB = Number.isFinite(heapLimitMB) && heapLimitMB > 0 ? heapLimitMB / 1024 : 0;
        const memoryGB = Math.max(
            Number.isFinite(deviceMemory) ? deviceMemory : 0,
            heapLimitGB
        );

        if (memoryGB > 0) {
            if (memoryGB <= 4) return { maxEntries: 100, maxMemoryMB: 256 };
            if (memoryGB < 8) return { maxEntries: 250, maxMemoryMB: 512 };
            if (memoryGB < 16) return { maxEntries: 500, maxMemoryMB: 1024 };
            if (memoryGB < 32) return { maxEntries: 500, maxMemoryMB: 2048 };
            return { maxEntries: 500, maxMemoryMB: 4096 };
        }
        return { maxEntries: 250, maxMemoryMB: 512 };
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
                return ['linear', 'ease-in', 'ease-out', 'custom'].includes(v) ? v : undefined;
            },
            stabilizerMode: (v) => (['follow', 'string'].includes(v) ? v : undefined),
            stabilizerCatchUp: (v) => (typeof v === 'boolean' ? v : undefined),
            pressureCurvePoints: (v) => {
                if (v === null) return null;
                return normalizePressureCurvePoints(v) ?? undefined;
            },
            brushPresets: (v) => normalizeUserBrushPresets(v, (key, value) => this.validateValue(key, value)),
            qtpBrushPresetIds: (v) => {
                const clean = (list) => (Array.isArray(list)
                    ? list.filter(id => typeof id === 'string' && id.length <= 64).slice(0, 24)
                    : null);
                return { pen: clean(v?.pen), airbrush: clean(v?.airbrush) };
            },
            pressureOpacityEnabled: (v) => {
                return typeof v === 'boolean' ? v : undefined;
            },
            pressureOpacityStrength: (v) => {
                const num = parseFloat(v);
                return isNaN(num) ? undefined : Math.max(0.0, Math.min(1.0, num));
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
            airbrushBuildupRate: (v) => {
                const num = parseFloat(v);
                return isNaN(num) ? undefined : Math.round(Math.max(0, Math.min(60, num)));
            },
            penVelocityThinning: (v) => {
                const num = parseFloat(v);
                return isNaN(num) ? undefined : Math.max(0.0, Math.min(0.9, num));
            },
            airbrushTiltStrength: (v) => {
                const num = parseFloat(v);
                return isNaN(num) ? undefined : Math.max(0.0, Math.min(1.0, num));
            },
            penTiltStrength: (v) => {
                const num = parseFloat(v);
                return isNaN(num) ? undefined : Math.max(0.0, Math.min(1.0, num));
            },
            penDabSoftness: (v) => {
                const num = parseFloat(v);
                return isNaN(num) ? undefined : Math.max(0.0, Math.min(1.0, num));
            },
            penEdgeAA: (v) => {
                const num = parseFloat(v);
                return isNaN(num) ? undefined : Math.max(0.0, Math.min(4.0, num));
            },
            penPressureSmoothing: (v) => {
                const num = parseFloat(v);
                return isNaN(num) ? undefined : Math.max(0.0, Math.min(1.0, num));
            },
            penTaperIn: (v) => {
                const num = parseFloat(v);
                return isNaN(num) ? undefined : Math.round(Math.max(0, Math.min(300, num)));
            },
            penTaperOut: (v) => {
                const num = parseFloat(v);
                return isNaN(num) ? undefined : Math.round(Math.max(0, Math.min(300, num)));
            },
            eraserDabSoftness: (v) => {
                const num = parseFloat(v);
                return isNaN(num) ? undefined : Math.max(0.0, Math.min(1.0, num));
            },
            eraserPressureStrength: (v) => {
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
            animationAutoCreateOnNext: (v) => {
                return typeof v === 'boolean' ? v : undefined;
            },
            emergencyRecoveryEnabled: (v) => {
                return typeof v === 'boolean' ? v : undefined;
            },
            emergencyRecoveryIntervalSeconds: (v) => {
                const num = parseInt(v, 10);
                return [5, 10, 30, 60, 180, 300].includes(num) ? num : undefined;
            },
            shortcutHelpVisible: (v) => (typeof v === 'boolean' ? v : undefined),
            emergencyRecoveryOnHide: (v) => {
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
                return [128, 256, 512, 1024, 2048, 4096, 8192, 12288, 16384].includes(num) ? num : undefined;
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
            'pressureOpacityEnabled',
            'pressureOpacityStrength',
            'airbrushFlow',
            'airbrushSoftness',
            'airbrushScatter',
            'airbrushBuildupRate',
            'penVelocityThinning',
            'airbrushTiltStrength',
            'penTiltStrength',
            'penDabSoftness',
            'penEdgeAA',
            'penPressureSmoothing',
            'penTaperIn',
            'penTaperOut',
            'eraserDabSoftness',
            'eraserPressureStrength',
            'statusPanelVisible',
            'exportResolution',
            'bucketGapClose',
            'bucketUnderpaint',
            'bucketReferenceAllLayers',
            'animationAutoCreateOnNext',
            'emergencyRecoveryEnabled',
            'emergencyRecoveryIntervalSeconds',
            'emergencyRecoveryOnHide',
            'shortcutHelpVisible',
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
