/**
 * ⚙️ 設定統括マネージャー - アプリ設定管理
 * 🎯 AI_WORK_SCOPE: 設定保存・復元・検証・デフォルト管理
 * 🎯 DEPENDENCIES: main.js
 * 🎯 CDN_USAGE: Lodash（オブジェクト操作）
 * 🎯 ISOLATION_TEST: ✅ 設定管理単体テスト可能
 * 🎯 SPLIT_THRESHOLD: 200行維持（設定管理専用）
 * 
 * 📋 PHASE_TARGET: Phase1-4対応
 * 📋 V8_MIGRATION: 設定スキーマ互換性確保
 * 📋 PERFORMANCE_TARGET: 設定読み込み10ms以内
 */

export class SettingsManager {
    constructor() {
        // 設定データ
        this.settings = new Map();
        this.defaultSettings = new Map();
        this.listeners = new Map();
        
        // ストレージキー
        this.storageKey = 'futaba-drawing-tool-settings';
        
        // Lodash利用可否
        this.lodashAvailable = !!window._;
        
        // 初期化
        this.initializeDefaultSettings();
        this.loadSettings();
        
        console.log('⚙️ SettingsManager初期化完了');
    }

    /**
     * デフォルト設定初期化
     */
    initializeDefaultSettings() {
        // ペンツール設定
        this.setDefault('pen', {
            size: 16.0,
            color: 0x800000,
            opacity: 0.85,
            pressure: 0.5,
            smoothing: 0.3,
            pressureSensitivity: true,
            edgeSmoothing: true,
            gpuAcceleration: true
        });

        // 消しゴム設定
        this.setDefault('eraser', {
            size: 20.0,
            opacity: 1.0,
            mode: 'vector'
        });

        // キャンバス設定
        this.setDefault('canvas', {
            width: 400,
            height: 400,
            backgroundColor: 0xf0e0d6,
            showGrid: false,
            gridSize: 20,
            gridColor: 0xe9c2ba,
            gridAlpha: 0.3
        });

        // UI設定
        this.setDefault('ui', {
            theme: 'futaba',
            language: 'ja',
            showToolbar: true,
            showStatusBar: true,
            popupAnimations: true
        });

        // パフォーマンス設定
        this.setDefault('performance', {
            maxFPS: 60, // Phase4で120に変更予定
            gpuAcceleration: true,
            antialiasing: true,
            resolution: 1
        });

        // 📋 Phase2準備: レイヤー設定
        this.setDefault('layers', {
            defaultOpacity: 1.0,
            blendMode: 'normal',
            autoCreateLayers: false
        });

        // 📋 Phase3準備: アニメーション設定
        this.setDefault('animation', {
            frameRate: 12,
            onionSkinEnabled: true,
            onionSkinFrames: 2,
            onionSkinOpacity: 0.3
        });

        console.log('✅ デフォルト設定初期化完了');
    }

    /**
     * デフォルト設定セット
     */
    setDefault(category, settings) {
        this.defaultSettings.set(category, { ...settings });
        
        // 現在設定が未設定の場合はデフォルトを適用
        if (!this.settings.has(category)) {
            this.settings.set(category, { ...settings });
        }
    }

    /**
     * 設定読み込み
     */
    loadSettings() {
        try {
            const saved = localStorage.getItem(this.storageKey);
            if (saved) {
                const parsedSettings = JSON.parse(saved);
                
                // 各カテゴリを復元
                for (const [category, data] of Object.entries(parsedSettings)) {
                    this.settings.set(category, { ...data });
                }
                
                console.log('✅ 設定読み込み完了');
            }
        } catch (error) {
            console.warn('⚠️ 設定読み込み失敗、デフォルト設定を使用:', error);
        }
    }

    /**
     * 設定保存
     */
    saveSettings() {
        try {
            const settingsObject = {};
            
            // Map → Object変換
            for (const [category, data] of this.settings.entries()) {
                settingsObject[category] = data;
            }
            
            localStorage.setItem(this.storageKey, JSON.stringify(settingsObject));
            console.log('💾 設定保存完了');
            
        } catch (error) {
            console.error('❌ 設定保存失敗:', error);
        }
    }

    /**
     * 設定取得
     */
    get(category, key = null) {
        const categorySettings = this.settings.get(category);
        
        if (!categorySettings) {
            return this.getDefault(category, key);
        }
        
        if (key) {
            return categorySettings[key] ?? this.getDefault(category, key);
        }
        
        return { ...categorySettings };
    }

    /**
     * 設定更新
     */
    set(category, keyOrObject, value = undefined) {
        if (!this.settings.has(category)) {
            this.settings.set(category, {});
        }
        
        const categorySettings = this.settings.get(category);
        
        if (typeof keyOrObject === 'string') {
            // 単一キー更新
            const oldValue = categorySettings[keyOrObject];
            categorySettings[keyOrObject] = value;
            
            // 変更通知
            this.notifyChange(category, keyOrObject, oldValue, value);
            
        } else if (typeof keyOrObject === 'object') {
            // 複数キー更新
            const updates = keyOrObject;
            
            if (this.lodashAvailable && window._.merge) {
                window._.merge(categorySettings, updates);
            } else {
                Object.assign(categorySettings, updates);
            }
            
            // 複数変更通知
            for (const [key, newValue] of Object.entries(updates)) {
                this.notifyChange(category, key, undefined, newValue);
            }
        }
        
        // 自動保存
        this.saveSettings();
    }

    /**
     * デフォルト設定取得
     */
    getDefault(category, key = null) {
        const defaultCategorySettings = this.defaultSettings.get(category);
        
        if (!defaultCategorySettings) {
            return key ? undefined : {};
        }
        
        if (key) {
            return defaultCategorySettings[key];
        }
        
        return { ...defaultCategorySettings };
    }

    /**
     * 設定リセット
     */
    reset(category = null) {
        if (category) {
            // 特定カテゴリリセット
            const defaultSettings = this.getDefault(category);
            this.settings.set(category, { ...defaultSettings });
            console.log(`🔄 設定リセット: ${category}`);
        } else {
            // 全設定リセット
            this.settings.clear();
            for (const [cat, defaults] of this.defaultSettings.entries()) {
                this.settings.set(cat, { ...defaults });
            }
            console.log('🔄 全設定リセット');
        }
        
        this.saveSettings();
    }

    /**
     * 設定変更リスナー登録
     */
    onChange(category, callback) {
        if (!this.listeners.has(category)) {
            this.listeners.set(category, []);
        }
        
        this.listeners.get(category).push(callback);
        
        // 解除用関数を返す
        return () => {
            const callbacks = this.listeners.get(category);
            if (callbacks) {
                const index = callbacks.indexOf(callback);
                if (index !== -1) {
                    callbacks.splice(index, 1);
                }
            }
        };
    }

    /**
     * 変更通知
     */
    notifyChange(category, key, oldValue, newValue) {
        const callbacks = this.listeners.get(category);
        if (callbacks) {
            callbacks.forEach(callback => {
                try {
                    callback(key, newValue, oldValue, category);
                } catch (error) {
                    console.error('❌ 設定変更コールバックエラー:', error);
                }
            });
        }
    }

    /**
     * 設定検証
     */
    validate(category, settings) {
        // 基本的な型チェック
        const validators = {
            pen: this.validatePenSettings.bind(this),
            eraser: this.validateEraserSettings.bind(this),
            canvas: this.validateCanvasSettings.bind(this),
            ui: this.validateUISettings.bind(this),
            performance: this.validatePerformanceSettings.bind(this)
        };
        
        const validator = validators[category];
        if (validator) {
            return validator(settings);
        }
        
        return { valid: true, errors: [] };
    }

    /**
     * ペン設定検証
     */
    validatePenSettings(settings) {
        const errors = [];
        
        if (settings.size < 0.1 || settings.size > 100) {
            errors.push('サイズは0.1-100の範囲で設定してください');
        }
        
        if (settings.opacity < 0 || settings.opacity > 1) {
            errors.push('不透明度は0-1の範囲で設定してください');
        }
        
        return { valid: errors.length === 0, errors };
    }

    /**
     * 消しゴム設定検証
     */
    validateEraserSettings(settings) {
        const errors = [];
        
        if (settings.size < 1 || settings.size > 200) {
            errors.push('消しゴムサイズは1-200の範囲で設定してください');
        }
        
        return { valid: errors.length === 0, errors };
    }

    /**
     * キャンバス設定検証
     */
    validateCanvasSettings(settings) {
        const errors = [];
        
        if (settings.width < 100 || settings.width > 4096) {
            errors.push('キャンバス幅は100-4096の範囲で設定してください');
        }
        
        if (settings.height < 100 || settings.height > 4096) {
            errors.push('キャンバス高さは100-4096の範囲で設定してください');
        }
        
        return { valid: errors.length === 0, errors };
    }

    /**
     * UI設定検証
     */
    validateUISettings(settings) {
        const errors = [];
        
        const validThemes = ['futaba', 'dark', 'light'];
        if (!validThemes.includes(settings.theme)) {
            errors.push(`テーマは${validThemes.join(', ')}から選択してください`);
        }
        
        return { valid: errors.length === 0, errors };
    }

    /**
     * パフォーマンス設定検証
     */
    validatePerformanceSettings(settings) {
        const errors = [];
        
        if (settings.maxFPS < 15 || settings.maxFPS > 120) {
            errors.push('最大FPSは15-120の範囲で設定してください');
        }
        
        return { valid: errors.length === 0, errors };
    }

    /**
     * 設定エクスポート
     */
    exportSettings() {
        const settingsObject = {};
        for (const [category, data] of this.settings.entries()) {
            settingsObject[category] = data;
        }
        
        return {
            version: '1.0',
            exported: new Date().toISOString(),
            settings: settingsObject
        };
    }

    /**
     * 設定インポート
     */
    importSettings(importData) {
        try {
            if (importData.version && importData.settings) {
                // バージョン互換性チェック（将来実装）
                
                for (const [category, data] of Object.entries(importData.settings)) {
                    const validation = this.validate(category, data);
                    if (validation.valid) {
                        this.settings.set(category, { ...data });
                    } else {
                        console.warn(`⚠️ 設定インポート警告 ${category}:`, validation.errors);
                    }
                }
                
                this.saveSettings();
                console.log('📥 設定インポート完了');
                return true;
            }
        } catch (error) {
            console.error('❌ 設定インポートエラー:', error);
        }
        
        return false;
    }

    /**
     * Phase4準備: v8移行設定
     */
    prepareV8Settings() {
        // 📋 V8_MIGRATION: v8対応設定追加予定
        this.setDefault('v8migration', {
            preferWebGPU: false,
            maxFPS: 120,
            webGPUFeatures: []
        });
        
        console.log('📋 V8移行設定準備完了');
    }

    /**
     * リソース解放
     */
    destroy() {
        // 最終保存
        this.saveSettings();
        
        // リスナークリア
        this.listeners.clear();
        
        console.log('🗑️ SettingsManager リソース解放完了');
    }
}