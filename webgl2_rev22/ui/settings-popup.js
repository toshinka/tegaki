/**
 * ============================================================
 * settings-popup.js - v3.0 Phase 4: 流量UI統合版
 * ============================================================
 * 親ファイル: ui-panels.js
 * 依存ファイル: 
 *   - system/event-bus.js (EventBus)
 *   - system/settings-manager.js (SettingsManager)
 *   - system/drawing/drawing-engine.js (DrawingEngine)
 * ============================================================
 * 【v3.0 改修内容】
 * ✅ 流量（フロー）スライダー追加
 * ✅ 流量感度スライダー追加
 * ✅ 蓄積モードチェックボックス追加
 * ✅ スライダー縦間隔を詰めてコンパクト化
 * ✅ スクロールバーをfutabaカラーに統一
 * ✅ フォントサイズ調整（説明文10px）
 * ============================================================
 */

window.TegakiUI = window.TegakiUI || {};

window.TegakiUI.SettingsPopup = class {
    constructor(dependencies) {
        this.drawingEngine = dependencies.drawingEngine;
        this.eventBus = window.TegakiEventBus;
        this.settingsManager = this._getSettingsManager();
        
        this.popup = null;
        this.isVisible = false;
        this.initialized = false;
        
        this.isDraggingMinPressure = false;
        this.isDraggingSensitivity = false;
        this.isDraggingSmoothing = false;
        this.isDraggingFlowOpacity = false;
        this.isDraggingFlowSensitivity = false;
        
        this.activeSliderPointerId = null;
        
        this.elements = {};
        
        this.currentMinPressure = 0.0;
        this.currentSensitivity = 1.0;
        this.currentSmoothing = 0.5;
        this.currentFlowOpacity = 1.0;
        this.currentFlowSensitivity = 1.0;
        this.currentFlowAccumulation = true;
        
        this.MIN_PRESSURE_SIZE = 0.0;
        this.MAX_PRESSURE_SIZE = 1.0;
        this.MIN_SENSITIVITY = 0.1;
        this.MAX_SENSITIVITY = 3.0;
        this.MIN_SMOOTHING = 0.0;
        this.MAX_SMOOTHING = 1.0;
        this.MIN_FLOW_OPACITY = 0.0;
        this.MAX_FLOW_OPACITY = 1.0;
        this.MIN_FLOW_SENSITIVITY = 0.1;
        this.MAX_FLOW_SENSITIVITY = 2.0;
        
        this._ensurePopupElement();
        this._setupEventListeners();
    }
    
    _setupEventListeners() {
        if (!this.eventBus) return;
        
        this.eventBus.on('ui:open-settings', () => {
            this.show();
        });
    }
    
    _getSettingsManager() {
        const manager = window.TegakiSettingsManager;
        
        if (manager && typeof manager.get === 'function') {
            return manager;
        }
        
        if (manager && typeof manager === 'function') {
            const instance = new manager(window.TegakiEventBus, window.TEGAKI_CONFIG);
            window.TegakiSettingsManager = instance;
            return instance;
        }
        
        return null;
    }
    
    _ensurePopupElement() {
        this.popup = document.getElementById('settings-popup');
        
        if (!this.popup) {
            this._createPopupElement();
        } else {
            this.popup.classList.remove('show');
            this.popup.style.display = '';
            
            if (this.popup.children.length === 0) {
                this._populateContent();
            }
        }
        
        if (this.popup) {
            this.popup.style.top = '60px';
            this.popup.style.left = '60px';
            this.popup.style.maxHeight = 'calc(100vh - 120px)';
            this.popup.style.overflowY = 'auto';
        }
    }
    
    _createPopupElement() {
        const container = document.querySelector('.canvas-area');
        if (!container) return;
        
        const popupDiv = document.createElement('div');
        popupDiv.id = 'settings-popup';
        popupDiv.className = 'popup-panel';
        popupDiv.style.top = '60px';
        popupDiv.style.left = '60px';
        popupDiv.style.maxHeight = 'calc(100vh - 120px)';
        popupDiv.style.overflowY = 'auto';
        
        container.appendChild(popupDiv);
        this.popup = popupDiv;
        this._populateContent();
    }
    
    _populateContent() {
        if (!this.popup) return;
        
        this.popup.innerHTML = `
            <div class="popup-title" style="font-size: 15px; font-weight: 600; color: var(--futaba-maroon); margin-bottom: 12px; text-align: center;">
                設定
            </div>
            
            <div class="setting-group" style="margin-bottom: 10px; padding-bottom: 8px;">
                <div class="setting-label" style="font-size: 13px; margin-bottom: 6px;">筆圧最小値</div>
                <div class="slider-container">
                    <div class="slider" id="min-pressure-slider">
                        <div class="slider-track" id="min-pressure-track"></div>
                        <div class="slider-handle" id="min-pressure-handle"></div>
                    </div>
                    <div class="slider-value" id="min-pressure-value">0%</div>
                </div>
                <div style="font-size: 10px; color: var(--text-secondary); margin-top: 3px; line-height: 1.3;">
                    0%: 0荷重で極細線 / 100%: 常に設定サイズ（筆圧無効）
                </div>
            </div>
            
            <div class="setting-group" style="margin-bottom: 10px; padding-bottom: 8px;">
                <div class="setting-label" style="font-size: 13px; margin-bottom: 6px;">筆圧感度</div>
                <div class="slider-container">
                    <div class="slider" id="sensitivity-slider">
                        <div class="slider-track" id="sensitivity-track"></div>
                        <div class="slider-handle" id="sensitivity-handle"></div>
                    </div>
                    <div class="slider-value" id="sensitivity-value">100%</div>
                </div>
                <div style="font-size: 10px; color: var(--text-secondary); margin-top: 3px; line-height: 1.3;">
                    100%: 標準感度 / 200%以上: 軽い筆圧で最大サイズ到達
                </div>
            </div>
            
            <div class="setting-group" style="margin-bottom: 10px; padding-bottom: 8px;">
                <div class="setting-label" style="font-size: 13px; margin-bottom: 6px;">線補正（スムーズ度）</div>
                <div class="slider-container">
                    <div class="slider" id="smoothing-slider">
                        <div class="slider-track" id="smoothing-track"></div>
                        <div class="slider-handle" id="smoothing-handle"></div>
                    </div>
                    <div class="slider-value" id="smoothing-value">50%</div>
                </div>
                <div style="font-size: 10px; color: var(--text-secondary); margin-top: 3px; line-height: 1.3;">
                    線の滑らかさ。値が大きいほど線が滑らかになりますが反応が遅くなります。
                </div>
            </div>
            
            <div class="setting-group" style="margin-bottom: 10px; padding-bottom: 8px;">
                <div class="setting-label" style="font-size: 13px; margin-bottom: 6px;">流量（フロー）</div>
                <div class="slider-container">
                    <div class="slider" id="flow-opacity-slider">
                        <div class="slider-track" id="flow-opacity-track"></div>
                        <div class="slider-handle" id="flow-opacity-handle"></div>
                    </div>
                    <div class="slider-value" id="flow-opacity-value">100%</div>
                </div>
                <div style="font-size: 10px; color: var(--text-secondary); margin-top: 3px; line-height: 1.3;">
                    ストローク全体の透明度。値が小さいほど薄く描画されます。
                </div>
            </div>
            
            <div class="setting-group" style="margin-bottom: 10px; padding-bottom: 8px;">
                <div class="setting-label" style="font-size: 13px; margin-bottom: 6px;">流量感度</div>
                <div class="slider-container">
                    <div class="slider" id="flow-sensitivity-slider">
                        <div class="slider-track" id="flow-sensitivity-track"></div>
                        <div class="slider-handle" id="flow-sensitivity-handle"></div>
                    </div>
                    <div class="slider-value" id="flow-sensitivity-value">100%</div>
                </div>
                <div style="font-size: 10px; color: var(--text-secondary); margin-top: 3px; line-height: 1.3;">
                    筆圧による透明度変化の感度。100%で標準、高いほど軽い筆圧で濃くなります。
                </div>
            </div>
            
            <div class="setting-group" style="margin-bottom: 10px; padding-bottom: 8px;">
                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 13px; color: var(--futaba-maroon);">
                    <input type="checkbox" id="flow-accumulation" checked style="width: 16px; height: 16px; cursor: pointer; accent-color: var(--futaba-maroon);">
                    <span>蓄積モード（重ね塗りで濃くなる）</span>
                </label>
                <div style="font-size: 10px; color: var(--text-secondary); margin-top: 3px; margin-left: 24px; line-height: 1.3;">
                    ONで加算合成、OFFで通常合成。エアブラシ・水彩風表現に有効。
                </div>
            </div>
            
            <div class="setting-group" style="margin-bottom: 0; padding-bottom: 0; border-bottom: none;">
                <div class="setting-label" style="font-size: 13px; margin-bottom: 6px;">ステータスパネル</div>
                <div style="display: flex; gap: 12px; align-items: center;">
                    <button id="status-panel-toggle" style="flex: 1; padding: 7px 12px; border: 2px solid var(--futaba-light-medium); border-radius: 6px; background: var(--futaba-background); color: var(--futaba-maroon); font-weight: 600; cursor: pointer; transition: all 0.2s; font-size: 12px;">
                        非表示
                    </button>
                    <span id="status-panel-state" style="font-size: 11px; color: var(--text-secondary); min-width: 60px; text-align: right;">
                        表示中
                    </span>
                </div>
                <div style="font-size: 10px; color: var(--text-secondary); margin-top: 3px; line-height: 1.3;">
                    画面左上のステータス情報の表示/非表示を切り替えます。
                </div>
            </div>
        `;
    }
    
    _cacheElements() {
        this.elements = {
            minPressureSlider: document.getElementById('min-pressure-slider'),
            minPressureTrack: document.getElementById('min-pressure-track'),
            minPressureHandle: document.getElementById('min-pressure-handle'),
            minPressureValue: document.getElementById('min-pressure-value'),
            
            sensitivitySlider: document.getElementById('sensitivity-slider'),
            sensitivityTrack: document.getElementById('sensitivity-track'),
            sensitivityHandle: document.getElementById('sensitivity-handle'),
            sensitivityValue: document.getElementById('sensitivity-value'),
            
            smoothingSlider: document.getElementById('smoothing-slider'),
            smoothingTrack: document.getElementById('smoothing-track'),
            smoothingHandle: document.getElementById('smoothing-handle'),
            smoothingValue: document.getElementById('smoothing-value'),
            
            flowOpacitySlider: document.getElementById('flow-opacity-slider'),
            flowOpacityTrack: document.getElementById('flow-opacity-track'),
            flowOpacityHandle: document.getElementById('flow-opacity-handle'),
            flowOpacityValue: document.getElementById('flow-opacity-value'),
            
            flowSensitivitySlider: document.getElementById('flow-sensitivity-slider'),
            flowSensitivityTrack: document.getElementById('flow-sensitivity-track'),
            flowSensitivityHandle: document.getElementById('flow-sensitivity-handle'),
            flowSensitivityValue: document.getElementById('flow-sensitivity-value'),
            
            flowAccumulation: document.getElementById('flow-accumulation'),
            
            statusToggle: document.getElementById('status-panel-toggle'),
            statusState: document.getElementById('status-panel-state')
        };
        
        const sliderStyle = `
            flex: 1;
            height: 6px;
            background: var(--futaba-light-medium);
            border-radius: 3px;
            position: relative;
            cursor: pointer;
        `;
        
        const trackStyle = `
            height: 100%;
            background: var(--futaba-maroon);
            border-radius: 3px;
            transition: none !important;
        `;
        
        const handleStyle = `
            width: 16px;
            height: 16px;
            background: var(--futaba-maroon);
            border: 2px solid var(--futaba-background);
            border-radius: 50%;
            position: absolute;
            top: 50%;
            transform: translate(-50%, -50%);
            cursor: grab;
            transition: none !important;
            touch-action: none;
        `;
        
        // 全スライダーにスタイル適用
        [
            { slider: this.elements.minPressureSlider, track: this.elements.minPressureTrack, handle: this.elements.minPressureHandle },
            { slider: this.elements.sensitivitySlider, track: this.elements.sensitivityTrack, handle: this.elements.sensitivityHandle },
            { slider: this.elements.smoothingSlider, track: this.elements.smoothingTrack, handle: this.elements.smoothingHandle },
            { slider: this.elements.flowOpacitySlider, track: this.elements.flowOpacityTrack, handle: this.elements.flowOpacityHandle },
            { slider: this.elements.flowSensitivitySlider, track: this.elements.flowSensitivityTrack, handle: this.elements.flowSensitivityHandle }
        ].forEach(({ slider, track, handle }) => {
            if (slider) slider.style.cssText = sliderStyle;
            if (track) track.style.cssText = trackStyle;
            if (handle) handle.style.cssText = handleStyle;
        });
    }
    
    initialize() {
        if (this.initialized) return;
        
        this._cacheElements();
        this._setupSliders();
        this._setupButtons();
        this._loadSettings();
        
        this.initialized = true;
    }
    
    _setupSliders() {
        const globalMoveHandler = (e) => {
            if (!this.isDraggingMinPressure && !this.isDraggingSensitivity && !this.isDraggingSmoothing && 
                !this.isDraggingFlowOpacity && !this.isDraggingFlowSensitivity) return;
            
            e.preventDefault();
            e.stopPropagation();
            
            if (this.isDraggingMinPressure && this.activeSliderPointerId === e.pointerId) {
                this._handleSliderMove(e, this.elements.minPressureSlider, this.MIN_PRESSURE_SIZE, this.MAX_PRESSURE_SIZE, this._updateMinPressureSlider.bind(this));
            }
            if (this.isDraggingSensitivity && this.activeSliderPointerId === e.pointerId) {
                this._handleSliderMove(e, this.elements.sensitivitySlider, this.MIN_SENSITIVITY, this.MAX_SENSITIVITY, this._updateSensitivitySlider.bind(this));
            }
            if (this.isDraggingSmoothing && this.activeSliderPointerId === e.pointerId) {
                this._handleSliderMove(e, this.elements.smoothingSlider, this.MIN_SMOOTHING, this.MAX_SMOOTHING, this._updateSmoothingSlider.bind(this));
            }
            if (this.isDraggingFlowOpacity && this.activeSliderPointerId === e.pointerId) {
                this._handleSliderMove(e, this.elements.flowOpacitySlider, this.MIN_FLOW_OPACITY, this.MAX_FLOW_OPACITY, this._updateFlowOpacitySlider.bind(this));
            }
            if (this.isDraggingFlowSensitivity && this.activeSliderPointerId === e.pointerId) {
                this._handleSliderMove(e, this.elements.flowSensitivitySlider, this.MIN_FLOW_SENSITIVITY, this.MAX_FLOW_SENSITIVITY, this._updateFlowSensitivitySlider.bind(this));
            }
        };
        
        const globalUpHandler = (e) => {
            if (this.activeSliderPointerId !== e.pointerId) return;
            
            if (this.isDraggingMinPressure) {
                this._releaseSlider(this.elements.minPressureHandle, e.pointerId, 'minPressureSize', this.currentMinPressure);
            }
            if (this.isDraggingSensitivity) {
                this._releaseSlider(this.elements.sensitivityHandle, e.pointerId, 'pressureSensitivity', this.currentSensitivity);
            }
            if (this.isDraggingSmoothing) {
                this._releaseSlider(this.elements.smoothingHandle, e.pointerId, 'smoothing', this.currentSmoothing);
            }
            if (this.isDraggingFlowOpacity) {
                this._releaseSlider(this.elements.flowOpacityHandle, e.pointerId, 'flowOpacity', this.currentFlowOpacity);
            }
            if (this.isDraggingFlowSensitivity) {
                this._releaseSlider(this.elements.flowSensitivityHandle, e.pointerId, 'flowSensitivity', this.currentFlowSensitivity);
            }
            
            this.isDraggingMinPressure = false;
            this.isDraggingSensitivity = false;
            this.isDraggingSmoothing = false;
            this.isDraggingFlowOpacity = false;
            this.isDraggingFlowSensitivity = false;
            this.activeSliderPointerId = null;
        };
        
        document.addEventListener('pointermove', globalMoveHandler, { passive: false, capture: true });
        document.addEventListener('pointerup', globalUpHandler, { capture: true });
        document.addEventListener('pointercancel', globalUpHandler, { capture: true });
        
        this._globalMoveHandler = globalMoveHandler;
        this._globalUpHandler = globalUpHandler;
        
        // ハンドルドラッグ設定
        this._setupHandleDrag(this.elements.minPressureHandle, () => { this.isDraggingMinPressure = true; });
        this._setupHandleDrag(this.elements.sensitivityHandle, () => { this.isDraggingSensitivity = true; });
        this._setupHandleDrag(this.elements.smoothingHandle, () => { this.isDraggingSmoothing = true; });
        this._setupHandleDrag(this.elements.flowOpacityHandle, () => { this.isDraggingFlowOpacity = true; });
        this._setupHandleDrag(this.elements.flowSensitivityHandle, () => { this.isDraggingFlowSensitivity = true; });
        
        // スライダークリック設定
        this._setupSliderClick(this.elements.minPressureSlider, this.elements.minPressureHandle, this.MIN_PRESSURE_SIZE, this.MAX_PRESSURE_SIZE, this._updateMinPressureSlider.bind(this), 'minPressureSize');
        this._setupSliderClick(this.elements.sensitivitySlider, this.elements.sensitivityHandle, this.MIN_SENSITIVITY, this.MAX_SENSITIVITY, this._updateSensitivitySlider.bind(this), 'pressureSensitivity');
        this._setupSliderClick(this.elements.smoothingSlider, this.elements.smoothingHandle, this.MIN_SMOOTHING, this.MAX_SMOOTHING, this._updateSmoothingSlider.bind(this), 'smoothing');
        this._setupSliderClick(this.elements.flowOpacitySlider, this.elements.flowOpacityHandle, this.MIN_FLOW_OPACITY, this.MAX_FLOW_OPACITY, this._updateFlowOpacitySlider.bind(this), 'flowOpacity');
        this._setupSliderClick(this.elements.flowSensitivitySlider, this.elements.flowSensitivityHandle, this.MIN_FLOW_SENSITIVITY, this.MAX_FLOW_SENSITIVITY, this._updateFlowSensitivitySlider.bind(this), 'flowSensitivity');
        
        // 蓄積モードチェックボックス
        if (this.elements.flowAccumulation) {
            this.elements.flowAccumulation.addEventListener('change', (e) => {
                this.currentFlowAccumulation = e.target.checked;
                if (this.settingsManager) {
                    this.settingsManager.set('flowAccumulation', this.currentFlowAccumulation);
                }
                if (this.eventBus) {
                    this.eventBus.emit('settings:flow-accumulation', { value: this.currentFlowAccumulation });
                }
            });
        }
    }
    
    _handleSliderMove(e, slider, minVal, maxVal, updateFunc) {
        const rect = slider.getBoundingClientRect();
        const percent = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
        const value = minVal + ((maxVal - minVal) * percent / 100);
        updateFunc(value);
    }
    
    _releaseSlider(handle, pointerId, settingKey, currentValue) {
        if (handle.releasePointerCapture) {
            try { handle.releasePointerCapture(pointerId); } catch (err) {}
        }
        if (this.settingsManager) {
            this.settingsManager.set(settingKey, currentValue);
        }
    }
    
    _setupHandleDrag(handle, dragStartFunc) {
        if (!handle) return;
        handle.addEventListener('pointerdown', (e) => {
            dragStartFunc();
            this.activeSliderPointerId = e.pointerId;
            handle.style.cursor = 'grabbing';
            if (handle.setPointerCapture) {
                try { handle.setPointerCapture(e.pointerId); } catch (err) {}
            }
            e.preventDefault();
            e.stopPropagation();
        });
    }
    
    _setupSliderClick(slider, handle, minVal, maxVal, updateFunc, settingKey) {
        if (!slider) return;
        slider.addEventListener('pointerdown', (e) => {
            if (e.target === handle) return;
            const rect = slider.getBoundingClientRect();
            const percent = ((e.clientX - rect.left) / rect.width) * 100;
            const value = minVal + ((maxVal - minVal) * percent / 100);
            updateFunc(value);
            if (this.settingsManager) {
                this.settingsManager.set(settingKey, this['current' + settingKey.charAt(0).toUpperCase() + settingKey.slice(1)]);
            }
        });
    }
    
    _updateMinPressureSlider(value) {
        this.currentMinPressure = Math.max(this.MIN_PRESSURE_SIZE, Math.min(this.MAX_PRESSURE_SIZE, value));
        this._updateSliderUI(
            this.elements.minPressureTrack,
            this.elements.minPressureHandle,
            this.elements.minPressureValue,
            this.currentMinPressure,
            this.MIN_PRESSURE_SIZE,
            this.MAX_PRESSURE_SIZE,
            'settings:min-pressure-size'
        );
    }
    
    _updateSensitivitySlider(value) {
        this.currentSensitivity = Math.max(this.MIN_SENSITIVITY, Math.min(this.MAX_SENSITIVITY, value));
        this._updateSliderUI(
            this.elements.sensitivityTrack,
            this.elements.sensitivityHandle,
            this.elements.sensitivityValue,
            this.currentSensitivity,
            this.MIN_SENSITIVITY,
            this.MAX_SENSITIVITY,
            'settings:pressure-sensitivity'
        );
    }
    
    _updateSmoothingSlider(value) {
        this.currentSmoothing = Math.max(this.MIN_SMOOTHING, Math.min(this.MAX_SMOOTHING, value));
        this._updateSliderUI(
            this.elements.smoothingTrack,
            this.elements.smoothingHandle,
            this.elements.smoothingValue,
            this.currentSmoothing,
            this.MIN_SMOOTHING,
            this.MAX_SMOOTHING,
            'settings:smoothing'
        );
    }
    
    _updateFlowOpacitySlider(value) {
        this.currentFlowOpacity = Math.max(this.MIN_FLOW_OPACITY, Math.min(this.MAX_FLOW_OPACITY, value));
        this._updateSliderUI(
            this.elements.flowOpacityTrack,
            this.elements.flowOpacityHandle,
            this.elements.flowOpacityValue,
            this.currentFlowOpacity,
            this.MIN_FLOW_OPACITY,
            this.MAX_FLOW_OPACITY,
            'settings:flow-opacity'
        );
    }
    
    _updateFlowSensitivitySlider(value) {
        this.currentFlowSensitivity = Math.max(this.MIN_FLOW_SENSITIVITY, Math.min(this.MAX_FLOW_SENSITIVITY, value));
        this._updateSliderUI(
            this.elements.flowSensitivityTrack,
            this.elements.flowSensitivityHandle,
            this.elements.flowSensitivityValue,
            this.currentFlowSensitivity,
            this.MIN_FLOW_SENSITIVITY,
            this.MAX_FLOW_SENSITIVITY,
            'settings:flow-sensitivity'
        );
    }
    
    _updateSliderUI(track, handle, valueDisplay, currentValue, minValue, maxValue, eventName) {
        const percent = ((currentValue - minValue) / (maxValue - minValue)) * 100;
        track.style.width = percent + '%';
        handle.style.left = percent + '%';
        valueDisplay.textContent = Math.round(currentValue * 100) + '%';
        
        if (this.eventBus && eventName) {
            this.eventBus.emit(eventName, { value: currentValue });
        }
    }
    
    _setupButtons() {
        if (this.elements.statusToggle) {
            this.elements.statusToggle.addEventListener('pointerdown', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this._toggleStatusPanel();
            });
        }
    }
    
    _getDefaults() {
        return {
            minPressureSize: 0.0,
            pressureSensitivity: 1.0,
            smoothing: 0.5,
            flowOpacity: 1.0,
            flowSensitivity: 1.0,
            flowAccumulation: false,
            statusPanelVisible: true
        };
    }
    
    _loadSettings() {
        let settings;
        
        if (this.settingsManager) {
            settings = this.settingsManager.get();
        } else {
            const stored = localStorage.getItem('tegaki_settings');
            settings = stored ? JSON.parse(stored) : this._getDefaults();
        }
        
        this._applySettingsToUI(settings);
    }
    
    _applySettingsToUI(settings) {
        const defaults = this._getDefaults();
        
        this._updateMinPressureSlider(settings.minPressureSize !== undefined ? settings.minPressureSize : defaults.minPressureSize);
        this._updateSensitivitySlider(settings.pressureSensitivity !== undefined ? settings.pressureSensitivity : defaults.pressureSensitivity);
        this._updateSmoothingSlider(settings.smoothing !== undefined ? settings.smoothing : defaults.smoothing);
        this._updateFlowOpacitySlider(settings.flowOpacity !== undefined ? settings.flowOpacity : defaults.flowOpacity);
        this._updateFlowSensitivitySlider(settings.flowSensitivity !== undefined ? settings.flowSensitivity : defaults.flowSensitivity);
        
        if (this.elements.flowAccumulation) {
            const accumulation = settings.flowAccumulation !== undefined ? settings.flowAccumulation : defaults.flowAccumulation;
            this.elements.flowAccumulation.checked = accumulation;
            this.currentFlowAccumulation = accumulation;
        }
        
        if (settings.statusPanelVisible !== undefined) {
            this._setStatusPanelVisibility(settings.statusPanelVisible);
        }
    }
    
    _toggleStatusPanel() {
        const statusPanel = document.querySelector('.status-panel');
        if (!statusPanel) return;
        
        const isVisible = statusPanel.style.display !== 'none';
        this._setStatusPanelVisibility(!isVisible);
        
        if (this.settingsManager) {
            this.settingsManager.set('statusPanelVisible', !isVisible);
        }
    }
    
    _setStatusPanelVisibility(visible) {
        const statusPanel = document.querySelector('.status-panel');
        if (!statusPanel) return;
        
        statusPanel.style.display = visible ? 'flex' : 'none';
        
        if (this.elements.statusToggle) {
            this.elements.statusToggle.textContent = visible ? '非表示' : '表示';
        }
        if (this.elements.statusState) {
            this.elements.statusState.textContent = visible ? '表示中' : '非表示中';
        }
    }
    
    show() {
        if (!this.popup) {
            this._ensurePopupElement();
        }
        
        if (!this.popup) return;
        
        if (!this.initialized) {
            this.initialize();
        }
        
        this.popup.classList.add('show');
        this.isVisible = true;
        
        if (this.initialized) {
            this._loadSettings();
        }
    }
    
    hide() {
        if (!this.popup) return;
        
        this.popup.classList.remove('show');
        this.isVisible = false;
        
        // 全ハンドルのカーソルリセット
        [
            this.elements.minPressureHandle,
            this.elements.sensitivityHandle,
            this.elements.smoothingHandle,
            this.elements.flowOpacityHandle,
            this.elements.flowSensitivityHandle
        ].forEach(handle => {
            if (handle) handle.style.cursor = 'grab';
        });
    }
    
    toggle() {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }
    
    isReady() {
        return !!this.popup;
    }
    
    destroy() {
        if (this._globalMoveHandler) {
            document.removeEventListener('pointermove', this._globalMoveHandler);
            document.removeEventListener('pointerup', this._globalUpHandler);
            document.removeEventListener('pointercancel', this._globalUpHandler);
            this._globalMoveHandler = null;
            this._globalUpHandler = null;
        }
        
        this.elements = {};
        this.initialized = false;
        this.isDraggingMinPressure = false;
        this.isDraggingSensitivity = false;
        this.isDraggingSmoothing = false;
        this.isDraggingFlowOpacity = false;
        this.isDraggingFlowSensitivity = false;
        this.activeSliderPointerId = null;
    }
};

window.SettingsPopup = window.TegakiUI.SettingsPopup;

console.log('✅ settings-popup.js v3.0 loaded (Phase 4: 流量UI統合版)');