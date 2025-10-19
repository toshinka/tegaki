/**
 * ToolSizeManager - ツールサイズ/不透明度/アクティブスロット管理
 * 責務: ペン/消しゴムの状態管理、EventBus連携、設定参照統合
 */

class ToolSizeManager {
  constructor(eventBus, config) {
    this.eventBus = eventBus || window.TegakiEventBus || window.EventBus;
    this.config = config || window.TEGAKI_CONFIG;
    
    // ツールごとの状態
    this.state = {
      pen: {
        size: this.config.tools?.pen?.defaultSize || this.config.pen?.size || 10,
        opacity: this.config.tools?.pen?.defaultOpacity || this.config.pen?.opacity || 0.85,
        activeSlot: null
      },
      eraser: {
        size: this.config.tools?.eraser?.defaultSize || this.config.eraser?.size || 20,
        opacity: this.config.tools?.eraser?.defaultOpacity || this.config.eraser?.opacity || 1.0,
        activeSlot: null
      }
    };
    
    this._subscribeToEvents();
  }
  
  _subscribeToEvents() {
    if (!this.eventBus) return;
    
    // ポップアップからの変更を反映
    this.eventBus.on('toolSize:slot-selected', ({ tool, size, slotIndex }) => {
      if (tool && this.state[tool]) {
        this.state[tool].size = size;
        this.state[tool].activeSlot = slotIndex;
        
        // DrawingEngine へ通知
        this.eventBus.emit('tool:size-opacity-changed', {
          tool,
          size: this.state[tool].size,
          opacity: this.state[tool].opacity
        });
      }
    });
    
    this.eventBus.on('toolSize:slider-changed', ({ tool, size }) => {
      if (tool && this.state[tool]) {
        this.state[tool].size = size;
        this.state[tool].activeSlot = null; // スライダー操作でスロットアクティブ解除
        
        this.eventBus.emit('tool:size-opacity-changed', {
          tool,
          size: this.state[tool].size,
          opacity: this.state[tool].opacity
        });
      }
    });
  }
  
  // ===== Getters =====
  
  getSize(tool) {
    return this.state[tool]?.size || 10;
  }
  
  getOpacity(tool) {
    return this.state[tool]?.opacity || 1.0;
  }
  
  getActiveSlot(tool) {
    return this.state[tool]?.activeSlot;
  }
  
  getState(tool) {
    return this.state[tool] || null;
  }
  
  // ===== Setters =====
  
  setSize(tool, size) {
    if (!this.state[tool]) return;
    
    const clamped = Math.max(0.1, Math.min(500, size));
    this.state[tool].size = clamped;
    
    if (this.eventBus) {
      this.eventBus.emit('tool:size-opacity-changed', {
        tool,
        size: clamped,
        opacity: this.state[tool].opacity
      });
    }
  }
  
  setOpacity(tool, opacity) {
    if (!this.state[tool]) return;
    
    const clamped = Math.max(0.0, Math.min(1.0, opacity));
    this.state[tool].opacity = clamped;
    
    if (this.eventBus) {
      this.eventBus.emit('tool:size-opacity-changed', {
        tool,
        size: this.state[tool].size,
        opacity: clamped
      });
    }
  }
  
  setActiveSlot(tool, slotIndex) {
    if (!this.state[tool]) return;
    this.state[tool].activeSlot = slotIndex;
  }
  
  clearActiveSlot(tool) {
    if (!this.state[tool]) return;
    this.state[tool].activeSlot = null;
  }
  
  // ===== スロット操作 =====
  
  getSlotValue(tool, slotIndex) {
    const slots = this.config.toolSizePopup?.slots || [1, 3, 5, 10, 30, 100];
    return slots[slotIndex] || 10;
  }
  
  getSlotCount() {
    const slots = this.config.toolSizePopup?.slots || [1, 3, 5, 10, 30, 100];
    return slots.length;
  }
  
  applySizeFromSlot(tool, slotIndex) {
    if (!this.state[tool]) return;
    
    const size = this.getSlotValue(tool, slotIndex);
    this.state[tool].size = size;
    this.state[tool].activeSlot = slotIndex;
    
    if (this.eventBus) {
      this.eventBus.emit('tool:size-opacity-changed', {
        tool,
        size,
        opacity: this.state[tool].opacity
      });
    }
  }
  
  // ===== デバッグ =====
  
  getDebugInfo() {
    return {
      state: this.state,
      config: {
        slots: this.config.toolSizePopup?.slots,
        sliderMin: this.config.toolSizePopup?.sliderMin,
        sliderMax: this.config.toolSizePopup?.sliderMax
      },
      eventBus: !!this.eventBus
    };
  }
}

// グローバル登録
window.ToolSizeManager = ToolSizeManager;

console.log('✅ system/tool-size-manager.js loaded');