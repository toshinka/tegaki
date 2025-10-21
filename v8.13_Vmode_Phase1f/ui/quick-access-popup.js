// ===== ui/quick-access-popup.js - Phase 1: ペンスライダー対応版 =====
// 責務: クイックアクセスUI表示・管理 + ペンサイズ・透明度スライダー
// 🆕 Phase 1: ペンサイズ・透明度スライダー実装

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
        
        this._ensurePopupElement();
        this._subscribeToEvents();
    }
    
    _ensurePopupElement() {
        this.popup = document.getElementById('quick-access-popup');
        
        if (!this.popup) {
            this._createPopupElement();
        } else {
            // 既存要素の初期化
            this.popup.classList.remove('show');
            this.popup.style.display = '';
            this._attachEventHandlers();
        }
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
            
            <!-- ペンサイズスライダー -->
            <div style="margin-bottom: 20px; padding: 0 8px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <label style="font-size: 13px; font-weight: 600; color: var(--futaba-maroon);">
                        サイズ
                    </label>
                    <span id="pen-size-value" style="font-size: 13px; font-weight: 600; color: var(--futaba-maroon); min-width: 40px; text-align: right;">
                        3px
                    </span>
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
                    <span id="pen-opacity-value" style="font-size: 13px; font-weight: 600; color: var(--futaba-maroon); min-width: 40px; text-align: right;">
                        100%
                    </span>
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
        
        // 要素参照を取得
        this.sizeSlider = document.getElementById('pen-size-slider');
        this.opacitySlider = document.getElementById('pen-opacity-slider');
        this.sizeValueDisplay = document.getElementById('pen-size-value');
        this.opacityValueDisplay = document.getElementById('pen-opacity-value');
        this.previewStroke = document.getElementById('pen-preview-stroke');
        
        this._attachEventHandlers();
    }
    
    _attachEventHandlers() {
        if (!this.sizeSlider || !this.opacitySlider) {
            // 要素参照を再取得
            this.sizeSlider = document.getElementById('pen-size-slider');
            this.opacitySlider = document.getElementById('pen-opacity-slider');
            this.sizeValueDisplay = document.getElementById('pen-size-value');
            this.opacityValueDisplay = document.getElementById('pen-opacity-value');
            this.previewStroke = document.getElementById('pen-preview-stroke');
        }
        
        if (this.sizeSlider) {
            this.sizeSlider.addEventListener('input', (e) => this._onSizeChange(e));
        }
        
        if (this.opacitySlider) {
            this.opacitySlider.addEventListener('input', (e) => this._onOpacityChange(e));
        }
    }
    
    _onSizeChange(e) {
        const size = parseFloat(e.target.value);
        
        // 表示更新
        if (this.sizeValueDisplay) {
            this.sizeValueDisplay.textContent = `${size}px`;
        }
        
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
        
        // 表示更新
        if (this.opacityValueDisplay) {
            this.opacityValueDisplay.textContent = `${opacityPercent}%`;
        }
        
        // プレビュー更新
        this._updatePreview();
        
        // EventBus経由でBrushSettingsに通知
        if (this.eventBus) {
            this.eventBus.emit('brush:alpha-changed', { alpha: opacity });
        }
    }
    
    _updatePreview() {
        if (!this.previewStroke) return;
        
        const size = this.sizeSlider ? parseFloat(this.sizeSlider.value) : 3;
        const opacity = this.opacitySlider ? parseFloat(this.opacitySlider.value) / 100 : 1;
        
        // プレビューストロークのサイズと透明度を更新
        this.previewStroke.style.height = `${Math.min(size, 40)}px`;
        this.previewStroke.style.opacity = opacity;
    }
    
    _subscribeToEvents() {
        if (!this.eventBus) return;
        
        // ペンツール選択時のみ表示許可（将来的な拡張）
        this.eventBus.on('tool:changed', ({ tool }) => {
            // 現在は常に表示可能だが、将来的にはペンツールのみに制限可能
        });
        
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
    }
    
    // ===== 必須インターフェース =====
    
    show() {
        if (!this.popup) {
            this._ensurePopupElement();
        }
        
        if (!this.popup) return;
        
        // 現在のBrushSettings値でスライダーを初期化
        if (this.drawingEngine && this.drawingEngine.brushSettings) {
            const currentSettings = this.drawingEngine.brushSettings.getCurrentSettings();
            
            if (this.sizeSlider) {
                this.sizeSlider.value = currentSettings.size;
                if (this.sizeValueDisplay) {
                    this.sizeValueDisplay.textContent = `${currentSettings.size}px`;
                }
            }
            
            if (this.opacitySlider) {
                const percent = Math.round(currentSettings.alpha * 100);
                this.opacitySlider.value = percent;
                if (this.opacityValueDisplay) {
                    this.opacityValueDisplay.textContent = `${percent}%`;
                }
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
        // イベントリスナーのクリーンアップ
        if (this.sizeSlider) {
            this.sizeSlider.removeEventListener('input', this._onSizeChange);
        }
        if (this.opacitySlider) {
            this.opacitySlider.removeEventListener('input', this._onOpacityChange);
        }
    }
};

// グローバル公開
window.QuickAccessPopup = window.TegakiUI.QuickAccessPopup;

console.log('✅ quick-access-popup.js (Phase 1: ペンスライダー対応版) loaded');