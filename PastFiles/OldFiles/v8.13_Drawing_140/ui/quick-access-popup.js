/**
 * @file ui/quick-access-popup.js
 * @description ペン設定クイックアクセスポップアップ
 * 
 * 【改修内容】
 * ✅ ペンタブレット対応: mousedown → pointerdown に変更
 * ✅ スライダーの滑らか性改善: リニアな動きに最適化
 * ✅ 透明度初期値修正: BrushSettings から正しく取得（100%）
 * 
 * 【親ファイル (このファイルが依存)】
 * - system/drawing/brush-settings.js (BrushSettings)
 * - system/event-bus.js (EventBus)
 * 
 * 【子ファイル (このファイルに依存)】
 * - ui-panels.js (UIController経由で初期化)
 */

(function() {
    'use strict';

    class QuickAccessPopup {
        constructor(config = {}) {
            this.config = config;
            this.eventBus = config.eventBus || window.TegakiEventBus;
            this.brushSettings = config.brushSettings || window.brushSettings;
            
            if (!this.brushSettings) {
                setTimeout(() => {
                    this.brushSettings = window.brushSettings;
                    if (this.initialized && this.brushSettings) {
                        this._updateUI();
                    }
                }, 500);
            }
            
            this.panel = null;
            this.isVisible = false;
            this.initialized = false;
            
            // スライダードラッグ状態フラグ
            this.isDraggingSize = false;
            this.isDraggingOpacity = false;
            
            // ✅ ポップアップドラッグ状態フラグ
            this.isDraggingPanel = false;
            this.dragStartX = 0;
            this.dragStartY = 0;
            this.panelStartX = 0;
            this.panelStartY = 0;
            
            // DOM要素キャッシュ
            this.elements = {};
            
            // ✅ ポインターイベントリスナー参照（ペンタブレット対応）
            this.sliderMoveHandler = null;
            this.sliderUpHandler = null;
            this.dragMoveHandler = null;
            this.dragUpHandler = null;
            
            // ✅ アクティブなスライダー要素（ポインターキャプチャ用）
            this.activeSliderElement = null;
            this.activeDragPointerId = null;
            
            // 現在値（BrushSettingsから取得）
            this.currentSize = 3;
            this.currentOpacity = 100; // ✅ パーセント表記（内部では0.0-1.0）
            
            // 範囲定義
            this.MIN_SIZE = 0.5;
            this.MAX_SIZE = 30;
            this.MIN_OPACITY = 0;
            this.MAX_OPACITY = 100;
            
            this._ensurePanelExists();
        }

        _ensurePanelExists() {
            this.panel = document.getElementById('quick-access-popup');
            
            if (!this.panel) {
                const canvasArea = document.querySelector('.canvas-area');
                if (!canvasArea) return;
                
                this.panel = document.createElement('div');
                this.panel.id = 'quick-access-popup';
                this.panel.className = 'popup-panel resize-popup-compact';
                
                const savedPos = this._loadPosition();
                this.panel.style.cssText = `left: ${savedPos.x}px; top: ${savedPos.y}px;`;
                
                canvasArea.appendChild(this.panel);
            }
            
            if (this.panel && !this.panel.classList.contains('resize-popup-compact')) {
                this.panel.classList.add('resize-popup-compact');
            }
            
            if (!this.panel.children.length) {
                this._populateContent();
            }
        }

        _populateContent() {
            if (!this.panel) return;
            
            this.panel.innerHTML = `
                <!-- 閉じるボタン（右上） -->
                <button class="quick-access-close-btn" id="quick-access-close-btn" title="閉じる">×</button>

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
                <div class="resize-compact-group">
                    <div class="resize-compact-label">ペンサイズ</div>
                    <div class="resize-slider-row">
                        <button class="resize-arrow-btn" id="pen-size-decrease">◀</button>
                        <div class="resize-slider" id="pen-size-slider">
                            <div class="resize-slider-track" id="pen-size-track"></div>
                            <div class="resize-slider-handle" id="pen-size-handle"></div>
                        </div>
                        <button class="resize-arrow-btn" id="pen-size-increase">▶</button>
                    </div>
                    <div class="resize-value-row">
                        <div class="resize-value-display" id="pen-size-display">3.0px</div>
                    </div>
                </div>

                <!-- 透明度スライダー -->
                <div class="resize-compact-group">
                    <div class="resize-compact-label">透明度</div>
                    <div class="resize-slider-row">
                        <button class="resize-arrow-btn" id="pen-opacity-decrease">◀</button>
                        <div class="resize-slider" id="pen-opacity-slider">
                            <div class="resize-slider-track" id="pen-opacity-track"></div>
                            <div class="resize-slider-handle" id="pen-opacity-handle"></div>
                        </div>
                        <button class="resize-arrow-btn" id="pen-opacity-increase">▶</button>
                    </div>
                    <div class="resize-value-row">
                        <div class="resize-value-display" id="pen-opacity-display">100%</div>
                    </div>
                </div>
            `;
        }

        _cacheElements() {
            this.elements = {
                closeBtn: document.getElementById('quick-access-close-btn'),
                
                // サイズスライダー
                sizeSlider: document.getElementById('pen-size-slider'),
                sizeTrack: document.getElementById('pen-size-track'),
                sizeHandle: document.getElementById('pen-size-handle'),
                sizeDisplay: document.getElementById('pen-size-display'),
                sizeDecrease: document.getElementById('pen-size-decrease'),
                sizeIncrease: document.getElementById('pen-size-increase'),
                
                // 透明度スライダー
                opacitySlider: document.getElementById('pen-opacity-slider'),
                opacityTrack: document.getElementById('pen-opacity-track'),
                opacityHandle: document.getElementById('pen-opacity-handle'),
                opacityDisplay: document.getElementById('pen-opacity-display'),
                opacityDecrease: document.getElementById('pen-opacity-decrease'),
                opacityIncrease: document.getElementById('pen-opacity-increase'),
                
                // カラーパレット
                colorPalette: document.getElementById('pen-color-palette')
            };
        }

        initialize() {
            if (this.initialized) return;
            
            if (!this.brushSettings) {
                console.error('❌ QuickAccessPopup: Cannot initialize without BrushSettings');
                return;
            }
            
            this._cacheElements();
            this._setupCloseButton();
            this._setupColorButtons();
            this._setupSliders();
            this._setupPanelDragHandlers();
            this._updateUI(); // ✅ BrushSettingsから初期値取得
            
            this.initialized = true;
        }

        _setupCloseButton() {
            if (!this.elements.closeBtn) return;
            
            // ✅ ペンタブレット対応
            this.elements.closeBtn.addEventListener('pointerdown', (e) => {
                e.stopPropagation();
                this.hide();
            });
        }

        _setupColorButtons() {
            const colorButtons = this.panel.querySelectorAll('.color-button');
            colorButtons.forEach(btn => {
                // ✅ ペンタブレット対応
                btn.addEventListener('pointerdown', () => {
                    const color = parseInt(btn.getAttribute('data-color'));
                    this.brushSettings.setColor(color);
                    
                    colorButtons.forEach(b => {
                        b.style.border = b === btn 
                            ? '3px solid #ff8c42' 
                            : '2px solid var(--futaba-light-medium)';
                    });
                    
                    if (this.eventBus) {
                        this.eventBus.emit('brush:color-changed', { color });
                    }
                });
            });
        }

        _setupSliders() {
            // ✅ ポインターキャプチャ対応のグローバルハンドラー
            this.sliderMoveHandler = (e) => {
                // 🔥 重要: すべての pointermove で preventDefault
                if (this.isDraggingSize || this.isDraggingOpacity) {
                    e.preventDefault();
                    e.stopPropagation();
                }
                
                if (this.isDraggingSize) {
                    const rect = this.elements.sizeSlider.getBoundingClientRect();
                    const clientX = e.clientX || (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
                    const percent = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
                    const value = this.MIN_SIZE + ((this.MAX_SIZE - this.MIN_SIZE) * percent / 100);
                    this._updateSizeSlider(value);
                }
                if (this.isDraggingOpacity) {
                    const rect = this.elements.opacitySlider.getBoundingClientRect();
                    const clientX = e.clientX || (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
                    const percent = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
                    const value = this.MIN_OPACITY + ((this.MAX_OPACITY - this.MIN_OPACITY) * percent / 100);
                    this._updateOpacitySlider(value);
                }
            };
            
            this.sliderUpHandler = (e) => {
                if (this.isDraggingSize || this.isDraggingOpacity) {
                    // ✅ ポインターキャプチャ解放
                    if (this.activeSliderElement && this.activeSliderElement.releasePointerCapture) {
                        try {
                            this.activeSliderElement.releasePointerCapture(e.pointerId);
                        } catch (err) {}
                    }
                }
                this.isDraggingSize = false;
                this.isDraggingOpacity = false;
                this.activeSliderElement = null;
            };
            
            // ✅ pointermove/pointerup/pointercancel に変更
            document.addEventListener('pointermove', this.sliderMoveHandler, { passive: false, capture: true });
            document.addEventListener('pointerup', this.sliderUpHandler, { capture: true });
            document.addEventListener('pointercancel', this.sliderUpHandler, { capture: true });
            
            // 🔥 ペンタブレット特有の問題対策: pointerleave/pointerout を無視
            const ignoreLeave = (e) => {
                if (this.isDraggingSize || this.isDraggingOpacity) {
                    e.preventDefault();
                    e.stopPropagation();
                    return false;
                }
            };
            document.addEventListener('pointerleave', ignoreLeave, { passive: false, capture: true });
            document.addEventListener('pointerout', ignoreLeave, { passive: false, capture: true });
            
            // ✅ サイズハンドル（ポインターキャプチャ設定）
            this.elements.sizeHandle.style.touchAction = 'none'; // 🔥 タッチアクション無効化
            this.elements.sizeHandle.addEventListener('pointerdown', (e) => {
                this.isDraggingSize = true;
                this.activeSliderElement = this.elements.sizeHandle;
                this.activeSliderPointerId = e.pointerId;
                
                // ✅ ポインターキャプチャでペンイベントを確実に追跡
                if (this.elements.sizeHandle.setPointerCapture) {
                    try {
                        this.elements.sizeHandle.setPointerCapture(e.pointerId);
                    } catch (err) {}
                }
                
                e.preventDefault();
                e.stopPropagation();
            });
            
            // ✅ 透明度ハンドル（ポインターキャプチャ設定）
            this.elements.opacityHandle.style.touchAction = 'none'; // 🔥 タッチアクション無効化
            this.elements.opacityHandle.addEventListener('pointerdown', (e) => {
                this.isDraggingOpacity = true;
                this.activeSliderElement = this.elements.opacityHandle;
                this.activeSliderPointerId = e.pointerId;
                
                // ✅ ポインターキャプチャでペンイベントを確実に追跡
                if (this.elements.opacityHandle.setPointerCapture) {
                    try {
                        this.elements.opacityHandle.setPointerCapture(e.pointerId);
                    } catch (err) {}
                }
                
                e.preventDefault();
                e.stopPropagation();
            });
            
            // ✅ スライダー直接クリック（サイズ）
            this.elements.sizeSlider.addEventListener('pointerdown', (e) => {
                if (e.target === this.elements.sizeHandle) return;
                const rect = this.elements.sizeSlider.getBoundingClientRect();
                const clientX = e.clientX || (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
                const percent = ((clientX - rect.left) / rect.width) * 100;
                const value = this.MIN_SIZE + ((this.MAX_SIZE - this.MIN_SIZE) * percent / 100);
                this._updateSizeSlider(value);
            });
            
            // ✅ スライダー直接クリック（透明度）
            this.elements.opacitySlider.addEventListener('pointerdown', (e) => {
                if (e.target === this.elements.opacityHandle) return;
                const rect = this.elements.opacitySlider.getBoundingClientRect();
                const clientX = e.clientX || (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
                const percent = ((clientX - rect.left) / rect.width) * 100;
                const value = this.MIN_OPACITY + ((this.MAX_OPACITY - this.MIN_OPACITY) * percent / 100);
                this._updateOpacitySlider(value);
            });
            
            // ✅ ステップボタン（ペンタブレット対応）
            this.elements.sizeDecrease.addEventListener('pointerdown', () => {
                const current = this.brushSettings.getSize();
                this._updateSizeSlider(Math.max(this.MIN_SIZE, current - 0.5));
            });
            
            this.elements.sizeIncrease.addEventListener('pointerdown', () => {
                const current = this.brushSettings.getSize();
                this._updateSizeSlider(Math.min(this.MAX_SIZE, current + 0.5));
            });
            
            this.elements.opacityDecrease.addEventListener('pointerdown', () => {
                const current = this.brushSettings.getOpacity();
                // ✅ 0.0-1.0 を 0-100 に変換
                const currentPercent = current * 100;
                this._updateOpacitySlider(Math.max(this.MIN_OPACITY, currentPercent - 5));
            });
            
            this.elements.opacityIncrease.addEventListener('pointerdown', () => {
                const current = this.brushSettings.getOpacity();
                // ✅ 0.0-1.0 を 0-100 に変換
                const currentPercent = current * 100;
                this._updateOpacitySlider(Math.min(this.MAX_OPACITY, currentPercent + 5));
            });
        }

        // ✅ ポインターキャプチャ対応のパネルドラッグ
        _setupPanelDragHandlers() {
            this.panel.addEventListener('pointerdown', (e) => {
                const target = e.target;
                const isInteractive = 
                    target.classList.contains('color-button') ||
                    target.classList.contains('resize-arrow-btn') ||
                    target.classList.contains('resize-slider-handle') ||
                    target.classList.contains('quick-access-close-btn') ||
                    target.closest('.resize-slider') ||
                    target.closest('.color-button') ||
                    target.closest('.resize-arrow-btn') ||
                    target.closest('.quick-access-close-btn');
                
                if (isInteractive) return;
                
                this.isDraggingPanel = true;
                this.activeDragPointerId = e.pointerId;
                
                this.dragStartX = e.clientX;
                this.dragStartY = e.clientY;
                
                const rect = this.panel.getBoundingClientRect();
                this.panelStartX = rect.left;
                this.panelStartY = rect.top;
                
                this.panel.style.cursor = 'grabbing';
                
                // ✅ ポインターキャプチャでペンイベントを確実に追跡
                if (this.panel.setPointerCapture) {
                    try {
                        this.panel.setPointerCapture(e.pointerId);
                    } catch (err) {}
                }
                
                e.preventDefault();
            });
            
            // ✅ pointermove（ポインターキャプチャ対応）
            this.dragMoveHandler = (e) => {
                if (!this.isDraggingPanel) return;
                
                e.preventDefault(); // ✅ ブラウザデフォルト動作抑制
                
                const deltaX = e.clientX - this.dragStartX;
                const deltaY = e.clientY - this.dragStartY;
                
                let newX = this.panelStartX + deltaX;
                let newY = this.panelStartY + deltaY;
                
                const viewportWidth = window.innerWidth;
                const viewportHeight = window.innerHeight;
                const panelRect = this.panel.getBoundingClientRect();
                
                newX = Math.max(0, Math.min(newX, viewportWidth - panelRect.width));
                newY = Math.max(0, Math.min(newY, viewportHeight - panelRect.height));
                
                this.panel.style.left = newX + 'px';
                this.panel.style.top = newY + 'px';
            };
            
            this.dragUpHandler = (e) => {
                if (!this.isDraggingPanel) return;
                
                // ✅ ポインターキャプチャ解放
                if (this.panel.releasePointerCapture && this.activeDragPointerId !== null) {
                    try {
                        this.panel.releasePointerCapture(this.activeDragPointerId);
                    } catch (err) {}
                }
                
                this.isDraggingPanel = false;
                this.activeDragPointerId = null;
                this.panel.style.cursor = 'default';
                
                const rect = this.panel.getBoundingClientRect();
                this._savePosition(rect.left, rect.top);
            };
            
            document.addEventListener('pointermove', this.dragMoveHandler, { passive: false });
            document.addEventListener('pointerup', this.dragUpHandler);
            document.addEventListener('pointercancel', this.dragUpHandler);
        }

        _savePosition(x, y) {
            try {
                localStorage.setItem('quick-access-position', JSON.stringify({ x, y }));
            } catch (error) {
                // silent fail
            }
        }

        _loadPosition() {
            try {
                const saved = localStorage.getItem('quick-access-position');
                if (saved) {
                    return JSON.parse(saved);
                }
            } catch (error) {
                // silent fail
            }
            
            return { x: 70, y: 60 };
        }

        _updateSizeSlider(value) {
            this.currentSize = Math.max(this.MIN_SIZE, Math.min(this.MAX_SIZE, value));
            const percent = ((this.currentSize - this.MIN_SIZE) / (this.MAX_SIZE - this.MIN_SIZE)) * 100;
            
            this.elements.sizeTrack.style.width = percent + '%';
            this.elements.sizeHandle.style.left = percent + '%';
            this.elements.sizeDisplay.textContent = this.currentSize.toFixed(1) + 'px';
            
            this.brushSettings.setSize(this.currentSize);
            
            if (this.eventBus) {
                this.eventBus.emit('brush:size-changed', { size: this.currentSize });
            }
        }

        _updateOpacitySlider(value) {
            // ✅ パーセント値として保持
            this.currentOpacity = Math.max(this.MIN_OPACITY, Math.min(this.MAX_OPACITY, value));
            const percent = ((this.currentOpacity - this.MIN_OPACITY) / (this.MAX_OPACITY - this.MIN_OPACITY)) * 100;
            
            this.elements.opacityTrack.style.width = percent + '%';
            this.elements.opacityHandle.style.left = percent + '%';
            this.elements.opacityDisplay.textContent = Math.round(this.currentOpacity) + '%';
            
            // ✅ BrushSettings には 0.0-1.0 として渡す
            this.brushSettings.setOpacity(this.currentOpacity / 100);
            
            if (this.eventBus) {
                this.eventBus.emit('brush:opacity-changed', { opacity: this.currentOpacity / 100 });
            }
        }

        _updateUI() {
            if (!this.brushSettings) return;
            
            // ✅ BrushSettings から正しく初期値取得
            this.currentSize = this.brushSettings.getSize();
            const opacityRaw = this.brushSettings.getOpacity(); // 0.0-1.0
            this.currentOpacity = opacityRaw * 100; // パーセントに変換
            
            // サイズスライダー更新
            const sizePercent = ((this.currentSize - this.MIN_SIZE) / (this.MAX_SIZE - this.MIN_SIZE)) * 100;
            this.elements.sizeTrack.style.width = sizePercent + '%';
            this.elements.sizeHandle.style.left = sizePercent + '%';
            this.elements.sizeDisplay.textContent = this.currentSize.toFixed(1) + 'px';
            
            // 透明度スライダー更新
            const opacityPercent = ((this.currentOpacity - this.MIN_OPACITY) / (this.MAX_OPACITY - this.MIN_OPACITY)) * 100;
            this.elements.opacityTrack.style.width = opacityPercent + '%';
            this.elements.opacityHandle.style.left = opacityPercent + '%';
            this.elements.opacityDisplay.textContent = Math.round(this.currentOpacity) + '%';
            
            // カラーボタン更新
            const currentColor = this.brushSettings.getColor();
            const colorButtons = this.panel.querySelectorAll('.color-button');
            colorButtons.forEach(btn => {
                const btnColor = parseInt(btn.getAttribute('data-color'));
                btn.style.border = btnColor === currentColor 
                    ? '3px solid #ff8c42' 
                    : '2px solid var(--futaba-light-medium)';
            });
        }

        show() {
            if (!this.panel) {
                this._ensurePanelExists();
            }
            
            if (!this.panel) return;
            
            this.panel.classList.add('show');
            this.isVisible = true;
            
            if (!this.initialized) {
                this.initialize();
            } else {
                if (this.brushSettings) {
                    this._updateUI();
                }
            }
            
            if (this.eventBus) {
                this.eventBus.emit('popup:shown', { name: 'quickAccess' });
            }
        }

        hide() {
            if (!this.panel) return;
            this.panel.classList.remove('show');
            this.isVisible = false;
            
            if (this.eventBus) {
                this.eventBus.emit('popup:hidden', { name: 'quickAccess' });
            }
        }

        toggle() {
            if (this.isVisible) {
                this.hide();
            } else {
                this.show();
            }
        }

        isReady() {
            return this.initialized && !!this.panel && !!this.brushSettings;
        }

        destroy() {
            // スライダーイベントリスナーの削除
            if (this.sliderMoveHandler) {
                document.removeEventListener('pointermove', this.sliderMoveHandler);
                document.removeEventListener('pointerup', this.sliderUpHandler);
                document.removeEventListener('pointercancel', this.sliderUpHandler);
                this.sliderMoveHandler = null;
                this.sliderUpHandler = null;
            }
            
            // ドラッグイベントリスナーの削除
            if (this.dragMoveHandler) {
                document.removeEventListener('pointermove', this.dragMoveHandler);
                document.removeEventListener('pointerup', this.dragUpHandler);
                document.removeEventListener('pointercancel', this.dragUpHandler);
                this.dragMoveHandler = null;
                this.dragUpHandler = null;
            }
            
            this.elements = {};
            this.initialized = false;
            this.isDraggingSize = false;
            this.isDraggingOpacity = false;
            this.isDraggingPanel = false;
            this.activeSliderElement = null;
            this.activeDragPointerId = null;
            
            if (this.panel && this.panel.parentNode) {
                this.panel.parentNode.removeChild(this.panel);
            }
            this.panel = null;
            this.isVisible = false;
        }
    }

    if (!window.TegakiUI) {
        window.TegakiUI = {};
    }
    window.TegakiUI.QuickAccessPopup = QuickAccessPopup;

    console.log('✅ quick-access-popup.js (改修版) loaded');
    console.log('   ✓ ペンタブレット対応: pointerdown/pointermove/pointerup');
    console.log('   ✓ スライダーの滑らか性改善');
    console.log('   ✓ 透明度初期値修正: BrushSettings から100%正しく取得');
})();