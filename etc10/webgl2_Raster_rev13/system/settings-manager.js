/**
 * ============================================================
 * settings-manager.js - Phase B-3: フロー制御対応版
 * ============================================================
 * 親ファイル: config.js
 * 依存ファイル:
 *   - system/event-bus.js (EventBus)
 * 子ファイル:
 *   - ui/settings-popup.js (設定UI)
 *   - system/drawing/pressure-handler.js (筆圧処理)
 *   - system/drawing/raster/raster-brush-core.js (ラスター描画)
 *   - system/export-manager.js (出力解像度取得)
 * ============================================================
 * 【Phase B-3改修内容】
 * ✅ getBrushFlow()メソッド追加
 * ✅ getHighSpeedCompensation()メソッド追加
 * ✅ Phase 3.6全機能継承
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
                
                // 補正設定（ラスターでは使用しない）
                smoothing: this.config?.brush?.smoothing?.strength || 0.45,
                
                // 流量設定（Phase B-3拡張）
                brushFlow: this.config?.brush?.raster?.flow || 1.0,
                flowOpacity: 1.0,
                flowSensitivity: 1.0,
                flowAccumulation: false,
                flowPressureMode: 'auto', // 'auto' | 'pen' | 'ignore'
                
                // 高速補正設定（Phase B-3新規）
                highSpeedCompensation: this.config?.brush?.raster?.highSpeedCompensation || 0.5,
                
                // ラスターブラシ設定
                rasterStampHardness: this.config?.brush?.raster?.stamp?.hardness || 0.8,
                rasterAntialiasing: this.config?.brush?.raster?.stamp?.antialiasing !== false,
                rasterTiltEnabled: this.config?.brush?.raster?.tilt?.enabled !== false,
                rasterTiltSensitivity: this.config?.brush?.raster?.tilt?.sensitivity || 0.5,
                
                // UI設定
                statusPanelVisible: this.config?.ui?.statusPanelVisible !== undefined 
                    ? this.config.ui.statusPanelVisible 
                    : true,
                
                // エクスポート設定
                exportResolution: '2'
            };
        }
        
        // ============================================================================
        // 汎用getter/setter
        // ============================================================================
        
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
        
        // ============================================================================
        // ブラシ設定専用getter（Phase B-3新規）
        // ============================================================================
        
        /**
         * ブラシのフロー値を取得
         * @returns {number} 0.0-1.0
         */
        getBrushFlow() {
            return this.get('brushFlow') || 1.0;
        }
        
        /**
         * 高速補正値を取得
         * @returns {number} 0.0-1.0
         */
        getHighSpeedCompensation() {
            return this.get('highSpeedCompensation') || 0.5;
        }
        
        /**
         * ブラシサイズを取得
         * @returns {number}
         */
        getBrushSize() {
            // brush-settings.js から取得する想定
            if (window.brushSettings) {
                return window.brushSettings.getSettings().size;
            }
            return 10;
        }
        
        /**
         * ブラシ色を取得
         * @returns {string}
         */
        getBrushColor() {
            if (window.brushSettings) {
                return window.brushSettings.getSettings().color;
            }
            return '#000000';
        }
        
        /**
         * ブラシ不透明度を取得
         * @returns {number}
         */
        getBrushOpacity() {
            if (window.brushSettings) {
                return window.brushSettings.getSettings().opacity;
            }
            return 1.0;
        }
        
        /**
         * 現在のモードを取得
         * @returns {string} 'pen' | 'eraser'
         */
        getCurrentMode() {
            if (window.brushSettings) {
                return window.brushSettings.getSettings().mode;
            }
            return 'pen';
        }
        
        /**
         * ラスタースタンプ硬度を取得
         * @returns {number} 0.0-1.0
         */
        getRasterStampHardness() {
            return this.get('rasterStampHardness') || 0.8;
        }
        
        /**
         * 最小筆圧サイズを取得
         * @returns {number} 0.0-1.0
         */
        getMinPressureSize() {
            return this.get('minPressureSize') || 0.0;
        }
        
        // ============================================================================
        // バリデーション
        // ============================================================================
        
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
                
                // 流量（Phase B-3）
                brushFlow: (v) => {
                    const num = parseFloat(v);
                    return isNaN(num) ? undefined : Math.max(0.0, Math.min(1.0, num));
                },
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
                flowPressureMode: (v) => {
                    const valid = ['auto', 'pen', 'ignore'];
                    return valid.includes(String(v)) ? String(v) : undefined;
                },
                
                // 高速補正（Phase B-3）
                highSpeedCompensation: (v) => {
                    const num = parseFloat(v);
                    return isNaN(num) ? undefined : Math.max(0.0, Math.min(1.0, num));
                },
                
                // ラスターブラシ
                rasterStampHardness: (v) => {
                    const num = parseFloat(v);
                    return isNaN(num) ? undefined : Math.max(0.0, Math.min(1.0, num));
                },
                rasterAntialiasing: (v) => {
                    return typeof v === 'boolean' ? v : undefined;
                },
                rasterTiltEnabled: (v) => {
                    return typeof v === 'boolean' ? v : undefined;
                },
                rasterTiltSensitivity: (v) => {
                    const num = parseFloat(v);
                    return isNaN(num) ? undefined : Math.max(0.0, Math.min(1.0, num));
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
        
        // ============================================================================
        // ストレージ・リセット
        // ============================================================================
        
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
                'brushFlow',                    // Phase B-3
                'flowOpacity',
                'flowSensitivity',
                'flowAccumulation',
                'flowPressureMode',
                'highSpeedCompensation',        // Phase B-3
                'rasterStampHardness',
                'rasterAntialiasing',
                'rasterTiltEnabled',
                'rasterTiltSensitivity',
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
        
        // ============================================================================
        // デバッグ・エクスポート
        // ============================================================================
        
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
    
    console.log('✅ settings-manager.js Phase B-3 loaded (フロー制御対応版)');
    console.log('   🆕 getBrushFlow() メソッド追加');
    console.log('   🆕 getHighSpeedCompensation() メソッド追加');
    console.log('   ✅ Phase 3.6全機能継承');
    
})();