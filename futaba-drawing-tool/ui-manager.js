/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1.4
 * UI管理システム - ui-manager.js（設定パネル対応版）
 * 
 * 責務: UIコンテナ管理・UIイベント処理・設定UI管理
 * 依存: app-core.js, drawing-tools.js, settings-manager.js
 * 
 * 修正内容:
 * 1. 設定パネルUIの追加
 * 2. SettingsManager 連携
 * 3. 設定ボタンの有効化
 * 4. 設定変更イベントの処理
 * 5. 高DPI切り替えUI
 */

// ==== UI設定定数（拡張版） ====
const UI_CONFIG = {
    // ポップアップ設定
    POPUP_ANIMATION_DURATION: 300,
    POPUP_MIN_WIDTH: 280,
    POPUP_MIN_HEIGHT: 350,
    
    // スライダー設定
    SLIDER_UPDATE_THROTTLE: 16, // 60fps
    SLIDER_DEBUG: false, // 本番環境では false
    
    // ドラッグ設定
    DRAG_THRESHOLD: 3,
    
    // プリセット設定
    SIZE_PRESETS: [1, 2, 4, 8, 16, 32],
    SIZE_PREVIEW_MIN: 0.5,
    SIZE_PREVIEW_MAX: 20,
    
    // 設定パネル設定（新規追加）
    SETTINGS_SAVE_DELAY: 1000 // 設定変更後の自動保存遅延
};

// ==== UIイベント定数（拡張版） ====
const UI_EVENTS = {
    TOOL_SELECTED: 'ui:tool_selected',
    POPUP_OPENED: 'ui:popup_opened',
    POPUP_CLOSED: 'ui:popup_closed',
    SETTING_CHANGED: 'ui:setting_changed',
    COORDINATES_UPDATED: 'ui:coordinates_updated',
    // 設定関連イベント（新規追加）
    SETTINGS_PANEL_OPENED: 'ui:settings_panel_opened',
    SETTINGS_PANEL_CLOSED: 'ui:settings_panel_closed',
    HIGH_DPI_TOGGLED: 'ui:high_dpi_toggled'
};

// ==== スライダーコントローラー（変更なし）====
class SliderController {
    constructor(sliderId, min, max, initial, updateCallback) {
        this.sliderId = sliderId;
        this.min = min;
        this.max = max;
        this.value = initial;
        this.updateCallback = updateCallback;
        this.isDragging = false;
        this.throttleTimeout = null;
        
        this.elements = this.findElements();
        if (this.elements.container) {
            this.setupEventListeners();
            this.updateDisplay();
        }
    }
    
    /**
     * DOM要素を検索（修正版：より確実な検索）
     */
    findElements() {
        const container = document.getElementById(this.sliderId);
        if (!container) {
            console.warn(`スライダー要素が見つかりません: ${this.sliderId}`);
            return {};
        }
        
        // より確実なvalueDisplay要素の検索
        const valueDisplay = this.findValueDisplayElement(container);
        
        const elements = {
            container,
            track: container.querySelector('.slider-track'),
            handle: container.querySelector('.slider-handle'),
            valueDisplay
        };
        
        // デバッグログ
        if (UI_CONFIG.SLIDER_DEBUG) {
            console.log(`[${this.sliderId}] 要素検索結果:`, {
                container: !!elements.container,
                track: !!elements.track,
                handle: !!elements.handle,
                valueDisplay: !!elements.valueDisplay
            });
        }
        
        return elements;
    }
    
    /**
     * valueDisplay要素を複数の方法で検索
     */
    findValueDisplayElement(container) {
        let valueDisplay = null;
        
        // 方法1: 親ノードから検索
        if (container.parentNode) {
            valueDisplay = container.parentNode.querySelector('.slider-value');
        }
        
        // 方法2: slider-controls内から検索
        if (!valueDisplay) {
            const controls = container.closest('.slider-controls');
            if (controls) {
                valueDisplay = controls.querySelector('.slider-value');
            }
        }
        
        // 方法3: slider-container内から検索
        if (!valueDisplay) {
            const sliderContainer = container.closest('.slider-container');
            if (sliderContainer) {
                valueDisplay = sliderContainer.querySelector('.slider-value');
            }
        }
        
        if (!valueDisplay) {
            console.warn(`[${this.sliderId}] .slider-value 要素が見つかりません`);
        }
        
        return valueDisplay;
    }
    
    setupEventListeners() {
        const { container } = this.elements;
        
        // マウスイベント
        container.addEventListener('mousedown', (e) => this.onMouseDown(e));
        document.addEventListener('mousemove', (e) => this.onMouseMove(e));
        document.addEventListener('mouseup', () => this.onMouseUp());
        
        // タッチイベント（将来実装）
        // container.addEventListener('touchstart', (e) => this.onTouchStart(e));
        // document.addEventListener('touchmove', (e) => this.onTouchMove(e));
        // document.addEventListener('touchend', () => this.onTouchEnd());
    }
    
    onMouseDown(event) {
        this.isDragging = true;
        this.updateValueFromPosition(event.clientX);
        event.preventDefault();
    }
    
    onMouseMove(event) {
        if (!this.isDragging) return;
        this.updateValueFromPosition(event.clientX);
    }
    
    onMouseUp() {
        this.isDragging = false;
    }
    
    updateValueFromPosition(clientX) {
        if (!this.elements.container) return;
        
        const rect = this.elements.container.getBoundingClientRect();
        const percentage = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        const newValue = this.min + percentage * (this.max - this.min);
        
        this.setValue(newValue);
    }
    
    /**
     * 値を設定（修正版：数値表示の確実な更新）
     */
    setValue(value, updateDisplay = true) {
        const oldValue = this.value;
        this.value = Math.max(this.min, Math.min(this.max, value));
        
        if (updateDisplay) {
            this.updateDisplay();
        }
        
        // 値が変更された場合のコールバック実行
        if (this.updateCallback && Math.abs(this.value - oldValue) > 0.001) {
            this.throttledCallback();
            // 数値表示も強制更新
            if (updateDisplay) {
                setTimeout(() => this.updateValueDisplay(), 10);
            }
        }
    }
    
    throttledCallback() {
        if (this.throttleTimeout) {
            clearTimeout(this.throttleTimeout);
        }
        
        this.throttleTimeout = setTimeout(() => {
            this.updateCallback(this.value);
            this.throttleTimeout = null;
        }, UI_CONFIG.SLIDER_UPDATE_THROTTLE);
    }
    
    /**
     * 表示更新（修正版：数値表示を分離）
     */
    updateDisplay() {
        if (!this.elements.track || !this.elements.handle) return;
        
        const percentage = ((this.value - this.min) / (this.max - this.min)) * 100;
        
        this.elements.track.style.width = percentage + '%';
        this.elements.handle.style.left = percentage + '%';
        
        // 数値表示の更新
        this.updateValueDisplay();
    }
    
    /**
     * 数値表示の確実な更新（新規追加）
     */
    updateValueDisplay() {
        if (!this.elements.valueDisplay || !this.updateCallback) return;
        
        try {
            const displayValue = this.updateCallback(this.value, true); // displayOnly = true
            
            if (typeof displayValue === 'string' && displayValue.trim()) {
                this.elements.valueDisplay.textContent = displayValue;
                this.elements.valueDisplay.style.display = 'block';
                this.elements.valueDisplay.style.visibility = 'visible';
                
                if (UI_CONFIG.SLIDER_DEBUG) {
                    console.log(`[${this.sliderId}] 数値表示更新: ${displayValue}`);
                }
            } else {
                // フォールバック: 基本的な数値表示
                this.elements.valueDisplay.textContent = this.value.toFixed(1);
                if (UI_CONFIG.SLIDER_DEBUG) {
                    console.warn(`[${this.sliderId}] フォールバック表示: ${this.value.toFixed(1)}`);
                }
            }
            
            // バリデーション: NaNやundefinedチェック
            const currentText = this.elements.valueDisplay.textContent;
            if (currentText.includes('NaN') || currentText.includes('undefined')) {
                this.elements.valueDisplay.textContent = this.value.toFixed(1);
                console.warn(`[${this.sliderId}] 不正な表示値を修正: ${currentText} -> ${this.value.toFixed(1)}`);
            }
            
        } catch (error) {
            // エラー時のフォールバック表示
            this.elements.valueDisplay.textContent = this.value.toFixed(1);
            console.error(`[${this.sliderId}] 数値表示更新エラー:`, error);
        }
    }
    
    adjustValue(delta) {
        this.setValue(this.value + delta);
    }
}

// ==== ポップアップマネージャー（設定パネル対応版） ====
class PopupManager {
    constructor() {
        this.activePopup = null;
        this.popups = new Map();
        this.setupGlobalListeners();
    }
    
    registerPopup(popupId) {
        const popup = document.getElementById(popupId);
        if (!popup) {
            console.warn(`ポップアップ要素が見つかりません: ${popupId}`);
            return false;
        }
        
        this.popups.set(popupId, {
            element: popup,
            isDraggable: popup.classList.contains('draggable')
        });
        
        if (popup.classList.contains('draggable')) {
            this.makeDraggable(popup);
        }
        
        return true;
    }
    
    showPopup(popupId) {
        const popupData = this.popups.get(popupId);
        if (!popupData) return false;
        
        // 他のポップアップを閉じる
        this.hideAllPopups();
        
        // ポップアップを表示
        popupData.element.classList.add('show');
        this.activePopup = popupId;
        
        console.log(`ポップアップ表示: ${popupId}`);
        return true;
    }
    
    hidePopup(popupId) {
        const popupData = this.popups.get(popupId);
        if (!popupData) return false;
        
        popupData.element.classList.remove('show');
        if (this.activePopup === popupId) {
            this.activePopup = null;
        }
        
        return true;
    }
    
    togglePopup(popupId) {
        const popupData = this.popups.get(popupId);
        if (!popupData) return false;
        
        const isVisible = popupData.element.classList.contains('show');
        return isVisible ? this.hidePopup(popupId) : this.showPopup(popupId);
    }
    
    hideAllPopups() {
        this.popups.forEach((popupData, popupId) => {
            popupData.element.classList.remove('show');
        });
        this.activePopup = null;
    }
    
    setupGlobalListeners() {
        // ポップアップ外クリックで閉じる
        document.addEventListener('click', (event) => {
            if (!event.target.closest('.popup-panel') && 
                !event.target.closest('.tool-button[data-popup]')) {
                this.hideAllPopups();
            }
        });
        
        // ESCキーでポップアップを閉じる
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && this.activePopup) {
                this.hideAllPopups();
            }
        });
    }
    
    makeDraggable(popup) {
        let isDragging = false;
        let dragOffset = { x: 0, y: 0 };
        
        popup.addEventListener('mousedown', (event) => {
            if (event.target === popup || event.target.closest('.popup-title')) {
                isDragging = true;
                popup.classList.add('dragging');
                
                const rect = popup.getBoundingClientRect();
                dragOffset.x = event.clientX - rect.left;
                dragOffset.y = event.clientY - rect.top;
                event.preventDefault();
            }
        });
        
        document.addEventListener('mousemove', (event) => {
            if (!isDragging) return;
            
            const x = Math.max(0, Math.min(
                event.clientX - dragOffset.x,
                window.innerWidth - popup.offsetWidth
            ));
            const y = Math.max(0, Math.min(
                event.clientY - dragOffset.y,
                window.innerHeight - popup.offsetHeight
            ));
            
            popup.style.left = x + 'px';
            popup.style.top = y + 'px';
        });
        
        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                popup.classList.remove('dragging');
            }
        });
    }
}

// ==== ステータスバー管理 ====
class StatusBarManager {
    constructor() {
        this.elements = this.findElements();
    }
    
    findElements() {
        return {
            canvasInfo: document.getElementById('canvas-info'),
            currentTool: document.getElementById('current-tool'),
            currentColor: document.getElementById('current-color'),
            coordinates: document.getElementById('coordinates'),
            pressureMonitor: document.getElementById('pressure-monitor'),
            fps: document.getElementById('fps'),
            gpuUsage: document.getElementById('gpu-usage'),
            memoryUsage: document.getElementById('memory-usage')
        };
    }
    
    updateCanvasInfo(width, height) {
        if (this.elements.canvasInfo) {
            this.elements.canvasInfo.textContent = `${width}×${height}px`;
        }
    }
    
    updateCurrentTool(toolName) {
        if (this.elements.currentTool) {
            const toolNames = {
                pen: 'ベクターペン',
                eraser: '消しゴム',
                fill: '塗りつぶし',
                select: '範囲選択'
            };
            this.elements.currentTool.textContent = toolNames[toolName] || toolName;
        }
    }
    
    updateCurrentColor(color) {
        if (this.elements.currentColor) {
            const colorStr = typeof color === 'number' ? 
                '#' + color.toString(16).padStart(6, '0') : color;
            this.elements.currentColor.textContent = colorStr;
        }
    }
    
    updateCoordinates(x, y) {
        if (this.elements.coordinates) {
            this.elements.coordinates.textContent = `x: ${Math.round(x)}, y: ${Math.round(y)}`;
        }
    }
    
    updatePressureMonitor(pressure) {
        if (this.elements.pressureMonitor) {
            this.elements.pressureMonitor.textContent = pressure.toFixed(1) + '%';
        }
    }
    
    updatePerformanceStats(stats) {
        if (this.elements.fps && 'fps' in stats) {
            this.elements.fps.textContent = stats.fps;
        }
        
        if (this.elements.gpuUsage && 'gpuUsage' in stats) {
            this.elements.gpuUsage.textContent = stats.gpuUsage + '%';
        }
        
        if (this.elements.memoryUsage && 'memoryUsage' in stats) {
            this.elements.memoryUsage.textContent = stats.memoryUsage;
        }
    }
}

// ==== プリセット表示管理（修正版） ====
class PresetDisplayManager {
    constructor(toolsSystem) {
        this.toolsSystem = toolsSystem;
    }
    

// ライブプレビュー更新
    updateLivePreview(size, opacity, color = null) {
        if (!this.toolsSystem) return;
        
        const penPresetManager = this.toolsSystem.getPenPresetManager();
        if (!penPresetManager) return;
        
        // 1. PenPresetManagerにライブ更新を依頼
        penPresetManager.updateActivePresetLive(size, opacity, color);
        
        // 2. 自身の表示を更新（再描画）
        this.updatePresetsDisplay();
    }
    
    // プリセット表示の更新
    updatePresetsDisplay() {
        if (!this.toolsSystem) return;
        
        const penPresetManager = this.toolsSystem.getPenPresetManager();
        if (!penPresetManager) return;
        
        const previewData = penPresetManager.generatePreviewData();
        const presetsContainer = document.getElementById('size-presets');
        
        if (!presetsContainer) return;
        
        // 既存の要素を更新
        const presetItems = presetsContainer.querySelectorAll('.size-preset-item');
        
        previewData.forEach((data, index) => {
            if (index < presetItems.length) {
                const item = presetItems[index];
                const circle = item.querySelector('.size-preview-circle');
                const label = item.querySelector('.size-preview-label');
                const percent = item.querySelector('.size-preview-percent');
                
                // data-size属性を更新（プリセット選択で必要）
                item.setAttribute('data-size', data.dataSize);
                
                if (circle) {
                    circle.style.width = data.size + 'px';
                    circle.style.height = data.size + 'px';
                    circle.style.background = data.color;
                    circle.style.opacity = data.opacity;
                }
                
                if (label) {
                    label.textContent = data.label;
                }
                
                if (percent) {
                    percent.textContent = data.opacityLabel;
                }
                
                // アクティブ状態の更新
                item.classList.toggle('active', data.isActive);
            }
        });
    }
    
    // プリセット選択処理
    handlePresetSelection(presetSize) {
        if (!this.toolsSystem) return;
        
        const penPresetManager = this.toolsSystem.getPenPresetManager();
        if (!penPresetManager) return;
        
        const presetId = penPresetManager.getPresetIdBySize(presetSize);
        if (!presetId) return;
        
        const preset = penPresetManager.selectPreset(presetId);
        if (!preset) return;
        
        return preset;
    }
}

// ==== 設定パネル管理（新規追加）====
class SettingsPanelManager {
    constructor(settingsManager, uiManager) {
        this.settingsManager = settingsManager;
        this.uiManager = uiManager;
        this.isInitialized = false;
        
        // UI要素
        this.elements = {};
        
        // 設定変更遅延タイマー
        this.saveTimeout = null;
        
        console.log('⚙️ SettingsPanelManager初期化開始');
    }
    
    async init() {
        try {
            this.findElements();
            this.setupEventListeners();
            this.loadCurrentSettings();
            
            this.isInitialized = true;
            console.log('✅ SettingsPanelManager初期化完了');
            
        } catch (error) {
            console.error('❌ SettingsPanelManager初期化エラー:', error);
        }
    }
    
    /**
     * UI要素の検索
     */
    findElements() {
        this.elements = {
            // チェックボックス
            highDpiCheckbox: document.getElementById('high-dpi-setting'),
            shortcutsCheckbox: document.getElementById('shortcuts-setting'),
            autoSaveCheckbox: document.getElementById('auto-save-setting'),
            showCoordinatesCheckbox: document.getElementById('show-coordinates-setting'),
            showPressureCheckbox: document.getElementById('show-pressure-setting'),
            notificationsCheckbox: document.getElementById('notifications-setting'),
            
            // ボタン
            resetButton: document.getElementById('settings-reset'),
            exportButton: document.getElementById('settings-export'),
            importButton: document.getElementById('settings-import'),
            
            // 情報表示
            resolutionInfo: document.getElementById('current-resolution'),
            shortcutInfo: document.getElementById('shortcut-info'),
            versionInfo: document.getElementById('version-info')
        };
        
        // 見つからない要素についてワーニング
        Object.entries(this.elements).forEach(([key, element]) => {
            if (!element) {
                console.warn(`⚠️ 設定パネル要素が見つかりません: ${key}`);
            }
        });
    }
    
    /**
     * イベントリスナーの設定
     */
    setupEventListeners() {
        // 高DPI設定
        if (this.elements.highDpiCheckbox) {
            this.elements.highDpiCheckbox.addEventListener('change', (event) => {
                this.handleHighDpiChange(event.target.checked);
            });
        }
        
        // ショートカット設定
        if (this.elements.shortcutsCheckbox) {
            this.elements.shortcutsCheckbox.addEventListener('change', (event) => {
                this.handleShortcutsChange(event.target.checked);
            });
        }
        
        // 自動保存設定
        if (this.elements.autoSaveCheckbox) {
            this.elements.autoSaveCheckbox.addEventListener('change', (event) => {
                this.handleAutoSaveChange(event.target.checked);
            });
        }
        
        // 座標表示設定
        if (this.elements.showCoordinatesCheckbox) {
            this.elements.showCoordinatesCheckbox.addEventListener('change', (event) => {
                this.handleShowCoordinatesChange(event.target.checked);
            });
        }
        
        // 筆圧表示設定
        if (this.elements.showPressureCheckbox) {
            this.elements.showPressureCheckbox.addEventListener('change', (event) => {
                this.handleShowPressureChange(event.target.checked);
            });
        }
        
        // 通知設定
        if (this.elements.notificationsCheckbox) {
            this.elements.notificationsCheckbox.addEventListener('change', (event) => {
                this.handleNotificationsChange(event.target.checked);
            });
        }
        
        // リセットボタン
        if (this.elements.resetButton) {
            this.elements.resetButton.addEventListener('click', () => {
                this.handleReset();
            });
        }
        
        // エクスポートボタン
        if (this.elements.exportButton) {
            this.elements.exportButton.addEventListener('click', () => {
                this.handleExport();
            });
        }
        
        // インポートボタン（ファイル選択）
        if (this.elements.importButton) {
            this.elements.importButton.addEventListener('click', () => {
                this.handleImportClick();
            });
        }
        
        // SettingsManager のイベント監視
        if (this.settingsManager) {
            this.settingsManager.on(SETTINGS_EVENTS.SETTING_CHANGED || 'settings:changed', (event) => {
                this.handleSettingChanged(event.key, event.value);
            });
            
            this.settingsManager.on(SETTINGS_EVENTS.HIGH_DPI_CHANGED || 'settings:highDpiChanged', (event) => {
                this.updateResolutionInfo();
            });
        }
    }
    
    /**
     * 現在の設定値をUIに反映
     */
    loadCurrentSettings() {
        if (!this.settingsManager) return;
        
        const settings = this.settingsManager.settings;
        
        // チェックボックスの状態を更新
        this.updateCheckbox('highDpiCheckbox', settings.highDpi);
        this.updateCheckbox('shortcutsCheckbox', settings.shortcutsEnabled);
        this.updateCheckbox('autoSaveCheckbox', settings.autoSave);
        this.updateCheckbox('showCoordinatesCheckbox', settings.showCoordinates);
        this.updateCheckbox('showPressureCheckbox', settings.showPressure);
        this.updateCheckbox('notificationsCheckbox', settings.notificationsEnabled);
        
        // 情報表示を更新
        this.updateResolutionInfo();
        this.updateShortcutInfo();
        this.updateVersionInfo();
        
        console.log('⚙️ 設定パネルに現在の設定を反映しました');
    }
    
    /**
     * チェックボックスの状態を更新
     */
    updateCheckbox(elementKey, checked) {
        const checkbox = this.elements[elementKey];
        if (checkbox) {
            checkbox.checked = checked;
        }
    }
    
    // ==== 設定変更ハンドラー ====
    
    /**
     * 高DPI設定変更
     */
    handleHighDpiChange(enabled) {
        if (!this.settingsManager) return;
        
        const success = this.settingsManager.setSetting(SETTING_TYPES.HIGH_DPI || 'highDpi', enabled);
        
        if (success) {
            this.showNotification(
                `高DPI設定: ${enabled ? 'ON' : 'OFF'}`,
                'info'
            );
            
            // 解像度情報を更新（少し遅延させて更新完了を待つ）
            setTimeout(() => {
                this.updateResolutionInfo();
            }, 1000);
        }
        
        this.emit(UI_EVENTS.HIGH_DPI_TOGGLED, { enabled });
    }
    
    /**
     * ショートカット設定変更
     */
    handleShortcutsChange(enabled) {
        if (!this.settingsManager) return;
        
        const success = this.settingsManager.setSetting(SETTING_TYPES.SHORTCUTS_ENABLED || 'shortcutsEnabled', enabled);
        
        if (success) {
            this.showNotification(
                `ショートカット: ${enabled ? 'ON' : 'OFF'}`,
                'info'
            );
        }
    }
    
    /**
     * 自動保存設定変更
     */
    handleAutoSaveChange(enabled) {
        if (!this.settingsManager) return;
        
        const success = this.settingsManager.setSetting(SETTING_TYPES.AUTO_SAVE || 'autoSave', enabled);
        
        if (success) {
            this.showNotification(
                `自動保存: ${enabled ? 'ON' : 'OFF'}`,
                'info'
            );
        }
    }
    
    /**
     * 座標表示設定変更
     */
    handleShowCoordinatesChange(enabled) {
        if (!this.settingsManager) return;
        
        const success = this.settingsManager.setSetting(SETTING_TYPES.SHOW_COORDINATES || 'showCoordinates', enabled);
        
        if (success) {
            this.showNotification(
                `座標表示: ${enabled ? 'ON' : 'OFF'}`,
                'info'
            );
        }
    }
    
    /**
     * 筆圧表示設定変更
     */
    handleShowPressureChange(enabled) {
        if (!this.settingsManager) return;
        
        const success = this.settingsManager.setSetting(SETTING_TYPES.SHOW_PRESSURE || 'showPressure', enabled);
        
        if (success) {
            this.showNotification(
                `筆圧表示: ${enabled ? 'ON' : 'OFF'}`,
                'info'
            );
        }
    }
    
    /**
     * 通知設定変更
     */
    handleNotificationsChange(enabled) {
        if (!this.settingsManager) return;
        
        const success = this.settingsManager.setSetting(SETTING_TYPES.NOTIFICATIONS_ENABLED || 'notificationsEnabled', enabled);
        
        if (success) {
            // 通知が無効になった場合は、この通知は表示しない
            if (enabled) {
                this.showNotification('通知: ON', 'info');
            }
        }
    }
    
    /**
     * 設定リセット
     */
    handleReset() {
        if (!this.settingsManager) return;
        
        if (confirm('すべての設定をデフォルトに戻しますか？')) {
            const success = this.settingsManager.resetToDefaults();
            
            if (success) {
                this.loadCurrentSettings();
                this.showNotification('設定をリセットしました', 'success');
            }
        }
    }
    
    /**
     * 設定エクスポート
     */
    handleExport() {
        if (!this.settingsManager) return;
        
        try {
            const settings = this.settingsManager.exportSettings();
            const dataStr = JSON.stringify(settings, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            
            const link = document.createElement('a');
            link.href = URL.createObjectURL(dataBlob);
            link.download = `futaba-drawing-settings-${new Date().toISOString().split('T')[0]}.json`;
            link.click();
            
            this.showNotification('設定をエクスポートしました', 'success');
            
        } catch (error) {
            console.error('設定エクスポートエラー:', error);
            this.showNotification('エクスポートに失敗しました', 'error');
        }
    }
    
    /**
     * 設定インポート（ファイル選択）
     */
    handleImportClick() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (event) => {
            const file = event.target.files[0];
            if (file) {
                this.handleImport(file);
            }
        };
        input.click();
    }
    
    /**
     * 設定インポート（ファイル処理）
     */
    handleImport(file) {
        if (!this.settingsManager) return;
        
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const settings = JSON.parse(event.target.result);
                const success = this.settingsManager.importSettings(settings);
                
                if (success) {
                    this.loadCurrentSettings();
                    this.showNotification('設定をインポートしました', 'success');
                } else {
                    this.showNotification('インポートに失敗しました', 'error');
                }
                
            } catch (error) {
                console.error('設定インポートエラー:', error);
                this.showNotification('ファイル読み込みに失敗しました', 'error');
            }
        };
        reader.readAsText(file);
    }
    
    // ==== 情報表示更新 ====
    
    /**
     * 解像度情報の更新
     */
    updateResolutionInfo() {
        if (!this.elements.resolutionInfo) return;
        
        const currentResolution = window.devicePixelRatio || 1;
        const isHighDpi = this.settingsManager ? this.settingsManager.isHighDpiEnabled() : false;
        const activeResolution = isHighDpi ? currentResolution : 1;
        
        this.elements.resolutionInfo.textContent = 
            `現在の解像度: ${activeResolution.toFixed(2)} (デバイス: ${currentResolution.toFixed(2)})`;
    }
    
    /**
     * ショートカット情報の更新
     */
    updateShortcutInfo() {
        if (!this.elements.shortcutInfo) return;
        
        const shortcuts = [
            'P: ペンツール',
            'E: 消しゴム',
            'DEL: キャンバスクリア',
            'P + [: 前のプリセット',
            'P + ]: 次のプリセット',
            'Ctrl+Z: アンドゥ',
            'Ctrl+Y: リドゥ'
        ];
        
        this.elements.shortcutInfo.innerHTML = shortcuts.map(s => `<div>${s}</div>`).join('');
    }
    
    /**
     * バージョン情報の更新
     */
    updateVersionInfo() {
        if (!this.elements.versionInfo) return;
        
        const version = SETTINGS_CONFIG ? SETTINGS_CONFIG.VERSION : '1.3';
        this.elements.versionInfo.textContent = `v${version}`;
    }
    
    // ==== 外部からの設定変更処理 ====
    
    /**
     * 設定変更イベント処理
     */
    handleSettingChanged(key, value) {
        // UI要素の状態を更新（無限ループを防ぐため、イベント発火は無効化）
        switch (key) {
            case 'highDpi':
            case SETTING_TYPES.HIGH_DPI:
                this.updateCheckbox('highDpiCheckbox', value);
                break;
            case 'shortcutsEnabled':
            case SETTING_TYPES.SHORTCUTS_ENABLED:
                this.updateCheckbox('shortcutsCheckbox', value);
                break;
            case 'autoSave':
            case SETTING_TYPES.AUTO_SAVE:
                this.updateCheckbox('autoSaveCheckbox', value);
                break;
            case 'showCoordinates':
            case SETTING_TYPES.SHOW_COORDINATES:
                this.updateCheckbox('showCoordinatesCheckbox', value);
                break;
            case 'showPressure':
            case SETTING_TYPES.SHOW_PRESSURE:
                this.updateCheckbox('showPressureCheckbox', value);
                break;
            case 'notificationsEnabled':
            case SETTING_TYPES.NOTIFICATIONS_ENABLED:
                this.updateCheckbox('notificationsCheckbox', value);
                break;
        }
    }
    
    // ==== ユーティリティメソッド ====
    
    /**
     * 通知表示
     */
    showNotification(message, type = 'info') {
        if (this.uiManager && this.uiManager.showNotification) {
            this.uiManager.showNotification(message, type, 3000);
        } else {
            console.log(`[設定] ${message}`);
        }
    }
    
    /**
     * イベント発火
     */
    emit(eventName, data = {}) {
        if (this.uiManager && this.uiManager.emit) {
            this.uiManager.emit(eventName, data);
        }
    }
    
    /**
     * 設定パネルを開く
     */
    openPanel() {
        this.emit(UI_EVENTS.SETTINGS_PANEL_OPENED);
    }
    
    /**
     * 設定パネルを閉じる
     */
    closePanel() {
        this.emit(UI_EVENTS.SETTINGS_PANEL_CLOSED);
    }
    
    // ==== デバッグメソッド ====
    
    /**
     * 設定パネル状態のデバッグ情報
     */
    debugPanel() {
        console.group('⚙️ 設定パネルデバッグ情報');
        console.log('初期化済み:', this.isInitialized);
        console.log('要素の状態:', Object.keys(this.elements).map(key => ({
            key,
            found: !!this.elements[key]
        })));
        
        if (this.settingsManager) {
            console.log('現在の設定:', this.settingsManager.settings);
        }
        
        console.groupEnd();
    }
}

// ==== メインUI管理クラス（設定対応版）====
class UIManager {
    constructor(app, toolsSystem, settingsManager = null) {
        this.app = app;
        this.toolsSystem = toolsSystem;
        this.settingsManager = settingsManager; // 新規追加
        
        // サブシステム
        this.popupManager = new PopupManager();
        this.statusBar = new StatusBarManager();
        this.presetDisplay = new PresetDisplayManager(toolsSystem);
        this.settingsPanel = null; // 新規追加
        
        // スライダー管理
        this.sliders = new Map();
        
        // 状態
        this.isInitialized = false;
        this.coordinateUpdateThrottle = null;
        
        // イベントエミッター
        this.eventHandlers = new Map();
    }
    
    async init() {
        try {
            console.log('🎯 UIManager初期化開始（設定対応版）...');
            
            this.setupToolButtons();
            this.setupPopups();
            this.setupSliders();
            this.setupPresetListeners();
            this.setupResize();
            this.setupCheckboxes();
            this.setupAppEventListeners();
            
            // 設定パネルの初期化（新規追加）
            if (this.settingsManager) {
                await this.setupSettingsPanel();
            }
            
            // 初期状態の更新
            this.updateAllDisplays();
            
            this.isInitialized = true;
            console.log('✅ UIManager初期化完了（設定対応版）');
            
        } catch (error) {
            console.error('❌ UIManager初期化エラー:', error);
            throw error;
        }
    }
    
    // ==== 設定パネル設定（新規追加） ====
    
    /**
     * 設定パネルの初期化
     */
    async setupSettingsPanel() {
        try {
            this.settingsPanel = new SettingsPanelManager(this.settingsManager, this);
            await this.settingsPanel.init();
            
            // 設定ツールボタンを有効化
            this.enableSettingsTool();
            
            console.log('⚙️ 設定パネル統合完了');
            
        } catch (error) {
            console.error('❌ 設定パネル初期化エラー:', error);
        }
    }
    
    /**
     * 設定ツールボタンを有効化
     */
    enableSettingsTool() {
        const settingsButton = document.getElementById('settings-tool');
        if (settingsButton) {
            settingsButton.classList.remove('disabled');
            settingsButton.setAttribute('data-popup', 'settings-panel');
            console.log('⚙️ 設定ツールボタンを有効化しました');
        }
    }
    
    /**
     * SettingsManager を後から設定
     */
    setSettingsManager(settingsManager) {
        this.settingsManager = settingsManager;
        
        if (this.isInitialized) {
            this.setupSettingsPanel();
        }
    }
    
    // ==== ツールボタン設定（設定対応版） ====
    setupToolButtons() {
        document.querySelectorAll('.tool-button').forEach(button => {
            button.addEventListener('click', (event) => {
                if (button.classList.contains('disabled')) return;
                
                const toolId = button.id;
                const popupId = button.getAttribute('data-popup');
                
                this.handleToolButtonClick(toolId, popupId, button);
            });
        });
        
        console.log('✅ ツールボタン設定完了（設定対応版）');
    }
    
    handleToolButtonClick(toolId, popupId, button) {
        // ツール切り替え
        if (toolId === 'pen-tool') {
            this.setActiveTool('pen', button);
        } else if (toolId === 'eraser-tool') {
            this.setActiveTool('eraser', button);
        } else if (toolId === 'settings-tool') {
            // 設定パネルの処理（新規追加）
            if (popupId) {
                this.popupManager.togglePopup(popupId);
            }
            return; // 設定ツールはアクティブ状態にしない
        }
        
        // ポップアップ表示/非表示
        if (popupId && toolId !== 'settings-tool') {
            this.popupManager.togglePopup(popupId);
        }
    }
    
    setActiveTool(toolName, button) {
        // ツールシステムに切り替えを依頼
        if (this.toolsSystem.setTool(toolName)) {
            // UI更新
            document.querySelectorAll('.tool-button').forEach(btn => 
                btn.classList.remove('active'));
            if (button) {
                button.classList.add('active');
            }
            
            this.statusBar.updateCurrentTool(toolName);
        }
    }
    
    // ==== ポップアップ設定（設定対応版） ====
    setupPopups() {
        // 既存のポップアップの登録
        this.popupManager.registerPopup('pen-settings');
        this.popupManager.registerPopup('resize-settings');
        
        // 設定パネルの登録（新規追加）
        this.popupManager.registerPopup('settings-panel');
        
        console.log('✅ ポップアップ設定完了（設定対応版）');
    }
    
    /**
     * スライダー設定（修正版：シンプル化されたコールバック処理）
     */
    setupSliders() {
        // ペンサイズスライダー
        this.createSlider('pen-size-slider', 0.1, 100, 16.0, (value, displayOnly = false) => {
            if (!displayOnly) {
                this.toolsSystem.updateBrushSettings({ size: value });
                // ライブプレビュー更新
                const currentOpacity = this.getCurrentOpacity();
                this.presetDisplay.updateLivePreview(value, currentOpacity);
            }
            return value.toFixed(1) + 'px';
        });
        
        // 不透明度スライダー
        this.createSlider('pen-opacity-slider', 0, 100, 85.0, (value, displayOnly = false) => {
            if (!displayOnly) {
                this.toolsSystem.updateBrushSettings({ opacity: value / 100 });
                // ライブプレビュー更新
                const currentSize = this.getCurrentSize();
                this.presetDisplay.updateLivePreview(currentSize, value / 100);
            }
            return value.toFixed(1) + '%';
        });
        
        // 筆圧スライダー
        this.createSlider('pen-pressure-slider', 0, 100, 50.0, (value, displayOnly = false) => {
            if (!displayOnly) {
                this.toolsSystem.updateBrushSettings({ pressure: value / 100 });
            }
            return value.toFixed(1) + '%';
        });
        
        // 線補正スライダー
        this.createSlider('pen-smoothing-slider', 0, 100, 30.0, (value, displayOnly = false) => {
            if (!displayOnly) {
                this.toolsSystem.updateBrushSettings({ smoothing: value / 100 });
            }
            return value.toFixed(1) + '%';
        });
        
        this.setupSliderButtons();
        console.log('✅ スライダー設定完了');
    }
    
    /**
     * スライダー作成（修正版：シンプル化されたコールバック）
     */
    createSlider(sliderId, min, max, initial, callback) {
        const slider = new SliderController(sliderId, min, max, initial, (value, displayOnly = false) => {
            // シンプル化: コールバックはそのまま実行
            return callback(value, displayOnly);
        });
        
        this.sliders.set(sliderId, slider);
        
        // 初期値の数値表示を確実に設定
        setTimeout(() => {
            slider.updateValueDisplay();
        }, 100);
        
        return slider;
    }
    
    /**
     * 数値表示強制更新メソッド（新規追加）
     */
    forceUpdateSliderDisplay(sliderId, displayValue) {
        const slider = this.sliders.get(sliderId);
        if (slider && slider.elements.valueDisplay) {
            slider.elements.valueDisplay.textContent = displayValue;
            slider.elements.valueDisplay.style.opacity = '1';
            slider.elements.valueDisplay.style.display = 'block';
            slider.elements.valueDisplay.style.visibility = 'visible';
            
            if (UI_CONFIG.SLIDER_DEBUG) {
                console.log(`[${sliderId}] 強制表示更新: ${displayValue}`);
            }
        }
    }
    
    /**
     * 全スライダーの数値表示強制更新（新規追加）
     */
    forceUpdateAllSliderDisplays() {
        this.sliders.forEach((slider, sliderId) => {
            setTimeout(() => {
                slider.updateValueDisplay();
            }, 50);
        });
    }
    
    /**
     * プリセット選択イベントの設定（修正版：数値同期改善）
     */
    setupPresetListeners() {
        const presetsContainer = document.getElementById('size-presets');
        if (!presetsContainer) {
            console.warn('プリセットコンテナが見つかりません');
            return;
        }
        
        presetsContainer.addEventListener('click', (event) => {
            const presetItem = event.target.closest('.size-preset-item');
            if (!presetItem) return;
            
            const size = parseFloat(presetItem.getAttribute('data-size'));
            if (!isNaN(size)) {
                // プリセット選択処理
                const preset = this.presetDisplay.handlePresetSelection(size);
                
                if (preset) {
                    // スライダーとツールシステムを更新
                    this.updateSliderValue('pen-size-slider', preset.size);
                    this.updateSliderValue('pen-opacity-slider', preset.opacity * 100);
                    
                    this.toolsSystem.updateBrushSettings({
                        size: preset.size,
                        opacity: preset.opacity
                    });
                    
                    // プリセット表示を更新
                    this.presetDisplay.updatePresetsDisplay();
                    
                    // 数値表示の確実な同期（複数回の更新で確実に）
                    setTimeout(() => {
                        this.forceUpdateSliderDisplay('pen-size-slider', preset.size.toFixed(1) + 'px');
                        this.forceUpdateSliderDisplay('pen-opacity-slider', (preset.opacity * 100).toFixed(1) + '%');
                    }, 10);
                    
                    setTimeout(() => {
                        this.forceUpdateSliderDisplay('pen-size-slider', preset.size.toFixed(1) + 'px');
                        this.forceUpdateSliderDisplay('pen-opacity-slider', (preset.opacity * 100).toFixed(1) + '%');
                    }, 50);
                    
                    console.log(`プリセット選択: サイズ${preset.size}, 不透明度${Math.round(preset.opacity * 100)}%`);
                }
            }
        });
        
        console.log('✅ プリセットリスナー設定完了');
    }
    
    // 現在のサイズを取得
    getCurrentSize() {
        const sizeSlider = this.sliders.get('pen-size-slider');
        return sizeSlider ? sizeSlider.value : 16.0;
    }
    
    // 現在の不透明度を取得
    getCurrentOpacity() {
        const opacitySlider = this.sliders.get('pen-opacity-slider');
        return opacitySlider ? opacitySlider.value / 100 : 0.85;
    }
    
    setupSliderButtons() {
        // スライダー調整ボタンのセットアップ
        const buttonConfigs = [
            // ペンサイズ
            { id: 'pen-size-decrease-small', slider: 'pen-size-slider', delta: -0.1 },
            { id: 'pen-size-decrease', slider: 'pen-size-slider', delta: -1 },
            { id: 'pen-size-decrease-large', slider: 'pen-size-slider', delta: -10 },
            { id: 'pen-size-increase-small', slider: 'pen-size-slider', delta: 0.1 },
            { id: 'pen-size-increase', slider: 'pen-size-slider', delta: 1 },
            { id: 'pen-size-increase-large', slider: 'pen-size-slider', delta: 10 },
            
            // 不透明度
            { id: 'pen-opacity-decrease-small', slider: 'pen-opacity-slider', delta: -0.1 },
            { id: 'pen-opacity-decrease', slider: 'pen-opacity-slider', delta: -1 },
            { id: 'pen-opacity-decrease-large', slider: 'pen-opacity-slider', delta: -10 },
            { id: 'pen-opacity-increase-small', slider: 'pen-opacity-slider', delta: 0.1 },
            { id: 'pen-opacity-increase', slider: 'pen-opacity-slider', delta: 1 },
            { id: 'pen-opacity-increase-large', slider: 'pen-opacity-slider', delta: 10 },
            
            // 筆圧
            { id: 'pen-pressure-decrease-small', slider: 'pen-pressure-slider', delta: -0.1 },
            { id: 'pen-pressure-decrease', slider: 'pen-pressure-slider', delta: -1 },
            { id: 'pen-pressure-decrease-large', slider: 'pen-pressure-slider', delta: -10 },
            { id: 'pen-pressure-increase-small', slider: 'pen-pressure-slider', delta: 0.1 },
            { id: 'pen-pressure-increase', slider: 'pen-pressure-slider', delta: 1 },
            { id: 'pen-pressure-increase-large', slider: 'pen-pressure-slider', delta: 10 },
            
            // 線補正
            { id: 'pen-smoothing-decrease-small', slider: 'pen-smoothing-slider', delta: -0.1 },
            { id: 'pen-smoothing-decrease', slider: 'pen-smoothing-slider', delta: -1 },
            { id: 'pen-smoothing-decrease-large', slider: 'pen-smoothing-slider', delta: -10 },
            { id: 'pen-smoothing-increase-small', slider: 'pen-smoothing-slider', delta: 0.1 },
            { id: 'pen-smoothing-increase', slider: 'pen-smoothing-slider', delta: 1 },
            { id: 'pen-smoothing-increase-large', slider: 'pen-smoothing-slider', delta: 10 }
        ];
        
        buttonConfigs.forEach(config => {
            const button = document.getElementById(config.id);
            if (button) {
                button.addEventListener('click', () => {
                    const slider = this.sliders.get(config.slider);
                    if (slider) {
                        slider.adjustValue(config.delta);
                    }
                });
            }
        });
    }
    
    setupResize() {
        // プリセットボタン
        document.querySelectorAll('.resize-button[data-size]').forEach(button => {
            button.addEventListener('click', () => {
                const [width, height] = button.getAttribute('data-size').split(',').map(Number);
                this.setCanvasSize(width, height);
            });
        });
        
        // 適用ボタン
        const applyButton = document.getElementById('apply-resize');
        const applyCenterButton = document.getElementById('apply-resize-center');
        
        if (applyButton) {
            applyButton.addEventListener('click', () => this.applyResize(false));
        }
        
        if (applyCenterButton) {
            applyCenterButton.addEventListener('click', () => this.applyResize(true));
        }
        
        console.log('✅ リサイズ機能設定完了');
    }
    
    setCanvasSize(width, height) {
        const widthInput = document.getElementById('canvas-width');
        const heightInput = document.getElementById('canvas-height');
        
        if (widthInput) widthInput.value = width;
        if (heightInput) heightInput.value = height;
    }
    
    applyResize(centerContent) {
        try {
            const widthInput = document.getElementById('canvas-width');
            const heightInput = document.getElementById('canvas-height');
            
            if (!widthInput || !heightInput) {
                console.warn('リサイズ入力要素が見つかりません');
                return;
            }
            
            const width = parseInt(widthInput.value);
            const height = parseInt(heightInput.value);
            
            if (isNaN(width) || isNaN(height) || width < 100 || height < 100) {
                console.warn('無効なサイズが指定されました');
                return;
            }
            
            this.app.resize(width, height, centerContent);
            this.statusBar.updateCanvasInfo(width, height);
            this.popupManager.hideAllPopups();
            
            console.log(`Canvas resized to ${width}x${height}px (center: ${centerContent})`);
            
        } catch (error) {
            console.error('リサイズエラー:', error);
        }
    }
    
    setupCheckboxes() {
        document.querySelectorAll('.checkbox').forEach(checkbox => {
            checkbox.addEventListener('click', () => {
                checkbox.classList.toggle('checked');
                
                // チェックボックスの状態変更を通知
                const checkboxId = checkbox.id;
                const isChecked = checkbox.classList.contains('checked');
                
                console.log(`チェックボックス変更: ${checkboxId} = ${isChecked}`);
                
                // 将来の機能拡張用
                this.handleCheckboxChange(checkboxId, isChecked);
            });
        });
        
        console.log('✅ チェックボックス設定完了');
    }
    
    handleCheckboxChange(checkboxId, isChecked) {
        // 将来の機能実装用のプレースホルダー
        switch (checkboxId) {
            case 'pressure-sensitivity':
                console.log('筆圧感度:', isChecked);
                break;
            case 'edge-smoothing':
                console.log('エッジスムージング:', isChecked);
                break;
            case 'gpu-acceleration':
                console.log('GPU加速:', isChecked);
                break;
        }
    }
    
    setupAppEventListeners() {
        // アプリケーション側のイベントを監視
        this.app.on(EVENTS.CANVAS_READY, (data) => {
            console.log('Canvas ready event received');
            this.updateAllDisplays();
        });
        
        this.app.on(EVENTS.TOOL_CHANGED, (data) => {
            console.log('Tool changed event received:', data.state.currentTool);
            this.statusBar.updateCurrentTool(data.state.currentTool);
            this.statusBar.updateCurrentColor(data.state.brushColor);
        });
        
        // 描画レイヤーのマウス移動イベント
        if (this.app.layers && this.app.layers.drawingLayer) {
            this.app.layers.drawingLayer.on(EVENTS.POINTER_MOVE, (event) => {
                const point = this.app.getLocalPointerPosition(event);
                this.updateCoordinatesThrottled(point.x, point.y);
                
                // 筆圧モニター更新（描画中のみ）
                if (this.app.state.isDrawing) {
                    const pressure = Math.min(100, this.app.state.pressure * 100 + Math.random() * 20);
                    this.statusBar.updatePressureMonitor(pressure);
                }
            });
            
            this.app.layers.drawingLayer.on(EVENTS.POINTER_UP, () => {
                this.statusBar.updatePressureMonitor(0);
            });
        }
        
        console.log('✅ アプリイベントリスナー設定完了');
    }
    
    updateCoordinatesThrottled(x, y) {
        if (this.coordinateUpdateThrottle) {
            clearTimeout(this.coordinateUpdateThrottle);
        }
        
        this.coordinateUpdateThrottle = setTimeout(() => {
            this.statusBar.updateCoordinates(x, y);
        }, UI_CONFIG.SLIDER_UPDATE_THROTTLE);
    }
    
    updateAllDisplays() {
        // 初期状態の表示更新
        const stats = this.app.getStats();
        this.statusBar.updateCanvasInfo(stats.width, stats.height);
        
        const brushSettings = this.toolsSystem.getBrushSettings();
        this.statusBar.updateCurrentColor(brushSettings.color);
        
        const currentTool = this.toolsSystem.getCurrentTool();
        this.statusBar.updateCurrentTool(currentTool);
        
        // プリセット表示の初期化
        this.presetDisplay.updatePresetsDisplay();
        
        // 全スライダーの数値表示を強制更新
        this.forceUpdateAllSliderDisplays();
        
        console.log('✅ 全ディスプレイ更新完了');
    }
    
    // ==== 設定変更処理（新規追加） ====
    
    /**
     * 設定読み込み完了時の処理
     */
    handleSettingsLoaded(settings) {
        // ステータスバーの表示/非表示を適用
        this.updateStatusBarVisibility(settings);
        
        console.log('⚙️ 設定がUIに適用されました');
    }
    
    /**
     * 設定変更時の処理
     */
    handleSettingChange(key, value) {
        switch (key) {
            case 'showCoordinates':
            case SETTING_TYPES.SHOW_COORDINATES:
                this.updateCoordinatesVisibility(value);
                break;
                
            case 'showPressure':
            case SETTING_TYPES.SHOW_PRESSURE:
                this.updatePressureVisibility(value);
                break;
                
            case 'notificationsEnabled':
            case SETTING_TYPES.NOTIFICATIONS_ENABLED:
                // 通知機能は showNotification メソッド内で制御
                break;
                
            default:
                console.log(`⚙️ UI設定変更: ${key} = ${value}`);
                break;
        }
    }
    
    /**
     * ステータスバーの表示状態を更新
     */
    updateStatusBarVisibility(settings) {
        const statusPanel = document.querySelector('.status-panel');
        if (!statusPanel) return;
        
        // 座標表示
        const coordinatesItem = statusPanel.querySelector('#coordinates');
        if (coordinatesItem) {
            const showCoordinates = settings.showCoordinates !== undefined ? 
                settings.showCoordinates : true;
            coordinatesItem.parentNode.style.display = showCoordinates ? 'flex' : 'none';
        }
        
        // 筆圧表示
        const pressureItem = statusPanel.querySelector('#pressure-monitor');
        if (pressureItem) {
            const showPressure = settings.showPressure !== undefined ? 
                settings.showPressure : true;
            pressureItem.parentNode.style.display = showPressure ? 'flex' : 'none';
        }
    }
    
    /**
     * 座標表示の切り替え
     */
    updateCoordinatesVisibility(visible) {
        const coordinatesItem = document.querySelector('#coordinates');
        if (coordinatesItem) {
            coordinatesItem.parentNode.style.display = visible ? 'flex' : 'none';
        }
    }
    
    /**
     * 筆圧表示の切り替え
     */
    updatePressureVisibility(visible) {
        const pressureItem = document.querySelector('#pressure-monitor');
        if (pressureItem) {
            pressureItem.parentNode.style.display = visible ? 'flex' : 'none';
        }
    }
    
    // ==== 公開API（拡張版） ====
    showPopup(popupId) {
        return this.popupManager.showPopup(popupId);
    }
    
    hidePopup(popupId) {
        return this.popupManager.hidePopup(popupId);
    }
    
    hideAllPopups() {
        this.popupManager.hideAllPopups();
    }
    
    /**
     * スライダー値更新（修正版：数値表示も同時更新）
     */
    updateSliderValue(sliderId, value) {
        const slider = this.sliders.get(sliderId);
        if (slider) {
            slider.setValue(value);
            // 数値表示の確実な更新
            setTimeout(() => {
                slider.updateValueDisplay();
            }, 10);
        }
    }
    
    updateStatusBar(updates) {
        if (updates.canvasInfo) {
            this.statusBar.updateCanvasInfo(updates.canvasInfo.width, updates.canvasInfo.height);
        }
        
        if (updates.tool) {
            this.statusBar.updateCurrentTool(updates.tool);
        }
        
        if (updates.color) {
            this.statusBar.updateCurrentColor(updates.color);
        }
        
        if (updates.coordinates) {
            this.statusBar.updateCoordinates(updates.coordinates.x, updates.coordinates.y);
        }
        
        if (updates.pressure !== undefined) {
            this.statusBar.updatePressureMonitor(updates.pressure);
        }
        
        if (updates.performance) {
            this.statusBar.updatePerformanceStats(updates.performance);
        }
    }
    
    // ==== エラー表示 ====
    showError(message, duration = 5000) {
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #ff4444;
            color: white;
            padding: 12px 16px;
            border-radius: 6px;
            z-index: 10000;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            animation: slideInRight 0.3s ease-out;
            max-width: 300px;
        `;
        
        errorDiv.textContent = message;
        document.body.appendChild(errorDiv);
        
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.style.animation = 'slideOutRight 0.3s ease-in';
                setTimeout(() => {
                    if (errorDiv.parentNode) {
                        errorDiv.parentNode.removeChild(errorDiv);
                    }
                }, 300);
            }
        }, duration);
    }
    
    // ==== 通知表示（設定対応版） ====
    showNotification(message, type = 'info', duration = 3000) {
        // 通知設定が無効な場合はスキップ
        if (this.settingsManager && 
            !this.settingsManager.getSetting(SETTING_TYPES.NOTIFICATIONS_ENABLED || 'notificationsEnabled')) {
            return;
        }
        
        const colors = {
            info: '#2196F3',
            success: '#4CAF50',
            warning: '#FF9800',
            error: '#f44336'
        };
        
        const notificationDiv = document.createElement('div');
        notificationDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${colors[type] || colors.info};
            color: white;
            padding: 12px 16px;
            border-radius: 6px;
            z-index: 10000;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
            animation: slideInRight 0.3s ease-out;
            max-width: 300px;
        `;
        
        notificationDiv.textContent = message;
        document.body.appendChild(notificationDiv);
        
        setTimeout(() => {
            if (notificationDiv.parentNode) {
                notificationDiv.style.animation = 'slideOutRight 0.3s ease-in';
                setTimeout(() => {
                    if (notificationDiv.parentNode) {
                        notificationDiv.parentNode.removeChild(notificationDiv);
                    }
                }, 300);
            }
        }, duration);
    }
    
    // ==== イベントシステム（新規追加） ====
    
    /**
     * イベントハンドラーの登録
     */
    on(eventName, handler) {
        if (!this.eventHandlers.has(eventName)) {
            this.eventHandlers.set(eventName, []);
        }
        this.eventHandlers.get(eventName).push(handler);
    }
    
    /**
     * イベントハンドラーの削除
     */
    off(eventName, handler) {
        const handlers = this.eventHandlers.get(eventName);
        if (handlers) {
            const index = handlers.indexOf(handler);
            if (index > -1) {
                handlers.splice(index, 1);
            }
        }
    }
    
    /**
     * イベントの発火
     */
    emit(eventName, data = {}) {
        const handlers = this.eventHandlers.get(eventName);
        if (handlers) {
            handlers.forEach(handler => {
                try {
                    handler(data);
                } catch (error) {
                    console.error(`⚠️ UIイベントハンドラーエラー (${eventName}):`, error);
                }
            });
        }
    }
    
    // ==== デバッグ機能（拡張版）====
    
    /**
     * スライダーデバッグ情報の取得
     */
    getSliderDebugInfo() {
        const debugInfo = {};
        this.sliders.forEach((slider, sliderId) => {
            debugInfo[sliderId] = {
                value: slider.value,
                displayValue: slider.elements.valueDisplay ? slider.elements.valueDisplay.textContent : 'なし',
                hasValueDisplay: !!slider.elements.valueDisplay,
                elementFound: {
                    container: !!slider.elements.container,
                    track: !!slider.elements.track,
                    handle: !!slider.elements.handle,
                    valueDisplay: !!slider.elements.valueDisplay
                }
            };
        });
        return debugInfo;
    }
    
    /**
     * スライダーの診断実行
     */
    diagnoseSliders() {
        console.group('🔍 スライダー診断結果');
        
        this.sliders.forEach((slider, sliderId) => {
            console.group(`📊 ${sliderId}`);
            
            const elements = slider.elements;
            console.log('要素チェック:', {
                container: !!elements.container,
                track: !!elements.track,
                handle: !!elements.handle,
                valueDisplay: !!elements.valueDisplay
            });
            
            if (elements.valueDisplay) {
                console.log('数値表示:', {
                    textContent: elements.valueDisplay.textContent,
                    display: elements.valueDisplay.style.display,
                    visibility: elements.valueDisplay.style.visibility,
                    opacity: elements.valueDisplay.style.opacity
                });
            } else {
                console.warn('⚠️ valueDisplay要素が見つかりません');
            }
            
            console.log('現在値:', slider.value);
            
            // テスト更新
            try {
                slider.updateValueDisplay();
                console.log('✅ 数値表示更新テスト成功');
            } catch (error) {
                console.error('❌ 数値表示更新テストエラー:', error);
            }
            
            console.groupEnd();
        });
        
        console.groupEnd();
    }
    
    /**
     * デバッグモードの切り替え
     */
    toggleSliderDebug() {
        UI_CONFIG.SLIDER_DEBUG = !UI_CONFIG.SLIDER_DEBUG;
        console.log(`スライダーデバッグモード: ${UI_CONFIG.SLIDER_DEBUG ? 'ON' : 'OFF'}`);
        
        if (UI_CONFIG.SLIDER_DEBUG) {
            this.diagnoseSliders();
        }
    }
    
    // ==== UIStats取得（拡張版） ====
    getUIStats() {
        return {
            initialized: this.isInitialized,
            activePopup: this.popupManager.activePopup,
            sliderCount: this.sliders.size,
            popupCount: this.popupManager.popups.size,
            currentSize: this.getCurrentSize(),
            currentOpacity: this.getCurrentOpacity(),
            hasSettingsManager: !!this.settingsManager, // 新規追加
            hasSettingsPanel: !!this.settingsPanel, // 新規追加
            sliderDebugInfo: this.getSliderDebugInfo()
        };
    }
    
    /**
     * デバッグ情報の表示（設定対応版）
     */
    debugUI() {
        console.group('🎨 UIManager デバッグ情報（設定対応版）');
        console.log('📊 UI統計:', this.getUIStats());
        
        if (this.settingsPanel) {
            this.settingsPanel.debugPanel();
        }
        
        console.groupEnd();
    }
    
    // ==== クリーンアップ（拡張版） ====
    destroy() {
        // タイマークリア
        if (this.coordinateUpdateThrottle) {
            clearTimeout(this.coordinateUpdateThrottle);
        }
        
        // スライダーのクリーンアップ
        this.sliders.forEach(slider => {
            if (slider.throttleTimeout) {
                clearTimeout(slider.throttleTimeout);
            }
        });
        
        // 設定パネルのクリーンアップ
        if (this.settingsPanel) {
            console.log('⚙️ 設定パネルをクリーンアップ');
            // 設定パネル固有のクリーンアップがあれば実行
        }
        
        // イベントハンドラーのクリーンアップ
        this.eventHandlers.clear();
        
        // 参照のクリア
        this.settingsManager = null;
        this.settingsPanel = null;
        
        console.log('UIManager destroyed（設定対応版）');
    }
}

// ==== CSS アニメーション追加 ====
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes slideOutRight {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(style);

// ==== エクスポート（設定対応版） ====
if (typeof window !== 'undefined') {
    window.UIManager = UIManager;
    window.SliderController = SliderController;
    window.PopupManager = PopupManager;
    window.StatusBarManager = StatusBarManager;
    window.PresetDisplayManager = PresetDisplayManager;
    window.SettingsPanelManager = SettingsPanelManager; // 新規追加
    window.UI_CONFIG = UI_CONFIG;
    window.UI_EVENTS = UI_EVENTS;
    
    console.log('🎨 ui-manager.js (設定対応版) 読み込み完了');
    console.log('📝 利用可能クラス: UIManager, SettingsPanelManager 他');
    console.log('⚙️ 新機能: 設定パネル統合、SettingsManager連携');
    console.log('🎯 設定機能: 高DPI切り替え、ショートカット管理、通知制御');
}

// ES6 module export (将来のTypeScript移行用)
// export { 
//     UIManager, 
//     SliderController, 
//     PopupManager, 
//     StatusBarManager, 
//     PresetDisplayManager,
//     SettingsPanelManager,
//     UI_CONFIG,
//     UI_EVENTS 
// };/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1.3
 * UI管理システム - ui-manager.js（設定パネル対応版）
 * 
 * 責務: UIコンテナ管理・UIイベント処理・設定UI管理
 * 依存: app-core.js, drawing-tools.js, settings-manager.js
 * 
 * 修正内容:
 * 1. 設定パネルUIの追加
 * 2. SettingsManager 連携
 * 3. 設定ボタンの有効化
 * 4. 設定変更イベントの処理
 * 5. 高DPI切り替えUI
 */

// ==== UI設定定数（拡張版） ====
const UI_CONFIG = {
    // ポップアップ設定
    POPUP_ANIMATION_DURATION: 300,
    POPUP_MIN_WIDTH: 280,
    POPUP_MIN_HEIGHT: 350,
    
    // スライダー設定
    SLIDER_UPDATE_THROTTLE: 16, // 60fps
    SLIDER_DEBUG: false, // 本番環境では false
    
    // ドラッグ設定
    DRAG_THRESHOLD: 3,
    
    // プリセット設定
    SIZE_PRESETS: [1, 2, 4, 8, 16, 32],
    SIZE_PREVIEW_MIN: 0.5,
    SIZE_PREVIEW_MAX: 20,
    
    // 設定パネル設定（新規追加）
    SETTINGS_SAVE_DELAY: 1000 // 設定変更後の自動保存遅延
};

// ==== UIイベント定数（拡張版） ====
const UI_EVENTS = {
    TOOL_SELECTED: 'ui:tool_selected',
    POPUP_OPENED: 'ui:popup_opened',
    POPUP_CLOSED: 'ui:popup_closed',
    SETTING_CHANGED: 'ui:setting_changed',
    COORDINATES_UPDATED: 'ui:coordinates_updated',
    // 設定関連イベント（新規追加）
    SETTINGS_PANEL_OPENED: 'ui:settings_panel_opened',
    SETTINGS_PANEL_CLOSED: 'ui:settings_panel_closed',
    HIGH_DPI_TOGGLED: 'ui:high_dpi_toggled'
};

// ==== スライダーコントローラー（変更なし）====
class SliderController {
    constructor(sliderId, min, max, initial, updateCallback) {
        this.sliderId = sliderId;
        this.min = min;
        this.max = max;
        this.value = initial;
        this.updateCallback = updateCallback;
        this.isDragging = false;
        this.throttleTimeout = null;
        
        this.elements = this.findElements();
        if (this.elements.container) {
            this.setupEventListeners();
            this.updateDisplay();
        }
    }
    
    /**
     * DOM要素を検索（修正版：より確実な検索）
     */
    findElements() {
        const container = document.getElementById(this.sliderId);
        if (!container) {
            console.warn(`スライダー要素が見つかりません: ${this.sliderId}`);
            return {};
        }
        
        // より確実なvalueDisplay要素の検索
        const valueDisplay = this.findValueDisplayElement(container);
        
        const elements = {
            container,
            track: container.querySelector('.slider-track'),
            handle: container.querySelector('.slider-handle'),
            valueDisplay
        };
        
        // デバッグログ
        if (UI_CONFIG.SLIDER_DEBUG) {
            console.log(`[${this.sliderId}] 要素検索結果:`, {
                container: !!elements.container,
                track: !!elements.track,
                handle: !!elements.handle,
                valueDisplay: !!elements.valueDisplay
            });
        }
        
        return elements;
    }
    
    /**
     * valueDisplay要素を複数の方法で検索
     */
    findValueDisplayElement(container) {
        let valueDisplay = null;
        
        // 方法1: 親ノードから検索
        if (container.parentNode) {
            valueDisplay = container.parentNode.querySelector('.slider-value');
        }
        
        // 方法2: slider-controls内から検索
        if (!valueDisplay) {
            const controls = container.closest('.slider-controls');
            if (controls) {
                valueDisplay = controls.querySelector('.slider-value');
            }
        }
        
        // 方法3: slider-container内から検索
        if (!valueDisplay) {
            const sliderContainer = container.closest('.slider-container');
            if (sliderContainer) {
                valueDisplay = sliderContainer.querySelector('.slider-value');
            }
        }
        
        if (!valueDisplay) {
            console.warn(`[${this.sliderId}] .slider-value 要素が見つかりません`);
        }
        
        return valueDisplay;
    }
    
    setupEventListeners() {
        const { container } = this.elements;
        
        // マウスイベント
        container.addEventListener('mousedown', (e) => this.onMouseDown(e));
        document.addEventListener('mousemove', (e) => this.onMouseMove(e));
        document.addEventListener('mouseup', () => this.onMouseUp());
        
        // タッチイベント（将来実装）
        // container.addEventListener('touchstart', (e) => this.onTouchStart(e));
        // document.addEventListener('touchmove', (e) => this.onTouchMove(e));
        // document.addEventListener('touchend', () => this.onTouchEnd());
    }
    
    onMouseDown(event) {
        this.isDragging = true;
        this.updateValueFromPosition(event.clientX);
        event.preventDefault();
    }
    
    onMouseMove(event) {
        if (!this.isDragging) return;
        this.updateValueFromPosition(event.clientX);
    }
    
    onMouseUp() {
        this.isDragging = false;
    }
    
    updateValueFromPosition(clientX) {
        if (!this.elements.container) return;
        
        const rect = this.elements.container.getBoundingClientRect();
        const percentage = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        const newValue = this.min + percentage * (this.max - this.min);
        
        this.setValue(newValue);
    }
    
    /**
     * 値を設定（修正版：数値表示の確実な更新）
     */
    setValue(value, updateDisplay = true) {
        const oldValue = this.value;
        this.value = Math.max(this.min, Math.min(this.max, value));
        
        if (updateDisplay) {
            this.updateDisplay();
        }
        
        // 値が変更された場合のコールバック実行
        if (this.updateCallback && Math.abs(this.value - oldValue) > 0.001) {
            this.throttledCallback();
            // 数値表示も強制更新
            if (updateDisplay) {
                setTimeout(() => this.updateValueDisplay(), 10);
            }
        }
    }
    
    throttledCallback() {
        if (this.throttleTimeout) {
            clearTimeout(this.throttleTimeout);
        }
        
        this.throttleTimeout = setTimeout(() => {
            this.updateCallback(this.value);
            this.throttleTimeout = null;
        }, UI_CONFIG.SLIDER_UPDATE_THROTTLE);
    }
    
    /**
     * 表示更新（修正版：数値表示を分離）
     */
    updateDisplay() {
        if (!this.elements.track || !this.elements.handle) return;
        
        const percentage = ((this.value - this.min) / (this.max - this.min)) * 100;
        
        this.elements.track.style.width = percentage + '%';
        this.elements.handle.style.left = percentage + '%';
        
        // 数値表示の更新
        this.updateValueDisplay();
    }
    
    /**
     * 数値表示の確実な更新（新規追加）
     */
    updateValueDisplay() {
        if (!this.elements.valueDisplay || !this.updateCallback) return;
        
        try {
            const displayValue = this.updateCallback(this.value, true); // displayOnly = true
            
            if (typeof displayValue === 'string' && displayValue.trim()) {
                this.elements.valueDisplay.textContent = displayValue;
                this.elements.valueDisplay.style.display = 'block';
                this.elements.valueDisplay.style.visibility = 'visible';
                
                if (UI_CONFIG.SLIDER_DEBUG) {
                    console.log(`[${this.sliderId}] 数値表示更新: ${displayValue}`);
                }
            } else {
                // フォールバック: 基本的な数値表示
                this.elements.valueDisplay.textContent = this.value.toFixed(1);
                if (UI_CONFIG.SLIDER_DEBUG) {
                    console.warn(`[${this.sliderId}] フォールバック表示: ${this.value.toFixed(1)}`);
                }
            }
            
            // バリデーション: NaNやundefinedチェック
            const currentText = this.elements.valueDisplay.textContent;
            if (currentText.includes('NaN') || currentText.includes('undefined')) {
                this.elements.valueDisplay.textContent = this.value.toFixed(1);
                console.warn(`[${this.sliderId}] 不正な表示値を修正: ${currentText} -> ${this.value.toFixed(1)}`);
            }
            
        } catch (error) {
            // エラー時のフォールバック表示
            this.elements.valueDisplay.textContent = this.value.toFixed(1);
            console.error(`[${this.sliderId}] 数値表示更新エラー:`, error);
        }
    }
    
    adjustValue(delta) {
        this.setValue(this.value + delta);
    }
}

// ==== ポップアップマネージャー（設定パネル対応版） ====
class PopupManager {
    constructor() {
        this.activePopup = null;
        this.popups = new Map();
        this.setupGlobalListeners();
    }
    
    registerPopup(popupId) {
        const popup = document.getElementById(popupId);
        if (!popup) {
            console.warn(`ポップアップ要素が見つかりません: ${popupId}`);
            return false;
        }
        
        this.popups.set(popupId, {
            element: popup,
            isDraggable: popup.classList.contains('draggable')
        });
        
        if (popup.classList.contains('draggable')) {
            this.makeDraggable(popup);
        }
        
        return true;
    }
    
    showPopup(popupId) {
        const popupData = this.popups.get(popupId);
        if (!popupData) return false;
        
        // 他のポップアップを閉じる
        this.hideAllPopups();
        
        // ポップアップを表示
        popupData.element.classList.add('show');
        this.activePopup = popupId;
        
        console.log(`ポップアップ表示: ${popupId}`);
        return true;
    }
    
    hidePopup(popupId) {
        const popupData = this.popups.get(popupId);
        if (!popupData) return false;
        
        popupData.element.classList.remove('show');
        if (this.activePopup === popupId) {
            this.activePopup = null;
        }
        
        return true;
    }
    
    togglePopup(popupId) {
        const popupData = this.popups.get(popupId);
        if (!popupData) return false;
        
        const isVisible = popupData.element.classList.contains('show');
        return isVisible ? this.hidePopup(popupId) : this.showPopup(popupId);
    }
    
    hideAllPopups() {
        this.popups.forEach((popupData, popupId) => {
            popupData.element.classList.remove('show');
        });
        this.activePopup = null;
    }
    
    setupGlobalListeners() {
        // ポップアップ外クリックで閉じる
        document.addEventListener('click', (event) => {
            if (!event.target.closest('.popup-panel') && 
                !event.target.closest('.tool-button[data-popup]')) {
                this.hideAllPopups();
            }
        });
        
        // ESCキーでポップアップを閉じる
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && this.activePopup) {
                this.hideAllPopups();
            }
        });
    }
    
    makeDraggable(popup) {
        let isDragging = false;
        let dragOffset = { x: 0, y: 0 };
        
        popup.addEventListener('mousedown', (event) => {
            if (event.target === popup || event.target.closest('.popup-title')) {
                isDragging = true;
                popup.classList.add('dragging');
                
                const rect = popup.getBoundingClientRect();
                dragOffset.x = event.clientX - rect.left;
                dragOffset.y = event.clientY - rect.top;
                event.preventDefault();
            }
        });
        
        document.addEventListener('mousemove', (event) => {
            if (!isDragging) return;
            
            const x = Math.max(0, Math.min(
                event.clientX - dragOffset.x,
                window.innerWidth - popup.offsetWidth
            ));
            const y = Math.max(0, Math.min(
                event.clientY - dragOffset.y,
                window.innerHeight - popup.offsetHeight
            ));
            
            popup.style.left = x + 'px';
            popup.style.top = y + 'px';
        });
        
        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                popup.classList.remove('dragging');
            }
        });
    }
}

// ==== ステータスバー管理 ====
class StatusBarManager {
    constructor() {
        this.elements = this.findElements();
    }
    
    findElements() {
        return {
            canvasInfo: document.getElementById('canvas-info'),
            currentTool: document.getElementById('current-tool'),
            currentColor: document.getElementById('current-color'),
            coordinates: document.getElementById('coordinates'),
            pressureMonitor: document.getElementById('pressure-monitor'),
            fps: document.getElementById('fps'),
            gpuUsage: document.getElementById('gpu-usage'),
            memoryUsage: document.getElementById('memory-usage')
        };
    }
    
    updateCanvasInfo(width, height) {
        if (this.elements.canvasInfo) {
            this.elements.canvasInfo.textContent = `${width}×${height}px`;
        }
    }
    
    updateCurrentTool(toolName) {
        if (this.elements.currentTool) {
            const toolNames = {
                pen: 'ベクターペン',
                eraser: '消しゴム',
                fill: '塗りつぶし',
                select: '範囲選択'
            };
            this.elements.currentTool.textContent = toolNames[toolName] || toolName;
        }
    }
    
    updateCurrentColor(color) {
        if (this.elements.currentColor) {
            const colorStr = typeof color === 'number' ? 
                '#' + color.toString(16).padStart(6, '0') : color;
            this.elements.currentColor.textContent = colorStr;
        }
    }
    
    updateCoordinates(x, y) {
        if (this.elements.coordinates) {
            this.elements.coordinates.textContent = `x: ${Math.round(x)}, y: ${Math.round(y)}`;
        }
    }
    
    updatePressureMonitor(pressure) {
        if (this.elements.pressureMonitor) {
            this.elements.pressureMonitor.textContent = pressure.toFixed(1) + '%';
        }
    }
    
    updatePerformanceStats(stats) {
        if (this.elements.fps && 'fps' in stats) {
            this.elements.fps.textContent = stats.fps;
        }
        
        if (this.elements.gpuUsage && 'gpuUsage' in stats) {
            this.elements.gpuUsage.textContent = stats.gpuUsage + '%';
        }
        
        if (this.elements.memoryUsage && 'memoryUsage' in stats) {
            this.elements.memoryUsage.textContent = stats.memoryUsage;
        }
    }
}

// ==== プリセット表示管理（修正版） ====
class PresetDisplayManager {
    constructor(toolsSystem) {
        this.toolsSystem = toolsSystem;
    }
    
    // ライブプレビュー更新
    updateLivePre