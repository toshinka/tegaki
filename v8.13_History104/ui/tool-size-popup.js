// ui/tool-size-popup.js - Tool Size Popup（完全動作版）
// 責務: ペン・消しゴム共用のサイズ変更ポップアップUI

(function() {
  'use strict';

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
        if (settings && typeof settings.getBrushSize === 'function') {
          return settings;
        }
      } catch (e) {}
    }
    
    return null;
  }

  function createPopupDOM() {
    const config = window.TEGAKI_CONFIG;
    
    if (!config || !config.toolSizePopup) {
      console.error('[ToolSizePopup] TEGAKI_CONFIG.toolSizePopup not found');
      return null;
    }
    
    if (!window.DOMBuilder || !window.DOMBuilder.createElement) {
      console.error('[ToolSizePopup] DOMBuilder not found');
      return null;
    }
    
    const popupConfig = config.toolSizePopup;
    const panel = document.createElement('div');
    panel.className = 'tool-size-popup-panel';

    // スロットコンテナ
    const slotsContainer = document.createElement('div');
    slotsContainer.className = 'slots-container';
    
    slotElements = [];
    
    popupConfig.slots.forEach((size, index) => {
      const slotItem = document.createElement('div');
      slotItem.className = 'slot-item';
      
      const dotSize = Math.max(
        popupConfig.dotMinSize,
        Math.min(popupConfig.dotMaxSize, (size / popupConfig.sliderMax) * popupConfig.dotMaxSize)
      );
      
      const dot = document.createElement('div');
      dot.className = 'slot-dot';
      dot.style.width = `${dotSize}px`;
      dot.style.height = `${dotSize}px`;
      
      const number = document.createElement('div');
      number.className = 'slot-number';
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
    const sliderContainer = document.createElement('div');
    sliderContainer.className = 'size-slider-container';
    
    const decreaseBtn = document.createElement('button');
    decreaseBtn.className = 'slider-step-btn';
    decreaseBtn.textContent = '◀';
    decreaseBtn.addEventListener('click', () => adjustValue(-1));
    
    const sliderWrapper = document.createElement('div');
    sliderWrapper.className = 'slider-wrapper';
    
    sliderElement = document.createElement('input');
    sliderElement.type = 'range';
    sliderElement.className = 'size-slider';
    sliderElement.min = popupConfig.sliderMin;
    sliderElement.max = popupConfig.sliderMax;
    sliderElement.step = 0.1;
    sliderElement.addEventListener('input', handleSliderInput);
    
    valueInputElement = document.createElement('input');
    valueInputElement.type = 'number';
    valueInputElement.className = 'size-value-input';
    valueInputElement.min = popupConfig.sliderMin;
    valueInputElement.max = popupConfig.sliderMax;
    valueInputElement.step = 0.1;
    valueInputElement.addEventListener('change', handleValueInputChange);
    
    sliderWrapper.appendChild(sliderElement);
    sliderWrapper.appendChild(valueInputElement);
    
    const increaseBtn = document.createElement('button');
    increaseBtn.className = 'slider-step-btn';
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
    
    const config = window.TEGAKI_CONFIG;
    const size = config.toolSizePopup.slots[slotIndex];
    
    activeSlotIndex = slotIndex;
    
    applySize(size);
  }

  function handleSliderInput(e) {
    const value = parseFloat(e.target.value);
    updateValueDisplay(value);
    
    activeSlotIndex = null;
    updateActiveSlot();
  }

  function handleValueInputChange(e) {
    if (!currentTool) return;
    
    const config = window.TEGAKI_CONFIG;
    let value = parseFloat(e.target.value);
    
    value = Math.max(config.toolSizePopup.sliderMin, Math.min(config.toolSizePopup.sliderMax, value));
    value = roundToStep(value);
    
    activeSlotIndex = null;
    applySize(value);
  }

  function adjustValue(direction) {
    if (!currentTool) return;
    
    const config = window.TEGAKI_CONFIG;
    let currentValue = parseFloat(sliderElement.value);
    const step = getStepForValue(currentValue);
    
    let newValue = currentValue + (direction * step);
    newValue = Math.max(config.toolSizePopup.sliderMin, Math.min(config.toolSizePopup.sliderMax, newValue));
    newValue = roundToStep(newValue);
    
    activeSlotIndex = null;
    applySize(newValue);
  }

  function applySize(size) {
    if (!currentTool) return;
    
    const brushSettings = getBrushSettings();
    if (!brushSettings) {
      console.error('[ToolSizePopup] BrushSettings not found');
      return;
    }
    
    brushSettings.setBrushSize(size);
    
    updateUI(size);
    
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

  function detectActiveSlot(currentSize) {
    const config = window.TEGAKI_CONFIG;
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
    
    const brushSettings = getBrushSettings();
    if (!brushSettings) {
      console.error('[ToolSizePopup] BrushSettings not found');
      return;
    }
    
    const currentSize = brushSettings.getBrushSize();
    
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
      popupInDOM: popup ? document.body.contains(popup) : false,
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
      config: window.TEGAKI_CONFIG?.toolSizePopup,
      DOMBuilder: !!window.DOMBuilder
    };
  }

  window.ToolSizePopup = {
    show,
    hide,
    isVisible,
    forceShow,
    getDebugInfo
  };

})();

console.log('✅ tool-size-popup.js loaded');