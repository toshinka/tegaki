/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1.7
 * 設定管理システム - settings-manager.js (最小スタブ版)
 * 
 * 🔧 修繕目的: main.js 初期化時のクラス不足エラーを解決
 * 
 * 責務: アプリ全体の動作設定を一元管理（基本機能のみ）
 * 依存: app-core.js
 */

// ==== 設定定数 ====
const SETTINGS_DEFAULTS = {
    HIGH_DPI: false,
    SHOW_COORDINATES: true,
    SHOW_PRESSURE: true,
    AUTO_SAVE: false
};

const SETTINGS_EVENTS = {
    SETTING_CHANGED: 'settings:changed',
    SETTINGS_LOADED: 'settings:loaded',
    HIGH_DPI_CHANGED: 'settings:highDpiChanged'
};

// ==== 最小設定管理システム（スタブ版）====
class SettingsManager {
    constructor(app, toolsSystem, uiManager, historyManager) {
        this.app = app;
        this.toolsSystem = toolsSystem;
        this.uiManager = uiManager;
        this.historyManager = historyManager;
        
        // 設定状態
        this.settings = { ...SETTINGS_DEFAULTS };
        this.isInitialized = false;
        
        // イベントエミッター（簡易実装）
        this.eventHandlers = new Map();
        
        console.log('⚙️ SettingsManager（スタブ版）初期化');
    }
    
    async init() {
        try {
            console.log('⚙️ SettingsManager初期化開始（スタブ版）...');
            
            // 基本的な設定の読み込み
            this.loadSettings();
            
            // 高DPI設定の初期チェック
            this.checkHighDPISupport();
            
            this.isInitialized = true;
            console.log('✅ SettingsManager初期化完了（スタブ版）');
            
            // 設定読み込み完了イベント
            this.emit(SETTINGS_EVENTS.SETTINGS_LOADED, { settings: this.settings });
            
        } catch (error) {
            console.error('❌ SettingsManager初期化エラー:', error);
            throw error;
        }
    }
    
    // ==== 設定読み込み・保存 ====
    
    loadSettings() {
        // 簡易的な設定読み込み（LocalStorageは使用しない）
        try {
            // デフォルト設定をそのまま使用
            this.settings = { ...SETTINGS_DEFAULTS };
            
            console.log('⚙️ 設定読み込み完了（デフォルト値）:', this.settings);
        } catch (error) {
            console.warn('⚠️ 設定読み込みに失敗:', error);
            this.settings = { ...SETTINGS_DEFAULTS };
        }
    }
    
    saveSettings() {
        // 設定保存は実装せず（将来実装予定）
        console.log('⚙️ 設定保存（スタブ）:', this.settings);
    }
    
    // ==== 高DPI関連設定 ====
    
    checkHighDPISupport() {
        // 高DPI対応チェック（基本的な実装）
        const devicePixelRatio = window.devicePixelRatio || 1;
        const supportsHighDPI = devicePixelRatio > 1;
        
        console.log(`🖥️ 高DPI対応チェック: ${supportsHighDPI ? '対応' : '非対応'} (ratio: ${devicePixelRatio})`);
        
        // デフォルトは無効
        this.settings.HIGH_DPI = false;
    }
    
    isHighDpiEnabled() {
        return this.settings.HIGH_DPI;
    }
    
    setHighDpiEnabled(enabled) {
        const oldValue = this.settings.HIGH_DPI;
        this.settings.HIGH_DPI = enabled;
        
        if (oldValue !== enabled) {
            console.log(`🖥️ 高DPI設定変更: ${enabled ? 'ON' : 'OFF'}`);
            
            // イベント発火
            this.emit(SETTINGS_EVENTS.HIGH_DPI_CHANGED, { enabled });
            this.emit(SETTINGS_EVENTS.SETTING_CHANGED, { 
                key: 'HIGH_DPI', 
                oldValue, 
                newValue: enabled 
            });
        }
    }
    
    // ==== 一般設定管理 ====
    
    getSetting(key) {
        return this.settings[key];
    }
    
    setSetting(key, value) {
        const oldValue = this.settings[key];
        this.settings[key] = value;
        
        if (oldValue !== value) {
            console.log(`⚙️ 設定変更: ${key} = ${value}`);
            
            this.emit(SETTINGS_EVENTS.SETTING_CHANGED, { 
                key, 
                oldValue, 
                newValue: value 
            });
        }
    }
    
    getAllSettings() {
        return { ...this.settings };
    }
    
    // ==== イベントシステム ====
    
    on(eventName, handler) {
        if (!this.eventHandlers.has(eventName)) {
            this.eventHandlers.set(eventName, []);
        }
        this.eventHandlers.get(eventName).push(handler);
    }
    
    emit(eventName, data = {}) {
        const handlers = this.eventHandlers.get(eventName);
        if (handlers) {
            handlers.forEach(handler => {
                try {
                    handler(data);
                } catch (error) {
                    console.error(`設定イベントハンドラーエラー (${eventName}):`, error);
                }
            });
        }
    }
    
    // ==== 統計・情報 ====
    
    getSettingsInfo() {
        return {
            initialized: this.isInitialized,
            settings: this.getAllSettings(),
            highDpiSupported: (window.devicePixelRatio || 1) > 1,
            eventHandlerCount: Array.from(this.eventHandlers.values()).reduce((sum, handlers) => sum + handlers.length, 0)
        };
    }
    
    // ==== デバッグ ====
    
    debugSettings() {
        console.group('⚙️ 設定管理デバッグ情報（スタブ版）');
        console.log('設定情報:', this.getSettingsInfo());
        console.log('全設定:', this.getAllSettings());
        console.log('イベントハンドラー:', Object.fromEntries(this.eventHandlers));
        console.groupEnd();
    }
    
    // ==== クリーンアップ ====
    
    destroy() {
        this.eventHandlers.clear();
        this.app = null;
        this.toolsSystem = null;
        this.uiManager = null;
        this.historyManager = null;
        
        console.log('⚙️ SettingsManager（スタブ版）破棄完了');
    }
}

// ==== エクスポート ====
if (typeof window !== 'undefined') {
    window.SettingsManager = SettingsManager;
    window.SETTINGS_DEFAULTS = SETTINGS_DEFAULTS;
    window.SETTINGS_EVENTS = SETTINGS_EVENTS;
    
    console.log('⚙️ settings-manager.js（スタブ版）読み込み完了');
    console.log('📦 利用可能クラス: SettingsManager');
    console.log('🔧 基本機能のみ実装（将来拡張予定）');
}

// ES6 module export (将来のTypeScript移行用)
// export { 
//     SettingsManager,
//     SETTINGS_DEFAULTS,
//     SETTINGS_EVENTS
// };