// ============================================
// ui/tool-size-popup.js - Tool Size Slot UI
// サイドバーのペン/消しゴムアイコンクリック専用
// ============================================

window.ToolSizePopup = (function() {
    'use strict';

    class ToolSizePopup {
        constructor() {
            this.popup = null;
            this.slotButtons = [];
            this.sizeValueDisplay = null;
            this.opacityValueDisplay = null;
            this.sizeSlider = null;
            this.opacitySlider = null;
            this.isOpen = false;
            this.initialized = false;
            this.eventBus = null;
        }

        initialize() {
            if (this.initialized) return;
            
            // DOMBuilderの互換性確保
            if (!window.DOMBuilder || !window.DOMBuilder.create) {
                if (window.DOMBuilder && window.DOMBuilder.createElement) {
                    window.DOMBuilder.create = window.DOMBuilder.createElement;
                } else {
                    console.error('DOMBuilder not available');
                    return;
                }
            }
            
            this._createPopup();
            this._setupEventListeners();
            this._updateFromState();
            this.initialized = true;
        }

        _createPopup() {
            const popup = window.DOMBuilder.create('div', {
                classes: ['tool-size-popup'],
                styles: {
                    position: 'fixed',
                    left: '50%',
                    top: '20%',
                    transform: 'translateX(-50%)',
                    background: 'rgba(250, 245, 235, 0.98)',
                    borderRadius: '16px',
                    padding: '20px 24px',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
                    display: 'none',
                    zIndex: '10000',
                    minWidth: '580px',
                    fontFamily: 'system-ui, -apple-system, sans-serif'
                }
            });

            const slotsContainer = this._createSlotButtons();
            popup.appendChild(slotsContainer);

            const sizeSection = this._createSizeSection();
            popup.appendChild(sizeSection);

            const opacitySection = this._createOpacitySection();
            popup.appendChild(opacitySection);

            document.body.appendChild(popup);
            this.popup = popup;
        }

        _createSlotButtons() {
            const container = window.DOMBuilder.create('div', {
                styles: {
                    display: 'flex',
                    gap: '12px',
                    marginBottom: '20px',
                    justifyContent: 'center'
                }
            });

            const config = window.TEGAKI_CONFIG.toolSize;
            
            for (let i = 0; i < config.slots; i++) {
                const slotBtn = this._createSlotButton(i);
                container.appendChild(slotBtn);
                this.slotButtons.push(slotBtn);
            }

            return container;
        }

        _createSlotButton(index) {
            const btn = window.DOMBuilder.create('div', {
                styles: {
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '12px 8px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    minWidth: '70px',
                    background: 'transparent'
                }
            });

            const thumbnailContainer = window.DOMBuilder.create('div', {
                styles: {
                    width: '40px',
                    height: '40px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '50%',
                    border: '1px solid rgba(0, 0, 0, 0.1)'
                }
            });

            const thumbnail = window.DOMBuilder.create('div', {
                styles: {
                    borderRadius: '50%',
                    background: '#8B4513',
                    width: '10px',
                    height: '10px'
                }
            });

            thumbnailContainer.appendChild(thumbnail);
            btn.appendChild(thumbnailContainer);

            const sizeLabel = window.DOMBuilder.create('div', {
                text: '0px',
                styles: {
                    fontSize: '13px',
                    fontWeight: '600',
                    color: '#333'
                }
            });
            btn.appendChild(sizeLabel);

            const opacityLabel = window.DOMBuilder.create('div', {
                text: '100%',
                styles: {
                    fontSize: '11px',
                    color: '#666'
                }
            });
            btn.appendChild(opacityLabel);

            btn.thumbnailCircle = thumbnail;
            btn.sizeLabel = sizeLabel;
            btn.opacityLabel = opacityLabel;
            btn.slotIndex = index;

            btn.addEventListener('click', () => this._handleSlotClick(index));
            btn.addEventListener('mouseenter', () => {
                if (!btn.classList.contains('active')) {
                    btn.style.background = 'rgba(139, 69, 19, 0.05)';
                }
            });
            btn.addEventListener('mouseleave', () => {
                if (!btn.classList.contains('active')) {
                    btn.style.background = 'transparent';
                }
            });

            return btn;
        }

        _createSizeSection() {
            const section = window.DOMBuilder.create('div', {
                styles: {
                    marginBottom: '16px'
                }
            });

            const header = window.DOMBuilder.create('div', {
                styles: {
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    marginBottom: '12px'
                }
            });

            const label = window.DOMBuilder.create('div', {
                text: 'サイズ',
                styles: {
                    fontSize: '18px',
                    fontWeight: '700',
                    color: '#333',
                    minWidth: '80px'
                }
            });

            const valueBox = window.DOMBuilder.create('div', {
                text: '0.0px',
                styles: {
                    fontSize: '16px',
                    color: '#8B4513',
                    fontWeight: '600',
                    padding: '6px 16px',
                    border: '2px solid rgba(139, 69, 19, 0.2)',
                    borderRadius: '8px',
                    background: 'white',
                    cursor: 'pointer',
                    minWidth: '80px',
                    textAlign: 'center'
                }
            });

            valueBox.addEventListener('click', () => this._enableDirectInput(valueBox, 'size'));
            this.sizeValueDisplay = valueBox;

            header.appendChild(label);
            header.appendChild(valueBox);
            section.appendChild(header);

            const sliderRow = this._createSliderRow('size');
            section.appendChild(sliderRow);
            this.sizeSlider = sliderRow.querySelector('input[type="range"]');

            return section;
        }

        _createOpacitySection() {
            const section = window.DOMBuilder.create('div');

            const header = window.DOMBuilder.create('div', {
                styles: {
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    marginBottom: '12px'
                }
            });

            const label = window.DOMBuilder.create('div', {
                text: '不透明度',
                styles: {
                    fontSize: '18px',
                    fontWeight: '700',
                    color: '#333',
                    minWidth: '80px'
                }
            });

            const valueBox = window.DOMBuilder.create('div', {
                text: '100%',
                styles: {
                    fontSize: '16px',
                    color: '#8B4513',
                    fontWeight: '600',
                    padding: '6px 16px',
                    border: '2px solid rgba(139, 69, 19, 0.2)',
                    borderRadius: '8px',
                    background: 'white',
                    cursor: 'pointer',
                    minWidth: '80px',
                    textAlign: 'center'
                }
            });

            valueBox.addEventListener('click', () => this._enableDirectInput(valueBox, 'opacity'));
            this.opacityValueDisplay = valueBox;

            header.appendChild(label);
            header.appendChild(valueBox);
            section.appendChild(header);

            const sliderRow = this._createSliderRow('opacity');
            section.appendChild(sliderRow);
            this.opacitySlider = sliderRow.querySelector('input[type="range"]');

            return section;
        }

        _createSliderRow(type) {
            const row = window.DOMBuilder.create('div', {
                styles: {
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                }
            });

            const config = window.TEGAKI_CONFIG.toolSize;
            const isSizeSlider = type === 'size';
            const sliderConfig = isSizeSlider ? {
                min: config.penMin,
                max: config.penMax,
                step: 0.1,
                buttons: [
                    { text: '-10', delta: -10 },
                    { text: '-1', delta: -1 },
                    { text: '-0.1', delta: -0.1 },
                    { text: '+0.1', delta: 0.1 },
                    { text: '+1', delta: 1 },
                    { text: '+10', delta: 10 }
                ]
            } : {
                min: 0,
                max: 1,
                step: 0.01,
                buttons: [
                    { text: '-10', delta: -0.1 },
                    { text: '-1', delta: -0.01 },
                    { text: '-0.1', delta: -0.001 },
                    { text: '+0.1', delta: 0.001 },
                    { text: '+1', delta: 0.01 },
                    { text: '+10', delta: 0.1 }
                ]
            };

            sliderConfig.buttons.slice(0, 3).forEach(btnConfig => {
                const btn = this._createAdjustButton(btnConfig.text, btnConfig.delta, type);
                row.appendChild(btn);
            });

            const slider = window.DOMBuilder.create('input', {
                attributes: {
                    type: 'range',
                    min: sliderConfig.min,
                    max: sliderConfig.max,
                    step: sliderConfig.step
                },
                styles: {
                    flex: '1',
                    height: '32px',
                    cursor: 'pointer',
                    accentColor: '#8B4513'
                }
            });

            slider.addEventListener('input', () => this._handleSliderChange(type));
            row.appendChild(slider);

            sliderConfig.buttons.slice(3).forEach(btnConfig => {
                const btn = this._createAdjustButton(btnConfig.text, btnConfig.delta, type);
                row.appendChild(btn);
            });

            return row;
        }

        _createAdjustButton(text, delta, type) {
            const btn = window.DOMBuilder.create('button', {
                text,
                styles: {
                    padding: '6px 10px',
                    fontSize: '12px',
                    border: '1px solid rgba(139, 69, 19, 0.3)',
                    borderRadius: '6px',
                    background: 'white',
                    cursor: 'pointer',
                    minWidth: '48px',
                    fontWeight: '500',
                    color: '#333'
                }
            });

            btn.addEventListener('click', () => this._adjustValue(type, delta));
            btn.addEventListener('mouseenter', () => {
                btn.style.background = 'rgba(139, 69, 19, 0.1)';
            });
            btn.addEventListener('mouseleave', () => {
                btn.style.background = 'white';
            });

            return btn;
        }

        _handleSlotClick(index) {
            if (!window.ToolSizeManager) return;
            window.ToolSizeManager.setActiveSlot(index);
            this._updateSlotHighlight();
            this._updateFromState();
        }

        _handleSliderChange(type) {
            if (!window.StateManager) return;
            
            const tool = window.StateManager.getCurrentTool();
            
            if (type === 'size') {
                const size = parseFloat(this.sizeSlider.value);
                if (tool === 'pen') {
                    window.StateManager.setPenSize(size);
                } else {
                    window.StateManager.setEraserSize(size);
                }
            } else {
                const opacity = parseFloat(this.opacitySlider.value);
                if (tool === 'pen') {
                    window.StateManager.setPenOpacity(opacity);
                } else {
                    window.StateManager.setEraserOpacity(opacity);
                }
            }

            this._updateActiveSlotFromState();
            this._updateFromState();
        }

        _adjustValue(type, delta) {
            if (!window.StateManager) return;
            
            const tool = window.StateManager.getCurrentTool();
            const config = window.TEGAKI_CONFIG.toolSize;
            
            if (type === 'size') {
                const current = tool === 'pen' ? window.StateManager.getPenSize() : window.StateManager.getEraserSize();
                const newValue = Math.max(config.penMin, Math.min(config.penMax, current + delta));
                
                if (tool === 'pen') {
                    window.StateManager.setPenSize(newValue);
                } else {
                    window.StateManager.setEraserSize(newValue);
                }
            } else {
                const current = tool === 'pen' ? window.StateManager.getPenOpacity() : window.StateManager.getEraserOpacity();
                const newValue = Math.max(0, Math.min(1, current + delta));
                
                if (tool === 'pen') {
                    window.StateManager.setPenOpacity(newValue);
                } else {
                    window.StateManager.setEraserOpacity(newValue);
                }
            }

            this._updateActiveSlotFromState();
            this._updateFromState();
        }

        _enableDirectInput(element, type) {
            const currentText = element.textContent;
            const currentValue = type === 'size' 
                ? parseFloat(currentText)
                : parseFloat(currentText) / 100;

            const input = window.DOMBuilder.create('input', {
                attributes: {
                    type: 'text',
                    value: type === 'size' ? currentValue.toFixed(1) : (currentValue * 100).toFixed(0)
                },
                styles: {
                    width: '100%',
                    fontSize: '16px',
                    color: '#8B4513',
                    fontWeight: '600',
                    padding: '6px 16px',
                    border: '2px solid #8B4513',
                    borderRadius: '8px',
                    textAlign: 'center',
                    outline: 'none'
                }
            });

            const finalize = () => {
                if (!window.StateManager) {
                    element.style.display = 'block';
                    input.remove();
                    return;
                }

                const newValue = parseFloat(input.value);
                if (!isNaN(newValue)) {
                    const tool = window.StateManager.getCurrentTool();
                    const config = window.TEGAKI_CONFIG.toolSize;
                    
                    if (type === 'size') {
                        const clamped = Math.max(config.penMin, Math.min(config.penMax, newValue));
                        if (tool === 'pen') {
                            window.StateManager.setPenSize(clamped);
                        } else {
                            window.StateManager.setEraserSize(clamped);
                        }
                    } else {
                        const clamped = Math.max(0, Math.min(100, newValue)) / 100;
                        if (tool === 'pen') {
                            window.StateManager.setPenOpacity(clamped);
                        } else {
                            window.StateManager.setEraserOpacity(clamped);
                        }
                    }

                    this._updateActiveSlotFromState();
                }
                
                element.style.display = 'block';
                input.remove();
                this._updateFromState();
            };

            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    finalize();
                } else if (e.key === 'Escape') {
                    element.style.display = 'block';
                    input.remove();
                }
            });

            input.addEventListener('blur', finalize);

            element.style.display = 'none';
            element.parentNode.insertBefore(input, element);
            input.focus();
            input.select();
        }

        _updateActiveSlotFromState() {
            if (!window.StateManager || !window.ToolSizeManager) return;
            
            const tool = window.StateManager.getCurrentTool();
            const size = tool === 'pen' ? window.StateManager.getPenSize() : window.StateManager.getEraserSize();
            const opacity = tool === 'pen' ? window.StateManager.getPenOpacity() : window.StateManager.getEraserOpacity();
            
            window.ToolSizeManager.updateActiveSlotValue(size, opacity);
        }

        _setupEventListeners() {
            this.eventBus = window.EventBus || window.TegakiEventBus;
            if (!this.eventBus || !this.eventBus.on) {
                return;
            }

            this.eventBus.on('tool:change', () => {
                if (this.isOpen) {
                    this._updateFromState();
                    this._updateSlotHighlight();
                }
            });

            this.eventBus.on('slotChanged', () => {
                if (this.isOpen) {
                    this._updateSlotHighlight();
                }
            });

            this.eventBus.on('slotValueChanged', () => {
                if (this.isOpen) {
                    this._updateSlotDisplay();
                }
            });

            // 画面外クリックで閉じる
            document.addEventListener('click', (e) => {
                if (this.isOpen && this.popup && !this.popup.contains(e.target) && !e.target.closest('.tool-button')) {
                    this.close();
                }
            });
        }

        _updateFromState() {
            if (!window.StateManager || !this.sizeValueDisplay || !this.opacityValueDisplay) return;
            
            const tool = window.StateManager.getCurrentTool();
            const size = tool === 'pen' ? window.StateManager.getPenSize() : window.StateManager.getEraserSize();
            const opacity = tool === 'pen' ? window.StateManager.getPenOpacity() : window.StateManager.getEraserOpacity();

            this.sizeValueDisplay.textContent = `${size.toFixed(1)}px`;
            this.opacityValueDisplay.textContent = `${Math.round(opacity * 100)}%`;

            if (this.sizeSlider) this.sizeSlider.value = size;
            if (this.opacitySlider) this.opacitySlider.value = opacity;

            this._updateSlotDisplay();
        }

        _updateSlotDisplay() {
            if (!window.ToolSizeManager || !window.TEGAKI_CONFIG) return;
            
            const slots = window.ToolSizeManager.getCurrentSlots();
            const config = window.TEGAKI_CONFIG.toolSize;

            slots.forEach((slot, index) => {
                const btn = this.slotButtons[index];
                if (!btn) return;

                const normalizedSize = Math.max(0, Math.min(1, (slot.size - config.penMin) / (config.penMax - config.penMin)));
                const thumbnailSize = Math.max(1, config.thumbnailMin + normalizedSize * (config.thumbnailMax - config.thumbnailMin));

                if (btn.thumbnailCircle) {
                    btn.thumbnailCircle.style.width = `${thumbnailSize}px`;
                    btn.thumbnailCircle.style.height = `${thumbnailSize}px`;
                    btn.thumbnailCircle.style.opacity = slot.opacity;
                }

                if (btn.sizeLabel) {
                    btn.sizeLabel.textContent = `${slot.size.toFixed(1)}px`;
                }
                if (btn.opacityLabel) {
                    btn.opacityLabel.textContent = `${Math.round(slot.opacity * 100)}%`;
                }
            });
        }

        _updateSlotHighlight() {
            if (!window.ToolSizeManager) return;
            
            const activeIndex = window.ToolSizeManager.getActiveSlotIndex();

            this.slotButtons.forEach((btn, index) => {
                if (index === activeIndex) {
                    btn.classList.add('active');
                    btn.style.background = 'rgba(139, 69, 19, 0.15)';
                    if (btn.sizeLabel) {
                        btn.sizeLabel.style.color = '#8B4513';
                        btn.sizeLabel.style.fontWeight = '700';
                    }
                } else {
                    btn.classList.remove('active');
                    btn.style.background = 'transparent';
                    if (btn.sizeLabel) {
                        btn.sizeLabel.style.color = '#333';
                        btn.sizeLabel.style.fontWeight = '600';
                    }
                }
            });
        }

        toggle() {
            if (!this.initialized) {
                this.initialize();
            }
            this.isOpen ? this.close() : this.open();
        }

        open() {
            if (!this.initialized) {
                this.initialize();
            }
            if (!this.popup) return;
            
            this.popup.style.display = 'block';
            this.isOpen = true;
            this._updateFromState();
            this._updateSlotHighlight();
        }

        close() {
            if (!this.popup) return;
            
            this.popup.style.display = 'none';
            this.isOpen = false;
        }

        // 外部から初期化状態を確認できるメソッド
        show() {
            this.open();
        }

        hide() {
            this.close();
        }

        get isVisible() {
            return this.isOpen;
        }
    }

    return new ToolSizePopup();
})();

console.log('✅ ui/tool-size-popup.js loaded');