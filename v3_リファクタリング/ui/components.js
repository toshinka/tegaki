/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1rev4
 * UIコンポーネント群 - ui/components.js
 * 
 * 責務: 独立性の高いUIコンポーネント（ui-manager.jsから分離）
 * 依存: app-core.js, drawing-tools.js（間接的）
 * 
 * 含まれるクラス:
 * - SliderController: スライダー操作管理
 * - PopupManager: ポップアップ表示管理
 * - StatusBarManager: ステータス表示管理
 * - PresetDisplayManager: プリセット表示管理
 */

// ==== UI設定定数 ====
const UI_CONFIG = {
    // ポップアップ設定
    POPUP_ANIMATION_DURATION: 300,
    POPUP_MIN_WIDTH: 280,
    POPUP_MIN_HEIGHT: 350,
    
    // スライダー設定
    SLIDER_UPDATE_THROTTLE: 16, // 60fps
    SLIDER_DEBUG: false,
    
    // ドラッグ設定
    DRAG_THRESHOLD: 3,
    
    // プリセット設定
    SIZE_PRESETS: [1, 2, 4, 8, 16, 32],
    SIZE_PREVIEW_MIN: 0.5,
    SIZE_PREVIEW_MAX: 20
};

// ==== UIイベント定数 ====
const UI_EVENTS = {
    TOOL_SELECTED: 'ui:tool_selected',
    POPUP_OPENED: 'ui:popup_opened',
    POPUP_CLOSED: 'ui:popup_closed',
    SETTING_CHANGED: 'ui:setting_changed',
    COORDINATES_UPDATED: 'ui:coordinates_updated'
};

// ==== スライダーコントローラー ====
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
     * DOM要素を検索
     */
    findElements() {
        const container = document.getElementById(this.sliderId);
        if (!container) {
            console.warn(`スライダー要素が見つかりません: ${this.sliderId}`);
            return {};
        }
        
        const valueDisplay = this.findValueDisplayElement(container);
        
        return {
            container,
            track: container.querySelector('.slider-track'),
            handle: container.querySelector('.slider-handle'),
            valueDisplay
        };
    }
    
    /**
     * valueDisplay要素を検索
     */
    findValueDisplayElement(container) {
        let valueDisplay = null;
        
        // 複数の方法で検索
        if (container.parentNode) {
            valueDisplay = container.parentNode.querySelector('.slider-value');
        }
        
        if (!valueDisplay) {
            const controls = container.closest('.slider-controls');
            if (controls) {
                valueDisplay = controls.querySelector('.slider-value');
            }
        }
        
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
        
        container.addEventListener('mousedown', (e) => this.onMouseDown(e));
        document.addEventListener('mousemove', (e) => this.onMouseMove(e));
        document.addEventListener('mouseup', () => this.onMouseUp());
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
     * 値を設定
     */
    setValue(value, updateDisplay = true) {
        const oldValue = this.value;
        this.value = Math.max(this.min, Math.min(this.max, value));
        
        if (updateDisplay) {
            this.updateDisplay();
        }
        
        if (this.updateCallback && Math.abs(this.value - oldValue) > 0.001) {
            this.throttledCallback();
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
     * 表示更新
     */
    updateDisplay() {
        if (!this.elements.track || !this.elements.handle) return;
        
        const percentage = ((this.value - this.min) / (this.max - this.min)) * 100;
        
        this.elements.track.style.width = percentage + '%';
        this.elements.handle.style.left = percentage + '%';
        
        this.updateValueDisplay();
    }
    
    /**
     * 数値表示更新
     */
    updateValueDisplay() {
        if (!this.elements.valueDisplay || !this.updateCallback) return;
        
        try {
            const displayValue = this.updateCallback(this.value, true);
            
            if (typeof displayValue === 'string' && displayValue.trim()) {
                this.elements.valueDisplay.textContent = displayValue;
                this.elements.valueDisplay.style.display = 'block';
                this.elements.valueDisplay.style.visibility = 'visible';
            } else {
                this.elements.valueDisplay.textContent = this.value.toFixed(1);
            }
            
        } catch (error) {
            this.elements.valueDisplay.textContent = this.value.toFixed(1);
            console.error(`[${this.sliderId}] 数値表示更新エラー:`, error);
        }
    }
    
    adjustValue(delta) {
        this.setValue(this.value + delta);
    }
    
    destroy() {
        if (this.throttleTimeout) {
            clearTimeout(this.throttleTimeout);
        }
    }
}

// ==== ポップアップマネージャー ====
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
        
        this.hideAllPopups();
        
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
        this.popups.forEach((popupData) => {
            popupData.element.classList.remove('show');
        });
        this.activePopup = null;
    }
    
    setupGlobalListeners() {
        document.addEventListener('click', (event) => {
            if (!event.target.closest('.popup-panel') && 
                !event.target.closest('.tool-button[data-popup]')) {
                this.hideAllPopups();
            }
        });
        
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

// ==== プリセット表示管理 ====
class PresetDisplayManager {
    constructor(toolsSystem) {
        this.toolsSystem = toolsSystem;
    }
    
    /**
     * ライブプレビュー更新
     */
    updateLivePreview(size, opacity, color = null) {
        if (!this.toolsSystem) return;
        
        const penPresetManager = this.toolsSystem.getPenPresetManager();
        if (!penPresetManager) return;
        
        penPresetManager.updateActivePresetLive(size, opacity, color);
        this.updatePresetsDisplay();
    }
    
    /**
     * プリセット表示の更新
     */
    updatePresetsDisplay() {
        if (!this.toolsSystem) return;
        
        const penPresetManager = this.toolsSystem.getPenPresetManager();
        if (!penPresetManager) return;
        
        const previewData = penPresetManager.generatePreviewData();
        const presetsContainer = document.getElementById('size-presets');
        
        if (!presetsContainer) return;
        
        const presetItems = presetsContainer.querySelectorAll('.size-preset-item');
        
        previewData.forEach((data, index) => {
            if (index < presetItems.length) {
                const item = presetItems[index];
                const circle = item.querySelector('.size-preview-circle');
                const label = item.querySelector('.size-preview-label');
                const percent = item.querySelector('.size-preview-percent');
                
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
                
                item.classList.toggle('active', data.isActive);
            }
        });
    }
    
    /**
     * プリセット選択処理
     */
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

// ==== エクスポート ====
if (typeof window !== 'undefined') {
    window.SliderController = SliderController;
    window.PopupManager = PopupManager;
    window.StatusBarManager = StatusBarManager;
    window.PresetDisplayManager = PresetDisplayManager;
    window.UI_CONFIG = UI_CONFIG;
    window.UI_EVENTS = UI_EVENTS;
    
    console.log('🎨 ui/components.js 読み込み完了');
    console.log('📦 利用可能クラス: SliderController, PopupManager, StatusBarManager, PresetDisplayManager');
}

// ES6 module export (将来のTypeScript移行用)
// export { 
//     SliderController, 
//     PopupManager, 
//     StatusBarManager, 
//     PresetDisplayManager,
//     UI_CONFIG,
//     UI_EVENTS 
// };