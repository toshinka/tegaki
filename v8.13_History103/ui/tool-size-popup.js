// ui/tool-size-popup.js v2.0
// ペン・消しゴム共用のサイズ変更ポップアップUI
// 🔧 改修: TEGAKI_CONFIG対応、BrushSettings統合

const ToolSizePopup = (() => {
  let popup = null;
  let currentTool = null;
  let slotElements = [];
  let sliderElement = null;
  let valueInputElement = null;
  let activeSlotIndex = null;

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

  /**
   * 🔧 改修: BrushSettingsから現在のサイズを取得
   */
  function getBrushSettings() {
    const sources = [
      () => window.drawingApp?.drawingEngine?.settings,
      () => window.coreEngine?.drawingEngine?.settings,
      () => window.CoreRuntime?.internal?.drawingEngine?.settings,
      () => window.drawingEngine?.settings
    ];
    
    for (const fn of sources) {
      try {
        const settings = fn();
        if (settings) return settings;
      } catch (e) {}
    }
    
    return null;
  }

  function createPopupDOM() {
    const config = window.TEGAKI_CONFIG || window.CONFIG;
    
    if (!config?.toolSizePopup) {
      console.error('[ToolSizePopup] CONFIG.toolSizePopup not found!');
      return null;
    }
    
    if (!window.DOMBuilder?.createElement) {
      console.error('[ToolSizePopup] DOMBuilder not found!');
      return null;
    }
    
    const popupConfig = config.toolSizePopup;
    const panel = DOMBuilder.createElement('div', 'tool-size-popup-panel popup-panel');

    // スロットコンテナ
    const slotsContainer = DOMBuilder.createElement('div', 'slots-container');
    
    popupConfig.slots.forEach((size, index) => {
      const slotItem = DOMBuilder.createElement('div', 'slot-item');
      
      const dotSize = Math.max(
        popupConfig.dotMinSize,
        Math.min(popupConfig.dotMaxSize, (size / popupConfig.sliderMax) * popupConfig.dotMaxSize)
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
    sliderElement.min = popupConfig.sliderMin;
    sliderElement.max = popupConfig.sliderMax;
    sliderElement.step = 0.1;
    sliderElement.addEventListener('input', handleSliderInput);
    
    valueInputElement = DOMBuilder.createElement('input');
    valueInputElement.type = 'number';
    valueInputElement.className = 'size-value-input';
    valueInputElement.min = popupConfig.sliderMin;
    valueInputElement.max = popupConfig.sliderMax;
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

  /**
   * 🔧 改修: スロットクリック時、BrushSettingsに直接反映
   */
  function handleSlotClick(slotIndex) {
    if (!currentTool) return;
    
    const config = window.TEGAKI_CONFIG || window.CONFIG;
    const size = config.toolSizePopup.slots[slotIndex];
    
    activeSlotIndex = slotIndex;
    
    applySize(size);
  }

  function handleSliderInput(e) {
    const value = parseFloat(e.target.value);
    updateValueDisplay(value);
    
    // スライダー操作時はスロットのアクティブを解除
    activeSlotIndex = null;
    updateActiveSlot();
  }

  function handleValueInputChange(e) {
    if (!currentTool) return;
    
    const config = window.TEGAKI_CONFIG || window.CONFIG;
    let value = parseFloat(e.target.value);
    
    value = Math.max(config.toolSizePopup.sliderMin, Math.min(config.toolSizePopup.sliderMax, value));
    value = roundToStep(value);
    
    activeSlotIndex = null;
    applySize(value);
  }

  function adjustValue(direction) {
    if (!currentTool) return;
    
    const config = window.TEGAKI_CONFIG || window.CONFIG;
    let currentValue = parseFloat(sliderElement.value);
    const step = getStepForValue(currentValue);
    
    let newValue = currentValue + (direction * step);
    newValue = Math.max(config.toolSizePopup.sliderMin, Math.min(config.toolSizePopup.sliderMax, newValue));
    newValue = roundToStep(newValue);
    
    activeSlotIndex = null;
    applySize(newValue);
  }

  /**
   * 🔧 改修: BrushSettingsに直接反映
   */
  function applySize(size) {
    if (!currentTool) return;
    
    const brushSettings = getBrushSettings();
    if (!brushSettings) {
      console.error('[ToolSizePopup] BrushSettings not found');
      return;
    }
    
    // BrushSettingsに反映
    brushSettings.setBrushSize(size);
    
    // UIを更新
    updateUI(size);
    
    // EventBus通知（DragVisualFeedback用）
    if (window.TegakiEventBus) {
      window.TegakiEventBus.emit('tool:size-opacity-changed', {
        tool: currentTool,
        size: size,
        opacity: brushSettings.getBrushOpacity()
      });
    }
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
    slotElements.forEach((element, index) => {
      if (index === activeSlotIndex) {
        element.classList.add('active');
      } else {
        element.classList.remove('active');
      }
    });
  }

  /**
   * 🔧 改修: BrushSettingsから現在のサイズを取得してスロットマッチング
   */
  function detectActiveSlot(currentSize) {
    const config = window.TEGAKI_CONFIG || window.CONFIG;
    const slots = config.toolSizePopup.slots;
    
    const matchIndex = slots.findIndex(size => Math.abs(size - currentSize) < 0.01);
    
    if (matchIndex !== -1) {
      activeSlotIndex = matchIndex;
    } else {
      activeSlotIndex = null;
    }
  }

  function show(tool) {
    if (!popup) {
      popup = createPopupDOM();
      if (!popup) {
        console.error('[ToolSizePopup] Failed to create popup DOM');
        return;
      }
      document.body.appendChild(popup);
    }

    currentTool = tool;
    
    // 🔧 改修: BrushSettingsから現在のサイズを取得
    const brushSettings = getBrushSettings();
    if (!brushSettings) {
      console.error('[ToolSizePopup] BrushSettings not found');
      return;
    }
    
    const currentSize = brushSettings.getBrushSize();
    
    // スロットマッチング
    detectActiveSlot(currentSize);
    
    updateUI(currentSize);
    
    popup.style.display = 'block';
    
    if (window.TegakiEventBus) {
      window.TegakiEventBus.emit('popup:opened', { type: 'toolSize' });
    }
  }

  function hide() {
    if (popup) {
      popup.style.display = 'none';
      currentTool = null;
      activeSlotIndex = null;
    }
    
    if (window.TegakiEventBus) {
      window.TegakiEventBus.emit('popup:closed', { type: 'toolSize' });
    }
  }

  function isVisible() {
    return popup && popup.style.display === 'block';
  }

  function forceShow(tool = 'pen') {
    show(tool);
  }

  function getDebugInfo() {
    const brushSettings = getBrushSettings();
    
    return {
      popupExists: !!popup,
      isVisible: isVisible(),
      currentTool,
      activeSlotIndex,
      slotElementsCount: slotElements.length,
      hasSlider: !!sliderElement,
      hasValueInput: !!valueInputElement,
      brushSettings: {
        available: !!brushSettings,
        currentSize: brushSettings ? brushSettings.getBrushSize() : null,
        currentOpacity: brushSettings ? brushSettings.getBrushOpacity() : null
      },
      config: window.TEGAKI_CONFIG?.toolSizePopup || window.CONFIG?.toolSizePopup
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

console.log('✅ tool-size-popup.js v2.0 loaded');
console.log('   🔧 TEGAKI_CONFIG対応');
console.log('   🔧 BrushSettings統合');
console.log('   🔧 ToolSizeManagerへの依存削除');
console.log('   💡 Test: window.ToolSizePopup.forceShow("pen")');