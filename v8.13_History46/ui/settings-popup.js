/**
 * SettingsPopup - 統合設定パネル
 * 筆圧感度、線補正、UIの表示設定を管理
 */

class SettingsPopup {
  constructor() {
    this.isVisible = false;
    this.panel = null;
    this.brushSettings = null;
    
    this.initializePanel();
    this.attachEventListeners();
  }

  initializePanel() {
    // ポップアップパネル作成
    this.panel = document.createElement('div');
    this.panel.className = 'popup-panel';
    this.panel.id = 'settings-popup';
    this.panel.style.cssText = 'left: 60px; top: 100px; min-width: 320px;';
    
    this.panel.innerHTML = `
      <div class="popup-title" style="display: block; font-size: 16px; font-weight: 600; color: var(--futaba-maroon); margin-bottom: 16px;">設定</div>
      
      <!-- 筆圧感度設定 -->
      <div class="setting-group">
        <div class="setting-label">筆圧感度</div>
        <div class="slider-container">
          <div class="slider" id="pressure-sensitivity-slider">
            <div class="slider-track" id="pressure-sensitivity-track"></div>
            <div class="slider-handle" id="pressure-sensitivity-handle"></div>
          </div>
          <div class="slider-value" id="pressure-sensitivity-value">0.50</div>
        </div>
        <div style="font-size: 11px; color: var(--text-secondary); margin-top: 4px;">
          ペンタブレットの筆圧の反応度を調整します
        </div>
      </div>
      
      <!-- 線補正（Streamline） -->
      <div class="setting-group">
        <div class="setting-label">線補正</div>
        <div class="slider-container">
          <div class="slider" id="streamline-slider">
            <div class="slider-track" id="streamline-track"></div>
            <div class="slider-handle" id="streamline-handle"></div>
          </div>
          <div class="slider-value" id="streamline-value">0.50</div>
        </div>
        <div style="font-size: 11px; color: var(--text-secondary); margin-top: 4px;">
          線の滑らかさを調整します（高いほど遅延が発生）
        </div>
      </div>
      
      <!-- スムージング -->
      <div class="setting-group">
        <div class="setting-label">スムージング</div>
        <div class="slider-container">
          <div class="slider" id="smoothing-slider">
            <div class="slider-track" id="smoothing-track"></div>
            <div class="slider-handle" id="smoothing-handle"></div>
          </div>
          <div class="slider-value" id="smoothing-value">0.50</div>
        </div>
        <div style="font-size: 11px; color: var(--text-secondary); margin-top: 4px;">
          線の平滑化を調整します
        </div>
      </div>
      
      <!-- 太さ変化（Thinning） -->
      <div class="setting-group">
        <div class="setting-label">太さ変化</div>
        <div class="slider-container">
          <div class="slider" id="thinning-slider">
            <div class="slider-track" id="thinning-track"></div>
            <div class="slider-handle" id="thinning-handle"></div>
          </div>
          <div class="slider-value" id="thinning-value">0.50</div>
        </div>
        <div style="font-size: 11px; color: var(--text-secondary); margin-top: 4px;">
          筆圧による線の太さの変化量を調整します
        </div>
      </div>
      
      <!-- 筆圧シミュレーション -->
      <div class="setting-group">
        <div class="setting-label">筆圧シミュレーション</div>
        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
          <input type="checkbox" id="simulate-pressure-checkbox" checked style="cursor: pointer;">
          <span style="font-size: 12px; color: var(--text-secondary);">筆圧非対応デバイスで速度から筆圧を推定</span>
        </label>
      </div>
      
      <!-- UI表示設定 -->
      <div class="setting-group" style="border-top: 1px solid var(--futaba-light-medium); padding-top: 16px; margin-top: 16px;">
        <div class="setting-label">UI表示設定</div>
        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; margin-bottom: 8px;">
          <input type="checkbox" id="show-status-panel-checkbox" checked style="cursor: pointer;">
          <span style="font-size: 12px; color: var(--text-secondary);">ステータスパネルを表示</span>
        </label>
      </div>
      
      <!-- リセットボタン -->
      <div class="setting-group" style="margin-top: 16px;">
        <button class="action-button secondary" id="reset-settings-btn" style="width: 100%;">
          デフォルトに戻す
        </button>
      </div>
    `;
    
    document.body.appendChild(this.panel);
  }

  attachEventListeners() {
    // スライダーの初期化と操作
    this.initializeSlider('pressure-sensitivity', 0, 1, 0.5, (value) => {
      // 筆圧感度は現時点では表示のみ（将来の実装用）
      this.saveSetting('pressureSensitivity', value);
    });
    
    this.initializeSlider('streamline', 0, 1, 0.5, (value) => {
      if (this.brushSettings) {
        this.brushSettings.streamline = value;
      }
      this.saveSetting('streamline', value);
    });
    
    this.initializeSlider('smoothing', 0, 1, 0.5, (value) => {
      if (this.brushSettings) {
        this.brushSettings.smoothing = value;
      }
      this.saveSetting('smoothing', value);
    });
    
    this.initializeSlider('thinning', -1, 1, 0.5, (value) => {
      if (this.brushSettings) {
        this.brushSettings.thinning = value;
      }
      this.saveSetting('thinning', value);
    });
    
    // 筆圧シミュレーションチェックボックス
    const simulatePressureCheckbox = document.getElementById('simulate-pressure-checkbox');
    if (simulatePressureCheckbox) {
      simulatePressureCheckbox.addEventListener('change', (e) => {
        if (this.brushSettings) {
          this.brushSettings.simulatePressure = e.target.checked;
        }
        this.saveSetting('simulatePressure', e.target.checked);
      });
    }
    
    // ステータスパネル表示切替
    const showStatusPanelCheckbox = document.getElementById('show-status-panel-checkbox');
    if (showStatusPanelCheckbox) {
      showStatusPanelCheckbox.addEventListener('change', (e) => {
        const statusPanel = document.querySelector('.status-panel');
        if (statusPanel) {
          statusPanel.style.display = e.target.checked ? 'flex' : 'none';
        }
        this.saveSetting('showStatusPanel', e.target.checked);
      });
    }
    
    // リセットボタン
    const resetBtn = document.getElementById('reset-settings-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        this.resetToDefaults();
      });
    }
    
    // 設定読み込み
    this.loadSettings();
  }

  initializeSlider(id, min, max, defaultValue, onChange) {
    const slider = document.getElementById(`${id}-slider`);
    const track = document.getElementById(`${id}-track`);
    const handle = document.getElementById(`${id}-handle`);
    const valueDisplay = document.getElementById(`${id}-value`);
    
    if (!slider || !track || !handle || !valueDisplay) return;
    
    let currentValue = defaultValue;
    
    const updateSlider = (value) => {
      currentValue = Math.max(min, Math.min(max, value));
      const percent = ((currentValue - min) / (max - min)) * 100;
      track.style.width = percent + '%';
      handle.style.left = percent + '%';
      valueDisplay.textContent = currentValue.toFixed(2);
      if (onChange) onChange(currentValue);
    };
    
    updateSlider(defaultValue);
    
    let isDragging = false;
    
    handle.addEventListener('mousedown', (e) => {
      isDragging = true;
      e.preventDefault();
    });
    
    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const rect = slider.getBoundingClientRect();
      const percent = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
      const value = min + ((max - min) * percent / 100);
      updateSlider(value);
    });
    
    document.addEventListener('mouseup', () => {
      isDragging = false;
    });
    
    slider.addEventListener('click', (e) => {
      if (e.target === handle) return;
      const rect = slider.getBoundingClientRect();
      const percent = ((e.clientX - rect.left) / rect.width) * 100;
      const value = min + ((max - min) * percent / 100);
      updateSlider(value);
    });
    
    // スライダーインスタンスを保存
    this[`${id}Slider`] = { updateSlider };
  }

  setBrushSettings(brushSettings) {
    this.brushSettings = brushSettings;
    
    // 現在の値を反映
    if (brushSettings) {
      if (this.streamlineSlider) {
        this.streamlineSlider.updateSlider(brushSettings.streamline || 0.5);
      }
      if (this.smoothingSlider) {
        this.smoothingSlider.updateSlider(brushSettings.smoothing || 0.5);
      }
      if (this.thinningSlider) {
        this.thinningSlider.updateSlider(brushSettings.thinning || 0.5);
      }
      
      const simulateCheckbox = document.getElementById('simulate-pressure-checkbox');
      if (simulateCheckbox) {
        simulateCheckbox.checked = brushSettings.simulatePressure !== false;
      }
    }
  }

  show() {
    if (this.panel) {
      this.panel.classList.add('show');
      this.isVisible = true;
    }
  }

  hide() {
    if (this.panel) {
      this.panel.classList.remove('show');
      this.isVisible = false;
    }
  }

  toggle() {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }

  saveSetting(key, value) {
    try {
      const settings = JSON.parse(localStorage.getItem('tegaki_settings') || '{}');
      settings[key] = value;
      localStorage.setItem('tegaki_settings', JSON.stringify(settings));
    } catch (e) {
      // localStorageが使用できない環境では無視
    }
  }

  loadSettings() {
    try {
      const settings = JSON.parse(localStorage.getItem('tegaki_settings') || '{}');
      
      if (settings.streamline !== undefined && this.streamlineSlider) {
        this.streamlineSlider.updateSlider(settings.streamline);
      }
      if (settings.smoothing !== undefined && this.smoothingSlider) {
        this.smoothingSlider.updateSlider(settings.smoothing);
      }
      if (settings.thinning !== undefined && this.thinningSlider) {
        this.thinningSlider.updateSlider(settings.thinning);
      }
      if (settings.pressureSensitivity !== undefined && this['pressure-sensitivitySlider']) {
        this['pressure-sensitivitySlider'].updateSlider(settings.pressureSensitivity);
      }
      
      const simulateCheckbox = document.getElementById('simulate-pressure-checkbox');
      if (settings.simulatePressure !== undefined && simulateCheckbox) {
        simulateCheckbox.checked = settings.simulatePressure;
        if (this.brushSettings) {
          this.brushSettings.simulatePressure = settings.simulatePressure;
        }
      }
      
      const showStatusCheckbox = document.getElementById('show-status-panel-checkbox');
      if (settings.showStatusPanel !== undefined && showStatusCheckbox) {
        showStatusCheckbox.checked = settings.showStatusPanel;
        const statusPanel = document.querySelector('.status-panel');
        if (statusPanel) {
          statusPanel.style.display = settings.showStatusPanel ? 'flex' : 'none';
        }
      }
    } catch (e) {
      // localStorageが使用できない環境では無視
    }
  }

  resetToDefaults() {
    if (this['pressure-sensitivitySlider']) {
      this['pressure-sensitivitySlider'].updateSlider(0.5);
    }
    if (this.streamlineSlider) {
      this.streamlineSlider.updateSlider(0.5);
    }
    if (this.smoothingSlider) {
      this.smoothingSlider.updateSlider(0.5);
    }
    if (this.thinningSlider) {
      this.thinningSlider.updateSlider(0.5);
    }
    
    const simulateCheckbox = document.getElementById('simulate-pressure-checkbox');
    if (simulateCheckbox) {
      simulateCheckbox.checked = true;
      if (this.brushSettings) {
        this.brushSettings.simulatePressure = true;
      }
    }
    
    const showStatusCheckbox = document.getElementById('show-status-panel-checkbox');
    if (showStatusCheckbox) {
      showStatusCheckbox.checked = true;
      const statusPanel = document.querySelector('.status-panel');
      if (statusPanel) {
        statusPanel.style.display = 'flex';
      }
    }
    
    // localStorageをクリア
    try {
      localStorage.removeItem('tegaki_settings');
    } catch (e) {}
  }
}

// グローバル登録
if (typeof window.TegakiUI === 'undefined') {
  window.TegakiUI = {};
}
window.TegakiUI.SettingsPopup = SettingsPopup;

console.log('✅ settings-popup.js loaded');