// ===== settings-popup.js - SOLID原則準拠版 =====
// 責務: UI表示・ユーザー入力の受付・EventBusへの通知のみ

window.TegakiUI = window.TegakiUI || {};

window.TegakiUI.SettingsPopup = class {
    constructor(drawingEngine) {
        this.drawingEngine = drawingEngine; // 読み取り専用（現在の設定値取得用）
        this.eventBus = window.TegakiEventBus;
        this.popup = document.getElementById('settings-popup');
        this.isVisible = false;
        
        // HTMLに空のdivがある場合は中身を生成
        if (this.popup && this.popup.children.length === 0) {
            this.populatePopupContent();
        } else if (!this.popup) {
            this.createPopupElement();
        }
        
        // 位置を上部に変更（見切れ防止）
        if (this.popup) {
            this.popup.style.top = '60px';
            this.popup.style.left = '60px';
            this.popup.style.maxHeight = 'calc(100vh - 120px)';
            this.popup.style.overflowY = 'auto';
        }
        
        // イベントリスナーとデフォルト設定の読み込みは少し遅延させる
        setTimeout(() => {
            this.setupEventListeners();
            this.loadSettings();
        }, 100);
    }
    
    populatePopupContent() {
        // 既存の空のポップアップに中身を追加
        this.popup.innerHTML = `
            <div class="popup-title" style="font-size: 16px; font-weight: 600; color: var(--futaba-maroon); margin-bottom: 16px; text-align: center;">
                設定
            </div>
            
            <div class="setting-group">
                <div class="setting-label">筆圧補正（感度）</div>
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
    
    createPopupElement() {
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
        this.populatePopupContent();
    }
    
    setupEventListeners() {
        // ステータスパネル切り替え
        const statusToggleBtn = document.getElementById('status-panel-toggle');
        if (statusToggleBtn) {
            statusToggleBtn.addEventListener('click', () => {
                this.toggleStatusPanel();
            });
        }
        
        // 筆圧カーブボタン
        const curveBtns = document.querySelectorAll('.pressure-curve-btn');
        curveBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                curveBtns.forEach(b => {
                    b.classList.remove('active');
                    b.style.background = 'var(--futaba-background)';
                    b.style.borderColor = 'var(--futaba-light-medium)';
                    b.style.color = 'var(--futaba-maroon)';
                });
                
                btn.classList.add('active');
                btn.style.background = 'var(--futaba-maroon)';
                btn.style.borderColor = 'var(--futaba-maroon)';
                btn.style.color = 'var(--text-inverse)';
                
                const curve = btn.getAttribute('data-curve');
                this.notifyPressureCurveChange(curve);
            });
            
            // ホバー効果
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
    
    loadSettings() {
        const stored = localStorage.getItem('tegaki_settings');
        if (stored) {
            try {
                const settings = JSON.parse(stored);
                this.applySettingsToUI(settings);
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
            pressureCurve: 'linear',
            statusPanelVisible: true
        };
        
        this.applySettingsToUI(defaults);
        this.saveSettings(defaults);
    }
    
    applySettingsToUI(settings) {
        if (settings.pressureCorrection !== undefined) {
            this.updatePressureCorrectionSlider(settings.pressureCorrection);
        }
        
        if (settings.smoothing !== undefined) {
            this.updateSmoothingSlider(settings.smoothing);
        }
        
        if (settings.pressureCurve !== undefined) {
            this.applyPressureCurveUI(settings.pressureCurve);
        }
        
        if (settings.statusPanelVisible !== undefined) {
            this.setStatusPanelVisibility(settings.statusPanelVisible);
        }
    }
    
    // ===== 筆圧補正の通知（EventBus経由） =====
    notifyPressureCorrectionChange(value) {
        if (this.eventBus) {
            this.eventBus.emit('settings:pressure-correction', { value });
        }
        this.saveSettings({ pressureCorrection: value });
    }
    
    // ===== 線補正の通知（EventBus経由） =====
    notifySmoothingChange(value) {
        if (this.eventBus) {
            this.eventBus.emit('settings:smoothing', { value });
        }
        this.saveSettings({ smoothing: value });
    }
    
    // ===== 筆圧カーブの通知（EventBus経由） =====
    notifyPressureCurveChange(curve) {
        if (this.eventBus) {
            this.eventBus.emit('settings:pressure-curve', { curve });
        }
        this.saveSettings({ pressureCurve: curve });
    }
    
    applyPressureCurveUI(curve) {
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
            
            if (track) track.style.width = (percentage * 100) + '%';
            if (handle) handle.style.left = (percentage * 100) + '%';
            if (display) display.textContent = value.toFixed(2);
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
                this.notifyPressureCorrectionChange(value);
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
            
            if (track) track.style.width = (percentage * 100) + '%';
            if (handle) handle.style.left = (percentage * 100) + '%';
            if (display) display.textContent = value.toFixed(2);
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
                this.notifySmoothingChange(value);
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
            pressureCurve: 'linear',
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

console.log('✅ settings-popup.js SOLID原則準拠版 loaded');
console.log('   - EventBus経由で設定を通知');
console.log('   - DrawingEngineへの直接書き込みなし');
console.log('   - 位置調整: 上部固定・スクロール対応');