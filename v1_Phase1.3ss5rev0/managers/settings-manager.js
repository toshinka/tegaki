/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1.0
 * 
 * 🎯 AI_WORK_SCOPE: 設定統括管理・永続化・プリセット・インポート/エクスポート・同期システム
 * 🎯 DEPENDENCIES: js/app-core.js, js/managers/tool-manager.js, js/managers/ui-manager.js
 * 🎯 NODE_MODULES: lodash（設定構造最適化）
 * 🎯 PIXI_EXTENSIONS: lodash
 * 🎯 ISOLATION_TEST: ✅ 単体テスト可能
 * 🎯 SPLIT_THRESHOLD: 400行超過時 → settings-presets.js, settings-sync.js分割
 * 
 * 📋 PHASE_TARGET: Phase1.1ss5 - JavaScript機能分割完了・AI分業基盤確立
 * 📋 V8_MIGRATION: WebStorage API強化・設定同期改善・Cloud連携準備
 * 📋 PERFORMANCE_TARGET: 設定読み込み100ms以下・同期処理最適化・メモリ効率化
 * 📋 DRY_COMPLIANCE: ✅ 共通処理Utils活用・重複コード排除
 * 📋 SOLID_COMPLIANCE: ✅ 単一責任・開放閉鎖・依存性逆転遵守
 */

/**
 * 設定統括管理システム（STEP5新規作成版）
 * 永続化・プリセット・エクスポート/インポート・同期・テーマ管理統合
 * Pure JavaScript完全準拠・AI分業対応
 */
class SettingsManager {
    constructor(appCore) {
        this.appCore = appCore;
        this.version = 'v1.0-Phase1.1ss5';
        
        // 🎯 STEP5: 設定カテゴリ統合管理
        this.settings = {
            app: {
                version: this.version,
                language: 'ja',
                theme: 'futaba-classic',
                autoSave: true,
                performanceMode: 'balanced' // low, balanced, high
            },
            canvas: {
                width: 800,
                height: 600,
                backgroundColor: 0xf0e0d6,
                dpi: 96,
                quality: 'high'
            },
            tools: {
                pen: {
                    size: 16.0,
                    opacity: 85.0,
                    pressure: 50.0,
                    smoothing: 30.0,
                    pressureSensitivity: true,
                    edgeSmoothing: true,
                    gpuAcceleration: false
                },
                eraser: {
                    size: 20.0,
                    opacity: 100.0,
                    mode: 'normal',
                    areaMode: false,
                    particles: true
                }
            },
            ui: {
                showToolTips: true,
                animationSpeed: 'normal', // slow, normal, fast
                compactMode: false,
                popupPositions: {},
                keyboardShortcuts: true
            },
            performance: {
                targetFPS: 60,
                memoryLimit: 2048,
                gpuAcceleration: false,
                hardwareAcceleration: true,
                backgroundProcessing: true
            }
        };
        
        // 🎯 STEP5: プリセット管理システム
        this.presets = {
            builtin: new Map(), // 内蔵プリセット
            user: new Map(),    // ユーザープリセット
            shared: new Map()   // 共有プリセット
        };
        
        // 🎯 STEP5: 設定永続化システム
        this.persistence = {
            enabled: true,
            storageType: 'localStorage', // localStorage, sessionStorage, indexedDB
            autoSaveInterval: 30000, // 30秒
            backupCount: 5,
            compression: true
        };
        
        // 🎯 STEP5: 同期システム
        this.syncSystem = {
            enabled: false,
            cloudProvider: null, // 将来: 'firebase', 'supabase', etc.
            lastSync: null,
            conflictResolution: 'client-wins', // client-wins, server-wins, merge
            syncQueue: []
        };
        
        // 🎯 STEP5: テーマ管理システム
        this.themeSystem = {
            currentTheme: 'futaba-classic',
            themes: new Map(),
            darkMode: false,
            customCSS: '',
            fontScale: 1.0
        };
        
        // 🎯 STEP5: 設定変更監視システム
        this.changeTracking = {
            enabled: true,
            changes: [],
            maxChanges: 100,
            observers: new Map()
        };
        
        // 🎯 STEP5: 拡張ライブラリ統合
        this.lodashAvailable = false;
        this.toolManager = null;
        this.uiManager = null;
        this.memoryManager = null;
        
        // 🎯 STEP5: パフォーマンス監視
        this.performance = {
            settingOperations: 0,
            loadTime: 0,
            saveTime: 0,
            syncTime: 0,
            lastOperation: null
        };
        
        console.log(`⚙️ SettingsManager STEP5構築開始 - ${this.version}`);
    }
    
    /**
     * 🎯 STEP5: 設定管理システム初期化
     */
    async initialize() {
        console.group(`⚙️ SettingsManager STEP5初期化開始 - ${this.version}`);
        
        try {
            const startTime = performance.now();
            
            // Phase 1: 拡張ライブラリ確認・統合
            this.checkAndIntegrateExtensions();
            
            // Phase 2: ストレージシステム初期化
            await this.initializeStorageSystem();
            
            // Phase 3: プリセットシステム初期化
            this.initializePresetSystem();
            
            // Phase 4: テーマシステム初期化
            this.initializeThemeSystem();
            
            // Phase 5: 設定読み込み
            await this.loadSettings();
            
            // Phase 6: 変更監視システム開始
            this.startChangeTracking();
            
            // Phase 7: 自動保存開始
            this.startAutoSave();
            
            // Phase 8: 設定適用
            this.applyAllSettings();
            
            const initTime = performance.now() - startTime;
            this.performance.loadTime = initTime;
            
            console.log(`✅ SettingsManager STEP5初期化完了 - ${initTime.toFixed(2)}ms`);
            
            return this;
            
        } catch (error) {
            console.error('❌ SettingsManager STEP5初期化エラー:', error);
            
            // 🛡️ STEP5: フォールバック初期化
            await this.fallbackInitialization();
            return this;
            
        } finally {
            console.groupEnd();
        }
    }
    
    /**
     * 🎯 STEP5: 拡張ライブラリ確認・統合
     */
    checkAndIntegrateExtensions() {
        console.log('🔧 拡張ライブラリ統合開始...');
        
        // Lodash 確認・統合
        this.lodashAvailable = typeof window._ !== 'undefined';
        if (this.lodashAvailable) {
            console.log('✅ Lodash 統合完了 - 設定構造最適化');
        }
        
        // ToolManager 統合
        this.toolManager = this.appCore?.toolManager;
        if (this.toolManager) {
            console.log('✅ ToolManager 統合完了');
        }
        
        // UIManager 統合
        this.uiManager = this.appCore?.uiManager;
        if (this.uiManager) {
            console.log('✅ UIManager 統合完了');
        }
        
        // MemoryManager 統合
        this.memoryManager = this.appCore?.memoryManager;
        if (this.memoryManager) {
            console.log('✅ MemoryManager 統合完了');
        }
        
        console.log('🔧 拡張ライブラリ統合完了');
    }
    
    /**
     * 🎯 STEP5: ストレージシステム初期化
     */
    async initializeStorageSystem() {
        console.log('💾 ストレージシステム初期化...');
        
        // ストレージ可用性チェック
        this.storageAvailable = {
            localStorage: this.checkStorageAvailability('localStorage'),
            sessionStorage: this.checkStorageAvailability('sessionStorage'),
            indexedDB: this.checkIndexedDBAvailability()
        };
        
        // 最適なストレージタイプ選択
        if (this.storageAvailable.localStorage) {
            this.persistence.storageType = 'localStorage';
        } else if (this.storageAvailable.sessionStorage) {
            this.persistence.storageType = 'sessionStorage';
        } else {
            this.persistence.enabled = false;
            console.warn('⚠️ ストレージ利用不可 - 設定永続化無効');
        }
        
        // 📋 V8_MIGRATION: WebStorage API強化対応
        /* V8移行時対応:
         * - Persistent Storage API対応
         * - Storage Manager API統合
         * - Quota Management対応
         */
        
        console.log(`💾 ストレージシステム初期化完了: ${this.persistence.storageType}`);
    }
    
    /**
     * 🎯 STEP5: プリセットシステム初期化
     */
    initializePresetSystem() {
        console.log('🎛️ プリセットシステム初期化...');
        
        // 内蔵プリセット登録
        this.registerBuiltinPresets();
        
        // プリセット分類
        this.presetCategories = {
            tools: ['pen', 'eraser'],
            canvas: ['size', 'quality'],
            ui: ['theme', 'layout'],
            performance: ['fps', 'memory']
        };
        
        console.log('🎛️ プリセットシステム初期化完了');
    }
    
    /**
     * 🎯 STEP5: 内蔵プリセット登録
     */
    registerBuiltinPresets() {
        // ツールプリセット
        this.presets.builtin.set('pen-fine', {
            category: 'tools',
            name: '細ペン',
            description: '細かい描画用',
            settings: {
                tools: {
                    pen: {
                        size: 2.0,
                        opacity: 90.0,
                        smoothing: 50.0,
                        pressureSensitivity: true
                    }
                }
            }
        });
        
        this.presets.builtin.set('pen-thick', {
            category: 'tools',
            name: '太ペン',
            description: '太い線・塗り用',
            settings: {
                tools: {
                    pen: {
                        size: 32.0,
                        opacity: 80.0,
                        smoothing: 20.0,
                        pressureSensitivity: false
                    }
                }
            }
        });
        
        // キャンバスプリセット
        this.presets.builtin.set('canvas-small', {
            category: 'canvas',
            name: '小サイズ',
            description: '軽量描画用',
            settings: {
                canvas: {
                    width: 400,
                    height: 300,
                    quality: 'medium'
                }
            }
        });
        
        this.presets.builtin.set('canvas-large', {
            category: 'canvas',
            name: '大サイズ',
            description: '高品質描画用',
            settings: {
                canvas: {
                    width: 1920,
                    height: 1080,
                    quality: 'high'
                }
            }
        });
        
        // パフォーマンスプリセット
        this.presets.builtin.set('perf-low', {
            category: 'performance',
            name: '軽量モード',
            description: '低スペック端末用',
            settings: {
                performance: {
                    targetFPS: 30,
                    memoryLimit: 1024,
                    gpuAcceleration: false
                }
            }
        });
        
        this.presets.builtin.set('perf-high', {
            category: 'performance',
            name: '高性能モード',
            description: '高スペック端末用',
            settings: {
                performance: {
                    targetFPS: 120,
                    memoryLimit: 4096,
                    gpuAcceleration: true
                }
            }
        });
    }
    
    /**
     * 🎯 STEP5: テーマシステム初期化
     */
    initializeThemeSystem() {
        console.log('🎨 テーマシステム初期化...');
        
        // 内蔵テーマ登録
        this.themeSystem.themes.set('futaba-classic', {
            name: 'ふたばクラシック',
            description: '伝統的なふたば☆ちゃんねる風',
            colors: {
                background: '#f0e0d6',
                primary: '#800000',
                secondary: '#cf9c97',
                text: '#800000',
                border: '#800000'
            },
            fonts: {
                primary: '"MS PGothic", "Hiragino Kaku Gothic Pro", sans-serif',
                monospace: '"MS Gothic", "Courier New", monospace'
            }
        });
        
        this.themeSystem.themes.set('futaba-dark', {
            name: 'ふたばダーク',
            description: 'ダークモード版',
            colors: {
                background: '#2d1b1b',
                primary: '#ff6b6b',
                secondary: '#a67c7c',
                text: '#f0e0d6',
                border: '#ff6b6b'
            },
            fonts: {
                primary: '"MS PGothic", "Hiragino Kaku Gothic Pro", sans-serif',
                monospace: '"MS Gothic", "Courier New", monospace'
            }
        });
        
        this.themeSystem.themes.set('modern-light', {
            name: 'モダンライト',
            description: '現代的なライトテーマ',
            colors: {
                background: '#ffffff',
                primary: '#007bff',
                secondary: '#6c757d',
                text: '#212529',
                border: '#dee2e6'
            },
            fonts: {
                primary: '"Helvetica Neue", Arial, sans-serif',
                monospace: '"SF Mono", "Monaco", monospace'
            }
        });
        
        console.log('🎨 テーマシステム初期化完了');
    }
    
    /**
     * 🎯 STEP5: 設定読み込み
     */
    async loadSettings() {
        console.log('📖 設定読み込み開始...');
        
        if (!this.persistence.enabled) {
            console.log('📖 永続化無効 - デフォルト設定使用');
            return;
        }
        
        try {
            const startTime = performance.now();
            
            // メイン設定読み込み
            const savedSettings = await this.loadFromStorage('app_settings');
            if (savedSettings) {
                this.mergeSettings(savedSettings);
                console.log('📖 保存された設定を復元');
            }
            
            // プリセット読み込み
            const userPresets = await this.loadFromStorage('user_presets');
            if (userPresets) {
                this.loadUserPresets(userPresets);
                console.log('📖 ユーザープリセットを復元');
            }
            
            // テーマ設定読み込み
            const themeSettings = await this.loadFromStorage('theme_settings');
            if (themeSettings) {
                this.loadThemeSettings(themeSettings);
                console.log('📖 テーマ設定を復元');
            }
            
            const loadTime = performance.now() - startTime;
            this.performance.loadTime = loadTime;
            
            console.log(`📖 設定読み込み完了 - ${loadTime.toFixed(2)}ms`);
            
        } catch (error) {
            console.error('❌ 設定読み込みエラー:', error);
        }
    }
    
    /**
     * 🎯 STEP5: 設定保存
     */
    async saveSettings() {
        if (!this.persistence.enabled) return;
        
        try {
            const startTime = performance.now();
            
            // メイン設定保存
            await this.saveToStorage('app_settings', this.settings);
            
            // ユーザープリセット保存
            const userPresets = Object.fromEntries(this.presets.user);
            await this.saveToStorage('user_presets', userPresets);
            
            // テーマ設定保存
            const themeSettings = {
                currentTheme: this.themeSystem.currentTheme,
                darkMode: this.themeSystem.darkMode,
                customCSS: this.themeSystem.customCSS,
                fontScale: this.themeSystem.fontScale
            };
            await this.saveToStorage('theme_settings', themeSettings);
            
            const saveTime = performance.now() - startTime;
            this.performance.saveTime = saveTime;
            
            console.log(`💾 設定保存完了 - ${saveTime.toFixed(2)}ms`);
            
        } catch (error) {
            console.error('❌ 設定保存エラー:', error);
        }
    }
    
    // ==========================================
    // 🎯 STEP5: 設定操作メソッド群
    // ==========================================
    
    /**
     * 設定値取得
     */
    getSetting(path, defaultValue = null) {
        try {
            const keys = path.split('.');
            let current = this.settings;
            
            for (const key of keys) {
                if (current && current.hasOwnProperty(key)) {
                    current = current[key];
                } else {
                    return defaultValue;
                }
            }
            
            return current;
            
        } catch (error) {
            console.error('❌ 設定取得エラー:', error);
            return defaultValue;
        }
    }
    
    /**
     * 設定値設定
     */
    setSetting(path, value, notify = true) {
        try {
            const keys = path.split('.');
            const lastKey = keys.pop();
            let current = this.settings;
            
            // ネストしたオブジェクトまで辿る
            for (const key of keys) {
                if (!current[key] || typeof current[key] !== 'object') {
                    current[key] = {};
                }
                current = current[key];
            }
            
            const oldValue = current[lastKey];
            current[lastKey] = value;
            
            // 変更通知
            if (notify && oldValue !== value) {
                this.notifySettingChange(path, oldValue, value);
            }
            
            this.performance.settingOperations++;
            
            return true;
            
        } catch (error) {
            console.error('❌ 設定設定エラー:', error);
            return false;
        }
    }
    
    /**
     * 複数設定値一括設定
     */
    setSettings(settingsObject, notify = true) {
        if (!settingsObject || typeof settingsObject !== 'object') {
            return false;
        }
        
        const changes = [];
        
        const setRecursive = (obj, prefix = '') => {
            for (const [key, value] of Object.entries(obj)) {
                const fullPath = prefix ? `${prefix}.${key}` : key;
                
                if (value && typeof value === 'object' && !Array.isArray(value)) {
                    setRecursive(value, fullPath);
                } else {
                    const oldValue = this.getSetting(fullPath);
                    if (this.setSetting(fullPath, value, false)) {
                        changes.push({ path: fullPath, oldValue, newValue: value });
                    }
                }
            }
        };
        
        setRecursive(settingsObject);
        
        // 一括変更通知
        if (notify && changes.length > 0) {
            this.notifyBulkSettingChange(changes);
        }
        
        return changes.length > 0;
    }
    
    /**
     * 設定値削除
     */
    deleteSetting(path, notify = true) {
        try {
            const keys = path.split('.');
            const lastKey = keys.pop();
            let current = this.settings;
            
            for (const key of keys) {
                if (!current[key]) {
                    return false; // パスが存在しない
                }
                current = current[key];
            }
            
            if (!current.hasOwnProperty(lastKey)) {
                return false;
            }
            
            const oldValue = current[lastKey];
            delete current[lastKey];
            
            if (notify) {
                this.notifySettingChange(path, oldValue, undefined);
            }
            
            return true;
            
        } catch (error) {
            console.error('❌ 設定削除エラー:', error);
            return false;
        }
    }
    
    /**
     * 設定リセット
     */
    resetSettings(category = null) {
        if (category) {
            // 特定カテゴリのリセット
            if (this.settings[category]) {
                const oldValue = { ...this.settings[category] };
                this.settings[category] = this.getDefaultSettings()[category];
                this.notifySettingChange(category, oldValue, this.settings[category]);
            }
        } else {
            // 全設定リセット
            const oldSettings = { ...this.settings };
            this.settings = this.getDefaultSettings();
            this.notifyBulkSettingChange([{
                path: 'all',
                oldValue: oldSettings,
                newValue: this.settings
            }]);
        }
        
        console.log(`🔄 設定リセット: ${category || '全設定'}`);
    }
    
    // ==========================================
    // 🎯 STEP5: プリセット管理システム
    // ==========================================
    
    /**
     * プリセット作成
     */
    createPreset(id, name, description, settings, category = 'user') {
        try {
            const preset = {
                id,
                name,
                description,
                category,
                settings: this.lodashAvailable ? 
                    window._.cloneDeep(settings) : JSON.parse(JSON.stringify(settings)),
                createdAt: Date.now(),
                updatedAt: Date.now()
            };
            
            this.presets.user.set(id, preset);
            
            console.log(`🎛️ プリセット作成: ${name}`);
            
            return preset;
            
        } catch (error) {
            console.error('❌ プリセット作成エラー:', error);
            return null;
        }
    }
    
    /**
     * プリセット適用
     */
    applyPreset(id) {
        try {
            let preset = null;
            
            // プリセット検索
            if (this.presets.user.has(id)) {
                preset = this.presets.user.get(id);
            } else if (this.presets.builtin.has(id)) {
                preset = this.presets.builtin.get(id);
            } else if (this.presets.shared.has(id)) {
                preset = this.presets.shared.get(id);
            }
            
            if (!preset) {
                console.warn('⚠️ プリセットが見つかりません:', id);
                return false;
            }
            
            // 設定適用
            this.setSettings(preset.settings, true);
            
            console.log(`🎛️ プリセット適用: ${preset.name}`);
            
            return true;
            
        } catch (error) {
            console.error('❌ プリセット適用エラー:', error);
            return false;
        }
    }
    
    /**
     * プリセット削除
     */
    deletePreset(id) {
        if (this.presets.user.has(id)) {
            const preset = this.presets.user.get(id);
            this.presets.user.delete(id);
            console.log(`🗑️ プリセット削除: ${preset.name}`);
            return true;
        }
        
        return false;
    }
    
    /**
     * プリセット一覧取得
     */
    getPresets(category = null) {
        const allPresets = [];
        
        // 内蔵プリセット
        for (const [id, preset] of this.presets.builtin) {
            if (!category || preset.category === category) {
                allPresets.push({ ...preset, type: 'builtin' });
            }
        }
        
        // ユーザープリセット
        for (const [id, preset] of this.presets.user) {
            if (!category || preset.category === category) {
                allPresets.push({ ...preset, type: 'user' });
            }
        }
        
        // 共有プリセット
        for (const [id, preset] of this.presets.shared) {
            if (!category || preset.category === category) {
                allPresets.push({ ...preset, type: 'shared' });
            }
        }
        
        return allPresets;
    }
    
    // ==========================================
    // 🎯 STEP5: テーマ管理システム
    // ==========================================
    
    /**
     * テーマ設定
     */
    setTheme(themeId) {
        if (!this.themeSystem.themes.has(themeId)) {
            console.warn('⚠️ テーマが見つかりません:', themeId);
            return false;
        }
        
        const oldTheme = this.themeSystem.currentTheme;
        this.themeSystem.currentTheme = themeId;
        
        // テーマ適用
        this.applyTheme(themeId);
        
        // 設定に反映
        this.setSetting('app.theme', themeId);
        
        console.log(`🎨 テーマ変更: ${oldTheme} → ${themeId}`);
        
        return true;
    }
    
    /**
     * テーマ適用
     */
    applyTheme(themeId) {
        const theme = this.themeSystem.themes.get(themeId);
        if (!theme) return;
        
        // CSS変数設定
        const root = document.documentElement;
        Object.entries(theme.colors).forEach(([key, value]) => {
            root.style.setProperty(`--theme-${key}`, value);
        });
        
        // フォント設定
        root.style.setProperty('--theme-font-primary', theme.fonts.primary);
        root.style.setProperty('--theme-font-monospace', theme.fonts.monospace);
        
        // フォントスケール適用
        root.style.setProperty('--font-scale', this.themeSystem.fontScale);
        
        // ダークモード切り替え
        document.body.classList.toggle('dark-mode', this.themeSystem.darkMode);
        
        // カスタムCSS適用
        this.applyCustomCSS();
    }
    
    /**
     * ダークモード切り替え
     */
    toggleDarkMode() {
        this.themeSystem.darkMode = !this.themeSystem.darkMode;
        this.setSetting('ui.darkMode', this.themeSystem.darkMode);
        
        document.body.classList.toggle('dark-mode', this.themeSystem.darkMode);
        
        console.log(`🌙 ダークモード: ${this.themeSystem.darkMode ? 'ON' : 'OFF'}`);
    }
    
    /**
     * カスタムCSS適用
     */
    applyCustomCSS() {
        let customStyleElement = document.getElementById('custom-theme-styles');
        
        if (!customStyleElement) {
            customStyleElement = document.createElement('style');
            customStyleElement.id = 'custom-theme-styles';
            document.head.appendChild(customStyleElement);
        }
        
        customStyleElement.textContent = this.themeSystem.customCSS;
    }
    
    /**
     * フォントスケール設定
     */
    setFontScale(scale) {
        this.themeSystem.fontScale = Math.max(0.5, Math.min(2.0, scale));
        document.documentElement.style.setProperty('--font-scale', this.themeSystem.fontScale);
        this.setSetting('ui.fontScale', this.themeSystem.fontScale);
    }
    
    // ==========================================
    // 🎯 STEP5: インポート・エクスポートシステム
    // ==========================================
    
    /**
     * 設定エクスポート
     */
    exportSettings(includePresets = true, includeThemes = true) {
        try {
            const exportData = {
                version: this.version,
                timestamp: Date.now(),
                settings: this.lodashAvailable ? 
                    window._.cloneDeep(this.settings) : JSON.parse(JSON.stringify(this.settings/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1.0
 * 
 * 🎯 AI_WORK_SCOPE: 設定統括管理・永続化・プリセット・インポート/エクスポート・同期システム
 * 🎯 DEPENDENCIES: js/app-core.js, js/managers/tool-manager.js, js/managers/ui-manager.js
 * 🎯 NODE_MODULES: lodash（設定構造最適化）
 * 🎯 PIXI_EXTENSIONS: lodash
 * 🎯 ISOLATION_TEST: ✅ 単体テスト可能
 * 🎯 SPLIT_THRESHOLD: 400行超過時 → settings-presets.js, settings-sync.js分割
 * 
 * 📋 PHASE_TARGET: Phase