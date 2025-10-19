// ===== tool-size-popup.js - Tool Size Popup UI =====
// 責務: ペン/消しゴムのサイズ変更ポップアップUI
// - 6つのスロット管理（スロット値、アクティブ状態をツール別に独立）
// - スライダー + ◀▶ボタン
// - EventBus連携でツールマネージャーへ値反映

window.TegakiUI = window.TegakiUI || {};

window.TegakiUI.ToolSizePopup = class {
    constructor(toolSizeManager) {
        this.toolSizeManager = toolSizeManager;
        this.eventBus = window.TegakiEventBus;
        
        this.popup = null;
        this.isVisible = false;
        this.initialized = false;
        
        // スロット設定（config から取得）
        this.slots = window.TEGAKI_CONFIG?.toolSizePopup?.slots || [1, 3, 5, 10, 30, 100];
        this.sliderMin = window.TEGAKI_CONFIG?.toolSizePopup?.sliderMin || 0.1;
        this.sliderMax = window.TEGAKI_CONFIG?.toolSizePopup?.sliderMax || 500;
        this.dotMinSize = window.TEGAKI_CONFIG?.toolSizePopup?.dotMinSize || 4;
        this.dotMaxSize = window.TEGAKI_CONFIG?.toolSizePopup?.dotMaxSize || 20;
        
        // テーパリング用ステップ定義
        this.taperSteps = [
            { range: [0.1, 3], step: 0.1 },
            { range: [3, 10], step: 0.5 },
            { range: [10, 30], step: 1 },
            { range: [30, 200], step: 10 },
            { range: [200, 500], step: 50 }
        ];
        
        // ツール別アクティブスロット状態
        this.activeSlotIndex = {
            pen: 0,
            eraser: 0
        };
        
        this.currentTool = null;
        
        this._ensurePopupElement();
    }
    
    _ensurePopupElement() {
        this.popup = document.getElementById('tool-size-popup');
        
        if (!this.popup) {
            this._createPopupElement();
        }
        
        if (this.popup) {
            this.popup.style.top = '120px';
            this.popup.style.left = '70px';
        }
    }
    
    _createPopupElement() {
        const container = document.querySelector('.canvas-area');
        if (!container) return;
        
        const popupDiv = document.createElement('div');
        popupDiv.id = 'tool-size-popup';
        popupDiv.className = 'popup-panel tool-size-popup-panel';
        popupDiv.style.top = '120px';
        popupDiv.style.left = '70px';
        popupDiv.style.display = 'none';
        
        container.appendChild(popupDiv);
        this.popup = popupDiv;
    }
    
    _renderContent() {
        if (!this.popup) return;
        
        const currentSize = this.currentTool 
            ? this.toolSizeManager.getToolState(this.currentTool)?.size || this.slots[0]
            : this.slots[0];
        
        // スロット HTML を生成
        const slotsHTML = this.slots.map((slotValue, idx) => {
            const dotSize = this._calculateDotSize(slotValue);
            const isActive = this.activeSlotIndex[this.currentTool] === idx;
            
            return `
                <div class="slot-item ${isActive ? 'active' : ''}" data-slot-index="${idx}" data-slot-value="${slotValue}">
                    <div class="slot-dot" style="width: ${dotSize}px; height: ${dotSize}px;"></div>
                    <div class="slot-number">${slotValue}</div>
                </div>
            `;
        }).join('');
        
        this.popup.innerHTML = `
            <div class="popup-title" style="font-size: 14px; font-weight: 600; color: var(--futaba-maroon); margin-bottom: 12px; text-align: center;">
                サイズ調整
            </div>
            
            <div class="slots-container" style="display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; margin-bottom: 12px;">
                ${slotsHTML}
            </div>
            
            <div class="slider-section" style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                <button class="slider-step-btn slider-decrease" style="width: 28px; height: 28px; padding: 0; font-size: 14px;">◀</button>
                
                <div class="size-slider-container" id="tool-size-slider" style="flex: 1; display: flex; flex-direction: column; gap: 4px;">
                    <div class="slider" style="position: relative; height: 4px; background: var(--futaba-light-medium); border-radius: 2px;">
                        <div class="slider-track" style="position: absolute; height: 100%; background: var(--futaba-maroon); border-radius: 2px; width: 0%;"></div>
                        <div class="slider-handle" style="position: absolute; width: 12px; height: 12px; background: var(--futaba-maroon); border-radius: 50%; top: -4px; cursor: grab; transition: left 0.1s;"></div>
                    </div>
                    <div class="slider-value-display" style="font-size: 11px; text-align: center; color: var(--text-secondary);">
                        ${currentSize.toFixed(1)}
                    </div>
                </div>
                
                <button class="slider-step-btn slider-increase" style="width: 28px; height: 28px; padding: 0; font-size: 14px;">▶</button>
            </div>
            
            <div class="size-input-section" style="display: flex; align-items: center; gap: 6px;">
                <label style="font-size: 10px; color: var(--text-secondary);">直接入力:</label>
                <input type="number" class="size-input" style="width: 50px; height: 24px; padding: 4px 6px; font-size: 11px; border: 1px solid var(--futaba-light-medium); border-radius: 4px; background: var(--futaba-background);" 
                    min="${this.sliderMin}" max="${this.sliderMax}" step="0.1" value="${currentSize.toFixed(1)}">
            </div>
        `;
    }
    
    _calculateDotSize(value) {
        const ratio = Math.min(value / this.sliderMax, 1);
        return Math.max(this.dotMinSize, this.dotMinSize + (ratio * (this.dotMaxSize - this.dotMinSize)));
    }
    
    _getStepForValue(value) {
        for (const { range, step } of this.taperSteps) {
            if (value >= range[0] && value <= range[1]) {
                return step;
            }
        }
        return this.taperSteps[this.taperSteps.length - 1].step;
    }
    
    _nextValue(current, direction) {
        const step = this._getStepForValue(current);
        const newValue = current + (step * direction);
        return Math.max(this.sliderMin, Math.min(this.sliderMax, newValue));
    }
    
    _setSliderValue(value) {
        if (!this.currentTool) return;
        
        value = Math.max(this.sliderMin, Math.min(this.sliderMax, value));
        const percentage = ((value - this.sliderMin) / (this.sliderMax - this.sliderMin)) * 100;
        
        const track = this.popup?.querySelector('.slider-track');
        const handle = this.popup?.querySelector('.slider-handle');
        const display = this.popup?.querySelector('.slider-value-display');
        const input = this.popup?.querySelector('.size-input');
        
        if (track) track.style.width = percentage + '%';
        if (handle) handle.style.left = percentage + '%';
        if (display) display.textContent = value.toFixed(1);
        if (input) input.value = value.toFixed(1);
        
        // ツール状態を更新
        this.toolSizeManager.setToolState(this.currentTool, value, undefined);
        
        // EventBus 発火
        if (this.eventBus) {
            const state = this.toolSizeManager.getToolState(this.currentTool);
            this.eventBus.emit('tool:size-opacity-changed', {
                tool: this.currentTool,
                size: value,
                opacity: state.opacity
            });
        }
    }
    
    _setupEventHandlers() {
        if (!this.popup) return;
        
        // スロットクリック
        const slotItems = this.popup.querySelectorAll('.slot-item');
        slotItems.forEach((item, idx) => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                const slotValue = parseFloat(item.getAttribute('data-slot-value'));
                this.activeSlotIndex[this.currentTool] = idx;
                this._setSliderValue(slotValue);
                this._updateSlotUI();
            });
        });
        
        // スライダードラッグ
        const sliderContainer = this.popup.querySelector('#tool-size-slider');
        if (sliderContainer) {
            const slider = sliderContainer.querySelector('.slider');
            const handle = sliderContainer.querySelector('.slider-handle');
            let dragging = false;
            
            const getValue = (clientX) => {
                const rect = slider.getBoundingClientRect();
                const percentage = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
                return this.sliderMin + (percentage * (this.sliderMax - this.sliderMin));
            };
            
            handle.addEventListener('mousedown', () => {
                dragging = true;
                handle.style.cursor = 'grabbing';
            });
            
            document.addEventListener('mousemove', (e) => {
                if (!dragging || !this.isVisible) return;
                const value = getValue(e.clientX);
                this._setSliderValue(value);
                this._updateSlotUI();
            });
            
            document.addEventListener('mouseup', () => {
                dragging = false;
                if (handle) handle.style.cursor = 'grab';
            });
            
            slider.addEventListener('click', (e) => {
                if (e.target === handle) return;
                const value = getValue(e.clientX);
                this._setSliderValue(value);
                this._updateSlotUI();
            });
        }
        
        // ◀▶ ボタン
        const decreaseBtn = this.popup.querySelector('.slider-decrease');
        const increaseBtn = this.popup.querySelector('.slider-increase');
        
        if (decreaseBtn) {
            decreaseBtn.addEventListener('click', () => {
                const current = this.toolSizeManager.getToolState(this.currentTool)?.size || this.slots[0];
                const newValue = this._nextValue(current, -1);
                this._setSliderValue(newValue);
                this._updateSlotUI();
            });
        }
        
        if (increaseBtn) {
            increaseBtn.addEventListener('click', () => {
                const current = this.toolSizeManager.getToolState(this.currentTool)?.size || this.slots[0];
                const newValue = this._nextValue(current, 1);
                this._setSliderValue(newValue);
                this._updateSlotUI();
            });
        }
        
        // 直接入力
        const input = this.popup.querySelector('.size-input');
        if (input) {
            input.addEventListener('change', (e) => {
                const value = parseFloat(e.target.value);
                if (!isNaN(value)) {
                    this._setSliderValue(value);
                    this._updateSlotUI();
                }
            });
            
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    const value = parseFloat(e.target.value);
                    if (!isNaN(value)) {
                        this._setSliderValue(value);
                        this._updateSlotUI();
                    }
                }
            });
        }
    }
    
    _updateSlotUI() {
        if (!this.popup) return;
        
        const currentValue = this.toolSizeManager.getToolState(this.currentTool)?.size || this.slots[0];
        
        this.popup.querySelectorAll('.slot-item').forEach((item, idx) => {
            const slotValue = parseFloat(item.getAttribute('data-slot-value'));
            const isActive = this.activeSlotIndex[this.currentTool] === idx;
            
            item.classList.toggle('active', isActive);
            
            // ●の再計算
            const dot = item.querySelector('.slot-dot');
            if (dot) {
                const dotSize = this._calculateDotSize(slotValue);
                dot.style.width = dotSize + 'px';
                dot.style.height = dotSize + 'px';
            }
        });
    }
    
    show(tool) {
        if (!this.popup) {
            this._ensurePopupElement();
        }
        
        if (!this.popup) return;
        
        this.currentTool = tool || this.currentTool;
        
        if (!this.initialized) {
            this.initialize();
        }
        
        this._renderContent();
        this._setupEventHandlers();
        
        this.popup.classList.add('show');
        this.popup.style.display = 'block';
        this.isVisible = true;
    }
    
    hide() {
        if (!this.popup) return;
        
        this.popup.classList.remove('show');
        this.popup.style.display = 'none';
        this.isVisible = false;
    }
    
    toggle(tool) {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show(tool);
        }
    }
    
    initialize() {
        if (this.initialized) return;
        
        // EventBus リスナー: ツール変更時にアクティブスロットを初期化
        if (this.eventBus) {
            this.eventBus.on('toolChanged', (data) => {
                this.currentTool = data.tool;
                if (this.isVisible) {
                    this._renderContent();
                    this._setupEventHandlers();
                }
            });
        }
        
        this.initialized = true;
    }
    
    destroy() {
        if (this.popup) {
            this.popup.remove();
            this.popup = null;
        }
        this.initialized = false;
    }
};

// グローバル公開
window.ToolSizePopup = window.TegakiUI.ToolSizePopup;