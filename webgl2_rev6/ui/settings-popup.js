/**
 * ============================================================
 * settings-popup.js - v2.4 筆圧設定改修版
 * ============================================================
 * 親ファイル: ui-panels.js
 * 依存ファイル: 
 *   - system/event-bus.js (EventBus)
 *   - system/settings-manager.js (SettingsManager)
 *   - system/drawing/drawing-engine.js (DrawingEngine)
 * ============================================================
 * 【v2.4 改修内容】
 * - 筆圧カーブ3段階選択廃止
 * - 筆圧最小値スライダー追加（minPressureSize: 0-100%）
 * - 筆圧感度スライダー追加（pressureSensitivity: 10-300%）
 * - pressure-handler.jsとの完全連動
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
        
        this.activeSliderPointerId = null;
        
        this.elements = {};
        
        this.currentMinPressure = 0.0;
        this.currentSensitivity = 1.0;
        this.currentSmoothing = 0.5;
        
        this.MIN_PRESSURE_SIZE = 0.0;
        this.MAX_PRESSURE_SIZE = 1.0;
        this.MIN_SENSITIVITY = 0.1;
        this.MAX_SENSITIVITY = 3.0;
        this.MIN_SMOOTHING = 0.0;
        this.MAX_SMOOTHING = 1.0;
        
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
            <div class="popup-title" style="font-size: 16px; font-weight: 600; color: var(--futaba-maroon); margin-bottom: 16px; text-align: center;">
                設定
            </div>
            
            <div class="setting-group">
                <div class="setting-label">筆圧最小値</div>
                <div class="slider-container">
                    <div class="slider" id="min-pressure-slider">
                        <div class="slider-track" id="min-pressure-track"></div>
                        <div class="slider-handle" id="min-pressure-handle"></div>
                    </div>
                    <div class="slider-value" id="min-pressure-value">0%</div>
                </div>
                <div style="font-size: 10px; color: var(--text-secondary); margin-top: 4px;">
                    0%: 0荷重で極細線 / 100%: 常に設定サイズ（筆圧無効）
                </div>
            </div>
            
            <div class="setting-group">
                <div class="setting-label">筆圧感度</div>
                <div class="slider-container">
                    <div class="slider" id="sensitivity-slider">
                        <div class="slider-track" id="sensitivity-track"></div>
                        <div class="slider-handle" id="sensitivity-handle"></div>
                    </div>
                    <div class="slider-value" id="sensitivity-value">100%</div>
                </div>
                <div style="font-size: 10px; color: var(--text-secondary); margin-top: 4px;">
                    100%: 標準感度 / 200%以上: 軽い筆圧で最大サイズ到達
                </div>
            </div>
            
            <div class="setting-group">
                <div class="setting-label">線補正（スムーズ度）</div>
                <div class="slider-container">
                    <div class="slider" id="smoothing-slider">
                        <div class="slider-track" id="smoothing-track"></div>
                        <div class="slider-handle" id="smoothing-handle"></div>
                    </div>
                    <div class="slider-value" id="smoothing-value">50%</div>
                </div>
                <div style="font-size: 10px; color: var(--text-secondary); margin-top: 4px;">
                    線の滑らかさ。値が大きいほど線が滑らかになりますが反応が遅くなります。
                </div>
            </div>
            
            <div class="setting-group">
                <div class="setting-label">ステータスパネル</div>
                <div style="display: flex; gap: 12px; align-items: center;">
                    <button id="status-panel-toggle" style="flex: 1; padding: 8px 12px; border: 2px solid var(--futaba-light-medium); border-radius: 6px; background: var(--futaba-background); color: var(--futaba-maroon); font-weight: 600; cursor: pointer; transition: all 0.2s; font-size: 12px;">
                        非表示
                    </button>
                    <span id="status-panel-state" style="font-size: 11px; color: var(--text-secondary); min-width: 60px; text-align: right;">
                        表示中
                    </span>
                </div>
                <div style="font-size: 10px; color: var(--text-secondary); margin-top: 4px;">
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
        
        if (this.elements.minPressureSlider) this.elements.minPressureSlider.style.cssText = sliderStyle;
        if (this.elements.minPressureTrack) this.elements.minPressureTrack.style.cssText = trackStyle;
        if (this.elements.minPressureHandle) this.elements.minPressureHandle.style.cssText = handleStyle;
        
        if (this.elements.sensitivitySlider) this.elements.sensitivitySlider.style.cssText = sliderStyle;
        if (this.elements.sensitivityTrack) this.elements.sensitivityTrack.style.cssText = trackStyle;
        if (this.elements.sensitivityHandle) this.elements.sensitivityHandle.style.cssText = handleStyle;
        
        if (this.elements.smoothingSlider) this.elements.smoothingSlider.style.cssText = sliderStyle;
        if (this.elements.smoothingTrack) this.elements.smoothingTrack.style.cssText = trackStyle;
        if (this.elements.smoothingHandle) this.elements.smoothingHandle.style.cssText = handleStyle;
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
            if (!this.isDraggingMinPressure && !this.isDraggingSensitivity && !this.isDraggingSmoothing) return;
            
            e.preventDefault();
            e.stopPropagation();
            
            if (this.isDraggingMinPressure && this.activeSliderPointerId === e.pointerId) {
                const rect = this.elements.minPressureSlider.getBoundingClientRect();
                const percent = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
                const value = this.MIN_PRESSURE_SIZE + ((this.MAX_PRESSURE_SIZE - this.MIN_PRESSURE_SIZE) * percent / 100);
                this._updateMinPressureSlider(value);
            }
            
            if (this.isDraggingSensitivity && this.activeSliderPointerId === e.pointerId) {
                const rect = this.elements.sensitivitySlider.getBoundingClientRect();
                const percent = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
                const value = this.MIN_SENSITIVITY + ((this.MAX_SENSITIVITY - this.MIN_SENSITIVITY) * percent / 100);
                this._updateSensitivitySlider(value);
            }
            
            if (this.isDraggingSmoothing && this.activeSliderPointerId === e.pointerId) {
                const rect = this.elements.smoothingSlider.getBoundingClientRect();
                const percent = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
                const value = this.MIN_SMOOTHING + ((this.MAX_SMOOTHING - this.MIN_SMOOTHING) * percent / 100);
                this._updateSmoothingSlider(value);
            }
        };
        
        const globalUpHandler = (e) => {
            if (this.activeSliderPointerId !== e.pointerId) return;
            
            if (this.isDraggingMinPressure) {
                if (this.elements.minPressureHandle.releasePointerCapture) {
                    try { this.elements.minPressureHandle.releasePointerCapture(e.pointerId); } catch (err) {}
                }
                if (this.settingsManager) {
                    this.settingsManager.set('minPressureSize', this.currentMinPressure);
                }
            }
            
            if (this.isDraggingSensitivity) {
                if (this.elements.sensitivityHandle.releasePointerCapture) {
                    try { this.elements.sensitivityHandle.releasePointerCapture(e.pointerId); } catch (err) {}
                }
                if (this.settingsManager) {
                    this.settingsManager.set('pressureSensitivity', this.currentSensitivity);
                }
            }
            
            if (this.isDraggingSmoothing) {
                if (this.elements.smoothingHandle.releasePointerCapture) {
                    try { this.elements.smoothingHandle.releasePointerCapture(e.pointerId); } catch (err) {}
                }
                if (this.settingsManager) {
                    this.settingsManager.set('smoothing', this.currentSmoothing);
                }
            }
            
            this.isDraggingMinPressure = false;
            this.isDraggingSensitivity = false;
            this.isDraggingSmoothing = false;
            this.activeSliderPointerId = null;
        };
        
        document.addEventListener('pointermove', globalMoveHandler, { passive: false, capture: true });
        document.addEventListener('pointerup', globalUpHandler, { capture: true });
        document.addEventListener('pointercancel', globalUpHandler, { capture: true });
        
        this._globalMoveHandler = globalMoveHandler;
        this._globalUpHandler = globalUpHandler;
        
        this.elements.minPressureHandle.addEventListener('pointerdown', (e) => {
            this.isDraggingMinPressure = true;
            this.activeSliderPointerId = e.pointerId;
            this.elements.minPressureHandle.style.cursor = 'grabbing';
            if (this.elements.minPressureHandle.setPointerCapture) {
                try { this.elements.minPressureHandle.setPointerCapture(e.pointerId); } catch (err) {}
            }
            e.preventDefault();
            e.stopPropagation();
        });
        
        this.elements.sensitivityHandle.addEventListener('pointerdown', (e) => {
            this.isDraggingSensitivity = true;
            this.activeSliderPointerId = e.pointerId;
            this.elements.sensitivityHandle.style.cursor = 'grabbing';
            if (this.elements.sensitivityHandle.setPointerCapture) {
                try { this.elements.sensitivityHandle.setPointerCapture(e.pointerId); } catch (err) {}
            }
            e.preventDefault();
            e.stopPropagation();
        });
        
        this.elements.smoothingHandle.addEventListener('pointerdown', (e) => {
            this.isDraggingSmoothing = true;
            this.activeSliderPointerId = e.pointerId;
            this.elements.smoothingHandle.style.cursor = 'grabbing';
            if (this.elements.smoothingHandle.setPointerCapture) {
                try { this.elements.smoothingHandle.setPointerCapture(e.pointerId); } catch (err) {}
            }
            e.preventDefault();
            e.stopPropagation();
        });
        
        this.elements.minPressureSlider.addEventListener('pointerdown', (e) => {
            if (e.target === this.elements.minPressureHandle) return;
            const rect = this.elements.minPressureSlider.getBoundingClientRect();
            const percent = ((e.clientX - rect.left) / rect.width) * 100;
            const value = this.MIN_PRESSURE_SIZE + ((this.MAX_PRESSURE_SIZE - this.MIN_PRESSURE_SIZE) * percent / 100);
            this._updateMinPressureSlider(value);
            if (this.settingsManager) {
                this.settingsManager.set('minPressureSize', this.currentMinPressure);
            }
        });
        
        this.elements.sensitivitySlider.addEventListener('pointerdown', (e) => {
            if (e.target === this.elements.sensitivityHandle) return;
            const rect = this.elements.sensitivitySlider.getBoundingClientRect();
            const percent = ((e.clientX - rect.left) / rect.width) * 100;
            const value = this.MIN_SENSITIVITY + ((this.MAX_SENSITIVITY - this.MIN_SENSITIVITY) * percent / 100);
            this._updateSensitivitySlider(value);
            if (this.settingsManager) {
                this.settingsManager.set('pressureSensitivity', this.currentSensitivity);
            }
        });
        
        this.elements.smoothingSlider.addEventListener('pointerdown', (e) => {
            if (e.target === this.elements.smoothingHandle) return;
            const rect = this.elements.smoothingSlider.getBoundingClientRect();
            const percent = ((e.clientX - rect.left) / rect.width) * 100;
            const value = this.MIN_SMOOTHING + ((this.MAX_SMOOTHING - this.MIN_SMOOTHING) * percent / 100);
            this._updateSmoothingSlider(value);
            if (this.settingsManager) {
                this.settingsManager.set('smoothing', this.currentSmoothing);
            }
        });
    }
    
    _updateMinPressureSlider(value) {
        this.currentMinPressure = Math.max(this.MIN_PRESSURE_SIZE, Math.min(this.MAX_PRESSURE_SIZE, value));
        const percent = ((this.currentMinPressure - this.MIN_PRESSURE_SIZE) / (this.MAX_PRESSURE_SIZE - this.MIN_PRESSURE_SIZE)) * 100;
        
        this.elements.minPressureTrack.style.width = percent + '%';
        this.elements.minPressureHandle.style.left = percent + '%';
        this.elements.minPressureValue.textContent = Math.round(this.currentMinPressure * 100) + '%';
        
        if (this.eventBus) {
            this.eventBus.emit('settings:min-pressure-size', { value: this.currentMinPressure });
        }
    }
    
    _updateSensitivitySlider(value) {
        this.currentSensitivity = Math.max(this.MIN_SENSITIVITY, Math.min(this.MAX_SENSITIVITY, value));
        const percent = ((this.currentSensitivity - this.MIN_SENSITIVITY) / (this.MAX_SENSITIVITY - this.MIN_SENSITIVITY)) * 100;
        
        this.elements.sensitivityTrack.style.width = percent + '%';
        this.elements.sensitivityHandle.style.left = percent + '%';
        this.elements.sensitivityValue.textContent = Math.round(this.currentSensitivity * 100) + '%';
        
        if (this.eventBus) {
            this.eventBus.emit('settings:pressure-sensitivity', { value: this.currentSensitivity });
        }
    }
    
    _updateSmoothingSlider(value) {
        this.currentSmoothing = Math.max(this.MIN_SMOOTHING, Math.min(this.MAX_SMOOTHING, value));
        const percent = ((this.currentSmoothing - this.MIN_SMOOTHING) / (this.MAX_SMOOTHING - this.MIN_SMOOTHING)) * 100;
        
        this.elements.smoothingTrack.style.width = percent + '%';
        this.elements.smoothingHandle.style.left = percent + '%';
        this.elements.smoothingValue.textContent = Math.round(this.currentSmoothing * 100) + '%';
        
        if (this.eventBus) {
            this.eventBus.emit('settings:smoothing', { value: this.currentSmoothing });
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
        
        const minPressure = settings.minPressureSize !== undefined ? settings.minPressureSize : defaults.minPressureSize;
        this._updateMinPressureSlider(minPressure);
        
        const sensitivity = settings.pressureSensitivity !== undefined ? settings.pressureSensitivity : defaults.pressureSensitivity;
        this._updateSensitivitySlider(sensitivity);
        
        const smoothing = settings.smoothing !== undefined ? settings.smoothing : defaults.smoothing;
        this._updateSmoothingSlider(smoothing);
        
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
        
        if (this.elements.minPressureHandle) {
            this.elements.minPressureHandle.style.cursor = 'grab';
        }
        if (this.elements.sensitivityHandle) {
            this.elements.sensitivityHandle.style.cursor = 'grab';
        }
        if (this.elements.smoothingHandle) {
            this.elements.smoothingHandle.style.cursor = 'grab';
        }
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
        this.activeSliderPointerId = null;
    }
};

window.SettingsPopup = window.TegakiUI.SettingsPopup;

console.log('✅ settings-popup.js v2.4 loaded (筆圧設定改修版)');
console.log('   ✅ 筆圧最小値スライダー実装');
console.log('   ✅ 筆圧感度スライダー実装');
console.log('   ❌ 筆圧カーブ選択廃止');