/**
 * 🔧 settings-manager.js 構文エラー修正版
 * 
 * 問題: 877行目付近の "Unexpected identifier 'JSON'" エラー修正
 * 対応: exportSettings メソッドの構文エラー完全修正
 */

// ========================================
// 🚨 緊急修正: exportSettings メソッド
// ========================================

/**
 * 設定エクスポート (構文エラー修正版)
 */
function fixedExportSettings(includePresets = true, includeThemes = true) {
    try {
        console.log('📤 設定エクスポート開始 (修正版)');
        
        // 基本エクスポートデータ構造
        const exportData = {
            version: this.version || 'v1.5-Phase1.5-fixed',
            timestamp: Date.now(),
            exportedBy: 'SettingsManager-Fixed',
            settings: null,
            presets: null,
            themes: null
        };
        
        // メイン設定のシリアライズ
        try {
            if (this.settings && typeof this.settings === 'object') {
                exportData.settings = JSON.parse(JSON.stringify(this.settings));
            } else {
                exportData.settings = {};
            }
        } catch (settingsError) {
            console.error('❌ 設定シリアライズエラー:', settingsError);
            exportData.settings = {};
        }
        
        // プリセット情報の追加
        if (includePresets && this.presets) {
            try {
                exportData.presets = {
                    user: this.presets.user ? Object.fromEntries(this.presets.user) : {},
                    shared: this.presets.shared ? Object.fromEntries(this.presets.shared) : {},
                    builtin: this.presets.builtin ? Object.fromEntries(this.presets.builtin) : {}
                };
            } catch (presetError) {
                console.error('❌ プリセットシリアライズエラー:', presetError);
                exportData.presets = { user: {}, shared: {}, builtin: {} };
            }
        }
        
        // テーマ情報の追加
        if (includeThemes && this.themeSystem) {
            try {
                exportData.themes = {
                    currentTheme: this.themeSystem.currentTheme || 'futaba-classic',
                    darkMode: this.themeSystem.darkMode || false,
                    fontScale: this.themeSystem.fontScale || 1.0,
                    customCSS: this.themeSystem.customCSS || '',
                    availableThemes: this.themeSystem.themes ? 
                        Object.fromEntries(this.themeSystem.themes) : {}
                };
            } catch (themeError) {
                console.error('❌ テーマシリアライズエラー:', themeError);
                exportData.themes = {
                    currentTheme: 'futaba-classic',
                    darkMode: false,
                    fontScale: 1.0,
                    customCSS: '',
                    availableThemes: {}
                };
            }
        }
        
        // エクスポートデータの最終検証
        const serialized = JSON.stringify(exportData, null, 2);
        
        // ファイル出力準備
        const blob = new Blob([serialized], { type: 'application/json' });
        const downloadUrl = URL.createObjectURL(blob);
        
        // 自動ダウンロード実行（オプション）
        const filename = `tegaki_settings_${new Date().toISOString().slice(0, 10)}.json`;
        
        console.log('✅ 設定エクスポート完了 (修正版)');
        
        return {
            data: exportData,
            serialized: serialized,
            blob: blob,
            downloadUrl: downloadUrl,
            filename: filename,
            size: serialized.length
        };
        
    } catch (error) {
        console.error('❌ 設定エクスポート致命的エラー:', error);
        
        // 最小限のフォールバックデータ
        const fallbackData = {
            version: 'v1.5-Phase1.5-emergency',
            timestamp: Date.now(),
            error: error.message,
            settings: {},
            fallback: true
        };
        
        const fallbackSerialized = JSON.stringify(fallbackData);
        
        return {
            data: fallbackData,
            serialized: fallbackSerialized,
            error: error.message,
            fallback: true
        };
    }
}

// ========================================
// 🔧 importSettings メソッド修正版
// ========================================

/**
 * 設定インポート (構文エラー修正版)
 */
function fixedImportSettings(importData) {
    try {
        console.log('📥 設定インポート開始 (修正版)');
        
        let parsedData;
        
        // データパース処理
        if (typeof importData === 'string') {
            try {
                parsedData = JSON.parse(importData);
            } catch (parseError) {
                throw new Error(`JSONパースエラー: ${parseError.message}`);
            }
        } else if (typeof importData === 'object' && importData !== null) {
            parsedData = importData;
        } else {
            throw new Error('無効なインポートデータ形式');
        }
        
        // バージョン確認
        if (parsedData.version && !parsedData.version.startsWith('v1.')) {
            console.warn('⚠️ バージョン不一致:', parsedData.version);
        }
        
        const importResults = {
            settings: false,
            presets: false,
            themes: false,
            errors: []
        };
        
        // メイン設定インポート
        if (parsedData.settings && typeof parsedData.settings === 'object') {
            try {
                this.settings = this.lodashAvailable ? 
                    window._.merge({}, this.settings, parsedData.settings) :
                    Object.assign({}, this.settings, parsedData.settings);
                
                importResults.settings = true;
                console.log('✅ メイン設定インポート完了');
            } catch (settingsError) {
                importResults.errors.push(`設定インポートエラー: ${settingsError.message}`);
                console.error('❌ 設定インポートエラー:', settingsError);
            }
        }
        
        // プリセットインポート
        if (parsedData.presets && typeof parsedData.presets === 'object') {
            try {
                // ユーザープリセット
                if (parsedData.presets.user) {
                    for (const [id, preset] of Object.entries(parsedData.presets.user)) {
                        this.presets.user.set(id, preset);
                    }
                }
                
                // 共有プリセット
                if (parsedData.presets.shared) {
                    for (const [id, preset] of Object.entries(parsedData.presets.shared)) {
                        this.presets.shared.set(id, preset);
                    }
                }
                
                importResults.presets = true;
                console.log('✅ プリセットインポート完了');
            } catch (presetError) {
                importResults.errors.push(`プリセットインポートエラー: ${presetError.message}`);
                console.error('❌ プリセットインポートエラー:', presetError);
            }
        }
        
        // テーマインポート
        if (parsedData.themes && typeof parsedData.themes === 'object') {
            try {
                if (parsedData.themes.currentTheme) {
                    this.themeSystem.currentTheme = parsedData.themes.currentTheme;
                }
                
                if (typeof parsedData.themes.darkMode === 'boolean') {
                    this.themeSystem.darkMode = parsedData.themes.darkMode;
                }
                
                if (typeof parsedData.themes.fontScale === 'number') {
                    this.themeSystem.fontScale = parsedData.themes.fontScale;
                }
                
                if (typeof parsedData.themes.customCSS === 'string') {
                    this.themeSystem.customCSS = parsedData.themes.customCSS;
                }
                
                importResults.themes = true;
                console.log('✅ テーマインポート完了');
            } catch (themeError) {
                importResults.errors.push(`テーマインポートエラー: ${themeError.message}`);
                console.error('❌ テーマインポートエラー:', themeError);
            }
        }
        
        // インポート後処理
        if (importResults.settings || importResults.presets || importResults.themes) {
            // 設定適用
            this.applyAllSettings && this.applyAllSettings();
            
            // 保存実行
            this.saveSettings && this.saveSettings();
            
            console.log('✅ 設定インポート完了 (修正版)');
        }
        
        return {
            success: true,
            results: importResults,
            timestamp: Date.now()
        };
        
    } catch (error) {
        console.error('❌ 設定インポート致命的エラー:', error);
        
        return {
            success: false,
            error: error.message,
            timestamp: Date.now()
        };
    }
}

// ========================================
// 🔧 saveToStorage / loadFromStorage 修正版
// ========================================

/**
 * ストレージ保存 (修正版)
 */
function fixedSaveToStorage(key, data) {
    try {
        if (!this.persistence || !this.persistence.enabled) {
            console.warn('⚠️ 永続化が無効です');
            return false;
        }
        
        const serializedData = JSON.stringify(data);
        
        // 圧縮オプション（将来拡張）
        const finalData = this.persistence.compression ? 
            serializedData : // TODO: 圧縮実装
            serializedData;
        
        // ストレージタイプ別保存
        switch (this.persistence.storageType) {
            case 'localStorage':
                if (typeof localStorage !== 'undefined') {
                    localStorage.setItem(key, finalData);
                    return true;
                }
                break;
                
            case 'sessionStorage':
                if (typeof sessionStorage !== 'undefined') {
                    sessionStorage.setItem(key, finalData);
                    return true;
                }
                break;
                
            case 'indexedDB':
                // TODO: IndexedDB実装
                console.warn('⚠️ IndexedDB未実装');
                break;
        }
        
        return false;
        
    } catch (error) {
        console.error('❌ ストレージ保存エラー:', error);
        return false;
    }
}

/**
 * ストレージ読み込み (修正版)
 */
function fixedLoadFromStorage(key) {
    try {
        if (!this.persistence || !this.persistence.enabled) {
            return null;
        }
        
        let rawData = null;
        
        // ストレージタイプ別読み込み
        switch (this.persistence.storageType) {
            case 'localStorage':
                if (typeof localStorage !== 'undefined') {
                    rawData = localStorage.getItem(key);
                }
                break;
                
            case 'sessionStorage':
                if (typeof sessionStorage !== 'undefined') {
                    rawData = sessionStorage.getItem(key);
                }
                break;
                
            case 'indexedDB':
                // TODO: IndexedDB実装
                console.warn('⚠️ IndexedDB未実装');
                break;
        }
        
        if (!rawData) {
            return null;
        }
        
        // 展開（圧縮対応）
        const finalData = this.persistence.compression ? 
            rawData : // TODO: 展開実装
            rawData;
        
        return JSON.parse(finalData);
        
    } catch (error) {
        console.error('❌ ストレージ読み込みエラー:', error);
        return null;
    }
}

// ========================================
// 🚀 SettingsManager プロトタイプ拡張
// ========================================

/**
 * SettingsManager に修正版メソッドを適用
 */
function applySettingsManagerFixes() {
    if (window.SettingsManager && window.SettingsManager.prototype) {
        // 修正版メソッド適用
        window.SettingsManager.prototype.exportSettings = fixedExportSettings;
        window.SettingsManager.prototype.importSettings = fixedImportSettings;
        window.SettingsManager.prototype.saveToStorage = fixedSaveToStorage;
        window.SettingsManager.prototype.loadFromStorage = fixedLoadFromStorage;
        
        console.log('🔧 SettingsManager 構文エラー修正版メソッド適用完了');
        
        return true;
    } else {
        console.warn('⚠️ SettingsManager クラスが見つかりません');
        return false;
    }
}

// ========================================
// 🔍 ストレージ可用性チェック修正版
// ========================================

/**
 * ストレージ可用性確認 (修正版)
 */
function fixedCheckStorageAvailability(storageType) {
    try {
        const storage = window[storageType];
        if (!storage) {
            return false;
        }
        
        // テストデータで書き込み・読み込み・削除テスト
        const testKey = '__storage_test__';
        const testValue = 'test';
        
        storage.setItem(testKey, testValue);
        const retrieved = storage.getItem(testKey);
        storage.removeItem(testKey);
        
        return retrieved === testValue;
        
    } catch (error) {
        console.warn(`⚠️ ${storageType} 利用不可:`, error.message);
        return false;
    }
}

/**
 * IndexedDB 可用性確認 (修正版)
 */
function fixedCheckIndexedDBAvailability() {
    try {
        return !!(window.indexedDB || window.webkitIndexedDB || window.mozIndexedDB);
    } catch (error) {
        console.warn('⚠️ IndexedDB 利用不可:', error.message);
        return false;
    }
}

// ========================================
// 🎯 Phase1.5統合対応メソッド
// ========================================

/**
 * ConfigManager統合対応 (修正版)
 */
function integrateWithConfigManager() {
    if (window.configManager && window.SettingsManager) {
        console.log('🔗 ConfigManager統合開始...');
        
        // SettingsManager → ConfigManager データ移行
        const instance = this;
        
        try {
            // 基本設定移行
            if (instance.settings && instance.settings.canvas) {
                Object.entries(instance.settings.canvas).forEach(([key, value]) => {
                    window.configManager.set(`canvas.${key}`, value);
                });
            }
            
            if (instance.settings && instance.settings.tools) {
                Object.entries(instance.settings.tools).forEach(([toolName, toolSettings]) => {
                    Object.entries(toolSettings).forEach(([key, value]) => {
                        window.configManager.set(`${toolName}.${key}`, value);
                    });
                });
            }
            
            console.log('✅ ConfigManager統合完了');
            
            // 非推奨警告表示
            console.warn('🔄 SettingsManager は非推奨です。ConfigManager を使用してください。');
            
        } catch (integrationError) {
            console.error('❌ ConfigManager統合エラー:', integrationError);
        }
    }
}

// ========================================
// 🚀 自動修正適用
// ========================================

// DOM読み込み後に自動適用
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        setTimeout(applySettingsManagerFixes, 100);
    });
} else {
    // 既に読み込み完了の場合は即座適用
    setTimeout(applySettingsManagerFixes, 50);
}

console.log('🔧 SettingsManager 構文エラー修正システム準備完了');