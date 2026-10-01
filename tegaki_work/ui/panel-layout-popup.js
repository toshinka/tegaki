/**
 * ============================================================================
 * ファイル名: ui/panel-layout-popup.js
 * 責務: 漫画コマ割りpopup。分割木を編集し、確定でコマ枠Layer群を1件のHistoryで追加/更新する
 * 依存: system/panel-layout.js, system/panel-layout-raster.js, system/history.js, system/event-bus.js,
 *   ui/panel-layout-overlay.js, ui/popup-drag-helper.js, ui/feedback-toast.js, ui/dom-builder.js(閉じるボタン)
 * 被依存: core-engine.js, system/popup-manager.js
 * 公開API: PanelLayoutPopup
 * イベント発火: popup:shown, popup:hidden, layer:content-changed
 * 保存: 編集中の木はlocalStorage(UI設定)。確定したLayerは通常Raster Layerで、再編集用に
 *   layerData.panelLayout(optional・sanitize済み)を持つ。画素は派生物で、更新で再生成する。
 * 実装状態: ✅実装（WP-010 phase 1-2）
 * ============================================================================
 */

import { TegakiEventBus } from '../system/event-bus.js';
import { historyManager } from '../system/history.js';
import {
    PANEL_DEFAULT_LINE_COLOR,
    PANEL_DEFAULT_PAPER_COLOR,
    PANEL_LAYOUT_LIMITS,
    PANEL_PRESETS,
    alignLayout,
    buildPresetById,
    dragPanelCorner,
    dragSplitRatio,
    findNode,
    findParent,
    hitTestCorner,
    hitTestPanel,
    hitTestSplit,
    isValidPanelTree,
    normalizePanelLayoutParams,
    removePanel,
    resetOuterCorners,
    resolvePanelLayout,
    sanitizePanelLayoutData,
    setPanelBleed,
    setPanelDeleted,
    setPanelLineWidth,
    snapSplitPoint,
    splitPanel,
    updateSplit
} from '../system/panel-layout.js';
import { rasterizePanelFrames } from '../system/panel-layout-raster.js';
import { PanelLayoutOverlay } from './panel-layout-overlay.js';
import { attachPopupDrag, mountPopupAtOverlayRoot } from './popup-drag-helper.js';
import { showFeedbackToast } from './feedback-toast.js';

const STORAGE_KEY = 'tegaki-panel-layout-v1';
const POPUP_ID = 'panel-layout-popup';
const PREVIEW_MAX = { width: 280, height: 330 };

const SLIDERS = Object.freeze([
    { key: 'margin', label: '余白', unit: 'px', step: 1, ...PANEL_LAYOUT_LIMITS.margin },
    { key: 'gap', label: 'コマ間隔', unit: 'px', step: 1, ...PANEL_LAYOUT_LIMITS.gap },
    { key: 'lineWidth', label: '線の太さ', unit: 'px', step: 0.5, ...PANEL_LAYOUT_LIMITS.lineWidth }
]);

const BLEED_SIDES = Object.freeze([
    { side: 'top', label: '上' },
    { side: 'right', label: '右' },
    { side: 'bottom', label: '下' },
    { side: 'left', label: '左' }
]);

const OUTPUT_MODES = Object.freeze([
    { id: 'lines', label: '枠線のみ', title: '枠線Layerだけを追加' },
    { id: 'paper', label: '白コマ＋クリッピング', title: '白コマ / コマ内描画(クリッピング) / 枠線 の3Layerを追加。コマの外へ描いてもはみ出さない' }
]);

function newGroupId() {
    return `pg_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export class PanelLayoutPopup {
    constructor(dependencies = {}) {
        this.layerSystem = dependencies.layerSystem || null;
        this.eventBus = dependencies.eventBus || TegakiEventBus;
        this.history = dependencies.history || historyManager;
        this.popup = null;
        this.isVisible = false;
        this.popupDragCleanup = null;
        this.elements = {};

        this.params = normalizePanelLayoutParams();
        this.color = PANEL_DEFAULT_LINE_COLOR;
        this.paperColor = PANEL_DEFAULT_PAPER_COLOR;
        this.outputMode = 'lines';
        this.showOverlay = true;
        this.tree = buildPresetById('grid4');
        this.selectedId = null;
        this.editing = null; // { groupId } 再編集中の枠Layer群
        this.drag = null; // { type, id, index, toPoint, pointerId, cleanup }
        this.hoverSplitId = null;
        this.resolved = null;
        this.scale = 1;

        this.overlay = new PanelLayoutOverlay({
            eventBus: this.eventBus,
            onPointerDown: (target, event) => this._onOverlayPointerDown(target, event),
            getState: () => this.isVisible ? {
                resolved: this.resolved,
                selectedId: this.selectedId,
                hoverSplitId: this.hoverSplitId,
                dragSplitId: this.drag?.type === 'split' ? this.drag.id : null
            } : null
        });
        this._layerListener = () => this._syncControls();
        this.eventBus?.on?.('layer:activated', this._layerListener);

        this._restore();
        this._ensurePopupElement();
    }

    // ------------------------------------------------------------ 永続(UI設定のみ)

    _restore() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return;
            const data = JSON.parse(raw);
            if (data?.params) this.params = normalizePanelLayoutParams(data.params);
            // 旧既定(黒/白)のままの保存値はふたば配色の既定へ移行する
            const legacyDefaults = data?.color === '#000000' && data?.paperColor === '#ffffff';
            if (!legacyDefaults && /^#[0-9a-f]{6}$/i.test(data?.color || '')) this.color = data.color;
            if (!legacyDefaults && /^#[0-9a-f]{6}$/i.test(data?.paperColor || '')) this.paperColor = data.paperColor;
            if (OUTPUT_MODES.some(m => m.id === data?.outputMode)) this.outputMode = data.outputMode;
            if (typeof data?.showOverlay === 'boolean') this.showOverlay = data.showOverlay;
            if (data?.tree && isValidPanelTree(data.tree)) {
                const clean = sanitizePanelLayoutData({ tree: data.tree });
                if (clean) this.tree = clean.tree;
            }
        } catch (error) {
            // 壊れた設定は黙って既定へ戻す(Projectには無関係)
        }
    }

    _persist() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                params: this.params,
                color: this.color,
                paperColor: this.paperColor,
                outputMode: this.outputMode,
                showOverlay: this.showOverlay,
                tree: this.tree
            }));
        } catch (error) {
            // localStorage不可でも動作は続ける
        }
    }

    // ------------------------------------------------------------ DOM

    _canvasSize() {
        const c = this.layerSystem?.config?.canvas || window.TEGAKI_CONFIG?.canvas || {};
        return { width: Math.max(1, Math.round(c.width || 800)), height: Math.max(1, Math.round(c.height || 1000)) };
    }

    _ensurePopupElement() {
        let popup = document.getElementById(POPUP_ID);
        if (!popup) {
            popup = document.createElement('div');
            popup.id = POPUP_ID;
            popup.className = 'popup-panel popup-panel--translucent ui-scrollbar panel-layout-popup';
            popup.style.top = '60px';
            popup.style.left = '60px';
            (document.querySelector('.main-layout') || document.body).appendChild(popup);
        } else {
            mountPopupAtOverlayRoot(popup);
        }
        this.popup = popup;
        this._build();
        // プレビューcanvasとrangeはpopup移動ではなく自前のpointer操作を優先する。
        this.popupDragCleanup = attachPopupDrag(popup, {
            interactiveSelector: 'button, input, select, textarea, a, canvas, .popup-close-btn, .ui-close-button'
        });
    }

    _build() {
        const closeBtn = window.DOMBuilder
            ? window.DOMBuilder.createCloseButton(POPUP_ID).outerHTML
            : `<button class="ui-close-button ui-close-button--medium popup-close-btn" data-action="close-popup" data-target="${POPUP_ID}" type="button">${window.UI_ICONS?.close || '×'}</button>`;

        const presetButtons = PANEL_PRESETS.map(p =>
            `<button type="button" class="pl-preset" data-preset="${p.id}" title="${p.label}" aria-label="${p.label}">${this._presetThumb(p.id)}</button>`
        ).join('');
        const sliders = SLIDERS.map(s => `
            <label class="pl-row">
                <span class="pl-label">${s.label}</span>
                <input type="range" class="pl-range" data-param="${s.key}" min="${s.min}" max="${s.max}" step="${s.step}">
                <span class="pl-value" data-value-for="${s.key}"></span>
            </label>`).join('');
        const bleeds = BLEED_SIDES.map(b =>
            `<button type="button" class="pl-chip" data-bleed="${b.side}" aria-pressed="false">${b.label}</button>`
        ).join('');
        const outputs = OUTPUT_MODES.map(m =>
            `<button type="button" class="pl-chip pl-chip--wide" data-output="${m.id}" title="${m.title}" aria-pressed="false">${m.label}</button>`
        ).join('');

        this.popup.innerHTML = `
            ${closeBtn}
            <div class="pl-title">コマ割り <span class="pl-edit-status" data-role="edit-status"></span></div>
            <div class="pl-presets" role="group" aria-label="プリセット">${presetButtons}</div>
            <canvas class="pl-preview" width="${PREVIEW_MAX.width}" height="${PREVIEW_MAX.height}" aria-label="コマ割りプレビュー"></canvas>
            <div class="pl-hint">コマ/線/頂点をドラッグ（Altで吸着オフ）。番号は右上から</div>
            <label class="pl-row pl-check">
                <input type="checkbox" data-role="overlay-toggle">
                <span>キャンバス上に重ねて表示・操作する</span>
            </label>
            <div class="pl-actions" role="group" aria-label="選択コマの操作">
                <button type="button" class="pl-btn" data-action="split-h" title="選択コマを上下に分割">上下に分割</button>
                <button type="button" class="pl-btn" data-action="split-v" title="選択コマを左右に分割">左右に分割</button>
                <button type="button" class="pl-btn" data-action="remove" title="選択コマを消して隣のコマが広がる">結合</button>
                <button type="button" class="pl-btn" data-action="toggle-delete" data-role="delete-btn" title="選択コマを描かず空白にする（番号も飛ぶ）。もう一度押すと復活">削除</button>
            </div>
            <div class="pl-actions" role="group" aria-label="全体の操作">
                <button type="button" class="pl-btn" data-action="align" title="わずかなズレを整える（小さな傾き・素直な分割比・ほぼ同じ位置の線を揃える）">整列</button>
                <button type="button" class="pl-btn" data-action="reset-outer" title="外周の頂点を元の矩形へ戻す">外周を戻す</button>
            </div>
            <div class="pl-split-group" data-role="split-group">
                <label class="pl-row">
                    <span class="pl-label">傾き</span>
                    <input type="range" class="pl-range" data-split="slant" min="${PANEL_LAYOUT_LIMITS.slant.min}" max="${PANEL_LAYOUT_LIMITS.slant.max}" step="0.005">
                    <span class="pl-value" data-value-for="slant"></span>
                </label>
                <label class="pl-row">
                    <span class="pl-label">この線の間隔</span>
                    <input type="range" class="pl-range" data-split="gap" min="${PANEL_LAYOUT_LIMITS.gap.min}" max="${PANEL_LAYOUT_LIMITS.gap.max}" step="1">
                    <span class="pl-value" data-value-for="splitGap"></span>
                </label>
                <button type="button" class="pl-btn pl-btn--small" data-action="reset-split-gap">全体の間隔に戻す</button>
            </div>
            <div class="pl-panel-group" data-role="panel-group">
                <label class="pl-row">
                    <span class="pl-label">このコマの線</span>
                    <input type="range" class="pl-range" data-panel="lineWidth" min="${PANEL_LAYOUT_LIMITS.lineWidth.min}" max="${PANEL_LAYOUT_LIMITS.lineWidth.max}" step="0.5">
                    <span class="pl-value" data-value-for="panelLineWidth"></span>
                </label>
                <div class="pl-row">
                    <span class="pl-label">裁ち落とし</span>
                    <span class="pl-chips">${bleeds}</span>
                </div>
                <div class="pl-row">
                    <button type="button" class="pl-btn pl-btn--small" data-action="reset-panel-line">線を全体に合わせる</button>
                </div>
            </div>
            <div class="pl-sep"></div>
            ${sliders}
            <div class="pl-row">
                <span class="pl-label">線の色</span>
                <input type="color" class="pl-color" data-color="line" value="${this.color}">
                <span class="pl-label pl-label--inline" data-role="paper-label">コマの白</span>
                <input type="color" class="pl-color" data-color="paper" value="${this.paperColor}">
            </div>
            <div class="pl-row">
                <span class="pl-label">出力</span>
                <span class="pl-chips">${outputs}</span>
            </div>
            <div class="pl-footer">
                <button type="button" class="pl-btn" data-action="reset">リセット</button>
                <button type="button" class="pl-btn" data-action="load-active" title="選択中のコマ枠Layerから木を読み込んで再編集">レイヤーから再編集</button>
            </div>
            <div class="pl-footer">
                <button type="button" class="pl-btn pl-btn--primary" data-action="update" data-role="update-btn" title="再編集中のコマ枠Layerを置き換え（Undo 1回で戻る）" hidden>既存のコマ枠を更新</button>
                <button type="button" class="pl-btn pl-btn--primary" data-action="apply" title="新規Layerとして追加（Undo 1回で戻る）">新規レイヤーに適用</button>
            </div>
            <div class="pl-warning" data-role="warning" hidden>間隔や余白が大きすぎて潰れたコマがあります</div>
        `;

        const q = (sel) => this.popup.querySelector(sel);
        this.elements = {
            canvas: q('.pl-preview'),
            warning: q('[data-role="warning"]'),
            splitGroup: q('[data-role="split-group"]'),
            panelGroup: q('[data-role="panel-group"]'),
            editStatus: q('[data-role="edit-status"]'),
            updateBtn: q('[data-role="update-btn"]'),
            loadBtn: q('[data-action="load-active"]'),
            overlayToggle: q('[data-role="overlay-toggle"]'),
            paperLabel: q('[data-role="paper-label"]'),
            paperColor: q('[data-color="paper"]'),
            deleteBtn: q('[data-role="delete-btn"]')
        };
        this._bind();
        this._syncControls();
        this._redraw();
    }

    _presetThumb(id) {
        const tree = buildPresetById(id);
        const r = resolvePanelLayout(tree, { width: 100, height: 130 }, { margin: 6, gap: 5 });
        const polys = r.panels.map(p =>
            `<polygon points="${p.quad.map(pt => `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`).join(' ')}"/>`
        ).join('');
        return `<svg viewBox="0 0 100 130" width="22" height="28" fill="none" stroke="currentColor" stroke-width="5" stroke-linejoin="round" aria-hidden="true">${polys}</svg>`;
    }

    // ------------------------------------------------------------ 操作

    _bind() {
        const root = this.popup;
        root.querySelectorAll('[data-preset]').forEach(btn => btn.addEventListener('click', () => {
            this.tree = buildPresetById(btn.dataset.preset);
            this.selectedId = null;
            this._changed();
        }));
        root.querySelectorAll('input[data-param]').forEach(input => input.addEventListener('input', () => {
            this.params = normalizePanelLayoutParams({ ...this.params, [input.dataset.param]: Number(input.value) });
            this._changed();
        }));
        root.querySelector('[data-split="slant"]').addEventListener('input', (e) => this._patchSelectedSplit({ slant: Number(e.target.value) }));
        root.querySelector('[data-split="gap"]').addEventListener('input', (e) => this._patchSelectedSplit({ gap: Number(e.target.value) }));
        root.querySelector('[data-panel="lineWidth"]').addEventListener('input', (e) => {
            const id = this._selectedPanelId();
            if (!id) return;
            this.tree = setPanelLineWidth(this.tree, id, Number(e.target.value));
            this._changed();
        });
        root.querySelector('[data-color="line"]').addEventListener('input', (e) => {
            this.color = e.target.value;
            this._changed();
        });
        this.elements.paperColor.addEventListener('input', (e) => {
            this.paperColor = e.target.value;
            this._changed();
        });
        this.elements.overlayToggle.addEventListener('change', (e) => {
            this.showOverlay = e.target.checked;
            this._persist();
            this._syncOverlayVisibility();
        });
        root.querySelectorAll('[data-output]').forEach(btn => btn.addEventListener('click', () => {
            this.outputMode = btn.dataset.output;
            this._changed();
        }));
        root.querySelectorAll('[data-bleed]').forEach(btn => btn.addEventListener('click', () => {
            const node = this.selectedId && findNode(this.tree, this.selectedId);
            if (!node || node.kind !== 'panel') return;
            const bleed = { ...(node.bleed || {}) };
            bleed[btn.dataset.bleed] = !bleed[btn.dataset.bleed];
            this.tree = setPanelBleed(this.tree, node.id, bleed);
            this._changed();
        }));
        root.querySelectorAll('[data-action]').forEach(btn => {
            if (btn.dataset.action === 'close-popup') return;
            btn.addEventListener('click', () => this._onAction(btn.dataset.action));
        });

        const canvas = this.elements.canvas;
        canvas.addEventListener('pointerdown', (e) => this._onPreviewPointerDown(e));
        canvas.addEventListener('pointermove', (e) => this._onPreviewHover(e));
        canvas.addEventListener('pointerleave', () => {
            if (this.drag) return;
            this.hoverSplitId = null;
            this._redraw();
        });
    }

    _onAction(action) {
        if (action === 'reset') {
            this.tree = buildPresetById('single');
            this.selectedId = null;
            this.editing = null;
            this._changed();
        } else if (action === 'apply') {
            this.apply();
        } else if (action === 'update') {
            this.update();
        } else if (action === 'load-active') {
            this.loadFromActiveLayer();
        } else if (action === 'split-h' || action === 'split-v') {
            const target = this._selectedPanelId();
            if (!target) return showFeedbackToast('分割するコマを選択してください');
            this.tree = splitPanel(this.tree, target, action === 'split-h' ? 'h' : 'v', 0.5);
            this._changed();
        } else if (action === 'remove') {
            const target = this._selectedPanelId();
            if (!target) return showFeedbackToast('結合するコマを選択してください');
            this.tree = removePanel(this.tree, target);
            this.selectedId = null;
            this._changed();
        } else if (action === 'reset-split-gap') {
            if (this._selectedParentSplit()) this._patchSelectedSplit({ gap: null });
        } else if (action === 'reset-panel-line') {
            const id = this._selectedPanelId();
            if (id) {
                this.tree = setPanelLineWidth(this.tree, id, null);
                this._changed();
            }
        } else if (action === 'reset-outer') {
            this.tree = resetOuterCorners(this.tree);
            this._changed();
        } else if (action === 'toggle-delete') {
            const id = this._selectedPanelId();
            if (!id) return showFeedbackToast('削除するコマを選択してください');
            const node = findNode(this.tree, id);
            this.tree = setPanelDeleted(this.tree, id, node.deleted !== true);
            this._changed();
        } else if (action === 'align') {
            const result = alignLayout(this.tree, this._canvasSize(), this.params);
            this.tree = result.tree;
            this._changed();
            showFeedbackToast(result.changed ? `整列しました（${result.changed}箇所）` : 'すでに整っています');
        }
    }

    _selectedPanelId() {
        const node = this.selectedId && findNode(this.tree, this.selectedId);
        return node && node.kind === 'panel' ? node.id : null;
    }

    _selectedParentSplit() {
        const id = this._selectedPanelId();
        return id ? findParent(this.tree, id) : null;
    }

    _patchSelectedSplit(patch) {
        const split = this._selectedParentSplit();
        if (!split) return;
        this.tree = updateSplit(this.tree, split.id, patch);
        this._changed();
    }

    _changed() {
        this._persist();
        this._syncControls();
        this._redraw();
    }

    _activePanelLayout() {
        const data = this.layerSystem?.getActiveLayer?.()?.layerData?.panelLayout;
        return data ? sanitizePanelLayoutData(data) : null;
    }

    _syncControls() {
        if (!this.popup || !this.elements.canvas) return;
        for (const s of SLIDERS) {
            const input = this.popup.querySelector(`input[data-param="${s.key}"]`);
            if (input && Number(input.value) !== this.params[s.key]) input.value = String(this.params[s.key]);
            const out = this.popup.querySelector(`[data-value-for="${s.key}"]`);
            if (out) out.textContent = `${this.params[s.key]}${s.unit}`;
        }
        const panel = this._selectedPanelId() ? findNode(this.tree, this._selectedPanelId()) : null;
        const split = this._selectedParentSplit();
        this.elements.splitGroup.hidden = !split;
        this.elements.panelGroup.hidden = !panel;
        if (split) {
            this.popup.querySelector('[data-split="slant"]').value = String(split.slant || 0);
            this.popup.querySelector('[data-split="gap"]').value = String(split.gap ?? this.params.gap);
            this.popup.querySelector('[data-value-for="slant"]').textContent = `${Math.round((split.slant || 0) * 100)}%`;
            this.popup.querySelector('[data-value-for="splitGap"]').textContent = split.gap == null ? '全体' : `${split.gap}px`;
        }
        if (panel) {
            const width = panel.lineWidth ?? this.params.lineWidth;
            this.popup.querySelector('[data-panel="lineWidth"]').value = String(width);
            this.popup.querySelector('[data-value-for="panelLineWidth"]').textContent =
                panel.lineWidth == null ? '全体' : `${panel.lineWidth}px`;
        }
        this.popup.querySelectorAll('[data-bleed]').forEach(btn => {
            const on = panel?.bleed?.[btn.dataset.bleed] === true;
            btn.setAttribute('aria-pressed', String(on));
            btn.classList.toggle('is-selected', on);
        });
        this.popup.querySelectorAll('[data-output]').forEach(btn => {
            const on = btn.dataset.output === this.outputMode;
            btn.setAttribute('aria-pressed', String(on));
            btn.classList.toggle('is-selected', on);
        });
        const paper = this.outputMode === 'paper';
        this.elements.paperLabel.hidden = !paper;
        this.elements.paperColor.hidden = !paper;
        this.elements.overlayToggle.checked = this.showOverlay;
        this.elements.deleteBtn.textContent = panel?.deleted === true ? '復活' : '削除';
        this.elements.editStatus.textContent = this.editing ? '— 再編集中' : '';
        this.elements.updateBtn.hidden = !this.editing;
        this.elements.loadBtn.disabled = !this._activePanelLayout();
    }

    _syncOverlayVisibility() {
        this.overlay.setVisible(this.isVisible && this.showOverlay);
    }

    // ------------------------------------------------------------ 共通ドラッグ(プレビュー/キャンバス上)

    _beginDrag(target, event, toPoint) {
        if (target.type === 'panel') {
            this.selectedId = target.id;
            this._syncControls();
            this._redraw();
            return;
        }
        this.endDrag();
        const move = (e) => {
            if (!this.drag || e.pointerId !== this.drag.pointerId) return;
            const pt = toPoint(e);
            if (pt) this._applyDrag(pt, e.altKey === true);
        };
        const up = (e) => {
            if (!this.drag || e.pointerId !== this.drag.pointerId) return;
            this.endDrag();
            this._redraw();
        };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
        window.addEventListener('pointercancel', up);
        this.drag = {
            ...target,
            pointerId: event.pointerId,
            cleanup: () => {
                window.removeEventListener('pointermove', move);
                window.removeEventListener('pointerup', up);
                window.removeEventListener('pointercancel', up);
            }
        };
        if (target.type === 'corner') {
            this.selectedId = target.id;
            this._syncControls();
        }
        this._redraw();
    }

    endDrag() {
        if (!this.drag) return;
        this.drag.cleanup?.();
        this.drag = null;
    }

    _applyDrag(pt, noSnap = false) {
        const drag = this.drag;
        if (!drag || !this.resolved) return;
        if (drag.type === 'split') {
            const target = noSnap ? pt : snapSplitPoint(this.resolved, drag.id, pt, 6 / Math.max(this.scale, 0.2));
            const ratio = dragSplitRatio(this.resolved, drag.id, target);
            if (ratio !== null) this.tree = updateSplit(this.tree, drag.id, { ratio });
        } else if (drag.type === 'corner') {
            this.tree = dragPanelCorner(this.tree, this.resolved, drag.id, drag.index, pt);
        }
        this._persist();
        this._redraw();
    }

    _onOverlayPointerDown(target, event) {
        this._beginDrag(target, event, (e) => this.overlay.clientToCanvas(e.clientX, e.clientY));
    }

    // ------------------------------------------------------------ プレビュー

    _toCanvasPoint(e) {
        const rect = this.elements.canvas.getBoundingClientRect();
        const px = (e.clientX - rect.left) * (this.elements.canvas.width / rect.width);
        const py = (e.clientY - rect.top) * (this.elements.canvas.height / rect.height);
        return { x: px / this.scale, y: py / this.scale };
    }

    _hitPreview(pt) {
        const tol = 8 / this.scale;
        const selected = this._selectedPanelId();
        if (selected) {
            const index = hitTestCorner(this.resolved, selected, pt, tol);
            if (index >= 0) return { type: 'corner', id: selected, index };
        }
        const splitId = hitTestSplit(this.resolved, pt, tol);
        if (splitId) return { type: 'split', id: splitId };
        const panelId = hitTestPanel(this.resolved, pt);
        return panelId ? { type: 'panel', id: panelId } : { type: 'none' };
    }

    _onPreviewPointerDown(e) {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        const target = this._hitPreview(this._toCanvasPoint(e));
        if (target.type === 'none') {
            this.selectedId = null;
            this._syncControls();
            this._redraw();
        } else {
            this._beginDrag(target, e, (ev) => this._toCanvasPoint(ev));
        }
        e.preventDefault();
    }

    _onPreviewHover(e) {
        if (this.drag) return;
        const target = this._hitPreview(this._toCanvasPoint(e));
        const hover = target.type === 'split' ? target.id : null;
        this.elements.canvas.style.cursor = target.type === 'corner' ? 'move' : hover ? 'grab' : 'default';
        if (hover !== this.hoverSplitId) {
            this.hoverSplitId = hover;
            this._redraw();
        }
    }

    _redraw() {
        const canvasEl = this.elements.canvas;
        if (!canvasEl) return;
        const size = this._canvasSize();
        this.scale = Math.min(PREVIEW_MAX.width / size.width, PREVIEW_MAX.height / size.height);
        canvasEl.width = Math.max(1, Math.round(size.width * this.scale));
        canvasEl.height = Math.max(1, Math.round(size.height * this.scale));
        this.resolved = resolvePanelLayout(this.tree, size, this.params);
        this.elements.warning.hidden = this.resolved.valid;

        const ctx = canvasEl.getContext('2d');
        const s = this.scale;
        ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
        ctx.fillStyle = '#ffffee';
        ctx.fillRect(0, 0, canvasEl.width, canvasEl.height);

        const trace = (quad) => {
            ctx.beginPath();
            quad.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x * s, p.y * s) : ctx.lineTo(p.x * s, p.y * s)));
            ctx.closePath();
        };
        for (const panel of this.resolved.panels) {
            trace(panel.quad);
            if (panel.deleted) {
                ctx.setLineDash([3, 4]);
                ctx.strokeStyle = panel.id === this.selectedId ? '#ff8c42' : '#b8706b';
                ctx.lineWidth = 1.5;
                ctx.stroke();
                ctx.setLineDash([]);
                continue;
            }
            ctx.fillStyle = this.outputMode === 'paper'
                ? this.paperColor
                : (panel.id === this.selectedId ? 'rgba(255, 140, 66, 0.22)' : 'rgba(212, 168, 160, 0.28)');
            ctx.fill();
            if (this.outputMode === 'paper' && panel.id === this.selectedId) {
                ctx.fillStyle = 'rgba(255, 140, 66, 0.22)';
                ctx.fill();
            }
            ctx.strokeStyle = this.color;
            ctx.lineWidth = Math.max(1, (panel.lineWidth ?? this.params.lineWidth) * s);
            ctx.lineJoin = 'miter';
            ctx.stroke();
            if (panel.number) {
                const cx = panel.quad.reduce((sum, q) => sum + q.x, 0) / 4 * s;
                const cy = panel.quad.reduce((sum, q) => sum + q.y, 0) / 4 * s;
                ctx.font = `700 ${Math.max(12, Math.min(34, 30 * s * 2))}px sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.lineWidth = 4;
                ctx.strokeStyle = '#ffffee';
                ctx.strokeText(String(panel.number), cx, cy);
                ctx.fillStyle = 'rgba(128, 0, 0, 0.5)';
                ctx.fillText(String(panel.number), cx, cy);
            }
            if (panel.id === this.selectedId) {
                trace(panel.quad);
                ctx.strokeStyle = '#ff8c42';
                ctx.lineWidth = 2;
                ctx.stroke();
                ctx.fillStyle = '#ffffee';
                for (const q of panel.quad) {
                    ctx.beginPath();
                    ctx.rect(q.x * s - 3.5, q.y * s - 3.5, 7, 7);
                    ctx.fill();
                    ctx.stroke();
                }
            }
        }
        const activeSplit = this.drag?.type === 'split' ? this.drag.id : this.hoverSplitId;
        if (activeSplit) {
            const split = this.resolved.splits.find(sp => sp.id === activeSplit);
            if (split) {
                ctx.strokeStyle = '#ff8c42';
                ctx.lineWidth = 2;
                ctx.setLineDash([5, 4]);
                ctx.beginPath();
                ctx.moveTo(split.cut[0].x * s, split.cut[0].y * s);
                ctx.lineTo(split.cut[1].x * s, split.cut[1].y * s);
                ctx.stroke();
                ctx.setLineDash([]);
            }
        }
        this.overlay.schedule();
    }

    // ------------------------------------------------------------ 確定

    _layoutMeta(role, groupId) {
        return sanitizePanelLayoutData({
            groupId,
            role,
            tree: this.tree,
            params: this.params,
            color: this.color,
            paperColor: this.paperColor
        });
    }

    _rasterFor(role, resolved) {
        const size = this._canvasSize();
        if (role === 'inner') {
            return {
                ok: true,
                width: size.width,
                height: size.height,
                pixels: new Uint8ClampedArray(size.width * size.height * 4),
                rasterBounds: { x: 0, y: 0, width: size.width, height: size.height }
            };
        }
        return role === 'paper'
            ? rasterizePanelFrames(resolved, { ...size, mode: 'fill', color: this.paperColor })
            : rasterizePanelFrames(resolved, { ...size, mode: 'lines', lineWidth: this.params.lineWidth, color: this.color });
    }

    _guard() {
        if (!this.layerSystem?.createRasterLayerFromSnapshot) {
            showFeedbackToast('Raster Layerを作成できません');
            return false;
        }
        if (this.layerSystem.getActiveLayer?.()?.layerData?.isAnimationWorkingLayer === true) {
            showFeedbackToast('コマ割りは通常CanvasのRaster Layer専用です');
            return false;
        }
        return true;
    }

    _createLayer(raster, name, role, groupId) {
        const created = this.layerSystem.createRasterLayerFromSnapshot({
            width: raster.width,
            height: raster.height,
            pixels: raster.pixels,
            rasterBounds: raster.rasterBounds,
            paths: [],
            pathsData: []
        }, { name, historyName: 'panel-layout-layer', source: 'panel-layout' });
        if (!created?.layer?.layerData) return null;
        created.layer.layerData.panelLayout = this._layoutMeta(role, groupId);
        this.eventBus?.emit('layer:content-changed', { layerId: created.layer.layerData.id, source: 'panel-layout' });
        return created;
    }

    _setClipping(layerId, mode) {
        const index = this.layerSystem.getLayers().findIndex(l => l.layerData?.id === layerId);
        if (index < 0) return false;
        return this.layerSystem.setLayerClippingMode(index, mode, { recordHistory: false });
    }

    apply() {
        if (!this._guard()) return { ok: false };
        const size = this._canvasSize();
        const resolved = resolvePanelLayout(this.tree, size, this.params);
        const groupId = newGroupId();
        const roles = this.outputMode === 'paper' ? ['paper', 'inner', 'lines'] : ['lines'];
        const names = { paper: 'コマ白', inner: 'コマ内描画', lines: 'コマ枠' };
        let recorded = 0;
        let failure = null;
        const memberIds = [];

        for (const role of roles) {
            const raster = this._rasterFor(role, resolved);
            if (!raster.ok) { failure = raster.reason; break; }
            let created = null;
            try {
                created = this._createLayer(raster, names[role], role, groupId);
            } catch (error) {
                created = null;
            }
            if (!created) { failure = 'コマ枠レイヤーを作成できません'; break; }
            recorded += 1;
            memberIds.push(created.layer.layerData.id);
            if (role === 'inner') {
                const layerId = created.layer.layerData.id;
                this._setClipping(layerId, 'normal');
                this.history.record({
                    name: 'panel-layout-clipping',
                    do: () => this._setClipping(layerId, 'normal'),
                    undo: () => this._setClipping(layerId, 'none'),
                    meta: { type: 'panel-layout-clipping', layerId }
                });
                recorded += 1;
            }
        }

        // 白コマ / コマ内描画 / 枠線 は1セットとして専用フォルダへ収納する(下から paper, inner, lines の順)
        if (!failure && roles.length > 1) {
            const folder = this.layerSystem.createFolder?.('コマ割り');
            if (folder?.layer?.layerData) {
                recorded += 1;
                folder.layer.layerData.panelLayout = this._layoutMeta('folder', groupId);
                const folderId = folder.layer.layerData.id;
                for (const id of memberIds) {
                    const alreadyInside = this.layerSystem.getLayers()
                        .find(l => l.layerData?.id === id)?.layerData?.parentId === folderId;
                    if (!alreadyInside && this.layerSystem.moveLayerIntoFolder(id, folderId)) recorded += 1;
                }
                this.layerSystem.refreshClippingMasks?.();
            }
        }

        if (recorded > 1) this.history.mergeLastCommands(recorded, 'panel-layout-apply', { type: 'panel-layout-apply', groupId });
        if (failure) {
            if (recorded > 0) this.history.undo();
            showFeedbackToast(failure);
            return { ok: false };
        }
        this.editing = { groupId };
        this._syncControls();
        showFeedbackToast(`コマ割りを追加しました（${resolved.panels.length}コマ）`);
        return { ok: true, groupId, panelCount: resolved.panels.length };
    }

    /** 再編集中のgroupの枠Layer(role: lines / paper)の画素とvector dataを置き換える。 */
    update() {
        if (!this.editing || !this._guard()) return { ok: false };
        const groupId = this.editing.groupId;
        const resolved = resolvePanelLayout(this.tree, this._canvasSize(), this.params);
        const targets = this.layerSystem.getLayers().filter(l => {
            const pl = l.layerData?.panelLayout;
            return pl?.groupId === groupId && (pl.role === 'lines' || pl.role === 'paper' || pl.role === 'inner');
        });
        if (!targets.length) {
            showFeedbackToast('再編集中のコマ枠Layerが見つかりません');
            this.editing = null;
            this._syncControls();
            return { ok: false };
        }

        const entries = [];
        for (const layer of targets) {
            const role = layer.layerData.panelLayout.role;
            const before = this.layerSystem.createLayerRasterSnapshot(layer);
            const metaBefore = layer.layerData.panelLayout;
            const metaAfter = this._layoutMeta(role, groupId);
            if (role === 'inner') {
                entries.push({ layer, before: null, after: null, metaBefore, metaAfter });
                continue;
            }
            const raster = this._rasterFor(role, resolved);
            if (!raster.ok) { showFeedbackToast(raster.reason); return { ok: false }; }
            const after = {
                ...before,
                width: raster.width,
                height: raster.height,
                pixels: raster.pixels,
                rasterBounds: raster.rasterBounds,
                paths: [],
                pathsData: []
            };
            entries.push({ layer, before, after, metaBefore, metaAfter });
        }

        const applyEntries = (useAfter) => {
            for (const entry of entries) {
                const snapshot = useAfter ? entry.after : entry.before;
                if (snapshot) this.layerSystem.restoreLayerRasterSnapshot(snapshot);
                entry.layer.layerData.panelLayout = useAfter ? entry.metaAfter : entry.metaBefore;
                this.eventBus?.emit('layer:content-changed', { layerId: entry.layer.layerData.id, source: 'panel-layout-update' });
            }
            this.eventBus?.emit('panel-layout:updated', { groupId });
        };
        applyEntries(true);
        this.history.record({
            name: 'panel-layout-update',
            do: () => applyEntries(true),
            undo: () => applyEntries(false),
            byteSize: entries.reduce((sum, e) => sum + (e.before?.pixels?.byteLength || 0) + (e.after?.pixels?.byteLength || 0), 0),
            meta: { type: 'panel-layout-update', groupId }
        });
        showFeedbackToast(`コマ枠を更新しました（${resolved.panels.length}コマ）`);
        return { ok: true, groupId };
    }

    loadFromActiveLayer() {
        const data = this._activePanelLayout();
        if (!data) {
            showFeedbackToast('選択中のレイヤーにコマ割り情報がありません');
            return { ok: false };
        }
        this.tree = data.tree;
        this.params = data.params;
        this.color = data.color;
        this.paperColor = data.paperColor;
        if (data.role === 'paper' || data.role === 'inner' || data.role === 'folder') this.outputMode = 'paper';
        this.selectedId = null;
        this.editing = data.groupId ? { groupId: data.groupId } : null;
        this.popup.querySelector('[data-color="line"]').value = this.color;
        this.elements.paperColor.value = this.paperColor;
        this._changed();
        showFeedbackToast('コマ割りを読み込みました。編集して「更新」できます');
        return { ok: true };
    }

    // ------------------------------------------------------------ popup protocol

    show() {
        const wasVisible = this.isVisible === true;
        if (!this.popup) this._ensurePopupElement();
        if (!this.popup) return;
        this.popup.classList.add('show');
        this.isVisible = true;
        this._syncControls();
        this._redraw();
        this._syncOverlayVisibility();
        if (!wasVisible) this.eventBus.emit('popup:shown', { name: 'panelLayout' });
    }

    hide() {
        if (!this.popup) return;
        const wasVisible = this.isVisible === true;
        this.popup.classList.remove('show');
        this.isVisible = false;
        this.endDrag();
        this._syncOverlayVisibility();
        if (wasVisible) this.eventBus.emit('popup:hidden', { name: 'panelLayout' });
    }

    toggle() {
        if (this.isVisible) this.hide();
        else this.show();
    }

    isReady() {
        return !!this.popup;
    }

    destroy() {
        this.endDrag();
        this.popupDragCleanup?.();
        this.popupDragCleanup = null;
        this.eventBus?.off?.('layer:activated', this._layerListener);
        this.overlay.destroy();
    }
}

window.PanelLayoutPopup = PanelLayoutPopup;
