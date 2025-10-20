class ToolSizePopup {
  constructor(container, stateManager, eventBus, toolSizeManager) {
    this.container = container;
    this.stateManager = stateManager;
    this.eventBus = eventBus;
    this.toolSizeManager = toolSizeManager;
    
    this.popup = null;
    this.slotButtons = [];
    this.sizeValueDisplay = null;
    this.opacityValueDisplay = null;
    this.sizeSlider = null;
    this.opacitySlider = null;
    
    this._createPopup();
    this._setupEventListeners();
  }

  _createPopup() {
    this.popup = DOMBuilder.create('div', {
      className: 'popup tool-size-popup',
      styles: { display: 'none' }
    });

    const content = DOMBuilder.create('div', { className: 'popup-content' });
    
    // スロット選択UI
    const slotsContainer = this._createSlotsUI();
    content.appendChild(slotsContainer);
    
    // サイズスライダー
    const sizeSection = this._createSizeSlider();
    content.appendChild(sizeSection);
    
    // 不透明度スライダー
    const opacitySection = this._createOpacitySlider();
    content.appendChild(opacitySection);

    this.popup.appendChild(content);
    this.container.appendChild(this.popup);
  }

  _createSlotsUI() {
    const container = DOMBuilder.create('div', { className: 'tool-slots-container' });
    
    const slotCount = CONFIG.TOOL_SIZE_SLOTS;
    
    for (let i = 0; i < slotCount; i++) {
      const slotBtn = this._createSlotButton(i);
      this.slotButtons.push(slotBtn);
      container.appendChild(slotBtn);
    }
    
    return container;
  }

  _createSlotButton(index) {
    const btn = DOMBuilder.create('button', { className: 'tool-slot' });
    
    const thumbnail = DOMBuilder.create('div', { className: 'slot-thumbnail' });
    const circle = DOMBuilder.create('div', { className: 'slot-circle' });
    thumbnail.appendChild(circle);
    
    const sizeLabel = DOMBuilder.create('div', { className: 'slot-size-label' });
    const opacityLabel = DOMBuilder.create('div', { className: 'slot-opacity-label' });
    
    btn.appendChild(thumbnail);
    btn.appendChild(sizeLabel);
    btn.appendChild(opacityLabel);
    
    btn.addEventListener('click', () => this._handleSlotClick(index));
    
    return btn;
  }

  _createSizeSlider() {
    const section = DOMBuilder.create('div', { className: 'slider-section' });
    
    const label = DOMBuilder.create('label', { textContent: 'サイズ' });
    
    this.sizeValueDisplay = DOMBuilder.create('span', {
      className: 'value-display editable',
      textContent: '29.0px'
    });
    this.sizeValueDisplay.addEventListener('click', () => this._enableDirectInput('size'));
    
    const sliderContainer = DOMBuilder.create('div', { className: 'slider-container' });
    
    const btnContainer = DOMBuilder.create('div', { className: 'slider-buttons' });
    const decrements = [
      { value: -10, label: '-10' },
      { value: -1, label: '-1' },
      { value: -0.1, label: '-0.1' }
    ];
    decrements.forEach(({ value, label }) => {
      const btn = DOMBuilder.create('button', { textContent: label });
      btn.addEventListener('click', () => this._adjustSize(value));
      btnContainer.appendChild(btn);
    });

    this.sizeSlider = SliderUtils.createSlider({
      min: 0.1,
      max: 500,
      value: 29,
      step: 0.1,
      onChange: (value) => this._handleSizeChange(value)
    });
    
    const increments = [
      { value: 0.1, label: '+0.1' },
      { value: 1, label: '+1' },
      { value: 10, label: '+10' }
    ];
    increments.forEach(({ value, label }) => {
      const btn = DOMBuilder.create('button', { textContent: label });
      btn.addEventListener('click', () => this._adjustSize(value));
      btnContainer.appendChild(btn);
    });

    sliderContainer.appendChild(btnContainer);
    sliderContainer.appendChild(this.sizeSlider);
    sliderContainer.appendChild(btnContainer.cloneNode(true));
    
    sliderContainer.querySelectorAll('.slider-buttons')[1].querySelectorAll('button').forEach((btn, i) => {
      btn.addEventListener('click', () => this._adjustSize(increments[i].value));
    });

    section.appendChild(label);
    section.appendChild(this.sizeValueDisplay);
    section.appendChild(sliderContainer);
    
    return section;
  }

  _createOpacitySlider() {
    const section = DOMBuilder.create('div', { className: 'slider-section' });
    
    const label = DOMBuilder.create('label', { textContent: '不透明度' });
    
    this.opacityValueDisplay = DOMBuilder.create('span', {
      className: 'value-display editable',
      textContent: '85.0%'
    });
    this.opacityValueDisplay.addEventListener('click', () => this._enableDirectInput('opacity'));
    
    const sliderContainer = DOMBuilder.create('div', { className: 'slider-container' });
    
    const btnContainer = DOMBuilder.create('div', { className: 'slider-buttons' });
    const decrements = [
      { value: -10, label: '-10' },
      { value: -1, label: '-1' },
      { value: -0.1, label: '-0.1' }
    ];
    decrements.forEach(({ value, label }) => {
      const btn = DOMBuilder.create('button', { textContent: label });
      btn.addEventListener('click', () => this._adjustOpacity(value));
      btnContainer.appendChild(btn);
    });

    this.opacitySlider = SliderUtils.createSlider({
      min: 0,
      max: 100,
      value: 85,
      step: 0.1,
      onChange: (value) => this._handleOpacityChange(value / 100)
    });
    
    const increments = [
      { value: 0.1, label: '+0.1' },
      { value: 1, label: '+1' },
      { value: 10, label: '+10' }
    ];
    increments.forEach(({ value, label }) => {
      const btn = DOMBuilder.create('button', { textContent: label });
      btn.addEventListener('click', () => this._adjustOpacity(value));
      btnContainer.appendChild(btn);
    });

    sliderContainer.appendChild(btnContainer);
    sliderContainer.appendChild(this.opacitySlider);
    sliderContainer.appendChild(btnContainer.cloneNode(true));
    
    sliderContainer.querySelectorAll('.slider-buttons')[1].querySelectorAll('button').forEach((btn, i) => {
      btn.addEventListener('click', () => this._adjustOpacity(increments[i].value));
    });

    section.appendChild(label);
    section.appendChild(this.opacityValueDisplay);
    section.appendChild(sliderContainer);
    
    return section;
  }

  _setupEventListeners() {
    this.eventBus.on('tool:change', () => this._updateDisplay());
    this.eventBus.on('slot:changed', () => this._updateDisplay());
    this.eventBus.on('slot:updated', () => this._updateSlotDisplay());
    
    this.popup.addEventListener('click', (e) => e.stopPropagation());
  }

  _handleSlotClick(index) {
    this.toolSizeManager.setActiveSlot(index);
    this._updateDisplay();
  }

  _handleSizeChange(value) {
    const tool = this.stateManager.getCurrentTool();
    const opacity = this.stateManager.getOpacity();
    
    if (tool === 'pen') {
      this.stateManager.setPenSize(value);
      this.eventBus.emit('toolSize:change', value);
    } else if (tool === 'eraser') {
      this.stateManager.setEraserSize(value);
      this.eventBus.emit('eraserSize:change', value);
    }
    
    this.toolSizeManager.updateCurrentSlot(value, opacity);
    this._updateValueDisplay();
    this._updateSlotDisplay();
  }

  _handleOpacityChange(value) {
    const tool = this.stateManager.getCurrentTool();
    const size = tool === 'pen' ? this.stateManager.getPenSize() : this.stateManager.getEraserSize();
    
    this.stateManager.setOpacity(value);
    this.eventBus.emit('opacity:change', value);
    
    this.toolSizeManager.updateCurrentSlot(size, value);
    this._updateValueDisplay();
    this._updateSlotDisplay();
  }

  _adjustSize(delta) {
    const currentValue = parseFloat(this.sizeSlider.value);
    const newValue = Math.max(0.1, Math.min(500, currentValue + delta));
    this.sizeSlider.value = newValue;
    this._handleSizeChange(newValue);
  }

  _adjustOpacity(delta) {
    const currentValue = parseFloat(this.opacitySlider.value);
    const newValue = Math.max(0, Math.min(100, currentValue + delta));
    this.opacitySlider.value = newValue;
    this._handleOpacityChange(newValue / 100);
  }

  _enableDirectInput(type) {
    const display = type === 'size' ? this.sizeValueDisplay : this.opacityValueDisplay;
    const currentValue = type === 'size' 
      ? parseFloat(this.sizeSlider.value)
      : parseFloat(this.opacitySlider.value);
    
    const input = DOMBuilder.create('input', {
      type: 'number',
      value: currentValue.toFixed(1),
      className: 'direct-input'
    });
    
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this._applyDirectInput(type, input);
      } else if (e.key === 'Escape') {
        this._cancelDirectInput(type, display);
      }
    });
    
    input.addEventListener('blur', () => {
      this._applyDirectInput(type, input);
    });
    
    display.replaceWith(input);
    input.focus();
    input.select();
  }

  _applyDirectInput(type, input) {
    let value = parseFloat(input.value);
    
    if (type === 'size') {
      value = Math.max(0.1, Math.min(500, value));
      this.sizeSlider.value = value;
      this._handleSizeChange(value);
    } else {
      value = Math.max(0, Math.min(100, value));
      this.opacitySlider.value = value;
      this._handleOpacityChange(value / 100);
    }
    
    const display = type === 'size' ? this.sizeValueDisplay : this.opacityValueDisplay;
    input.replaceWith(display);
  }

  _cancelDirectInput(type, display) {
    const input = this.popup.querySelector('.direct-input');
    if (input) {
      input.replaceWith(display);
    }
  }

  _updateDisplay() {
    const tool = this.stateManager.getCurrentTool();
    const size = tool === 'pen' ? this.stateManager.getPenSize() : this.stateManager.getEraserSize();
    const opacity = this.stateManager.getOpacity();
    
    this.sizeSlider.value = size;
    this.opacitySlider.value = opacity * 100;
    
    this._updateValueDisplay();
    this._updateSlotDisplay();
  }

  _updateValueDisplay() {
    const size = parseFloat(this.sizeSlider.value);
    const opacity = parseFloat(this.opacitySlider.value);
    
    this.sizeValueDisplay.textContent = `${size.toFixed(1)}px`;
    this.opacityValueDisplay.textContent = `${opacity.toFixed(1)}%`;
  }

  _updateSlotDisplay() {
    const slots = this.toolSizeManager.getCurrentSlots();
    const activeIndex = this.toolSizeManager.getActiveSlotIndex();
    
    slots.forEach((slot, index) => {
      const btn = this.slotButtons[index];
      const circle = btn.querySelector('.slot-circle');
      const sizeLabel = btn.querySelector('.slot-size-label');
      const opacityLabel = btn.querySelector('.slot-opacity-label');
      
      // サムネイルサイズ計算
      const thumbnailSize = this._calculateThumbnailSize(slot.size);
      circle.style.width = `${thumbnailSize}px`;
      circle.style.height = `${thumbnailSize}px`;
      circle.style.opacity = slot.opacity;
      
      // ラベル更新
      sizeLabel.textContent = `${slot.size.toFixed(0)}px`;
      opacityLabel.textContent = `${(slot.opacity * 100).toFixed(0)}%`;
      
      // アクティブ状態
      if (index === activeIndex) {
        btn.classList.add('active');
        sizeLabel.style.color = '#8B0000';
        sizeLabel.style.fontWeight = 'bold';
        opacityLabel.style.color = '#8B0000';
      } else {
        btn.classList.remove('active');
        sizeLabel.style.color = '';
        sizeLabel.style.fontWeight = '';
        opacityLabel.style.color = '';
      }
    });
  }

  _calculateThumbnailSize(size) {
    const min = CONFIG.SLOT_THUMBNAIL_MIN;
    const max = CONFIG.SLOT_THUMBNAIL_MAX;
    const maxSize = 500;
    
    const normalized = Math.min(size / maxSize, 1);
    return min + (max - min) * normalized;
  }

  show() {
    this.popup.style.display = 'block';
    this._updateDisplay();
  }

  hide() {
    this.popup.style.display = 'none';
  }

  toggle() {
    if (this.popup.style.display === 'none') {
      this.show();
    } else {
      this.hide();
    }
  }
}