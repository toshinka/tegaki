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
import {
    rebaseNormalizedAnchorForCanvasResize,
    resolveCanvasResizeOffset,
    validateRasterSurfaceSize
} from '../system/raster-bounds.js';
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
        this.resizeTarget = 'canvas';
        this.contentFitMode = 'fit';
        this.contentScalePercent = 100;
        this._contentPreviewCache = null;
        this._directValueTapState = null;
        this.CONTENT_SCALE_MIN = 5;
        this.CONTENT_SCALE_MAX = 800;
        
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
            
            if (!this._hasCurrentMarkup()) {
                this._populateContent();
                this.initialized = false;
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
            <div class="popup-title">リサイズ</div>

            <div class="resize-popup-grid">
                <div class="resize-control-pane">
                    <div class="resize-compact-group">
                        <div class="resize-compact-label">リサイズ対象</div>
                        <div class="resize-mode-row">
                            <button class="resize-mode-btn active" id="resize-target-canvas" data-resize-target="canvas">キャンバス</button>
                            <button class="resize-mode-btn" id="resize-target-content" data-resize-target="content">内容</button>
                            <button class="resize-mode-btn" id="resize-target-both" data-resize-target="both">両方</button>
                        </div>
                    </div>

                    <div class="resize-compact-group" id="resize-content-fit-group">
                        <div class="resize-compact-label">内容の合わせ方</div>
                        <div class="resize-mode-row resize-mode-row--four">
                            <button class="resize-mode-btn" id="resize-fit-width" data-content-fit="width">幅</button>
                            <button class="resize-mode-btn" id="resize-fit-height" data-content-fit="height">高さ</button>
                            <button class="resize-mode-btn active" id="resize-fit-fit" data-content-fit="fit">全体</button>
                            <button class="resize-mode-btn" id="resize-fit-cover" data-content-fit="cover">見切れ</button>
                        </div>
                    </div>
                    
                    <div class="resize-compact-group" id="resize-horizontal-align-group">
                        <div class="resize-compact-label">横配置</div>
                        <div class="resize-align-row">
                            <button class="resize-align-btn" id="horizontal-align-left">←</button>
                            <button class="resize-align-btn active" id="horizontal-align-center">↔</button>
                            <button class="resize-align-btn" id="horizontal-align-right">→</button>
                        </div>
                    </div>
                    
                    <div class="resize-compact-group" id="resize-width-group">
                        <div class="resize-compact-label" id="resize-width-label">幅</div>
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
                    
                    <div class="resize-compact-group" id="resize-vertical-align-group">
                        <div class="resize-compact-label">縦配置</div>
                        <div class="resize-align-row">
                            <button class="resize-align-btn" id="vertical-align-top">↑</button>
                            <button class="resize-align-btn active" id="vertical-align-center">↕</button>
                            <button class="resize-align-btn" id="vertical-align-bottom">↓</button>
                        </div>
                    </div>
                    
                    <div class="resize-compact-group" id="resize-height-group">
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
                    
                    <div class="resize-preset-group" id="resize-preset-group">
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
                </div>

                <div class="resize-preview" id="resize-content-preview" aria-hidden="true">
                    <div class="resize-compact-label resize-preview-label">プレビュー</div>
                    <div class="resize-preview-frame">
                        <img class="resize-preview-image" id="resize-preview-image" alt="">
                        <div class="resize-preview-content" id="resize-preview-content-box"></div>
                    </div>
                    <div class="resize-preview-note" id="resize-preview-note">枠と内容位置を表示</div>
                </div>
            </div>
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
            widthLabel: document.getElementById('resize-width-label'),
            widthGroup: document.getElementById('resize-width-group'),
            widthDecrease: document.getElementById('width-decrease'),
            widthIncrease: document.getElementById('width-increase'),
            
            heightSlider: document.getElementById('canvas-height-slider'),
            heightTrack: document.getElementById('canvas-height-track'),
            heightHandle: document.getElementById('canvas-height-handle'),
            heightDisplay: document.getElementById('canvas-height-display'),
            heightGroup: document.getElementById('resize-height-group'),
            heightDecrease: document.getElementById('height-decrease'),
            heightIncrease: document.getElementById('height-increase'),
            
            horizontalAlignGroup: document.getElementById('resize-horizontal-align-group'),
            horizontalAlignLeft: document.getElementById('horizontal-align-left'),
            horizontalAlignCenter: document.getElementById('horizontal-align-center'),
            horizontalAlignRight: document.getElementById('horizontal-align-right'),
            verticalAlignGroup: document.getElementById('resize-vertical-align-group'),
            verticalAlignTop: document.getElementById('vertical-align-top'),
            verticalAlignCenter: document.getElementById('vertical-align-center'),
            verticalAlignBottom: document.getElementById('vertical-align-bottom'),

            resizeTargetButtons: Array.from(this.popup?.querySelectorAll('[data-resize-target]') || []),
            contentFitButtons: Array.from(this.popup?.querySelectorAll('[data-content-fit]') || []),
            contentFitGroup: document.getElementById('resize-content-fit-group'),
            preview: document.getElementById('resize-content-preview'),
            previewImage: document.getElementById('resize-preview-image'),
            previewContentBox: document.getElementById('resize-preview-content-box'),
            previewNote: document.getElementById('resize-preview-note'),
            presetGroup: document.getElementById('resize-preset-group'),
            
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
        this._setupTargetModeButtons();
        this._setupPresetButtons();
        this._setupDirectValueInputs();
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

    _isContentScaleMode() {
        return this.resizeTarget === 'content';
    }

    _clampContentScalePercent(value) {
        return Math.max(this.CONTENT_SCALE_MIN, Math.min(this.CONTENT_SCALE_MAX, value));
    }

    _valueFromSliderPercent(percent, axis) {
        const safePercent = Math.max(0, Math.min(100, percent));
        if (this._isContentScaleMode()) {
            return this.CONTENT_SCALE_MIN + ((this.CONTENT_SCALE_MAX - this.CONTENT_SCALE_MIN) * safePercent / 100);
        }
        const min = this.MIN_SIZE;
        const max = this.MAX_SIZE;
        return min + ((max - min) * safePercent / 100);
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
                const value = this._valueFromSliderPercent(percent, 'width');
                this._updateWidthSlider(Math.round(value));
            }
            
            if (this.isDraggingHeight && this.activeSliderPointerId === e.pointerId) {
                const rect = this.elements.heightSlider.getBoundingClientRect();
                const percent = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
                const value = this._valueFromSliderPercent(percent, 'height');
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
            const value = this._valueFromSliderPercent(percent, 'width');
            this._updateWidthSlider(Math.round(value));
        });
        
        this.elements.heightSlider.addEventListener('pointerdown', (e) => {
            if (e.target === this.elements.heightHandle) return;
            const rect = this.elements.heightSlider.getBoundingClientRect();
            const percent = ((e.clientX - rect.left) / rect.width) * 100;
            const value = this._valueFromSliderPercent(percent, 'height');
            this._updateHeightSlider(Math.round(value));
        });
        
        this.elements.widthDecrease.addEventListener('pointerdown', () => {
            this._updateWidthSlider(this._isContentScaleMode() ? this.contentScalePercent - 5 : this.currentWidth - 1);
        });
        
        this.elements.widthIncrease.addEventListener('pointerdown', () => {
            this._updateWidthSlider(this._isContentScaleMode() ? this.contentScalePercent + 5 : this.currentWidth + 1);
        });
        
        this.elements.heightDecrease.addEventListener('pointerdown', () => {
            this._updateHeightSlider(this.currentHeight - 1);
        });
        
        this.elements.heightIncrease.addEventListener('pointerdown', () => {
            this._updateHeightSlider(this.currentHeight + 1);
        });
    }

    _setupDirectValueInputs() {
        this._setupDirectValueInputTarget(this.elements.widthDisplay, 'width');
        this._setupDirectValueInputTarget(this.elements.heightDisplay, 'height');
        this.elements.widthDisplay?.setAttribute('title', 'ダブルクリックで数値入力');
        this.elements.heightDisplay?.setAttribute('title', 'ダブルクリックで数値入力');
    }

    _setupDirectValueInputTarget(display, axis) {
        if (!display) return;
        const beginEdit = (event) => {
            event?.preventDefault?.();
            event?.stopPropagation?.();
            this._beginDirectValueEdit(axis);
        };
        display.addEventListener('dblclick', beginEdit);
        display.addEventListener('click', (event) => {
            if (event.detail >= 2) beginEdit(event);
        });
        display.addEventListener('pointerup', (event) => {
            if (event.button !== 0 || display.querySelector('input')) return;
            const now = Date.now();
            const last = this._directValueTapState;
            const sameTarget = last
                && last.axis === axis
                && last.pointerType === event.pointerType
                && now - last.time <= 520
                && Math.abs(event.clientX - last.x) <= 8
                && Math.abs(event.clientY - last.y) <= 8;
            if (sameTarget) {
                this._directValueTapState = null;
                beginEdit(event);
                return;
            }
            this._directValueTapState = {
                axis,
                pointerType: event.pointerType || 'mouse',
                time: now,
                x: event.clientX,
                y: event.clientY
            };
        });
    }

    _beginDirectValueEdit(axis) {
        const display = axis === 'height' ? this.elements.heightDisplay : this.elements.widthDisplay;
        if (!display || display.querySelector('input')) return;
        if (axis === 'height' && this._isContentScaleMode()) return;

        const isScale = this._isContentScaleMode() && axis === 'width';
        const currentValue = isScale
            ? Math.round(this.contentScalePercent)
            : axis === 'height'
                ? Math.round(this.currentHeight)
                : Math.round(this.currentWidth);
        const suffix = isScale ? '%' : 'px';
        const min = isScale ? this.CONTENT_SCALE_MIN : this.MIN_SIZE;
        const max = isScale ? this.CONTENT_SCALE_MAX : this.MAX_SIZE;
        const previousText = display.textContent;

        const input = document.createElement('input');
        input.className = 'resize-value-input';
        input.type = 'number';
        input.inputMode = 'numeric';
        input.min = String(min);
        input.max = String(max);
        input.step = isScale ? '1' : '1';
        input.value = String(currentValue);
        input.setAttribute('aria-label', `${axis === 'height' ? '高さ' : isScale ? '拡縮' : '幅'}を入力`);

        let committed = false;
        const finish = (shouldCommit) => {
            if (committed) return;
            committed = true;
            const rawValue = String(input.value || '').trim();
            const numeric = rawValue === '' ? NaN : Number(rawValue);
            display.textContent = previousText || `${currentValue}${suffix}`;
            if (shouldCommit && Number.isFinite(numeric)) {
                const nextValue = Math.max(min, Math.min(max, Math.round(numeric)));
                if (axis === 'height') {
                    this._updateHeightSlider(nextValue);
                } else {
                    this._updateWidthSlider(nextValue);
                }
            } else {
                if (axis === 'height') this._updateHeightSlider(this.currentHeight);
                else this._updateWidthSlider(isScale ? this.contentScalePercent : this.currentWidth);
            }
        };

        input.addEventListener('pointerdown', (event) => {
            event.stopPropagation();
        });
        input.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                finish(true);
            } else if (event.key === 'Escape') {
                event.preventDefault();
                finish(false);
            }
        });
        input.addEventListener('blur', () => finish(true));

        display.textContent = '';
        display.appendChild(input);
        input.focus();
        input.select();
    }
    
    _updateWidthSlider(value) {
        if (this._isContentScaleMode()) {
            this.contentScalePercent = this._clampContentScalePercent(value);
            const bounds = this._getContentPreviewCache().bounds;
            if (bounds) {
                this.currentWidth = Math.max(1, Math.round(bounds.width * this.contentScalePercent / 100));
                this.currentHeight = Math.max(1, Math.round(bounds.height * this.contentScalePercent / 100));
            }
            const percent = ((this.contentScalePercent - this.CONTENT_SCALE_MIN) / (this.CONTENT_SCALE_MAX - this.CONTENT_SCALE_MIN)) * 100;
            this.elements.widthTrack.style.width = percent + '%';
            this.elements.widthHandle.style.left = percent + '%';
            this.elements.widthDisplay.textContent = `${Math.round(this.contentScalePercent)}%`;
            if (this.elements.heightDisplay) {
                this.elements.heightDisplay.textContent = `${this.currentWidth}×${this.currentHeight}px`;
            }
            this._updateResizePreview();
            return;
        }
        this.currentWidth = Math.max(this.MIN_SIZE, Math.min(this.MAX_SIZE, value));
        const percent = ((this.currentWidth - this.MIN_SIZE) / (this.MAX_SIZE - this.MIN_SIZE)) * 100;
        this.elements.widthTrack.style.width = percent + '%';
        this.elements.widthHandle.style.left = percent + '%';
        this.elements.widthDisplay.textContent = this.currentWidth + 'px';
        this._updateResizePreview();
    }
    
    _updateHeightSlider(value) {
        if (this._isContentScaleMode()) {
            this._updateWidthSlider(this.contentScalePercent);
            return;
        }
        this.currentHeight = Math.max(this.MIN_SIZE, Math.min(this.MAX_SIZE, value));
        const percent = ((this.currentHeight - this.MIN_SIZE) / (this.MAX_SIZE - this.MIN_SIZE)) * 100;
        this.elements.heightTrack.style.width = percent + '%';
        this.elements.heightHandle.style.left = percent + '%';
        this.elements.heightDisplay.textContent = this.currentHeight + 'px';
        this._updateResizePreview();
    }

    _setupTargetModeButtons() {
        this.elements.resizeTargetButtons.forEach(button => {
            button.addEventListener('pointerdown', () => {
                this._setResizeTarget(button.dataset.resizeTarget || 'canvas');
            });
        });
        this.elements.contentFitButtons.forEach(button => {
            button.addEventListener('pointerdown', () => {
                this._setContentFitMode(button.dataset.contentFit || 'fit');
            });
        });
    }

    _setResizeTarget(target) {
        const previousTarget = this.resizeTarget;
        this.resizeTarget = ['canvas', 'content', 'both'].includes(target) ? target : 'canvas';
        this.elements.resizeTargetButtons.forEach(button => {
            button.classList.toggle('active', button.dataset.resizeTarget === this.resizeTarget);
        });
        const contentMode = this.resizeTarget !== 'canvas';
        const contentScaleMode = this._isContentScaleMode();
        this.elements.contentFitGroup?.classList.toggle('is-hidden', !contentMode);
        this.elements.preview?.classList.remove('is-hidden');
        this.elements.heightGroup?.classList.toggle('is-hidden', contentScaleMode);
        this.elements.presetGroup?.classList.toggle('is-hidden', contentScaleMode);
        if (this.elements.widthLabel) {
            this.elements.widthLabel.textContent = contentScaleMode ? '拡縮' : '幅';
        }
        if (contentScaleMode) {
            if (previousTarget !== 'content') {
                this.contentScalePercent = 100;
            }
            this._updateWidthSlider(this.contentScalePercent);
        } else {
            if (previousTarget === 'content') {
                const config = window.TEGAKI_CONFIG;
                this.currentWidth = config?.canvas?.width || this.currentWidth || 344;
                this.currentHeight = config?.canvas?.height || this.currentHeight || 135;
            }
            this._updateWidthSlider(this.currentWidth);
            this._updateHeightSlider(this.currentHeight);
        }
        this._updateResizePreview();
    }

    _setContentFitMode(mode) {
        this.contentFitMode = ['width', 'height', 'fit', 'cover'].includes(mode) ? mode : 'fit';
        this.elements.contentFitButtons.forEach(button => {
            button.classList.toggle('active', button.dataset.contentFit === this.contentFitMode);
        });
        if (this._isContentScaleMode()) {
            const bounds = this._getContentPreviewCache().bounds;
            const frameWidth = window.TEGAKI_CONFIG?.canvas?.width || this.currentWidth || 1;
            const frameHeight = window.TEGAKI_CONFIG?.canvas?.height || this.currentHeight || 1;
            if (bounds) {
                const widthScale = frameWidth / Math.max(1, bounds.width) * 100;
                const heightScale = frameHeight / Math.max(1, bounds.height) * 100;
                let nextScale = Math.min(widthScale, heightScale);
                if (this.contentFitMode === 'width') nextScale = widthScale;
                else if (this.contentFitMode === 'height') nextScale = heightScale;
                else if (this.contentFitMode === 'cover') nextScale = Math.max(widthScale, heightScale);
                this._updateWidthSlider(Math.round(nextScale));
            }
        }
        this._updateResizePreview();
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
        this._updateResizePreview();
    }
    
    _setVerticalAlign(align) {
        this.verticalAlign = align;
        
        document.querySelectorAll('#vertical-align-top, #vertical-align-center, #vertical-align-bottom').forEach(btn => {
            btn.classList.remove('active');
        });
        
        const btn = document.getElementById(`vertical-align-${align}`);
        if (btn) btn.classList.add('active');
        this._updateResizePreview();
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
        
        this.elements.applyBtn.addEventListener('pointerdown', (event) => {
            event.preventDefault();
            event.stopImmediatePropagation();
            this._applyResize();
        });
        this.elements.applyBtn.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopImmediatePropagation();
        });
    }
    
    _applyResize() {
        if (!this.coreEngine || !this.history) return;
        if (this.currentWidth <= 0 || this.currentHeight <= 0) return;
        
        const newWidth = this.currentWidth;
        const newHeight = this.currentHeight;
        const shouldResizeCanvas = this.resizeTarget === 'canvas' || this.resizeTarget === 'both';
        const requestedScaleContent = this.resizeTarget === 'content' || this.resizeTarget === 'both';
        const hasContentBounds = requestedScaleContent ? !!this._getContentPreviewCache().bounds : false;
        const shouldScaleContent = requestedScaleContent && hasContentBounds;
        const alignOptions = this._getResizeAlignOptions();
        
        const oldWidth = window.TEGAKI_CONFIG.canvas.width;
        const oldHeight = window.TEGAKI_CONFIG.canvas.height;
        if (!shouldResizeCanvas && !shouldScaleContent) return;
        if (shouldResizeCanvas && oldWidth === newWidth && oldHeight === newHeight && !shouldScaleContent) {
            this.hide();
            return;
        }

        const animationTable = this._getAnimationTable();
        if (shouldScaleContent) {
            // animation working Layerは保存正本ではなくadapterである。未保存strokeだけを
            // DrawingSnapshotへ戻してから、以降は正本snapshotだけをresize sourceにする。
            animationTable?._saveSelectedClipFromWorkingLayers?.();
        }

        const contentPlan = shouldScaleContent
            ? this._prepareContentResizePlan({
                targetWidth: newWidth,
                targetHeight: newHeight,
                frameWidth: shouldResizeCanvas ? newWidth : oldWidth,
                frameHeight: shouldResizeCanvas ? newHeight : oldHeight,
                oldFrameWidth: oldWidth,
                oldFrameHeight: oldHeight,
                fitMode: this.contentFitMode,
                horizontalAlign: this.horizontalAlign,
                verticalAlign: this.verticalAlign
            })
            : null;
        if (shouldScaleContent && !contentPlan?.ok) {
            this._showResizeFailure(contentPlan?.reason || '内容を変換できませんでした');
            return;
        }

        const metadataOnlyHistory = !shouldScaleContent;
        const beforeState = this._captureResizeHistoryState({ metadataOnly: metadataOnlyHistory });
        const applyOperation = () => {
            if (shouldResizeCanvas) {
                this.coreEngine.getCameraSystem().resizeCanvas(newWidth, newHeight, alignOptions);
                this._translateAnimationRasterBoundsForCanvasResize({
                    oldWidth,
                    oldHeight,
                    newWidth,
                    newHeight,
                    alignOptions
                });
            }
            if (shouldScaleContent) {
                if (!this._applyContentResizePlan(contentPlan)) return false;
            }
            this._updateCanvasInfo();
            return true;
        };

        let applied = false;
        try {
            applied = applyOperation();
        } catch (error) {
            console.error('[ResizePopup] resize transaction failed', error);
        }
        if (!applied) {
            this._restoreResizeHistoryState(beforeState, alignOptions);
            this._showResizeFailure('変換処理を完了できなかったため元の状態へ戻しました');
            return;
        }
        const afterState = this._captureResizeHistoryState({ metadataOnly: metadataOnlyHistory });
        const seenHistoryBuffers = new Set();
        const byteSize = this._estimateResizeHistoryBytes(beforeState, seenHistoryBuffers)
            + this._estimateResizeHistoryBytes(afterState, seenHistoryBuffers);
        
        const command = {
            name: shouldScaleContent ? (shouldResizeCanvas ? 'resize-canvas-and-content' : 'resize-content') : 'resize-canvas',
            do: () => this._restoreResizeHistoryState(afterState, alignOptions),
            undo: () => this._restoreResizeHistoryState(beforeState, alignOptions),
            byteSize,
            meta: { 
                type: shouldScaleContent ? (shouldResizeCanvas ? 'resize-canvas-and-content' : 'resize-content') : 'resize-canvas',
                from: { width: oldWidth, height: oldHeight },
                to: { width: shouldResizeCanvas ? newWidth : oldWidth, height: shouldResizeCanvas ? newHeight : oldHeight },
                align: alignOptions,
                target: this.resizeTarget,
                contentFitMode: shouldScaleContent ? this.contentFitMode : null,
                estimatedHistoryBytes: contentPlan?.estimatedHistoryBytes || byteSize
            }
        };
        
        this.history.record(command);
        this._contentPreviewCache = null;
        this.hide();
    }

    _showResizeFailure(reason) {
        const message = `リサイズを中止しました: ${reason}`;
        if (window.projectManager?._showSaveToast) {
            window.projectManager._showSaveToast(message);
        } else {
            console.warn(`[ResizePopup] ${message}`);
        }
    }

    _translateAnimationRasterBoundsForCanvasResize(options = {}) {
        const animationTable = this._getAnimationTable();
        if (!animationTable?.model) return false;
        const snapshots = animationTable?.model?.drawingSnapshots || [];

        const horizontal = options.alignOptions?.horizontal || 'center';
        const vertical = options.alignOptions?.vertical || 'center';
        const offsetX = resolveCanvasResizeOffset(options.oldWidth, options.newWidth, horizontal);
        const offsetY = resolveCanvasResizeOffset(options.oldHeight, options.newHeight, vertical);

        snapshots.forEach(snapshot => {
            if (!snapshot) return;
            const width = Math.max(1, Math.round(snapshot.width || snapshot.rasterBounds?.width || 1));
            const height = Math.max(1, Math.round(snapshot.height || snapshot.rasterBounds?.height || 1));
            const bounds = snapshot.rasterBounds || { x: 0, y: 0, width, height };
            snapshot.rasterBounds = {
                x: (Number(bounds.x) || 0) + offsetX,
                y: (Number(bounds.y) || 0) + offsetY,
                width,
                height
            };
            snapshot.updatedAt = Date.now();
        });
        (animationTable.model.tracks || []).forEach(lane => {
            (lane?.cels || []).forEach(clip => {
                const transform = clip?.transform;
                if (transform) {
                    transform.anchorX = rebaseNormalizedAnchorForCanvasResize(
                        options.oldWidth,
                        options.newWidth,
                        transform.anchorX,
                        offsetX
                    );
                    transform.anchorY = rebaseNormalizedAnchorForCanvasResize(
                        options.oldHeight,
                        options.newHeight,
                        transform.anchorY,
                        offsetY
                    );
                }
                if (clip?.rasterSnapshot) {
                    const snapshot = clip.rasterSnapshot;
                    const width = Math.max(1, Math.round(snapshot.width || snapshot.rasterBounds?.width || 1));
                    const height = Math.max(1, Math.round(snapshot.height || snapshot.rasterBounds?.height || 1));
                    const bounds = snapshot.rasterBounds || { x: 0, y: 0, width, height };
                    snapshot.rasterBounds = {
                        x: (Number(bounds.x) || 0) + offsetX,
                        y: (Number(bounds.y) || 0) + offsetY,
                        width,
                        height
                    };
                }
            });
        });
        animationTable._invalidateSnapshotTextureCache?.();
        animationTable._syncSelectedClipToWorkingLayers?.({ forceRestore: true });
        return true;
    }

    _captureResizeHistoryState(options = {}) {
        const layerSystem = this.coreEngine?.getLayerSystem?.() || window.layerManager;
        const animationTable = this._getAnimationTable();
        const hasAnimationState = this._hasAnimationResizeState(animationTable);
        const layers = layerSystem?.getLayers?.() || [];
        if (options.metadataOnly === true) {
            return {
                kind: 'metadata',
                width: window.TEGAKI_CONFIG?.canvas?.width || 1,
                height: window.TEGAKI_CONFIG?.canvas?.height || 1,
                layerMetadata: layers
                    .filter(layer => this._isResizableRasterLayer(layer))
                    .filter(layer => layer.layerData?.isAnimationWorkingLayer !== true)
                    .map(layer => ({
                        layerId: layer.layerData.id,
                        rasterBounds: { ...layer.layerData.rasterBounds }
                    })),
                animationMetadata: hasAnimationState
                    ? this._captureAnimationResizeMetadataState(animationTable)
                    : null
            };
        }
        const layerSnapshots = layers
            .filter(layer => this._isResizableRasterLayer(layer))
            .filter(layer => layer.layerData?.isAnimationWorkingLayer !== true)
            .map(layer => layerSystem.createLayerRasterSnapshot(layer))
            .filter(Boolean);
        return {
            kind: 'full',
            width: window.TEGAKI_CONFIG?.canvas?.width || 1,
            height: window.TEGAKI_CONFIG?.canvas?.height || 1,
            layerSnapshots,
            animationState: hasAnimationState
                ? animationTable?._captureTimelineHistoryState?.() || null
                : null
        };
    }

    _captureAnimationResizeMetadataState(animationTable = this._getAnimationTable()) {
        const model = animationTable?.model;
        if (!model) return null;
        return {
            drawingSnapshots: (model.drawingSnapshots || []).map(snapshot => ({
                id: snapshot.id || null,
                rasterBounds: snapshot.rasterBounds ? { ...snapshot.rasterBounds } : null,
                updatedAt: snapshot.updatedAt || null
            })),
            clips: (model.tracks || []).flatMap(lane => (lane?.cels || []).map(clip => ({
                id: clip.id || null,
                transform: clip.transform ? structuredClone(clip.transform) : null,
                rasterSnapshot: clip.rasterSnapshot ? {
                    width: clip.rasterSnapshot.width || 1,
                    height: clip.rasterSnapshot.height || 1,
                    rasterBounds: clip.rasterSnapshot.rasterBounds
                        ? { ...clip.rasterSnapshot.rasterBounds }
                        : null,
                    updatedAt: clip.rasterSnapshot.updatedAt || null
                } : null
            })))
        };
    }

    _hasAnimationResizeState(animationTable = this._getAnimationTable()) {
        const model = animationTable?.model;
        if (!model) return false;
        return (model.drawingSnapshots?.length || 0) > 0
            || (model.clipAssets?.length || 0) > 0
            || (model.tracks || []).some(lane => (lane?.cels?.length || 0) > 0);
    }

    _restoreResizeHistoryState(state, alignOptions = null) {
        if (!state) return false;
        const camera = this.coreEngine?.getCameraSystem?.();
        const layerSystem = this.coreEngine?.getLayerSystem?.() || window.layerManager;
        const currentWidth = window.TEGAKI_CONFIG?.canvas?.width || 1;
        const currentHeight = window.TEGAKI_CONFIG?.canvas?.height || 1;
        if (camera && (currentWidth !== state.width || currentHeight !== state.height)) {
            camera.resizeCanvas(state.width, state.height, alignOptions || this._getResizeAlignOptions());
        }
        if (state.kind === 'metadata') {
            this._restoreLayerResizeMetadataState(state.layerMetadata, layerSystem);
            this._restoreAnimationResizeMetadataState(state.animationMetadata);
            layerSystem?.refreshClippingMasks?.();
            this._updateCanvasInfo();
            return true;
        }
        (state.layerSnapshots || []).forEach(snapshot => {
            layerSystem?.restoreLayerRasterSnapshot?.(snapshot);
        });
        const animationTable = this._getAnimationTable();
        if (state.animationState && animationTable?._restoreTimelineHistoryState) {
            animationTable._restoreTimelineHistoryState(state.animationState);
            animationTable._invalidateSnapshotTextureCache?.();
            animationTable._syncSelectedClipToWorkingLayers?.({ forceRestore: true });
            animationTable.render?.();
            animationTable._flushLayerPanelSync?.();
        }
        this._updateCanvasInfo();
        return true;
    }

    _restoreLayerResizeMetadataState(layerMetadata = [], layerSystem = null) {
        const byId = new Map(
            (layerSystem?.getLayers?.() || [])
                .filter(layer => layer?.layerData?.id)
                .map(layer => [layer.layerData.id, layer])
        );
        (layerMetadata || []).forEach(metadata => {
            const layer = byId.get(metadata?.layerId);
            if (!layer?.layerData || !metadata?.rasterBounds) return;
            layer.layerData.rasterBounds = { ...metadata.rasterBounds };
            layer.layerData.layerSprite?.position.set(
                metadata.rasterBounds.x || 0,
                metadata.rasterBounds.y || 0
            );
            const layerIndex = layerSystem?.getLayerIndex?.(layer);
            if (Number.isInteger(layerIndex) && layerIndex >= 0) {
                layerSystem?.requestThumbnailUpdate?.(layerIndex, true);
            }
        });
    }

    _restoreAnimationResizeMetadataState(metadata) {
        if (!metadata) return false;
        const animationTable = this._getAnimationTable();
        const model = animationTable?.model;
        if (!model) return false;
        const snapshotById = new Map(
            (model.drawingSnapshots || [])
                .filter(snapshot => snapshot?.id)
                .map(snapshot => [snapshot.id, snapshot])
        );
        (metadata.drawingSnapshots || []).forEach(entry => {
            const snapshot = snapshotById.get(entry?.id);
            if (!snapshot || !entry?.rasterBounds) return;
            snapshot.rasterBounds = { ...entry.rasterBounds };
            snapshot.updatedAt = entry.updatedAt || null;
        });
        const clipById = new Map();
        (model.tracks || []).forEach(lane => {
            (lane?.cels || []).forEach(clip => {
                if (clip?.id) clipById.set(clip.id, clip);
            });
        });
        (metadata.clips || []).forEach(entry => {
            const clip = clipById.get(entry?.id);
            if (!clip) return;
            if (entry.transform) {
                clip.transform = structuredClone(entry.transform);
            }
            if (entry.rasterSnapshot && clip.rasterSnapshot) {
                clip.rasterSnapshot.width = entry.rasterSnapshot.width;
                clip.rasterSnapshot.height = entry.rasterSnapshot.height;
                clip.rasterSnapshot.rasterBounds = entry.rasterSnapshot.rasterBounds
                    ? { ...entry.rasterSnapshot.rasterBounds }
                    : null;
                clip.rasterSnapshot.updatedAt = entry.rasterSnapshot.updatedAt || null;
            }
        });
        animationTable._invalidateSnapshotTextureCache?.();
        animationTable._syncSelectedClipToWorkingLayers?.({ forceRestore: true });
        animationTable.render?.();
        animationTable._flushLayerPanelSync?.();
        return true;
    }

    _estimateResizeHistoryBytes(state, seenBuffers = new Set()) {
        if (state?.kind === 'metadata') {
            try {
                return JSON.stringify(state).length * 2;
            } catch {
                return 0;
            }
        }
        let bytes = 0;
        const addPixels = pixels => {
            if (!pixels) return;
            const identity = pixels.buffer || pixels;
            if (seenBuffers.has(identity)) return;
            seenBuffers.add(identity);
            bytes += pixels.byteLength || pixels.length || 0;
        };
        (state?.layerSnapshots || []).forEach(snapshot => {
            addPixels(snapshot?.pixels);
        });
        (state?.animationState?.drawingSnapshots || []).forEach(snapshot => {
            addPixels(snapshot?.pixels);
        });
        (state?.animationState?.tracks || []).forEach(lane => {
            (lane?.cels || []).forEach(clip => addPixels(clip?.rasterSnapshot?.pixels));
        });
        return bytes;
    }

    _updateCanvasInfo() {
        const width = window.TEGAKI_CONFIG?.canvas?.width || 1;
        const height = window.TEGAKI_CONFIG?.canvas?.height || 1;
        const canvasInfoElement = document.getElementById('canvas-info');
        if (canvasInfoElement) {
            canvasInfoElement.textContent = `${width}×${height}px`;
        }
    }

    _hasCurrentMarkup() {
        if (!this.popup) return false;
        return !!this.popup.querySelector('[data-resize-target]')
            && !!this.popup.querySelector('[data-content-fit]')
            && !!this.popup.querySelector('#resize-content-preview')
            && !!this.popup.querySelector('#resize-preview-image');
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
        if (this._isContentScaleMode()) {
            this._updateWidthSlider(this.contentScalePercent);
        } else {
            this._updateWidthSlider(this.currentWidth);
            this._updateHeightSlider(this.currentHeight);
        }
        this._setResizeTarget(this.resizeTarget);
        this._setContentFitMode(this.contentFitMode);
        this._setHorizontalAlign(this.horizontalAlign);
        this._setVerticalAlign(this.verticalAlign);
    }
    
    show() {
        if (!this.popup) {
            this._ensurePopupElement();
        }
        
        if (!this.popup) return;
        if (!this._hasCurrentMarkup()) {
            this._populateContent();
            this.initialized = false;
        }
        
        this.popup.classList.add('show');
        this.isVisible = true;
        
        requestAnimationFrame(() => {
            const config = window.TEGAKI_CONFIG;
            this.currentWidth = config?.canvas?.width || 344;
            this.currentHeight = config?.canvas?.height || 135;
            if (this.resizeTarget === 'content') {
                this.contentScalePercent = 100;
            }
            this._contentPreviewCache = null;
            
            if (!this.initialized) {
                this.initialize();
            } else {
                this._updateUI();
            }
        });
    }

    _getAnimationTable() {
        return window.PopupManager?.get?.('animationTable')
            || window.coreEngine?.popupManager?.get?.('animationTable')
            || null;
    }

    _isResizableRasterLayer(layer) {
        const data = layer?.layerData;
        return !!data
            && !data.isFolder
            && !data.isBackground
            && !!data.renderTexture;
    }

    _scaleProjectContent(options = {}) {
        const plan = this._prepareContentResizePlan(options);
        if (!plan?.ok) {
            this._showResizeFailure(plan?.reason || '内容を変換できませんでした');
            return false;
        }
        return this._applyContentResizePlan(plan);
    }

    _prepareContentResizePlan(options = {}) {
        const layerSystem = this.coreEngine?.getLayerSystem?.() || window.layerManager;
        if (!layerSystem) return { ok: false, reason: 'Layer Systemを利用できません' };

        const targetSize = {
            width: Math.max(1, Math.round(options.targetWidth || window.TEGAKI_CONFIG?.canvas?.width || 1)),
            height: Math.max(1, Math.round(options.targetHeight || window.TEGAKI_CONFIG?.canvas?.height || 1))
        };
        const frameSize = {
            width: Math.max(1, Math.round(options.frameWidth || window.TEGAKI_CONFIG?.canvas?.width || targetSize.width)),
            height: Math.max(1, Math.round(options.frameHeight || window.TEGAKI_CONFIG?.canvas?.height || targetSize.height))
        };
        const entries = this._dedupeContentResizeEntries(
            this._collectContentResizeEntries({ includePixels: true })
        );
        const sourceBounds = this._unionContentBounds(entries);
        if (!sourceBounds) return { ok: false, reason: '変換対象のRasterがありません' };

        const transform = this._resolveContentTransform(sourceBounds, targetSize, {
            ...options,
            frameSize
        });
        const maxAxis = Math.min(
            8192,
            Math.max(1, Math.round(layerSystem._getMaxRenderTextureSize?.() || 8192))
        );
        const preflightEntries = [];
        const sourcePixelBuffers = new Set();
        let sourcePixelBytes = 0;
        let outputPixelBytes = 0;
        for (const entry of entries) {
            const output = this._resolveScaledSnapshotOutput(entry.snapshot, sourceBounds, transform);
            const validation = validateRasterSurfaceSize(output?.bounds || { width: 1, height: 1 }, {
                maxAxis,
                maxPixels: 16 * 1024 * 1024
            });
            if (!validation.ok) {
                return {
                    ok: false,
                    reason: `変換後Rasterが安全上限を超えます (${validation.reason})`
                };
            }
            const sourcePixels = entry.snapshot?.pixels;
            const sourceIdentity = sourcePixels?.buffer || sourcePixels;
            if (sourceIdentity && !sourcePixelBuffers.has(sourceIdentity)) {
                sourcePixelBuffers.add(sourceIdentity);
                sourcePixelBytes += sourcePixels.byteLength || sourcePixels.length || 0;
            }
            outputPixelBytes += validation.pixelCount * 4;
            preflightEntries.push({
                ...entry,
                output
            });
        }
        const estimatedHistoryBytes = sourcePixelBytes + outputPixelBytes;
        const historyUsage = this.history?.getUsage?.() || null;
        if (
            Number.isFinite(historyUsage?.maxBytes)
            && historyUsage.maxBytes > 0
            && estimatedHistoryBytes > historyUsage.maxBytes
        ) {
            const requiredMB = Math.ceil(estimatedHistoryBytes / (1024 * 1024));
            const limitMB = Math.floor(historyUsage.maxBytes / (1024 * 1024));
            return {
                ok: false,
                reason: `Undo用Rasterが履歴上限を超えます (${requiredMB}MB / ${limitMB}MB)`
            };
        }
        const preparedEntries = preflightEntries.map(entry => ({
            ...entry,
            scaled: this._scaleRasterSnapshot(
                    entry.snapshot,
                    sourceBounds,
                    transform,
                    targetSize,
                    entry.output
                )
        }));
        return {
            ok: true,
            entries: preparedEntries,
            sourceBounds,
            transform,
            targetSize,
            frameSize,
            oldFrameSize: {
                width: Math.max(1, Math.round(options.oldFrameWidth || window.TEGAKI_CONFIG?.canvas?.width || 1)),
                height: Math.max(1, Math.round(options.oldFrameHeight || window.TEGAKI_CONFIG?.canvas?.height || 1))
            },
            estimatedHistoryBytes
        };
    }

    _applyContentResizePlan(plan) {
        if (!plan?.ok) return false;
        const layerSystem = this.coreEngine?.getLayerSystem?.() || window.layerManager;
        if (!layerSystem) return false;

        for (const entry of plan.entries || []) {
            const scaled = entry.scaled;
            const targets = entry.aliases?.length ? entry.aliases : [entry];
            for (const target of targets) {
                if (target.kind === 'layer') {
                    if (!layerSystem.restoreLayerRasterSnapshot({
                        ...scaled,
                        layerId: target.snapshot?.layerId || scaled.layerId,
                        pathsData: this._scaleSnapshotPaths(
                            target.snapshot?.pathsData,
                            plan.sourceBounds,
                            plan.transform
                        ),
                        paths: this._scaleSnapshotPaths(
                            target.snapshot?.paths,
                            plan.sourceBounds,
                            plan.transform
                        )
                    })) return false;
                    continue;
                }
                if (target.kind === 'animation-snapshot' || target.kind === 'legacy-clip-snapshot') {
                    Object.assign(target.snapshot, {
                        width: scaled.width,
                        height: scaled.height,
                        rasterBounds: { ...scaled.rasterBounds },
                        pixels: scaled.pixels,
                        isBlank: scaled.isBlank === true,
                        updatedAt: Date.now()
                    });
                }
            }
        }

        this._rebaseClipAnchorsForContentResize(plan);

        const animationTable = this._getAnimationTable();
        const hasAnimationEntries = (plan.entries || []).some(entry =>
            (entry.aliases?.length ? entry.aliases : [entry])
                .some(target => target.kind !== 'layer')
        );
        if (animationTable?.model && hasAnimationEntries) {
            animationTable._invalidateSnapshotTextureCache?.();
            animationTable._syncSelectedClipToWorkingLayers?.({ forceRestore: true });
            animationTable.render?.();
            animationTable._flushLayerPanelSync?.();
        }
        return true;
    }

    _collectContentResizeEntries(options = {}) {
        const layerSystem = this.coreEngine?.getLayerSystem?.() || window.layerManager;
        const entries = [];
        (layerSystem?.getLayers?.() || []).forEach(layer => {
            if (!this._isResizableRasterLayer(layer)) return;
            if (layer.layerData?.isAnimationWorkingLayer === true) return;
            const snapshot = layerSystem.createLayerRasterSnapshot(layer);
            if (!snapshot?.pixels) return;
            entries.push({
                kind: 'layer',
                snapshot: options.includePixels ? snapshot : this._withoutPixels(snapshot)
            });
        });

        const animationTable = this._getAnimationTable();
        (animationTable?.model?.drawingSnapshots || []).forEach(snapshot => {
            if (!snapshot?.pixels) return;
            entries.push({
                kind: 'animation-snapshot',
                snapshot: options.includePixels ? snapshot : this._withoutPixels(snapshot)
            });
        });
        (animationTable?.model?.tracks || []).forEach(lane => {
            (lane?.cels || []).forEach(clip => {
                // asset-backed Clipの互換snapshotはDrawingSnapshotから再生成できるため、
                // pixel正本を持つ旧Clipだけを独立sourceとして扱う。
                const snapshot = clip?.assetId ? null : clip?.rasterSnapshot;
                if (!snapshot?.pixels) return;
                entries.push({
                    kind: 'legacy-clip-snapshot',
                    clipId: clip.id || null,
                    snapshot: options.includePixels ? snapshot : this._withoutPixels(snapshot)
                });
            });
        });
        return entries;
    }

    _dedupeContentResizeEntries(entries = []) {
        const byPixelBuffer = new Map();
        const result = [];
        (entries || []).forEach(entry => {
            const snapshot = entry?.snapshot;
            const pixels = snapshot?.pixels;
            const identity = pixels?.buffer || pixels;
            if (!identity) {
                result.push({ ...entry, aliases: [entry] });
                return;
            }
            const bounds = snapshot.rasterBounds || {};
            const signature = [
                snapshot.width || 1,
                snapshot.height || 1,
                bounds.x || 0,
                bounds.y || 0,
                bounds.width || snapshot.width || 1,
                bounds.height || snapshot.height || 1
            ].join(':');
            let signatures = byPixelBuffer.get(identity);
            if (!signatures) {
                signatures = new Map();
                byPixelBuffer.set(identity, signatures);
            }
            const existing = signatures.get(signature);
            if (existing) {
                existing.aliases.push(entry);
                return;
            }
            const grouped = { ...entry, aliases: [entry] };
            signatures.set(signature, grouped);
            result.push(grouped);
        });
        return result;
    }

    _withoutPixels(snapshot) {
        return {
            width: snapshot.width,
            height: snapshot.height,
            rasterBounds: snapshot.rasterBounds,
            pixels: snapshot.pixels,
            isBlank: snapshot.isBlank === true
        };
    }

    _findAlphaBounds(pixels, width, height) {
        if (!pixels || !width || !height) return null;
        let minX = width;
        let minY = height;
        let maxX = -1;
        let maxY = -1;
        for (let y = 0; y < height; y++) {
            const rowOffset = y * width * 4;
            for (let x = 0, alphaIndex = rowOffset + 3; x < width; x++, alphaIndex += 4) {
                if (pixels[alphaIndex] === 0) continue;
                if (x < minX) minX = x;
                if (y < minY) minY = y;
                if (x > maxX) maxX = x;
                if (y > maxY) maxY = y;
            }
        }
        if (maxX < minX || maxY < minY) return null;
        return {
            x: minX,
            y: minY,
            width: maxX - minX + 1,
            height: maxY - minY + 1
        };
    }

    _getSnapshotProjectAlphaBounds(snapshot) {
        const width = Math.max(1, Math.round(snapshot?.width || 1));
        const height = Math.max(1, Math.round(snapshot?.height || 1));
        const alphaBounds = this._findAlphaBounds(snapshot?.pixels, width, height);
        if (!alphaBounds) return null;
        const rasterBounds = snapshot.rasterBounds || { x: 0, y: 0, width, height };
        return {
            x: Math.round(rasterBounds.x || 0) + alphaBounds.x,
            y: Math.round(rasterBounds.y || 0) + alphaBounds.y,
            width: alphaBounds.width,
            height: alphaBounds.height,
            localAlphaBounds: alphaBounds
        };
    }

    _unionContentBounds(entries) {
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        entries.forEach(entry => {
            const bounds = this._getSnapshotProjectAlphaBounds(entry.snapshot);
            entry.projectAlphaBounds = bounds;
            if (!bounds) return;
            minX = Math.min(minX, bounds.x);
            minY = Math.min(minY, bounds.y);
            maxX = Math.max(maxX, bounds.x + bounds.width);
            maxY = Math.max(maxY, bounds.y + bounds.height);
        });
        if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
            return null;
        }
        return {
            x: minX,
            y: minY,
            width: Math.max(1, maxX - minX),
            height: Math.max(1, maxY - minY)
        };
    }

    _resolveContentTransform(sourceBounds, targetSize, options = {}) {
        const frameSize = options.frameSize || targetSize;
        const fitMode = options.fitMode || this.contentFitMode;
        const widthScale = targetSize.width / Math.max(1, sourceBounds.width);
        const heightScale = targetSize.height / Math.max(1, sourceBounds.height);
        let scale = Math.min(widthScale, heightScale);
        if (fitMode === 'width') scale = widthScale;
        else if (fitMode === 'height') scale = heightScale;
        else if (fitMode === 'cover') scale = Math.max(widthScale, heightScale);
        scale = Math.max(0.01, Math.min(100, scale));

        const width = sourceBounds.width * scale;
        const height = sourceBounds.height * scale;
        const horizontal = options.horizontalAlign || this.horizontalAlign;
        const vertical = options.verticalAlign || this.verticalAlign;
        const x = horizontal === 'left'
            ? 0
            : horizontal === 'right'
                ? frameSize.width - width
                : (frameSize.width - width) / 2;
        const y = vertical === 'top'
            ? 0
            : vertical === 'bottom'
                ? frameSize.height - height
                : (frameSize.height - height) / 2;

        return { x, y, width, height, scale };
    }

    _resolveScaledSnapshotOutput(snapshot, sourceBounds, transform) {
        const width = Math.max(1, Math.round(snapshot?.width || 1));
        const height = Math.max(1, Math.round(snapshot?.height || 1));
        const projectAlphaBounds = this._getSnapshotProjectAlphaBounds({
            ...snapshot,
            width,
            height
        });
        if (!snapshot?.pixels || !projectAlphaBounds) {
            return {
                blank: true,
                bounds: { x: 0, y: 0, width: 1, height: 1 },
                projectAlphaBounds: null
            };
        }

        const destX = transform.x + (projectAlphaBounds.x - sourceBounds.x) * transform.scale;
        const destY = transform.y + (projectAlphaBounds.y - sourceBounds.y) * transform.scale;
        const destWidth = Math.max(1, projectAlphaBounds.width * transform.scale);
        const destHeight = Math.max(1, projectAlphaBounds.height * transform.scale);
        const outX = Math.floor(destX);
        const outY = Math.floor(destY);
        const outRight = Math.ceil(destX + destWidth);
        const outBottom = Math.ceil(destY + destHeight);
        return {
            blank: false,
            projectAlphaBounds,
            destX,
            destY,
            destWidth,
            destHeight,
            bounds: {
                x: outX,
                y: outY,
                width: Math.max(1, outRight - outX),
                height: Math.max(1, outBottom - outY)
            }
        };
    }

    _scaleRasterSnapshot(snapshot, sourceBounds, transform, targetSize, output = null) {
        const width = Math.max(1, Math.round(snapshot?.width || 1));
        const height = Math.max(1, Math.round(snapshot?.height || 1));
        const pixels = snapshot?.pixels ? new Uint8ClampedArray(snapshot.pixels) : null;
        const resolved = output || this._resolveScaledSnapshotOutput(snapshot, sourceBounds, transform);
        if (!pixels || resolved.blank) {
            return {
                ...snapshot,
                width: 1,
                height: 1,
                rasterBounds: { x: 0, y: 0, width: 1, height: 1 },
                pixels: new Uint8ClampedArray(4),
                isBlank: true
            };
        }

        const localAlpha = resolved.projectAlphaBounds.localAlphaBounds;
        const { destX, destY, destWidth, destHeight } = resolved;
        const outX = resolved.bounds.x;
        const outY = resolved.bounds.y;
        const outWidth = resolved.bounds.width;
        const outHeight = resolved.bounds.height;

        const sourceCanvas = document.createElement('canvas');
        sourceCanvas.width = width;
        sourceCanvas.height = height;
        const sourceCtx = sourceCanvas.getContext('2d');
        if (!sourceCtx) return snapshot;
        sourceCtx.putImageData(new ImageData(pixels, width, height), 0, 0);

        const outputCanvas = document.createElement('canvas');
        outputCanvas.width = outWidth;
        outputCanvas.height = outHeight;
        const outputCtx = outputCanvas.getContext('2d', { willReadFrequently: true });
        if (!outputCtx) return snapshot;
        outputCtx.imageSmoothingEnabled = true;
        outputCtx.imageSmoothingQuality = 'high';
        outputCtx.clearRect(0, 0, outWidth, outHeight);
        outputCtx.drawImage(
            sourceCanvas,
            localAlpha.x,
            localAlpha.y,
            localAlpha.width,
            localAlpha.height,
            destX - outX,
            destY - outY,
            destWidth,
            destHeight
        );

        const imageData = outputCtx.getImageData(0, 0, outWidth, outHeight);
        return {
            ...snapshot,
            width: outWidth,
            height: outHeight,
            rasterBounds: { x: outX, y: outY, width: outWidth, height: outHeight },
            pixels: new Uint8ClampedArray(imageData.data),
            pathsData: this._scaleSnapshotPaths(snapshot.pathsData, sourceBounds, transform),
            paths: this._scaleSnapshotPaths(snapshot.paths, sourceBounds, transform),
            isBlank: false
        };
    }

    _scaleSnapshotPaths(paths, sourceBounds, transform) {
        if (!Array.isArray(paths)) return [];
        return paths.map(path => {
            const next = structuredClone(path || {});
            if (Array.isArray(next.points)) {
                next.points = next.points.map(point => {
                    const sourceX = Number.isFinite(Number(point?.localX))
                        ? Number(point.localX)
                        : Number(point?.x) || 0;
                    const sourceY = Number.isFinite(Number(point?.localY))
                        ? Number(point.localY)
                        : Number(point?.y) || 0;
                    const x = transform.x + (sourceX - sourceBounds.x) * transform.scale;
                    const y = transform.y + (sourceY - sourceBounds.y) * transform.scale;
                    return {
                        ...point,
                        ...(Object.hasOwn(point || {}, 'x') ? { x } : {}),
                        ...(Object.hasOwn(point || {}, 'y') ? { y } : {}),
                        localX: x,
                        localY: y
                    };
                });
            }
            if (Number.isFinite(Number(next.size))) next.size = Number(next.size) * transform.scale;
            if (Number.isFinite(Number(next.settings?.size))) {
                next.settings.size = Number(next.settings.size) * transform.scale;
            }
            return next;
        });
    }

    _rebaseClipAnchorsForContentResize(plan) {
        const animationTable = this._getAnimationTable();
        if (!animationTable?.model || !plan?.sourceBounds || !plan?.transform) return false;
        const sourceBounds = plan.sourceBounds;
        const transform = plan.transform;
        const oldFrame = plan.oldFrameSize || plan.frameSize;
        const newFrame = plan.frameSize || oldFrame;
        (animationTable.model.tracks || []).forEach(lane => {
            (lane?.cels || []).forEach(clip => {
                const clipTransform = clip?.transform;
                if (!clipTransform) return;
                const oldPivotX = oldFrame.width * (Number(clipTransform.anchorX) || 0);
                const oldPivotY = oldFrame.height * (Number(clipTransform.anchorY) || 0);
                const nextPivotX = transform.x + (oldPivotX - sourceBounds.x) * transform.scale;
                const nextPivotY = transform.y + (oldPivotY - sourceBounds.y) * transform.scale;
                clipTransform.anchorX = nextPivotX / Math.max(1, newFrame.width);
                clipTransform.anchorY = nextPivotY / Math.max(1, newFrame.height);
            });
        });
        return true;
    }

    _getContentPreviewCache() {
        if (this._contentPreviewCache) return this._contentPreviewCache;
        const entries = this._collectContentResizeEntries({ includePixels: true });
        const bounds = this._unionContentBounds(entries);
        const thumbnail = bounds ? this._renderContentPreviewThumbnail(entries, bounds) : null;
        this._contentPreviewCache = { entries, bounds, thumbnail };
        return this._contentPreviewCache;
    }

    _renderContentPreviewThumbnail(entries, bounds) {
        if (!bounds) return null;
        const maxThumbSize = 180;
        const scale = Math.min(
            1,
            maxThumbSize / Math.max(1, bounds.width),
            maxThumbSize / Math.max(1, bounds.height)
        );
        const thumbWidth = Math.max(1, Math.ceil(bounds.width * scale));
        const thumbHeight = Math.max(1, Math.ceil(bounds.height * scale));
        const outputCanvas = document.createElement('canvas');
        outputCanvas.width = thumbWidth;
        outputCanvas.height = thumbHeight;
        const outputCtx = outputCanvas.getContext('2d');
        if (!outputCtx) return null;
        outputCtx.imageSmoothingEnabled = true;
        outputCtx.imageSmoothingQuality = 'high';
        outputCtx.clearRect(0, 0, thumbWidth, thumbHeight);

        entries.forEach(entry => {
            const snapshot = entry.snapshot;
            const width = Math.max(1, Math.round(snapshot?.width || 1));
            const height = Math.max(1, Math.round(snapshot?.height || 1));
            if (!snapshot?.pixels || !width || !height) return;
            const rasterBounds = snapshot.rasterBounds || { x: 0, y: 0, width, height };
            const sourceCanvas = document.createElement('canvas');
            sourceCanvas.width = width;
            sourceCanvas.height = height;
            const sourceCtx = sourceCanvas.getContext('2d');
            if (!sourceCtx) return;
            sourceCtx.putImageData(new ImageData(new Uint8ClampedArray(snapshot.pixels), width, height), 0, 0);
            outputCtx.drawImage(
                sourceCanvas,
                (Math.round(rasterBounds.x || 0) - bounds.x) * scale,
                (Math.round(rasterBounds.y || 0) - bounds.y) * scale,
                width * scale,
                height * scale
            );
        });

        return {
            src: outputCanvas.toDataURL('image/png'),
            width: thumbWidth,
            height: thumbHeight
        };
    }

    _resolveCanvasResizePreviewTransform(bounds, frameSize) {
        const oldWidth = window.TEGAKI_CONFIG?.canvas?.width || frameSize.width;
        const oldHeight = window.TEGAKI_CONFIG?.canvas?.height || frameSize.height;
        const alignOptions = this._getResizeAlignOptions();
        let offsetX = 0;
        let offsetY = 0;
        offsetX = resolveCanvasResizeOffset(oldWidth, frameSize.width, alignOptions.horizontal);
        offsetY = resolveCanvasResizeOffset(oldHeight, frameSize.height, alignOptions.vertical);
        return {
            x: bounds.x + offsetX,
            y: bounds.y + offsetY,
            width: bounds.width,
            height: bounds.height,
            scale: 1
        };
    }

    _updateResizePreview() {
        if (!this.elements?.preview) return;
        const frameSize = {
            width: this.resizeTarget === 'content'
                ? (window.TEGAKI_CONFIG?.canvas?.width || this.currentWidth)
                : this.currentWidth,
            height: this.resizeTarget === 'content'
                ? (window.TEGAKI_CONFIG?.canvas?.height || this.currentHeight)
                : this.currentHeight
        };
        const frame = this.elements.preview?.querySelector?.('.resize-preview-frame');
        const safeFrameWidth = Math.max(1, frameSize.width);
        const safeFrameHeight = Math.max(1, frameSize.height);
        const maxPreviewWidth = 240;
        const maxPreviewHeight = 110;
        const previewScale = Math.min(maxPreviewWidth / safeFrameWidth, maxPreviewHeight / safeFrameHeight);
        if (frame) {
            frame.style.width = `${Math.max(20, Math.round(safeFrameWidth * previewScale))}px`;
            frame.style.height = `${Math.max(20, Math.round(safeFrameHeight * previewScale))}px`;
        }

        const cache = this._getContentPreviewCache();
        const bounds = cache.bounds;
        if (!bounds) {
            if (this.elements.previewContentBox) {
                this.elements.previewContentBox.style.display = 'none';
            }
            if (this.elements.previewImage) {
                this.elements.previewImage.style.display = 'none';
                this.elements.previewImage.removeAttribute('src');
            }
            this.elements.preview?.classList.remove('is-clipped');
            if (this.elements.previewNote) {
                this.elements.previewNote.textContent = `${Math.round(safeFrameWidth)}×${Math.round(safeFrameHeight)} / 内容なし`;
            }
            return;
        }

        const transform = this.resizeTarget === 'canvas'
            ? this._resolveCanvasResizePreviewTransform(bounds, frameSize)
            : this._resolveContentTransform(bounds, {
                width: this.currentWidth,
                height: this.currentHeight
            }, {
                fitMode: this.contentFitMode,
                horizontalAlign: this.horizontalAlign,
                verticalAlign: this.verticalAlign,
                frameSize
            });
        const clipped = transform.x < 0
            || transform.y < 0
            || transform.x + transform.width > frameSize.width
            || transform.y + transform.height > frameSize.height;
        if (this.elements.previewContentBox) {
            this.elements.previewContentBox.style.display = '';
            this.elements.previewContentBox.style.left = `${transform.x * previewScale}px`;
            this.elements.previewContentBox.style.top = `${transform.y * previewScale}px`;
            this.elements.previewContentBox.style.width = `${Math.max(1, transform.width * previewScale)}px`;
            this.elements.previewContentBox.style.height = `${Math.max(1, transform.height * previewScale)}px`;
        }
        if (this.elements.previewImage) {
            this.elements.previewImage.style.display = '';
            if (cache.thumbnail?.src && this.elements.previewImage.getAttribute('src') !== cache.thumbnail.src) {
                this.elements.previewImage.src = cache.thumbnail.src;
            }
            this.elements.previewImage.style.left = `${transform.x * previewScale}px`;
            this.elements.previewImage.style.top = `${transform.y * previewScale}px`;
            this.elements.previewImage.style.width = `${Math.max(1, transform.width * previewScale)}px`;
            this.elements.previewImage.style.height = `${Math.max(1, transform.height * previewScale)}px`;
        }
        this.elements.preview?.classList.toggle('is-clipped', clipped);
        if (this.elements.previewNote) {
            const percent = Math.round(transform.scale * 100);
            const modeLabel = this.resizeTarget === 'canvas' ? 'キャンバス' : '内容';
            this.elements.previewNote.textContent = clipped
                ? `${modeLabel} ${percent}% / 見切れあり`
                : `${modeLabel} ${percent}% / 全体表示`;
        }
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
