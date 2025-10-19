// system/tool-size-manager.js
const ToolSizeManager = (() => {
  const state = {
    pen: {
      size: window.CONFIG.tools.pen.defaultSize,
      opacity: window.CONFIG.tools.pen.defaultOpacity,
      activeSlot: null
    },
    eraser: {
      size: window.CONFIG.tools.eraser.defaultSize,
      opacity: window.CONFIG.tools.eraser.defaultOpacity,
      activeSlot: null
    }
  };

  function getSize(tool) {
    return state[tool]?.size ?? window.CONFIG.tools[tool].defaultSize;
  }

  function setSize(tool, size) {
    if (!state[tool]) return;
    state[tool].size = size;
    window.EventBus.emit('tool:size-changed', { tool, size });
  }

  function getOpacity(tool) {
    return state[tool]?.opacity ?? window.CONFIG.tools[tool].defaultOpacity;
  }

  function setOpacity(tool, opacity) {
    if (!state[tool]) return;
    state[tool].opacity = opacity;
    window.EventBus.emit('tool:opacity-changed', { tool, opacity });
  }

  function setSizeAndOpacity(tool, size, opacity) {
    if (!state[tool]) return;
    state[tool].size = size;
    state[tool].opacity = opacity;
    window.EventBus.emit('tool:size-opacity-changed', { tool, size, opacity });
  }

  function getActiveSlot(tool) {
    return state[tool]?.activeSlot ?? null;
  }

  function setActiveSlot(tool, slotIndex) {
    if (!state[tool]) return;
    state[tool].activeSlot = slotIndex;
  }

  function clearActiveSlot(tool) {
    if (!state[tool]) return;
    state[tool].activeSlot = null;
  }

  function applySizeFromSlot(tool, slotIndex) {
    const slots = window.CONFIG.toolSizePopup.slots;
    if (slotIndex < 0 || slotIndex >= slots.length) return;
    
    const size = slots[slotIndex];
    setSize(tool, size);
  }

  function cycleSize(tool, direction) {
    const slots = window.CONFIG.sizeSlots[tool];
    if (!slots || slots.length === 0) return;

    const currentSize = getSize(tool);
    let index = slots.findIndex(s => s >= currentSize);
    
    if (index === -1) {
      index = direction > 0 ? 0 : slots.length - 1;
    } else {
      index += direction;
      if (index < 0) index = slots.length - 1;
      if (index >= slots.length) index = 0;
    }

    const newSize = slots[index];
    setSize(tool, newSize);
    setActiveSlot(tool, index);
  }

  function getState(tool) {
    return state[tool] ? { ...state[tool] } : null;
  }

  function init() {
    window.EventBus.on('tool:switched', (data) => {
      if (data.tool === 'pen' || data.tool === 'eraser') {
        window.EventBus.emit('tool:size-opacity-changed', {
          tool: data.tool,
          size: getSize(data.tool),
          opacity: getOpacity(data.tool)
        });
      }
    });
    
    console.log('[ToolSizeManager] Initialized');
  }

  return {
    init,
    getSize,
    setSize,
    getOpacity,
    setOpacity,
    setSizeAndOpacity,
    getActiveSlot,
    setActiveSlot,
    clearActiveSlot,
    applySizeFromSlot,
    cycleSize,
    getState
  };
})();

window.ToolSizeManager = ToolSizeManager;

if (typeof window.ToolSizeManager.init === 'function') {
  window.ToolSizeManager.init();
}

console.log('✅ tool-size-manager.js loaded');