// ===== ui/quick-access-popup.js - Phase 1: 初期値同期修正版 =====
// 修正: show() で必ずBrushSettingsから値を取得、UIを同期

window.TegakiUI = window.TegakiUI || {};

window.TegakiUI.QuickAccessPopup = class {
    constructor(dependencies) {
        this.drawingEngine = dependencies.drawingEngine;
        this.eventBus = dependencies.eventBus;
        this.stateManager = dependencies.stateManager;
        this.popup = null;
        this.isVisible = false;
        
        // スライダー要素の参照
        this.sizeSlider = null;
        this.opacitySlider = null;
        this.sizeValueDisplay = null;
        this.opacityValueDisplay = null;
        this.previewStroke = null;
        
        // イベントハンドラーを保持（削除時用）
        this._sizeChangeHandler = null;
        this._opacityChangeHandler = null;
        
        this._ensurePopupElement();
    }
    
    _ensurePopupElement() {
        this.popup = document.getElementById('quick-access-popup');
        
        if (!this.popup) {
            this._createPopupElement();
        }
        
        // 要素参照を必ず取得
        this._cacheElementReferences();
        
        // イベントリスナーを登録（毎回）
        this._attachEventHandlers();
        
        // EventBus購読を設定
        this._subscribeToEvents();
    }
    
    _cacheElementReferences() {
        this.sizeSlider = document.getElementById('pen-size-slider');
        this.opacitySlider = document.getElementById('pen-opacity-slider');
        this.sizeInput = document.getElementById('pen-size-input');
        this.opacityInput = document.getElementById('pen-opacity-input');
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
            <div class="popup-title" style="font-size: 16px; font-weight: 600; color: var(--futaba-maroon); margin-bottom: 16px; text-align: center;">
                ペン設定
            </div>
            
            <!-- カラーパレット -->
            <div style="margin-bottom: 20px; padding: 0 8px;">
                <div style="font-size: 13px; font-weight: 600; color: var(--futaba-maroon); margin-bottom: 8px;">
                    色
                </div>
                <div id="pen-color-palette" style="display: flex; gap: 8px; flex-wrap: wrap;">
                    <button id="color-futaba-maroon" class="color-button" data-color="0x800000" style="
                        width: 36px; height: 36px; border-radius: 4px; border: 3px solid var(--futaba-maroon);
                        background: #800000; cursor: pointer;
                    " title="futaba-maroon"></button>
                    <button id="color-light-maroon" class="color-button" data-color="0xaa5a56" style="
                        width: 36px; height: 36px; border-radius: 4px; border: 2px solid #ccc;
                        background: #aa5a56; cursor: pointer;
                    " title="light-maroon"></button>
                    <button id="color-medium" class="color-button" data-color="0xcf9c97" style="
                        width: 36px; height: 36px; border-radius: 4px; border: 2px solid #ccc;
                        background: #cf9c97; cursor: pointer;
                    " title="medium"></button>
                    <button id="color-light-medium" class="color-button" data-color="0xe9c2ba" style="
                        width: 36px; height: 36px; border-radius: 4px; border: 2px solid #ccc;
                        background: #e9c2ba; cursor: pointer;
                    " title="light-medium"></button>
                </div>
            </div>
            
            <!-- ペンサイズスライダー -->
            <div style="margin-bottom: 20px; padding: 0 8px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <label style="font-size: 13px; font-weight: 600; color: var(--futaba-maroon);">
                        サイズ
                    </label>
                    <input 
                        type="number" 
                        id="pen-size-input" 
                        min="1" 
                        max="50" 
                        value="3" 
                        style="width: 50px; padding: 2px 4px; border: 1px solid #ccc; border-radius: 3px; font-size: 12px; text-align: right;"
                    />
                </div>
                <input 
                    type="range" 
                    id="pen-size-slider" 
                    min="1" 
                    max="50" 
                    value="3" 
                    step="1"
                    style="width: 100%; cursor: pointer;"
                />
                <div style="display: flex; justify-content: space-between; font-size: 10px; color: var(--text-secondary); margin-top: 4px;">
                    <span>1px</span>
                    <span>50px</span>
                </div>
            </div>
            
            <!-- 透明度スライダー -->
            <div style="margin-bottom: 20px; padding: 0 8px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <label style="font-size: 13px; font-weight: 600; color: var(--futaba-maroon);">
                        透明度
                    </label>
                    <input 
                        type="number" 
                        id="pen-opacity-input" 
                        min="0" 
                        max="100" 
                        value="100" 
                        style="width: 50px; padding: 2px 4px; border: 1px solid #ccc; border-radius: 3px; font-size: 12px; text-align: right;"
                    />
                </div>
                <input 
                    type="range" 
                    id="pen-opacity-slider" 
                    min="0" 
                    max="100" 
                    value="100" 
                    step="1"
                    style="width: 100%; cursor: pointer;"
                />
                <div style="display: flex; justify-content: space-between; font-size: 10px; color: var(--text-secondary); margin-top: 4px;">
                    <span>0%</span>
                    <span>100%</span>
                </div>
            </div>
            
            <!-- プレビュー -->
            <div style="margin-top: 20px; padding: 16px; background: var(--futaba-background); border-radius: 6px; border: 1px solid var(--futaba-light-medium);">
                <div style="font-size: 11px; font-weight: 600; color: var(--futaba-maroon); margin-bottom: 8px; text-align: center;">
                    プレビュー
                </div>
                <div style="height: 60px; background: white; border-radius: 4px; display: flex; align-items: center; justify-content: center; position: relative; overflow: hidden;">
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
            
            <div style="font-size: 10px; margin-top: 12px; color: var(--text-secondary); background: var(--futaba-cream); padding: 8px; border-radius: 4px; text-align: center;">
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
        
        // 既存リスナー削除
        if (this.sizeSlider && this._sizeChangeHandler) {
            this.sizeSlider.removeEventListener('input', this._sizeChangeHandler);
        }
        if (this.opacitySlider && this._opacityChangeHandler) {
            this.opacitySlider.removeEventListener('input', this._opacityChangeHandler);
        }
        if (this.sizeInput && this._sizeInputHandler) {
            this.sizeInput.removeEventListener('change', this._sizeInputHandler);
        }
        if (this.opacityInput && this._opacityInputHandler) {
            this.opacityInput.removeEventListener('change', this._opacityInputHandler);
        }
        
        // スライダーハンドラー登録
        if (this.sizeSlider) {
            this._sizeChangeHandler = (e) => this._onSizeChange(e);
            this.sizeSlider.addEventListener('input', this._sizeChangeHandler);
        }
        
        if (this.opacitySlider) {
            this._opacityChangeHandler = (e) => this._onOpacityChange(e);
            this.opacitySlider.addEventListener('input', this._opacityChangeHandler);
        }
        
        // 数値入力フィールドハンドラー登録
        if (this.sizeInput) {
            this._sizeInputHandler = (e) => this._onSizeInputChange(e);
            this.sizeInput.addEventListener('change', this._sizeInputHandler);
        }
        
        if (this.opacityInput) {
            this._opacityInputHandler = (e) => this._onOpacityInputChange(e);
            this.opacityInput.addEventListener('change', this._opacityInputHandler);
        }
        
        // カラーボタンリスナー
        const colorButtons = document.querySelectorAll('.color-button');
        colorButtons.forEach(btn => {
            btn.addEventListener('click', (e) => this._onColorSelect(e));
        });
    }
    
    _onSizeChange(e) {
        const size = parseFloat(e.target.value);
        
        // スライダーと入力フィールドを同期
        if (this.sizeInput) {
            this.sizeInput.value = size;
        }
        
        // プレビュー更新
        this._updatePreview();
        
        // EventBus経由でBrushSettingsに通知
        if (this.eventBus) {
            this.eventBus.emit('brush:size-changed', { size });
        }
    }
    
    _onSizeInputChange(e) {
        let size = parseFloat(e.target.value);
        
        // 値の範囲を制限
        size = Math.max(1, Math.min(50, size));
        
        // スライダーと入力フィールドを同期
        if (this.sizeSlider) {
            this.sizeSlider.value = size;
        }
        this.sizeInput.value = size;
        
        // プレビュー更新
        this._updatePreview();
        
        // EventBus経由でBrushSettingsに通知
        if (this.eventBus) {
            this.eventBus.emit('brush:size-changed', { size });
        }
    }
    
    _onOpacityChange(e) {
        const opacityPercent = parseInt(e.target.value);
        const opacity = opacityPercent / 100;
        
        // スライダーと入力フィールドを同期
        if (this.opacityInput) {
            this.opacityInput.value = opacityPercent;
        }
        
        // プレビュー更新
        this._updatePreview();
        
        // EventBus経由でBrushSettingsに通知
        if (this.eventBus) {
            this.eventBus.emit('brush:alpha-changed', { alpha: opacity });
        }
    }
    
    _onOpacityInputChange(e) {
        let opacityPercent = parseInt(e.target.value);
        
        // 値の範囲を制限
        opacityPercent = Math.max(0, Math.min(100, opacityPercent));
        const opacity = opacityPercent / 100;
        
        // スライダーと入力フィールドを同期
        if (this.opacitySlider) {
            this.opacitySlider.value = opacityPercent;
        }
        this.opacityInput.value = opacityPercent;
        
        // プレビュー更新
        this._updatePreview();
        
        // EventBus経由でBrushSettingsに通知
        if (this.eventBus) {
            this.eventBus.emit('brush:alpha-changed', { alpha: opacity });
        }
    }
    
    _onColorSelect(e) {
        const colorValue = e.target.getAttribute('data-color');
        const color = parseInt(colorValue);
        
        // アクティブ状態の更新
        document.querySelectorAll('.color-button').forEach(btn => {
            btn.style.borderWidth = '2px';
            btn.style.borderColor = '#ccc';
        });
        e.target.style.borderWidth = '3px';
        e.target.style.borderColor = 'var(--futaba-maroon)';
        
        // プレビュー更新
        this._updatePreview();
        
        // EventBus経由でBrushSettingsに通知
        if (this.eventBus) {
            this.eventBus.emit('brush:color-changed', { color });
        }
    }
    
    _updatePreview() {
        if (!this.previewStroke) return;
        
        const size = this.sizeSlider ? parseFloat(this.sizeSlider.value) : 3;
        const opacity = this.opacitySlider ? parseFloat(this.opacitySlider.value) / 100 : 1;
        
        // 現在の色を取得
        const activeColorBtn = document.querySelector('.color-button[style*="3px"]');
        let color = '#800000';
        if (activeColorBtn) {
            color = activeColorBtn.style.background;
        }
        
        // プレビューストロークのサイズと透明度を更新
        this.previewStroke.style.height = `${Math.min(size, 40)}px`;
        this.previewStroke.style.opacity = opacity;
        this.previewStroke.style.background = color;
    }
    
    _subscribeToEvents() {
        if (!this.eventBus) return;
        
        // 外部からのブラシ設定変更に追従
        this.eventBus.on('brush:size-changed', ({ size }) => {
            if (this.sizeSlider && this.sizeSlider !== document.activeElement) {
                this.sizeSlider.value = size;
                if (this.sizeValueDisplay) {
                    this.sizeValueDisplay.textContent = `${size}px`;
                }
                this._updatePreview();
            }
        });
        
        this.eventBus.on('brush:alpha-changed', ({ alpha }) => {
            if (this.opacitySlider && this.opacitySlider !== document.activeElement) {
                const percent = Math.round(alpha * 100);
                this.opacitySlider.value = percent;
                if (this.opacityValueDisplay) {
                    this.opacityValueDisplay.textContent = `${percent}%`;
                }
                this._updatePreview();
            }
        });
        
        this.eventBus.on('brush:color-changed', ({ color }) => {
            // カラーボタンの同期は別途実装
        });
    }
    
    // ===== 必須インターフェース =====
    
    show() {
        if (!this.popup) {
            this._ensurePopupElement();
        }
        
        if (!this.popup) return;
        
        // 現在のBrushSettings値で必ず同期
        if (this.drawingEngine && this.drawingEngine.brushSettings) {
            const currentSettings = this.drawingEngine.brushSettings.getCurrentSettings();
            
            // スライダーと入力フィールドを同期
            if (this.sizeSlider) {
                this.sizeSlider.value = currentSettings.size;
            }
            if (this.sizeInput) {
                this.sizeInput.value = currentSettings.size;
            }
            
            if (this.opacitySlider) {
                const percent = Math.round(currentSettings.alpha * 100);
                this.opacitySlider.value = percent;
            }
            if (this.opacityInput) {
                const percent = Math.round(currentSettings.alpha * 100);
                this.opacityInput.value = percent;
            }
            
            // プレビュー更新
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
        if (this.sizeSlider && this._sizeChangeHandler) {
            this.sizeSlider.removeEventListener('input', this._sizeChangeHandler);
        }
        if (this.opacitySlider && this._opacityChangeHandler) {
            this.opacitySlider.removeEventListener('input', this._opacityChangeHandler);
        }
    }
};

window.QuickAccessPopup = window.TegakiUI.QuickAccessPopup;

console.log('✅ quick-access-popup.js (Phase 1: 初期値同期修正版) loaded');