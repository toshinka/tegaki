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
import { referenceImageStore, ReferenceImageStore, DEFAULT_WORKSPACE_ID, DEFAULT_WORKSPACE_NAME } from '../system/reference-image-store.js';

export const REFERENCE_PROXY_BUDGET = Object.freeze({
    maxEdge: 2048,
    maxPixels: 4 * 1024 * 1024 // 4MP
});

export const MIRROR_PREVIEW_BUDGET = Object.freeze({
    maxEdge: 1024
});

const ICONS = Object.freeze({
    collapse: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14h6v6"/><path d="M20 10h-6V4"/><path d="M14 10l7-7"/><path d="M3 21l7-7"/></svg>',
    expand: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="M21 3l-7 7"/><path d="M3 21l7-7"/></svg>'
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
        this.imageStore = dependencies.imageStore !== undefined ? dependencies.imageStore : referenceImageStore;

        this.popup = null;
        this.isVisible = false;
        this.clipboardCount = 1;
        this.isThumbnailMode = false;
        this.controlsCollapsed = false;
        this.previewMicroAutoFit = true;
        this._savedFullRect = null;
        this._hasUserResized = false;

        this._deletedTabIds = new Set();
        this._pendingSaves = new Map();
        this.currentWorkspaceId = dependencies.workspaceId || DEFAULT_WORKSPACE_ID;
        this._workspaceLoaded = true;

        if (typeof window !== 'undefined') {
            window.ReferencePreviewViewer = ReferencePreviewViewer;
            if (!window.referencePreviewViewer) {
                window.referencePreviewViewer = this;
            }
        }

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

        this._restorationPromise = this._restoreSavedReferences(this.currentWorkspaceId);
    }

    /**
     * 復元完了を待機するPromiseを取得（テスト・初期化連携用）
     * @returns {Promise<Array<object>>}
     */
    async waitForRestoration() {
        return this._restorationPromise;
    }

    /**
     * 進行中の保存タスクの完了を待機（テスト・確実な永続化確認用）
     * @returns {Promise<Array<any>>}
     */
    async waitForPendingSaves() {
        return Promise.all(Array.from(this._pendingSaves.values()));
    }

    /**
     * 表示対象のWorkspaceを切り替え、対象の参照画像を再読み込み
     * @param {string} workspaceId
     * @returns {Promise<boolean>}
     */
    async setWorkspace(workspaceId) {
        const targetWorkspaceId = String(workspaceId || DEFAULT_WORKSPACE_ID);
        // 切替前の進行中保存タスクの完了を待機して混入や消失を防ぐ
        await this.waitForPendingSaves();

        if (this.currentWorkspaceId === targetWorkspaceId && this._workspaceLoaded) {
            return true;
        }

        this.currentWorkspaceId = targetWorkspaceId;
        this._workspaceLoaded = true;

        // プレビュータブ（index 0）以外の既存参照タブをクリーンアップ
        const previewTab = this.tabs.find(t => t.id === 'preview') || this.tabs[0];
        for (let i = 1; i < this.tabs.length; i++) {
            const t = this.tabs[i];
            if (t.canvas) {
                t.canvas.width = 1;
                t.canvas.height = 1;
                t.canvas = null;
            }
        }
        this.tabs = [previewTab];

        if (this.activeTabId !== 'preview') {
            this.activeTabId = 'preview';
        }

        this._restorationPromise = this._restoreSavedReferences(this.currentWorkspaceId);
        await this._restorationPromise;

        if (this.popup) {
            this._renderTabsHeader();
            this._renderSourceRail();
            this._renderActiveTabContent();
        }

        return true;
    }

    /**
     * ブラウザ内保存領域から参照画像を非同期復元
     * @param {string|null} [workspaceId]
     */
    async _restoreSavedReferences(workspaceId = null) {
        if (!this.imageStore) return [];
        const targetWorkspaceId = workspaceId || this.currentWorkspaceId || DEFAULT_WORKSPACE_ID;
        try {
            const records = await this.imageStore.getAllReferences(targetWorkspaceId);
            if (!Array.isArray(records) || records.length === 0) return [];

            const restoredTabs = [];
            for (const record of records) {
                if (!record || !record.id) continue;
                // 復元完了前にユーザーが明示削除した場合はスキップし、DBからも削除を保証
                if (this._deletedTabIds.has(record.id)) {
                    this.imageStore.deleteReference(record.id).catch(() => {});
                    continue;
                }
                // 既に同IDが存在する場合は重複追加しない
                if (this.tabs.some(t => t.id === record.id)) {
                    continue;
                }

                const canvas = await this._createCanvasFromRecord(record);
                if (!canvas) {
                    console.warn('[ReferencePreviewViewer] Skipping un-decodable reference:', record.id);
                    continue;
                }

                // デコード完了時に再度削除状態を確認
                if (this._deletedTabIds.has(record.id)) {
                    this.imageStore.deleteReference(record.id).catch(() => {});
                    continue;
                }

                const tab = {
                    id: record.id,
                    type: 'reference',
                    name: record.name || 'Reference',
                    canvas,
                    origWidth: record.origWidth || record.width || 1,
                    origHeight: record.origHeight || record.height || 1,
                    width: record.width || 1,
                    height: record.height || 1,
                    downscaled: Boolean(record.downscaled),
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

                restoredTabs.push(tab);
            }

            if (restoredTabs.length > 0) {
                // プレビュータブ（index 0）の直後に復元タブを順序維持で挿入し、
                // 復元待ち中にユーザーが手動追加した新規タブを末尾に保持する
                const previewTab = this.tabs.find(t => t.id === 'preview');
                const userAddedTabs = this.tabs.filter(t => t.id !== 'preview' && !restoredTabs.some(r => r.id === t.id));
                this.tabs = [previewTab || this.tabs[0], ...restoredTabs, ...userAddedTabs];

                if (this.popup) {
                    this._renderTabsHeader();
                    this._renderSourceRail();
                    if (this.isVisible && this.activeTabId === 'preview') {
                        // プレビュー表示中ならプレビュー内容を再描画
                        this._renderActiveTabContent();
                    }
                }
            }

            return restoredTabs;
        } catch (err) {
            console.warn('[ReferencePreviewViewer] Error restoring references:', err);
            return [];
        }
    }

    /**
     * 保存レコードのBlobから描画用Canvasを生成
     */
    async _createCanvasFromRecord(record) {
        if (!record) return null;
        const w = Math.max(1, Math.round(record.width || 1));
        const h = Math.max(1, Math.round(record.height || 1));

        let canvas = null;
        if (typeof document !== 'undefined') {
            canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
        } else {
            return null;
        }

        const ctx = canvas.getContext?.('2d');

        // テスト用モック対応
        if (record.blob?.mockCanvas && ctx) {
            try {
                ctx.drawImage(record.blob.mockCanvas, 0, 0, w, h);
                return canvas;
            } catch (e) {}
        }

        if (record.blob) {
            let imgBitmap = null;
            let imgElement = null;
            try {
                if (typeof createImageBitmap === 'function') {
                    imgBitmap = await createImageBitmap(record.blob);
                    if (ctx) {
                        ctx.imageSmoothingEnabled = true;
                        ctx.imageSmoothingQuality = 'high';
                        ctx.drawImage(imgBitmap, 0, 0, w, h);
                    }
                    imgBitmap?.close?.();
                    return canvas;
                } else if (typeof Image !== 'undefined' && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
                    const url = URL.createObjectURL(record.blob);
                    imgElement = await new Promise((resolve, reject) => {
                        const image = new Image();
                        image.onload = () => resolve(image);
                        image.onerror = reject;
                        image.src = url;
                    });
                    if (ctx) {
                        ctx.imageSmoothingEnabled = true;
                        ctx.imageSmoothingQuality = 'high';
                        ctx.drawImage(imgElement, 0, 0, w, h);
                    }
                    URL.revokeObjectURL(url);
                    return canvas;
                }
            } catch (err) {
                console.warn('[ReferencePreviewViewer] Failed to decode restored image blob:', record.id, err);
                return null;
            }
        }

        return canvas;
    }

    /**
     * 参照画像を非同期に保存
     */
    async _saveTabToStore(tab, sourceBlob, proxyInfo) {
        if (!tab || !this.imageStore) return false;
        const tabId = tab.id;

        if (this._deletedTabIds.has(tabId)) {
            return false;
        }

        // 保存処理開始時のWorkspace IDを固定（切替後の別Workspaceへの誤保存を防止）
        const targetWorkspaceId = this.currentWorkspaceId || DEFAULT_WORKSPACE_ID;

        const saveTask = (async () => {
            try {
                let proxyBlob = null;
                if (tab.canvas) {
                    proxyBlob = await this._canvasToBlob(tab.canvas);
                }

                if (!proxyBlob && !proxyInfo?.downscaled && sourceBlob) {
                    proxyBlob = sourceBlob;
                }

                if (!proxyBlob) {
                    console.warn('[ReferencePreviewViewer] Could not generate proxy blob for tab:', tabId);
                    return false;
                }

                if (this._deletedTabIds.has(tabId)) {
                    this.imageStore.deleteReference(tabId).catch(() => {});
                    return false;
                }

                const tabIndex = this.tabs.findIndex(t => t.id === tabId);
                const order = tabIndex >= 0 ? tabIndex : Date.now();

                const success = await this.imageStore.saveReference({
                    id: tab.id,
                    workspaceId: targetWorkspaceId,
                    name: tab.name,
                    order,
                    origWidth: tab.origWidth,
                    origHeight: tab.origHeight,
                    width: tab.width,
                    height: tab.height,
                    downscaled: tab.downscaled,
                    blob: proxyBlob,
                    mimeType: 'image/png'
                });

                if (this._deletedTabIds.has(tabId)) {
                    this.imageStore.deleteReference(tabId).catch(() => {});
                    return false;
                }

                if (!success) {
                    showFeedbackToast('資料画像のローカル保存に失敗しました', { duration: 2500 });
                    return false;
                }

                return true;
            } catch (err) {
                console.warn('[ReferencePreviewViewer] Failed to save reference image:', err);
                showFeedbackToast('資料画像のローカル保存に失敗しました', { duration: 2500 });
                return false;
            } finally {
                this._pendingSaves.delete(tabId);
            }
        })();

        this._pendingSaves.set(tabId, saveTask);
        return saveTask;
    }

    /**
     * CanvasからBlobを生成
     */
    async _canvasToBlob(canvas, mimeType = 'image/png') {
        if (!canvas) return null;
        if (typeof canvas.convertToBlob === 'function') {
            try {
                return await canvas.convertToBlob({ type: mimeType });
            } catch (e) {}
        }
        if (typeof canvas.toBlob === 'function') {
            try {
                return await new Promise((resolve) => {
                    canvas.toBlob((b) => resolve(b), mimeType);
                });
            } catch (e) {}
        }
        return null;
    }

    _ensurePopupElement() {
        if (typeof document === 'undefined') return;
        if (this.popup) return;
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
        popup.setAttribute('tabindex', '-1');
        const winW = typeof window !== 'undefined' ? (window.innerWidth || 1200) : 1200;
        const winH = typeof window !== 'undefined' ? (window.innerHeight || 800) : 800;
        const defaultW = Math.max(150, Math.min(480, winW - 16));
        const defaultH = Math.max(120, Math.min(520, winH - 16));
        const defaultL = Math.max(8, Math.min(84, winW - defaultW - 8));
        const defaultT = Math.max(8, Math.min(72, winH - defaultH - 8));

        popup.style.display = 'none';
        popup.style.left = `${defaultL}px`;
        popup.style.top = `${defaultT}px`;
        popup.style.width = `${defaultW}px`;
        popup.style.height = `${defaultH}px`;

        popup.innerHTML = `
            <div class="viewer-header">
                <div class="viewer-tabs-bar ui-scrollbar">
                    <button type="button" class="viewer-tab viewer-tab--preview active" data-tab-id="preview">
                        <span>プレビュー</span>
                    </button>
                    <button type="button" class="viewer-add-tab-btn" title="資料画像を追加 (+)" aria-label="資料画像を追加">+</button>
                </div>
                <div class="viewer-source-rail" style="display: none;"></div>
                <div class="viewer-thumbnail-title" style="display: none;">プレビュー</div>
                <div class="viewer-header-actions">
                    <button type="button" class="viewer-toggle-controls-btn is-active" data-action="toggle-controls" title="操作パネルを折りたたむ" aria-label="操作パネルを折りたたむ">
                        ${UI_ICONS.slidersHorizontal}
                    </button>
                    <button type="button" class="viewer-mode-btn" data-action="toggle-thumbnail" title="サムネイル表示に縮小" aria-label="サムネイル表示に縮小">
                        ${ICONS.collapse}
                    </button>
                    <button type="button" class="ui-close-button ui-close-button--medium popup-close-btn viewer-close-btn" data-action="close-popup" data-target="reference-preview-viewer" title="閉じる" aria-label="閉じる">
                        ${UI_ICONS.close || '×'}
                    </button>
                </div>
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
                    <button type="button" class="viewer-tool-btn" data-action="flip-h" title="左右反転 (H)" aria-label="左右反転 (H)">${UI_ICONS.flipHorizontal}</button>
                    <button type="button" class="viewer-tool-btn" data-action="flip-v" title="上下反転 (Shift+H)" aria-label="上下反転 (Shift+H)">${UI_ICONS.flipVertical}</button>
                    <button type="button" class="viewer-tool-btn" data-action="rotate-ccw" title="左に15°回転 (Shift+R)" aria-label="左に15°回転 (Shift+R)">${UI_ICONS.rotateCcw}</button>
                    <input type="number" class="viewer-angle-input" value="0" step="any" title="回転角度（度）" aria-label="回転角度">
                    <span class="viewer-angle-unit">°</span>
                    <button type="button" class="viewer-tool-btn" data-action="rotate-cw" title="右に15°回転 (R)" aria-label="右に15°回転 (R)">${UI_ICONS.rotateCw}</button>
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

        // Window resize clamping listener
        if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
            window.addEventListener('resize', () => {
                if (this.isVisible && this.popup) {
                    this._clampToViewport();
                    this._applyCurrentTransform();
                }
            });
        }

        // Focus handling and Viewer-focused shortcuts
        this.popup.addEventListener?.('pointerdown', (e) => {
            if (!e.target?.closest?.('input, textarea, select')) {
                if (!e.target?.closest?.('button, .viewer-tab')) {
                    this.popup.focus?.();
                }
            }
        }, true);

        this.popup.addEventListener?.('keydown', (e) => {
            this.handleKeyDown(e);
        });

        if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
            window.addEventListener('keydown', (e) => {
                if (this.isVisible && this.popup) {
                    const activeEl = typeof document !== 'undefined' ? document.activeElement : null;
                    if (activeEl && (activeEl === this.popup || this.popup.contains?.(activeEl))) {
                        this.handleKeyDown(e);
                    }
                }
            });
        }

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

                this._hasUserResized = true;

                const minW = 150;
                const minH = 120;
                const winW = typeof window !== 'undefined' ? (window.innerWidth || 1200) : 1200;
                const winH = typeof window !== 'undefined' ? (window.innerHeight || 800) : 800;
                const maxW = Math.max(minW, winW - this.popup.offsetLeft - 8);
                const maxH = Math.max(minH, winH - this.popup.offsetTop - 8);

                const nextW = Math.max(minW, Math.min(maxW, resizeStart.width + (e.clientX - resizeStart.x)));
                const nextH = Math.max(minH, Math.min(maxH, resizeStart.height + (e.clientY - resizeStart.y)));

                this.popup.style.width = `${nextW}px`;
                this.popup.style.height = `${nextH}px`;

                if (this.isThumbnailMode && (nextW >= 240 && nextH >= 190)) {
                    this.isThumbnailMode = false;
                    this.popup.classList.remove('is-thumbnail');
                }

                this._updateResponsiveState(nextW, nextH);
                this._applyCurrentTransform();
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
                this.popup.focus?.();
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

        // 2.4. Toggle Controls Button
        const toggleControlsBtn = this.popup.querySelector('.viewer-toggle-controls-btn');
        toggleControlsBtn?.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.toggleControlsCollapsed();
        });

        // 2.5. Thumbnail Mode Toggle Button
        const modeBtn = this.popup.querySelector('.viewer-mode-btn');
        modeBtn?.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.toggleThumbnailMode();
        });

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

                if (tab.type === 'preview') {
                    this.previewMicroAutoFit = false;
                }

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

            // Wheel: Plain -> zoom, Shift+Wheel -> rotate (parity with CameraSystem)
            surface.addEventListener('wheel', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const tab = this.getActiveTab();
                if (!tab) return;

                // Shift + Wheel -> Rotate active source (deltaY < 0 -> +15, deltaY > 0 -> -15)
                if (e.shiftKey) {
                    if (e.deltaY < 0) {
                        this.rotateActiveTab(15);
                    } else if (e.deltaY > 0) {
                        this.rotateActiveTab(-15);
                    }
                    return;
                }

                // Plain Wheel -> Zoom active source around pointer
                if (tab.type === 'preview') {
                    this.previewMicroAutoFit = false;
                }

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
                    this.toggleFlipH();
                    break;
                case 'flip-v':
                    this.toggleFlipV();
                    break;
                case 'rotate-ccw':
                    this.rotateActiveTab(-15);
                    break;
                case 'rotate-cw':
                    this.rotateActiveTab(15);
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

        this._clampToViewport();

        if (!wasVisible) {
            this.eventBus?.emit('popup:shown', { name: 'referencePreview' });
        }

        if (this._previewDirty && this.activeTabId === 'preview') {
            this.captureMirrorPreview();
        }

        this._renderTabsHeader();
        this._renderActiveTabContent();
    }

    _clampToViewport() {
        if (!this.popup) return;
        const winW = typeof window !== 'undefined' ? (window.innerWidth || 1200) : 1200;
        const winH = typeof window !== 'undefined' ? (window.innerHeight || 800) : 800;
        const margin = 8;

        const minW = 150;
        const minH = 120;

        let curW = parseInt(this.popup.style?.width, 10) || this.popup.offsetWidth || 480;
        let curH = parseInt(this.popup.style?.height, 10) || this.popup.offsetHeight || 520;
        let curL = this.popup.offsetLeft;
        let curT = this.popup.offsetTop;

        const maxW = Math.max(minW, winW - margin * 2);
        const maxH = Math.max(minH, winH - margin * 2);
        const w = Math.max(minW, Math.min(curW, maxW));
        const h = Math.max(minH, Math.min(curH, maxH));

        const maxL = Math.max(margin, winW - w - margin);
        const maxT = Math.max(margin, winH - h - margin);
        const l = Math.max(margin, Math.min(curL, maxL));
        const t = Math.max(margin, Math.min(curT, maxT));

        this.popup.style.width = `${w}px`;
        this.popup.style.height = `${h}px`;
        this.popup.style.left = `${l}px`;
        this.popup.style.top = `${t}px`;

        this._updateResponsiveState(w, h);
    }

    _updateResponsiveState(width, height) {
        if (!this.popup) return;
        const w = width ?? (this.popup.offsetWidth || parseInt(this.popup.style.width, 10) || 480);
        const h = height ?? (this.popup.offsetHeight || parseInt(this.popup.style.height, 10) || 520);

        const isMicro = w < 240 || h < 190 || this.isThumbnailMode;
        const isCompact = !isMicro && (w < 340 || h < 260);

        if (typeof this.popup.classList?.toggle === 'function') {
            this.popup.classList.toggle('is-micro', isMicro);
            this.popup.classList.toggle('is-compact', isCompact);
        } else if (this.popup.classList) {
            if (isMicro) this.popup.classList.add('is-micro'); else this.popup.classList.remove('is-micro');
            if (isCompact) this.popup.classList.add('is-compact'); else this.popup.classList.remove('is-compact');
        }

        const thumbTitle = this.popup.querySelector?.('.viewer-thumbnail-title');
        const tabsBar = this.popup.querySelector?.('.viewer-tabs-bar');
        const modeBtn = this.popup.querySelector?.('.viewer-mode-btn');
        const sourceRail = this.popup.querySelector?.('.viewer-source-rail');

        if (isMicro) {
            if (thumbTitle) {
                thumbTitle.textContent = '';
                thumbTitle.style.display = 'none';
            }
            if (tabsBar) {
                tabsBar.style.display = 'none';
            }
            if (sourceRail) {
                sourceRail.style.display = 'flex';
            }
            this._renderSourceRail();
            if (modeBtn) {
                modeBtn.innerHTML = ICONS.expand;
                modeBtn.title = '通常表示に戻す';
                modeBtn.setAttribute?.('aria-label', '通常表示に戻す');
            }
        } else {
            if (thumbTitle) {
                thumbTitle.style.display = 'none';
            }
            if (sourceRail) {
                sourceRail.style.display = 'none';
            }
            if (tabsBar) {
                tabsBar.style.display = 'flex';
            }
            if (modeBtn) {
                modeBtn.innerHTML = ICONS.collapse;
                modeBtn.title = 'サムネイル表示に縮小';
                modeBtn.setAttribute?.('aria-label', 'サムネイル表示に縮小');
            }
        }
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

    toggleThumbnailMode() {
        this.setThumbnailMode(!this.isThumbnailMode);
    }

    setThumbnailMode(enabled) {
        if (this.isThumbnailMode === enabled) return;
        this.isThumbnailMode = enabled;

        this._ensurePopupElement();
        if (!this.popup) return;

        if (enabled) {
            this.previewMicroAutoFit = true;
            // 1. Remember previous full dimensions
            this._savedFullRect = {
                left: this.popup.offsetLeft,
                top: this.popup.offsetTop,
                width: this.popup.offsetWidth || 480,
                height: this.popup.offsetHeight || 520
            };

            this.popup.classList.add('is-thumbnail');

            const thumbW = 150;
            const thumbH = 170;
            this.popup.style.width = `${thumbW}px`;
            this.popup.style.height = `${thumbH}px`;

            this._clampToViewport();
        } else {
            this.popup.classList.remove('is-thumbnail');

            if (this._savedFullRect) {
                const minW = 150;
                const minH = 120;
                const winW = typeof window !== 'undefined' ? (window.innerWidth || 1200) : 1200;
                const winH = typeof window !== 'undefined' ? (window.innerHeight || 800) : 800;

                const targetW = Math.max(minW, Math.min(winW - 16, this._savedFullRect.width || 480));
                const targetH = Math.max(minH, Math.min(winH - 16, this._savedFullRect.height || 520));

                let left = this._savedFullRect.left ?? this.popup.offsetLeft;
                let top = this._savedFullRect.top ?? this.popup.offsetTop;
                const maxL = Math.max(8, winW - targetW - 8);
                const maxT = Math.max(8, winH - targetH - 8);
                left = Math.max(8, Math.min(left, maxL));
                top = Math.max(8, Math.min(top, maxT));

                this.popup.style.width = `${targetW}px`;
                this.popup.style.height = `${targetH}px`;
                this.popup.style.left = `${left}px`;
                this.popup.style.top = `${top}px`;
            }
            this._clampToViewport();
        }

        this._applyCurrentTransform();
        this._updateToolbarUI();
    }

    toggleControlsCollapsed() {
        this.setControlsCollapsed(!this.controlsCollapsed);
    }

    setControlsCollapsed(collapsed) {
        this.controlsCollapsed = Boolean(collapsed);
        if (!this.popup) return;
        if (typeof this.popup.classList?.toggle === 'function') {
            this.popup.classList.toggle('is-controls-collapsed', this.controlsCollapsed);
        } else if (this.popup.classList) {
            if (this.controlsCollapsed) this.popup.classList.add('is-controls-collapsed');
            else this.popup.classList.remove('is-controls-collapsed');
        }

        const btn = this.popup.querySelector?.('.viewer-toggle-controls-btn');
        if (btn) {
            if (typeof btn.classList?.toggle === 'function') {
                btn.classList.toggle('is-active', !this.controlsCollapsed);
            } else if (btn.classList) {
                if (!this.controlsCollapsed) btn.classList.add('is-active');
                else btn.classList.remove('is-active');
            }
            const title = this.controlsCollapsed ? '操作パネルを展開する' : '操作パネルを折りたたむ';
            btn.title = title;
            btn.setAttribute?.('aria-label', title);
        }

        this._applyCurrentTransform();
    }

    switchTab(tabId) {
        const tab = this.tabs.find(t => t.id === tabId);
        if (!tab) return;

        this.activeTabId = tabId;
        this._renderTabsHeader();
        this._renderSourceRail();

        if (this.isThumbnailMode && this.popup) {
            const thumbTitle = this.popup.querySelector?.('.viewer-thumbnail-title');
            if (thumbTitle) {
                thumbTitle.textContent = '';
                thumbTitle.title = tab.name;
            }
        }

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

        // Track deletion so in-flight restore/saves do not resurrect or write
        this._deletedTabIds?.add(tabId);
        if (this.imageStore?.deleteReference) {
            this.imageStore.deleteReference(tabId).catch((err) => {
                console.warn('[ReferencePreviewViewer] Failed to delete reference from store:', tabId, err);
            });
        }

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
            this._renderSourceRail();
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

        const isFirstRef = this.tabs.filter(t => t.type === 'reference').length === 0;

        this.tabs.push(tab);

        if (isFirstRef) {
            this._maybeSmartExpandForFirstReference(proxyInfo);
        }

        this._renderTabsHeader();
        this.switchTab(tabId);

        // Save reference image to browser-local IndexedDB asynchronously
        this._saveTabToStore(tab, blob, proxyInfo).catch((err) => {
            console.warn('[ReferencePreviewViewer] Background save failed for tab:', tabId, err);
        });

        return true;
    }

    _maybeSmartExpandForFirstReference(proxyInfo) {
        if (this._hasUserResized) return;
        const refCount = this.tabs.filter(t => t.type === 'reference').length;
        if (refCount > 1) return;
        if (!this.popup) return;

        const winW = typeof window !== 'undefined' ? (window.innerWidth || 1200) : 1200;
        const winH = typeof window !== 'undefined' ? (window.innerHeight || 800) : 800;

        const proxyW = proxyInfo.width || 800;
        const proxyH = proxyInfo.height || 600;
        const aspect = proxyW / proxyH;

        const maxW = Math.max(300, Math.min(Math.round(winW * 0.48), 640));
        const maxH = Math.max(260, Math.min(Math.round(winH * 0.52), 600));
        const minW = 240;
        const minH = 220;

        const verticalOverhead = 76;
        const horizontalOverhead = 16;

        let targetW, targetH;

        if (aspect >= 1.2) {
            targetW = Math.round(Math.min(maxW, Math.max(minW, 400 * Math.min(1.4, aspect))));
            const contentH = (targetW - horizontalOverhead) / aspect;
            targetH = Math.round(Math.min(maxH, Math.max(minH, contentH + verticalOverhead)));
        } else if (aspect <= 0.85) {
            targetH = Math.round(Math.min(maxH, Math.max(minH, 420 / Math.max(0.65, aspect))));
            const contentW = (targetH - verticalOverhead) * aspect;
            targetW = Math.round(Math.min(maxW, Math.max(minW, contentW + horizontalOverhead)));
        } else {
            targetW = Math.round(Math.min(maxW, Math.max(minW, 360)));
            targetH = Math.round(Math.min(maxH, Math.max(minH, 360 + 30)));
        }

        targetW = Math.max(minW, Math.min(targetW, maxW));
        targetH = Math.max(minH, Math.min(targetH, maxH));

        if (this.isThumbnailMode) {
            this.isThumbnailMode = false;
            this.popup.classList.remove('is-thumbnail');
        }

        let left = this.popup.offsetLeft;
        let top = this.popup.offsetTop;
        const margin = 8;
        const maxL = Math.max(margin, winW - targetW - margin);
        const maxT = Math.max(margin, winH - targetH - margin);
        left = Math.max(margin, Math.min(left, maxL));
        top = Math.max(margin, Math.min(top, maxT));

        this.popup.style.width = `${targetW}px`;
        this.popup.style.height = `${targetH}px`;
        this.popup.style.left = `${left}px`;
        this.popup.style.top = `${top}px`;

        this._updateResponsiveState(targetW, targetH);
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
        if (tab.type === 'preview') {
            this.previewMicroAutoFit = true;
        }
        this._applyCurrentTransform();
        this._updateToolbarUI();
    }

    fitTab(tab, options = {}) {
        const surface = this.popup?.querySelector('.viewer-surface');
        const sw = surface?.clientWidth || 400;
        const sh = surface?.clientHeight || 360;
        const fit = calculateFitTransform(sw, sh, tab.width, tab.height);
        let targetZoom = fit.zoom;
        if (options.initialReference && targetZoom > 0.6 && (tab.origWidth > 1600 || tab.origHeight > 1600)) {
            targetZoom = Math.min(targetZoom, 0.6);
        }
        tab.viewState.zoom = targetZoom;
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
        if (tab.type === 'preview') {
            this.previewMicroAutoFit = true;
        }
        this._applyCurrentTransform();
        this._updateToolbarUI();
    }

    toggleFlipH() {
        const tab = this.getActiveTab();
        if (!tab) return;
        tab.viewState.flipX = !tab.viewState.flipX;
        this._applyCurrentTransform();
        this._updateToolbarUI();
    }

    toggleFlipV() {
        const tab = this.getActiveTab();
        if (!tab) return;
        tab.viewState.flipY = !tab.viewState.flipY;
        this._applyCurrentTransform();
        this._updateToolbarUI();
    }

    rotateActiveTab(deltaDeg) {
        const tab = this.getActiveTab();
        if (!tab) return;
        tab.viewState.rotationDeg = Math.round((tab.viewState.rotationDeg + deltaDeg) * 10) / 10;
        this._applyCurrentTransform();
        this._updateToolbarUI();
    }

    handleKeyDown(e) {
        if (e.defaultPrevented) return false;
        if (!this.isVisible || !this.popup) return false;

        const activeEl = typeof document !== 'undefined' ? document.activeElement : null;
        const isFocused = Boolean(activeEl && (activeEl === this.popup || this.popup.contains?.(activeEl)));
        if (!isFocused) return false;

        const target = e.target || activeEl;
        const targetTag = target?.tagName?.toUpperCase();
        const activeTag = activeEl?.tagName?.toUpperCase();
        if (targetTag === 'INPUT' || targetTag === 'TEXTAREA' || targetTag === 'SELECT' || target?.isContentEditable ||
            activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT' || activeEl?.isContentEditable) {
            return false;
        }

        if (e.repeat) return false;
        if (e.ctrlKey || e.metaKey || e.altKey) return false;

        const key = typeof e.key === 'string' ? e.key.toLowerCase() : '';
        const isH = e.code === 'KeyH' || key === 'h';
        const isR = e.code === 'KeyR' || key === 'r';

        if (isH) {
            if (!e.shiftKey) {
                e.preventDefault?.();
                e.stopPropagation?.();
                this.toggleFlipH();
                return true;
            } else {
                e.preventDefault?.();
                e.stopPropagation?.();
                this.toggleFlipV();
                return true;
            }
        }

        if (isR) {
            if (!e.shiftKey) {
                e.preventDefault?.();
                e.stopPropagation?.();
                this.rotateActiveTab(15);
                return true;
            } else {
                e.preventDefault?.();
                e.stopPropagation?.();
                this.rotateActiveTab(-15);
                return true;
            }
        }

        return false;
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
                this.popup?.querySelector?.(`.viewer-tab[data-tab-id="${tab.id}"]`)?.focus?.();
            });

            tabsBar.appendChild?.(tabBtn);
        });

        const addBtn = document.createElement('button');
        addBtn.type = 'button';
        addBtn.className = 'viewer-add-tab-btn';
        addBtn.title = '資料画像を追加 (+)';
        addBtn.setAttribute('aria-label', '資料画像を追加');
        addBtn.textContent = '+';
        const fileInput = this.popup.querySelector?.('.viewer-file-input');
        addBtn.addEventListener?.('click', () => {
            if (fileInput) {
                fileInput.value = '';
                fileInput.click?.();
            }
        });
        tabsBar.appendChild?.(addBtn);
        this._renderSourceRail();
    }

    _renderSourceRail() {
        if (!this.popup) return;
        const rail = this.popup.querySelector?.('.viewer-source-rail');
        if (!rail) return;

        // Check if existing markers match current tabs for in-place active update
        const existingMarkers = Array.from(rail.querySelectorAll?.('.viewer-source-marker') || []);
        const tabsMatch = existingMarkers.length === this.tabs.length &&
            existingMarkers.every((m, i) => m.getAttribute?.('data-tab-id') === this.tabs[i]?.id);

        if (tabsMatch) {
            existingMarkers.forEach((marker, i) => {
                const tab = this.tabs[i];
                const isActive = tab.id === this.activeTabId;
                const isPreview = tab.type === 'preview';
                marker.className = `viewer-source-marker ${isPreview ? 'viewer-source-marker--preview' : 'viewer-source-marker--ref'}${isActive ? ' active' : ''}`;
                marker.title = tab.name;
                marker.setAttribute?.('aria-label', tab.name);
            });
            return;
        }

        rail.innerHTML = '';
        this.tabs.forEach(tab => {
            const marker = document.createElement('button');
            marker.type = 'button';
            const isActive = tab.id === this.activeTabId;
            const isPreview = tab.type === 'preview';
            marker.className = `viewer-source-marker ${isPreview ? 'viewer-source-marker--preview' : 'viewer-source-marker--ref'}${isActive ? ' active' : ''}`;
            marker.setAttribute?.('data-tab-id', tab.id);
            if (marker.dataset) marker.dataset.tabId = tab.id;
            marker.title = tab.name;
            marker.setAttribute?.('aria-label', tab.name);

            if (isPreview) {
                marker.innerHTML = UI_ICONS.monitor;
            } else {
                const dot = document.createElement('span');
                dot.className = 'viewer-source-dot';
                marker.appendChild?.(dot);
            }

            marker.addEventListener?.('click', (e) => {
                e.preventDefault?.();
                e.stopPropagation?.();
                this.switchTab(tab.id);
                marker.focus?.();
            });

            rail.appendChild?.(marker);
        });
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
            const isFirstRef = tab.type === 'reference' && this.tabs.filter(t => t.type === 'reference').length === 1;
            this.fitTab(tab, { initialReference: isFirstRef });
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

        const w = this.popup.offsetWidth || parseInt(this.popup.style?.width, 10) || 480;
        const h = this.popup.offsetHeight || parseInt(this.popup.style?.height, 10) || 520;
        const isMicro = w < 240 || h < 190 || this.isThumbnailMode;

        if (isMicro && tab.type === 'preview' && this.previewMicroAutoFit) {
            const surface = this.popup.querySelector('.viewer-surface');
            const sw = surface?.clientWidth || Math.max(120, w - 4);
            const sh = surface?.clientHeight || Math.max(80, h - 30);
            const fit = calculateFitTransform(sw, sh, tab.width, tab.height);
            tab.viewState.zoom = fit.zoom;
            tab.viewState.panX = fit.panX;
            tab.viewState.panY = fit.panY;
            const microViewState = {
                ...fit,
                rotationDeg: tab.viewState.rotationDeg,
                flipX: tab.viewState.flipX,
                flipY: tab.viewState.flipY
            };
            contentEl.style.transform = getCssTransformString(microViewState, tab.width, tab.height);
            return;
        }

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
        flipHBtn?.classList?.toggle?.('is-active', tab.viewState.flipX === true);

        const flipVBtn = this.popup.querySelector('[data-action="flip-v"]');
        flipVBtn?.classList?.toggle?.('is-active', tab.viewState.flipY === true);

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
