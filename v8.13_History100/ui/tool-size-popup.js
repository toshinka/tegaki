// ui/tool-size-popup.js
// ペン・消しゴム共用のサイズ変更ポップアップUI

const ToolSizePopup = (() => {
  let popup = null;
  let currentTool = null;
  let slotElements = [];
  let sliderElement = null;
  let valueInputElement = null;

  // テーパリング刻み幅定義
  const TAPER_STEPS = [
    { max: 3, step: 0.1 },
    { max: 10, step: 0.5 },
    { max: 30, step: 1 },
    { max: 200, step: 10 },
    { max: 500, step: 50 }
  ];

  function getStepForValue(value) {
    for (const range of TAPER_STEPS) {
      if (value < range.max) return range.step;
    }
    return TAPER_STEPS[TAPER_STEPS.length - 1].step;
  }

  function roundToStep(value) {
    const step = getStepForValue(value);
    return Math.round(value / step) * step;
  }

  function createPopupDOM() {
    console.log('[ToolSizePopup] Creating popup DOM...');
    
    if (!window.CONFIG?.toolSizePopup) {
      console.error('[ToolSizePopup] CONFIG.toolSizePopup not found!');
      return null;
    }
    
    if (!window.DOMBuilder?.createElement) {
      console.error('[ToolSizePopup] DOMBuilder not found!');
      return null;
    }
    
    const config = window.CONFIG.toolSizePopup;
    const panel = DOMBuilder.createElement('div', 'tool-size-popup-panel popup-panel');

    // スロットコンテナ
    const slotsContainer = DOMBuilder.createElement('div', 'slots-container');
    
    console.log('[ToolSizePopup] Creating', config.slots.length, 'slots');
    
    config.slots.forEach((size, index) => {
      const slotItem = DOMBuilder.createElement('div', 'slot-item');
      
      const dotSize = Math.max(
        config.dotMinSize,
        Math.min(config.dotMaxSize, (size / config.sliderMax) * config.dotMaxSize)
      );
      
      const dot = DOMBuilder.createElement('div', 'slot-dot');
      dot.style.width = `${dotSize}px`;
      dot.style.height = `${dotSize}px`;
      
      const number = DOMBuilder.createElement('div', 'slot-number');
      number.textContent = size;
      
      slotItem.appendChild(dot);
      slotItem.appendChild(number);
      slotItem.dataset.index = index;
      slotItem.dataset.size = size;
      
      slotItem.addEventListener('click', () => handleSlotClick(index));
      
      slotElements.push(slotItem);
      slotsContainer.appendChild(slotItem);
    });

    panel.appendChild(slotsContainer);

    // スライダーコンテナ
    const sliderContainer = DOMBuilder.createElement('div', 'size-slider-container');
    
    const decreaseBtn = DOMBuilder.createElement('button', 'slider-step-btn');
    decreaseBtn.textContent = '◀';
    decreaseBtn.addEventListener('click', () => adjustValue(-1));
    
    const sliderWrapper = DOMBuilder.createElement('div', 'slider-wrapper');
    
    sliderElement = DOMBuilder.createElement('input');
    sliderElement.type = 'range';
    sliderElement.className = 'size-slider';
    sliderElement.min = config.sliderMin;
    sliderElement.max = config.sliderMax;
    sliderElement.step = 0.1;
    sliderElement.addEventListener('input', handleSliderInput);
    
    valueInputElement = DOMBuilder.createElement('input');
    valueInputElement.type = 'number';
    valueInputElement.className = 'size-value-input';
    valueInputElement.min = config.sliderMin;
    valueInputElement.max = config.sliderMax;
    valueInputElement.step = 0.1;
    valueInputElement.addEventListener('change', handleValueInputChange);
    
    sliderWrapper.appendChild(sliderElement);
    sliderWrapper.appendChild(valueInputElement);
    
    const increaseBtn = DOMBuilder.createElement('button', 'slider-step-btn');
    increaseBtn.textContent = '▶';
    increaseBtn.addEventListener('click', () => adjustValue(1));
    
    sliderContainer.appendChild(decreaseBtn);
    sliderContainer.appendChild(sliderWrapper);
    sliderContainer.appendChild(increaseBtn);
    
    panel.appendChild(sliderContainer);

    return panel;
  }

  function handleSlotClick(slotIndex) {
    if (!currentTool) return;
    
    const config = window.CONFIG.toolSizePopup;
    const size = config.slots[slotIndex];
    
    window.ToolSizeManager.setActiveSlot(currentTool, slotIndex);
    window.ToolSizeManager.applySizeFromSlot(currentTool, slotIndex);
    
    updateUI(size);
    
    window.EventBus.emit('tool:size-opacity-changed', {
      tool: currentTool,
      size,
      opacity: window.SettingsManager.getToolOpacity(currentTool)
    });
  }

  function handleSliderInput(e) {
    const value = parseFloat(e.target.value);
    updateValueDisplay(value);
  }

  function handleValueInputChange(e) {
    if (!currentTool) return;
    
    const config = window.CONFIG.toolSizePopup;
    let value = parseFloat(e.target.value);
    
    value = Math.max(config.sliderMin, Math.min(config.sliderMax, value));
    value = roundToStep(value);
    
    applySize(value);
  }

  function adjustValue(direction) {
    if (!currentTool) return;
    
    const config = window.CONFIG.toolSizePopup;
    let currentValue = parseFloat(sliderElement.value);
    const step = getStepForValue(currentValue);
    
    let newValue = currentValue + (direction * step);
    newValue = Math.max(config.sliderMin, Math.min(config.sliderMax, newValue));
    newValue = roundToStep(newValue);
    
    applySize(newValue);
  }

  function applySize(size) {
    if (!currentTool) return;
    
    window.ToolSizeManager.setSize(currentTool, size);
    window.ToolSizeManager.clearActiveSlot(currentTool);
    
    updateUI(size);
    
    window.EventBus.emit('tool:size-opacity-changed', {
      tool: currentTool,
      size,
      opacity: window.SettingsManager.getToolOpacity(currentTool)
    });
  }

  function updateUI(size) {
    updateSlider(size);
    updateValueDisplay(size);
    updateActiveSlot();
  }

  function updateSlider(size) {
    if (sliderElement) {
      sliderElement.value = size;
    }
  }

  function updateValueDisplay(size) {
    if (valueInputElement) {
      valueInputElement.value = size.toFixed(1);
    }
  }

  function updateActiveSlot() {
    const activeSlot = window.ToolSizeManager.getActiveSlot(currentTool);
    
    slotElements.forEach((element, index) => {
      if (index === activeSlot) {
        element.classList.add('active');
      } else {
        element.classList.remove('active');
      }
    });
  }

  function show(tool) {
    console.log('[ToolSizePopup] show() called for tool:', tool);
    console.log('[ToolSizePopup] CONFIG exists:', !!window.CONFIG);
    console.log('[ToolSizePopup] ToolSizeManager exists:', !!window.ToolSizeManager);
    
    if (!popup) {
      console.log('[ToolSizePopup] Creating popup DOM...');
      popup = createPopupDOM();
      document.body.appendChild(popup);
      console.log('[ToolSizePopup] Popup appended to body');
    }

    currentTool = tool;
    
    const currentSize = window.ToolSizeManager.getSize(tool);
    console.log('[ToolSizePopup] Current size for', tool, ':', currentSize);
    
    updateUI(currentSize);
    
    popup.style.display = 'block';
    console.log('[ToolSizePopup] Popup displayed');
    
    window.EventBus.emit('popup:opened', { type: 'toolSize' });
  }

  function hide() {
    if (popup) {
      popup.style.display = 'none';
      currentTool = null;
    }
    
    window.EventBus.emit('popup:closed', { type: 'toolSize' });
  }

  function isVisible() {
    return popup && popup.style.display === 'block';
  }

  function forceShow(tool = 'pen') {
    console.log('[ToolSizePopup] Force showing popup for:', tool);
    show(tool);
  }

  function getDebugInfo() {
    return {
      popupExists: !!popup,
      isVisible: isVisible(),
      currentTool,
      slotElementsCount: slotElements.length,
      hasSlider: !!sliderElement,
      hasValueInput: !!valueInputElement,
      config: window.CONFIG?.toolSizePopup
    };
  }

  return {
    show,
    hide,
    isVisible,
    forceShow,
    getDebugInfo
  };
})();

window.ToolSizePopup = ToolSizePopup;

console.log('✅ tool-size-popup.js loaded');
console.log('Debug: window.ToolSizePopup.forceShow("pen") to test');