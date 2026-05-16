/**
 * ============================================================================
 * ファイル名: ui/settings-popup.js
 * 責務: アプリケーションのグローバル設定（筆圧補正、スムーズ度等）のUIを提供する
 * 依存: system/event-bus.js, system/settings-manager.js
 * 被依存: core-engine.js, system/popup-manager.js
 * 公開API: SettingsPopup
 * イベント発火: settings:pressure-correction, settings:smoothing, settings:pressure-curve
 * イベント受信: ui:open-settings
 * グローバル登録: window.SettingsPopup
 * 実装状態: ♻️移植
 * ============================================================================
 */

import { TegakiEventBus } from '../system/event-bus.js';

export class SettingsPopup {
    constructor(dependencies = {}) {
        this.drawingEngine = dependencies.drawingEngine;
        this.eventBus = TegakiEventBus;
        this.settingsManager = this._getSettingsManager();
        
        this.popup = null;
        this.isVisible = false;
        this.initialized = false;
        
        this.isDraggingPressure = false;
        this.isDraggingSmoothing = false;
        
        this.activeSliderPointerId = null;
        
        this.elements = {};
        
        this.currentPressure = 1.0;
        this.currentSmoothing = 0.5;
        
        this.MIN_PRESSURE = 0.1;
        this.MAX_PRESSURE = 3.0;
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
        return window.TegakiSettingsManager;
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
        const container = document.querySelector('.canvas-area') || document.body;
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
                <div class="setting-label">筆圧補正（感度）</div>
                <div class="slider-container">
                    <div class="slider" id="pressure-correction-slider">
                        <div class="slider-track" id="pressure-track"></div>
                        <div class="slider-handle" id="pressure-handle"></div>
                    </div>
                    <div class="slider-value" id="pressure-value">1.0</div>
                </div>
            </div>
            
            <div class="setting-group">
                <div class="setting-label">線補正（スムーズ度）</div>
                <div class="slider-container">
                    <div class="slider" id="smoothing-slider">
                        <div class="slider-track" id="smoothing-track"></div>
                        <div class="slider-handle" id="smoothing-handle"></div>
                    </div>
                    <div class="slider-value" id="smoothing-value">0.5</div>
                </div>
            </div>
            
            <div class="setting-group">
                <div class="setting-label">筆圧カーブ</div>
                <div style="display: flex; gap: 6px; margin-bottom: 8px;">
                    <button class="pressure-curve-btn active" data-curve="linear" style="flex: 1; padding: 6px; border: 2px solid var(--futaba-light-medium); border-radius: 6px; background: var(--futaba-background); cursor: pointer; font-size: 11px; transition: all 0.2s;">
                        リニア
                    </button>
                    <button class="pressure-curve-btn" data-curve="ease-in" style="flex: 1; padding: 6px; border: 2px solid var(--futaba-light-medium); border-radius: 6px; background: var(--futaba-background); cursor: pointer; font-size: 11px; transition: all 0.2s;">
                        軽め
                    </button>
                    <button class="pressure-curve-btn" data-curve="ease-out" style="flex: 1; padding: 6px; border: 2px solid var(--futaba-light-medium); border-radius: 6px; background: var(--futaba-background); cursor: pointer; font-size: 11px; transition: all 0.2s;">
                        重め
                    </button>
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
            </div>
        `;
    }
    
    _cacheElements() {
        this.elements = {
            pressureSlider: document.getElementById('pressure-correction-slider'),
            pressureTrack: document.getElementById('pressure-track'),
            pressureHandle: document.getElementById('pressure-handle'),
            pressureValue: document.getElementById('pressure-value'),
            
            smoothingSlider: document.getElementById('smoothing-slider'),
            smoothingTrack: document.getElementById('smoothing-track'),
            smoothingHandle: document.getElementById('smoothing-handle'),
            smoothingValue: document.getElementById('smoothing-value'),
            
            statusToggle: document.getElementById('status-panel-toggle'),
            statusState: document.getElementById('status-panel-state')
        };
        
        if (this.elements.pressureSlider) {
            this.elements.pressureSlider.style.cssText = `
                flex: 1;
                height: 6px;
                background: var(--futaba-light-medium);
                border-radius: 3px;
                position: relative;
                cursor: pointer;
            `;
        }
        if (this.elements.pressureTrack) {
            this.elements.pressureTrack.style.cssText = `
                height: 100%;
                background: var(--futaba-maroon);
                border-radius: 3px;
                width: 50%;
                transition: none !important;
            `;
        }
        if (this.elements.pressureHandle) {
            this.elements.pressureHandle.style.cssText = `
                width: 16px;
                height: 16px;
                background: var(--futaba-maroon);
                border: 2px solid var(--futaba-background);
                border-radius: 50%;
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                cursor: grab;
                transition: none !important;
                touch-action: none;
            `;
        }
        
        if (this.elements.smoothingSlider) {
            this.elements.smoothingSlider.style.cssText = `
                flex: 1;
                height: 6px;
                background: var(--futaba-light-medium);
                border-radius: 3px;
                position: relative;
                cursor: pointer;
            `;
        }
        if (this.elements.smoothingTrack) {
            this.elements.smoothingTrack.style.cssText = `
                height: 100%;
                background: var(--futaba-maroon);
                border-radius: 3px;
                width: 50%;
                transition: none !important;
            `;
        }
        if (this.elements.smoothingHandle) {
            this.elements.smoothingHandle.style.cssText = `
                width: 16px;
                height: 16px;
                background: var(--futaba-maroon);
                border: 2px solid var(--futaba-background);
                border-radius: 50%;
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                cursor: grab;
                transition: none !important;
                touch-action: none;
            `;
        }
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
            if (!this.isDraggingPressure && !this.isDraggingSmoothing) return;
            
            e.preventDefault();
            e.stopPropagation();
            
            if (this.isDraggingPressure && this.activeSliderPointerId === e.pointerId) {
                const rect = this.elements.pressureSlider.getBoundingClientRect();
                const percent = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
                const value = this.MIN_PRESSURE + ((this.MAX_PRESSURE - this.MIN_PRESSURE) * percent / 100);
                this._updatePressureSlider(value);
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
            
            if (this.isDraggingPressure) {
                if (this.elements.pressureHandle.releasePointerCapture) {
                    try {
                        this.elements.pressureHandle.releasePointerCapture(e.pointerId);
                    } catch (err) {}
                }
                if (this.settingsManager) {
                    this.settingsManager.set('pressureCorrection', this.currentPressure);
                }
            }
            
            if (this.isDraggingSmoothing) {
                if (this.elements.smoothingHandle.releasePointerCapture) {
                    try {
                        this.elements.smoothingHandle.releasePointerCapture(e.pointerId);
                    } catch (err) {}
                }
                if (this.settingsManager) {
                    this.settingsManager.set('smoothing', this.currentSmoothing);
                }
            }
            
            this.isDraggingPressure = false;
            this.isDraggingSmoothing = false;
            this.activeSliderPointerId = null;
        };
        
        document.addEventListener('pointermove', globalMoveHandler, { passive: false, capture: true });
        document.addEventListener('pointerup', globalUpHandler, { capture: true });
        document.addEventListener('pointercancel', globalUpHandler, { capture: true });
        
        this._globalMoveHandler = globalMoveHandler;
        this._globalUpHandler = globalUpHandler;
        
        this.elements.pressureHandle.addEventListener('pointerdown', (e) => {
            this.isDraggingPressure = true;
            this.activeSliderPointerId = e.pointerId;
            this.elements.pressureHandle.style.cursor = 'grabbing';
            
            if (this.elements.pressureHandle.setPointerCapture) {
                try {
                    this.elements.pressureHandle.setPointerCapture(e.pointerId);
                } catch (err) {}
            }
            
            e.preventDefault();
            e.stopPropagation();
        });
        
        this.elements.smoothingHandle.addEventListener('pointerdown', (e) => {
            this.isDraggingSmoothing = true;
            this.activeSliderPointerId = e.pointerId;
            this.elements.smoothingHandle.style.cursor = 'grabbing';
            
            if (this.elements.smoothingHandle.setPointerCapture) {
                try {
                    this.elements.smoothingHandle.setPointerCapture(e.pointerId);
                } catch (err) {}
            }
            
            e.preventDefault();
            e.stopPropagation();
        });
        
        this.elements.pressureSlider.addEventListener('pointerdown', (e) => {
            if (e.target === this.elements.pressureHandle) return;
            const rect = this.elements.pressureSlider.getBoundingClientRect();
            const percent = ((e.clientX - rect.left) / rect.width) * 100;
            const value = this.MIN_PRESSURE + ((this.MAX_PRESSURE - this.MIN_PRESSURE) * percent / 100);
            this._updatePressureSlider(value);
            if (this.settingsManager) {
                this.settingsManager.set('pressureCorrection', this.currentPressure);
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
    
    _updatePressureSlider(value) {
        this.currentPressure = Math.max(this.MIN_PRESSURE, Math.min(this.MAX_PRESSURE, value));
        const percent = ((this.currentPressure - this.MIN_PRESSURE) / (this.MAX_PRESSURE - this.MIN_PRESSURE)) * 100;
        
        this.elements.pressureTrack.style.width = percent + '%';
        this.elements.pressureHandle.style.left = percent + '%';
        this.elements.pressureValue.textContent = this.currentPressure.toFixed(2);
        
        if (this.eventBus) {
            this.eventBus.emit('settings:pressure-correction', { value: this.currentPressure });
        }
    }
    
    _updateSmoothingSlider(value) {
        this.currentSmoothing = Math.max(this.MIN_SMOOTHING, Math.min(this.MAX_SMOOTHING, value));
        const percent = ((this.currentSmoothing - this.MIN_SMOOTHING) / (this.MAX_SMOOTHING - this.MIN_SMOOTHING)) * 100;
        
        this.elements.smoothingTrack.style.width = percent + '%';
        this.elements.smoothingHandle.style.left = percent + '%';
        this.elements.smoothingValue.textContent = this.currentSmoothing.toFixed(2);
        
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
        
        const curveBtns = document.querySelectorAll('.pressure-curve-btn');
        curveBtns.forEach(btn => {
            btn.addEventListener('pointerdown', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                const curve = e.currentTarget.getAttribute('data-curve');
                if (!curve) return;
                
                this._applyPressureCurveUI(curve);
                
                if (this.settingsManager) {
                    this.settingsManager.set('pressureCurve', curve);
                }
                
                if (this.eventBus) {
                    this.eventBus.emit('settings:pressure-curve', { curve });
                }
            });
        });
    }
    
    _getDefaults() {
        return {
            pressureCorrection: 1.0,
            smoothing: 0.5,
            pressureCurve: 'linear',
            statusPanelVisible: true
        };
    }
    
    _loadSettings() {
        let settings;
        
        if (this.settingsManager) {
            settings = this.settingsManager.get();
        } else {
            settings = this._getDefaults();
        }
        
        this._applySettingsToUI(settings);
    }
    
    _applySettingsToUI(settings) {
        const defaults = this._getDefaults();
        
        const pressure = settings.pressureCorrection !== undefined ? settings.pressureCorrection : defaults.pressureCorrection;
        this._updatePressureSlider(pressure);
        
        const smoothing = settings.smoothing !== undefined ? settings.smoothing : defaults.smoothing;
        this._updateSmoothingSlider(smoothing);
        
        if (settings.pressureCurve !== undefined) {
            this._applyPressureCurveUI(settings.pressureCurve);
        }
        
        if (settings.statusPanelVisible !== undefined) {
            this._setStatusPanelVisibility(settings.statusPanelVisible);
        }
    }
    
    _applyPressureCurveUI(curve) {
        const curveBtns = document.querySelectorAll('.pressure-curve-btn');
        curveBtns.forEach(btn => {
            const btnCurve = btn.getAttribute('data-curve');
            if (btnCurve === curve) {
                btn.classList.add('active');
                btn.style.background = 'var(--futaba-maroon)';
                btn.style.borderColor = 'var(--futaba-maroon)';
                btn.style.color = 'var(--text-inverse)';
            } else {
                btn.classList.remove('active');
                btn.style.background = 'var(--futaba-background)';
                btn.style.borderColor = 'var(--futaba-light-medium)';
                btn.style.color = 'var(--futaba-maroon)';
            }
        });
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
    }
    
    toggle() {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
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
    }
}

// 下位互換性のためにグローバルに登録
window.SettingsPopup = SettingsPopup;
