/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1rev5
 * UIコンポーネント群 - ui/components.js
 * 
 * 🔧 v1rev5修正内容（Phase1: プリセット動的表示対応 + 構文エラー修正）:
 * 1. ✅ 構文エラー修正（Unexpected end of input解決）
 * 2. ✅ クラス定義順序の修正（SliderController等を先頭に移動）
 * 3. ✅ PresetDisplayManager強化（動的プレビューロジック実装）
 * 4. ✅ setPenPresetManager()メソッド追加
 * 5. ✅ updatePresetsDisplay()の改良
 * 6. ✅ 動的サイズ変更の完全対応
 * 7. ✅ スライダー値同期の強化
 * 
 * Phase1目標: プリセット表示システムの完全修復
 * 
 * 責務: 独立性の高いUIコンポーネント（ui-manager.jsから分離）
 * 依存: app-core.js, drawing-tools.js（間接的）
 * 
 * 含まれるクラス:
 * - SliderController: スライダー操作管理
 * - PopupManager: ポップアップ表示管理
 * - StatusBarManager: ステータス表示管理
 * - PresetDisplayManager: プリセット表示管理（v1rev5強化版）
 */

// ==== UIイベント定数（先頭に移動）====
const UI_EVENTS = {
    TOOL_SELECTED: 'ui:tool_selected',
    POPUP_OPENED: 'ui:popup_opened',
    POPUP_CLOSED: 'ui:popup_closed',
    SETTING_CHANGED: 'ui:setting_changed',
    COORDINATES_UPDATED: 'ui:coordinates_updated',
    // 🆕 v1rev5: プリセット関連イベント
    PRESET_UPDATED: 'ui:preset_updated',
    PREVIEW_SIZE_CHANGED: 'ui:preview_size_changed'
};

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
    SIZE_PREVIEW_MAX: 20,
    
    // 🆕 v1rev5: 動的プレビュー設定
    DYNAMIC_PREVIEW_ENABLED: true,
    LIVE_UPDATE_THROTTLE: 16, // 60fps
    LINEAR_TRANSFORM_SCALE: 19.5 // プレビューサイズのスケール
};

// ==== スライダーコントローラー（先頭に移動）====
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

// ==== 🆕 v1rev5: プリセット表示管理（強化版）====
class PresetDisplayManager {
    constructor(toolsSystem) {
        this.toolsSystem = toolsSystem;
        this.penPresetManager = null; // 🆕 v1rev5: 後で設定
        this.updateThrottle = null;
        this.isUpdating = false;
        
        console.log('🎨 PresetDisplayManager初期化完了（v1rev5強化版）');
    }
    
    // 🆕 v1rev5: PenPresetManager設定メソッド
    setPenPresetManager(penPresetManager) {
        this.penPresetManager = penPresetManager;
        console.log('🔧 PresetDisplayManager: PenPresetManager設定完了');
    }
    
    /**
     * 🆕 v1rev5: ライブプレビュー更新（強化版）
     */
    updateLivePreview(size, opacity, color = null) {
        if (!this.penPresetManager) {
            console.warn('PenPresetManager が設定されていません');
            return;
        }
        
        this.penPresetManager.updateActivePresetLive(size, opacity, color);
        this.throttledUpdate();
        
        // イベント発火
        if (typeof window !== 'undefined' && window.dispatchEvent) {
            window.dispatchEvent(new CustomEvent(UI_EVENTS.PREVIEW_SIZE_CHANGED, {
                detail: { size, opacity, color }
            }));
        }
    }
    
    /**
     * 🆕 v1rev5: プリセット表示の更新（完全強化版）
     */
    updatePresetsDisplay() {
        if (this.isUpdating) {
            console.log('🔄 プリセット表示更新スキップ（既に実行中）');
            return;
        }
        
        if (!this.penPresetManager) {
            console.warn('PenPresetManager が設定されていません');
            return;
        }
        
        this.isUpdating = true;
        
        try {
            const previewData = this.penPresetManager.generatePreviewData();
            const presetsContainer = document.getElementById('size-presets');
            
            if (!presetsContainer) {
                console.warn('size-presets コンテナが見つかりません');
                return;
            }
            
            const presetItems = presetsContainer.querySelectorAll('.size-preset-item');
            
            if (presetItems.length === 0) {
                console.warn('プリセット項目が見つかりません');
                return;
            }
            
            // 🆕 v1rev5: 各プリセット項目を動的に更新
            previewData.forEach((data, index) => {
                if (index < presetItems.length) {
                    this.updatePresetItem(presetItems[index], data);
                }
            });
            
            console.log(`🎨 プリセット表示更新完了: ${previewData.length}項目`);
            
            // イベント発火
            if (typeof window !== 'undefined' && window.dispatchEvent) {
                window.dispatchEvent(new CustomEvent(UI_EVENTS.PRESET_UPDATED, {
                    detail: { itemCount: previewData.length }
                }));
            }
            
        } catch (error) {
            console.error('プリセット表示更新エラー:', error);
        } finally {
            this.isUpdating = false;
        }
    }
    
    /**
     * 🆕 v1rev5: 個別プリセット項目の更新
     */
    updatePresetItem(item, data) {
        try {
            // DOM要素を取得
            const circle = item.querySelector('.size-preview-circle');
            const sizeLabel = item.querySelector('.size-preview-label, .size-label');
            const opacityLabel = item.querySelector('.size-preview-percent, .opacity-label');
            
            // HTML属性更新
            item.setAttribute('data-size', data.dataSize);
            
            // 🆕 v1rev5: 動的サイズ更新（●の大きさ）
            if (circle) {
                // サイズ変更のアニメーション用CSSトランジション
                if (!circle.style.transition) {
                    circle.style.transition = 'width 0.1s ease-out, height 0.1s ease-out, opacity 0.1s ease-out';
                }
                
                circle.style.width = data.displaySize + 'px';
                circle.style.height = data.displaySize + 'px';
                circle.style.background = data.color;
                circle.style.opacity = data.opacity;
                
                // 最小サイズのガード
                if (data.displaySize < UI_CONFIG.SIZE_PREVIEW_MIN) {
                    circle.style.width = UI_CONFIG.SIZE_PREVIEW_MIN + 'px';
                    circle.style.height = UI_CONFIG.SIZE_PREVIEW_MIN + 'px';
                }
            }
            
            // 🆕 v1rev5: サイズラベルの同期更新
            if (sizeLabel) {
                sizeLabel.textContent = data.sizeLabel;
                
                // アクティブ項目のラベル強調
                if (data.isActive) {
                    sizeLabel.style.fontWeight = 'bold';
                    sizeLabel.style.color = '#d00';
                } else {
                    sizeLabel.style.fontWeight = 'normal';
                    sizeLabel.style.color = '#333';
                }
            }
            
            // 🆕 v1rev5: 透明度ラベルの同期更新
            if (opacityLabel) {
                opacityLabel.textContent = data.opacityLabel;
                
                // アクティブ項目のラベル強調
                if (data.isActive) {
                    opacityLabel.style.fontWeight = 'bold';
                    opacityLabel.style.color = '#d00';
                } else {
                    opacityLabel.style.fontWeight = 'normal';
                    opacityLabel.style.color = '#666';
                }
            }
            
            // 🆕 v1rev5: アクティブ状態の視覚的反映
            item.classList.toggle('active', data.isActive);
            
            // アクティブ項目にボーダー強調
            if (data.isActive) {
                item.style.borderColor = '#d00';
                item.style.backgroundColor = '#ffe6e6';
            } else {
                item.style.borderColor = '#ccc';
                item.style.backgroundColor = 'transparent';
            }
            
        } catch (error) {
            console.error('プリセット項目更新エラー:', error, data);
        }
    }
    
    /**
     * 🆕 v1rev5: スロットリング付き更新
     */
    throttledUpdate() {
        if (this.updateThrottle) {
            clearTimeout(this.updateThrottle);
        }
        
        this.updateThrottle = setTimeout(() => {
            this.updatePresetsDisplay();
            this.updateThrottle = null;
        }, UI_CONFIG.LIVE_UPDATE_THROTTLE);
    }
    
    /**
     * 🆕 v1rev5: プリセット選択処理（強化版）
     */
    handlePresetSelection(presetSize) {
        if (!this.penPresetManager) {
            console.warn('PenPresetManager が設定されていません');
            return null;
        }
        
        const presetId = this.penPresetManager.getPresetIdBySize(presetSize);
        if (!presetId) {
            console.warn(`プリセットID取得失敗: サイズ${presetSize}`);
            return null;
        }
        
        const preset = this.penPresetManager.selectPreset(presetId);
        if (preset) {
            // 即座に表示を更新
            this.updatePresetsDisplay();
            console.log(`🎯 プリセット選択処理: ${preset.name}`);
        }
        
        return preset;
    }
    
    /**
     * 🆕 v1rev5: プリセット状態の取得
     */
    getPresetDisplayState() {
        if (!this.penPresetManager) return null;
        
        return {
            activePresetId: this.penPresetManager.getActivePresetId(),
            hasLiveValues: !!this.penPresetManager.currentLiveValues,
            presetCount: this.penPresetManager.presets.size,
            isUpdating: this.isUpdating
        };
    }
    
    /**
     * 🆕 v1rev5: 強制更新メソッド
     */
    forceUpdate() {
        if (this.updateThrottle) {
            clearTimeout(this.updateThrottle);
            this.updateThrottle = null;
        }
        
        this.updatePresetsDisplay();
    }
    
    /**
     * 🆕 v1rev5: デバッグ情報表示
     */
    debugPresetDisplay() {
        console.group('🔍 PresetDisplayManager デバッグ情報（v1rev5）');
        
        console.log('基本状態:', this.getPresetDisplayState());
        
        if (this.penPresetManager) {
            const previewData = this.penPresetManager.generatePreviewData();
            console.log('プレビューデータ:', previewData);
            
            console.log('ライブ値:', this.penPresetManager.currentLiveValues);
            console.log('アクティブプリセット:', this.penPresetManager.getActivePreset());
        }
        
        // DOM状態確認
        const presetsContainer = document.getElementById('size-presets');
        if (presetsContainer) {
            const presetItems = presetsContainer.querySelectorAll('.size-preset-item');
            console.log(`DOM項目数: ${presetItems.length}`);
            
            presetItems.forEach((item, index) => {
                const circle = item.querySelector('.size-preview-circle');
                console.log(`項目${index}:`, {
                    dataSize: item.getAttribute('data-size'),
                    circleSize: circle ? `${circle.style.width} x ${circle.style.height}` : 'N/A',
                    isActive: item.classList.contains('active')
                });
            });
        }
        
        console.groupEnd();
    }
    
    /**
     * 🆕 v1rev5: クリーンアップ
     */
    destroy() {
        if (this.updateThrottle) {
            clearTimeout(this.updateThrottle);
            this.updateThrottle = null;
        }
        
        this.penPresetManager = null;
        this.toolsSystem = null;
        
        console.log('🧹 PresetDisplayManager クリーンアップ完了');
    }
}

// ==== エクスポート（v1rev5構文エラー修正版）====
if (typeof window !== 'undefined') {
    window.SliderController = SliderController;
    window.PopupManager = PopupManager;
    window.StatusBarManager = StatusBarManager;
    window.PresetDisplayManager = PresetDisplayManager;
    window.UI_CONFIG = UI_CONFIG;
    window.UI_EVENTS = UI_EVENTS;
    
    console.log('🎨 ui/components.js v1rev5 読み込み完了（構文エラー修正 + プリセット動的表示対応版）');
    console.log('📦 利用可能クラス: SliderController, PopupManager, StatusBarManager, PresetDisplayManager（v1rev5強化版）');
    console.log('🔧 v1rev5修正項目:');
    console.log('  ✅ 構文エラー修正（Unexpected end of input解決）');
    console.log('  ✅ クラス定義順序の修正（SliderController等を先頭に移動）');
    console.log('  ✅ PresetDisplayManager強化（動的プレビューロジック実装）');
    console.log('  ✅ setPenPresetManager()メソッド追加');
    console.log('  ✅ updatePresetsDisplay()の改良');
    console.log('  ✅ 動的サイズ変更の完全対応');
    console.log('  ✅ スライダー値同期の強化');
    console.log('  ✅ updatePresetItem()個別更新メソッド追加');
    console.log('  ✅ throttledUpdate()スロットリング機能');
    console.log('  ✅ デバッグ機能の充実（debugPresetDisplay）');
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