/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v0.8
 * UI管理システム - ui-manager.js
 * 
 * 責務: UIコンテナ管理・UIイベント処理
 * 依存: app-core.js, drawing-tools.js
 */

// ==== UI設定定数 ====
const UI_CONFIG = {
    // ポップアップ設定
    POPUP_ANIMATION_DURATION: 300,
    POPUP_MIN_WIDTH: 280,
    POPUP_MIN_HEIGHT: 200,
    
    // スライダー設定
    SLIDER_UPDATE_THROTTLE: 16, // 60fps
    
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
    
    findElements() {
        const container = document.getElementById(this.sliderId);
        if (!container) {
            console.warn(`スライダー要素が見つかりません: ${this.sliderId}`);
            return {};
        }
        
        return {
            container,
            track: container.querySelector('.slider-track'),
            handle: container.querySelector('.slider-handle'),
            valueDisplay: container.parentNode.querySelector('.slider-value')
        };
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
    
    setValue(value, updateDisplay = true) {
        const oldValue = this.value;
        this.value = Math.max(this.min, Math.min(this.max, value));
        
        if (updateDisplay) {
            this.updateDisplay();
        }
        
        // スロットリング付きコールバック実行
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
    
    updateDisplay() {
        if (!this.elements.track || !this.elements.handle) return;
        
        const percentage = ((this.value - this.min) / (this.max - this.min)) * 100;
        
        this.elements.track.style.width = percentage + '%';
        this.elements.handle.style.left = percentage + '%';
        
        if (this.elements.valueDisplay && this.updateCallback) {
            // updateCallbackが表示用の値を返すと仮定
            const displayValue = this.updateCallback(this.value, true);
            if (typeof displayValue === 'string') {
                this.elements.valueDisplay.textContent = displayValue;
            }
        }
    }
    
    adjustValue(delta) {
        this.setValue(this.value + delta);
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

// ==== プリセット管理 ====
class PresetManager {
    constructor() {
        this.sizePresets = UI_CONFIG.SIZE_PRESETS;
        this.currentSize = 16.0;
        this.currentOpacity = 85.0;
        this.setupPresetListeners();
    }
    
    setupPresetListeners() {
        document.querySelectorAll('.size-preset-item').forEach(preset => {
            preset.addEventListener('click', () => {
                const size = parseFloat(preset.getAttribute('data-size'));
                this.selectSizePreset(size);
            });
        });
    }
    
    selectSizePreset(size) {
        this.currentSize = size;
        this.updatePresetDisplay();
        
        // サイズスライダーも更新
        const event = new CustomEvent(UI_EVENTS.SETTING_CHANGED, {
            detail: { type: 'brushSize', value: size }
        });
        document.dispatchEvent(event);
    }
    
    updatePresetDisplay() {
        document.querySelectorAll('.size-preset-item').forEach(preset => {
            const presetSize = parseFloat(preset.getAttribute('data-size'));
            const circle = preset.querySelector('.size-preview-circle');
            const label = preset.querySelector('.size-preview-label');
            const percent = preset.querySelector('.size-preview-percent');
            
            if (!circle || !label || !percent) return;
            
            // アクティブ状態の更新
            const isActive = Math.abs(presetSize - this.currentSize) < 0.1;
            preset.classList.toggle('active', isActive);
            
            // 円のサイズ更新
            let circleSize;
            if (isActive) {
                circleSize = Math.max(
                    UI_CONFIG.SIZE_PREVIEW_MIN, 
                    Math.min(UI_CONFIG.SIZE_PREVIEW_MAX, (this.currentSize / 100) * 19.5 + 0.5)
                );
            } else {
                circleSize = Math.max(
                    UI_CONFIG.SIZE_PREVIEW_MIN, 
                    Math.min(UI_CONFIG.SIZE_PREVIEW_MAX, (presetSize / 100) * 19.5 + 0.5)
                );
            }
            
            circle.style.width = circleSize + 'px';
            circle.style.height = circleSize + 'px';
            circle.style.opacity = this.currentOpacity / 100;
            
            // ラベル更新
            label.textContent = isActive ? this.currentSize.toFixed(1) : presetSize.toString();
            percent.textContent = Math.round(this.currentOpacity) + '%';
        });
    }
    
    updateOpacity(opacity) {
        this.currentOpacity = opacity;
        this.updatePresetDisplay();
    }
    
    updateSize(size) {
        this.currentSize = size;
        this.updatePresetDisplay();
    }
}

// ==== メインUI管理クラス ====
class UIManager {
    constructor(app, toolsSystem) {
        this.app = app;
        this.toolsSystem = toolsSystem;
        
        // サブシステム
        this.popupManager = new PopupManager();
        this.statusBar = new StatusBarManager();
        this.presetManager = new PresetManager();
        
        // スライダー管理
        this.sliders = new Map();
        
        // 状態
        this.isInitialized = false;
        this.coordinateUpdateThrottle = null;
    }
    
    async init() {
        try {
            console.log('🎯 UIManager初期化開始...');
            
            this.setupToolButtons();
            this.setupPopups();
            this.setupSliders();
            this.setupResize();
            this.setupCheckboxes();
            this.setupAppEventListeners();
            
            // 初期状態の更新
            this.updateAllDisplays();
            
            this.isInitialized = true;
            console.log('✅ UIManager初期化完了');
            
        } catch (error) {
            console.error('❌ UIManager初期化エラー:', error);
            throw error;
        }
    }
    
    setupToolButtons() {
        document.querySelectorAll('.tool-button').forEach(button => {
            button.addEventListener('click', (event) => {
                if (button.classList.contains('disabled')) return;
                
                const toolId = button.id;
                const popupId = button.getAttribute('data-popup');
                
                this.handleToolButtonClick(toolId, popupId, button);
            });
        });
        
        console.log('✅ ツールボタン設定完了');
    }
    
    handleToolButtonClick(toolId, popupId, button) {
        // ツール切り替え
        if (toolId === 'pen-tool') {
            this.setActiveTool('pen', button);
        } else if (toolId === 'eraser-tool') {
            this.setActiveTool('eraser', button);
        }
        
        // ポップアップ表示/非表示
        if (popupId) {
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
    
    setupPopups() {
        // ポップアップの登録
        this.popupManager.registerPopup('pen-settings');
        this.popupManager.registerPopup('resize-settings');
        
        console.log('✅ ポップアップ設定完了');
    }
    
    setupSliders() {
        // ペンサイズスライダー
        this.createSlider('pen-size-slider', 0.1, 100, 16.0, (value, displayOnly = false) => {
            if (!displayOnly) {
                this.toolsSystem.updateBrushSettings({ size: value });
                this.presetManager.updateSize(value);
            }
            return value.toFixed(1) + 'px';
        });
        
        // 不透明度スライダー
        this.createSlider('pen-opacity-slider', 0, 100, 85.0, (value, displayOnly = false) => {
            if (!displayOnly) {
                this.toolsSystem.updateBrushSettings({ opacity: value / 100 });
                this.presetManager.updateOpacity(value);
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
    
    createSlider(sliderId, min, max, initial, callback) {
        const slider = new SliderController(sliderId, min, max, initial, callback);
        this.sliders.set(sliderId, slider);
        return slider;
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
        
        // プリセット表示更新
        this.presetManager.updateSize(brushSettings.size);
        this.presetManager.updateOpacity(brushSettings.opacity * 100);
        
        console.log('✅ 全ディスプレイ更新完了');
    }
    
    // ==== 公開API ====
    showPopup(popupId) {
        return this.popupManager.showPopup(popupId);
    }
    
    hidePopup(popupId) {
        return this.popupManager.hidePopup(popupId);
    }
    
    hideAllPopups() {
        this.popupManager.hideAllPopups();
    }
    
    updateSliderValue(sliderId, value) {
        const slider = this.sliders.get(sliderId);
        if (slider) {
            slider.setValue(value);
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
    
    // ==== 通知表示 ====
    showNotification(message, type = 'info', duration = 3000) {
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
    
    // ==== デバッグ情報 ====
    getUIStats() {
        return {
            initialized: this.isInitialized,
            activePopup: this.popupManager.activePopup,
            sliderCount: this.sliders.size,
            popupCount: this.popupManager.popups.size
        };
    }
    
    // ==== クリーンアップ ====
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
        
        console.log('UIManager destroyed');
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

// ==== エクスポート ====
if (typeof window !== 'undefined') {
    window.UIManager = UIManager;
    window.SliderController = SliderController;
    window.PopupManager = PopupManager;
    window.StatusBarManager = StatusBarManager;
    window.PresetManager = PresetManager;
    window.UI_CONFIG = UI_CONFIG;
    window.UI_EVENTS = UI_EVENTS;
}

// ES6 module export (将来のTypeScript移行用)
// export { 
//     UIManager, 
//     SliderController, 
//     PopupManager, 
//     StatusBarManager, 
//     PresetManager,
//     UI_CONFIG,
//     UI_EVENTS 
// };