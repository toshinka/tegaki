/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1.4
 * 設定管理システム - settings-manager.js
 * 
 * 責務: アプリケーション設定の一元管理
 * 依存: app-core.js, ui-manager.js, history-manager.js
 * 
 * 主要機能:
 * 1. 高DPI設定の動的切り替え
 * 2. ショートカットキー管理
 * 3. ユーザー設定の永続化（LocalStorage）
 * 4. 設定変更の履歴記録
 */

// ==== 設定管理定数 ====
const SETTINGS_CONFIG = {
    STORAGE_KEY: 'futaba_drawing_tool_settings',
    VERSION: '1.3',
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
            
            const dataToSave = {
                version: SETTINGS_CONFIG.VERSION,
                timestamp: Date.now(),
                settings: { ...this.settings }
            };
            
            localStorage.setItem(SETTINGS_CONFIG.STORAGE_KEY, JSON.stringify(dataToSave));
            
            this.originalSettings = { ...this.settings };
            this.emit(SETTINGS_EVENTS.SETTINGS_SAVED, { settings: this.settings });
            
            if (SETTINGS_CONFIG.DEBUG_MODE) {
                console.log('💾 設定保存完了:', this.settings);
            }
            
        } catch (error) {
            console.error('💾 設定保存処理エラー:', error);
            throw error;
        } finally {
            this.isSaving = false;
        }
    }
    
    // ==== 設定値の取得・設定 ====
    
    getSetting(key) {
        return this.settings[key];
    }
    
    setSetting(key, value, recordHistory = true) {
        if (this.settings[key] === value) return false; // 変更なし
        
        const oldValue = this.settings[key];
        this.settings[key] = value;
        
        // 履歴記録（設定変更も履歴管理の対象）
        if (recordHistory && this.historyManager) {
            this.historyManager.recordHistory(HISTORY_TYPES.SETTINGS_CHANGE || 'settings_change', {
                key: key,
                before: oldValue,
                after: value
            }, `設定変更: ${key}`);
        }
        
        // 特定設定の変更処理
        this.handleSettingChange(key, value, oldValue);
        
        // イベント発火
        this.emit(SETTINGS_EVENTS.SETTING_CHANGED, { key, value, oldValue });
        
        // 自動保存
        if (this.getSetting(SETTING_TYPES.AUTO_SAVE)) {
            this.saveSettings();
        }
        
        console.log(`⚙️ 設定変更: ${key} = ${value} (前: ${oldValue})`);
        return true;
    }
    
    updateSettings(updates, recordHistory = true) {
        const changes = {};
        let hasChanges = false;
        
        for (const [key, value] of Object.entries(updates)) {
            if (this.settings[key] !== value) {
                changes[key] = {
                    before: this.settings[key],
                    after: value
                };
                this.settings[key] = value;
                hasChanges = true;
            }
        }
        
        if (!hasChanges) return false;
        
        // 履歴記録
        if (recordHistory && this.historyManager) {
            this.historyManager.recordHistory(HISTORY_TYPES.SETTINGS_CHANGE || 'settings_change', {
                changes: changes
            }, '設定一括変更');
        }
        
        // 各設定の変更処理
        for (const [key, change] of Object.entries(changes)) {
            this.handleSettingChange(key, change.after, change.before);
            this.emit(SETTINGS_EVENTS.SETTING_CHANGED, {
                key,
                value: change.after,
                oldValue: change.before
            });
        }
        
        // 自動保存
        if (this.getSetting(SETTING_TYPES.AUTO_SAVE)) {
            this.saveSettings();
        }
        
        return true;
    }
    
    // ==== 特定設定の変更処理 ====
    
    handleSettingChange(key, newValue, oldValue) {
        switch (key) {
            case SETTING_TYPES.HIGH_DPI:
                this.applyHighDpiSetting(newValue);
                this.emit(SETTINGS_EVENTS.HIGH_DPI_CHANGED, { enabled: newValue });
                break;
                
            case SETTING_TYPES.SHORTCUTS_ENABLED:
                if (this.shortcutManager) {
                    this.shortcutManager.setEnabled(newValue);
                }
                this.emit(SETTINGS_EVENTS.SHORTCUTS_CHANGED, { enabled: newValue });
                break;
                
            case SETTING_TYPES.SHOW_COORDINATES:
            case SETTING_TYPES.SHOW_PRESSURE:
            case SETTING_TYPES.NOTIFICATIONS_ENABLED:
                // UI側で処理（UIManagerに通知）
                if (this.uiManager && this.uiManager.handleSettingChange) {
                    this.uiManager.handleSettingChange(key, newValue);
                }
                break;
        }
    }
    
    // ==== 高DPI設定の適用 ====
    
    applyHighDpiSetting(enabled = null) {
        if (enabled === null) {
            enabled = this.getSetting(SETTING_TYPES.HIGH_DPI);
        }
        
        try {
            // アプリケーションの再初期化が必要
            if (this.app && this.app.app) {
                const currentResolution = this.app.app.renderer.resolution;
                const targetResolution = enabled ? (window.devicePixelRatio || 1) : 1;
                
                if (currentResolution !== targetResolution) {
                    // 描画内容を一時保存
                    const drawingState = this.captureCurrentDrawingState();
                    
                    // PixiJSアプリケーションの再初期化
                    this.reinitializePixiApp(enabled);
                    
                    // 描画内容を復元
                    if (drawingState) {
                        this.restoreDrawingState(drawingState);
                    }
                    
                    console.log(`🖥️ 高DPI設定適用: ${enabled ? 'ON' : 'OFF'} (解像度: ${targetResolution})`);
                }
            }
            
        } catch (error) {
            console.error('❌ 高DPI設定適用エラー:', error);
            // エラー時は元の設定に戻す
            this.settings[SETTING_TYPES.HIGH_DPI] = !enabled;
        }
    }
    
    reinitializePixiApp(highDpiEnabled) {
        if (!this.app) return;
        
        try {
            // 新しい解像度設定
            const resolution = highDpiEnabled ? (window.devicePixelRatio || 1) : 1;
            const autoDensity = highDpiEnabled;
            
            // PixiJSアプリケーションを破棄
            const width = this.app.width;
            const height = this.app.height;
            const canvasContainer = document.getElementById('drawing-canvas');
            
            if (this.app.app) {
                this.app.app.destroy(true, { children: true, texture: false });
            }
            
            // 新しいPixiJSアプリケーションを作成
            this.app.app = new PIXI.Application({
                width: width,
                height: height,
                backgroundColor: CONFIG.BG_COLOR,
                antialias: CONFIG.ANTIALIAS,
                resolution: resolution,
                autoDensity: autoDensity
            });
            
            // DOM要素を再配置
            if (canvasContainer) {
                canvasContainer.innerHTML = '';
                canvasContainer.appendChild(this.app.app.view);
            }
            
            // レイヤー構造を再構築
            this.app.setupLayers();
            this.app.setupInteraction();
            
            console.log(`🔄 PixiJSアプリ再初期化完了 (解像度: ${resolution}, autoDensity: ${autoDensity})`);
            
        } catch (error) {
            console.error('❌ PixiJSアプリ再初期化エラー:', error);
            throw error;
        }
    }
    
    captureCurrentDrawingState() {
        try {
            if (!this.app || !this.app.layers) return null;
            
            return StateCapture.captureDrawingState(this.app);
        } catch (error) {
            console.warn('⚠️ 描画状態キャプチャエラー:', error);
            return null;
        }
    }
    
    restoreDrawingState(drawingState) {
        try {
            if (!drawingState || !this.app) return false;
            
            return StateRestore.restoreDrawingState(this.app, drawingState);
        } catch (error) {
            console.warn('⚠️ 描画状態復元エラー:', error);
            return false;
        }
    }
    
    // ==== 便利メソッド ====
    
    isHighDpiEnabled() {
        return this.getSetting(SETTING_TYPES.HIGH_DPI);
    }
    
    areShortcutsEnabled() {
        return this.getSetting(SETTING_TYPES.SHORTCUTS_ENABLED);
    }
    
    isAutoSaveEnabled() {
        return this.getSetting(SETTING_TYPES.AUTO_SAVE);
    }
    
    toggleHighDpi() {
        const current = this.isHighDpiEnabled();
        return this.setSetting(SETTING_TYPES.HIGH_DPI, !current);
    }
    
    toggleShortcuts() {
        const current = this.areShortcutsEnabled();
        return this.setSetting(SETTING_TYPES.SHORTCUTS_ENABLED, !current);
    }
    
    // ==== システム連携メソッド ====
    
    setupDependentSystems() {
        // ショートカット有効状態の適用
        if (this.shortcutManager) {
            this.shortcutManager.setEnabled(this.areShortcutsEnabled());
        }
        
        // UIManagerに設定通知
        if (this.uiManager && this.uiManager.handleSettingsLoaded) {
            this.uiManager.handleSettingsLoaded(this.settings);
        }
    }
    
    setDependencies(toolsSystem = null, uiManager = null, historyManager = null) {
        if (toolsSystem) this.toolsSystem = toolsSystem;
        if (uiManager) this.uiManager = uiManager;
        if (historyManager) this.historyManager = historyManager;
        
        if (this.isInitialized) {
            this.setupDependentSystems();
        }
    }
    
    // 依存システムの取得メソッド
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
        if (this.uiManager && this.uiManager.penPresetManager) {
            return this.uiManager.penPresetManager;
        }
        return null;
    }
    
    // ==== 設定のリセット ====
    
    resetToDefaults(recordHistory = true) {
        const oldSettings = { ...this.settings };
        this.settings = { ...DEFAULT_SETTINGS };
        
        if (recordHistory && this.historyManager) {
            this.historyManager.recordHistory(HISTORY_TYPES.SETTINGS_CHANGE || 'settings_change', {
                before: oldSettings,
                after: this.settings
            }, '設定リセット');
        }
        
        // 各設定の適用
        this.applyHighDpiSetting();
        this.setupDependentSystems();
        
        // 保存
        if (this.isAutoSaveEnabled()) {
            this.saveSettings(true);
        }
        
        console.log('🔄 設定をデフォルトにリセットしました');
        return true;
    }
    
    // ==== イベントシステム ====
    
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
                    console.error(`⚠️ 設定イベントハンドラーエラー (${eventName}):`, error);
                }
            });
        }
    }
    
    // ==== デバッグ・統計情報 ====
    
    getSettingsInfo() {
        return {
            current: { ...this.settings },
            defaults: { ...DEFAULT_SETTINGS },
            hasChanges: JSON.stringify(this.settings) !== JSON.stringify(this.originalSettings),
            isInitialized: this.isInitialized,
            isLoading: this.isLoading,
            isSaving: this.isSaving,
            version: SETTINGS_CONFIG.VERSION
        };
    }
    
    getShortcutInfo() {
        return {
            enabled: this.areShortcutsEnabled(),
            shortcuts: { ...SHORTCUT_KEYS },
            manager: this.shortcutManager ? {
                isEnabled: this.shortcutManager.isEnabled,
                pressedKeys: Array.from(this.shortcutManager.pressedKeys),
                sequenceKeys: Array.from(this.shortcutManager.sequenceKeys)
            } : null
        };
    }
    
    debugSettings() {
        console.group('⚙️ 設定管理デバッグ情報');
        console.log('📋 設定情報:', this.getSettingsInfo());
        console.log('⌨️ ショートカット情報:', this.getShortcutInfo());
        console.log('🎯 依存システム:', {
            app: !!this.app,
            toolsSystem: !!this.toolsSystem,
            uiManager: !!this.uiManager,
            historyManager: !!this.historyManager
        });
        console.groupEnd();
    }
    
    // ==== エクスポート・インポート（将来実装用）====
    
    exportSettings() {
        return {
            version: SETTINGS_CONFIG.VERSION,
            timestamp: Date.now(),
            settings: { ...this.settings },
            metadata: {
                userAgent: navigator.userAgent,
                platform: navigator.platform
            }
        };
    }
    
    importSettings(data) {
        try {
            if (!data || !data.settings) {
                throw new Error('無効な設定データです');
            }
            
            if (data.version !== SETTINGS_CONFIG.VERSION) {
                console.warn('⚠️ 設定データのバージョンが異なります');
            }
            
            const oldSettings = { ...this.settings };
            this.settings = { ...DEFAULT_SETTINGS, ...data.settings };
            
            // 履歴記録
            if (this.historyManager) {
                this.historyManager.recordHistory(HISTORY_TYPES.SETTINGS_CHANGE || 'settings_change', {
                    before: oldSettings,
                    after: this.settings
                }, '設定インポート');
            }
            
            // 設定適用
            this.applyHighDpiSetting();
            this.setupDependentSystems();
            
            // 保存
            if (this.isAutoSaveEnabled()) {
                this.saveSettings(true);
            }
            
            console.log('📥 設定インポート完了');
            return true;
            
        } catch (error) {
            console.error('❌ 設定インポートエラー:', error);
            return false;
        }
    }
    
    // ==== クリーンアップ ====
    
    destroy() {
        console.log('⚙️ SettingsManager破棄開始');
        
        // 最終保存
        if (this.isAutoSaveEnabled() && !this.isSaving) {
            this.saveSettings(true);
        }
        
        // タイマーのクリーンアップ
        if (this.autoSaveTimeout) {
            clearTimeout(this.autoSaveTimeout);
            this.autoSaveTimeout = null;
        }
        
        // ショートカット管理の破棄
        if (this.shortcutManager) {
            this.shortcutManager.destroy();
            this.shortcutManager = null;
        }
        
        // イベントハンドラーのクリーンアップ
        this.eventHandlers.clear();
        
        // 参照のクリア
        this.app = null;
        this.toolsSystem = null;
        this.uiManager = null;
        this.historyManager = null;
        this.settings = null;
        this.originalSettings = null;
        
        console.log('✅ SettingsManager破棄完了');
    }
}

// ==== 設定復元ユーティリティ ====
class SettingsRestore {
    /**
     * 設定変更を復元
     */
    static restoreSettingChange(settingsManager, changeData, direction) {
        if (!settingsManager || !changeData) return false;
        
        try {
            if (changeData.key) {
                // 単一設定の復元
                const targetValue = direction === 'undo' ? changeData.before : changeData.after;
                return settingsManager.setSetting(changeData.key, targetValue, false);
            } else if (changeData.changes) {
                // 複数設定の復元
                const updates = {};
                for (const [key, change] of Object.entries(changeData.changes)) {
                    updates[key] = direction === 'undo' ? change.before : change.after;
                }
                return settingsManager.updateSettings(updates, false);
            }
            
            return false;
        } catch (error) {
            console.error('❌ 設定復元エラー:', error);
            return false;
        }
    }
}

// ==== グローバルエクスポート ====
if (typeof window !== 'undefined') {
    window.SettingsManager = SettingsManager;
    window.ShortcutManager = ShortcutManager;
    window.SettingsRestore = SettingsRestore;
    window.SETTINGS_CONFIG = SETTINGS_CONFIG;
    window.SETTING_TYPES = SETTING_TYPES;
    window.DEFAULT_SETTINGS = DEFAULT_SETTINGS;
    window.SHORTCUT_KEYS = SHORTCUT_KEYS;
    window.SETTINGS_EVENTS = SETTINGS_EVENTS;
    
    console.log('⚙️ settings-manager.js 読み込み完了');
    console.log('📝 利用可能クラス: SettingsManager, ShortcutManager, SettingsRestore');
    console.log('⚙️ 設定項目: SETTING_TYPES, DEFAULT_SETTINGS');
    console.log('⌨️ ショートカット: SHORTCUT_KEYS');
    console.log('🎯 実装機能:');
    console.log('  - P: ペンツール切り替え');
    console.log('  - P + [: 前のプリセット');
    console.log('  - P + ]: 次のプリセット'); 
    console.log('  - DEL: キャンバスクリア');
    console.log('  - 高DPI設定の動的切り替え');
    console.log('  - 設定の永続化（LocalStorage）');
    console.log('  - 設定変更の履歴記録');
}

// ES6 module export (将来のTypeScript移行用)
// export { 
//     SettingsManager, 
//     ShortcutManager,
//     SettingsRestore,
//     SETTINGS_CONFIG, 
//     SETTING_TYPES, 
//     DEFAULT_SETTINGS,
//     SHORTCUT_KEYS,
//     SETTINGS_EVENTS
// };