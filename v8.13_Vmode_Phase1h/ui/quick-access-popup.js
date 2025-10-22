// ===== ui/quick-access-popup.js - Phase 1改修: リサイズポップアップ完全統一版 =====
// 責務: ペン設定UIの提供（カラー/サイズ/透明度）
// デザイン: resize-slider.jsと完全統一、futaba配色5色+background

window.TegakiUI = window.TegakiUI || {};

window.TegakiUI.QuickAccessPopup = class {
    constructor(dependencies) {
        this.drawingEngine = dependencies.drawingEngine;
        this.eventBus = dependencies.eventBus;
        this.stateManager = dependencies.stateManager;
        this.popup = null;
        this.isVisible = false;
        
        // スライダー制御用の状態
        this.isDraggingSize = false;
        this.isDraggingOpacity = false;
        
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
        // サイズ関連
        this.sizeSlider = document.getElementById('pen-size-slider-container');
        this.sizeTrack = document.getElementById('pen-size-track');
        this.sizeHandle = document.getElementById('pen-size-handle');
        this.sizeDisplay = document.getElementById('pen-size-display');
        this.sizeDecrease = document.getElementById('pen-size-decrease');
        this.sizeIncrease = document.getElementById('pen-size-increase');
        
        // 透明度関連
        this.opacitySlider = document.getElementById('pen-opacity-slider-container');
        this.opacityTrack = document.getElementById('pen-opacity-track');
        this.opacityHandle = document.getElementById('pen-opacity-handle');
        this.opacityDisplay = document.getElementById('pen-opacity-display');
        this.opacityDecrease = document.getElementById('pen-opacity-decrease');
        this.opacityIncrease = document.getElementById('pen-opacity-increase');
        
        // プレビュー
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
                        width: 36px; height: 36px; border-radius: 4px; border: 3px solid var(--futaba-maroon);
                        background: #800000; cursor: pointer;
                    " title="futaba-maroon"></button>
                    <button class="color-button" data-color="0xaa5a56" style="
                        width: 36px; height: 36px; border-radius: 4px; border: 2px solid var(--futaba-light-medium);
                        background: #aa5a56; cursor: pointer;
                    " title="light-maroon"></button>
                    <button class="color-button" data-color="0xcf9c97" style="
                        width: 36px; height: 36px; border-radius: 4px; border: 2px solid var(--futaba-light-medium);
                        background: #cf9c97; cursor: pointer;
                    " title="medium"></button>
                    <button class="color-button" data-color="0xe9c2ba" style="
                        width: 36px; height: 36px; border-radius: 4px; border: 2px solid var(--futaba-light-medium);
                        background: #e9c2ba; cursor: pointer;
                    " title="light-medium"></button>
                    <button class="color-button" data-color="0xf0e0d6" style="
                        width: 36px; height: 36px; border-radius: 4px; border: 2px solid var(--futaba-light-medium);
                        background: #f0e0d6; cursor: pointer;
                    " title="cream"></button>
                </div>
            </div>
            
            <!-- ペンサイズスライダー -->
            <div style="margin-bottom: 20px; padding: 0 8px;">
                <div style="font-size: 13px; font-weight: 600; color: var(--futaba-maroon); margin-bottom: 6px;">
                    サイズ
                </div>
                
                <!-- リサイズ型スライダー -->
                <div style="display: flex; align-items: center; gap: 4px; margin-bottom: 4px;">
                    <button id="pen-size-decrease" class="resize-arrow-btn">◀</button>
                    
                    <div id="pen-size-slider-container" class="resize-slider">
                        <div id="pen-size-track" class="resize-slider-track" style="width: 4%;"></div>
                        <div id="pen-size-handle" class="resize-slider-handle" style="left: 4%;"></div>
                    </div>
                    
                    <button id="pen-size-increase" class="resize-arrow-btn">▶</button>
                </div>
                
                <!-- 数値表示 -->
                <div class="resize-value-row">
                    <div id="pen-size-display" class="resize-value-display">3px</div>
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
                
                <!-- リサイズ型スライダー -->
                <div style="display: flex; align-items: center; gap: 4px; margin-bottom: 4px;">
                    <button id="pen-opacity-decrease" class="resize-arrow-btn">◀</button>
                    
                    <div id="pen-opacity-slider-container" class="resize-slider">
                        <div id="pen-opacity-track" class="resize-slider-track" style="width: 100%;"></div>
                        <div id="pen-opacity-handle" class="resize-slider-handle" style="left: 100%;"></div>
                    </div>
                    
                    <button id="pen-opacity-increase" class="resize-arrow-btn">▶</button>
                </div>
                
                <!-- 数値表示 -->
                <div class="resize-value-row">
                    <div id="pen-opacity-display" class="resize-value-display">100%</div>
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
        
        // ========== サイズスライダー ==========
        
        // ドラッグ開始
        if (this.sizeHandle) {
            this.sizeHandle.addEventListener('mousedown', (e) => {
                this.isDraggingSize = true;
                this.sizeHandle.style.cursor = 'grabbing';
                e.preventDefault();
            });
        }
        
        // クリックでジャンプ
        if (this.sizeSlider) {
            this.sizeSlider.addEventListener('click', (e) => {
                if (e.target === this.sizeHandle) return;
                const rect = this.sizeSlider.getBoundingClientRect();
                const percent = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
                const value = 1 + ((50 - 1) * percent / 100);
                this._updateSizeSlider(Math.round(value));
            });
        }
        
        // ◀▶ボタン
        if (this.sizeDecrease) {
            this.sizeDecrease.addEventListener('click', () => {
                const currentValue = this._getCurrentSizeValue();
                this._updateSizeSlider(Math.max(1, currentValue - 1));
            });
        }
        
        if (this.sizeIncrease) {
            this.sizeIncrease.addEventListener('click', () => {
                const currentValue = this._getCurrentSizeValue();
                this._updateSizeSlider(Math.min(50, currentValue + 1));
            });
        }
        
        // ========== 透明度スライダー ==========
        
        // ドラッグ開始
        if (this.opacityHandle) {
            this.opacityHandle.addEventListener('mousedown', (e) => {
                this.isDraggingOpacity = true;
                this.opacityHandle.style.cursor = 'grabbing';
                e.preventDefault();
            });
        }
        
        // クリックでジャンプ
        if (this.opacitySlider) {
            this.opacitySlider.addEventListener('click', (e) => {
                if (e.target === this.opacityHandle) return;
                const rect = this.opacitySlider.getBoundingClientRect();
                const percent = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
                this._updateOpacitySlider(Math.round(percent));
            });
        }
        
        // ◀▶ボタン
        if (this.opacityDecrease) {
            this.opacityDecrease.addEventListener('click', () => {
                const currentValue = this._getCurrentOpacityValue();
                this._updateOpacitySlider(Math.max(0, currentValue - 1));
            });
        }
        
        if (this.opacityIncrease) {
            this.opacityIncrease.addEventListener('click', () => {
                const currentValue = this._getCurrentOpacityValue();
                this._updateOpacitySlider(Math.min(100, currentValue + 1));
            });
        }
        
        // ========== グローバルマウスイベント ==========
        
        document.addEventListener('mousemove', (e) => {
            if (this.isDraggingSize) {
                const rect = this.sizeSlider.getBoundingClientRect();
                const percent = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
                const value = 1 + ((50 - 1) * percent / 100);
                this._updateSizeSlider(Math.round(value));
            }
            
            if (this.isDraggingOpacity) {
                const rect = this.opacitySlider.getBoundingClientRect();
                const percent = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
                this._updateOpacitySlider(Math.round(percent));
            }
        });
        
        document.addEventListener('mouseup', () => {
            if (this.isDraggingSize) {
                this.isDraggingSize = false;
                if (this.sizeHandle) this.sizeHandle.style.cursor = 'grab';
            }
            if (this.isDraggingOpacity) {
                this.isDraggingOpacity = false;
                if (this.opacityHandle) this.opacityHandle.style.cursor = 'grab';
            }
        });
        
        // ========== カラーボタン ==========
        
        const colorButtons = document.querySelectorAll('.color-button');
        colorButtons.forEach(btn => {
            btn.addEventListener('click', (e) => this._onColorSelect(e));
        });
    }
    
    _getCurrentSizeValue() {
        if (!this.sizeDisplay) return 3;
        const text = this.sizeDisplay.textContent;
        return parseInt(text) || 3;
    }
    
    _getCurrentOpacityValue() {
        if (!this.opacityDisplay) return 100;
        const text = this.opacityDisplay.textContent;
        return parseInt(text) || 100;
    }
    
    _updateSizeSlider(value) {
        value = Math.max(1, Math.min(50, value));
        
        const percent = ((value - 1) / (50 - 1)) * 100;
        
        // UI更新（transitionなし、即座反映）
        if (this.sizeTrack) {
            this.sizeTrack.style.width = percent + '%';
        }
        if (this.sizeHandle) {
            this.sizeHandle.style.left = percent + '%';
        }
        if (this.sizeDisplay) {
            this.sizeDisplay.textContent = value + 'px';
        }
        
        // プレビュー更新
        this._updatePreview();
        
        // EventBus通知
        if (this.eventBus) {
            this.eventBus.emit('brush:size-changed', { size: value });
        }
    }
    
    _updateOpacitySlider(percent) {
        percent = Math.max(0, Math.min(100, percent));
        
        // UI更新（transitionなし、即座反映）
        if (this.opacityTrack) {
            this.opacityTrack.style.width = percent + '%';
        }
        if (this.opacityHandle) {
            this.opacityHandle.style.left = percent + '%';
        }
        if (this.opacityDisplay) {
            this.opacityDisplay.textContent = percent + '%';
        }
        
        // プレビュー更新
        this._updatePreview();
        
        // EventBus通知
        if (this.eventBus) {
            const alpha = percent / 100;
            this.eventBus.emit('brush:alpha-changed', { alpha });
        }
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
        e.target.style.borderColor = 'var(--futaba-maroon)';
        
        // プレビュー更新
        this._updatePreview();
        
        // EventBus通知
        if (this.eventBus) {
            this.eventBus.emit('brush:color-changed', { color });
        }
    }
    
    _updatePreview() {
        if (!this.previewStroke) return;
        
        const size = this._getCurrentSizeValue();
        const opacity = this._getCurrentOpacityValue() / 100;
        
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
            if (!this.isDraggingSize) {
                const percent = ((size - 1) / (50 - 1)) * 100;
                if (this.sizeTrack) this.sizeTrack.style.width = percent + '%';
                if (this.sizeHandle) this.sizeHandle.style.left = percent + '%';
                if (this.sizeDisplay) this.sizeDisplay.textContent = size + 'px';
                this._updatePreview();
            }
        });
        
        this.eventBus.on('brush:alpha-changed', ({ alpha }) => {
            if (!this.isDraggingOpacity) {
                const percent = Math.round(alpha * 100);
                if (this.opacityTrack) this.opacityTrack.style.width = percent + '%';
                if (this.opacityHandle) this.opacityHandle.style.left = percent + '%';
                if (this.opacityDisplay) this.opacityDisplay.textContent = percent + '%';
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
            
            // サイズ同期
            const sizePercent = ((settings.size - 1) / (50 - 1)) * 100;
            if (this.sizeTrack) this.sizeTrack.style.width = sizePercent + '%';
            if (this.sizeHandle) this.sizeHandle.style.left = sizePercent + '%';
            if (this.sizeDisplay) this.sizeDisplay.textContent = settings.size + 'px';
            
            // 透明度同期
            const opacityPercent = Math.round(settings.alpha * 100);
            if (this.opacityTrack) this.opacityTrack.style.width = opacityPercent + '%';
            if (this.opacityHandle) this.opacityHandle.style.left = opacityPercent + '%';
            if (this.opacityDisplay) this.opacityDisplay.textContent = opacityPercent + '%';
            
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
        // イベントリスナーは自動GC対象
    }
};

window.QuickAccessPopup = window.TegakiUI.QuickAccessPopup;

console.log('✅ quick-access-popup.js (Phase1改修版: リサイズ完全統一) loaded');