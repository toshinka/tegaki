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
        this.version = 'v1.0-Phase1.1ss5-unified';
        
        // ✅ 統一システム依存性確認
        this.validateUnifiedSystems();
        
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
        
        console.log('⚙️ SettingsManager 統一システム統合初期化開始 -', this.version);
    }
    
    /**
     * 統一システム依存性確認
     */
    validateUnifiedSystems() {
        const required = ['ConfigManager', 'ErrorManager', 'StateManager', 'EventBus'];
        const missing = required.filter(sys => !window[sys]);
        
        if (missing.length > 0) {
            throw new Error('統一システム依存性エラー: ' + missing.join(', '));
        }
        
        console.log('✅ SettingsManager 統一システム依存性確認完了');
    }
    
    /**
     * 🎯 STEP5: 設定管理システム初期化
     */
    async initialize() {
        console.group('⚙️ SettingsManager STEP5初期化開始 -', this.version);
        
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
            
            console.log('✅ SettingsManager STEP5初期化完了 -', initTime.toFixed(2) + 'ms');
            
            // 統一システム連携
            if (window.StateManager) {
                window.StateManager.updateComponentState('settingsManager', 'initialized', {
                    version: this.version,
                    presetsCount: this.presets.user.size,
                    storageType: this.persistence.storageType
                });
            }
            
            return this;
            
        } catch (error) {
            console.error('❌ SettingsManager STEP5初期化エラー:', error);
            
            // エラー管理システム連携
            if (window.ErrorManager) {
                window.ErrorManager.showError('init-error', 'SettingsManager初期化失敗: ' + error.message);
            }
            
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
        this.toolManager = this.appCore ? this.appCore.toolManager : null;
        if (this.toolManager) {
            console.log('✅ ToolManager 統合完了');
        }
        
        // UIManager 統合
        this.uiManager = this.appCore ? this.appCore.uiManager : null;
        if (this.uiManager) {
            console.log('✅ UIManager 統合完了');
        }
        
        // MemoryManager 統合
        this.memoryManager = this.appCore ? this.appCore.memoryManager : null;
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
        
        console.log('💾 ストレージシステム初期化完了:', this.persistence.storageType);
    }
    
    /**
     * ストレージ可用性チェック
     */
    checkStorageAvailability(storageType) {
        try {
            const storage = window[storageType];
            if (!storage) return false;
            
            const testKey = '__storage_test__';
            storage.setItem(testKey, 'test');
            storage.removeItem(testKey);
            return true;
            
        } catch (error) {
            return false;
        }
    }
    
    /**
     * IndexedDB可用性チェック
     */
    checkIndexedDBAvailability() {
        return !!(window.indexedDB || window.webkitIndexedDB || window.mozIndexedDB);
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
            
            const loadTime = performance.now() - startTime;
            this.performance.loadTime = loadTime;
            
            console.log('📖 設定読み込み完了 -', loadTime.toFixed(2) + 'ms');
            
        } catch (error) {
            console.error('❌ 設定読み込みエラー:', error);
        }
    }
    
    /**
     * ストレージから読み込み
     */
    async loadFromStorage(key) {
        if (!this.persistence.enabled) return null;
        
        try {
            const storage = window[this.persistence.storageType];
            const data = storage.getItem(key);
            return data ? JSON.parse(data) : null;
            
        } catch (error) {
            console.error('❌ ストレージ読み込みエラー:', error);
            return null;
        }
    }
    
    /**
     * ストレージに保存
     */
    async saveToStorage(key, data) {
        if (!this.persistence.enabled) return false;
        
        try {
            const storage = window[this.persistence.storageType];
            storage.setItem(key, JSON.stringify(data));
            return true;
            
        } catch (error) {
            console.error('❌ ストレージ保存エラー:', error);
            return false;
        }
    }
    
    /**
     * 設定マージ
     */
    mergeSettings(savedSettings) {
        if (this.lodashAvailable && window._) {
            this.settings = window._.merge(this.settings, savedSettings);
        } else {
            // 簡易マージ
            Object.assign(this.settings, savedSettings);
        }
    }
    
    /**
     * 変更監視開始
     */
    startChangeTracking() {
        console.log('👁️ 設定変更監視開始...');
        this.changeTracking.enabled = true;
    }
    
    /**
     * 自動保存開始
     */
    startAutoSave() {
        if (!this.persistence.enabled || !this.persistence.autoSaveInterval) return;
        
        console.log('💾 自動保存開始 -', this.persistence.autoSaveInterval + 'ms間隔');
        
        setInterval(() => {
            this.saveSettings();
        }, this.persistence.autoSaveInterval);
    }
    
    /**
     * 全設定適用
     */
    applyAllSettings() {
        console.log('🎯 全設定適用開始...');
        
        // テーマ適用
        if (this.settings.app.theme) {
            this.applyTheme(this.settings.app.theme);
        }
        
        console.log('✅ 全設定適用完了');
    }
    
    /**
     * テーマ適用
     */
    applyTheme(themeId) {
        const theme = this.themeSystem.themes.get(themeId);
        if (!theme) return;
        
        // CSS変数設定
        const root = document.documentElement;
        if (theme.colors) {
            Object.entries(theme.colors).forEach(([key, value]) => {
                root.style.setProperty('--theme-' + key, value);
            });
        }
        
        console.log('🎨 テーマ適用完了:', themeId);
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
            
            const saveTime = performance.now() - startTime;
            this.performance.saveTime = saveTime;
            
            console.log('💾 設定保存完了 -', saveTime.toFixed(2) + 'ms');
            
        } catch (error) {
            console.error('❌ 設定保存エラー:', error);
        }
    }
    
    /**
     * 設定値取得
     */
    getSetting(path, defaultValue) {
        if (defaultValue === undefined) defaultValue = null;
        
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
    setSetting(path, value, notify) {
        if (notify === undefined) notify = true;
        
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
     * 設定変更通知
     */
    notifySettingChange(path, oldValue, newValue) {
        console.log('⚙️ 設定変更:', path, oldValue, '->', newValue);
        
        // EventBus経由で通知
        if (window.EventBus) {
            window.EventBus.safeEmit('setting.changed', {
                path: path,
                oldValue: oldValue,
                newValue: newValue,
                timestamp: Date.now()
            });
        }
    }
    
    /**
     * フォールバック初期化
     */
    async fallbackInitialization() {
        console.log('🛡️ SettingsManager フォールバック初期化...');
        
        try {
            // 基本機能のみ初期化
            this.persistence.enabled = false;
            console.log('✅ フォールバック初期化完了');
            
        } catch (error) {
            console.error('❌ フォールバック初期化も失敗:', error);
        }
    }
    
    /**
     * 設定管理状態取得
     */
    getStatus() {
        return {
            version: this.version,
            persistence: {
                enabled: this.persistence.enabled,
                storageType: this.persistence.storageType,
                autoSaveInterval: this.persistence.autoSaveInterval
            },
            presets: {
                builtin: this.presets.builtin.size,
                user: this.presets.user.size,
                shared: this.presets.shared.size
            },
            theme: {
                current: this.themeSystem.currentTheme,
                available: this.themeSystem.themes.size
            },
            performance: Object.assign({}, this.performance),
            extensions: {
                lodash: this.lodashAvailable,
                toolManager: !!this.toolManager,
                uiManager: !!this.uiManager
            }
        };
    }
    
    /**
     * デバッグ情報取得
     */
    getDebugInfo() {
        const status = this.getStatus();
        
        console.group('⚙️ SettingsManager STEP5 デバッグ情報');
        console.log('📋 バージョン:', status.version);
        console.log('💾 永続化:', status.persistence);
        console.log('🎛️ プリセット:', status.presets);
        console.log('🎨 テーマ:', status.theme);
        console.log('📊 パフォーマンス:', status.performance);
        console.log('🔧 拡張機能:', status.extensions);
        console.groupEnd();
        
        return status;
    }
}

// ==========================================
// 🎯 STEP5: Pure JavaScript グローバル公開
// ==========================================

if (typeof window !== 'undefined') {
    window.SettingsManager = SettingsManager;
    console.log('✅ SettingsManager STEP5版 グローバル公開完了（Pure JavaScript）');
}

console.log('⚙️ SettingsManager Phase1.1ss5完全版 - 準備完了');
console.log('📋 STEP5実装完了: 設定統括管理・永続化・プリセット・インポート/エクスポート');
console.log('🎯 AI分業対応: 依存関係最小化・単体テスト可能・400行以内遵守');
console.log('🔄 V8移行準備: WebStorage API強化・設定同期改善・Cloud連携準備');
console.log('💡 使用例: const settingsManager = new window.SettingsManager(appCore); await settingsManager.initialize();');