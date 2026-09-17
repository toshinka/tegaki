/**
 * ============================================================================
 * ファイル名: ui/reference-preview-viewer.js
 * 責務: 資料画像閲覧およびキャンバス全体プレビュー（Mirror）のフローティングViewerを提供する
 * 依存: system/event-bus.js, ui/popup-drag-helper.js, ui/feedback-toast.js, ui/ui-icons.js
 * 被依存: core-engine.js, system/popup-manager.js, ui/ui-panels.js
 * 公開API: ReferencePreviewViewer, calculateReferenceProxyDimensions, calculateFitTransform, getCssTransformString
 * イベント発火: popup:shown, popup:hidden
 * 実装状態: ✅実装
 * ============================================================================
 */

import { TegakiEventBus } from '../system/event-bus.js';
import { attachPopupDrag, mountPopupAtOverlayRoot } from './popup-drag-helper.js';
import { showFeedbackToast } from './feedback-toast.js';
import { UI_ICONS } from './ui-icons.js';

export const REFERENCE_PROXY_BUDGET = Object.freeze({
    maxEdge: 2048,
    maxPixels: 4 * 1024 * 1024 // 4MP
});

export const MIRROR_PREVIEW_BUDGET = Object.freeze({
    maxEdge: 1024
});

/**
 * 大きな外部参照画像の縮小プロキシ寸法を計算する純粋関数
 * @param {number} origWidth 
 * @param {number} origHeight 
 * @param {object} [options]
 * @returns {{ width: number, height: number, downscaled: boolean, origWidth: number, origHeight: number }}
 */
export function calculateReferenceProxyDimensions(origWidth, origHeight, options = {}) {
    const maxEdge = options.maxEdge ?? REFERENCE_PROXY_BUDGET.maxEdge;
    const maxPixels = options.maxPixels ?? REFERENCE_PROXY_BUDGET.maxPixels;

    const w = Math.max(1, Math.round(Number(origWidth) || 1));
    const h = Math.max(1, Math.round(Number(origHeight) || 1));
    const totalPixels = w * h;

    if (w <= maxEdge && h <= maxEdge && totalPixels <= maxPixels) {
        return {
            width: w,
            height: h,
            downscaled: false,
            origWidth: w,
            origHeight: h
        };
    }

    const scaleEdge = Math.min(1, maxEdge / Math.max(w, h));
    const scalePixels = Math.min(1, Math.sqrt(maxPixels / totalPixels));
    const scale = Math.min(scaleEdge, scalePixels);

    let targetW = Math.max(1, Math.round(w * scale));
    let targetH = Math.max(1, Math.round(h * scale));

    if (targetW * targetH > maxPixels) {
        targetH = Math.max(1, Math.floor(maxPixels / targetW));
    }

    return {
        width: targetW,
        height: targetH,
        downscaled: true,
        origWidth: w,
        origHeight: h
    };
}

/**
 * ビューサーフェス内に全体収めるFitビュー変換を計算する純粋関数
 */
export function calculateFitTransform(surfaceWidth, surfaceHeight, contentWidth, contentHeight) {
    const sw = Math.max(1, surfaceWidth);
    const sh = Math.max(1, surfaceHeight);
    const cw = Math.max(1, contentWidth);
    const ch = Math.max(1, contentHeight);

    const scale = Math.min(sw / cw, sh / ch) * 0.96;
    const panX = (sw - cw * scale) / 2;
    const panY = (sh - ch * scale) / 2;

    return {
        zoom: scale,
        panX,
        panY,
        rotationDeg: 0,
        flipX: false,
        flipY: false
    };
}

/**
 * 100%（プロキシ原寸）中央配置の変換を計算する純粋関数
 */
export function calculate100PercentTransform(surfaceWidth, surfaceHeight, contentWidth, contentHeight) {
    const sw = Math.max(1, surfaceWidth);
    const sh = Math.max(1, surfaceHeight);
    const cw = Math.max(1, contentWidth);
    const ch = Math.max(1, contentHeight);

    return {
        zoom: 1,
        panX: (sw - cw) / 2,
        panY: (sh - ch) / 2
    };
}

/**
 * ビュー変換状態からCSS transform文字列を生成する純粋関数
 */
export function getCssTransformString(viewState, contentWidth, contentHeight) {
    const { zoom, panX, panY, rotationDeg, flipX, flipY } = viewState;
    const cw = contentWidth;
    const ch = contentHeight;
    const centerX = panX + (cw * zoom) / 2;
    const centerY = panY + (ch * zoom) / 2;
    const sx = flipX ? -zoom : zoom;
    const sy = flipY ? -zoom : zoom;

    return `translate(${centerX}px, ${centerY}px) rotate(${rotationDeg}deg) scale(${sx}, ${sy}) translate(${-cw / 2}px, ${-ch / 2}px)`;
}

export class ReferencePreviewViewer {
    constructor(dependencies = {}) {
        this.app = dependencies.app || window.app;
        this.layerSystem = dependencies.layerSystem || window.layerManager;
        this.exportManager = dependencies.exportManager || window.exportManager;
        this.cameraSystem = dependencies.cameraSystem || window.cameraSystem;
        this.eventBus = dependencies.eventBus || TegakiEventBus;

        this.popup = null;
        this.isVisible = false;
        this.clipboardCount = 1;

        this.tabs = [
            {
                id: 'preview',
                type: 'preview',
                name: 'プレビュー',
                canvas: null,
                origWidth: 800,
                origHeight: 600,
                width: 800,
                height: 600,
                downscaled: false,
                closeable: false,
                viewState: {
                    zoom: 1,
                    panX: 0,
                    panY: 0,
                    rotationDeg: 0,
                    flipX: false,
                    flipY: false,
                    initialized: false
                }
            }
        ];
        this.activeTabId = 'preview';

        this._previewDirty = true;
        this._throttleTimer = null;
        this._isPanning = false;
        this._panStart = { x: 0, y: 0 };
        this._initialPanState = { panX: 0, panY: 0 };

        this._ensurePopupElement();
        this._setupEventListeners();
        this._bindArtworkEvents();
    }

    _ensurePopupElement() {
        if (typeof document === 'undefined') return;
        this.popup = document.getElementById('reference-preview-viewer');
        if (!this.popup) {
            this._createPopupElement();
        } else {
            mountPopupAtOverlayRoot(this.popup);
        }
    }

    _createPopupElement() {
        const container = document.querySelector('.main-layout') || document.body;
        if (!container) return;

        const popup = document.createElement('div');
        popup.id = 'reference-preview-viewer';
        popup.className = 'popup-panel popup-panel--translucent reference-preview-viewer';
        popup.tabIndex = -1;
        popup.style.display = 'none';
        popup.style.left = '84px';
        popup.style.top = '72px';
        popup.style.width = '480px';
        popup.style.height = '520px';

        popup.innerHTML = `
            <div class="viewer-header">
                <div class="viewer-tabs-bar ui-scrollbar">
                    <button type="button" class="viewer-tab viewer-tab--preview active" data-tab-id="preview">
                        <span>プレビュー</span>
                    </button>
                    <button type="button" class="viewer-add-tab-btn" title="資料画像を追加 (+)" aria-label="資料画像を追加">+</button>
                </div>
                <button type="button" class="ui-close-button ui-close-button--medium popup-close-btn viewer-close-btn" data-action="close-popup" data-target="reference-preview-viewer" title="閉じる" aria-label="閉じる">
                    ${UI_ICONS.close || '×'}
                </button>
            </div>
            
            <div class="viewer-toolbar">
                <div class="viewer-toolbar-group">
                    <button type="button" class="viewer-tool-btn" data-action="fit" title="全体表示 (Fit)">Fit</button>
                    <button type="button" class="viewer-tool-btn" data-action="100" title="原寸表示 (100%)">100%</button>
                    <button type="button" class="viewer-tool-btn" data-action="zoom-out" title="縮小 (Zoom -)">-</button>
                    <span class="viewer-zoom-text" title="現在の倍率">100%</span>
                    <button type="button" class="viewer-tool-btn" data-action="zoom-in" title="拡大 (Zoom +)">+</button>
                </div>
                <div class="viewer-toolbar-group">
                    <button type="button" class="viewer-tool-btn" data-action="flip-h" title="左右反転 (Horizontal Flip)">↔</button>
                    <button type="button" class="viewer-tool-btn" data-action="flip-v" title="上下反転 (Vertical Flip)">↕</button>
                    <button type="button" class="viewer-tool-btn" data-action="rotate-ccw" title="左に15°回転">-15°</button>
                    <input type="number" class="viewer-angle-input" value="0" step="any" title="回転角度（度）" aria-label="回転角度">
                    <span class="viewer-angle-unit">°</span>
                    <button type="button" class="viewer-tool-btn" data-action="rotate-cw" title="右に15°回転">+15°</button>
                    <button type="button" class="viewer-tool-btn" data-action="reset-view" title="ビューリセット (Reset View)">Reset</button>
                </div>
                <div class="viewer-badge-container">
                    <div class="viewer-downscale-badge" style="display: none;" title="資料画像が大きいため閲覧用に縮小しています">縮小表示</div>
                </div>
            </div>

            <div class="viewer-body">
                <div class="viewer-surface">
                    <div class="viewer-content">
                        <canvas class="viewer-canvas"></canvas>
                    </div>
                </div>
                <div class="viewer-drop-overlay">画像をドロップして資料に追加</div>
            </div>

            <div class="viewer-resize-handle" title="サイズ変更" aria-hidden="true"></div>
            <input type="file" class="viewer-file-input" accept="image/png,image/jpeg,image/webp,image/bmp,image/gif" multiple style="display: none;">
        `;

        mountPopupAtOverlayRoot(popup);
        this.popup = popup;
    }

    _setupEventListeners() {
        if (!this.popup) return;

        // 1. Dragging the window via header
        attachPopupDrag(this.popup, {
            interactiveSelector: 'button, input, select, textarea, .viewer-tab, .viewer-controls, .viewer-toolbar, .viewer-resize-handle, .viewer-surface, .viewer-body'
        });

        // 2. Resizing the window via resize handle
        const resizeHandle = this.popup.querySelector('.viewer-resize-handle');
        if (resizeHandle) {
            let isResizing = false;
            let resizePointerId = null;
            let resizeStart = null;

            const onResizeMove = (e) => {
                if (!isResizing || e.pointerId !== resizePointerId) return;
                e.preventDefault?.();

                const minW = 360;
                const minH = 300;
                const maxW = Math.max(minW, window.innerWidth - this.popup.offsetLeft - 8);
                const maxH = Math.max(minH, window.innerHeight - this.popup.offsetTop - 8);

                const nextW = Math.max(minW, Math.min(maxW, resizeStart.width + (e.clientX - resizeStart.x)));
                const nextH = Math.max(minH, Math.min(maxH, resizeStart.height + (e.clientY - resizeStart.y)));

                this.popup.style.width = `${nextW}px`;
                this.popup.style.height = `${nextH}px`;
            };

            const onResizeUp = (e) => {
                if (e && e.pointerId !== resizePointerId) return;
                isResizing = false;
                resizeStart = null;
                try {
                    resizeHandle.releasePointerCapture?.(resizePointerId);
                } catch (err) {}
                resizePointerId = null;
                document.removeEventListener('pointermove', onResizeMove);
                document.removeEventListener('pointerup', onResizeUp);
                document.removeEventListener('pointercancel', onResizeUp);
            };

            resizeHandle.addEventListener('pointerdown', (e) => {
                if (e.button !== 0) return;
                const rect = this.popup.getBoundingClientRect();
                isResizing = true;
                resizePointerId = e.pointerId;
                resizeStart = {
                    x: e.clientX,
                    y: e.clientY,
                    width: rect.width,
                    height: rect.height
                };
                try {
                    resizeHandle.setPointerCapture?.(e.pointerId);
                } catch (err) {}
                document.addEventListener('pointermove', onResizeMove, { passive: false });
                document.addEventListener('pointerup', onResizeUp);
                document.addEventListener('pointercancel', onResizeUp);
                e.preventDefault();
                e.stopPropagation();
            });
        }

        // 3. Close button
        const closeBtn = this.popup.querySelector('.viewer-close-btn');
        closeBtn?.addEventListener('click', (e) => {
            e.preventDefault();
            this.hide();
        });

        // 4. File input button (+)
        const addBtn = this.popup.querySelector('.viewer-add-tab-btn');
        const fileInput = this.popup.querySelector('.viewer-file-input');
        addBtn?.addEventListener('click', () => {
            if (fileInput) {
                fileInput.value = '';
                fileInput.click();
            }
        });

        fileInput?.addEventListener('change', async (e) => {
            const files = Array.from(e.target.files || []);
            for (const file of files) {
                await this.addReferenceFromFile(file);
            }
        });

        // 5. Drag and drop onto viewer
        const dropOverlay = this.popup.querySelector('.viewer-drop-overlay');
        let dragCounter = 0;

        this.popup.addEventListener('dragenter', (e) => {
            e.preventDefault();
            e.stopPropagation();
            dragCounter++;
            if (dropOverlay) dropOverlay.classList.add('is-visible');
        });

        this.popup.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
        });

        this.popup.addEventListener('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            dragCounter--;
            if (dragCounter <= 0) {
                dragCounter = 0;
                if (dropOverlay) dropOverlay.classList.remove('is-visible');
            }
        });

        this.popup.addEventListener('drop', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            dragCounter = 0;
            if (dropOverlay) dropOverlay.classList.remove('is-visible');

            const files = Array.from(e.dataTransfer?.files || []);
            let addedCount = 0;
            for (const file of files) {
                if (file.type?.startsWith('image/')) {
                    const ok = await this.addReferenceFromFile(file);
                    if (ok) addedCount++;
                }
            }

            if (addedCount === 0 && files.length > 0) {
                showFeedbackToast('この画像形式は資料ビューアでは使用できません', { duration: 2500 });
            }
        });

        // 6. Clipboard paste when Viewer has focus
        this.popup.addEventListener('paste', async (e) => {
            const items = Array.from(e.clipboardData?.items || []);
            const imageItem = items.find(item => item.kind === 'file' && item.type.startsWith('image/'));
            if (!imageItem) return;

            const blob = imageItem.getAsFile();
            if (!blob) return;

            e.preventDefault();
            e.stopImmediatePropagation();

            const name = `Clipboard ${this.clipboardCount++}`;
            await this.addReferenceFromBlob(blob, name);
        });

        // 7. Surface Pointer Pan
        const surface = this.popup.querySelector('.viewer-surface');
        if (surface) {
            surface.addEventListener('pointerdown', (e) => {
                if (e.button !== 0) return;
                const tab = this.getActiveTab();
                if (!tab) return;

                this._isPanning = true;
                this._panStart = { x: e.clientX, y: e.clientY };
                this._initialPanState = { panX: tab.viewState.panX, panY: tab.viewState.panY };

                this.popup.querySelector('.viewer-body')?.classList.add('is-panning');
                try {
                    surface.setPointerCapture?.(e.pointerId);
                } catch (err) {}

                e.preventDefault();
            });

            surface.addEventListener('pointermove', (e) => {
                if (!this._isPanning) return;
                const tab = this.getActiveTab();
                if (!tab) return;

                const dx = e.clientX - this._panStart.x;
                const dy = e.clientY - this._panStart.y;
                tab.viewState.panX = this._initialPanState.panX + dx;
                tab.viewState.panY = this._initialPanState.panY + dy;

                this._applyCurrentTransform();
                e.preventDefault();
            });

            const onPanEnd = (e) => {
                if (!this._isPanning) return;
                this._isPanning = false;
                this.popup.querySelector('.viewer-body')?.classList.remove('is-panning');
                try {
                    surface.releasePointerCapture?.(e.pointerId);
                } catch (err) {}
            };

            surface.addEventListener('pointerup', onPanEnd);
            surface.addEventListener('pointercancel', onPanEnd);

            // Wheel zoom around cursor
            surface.addEventListener('wheel', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const tab = this.getActiveTab();
                if (!tab) return;

                const rect = surface.getBoundingClientRect();
                const mx = e.clientX - rect.left;
                const my = e.clientY - rect.top;

                const factor = e.deltaY < 0 ? 1.15 : 0.87;
                const oldZoom = tab.viewState.zoom;
                const newZoom = Math.max(0.02, Math.min(40, oldZoom * factor));
                const actualFactor = newZoom / oldZoom;

                tab.viewState.panX = mx - (mx - tab.viewState.panX) * actualFactor;
                tab.viewState.panY = my - (my - tab.viewState.panY) * actualFactor;
                tab.viewState.zoom = newZoom;

                this._applyCurrentTransform();
                this._updateToolbarUI();
            }, { passive: false });
        }

        // 8. Toolbar Actions
        const toolbar = this.popup.querySelector('.viewer-toolbar');
        toolbar?.addEventListener('click', (e) => {
            const btn = e.target.closest('.viewer-tool-btn');
            if (!btn) return;
            const action = btn.dataset.action;
            const tab = this.getActiveTab();
            if (!tab) return;

            switch (action) {
                case 'fit':
                    this.fitActiveTab();
                    break;
                case '100':
                    this.set100PercentActiveTab();
                    break;
                case 'zoom-out':
                    this.zoomActiveTab(0.8);
                    break;
                case 'zoom-in':
                    this.zoomActiveTab(1.25);
                    break;
                case 'flip-h':
                    tab.viewState.flipX = !tab.viewState.flipX;
                    this._applyCurrentTransform();
                    this._updateToolbarUI();
                    break;
                case 'flip-v':
                    tab.viewState.flipY = !tab.viewState.flipY;
                    this._applyCurrentTransform();
                    this._updateToolbarUI();
                    break;
                case 'rotate-ccw':
                    tab.viewState.rotationDeg = Math.round((tab.viewState.rotationDeg - 15) * 10) / 10;
                    this._applyCurrentTransform();
                    this._updateToolbarUI();
                    break;
                case 'rotate-cw':
                    tab.viewState.rotationDeg = Math.round((tab.viewState.rotationDeg + 15) * 10) / 10;
                    this._applyCurrentTransform();
                    this._updateToolbarUI();
                    break;
                case 'reset-view':
                    this.resetActiveTabView();
                    break;
            }
        });

        const angleInput = this.popup.querySelector('.viewer-angle-input');
        angleInput?.addEventListener('change', (e) => {
            const tab = this.getActiveTab();
            if (!tab) return;
            const val = parseFloat(e.target.value);
            tab.viewState.rotationDeg = Number.isFinite(val) ? val : 0;
            this._applyCurrentTransform();
            this._updateToolbarUI();
        });
    }

    _bindArtworkEvents() {
        if (!this.eventBus) return;

        const onArtworkChange = () => {
            this._previewDirty = true;
            if (!this.isVisible) return;
            if (this.activeTabId !== 'preview') return;
            this._scheduleMirrorRefresh();
        };

        this.eventBus.on('drawing:stroke-completed', onArtworkChange);
        this.eventBus.on('layer:changed', onArtworkChange);
        this.eventBus.on('layer:visibility-changed', onArtworkChange);
        this.eventBus.on('layer:order-changed', onArtworkChange);
        this.eventBus.on('layer:opacity-changed', onArtworkChange);
        this.eventBus.on('history:changed', onArtworkChange);
        this.eventBus.on('animation:frame-switched', onArtworkChange);
    }

    _scheduleMirrorRefresh() {
        if (this._throttleTimer) return;
        this._throttleTimer = setTimeout(() => {
            this._throttleTimer = null;
            if (this.isVisible && this.activeTabId === 'preview' && this._previewDirty) {
                this.captureMirrorPreview();
            }
        }, 150); // ~6.6 fps bounded throttle
    }

    getActiveTab() {
        return this.tabs.find(t => t.id === this.activeTabId) || null;
    }

    show() {
        const wasVisible = this.isVisible === true;
        this._ensurePopupElement();
        if (!this.popup) return;

        this.popup.classList.add('show');
        this.popup.style.display = 'flex';
        this.isVisible = true;

        if (!wasVisible) {
            this.eventBus?.emit('popup:shown', { name: 'referencePreview' });
        }

        if (this._previewDirty && this.activeTabId === 'preview') {
            this.captureMirrorPreview();
        }

        this._renderTabsHeader();
        this._renderActiveTabContent();
    }

    hide() {
        if (!this.popup) return;
        this.popup.classList.remove('show');
        this.popup.style.display = 'none';
        this.isVisible = false;
        this.eventBus?.emit('popup:hidden', { name: 'referencePreview' });
    }

    toggle() {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }

    switchTab(tabId) {
        const tab = this.tabs.find(t => t.id === tabId);
        if (!tab) return;

        this.activeTabId = tabId;
        this._renderTabsHeader();

        if (tab.type === 'preview' && this._previewDirty) {
            this.captureMirrorPreview();
        } else {
            this._renderActiveTabContent();
        }
    }

    closeTab(tabId) {
        const index = this.tabs.findIndex(t => t.id === tabId);
        if (index === -1) return;
        const tab = this.tabs[index];
        if (!tab.closeable) return; // Preview tab cannot be closed

        // Release canvas buffer
        if (tab.canvas) {
            tab.canvas.width = 1;
            tab.canvas.height = 1;
            tab.canvas = null;
        }

        this.tabs.splice(index, 1);

        if (this.activeTabId === tabId) {
            const nextTab = this.tabs[Math.max(0, index - 1)];
            this.switchTab(nextTab.id);
        } else {
            this._renderTabsHeader();
        }
    }

    async addReferenceFromFile(file) {
        if (!file || !file.type?.startsWith('image/')) {
            showFeedbackToast('この画像形式は資料ビューアでは使用できません', { duration: 2500 });
            return false;
        }
        return this.addReferenceFromBlob(file, file.name || 'Reference');
    }

    async addReferenceFromBlob(blob, name = 'Reference') {
        if (!blob) return false;

        let imgBitmap = null;
        let imgElement = null;
        let origWidth = 0;
        let origHeight = 0;

        try {
            if (typeof createImageBitmap === 'function') {
                imgBitmap = await createImageBitmap(blob);
                origWidth = imgBitmap.width;
                origHeight = imgBitmap.height;
            } else if (typeof Image !== 'undefined') {
                const url = URL.createObjectURL(blob);
                imgElement = await new Promise((resolve, reject) => {
                    const img = new Image();
                    img.onload = () => resolve(img);
                    img.onerror = reject;
                    img.src = url;
                });
                origWidth = imgElement.naturalWidth || imgElement.width;
                origHeight = imgElement.naturalHeight || imgElement.height;
                URL.revokeObjectURL(url);
            } else {
                throw new Error('No image decoding facility available');
            }
        } catch (err) {
            showFeedbackToast('資料画像を読み込めませんでした', { duration: 2500 });
            return false;
        }

        // Bounded proxy sizing
        const proxyInfo = calculateReferenceProxyDimensions(origWidth, origHeight);

        let canvas = null;
        if (typeof document !== 'undefined') {
            canvas = document.createElement('canvas');
            canvas.width = proxyInfo.width;
            canvas.height = proxyInfo.height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                if (imgBitmap) {
                    ctx.drawImage(imgBitmap, 0, 0, proxyInfo.width, proxyInfo.height);
                } else if (imgElement) {
                    ctx.drawImage(imgElement, 0, 0, proxyInfo.width, proxyInfo.height);
                    imgElement.src = '';
                }
            }
        }

        // CRITICAL: release large decoded bitmap
        if (imgBitmap?.close) {
            imgBitmap.close();
            imgBitmap = null;
        }

        const tabId = 'ref_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
        const tab = {
            id: tabId,
            type: 'reference',
            name: name || 'Reference',
            canvas,
            origWidth: proxyInfo.origWidth,
            origHeight: proxyInfo.origHeight,
            width: proxyInfo.width,
            height: proxyInfo.height,
            downscaled: proxyInfo.downscaled,
            closeable: true,
            viewState: {
                zoom: 1,
                panX: 0,
                panY: 0,
                rotationDeg: 0,
                flipX: false,
                flipY: false,
                initialized: false
            }
        };

        this.tabs.push(tab);
        this._renderTabsHeader();
        this.switchTab(tabId);
        return true;
    }

    captureMirrorPreview() {
        if (!this.isVisible) return;

        const layerSystem = this.layerSystem || window.layerManager;
        const app = this.app || window.app;
        const exportManager = this.exportManager || window.exportManager;

        if (!layerSystem || !app?.renderer) return;

        const container = layerSystem.currentFrameContainer;
        if (!container) return;

        const config = window.TEGAKI_CONFIG?.canvas || { width: 800, height: 600 };
        const origW = Math.max(1, Math.round(config.width || 800));
        const origH = Math.max(1, Math.round(config.height || 600));

        const maxEdge = MIRROR_PREVIEW_BUDGET.maxEdge;
        const scale = Math.min(1, maxEdge / Math.max(origW, origH));
        const targetW = Math.max(1, Math.round(origW * scale));
        const targetH = Math.max(1, Math.round(origH * scale));

        let rawCanvas = null;
        if (exportManager?.renderToCanvas) {
            try {
                rawCanvas = exportManager.renderToCanvas({
                    width: origW,
                    height: origH,
                    resolution: 1,
                    transparent: false,
                    container
                });
            } catch (err) {
                console.warn('[ReferencePreviewViewer] renderToCanvas failed:', err);
            }
        }

        if (!rawCanvas && app.renderer.extract?.canvas) {
            try {
                rawCanvas = app.renderer.extract.canvas({
                    target: container,
                    clearColor: [1, 1, 1, 1]
                });
            } catch (err) {
                console.warn('[ReferencePreviewViewer] renderer extract failed:', err);
            }
        }

        if (!rawCanvas) return;

        let previewCanvas = rawCanvas;
        if (rawCanvas.width !== targetW || rawCanvas.height !== targetH) {
            if (typeof document !== 'undefined') {
                previewCanvas = document.createElement('canvas');
                previewCanvas.width = targetW;
                previewCanvas.height = targetH;
                const ctx = previewCanvas.getContext('2d');
                if (ctx) {
                    ctx.imageSmoothingEnabled = true;
                    ctx.imageSmoothingQuality = 'high';
                    ctx.drawImage(rawCanvas, 0, 0, targetW, targetH);
                }
            }
        }

        const previewTab = this.tabs.find(t => t.id === 'preview');
        if (previewTab) {
            previewTab.canvas = previewCanvas;
            previewTab.width = targetW;
            previewTab.height = targetH;
            previewTab.origWidth = origW;
            previewTab.origHeight = origH;
            this._previewDirty = false;

            if (!previewTab.viewState.initialized) {
                this.fitTab(previewTab);
                previewTab.viewState.initialized = true;
            }

            if (this.activeTabId === 'preview') {
                this._renderActiveTabContent();
            }
        }
    }

    fitActiveTab() {
        const tab = this.getActiveTab();
        if (!tab) return;
        this.fitTab(tab);
        this._applyCurrentTransform();
        this._updateToolbarUI();
    }

    fitTab(tab) {
        const surface = this.popup?.querySelector('.viewer-surface');
        const sw = surface?.clientWidth || 400;
        const sh = surface?.clientHeight || 360;
        const fit = calculateFitTransform(sw, sh, tab.width, tab.height);
        tab.viewState.zoom = fit.zoom;
        tab.viewState.panX = fit.panX;
        tab.viewState.panY = fit.panY;
    }

    set100PercentActiveTab() {
        const tab = this.getActiveTab();
        if (!tab) return;
        const surface = this.popup?.querySelector('.viewer-surface');
        const sw = surface?.clientWidth || 400;
        const sh = surface?.clientHeight || 360;
        const t = calculate100PercentTransform(sw, sh, tab.width, tab.height);
        tab.viewState.zoom = t.zoom;
        tab.viewState.panX = t.panX;
        tab.viewState.panY = t.panY;
        this._applyCurrentTransform();
        this._updateToolbarUI();
    }

    zoomActiveTab(factor) {
        const tab = this.getActiveTab();
        if (!tab) return;
        const surface = this.popup?.querySelector('.viewer-surface');
        const sw = surface?.clientWidth || 400;
        const sh = surface?.clientHeight || 360;
        const cx = sw / 2;
        const cy = sh / 2;

        const oldZoom = tab.viewState.zoom;
        const newZoom = Math.max(0.02, Math.min(40, oldZoom * factor));
        const actualFactor = newZoom / oldZoom;

        tab.viewState.panX = cx - (cx - tab.viewState.panX) * actualFactor;
        tab.viewState.panY = cy - (cy - tab.viewState.panY) * actualFactor;
        tab.viewState.zoom = newZoom;

        this._applyCurrentTransform();
        this._updateToolbarUI();
    }

    resetActiveTabView() {
        const tab = this.getActiveTab();
        if (!tab) return;
        tab.viewState.rotationDeg = 0;
        tab.viewState.flipX = false;
        tab.viewState.flipY = false;
        this.fitTab(tab);
        this._applyCurrentTransform();
        this._updateToolbarUI();
    }

    _renderTabsHeader() {
        if (!this.popup) return;
        const tabsBar = this.popup.querySelector('.viewer-tabs-bar');
        if (!tabsBar) return;

        tabsBar.innerHTML = '';

        this.tabs.forEach(tab => {
            const tabBtn = document.createElement('button');
            tabBtn.type = 'button';
            tabBtn.className = `viewer-tab ${tab.type === 'preview' ? 'viewer-tab--preview' : ''} ${tab.id === this.activeTabId ? 'active' : ''}`;
            tabBtn.dataset.tabId = tab.id;
            tabBtn.title = tab.name;

            const labelSpan = document.createElement('span');
            labelSpan.textContent = tab.name;
            tabBtn.appendChild(labelSpan);

            if (tab.closeable) {
                const closeSpan = document.createElement('button');
                closeSpan.type = 'button';
                closeSpan.className = 'viewer-tab-close';
                closeSpan.textContent = '×';
                closeSpan.title = '閉じる';
                closeSpan.setAttribute('aria-label', `${tab.name}を閉じる`);
                closeSpan.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.closeTab(tab.id);
                });
                tabBtn.appendChild(closeSpan);
            }

            tabBtn.addEventListener('click', () => {
                this.switchTab(tab.id);
            });

            tabsBar.appendChild(tabBtn);
        });

        const addBtn = document.createElement('button');
        addBtn.type = 'button';
        addBtn.className = 'viewer-add-tab-btn';
        addBtn.title = '資料画像を追加 (+)';
        addBtn.setAttribute('aria-label', '資料画像を追加');
        addBtn.textContent = '+';
        const fileInput = this.popup.querySelector('.viewer-file-input');
        addBtn.addEventListener('click', () => {
            if (fileInput) {
                fileInput.value = '';
                fileInput.click();
            }
        });
        tabsBar.appendChild(addBtn);
    }

    _renderActiveTabContent() {
        const tab = this.getActiveTab();
        if (!tab || !this.popup) return;

        const canvasEl = this.popup.querySelector('.viewer-canvas');
        const contentEl = this.popup.querySelector('.viewer-content');
        if (!canvasEl || !contentEl) return;

        if (tab.canvas) {
            canvasEl.width = tab.width;
            canvasEl.height = tab.height;
            canvasEl.style.width = `${tab.width}px`;
            canvasEl.style.height = `${tab.height}px`;
            contentEl.style.width = `${tab.width}px`;
            contentEl.style.height = `${tab.height}px`;

            const ctx = canvasEl.getContext('2d');
            if (ctx) {
                ctx.clearRect(0, 0, tab.width, tab.height);
                ctx.drawImage(tab.canvas, 0, 0);
            }
        }

        if (!tab.viewState.initialized) {
            this.fitTab(tab);
            tab.viewState.initialized = true;
        }

        this._applyCurrentTransform();
        this._updateToolbarUI();
    }

    _applyCurrentTransform() {
        const tab = this.getActiveTab();
        if (!tab || !this.popup) return;
        const contentEl = this.popup.querySelector('.viewer-content');
        if (!contentEl) return;

        contentEl.style.transform = getCssTransformString(tab.viewState, tab.width, tab.height);
    }

    _updateToolbarUI() {
        const tab = this.getActiveTab();
        if (!tab || !this.popup) return;

        const zoomText = this.popup.querySelector('.viewer-zoom-text');
        if (zoomText) {
            zoomText.textContent = `${Math.round(tab.viewState.zoom * 100)}%`;
        }

        const angleInput = this.popup.querySelector('.viewer-angle-input');
        if (angleInput) {
            angleInput.value = tab.viewState.rotationDeg;
        }

        const flipHBtn = this.popup.querySelector('[data-action="flip-h"]');
        flipHBtn?.classList.toggle('is-active', tab.viewState.flipX === true);

        const flipVBtn = this.popup.querySelector('[data-action="flip-v"]');
        flipVBtn?.classList.toggle('is-active', tab.viewState.flipY === true);

        // Downscale badge
        const badge = this.popup.querySelector('.viewer-downscale-badge');
        if (badge) {
            if (tab.downscaled) {
                badge.style.display = 'inline-flex';
                badge.title = `資料画像が大きいため閲覧用に縮小しています。\n元画像: ${tab.origWidth} × ${tab.origHeight}px\n表示用: ${tab.width} × ${tab.height}px\n細部を原寸で確認する場合は外部ツールで必要範囲を切り出してください。`;
            } else {
                badge.style.display = 'none';
            }
        }
    }
}
