// ===== settings-popup.js - 即応性完全修正版 =====
// 責務: 設定UI表示、ユーザー入力受付、EventBus通知
// 🔥 修正: CSS transition完全除去 + DOM更新最適化

window.TegakiUI = window.TegakiUI || {};

window.TegakiUI.SettingsPopup = class {
    constructor(dependencies) {
        this.drawingEngine = dependencies.drawingEngine;
        this.eventBus = window.TegakiEventBus;
        this.settingsManager = this._getSettingsManager();
        
        this.popup = null;
        this.isVisible = false;
        this.initialized = false;
        
        this.isDraggingPressure = false;
        this.isDraggingSmoothing = false;
        
        this.elements = {};
        
        this.mouseMoveHandler = null;
        this.mouseUpHandler = null;
        
        this.currentPressure = 1.0;
        this.currentSmoothing = 0.5;
        
        this.MIN_PRESSURE = 0.1;
        this.MAX_PRESSURE = 3.0;
        this.MIN_SMOOTHING = 0.0;
        this.MAX_SMOOTHING = 1.0;
        
        this._ensurePopupElement();
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
                <div class="setting-label">筆圧補正（感度）</div>
                <div class="slider-container">
                    <div class="slider" id="pressure-correction-slider">
                        <div class="slider-track" id="pressure-track"></div>
                        <div class="slider-handle" id="pressure-handle"></div>
                    </div>
                    <div class="slider-value" id="pressure-value">1.0</div>
                </div>
                <div style="font-size: 10px; color: var(--text-secondary); margin-top: 4px;">
                    筆圧の感度を調整します。大きい値ほど筆圧が強く反映されます。
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
                <div style="font-size: 10px; color: var(--text-secondary); margin-top: 4px;">
                    線の滑らかさ。値が大きいほど線が滑らかになりますが反応が遅くなります。
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
                <div style="font-size: 10px; color: var(--text-secondary);">
                    筆圧の反応カーブを選択します。お好みの描き心地に調整できます。
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
        
        // 🔥 CSS transition完全除去 + 即応性向上
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
        this.mouseMoveHandler = (e) => {
            if (this.isDraggingPressure) {
                const rect = this.elements.pressureSlider.getBoundingClientRect();
                const percent = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
                const value = this.MIN_PRESSURE + ((this.MAX_PRESSURE - this.MIN_PRESSURE) * percent / 100);
                this._updatePressureSlider(value);
            }
            if (this.isDraggingSmoothing) {
                const rect = this.elements.smoothingSlider.getBoundingClientRect();
                const percent = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
                const value = this.MIN_SMOOTHING + ((this.MAX_SMOOTHING - this.MIN_SMOOTHING) * percent / 100);
                this._updateSmoothingSlider(value);
            }
        };
        
        this.mouseUpHandler = () => {
            if (this.isDraggingPressure) {
                this.isDraggingPressure = false;
                if (this.settingsManager) {
                    this.settingsManager.set('pressureCorrection', this.currentPressure);
                } else {
                    this._saveFallback('pressureCorrection', this.currentPressure);
                }
            }
            if (this.isDraggingSmoothing) {
                this.isDraggingSmoothing = false;
                if (this.settingsManager) {
                    this.settingsManager.set('smoothing', this.currentSmoothing);
                } else {
                    this._saveFallback('smoothing', this.currentSmoothing);
                }
            }
        };
        
        document.addEventListener('mousemove', this.mouseMoveHandler);
        document.addEventListener('mouseup', this.mouseUpHandler);
        
        this.elements.pressureHandle.addEventListener('mousedown', (e) => {
            this.isDraggingPressure = true;
            this.elements.pressureHandle.style.cursor = 'grabbing';
            e.preventDefault();
        });
        
        this.elements.smoothingHandle.addEventListener('mousedown', (e) => {
            this.isDraggingSmoothing = true;
            this.elements.smoothingHandle.style.cursor = 'grabbing';
            e.preventDefault();
        });
        
        this.elements.pressureSlider.addEventListener('click', (e) => {
            if (e.target === this.elements.pressureHandle) return;
            const rect = this.elements.pressureSlider.getBoundingClientRect();
            const percent = ((e.clientX - rect.left) / rect.width) * 100;
            const value = this.MIN_PRESSURE + ((this.MAX_PRESSURE - this.MIN_PRESSURE) * percent / 100);
            this._updatePressureSlider(value);
            if (this.settingsManager) {
                this.settingsManager.set('pressureCorrection', this.currentPressure);
            } else {
                this._saveFallback('pressureCorrection', this.currentPressure);
            }
        });
        
        this.elements.smoothingSlider.addEventListener('click', (e) => {
            if (e.target === this.elements.smoothingHandle) return;
            const rect = this.elements.smoothingSlider.getBoundingClientRect();
            const percent = ((e.clientX - rect.left) / rect.width) * 100;
            const value = this.MIN_SMOOTHING + ((this.MAX_SMOOTHING - this.MIN_SMOOTHING) * percent / 100);
            this._updateSmoothingSlider(value);
            if (this.settingsManager) {
                this.settingsManager.set('smoothing', this.currentSmoothing);
            } else {
                this._saveFallback('smoothing', this.currentSmoothing);
            }
        });
    }
    
    _updatePressureSlider(value) {
        this.currentPressure = Math.max(this.MIN_PRESSURE, Math.min(this.MAX_PRESSURE, value));
        const percent = ((this.currentPressure - this.MIN_PRESSURE) / (this.MAX_PRESSURE - this.MIN_PRESSURE)) * 100;
        
        // 🔥 DOM更新を同期的に即座実行
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
        
        // 🔥 DOM更新を同期的に即座実行
        this.elements.smoothingTrack.style.width = percent + '%';
        this.elements.smoothingHandle.style.left = percent + '%';
        this.elements.smoothingValue.textContent = this.currentSmoothing.toFixed(2);
        
        if (this.eventBus) {
            this.eventBus.emit('settings:smoothing', { value: this.currentSmoothing });
        }
    }
    
    _setupButtons() {
        if (this.elements.statusToggle) {
            this.elements.statusToggle.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this._toggleStatusPanel();
            });
        }
        
        const curveBtns = document.querySelectorAll('.pressure-curve-btn');
        curveBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                const curve = e.currentTarget.getAttribute('data-curve');
                if (!curve) return;
                
                document.querySelectorAll('.pressure-curve-btn').forEach(b => {
                    b.classList.remove('active');
                    b.style.background = 'var(--futaba-background)';
                    b.style.borderColor = 'var(--futaba-light-medium)';
                    b.style.color = 'var(--futaba-maroon)';
                });
                
                e.currentTarget.classList.add('active');
                e.currentTarget.style.background = 'var(--futaba-maroon)';
                e.currentTarget.style.borderColor = 'var(--futaba-maroon)';
                e.currentTarget.style.color = 'var(--text-inverse)';
                
                if (this.settingsManager) {
                    this.settingsManager.set('pressureCurve', curve);
                } else {
                    this._saveFallback('pressureCurve', curve);
                }
                
                if (this.eventBus) {
                    this.eventBus.emit('settings:pressure-curve', { curve });
                }
            });
            
            btn.addEventListener('mouseenter', () => {
                if (!btn.classList.contains('active')) {
                    btn.style.borderColor = 'var(--futaba-maroon)';
                }
            });
            
            btn.addEventListener('mouseleave', () => {
                if (!btn.classList.contains('active')) {
                    btn.style.borderColor = 'var(--futaba-light-medium)';
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
            const stored = localStorage.getItem('tegaki_settings');
            settings = stored ? JSON.parse(stored) : this._getDefaults();
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
        } else {
            this._saveFallback('statusPanelVisible', !isVisible);
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
    
    _saveFallback(key, value) {
        try {
            const stored = localStorage.getItem('tegaki_settings');
            const settings = stored ? JSON.parse(stored) : {};
            settings[key] = value;
            localStorage.setItem('tegaki_settings', JSON.stringify(settings));
        } catch (error) {
            /* silent fallback */
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
        
        // カーソルをリセット
        if (this.elements.pressureHandle) {
            this.elements.pressureHandle.style.cursor = 'grab';
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
        if (this.mouseMoveHandler) {
            document.removeEventListener('mousemove', this.mouseMoveHandler);
            this.mouseMoveHandler = null;
        }
        if (this.mouseUpHandler) {
            document.removeEventListener('mouseup', this.mouseUpHandler);
            this.mouseUpHandler = null;
        }
        
        this.elements = {};
        this.initialized = false;
        this.isDraggingPressure = false;
        this.isDraggingSmoothing = false;
    }
};

window.SettingsPopup = window.TegakiUI.SettingsPopup;

console.log('✅ settings-popup.js (即応性完全修正版) loaded');
console.log('   - CSS transition完全除去（!important付き）');
console.log('   - DOM更新を同期的に即座実行');
console.log('   - quick-access/resize-popupと完全同等の動作');