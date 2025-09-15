/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1rev13
 * 設定管理システム - settings-manager.js
 * 
 * 責務: アプリケーション設定の一元管理
 * 依存: app-core.js, ui-manager.js, history-manager.js
 * 
 * 循環参照修正版:
 * - history-manager.jsのStateCapture/StateRestoreへの依存を削除
 * - 独自の軽量状態管理を実装
 * - ui-manager.jsのクラス重複問題を回避
 */

// ==== 設定管理定数 ====
const SETTINGS_CONFIG = {
    STORAGE_KEY: 'futaba_drawing_tool_settings',
    VERSION: '1.6',
    AUTO_SAVE_DELAY: 500,  // 設定自動保存遅延（ms）
    DEBUG_MODE: false
};

const SETTING_TYPES = {
    HIGH_DPI: 'highDpi',
    SHORTCUTS_ENABLED: 'shortcutsEnabled',
    AUTO_SAVE: 'autoSave',
    SHOW_COORDINATES: 'showCoordinates',
    SHOW_PRESSURE: 'showPressure',
    NOTIFICATIONS_ENABLED: 'notificationsEnabled'
};

const DEFAULT_SETTINGS = {
    [SETTING_TYPES.HIGH_DPI]: false,                    // 初期は低DPIモード（ふたば投稿用）
    [SETTING_TYPES.SHORTCUTS_ENABLED]: true,            // ショートカット有効
    [SETTING_TYPES.AUTO_SAVE]: true,                    // 設定自動保存
    [SETTING_TYPES.SHOW_COORDINATES]: true,             // 座標表示
    [SETTING_TYPES.SHOW_PRESSURE]: true,                // 筆圧表示
    [SETTING_TYPES.NOTIFICATIONS_ENABLED]: true         // 通知表示
};

// ==== ショートカットキー定義 ====
const SHORTCUT_KEYS = {
    PEN_TOOL: 'KeyP',                      // P: ペンツール
    ERASER_TOOL: 'KeyE',                   // E: 消しゴム（既存）
    CLEAR_CANVAS: 'Delete',                // DEL: 画面消去
    UNDO: 'KeyZ+CtrlLeft',                // Ctrl+Z: アンドゥ（既存）
    REDO_Y: 'KeyY+CtrlLeft',              // Ctrl+Y: リドゥ（既存）
    REDO_Z: 'KeyZ+CtrlLeft+ShiftLeft',    // Ctrl+Shift+Z: リドゥ（既存）
    
    // プリセット変更（P+キー組み合わせ）
    PRESET_PREV: 'BracketLeft',            // P + [: 前のプリセット
    PRESET_NEXT: 'BracketRight'            // P + ]: 次のプリセット
};

// ==== 設定変更イベント ====
const SETTINGS_EVENTS = {
    SETTING_CHANGED: 'settings:changed',
    HIGH_DPI_CHANGED: 'settings:highDpiChanged',
    SHORTCUTS_CHANGED: 'settings:shortcutsChanged',
    SETTINGS_LOADED: 'settings:loaded',
    SETTINGS_SAVED: 'settings:saved'
};

// ==== 軽量状態キャプチャ（設定専用） ====
class SettingsStateCapture {
    /**
     * 描画状態の軽量キャプチャ（設定変更用）
     */
    static captureDrawingStateLight(app) {
        if (!app || !app.paths) return null;
        
        return {
            pathCount: app.paths.length,
            canvasWidth: app.width,
            canvasHeight: app.height,
            timestamp: Date.now()
        };
    }
    
    /**
     * PixiJS設定状態をキャプチャ
     */
    static capturePixiSettings(app) {
        if (!app || !app.app) return null;
        
        return {
            resolution: app.app.renderer.resolution,
            autoDensity: app.app.renderer.plugins?.interaction?.autoPreventDefault || false,
            antialias: app.app.renderer.options?.antialias || true,
            backgroundColor: app.app.renderer.backgroundColor
        };
    }
}

// ==== ショートカット管理クラス ====
class ShortcutManager {
    constructor(settingsManager) {
        this.settingsManager = settingsManager;
        this.pressedKeys = new Set();
        this.keySequenceTimeout = null;
        this.sequenceKeys = new Set(); // P+キー用のシーケンス管理
        this.isEnabled = true;
        
        this.setupEventListeners();
        console.log('⌨️ ShortcutManager初期化完了');
    }
    
    setupEventListeners() {
        document.addEventListener('keydown', (event) => this.handleKeyDown(event));
        document.addEventListener('keyup', (event) => this.handleKeyUp(event));
        
        // フォーカス外れた時のキー状態リセット
        window.addEventListener('blur', () => this.resetKeyState());
    }
    
    handleKeyDown(event) {
        // 入力フィールドでは無効
        if (this.isInputActive() || !this.isEnabled) return;
        
        const keyCode = event.code;
        this.pressedKeys.add(keyCode);
        
        // Pキーが押されている場合のシーケンス管理
        if (this.pressedKeys.has('KeyP')) {
            this.handlePKeySequence(event);
            return;
        }
        
        // 通常のショートカット判定
        this.checkShortcuts(event);
    }
    
    handleKeyUp(event) {
        this.pressedKeys.delete(event.code);
        
        // Pキーが離されたらシーケンスリセット
        if (event.code === 'KeyP') {
            this.sequenceKeys.clear();
        }
    }
    
    handlePKeySequence(event) {
        const keyCode = event.code;
        
        // P+[: 前のプリセット
        if (keyCode === SHORTCUT_KEYS.PRESET_PREV && !this.sequenceKeys.has('processed_prev')) {
            event.preventDefault();
            this.sequenceKeys.add('processed_prev');
            this.executePrevPreset();
            return;
        }
        
        // P+]: 次のプリセット
        if (keyCode === SHORTCUT_KEYS.PRESET_NEXT && !this.sequenceKeys.has('processed_next')) {
            event.preventDefault();
            this.sequenceKeys.add('processed_next');
            this.executeNextPreset();
            return;
        }
    }
    
    checkShortcuts(event) {
        const keyCode = event.code;
        
        // P: ペンツール
        if (keyCode === SHORTCUT_KEYS.PEN_TOOL && !event.ctrlKey && !event.shiftKey) {
            event.preventDefault();
            this.executePenTool();
            return;
        }
        
        // DEL: キャンバスクリア
        if (keyCode === SHORTCUT_KEYS.CLEAR_CANVAS && !event.ctrlKey && !event.shiftKey) {
            event.preventDefault();
            this.executeClearCanvas();
            return;
        }
        
        // 他のショートカットは既存のHistoryManagerで処理される
    }
    
    // ==== ショートカット実行メソッド ====
    
    executePenTool() {
        const toolsSystem = this.settingsManager.getDrawingToolsSystem();
        if (toolsSystem) {
            const success = toolsSystem.setTool('pen');
            if (success) {
                this.showNotification('ペンツール選択', 'info');
                console.log('⌨️ ショートカット: ペンツール選択');
            }
        }
    }
    
    executeClearCanvas() {
        const app = this.settingsManager.getApp();
        const historyManager = this.settingsManager.getHistoryManager();
        
        if (app && historyManager) {
            historyManager.recordCanvasClear();
            app.clear();
            this.showNotification('キャンバスをクリアしました', 'info');
            console.log('⌨️ ショートカット: キャンバスクリア（履歴記録済み）');
        }
    }
    
    executePrevPreset() {
        const penPresetManager = this.settingsManager.getPenPresetManager();
        if (penPresetManager) {
            const result = penPresetManager.selectPreviousPreset();
            if (result) {
                this.showNotification(`プリセット: サイズ${result.size}`, 'info');
                console.log('⌨️ ショートカット: 前のプリセット選択');
            }
        }
    }
    
    executeNextPreset() {
        const penPresetManager = this.settingsManager.getPenPresetManager();
        if (penPresetManager) {
            const result = penPresetManager.selectNextPreset();
            if (result) {
                this.showNotification(`プリセット: サイズ${result.size}`, 'info');
                console.log('⌨️ ショートカット: 次のプリセット選択');
            }
        }
    }
    
    // ==== ユーティリティメソッド ====
    
    isInputActive() {
        const activeElement = document.activeElement;
        const inputTags = ['INPUT', 'TEXTAREA', 'SELECT'];
        return inputTags.includes(activeElement?.tagName);
    }
    
    resetKeyState() {
        this.pressedKeys.clear();
        this.sequenceKeys.clear();
    }
    
    showNotification(message, type = 'info') {
        const uiManager = this.settingsManager.getUIManager();
        if (uiManager && uiManager.showNotification && this.settingsManager.getSetting(SETTING_TYPES.NOTIFICATIONS_ENABLED)) {
            uiManager.showNotification(message, type, 2000);
        }
    }
    
    setEnabled(enabled) {
        this.isEnabled = enabled;
        if (!enabled) {
            this.resetKeyState();
        }
    }
    
    destroy() {
        document.removeEventListener('keydown', this.handleKeyDown);
        document.removeEventListener('keyup', this.handleKeyUp);
        window.removeEventListener('blur', this.resetKeyState);
    }
}

// ==== メイン設定管理クラス ====
class SettingsManager {
    constructor(app, toolsSystem = null, uiManager = null, historyManager = null) {
        this.app = app;
        this.toolsSystem = toolsSystem;
        this.uiManager = uiManager;
        this.historyManager = historyManager;
        
        // 設定データ
        this.settings = { ...DEFAULT_SETTINGS };
        this.originalSettings = null;
        
        // 管理システム
        this.shortcutManager = null;
        this.autoSaveTimeout = null;
        
        // 状態管理
        this.isInitialized = false;
        this.isLoading = false;
        this.isSaving = false;
        
        // イベントエミッター
        this.eventHandlers = new Map();
        
        console.log('⚙️ SettingsManager初期化開始');
    }
    
    async init() {
        try {
            this.isLoading = true;
            
            // 設定の読み込み
            await this.loadSettings();
            
            // ショートカット管理の初期化
            this.shortcutManager = new ShortcutManager(this);
            
            // 高DPI設定の適用
            this.applyHighDpiSetting();
            
            // 依存システムの設定
            this.setupDependentSystems();
            
            this.isInitialized = true;
            this.isLoading = false;
            
            this.emit(SETTINGS_EVENTS.SETTINGS_LOADED, { settings: this.settings });
            
            console.log('✅ SettingsManager初期化完了');
            return true;
            
        } catch (error) {
            this.isLoading = false;
            console.error('❌ SettingsManager初期化エラー:', error);
            throw error;
        }
    }
    
    // ==== 設定の読み込み・保存 ====
    
    async loadSettings() {
        try {
            const storedData = localStorage.getItem(SETTINGS_CONFIG.STORAGE_KEY);
            
            if (storedData) {
                const parsed = JSON.parse(storedData);
                
                // バージョン確認
                if (parsed.version === SETTINGS_CONFIG.VERSION) {
                    this.settings = { ...DEFAULT_SETTINGS, ...parsed.settings };
                    console.log('💾 設定を読み込みました:', this.settings);
                } else {
                    console.log('🔄 設定バージョンが異なるため、デフォルト設定を使用します');
                    this.settings = { ...DEFAULT_SETTINGS };
                }
            } else {
                console.log('🆕 初回起動: デフォルト設定を使用します');
                this.settings = { ...DEFAULT_SETTINGS };
            }
            
            // オリジナル設定を保存（変更検知用）
            this.originalSettings = { ...this.settings };
            
        } catch (error) {
            console.warn('⚠️ 設定読み込みエラー:', error);
            this.settings = { ...DEFAULT_SETTINGS };
            this.originalSettings = { ...this.settings };
        }
    }
    
    async saveSettings(immediate = false) {
        if (this.isSaving || !this.isInitialized) return;
        
        try {
            if (immediate) {
                await this._performSave();
            } else {
                // 自動保存（遅延実行）
                if (this.autoSaveTimeout) {
                    clearTimeout(this.autoSaveTimeout);
                }
                
                this.autoSaveTimeout = setTimeout(() => {
                    this._performSave();
                }, SETTINGS_CONFIG.AUTO_SAVE_DELAY);
            }
            
        } catch (error) {
            console.error('💾 設定保存エラー:', error);
        }
    }
    
    async _performSave() {
        if (this.isSaving) return;
        
        try {
            this.isSaving = true;
            
            const saveData = {
                version: SETTINGS_CONFIG.VERSION,
                timestamp: Date.now(),
                settings: { ...this.settings }
            };
            
            localStorage.setItem(SETTINGS_CONFIG.STORAGE_KEY, JSON.stringify(saveData));
            
            this.originalSettings = { ...this.settings };
            this.emit(SETTINGS_EVENTS.SETTINGS_SAVED, { settings: this.settings });
            
            console.log('💾 設定保存完了');
            
        } catch (error) {
            console.error('💾 設定保存失敗:', error);
        } finally {
            this.isSaving = false;
        }
    }
    
    // ==== 設定取得・変更メソッド ====
    
    getSetting(key) {
        return this.settings[key];
    }
    
    setSetting(key, value, saveImmediate = false) {
        if (!SETTING_TYPES.hasOwnProperty(key.toUpperCase())) {
            console.warn('無効な設定キー:', key);
            return false;
        }
        
        const oldValue = this.settings[key];
        this.settings[key] = value;
        
        // 設定変更イベント発火
        this.emit(SETTINGS_EVENTS.SETTING_CHANGED, { key, oldValue, newValue: value });
        
        // 特定設定の特別処理
        this.handleSettingChange(key, value, oldValue);
        
        // 自動保存
        if (this.settings[SETTING_TYPES.AUTO_SAVE] || saveImmediate) {
            this.saveSettings(saveImmediate);
        }
        
        return true;
    }
    
    setSettings(settingsObject, saveImmediate = false) {
        let changed = false;
        
        for (const [key, value] of Object.entries(settingsObject)) {
            if (this.setSetting(key, value, false)) {
                changed = true;
            }
        }
        
        if (changed && (this.settings[SETTING_TYPES.AUTO_SAVE] || saveImmediate)) {
            this.saveSettings(saveImmediate);
        }
        
        return changed;
    }
    
    resetSettings(saveImmediate = true) {
        const oldSettings = { ...this.settings };
        this.settings = { ...DEFAULT_SETTINGS };
        
        this.emit(SETTINGS_EVENTS.SETTING_CHANGED, {
            key: 'ALL',
            oldValue: oldSettings,
            newValue: this.settings
        });
        
        // 全設定の特別処理
        for (const [key, value] of Object.entries(this.settings)) {
            this.handleSettingChange(key, value, oldSettings[key]);
        }
        
        if (saveImmediate) {
            this.saveSettings(true);
        }
        
        console.log('⚙️ 設定をリセットしました');
        return true;
    }
    
    // ==== 特定設定の変更処理 ====
    
    handleSettingChange(key, newValue, oldValue) {
        switch (key) {
            case SETTING_TYPES.HIGH_DPI:
                this.applyHighDpiSetting();
                this.emit(SETTINGS_EVENTS.HIGH_DPI_CHANGED, { newValue, oldValue });
                break;
                
            case SETTING_TYPES.SHORTCUTS_ENABLED:
                if (this.shortcutManager) {
                    this.shortcutManager.setEnabled(newValue);
                }
                this.emit(SETTINGS_EVENTS.SHORTCUTS_CHANGED, { newValue, oldValue });
                break;
        }
    }
    
    applyHighDpiSetting() {
        const highDpi = this.getSetting(SETTING_TYPES.HIGH_DPI);
        
        if (this.app && this.app.app) {
            try {
                const targetResolution = highDpi ? 2.0 : 1.0;
                
                if (Math.abs(this.app.app.renderer.resolution - targetResolution) > 0.1) {
                    // 解像度変更
                    this.app.app.renderer.resolution = targetResolution;
                    
                    // キャンバスの再レンダリングが必要な場合
                    this.app.app.renderer.resize(
                        this.app.app.screen.width,
                        this.app.app.screen.height
                    );
                    
                    console.log(`🎨 DPI設定変更: ${highDpi ? 'High' : 'Low'} DPI (resolution: ${targetResolution})`);
                    
                    // UI通知
                    if (this.uiManager && this.uiManager.showNotification) {
                        this.uiManager.showNotification(
                            `${highDpi ? '高' : '低'}DPIモードに変更しました`,
                            'info',
                            3000
                        );
                    }
                }
            } catch (error) {
                console.error('DPI設定適用エラー:', error);
            }
        }
    }
    
    // ==== 依存システム設定 ====
    
    setupDependentSystems() {
        // ショートカット設定の適用
        if (this.shortcutManager) {
            this.shortcutManager.setEnabled(this.getSetting(SETTING_TYPES.SHORTCUTS_ENABLED));
        }
        
        console.log('✅ 依存システム設定完了');
    }
    
    // ==== 依存オブジェクト取得メソッド ====
    
    getApp() {
        return this.app;
    }
    
    getDrawingToolsSystem() {
        return this.toolsSystem;
    }
    
    getUIManager() {
        return this.uiManager;
    }
    
    getHistoryManager() {
        return this.historyManager;
    }
    
    getPenPresetManager() {
        if (this.toolsSystem && this.toolsSystem.getPenPresetManager) {
            return this.toolsSystem.getPenPresetManager();
        }
        return null;
    }
    
    // ==== イベント管理 ====
    
    on(eventName, handler) {
        if (!this.eventHandlers.has(eventName)) {
            this.eventHandlers.set(eventName, []);
        }
        this.eventHandlers.get(eventName).push(handler);
    }
    
    off(eventName, handler) {
        const handlers = this.eventHandlers.get(eventName);
        if (handlers) {
            const index = handlers.indexOf(handler);
            if (index > -1) {
                handlers.splice(index, 1);
            }
        }
    }
    
    emit(eventName, data = {}) {
        const handlers = this.eventHandlers.get(eventName);
        if (handlers) {
            handlers.forEach(handler => {
                try {
                    handler(data);
                } catch (error) {
                    console.error(`イベントハンドラーエラー (${eventName}):`, error);
                }
            });
        }
    }
    
    // ==== 状態・統計情報 ====
    
    getSettingsInfo() {
        return {
            version: SETTINGS_CONFIG.VERSION,
            isInitialized: this.isInitialized,
            isLoading: this.isLoading,
            isSaving: this.isSaving,
            hasChanges: this.hasUnsavedChanges(),
            settings: { ...this.settings }
        };
    }
    
    hasUnsavedChanges() {
        if (!this.originalSettings) return false;
        
        return JSON.stringify(this.settings) !== JSON.stringify(this.originalSettings);
    }
    
    getShortcutInfo() {
        return {
            enabled: this.getSetting(SETTING_TYPES.SHORTCUTS_ENABLED),
            manager: this.shortcutManager ? {
                isEnabled: this.shortcutManager.isEnabled,
                pressedKeysCount: this.shortcutManager.pressedKeys.size
            } : null,
            shortcuts: { ...SHORTCUT_KEYS }
        };
    }
    
    // ==== デバッグメソッド ====
    
    debugSettings() {
        console.group('⚙️ SettingsManager デバッグ情報');
        console.log('設定情報:', this.getSettingsInfo());
        console.log('ショートカット情報:', this.getShortcutInfo());
        console.log('イベントハンドラー:', Object.fromEntries(this.eventHandlers));
        console.groupEnd();
    }
    
    // ==== クリーンアップ ====
    
    async destroy() {
        console.log('⚙️ SettingsManager破棄開始');
        
        // 未保存の設定を保存
        if (this.hasUnsavedChanges()) {
            await this.saveSettings(true);
        }
        
        // ショートカットマネージャーの破棄
        if (this.shortcutManager) {
            this.shortcutManager.destroy();
            this.shortcutManager = null;
        }
        
        // タイマーのクリア
        if (this.autoSaveTimeout) {
            clearTimeout(this.autoSaveTimeout);
            this.autoSaveTimeout = null;
        }
        
        // イベントハンドラーのクリア
        this.eventHandlers.clear();
        
        // 参照のクリア
        this.app = null;
        this.toolsSystem = null;
        this.uiManager = null;
        this.historyManager = null;
        
        console.log('✅ SettingsManager破棄完了');
    }
}

// ==== エクスポート ====
if (typeof window !== 'undefined') {
    window.SettingsManager = SettingsManager;
    window.ShortcutManager = ShortcutManager;
    window.SettingsStateCapture = SettingsStateCapture;
    window.SETTINGS_CONFIG = SETTINGS_CONFIG;
    window.SETTING_TYPES = SETTING_TYPES;
    window.DEFAULT_SETTINGS = DEFAULT_SETTINGS;
    window.SHORTCUT_KEYS = SHORTCUT_KEYS;
    window.SETTINGS_EVENTS = SETTINGS_EVENTS;
}

// ES6 module export (将来のTypeScript移行用)
// export { 
//     SettingsManager, 
//     ShortcutManager, 
//     SettingsStateCapture,
//     SETTINGS_CONFIG,
//     SETTING_TYPES,
//     DEFAULT_SETTINGS,
//     SHORTCUT_KEYS,
//     SETTINGS_EVENTS
// };