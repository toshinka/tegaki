/**
 * ============================================================================
 * ファイル名: ui/resize-popup.js
 * 責務: キャンバスサイズのリサイズUIとロジックを提供する
 * 依存: system/event-bus.js, system/camera-system.js, system/history.js, ui/popup-drag-helper.js
 * 被依存: core-engine.js, system/popup-manager.js
 * 公開API: ResizePopup
 * イベント発火: なし
 * イベント受信: なし
 * グローバル登録: window.ResizePopup, window.TegakiUI.ResizePopup
 * 実装状態: ♻️移植
 * ============================================================================
 */

import { TegakiEventBus } from '../system/event-bus.js';
import { attachPopupDrag, mountPopupAtOverlayRoot } from './popup-drag-helper.js';

export class ResizePopup {
    constructor(dependencies = {}) {
        this.coreEngine = dependencies.coreEngine;
        this.history = dependencies.history;
        this.eventBus = TegakiEventBus;
        
        this.popup = null;
        this.isVisible = false;
        this.initialized = false;
        
        this.isDraggingWidth = false;
        this.isDraggingHeight = false;
        this.activeSliderPointerId = null;
        this.popupDragCleanup = null;
        
        this.elements = {};
        
        this.currentWidth = 0;
        this.currentHeight = 0;
        this.horizontalAlign = 'center';
        this.verticalAlign = 'center';
        
        const canvasConfig = window.TEGAKI_CONFIG?.canvas || {};
        this.MIN_SIZE = canvasConfig.minSize || 100;
        this.MAX_SIZE = canvasConfig.maxSize || 2500;
        
        this._ensurePopupElement();
    }
    
    _ensurePopupElement() {
        this.popup = document.getElementById('resize-settings');
        
        if (!this.popup) {
            this._createPopupElement();
        } else {
            mountPopupAtOverlayRoot(this.popup);
            this.popup.classList.remove('show');
            this.popup.style.display = '';
            
            if (this.popup.children.length === 0) {
                this._populateContent();
            }
        }
        
        if (this.popup) {
            this.popup.classList.add('resize-popup-compact');
            this.popup.classList.add('popup-panel--translucent');
            this.popup.style.top = '60px';
            this.popup.style.left = '60px';
        }
    }
    
    _createPopupElement() {
        const container = document.querySelector('.main-layout') || document.body;
        if (!container) return;
        
        const popupDiv = document.createElement('div');
        popupDiv.id = 'resize-settings';
        popupDiv.className = 'popup-panel resize-popup-compact popup-panel--translucent';
        popupDiv.style.top = '60px';
        popupDiv.style.left = '60px';
        
        container.appendChild(popupDiv);
        this.popup = popupDiv;
        this._populateContent();
    }
    
    _populateContent() {
        if (!this.popup) return;
        
        // DOMBuilderがあれば閉じるボタンを利用、なければ自前で構築
        const closeBtnHtml = window.DOMBuilder 
            ? window.DOMBuilder.createCloseButton('resize-settings').outerHTML
            : `<button class="ui-close-button ui-close-button--medium popup-close-btn" data-action="close-popup" data-target="resize-settings">
                ${window.UI_ICONS?.close || '×'}
               </button>`;

        this.popup.innerHTML = `
            ${closeBtnHtml}
            <div class="popup-title">キャンバスリサイズ</div>
            
            <div class="resize-compact-group">
                <div class="resize-compact-label">横配置</div>
                <div class="resize-align-row">
                    <button class="resize-align-btn" id="horizontal-align-left">←</button>
                    <button class="resize-align-btn active" id="horizontal-align-center">↔</button>
                    <button class="resize-align-btn" id="horizontal-align-right">→</button>
                </div>
            </div>
            
            <div class="resize-compact-group">
                <div class="resize-compact-label">幅</div>
                <div class="resize-slider-row">
                    <button class="resize-arrow-btn" id="width-decrease">◀</button>
                    <div class="resize-slider" id="canvas-width-slider">
                        <div class="resize-slider-track" id="canvas-width-track"></div>
                        <div class="resize-slider-handle" id="canvas-width-handle"></div>
                    </div>
                    <button class="resize-arrow-btn" id="width-increase">▶</button>
                </div>
                <div class="resize-value-row">
                    <div class="resize-value-display" id="canvas-width-display">344px</div>
                </div>
            </div>
            
            <div class="resize-compact-group">
                <div class="resize-compact-label">縦配置</div>
                <div class="resize-align-row">
                    <button class="resize-align-btn" id="vertical-align-top">↑</button>
                    <button class="resize-align-btn active" id="vertical-align-center">↕</button>
                    <button class="resize-align-btn" id="vertical-align-bottom">↓</button>
                </div>
            </div>
            
            <div class="resize-compact-group">
                <div class="resize-compact-label">高さ</div>
                <div class="resize-slider-row">
                    <button class="resize-arrow-btn" id="height-decrease">◀</button>
                    <div class="resize-slider" id="canvas-height-slider">
                        <div class="resize-slider-track" id="canvas-height-track"></div>
                        <div class="resize-slider-handle" id="canvas-height-handle"></div>
                    </div>
                    <button class="resize-arrow-btn" id="height-increase">▶</button>
                </div>
                <div class="resize-value-row">
                    <div class="resize-value-display" id="canvas-height-display">135px</div>
                </div>
            </div>
            
            <div class="resize-preset-group">
                <button class="resize-preset-btn" data-width="344" data-height="135">
                    ふたば<br>344×135
                </button>
                <button class="resize-preset-btn" data-width="1920" data-height="1080">
                    Full HD<br>1920×1080
                </button>
                <button class="resize-preset-btn" data-width="1280" data-height="720">
                    HD<br>1280×720
                </button>
            </div>
            
            <button class="resize-apply-btn" id="apply-resize">適用</button>
        `;

        // 閉じるボタンのイベント紐付け
        const closeBtn = this.popup.querySelector('.ui-close-button');
        if (closeBtn) {
            closeBtn.onclick = () => this.hide();
        }
    }

    
    _cacheElements() {
        this.elements = {
            widthSlider: document.getElementById('canvas-width-slider'),
            widthTrack: document.getElementById('canvas-width-track'),
            widthHandle: document.getElementById('canvas-width-handle'),
            widthDisplay: document.getElementById('canvas-width-display'),
            widthDecrease: document.getElementById('width-decrease'),
            widthIncrease: document.getElementById('width-increase'),
            
            heightSlider: document.getElementById('canvas-height-slider'),
            heightTrack: document.getElementById('canvas-height-track'),
            heightHandle: document.getElementById('canvas-height-handle'),
            heightDisplay: document.getElementById('canvas-height-display'),
            heightDecrease: document.getElementById('height-decrease'),
            heightIncrease: document.getElementById('height-increase'),
            
            horizontalAlignLeft: document.getElementById('horizontal-align-left'),
            horizontalAlignCenter: document.getElementById('horizontal-align-center'),
            horizontalAlignRight: document.getElementById('horizontal-align-right'),
            verticalAlignTop: document.getElementById('vertical-align-top'),
            verticalAlignCenter: document.getElementById('vertical-align-center'),
            verticalAlignBottom: document.getElementById('vertical-align-bottom'),
            
            applyBtn: document.getElementById('apply-resize')
        };
    }
    
    initialize() {
        if (this.initialized) {
            this._cleanupEventListeners();
        }
        
        const config = window.TEGAKI_CONFIG;
        this.currentWidth = config?.canvas?.width || 344;
        this.currentHeight = config?.canvas?.height || 135;
        
        this._cacheElements();
        this._setupSliders();
        this._setupPopupDrag();
        this._setupAlignmentButtons();
        this._setupPresetButtons();
        this._setupApplyButton();
        
        this._updateUI();
        
        this.initialized = true;
    }
    
    _cleanupEventListeners() {
        if (this._globalMoveHandler) {
            document.removeEventListener('pointermove', this._globalMoveHandler, true);
            document.removeEventListener('pointerup', this._globalUpHandler, true);
            document.removeEventListener('pointercancel', this._globalUpHandler, true);
            this._globalMoveHandler = null;
            this._globalUpHandler = null;
        }
        if (this.popupDragCleanup) {
            this.popupDragCleanup();
            this.popupDragCleanup = null;
        }
    }

    _setupPopupDrag() {
        if (!this.popup) return;

        this.popupDragCleanup = attachPopupDrag(this.popup);
    }
    
    _setupSliders() {
        this.elements.widthHandle.style.touchAction = 'none';
        this.elements.heightHandle.style.touchAction = 'none';
        
        const globalMoveHandler = (e) => {
            if (!this.isDraggingWidth && !this.isDraggingHeight) return;
            
            e.preventDefault();
            e.stopPropagation();
            
            if (this.isDraggingWidth && this.activeSliderPointerId === e.pointerId) {
                const rect = this.elements.widthSlider.getBoundingClientRect();
                const percent = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
                const value = this.MIN_SIZE + ((this.MAX_SIZE - this.MIN_SIZE) * percent / 100);
                this._updateWidthSlider(Math.round(value));
            }
            
            if (this.isDraggingHeight && this.activeSliderPointerId === e.pointerId) {
                const rect = this.elements.heightSlider.getBoundingClientRect();
                const percent = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
                const value = this.MIN_SIZE + ((this.MAX_SIZE - this.MIN_SIZE) * percent / 100);
                this._updateHeightSlider(Math.round(value));
            }
        };
        
        const globalUpHandler = (e) => {
            if (this.activeSliderPointerId !== e.pointerId) return;
            
            if (this.isDraggingWidth && this.elements.widthHandle.releasePointerCapture) {
                try {
                    this.elements.widthHandle.releasePointerCapture(e.pointerId);
                } catch (err) {}
            }
            
            if (this.isDraggingHeight && this.elements.heightHandle.releasePointerCapture) {
                try {
                    this.elements.heightHandle.releasePointerCapture(e.pointerId);
                } catch (err) {}
            }
            
            this.isDraggingWidth = false;
            this.isDraggingHeight = false;
            this.activeSliderPointerId = null;
        };
        
        document.addEventListener('pointermove', globalMoveHandler, { passive: false, capture: true });
        document.addEventListener('pointerup', globalUpHandler, { capture: true });
        document.addEventListener('pointercancel', globalUpHandler, { capture: true });
        
        this._globalMoveHandler = globalMoveHandler;
        this._globalUpHandler = globalUpHandler;
        
        this.elements.widthHandle.addEventListener('pointerdown', (e) => {
            this.isDraggingWidth = true;
            this.activeSliderPointerId = e.pointerId;
            
            if (this.elements.widthHandle.setPointerCapture) {
                try {
                    this.elements.widthHandle.setPointerCapture(e.pointerId);
                } catch (err) {}
            }
            
            e.preventDefault();
            e.stopPropagation();
        });
        
        this.elements.heightHandle.addEventListener('pointerdown', (e) => {
            this.isDraggingHeight = true;
            this.activeSliderPointerId = e.pointerId;
            
            if (this.elements.heightHandle.setPointerCapture) {
                try {
                    this.elements.heightHandle.setPointerCapture(e.pointerId);
                } catch (err) {}
            }
            
            e.preventDefault();
            e.stopPropagation();
        });
        
        this.elements.widthSlider.addEventListener('pointerdown', (e) => {
            if (e.target === this.elements.widthHandle) return;
            const rect = this.elements.widthSlider.getBoundingClientRect();
            const percent = ((e.clientX - rect.left) / rect.width) * 100;
            const value = this.MIN_SIZE + ((this.MAX_SIZE - this.MIN_SIZE) * percent / 100);
            this._updateWidthSlider(Math.round(value));
        });
        
        this.elements.heightSlider.addEventListener('pointerdown', (e) => {
            if (e.target === this.elements.heightHandle) return;
            const rect = this.elements.heightSlider.getBoundingClientRect();
            const percent = ((e.clientX - rect.left) / rect.width) * 100;
            const value = this.MIN_SIZE + ((this.MAX_SIZE - this.MIN_SIZE) * percent / 100);
            this._updateHeightSlider(Math.round(value));
        });
        
        this.elements.widthDecrease.addEventListener('pointerdown', () => {
            this._updateWidthSlider(this.currentWidth - 1);
        });
        
        this.elements.widthIncrease.addEventListener('pointerdown', () => {
            this._updateWidthSlider(this.currentWidth + 1);
        });
        
        this.elements.heightDecrease.addEventListener('pointerdown', () => {
            this._updateHeightSlider(this.currentHeight - 1);
        });
        
        this.elements.heightIncrease.addEventListener('pointerdown', () => {
            this._updateHeightSlider(this.currentHeight + 1);
        });
    }
    
    _updateWidthSlider(value) {
        this.currentWidth = Math.max(this.MIN_SIZE, Math.min(this.MAX_SIZE, value));
        const percent = ((this.currentWidth - this.MIN_SIZE) / (this.MAX_SIZE - this.MIN_SIZE)) * 100;
        this.elements.widthTrack.style.width = percent + '%';
        this.elements.widthHandle.style.left = percent + '%';
        this.elements.widthDisplay.textContent = this.currentWidth + 'px';
    }
    
    _updateHeightSlider(value) {
        this.currentHeight = Math.max(this.MIN_SIZE, Math.min(this.MAX_SIZE, value));
        const percent = ((this.currentHeight - this.MIN_SIZE) / (this.MAX_SIZE - this.MIN_SIZE)) * 100;
        this.elements.heightTrack.style.width = percent + '%';
        this.elements.heightHandle.style.left = percent + '%';
        this.elements.heightDisplay.textContent = this.currentHeight + 'px';
    }
    
    _setupAlignmentButtons() {
        if (this.elements.horizontalAlignLeft) {
            this.elements.horizontalAlignLeft.addEventListener('pointerdown', () => this._setHorizontalAlign('left'));
        }
        if (this.elements.horizontalAlignCenter) {
            this.elements.horizontalAlignCenter.addEventListener('pointerdown', () => this._setHorizontalAlign('center'));
        }
        if (this.elements.horizontalAlignRight) {
            this.elements.horizontalAlignRight.addEventListener('pointerdown', () => this._setHorizontalAlign('right'));
        }
        
        if (this.elements.verticalAlignTop) {
            this.elements.verticalAlignTop.addEventListener('pointerdown', () => this._setVerticalAlign('top'));
        }
        if (this.elements.verticalAlignCenter) {
            this.elements.verticalAlignCenter.addEventListener('pointerdown', () => this._setVerticalAlign('center'));
        }
        if (this.elements.verticalAlignBottom) {
            this.elements.verticalAlignBottom.addEventListener('pointerdown', () => this._setVerticalAlign('bottom'));
        }
    }
    
    _setHorizontalAlign(align) {
        this.horizontalAlign = align;
        
        document.querySelectorAll('#horizontal-align-left, #horizontal-align-center, #horizontal-align-right').forEach(btn => {
            btn.classList.remove('active');
        });
        
        const btn = document.getElementById(`horizontal-align-${align}`);
        if (btn) btn.classList.add('active');
    }
    
    _setVerticalAlign(align) {
        this.verticalAlign = align;
        
        document.querySelectorAll('#vertical-align-top, #vertical-align-center, #vertical-align-bottom').forEach(btn => {
            btn.classList.remove('active');
        });
        
        const btn = document.getElementById(`vertical-align-${align}`);
        if (btn) btn.classList.add('active');
    }
    
    _setupPresetButtons() {
        const presetBtns = document.querySelectorAll('.resize-preset-btn');
        presetBtns.forEach(btn => {
            btn.addEventListener('pointerdown', () => {
                const width = parseInt(btn.getAttribute('data-width'));
                const height = parseInt(btn.getAttribute('data-height'));
                
                this._updateWidthSlider(width);
                this._updateHeightSlider(height);
            });
        });
    }
    
    _setupApplyButton() {
        if (!this.elements.applyBtn) return;
        
        this.elements.applyBtn.addEventListener('pointerdown', () => {
            this._applyResize();
        });
    }
    
    _applyResize() {
        if (!this.coreEngine || !this.history) return;
        if (this.currentWidth <= 0 || this.currentHeight <= 0) return;
        
        const newWidth = this.currentWidth;
        const newHeight = this.currentHeight;
        
        const alignOptions = this._getResizeAlignOptions();
        
        const oldWidth = window.TEGAKI_CONFIG.canvas.width;
        const oldHeight = window.TEGAKI_CONFIG.canvas.height;
        
        const command = {
            name: 'resize-canvas',
            do: () => {
                if (window.TEGAKI_CONFIG?.debug) {
                    console.log(`[ResizePopup] do: resize-canvas ${oldWidth}x${oldHeight} -> ${newWidth}x${newHeight}`, alignOptions);
                }
                this.coreEngine.getCameraSystem().resizeCanvas(newWidth, newHeight, alignOptions);
                
                const canvasInfoElement = document.getElementById('canvas-info');
                if (canvasInfoElement) {
                    canvasInfoElement.textContent = `${newWidth}×${newHeight}px`;
                }
            },
            undo: () => {
                if (window.TEGAKI_CONFIG?.debug) {
                    console.log(`[ResizePopup] undo: resize-canvas ${newWidth}x${newHeight} -> ${oldWidth}x${oldHeight}`, alignOptions);
                }
                this.coreEngine.getCameraSystem().resizeCanvas(oldWidth, oldHeight, alignOptions);
                
                const canvasInfoElement = document.getElementById('canvas-info');
                if (canvasInfoElement) {
                    canvasInfoElement.textContent = `${oldWidth}×${oldHeight}px`;
                }
            },
            meta: { 
                type: 'resize-canvas', 
                from: { width: oldWidth, height: oldHeight },
                to: { width: newWidth, height: newHeight },
                align: alignOptions
            }
        };
        
        this.history.push(command);
        this.hide();
    }

    _getResizeAlignOptions() {
        return {
            // UI上の矢印は「その方向へキャンバスを増減する」意味にする。
            // LayerSystem側は「旧内容を新キャンバス内のどこへ固定するか」なので左右上下を反転して渡す。
            horizontal: this.horizontalAlign === 'left' ? 'right' :
                        this.horizontalAlign === 'right' ? 'left' : 'center',
            vertical: this.verticalAlign === 'top' ? 'bottom' :
                      this.verticalAlign === 'bottom' ? 'top' : 'center'
        };
    }
    
    _updateUI() {
        this._updateWidthSlider(this.currentWidth);
        this._updateHeightSlider(this.currentHeight);
        this._setHorizontalAlign(this.horizontalAlign);
        this._setVerticalAlign(this.verticalAlign);
    }
    
    show() {
        if (!this.popup) {
            this._ensurePopupElement();
        }
        
        if (!this.popup) return;
        
        this.popup.classList.add('show');
        this.isVisible = true;
        
        requestAnimationFrame(() => {
            const config = window.TEGAKI_CONFIG;
            this.currentWidth = config?.canvas?.width || 344;
            this.currentHeight = config?.canvas?.height || 135;
            
            if (!this.initialized) {
                this.initialize();
            } else {
                this._updateUI();
            }
        });
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
    
    destroy() {
        this._cleanupEventListeners();
        this.elements = {};
        this.initialized = false;
        this.isDraggingWidth = false;
        this.isDraggingHeight = false;
        this.activeSliderPointerId = null;
    }
}

// 下位互換性のためにグローバルに登録
window.ResizePopup = ResizePopup;
window.TegakiUI = window.TegakiUI || {};
window.TegakiUI.ResizePopup = ResizePopup;
