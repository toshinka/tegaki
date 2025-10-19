// ====================
// Tool Size Popup
// ====================
// ペン・消しゴムアイコンから開くサイズ変更ポップアップ
// 6つのスロット、スライダー、◀▶ボタン、ツールごと独立したアクティブ状態

window.ToolSizePopup = class ToolSizePopup {
  constructor(eventBus, toolSizeManager, config) {
    this.eventBus = eventBus;
    this.toolSizeManager = toolSizeManager;
    this.config = config.toolSizePopup;
    this.currentTool = null;
    this.panel = null;
    this.slider = null;
    this.numberInput = null;
    this.slotElements = [];
  }

  show(tool) {
    this.currentTool = tool;
    
    if (!this.panel) {
      this._createPanel();
    }

    this._updateUI();
    this.panel.style.display = 'block';
    
    // 位置調整（サイドバー右側に表示）
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) {
      const rect = sidebar.getBoundingClientRect();
      this.panel.style.left = `${rect.right + 10}px`;
      this.panel.style.top = `${rect.top + 100}px`;
    }
  }

  hide() {
    if (this.panel) {
      this.panel.style.display = 'none';
    }
  }

  _createPanel() {
    this.panel = document.createElement('div');
    this.panel.className = 'tool-size-popup-panel';
    this.panel.innerHTML = `
      <div class="popup-title">サイズ調整</div>
      <div class="tool-size-slots"></div>
      <div class="size-slider-container">
        <button class="slider-step-btn" data-action="decrease">◀</button>
        <input type="range" class="size-slider" min="${this.config.sliderMin}" max="${this.config.sliderMax}" step="0.1">
        <button class="slider-step-btn" data-action="increase">▶</button>
      </div>
      <div class="size-number-input-container">
        <input type="number" class="size-number-input" min="${this.config.sliderMin}" max="${this.config.sliderMax}" step="0.1">
      </div>
    `;

    document.body.appendChild(this.panel);

    // スロット生成
    this._createSlots();

    // スライダー初期化
    this.slider = this.panel.querySelector('.size-slider');
    this.numberInput = this.panel.querySelector('.size-number-input');

    // イベントリスナー設定
    this._setupEventListeners();
  }

  _createSlots() {
    const slotsContainer = this.panel.querySelector('.tool-size-slots');
    this.slotElements = [];

    this.config.slots.forEach((size, index) => {
      const slot = document.createElement('div');
      slot.className = 'slot-item';
      slot.dataset.slotIndex = index;
      
      const dotSize = this._calculateDotSize(size);
      
      slot.innerHTML = `
        <div class="slot-dot" style="width: ${dotSize}px; height: ${dotSize}px;"></div>
        <div class="slot-number">${size}</div>
      `;
      
      slotsContainer.appendChild(slot);
      this.slotElements.push(slot);
    });
  }

  _calculateDotSize(value) {
    const { dotMinSize, dotMaxSize, sliderMax } = this.config;
    const normalizedSize = Math.min(value / sliderMax, 1);
    return Math.max(dotMinSize, normalizedSize * dotMaxSize);
  }

  _setupEventListeners() {
    // スロットクリック
    this.slotElements.forEach((slot, index) => {
      slot.addEventListener('click', () => {
        this._handleSlotClick(index);
      });
    });

    // スライダー変更
    this.slider.addEventListener('input', (e) => {
      this._handleSliderChange(parseFloat(e.target.value));
    });

    // 数値入力変更
    this.numberInput.addEventListener('input', (e) => {
      let value = parseFloat(e.target.value);
      if (!isNaN(value)) {
        value = Math.max(this.config.sliderMin, Math.min(this.config.sliderMax, value));
        this._applySize(value);
      }
    });

    // ◀▶ボタン
    this.panel.querySelectorAll('.slider-step-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        this._handleStepButton(action);
      });
    });

    // 外側クリックで閉じる
    document.addEventListener('click', (e) => {
      if (this.panel && this.panel.style.display === 'block') {
        if (!this.panel.contains(e.target) && !e.target.closest('.tool-btn')) {
          this.hide();
        }
      }
    });
  }

  _handleSlotClick(slotIndex) {
    const size = this.config.slots[slotIndex];
    this.toolSizeManager.setActiveSlot(this.currentTool, slotIndex);
    this._applySize(size);
    this._updateUI();
  }

  _handleSliderChange(value) {
    const snappedValue = this._snapToStep(value);
    this._applySize(snappedValue);
  }

  _handleStepButton(action) {
    const currentValue = parseFloat(this.slider.value);
    const step = this._getStepSize(currentValue);
    const newValue = action === 'increase' ? currentValue + step : currentValue - step;
    const clampedValue = Math.max(this.config.sliderMin, Math.min(this.config.sliderMax, newValue));
    this._applySize(clampedValue);
  }

  _snapToStep(value) {
    const step = this._getStepSize(value);
    return Math.round(value / step) * step;
  }

  _getStepSize(value) {
    if (value < 3) return 0.1;
    if (value < 10) return 0.5;
    if (value < 30) return 1;
    if (value < 200) return 10;
    return 50;
  }

  _applySize(size) {
    const roundedSize = Math.round(size * 10) / 10;
    
    // UI更新
    this.slider.value = roundedSize;
    this.numberInput.value = roundedSize;
    
    // サイズ適用
    this.eventBus.emit('tool:size-opacity-changed', {
      tool: this.currentTool,
      size: roundedSize
    });
  }

  _updateUI() {
    if (!this.currentTool) return;

    const activeSlotIndex = this.toolSizeManager.getActiveSlot(this.currentTool);
    const currentSize = this.toolSizeManager.getCurrentSize(this.currentTool);

    // スロットのアクティブ状態更新
    this.slotElements.forEach((slot, index) => {
      if (index === activeSlotIndex) {
        slot.classList.add('active');
      } else {
        slot.classList.remove('active');
      }
    });

    // スライダーと数値入力を現在のサイズに更新
    if (this.slider) {
      this.slider.value = currentSize;
    }
    if (this.numberInput) {
      this.numberInput.value = currentSize;
    }
  }
}