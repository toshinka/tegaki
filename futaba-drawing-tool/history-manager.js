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
    