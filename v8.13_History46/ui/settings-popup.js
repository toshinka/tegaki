// ===== settings-popup.js - 設定パネル実装 =====
// 筆圧補正・線補正・ステータスパネルON/OFF

window.TegakiUI = window.TegakiUI || {};

window.TegakiUI.SettingsPopup = class {
    constructor(drawingEngine) {
        this.drawingEngine = drawingEngine;
        this.popup = document.getElementById('settings-popup');
        this.isVisible = false;
        
        if (!this.popup) {
            this.createPopupElement();
        }
        
        this.setupEventListeners();
        this.loadSettings();
    }
    
    createPopupElement() {
        const container = document.createElement('div');
        container.id = 'settings-popup';
        container.className = 'popup-panel';
        container.innerHTML = `
            <div class="popup-title">設定</div>
            
            <div class="setting-group">
                <div class="setting-label">筆圧補正</div>
                <div class="slider-container">
                    <div class="slider" id="pressure-correction-slider">
                        <div class="slider-track" id="pressure-correction-track"></div>
                        <div class="slider-handle" id="pressure-correction-handle"></div>
                    </div>
                    <div class="slider-value" id="pressure-correction-value">1.0</div>
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
                    線の滑らかさ。大きい値ほど線が滑らかになりますが反応が遅くなります。
                </div>
            </div>
            
            <div class="setting-group">
                <div class="setting-label">筆圧カーブ（将来機能）</div>
                <div style="font-size: 11px; color: var(--text-secondary); padding: 8px 12px; background: var(--futaba-background); border-radius: 6px; border: 1px dashed var(--futaba-light-medium);">
                    ユーザーごとの筆圧感度カスタマイズ機能は次のバージョンで実装予定です。
                </div>
            </div>
            
            <div class="setting-group">
                <div class="setting-label">ステータスパネル</div>
                <div style="display: flex; gap: 12px; align-items: center;">
                    <button id="status-panel-toggle" class="action-button" style="flex: 1;">
                        非表示
                    </button>
                    <span id="status-panel-state" style="font-size: 11px; color: var(--text-secondary); min-width: 60px; text-align: right;">
                        表示中
                    </span>
                </div>
            </div>
        `;
        
        document.querySelector('.canvas-area').appendChild(container);
        this.popup = container;
    }
    
    setupEventListeners() {
        const statusToggleBtn = document.getElementById('status-panel-toggle');
        if (statusToggleBtn) {
            statusToggleBtn.addEventListener('click', () => {
                this.toggleStatusPanel();
            });
        }
    }
    
    loadSettings() {
        const stored = localStorage.getItem('tegaki_settings');
        if (stored) {
            try {
                const settings = JSON.parse(stored);
                this.applySettings(settings);
            } catch (error) {
                this.initializeDefaultSettings();
            }
        } else {
            this.initializeDefaultSettings();
        }
    }
    
    initializeDefaultSettings() {
        const defaults = {
            pressureCorrection: 1.0,
            smoothing: 0.5,
            statusPanelVisible: true
        };
        
        this.applySettings(defaults);
        this.saveSettings(defaults);
    }
    
    applySettings(settings) {
        if (settings.pressureCorrection !== undefined) {
            this.updatePressureCorrectionSlider(settings.pressureCorrection);
            if (this.drawingEngine && this.drawingEngine.settings) {
                this.drawingEngine.settings.pressureCorrection = settings.pressureCorrection;
            }
        }
        
        if (settings.smoothing !== undefined) {
            this.updateSmoothingSlider(settings.smoothing);
            if (this.drawingEngine && this.drawingEngine.settings) {
                this.drawingEngine.settings.smoothing = settings.smoothing;
            }
        }
        
        if (settings.statusPanelVisible !== undefined) {
            this.setStatusPanelVisibility(settings.statusPanelVisible);
        }
    }
    
    updatePressureCorrectionSlider(value) {
        const min = 0.1;
        const max = 3.0;
        const clampedValue = Math.max(min, Math.min(max, value));
        
        const percentage = ((clampedValue - min) / (max - min)) * 100;
        const track = document.getElementById('pressure-correction-track');
        const handle = document.getElementById('pressure-correction-handle');
        const display = document.getElementById('pressure-correction-value');
        
        if (track) track.style.width = percentage + '%';
        if (handle) handle.style.left = percentage + '%';
        if (display) display.textContent = clampedValue.toFixed(2);
        
        this.setupPressureCorrectionListener();
    }
    
    updateSmoothingSlider(value) {
        const min = 0;
        const max = 1;
        const clampedValue = Math.max(min, Math.min(max, value));
        
        const percentage = (clampedValue / max) * 100;
        const track = document.getElementById('smoothing-track');
        const handle = document.getElementById('smoothing-handle');
        const display = document.getElementById('smoothing-value');
        
        if (track) track.style.width = percentage + '%';
        if (handle) handle.style.left = percentage + '%';
        if (display) display.textContent = clampedValue.toFixed(2);
        
        this.setupSmoothingListener();
    }
    
    setupPressureCorrectionListener() {
        const slider = document.getElementById('pressure-correction-slider');
        if (!slider || slider.pressureCorrectionListenerSetup) return;
        
        slider.pressureCorrectionListenerSetup = true;
        
        let dragging = false;
        const min = 0.1;
        const max = 3.0;
        
        const updateValue = (clientX) => {
            const rect = slider.getBoundingClientRect();
            const percentage = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
            const value = min + (percentage * (max - min));
            
            const track = slider.querySelector('.slider-track');
            const handle = slider.querySelector('.slider-handle');
            const display = document.getElementById('pressure-correction-value');
            
            track.style.width = (percentage * 100) + '%';
            handle.style.left = (percentage * 100) + '%';
            display.textContent = value.toFixed(2);
            
            if (this.drawingEngine && this.drawingEngine.settings) {
                this.drawingEngine.settings.pressureCorrection = value;
            }
        };
        
        slider.addEventListener('mousedown', (e) => {
            dragging = true;
            updateValue(e.clientX);
        });
        
        document.addEventListener('mousemove', (e) => {
            if (dragging) updateValue(e.clientX);
        });
        
        document.addEventListener('mouseup', () => {
            if (dragging) {
                dragging = false;
                const value = parseFloat(document.getElementById('pressure-correction-value').textContent);
                this.saveSettings({ pressureCorrection: value });
            }
        });
    }
    
    setupSmoothingListener() {
        const slider = document.getElementById('smoothing-slider');
        if (!slider || slider.smoothingListenerSetup) return;
        
        slider.smoothingListenerSetup = true;
        
        let dragging = false;
        const min = 0;
        const max = 1;
        
        const updateValue = (clientX) => {
            const rect = slider.getBoundingClientRect();
            const percentage = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
            const value = min + (percentage * (max - min));
            
            const track = slider.querySelector('.slider-track');
            const handle = slider.querySelector('.slider-handle');
            const display = document.getElementById('smoothing-value');
            
            track.style.width = (percentage * 100) + '%';
            handle.style.left = (percentage * 100) + '%';
            display.textContent = value.toFixed(2);
            
            if (this.drawingEngine && this.drawingEngine.settings) {
                this.drawingEngine.settings.smoothing = value;
            }
        };
        
        slider.addEventListener('mousedown', (e) => {
            dragging = true;
            updateValue(e.clientX);
        });
        
        document.addEventListener('mousemove', (e) => {
            if (dragging) updateValue(e.clientX);
        });
        
        document.addEventListener('mouseup', () => {
            if (dragging) {
                dragging = false;
                const value = parseFloat(document.getElementById('smoothing-value').textContent);
                this.saveSettings({ smoothing: value });
            }
        });
    }
    
    toggleStatusPanel() {
        const statusPanel = document.querySelector('.status-panel');
        if (!statusPanel) return;
        
        const isCurrentlyVisible = statusPanel.style.display !== 'none';
        const newVisibility = !isCurrentlyVisible;
        
        statusPanel.style.display = newVisibility ? 'flex' : 'none';
        
        const toggleBtn = document.getElementById('status-panel-toggle');
        const stateDisplay = document.getElementById('status-panel-state');
        
        if (toggleBtn) {
            toggleBtn.textContent = newVisibility ? '非表示' : '表示';
        }
        
        if (stateDisplay) {
            stateDisplay.textContent = newVisibility ? '表示中' : '非表示中';
        }
        
        this.saveSettings({ statusPanelVisible: newVisibility });
    }
    
    setStatusPanelVisibility(visible) {
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
    
    saveSettings(partial) {
        const stored = localStorage.getItem('tegaki_settings');
        const current = stored ? JSON.parse(stored) : {
            pressureCorrection: 1.0,
            smoothing: 0.5,
            statusPanelVisible: true
        };
        
        const updated = { ...current, ...partial };
        localStorage.setItem('tegaki_settings', JSON.stringify(updated));
    }
    
    show() {
        if (!this.popup) return;
        
        this.popup.classList.add('show');
        this.isVisible = true;
    }
    
    hide() {
        if (!this.popup) return;
        
        this.popup.classList.remove('show');
        this.isVisible = false;
    }
};

console.log('✅ settings-popup.js loaded');