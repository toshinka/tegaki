/**
 * ⚙️ SettingsManager - 設定統括制御  
 * 責務:
 * - アプリ設定管理
 * - ユーザー設定保存
 * - ショートカット管理
 * - 高DPI対応
 * - 既存配色・レイアウト保持
 * 
 * 🎯 AI_WORK_SCOPE: 設定管理専用ファイル
 * 🎯 DEPENDENCIES: app-core.js, lodash（オプション）
 * 📋 SETTINGS_PLAN: 既存UI配色・レイアウト完全保持
 */

class SettingsManager {
    constructor(appCore) {
        this.appCore = appCore;
        this.extensions = appCore.extensions;
        this.isInitialized = false;
        
        // デフォルト設定（既存の値を保持）
        this.settings = {
            // ツール設定（既存UIの値と一致）
            pen: {
                size: 16,
                opacity: 85, // パーセント値
                pressure: 50, // パーセント値
                smoothing: 30, // パーセント値
                color: '#800000', // ふたば色
                pressureSensitivity: true,
                edgeSmoothing: false,
                gpuAcceleration: true
            },
            
            eraser: {
                size: 20,
                opacity: 100,
                pressure: 0,
                smoothing: 10
            },
            
            // キャンバス設定
            canvas: {
                width: 400,
                height: 400,
                backgroundColor: '#ffffee', // futaba-background
                showGrid: true,
                gridSize: 20,
                gridColor: '#f0e0d6', // futaba-cream
                gridOpacity: 0.5
            },
            
            // UI設定
            ui: {
                theme: 'futaba', // ふたば☆ちゃんねるテーマ
                sidebarWidth: 50,
                statusBarVisible: true,
                popupAnimations: true,
                tooltipsEnabled: true
            },
            
            // パフォーマンス設定
            performance: {
                targetFPS: 60,
                maxFPS: 60,
                enableFilters: true,
                gpuAcceleration: true,
                resolution: window.devicePixelRatio || 1,
                antialias: true
            },
            
            // 履歴・メモリ設定
            memory: {
                maxHistorySteps: 50,
                autoCleanup: true,
                memoryCheckInterval: 5000,
                compressionEnabled: true
            },
            
            // ショートカット設定
            shortcuts: {
                pen: 'p',
                eraser: 'e',
                brush: 'b',
                undo: 'ctrl+z',
                redo: 'ctrl+y',
                resetView: 'escape',
                centerCanvas: 'home',
                resetZoom: 'ctrl+0'
            }
        };
        
        // 設定変更リスナー
        this.listeners = new Map();
        
        // ローカルストレージキー
        this.storageKey = 'tegaki-phase1-settings';
        
        // デバウンス保存タイマー
        this.saveTimer = null;
        this.saveDelay = 1000; // 1秒遅延
    }
    
    async init() {
        console.log('⚙️ SettingsManager 初期化開始...');
        
        try {
            await this.loadSettings();
            await this.applySettings();
            await this.setupEventHandlers();
            await this.detectSystemCapabilities();
            
            this.isInitialized = true;
            console.log('✅ SettingsManager 初期化完了');
        } catch (error) {
            console.error('❌ SettingsManager 初期化失敗:', error);
            throw error;
        }
    }
    
    async loadSettings() {
        try {
            const stored = localStorage.getItem(this.storageKey);
            if (stored) {
                const loaded = JSON.parse(stored);
                this.settings = this.deepMerge(this.settings, loaded);
                console.log('📂 設定読み込み完了');
            }
        } catch (err) {
            console.warn('⚠️ 設定読み込み失敗（デフォルト値使用）:', err);
        }
    }
    
    async saveSettings() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.settings));
            console.log('💾 設定保存完了');
        } catch (err) {
            console.warn('⚠️ 設定保存失敗:', err);
        }
    }
    
    async applySettings() {
        // PixiJS アプリケーション設定
        await this.applyPixiSettings();
        
        // UI設定適用
        await this.applyUISettings();
        
        // パフォーマンス設定適用
        await this.applyPerformanceSettings();
        
        // キャンバス設定適用
        await this.applyCanvasSettings();
    }
    
    async applyPixiSettings() {
        const app = this.appCore.app;
        if (!app) return;
        
        const perfSettings = this.settings.performance;
        
        // 高DPI対応
        if (perfSettings.resolution !== app.renderer.resolution) {
            console.log(`📱 解像度設定: ${perfSettings.resolution}`);
            // Note: 解像度変更は初期化時のみ有効
        }
        
        // FPS制限
        if (perfSettings.targetFPS !== 60) {
            app.ticker.maxFPS = perfSettings.targetFPS;
            console.log(`🎯 FPS制限: ${perfSettings.targetFPS}`);
        }
        
        // アンチエイリアス設定
        if (app.renderer.options) {
            app.renderer.options.antialias = perfSettings.antialias;
        }
    }
    
    async applyUISettings() {
        const uiSettings = this.settings.ui;
        
        // ステータスバー表示切替
        const statusPanel = document.querySelector('.status-panel');
        if (statusPanel) {
            statusPanel.style.display = uiSettings.statusBarVisible ? 'flex' : 'none';
        }
        
        // ポップアップアニメーション設定
        if (!uiSettings.popupAnimations) {
            const style = document.createElement('style');
            style.textContent = '.popup-panel.show { animation: none !important; }';
            document.head.appendChild(style);
        }
        
        console.log('🎨 UI設定適用完了');
    }
    
    async applyPerformanceSettings() {
        // GPU加速設定（Manager連携）
        this.emit('performance-settings-changed', {
            gpuAcceleration: this.settings.performance.gpuAcceleration,
            enableFilters: this.settings.performance.enableFilters
        });
    }
    
    async applyCanvasSettings() {
        // キャンバス設定をCanvasManagerに通知
        const canvasManager = this.appCore.getManager('canvas');
        if (canvasManager && canvasManager.isInitialized) {
            const canvasSettings = this.settings.canvas;
            canvasManager.setCanvasSize(canvasSettings.width, canvasSettings.height);
        }
    }
    
    async setupEventHandlers() {
        // ウィンドウリサイズ時の設定更新
        window.addEventListener('resize', () => {
            this.updateDisplaySettings();
        });
        
        // ページ離脱時の設定保存
        window.addEventListener('beforeunload', () => {
            this.saveSettings();
        });
    }
    
    async detectSystemCapabilities() {
        // システム機能検出
        const capabilities = {
            highDPI: window.devicePixelRatio > 1,
            webGL: this.appCore.app.renderer.type === PIXI.RENDERER_TYPE.WEBGL,
            touchSupport: 'ontouchstart' in window,
            performanceMemory: 'memory' in performance,
            hardwareConcurrency: navigator.hardwareConcurrency || 1
        };
        
        // 自動最適化
        if (capabilities.highDPI && this.settings.performance.resolution < 2) {
            this.set('performance.resolution', Math.min(2, window.devicePixelRatio));
        }
        
        if (capabilities.hardwareConcurrency < 4 && this.settings.performance.targetFPS > 30) {
            console.log('⚡ 低スペック端末検出: FPS制限を30に調整');
            this.set('performance.targetFPS', 30);
        }
        
        console.log('🔍 システム機能検出完了:', capabilities);
    }
    
    updateDisplaySettings() {
        // 画面サイズ変更に応じた設定更新
        const width = window.innerWidth;
        const height = window.innerHeight;
        
        // 小画面でのUI調整
        if (width < 768) {
            this.set('ui.sidebarWidth', 40);
        } else {
            this.set('ui.sidebarWidth', 50);
        }
    }
    
    // 設定取得（ネストパス対応）
    get(keyPath) {
        if (this.extensions.isAvailable('Lodash')) {
            return this.extensions.getExtension('Lodash')._.get(this.settings, keyPath);
        } else {
            return this.getNestedValue(this.settings, keyPath);
        }
    }
    
    // 設定変更（ネストパス対応）
    set(keyPath, value) {
        const oldValue = this.get(keyPath);
        
        if (this.extensions.isAvailable('Lodash')) {
            this.extensions.getExtension('Lodash')._.set(this.settings, keyPath, value);
        } else {
            this.setNestedValue(this.settings, keyPath, value);
        }
        
        // 変更通知
        this.emit('setting-changed', { keyPath, oldValue, newValue: value });
        
        // 特定設定の即座適用
        this.applySpecificSetting(keyPath, value);
        
        // デバウンス保存
        this.debouncedSave();
        
        console.log(`⚙️ 設定変更: ${keyPath} = ${value}`);
    }
    
    // 複数設定一括変更
    setBatch(settings) {
        const changes = [];
        
        for (const [keyPath, value] of Object.entries(settings)) {
            const oldValue = this.get(keyPath);
            this.setNestedValue(this.settings, keyPath, value);
            changes.push({ keyPath, oldValue, newValue: value });
        }
        
        // 一括変更通知
        this.emit('settings-batch-changed', changes);
        
        // 設定再適用
        this.applySettings();
        
        // 保存
        this.debouncedSave();
        
        console.log('⚙️ 設定一括変更:', changes.length + '項目');
    }
    
    applySpecificSetting(keyPath, value) {
        // 特定設定の即座適用
        switch (keyPath) {
            case 'performance.targetFPS':
                if (this.appCore.app) {
                    this.appCore.app.ticker.maxFPS = value;
                }
                break;
                
            case 'ui.statusBarVisible':
                const statusPanel = document.querySelector('.status-panel');
                if (statusPanel) {
                    statusPanel.style.display = value ? 'flex' : 'none';
                }
                break;
                
            case 'canvas.width':
            case 'canvas.height':
                const canvasManager = this.appCore.getManager('canvas');
                if (canvasManager && canvasManager.isInitialized) {
                    canvasManager.setCanvasSize(
                        this.get('canvas.width'),
                        this.get('canvas.height')
                    );
                }
                break;
        }
    }
    
    debouncedSave() {
        if (this.saveTimer) {
            clearTimeout(this.saveTimer);
        }
        
        this.saveTimer = setTimeout(() => {
            this.saveSettings();
        }, this.saveDelay);
    }
    
    // ツール設定の専用メソッド
    getToolSettings(toolName) {
        return this.get(`${toolName}`) || {};
    }
    
    setToolSettings(toolName, settings) {
        const currentSettings = this.getToolSettings(toolName);
        const newSettings = { ...currentSettings, ...settings };
        this.set(toolName, newSettings);
        
        // ToolManagerに通知
        const toolManager = this.appCore.getManager('tool');
        if (toolManager && toolManager.isInitialized) {
            toolManager.updateToolSettings(toolName, newSettings);
        }
    }
    
    // テーマ設定
    setTheme(themeName) {
        this.set('ui.theme', themeName);
        this.applyTheme(themeName);
    }
    
    applyTheme(themeName) {
        // 現在はfutabaテーマのみ（既存CSS保持）
        document.body.className = `theme-${themeName}`;
        console.log(`🎨 テーマ適用: ${themeName}`);
    }
    
    // 設定リセット
    resetToDefaults() {
        // バックアップ保存
        const backup = JSON.stringify(this.settings);
        localStorage.setItem(this.storageKey + '-backup', backup);
        
        // デフォルト設定復元
        this.settings = this.getDefaultSettings();
        this.applySettings();
        this.saveSettings();
        
        console.log('🔄 設定をデフォルトにリセット（バックアップ保存済み）');
    }
    
    restoreFromBackup() {
        try {
            const backup = localStorage.getItem(this.storageKey + '-backup');
            if (backup) {
                this.settings = JSON.parse(backup);
                this.applySettings();
                this.saveSettings();
                console.log('📂 設定をバックアップから復元');
            }
        } catch (err) {
            console.warn('⚠️ バックアップ復元失敗:', err);
        }
    }
    
    getDefaultSettings() {
        // デフォルト設定のディープコピー
        return JSON.parse(JSON.stringify({
            pen: {
                size: 16,
                opacity: 85,
                pressure: 50,
                smoothing: 30,
                color: '#800000',
                pressureSensitivity: true,
                edgeSmoothing: false,
                gpuAcceleration: true
            },
            eraser: {
                size: 20,
                opacity: 100,
                pressure: 0,
                smoothing: 10
            },
            canvas: {
                width: 400,
                height: 400,
                backgroundColor: '#ffffee',
                showGrid: true,
                gridSize: 20,
                gridColor: '#f0e0d6',
                gridOpacity: 0.5
            },
            ui: {
                theme: 'futaba',
                sidebarWidth: 50,
                statusBarVisible: true,
                popupAnimations: true,
                tooltipsEnabled: true
            },
            performance: {
                targetFPS: 60,
                maxFPS: 60,
                enableFilters: true,
                gpuAcceleration: true,
                resolution: window.devicePixelRatio || 1,
                antialias: true
            },
            memory: {
                maxHistorySteps: 50,
                autoCleanup: true,
                memoryCheckInterval: 5000,
                compressionEnabled: true
            },
            shortcuts: {
                pen: 'p',
                eraser: 'e',
                brush: 'b',
                undo: 'ctrl+z',
                redo: 'ctrl+y',
                resetView: 'escape',
                centerCanvas: 'home',
                resetZoom: 'ctrl+0'
            }
        }));
    }
    
    // イベントシステム
    on(eventName, callback) {
        if (!this.listeners.has(eventName)) {
            this.listeners.set(eventName, []);
        }
        this.listeners.get(eventName).push(callback);
    }
    
    off(eventName, callback) {
        const callbacks = this.listeners.get(eventName);
        if (callbacks) {
            const index = callbacks.indexOf(callback);
            if (index !== -1) {
                callbacks.splice(index, 1);
            }
        }
    }
    
    emit(eventName, data) {
        const callbacks = this.listeners.get(eventName);
        if (callbacks) {
            callbacks.forEach(callback => {
                try {
                    callback(data);
                } catch (err) {
                    console.error(`❌ 設定イベントエラー (${eventName}):`, err);
                }
            });
        }
    }
    
    // ユーティリティメソッド
    getNestedValue(obj, path) {
        return path.split('.').reduce((current, key) => current?.[key], obj);
    }
    
    setNestedValue(obj, path, value) {
        const keys = path.split('.');
        const lastKey = keys.pop();
        const target = keys.reduce((current, key) => {
            if (!current[key]) current[key] = {};
            return current[key];
        }, obj);
        target[lastKey] = value;
    }
    
    deepMerge(target, source) {
        if (this.extensions.isAvailable('Lodash')) {
            return this.extensions.getExtension('Lodash')._.merge({}, target, source);
        }
        
        // 簡易ディープマージ
        const result = { ...target };
        for (const key in source) {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                result[key] = this.deepMerge(result[key] || {}, source[key]);
            } else {
                result[key] = source[key];
            }
        }
        return result;
    }
    
    // 開発用デバッグメソッド
    debugSettings() {
        console.group('⚙️ SettingsManager Debug Info');
        console.log('Current Settings:', this.settings);
        console.log('Listeners:', Array.from(this.listeners.keys()));
        console.log('Extensions Available:', Object.keys(this.extensions.extensions || {}));
        console.groupEnd();
        
        return {
            settings: this.settings,
            listeners: Array.from(this.listeners.keys()),
            storageKey: this.storageKey,
            isInitialized: this.isInitialized
        };
    }
    
    exportSettings() {
        const exportData = {
            version: '1.0',
            timestamp: new Date().toISOString(),
            settings: this.settings
        };
        
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `tegaki-settings-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        
        URL.revokeObjectURL(url);
        console.log('📤 設定エクスポート完了');
    }
    
    async importSettings(file) {
        try {
            const text = await file.text();
            const importData = JSON.parse(text);
            
            if (importData.settings) {
                this.settings = this.deepMerge(this.getDefaultSettings(), importData.settings);
                await this.applySettings();
                this.saveSettings();
                
                console.log('📥 設定インポート完了');
                return true;
            }
        } catch (err) {
            console.error('❌ 設定インポート失敗:', err);
            return false;
        }
    }
}