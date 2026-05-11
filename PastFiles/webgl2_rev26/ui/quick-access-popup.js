/**
 * @file ui/quick-access-popup.js - Phase 7.5.1 黒枠完全削除版
 * @description ペン設定クイックアクセスポップアップ
 * 
 * 【Phase 7.5.1 改修内容】
 * 🎯 フォーカス黒枠完全削除
 * 🔧 pointerdown時の自動blur処理追加
 * 🚫 キーボード操作時の黒枠表示防止
 * 
 * 【Phase 7.5継承】
 * ✅ アクティブ時のSVG色維持
 * ✅ オレンジ枠(#ff8c42)選択表示
 * ✅ v8.13.17全機能継承
 * 
 * 【親ファイル (このファイルが依存)】
 * - system/drawing/brush-settings.js (BrushSettings)
 * - system/event-bus.js (EventBus)
 * - core-runtime.js (CoreRuntime.api.tool)
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
            
            this.isDraggingSize = false;
            this.isDraggingOpacity = false;
            this.isDraggingPanel = false;
            this.dragStartX = 0;
            this.dragStartY = 0;
            this.panelStartX = 0;
            this.panelStartY = 0;
            
            this.elements = {};
            
            this.sliderMoveHandler = null;
            this.sliderUpHandler = null;
            this.dragMoveHandler = null;
            this.dragUpHandler = null;
            
            this.activeSliderElement = null;
            this.activeDragPointerId = null;
            
            this.currentSize = 3;
            this.currentOpacity = 100;
            this.currentTool = 'pen';
            
            this.MIN_SIZE = 0.5;
            this.MAX_SIZE = 30;
            this.MIN_OPACITY = 0;
            this.MAX_OPACITY = 100;
            
            this._ensurePanelExists();
            this._injectStyles();
        }

        _injectStyles() {
            if (document.querySelector('style[data-qa-popup-styles]')) return;

            const style = document.createElement('style');
            style.setAttribute('data-qa-popup-styles', 'true');
            style.textContent = `
                .qa-tool-button {
                    width: 36px;
                    height: 36px;
                    border-radius: 4px;
                    border: 2px solid var(--futaba-light-medium);
                    background: var(--futaba-background);
                    cursor: pointer;
                    transition: all 0.2s ease;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 0;
                }

                .qa-tool-button.active {
                    border: 3px solid #ff8c42 !important;
                    background: var(--futaba-background) !important;
                }

                .qa-tool-button svg {
                    stroke: var(--futaba-maroon) !important;
                }

                .qa-tool-button:hover:not(.active) {
                    border-color: var(--futaba-medium);
                    background: var(--futaba-light-medium);
                }

                /* Phase 7.5.1: フォーカス黒枠完全削除 */
                .color-button:focus,
                .color-button:focus-visible,
                .qa-tool-button:focus,
                .qa-tool-button:focus-visible,
                .resize-arrow-btn:focus,
                .resize-arrow-btn:focus-visible,
                .quick-access-close-btn:focus,
                .quick-access-close-btn:focus-visible {
                    outline: none !important;
                    box-shadow: none !important;
                }
            `;
            document.head.appendChild(style);
        }

        _ensurePanelExists() {
            this.panel = document.getElementById('quick-access-popup');
            
            if (!this.panel) {
                const canvasArea = document.querySelector('.canvas-area');
                if (!canvasArea) return;
                
                this.panel = document.createElement('div');
                this.panel.id = 'quick-access-popup';
                this.panel.className = 'popup-panel resize-popup-compact';
                this.panel.style.touchAction = 'none';
                
                const savedPos = this._loadPosition();
                this.panel.style.cssText += `left: ${savedPos.x}px; top: ${savedPos.y}px;`;
                
                canvasArea.appendChild(this.panel);
            } else {
                this.panel.style.touchAction = 'none';
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
                <button class="quick-access-close-btn" id="quick-access-close-btn" title="閉じる">×</button>

                <!-- 色パレット -->
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

                <!-- ツールアイコン -->
                <div style="margin-bottom: 20px; padding: 0 8px;">
                    <div style="display: flex; gap: 8px; align-items: center;">
                        <button class="qa-tool-button" id="qa-pen-tool" title="ベクターペン">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--futaba-maroon)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
                            </svg>
                        </button>
                        <button class="qa-tool-button" id="qa-eraser-tool" title="消しゴム">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--futaba-maroon)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"/>
                                <path d="M22 21H7"/>
                                <path d="m5 11 9 9"/>
                            </svg>
                        </button>
                        <button class="qa-tool-button" id="qa-fill-tool" title="塗りつぶし">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--futaba-maroon)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                                <path d="m19 11-8-8-8.6 8.6a2 2 0 0 0 0 2.8l5.2 5.2c.8.8 2 .8 2.8 0L19 11Z"/>
                                <path d="m5 2 5 5"/>
                                <path d="M2 13h15"/>
                                <path d="M22 20a2 2 0 1 1-4 0c0-1.6 1.7-2.4 2-4 .3 1.6 2 2.4 2 4Z"/>
                            </svg>
                        </button>
                    </div>
                </div>

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
                penToolBtn: document.getElementById('qa-pen-tool'),
                eraserToolBtn: document.getElementById('qa-eraser-tool'),
                fillToolBtn: document.getElementById('qa-fill-tool'),
                sizeSlider: document.getElementById('pen-size-slider'),
                sizeTrack: document.getElementById('pen-size-track'),
                sizeHandle: document.getElementById('pen-size-handle'),
                sizeDisplay: document.getElementById('pen-size-display'),
                sizeDecrease: document.getElementById('pen-size-decrease'),
                sizeIncrease: document.getElementById('pen-size-increase'),
                opacitySlider: document.getElementById('pen-opacity-slider'),
                opacityTrack: document.getElementById('pen-opacity-track'),
                opacityHandle: document.getElementById('pen-opacity-handle'),
                opacityDisplay: document.getElementById('pen-opacity-display'),
                opacityDecrease: document.getElementById('pen-opacity-decrease'),
                opacityIncrease: document.getElementById('pen-opacity-increase'),
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
            this._setupToolButtons();
            this._setupColorButtons();
            this._setupSliders();
            this._setupPanelDragHandlers();
            this._setupEventListeners();
            this._updateUI();
            
            this.initialized = true;
        }

        _setupCloseButton() {
            if (!this.elements.closeBtn) return;
            
            this.elements.closeBtn.addEventListener('pointerdown', (e) => {
                e.stopPropagation();
                e.target.blur(); // Phase 7.5.1: フォーカス解除
                this.hide();
            });
        }

        _setupToolButtons() {
            if (this.elements.penToolBtn) {
                this.elements.penToolBtn.addEventListener('pointerdown', (e) => {
                    e.target.blur(); // Phase 7.5.1: フォーカス解除
                    this._switchTool('pen');
                });
            }

            if (this.elements.eraserToolBtn) {
                this.elements.eraserToolBtn.addEventListener('pointerdown', (e) => {
                    e.target.blur(); // Phase 7.5.1: フォーカス解除
                    this._switchTool('eraser');
                });
            }

            if (this.elements.fillToolBtn) {
                this.elements.fillToolBtn.addEventListener('pointerdown', (e) => {
                    e.target.blur(); // Phase 7.5.1: フォーカス解除
                    this._switchTool('fill');
                });
            }
        }

        _switchTool(tool) {
            this.currentTool = tool;
            this._updateToolButtons();

            if (window.CoreRuntime?.api?.tool?.set) {
                window.CoreRuntime.api.tool.set(tool);
            }

            if (this.eventBus) {
                this.eventBus.emit('tool:changed', { 
                    tool,
                    component: 'quick-access',
                    action: 'tool-changed'
                });
            }
        }

        _updateToolButtons() {
            const buttons = {
                pen: this.elements.penToolBtn,
                eraser: this.elements.eraserToolBtn,
                fill: this.elements.fillToolBtn
            };

            Object.entries(buttons).forEach(([toolName, btn]) => {
                if (!btn) return;
                
                if (toolName === this.currentTool) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });
        }

        _setupColorButtons() {
            const colorButtons = this.panel.querySelectorAll('.color-button');
            colorButtons.forEach(btn => {
                btn.addEventListener('pointerdown', (e) => {
                    e.target.blur(); // Phase 7.5.1: フォーカス解除
                    
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
            this.sliderMoveHandler = (e) => {
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
            
            document.addEventListener('pointermove', this.sliderMoveHandler, { passive: false, capture: true });
            document.addEventListener('pointerup', this.sliderUpHandler, { capture: true });
            document.addEventListener('pointercancel', this.sliderUpHandler, { capture: true });
            
            const ignoreLeave = (e) => {
                if (this.isDraggingSize || this.isDraggingOpacity) {
                    e.preventDefault();
                    e.stopPropagation();
                    return false;
                }
            };
            document.addEventListener('pointerleave', ignoreLeave, { passive: false, capture: true });
            document.addEventListener('pointerout', ignoreLeave, { passive: false, capture: true });
            
            this.elements.sizeHandle.style.touchAction = 'none';
            this.elements.sizeHandle.addEventListener('pointerdown', (e) => {
                this.isDraggingSize = true;
                this.activeSliderElement = this.elements.sizeHandle;
                this.activeSliderPointerId = e.pointerId;
                
                if (this.elements.sizeHandle.setPointerCapture) {
                    try {
                        this.elements.sizeHandle.setPointerCapture(e.pointerId);
                    } catch (err) {}
                }
                
                e.preventDefault();
                e.stopPropagation();
            });
            
            this.elements.opacityHandle.style.touchAction = 'none';
            this.elements.opacityHandle.addEventListener('pointerdown', (e) => {
                this.isDraggingOpacity = true;
                this.activeSliderElement = this.elements.opacityHandle;
                this.activeSliderPointerId = e.pointerId;
                
                if (this.elements.opacityHandle.setPointerCapture) {
                    try {
                        this.elements.opacityHandle.setPointerCapture(e.pointerId);
                    } catch (err) {}
                }
                
                e.preventDefault();
                e.stopPropagation();
            });
            
            this.elements.sizeSlider.addEventListener('pointerdown', (e) => {
                if (e.target === this.elements.sizeHandle) return;
                const rect = this.elements.sizeSlider.getBoundingClientRect();
                const clientX = e.clientX || (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
                const percent = ((clientX - rect.left) / rect.width) * 100;
                const value = this.MIN_SIZE + ((this.MAX_SIZE - this.MIN_SIZE) * percent / 100);
                this._updateSizeSlider(value);
            });
            
            this.elements.opacitySlider.addEventListener('pointerdown', (e) => {
                if (e.target === this.elements.opacityHandle) return;
                const rect = this.elements.opacitySlider.getBoundingClientRect();
                const clientX = e.clientX || (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
                const percent = ((clientX - rect.left) / rect.width) * 100;
                const value = this.MIN_OPACITY + ((this.MAX_OPACITY - this.MIN_OPACITY) * percent / 100);
                this._updateOpacitySlider(value);
            });
            
            // Phase 7.5.1: 矢印ボタンにもblur追加
            this.elements.sizeDecrease.addEventListener('pointerdown', (e) => {
                e.target.blur();
                const current = this.brushSettings.getSize();
                this._updateSizeSlider(Math.max(this.MIN_SIZE, current - 0.5));
            });
            
            this.elements.sizeIncrease.addEventListener('pointerdown', (e) => {
                e.target.blur();
                const current = this.brushSettings.getSize();
                this._updateSizeSlider(Math.min(this.MAX_SIZE, current + 0.5));
            });
            
            this.elements.opacityDecrease.addEventListener('pointerdown', (e) => {
                e.target.blur();
                const current = this.brushSettings.getOpacity();
                const currentPercent = current * 100;
                this._updateOpacitySlider(Math.max(this.MIN_OPACITY, currentPercent - 5));
            });
            
            this.elements.opacityIncrease.addEventListener('pointerdown', (e) => {
                e.target.blur();
                const current = this.brushSettings.getOpacity();
                const currentPercent = current * 100;
                this._updateOpacitySlider(Math.min(this.MAX_OPACITY, currentPercent + 5));
            });
        }

        _setupPanelDragHandlers() {
            this.panel.addEventListener('pointerdown', (e) => {
                const target = e.target;
                const isInteractive = 
                    target.classList.contains('color-button') ||
                    target.classList.contains('resize-arrow-btn') ||
                    target.classList.contains('resize-slider-handle') ||
                    target.classList.contains('quick-access-close-btn') ||
                    target.classList.contains('qa-tool-button') ||
                    target.closest('.resize-slider') ||
                    target.closest('.color-button') ||
                    target.closest('.resize-arrow-btn') ||
                    target.closest('.quick-access-close-btn') ||
                    target.closest('.qa-tool-button');
                
                if (isInteractive) return;
                
                this.isDraggingPanel = true;
                this.activeDragPointerId = e.pointerId;
                
                this.dragStartX = e.clientX;
                this.dragStartY = e.clientY;
                
                const rect = this.panel.getBoundingClientRect();
                this.panelStartX = rect.left;
                this.panelStartY = rect.top;
                
                this.panel.style.cursor = 'grabbing';
                
                if (this.panel.setPointerCapture) {
                    try {
                        this.panel.setPointerCapture(e.pointerId);
                    } catch (err) {}
                }
                
                e.preventDefault();
            });
            
            this.dragMoveHandler = (e) => {
                if (!this.isDraggingPanel) return;
                
                e.preventDefault();
                e.stopPropagation();
                
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
            
            document.addEventListener('pointermove', this.dragMoveHandler, { passive: false, capture: true });
            document.addEventListener('pointerup', this.dragUpHandler, { capture: true });
            document.addEventListener('pointercancel', this.dragUpHandler, { capture: true });
        }

        _setupEventListeners() {
            if (!this.eventBus) return;

            this.eventBus.on('ui:sidebar:sync-tool', ({ tool }) => {
                this.currentTool = tool;
                this._updateToolButtons();
            });

            this.eventBus.on('tool:select', ({ tool }) => {
                this.currentTool = tool;
                this._updateToolButtons();
            });
        }

        _savePosition(x, y) {
            try {
                localStorage.setItem('quick-access-position', JSON.stringify({ x, y }));
            } catch (error) {}
        }

        _loadPosition() {
            try {
                const saved = localStorage.getItem('quick-access-position');
                if (saved) {
                    return JSON.parse(saved);
                }
            } catch (error) {}
            
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
            this.currentOpacity = Math.max(this.MIN_OPACITY, Math.min(this.MAX_OPACITY, value));
            const percent = ((this.currentOpacity - this.MIN_OPACITY) / (this.MAX_OPACITY - this.MIN_OPACITY)) * 100;
            
            this.elements.opacityTrack.style.width = percent + '%';
            this.elements.opacityHandle.style.left = percent + '%';
            this.elements.opacityDisplay.textContent = Math.round(this.currentOpacity) + '%';
            
            this.brushSettings.setOpacity(this.currentOpacity / 100);
            
            if (this.eventBus) {
                this.eventBus.emit('brush:opacity-changed', { opacity: this.currentOpacity / 100 });
            }
        }

        _updateUI() {
            if (!this.brushSettings) return;
            
            this.currentSize = this.brushSettings.getSize();
            const opacityRaw = this.brushSettings.getOpacity();
            this.currentOpacity = opacityRaw * 100;
            
            const sizePercent = ((this.currentSize - this.MIN_SIZE) / (this.MAX_SIZE - this.MIN_SIZE)) * 100;
            this.elements.sizeTrack.style.width = sizePercent + '%';
            this.elements.sizeHandle.style.left = sizePercent + '%';
            this.elements.sizeDisplay.textContent = this.currentSize.toFixed(1) + 'px';
            
            const opacityPercent = ((this.currentOpacity - this.MIN_OPACITY) / (this.MAX_OPACITY - this.MIN_OPACITY)) * 100;
            this.elements.opacityTrack.style.width = opacityPercent + '%';
            this.elements.opacityHandle.style.left = opacityPercent + '%';
            this.elements.opacityDisplay.textContent = Math.round(this.currentOpacity) + '%';
            
            const currentColor = this.brushSettings.getColor();
            const colorButtons = this.panel.querySelectorAll('.color-button');
            colorButtons.forEach(btn => {
                const btnColor = parseInt(btn.getAttribute('data-color'));
                btn.style.border = btnColor === currentColor 
                    ? '3px solid #ff8c42' 
                    : '2px solid var(--futaba-light-medium)';
            });

            this._updateToolButtons();
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
            if (this.sliderMoveHandler) {
                document.removeEventListener('pointermove', this.sliderMoveHandler);
                document.removeEventListener('pointerup', this.sliderUpHandler);
                document.removeEventListener('pointercancel', this.sliderUpHandler);
                this.sliderMoveHandler = null;
                this.sliderUpHandler = null;
            }
            
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

    console.log('✅ quick-access-popup.js Phase 7.5.1 loaded');
    console.log('   🎯 フォーカス黒枠完全削除');
    console.log('   🔧 pointerdown時の自動blur処理追加');
    console.log('   ✅ v8.13.17全機能継承');

})();