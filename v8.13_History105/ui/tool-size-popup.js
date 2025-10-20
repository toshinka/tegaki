// ui/tool-size-popup.js - Tool Size Popup（完全動作版 v2）
// 責務: ペン・消しゴム共用のサイズ・不透明度変更ポップアップUI
// 改修: 対数スケール●サイズ、不透明度UI追加、BrushSettings直接操作、入力中クローズ防止

(function() {
  'use strict';

  let popup = null;
  let currentTool = null;
  let slotElements = [];
  let sliderElement = null;
  let valueInputElement = null;
  let opacitySliderElement = null;
  let opacityValueElement = null;
  let activeSlotIndex = null;
  let isInputFocused = false;

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
      () => window.CoreRuntime?.internal?.drawingEngine?.settings,
      () => window.coreEngine?.drawingEngine?.settings,
      () => window.drawingApp?.drawingEngine?.settings,
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

  /**
   * スロット●サイズを対数スケールで計算
   */
  function calculateDotSize(slotValue) {
    const config = window.TEGAKI_CONFIG?.toolSizePopup;
    if (!config) return 8;
    
    const { dotMinSize, dotMaxSize, sliderMin, sliderMax } = config;
    const logMin = Math.log(sliderMin);
    const logMax = Math.log(sliderMax);
    const logValue = Math.log(Math.max(sliderMin, slotValue));
    const ratio = (logValue - logMin) / (logMax - logMin);
    
    return dotMinSize + ratio * (dotMaxSize - dotMinSize);
  }

  function createPopupDOM() {
    const config = window.TEGAKI_CONFIG;
    
    if (!config || !config.toolSizePopup) {
      console.error('[ToolSizePopup] TEGAKI_CONFIG.toolSizePopup not found');
      return null;
    }
    
    const popupConfig = config.toolSizePopup;
    const panel = document.createElement('div');
    panel.className = 'tool-size-popup-panel';

    // スロットコンテナ
    const slotsContainer = document.createElement('div');
    slotsContainer.className = 'slots-container';
    
    slotElements = [];
    
    // ツール別スロット取得（フォールバック対応）
    let slots;
    if (popupConfig.slots[currentTool]) {
      slots = popupConfig.slots[currentTool];
    } else if (popupConfig.slots.pen) {
      slots = popupConfig.slots.pen;
    } else if (Array.isArray(popupConfig.slots)) {
      // 旧形式（配列）のフォールバック
      slots = popupConfig.slots;
    } else {
      console.error('[ToolSizePopup] Invalid slots configuration');
      return null;
    }
    
    slots.forEach((size, index) => {
      const slotItem = document.createElement('div');
      slotItem.className = 'slot-item';
      
      const dotSize = calculateDotSize(size);
      
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

    // サイズラベル
    const sizeLabel = document.createElement('div');
    sizeLabel.className = 'popup-label';
    sizeLabel.textContent = 'サイズ';
    panel.appendChild(sizeLabel);

    // サイズスライダーコンテナ
    const sliderContainer = document.createElement('div');
    sliderContainer.className = 'size-slider-container';
    
    const decreaseBtn = document.createElement('button');
    decreaseBtn.className = 'slider-step-btn';
    decreaseBtn.textContent = '◀';
    decreaseBtn.addEventListener('click', () => adjustValue(-1, 'size'));
    
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
    valueInputElement.addEventListener('focus', () => { isInputFocused = true; });
    valueInputElement.addEventListener('blur', () => { isInputFocused = false; });
    valueInputElement.addEventListener('change', handleValueInputChange);
    
    sliderWrapper.appendChild(sliderElement);
    sliderWrapper.appendChild(valueInputElement);
    
    const increaseBtn = document.createElement('button');
    increaseBtn.className = 'slider-step-btn';
    increaseBtn.textContent = '▶';
    increaseBtn.addEventListener('click', () => adjustValue(1, 'size'));
    
    sliderContainer.appendChild(decreaseBtn);
    sliderContainer.appendChild(sliderWrapper);
    sliderContainer.appendChild(increaseBtn);
    
    panel.appendChild(sliderContainer);

    // 不透明度ラベル
    const opacityLabel = document.createElement('div');
    opacityLabel.className = 'popup-label';
    opacityLabel.textContent = '不透明度';
    panel.appendChild(opacityLabel);

    // 不透明度スライダーコンテナ
    const opacityContainer = document.createElement('div');
    opacityContainer.className = 'opacity-slider-container';
    
    const opacityDecreaseBtn = document.createElement('button');
    opacityDecreaseBtn.className = 'slider-step-btn';
    opacityDecreaseBtn.textContent = '◀';
    opacityDecreaseBtn.addEventListener('click', () => adjustValue(-1, 'opacity'));
    
    const opacitySliderWrapper = document.createElement('div');
    opacitySliderWrapper.className = 'slider-wrapper';
    
    opacitySliderElement = document.createElement('input');
    opacitySliderElement.type = 'range';
    opacitySliderElement.className = 'opacity-slider';
    opacitySliderElement.min = 0;
    opacitySliderElement.max = 100;
    opacitySliderElement.step = 1;
    opacitySliderElement.addEventListener('input', handleOpacitySliderInput);
    
    opacityValueElement = document.createElement('input');
    opacityValueElement.type = 'number';
    opacityValueElement.className = 'opacity-value-input';
    opacityValueElement.min = 0;
    opacityValueElement.max = 100;
    opacityValueElement.step = 1;
    opacityValueElement.addEventListener('focus', () => { isInputFocused = true; });
    opacityValueElement.addEventListener('blur', () => { isInputFocused = false; });
    opacityValueElement.addEventListener('change', handleOpacityValueChange);
    
    opacitySliderWrapper.appendChild(opacitySliderElement);
    opacitySliderWrapper.appendChild(opacityValueElement);
    
    const opacityIncreaseBtn = document.createElement('button');
    opacityIncreaseBtn.className = 'slider-step-btn';
    opacityIncreaseBtn.textContent = '▶';
    opacityIncreaseBtn.addEventListener('click', () => adjustValue(1, 'opacity'));
    
    opacityContainer.appendChild(opacityDecreaseBtn);
    opacityContainer.appendChild(opacitySliderWrapper);
    opacityContainer.appendChild(opacityIncreaseBtn);
    
    panel.appendChild(opacityContainer);

    return panel;
  }

  function handleSlotClick(slotIndex) {
    if (!currentTool) return;
    
    const config = window.TEGAKI_CONFIG;
    const slots = config.toolSizePopup.slots[currentTool] || config.toolSizePopup.slots.pen;
    const size = slots[slotIndex];
    
    activeSlotIndex = slotIndex;
    
    applySize(size);
  }

  function handleSliderInput(e) {
    const value = parseFloat(e.target.value);
    updateValueDisplay(value);
    applySize(value);
    
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

  function handleOpacitySliderInput(e) {
    const percent = parseInt(e.target.value, 10);
    const opacity = percent / 100;
    updateOpacityDisplay(percent);
    applyOpacity(opacity);
  }

  function handleOpacityValueChange(e) {
    if (!currentTool) return;
    
    let percent = parseInt(e.target.value, 10);
    percent = Math.max(0, Math.min(100, percent));
    
    const opacity = percent / 100;
    applyOpacity(opacity);
  }

  function adjustValue(direction, type) {
    if (!currentTool) return;
    
    if (type === 'size') {
      const config = window.TEGAKI_CONFIG;
      let currentValue = parseFloat(sliderElement.value);
      const step = getStepForValue(currentValue);
      
      let newValue = currentValue + (direction * step);
      newValue = Math.max(config.toolSizePopup.sliderMin, Math.min(config.toolSizePopup.sliderMax, newValue));
      newValue = roundToStep(newValue);
      
      activeSlotIndex = null;
      applySize(newValue);
    } else if (type === 'opacity') {
      let currentPercent = parseInt(opacitySliderElement.value, 10);
      let step = 1;
      
      if (currentPercent >= 90) step = 1;
      else if (currentPercent >= 50) step = 5;
      else if (currentPercent >= 10) step = 10;
      
      let newPercent = currentPercent + (direction * step);
      newPercent = Math.max(0, Math.min(100, newPercent));
      
      const opacity = newPercent / 100;
      applyOpacity(opacity);
    }
  }

  function applySize(size) {
    if (!currentTool) return;
    
    const brushSettings = getBrushSettings();
    if (!brushSettings) {
      console.error('[ToolSizePopup] BrushSettings not found');
      return;
    }
    
    // BrushSettings 直接変更（内部状態更新）
    brushSettings.setBrushSize(size);
    
    // UI更新
    updateUI(size);
    
    // EventBus通知（DrawingEngineが購読している 'tool:size-opacity-changed' イベント）
    if (window.TegakiEventBus) {
      window.TegakiEventBus.emit('tool:size-opacity-changed', {
        tool: currentTool,
        size: size,
        opacity: brushSettings.getBrushOpacity()
      });
    }
  }

  function applyOpacity(opacity) {
    if (!currentTool) return;
    
    const brushSettings = getBrushSettings();
    if (!brushSettings) {
      console.error('[ToolSizePopup] BrushSettings not found');
      return;
    }
    
    // BrushSettings 直接変更（内部状態更新）
    brushSettings.setBrushOpacity(opacity);
    
    // UI更新
    updateOpacityUI(opacity);
    
    // EventBus通知（DrawingEngineが購読している 'tool:size-opacity-changed' イベント）
    if (window.TegakiEventBus) {
      window.TegakiEventBus.emit('tool:size-opacity-changed', {
        tool: currentTool,
        size: brushSettings.getBrushSize(),
        opacity: opacity
      });
    }
  }

  function updateUI(size) {
    updateSlider(size);
    updateValueDisplay(size);
    updateActiveSlot();
  }

  function updateOpacityUI(opacity) {
    const percent = Math.round(opacity * 100);
    if (opacitySliderElement) {
      opacitySliderElement.value = percent;
    }
    if (opacityValueElement) {
      opacityValueElement.value = percent;
    }
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

  function updateOpacityDisplay(percent) {
    if (opacityValueElement) {
      opacityValueElement.value = percent;
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
    const slots = config.toolSizePopup.slots[currentTool] || config.toolSizePopup.slots.pen;
    
    const matchIndex = slots.findIndex(size => Math.abs(size - currentSize) < 0.01);
    
    if (matchIndex !== -1) {
      activeSlotIndex = matchIndex;
    } else {
      activeSlotIndex = null;
    }
  }

  function handleOutsideClick(e) {
    if (!popup) return;
    if (isInputFocused) return;
    if (!popup.contains(e.target)) {
      hide();
    }
  }

  function show(tool) {
    // currentTool を先に設定（createPopupDOM で使用）
    currentTool = tool;
    
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
    const currentOpacity = brushSettings.getBrushOpacity();
    
    detectActiveSlot(currentSize);
    
    updateUI(currentSize);
    updateOpacityUI(currentOpacity);
    
    popup.style.display = 'block';
    
    setTimeout(() => {
      document.addEventListener('click', handleOutsideClick);
    }, 100);
    
    if (window.TegakiEventBus) {
      window.TegakiEventBus.emit('popup:opened', { type: 'toolSize' });
    }
  }

  function hide() {
    if (popup) {
      popup.style.display = 'none';
      currentTool = null;
      activeSlotIndex = null;
      isInputFocused = false;
    }
    
    document.removeEventListener('click', handleOutsideClick);
    
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
      hasOpacitySlider: !!opacitySliderElement,
      hasOpacityValue: !!opacityValueElement,
      isInputFocused,
      brushSettings: {
        available: !!brushSettings,
        currentSize: brushSettings ? brushSettings.getBrushSize() : null,
        currentOpacity: brushSettings ? brushSettings.getBrushOpacity() : null
      },
      config: window.TEGAKI_CONFIG?.toolSizePopup
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