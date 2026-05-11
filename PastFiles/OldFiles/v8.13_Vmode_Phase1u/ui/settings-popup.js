// ===== settings-popup.js - スライダー配色統一版 =====
// 責務: 設定UI表示、ユーザー入力受付、EventBus通知
// 🎨 修正: スライダー配色をmaroon系に統一

window.TegakiUI = window.TegakiUI || {};

window.TegakiUI.SettingsPopup = class {
    constructor(dependencies) {
        this.drawingEngine = dependencies.drawingEngine;
        this.eventBus = window.TegakiEventBus;
        this.settingsManager = this._getSettingsManager();
        
        this.popup = null;
        this.isVisible = false;
        this.sliders = {};
        this.initialized = false;
        
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
                        <div class="slider-track"></div>
                        <div class="slider-handle"></div>
                    </div>
                    <div class="slider-value">1.0</div>
                </div>
                <div style="font-size: 10px; color: var(--text-secondary); margin-top: 4px;">
                    筆圧の感度を調整します。大きい値ほど筆圧が強く反映されます。
                </div>
            </div>
            
            <div class="setting-group">
                <div class="setting-label">線補正（スムーズ度）</div>
                <div class="slider-container">
                    <div class="slider" id="smoothing-slider">
                        <div class="slider-track"></div>
                        <div class="slider-handle"></div>
                    </div>
                    <div class="slider-value">0.5</div>
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
    
    initialize() {
        if (this.initialized) return;
        
        this._setupSliders();
        this._setupButtons();
        this._loadSettings();
        this.initialized = true;
    }
    
    _setupSliders() {
        const defaults = this._getDefaults();
        const currentPressure = this.settingsManager?.get('pressureCorrection') ?? defaults.pressureCorrection;
        const currentSmoothing = this.settingsManager?.get('smoothing') ?? defaults.smoothing;
        
        this.sliders.pressureCorrection = this._createSlider({
            container: document.getElementById('pressure-correction-slider'),
            min: 0.1,
            max: 3.0,
            initial: currentPressure,
            format: (v) => v.toFixed(2),
            onChange: (v) => {
                if (this.eventBus) {
                    this.eventBus.emit('settings:pressure-correction', { value: v });
                }
            },
            onCommit: (v) => {
                if (this.settingsManager) {
                    this.settingsManager.set('pressureCorrection', v);
                } else {
                    this._saveFallback('pressureCorrection', v);
                }
            }
        });
        
        this.sliders.smoothing = this._createSlider({
            container: document.getElementById('smoothing-slider'),
            min: 0.0,
            max: 1.0,
            initial: currentSmoothing,
            format: (v) => v.toFixed(2),
            onChange: (v) => {
                if (this.eventBus) {
                    this.eventBus.emit('settings:smoothing', { value: v });
                }
            },
            onCommit: (v) => {
                if (this.settingsManager) {
                    this.settingsManager.set('smoothing', v);
                } else {
                    this._saveFallback('smoothing', v);
                }
            }
        });
    }
    
    _createSlider(options) {
        const { container, min, max, initial, format, onChange, onCommit } = options;
        
        if (!container) return null;
        
        const track = container.querySelector('.slider-track');
        const handle = container.querySelector('.slider-handle');
        const valueDisplay = container.parentNode?.querySelector('.slider-value');
        
        if (!track || !handle) return null;
        
        // 🎨 修正: スライダー配色を明示的にmaroon系に統一
        container.style.background = 'var(--futaba-light-medium)';
        container.style.borderRadius = '3px';
        
        track.style.background = 'var(--futaba-maroon)';
        track.style.borderRadius = '3px';
        track.style.height = '100%';
        
        handle.style.background = 'var(--futaba-maroon)';
        handle.style.border = '2px solid var(--futaba-background)';
        handle.style.borderRadius = '50%';
        handle.style.width = '16px';
        handle.style.height = '16px';
        
        let currentValue = initial;
        let dragging = false;
        
        const updateUI = (newValue) => {
            currentValue = Math.max(min, Math.min(max, newValue));
            const percentage = ((currentValue - min) / (max - min)) * 100;
            
            track.style.width = percentage + '%';
            handle.style.left = percentage + '%';
            
            if (valueDisplay) {
                valueDisplay.textContent = format ? format(currentValue) : currentValue.toFixed(1);
            }
        };
        
        const getValue = (clientX) => {
            const rect = container.getBoundingClientRect();
            const percentage = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
            return min + (percentage * (max - min));
        };
        
        const handleMouseDown = (e) => {
            dragging = true;
            const newValue = getValue(e.clientX);
            updateUI(newValue);
            if (onChange) onChange(currentValue);
            e.preventDefault();
        };
        
        const handleMouseMove = (e) => {
            if (!dragging) return;
            const newValue = getValue(e.clientX);
            updateUI(newValue);
            if (onChange) onChange(currentValue);
        };
        
        const handleMouseUp = () => {
            if (!dragging) return;
            dragging = false;
            if (onCommit) onCommit(currentValue);
        };
        
        container.addEventListener('mousedown', handleMouseDown);
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        
        updateUI(initial);
        
        return {
            getValue: () => currentValue,
            setValue: (v) => {
                updateUI(v);
                if (onChange) onChange(currentValue);
            },
            destroy: () => {
                container.removeEventListener('mousedown', handleMouseDown);
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
            }
        };
    }
    
    _setupButtons() {
        const statusToggleBtn = document.getElementById('status-panel-toggle');
        if (statusToggleBtn) {
            statusToggleBtn.addEventListener('click', (e) => {
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
        if (settings.pressureCorrection !== undefined && this.sliders.pressureCorrection) {
            this.sliders.pressureCorrection.setValue(settings.pressureCorrection);
        }
        
        if (settings.smoothing !== undefined && this.sliders.smoothing) {
            this.sliders.smoothing.setValue(settings.smoothing);
        }
        
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
        
        const toggleBtn = document.getElementById('status-panel-toggle');
        const stateDisplay = document.getElementById('status-panel-state');
        
        if (toggleBtn) {
            toggleBtn.textContent = visible ? '非表示' : '表示';
        }
        if (stateDisplay) {
            stateDisplay.textContent = visible ? '表示中' : '非表示中';
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
        Object.values(this.sliders).forEach(slider => {
            if (slider?.destroy) {
                slider.destroy();
            }
        });
        this.sliders = {};
        this.initialized = false;
    }
};

window.SettingsPopup = window.TegakiUI.SettingsPopup;

console.log('✅ settings-popup.js (スライダー配色統一版) loaded');