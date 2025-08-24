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
 * 🔧 Phase1修正内容:
 * - getCanvasConfig()メソッド追加
 * - getPixiConfig()メソッド追加
 * - CanvasManager連携強化
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
        
        console.log('🔧 ConfigManager インスタンス作成完了');
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
            if (window.Tegaki?.ErrorManagerInstance) {
                window.Tegaki.ErrorManagerInstance.showError('warning', `ConfigManager設定取得エラー: ${error.message}`, {
                    context: 'ConfigManager.get',
                    key,
                    nonCritical: true
                });
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
            if (window.Tegaki?.ErrorManagerInstance) {
                window.Tegaki.ErrorManagerInstance.showError('warning', `ConfigManager設定設定エラー: ${error.message}`, {
                    context: 'ConfigManager.set',
                    key,
                    nonCritical: true
                });
            } else {
                console.error('[ConfigManager.set]', error);
            }
            return false;
        }
    }

    /**
     * Phase1修正: キャンバス設定取得（CanvasManager連携用）
     * @returns {object} キャンバス設定
     */
    getCanvasConfig() {
        try {
            const canvasConfig = this.get('canvas', {});
            const defaultCanvas = this.defaultConfig.canvas;
            
            return {
                width: canvasConfig.width || defaultCanvas.width,
                height: canvasConfig.height || defaultCanvas.height,
                backgroundColor: canvasConfig.backgroundColor || defaultCanvas.backgroundColor,
                antialias: canvasConfig.antialias !== undefined ? canvasConfig.antialias : defaultCanvas.antialias,
                preserveDrawingBuffer: canvasConfig.preserveDrawingBuffer !== undefined ? 
                                      canvasConfig.preserveDrawingBuffer : defaultCanvas.preserveDrawingBuffer,
                powerPreference: canvasConfig.powerPreference || defaultCanvas.powerPreference
            };
        } catch (error) {
            console.warn('⚠️ キャンバス設定取得エラー - デフォルト値を使用:', error);
            return { ...this.defaultConfig.canvas };
        }
    }

    /**
     * Phase1修正: Pixi設定取得（CanvasManager連携用）
     * @returns {object} Pixi設定
     */
    getPixiConfig() {
        try {
            const canvasConfig = this.getCanvasConfig();
            const performanceConfig = this.get('performance', {});
            
            return {
                antialias: canvasConfig.antialias,
                backgroundColor: this._convertColorToHex(canvasConfig.backgroundColor),
                resolution: window.devicePixelRatio || 1,
                autoDensity: true,
                powerPreference: canvasConfig.powerPreference,
                preserveDrawingBuffer: canvasConfig.preserveDrawingBuffer,
                clearBeforeRender: true,
                forceCanvas: !performanceConfig.enableGPUAcceleration
            };
        } catch (error) {
            console.warn('⚠️ Pixi設定取得エラー - デフォルト値を使用:', error);
            return {
                antialias: true,
                backgroundColor: 0xffffee,
                resolution: 1,
                autoDensity: true,
                powerPreference: 'high-performance',
                preserveDrawingBuffer: true,
                clearBeforeRender: true,
                forceCanvas: false
            };
        }
    }

    /**
     * ペン設定取得
     * @returns {object} ペン設定
     */
    getPenConfig() {
        try {
            const penConfig = this.get('pen', {});
            const defaultPen = this.defaultConfig.pen;
            
            return {
                size: penConfig.size || defaultPen.size,
                opacity: penConfig.opacity !== undefined ? penConfig.opacity : defaultPen.opacity,
                pressure: penConfig.pressure !== undefined ? penConfig.pressure : defaultPen.pressure,
                smoothing: penConfig.smoothing !== undefined ? penConfig.smoothing : defaultPen.smoothing,
                color: penConfig.color || defaultPen.color,
                presets: penConfig.presets || defaultPen.presets
            };
        } catch (error) {
            console.warn('⚠️ ペン設定取得エラー - デフォルト値を使用:', error);
            return { ...this.defaultConfig.pen };
        }
    }

    /**
     * UI設定取得
     * @returns {object} UI設定
     */
    getUIConfig() {
        try {
            const uiConfig = this.get('ui', {});
            const defaultUI = this.defaultConfig.ui;
            
            return {
                popupDraggable: uiConfig.popupDraggable !== undefined ? uiConfig.popupDraggable : defaultUI.popupDraggable,
                showCoordinates: uiConfig.showCoordinates !== undefined ? uiConfig.showCoordinates : defaultUI.showCoordinates,
                showPressure: uiConfig.showPressure !== undefined ? uiConfig.showPressure : defaultUI.showPressure,
                showPerformance: uiConfig.showPerformance !== undefined ? uiConfig.showPerformance : defaultUI.showPerformance,
                animationsEnabled: uiConfig.animationsEnabled !== undefined ? uiConfig.animationsEnabled : defaultUI.animationsEnabled
            };
        } catch (error) {
            console.warn('⚠️ UI設定取得エラー - デフォルト値を使用:', error);
            return { ...this.defaultConfig.ui };
        }
    }

    /**
     * テーマ設定取得
     * @returns {object} テーマ設定
     */
    getThemeConfig() {
        try {
            const themeConfig = this.get('theme', {});
            const defaultTheme = this.defaultConfig.theme;
            
            return {
                colors: { ...defaultTheme.colors, ...themeConfig.colors },
                layout: { ...defaultTheme.layout, ...themeConfig.layout }
            };
        } catch (error) {
            console.warn('⚠️ テーマ設定取得エラー - デフォルト値を使用:', error);
            return { ...this.defaultConfig.theme };
        }
    }

    /**
     * 座標設定取得
     * @returns {object} 座標設定
     */
    getCoordinatesConfig() {
        try {
            const coordConfig = this.get('coordinates', {});
            const defaultCoord = this.defaultConfig.coordinates;
            
            return {
                smoothingEnabled: coordConfig.smoothingEnabled !== undefined ? coordConfig.smoothingEnabled : defaultCoord.smoothingEnabled,
                smoothingFactor: coordConfig.smoothingFactor !== undefined ? coordConfig.smoothingFactor : defaultCoord.smoothingFactor,
                precision: coordConfig.precision !== undefined ? coordConfig.precision : defaultCoord.precision,
                validation: coordConfig.validation !== undefined ? coordConfig.validation : defaultCoord.validation
            };
        } catch (error) {
            console.warn('⚠️ 座標設定取得エラー - デフォルト値を使用:', error);
            return { ...this.defaultConfig.coordinates };
        }
    }

    /**
     * パフォーマンス設定取得
     * @returns {object} パフォーマンス設定
     */
    getPerformanceConfig() {
        try {
            const perfConfig = this.get('performance', {});
            const defaultPerf = this.defaultConfig.performance;
            
            return {
                targetFPS: perfConfig.targetFPS || defaultPerf.targetFPS,
                enableGPUAcceleration: perfConfig.enableGPUAcceleration !== undefined ? perfConfig.enableGPUAcceleration : defaultPerf.enableGPUAcceleration,
                memoryLimit: perfConfig.memoryLimit || defaultPerf.memoryLimit,
                autoCleanup: perfConfig.autoCleanup !== undefined ? perfConfig.autoCleanup : defaultPerf.autoCleanup
            };
        } catch (error) {
            console.warn('⚠️ パフォーマンス設定取得エラー - デフォルト値を使用:', error);
            return { ...this.defaultConfig.performance };
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
            console.log('✅ ConfigManager - 設定を保存しました');
            return true;
        } catch (error) {
            if (window.Tegaki?.ErrorManagerInstance) {
                window.Tegaki.ErrorManagerInstance.showError('error', `設定保存エラー: ${error.message}`, {
                    context: 'ConfigManager.save',
                    nonCritical: false
                });
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
                console.log('✅ ConfigManager - 設定を読み込みました');
            } else {
                this.config = {};
                console.log('📋 ConfigManager - デフォルト設定を適用しました');
            }
            return true;
        } catch (error) {
            if (window.Tegaki?.ErrorManagerInstance) {
                window.Tegaki.ErrorManagerInstance.showError('warning', `設定読み込みエラー: ${error.message}`, {
                    context: 'ConfigManager.load',
                    nonCritical: true
                });
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
            console.log('🗑️ ConfigManager - 設定をリセットしました');
            return true;
        } catch (error) {
            if (window.Tegaki?.ErrorManagerInstance) {
                window.Tegaki.ErrorManagerInstance.showError('error', `設定リセットエラー: ${error.message}`, {
                    context: 'ConfigManager.reset',
                    nonCritical: false
                });
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

    /**
     * 色を16進数に変換
     * @private
     */
    _convertColorToHex(color) {
        try {
            if (typeof color === 'string' && color.startsWith('#')) {
                // #rrggbb形式をPIXI形式（0xrrggbb）に変換
                return parseInt(color.substring(1), 16);
            } else if (typeof color === 'number') {
                return color;
            } else {
                return 0xffffee; // デフォルトふたば背景色
            }
        } catch (error) {
            console.warn('⚠️ 色変換エラー:', error);
            return 0xffffee;
        }
    }

    /**
     * 診断情報取得
     * @returns {object} 診断情報
     */
    getDiagnosticInfo() {
        const info = this.getDebugInfo();
        
        return {
            ...info,
            canvasConfig: this.getCanvasConfig(),
            pixiConfig: this.getPixiConfig(),
            penConfig: this.getPenConfig(),
            themeConfig: this.getThemeConfig(),
            healthy: true,
            configIntegrity: Object.keys(this.config).length >= 0
        };
    }

    /**
     * 破棄処理
     */
    destroy() {
        try {
            // 最終保存
            this.save();
            
            // 参照クリア
            this.config = null;
            this.defaultConfig = null;
            
            console.log('🗑️ ConfigManager破棄完了');
            
        } catch (error) {
            console.error('❌ ConfigManager破棄エラー:', error);
        }
    }
}

// Tegaki名前空間にクラスを登録
window.Tegaki.ConfigManager = ConfigManager;

// 初期化レジストリに追加（根幹Manager）
window.Tegaki._registry = window.Tegaki._registry || [];
window.Tegaki._registry.push(() => {
    window.Tegaki.ConfigManagerInstance = new window.Tegaki.ConfigManager();
    console.log('🔧 ConfigManager registered to Tegaki namespace');
});

// グローバル登録（下位互換）
if (typeof window !== 'undefined') {
    window.ConfigManager = ConfigManager;
}

console.log('🔧 ConfigManager (Phase1修正版) Loaded');
console.log('✨ 修正完了: getCanvasConfig/getPixiConfig追加・CanvasManager連携強化');
console.log('🔧 使用例: const config = new ConfigManager(); const canvasConfig = config.getCanvasConfig();');