// ============================================
// system/tool-size-manager.js
// ツールサイズスロット管理システム
// ============================================

window.ToolSizeManager = (function() {
    'use strict';

    class ToolSizeManager {
        constructor() {
            this.eventBus = null;
            this.config = window.TEGAKI_CONFIG.toolSize;
            
            // ペン/消しゴムそれぞれのスロット
            this.penSlots = this._initializeSlots(this.config.penSlots);
            this.eraserSlots = this._initializeSlots(this.config.eraserSlots);
            
            // アクティブスロットインデックス
            this.activePenSlot = 3; // デフォルトは4番目（29px）
            this.activeEraserSlot = 0;
            
            // EventBusの遅延初期化
            setTimeout(() => this._setupEventListeners(), 100);
        }

        _initializeSlots(slotsConfig) {
            return slotsConfig.map(([size, opacity]) => ({
                size: size,
                opacity: opacity
            }));
        }

        _setupEventListeners() {
            this.eventBus = window.EventBus || window.TegakiEventBus;
            if (!this.eventBus || !this.eventBus.on) {
                return;
            }

            // ツール切り替え時に対応するスロット値をStateManagerに反映
            this.eventBus.on('tool:change', ({ tool }) => {
                this._restoreToolSlotValues(tool);
            });
        }

        _restoreToolSlotValues(tool) {
            if (!window.StateManager) return;

            const slots = tool === 'pen' ? this.penSlots : this.eraserSlots;
            const activeIndex = tool === 'pen' ? this.activePenSlot : this.activeEraserSlot;
            const slot = slots[activeIndex];

            if (tool === 'pen') {
                window.StateManager.setPenSize(slot.size);
                window.StateManager.setPenOpacity(slot.opacity);
            } else {
                window.StateManager.setEraserSize(slot.size);
                window.StateManager.setEraserOpacity(slot.opacity);
            }
        }

        getCurrentSlots() {
            if (!window.StateManager) return this.penSlots;
            const tool = window.StateManager.getCurrentTool();
            return tool === 'pen' ? this.penSlots : this.eraserSlots;
        }

        getActiveSlotIndex() {
            if (!window.StateManager) return this.activePenSlot;
            const tool = window.StateManager.getCurrentTool();
            return tool === 'pen' ? this.activePenSlot : this.activeEraserSlot;
        }

        setActiveSlot(index) {
            if (!window.StateManager) return;

            const tool = window.StateManager.getCurrentTool();
            const slots = this.getCurrentSlots();
            
            if (index < 0 || index >= slots.length) {
                return;
            }

            if (tool === 'pen') {
                this.activePenSlot = index;
            } else {
                this.activeEraserSlot = index;
            }

            const slot = slots[index];
            
            if (tool === 'pen') {
                window.StateManager.setPenSize(slot.size);
                window.StateManager.setPenOpacity(slot.opacity);
            } else {
                window.StateManager.setEraserSize(slot.size);
                window.StateManager.setEraserOpacity(slot.opacity);
            }

            this._emitEvent('slotChanged', { tool, index });
        }

        updateActiveSlotValue(size, opacity) {
            if (!window.StateManager) return;

            const tool = window.StateManager.getCurrentTool();
            const slots = this.getCurrentSlots();
            const activeIndex = this.getActiveSlotIndex();
            
            slots[activeIndex].size = size;
            slots[activeIndex].opacity = opacity;

            this._emitEvent('slotValueChanged', { tool, index: activeIndex, size, opacity });
        }

        getSlotValue(index) {
            const slots = this.getCurrentSlots();
            return slots[index] || null;
        }

        _emitEvent(eventName, data) {
            if (!this.eventBus) {
                this.eventBus = window.EventBus || window.TegakiEventBus;
            }
            if (this.eventBus && this.eventBus.emit) {
                this.eventBus.emit(eventName, data);
            }
        }
    }

    return new ToolSizeManager();
})();

console.log('✅ system/tool-size-manager.js loaded');