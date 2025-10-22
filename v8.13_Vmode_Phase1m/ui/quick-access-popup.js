// ===== ui/quick-access-popup.js - スライダー統一改修版 =====
// 責務: ペン設定UIの提供（カラー/サイズ/透明度）
// 改修: settings-popup.jsパターンに統一、.sliderクラス使用

window.TegakiUI = window.TegakiUI || {};

window.TegakiUI.QuickAccessPopup = class {
    constructor(dependencies) {
        this.drawingEngine = dependencies.drawingEngine;
        this.eventBus = dependencies.eventBus;
        this.stateManager = dependencies.stateManager;
        this.popup = null;
        this.isVisible = false;
        this.sliders = {};
        
        this._ensurePopupElement();
    }
    
    _ensurePopupElement() {
        this.popup = document.getElementById('quick-access-popup');
        
        if (!this.popup) {
            this._createPopupElement();
        }
        
        this._cacheElementReferences();
        this._attachEventHandlers();
        this._subscribeToEvents();
    }
    
    _cacheElementReferences() {
        this.sizeSlider = document.getElementById('pen-size-slider');
        this.opacitySlider = document.getElementById('pen-opacity-slider');
        this.previewStroke = document.getElementById('pen-preview-stroke');
    }
    
    _createPopupElement() {
        const container = document.querySelector('.canvas-area');
        if (!container) return;
        
        const popupDiv = document.createElement('div');
        popupDiv.id = 'quick-access-popup';
        popupDiv.className = 'popup-panel';
        popupDiv.style.top = '60px';
        popupDiv.style.left = '60px';
        popupDiv.style.minWidth = '280px';
        popupDiv.style.maxWidth = '320px';
        
        popupDiv.innerHTML = `
            <div style="font-size: 16px; font-weight: 600; color: var(--futaba-maroon); margin-bottom: 16px; text-align: center;">
                ペン設定
            </div>
            
            <!-- カラーパレット -->
            <div style="margin-bottom: 20px; padding: 0 8px;">
                <div style="font-size: 13px; font-weight: 600; color: var(--futaba-maroon); margin-bottom: 8px;">
                    色
                </div>
                <div id="pen-color-palette" style="display: flex; gap: 8px; flex-wrap: wrap;">
                    <button class="color-button" data-color="0x800000" style="
                        width: 36px; height: 36px; border-radius: 4px; border: 3px solid #ff8c42;
                        background: #800000; cursor: pointer; transition: all 0.2s ease;
                    " title="futaba-maroon"></button>
                    <button class="color-button" data-color="0xaa5a56" style="
                        width: 36px; height: 36px; border-radius: 4px; border: 2px solid var(--futaba-light-medium);
                        background: #aa5a56; cursor: pointer; transition: all 0.2s ease;
                    " title="light-maroon"></button>
                    <button class="color-button" data-color="0xcf9c97" style="
                        width: 36px; height: 36px; border-radius: 4px; border: 2px solid var(--futaba-light-medium);
                        background: #cf9c97; cursor: pointer; transition: all 0.2s ease;
                    " title="medium"></button>
                    <button class="color-button" data-color="0xe9c2ba" style="
                        width: 36px; height: 36px; border-radius: 4px; border: 2px solid var(--futaba-light-medium);
                        background: #e9c2ba; cursor: pointer; transition: all 0.2s ease;
                    " title="light-medium"></button>
                    <button class="color-button" data-color="0xf0e0d6" style="
                        width: 36px; height: 36px; border-radius: 4px; border: 2px solid var(--futaba-light-medium);
                        background: #f0e0d6; cursor: pointer; transition: all 0.2s ease;
                    " title="cream"></button>
                </div>
            </div>
            
            <!-- ペンサイズスライダー -->
            <div style="margin-bottom: 20px; padding: 0 8px;">
                <div style="font-size: 13px; font-weight: 600; color: var(--futaba-maroon); margin-bottom: 6px;">
                    サイズ
                </div>
                
                <div class="slider-container">
                    <div class="slider" id="pen-size-slider">
                        <div class="slider-track"></div>
                        <div class="slider-handle"></div>
                    </div>
                    <div class="slider-value">3px</div>
                </div>
                
                <div style="display: flex; justify-content: space-between; font-size: 10px; color: var(--text-secondary); margin-top: 2px;">
                    <span>1px</span>
                    <span>50px</span>
                </div>
            </div>
            
            <!-- 透明度スライダー -->
            <div style="margin-bottom: 20px; padding: 0 8px;">
                <div style="font-size: 13px; font-weight: 600; color: var(--futaba-maroon); margin-bottom: 6px;">
                    透明度
                </div>
                
                <div class="slider-container">
                    <div class="slider" id="pen-opacity-slider">
                        <div class="slider-track"></div>
                        <div class="slider-handle"></div>
                    </div>
                    <div class="slider-value">100%</div>
                </div>
                
                <div style="display: flex; justify-content: space-between; font-size: 10px; color: var(--text-secondary); margin-top: 2px;">
                    <span>0%</span>
                    <span>100%</span>
                </div>
            </div>
            
            <!-- プレビュー -->
            <div style="margin-top: 20px; padding: 16px; background: var(--futaba-background); border-radius: 6px; border: 1px solid var(--futaba-light-medium);">
                <div style="font-size: 11px; font-weight: 600; color: var(--futaba-maroon); margin-bottom: 8px; text-align: center;">
                    プレビュー
                </div>
                <div style="height: 60px; background: var(--futaba-background); border-radius: 4px; display: flex; align-items: center; justify-content: center; position: relative; overflow: hidden;">
                    <div id="pen-preview-stroke" style="
                        background: #800000;
                        height: 3px;
                        width: 80px;
                        border-radius: 50px;
                        opacity: 1;
                        transition: all 0.15s ease;
                    "></div>
                </div>
            </div>
            
            <div style="font-size: 10px; margin-top: 12px; color: var(--text-secondary); background: var(--futaba-background); padding: 8px; border-radius: 4px; text-align: center;">
                ショートカット: <strong style="color: var(--futaba-maroon);">Q</strong> キー / ペンアイコンクリック
            </div>
        `;
        
        container.appendChild(popupDiv);
        this.popup = popupDiv;
    }
    
    _attachEventHandlers() {
        if (!this.sizeSlider || !this.opacitySlider) {
            this._cacheElementReferences();
        }
        
        // サイズスライダー初期化
        this.sliders.size = this._createSlider({
            container: this.sizeSlider,
            min: 1,
            max: 50,
            initial: 3,
            format: (v) => Math.round(v) + 'px',
            onChange: (v) => {
                this._updatePreview();
                if (this.eventBus) {
                    this.eventBus.emit('brush:size-changed', { size: Math.round(v) });
                }
            }
        });
        
        // 透明度スライダー初期化
        this.sliders.opacity = this._createSlider({
            container: this.opacitySlider,
            min: 0,
            max: 100,
            initial: 100,
            format: (v) => Math.round(v) + '%',
            onChange: (v) => {
                this._updatePreview();
                if (this.eventBus) {
                    const alpha = v / 100;
                    this.eventBus.emit('brush:alpha-changed', { alpha });
                }
            }
        });
        
        // カラーボタン
        const colorButtons = document.querySelectorAll('.color-button');
        colorButtons.forEach(btn => {
            btn.addEventListener('click', (e) => this._onColorSelect(e));
        });
    }
    
    _createSlider(options) {
        const { container, min, max, initial, format, onChange } = options;
        
        if (!container) return null;
        
        const track = container.querySelector('.slider-track');
        const handle = container.querySelector('.slider-handle');
        const valueDisplay = container.parentNode?.querySelector('.slider-value');
        
        if (!track || !handle) return null;
        
        let currentValue = initial;
        let dragging = false;
        
        const updateUI = (newValue) => {
            currentValue = Math.max(min, Math.min(max, newValue));
            const percentage = ((currentValue - min) / (max - min)) * 100;
            
            track.style.width = percentage + '%';
            handle.style.left = percentage + '%';
            
            if (valueDisplay) {
                valueDisplay.textContent = format ? format(currentValue) : currentValue.toFixed(1);
            }
        };
        
        const getValue = (clientX) => {
            const rect = container.getBoundingClientRect();
            const percentage = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
            return min + (percentage * (max - min));
        };
        
        const handleMouseDown = (e) => {
            dragging = true;
            handle.style.cursor = 'grabbing';
            const newValue = getValue(e.clientX);
            updateUI(newValue);
            if (onChange) onChange(currentValue);
            e.preventDefault();
        };
        
        const handleMouseMove = (e) => {
            if (!dragging) return;
            const newValue = getValue(e.clientX);
            updateUI(newValue);
            if (onChange) onChange(currentValue);
        };
        
        const handleMouseUp = () => {
            if (!dragging) return;
            dragging = false;
            handle.style.cursor = 'grab';
        };
        
        container.addEventListener('mousedown', handleMouseDown);
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        
        updateUI(initial);
        
        return {
            getValue: () => currentValue,
            setValue: (v) => {
                updateUI(v);
                if (onChange) onChange(currentValue);
            },
            destroy: () => {
                container.removeEventListener('mousedown', handleMouseDown);
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
            }
        };
    }
    
    _onColorSelect(e) {
        const colorValue = e.target.getAttribute('data-color');
        const color = parseInt(colorValue);
        
        // アクティブ状態更新
        document.querySelectorAll('.color-button').forEach(btn => {
            btn.style.borderWidth = '2px';
            btn.style.borderColor = 'var(--futaba-light-medium)';
        });
        e.target.style.borderWidth = '3px';
        e.target.style.borderColor = '#ff8c42';
        
        // プレビュー更新
        this._updatePreview();
        
        // EventBus通知
        if (this.eventBus) {
            this.eventBus.emit('brush:color-changed', { color });
        }
    }
    
    _updatePreview() {
        if (!this.previewStroke) return;
        
        const size = this.sliders.size ? Math.round(this.sliders.size.getValue()) : 3;
        const opacity = this.sliders.opacity ? this.sliders.opacity.getValue() / 100 : 1;
        
        // 現在の色取得
        const activeColorBtn = document.querySelector('.color-button[style*="3px"]');
        let color = '#800000';
        if (activeColorBtn) {
            color = activeColorBtn.style.background;
        }
        
        // プレビュー更新
        this.previewStroke.style.height = `${Math.min(size, 40)}px`;
        this.previewStroke.style.opacity = opacity;
        this.previewStroke.style.background = color;
    }
    
    _subscribeToEvents() {
        if (!this.eventBus) return;
        
        // 外部からの変更に追従
        this.eventBus.on('brush:size-changed', ({ size }) => {
            if (this.sliders.size && !this.sliders.size._dragging) {
                this.sliders.size.setValue(size);
                this._updatePreview();
            }
        });
        
        this.eventBus.on('brush:alpha-changed', ({ alpha }) => {
            if (this.sliders.opacity && !this.sliders.opacity._dragging) {
                this.sliders.opacity.setValue(alpha * 100);
                this._updatePreview();
            }
        });
    }
    
    show() {
        if (!this.popup) {
            this._ensurePopupElement();
        }
        
        if (!this.popup) return;
        
        // BrushSettingsの現在値で同期
        if (this.drawingEngine?.brushSettings) {
            const settings = this.drawingEngine.brushSettings.getCurrentSettings();
            
            if (this.sliders.size) {
                this.sliders.size.setValue(settings.size);
            }
            
            if (this.sliders.opacity) {
                this.sliders.opacity.setValue(settings.alpha * 100);
            }
            
            this._updatePreview();
        }
        
        this.popup.classList.add('show');
        this.isVisible = true;
    }
    
    hide() {
        if (!this.popup) return;
        this.popup.classList.remove('show');
        this.isVisible = false;
    }
    
    toggle() {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }
    
    isReady() {
        return !!this.popup;
    }
    
    destroy() {
        Object.values(this.sliders).forEach(slider => {
            if (slider?.destroy) {
                slider.destroy();
            }
        });
        this.sliders = {};
    }
};

window.QuickAccessPopup = window.TegakiUI.QuickAccessPopup;

console.log('✅ quick-access-popup.js (スライダー統一改修版) loaded');