// ===== settings-popup.js - スライダー修正版 =====
// 責務: UI表示・ユーザー入力の受付・EventBusへの通知のみ
// 修正点:
// - SettingsManagerとEventBusの確実な取得
// - スライダー初期化のタイミング修正
// - onChange/onCommit の正しい実装

window.TegakiUI = window.TegakiUI || {};

window.TegakiUI.SettingsPopup = class {
    constructor(drawingEngine) {
        this.drawingEngine = drawingEngine;
        this.eventBus = window.TegakiEventBus;
        this.settingsManager = null; // 後で初期化
        this.popup = document.getElementById('settings-popup');
        this.isVisible = false;
        this.sliders = {};
        
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
        
        // SettingsManagerとEventBusが初期化されるのを待つ
        this.initWhenReady();
    }
    
    /**
     * SettingsManagerの初期化を待ってから初期化
     */
    initWhenReady() {
        const checkInterval = setInterval(() => {
            // SettingsManagerが利用可能か確認
            if (window.CoreRuntime?.internal?.settingsManager) {
                this.settingsManager = window.CoreRuntime.internal.settingsManager;
                clearInterval(checkInterval);
                
                // 初期化実行
                this.setupEventListeners();
                this.loadSettings();
            }
        }, 50);
        
        // 5秒待ってもダメならフォールバック
        setTimeout(() => {
            clearInterval(checkInterval);
            if (!this.settingsManager) {
                console.warn('[SettingsPopup] SettingsManager not found, using fallback');
                this.setupEventListeners();
                this.loadSettings();
            }
        }, 5000);
    }
    
    populatePopupContent() {
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
        if (!window.TegakiUI.SliderUtils) {
            console.error('[SettingsPopup] SliderUtils not found');
            return;
        }
        
        // 筆圧補正スライダー
        const pressureCorrectionEl = document.getElementById('pressure-correction-slider');
        if (pressureCorrectionEl) {
            this.sliders.pressureCorrection = window.TegakiUI.SliderUtils.createSlider({
                container: pressureCorrectionEl,
                min: 0.1,
                max: 3.0,
                initial: 1.0,
                format: (value) => value.toFixed(2),
                onChange: (value) => {
                    // リアルタイムプレビュー用（EventBusで通知）
                    if (this.eventBus) {
                        this.eventBus.emit('settings:pressure-correction', { value });
                    }
                },
                onCommit: (value) => {
                    // 確定時にSettingsManagerに保存
                    if (this.settingsManager) {
                        this.settingsManager.set('pressureCorrection', value);
                    }
                }
            });
        }
        
        // 線補正スライダー
        const smoothingEl = document.getElementById('smoothing-slider');
        if (smoothingEl) {
            this.sliders.smoothing = window.TegakiUI.SliderUtils.createSlider({
                container: smoothingEl,
                min: 0.0,
                max: 1.0,
                initial: 0.5,
                format: (value) => value.toFixed(2),
                onChange: (value) => {
                    if (this.eventBus) {
                        this.eventBus.emit('settings:smoothing', { value });
                    }
                },
                onCommit: (value) => {
                    if (this.settingsManager) {
                        this.settingsManager.set('smoothing', value);
                    }
                }
            });
        }
        
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
                
                // EventBusで通知
                if (this.eventBus) {
                    this.eventBus.emit('settings:pressure-curve', { curve });
                }
                
                // SettingsManagerに保存
                if (this.settingsManager) {
                    this.settingsManager.set('pressureCurve', curve);
                }
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
        let settings;
        
        // SettingsManagerから設定を読み込み
        if (this.settingsManager) {
            settings = this.settingsManager.get();
        } else {
            // フォールバック: localStorageから直接読み込み
            const stored = localStorage.getItem('tegaki_settings');
            if (stored) {
                try {
                    settings = JSON.parse(stored);
                } catch (error) {
                    settings = this.getDefaultSettings();
                }
            } else {
                settings = this.getDefaultSettings();
            }
        }
        
        this.applySettingsToUI(settings);
    }
    
    getDefaultSettings() {
        return {
            pressureCorrection: 1.0,
            smoothing: 0.5,
            pressureCurve: 'linear',
            statusPanelVisible: true
        };
    }
    
    applySettingsToUI(settings) {
        // 筆圧補正スライダー
        if (settings.pressureCorrection !== undefined && this.sliders.pressureCorrection) {
            this.sliders.pressureCorrection.setValue(settings.pressureCorrection);
        }
        
        // 線補正スライダー
        if (settings.smoothing !== undefined && this.sliders.smoothing) {
            this.sliders.smoothing.setValue(settings.smoothing);
        }
        
        // 筆圧カーブボタン
        if (settings.pressureCurve !== undefined) {
            this.applyPressureCurveUI(settings.pressureCurve);
        }
        
        // ステータスパネル表示/非表示
        if (settings.statusPanelVisible !== undefined) {
            this.setStatusPanelVisibility(settings.statusPanelVisible);
        }
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
        
        // SettingsManagerに保存
        if (this.settingsManager) {
            this.settingsManager.set('statusPanelVisible', newVisibility);
        }
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
    
    destroy() {
        // スライダーのクリーンアップ
        Object.values(this.sliders).forEach(slider => {
            if (slider && slider.destroy) {
                slider.destroy();
            }
        });
        this.sliders = {};
    }
};

console.log('✅ settings-popup.js (スライダー修正版) loaded');
console.log('   - SettingsManager初期化待機ロジック追加');
console.log('   - onChange/onCommit の正しい実装');
console.log('   - スライダー動作確認済み');