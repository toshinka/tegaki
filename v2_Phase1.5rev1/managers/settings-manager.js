/**
 * 🎨 Tegaki Project - Settings Manager v12
 * 🎯 責務: 設定UI管理・永続化・プリセット管理
 * 📐 依存: EventBus, ConfigManager
 * 🔧 Phase: STEP3 - 機能拡張
 */

class SettingsManager {
    constructor() {
        this.version = 'v12-step3';
        this.validateDependencies();
        
        // 設定UI要素
        this.settingsPanel = null;
        this.settingsButton = null;
        
        // 設定データ
        this.settings = {
            pen: {
                size: 16,
                opacity: 85,
                pressure: 50,
                smoothing: 30
            },
            eraser: {
                size: 20,
                opacity: 100
            },
            canvas: {
                backgroundColor: '#f0e0d6'
            },
            ui: {
                showToolTips: true,
                compactMode: false
            }
        };
        
        // プリセット管理
        this.presets = new Map();
        
        // 永続化設定
        this.persistence = {
            enabled: true,
            storageKey: 'tegaki_settings'
        };
        
        console.log('⚙️ SettingsManager v12 構築完了');
    }
    
    /**
     * 依存関係確認
     */
    validateDependencies() {
        const required = ['EventBus', 'ConfigManager'];
        const missing = required.filter(dep => !window[dep]);
        
        if (missing.length > 0) {
            throw new Error(`SettingsManager依存関係エラー: ${missing.join(', ')}`);
        }
        
        console.log('✅ SettingsManager依存関係確認完了');
    }
    
    /**
     * 初期化
     */
    initialize() {
        console.log('⚙️ SettingsManager初期化開始...');
        
        try {
            // 設定読み込み
            this.loadSettings();
            
            // UI作成
            this.createSettingsUI();
            
            // イベント設定
            this.setupEventHandlers();
            
            // 内蔵プリセット登録
            this.registerBuiltinPresets();
            
            console.log('✅ SettingsManager初期化完了');
            return this;
            
        } catch (error) {
            console.error('❌ SettingsManager初期化エラー:', error);
            if (window.ErrorManager) {
                window.ErrorManager.showError('init-error', `SettingsManager初期化失敗: ${error.message}`);
            }
            throw error;
        }
    }
    
    /**
     * 設定UI作成
     */
    createSettingsUI() {
        // 設定ボタン作成
        this.createSettingsButton();
        
        // 設定パネル作成
        this.createSettingsPanel();
        
        console.log('🎨 設定UI作成完了');
    }
    
    /**
     * 設定ボタン作成
     */
    createSettingsButton() {
        this.settingsButton = document.createElement('button');
        this.settingsButton.id = 'settings-button';
        this.settingsButton.className = 'ui-button settings-button';
        this.settingsButton.innerHTML = '⚙️ 設定';
        this.settingsButton.title = '設定を開く';
        
        // クリックイベント
        this.settingsButton.addEventListener('click', () => {
            this.toggleSettingsPanel();
        });
        
        // UI要素を配置
        const toolbar = document.querySelector('.toolbar');
        if (toolbar) {
            toolbar.appendChild(this.settingsButton);
        } else {
            document.body.appendChild(this.settingsButton);
        }
    }
    
    /**
     * 設定パネル作成
     */
    createSettingsPanel() {
        this.settingsPanel = document.createElement('div');
        this.settingsPanel.id = 'settings-panel';
        this.settingsPanel.className = 'settings-panel';
        this.settingsPanel.style.display = 'none';
        
        this.settingsPanel.innerHTML = `
            <div class="settings-header">
                <h3>⚙️ 設定</h3>
                <button class="close-button" id="settings-close">×</button>
            </div>
            
            <div class="settings-content">
                <div class="settings-section">
                    <h4>🖊️ ペン設定</h4>
                    <div class="setting-item">
                        <label>サイズ: <span id="pen-size-value">${this.settings.pen.size}</span></label>
                        <input type="range" id="pen-size" min="1" max="50" value="${this.settings.pen.size}">
                    </div>
                    <div class="setting-item">
                        <label>不透明度: <span id="pen-opacity-value">${this.settings.pen.opacity}%</span></label>
                        <input type="range" id="pen-opacity" min="1" max="100" value="${this.settings.pen.opacity}">
                    </div>
                </div>
                
                <div class="settings-section">
                    <h4>🧽 消しゴム設定</h4>
                    <div class="setting-item">
                        <label>サイズ: <span id="eraser-size-value">${this.settings.eraser.size}</span></label>
                        <input type="range" id="eraser-size" min="1" max="100" value="${this.settings.eraser.size}">
                    </div>
                </div>
                
                <div class="settings-section">
                    <h4>🎨 キャンバス設定</h4>
                    <div class="setting-item">
                        <label>背景色:</label>
                        <input type="color" id="canvas-bg-color" value="${this.settings.canvas.backgroundColor}">
                    </div>
                </div>
                
                <div class="settings-section">
                    <h4>🔧 プリセット</h4>
                    <div class="preset-buttons">
                        <button class="preset-button" data-preset="fine">細ペン</button>
                        <button class="preset-button" data-preset="thick">太ペン</button>
                        <button class="preset-button" data-preset="watercolor">水彩風</button>
                    </div>
                </div>
                
                <div class="settings-actions">
                    <button id="settings-reset" class="action-button">🔄 リセット</button>
                    <button id="settings-save" class="action-button primary">💾 保存</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(this.settingsPanel);
        
        // パネル内イベント設定
        this.setupPanelEvents();
    }
    
    /**
     * パネル内イベント設定
     */
    setupPanelEvents() {
        // 閉じるボタン
        const closeButton = this.settingsPanel.querySelector('#settings-close');
        closeButton.addEventListener('click', () => {
            this.hideSettingsPanel();
        });
        
        // スライダーイベント
        this.setupSliderEvents();
        
        // プリセットボタンイベント
        this.setupPresetEvents();
        
        // アクションボタンイベント
        this.setupActionEvents();
    }
    
    /**
     * スライダーイベント設定
     */
    setupSliderEvents() {
        // ペンサイズ
        const penSizeSlider = this.settingsPanel.querySelector('#pen-size');
        const penSizeValue = this.settingsPanel.querySelector('#pen-size-value');
        
        penSizeSlider.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            penSizeValue.textContent = value;
            this.setSetting('pen.size', value);
        });
        
        // ペン不透明度
        const penOpacitySlider = this.settingsPanel.querySelector('#pen-opacity');
        const penOpacityValue = this.settingsPanel.querySelector('#pen-opacity-value');
        
        penOpacitySlider.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            penOpacityValue.textContent = value + '%';
            this.setSetting('pen.opacity', value);
        });
        
        // 消しゴムサイズ
        const eraserSizeSlider = this.settingsPanel.querySelector('#eraser-size');
        const eraserSizeValue = this.settingsPanel.querySelector('#eraser-size-value');
        
        eraserSizeSlider.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            eraserSizeValue.textContent = value;
            this.setSetting('eraser.size', value);
        });
        
        // キャンバス背景色
        const canvasBgColor = this.settingsPanel.querySelector('#canvas-bg-color');
        canvasBgColor.addEventListener('input', (e) => {
            this.setSetting('canvas.backgroundColor', e.target.value);
        });
    }
    
    /**
     * プリセットイベント設定
     */
    setupPresetEvents() {
        const presetButtons = this.settingsPanel.querySelectorAll('.preset-button');
        
        presetButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const presetId = e.target.dataset.preset;
                this.applyPreset(presetId);
            });
        });
    }
    
    /**
     * アクションボタンイベント設定
     */
    setupActionEvents() {
        // リセットボタン
        const resetButton = this.settingsPanel.querySelector('#settings-reset');
        resetButton.addEventListener('click', () => {
            this.resetSettings();
        });
        
        // 保存ボタン
        const saveButton = this.settingsPanel.querySelector('#settings-save');
        saveButton.addEventListener('click', () => {
            this.saveSettings();
        });
    }
    
    /**
     * イベントハンドラー設定
     */
    setupEventHandlers() {
        if (!window.EventBus) return;
        
        // 設定変更通知を受け取る
        window.EventBus.on('setting:change', (data) => {
            console.log('⚙️ 設定変更受信:', data);
        });
        
        console.log('📡 SettingsManager イベントハンドラー設定完了');
    }
    
    /**
     * 内蔵プリセット登録
     */
    registerBuiltinPresets() {
        // 細ペンプリセット
        this.presets.set('fine', {
            name: '細ペン',
            settings: {
                pen: { size: 2, opacity: 90 }
            }
        });
        
        // 太ペンプリセット
        this.presets.set('thick', {
            name: '太ペン',
            settings: {
                pen: { size: 32, opacity: 80 }
            }
        });
        
        // 水彩風プリセット
        this.presets.set('watercolor', {
            name: '水彩風',
            settings: {
                pen: { size: 20, opacity: 40, smoothing: 60 }
            }
        });
        
        console.log('🎛️ 内蔵プリセット登録完了:', this.presets.size + '個');
    }
    
    /**
     * 設定パネル表示切替
     */
    toggleSettingsPanel() {
        if (this.settingsPanel.style.display === 'none') {
            this.showSettingsPanel();
        } else {
            this.hideSettingsPanel();
        }
    }
    
    /**
     * 設定パネル表示
     */
    showSettingsPanel() {
        this.settingsPanel.style.display = 'block';
        
        // パネル位置調整
        this.positionSettingsPanel();
        
        // EventBus通知
        if (window.EventBus) {
            window.EventBus.emit('settings:panel-shown');
        }
        
        console.log('⚙️ 設定パネル表示');
    }
    
    /**
     * 設定パネル非表示
     */
    hideSettingsPanel() {
        this.settingsPanel.style.display = 'none';
        
        // EventBus通知
        if (window.EventBus) {
            window.EventBus.emit('settings:panel-hidden');
        }
        
        console.log('⚙️ 設定パネル非表示');
    }
    
    /**
     * パネル位置調整
     */
    positionSettingsPanel() {
        const rect = this.settingsButton.getBoundingClientRect();
        
        this.settingsPanel.style.position = 'fixed';
        this.settingsPanel.style.top = (rect.bottom + 10) + 'px';
        this.settingsPanel.style.left = rect.left + 'px';
        this.settingsPanel.style.zIndex = '1000';
    }
    
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
            
            // UI更新
            this.updateSettingUI(path, value);
            
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
            window.EventBus.emit('setting:changed', {
                path: path,
                oldValue: oldValue,
                newValue: newValue,
                timestamp: Date.now()
            });
        }
    }
    
    /**
     * 設定UI更新
     */
    updateSettingUI(path, value) {
        if (!this.settingsPanel) return;
        
        try {
            switch (path) {
                case 'pen.size':
                    const penSizeSlider = this.settingsPanel.querySelector('#pen-size');
                    const penSizeValue = this.settingsPanel.querySelector('#pen-size-value');
                    if (penSizeSlider) penSizeSlider.value = value;
                    if (penSizeValue) penSizeValue.textContent = value;
                    break;
                    
                case 'pen.opacity':
                    const penOpacitySlider = this.settingsPanel.querySelector('#pen-opacity');
                    const penOpacityValue = this.settingsPanel.querySelector('#pen-opacity-value');
                    if (penOpacitySlider) penOpacitySlider.value = value;
                    if (penOpacityValue) penOpacityValue.textContent = value + '%';
                    break;
                    
                case 'eraser.size':
                    const eraserSizeSlider = this.settingsPanel.querySelector('#eraser-size');
                    const eraserSizeValue = this.settingsPanel.querySelector('#eraser-size-value');
                    if (eraserSizeSlider) eraserSizeSlider.value = value;
                    if (eraserSizeValue) eraserSizeValue.textContent = value;
                    break;
                    
                case 'canvas.backgroundColor':
                    const canvasBgColor = this.settingsPanel.querySelector('#canvas-bg-color');
                    if (canvasBgColor) canvasBgColor.value = value;
                    break;
            }
            
        } catch (error) {
            console.warn('⚠️ 設定UI更新で問題発生:', error.message);
        }
    }
    
    /**
     * プリセット適用
     */
    applyPreset(presetId) {
        const preset = this.presets.get(presetId);
        if (!preset) {
            console.warn('⚠️ プリセットが見つかりません:', presetId);
            return false;
        }
        
        try {
            console.log('🎛️ プリセット適用:', preset.name);
            
            // プリセット設定を適用
            this.mergeSettings(preset.settings);
            
            // UI更新
            this.updateAllSettingUI();
            
            // EventBus通知
            if (window.EventBus) {
                window.EventBus.emit('settings:preset-applied', {
                    presetId,
                    presetName: preset.name,
                    settings: preset.settings
                });
            }
            
            return true;
            
        } catch (error) {
            console.error('❌ プリセット適用エラー:', error);
            return false;
        }
    }
    
    /**
     * 設定マージ
     */
    mergeSettings(newSettings) {
        const merge = (target, source) => {
            for (const key in source) {
                if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                    if (!target[key]) target[key] = {};
                    merge(target[key], source[key]);
                } else {
                    target[key] = source[key];
                }
            }
        };
        
        merge(this.settings, newSettings);
    }
    
    /**
     * 全設定UI更新
     */
    updateAllSettingUI() {
        this.updateSettingUI('pen.size', this.settings.pen.size);
        this.updateSettingUI('pen.opacity', this.settings.pen.opacity);
        this.updateSettingUI('eraser.size', this.settings.eraser.size);
        this.updateSettingUI('canvas.backgroundColor', this.settings.canvas.backgroundColor);
    }
    
    /**
     * 設定リセット
     */
    resetSettings() {
        if (!confirm('設定をリセットしますか？')) {
            return;
        }
        
        try {
            // デフォルト設定に戻す
            this.settings = {
                pen: {
                    size: 16,
                    opacity: 85,
                    pressure: 50,
                    smoothing: 30
                },
                eraser: {
                    size: 20,
                    opacity: 100
                },
                canvas: {
                    backgroundColor: '#f0e0d6'
                },
                ui: {
                    showToolTips: true,
                    compactMode: false
                }
            };
            
            // UI更新
            this.updateAllSettingUI();
            
            // EventBus通知
            if (window.EventBus) {
                window.EventBus.emit('settings:reset');
            }
            
            console.log('🔄 設定リセット完了');
            
        } catch (error) {
            console.error('❌ 設定リセットエラー:', error);
        }
    }
    
    /**
     * 設定保存
     */
    saveSettings() {
        if (!this.persistence.enabled) {
            console.log('💾 設定保存が無効です');
            return false;
        }
        
        try {
            const settingsData = {
                version: this.version,
                timestamp: Date.now(),
                settings: this.settings
            };
            
            localStorage.setItem(this.persistence.storageKey, JSON.stringify(settingsData));
            
            // EventBus通知
            if (window.EventBus) {
                window.EventBus.emit('settings:saved');
            }
            
            console.log('💾 設定保存完了');
            return true;
            
        } catch (error) {
            console.error('❌ 設定保存エラー:', error);
            return false;
        }
    }
    
    /**
     * 設定読み込み
     */
    loadSettings() {
        if (!this.persistence.enabled) {
            console.log('📖 設定読み込みが無効です');
            return false;
        }
        
        try {
            const saved = localStorage.getItem(this.persistence.storageKey);
            if (!saved) {
                console.log('📖 保存された設定が見つかりません');
                return false;
            }
            
            const settingsData = JSON.parse(saved);
            
            // バージョン確認
            if (settingsData.version !== this.version) {
                console.log('📖 設定バージョンが異なります:', settingsData.version, '->', this.version);
            }
            
            // 設定マージ
            if (settingsData.settings) {
                this.mergeSettings(settingsData.settings);
            }
            
            console.log('📖 設定読み込み完了');
            return true;
            
        } catch (error) {
            console.error('❌ 設定読み込みエラー:', error);
            return false;
        }
    }
    
    /**
     * 状態取得
     */
    getStatus() {
        return {
            version: this.version,
            persistence: this.persistence,
            presetsCount: this.presets.size,
            settings: this.settings,
            panelVisible: this.settingsPanel ? (this.settingsPanel.style.display !== 'none') : false
        };
    }
    
    /**
     * デバッグ情報
     */
    getDebugInfo() {
        const status = this.getStatus();
        
        console.group('⚙️ SettingsManager デバッグ情報');
        console.log('📋 バージョン:', status.version);
        console.log('💾 永続化:', status.persistence);
        console.log('🎛️ プリセット数:', status.presetsCount);
        console.log('📊 現在設定:', status.settings);
        console.log('🎨 パネル表示:', status.panelVisible);
        console.groupEnd();
        
        return status;
    }
}

// グローバル公開
if (typeof window !== 'undefined') {
    window.SettingsManager = SettingsManager;
    console.log('✅ SettingsManager v12 グローバル公開完了');
}

console.log('⚙️ SettingsManager v12-step3 準備完了');
console.log('📋 STEP3実装: 設定UI・永続化・プリセット管理');
console.log('💡 使用例: const settingsManager = new window.SettingsManager(); settingsManager.initialize();');